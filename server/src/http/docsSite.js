import fs from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { DOCS_HOST } from '../config/env.js';
import { DOCS_DIST } from '../config/paths.js';

// ─── Host matching ────────────────────────────────────────────────────────────
const isDocsHost = (hostname) => {
  const host = String(hostname || '').toLowerCase();
  if (DOCS_HOST) return host === DOCS_HOST;
  return host.split('.')[0] === 'docs';
};

// ─── Middleware ───────────────────────────────────────────────────────────────
export function createDocsSite() {
  const built = fs.existsSync(join(DOCS_DIST, 'index.html'));

  if (!built) {
    console.warn(
      `[Docs] No build found at ${DOCS_DIST} - the documentation host will answer 503.\n` +
      '  Locally: run "npm run build" from the repository root.\n' +
      '  On a host: the build command must be "npm run install-all && npm run build" - ' +
      '"build-client" alone leaves the documentation unbuilt.'
    );
  }

  const serveFiles = express.static(DOCS_DIST, {
    extensions: ['html'],
    index: 'index.html',
    maxAge: '1h',
  });

  return (req, res, next) => {
    if (!isDocsHost(req.hostname)) return next();

    if (!built) {
      return res.status(503).type('text/plain').send('Documentation is not built.');
    }

    serveFiles(req, res, () => {
      const notFound = join(DOCS_DIST, '404.html');
      if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
      res.status(404).type('text/plain').send('Not found');
    });
  };
}
