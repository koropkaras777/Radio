const globFiles = import.meta.glob('./*/*.json');
export const SUPPORTED_LOCALES = Array.from(
  new Set(
    Object.keys(globFiles)
      .map((path) => path.match(/^\.\/([^/]+)\//)?.[1])
      .filter(Boolean)
  )
);

export const DEFAULT_LOCALE = 'uk';

export function getAuthHeaders() {
  const token = sessionStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function pickLocalized(source, lang = DEFAULT_LOCALE) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  if (typeof source !== 'object') return String(source);

  const src = source.localized ?? source;

  if (src[lang]) return src[lang];
  if (src[DEFAULT_LOCALE]) return src[DEFAULT_LOCALE];
  for (const locale of SUPPORTED_LOCALES) {
    if (src[locale]) return src[locale];
  }
  return '';
}

export function parseServerMsg(raw) {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj;
  } catch { }
  return SUPPORTED_LOCALES.reduce(
    (acc, locale) => ({ ...acc, [locale]: raw }),
    { code: null }
  );
}

export function localizeServerMsg(raw, lang = DEFAULT_LOCALE) {
  return pickLocalized(parseServerMsg(raw), lang);
}

export async function apiRequest(url, options = {}, lang = DEFAULT_LOCALE) {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = pickLocalized(data.localized || data.message || data.error || data, lang) || '';
    throw new Error(msg);
  }
  return data;
}