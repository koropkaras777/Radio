import { createPortal } from 'react-dom';
import { MarqueeText } from './MarqueeText.jsx';
import { useRef } from 'react';
import { useMarqueeDetect } from './hooks/useMarqueeDetect.js';

// ── CoverModal ────────────────────────────────────────────────────────────────
export function CoverModal({ open, onClose, currentCover, defaultIcon, currentTitle, currentArtist, currentAlbum, currentYear, isSabbathFamily, youtubeMusicUrl, spotifyUrl, appleMusicUrl, th, t, isChatMode = false }) {
  if (!open) return null;

  const displayCover  = isChatMode ? defaultIcon                          : currentCover;
  const displayTitle  = isChatMode ? t('chatModeTitle') : currentTitle;
  const displayArtist = isChatMode ? t('chatModeArtist')   : currentArtist;
  const displayAlbum  = isChatMode ? t('chatModeAlbum')     : currentAlbum;
  const displayYear   = isChatMode ? new Date().getFullYear()             : currentYear;

  const trackMetaSubtitle = [
    displayArtist || null,
    displayAlbum ? `${displayAlbum}${displayYear ? ` (${displayYear})` : ''}` : (displayYear ? `(${displayYear})` : null),
  ].filter(Boolean).join(' · ');

  const isHeavenAndHell = !isChatMode && currentTitle?.toLowerCase() === 'heaven and hell' && isSabbathFamily;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center ${th.coverBackground} p-4 transition-all duration-1000 ease-out animate-in fade-in backdrop-blur-sm`}
      onClick={onClose}
    >
      <div className="relative flex max-w-[90vw] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={displayCover || defaultIcon}
          alt="Full size cover"
          className="rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.6)] max-w-[90vw] max-h-[75vh] object-contain transition-all duration-1000 ease-in-out animate-in zoom-in-95 slide-in-from-bottom-10"
          onClick={onClose}
        />
        {(displayTitle || trackMetaSubtitle) && (
          <div className={`mt-4 max-w-full text-center ${th.coverText}`}>
            {displayTitle && (
              <div className={`${th.coverTitleColor} text-xl font-bold md:text-3xl`}>
                {isHeavenAndHell ? (
                  <><span style={{ color: '#60a5fa' }}>Heaven</span><span style={{ color: '#ffffff' }}> And </span><span style={{ color: '#bc0000' }}>Hell</span></>
                ) : displayTitle}
              </div>
            )}
            {trackMetaSubtitle && (
              <div className={`mt-1 text-base font-medium ${th.coverTextMuted} opacity-70 md:text-xl`}>
                {trackMetaSubtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {!isChatMode && (
      <div className="absolute end-4 top-4 flex items-center gap-2">
        {youtubeMusicUrl && (
          <a href={youtubeMusicUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-105 active:scale-95" aria-label="YouTube Music">
            <img src="/streaming_services/youtubemusic.png" alt="YouTube Music" className="h-6 w-6 object-contain" />
          </a>
        )}
        {spotifyUrl && (
          <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-105 active:scale-95" aria-label="Spotify">
            <img src="/streaming_services/spotify.png" alt="Spotify" className="h-6 w-6 object-contain" />
          </a>
        )}
        {appleMusicUrl && (
          <a href={appleMusicUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-105 active:scale-95" aria-label="Apple Music">
            <img src="/streaming_services/applemusic.png" alt="Apple Music" className="h-6 w-6 object-contain" />
          </a>
        )}
      </div>
      )}
    </div>
  );
}

// ── MiniPlayer ────────────────────────────────────────────────────────────────
export function MiniPlayer({ pipMountNode, currentCover, defaultIcon, currentTitle, currentArtist, currentAlbum, isConnected, isPaused, isMuted, volume, onPausePlay, onMuteToggle, onVolumeChange, th, t, isChatMode = false }) {
  const pipTitleWrapperRef  = useRef(null);
  const pipTitleInnerRef    = useRef(null);
  const pipArtistWrapperRef = useRef(null);
  const pipArtistInnerRef   = useRef(null);

  const displayCover  = isChatMode ? defaultIcon                          : currentCover;
  const displayTitle  = isChatMode ? t('chatModeTitle') : currentTitle;
  const displayArtist = isChatMode ? t('chatModeArtist')   : currentArtist;
  const displayAlbum  = isChatMode ? t('chatModeAlbum')     : currentAlbum;

  const isPipTitleMarquee  = useMarqueeDetect(pipTitleWrapperRef,  pipTitleInnerRef,  [displayTitle,  displayArtist, displayAlbum]);
  const isPipArtistMarquee = useMarqueeDetect(pipArtistWrapperRef, pipArtistInnerRef, [displayArtist, displayAlbum]);

  if (!pipMountNode) return null;

  return createPortal(
    <div className={`w-full h-full rounded-xl p-5 md:p-6 text-white ${th.bgPanelCls}`}>
      <div className="absolute end-5 top-5 flex justify-end items-center mb-3">
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? t('connected') : t('disconnected')} />
      </div>

      <div className="flex items-center gap-4 md:gap-5">
        <img
          src={displayCover || defaultIcon}
          alt="cover"
          className={`w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg shadow-lg border ${th.pipCoverBorder}`}
          onError={(e) => { e.target.src = defaultIcon; }}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          {displayTitle && (
            <MarqueeText text={displayTitle} isMarquee={isPipTitleMarquee} wrapperRef={pipTitleWrapperRef} innerRef={pipTitleInnerRef} className={`${th.titleColor} text-2xl md:text-4xl font-black mb-1 transition-colors`} />
          )}
          {(displayArtist || displayAlbum) && (
            <MarqueeText text={`${displayArtist}${displayAlbum ? ` · ${displayAlbum}` : ''}`} isMarquee={isPipArtistMarquee} wrapperRef={pipArtistWrapperRef} innerRef={pipArtistInnerRef} className={`text-base md:text-2xl ${th.textSecondary} font-medium`} />
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={onPausePlay} className={`px-5 py-2.5 rounded-xl text-base font-bold transition-all transform active:scale-95 flex items-center gap-2 shadow-lg ${th.accentBg}`}>
          {isPaused ? <><span>▶</span><span>{t('play')}</span></> : <><span>⏸</span><span>{t('pause')}</span></>}
        </button>
        <button type="button" onClick={onMuteToggle} className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all active:scale-95 ${th.pipMuteBtn}`} title={isMuted || volume === 0 ? t('unmuteTitle') : t('muteTitle')}>
          {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={onVolumeChange} className={`w-full bg-transparent cursor-pointer transition-colors duration-300 ${th.accentInput}`} />
        </div>
      </div>
    </div>,
    pipMountNode
  );
}

// ── SuggestNotif ──────────────────────────────────────────────────────────────
export function SuggestNotif({ message, th, t }) {
  if (!message) return null;
  const cls = message.startsWith('✓') ? th.toastSuccess
    : message === t('suggestSent')       ? th.toastInfo
    :                                   th.toastError;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[95] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl backdrop-blur-md border ${cls}`}>
        {message}
      </div>
    </div>
  );
}

// ── CookieBanner ──────────────────────────────────────────────────────────────
export function CookieBanner({ onAccept, th, t }) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[90] flex items-center justify-between gap-4 px-6 py-4 border-t transition-all duration-500 ${th.cookieBanner} backdrop-blur-md`}>
      <p className="text-xs leading-relaxed max-w-xl">{t('cookieBannerText')}</p>
      <button onClick={onAccept} className={`shrink-0 px-5 py-2 rounded-lg text-xs font-black uppercase transition-all active:scale-95 ${th.accentBtn} text-white`}>
        {t('cookieBannerOk')}
      </button>
    </div>
  );
}