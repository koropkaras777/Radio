import { createHmac, timingSafeEqual } from 'node:crypto';

import { ART_TOKEN_SECRET as AUDIO_SECRET } from '../config/env.js';
const KEY_TTL_MS   = 12 * 60 * 60 * 1000;

const toBase64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const fromBase64url = (str) =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const signHmac = (payload) =>
  createHmac('sha256', AUDIO_SECRET).update(payload).digest();

export function issueAudioKey(uid) {
  if (!uid || typeof uid !== 'string') throw new Error('uid required');

  const issuedAt  = Date.now();
  const expiresIn = Math.ceil(KEY_TTL_MS / 1000);
  const payload   = `${uid}.${issuedAt}`;
  const mac       = signHmac(payload);
  const token     = `${payload}.${toBase64url(mac)}`;

  console.log(`[AudioKey] Issued token for UID ${uid.slice(0, 8)}…`);
  return { token, expiresIn };
}

export function verifyAudioToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [uid, issuedAtStr, macB64] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!uid || !Number.isFinite(issuedAt)) return null;

  const age = Date.now() - issuedAt;
  if (age < 0 || age > KEY_TTL_MS) return null;

  const payload = `${uid}.${issuedAt}`;
  const expectedMac = signHmac(payload);
  const actualMac = fromBase64url(macB64);

  if (expectedMac.length !== actualMac.length) return null;
  if (!timingSafeEqual(expectedMac, actualMac)) return null;

  return { uid, issuedAt };
}