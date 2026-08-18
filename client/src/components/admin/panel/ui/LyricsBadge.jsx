// ─── LyricsBadge ─────────────────────────────────────────────────────────────
export function LyricsBadge({ status, t }) {
  if (!status) return null;
  const map = {
    synced: { label: t('lyricsSynced'), cls: 'bg-green-700/40 text-green-300' },
    plain:  { label: t('lyricsPlain'),  cls: 'bg-blue-700/40 text-blue-300'  },
    none:   { label: t('lyricsNone'),   cls: 'bg-gray-700/40 text-gray-400'  },
  };
  const { label, cls } = map[status] ?? map.none;
  return (
    <span className={`mt-1 self-start px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${cls}`}>
      {label}
    </span>
  );
}