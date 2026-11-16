// MacroLens data: ml:core and ml:day-YYYY-MM-DD. Same math as MacroLens so numbers match in both apps.
import { rd, wr, mut } from './store.js';
import { todayIso, shiftIso, mondayOf, weekdayNum, toMin, r1, clamp } from './util.js';
import { FOODS } from './foods.js';
export { FOODS };

export const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']];
export const mealLabel = (k) => (MEALS.find(([m]) => m === k) || MEALS[3])[1];
export const ACTIVITY = {
  sedentary: { label: 'Sedentary (little exercise)', factor: 1.2 },
  light: { label: 'Light (1-3 workouts/week)', factor: 1.375 },
  moderate: { label: 'Moderate (3-5 workouts/week)', factor: 1.55 },
  very: { label: 'Very active (6-7 workouts/week)', factor: 1.725 },
  athlete: { label: 'Athlete (daily practice + lifting)', factor: 1.9 },
};
export const GOALS = { lose: { label: 'Lean out (slow cut)', delta: -400 }, maintain: { label: 'Maintain / perform', delta: 0 }, gain: { label: 'Build muscle (lean bulk)', delta: 300 } };
export const MICROS = [
  { k: 'fiber', label: 'Fiber', unit: 'g', kind: 'goal' }, { k: 'sugar', label: 'Added sugar', unit: 'g', kind: 'limit' },
  { k: 'sodium', label: 'Sodium', unit: 'mg', kind: 'limit' }, { k: 'iron', label: 'Iron', unit: 'mg', kind: 'goal' }, { k: 'calcium', label: 'Calcium', unit: 'mg', kind: 'goal' },
];
const MICRO_KEYS = MICROS.map((m) => m.k);
const roundMicro = (k, v) => (k === 'sodium' || k === 'calcium' ? Math.round(v) : r1(v));
export const hasMicros = (f) => MICRO_KEYS.some((k) => f[k] != null);

const blankCore = () => ({ profile: null, targets: null, overrides: {}, custom: [], recents: [], weights: [] });
export const blankDay = () => ({ breakfast: [], lunch: [], dinner: [], snacks: [], water: 0 });
export const core = () => rd('ml:core') || blankCore();
export const day = (iso) => rd('ml:day-' + iso);
export const saveCore = (fn) => mut('ml:core', fn, blankCore);
export const saveDay = (iso, fn) => mut('ml:day-' + iso, fn, blankDay);

export function computeTargets(p) {
  const kg = p.weightLb * 0.45359237, cm = p.heightIn * 2.54;
  if (!(kg > 0 && cm > 0 && p.age > 0)) throw new Error('Enter a positive age, height and weight');
  const act = ACTIVITY[p.activity] || ACTIVITY.moderate, goal = GOALS[p.goal] || GOALS.maintain;
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'female' ? -161 : 5), tdee = bmr * act.factor;
  const calories = Math.max(1600, Math.round((tdee + goal.delta) / 10) * 10);
  const protein = Math.round(p.weightLb * (p.goal === 'maintain' ? 0.9 : 1));
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const waterOz = Math.round(p.weightLb * 0.5 + (act.factor >= 1.725 ? 24 : 12));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, carbs, fat, waterOz };
}
export function microTargets(t) {
  const p = core().profile, age = p?.age ?? 16, female = p?.sex === 'female';
  return {
    fiber: Math.min(45, Math.max(25, Math.round((t.calories * 14) / 1000))), sugar: Math.round((t.calories * 0.1) / 4), sodium: 2300,
    iron: female ? (age <= 18 ? 15 : 18) : age <= 18 ? 11 : 8, calcium: age <= 18 ? 1300 : 1000,
  };
}
export function scale(f, s = 1) {
  s = Number(s) || 0;
  const o = { calories: Math.round((f.calories || 0) * s), protein: r1((f.protein || 0) * s), carbs: r1((f.carbs || 0) * s), fat: r1((f.fat || 0) * s) };
  for (const k of MICRO_KEYS) if (f[k] != null) o[k] = roundMicro(k, f[k] * s);
  return o;
}
export function totals(entries) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 }, m = Object.fromEntries(MICRO_KEYS.map((k) => [k, 0]));
  let missing = 0;
  for (const e of entries) {
    const n = scale(e, e.servings ?? 1);
    for (const k in t) t[k] += n[k];
    if (!hasMicros(e)) missing++;
    for (const k of MICRO_KEYS) m[k] += n[k] || 0;
  }
  for (const k in t) t[k] = k === 'calories' ? Math.round(t[k]) : r1(t[k]);
  for (const k of MICRO_KEYS) m[k] = roundMicro(k, m[k]);
  return { ...t, ...m, missing };
}
export const entriesOf = (iso) => { const d = day(iso); return d ? MEALS.flatMap(([k]) => d[k] || []) : []; };

