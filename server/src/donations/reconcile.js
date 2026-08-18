import { auditLogger, AUDIT_TYPES } from '../audit/auditLogger.js';
import { radioStream } from '../stream/radioStream.js';
import { broadcastSync } from '../socket/shared/ioHelpers.js';

const COOLDOWN_RETRY_INTERVAL_MS = 2000;
const COOLDOWN_RETRY_DEADLINE_MS = 40_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function insertDonatedSong(radioEngine, songData) {
  const deadline = Date.now() + COOLDOWN_RETRY_DEADLINE_MS;
  for (;;) {
    try {
      radioEngine.injectTrack(songData);
      return;
    } catch (err) {
      if (err.code !== 'radio.waitSeconds' || Date.now() >= deadline) throw err;
      await sleep(COOLDOWN_RETRY_INTERVAL_MS);
    }
  }
}

export const notifyDonor = (io, uid, payload) => {
  for (const [, socket] of io.sockets.sockets) {
    if (socket.data.listenerUid === uid) socket.emit('donation_result', payload);
  }
};

// ── Payment confirmed: insert the song, or flag for manual follow-up ───────
export async function reconcileDonationPaid({ io, radioEngine, dataProvider, donation, providerRef, paidAt }) {
  const claimed = await dataProvider.markDonationStatus(donation.id, 'paid', { providerRef, paidAt, expectedStatus: 'pending' });
  if (!claimed) return; // already reconciled (or expired) by a concurrent webhook/poll tick

  try {
    await insertDonatedSong(radioEngine, { id: donation.songId, orderType: 'donated', tier: donation.tier });

    if (radioStream?.isQueuePaused) radioStream.resumeQueue();

    broadcastSync(io, radioEngine, radioStream);
    auditLogger.log({
      adminId: 'donation',
      adminLogin: donation.uid,
      operationType: AUDIT_TYPES.DONATION_QUEUE_ADD,
      data: { title: donation.songTitle, artist: donation.songArtist, amount: donation.amount, currency: donation.currency },
    }).catch(() => {});
    notifyDonor(io, donation.uid, {
      donationId: donation.id, accepted: true, tier: donation.tier,
      song: { title: donation.songTitle, artist: donation.songArtist },
    });
  } catch (err) {
    console.error('[Donations] insert failed after payment:', err.message);
    await dataProvider.markDonationStatus(donation.id, 'paid_unqueued');
    auditLogger.log({
      adminId: 'donation',
      adminLogin: donation.uid,
      operationType: AUDIT_TYPES.DONATION_INSERT_FAILED,
      data: { title: donation.songTitle, artist: donation.songArtist },
    }).catch(() => {});
    notifyDonor(io, donation.uid, { donationId: donation.id, accepted: false, reason: 'no_slot' });
  }
}

export async function rejectDonation({ io, dataProvider, donation, reason }) {
  await dataProvider.markDonationStatus(donation.id, 'failed');
  notifyDonor(io, donation.uid, { donationId: donation.id, accepted: false, reason });
}
