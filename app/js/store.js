// One storage layer for every app on this website. Keys and shapes match the original apps exactly
// (ml: MacroLens, ru: ReadyUp, wb: Weekboard, gp: Gameplan, ch: Charla), so history carries over both ways.
const cache = new Map();
const listeners = new Set();

export function rd(key) {
  if (cache.has(key)) return cache.get(key);
  let v = null;
  try { v = JSON.parse(localStorage.getItem(key) || 'null'); } catch { v = null; }
  cache.set(key, v);
  return v;
}
export function wr(key, value) {
  cache.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  changed();
}
export function del(key) {
  cache.delete(key);
  try { localStorage.removeItem(key); } catch {}
  changed();
}
/** Read-modify-write. `make` builds the default when the key is empty. */
export function mut(key, fn, make = () => ({})) {
  const v = rd(key) ?? make();
  fn(v);
  wr(key, v);
  return v;
}
export function keys() { try { return Object.keys(localStorage); } catch { return []; } }
export const raw = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const setRaw = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

let t;
function changed() { clearTimeout(t); t = setTimeout(() => listeners.forEach((f) => f()), 0); }
export const onChange = (f) => listeners.add(f);
export function invalidate() { cache.clear(); }
// Another tab (MacroLens, ReadyUp...) wrote something: drop the cache and redraw.
window.addEventListener('storage', () => { invalidate(); listeners.forEach((f) => f()); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { invalidate(); listeners.forEach((f) => f()); } });
