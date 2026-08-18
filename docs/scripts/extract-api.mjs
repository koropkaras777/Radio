import fs from 'node:fs';
import path from 'node:path';
import url, { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(DOCS_ROOT, '..');
const SERVER_SRC = path.join(REPO_ROOT, 'server', 'src');
const ROUTES_DIR = path.join(SERVER_SRC, 'http', 'routes');
const PRIVILEGES_FILE = path.join(REPO_ROOT, 'server', 'src', 'config', 'privileges.js');
const OUT_DIR = path.join(DOCS_ROOT, 'reference', 'generated');

const CHECK_ONLY = process.argv.includes('--check');

// ── Reading files ───────────────────────────────────────────────────────────
function walk(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

const rel = (p) => path.relative(REPO_ROOT, p).replace(/\\/g, '/');

function buildPrefixMap() {
  const map = new Map();

  for (const file of walk(ROUTES_DIR, (f) => f.endsWith('index.js'))) {
    const src = fs.readFileSync(file, 'utf-8');
    const dir = path.dirname(file);

    const importedFrom = new Map();
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
      const target = path.resolve(dir, m[2]);
      for (const raw of m[1].split(',')) {
        const name = raw.trim();
        if (name.startsWith('create')) importedFrom.set(name, target);
      }
    }

    for (const m of src.matchAll(/router\.use\(\s*'([^']+)'\s*,[^\n]*?(create\w+)\s*\(/g)) {
      const [, prefix, factory] = m;
      const target = importedFrom.get(factory);
      if (target) map.set(target, prefix);
    }
  }

  return map;
}

const GUARD_KEYS = [
  ['requireSuperAdmin', 'superAdmin'],
  ['requireArtAndAudioToken', 'artAudioToken'],
  ['requireArtTokenOnly', 'artToken'],
  ['requireAdminBearerOrQuery', 'adminBearerOrQuery'],
  ['requireAdmin', 'admin'],
];

function buildSharedMiddlewareMap() {
  const map = new Map();
  const sharedDir = path.join(ROUTES_DIR, 'shared');
  for (const file of walk(sharedDir, (f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(file, 'utf-8');
    const re = /export (?:function|const) (\w+)([\s\S]*?)(?=export (?:function|const) |$)/g;
    for (const m of src.matchAll(re)) {
      const privs = [...m[2].matchAll(/PRIVILEGES\.(\w+)/g)].map((x) => x[1]);
      if (privs.length) map.set(m[1], [...new Set(privs)]);
    }
  }
  return map;
}

function buildLocalAliases(src) {
  const map = new Map();
  for (const m of src.matchAll(/const (\w+)\s*=\s*require(?:Any)?Privilege\(([^)]*)\)/g)) {
    const privs = [...m[2].matchAll(/PRIVILEGES\.(\w+)/g)].map((x) => x[1]);
    if (privs.length) map.set(m[1], privs);
  }
  return map;
}

function extractGuards(segment, aliases, sharedMap) {
  let auth = 'public';
  for (const [needle, key] of GUARD_KEYS) {
    if (segment.includes(needle)) {
      auth = key;
      break;
    }
  }

  const allOf = new Set();
  const anyOfGroups = [];

  for (const m of segment.matchAll(/requirePrivilege\(\s*PRIVILEGES\.(\w+)/g)) {
    allOf.add(m[1]);
  }
  for (const [name, privs] of aliases) {
    if (new RegExp(`\\b${name}\\b`).test(segment)) anyOfGroups.push(privs);
  }
  for (const [name, privs] of sharedMap) {
    if (new RegExp(`\\b${name}\\b`).test(segment)) {
      anyOfGroups.push(privs);
      if (auth === 'public') auth = 'admin';
    }
  }

  return {
    auth,
    privilegeAll: [...allOf],
    privilegeAny: anyOfGroups,
    privilegeList: [...new Set([...allOf, ...anyOfGroups.flat()])],
  };
}

const suspects = [];

function sliceCall(src, openParenIndex) {
  let depth = 0;
  let quote = null;

  for (let i = openParenIndex; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return src.slice(openParenIndex, i + 1);
    }
  }
  return src.slice(openParenIndex);
}

function stripBlocks(text) {
  let depth = 0;
  let out = '';
  let quote = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { depth = Math.max(0, depth - 1); continue; }
    if (depth === 0) out += ch;
  }
  return out;
}

function collectEndpoints(prefixMap) {
  const endpoints = [];
  const sharedMap = buildSharedMiddlewareMap();
  const files = walk(ROUTES_DIR, (f) => f.endsWith('.js') && !f.endsWith('index.js'));

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const prefix = prefixMap.get(file) ?? '';
    const aliases = buildLocalAliases(src);

    const re = /router\.(get|post|put|patch|delete)\(\s*\n?\s*'([^']*)'([\s\S]{0,600}?)(?:async\s*)?\(\s*(?:_?req|_)\b/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const [, method, routePath, between] = m;
      const full = (prefix + routePath).replace(/\/+$/, '') || prefix || '/';

      const preceding = src.slice(Math.max(0, m.index - 400), m.index);
      const annotated = preceding.match(/@privileges\s+([A-Z_,\s]+)/);

      const call = sliceCall(src, src.indexOf('(', m.index));
      const args = stripBlocks(call);

      const guards = extractGuards(args, aliases, sharedMap);
      const annotatedPrivs = annotated
        ? annotated[1].split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const body = call;

      const privilegeAll = annotatedPrivs.length ? [] : guards.privilegeAll;
      const privilegeAny = annotatedPrivs.length ? [annotatedPrivs] : guards.privilegeAny;
      const hasPrivilege = privilegeAll.length > 0 || privilegeAny.length > 0;

      if (!hasPrivilege && /PRIVILEGES\.\w+/.test(body)) {
        suspects.push(`${method.toUpperCase()} ${full}  (${rel(file)})`);
      }

      endpoints.push({
        method: method.toUpperCase(),
        path: full,
        auth: guards.auth,
        privilegeAll,
        privilegeAny,
        privilegeList: annotatedPrivs.length ? annotatedPrivs : guards.privilegeList,
        perSection: annotatedPrivs.length > 0,
        source: rel(file),
      });
    }
  }

  endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return endpoints;
}

