import { spawn }       from 'node:child_process';
import { EventEmitter } from 'node:events';
import { STREAM_MODE, FFMPEG_PATH, PUBLIC_SERVER_URL } from '../config/env.js';
import { LIVE_HOSTS_ROOM } from '../session/session.js';
import { entryId } from '../engine/radioUtils.js';
import { HostAudioMixer } from './audioMixer.js';
import { hostMonitor } from './hostMonitor.js';
import { PHRASES_MIN_TIME_S, PHRASES_MAX_TIME_S, PHRASES_DEFAULT_TIME_S } from '../engine/radioSettings.js';

const RECONNECT_DELAY_MS     = 200;
const FFMPEG_BINARY          = FFMPEG_PATH;

const MAX_CLIENT_BACKLOG_BYTES = 500_000;

const WATCHDOG_GRACE_MS      = 30_000;
const FALLBACK_DURATION_S    = 600;
const DURATION_LIMIT_BUFFER_S = 5;

const JINGLES_MIN_REQUIRED       = 3;
const JINGLE_FALLBACK_DURATION_S = 30;
const JINGLE_WATCHDOG_GRACE_MS   = 15_000;

const PCM_SAMPLE_RATE = 44100;
const PCM_CHANNELS    = 2;
const PCM_FORMAT      = 's16le';
const ENCODER_RESPAWN_DELAY_MS = 500;
const HOST_MIC_HIGHPASS_HZ = 90;

const ICY_METAINT = 16000;
const ICY_TITLE_MAX_CHARS = 250;
const ICY_BITRATE_KBPS = 192;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function checkFfmpeg() {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BINARY, ['-version'], { stdio: 'ignore' });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

// ── RadioStream ───────────────────────────────────────────────────────────────
class RadioStream extends EventEmitter {
  #radioEngine    = null;
  #mediaProvider  = null;
  #encoderProc    = null;
  #audioMixer     = null; 
  #hostMicDecoders = new Map();
  #decoderProc    = null; 
  #clients        = new Map();
  #currentTrackId = null;
  #running        = false;
  #initialized    = false;
  #io             = null;
  #trackStartedAt = null;
  #engineAdvanced = false;
  #playLock       = false;
  #scheduleTimer  = null;

  #skipRequestedFor = null;
  #streamingTrackId = null;
  #icyTitle         = '';

  #prefetchedTrackId = null;
  #prefetchedBuffer  = null;

