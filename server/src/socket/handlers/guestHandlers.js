import { SUPER_ADMIN_LOGIN } from '../../config/env.js';
import { t } from '../../i18n/index.js';
import {
  session, isAdminSocket, socketHasPrivilege, canGoLive,
  registerLiveGuest, registerLiveSpecialGuest, isHostRoomEmpty, LIVE_HOSTS_ROOM, liveSession,
} from '../../session/session.js';
import { PRIVILEGES } from '../../config/privileges.js';
import { auditLogger, AUDIT_TYPES } from '../../audit/auditLogger.js';
import { hostMonitor } from '../../stream/hostMonitor.js';
import {
  deactivateGuestCode, getActiveGuestCode, isGuestCodeValid,
  isGuestCodeRateLimited, registerFailedGuestCodeAttempt,
} from '../../tokens/guestHostToken.js';
import {
  GUEST_REQUEST_EXPIRE_MS, guestRoomState, emitGuestQueueToAdmins,
  canSubmitGuestRequest, expireGuestRequest, removeGuestRequest,
} from '../../session/guestRoom.js';
import { getSocketIp, ipToUid } from '../shared/ioHelpers.js';

export function registerGuestHandlers(socket, ctx) {
  const { io, radioStream, dataProvider, RADIO_HOSTS_MODE, endGuestSession, broadcastLiveHostsRoster, liveParticipantIds, guestDurationMinutes, markGuestPending, clearGuestPending, broadcastGuestCodeUpdate } = ctx;

  // ── Radio-hosts: guest/special-guest actual live connection ──
  socket.on('guest_connect', (_payload, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!RADIO_HOSTS_MODE) {
      return ack({ error: t('liveHosts.featureDisabled') });
    }
    if (socket.data.isLiveGuest) {
      return ack({ ok: true, role: socket.data.guestSession?.role, nickname: socket.data.guestSession?.nickname, expiresAt: socket.data.guestExpiresAt });
    }
    const guestSession = socket.data.guestSession;
    if (!guestSession) {
      return ack({ error: t('liveHosts.sessionNotVerified') });
    }
    if (isHostRoomEmpty()) {
      return ack({ error: t('liveHosts.noHostLive') });
    }
    if (!canGoLive(guestSession.role)) {
      return ack({ error: t('liveHosts.noFreeSlots') });
    }

    if (guestSession.role === 'specialGuest') registerLiveSpecialGuest(socket.id);
    else registerLiveGuest(socket.id);

    socket.data.isLiveGuest = true;
    socket.join(LIVE_HOSTS_ROOM);

    const minutes   = guestDurationMinutes(guestSession.role);
    const expiresAt = Date.now() + minutes * 60_000;
    socket.data.guestExpiresAt    = expiresAt;
    socket.data.guestTimeoutTimer = setTimeout(() => endGuestSession(socket, 'timeout'), minutes * 60_000);
    socket.data.guestTimeoutTimer.unref?.();

    const auditType = guestSession.role === 'specialGuest' ? AUDIT_TYPES.SPECIAL_GUEST_LIVE_START : AUDIT_TYPES.GUEST_LIVE_START;
    auditLogger.log({
      adminId:       'guest',
      adminLogin:    guestSession.nickname,
      operationType: auditType,
      data:          {},
    }).catch(() => {});

    console.log(`[GuestRoom] ${guestSession.role} went live: "${guestSession.nickname}" (${socket.id})`);
    ack({ ok: true, role: guestSession.role, nickname: guestSession.nickname, expiresAt });
    clearGuestPending(socket.id);
    broadcastLiveHostsRoster();
    hostMonitor.syncRoster(liveParticipantIds());
  });

  socket.on('guest_leave_live', () => endGuestSession(socket, 'self'));

  socket.on('host_guest_mute', ({ targetId, muted } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!socket.data.isLiveHost) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    const role = targetId === liveSession.specialGuest ? 'specialGuest'
               : targetId === liveSession.guest ? 'guest' : null;
    if (!role) {
      return ack({ error: t('common.participantNotFound') });
    }

    const isMuted = Boolean(muted);
    radioStream?.setParticipantMuted(targetId, isMuted);

    broadcastLiveHostsRoster();
    ack({ ok: true });
  });

  socket.on('host_guest_kick', ({ targetId } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!socket.data.isLiveHost) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    const role = targetId === liveSession.specialGuest ? 'specialGuest'
               : targetId === liveSession.guest ? 'guest' : null;
    if (!role) {
      return ack({ error: t('common.participantNotFound') });
    }

    const targetSocket = io.sockets.sockets.get(targetId);
    const nickname = targetSocket?.data.guestSession?.nickname || '';
    const ip        = targetSocket ? getSocketIp(targetSocket) : '';

    if (role === 'specialGuest') {
      deactivateGuestCode();
      broadcastGuestCodeUpdate({ code: null });
    }

    const adminEntry = session.activeAdminSockets.get(socket.id);
    auditLogger.log({
      adminId:       adminEntry?.adminId || 'super',
      adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
      operationType: AUDIT_TYPES.GUEST_KICK,
      data:          { nickname, ip, role },
    }).catch(() => {});

    if (targetSocket) endGuestSession(targetSocket, 'kick');
    ack({ ok: true });
  });

  // ── Radio-hosts: guest room request queue ───────
  socket.on('guest_check_ban', async (_payload, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!RADIO_HOSTS_MODE) return ack({ banned: false });
    const ip = getSocketIp(socket);
    let banned = false;
    try { banned = Boolean(await dataProvider?.isIpBanned?.(ip)); } catch { banned = false; }
    ack({ banned });
  });

  socket.on('guest_request', async ({ nickname } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!RADIO_HOSTS_MODE) {
      return ack({ error: t('liveHosts.featureDisabled') });
    }
    if (isAdminSocket(socket.id)) {
      return ack({ error: t('guestRoom.adminCannotSubmitRequest') });
    }
    const trimmedNickname = String(nickname || '').trim();
    if (!trimmedNickname) {
      return ack({ error: t('guestRoom.nicknameRequired') });
    }

    const ip = getSocketIp(socket);
    let ipBanned = false;
    try { ipBanned = Boolean(await dataProvider?.isIpBanned?.(ip)); } catch { ipBanned = false; }
    if (ipBanned) {
      return ack({ error: t('guestRoom.accessBlocked') });
    }
    const uid = ipToUid(ip);
    socket.data.listenerUid = uid;

    const check = canSubmitGuestRequest(uid);
    if (check.error) return ack({ error: check.error, secsLeft: check.secsLeft });

    const existing = guestRoomState.pending.get(uid);
    if (existing) clearTimeout(existing.timerId);

    const timerId = setTimeout(() => expireGuestRequest(io, uid), GUEST_REQUEST_EXPIRE_MS);
    guestRoomState.pending.set(uid, {
      nickname: trimmedNickname,
      socketId: socket.id,
      timerId,
      addedAt:  existing?.addedAt ?? Date.now(),
    });

    emitGuestQueueToAdmins(io);
    console.log(`[GuestRoom] New request from UID ${uid}: "${trimmedNickname}"`);
    ack({ ok: true });
  });

  socket.on('admin_guest_action', ({ uid, action } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !socketHasPrivilege(socket.id, PRIVILEGES.RADIO_HOST)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    const item = removeGuestRequest(uid);
    if (!item) {
      return ack({ error: t('guestRoom.requestNotFound') });
    }

    const listenerSocket = io.sockets.sockets.get(item.socketId);

    if (action === 'accept') {
      if (!canGoLive('guest')) {
        guestRoomState.cooldowns.set(uid, Date.now());
        listenerSocket?.emit('guest_request_result', { accepted: false, auto: false, reason: 'room_full' });
        emitGuestQueueToAdmins(io);
        return ack({ error: t('guestRoom.slotJustTaken') });
      }
      if (listenerSocket) {
        listenerSocket.data.guestSession = { role: 'guest', nickname: item.nickname };
        markGuestPending(listenerSocket);
      }
      listenerSocket?.emit('guest_request_result', { accepted: true, nickname: item.nickname });
    } else {
      guestRoomState.cooldowns.set(uid, Date.now());
      listenerSocket?.emit('guest_request_result', { accepted: false, auto: false });
    }

    emitGuestQueueToAdmins(io);
    ack({ ok: true });
  });

  socket.on('special_guest_connect', ({ code, nickname } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!RADIO_HOSTS_MODE) {
      return ack({ error: t('liveHosts.featureDisabled') });
    }
    if (isAdminSocket(socket.id)) {
      return ack({ error: t('guestRoom.adminCannotJoinAsGuest') });
    }
    const trimmedNickname = String(nickname || '').trim();
    if (!trimmedNickname) {
      return ack({ error: t('guestRoom.nicknameRequired') });
    }

    const ip = getSocketIp(socket);
    if (isGuestCodeRateLimited(ip)) {
      return ack({ error: t('guestRoom.tooManyAttempts') });
    }

    const submittedCode = String(code || '').trim();
    const active = getActiveGuestCode();

    if (!active) {
      registerFailedGuestCodeAttempt(ip);
      return ack({ error: t('guestRoom.codeExpiredOrDeactivated') });
    }
    if (!isGuestCodeValid(submittedCode)) {
      registerFailedGuestCodeAttempt(ip);
      return ack({ error: t('guestRoom.invalidCode') });
    }
    if (!canGoLive('specialGuest')) {
      return ack({ error: t('liveHosts.noFreeSlots') });
    }

    socket.data.guestSession = { role: 'specialGuest', nickname: trimmedNickname, verifiedAt: Date.now() };
    markGuestPending(socket);
    console.log(`[GuestRoom] Special guest authenticated: "${trimmedNickname}" (${socket.id})`);
    ack({ ok: true });
  });
}