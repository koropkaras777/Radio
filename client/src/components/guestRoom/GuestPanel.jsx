import { useCallback } from 'react';
import { useGuestLiveSession } from './hooks/useGuestLiveSession.js';
import { useLiveMicCapture } from './hooks/useLiveMicCapture.js';
import { useLiveMonitorChannel } from './hooks/useLiveMonitorChannel.js';
import { SpeakingIndicator } from './SpeakingIndicator.jsx';
import { pickLocalized } from '../../i18n/serverMessage.js';
import { useNamespace } from '../../i18n/index.js';

/**
 * @param {{ socket: import('socket.io-client').Socket, nickname: string, lang: 'uk'|'en',
 *           onLangChange?: (lang: string) => void, onSessionEnd: (reason: string) => void }} props
 */
export function GuestPanel({ socket, nickname, lang, onSessionEnd }) {
  const t = useNamespace('guestSession', lang);

  const { micOn, micDenied, micLevel, ensureMicAccess, toggleMic, releaseMic } = useLiveMicCapture(socket);

  const handleSessionEnd = useCallback((reason) => {
    releaseMic();
    onSessionEnd?.(reason);
  }, [releaseMic, onSessionEnd]);

  const { status, secsLeft, error, connect, disconnect } = useGuestLiveSession(socket, { onSessionEnd: handleSessionEnd });
  const { roster, setParticipantVolume } = useLiveMonitorChannel(socket, status === 'live');

  const handleConnectClick = useCallback(async () => {
    const granted = await ensureMicAccess();
    if (!granted) return;
    connect();
  }, [ensureMicAccess, connect]);

  const handleDisconnectClick = useCallback(() => {
    disconnect();
    releaseMic();
  }, [disconnect, releaseMic]);

  const minutes = secsLeft != null ? Math.floor(secsLeft / 60) : 0;
  const seconds = secsLeft != null ? secsLeft % 60 : 0;

  return (
    <div className="text-center">
      <h1 className="text-xl font-black text-white mb-1">{t('guestTitle')}</h1>
      <p className="text-sm text-gray-400 mb-5">{nickname}</p>

      {status === 'idle' && (
        <>
          <button
            onClick={handleConnectClick}
            className="w-full py-3 rounded-lg font-black text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95"
          >
            {t('connect')}
          </button>
          {micDenied && <div className="mt-3 text-xs font-bold text-red-400">{t('micDenied')}</div>}
          {error && <div className="mt-3 text-xs font-bold text-red-400">{pickLocalized(error, lang) || t('error')}</div>}
        </>
      )}

      {status === 'connecting' && (
        <div className="py-3 text-sm text-gray-300">{t('connecting')}</div>
      )}

      {status === 'live' && (
        <>
          {secsLeft != null && (
            <div className="mb-4 text-xs font-bold text-gray-400">{t('timeLeft', { m: minutes, s: String(seconds).padStart(2, '0') })}</div>
          )}
          <button
            onClick={toggleMic}
            className={`w-full mb-3 py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
              micOn ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span className="text-xl">{micOn ? '🎙️' : '🔇'}</span>
            {micOn ? t('micOn') : t('micOff')}
            {micOn && <SpeakingIndicator level={micLevel} />}
          </button>

          <div className="mb-3 text-start">
            <div className="text-[11px] font-bold text-gray-400 mb-2">{t('participants')}</div>
            {roster.length === 0 ? (
              <p className="text-xs text-gray-500 italic">{t('noParticipants')}</p>
            ) : (
              <div className="space-y-2">
                {roster.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <SpeakingIndicator level={p.level} />
                    <span className="text-xs font-bold text-white truncate flex-1">{p.login}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      defaultValue={100}
                      onChange={(e) => setParticipantVolume(p.id, Number(e.target.value))}
                      className="w-20 accent-blue-500 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleDisconnectClick}
            className="w-full py-2.5 rounded-lg text-xs font-bold text-red-300 border border-red-800/50 hover:bg-red-900/20 transition-all active:scale-95"
          >
            {t('disconnect')}
          </button>
        </>
      )}
    </div>
  );
}