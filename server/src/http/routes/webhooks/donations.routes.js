import { raw } from 'express';
import { getDonationProviderById } from '../../../donations/donationRegistry.js';
import { reconcileDonationPaid, rejectDonation } from '../../../donations/reconcile.js';

async function handleCheckoutWebhook(req, res, provider, { io, radioEngine, dataProvider }) {
  let result;
  try {
    result = provider.verifyWebhook(req.body, req.headers);
  } catch (err) {
    console.error('[Donations] webhook verify error:', err.message);
    return res.status(400).end();
  }

  if (!result?.valid) return res.status(result?.ignored ? 200 : 400).end();

  const donation = await dataProvider.findDonationById(result.donationId);
  if (!donation || donation.status !== 'pending') return res.status(200).end();

  if (result.status !== 'paid') {
    await rejectDonation({ io, dataProvider, donation, reason: 'payment_failed' });
    return res.status(200).end();
  }

  await reconcileDonationPaid({ io, radioEngine, dataProvider, donation, providerRef: result.providerRef, paidAt: Date.now() });
  res.status(200).end();
}

// ── Matching-flow providers (Donatello/Ko-fi): reconcile a webhook-delivered
// event against a pending donation by match code + amount, not a direct ID ──
async function handleMatchingWebhook(req, res, provider, { io, radioEngine, dataProvider }) {
  if (typeof provider.parseWebhookEvent !== 'function') return res.status(404).end();

  let result;
  try {
    result = provider.parseWebhookEvent(req.body, req.headers);
  } catch (err) {
    console.error('[Donations] webhook parse error:', err.message);
    return res.status(400).end();
  }

  if (!result?.valid) return res.status(result?.ignored ? 200 : 400).end();

  const { event } = result;
  const donation = await dataProvider.findDonationByMatchCode(event.matchCode);
  if (!donation) return res.status(200).end();
  if (donation.currency !== event.currency || event.amount < donation.amount) return res.status(200).end();
  if (donation.expiresAt && Date.now() > donation.expiresAt) return res.status(200).end();

  await reconcileDonationPaid({ io, radioEngine, dataProvider, donation, providerRef: event.providerRef, paidAt: event.paidAt });
  res.status(200).end();
}

export function attachDonationsWebhookRoutes(router, deps) {
  router.post('/webhooks/donations/:provider', raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
    const provider = getDonationProviderById(req.params.provider);
    if (!provider?.isConfigured()) return res.status(404).end();

    try {
      if (provider.flowType === 'matching') {
        await handleMatchingWebhook(req, res, provider, deps);
      } else {
        await handleCheckoutWebhook(req, res, provider, deps);
      }
    } catch (err) {
      console.error('[Donations] webhook processing error:', err);
      res.status(200).end();
    }
  });
}
