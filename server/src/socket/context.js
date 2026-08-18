import { RADIO_HOSTS_MODE, SUPER_ADMIN_LOGIN } from '../config/env.js';
import {
  session, socketHasPrivilege, isHostRoomEmpty, unregisterLiveHost, LIVE_HOSTS_ROOM,
  liveSession, clearLiveGuest, clearLiveSpecialGuest,
} from '../session/session.js';
import { PRIVILEGES } from '../config/privileges.js';
import { auditLogger, AUDIT_TYPES } from '../audit/auditLogger.js';
import { hostMonitor } from '../stream/hostMonitor.js';
import { broadcastRadioHostsOnline, rejectAllPendingGuestRequests } from '../session/guestRoom.js';
import { getSocketIp } from './shared/ioHelpers.js';

const DEFAULT_GUEST_MAX_MINUTES         = 15;
const DEFAULT_SPECIAL_GUEST_MAX_MINUTES = 60;

// ── Radio-hosts helpers ──────────────────────────────────────────────────────
const canManageGuestCode = (socketId) =>
  socketHasPrivilege(socketId, PRIVILEGES.RADIO_HOST) ||
  socketHasPrivilege(socketId, PRIVILEGES.RADIO_MODERATOR);

const canModerate = (socketId) => socketHasPrivilege(socketId, PRIVILEGES.RADIO_MODERATOR);

