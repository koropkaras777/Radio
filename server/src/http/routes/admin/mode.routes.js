import { SUPER_ADMIN_LOGIN, TIME_ZONE } from '../../../config/env.js';
import { Router } from 'express';
import { requireAdmin, requirePrivilege } from '../../../middleware/auth.js';
import { auditLogger, AUDIT_TYPES } from '../../../audit/auditLogger.js';
import { PRIVILEGES } from '../../../config/privileges.js';
import { t } from '../../../i18n/index.js';

export function createModeRouter({ radioEngine }) {
  const router = Router();

  // ── Mode switch ───────────────────────────────────────────────────────────
  router.post(
    '/switch-mode',
    requireAdmin,
    requirePrivilege(PRIVILEGES.MODE_SWITCH),
    (req, res) => {
      const { targetMode, scheduledTime } = req.body;
      if (targetMode !== 'day' && targetMode !== 'night') {
        return res.status(400).json({ error: t('queue.invalidMode') });
      }

      let scheduledAtMs = null;
      if (scheduledTime) {
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(scheduledTime);
        if (!match) {
          return res.status(400).json({ error: t('queue.invalidScheduledTime') });
        }
        const [, hh, mm] = match;
        const tz = TIME_ZONE;
        const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
        const candidate = new Date(nowLocal);
        candidate.setHours(parseInt(hh), parseInt(mm), 0, 0);
        if (candidate.getTime() <= nowLocal.getTime()) {
          candidate.setDate(candidate.getDate() + 1);
        }
        const nowUTC = Date.now();
        const offsetMs = nowUTC - nowLocal.getTime();
        scheduledAtMs = candidate.getTime() + offsetMs;
      }

      const result = radioEngine.requestModeSwitch(targetMode, scheduledAtMs);
      if (!result.ok) {
        return res.status(409).json({ error: result.error, donated: result.donated || false });
      }
      auditLogger.log({
        adminId:       req.admin.adminId || 'super',
        adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.MODE_SWITCH,
        data:          { targetMode, ...(scheduledTime ? { scheduledTime } : {}) },
      }).catch(() => {});
      return res.json({ ok: true });
    },
  );

  return router;
}