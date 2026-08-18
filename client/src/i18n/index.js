import { useCallback } from 'react';
import { pickLocalized, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './serverMessage.js';

export { SUPPORTED_LOCALES };

const globModules = import.meta.glob('./*/*.json', { eager: true });

const localeModules = Object.entries(globModules).reduce((acc, [filePath, mod]) => {
  const match = filePath.match(/^\.\/([^/]+)\//);
  if (match) {
    const locale = match[1];
    if (!acc[locale]) acc[locale] = {};
    acc[locale][filePath] = mod;
  }
  return acc;
}, {});

function buildCache() {
  const cache = {};
  for (const locale of SUPPORTED_LOCALES) {
    cache[locale] = {};
    const modules = localeModules[locale] || {};
    for (const filePath in modules) {
      const ns = filePath.match(/([^/]+)\.json$/)?.[1];
      if (!ns) continue;
      const mod = modules[filePath];
      cache[locale][ns] = mod?.default ?? mod;
    }
  }
  return cache;
}

const cache = buildCache();

// ── Pluralization ──────────────────────────────────────────────────────────
const PLURAL_LOCALE_ALIAS = { iw: 'he' };

const pluralRulesCache = new Map();
function getPluralRules(lang) {
  const resolved = PLURAL_LOCALE_ALIAS[lang] || lang;
  if (!pluralRulesCache.has(resolved)) {
    try {
      pluralRulesCache.set(resolved, new Intl.PluralRules(resolved, { type: 'cardinal' }));
    } catch {
      pluralRulesCache.set(resolved, new Intl.PluralRules(DEFAULT_LOCALE, { type: 'cardinal' }));
    }
  }
  return pluralRulesCache.get(resolved);
}

function resolvePluralKey(ns, key, params, locale) {
  if (typeof params.count !== 'number') return key;

  const category = getPluralRules(locale).select(params.count);
  const nsCache = cache[locale]?.[ns] || {};

  if (`${key}_${category}` in nsCache) return `${key}_${category}`;
  if (`${key}_other` in nsCache) return `${key}_other`;
  return key;
}

function resolveParam(value, lang) {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return pickLocalized(value, lang);
  }
  return value;
}

function interpolate(str, params, lang) {
  return String(str).replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in params)) return `{${key}}`;
    const resolved = resolveParam(params[key], lang);
    return resolved == null ? '' : String(resolved);
  });
}

export function t(key, params = {}, lang = DEFAULT_LOCALE) {
  const [ns, ...rest] = key.split('.');
  const baseKey = rest.join('.');
  const locale = cache[lang] ? lang : DEFAULT_LOCALE;

  const resolvedKey = resolvePluralKey(ns, baseKey, params, locale);
  const raw = cache[locale]?.[ns]?.[resolvedKey];

  if (raw === undefined) {
    console.warn(`[i18n] Missing key "${key}" (resolved: "${resolvedKey}") for locale "${locale}"`);
    return key;
  }
  return interpolate(raw, params, locale);
}

export function useNamespace(namespace, lang) {
  return useCallback((key, params = {}) => t(`${namespace}.${key}`, params, lang), [namespace, lang]);
}