import { useState, useRef, useEffect, useCallback } from 'react';
import { createLevelMeter } from '../../utils/audioLevel.js';
import { createWindFilteredStream, MIC_RECORDER_BITS_PER_SECOND } from '../../utils/micProcessing.js';
import { SpeakingIndicator } from '../../guestRoom/SpeakingIndicator.jsx';
import { pickLocalized } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { BackgroundMusicPicker } from './BackgroundMusicPicker.jsx';
import { ParticipantRoster } from './ParticipantRoster.jsx';
import { GuestQueueList } from './GuestQueueList.jsx';

const MIC_CONSTRAINTS = { audio: { echoCancellation: true, autoGainControl: true, noiseSuppression: true, channelCount: 1 } };
const MIC_RECORDER_MIME_TYPE = 'audio/webm;codecs=opus';
const MIC_RECORDER_TIMESLICE_MS = 250;
const MIC_GAIN_MIN = 2.0;
const MIC_GAIN_MAX = 7.0;
const MIC_GAIN_DEFAULT = 5.0;
const MONITOR_STUN_URL = 'stun:stun.l.google.com:19302';
const BACKGROUND_MUSIC_PAGE_SIZE = 5;
const RADIO_MUSIC_STREAM_ID = 'radio-music';
const MIN_PARTICIPANT_VOLUME = 0.08;

