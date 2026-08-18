import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.join(__dirname, '..', '..');
export const HISTORY_DIR = path.join(SERVER_ROOT, 'migration-history');

let logLines = [];

export function log(message = '') {
  console.log(message);
  logLines.push(message);
}

export const rel = (target) =>
  path.relative(SERVER_ROOT, target).replace(/\\/g, '/') || '.';

export function resetLog() {
  logLines = [];
}

export function saveLog(label) {
  if (!logLines.length) return;

  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(HISTORY_DIR, `${label}-${stamp}.log`);

  fs.writeFileSync(file, `${logLines.join('\n')}\n`, 'utf-8');
  console.log(`\nLog written to ${rel(file)}`);
}

export function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

/**
 * @param {string} question
 * @param {{ assumeYes?: boolean }} options
 * @returns {Promise<boolean>}
 */
export async function confirm(question, { assumeYes = false } = {}) {
  if (assumeYes) return true;
  const answer = await ask(`${question} [y/N] `);
  return answer.toLowerCase() === 'y';
}

/**
 * @param {string[]} argv
 * @returns {{ command: string|null, options: Record<string, string|true>, rest: string[] }}
 */
export function parseArgs(argv) {
  const options = {};
  const rest = [];
  let command = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      if (command === null) command = arg;
      else rest.push(arg);
      continue;
    }

    const body = arg.slice(2);
    const eq = body.indexOf('=');

    if (eq !== -1) {
      options[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }

    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[body] = next;
      i += 1;
    } else {
      options[body] = true;
    }
  }

  return { command, options, rest };
}

export class UsageError extends Error {}

/**
 * @param {Record<string, string|true>} options
 * @param {string} name
 * @param {string} why explanation shown when it is missing
 */
export function requireOption(options, name, why) {
  const value = options[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new UsageError(`--${name} is required: ${why}`);
  }
  return value.trim();
}

export const plural = (count, noun, suffix = 's') =>
  `${count} ${noun}${count === 1 ? '' : suffix}`;
