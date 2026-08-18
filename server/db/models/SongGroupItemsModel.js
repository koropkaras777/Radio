import { BaseModel } from './BaseModel.js';

export class SongGroupItemsModel extends BaseModel {
  static table = 'song_group_items';

  static primaryKey = null;

  static columns = {
    group_id: {
      type: 'TEXT',
      nullable: false,
      references: {
        table: 'song_groups',
        column: 'id',
        onDelete: 'CASCADE',
      },
    },
    song_path: {
      type: 'TEXT',
      nullable: false,
    },
  };

  static indexes = [
    {
      name: 'idx_song_group_items_group_id',
      unique: false,
      columns: ['group_id'],
    },
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS song_group_items (
  group_id TEXT NOT NULL,
  song_path TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES song_groups(id) ON DELETE CASCADE
);
`;

  static createIndexesSql = [
    `CREATE INDEX IF NOT EXISTS idx_song_group_items_group_id ON song_group_items (group_id);`,
  ];
}
