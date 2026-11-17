// ===================== nutrition (same math as MacroLens) =====================
const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']];
const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, athlete: 1.9 };
const GOAL_DELTA = { lose: -400, maintain: 0, gain: 300 };
const entriesOf = (date) => { const d = dayDoc(date); return d ? MEALS.flatMap(([k]) => d[k] || []) : []; };
function totalsOf(date) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entriesOf(date)) { const s = Number(e.servings ?? 1) || 0; for (const k in t) t[k] += (Number(e[k]) || 0) * s; }
  return { calories: Math.round(t.calories), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
}
const exList = (date) => dayDoc(date)?.exercise || [];
const exerciseKcal = (date) => exList(date).reduce((a, x) => a + (Number(x.kcal) || 0), 0);
/** Mirrors MacroLens targets(): base targets, coach overrides, water goal, heavy/long-practice carbs, logged exercise, rest days. */
function targets(date) {
  const c = core();
  const base = c.targets ?? { calories: 2800, protein: 140, carbs: 390, fat: 84, waterOz: 100 };
  const o = c.overrides || {};
  const t = { ...base, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v > 0)) };
  if (Number(c.prefs?.waterGoal) >= 32) t.waterOz = Number(c.prefs.waterGoal);
  const dd = date ? dayDoc(date) : null;
  if (dd?.type !== 'rest' && date) {
    if (exerciseKcal(date) > 0) { /* exercise sets calories below */ }
    else if (dd?.type === 'heavy') { const add = Math.round(t.carbs * 0.25); t.carbs += add; t.calories += add * 4; }
    else if (c.prefs?.smart !== false && dd?.practice && Number(dd.practice.mins) >= 150) { const add = Math.round(t.carbs * 0.15); t.carbs += add; t.calories += add * 4; }
  }
  const ex = date ? exerciseKcal(date) : 0;
  if (ex > 0) {
    const p = c.profile, f = ACTIVITY[p?.activity] ?? 1.55, delta = GOAL_DELTA[p?.goal] ?? 0;
    const b = Math.round(((t.calories - delta) * (Math.min(1.375, f) / f) + delta) / 10) * 10;
    const cal = b + ex, diff = cal - t.calories;
    return { ...t, calories: cal, carbs: Math.max(100, Math.round(t.carbs + diff / 4)) };
  }
  if (dd?.type === 'rest') { const cut = Math.round(t.carbs * 0.3); return { ...t, carbs: t.carbs - cut, calories: t.calories - cut * 4 }; }
  return t;
}
const hasFood = (date) => entriesOf(date).length > 0;
const waterOf = (date) => Number(dayDoc(date)?.water) || 0;
function addWater(oz) {
  const iso = todayIso(), d = dayDoc(iso, true);
  d.water = Math.max(0, (Number(d.water) || 0) + oz);
  if (oz > 0) d.waterLog = [...(d.waterLog || []), { at: Date.now(), oz, kind: 'water', label: 'Water' }].slice(-80);
  persist('day-' + iso);
}

// ===================== training =====================
// MacroLens workout types, grouped into the categories the charts stack.
const EX_TYPES = [
  ['practice', 'Practice', 6.5, 'hoops'], ['game', 'Game', 8, 'hoops'], ['skill', 'Skill workout', 5.5, 'hoops'], ['shooting', 'Shooting', 4.5, 'hoops'],
  ['lift', 'Lifting', 5, 'strength'], ['conditioning', 'Conditioning', 9, 'cond'], ['run', 'Running', 9.8, 'cond'], ['bike', 'Biking', 7, 'cond'],
  ['speed', 'Speed / agility', 8, 'cond'], ['recovery', 'Recovery / mobility', 2.5, 'other'], ['walk', 'Walking', 3.5, 'other'], ['other', 'Other', 5, 'other'],
];
const CATS = [['hoops', 'Basketball', 'var(--hb)'], ['strength', 'Strength', 'var(--str)'], ['cond', 'Conditioning', 'var(--cond)'], ['other', 'Other', 'var(--oth)']];
const EX_INT = { light: 0.8, moderate: 1, hard: 1.2 };
const catOf = (type) => EX_TYPES.find((x) => x[0] === type)?.[3] || 'other';
const exBurn = (type, mins, int) => Math.round((EX_TYPES.find((x) => x[0] === type)?.[2] ?? 5) * (EX_INT[int] ?? 1) * (core().profile?.weightLb ?? 150) * 0.4536 * (Number(mins) / 60));
function trainingOf(date) {
  const by = { hoops: 0, strength: 0, cond: 0, other: 0 };
  let load = 0;
  for (const x of exList(date)) { const m = Number(x.mins) || 0; by[catOf(x.type)] += m; load += m * (EX_INT[x.int] ?? 1); }
  return { by, mins: sum(Object.values(by)), sessions: exList(date).length, load };
}
// Activity level for the heatmap: none / light / moderate / high / exceptional (by intensity-weighted minutes).
function activityLevel(date) {
  const t = trainingOf(date);
  if (!t.sessions) return 0;
  return t.load >= 180 ? 4 : t.load >= 105 ? 3 : t.load >= 50 ? 2 : 1;
}
const isActive = (date) => exList(date).length > 0;
function streaks(end = todayIso()) {
  const days = allDayKeys().filter(isActive);
  if (!days.length) return { current: 0, longest: 0, total: 0 };
  const set = new Set(days);
  let cur = 0, d = end;
  if (!set.has(d)) d = shiftIso(d, -1);
  while (set.has(d)) { cur++; d = shiftIso(d, -1); }
  let longest = 0, run = 0, prev = null;
  for (const x of days) { run = prev && daysBetween(prev, x) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = x; }
  return { current: cur, longest, total: days.length };
}
function addWorkout(date, rec) {
  const d = dayDoc(date, true);
  d.exercise = [...(d.exercise || []), { id: 'x' + Date.now(), addedAt: Date.now(), ...rec, kcal: exBurn(rec.type, rec.mins, rec.int) }];
  if (d.type === 'rest' && ['practice', 'game', 'conditioning', 'lift'].includes(rec.type)) d.type = 'training';
  persist('day-' + date);
}

