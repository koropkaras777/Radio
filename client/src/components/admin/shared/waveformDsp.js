// ─── Shared waveform DSP ─────────────────────────────────────────────────────
let sharedCtx = null;
export function getSharedAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  return sharedCtx;
}

export function buildFakeWave(targetBars, seed = 0, { base = 0.15, amp = 0.7 } = {}) {
  return Array.from({ length: targetBars }, (_, i) => {
    const x = (i + seed) / targetBars;
    return base + amp * Math.abs(Math.sin(x * Math.PI * 6.3 + i * 0.37) * Math.cos(x * 4.1 + seed * 0.5));
  });
}

export async function decodeAudioToWave(url, targetBars, context) {
  try {
    if (!context) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrBuf  = await res.arrayBuffer();
    const decoded = await context.decodeAudioData(arrBuf);
    const numCh = decoded.numberOfChannels;
    const len   = decoded.length;
    const mono  = new Float32Array(len);
    for (let ch = 0; ch < numCh; ch++) {
      const d = decoded.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += d[i] / numCh;
    }
    const step = Math.max(1, Math.floor(len / targetBars));
    const wave = Array.from({ length: targetBars }, (_, i) => {
      const start = i * step;
      let sum = 0;
      for (let j = 0; j < step; j++) { const s = mono[start + j] || 0; sum += s * s; }
      return Math.sqrt(sum / step);
    });
    return { wave, duration: decoded.duration || 0 };
  } catch {
    return null;
  }
}