import dotenv from 'dotenv';
import { join } from 'node:path';
import { SERVER_ROOT } from './paths.js';

dotenv.config({ path: join(SERVER_ROOT, '.env') });

if (!process.env.JWT_SECRET) {
  console.error('[Fatal] JWT_SECRET is not set in environment variables. Refusing to start.');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const parseOrigins = (raw) => {
  if (!raw) return null;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length === 1 ? list[0] : list;
};

const normalizeDataProvider = (value) => {
  const raw = String(value || 'json').trim().toLowerCase();
  return raw === 'sql' ? 'sql' : 'json';
};

const normalizeMediaStorage = (value) => {
  const raw = String(value || 'local').trim().toLowerCase();
  return raw === 'cloud' ? 'cloud' : 'local';
};

const DONATIONS_PROVIDER_IDS = ['liqpay', 'stripe', 'donatello', 'kofi'];

const normalizeDonationsProvider = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return DONATIONS_PROVIDER_IDS.includes(raw) ? raw : null;
};

// ── Core ─────────────────────────────────────────────────────────────────────
export const PORT       = process.env.PORT || 3001;
export const HOST       = '0.0.0.0';
export const JWT_SECRET = process.env.JWT_SECRET;

// ── Super admin ───────────────────────────────────────────────────────────────
export const ADMIN_LOGIN = (process.env.ADMIN_LOGIN || '').trim();
export const ADMIN_PASS  = process.env.ADMIN_PASS || '';

export const SUPER_ADMIN_LOGIN = ADMIN_LOGIN || 'super';

// ── Media tooling ─────────────────────────────────────────────────────────────
export const FFMPEG_PATH  = (process.env.FFMPEG_PATH  || 'ffmpeg').trim();
export const YTBDOWN_PATH = (process.env.YTBDOWN_PATH || '').trim();

export const ART_TOKEN_SECRET =
  process.env.ART_TOKEN_SECRET || 'art-token-fallback-secret-change-me';

if (!process.env.ART_TOKEN_SECRET) {
  console.warn('[Warning] ART_TOKEN_SECRET is not set - media tokens use a well-known fallback secret.');
}
export const IS_PROD    = process.env.NODE_ENV === 'production';

export const CLIENT_ORIGIN = IS_PROD
  ? (process.env.CLIENT_ORIGIN || null)
  : (parseOrigins(process.env.CLIENT_ORIGIN) || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
    ]);

// ── Documentation site ───────────────────────────────────────────────────────
export const DOCS_HOST = (process.env.DOCS_HOST || '').trim().toLowerCase();

// ── Database ─────────────────────────────────────────────────────────────────
export const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || null;
export const TURSO_AUTH_TOKEN   = process.env.TURSO_AUTH_TOKEN   || null;

export const isLocalDbUrl = (url) => {
  const u = String(url || '').trim().toLowerCase();
  return u.startsWith('file:') || u === ':memory:';
};

export const DB_IS_REMOTE = Boolean(TURSO_DATABASE_URL) && !isLocalDbUrl(TURSO_DATABASE_URL);

export const DB_ENABLED = Boolean(
  TURSO_DATABASE_URL && (isLocalDbUrl(TURSO_DATABASE_URL) || TURSO_AUTH_TOKEN)
);

export const DATA_PROVIDER = normalizeDataProvider(process.env.DATA_PROVIDER);

if (DATA_PROVIDER === 'sql' && !DB_ENABLED) {
  console.error(
    TURSO_DATABASE_URL
      ? '[Fatal] DATA_PROVIDER=sql with a remote TURSO_DATABASE_URL requires TURSO_AUTH_TOKEN.'
      : '[Fatal] DATA_PROVIDER=sql requires TURSO_DATABASE_URL (a local "file:./data/sql/radio.db" works and needs no token).'
  );
  process.exit(1);
}

// ── Streaming mode ────────────────────────────────────────────────────────────
export const STREAM_MODE = String(process.env.STREAM_MODE || 'false').trim().toLowerCase() === 'true';

// ── Radio hosts (live DJs / guest room) ───────────────────────────────────────
const radioHostsRequested = String(process.env.RADIO_HOSTS_MODE || 'false').trim().toLowerCase() === 'true';

export const RADIO_HOSTS_MODE = radioHostsRequested && STREAM_MODE;

if (radioHostsRequested && !STREAM_MODE) {
  console.warn(
    '[Warn] RADIO_HOSTS_MODE=true needs STREAM_MODE=true - live hosts speak over the ' +
    'FFmpeg broadcast stream, which does not exist in sync mode. Live hosts stay ' +
    'disabled; the rest of the radio runs normally.'
  );
}

