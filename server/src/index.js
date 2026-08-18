import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFile } from 'music-metadata';
import { RadioEngine } from './engine/radioEngine.js';
import { fetchLyricsForSong } from './engine/lyricsService.js';
import {
  PORT,
  HOST,
  MUSIC_SOURCE,
  R2_PUBLIC_BASE_URL,
  R2_ENDPOINT,
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_REGION,
  R2_PRESIGN_TTL_S,
  R2_ARTS_PREFIX,
  DATA_PROVIDER,
  LOG_RETENTION_DAYS,
  LOG_PURGE_HOUR,
  TIME_ZONE,
  STREAM_MODE,
  LYRICS_PREFETCH,
  DONATION_RETENTION_DAYS,
  DONATIONS_ENABLED,
} from './config/env.js';
import { MUSIC_DIR, ARTS_DIR, JINGLES_DIR, BACKGROUND_DIR, PHRASES_DIR, SERVER_ROOT, ensureMediaLayout } from './config/paths.js';
import { setupApp }               from './setupApp.js';
import { auditLogger }            from './audit/auditLogger.js';
import { radioStream }            from './stream/radioStream.js';
import { registerRoutes }         from './http/routes/index.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';
import { suggestState }           from './session/session.js';
import { emitSuggestionsToAdmins } from './engine/suggestions.js';
import { createDataProvider }     from './data/dataProvider/index.js';
import { startDonationPolling, startDonationExpirySweep } from './donations/donationPoller.js';
import { getActiveDonationProvider } from './donations/donationRegistry.js';
import { createMediaProvider }    from './data/mediaProvider/index.js';
import { artistArtsIndexCache, artistArtBinaryCache, cacheArtistArtItem } from './http/routes/shared/artistArtsCache.js';
import { sanitizeArtistKey } from './http/routes/shared/artistKey.js';

// ── Startup reconciliation: register local media files with no data record ────
async function reconcileMediaLibrary({ name, dir, fileExists, createRecord }) {
  let added = 0;

  for (const mode of ['day', 'night']) {
    let files = [];
    try {
      files = await readdir(join(dir, mode));
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`[${name}] Startup scan failed (${mode}):`, err.message);
      continue;
    }

    for (const filename of files) {
      if (!filename.toLowerCase().endsWith('.mp3')) continue;
      try {
        if (await fileExists(filename)) continue;
        const parsed = await parseFile(join(dir, mode, filename)).catch(() => null);
        const duration = Number.isFinite(Number(parsed?.format?.duration)) ? Number(parsed.format.duration) : null;
        await createRecord({ filename, mode, duration, used: true });
        added++;
      } catch (err) {
        console.warn(`[${name}] Startup reconciliation failed for "${filename}":`, err.message);
      }
    }
  }

  return added;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

ensureMediaLayout();

const { app, httpServer, io, loginLimiter, donationsWebhookRouter } = setupApp();

const dataProvider = createDataProvider({
  rootDir:  SERVER_ROOT,
  musicDir: MUSIC_DIR,
});

await auditLogger.init(dataProvider).catch((err) =>
  console.error('[AuditLog] Cache init failed:', err)
);
auditLogger.setIo(io);

const mediaProvider = createMediaProvider({
  musicPath: MUSIC_DIR,
  artsPath:  ARTS_DIR,
  jinglesPath: JINGLES_DIR,
  backgroundMusicPath: BACKGROUND_DIR,
  phrasesPath: PHRASES_DIR,
  r2Endpoint:        R2_ENDPOINT,
  r2Bucket:          R2_BUCKET,
  r2AccessKeyId:     R2_ACCESS_KEY_ID,
  r2SecretAccessKey: R2_SECRET_ACCESS_KEY,
  r2Region:          R2_REGION,
  r2PublicBaseUrl:   R2_PUBLIC_BASE_URL,
  presignTtlS:       R2_PRESIGN_TTL_S,
  artsPrefix:        R2_ARTS_PREFIX,
});

const radioEngine = new RadioEngine(MUSIC_DIR, {
  musicSource:    MUSIC_SOURCE,
  r2PublicBaseUrl: R2_PUBLIC_BASE_URL,
  dataProvider,
});

registerRoutes(app, { io, radioEngine, mediaProvider, fetchLyricsForSong, loginLimiter, dataProvider, donationsWebhookRouter });
registerSocketHandlers(io, { radioEngine, dataProvider, radioStream });

// ── Server start ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, HOST, () => {
  console.log(`[Radio] Server running on ${HOST}:${PORT}`);
  console.log(
    mediaProvider.isCloud
      ? `[Radio] Media storage: Cloudflare R2 (presigned URLs, TTL ${R2_PRESIGN_TTL_S}s)`
      : '[Radio] Media storage: local filesystem'
  );
  console.log(`[Radio] Data provider: ${DATA_PROVIDER}`);
});

