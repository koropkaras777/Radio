import { createPortal } from 'react-dom';

// ─── SelectionContextMenu ───────────────────────────────────────────────────
export function SelectionContextMenu({ isNight, t, x, y, onSelect, onSelectAll, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[450]"
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div
        className={`absolute rounded-xl border shadow-2xl overflow-hidden min-w-[140px] ${
          isNight ? 'border-red-900/40 bg-[#1a0505]' : 'border-white/10 bg-gray-800'
        }`}
        style={{ top: y, left: x }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onSelect}
          className="block w-full text-start px-4 py-2.5 text-xs font-black text-white hover:bg-white/10 transition-all"
        >
          {t('ctxSelect')}
        </button>
        <button
          onClick={onSelectAll}
          className="block w-full text-start px-4 py-2.5 text-xs font-black text-white hover:bg-white/10 transition-all border-t border-white/10"
        >
          {t('ctxSelectAll')}
        </button>
      </div>
    </div>,
    document.body
  );
}