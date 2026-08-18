const BAR_WEIGHTS = [0.55, 1, 0.75];
const SPEAKING_THRESHOLD = 0.035;
const MIN_BAR_PX = 3;
const MAX_BAR_PX = 12;

/**
 * @param {{ level?: number }} props level is a rough 0-1 RMS value from utils/audioLevel.js
 */
export function SpeakingIndicator({ level = 0 }) {
  const active = level > SPEAKING_THRESHOLD;

  return (
    <div
      className="flex items-end gap-[2px] h-3 w-4 shrink-0"
      aria-hidden="true"
      title={active ? 'Говорить' : undefined}
    >
      {BAR_WEIGHTS.map((weight, i) => {
        const px = active
          ? Math.max(MIN_BAR_PX, Math.min(MAX_BAR_PX, level * 34 * weight))
          : MIN_BAR_PX;
        return (
          <span
            key={i}
            className={`w-[3px] rounded-sm transition-all duration-100 ${active ? 'bg-green-400' : 'bg-gray-600'}`}
            style={{ height: `${px}px` }}
          />
        );
      })}
    </div>
  );
}