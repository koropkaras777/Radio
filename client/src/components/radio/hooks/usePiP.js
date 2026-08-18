import { useCallback, useEffect, useRef, useState } from 'react';
import { TW_COLORS } from '../utils/theme.js';

export function usePiP({ isNight, activeDayColor, th, tRef, isJoined, currentTrack, isChatMode = false }) {
  const [pipWindow,    setPipWindow]    = useState(null);
  const [pipMountNode, setPipMountNode] = useState(null);
  const pipWindowRef   = useRef(null);
  const isPipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const copyStyles = useCallback((pipWin) => {
    const head = pipWin.document.head;
    head.querySelectorAll('[data-radio-pip-style]').forEach((n) => n.remove());
    Array.from(document.styleSheets).forEach((ss) => {
      try {
        if (ss.href) {
          const link = pipWin.document.createElement('link');
          link.rel  = 'stylesheet';
          link.href = ss.href;
          link.setAttribute('data-radio-pip-style', '1');
          head.appendChild(link);
          return;
        }
        const css = Array.from(ss.cssRules || []).map((r) => r.cssText).join('\n');
        if (!css) return;
        const style = pipWin.document.createElement('style');
        style.setAttribute('data-radio-pip-style', '1');
        style.textContent = css;
        head.appendChild(style);
      } catch {
        if (ss.href) {
          const link = pipWin.document.createElement('link');
          link.rel  = 'stylesheet';
          link.href = ss.href;
          link.setAttribute('data-radio-pip-style', '1');
          head.appendChild(link);
        }
      }
    });
  }, []);

  const applyThemeVars = useCallback((pipWin) => {
    const root = pipWin?.document?.documentElement;
    if (!root) return;
    if (!isNight) {
      const palette = TW_COLORS[activeDayColor] || TW_COLORS.blue;
      Object.entries(palette).forEach(([shade, hex]) => root.style.setProperty(`--brand-${shade}`, hex));
    }
    if (th?.vars) Object.entries(th.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    if (pipWin.document?.body) pipWin.document.body.style.background = 'var(--color-panel)';
  }, [isNight, activeDayColor, th]);

  const closeMiniPlayer = useCallback(() => {
    try { pipWindowRef.current?.close(); } catch {}
    pipWindowRef.current = null;
    setPipWindow(null);
    setPipMountNode(null);
  }, []);

  const openMiniPlayer = useCallback(async () => {
    if (!isPipSupported || !window.documentPictureInPicture?.requestWindow) {
      return tRef.current('miniPlayerUnsupported');
    }
    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.focus();
        return null;
      }

      let pip;
      try {
        pip = await documentPictureInPicture.requestWindow({
          width: 500, height: 180,
          disallowReturnToOpener: false,
          preferInitialWindowPlacement: true,
        });
      } catch (requestErr) {
        console.error('Failed to open mini player (requestWindow):', requestErr?.message || requestErr?.name || requestErr || 'browser refused the request (no reason given)');
        return tRef.current('miniPlayerUnsupported');
      }

      if (!pip || !pip.document) {
        console.error('Failed to open mini player: requestWindow resolved without a usable window');
        return tRef.current('miniPlayerUnsupported');
      }

      pipWindowRef.current = pip;
      setPipWindow(pip);

      try {
        copyStyles(pip);
        applyThemeVars(pip);

        pip.document.title = tRef.current('miniPlayer');
        Object.assign(pip.document.body.style, {
          margin: '0', padding: '0', overflow: 'hidden',
          width: '100%', height: '100%', background: 'var(--color-panel)',
        });

        const mountNode = pip.document.createElement('div');
        mountNode.id = 'radio-pip-root';
        mountNode.style.cssText = 'width:100%;height:100%';
        pip.document.body.innerHTML = '';
        pip.document.body.appendChild(mountNode);
        setPipMountNode(mountNode);

        pip.addEventListener('pagehide', () => {
          if (pipWindowRef.current === pip) {
            pipWindowRef.current = null;
            setPipWindow(null);
            setPipMountNode(null);
          }
        }, { once: true });
      } catch (setupErr) {
        console.error('Failed to configure mini player window (window opened, setup failed):', setupErr?.message || setupErr);
        try { pip.close(); } catch { }
        pipWindowRef.current = null;
        setPipWindow(null);
        setPipMountNode(null);
        return tRef.current('miniPlayerUnsupported');
      }

      return null;
    } catch (err) {
      console.error('Failed to open mini player:', err?.message || err || 'unknown error');
      return tRef.current('miniPlayerUnsupported');
    }
  }, [isPipSupported, tRef, copyStyles, applyThemeVars]);

  useEffect(() => {
    if (!pipWindowRef.current || pipWindowRef.current.closed) return;
    copyStyles(pipWindowRef.current);
    applyThemeVars(pipWindowRef.current);
  }, [copyStyles, applyThemeVars, isNight, activeDayColor]);

  useEffect(() => {
    if (!isJoined || (!currentTrack && !isChatMode)) closeMiniPlayer();
  }, [isJoined, currentTrack, isChatMode, closeMiniPlayer]);

  useEffect(() => () => { try { pipWindowRef.current?.close(); } catch {} }, []);

  return { pipWindow, pipMountNode, isPipSupported, pipWindowRef, openMiniPlayer, closeMiniPlayer };
}