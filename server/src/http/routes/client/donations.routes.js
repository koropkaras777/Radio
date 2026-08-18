import { Router } from 'express';
import { RADIO_HOSTS_MODE, DONATION_MATCH_EXPIRY_MIN } from '../../../config/env.js';
import { ipToUid } from '../../../socket/shared/ioHelpers.js';
import { getActiveDonationProvider } from '../../../donations/donationRegistry.js';
import { computeTierPrices } from '../../../donations/pricing.js';
import { generateMatchCode } from '../../../donations/matching.js';
import { t, tError } from '../../../i18n/index.js';
import { radioStream } from '../../../stream/radioStream.js';

const requestIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';

const isChattingBlocked = (settings) =>
  RADIO_HOSTS_MODE && Boolean(radioStream?.isQueuePaused) && settings.blockDonationsWhileChatting;

export function createDonationsRouter({ radioEngine, dataProvider }) {
  const router = Router();

  // ── GET /donations/tiers?songId= ────────────────────────────────────────
  router.get('/donations/tiers', async (req, res) => {
    try {
      const provider = getActiveDonationProvider();
      if (!provider) return res.status(400).json({ error: t('queue.donationsDisabled') });

      const songId = String(req.query.songId || '');
      if (!songId || !radioEngine.fullLibraryMetadata.has(songId)) {
        return res.status(404).json({ error: tError('SONG_NOT_FOUND') });
      }
      if (radioEngine.isSongCurrentOrNext(songId)) {
        return res.status(409).json({ error: t('radio.currentlyPlaying') });
      }

      const settings = await dataProvider.loadDonationSettings();
      const duration = radioEngine.getTrackMetadata(songId).duration;
      const tiers = computeTierPrices(settings, duration, provider);

      res.json({
        currency: settings.currency,
        pricingMode: settings.pricingMode,
        tiersEnabled: settings.tiersEnabled,
        tiers,
        flowType: provider.flowType,
        chattingBlocked: isChattingBlocked(settings),
      });
    } catch (err) {
      console.error('[Donations] tiers error:', err);
      res.status(500).json({ error: tError('DONATIONS_TIERS_FAILED') });
    }
  });

  // ── POST /donations/create { songId, tier } ─────────────────────────────
  router.post('/donations/create', async (req, res) => {
    try {
      const provider = getActiveDonationProvider();
      if (!provider) return res.status(400).json({ error: t('queue.donationsDisabled') });

      const songId = String(req.body?.songId || '');
      if (!songId || !radioEngine.fullLibraryMetadata.has(songId)) {
        return res.status(404).json({ error: tError('SONG_NOT_FOUND') });
      }
      if (radioEngine.isSongCurrentOrNext(songId)) {
        return res.status(409).json({ error: t('radio.currentlyPlaying') });
      }

      const settings = await dataProvider.loadDonationSettings();
      if (isChattingBlocked(settings)) {
        return res.status(409).json({ error: t('queue.donationsPausedChatting') });
      }

      const meta = radioEngine.getTrackMetadata(songId);
      const tiers = computeTierPrices(settings, meta.duration, provider);
      const requestedTier = settings.tiersEnabled ? Number(req.body?.tier) || 1 : 1;
      const selected = tiers.find((entry) => entry.tier === requestedTier);
      if (!selected) {
        return res.status(400).json({ error: t('queue.donationTierUnavailable') });
      }

      const isMatching = provider.flowType === 'matching';
      const matchCode  = isMatching ? generateMatchCode() : null;
      const expiresAt  = isMatching ? Date.now() + DONATION_MATCH_EXPIRY_MIN * 60 * 1000 : null;

      const uid = ipToUid(requestIp(req));
      const donation = await dataProvider.createDonation({
        uid,
        songId,
        songTitle: meta.title,
        songArtist: meta.artist,
        provider: provider.id,
        currency: settings.currency,
        amount: selected.price,
        tier: settings.tiersEnabled ? selected.tier : null,
        createdAt: Date.now(),
        matchCode,
        expiresAt,
      });

      if (isMatching) {
        const { pageUrl } = await provider.createPayment({ donationId: donation.id });
        return res.json({
          donationId: donation.id, flowType: 'matching', pageUrl, matchCode,
          amount: selected.price, currency: settings.currency, expiresAt,
        });
      }

      const origin    = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      const returnUrl = `${origin}?donation=${donation.id}`;
      const { redirectUrl, providerRef } = await provider.createPayment({
        donationId: donation.id,
        amount: selected.price,
        currency: settings.currency,
        description: `${meta.artist} - ${meta.title}`,
        returnUrl,
      });

      if (providerRef) {
        await dataProvider.markDonationStatus(donation.id, 'pending', { providerRef });
      }

      res.json({ donationId: donation.id, flowType: 'checkout', redirectUrl });
    } catch (err) {
      console.error('[Donations] create error:', err);
      res.status(500).json({ error: tError('DONATIONS_CREATE_FAILED') });
    }
  });

  // ── GET /donations/:id/status ────────────────────────────────────────────
  router.get('/donations/:id/status', async (req, res) => {
    try {
      const donation = await dataProvider.findDonationById(req.params.id);
      if (!donation || donation.uid !== ipToUid(requestIp(req))) {
        return res.status(404).json({ error: t('queue.donationNotFound') });
      }
      res.json({ status: donation.status, tier: donation.tier, matchCode: donation.matchCode, expiresAt: donation.expiresAt });
    } catch (err) {
      console.error('[Donations] status error:', err);
      res.status(500).json({ error: tError('DONATIONS_STATUS_FAILED') });
    }
  });

  return router;
}
