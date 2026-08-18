const RING_RADIUS        = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ProgressRing({ progress, success, failed, skipped }) {
  if (success) {
    return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 text-xl font-black text-emerald-400">+</div>;
  }
  if (failed) {
    return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-red-500 text-xl font-black text-red-400">−</div>;
  }
  if (skipped) {
    return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/20 text-xl font-black text-white/30">○</div>;
  }

  const normalized = Math.max(0, Math.min(100, Number(progress) || 0));
  const dashOffset = RING_CIRCUMFERENCE - (normalized / 100) * RING_CIRCUMFERENCE;

  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={RING_RADIUS} className="fill-none stroke-white/10" strokeWidth="4" />
        <circle cx="24" cy="24" r={RING_RADIUS} className="fill-none stroke-white" strokeWidth="4"
          strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={dashOffset} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white">
        {normalized}%
      </div>
    </div>
  );
}