import { SUPER_ADMIN_LOGIN } from '../../../config/env.js';
import { Router } from 'express';
import { requireAdmin, requirePrivilege, getErrorPayload } from '../../../middleware/auth.js';
import { session, socketHasPrivilege } from '../../../session/session.js';
import { ALL_PRIVILEGES, PRIVILEGES } from '../../../config/privileges.js';
import { t } from '../../../i18n/index.js';
import { auditLogger, AUDIT_TYPES } from '../../../audit/auditLogger.js';
import { requireCapability } from '../shared/capabilities.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== 'super_admin') {
    return res.status(403).json({ error: t('admins.superAdminOnly') });
  }
  next();
};

const forceLogoutAdmin = (io, adminId) => {
  for (const [socketId, entry] of session.activeAdminSockets.entries()) {
    if (entry.adminId === adminId) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.emit('force_logout', { reason: 'admin_deleted' });
      session.activeAdminSockets.delete(socketId);
    }
  }
};

const softUpdateAdmin = (io, adminId, newPrivileges, authorized) => {
  for (const [socketId, entry] of session.activeAdminSockets.entries()) {
    if (entry.adminId === adminId) {
      entry.privileges = newPrivileges;
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.emit('privileges_updated', {
        privileges: newPrivileges,
        authorized: authorized ?? entry.authorized,
      });
    }
  }
};

const broadcastAdminOnline = (io) => {
  let hasQueue = false;
  for (const entry of session.activeAdminSockets.values()) {
    if (Array.isArray(entry.privileges) && entry.privileges.includes(PRIVILEGES.QUEUE_MANAGE)) {
      hasQueue = true;
      break;
    }
  }
  io.emit('admin_online', hasQueue);
};

// ── Public list of privilege IDs (for the client to render UI) ────────────────
const ALL_PRIVILEGE_IDS = Object.values(PRIVILEGES);

