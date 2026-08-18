import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../../../config/constants.js';
import { getLocalizedRadioName } from '../utils/radioNameUtils.js';
import { fetchCover } from '../utils/coverArt.js';

export function useRadioSocket({
  socketRef,
  audioRef,
  encryptedPlayerRef,
  streamMode,
  streamPlayerApiRef,
  tRef,
  lang,
  t,
  uiSettings,

  currentTrack,
  currentMode,
  isJoined,
  isPlaying,

  setIsConnected,
  setIsJoined,
  setArtToken,
  setListenerUidState,
  setSuggestCooldown,
  setAdminOnline,
  setSuggestNotif,
  setListeners,
  setCurrentMode,
  setCurrentTrack,
  setCurrentTitle,
  setCurrentArtist,
  setCurrentAlbum,
  setCurrentYear,
  setCurrentCover,
  setRadioName,
  setPlaylist,
  setIsPlaying,
  setSeek,
  setDuration,       
  setUiSettings,
  setLastTrackKey,
  setIsChatMode,

  artTokenRef,
  artRefreshTimerRef,
  artTokenExpiryRef,
  listenerUidRef,
  isSyncingRef,
  isJoinedRef,
  isPausedRef,
  wasDisconnectedRef,
  hasInitialSyncedRef,
  initialServerSeekRef,
  lastSyncTimeRef,
  lastServerSeekRef,
  serverIsPlayingRef,
  joinTimeRef,
  resumeTimeRef,
  lastTrackKey,

  refreshLibrary,
}) {

  // ── Refs mirroring volatile state used inside long-lived socket handlers ───
  const streamModeRef     = useRef(streamMode);
  const currentTrackRef   = useRef(currentTrack);
  const isPlayingRef      = useRef(isPlaying);
  const currentModeRef    = useRef(currentMode);
  const uiSettingsRef     = useRef(uiSettings);
  const lastTrackKeyRef   = useRef(lastTrackKey);
  const langRef           = useRef(lang);

  useEffect(() => { streamModeRef.current   = streamMode;   }, [streamMode]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { isPlayingRef.current    = isPlaying;    }, [isPlaying]);
  useEffect(() => { currentModeRef.current  = currentMode;  }, [currentMode]);
  useEffect(() => { uiSettingsRef.current   = uiSettings;   }, [uiSettings]);
  useEffect(() => { lastTrackKeyRef.current = lastTrackKey; }, [lastTrackKey]);
  useEffect(() => { langRef.current         = lang;         }, [lang]);

  // ── Socket connection ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    const getListenerUid = () => {
      const match = document.cookie.split(';').map((c) => c.trim().split('=')).find(([k]) => k === 'listenerUid');
      return match ? match[1] : null;
    };
    const setListenerUid = (uid) => {
      const maxAge = 30 * 24 * 60 * 60;
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `listenerUid=${uid}; Max-Age=${maxAge}; SameSite=Lax; Path=/${secure}`;
    };

    socket.on('connect', () => {
      setIsConnected(true);
      if (wasDisconnectedRef.current && isJoinedRef.current && !isPausedRef.current) {
        wasDisconnectedRef.current  = false;
        hasInitialSyncedRef.current = false;
        lastSyncTimeRef.current     = 0;
        if (streamModeRef.current && streamPlayerApiRef?.current) streamPlayerApiRef.current.resume();
      }
      socket.emit('listener_init', getListenerUid());
    });

    socket.on('listener_uid', ({ uid, cooldownSecsLeft, artToken: receivedToken, artTokenExpiresIn }) => {
      setListenerUid(uid);
      listenerUidRef.current = uid;
      setListenerUidState(uid);
      if (cooldownSecsLeft > 0) setSuggestCooldown(cooldownSecsLeft);

      if (receivedToken) {
        artTokenRef.current = receivedToken;
        setArtToken(receivedToken);
        artTokenExpiryRef.current = Date.now() + (artTokenExpiresIn ?? 3600) * 1000;

        clearTimeout(artRefreshTimerRef.current);
        const refreshInMs = Math.max(5000, ((artTokenExpiresIn ?? 3600) - 30) * 1000);
        artRefreshTimerRef.current = setTimeout(() => {
          if (socketRef.current?.connected) socketRef.current.emit('listener_init');
        }, refreshInMs);
      }
    });

    socket.on('suggest_cooldown_update', setSuggestCooldown);
    socket.on('admin_online',            setAdminOnline);
    socket.on('usersUpdate',             setListeners);
    socket.on('library_updated',         refreshLibrary);

    socket.on('stream_track_start', ({ duration, trackId, serverTs }) => {
      if (!streamModeRef.current) return;
      if (duration) setDuration(duration);
      streamPlayerApiRef?.current?.updateTrackStart?.({
        duration        : duration  ?? 0,
        trackId         : trackId   ?? null,
        serverTs        : serverTs  ?? null,
        clientReceivedAt: Date.now(),
      });
    });

    socket.on('stream_jingle_start', () => {
      if (!streamModeRef.current) return;
      streamPlayerApiRef?.current?.updateJingleStart?.();
    });

    socket.on('stream_jingle_end', () => {
      if (!streamModeRef.current) return;
      streamPlayerApiRef?.current?.updateJingleEnd?.();
    });

    socket.on('stream_chat_mode_start', () => {
      if (!streamModeRef.current) return;
      setIsChatMode(true);
    });

    socket.on('stream_chat_mode_end', () => {
      if (!streamModeRef.current) return;
      setIsChatMode(false);
    });

    socket.on('suggestion_result', ({ accepted, auto, song }) => {
      const title = song?.title || '';
      setSuggestNotif(
        accepted ? tRef.current('suggestAccepted', { title })
        : auto   ? tRef.current('suggestExpired', { title })
                 : tRef.current('suggestRejected', { title })
      );
      setTimeout(() => setSuggestNotif(''), 6000);
    });

    socket.on('donation_result', ({ accepted, tier, song }) => {
      const title = song?.title || '';
      setSuggestNotif(
        accepted ? (tier ? tRef.current('donateAcceptedTier', { title, tier }) : tRef.current('donateAccepted', { title }))
                  : tRef.current('donateFailed', { title })
      );
      setTimeout(() => setSuggestNotif(''), 6000);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setAdminOnline(false);
      wasDisconnectedRef.current = true;
    });

    return () => {
      clearTimeout(artRefreshTimerRef.current);
      artRefreshTimerRef.current = null;
      socket.off('library_updated', refreshLibrary);
      socket.disconnect();
      socketRef.current = null;
      setListenerUidState(null);
      if (!streamModeRef.current) {
        encryptedPlayerRef.current?.destroy();
        encryptedPlayerRef.current = null;
      } else {
        streamPlayerApiRef?.current?.disconnect();
      }
    };
  }, []);

  // ── Sync handler - registered once, reads fresh values via refs above ─────
  useEffect(() => {
    if (!socketRef.current) return;

    const handleSync = (state) => {
      if (!audioRef.current) return;
      const {
        track, title, artist, album, year,
        seek: serverSeek, isPlaying: serverIsPlaying,
        playlist: upcoming, mode, isPreparing,
        uiSettings: nextUiSettings, duration: trackDuration,
      } = state;

      if (nextUiSettings) setUiSettings((prev) => ({ ...prev, ...nextUiSettings }));

      if (isPreparing) {
        if (mode) setCurrentMode(mode === 'night' ? 'night' : 'day');
        setRadioName(tRef.current('preparingMode'));
        setCurrentTitle(tRef.current('currentTitle'));
        setCurrentArtist(tRef.current('currentArtist'));
        setCurrentAlbum(tRef.current('currentAlbum'));
        setCurrentCover(null);
        return;
      }

      if (mode) {
        const nm = mode === 'night' ? 'night' : 'day';
        setCurrentMode(nm);
        setRadioName(getLocalizedRadioName(nextUiSettings || uiSettingsRef.current, nm, langRef.current, tRef.current));
      }

      lastServerSeekRef.current = serverSeek;

      setCurrentTitle(title || '');
      setCurrentArtist(artist || '');
      setCurrentAlbum(album || '');
      setCurrentYear(year ?? null);

      if (title && artist && album) {
        const trackKey = `${artist}-${title}`;
        if (trackKey !== lastTrackKeyRef.current) {
          setLastTrackKey(trackKey);
          fetchCover(artist, album, title, year).then(setCurrentCover);
        }
      } else {
        setCurrentCover(null);
        setLastTrackKey('');
      }

      if (!isJoinedRef.current && track && serverSeek !== undefined) {
        initialServerSeekRef.current = serverSeek;
      }

      serverIsPlayingRef.current = !!serverIsPlaying;

      if (track && track !== currentTrackRef.current) {
        setCurrentTrack(track);
        hasInitialSyncedRef.current  = false;
        initialServerSeekRef.current = serverSeek ?? 0;
        setPlaylist(upcoming || []);
        setIsPlaying(!!serverIsPlaying);
        if (streamModeRef.current && isJoinedRef.current && !isPausedRef.current) {
          streamPlayerApiRef?.current?.updateTrackStart?.({
            duration: trackDuration ?? 0,
            trackId : track,
          });
        }
        return;
      }

      setPlaylist(upcoming || []);
      if (!isJoinedRef.current || isPausedRef.current) return;

      // ── Stream mode: audio is managed by StreamPlayer - do NOT touch audioRef ──
      if (streamModeRef.current) {
        streamPlayerApiRef?.current?.updateSeek?.(serverSeek);
        return;
      }

      // ── Sync mode only below this point ──────────────────────────────────
      if (serverIsPlaying !== isPlayingRef.current) {
        setIsPlaying(serverIsPlaying);
        if (!serverIsPlaying && !audioRef.current.paused) audioRef.current.pause();
      }

      // ── Sync mode: full seek/drift logic ─────────────────────────────────
      if (audioRef.current.readyState < 2 || isSyncingRef.current) {
        setSeek(serverSeek);
        return;
      }

      const localSeek = audioRef.current.currentTime;
      const drift     = Math.abs(localSeek - serverSeek);
      const now       = Date.now();

      if (!hasInitialSyncedRef.current) {
        const target = initialServerSeekRef.current ?? serverSeek;
        if (Math.abs(localSeek - target) > 0.5) {
          isSyncingRef.current         = true;
          audioRef.current.currentTime = target;
          setSeek(target);
          hasInitialSyncedRef.current  = true;
          lastSyncTimeRef.current      = now;
          isSyncingRef.current         = false;
          return;
        }
        hasInitialSyncedRef.current = true;
      }

      if (resumeTimeRef.current !== null) {
        if (now - resumeTimeRef.current < 2000) {
          if (drift > 1 && !audioRef.current.paused) {
            isSyncingRef.current         = true;
            audioRef.current.currentTime = serverSeek;
            setSeek(serverSeek);
            lastSyncTimeRef.current      = now;
            resumeTimeRef.current        = null;
            isSyncingRef.current         = false;
            return;
          }
        } else {
          resumeTimeRef.current = null;
        }
      }

      const shouldSkip = now - joinTimeRef.current < 2000 || now - lastSyncTimeRef.current < 2000;
      if (!shouldSkip && drift > 5 && serverIsPlaying) {
        isSyncingRef.current = true;
        requestAnimationFrame(() => {
          if (audioRef.current && !audioRef.current.paused) {
            if (encryptedPlayerRef.current) {
              encryptedPlayerRef.current.seek(serverSeek).catch(() => {});
            } else {
              audioRef.current.currentTime = serverSeek;
            }
            setSeek(serverSeek);
            lastSyncTimeRef.current = now;
          }
          isSyncingRef.current = false;
        });
      } else {
        setSeek(localSeek);
      }
    };

    socketRef.current.on('sync', handleSync);
    return () => socketRef.current?.off('sync', handleSync);
  }, []);
}