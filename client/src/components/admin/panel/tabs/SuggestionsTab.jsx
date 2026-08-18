import { PrivilegeGate } from '../../shared/PrivilegeGate.jsx';

// ─── SuggestionsTab ──────────────────────────────────────────────────────────
export function SuggestionsTab({
  isNight, lang, t,
  suggestions, canManageQueue,
  handleSuggestionAction, cooldownSuggestion, cooldownAdd,
  suggestionTtlMs,
}) {
  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {suggestions.length === 0 ? (
        <p className="text-center opacity-20 text-[10px] font-black uppercase mt-10">
          {t('noSuggestions')}
        </p>
      ) : (
        suggestions.map(({ uid, song, addedAt }) => {
          const secLeft = Math.max(0, Math.round((addedAt + suggestionTtlMs - Date.now()) / 1000));
          return (
            <div
              key={uid}
              className={`p-4 rounded-xl flex justify-between items-center transition-all border-2 ${
                isNight ? 'bg-orange-950/20 border-orange-900/30 hover:border-orange-600'
                        : 'bg-orange-950/10 border-orange-800/20 hover:border-orange-500/60'
              }`}
            >
              <div className="flex flex-col overflow-hidden mr-4 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black uppercase text-sm truncate">{song.title}</span>
                  <span className="flex-shrink-0 bg-orange-500 text-white text-[8px] px-1.5 py-0.5 rounded font-black border border-white/10">
                    {t('listenerBadge')}
                  </span>
                </div>
                <span className="text-[10px] font-bold opacity-60 uppercase truncate">{song.artist}</span>
                <span className="text-[9px] opacity-30 font-mono mt-0.5">{t('secLeft', { count: secLeft })}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <PrivilegeGate locked={!canManageQueue} lang={lang} inline>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSuggestionAction(uid, 'add')}
                      disabled={cooldownSuggestion > 0 || cooldownAdd > 0}
                      className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-90 disabled:opacity-30 ${
                        isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      {cooldownSuggestion > 0 ? `${cooldownSuggestion}s` : t('suggestionOnAir')}
                    </button>
                    <button
                      onClick={() => handleSuggestionAction(uid, 'skip')}
                      disabled={cooldownSuggestion > 0}
                      className="px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-90 disabled:opacity-30 bg-white/10 hover:bg-white/20 text-white/60"
                    >
                      {t('suggestionSkip')}
                    </button>
                  </div>
                </PrivilegeGate>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}