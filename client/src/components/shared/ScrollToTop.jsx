import { useEffect, useState } from 'react';

export function ScrollToTop({ isNight, hidden, end = 'end-6', bottom = 'bottom-6' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY >= window.innerHeight);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        opacity      : visible && !hidden ? 1 : 0,
        transform    : visible && !hidden ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: visible && !hidden ? 'auto' : 'none',
        transition   : 'opacity 0.3s ease, transform 0.3s ease',
      }}
      className={`fixed ${end} ${bottom} z-[350] w-10 h-10 rounded-full flex items-center justify-center shadow-xl active:scale-95 ${
        isNight
          ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
          : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M7 12V2M2 7l5-5 5 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
