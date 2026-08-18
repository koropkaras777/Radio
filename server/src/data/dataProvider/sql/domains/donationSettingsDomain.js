import { ensureTables } from '../shared/schema.js';
import { DEFAULT_DONATION_SETTINGS, sanitizeDonationSettings } from '../../../../donations/donationSettingsSchema.js';

export class DonationSettingsDomain {
  #db;

  constructor(db) {
    this.#db = db;
  }

  #rowToSettings(row) {
    if (!row) return sanitizeDonationSettings(null, DEFAULT_DONATION_SETTINGS);
    return sanitizeDonationSettings({
      currency: row.currency,
      pricingMode: row.pricing_mode,
      fixedPrice: row.fixed_price,
      pricePerSecond: row.price_per_second,
      tiersEnabled: Boolean(row.tiers_enabled),
      tierCeiling: row.tier_ceiling,
      blockDonationsWhileChatting: Boolean(row.block_donations_while_chatting),
    }, DEFAULT_DONATION_SETTINGS);
  }

  async loadDonationSettings() {
    await ensureTables(this.#db, 'donation_settings');

    const result = await this.#db.execute(`
      SELECT currency, pricing_mode, fixed_price, price_per_second,
             tiers_enabled, tier_ceiling, block_donations_while_chatting
      FROM donation_settings
      WHERE id = 1
    `);

    return this.#rowToSettings(result.rows?.[0]);
  }

  async saveDonationSettings(settings) {
    await ensureTables(this.#db, 'donation_settings');

    const current   = await this.loadDonationSettings();
    const sanitized = sanitizeDonationSettings(settings, current);

    await this.#db.execute({
      sql: `
        INSERT INTO donation_settings (
          id, currency, pricing_mode, fixed_price, price_per_second,
          tiers_enabled, tier_ceiling, block_donations_while_chatting
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          currency = excluded.currency,
          pricing_mode = excluded.pricing_mode,
          fixed_price = excluded.fixed_price,
          price_per_second = excluded.price_per_second,
          tiers_enabled = excluded.tiers_enabled,
          tier_ceiling = excluded.tier_ceiling,
          block_donations_while_chatting = excluded.block_donations_while_chatting
      `,
      args: [
        sanitized.currency,
        sanitized.pricingMode,
        sanitized.fixedPrice,
        sanitized.pricePerSecond,
        sanitized.tiersEnabled ? 1 : 0,
        sanitized.tierCeiling,
        sanitized.blockDonationsWhileChatting ? 1 : 0,
      ],
    });

    return sanitized;
  }
}
