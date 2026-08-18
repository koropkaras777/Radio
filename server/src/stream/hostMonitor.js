import { spawn } from 'node:child_process';
import dgram from 'node:dgram';
import { RTCPeerConnection, MediaStream, MediaStreamTrack } from 'werift';
import {
  HOST_MONITOR_ICE_PORT_MIN, HOST_MONITOR_ICE_PORT_MAX, HOST_MONITOR_STUN_URL, FFMPEG_PATH,
} from '../config/env.js';
import { DEFAULT_MIC_GAIN, clampMicGain, createMicLimiter } from './micGain.js';

const FFMPEG_BINARY   = FFMPEG_PATH;
const PCM_SAMPLE_RATE = 44100;
const PCM_CHANNELS    = 2;
const PCM_FORMAT      = 's16le';

const RELAY_PORT_MIN   = 24000;
const RELAY_PORT_COUNT = 20;

const RADIO_MUSIC_STREAM_ID = 'radio-music';

class HostMonitorChannel {
  #io = null;

  #pcs          = new Map(); 
  #sourceTracks = new Map(); 
  #encoders     = new Map(); 
  #composition  = new Map(); 
  #negotiating  = new Map(); 
  #pendingAnswer = new Map(); 
  #micGains     = new Map();
  #micLimiters  = new Map();
  #mutedIds     = new Set();

  #radioMusicTrack = null;
  #radioMusicRelay = null;