// ===================== recovery =====================
const healthDay = (d) => core().health?.days?.[d] || null;
function recoveryInputs(date) {
  const f = dayDoc(date)?.feel || {}, h = healthDay(date) || {};
  return { sleepH: f.sleepH ?? h.sleepH ?? null, energy: f.energy ?? null, sore: f.sore ?? null, rhr: f.rhr ?? h.rhr ?? null, hrv: f.hrv ?? h.hrv ?? null };
}
function baselineOf(key, date, n = 21) {
  const v = lastNDays(n, shiftIso(date, -1)).map((d) => recoveryInputs(d)[key]).filter((x) => x != null);
  return v.length >= 4 ? mean(v) : null;
}
/** 0-100 only when at least two real inputs exist. Heart-rate parts compare you with your own recent baseline. */
function recoveryScore(date) {
  const r = recoveryInputs(date), parts = [];
  if (r.sleepH != null) parts.push(['Sleep', clamp01((r.sleepH - 4.5) / 4.5), 1.4]);
  if (r.energy != null) parts.push(['Energy', (r.energy - 1) / 4, 1]);
  if (r.sore != null) parts.push(['Soreness', (5 - r.sore) / 4, 1]);
  const rb = r.rhr != null ? baselineOf('rhr', date) : null;
  if (rb != null) parts.push(['Resting HR', clamp01(0.6 - (r.rhr - rb) / 12), 0.8]);
  const hb = r.hrv != null ? baselineOf('hrv', date) : null;
  if (hb != null) parts.push(['HRV', clamp01(0.6 + (r.hrv - hb) / (hb * 0.5)), 0.8]);
  if (parts.length < 2) return null;
  const w = sum(parts.map((p) => p[2]));
  return { score: Math.round((sum(parts.map((p) => p[1] * p[2])) / w) * 100), parts, inputs: r };
}
const recBand = (s) => (s >= 70 ? ['hi', 'High'] : s >= 45 ? ['mid', 'Moderate'] : ['lo', 'Low']);
function setFeel(date, patch) {
  const d = dayDoc(date, true);
  d.feel = { ...(d.feel || {}), ...patch };
  for (const k in d.feel) if (d.feel[k] == null || d.feel[k] === '') delete d.feel[k];
  persist('day-' + date);
}

