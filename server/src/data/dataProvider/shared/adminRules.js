import { makeError } from '../../../i18n/index.js';

export const BCRYPT_ROUNDS = 12;

export const ADMIN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} password
 * @throws {Error} localized error describing the first unmet requirement
 */
export function validatePassword(password) {
  const p = String(password || '');
  if (p.length < 8)     throw makeError('admins.passwordMinLength');
  if (!/[A-Z]/.test(p)) throw makeError('admins.passwordNeedUppercase');
  if (!/[a-z]/.test(p)) throw makeError('admins.passwordNeedLowercase');
  if (!/[0-9]/.test(p)) throw makeError('admins.passwordNeedDigit');
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function sanitizePrivileges(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const set = new Set(list.filter((p) => typeof p === 'string' && p.trim()));
  set.add('stats');
  return [...set];
}
