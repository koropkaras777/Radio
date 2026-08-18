import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { makeError } from '../../../../i18n/index.js';
import { cloneEntry, replaceTableRows } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';
import {
  normalizeAll, normalizeAdminRecord, dedupeBy,
} from '../../shared/importRecords.js';
import {
  BCRYPT_ROUNDS, ADMIN_TTL_MS, validatePassword, sanitizePrivileges,
} from '../../shared/adminRules.js';

export class AdminsDomain {
  #db;
  #cache = [];
  #loaded = false;

  constructor(db) {
    this.#db = db;
  }

  async #ensureTable() {
    await ensureTables(this.#db, 'admins');
  }

  #rowToAdmin(row) {
    let privileges = [];
    try { privileges = JSON.parse(row.privileges || '[]'); } catch { }
    return {
      adminId:      String(row.admin_id),
      login:        String(row.login),
      passwordHash: String(row.password_hash),
      authorized:   Number(row.authorized) === 1,
      privileges:   Array.isArray(privileges) ? privileges : [],
      createdAt:    Number(row.created_at),
      updatedAt:    Number(row.updated_at),
    };
  }

  validatePassword(password) {
    validatePassword(password);
  }

  async loadAdmins() {
    if (this.#loaded) return cloneEntry(this.#cache);
    await this.#ensureTable();

    const result = await this.#db.execute(
      `SELECT admin_id, login, password_hash, authorized, privileges, created_at, updated_at
       FROM admins ORDER BY created_at ASC`
    );

    this.#cache  = (result.rows || []).map((row) => this.#rowToAdmin(row));
    this.#loaded = true;
    return cloneEntry(this.#cache);
  }

  async getAdminById(adminId) {
    await this.#ensureTable();
    const result = await this.#db.execute({
      sql:  `SELECT admin_id, login, password_hash, authorized, privileges, created_at, updated_at
             FROM admins WHERE admin_id = ?`,
      args: [String(adminId)],
    });
    const row = result.rows?.[0];
    return row ? this.#rowToAdmin(row) : null;
  }

  async getAdminByLogin(login) {
    await this.#ensureTable();
    const result = await this.#db.execute({
      sql:  `SELECT admin_id, login, password_hash, authorized, privileges, created_at, updated_at
             FROM admins WHERE login = ?`,
      args: [String(login)],
    });
    const row = result.rows?.[0];
    return row ? this.#rowToAdmin(row) : null;
  }

  async createAdmin({ login, plainPassword, privileges = [] }) {
    await this.#ensureTable();

    const trimmedLogin = String(login || '').trim();
    if (!trimmedLogin) throw makeError('admins.loginRequired');

    this.validatePassword(plainPassword);

    const existing = await this.getAdminByLogin(trimmedLogin);
    if (existing) throw makeError('admins.loginTaken');

    const safePrivileges = sanitizePrivileges(privileges);
    const hash    = await bcrypt.hash(String(plainPassword), BCRYPT_ROUNDS);
    const adminId = randomUUID();
    const now     = Date.now();

    await this.#db.execute({
      sql:  `INSERT INTO admins (admin_id, login, password_hash, authorized, privileges, created_at, updated_at)
             VALUES (?, ?, ?, 0, ?, ?, ?)`,
      args: [adminId, trimmedLogin, hash, JSON.stringify(safePrivileges), now, now],
    });

    const admin = { adminId, login: trimmedLogin, passwordHash: hash, authorized: false, privileges: safePrivileges, createdAt: now, updatedAt: now };
    this.#cache  = [...(this.#cache || []), admin];
    this.#loaded = true;
    return cloneEntry(admin);
  }

  async updateAdminPrivileges(adminId, privileges) {
    await this.#ensureTable();
    const safePrivileges = sanitizePrivileges(privileges);
    const now = Date.now();

    await this.#db.execute({
      sql:  `UPDATE admins SET privileges = ?, updated_at = ? WHERE admin_id = ?`,
      args: [JSON.stringify(safePrivileges), now, String(adminId)],
    });

    this.#cache = (this.#cache || []).map((a) =>
      a.adminId === adminId ? { ...a, privileges: safePrivileges, updatedAt: now } : a
    );
    return safePrivileges;
  }

  async deleteAdmin(adminId) {
    await this.#ensureTable();
    await this.#db.execute({ sql: `DELETE FROM admins WHERE admin_id = ?`, args: [String(adminId)] });
    this.#cache = (this.#cache || []).filter((a) => a.adminId !== adminId);
    return true;
  }

  async activateAdmin(adminId, tempPassword, newPlainPassword) {
    await this.#ensureTable();
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');
    if (admin.authorized) throw makeError('admins.alreadyActivated');

    const tempMatch = await bcrypt.compare(String(tempPassword), admin.passwordHash);
    if (!tempMatch) throw makeError('admins.wrongTemporaryPassword');

    this.validatePassword(newPlainPassword);
    const hash = await bcrypt.hash(String(newPlainPassword), BCRYPT_ROUNDS);
    const now  = Date.now();

    await this.#db.execute({
      sql:  `UPDATE admins SET password_hash = ?, authorized = 1, updated_at = ? WHERE admin_id = ?`,
      args: [hash, now, String(adminId)],
    });

    this.#cache = (this.#cache || []).map((a) =>
      a.adminId === adminId ? { ...a, passwordHash: hash, authorized: true, updatedAt: now } : a
    );
    return true;
  }

  async changeAdminLogin(adminId, newLogin, currentPlainPassword) {
    await this.#ensureTable();
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');

    const match = await bcrypt.compare(String(currentPlainPassword), admin.passwordHash);
    if (!match) throw makeError('admins.wrongPassword');

    const trimmedLogin = String(newLogin || '').trim();
    if (!trimmedLogin) throw makeError('admins.loginRequired');

    const conflict = await this.getAdminByLogin(trimmedLogin);
    if (conflict && conflict.adminId !== adminId) throw makeError('admins.loginTaken');

    const now = Date.now();
    await this.#db.execute({
      sql:  `UPDATE admins SET login = ?, updated_at = ? WHERE admin_id = ?`,
      args: [trimmedLogin, now, String(adminId)],
    });

    this.#cache = (this.#cache || []).map((a) =>
      a.adminId === adminId ? { ...a, login: trimmedLogin, updatedAt: now } : a
    );
    return true;
  }

  async changeAdminPassword(adminId, currentPlainPassword, newPlainPassword) {
    await this.#ensureTable();
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');

    const match = await bcrypt.compare(String(currentPlainPassword), admin.passwordHash);
    if (!match) throw makeError('admins.wrongPassword');

    this.validatePassword(newPlainPassword);
    const hash = await bcrypt.hash(String(newPlainPassword), BCRYPT_ROUNDS);
    const now  = Date.now();

    await this.#db.execute({
      sql:  `UPDATE admins SET password_hash = ?, updated_at = ? WHERE admin_id = ?`,
      args: [hash, now, String(adminId)],
    });

    this.#cache = (this.#cache || []).map((a) =>
      a.adminId === adminId ? { ...a, passwordHash: hash, updatedAt: now } : a
    );
    return true;
  }

  async resetAdminPassword(adminId, newPlainPassword) {
    await this.#ensureTable();
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');

    this.validatePassword(newPlainPassword);
    const hash = await bcrypt.hash(String(newPlainPassword), BCRYPT_ROUNDS);
    const now  = Date.now();

    await this.#db.execute({
      sql:  `UPDATE admins SET password_hash = ?, updated_at = ? WHERE admin_id = ?`,
      args: [hash, now, String(adminId)],
    });

    this.#cache = (this.#cache || []).map((a) =>
      a.adminId === adminId ? { ...a, passwordHash: hash, updatedAt: now } : a
    );
    return true;
  }

  async purgeExpiredAdmins() {
    await this.#ensureTable();
    const cutoff = Date.now() - ADMIN_TTL_MS;
    const result = await this.#db.execute({
      sql:  `DELETE FROM admins WHERE authorized = 0 AND created_at < ? RETURNING admin_id`,
      args: [cutoff],
    });
    const deletedIds = new Set((result.rows || []).map((r) => String(r.admin_id)));
    if (deletedIds.size) {
      this.#cache = (this.#cache || []).filter((a) => !deletedIds.has(a.adminId));
      console.log(`[AdminsGC] Purged ${deletedIds.size} expired unactivated admin(s):`, [...deletedIds]);
    }
    return deletedIds.size;
  }

  async importAdmins(records) {
    await this.#ensureTable();

    const { records: normalized, skipped } = normalizeAll(records, normalizeAdminRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (a) => a.login);

    await replaceTableRows(this.#db, {
      table: 'admins',
      columns: ['admin_id', 'login', 'password_hash', 'authorized', 'privileges', 'created_at', 'updated_at'],
      rows: unique.map((a) => [
        a.adminId, a.login, a.passwordHash, a.authorized ? 1 : 0,
        JSON.stringify(a.privileges), a.createdAt, a.updatedAt,
      ]),
    });

    this.#cache = [];
    this.#loaded = false;

    return { imported: unique.length, skipped, duplicates };
  }
}