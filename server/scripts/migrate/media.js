import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { R2Client } from '../../src/data/mediaProvider/cloud/shared/R2Client.js';
import {
  MEDIA_CATEGORIES, toCloudKey, toLocalRelativePath,
} from '../../src/data/mediaProvider/shared/mediaLayout.js';
import { MEDIA_ROOT } from '../../src/config/paths.js';
import { log, rel, confirm, requireOption, UsageError, plural } from './cli.js';

const SIDES = ['local', 'cloud'];

const CONCURRENCY = 4;

const CONTENT_TYPES = {
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const contentTypeFor = (key) =>
  CONTENT_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

async function walk(root, dir = root) {
  const out = [];

  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...await walk(root, full));
      continue;
    }

    const stat = await fsp.stat(full);
    out.push({
      relativePath: path.relative(root, full).replace(/\\/g, '/'),
      size: stat.size,
    });
  }

  return out;
}

async function readLocalInventory(mediaRoot) {
  const items = new Map();

  for (const category of MEDIA_CATEGORIES) {
    const categoryRoot = path.join(mediaRoot, category.localPrefix);

    for (const file of await walk(categoryRoot)) {
      const relativePath = `${category.localPrefix}${file.relativePath}`;
      items.set(toCloudKey(category, relativePath), {
        category, relativePath, size: file.size,
      });
    }
  }

  return items;
}

async function readCloudInventory(r2) {
  const items = new Map();

  for (const category of MEDIA_CATEGORIES) {
    for (const prefix of category.listPrefixes) {
      for (const object of await r2.listObjects(prefix)) {
        items.set(object.key, {
          category,
          relativePath: toLocalRelativePath(category, object.key),
          size: object.size,
        });
      }
    }
  }

  return items;
}

function planTransfers(sourceItems, targetItems, { overwrite }) {
  const missing = [];
  const differing = [];
  const identical = [];

  for (const [key, item] of sourceItems) {
    const existing = targetItems.get(key);

    if (!existing) missing.push({ key, ...item });
    else if (overwrite || existing.size !== item.size) differing.push({ key, ...item });
    else identical.push({ key, ...item });
  }

  return { missing, differing, identical };
}

async function runPool(tasks, worker, concurrency = CONCURRENCY) {
  let index = 0;
  const failures = [];

  const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (index < tasks.length) {
      const task = tasks[index++];
      try {
        await worker(task);
      } catch (err) {
        failures.push({ task, error: err });
      }
    }
  });

  await Promise.all(runners);
  return failures;
}

/**
 * @param {{
 *   from: string, to: string,
 *   mediaDir?: string, r2: object,
 *   categories?: string[], overwrite?: boolean,
 *   dryRun?: boolean, assumeYes?: boolean,
 * }} params
 */
