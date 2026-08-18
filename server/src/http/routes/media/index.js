import { Router } from 'express';
import { createMediaUrlsRouter } from './mediaUrls.routes.js';
import { artistArtsIndexCache } from '../shared/artistArtsCache.js';

export function createMediaRoutes(deps) {
  const router = Router();
  router.use('/api', createMediaUrlsRouter({ ...deps, artistArtsIndexCache }));
  return router;
}