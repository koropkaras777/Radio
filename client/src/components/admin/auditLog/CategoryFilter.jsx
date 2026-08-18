export function CategoryFilter({ active, onToggle, onReset, categories, t, isNight }) {
  const allActive = active.size === categories.length;
  const chipIdle   = isNight ? 'bg-white/5 border-red-900/40 text-white/60 hover:bg-red-900/20' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10';
  const chipActive = isNight ? 'bg-red-700/40 border-red-600 text-white' : 'bg-blue-600/30 border-blue-500 text-white';

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={onReset}
        className={`px-2.5 py-1 rounded-full border text-[11px] font-black transition-colors ${allActive ? chipActive : chipIdle}`}
      >
        {t('resetLabel')}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.key}
          type="button"
          onClick={() => onToggle(cat.key)}
          className={`px-2.5 py-1 rounded-full border text-[11px] font-black transition-colors ${active.has(cat.key) ? chipActive : chipIdle}`}
        >
          {t(cat.labelKey)}
        </button>
      ))}
    </div>
  );
}