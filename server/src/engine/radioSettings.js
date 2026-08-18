import fs from 'node:fs/promises';
import path from 'node:path';
import { LOCALES } from '../i18n/index.js';

export const SETTINGS_FILE_NAME = 'settings.json';

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const createLocalized = (ua, en) => ({ ua, en });

// ── Branding (per-language radio names + Telegram label) ───────
const BRANDING_LOCALE_SEEDS = {
  uk: { dayRadioName: 'Радіо СМІХУН', nightRadioName: 'Радіо СОСУН', telegramLabel: 'КАНАЛ СМІХУН' },
  en: { dayRadioName: 'Radio SMIHUN', nightRadioName: 'Radio SOSUN', telegramLabel: 'SMIHUN CHANNEL' },
};

const seedForLocale = (locale) => BRANDING_LOCALE_SEEDS[locale] || BRANDING_LOCALE_SEEDS.en;

const LEGACY_SUFFIX_TO_LOCALE = { ua: 'uk', en: 'en' };

export const DEFAULT_BRANDING_SETTINGS = Object.freeze({
  telegram_url: 'https://t.me/+RzdT3M2lQA4hFMA3',
  byLang: Object.freeze(
    Object.fromEntries(LOCALES.map((locale) => [locale, Object.freeze({ ...seedForLocale(locale) })]))
  ),
});

const migrateLegacyBranding = (source) => {
  if (!isObject(source)) return null;

  const legacyKeys = [
    'day_radio_name_ua', 'day_radio_name_en',
    'night_radio_name_ua', 'night_radio_name_en',
    'telegram_label_ua', 'telegram_label_en',
  ];
  const hasLegacyFields = legacyKeys.some((key) => typeof source[key] === 'string' && source[key].trim());
  if (!hasLegacyFields) return null;

  const byLang = {};
  for (const [suffix, locale] of Object.entries(LEGACY_SUFFIX_TO_LOCALE)) {
    byLang[locale] = {
      dayRadioName: source[`day_radio_name_${suffix}`] || '',
      nightRadioName: source[`night_radio_name_${suffix}`] || '',
      telegramLabel: source[`telegram_label_${suffix}`] || '',
    };
  }

  return { telegram_url: source.telegram_url, byLang };
};

const sanitizeLangBranding = (entry, fallback = {}) => {
  const source = isObject(entry) ? entry : {};
  const safeFallback = isObject(fallback) ? fallback : {};

  const pick = (key) => {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    const fallbackValue = safeFallback[key];
    return typeof fallbackValue === 'string' ? fallbackValue.trim() : '';
  };

  return {
    dayRadioName: pick('dayRadioName'),
    nightRadioName: pick('nightRadioName'),
    telegramLabel: pick('telegramLabel'),
  };
};

export const sanitizeBrandingSettings = (branding, fallback = DEFAULT_BRANDING_SETTINGS) => {
  const safeFallback = isObject(fallback) ? fallback : DEFAULT_BRANDING_SETTINGS;
  const migrated = migrateLegacyBranding(branding);
  const source = migrated || (isObject(branding) ? branding : {});

  const telegram_url = typeof source.telegram_url === 'string' && source.telegram_url.trim()
    ? source.telegram_url.trim()
    : (safeFallback.telegram_url || DEFAULT_BRANDING_SETTINGS.telegram_url);

  const sourceByLang = isObject(source.byLang) ? source.byLang : {};
  const fallbackByLang = isObject(safeFallback.byLang) ? safeFallback.byLang : {};

  const byLang = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      sanitizeLangBranding(sourceByLang[locale], fallbackByLang[locale] || seedForLocale(locale)),
    ])
  );

  return { telegram_url, byLang };
};

// ── Radio hosts (RADIO_HOSTS_MODE) ────────────────────────────
export const DEFAULT_RADIO_HOSTS_SETTINGS = Object.freeze({
  guestMaxDurationMinutes: 15,
  specialGuestMaxDurationMinutes: 60,
  backgroundMusicMode: 'random',
});

const RADIO_HOSTS_MIN_MINUTES = 1;
const RADIO_HOSTS_MAX_MINUTES = 240;
const BACKGROUND_MUSIC_MODES = ['random', 'hostChoice'];

