import { useEffect } from 'react';

// ─── useCooldown ─────────────────────────────────────────────────────────────
export const useCooldown = (value, setter) => {
  useEffect(() => {
    if (value <= 0) return;
    const timer = setTimeout(() => setter((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [value, setter]);
};