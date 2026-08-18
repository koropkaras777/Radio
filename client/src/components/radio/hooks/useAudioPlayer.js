import { useEffect, useRef } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { EncryptedAudioPlayer } from '../utils/encryptedAudio.js';

export function useAudioPlayer({
  audioRef,
  currentTrack,
  isJoined,
  artToken,
  listenerUid,
  serverIsPlayingRef,
  lastServerSeekRef,
  initialServerSeekRef,
  hasInitialSyncedRef,
  isPausedRef,
}) {
  const playerRef = useRef(null);

  useEffect(() => {
    if (playerRef.current && artToken) {
      playerRef.current.keyMgr.artToken = artToken;
    }
  }, [artToken]);

  useEffect(() => {
    if (!isJoined || !audioRef.current || !currentTrack || !artToken || !listenerUid) return;

    const existing = playerRef.current;
    if (existing && existing._trackId === currentTrack) {
      existing.keyMgr.artToken = artToken;
      return;
    }

    const player = new EncryptedAudioPlayer(audioRef.current, SERVER_URL, artToken, listenerUid);
    if (playerRef.current) playerRef.current.destroy();
    playerRef.current = player;

    const shouldAutoplay = serverIsPlayingRef.current && !isPausedRef.current;
    const targetSeek     = lastServerSeekRef.current ?? initialServerSeekRef.current ?? 0;

    player.load(currentTrack, targetSeek)
      .then(() => {
        if (playerRef.current !== player) return;
        hasInitialSyncedRef.current = true;
        if (shouldAutoplay) {
          audioRef.current?.play().catch((e) => console.error('Play error:', e));
        } else {
          audioRef.current?.pause();
        }
      })
      .catch((e) => {
        if (playerRef.current === player) console.error('[EncryptedAudio] Load error:', e);
      });

    return () => {
      if (playerRef.current === player) {
        player.destroy();
        playerRef.current = null;
      } else {
        player.destroy();
      }
    };
  }, [currentTrack, isJoined, artToken, listenerUid]);

  return playerRef;
}