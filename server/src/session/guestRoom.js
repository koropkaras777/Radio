import { PRIVILEGES } from '../config/privileges.js';
import { session, canGoLive, isHostRoomEmpty } from './session.js';
import { getActiveGuestCode } from '../tokens/guestHostToken.js';

export const GUEST_REQUEST_COOLDOWN_MS = 10 * 60_000; // 10 min
export const GUEST_REQUEST_EXPIRE_MS   = 60_000;      // 1 min

export const guestRoomState = {
  /** @type {Map<string, { nickname: string, socketId: string, timerId: NodeJS.Timeout, addedAt: number }>} */
  pending:   new Map(),
  /** @type {Map<string, number>} uid -> timestamp of last request/rejection/expiry */
  cooldowns: new Map(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const buildQueueSnapshot = () =>
  [...guestRoomState.pending.entries()].map(([uid, item]) => ({
    uid,
    nickname: item.nickname,
    addedAt:  item.addedAt,
  }));

export const emitGuestQueueToAdmins = (io) => {
  const snapshot = buildQueueSnapshot();
  for (const [socketId, entry] of session.activeAdminSockets) {
    if (!Array.isArray(entry.privileges) || !entry.privileges.includes(PRIVILEGES.RADIO_HOST)) continue;
    io.sockets.sockets.get(socketId)?.emit('guest_queue_update', snapshot);
  }
};

export const broadcastRadioHostsOnline = (io) => {
  io.emit('radio_hosts_online', !isHostRoomEmpty());
};

/**
 * @returns {{ ok: true } | { error: 'special_guest_active'|'no_admin'|'cooldown'|'room_full', secsLeft?: number }}
 */
export const canSubmitGuestRequest = (uid) => {
  if (getActiveGuestCode()) return { error: 'special_guest_active' };
  if (isHostRoomEmpty())     return { error: 'no_admin' };
  if (guestRoomState.pending.has(uid)) return { ok: true };

  const lastAt  = guestRoomState.cooldowns.get(uid) || 0;
  const elapsed = Date.now() - lastAt;
  if (elapsed < GUEST_REQUEST_COOLDOWN_MS) {
    return { error: 'cooldown', secsLeft: Math.ceil((GUEST_REQUEST_COOLDOWN_MS - elapsed) / 1000) };
  }
  if (!canGoLive('guest')) return { error: 'room_full' };
  return { ok: true };
};

export const expireGuestRequest = (io, uid) => {
  const item = guestRoomState.pending.get(uid);
  if (!item) return;
  guestRoomState.pending.delete(uid);
  guestRoomState.cooldowns.set(uid, Date.now());
  io.sockets.sockets.get(item.socketId)?.emit('guest_request_result', { accepted: false, auto: true });
  emitGuestQueueToAdmins(io);
};

/**
 * @returns {object|null} the removed item, or null
 */
export const removeGuestRequest = (uid, { setCooldown = false } = {}) => {
  const item = guestRoomState.pending.get(uid);
  if (!item) return null;
  clearTimeout(item.timerId);
  guestRoomState.pending.delete(uid);
  if (setCooldown) guestRoomState.cooldowns.set(uid, Date.now());
  return item;
};

export const rejectAllPendingGuestRequests = (io, reason) => {
  for (const uid of [...guestRoomState.pending.keys()]) {
    const item = removeGuestRequest(uid, { setCooldown: false });
    if (!item) continue;
    io.sockets.sockets.get(item.socketId)?.emit('guest_request_result', { accepted: false, auto: false, reason });
  }
  emitGuestQueueToAdmins(io);
};