import { BaseModel } from './BaseModel.js';

export class AuditLogModel extends BaseModel {
  static table = 'audit_log';

  static primaryKey = 'id';

  static columns = {
    id: {
      type: 'INTEGER',
      primaryKey: true,
      autoIncrement: true,
      nullable: false,
    },
    admin_id: {
      type: 'TEXT',
      nullable: false,
      comment: '"super" for super-admin, UUID for helper admins',
    },
    operation_type: {
      type: 'TEXT',
      nullable: false,
      comment: 'e.g. upload_song, queue_add, mode_switch …',
    },
    operation_data: {
      type: 'TEXT',
      nullable: false,
      default: "'{}'",
      comment: 'JSON object with structured params for client-side localisation',
    },
    created_at: {
      type: 'INTEGER',
      nullable: false,
      comment: 'Unix timestamp ms',
    },
  };

  static indexes = [
    'CREATE INDEX IF NOT EXISTS idx_admin_log_created_at ON audit_log (created_at DESC);',
    'CREATE INDEX IF NOT EXISTS idx_admin_log_admin_id   ON audit_log (admin_id);',
  ];

  static createTableSql = `
CREATE TABLE IF NOT EXISTS audit_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id       TEXT    NOT NULL,
  operation_type TEXT    NOT NULL,
  operation_data TEXT    NOT NULL DEFAULT '{}',
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin_id   ON audit_log (admin_id);
`;
}