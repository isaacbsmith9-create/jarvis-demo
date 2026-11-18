'use strict';
// ===================== storage =====================
// Everything is saved on this device first ("ail:" keys) and synced to the viewer's private Claude account
// collection (data/users/<id>) when the app runs inside Claude.
// Docs: "athletes" (profiles + current), "records" (test results), "shots", "drills" (handling + finishing), "games",
// "meta" (custom tests, training blocks, comparison groups, dashboard layout, benchmarks, reports, AI insight).
const cache = {};
let remote = null;
const pending = new Set();
let flushTimer = null, flushPromise = null;
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem('ail:' + k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('ail:' + k, JSON.stringify(v)); } catch {} };
const lsKeys = () => { try { return Object.keys(localStorage).filter((k) => k.startsWith('ail:')).map((k) => k.slice(4)); } catch { return []; } };
const BLANK = {
  athletes: () => ({ list: [], current: null }),
  records: () => ({ list: [] }),
  shots: () => ({ list: [] }),
  drills: () => ({ list: [] }),
  games: () => ({ list: [] }),
  meta: () => ({ customTests: [], blocks: [], groups: [], cards: null, bench: {}, reports: [], ai: null }),
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
// Big lists are split across documents ("shots", "shots_1", "shots_2", …) because one database document holds at most
// 256 KiB. Only chunks whose content changed are rewritten.
const LISTS = new Set(['records', 'shots', 'drills', 'games']);
const CHUNK = 180000;
const written = {}; // key -> [serialized chunk strings last written]
function chunksOf(k) {
  const list = cache[k].list, out = []; let cur = [], size = 0;
  for (const it of list) { const n = JSON.stringify(it).length + 1; if (size + n > CHUNK && cur.length) { out.push(cur); cur = []; size = 0; } cur.push(it); size += n; }
  out.push(cur);
  return out;
}
async function writeKey(k) {
  if (!LISTS.has(k)) return remote.doc(k).set(JSON.parse(JSON.stringify(cache[k])));
  const parts = chunksOf(k), prev = written[k] || [], now = [];
  for (let i = 0; i < parts.length; i++) {
    const body = JSON.stringify({ list: parts[i], parts: parts.length }); now.push(body);
    if (prev[i] !== body) await remote.doc(i ? `${k}_${i}` : k).set(JSON.parse(body));
  }
  for (let i = parts.length; i < prev.length; i++) await remote.doc(`${k}_${i}`).delete();
  written[k] = now;
}
function flush() {
  if (flushPromise) return flushPromise;
  if (!remote || !pending.size) return Promise.resolve();
  flushPromise = (async () => {
    try {
      while (pending.size) { const k = pending.values().next().value; pending.delete(k); await writeKey(k); }
      setSync('synced');
    } catch { setSync('error'); } finally { flushPromise = null; }
  })();
  return flushPromise;
}
function setSync(s) {
  const el = document.getElementById('sync'); if (!el) return;
  el.dataset.s = s;
  el.textContent = { synced: 'Synced', error: 'Sync failed', loading: 'Syncing…' }[s] || 'This device';
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
    const have = new Set(), parts = {};
    for (const d of snap.docs) {
      if (!d.exists) continue;
      const m = /^(.+)_(\d+)$/.exec(d.id), base = m && LISTS.has(m[1]) ? m[1] : d.id, i = m && LISTS.has(m[1]) ? Number(m[2]) : 0;
      if (LISTS.has(base)) { (parts[base] ||= [])[i] = d.data(); continue; }
      have.add(d.id); cache[d.id] = JSON.parse(JSON.stringify(d.data())); lsSet(d.id, cache[d.id]);
    }
    for (const [k, arr] of Object.entries(parts)) {
      const n = arr[0]?.parts || arr.length, got = arr.slice(0, n);
      if (got.length < n || got.some((x) => !x)) continue; // incomplete set: keep the device copy and rewrite it
      have.add(k); cache[k] = { list: got.flatMap((x) => JSON.parse(JSON.stringify(x.list || []))) }; lsSet(k, cache[k]);
      written[k] = got.map((x) => JSON.stringify({ list: x.list, parts: x.parts }));
    }
    for (const k of lsKeys()) if (!have.has(k) && BLANK[k]) { doc(k); pending.add(k); }
    setSync('synced');
    if (pending.size) flush();
    onReady?.();
  } catch { clearTimeout(timer); setSync('local'); }
}
window.addEventListener('pagehide', () => { if (pending.size) flush(); });

