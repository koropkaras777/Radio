import { t as translate } from '../../../i18n/index.js';

// ─── MediaTabBar ─────────────────────────────────────────────────────────────
export function MediaTabBar({ activeTab, onChange, locked, isNight, lang, showBackgroundMusic = true }) {
  const tabs = [
    { key: 'jingle', label: translate('jinglesModalJingle.tabLabel', {}, lang) },
    ...(showBackgroundMusic ? [{ key: 'backgroundMusic', label: translate('jinglesModalBackgroundMusic.tabLabel', {}, lang) }] : []),
    { key: 'phrase', label: translate('jinglesModalPhrase.tabLabel', {}, lang) },
  ];
  const accentText = isNight ? 'text-red-400' : 'text-blue-400';

  return (
    <div className="flex items-center gap-1" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            disabled={locked && !active}
            onClick={() => !locked && onChange(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              active
                ? `${accentText} bg-white/10`
                : locked
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}