// ── Engine init ───────────────────────────────────────────────────────────────
radioEngine.initialize()
  .then(async () => {
    console.log('[Radio] Engine initialized');

    if (LYRICS_PREFETCH) {
      await radioEngine.prefetchAllLyrics().catch((err) =>
        console.error('[Lyrics] Prefetch failed:', err)
      );
    }

    radioEngine.start();

    try {
      const libraryArtists = new Set(
        [...radioEngine.fullLibraryMetadata.values()]
          .map((meta) => sanitizeArtistKey(meta.artist || ''))
          .filter(Boolean),
      );

      let reconciled = 0;
      if (!mediaProvider.isCloud && typeof dataProvider.upsertArtistArt === 'function') {
        let artFiles = [];
        try {
          artFiles = await readdir(ARTS_DIR);
        } catch (err) {
          if (err.code !== 'ENOENT') console.warn('[ArtistArts] Startup art scan failed:', err.message);
        }

        for (const filename of artFiles) {
          if (!filename.toLowerCase().endsWith('.jpg')) continue;
          const artistKey = sanitizeArtistKey(filename.slice(0, -4));
          if (!artistKey) continue;
          if (artistArtsIndexCache.get(artistKey)?.hasArt) continue;
          try {
            const entry = await dataProvider.upsertArtistArt({ artist: artistKey, hasArt: true, artFileName: filename });
            cacheArtistArtItem(entry);
            reconciled++;
          } catch (err) {
            console.warn(`[ArtistArts] Startup art reconciliation failed for "${artistKey}":`, err.message);
          }
        }
      }

      if (reconciled > 0) {
        console.log(`[ArtistArts] Startup reconciliation: matched ${reconciled} art file${reconciled === 1 ? '' : 's'} on disk with no record`);
      }

      let seeded = 0;
      if (typeof dataProvider.ensureArtistArtEntry === 'function') {
        for (const artistKey of libraryArtists) {
          if (artistArtsIndexCache.has(artistKey)) continue;
          try {
            const entry = await dataProvider.ensureArtistArtEntry(artistKey);
            cacheArtistArtItem(entry);
            seeded++;
          } catch (err) {
            console.warn(`[ArtistArts] Startup seeding failed for "${artistKey}":`, err.message);
          }
        }
      }

      if (seeded > 0) {
        console.log(`[ArtistArts] Startup seeding: added ${seeded} missing entr${seeded === 1 ? 'y' : 'ies'} for library artists`);
      }

      let removed = 0;
      for (const [artistKey, entry] of artistArtsIndexCache) {
        if (entry.hasArt) continue;
        if (libraryArtists.has(artistKey)) continue;
        try {
          if (typeof dataProvider.deleteArtistArt === 'function') {
            await dataProvider.deleteArtistArt(artistKey);
          }
          artistArtsIndexCache.delete(artistKey);
          artistArtBinaryCache.delete(artistKey);
          removed++;
        } catch (err) {
          console.warn(`[ArtistArts] Startup cleanup failed for "${artistKey}":`, err.message);
        }
      }

      if (removed > 0) {
        console.log(`[ArtistArts] Startup cleanup: removed ${removed} orphaned entr${removed === 1 ? 'y' : 'ies'} (no tracks, no art)`);
      } else {
        console.log('[ArtistArts] Startup cleanup: no orphaned entries found');
      }
    } catch (err) {
      console.error('[ArtistArts] Startup cleanup error:', err.message);
    }

    if (!mediaProvider.isCloud) {
      try {
        if (typeof dataProvider.createJingle === 'function' && typeof dataProvider.jingleFilenameExists === 'function') {
          const added = await reconcileMediaLibrary({
            name: 'Jingles',
            dir: JINGLES_DIR,
            fileExists:   (filename) => dataProvider.jingleFilenameExists(filename),
            createRecord: (record)   => dataProvider.createJingle(record),
          });
          if (added > 0) {
            console.log(`[Jingles] Startup reconciliation: added ${added} record${added === 1 ? '' : 's'} for files on disk`);
            io.emit('jingles_updated');
          }
        }
      } catch (err) {
        console.error('[Jingles] Startup reconciliation error:', err.message);
      }

      try {
        if (typeof dataProvider.createBackgroundMusic === 'function' && typeof dataProvider.backgroundMusicFilenameExists === 'function') {
          const added = await reconcileMediaLibrary({
            name: 'Background music',
            dir: BACKGROUND_DIR,
            fileExists:   (filename) => dataProvider.backgroundMusicFilenameExists(filename),
            createRecord: (record)   => dataProvider.createBackgroundMusic(record),
          });
          if (added > 0) {
            console.log(`[Background music] Startup reconciliation: added ${added} record${added === 1 ? '' : 's'} for files on disk`);
            io.emit('background_music_updated');
          }
        }
      } catch (err) {
        console.error('[Background music] Startup reconciliation error:', err.message);
      }

      try {
        if (typeof dataProvider.createPhrase === 'function' && typeof dataProvider.phraseFilenameExists === 'function') {
          const added = await reconcileMediaLibrary({
            name: 'Phrases',
            dir: PHRASES_DIR,
            fileExists:   (filename) => dataProvider.phraseFilenameExists(filename),
            createRecord: (record)   => dataProvider.createPhrase(record),
          });
          if (added > 0) {
            console.log(`[Phrases] Startup reconciliation: added ${added} record${added === 1 ? '' : 's'} for files on disk`);
            io.emit('phrases_updated');
          }
        }
      } catch (err) {
        console.error('[Phrases] Startup reconciliation error:', err.message);
      }
    }

    if (STREAM_MODE) {
      await radioStream.init({ radioEngine, mediaProvider, io });
      console.log('[Radio] Stream mode active - FFmpeg broadcasting on /api/stream');
    } else {
      console.log('[Radio] Sync mode active - clients fetch audio directly');
    }

    setInterval(() => {
      radioEngine.tick();
      const state = radioEngine.getState();

      if (STREAM_MODE && radioStream.isInitialized) {
        state.seek = radioStream.currentSeek;
        if (radioStream.currentTrackId) {
          state.track = radioStream.currentTrackId;
        }
      }

      if (state.mode === 'day' && suggestState.lastMode === 'night') {
        suggestState.pending.forEach((item) => clearTimeout(item.timerId));
        suggestState.pending.clear();
        suggestState.cooldowns.clear();
        emitSuggestionsToAdmins(io);
        console.log('[Listeners] Day transition - suggestions and cooldowns cleared');
      }
      suggestState.lastMode = state.mode;

      io.emit('sync', state);
    }, 2000);

    if (typeof dataProvider.purgeExpiredAdmins === 'function') {
      dataProvider.purgeExpiredAdmins().catch((err) =>
        console.error('[AdminsGC] Initial purge failed:', err)
      );
      setInterval(() => {
        dataProvider.purgeExpiredAdmins().catch((err) =>
          console.error('[AdminsGC] Periodic purge failed:', err)
        );
      }, 60 * 60 * 1000);
    }

    const runDailyPurge = () => {
      auditLogger.purgeOldEntries().catch((err) =>
        console.error('[AuditLog] Daily purge failed:', err)
      );

      const historyCutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      dataProvider.history.purgeHistory(historyCutoff)
        .then((count) => {
          if (count > 0) console.log(`[History] Purged ${count} entries older than ${LOG_RETENTION_DAYS} days`);
        })
        .catch((err) => console.error('[History] Daily purge failed:', err));

      const donationCutoff = Date.now() - DONATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      dataProvider.purgeDonations(donationCutoff)
        .then((count) => {
          if (count > 0) console.log(`[Donations] Purged ${count} entries older than ${DONATION_RETENTION_DAYS} days`);
        })
        .catch((err) => console.error('[Donations] Daily purge failed:', err));
    };

    const scheduleDailyPurge = () => {
      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: TIME_ZONE }));
      const nextRun  = new Date(nowLocal);
      nextRun.setHours(LOG_PURGE_HOUR, 0, 0, 0);
      if (nextRun <= nowLocal) nextRun.setDate(nextRun.getDate() + 1);

      const msUntilRun = nextRun - nowLocal;

      setTimeout(() => {
        runDailyPurge();
        setInterval(runDailyPurge, 24 * 60 * 60 * 1000);
      }, msUntilRun);

      console.log(`[AuditLog] Next purge at ${String(LOG_PURGE_HOUR).padStart(2, '0')}:00 ${TIME_ZONE} time (in ${Math.round(msUntilRun / 60000)} min)`);
    };

    scheduleDailyPurge();

    const activeDonationProvider = getActiveDonationProvider();
    if (activeDonationProvider) {
      console.log(`[Donations] Active provider: ${activeDonationProvider.id} (${activeDonationProvider.flowType})`);
    } else if (DONATIONS_ENABLED) {
      console.warn('[Donations] DONATIONS_ENABLED=true but no provider is configured - donations stay disabled.');
    }

    startDonationPolling({ io, radioEngine, dataProvider });
    startDonationExpirySweep({ dataProvider });
  })
  .catch((err) => console.error('[Radio] Failed to initialize:', err));