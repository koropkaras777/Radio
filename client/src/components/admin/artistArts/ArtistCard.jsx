export function ArtistCard({ item, isNight, nightMode = true, onSelect, t }) {
  const badgeClass = item.hasArt
    ? 'bg-green-700/40 text-green-300'
    : 'bg-gray-700/40 text-gray-400';

  const modes = item.modes || [];
  const modeLabel = modes.includes('day') && modes.includes('night')
    ? '☀️/🌙'
    : modes.includes('night') ? t('modeNight') : t('modeDay');

  return (
    <button
      onClick={() => onSelect(item)}
      className={`w-full text-start rounded-xl px-4 py-3 border transition-all ${
        isNight
          ? 'bg-red-950/20 border-red-900/20 hover:border-red-600'
          : 'bg-white/5 border-white/10 hover:border-white/30'
      }`}
    >
      <div className="flex items-center gap-2 justify-between">
        <div className="min-w-0">
          <div className="font-black text-sm truncate capitalize text-white">{item.artist}</div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {nightMode && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-white/10 text-gray-300">
              {modeLabel}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${badgeClass}`}>
            {item.hasArt ? t('hasArt') : t('noArt')}
          </span>
        </div>
      </div>
    </button>
  );
}
