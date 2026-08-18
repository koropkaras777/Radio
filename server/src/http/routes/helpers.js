import { basename } from 'node:path';
import { t, LOCALES } from '../../i18n/index.js';
import { sanitizeArtistKey } from './shared/artistKey.js';

export { sanitizeArtistKey } from './shared/artistKey.js';
export { lyricsStatus }      from './shared/lyricsStatus.js';

export const sanitizeUploadedFilename = (originalName = '') => {
  const base = basename(String(originalName || '').replace(/\\/g, '/')).trim();
  return base
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

export const ensureMp3Filename = (filename) => {
  if (!filename) return '';
  return /\.mp3$/i.test(filename) ? filename : `${filename}.mp3`;
};

export const buildTrackId = (mode, filename) => `${mode}/${filename}`;

export const getLyricsFetchSummary = (entry) => {
  if (!entry || entry.notFound) {
    return {
      status : 'none',
      format : null,
      message: t('lyrics.notFound'),
    };
  }
  return entry.synced
    ? { status: 'synced', format: 'synced', message: t('lyrics.syncedFetched') }
    : { status: 'plain',  format: 'plain',  message: t('lyrics.plainFetched') };
};

export const extractArtistKeyFromFilename = (filename = '') => {
  const safe       = basename(String(filename || '').replace(/\\/g, '/')).trim();
  const withoutExt = safe.replace(/\.[^.]+$/, '');
  const rawArtist  = withoutExt.includes(' - ') ? withoutExt.split(' - ')[0] : withoutExt;
  return sanitizeArtistKey(rawArtist);
};

export const getArtistArtFilename = (artist) =>
  `${sanitizeArtistKey(artist)}.jpg`;

export const isJpegBuffer = (buffer) =>
  Buffer.isBuffer(buffer) &&
  buffer.length > 4 &&
  buffer[0] === 0xff && buffer[1] === 0xd8 &&
  buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;

export const readJpegSize = (buffer) => {
  if (!isJpegBuffer(buffer)) throw new Error('Invalid JPEG');

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (!segmentLength || offset + segmentLength > buffer.length) break;
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof) {
      if (segmentLength < 7) break;
      const height = buffer.readUInt16BE(offset + 3);
      const width  = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }
    offset += segmentLength;
  }
  throw new Error('Failed to read JPEG dimensions');
};

export const areMetadataEqual = (currentMeta, nextMeta) => {
  const normalizeYear = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
  return (
    String(currentMeta?.title  || '').trim() === String(nextMeta?.title  || '').trim() &&
    String(currentMeta?.artist || '').trim() === String(nextMeta?.artist || '').trim() &&
    String(currentMeta?.album  || '').trim() === String(nextMeta?.album  || '').trim() &&
    normalizeYear(currentMeta?.year) === normalizeYear(nextMeta?.year)
  );
};

export const normalizeSingleLineText = (value = '') =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

export const validateLengthField = ({ value, min, max, fieldUa, fieldEn, allowEmpty = false }) => {
  const normalized = normalizeSingleLineText(value);
  const field = { uk: fieldUa, en: fieldEn };
  if (!normalized) {
    if (allowEmpty) return normalized;
    throw Object.assign(new Error(`${fieldEn} is required`), {
      localized: t('validation.fieldRequired', { field }),
    });
  }
  if (normalized.length < min) {
    throw Object.assign(new Error(`${fieldEn} is too short`), {
      localized: t('validation.fieldTooShort', { field, min }),
    });
  }
  if (normalized.length > max) {
    throw Object.assign(new Error(`${fieldEn} is too long`), {
      localized: t('validation.fieldTooLong', { field, max }),
    });
  }
  return normalized;
};

const PER_LANG_BRANDING_FIELDS = [
  { key: 'dayRadioName',   fieldUa: (locale) => `Назва денного радіо (${locale.toUpperCase()})`,  fieldEn: (locale) => `Day radio name (${locale.toUpperCase()})` },
  { key: 'nightRadioName', fieldUa: (locale) => `Назва нічного радіо (${locale.toUpperCase()})`, fieldEn: (locale) => `Night radio name (${locale.toUpperCase()})` },
  { key: 'telegramLabel',  fieldUa: (locale) => `Підпис Telegram (${locale.toUpperCase()})`,      fieldEn: (locale) => `Telegram label (${locale.toUpperCase()})` },
];

export const validateBrandingSettingsPayload = (payload = {}, locales = LOCALES) => {
  const source = payload.branding && typeof payload.branding === 'object' ? payload.branding : payload;

  const telegram_url = validateLengthField({
    value: source.telegram_url,
    fieldUa: 'Telegram URL',
    fieldEn: 'Telegram URL',
    min: 2,
    max: 50,
  });

  const sourceByLang = source.byLang && typeof source.byLang === 'object' ? source.byLang : {};

  const byLang = {};
  for (const locale of locales) {
    const entry = sourceByLang[locale] || {};
    byLang[locale] = {};
    for (const { key, fieldUa, fieldEn } of PER_LANG_BRANDING_FIELDS) {
      byLang[locale][key] = validateLengthField({
        value: entry[key],
        fieldUa: fieldUa(locale),
        fieldEn: fieldEn(locale),
        min: 2,
        max: 25,
      });
    }
  }

  return { ...payload, branding: { telegram_url, byLang } };
};