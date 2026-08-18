import { PrivilegeGate } from '../../shared/PrivilegeGate.jsx';
import { OrderBadge } from '../ui/OrderBadge.jsx';
import { LyricsBadge } from '../ui/LyricsBadge.jsx';

// ─── QueueTab ────────────────────────────────────────────────────────────────
export function QueueTab({
  isNight, lang, t,
  queue, isModeTransition, canManageQueue,
  handleSkipClick, cooldownSkip,
  queueSearch, setQueueSearch, queueSearchRef,
  upcomingToShow, handleRemoveClick, cooldownRemove,
  queueOffset, queueTotal, loadMoreQueue, queueLoading,
  pageSize,
}) {
  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {queue.current && (
        <div className={`flex items-center justify-between p-6 rounded-3xl border-2 shadow-2xl ${
          isNight ? 'bg-red-950/20 border-red-900/40' : 'bg-blue-950/20 border-blue-900/40'
        }`}>
          <div className="flex flex-col">
            <span className="font-black uppercase text-lg leading-tight">{queue.current.title}</span>
            <span className="text-xs font-bold opacity-60 uppercase">{queue.current.artist}</span>
          </div>
          <div className="flex items-center gap-3">
            {!isModeTransition && (
              <PrivilegeGate locked={!canManageQueue} lang={lang} inline>
                <button
                  onClick={handleSkipClick}
                  disabled={cooldownSkip > 0}
                  title={t('skipSong')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all active:scale-90 disabled:opacity-40 border ${
                    isNight
                      ? 'border-red-700/60 text-red-400 hover:bg-red-900/30'
                      : 'border-white/20 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {cooldownSkip > 0 ? `${cooldownSkip}s` : (
                    <span className="flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <polygon points="0,0 6,5 0,10"/>
                        <rect x="7" y="0" width="3" height="10"/>
                      </svg>
                      {t('skipSong')}
                    </span>
                  )}
                </button>
              </PrivilegeGate>
            )}
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black ${isNight ? 'bg-red-600' : 'bg-blue-600'}`}>
              {t('live')}
            </div>
          </div>
        </div>
      )}

      <h3 className="text-[10px] font-black uppercase opacity-30 tracking-[0.3em] mt-6 ml-2">
        {t('next')}
      </h3>

      <input
        type="text"
        placeholder={t('searchQueue')}
        className="w-full mb-2 p-4 rounded-xl text-[16px] font-black transition-all border-none outline-none text-left shadow-inner bg-white/90 text-gray-800 placeholder-gray-400 placeholder:text-xs"
        value={queueSearch}
        onChange={(e) => { setQueueSearch(e.target.value); queueSearchRef.current = e.target.value; }}
      />

      <div className="w-full flex flex-col gap-2">
        {upcomingToShow.length > 0 ? (
          upcomingToShow.map((song, idx) => (
            <div
              key={`${song.id}-${song.position ?? idx}`}
              className={`p-4 rounded-xl flex justify-between items-center transition-all border-2 ${
                isNight ? 'bg-red-950/20 border-red-900/30 hover:border-red-600'
                        : 'bg-white/10 border-white/10 hover:border-white/40'
              }`}
            >
              <div className="flex flex-col overflow-hidden mr-4 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black uppercase text-sm truncate">{song.title}</span>
                  <OrderBadge orderType={song.orderType} tier={song.tier} t={t} />
                </div>
                <span className="text-[10px] font-bold opacity-60 uppercase truncate">{song.artist}</span>
                <LyricsBadge status={song.lyricsStatus} t={t} />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-black opacity-10">#{song.position ?? idx + 1}</span>
                <PrivilegeGate locked={!canManageQueue} lang={lang} inline>
                  <button
                    onClick={() => handleRemoveClick(song.position ?? idx + 1)}
                    disabled={cooldownRemove > 0}
                    title={t('removeFromQueue')}
                    className={`min-w-[40px] h-7 px-1.5 rounded-lg flex items-center justify-center transition-all border text-[10px] font-black ${
                      isNight
                        ? 'border-red-900/40 text-red-700 hover:bg-red-900/30 hover:text-red-400'
                        : 'border-white/20 text-white/30 hover:bg-white/10 hover:text-white/80'
                    } disabled:opacity-40`}
                  >
                    {cooldownRemove > 0 ? `${cooldownRemove}s` : (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                </PrivilegeGate>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center opacity-20 text-[10px] font-black uppercase mt-4">
            {queueSearch ? t('nothingFound') : t('emptyQueue')}
          </p>
        )}

        {!queueSearch && queue.upcoming.length > 0 && queueOffset + pageSize < queueTotal && (
          <button
            onClick={loadMoreQueue}
            disabled={queueLoading}
            className={`mt-4 py-3 w-full rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
              isNight ? 'border-red-900/40 text-red-700 hover:bg-red-900/10'
                      : 'border-white/20 text-white/50 hover:bg-white/5'
            } disabled:opacity-30`}
          >
            {queueLoading ? '...' : t('loadMoreQueue', { count: queueTotal - queue.upcoming.length })}
          </button>
        )}
      </div>
    </div>
  );
}