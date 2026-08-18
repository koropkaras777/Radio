import { SpeakingIndicator } from '../../guestRoom/SpeakingIndicator.jsx';

// ─── ParticipantRoster ───────────────────────────────────────────────────────
export function ParticipantRoster({
  t,
  roster, pendingGuests, levels,
  onVolumeChange, onToggleMute, onKick,
}) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold text-gray-400 mb-2 px-1">{t('participants')}</div>
      {roster.length === 0 && pendingGuests.length === 0 ? (
        <p className="text-xs text-gray-500 italic px-1">{t('noParticipants')}</p>
      ) : (
        <div className="space-y-2">
          {pendingGuests.map((p) => (
            <div key={`pending-${p.id}`} className="flex items-center gap-2 px-1">
              <span className="shrink-0" aria-hidden="true">🟡</span>
              <span className="text-xs font-bold text-white truncate flex-1">{p.nickname}</span>
              <span className="text-[11px] font-bold text-yellow-400 shrink-0">{t('connecting')}</span>
            </div>
          ))}
          {roster.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-1">
              <span className="shrink-0" aria-hidden="true">🟢</span>
              <SpeakingIndicator level={levels[p.id]} />
              <span className="text-xs font-bold text-white truncate flex-1">{p.login}</span>
              {p.role && p.role !== 'host' && (
                <span className="text-[10px] font-bold text-gray-500 shrink-0">{t('onAir')}</span>
              )}
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={100}
                onChange={(e) => onVolumeChange(p.id, Number(e.target.value))}
                className="w-20 accent-blue-500 cursor-pointer"
              />
              {p.role && p.role !== 'host' && (
                <>
                  <button
                    onClick={() => onToggleMute(p.id, p.muted)}
                    title={p.muted ? t('unmute') : t('mute')}
                    aria-label={p.muted ? t('unmute') : t('mute')}
                    className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-all active:scale-95 ${
                      p.muted ? 'bg-yellow-700' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {p.muted ? '🔇' : '🔊'}
                  </button>
                  <button
                    onClick={() => onKick(p.id, p.login)}
                    title={t('kick')}
                    aria-label={t('kick')}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm bg-red-900/40 hover:bg-red-900/70 transition-all active:scale-95"
                  >
                    ❌
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}