import fs from 'node:fs';
import path from 'node:path';
import { SERVER_ROOT, log, rel, confirm, plural } from './cli.js';

const MEDIA_ROOT   = path.join(SERVER_ROOT, 'media');
const LEGACY_MUSIC = path.join(SERVER_ROOT, 'music');
const LEGACY_ARTS  = path.join(SERVER_ROOT, 'public', 'arts');

const MEDIA_SUBDIRS = [
  ['music', 'day'], ['music', 'night'],
  ['jingles', 'day'], ['jingles', 'night'],
  ['background', 'day'], ['background', 'night'],
  ['phrases', 'day'], ['phrases', 'night'],
  ['arts'],
];

const exists = (target) => fs.existsSync(target);

const countFiles = (dir) => {
  if (!exists(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return total;
};

function moveTree(from, to, { dryRun }) {
  const files = countFiles(from);
  if (!exists(from) || files === 0) return 0;

  log(`  ${rel(from)} → ${rel(to)}  (${plural(files, 'file')})`);
  if (dryRun) return files;

  fs.mkdirSync(path.dirname(to), { recursive: true });

  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    log('    (different device, copying instead)');
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
  return files;
}

export function describeLayout() {
  const legacyMusic = countFiles(path.join(LEGACY_MUSIC, 'day')) + countFiles(path.join(LEGACY_MUSIC, 'night'));
  const legacyArts  = countFiles(LEGACY_ARTS);
  const newMusic    = countFiles(path.join(MEDIA_ROOT, 'music'));
  const newArts     = countFiles(path.join(MEDIA_ROOT, 'arts'));

  return { legacyMusic, legacyArts, newMusic, newArts, hasLegacy: legacyMusic + legacyArts > 0 };
}

export function statusCommand() {
  const state = describeLayout();

  log('Media layout');
  log(`  server/media exists:      ${exists(MEDIA_ROOT) ? 'yes' : 'no'}`);
  log(`  media/music files:        ${state.newMusic}`);
  log(`  media/arts files:         ${state.newArts}`);
  log(`  legacy music/ files:      ${state.legacyMusic}`);
  log(`  legacy public/arts files: ${state.legacyArts}`);
  log('');
  log(state.hasLegacy
    ? 'Legacy media is still present. Run "node scripts/migrate.js layout" to move it.'
    : 'Nothing to migrate.');
}

export async function layoutCommand({ dryRun = false, assumeYes = false } = {}) {
  const state = describeLayout();

  if (!state.hasLegacy) {
    log('Nothing to migrate: no media found in the legacy locations.');
    if (!exists(MEDIA_ROOT)) {
      log('Creating an empty media/ tree.');
      if (!dryRun) {
        for (const parts of MEDIA_SUBDIRS) {
          fs.mkdirSync(path.join(MEDIA_ROOT, ...parts), { recursive: true });
        }
      }
    }
    return;
  }

  log(dryRun ? 'Planned moves (dry run, nothing is written):' : 'Moving media:');
  log('');

  if (!dryRun && !await confirm('Proceed? Files are moved, not copied.', { assumeYes })) {
    log('Cancelled.');
    return;
  }

  let moved = 0;
  moved += moveTree(path.join(LEGACY_MUSIC, 'day'),   path.join(MEDIA_ROOT, 'music', 'day'),   { dryRun });
  moved += moveTree(path.join(LEGACY_MUSIC, 'night'), path.join(MEDIA_ROOT, 'music', 'night'), { dryRun });
  moved += moveTree(LEGACY_ARTS,                      path.join(MEDIA_ROOT, 'arts'),           { dryRun });

  if (dryRun) {
    log(`\n${plural(moved, 'file')} would be moved. Re-run without --dry-run to apply.`);
    return;
  }

  for (const parts of MEDIA_SUBDIRS) {
    fs.mkdirSync(path.join(MEDIA_ROOT, ...parts), { recursive: true });
  }

  log(`\nDone: ${plural(moved, 'file')} moved.`);
  log('The now-empty music/ and public/arts/ directories can be deleted by hand.');
}
