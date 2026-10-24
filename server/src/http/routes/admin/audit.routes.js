import { Router } from 'express';
import { requireAdmin, getErrorPayload } from '../../../middleware/auth.js';
import { auditLogger } from '../../../audit/auditLogger.js';
import { LOG_RETENTION_DAYS } from '../../../config/env.js';
import { LOG_WINDOWS as WINDOWS } from '../../../audit/logWindows.js';


export function createAuditRouter() {
  const router = Router();

  // ── GET /audit - paginated audit log (always from in-memory cache) ────────
  router.get('/', requireAdmin, (req, res) => {
    try {
      const windowKey = String(req.query.window || '24h');
      const windowMs  = WINDOWS[windowKey] ?? WINDOWS['24h'];
      const since     = Date.now() - windowMs;
      const limit     = Math.max(1, Number(req.query.limit)  || 30);
      const offset    = Math.max(0,                Number(req.query.offset) || 0);

      const { entries, total } = auditLogger.getCached({ since, limit, offset });

      res.json({ ok: true, entries, total, offset, limit, retentionDays: LOG_RETENTION_DAYS });
    } catch (err) {
      console.error('[Audit] query error:', err);
      res.status(500).json(getErrorPayload(err, 'audit.loadFailed'));
    }
  });

  return router;
}