const RESERVED_EVENTS = new Set([
  'connect', 'connect_error', 'disconnect', 'disconnecting',
  'error', 'message', 'newListener', 'removeListener',
]);

function collectSocketEvents() {
  const inbound = new Map();
  const outbound = new Map();

  const add = (map, event, source, scope) => {
    if (RESERVED_EVENTS.has(event)) return;
    if (!map.has(event)) map.set(event, { sources: new Set(), scopes: new Set() });
    map.get(event).sources.add(source);
    if (scope) map.get(event).scopes.add(scope);
  };

  for (const file of walk(SERVER_SRC, (f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(file, 'utf-8');
    const source = rel(file);

    for (const m of src.matchAll(/socket\.on\(\s*'([^']+)'/g)) {
      add(inbound, m[1], source);
    }

    for (const m of src.matchAll(/\.emit\(\s*'([^']+)'/g)) {
      const event = m[1];
      const prefix = src.slice(Math.max(0, m.index - 90), m.index);

      if (/\bthis\s*$/.test(prefix)) continue; // внутрішній EventEmitter, не сокет

      const room = prefix.match(/\.to\(([^)]*)\)\s*\??\s*$/);
      const scope = room
        ? `room:${room[1].trim()}`
        : /\bio\s*\??\s*$/.test(prefix)
          ? 'all'
          : 'one';

      add(outbound, event, source, scope);
    }
  }

  const toRows = (map) =>
    [...map.entries()]
      .map(([event, { sources, scopes }]) => ({
        event,
        sources: [...sources].sort(),
        scopes: [...scopes].sort(),
      }))
      .sort((a, b) => a.event.localeCompare(b.event));

  return { inbound: toRows(inbound), outbound: toRows(outbound) };
}

function collectPrivileges() {
  if (!fs.existsSync(PRIVILEGES_FILE)) return [];
  const src = fs.readFileSync(PRIVILEGES_FILE, 'utf-8');
  return [...src.matchAll(/(\w+)\s*:\s*'([^']+)'/g)].map(([, key, value]) => ({ key, value }));
}

// ── Directory localization ────────────────────────────────────────────────────
const LOCALES = ['uk', 'en'];
const BASE_LOCALE = 'uk';

const pick = (value, locale) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[locale] ?? value[BASE_LOCALE] ?? '';
  }
  return value;
};

