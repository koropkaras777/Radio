import { randomInt } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH   = 6;

export function generateMatchCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

const MATCH_CODE_RE = new RegExp(`\\b[${CODE_ALPHABET}]{${CODE_LENGTH}}\\b`, 'i');

export function extractMatchCode(text) {
  const match = MATCH_CODE_RE.exec(String(text || '').toUpperCase());
  return match ? match[0] : null;
}
