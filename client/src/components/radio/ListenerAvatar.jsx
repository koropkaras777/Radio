import { useEffect, useState } from 'react';
import { SERVER_URL } from '../../config/constants.js';
import { theme } from './utils/theme.js';
import { pickLocalized } from '../../i18n/serverMessage.js';

const avatarCache = {};

function xorDecrypt(arrayBuf, token) {
  const parts  = (token || '').split('.');
  const b64    = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    const keyRaw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (!keyRaw.length) return null;
    const enc = new Uint8Array(arrayBuf);
    const dec = new Uint8Array(enc.length);
    for (let i = 0; i < enc.length; i++) dec[i] = enc[i] ^ keyRaw[i % keyRaw.length];
    return dec;
  } catch {
    return null;
  }
}

export function ListenerAvatar({ user, isNight, dayTheme, dayColor, size = 10, showTooltip = true, artToken, lang }) {
  const displayName = pickLocalized(user.name, lang);
  const nameParts = displayName.split(' ');
  const initials  = nameParts.length > 1 ? nameParts[1][0] : nameParts[0][0];
  const isAdmin       = !!user.isAdmin;
  const isDayDark = !isNight && dayTheme === 'dark';

  const th = theme(isNight, dayTheme, dayColor);

  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (!user.img) { setAvatarUrl(false); return; }
    if (!artToken) { setAvatarUrl(null);  return; }

    const cacheKey = user.img;
    if (cacheKey in avatarCache) { setAvatarUrl(avatarCache[cacheKey]); return; }

    setAvatarUrl(null);
    const controller = new AbortController();

    const fetchAvatar = async () => {
      try {
        const resp = await fetch(
          `${SERVER_URL}/api/avatar/${encodeURIComponent(user.img)}`,
          { headers: { 'X-Art-Token': artToken }, signal: controller.signal }
        );
        if (!resp.ok) throw new Error('not found');

        const buf  = await resp.arrayBuffer();
        const mime = resp.headers.get('X-Art-Mime') || 'image/png';
        const dec  = xorDecrypt(buf, artToken);
        if (!dec) throw new Error('decrypt failed');

        const objUrl = URL.createObjectURL(new Blob([dec], { type: mime }));
        avatarCache[cacheKey] = objUrl;
        setAvatarUrl(objUrl);
      } catch (e) {
        if (e.name !== 'AbortError') {
          avatarCache[cacheKey] = false;
          setAvatarUrl(false);
        }
      }
    };

    fetchAvatar();
    return () => controller.abort();
  }, [user.img, artToken]);

  return (
    <div className="group relative flex items-center justify-center shrink-0" tabIndex="0">
      <div
        className={`w-${size} h-${size} rounded-full overflow-hidden flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95 shadow-sm`}
        style={{
          padding   : isAdmin ? '2px' : '0',
          background: isAdmin ? 'linear-gradient(135deg, #3b82f6, #ef4444)' : 'transparent',
          border    : isAdmin ? 'none' : `2px solid ${isDayDark ? '#ffffff' : th.bgToast}`,
          cursor    : 'pointer',
        }}
      >
        <div
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: user.color }}
        >
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover block"
            />
          )}
          {!avatarUrl && (
            <span className="flex items-center justify-center w-full h-full text-[10px] font-bold">
              {initials}
            </span>
          )}
        </div>
      </div>
      {showTooltip && (
        <div
          className={`absolute -bottom-10 right-0 rtl:right-auto rtl:left-0 px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap z-50 pointer-events-none
            opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0
            group-focus:opacity-100 group-focus:translate-y-0 transition-all duration-200 shadow-lg
            ${th.borderToast} ${th.text}`}
          style={{ backgroundColor: th.bgToast }}
        >
          {displayName}
          <div className="absolute -top-1 right-4 rtl:right-auto rtl:left-4 w-2 h-2 rotate-45" style={{ backgroundColor: th.bgToast }} />
        </div>
      )}
    </div>
  );
}