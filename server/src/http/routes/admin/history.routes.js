import { Router } from 'express';
import { requireAdmin, requirePrivilege } from '../../../middleware/auth.js';
import { PRIVILEGES } from '../../../config/privileges.js';

export function createHistoryRouter({ dataProvider }) {
  const router = Router();

  // ── Full play history ────────────────────────────────────────────────────
  router.get('/', requireAdmin, requirePrivilege(PRIVILEGES.STATS), async (req, res) => {
    try {
      const entries = await dataProvider.history.loadHistory();
      res.json({ ok: true, entries, total: entries.length });
    } catch (err) {
      console.error('[History] query error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}