  #freePorts = new Set(
    Array.from({ length: RELAY_PORT_COUNT }, (_, i) => RELAY_PORT_MIN + i)
  );

  setIo(io) {
    this.#io = io;
  }

  #emit(hostId, event, payload) {
    this.#io?.sockets.sockets.get(hostId)?.emit(event, payload);
  }

  #allocPort() {
    const next = this.#freePorts.values().next();
    if (next.done) throw new Error('[HostMonitor] No free relay ports left');
    this.#freePorts.delete(next.value);
    return next.value;
  }

  #releasePort(port) {
    this.#freePorts.add(port);
  }

  #ensureHostSource(hostId) {
    if (this.#sourceTracks.has(hostId)) return;

    const port   = this.#allocPort();
    const track  = new MediaStreamTrack({ kind: 'audio' });
    const socket = dgram.createSocket('udp4');

    socket.on('message', (msg) => {
      try { track.writeRtp(msg); } catch { }
    });
    socket.on('error', (err) => {
      console.warn(`[HostMonitor] Relay socket error (${hostId}):`, err.message);
    });
    socket.bind(port, '127.0.0.1');

    const proc = this.#spawnOpusRtpEncoder(port, `host-mic:${hostId}`);

    this.#sourceTracks.set(hostId, track);
    this.#encoders.set(hostId, { proc, socket, port });
    this.#micLimiters.set(hostId, createMicLimiter(PCM_SAMPLE_RATE));
  }

  #ensureRadioMusicRelay() {
    if (this.#radioMusicRelay) return;

    const port   = this.#allocPort();
    const track  = new MediaStreamTrack({ kind: 'audio' });
    const socket = dgram.createSocket('udp4');

    socket.on('message', (msg) => {
      try { track.writeRtp(msg); } catch { }
    });
    socket.on('error', (err) => {
      console.warn('[HostMonitor] Radio-music relay socket error:', err.message);
    });
    socket.bind(port, '127.0.0.1');

    const proc = this.#spawnOpusRtpEncoder(port, 'radio-music');

    this.#radioMusicTrack = track;
    this.#radioMusicRelay = { proc, socket, port };
  }

  #stopRadioMusicRelay() {
    if (!this.#radioMusicRelay) return;
    const { proc, socket, port } = this.#radioMusicRelay;
    try { proc.stdin.end(); } catch { }
    try { proc.kill('SIGTERM'); } catch { }
    try { socket.close(); } catch { }
    this.#releasePort(port);
    this.#radioMusicTrack?.stop();
    this.#radioMusicTrack = null;
    this.#radioMusicRelay = null;
  }

  #spawnOpusRtpEncoder(port, label) {
    const proc = spawn(FFMPEG_BINARY, [
      '-loglevel', 'error',
      '-f',  PCM_FORMAT,
      '-ar', String(PCM_SAMPLE_RATE),
      '-ac', String(PCM_CHANNELS),
      '-i',  'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-application', 'voip',
      '-f', 'rtp',
      '-payload_type', '111',
      `rtp://127.0.0.1:${port}`,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[FFmpeg:monitor-encode:${label}] ${msg}`);
    });
    proc.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') console.warn(`[HostMonitor] Encoder stdin error (${label}):`, err.message);
    });
    proc.on('error', (err) => {
      console.error(`[HostMonitor] Encoder spawn error (${label}):`, err.message);
    });

    return proc;
  }

  setMicGain(hostId, gain) {
    this.#micGains.set(hostId, clampMicGain(gain));
  }

  #getMicGain(hostId) {
    return this.#micGains.get(hostId) ?? DEFAULT_MIC_GAIN;
  }

  #applyGain(buffer, gain, limiter) {
    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i + 1 < buffer.length; i += 2) {
      out.writeInt16LE(limiter.limit(buffer.readInt16LE(i) * gain), i);
    }
    return out;
  }

  setMuted(hostId, muted) {
    if (muted) this.#mutedIds.add(hostId);
    else this.#mutedIds.delete(hostId);
  }

  isMuted(hostId) {
    return this.#mutedIds.has(hostId);
  }

  pushMicPcm(hostId, chunk) {
    const enc = this.#encoders.get(hostId);
    if (!enc || enc.proc.stdin.destroyed) return;
    if (this.#mutedIds.has(hostId)) {
      try { enc.proc.stdin.write(Buffer.alloc(chunk.length)); } catch { }
      return;
    }
    const gain    = this.#getMicGain(hostId);
    const limiter = this.#micLimiters.get(hostId);
    const boosted = gain === 1 || !limiter ? chunk : this.#applyGain(chunk, gain, limiter);
    try {
      enc.proc.stdin.write(boosted);
    } catch (err) {
      if (err.code !== 'EPIPE') console.warn(`[HostMonitor] Failed writing PCM (${hostId}):`, err.message);
    }
  }

  pushRadioMusicPcm(chunk) {
    const relay = this.#radioMusicRelay;
    if (!relay || relay.proc.stdin.destroyed) return;
    try {
      relay.proc.stdin.write(chunk);
    } catch (err) {
      if (err.code !== 'EPIPE') console.warn('[HostMonitor] Failed writing radio-music PCM:', err.message);
    }
  }

  #compositionKey(otherIds) {
    return [...otherIds].sort().join(',');
  }

  syncRoster(liveHostIds) {
    const ids = new Set(liveHostIds);
    if (ids.size === 0) return;

    this.#ensureRadioMusicRelay();
    for (const hostId of ids) this.#ensureHostSource(hostId);

    for (const hostId of ids) {
      const others = new Set(ids);
      others.delete(hostId);
      const key = this.#compositionKey(others);
      if (this.#pcs.has(hostId) && this.#composition.get(hostId) === key) continue;
      this.#composition.set(hostId, key);
      this.#scheduleRebuild(hostId, others);
    }
  }

  async removeHost(hostId) {
    const enc = this.#encoders.get(hostId);
    if (enc) {
      try { enc.proc.stdin.end(); } catch { }
      try { enc.proc.kill('SIGTERM'); } catch { }
      try { enc.socket.close(); } catch { }
      this.#releasePort(enc.port);
      this.#encoders.delete(hostId);
    }
    this.#sourceTracks.get(hostId)?.stop();
    this.#sourceTracks.delete(hostId);
    this.#micGains.delete(hostId);
    this.#micLimiters.delete(hostId);
    this.#mutedIds.delete(hostId);

    const pc = this.#pcs.get(hostId);
    if (pc) {
      try { await pc.close(); } catch { }
      this.#pcs.delete(hostId);
    }
    this.#composition.delete(hostId);
    this.#negotiating.delete(hostId);
    this.#pendingAnswer.delete(hostId);

    if (this.#pcs.size === 0) {
      this.#stopRadioMusicRelay();
      return;
    }

    const remainingIds = new Set(this.#sourceTracks.keys());
    for (const otherId of this.#pcs.keys()) {
      const others = new Set(remainingIds);
      others.delete(otherId);
      const key = this.#compositionKey(others);
      this.#composition.set(otherId, key);
      this.#scheduleRebuild(otherId, others);
    }
  }

  #scheduleRebuild(hostId, otherIds) {
    const prev = this.#negotiating.get(hostId) || Promise.resolve();
    const next = prev
      .then(() => this.#rebuildPeerConnection(hostId, otherIds))
      .catch((err) => console.error(`[HostMonitor] Rebuild failed (${hostId}):`, err.message));
    this.#negotiating.set(hostId, next);
  }

  async #rebuildPeerConnection(hostId, otherIds) {
    const oldPc = this.#pcs.get(hostId);
    if (oldPc) {
      try { await oldPc.close(); } catch { }
    }

    const pc = new RTCPeerConnection({
      iceServers:   [{ urls: HOST_MONITOR_STUN_URL }],
      icePortRange: [HOST_MONITOR_ICE_PORT_MIN, HOST_MONITOR_ICE_PORT_MAX],
    });
    this.#pcs.set(hostId, pc);

    pc.onIceCandidate.subscribe((candidate) => {
      if (this.#pcs.get(hostId) !== pc) return;
      this.#emit(hostId, 'monitor_ice_candidate', candidate ? candidate.toJSON() : null);
    });
    pc.connectionStateChange.subscribe((state) => {
      if (this.#pcs.get(hostId) !== pc) return;
      if (state === 'failed') console.warn(`[HostMonitor] Connection failed for ${hostId}`);
    });

    const trackOwners = [];

    if (this.#radioMusicTrack) {
      const musicStream = new MediaStream({ id: RADIO_MUSIC_STREAM_ID, tracks: [this.#radioMusicTrack] });
      pc.addTransceiver(this.#radioMusicTrack, { direction: 'sendonly', streams: [musicStream] });
      trackOwners.push(RADIO_MUSIC_STREAM_ID);
    }
    for (const otherId of otherIds) {
      const track = this.#sourceTracks.get(otherId);
      if (!track) continue;
      const stream = new MediaStream({ id: otherId, tracks: [track] });
      pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
      trackOwners.push(otherId);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.#emit(hostId, 'monitor_offer', { sdp: pc.localDescription, trackOwners });
    await this.#waitForAnswer(hostId);
  }

  #waitForAnswer(hostId) {
    return new Promise((resolve) => {
      this.#pendingAnswer.set(hostId, resolve);
      setTimeout(() => {
        if (this.#pendingAnswer.get(hostId) === resolve) {
          this.#pendingAnswer.delete(hostId);
          resolve();
        }
      }, 8000);
    });
  }

  async handleAnswer(hostId, sdp) {
    const pc = this.#pcs.get(hostId);
    if (!pc || !sdp) return;
    await pc.setRemoteDescription(sdp);
    const resolve = this.#pendingAnswer.get(hostId);
    if (resolve) {
      this.#pendingAnswer.delete(hostId);
      resolve();
    }
  }

  async handleIceCandidate(hostId, candidate) {
    const pc = this.#pcs.get(hostId);
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      console.warn(`[HostMonitor] addIceCandidate failed (${hostId}):`, err.message);
    }
  }

  async stopAll() {
    for (const hostId of [...this.#pcs.keys()]) {
      await this.removeHost(hostId);
    }
  }
}

export const hostMonitor = new HostMonitorChannel();