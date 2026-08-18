import { useEffect, useRef, useState } from 'react';
import { SUPPORTED_LOCALES } from '../../i18n/index.js';

const LOCALE_LABELS = {
  uk: 'Українська', en: 'English', pl: 'Polski', de: 'Deutsch', es: 'Español',
  it: 'Italiano', fr: 'Français', pt: 'Português', nl: 'Nederlands', tr: 'Türkçe',
  ja: '日本語', he: 'עברית', ru: 'Харьковский диалект', zh: '中國人', ko: '한국인',
  hi: 'हिंदी', ar: 'عربي',
};

const ALIGN_CLASSES = {
  left:   'start-0',
  right:  'end-0',
  center: 'left-1/2 -translate-x-1/2',
};

const DROPDOWN_MAX_H = 'max-h-72';

/**
 * @param {{
 *   lang: string,
 *   onChange: (lang: string) => void,
 *   className?: string,
 *   align?: 'left' | 'right' | 'center',
 *   th?: ReturnType<typeof import('../radio/utils/theme.js').theme>,
 *   isNight?: boolean,
 * }} props
 */
export function LangSwitcher({ lang, onChange, className = '', align = 'right', th, isNight }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = LOCALE_LABELS[lang] || lang.toUpperCase();
  const adminMode = isNight !== undefined && !th;

  const triggerCls = th
    ? `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold border transition-all ${th.tileInput} ${th.border}`
    : adminMode
    ? `flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
        isNight ? 'bg-[#1a0505] border-red-900/40 text-red-200 hover:bg-red-950/60' : 'bg-gray-800 border-white/10 text-white/80 hover:bg-white/10'
      }`
    : 'flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white transition-colors';

  const dropdownCls = th
    ? `absolute ${ALIGN_CLASSES[align] || ALIGN_CLASSES.right} z-50 mt-1 min-w-[8rem] rounded-xl border shadow-2xl overflow-hidden ${th.bgPanelCls} ${th.border}`
    : adminMode
    ? `absolute ${ALIGN_CLASSES[align] || ALIGN_CLASSES.right} z-50 mt-1 min-w-[8rem] rounded-lg border shadow-2xl overflow-hidden ${
        isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10'
      }`
    : `absolute ${ALIGN_CLASSES[align] || ALIGN_CLASSES.right} z-50 mt-1 min-w-[8rem] rounded-lg border border-white/10 bg-gray-800 shadow-2xl overflow-hidden`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerCls}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>{label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5l3 3 3-3"/>
        </svg>
      </button>

      {open && (
        <div
          className={`${dropdownCls} ${DROPDOWN_MAX_H} overflow-y-auto [&::-webkit-scrollbar]:hidden`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {SUPPORTED_LOCALES.map((locale) => {
            const active = locale === lang;
            const itemCls = th
              ? `w-full px-3 py-2 text-start text-xs font-bold transition-all hover:bg-white/10 ${active ? th.accentActive : th.textSecondary}`
              : adminMode
              ? `w-full px-3 py-2 text-start text-xs font-bold transition-colors hover:bg-white/10 ${
                  active ? (isNight ? 'bg-red-700/30 text-white' : 'bg-blue-600/30 text-white') : (isNight ? 'text-red-200/70' : 'text-white/70')
                }`
              : `w-full px-3 py-2 text-start text-xs font-bold transition-colors ${active ? 'bg-blue-600/30 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`;
            return (
              <button key={locale} type="button" onClick={() => { onChange(locale); setOpen(false); }} className={itemCls}>
                {LOCALE_LABELS[locale] || locale.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}