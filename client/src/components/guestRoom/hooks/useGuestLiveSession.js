import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * @param {import('socket.io-client').Socket|null} socket
 * @param {{ onSessionEnd?: (reason: string) => void }} [opts]
 */
export function useGuestLiveSession(socket, { onSessionEnd } = {}) {
  const [status,    setStatus]    = useState('idle'); // 'idle' | 'connecting' | 'live'
  const [expiresAt, setExpiresAt] = useState(null);
  const [secsLeft,  setSecsLeft]  = useState(null);
  const [error,     setError]     = useState(null);

  const tickerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const handleForceDisconnect = ({ reason } = {}) => {
      clearInterval(tickerRef.current);
      setStatus('idle');
      setExpiresAt(null);
      setSecsLeft(null);
      onSessionEnd?.(reason);
    };
    socket.on('guest_force_disconnect', handleForceDisconnect);
    return () => socket.off('guest_force_disconnect', handleForceDisconnect);
  }, [socket, onSessionEnd]);

  // ── Local countdown, synced from the server-issued expiresAt ───────────────
  useEffect(() => {
    clearInterval(tickerRef.current);
    if (!expiresAt) { setSecsLeft(null); return; }
    const tick = () => setSecsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    tickerRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickerRef.current);
  }, [expiresAt]);

  const connect = useCallback(() => {
    if (!socket || status !== 'idle') return;
    setStatus('connecting');
    setError(null);
    socket.emit('guest_connect', {}, (res) => {
      if (res?.ok) {
        setStatus('live');
        setExpiresAt(res.expiresAt);
      } else {
        setStatus('idle');
        setError(res?.error || null);
      }
    });
  }, [socket, status]);

  const disconnect = useCallback(() => {
    socket?.emit('guest_leave_live');
    clearInterval(tickerRef.current);
    setStatus('idle');
    setExpiresAt(null);
    setSecsLeft(null);
  }, [socket]);

  useEffect(() => () => clearInterval(tickerRef.current), []);

  return { status, secsLeft, error, connect, disconnect };
}