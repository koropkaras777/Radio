import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ─── SongTooltip ─────────────────────────────────────────────────────────────
export function SongTooltip({ song, anchor }) {
  if (!song || !anchor) return null;
  const GAP = 8;
  const style = {
    position: 'fixed',
    left: anchor.left,
    top: anchor.top - GAP,
    transform: 'translateY(-100%)',
    zIndex: 9999,
  };
  const parts = [`${song.artist} - ${song.title}`];
  if (song.album) parts.push(song.album);
  const text = parts.join(' · ') + (song.year ? ` (${song.year})` : '');

  return createPortal(
    <div
      style={style}
      className="pointer-events-none whitespace-nowrap rounded-md bg-gray-800 border border-white/10 px-2 py-1 text-[10px] font-bold text-white shadow-lg"
    >
      {text}
      <div className="absolute top-full left-4 w-2 h-2 -translate-y-1 rotate-45 bg-gray-800" />
    </div>,
    document.body
  );
}

// ─── useSongTooltip ──────────────────────────────────────────────────────────
export function useSongTooltip() {
  const [tooltip, setTooltip] = useState({ song: null, anchor: null });
  const timerRef = useRef(null);

  const show = useCallback((song, e) => {
    clearTimeout(timerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ song, anchor: { left: rect.left, top: rect.top } });
  }, []);

  const hide = useCallback(() => {
    timerRef.current = setTimeout(() => setTooltip({ song: null, anchor: null }), 80);
  }, []);

  return { tooltip, show, hide };
}