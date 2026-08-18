import { useState, useEffect, useRef } from 'react';

export function CurrencySelect({ value, onChange, options, isNight }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const borderIdle = isNight ? 'border-red-900/40' : 'border-white/15';
  const borderOpen = isNight ? 'border-red-600'    : 'border-blue-500';
  const dropBg     = isNight ? 'bg-[#1a0505]'      : 'bg-gray-800';
  const hoverItem  = isNight ? 'hover:bg-red-900/30': 'hover:bg-white/10';
  const activeItem = isNight ? 'bg-red-700/40'      : 'bg-blue-600/30';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg bg-black/20 border px-3 py-2 text-sm text-start transition-colors cursor-pointer ${open ? borderOpen : borderIdle}`}
      >
        <span className="text-white font-bold">{value || '—'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4"/>
        </svg>
      </button>
      {open && (
        <div className={`absolute z-50 mt-1 w-full rounded-xl border border-white/10 shadow-2xl overflow-hidden max-h-48 overflow-y-auto ${dropBg}`}>
          {options.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-full px-3 py-2 text-sm text-start font-bold transition-colors ${
                c === value ? activeItem + ' text-white' : 'text-white/80 ' + hoverItem
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
