import { useEffect } from 'react';

export const RTL_LOCALES = new Set(['ar', 'he', 'iw']);

export function isRTL(lang) {
  return RTL_LOCALES.has(lang);
}

export function getDirection(lang) {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

export function applyDirection(lang) {
  document.documentElement.dir = getDirection(lang);
  document.documentElement.lang = lang;
}

export function useDirectionSync(lang) {
  useEffect(() => {
    applyDirection(lang);
  }, [lang]);
}