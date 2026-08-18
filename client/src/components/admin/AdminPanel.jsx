import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../../config/constants.js';
import { LangSwitcher } from '../shared/LangSwitcher.jsx';
import { ScrollToTop } from '../shared/ScrollToTop.jsx';
import { Footer } from '../shared/Footer.jsx';
import { SettingsModal } from './settings/SettingsModal.jsx';
import { StatsModal } from './stats/StatsModal.jsx';
import { SongEditorModal } from './songEditor/SongEditorModal.jsx';
import { UploadSongsModal } from './uploadSongs/UploadSongsModal.jsx';
import { ArtistArtsUploadModal } from './artistArts/ArtistArtsUploadModal.jsx';
import { JinglesModal } from './jingles/JinglesModal.jsx';
import { AdminManageModal } from './adminManage/AdminManageModal.jsx';
import { AdminSelfModal } from './adminSelf/AdminSelfModal.jsx';
import { AuditLogModal } from './auditLog/AuditLogModal.jsx';
import { DonationSettingsModal } from './donations/DonationSettingsModal.jsx';
import { ModeratorPanel } from './moderatorPanel/ModeratorPanel.jsx';
import { HostControlPanel } from './hostControlPanel/HostControlPanel.jsx';
import { parseServerMsg, pickLocalized, localizeServerMsg } from '../../i18n/serverMessage.js';
import { t as translate, useNamespace } from '../../i18n/index.js';
import { useDirectionSync } from '../../i18n/rtl.js';
import { useCooldown } from './hooks/useCooldown.js';
import { PrivilegeGate } from './shared/PrivilegeGate.jsx';
import { SideMenu } from './panel/SideMenu.jsx';
import { ModeSwitchControls } from './panel/ModeSwitchControls.jsx';
import { Toast } from './panel/ui/Toast.jsx';
import { LibraryTab } from './panel/tabs/LibraryTab.jsx';
import { QueueTab } from './panel/tabs/QueueTab.jsx';
import { SuggestionsTab } from './panel/tabs/SuggestionsTab.jsx';

const PAGE_SIZE  = 10;
const TOAST_MS   = 4000;
const COOLDOWN_S = 30;

const SUGGESTION_TTL_MS = 5 * 60 * 1000;

