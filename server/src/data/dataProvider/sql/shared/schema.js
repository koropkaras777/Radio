export const TABLES = {
  tracks: `
    CREATE TABLE IF NOT EXISTS tracks (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      artist              TEXT,
      title               TEXT,
      album               TEXT,
      year                INTEGER,
      duration            REAL,
      mode                TEXT,
      filename            TEXT,
      synced              INTEGER NOT NULL DEFAULT 0,
      fetched_at          INTEGER,
      lyrics_payload_json TEXT
    )`,

  offsets: `
    CREATE TABLE IF NOT EXISTS offsets (
      track_id INTEGER PRIMARY KEY,
      offset   REAL
    )`,

  settings_main: `
    CREATE TABLE IF NOT EXISTS settings_main (
      id                             INTEGER PRIMARY KEY CHECK (id = 1),
      use_all_day_songs              BOOLEAN,
      max_day_duration               INTEGER,
      use_all_night_songs            BOOLEAN,
      max_night_duration             INTEGER,
      day_algorithm                  BOOLEAN,
      songs_per_section              INTEGER,
      group_sections_algorithm       BOOLEAN,
      night_algorithm                BOOLEAN,
      night_songs_per_section        INTEGER,
      night_group_sections_algorithm BOOLEAN,
      branding                       TEXT NOT NULL DEFAULT '{}'
    )`,

  group_defs: `
    CREATE TABLE IF NOT EXISTS group_defs (
      group_name TEXT,
      artist     TEXT,
      mode       TEXT NOT NULL DEFAULT 'day'
    )`,

  song_groups: `
    CREATE TABLE IF NOT EXISTS song_groups (
      id   TEXT PRIMARY KEY,
      name TEXT,
      mode TEXT
    )`,

  song_group_items: `
    CREATE TABLE IF NOT EXISTS song_group_items (
      group_id  TEXT,
      song_path TEXT
    )`,

  audit_log: `
    CREATE TABLE IF NOT EXISTS audit_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id       TEXT    NOT NULL,
      operation_type TEXT    NOT NULL,
      operation_data TEXT    NOT NULL DEFAULT '{}',
      created_at     INTEGER NOT NULL
    )`,

  admins: `
    CREATE TABLE IF NOT EXISTS admins (
      admin_id      TEXT    PRIMARY KEY,
      login         TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      authorized    INTEGER NOT NULL DEFAULT 0 CHECK (authorized IN (0, 1)),
      privileges    TEXT    NOT NULL DEFAULT '[]',
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    )`,

  artist_arts: `
    CREATE TABLE IF NOT EXISTS artist_arts (
      artist   TEXT PRIMARY KEY,
      has_art  INTEGER NOT NULL DEFAULT 0,
      art_file TEXT NOT NULL DEFAULT ''
    )`,

  jingles: `
    CREATE TABLE IF NOT EXISTS jingles (
      id         TEXT    PRIMARY KEY,
      filename   TEXT    NOT NULL,
      mode       TEXT    NOT NULL CHECK (mode IN ('day', 'night')),
      used       INTEGER NOT NULL DEFAULT 1 CHECK (used IN (0, 1)),
      duration   REAL,
      created_at INTEGER NOT NULL
    )`,

  background_music: `
    CREATE TABLE IF NOT EXISTS background_music (
      id         TEXT    PRIMARY KEY,
      filename   TEXT    NOT NULL,
      mode       TEXT    NOT NULL CHECK (mode IN ('day', 'night')),
      used       INTEGER NOT NULL DEFAULT 1 CHECK (used IN (0, 1)),
      duration   REAL,
      created_at INTEGER NOT NULL
    )`,

  phrases: `
    CREATE TABLE IF NOT EXISTS phrases (
      id         TEXT    PRIMARY KEY,
      filename   TEXT    NOT NULL,
      mode       TEXT    NOT NULL CHECK (mode IN ('day', 'night')),
      used       INTEGER NOT NULL DEFAULT 1 CHECK (used IN (0, 1)),
      duration   REAL,
      created_at INTEGER NOT NULL
    )`,

  banned_ips: `
    CREATE TABLE IF NOT EXISTS banned_ips (
      ip        TEXT PRIMARY KEY,
      nickname  TEXT NOT NULL DEFAULT '',
      banned_at INTEGER NOT NULL,
      banned_by TEXT NOT NULL DEFAULT ''
    )`,

  play_history: `
    CREATE TABLE IF NOT EXISTS play_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id  TEXT    NOT NULL,
      title     TEXT    NOT NULL,
      artist    TEXT    NOT NULL,
      album     TEXT    NOT NULL DEFAULT '',
      mode      TEXT    NOT NULL CHECK (mode IN ('day', 'night')),
      played_at INTEGER NOT NULL
    )`,

  donation_settings: `
    CREATE TABLE IF NOT EXISTS donation_settings (
      id                              INTEGER PRIMARY KEY CHECK (id = 1),
      currency                        TEXT    NOT NULL DEFAULT '',
      pricing_mode                    TEXT    NOT NULL DEFAULT 'fixed',
      fixed_price                     REAL    NOT NULL DEFAULT 1,
      price_per_second                REAL    NOT NULL DEFAULT 0.02,
      tiers_enabled                   INTEGER NOT NULL DEFAULT 0,
      tier_ceiling                    INTEGER NOT NULL DEFAULT 5,
      block_donations_while_chatting  INTEGER NOT NULL DEFAULT 0
    )`,

  donations: `
    CREATE TABLE IF NOT EXISTS donations (
      id           TEXT    PRIMARY KEY,
      uid          TEXT    NOT NULL DEFAULT '',
      song_id      TEXT    NOT NULL,
      song_title   TEXT    NOT NULL DEFAULT '',
      song_artist  TEXT    NOT NULL DEFAULT '',
      provider     TEXT    NOT NULL,
      currency     TEXT    NOT NULL,
      amount       REAL    NOT NULL,
      tier         INTEGER,
      status       TEXT    NOT NULL DEFAULT 'pending',
      provider_ref TEXT,
      match_code   TEXT,
      expires_at   INTEGER,
      created_at   INTEGER NOT NULL,
      paid_at      INTEGER
    )`,
};

