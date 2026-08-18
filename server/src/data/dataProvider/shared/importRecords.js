import { randomUUID } from 'node:crypto';
import { sanitizePrivileges } from './adminRules.js';

const trimmed = (value) => String(value ?? '').trim();

const finiteOrNull = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const timestamp = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

export function normalizeMediaLibraryRecord(record) {
  const filename = trimmed(record?.filename);
  if (!filename) return null;

  return {
    id:        trimmed(record?.id) || randomUUID(),
    filename,
    mode:      record?.mode === 'night' ? 'night' : 'day',
    used:      record?.used === undefined ? true : Boolean(record.used),
    duration:  finiteOrNull(record?.duration),
    createdAt: timestamp(record?.createdAt, Date.now()),
  };
}

export function normalizeAdminRecord(record) {
  const adminId      = trimmed(record?.adminId);
  const login        = trimmed(record?.login);
  const passwordHash = trimmed(record?.passwordHash);

  if (!adminId || !login || !passwordHash) return null;

  const createdAt = timestamp(record?.createdAt, Date.now());

  return {
    adminId,
    login,
    passwordHash,
    authorized: Boolean(record?.authorized),
    privileges: sanitizePrivileges(record?.privileges ?? []),
    createdAt,
    updatedAt:  timestamp(record?.updatedAt, createdAt),
  };
}

export function normalizeBannedIpRecord(record) {
  const ip = trimmed(record?.ip);
  if (!ip) return null;

  return {
    ip,
    nickname: trimmed(record?.nickname),
    bannedAt: timestamp(record?.bannedAt, Date.now()),
    bannedBy: trimmed(record?.bannedBy),
  };
}

export function normalizeAuditEntry(record) {
  const adminId       = trimmed(record?.adminId);
  const operationType = trimmed(record?.operationType);

  if (!adminId || !operationType) return null;

  let data = record?.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  if (!data || typeof data !== 'object') data = {};

  return {
    adminId,
    operationType,
    data,
    createdAt: timestamp(record?.createdAt, Date.now()),
  };
}

export function normalizeHistoryEntry(record) {
  const trackId = trimmed(record?.trackId);
  const title   = trimmed(record?.title);
  const artist  = trimmed(record?.artist);

  if (!trackId || !title || !artist) return null;

  return {
    trackId,
    title,
    artist,
    album:    trimmed(record?.album),
    mode:     record?.mode === 'night' ? 'night' : 'day',
    playedAt: timestamp(record?.playedAt, Date.now()),
  };
}

/**
 * @template T
 * @param {unknown} items
 * @param {(record: unknown) => (T | null)} normalize
 * @returns {{ records: T[], skipped: number }}
 */
export function normalizeAll(items, normalize) {
  const list = Array.isArray(items) ? items : [];
  const records = [];
  let skipped = 0;

  for (const item of list) {
    const record = normalize(item);
    if (record) records.push(record);
    else skipped += 1;
  }

  return { records, skipped };
}

/**
 * @template T
 * @param {T[]} records
 * @param {(record: T) => string} keyOf
 * @returns {{ records: T[], duplicates: number }}
 */
export function dedupeBy(records, keyOf) {
  const seen = new Set();
  const kept = [];
  let duplicates = 0;

  for (const record of records) {
    const key = keyOf(record);
    if (seen.has(key)) { duplicates += 1; continue; }
    seen.add(key);
    kept.push(record);
  }

  return { records: kept, duplicates };
}
