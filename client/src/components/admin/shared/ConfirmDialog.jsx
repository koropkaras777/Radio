import { createPortal } from 'react-dom';
import { accentBtn, accentPanel } from './theme.js';

// ─── ConfirmDialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({
  open = true,
  isNight,
  title,
  body,
  text,
  yesLabel,
  noLabel,
  yesClassName,
  working = false,
  zIndex = 500,
  onYes,
  onNo,
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      style={{ zIndex }}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl flex flex-col gap-4 ${accentPanel(isNight)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-black text-white">{title}</div>
        <div className="text-xs text-white/60 leading-relaxed">{body ?? text}</div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onNo}
            disabled={working}
            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-white/10 hover:bg-white/15 disabled:opacity-40 transition-all"
          >
            {noLabel}
          </button>
          <button
            onClick={onYes}
            disabled={working}
            className={`px-4 py-2 rounded-xl text-xs font-black text-white disabled:opacity-40 transition-all ${yesClassName ?? accentBtn(isNight)}`}
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}