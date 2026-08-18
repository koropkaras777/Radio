import { session, suggestState, socketHasPrivilege } from '../session/session.js';
import { PRIVILEGES } from '../config/privileges.js';

export const SUGGEST_COOLDOWN_MS = 5 * 60 * 1000;
export const SUGGEST_EXPIRE_MS   = 5 * 60 * 1000;

// ── Emit suggestions list to every active admin with QUEUE_MANAGE ─────────────
export function emitSuggestionsToAdmins(io) {
  const list = [];
  suggestState.pending.forEach((item, uid) => {
    list.push({ uid, song: item.song, addedAt: item.addedAt });
  });

  for (const [socketId] of session.activeAdminSockets.entries()) {
    if (!socketHasPrivilege(socketId, PRIVILEGES.QUEUE_MANAGE)) continue;
    const sock = io.sockets.sockets.get(socketId);
    if (sock) sock.emit('suggestions_update', list);
  }
}

export const emitSuggestionsToAdmin = emitSuggestionsToAdmins;

export function broadcastCooldownToUid(io, uid) {
  const lastSuggest = suggestState.cooldowns.get(uid) || 0;
  const secsLeft    = Math.max(0, Math.ceil((SUGGEST_COOLDOWN_MS - (Date.now() - lastSuggest)) / 1000));
  io.sockets.sockets.forEach((s) => {
    if (s.data.listenerUid === uid) s.emit('suggest_cooldown_update', secsLeft);
  });
}

export function expireSuggestion(io, uid) {
  const item = suggestState.pending.get(uid);
  if (!item) return;
  clearTimeout(item.timerId);
  suggestState.pending.delete(uid);
  const listenerSocket = io.sockets.sockets.get(item.socketId);
  if (listenerSocket) {
    listenerSocket.emit('suggestion_result', { accepted: false, auto: true, song: item.song });
  }
  emitSuggestionsToAdmins(io);
  console.log(`[Suggest] Auto-expired: "${item.song.title}" from UID ${uid}`);
}