export function HostControlPanel({ isNight, lang, showToast, socketRef }) {
  const [expanded, setExpanded]     = useState(false);
  const [connected, setConnected]   = useState(false);
  const [micOn, setMicOn]           = useState(false);
  const [micGain, setMicGain]       = useState(MIC_GAIN_DEFAULT);
  const [queuePaused, setQueuePaused] = useState(false);
  const [micDenied, setMicDenied]   = useState(false);
  const [roster, setRoster]         = useState([]);
  const [pendingGuests, setPendingGuests] = useState([]);
  const [backgroundMusicMode, setBackgroundMusicMode] = useState('random');
  const [selectedBackgroundMusicId, setSelectedBackgroundMusicId] = useState(null);
  const [nowPlayingBackgroundMusic, setNowPlayingBackgroundMusic] = useState(null);
  const [backgroundMusicList, setBackgroundMusicList] = useState(null);
  const [backgroundMusicTotal, setBackgroundMusicTotal] = useState(0);
  const [backgroundMusicLoadingMore, setBackgroundMusicLoadingMore] = useState(false);
  const [backgroundMusicListOpen, setBackgroundMusicListOpen] = useState(false);
  const [guestQueue, setGuestQueue] = useState([]);
  const [queueBusyUid, setQueueBusyUid] = useState(null);
  const [levels, setLevels]         = useState({});
  const [kickConfirmTarget, setKickConfirmTarget] = useState(null);
  const [ownMicLevel, setOwnMicLevel] = useState(0);

  const micStreamRef = useRef(null);
  const processedMicRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const panelRef      = useRef(null);
  const monitorPcRef  = useRef(null); 
  const monitorAudioElsRef = useRef(new Map()); 
  const monitorIceQueueRef = useRef([]); 
  const monitorGenRef      = useRef(0); 
  const desiredVolumesRef  = useRef(new Map()); 
  const trackOwnersRef     = useRef([]);
  const levelMetersRef     = useRef(new Map());
  const ownMicMeterRef     = useRef(null); 

  const t = useNamespace('hostControlPanel', lang);

  const applyDesiredVolume = useCallback((hostId, audioEl) => {
    const pct = desiredVolumesRef.current.get(hostId) ?? 100;
    const v = Math.max(MIN_PARTICIPANT_VOLUME, Math.min(1, pct / 100));
    audioEl.volume = v;
    audioEl.muted = false; 
  }, []);

  const attachParticipantAudio = useCallback((hostId, stream) => {
    let audioEl = monitorAudioElsRef.current.get(hostId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      monitorAudioElsRef.current.set(hostId, audioEl);
    }
    audioEl.srcObject = stream;
    applyDesiredVolume(hostId, audioEl);
    audioEl.play().catch((err) => {
      console.warn(`[HostControlPanel] Monitor autoplay blocked for ${hostId}:`, err);
    });

    if (hostId !== RADIO_MUSIC_STREAM_ID) {
      levelMetersRef.current.get(hostId)?.stop();
      const meter = createLevelMeter(stream);
      if (meter) levelMetersRef.current.set(hostId, meter);
      else levelMetersRef.current.delete(hostId);
    }
  }, [applyDesiredVolume]);

  const detachParticipantAudio = useCallback((hostId) => {
    const audioEl = monitorAudioElsRef.current.get(hostId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      monitorAudioElsRef.current.delete(hostId);
    }
    levelMetersRef.current.get(hostId)?.stop();
    levelMetersRef.current.delete(hostId);
  }, []);

  const handleParticipantVolumeChange = useCallback((hostId, value) => {
    desiredVolumesRef.current.set(hostId, value);
    const audioEl = monitorAudioElsRef.current.get(hostId);
    if (audioEl) applyDesiredVolume(hostId, audioEl);
  }, [applyDesiredVolume]);

  const teardownMonitorPeerConnection = useCallback(() => {
    monitorGenRef.current++;
    for (const hostId of [...monitorAudioElsRef.current.keys()]) detachParticipantAudio(hostId);
    for (const meter of levelMetersRef.current.values()) meter.stop();
    levelMetersRef.current.clear();
    try { monitorPcRef.current?.close(); } catch { }
    monitorPcRef.current = null;
    monitorIceQueueRef.current = [];
  }, [detachParticipantAudio]);

  const createMonitorPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: MONITOR_STUN_URL }] });

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef?.current?.emit('monitor_ice_candidate', e.candidate.toJSON());
    };
    pc.ontrack = (e) => {
      const transceivers = pc.getTransceivers();
      const idx = transceivers.findIndex((tr) => tr.receiver?.track === e.track);
      const ownerId = idx >= 0 ? trackOwnersRef.current[idx] : undefined;
      if (!ownerId) {
        console.warn('[HostControlPanel] Could not resolve owner for incoming monitor track');
        return;
      }
      const stream = e.streams?.[0] || new MediaStream([e.track]);
      attachParticipantAudio(ownerId, stream);
    };

    return pc;
  }, [attachParticipantAudio, socketRef]);

  const initMonitorPeerConnection = useCallback(() => {
    if (monitorPcRef.current) return;
    monitorPcRef.current = createMonitorPeerConnection();
  }, [createMonitorPeerConnection]);

  useEffect(() => {
    if (!connected || !socketRef?.current) return;
    const socket = socketRef.current;

    const handleOffer = async ({ sdp, trackOwners } = {}) => {
      if (!sdp) return;
      const myGen = ++monitorGenRef.current;
      try {
        try { monitorPcRef.current?.close(); } catch { }
        monitorIceQueueRef.current = []; 
        trackOwnersRef.current = Array.isArray(trackOwners) ? trackOwners : [];
        const pc = createMonitorPeerConnection();
        monitorPcRef.current = pc;

        await pc.setRemoteDescription(sdp);
        if (monitorGenRef.current !== myGen) return;

        const queued = monitorIceQueueRef.current;
        monitorIceQueueRef.current = [];
        for (const candidate of queued) {
          if (monitorGenRef.current !== myGen) return;
          try { await pc.addIceCandidate(candidate); } catch (err) {
            console.warn('[HostControlPanel] Queued addIceCandidate failed:', err);
          }
        }
        if (monitorGenRef.current !== myGen) return;

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (monitorGenRef.current !== myGen) return;
        socket.emit('monitor_answer', { sdp: pc.localDescription });
      } catch (err) {
        console.error('[HostControlPanel] Failed to handle monitor_offer:', err);
      }
    };

    const handleRemoteIce = async (candidate) => {
      if (!candidate) return;
      const pc = monitorPcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) {
        monitorIceQueueRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn('[HostControlPanel] addIceCandidate failed:', err);
      }
    };

    socket.on('monitor_offer', handleOffer);
    socket.on('monitor_ice_candidate', handleRemoteIce);
    return () => {
      socket.off('monitor_offer', handleOffer);
      socket.off('monitor_ice_candidate', handleRemoteIce);
    };
  }, [connected, socketRef, createMonitorPeerConnection]);

  // ── Mic-permission gate ────────────────────────────────────────────────────
  const ensureMicAccess = useCallback(async () => {
    if (micStreamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });
      micStreamRef.current = stream;
      processedMicRef.current?.stop();
      processedMicRef.current = createWindFilteredStream(stream);
      ownMicMeterRef.current?.stop();
      ownMicMeterRef.current = createLevelMeter(stream);
      setMicDenied(false);
      return true;
    } catch (err) {
      console.error('[HostControlPanel] getUserMedia denied:', err);
      setMicDenied(true);
      showToast?.(t('micDenied'), 'error');
      return false;
    }
  }, [showToast, t]);

  // ── Connect / go live - reuses the existing admin socket ──────────────────
  const handleConnect = useCallback(async () => {
    const granted = await ensureMicAccess();
    if (!granted) return;

    if (!socketRef?.current) {
      showToast?.(t('noServerConnection'), 'error');
      return;
    }

    socketRef.current.emit('admin_go_live', {}, (res) => {
      if (res?.ok) {
        setConnected(true);
        setExpanded(true);
        setQueuePaused(Boolean(res.queuePaused));
        const selfId = socketRef.current?.id;
        setRoster((Array.isArray(res.hosts) ? res.hosts : []).filter((p) => p.id !== selfId));
        setPendingGuests(Array.isArray(res.pendingGuests) ? res.pendingGuests : []);
        setBackgroundMusicMode(res.backgroundMusicMode === 'hostChoice' ? 'hostChoice' : 'random');
        setSelectedBackgroundMusicId(res.selectedBackgroundMusicId || null);
        initMonitorPeerConnection();
      } else {
        showToast?.(pickLocalized(res?.error, lang) || t('connectFailed'), 'error');
      }
    });
  }, [ensureMicAccess, showToast, lang, socketRef, initMonitorPeerConnection]);

  // ── Mic capture transport ──────────────────────────────────────────────────
  const startMicCapture = useCallback(() => {
    if (!micStreamRef.current || !socketRef?.current) return;
    if (mediaRecorderRef.current) return;

    if (!window.MediaRecorder?.isTypeSupported?.(MIC_RECORDER_MIME_TYPE)) {
      showToast?.(t('micUnsupported'), 'error');
      return;
    }

    try {
      const recorder = new MediaRecorder(processedMicRef.current?.stream ?? micStreamRef.current, {
        mimeType: MIC_RECORDER_MIME_TYPE,
        audioBitsPerSecond: MIC_RECORDER_BITS_PER_SECOND,
      });
      recorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0 || !socketRef.current) return;
        e.data.arrayBuffer().then((buf) => socketRef.current?.emit('host_audio_chunk', buf));
      };
      recorder.start(MIC_RECORDER_TIMESLICE_MS);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('[HostControlPanel] MediaRecorder failed to start:', err);
      showToast?.(t('micUnsupported'), 'error');
    }
  }, [socketRef, showToast, t]);

  const stopMicCapture = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch { }
    mediaRecorderRef.current = null;
  }, []);

  const cleanupLocalLiveState = useCallback(() => {
    stopMicCapture();
    processedMicRef.current?.stop();
    processedMicRef.current = null;
    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    micStreamRef.current = null;
    ownMicMeterRef.current?.stop();
    ownMicMeterRef.current = null;
    teardownMonitorPeerConnection();
    setConnected(false);
    setExpanded(false);
    setMicOn(false);
    setQueuePaused(false);
    setRoster([]);
    setPendingGuests([]);
    setBackgroundMusicList(null);
    setBackgroundMusicTotal(0);
    setBackgroundMusicLoadingMore(false);
    setBackgroundMusicListOpen(false);
  }, [stopMicCapture, teardownMonitorPeerConnection]);

  const handleDisconnect = useCallback(() => {
    socketRef?.current?.emit('admin_leave_live');
    cleanupLocalLiveState();
  }, [socketRef, cleanupLocalLiveState]);

  useEffect(() => () => {
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    processedMicRef.current?.stop();
    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    ownMicMeterRef.current?.stop();
    teardownMonitorPeerConnection();
  }, [teardownMonitorPeerConnection]);

  useEffect(() => {
    if (!connected || !socketRef?.current) return;
    const socket = socketRef.current;
    const handleForceDisconnect = ({ reason } = {}) => {
      cleanupLocalLiveState();
      if (reason === 'kick') {
        showToast?.(t('kickedByModerator'), 'error');
      }
    };
    socket.on('host_force_disconnect', handleForceDisconnect);
    return () => socket.off('host_force_disconnect', handleForceDisconnect);
  }, [connected, socketRef, cleanupLocalLiveState, showToast, lang]);

  const handleMicToggle = useCallback(() => {
    if (!socketRef?.current) return;
    const next = !micOn;
    micStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    if (next) startMicCapture(); else stopMicCapture();
    setMicOn(next);
    socketRef.current.emit('host_mic_toggle', { on: next });
  }, [micOn, socketRef, startMicCapture, stopMicCapture]);

  const micGainEmitPendingRef = useRef(false);
  const handleMicGainChange = useCallback((e) => {
    const value = Number(e.target.value);
    setMicGain(value);
    if (micGainEmitPendingRef.current) return;
    micGainEmitPendingRef.current = true;
    requestAnimationFrame(() => {
      micGainEmitPendingRef.current = false;
      socketRef?.current?.emit('host_mic_gain', { gain: value });
    });
  }, [socketRef]);

  const handleToggleQueuePause = useCallback(() => {
    if (!socketRef.current) return;
    const next = !queuePaused;
    setQueuePaused(next);
    socketRef.current.emit(next ? 'host_pause_queue' : 'host_resume_queue');
  }, [queuePaused]);

  useEffect(() => {
    if (!connected || !socketRef?.current) return;
    const socket = socketRef.current;
    const handlePauseState = ({ paused, denied, reason } = {}) => {
      setQueuePaused(Boolean(paused));
      if (denied && reason === 'donatedInQueue') showToast?.(t('queuePauseDeniedDonated'), 'error');
    };
    socket.on('host_queue_pause_state', handlePauseState);
    return () => socket.off('host_queue_pause_state', handlePauseState);
  }, [connected, socketRef, showToast, t]);

  useEffect(() => {
    if (!connected || !socketRef?.current) {
      setRoster([]);
      return;
    }
    const socket = socketRef.current;
    const handleRoster = (list) => {
      const filtered = (Array.isArray(list) ? list : []).filter((p) => p.id !== socket.id);
      setRoster(filtered);
      const liveIds = new Set(filtered.map((p) => p.id));
      for (const hostId of [...monitorAudioElsRef.current.keys()]) {
        if (hostId === RADIO_MUSIC_STREAM_ID) continue;
        if (!liveIds.has(hostId)) detachParticipantAudio(hostId);
      }
    };
    socket.on('live_hosts_roster', handleRoster);
    return () => socket.off('live_hosts_roster', handleRoster);
  }, [connected, socketRef, detachParticipantAudio]);

  // ── Speaking-indicator polling - separate from the WebRTC signaling effect ──
  useEffect(() => {
    if (!connected) {
      setLevels({});
      return;
    }
    const id = setInterval(() => {
      const next = {};
      for (const [hostId, meter] of levelMetersRef.current) {
        next[hostId] = meter.getLevel();
      }
      setLevels(next);
    }, 120);
    return () => clearInterval(id);
  }, [connected]);

  // ── Own-mic level polling - "your mic is picking up sound" indicator ───────
  useEffect(() => {
    if (!micOn) {
      setOwnMicLevel(0);
      return;
    }
    const id = setInterval(() => {
      setOwnMicLevel(ownMicMeterRef.current?.getLevel() ?? 0);
    }, 120);
    return () => clearInterval(id);
  }, [micOn]);

  // ── Guest room: "approved, not yet connected" indicator (🟡, own request - not in the plan) ──
  useEffect(() => {
    if (!connected || !socketRef?.current) {
      setPendingGuests([]);
      return;
    }
    const socket = socketRef.current;
    const handlePendingStatus = (list) => setPendingGuests(Array.isArray(list) ? list : []);
    socket.on('guest_pending_status', handlePendingStatus);
    return () => socket.off('guest_pending_status', handlePendingStatus);
  }, [connected, socketRef]);

  // ── Background music: stay in sync with other hosts' pick (hostChoice mode) ─
  useEffect(() => {
    if (!connected || !socketRef?.current) return;
    const socket = socketRef.current;
    const handleSelectionChanged = ({ trackId } = {}) => setSelectedBackgroundMusicId(trackId || null);
    socket.on('background_music_selection_changed', handleSelectionChanged);
    return () => socket.off('background_music_selection_changed', handleSelectionChanged);
  }, [connected, socketRef]);

  // ── Background music: dynamic section header while a track is actually playing ─
  useEffect(() => {
    if (!connected || !socketRef?.current) {
      setNowPlayingBackgroundMusic(null);
      return;
    }
    const socket = socketRef.current;
    const handleNowPlaying = ({ filename } = {}) => setNowPlayingBackgroundMusic(filename || null);
    socket.on('background_music_now_playing', handleNowPlaying);
    return () => socket.off('background_music_now_playing', handleNowPlaying);
  }, [connected, socketRef]);

  const loadBackgroundMusicList = useCallback(() => {
    socketRef?.current?.emit('host_get_background_music_list', { offset: 0, limit: BACKGROUND_MUSIC_PAGE_SIZE }, (res) => {
      setBackgroundMusicList(Array.isArray(res?.items) ? res.items : []);
      setBackgroundMusicTotal(Number(res?.total) || 0);
    });
  }, [socketRef]);

  const radioModeRef = useRef(null);
  const backgroundMusicListRef = useRef(null);
  useEffect(() => { backgroundMusicListRef.current = backgroundMusicList; }, [backgroundMusicList]);

  useEffect(() => {
    if (!connected || !socketRef?.current) {
      radioModeRef.current = null;
      return;
    }
    const socket = socketRef.current;
    const handleSync = (state) => {
      const mode = state?.mode === 'night' ? 'night' : 'day';
      if (radioModeRef.current !== null && radioModeRef.current !== mode && backgroundMusicListRef.current !== null) {
        loadBackgroundMusicList();
      }
      radioModeRef.current = mode;
    };
    socket.on('sync', handleSync);
    return () => socket.off('sync', handleSync);
  }, [connected, socketRef, loadBackgroundMusicList]);

  const loadMoreBackgroundMusic = useCallback(() => {
    setBackgroundMusicLoadingMore(true);
    socketRef?.current?.emit('host_get_background_music_list', {
      offset: backgroundMusicList?.length || 0,
      limit: BACKGROUND_MUSIC_PAGE_SIZE,
    }, (res) => {
      setBackgroundMusicLoadingMore(false);
      setBackgroundMusicList((prev) => [...(prev || []), ...(Array.isArray(res?.items) ? res.items : [])]);
      setBackgroundMusicTotal(Number(res?.total) || 0);
    });
  }, [socketRef, backgroundMusicList]);

  const toggleBackgroundMusicList = useCallback(() => {
    setBackgroundMusicListOpen((prev) => {
      const next = !prev;
      if (next && backgroundMusicList === null) loadBackgroundMusicList();
      return next;
    });
  }, [backgroundMusicList, loadBackgroundMusicList]);

  const handleSelectBackgroundMusic = useCallback((trackId) => {
    const next = selectedBackgroundMusicId === trackId ? null : trackId;
    setSelectedBackgroundMusicId(next); 
    socketRef?.current?.emit('host_set_background_music', { trackId: next }, (res) => {
      if (!res?.ok) showToast?.(pickLocalized(res?.error, lang) || t('selectTrackFailed'), 'error');
    });
  }, [selectedBackgroundMusicId, socketRef, showToast, lang]);

  // ── Guest room: incoming connection requests ──
  useEffect(() => {
    if (!connected || !socketRef?.current) {
      setGuestQueue([]);
      return;
    }
    const socket = socketRef.current;
    const handleQueueUpdate = (list) => setGuestQueue(Array.isArray(list) ? list : []);
    socket.on('guest_queue_update', handleQueueUpdate);
    return () => socket.off('guest_queue_update', handleQueueUpdate);
  }, [connected, socketRef]);

  const handleGuestAction = useCallback((uid, action) => {
    if (!socketRef?.current || queueBusyUid) return;
    setQueueBusyUid(uid);
    socketRef.current.emit('admin_guest_action', { uid, action }, (res) => {
      setQueueBusyUid(null);
      if (!res?.ok) {
        showToast?.(pickLocalized(res?.error, lang) || t('guestActionFailed'), 'error');
      }
    });
  }, [socketRef, queueBusyUid, showToast, lang]);

  // ── Guest moderation: mute/kick the live guest/specialGuest in this room ───
  const handleToggleGuestMute = useCallback((targetId, currentlyMuted) => {
    socketRef?.current?.emit('host_guest_mute', { targetId, muted: !currentlyMuted }, (res) => {
      if (!res?.ok) showToast?.(pickLocalized(res?.error, lang) || t('guestMuteFailed'), 'error');
    });
  }, [socketRef, showToast, lang]);

  const handleKickGuest = useCallback((targetId, nickname) => {
    setKickConfirmTarget({ id: targetId, nickname });
  }, []);

  const confirmKickGuest = useCallback(() => {
    if (!kickConfirmTarget) return;
    socketRef?.current?.emit('host_guest_kick', { targetId: kickConfirmTarget.id }, (res) => {
      if (!res?.ok) showToast?.(pickLocalized(res?.error, lang) || t('guestKickFailed'), 'error');
    });
    setKickConfirmTarget(null);
  }, [kickConfirmTarget, socketRef, showToast, lang]);

  // ── Collapse on outside click (in addition to the explicit button) ────────
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (kickConfirmTarget) return; 
      if (panelRef.current && !panelRef.current.contains(e.target)) setExpanded(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded, kickConfirmTarget]);

  const accentBg  = isNight ? 'bg-red-700 hover:bg-red-600'   : 'bg-blue-600 hover:bg-blue-500';
  const cardBg    = isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10';
  const toggleOn  = isNight ? 'bg-red-700 text-white'          : 'bg-blue-600 text-white';
  const toggleOff = 'bg-gray-700 text-gray-300 hover:bg-gray-600';

  // ── Not connected yet: just the entry button, bottom-center ────────────────
  if (!connected) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]">
        <button
          onClick={handleConnect}
          title={t('connect')}
          className={`rounded-full font-black text-sm shadow-2xl transition-all active:scale-95 ${accentBg} text-white flex items-center justify-center gap-2 w-14 h-14 p-0 sm:w-auto sm:h-auto sm:px-5 sm:py-3`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
          </svg>
          <span className="hidden sm:inline">{t('connect')}</span>
        </button>
        {micDenied && (
          <div className="mt-2 text-center text-xs font-bold text-red-400 max-w-xs mx-auto">{t('micDenied')}</div>
        )}
      </div>
    );
  }

  // ── Connected + collapsed: arrow (expand) + mini mic toggle only ───────────
  if (!expanded) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2">
        <button
          onClick={handleMicToggle}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all ${micOn ? toggleOn : toggleOff}`}
          title={micOn ? t('micOn') : t('micOff')}
        >
          {micOn ? '🎙️' : '🔇'}
        </button>
        <button
          onClick={() => setExpanded(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center shadow-xl bg-gray-700 hover:bg-gray-600 active:scale-95 transition-all"
          aria-label="expand"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-300">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>
    );
  }

  // ── Connected + expanded: full panel, slides up from the bottom ────────────
  return (
    <>
    <div
      ref={panelRef}
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[min(92vw,380px)] rounded-2xl border shadow-2xl p-5 transition-all duration-300 ease-out animate-in slide-in-from-bottom-8 fade-in ${cardBg}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-black text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {t('onAir')}
        </span>
        <button onClick={() => setExpanded(false)} className="text-xs font-bold text-gray-400 hover:text-white transition-colors">
          {t('collapse')}
        </button>
      </div>

      <button
        onClick={handleMicToggle}
        className={`w-full mb-3 py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${micOn ? toggleOn : toggleOff}`}
      >
        <span className="text-xl">{micOn ? '🎙️' : '🔇'}</span>
        {micOn ? t('micOn') : t('micOff')}
        {micOn && <SpeakingIndicator level={ownMicLevel} />}
      </button>

      {micOn && (
        <div className="mb-3 px-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-gray-400">{t('micVolume')}</span>
            <span className="text-[11px] font-bold text-gray-400">{Math.round((micGain / MIC_GAIN_MAX) * 100)}%</span>
          </div>
          <input
            type="range"
            min={MIC_GAIN_MIN}
            max={MIC_GAIN_MAX}
            step="0.05"
            value={micGain}
            onChange={handleMicGainChange}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      )}

      <button
        onClick={handleToggleQueuePause}
        className={`w-full mb-3 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${queuePaused ? toggleOn : toggleOff}`}
      >
        {queuePaused ? t('resumeQueue') : t('pauseQueue')}
      </button>

      {backgroundMusicMode === 'hostChoice' && (
        <BackgroundMusicPicker
          isNight={isNight}
          t={t}
          nowPlaying={nowPlayingBackgroundMusic}
          open={backgroundMusicListOpen}
          onToggle={toggleBackgroundMusicList}
          list={backgroundMusicList}
          total={backgroundMusicTotal}
          loadingMore={backgroundMusicLoadingMore}
          onLoadMore={loadMoreBackgroundMusic}
          selectedId={selectedBackgroundMusicId}
          onSelect={handleSelectBackgroundMusic}
        />
      )}

      <ParticipantRoster
        t={t}
        roster={roster}
        pendingGuests={pendingGuests}
        levels={levels}
        onVolumeChange={handleParticipantVolumeChange}
        onToggleMute={handleToggleGuestMute}
        onKick={handleKickGuest}
      />

      <GuestQueueList
        t={t}
        accentBg={accentBg}
        guestQueue={guestQueue}
        queueBusyUid={queueBusyUid}
        onAction={handleGuestAction}
      />

      <button
        onClick={handleDisconnect}
        className="w-full py-2.5 rounded-lg text-xs font-bold text-red-300 border border-red-800/50 hover:bg-red-900/20 transition-all active:scale-95"
      >
        {t('disconnect')}
      </button>
    </div>

    <ConfirmDialog
      open={!!kickConfirmTarget}
      isNight={isNight}
      zIndex={400}
      title={t('kickConfirm', { name: kickConfirmTarget?.nickname })}
      body=""
      yesLabel={t('kickConfirmYes')}
      noLabel={t('kickConfirmNo')}
      yesClassName="bg-red-700 hover:bg-red-600"
      onYes={confirmKickGuest}
      onNo={() => setKickConfirmTarget(null)}
    />
    </>
  );
}