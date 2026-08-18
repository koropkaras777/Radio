import { TIME_ZONE } from '../config/env.js';
import { basename } from 'path';
import { t, makeError } from '../i18n/index.js';

// ─── Entry helpers ────────────────────────────────────────────────────────────
export const entryId = (entry) => (entry && typeof entry === 'object' ? entry.id : entry);
export const shuffleArray = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
export const localTimeParts = (date) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  });
  const [h, m, s] = fmt.format(date).split(':').map(Number);
  return { hour: h, minute: m, second: s, totalSeconds: h * 3600 + m * 60 + s };
};

// ─── Artist / group helpers ───────────────────────────────────────────────────
const SEPARATORS = /[<>:"/\\|?*_\-\s‐-―]+/g;

export const foldForArtistMatch = (value) =>
  String(value || '').toLowerCase().replace(SEPARATORS, ' ').trim();

export const buildArtistIndices = (groupDefs) => {
  const artistIndex      = new Map();
  const artistGroupIndex = new Map();
  for (const [group, artists] of Object.entries(groupDefs)) {
    for (const a of artists) {
      const key = foldForArtistMatch(a);
      if (!key) continue;
      artistIndex.set(key, a);
      artistGroupIndex.set(key, group);
    }
  }
  return { artistIndex, artistGroupIndex };
};

export const resolveArtist = (file, artistIndex) => {
  if (!file) return 'Unknown';
  const folded = foldForArtistMatch(basename(file));
  for (const [key, canonical] of artistIndex) {
    if (folded.includes(key)) return canonical;
  }
  const name = basename(file);
  return name.includes(' - ') ? name.split(' - ')[0].trim() : name;
};

export const resolveGroup = (file, artistGroupIndex, fallbackGroup = 'D2') => {
  const folded = foldForArtistMatch(file);
  for (const [key, g] of artistGroupIndex) {
    if (folded.includes(key)) return g;
  }
  return fallbackGroup;
};

// ─── Song ID helpers ──────────────────────────────────────────────────────────
export const getSongIdMode = (songId) => {
  if (typeof songId !== 'string' || !songId.includes('/')) return null;
  return songId.split('/')[0];
};

export const getSongFilename = (songId) => {
  if (typeof songId !== 'string' || !songId.includes('/')) return songId;
  return songId.split('/').slice(1).join('/');
};

export const createDefaultSongGroupId = () =>
  `song-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Localization helpers ─────────────────────────────────────────────────────
export const toLocalizedError = (key, params = {}) => t(key, params);

export const localizedText = (key, params = {}) => t(key, params);

export const parseMaybeLocalizedError = (error, fallbackKey = 'common.somethingWentWrong', params = {}) => {
  if (!error) return t(fallbackKey, params);
  if (error.localized) return error.localized;
  if (typeof error.message === 'string') {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object' && (parsed.uk || parsed.ua) && parsed.en) {
        return { ...parsed, uk: parsed.uk ?? parsed.ua };
      }
    } catch {}
    return { uk: error.message, en: error.message };
  }
  return t(fallbackKey, params);
};

export const makeLocalizedError = (key, params = {}, code = 'SETTINGS_ERROR') =>
  makeError(key, params, { code });
