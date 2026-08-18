import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { JsonDataProvider } from '../../src/data/dataProvider/json/jsonDataProvider.js';
import { SqlDataProvider } from '../../src/data/dataProvider/sql/sqlDataProvider.js';
import { ensureAllTables } from '../../src/data/dataProvider/sql/shared/schema.js';
import { MEDIA_ROOT } from '../../src/config/paths.js';
import { SERVER_ROOT, log, rel, confirm, UsageError, plural } from './cli.js';

const LIBRARIES = [
  {
    name: 'jingles',
    dir: 'jingles',
    load:   (p) => p.loadJingles(),
    create: (p, record) => p.createJingle(record),
  },
  {
    name: 'background music',
    dir: 'background',
    load:   (p) => p.loadBackgroundMusic(),
    create: (p, record) => p.createBackgroundMusic(record),
  },
  {
    name: 'phrases',
    dir: 'phrases',
    load:   (p) => p.loadPhrases(),
    create: (p, record) => p.createPhrase(record),
  },
];

const MODES = ['day', 'night'];

async function listAudio(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.mp3$/i.test(e.name))
      .map((e) => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function readDuration(filePath) {
  try {
    const parsed = await parseFile(filePath);
    const seconds = Number(parsed?.format?.duration);
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}

async function openProvider({ provider, sqlUrl, sqlToken, jsonDir }) {
  if (provider === 'json') {
    return {
      provider: new JsonDataProvider({ rootDir: jsonDir || SERVER_ROOT }),
      describe: `json (${rel(jsonDir || SERVER_ROOT)}/data/json)`,
      close: () => {},
    };
  }

  if (!sqlUrl) {
    throw new UsageError(
      '--sql-url is required with --provider sql.\n' +
      '  Use a file: URL for a local database, or the service URL with --sql-token.'
    );
  }

  const { createClient } = await import('@libsql/client');
  const isLocal = String(sqlUrl).trim().toLowerCase().startsWith('file:');

  if (!isLocal && !sqlToken) {
    throw new UsageError(`--sql-token is required for the remote database "${sqlUrl}".`);
  }

  const db = createClient(isLocal ? { url: sqlUrl } : { url: sqlUrl, authToken: sqlToken });
  await ensureAllTables(db);

  return {
    provider: new SqlDataProvider({ db }),
    describe: `sql (${isLocal ? 'local file' : 'remote'}: ${sqlUrl})`,
    close: () => db.close?.(),
  };
}

/**
 * @param {{
 *   provider: string, sqlUrl?: string, sqlToken?: string, jsonDir?: string,
 *   mediaDir?: string, dryRun?: boolean, assumeYes?: boolean,
 * }} params
 */
export async function scanCommand({
  provider, sqlUrl, sqlToken, jsonDir, mediaDir,
  dryRun = false, assumeYes = false,
}) {
  if (!['json', 'sql'].includes(provider)) {
    throw new UsageError('--provider must be json or sql');
  }

  const mediaRoot = mediaDir || MEDIA_ROOT;
  const target = await openProvider({ provider, sqlUrl, sqlToken, jsonDir });

  try {
    log(`Media:   ${rel(mediaRoot)}`);
    log(`Records: ${target.describe}`);
    log('');

    const pending = [];

    for (const library of LIBRARIES) {
      const existing = await library.load(target.provider);
      const known = new Set(existing.map((r) => String(r.filename).toLowerCase()));

      for (const mode of MODES) {
        for (const filename of await listAudio(path.join(mediaRoot, library.dir, mode))) {
          if (known.has(filename.toLowerCase())) continue;
          pending.push({ library, mode, filename });
        }
      }

      log(`  ${library.name.padEnd(17)} ${existing.length} registered`);
    }

    if (!pending.length) {
      log('\nEvery file on storage already has a record.');
      return;
    }

    log('');
    log(dryRun ? 'Would register (dry run):' : 'Missing records:');
    for (const item of pending) {
      log(`  ${item.library.name.padEnd(17)} ${item.mode}/${item.filename}`);
    }

    if (dryRun) {
      log(`\n${plural(pending.length, 'file')} would be registered. Re-run without --dry-run to apply.`);
      return;
    }

    log('');
    if (!await confirm(`Register ${plural(pending.length, 'file')} in ${target.describe}?`, { assumeYes })) {
      log('Cancelled. Nothing was written.');
      return;
    }

    log('');
    let added = 0;
    for (const { library, mode, filename } of pending) {
      const duration = await readDuration(path.join(mediaRoot, library.dir, mode, filename));
      await library.create(target.provider, { filename, mode, duration, used: true });
      added += 1;
      log(`  registered ${mode}/${filename}${duration ? ` (${duration.toFixed(1)}s)` : ''}`);
    }

    log(`\nDone: ${plural(added, 'record')} created.`);
  } finally {
    target.close();
  }
}

export function scanOptionsFromArgs(options) {
  const str = (name) => (typeof options[name] === 'string' ? options[name] : undefined);

  return {
    provider:  str('provider') || 'json',
    sqlUrl:    str('sql-url'),
    sqlToken:  str('sql-token'),
    jsonDir:   str('json-dir'),
    mediaDir:  str('media-dir'),
    dryRun:    options['dry-run'] === true,
    assumeYes: options.yes === true,
  };
}
