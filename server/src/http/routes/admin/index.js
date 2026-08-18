import { Router } from 'express';
import { createAdminsRouter }          from './admins.routes.js';
import { createAuditRouter }           from './audit.routes.js';
import { createHistoryRouter }         from './history.routes.js';
import { createSettingsRouter }        from './settings.routes.js';
import { createModeRouter }            from './mode.routes.js';
import { createStatsRouter }           from './stats.routes.js';
import { createSongGroupsRouter }      from './songGroups.routes.js';
import { createLyricsRouter }          from './lyrics.routes.js';
import { createArtistArtsRouter }      from './artistArts.routes.js';
import { createSongsRouter }           from './songs/songs.routes.js';
import { createYoutubeRouter }         from './songs/youtube.routes.js';
import { createJinglesRouter }         from './jingles.routes.js';
import { createBackgroundMusicRouter } from './backgroundMusic.routes.js';
import { createPhrasesRouter }         from './phrases.routes.js';
import { createDonationsAdminRouter }  from './donations.routes.js';
import { requireCapability }            from '../shared/capabilities.js';

export function createAdminRoutes(deps) {
  const router = Router();
  router.use('/api/admin', createSongsRouter(deps));
  router.use('/api/admin', createYoutubeRouter(deps));
  router.use('/api/admin', createModeRouter(deps));
  router.use('/api/admin/admins',            createAdminsRouter(deps));
  router.use('/api/admin/audit', requireCapability('auditLog', deps), createAuditRouter(deps));
  router.use('/api/admin/history', requireCapability('history', deps), createHistoryRouter(deps));
  router.use('/api/admin/settings',          createSettingsRouter(deps));
  router.use('/api/admin/stats',             createStatsRouter(deps));
  router.use('/api/admin/song-groups',       createSongGroupsRouter(deps));
  router.use('/api/admin/lyrics',            createLyricsRouter(deps));
  router.use('/api/admin/artist-arts',       createArtistArtsRouter(deps));
  router.use('/api/admin/jingles',           createJinglesRouter(deps));
  router.use('/api/admin/background-music',  createBackgroundMusicRouter(deps));
  router.use('/api/admin/phrases',           createPhrasesRouter(deps));
  router.use('/api/admin/donations', requireCapability('donations', deps), createDonationsAdminRouter(deps));
  return router;
}