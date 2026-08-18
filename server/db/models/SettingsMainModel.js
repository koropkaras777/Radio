import { BaseModel } from './BaseModel.js';

export class SettingsMainModel extends BaseModel {
  static table = 'settings_main';

  static primaryKey = 'id';

  static columns = {
    id: {
      type: 'INTEGER',
      primaryKey: true,
      nullable: false,
    },
    use_all_day_songs: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'use_all_day_songs IN (0, 1)',
    },
    max_day_duration: {
      type: 'INTEGER',
      nullable: false,
      default: 64800,
    },
    use_all_night_songs: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'use_all_night_songs IN (0, 1)',
    },
    max_night_duration: {
      type: 'INTEGER',
      nullable: false,
      default: 21600,
    },
    day_algorithm: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'day_algorithm IN (0, 1)',
    },
    songs_per_section: {
      type: 'INTEGER',
      nullable: false,
      default: 30,
    },
    group_sections_algorithm: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'group_sections_algorithm IN (0, 1)',
    },
    night_algorithm: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'night_algorithm IN (0, 1)',
    },
    night_songs_per_section: {
      type: 'INTEGER',
      nullable: false,
      default: 30,
    },
    night_group_sections_algorithm: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'night_group_sections_algorithm IN (0, 1)',
    },
    branding: {
      type: 'TEXT',
      nullable: false,
      default: "'{}'",
    },
    jingles: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'jingles IN (0, 1)',
    },
    jingles_random: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'jingles_random IN (0, 1)',
    },
    jingles_frequency: {
      type: 'INTEGER',
      nullable: false,
      default: 2,
    },
    phrases: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'phrases IN (0, 1)',
    },
    phrases_random: {
      type: 'INTEGER',
      nullable: false,
      default: 1,
      check: 'phrases_random IN (0, 1)',
    },
    phrases_default_time: {
      type: 'INTEGER',
      nullable: false,
      default: 1,
      check: 'phrases_default_time IN (0, 1)',
    },
    phrases_time_seconds: {
      type: 'INTEGER',
      nullable: false,
      default: 15,
    },
    phrases_day_id: {
      type: 'TEXT',
      nullable: false,
      default: "''",
    },
    phrases_night_id: {
      type: 'TEXT',
      nullable: false,
      default: "''",
    },
    guest_max_duration_minutes: {
      type: 'INTEGER',
      nullable: false,
      default: 15,
    },
    special_guest_max_duration_minutes: {
      type: 'INTEGER',
      nullable: false,
      default: 60,
    },
    background_music_mode: {
      type: 'TEXT',
      nullable: false,
      default: "'random'",
      check: "background_music_mode IN ('random', 'hostChoice')",
    },
    artist_arts_day_enabled: {
      type: 'INTEGER',
      nullable: false,
      default: 1,
      check: 'artist_arts_day_enabled IN (0, 1)',
    },
    artist_arts_night_enabled: {
      type: 'INTEGER',
      nullable: false,
      default: 1,
      check: 'artist_arts_night_enabled IN (0, 1)',
    },
  };

  static indexes = [];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS settings_main (
  id INTEGER PRIMARY KEY,
  use_all_day_songs INTEGER NOT NULL DEFAULT 0,
  max_day_duration INTEGER NOT NULL DEFAULT 64800,
  use_all_night_songs INTEGER NOT NULL DEFAULT 0,
  max_night_duration INTEGER NOT NULL DEFAULT 21600,
  day_algorithm INTEGER NOT NULL DEFAULT 0,
  songs_per_section INTEGER NOT NULL DEFAULT 30,
  group_sections_algorithm INTEGER NOT NULL DEFAULT 0,
  night_algorithm INTEGER NOT NULL DEFAULT 0,
  night_songs_per_section INTEGER NOT NULL DEFAULT 30,
  night_group_sections_algorithm INTEGER NOT NULL DEFAULT 0,
  branding TEXT NOT NULL DEFAULT '{}',
  jingles INTEGER NOT NULL DEFAULT 0,
  jingles_random INTEGER NOT NULL DEFAULT 0,
  jingles_frequency INTEGER NOT NULL DEFAULT 2,
  phrases INTEGER NOT NULL DEFAULT 0,
  phrases_random INTEGER NOT NULL DEFAULT 1,
  phrases_default_time INTEGER NOT NULL DEFAULT 1,
  phrases_time_seconds INTEGER NOT NULL DEFAULT 15,
  phrases_day_id TEXT NOT NULL DEFAULT '',
  phrases_night_id TEXT NOT NULL DEFAULT '',
  guest_max_duration_minutes INTEGER NOT NULL DEFAULT 15,
  special_guest_max_duration_minutes INTEGER NOT NULL DEFAULT 60,
  background_music_mode TEXT NOT NULL DEFAULT 'random' CHECK (background_music_mode IN ('random', 'hostChoice')),
  artist_arts_day_enabled INTEGER NOT NULL DEFAULT 1,
  artist_arts_night_enabled INTEGER NOT NULL DEFAULT 1
);
`;
}
