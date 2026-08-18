import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../../config/constants.js';
import { GuestPanel } from './GuestPanel.jsx';
import { SpecialGuestPanel } from './SpecialGuestPanel.jsx';
import { t as rawT, useNamespace } from '../../i18n/index.js';
import { useDirectionSync } from '../../i18n/rtl.js';
import { buildRadioPath } from '../../i18n/localePaths.js';
import { LangSwitcher } from '../shared/LangSwitcher.jsx';

const GUEST_REQUEST_EXPIRE_MS = 60_000;

const KNOWN_ERROR_REASONS = new Set([
  'no_admin', 'room_full', 'special_guest_active',
  'invalid_code', 'expired_code', 'too_many_attempts',
]);

function useBanCheck(socket, ready) {
  const [state, setState] = useState({ checked: false, banned: false });

  useEffect(() => {
    if (!socket || !ready) return;
    let cancelled = false;
    socket.emit('guest_check_ban', {}, (res) => {
      if (cancelled) return;
      setState({ checked: true, banned: Boolean(res?.banned) });
    });
    return () => { cancelled = true; };
  }, [socket, ready]);

  return state;
}

export function GuestLandingPage({ navigate }) {
  const [lang, setLang] = useState(() => localStorage.getItem('radio_lang') || 'uk');
  const handleLangChange = useCallback((l) => {
    setLang(l);
    localStorage.setItem('radio_lang', l);
    const path = buildRadioPath(l, 'guest');
    if (window.location.pathname !== path) window.history.replaceState({}, '', path);
  }, []);
  const t = useNamespace('guestLanding', lang);
  useDirectionSync(lang);

  useEffect(() => {
    document.title = `${rawT('radio.radioNameDay', {}, lang)} - ${t('title')}`;
  }, [lang, t]);

const errorMessage = useCallback(
    (reason) => (reason && KNOWN_ERROR_REASONS.has(reason) ? t(reason) : t('generic')),
    [t]
  );

  const [featureEnabled, setFeatureEnabled] = useState(null);
  const [hostsOnline,    setHostsOnline]    = useState(false);

  const [nickname,  setNickname]  = useState('');
  const [codeMode,  setCodeMode]  = useState(false);
  const [code,      setCode]      = useState('');
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState('');

  const [status,          setStatus]          = useState('idle');
  const [pendingSecsLeft, setPendingSecsLeft]  = useState(0);
  const [sessionEndReason, setSessionEndReason] = useState(null);

  const socketRef      = useRef(null);
  const [socket, setSocket] = useState(null);
  const pendingTimerRef = useRef(null);
  const { checked: banChecked, banned } = useBanCheck(socket, true);

  useEffect(() => {
    if (featureEnabled === false) navigate(buildRadioPath(lang, 'radio'));
  }, [featureEnabled, navigate, lang]);

  // ── Lightweight standalone socket - this page doesn't share App.jsx's ──────
  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;
    setSocket(socket);

    socket.on('radio_hosts_mode', (enabled) => setFeatureEnabled(Boolean(enabled)));
    socket.on('radio_hosts_online', (online) => setHostsOnline(Boolean(online)));

    socket.on('guest_request_result', ({ accepted, auto, reason } = {}) => {
      clearInterval(pendingTimerRef.current);
      if (accepted) {
        setStatus('accepted');
        setError('');
        return;
      }
      setStatus('rejected');
      if (reason) setError(errorMessage(reason));
      else if (auto) setError('');
    });

    return () => {
      clearInterval(pendingTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const startPendingCountdown = useCallback(() => {
    clearInterval(pendingTimerRef.current);
    const startedAt = Date.now();
    setPendingSecsLeft(Math.round(GUEST_REQUEST_EXPIRE_MS / 1000));
    pendingTimerRef.current = setInterval(() => {
      const leftMs = GUEST_REQUEST_EXPIRE_MS - (Date.now() - startedAt);
      if (leftMs <= 0) {
        clearInterval(pendingTimerRef.current);
        setPendingSecsLeft(0);
        return;
      }
      setPendingSecsLeft(Math.ceil(leftMs / 1000));
    }, 1000);
  }, []);

  const handleSessionEnd = useCallback((reason) => {
    setSessionEndReason(reason || 'generic');
    setStatus('session_ended');
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = nickname.trim();
    if (!trimmed || busy || !socketRef.current) return;
    setBusy(true);
    setError('');

    if (codeMode) {
      socketRef.current.emit('special_guest_connect', { code: code.trim(), nickname: trimmed }, (res) => {
        setBusy(false);
        if (res?.ok) {
          setStatus('connected_special');
        } else {
          setError(errorMessage(res?.error));
        }
      });
      return;
    }

    socketRef.current.emit('guest_request', { nickname: trimmed }, (res) => {
      setBusy(false);
      if (res?.ok) {
        setStatus('pending');
        startPendingCountdown();
      } else if (res?.error === 'cooldown') {
        setError(t('cooldown', { count: res.secsLeft ?? 0 }));
      } else {
        setError(errorMessage(res?.error));
      }
    });
  }, [nickname, code, codeMode, busy, t, errorMessage, startPendingCountdown]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (!banChecked || featureEnabled === null) {
    return <CenteredCard lang={lang} onLangChange={handleLangChange}>{t('loading')}</CenteredCard>;
  }

  if (featureEnabled === false) {
    return <CenteredCard lang={lang} onLangChange={handleLangChange}>{t('featureOff')}</CenteredCard>;
  }

  if (banned) {
    return <CenteredCard lang={lang} onLangChange={handleLangChange}>{t('banned')}</CenteredCard>;
  }

  if (status === 'accepted') {
    return (
      <CenteredCard lang={lang} onLangChange={handleLangChange}>
        <GuestPanel socket={socket} nickname={nickname.trim()} lang={lang} onLangChange={handleLangChange} onSessionEnd={handleSessionEnd} />
      </CenteredCard>
    );
  }

  if (status === 'connected_special') {
    return (
      <CenteredCard lang={lang} onLangChange={handleLangChange}>
        <SpecialGuestPanel socket={socket} nickname={nickname.trim()} lang={lang} onLangChange={handleLangChange} onSessionEnd={handleSessionEnd} />
      </CenteredCard>
    );
  }

  if (status === 'session_ended') {
    const message = sessionEndReason === 'timeout' ? t('sessionEndedTimeout')
      : sessionEndReason === 'no_hosts' ? t('sessionEndedNoHosts')
      : sessionEndReason === 'kick' ? t('sessionEndedKick')
      : sessionEndReason === 'ban' ? t('sessionEndedBan')
      : t('sessionEndedGeneric');
    return (
      <CenteredCard lang={lang} onLangChange={handleLangChange}>
        <p className="mb-4">{message}</p>
        <button
          onClick={() => { setStatus('idle'); setSessionEndReason(null); }}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors underline-offset-2 hover:underline"
        >
          {t('backToStart')}
        </button>
      </CenteredCard>
    );
  }

  if (status === 'pending') {
    return <CenteredCard lang={lang} onLangChange={handleLangChange}>{t('pending', { count: pendingSecsLeft })}</CenteredCard>;
  }

  const canSubmit = nickname.trim().length > 0 && (!codeMode || code.trim().length > 0) && !busy;

  return (
    <CenteredCard lang={lang} onLangChange={handleLangChange}>
      <h1 className="text-xl font-black text-white mb-4">{t('title')}</h1>

      {!hostsOnline && (
        <div className="mb-4 rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-3 py-2 text-xs text-yellow-200 text-center">
          {t('noHosts')}
        </div>
      )}

      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={t('nicknamePlaceholder')}
        maxLength={32}
        className="w-full mb-3 rounded-lg bg-gray-900/60 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-gray-500"
      />

      {!codeMode ? (
        <button
          type="button"
          onClick={() => setCodeMode(true)}
          className="mb-4 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors underline-offset-2 hover:underline"
        >
          {t('hasCode')}
        </button>
      ) : (
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('codePlaceholder')}
          className="w-full mb-4 rounded-lg bg-gray-900/60 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 font-mono"
        />
      )}

      {error && (
        <div className="mb-3 text-xs font-bold text-red-400 text-center">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-lg font-black text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      >
        {codeMode ? t('submitCode') : t('submitRequest')}
      </button>
    </CenteredCard>
  );
}

function CenteredCard({ children, lang, onLangChange }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      {lang && onLangChange && (
        <div className="fixed top-4 end-4">
          <LangSwitcher lang={lang} onChange={onLangChange} align="right" />
        </div>
      )}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-800 shadow-2xl p-6 text-center text-sm text-gray-200">
        {children}
      </div>
    </div>
  );
}