const hasTranslation = (value, locale) =>
  locale === BASE_LOCALE ||
  (value && typeof value === 'object' && !Array.isArray(value) && Boolean(value[locale]));

const UI = {
  uk: {
    autogen:
      '<!-- ЗГЕНЕРОВАНО автоматично через `npm run extract`. Не редагувати вручну. -->\n' +
      '<!-- Джерело правди — код сервера. Описи додавайте у файли поза цією текою. -->\n',
    and: ' + ',
    or: ' або ',
    perSection: ' *(посекційно)*',
    none: '—',
    details: 'Деталі',
    auth: {
      public: 'публічний',
      superAdmin: 'лише супер-адмін',
      artAudioToken: 'art + audio токен',
      artToken: 'art-токен',
      adminBearerOrQuery: 'адмін (bearer або query)',
      admin: 'адмін (JWT)',
    },
    scope: { all: 'усім', one: 'одному сокету', room: (r) => `кімната ${r}` },
    ep: {
      total: (n, c) => `Усього ендпоінтів: **${n}**. Описано детально: **${c}**.`,
      groups: { admin: 'Адмінські', stream: 'Потік', client: 'Клієнтські' },
      head: '| Метод | Шлях | Доступ | Привілей | Опис |\n|---|---|---|---|---|\n',
      query: 'Query',
      headers: 'Заголовки',
      body: 'Тіло запиту',
      response: 'Відповідь',
      errors: 'Помилки',
    },
    ev: {
      total: (i, o, c, t) =>
        `Клієнт → сервер: **${i}** подій. Сервер → клієнт: **${o}** подій. ` +
        `Описано детально: **${c}** з ${t}.`,
      inbound: 'Клієнт → сервер',
      outbound: 'Сервер → клієнт',
      inboundIntro: 'Події, які надсилає клієнт.',
      outboundIntro: 'Події, на які клієнт має підписатися.',
      headIn: '| Подія | Опис |\n|---|---|\n',
      headOut: '| Подія | Кому надсилається | Опис |\n|---|---|---|\n',
      ack: 'Відповідь у колбеку',
    },
    pv: {
      total: (n) => `Усього привілеїв: **${n}**`,
      head: '| Привілей | Значення | Захищає ендпоінтів |\n|---|---|---|\n',
      note:
        '\n> Таблиця рахує лише HTTP-ендпоінти. Частина привілеїв — насамперед\n' +
        '> `RADIO_HOST` і `RADIO_MODERATOR` — перевіряється ще й на рівні Socket.io\n' +
        '> (`socket/context.js`), тож нуль у колонці не означає, що привілей не діє.\n',
    },
  },
  en: {
    autogen:
      '<!-- GENERATED by `npm run extract`. Do not edit by hand. -->\n' +
      '<!-- The server source is the source of truth. Add descriptions outside this folder. -->\n',
    and: ' + ',
    or: ' or ',
    perSection: ' *(per section)*',
    none: '—',
    details: 'Details',
    auth: {
      public: 'public',
      superAdmin: 'super admin only',
      artAudioToken: 'art + audio token',
      artToken: 'art token',
      adminBearerOrQuery: 'admin (bearer or query)',
      admin: 'admin (JWT)',
    },
    scope: { all: 'everyone', one: 'single socket', room: (r) => `room ${r}` },
    ep: {
      total: (n, c) => `Endpoints: **${n}**. Documented in detail: **${c}**.`,
      groups: { admin: 'Admin', stream: 'Stream', client: 'Client' },
      head: '| Method | Path | Access | Privilege | Description |\n|---|---|---|---|---|\n',
      query: 'Query',
      headers: 'Headers',
      body: 'Request body',
      response: 'Response',
      errors: 'Errors',
    },
    ev: {
      total: (i, o, c, t) =>
        `Client → server: **${i}** events. Server → client: **${o}** events. ` +
        `Documented in detail: **${c}** of ${t}.`,
      inbound: 'Client → server',
      outbound: 'Server → client',
      inboundIntro: 'Events the client sends.',
      outboundIntro: 'Events the client should subscribe to.',
      headIn: '| Event | Description |\n|---|---|\n',
      headOut: '| Event | Sent to | Description |\n|---|---|---|\n',
      ack: 'Acknowledgement payload',
    },
    pv: {
      total: (n) => `Privileges: **${n}**`,
      head: '| Privilege | Value | Endpoints guarded |\n|---|---|---|\n',
      note:
        '\n> The table counts HTTP endpoints only. Some privileges — notably\n' +
        '> `RADIO_HOST` and `RADIO_MODERATOR` — are also checked at the Socket.io\n' +
        '> layer (`socket/context.js`), so a zero does not mean the privilege is unused.\n',
    },
  },
};