// Practice from Weekboard (same website): first practice or game with a start time that day.
export function weekboardPractice(iso) {
  const wc = rd('wb:core'); if (!wc) return null;
  const wd = weekdayNum(iso), w = rd('wb:w-' + mondayOf(iso)) || {};
  const list = [...(wc.rules || []).filter((r) => (r.days || []).includes(wd) && !w.skip?.[`${r.id}|${iso}`]), ...(w.items || []).filter((i) => i.date === iso)]
    .filter((x) => (x.type === 'practice' || x.type === 'game') && x.start).sort((a, b) => toMin(a.start) - toMin(b.start));
  return list[0] ? { start: list[0].start, mins: Number(list[0].mins) || 120, title: list[0].title, from: 'weekboard' } : null;
}
export function practiceOn(iso) { const d = day(iso); return d?.practice || (d?.type === 'rest' ? null : iso === todayIso() ? weekboardPractice(iso) : null); }
export function readyUpScore(iso) {
  const c = rd('ru:day-' + iso)?.checkin; if (!c) return null;
  const goal = Number(rd('ru:core')?.settings?.goal) || 9;
  const s = Math.round(clamp((c.sleepH - (goal - 3.5)) / 3.5) * 30 + ((c.quality - 1) / 4) * 15 + ((5 - c.soreness) / 4) * 20 + ((c.energy - 1) / 4) * 15 + ((5 - c.stress) / 4) * 10 + 8);
  return Number.isFinite(s) ? clamp(s, 0, 100) : null;
}
const gameStarts = (g) => (g.games?.length ? g.games : [g.start]).filter(Boolean);

/** Daily targets, matching MacroLens: overrides, sweat-based water, heavy/long-practice carbs, ReadyUp recovery bump, rest-day carb cut. */
export function targets(iso) {
  const c = core(), dd = iso ? day(iso) : null;
  const base = c.targets ?? { calories: 2800, protein: 140, carbs: 390, fat: 84, waterOz: 100 };
  const t = { ...base, ...Object.fromEntries(Object.entries(c.overrides || {}).filter(([, v]) => v > 0)) };
  const sw = c.sweat;
  if (sw?.rate && iso && dd?.type !== 'rest') {
    const g = c.game, prx = dd?.practice || (iso === todayIso() ? weekboardPractice(iso) : null);
    const mins = g && g.date === iso ? 75 * gameStarts(g).length : prx ? Number(prx.mins) : 0;
    const b = (c.profile?.weightLb ?? 150) * 0.5;
    if (mins) t.waterOz = Math.max(t.waterOz, Math.round(Math.min(b + (sw.rate * mins) / 60, b + 140)));
  }
  if (iso && dd?.type !== 'rest') {
    const notes = [], on = c.prefs?.smart !== false;
    if (dd?.type === 'heavy') { const add = Math.round(t.carbs * 0.25); t.carbs += add; t.calories += add * 4; notes.push(`Heavy day: +${add} g carbs`); }
    else if (on) { const pr = practiceOn(iso); if (pr && Number(pr.mins) >= 150) { const add = Math.round(t.carbs * 0.15); t.carbs += add; t.calories += add * 4; notes.push(`Long practice: +${add} g carbs`); } }
    if (on && iso === todayIso()) { const r = readyUpScore(iso); if (r != null && r < 55) { const add = Math.round(t.carbs * 0.1); t.protein += 15; t.carbs += add; t.calories += 60 + add * 4; t.waterOz += 16; notes.push(`Readiness ${r}: +15 g protein, +16 oz water`); } }
    if (notes.length) t.adj = notes;
  }
  if (iso && dd?.type === 'rest') { const cut = Math.round(t.carbs * 0.3); return { ...t, carbs: t.carbs - cut, calories: t.calories - cut * 4, rest: true }; }
  return t;
}

