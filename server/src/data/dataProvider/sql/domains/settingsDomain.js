import {
  createDefaultSettings, mergeSettings, sanitizeGroupDefs, sanitizeSongGroups,
  sanitizeBrandingSettings, sanitizeRadioHostsSettings, sanitizeArtistArtsSettings,
  PHRASES_MIN_TIME_S, PHRASES_MAX_TIME_S, PHRASES_DEFAULT_TIME_S,
} from '../../../../engine/radioSettings.js';
import { cloneEntry, chunkArray } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';

export class SettingsDomain {
  #db;
  #nightSchemaEnsured = false;
  #cache = null;
  #loaded = false;

  constructor(db) {
    this.#db = db;
  }

  async #ensureNightSettingsSchema() {
    if (this.#nightSchemaEnsured) return;

    await ensureTables(this.#db, 'settings_main', 'group_defs', 'song_groups', 'song_group_items');

    try {
      const mainCols = await this.#db.execute(`PRAGMA table_info(settings_main)`);
      const mainColNames = new Set((mainCols.rows || []).map((row) => row.name));

      if (!mainColNames.has('night_algorithm')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN night_algorithm INTEGER NOT NULL DEFAULT 0`);
      }
      if (!mainColNames.has('night_songs_per_section')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN night_songs_per_section INTEGER NOT NULL DEFAULT 30`);
      }
      if (!mainColNames.has('night_group_sections_algorithm')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN night_group_sections_algorithm INTEGER NOT NULL DEFAULT 0`);
      }
      if (!mainColNames.has('jingles')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN jingles INTEGER NOT NULL DEFAULT 0`);
      }
      if (!mainColNames.has('jingles_random')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN jingles_random INTEGER NOT NULL DEFAULT 0`);
      }
      if (!mainColNames.has('jingles_frequency')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN jingles_frequency INTEGER NOT NULL DEFAULT 2`);
      }
      if (!mainColNames.has('phrases')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN phrases INTEGER NOT NULL DEFAULT 0`);
      }
      if (!mainColNames.has('phrases_random')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN phrases_random INTEGER NOT NULL DEFAULT 1`);
      }
      if (!mainColNames.has('phrases_default_time')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN phrases_default_time INTEGER NOT NULL DEFAULT 1`);
      }
      if (!mainColNames.has('phrases_time_seconds')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN phrases_time_seconds INTEGER NOT NULL DEFAULT 15`);
      }
      if (!mainColNames.has('phrases_day_id')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN phrases_day_id TEXT NOT NULL DEFAULT ''`);
      }
      if (!mainColNames.has('phrases_night_id')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN phrases_night_id TEXT NOT NULL DEFAULT ''`);
      }
      if (!mainColNames.has('guest_max_duration_minutes')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN guest_max_duration_minutes INTEGER NOT NULL DEFAULT 15`);
      }
      if (!mainColNames.has('special_guest_max_duration_minutes')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN special_guest_max_duration_minutes INTEGER NOT NULL DEFAULT 60`);
      }
      if (!mainColNames.has('background_music_mode')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN background_music_mode TEXT NOT NULL DEFAULT 'random'`);
      }
      if (!mainColNames.has('artist_arts_day_enabled')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN artist_arts_day_enabled INTEGER NOT NULL DEFAULT 1`);
      }
      if (!mainColNames.has('artist_arts_night_enabled')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN artist_arts_night_enabled INTEGER NOT NULL DEFAULT 1`);
      }

      const hadLegacyBrandingCols = mainColNames.has('day_radio_name_ua');
      if (!mainColNames.has('branding')) {
        await this.#db.execute(`ALTER TABLE settings_main ADD COLUMN branding TEXT NOT NULL DEFAULT '{}'`);
      }

      if (hadLegacyBrandingCols) {
        const legacyRow = (await this.#db.execute(`
          SELECT
            branding,
            day_radio_name_ua, day_radio_name_en,
            night_radio_name_ua, night_radio_name_en,
            telegram_url, telegram_label_ua, telegram_label_en
          FROM settings_main WHERE id = 1
        `)).rows?.[0];

        if (legacyRow && (!legacyRow.branding || legacyRow.branding === '{}')) {
          const migratedBranding = sanitizeBrandingSettings({
            day_radio_name_ua: legacyRow.day_radio_name_ua,
            day_radio_name_en: legacyRow.day_radio_name_en,
            night_radio_name_ua: legacyRow.night_radio_name_ua,
            night_radio_name_en: legacyRow.night_radio_name_en,
            telegram_url: legacyRow.telegram_url,
            telegram_label_ua: legacyRow.telegram_label_ua,
            telegram_label_en: legacyRow.telegram_label_en,
          });

          await this.#db.execute({
            sql: `UPDATE settings_main SET branding = ? WHERE id = 1`,
            args: [JSON.stringify(migratedBranding)],
          });
        }
      }

      const groupDefsCols = await this.#db.execute(`PRAGMA table_info(group_defs)`);
      const groupDefsColNames = new Set((groupDefsCols.rows || []).map((row) => row.name));

      if (!groupDefsColNames.has('mode')) {
        await this.#db.execute(`ALTER TABLE group_defs ADD COLUMN mode TEXT NOT NULL DEFAULT 'day'`);
      }

      this.#nightSchemaEnsured = true;
    } catch (error) {
      console.error('[DataProvider:sql] Failed to ensure night-settings schema:', error.message);
    }
  }

  async loadSettings(defaults) {
    if (this.#loaded && this.#cache) {
      return cloneEntry(this.#cache);
    }

    await this.#ensureNightSettingsSchema();

    const fallbackDefaults = defaults || createDefaultSettings({
      groupDefs: {},
      maxDayDuration: 18 * 60 * 60,
      maxNightDuration: 6 * 60 * 60,
      songsPerSection: 30,
      nightGroupDefs: {},
      nightSongsPerSection: 30,
      songGroups: [],
    });

    const mainRes = await this.#db.execute(`
      SELECT
        use_all_day_songs,
        max_day_duration,
        use_all_night_songs,
        max_night_duration,
        day_algorithm,
        songs_per_section,
        group_sections_algorithm,
        night_algorithm,
        night_songs_per_section,
        night_group_sections_algorithm,
        branding,
        jingles,
        jingles_random,
        jingles_frequency,
        phrases,
        phrases_random,
        phrases_default_time,
        phrases_time_seconds,
        phrases_day_id,
        phrases_night_id,
        guest_max_duration_minutes,
        special_guest_max_duration_minutes,
        background_music_mode,
        artist_arts_day_enabled,
        artist_arts_night_enabled
      FROM settings_main
      WHERE id = 1
    `);

    const groupDefsRes = await this.#db.execute(`
      SELECT group_name, artist, mode
      FROM group_defs
      ORDER BY mode, group_name, artist
    `);

    const groupsRes = await this.#db.execute(`
      SELECT id, name, mode
      FROM song_groups
      ORDER BY name
    `);

    const groupItemsRes = await this.#db.execute(`
      SELECT group_id, song_path
      FROM song_group_items
      ORDER BY group_id, rowid
    `);

    const rawSettings = {
      generation: {},
      songGroups: [],
    };

    const main = mainRes.rows?.[0];
    if (main) {
      rawSettings.generation = {
        USE_ALL_DAY_SONGS: Boolean(main.use_all_day_songs),
        MAX_DAY_DURATION: Number(main.max_day_duration) || fallbackDefaults.generation.MAX_DAY_DURATION,
        USE_ALL_NIGHT_SONGS: Boolean(main.use_all_night_songs),
        MAX_NIGHT_DURATION: Number(main.max_night_duration) || fallbackDefaults.generation.MAX_NIGHT_DURATION,
        DAY_ALGORYTM: Boolean(main.day_algorithm),
        SONGS_PER_SECTION: Number(main.songs_per_section) || fallbackDefaults.generation.SONGS_PER_SECTION,
        GROUP_SECTIONS_ALGORYTM: Boolean(main.group_sections_algorithm),
        NIGHT_ALGORYTM: Boolean(main.night_algorithm),
        NIGHT_SONGS_PER_SECTION: Number(main.night_songs_per_section) || fallbackDefaults.generation.NIGHT_SONGS_PER_SECTION,
        NIGHT_GROUP_SECTIONS_ALGORYTM: Boolean(main.night_group_sections_algorithm),
        JINGLES_ENABLED: Boolean(main.jingles),
        JINGLES_RANDOM: Boolean(main.jingles_random),
        JINGLES_FREQUENCY: Math.min(5, Math.max(1, Number(main.jingles_frequency) || 2)),
        PHRASES_ENABLED: Boolean(main.phrases),
        PHRASES_RANDOM: Boolean(main.phrases_random),
        PHRASES_DEFAULT_TIME: Boolean(main.phrases_default_time),
        PHRASES_TIME_SECONDS: Math.min(PHRASES_MAX_TIME_S, Math.max(PHRASES_MIN_TIME_S, Number(main.phrases_time_seconds) || PHRASES_DEFAULT_TIME_S)),
        PHRASES_DAY_ID: String(main.phrases_day_id || ''),
        PHRASES_NIGHT_ID: String(main.phrases_night_id || ''),
      };

      let parsedBranding = null;
      try {
        parsedBranding = main.branding ? JSON.parse(main.branding) : null;
      } catch (error) {
        console.warn('[DataProvider:sql] Failed to parse branding JSON, using defaults:', error.message);
      }
      rawSettings.branding = sanitizeBrandingSettings(parsedBranding, fallbackDefaults.branding);

      rawSettings.radioHosts = sanitizeRadioHostsSettings({
        guestMaxDurationMinutes: main.guest_max_duration_minutes,
        specialGuestMaxDurationMinutes: main.special_guest_max_duration_minutes,
        backgroundMusicMode: main.background_music_mode,
      }, fallbackDefaults.radioHosts);

      rawSettings.artistArts = sanitizeArtistArtsSettings({
        dayEnabled: Boolean(main.artist_arts_day_enabled),
        nightEnabled: Boolean(main.artist_arts_night_enabled),
      }, fallbackDefaults.artistArts);
    }

    const groupDefs = {};
    const nightGroupDefs = {};
    for (const row of groupDefsRes.rows || []) {
      const groupName = String(row.group_name || '').trim();
      const artist = String(row.artist || '').trim();
      if (!groupName || !artist) continue;
      const target = row.mode === 'night' ? nightGroupDefs : groupDefs;
      if (!target[groupName]) target[groupName] = [];
      target[groupName].push(artist);
    }
    rawSettings.generation.GROUP_DEFS = sanitizeGroupDefs(groupDefs, fallbackDefaults.generation.GROUP_DEFS);
    rawSettings.generation.NIGHT_GROUP_DEFS = sanitizeGroupDefs(nightGroupDefs, fallbackDefaults.generation.NIGHT_GROUP_DEFS);

    const itemsByGroupId = new Map();
    for (const row of groupItemsRes.rows || []) {
      const groupId = String(row.group_id || '').trim();
      const songPath = String(row.song_path || '').trim();
      if (!groupId || !songPath) continue;
      if (!itemsByGroupId.has(groupId)) itemsByGroupId.set(groupId, []);
      itemsByGroupId.get(groupId).push(songPath);
    }

    rawSettings.songGroups = (groupsRes.rows || []).map((row) => ({
      id: String(row.id),
      name: String(row.name || ''),
      mode: row.mode === 'night' ? 'night' : 'day',
      songs: itemsByGroupId.get(String(row.id)) || [],
    }));

    const merged = mergeSettings(rawSettings, fallbackDefaults);
    this.#cache = merged;
    this.#loaded = true;

    console.log(
      `[DataProvider:sql] Settings loaded (${Object.keys(merged.generation.GROUP_DEFS || {}).length} groups, ${(merged.songGroups || []).length} song groups)`
    );

    return cloneEntry(merged);
  }

  async saveSettings(settings) {
    await this.#ensureNightSettingsSchema();

    const safeSettings = mergeSettings(settings, settings);

    const generation = safeSettings.generation || {};
    const groupDefs  = sanitizeGroupDefs(generation.GROUP_DEFS, {});
    const nightGroupDefs = sanitizeGroupDefs(generation.NIGHT_GROUP_DEFS, {});
    const songGroups = sanitizeSongGroups(safeSettings.songGroups, []);

    const branding = sanitizeBrandingSettings(safeSettings.branding, this.#cache?.branding);

    const radioHosts = sanitizeRadioHostsSettings(safeSettings.radioHosts);
    const artistArts = sanitizeArtistArtsSettings(safeSettings.artistArts);

    await this.#db.execute({
      sql: `
        INSERT INTO settings_main (
          id,
          use_all_day_songs,
          max_day_duration,
          use_all_night_songs,
          max_night_duration,
          day_algorithm,
          songs_per_section,
          group_sections_algorithm,
          night_algorithm,
          night_songs_per_section,
          night_group_sections_algorithm,
          branding,
          jingles,
          jingles_random,
          jingles_frequency,
          phrases,
          phrases_random,
          phrases_default_time,
          phrases_time_seconds,
          phrases_day_id,
          phrases_night_id,
          guest_max_duration_minutes,
          special_guest_max_duration_minutes,
          background_music_mode,
          artist_arts_day_enabled,
          artist_arts_night_enabled
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          use_all_day_songs = excluded.use_all_day_songs,
          max_day_duration = excluded.max_day_duration,
          use_all_night_songs = excluded.use_all_night_songs,
          max_night_duration = excluded.max_night_duration,
          day_algorithm = excluded.day_algorithm,
          songs_per_section = excluded.songs_per_section,
          group_sections_algorithm = excluded.group_sections_algorithm,
          night_algorithm = excluded.night_algorithm,
          night_songs_per_section = excluded.night_songs_per_section,
          night_group_sections_algorithm = excluded.night_group_sections_algorithm,
          branding = excluded.branding,
          jingles = excluded.jingles,
          jingles_random = excluded.jingles_random,
          jingles_frequency = excluded.jingles_frequency,
          phrases = excluded.phrases,
          phrases_random = excluded.phrases_random,
          phrases_default_time = excluded.phrases_default_time,
          phrases_time_seconds = excluded.phrases_time_seconds,
          phrases_day_id = excluded.phrases_day_id,
          phrases_night_id = excluded.phrases_night_id,
          guest_max_duration_minutes = excluded.guest_max_duration_minutes,
          special_guest_max_duration_minutes = excluded.special_guest_max_duration_minutes,
          background_music_mode = excluded.background_music_mode,
          artist_arts_day_enabled = excluded.artist_arts_day_enabled,
          artist_arts_night_enabled = excluded.artist_arts_night_enabled
      `,
      args: [
        generation.USE_ALL_DAY_SONGS     ? 1 : 0,
        Number(generation.MAX_DAY_DURATION)   || 0,
        generation.USE_ALL_NIGHT_SONGS   ? 1 : 0,
        Number(generation.MAX_NIGHT_DURATION) || 0,
        generation.DAY_ALGORYTM          ? 1 : 0,
        Number(generation.SONGS_PER_SECTION)  || 0,
        generation.GROUP_SECTIONS_ALGORYTM ? 1 : 0,
        generation.NIGHT_ALGORYTM        ? 1 : 0,
        Number(generation.NIGHT_SONGS_PER_SECTION) || 0,
        generation.NIGHT_GROUP_SECTIONS_ALGORYTM ? 1 : 0,
        JSON.stringify(branding),
        generation.JINGLES_ENABLED ? 1 : 0,
        generation.JINGLES_RANDOM ? 1 : 0,
        Math.min(5, Math.max(1, Number(generation.JINGLES_FREQUENCY) || 2)),
        generation.PHRASES_ENABLED ? 1 : 0,
        generation.PHRASES_RANDOM ? 1 : 0,
        generation.PHRASES_DEFAULT_TIME ? 1 : 0,
        Math.min(PHRASES_MAX_TIME_S, Math.max(PHRASES_MIN_TIME_S, Number(generation.PHRASES_TIME_SECONDS) || PHRASES_DEFAULT_TIME_S)),
        String(generation.PHRASES_DAY_ID || ''),
        String(generation.PHRASES_NIGHT_ID || ''),
        radioHosts.guestMaxDurationMinutes,
        radioHosts.specialGuestMaxDurationMinutes,
        radioHosts.backgroundMusicMode,
        artistArts.dayEnabled ? 1 : 0,
        artistArts.nightEnabled ? 1 : 0,
      ],
    });

    const cachedGeneration = this.#cache?.generation;
    const dayChanged = !cachedGeneration
      || JSON.stringify(cachedGeneration.GROUP_DEFS || {}) !== JSON.stringify(groupDefs);
    const nightChanged = !cachedGeneration
      || JSON.stringify(cachedGeneration.NIGHT_GROUP_DEFS || {}) !== JSON.stringify(nightGroupDefs);

    if (dayChanged || nightChanged) {
      if (dayChanged) await this.#db.execute(`DELETE FROM group_defs WHERE mode = 'day'`);
      if (nightChanged) await this.#db.execute(`DELETE FROM group_defs WHERE mode = 'night'`);

      const rows = [];
      if (dayChanged) {
        for (const [groupName, artists] of Object.entries(groupDefs)) {
          for (const artist of artists) rows.push([groupName, artist, 'day']);
        }
      }
      if (nightChanged) {
        for (const [groupName, artists] of Object.entries(nightGroupDefs)) {
          for (const artist of artists) rows.push([groupName, artist, 'night']);
        }
      }

      for (const batch of chunkArray(rows, 300)) {
        const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
        await this.#db.execute({
          sql: `INSERT INTO group_defs (group_name, artist, mode) VALUES ${placeholders}`,
          args: batch.flat(),
        });
      }
    }

    const existingSongGroups = this.#cache?.songGroups || [];
    if (JSON.stringify(existingSongGroups) !== JSON.stringify(songGroups)) {
      await this.#db.execute(`DELETE FROM song_group_items`);
      await this.#db.execute(`DELETE FROM song_groups`);

      for (const group of songGroups) {
        await this.#db.execute({
          sql: `INSERT INTO song_groups (id, name, mode) VALUES (?, ?, ?)`,
          args: [group.id, group.name, group.mode],
        });

        for (const batch of chunkArray(group.songs || [], 400)) {
          const placeholders = batch.map(() => '(?, ?)').join(', ');
          await this.#db.execute({
            sql: `INSERT INTO song_group_items (group_id, song_path) VALUES ${placeholders}`,
            args: batch.flatMap((song) => [group.id, song]),
          });
        }
      }
    }

    this.#cache = {
      ...safeSettings,
      generation: { ...generation, GROUP_DEFS: groupDefs, NIGHT_GROUP_DEFS: nightGroupDefs },
      songGroups,
      branding,
      artistArts,
    };

    this.#loaded = true;

    return cloneEntry(this.#cache);
  }

  getSongGroupsFromSettings(settings) {
    return sanitizeSongGroups(settings?.songGroups, []);
  }
}