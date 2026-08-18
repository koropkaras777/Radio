import {
  parseArgs, log, resetLog, saveLog, ask, UsageError,
} from './migrate/cli.js';
import { layoutCommand, statusCommand } from './migrate/layout.js';
import { dataCommand, dataOptionsFromArgs } from './migrate/data.js';
import { mediaCommand, mediaOptionsFromArgs, localMediaSummary } from './migrate/media.js';
import { scanCommand, scanOptionsFromArgs } from './migrate/scan.js';

function printHelp() {
  console.log(`
Radio migration CLI

Usage:
  node scripts/migrate.js <command> [options]

Commands:
  status        Report what media and layout are currently present
  layout        Move media from the legacy locations (server/music,
                server/public/arts) into server/media
  data          Copy the whole dataset between the json and sql providers
  media         Copy media files between local storage and the cloud bucket
  scan          Register jingles and background music that are on storage but
                missing from the data store
  help          Show this help

Options for "data":
  --from <json|sql>    provider to copy from                       (required)
  --to <json|sql>      provider to copy into                       (required)
  --sql-url <url>      database URL, required when a side is sql.
                       A file: URL is a local database; anything else
                       is remote and also needs --sql-token.
  --sql-token <token>  auth token for a remote database
  --json-dir <path>    server directory holding data/json
                       (defaults to this server)
  --no-audit           skip the audit log and the play history

  Both sides may be the same provider - copying a remote database into a local
  one is an ordinary thing to want - but then each side needs its own location:

  --source-sql-url / --source-sql-token / --source-json-dir
  --target-sql-url / --target-sql-token / --target-json-dir

  A per-side option wins over the shared one. Source and target must not point
  at the same storage: the target is emptied before it is refilled.

Options for "media":
  --from <local|cloud>          side to copy from                  (required)
  --to <local|cloud>            side to copy into                  (required)
  --r2-endpoint <url>           R2 S3 API endpoint                 (required)
  --r2-bucket <name>            bucket name                        (required)
  --r2-access-key-id <id>       access key id                      (required)
  --r2-secret-access-key <key>  secret access key                  (required)
  --r2-region <region>          defaults to "auto"
  --media-dir <path>            media root (defaults to server/media)
  --category <list>             limit to some of: music, jingles,
                                background, phrases, arts
  --overwrite                   copy even when sizes already match

Common options:
  --dry-run     Report the plan without writing anything
  --yes         Skip the confirmation prompt
  --debug       Print the stack trace when something fails

Examples:
  node scripts/migrate.js data --from json --to sql --sql-url file:./data/sql/radio.db
  node scripts/migrate.js data --from sql --to json --sql-url libsql://db.turso.io --sql-token <token>
  node scripts/migrate.js data --from sql --to sql \\
    --source-sql-url libsql://db.turso.io --source-sql-token <token> \\
    --target-sql-url file:./data/sql/radio.db
  node scripts/migrate.js media --from local --to cloud \\
    --r2-endpoint https://<account>.r2.cloudflarestorage.com --r2-bucket radio \\
    --r2-access-key-id <id> --r2-secret-access-key <key> --dry-run

Run without a command to open the interactive menu.

Credentials are never read from .env. A remote database or bucket is only ever
reached when its URL, token or keys were typed into the command, so a mistaken
command cannot touch the deployed radio's storage.

"media" copies; it never deletes on either side, and a file already present at
the same size is skipped, so an interrupted run can simply be repeated.
`);
}

// ── Interactive menu ──────────────────────────────────────────────────────────
async function askDataSide(role) {
  const kind = await ask(`${role === 'source' ? 'Copy from' : 'Copy into'} - 1) json files  2) sql database : `);
  if (kind !== '1' && kind !== '2') {
    console.log('Invalid choice.');
    return null;
  }

  if (kind === '1') {
    const dir = await ask(`  Server directory holding data/json [${role === 'source' ? 'this server' : 'this server'}]: `);
    return dir ? { [`${role}JsonDir`]: dir } : {};
  }

  const location = await ask('  Is it 1) a local file  2) a remote service : ');
  if (location !== '1' && location !== '2') {
    console.log('Invalid choice.');
    return null;
  }

  const answer = await ask(
    location === '1'
      ? '  Database file URL [file:./data/sql/radio.db]: '
      : '  Database URL (libsql://...): '
  );
  const url = answer || (location === '1' ? 'file:./data/sql/radio.db' : '');
  if (!url) {
    console.log('A database URL is required.');
    return null;
  }

  const token = location === '2' ? await ask('  Auth token: ') : undefined;

  return { [`${role}SqlUrl`]: url, [`${role}SqlToken`]: token };
}

