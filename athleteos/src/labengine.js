// ===================== PERFORMANCE SIMULATION CENTER: ENGINE =====================
// Pure, deterministic math. Every projection takes a baseline SNAPSHOT (made from real data once) plus the user's
// inputs, and never reads live data itself, so a saved simulation reopens with exactly the same numbers.
// Nothing here writes to workouts, days, goals or the calendar. Simulations live only in the "aos-sim" doc.
//
// Formulas (also shown in the app under "How this is calculated"):
//  • Session load = minutes × RPE (same as the Load tab). Daily load = sum of sessions that day.
//  • Acute = last 7 days of load; chronic = last 28 days ÷ 4; ACWR = acute ÷ chronic once 21+ days of history exist;
//    monotony = mean ÷ SD of the last 7 daily loads; strain = acute × monotony. (Identical to loadStats.)
//  • A weekly plan is spread over its training days evenly; each session goes to the training day with the least load.
//  • Shooting volume = sessions × attempts. Shooting % paths use a rate per 1,000 attempts with diminishing returns
//    toward a ceiling (now + 25 points, max 90%): p = cap − (cap − p0)·e^(−rate·shots/(cap − p0)); rates limited to ±2 per 1,000. From your history (OLS of session % on
//    cumulative attempts, 5+ sessions over 14+ days) or, without that, editable general assumptions.
//  • Athletic tests: % change per 4 weeks from your test history (2+ results 14+ days apart) or general assumptions,
//    shrinking 15% each 4-week block, scaled by a focus factor √((new+0.5)/(now+0.5)) kept between 0.5 and 1.5, and
//    limited per 4 weeks (jumping 4%, speed 2%, strength 8%, conditioning 6%, basketball 6%).
BLANK['aos-sim'] = () => ({ scenarios: [] });
const LAB_MODEL = 'lab-1';
const SIM_TYPES = [
  ['shooting', 'Shooting', '#22c3ee'], ['handles', 'Ball handling', '#60a5fa'], ['finishing', 'Finishing', '#34d399'], ['skill', 'Skill (mixed)', '#8b5cff'],
  ['strength', 'Strength', '#f59e0b'], ['conditioning', 'Conditioning', '#f43f5e'], ['practice', 'Practice / games', '#3d8bff'],
];
const simType = (k) => SIM_TYPES.find((t) => t[0] === k) || SIM_TYPES[0];
const SIM_CAT = { shooting: 'shooting', handles: 'handles', finishing: 'finishing', skill: 'skill', strength: 'strength', conditioning: 'conditioning', practice: 'practice', game: 'practice' };
const DEFAULT_PLAN = () => ({ days: 4, items: { shooting: { n: 3, mins: 60, rpe: 5 }, handles: { n: 2, mins: 45, rpe: 5 }, finishing: { n: 0, mins: 45, rpe: 5 }, skill: { n: 0, mins: 60, rpe: 5 }, strength: { n: 2, mins: 50, rpe: 6 }, conditioning: { n: 1, mins: 40, rpe: 7 }, practice: { n: 0, mins: 120, rpe: 6 } }, attempts: 150 });
const clonePlan = (p) => JSON.parse(JSON.stringify(p));
const LIM = { days: [0, 7], n: [0, 14], mins: [0, 240], rpe: [1, 10], attempts: [0, 1500], weeks: [1, 26], sleepH: [4, 12], pct: [0, 100] };

