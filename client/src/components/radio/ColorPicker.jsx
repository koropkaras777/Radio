import { useEffect, useRef, useState } from 'react';
import { TW_COLORS } from './utils/theme.js';

export function ColorPicker({ colors, value, disabled, getLabel, onChange, th }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold border transition-all ${th.tileInput} ${th.border}`}
      >
        <span className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: TW_COLORS[value]?.[500] || 'var(--color-accent)' }} />
        <span className="flex-1 text-start truncate">{getLabel(value)}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5l3 3 3-3"/>
        </svg>
      </button>

      {open && (
        <div className={`absolute left-0 right-0 top-full mt-1 z-[200] rounded-xl border shadow-2xl overflow-y-auto max-h-60 ${th.bgPanelCls} ${th.border}`}>
          {colors.map((color) => {
            const isActive = color === value;
            return (
              <button
                key={color}
                type="button"
                onClick={() => { onChange(color); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold transition-all hover:bg-white/10 ${isActive ? th.accentActive : th.textSecondary}`}
              >
                <span className="w-4 h-4 rounded-sm shrink-0 shadow-sm" style={{ backgroundColor: TW_COLORS[color]?.[500] }} />
                {getLabel(color)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}