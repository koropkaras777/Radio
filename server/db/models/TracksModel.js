import { BaseModel } from './BaseModel.js';

export class TracksModel extends BaseModel {
  static table = 'tracks';

  static primaryKey = 'id';

  static columns = {
    id: {
      type: 'INTEGER',
      primaryKey: true,
      autoIncrement: true,
      nullable: false,
    },
    artist: {
      type: 'TEXT',
      nullable: false,
      default: "''",
    },
    title: {
      type: 'TEXT',
      nullable: false,
      default: "''",
    },
    album: {
      type: 'TEXT',
      nullable: false,
      default: "''",
    },
    year: {
      type: 'INTEGER',
      nullable: true,
      default: 'NULL',
    },
    duration: {
      type: 'REAL',
      nullable: true,
      default: 'NULL',
    },
    mode: {
      type: 'TEXT',
      nullable: false,
      default: "'day'",
      check: "mode IN ('day', 'night')",
    },
    filename: {
      type: 'TEXT',
      nullable: false,
      default: "''",
    },
    synced: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'synced IN (0, 1)',
    },
    fetched_at: {
      type: 'INTEGER',
      nullable: true,
      default: 'NULL',
    },
    lyrics_payload_json: {
      type: 'TEXT',
      nullable: true,
      default: 'NULL',
    },
  };

  static indexes = [
    {
      name: 'idx_tracks_mode_filename',
      unique: true,
      columns: ['mode', 'filename'],
    },
    {
      name: 'idx_tracks_artist_title',
      unique: false,
      columns: ['artist', 'title'],
    },
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  album TEXT NOT NULL DEFAULT '',
  year INTEGER DEFAULT NULL,
  duration REAL DEFAULT NULL,
  mode TEXT NOT NULL DEFAULT 'day' CHECK (mode IN ('day', 'night')),
  filename TEXT NOT NULL DEFAULT '',
  synced INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0, 1)),
  fetched_at INTEGER DEFAULT NULL,
  lyrics_payload_json TEXT DEFAULT NULL
);
`;

  static createIndexesSql = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_mode_filename ON tracks (mode, filename);`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks (artist, title);`,
  ];
}
