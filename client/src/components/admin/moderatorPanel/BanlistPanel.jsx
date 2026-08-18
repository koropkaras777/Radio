// ─── BanlistPanel ────────────────────────────────────────────────────────────
export function BanlistPanel({
  t,
  onBack,
  onClose,
  banlist,
  banlistTotal,
  banlistLoading,
  banlistLoadingMore,
  onLoadMore,
  onUnban,
  manualBanIp,
  onManualBanIpChange,
  manualBanNickname,
  onManualBanNicknameChange,
  onManualBan,
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <span className="rtl:-scale-x-100">←</span> {t('back')}
        </button>
        <h2 className="text-lg font-black text-white">{t('banlistTitle')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">×</button>
      </div>

      <section className="mb-5">
        {banlistLoading ? (
          <p className="text-xs text-gray-500 italic">{t('banlistLoading')}</p>
        ) : banlist.length === 0 ? (
          <p className="text-xs text-gray-500 italic">{t('banlistEmpty')}</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
            {banlist.map((entry) => (
              <div key={entry.ip} className="flex items-center gap-2 rounded-lg bg-gray-900/40 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {entry.nickname ? `${entry.nickname} - ` : ''}{entry.ip}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">{t('bannedBy', { login: entry.bannedBy || '-' })}</div>
                </div>
                <button
                  onClick={() => onUnban(entry.ip)}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-300 border border-red-800/50 hover:bg-red-900/20 transition-all active:scale-95"
                >
                  {t('unban')}
                </button>
              </div>
            ))}
            {banlist.length < banlistTotal && (
              <button
                onClick={onLoadMore}
                disabled={banlistLoadingMore}
                className="w-full py-2 rounded-lg text-[11px] font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-all active:scale-95 disabled:opacity-50"
              >
                {banlistLoadingMore ? t('banlistLoading') : t('banlistLoadMore', { count: banlistTotal - banlist.length })}
              </button>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-black uppercase tracking-wide text-gray-400 mb-3">{t('manualBanTitle')}</h3>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={manualBanIp}
            onChange={(e) => onManualBanIpChange(e.target.value)}
            placeholder={t('ipPlaceholder')}
            className="rounded-lg bg-gray-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 font-mono"
          />
          <input
            type="text"
            value={manualBanNickname}
            onChange={(e) => onManualBanNicknameChange(e.target.value)}
            placeholder={t('nicknamePlaceholder')}
            className="rounded-lg bg-gray-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <button
            onClick={onManualBan}
            disabled={!manualBanIp.trim()}
            className="py-2 rounded-lg text-xs font-bold text-white bg-red-700 hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {t('addBan')}
          </button>
        </div>
      </section>
    </>
  );
}