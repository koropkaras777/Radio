import { BaseModel } from './BaseModel.js';

export class AdminsModel extends BaseModel {
  static table = 'admins';

  static primaryKey = 'admin_id';

  static columns = {
    admin_id: {
      type: 'TEXT',
      primaryKey: true,
      nullable: false,
    },
    login: {
      type: 'TEXT',
      nullable: false,
      unique: true,
    },
    password_hash: {
      type: 'TEXT',
      nullable: false,
    },
    authorized: {
      type: 'INTEGER',
      nullable: false,
      default: 0,
      check: 'authorized IN (0, 1)',
    },
    privileges: {
      type: 'TEXT',
      nullable: false,
      default: "'[]'",
      comment: 'JSON array of privilege IDs',
    },
    created_at: {
      type: 'INTEGER',
      nullable: false,
      comment: 'Unix timestamp ms',
    },
    updated_at: {
      type: 'INTEGER',
      nullable: false,
      comment: 'Unix timestamp ms',
    },
  };

  static indexes = [
    'CREATE UNIQUE INDEX IF NOT EXISTS admins_login_unique ON admins (login);',
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS admins (
  admin_id     TEXT    PRIMARY KEY,
  login        TEXT    NOT NULL,
  password_hash TEXT   NOT NULL,
  authorized   INTEGER NOT NULL DEFAULT 0 CHECK (authorized IN (0, 1)),
  privileges   TEXT    NOT NULL DEFAULT '[]',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS admins_login_unique ON admins (login);
`;
}