// ─── AdminPanel ───────────────────────────────────────────────────────────────
const AdminPanel = ({ navigate }) => {
  const [isNight,      setIsNight]      = useState(false);
  const [lang,         setLang]         = useState(() => localStorage.getItem('lang') || 'uk');
  const [isReady,      setIsReady]      = useState(false);
  const [privileges,   setPrivileges]   = useState([]);
  const [allPrivileges, setAllPrivileges] = useState([]);
  const [role,         setRole]         = useState('admin');
  const [authorized,   setAuthorized]   = useState(true);
  const [adminLogin,   setAdminLogin]   = useState('');
  const [nightMode,    setNightMode]    = useState(true);
  const [allSongs,     setAllSongs]     = useState([]);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeTab,    setActiveTab]    = useState('library');
  const [queue,        setQueue]        = useState({ current: null, upcoming: [] });
  const [queueOffset,  setQueueOffset]  = useState(0);
  const [queueTotal,   setQueueTotal]   = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSearch,  setQueueSearch]  = useState('');
  const [queueSearchResults, setQueueSearchResults] = useState(null);
  const [addType,       setAddType]       = useState('lastinline');
  const [cooldownAdd,        setCooldownAdd]        = useState(0);
  const [cooldownRemove,     setCooldownRemove]     = useState(0);
  const [cooldownSuggestion, setCooldownSuggestion] = useState(0);
  const [cooldownSkip,       setCooldownSkip]       = useState(0);
  const [suggestions,        setSuggestions]        = useState([]);
  const [notification,  setNotification]  = useState({ message: '', type: '' });
  const [modeConfirmOpen,   setModeConfirmOpen]   = useState(false);
  const [switchImmediately, setSwitchImmediately] = useState(true);
  const [scheduledTime,     setScheduledTime]     = useState('22:00');
  const [settingsOpen,      setSettingsOpen]      = useState(false);
  const [statsOpen,         setStatsOpen]         = useState(false);
  const [textEditorOpen,    setTextEditorOpen]    = useState(false);
  const [uploadSongsOpen,   setUploadSongsOpen]   = useState(false);
  const [uploadArtsOpen,    setUploadArtsOpen]    = useState(false);
  const [jinglesOpen,       setJinglesOpen]       = useState(false);
  const [adminManageOpen,   setAdminManageOpen]   = useState(false);
  const [adminSelfOpen,     setAdminSelfOpen]     = useState(false);
  const [auditLogOpen,      setAuditLogOpen]      = useState(false);
  const [donationSettingsOpen, setDonationSettingsOpen] = useState(false);
  const [moderatorPanelOpen, setModeratorPanelOpen] = useState(false);
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false);
  const [statsData,        setStatsData]        = useState(null);
  const [statsLoading,     setStatsLoading]     = useState(false);
  const [modeNotif, setModeNotif] = useState(null);
  const [modeSwitchPending, setModeSwitchPending] = useState(false);
  const [isModeTransition,  setIsModeTransition]  = useState(false);
  const [musicSource, setMusicSource] = useState('local');
  const [capabilities, setCapabilities] = useState({});
  const [streamMode, setStreamMode] = useState(false);
  const [radioHostsMode, setRadioHostsMode] = useState(false);
  const [serverClockOffset, setServerClockOffset] = useState(0);
  const [timeZone,          setTimeZone]          = useState('Europe/Kyiv');
  const [localTime,         setLocalTime]         = useState('');
  const [dayStartHour,      setDayStartHour]      = useState(6);
  const [nightStartHour,    setNightStartHour]    = useState(0);
  const [editSongId, setEditSongId]               = useState(null);

  const socketRef        = useRef(null);
  const devTokenRef      = useRef(null);
  const pendingTrackRef  = useRef(null);
  const currentTrackRef  = useRef(null);
  const queueSearchRef   = useRef('');
  const hasInitedSkipCooldownRef = useRef(false);
  const t = useNamespace('adminPanel', lang);
  useDirectionSync(lang);

  useEffect(() => {
    document.title = `${translate('radio.radioNameDay', {}, lang)} - ${t('pageTitle')}`;
  }, [lang, t]);

  // ── Privilege helper ───────────────────────────────────────────────────────
  const can = useCallback((privilege) => privileges.includes(privilege), [privileges]);

  const P = useMemo(
    () => Object.fromEntries(allPrivileges.map((id) => [id.toUpperCase(), id])),
    [allPrivileges]
  );

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), TOAST_MS);
  }, []);

  // ── Data Provider ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${SERVER_URL}/api/public/config`)
      .then((res) => res.json())
      .then((data) => { setMusicSource(data.musicSource || 'local'); setCapabilities(data.capabilities || {}); setStreamMode(Boolean(data.streamMode)); setRadioHostsMode(Boolean(data.radioHostsMode)); if (Array.isArray(data.allPrivileges)) setAllPrivileges(data.allPrivileges); if (data.timeZone) setTimeZone(data.timeZone); })
      .catch(() => { setMusicSource('local'); });
  }, []);

  // ── Cooldown timers ────────────────────────────────────────────────────────
  useCooldown(cooldownAdd,        setCooldownAdd);
  useCooldown(cooldownRemove,     setCooldownRemove);
  useCooldown(cooldownSuggestion, setCooldownSuggestion);
  useCooldown(cooldownSkip,       setCooldownSkip);

  // ── Reset visible count on search / mode change ────────────────────────────
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery, isNight]);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const initSocket = async () => {
      let devToken = sessionStorage.getItem('adminToken');
      devTokenRef.current = devToken;

      try {
        const res = await fetch(`${SERVER_URL}/api/admin/verify`, { credentials: 'include' });
        if (!res.ok) { navigate('/adlogin'); return; }
        const data = await res.json();
        if (Array.isArray(data.privileges)) setPrivileges(data.privileges);
        if (data.role)       setRole(data.role);
        if (data.login)      setAdminLogin(data.login);
        setAuthorized(data.authorized !== false);
        const configRes = await fetch(`${SERVER_URL}/api/public/config`).catch(() => null);
        const config    = configRes?.ok ? await configRes.json().catch(() => ({})) : {};
        setMusicSource(config.musicSource || 'local');
        setCapabilities(config.capabilities || {});
        setNightMode(config.nightMode !== false);
        setStreamMode(Boolean(config.streamMode));
        setRadioHostsMode(Boolean(config.radioHostsMode));
        if (Array.isArray(config.allPrivileges)) setAllPrivileges(config.allPrivileges);
        if (config.timeZone) setTimeZone(config.timeZone);
        if (data.token) {
          devToken = data.token;
          devTokenRef.current = data.token;
          sessionStorage.setItem('adminToken', devToken);
        }
      } catch {
        navigate('/adlogin');
        return;
      }

      if (socketRef.current) socketRef.current.disconnect();
      socketRef.current = io(SERVER_URL, { withCredentials: true });
      const socket = socketRef.current;

      socket.on('admin_confirmed', (payload) => {
        if (payload?.privileges && Array.isArray(payload.privileges)) {
          setPrivileges(payload.privileges);
        }
        if (payload?.role) setRole(payload.role);
        if (payload?.authorized !== undefined) setAuthorized(payload.authorized);
        setIsReady(true);
      });

      socket.on('force_logout', () => {
        sessionStorage.removeItem('adminToken');
        navigate('/adlogin');
      });

      socket.on('privileges_updated', async (payload) => {
        if (Array.isArray(payload?.privileges)) setPrivileges(payload.privileges);
        if (payload?.authorized !== undefined)  setAuthorized(payload.authorized);

        try {
          const res  = await fetch(`${SERVER_URL}/api/admin/verify`, { credentials: 'include' });
          const data = await res.json();
          if (res.ok) {
            if (Array.isArray(data.privileges)) setPrivileges(data.privileges);
            if (data.authorized !== undefined)  setAuthorized(data.authorized !== false);
            if (data.token) {
              devTokenRef.current = data.token;
              sessionStorage.setItem('adminToken', data.token);
            }
          }
        } catch { }
      });

      socket.on('connect', () => {
        socket.emit('admin_active', devTokenRef.current || null);
      });

      socket.on('sync', (state) => {
        if (state.mode) setIsNight(state.mode === 'night');
        setModeSwitchPending(!!state.pendingModeSwitch);
        setIsModeTransition(!!state.isPreparing);
        if (state.serverTimeMs) setServerClockOffset(state.serverTimeMs - Date.now());
        if (state.dayStartHour   != null) setDayStartHour(state.dayStartHour);
        if (state.nightStartHour != null) setNightStartHour(state.nightStartHour);
        setQueueTotal(state.totalTracks ?? 0);
        if (!hasInitedSkipCooldownRef.current && state.skipCooldownSecsLeft > 0) {
          setCooldownSkip(state.skipCooldownSecsLeft);
        }
        hasInitedSkipCooldownRef.current = true;
        const trackChanged = state.track !== currentTrackRef.current;
        if (trackChanged) {
          currentTrackRef.current = state.track;
          setQueueOffset(0);
          setQueueSearch('');
          queueSearchRef.current = '';
          setQueueSearchResults(null);
        }
        setQueue((prev) => ({
          current : { id: state.track || null, title: state.title, artist: state.artist },
          upcoming: (!trackChanged && prev.upcoming.length > PAGE_SIZE
            ? [...(state.playlist || []), ...prev.upcoming.slice(PAGE_SIZE)]
            : (state.playlist || [])
          ).filter(Boolean),
        }));
      });

      socket.on('admin_error', (raw) => {
        const { code } = parseServerMsg(raw);
        console.error('Admin Error:', localizeServerMsg(raw));
        if (code === 'ADMIN_INVALID_SESSION') {
          sessionStorage.removeItem('adminToken');
          navigate('/adlogin');
        }
      });
    };

    initSocket();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [navigate]);

  // ── Admin action listeners ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socketRef.current) return;
    const socket = socketRef.current;

    const SUCCESS_HANDLERS = {
      QUEUE_SONG_ADDED: () => {
        showToast(t('addedToAir'), 'success');
        setCooldownAdd(COOLDOWN_S);
        pendingTrackRef.current = null;
      },
      QUEUE_SONG_REMOVED: () => {
        showToast(t('removedFromQueue'), 'success');
        setCooldownRemove(COOLDOWN_S);
        if (queueSearchRef.current.trim() && socketRef.current) {
          socketRef.current.emit('search_queue', { query: queueSearchRef.current }, (res) => {
            if (res) setQueueSearchResults(res.items);
          });
        }
      },
      QUEUE_SONG_SKIPPED: () => {
        showToast(t('songSkipped'), 'success');
        setCooldownSkip(COOLDOWN_S);
      },
      QUEUE_SUGGESTION_ACCEPTED: () => {
        showToast(t('suggestionAdded'), 'success');
        setCooldownSuggestion(5);
      },
    };

    const onSuccess = (raw) => {
      const parsed = parseServerMsg(raw);
      const handler = parsed.code && SUCCESS_HANDLERS[parsed.code];
      if (handler) {
        handler();
        return;
      }

      showToast(pickLocalized(parsed, lang) || t('addedToAir'), 'success');
      pendingTrackRef.current = null;
    };

    const onError = (raw) => {
      pendingTrackRef.current = null;
      showToast(localizeServerMsg(raw, lang) || t('systemError'), 'error');
    };

    socket.on('suggestions_update', setSuggestions);
    socket.on('admin_success', onSuccess);
    socket.on('admin_error',   onError);
    return () => {
      socket.off('suggestions_update', setSuggestions);
      socket.off('admin_success', onSuccess);
      socket.off('admin_error',   onError);
    };
  }, [isReady, showToast, t, lang]);

  // ── Fetch song library ─────────────────────────────────────────────────────
  const fetchSongs = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('adminToken');
      const res = await fetch(`${SERVER_URL}/api/admin/songs`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setAllSongs(await res.json());
    } catch (e) {
      console.error('Songs fetch error:', e);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    fetchSongs();
  }, [isReady, isNight, fetchSongs]);

  // ── Admin actions ──────────────────────────────────────────────────────────
  const handleOpenStats = useCallback(async () => {
    setStatsOpen(true);
    if (statsData) return;
    setStatsLoading(true);
    try {
      const res  = await fetch(`${SERVER_URL}/api/admin/stats`, { credentials: 'include' });
      const data = await res.json();
      setStatsData(data);
    } catch {
      setStatsData(null);
    }
    setStatsLoading(false);
  }, [statsData]);

  const handleSwitchMode = useCallback(async () => {
    const targetMode = isNight ? 'day' : 'night';
    try {
      const body = { targetMode };
      if (!switchImmediately && scheduledTime) body.scheduledTime = scheduledTime;
      const res  = await fetch(`${SERVER_URL}/api/admin/switch-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const notifText = (!switchImmediately && scheduledTime)
          ? t('switchModeScheduled', { time: scheduledTime })
          : t('switchModePending');
        setModeNotif({ text: notifText, ok: true });
      } else if (data.donated) {
        setModeNotif({ text: t('switchModeDonated'), ok: false });
      } else {
        setModeNotif({ text: pickLocalized(data.error, lang) || t('systemError'), ok: false });
      }
    } catch {
      setModeNotif({ text: translate('common.connectionError', {}, lang), ok: false });
    }
    setModeConfirmOpen(false);
    setTimeout(() => setModeNotif(null), 6000);
  }, [isNight, lang, t, switchImmediately, scheduledTime]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${SERVER_URL}/api/admin/logout`, { method: 'POST', credentials: 'include' });
    } catch { }
    sessionStorage.removeItem('adminToken');
    navigate('/adlogin');
  }, [navigate]);

  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);
  const refreshSongLibrary = useCallback(() => {
    fetchSongs();
    setStatsData(null);
  }, [fetchSongs]);
  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
    refreshSongLibrary();
  }, [refreshSongLibrary]);
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on('library_updated', refreshSongLibrary);
    return () => socketRef.current?.off('library_updated', refreshSongLibrary);
  }, [refreshSongLibrary]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const filteredSongs = useMemo(() => {
    const tokens = searchQuery.toLowerCase().trim().split(/[\s\-–—,|]+/).filter(Boolean);
    if (!tokens.length) return allSongs;
    return allSongs.filter((s) => {
      const haystack = `${s.artist} ${s.title}`.toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });
  }, [allSongs, searchQuery]);
  const songsToShow = filteredSongs.slice(0, visibleCount);
  const hasMore     = visibleCount < filteredSongs.length;

  useEffect(() => {
    if (!queueSearch.trim()) { setQueueSearchResults(null); return; }
    const timer = setTimeout(() => {
      if (!socketRef.current) return;
      socketRef.current.emit('search_queue', { query: queueSearch }, (res) => {
        if (res) setQueueSearchResults(res.items);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [queueSearch]);

  useEffect(() => {
    const tick = () => {
      const serverNow = new Date(Date.now() + serverClockOffset);
      setLocalTime(serverNow.toLocaleTimeString('uk-UA', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverClockOffset, timeZone]);

  const upcomingToShow = queueSearch.trim() ? (queueSearchResults ?? []) : queue.upcoming;

  const loadMoreQueue = useCallback(() => {
    if (!socketRef.current || queueLoading) return;
    const nextOffset = queueOffset + PAGE_SIZE;
    setQueueLoading(true);
    socketRef.current.emit('get_queue', { offset: nextOffset, limit: PAGE_SIZE }, (res) => {
      if (!res) return;
      setQueue((prev) => ({ ...prev, upcoming: [...prev.upcoming, ...res.items] }));
      setQueueOffset(nextOffset);
      setQueueTotal(res.total);
      setQueueLoading(false);
    });
  }, [queueOffset, queueLoading]);

  const handleAirClick = useCallback((song) => {
    if (cooldownAdd > 0 || !socketRef.current) return;
    const songData = { ...song, orderType: addType };
    pendingTrackRef.current = songData;
    socketRef.current.emit('admin_add_song', songData);
  }, [cooldownAdd, addType]);

  const handleRemoveClick = useCallback((position) => {
    if (cooldownRemove > 0 || !socketRef.current) return;
    socketRef.current.emit('admin_remove_song', position);
  }, [cooldownRemove]);

  const handleSkipClick = useCallback(() => {
    if (cooldownSkip > 0 || !socketRef.current) return;
    socketRef.current.emit('admin_skip_song');
  }, [cooldownSkip]);

  const handleSuggestionAction = useCallback((uid, action) => {
    if (cooldownSuggestion > 0 || !socketRef.current) return;
    if (action === 'skip') {
      showToast(t('suggestionSkipped'), 'success');
      setCooldownSuggestion(5);
    }
    socketRef.current.emit('admin_suggestion_action', { uid, action });
  }, [cooldownSuggestion, showToast, t]);

  const handleLangChange = useCallback((l) => { setLang(l); localStorage.setItem('lang', l); }, []);

  const scheduledTimeError = useMemo(() => {
    if (switchImmediately || !scheduledTime) return null;
    const [hh, mm] = scheduledTime.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;
    const boundaryHour = isNight ? dayStartHour : nightStartHour;
    const pad = (n) => String(n).padStart(2, '0');
    const serverNow    = new Date(Date.now() + serverClockOffset);
    const nowMins      = serverNow.getHours() * 60 + serverNow.getMinutes();
    const inputMins    = hh * 60 + mm;
    const boundaryMins = boundaryHour * 60;
    const normalize = (m) => ((m - nowMins + 1440) % 1440);
    if (normalize(inputMins) === 0) {
      return t('timeAlreadyPassed');
    }
    if (normalize(inputMins) >= normalize(boundaryMins)) {
      return t('timeMustBeBefore', { time: `${pad(boundaryHour)}:00` });
    }
    return null;
  }, [switchImmediately, scheduledTime, isNight, dayStartHour, nightStartHour, serverClockOffset, lang]);

  if (!isReady) return null;

  // ── Privilege shortcuts ────────────────────────────────────────────────────
  const canManageQueue      = can(P.QUEUE_MANAGE)      && authorized;
  const canUploadArts       = can(P.ARTIST_ARTS)       && authorized;
  const canJingles          = (role === 'super_admin' || can(P.JINGLES_UPLOADER)) && authorized && streamMode;
  const canUploadSongs      = can(P.UPLOAD_SONGS)      && authorized;
  const canEditLyrics       = (can(P.EDITOR_LYRICS) || can(P.EDITOR_META)) && authorized;
  const canAccessSettings   = (can(P.SETTINGS_BRANDING) || can(P.SETTINGS_GROUPS) || can(P.SETTINGS_ALGORITHM)) && authorized;
  // ── Radio hosts (RADIO_HOSTS_MODE) ─────────────────────────────────────────
  const canBeRadioHost      = (role === 'super_admin' || can(P.RADIO_HOST))      && authorized;
  const canModerateRadio    = (role === 'super_admin' || can(P.RADIO_MODERATOR)) && authorized;
  const canOpenModeratorPanel = (canBeRadioHost || canModerateRadio) && radioHostsMode;
  const canViewStats        = can(P.STATS)             && authorized;
  const canSwitchMode       = can(P.MODE_SWITCH) && authorized && nightMode;
  const canUploadTracks  = Boolean(capabilities.uploadTracks);
  const canUploadArtwork = Boolean(capabilities.artistArts);
  const canUseJingles    = Boolean(capabilities.jingles);
  const canEditLibrary   = Boolean(capabilities.editTrackMetadata);
  const canSaveSettings  = Boolean(capabilities.editSettings);
  const canViewAuditLog  = Boolean(capabilities.auditLog);
  const canManageDonations = (role === 'super_admin' || can(P.DONATIONS_MANAGE)) && authorized;
  const canUseDonations     = Boolean(capabilities.donations);
  const isSuperAdmin        = role === 'super_admin';
  const hasHelperAdmins     = Boolean(capabilities.helperAdmins);
  const canEditOwnAccount   = Boolean(capabilities.adminAccount);
  const showAdminManage     = isSuperAdmin && hasHelperAdmins;
  const showAdminSelf       = !isSuperAdmin && canEditOwnAccount;

  const accentActive = isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white';
  const accentBtn    = isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500';

  const sideBtn    = 'w-10 h-10 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all';
  const sideBtnOn  = `${sideBtn} bg-gray-700 hover:bg-gray-600`;

  const menuItems = [
    {
      key: 'stats',
      node: (
        <PrivilegeGate locked={!canViewStats} lang={lang} inline>
          <button onClick={handleOpenStats} className={sideBtnOn} title={t('statsBtn')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </button>
        </PrivilegeGate>
      ),
    },
    {
      key: 'settings',
      node: (
        <PrivilegeGate locked={!canAccessSettings} lang={lang} inline>
          <button onClick={handleOpenSettings} className={sideBtnOn} title={t('settingsBtn')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.14.73.21 1.11.21H21a2 2 0 1 1 0 4h-.09c-.38 0-.75.07-1.11.21Z"/></svg>
          </button>
        </PrivilegeGate>
      ),
    },
    canEditLibrary && {
      key: 'textEditor',
      node: (
        <PrivilegeGate locked={!canEditLyrics} lang={lang} inline>
          <button onClick={() => setTextEditorOpen(true)} className={sideBtnOn} title={t('textEditorBtn')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </PrivilegeGate>
      ),
    },
    canUploadTracks && {
      key: 'uploadSongs',
      node: (
        <PrivilegeGate locked={!canUploadSongs} lang={lang} inline>
          <button onClick={() => setUploadSongsOpen(true)} className={sideBtnOn} title={t('uploadSongsBtn')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/></svg>
          </button>
        </PrivilegeGate>
      ),
    },
    canUploadArtwork && {
      key: 'uploadArts',
      node: (
        <PrivilegeGate locked={!canUploadArts} lang={lang} inline>
          <button onClick={() => setUploadArtsOpen(true)} className={sideBtnOn} title={t('uploadArtsBtn')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300"><rect x="3" y="4" width="18" height="14" rx="2" ry="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 15l-4.5-4.5L8 19"/></svg>
          </button>
        </PrivilegeGate>
      ),
    },
    canUseJingles && {
      key: 'jingles',
      node: (
        <PrivilegeGate locked={!canJingles} lang={lang} inline>
          <button onClick={() => setJinglesOpen(true)} className={sideBtnOn} title={t('jinglesBtn')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </button>
        </PrivilegeGate>
      ),
    },
    showAdminManage && {
      key: 'adminManage',
      node: (
        <button onClick={() => setAdminManageOpen(true)} className={sideBtnOn} title={t('manageAdmins')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </button>
      ),
    },
    showAdminSelf && {
      key: 'adminSelf',
      node: (
        <button onClick={() => setAdminSelfOpen(true)} className={sideBtnOn} title={t('adminSettingsBtn')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </button>
      ),
    },
    canOpenModeratorPanel && {
      key: 'moderatorPanel',
      node: (
        <button onClick={() => setModeratorPanelOpen(true)} className={sideBtnOn} title={t('moderatorPanelBtn')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
          </svg>
        </button>
      ),
    },
  ].filter(Boolean);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen transition-colors duration-1000 ${isNight ? 'bg-[#0f0505]' : 'bg-gray-900'}`}
      style={{ fontFamily: "'Segoe UI', Roboto, sans-serif" }}
    >
      {localTime && (
        <div className="fixed top-3 right-4 z-50 flex items-center gap-1.5 select-none pointer-events-none">
          <span className="text-xs text-gray-500 font-mono">{localTime}</span>
          <span className="text-[10px] text-gray-600 font-sans">{(timeZone.split('/').pop() || timeZone).replace(/_/g, ' ')}</span>
        </div>
      )}
      <div className="fixed left-6 rtl:left-auto rtl:right-6 bottom-6 z-50 flex flex-col-reverse gap-2 items-start">
        <ModeSwitchControls
          isNight={isNight}
          nightMode={nightMode}
          lang={lang}
          t={t}
          canSwitchMode={canSwitchMode}
          modeConfirmOpen={modeConfirmOpen}
          setModeConfirmOpen={setModeConfirmOpen}
          switchImmediately={switchImmediately}
          setSwitchImmediately={setSwitchImmediately}
          scheduledTime={scheduledTime}
          setScheduledTime={setScheduledTime}
          scheduledTimeError={scheduledTimeError}
          modeSwitchPending={modeSwitchPending}
          handleSwitchMode={handleSwitchMode}
          modeNotif={modeNotif}
        />

        <SideMenu
          menuItems={menuItems}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          sideBtnOn={sideBtnOn}
          t={t}
        />

      </div>

      <ModeratorPanel
        open={moderatorPanelOpen && canOpenModeratorPanel}
        onClose={() => setModeratorPanelOpen(false)}
        isNight={isNight}
        lang={lang}
        showToast={showToast}
        canModerate={canModerateRadio}
        socketRef={socketRef}
      />

      {radioHostsMode && canBeRadioHost && (
        <HostControlPanel
          isNight={isNight}
          lang={lang}
          showToast={showToast}
          socketRef={socketRef}
        />
      )}

<AdminManageModal open={adminManageOpen && showAdminManage} onClose={() => setAdminManageOpen(false)} isNight={isNight} lang={lang} showToast={showToast} socketRef={socketRef} radioHostsMode={radioHostsMode} streamMode={streamMode} />
      <AdminSelfModal open={adminSelfOpen && canEditOwnAccount} onClose={() => setAdminSelfOpen(false)} isNight={isNight} lang={lang} showToast={showToast} authorized={authorized} login={adminLogin}
        onActivated={() => { setAuthorized(true); setAdminSelfOpen(false); }} />
      <ArtistArtsUploadModal open={uploadArtsOpen && canUploadArts && canUploadArtwork} onClose={() => setUploadArtsOpen(false)} lang={lang} isNight={isNight} showToast={showToast} privileges={privileges} nightMode={nightMode} />
      <JinglesModal open={jinglesOpen && canJingles && canUseJingles} onClose={() => setJinglesOpen(false)} lang={lang} isNight={isNight} showToast={showToast} nightMode={nightMode} radioHostsMode={radioHostsMode} />
      <UploadSongsModal open={uploadSongsOpen && canUploadSongs && canUploadTracks} onClose={() => setUploadSongsOpen(false)} isNight={isNight} lang={lang} showToast={showToast} onUploaded={refreshSongLibrary} privileges={privileges} nightMode={nightMode} capabilities={capabilities} onEditSong={(songId) => { setEditSongId(songId); setUploadSongsOpen(false); }}/>
      <SongEditorModal open={canEditLibrary && ((textEditorOpen && canEditLyrics) || Boolean(editSongId))} initialSongId={editSongId} onClose={() => { setEditSongId(null); setTextEditorOpen(false); }} isNight={isNight} lang={lang} showToast={showToast} lockedTrackIds={[queue.current?.id, queue.upcoming?.[0]?.id].filter(Boolean)} onLibraryChanged={refreshSongLibrary} capabilities={capabilities} privileges={privileges} nightMode={nightMode} />
      <SettingsModal open={settingsOpen && canAccessSettings} onClose={handleCloseSettings} isNight={isNight} lang={lang} showToast={showToast} privileges={privileges} nightMode={nightMode} streamMode={streamMode} radioHostsMode={radioHostsMode} readOnly={!canSaveSettings} />
      <StatsModal open={statsOpen && canViewStats} onClose={() => setStatsOpen(false)} isNight={isNight} lang={lang} statsData={statsData} statsLoading={statsLoading} nightMode={nightMode} />
      <AuditLogModal open={auditLogOpen && canViewAuditLog} onClose={() => setAuditLogOpen(false)} isNight={isNight} lang={lang} socketRef={socketRef} streamMode={streamMode} radioHostsMode={radioHostsMode} canViewHistory={canViewStats} />
      <DonationSettingsModal open={donationSettingsOpen && canManageDonations && canUseDonations} onClose={() => setDonationSettingsOpen(false)} isNight={isNight} lang={lang} showToast={showToast} radioHostsMode={radioHostsMode} />
      <div className="fixed top-3 left-4 z-50">
        <LangSwitcher lang={lang} onChange={handleLangChange} isNight={isNight} align="left" />
      </div>

      {canViewAuditLog && <div className="fixed bottom-6 end-6 z-50">
        <button
          onClick={() => setAuditLogOpen(true)}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all bg-gray-700 hover:bg-gray-600`}
          title={translate('auditLog.title', {}, lang)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </button>
      </div>}

      {canManageDonations && canUseDonations && (
        <div className={`fixed end-6 z-50 ${canViewAuditLog ? 'bottom-20' : 'bottom-6'}`}>
          <button
            onClick={() => setDonationSettingsOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all bg-gray-700 hover:bg-gray-600"
            title={translate('donationSettings.title', {}, lang)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v10M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2c0 1.5-2.5 1.5-2.5 3M9.5 14.5c0 1.2 1.1 2 2.5 2s2.5-.8 2.5-2"/>
            </svg>
          </button>
        </div>
      )}

      <header className="pt-16 pb-8 px-8 flex justify-between items-start gap-4 max-w-6xl mx-auto">
        <h1
          className="font-extrabold uppercase tracking-wider leading-tight break-words min-w-0"
          style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.25rem)',
            color: '#ffffff',
            WebkitTextStroke: isNight ? '1px #bc0000' : 'none',
            textShadow: isNight ? '0 0 15px #bc0000' : '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          {t('title', { login: adminLogin || '…' })}
        </h1>
        <button
          onClick={handleLogout}
          className={`flex-shrink-0 px-8 py-3 rounded-xl text-xs text-white font-bold transition-all transform active:scale-95 flex items-center gap-2 shadow-lg ${accentBtn}`}
        >
          {t('exit')}
        </button>
      </header>

      <main className="flex flex-col items-center mt-10 pb-4 px-4 w-full max-w-2xl mx-auto text-white">

        {!authorized && (
          <div className="w-full mb-6 rounded-2xl border border-amber-500/30 bg-amber-900/20 px-5 py-4 text-sm text-amber-300 font-bold text-center">
            {t('activateHint')}
          </div>
        )}

        <div className="flex w-full mb-6 bg-white/5 rounded-xl p-1 border border-white/10">
          {[['library', t('library')], ['queue', t('queue')], ['suggestions', t('suggestions')]].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${
                activeTab === tab
                  ? (tab === 'suggestions' ? 'bg-orange-500 text-white' : accentActive)
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {label}
              {tab === 'suggestions' && suggestions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center border border-black/30">
                  {suggestions.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'library' && (
          <LibraryTab
            isNight={isNight} lang={lang} t={t}
            canManageQueue={canManageQueue}
            addType={addType} setAddType={setAddType}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            songsToShow={songsToShow} hasMore={hasMore}
            filteredSongs={filteredSongs} visibleCount={visibleCount} setVisibleCount={setVisibleCount}
            handleAirClick={handleAirClick} cooldownAdd={cooldownAdd}
            pageSize={PAGE_SIZE}
          />
        )}

        {activeTab === 'queue' && (
          <QueueTab
            isNight={isNight} lang={lang} t={t}
            queue={queue} isModeTransition={isModeTransition} canManageQueue={canManageQueue}
            handleSkipClick={handleSkipClick} cooldownSkip={cooldownSkip}
            queueSearch={queueSearch} setQueueSearch={setQueueSearch} queueSearchRef={queueSearchRef}
            upcomingToShow={upcomingToShow} handleRemoveClick={handleRemoveClick} cooldownRemove={cooldownRemove}
            queueOffset={queueOffset} queueTotal={queueTotal} loadMoreQueue={loadMoreQueue} queueLoading={queueLoading}
            pageSize={PAGE_SIZE}
          />
        )}

        {activeTab === 'suggestions' && (
          <SuggestionsTab
            isNight={isNight} lang={lang} t={t}
            suggestions={suggestions} canManageQueue={canManageQueue}
            handleSuggestionAction={handleSuggestionAction} cooldownSuggestion={cooldownSuggestion} cooldownAdd={cooldownAdd}
            suggestionTtlMs={SUGGESTION_TTL_MS}
          />
        )}

      </main>

      <Toast notification={notification} lang={lang} t={t} />
      <ScrollToTop isNight={isNight} end="end-6" bottom={
        canViewAuditLog && canManageDonations && canUseDonations ? 'bottom-32'
          : canViewAuditLog || (canManageDonations && canUseDonations) ? 'bottom-20'
          : 'bottom-6'
      } />
      <Footer lang={lang} />
    </div>
  );
};

export default AdminPanel;