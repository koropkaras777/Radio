import path from 'node:path';
import { createClient } from '@libsql/client';
import { JsonDataProvider } from '../../src/data/dataProvider/json/jsonDataProvider.js';
import { SqlDataProvider } from '../../src/data/dataProvider/sql/sqlDataProvider.js';
import { ensureAllTables } from '../../src/data/dataProvider/sql/shared/schema.js';
import { createDefaultSettings } from '../../src/engine/radioSettings.js';
import {
  SERVER_ROOT, log, rel, confirm, requireOption, UsageError, plural,
} from './cli.js';

const PROVIDERS = ['json', 'sql'];

const isLocalDbUrl = (url) => String(url || '').trim().toLowerCase().startsWith('file:');

const AUDIT_ENTITY_NAMES = ['audit log', 'play history'];

const ENTITIES = [
  {
    name: 'tracks',
    read:  (p) => p.loadMetadata(),
    write: (p, value) => p.saveMetadata(value),
    count: (value) => Object.keys(value?.day || {}).length + Object.keys(value?.night || {}).length,
  },
  {
    name: 'lyrics',
    read:  (p) => p.loadLyricsCache(),
    write: (p, value) => p.saveLyricsCache(value),
    count: (value) => value?.size ?? 0,
  },
  {
    name: 'lyrics offsets',
    read:  (p) => p.loadLyricsOffsets(),
    write: (p, value) => p.saveLyricsOffsets(value),
    count: (value) => value?.size ?? 0,
  },
  {
    name: 'artist arts',
    read:  (p) => p.loadArtistArts(),
    write: (p, value) => p.saveArtistArts(value),
    count: (value) => value?.length ?? 0,
  },
  {
    name: 'settings',
    read:  (p) => p.loadSettings(createDefaultSettings({})),
    write: (p, value) => p.saveSettings(value),
    count: () => 1,
  },
  {
    name: 'jingles',
    read:  (p) => p.loadJingles(),
    write: (p, value) => p.importJingles(value),
    count: (value) => value?.length ?? 0,
  },
  {
    name: 'background music',
    read:  (p) => p.loadBackgroundMusic(),
    write: (p, value) => p.importBackgroundMusic(value),
    count: (value) => value?.length ?? 0,
  },
  {
    name: 'phrases',
    read:  (p) => p.loadPhrases(),
    write: (p, value) => p.importPhrases(value),
    count: (value) => value?.length ?? 0,
  },
  {
    name: 'banned IPs',
    read:  (p) => p.loadBannedIps(),
    write: (p, value) => p.importBannedIps(value),
    count: (value) => value?.length ?? 0,
  },
  {
    name: 'admins',
    read:  (p) => p.loadAdmins(),
    write: (p, value) => p.importAdmins(value),
    count: (value) => value?.length ?? 0,
  },
  {
    name: 'audit log',
    read:  (p) => p.loadAuditLog(),
    write: (p, value) => p.importAuditLog(value),
    count: (value) => value?.length ?? 0,
  },
  {
    name: 'play history',
    read:  (p) => p.loadHistory(),
    write: (p, value) => p.importHistory(value),
    count: (value) => value?.length ?? 0,
  },
];

function createSqlClient({ url, token, role }) {
  if (isLocalDbUrl(url)) return createClient({ url });

  if (!token) {
    throw new UsageError(
      `a token is required for the remote ${role} database "${url}".\n` +
      `  Pass --${role}-sql-token (or --sql-token when only one side is sql).\n` +
      '  Tokens are never read from .env, so that a mistyped command cannot reach production storage.'
    );
  }

  return createClient({ url, authToken: token });
}

/**
 * @param {'json'|'sql'} kind
 * @param {'source'|'target'} role
 * @param {object} options
 */
function resolveSide(kind, role, options) {
  const pick = (specific, shared) => options[specific] ?? options[shared];

  return {
    kind,
    role,
    sqlUrl:   pick(`${role}SqlUrl`, 'sqlUrl'),
    sqlToken: pick(`${role}SqlToken`, 'sqlToken'),
    jsonDir:  pick(`${role}JsonDir`, 'jsonDir') || SERVER_ROOT,
  };
}

function describeSide(side) {
  if (side.kind === 'json') return `json (${rel(side.jsonDir)}/data/json)`;
  return `sql (${isLocalDbUrl(side.sqlUrl) ? 'local file' : 'remote'}: ${side.sqlUrl})`;
}

function sideIdentity(side) {
  return side.kind === 'json'
    ? `json:${path.resolve(side.jsonDir).toLowerCase()}`
    : `sql:${String(side.sqlUrl).trim().toLowerCase()}`;
}

/**
 * @returns {Promise<{ provider: object, describe: string, close: () => void }>}
 */
async function openSide(side) {
  const describe = describeSide(side);

  if (side.kind === 'json') {
    return {
      provider: new JsonDataProvider({ rootDir: side.jsonDir }),
      describe,
      close: () => {},
    };
  }

  const db = createSqlClient({ url: side.sqlUrl, token: side.sqlToken, role: side.role });
  await ensureAllTables(db);

  return { provider: new SqlDataProvider({ db }), describe, close: () => db.close?.() };
}

function describeResult(report, copied) {
  if (!report || typeof report !== 'object' || !('imported' in report)) {
    return plural(copied, 'record');
  }

  const notes = [];
  if (report.skipped)    notes.push(`${report.skipped} unusable`);
  if (report.duplicates) notes.push(`${report.duplicates} duplicate`);
  if (report.truncated)  notes.push(`${report.truncated} over the cap`);

  return plural(report.imported, 'record') + (notes.length ? ` (${notes.join(', ')} dropped)` : '');
}

