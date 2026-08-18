import { DONATIONS_ENABLED, DONATIONS_PROVIDER } from '../config/env.js';
import { liqpayProvider } from './providers/liqpay.js';
import { stripeProvider } from './providers/stripe.js';
import { donatelloProvider } from './providers/donatello.js';
import { kofiProvider } from './providers/kofi.js';

const PROVIDERS = {
  liqpay: liqpayProvider,
  stripe: stripeProvider,
  donatello: donatelloProvider,
  kofi: kofiProvider,
};

let warned = false;

export function getActiveDonationProvider() {
  if (!DONATIONS_ENABLED || !DONATIONS_PROVIDER) return null;

  const provider = PROVIDERS[DONATIONS_PROVIDER];
  if (!provider?.isConfigured()) {
    if (!warned) {
      console.warn(`[Donations] Provider "${DONATIONS_PROVIDER}" is missing required secrets - donations stay disabled.`);
      warned = true;
    }
    return null;
  }

  return provider;
}

export function getDonationProviderById(id) {
  return PROVIDERS[id] || null;
}
