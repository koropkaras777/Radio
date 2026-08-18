import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = join(__dirname, '..', '..');

// ── Metadata ──────────────────────────────────────────────────────────────────
export const DATA_ROOT = join(SERVER_ROOT, 'data');

// ── Media ─────────────────────────────────────────────────────────────────────
export const MEDIA_ROOT     = join(SERVER_ROOT, 'media');
export const MUSIC_DIR      = join(MEDIA_ROOT, 'music');
export const JINGLES_DIR    = join(MEDIA_ROOT, 'jingles');
export const BACKGROUND_DIR = join(MEDIA_ROOT, 'background');
export const PHRASES_DIR    = join(MEDIA_ROOT, 'phrases');
export const ARTS_DIR       = join(MEDIA_ROOT, 'arts');

// ── Application assets ────────────────────────────────────────────────────────
export const PUBLIC_ROOT  = join(SERVER_ROOT, 'public');
export const AVATARS_DIR  = join(PUBLIC_ROOT, 'avatars');

export const CLIENT_DIST = join(SERVER_ROOT, '..', 'client', 'dist');
export const DOCS_DIST   = join(SERVER_ROOT, '..', 'docs', '.vitepress', 'dist');

// ── Pre-media-root layout ─────────────────────────────────────────────────────
export const LEGACY_MUSIC_DIR = join(SERVER_ROOT, 'music');
export const LEGACY_ARTS_DIR  = join(PUBLIC_ROOT, 'arts');

const hasFiles = (dir) => {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
};

export function ensureMediaLayout() {
  const legacy = [
    hasFiles(join(LEGACY_MUSIC_DIR, 'day')) || hasFiles(join(LEGACY_MUSIC_DIR, 'night')),
    hasFiles(LEGACY_ARTS_DIR),
  ].some(Boolean);

  if (legacy && !fs.existsSync(MEDIA_ROOT)) {
    console.error(
      '[Fatal] Found media in the pre-media-root layout (server/music, server/public/arts) ' +
      'but server/media does not exist yet.'
    );
    console.error('  Run the migration once, from the server directory:');
    console.error('    node scripts/migrate.js layout');
    process.exit(1);
  }

  for (const dir of [
    join(MUSIC_DIR, 'day'), join(MUSIC_DIR, 'night'),
    join(JINGLES_DIR, 'day'), join(JINGLES_DIR, 'night'),
    join(BACKGROUND_DIR, 'day'), join(BACKGROUND_DIR, 'night'),
    join(PHRASES_DIR, 'day'), join(PHRASES_DIR, 'night'),
    ARTS_DIR,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
