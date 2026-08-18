import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const LOCALES = fs.readdirSync(__dirname, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

const cache = {};

for (const locale of LOCALES) {
  const dir = path.join(__dirname, locale);
  cache[locale] = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const ns = path.basename(file, '.json');
    cache[locale][ns] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
  }
}

function resolveParam(value, localeKey) {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    if (localeKey in value) return value[localeKey];
    for (const loc of LOCALES) {
      if (loc in value) return value[loc];
    }
    return '';
  }
  return value;
}

function interpolate(str, params, localeKey) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => {
    if (!(k in params)) return `{${k}}`;
    const resolved = resolveParam(params[k], localeKey);
    return resolved == null ? '' : String(resolved);
  });
}

export function t(key, params = {}) {
  const [ns, ...rest] = key.split('.');
  const k = rest.join('.');
  const result = {};
  for (const locale of LOCALES) {
    const raw = cache[locale]?.[ns]?.[k];
    if (raw === undefined) {
      console.warn(`[i18n] Missing key "${key}" for locale "${locale}"`);
    }
    result[locale] = interpolate(raw ?? key, params, locale);
  }
  return result;
}

export function withCode(code, key, params = {}) {
  return { code, ...t(key, params) };
}

export function tError(code, params = {}) {
  return withCode(code, `errors.${code}`, params);
}

export function makeError(key, params = {}, { code, cause } = {}) {
  const localized = t(key, params);
  const error = new Error(localized.en || Object.values(localized)[0] || '', cause != null ? { cause } : undefined);
  error.localized = localized;
  if (code) error.code = code;
  return error;
}