import { BaseModel } from './BaseModel.js';

export class OffsetsModel extends BaseModel {
  static table = 'offsets';

  static primaryKey = null;

  static columns = {
    track_id: {
      type: 'INTEGER',
      nullable: false,
      references: {
        table: 'tracks',
        column: 'id',
        onDelete: 'CASCADE',
      },
    },
    offset: {
      type: 'REAL',
      nullable: false,
      default: 0,
    },
  };

  static indexes = [
    {
      name: 'idx_offsets_track_id',
      unique: true,
      columns: ['track_id'],
    },
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS offsets (
  track_id INTEGER NOT NULL,
  offset REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);
`;

  static createIndexesSql = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_offsets_track_id ON offsets (track_id);`,
  ];
}
