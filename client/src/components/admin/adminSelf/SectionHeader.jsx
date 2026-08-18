export function SectionHeader({ label, open, onToggle, locked }) {
  return (
    <button
      onClick={locked ? undefined : onToggle}
      disabled={locked}
      className={`w-full flex items-center justify-between py-3 text-start transition-opacity ${locked ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'}`}
    >
      <span className="text-xs font-black uppercase tracking-widest text-white/70">{label}</span>
      {!locked && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4"/>
        </svg>
      )}
    </button>
  );
}