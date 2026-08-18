import { useState } from 'react';
import { t as translate } from '../../../i18n/index.js';

// ─── PrivilegeGate ──────────────────────────────────────────────────────────
export function PrivilegeGate({ locked, lang, children, inline = false }) {
  const [tipVisible, setTipVisible] = useState(false);
  const msg = translate('common.noAccessLabel', {}, lang);

  if (!locked) return children;

  if (inline) {
    return (
      <div
        className="relative inline-flex"
        title={msg}
        onMouseEnter={() => setTipVisible(true)}
        onMouseLeave={() => setTipVisible(false)}
        onClick={() => setTipVisible((v) => !v)}
      >
        <div className="opacity-40 pointer-events-none select-none">
          {children}
        </div>
        {tipVisible && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none whitespace-nowrap rounded-lg bg-gray-900/95 border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white shadow-xl">
            {msg}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 -translate-y-1 rotate-45 bg-gray-900 border-b border-r border-white/10" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative select-none"
      onMouseEnter={() => setTipVisible(true)}
      onMouseLeave={() => setTipVisible(false)}
      onClick={() => setTipVisible((v) => !v)}
    >
      <div className="opacity-40 pointer-events-none">
        {children}
      </div>
      <div className="absolute top-2 end-2 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 pointer-events-none">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      {tipVisible && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap rounded-lg bg-gray-900/95 border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white shadow-xl">
          {msg}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 -translate-y-1 rotate-45 bg-gray-900 border-b border-r border-white/10" />
        </div>
      )}
    </div>
  );
}