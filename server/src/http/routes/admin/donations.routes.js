import { Router } from 'express';
import { requireAdmin, requirePrivilege, getErrorPayload } from '../../../middleware/auth.js';
import { PRIVILEGES } from '../../../config/privileges.js';
import { RADIO_HOSTS_MODE, DONATION_RETENTION_DAYS, SUPER_ADMIN_LOGIN } from '../../../config/env.js';
import { getActiveDonationProvider } from '../../../donations/donationRegistry.js';
import { sanitizeDonationSettings } from '../../../donations/donationSettingsSchema.js';
import { computeBasePrice } from '../../../donations/pricing.js';
import { auditLogger, AUDIT_TYPES } from '../../../audit/auditLogger.js';

const WINDOWS_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  max:   DONATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
};

const longestTrackDurationS = (radioEngine) => {
  let max = 0;
  for (const meta of radioEngine.fullLibraryMetadata.values()) {
    if (meta?.duration > max) max = meta.duration;
  }
  return max;
};

// ── Lower tierCeiling until its worst-case price fits the provider's max ────
const clampCeilingToProviderMax = (settings, worstCaseBasePrice, provider) => {
  const maxAmount = provider?.maxAmountByCurrency?.[settings.currency] ?? Infinity;
  let ceiling = settings.tierCeiling;
  while (ceiling > 2 && worstCaseBasePrice * 2 ** (ceiling - 1) > maxAmount) ceiling--;
  return ceiling;
};

export function createDonationsAdminRouter({ radioEngine, dataProvider }) {
  const router = Router();
  const canManage = requirePrivilege(PRIVILEGES.DONATIONS_MANAGE);

  // ── GET /settings ────────────────────────────────────────────────────────
  router.get('/settings', requireAdmin, async (req, res) => {
    try {
      const settings = await dataProvider.loadDonationSettings();
      const provider = getActiveDonationProvider();
      const historyCurrencies = await dataProvider.listDonationCurrencies();
      res.json({
        settings,
        radioHostsMode: RADIO_HOSTS_MODE,
        provider: provider ? {
          id: provider.id,
          displayName: provider.displayName,
          supportedCurrencies: provider.supportedCurrencies,
        } : null,
        historyCurrencies,
        donationRetentionDays: DONATION_RETENTION_DAYS,
      });
    } catch (err) {
      console.error('[Donations] settings load error:', err);
      res.status(500).json(getErrorPayload(err, 'errors.DONATIONS_SETTINGS_LOAD_FAILED'));
    }
  });

  // ── POST /settings ───────────────────────────────────────────────────────
  router.post('/settings', requireAdmin, canManage, async (req, res) => {
    try {
      const provider = getActiveDonationProvider();
      const current  = await dataProvider.loadDonationSettings();
      let sanitized  = sanitizeDonationSettings(req.body, current);

      let clamped = false;
      if (sanitized.tiersEnabled && provider) {
        const worstCaseBase = sanitized.pricingMode === 'calculated'
          ? sanitized.pricePerSecond * Math.max(1, longestTrackDurationS(radioEngine))
          : sanitized.fixedPrice;

        const clampedCeiling = clampCeilingToProviderMax(sanitized, worstCaseBase, provider);
        if (clampedCeiling !== sanitized.tierCeiling) {
          sanitized = { ...sanitized, tierCeiling: clampedCeiling };
          clamped = true;
        }
      }

      const saved = await dataProvider.saveDonationSettings(sanitized);

      auditLogger.log({
        adminId:    req.admin.adminId || 'super',
        adminLogin: req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.SETTINGS_SAVE,
        data: { sections: ['donations'] },
      }).catch(() => {});

      res.json({ settings: saved, clamped });
    } catch (err) {
      console.error('[Donations] settings save error:', err);
      res.status(400).json(getErrorPayload(err, 'errors.DONATIONS_SETTINGS_SAVE_FAILED'));
    }
  });

  // ── GET /history ─────────────────────────────────────────────────────────
  router.get('/history', requireAdmin, canManage, async (req, res) => {
    try {
      const windowKey = String(req.query.window || 'max');
      const since  = Date.now() - (WINDOWS_MS[windowKey] ?? WINDOWS_MS.max);
      const limit  = Math.max(1, Number(req.query.limit)  || 30);
      const offset = Math.max(0,                Number(req.query.offset) || 0);

      const { entries, total } = await dataProvider.loadDonationHistory({ since, limit, offset });
      res.json({ entries, total, offset, limit });
    } catch (err) {
      console.error('[Donations] history load error:', err);
      res.status(500).json(getErrorPayload(err, 'errors.DONATIONS_HISTORY_FAILED'));
    }
  });

  // ── GET /price-preview?durationSeconds= ─────────────────────────────────
  router.get('/price-preview', requireAdmin, canManage, async (req, res) => {
    try {
      const settings = await dataProvider.loadDonationSettings();
      const duration = Number(req.query.durationSeconds) || longestTrackDurationS(radioEngine);
      res.json({ basePrice: computeBasePrice(settings, duration) });
    } catch (err) {
      console.error('[Donations] price preview error:', err);
      res.status(500).json(getErrorPayload(err, 'errors.DONATIONS_SETTINGS_LOAD_FAILED'));
    }
  });

  return router;
}
