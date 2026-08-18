import { BaseModel } from './BaseModel.js';

export class SongGroupsModel extends BaseModel {
  static table = 'song_groups';

  static primaryKey = 'id';

  static columns = {
    id: {
      type: 'TEXT',
      primaryKey: true,
      nullable: false,
    },
    name: {
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
      name: 'idx_song_groups_name',
      unique: false,
      columns: ['name'],
    },
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS song_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'day' CHECK (mode IN ('day', 'night'))
);
`;

  static createIndexesSql = [
    `CREATE INDEX IF NOT EXISTS idx_song_groups_name ON song_groups (name);`,
  ];
}
