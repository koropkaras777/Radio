import { accentBtn } from '../shared/theme.js';
import { ALWAYS_ON, PRIV_KEYS } from './adminManageHelpers.js';

export function PrivilegeColumns({ privs, onChange, t, isNight, allPrivileges }) {
  const accentRem = 'bg-white/10 hover:bg-white/20 text-white/60';

  const has    = allPrivileges.filter((p) => privs.includes(p));
  const absent = allPrivileges.filter((p) => !privs.includes(p));

  const label = (p) => (PRIV_KEYS[p] ? t(PRIV_KEYS[p]) : p);

  const toggle = (priv, adding) => {
    if (ALWAYS_ON.has(priv)) return;
    onChange(adding ? [...privs, priv] : privs.filter((p) => p !== priv));
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
      <div>
        <div className="mb-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('hasPriv')}</div>
        <div className="flex flex-col gap-1">
          {has.length === 0 && <span className="text-xs text-white/20">{t('noAdmins')}</span>}
          {has.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs font-bold text-white/80">{label(p)}</span>
              {ALWAYS_ON.has(p)
                ? <span className="text-[9px] text-white/30 font-black">{t('alwaysOn')}</span>
                : <button onClick={() => toggle(p, false)} className={`text-[9px] font-black px-2 py-1 rounded ${accentRem} transition-all`}>–</button>
              }
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('noPriv')}</div>
        <div className="flex flex-col gap-1">
          {absent.length === 0 && <span className="text-xs text-white/20">-</span>}
          {absent.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 opacity-50">
              <span className="text-xs font-bold text-white/60">{label(p)}</span>
              <button onClick={() => toggle(p, true)} className={`text-[9px] font-black px-2 py-1 rounded ${accentBtn(isNight)} text-white transition-all`}>+</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}