// ---------- logging ----------
let undoSnap = null;
export function snapshot(iso) { undoSnap = { iso, json: JSON.stringify(day(iso)) }; }
export function undo() { if (!undoSnap) return false; const { iso, json } = undoSnap; undoSnap = null; wr('ml:day-' + iso, JSON.parse(json) ?? blankDay()); return true; }
export function addEntry(iso, meal, food, servings = 1) {
  const { servings: _s, addedAt: _a, ...base } = food;
  saveDay(iso, (d) => { (d[meal] ||= []).push({ ...base, servings: Number(servings) || 1, addedAt: Date.now() }); });
  const key = (f) => `${f.name}|${f.serving}`;
  saveCore((c) => { c.recents = [base, ...(c.recents || []).filter((r) => key(r) !== key(base))].slice(0, 25); });
  writeWidget();
}
export function updateEntry(iso, meal, idx, patch, toMeal) {
  saveDay(iso, (d) => {
    const e = d[meal]?.[idx]; if (!e) return;
    Object.assign(e, patch);
    if (toMeal && toMeal !== meal) { d[meal].splice(idx, 1); (d[toMeal] ||= []).push(e); }
  });
  writeWidget();
}
export function removeEntry(iso, meal, idx) { saveDay(iso, (d) => { d[meal]?.splice(idx, 1); }); writeWidget(); }
export function addWater(iso, oz) { let v = 0; saveDay(iso, (d) => { d.water = v = Math.max(0, (d.water || 0) + oz); }); return v; }
export function setDayType(iso, type) { saveDay(iso, (d) => { if (type === 'training') delete d.type; else d.type = type; }); }
export function copyMeal(fromIso, toIso, meal) {
  const items = day(fromIso)?.[meal] || [];
  for (const it of items) addEntry(toIso, meal, it, it.servings ?? 1);
  return items.length;
}
export function saveMealTemplate(iso, meal) {
  const items = (day(iso)?.[meal] || []).map(({ addedAt, ...f }) => f); if (!items.length) return null;
  const name = items.length === 1 ? items[0].name : `${items[0].name} + ${items.length - 1} more`;
  saveCore((c) => { c.meals = [{ id: 'm' + Date.now(), name, items }, ...(c.meals || []).filter((m) => m.name !== name)].slice(0, 30); });
  return name;
}
export function saveCustom(food) { saveCore((c) => { c.custom = [food, ...(c.custom || []).filter((x) => x.name !== food.name)].slice(0, 80); }); }
export function defaultMeal() { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }

// Locker / Scoreboard widget, same shape MacroLens writes.
export function writeWidget() {
  const iso = todayIso(), t = targets(iso), tot = totals(entriesOf(iso));
  try { const prev = rd('mlw:today'); wr('mlw:today', { date: iso, kcalLeft: t.calories - tot.calories, protein: Math.round(tot.protein), pTarget: t.protein, next: prev?.date === iso ? prev.next ?? null : null }); } catch {}
}

