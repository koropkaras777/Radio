import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SERVER_URL, FADE_IN_S, FADE_OUT_S, MAX_OPACITY } from '../../config/constants.js';
import {
  BIBLE_BLACK_START, BIBLE_BLACK_END,
  BIBLE_BLACK_HEAVEN, BIBLE_BLACK_HELL_START, BIBLE_BLACK_HELL_END,
} from '../../config/easterConstants.js';
import { useNamespace }                from '../../i18n/index.js';
import { useDirectionSync }            from '../../i18n/rtl.js';
import { buildRadioPath }              from '../../i18n/localePaths.js';
import { theme, applyTheme }           from './utils/theme.js';
import { DEFAULT_DAY_COLOR }           from '../../config/constants.js';
import { readLS }                      from './utils/storage.js';
import { fetchCover }                  from './utils/coverArt.js';
import { ScrollToTop }                 from '../shared/ScrollToTop.jsx';
import { Footer }                      from '../shared/Footer.jsx';

import { useDynamicColor } from './hooks/useDynamicColor.js';
import { useArtistArt }    from './hooks/useArtistArt.js';
import { useLyrics }       from './hooks/useLyrics.js';
import { useAudioPlayer }  from './hooks/useAudioPlayer.js';
import { useStreamPlayer } from './hooks/useStreamPlayer.js';
import { usePiP }          from './hooks/usePiP.js';
import { useRadioSocket }  from './hooks/useRadioSocket.js';

import { ArtBackground }   from './ArtBackground.jsx';
import { RadioHeader }     from './RadioHeader.jsx';
import { RadioPlayer }     from './RadioPlayer.jsx';
import { UpcomingPlaylist } from './UpcomingPlaylist.jsx';
import { PlaybackHistory } from './PlaybackHistory.jsx';
import { SongLibrary }     from './SongLibrary.jsx';
import { VolumeKnob }      from './VolumeKnob.jsx';
import { SettingsModal }   from './SettingsModal.jsx';
import { CoverModal, MiniPlayer, SuggestNotif, CookieBanner } from './overlays.jsx';