const parsedMaxLiveHostSlots = Number(process.env.MAX_LIVE_HOST_SLOTS);
export const MAX_LIVE_HOST_SLOTS = Number.isInteger(parsedMaxLiveHostSlots) && parsedMaxLiveHostSlots >= 0
  ? parsedMaxLiveHostSlots
  : (() => {
      if (process.env.MAX_LIVE_HOST_SLOTS !== undefined) {
        console.warn(
          `[Warning] MAX_LIVE_HOST_SLOTS="${process.env.MAX_LIVE_HOST_SLOTS}" is not a valid ` +
          'non-negative integer - falling back to 1.'
        );
      }
      return 1;
    })();

// ── Radio hosts: personal monitor channel (WebRTC via werift) ──────
export const HOST_MONITOR_ICE_PORT_MIN = Number(process.env.HOST_MONITOR_ICE_PORT_MIN) || 40000;
export const HOST_MONITOR_ICE_PORT_MAX = Number(process.env.HOST_MONITOR_ICE_PORT_MAX) || 40099;
export const HOST_MONITOR_STUN_URL     = (process.env.HOST_MONITOR_STUN_URL || 'stun:stun.l.google.com:19302').trim();

// ── Timezone & radio mode ─────────────────────────────────────────────────────
export const TIME_ZONE = (process.env.TIME_ZONE || 'Europe/Kyiv').trim();

export const NIGHT_MODE = String(process.env.NIGHT_MODE || 'true').trim().toLowerCase() !== 'false';

const parseHour = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback;
};

export const DAY_START_HOUR   = parseHour(process.env.DAY_START_HOUR, 6);
export const NIGHT_START_HOUR = parseHour(process.env.NIGHT_START_HOUR, 0);

// ── Lyrics ────────────────────────────────────────────────────────────────────
export const LYRICS_PREFETCH = String(process.env.LYRICS_PREFETCH || '').trim().toLowerCase() === 'true';

// ── Local library reconciliation ────────────────────────────────────────────
export const CONFIRM_TRACK_CLEANUP = String(process.env.CONFIRM_TRACK_CLEANUP || '').trim().toLowerCase() === 'true';

// ── Audit log & play history retention (shared by both) ────────────────────────
export const LOG_RETENTION_DAYS = Math.max(1, Number(process.env.LOG_RETENTION_DAYS) || 7);

export const LOG_PURGE_HOUR = Math.min(23, Math.max(0, Number(process.env.LOG_PURGE_HOUR) || 4));

export const MEDIA_STORAGE = normalizeMediaStorage(process.env.MEDIA_STORAGE);
export const USE_CLOUD_MEDIA = MEDIA_STORAGE === 'cloud';

export const R2_ENDPOINT         = (process.env.R2_ENDPOINT          || '').trim();
export const R2_BUCKET           = (process.env.R2_BUCKET            || '').trim();
export const R2_ACCESS_KEY_ID    = (process.env.R2_ACCESS_KEY_ID     || '').trim();
export const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
export const R2_REGION           = (process.env.R2_REGION            || 'auto').trim();
export const R2_PUBLIC_BASE_URL  = (process.env.R2_PUBLIC_BASE_URL   || '').trim().replace(/\/+$/, '');
export const R2_PRESIGN_TTL_S    = Number.isFinite(Number(process.env.R2_PRESIGN_TTL_S))
  ? Number(process.env.R2_PRESIGN_TTL_S)
  : 900;
export const R2_ARTS_PREFIX      = (process.env.R2_ARTS_PREFIX || 'arts').trim();

export const MUSIC_SOURCE = MEDIA_STORAGE;

