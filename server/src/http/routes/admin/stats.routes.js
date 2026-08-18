import { Router } from 'express';
import { requireAdmin, requirePrivilege } from '../../../middleware/auth.js';
import { PRIVILEGES } from '../../../config/privileges.js';
import { t } from '../../../i18n/index.js';

export function createStatsRouter({ radioEngine }) {
  const router = Router();

  // ── Stats ─────────────────────────────────────────────────────────────────
  router.get(
    '/',
    requireAdmin,
    requirePrivilege(PRIVILEGES.STATS),
    (req, res) => {
      try {
        res.json(radioEngine.getAdminStats());
      } catch (err) {
        console.error('[Stats] Error:', err);
        res.status(500).json({ error: t('queue.statsFailed') });
      }
    },
  );

  return router;
}