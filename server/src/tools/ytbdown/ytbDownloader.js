import { spawn } from 'child_process';
import { access, constants as fsConstants, mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { FFMPEG_PATH, YTBDOWN_PATH } from '../../config/env.js';

const IS_WINDOWS = process.platform === 'win32';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_BIN_DIR = path.join(MODULE_DIR, '..', '..', 'bin');

const EXTRA_SEARCH_DIRS = IS_WINDOWS
  ? [
      process.cwd(), path.join(process.cwd(), 'bin'), path.join(process.cwd(), 'tools'),
      MODULE_DIR, path.join(MODULE_DIR, 'bin'), path.join(MODULE_DIR, 'tools'), REPO_BIN_DIR,
    ]
  : [
      process.cwd(), path.join(process.cwd(), 'bin'), path.join(process.cwd(), 'tools'),
      MODULE_DIR, path.join(MODULE_DIR, 'bin'), path.join(MODULE_DIR, 'tools'), REPO_BIN_DIR,
      '/usr/local/bin', '/usr/bin',
    ];

async function isExecutableFile(filePath) {
  try {
    await access(filePath, fsConstants.F_OK | fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(names) {
  const pathEnv = process.env.PATH || process.env.Path || '';
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (await isExecutableFile(candidate)) return candidate;
    }
  }
  return null;
}

async function findInExtraDirs(names) {
  for (const dir of EXTRA_SEARCH_DIRS) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (await isExecutableFile(candidate)) return candidate;
    }
  }
  return null;
}


function createExecutableFinder(winNames, posixNames, overridePath) {
  const names = IS_WINDOWS ? winNames : posixNames;
  let cachedPath = null;
  let cachedAt = 0;
  const CACHE_TTL_MS = 60_000;

  return async function find({ force = false } = {}) {
    if (overridePath) {
      if (await isExecutableFile(overridePath)) return overridePath;
    }

    const now = Date.now();
    if (!force && (now - cachedAt) < CACHE_TTL_MS) {
      return cachedPath;
    }
    const found = (await findOnPath(names)) || (await findInExtraDirs(names));
    cachedPath = found;
    cachedAt = now;
    return found;
  };
}

export const findYtbdown = createExecutableFinder(
  ['ytbdown.exe', 'ytbdown.cmd', 'ytbdown.bat'],
  ['ytbdown'],
  YTBDOWN_PATH,
);

export const findFfmpeg = createExecutableFinder(
  ['ffmpeg.exe'],
  ['ffmpeg'],
  FFMPEG_PATH === 'ffmpeg' ? '' : FFMPEG_PATH,
);

export async function isYtbdownAvailable() {
  return Boolean(await findYtbdown());
}

export async function isFfmpegAvailable() {
  return Boolean(await findFfmpeg());
}

export async function getYoutubeToolsStatus() {
  const [ytbdownPath, ffmpegPath] = await Promise.all([findYtbdown(), findFfmpeg()]);
  return {
    ytbdownAvailable: Boolean(ytbdownPath),
    ffmpegAvailable: Boolean(ffmpegPath),
    available: Boolean(ytbdownPath) && Boolean(ffmpegPath),
    ytbdownPath: ytbdownPath || null,
    ffmpegPath: ffmpegPath || null,
    searchedDirs: EXTRA_SEARCH_DIRS,
  };
}

const YOUTUBE_HOST_RE = /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)music\.youtube\.com$/i;

export function isSupportedYoutubeUrl(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl)); } catch { return false; }
  return /^https?:$/.test(u.protocol) && YOUTUBE_HOST_RE.test(u.hostname);
}

export function isPlaylistUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl));
    const hasList = u.searchParams.has('list');
    return (hasList && /youtube/i.test(u.hostname)) || u.pathname.startsWith('/browse/VL');
  } catch {
    return false;
  }
}

const CHILD_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };

function runChildProcess(exePath, args, { signal, timeoutMs, failureLabel }) {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, args, { windowsHide: true, env: CHILD_ENV });

    let stderrTail = '';
    child.stderr?.on('data', (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000);
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error(`${failureLabel} timed out`), { code: 'YTBDOWN_TIMEOUT' }));
    }, timeoutMs);

    const onAbort = () => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error('aborted'), { code: 'YTBDOWN_ABORTED' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', (err) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(Object.assign(err, { code: err.code || 'YTBDOWN_SPAWN_ERROR' }));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`${failureLabel} exited with code ${code}: ${stderrTail}`), { code: 'YTBDOWN_FAILED' }));
    });
  });
}

async function requireTools() {
  const { ytbdownAvailable, ffmpegAvailable } = await getYoutubeToolsStatus();
  if (!ytbdownAvailable) {
    throw Object.assign(new Error('ytbdown executable not found'), { code: 'YTBDOWN_NOT_FOUND' });
  }
  if (!ffmpegAvailable) {
    throw Object.assign(new Error('ffmpeg executable not found'), { code: 'FFMPEG_NOT_FOUND' });
  }
  return findYtbdown();
}

export async function listYoutubeTracks(url, { lang = 'uk', signal, timeoutMs = 2 * 60 * 1000 } = {}) {
  const exePath = await findYtbdown();
  if (!exePath) {
    throw Object.assign(new Error('ytbdown executable not found'), { code: 'YTBDOWN_NOT_FOUND' });
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'ytbdown-list-'));
  const linksFile = path.join(tempDir, 'links.txt');

  try {
    await runChildProcess(
      exePath,
      ['list', url, '--titles', '-o', linksFile, '--lang', lang],
      { signal, timeoutMs, failureLabel: 'ytbdown list' },
    );

    let raw = '';
    try {
      raw = await readFile(linksFile, 'utf8');
    } catch {
      throw Object.assign(new Error('ytbdown list produced no output file'), { code: 'YTBDOWN_NO_OUTPUT' });
    }

    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const tabIndex = line.indexOf('\t');
        return tabIndex === -1
          ? { url: line, title: '' }
          : { url: line.slice(0, tabIndex), title: line.slice(tabIndex + 1) };
      });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function downloadYoutubeTrack(url, { quality = '128K', lang = 'uk', signal, timeoutMs = 5 * 60 * 1000 } = {}) {
  const exePath = await requireTools();

  const tempDir = await mkdtemp(path.join(tmpdir(), 'ytbdown-'));

  try {
    await runChildProcess(
      exePath,
      [url, '--strip', '-q', quality, '-o', tempDir, '--lang', lang],
      { signal, timeoutMs, failureLabel: 'ytbdown' },
    );

    const files = (await readdir(tempDir)).filter((f) => /\.mp3$/i.test(f));
    if (!files.length) {
      throw Object.assign(new Error('ytbdown finished but produced no mp3 file'), { code: 'YTBDOWN_NO_OUTPUT' });
    }
    if (files.length > 1) {
      throw Object.assign(new Error('ytbdown produced multiple files'), { code: 'YTBDOWN_MULTIPLE_OUTPUT' });
    }

    const filename = files[0];
    const buffer = await readFile(path.join(tempDir, filename));
    return { buffer, filename };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}