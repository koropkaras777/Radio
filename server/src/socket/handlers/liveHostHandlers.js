import { SUPER_ADMIN_LOGIN } from '../../config/env.js';
import { t } from '../../i18n/index.js';
import { session, isAdminSocket, socketHasPrivilege, canGoLive, registerLiveHost, LIVE_HOSTS_ROOM } from '../../session/session.js';
import { PRIVILEGES } from '../../config/privileges.js';
import { auditLogger, AUDIT_TYPES } from '../../audit/auditLogger.js';
import { hostMonitor } from '../../stream/hostMonitor.js';
import { broadcastRadioHostsOnline } from '../../session/guestRoom.js';

export function registerLiveHostHandlers(socket, ctx) {
  const { io, radioEngine, dataProvider, radioStream, RADIO_HOSTS_MODE, endHostSession, buildLiveHostsRoster, broadcastLiveHostsRoster, liveParticipantIds, buildPendingGuestList } = ctx;

  const isLiveParticipant = () => Boolean(socket.data.isLiveHost || socket.data.isLiveGuest);

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
    radioStream?.pauseQueue?.();
  });

  socket.on('host_resume_queue', () => {
    if (!socket.data.isLiveHost) return;
    radioStream?.resumeQueue?.();
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
    radioStream?.setSelectedBackgroundMusicId?.(id);
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