export const INDEXES = {
  tracks: [
    `CREATE INDEX IF NOT EXISTS idx_tracks_artist_title  ON tracks (artist, title)`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_mode_filename ON tracks (mode, filename)`,
  ],
  offsets: [
    `CREATE INDEX IF NOT EXISTS idx_offsets_track_id ON offsets (track_id)`,
  ],
  audit_log: [
    `CREATE INDEX IF NOT EXISTS idx_admin_log_created_at ON audit_log (created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_admin_log_admin_id   ON audit_log (admin_id)`,
  ],
  admins: [
    `CREATE UNIQUE INDEX IF NOT EXISTS admins_login_unique ON admins (login)`,
  ],
  jingles: [
    `CREATE UNIQUE INDEX IF NOT EXISTS jingles_filename_unique ON jingles (filename)`,
    `CREATE INDEX IF NOT EXISTS jingles_mode_idx ON jingles (mode)`,
  ],
  background_music: [
    `CREATE UNIQUE INDEX IF NOT EXISTS background_music_filename_unique ON background_music (filename)`,
    `CREATE INDEX IF NOT EXISTS background_music_mode_idx ON background_music (mode)`,
  ],
  phrases: [
    `CREATE UNIQUE INDEX IF NOT EXISTS phrases_filename_unique ON phrases (filename)`,
    `CREATE INDEX IF NOT EXISTS phrases_mode_idx ON phrases (mode)`,
  ],
  play_history: [
    `CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history (played_at DESC)`,
  ],
  donations: [
    `CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations (created_at DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS donations_provider_ref_unique ON donations (provider_ref)`,
    `CREATE INDEX IF NOT EXISTS idx_donations_match_code ON donations (match_code)`,
  ],
};

export async function ensureTables(db, ...names) {
  for (const name of names) {
    const ddl = TABLES[name];
    if (!ddl) throw new Error(`Unknown table in schema: ${name}`);

    await db.execute(ddl);

    for (const index of INDEXES[name] ?? []) {
      await db.execute(index);
    }
  }
}

export async function ensureAllTables(db) {
  await ensureTables(db, ...Object.keys(TABLES));
}
