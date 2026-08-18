import { DONATELLO_POLL_INTERVAL_S, DONATION_MATCH_EXPIRY_MIN } from '../config/env.js';
import { getActiveDonationProvider } from './donationRegistry.js';
import { reconcileDonationPaid } from './reconcile.js';

let lastPollOk = null; // null = not confirmed yet, then true/false

async function pollOnce({ io, radioEngine, dataProvider }) {
  const provider = getActiveDonationProvider();
  if (!provider || typeof provider.pollRecentDonations !== 'function') return;

  const sinceMs = Date.now() - DONATION_MATCH_EXPIRY_MIN * 60 * 1000;

  let events;
  try {
    events = await provider.pollRecentDonations(sinceMs);
  } catch (err) {
    console.error(`[Donations] ${provider.id} poll failed:`, err.message);
    lastPollOk = false;
    return;
  }

  if (lastPollOk !== true) {
    console.log(`[Donations] ${provider.id} connected successfully.`);
    lastPollOk = true;
  }

  for (const event of events) {
    const donation = await dataProvider.findDonationByMatchCode(event.matchCode);
    if (!donation) continue;
    if (donation.currency !== event.currency || event.amount < donation.amount) continue;
    if (donation.expiresAt && event.paidAt > donation.expiresAt) continue;

    await reconcileDonationPaid({
      io, radioEngine, dataProvider, donation,
      providerRef: event.providerRef, paidAt: event.paidAt,
    }).catch((err) => console.error('[Donations] reconcile failed:', err.message));
  }
}

// ── Self-rescheduling loop: never overlaps, unlike a plain setInterval ─────
function loop(deps) {
  pollOnce(deps)
    .catch((err) => console.error('[Donations] poll tick failed:', err.message))
    .finally(() => setTimeout(() => loop(deps), DONATELLO_POLL_INTERVAL_S * 1000));
}

export function startDonationPolling(deps) {
  setTimeout(() => loop(deps), DONATELLO_POLL_INTERVAL_S * 1000);
}

export function startDonationExpirySweep({ dataProvider }) {
  const sweep = () => {
    dataProvider.expirePendingDonationMatches(Date.now())
      .catch((err) => console.error('[Donations] expiry sweep failed:', err.message))
      .finally(() => setTimeout(sweep, 60_000));
  };
  setTimeout(sweep, 60_000);
}
