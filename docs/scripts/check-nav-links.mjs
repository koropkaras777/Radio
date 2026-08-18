import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.join(__dirname, '..');
const CONFIG = path.join(DOCS_ROOT, '.vitepress', 'config.mjs');

const HOME_PAGES = ['index.md', path.join('en', 'index.md')];

function collectLinks() {
  const sources = [CONFIG, ...HOME_PAGES.map((p) => path.join(DOCS_ROOT, p))];
  const links = new Map(); // посилання → де знайдено

  for (const file of sources) {
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf-8');
    const where = path.relative(DOCS_ROOT, file);
    for (const m of src.matchAll(/link:\s*'?([^'\s]+)'?/g)) {
      if (!links.has(m[1])) links.set(m[1], where);
    }
  }
  return links;
}

function findCrossLocaleLinks() {
  const bad = [];
  const enRoot = path.join(DOCS_ROOT, 'en');
  if (!fs.existsSync(enRoot)) return bad;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;

      const src = fs.readFileSync(full, 'utf-8');
      const where = path.relative(DOCS_ROOT, full);

      const patterns = [/\]\((\/[^)#]*)/g, /link:\s*'?(\/[^'\s]+)'?/g];
      for (const re of patterns) {
        for (const m of src.matchAll(re)) {
          const link = m[1];
          if (link.startsWith('/en/') || link === '/en') continue;
          if (!/^\/[a-z]/.test(link)) continue; // не внутрішнє посилання
          bad.push(`${link}  (у ${where})`);
        }
      }
    }
  };

  walk(enRoot);
  return bad;
}

function targetFor(link) {
  const clean = link.split('#')[0].split('?')[0];
  if (clean.endsWith('/')) return path.join(DOCS_ROOT, clean, 'index.md');
  return path.join(DOCS_ROOT, `${clean}.md`);
}

const links = collectLinks();
const broken = [];

for (const [link, where] of links) {
  if (/^https?:/.test(link) || link.startsWith('mailto:')) continue;
  if (!fs.existsSync(targetFor(link))) {
    broken.push(`${link}  (у ${where})`);
  }
}

const crossLocale = findCrossLocaleLinks();

console.log(`Navigation links checked: ${links.size}`);

let failed = false;

if (broken.length) {
  console.error('✖ Links point at pages that do not exist:');
  for (const b of broken) console.error(`    ${b}`);
  failed = true;
}

if (crossLocale.length) {
  console.error('✖ Pages in the English section link to Ukrainian ones:');
  for (const b of crossLocale) console.error(`    ${b}`);
  console.error('  Add the /en/ prefix, or make the link external.');
  failed = true;
}

if (failed) process.exit(1);

console.log('✔ Every navigation link resolves, and no locale is mixed');
