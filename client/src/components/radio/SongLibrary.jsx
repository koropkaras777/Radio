import { useState, useMemo } from 'react';
import { DonatePopover } from './DonatePopover.jsx';

const suggestCooldownText = (s, t) => (
  s >= 60 ? t('suggestCooldownMin', { count: Math.ceil(s / 60) }) : t('suggestCooldownSec', { count: s })
);

export function SongLibrary({ library, adminOnline, suggestCooldown, artPanelStyle, th, t, onSuggest, donationInfo, lang }) {
  const [librarySearch,  setLibrarySearch]  = useState('');
  const [libraryVisible, setLibraryVisible] = useState(5);
  const [orderInfoOpen,  setOrderInfoOpen]  = useState(false);
  const [suggestTipId,   setSuggestTipId]   = useState(null);
  const [donateSongId,   setDonateSongId]   = useState(null);

  const filtered = useMemo(() => {
    const tokens = librarySearch.toLowerCase().trim().split(/[\s\-–—,|]+/).filter(Boolean);
    return tokens.length
      ? library.filter((s) => {
          const haystack = `${s.artist} ${s.title}`.toLowerCase();
          return tokens.every((tok) => haystack.includes(tok));
        })
      : library;
  }, [library, librarySearch]);

  const toShow  = librarySearch.trim() ? filtered : library;
  const visible = toShow.slice(0, libraryVisible);

  return (
    <>
      <div className={`${th.bgPanelCls} rounded-lg p-6 mt-6`} style={artPanelStyle}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-2xl font-semibold ${th.textPanel}`}>{t('searchLibraryTitle')}</h2>
          <button
            onClick={() => setOrderInfoOpen(true)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border transition-all active:scale-95 ${th.border} ${th.textStrong} hover:bg-white/10`}
            title={t('orderInfoTitle')}
          >
            i
          </button>
        </div>

        <input
          type="text"
          placeholder={t('searchLibrary')}
          value={librarySearch}
          onChange={(e) => { setLibrarySearch(e.target.value); setLibraryVisible(5); }}
          className={`w-full mb-4 p-3 rounded text-sm border-none outline-none focus:ring-1 ${th.tileInput}`}
        />

        {visible.length > 0 ? (
          <ul className="space-y-2">
            {visible.map((song, i) => (
              <li key={`${song.id}-${i}`} className={`p-3 rounded ${th.tileBg} flex items-center justify-between gap-3`}>
                <div className="flex flex-col gap-1 overflow-hidden">
                  <span className={`font-semibold leading-tight truncate ${th.textSecondary}`}>{song.title}</span>
                  <span className={th.playlistArtist}>{song.artist}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {donationInfo && (
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setDonateSongId(donateSongId === song.id ? null : song.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 bg-green-600 hover:bg-green-500 text-white`}
                      >
                        {t('donateBtn')}
                      </button>
                      {donateSongId === song.id && (
                        <DonatePopover song={song} lang={lang} t={t} th={th} onClose={() => setDonateSongId(null)} />
                      )}
                    </div>
                  )}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => onSuggest(song)}
                      disabled={suggestCooldown > 0 || !adminOnline}
                      onPointerDown={(e) => {
                        if (e.pointerType !== 'touch') return;
                        if (suggestCooldown <= 0 && adminOnline) return;
                        setSuggestTipId(song.id);
                        setTimeout(() => setSuggestTipId(null), 2500);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${th.orderBtn} text-white`}
                      title={!adminOnline ? t('suggestNoAdmin') : undefined}
                    >
                      {suggestCooldown > 0 ? suggestCooldownText(suggestCooldown, t) : t('suggestBtn')}
                    </button>
                    {suggestTipId === song.id && (
                      <div
                        className={`absolute bottom-full end-0 mb-2 px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap z-50 pointer-events-none shadow-lg ${th.borderToast} ${th.text}`}
                        style={{ backgroundColor: th.bgToast }}
                      >
                        {!adminOnline ? t('suggestNoAdmin') : suggestCooldownText(suggestCooldown, t)}
                        <div className="absolute top-5 end-4 w-2 h-2 rotate-45" style={{ backgroundColor: th.bgToast }} />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : librarySearch.trim() ? (
          <p className="text-center text-gray-500 text-sm py-4">{t('searchNoResults')}</p>
        ) : null}

        {libraryVisible < toShow.length && (
          <button
            onClick={() => setLibraryVisible((v) => v + 10)}
            className={`mt-4 py-3 w-full rounded-xl text-[10px] font-black uppercase transition-all border-2 ${th.border} ${th.textStrong} hover:bg-white/5`}
          >
            {t('showMoreLibrary', { count: toShow.length - libraryVisible })}
          </button>
        )}
      </div>

      {orderInfoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOrderInfoOpen(false)}>
          <div className={`relative mx-4 max-w-sm w-full rounded-2xl p-6 shadow-2xl border ${th.cardSubtle}`} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOrderInfoOpen(false)} className={`absolute top-4 end-4 ${th.controlBtn}`}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
            <h3 className={`text-base font-black uppercase mb-4 ${th.textAccentMuted}`}>{t('orderInfoTitle')}</h3>
            <ul className="flex flex-col gap-3">
              {[t('orderInfoStep1'), t('orderInfoStep2'), t('orderInfoStep3')].map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className={`text-sm ${th.textSecondary} leading-snug`}>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}