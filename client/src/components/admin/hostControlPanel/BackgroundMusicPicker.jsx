// ─── BackgroundMusicPicker ───────────────────────────────────────────────────
export function BackgroundMusicPicker({
  isNight, t,
  nowPlaying, open, onToggle,
  list, total, loadingMore, onLoadMore,
  selectedId, onSelect,
}) {
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg text-[11px] font-bold text-gray-300 hover:text-white transition-colors"
      >
        <span>{nowPlaying ? t('backgroundMusicCurrent', { name: nowPlaying.replace(/\.mp3$/i, '') }) : t('backgroundMusicSection')}</span>
        <span className="text-gray-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={`mt-1 rounded-lg border max-h-48 overflow-y-auto ${isNight ? 'border-red-900/40 bg-red-950/10' : 'border-white/10 bg-white/5'}`}>
          {list === null ? (
            <p className="text-xs text-gray-500 italic px-2 py-2">{t('backgroundMusicLoading')}</p>
          ) : list.length === 0 ? (
            <p className="text-xs text-gray-500 italic px-2 py-2">{t('backgroundMusicEmpty')}</p>
          ) : (
            <div className="space-y-1 p-1">
              <button
                onClick={() => onSelect(null)}
                className={`w-full text-start px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  !selectedId ? (isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white') : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                {t('backgroundMusicNone')}
              </button>
              {list.map((track) => {
                const active = selectedId === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => onSelect(track.id)}
                    className={`w-full text-start px-2 py-1.5 rounded-lg text-[11px] font-bold truncate transition-all ${
                      active ? (isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white') : 'text-gray-300 hover:bg-white/5'
                    }`}
                    title={track.filename}
                  >
                    {track.filename.replace(/\.mp3$/i, '')}
                  </button>
                );
              })}
              {list.length < total && (
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="w-full py-1.5 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loadingMore ? t('backgroundMusicLoading') : t('backgroundMusicLoadMore', { count: total - list.length })}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}