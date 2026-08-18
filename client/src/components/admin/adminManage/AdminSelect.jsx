import { useState, useEffect, useRef } from 'react';

export function AdminSelect({ admins, value, onChange, loading, t, isNight }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const selected        = admins.find((a) => a.adminId === value) || null;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const borderIdle   = isNight ? 'border-red-900/40'   : 'border-white/15';
  const borderOpen   = isNight ? 'border-red-600'       : 'border-blue-500';
  const dropdownBg   = isNight ? 'bg-[#1a0505]'         : 'bg-gray-800';
  const hoverItem    = isNight ? 'hover:bg-red-900/30'  : 'hover:bg-white/10';
  const activeItem   = isNight ? 'bg-red-700/40'        : 'bg-blue-600/30';

  const placeholder = loading ? '…' : (admins.length === 0 ? t('noAdmins') : t('selectAdmin'));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => admins.length > 0 && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-white/5 border px-3 py-2.5 text-sm text-start transition-colors ${open ? borderOpen : borderIdle} ${admins.length === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selected ? 'text-white font-bold' : 'text-white/30'}>
          {selected ? selected.login : placeholder}
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
        <div className={`absolute z-50 mt-1 w-full rounded-xl border border-white/10 shadow-2xl overflow-hidden ${dropdownBg}`}>
          {admins.map((a) => (
            <button
              key={a.adminId}
              type="button"
              onClick={() => { onChange(a.adminId); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-start transition-colors ${
                a.adminId === value ? activeItem + ' text-white font-black' : 'text-white/80 font-bold ' + hoverItem
              }`}
            >
              <span>{a.login}</span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                a.authorized ? 'bg-emerald-700/40 text-emerald-300' : 'bg-amber-700/40 text-amber-300'
              }`}>
                {a.authorized ? t('authorized') : t('notAuthorized')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}