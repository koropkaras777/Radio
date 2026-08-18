import { useCallback, useEffect, useRef, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { getAuthHeaders } from '../../../i18n/serverMessage.js';
import { buildFakeWave as buildFakeWaveDsp, decodeAudioToWave } from '../shared/waveformDsp.js';
import { splitKey, formatTime } from './songEditorUtils.js';

const MARKER_COLOR  = '#f59e0b';
const MARKER_HIT_PX = 10;

// ─── WaveformPlayer ───────────────────────────────────────────────────────────
export function WaveformPlayer({ songKey, isNight, t, markerTime, onMarkerChange }) {
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [waveData, setWaveData] = useState([]);
  const [audioAvailable, setAudioAvailable] = useState(true);

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dragging = useRef(null);
  const durationRef = useRef(0);
  const currentRef = useRef(0);
  const markerRef = useRef(markerTime ?? 0);

  const { artist, title } = splitKey(songKey);
  const accentColor = isNight ? '#dc2626' : '#2563eb';

  const audioSrc = `${SERVER_URL}/api/admin/lyrics/audio-preview?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;

  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { currentRef.current  = current;  }, [current]);
  useEffect(() => { markerRef.current   = markerTime ?? 0; }, [markerTime]);

  // ── Fake waveform ──────────────────────────────────────────────────────────
  const buildFakeWave = useCallback((seed = 0) => buildFakeWaveDsp(600, seed, { base: 0.12, amp: 0.75 }), []);

  // ── Real waveform ─────────────────────────────────────────────────────────
  const buildRealWave = useCallback(async (src) => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return buildFakeWave(1);
    const tmpCtx = new AudioCtx();
    const result = await decodeAudioToWave(src, 600, tmpCtx);
    await tmpCtx.close();
    if (!result) return buildFakeWave(2);
    return result.wave;
  }, [buildFakeWave]);

  // ── Draw (called from RAF and from state changes) ──────────────────────────
  const draw = useCallback((cur, mrk, dur, wave) => {
    const canvas = canvasRef.current;
    const W_data = wave ?? waveData;
    if (!canvas || W_data.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const gc = canvas.getContext('2d');
    gc.scale(dpr, dpr);
    gc.clearRect(0, 0, W, H);

    const durVal  = dur ?? durationRef.current;
    const curVal  = cur ?? currentRef.current;
    const mrkVal  = mrk ?? markerRef.current;
    const PITCH   = 2;
    const bars    = Math.floor(W / PITCH);
    const progX   = durVal > 0 ? (curVal / durVal) * W : 0;
    const markX   = durVal > 0 ? (mrkVal / durVal) * W : 0;
    const maxVal  = Math.max(...W_data, 0.001);
    const mid     = H / 2;
    const srcLen  = W_data.length;

    for (let i = 0; i < bars; i++) {
      const srcIdx = Math.round((i / bars) * (srcLen - 1));
      const amp    = W_data[srcIdx] / maxVal;
      const half   = Math.max(1, amp * mid * 0.95);
      const x      = i * PITCH;
      gc.fillStyle = x < progX ? accentColor : 'rgba(255,255,255,0.22)';
      gc.fillRect(x, mid - half, 1, half * 2);
    }

    if (durVal > 0) {
      gc.fillStyle = 'rgba(255,255,255,0.75)';
      gc.fillRect(Math.round(progX), 0, 1, H);
    }

    const mx = Math.round(markX);
    gc.fillStyle = MARKER_COLOR;
    gc.fillRect(Math.max(0, mx - 1), 0, 3, H);
    gc.beginPath();
    gc.moveTo(mx - 6, 0);
    gc.lineTo(mx + 6, 0);
    gc.lineTo(mx, 10);
    gc.closePath();
    gc.fill();
  }, [waveData, accentColor]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const obs = new ResizeObserver(() => draw());
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [draw]);

  useEffect(() => {
    const next = Math.max(0, markerTime ?? 0);
    markerRef.current = next;

    const audio = audioRef.current;
    if (audio && audioAvailable) {
      audio.currentTime = next;
    }

    currentRef.current = next;
    setCurrent(next);
    draw(next, next);
  }, [markerTime, audioAvailable, draw]);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    setPlaying(false);
    setCurrent(0); currentRef.current = 0;
    setDuration(0); durationRef.current = 0;
    setWaveData([]);
    setAudioAvailable(true);
    if (!audio) return;
    setLoading(true);

    let cancelled = false;

    fetch(audioSrc, { credentials: 'include', headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error('preview fetch failed');
        return res.json();
      })
      .then(({ url }) => {
        if (cancelled) return;
        audio.src = url;
        audio.load();
        return buildRealWave(url);
      })
      .then((wave) => {
        if (!cancelled && wave) {
          setWaveData(wave);
          draw(0, markerRef.current, 0, wave);
        }
      })
      .catch(() => {
        if (!cancelled) setAudioAvailable(false);
      });

    return () => { cancelled = true; };
  }, [songKey]);

  const onLoadedMetadata = useCallback(() => {
    const d = audioRef.current?.duration || 0;
    setDuration(d); durationRef.current = d;
    setLoading(false);
  }, []);

  const onEnded = () => setPlaying(false);

  const onError = useCallback(() => {
    setLoading(false);
    setAudioAvailable(false);
    setWaveData((prev) => prev.length > 0 ? prev : buildFakeWave(5));
  }, [buildFakeWave]);

  // ── Play / Pause ──────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioAvailable) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [audioAvailable]);

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(rafRef.current); return; }
    const tick = () => {
      const t = audioRef.current?.currentTime ?? 0;
      currentRef.current = t;
      setCurrent(t);
      draw(t, markerRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, draw]);

  // ── Space → play/pause ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  // ── Arrow keys → nudge marker ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
      e.preventDefault();
      const step  = e.shiftKey ? 1 : 0.1;
      const delta = e.code === 'ArrowRight' ? step : -step;
      const next  = Math.max(0, Math.min(durationRef.current || 9999, markerRef.current + delta));
      markerRef.current = next;
      onMarkerChange?.(next);
      draw(currentRef.current, next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draw, onMarkerChange]);

  // ── Canvas interaction ────────────────────────────────────────────────────
  const fracFromClientX = useCallback((clientX) => {
    const canvas = canvasRef.current;
    if (!canvas || !durationRef.current) return null;
    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * durationRef.current;
  }, []);

  const isNearMarker = useCallback((clientX) => {
    const canvas = canvasRef.current;
    if (!canvas || !durationRef.current) return false;
    const rect  = canvas.getBoundingClientRect();
    const markX = (markerRef.current / durationRef.current) * rect.width;
    return Math.abs(clientX - rect.left - markX) <= MARKER_HIT_PX;
  }, []);

  const onCanvasMouseDown = useCallback((e) => {
    const pos = fracFromClientX(e.clientX);
    if (pos === null) return;
    if (isNearMarker(e.clientX)) {
      dragging.current = 'marker';
      markerRef.current = pos;
      onMarkerChange?.(pos);
      draw(currentRef.current, pos);
    } else {
      dragging.current = 'playhead';
      currentRef.current = pos;
      setCurrent(pos);
      const audio = audioRef.current;
      if (audio && audioAvailable) audio.currentTime = pos;
      draw(pos, markerRef.current);
    }
  }, [fracFromClientX, isNearMarker, audioAvailable, draw, onMarkerChange]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const pos = fracFromClientX(e.clientX);
      if (pos === null) return;
      if (dragging.current === 'marker') {
        markerRef.current = pos;
        onMarkerChange?.(pos);
        draw(currentRef.current, pos);
      } else {
        currentRef.current = pos;
        setCurrent(pos);
        const audio = audioRef.current;
        if (audio && audioAvailable) audio.currentTime = pos;
        draw(pos, markerRef.current);
      }
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [fracFromClientX, audioAvailable, draw, onMarkerChange]);

  // ── Nudge marker ─────────────────────────────────────────────────────────
  const nudgeMarker = useCallback((delta) => {
    const next = Math.max(0, Math.min(durationRef.current || 9999, markerRef.current + delta));
    markerRef.current = next;
    onMarkerChange?.(next);
    draw(currentRef.current, next);
  }, [draw, onMarkerChange]);

  const jumpToMarker = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audioAvailable) audio.currentTime = markerRef.current;
    currentRef.current = markerRef.current;
    setCurrent(markerRef.current);
    draw(markerRef.current, markerRef.current);
  }, [audioAvailable, draw]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-2">
      <audio
        ref={audioRef}
        src={audioSrc}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onError={onError}
        preload="metadata"
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
          {t('playerLabel')}
        </span>
        {!audioAvailable && (
          <span className="text-[9px] text-gray-600 font-black uppercase">- no audio -</span>
        )}
      </div>

      <div
        className="relative w-full select-none"
        style={{ height: 80, cursor: 'crosshair' }}
        onMouseDown={onCanvasMouseDown}
      >
        {loading && waveData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-gray-500">{t('loading')}</span>
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full rounded" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={togglePlay}
            disabled={!audioAvailable}
            title="Play / Pause (Space)"
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-30 ${
              isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {playing ? (
              <svg viewBox="0 0 10 10" fill="currentColor" className="w-3 h-3">
                <rect x="1" y="1" width="3" height="8" rx="0.5"/>
                <rect x="6" y="1" width="3" height="8" rx="0.5"/>
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" fill="currentColor" className="w-3 h-3">
                <polygon points="2,1 9,5 2,9"/>
              </svg>
            )}
          </button>

          <div className="font-mono text-[11px] w-16 text-center">
            {audioAvailable
              ? <span className={isNight ? 'text-red-400' : 'text-blue-300'}>{formatTime(current, true)}</span>
              : <span className="opacity-20">-</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-black uppercase me-1" style={{ color: MARKER_COLOR }}>
              {t('markerLabel')}
            </span>
            <button
              onClick={() => nudgeMarker(-0.1)}
              title="← −0.1 s (ArrowLeft)"
              className="w-6 h-6 rounded flex items-center justify-center bg-white/10 hover:bg-amber-400/20 text-amber-400 text-xs font-black transition-all"
            >−</button>
            <button
              onClick={jumpToMarker}
              title="Jump playhead here"
              className="px-2 py-0.5 rounded font-mono text-[11px] font-black hover:bg-amber-400/20 transition-all"
              style={{ color: MARKER_COLOR, minWidth: 64, textAlign: 'center' }}
            >
              {formatTime(markerRef.current, true)}
            </button>
            <button
              onClick={() => nudgeMarker(0.1)}
              title="→ +0.1 s (ArrowRight)"
              className="w-6 h-6 rounded flex items-center justify-center bg-white/10 hover:bg-amber-400/20 text-amber-400 text-xs font-black transition-all"
            >+</button>
          </div>

          <div className="font-mono text-[10px] text-gray-500 w-12 text-right">
            {audioAvailable ? formatTime(duration) : ''}
          </div>
        </div>
      </div>
    </div>
  );
}