/**
 * @param {{
 *   from: string, to: string,
 *   sqlUrl?: string, sqlToken?: string, jsonDir?: string,
 *   sourceSqlUrl?: string, sourceSqlToken?: string, sourceJsonDir?: string,
 *   targetSqlUrl?: string, targetSqlToken?: string, targetJsonDir?: string,
 *   dryRun?: boolean, assumeYes?: boolean, noAudit?: boolean,
 * }} params
 */
export async function dataCommand(params) {
  const { from, to, dryRun = false, assumeYes = false, noAudit = false } = params;
  const entities = noAudit
    ? ENTITIES.filter((entity) => !AUDIT_ENTITY_NAMES.includes(entity.name))
    : ENTITIES;

  if (!PROVIDERS.includes(from)) throw new UsageError(`--from must be one of: ${PROVIDERS.join(', ')}`);
  if (!PROVIDERS.includes(to))   throw new UsageError(`--to must be one of: ${PROVIDERS.join(', ')}`);

  const sourceSide = resolveSide(from, 'source', params);
  const targetSide = resolveSide(to, 'target', params);

  for (const side of [sourceSide, targetSide]) {
    if (side.kind === 'sql' && !side.sqlUrl) {
      throw new UsageError(
        `a database URL is required for the ${side.role} side.\n` +
        `  Pass --${side.role}-sql-url, or --sql-url when only one side is sql.\n` +
        '  Use a file: URL for a local database (file:./data/sql/radio.db), or the\n' +
        '  service URL together with a token for a remote one.'
      );
    }
  }

  if (sideIdentity(sourceSide) === sideIdentity(targetSide)) {
    const flags = sourceSide.kind === 'sql'
      ? '--source-sql-url and --target-sql-url'
      : '--source-json-dir and --target-json-dir';

    throw new UsageError(
      `the source and the target are the same storage (${describeSide(sourceSide)}).\n` +
      `  Give each side its own location, using ${flags}.`
    );
  }

  const targetDescription = describeSide(targetSide);
  const source = await openSide(sourceSide);

  let target = null;

  try {
    log(`Source: ${source.describe}`);
    log(`Target: ${targetDescription}`);
    log('');

    if (targetSide.kind === 'sql' && !isLocalDbUrl(targetSide.sqlUrl)) {
      log('The target is a REMOTE database. Everything it currently holds will be replaced.');
      log('');
    }

    if (noAudit) {
      log(`Skipping: ${AUDIT_ENTITY_NAMES.join(', ')} (--no-audit)`);
      log('');
    }

    log(dryRun ? 'Reading source (dry run, the target is not opened):' : 'Reading source:');
    const payloads = [];
    for (const entity of entities) {
      const value = await entity.read(source.provider);
      const count = entity.count(value);
      payloads.push({ entity, value, count });
      log(`  ${entity.name.padEnd(16)} ${count}`);
    }

    if (dryRun) {
      const total = payloads.reduce((sum, p) => sum + p.count, 0);
      log(`\n${plural(total, 'record')} would be copied. Re-run without --dry-run to apply.`);
      return;
    }

    log('');
    const proceed = await confirm(`Replace the contents of ${targetDescription}?`, { assumeYes });
    if (!proceed) {
      log('Cancelled. Nothing was written.');
      return;
    }

    target = await openSide(targetSide);

    log('');
    log('Writing target:');
    for (const { entity, value, count } of payloads) {
      const report = await entity.write(target.provider, value);
      log(`  ${entity.name.padEnd(16)} ${describeResult(report, count)}`);
    }

    target.close();
    target = null;

    await verifyTarget(targetSide, payloads);
  } finally {
    source.close();
    target?.close();
  }
}

async function verifyTarget(targetSide, payloads) {
  const check = await openSide(targetSide);

  try {
    log('');
    log('Verifying target (read back from storage):');

    const differences = [];
    for (const { entity, count } of payloads) {
      const actual = entity.count(await entity.read(check.provider));
      if (actual !== count) differences.push({ entity, count, actual });
      log(`  ${entity.name.padEnd(16)} ${actual}${actual === count ? '' : `   source had ${count}`}`);
    }

    if (!differences.length) {
      log('\nDone. Every record was carried across.');
      return;
    }

    log('');
    log('Done, with differences:');
    for (const { entity, count, actual } of differences) {
      log(`  ${entity.name}: ${count} read, ${actual} stored (${count - actual} dropped)`);
    }
    log('Check the lines above for the reason each one was refused.');
  } finally {
    check.close();
  }
}

/**
 * @param {Record<string, string|true>} options
 */
export function dataOptionsFromArgs(options) {
  const str = (name) => (typeof options[name] === 'string' ? options[name] : undefined);

  return {
    from: requireOption(options, 'from', 'the provider to copy from (json or sql)'),
    to:   requireOption(options, 'to',   'the provider to copy into (json or sql)'),

    sqlUrl:   str('sql-url'),
    sqlToken: str('sql-token'),
    jsonDir:  str('json-dir'),

    sourceSqlUrl:   str('source-sql-url'),
    sourceSqlToken: str('source-sql-token'),
    sourceJsonDir:  str('source-json-dir'),
    targetSqlUrl:   str('target-sql-url'),
    targetSqlToken: str('target-sql-token'),
    targetJsonDir:  str('target-json-dir'),

    dryRun:    options['dry-run'] === true,
    assumeYes: options.yes === true,
    noAudit:   options['no-audit'] === true,
  };
}
