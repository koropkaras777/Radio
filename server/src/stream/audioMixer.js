import { DEFAULT_MIC_GAIN, clampMicGain, createMicLimiter, LIMITER_CEILING } from './micGain.js';

const DUCK_GAIN = 0.16;
const RAMP_MS   = 200;

// Phrases are never ducked, unlike the mic, so a mic-sized boost isn't enough
// to cut through a still-full-volume song - this needs its own, higher gain.
const PHRASE_GAIN = 9.0;

const SAMPLE_RATE = 44100;
const CHANNELS    = 2;
const BYTES_PER_SAMPLE = 2; // s16le
const MAX_QUEUE_BYTES  = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * 2;

const PAUSE_TICK_MS = 20;
const PAUSE_BYTES_PER_TICK = Math.floor((SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * PAUSE_TICK_MS) / 1000 / (CHANNELS * BYTES_PER_SAMPLE)) * (CHANNELS * BYTES_PER_SAMPLE);

const LIMITER_RANGE = 32767 - LIMITER_CEILING;

function softLimit(v) {
  if (v > LIMITER_CEILING) {
    return Math.round(LIMITER_CEILING + LIMITER_RANGE * Math.tanh((v - LIMITER_CEILING) / LIMITER_RANGE));
  }
  if (v < -LIMITER_CEILING) {
    return Math.round(-LIMITER_CEILING - LIMITER_RANGE * Math.tanh((-v - LIMITER_CEILING) / LIMITER_RANGE));
  }
  return v;
}

class ByteQueue {
  #chunks = [];
  #bytes  = 0;

  get bytes() { return this.#bytes; }

  push(chunk) {
    this.#chunks.push(chunk);
    this.#bytes += chunk.length;
    while (this.#bytes > MAX_QUEUE_BYTES && this.#chunks.length > 1) {
      this.#bytes -= this.#chunks.shift().length;
    }
  }

  clear() {
    this.#chunks = [];
    this.#bytes  = 0;
  }

  pull(bytes) {
    const out = Buffer.alloc(bytes);
    let filled = 0;
    while (filled < bytes && this.#chunks.length) {
      const head = this.#chunks[0];
      const need = bytes - filled;
      if (head.length <= need) {
        head.copy(out, filled);
        filled += head.length;
        this.#bytes -= head.length;
        this.#chunks.shift();
      } else {
        head.copy(out, filled, 0, need);
        this.#chunks[0] = head.subarray(need);
        this.#bytes -= need;
        filled += need;
      }
    }
    return out;
  }
}

// ── Per-host mic state ───────────────────────────────────────────────────────
class HostSlot {
  queue  = new ByteQueue();
  active = false;
  gain   = DEFAULT_MIC_GAIN;
  muted  = false;
}

export class HostAudioMixer {
  /** @type {Map<string, HostSlot>} keyed by hostId (socket.id) */
  #hosts       = new Map();
  #duck        = 1.0;
  #lastRampAt  = Date.now();
  #pauseTimer  = null;
  #micLimiter  = createMicLimiter(SAMPLE_RATE);
  #phraseQueue = new ByteQueue();

  #slot(hostId) {
    let s = this.#hosts.get(hostId);
    if (!s) {
      s = new HostSlot();
      this.#hosts.set(hostId, s);
    }
    return s;
  }

  pushMic(hostId, chunk) {
    this.#slot(hostId).queue.push(chunk);
  }

  setMicActive(hostId, active) {
    const s = this.#slot(hostId);
    s.active = Boolean(active);
    if (!s.active) s.queue.clear();
  }

  setMicGain(hostId, gain) {
    this.#slot(hostId).gain = clampMicGain(gain);
  }

  setMuted(hostId, muted) {
    this.#slot(hostId).muted = Boolean(muted);
  }

