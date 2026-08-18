const DEFAULT_UI_SETTINGS = {
  telegram_url: 'https://t.me/+RzdT3M2lQA4hFMA3',
  byLang: {
    uk: { dayRadioName: 'Радіо СМІХУН', nightRadioName: 'Радіо СОСУН', telegramLabel: 'КАНАЛ СМІХУН' },
    en: { dayRadioName: 'Radio SMIHUN', nightRadioName: 'Radio SOSUN', telegramLabel: 'SMIHUN CHANNEL' },
  },
  artistArts: { dayEnabled: true, nightEnabled: true },
};

export { DEFAULT_UI_SETTINGS };

const getLangBranding = (uiSettings, lang) =>
  (uiSettings?.byLang && uiSettings.byLang[lang])
  || (DEFAULT_UI_SETTINGS.byLang && DEFAULT_UI_SETTINGS.byLang[lang])
  || null;

export const getLocalizedRadioName = (uiSettings, mode, lang, t) => {
  const branding = getLangBranding(uiSettings, lang);
  const key = mode === 'night' ? 'nightRadioName' : 'dayRadioName';
  const fallbackKey = mode === 'night' ? 'radioNameNight' : 'radioNameDay';
  return branding?.[key] || t(fallbackKey);
};

export const getLocalizedTelegramLabel = (uiSettings, lang, t) => {
  const branding = getLangBranding(uiSettings, lang);
  return branding?.telegramLabel || t('smihunChannel');
};

export const splitRadioTitle = (title) => {
  const normalized = String(title || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return { left: '', right: '' };

  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 1) {
    const chars  = Array.from(words[0]);
    const middle = Math.ceil(chars.length / 2);
    return { left: chars.slice(0, middle).join(''), right: chars.slice(middle).join('') };
  }
  if (words.length === 2) return { left: words[0], right: words[1] };

  let bestSplitIndex = 1, bestScore = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestScore) { bestScore = diff; bestSplitIndex = i; }
  }
  return { left: words.slice(0, bestSplitIndex).join(' '), right: words.slice(bestSplitIndex).join(' ') };
};