const renderScope = (scope, ui) => {
  if (scope.startsWith('room:')) return ui.scope.room(scope.slice(5));
  return ui.scope[scope] ?? scope;
};

const renderPrivilege = (ep, ui) => {
  const parts = [
    ...ep.privilegeAll,
    ...ep.privilegeAny.map((group) => group.join(ui.or)),
  ];
  if (!parts.length) return ui.none;
  return `\`${parts.join(ui.and)}\`${ep.perSection ? ui.perSection : ''}`;
};

const endpointKey = (ep) => `${ep.method} ${ep.path}`;
const endpointAnchor = (ep) =>
  endpointKey(ep).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function renderEndpointDetail(ep, doc, locale) {
  const ui = UI[locale];
  let md = `### \`${endpointKey(ep)}\`\n\n${pick(doc.summary, locale)}\n\n`;

  const rows = [
    [ui.ep.query, doc.query],
    [ui.ep.headers, doc.headers],
  ].filter(([, v]) => v);
  for (const [label, value] of rows) md += `**${label}:** ${pick(value, locale)}\n\n`;

  const blocks = [
    [ui.ep.body, doc.body],
    [ui.ep.response, doc.response],
  ].filter(([, v]) => v);
  for (const [label, value] of blocks) {
    md += `**${label}:**\n\n\`\`\`js\n${pick(value, locale)}\n\`\`\`\n\n`;
  }

  if (doc.errors) md += `**${ui.ep.errors}:** ${pick(doc.errors, locale)}\n\n`;
  if (doc.notes) md += `${pick(doc.notes, locale)}\n\n`;
  return md;
}

function renderEndpoints(endpoints, endpointDocs, locale) {
  const ui = UI[locale];
  const groupOf = (ep) =>
    ep.path.startsWith('/api/admin') ? 'admin'
      : ep.path.startsWith('/api/stream') ? 'stream'
        : 'client';

  const groups = new Map();
  for (const ep of endpoints) {
    const key = groupOf(ep);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ep);
  }

  const covered = endpoints.filter((ep) => endpointDocs[endpointKey(ep)]).length;

  let md = `${ui.autogen}\n${ui.ep.total(endpoints.length, covered)}\n\n`;

  for (const key of ['admin', 'client', 'stream']) {
    const rows = groups.get(key);
    if (!rows) continue;
    md += `## ${ui.ep.groups[key]}\n\n${ui.ep.head}`;
    for (const ep of rows) {
      const doc = endpointDocs[endpointKey(ep)];
      const pathCell = doc ? `[\`${ep.path}\`](#${endpointAnchor(ep)})` : `\`${ep.path}\``;
      const summary = doc ? pick(doc.summary, locale) : ui.none;
      md += `| \`${ep.method}\` | ${pathCell} | ${ui.auth[ep.auth]} | ${renderPrivilege(ep, ui)} | ${summary} |\n`;
    }
    md += '\n';
  }

  const detailed = endpoints.filter((ep) => endpointDocs[endpointKey(ep)]);
  if (detailed.length) {
    md += `## ${ui.details}\n\n`;
    for (const ep of detailed) {
      md += renderEndpointDetail(ep, endpointDocs[endpointKey(ep)], locale);
    }
  }
  return md;
}

function renderEventDetail(row, doc, locale) {
  const ui = UI[locale];
  let md = `### \`${row.event}\`\n\n`;
  if (doc.audience) md += `<Badge type="info" text="${doc.audience}" />\n\n`;
  md += `${pick(doc.summary, locale)}\n\n`;

  if (doc.payload) {
    const payload = pick(doc.payload, locale);
    md += payload.includes('\n') || payload.includes('{')
      ? `**Payload:**\n\n\`\`\`js\n${payload}\n\`\`\`\n\n`
      : `**Payload:** ${payload}\n\n`;
  }
  if (doc.ack) md += `**${ui.ev.ack}:**\n\n\`\`\`js\n${pick(doc.ack, locale)}\n\`\`\`\n\n`;
  if (doc.notes) md += `${pick(doc.notes, locale)}\n\n`;
  return md;
}

