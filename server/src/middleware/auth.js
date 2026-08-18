import jwt from 'jsonwebtoken';
import { JWT_SECRET, IS_PROD } from '../config/env.js';
import { t } from '../i18n/index.js';

export const verifyAdminToken = (token) =>
  new Promise((resolve, reject) => {
    if (!token) return reject(new Error('No token'));
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      const role = decoded?.role;
      if (err || (role !== 'super_admin' && role !== 'admin')) {
        return reject(err || new Error('Forbidden'));
      }
      resolve(decoded);
    });
  });

export const requireAdmin = (req, res, next) => {
  const cookieToken = req.cookies?.adminToken;
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || bearerToken;
  if (!token) return res.status(401).json({ error: t('auth.unauthorized') });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    const role = decoded?.role;
    if (err || (role !== 'super_admin' && role !== 'admin')) {
      return res.status(401).json({ error: t('auth.unauthorized') });
    }
    req.admin = decoded;
    next();
  });
};

export const requirePrivilege = (privilege) => (req, res, next) => {
  const check = (decoded) => {
    const privs = Array.isArray(decoded?.privileges) ? decoded.privileges : [];
    if (!privs.includes(privilege)) {
      return res.status(403).json({
        error: t('auth.insufficientPrivilegesForAction'),
      });
    }
    next();
  };

  if (req.admin) return check(req.admin);

  const cookieToken = req.cookies?.adminToken;
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || bearerToken;
  if (!token) return res.status(401).json({ error: t('auth.unauthorized') });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    const role = decoded?.role;
    if (err || (role !== 'super_admin' && role !== 'admin')) {
      return res.status(401).json({ error: t('auth.unauthorized') });
    }
    req.admin = decoded;
    check(decoded);
  });
};

export const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure  : IS_PROD,
  sameSite: IS_PROD ? 'none' : 'lax',
  ...(maxAge !== undefined && { maxAge }),
});

export const getErrorPayload = (err, key, params = {}) => {
  const fallback = t(key, params);
  return {
    error  : err?.localized || fallback,
    message: err?.localized || fallback,
  };
};
