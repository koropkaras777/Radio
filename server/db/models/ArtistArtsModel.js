import { BaseModel } from './BaseModel.js';

export class ArtistArtsModel extends BaseModel {
  static table = 'artist_arts';

  static primaryKey = 'artist';

  static columns = {
    artist: {
      type: 'TEXT',
      primaryKey: true,
      nullable: false,
    },
    has_art: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'has_art IN (0, 1)',
    },
    art_file: {
      type: 'TEXT',
      nullable: false,
      default: "''",
    },
  };

  static indexes = [];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS artist_arts (
  artist TEXT PRIMARY KEY,
  has_art INTEGER NOT NULL DEFAULT 0,
  art_file TEXT NOT NULL DEFAULT ''
);
`;
}
