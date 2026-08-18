import { Router }  from 'express';
import jwt          from 'jsonwebtoken';
import bcrypt       from 'bcrypt';
import { JWT_SECRET, IS_PROD, ADMIN_LOGIN, ADMIN_PASS } from '../../../config/env.js';
import { session }              from '../../../session/session.js';
import { requireAdmin, cookieOptions } from '../../../middleware/auth.js';
import { ALL_PRIVILEGES }       from '../../../config/privileges.js';

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

const sendLoginResponse = (res, tokenPayload) => {
  const token = signToken(tokenPayload);
  res.cookie('adminToken', token, cookieOptions(12 * 60 * 60 * 1000));
  res.json(IS_PROD ? { ok: true } : { ok: true, token });
};

export function createAuthRouter({ io, loginLimiter, dataProvider }) {
  const router = Router();

  router.post('/login', loginLimiter, async (req, res) => {
    const { login, password } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required.' });
    }

    if (ADMIN_LOGIN && login === ADMIN_LOGIN) {
      const storedHash    = ADMIN_PASS;
      const passwordMatch = await bcrypt.compare(String(password), storedHash).catch(() => false);
      if (!passwordMatch) {
        console.log('[Admin] Login failed: invalid super-admin credentials');
        return res.status(401).json({ error: 'Invalid login or password' });
      }
      console.log('[Admin] Super-admin token issued');
      return sendLoginResponse(res, {
        role: 'super_admin', adminId: 'super', login,
        privileges: ALL_PRIVILEGES, authorized: true,
      });
    }

    if (typeof dataProvider?.getAdminByLogin !== 'function') {
      console.log('[Admin] Login failed: the data provider stores no admin accounts');
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    const admin = await dataProvider.getAdminByLogin(String(login)).catch(() => null);
    if (!admin) {
      console.log('[Admin] Login failed: login not found');
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    const match = await bcrypt.compare(String(password), admin.passwordHash).catch(() => false);
    if (!match) {
      console.log('[Admin] Login failed: wrong password for', login);
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    console.log(`[Admin] Helper admin "${login}" token issued (authorized: ${admin.authorized})`);
    return sendLoginResponse(res, {
      role: 'admin', adminId: admin.adminId, login: admin.login,
      privileges: admin.privileges, authorized: admin.authorized,
    });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('adminToken', cookieOptions());
    console.log('[Admin] Cookie cleared on logout');
    res.json({ ok: true });
  });

  router.get('/verify', requireAdmin, async (req, res) => {
    const { role, privileges, authorized, adminId, login } = req.admin;

    if (role !== 'super_admin' && typeof dataProvider?.getAdminById === 'function') {
      const fresh = await dataProvider.getAdminById(adminId).catch(() => null);
      if (!fresh) {
        res.clearCookie('adminToken', cookieOptions());
        return res.status(401).json({ error: 'Admin account no longer exists.' });
      }
      const freshPayload = {
        ok: true, role, adminId: fresh.adminId, login: fresh.login,
        privileges: fresh.privileges, authorized: fresh.authorized,
      };
      return res.json(IS_PROD ? freshPayload : { ...freshPayload, token: req.cookies.adminToken });
    }

    const payload = { ok: true, role, adminId, login, privileges, authorized };
    return res.json(IS_PROD ? payload : { ...payload, token: req.cookies.adminToken });
  });

  return router;
}