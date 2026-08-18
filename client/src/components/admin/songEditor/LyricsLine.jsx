import { formatTimecode } from './songEditorUtils.js';

// ─── LyricsLine (preview) ─────────────────────────────────────────────────────
export function LyricsLine({ line, synced, isNight }) {
  if (synced && typeof line === 'object') {
    return (
      <div className="flex gap-2 items-baseline py-0.5">
        <span className={`flex-shrink-0 font-mono text-[10px] ${isNight ? 'text-red-400/60' : 'text-blue-400/60'}`}>
          {formatTimecode(line.time)}
        </span>
        <span className="text-sm text-gray-200">{line.text}</span>
      </div>
    );
  }
  const text = typeof line === 'string' ? line : (line.text ?? '');
  return <div className="py-0.5 text-sm text-gray-200">{text}</div>;
}