async function askDataOptions() {
  const source = await askDataSide('source');
  if (!source) return null;

  const target = await askDataSide('target');
  if (!target) return null;

  const noAudit = (await ask('Skip the audit log and the play history? [y/N] ')).toLowerCase() === 'y';

  return {
    from: source.sourceSqlUrl ? 'sql' : 'json',
    to:   target.targetSqlUrl ? 'sql' : 'json',
    ...source,
    ...target,
    dryRun: false,
    assumeYes: false,
    noAudit,
  };
}

async function askMediaOptions() {
  const direction = await ask('Direction - 1) local → cloud   2) cloud → local : ');
  if (direction !== '1' && direction !== '2') {
    console.log('Invalid direction.');
    return null;
  }

  const [from, to] = direction === '1' ? ['local', 'cloud'] : ['cloud', 'local'];

  const r2Endpoint = await ask('R2 endpoint (https://<account>.r2.cloudflarestorage.com): ');
  const r2Bucket = await ask('Bucket name: ');
  const r2AccessKeyId = await ask('Access key id: ');
  const r2SecretAccessKey = await ask('Secret access key: ');

  if (!r2Endpoint || !r2Bucket || !r2AccessKeyId || !r2SecretAccessKey) {
    console.log('All four bucket credentials are required.');
    return null;
  }

  return {
    from,
    to,
    r2: { r2Endpoint, r2Bucket, r2AccessKeyId, r2SecretAccessKey, r2Region: 'auto' },
    dryRun: false,
    assumeYes: false,
  };
}

async function interactiveMenu() {
  console.log('===================================================');
  console.log('        Radio migration CLI - interactive menu      ');
  console.log('===================================================\n');
  console.log('1) Show status');
  console.log('2) Move media into server/media (dry run)');
  console.log('3) Move media into server/media (apply)');
  console.log('4) Copy data between providers (dry run)');
  console.log('5) Copy data between providers (apply)');
  console.log('6) Copy media between local and cloud (dry run)');
  console.log('7) Copy media between local and cloud (apply)');
  console.log('9) Help');
  console.log('0) Exit');

  const choice = await ask('\nSelect an option: ');

  switch (choice) {
    case '1':
      statusCommand();
      log('');
      log('Media library');
      for (const { name, count } of localMediaSummary()) {
        log(`  ${name.padEnd(12)} ${count}`);
      }
      break;
    case '2':
      await layoutCommand({ dryRun: true });
      break;
    case '3':
      await layoutCommand({ dryRun: false });
      saveLog('layout');
      break;
    case '4':
    case '5': {
      const options = await askDataOptions();
      if (!options) return;
      await dataCommand({ ...options, dryRun: choice === '4' });
      saveLog('data');
      break;
    }
    case '6':
    case '7': {
      const options = await askMediaOptions();
      if (!options) return;
      await mediaCommand({ ...options, dryRun: choice === '6' });
      saveLog('media');
      break;
    }
    case '9':
      printHelp();
      break;
    case '0':
      console.log('Bye!');
      break;
    default:
      console.log('Invalid option.');
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
let showStacks = false;

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const dryRun = options['dry-run'] === true;
  const assumeYes = options.yes === true;
  showStacks = options.debug === true;

  resetLog();

  if (!command) {
    await interactiveMenu();
    return;
  }

  switch (command) {
    case 'status':
      statusCommand();
      log('');
      log('Media library');
      for (const { name, count } of localMediaSummary()) {
        log(`  ${name.padEnd(12)} ${count}`);
      }
      break;

    case 'layout':
      await layoutCommand({ dryRun, assumeYes });
      saveLog('layout');
      break;

    case 'data':
      await dataCommand(dataOptionsFromArgs(options));
      saveLog('data');
      break;

    case 'media':
      await mediaCommand(mediaOptionsFromArgs(options));
      saveLog('media');
      break;

    case 'scan':
      await scanCommand(scanOptionsFromArgs(options));
      saveLog('scan');
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.error(`Unknown command: "${command}"`);
      printHelp();
      process.exitCode = 1;
  }
}

try {
  await main();
} catch (err) {
  if (err instanceof UsageError) {
    console.error(`\n${err.message}\n`);
    console.error('Run "node scripts/migrate.js help" for the full usage.');
    process.exitCode = 1;
  } else {
    console.error('\nMigration failed:', err?.message || err);
    if (showStacks) console.error(err);
    log(`FAILED: ${err?.message || err}`);
    saveLog('failed');
    process.exitCode = 1;
  }
}
