import { useCallback, useEffect, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { accentPanel, inputBorder, accentBtn } from '../shared/theme.js';
import { WindowSelect } from '../auditLog/WindowSelect.jsx';
import { CurrencySelect } from './CurrencySelect.jsx';
import { formatDateHeader, formatTime, isSameDay } from '../auditLog/auditDateHelpers.js';

const compactInput = 'w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none';

const WINDOWS = [
  { key: '24h', labelKey: 'window24h' },
  { key: '7d',  labelKey: 'window7d'  },
  { key: '30d', labelKey: 'window30d' },
  { key: 'max', labelKey: 'windowMax' },
];

export function DonationSettingsModal({ open, onClose, isNight, lang = 'uk', showToast, radioHostsMode = false }) {
  const t = useNamespace('donationSettings', lang);

  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [provider, setProvider]   = useState(null);
  const [form, setForm]           = useState(null);
  const [historyCurrencies, setHistoryCurrencies] = useState([]);

  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyTotal, setHistoryTotal]     = useState(0);
  const [historyWindow, setHistoryWindow]   = useState('7d');
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/donations/settings`, {}, lang);
      setProvider(data.provider);
      setForm(data.settings);
      setHistoryCurrencies(data.historyCurrencies || []);
    } catch (err) {
      showToast?.(err.message || t('loadError'), 'error');
    }
    setLoading(false);
  }, [lang, showToast, t]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/donations/history?window=${historyWindow}&limit=50`, {}, lang);
      setHistoryEntries(data.entries);
      setHistoryTotal(data.total);
    } catch (err) {
      showToast?.(err.message || t('historyLoadError'), 'error');
    }
    setHistoryLoading(false);
  }, [historyWindow, lang, showToast, t]);

  useEffect(() => { if (open && activeTab === 'history') fetchHistory(); }, [open, activeTab, fetchHistory]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/donations/settings`, {
        method: 'POST',
        body: JSON.stringify(form),
      }, lang);
      setForm(data.settings);
      showToast?.(data.clamped ? t('savedClamped') : t('saved'), 'success');
    } catch (err) {
      showToast?.(err.message || t('saveError'), 'error');
    }
    setSaving(false);
  }, [form, lang, showToast, t]);

  if (!open) return null;

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[85vh] ${accentPanel(isNight)}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <h2 className={`text-sm font-black uppercase tracking-wider ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{t('title')}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex gap-1.5 px-6 pt-3 shrink-0">
          {['settings', 'history'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-black transition-colors ${activeTab === tab ? (isNight ? 'bg-red-700/40 border-red-600 text-white' : 'bg-blue-600/30 border-blue-500 text-white') : (isNight ? 'bg-white/5 border-red-900/40 text-white/60 hover:bg-red-900/20' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10')}`}
            >
              {t(tab === 'settings' ? 'tabSettings' : 'tabHistory')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {activeTab === 'settings' ? (
            loading || !form ? (
              <div className="py-16 text-center text-xs text-white/30 font-black uppercase">{t('loading')}</div>
            ) : !provider ? (
              <div className="py-16 text-center text-xs text-white/50 font-bold">{t('providerInactive')}</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-black text-gray-300 mb-1">{t('providerLabel')}</div>
                  <div className={`${compactInput} ${inputBorder(isNight)} opacity-70`}>{provider.displayName}</div>
                </div>

                <label className="block">
                  <div className="text-[11px] font-black text-gray-300 mb-1">{t('currencyLabel')}</div>
                  <CurrencySelect
                    value={form.currency}
                    onChange={(c) => field('currency', c)}
                    options={[...new Set([...historyCurrencies, ...provider.supportedCurrencies, form.currency].filter(Boolean))].sort()}
                    isNight={isNight}
                  />
                </label>

                <div className="flex gap-2">
                  {['fixed', 'calculated'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => field('pricingMode', mode)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black text-white uppercase transition-all ${form.pricingMode === mode ? accentBtn(isNight) : 'opacity-30 bg-white/10'}`}
                    >
                      {t(mode === 'fixed' ? 'pricingFixed' : 'pricingCalculated')}
                    </button>
                  ))}
                </div>

                {form.pricingMode === 'fixed' ? (
                  <label className="block">
                    <div className="text-[11px] font-black text-gray-300 mb-1">{t('fixedPriceLabel')}</div>
                    <input type="number" min="0.01" step="0.01" className={`${compactInput} ${inputBorder(isNight)}`}
                      value={form.fixedPrice} onChange={(e) => field('fixedPrice', Number(e.target.value))} />
                  </label>
                ) : (
                  <label className="block">
                    <div className="text-[11px] font-black text-gray-300 mb-1">{t('pricePerSecondLabel')}</div>
                    <input type="number" min="0.001" step="0.001" className={`${compactInput} ${inputBorder(isNight)}`}
                      value={form.pricePerSecond} onChange={(e) => field('pricePerSecond', Number(e.target.value))} />
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.tiersEnabled} onChange={(e) => field('tiersEnabled', e.target.checked)} className="w-4 h-4" />
                  <span className="text-[11px] font-black text-gray-300">{t('tiersEnabledLabel')}</span>
                </label>

                {form.tiersEnabled && (
                  <label className="block">
                    <div className="text-[11px] font-black text-gray-300 mb-1">{t('tierCeilingLabel')}</div>
                    <input type="number" min="2" max="10" className={`${compactInput} ${inputBorder(isNight)}`}
                      value={form.tierCeiling} onChange={(e) => field('tierCeiling', Number(e.target.value))} />
                  </label>
                )}

                {radioHostsMode && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.blockDonationsWhileChatting} onChange={(e) => field('blockDonationsWhileChatting', e.target.checked)} className="w-4 h-4" />
                    <span className="text-[11px] font-black text-gray-300">{t('blockWhileChattingLabel')}</span>
                  </label>
                )}

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className={`w-full py-2.5 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all disabled:opacity-40 ${accentBtn(isNight)}`}
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <WindowSelect value={historyWindow} onChange={setHistoryWindow} windows={WINDOWS} t={t} isNight={isNight} />
              {historyLoading ? (
                <div className="py-16 text-center text-xs text-white/30 font-black uppercase">{t('loading')}</div>
              ) : historyEntries.length === 0 ? (
                <div className="py-16 text-center text-xs text-white/30 font-black uppercase">{t('empty')}</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {historyEntries.map((entry, idx) => {
                    const prev = historyEntries[idx - 1];
                    const showHeader = !prev || !isSameDay(prev.createdAt, entry.createdAt);
                    return (
                      <div key={entry.id}>
                        {showHeader && (
                          <div className={`text-[10px] font-black uppercase tracking-widest mt-4 mb-2 first:mt-0 ${isNight ? 'text-red-900/80' : 'text-white/25'}`}>
                            {formatDateHeader(entry.createdAt, t)}
                          </div>
                        )}
                        <div className="flex gap-2 items-baseline text-[12px] leading-relaxed py-0.5 px-2">
                          <span className="shrink-0 font-mono text-white/30 text-[10px] w-10">{formatTime(entry.createdAt)}</span>
                          <span className="text-white/70">
                            {t('historyEntry', { title: entry.songTitle, artist: entry.songArtist, amount: entry.amount, currency: entry.currency, status: t(`status_${entry.status}`) })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {historyEntries.length < historyTotal && (
                    <div className="text-center text-[10px] text-white/30 font-bold pt-2">{t('historyTruncated', { total: historyTotal })}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
