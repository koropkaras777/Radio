import { STREAM_MODE, SUPER_ADMIN_LOGIN } from '../../config/env.js';
import { ADMIN_OLIGARCH, PUBLIC_OLIGARCHS, localizeOligarchName } from '../../config/oligarchs.js';
import { verifyAdminToken } from '../../middleware/auth.js';
import { t, tError, withCode } from '../../i18n/index.js';
import { session, isAdminSocket, socketHasPrivilege } from '../../session/session.js';
import { ALL_PRIVILEGES, PRIVILEGES } from '../../config/privileges.js';
import { auditLogger, AUDIT_TYPES } from '../../audit/auditLogger.js';
import { emitSuggestionsToAdmins } from '../../engine/suggestions.js';
import { broadcastAdminOnline, emitUsersUpdate, broadcastSync, pickHelperOligarch } from '../shared/ioHelpers.js';

export function registerAdminQueueHandlers(socket, ctx) {
  const { io, radioEngine, dataProvider, radioStream } = ctx;

  socket.on('admin_active', async (token) => {
    try {
      let resolvedToken = token;
      if (!resolvedToken) {
        const rawCookie = socket.handshake.headers.cookie || '';
        const cookies = Object.fromEntries(
          rawCookie.split(';').map((c) => {
            const [k, ...v] = c.trim().split('=');
            return [k.trim(), decodeURIComponent(v.join('='))];
          }).filter(([k]) => k)
        );
        resolvedToken = cookies['adminToken'] || null;
      }

      const decoded = await verifyAdminToken(resolvedToken);
      const { role, adminId, login } = decoded;

      let safePrivileges = Array.isArray(decoded.privileges) ? decoded.privileges : ALL_PRIVILEGES;
      let safeAuthorized = decoded.authorized !== false;

      if (role !== 'super_admin' && typeof dataProvider?.getAdminById === 'function') {
        const fresh = await dataProvider.getAdminById(adminId).catch(() => null);
        if (fresh) {
          safePrivileges = fresh.privileges;
          safeAuthorized = fresh.authorized;
        }
      }

      for (const [oldSocketId, entry] of session.activeAdminSockets.entries()) {
        if (entry.adminId === (adminId || 'super') && oldSocketId !== socket.id) {
          session.activeAdminSockets.delete(oldSocketId);
          delete session.activeUsers[oldSocketId];
          console.log(`[Admin] Removed stale session for adminId ${adminId}: ${oldSocketId}`);
        }
      }

      session.activeAdminSockets.set(socket.id, {
        adminId: adminId || 'super',
        role,
        privileges: safePrivileges,
        login: login || 'Admin',
        authorized: safeAuthorized,
      });

      if (role === 'super_admin') {
        session.activeUsers[socket.id] = {
          ...session.activeUsers[socket.id],
          oligarchKey: ADMIN_OLIGARCH.key,
          name: localizeOligarchName(ADMIN_OLIGARCH.key),
          img: ADMIN_OLIGARCH.img,
          isAdmin: true,
          isSuperAdmin: true,
        };
      } else {
        const helperAvatar = pickHelperOligarch();
        session.activeUsers[socket.id] = {
          ...session.activeUsers[socket.id],
          oligarchKey: helperAvatar.oligarchKey,
          name: helperAvatar.name,
          img: helperAvatar.img,
          isAdmin: true,
          isSuperAdmin: false,
        };
      }

      emitUsersUpdate(io);
      broadcastAdminOnline(io);
      socket.emit('admin_confirmed', { privileges: safePrivileges, role, authorized: safeAuthorized });
      emitSuggestionsToAdmins(io);
      console.log(`[Admin] Session confirmed: ${socket.id} (${role}, adminId: ${adminId})`);
    } catch {
      socket.emit('admin_error', JSON.stringify(tError('ADMIN_INVALID_SESSION')));
    }
  });

  socket.on('get_queue', ({ offset = 0, limit = 10 } = {}, callback) => {
    if (!isAdminSocket(socket.id)) return;
    if (typeof callback === 'function') callback(radioEngine.getUpcoming(offset, limit));
  });

  socket.on('search_queue', ({ query = '' } = {}, callback) => {
    if (!isAdminSocket(socket.id)) return;
    if (typeof callback === 'function') callback(radioEngine.searchUpcoming(query));
  });

  socket.on('admin_add_song', (songData) => {
    if (!isAdminSocket(socket.id)) return;
    if (!socketHasPrivilege(socket.id, PRIVILEGES.QUEUE_MANAGE)) {
      socket.emit('admin_error', JSON.stringify(t('common.insufficientPrivileges')));
      return;
    }
    try {
      radioEngine.injectTrack(songData);
      socket.emit('admin_success', JSON.stringify(withCode('QUEUE_SONG_ADDED', 'queue.songAdded')));
      broadcastSync(io, radioEngine, radioStream);
      const adminEntry = session.activeAdminSockets.get(socket.id);
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
          adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.QUEUE_ADD,
        data:          { title: songData.title, artist: songData.artist, orderType: songData.orderType },
      }).catch(() => {});
    } catch (err) {
      console.error('[Queue] admin_add_song failed:', err.message);
      socket.emit('admin_error', JSON.stringify(tError('QUEUE_ADD_FAILED')));
    }
  });

  socket.on('admin_remove_song', (position) => {
    if (!isAdminSocket(socket.id)) return;
    if (!socketHasPrivilege(socket.id, PRIVILEGES.QUEUE_MANAGE)) {
      socket.emit('admin_error', JSON.stringify(t('common.insufficientPrivileges')));
      return;
    }
    try {
      radioEngine.removeTrack(position);
      socket.emit('admin_success', JSON.stringify(withCode('QUEUE_SONG_REMOVED', 'queue.songRemoved')));
      broadcastSync(io, radioEngine, radioStream);
      const adminEntry = session.activeAdminSockets.get(socket.id);
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
          adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.QUEUE_REMOVE,
        data:          { position },
      }).catch(() => {});
    } catch (err) {
      console.error('[Queue] admin_remove_song failed:', err.message);
      socket.emit('admin_error', JSON.stringify(tError('QUEUE_REMOVE_FAILED')));
    }
  });

  socket.on('admin_skip_song', () => {
    if (!isAdminSocket(socket.id)) return;
    if (!socketHasPrivilege(socket.id, PRIVILEGES.QUEUE_MANAGE)) {
      socket.emit('admin_error', JSON.stringify(t('common.insufficientPrivileges')));
      return;
    }
    if (STREAM_MODE && radioStream?.isJinglePlaying) {
      socket.emit('admin_error', JSON.stringify(t('queue.jingleInProgress')));
      return;
    }
    if (STREAM_MODE && radioStream?.isQueueIdling) {
      socket.emit('admin_error', JSON.stringify(t('queue.queueAlreadyPaused')));
      return;
    }
    try {
      const state = radioEngine.getState();
      radioEngine.skipCurrentTrack();
      if (STREAM_MODE && radioStream?.skipCurrentTrack) {
        radioStream.skipCurrentTrack();
      }
      broadcastSync(io, radioEngine, radioStream);
      socket.emit('admin_success', JSON.stringify(withCode('QUEUE_SONG_SKIPPED', 'queue.songSkipped')));
      const adminEntry = session.activeAdminSockets.get(socket.id);
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
          adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.QUEUE_SKIP,
        data:          { title: state.title || '', artist: state.artist || '' },
      }).catch(() => {});
    } catch (err) {
      console.error('[Queue] admin_skip_song failed:', err.message);
      socket.emit('admin_error', JSON.stringify(tError('QUEUE_SKIP_FAILED')));
    }
  });

  socket.on('admin_insert_song_group', ({ groupId }) => {
    if (!isAdminSocket(socket.id)) return;
    if (!socketHasPrivilege(socket.id, PRIVILEGES.QUEUE_MANAGE) ||
        !socketHasPrivilege(socket.id, PRIVILEGES.SETTINGS_GROUPS)) {
      socket.emit('admin_error', JSON.stringify(t('common.insufficientPrivileges')));
      return;
    }
    try {
      const result = radioEngine.injectSongGroup(groupId);
      socket.emit('admin_success', JSON.stringify(result.message));
      broadcastSync(io, radioEngine, radioStream);
    } catch (err) {
      socket.emit('admin_error', JSON.stringify(err.localized || tError('QUEUE_GROUP_INSERT_FAILED')));
    }
  });
}