import { auditSection, fieldLabel, formatAuditValue, sectionLabel } from './auditDetails.js';

export function AuditDetails({ data, lang, t }) {
  const changes = data.details?.changes || [];
  const groups = new Map();
  for (const change of changes) {
    const section = auditSection(change.field) || '';
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(change);
  }
  const value = (raw, field) => formatAuditValue(raw, field, lang, t);
  return (
    <div className="ms-12 my-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80 space-y-4">
      {[...groups].map(([section, items]) => (
        <div key={section} className="space-y-3">
          {section && <h4 className="font-black text-white">{sectionLabel(section, t)}</h4>}
          {items.map((change) => (
            <div key={change.field} className="space-y-1">
              <div className="font-bold text-white/90">{fieldLabel(change.field, lang)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {['before', 'after'].map((side) => (
                  <div key={side} className="min-w-0 rounded-lg bg-white/5 p-2">
                    <div className="mb-1 font-bold text-white/50">{t(side)}</div>
                    <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">{value(change[side], change.field)}</div>
                  </div>
                ))}
              </div>
              {Array.isArray(change.before) && Array.isArray(change.after) && !change.field.endsWith('songs') && (
                <div className="whitespace-pre-wrap break-words text-white/60">
                  {t('added')}: {value(change.after.filter((item) => !change.before.includes(item)), change.field)}{'\n'}
                  {t('removed')}: {value(change.before.filter((item) => !change.after.includes(item)), change.field)}
                </div>
              )}
              {change.field === 'songs' && Array.isArray(change.before) && Array.isArray(change.after) && (
                <div className="whitespace-pre-wrap break-words text-white/60">
                  {t('added')}: {value(change.after.filter((item) => !change.before.includes(item)), 'songs')}{'\n'}
                  {t('removed')}: {value(change.before.filter((item) => !change.after.includes(item)), 'songs')}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {Object.entries(data.details?.info || {}).filter(([key, raw]) => key !== 'clamped' || raw).map(([field, raw]) => (
        <div key={field}>
          <span className="font-bold text-white/60">{fieldLabel(field, lang)}: </span>
          <span className="whitespace-pre-wrap break-words">{value(raw, field)}</span>
        </div>
      ))}
    </div>
  );
}
