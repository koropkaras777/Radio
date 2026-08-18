// ─── FormField ───────────────────────────────────────────────────────────────
const compactInput = 'w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none';

export const FormField = ({ label, value, onChange, inputBorder, colSpan }) => (
  <label className={`space-y-1${colSpan ? ` ${colSpan}` : ''}`}>
    <div className="text-[11px] font-black text-gray-300">{label}</div>
    <input
      type="text"
      className={`${compactInput} ${inputBorder}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);