// ===================== tests & personal records =====================
// better: which direction is an improvement. Each test can hold any number of dated results.
const TESTS = [
  ['sprint10', '10-yard sprint', 's', 'lower', 'Speed'], ['sprint20', '20-yard sprint', 's', 'lower', 'Speed'], ['sprint40', '40-yard sprint', 's', 'lower', 'Speed'],
  ['lane', 'Lane agility', 's', 'lower', 'Speed'], ['shuttle', '5-10-5 shuttle', 's', 'lower', 'Speed'],
  ['vert', 'Vertical jump', 'in', 'higher', 'Jumping'], ['standvert', 'Standing vertical', 'in', 'higher', 'Jumping'], ['appvert', 'Approach vertical', 'in', 'higher', 'Jumping'], ['broad', 'Broad jump', 'in', 'higher', 'Jumping'],
  ['bench', 'Bench press', 'lb', 'higher', 'Strength'], ['squat', 'Squat', 'lb', 'higher', 'Strength'], ['deadlift', 'Deadlift', 'lb', 'higher', 'Strength'], ['pullups', 'Pull-ups (max reps)', 'reps', 'higher', 'Strength'],
  ['ft', 'Free throws (made of 50)', 'made', 'higher', 'Basketball'], ['three', '3-pt test (made of 50)', 'made', 'higher', 'Basketball'], ['spotup', 'Spot-up shooting (made of 100)', 'made', 'higher', 'Basketball'],
  ['handles', 'Ball-handling circuit', 's', 'lower', 'Basketball'], ['beep', 'Beep test level', 'level', 'higher', 'Conditioning'], ['mile', 'Mile run', 's', 'lower', 'Conditioning'], ['suicides', 'Suicides (4 in a row)', 's', 'lower', 'Conditioning'],
].map(([id, name, unit, better, group]) => ({ id, name, unit, better, group }));
const TEST_GROUPS = ['Speed', 'Jumping', 'Strength', 'Basketball', 'Conditioning', 'Custom'];
const allTests = () => [...TESTS, ...(aos().customTests || []).map((t) => ({ ...t, group: 'Custom', custom: true }))];
const testById = (id) => allTests().find((t) => t.id === id);
const resultsOf = (id) => (doc('aos-tests').results || []).filter((r) => r.test === id).sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));
const betterOf = (t, a, b) => (t.better === 'lower' ? Math.min(a, b) : Math.max(a, b));
function prOf(id) {
  const t = testById(id), rs = resultsOf(id);
  if (!t || !rs.length) return null;
  let best = rs[0];
  for (const r of rs) if ((t.better === 'lower' && r.value < best.value) || (t.better !== 'lower' && r.value > best.value)) best = r;
  return best;
}
/** % improvement where positive always means better. */
function improvePct(t, from, to) {
  if (!from) return null;
  return t.better === 'lower' ? ((from - to) / from) * 100 : ((to - from) / from) * 100;
}
const fmtVal = (t, v) => {
  if (v == null) return '—';
  if (t.unit === 's' && v >= 60) { const m = Math.floor(v / 60), s = r1(v - m * 60); return `${m}:${String(s.toFixed(s % 1 ? 1 : 0)).padStart(2, '0')}`; }
  return `${t.unit === 's' ? r2(v) : r1(v)}${t.unit === 's' ? 's' : t.unit === 'in' ? '"' : t.unit === 'lb' ? ' lb' : ' ' + t.unit}`;
};
function allPRs() {
  // Every result that beat everything before it, in date order: the PR history.
  const out = [];
  for (const t of allTests()) {
    let best = null;
    for (const r of resultsOf(t.id)) { if (best == null || betterOf(t, best, r.value) === r.value && r.value !== best) { if (best != null) out.push({ t, r, prev: best }); best = r.value; } }
  }
  return out.sort((a, b) => b.r.date.localeCompare(a.r.date));
}

