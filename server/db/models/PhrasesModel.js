import { BaseModel } from './BaseModel.js';

export class PhrasesModel extends BaseModel {
  static table = 'phrases';

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
    { name: 'phrases_filename_unique', columns: ['filename'], unique: true },
    { name: 'phrases_mode_idx', columns: ['mode'] },
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS phrases (
  id         TEXT    PRIMARY KEY,
  filename   TEXT    NOT NULL,
  mode       TEXT    NOT NULL CHECK (mode IN ('day', 'night')),
  used       INTEGER NOT NULL DEFAULT 1 CHECK (used IN (0, 1)),
  duration   REAL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS phrases_filename_unique ON phrases (filename);
CREATE INDEX IF NOT EXISTS phrases_mode_idx ON phrases (mode);
`;
}
