// One storage layer for every app on this website. Keys and shapes match the original apps exactly
// (ml: MacroLens, ru: ReadyUp, wb: Weekboard, gp: Gameplan, ch: Charla), so history carries over both ways.
// Inside Claude, the same keys are also saved to your Claude account (db capability), so they sync across devices.
const cache = new Map();
const listeners = new Set();
const mem = new Map(); // fallback when the browser blocks localStorage

const lsGet = (k) => { try { const v = localStorage.getItem(k); if (v != null) return v; } catch {} return mem.has(k) ? mem.get(k) : null; };
const lsSet = (k, v) => { mem.set(k, v); try { localStorage.setItem(k, v); } catch {} };
const lsDel = (k) => { mem.delete(k); try { localStorage.removeItem(k); } catch {} };

export function rd(key) {
  if (cache.has(key)) return cache.get(key);
  let v = null;
  try { v = JSON.parse(lsGet(key) || 'null'); } catch { v = null; }
  cache.set(key, v);
  return v;
}
export function wr(key, value) {
  cache.set(key, value);
  lsSet(key, JSON.stringify(value));
  queue(key);
  changed();
}
export function del(key) {
  cache.delete(key);
  lsDel(key);
  queue(key);
  changed();
}
/** Read-modify-write. `make` builds the default when the key is empty. */
export function mut(key, fn, make = () => ({})) {
  const v = rd(key) ?? make();
  fn(v);
  wr(key, v);
  return v;
}
export function keys() { let k = []; try { k = Object.keys(localStorage); } catch {} return [...new Set([...k, ...mem.keys()])]; }
export const raw = (k) => lsGet(k);
export const setRaw = (k, v) => { cache.delete(k); lsSet(k, v); queue(k); };

let t;
function changed() { clearTimeout(t); t = setTimeout(() => listeners.forEach((f) => f()), 0); }
export const onChange = (f) => listeners.add(f);
export function invalidate() { cache.clear(); }
const redraw = () => { invalidate(); listeners.forEach((f) => f()); };
// Another tab (MacroLens, ReadyUp...) wrote something: drop the cache and redraw.
window.addEventListener('storage', redraw);
document.addEventListener('visibilitychange', () => { if (document.hidden) return; if (remote) pull().then(redraw, redraw); else redraw(); });

// ===================== Claude account sync (only inside Claude) =====================
const SYNCED = /^(ml|ru|wb|gp|ch):/;
const docId = (k) => k.replace(':', '__');
const keyOf = (id) => id.replace('__', ':');
let remote = null, flushT = null, flushing = false;
const pending = new Set();
export const cloud = { state: 'local' }; // local | loading | synced | error
function queue(k) { if (!remote || !SYNCED.test(k)) return; pending.add(k); clearTimeout(flushT); flushT = setTimeout(flush, 600); }
async function flush() {
  if (flushing || !remote) return;
  flushing = true;
  try {
    while (pending.size) {
      const k = pending.values().next().value; pending.delete(k);
      const v = lsGet(k), ref = remote.doc(docId(k));
      if (v == null) await ref.delete(); else await ref.set(JSON.parse(v));
    }
    cloud.state = 'synced';
  } catch { cloud.state = 'error'; } finally { flushing = false; }
}
async function pull() {
  const snap = await remote.get();
  const have = new Set();
  for (const d of snap.docs) {
    if (!d.exists) continue;
    const k = keyOf(d.id); have.add(k);
    if (!pending.has(k)) lsSet(k, JSON.stringify(d.data()));
  }
  return have;
}
/** Connect to the Claude account store when running inside Claude. Resolves true when synced. */
export async function connectCloud() {
  if (!window.claude?.use) return false;
  cloud.state = 'loading';
  try {
    const timeout = new Promise((r) => setTimeout(() => r([null, null]), 10000));
    const [db, user] = await Promise.race([Promise.all([claude.use('db'), claude.use('user')]), timeout]);
    const id = user ? await user.id() : null;
    if (!db || !id) { cloud.state = 'local'; return false; }
    remote = db.collection('data/users/' + id);
    const have = await pull();
    for (const k of keys()) if (SYNCED.test(k) && !have.has(k)) pending.add(k); // first run: upload what's only here
    cloud.state = 'synced';
    if (pending.size) flush();
    redraw();
    return true;
  } catch { remote = null; cloud.state = 'error'; redraw(); return false; }
}
export const inClaude = () => !!window.claude?.use;
