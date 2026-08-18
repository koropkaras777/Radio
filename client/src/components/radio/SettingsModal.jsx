import { useState } from 'react';
import { DAY_COLORS, SERVER_URL } from '../../config/constants.js';
import { ColorPicker } from './ColorPicker.jsx';
import { LangSwitcher } from '../shared/LangSwitcher.jsx';

export function SettingsModal({
  open, onClose, th, t, lang, setLang,
  hideLyrics, setHideLyrics, hidePlaylist, setHidePlaylist,
  hideHistory, setHideHistory,
  hideLibrary, setHideLibrary, hideArts, setHideArts,
  dynamicColors, setDynamicColors,
  dayColor, setDayColor, dayTheme, setDayTheme,
  isNight, bibleBlackThemeOverride, streamMode, artsEnabled = true,
}) {
  const [linkCopied, setLinkCopied] = useState(false);

  if (!open) return null;

  const copyStreamLink = async () => {
    try {
      await navigator.clipboard.writeText(`${SERVER_URL}/api/stream/public.mp3`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { }
  };

  const togglers = [
    { label: t('hideLyrics'),    val: hideLyrics,    key: 'radio_hide_lyrics',    set: setHideLyrics   },
    { label: t('hidePlaylist'),  val: hidePlaylist,  key: 'radio_hide_playlist',  set: setHidePlaylist },
    { label: t('hideHistory'),   val: hideHistory,   key: 'radio_hide_history',   set: setHideHistory  },
    { label: t('hideLibrary'),   val: hideLibrary,   key: 'radio_hide_library',   set: setHideLibrary  },
    ...(artsEnabled ? [{ label: t('hideArts'), val: hideArts, key: 'radio_hide_arts', set: setHideArts }] : []),
    { label: t('dynamicColors'), val: dynamicColors, key: 'radio_dynamic_colors', set: setDynamicColors, json: true },
  ];

  return (
    <div
      className={`fixed inset-0 z-[400] flex items-center justify-center ${th.coverBackground} backdrop-blur-sm`}
      onClick={onClose}
    >
      <div
        className={`relative w-80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 ${th.cardSubtle}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className={`absolute top-4 end-4 ${th.controlBtn}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <h2 className={`text-lg font-black ${th.textAccentMuted}`}>{t('settingsTitle')}</h2>

        {togglers.map(({ label, val, key, set, json }) => (
          <label key={label} className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => { const next = !val; set(next); localStorage.setItem(key, json ? JSON.stringify(next) : next); }}
              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${val ? th.checkboxActive : 'border-gray-500 bg-transparent'}`}
            >
              {val && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className={th.settingLabel} onClick={() => { const next = !val; set(next); localStorage.setItem(key, json ? JSON.stringify(next) : next); }}>{label}</span>
          </label>
        ))}

        <div className={`flex items-center justify-start gap-2 pt-2 mt-2 border-t ${th.settingsBorder}`}>
          <LangSwitcher lang={lang} onChange={setLang} align="left" th={th} />
        </div>

        {streamMode && (
          <div className={`pt-2 border-t ${th.settingsBorder}`}>
            <p className={th.settingsSectionLabel}>{t('publicStreamLabel')}</p>
            <button
              onClick={copyStreamLink}
              className={`w-full py-1.5 rounded-lg text-xs font-black transition-all duration-200 ${th.accentActive}`}
            >
              {linkCopied ? t('linkCopied') : t('copyStreamLink')}
            </button>
          </div>
        )}

        <div className={`pt-2 border-t ${th.settingsBorder} ${(isNight || !dynamicColors || bibleBlackThemeOverride) ? 'opacity-40 pointer-events-none' : ''}`}>
          <p className={th.settingsSectionLabel}>{t('dayColorLabel')}</p>
          <ColorPicker
            colors={DAY_COLORS}
            value={dayColor}
            disabled={isNight || bibleBlackThemeOverride}
            getLabel={(color) => t(`color${color.charAt(0).toUpperCase()}${color.slice(1)}`)}
            onChange={(color) => { setDayColor(color); localStorage.setItem('radio_day_color', color); }}
            th={th}
          />
        </div>

        <div className={`pt-2 ${(isNight || bibleBlackThemeOverride) ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex gap-2">
            {[{ id: 'dark', label: t('dayThemeDark') }, { id: 'light', label: t('dayThemeLight') }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setDayTheme(id); localStorage.setItem('radio_day_theme', id); }}
                disabled={isNight || bibleBlackThemeOverride}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all duration-200 ${dayTheme === id ? th.accentActive : th.dayThemeInactive}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}