function renderSocket({ inbound, outbound }, eventDocs, locale) {
  const ui = UI[locale];
  const documented = (rows) => rows.filter((r) => eventDocs[r.event]).length;
  const total = inbound.length + outbound.length;
  const covered = documented(inbound) + documented(outbound);

  let md = `${ui.autogen}\n${ui.ev.total(inbound.length, outbound.length, covered, total)}\n\n`;

  const section = (title, intro, rows, extraCol) => {
    let out = `## ${title}\n\n${intro}\n\n`;
    out += extraCol ? ui.ev.headOut : ui.ev.headIn;
    for (const row of rows) {
      const doc = eventDocs[row.event];
      const link = doc ? `[\`${row.event}\`](#${row.event.replace(/_/g, '-')})` : `\`${row.event}\``;
      const summary = doc ? pick(doc.summary, locale) : ui.none;
      const scopes = row.scopes.map((s) => renderScope(s, ui)).join(', ') || ui.none;
      out += extraCol ? `| ${link} | ${scopes} | ${summary} |\n` : `| ${link} | ${summary} |\n`;
    }
    return out + '\n';
  };

  md += section(ui.ev.inbound, ui.ev.inboundIntro, inbound, false);
  md += section(ui.ev.outbound, ui.ev.outboundIntro, outbound, true);

  const detailed = [...inbound, ...outbound].filter((r) => eventDocs[r.event]);
  if (detailed.length) {
    md += `## ${ui.details}\n\n`;
    for (const row of detailed) md += renderEventDetail(row, eventDocs[row.event], locale);
  }

  return md;
}

function renderPrivileges(privileges, endpoints, locale) {
  const ui = UI[locale];
  let md = `${ui.autogen}\n${ui.pv.total(privileges.length)}\n\n${ui.pv.head}`;
  for (const p of privileges) {
    const count = endpoints.filter((e) => e.privilegeList?.includes(p.key)).length;
    md += `| \`${p.key}\` | \`${p.value}\` | ${count} |\n`;
  }
  return `${md}${ui.pv.note}\n`;
}

// ── Record / check ────────────────────────────────────────────────────────
function emit(locale, fileName, content) {
  const dir = path.join(OUT_DIR, locale);
  const target = path.join(dir, fileName);

  if (CHECK_ONLY) {
    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : null;
    if (existing !== content) {
      console.error(`✖ ${rel(target)} is out of date - re-run \`npm run extract\` in docs/`);
      return false;
    }
    return true;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, content, 'utf-8');
  console.log(`✔ wrote ${rel(target)}`);
  return true;
}

async function loadAnnotations(fileName, exportName) {
  const file = path.join(DOCS_ROOT, 'reference', 'annotations', fileName);
  if (!fs.existsSync(file)) return {};
  const mod = await import(url.pathToFileURL(file).href);
  return mod[exportName] ?? {};
}

function applyTranslations(base, translations, locale) {
  const merged = {};

  for (const [key, doc] of Object.entries(base)) {
    const tr = translations[key];
    if (!tr) {
      merged[key] = doc;
      continue;
    }

    const next = { ...doc };
    for (const [field, translated] of Object.entries(tr)) {
      if (!translated) continue;
      const original = doc[field];
      if (original && typeof original === 'object' && !Array.isArray(original)) {
        next[field] = { ...original, [locale]: original[locale] ?? translated };
      } else {
        next[field] = { [BASE_LOCALE]: original ?? '', [locale]: translated };
      }
    }
    merged[key] = next;
  }

  const orphans = Object.keys(translations).filter((key) => !(key in base));
  return { merged, orphans };
}

