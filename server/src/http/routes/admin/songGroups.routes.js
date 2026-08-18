import { SUPER_ADMIN_LOGIN } from '../../../config/env.js';
import { Router } from 'express';
import { requireAdmin, requirePrivilege, getErrorPayload } from '../../../middleware/auth.js';
import { auditLogger, AUDIT_TYPES } from '../../../audit/auditLogger.js';
import { PRIVILEGES } from '../../../config/privileges.js';

export function createSongGroupsRouter({ radioEngine }) {
  const router = Router();

  router.get('/', requireAdmin, (req, res) => {
    try {
      res.json({ items: radioEngine.getSongGroups() });
    } catch (err) {
      console.error('[Song Groups API] List error:', err);
      res.status(500).json(getErrorPayload(err, 'queue.loadSongGroupsFailed'));
    }
  });

  router.get('/library', requireAdmin, (req, res) => {
    try {
      const { mode = 'day', query = '', offset = '0', limit = '5' } = req.query;
      const payload = radioEngine.getSongsForMode(mode, {
        query,
        offset: Math.max(0, Number(offset) || 0),
        limit:  Math.max(1, Math.min(50, Number(limit) || 5)),
      });
      res.json(payload);
    } catch (err) {
      console.error('[Song Groups API] Library error:', err);
      res.status(400).json(getErrorPayload(err, 'queue.loadSongsListFailed'));
    }
  });

  router.post(
    '/',
    requireAdmin,
    requirePrivilege(PRIVILEGES.SETTINGS_GROUPS),
    async (req, res) => {
      try {
        const result = await radioEngine.createSongGroup(req.body);
        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.GROUP_CREATE,
          data:          { name: req.body?.name || '' },
        }).catch(() => {});
        res.json(result);
      } catch (err) {
        console.error('[Song Groups API] Create error:', err);
        res.status(400).json(getErrorPayload(err, 'queue.createSongGroupFailed'));
      }
    },
  );

  router.put(
    '/:groupId',
    requireAdmin,
    requirePrivilege(PRIVILEGES.SETTINGS_GROUPS),
    async (req, res) => {
      try {
        const result = await radioEngine.updateSongGroup(req.params.groupId, req.body);
        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.GROUP_EDIT,
          data:          { name: req.body?.name || req.params.groupId },
        }).catch(() => {});
        res.json(result);
      } catch (err) {
        console.error('[Song Groups API] Update error:', err);
        res.status(400).json(getErrorPayload(err, 'queue.updateSongGroupFailed'));
      }
    },
  );

  router.delete(
    '/:groupId',
    requireAdmin,
    requirePrivilege(PRIVILEGES.SETTINGS_GROUPS),
    async (req, res) => {
      try {
        const result = await radioEngine.deleteSongGroup(req.params.groupId);
        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.GROUP_DELETE,
          data:          { groupId: req.params.groupId },
        }).catch(() => {});
        res.json(result);
      } catch (err) {
        console.error('[Song Groups API] Delete error:', err);
        res.status(400).json(getErrorPayload(err, 'queue.deleteSongGroupFailed'));
      }
    },
  );

  router.post(
    '/:groupId/insert',
    requireAdmin,
    requirePrivilege(PRIVILEGES.QUEUE_MANAGE),
    requirePrivilege(PRIVILEGES.SETTINGS_GROUPS),
    (req, res) => {
      try {
        const result = radioEngine.injectSongGroup(req.params.groupId);
        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.GROUP_INSERT,
          data:          { groupId: req.params.groupId },
        }).catch(() => {});
        res.json(result);
      } catch (err) {
        console.error('[Song Groups API] Insert error:', err);
        res.status(400).json(getErrorPayload(err, 'queue.insertSongGroupFailed'));
      }
    },
  );

  return router;
}