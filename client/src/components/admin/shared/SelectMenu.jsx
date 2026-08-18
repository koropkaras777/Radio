import { useState, useEffect, useRef } from 'react';

export function SelectMenu({ items, value, onChange, getKey, getLabel, placeholder, disabled, isNight }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const selected        = items.find((item) => getKey(item) === value) || null;
  const isDisabled      = disabled || items.length === 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const borderIdle = isNight ? 'border-red-900/40'  : 'border-white/15';
  const borderOpen = isNight ? 'border-red-600'      : 'border-blue-500';
  const dropdownBg = isNight ? 'bg-[#1a0505]'        : 'bg-gray-800';
  const hoverItem  = isNight ? 'hover:bg-red-900/30' : 'hover:bg-white/10';
  const activeItem = isNight ? 'bg-red-700/40'       : 'bg-blue-600/30';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !isDisabled && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg bg-black/20 border px-3 py-2 text-sm text-start transition-colors ${open ? borderOpen : borderIdle} ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selected ? 'text-white font-bold' : 'text-white/30'}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round"
          className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div className={`absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-white/10 shadow-2xl ${dropdownBg}`}>
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full px-3 py-2.5 text-sm text-start transition-colors ${
              !value ? activeItem + ' text-white font-black' : 'text-white/50 font-bold ' + hoverItem
            }`}
          >
            {placeholder}
          </button>
          {items.map((item) => {
            const key = getKey(item);
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(key); setOpen(false); }}
                className={`w-full px-3 py-2.5 text-sm text-start transition-colors ${
                  key === value ? activeItem + ' text-white font-black' : 'text-white/80 font-bold ' + hoverItem
                }`}
              >
                {getLabel(item)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
