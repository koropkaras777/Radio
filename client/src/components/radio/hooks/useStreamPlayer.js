import { useEffect, useRef, useCallback, useState } from 'react';
import { StreamPlayer } from '../utils/streamPlayer.js';

const PING_INTERVAL_MS   = 8_000;
const SEEK_POLL_MS       = 1_000;
const UI_SEEK_INTERVAL   = 250;
const STALL_RECONNECT_MS = 5_000;
const HEARLAG_SMOOTHING = 0.3;
const LYRIC_OFFSET_S = 0;

export function useStreamPlayer({
  audioRef,
  socketRef,
  artToken,
  isJoined,
  isPausedRef,
  setIsPlaying,
  setSeek,
  setDuration,
  setStreamPing,
}) {
  const playerRef = useRef(null);
  const [streamErr, setStreamErr] = useState(null);

  const durationRef     = useRef(0);
  const isPausedLocal   = useRef(false);
  const pingRef         = useRef(0);

  const clockSeekRef    = useRef(0);
  const clockAtRef      = useRef(0);
  const clockReadyRef   = useRef(false);

  const seekRef         = useRef(0);
  const lyricsSeekRef   = useRef(0);
  const jinglePlayingRef = useRef(false);
  const hearLagRef = useRef(0);

  const setDurationRef = useRef(setDuration);
  setDurationRef.current = setDuration;

  const measureHearLag = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isPausedLocal.current) return;
    try {
      const buffered = audio.buffered;
      if (!buffered || buffered.length === 0) return;
      const bufferedAheadS = Math.max(0, buffered.end(buffered.length - 1) - audio.currentTime);
      const oneWayNetworkS = Math.max(0, (pingRef.current || 0) / 1000);
      const measured = bufferedAheadS + oneWayNetworkS;
      if (!Number.isFinite(measured) || measured < 0 || measured >= 30) return;

      hearLagRef.current = hearLagRef.current
        ? hearLagRef.current * (1 - HEARLAG_SMOOTHING) + measured * HEARLAG_SMOOTHING
        : measured;
    } catch { }
  }, [audioRef]);

  const syncServerClock = useCallback((seek, duration) => {
    if (seek == null) return;
    clockSeekRef.current = seek;
    const oneWayMs = Math.max(0, pingRef.current || 0);
    clockAtRef.current    = Date.now() - oneWayMs;
    clockReadyRef.current = true;

    if (duration) {
      durationRef.current = duration;
      setDurationRef.current?.(duration);
    }
  }, []);

  const getBroadcastSeek = useCallback(() => {
    if (!clockReadyRef.current) return 0;
    return clockSeekRef.current + (Date.now() - clockAtRef.current) / 1000;
  }, []);

  const applySeek = useCallback((broadcastSeek) => {
    const heard = Math.max(0, broadcastSeek - hearLagRef.current);
    const dur = durationRef.current || Infinity;
    const clamped = Math.max(0, Math.min(heard, dur));
    seekRef.current = clamped;
    lyricsSeekRef.current = Math.max(0, Math.min(heard + LYRIC_OFFSET_S, dur));
    return clamped;
  }, []);

  const seekRequestSeqRef = useRef(0);

  const pollServerSeek = useCallback(() => {
    if (!socketRef?.current || isPausedLocal.current) return;
    const seq = ++seekRequestSeqRef.current;
    socketRef.current.emit(
      'stream_get_seek',
      Date.now(),
      ({ seek, duration } = {}) => {
        if (seq !== seekRequestSeqRef.current) return;
        syncServerClock(seek, duration);
      }
    );
  }, [socketRef, syncServerClock]);

  const resetClock = useCallback(() => {
    clockReadyRef.current = false;
    clockSeekRef.current  = 0;
    clockAtRef.current    = 0;
    jinglePlayingRef.current = false;
  }, []);

  // ── StreamPlayer - audio only, no seek logic ────────────────────────────────
  useEffect(() => {
    playerRef.current = new StreamPlayer({
      onError: () => setStreamErr('stream_error'),
      onPlaying: () => {
        setStreamErr(null);
        measureHearLag();
        pollServerSeek();
      },
    });

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [pollServerSeek, measureHearLag]);

  // ── Poll server clock + rAF UI ticker ─────────────────────────────────────
  useEffect(() => {
    if (!isJoined) return;

    pollServerSeek();
    measureHearLag();
    const pollId = setInterval(() => {
      measureHearLag();
      pollServerSeek();
    }, SEEK_POLL_MS);

    let rafId;
    let lastUiSeekAt = 0;

    const tick = () => {
      if (clockReadyRef.current && !isPausedLocal.current && !jinglePlayingRef.current) {
        const clamped = applySeek(getBroadcastSeek());
        const now = Date.now();
        if (now - lastUiSeekAt >= UI_SEEK_INTERVAL) {
          lastUiSeekAt = now;
          setSeek(clamped);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      clearInterval(pollId);
      cancelAnimationFrame(rafId);
    };
  }, [isJoined, pollServerSeek, measureHearLag, getBroadcastSeek, applySeek, setSeek]);


  // ── Track change ────────────────────────────────────────────────────────
  const updateTrackStart = useCallback(({ duration = 0 } = {}) => {
    if (duration) {
      durationRef.current = duration;
      setDuration(duration);
    }
    if (isPausedLocal.current) return;

    resetClock();

    const oneWayS = Math.max(0, (pingRef.current || 0) / 1000);
    syncServerClock(oneWayS, duration || undefined);

    pollServerSeek();
  }, [setDuration, resetClock, pollServerSeek, syncServerClock]);

  const updateSeek = useCallback((serverSeek) => {
    if (serverSeek == null || isPausedLocal.current) return;
    syncServerClock(serverSeek);
  }, [syncServerClock]);

  const updateJingleStart = useCallback(() => {
    jinglePlayingRef.current = true;
  }, []);

  const updateJingleEnd = useCallback(() => {}, []);

  useEffect(() => {
    if (!artToken || !audioRef.current) return;
    playerRef.current?.connect(artToken, audioRef.current);
  }, [artToken, audioRef]);

  const join = useCallback(async () => {
    isPausedRef.current   = false;
    isPausedLocal.current = false;
    resetClock();

    const ok = await playerRef.current?.play();
    if (ok) setIsPlaying(true);
    return ok;
  }, [isPausedRef, setIsPlaying, resetClock]);

  const leave = useCallback(() => {
    isPausedRef.current   = true;
    isPausedLocal.current = true;
    resetClock();
    playerRef.current?.flush();
    setIsPlaying(false);
  }, [isPausedRef, setIsPlaying, resetClock]);

  const resume = useCallback(async () => {
    isPausedRef.current   = false;
    isPausedLocal.current = false;
    resetClock();

    const ok = await playerRef.current?.play();
    if (ok) setIsPlaying(true);
    return ok;
  }, [isPausedRef, setIsPlaying, resetClock]);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    resetClock();
    setIsPlaying(false);
  }, [setIsPlaying, resetClock]);

  useEffect(() => {
    if (!artToken) return;
    playerRef.current?.updateToken(artToken);
  }, [artToken]);

  useEffect(() => {
    const handlePageShow = (e) => {
      if (!e.persisted) return;
      resetClock();
      if (isJoined && !isPausedLocal.current) {
        playerRef.current?.play()?.then((ok) => { if (ok) setIsPlaying(true); });
      } else {
        playerRef.current?.disconnect();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [isJoined, resetClock, setIsPlaying]);

  useEffect(() => {
    if (!isJoined) return;
    const id = setInterval(() => {
      if (!socketRef?.current || isPausedLocal.current) return;
      const sent = Date.now();
      socketRef.current.emit('stream_ping', sent, ({ clientTs } = {}) => {
        const rtt = Date.now() - (clientTs ?? sent);
        pingRef.current = rtt / 2;
        if (setStreamPing) setStreamPing(Math.round(rtt / 2));
      });
    }, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isJoined, socketRef, setStreamPing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isJoined) return;

    let stallTimer = null;
    let lastTime = audio.currentTime;

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const scheduleStallCheck = () => {
      clearStallTimer();
      if (isPausedLocal.current) return;
      lastTime = audio.currentTime;
      stallTimer = setTimeout(() => {
        if (isPausedLocal.current || audio.paused) return;
        if (audio.currentTime <= lastTime + 0.05) {
          console.warn('[StreamPlayer] Prolonged stall - reconnecting');
          resetClock();
          playerRef.current?.play()?.then((ok) => { if (ok) setIsPlaying(true); });
        }
      }, STALL_RECONNECT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearStallTimer();
      } else if (!isPausedLocal.current && !audio.paused) {
        scheduleStallCheck();
      }
    };

    audio.addEventListener('waiting', scheduleStallCheck);
    audio.addEventListener('playing', clearStallTimer);
    audio.addEventListener('timeupdate', clearStallTimer);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearStallTimer();
      audio.removeEventListener('waiting', scheduleStallCheck);
      audio.removeEventListener('playing', clearStallTimer);
      audio.removeEventListener('timeupdate', clearStallTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isJoined, audioRef, setIsPlaying, resetClock]);

  // ── Auto-recover from playback errors ─────────────────────────────────────
  useEffect(() => {
    if (!streamErr || !isJoined || isPausedLocal.current) return;

    const id = setTimeout(() => {
      resetClock();
      playerRef.current?.play()?.then((ok) => {
        if (ok) {
          setIsPlaying(true);
          setStreamErr(null);
        }
      });
    }, STALL_RECONNECT_MS);

    return () => clearTimeout(id);
  }, [streamErr, isJoined, resetClock, setIsPlaying]);

  return {
    join,
    leave,
    resume,
    disconnect,
    updateSeek,
    updateTrackStart,
    updateJingleStart,
    updateJingleEnd,
    streamErr,
    playerRef,
    pingRef,
    seekRef,
    lyricsSeekRef,
  };
}