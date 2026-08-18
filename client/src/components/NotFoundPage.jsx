import { useEffect, useState, useCallback } from 'react';
import { t as rawT, useNamespace } from '../i18n/index.js';
import { useDirectionSync } from '../i18n/rtl.js';
import { buildRadioPath } from '../i18n/localePaths.js';

export function NotFoundPage({ navigate }) {
  const [lang, setLang] = useState(() => localStorage.getItem('radio_lang') || 'uk');
  const handleLangChange = useCallback((l) => {
    setLang(l);
    localStorage.setItem('radio_lang', l);
  }, []);
  const t = useNamespace('common', lang);
  useDirectionSync(lang);

  useEffect(() => {
    document.title = `404 - ${rawT('radio.radioNameDay', {}, lang)}`;
  }, [lang]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white px-4">
      <h1
        className="font-extrabold tracking-wider leading-none text-[120px] sm:text-[160px]"
        style={{
          fontFamily: "'Segoe UI', Roboto, sans-serif",
          color: '#3b82f6',
          WebkitTextStroke: '2px rgba(255,255,255,0.15)',
          textShadow: '0 0 40px rgba(59,130,246,0.5)',
        }}
      >
        404
      </h1>

      <p className="mt-4 text-lg font-semibold text-white/80">{t('notFoundMessage')}</p>

      <a
        href={buildRadioPath(lang, 'radio')}
        onClick={(e) => { e.preventDefault(); navigate(buildRadioPath(lang, 'radio')); }}
        className="mt-8 px-8 py-4 rounded-lg text-lg font-semibold bg-blue-600 hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]"
      >
        {t('notFoundBackHome')}
      </a>
    </div>
  );
}
