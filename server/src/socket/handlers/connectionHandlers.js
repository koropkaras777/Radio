import { RADIO_HOSTS_MODE } from '../../config/env.js';
import { PUBLIC_OLIGARCHS, localizeOligarchName } from '../../config/oligarchs.js';
import { session, suggestState, isAdminSocket, isHostRoomEmpty } from '../../session/session.js';
import { getOrCreateArtToken, tokenTtlMs } from '../../tokens/artToken.js';
import { SUGGEST_COOLDOWN_MS } from '../../engine/suggestions.js';
import { guestRoomState, emitGuestQueueToAdmins, removeGuestRequest } from '../../session/guestRoom.js';
import {
  broadcastAdminOnline, emitUsersUpdate, purgeStaleUsers, ipToUid,
} from '../shared/ioHelpers.js';

export function registerConnectionHandlers(socket, ctx) {
  const { io, radioEngine, radioStream, endHostSession, endGuestSession, clearGuestPending, pendingGuestSocketIds } = ctx;

  const busyKeys = new Set(
    Object.values(session.activeUsers)
      .filter((u) => u.oligarchKey)
      .map((u) => u.oligarchKey)
  );
  const pool   = PUBLIC_OLIGARCHS.filter((o) => !busyKeys.has(o.key));
  const person = (pool.length ? pool : PUBLIC_OLIGARCHS)[Math.floor(Math.random() * (pool.length || PUBLIC_OLIGARCHS.length))];

  session.activeUsers[socket.id] = {
    oligarchKey: person.key,
    name : localizeOligarchName(person.key),
    img  : person.img,
    color: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
  };

  console.log('[Client] Connected:', socket.id);
  emitUsersUpdate(io);
  socket.emit('sync', radioEngine.getState());
  broadcastAdminOnline(io);
  socket.emit('radio_hosts_mode', RADIO_HOSTS_MODE);
  if (RADIO_HOSTS_MODE) socket.emit('radio_hosts_online', !isHostRoomEmpty());

  socket.on('listener_init', () => {
    if (isAdminSocket(socket.id)) return;
    const ip  = ctx.getSocketIp(socket);
    const uid = ipToUid(ip);
    socket.data.listenerUid = uid;
    const lastSuggest      = suggestState.cooldowns.get(uid) || 0;
    const cooldownSecsLeft = Math.max(0, Math.ceil((SUGGEST_COOLDOWN_MS - (Date.now() - lastSuggest)) / 1000));
    const { token: artToken } = getOrCreateArtToken(uid);
    const artTokenExpiresIn   = Math.floor(tokenTtlMs(uid) / 1000);
    socket.emit('listener_uid', { uid, cooldownSecsLeft, artToken, artTokenExpiresIn });
    socket.emit('usersUpdate', Object.values(session.activeUsers));
  });

  socket.on('disconnect', () => {
    const pendingUid = socket.data.listenerUid;
    if (pendingUid && guestRoomState.pending.get(pendingUid)?.socketId === socket.id) {
      removeGuestRequest(pendingUid);
      emitGuestQueueToAdmins(io);
    }
    const wasAdmin = isAdminSocket(socket.id);
    if (wasAdmin) {
      session.activeAdminSockets.delete(socket.id);
      broadcastAdminOnline(io);
      console.log('[Admin] Session ended (disconnected):', socket.id);
    }
    if (socket.data.isLiveHost) {
      endHostSession(socket, 'self');
    }
    if (socket.data.isLiveGuest) {
      endGuestSession(socket, 'self');
    } else if (pendingGuestSocketIds.has(socket.id)) {
      socket.data.guestSession = null;
      clearGuestPending(socket.id);
    }
    delete session.activeUsers[socket.id];
    purgeStaleUsers(io);
    emitUsersUpdate(io);
    console.log('[Client] Disconnected:', socket.id);
  });
}