import { xorBuffer } from '../../../tokens/artToken.js';

/**
 * @param {import('express').Response} res
 * @param {Buffer} keyBuf
 * @param {Buffer} plainBuf
 * @param {{ mime?: string }} [opts]
 */
export function sendEncrypted(res, keyBuf, plainBuf, opts = {}) {
  const encrypted = xorBuffer(plainBuf, keyBuf);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');

  if (opts.mime) {
    res.setHeader('Access-Control-Expose-Headers', 'X-Art-Mime');
    res.setHeader('X-Art-Mime', opts.mime);
  }

  res.end(encrypted);
}