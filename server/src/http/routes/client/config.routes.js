import { Router } from 'express';
import { DATA_PROVIDER, NIGHT_MODE, STREAM_MODE, RADIO_HOSTS_MODE, TIME_ZONE, DONATION_RETENTION_DAYS } from '../../../config/env.js';
import { ALL_PRIVILEGES } from '../../../config/privileges.js';
import { describeCapabilities } from '../shared/capabilities.js';
import { getActiveDonationProvider } from '../../../donations/donationRegistry.js';

export function createConfigRouter({ mediaProvider, dataProvider }) {
  const router = Router();

  // ── Public runtime config ─────────────────────────────────────────────────
  router.get('/public/config', async (req, res) => {
    const donationProvider = getActiveDonationProvider();
    const donationInfo = donationProvider ? {
      provider: donationProvider.id,
      displayName: donationProvider.displayName,
      ...(await dataProvider.loadDonationSettings().catch(() => null)),
      donationRetentionDays: DONATION_RETENTION_DAYS,
    } : null;

    res.json({
      dataProvider:   DATA_PROVIDER || 'json',
      musicSource:    mediaProvider.isCloud ? 'cloud' : 'local',
      nightMode:      NIGHT_MODE,
      streamMode:     STREAM_MODE,
      radioHostsMode: RADIO_HOSTS_MODE,
      allPrivileges:  ALL_PRIVILEGES,
      timeZone:       TIME_ZONE,
      capabilities:   describeCapabilities(mediaProvider, dataProvider),
      donationInfo,
    });
  });

  return router;
}
