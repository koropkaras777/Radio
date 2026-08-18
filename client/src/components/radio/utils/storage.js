export function readLS(key, fallback) {
  const v = localStorage.getItem(key);
  return v !== null ? JSON.parse(v) : fallback;
}
