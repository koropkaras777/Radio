import { BaseModel } from './BaseModel.js';

export class GroupDefsModel extends BaseModel {
  static table = 'group_defs';

  static primaryKey = null;

  static columns = {
    group_name: {
      type: 'TEXT',
      nullable: false,
    },
    artist: {
      type: 'TEXT',
      nullable: false,
    },
    mode: {
      type: 'TEXT',
      nullable: false,
      default: "'day'",
      check: "mode IN ('day', 'night')",
    },
  };

  static indexes = [
    {
      name: 'idx_group_defs_group_name',
      unique: false,
      columns: ['group_name'],
    },
    {
      name: 'idx_group_defs_group_artist',
      unique: true,
      columns: ['group_name', 'artist', 'mode'],
    },
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS group_defs (
  group_name TEXT NOT NULL,
  artist TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'day' CHECK (mode IN ('day', 'night'))
);
`;

  static createIndexesSql = [
    `CREATE INDEX IF NOT EXISTS idx_group_defs_group_name ON group_defs (group_name);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_group_defs_group_artist ON group_defs (group_name, artist, mode);`,
  ];
}