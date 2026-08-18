let sharedCtx = null;

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

const HIGHPASS_FREQ_HZ = 100;
const COMPRESSOR_THRESHOLD_DB = -24;
const COMPRESSOR_KNEE_DB      = 12;
const COMPRESSOR_RATIO        = 6;
const COMPRESSOR_ATTACK_S     = 0.003;
const COMPRESSOR_RELEASE_S    = 0.15;

export const MIC_RECORDER_BITS_PER_SECOND = 64000;

export function createWindFilteredStream(rawStream) {
  const ctx = getAudioContext();
  if (!ctx || !rawStream.getAudioTracks().length) {
    return { stream: rawStream, stop() {} };
  }

  try {
    const source = ctx.createMediaStreamSource(rawStream);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = HIGHPASS_FREQ_HZ;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = COMPRESSOR_THRESHOLD_DB;
    compressor.knee.value      = COMPRESSOR_KNEE_DB;
    compressor.ratio.value     = COMPRESSOR_RATIO;
    compressor.attack.value    = COMPRESSOR_ATTACK_S;
    compressor.release.value   = COMPRESSOR_RELEASE_S;

    const dest = ctx.createMediaStreamDestination();
    source.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(dest);

    return {
      stream: dest.stream,
      stop() {
        try { source.disconnect(); } catch { }
        try { highpass.disconnect(); } catch { }
        try { compressor.disconnect(); } catch { }
      },
    };
  } catch (err) {
    console.warn('[micProcessing] Failed to set up wind-filter chain:', err);
    return { stream: rawStream, stop() {} };
  }
}