if (USE_CLOUD_MEDIA) {
  const missing = [
    ['R2_ENDPOINT',          R2_ENDPOINT],
    ['R2_BUCKET',            R2_BUCKET],
    ['R2_ACCESS_KEY_ID',     R2_ACCESS_KEY_ID],
    ['R2_SECRET_ACCESS_KEY', R2_SECRET_ACCESS_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);

  if (missing.length) {
    console.error(`[Fatal] MEDIA_STORAGE=cloud but the following R2 variables are not set: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!R2_PUBLIC_BASE_URL) {
    console.warn('[Warning] R2_PUBLIC_BASE_URL is not set. Legacy public track URLs will not work.');
  }
}

// ── Storage durability ────────────────────────────────────────────────────────
export const EPHEMERAL_STORAGE =
  String(process.env.EPHEMERAL_STORAGE || 'false').trim().toLowerCase() === 'true';

export const DATA_IS_DURABLE = DATA_PROVIDER === 'sql' && DB_IS_REMOTE;

export const MEDIA_IS_DURABLE = USE_CLOUD_MEDIA;

export const DATA_WRITES_PERSIST = !EPHEMERAL_STORAGE || DATA_IS_DURABLE;

export const MEDIA_WRITES_PERSIST = !EPHEMERAL_STORAGE || MEDIA_IS_DURABLE;

if (EPHEMERAL_STORAGE && (!DATA_WRITES_PERSIST || !MEDIA_WRITES_PERSIST)) {
  const volatileParts = [
    !DATA_IS_DURABLE && (
      DATA_PROVIDER === 'json'
        ? 'DATA_PROVIDER=json stores metadata in files on local disk'
        : 'DATA_PROVIDER=sql points at a local file database'
    ),
    !MEDIA_IS_DURABLE && 'MEDIA_STORAGE=local keeps audio and artwork on local disk',
  ].filter(Boolean);

  console.warn(
    '[Warn] EPHEMERAL_STORAGE=true declares that this host loses its filesystem, ' +
    'but the current configuration writes data there:'
  );
  for (const reason of volatileParts) console.warn(`  - ${reason}`);

  console.warn('  The radio will run. These features are disabled, because their results would be lost:');
  if (!DATA_WRITES_PERSIST) {
    console.warn('  - editing settings (they stay visible, read-only)');
    console.warn('  - helper admins, the admin account editor, and the audit log');
  }
  if (!MEDIA_WRITES_PERSIST || !DATA_WRITES_PERSIST) {
    console.warn('  - uploading and editing tracks, jingles, background music, phrases and artwork');
  }
  console.warn('  Statistics, the song queue and the day/night switch keep working.');
  console.warn(
    '  For the full panel use DATA_PROVIDER=sql with a remote TURSO_DATABASE_URL and ' +
    'MEDIA_STORAGE=cloud, or unset EPHEMERAL_STORAGE if the disk is in fact persistent.'
  );
}

// ── Donations ────────────────────────────────────────────────────────────────
export const DONATIONS_ENABLED = String(process.env.DONATIONS_ENABLED || 'false').trim().toLowerCase() === 'true';

export const DONATIONS_PROVIDER = normalizeDonationsProvider(process.env.DONATIONS_PROVIDER);

if (DONATIONS_ENABLED && !DONATIONS_PROVIDER) {
  console.warn(
    `[Warn] DONATIONS_ENABLED=true but DONATIONS_PROVIDER is not one of ${DONATIONS_PROVIDER_IDS.join(', ')} - donations stay disabled.`
  );
}

export const LIQPAY_PUBLIC_KEY  = (process.env.LIQPAY_PUBLIC_KEY  || '').trim();
export const LIQPAY_PRIVATE_KEY = (process.env.LIQPAY_PRIVATE_KEY || '').trim();

export const STRIPE_SECRET_KEY     = (process.env.STRIPE_SECRET_KEY     || '').trim();
export const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

// Donatello and Ko-fi have no "create a payment" API - the donor pays on the
// creator's own fixed page and types a match code in their comment, which the
// server reconciles back to a pending donation (poll for Donatello, webhook for Ko-fi).
export const DONATELLO_API_TOKEN     = (process.env.DONATELLO_API_TOKEN     || '').trim();
export const DONATELLO_PAGE_URL      = (process.env.DONATELLO_PAGE_URL      || '').trim();
export const DONATELLO_POLL_INTERVAL_S = Math.max(10, Number(process.env.DONATELLO_POLL_INTERVAL_S) || 30);

export const KOFI_VERIFICATION_TOKEN = (process.env.KOFI_VERIFICATION_TOKEN || '').trim();
export const KOFI_PAGE_URL           = (process.env.KOFI_PAGE_URL           || '').trim();

export const PUBLIC_SERVER_URL = (process.env.PUBLIC_SERVER_URL || '').trim().replace(/\/+$/, '');

export const DONATION_RETENTION_DAYS = Math.min(3650, Math.max(7, Number(process.env.DONATION_RETENTION_DAYS) || 365));

export const DONATION_MATCH_EXPIRY_MIN = Math.min(60, Math.max(3, Number(process.env.DONATION_MATCH_EXPIRY_MIN) || 15));