// ---------- snapshot of real data (the baseline) ----------
function labSnapshot() {
  return cached('labSnap', () => {
    const today = todayIso(), d28 = lastNDays(28), ss = sessionsIn(d28);
    const items = {}; for (const [k] of SIM_TYPES) items[k] = { n: 0, mins: 0, rpe: 5, _m: [], _r: [] };
    for (const x of ss) { const k = SIM_CAT[x.cat]; if (!k) continue; items[k]._m.push(Number(x.mins) || 0); items[k]._r.push(sessionRPE(x)); }
    const def = DEFAULT_PLAN();
    for (const [k, it] of Object.entries(items)) { it.n = Math.round(it._m.length / 4); it.mins = it._m.length ? Math.round(mean(it._m) / 5) * 5 : def.items[k].mins; it.rpe = it._r.length ? Math.round(mean(it._r)) : def.items[k].rpe; delete it._m; delete it._r; }
    const active = d28.filter(isActive).length, sh = shootBaseline();
    const plan = ss.length ? { days: Math.round(active / 4), items, attempts: sh.attPerSession ? Math.round(sh.attPerSession) : def.attempts } : def;
    const sleeps = lastNDays(14).map((d) => recoveryInputs(d).sleepH).filter((v) => v != null);
    return {
      date: today, model: LAB_MODEL, plan, isDefault: !ss.length, sessions28: ss.length, activeDays28: active,
      loads28: d28.map(loadOf), history: loadStats().history, targetDays: Number(aos().profile?.weeklyDays) || null,
      sleepH: sleeps.length ? r1(mean(sleeps)) : null, sleepN: sleeps.length, shooting: sh, tests: testBaselines(),
    };
  });
}
/** Least squares y = a + b·x. Returns slope b and its standard error. */
function ols(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys); let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (!sxx) return null;
  const b = sxy / sxx, a = my - b * mx; let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (a + b * xs[i])) ** 2;
  return { a, b, se: Math.sqrt(sse / (n - 2) / sxx), n };
}
function shootBaseline() {
  const today = todayIso(), all = shotSessions().map((s) => ({ date: s.date, ...sessionTotals(s) })).filter((s) => s.a > 0);
  const r30 = all.filter((s) => daysBetween(s.date, today) < 30), r28 = all.filter((s) => daysBetween(s.date, today) < 28);
  const tot = (xs) => { const m = sum(xs.map((x) => x.m)), a = sum(xs.map((x) => x.a)); return a ? m / a : null; };
  const pct = r30.length ? tot(r30) : all.length ? tot(all.slice(-5)) : null;
  // Trend: session % vs cumulative attempts (thousands), sessions with 20+ attempts.
  let cum = 0; const xs = [], ys = [], pts = [];
  for (const s of all) { if (s.a >= 20) { xs.push(cum / 1000); ys.push(s.pct); pts.push({ date: s.date, v: r1(s.pct * 100), a: s.a }); } cum += s.a; }
  const span = pts.length ? daysBetween(pts[0].date, pts[pts.length - 1].date) : 0;
  const fit = xs.length >= 5 && span >= 14 ? ols(xs, ys) : null;
  return {
    pct: pct == null ? null : r1(pct * 100), sessions: all.length, totalAttempts: cum, attemptsPerWeek: Math.round(sum(r28.map((s) => s.a)) / 4),
    sessionsPerWeek: r1(r28.length / 4), attPerSession: r28.length ? Math.round(mean(r28.map((s) => s.a))) : all.length ? Math.round(mean(all.slice(-5).map((s) => s.a))) : null,
    trend: fit ? { per1000: r2(fit.b * 100), se: r2(fit.se * 100), n: fit.n, span } : null, pts: pts.slice(-40),
  };
}
const ATH_IDS = ['vert', 'appvert', 'standvert', 'broad', 'sprint10', 'sprint20', 'sprint40', 'lane', 'shuttle', 'squat', 'bench', 'deadlift', 'pullups', 'beep', 'mile', 'suicides'];
const ATH_ASSUME = { Jumping: [0, 1.5, 3], Speed: [0, 0.7, 1.5], Strength: [0, 3, 6], Conditioning: [0, 2, 4], Basketball: [0, 2, 4], Custom: [0, 1.5, 3] };
// Upper limit on % change per 4 weeks: short test histories exaggerate trends, so personal rates are capped here.
const ATH_MAX = { Jumping: 4, Speed: 2, Strength: 8, Conditioning: 6, Basketball: 6, Custom: 5 };
const ATH_FOCUS = { Jumping: 'strength', Speed: 'conditioning', Strength: 'strength', Conditioning: 'conditioning', Basketball: 'skill', Custom: 'strength' };
function testBaselines() {
  const out = {};
  for (const t of allTests()) {
    const rs = resultsOf(t.id); if (!rs.length) continue;
    const first = rs[0], last = rs[rs.length - 1], span = daysBetween(first.date, last.date);
    let rate = null; // % improvement per 4 weeks (positive = better)
    if (rs.length >= 2 && span >= 14) {
      const fit = rs.length >= 3 ? ols(rs.map((r) => daysBetween(first.date, r.date)), rs.map((r) => r.value)) : { b: (last.value - first.value) / span };
      if (fit) rate = r2(((fit.b * 28) / Math.abs(first.value || 1)) * 100 * (t.better === 'lower' ? -1 : 1));
    }
    out[t.id] = { id: t.id, name: t.name, unit: t.unit, better: t.better, group: t.group, cur: last.value, curDate: last.date, n: rs.length, span, rate, pts: rs.slice(-20).map((r) => ({ date: r.date, v: r.value })) };
  }
  return out;
}

