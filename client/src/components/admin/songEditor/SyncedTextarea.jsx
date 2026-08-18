import { useEffect, useRef, useState } from 'react';
import { SYNCED_RE, parseSyncedLine, parseTimecodeOnly, normalizeText } from './songEditorUtils.js';

const MARKER_COLOR = '#f59e0b';

// ─── SyncedTextarea ───────────────────────────────────────────────────────────
export function SyncedTextarea({ value, onChange, isNight, onJumpToTime, t }) {
  const lines = normalizeText(value).split('\n');
  const accentTC = isNight ? '#f87171' : '#60a5fa';

  const [editingTcIndex, setEditingTcIndex] = useState(null);
  const [editingTcValue, setEditingTcValue] = useState('');
  const [focusPending,   setFocusPending]   = useState(null);

  const inputRefs = useRef({});

  useEffect(() => {
    if (focusPending === null) return;
    const el = inputRefs.current[focusPending];
    if (el) { el.focus(); el.setSelectionRange(0, 0); }
    setFocusPending(null);
  }, [focusPending, lines.length]);

  const handleLineChange = (index, newLine) => {
    const updated = [...lines];
    updated[index] = newLine;
    onChange(updated.join('\n'));
  };

  const handleDeleteLine = (index) => {
    const updated = lines.filter((_, lineIndex) => lineIndex !== index);
    onChange(updated.join('\n'));

    if (editingTcIndex === index) {
      setEditingTcIndex(null);
      setEditingTcValue('');
    } else if (editingTcIndex !== null && editingTcIndex > index) {
      setEditingTcIndex((prev) => prev - 1);
    }
  };

  const handleInsertLine = (index) => {
    const currentLine = lines[index] ?? '';
    const m = currentLine.match(SYNCED_RE);
    const newLine = m ? '[00:00.00] ' : '';
    const updated = [...lines];
    updated.splice(index + 1, 0, newLine);
    onChange(updated.join('\n'));
    setFocusPending(index + 1);
  };

  const handleMultilinePaste = (index, pastedText, currentTcStr = null) => {
    const normalized = normalizeText(pastedText);
    if (!normalized.includes('\n')) return false;

    const pastedLines = normalized.split('\n');
    const preparedLines = currentTcStr
      ? pastedLines.map((line, pasteIndex) => {
          if (pasteIndex === 0 && !SYNCED_RE.test(line)) {
            return `${currentTcStr} ${line}`.trimEnd();
          }
          return line;
        })
      : pastedLines;

    const updated = [...lines];
    updated.splice(index, 1, ...preparedLines);
    onChange(updated.join('\n'));

    if (editingTcIndex !== null) {
      setEditingTcIndex(null);
      setEditingTcValue('');
    }
    return true;
  };

  const replaceMinuteInLine = (line, newMinute) => {
    const m = line.match(SYNCED_RE);
    if (!m) return line;
    return `[${String(newMinute).padStart(2, '0')}:${m[2]}.${m[3]}]${m[4] ? ` ${m[4]}` : ''}`;
  };

  const propagateMinuteForward = (sourceLines, startIndex, newMinute) => {
    const updated = [...sourceLines];
    for (let idx = startIndex + 1; idx < updated.length; idx++) {
      if (SYNCED_RE.test(updated[idx])) {
        updated[idx] = replaceMinuteInLine(updated[idx], newMinute);
      }
    }
    return updated;
  };

  const startTimecodeEdit = (index, tcStr) => {
    setEditingTcIndex(index);
    setEditingTcValue(tcStr);
  };

  const commitTimecodeEdit = (index, textPart, originalTcStr) => {
    const draft = editingTcValue.trim();
    const parsed = parseTimecodeOnly(draft);

    let updated = [...lines];

    if (parsed !== null) {
      updated[index] = textPart ? `${draft} ${textPart}` : draft;

      const oldParsed = originalTcStr ? parseTimecodeOnly(originalTcStr) : null;
      const oldMinute = oldParsed !== null ? Math.floor(oldParsed / 60) : null;
      const newMinute = Math.floor(parsed / 60);

      if (oldMinute !== null && oldMinute !== newMinute) {
        updated = propagateMinuteForward(updated, index, newMinute);
      }
    } else {
      updated[index] = draft ? (textPart ? `${draft} ${textPart}` : draft) : textPart;
    }

    onChange(updated.join('\n'));
    setEditingTcIndex(null);
    setEditingTcValue('');
  };

  return (
    <div
      className="rounded-lg border overflow-auto font-mono text-xs"
      style={{
        borderColor: isNight ? 'rgba(153,27,27,0.4)' : 'rgba(255,255,255,0.15)',
        background : 'rgba(0,0,0,0.2)',
        maxHeight  : 340,
      }}
    >
      {lines.map((line, i) => {
        const m = line.match(SYNCED_RE);
        const tcValid = !!m;
        const tcStr = tcValid ? `[${m[1]}:${m[2]}.${m[3]}]` : null;
        const lineText = tcValid ? m[4] : line;
        const isEditingTc = editingTcIndex === i;

        return (
          <div key={i} className="flex items-center gap-1 px-2 group" style={{ minHeight: 24 }}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleDeleteLine(i)}
              title={t('deleteLine')}
              className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 text-red-400"
            >
              <svg viewBox="0 0 8 8" fill="currentColor" className="w-2.5 h-2.5">
                <path d="M2 2l4 4M6 2L2 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              </svg>
            </button>
            {tcValid && !isEditingTc ? (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const parsed = parseSyncedLine(line);
                  if (parsed) onJumpToTime?.(parsed.time);
                }}
                title={`Jump to ${tcStr}`}
                className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-400/20"
                style={{ color: MARKER_COLOR }}
              >
                <svg viewBox="0 0 8 8" fill="currentColor" className="w-2.5 h-2.5">
                  <polygon points="1,1 7,4 1,7"/>
                </svg>
              </button>
            ) : (
              <div className="flex-shrink-0 w-4" />
            )}

            {tcValid ? (
              isEditingTc ? (
                <input
                  autoFocus
                  className="flex-shrink-0 bg-transparent outline-none font-bold"
                  style={{ color: '#e5e7eb', letterSpacing: '0.01em', width: 88, lineHeight: '24px', height: 24 }}
                  value={editingTcValue}
                  onChange={(e) => setEditingTcValue(e.target.value)}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData('text');
                    if (handleMultilinePaste(i, pastedText, tcStr)) {
                      e.preventDefault();
                    }
                  }}
                  onBlur={() => commitTimecodeEdit(i, lineText, tcStr)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitTimecodeEdit(i, lineText, tcStr);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingTcIndex(null);
                      setEditingTcValue('');
                    }
                  }}
                  spellCheck={false}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startTimecodeEdit(i, tcStr)}
                  className="flex-shrink-0 font-bold text-start hover:opacity-85 transition-opacity"
                  style={{ color: accentTC, letterSpacing: '0.01em' }}
                >
                  {tcStr}
                </button>
              )
            ) : null}

            <input
              ref={(el) => { inputRefs.current[i] = el; }}
              className="flex-1 min-w-0 bg-transparent outline-none text-xs font-mono"
              style={{ color: tcValid ? '#e5e7eb' : '#9ca3af', lineHeight: '24px', height: 24 }}
              value={lineText}
              onChange={(e) => {
                if (tcValid) {
                  handleLineChange(i, `${tcStr} ${e.target.value}`);
                } else {
                  handleLineChange(i, e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleInsertLine(i);
                }
              }}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData('text');
                if (handleMultilinePaste(i, pastedText, tcValid ? tcStr : null)) {
                  e.preventDefault();
                }
              }}
              spellCheck={false}
            />
          </div>
        );
      })}
    </div>
  );
}