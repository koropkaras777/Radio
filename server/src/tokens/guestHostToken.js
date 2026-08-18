import { randomBytes } from 'node:crypto';

let active = null;

const CODE_BYTES = 9;

// ── Anti-bruteforce on special_guest_connect ─────────────
const MAX_ATTEMPTS_PER_HOUR = 3;
const ATTEMPT_WINDOW_MS     = 60 * 60 * 1000;

/** @type {Map<string, { count: number, windowStart: number }>} */
const failedAttemptsByIp = new Map();

function pruneAttemptWindow(ip) {
  const entry = failedAttemptsByIp.get(ip);
  if (!entry) return null;
  if (Date.now() - entry.windowStart >= ATTEMPT_WINDOW_MS) {
    failedAttemptsByIp.delete(ip);
    return null;
  }
  return entry;
}

/** @returns {boolean} true if this IP has exhausted its attempts for the current hour window */
export function isGuestCodeRateLimited(ip) {
  const entry = pruneAttemptWindow(ip);
  return Boolean(entry && entry.count >= MAX_ATTEMPTS_PER_HOUR);
}

export function registerFailedGuestCodeAttempt(ip) {
  const entry = pruneAttemptWindow(ip);
  if (entry) {
    entry.count += 1;
  } else {
    failedAttemptsByIp.set(ip, { count: 1, windowStart: Date.now() });
  }
}

function generateCodeString() {
  return randomBytes(CODE_BYTES)
    .toString('base64')
    .replace(/\+/g, '0')
    .replace(/\//g, '1')
    .replace(/=+$/, '');
}

function clearExpireTimer() {
  if (active?.expireTimer) clearTimeout(active.expireTimer);
}

/**
 * @param {number} ttlHours
 * @param {(reason: 'expired') => void} [onExpire] called when the code lapses on its own
 * @returns {{ code: string, expiresAt: number }}
 */
export function generateGuestCode(ttlHours, onExpire) {
  clearExpireTimer();
  const code      = generateCodeString();
  const issuedAt  = Date.now();
  const ttlMs     = Math.max(1, Number(ttlHours) || 8) * 60 * 60 * 1000;
  const expiresAt = issuedAt + ttlMs;

  const expireTimer = setTimeout(() => {
    if (active?.code === code) {
      active = null;
      onExpire?.('expired');
    }
  }, ttlMs);
  expireTimer.unref?.();

  active = { code, issuedAt, expiresAt, expireTimer };
  return { code, expiresAt };
}

export function deactivateGuestCode() {
  clearExpireTimer();
  active = null;
}

/** @returns {{ code: string, expiresAt: number } | null} */
export function getActiveGuestCode() {
  if (!active) return null;
  return { code: active.code, expiresAt: active.expiresAt };
}

export function isGuestCodeValid(code) {
  return Boolean(active && active.code === code && active.expiresAt > Date.now());
}

export function regenerateGuestCode(ttlHours, onExpire) {
  clearExpireTimer();
  active = null;
  return generateGuestCode(ttlHours, onExpire);
}