// ===================== basketball =====================
// Court zones use the Court Lab spot ids so MacroLens's Performance DNA can read the same shooting sessions.
const ZONES = [
  { id: 'lay', name: 'At the rim', pts: 2, x: 250, y: 70 }, { id: 'lbm', name: 'L baseline', pts: 2, x: 120, y: 75 }, { id: 'rbm', name: 'R baseline', pts: 2, x: 380, y: 75 },
  { id: 'le', name: 'L elbow', pts: 2, x: 170, y: 190 }, { id: 'ft', name: 'Free throw', pts: 1, x: 250, y: 200 }, { id: 're', name: 'R elbow', pts: 2, x: 330, y: 190 },
  { id: 'lc3', name: 'L corner 3', pts: 3, x: 40, y: 60 }, { id: 'lw3', name: 'L wing 3', pts: 3, x: 85, y: 245 }, { id: 'top3', name: 'Top 3', pts: 3, x: 250, y: 320 },
  { id: 'rw3', name: 'R wing 3', pts: 3, x: 415, y: 245 }, { id: 'rc3', name: 'R corner 3', pts: 3, x: 460, y: 60 },
];
const SHOT_CATS = [['cs3', 'Catch-and-shoot 3s'], ['otd3', 'Off-the-dribble 3s'], ['corner3', 'Corner 3s'], ['mid', 'Midrange pull-ups'], ['ftc', 'Free throws'], ['fin', 'Finishing'], ['float', 'Floaters']];
const shotSessions = () => [...(doc('aos-shots').sessions || [])].sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));
function sessionTotals(s) {
  let m = 0, a = 0, m3 = 0, a3 = 0;
  for (const [z, v] of Object.entries(s.spots || {})) { m += v.m || 0; a += v.a || 0; if (/3$/.test(z)) { m3 += v.m || 0; a3 += v.a || 0; } }
  for (const [k, v] of Object.entries(s.cats || {})) { m += v.m || 0; a += v.a || 0; if (/3$/.test(k)) { m3 += v.m || 0; a3 += v.a || 0; } }
  return { m, a, m3, a3, pct: a ? m / a : null };
}
function zoneAgg(sessions) {
  const z = {}; for (const zz of ZONES) z[zz.id] = { m: 0, a: 0 };
  for (const s of sessions) for (const [id, v] of Object.entries(s.spots || {})) if (z[id]) { z[id].m += v.m || 0; z[id].a += v.a || 0; }
  return z;
}
function catAgg(sessions) {
  const c = {}; for (const [id] of SHOT_CATS) c[id] = { m: 0, a: 0 };
  const add = (k, v) => { if (v) { c[k].m += v.m || 0; c[k].a += v.a || 0; } };
  for (const s of sessions) {
    for (const [id, v] of Object.entries(s.cats || {})) if (c[id]) add(id, v);
    const sp = s.spots || {};
    add('ftc', sp.ft); add('fin', sp.lay); add('corner3', sp.lc3); add('corner3', sp.rc3);
    for (const z of ['lc3', 'lw3', 'top3', 'rw3', 'rc3']) { if (s.style === 'cs') add('cs3', sp[z]); if (s.style === 'otd') add('otd3', sp[z]); }
    if (s.style === 'otd') for (const z of ['le', 're', 'lbm', 'rbm']) add('mid', sp[z]);
  }
  return c;
}
// Mirror sessions into Court Lab's storage key so MacroLens Performance DNA sees them on this device.
function mirrorCourtLab() {
  try {
    const own = shotSessions().map((s) => ({ at: s.at || parseIso(s.date).getTime(), spots: s.spots || {}, src: 'aos' }));
    const prev = JSON.parse(localStorage.getItem('cl:shots') || '[]').filter((x) => x.src !== 'aos');
    localStorage.setItem('cl:shots', JSON.stringify([...prev, ...own]));
  } catch {}
}
const games = () => [...(doc('aos-games').games || [])].sort((a, b) => a.date.localeCompare(b.date));
const gamePct = (m, a) => (a ? m / a : null);

