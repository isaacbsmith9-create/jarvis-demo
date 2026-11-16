// Charla (ch:) flashcards + the cross-app day model from Scoreboard (day score, OVR, habits, streaks).
import { rd, mut } from './store.js';
import { todayIso, shiftIso, isoDate, clamp } from './util.js';
import * as ml from './ml.js';
import * as ru from './ru.js';
import { gpCore, gpDay, minsBy, nightState, itemsOn } from './plan.data.js';

// ===================== Charla =====================
const CH_CORE = () => ({ settings: { goal: 5, accent: 'es-MX', rate: 0.9, autoplay: true, english: false }, setup: { level: 'Spanish 2', topic: 'Los deportes', grammar: 'Any' }, words: [] });
export const chCore = () => { const c = rd('ch:core') || CH_CORE(); c.words ||= []; c.settings ||= CH_CORE().settings; return c; };
export const saveChCore = (fn) => mut('ch:core', (c) => { c.words ||= []; c.settings ||= CH_CORE().settings; fn(c); }, CH_CORE);
export const chDay = (iso) => rd('ch:day-' + iso);
export const addSpanishSecs = (secs) => mut('ch:day-' + todayIso(), (d) => { d.secs = (d.secs || 0) + secs; }, () => ({ secs: 0, sessions: 0, messages: 0 }));
export const BOX_DAYS = [0, 1, 3, 7, 14, 30];
export const dueWords = () => chCore().words.filter((w) => w.due <= todayIso());
export function gradeWord(es, got) {
  saveChCore((c) => { const w = c.words.find((x) => x.es === es); if (!w) return; w.box = got ? Math.min(5, (w.box || 1) + 1) : 1; w.due = shiftIso(todayIso(), got ? BOX_DAYS[w.box] : 0); });
}
export function addWord(es, en) {
  let added = false;
  saveChCore((c) => { if (c.words.some((w) => w.es.toLowerCase() === es.toLowerCase())) return; c.words.push({ es, en, box: 1, due: todayIso(), added: todayIso() }); added = true; });
  return added;
}
export const spanishGoal = () => Number(chCore().settings.goal) || 5;
export function spanishStreak() { const g = spanishGoal() * 60; let n = 0, d = todayIso(); if ((chDay(d)?.secs || 0) < g) d = shiftIso(d, -1); while ((chDay(d)?.secs || 0) >= g && n < 999) { n++; d = shiftIso(d, -1); } return n; }