export function createSocketContext(io, { radioEngine, dataProvider, radioStream }) {
  // ── Radio hosts: live participants roster ──
  const buildLiveHostsRoster = () => {
    const roster = [];
    for (const socketId of liveSession.hosts) {
      const entry = session.activeAdminSockets.get(socketId);
      roster.push({ id: socketId, login: entry?.login || 'host', role: 'host', muted: Boolean(radioStream?.isParticipantMuted?.(socketId)) });
    }
    if (liveSession.specialGuest) {
      const sock = io?.sockets.sockets.get(liveSession.specialGuest);
      roster.push({ id: liveSession.specialGuest, login: sock?.data.guestSession?.nickname || 'guest', role: 'specialGuest', muted: Boolean(radioStream?.isParticipantMuted?.(liveSession.specialGuest)) });
    }
    if (liveSession.guest) {
      const sock = io?.sockets.sockets.get(liveSession.guest);
      roster.push({ id: liveSession.guest, login: sock?.data.guestSession?.nickname || 'guest', role: 'guest', muted: Boolean(radioStream?.isParticipantMuted?.(liveSession.guest)) });
    }
    return roster;
  };

  const broadcastLiveHostsRoster = () => {
    const roster = buildLiveHostsRoster();
    io.to(LIVE_HOSTS_ROOM).emit('live_hosts_roster', roster);
    for (const [socketId] of session.activeAdminSockets) {
      if (liveSession.hosts.has(socketId)) continue;
      if (!canModerate(socketId)) continue;
      io.sockets.sockets.get(socketId)?.emit('live_hosts_roster', roster);
    }
  };

  const liveParticipantIds = () =>
    [...liveSession.hosts, liveSession.specialGuest, liveSession.guest].filter(Boolean);

  const broadcastGuestCodeUpdate = (payload) => {
    for (const [socketId] of session.activeAdminSockets) {
      if (!canManageGuestCode(socketId)) continue;
      const sock = io.sockets.sockets.get(socketId);
      sock?.emit('guest_code_updated', payload);
    }
  };

  // ── Radio hosts: session duration, read from settings ────────
  const guestDurationMinutes = (role) => {
    const radioHosts = radioEngine?.settings?.radioHosts || {};
    const fallback  = role === 'specialGuest' ? DEFAULT_SPECIAL_GUEST_MAX_MINUTES : DEFAULT_GUEST_MAX_MINUTES;
    const configured = role === 'specialGuest'
      ? radioHosts.specialGuestMaxDurationMinutes
      : radioHosts.guestMaxDurationMinutes;
    const n = Number(configured);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  // ── Radio-hosts: "approved, not yet connected" tracking (host panel indicator) ──
  const pendingGuestSocketIds = new Set();

  const buildPendingGuestList = () => {
    const list = [];
    for (const socketId of pendingGuestSocketIds) {
      const sock = io.sockets.sockets.get(socketId);
      const guestSession = sock?.data.guestSession;
      if (!sock || !guestSession || sock.data.isLiveGuest) continue;
      list.push({ id: socketId, nickname: guestSession.nickname, role: guestSession.role });
    }
    return list;
  };

  const broadcastPendingGuestStatus = () => {
    io.to(LIVE_HOSTS_ROOM).emit('guest_pending_status', buildPendingGuestList());
  };

  const markGuestPending = (socket) => {
    pendingGuestSocketIds.add(socket.id);
    broadcastPendingGuestStatus();
  };

  const clearGuestPending = (socketId) => {
    if (pendingGuestSocketIds.delete(socketId)) broadcastPendingGuestStatus();
  };

  // ── Radio-hosts: end a live guest/specialGuest session ──
  const endGuestSession = (socket, reason) => {
    if (socket.data.guestTimeoutTimer) {
      clearTimeout(socket.data.guestTimeoutTimer);
      socket.data.guestTimeoutTimer = null;
    }
    const guestSession = socket.data.guestSession;
    const role = guestSession?.role;
    if (!socket.data.isLiveGuest || !role) return;

    if (role === 'specialGuest') clearLiveSpecialGuest();
    else clearLiveGuest();

    socket.data.isLiveGuest = false;
    socket.leave(LIVE_HOSTS_ROOM);
    radioStream?.removeHostMic?.(socket.id);
    hostMonitor.removeHost(socket.id).catch((err) => console.error('[HostMonitor] removeHost failed:', err.message));

    const auditType = role === 'specialGuest' ? AUDIT_TYPES.SPECIAL_GUEST_LIVE_END : AUDIT_TYPES.GUEST_LIVE_END;
    auditLogger.log({
      adminId:       'guest',
      adminLogin:    guestSession.nickname,
      operationType: auditType,
      data:          { reason },
    }).catch(() => {});

    if (reason !== 'self') socket.emit('guest_force_disconnect', { reason });
    socket.data.guestSession = null;
    clearGuestPending(socket.id);

    console.log(`[GuestRoom] ${role} left live ("${guestSession.nickname}", reason: ${reason})`);
    broadcastLiveHostsRoster();
    hostMonitor.syncRoster(liveParticipantIds());
  };

  const forceEndAllGuestsNoHosts = () => {
    for (const guestId of [liveSession.specialGuest, liveSession.guest]) {
      if (!guestId) continue;
      const guestSocket = io.sockets.sockets.get(guestId);
      if (guestSocket) endGuestSession(guestSocket, 'no_hosts');
    }
    for (const socketId of [...pendingGuestSocketIds]) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.data.guestSession = null;
      clearGuestPending(socketId);
    }
  };

  // ── Radio-hosts: end a live HOST session (voluntary leave or moderator kick) ──
  const endHostSession = (socket, reason) => {
    if (!socket.data.isLiveHost) return;
    unregisterLiveHost(socket.id);
    socket.data.isLiveHost = false;
    socket.leave(LIVE_HOSTS_ROOM);

    const adminEntry = session.activeAdminSockets.get(socket.id);
    auditLogger.log({
      adminId:       adminEntry?.adminId || 'super',
      adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
      operationType: AUDIT_TYPES.RADIO_HOST_LIVE_END,
      data:          { reason },
    }).catch(() => {});

    radioStream?.removeHostMic?.(socket.id);
    hostMonitor.removeHost(socket.id).catch((err) => console.error('[HostMonitor] removeHost failed:', err.message));

    if (isHostRoomEmpty()) {
      radioStream?.forceResumeHostPauses?.();
      rejectAllPendingGuestRequests(io, 'no_admin');
      forceEndAllGuestsNoHosts();
    }

    if (reason !== 'self') socket.emit('host_force_disconnect', { reason });

    console.log(`[RadioHost] Left live (${socket.id}, reason: ${reason})`);
    broadcastLiveHostsRoster();
    broadcastRadioHostsOnline(io);
  };

  return { io, radioEngine, dataProvider, radioStream, canManageGuestCode, canModerate, buildLiveHostsRoster, broadcastLiveHostsRoster, liveParticipantIds, broadcastGuestCodeUpdate, guestDurationMinutes, pendingGuestSocketIds, buildPendingGuestList, markGuestPending, clearGuestPending, endGuestSession, endHostSession, forceEndAllGuestsNoHosts, getSocketIp, RADIO_HOSTS_MODE };
}