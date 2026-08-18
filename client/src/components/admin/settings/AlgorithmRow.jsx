import { useState } from 'react';

// ─── AlgorithmRow ────────────────────────────────────────────────────────────
export function AlgorithmRow({ label, hint, info, infoTitle, infoClose, canUse, blockedMsg, blockedLabel, checked, onChange, isNight, t }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const accentBg = isNight ? 'bg-red-700' : 'bg-blue-600';

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-gray-300">{label}</span>
            <button
              onClick={() => setInfoOpen(true)}
              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-gray-400 bg-white/10 hover:bg-white/20 hover:text-white transition-all"
              title={infoTitle}
            >
              ?
            </button>
          </div>
          {blockedMsg && (
            <div className="mt-1 text-[11px] text-red-300">{blockedLabel}: {blockedMsg}</div>
          )}
          <div className="mt-1 text-[11px] text-gray-400">{hint}</div>
        </div>
        <label className="flex items-center gap-2 text-sm shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            disabled={!canUse}
            onChange={(e) => onChange(e.target.checked)}
          />
        </label>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setInfoOpen(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`text-sm font-black mb-3 ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{infoTitle}: {label}</div>
            <p className="text-sm text-gray-300 leading-relaxed">{info}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setInfoOpen(false)}
                className={`rounded-lg px-4 py-2 text-xs font-black text-white ${accentBg}`}
              >
                {infoClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}