// ---------- training plan simulation ----------
function sanePlan(p) {
  const c = (v, [a, b], d) => (Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), a, b) : d);
  const q = clonePlan(p || DEFAULT_PLAN()), def = DEFAULT_PLAN();
  q.days = c(q.days, LIM.days, 4); q.attempts = c(q.attempts, LIM.attempts, 150); q.items = q.items || {};
  for (const [k] of SIM_TYPES) { const it = q.items[k] || def.items[k]; q.items[k] = { n: c(it.n, LIM.n, 0), mins: c(it.mins, LIM.mins, def.items[k].mins), rpe: c(it.rpe, LIM.rpe, 5) }; }
  return q;
}
/** One week: 7 arrays of sessions (Mon..Sun). Deterministic. */
function weekSchedule(p) {
  p = sanePlan(p); const out = Array.from({ length: 7 }, () => []);
  const sess = [];
  for (const [k] of SIM_TYPES) for (let i = 0; i < p.items[k].n; i++) if (p.items[k].mins > 0) sess.push({ type: k, mins: p.items[k].mins, rpe: p.items[k].rpe });
  if (!p.days || !sess.length) return out;
  const slots = Array.from({ length: p.days }, (_, i) => Math.floor((i * 7) / p.days)), load = slots.map(() => 0);
  sess.sort((a, b) => b.mins * b.rpe - a.mins * a.rpe || a.type.localeCompare(b.type));
  for (const s of sess) { let j = 0; for (let i = 1; i < slots.length; i++) if (load[i] < load[j]) j = i; load[j] += s.mins * s.rpe; out[slots[j]].push(s); }
  return out;
}
/** Same math as loadStats(), over any series of daily loads (oldest first). */
function loadMetricsOf(series, history) {
  const l7 = series.slice(-7), l28 = series.slice(-28), acute = sum(l7), chronic = sum(l28) / 4;
  const acwr = chronic > 0 && history >= 21 ? acute / chronic : null;
  const m = mean(l7), sd = Math.sqrt(mean(l7.map((v) => (v - m) ** 2)) || 0), monotony = sd > 0 ? m / sd : null;
  return { acute, chronic: Math.round(chronic), acwr: acwr == null ? null : r2(acwr), monotony: monotony == null ? null : r2(monotony), strain: monotony == null ? null : Math.round(acute * monotony) };
}
function planMetrics(p, snap, weeks = 12) {
  p = sanePlan(p); const wk = weekSchedule(p), daily = wk.map((d) => sum(d.map((s) => s.mins * s.rpe)));
  const sessions = wk.flat(), mins = sum(sessions.map((s) => s.mins));
  const byType = SIM_TYPES.map(([k, l, c]) => { const xs = sessions.filter((s) => s.type === k); return { k, label: l, color: c, n: xs.length, mins: sum(xs.map((s) => s.mins)), load: sum(xs.map((s) => s.mins * s.rpe)) }; });
  const trainDays = daily.filter((v) => v > 0).length;
  let streak = 0, best = 0; for (let i = 0; i < 14; i++) { if (daily[i % 7] > 0) { streak++; best = Math.max(best, streak); } else streak = 0; }
  const hard = (d) => d.some((s) => s.rpe >= 8); let hrun = 0, hbest = 0; for (let i = 0; i < 14; i++) { if (hard(wk[i % 7])) { hrun++; hbest = Math.max(hbest, hrun); } else hrun = 0; }
  const zones = RPE_ZONES.map(([l, a, b, c]) => ({ label: l, color: c, mins: sum(sessions.filter((s) => s.rpe >= a && s.rpe <= b).map((s) => s.mins)) }));
  const wm = loadMetricsOf(daily.concat(daily, daily, daily), 28); // steady state (4 identical weeks)
  // Transition: your real last 28 days, then the plan week after week.
  const series = [...(snap?.loads28 || Array(28).fill(0))], trans = [];
  for (let w = 1; w <= weeks; w++) { series.push(...daily); trans.push({ week: w, date: shiftIso(snap?.date || todayIso(), 7 * w), ...loadMetricsOf(series, (snap?.history || 0) + 7 * w) }); }
  const acwrs = trans.map((t) => t.acwr).filter((v) => v != null);
  return {
    plan: p, week: wk, daily, sessions: sessions.length, mins, hours: r1(mins / 60), load: sum(daily), trainDays, restDays: 7 - trainDays, maxStreak: best, hardStreak: hbest,
    byType, zones, monotony: wm.monotony, strain: wm.strain, trans, acwrFirst: trans[0]?.acwr ?? null, acwrPeak: acwrs.length ? Math.max(...acwrs) : null,
    shotsWeek: p.items.shooting.n * p.attempts, strengthN: p.items.strength.n, condN: p.items.conditioning.n,
  };
}

