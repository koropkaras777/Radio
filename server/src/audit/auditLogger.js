import { LOG_RETENTION_DAYS, ADMIN_LOGIN } from '../config/env.js';

// ── Operation type constants ──────────────────────────────────────────────────
export const AUDIT_TYPES = {
  UPLOAD_SONG:           'upload_song',
  DELETE_SONG:           'delete_song',
  EDIT_SONG_LYRICS:      'edit_song_lyrics',
  EDIT_SONG_META:        'edit_song_meta',
  ARTIST_ART_UPLOAD:     'artist_art_upload',
  ARTIST_ART_DELETE:     'artist_art_delete',
  JINGLE_UPLOAD:         'jingle_upload',
  JINGLE_DELETE:         'jingle_delete',
  BACKGROUND_MUSIC_UPLOAD: 'background_music_upload',
  BACKGROUND_MUSIC_DELETE: 'background_music_delete',
  PHRASE_UPLOAD:         'phrase_upload',
  PHRASE_DELETE:         'phrase_delete',
  QUEUE_ADD:             'queue_add',
  QUEUE_REMOVE:          'queue_remove',
  QUEUE_SKIP:            'queue_skip',
  SUGGESTION_ACCEPT:     'suggestion_accept',
  SUGGESTION_REJECT:     'suggestion_reject',
  MODE_SWITCH:           'mode_switch',
  SETTINGS_SAVE:         'settings_save',
  GROUP_CREATE:          'group_create',
  GROUP_EDIT:            'group_edit',
  GROUP_DELETE:          'group_delete',
  GROUP_INSERT:          'group_insert',
  ADMIN_CREATE:          'admin_create',
  ADMIN_DELETE:          'admin_delete',
  ADMIN_PRIVILEGES:      'admin_privileges',
  ADMIN_ACTIVATE:        'admin_activate',
  ADMIN_LOGIN_CHANGE:    'admin_login_change',
  ADMIN_PASSWORD_CHANGE: 'admin_password_change',

  RADIO_HOST_LIVE_START: 'radio_host_live_start',
  RADIO_HOST_LIVE_END:   'radio_host_live_end',
  GUEST_CODE_GENERATE:   'guest_code_generate',
  GUEST_CODE_DEACTIVATE: 'guest_code_deactivate',
  GUEST_CODE_REGENERATE: 'guest_code_regenerate',
  GUEST_BAN:             'guest_ban',
  GUEST_UNBAN:           'guest_unban',
  GUEST_LIVE_START:          'guest_live_start',
  GUEST_LIVE_END:            'guest_live_end',
  SPECIAL_GUEST_LIVE_START:  'special_guest_live_start',
  SPECIAL_GUEST_LIVE_END:    'special_guest_live_end',
  GUEST_KICK:   'guest_kick',
  PARTICIPANT_KICK:   'participant_kick',

  DONATION_QUEUE_ADD:     'donation_queue_add',
  DONATION_INSERT_FAILED: 'donation_insert_failed',
};

// ── Constants ─────────────────────────────────────────────────────────────────
const LOG_TTL_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CACHE_MAX  = 10_000;

// ── AuditLogger ───────────────────────────────────────────────────────────────
class AuditLogger {
  #cache       = [];
  #loginCache  = new Map();
  #initialized = false;
  #io          = null;
  #provider    = null;

  // ── Inject Socket.IO ────────────────────────────────────────────────────────
  setIo(io) {
    this.#io = io;
  }

  // ── Init: load all entries from DB into cache on startup ───────────────────
  async init(dataProvider) {
    if (this.#initialized) return;

    this.#provider = dataProvider ?? null;

    if (!this.#provider?.audit) {
      console.warn('[AuditLog] The data provider has no audit storage - the log is disabled.');
      return;
    }

    this.#cache       = await this.#provider.audit.loadAuditLog();
    this.#initialized = true;

    try {
      for (const admin of await this.#provider.loadAdmins()) {
        this.#loginCache.set(String(admin.adminId), String(admin.login));
      }
    } catch { }

    if (ADMIN_LOGIN) {
      this.#loginCache.set('super', ADMIN_LOGIN);
    }

    this.#cache = this.#cache.map((e) => ({
      ...e,
      adminLogin: this.#loginCache.get(e.adminId) ?? e.adminId,
    }));

    console.log(`[AuditLog] Cache loaded: ${this.#cache.length} entries, ${this.#loginCache.size} admin logins`);
  }

  // ── Write a new audit entry ─────────────────────────────────────────────────
  async log({ adminId, adminLogin = null, operationType, data = {} }) {
    if (!this.#provider?.audit) return null;

    const now = Date.now();

    try {
      const stored = await this.#provider.audit.appendAuditEntry({
        adminId, operationType, data, createdAt: now,
      });

      const resolvedLogin = adminLogin ?? this.#loginCache.get(String(adminId)) ?? String(adminId);
      if (adminLogin) this.#loginCache.set(String(adminId), adminLogin);

      const entry = { ...stored, adminLogin: resolvedLogin };

      this.#cache.push(entry);
      if (this.#cache.length > CACHE_MAX) {
        this.#cache = this.#cache.slice(this.#cache.length - CACHE_MAX);
      }

      if (this.#io) {
        this.#io.emit('audit_new_entry', entry);
      }

      return entry;
    } catch (err) {
      console.error('[AuditLog] Failed to write entry:', err.message);
      return null;
    }
  }

  // ── Read from cache (no DB call) ────────────────────────────────────────────
  getCached({ since, limit = 30, offset = 0 }) {
    const sinceMs  = Number(since) || 0;
    const filtered = this.#cache
      .filter((e) => e.createdAt >= sinceMs)
      .reverse();

    const slice = filtered.slice(offset, offset + limit).map((e) => ({
      ...e,
      adminLogin: e.adminLogin ?? this.#loginCache.get(e.adminId) ?? e.adminId,
    }));

    return {
      entries: slice,
      total:   filtered.length,
    };
  }

  // ── Login cache management ──────────────────────────────────────────────────
  registerAdminLogin(adminId, login) {
    this.#loginCache.set(String(adminId), String(login));
  }

  removeAdminLogin(adminId) {
    this.#loginCache.delete(String(adminId));
  }

  // ── Status helpers ──────────────────────────────────────────────────────────
  isInitialized() { return this.#initialized; }

  cacheSize()     { return this.#cache.length; }

  // ── Purge old entries ───────────────────────────────────────────────────────
  async purgeOldEntries() {
    if (!this.#provider?.audit) return 0;

    const cutoff = Date.now() - LOG_TTL_MS;

    try {
      const count = await this.#provider.audit.purgeAuditEntries(cutoff);

      if (count > 0) {
        this.#cache = this.#cache.filter((e) => e.createdAt >= cutoff);
        console.log(`[AuditLog] Purged ${count} entries older than ${LOG_RETENTION_DAYS} days`);
      }

      return count;
    } catch (err) {
      console.error('[AuditLog] Purge failed:', err.message);
      return 0;
    }
  }

  // ── Force cache reload (e.g. after manual DB edits) ─────────────────────────
  async reload(dataProvider) {
    this.#initialized = false;
    this.#cache       = [];
    await this.init(dataProvider ?? this.#provider);
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const auditLogger = new AuditLogger();