const sanitizeDurationMinutes = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(RADIO_HOSTS_MAX_MINUTES, Math.max(RADIO_HOSTS_MIN_MINUTES, Math.round(n)));
};

const sanitizeBackgroundMusicMode = (value, fallback) =>
  BACKGROUND_MUSIC_MODES.includes(value) ? value : (BACKGROUND_MUSIC_MODES.includes(fallback) ? fallback : 'random');

export const sanitizeRadioHostsSettings = (radioHosts, fallback = DEFAULT_RADIO_HOSTS_SETTINGS) => {
  const source = isObject(radioHosts) ? radioHosts : {};
  const fallbackSource = isObject(fallback) ? fallback : DEFAULT_RADIO_HOSTS_SETTINGS;

  const fallbackGuest = sanitizeDurationMinutes(
    fallbackSource.guestMaxDurationMinutes,
    DEFAULT_RADIO_HOSTS_SETTINGS.guestMaxDurationMinutes
  );
  const fallbackSpecialGuest = sanitizeDurationMinutes(
    fallbackSource.specialGuestMaxDurationMinutes,
    DEFAULT_RADIO_HOSTS_SETTINGS.specialGuestMaxDurationMinutes
  );
  const fallbackBackgroundMusicMode = sanitizeBackgroundMusicMode(
    fallbackSource.backgroundMusicMode,
    DEFAULT_RADIO_HOSTS_SETTINGS.backgroundMusicMode
  );

  return {
    guestMaxDurationMinutes: sanitizeDurationMinutes(source.guestMaxDurationMinutes, fallbackGuest),
    specialGuestMaxDurationMinutes: sanitizeDurationMinutes(source.specialGuestMaxDurationMinutes, fallbackSpecialGuest),
    backgroundMusicMode: sanitizeBackgroundMusicMode(source.backgroundMusicMode, fallbackBackgroundMusicMode),
  };
};

// ── Artist arts (day/night display toggles) ────────────────────
export const DEFAULT_ARTIST_ARTS_SETTINGS = Object.freeze({
  dayEnabled: true,
  nightEnabled: true,
});

export const sanitizeArtistArtsSettings = (artistArts, fallback = DEFAULT_ARTIST_ARTS_SETTINGS) => {
  const source = isObject(artistArts) ? artistArts : {};
  const fallbackSource = isObject(fallback) ? fallback : DEFAULT_ARTIST_ARTS_SETTINGS;

  const pick = (key) => {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    const fallbackValue = fallbackSource[key];
    return typeof fallbackValue === 'boolean' ? fallbackValue : DEFAULT_ARTIST_ARTS_SETTINGS[key];
  };

  return {
    dayEnabled: pick('dayEnabled'),
    nightEnabled: pick('nightEnabled'),
  };
};

export const sanitizeGroupDefs = (groupDefs, fallback = {}) => {
  const source = isObject(groupDefs) ? groupDefs : fallback;
  return Object.fromEntries(
    Object.entries(source)
      .map(([groupName, artists]) => {
        const cleanGroup = String(groupName || '').trim();
        if (!cleanGroup) return null;

        const cleanArtists = Array.isArray(artists)
          ? [...new Set(artists.map((artist) => String(artist || '').trim()).filter(Boolean))]
          : [];

        return [cleanGroup, cleanArtists];
      })
      .filter(Boolean)
  );
};

export const sanitizeSongGroups = (songGroups, fallback = []) => {
  const source = Array.isArray(songGroups) ? songGroups : fallback;

  return source
    .map((group, index) => {
      const id = String(group?.id || `song-group-${index + 1}`).trim();
      const name = String(group?.name || '').trim();
      const mode = group?.mode === 'night' ? 'night' : 'day';
      const songs = Array.isArray(group?.songs)
        ? [...new Set(group.songs.map((songId) => String(songId || '').trim()).filter(Boolean))]
        : [];

      if (!name) return null;

      return { id, name, mode, songs };
    })
    .filter(Boolean);
};