async function main() {
  const prefixMap = buildPrefixMap();
  const endpoints = collectEndpoints(prefixMap);
  const socket = collectSocketEvents();
  const privileges = collectPrivileges();
  const baseEventDocs = await loadAnnotations('events.mjs', 'EVENT_DOCS');
  const baseEndpointDocs = await loadAnnotations('endpoints.mjs', 'ENDPOINT_DOCS');

  let eventDocs = baseEventDocs;
  let endpointDocs = baseEndpointDocs;
  const orphanKeys = [];

  for (const locale of LOCALES.filter((l) => l !== BASE_LOCALE)) {
    const evTr = await loadAnnotations(`${locale}/events.mjs`, 'EVENT_DOCS');
    const epTr = await loadAnnotations(`${locale}/endpoints.mjs`, 'ENDPOINT_DOCS');

    const ev = applyTranslations(eventDocs, evTr, locale);
    const ep = applyTranslations(endpointDocs, epTr, locale);
    eventDocs = ev.merged;
    endpointDocs = ep.merged;
    orphanKeys.push(
      ...ev.orphans.map((k) => `${locale}/events.mjs → ${k}`),
      ...ep.orphans.map((k) => `${locale}/endpoints.mjs → ${k}`),
    );
  }

  const results = [];
  for (const locale of LOCALES) {
    results.push(
      emit(locale, 'endpoints.md', renderEndpoints(endpoints, endpointDocs, locale)),
      emit(locale, 'socket-events.md', renderSocket(socket, eventDocs, locale)),
      emit(locale, 'privileges.md', renderPrivileges(privileges, endpoints, locale)),
    );
  }

  const totalEvents = socket.inbound.length + socket.outbound.length;
  const describedEvents = [...socket.inbound, ...socket.outbound]
    .filter((r) => eventDocs[r.event]).length;

  console.log(
    `\nFound: ${endpoints.length} endpoints, ` +
      `${socket.inbound.length} inbound + ${socket.outbound.length} outbound events, ` +
      `${privileges.length} privileges.`
  );
  const describedEndpoints = endpoints.filter((ep) => endpointDocs[endpointKey(ep)]).length;

  console.log(
    `Description coverage: events ${describedEvents}/${totalEvents} ` +
      `(${Math.round((describedEvents / totalEvents) * 100)}%), ` +
      `endpoints ${describedEndpoints}/${endpoints.length} ` +
      `(${Math.round((describedEndpoints / endpoints.length) * 100)}%).`
  );

  for (const locale of LOCALES.filter((l) => l !== BASE_LOCALE)) {
    const evTranslated = Object.values(eventDocs)
      .filter((d) => hasTranslation(d.summary, locale)).length;
    const epTranslated = Object.values(endpointDocs)
      .filter((d) => hasTranslation(d.summary, locale)).length;
    const evTotal = Object.keys(eventDocs).length;
    const epTotal = Object.keys(endpointDocs).length;
    console.log(
      `Translation (${locale}): events ${evTranslated}/${evTotal} ` +
        `(${Math.round((evTranslated / evTotal) * 100)}%), ` +
        `endpoints ${epTranslated}/${epTotal} ` +
        `(${Math.round((epTranslated / epTotal) * 100)}%). ` +
        `Untranslated entries fall back to Ukrainian.`
    );
  }

  const staleEvents = Object.keys(eventDocs).filter(
    (event) => ![...socket.inbound, ...socket.outbound].some((r) => r.event === event)
  );
  const knownKeys = new Set(endpoints.map(endpointKey));
  const staleEndpoints = Object.keys(endpointDocs).filter((key) => !knownKeys.has(key));

  if (suspects.length) {
    console.warn(
      '\n⚠ Looks like a privilege check inside a handler body with nothing declared.\n' +
        '  Add a `// @privileges X, Y` comment above the route, or the reference\n' +
        '  will show the endpoint as unprotected:'
    );
    for (const s of suspects) console.warn(`    ${s}`);
  }

  let stale = false;
  if (orphanKeys.length) {
    console.error('✖ Translations reference keys that the base descriptions do not have:');
    for (const k of orphanKeys) console.error(`    ${k}`);
    stale = true;
  }
  if (staleEvents.length) {
    console.error(`✖ Described events that do not exist in the code: ${staleEvents.join(', ')}`);
    stale = true;
  }
  if (staleEndpoints.length) {
    console.error(`✖ Described endpoints that do not exist in the code: ${staleEndpoints.join(', ')}`);
    stale = true;
  }
  if (stale && CHECK_ONLY) process.exit(1);

  if (CHECK_ONLY && results.includes(false)) process.exit(1);
}

await main();
