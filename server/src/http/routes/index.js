import { join } from 'node:path';
import { CLIENT_DIST } from '../../config/paths.js';
import { initArtistArtsCache } from './shared/artistArtsCache.js';
import { createAuthRoutes }   from './auth/index.js';
import { createClientRoutes } from './client/index.js';
import { createAdminRoutes }  from './admin/index.js';
import { createMediaRoutes }  from './media/index.js';
import { attachDonationsWebhookRoutes } from './webhooks/donations.routes.js';

/**
 * @param {import('express').Application} app
 * @param {{ io, radioEngine, mediaProvider, fetchLyricsForSong, loginLimiter }} deps
 */
export function registerRoutes(app, deps) {
  initArtistArtsCache(deps.radioEngine);

  attachDonationsWebhookRoutes(deps.donationsWebhookRouter, deps);

  app.use(createAuthRoutes(deps));
  app.use(createClientRoutes(deps));
  app.use(createAdminRoutes(deps));
  app.use(createMediaRoutes(deps));
  
  app.get('*', (_req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
}