export async function mediaCommand({
  from, to, mediaDir, r2: r2Options, categories,
  overwrite = false, dryRun = false, assumeYes = false,
}) {
  if (!SIDES.includes(from)) throw new UsageError(`--from must be one of: ${SIDES.join(', ')}`);
  if (!SIDES.includes(to))   throw new UsageError(`--to must be one of: ${SIDES.join(', ')}`);
  if (from === to)           throw new UsageError('--from and --to must differ');

  const mediaRoot = mediaDir || MEDIA_ROOT;
  const r2 = new R2Client(r2Options);

  const describeLocal = `local (${rel(mediaRoot)})`;
  const describeCloud = `cloud (${r2Options.r2Bucket} at ${r2Options.r2Endpoint})`;

  log(`Source: ${from === 'local' ? describeLocal : describeCloud}`);
  log(`Target: ${to === 'local' ? describeLocal : describeCloud}`);
  log('');

  log('Taking inventory:');
  const localItems = await readLocalInventory(mediaRoot);
  const cloudItems = await readCloudInventory(r2);
  log(`  local  ${plural(localItems.size, 'file')}`);
  log(`  cloud  ${plural(cloudItems.size, 'object')}`);

  let sourceItems = from === 'local' ? localItems : cloudItems;
  const targetItems = to === 'local' ? localItems : cloudItems;

  if (categories?.length) {
    const wanted = new Set(categories);
    sourceItems = new Map(
      [...sourceItems].filter(([, item]) => wanted.has(item.category.name))
    );
    log(`  limited to: ${categories.join(', ')}`);
  }

  const { missing, differing, identical } = planTransfers(sourceItems, targetItems, { overwrite });
  const queue = [...missing, ...differing];
  const totalBytes = queue.reduce((sum, item) => sum + item.size, 0);

  log('');
  log('Plan:');
  log(`  ${plural(missing.length, 'file')} missing at the target`);
  log(`  ${plural(differing.length, 'file')} present but ${overwrite ? 'being overwritten' : 'a different size'}`);
  log(`  ${plural(identical.length, 'file')} already identical (skipped)`);
  log(`  ${formatSize(totalBytes)} to transfer`);

  const byCategory = new Map();
  for (const item of queue) {
    byCategory.set(item.category.name, (byCategory.get(item.category.name) || 0) + 1);
  }
  if (byCategory.size) {
    log('');
    for (const [name, count] of byCategory) log(`  ${name.padEnd(12)} ${count}`);
  }

  if (!queue.length) {
    log('\nNothing to transfer: the target already holds every source file.');
    return;
  }

  if (dryRun) {
    log('\nDry run: nothing was transferred. Re-run without --dry-run to apply.');
    return;
  }

  log('');
  const proceed = await confirm(
    `Copy ${plural(queue.length, 'file')} (${formatSize(totalBytes)}) to ${to}? Nothing is deleted.`,
    { assumeYes }
  );
  if (!proceed) {
    log('Cancelled. Nothing was transferred.');
    return;
  }

  log('');
  log('Transferring:');

  let done = 0;
  const failures = await runPool(queue, async (item) => {
    if (to === 'cloud') {
      const buffer = await fsp.readFile(path.join(mediaRoot, item.relativePath));
      await r2.request({
        method: 'PUT',
        key: item.key,
        body: buffer,
        contentType: contentTypeFor(item.key),
      });
    } else {
      const response = await r2.request({ method: 'GET', key: item.key });
      const buffer = Buffer.from(await response.arrayBuffer());
      const destination = path.join(mediaRoot, item.relativePath);

      await fsp.mkdir(path.dirname(destination), { recursive: true });
      // Written beside the target and renamed, so an interrupted download
      // leaves no half-written file that the next run would mistake for a
      // complete one and skip.
      const tmp = `${destination}.part`;
      await fsp.writeFile(tmp, buffer);
      await fsp.rename(tmp, destination);
    }

    done += 1;
    if (done % 25 === 0 || done === queue.length) {
      log(`  ${done}/${queue.length}`);
    }
  });

  if (failures.length) {
    log('');
    log(`Finished with ${plural(failures.length, 'failure')}:`);
    for (const { task, error } of failures.slice(0, 20)) {
      log(`  ${task.key}: ${error?.message || error}`);
    }
    if (failures.length > 20) log(`  ... and ${failures.length - 20} more`);
    log('\nRe-running the same command retries only what is still missing.');

    const failure = new Error(`${failures.length} file(s) failed to transfer`);
    failure.alreadyReported = true;
    throw failure;
  }

  log(`\nDone: ${plural(done, 'file')} copied, ${formatSize(totalBytes)}.`);
}

/**
 * @param {Record<string, string|true>} options
 */
export function mediaOptionsFromArgs(options) {
  const from = requireOption(options, 'from', 'the side to copy from (local or cloud)');
  const to   = requireOption(options, 'to',   'the side to copy into (local or cloud)');

  const categories = typeof options.category === 'string'
    ? options.category.split(',').map((name) => name.trim()).filter(Boolean)
    : undefined;

  if (categories?.length) {
    const known = MEDIA_CATEGORIES.map((c) => c.name);
    const unknown = categories.filter((name) => !known.includes(name));
    if (unknown.length) {
      throw new UsageError(`unknown --category value(s): ${unknown.join(', ')}. Known: ${known.join(', ')}`);
    }
  }

  return {
    from,
    to,
    mediaDir: typeof options['media-dir'] === 'string' ? options['media-dir'] : undefined,
    categories,
    overwrite: options.overwrite === true,
    dryRun: options['dry-run'] === true,
    assumeYes: options.yes === true,
    r2: {
      r2Endpoint:        requireOption(options, 'r2-endpoint', 'the R2 S3 API endpoint'),
      r2Bucket:          requireOption(options, 'r2-bucket', 'the bucket name'),
      r2AccessKeyId:     requireOption(options, 'r2-access-key-id', 'the R2 access key id'),
      r2SecretAccessKey: requireOption(options, 'r2-secret-access-key', 'the R2 secret access key'),
      r2Region:          typeof options['r2-region'] === 'string' ? options['r2-region'] : 'auto',
    },
  };
}

export function localMediaSummary(mediaRoot = MEDIA_ROOT) {
  return MEDIA_CATEGORIES.map((category) => {
    const dir = path.join(mediaRoot, category.localPrefix);
    let count = 0;

    const countIn = (target) => {
      let entries;
      try {
        entries = fs.readdirSync(target, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.isDirectory()) countIn(path.join(target, entry.name));
        else count += 1;
      }
    };

    countIn(dir);
    return { name: category.name, count };
  });
}
