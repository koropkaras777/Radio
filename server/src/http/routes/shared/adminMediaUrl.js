import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config/env.js';

export function requireAdminBearerOrQuery(req, res, next) {
  const token =
    (req.headers.authorization || '').replace('Bearer ', '').trim() ||
    String(req.query.adminToken || '').trim() ||
    String(req.cookies?.adminToken || '').trim();

  try {
    if (!token) throw new Error('missing');
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function absoluteMediaUrl(req, url) {
  const value = String(url || '');
  if (/^https?:\/\//i.test(value)) return value;

  const adminToken =
    (req.headers.authorization || '').replace('Bearer ', '').trim() ||
    String(req.cookies?.adminToken || '').trim();

  const separator = value.includes('?') ? '&' : '?';
  const suffix = adminToken ? `${separator}adminToken=${encodeURIComponent(adminToken)}` : '';

  return `${req.protocol}://${req.get('host')}${value}${suffix}`;
}
