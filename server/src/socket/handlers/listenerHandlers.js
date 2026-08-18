import { STREAM_MODE, SUPER_ADMIN_LOGIN } from '../../config/env.js';
import { session, suggestState, isAdminSocket, socketHasPrivilege, anyAdminHasPrivilege } from '../../session/session.js';
import { PRIVILEGES } from '../../config/privileges.js';
import { t, tError, withCode } from '../../i18n/index.js';
import { auditLogger, AUDIT_TYPES } from '../../audit/auditLogger.js';
import {
  SUGGEST_COOLDOWN_MS, SUGGEST_EXPIRE_MS, emitSuggestionsToAdmins,
  broadcastCooldownToUid, expireSuggestion,
} from '../../engine/suggestions.js';
import { broadcastSync } from '../shared/ioHelpers.js';

export function registerListenerHandlers(socket, ctx) {
  const { io, radioEngine, radioStream } = ctx;

  socket.on('suggest_song', (song, callback) => {
    const uid = socket.data.listenerUid;
    if (!uid) return typeof callback === 'function' && callback({ error: 'no_uid' });
    const lastSuggest = suggestState.cooldowns.get(uid) || 0;
    const elapsed     = Date.now() - lastSuggest;
    if (elapsed < SUGGEST_COOLDOWN_MS) {
      const secsLeft = Math.ceil((SUGGEST_COOLDOWN_MS - elapsed) / 1000);
      return typeof callback === 'function' && callback({ error: 'cooldown', secsLeft });
    }
    if (!anyAdminHasPrivilege(PRIVILEGES.QUEUE_MANAGE)) {
      return typeof callback === 'function' && callback({ error: 'no_admin' });
    }
    if (suggestState.pending.has(uid)) {
      clearTimeout(suggestState.pending.get(uid).timerId);
      suggestState.pending.delete(uid);
    }
    suggestState.cooldowns.set(uid, Date.now());
    broadcastCooldownToUid(io, uid);
    const timerId = setTimeout(() => expireSuggestion(io, uid), SUGGEST_EXPIRE_MS);
    suggestState.pending.set(uid, { song, socketId: socket.id, timerId, addedAt: Date.now() });
    emitSuggestionsToAdmins(io);
    console.log(`[Suggest] New suggestion from UID ${uid}: "${song.title}"`);
    typeof callback === 'function' && callback({ ok: true });
  });

  socket.on('admin_suggestion_action', ({ uid, action }) => {
    if (!isAdminSocket(socket.id)) return;
    if (!socketHasPrivilege(socket.id, PRIVILEGES.QUEUE_MANAGE)) {
      socket.emit('admin_error', JSON.stringify(t('common.insufficientPrivileges')));
      return;
    }
    const item = suggestState.pending.get(uid);
    if (!item) {
      socket.emit('admin_error', JSON.stringify(t('queue.suggestionNotFound')));
      return;
    }
    clearTimeout(item.timerId);
    suggestState.pending.delete(uid);
    const listenerSocket = io.sockets.sockets.get(item.socketId);
    const adminEntry = session.activeAdminSockets.get(socket.id);
    if (action === 'add') {
      try {
        radioEngine.injectTrack({ ...item.song, orderType: 'lastinline' });
        socket.emit('admin_success', JSON.stringify(withCode('QUEUE_SUGGESTION_ACCEPTED', 'queue.suggestionAccepted')));
        broadcastSync(io, radioEngine, radioStream);
        if (listenerSocket) listenerSocket.emit('suggestion_result', { accepted: true, auto: false, song: item.song });
        auditLogger.log({
          adminId:       adminEntry?.adminId || 'super',
          adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.SUGGESTION_ACCEPT,
          data:          { title: item.song.title, artist: item.song.artist },
        }).catch(() => {});
      } catch (err) {
        console.error('[Suggest] injectTrack failed:', err.message);
        const timerId = setTimeout(() => expireSuggestion(io, uid), SUGGEST_EXPIRE_MS);
        suggestState.pending.set(uid, { ...item, timerId });
        socket.emit('admin_error', JSON.stringify(tError('QUEUE_SUGGESTION_INJECT_FAILED')));
        emitSuggestionsToAdmins(io);
        return;
      }
    } else {
      if (listenerSocket) listenerSocket.emit('suggestion_result', { accepted: false, auto: false, song: item.song });
      auditLogger.log({
        adminId:       adminEntry?.adminId || 'super',
          adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.SUGGESTION_REJECT,
        data:          { title: item.song.title, artist: item.song.artist },
      }).catch(() => {});
    }
    emitSuggestionsToAdmins(io);
  });

  // ── Stream mode: seek query & ping ────────────────────────────────────────
  socket.on('stream_get_seek', (clientTs, callback) => {
    if (!STREAM_MODE) return;
    const state = radioEngine.getState();
    const seek  = radioStream?.currentSeek ?? 0;
    if (typeof callback === 'function') {
      callback({
        seek,
        duration : state.duration ?? 0,
        trackId  : radioStream?.currentTrackId ?? state.track ?? null,
      });
    }
  });

  socket.on('stream_ping', (clientTs, callback) => {
    if (typeof callback === 'function') callback({ serverTs: Date.now(), clientTs });
  });
}