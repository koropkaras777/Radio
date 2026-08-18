const round2 = (value) => Math.round(value * 100) / 100;

export function computeBasePrice(settings, durationSeconds) {
  if (settings.pricingMode === 'calculated') {
    return round2(settings.pricePerSecond * Math.max(1, durationSeconds));
  }
  return round2(settings.fixedPrice);
}

export function computeTierPrices(settings, durationSeconds, provider) {
  const basePrice = computeBasePrice(settings, durationSeconds);
  const maxAmount = provider?.maxAmountByCurrency?.[settings.currency] ?? Infinity;

  if (!settings.tiersEnabled) {
    return basePrice <= maxAmount ? [{ tier: 1, price: basePrice }] : [];
  }

  const tiers = [];
  for (let tier = 1; tier <= settings.tierCeiling; tier++) {
    const price = round2(basePrice * 2 ** (tier - 1));
    if (price > maxAmount) break;
    tiers.push({ tier, price });
  }
  return tiers;
}