export function searchFoods(q) {
  const c = core(), words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (f) => words.every((w) => f.name.toLowerCase().includes(w));
  const meals = (c.meals || []).filter((m) => !words.length || match(m));
  const pool = words.length ? [...(c.custom || []), ...(c.recents || []), ...FOODS].filter(match) : [...(c.custom || []), ...(c.recents || [])];
  const seen = new Set(), foods = pool.filter((f) => { const k = f.name + '|' + f.serving; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
  return { meals, foods };
}

export async function fetchBarcode(code) {
  const saved = core().barcodes?.[code]; if (saved) return saved;
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('http ' + r.status);
  const j = await r.json(), pr = j.product; if (!pr || j.status === 0) return null;
  const n = pr.nutriments || {}, q = Number(pr.serving_quantity) || 0;
  const per = (k) => { const sv = n[k + '_serving']; if (sv != null && sv !== '') return Number(sv); const h = n[k + '_100g']; if (h == null || h === '') return null; return q ? (Number(h) * q) / 100 : Number(h); };
  const kcal = per('energy-kcal'); if (kcal == null || !Number.isFinite(kcal)) return null;
  const brand = String(pr.brands || '').split(',')[0].trim(), pn = String(pr.product_name || '').trim();
  const name = (brand && !pn.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${pn}` : pn || brand).slice(0, 80) || 'Packaged food';
  const food = { id: 'bc' + code, source: 'barcode', barcode: code, name, serving: pr.serving_size || (q ? `${q} g` : '100 g'), calories: Math.round(kcal), protein: r1(per('proteins') || 0), carbs: r1(per('carbohydrates') || 0), fat: r1(per('fat') || 0) };
  const mg = (v) => (v == null ? null : v * 1000);
  for (const [k, v] of Object.entries({ fiber: per('fiber'), sugar: per('added-sugars'), sodium: mg(per('sodium')), iron: mg(per('iron')), calcium: mg(per('calcium')) })) if (v != null && Number.isFinite(v)) food[k] = roundMicro(k, v);
  saveCore((c) => { c.barcodes = { ...(c.barcodes || {}), [code]: food }; });
  return food;
}

// ---------- caffeine (teens: 100 mg/day max) ----------
const CAFFEINE = [[/\bred ?bull\b/, 80], [/\bmonster\b/, 160], [/\bcelsius\b/, 200], [/\bbang\b/, 300], [/\bghost energy\b/, 200], [/\bc4\b/, 200], [/\breign\b/, 300], [/\bprime energy\b/, 200],
  [/\bpre.?workout\b/, 200], [/\benergy drink\b/, 160], [/\bcold brew\b/, 200], [/\b(espresso|latte|cappuccino|americano|macchiato|mocha)\b/, 130], [/\b(frappuccino|frappe)\b/, 100],
  [/\bcoffee\b/, 95], [/\bmatcha\b/, 70], [/\bgreen tea\b/, 28], [/\b(iced|sweet|black|chai)? ?tea\b/, 47], [/\b(mountain|mtn) dew\b/, 54], [/\bdiet coke\b/, 46], [/\bdr\.? ?pepper\b/, 41],
  [/\bpepsi\b/, 38], [/\b(coke|coca.?cola)\b/, 34], [/\bdark chocolate\b/, 20]];
export function caffeineOf(e) {
  const s = e.servings ?? 1; if (e.caffeine != null) return e.caffeine * s;
  const n = String(e.name || '').toLowerCase(); if (/decaf|caffeine.?free/.test(n)) return 0;
  for (const [re, mg] of CAFFEINE) if (re.test(n)) return mg * s;
  return 0;
}

// ---------- weight ----------
export function logWeight(iso, lb) { saveCore((c) => { c.weights = [...(c.weights || []).filter((w) => w.date !== iso), { date: iso, lb }].sort((a, b) => a.date.localeCompare(b.date)); }); }
export const dayDates = (n, end = todayIso()) => Array.from({ length: n }, (_, i) => shiftIso(end, i - n + 1));