// ---------- shooting ----------
const SHOOT_ASSUME = [0, 0.3, 0.8]; // % points per 1,000 attempts: conservative, baseline, optimistic
const SHOOT_MAX = 2; // rates are limited to ±2 points per 1,000 shots
const SHOOT_ROOM = 25; // ceiling = now + 25 points (at most 90%)
function shootRates(snap, inp) {
  const t = snap.shooting?.trend;
  const lim = (x) => r2(clamp(Number(x) || 0, -SHOOT_MAX, SHOOT_MAX));
  if (t && !inp.useAssume) { const z = 1.28; return { src: 'history', rates: [t.per1000 - z * t.se, t.per1000, t.per1000 + z * t.se].map(lim) }; }
  const a = inp.assume || SHOOT_ASSUME; return { src: 'assumption', rates: [a[0], a[1], a[2]].map(lim) };
}
function shootPath(p0, ratePer1000, shots) {
  const cap = Math.min(90, p0 + SHOOT_ROOM), r = ratePer1000 / 1000;
  if (r >= 0) { const room = cap - p0; return room <= 0 ? p0 : cap - room * Math.exp((-r * shots) / room); }
  return Math.max(p0 + r * shots, p0 - 15, 0);
}
/** inp: { pct, sessions, attempts, weeks, target, useAssume, assume } → weekly projections. */
function shootProject(snap, inp) {
  const p0 = clamp(Number(inp.pct) || 0, 0, 100), perWeek = Math.max(0, Math.round(Number(inp.sessions) || 0) * Math.round(Number(inp.attempts) || 0)), weeks = clamp(Math.round(Number(inp.weeks) || 12), 1, 26);
  const { src, rates } = shootRates(snap, inp), start = snap.date;
  const rows = []; for (let w = 0; w <= weeks; w++) { const shots = perWeek * w; rows.push({ w, date: shiftIso(start, 7 * w), shots, cons: r1(shootPath(p0, rates[0], shots)), base: r1(shootPath(p0, rates[1], shots)), opt: r1(shootPath(p0, rates[2], shots)), flat: p0 }); }
  const tgt = Number(inp.target) || null, hit = (k) => (tgt == null ? null : rows.find((r) => r[k] >= tgt)?.w ?? null);
  return { p0, perWeek, perMonth: Math.round((perWeek * 52) / 12), total: perWeek * weeks, weeks, src, rates, rows, target: tgt, hit: { cons: hit('cons'), base: hit('base'), opt: hit('opt') } };
}

// ---------- athletic tests ----------
function athRates(tb, focusNow, focusNew) {
  const f = clamp(Math.sqrt((Math.max(0, focusNew) + 0.5) / (Math.max(0, focusNow) + 0.5)), 0.5, 1.5);
  let src, r;
  if (tb.rate != null) { src = 'history'; r = tb.rate > 0 ? [tb.rate * 0.5, tb.rate, tb.rate * 1.5] : [tb.rate, 0, (ATH_ASSUME[tb.group] || ATH_ASSUME.Custom)[1]]; }
  else { src = 'assumption'; r = ATH_ASSUME[tb.group] || ATH_ASSUME.Custom; }
  const mx = ATH_MAX[tb.group] || ATH_MAX.Custom;
  // If a steep personal trend goes past the limit, scale all three down together so the optimistic one sits at the limit.
  const raw = r.map((x) => (x > 0 ? x * f : x)), top = Math.max(...raw), k = top > mx ? mx / top : 1;
  return { src, factor: r2(f), max: mx, scaled: k < 1, rates: raw.map((x) => r2(clamp(x > 0 ? x * k : x, -mx, mx))) };
}
/** inp: { cur, target, weeks, focusNow, focusNew } */
function athProject(tb, inp) {
  const cur = Number(inp.cur ?? tb.cur), weeks = clamp(Math.round(Number(inp.weeks) || 12), 1, 26), lower = tb.better === 'lower';
  const { src, factor, rates } = athRates(tb, Number(inp.focusNow) || 0, Number(inp.focusNew ?? inp.focusNow) || 0);
  const path = (rate) => { const out = [cur]; let v = cur; for (let w = 1; w <= weeks; w++) { const g = (rate / 4 / 100) * 0.85 ** Math.floor((w - 1) / 4); v = lower ? v * (1 - g) : v * (1 + g); out.push(v); } return out; };
  const P = rates.map(path), dec = tb.unit === 's' ? 2 : 1, rd = (v) => Math.round(v * 10 ** dec) / 10 ** dec;
  const rows = Array.from({ length: weeks + 1 }, (_, w) => ({ w, date: shiftIso(inp.start || todayIso(), 7 * w), cons: rd(P[0][w]), base: rd(P[1][w]), opt: rd(P[2][w]) }));
  const tgt = inp.target === '' || inp.target == null ? null : Number(inp.target);
  const reached = (v) => (tgt == null ? false : lower ? v <= tgt : v >= tgt);
  const hit = (k) => (tgt == null ? null : rows.find((r) => reached(r[k]))?.w ?? null);
  return { cur, weeks, src, factor, rates, rows, target: tgt, lower, hit: { cons: hit('cons'), base: hit('base'), opt: hit('opt') } };
}

