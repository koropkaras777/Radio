import { useEffect, useRef, useState } from 'react';
import { SERVER_URL } from '../../config/constants.js';
import { pickLocalized } from '../../i18n/serverMessage.js';

const STATUS_POLL_MS = 5000;

export function DonatePopover({ song, lang, t, th, onClose }) {
  const [loading, setLoading]     = useState(true);
  const [errorMsg, setErrorMsg]   = useState('');
  const [tiersData, setTiersData] = useState(null);
  const [paying, setPaying]       = useState(false);
  const [pending, setPending]     = useState(null); // { donationId, flowType, pageUrl, matchCode, amount, currency, expiresAt }
  const [finalStatus, setFinalStatus] = useState(null); // 'paid' | 'paid_unqueued' | 'failed' | 'expired'
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg('');

    fetch(`${SERVER_URL}/api/public/donations/tiers?songId=${encodeURIComponent(song.id)}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) { setErrorMsg(pickLocalized(data.error, lang) || t('donateError')); return; }
        setTiersData(data);
      })
      .catch(() => { if (!cancelled) setErrorMsg(t('donateError')); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [song.id, lang, t]);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  const pollStatus = (donationId) => {
    fetch(`${SERVER_URL}/api/public/donations/${donationId}/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.status === 'pending') {
          pollRef.current = setTimeout(() => pollStatus(donationId), STATUS_POLL_MS);
        } else {
          setFinalStatus(data.status);
        }
      })
      .catch(() => { pollRef.current = setTimeout(() => pollStatus(donationId), STATUS_POLL_MS); });
  };

  const pay = async (tier) => {
    setPaying(true);
    setErrorMsg('');
    try {
      const res  = await fetch(`${SERVER_URL}/api/public/donations/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: song.id, tier }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(pickLocalized(data.error, lang) || t('donateError')); setPaying(false); return; }

      if (data.flowType === 'matching') {
        setPending(data);
        window.open(data.pageUrl, '_blank', 'noopener');
        pollRef.current = setTimeout(() => pollStatus(data.donationId), STATUS_POLL_MS);
      } else {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setErrorMsg(t('donateError'));
      setPaying(false);
    }
  };

  return (
    <div
      className={`absolute bottom-full end-0 mb-2 w-64 rounded-xl p-3 shadow-2xl border z-50 ${th.borderToast} ${th.text}`}
      style={{ backgroundColor: th.bgToast }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black uppercase">{t('donateTitle')}</span>
        <button onClick={onClose} className="opacity-60 hover:opacity-100">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>

      {finalStatus ? (
        <div className="text-[11px] py-2">
          {finalStatus === 'paid' ? t('donateMatchPaid')
            : finalStatus === 'paid_unqueued' ? t('donateFailed', { title: song.title })
            : finalStatus === 'expired' ? t('donateMatchExpired')
            : t('donateMatchFailed')}
        </div>
      ) : pending ? (
        <div className="flex flex-col gap-2 text-[11px]">
          <div>{t('donateMatchInstructions', { amount: pending.amount, currency: pending.currency })}</div>
          <a href={pending.pageUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline break-all">{pending.pageUrl}</a>
          <div className="text-center">
            <div className="opacity-60">{t('donateMatchCodeLabel')}</div>
            <div className="text-lg font-black tracking-widest select-all">{pending.matchCode}</div>
          </div>
          <div className="opacity-60">{t('donateMatchWaiting')}</div>
        </div>
      ) : loading ? (
        <div className="text-[11px] opacity-60 py-2">{t('donateLoading')}</div>
      ) : errorMsg ? (
        <div className="text-[11px] text-red-400 py-2">{errorMsg}</div>
      ) : tiersData.chattingBlocked ? (
        <div className="text-[11px] opacity-80 py-2">{t('donateChattingBlocked')}</div>
      ) : !tiersData.tiers.length ? (
        <div className="text-[11px] opacity-80 py-2">{t('donateUnavailable')}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tiersData.flowType === 'matching' && (
            <div className="text-[10px] opacity-60 mb-0.5">{t('donateMatchHint')}</div>
          )}
          {tiersData.tiers.map(({ tier, price }) => (
            <button
              key={tier}
              disabled={paying}
              onClick={() => pay(tier)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-green-600 hover:bg-green-500 text-white transition-all active:scale-95 disabled:opacity-40"
            >
              <span>{tiersData.tiersEnabled ? t('donateTierLabel', { tier }) : t('donateBtn')}</span>
              <span>{price} {tiersData.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
