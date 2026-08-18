// ─── GuestQueueList ───────────────────────────────────────────────────────────
export function GuestQueueList({ t, accentBg, guestQueue, queueBusyUid, onAction }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold text-gray-400 mb-2 px-1">{t('guestQueue')}</div>
      {guestQueue.length === 0 ? (
        <p className="text-xs text-gray-500 italic px-1">{t('noGuestQueue')}</p>
      ) : (
        <div className="space-y-2">
          {guestQueue.map((req) => (
            <div key={req.uid} className="flex items-center gap-2 px-1">
              <span className="text-xs font-bold text-white truncate flex-1">{req.nickname}</span>
              <button
                onClick={() => onAction(req.uid, 'accept')}
                disabled={queueBusyUid === req.uid}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50 ${accentBg} text-white`}
              >
                {t('accept')}
              </button>
              <button
                onClick={() => onAction(req.uid, 'reject')}
                disabled={queueBusyUid === req.uid}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-300 border border-red-800/50 hover:bg-red-900/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {t('reject')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}