export const DEFAULT_MAX_DAY_DURATION   = 1 * 60 * 60;
export const DEFAULT_MAX_NIGHT_DURATION =  1 * 60 * 60;
export const DEFAULT_SONGS_PER_SECTION  = 30;

// ── Phrases (voice tags near the end of a song) ─────────────────
export const PHRASES_MIN_TIME_S     = 5;
export const PHRASES_MAX_TIME_S     = 30;
export const PHRASES_DEFAULT_TIME_S = 15;

export const createDefaultSettings = ({
  groupDefs,
  maxDayDuration = DEFAULT_MAX_DAY_DURATION,
  maxNightDuration = DEFAULT_MAX_NIGHT_DURATION,
  songsPerSection = DEFAULT_SONGS_PER_SECTION,
  nightGroupDefs,
  nightSongsPerSection,
  songGroups = [],
  branding = DEFAULT_BRANDING_SETTINGS,
  radioHosts = DEFAULT_RADIO_HOSTS_SETTINGS,
  artistArts = DEFAULT_ARTIST_ARTS_SETTINGS,
}) => ({
  branding: sanitizeBrandingSettings(branding, DEFAULT_BRANDING_SETTINGS),
  generation: {
    USE_ALL_DAY_SONGS: false,
    MAX_DAY_DURATION: maxDayDuration,
    USE_ALL_NIGHT_SONGS: false,
    MAX_NIGHT_DURATION: maxNightDuration,
    DAY_ALGORYTM: false,
    GROUP_DEFS: sanitizeGroupDefs(groupDefs),
    SONGS_PER_SECTION: songsPerSection,
    GROUP_SECTIONS_ALGORYTM: false,
    NIGHT_ALGORYTM: false,
    NIGHT_GROUP_DEFS: sanitizeGroupDefs(nightGroupDefs),
    NIGHT_SONGS_PER_SECTION: nightSongsPerSection ?? songsPerSection,
    NIGHT_GROUP_SECTIONS_ALGORYTM: false,
    JINGLES_ENABLED: false,
    JINGLES_RANDOM: false,
    JINGLES_FREQUENCY: 2,
    PHRASES_ENABLED: false,
    PHRASES_RANDOM: true,
    PHRASES_DEFAULT_TIME: true,
    PHRASES_TIME_SECONDS: PHRASES_DEFAULT_TIME_S,
    PHRASES_DAY_ID: '',
    PHRASES_NIGHT_ID: '',
  },
  radioHosts: sanitizeRadioHostsSettings(radioHosts),
  artistArts: sanitizeArtistArtsSettings(artistArts),
  songGroups: sanitizeSongGroups(songGroups),
});

