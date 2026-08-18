export const DEFAULT_MIC_GAIN = 5.0;
export const MIN_MIC_GAIN     = 2.0;
export const MAX_MIC_GAIN     = 7.0;

export const LIMITER_CEILING = 26000;

const LIMITER_ATTACK_MS  = 5;
const LIMITER_RELEASE_MS = 120;

export function clampMicGain(gain) {
  const n = Number(gain);
  return Number.isFinite(n) ? Math.min(MAX_MIC_GAIN, Math.max(MIN_MIC_GAIN, n)) : DEFAULT_MIC_GAIN;
}

export function createMicLimiter(sampleRate) {
  const attackCoeff  = Math.exp(-1 / (sampleRate * (LIMITER_ATTACK_MS  / 1000)));
  const releaseCoeff = Math.exp(-1 / (sampleRate * (LIMITER_RELEASE_MS / 1000)));
  let envelope = 0;

  return {
    limit(v) {
      const av = Math.abs(v);
      envelope = av > envelope
        ? attackCoeff  * envelope + (1 - attackCoeff)  * av
        : releaseCoeff * envelope + (1 - releaseCoeff) * av;
      const gain = envelope > LIMITER_CEILING ? LIMITER_CEILING / envelope : 1;
      return Math.max(-32768, Math.min(32767, Math.round(v * gain)));
    },
    reset() { envelope = 0; },
  };
}
