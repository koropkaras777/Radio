import { basename } from 'node:path';
import { t } from '../../../../i18n/index.js';
import { sanitizeArtistKey } from '../../shared/artistKey.js';

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

export const areMetadataEqual = (currentMeta, nextMeta) => {
  const normalizeYear = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
  return (
    String(currentMeta?.title  || '').trim() === String(nextMeta?.title  || '').trim() &&
    String(currentMeta?.artist || '').trim() === String(nextMeta?.artist || '').trim() &&
    String(currentMeta?.album  || '').trim() === String(nextMeta?.album  || '').trim() &&
    normalizeYear(currentMeta?.year) === normalizeYear(nextMeta?.year)
  );
};