export const mergeSettings = (rawSettings, defaults) => {
  const safeDefaults = isObject(defaults)
    ? defaults
    : { generation: {}, songGroups: [] };

  const rawGeneration = isObject(rawSettings?.generation)
    ? rawSettings.generation
    : {};

  const mergedGeneration = {
    ...safeDefaults.generation,
    ...rawGeneration,
  };

  mergedGeneration.GROUP_DEFS = sanitizeGroupDefs(
    rawGeneration.GROUP_DEFS,
    safeDefaults.generation?.GROUP_DEFS || {}
  );

  mergedGeneration.NIGHT_GROUP_DEFS = sanitizeGroupDefs(
    rawGeneration.NIGHT_GROUP_DEFS,
    safeDefaults.generation?.NIGHT_GROUP_DEFS || {}
  );

  if (typeof rawGeneration.GROUP_SECTIONS_ALGORYTM === 'undefined') {
    mergedGeneration.GROUP_SECTIONS_ALGORYTM =
      safeDefaults.generation?.GROUP_SECTIONS_ALGORYTM ?? false;
  }

  if (typeof rawGeneration.NIGHT_ALGORYTM === 'undefined') {
    mergedGeneration.NIGHT_ALGORYTM =
      safeDefaults.generation?.NIGHT_ALGORYTM ?? false;
  }

  if (typeof rawGeneration.NIGHT_GROUP_SECTIONS_ALGORYTM === 'undefined') {
    mergedGeneration.NIGHT_GROUP_SECTIONS_ALGORYTM =
      safeDefaults.generation?.NIGHT_GROUP_SECTIONS_ALGORYTM ?? false;
  }

  if (typeof rawGeneration.NIGHT_SONGS_PER_SECTION === 'undefined') {
    mergedGeneration.NIGHT_SONGS_PER_SECTION =
      safeDefaults.generation?.NIGHT_SONGS_PER_SECTION ?? safeDefaults.generation?.SONGS_PER_SECTION;
  }

  if (typeof rawGeneration.JINGLES_ENABLED === 'undefined') {
    mergedGeneration.JINGLES_ENABLED = safeDefaults.generation?.JINGLES_ENABLED ?? false;
  }

  if (typeof rawGeneration.JINGLES_RANDOM === 'undefined') {
    mergedGeneration.JINGLES_RANDOM = safeDefaults.generation?.JINGLES_RANDOM ?? false;
  }

  if (typeof rawGeneration.JINGLES_FREQUENCY === 'undefined') {
    mergedGeneration.JINGLES_FREQUENCY = safeDefaults.generation?.JINGLES_FREQUENCY ?? 2;
  }

  if (typeof rawGeneration.PHRASES_ENABLED === 'undefined') {
    mergedGeneration.PHRASES_ENABLED = safeDefaults.generation?.PHRASES_ENABLED ?? false;
  }

  if (typeof rawGeneration.PHRASES_RANDOM === 'undefined') {
    mergedGeneration.PHRASES_RANDOM = safeDefaults.generation?.PHRASES_RANDOM ?? true;
  }

  if (typeof rawGeneration.PHRASES_DEFAULT_TIME === 'undefined') {
    mergedGeneration.PHRASES_DEFAULT_TIME = safeDefaults.generation?.PHRASES_DEFAULT_TIME ?? true;
  }

  if (typeof rawGeneration.PHRASES_TIME_SECONDS === 'undefined') {
    mergedGeneration.PHRASES_TIME_SECONDS = safeDefaults.generation?.PHRASES_TIME_SECONDS ?? PHRASES_DEFAULT_TIME_S;
  }

  if (typeof rawGeneration.PHRASES_DAY_ID === 'undefined') {
    mergedGeneration.PHRASES_DAY_ID = safeDefaults.generation?.PHRASES_DAY_ID ?? '';
  }

  if (typeof rawGeneration.PHRASES_NIGHT_ID === 'undefined') {
    mergedGeneration.PHRASES_NIGHT_ID = safeDefaults.generation?.PHRASES_NIGHT_ID ?? '';
  }

  return {
    ...safeDefaults,
    ...rawSettings,
    generation: mergedGeneration,
    branding: sanitizeBrandingSettings(
      rawSettings?.branding ?? rawSettings,
      safeDefaults.branding || DEFAULT_BRANDING_SETTINGS
    ),
    radioHosts: sanitizeRadioHostsSettings(
      rawSettings?.radioHosts,
      safeDefaults.radioHosts || DEFAULT_RADIO_HOSTS_SETTINGS
    ),
    artistArts: sanitizeArtistArtsSettings(
      rawSettings?.artistArts,
      safeDefaults.artistArts || DEFAULT_ARTIST_ARTS_SETTINGS
    ),
    songGroups: sanitizeSongGroups(
      rawSettings?.songGroups,
      safeDefaults.songGroups || []
    ),
  };
};

export const getSettingsPath = (rootDir) => path.join(rootDir, SETTINGS_FILE_NAME);

export const loadSettingsFile = async (rootDir, defaults) => {
  const settingsPath = getSettingsPath(rootDir);

  if (!isObject(defaults)) {
    throw new Error('loadSettingsFile requires valid defaults');
  }

  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(String(raw).replace(/^\uFEFF/, ''));
    const merged = mergeSettings(parsed, defaults);
    return merged;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[Settings] Failed to read settings.json, recreating:', error.message);
    }
    await saveSettingsFile(rootDir, defaults);
    return defaults;
  }
};

export const saveSettingsFile = async (rootDir, settings) => {
  if (!isObject(settings)) {
    throw new Error('saveSettingsFile requires valid settings object');
  }

  const settingsPath = getSettingsPath(rootDir);
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return settingsPath;
};