// ===================== Scoreboard day model =====================
function mlDay(iso) {
  const d = ml.day(iso); if (!d) return null;
  const o = { cal: 0, p: 0, c: 0, f: 0, n: 0, water: d.water || 0 };
  for (const [m] of ml.MEALS) for (const e of d[m] || []) { const s = e.servings ?? 1; o.cal += (e.calories || 0) * s; o.p += (e.protein || 0) * s; o.c += (e.carbs || 0) * s; o.f += (e.fat || 0) * s; o.n++; }
  return o.n || o.water ? o : null;
}
let cache = {};
export const resetCache = () => { cache = {}; };
export const row = (iso) => (cache[iso] ??= dayRow(iso));
function dayRow(iso) {
  const m = mlDay(iso), tg = ml.targets(iso), rs = ru.scoreFor(iso), rd0 = ru.day(iso), by = minsBy(iso), wb = itemsOn(iso), gc = gpCore();
  const chMins = (rd('ch:day-' + iso)?.secs || 0) / 60, chGoal = spanishGoal();
  const ruTrain = (rd0?.sessions || []).reduce((a, s) => a + (Number(s.mins) || 0), 0);
  const wbTrain = wb.filter((i) => i.done && ['practice', 'game', 'lift'].includes(i.type)).reduce((a, i) => a + i.mins, 0);
  const train = Math.max(ruTrain, (by.practice || 0) + (by.training || 0), wbTrain);
  const study = (by.homework || 0) + wb.filter((i) => i.done && ['homework', 'study'].includes(i.type)).reduce((a, i) => a + i.mins, 0);
  const tops = gc.tasks.filter((t) => t.top === iso), night = nightState(iso);
  const finished = gc.tasks.filter((t) => t.done && t.doneAt && isoDate(new Date(t.doneAt)) === iso).length;
  const phoneGoal = gc.settings?.phoneGoal || 120, tracked = (gpDay(iso)?.entries || []).length > 0;
  const r = { iso, ml: m, tg, ru: rs, sleepH: rd0?.checkin?.sleepH ?? null, sore: rd0?.checkin?.soreness ?? null, checkin: !!rd0?.checkin, by, train, study, tops, night, finished, phoneGoal, chMins, chGoal };
  r.fuel = m && m.n ? 0.4 * clamp(m.p / tg.protein) + 0.3 * clamp(1 - Math.abs(m.cal - tg.calories) / (tg.calories * 0.5)) + 0.3 * clamp(m.water / (tg.waterOz || 100)) : 0;
  r.str = clamp(train / 90);
  r.rec = (r.sleepH != null ? 0.7 * clamp(r.sleepH / 9) : 0) + (night.total ? 0.3 * (night.done / night.total) : 0) + (r.sleepH == null && night.total ? 0.3 * (night.done / night.total) : 0);
  r.iq = clamp(0.7 * clamp(study / 60) + 0.3 * clamp(chMins / chGoal));
  const parts = [], active = (m?.n ? 1 : 0) + (r.checkin ? 1 : 0) + (chMins > 0 ? 1 : 0) + (tracked || tops.length || night.done ? 1 : 0);
  if (tops.length) parts.push(tops.filter((t) => t.done).length / Math.max(3, tops.length));
  if (by.phone != null) parts.push(clamp(1 - (by.phone - phoneGoal) / phoneGoal));
  parts.push(clamp(active / 3));
  r.dsc = active || train || study ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  r.any = active > 0 || train > 0 || study > 0;
  r.score = r.any ? Math.round(((r.fuel + r.str + r.rec + r.iq + r.dsc) / 5) * 100) : null;
  return r;
}
export const TIERS = [[94, 'D1 Ready'], [88, 'All-State'], [80, 'All-Conference'], [72, 'Starter'], [62, 'Rotation'], [0, 'Bench']];
export function ovr() {
  const last = Array.from({ length: 14 }, (_, i) => row(shiftIso(todayIso(), -i))), a = (k) => last.reduce((s, x) => s + x[k], 0) / 14;
  const r = { fuel: a('fuel'), str: clamp(last.reduce((s, x) => s + x.str, 0) / 10), rec: a('rec'), iq: a('iq'), dsc: a('dsc') };
  const R = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(45 + 54 * clamp(v))]));
  const total = Math.round((R.fuel * 1.1 + R.str * 1.2 + R.rec + R.iq * 0.8 + R.dsc * 0.9) / 5);
  return { total, R, tier: TIERS.find(([m]) => total >= m)[1] };
}
export const HABITS = [
  { name: 'Logged food', test: (r) => (r.ml?.n ? true : r.any ? false : null) },
  { name: 'Hit protein', test: (r) => (r.ml?.n ? r.ml.p >= r.tg.protein * 0.95 : r.any ? false : null) },
  { name: 'Water goal', test: (r) => (r.ml ? r.ml.water >= r.tg.waterOz : r.any ? false : null) },
  { name: 'Trained 60+ min', test: (r) => (r.any ? r.train >= 60 : null) },
  { name: 'Checked in', test: (r) => (r.any ? r.checkin : null) },
  { name: 'Slept 8+ hours', test: (r) => (r.sleepH != null ? r.sleepH >= 8 : null) },
  { name: 'Top 3 done', test: (r) => (r.tops.length ? r.tops.every((t) => t.done) : null) },
  { name: 'Night routine', test: (r) => (r.night.total && r.any ? r.night.done === r.night.total : null) },
  { name: 'Spanish goal', test: (r) => (r.any ? r.chMins >= r.chGoal : null) },
  { name: 'Phone under goal', test: (r) => (r.by.phone != null ? r.by.phone <= r.phoneGoal : null) },
];
export function streakOf(h) { let d = todayIso(), k = 0; if (!h.test(row(d))) d = shiftIso(d, -1); while (h.test(row(d)) && k < 365) { k++; d = shiftIso(d, -1); } return k; }
export const hasAnyData = () => { try { return Object.keys(localStorage).some((k) => /^(ml|ru|wb|gp|ch):/.test(k)); } catch { return false; } };
