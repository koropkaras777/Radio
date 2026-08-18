import { Router } from 'express';

const RECENT_LIMIT = 10;

export function createHistoryRouter({ dataProvider }) {
  const router = Router();

  // ── Public: last played songs ───────────────────────────────────────────────
  router.get('/history', async (req, res) => {
    try {
      const entries = await dataProvider.history.getRecentPlays(RECENT_LIMIT + 1);
      res.json(entries.slice(1));
    } catch (err) {
      console.error('[History API] Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}
