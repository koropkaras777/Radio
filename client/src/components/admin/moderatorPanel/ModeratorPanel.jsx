import { useState, useEffect, useCallback } from 'react';
import { pickLocalized } from '../../../i18n/serverMessage.js';
import { t as translate, useNamespace } from '../../../i18n/index.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { BanlistPanel } from './BanlistPanel.jsx';

const DEFAULT_TTL_HOURS = 8;
const BANLIST_PAGE_SIZE = 10;

export function ModeratorPanel({ open, onClose, isNight, lang, showToast, canModerate, socketRef }) {
  const [activeCode, setActiveCode] = useState(null);
  const [ttlHours, setTtlHours]     = useState(DEFAULT_TTL_HOURS);
  const [copied, setCopied]         = useState(false);
  const [busy, setBusy]             = useState(false);

  const [roster, setRoster]         = useState([]);
  const [kickConfirmTarget, setKickConfirmTarget] = useState(null); 
  const [banConfirmTarget, setBanConfirmTarget]   = useState(null); 

  const [banlistOpen, setBanlistOpen]     = useState(false);
  const [banlist, setBanlist]             = useState([]);
  const [banlistTotal, setBanlistTotal]   = useState(0);
  const [banlistLoading, setBanlistLoading] = useState(false);
  const [banlistLoadingMore, setBanlistLoadingMore] = useState(false);
  const [manualBanIp, setManualBanIp]     = useState('');
  const [manualBanNickname, setManualBanNickname] = useState('');

  const t = useNamespace('moderatorPanel', lang);

  const roleLabels = { host: t('roleHost'), guest: t('roleGuest'), specialGuest: t('roleSpecialGuest') };

  useEffect(() => {
    if (!open || !socketRef?.current) return;
    const socket = socketRef.current;

    socket.emit('moderator_get_guest_code', {}, (res) => {
      if (res?.code) setActiveCode({ code: res.code, expiresAt: res.expiresAt });
    });

    const handleCodeUpdated = (payload) => {
      setActiveCode(payload?.code ? { code: payload.code, expiresAt: payload.expiresAt } : null);
    };
    socket.on('guest_code_updated', handleCodeUpdated);

    return () => {
      socket.off('guest_code_updated', handleCodeUpdated);
    };
  }, [open, socketRef]);

  // ── Live participants roster - only while open, moderator-only ─────────────
  useEffect(() => {
    if (!open || !socketRef?.current || !canModerate) {
      setRoster([]);
      return;
    }
    const socket = socketRef.current;

    socket.emit('moderator_get_live_roster', {}, (res) => {
      setRoster(Array.isArray(res?.roster) ? res.roster : []);
    });

    const handleRoster = (list) => setRoster(Array.isArray(list) ? list : []);
    socket.on('live_hosts_roster', handleRoster);

    return () => socket.off('live_hosts_roster', handleRoster);
  }, [open, socketRef, canModerate]);

  const handleGenerate = useCallback(() => {
    setBusy(true);
    socketRef.current?.emit('moderator_generate_guest_code', { ttlHours }, (res) => {
      setBusy(false);
      if (res?.ok) {
        setActiveCode({ code: res.code, expiresAt: res.expiresAt });
      } else {
        showToast?.(pickLocalized(res?.error, lang) || t('generateCodeFailed'), 'error');
      }
    });
  }, [ttlHours, showToast, lang]);

  const handleDeactivate = useCallback(() => {
    setBusy(true);
    socketRef.current?.emit('moderator_deactivate_guest_code', {}, (res) => {
      setBusy(false);
      if (res?.ok) setActiveCode(null);
      else showToast?.(pickLocalized(res?.error, lang) || t('deactivateCodeFailed'), 'error');
    });
  }, [showToast, lang]);

  const handleRegenerate = useCallback(() => {
    setBusy(true);
    socketRef.current?.emit('moderator_regenerate_guest_code', { ttlHours }, (res) => {
      setBusy(false);
      if (res?.ok) setActiveCode({ code: res.code, expiresAt: res.expiresAt });
      else showToast?.(pickLocalized(res?.error, lang) || t('regenerateCodeFailed'), 'error');
    });
  }, [ttlHours, showToast, lang]);

  const handleCopy = useCallback(() => {
    if (!activeCode?.code) return;
    navigator.clipboard?.writeText(activeCode.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeCode]);

  // ── Mute / kick - any live participant, host included ────────
  const handleToggleMute = useCallback((targetId, currentlyMuted) => {
    socketRef?.current?.emit('moderator_mute', { targetId, muted: !currentlyMuted }, (res) => {
      if (!res?.ok) showToast?.(pickLocalized(res?.error, lang) || t('muteActionFailed'), 'error');
    });
  }, [socketRef, showToast, lang]);

  const handleKickClick = useCallback((targetId, login) => {
    setKickConfirmTarget({ id: targetId, login });
  }, []);

  const confirmKick = useCallback(() => {
    if (!kickConfirmTarget) return;
    socketRef?.current?.emit('moderator_kick', { targetId: kickConfirmTarget.id }, (res) => {
      if (!res?.ok) showToast?.(pickLocalized(res?.error, lang) || t('kickFailed'), 'error');
    });
    setKickConfirmTarget(null);
  }, [kickConfirmTarget, socketRef, showToast, lang]);

  const handleBanClick = useCallback((targetId, login) => {
    setBanConfirmTarget({ id: targetId, login });
  }, []);

  const confirmBan = useCallback(() => {
    if (!banConfirmTarget) return;
    socketRef?.current?.emit('moderator_ban_participant', { targetId: banConfirmTarget.id }, (res) => {
      if (!res?.ok) showToast?.(pickLocalized(res?.error, lang) || t('banFailed'), 'error');
    });
    setBanConfirmTarget(null);
  }, [banConfirmTarget, socketRef, showToast, lang]);

  // ── Banlist (lazy-loaded, 10 at a time) ─────────────────────────────────────
  const loadBanlist = useCallback(() => {
    setBanlistLoading(true);
    socketRef?.current?.emit('moderator_get_banlist', { offset: 0, limit: BANLIST_PAGE_SIZE }, (res) => {
      setBanlistLoading(false);
      setBanlist(Array.isArray(res?.list) ? res.list : []);
      setBanlistTotal(Number(res?.total) || 0);
    });
  }, [socketRef]);

  const loadMoreBanlist = useCallback(() => {
    setBanlistLoadingMore(true);
    socketRef?.current?.emit('moderator_get_banlist', { offset: banlist.length, limit: BANLIST_PAGE_SIZE }, (res) => {
      setBanlistLoadingMore(false);
      setBanlist((prev) => [...prev, ...(Array.isArray(res?.list) ? res.list : [])]);
      setBanlistTotal(Number(res?.total) || 0);
    });
  }, [socketRef, banlist.length]);

  const openBanlist = useCallback(() => {
    setBanlistOpen(true);
    loadBanlist();
  }, [loadBanlist]);

  const handleUnban = useCallback((ip) => {
    socketRef?.current?.emit('moderator_unban_ip', { ip }, (res) => {
      if (res?.ok) loadBanlist();
      else showToast?.(pickLocalized(res?.error, lang) || t('unbanFailed'), 'error');
    });
  }, [socketRef, loadBanlist, showToast, lang]);

  const handleManualBan = useCallback(() => {
    const ip = manualBanIp.trim();
    if (!ip) return;
    socketRef?.current?.emit('moderator_ban_ip', { ip, nickname: manualBanNickname.trim() }, (res) => {
      if (res?.ok) {
        setManualBanIp('');
        setManualBanNickname('');
        loadBanlist();
      } else {
        showToast?.(pickLocalized(res?.error, lang) || t('banFailed'), 'error');
      }
    });
  }, [manualBanIp, manualBanNickname, socketRef, loadBanlist, showToast, lang]);

  if (!open) return null;

  const accentBg = isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500';
  const cardBg   = isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10';
  const selfId   = socketRef?.current?.id;

  const remainingMinutes = activeCode?.expiresAt
    ? Math.max(0, Math.round((activeCode.expiresAt - Date.now()) / 60_000))
    : null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 ${cardBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {banlistOpen ? (
          <BanlistPanel
            t={t}
            onBack={() => setBanlistOpen(false)}
            onClose={onClose}
            banlist={banlist}
            banlistTotal={banlistTotal}
            banlistLoading={banlistLoading}
            banlistLoadingMore={banlistLoadingMore}
            onLoadMore={loadMoreBanlist}
            onUnban={handleUnban}
            manualBanIp={manualBanIp}
            onManualBanIpChange={setManualBanIp}
            manualBanNickname={manualBanNickname}
            onManualBanNicknameChange={setManualBanNickname}
            onManualBan={handleManualBan}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-sm font-black uppercase tracking-wider ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{translate('adminPanel.moderatorPanelBtn', {}, lang)}</h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <section className="mb-6">
              <h3 className="text-xs font-black uppercase tracking-wide text-gray-400 mb-3">{t('codeSection')}</h3>

              {!activeCode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={ttlHours}
                    onChange={(e) => setTtlHours(Math.max(1, Math.min(72, Number(e.target.value) || DEFAULT_TTL_HOURS)))}
                    className="w-20 rounded-lg bg-gray-900/60 border border-white/10 px-2 py-2 text-sm text-white text-center"
                    title={t('ttlLabel')}
                  />
                  <span className="text-xs text-gray-400">{t('ttlLabel')}</span>
                  <button
                    onClick={handleGenerate}
                    disabled={busy}
                    className={`ms-auto px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${accentBg} text-white`}
                  >
                    {t('generate')}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 rounded-lg bg-gray-900/60 border border-white/10 px-3 py-2 text-sm text-white font-mono truncate">
                      {activeCode.code}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-700 hover:bg-gray-600 text-gray-200 transition-all active:scale-95"
                    >
                      {copied ? t('copied') : t('copy')}
                    </button>
                  </div>
                  {remainingMinutes != null && (
                    <div className="text-xs text-gray-400 mb-3">{t('expiresIn', { count: remainingMinutes })}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeactivate}
                      disabled={busy}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-red-300 border border-red-800/50 hover:bg-red-900/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {t('deactivate')}
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={busy}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${accentBg} text-white`}
                    >
                      {t('regenerate')}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {canModerate && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wide text-gray-400">{t('moderationSection')}</h3>
                  <button
                    onClick={openBanlist}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-700 hover:bg-gray-600 text-gray-200 transition-all active:scale-95"
                  >
                    {t('banlist')}
                  </button>
                </div>

                {roster.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">{t('noParticipants')}</p>
                ) : (
                  <div className="space-y-2">
                    {roster.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="shrink-0" aria-hidden="true">🟢</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{p.login}</div>
                          <div className="text-[10px] text-gray-500">{roleLabels[p.role] || p.role}</div>
                        </div>
                        {p.id !== selfId && (
                          <>
                            <button
                              onClick={() => handleToggleMute(p.id, p.muted)}
                              title={p.muted ? t('unmute') : t('mute')}
                              aria-label={p.muted ? t('unmute') : t('mute')}
                              className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-all active:scale-95 ${
                                p.muted ? 'bg-yellow-700' : 'bg-gray-700 hover:bg-gray-600'
                              }`}
                            >
                              {p.muted ? '🔇' : '🔊'}
                            </button>
                            <button
                              onClick={() => handleKickClick(p.id, p.login)}
                              title={t('kick')}
                              aria-label={t('kick')}
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm bg-red-900/40 hover:bg-red-900/70 transition-all active:scale-95"
                            >
                              ❌
                            </button>
                            {p.role === 'guest' && (
                              <button
                                onClick={() => handleBanClick(p.id, p.login)}
                                title={t('ban')}
                                aria-label={t('ban')}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm bg-red-950 hover:bg-red-900 transition-all active:scale-95"
                              >
                                🚫
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!kickConfirmTarget}
        isNight={isNight}
        zIndex={500}
        title={t('kickConfirm', { name: kickConfirmTarget?.login })}
        body=""
        yesLabel={t('kickConfirmYes')}
        noLabel={t('kickConfirmNo')}
        yesClassName="bg-red-700 hover:bg-red-600"
        onYes={confirmKick}
        onNo={() => setKickConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!banConfirmTarget}
        isNight={isNight}
        zIndex={500}
        title={t('banConfirm', { name: banConfirmTarget?.login })}
        body=""
        yesLabel={t('banConfirmYes')}
        noLabel={t('banConfirmNo')}
        yesClassName="bg-red-950 hover:bg-red-900"
        onYes={confirmBan}
        onNo={() => setBanConfirmTarget(null)}
      />
    </div>
  );
}