import { ensureTables } from '../shared/schema.js';
import { replaceTableRows } from '../shared/sqlUtils.js';
import { normalizeAll, normalizeAuditEntry } from '../../shared/importRecords.js';

export class AuditDomain {
  #db;

  constructor(db) {
    this.#db = db;
  }

  #rowToEntry(row) {
    let data = {};
    try { data = JSON.parse(row.operation_data || '{}'); } catch { }

    return {
      id:            Number(row.id),
      adminId:       String(row.admin_id),
      operationType: String(row.operation_type),
      data,
      createdAt:     Number(row.created_at),
    };
  }

  async loadAuditLog() {
    await ensureTables(this.#db, 'audit_log');

    const result = await this.#db.execute(`
      SELECT id, admin_id, operation_type, operation_data, created_at
      FROM audit_log
      ORDER BY created_at ASC
    `);

    return (result.rows || []).map((row) => this.#rowToEntry(row));
  }

  async appendAuditEntry({ adminId, operationType, data = {}, createdAt }) {
    await ensureTables(this.#db, 'audit_log');

    const result = await this.#db.execute({
      sql: `INSERT INTO audit_log (admin_id, operation_type, operation_data, created_at)
            VALUES (?, ?, ?, ?) RETURNING id`,
      args: [String(adminId), String(operationType), JSON.stringify(data), createdAt],
    });

    return {
      id: Number(result.rows?.[0]?.id ?? 0),
      adminId: String(adminId),
      operationType,
      data,
      createdAt,
    };
  }

  async importAuditLog(entries) {
    await ensureTables(this.#db, 'audit_log');

    const { records, skipped } = normalizeAll(entries, normalizeAuditEntry);
    const ordered = records.sort((a, b) => a.createdAt - b.createdAt);

    await replaceTableRows(this.#db, {
      table: 'audit_log',
      columns: ['admin_id', 'operation_type', 'operation_data', 'created_at'],
      rows: ordered.map((e) => [e.adminId, e.operationType, JSON.stringify(e.data), e.createdAt]),
    });

    return { imported: ordered.length, skipped, truncated: 0 };
  }

  async purgeAuditEntries(cutoff) {
    await ensureTables(this.#db, 'audit_log');

    const result = await this.#db.execute({
      sql:  `DELETE FROM audit_log WHERE created_at < ? RETURNING id`,
      args: [cutoff],
    });

    return (result.rows || []).length;
  }
}
