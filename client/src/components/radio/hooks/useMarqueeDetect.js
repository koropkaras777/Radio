import { useEffect, useState } from 'react';

export function useMarqueeDetect(wrapperRef, innerRef, deps = []) {
  const [isMarquee, setIsMarquee] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMarquee(
        !!innerRef.current &&
        !!wrapperRef.current &&
        innerRef.current.offsetWidth > wrapperRef.current.offsetWidth
      );
    };

    const obs     = new ResizeObserver(() => requestAnimationFrame(check));
    const timeout = setTimeout(check, 300);

    if (wrapperRef.current) obs.observe(wrapperRef.current);

    return () => { obs.disconnect(); clearTimeout(timeout); };
  }, deps);

  return isMarquee;
}