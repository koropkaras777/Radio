import { SUPER_ADMIN_LOGIN } from '../../config/env.js';
import { t } from '../../i18n/index.js';
import { session, isAdminSocket, socketHasPrivilege, canGoLive, registerLiveHost, LIVE_HOSTS_ROOM } from '../../session/session.js';
import { PRIVILEGES } from '../../config/privileges.js';
import { auditLogger, AUDIT_TYPES } from '../../audit/auditLogger.js';
import { auditDetails } from '../../audit/auditDetails.js';
import { hostMonitor } from '../../stream/hostMonitor.js';
import { broadcastRadioHostsOnline } from '../../session/guestRoom.js';

export function registerLiveHostHandlers(socket, ctx) {
  const { io, radioEngine, dataProvider, radioStream, RADIO_HOSTS_MODE, endHostSession, buildLiveHostsRoster, broadcastLiveHostsRoster, liveParticipantIds, buildPendingGuestList } = ctx;

  const isLiveParticipant = () => Boolean(socket.data.isLiveHost || socket.data.isLiveGuest);
  const logHostAction = (operationType, data = {}) => {
    const actor = session.activeAdminSockets.get(socket.id);
    auditLogger.log({ adminId: actor?.adminId || 'super', adminLogin: actor?.login || SUPER_ADMIN_LOGIN, operationType, data }).catch(() => {});
  };

  socket.on('admin_go_live', (_payload, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!RADIO_HOSTS_MODE) {
      return ack({ error: t('liveHosts.featureDisabled') });
    }
    if (!isAdminSocket(socket.id) || !socketHasPrivilege(socket.id, PRIVILEGES.RADIO_HOST)) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    if (socket.data.isLiveHost) return ack({ ok: true });
    if (!canGoLive('host')) {
      return ack({ error: t('liveHosts.noFreeHostSlots') });
    }

    registerLiveHost(socket.id);
    socket.data.isLiveHost = true;
    socket.join(LIVE_HOSTS_ROOM);

    const adminEntry = session.activeAdminSockets.get(socket.id);
    auditLogger.log({
      adminId:       adminEntry?.adminId || 'super',
      adminLogin:    adminEntry?.login || SUPER_ADMIN_LOGIN,
      operationType: AUDIT_TYPES.RADIO_HOST_LIVE_START,
      data:          {},
    }).catch(() => {});

    console.log(`[RadioHost] Went live: ${socket.id}`);
    ack({
      ok: true,
      queuePaused: Boolean(radioStream?.isQueuePaused),
      hosts: buildLiveHostsRoster(),
      pendingGuests: buildPendingGuestList(),
      backgroundMusicMode: radioEngine?.settings?.radioHosts?.backgroundMusicMode || 'random',
      selectedBackgroundMusicId: radioStream?.selectedBackgroundMusicId || null,
    });
    broadcastLiveHostsRoster();
    broadcastRadioHostsOnline(io);
    hostMonitor.syncRoster(liveParticipantIds());
  });

  socket.on('admin_leave_live', () => endHostSession(socket, 'self'));

  socket.on('host_mic_toggle', ({ on } = {}) => {
    if (!isLiveParticipant()) return;
    radioStream?.setHostMicActive?.(socket.id, Boolean(on));
  });

  socket.on('host_mic_gain', ({ gain } = {}) => {
    if (!isLiveParticipant()) return;
    radioStream?.setHostMicGain?.(socket.id, gain);
  });

  socket.on('host_audio_chunk', (chunk) => {
    if (!isLiveParticipant() || !radioStream?.isHostMicActive?.(socket.id)) return;
    radioStream.pushHostAudioChunk(socket.id, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  socket.on('host_pause_queue', () => {
    if (!socket.data.isLiveHost) return;
    if (radioEngine.hasDonatedInQueue()) {
      socket.emit('host_queue_pause_state', { paused: false, denied: true, reason: 'donatedInQueue' });
      return;
    }
    const before = Boolean(radioStream?.isQueuePaused);
    radioStream?.pauseQueue?.();
    if (!before && radioStream?.isQueuePaused) logHostAction(AUDIT_TYPES.HOST_QUEUE_PAUSE);
  });

  socket.on('host_resume_queue', () => {
    if (!socket.data.isLiveHost) return;
    const before = Boolean(radioStream?.isQueuePaused);
    radioStream?.resumeQueue?.();
    if (before && !radioStream?.isQueuePaused) logHostAction(AUDIT_TYPES.HOST_QUEUE_RESUME);
  });

  // ── Radio-hosts: background music, 'hostChoice' mode ──
  socket.on('host_get_background_music_list', async ({ offset = 0, limit = 5 } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!socket.data.isLiveHost) return ack({ items: [], total: 0 });
    try {
      const mode = radioEngine?.currentMode === 'night' ? 'night' : 'day';
      const safeOffset = Math.max(0, Number(offset) || 0);
      const safeLimit  = Math.max(1, Math.min(50, Number(limit) || 5));
      const { items, total } = await dataProvider?.queryUsableBackgroundMusic?.({ mode, offset: safeOffset, limit: safeLimit }) ?? { items: [], total: 0 };
      ack({ items, total, mode });
    } catch (err) {
      console.error('[RadioHost] Failed to load background music list:', err.message);
      ack({ items: [], total: 0 });
    }
  });

  socket.on('host_set_background_music', async ({ trackId } = {}, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};
    if (!socket.data.isLiveHost) {
      return ack({ error: t('common.insufficientPrivileges') });
    }
    const id = trackId ? String(trackId) : null;
    if (id) {
      const track = await dataProvider?.getBackgroundMusicById?.(id).catch(() => null);
      if (!track) return ack({ error: t('liveHosts.trackNotFound') });
    }
    const previousId = radioStream?.selectedBackgroundMusicId || null;
    const previous = previousId ? await dataProvider?.getBackgroundMusicById?.(previousId).catch(() => null) : null;
    radioStream?.setSelectedBackgroundMusicId?.(id);
    const savedId = radioStream?.selectedBackgroundMusicId || null;
    if (previousId !== savedId) {
      const selected = savedId ? await dataProvider?.getBackgroundMusicById?.(savedId).catch(() => null) : null;
      logHostAction(AUDIT_TYPES.HOST_BACKGROUND_MUSIC, { details: auditDetails({ backgroundTrack: previous?.filename || previousId }, { backgroundTrack: selected?.filename || savedId }) });
    }
    ack({ ok: true });
  });

  // ── Radio-hosts: personal monitor-channel signaling ──────────
  socket.on('monitor_answer', ({ sdp } = {}) => {
    if (!isLiveParticipant()) return;
    hostMonitor.handleAnswer(socket.id, sdp).catch((err) => {
      console.warn('[HostMonitor] handleAnswer failed:', err.message);
    });
  });

  socket.on('monitor_ice_candidate', (candidate) => {
    if (!isLiveParticipant()) return;
    hostMonitor.handleIceCandidate(socket.id, candidate).catch(() => { });
  });
}
