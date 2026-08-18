// ─── SongChip ────────────────────────────────────────────────────────────────
export const SongChip = ({ song, onRemove, onShowTooltip, onHideTooltip }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs">
    <div
      className="min-w-0 cursor-default"
      onMouseEnter={onShowTooltip ? (e) => onShowTooltip(song, e) : undefined}
      onMouseLeave={onHideTooltip}
    >
      <div className="truncate font-black">{song.title}</div>
      <div className="truncate text-gray-400">{song.artist}</div>
    </div>
    {onRemove && (
      <button onClick={() => onRemove(song.id)} className="rounded bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/70 hover:bg-white/20">
        ×
      </button>
    )}
  </div>
);