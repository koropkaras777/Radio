// ─── Defaults ───────────────────────────────────────────────────────────────
export const DEFAULT_DONATION_SETTINGS = {
  currency: '',
  pricingMode: 'fixed',
  fixedPrice: 1,
  pricePerSecond: 0.02,
  tiersEnabled: false,
  tierCeiling: 5,
  blockDonationsWhileChatting: false,
};

const MIN_TIER_CEILING = 2;
const MAX_TIER_CEILING = 10;

// ─── Sanitize ───────────────────────────────────────────────────────────────
export function sanitizeDonationSettings(input, fallback = DEFAULT_DONATION_SETTINGS) {
  const source = input && typeof input === 'object' ? input : {};

  const pricingMode = source.pricingMode === 'calculated' ? 'calculated' : 'fixed';

  const fixedPrice = Number(source.fixedPrice);
  const pricePerSecond = Number(source.pricePerSecond);

  const tierCeiling = Math.min(MAX_TIER_CEILING, Math.max(MIN_TIER_CEILING,
    Math.round(Number(source.tierCeiling)) || fallback.tierCeiling || DEFAULT_DONATION_SETTINGS.tierCeiling));

  return {
    currency: String(source.currency || fallback.currency || '').trim().toUpperCase().slice(0, 3),
    pricingMode,
    fixedPrice: Number.isFinite(fixedPrice) && fixedPrice > 0 ? fixedPrice : (fallback.fixedPrice ?? DEFAULT_DONATION_SETTINGS.fixedPrice),
    pricePerSecond: Number.isFinite(pricePerSecond) && pricePerSecond > 0 ? pricePerSecond : (fallback.pricePerSecond ?? DEFAULT_DONATION_SETTINGS.pricePerSecond),
    tiersEnabled: Boolean(source.tiersEnabled),
    tierCeiling,
    blockDonationsWhileChatting: Boolean(source.blockDonationsWhileChatting),
  };
}
