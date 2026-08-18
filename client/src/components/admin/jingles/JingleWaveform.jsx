import { useCallback, useEffect, useRef, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { buildFakeWave, decodeAudioToWave, getSharedAudioContext } from '../shared/waveformDsp.js';

const WAVE_BARS = 200;

let activeAudioEl = null;

// ─── JingleWaveform ──────────────────────────────────────────────────────────
export function JingleWaveform({ jingleId, isNight, apiBase }) {
  const [playing, setPlaying]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveData, setWaveData] = useState(() => buildFakeWave(WAVE_BARS, jingleId ? jingleId.length : 0));

  const audioRef  = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const currentRef = useRef(0);
  const durationRef = useRef(0);
  const urlRef    = useRef(null);
  const draggingRef = useRef(false);
  const accentColor = isNight ? '#dc2626' : '#2563eb';

  useEffect(() => { durationRef.current = duration; }, [duration]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const gc = canvas.getContext('2d');
    gc.scale(dpr, dpr);
    gc.clearRect(0, 0, W, H);

    const durVal = durationRef.current;
    const curVal = currentRef.current;
    const PITCH  = 3;
    const bars   = Math.floor(W / PITCH);
    const progX  = durVal > 0 ? (curVal / durVal) * W : 0;
    const maxVal = Math.max(...waveData, 0.001);
    const mid    = H / 2;
    const srcLen = waveData.length;

    for (let i = 0; i < bars; i++) {
      const srcIdx = Math.round((i / bars) * (srcLen - 1));
      const amp    = waveData[srcIdx] / maxVal;
      const half   = Math.max(1, amp * mid * 0.9);
      const x      = i * PITCH;
      gc.fillStyle = x < progX ? accentColor : 'rgba(255,255,255,0.22)';
      gc.fillRect(x, mid - half, 2, half * 2);
    }
  }, [waveData, accentColor]);

  // ── Fetch the real audio once, derive its actual waveform + duration ─────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!urlRef.current) {
          const data = await apiRequest(`${SERVER_URL}/api/admin/${apiBase}/${encodeURIComponent(jingleId)}/audio`);
          if (cancelled) return;
          urlRef.current = data.url;
        }
        const result = await decodeAudioToWave(urlRef.current, WAVE_BARS, getSharedAudioContext());
        if (cancelled || !result) return;
        if (result.wave?.length) setWaveData(result.wave);
        if (result.duration) setDuration(result.duration);
      } catch { }
    })();
    return () => { cancelled = true; };
  }, [jingleId, apiBase]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const obs = new ResizeObserver(() => draw());
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [draw]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    if (activeAudioEl === audioRef.current) activeAudioEl = null;
  }, []);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      currentRef.current = audio.currentTime;
      draw();
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  const ensureAudio = useCallback(async () => {
    if (!urlRef.current) {
      const data = await apiRequest(`${SERVER_URL}/api/admin/${apiBase}/${encodeURIComponent(jingleId)}/audio`);
      urlRef.current = data.url;
    }
    if (!audioRef.current) {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration || 0);
        if (currentRef.current > 0) audio.currentTime = currentRef.current;
      });
      audio.addEventListener('pause', () => {
        setPlaying(false);
        cancelAnimationFrame(rafRef.current);
      });
      audio.addEventListener('ended', () => {
        setPlaying(false);
        currentRef.current = 0;
        cancelAnimationFrame(rafRef.current);
        draw();
        if (activeAudioEl === audio) activeAudioEl = null;
      });
      audioRef.current = audio;
    }
    if (audioRef.current.src !== urlRef.current) audioRef.current.src = urlRef.current;
    return audioRef.current;
  }, [jingleId, apiBase, draw]);

  const togglePlay = useCallback(async (e) => {
    e.stopPropagation();
    if (playing) {
      audioRef.current?.pause();
      return;
    }

    setLoading(true);
    try {
      const audio = await ensureAudio();
      if (activeAudioEl && activeAudioEl !== audio) activeAudioEl.pause();
      await audio.play();
      activeAudioEl = audio;
      setPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {

    } finally {
      setLoading(false);
    }
  }, [playing, ensureAudio, tick]);

  // ── Scrub / seek by clicking or dragging along the waveform ──────────────
  const seekToClientX = useCallback((clientX) => {
    const canvas = canvasRef.current;
    if (!canvas || !durationRef.current) return;
    const rect  = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * durationRef.current;

    currentRef.current = newTime;
    draw();
    if (audioRef.current) audioRef.current.currentTime = newTime;
  }, [draw]);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    draggingRef.current = true;
    seekToClientX(e.clientX);
    ensureAudio();

    const onMove = (ev) => { if (draggingRef.current) seekToClientX(ev.clientX); };
    const onUp   = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [seekToClientX, ensureAudio]);

  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    draggingRef.current = true;
    const touch = e.touches[0];
    if (touch) seekToClientX(touch.clientX);
    ensureAudio();
  }, [seekToClientX, ensureAudio]);

  const handleTouchMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const touch = e.touches[0];
    if (touch) seekToClientX(touch.clientX);
  }, [seekToClientX]);

  const handleTouchEnd = useCallback(() => { draggingRef.current = false; }, []);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <button
        onClick={togglePlay}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
          isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'
        }`}
      >
        {loading ? (
          <div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        ) : playing ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><path d="M1 0.5v9l8-4.5z"/></svg>
        )}
      </button>
      <canvas
        ref={canvasRef}
        className="flex-1 h-6 min-w-0 cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}