  isMuted(hostId) {
    return Boolean(this.#hosts.get(hostId)?.muted);
  }

  removeHost(hostId) {
    this.#hosts.delete(hostId);
  }

  // ── Phrase overlay (mixed on top of the song, never ducked) ─────────────
  pushPhrase(chunk) {
    this.#phraseQueue.push(chunk);
  }

  clearPhrase() {
    this.#phraseQueue.clear();
  }

  #anyMicActive() {
    for (const s of this.#hosts.values()) if (s.active && !s.muted) return true;
    return false;
  }

  #anyMicContent() {
    for (const s of this.#hosts.values()) if (!s.muted && (s.active || s.queue.bytes > 0)) return true;
    return false;
  }

  #sumMics(bytes) {
    const samples = bytes / 2;
    const acc = new Int32Array(samples);
    let any = false;
    for (const s of this.#hosts.values()) {
      if (s.muted) continue;
      if (!s.active && s.queue.bytes === 0) continue;
      const chunk = s.queue.pull(bytes);
      any = true;
      for (let i = 0, n = 0; i + 1 < bytes; i += 2, n++) {
        acc[n] += Math.round(chunk.readInt16LE(i) * s.gain);
      }
    }
    return { acc, any };
  }

  get isPauseClockActive() { return Boolean(this.#pauseTimer); }

  startPauseClock(onOutput) {
    if (this.#pauseTimer) return;
    this.#pauseTimer = setInterval(() => {
      if (!this.#anyMicContent()) {
        onOutput(Buffer.alloc(PAUSE_BYTES_PER_TICK));
        return;
      }
      const { acc } = this.#sumMics(PAUSE_BYTES_PER_TICK);
      const out = Buffer.alloc(PAUSE_BYTES_PER_TICK);
      for (let n = 0; n < acc.length; n++) out.writeInt16LE(this.#micLimiter.limit(acc[n]), n * 2);
      onOutput(out);
    }, PAUSE_TICK_MS);
    this.#pauseTimer.unref?.();
  }

  stopPauseClock() {
    if (this.#pauseTimer) {
      clearInterval(this.#pauseTimer);
      this.#pauseTimer = null;
    }
  }

  reset() {
    this.stopPauseClock();
    this.#hosts.clear();
    this.#duck       = 1.0;
    this.#lastRampAt = Date.now();
    this.#micLimiter.reset();
    this.#phraseQueue.clear();
  }

  mixMusicChunk(musicChunk) {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - this.#lastRampAt);
    this.#lastRampAt = now;

    const target = this.#anyMicActive() ? DUCK_GAIN : 1.0;
    if (this.#duck !== target) {
      const step = Math.min(1, elapsedMs / RAMP_MS);
      this.#duck += (target - this.#duck) * step;
    }

    const hasMicContent    = this.#anyMicContent();
    const hasPhraseContent = this.#phraseQueue.bytes > 0;

    if (!hasMicContent && !hasPhraseContent) {
      return this.#duck >= 0.999 ? musicChunk : this.#scale(musicChunk, this.#duck);
    }

    let acc = hasMicContent ? this.#sumMics(musicChunk.length).acc : new Int32Array(musicChunk.length / 2);

    if (hasPhraseContent) {
      const phraseChunk = this.#phraseQueue.pull(musicChunk.length);
      for (let i = 0, n = 0; i + 1 < musicChunk.length; i += 2, n++) {
        acc[n] += Math.round(phraseChunk.readInt16LE(i) * PHRASE_GAIN);
      }
    }

    return this.#mix(musicChunk, acc, this.#duck);
  }

  duckMusic(musicChunk) {
    return this.#duck >= 0.999 ? musicChunk : this.#scale(musicChunk, this.#duck);
  }

  #scale(buffer, gain) {
    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i + 1 < buffer.length; i += 2) {
      out.writeInt16LE(softLimit(Math.round(buffer.readInt16LE(i) * gain)), i);
    }
    return out;
  }

  #mix(musicBuf, micAcc, musicGain) {
    const out = Buffer.alloc(musicBuf.length);
    for (let i = 0, n = 0; i + 1 < out.length; i += 2, n++) {
      const m = musicBuf.readInt16LE(i) * musicGain;
      const v = micAcc[n];
      out.writeInt16LE(this.#micLimiter.limit(m + v), i);
    }
    return out;
  }
}