import {
  DEFAULT_UI_SETTINGS,
  getLocalizedRadioName,
  getLocalizedTelegramLabel,
  splitRadioTitle,
} from './utils/radioNameUtils.js';

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  // ── Persisted state ───────────────────────────────────────────────────────
  const [lang,         setLang]         = useState(() => localStorage.getItem('radio_lang') || 'uk');
  const handleLangChange = useCallback((newLang) => {
    setLang(newLang);
    const path = buildRadioPath(newLang, 'radio');
    if (window.location.pathname !== path) window.history.replaceState({}, '', path);
  }, []);
  const [volume,       setVolume]       = useState(() => readLS('radio_volume', 0.5));
  const [isMuted,      setIsMuted]      = useState(() => readLS('radio_is_muted', false));
  const [showOnlyOne,  setShowOnlyOne]  = useState(() => readLS('radio_show_only_one', true));
  const [isBlurred,    setIsBlurred]    = useState(() => readLS('radio_is_blurred', true));
  const [historyShowOnlyOne, setHistoryShowOnlyOne] = useState(() => readLS('radio_history_show_only_one', true));
  const [historyIsBlurred,   setHistoryIsBlurred]   = useState(() => readLS('radio_history_is_blurred', true));
  const [hideLyrics,   setHideLyrics]   = useState(() => readLS('radio_hide_lyrics',   false));
  const [hidePlaylist, setHidePlaylist] = useState(() => readLS('radio_hide_playlist', false));
  const [hideHistory,  setHideHistory]  = useState(() => readLS('radio_hide_history',  false));
  const [hideLibrary,  setHideLibrary]  = useState(() => readLS('radio_hide_library',  false));
  const [hideArts,     setHideArts]     = useState(() => readLS('radio_hide_arts',     false));
  const [dynamicColors, setDynamicColors] = useState(() => readLS('radio_dynamic_colors', true));
  const [cookieConsent, setCookieConsent] = useState(() => !!localStorage.getItem('radio_cookie_consent'));
  const [dayTheme,      setDayTheme]      = useState(() => localStorage.getItem('radio_day_theme') || 'dark');
  const [dayColor,      setDayColor]      = useState(() => localStorage.getItem('radio_day_color') || DEFAULT_DAY_COLOR);

  // ── Playback / UI state ───────────────────────────────────────────────────
  const [isConnected,    setIsConnected]    = useState(false);
  const [isJoined,       setIsJoined]       = useState(false);
  const [currentTrack,   setCurrentTrack]   = useState(null);
  const [currentTitle,   setCurrentTitle]   = useState(null);
  const [currentArtist,  setCurrentArtist]  = useState(null);
  const [currentAlbum,   setCurrentAlbum]   = useState(null);
  const [currentYear,    setCurrentYear]    = useState(null);
  const [currentCover,   setCurrentCover]   = useState(null);
  const [isChatMode,     setIsChatMode]     = useState(false);
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [seek,           setSeek]           = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [isPaused,       setIsPaused]       = useState(false);
  const [playlist,       setPlaylist]       = useState([]);
  const [history,        setHistory]        = useState([]);
  const [library,        setLibrary]        = useState([]);
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false);
  const [adminOnline,    setAdminOnline]    = useState(false);
  const [suggestCooldown, setSuggestCooldown] = useState(0);
  const [suggestNotif,   setSuggestNotif]   = useState('');
  const [currentMode,    setCurrentMode]    = useState('day');
  const [uiSettings,     setUiSettings]     = useState(DEFAULT_UI_SETTINGS);
  const [radioName,      setRadioName]      = useState('is loading...');
  const [listeners,      setListeners]      = useState([]);
  const [showSettingButton, setShowSettingButton] = useState(true);
  const [lastTrackKey,   setLastTrackKey]   = useState('');
  const [isHammerSmashed,    setIsHammerSmashed]    = useState(false);
  const [hammerVisibleSince, setHammerVisibleSince] = useState(null);
  const [artToken,           setArtToken]           = useState(null);
  const [listenerUidState,   setListenerUidState]   = useState(null);
  const [musicSource,        setMusicSource]        = useState('local');
  const [streamMode,         setStreamMode]         = useState(false);
  const [donationInfo,       setDonationInfo]       = useState(null);
  const [dioTitleAnimActive, setDioTitleAnimActive] = useState(false);
  const [radioTitleScale,    setRadioTitleScale]    = useState(1);
  const [radioTitleMaxWidth, setRadioTitleMaxWidth] = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const audioRef              = useRef(null);
  const lastSyncTimeRef       = useRef(0);
  const isSyncingRef          = useRef(false);
  const hasStartedPlaybackRef = useRef(false);
  const joinTimeRef           = useRef(0);
  const initialServerSeekRef  = useRef(null);
  const hasInitialSyncedRef   = useRef(false);
  const pauseTimeRef          = useRef(null);
  const pauseServerSeekRef    = useRef(null);
  const lastServerSeekRef     = useRef(0);
  const resumeTimeRef         = useRef(null);
  const wasDisconnectedRef    = useRef(false);
  const isJoinedRef           = useRef(false);
  const isPausedRef           = useRef(false);
  const artTokenRef           = useRef(null);
  const artRefreshTimerRef    = useRef(null);
  const artTokenExpiryRef     = useRef(0);
  const listenerUidRef        = useRef(null);
  const serverIsPlayingRef    = useRef(false);
  const radioTitleMeasureRef  = useRef(null);
  const radioTitleVisibleRef  = useRef(null);
  const tRef                  = useRef(null);

  const t = useNamespace('radio', lang);
  useDirectionSync(lang);
  useEffect(() => { tRef.current = t; }, [t]);
  useEffect(() => { isJoinedRef.current = isJoined; }, [isJoined]);
  useEffect(() => { isPausedRef.current = isPaused;  }, [isPaused]);

  // ── Derived values ────────────────────────────────────────────────────────
  const isNight        = currentMode === 'night';
  const isDioPlaying   = currentArtist?.toLowerCase().includes('dio');
  const isHammerTrack  = currentArtist?.toLowerCase().includes('hammerfall');
  const isRainbowActive = currentArtist?.toLowerCase().includes('rainbow');
  const isBibleBlack   = currentTitle?.toLowerCase().includes('bible black');
  const isSabbathFamily = ['black sabbath', 'heaven & hell'].some((a) => currentArtist?.toLowerCase().includes(a));

  const isBibleBlackEarly    = isBibleBlack;
  const isSabbathFamilyEarly = isSabbathFamily;
  const bibleBlackThemeOverride = isBibleBlackEarly && isSabbathFamilyEarly;
  const hellTransitionProgress  = bibleBlackThemeOverride && seek >= BIBLE_BLACK_HELL_START && seek < BIBLE_BLACK_HELL_END
    ? Math.min((seek - BIBLE_BLACK_HELL_START) / (BIBLE_BLACK_HELL_END - BIBLE_BLACK_HELL_START), 1)
    : (bibleBlackThemeOverride && seek >= BIBLE_BLACK_HELL_END ? 1 : 0);

  const dynamicColorFromCover = useDynamicColor(currentCover, !currentCover, !dynamicColors && !isNight);
  const activeDayColor        = (!dynamicColors && !isNight && dynamicColorFromCover) ? dynamicColorFromCover : dayColor;

  const effectiveIsNight  = bibleBlackThemeOverride ? hellTransitionProgress > 0.5 : isNight;
  const effectiveDayTheme = bibleBlackThemeOverride ? 'light'       : dayTheme;
  const effectiveDayColor = bibleBlackThemeOverride ? 'sky'         : activeDayColor;

  const th = useMemo(() => theme(effectiveIsNight, effectiveDayTheme, effectiveDayColor), [effectiveIsNight, effectiveDayTheme, effectiveDayColor]);

  const localizedRadioName    = useMemo(() => getLocalizedRadioName(uiSettings, currentMode, lang, t),    [uiSettings, currentMode, lang, t]);
  const localizedTelegramLabel = useMemo(() => getLocalizedTelegramLabel(uiSettings, lang, t),            [uiSettings, lang, t]);
  const titleParts             = useMemo(() => splitRadioTitle(localizedRadioName),                        [localizedRadioName]);
  const baselineRadioName      = useMemo(() => getLocalizedRadioName(DEFAULT_UI_SETTINGS, currentMode, lang, t), [currentMode, lang, t]);

  useEffect(() => {
    if (!isJoined) return;
    document.title = currentTitle && currentArtist
      ? `${currentTitle} - ${currentArtist} · ${localizedRadioName}`
      : localizedRadioName;
  }, [isJoined, currentTitle, currentArtist, localizedRadioName]);

  const defaultIcon = isNight ? '/icon-sosun-192.png' : '/icon-smihun-192.png';

  // ── Dio title animation ───────────────────────────────────────────────────
  const dioTitleFontScale  = isDioPlaying && dioTitleAnimActive ? 0.86 : 1;
  const dioTitleSplitOffset = isDioPlaying && dioTitleAnimActive ? '0.55em' : '0em';
  const dioGoatSlotWidth   = isDioPlaying && dioTitleAnimActive ? '1.3em' : '0em';

  useEffect(() => {
    if (!isDioPlaying || radioName === t('preparingMode')) { setDioTitleAnimActive(false); return; }
    setDioTitleAnimActive(false);
    const id = setTimeout(() => setDioTitleAnimActive(true), 40);
    return () => clearTimeout(id);
  }, [isDioPlaying, localizedRadioName, radioName, t]);

  // ── Radio title scale ─────────────────────────────────────────────────────
  useEffect(() => {
    if (radioName === t('preparingMode')) { setRadioTitleScale(1); return; }
    const measure = () => {
      const mEl = radioTitleMeasureRef.current;
      const vEl = radioTitleVisibleRef.current;
      if (!mEl || !vEl) return;
      const maxW = mEl.getBoundingClientRect().width;
      setRadioTitleMaxWidth(maxW || null);
      const curW = vEl.scrollWidth;
      setRadioTitleScale(!maxW || !curW ? 1 : Math.min(1, maxW / curW));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    let ro;
    if ('ResizeObserver' in window && radioTitleVisibleRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(radioTitleVisibleRef.current);
    }
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); ro?.disconnect(); };
  }, [localizedRadioName, titleParts.left, titleParts.right, isDioPlaying, radioName, t, baselineRadioName]);

  // ── Apply CSS theme ───────────────────────────────────────────────────────
  useEffect(() => { applyTheme(effectiveIsNight, effectiveDayTheme, effectiveDayColor); }, [effectiveIsNight, effectiveDayTheme, effectiveDayColor]);
  useEffect(() => {
    const el = document.documentElement;
    el.style.transition = ['--color-base 0.7s ease','--color-panel 0.7s ease','--color-panel-alt 0.7s ease','--color-accent 0.7s ease'].join(', ');
    return () => { el.style.transition = ''; };
  }, []);

  // ── Donation return: poll status after redirect back from the provider ─────
  useEffect(() => {
    const donationId = new URLSearchParams(window.location.search).get('donation');
    if (!donationId) return;

    window.history.replaceState({}, '', window.location.pathname);

    let cancelled = false;
    let attempts   = 0;

    const poll = () => {
      fetch(`${SERVER_URL}/api/public/donations/${donationId}/status`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (cancelled || !data) return;
          if (data.status === 'pending' && attempts < 10) {
            attempts += 1;
            setTimeout(poll, 2000);
          } else if (data.status === 'paid' || data.status === 'paid_unqueued') {
            setSuggestNotif(t('donateProcessing'));
            setTimeout(() => setSuggestNotif(''), 6000);
          } else if (data.status === 'failed') {
            setSuggestNotif(t('donateFailedPayment'));
            setTimeout(() => setSuggestNotif(''), 6000);
          }
        })
        .catch(() => {});
    };
    poll();

    return () => { cancelled = true; };
  }, []);

  // ── Server config ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${SERVER_URL}/api/public/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.musicSource) setMusicSource(d.musicSource);
        if (d?.streamMode)  setStreamMode(true);
        setDonationInfo(d?.capabilities?.donations ? d.donationInfo : null);
      })
      .catch(() => {});
  }, []);

  // ── Favicon ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isJoined) return;
    const fav = document.getElementById('favicon');
    if (!fav) return;
    fav.href = currentCover ? currentCover : `${currentCover ?? (isNight ? '/icon-sosun-192.png' : '/icon-smihun-192.png')}?v=${Date.now()}`;
  }, [isJoined, currentCover, isNight]);

  // ── Persist to localStorage ────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('radio_lang',          lang); },                            [lang]);
  useEffect(() => { localStorage.setItem('radio_volume',        String(volume)); },                  [volume]);
  useEffect(() => { localStorage.setItem('radio_is_muted',      JSON.stringify(isMuted)); },         [isMuted]);
  useEffect(() => { localStorage.setItem('radio_show_only_one', JSON.stringify(showOnlyOne)); },     [showOnlyOne]);
  useEffect(() => { localStorage.setItem('radio_is_blurred',    JSON.stringify(isBlurred)); },       [isBlurred]);
  useEffect(() => { localStorage.setItem('radio_history_show_only_one', JSON.stringify(historyShowOnlyOne)); }, [historyShowOnlyOne]);
  useEffect(() => { localStorage.setItem('radio_history_is_blurred',    JSON.stringify(historyIsBlurred)); },   [historyIsBlurred]);

  // ── Library ────────────────────────────────────────────────────────────────
  const refreshLibrary = useCallback(async () => {
    try {
      const res  = await fetch(`${SERVER_URL}/api/library`);
      if (!res.ok) throw new Error(`Library HTTP ${res.status}`);
      const data = await res.json();
      setLibrary(Array.isArray(data) ? data : []);
    } catch { setLibrary([]); }
  }, []);

  useEffect(() => { if (isJoined) refreshLibrary(); }, [isNight, isJoined, refreshLibrary]);

  // ── Playback history ─────────────────────────────────────────────────────────
  const refreshHistory = useCallback(async () => {
    try {
      const res  = await fetch(`${SERVER_URL}/api/history`);
      if (!res.ok) throw new Error(`History HTTP ${res.status}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => { if (isJoined && !hideHistory) refreshHistory(); }, [isJoined, hideHistory, currentTrack, refreshHistory]);

  // ── Media Session ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !isJoined) return;
    [['play', () => { if (isPaused) handlePausePlay(); }],
     ['pause', () => { if (!isPaused) handlePausePlay(); }],
     ['stop',  () => { if (!isPaused) handlePausePlay(); }]].forEach(([a, h]) => {
      try { navigator.mediaSession.setActionHandler(a, h); } catch {}
    });
    navigator.mediaSession.playbackState = isPaused ? 'paused' : 'playing';
    navigator.mediaSession.metadata = new MediaMetadata({
      title : currentTitle  || localizedRadioName,
      artist: currentArtist || 'Anonymous',
      album : currentAlbum  || localizedRadioName,
      artwork: [{ src: currentCover || defaultIcon, sizes: '512x512', type: 'image/png' }],
    });
  }, [isPaused, isJoined, currentTitle, currentArtist, currentCover, localizedRadioName, isNight]);

  // ── Audio volume ───────────────────────────────────────────────────────────
  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);

  // ── Suggest cooldown countdown ────────────────────────────────────────────
  useEffect(() => {
    if (suggestCooldown <= 0) return;
    const id = setTimeout(() => setSuggestCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [suggestCooldown]);

  // ── Track change resets ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;
    hasStartedPlaybackRef.current = false;
    hasInitialSyncedRef.current   = false;
    initialServerSeekRef.current  = null;
  }, [currentTrack]);

  useEffect(() => { if (currentTrack) setRadioName(localizedRadioName); }, [localizedRadioName, currentTrack]);

  // ── HammerFall animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isHammerTrack) { setIsHammerSmashed(false); setHammerVisibleSince(null); return; }
    if (seek > 0.5 && !hammerVisibleSince) { setHammerVisibleSince(Date.now()); return; }
    if (!hammerVisibleSince) return;
    const elapsed = Date.now() - hammerVisibleSince;
    if (elapsed >= 900) { setIsHammerSmashed(true); }
    else { const id = setTimeout(() => setIsHammerSmashed(true), 1000 - elapsed); return () => clearTimeout(id); }
  }, [seek, isHammerTrack, hammerVisibleSince]);

  // ── rAF loop for lyrics seek ref (sync mode only) ────────────────────────
  const _audioSeekRef = useRef(0);
  useEffect(() => {
    if (streamMode) return;
    let rafId;
    const tick = () => { if (audioRef.current) _audioSeekRef.current = audioRef.current.currentTime; rafId = requestAnimationFrame(tick); };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [streamMode]);

  // ── Custom hooks ──────────────────────────────────────────────────────────
  const artistArt = useArtistArt({ currentTrack, hideArts, isNight, artToken, musicSource, artistArtsSettings: uiSettings?.artistArts });

  const { lyrics, lyricsLoading } = useLyrics({ artToken, currentTitle, currentArtist, currentAlbum });

  const encryptedPlayerRef = useAudioPlayer({
    audioRef, currentTrack, isJoined: streamMode ? false : isJoined, artToken, listenerUid: listenerUidState,
    serverIsPlayingRef, lastServerSeekRef, initialServerSeekRef, hasInitialSyncedRef, isPausedRef,
  });

  const socketRef = useRef(null);
  const streamPlayerApiRef = useRef(null);

  const [streamPing, setStreamPing] = useState(0);

  const streamPlayer = useStreamPlayer({
    audioRef,
    socketRef,
    artToken,
    isJoined,
    isPausedRef,
    setIsPlaying,
    setSeek,
    setDuration,
    setStreamPing,
  });
  streamPlayerApiRef.current = streamPlayer;

  const lyricsSeekRef = streamMode ? streamPlayer.lyricsSeekRef : _audioSeekRef;

  const { pipMountNode, isPipSupported, openMiniPlayer } = usePiP({
    isNight, activeDayColor, th, tRef, isJoined, currentTrack, isChatMode,
  });

  const handleOpenMiniPlayer = useCallback(async () => {
    const problem = await openMiniPlayer();
    if (!problem) return;
    setSuggestNotif(problem);
    setTimeout(() => setSuggestNotif(''), 4000);
  }, [openMiniPlayer]);

  useRadioSocket({
    socketRef,
    audioRef, encryptedPlayerRef, streamMode, streamPlayerApiRef, tRef, lang, t, uiSettings,
    currentTrack, currentMode, isJoined, isPlaying, lastTrackKey,
    setIsConnected, setArtToken, setListenerUidState, setSuggestCooldown,
    setAdminOnline, setSuggestNotif, setListeners, setCurrentMode,
    setCurrentTrack, setCurrentTitle, setCurrentArtist, setCurrentAlbum,
    setCurrentYear, setCurrentCover, setRadioName, setPlaylist,
    setIsPlaying, setSeek, setDuration, setUiSettings, setLastTrackKey,
    setIsChatMode,
    artTokenRef, artRefreshTimerRef, artTokenExpiryRef, listenerUidRef,
    isSyncingRef, isJoinedRef, isPausedRef, wasDisconnectedRef,
    hasInitialSyncedRef, initialServerSeekRef, lastSyncTimeRef,
    lastServerSeekRef, serverIsPlayingRef, joinTimeRef, resumeTimeRef,
    refreshLibrary,
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLoadedMetadata = () => {
    if (streamMode) return;
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleTimeUpdate = () => {
    if (streamMode) return;
    if (audioRef.current && isJoined && !isSyncingRef.current) setSeek(audioRef.current.currentTime);
  };

  const handleJoinRadio = async () => {
    setIsJoined(true);
    joinTimeRef.current = Date.now();
    if (streamMode) {
      const ok = await streamPlayer.join();
      if (!ok) setIsPlaying(false);
    }
  };

  const handlePausePlay = useCallback(async () => {
    if (streamMode) {
      if (isPaused) {
        const ok = await streamPlayer.resume();
        if (ok) setIsPaused(false);
      } else {
        streamPlayer.leave();
        setIsPaused(true);
      }
      return;
    }
    if (!audioRef.current) return;
    if (isPaused) {
      audioRef.current.currentTime = lastServerSeekRef.current;
      setSeek(lastServerSeekRef.current);
      lastSyncTimeRef.current    = Date.now();
      pauseTimeRef.current       = null;
      pauseServerSeekRef.current = null;
      resumeTimeRef.current      = Date.now();
      audioRef.current.play().then(() => setIsPaused(false)).catch((e) => console.error('Failed to resume:', e));
    } else {
      pauseTimeRef.current       = Date.now();
      pauseServerSeekRef.current = lastServerSeekRef.current;
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, [isPaused, streamMode, streamPlayer]);

  const handleSuggest = (song) => {
    if (!socketRef.current || suggestCooldown > 0 || !adminOnline) return;
    socketRef.current.emit('suggest_song', song, (res) => {
      if (res?.ok) { setSuggestCooldown(300); setSuggestNotif(t('suggestSent')); setTimeout(() => setSuggestNotif(''), 4000); }
      else if (res?.error === 'cooldown') setSuggestCooldown(res.secsLeft);
    });
  };

  // ── Bible Black / Henry animation derived values ──────────────────────────
  const henryProgress = duration > 0 ? (seek / duration) * 100 : 0;
  let henryOpacity = 0, henryTop = '100%';
  let henryFilter = 'sepia(0.2) brightness(1.2)', henryShadow = 'none';
  let bibleBlackPhase = 'angel';

  if (isBibleBlack && duration > 0) {
    if      (seek > BIBLE_BLACK_END)                 bibleBlackPhase = 'fadeout';
    else if (seek >= BIBLE_BLACK_START)              bibleBlackPhase = 'demon';
    else if (seek >= BIBLE_BLACK_START - 5)          bibleBlackPhase = 'rising';
    else if (seek >= BIBLE_BLACK_HELL_END)           bibleBlackPhase = 'hell';
    else if (seek >= BIBLE_BLACK_HELL_START)         bibleBlackPhase = 'transition';
    else                                             bibleBlackPhase = 'angel';
  }

  let hellVisible = 0;
  if (isBibleBlack) {
    if (['hell', 'rising'].includes(bibleBlackPhase)) hellVisible = 1;
  }

  if (isSabbathFamily && duration > 0) {
    if (!isBibleBlack) {
      if (henryProgress <= 33.3)      { const p = henryProgress / 33.3; henryOpacity = p * 0.5; henryTop = `${100 - p * 50}%`; }
      else if (henryProgress <= 66.6) { henryOpacity = 0.5; henryTop = '50%'; }
      else                            { const p = Math.min((henryProgress - 66.6) / 33.4, 1); henryOpacity = 0.5 * (1 - p); henryTop = '50%'; }
    } else {
      const angelTop = 'calc(100% + 5px)', demonTop = '50%';
      if      (bibleBlackPhase === 'angel')      { const f = Math.min(seek / 15, 1); henryOpacity = 0.85 * f; henryTop = angelTop; henryFilter = 'brightness(1.1) saturate(1.1)'; henryShadow = 'drop-shadow(0 4px 18px rgba(0,0,0,0.7)) drop-shadow(0 2px 8px rgba(0,0,0,0.5))'; }
      else if (bibleBlackPhase === 'transition') { const p = hellTransitionProgress; henryOpacity = 0.85; henryTop = angelTop; henryFilter = `brightness(${1.1 - p * 0.2}) saturate(${1.1 + p * 0.5})`; henryShadow = `drop-shadow(0 4px 18px rgba(${Math.round(p * 120)},0,0,${0.5 + p * 0.3})) drop-shadow(0 2px 8px rgba(0,0,0,0.5))`; }
      else if (bibleBlackPhase === 'hell')       { henryOpacity = 0.85; henryTop = angelTop; henryFilter = 'brightness(0.9) saturate(1.6)'; henryShadow = 'drop-shadow(0 4px 20px rgba(180,0,0,0.75)) drop-shadow(0 2px 8px rgba(255,50,0,0.4))'; }
      else if (bibleBlackPhase === 'rising')     { henryOpacity = 0.85; henryTop = demonTop; henryFilter = 'brightness(0.9) saturate(1.6)'; henryShadow = 'drop-shadow(0 4px 20px rgba(180,0,0,0.75)) drop-shadow(0 2px 8px rgba(255,50,0,0.4))'; }
      else if (bibleBlackPhase === 'demon')      { const fp = Math.min(seek - BIBLE_BLACK_START, 1); henryOpacity = 0.5 + fp * 0.5; henryFilter = `brightness(${1 - fp})`; henryShadow = `drop-shadow(0 0 ${15 * fp}px rgba(255,69,0,0.9)) drop-shadow(0 0 5px rgba(255,140,0,1))`; henryTop = demonTop; }
      else if (bibleBlackPhase === 'fadeout')    { const pp = Math.min((seek - BIBLE_BLACK_END) / (duration - BIBLE_BLACK_END), 1); henryOpacity = 1 - pp; henryFilter = 'brightness(0)'; henryShadow = `drop-shadow(0 0 ${15 * (1 - pp)}px rgba(255,69,0,0.5))`; henryTop = demonTop; }
    }
  }

  // ── Art overlay opacity ───────────────────────────────────────────────────
  const artSrc = artistArt || null;
  let artOpacity = 0;
  if (artSrc && duration > 0) {
    if      (seek <= FADE_IN_S)                artOpacity = (seek / FADE_IN_S) * MAX_OPACITY;
    else if (seek >= duration - FADE_OUT_S)    artOpacity = ((duration - seek) / FADE_OUT_S) * MAX_OPACITY;
    else                                        artOpacity = MAX_OPACITY;
  }
  const artPanelStyle = artSrc ? { backgroundColor: `${th.artPanelBg}${0.55 + 0.45 * (1 - artOpacity / MAX_OPACITY)})`, transition: 'background-color 0.5s linear' } : undefined;

  // ── Streaming service URLs ─────────────────────────────────────────────────
  const youtubeMusicUrl = useMemo(() => currentArtist && currentTitle ? `https://music.youtube.com/search?q=${encodeURIComponent(`${currentArtist} - ${currentTitle}`)}` : null, [currentArtist, currentTitle]);
  const spotifyUrl = useMemo(() => {
    if (!currentArtist || !currentTitle) return null;
    const q = encodeURIComponent(`${currentArtist} ${currentTitle}`);
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? `https://open.spotify.com/search/results/${q}` : `https://open.spotify.com/search/${q}`;
  }, [currentArtist, currentTitle]);
  const appleMusicUrl = useMemo(() => currentArtist && currentTitle && currentCover ? `https://music.apple.com/us/search?term=${encodeURIComponent(`${currentArtist} - ${currentTitle}`)}` : null, [currentArtist, currentTitle, currentCover]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-1000 ${th.bgBaseCls} text-white`}>

      <ArtBackground artSrc={artSrc} artOpacity={artOpacity} />

      <RadioHeader
        listeners={listeners} uiSettings={uiSettings} localizedTelegramLabel={localizedTelegramLabel}
        isNight={isNight} dayTheme={dayTheme} dayColor={dayColor} artToken={artToken}
        lang={lang} t={t} th={th}
      />

      <div className="relative container z-10 mx-auto px-4 py-8 max-w-4xl">

        {streamMode && streamPlayer.streamErr && isJoined && (
          <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700/60 px-4 py-3 text-sm text-red-200 text-center">
            {t('streamError')}
          </div>
        )}

        <RadioPlayer
          th={th} t={t}
          isNight={isNight} effectiveIsNight={effectiveIsNight} effectiveDayTheme={effectiveDayTheme} effectiveDayColor={effectiveDayColor}
          isConnected={isConnected} isJoined={isJoined}
          currentTrack={currentTrack} currentTitle={currentTitle} currentArtist={currentArtist}
          currentAlbum={currentAlbum} currentCover={currentCover} defaultIcon={defaultIcon}
          seek={seek} duration={duration} isPaused={isPaused} isPlaying={isPlaying}
          artPanelStyle={artPanelStyle}
          radioName={radioName} localizedRadioName={localizedRadioName} baselineRadioName={baselineRadioName} titleParts={titleParts}
          radioTitleScale={radioTitleScale} radioTitleMaxWidth={radioTitleMaxWidth}
          radioTitleMeasureRef={radioTitleMeasureRef} radioTitleVisibleRef={radioTitleVisibleRef}
          isDioPlaying={isDioPlaying} dioTitleAnimActive={dioTitleAnimActive}
          dioTitleFontScale={dioTitleFontScale} dioTitleSplitOffset={dioTitleSplitOffset} dioGoatSlotWidth={dioGoatSlotWidth}
          isSabbathFamily={isSabbathFamily} isBibleBlack={isBibleBlack} isHammerTrack={isHammerTrack} isRainbowActive={isRainbowActive}
          henryOpacity={henryOpacity} henryTop={henryTop} henryFilter={henryFilter} henryShadow={henryShadow}
          hellVisible={hellVisible} bibleBlackPhase={bibleBlackPhase} isHammerSmashed={isHammerSmashed}
          lyrics={lyrics} lyricsLoading={lyricsLoading} lyricsSeekRef={lyricsSeekRef} hideLyrics={hideLyrics} musicSource={musicSource} artToken={artToken}
          onLyricsModalChange={setLyricsModalOpen}
          onJoin={handleJoinRadio} onPausePlay={handlePausePlay} onCoverClick={() => setIsModalOpen(true)}
          onOpenMiniPlayer={handleOpenMiniPlayer} isPipSupported={isPipSupported}
          audioRef={audioRef} onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate}
          isChatMode={isChatMode}
        />

        {isJoined && playlist.length > 0 && !hidePlaylist && (
          <UpcomingPlaylist playlist={playlist} showOnlyOne={showOnlyOne} setShowOnlyOne={setShowOnlyOne} isBlurred={isBlurred} setIsBlurred={setIsBlurred} artPanelStyle={artPanelStyle} th={th} t={t} />
        )}

        {isJoined && history.length > 0 && !hideHistory && (
          <PlaybackHistory history={history} showOnlyOne={historyShowOnlyOne} setShowOnlyOne={setHistoryShowOnlyOne} isBlurred={historyIsBlurred} setIsBlurred={setHistoryIsBlurred} artPanelStyle={artPanelStyle} th={th} t={t} />
        )}

        {isJoined && library.length > 0 && !hideLibrary && (
          <SongLibrary library={library} adminOnline={adminOnline} suggestCooldown={suggestCooldown} artPanelStyle={artPanelStyle} th={th} t={t} onSuggest={handleSuggest} donationInfo={donationInfo} lang={lang} />
        )}

        {isJoined && !currentTrack && (
          <div className={`${th.bgPanelCls} rounded-lg p-6 text-center`} style={artPanelStyle}>
            <p className={th.textMono}>{t('waitingMusic')}</p>
          </div>
        )}
      </div>

      {isJoined && <VolumeKnob volume={volume} isMuted={isMuted} setVolume={setVolume} setIsMuted={setIsMuted} th={th} />}

      <button
        onClick={() => setSettingsOpen(true)}
        style={{ opacity: showSettingButton && !lyricsModalOpen ? 1 : 0 }}
        className={`fixed bottom-6 end-6 z-[10] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all ${th.miniPlayerBtn} shadow-black/40`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-6 h-6 ${th.settingsIcon}`}>
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      <SettingsModal
        open={settingsOpen} onClose={() => setSettingsOpen(false)} th={th} t={t}
        lang={lang} setLang={handleLangChange}
        hideLyrics={hideLyrics} setHideLyrics={setHideLyrics}
        hidePlaylist={hidePlaylist} setHidePlaylist={setHidePlaylist}
        hideHistory={hideHistory} setHideHistory={setHideHistory}
        hideLibrary={hideLibrary} setHideLibrary={setHideLibrary}
        hideArts={hideArts} setHideArts={setHideArts}
        dynamicColors={dynamicColors} setDynamicColors={setDynamicColors}
        dayColor={dayColor} setDayColor={setDayColor}
        dayTheme={dayTheme} setDayTheme={setDayTheme}
        isNight={isNight} bibleBlackThemeOverride={bibleBlackThemeOverride}
        streamMode={streamMode}
        artsEnabled={Boolean(uiSettings?.artistArts?.dayEnabled || uiSettings?.artistArts?.nightEnabled)}
      />

      <CoverModal
        open={isModalOpen} onClose={() => setIsModalOpen(false)}
        currentCover={currentCover} defaultIcon={defaultIcon}
        currentTitle={currentTitle} currentArtist={currentArtist}
        currentAlbum={currentAlbum} currentYear={currentYear}
        isSabbathFamily={isSabbathFamily}
        youtubeMusicUrl={youtubeMusicUrl} spotifyUrl={spotifyUrl} appleMusicUrl={appleMusicUrl}
        th={th} t={t} isChatMode={isChatMode}
      />

      <MiniPlayer
        pipMountNode={pipMountNode}
        currentCover={currentCover} defaultIcon={defaultIcon}
        currentTitle={currentTitle} currentArtist={currentArtist} currentAlbum={currentAlbum}
        isConnected={isConnected} isPaused={isPaused} isMuted={isMuted} volume={volume}
        onPausePlay={handlePausePlay}
        onMuteToggle={() => setIsMuted((v) => !v)}
        onVolumeChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if (v > 0) setIsMuted(false); }}
        th={th} t={t} isChatMode={isChatMode}
      />

      <SuggestNotif message={suggestNotif} th={th} t={t} />

      {!cookieConsent && (
        <CookieBanner
          onAccept={() => { localStorage.setItem('radio_cookie_consent', '1'); setCookieConsent(true); }}
          th={th} t={t}
        />
      )}

      <ScrollToTop isNight={isNight} hidden={lyricsModalOpen || settingsOpen} end="end-8" bottom="bottom-24" />
      <Footer lang={lang} text={getLocalizedRadioName(uiSettings, 'day', lang, t)} />
    </div>
  );
}

export default App;