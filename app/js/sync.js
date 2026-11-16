// Moving data between places that can't see each other's storage:
// MacroLens inside Claude (saves to your Claude account), Safari, and the home-screen app (iPhone gives it its own storage).
// A "transfer code" is BL1: + base64(JSON {data: {key: jsonString}}). Importing MERGES, it never wipes what's already here.
import { keys, raw, setRaw, invalidate } from './store.js';

export const APP_KEY = /^(ml|mlw|ru|wb|gp|ch|lk|bl|sb):/;
const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

export function exportCode() {
  const data = {}; for (const k of keys()) if (APP_KEY.test(k) && k !== 'bl:theme') data[k] = raw(k);
  return 'BL1:' + b64(JSON.stringify({ at: Date.now(), data }));
}
/** Accepts a transfer code, or a backup file's JSON. Returns {data} or throws. */
export function decode(text) {
  const t = String(text || '').trim().replace(/\s+/g, '');
  if (t.startsWith('BL1:')) return JSON.parse(unb64(t.slice(4)));
  const j = JSON.parse(String(text).trim()); if (j && j.data) return j;
  throw new Error('not a code');
}

const P = (s) => { try { return JSON.parse(s); } catch { return null; } };
const unionBy = (a = [], b = [], key) => { const m = new Map(); for (const x of a || []) m.set(key(x), x); for (const x of b || []) m.set(key(x), x); return [...m.values()]; };
const entryKey = (e) => `${e.addedAt ?? ''}|${e.name}|${e.serving}`;

function mergeValue(k, a, b) {
  if (a == null) return b; if (b == null) return a;
  if (/^ml:day-/.test(k)) {
    const o = { ...a, ...b };
    for (const m of ['breakfast', 'lunch', 'dinner', 'snacks']) o[m] = unionBy(a[m], b[m], entryKey);
    o.water = Math.max(a.water || 0, b.water || 0); return o;
  }
  if (k === 'ml:core') {
    const o = { ...a, ...b, profile: b.profile || a.profile, targets: b.targets || a.targets };
    o.custom = unionBy(a.custom, b.custom, (f) => f.name); o.recents = unionBy(b.recents, a.recents, (f) => `${f.name}|${f.serving}`).slice(0, 25);
    o.meals = unionBy(a.meals, b.meals, (m) => m.name); o.weights = unionBy(a.weights, b.weights, (w) => w.date).sort((x, y) => x.date.localeCompare(y.date));
    o.barcodes = { ...(a.barcodes || {}), ...(b.barcodes || {}) }; return o;
  }
  if (/^ru:day-/.test(k)) return { ...a, ...b, checkin: (b.checkin?.at || 0) >= (a.checkin?.at || 0) ? b.checkin || a.checkin : a.checkin, sessions: unionBy(a.sessions, b.sessions, (s) => JSON.stringify(s)) };
  if (/^gp:d-/.test(k)) return { ...a, ...b, blocks: unionBy(a.blocks, b.blocks, (x) => x.id), entries: unionBy(a.entries, b.entries, (x) => x.id), night: { ...(a.night || {}), ...(b.night || {}), done: { ...(a.night?.done || {}), ...(b.night?.done || {}) } } };
  if (k === 'gp:core') return { ...a, ...b, tasks: unionBy(a.tasks, b.tasks, (t) => t.id), routine: b.routine || a.routine, settings: { ...(a.settings || {}), ...(b.settings || {}) } };
  if (/^wb:w-/.test(k)) return { items: unionBy(a.items, b.items, (x) => x.id), done: { ...(a.done || {}), ...(b.done || {}) }, skip: { ...(a.skip || {}), ...(b.skip || {}) } };
  if (k === 'wb:core') return { ...a, ...b, rules: unionBy(a.rules, b.rules, (r) => r.id), tray: unionBy(a.tray, b.tray, (r) => r.id), settings: { ...(a.settings || {}), ...(b.settings || {}) } };
  if (/^ch:day-/.test(k)) return { ...a, ...b, secs: Math.max(a.secs || 0, b.secs || 0) };
  if (k === 'ch:core') return { ...a, ...b, words: unionBy(a.words, b.words, (w) => w.es.toLowerCase()) };
  return b;
}
/** Merge a decoded bundle into this device. Returns counts per app. */
export function importBundle(bundle) {
  const counts = {};
  for (const [k, v] of Object.entries(bundle.data || {})) {
    if (!APP_KEY.test(k) || typeof v !== 'string' || k === 'bl:theme') continue;
    const inc = P(v); if (inc == null) continue;
    const merged = mergeValue(k, P(raw(k)), inc);
    setRaw(k, JSON.stringify(merged));
    const app = k.split(':')[0]; counts[app] = (counts[app] || 0) + 1;
  }
  invalidate();
  return counts;
}
/** What's stored on this device, per app, in plain words. */
export function inventory() {
  const ks = keys(), n = (re) => ks.filter((k) => re.test(k)).length;
  const foodDays = ks.filter((k) => /^ml:day-/.test(k) && (P(raw(k)) ? ['breakfast', 'lunch', 'dinner', 'snacks'].some((m) => (P(raw(k))[m] || []).length) : false)).length;
  const gp = P(raw('gp:core')), wb = P(raw('wb:core')), ch = P(raw('ch:core'));
  return [
    ['MacroLens', foodDays ? `${foodDays} day${foodDays === 1 ? '' : 's'} of food` : P(raw('ml:core'))?.profile ? 'targets set, no food yet' : null],
    ['ReadyUp', n(/^ru:day-/) ? `${n(/^ru:day-/)} days of check-ins` : null],
    ['Gameplan', gp?.tasks?.length || n(/^gp:d-/) ? `${gp?.tasks?.length || 0} tasks · ${n(/^gp:d-/)} days` : null],
    ['Weekboard', wb?.rules?.length || n(/^wb:w-/) ? `${wb?.rules?.length || 0} repeating · ${n(/^wb:w-/)} weeks` : null],
    ['Charla', ch?.words?.length || n(/^ch:day-/) ? `${ch?.words?.length || 0} words · ${n(/^ch:day-/)} days` : null],
  ];
}
export const isHomeScreen = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
