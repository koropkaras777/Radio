// ─── OrderBadge ──────────────────────────────────────────────────────────────
const ORDER_BADGE = {
  donated:    { bg: 'bg-green-500',  label: (t, tier) => tier ? t('donateTier', { tier }) : t('donate') },
  lastinline: { bg: 'bg-violet-500', label: (t) => t('regular') },
};

export function OrderBadge({ orderType, tier, t }) {
  const cfg = ORDER_BADGE[orderType];
  if (!cfg) return null;
  return (
    <span className={`flex-shrink-0 ${cfg.bg} text-white text-[8px] px-1.5 py-0.5 rounded font-black border border-white/10`}>
      {cfg.label(t, tier)}
    </span>
  );
}