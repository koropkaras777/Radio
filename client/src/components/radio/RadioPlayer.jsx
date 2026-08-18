import { useRef } from 'react';
import { EasterEggs } from './EasterEggs.jsx';
import { MarqueeText } from './MarqueeText.jsx';
import { LyricsPlayer } from './LyricsPlayer.jsx';
import { formatTime } from './utils/formatTime.js';
import { useMarqueeDetect } from './hooks/useMarqueeDetect.js';

export function RadioPlayer({
  th, t,
  isNight, effectiveIsNight, effectiveDayTheme, effectiveDayColor,
  isConnected, isJoined,
  currentTrack, currentTitle, currentArtist, currentAlbum,
  currentCover, defaultIcon,
  seek, duration, isPaused, isPlaying,
  artPanelStyle,
  radioName, localizedRadioName, baselineRadioName, titleParts,
  radioTitleScale, radioTitleMaxWidth,
  radioTitleMeasureRef, radioTitleVisibleRef,
  isDioPlaying, dioTitleAnimActive, dioTitleFontScale, dioTitleSplitOffset, dioGoatSlotWidth,
  isSabbathFamily, isBibleBlack, isHammerTrack, isRainbowActive,
  henryOpacity, henryTop, henryFilter, henryShadow,
  hellVisible, bibleBlackPhase, isHammerSmashed,
  hideLyrics,
  lyrics, lyricsLoading, lyricsSeekRef, musicSource, artToken,
  onLyricsModalChange,
  onJoin, onPausePlay, onCoverClick, onOpenMiniPlayer,
  isPipSupported,
  audioRef, onLoadedMetadata, onTimeUpdate,
  isChatMode = false,
}) {
  const titleWrapperRef  = useRef(null);
  const titleInnerRef    = useRef(null);
  const artistWrapperRef = useRef(null);
  const artistInnerRef   = useRef(null);

  const displayCover  = isChatMode ? defaultIcon                        : currentCover;
  const displayTitle  = isChatMode ? t('chatModeTitle') : currentTitle;
  const displayArtist = isChatMode ? t('chatModeArtist')   : currentArtist;
  const displayAlbum  = isChatMode ? t('chatModeAlbum')     : currentAlbum;

  const isTitleMarquee  = useMarqueeDetect(titleWrapperRef,  titleInnerRef,  [displayTitle,  displayArtist, displayAlbum, isJoined]);
  const isArtistMarquee = useMarqueeDetect(artistWrapperRef, artistInnerRef, [displayArtist, displayAlbum,  isJoined]);

  return (
    <>
      <div className="title-container" style={{ position: 'relative', textAlign: 'center' }}>
        <EasterEggs
          zone="title"
          isSabbathFamily={isSabbathFamily}
          isBibleBlack={isBibleBlack}
          henryOpacity={henryOpacity}
          henryTop={henryTop}
          henryFilter={henryFilter}
          henryShadow={henryShadow}
          hellVisible={hellVisible}
          bibleBlackPhase={bibleBlackPhase}
          henryColor={th.henryColor}
          seek={seek}
          duration={duration}
        />
        <div className={`radio-title-wrapper mb-8 ${isDioPlaying ? 'dio-mode' : ''}`}>
          {radioName === t('preparingMode') ? (
            <h1 className="text-[44px] font-extrabold">{t('preparingMode')}</h1>
          ) : (
            <>
              <span
                ref={radioTitleMeasureRef}
                aria-hidden="true"
                className="font-extrabold tracking-wider inline-flex items-center whitespace-nowrap pointer-events-none opacity-0 absolute"
                style={{ fontFamily: "'Segoe UI', Roboto, sans-serif", left: '50%', top: 0, transform: 'translateX(-50%)' }}
              >
                {baselineRadioName}
              </span>

              {!isDioPlaying ? (
                <div className="flex justify-center w-full">
                  <h1
                    key="radio-title-single"
                    ref={radioTitleVisibleRef}
                    className="font-extrabold tracking-wider whitespace-nowrap inline-flex items-center justify-center text-center"
                    style={{
                      fontFamily: "'Segoe UI', Roboto, sans-serif",
                      color: th.headingColor, WebkitTextStroke: th.headingStroke, textShadow: th.shadowGlowRgb,
                      position: 'relative', width: 'fit-content', maxWidth: '100%', margin: '0 auto',
                      lineHeight: 1.1, fontSize: '44px',
                      transform: `scale(${radioTitleScale})`, transformOrigin: 'center center', transition: 'transform 260ms ease',
                    }}
                  >
                    {localizedRadioName}
                  </h1>
                </div>
              ) : (
                <h1
                  key="radio-title-dio"
                  ref={radioTitleVisibleRef}
                  className="font-extrabold tracking-wider whitespace-nowrap"
                  style={{
                    fontFamily: "'Segoe UI', Roboto, sans-serif",
                    color: th.headingColor, WebkitTextStroke: th.headingStroke, textShadow: th.shadowGlowRgb,
                    position: 'relative', width: radioTitleMaxWidth ? `${radioTitleMaxWidth}px` : 'fit-content',
                    maxWidth: '100%', margin: '0 auto', height: '1.15em', lineHeight: 1.1, fontSize: '44px',
                    transform: `scale(${radioTitleScale * dioTitleFontScale})`, transformOrigin: 'center center', transition: 'transform 2000ms ease',
                  }}
                >
                  <span className="word-static word-left" style={{ position: 'absolute', right: '50%', top: '50%', display: 'inline-block', whiteSpace: 'nowrap', transform: `translate(calc(-${dioGoatSlotWidth} / 2 - ${dioTitleSplitOffset}), -50%)`, transition: 'transform 2000ms ease 2000ms' }}>
                    {titleParts.left}
                  </span>
                  <span className="koza-overlay" aria-hidden={!isDioPlaying} style={{ position: 'absolute', left: '50%', top: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: dioGoatSlotWidth, opacity: isDioPlaying && dioTitleAnimActive ? 1 : 0, transform: `translate(-50%, -50%) scale(${isDioPlaying && dioTitleAnimActive ? 1 : 0.72})`, overflow: 'visible', whiteSpace: 'nowrap', pointerEvents: 'none', transition: 'width 1000ms ease 2000ms, opacity 1000ms ease 2000ms, transform 1000ms ease 2000ms' }}>
                    🤘
                  </span>
                  <span className="word-static word-right" style={{ position: 'absolute', left: '50%', top: '50%', display: 'inline-block', whiteSpace: 'nowrap', transform: `translate(calc(${dioGoatSlotWidth} / 2 + ${dioTitleSplitOffset}), -50%)`, transition: 'transform 2000ms ease 2000ms' }}>
                    {titleParts.right}
                  </span>
                </h1>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mb-6 text-center relative flex justify-center items-center">
        <EasterEggs zone="connection" isHammerTrack={isHammerTrack} seek={seek} duration={duration} />
        <div className="relative inline-flex items-center justify-center rounded-full overflow-hidden px-4 py-2 min-w-[120px] z-[-20]">
          <div className={`absolute inset-0 transition-colors duration-300 ${isConnected ? 'bg-green-600' : 'bg-red-600'}`} />
          {isHammerSmashed && (
            <div className="absolute inset-0 pointer-events-none opacity-90 mix-blend-multiply" style={{ backgroundImage: "url('/img/cracks.png')", backgroundSize: 'cover', filter: 'brightness(0.3) contrast(1.5)', zIndex: 1 }} />
          )}
          <span className="relative z-10 text-sm font-black text-white pointer-events-none">
            {isConnected ? t('connected') : t('disconnected')}
          </span>
        </div>
      </div>

      <audio ref={audioRef} onLoadedMetadata={onLoadedMetadata} onTimeUpdate={onTimeUpdate} preload="auto" />

      {!isJoined && (
        <div className="text-center mb-8">
          <button onClick={onJoin} className={`px-8 py-4 rounded-lg text-xl font-semibold transition-all ${th.accentGlow}`}>
            {t('joinRadio')}
          </button>
        </div>
      )}

      {isJoined && (currentTrack || isChatMode) && (
        <div className={`relative ${th.bgPanelCls} rounded-lg p-6 mb-6`} style={artPanelStyle}>
          <EasterEggs zone="player" isRainbowActive={isRainbowActive} seek={seek} duration={duration} />

          <h2 className={`text-2xl font-semibold mb-4 ${th.textPanel}`}>{t('nowPlaying')}</h2>

          {isPipSupported && (
            <button type="button" onClick={onOpenMiniPlayer} className={`absolute top-4 end-4 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg transition-all active:scale-95 ${th.miniPlayerBtn}`} title={t('miniPlayer')} aria-label={t('miniPlayer')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v7h-7"/><path d="M3 10V3h7"/>
              </svg>
            </button>
          )}

          <div className="flex flex-row items-center gap-4 md:gap-6 mb-6 overflow-hidden">
            <div className="relative shrink-0">
              <img
                src={displayCover || defaultIcon}
                alt="Cover"
                className={`w-20 h-20 object-cover cursor-pointer transition-transform hover:scale-105 active:scale-95 rounded-lg shadow-2xl border-2 transition-all duration-200 ${th.coverBorder}`}
                onClick={onCoverClick}
                onError={(e) => { e.target.src = defaultIcon; }}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
              {displayTitle && (
                <MarqueeText text={displayTitle} isMarquee={isTitleMarquee} wrapperRef={titleWrapperRef} innerRef={titleInnerRef} className={`${th.titleColor} text-xl md:text-3xl font-black mb-1 transition-colors`} />
              )}
              {(displayArtist || displayAlbum) && (
                <MarqueeText text={`${displayArtist}${displayAlbum ? ` · ${displayAlbum}` : ''}`} isMarquee={isArtistMarquee} wrapperRef={artistWrapperRef} innerRef={artistInnerRef} className={`text-sm md:text-xl ${th.textSecondary} font-medium`} />
              )}
            </div>
          </div>

          <div className="mb-2" dir="ltr">
            <div className={`w-full rounded-full h-2 ${th.progressTrack}`}>
              <div className={`h-2 rounded-full transition-[width] duration-150 ease-linear ${th.progressBar}`} style={{ width: `${duration > 0 ? (seek / duration) * 100 : 0}%` }} />
            </div>
          </div>
          <div className={`flex justify-between text-sm ${th.textMono} font-mono`} dir="ltr">
            <span>{formatTime(seek)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button onClick={onPausePlay} className={`px-8 py-3 rounded-xl text-lg font-bold transition-all transform active:scale-95 flex items-center gap-2 shadow-lg ${th.accentBg}`}>
              {isPaused ? <><span>▶</span><span>{t('play')}</span></> : <><span>⏸</span><span>{t('pause')}</span></>}
            </button>
          </div>
        </div>
      )}

      {isJoined && currentTrack && !hideLyrics && (
        <LyricsPlayer
          lyrics={lyrics} lyricsLoading={lyricsLoading}
          seek={seek} lyricsSeekRef={lyricsSeekRef}
          isNight={effectiveIsNight} dayTheme={effectiveDayTheme} dayColor={effectiveDayColor}
          t={t} onModalChange={onLyricsModalChange}
          panelStyle={artPanelStyle} musicSource={musicSource} artToken={artToken}
        />
      )}
    </>
  );
}