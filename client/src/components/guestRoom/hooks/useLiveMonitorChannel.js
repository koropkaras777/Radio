import { useState, useRef, useEffect, useCallback } from 'react';
import { createLevelMeter } from '../../utils/audioLevel.js';

const MONITOR_STUN_URL = 'stun:stun.l.google.com:19302';
const MIN_PARTICIPANT_VOLUME = 0.08;

/**
 * @param {import('socket.io-client').Socket|null} socket
 * @param {boolean} active - whether this participant is currently live
 * @returns {{ roster: {id:string, login:string, role:string}[], setParticipantVolume: (id:string, value:number)=>void }}
 */
export function useLiveMonitorChannel(socket, active) {
  const [roster, setRoster] = useState([]);
  const [levels, setLevels] = useState({}); 
  const pcRef      = useRef(null);
  const audioElsRef = useRef(new Map());
  const iceQueueRef = useRef([]); 
  const desiredVolumesRef = useRef(new Map()); 
  const trackOwnersRef = useRef([]); 
  const levelMetersRef = useRef(new Map());

  const applyDesiredVolume = useCallback((participantId, audioEl) => {
    const pct = desiredVolumesRef.current.get(participantId) ?? 100;
    const v = Math.max(MIN_PARTICIPANT_VOLUME, Math.min(1, pct / 100));
    audioEl.volume = v;
    audioEl.muted = false;
  }, []);

  const attachParticipantAudio = useCallback((participantId, stream) => {
    let audioEl = audioElsRef.current.get(participantId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElsRef.current.set(participantId, audioEl);
    }
    audioEl.srcObject = stream;
    applyDesiredVolume(participantId, audioEl); 
    audioEl.play().catch((err) => {
      console.warn(`[useLiveMonitorChannel] Autoplay blocked for ${participantId}:`, err);
    });

    levelMetersRef.current.get(participantId)?.stop();
    const meter = createLevelMeter(stream);
    if (meter) levelMetersRef.current.set(participantId, meter);
    else levelMetersRef.current.delete(participantId);
  }, [applyDesiredVolume]);

  const detachParticipantAudio = useCallback((participantId) => {
    const audioEl = audioElsRef.current.get(participantId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      audioElsRef.current.delete(participantId);
    }
    levelMetersRef.current.get(participantId)?.stop();
    levelMetersRef.current.delete(participantId);
  }, []);

  const setParticipantVolume = useCallback((participantId, value) => {
    desiredVolumesRef.current.set(participantId, value);
    const audioEl = audioElsRef.current.get(participantId);
    if (audioEl) applyDesiredVolume(participantId, audioEl);
  }, [applyDesiredVolume]);

  const teardown = useCallback(() => {
    for (const id of [...audioElsRef.current.keys()]) detachParticipantAudio(id);
    for (const meter of levelMetersRef.current.values()) meter.stop();
    levelMetersRef.current.clear();
    try { pcRef.current?.close(); } catch { }
    pcRef.current = null;
    iceQueueRef.current = [];
  }, [detachParticipantAudio]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: MONITOR_STUN_URL }] });
    pc.onicecandidate = (e) => {
      if (e.candidate) socket?.emit('monitor_ice_candidate', e.candidate.toJSON());
    };
    pc.ontrack = (e) => {
      const transceivers = pc.getTransceivers();
      const idx = transceivers.findIndex((tr) => tr.receiver?.track === e.track);
      const ownerId = idx >= 0 ? trackOwnersRef.current[idx] : undefined;
      if (!ownerId) {
        console.warn('[useLiveMonitorChannel] Could not resolve owner for incoming monitor track');
        return;
      }
      const stream = e.streams?.[0] || new MediaStream([e.track]);
      attachParticipantAudio(ownerId, stream);
    };
    return pc;
  }, [socket, attachParticipantAudio]);

  useEffect(() => {
    if (!active || !socket) {
      teardown();
      return;
    }

    const handleOffer = async ({ sdp, trackOwners } = {}) => {
      if (!sdp) return;
      try {
        try { pcRef.current?.close(); } catch { }
        iceQueueRef.current = []; 
        trackOwnersRef.current = Array.isArray(trackOwners) ? trackOwners : [];
        const pc = createPeerConnection();
        pcRef.current = pc;
        await pc.setRemoteDescription(sdp);

        const queued = iceQueueRef.current;
        iceQueueRef.current = [];
        for (const candidate of queued) {
          try { await pc.addIceCandidate(candidate); } catch (err) {
            console.warn('[useLiveMonitorChannel] Queued addIceCandidate failed:', err);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('monitor_answer', { sdp: pc.localDescription });
      } catch (err) {
        console.error('[useLiveMonitorChannel] Failed to handle monitor_offer:', err);
      }
    };

    const handleRemoteIce = async (candidate) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) {
        iceQueueRef.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(candidate); } catch (err) {
        console.warn('[useLiveMonitorChannel] addIceCandidate failed:', err);
      }
    };

    const handleRoster = (list) => {
      const filtered = (Array.isArray(list) ? list : []).filter((p) => p.id !== socket.id);
      setRoster(filtered);
      const liveIds = new Set(filtered.map((p) => p.id));
      for (const id of [...audioElsRef.current.keys()]) {
        if (!liveIds.has(id)) detachParticipantAudio(id);
      }
    };

    socket.on('monitor_offer', handleOffer);
    socket.on('monitor_ice_candidate', handleRemoteIce);
    socket.on('live_hosts_roster', handleRoster);

    return () => {
      socket.off('monitor_offer', handleOffer);
      socket.off('monitor_ice_candidate', handleRemoteIce);
      socket.off('live_hosts_roster', handleRoster);
      teardown();
      setRoster([]);
    };
  }, [active, socket, createPeerConnection, teardown, detachParticipantAudio]);

  // ── Speaking-indicator polling - separate from the signaling effect above ──
  useEffect(() => {
    if (!active) {
      setLevels({});
      return;
    }
    const id = setInterval(() => {
      const next = {};
      for (const [participantId, meter] of levelMetersRef.current) {
        next[participantId] = meter.getLevel();
      }
      setLevels(next);
    }, 120);
    return () => clearInterval(id);
  }, [active]);

  const rosterWithLevels = roster.map((p) => ({ ...p, level: levels[p.id] ?? 0 }));

  return { roster: rosterWithLevels, setParticipantVolume };
}