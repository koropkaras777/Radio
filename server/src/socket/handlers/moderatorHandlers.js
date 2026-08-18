import { SUPER_ADMIN_LOGIN } from '../../config/env.js';
import { t } from '../../i18n/index.js';
import { session, isAdminSocket, isHostRoomEmpty, liveSession } from '../../session/session.js';
import { auditLogger, AUDIT_TYPES } from '../../audit/auditLogger.js';
import {
  generateGuestCode, deactivateGuestCode, regenerateGuestCode, getActiveGuestCode,
} from '../../tokens/guestHostToken.js';
import { rejectAllPendingGuestRequests } from '../../session/guestRoom.js';
import { getSocketIp } from '../shared/ioHelpers.js';

export function registerModeratorHandlers(socket, ctx) {
  const { io, dataProvider, radioStream, canManageGuestCode, canModerate, buildLiveHostsRoster, broadcastLiveHostsRoster, broadcastGuestCodeUpdate, endGuestSession, endHostSession } = ctx;

  // ── Moderator / host-shared: special-guest access code ───────
  socket.on('moderator_get_guest_code', (_payload, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canManageGuestCode(socket.id)) return ack({ code: null });
    const current = getActiveGuestCode();
    ack(current ? { code: current.code, expiresAt: current.expiresAt } : { code: null });
  });

  socket.on('moderator_generate_guest_code', ({ ttlHours } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canManageGuestCode(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    if (getActiveGuestCode()) {
      return ack({ error: t('guestRoom.codeAlreadyActive') });
    }

    const { code, expiresAt } = generateGuestCode(ttlHours, () => broadcastGuestCodeUpdate({ code: null }));
    broadcastGuestCodeUpdate({ code, expiresAt });
    rejectAllPendingGuestRequests(io, 'special_guest_active');

    const adminEntry = session.activeAdminSockets.get(socket.id);
    auditLogger.log({
      adminId:       adminEntry?.adminId || 'super',
      adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
      operationType: AUDIT_TYPES.GUEST_CODE_GENERATE,
      data:          { ttlHours: Number(ttlHours) || 8 },
    }).catch(() => {});

    ack({ ok: true, code, expiresAt });
  });

  socket.on('moderator_deactivate_guest_code', (_payload, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canManageGuestCode(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    deactivateGuestCode();
    broadcastGuestCodeUpdate({ code: null });

    const adminEntry = session.activeAdminSockets.get(socket.id);
    auditLogger.log({
      adminId:       adminEntry?.adminId || 'super',
      adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
      operationType: AUDIT_TYPES.GUEST_CODE_DEACTIVATE,
      data:          {},
    }).catch(() => {});

    ack({ ok: true });
  });

  socket.on('moderator_regenerate_guest_code', ({ ttlHours } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canManageGuestCode(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }

    const { code, expiresAt } = regenerateGuestCode(ttlHours, () => broadcastGuestCodeUpdate({ code: null }));
    broadcastGuestCodeUpdate({ code, expiresAt });

    const adminEntry = session.activeAdminSockets.get(socket.id);
    auditLogger.log({
      adminId:       adminEntry?.adminId || 'super',
      adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
      operationType: AUDIT_TYPES.GUEST_CODE_REGENERATE,
      data:          { ttlHours: Number(ttlHours) || 8 },
    }).catch(() => {});

    ack({ ok: true, code, expiresAt });
  });

  socket.on('moderator_get_live_roster', (_payload, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canModerate(socket.id)) return ack({ roster: [], hostsOnline: false });
    ack({ roster: buildLiveHostsRoster(), hostsOnline: !isHostRoomEmpty() });
  });

  socket.on('moderator_mute', ({ targetId, muted } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canModerate(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    const isLiveTarget = liveSession.hosts.has(targetId) || targetId === liveSession.guest || targetId === liveSession.specialGuest;
    if (!isLiveTarget) {
      return ack({ error: t('common.participantNotFound') });
    }

    const isMuted = Boolean(muted);
    radioStream?.setParticipantMuted(targetId, isMuted);

    broadcastLiveHostsRoster();
    ack({ ok: true });
  });

  socket.on('moderator_kick', ({ targetId } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canModerate(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }

    const targetSocket = io.sockets.sockets.get(targetId);
    const adminEntry   = session.activeAdminSockets.get(socket.id);

    if (liveSession.hosts.has(targetId)) {
      const targetAdminEntry = session.activeAdminSockets.get(targetId);
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
        adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.PARTICIPANT_KICK,
        data:          { nickname: targetAdminEntry?.login || '', role: 'host' },
      }).catch(() => {});
      if (targetSocket) endHostSession(targetSocket, 'kick');
      return ack({ ok: true });
    }

    const role = targetId === liveSession.specialGuest ? 'specialGuest'
               : targetId === liveSession.guest ? 'guest' : null;
    if (!role) {
      return ack({ error: t('common.participantNotFound') });
    }

    const nickname = targetSocket?.data.guestSession?.nickname || '';
    const ip        = targetSocket ? getSocketIp(targetSocket) : '';

    if (role === 'specialGuest') {
      deactivateGuestCode();
      broadcastGuestCodeUpdate({ code: null });
    }

    auditLogger.log({
      adminId:       adminEntry?.adminId || 'super',
      adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
      operationType: AUDIT_TYPES.GUEST_KICK,
      data:          { nickname, ip, role },
    }).catch(() => {});

    if (targetSocket) endGuestSession(targetSocket, 'kick');
    ack({ ok: true });
  });

  socket.on('moderator_get_banlist', async ({ offset = 0, limit = 10 } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canModerate(socket.id)) return ack({ list: [], total: 0 });
    try {
      const full = await dataProvider?.loadBannedIps?.() ?? [];
      const safeOffset = Math.max(0, Number(offset) || 0);
      const safeLimit  = Math.max(1, Math.min(100, Number(limit) || 10));
      const list = full.slice(safeOffset, safeOffset + safeLimit);
      ack({ list, total: full.length });
    } catch (err) {
      console.error('[Moderator] Failed to load banlist:', err.message);
      ack({ list: [], total: 0 });
    }
  });

  socket.on('moderator_ban_participant', async ({ targetId } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canModerate(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    if (!targetId || targetId !== liveSession.guest) {
      return ack({ error: t('moderator.banOnlyForGuest') });
    }
    if (typeof dataProvider?.banIp !== 'function') {
      return ack({ error: t('moderator.banlistUnavailable') });
    }
    const targetSocket = io.sockets.sockets.get(targetId);
    if (!targetSocket) {
      return ack({ error: t('common.participantNotFound') });
    }

    const nickname   = targetSocket.data.guestSession?.nickname || '';
    const ip          = getSocketIp(targetSocket);
    const adminEntry = session.activeAdminSockets.get(socket.id);

    try {
      await dataProvider.banIp({
        ip,
        nickname,
        bannedBy: adminEntry?.login || SUPER_ADMIN_LOGIN,
      });
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
        adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.GUEST_BAN,
        data:          { ip, nickname },
      }).catch(() => {});
    } catch (err) {
      console.error('[Moderator] banIp (from roster) failed:', err.message);
      return ack({ error: t('moderator.banFailed') });
    }

    endGuestSession(targetSocket, 'ban');
    ack({ ok: true });
  });

  socket.on('moderator_ban_ip', async ({ ip, nickname } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canModerate(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    const trimmedIp = String(ip || '').trim();
    if (!trimmedIp) {
      return ack({ error: t('moderator.ipRequired') });
    }
    if (typeof dataProvider?.banIp !== 'function') {
      return ack({ error: t('moderator.banlistUnavailable') });
    }

    const adminEntry = session.activeAdminSockets.get(socket.id);
    try {
      const entry = await dataProvider.banIp({
        ip:       trimmedIp,
        nickname: nickname || '',
        bannedBy: adminEntry?.login || SUPER_ADMIN_LOGIN,
      });
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
        adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.GUEST_BAN,
        data:          { ip: trimmedIp, nickname: nickname || '' },
      }).catch(() => {});
      ack({ ok: true, entry });
    } catch (err) {
      ack({ error: t('moderator.banFailed') });
      console.error('[Moderator] banIp failed:', err.message);
    }
  });

  socket.on('moderator_unban_ip', async ({ ip } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!isAdminSocket(socket.id) || !canModerate(socket.id)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    const trimmedIp = String(ip || '').trim();
    if (!trimmedIp) {
      return ack({ error: t('moderator.ipRequired') });
    }
    if (typeof dataProvider?.unbanIp !== 'function') {
      return ack({ error: t('moderator.banlistUnavailable') });
    }

    const adminEntry = session.activeAdminSockets.get(socket.id);
    try {
      await dataProvider.unbanIp(trimmedIp);
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
        adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.GUEST_UNBAN,
        data:          { ip: trimmedIp },
      }).catch(() => {});
      ack({ ok: true });
    } catch (err) {
      ack({ error: t('moderator.unbanFailed') });
      console.error('[Moderator] unbanIp failed:', err.message);
    }
  });
}