  #pendingTransition = false;
  get isTransitioning() { return this.#pendingTransition; }

  // ── Jingles state ────────────────────────────────────────────────────────
  #songsSinceJingle = 0;
  #jingleThreshold  = null; 
  #lastJingleId     = null; 
  #jinglePlaying    = false; 

  get isJinglePlaying() { return this.#jinglePlaying; }

  // ── Phrases state ────────────────────────────────────────────────────────
  #phraseTimer       = null;
  #phraseDecoderProc = null;

  // ── Radio-hosts: queue pause ─────────────────────────────
  #queuePaused = false;
  #queueIdling = false;
  #idlingOwesTrackEnd = false;

  get isQueuePaused() { return this.#queuePaused; }
  get isQueueIdling() { return this.#queueIdling; }

  #backgroundMusicId         = null;
  #lastBackgroundMusicId     = null;
  #selectedBackgroundMusicId = null;

  get backgroundMusicId() { return this.#backgroundMusicId; }
  get selectedBackgroundMusicId() { return this.#selectedBackgroundMusicId; }

  // ── Init ────────────────────────────────────────────────────────────────────
  async init({ radioEngine, mediaProvider, io = null }) {
    if (!STREAM_MODE) return;

    const ok = await checkFfmpeg();
    if (!ok) {
      console.error('[Stream] FFmpeg not found. Set FFMPEG_PATH in .env or install ffmpeg.');
      return;
    }

    this.#radioEngine   = radioEngine;
    this.#mediaProvider = mediaProvider;
    this.#io            = io;
    this.#running       = true;
    this.#initialized   = true;
    this.#trackStartedAt = null;

    radioEngine.setRadioStream?.(this);

    this.#audioMixer = new HostAudioMixer();

    this.#startEncoder();
    console.log('[Stream] Radio stream initialized');
    this.#scheduleNextTrack();
  }

  get isInitialized() { return this.#initialized; }

  // ── Persistent encoder ───────────────────────────────────────────────────────
  #startEncoder() {
    const args = [
      '-loglevel', 'error',
      '-f',  PCM_FORMAT,
      '-ar', String(PCM_SAMPLE_RATE),
      '-ac', String(PCM_CHANNELS),
      '-i',  'pipe:0',
      '-acodec', 'libmp3lame',
      '-ab', '192k',
      '-write_xing', '0',
      '-id3v2_version', '0',
      '-f', 'mp3',
      'pipe:1',
    ];

    const proc = spawn(FFMPEG_BINARY, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.#encoderProc = proc;

    proc.stdout.on('data', (chunk) => this.#broadcast(chunk));

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[FFmpeg:encoder] ${msg}`);
    });

    proc.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') console.warn('[Stream] Encoder stdin error:', err.message);
    });

    proc.on('close', (code) => {
      if (this.#encoderProc !== proc) return; 
      console.warn(`[Stream] Encoder exited unexpectedly (code ${code}) - respawning`);
      this.#encoderProc = null;
      if (this.#running) {
        setTimeout(() => { if (this.#running && !this.#encoderProc) this.#startEncoder(); }, ENCODER_RESPAWN_DELAY_MS);
      }
    });

    proc.on('error', (err) => {
      console.error('[Stream] Encoder spawn error:', err.message);
      if (this.#encoderProc === proc) this.#encoderProc = null;
    });
  }

  // ── Client management ────────────────────────────────────────────────────────
  pipeToResponse(res, { icy = false } = {}) {
    if (!this.#initialized) {
      res.end();
      return () => {};
    }

    // Real Icecast/Shoutcast servers stream raw, unbounded bytes closed out
    // by connection-close - no Transfer-Encoding framing at all. Players'
    // ICY byte-counting reads the raw body, so HTTP chunk framing bytes
    // (which Node inserts by default for any unbounded HTTP/1.1 response)
    // land inside that count and throw off the icy-metaint offset.
    res.useChunkedEncodingByDefault = false;
    res.setHeader('Server', 'Icecast 2.4.4');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'close');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.setHeader('icy-name', this.#icyStationName());
    res.setHeader('icy-genre', 'Various');
    res.setHeader('icy-br', String(ICY_BITRATE_KBPS));
    res.setHeader('icy-pub', '0');
    if (PUBLIC_SERVER_URL) res.setHeader('icy-url', PUBLIC_SERVER_URL);
    if (icy) {
      res.setHeader('icy-metaint', String(ICY_METAINT));
    }

    res.flushHeaders();

    const client = { pending: 0, icyEnabled: icy, icyBytesSinceMeta: 0 };
    this.#clients.set(res, client);

    const onDrain = () => { client.pending = 0; };
    res.on('drain', onDrain);

    console.log(`[Stream] Client connected. Total: ${this.#clients.size}`);

    const cleanup = () => {
      res.off('drain', onDrain);
      this.#clients.delete(res);
      console.log(`[Stream] Client disconnected. Total: ${this.#clients.size}`);
    };

    res.on('close',  cleanup);
    res.on('error',  cleanup);
    res.on('finish', cleanup);

    return cleanup;
  }

  #writeToEncoder(chunk) {
    const encoder = this.#encoderProc;
    if (!encoder || encoder.stdin.destroyed) return;
    try { encoder.stdin.write(chunk); } catch (err) {
      if (err.code !== 'EPIPE') console.warn('[Stream] Encoder write failed:', err.message);
    }
  }

  #broadcast(chunk) {
    for (const [res, client] of this.#clients) {
      if (res.destroyed || res.writableEnded) {
        this.#clients.delete(res);
        continue;
      }

      if (client.icyEnabled) {
        this.#writeIcyChunk(res, client, chunk);
      } else {
        this.#writeChunkToClient(res, client, chunk);
      }
    }
  }

  #writeChunkToClient(res, client, chunk) {
    let ok;
    try {
      ok = res.write(chunk);
    } catch (err) {
      console.warn('[Stream] Write failed for client, dropping:', err.message);
      this.#clients.delete(res);
      return false;
    }

    if (!ok) {
      client.pending += chunk.length;
      if (client.pending > MAX_CLIENT_BACKLOG_BYTES) {
        console.warn('[Stream] Client backlog exceeded limit, disconnecting slow client');
        try { res.end(); } catch { }
        this.#clients.delete(res);
        return false;
      }
    }
    return true;
  }

  // ── ICY metadata ─────────────────────────────────────────────────────────────
  #icyStationName() {
    const byLang = this.#radioEngine?.settings?.branding?.byLang?.en;
    const name = this.#radioEngine?.currentMode === 'night' ? byLang?.nightRadioName : byLang?.dayRadioName;
    const ascii = String(name || '').replace(/[^\x20-\x7e]/g, '').trim();
    return ascii || 'Radio';
  }

  #buildIcyMetaBlock() {
    const title  = this.#icyTitle.slice(0, ICY_TITLE_MAX_CHARS).replace(/';/g, '’;');
    const text   = title ? `StreamTitle='${title}';` : '';
    const body   = Buffer.from(text, 'utf8');
    const blocks = Math.min(255, Math.ceil(body.length / 16));

    const out = Buffer.alloc(1 + blocks * 16);
    out[0] = blocks;
    body.copy(out, 1);
    return out;
  }

  #writeIcyChunk(res, client, chunk) {
    let offset = 0;
    while (offset < chunk.length) {
      const sliceLen = Math.min(ICY_METAINT - client.icyBytesSinceMeta, chunk.length - offset);
      const slice    = chunk.subarray(offset, offset + sliceLen);

      if (!this.#writeChunkToClient(res, client, slice)) return;

      offset += sliceLen;
      client.icyBytesSinceMeta += sliceLen;

      if (client.icyBytesSinceMeta >= ICY_METAINT) {
        if (!this.#writeChunkToClient(res, client, this.#buildIcyMetaBlock())) return;
        client.icyBytesSinceMeta = 0;
      }
    }
  }

  // ── Track scheduling ─────────────────────────────────────────────────────────
  #scheduleNextTrack(delayMs = 0) {
    if (!this.#running) return;
    if (this.#scheduleTimer) clearTimeout(this.#scheduleTimer);
    this.#scheduleTimer = setTimeout(() => {
      this.#scheduleTimer = null;
      this.#playCurrentTrack();
    }, delayMs);
  }

  async #playCurrentTrack() {
    if (!this.#running || this.#playLock) return;
    this.#playLock = true;

    const trackId = this.#radioEngine.currentTrack;
    if (!trackId) {
      this.#playLock = false;
      this.#scheduleNextTrack(500);
      return;
    }

    this.#streamingTrackId = trackId;
    const startedAt = Date.now();

    this.#currentTrackId = trackId;
    this.#trackStartedAt = null;
    const meta = this.#radioEngine.getTrackMetadata(trackId);
    console.log(`[Stream] Starting track: ${trackId} "${meta?.title || ''}"`);

    try {
      const source = await this.#resolveAudioSource(trackId);

      if (this.#skipRequestedFor === trackId) {
        this.#skipRequestedFor = null;
        this.#playLock = false;
        this.#scheduleNextTrack(0);
        return;
      }

      if (!source) {
        console.error(`[Stream] Cannot resolve audio source for ${trackId}`);
        this.#radioEngine.nextTrack(true);
        this.#playLock = false;
        this.#scheduleNextTrack(RECONNECT_DELAY_MS);
        return;
      }

      await this.#streamTrack(source, trackId, meta);
    } catch (err) {
      console.error(`[Stream] Track error (${trackId}):`, err.message);
    }

    this.#stopPhraseOverlay();

    const alreadyAdvanced = this.#engineAdvanced;
    this.#engineAdvanced = false;

    if (alreadyAdvanced) {
      const prevMode      = this.#deriveMode(trackId);
      const nextTrackNow  = this.#radioEngine.currentTrack;
      const modeChangedBySkip = nextTrackNow ? this.#deriveMode(nextTrackNow) !== prevMode : false;

      if (modeChangedBySkip) {
        this.#songsSinceJingle = 0;
        this.#jingleThreshold  = null;
      } else if (!this.#queuePaused) {
        await this.#maybeInsertJingle(prevMode);
      }

      this.#playLock = false;

      if (this.#queuePaused) {
        this.#queueIdling = true;
        console.log('[Stream] Skipped while paused - holding, not advancing to next track');
        if (this.#io) {
          this.#io.emit('stream_chat_mode_start', { serverTs: Date.now() });
          this.#io.emit('sync', this.#radioEngine.getState());
        }
        this.#runBackgroundMusicLoop().catch((err) => {
          console.error('[Stream] Background music loop error:', err.message);
        });
        return;
      }

      this.#scheduleNextTrack(RECONNECT_DELAY_MS);
      return;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < 5000) {
      console.warn(`[Stream] Track ended too quickly (${elapsed}ms) - advancing anyway`);
      this.#radioEngine.onTrackEnd(true);
      this.#playLock = false;
      this.#scheduleNextTrack(2000);
      return;
    }

    if (this.#willModeSwitchOnNextAdvance()) {
      this.#songsSinceJingle = 0;
      this.#jingleThreshold  = null;
    } else {
      await this.#maybeInsertJingle(this.#deriveMode(trackId));
    }

    this.#playLock = false;

    if (this.#queuePaused) {
      this.#queueIdling = true;
      this.#idlingOwesTrackEnd = true;
      console.log('[Stream] Queue paused - holding at end of track, not advancing');
      if (this.#io) {
        this.#io.emit('stream_chat_mode_start', { serverTs: Date.now() });
        this.#io.emit('sync', this.#radioEngine.getState()); 
      }
      this.#runBackgroundMusicLoop().catch((err) => {
        console.error('[Stream] Background music loop error:', err.message);
      });
      return;
    }

    this.#radioEngine.onTrackEnd();
    this.#scheduleNextTrack(RECONNECT_DELAY_MS);
  }

