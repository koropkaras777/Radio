import { SUPER_ADMIN_LOGIN } from '../../../config/env.js';
import { Router } from 'express';
import { requireAdmin, getErrorPayload } from '../../../middleware/auth.js';
import { auditLogger, AUDIT_TYPES } from '../../../audit/auditLogger.js';
import { PRIVILEGES } from '../../../config/privileges.js';
import { t, LOCALES } from '../../../i18n/index.js';
import { requireCapability } from '../shared/capabilities.js';

// ── Branding settings validation ────────────────────────────────────────────
const normalizeSingleLineText = (value = '') =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

const validateLengthField = ({ value, min, max, fieldUa, fieldEn, allowEmpty = false }) => {
  const normalized = normalizeSingleLineText(value);
  const field = { uk: fieldUa, en: fieldEn };
  if (!normalized) {
    if (allowEmpty) return normalized;
    throw Object.assign(new Error(`${fieldEn} is required`), {
      localized: t('validation.fieldRequired', { field }),
    });
  }
  if (normalized.length < min) {
    throw Object.assign(new Error(`${fieldEn} is too short`), {
      localized: t('validation.fieldTooShort', { field, min }),
    });
  }
  if (normalized.length > max) {
    throw Object.assign(new Error(`${fieldEn} is too long`), {
      localized: t('validation.fieldTooLong', { field, max }),
    });
  }
  return normalized;
};

const PER_LANG_BRANDING_FIELDS = [
  { key: 'dayRadioName',   fieldUa: (locale) => `Назва денного радіо (${locale.toUpperCase()})`,  fieldEn: (locale) => `Day radio name (${locale.toUpperCase()})` },
  { key: 'nightRadioName', fieldUa: (locale) => `Назва нічного радіо (${locale.toUpperCase()})`, fieldEn: (locale) => `Night radio name (${locale.toUpperCase()})` },
  { key: 'telegramLabel',  fieldUa: (locale) => `Підпис Telegram (${locale.toUpperCase()})`,      fieldEn: (locale) => `Telegram label (${locale.toUpperCase()})` },
];

const validateBrandingSettingsPayload = (payload = {}, locales = LOCALES) => {
  const source = payload.branding && typeof payload.branding === 'object' ? payload.branding : payload;

  const telegram_url = validateLengthField({
    value: source.telegram_url,
    fieldUa: 'Telegram URL',
    fieldEn: 'Telegram URL',
    min: 2,
    max: 50,
  });

  const sourceByLang = source.byLang && typeof source.byLang === 'object' ? source.byLang : {};

  const byLang = {};
  for (const locale of locales) {
    const entry = sourceByLang[locale] || {};
    byLang[locale] = {};
    for (const { key, fieldUa, fieldEn } of PER_LANG_BRANDING_FIELDS) {
      byLang[locale][key] = validateLengthField({
        value: entry[key],
        fieldUa: fieldUa(locale),
        fieldEn: fieldEn(locale),
        min: 2,
        max: 25,
      });
    }
  }

  return { ...payload, branding: { telegram_url, byLang } };
};

// ── Per-section privileges ──────────────────────────────────────────────────
const SECTION_PRIVILEGES = {
  branding:   PRIVILEGES.SETTINGS_BRANDING,
  generation: PRIVILEGES.SETTINGS_ALGORITHM,
  radioHosts: PRIVILEGES.RADIO_MODERATOR,
  artistArts: PRIVILEGES.SETTINGS_ALGORITHM,
};

const hasPrivilege = (admin, privilege) =>
  Array.isArray(admin?.privileges) && admin.privileges.includes(privilege);

export function createSettingsRouter({ io, radioEngine, mediaProvider, dataProvider }) {
  const canEditSettings = requireCapability('editSettings', {
    mediaProvider,
    dataProvider: dataProvider || radioEngine.dataProvider,
  });

  const router = Router();

  // ── GET / — branding (get is unrestricted for panel init) ─────────────────
  router.get('/', requireAdmin, async (req, res) => {
    try {
      res.json(await radioEngine.loadSettings());
    } catch (err) {
      console.error('[Settings API] Load error:', err);
      res.status(500).json(getErrorPayload(err, 'queue.loadSettingsFailed'));
    }
  });

  // ── POST / — each changed section is gated by its own privilege ────────────
  router.post(
    '/',
    requireAdmin,
    canEditSettings,
    async (req, res) => {
      try {
        const validatedBody = validateBrandingSettingsPayload(req.body || {});

        const changed = radioEngine.getChangedSettingsSections(validatedBody);
        const denied  = changed.filter((section) => !hasPrivilege(req.admin, SECTION_PRIVILEGES[section]));
        if (denied.length) {
          return res.status(403).json({ error: t('auth.insufficientPrivilegesForAction') });
        }

        const payload = await radioEngine.updateSettings(validatedBody);
        io.emit('sync', radioEngine.getState());
        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.SETTINGS_SAVE,
          data:          { sections: changed },
        }).catch(() => {});
        res.json(payload);
      } catch (err) {
        console.error('[Settings API] Save error:', err);
        res.status(400).json(getErrorPayload(err, 'queue.changesDidNotTakeEffect'));
      }
    },
  );

  return router;
}