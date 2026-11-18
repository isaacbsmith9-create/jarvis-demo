'use strict';
// ===================== storage =====================
// Progress is saved on this device first ("iq:" keys) and synced to the viewer's private Claude account
// collection when the app runs inside Claude. Docs: "profile", "results" (every graded possession), "progress".
const cache = {};
let remote = null;
const pending = new Set();
let flushTimer = null, flushPromise = null;
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem('iq:' + k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('iq:' + k, JSON.stringify(v)); } catch {} };
const lsKeys = () => { try { return Object.keys(localStorage).filter((k) => k.startsWith('iq:')).map((k) => k.slice(3)); } catch { return []; } };
const BLANK = {
  profile: () => ({ name: '', position: 'PG', created: Date.now() }),
  results: () => ({ list: [] }),
  progress: () => ({ scen: {}, daily: {}, best: {} }),
  // Team Playbook: the user's plays and offensive rules (starts from editable templates), and simulator history.
  playbook: () => ({ plays: JSON.parse(JSON.stringify(STARTER_PLAYS)), rules: JSON.parse(JSON.stringify(DEFAULT_RULES)) }),
  team: () => ({ list: [] }),
};
function doc(key) {
  if (!(key in cache)) cache[key] = lsGet(key) ?? (BLANK[key] ? BLANK[key]() : null);
  return cache[key];
}
function persist(key) {
  lsSet(key, cache[key]);
  if (!remote) return;
  pending.add(key);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 700);
}
function flush() {
  if (flushPromise) return flushPromise;
  if (!remote || !pending.size) return Promise.resolve();
  flushPromise = (async () => {
    try {
      while (pending.size) {
        const k = pending.values().next().value; pending.delete(k);
        await remote.doc(k).set(JSON.parse(JSON.stringify(cache[k])));
      }
      setSync('synced');
    } catch { setSync('error'); } finally { flushPromise = null; }
  })();
  return flushPromise;
}
function setSync(s) {
  const el = document.getElementById('sync'); if (!el) return;
  el.dataset.s = s;
  el.title = s === 'synced' ? 'Progress synced to your Claude account' : s === 'error' ? 'Saved on this device; sync failed' : s === 'loading' ? 'Syncing…' : 'Saved on this device';
}
async function connectStore(onReady) {
  if (!window.claude?.use) return setSync('local');
  setSync('loading');
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  const id = user ? await user.id() : null;
  if (!db || !id) return setSync('local');
  const coll = db.collection('data/users/' + id);
  const timer = setTimeout(() => setSync('local'), 10000);
  try {
    const snap = await coll.get();
    clearTimeout(timer);
    remote = coll;
    const have = new Set();
    for (const d of snap.docs) { if (!d.exists) continue; have.add(d.id); cache[d.id] = JSON.parse(JSON.stringify(d.data())); lsSet(d.id, cache[d.id]); }
    for (const k of lsKeys()) if (!have.has(k) && BLANK[k]) { doc(k); pending.add(k); }
    setSync('synced');
    if (pending.size) flush();
    onReady?.();
  } catch { clearTimeout(timer); setSync('local'); }
}
window.addEventListener('pagehide', () => { if (pending.size) flush(); });

// ===================== helpers =====================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const r1 = (x) => Math.round(x * 10) / 10;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const uid = (p = 'id') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
// Seeded RNG so a replay of a saved possession is identical.
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
