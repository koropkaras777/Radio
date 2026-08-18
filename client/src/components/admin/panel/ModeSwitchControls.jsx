import { PrivilegeGate } from '../shared/PrivilegeGate.jsx';

// ─── ModeSwitchControls ──────────────────────────────────────────────────────
export function ModeSwitchControls({
  isNight, nightMode, lang, t,
  canSwitchMode,
  modeConfirmOpen, setModeConfirmOpen,
  switchImmediately, setSwitchImmediately,
  scheduledTime, setScheduledTime,
  scheduledTimeError,
  modeSwitchPending,
  handleSwitchMode,
  modeNotif,
}) {
  return (
    <>
      {nightMode && (
      <PrivilegeGate locked={!canSwitchMode} lang={lang} inline>
        <div className={`flex items-center bg-gray-800/60 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg transition-opacity ${modeSwitchPending ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {[{ mode: 'day', icon: '☀️' }, { mode: 'night', icon: '🌙' }].map(({ mode, icon }) => {
            const isActive = isNight ? mode === 'night' : mode === 'day';
            return (
              <button
                key={mode}
                onClick={() => { setSwitchImmediately(true); setModeConfirmOpen(true); }}
                disabled={isActive || modeSwitchPending}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition-all duration-300 ${isActive ? (isNight ? 'bg-red-700 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : 'text-gray-400 hover:text-white'}`}
              >
                {icon}
              </button>
            );
          })}
        </div>
      </PrivilegeGate>
      )}

      {modeConfirmOpen && nightMode && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModeConfirmOpen(false)}
        >
          <div
            className={`w-80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 ${isNight ? 'bg-[#1a0505] border border-red-900/40' : 'bg-gray-800 border border-white/10'}`}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-white font-semibold text-center">{t('switchModeConfirm')}</p>

            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div
                onClick={() => setSwitchImmediately(v => !v)}
                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                  switchImmediately
                    ? (isNight ? 'bg-red-700 border-red-600' : 'bg-blue-600 border-blue-500')
                    : 'border-gray-500 bg-transparent'
                }`}
              >
                {switchImmediately && (
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span
                className={`text-[11px] font-black transition-colors ${switchImmediately ? 'text-gray-200' : 'text-gray-500'}`}
                onClick={() => setSwitchImmediately(v => !v)}
              >
                {t('switchModeImmediately')}
              </span>
            </label>

            <div className="flex flex-col gap-1">
              <div className={`text-[11px] font-black mb-1 ${switchImmediately ? 'text-gray-600' : 'text-gray-300'}`}>
                {t('switchModeAt')}
              </div>
              <input
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                disabled={switchImmediately}
                style={{ colorScheme: 'dark' }}
                className={`w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors font-mono
                  ${switchImmediately
                    ? 'border-white/5 text-gray-600 cursor-not-allowed opacity-40'
                    : scheduledTimeError
                      ? 'border-red-500 focus:border-red-400'
                      : isNight
                        ? 'border-red-900/40 focus:border-red-600'
                        : 'border-white/15 focus:border-blue-500'
                  }`}
              />
              {!switchImmediately && scheduledTimeError && (
                <div className="text-[10px] font-black text-red-400 mt-0.5 pl-0.5">
                  {scheduledTimeError}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center mt-1">
              <button
                onClick={handleSwitchMode}
                disabled={!switchImmediately && !!scheduledTimeError}
                className={`px-5 py-2 rounded-xl text-xs font-black text-white transition-all active:scale-95
                  ${(!switchImmediately && scheduledTimeError)
                    ? 'opacity-30 cursor-not-allowed'
                    : isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
              >
                {t('switchModeYes')}
              </button>
              <button
                onClick={() => setModeConfirmOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-black text-white/70 bg-white/10 hover:bg-white/20 transition-all active:scale-95"
              >
                {t('switchModeNo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modeNotif && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl backdrop-blur-md border ${
            modeNotif.ok
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/80 border-red-500/40 text-red-200'
          }`}>
            {modeNotif.text}
          </div>
        </div>
      )}
    </>
  );
}