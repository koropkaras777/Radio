import { localizeServerMsg } from '../../../../i18n/serverMessage.js';

// ─── Toast ───────────────────────────────────────────────────────────────────
export function Toast({ notification, lang, t }) {
  if (!notification.message) return null;
  const isError = notification.type === 'error';
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className={`flex items-center gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md ${
        isError ? 'bg-red-950/90 border-red-500/50 text-red-200'
                : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
      }`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black ${
          isError ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {isError ? '!' : '✓'}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase opacity-50 tracking-widest">
            {isError ? t('systemError') : t('success')}
          </span>
          <span className="font-bold text-sm leading-tight">
            {localizeServerMsg(notification.message, lang)}
          </span>
        </div>
      </div>
    </div>
  );
}