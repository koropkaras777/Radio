import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';

export function createAuthRoutes(deps) {
  const router = Router();
  router.use('/api/admin', createAuthRouter(deps));
  return router;
}