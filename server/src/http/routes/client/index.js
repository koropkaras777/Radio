import { Router } from 'express';
import { createLibraryRouter }         from './library.routes.js';
import { createConfigRouter }          from './config.routes.js';
import { createEncryptedAssetsRouter } from './encryptedAssets.routes.js';
import { createLyricsRouter }          from './lyrics.routes.js';
import { createStreamRouter }          from './stream.routes.js';
import { createHistoryRouter }         from './history.routes.js';
import { createDonationsRouter }       from './donations.routes.js';
import { requireCapability }           from '../shared/capabilities.js';

export function createClientRoutes(deps) {
  const router = Router();
  router.use('/api', createLibraryRouter(deps));
  router.use('/api', createConfigRouter(deps));
  router.use('/api', createEncryptedAssetsRouter(deps));
  router.use('/api', createLyricsRouter(deps));
  router.use('/api/stream', createStreamRouter(deps));
  router.use('/api', createHistoryRouter(deps));
  router.use('/api/public', requireCapability('donations', deps), createDonationsRouter(deps));
  return router;
}