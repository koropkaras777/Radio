import { BaseModel } from './BaseModel.js';

export class JingleModel extends BaseModel {
  static table = 'jingles';

  static primaryKey = 'id';

  static columns = {
    id: {
      type: 'TEXT',
      primaryKey: true,
      nullable: false,
    },
    filename: {
      type: 'TEXT',
      nullable: false,
      unique: true,
    },
    mode: {
      type: 'TEXT',
      nullable: false,
      check: "mode IN ('day', 'night')",
    },
    used: {
      type: 'INTEGER',
      nullable: false,
      default: 1,
      check: 'used IN (0, 1)',
    },
    duration: {
      type: 'REAL',
      nullable: true,
    },
    created_at: {
      type: 'INTEGER',
      nullable: false,
    },
  };

  static indexes = [
    { name: 'jingles_filename_unique', columns: ['filename'], unique: true },
    { name: 'jingles_mode_idx', columns: ['mode'] },
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS jingles (
  id         TEXT    PRIMARY KEY,
  filename   TEXT    NOT NULL,
  mode       TEXT    NOT NULL CHECK (mode IN ('day', 'night')),
  used       INTEGER NOT NULL DEFAULT 1 CHECK (used IN (0, 1)),
  duration   REAL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS jingles_filename_unique ON jingles (filename);
CREATE INDEX IF NOT EXISTS jingles_mode_idx ON jingles (mode);
`;
}