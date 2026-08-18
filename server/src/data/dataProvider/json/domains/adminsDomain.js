import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { makeError } from '../../../../i18n/index.js';
import { JsonStore } from '../shared/jsonStore.js';
import {
  BCRYPT_ROUNDS, ADMIN_TTL_MS, validatePassword, sanitizePrivileges,
} from '../../shared/adminRules.js';
import {
  normalizeAll, normalizeAdminRecord, dedupeBy,
} from '../../shared/importRecords.js';

export class AdminsDomain {
  #store;

  constructor(filePath) {
    this.#store = new JsonStore(filePath, []);
  }

  #clone(admin) {
    return admin ? { ...admin, privileges: [...admin.privileges] } : null;
  }

  validatePassword(password) {
    validatePassword(password);
  }

  async loadAdmins() {
    const admins = await this.#store.read();
    return admins.map((a) => this.#clone(a));
  }

  async getAdminById(adminId) {
    const admins = await this.#store.read();
    return this.#clone(admins.find((a) => a.adminId === String(adminId)));
  }

  async getAdminByLogin(login) {
    const admins = await this.#store.read();
    return this.#clone(admins.find((a) => a.login === String(login)));
  }

  async createAdmin({ login, plainPassword, privileges = [] }) {
    const trimmedLogin = String(login || '').trim();
    if (!trimmedLogin) throw makeError('admins.loginRequired');

    validatePassword(plainPassword);

    const safePrivileges = sanitizePrivileges(privileges);
    const hash = await bcrypt.hash(String(plainPassword), BCRYPT_ROUNDS);
    const now  = Date.now();

    return this.#store.update((admins) => {
      if (admins.some((a) => a.login === trimmedLogin)) throw makeError('admins.loginTaken');

      const admin = {
        adminId:      randomUUID(),
        login:        trimmedLogin,
        passwordHash: hash,
        authorized:   false,
        privileges:   safePrivileges,
        createdAt:    now,
        updatedAt:    now,
      };

      return { value: [...admins, admin], result: this.#clone(admin) };
    });
  }

  async updateAdminPrivileges(adminId, privileges) {
    const safePrivileges = sanitizePrivileges(privileges);
    const now = Date.now();

    return this.#store.update((admins) => ({
      value: admins.map((a) =>
        a.adminId === String(adminId) ? { ...a, privileges: safePrivileges, updatedAt: now } : a
      ),
      result: safePrivileges,
    }));
  }

  async deleteAdmin(adminId) {
    return this.#store.update((admins) => ({
      value: admins.filter((a) => a.adminId !== String(adminId)),
      result: true,
    }));
  }

  async activateAdmin(adminId, tempPassword, newPlainPassword) {
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');
    if (admin.authorized) throw makeError('admins.alreadyActivated');

    const tempMatch = await bcrypt.compare(String(tempPassword), admin.passwordHash);
    if (!tempMatch) throw makeError('admins.wrongTemporaryPassword');

    validatePassword(newPlainPassword);
    const hash = await bcrypt.hash(String(newPlainPassword), BCRYPT_ROUNDS);
    const now  = Date.now();

    return this.#store.update((admins) => ({
      value: admins.map((a) =>
        a.adminId === String(adminId)
          ? { ...a, passwordHash: hash, authorized: true, updatedAt: now }
          : a
      ),
      result: true,
    }));
  }

  async changeAdminLogin(adminId, newLogin, currentPlainPassword) {
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');

    const match = await bcrypt.compare(String(currentPlainPassword), admin.passwordHash);
    if (!match) throw makeError('admins.wrongPassword');

    const trimmedLogin = String(newLogin || '').trim();
    if (!trimmedLogin) throw makeError('admins.loginRequired');

    const now = Date.now();

    return this.#store.update((admins) => {
      const conflict = admins.find((a) => a.login === trimmedLogin && a.adminId !== String(adminId));
      if (conflict) throw makeError('admins.loginTaken');

      return {
        value: admins.map((a) =>
          a.adminId === String(adminId) ? { ...a, login: trimmedLogin, updatedAt: now } : a
        ),
        result: true,
      };
    });
  }

  async changeAdminPassword(adminId, currentPlainPassword, newPlainPassword) {
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');

    const match = await bcrypt.compare(String(currentPlainPassword), admin.passwordHash);
    if (!match) throw makeError('admins.wrongPassword');

    validatePassword(newPlainPassword);
    const hash = await bcrypt.hash(String(newPlainPassword), BCRYPT_ROUNDS);
    const now  = Date.now();

    return this.#store.update((admins) => ({
      value: admins.map((a) =>
        a.adminId === String(adminId) ? { ...a, passwordHash: hash, updatedAt: now } : a
      ),
      result: true,
    }));
  }

  async resetAdminPassword(adminId, newPlainPassword) {
    const admin = await this.getAdminById(adminId);
    if (!admin) throw makeError('admins.notFound');

    validatePassword(newPlainPassword);
    const hash = await bcrypt.hash(String(newPlainPassword), BCRYPT_ROUNDS);
    const now  = Date.now();

    return this.#store.update((admins) => ({
      value: admins.map((a) =>
        a.adminId === String(adminId) ? { ...a, passwordHash: hash, updatedAt: now } : a
      ),
      result: true,
    }));
  }

  async purgeExpiredAdmins() {
    const cutoff = Date.now() - ADMIN_TTL_MS;

    return this.#store.update((admins) => {
      const expired = admins.filter((a) => !a.authorized && a.createdAt < cutoff);
      if (!expired.length) return { value: admins, result: 0 };

      console.log(
        `[AdminsGC] Purged ${expired.length} expired unactivated admin(s):`,
        expired.map((a) => a.adminId)
      );

      const keep = admins.filter((a) => a.authorized || a.createdAt >= cutoff);
      return { value: keep, result: expired.length };
    });
  }

  async importAdmins(records) {
    const { records: normalized, skipped } = normalizeAll(records, normalizeAdminRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (a) => a.login);

    await this.#store.update(() => ({ value: unique, result: undefined }));
    return { imported: unique.length, skipped, duplicates };
  }
}
