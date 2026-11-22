'use strict';
// ===================== storage =====================
// Athlete OS and MacroLens are two pages of one artifact. They share this device's storage (the "ml:" keys) and the
// same private Claude account collection, so a meal logged in MacroLens and a workout logged here are the same records.
// Docs from MacroLens: "core" {profile, targets, overrides, weights, measures, health, prefs...} and "day-YYYY-MM-DD"
// {breakfast, lunch, dinner, snacks, water, exercise, feel, type}. Athlete OS adds "aos", "aos-tests", "aos-shots",
// "aos-games", "aos-body" and "aos-coach".
const cache = {};
let remote = null;
const pending = new Set();
let flushing = false, flushTimer = null, flushPromise = null;
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem('ml:' + k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('ml:' + k, JSON.stringify(v)); } catch {} };
const lsKeys = () => { try { return Object.keys(localStorage).filter((k) => k.startsWith('ml:')).map((k) => k.slice(3)); } catch { return []; } };
const BLANK = {
  core: () => ({ profile: null, targets: null, overrides: {}, custom: [], recents: [], weights: [] }),
  aos: () => ({ profile: {}, customTests: [] }),
  'aos-tests': () => ({ results: [] }),
  'aos-shots': () => ({ sessions: [] }),
  'aos-games': () => ({ games: [] }),
  'aos-body': () => ({ entries: [] }),
  'aos-coach': () => ({ workouts: [], reports: [], chat: [] }),
  'aos-handles': () => ({ sessions: [] }),
  'aos-finish': () => ({ sessions: [] }),
  'aos-film': () => ({ entries: [] }),
  'aos-goals': () => ({ goals: [] }),
  'aos-plan': () => ({ events: [], routines: [], checks: {} }),
  'aos-lib': () => ({ workouts: [], favs: [] }),
  'aos-mind': () => ({ checks: {}, journal: [], sessions: [] }),
  'aos-intel': () => ({ ins: {}, recs: {}, reviews: {} }),
};
function doc(key) {
  if (!(key in cache)) cache[key] = lsGet(key) ?? (BLANK[key] ? BLANK[key]() : null);
  return cache[key];
}
const core = () => doc('core');
const aos = () => doc('aos');
const blankDay = () => ({ breakfast: [], lunch: [], dinner: [], snacks: [], water: 0 });
function dayDoc(date, create = false) {
  const k = 'day-' + date;
  if (!doc(k) && create) cache[k] = blankDay();
  return cache[k];
}
function persist(key) {
  lsSet(key, cache[key]);
  if (!remote) return;
  pending.add(key);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 600);
}
function flush() {
  if (flushPromise) return flushPromise;
  if (!remote || !pending.size) return Promise.resolve();
  clearTimeout(flushTimer);
  flushing = true;
  flushPromise = (async () => {
    try {
      while (pending.size) {
        const k = pending.values().next().value;
        pending.delete(k);
        await remote.doc(k).set(JSON.parse(JSON.stringify(cache[k])));
      }
      setSync('synced');
    } catch { setSync('error'); } finally { flushing = false; flushPromise = null; }
  })();
  return flushPromise;
}
function setSync(s) {
  const el = document.getElementById('sync');
  if (!el) return;
  el.dataset.s = s;
  el.textContent = s === 'synced' ? 'Synced' : s === 'error' ? 'Not synced' : s === 'loading' ? 'Syncing…' : 'This device';
  const n = document.getElementById('storage-note');
  if (n) n.textContent = s === 'synced' || s === 'loading'
    ? 'Everything is saved to your Claude account and shared with MacroLens. Only you can see it.'
    : s === 'error' ? 'Saved on this device but could not sync. It will sync on the next save that goes through.'
      : 'Saved in this browser only. Open Athlete OS inside Claude while signed in to sync across devices.';
}
let dbReady = false;
async function connectStore(onReady) {
  if (!window.claude?.use) { setSync('local'); return; }
  setSync('loading');
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  const id = user ? await user.id() : null;
  if (!db || !id) { setSync('local'); return; }
  const coll = db.collection('data/users/' + id);
  const timer = setTimeout(() => setSync('local'), 10000);
  try {
    const snap = await coll.get();
    clearTimeout(timer);
    remote = coll;
    const remoteKeys = new Set();
    for (const d of snap.docs) {
      if (!d.exists) continue;
      remoteKeys.add(d.id);
      cache[d.id] = JSON.parse(JSON.stringify(d.data()));
      lsSet(d.id, cache[d.id]);
    }
    for (const k of lsKeys()) if (!remoteKeys.has(k) && (k === 'core' || k.startsWith('day-') || k.startsWith('aos') || k.startsWith('life-') || k === 'ev-aos')) { doc(k); pending.add(k); }
    dbReady = true;
    setSync('synced');
    if (pending.size) flush();
    onReady?.();
  } catch { clearTimeout(timer); setSync('local'); }
}
// Leaving for MacroLens: finish saving first so MacroLens loads the newest copy.
async function goTo(href) {
  try { await Promise.race([flush(), new Promise((r) => setTimeout(r, 2500))]); } catch {}
  location.href = href;
}
window.addEventListener('pagehide', () => { if (pending.size) flush(); });

// ===================== tiny helpers =====================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clamp01 = (x) => clamp(x, 0, 1);
const uid = (p = 'id') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const todayIso = () => isoDate(new Date());
const parseIso = (iso) => new Date(iso + 'T12:00:00');
function shiftIso(iso, n) { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoDate(d); }
function daysBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / 864e5); }
function lastNDays(n, end = todayIso()) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(shiftIso(end, -i)); return out; }
const mondayOf = (iso) => { const d = parseIso(iso); const w = (d.getDay() + 6) % 7; return shiftIso(iso, -w); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtD = (iso) => { const d = parseIso(iso); return `${MON[d.getMonth()]} ${d.getDate()}`; };
const fmtDL = (iso) => { const d = parseIso(iso); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
const fmtDur = (m) => { m = Math.round(m); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; };
const fmtHrs = (m) => r1(m / 60) + ' h';
const pctTxt = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sum = (a) => a.reduce((x, y) => x + (Number(y) || 0), 0);
const allDayKeys = () => [...new Set([...Object.keys(cache), ...lsKeys()].filter((k) => k.startsWith('day-')))].map((k) => k.slice(4)).sort();
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}
