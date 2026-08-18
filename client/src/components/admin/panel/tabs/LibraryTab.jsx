import { SongRow } from '../ui/SongRow.jsx';

// ─── LibraryTab ──────────────────────────────────────────────────────────────
export function LibraryTab({
  isNight, lang, t,
  canManageQueue,
  addType, setAddType,
  searchQuery, setSearchQuery,
  songsToShow, hasMore, filteredSongs, visibleCount, setVisibleCount,
  handleAirClick, cooldownAdd,
  pageSize,
}) {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {canManageQueue && (
        <div className="flex w-full mb-4 bg-white/5 rounded-xl p-1 border border-white/10 shadow-inner">
          {[['lastinline', t('regular'), 'bg-violet-500'], ['donated', t('donate'), 'bg-green-500']].map(([type, label, bg]) => (
            <button
              key={type}
              onClick={() => setAddType(type)}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${addType === type ? bg : 'opacity-30'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder={t('search')}
        className="w-full mb-4 p-4 rounded-xl text-[16px] font-black transition-all border-none outline-none text-start shadow-inner bg-white/90 text-gray-800 placeholder-gray-400 placeholder:text-xs"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="w-full flex flex-col gap-2">
        {songsToShow.map((song) => (
          <SongRow
            key={song.id}
            song={song}
            isNight={isNight}
            onAir={handleAirClick}
            cooldown={cooldownAdd}
            addType={addType}
            t={t}
            lang={lang}
            canManageQueue={canManageQueue}
          />
        ))}

        {hasMore && (
          <button
            onClick={() => setVisibleCount((c) => c + pageSize)}
            className={`mt-4 py-3 w-full rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
              isNight ? 'border-red-900/40 text-red-700 hover:bg-red-900/10'
                      : 'border-white/20 text-white/50 hover:bg-white/5'
            }`}
          >
            {t('showMoreLabel', { count: filteredSongs.length - visibleCount })}
          </button>
        )}

        {filteredSongs.length === 0 && searchQuery && (
          <p className="text-center opacity-40 uppercase font-black text-xs mt-10">
            {t('nothingFound')}
          </p>
        )}
      </div>
    </div>
  );
}