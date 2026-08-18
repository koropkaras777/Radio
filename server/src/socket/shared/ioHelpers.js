import { createHash } from 'node:crypto';
import { STREAM_MODE } from '../../config/env.js';
import { PUBLIC_OLIGARCHS, localizeAdminHelperName } from '../../config/oligarchs.js';
import { session, anyAdminHasPrivilege } from '../../session/session.js';
import { PRIVILEGES } from '../../config/privileges.js';

// ── Identity helpers ──────────────────────────────────────────────────────
export const ipToUid = (ip) =>
  createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 36);

export const getSocketIp = (socket) =>
  socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim()
  || socket.handshake.address
  || 'unknown';

// ── Broadcast helpers ─────────────────────────────────────────────────────
export const broadcastAdminOnline = (io) => {
  io.emit('admin_online', anyAdminHasPrivilege(PRIVILEGES.QUEUE_MANAGE));
};

export const emitUsersUpdate = (io) => {
  io.emit('usersUpdate', Object.values(session.activeUsers));
};

export const purgeStaleUsers = (io) => {
  for (const sid of Object.keys(session.activeUsers)) {
    if (!io.sockets.sockets.has(sid)) {
      delete session.activeUsers[sid];
      session.activeAdminSockets.delete(sid);
    }
  }
};

export const broadcastSync = (io, radioEngine, radioStream) => {
  const emitNow = () => {
    console.log(`[Sync] Broadcasting state - track: ${radioEngine.getState()?.track}`);
    io.emit('sync', radioEngine.getState());
  };
  if (STREAM_MODE && radioStream?.isTransitioning) {
    console.log('[Sync] Deferred - waiting for trackStarted');
    radioStream.once('trackStarted', emitNow);
  } else {
    console.log('[Sync] Emitting immediately (not transitioning)');
    emitNow();
  }
};

// ── Avatar assignment ─────────────────────────────────────────────────────
export const pickHelperOligarch = () => {
  const usedKeys = new Set(
    Object.values(session.activeUsers)
      .filter((u) => u.oligarchKey)
      .map((u) => u.oligarchKey)
  );
  const pool = PUBLIC_OLIGARCHS.filter((o) => !usedKeys.has(o.key));
  const chosen = (pool.length ? pool : PUBLIC_OLIGARCHS)[Math.floor(Math.random() * (pool.length || PUBLIC_OLIGARCHS.length))];
  return {
    oligarchKey: chosen.key,
    name: localizeAdminHelperName(chosen),
    img: chosen.img,
  };
};