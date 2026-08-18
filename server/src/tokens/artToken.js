import { createHmac, timingSafeEqual } from 'node:crypto';

// ─── Config ───────────────────────────────────────────────────────────────────
import { ART_TOKEN_SECRET } from '../config/env.js';
const TOKEN_TTL_MS     = 60 * 60 * 1000;
 
// ─── In-memory token cache: uid → { token, keyBuf, issuedAt } ────────────────
const tokenCache = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toBase64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const fromBase64url = (str) =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const hmacBuf = (payload) =>
  createHmac('sha256', ART_TOKEN_SECRET).update(payload).digest();

// ─── Public API ───────────────────────────────────────────────────────────────
export function getOrCreateArtToken(uid) {
  const cached = tokenCache.get(uid);
  if (cached && Date.now() - cached.issuedAt < TOKEN_TTL_MS) {
    return { token: cached.token, keyBuf: cached.keyBuf, isNew: false };
  }

  const issuedAt = Date.now();
  const payload  = `${uid}.${issuedAt}`;
  const mac      = hmacBuf(payload);
  const token    = `${toBase64url(Buffer.from(payload))}.${toBase64url(mac)}`;

  tokenCache.set(uid, { token, keyBuf: mac, issuedAt });
  return { token, keyBuf: mac, isNew: true };
}

export function verifyArtToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const payloadBuf  = fromBase64url(parts[0]);
    const macBufGiven = fromBase64url(parts[1]);
    const payload     = payloadBuf.toString();

    const dotIdx = payload.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const issuedAt = parseInt(payload.slice(dotIdx + 1), 10);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return null;

    const macExpected = hmacBuf(payload);
    if (macBufGiven.length !== macExpected.length) return null;
    if (!timingSafeEqual(macBufGiven, macExpected)) return null;

    return macExpected;
  } catch {
    return null;
  }
}

export function xorBuffer(data, key) {
  const out = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ key[i % key.length];
  }
  return out;
}

export function tokenTtlMs(uid) {
  const cached = tokenCache.get(uid);
  if (!cached) return 0;
  return Math.max(0, TOKEN_TTL_MS - (Date.now() - cached.issuedAt));
}