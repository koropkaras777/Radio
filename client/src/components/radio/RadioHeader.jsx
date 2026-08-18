import { VISIBLE_LISTENERS } from '../../config/constants.js';
import { ListenerAvatar } from './ListenerAvatar.jsx';
import { DEFAULT_UI_SETTINGS } from './utils/radioNameUtils.js';

export function RadioHeader({ listeners, uiSettings, localizedTelegramLabel, isNight, dayTheme, dayColor, artToken, lang, t, th }) {
  const sortedListeners  = [...listeners].sort((a, b) => (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0));
  const visibleListeners = sortedListeners.slice(0, VISIBLE_LISTENERS);
  const hiddenListeners  = sortedListeners.slice(VISIBLE_LISTENERS);

  return (
    <div className="relative z-10 flex justify-between items-start mb-4 p-4">
      <div className="flex flex-col items-start">
        <span className={`pb-2 text-[9px] uppercase tracking-[0.2em] font-black ${th.textSubtle}`}>
          {localizedTelegramLabel}
        </span>
        <a
          href={uiSettings.telegram_url || DEFAULT_UI_SETTINGS.telegram_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg bg-[#24A1DE] hover:bg-[#28b1f5]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.287 5.906q-1.168.486-4.666 2.01-.567.225-.595.442c-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294q.39.01.868-.32 3.269-2.206 3.374-2.23c.05-.012.12-.026.166.016s.042.12.037.141c-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8 8 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629q.14.092.27.187c.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.4 1.4 0 0 0-.013-.315.34.34 0 0 0-.114-.217.53.53 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09"/>
          </svg>
        </a>
      </div>

      <div className="flex flex-col items-end relative">
        <span className={`text-[9px] uppercase tracking-[0.2em] font-black px-1 ${th.textDimLabel}`}>
          {t('anonymouslisteners')}
        </span>
        <div className="flex justify-end items-center gap-2 mb-4 pt-2 pe-1 relative">
          {visibleListeners.map((user, i) => (
            <ListenerAvatar key={i} user={user} isNight={isNight} dayTheme={dayTheme} dayColor={dayColor} artToken={artToken} lang={lang} />
          ))}
          {hiddenListeners.length > 0 && (
            <div className="group relative">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${th.hiddenCountBadge}`}>
                +{hiddenListeners.length}
              </div>
              <div className={`absolute end-0 top-full mt-2 w-56 rounded-xl shadow-2xl p-3 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 backdrop-blur-md ${th.hiddenDropdown}`}>
                <p className={`text-[10px] uppercase tracking-wider font-black mb-3 pb-1 border-b ${th.hiddenDropdownHdr}`}>
                  {t('otherListeners')}
                </p>
                <ul className="space-y-3" style={{ maxHeight: '220px', overflowY: 'auto', overflowX: 'visible', paddingLeft: '2px', paddingTop: '2px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(150,150,150,0.3) transparent' }}>
                  {hiddenListeners.map((user, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <ListenerAvatar user={user} isNight={isNight} dayTheme={dayTheme} dayColor={dayColor} size={8} showTooltip={false} artToken={artToken} lang={lang} />
                      <span className={`text-xs font-medium truncate ${th.hiddenName}`}>{user.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}