// ===================== body =====================
function bodySeries(key) {
  if (key === 'weight') return (core().weights || []).map((w) => ({ date: w.date, v: Number(w.lb) })).filter((p) => p.v > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (['waist', 'chest', 'arm', 'thigh'].includes(key)) return (core().measures || []).filter((m) => m[key] != null).map((m) => ({ date: m.date, v: Number(m[key]) })).sort((a, b) => a.date.localeCompare(b.date));
  return (doc('aos-body').entries || []).filter((e) => e[key] != null).map((e) => ({ date: e.date, v: Number(e[key]) })).sort((a, b) => a.date.localeCompare(b.date));
}
const BODY_METRICS = [['weight', 'Body weight', 'lb'], ['bf', 'Body fat', '%'], ['muscle', 'Muscle mass', 'lb'], ['waist', 'Waist', 'in'], ['chest', 'Chest', 'in'], ['arm', 'Arm', 'in'], ['thigh', 'Thigh', 'in']];

// ===================== series and stats =====================
function seriesOf(fn, days) { return days.map((d) => ({ date: d, v: fn(d) })).filter((p) => p.v != null && Number.isFinite(p.v)); }
function pearson(ps) {
  const n = ps.length; if (n < 3) return null;
  const mx = mean(ps.map((p) => p[0])), my = mean(ps.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of ps) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!sxx || !syy) return null;
  const r = sxy / Math.sqrt(sxx * syy), slope = sxy / sxx;
  return { r, slope, icpt: my - slope * mx, n };
}
const strength = (r) => { const a = Math.abs(r); return a >= 0.6 ? 'strong' : a >= 0.4 ? 'moderate' : a >= 0.2 ? 'weak' : 'no clear'; };
// Daily variables for correlations. A blank day is missing, never zero.
const CORR_VARS = [
  ['sleep', 'Sleep', 'h', (d) => recoveryInputs(d).sleepH],
  ['energy', 'Energy (1-5)', '', (d) => recoveryInputs(d).energy],
  ['sore', 'Soreness (1-5)', '', (d) => recoveryInputs(d).sore],
  ['recovery', 'Recovery score', '', (d) => recoveryScore(d)?.score ?? null],
  ['water', 'Water', 'oz', (d) => (hasFood(d) || waterOf(d) ? waterOf(d) : null)],
  ['kcal', 'Calories', 'kcal', (d) => (hasFood(d) ? totalsOf(d).calories : null)],
  ['protein', 'Protein', 'g', (d) => (hasFood(d) ? totalsOf(d).protein : null)],
  ['carbs', 'Carbs', 'g', (d) => (hasFood(d) ? totalsOf(d).carbs : null)],
  ['volume', 'Training minutes', 'min', (d) => (allDayKeys().includes(d) ? trainingOf(d).mins : null)],
  ['rating', 'Workout rating (1-5)', '', (d) => { const r = exList(d).map((x) => x.rating).filter(Boolean); return r.length ? mean(r) : null; }],
  ['shotpct', 'Shooting %', '%', (d) => { const ss = shotSessions().filter((s) => s.date === d); const t = ss.reduce((a, s) => { const x = sessionTotals(s); return { m: a.m + x.m, a: a.a + x.a }; }, { m: 0, a: 0 }); return t.a >= 20 ? (t.m / t.a) * 100 : null; }],
  ['shots', 'Shots taken', '', (d) => { const ss = shotSessions().filter((s) => s.date === d); return ss.length ? sum(ss.map((s) => sessionTotals(s).a)) : null; }],
  ['rhr', 'Resting heart rate', 'bpm', (d) => recoveryInputs(d).rhr],
  ['steps', 'Steps', '', (d) => healthDay(d)?.steps ?? null],
];
const CORR_MIN = 7;
function corrPairs(xk, yk, days, lag = 0) {
  const X = CORR_VARS.find((v) => v[0] === xk), Y = CORR_VARS.find((v) => v[0] === yk);
  const ps = [];
  for (const d of days) { const x = X[3](d), y = Y[3](lag ? shiftIso(d, lag) : d); if (x != null && y != null) ps.push([x, y, d]); }
  return ps;
}

// ===================== weekly summary =====================
function weekStats(mon) {
  const days = lastNDays(7, shiftIso(mon, 6)).filter((d) => d <= todayIso());
  const t = days.map(trainingOf), food = days.filter(hasFood);
  const tg = (d) => targets(d);
  const protHit = food.filter((d) => totalsOf(d).protein >= tg(d).protein * 0.9).length;
  const kcalHit = food.filter((d) => { const r = totalsOf(d).calories / tg(d).calories; return r >= 0.85 && r <= 1.15; }).length;
  const waterDays = days.filter((d) => waterOf(d) > 0);
  const rec = days.map(recoveryScore).filter(Boolean).map((x) => x.score);
  const sleep = days.map((d) => recoveryInputs(d).sleepH).filter((x) => x != null);
  const prs = allPRs().filter((p) => p.r.date >= mon && p.r.date <= shiftIso(mon, 6));
  const shots = shotSessions().filter((s) => s.date >= mon && s.date <= shiftIso(mon, 6)).map(sessionTotals);
  const sm = sum(shots.map((s) => s.m)), sa = sum(shots.map((s) => s.a));
  return {
    mon, days: days.length, sessions: sum(t.map((x) => x.sessions)), mins: sum(t.map((x) => x.mins)),
    hoops: sum(t.map((x) => x.by.hoops)), strength: sum(t.map((x) => x.by.strength)), cond: sum(t.map((x) => x.by.cond)),
    hoopsN: sum(days.map((d) => exList(d).filter((x) => catOf(x.type) === 'hoops').length)), liftN: sum(days.map((d) => exList(d).filter((x) => catOf(x.type) === 'strength').length)),
    active: days.filter(isActive).length, foodDays: food.length, protHit, kcalHit,
    avgKcal: food.length ? Math.round(mean(food.map((d) => totalsOf(d).calories))) : null,
    avgProtein: food.length ? Math.round(mean(food.map((d) => totalsOf(d).protein))) : null,
    avgWater: waterDays.length ? Math.round(mean(waterDays.map(waterOf))) : null, waterGoalDays: days.filter((d) => waterOf(d) >= tg(d).waterOz * 0.9).length,
    avgRec: rec.length ? Math.round(mean(rec)) : null, avgSleep: sleep.length ? r1(mean(sleep)) : null, prs, shotM: sm, shotA: sa, shotPct: sa ? sm / sa : null,
  };
}
const pctChange = (a, b) => (a == null || b == null || !b ? null : ((a - b) / Math.abs(b)) * 100);