export function createAdminsRouter({ io, dataProvider, mediaProvider }) {
  const canManageAdmins   = requireCapability('helperAdmins', { mediaProvider, dataProvider });
  const canEditOwnAccount = requireCapability('adminAccount', { mediaProvider, dataProvider });

  const router = Router();

  // ── GET /admins - list all helper admins (super_admin only) ───────────────
  router.get('/', requireAdmin, requireSuperAdmin, canManageAdmins, async (req, res) => {
    try {
      const admins = await dataProvider.loadAdmins();
      const safe = admins.map(({ passwordHash: _, ...a }) => a);
      res.json({ ok: true, admins: safe, allPrivileges: ALL_PRIVILEGE_IDS });
    } catch (err) {
      console.error('[Admins] list error:', err);
      res.status(500).json(getErrorPayload(err, 'admins.loadFailed'));
    }
  });

  // ── POST /admins - create helper admin (super_admin only) ─────────────────
  router.post('/', requireAdmin, requireSuperAdmin, canManageAdmins, async (req, res) => {
    const { login, password, privileges = [] } = req.body || {};

    try {
      const admin = await dataProvider.createAdmin({ login, plainPassword: password, privileges });
      const { passwordHash: _, ...safe } = admin;
      auditLogger.log({
        adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.ADMIN_CREATE,
        data:          { login: safe.login, adminId: safe.adminId },
      }).catch(() => {});
      res.json({ ok: true, admin: safe, message: t('admins.created') });
    } catch (err) {
      console.error('[Admins] create error:', err);
      res.status(400).json(getErrorPayload(err, 'admins.createFailed'));
    }
  });

  // ── PUT /admins/:id/privileges - update privileges (super_admin only) ──────
  router.put('/:id/privileges', requireAdmin, requireSuperAdmin, canManageAdmins, async (req, res) => {
    const { privileges } = req.body || {};
    const { id } = req.params;

    try {
      const newPrivileges = await dataProvider.updateAdminPrivileges(id, privileges);
      const fresh = await dataProvider.getAdminById(id).catch(() => null);
      softUpdateAdmin(io, id, newPrivileges, fresh?.authorized ?? true);
      broadcastAdminOnline(io);
      auditLogger.log({
        adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.ADMIN_PRIVILEGES,
        data:          { targetAdminId: id, login: fresh?.login || id, privileges: newPrivileges },
      }).catch(() => {});
      res.json({
        ok: true,
        privileges: newPrivileges,
        message: t('admins.privilegesUpdated'),
      });
    } catch (err) {
      console.error('[Admins] update privileges error:', err);
      res.status(400).json(getErrorPayload(err, 'admins.privilegesUpdateFailed'));
    }
  });

  // ── PUT /admins/:id/reset-password - reset password to another admin (super_admin only) ──
  router.put('/:id/reset-password', requireAdmin, requireSuperAdmin, canManageAdmins, async (req, res) => {
    const { newPassword } = req.body || {};
    const { id } = req.params;

    try {
      await dataProvider.resetAdminPassword(id, newPassword);
      const fresh = await dataProvider.getAdminById(id).catch(() => null);
      forceLogoutAdmin(io, id);
      auditLogger.log({
        adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.ADMIN_PASSWORD_RESET,
        data:          { targetAdminId: id, login: fresh?.login || id },
      }).catch(() => {});
      res.json({ ok: true, message: t('admins.passwordReset') });
    } catch (err) {
      console.error('[Admins] reset password error:', err);
      res.status(400).json(getErrorPayload(err, 'admins.passwordResetFailed'));
    }
  });

  // ── DELETE /admins/:id - delete helper admin (super_admin only) ───────────
  router.delete('/:id', requireAdmin, requireSuperAdmin, canManageAdmins, async (req, res) => {
    const { id } = req.params;

    try {
      const adminToDelete = await dataProvider.getAdminById(id).catch(() => null);
      forceLogoutAdmin(io, id);
      await dataProvider.deleteAdmin(id);
      broadcastAdminOnline(io);
      auditLogger.log({
        adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.ADMIN_DELETE,
        data:          { targetAdminId: id, login: adminToDelete?.login || id },
      }).catch(() => {});
      res.json({ ok: true, message: t('admins.deleted') });
    } catch (err) {
      console.error('[Admins] delete error:', err);
      res.status(400).json(getErrorPayload(err, 'admins.deleteFailed'));
    }
  });

  // ── POST /admins/self/activate - first-login activation ──────────────────
  router.post('/self/activate', requireAdmin, canEditOwnAccount, async (req, res) => {
    if (req.admin.role === 'super_admin') {
      return res.status(400).json({ error: t('admins.notApplicableForSuperAdmin') });
    }
    const { tempPassword, newPassword } = req.body || {};

    try {
      await dataProvider.activateAdmin(req.admin.adminId, tempPassword, newPassword);

      const fresh = await dataProvider.getAdminById(req.admin.adminId);
      if (fresh) {
        for (const [socketId, entry] of session.activeAdminSockets.entries()) {
          if (entry.adminId === req.admin.adminId) {
            entry.authorized = true;
            const sock = io.sockets.sockets.get(socketId);
            if (sock) sock.emit('privileges_updated', { privileges: fresh.privileges, authorized: true });
          }
        }
        for (const [socketId, entry] of session.activeAdminSockets.entries()) {
          if (entry.role === 'super_admin') {
            const sock = io.sockets.sockets.get(socketId);
            if (sock) sock.emit('admin_authorized', {
              adminId:    req.admin.adminId,
              login:      fresh.login,
              authorized: true,
            });
          }
        }
      }

      auditLogger.log({
        adminId:       req.admin.adminId,
        operationType: AUDIT_TYPES.ADMIN_ACTIVATE,
        data:          { login: fresh?.login || req.admin.adminId },
      }).catch(() => {});

      res.json({ ok: true, message: t('admins.activated') });
    } catch (err) {
      console.error('[Admins] activate error:', err);
      res.status(400).json(getErrorPayload(err, 'admins.activateFailed'));
    }
  });

  // ── PUT /admins/self/login - change own login ─────────────────────────────
  router.put('/self/login', requireAdmin, canEditOwnAccount, async (req, res) => {
    if (req.admin.role === 'super_admin') {
      return res.status(400).json({ error: t('admins.notApplicableForSuperAdmin') });
    }
    const { newLogin, currentPassword } = req.body || {};

    try {
      await dataProvider.changeAdminLogin(req.admin.adminId, newLogin, currentPassword);
      auditLogger.log({
        adminId:       req.admin.adminId,
        operationType: AUDIT_TYPES.ADMIN_LOGIN_CHANGE,
        data:          { newLogin },
      }).catch(() => {});
      res.json({ ok: true, message: t('admins.loginUpdated') });
    } catch (err) {
      console.error('[Admins] change login error:', err);
      res.status(400).json(getErrorPayload(err, 'admins.loginUpdateFailed'));
    }
  });

  // ── PUT /admins/self/password - change own password ───────────────────────
  router.put('/self/password', requireAdmin, canEditOwnAccount, async (req, res) => {
    if (req.admin.role === 'super_admin') {
      return res.status(400).json({ error: t('admins.notApplicableForSuperAdmin') });
    }
    const { currentPassword, newPassword } = req.body || {};

    try {
      await dataProvider.changeAdminPassword(req.admin.adminId, currentPassword, newPassword);
      auditLogger.log({
        adminId:       req.admin.adminId,
        operationType: AUDIT_TYPES.ADMIN_PASSWORD_CHANGE,
        data:          {},
      }).catch(() => {});
      res.json({ ok: true, message: t('admins.passwordUpdated') });
    } catch (err) {
      console.error('[Admins] change password error:', err);
      res.status(400).json(getErrorPayload(err, 'admins.passwordUpdateFailed'));
    }
  });

  return router;
}
