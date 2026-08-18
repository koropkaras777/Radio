import { useState, useRef, useCallback, useEffect } from 'react';
import { createLevelMeter } from '../../utils/audioLevel.js';
import { createWindFilteredStream, MIC_RECORDER_BITS_PER_SECOND } from '../../utils/micProcessing.js';

const MIC_CONSTRAINTS = { audio: { echoCancellation: true, autoGainControl: true, noiseSuppression: true, channelCount: 1 } };
const MIC_RECORDER_MIME_TYPE = 'audio/webm;codecs=opus';
const MIC_RECORDER_TIMESLICE_MS = 250;

/**
 * @param {import('socket.io-client').Socket|null} socket
 * @param {(msg: string) => void} [onMicDenied] optional toast callback
 */
export function useLiveMicCapture(socket, onMicDenied) {
  const [micOn, setMicOn]       = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const micStreamRef     = useRef(null);
  const processedMicRef  = useRef(null);
  const mediaRecorderRef = useRef(null);
  const micMeterRef      = useRef(null);

  const ensureMicAccess = useCallback(async () => {
    if (micStreamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });
      micStreamRef.current = stream;
      processedMicRef.current?.stop();
      processedMicRef.current = createWindFilteredStream(stream);
      micMeterRef.current?.stop();
      micMeterRef.current = createLevelMeter(stream);
      setMicDenied(false);
      return true;
    } catch (err) {
      console.error('[useLiveMicCapture] getUserMedia denied:', err);
      setMicDenied(true);
      onMicDenied?.();
      return false;
    }
  }, [onMicDenied]);

  const startCapture = useCallback(() => {
    if (!micStreamRef.current || !socket || mediaRecorderRef.current) return;
    if (!window.MediaRecorder?.isTypeSupported?.(MIC_RECORDER_MIME_TYPE)) return;
    try {
      const recorder = new MediaRecorder(processedMicRef.current?.stream ?? micStreamRef.current, {
        mimeType: MIC_RECORDER_MIME_TYPE,
        audioBitsPerSecond: MIC_RECORDER_BITS_PER_SECOND,
      });
      recorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        e.data.arrayBuffer().then((buf) => socket.emit('host_audio_chunk', buf));
      };
      recorder.start(MIC_RECORDER_TIMESLICE_MS);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('[useLiveMicCapture] MediaRecorder failed to start:', err);
    }
  }, [socket]);

  const stopCapture = useCallback(() => {
    try { mediaRecorderRef.current?.stop(); } catch { }
    mediaRecorderRef.current = null;
  }, []);

  const toggleMic = useCallback(() => {
    if (!micStreamRef.current) return;
    setMicOn((prev) => {
      const next = !prev;
      micStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = next; });
      socket?.emit('host_mic_toggle', { on: next });
      if (next) startCapture(); else stopCapture();
      return next;
    });
  }, [socket, startCapture, stopCapture]);

  const releaseMic = useCallback(() => {
    stopCapture();
    processedMicRef.current?.stop();
    processedMicRef.current = null;
    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    micStreamRef.current = null;
    micMeterRef.current?.stop();
    micMeterRef.current = null;
    setMicOn(false);
  }, [stopCapture]);

  useEffect(() => () => releaseMic(), [releaseMic]);

  // ── Own-mic level polling - "your mic is picking up sound" indicator ───────
  useEffect(() => {
    if (!micOn) {
      setMicLevel(0);
      return;
    }
    const id = setInterval(() => {
      setMicLevel(micMeterRef.current?.getLevel() ?? 0);
    }, 120);
    return () => clearInterval(id);
  }, [micOn]);

  return { micOn, micDenied, micLevel, ensureMicAccess, toggleMic, releaseMic };
}