let sharedAudioCtx = null;

function getAudioContext() {
  if (!sharedAudioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * @param {MediaStream} stream
 * @returns {{ getLevel: () => number, stop: () => void } | null} level is a rough 0-1 RMS value
 */
export function createLevelMeter(stream) {
  const ctx = getAudioContext();
  if (!ctx || !stream.getAudioTracks().length) return null;

  let source;
  let analyser;
  try {
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
  } catch (err) {
    console.warn('[audioLevel] Failed to set up level meter:', err);
    return null;
  }

  const data = new Uint8Array(analyser.frequencyBinCount);
  let stopped = false;

  return {
    getLevel() {
      if (stopped) return 0;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSquares += v * v;
      }
      return Math.sqrt(sumSquares / data.length);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      try { source.disconnect(); } catch { }
      try { analyser.disconnect(); } catch { }
    },
  };
}