  // ── Jingles ──────────────────────────────────────────────────────────────────
  #deriveMode(trackId) {
    return String(trackId).startsWith('night/') ? 'night' : 'day';
  }

  #willModeSwitchOnNextAdvance() {
    const engine = this.#radioEngine;
    try {
      const pending = engine.pendingModeSwitch;
      if (pending) {
        const wouldExecuteNow = !pending.executeAtMs || Date.now() >= pending.executeAtMs;
        if (wouldExecuteNow && engine.currentMode !== pending.targetMode) return true;
      }
      return engine.getDesiredMode() !== engine.currentMode;
    } catch {
      return false;
    }
  }

  async #maybeInsertJingle(mode) {
    try {
      const settings = this.#radioEngine.settings?.generation || {};
      if (!settings.JINGLES_ENABLED) return;

      const usable = await this.#radioEngine.dataProvider.getUsableJingles(mode);
      if (usable.length < JINGLES_MIN_REQUIRED) return;

      if (this.#jingleThreshold == null) {
        this.#jingleThreshold = settings.JINGLES_RANDOM
          ? 1 + Math.floor(Math.random() * 3)
          : Math.min(5, Math.max(1, Number(settings.JINGLES_FREQUENCY) || 2));
      }

      this.#songsSinceJingle++;
      if (this.#songsSinceJingle < this.#jingleThreshold) return;

      let candidates = usable;
      if (usable.length > 1 && this.#lastJingleId) {
        const withoutLast = usable.filter((j) => j.id !== this.#lastJingleId);
        if (withoutLast.length) candidates = withoutLast;
      }
      const jingle = candidates[Math.floor(Math.random() * candidates.length)];

      console.log(`[Stream] Inserting jingle: ${jingle.filename} (${mode})`);
      await this.#streamJingle(jingle);

      this.#lastJingleId    = jingle.id;
      this.#songsSinceJingle = 0;
      this.#jingleThreshold  = null;
    } catch (err) {
      console.error('[Stream] Jingle insertion error:', err.message);
    }
  }

  async #streamJingle(jingle) {
    if (!this.#running) return;

    let source;
    try {
      source = await this.#resolveLibrarySource(
        () => this.#mediaProvider.getJingleFilePath(jingle.mode, jingle.filename),
        () => this.#mediaProvider.getJingleUrl(jingle.mode, jingle.filename),
      );
    } catch (err) {
      console.error(`[Stream] Failed to fetch jingle ${jingle.filename}:`, err.message);
      return;
    }
    if (!source) return;

    const durationS = jingle.duration || JINGLE_FALLBACK_DURATION_S;
    this.#jinglePlaying = true;

    await this.#decodeIntoEncoder(source, {
      watchdogMs: durationS * 1000 + JINGLE_WATCHDOG_GRACE_MS,
      maxDurationS: durationS,
      label: `jingle "${jingle.filename}"`,
      onFirstChunk: () => {
        if (this.#io) {
          this.#io.emit('stream_jingle_start', { jingleId: jingle.id, serverTs: Date.now() });
        }
      },
    });

    this.#jinglePlaying = false;
    if (this.#io) {
      this.#io.emit('stream_jingle_end', { serverTs: Date.now() });
    }
  }

  // ── Library source resolution ─────────────────────────────────────────────
  async #resolveLibrarySource(getPath, getUrl) {
    if (typeof getPath === 'function' && !this.#mediaProvider?.isCloud) {
      return { type: 'file', value: getPath() };
    }
    const buffer = await this.#downloadUrlToBuffer(await getUrl());
    return buffer ? { type: 'buffer', value: buffer } : null;
  }

  async #downloadUrlToBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch responded ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  // ── Look-ahead: start fetching the next track while the current one plays ──
  #peekNextTrackId() {
    const playlist = this.#radioEngine?.playlist;
    if (!playlist?.length) return null;
    const idx = (this.#radioEngine.currentIndex + 1) % playlist.length;
    return entryId(playlist[idx]);
  }

  #schedulePrefetch() {
    if (!this.#mediaProvider?.isCloud) return;

    const nextId = this.#peekNextTrackId();
    if (!nextId || nextId === this.#prefetchedTrackId) return;

    this.#prefetchedTrackId = nextId;
    this.#prefetchedBuffer  = (async () => {
      try {
        const url = await this.#mediaProvider.getAudioUrl(nextId);
        return await this.#downloadUrlToBuffer(url);
      } catch (err) {
        console.warn(`[Stream] Prefetch failed for ${nextId}:`, err.message);
        return null;
      }
    })();
  }

  // ── Audio source resolution ───────────────────────────────────────────────────
  async #resolveAudioSource(trackId) {
    const isCloud = this.#mediaProvider?.isCloud;

    if (isCloud) {
      if (this.#prefetchedTrackId === trackId) {
        const buffer = await this.#prefetchedBuffer;
        this.#prefetchedTrackId = null;
        this.#prefetchedBuffer  = null;
        if (buffer) return { type: 'buffer', value: buffer };
      }

      try {
        const url = await this.#mediaProvider.getAudioUrl(trackId);
        const buffer = await this.#downloadUrlToBuffer(url);
        return { type: 'buffer', value: buffer };
      } catch (err) {
        console.error(`[Stream] Failed to fetch audio for ${trackId}:`, err.message);
        return null;
      }
    }

    try {
      return { type: 'file', value: this.#mediaProvider.getAudioFilePath(trackId) };
    } catch (err) {
      console.error(`[Stream] Cannot resolve local path for ${trackId}:`, err.message);
      return null;
    }
  }

  // ── Decoding into the shared encoder ──────────────────────────────────────────
  #decodeIntoEncoder(source, { onFirstChunk, watchdogMs, maxDurationS, label }) {
    return new Promise((resolve) => {
      if (!this.#running) return resolve();

      const isBuffer = source.type === 'buffer';

      const args = [
        '-loglevel', 'error',
        '-re',
        '-i', isBuffer ? 'pipe:0' : source.value,
        '-vn',
        ...(maxDurationS ? ['-t', String(maxDurationS + DURATION_LIMIT_BUFFER_S)] : []),
        '-f',  PCM_FORMAT,
        '-ar', String(PCM_SAMPLE_RATE),
        '-ac', String(PCM_CHANNELS),
        'pipe:1',
      ];

      const proc = spawn(FFMPEG_BINARY, args, { stdio: [isBuffer ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
      this.#decoderProc = proc;
      let firstChunk = true;
      let settled = false;

      if (isBuffer) {
        proc.stdin.on('error', (err) => {
          if (err.code !== 'EPIPE') console.warn(`[Stream] Decoder stdin error (${label}):`, err.message);
        });
        proc.stdin.end(source.value);
      }

      const watchdog = watchdogMs ? setTimeout(() => {
        console.warn(`[Stream] Watchdog: ${label} exceeded expected duration - force killing decoder`);
        proc.kill('SIGKILL');
      }, watchdogMs) : null;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (watchdog) clearTimeout(watchdog);
        resolve();
      };

      proc.stdout.on('data', (chunk) => {
        if (firstChunk) {
          firstChunk = false;
          onFirstChunk?.();
        }
        const mixed = this.#audioMixer ? this.#audioMixer.mixMusicChunk(chunk) : chunk;
        if (this.#audioMixer) hostMonitor.pushRadioMusicPcm(this.#audioMixer.duckMusic(chunk));
        const encoder = this.#encoderProc;
        if (encoder && !encoder.stdin.destroyed) {
          const ok = encoder.stdin.write(mixed);
          if (!ok) proc.stdout.pause();
        }
      });

      const onEncoderDrain = () => proc.stdout.resume();
      this.#encoderProc?.stdin.on('drain', onEncoderDrain);

      proc.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.error(`[FFmpeg:decoder] ${msg}`);
      });

      proc.on('close', (code) => {
        if (this.#decoderProc === proc) this.#decoderProc = null;
        this.#encoderProc?.stdin.off('drain', onEncoderDrain);
        if (code !== 0 && code !== null) {
          console.warn(`[Stream] Decoder exited with code ${code} for ${label}`);
        }
        finish();
      });

      proc.on('error', (err) => {
        console.error(`[Stream] Decoder spawn error (${label}):`, err.message);
        if (this.#decoderProc === proc) this.#decoderProc = null;
        this.#encoderProc?.stdin.off('drain', onEncoderDrain);
        finish();
      });
    });
  }

  #streamTrack(source, trackId, meta) {
    const durationS = meta?.duration || this.#radioEngine.getTrackMetadata(trackId)?.duration || FALLBACK_DURATION_S;

    this.#stopPhraseOverlay();

    return this.#decodeIntoEncoder(source, {
      watchdogMs: durationS * 1000 + WATCHDOG_GRACE_MS,
      maxDurationS: durationS,
      label: trackId,
      onFirstChunk: () => {
        this.#trackStartedAt = Date.now();
        this.#pendingTransition = false;
        this.#radioEngine.syncPlaybackClock(this.#trackStartedAt);
        this.#schedulePrefetch();
        const trackMeta = this.#radioEngine.getTrackMetadata(trackId);
        this.#icyTitle = trackMeta?.artist && trackMeta?.title ? `${trackMeta.artist} - ${trackMeta.title}` : (trackMeta?.title || '');
        this.emit('trackStarted', trackId);
        this.#maybeSchedulePhrase(trackId, durationS);
        if (this.#io) {
          const duration = this.#radioEngine.getTrackMetadata(trackId)?.duration
                        ?? meta?.duration
                        ?? 0;
          this.#io.emit('stream_track_start', {
            duration,
            trackId : trackId,
            serverTs: this.#trackStartedAt,
          });
        }
      },
    });
  }

  // ── Phrases: overlay mixed near the end of the current song ────────────────
  #maybeSchedulePhrase(trackId, durationS) {
    const settings = this.#radioEngine.settings?.generation || {};
    if (!settings.PHRASES_ENABLED) return;

    const mode = this.#deriveMode(trackId);
    const offsetS = settings.PHRASES_DEFAULT_TIME
      ? PHRASES_DEFAULT_TIME_S
      : Math.min(PHRASES_MAX_TIME_S, Math.max(PHRASES_MIN_TIME_S, Number(settings.PHRASES_TIME_SECONDS) || PHRASES_DEFAULT_TIME_S));

    if (durationS <= offsetS) return;

    const delayMs = Math.max(0, (durationS - offsetS) * 1000);
    this.#phraseTimer = setTimeout(() => {
      this.#phraseTimer = null;
      this.#firePhrase(mode).catch((err) => console.error('[Stream] Phrase overlay error:', err.message));
    }, delayMs);
  }

  async #pickPhrase(mode) {
    const settings = this.#radioEngine.settings?.generation || {};

    if (settings.PHRASES_RANDOM) {
      const usable = await this.#radioEngine.dataProvider.getUsablePhrases(mode);
      if (!usable.length) return null;
      return usable[Math.floor(Math.random() * usable.length)];
    }

    const fixedId = mode === 'night' ? settings.PHRASES_NIGHT_ID : settings.PHRASES_DAY_ID;
    if (!fixedId) return null;

    const phrase = await this.#radioEngine.dataProvider.getPhraseById(fixedId);
    return (phrase && phrase.mode === mode && phrase.used) ? phrase : null;
  }

  async #firePhrase(mode) {
    const phrase = await this.#pickPhrase(mode);
    if (!phrase) return;

    let source;
    try {
      source = await this.#resolveLibrarySource(
        () => this.#mediaProvider.getPhraseFilePath(phrase.mode, phrase.filename),
        () => this.#mediaProvider.getPhraseUrl(phrase.mode, phrase.filename),
      );
    } catch (err) {
      console.error(`[Stream] Failed to fetch phrase ${phrase.filename}:`, err.message);
      return;
    }
    if (!source || !this.#running) return;

    console.log(`[Stream] Mixing phrase: ${phrase.filename} (${mode})`);
    this.#playPhraseOverlay(source);
  }

  #playPhraseOverlay(source) {
    const isBuffer = source.type === 'buffer';

    const args = [
      '-loglevel', 'error',
      '-re',
      '-i', isBuffer ? 'pipe:0' : source.value,
      '-vn',
      '-f',  PCM_FORMAT,
      '-ar', String(PCM_SAMPLE_RATE),
      '-ac', String(PCM_CHANNELS),
      'pipe:1',
    ];

    const proc = spawn(FFMPEG_BINARY, args, { stdio: [isBuffer ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    this.#phraseDecoderProc = proc;

    if (isBuffer) {
      proc.stdin.on('error', (err) => {
        if (err.code !== 'EPIPE') console.warn('[Stream] Phrase decoder stdin error:', err.message);
      });
      proc.stdin.end(source.value);
    }

    proc.stdout.on('data', (chunk) => this.#audioMixer?.pushPhrase(chunk));

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[FFmpeg:phrase] ${msg}`);
    });

    proc.on('close', (code) => {
      if (this.#phraseDecoderProc === proc) this.#phraseDecoderProc = null;
      if (code !== 0 && code !== null) {
        console.warn(`[Stream] Phrase decoder exited with code ${code}`);
      }
    });

    proc.on('error', (err) => {
      console.error('[Stream] Phrase decoder spawn error:', err.message);
      if (this.#phraseDecoderProc === proc) this.#phraseDecoderProc = null;
    });
  }

  #stopPhraseOverlay() {
    if (this.#phraseTimer) {
      clearTimeout(this.#phraseTimer);
      this.#phraseTimer = null;
    }
    if (this.#phraseDecoderProc) {
      try { this.#phraseDecoderProc.kill('SIGTERM'); } catch { }
      this.#phraseDecoderProc = null;
    }
    this.#audioMixer?.clearPhrase();
  }

  // ── Radio-hosts: queue pause / resume ──────────────────────────────────────
  pauseQueue() {
    if (this.#queuePaused) return;
    this.#queuePaused = true;
    this.#io?.to(LIVE_HOSTS_ROOM).emit('host_queue_pause_state', { paused: true });
  }

  resumeQueue() {
    if (!this.#queuePaused) return;
    this.#queuePaused = false;
    this.#io?.to(LIVE_HOSTS_ROOM).emit('host_queue_pause_state', { paused: false });
    if (this.#io) this.#io.emit('stream_chat_mode_end', { serverTs: Date.now() });
    if (this.#queueIdling) {
      this.#queueIdling = false;
      this.#audioMixer?.stopPauseClock();
      this.#stopBackgroundMusic();
      if (this.#idlingOwesTrackEnd) this.#radioEngine.onTrackEnd();
      this.#idlingOwesTrackEnd = false;
      if (this.#io) this.#io.emit('sync', this.#radioEngine.getState());
      this.#scheduleNextTrack(0);
    }
  }

  // ── Radio-hosts: background music (fills the pause left by pauseQueue()) ───
  async #runBackgroundMusicLoop() {
    while (this.#queueIdling && this.#running) {
      const mode  = this.#radioEngine.currentMode === 'night' ? 'night' : 'day';
      const track = await this.#pickBackgroundMusicTrack(mode);
      if (!track) break;

      this.#backgroundMusicId = track.id;
      this.#io?.to(LIVE_HOSTS_ROOM).emit('background_music_now_playing', {
        trackId: track.id,
        filename: track.filename,
      });

      let source;
      try {
        source = await this.#resolveLibrarySource(
          () => this.#mediaProvider.getBackgroundMusicFilePath(track.mode, track.filename),
          () => this.#mediaProvider.getBackgroundMusicUrl(track.mode, track.filename),
        );
      } catch (err) {
        console.error(`[Stream] Failed to fetch background music "${track.filename}":`, err.message);
        break;
      }
      if (!source) break;

      const durationS = track.duration || FALLBACK_DURATION_S;
      await this.#decodeIntoEncoder(source, {
        watchdogMs: durationS * 1000 + WATCHDOG_GRACE_MS,
        maxDurationS: durationS,
        label: `background music "${track.filename}"`,
      });
    }

    this.#backgroundMusicId = null;
    if (this.#queueIdling && this.#running) {
      this.#audioMixer?.startPauseClock((chunk) => this.#writeToEncoder(chunk));
    }
    this.#io?.to(LIVE_HOSTS_ROOM).emit('background_music_now_playing', { trackId: null, filename: null });
  }

  #stopBackgroundMusic() {
    if (this.#backgroundMusicId) {
      this.#io?.to(LIVE_HOSTS_ROOM).emit('background_music_now_playing', { trackId: null, filename: null });
    }
    this.#backgroundMusicId = null;
    if (this.#decoderProc) {
      try { this.#decoderProc.kill('SIGTERM'); } catch { }
    }
  }

  async #pickBackgroundMusicTrack(mode) {
    try {
      const radioHosts = this.#radioEngine.settings?.radioHosts || {};
      if (radioHosts.backgroundMusicMode === 'hostChoice') {
        if (!this.#selectedBackgroundMusicId) return null;
        const track = await this.#radioEngine.dataProvider.getBackgroundMusicById(this.#selectedBackgroundMusicId);
        return (track && track.mode === mode && track.used) ? track : null;
      }

      const usable = await this.#radioEngine.dataProvider.getUsableBackgroundMusic(mode);
      if (!usable.length) return null;

      let candidates = usable;
      if (usable.length > 1 && this.#lastBackgroundMusicId) {
        const withoutLast = usable.filter((t) => t.id !== this.#lastBackgroundMusicId);
        if (withoutLast.length) candidates = withoutLast;
      }
      const track = candidates[Math.floor(Math.random() * candidates.length)];
      this.#lastBackgroundMusicId = track.id;
      return track;
    } catch (err) {
      console.error('[Stream] Failed to pick a background music track:', err.message);
      return null;
    }
  }

  setSelectedBackgroundMusicId(id) {
    const next = id || null;
    if (this.#selectedBackgroundMusicId === next) return;
    this.#selectedBackgroundMusicId = next;
    this.#io?.to(LIVE_HOSTS_ROOM).emit('background_music_selection_changed', { trackId: next });

    if (this.#queueIdling) {
      const radioHosts = this.#radioEngine?.settings?.radioHosts || {};
      if (radioHosts.backgroundMusicMode === 'hostChoice') {
        if (this.#decoderProc) {
          try { this.#decoderProc.kill('SIGTERM'); } catch { }
        } else if (next && this.#audioMixer?.isPauseClockActive) {
          this.#audioMixer.stopPauseClock();
          this.#runBackgroundMusicLoop().catch((err) => {
            console.error('[Stream] Background music loop error:', err.message);
          });
        }
      }
    }
  }

  // ── Radio-hosts: auto-resume when the host room empties ────────
  forceResumeHostPauses() {
    if (this.#queuePaused) this.resumeQueue();
  }

  // ── Radio-hosts: mic ducking (multi-host) ──────────────────────
  isHostMicActive(hostId) {
    return this.#hostMicDecoders.has(hostId);
  }

  setHostMicActive(hostId, active) {
    const on = Boolean(active);
    this.#audioMixer?.setMicActive(hostId, on);
    if (on) {
      this.#startHostMicDecoder(hostId);
    } else {
      this.#stopHostMicDecoder(hostId);
    }
  }

  setHostMicGain(hostId, gain) {
    this.#audioMixer?.setMicGain(hostId, gain);
    hostMonitor.setMicGain(hostId, gain);
  }

  setParticipantMuted(hostId, muted) {
    this.#audioMixer?.setMuted(hostId, muted);
    hostMonitor.setMuted(hostId, muted);
  }

  isParticipantMuted(hostId) {
    return Boolean(this.#audioMixer?.isMuted(hostId));
  }

  removeHostMic(hostId) {
    this.#stopHostMicDecoder(hostId);
    this.#audioMixer?.removeHost(hostId);
  }

  #startHostMicDecoder(hostId) {
    if (this.#hostMicDecoders.has(hostId)) return;

    const args = [
      '-loglevel', 'error',
      '-f', 'webm',
      '-i', 'pipe:0',
      '-vn',
      '-af', `highpass=f=${HOST_MIC_HIGHPASS_HZ}`,
      '-f',  PCM_FORMAT,
      '-ar', String(PCM_SAMPLE_RATE),
      '-ac', String(PCM_CHANNELS),
      'pipe:1',
    ];

    const proc = spawn(FFMPEG_BINARY, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.#hostMicDecoders.set(hostId, proc);

    proc.stdout.on('data', (chunk) => {
      this.#audioMixer?.pushMic(hostId, chunk);
      hostMonitor.pushMicPcm(hostId, chunk);
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[FFmpeg:host-mic:${hostId}] ${msg}`);
    });

    proc.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') console.warn(`[Stream] Host-mic decoder stdin error (${hostId}):`, err.message);
    });

    proc.on('close', (code) => {
      if (this.#hostMicDecoders.get(hostId) === proc) this.#hostMicDecoders.delete(hostId);
      if (code !== 0 && code !== null) {
        console.warn(`[Stream] Host-mic decoder exited with code ${code} (${hostId})`);
      }
    });

    proc.on('error', (err) => {
      console.error(`[Stream] Host-mic decoder spawn error (${hostId}):`, err.message);
      if (this.#hostMicDecoders.get(hostId) === proc) this.#hostMicDecoders.delete(hostId);
    });
  }

  #stopHostMicDecoder(hostId) {
    const proc = this.#hostMicDecoders.get(hostId);
    if (!proc) return;
    try { proc.stdin.end(); } catch { }
    try { proc.kill('SIGTERM'); } catch { }
    this.#hostMicDecoders.delete(hostId);
  }

  pushHostAudioChunk(hostId, chunk) {
    const proc = this.#hostMicDecoders.get(hostId);
    if (!proc || proc.stdin.destroyed) return;
    try {
      proc.stdin.write(chunk);
    } catch (err) {
      if (err.code !== 'EPIPE') console.warn(`[Stream] Failed writing host mic chunk (${hostId}):`, err.message);
    }
  }

  // ── Skip ─────────────────────────────────────────────────────────────────────
  skipCurrentTrack() {
    if (this.#jinglePlaying) {
      console.log('[Stream] Skip ignored - a jingle is currently playing');
      return;
    }

    if (this.#queueIdling) {
      console.log('[Stream] Skip ignored - queue is paused and idling');
      return;
    }

    this.#engineAdvanced    = true;
    this.#pendingTransition = true;

    this.#stopPhraseOverlay();

    if (this.#decoderProc) {
      console.log('[Stream] Skipping current track');
      this.#decoderProc.kill('SIGTERM');
    } else {
      this.#skipRequestedFor = this.#streamingTrackId;
    }
  }

  // ── Teardown ─────────────────────────────────────────────────────────────────
  stop() {
    this.#running = false;
    if (this.#scheduleTimer) {
      clearTimeout(this.#scheduleTimer);
      this.#scheduleTimer = null;
    }
    this.#decoderProc?.kill('SIGTERM');
    this.#decoderProc = null;
    this.#stopPhraseOverlay();
    for (const hostId of this.#hostMicDecoders.keys()) this.#stopHostMicDecoder(hostId);
    this.#audioMixer?.reset();
    this.#audioMixer = null;
    if (this.#encoderProc) {
      try { this.#encoderProc.stdin.end(); } catch { }
      this.#encoderProc.kill('SIGTERM');
      this.#encoderProc = null;
    }
    this.#jinglePlaying = false;
    this.#pendingTransition = false;
    this.#queueIdling = false;
    this.#backgroundMusicId = null;
    this.#prefetchedTrackId = null;
    this.#prefetchedBuffer  = null;
    for (const [res] of this.#clients) {
      try { res.end(); } catch { }
    }
    this.#clients.clear();
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  get clientCount() { return this.#clients.size; }
  get currentTrackId() { return this.#currentTrackId; }

  get currentSeek() {
    if (!this.#trackStartedAt) return 0;
    return (Date.now() - this.#trackStartedAt) / 1000;
  }

  setIo(io) { this.#io = io; }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const radioStream = new RadioStream();