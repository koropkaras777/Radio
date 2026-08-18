import { Router }       from 'express';
import { radioStream }  from '../../../stream/radioStream.js';
import { STREAM_MODE }  from '../../../config/env.js';
import { requireArtTokenOnly } from '../shared/requireMediaTokens.js';

function requireStreamReady(req, res, next) {
  if (!STREAM_MODE) {
    return res.status(404).json({ error: 'Stream mode is not enabled.' });
  }
  if (!radioStream.isInitialized) {
    return res.status(503).json({ error: 'Stream not ready.' });
  }
  next();
}

export function createStreamRouter() {
  const router = Router();

  // ── GET /stream ───────────────────────────────────────────────────────────
  router.get('/', requireStreamReady, requireArtTokenOnly, (req, res) => {
    radioStream.pipeToResponse(res, { icy: req.headers['icy-metadata'] === '1' });
  });

  // ── GET /stream/public.mp3 - permanent, tokenless link for external players ─
  router.get('/public.mp3', requireStreamReady, (req, res) => {
    radioStream.pipeToResponse(res, { icy: req.headers['icy-metadata'] === '1' });
  });

  return router;
}
