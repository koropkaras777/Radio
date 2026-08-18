import { useState } from 'react';

export function VolumeKnob({ volume, isMuted, setVolume, setIsMuted, th }) {
  const [showVolumeBar, setShowVolumeBar] = useState(false);

  return (
    <div
      className="fixed bottom-6 left-6 rtl:left-auto rtl:right-6 z-[350] flex flex-col-reverse items-center group"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setShowVolumeBar(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setShowVolumeBar(false); }}
    >
      <button
        onClick={() => setIsMuted(!isMuted)}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') {
            e.stopPropagation();
            setShowVolumeBar((v) => !v);
          }
        }}
        className={`relative z-20 w-14 h-14 flex items-center justify-center rounded-full shadow-2xl transition-all duration-300 active:scale-95 ${th.accentBtnSm} shadow-black/40`}
      >
        <span className="text-2xl select-none">
          {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </span>
      </button>

      <div className={`relative flex flex-col items-center backdrop-blur-xl border transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden w-14 ${
        showVolumeBar ? 'h-48 opacity-90 mb-[-25px]' : 'h-0 opacity-0 mb-[-56px] pointer-events-none'
      } ${th.volumeBar}`}>
        <div className="relative w-full h-full mt-4">
          <input
            type="range" min="0" max="1" step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (v > 0) setIsMuted(false);
            }}
            className={`absolute inset-0 w-full h-full [writing-mode:vertical-lr] [direction:rtl] bg-transparent cursor-pointer z-30 transition-colors duration-300 ${th.accentInput}`}
          />
        </div>
      </div>
    </div>
  );
}