// ---------- tradeoffs, assumptions, uncertainty ----------
function labTradeoffs(mA, mB, sleepH) {
  const out = [], dh = r1(mB.hours - mA.hours);
  if (dh >= 1) out.push(['mid', `Costs ${dh} more hours a week (${r1((dh * 52) / 12)} a month). Check that against school, sleep and practice.`]);
  if (dh <= -1) out.push(['hi', `Frees up ${Math.abs(dh)} hours a week.`]);
  if (mB.acwrFirst != null && mB.acwrFirst > 1.5) out.push(['lo', `Switching at once puts week 1 at an acute:chronic ratio of ${mB.acwrFirst}, a big jump from what your body is used to. Ramping up over 2–3 weeks keeps it lower.`]);
  else if (mB.acwrPeak != null && mB.acwrPeak > 1.3) out.push(['mid', `The ratio peaks at ${mB.acwrPeak} during the switch. Above 1.3 is the "caution" zone in the Load tab.`]);
  if (mB.restDays === 0) out.push(['lo', 'No rest day in the week. The Load tab flags 7+ days in a row.']);
  else if (mB.maxStreak >= 6) out.push(['mid', `${mB.maxStreak} training days in a row with this layout.`]);
  if (mB.hardStreak >= 3) out.push(['mid', `${mB.hardStreak} hard days (RPE 8+) back to back.`]);
  if (mB.monotony != null && mB.monotony > 2) out.push(['mid', `Monotony ${mB.monotony}: training days look alike. Mixing hard and easy days helps recovery.`]);
  if (mB.load > mA.load * 1.3 && mA.load > 0) out.push(['mid', `Weekly load goes up ${Math.round((mB.load / mA.load - 1) * 100)}%.`]);
  if (sleepH != null && sleepH < 8) out.push(['mid', `Sleep set to ${sleepH} h. Teen athletes are usually told 8–10 h; more training with less sleep means less recovery.`]);
  if (mB.strengthN > mA.strengthN && mB.condN > mA.condN) out.push(['flat', 'Adding strength and conditioning together: they compete for recovery, so expect slower progress on each than if you focused on one.']);
  if (mB.shotsWeek > mA.shotsWeek * 1.5 && mA.shotsWeek > 0) out.push(['flat', `Shooting volume goes from ${nf(mA.shotsWeek)} to ${nf(mB.shotsWeek)} a week. Volume only helps if the reps are game-like and focused.`]);
  if (!out.length) out.push(['hi', 'No load or recovery flags with this plan.']);
  return out;
}
function labAssumptions(snap, extra = []) {
  return [
    snap.isDefault ? 'No training logged in the last 28 days, so the baseline is a default template, not your data.' : `Baseline = your last 28 days: ${snap.sessions28} sessions on ${snap.activeDays28} days (${fmtD(shiftIso(snap.date, -27))} – ${fmtD(snap.date)}).`,
    'Load = minutes × RPE. The plan repeats the same week; real weeks vary.',
    'Sessions are spread across your training days automatically; the order of days is an assumption.',
    ...extra,
    'Projections are hypothetical. They are not predictions of what will happen and not medical advice.',
  ];
}
