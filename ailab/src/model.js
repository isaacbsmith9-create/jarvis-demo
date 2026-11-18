// ===================== data model & intelligence engine =====================
// Every number here is computed from records the user entered. Each metric knows whether a value is MEASURED or an
// ESTIMATE (e.g. 1RM from a 5-rep set, VO₂max from a field test, projections). Formulas are on the Methodology page.

// ---------- athletes ----------
const athletes = () => doc('athletes').list;
const curAthlete = () => { const a = doc('athletes'); return a.list.find((x) => x.id === a.current) || a.list[0] || null; };
const AID = () => curAthlete()?.id;
function ageOf(a, at = isoDate()) { if (!a?.birth) return a?.age ?? null; const b = new Date(dms(a.birth)), d = new Date(dms(at)); let y = d.getFullYear() - b.getFullYear(); if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) y--; return y; }
const fmtHeight = (inch) => (inch ? `${Math.floor(inch / 12)}′${Math.round(inch % 12)}″` : '—');

// ---------- record access (current athlete, optional date range) ----------
const inRange = (iso, R) => (!R?.from || iso >= R.from) && (!R?.to || iso <= R.to);
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0));
const listOf = (k, R, aid = AID()) => doc(k).list.filter((r) => r.aid === aid && inRange(r.date, R) && (!R?.ctx || !r.ctx || r.ctx === R.ctx)).sort(byDate);
const allTests = () => [...TESTS, ...doc('meta').customTests];
const testDef = (id) => TEST[id] || doc('meta').customTests.find((t) => t.id === id);

/** Result value of a test record (aggregate of attempts, estimated 1RM for lifts). */
function recValue(r, t = testDef(r.test)) {
  if (!t) return null;
  if (t.input === 'lift') return epley(r.load, r.reps);
  if (t.input === 'attempts' && r.attempts?.length) return t.agg === 'mean' ? mean(r.attempts) : t.dir === 'lower' ? Math.min(...r.attempts) : Math.max(...r.attempts);
  return r.value;
}
const recEst = (r, t = testDef(r.test)) => !!(t && t.input === 'lift' && r.reps > 1);
const bodyweight = (r, a) => r.bw || a?.weight || null;

// ---------- metric registry ----------
// Each metric: id, name, cat, unit, dir, dec, ref, scored, kind, series(R) → [{date, v, est, n?, k?}], agg(R) → {v, est, n, need}
const HOOP_METRICS = [
  // shooting (pooled makes / attempts over the range)
  { id: 'fg', name: 'Overall FG%', cat: 'shooting', min: 30, ref: { floor: 0.35, elite: 0.55 }, f: (s) => s.type !== 'ft' },
  { id: 'three', name: 'Three-point %', cat: 'shooting', min: 20, ref: { floor: 0.25, elite: 0.42 }, f: (s) => s.type !== 'ft' && shotPts(s) === 3 },
  { id: 'mid', name: 'Mid-range %', cat: 'shooting', min: 15, ref: { floor: 0.3, elite: 0.48 }, f: (s) => s.type !== 'ft' && shotPts(s) === 2 && !['ra', 'paint'].includes(shotZone(s)) },
  { id: 'ft', name: 'Free-throw %', cat: 'shooting', min: 20, ref: { floor: 0.55, elite: 0.85 }, f: (s) => s.type === 'ft' },
  { id: 'catch', name: 'Catch-and-shoot %', cat: 'shooting', min: 15, ref: { floor: 0.3, elite: 0.48 }, f: (s) => SHOT_TYPES[s.type]?.group === 'catch' },
  { id: 'offdrib', name: 'Off-the-dribble %', cat: 'shooting', min: 15, ref: { floor: 0.25, elite: 0.42 }, f: (s) => SHOT_TYPES[s.type]?.group === 'dribble' },
  { id: 'screen', name: 'Off screens %', cat: 'shooting', min: 10, ref: { floor: 0.28, elite: 0.45 }, f: (s) => s.type === 'screen', sub: true },
  { id: 'pullup', name: 'Pull-up %', cat: 'shooting', min: 10, ref: { floor: 0.25, elite: 0.42 }, f: (s) => s.type === 'pullup', sub: true },
  { id: 'spotup', name: 'Spot-up %', cat: 'shooting', min: 10, ref: { floor: 0.3, elite: 0.48 }, f: (s) => s.type === 'spotup', sub: true },
];
const shotZone = (s) => s.zone || (s.x != null ? zoneOf(s.x, s.y) : null);
const shotPts = (s) => (s.type === 'ft' ? 1 : s.pts || (shotZone(s) ? ZONES[shotZone(s)].pts : 2));

function makeMetrics() {
  const M = [];
  for (const t of allTests()) {
    M.push({ id: t.id, name: t.name, cat: t.cat, unit: t.unit, dir: t.dir, dec: t.dec ?? 1, ref: t.ref, scored: !!t.ref && t.input !== 'lift', kind: 'test', test: t,
      series: (R) => listOf('records', R).filter((r) => r.test === t.id).map((r) => ({ date: r.date, v: recValue(r, t), est: recEst(r, t), id: r.id })) });
    if (t.input === 'lift') M.push({ id: 'rel_' + t.id, name: 'Relative ' + t.name.toLowerCase(), cat: t.cat, unit: '× BW', dir: 'higher', dec: 2, ref: t.rel, scored: true, kind: 'derived', base: t.id,
      series: (R) => listOf('records', R).filter((r) => r.test === t.id && bodyweight(r, curAthlete())).map((r) => ({ date: r.date, v: recValue(r, t) / bodyweight(r, curAthlete()), est: recEst(r, t) || !r.bw, id: r.id })) });
    if (t.vo2) M.push({ id: 'vo2_' + t.id, name: 'Est. VO₂max (' + t.name + ')', cat: t.cat, unit: 'ml/kg/min', dir: 'higher', dec: 1, ref: null, scored: false, kind: 'derived', base: t.id, alwaysEst: true,
      series: (R) => listOf('records', R).filter((r) => r.test === t.id).map((r) => ({ date: r.date, v: vo2Estimate(t, recValue(r, t), ageOf(curAthlete(), r.date)), est: true, id: r.id })).filter((p) => p.v != null) });
    if (t.id === 'rsa') M.push({ id: 'rsa_fi', name: 'Repeated-sprint fatigue index', cat: t.cat, unit: '%', dir: 'lower', dec: 1, ref: null, scored: false, kind: 'derived', base: t.id,
      series: (R) => listOf('records', R).filter((r) => r.test === 'rsa' && r.attempts?.length >= 2).map((r) => ({ date: r.date, v: (100 * (Math.max(...r.attempts) - Math.min(...r.attempts))) / Math.min(...r.attempts), id: r.id })) });
    if (t.id === 'rjump') M.push({ id: 'rjump_cv', name: 'Jump consistency (CV)', cat: t.cat, unit: '%', dir: 'lower', dec: 1, ref: null, scored: false, kind: 'derived', base: t.id,
      series: (R) => listOf('records', R).filter((r) => r.test === 'rjump' && r.attempts?.length >= 3).map((r) => ({ date: r.date, v: 100 * cv(r.attempts), id: r.id })) });
  }
  for (const h of HOOP_METRICS) M.push({ ...h, unit: '%', dir: 'higher', dec: 1, pct: true, scored: !h.sub, kind: 'shots',
    pool: (R) => { const L = listOf('shots', R).filter(h.f); return { k: sum(L.map((s) => s.makes)), n: sum(L.map((s) => s.att)) }; },
    series: (R) => sessions(listOf('shots', R).filter(h.f), 5) });
  const drills = (R, f = () => true) => listOf('drills', R).filter((d) => d.kind === 'handle' && f(d));
  M.push({ id: 'security', name: 'Ball security', cat: 'handling', unit: '%', dir: 'higher', dec: 1, pct: true, min: 100, ref: { floor: 0.85, elite: 0.99 }, scored: true, kind: 'drills',
    pool: (R) => { const L = drills(R); const reps = sum(L.map((d) => d.reps)), tov = sum(L.map((d) => d.tov)); return { k: reps, n: reps + tov }; },
    series: (R) => byDay(drills(R), (L) => { const reps = sum(L.map((d) => d.reps)), tov = sum(L.map((d) => d.tov)); return reps + tov >= 20 ? { v: reps / (reps + tov), n: reps + tov } : null; }) });
  M.push({ id: 'combo', name: 'Combination execution', cat: 'handling', unit: '%', dir: 'higher', dec: 1, pct: true, min: 50, ref: { floor: 0.8, elite: 0.97 }, scored: false, kind: 'drills', sub: true,
    pool: (R) => { const L = drills(R, (d) => DRILL[d.drill]?.kind === 'combo'); const reps = sum(L.map((d) => d.reps)), tov = sum(L.map((d) => d.tov)); return { k: reps, n: reps + tov }; },
    series: (R) => byDay(drills(R, (d) => DRILL[d.drill]?.kind === 'combo'), (L) => { const reps = sum(L.map((d) => d.reps)), tov = sum(L.map((d) => d.tov)); return reps + tov >= 10 ? { v: reps / (reps + tov), n: reps + tov } : null; }) });
  M.push({ id: 'weakratio', name: 'Weak-hand ratio', cat: 'handling', unit: '× strong', dir: 'higher', dec: 2, min: 1, ref: { floor: 0.6, elite: 1.0 }, scored: true, kind: 'drills',
    pool: (R) => weakRatio(drills(R)),
    series: (R) => byDay(drills(R), (L) => { const w = weakRatio(L); return w.v != null ? { v: w.v, n: w.n } : null; }) });
  M.push({ id: 'codrate', name: 'Change-of-direction drill rate', cat: 'handling', unit: 'reps/min', dir: 'higher', dec: 1, ref: null, scored: false, kind: 'drills',
    series: (R) => byDay(drills(R, (d) => DRILL[d.drill]?.kind === 'cod' && d.dur > 0), (L) => ({ v: (60 * sum(L.map((d) => d.reps))) / sum(L.map((d) => d.dur)), n: L.length })) });
  M.push({ id: 'completion', name: 'Drill completion rate', cat: 'handling', unit: '%', dir: 'higher', dec: 0, pct: true, min: 5, ref: { floor: 0.5, elite: 0.95 }, scored: true, kind: 'drills',
    pool: (R) => { const L = drills(R); return { k: L.filter((d) => d.done).length, n: L.length }; },
    series: (R) => byDay(drills(R), (L) => ({ v: L.filter((d) => d.done).length / L.length, n: L.length })) });
  const fin = (R, f = () => true) => listOf('drills', R).filter((d) => d.kind === 'finish' && f(d));
  const finPool = (f) => (R) => { const L = fin(R, f); return { k: sum(L.map((d) => d.makes)), n: sum(L.map((d) => d.att)) }; };
  const finSeries = (f) => (R) => byDay(fin(R, f), (L) => { const n = sum(L.map((d) => d.att)); return n >= 5 ? { v: sum(L.map((d) => d.makes)) / n, n } : null; });
  M.push({ id: 'finish', name: 'Finishing %', cat: 'finishing', unit: '%', dir: 'higher', dec: 1, pct: true, min: 20, ref: { floor: 0.45, elite: 0.75 }, scored: true, kind: 'finish', pool: finPool(), series: finSeries() });
  M.push({ id: 'finL', name: 'Left-hand finishing', cat: 'finishing', unit: '%', dir: 'higher', dec: 1, pct: true, min: 10, ref: { floor: 0.4, elite: 0.72 }, scored: false, sub: true, kind: 'finish', pool: finPool((d) => d.hand === 'L'), series: finSeries((d) => d.hand === 'L') });
  M.push({ id: 'finR', name: 'Right-hand finishing', cat: 'finishing', unit: '%', dir: 'higher', dec: 1, pct: true, min: 10, ref: { floor: 0.4, elite: 0.72 }, scored: false, sub: true, kind: 'finish', pool: finPool((d) => d.hand === 'R'), series: finSeries((d) => d.hand === 'R') });
  M.push({ id: 'finbal', name: 'Left/right finishing balance', cat: 'finishing', unit: 'ratio', dir: 'higher', dec: 2, min: 2, ref: { floor: 0.6, elite: 1.0 }, scored: true, kind: 'finish',
    pool: (R) => { const l = finPool((d) => d.hand === 'L')(R), r = finPool((d) => d.hand === 'R')(R); if (l.n < 10 || r.n < 10) return { v: null, n: Math.min(l.n, r.n), needTxt: '10+ attempts with each hand' }; const a = l.k / l.n, b = r.k / r.n; return { v: Math.max(a, b) ? Math.min(a, b) / Math.max(a, b) : 1, n: 2 }; },
    series: () => [] });
  for (const [k, nm] of Object.entries(FINISH_TYPES)) M.push({ id: 'fin_' + k, name: nm + ' %', cat: 'finishing', unit: '%', dir: 'higher', dec: 1, pct: true, min: 8, ref: null, scored: false, sub: true, kind: 'finish', pool: finPool((d) => d.type === k), series: finSeries((d) => d.type === k) });
  const games = (R) => listOf('games', R);
  M.push({ id: 'ts', name: 'True shooting % (games)', cat: 'game', unit: '%', dir: 'higher', dec: 1, pct: true, min: 3, ref: { floor: 0.45, elite: 0.62 }, scored: true, kind: 'games',
    pool: (R) => { const G = games(R); const pts = sum(G.map((g) => g.pts)), tsa = sum(G.map((g) => g.fga + 0.44 * g.fta)); return { v: tsa ? pts / (2 * tsa) : null, n: G.length }; },
    series: (R) => games(R).filter((g) => g.fga + g.fta > 0).map((g) => ({ date: g.date, v: g.pts / (2 * (g.fga + 0.44 * g.fta)), id: g.id })) });
  M.push({ id: 'asttov', name: 'Assist-to-turnover (games)', cat: 'game', unit: 'ratio', dir: 'higher', dec: 2, min: 3, ref: { floor: 0.8, elite: 3.0 }, scored: true, kind: 'games',
    pool: (R) => { const G = games(R); const a = sum(G.map((g) => g.ast)), t = sum(G.map((g) => g.tov)); return { v: G.length ? a / Math.max(1, t) : null, n: G.length }; },
    series: (R) => games(R).map((g) => ({ date: g.date, v: g.ast / Math.max(1, g.tov), id: g.id })) });
  M.push({ id: 'gmsc', name: 'Game Score per game', cat: 'game', unit: 'pts', dir: 'higher', dec: 1, min: 3, ref: { floor: 2, elite: 16 }, scored: true, kind: 'games',
    pool: (R) => { const G = games(R); return { v: G.length ? mean(G.map(gameScore)) : null, n: G.length }; },
    series: (R) => games(R).map((g) => ({ date: g.date, v: gameScore(g), id: g.id })) });
  M.push({ id: 'ppg', name: 'Points per game', cat: 'game', unit: 'pts', dir: 'higher', dec: 1, min: 1, ref: null, scored: false, kind: 'games',
    pool: (R) => { const G = games(R); return { v: G.length ? mean(G.map((g) => g.pts)) : null, n: G.length }; }, series: (R) => games(R).map((g) => ({ date: g.date, v: g.pts, id: g.id })) });
  return M;
}
/** Simplified Hollinger Game Score (no offensive/defensive rebound split, no fouls): see Methodology. */
const gameScore = (g) => g.pts + 0.4 * g.fgm - 0.7 * g.fga - 0.4 * (g.fta - g.ftm) + 0.5 * g.reb + g.stl + 0.7 * g.ast + 0.7 * g.blk - g.tov;
function weakRatio(L) {
  // Per drill, weak-hand reps/min ÷ strong-hand reps/min; averaged over drills that have both.
  const by = {};
  for (const d of L) { if (!d.dur || !['weak', 'strong'].includes(d.hand)) continue; const o = (by[d.drill] ||= { weak: [0, 0], strong: [0, 0] }); o[d.hand][0] += d.reps; o[d.hand][1] += d.dur; }
  const ratios = Object.values(by).filter((o) => o.weak[1] && o.strong[1] && o.strong[0]).map((o) => (o.weak[0] / o.weak[1]) / (o.strong[0] / o.strong[1]));
  return { v: ratios.length ? mean(ratios) : null, n: ratios.length, needTxt: 'the same drill timed with each hand' };
}
/** Group entries by date and compute a per-day value. */
function byDay(L, f) {
  const g = {}; for (const x of L) (g[x.date] ||= []).push(x);
  return Object.keys(g).sort().map((d) => { const r = f(g[d]); return r ? { date: d, ...r } : null; }).filter(Boolean);
}
/** Shooting sessions: per-day makes / attempts, days with at least `minN` attempts. */
const sessions = (L, minN) => byDay(L, (D) => { const n = sum(D.map((s) => s.att)); return n >= minN ? { v: sum(D.map((s) => s.makes)) / n, n, k: sum(D.map((s) => s.makes)) } : null; });

let _M = null, _Mkey = '';
function metrics() { const key = doc('meta').customTests.map((t) => t.id).join(); if (!_M || key !== _Mkey) { _M = makeMetrics(); _Mkey = key; } return _M; }
const metric = (id) => metrics().find((m) => m.id === id);
const refOf = (m) => { const o = doc('meta').bench[m.id]; return o ? { ...m.ref, ...o } : m.ref; };

/** Benchmark score 0–100: linear between the reference floor (0) and elite (100) points. */
function benchScore(m, v) {
  const r = refOf(m); if (!r || v == null) return null;
  const s = m.dir === 'lower' ? (r.floor - v) / (r.floor - r.elite) : (v - r.floor) / (r.elite - r.floor);
  return Math.round(clamp(s * 100, 0, 100));
}
/** Current value of a metric over a range: latest test result, or pooled rate for basketball data. */
function current(m, R) {
  if (m.pool) {
    const p = m.pool(R);
    if (p.v !== undefined) return { v: p.v, n: p.n, ok: p.v != null && p.n >= (m.min || 1), need: p.needTxt || `${m.min} ${m.kind === 'games' ? 'games' : 'attempts'}`, est: false };
    const ok = p.n >= (m.min || 1);
    return { v: p.n ? p.k / p.n : null, n: p.n, k: p.k, ok, need: `${m.min} ${m.kind === 'drills' && m.id === 'completion' ? 'drills' : m.id === 'security' || m.id === 'combo' ? 'reps' : 'attempts'}`, est: false, ci: wilson(p.k, p.n) };
  }
  const s = m.series(R); if (!s.length) return { v: null, n: 0, ok: false, need: '1 result' };
  const last = s[s.length - 1];
  return { v: last.v, n: s.length, ok: true, est: !!last.est || !!m.alwaysEst, date: last.date };
}
function bestOf(m, R) {
  const s = m.series(R); if (!s.length) return null;
  return s.reduce((a, b) => ((m.dir === 'lower' ? b.v < a.v : b.v > a.v) ? b : a));
}
const fmtVal = (m, v) => (v == null ? '—' : m.pct ? (v * 100).toFixed(m.dec) + '%' : m.unit === 's' && v >= 100 ? fmtClock(v) : fmt(v, m.dec) + (m.unit && !['×'].includes(m.unit) ? ' ' + m.unit : ''));

// ---------- category scores & the Athlete Intelligence Score ----------
function catScores(R) {
  const out = {};
  for (const c of CAT_IDS) {
    const ms = metrics().filter((m) => m.cat === c && m.scored && refOf(m));
    const parts = [];
    for (const m of ms) {
      const cur = current(m, R);
      if (m.kind === 'derived' && m.base && !cur.ok) { // relative lift missing (no bodyweight) → fall back to absolute lift
        const abs = metric(m.base), ac = current(abs, R);
        if (ac.ok) parts.push({ m: abs, cur: ac, s: benchScore(abs, ac.v) });
        continue;
      }
      if (cur.ok) parts.push({ m, cur, s: benchScore(m, cur.v) });
    }
    const total = ms.length;
    out[c] = { score: parts.length ? Math.round(mean(parts.map((p) => p.s))) : null, parts, total, coverage: total ? parts.length / total : 0, est: parts.some((p) => p.cur.est) };
  }
  return out;
}
function intelScore(R, a = curAthlete()) {
  const cs = catScores(R), w = POS_WEIGHTS[posGroup(a?.pos)];
  const sub = (cats) => {
    const have = cats.filter((c) => cs[c].score != null);
    const W = sum(cats.map((c) => w[c])), Wh = sum(have.map((c) => w[c]));
    return { score: have.length ? Math.round(sum(have.map((c) => w[c] * cs[c].score)) / Wh) : null, coverage: W ? Wh / W : 0, cats: have.length, of: cats.length };
  };
  const all = sub(CAT_IDS);
  return { ...all, physical: sub(PHYS), skill: sub(SKILL), cs, weights: w, provisional: all.coverage < 0.6 || all.cats < 4, est: CAT_IDS.some((c) => cs[c].est) };
}

// ---------- trend, consistency, projection ----------
/** Trend of a series: least-squares slope as % of mean per 30 days, signed so + = improving. Needs 3+ points over 14+ days. */
function trendOf(m, s) {
  if (s.length < 3) return null;
  const span = daysBetween(s[0].date, s[s.length - 1].date); if (span < 14) return null;
  const xs = s.map((p) => (dms(p.date) - dms(s[0].date)) / DAY), ys = s.map((p) => p.v), fit = linreg(xs, ys); if (!fit) return null;
  const mu = Math.abs(mean(ys)) || 1, per30 = (fit.slope * 30) / mu;
  return { per30: m.dir === 'lower' ? -per30 : per30, fit, span, n: s.length, x0: dms(s[0].date) };
}
/** Projection: extend the least-squares line 30 and 90 days past the last result. Estimate only; needs 3+ points over 21+ days. */
function projection(m, R) {
  const s0 = m.series(R), s = m.pct && m.pool ? s0.filter((p) => (p.n || 0) >= 10) : s0, tr = trendOf(m, s); if (!tr || tr.span < 21) return null;
  const last = s[s.length - 1], lastX = (dms(last.date) - tr.x0) / DAY;
  const at = (d) => tr.fit.intercept + tr.fit.slope * (lastX + d);
  let p30 = at(30), p90 = at(90);
  // Physical limits: never project past the elite reference by more than 10% of the reference span, or below zero.
  const r = refOf(m); if (r) { const lim = m.dir === 'lower' ? r.elite - 0.1 * (r.floor - r.elite) : r.elite + 0.1 * (r.elite - r.floor); const cap = (v) => (m.dir === 'lower' ? Math.max(v, lim) : Math.min(v, lim)); p30 = cap(p30); p90 = cap(p90); }
  if (m.pct) { p30 = clamp(p30, 0, 1); p90 = clamp(p90, 0, 1); }
  return { m, last, p30, p90, r2: tr.fit.r2, n: tr.n, per30: tr.per30, reliable: tr.fit.r2 >= 0.3 && tr.n >= 4 };
}

// ---------- strengths, weaknesses, priorities ----------
function intel(R, a = curAthlete()) {
  const strengths = [], weaknesses = [], imbalances = [], missing = [], rows = [];
  const goals = new Set(a?.goals || []), w = POS_WEIGHTS[posGroup(a?.pos)];
  for (const m of metrics()) {
    const cur = current(m, R), s0 = m.series(R);
    // Rates are judged on sessions with 10+ attempts only; small sessions are too noisy for trends or consistency.
    const s = m.pct && m.pool ? s0.filter((p) => (p.n || 0) >= 10) : s0;
    if (!cur.ok) {
      if (m.scored || (m.kind === 'test' && !m.test?.custom)) missing.push({ m, have: cur.n || 0, need: cur.need });
      continue;
    }
    const score = refOf(m) ? benchScore(m, cur.v) : null;
    const tr = trendOf(m, s);
    const recent = s.slice(-6).map((p) => p.v);
    const cons = recent.length >= 3 && m.kind !== 'games' ? cv(recent) : null;
    const best = bestOf(m, R), prev = s.slice(0, -1).map((p) => p.v);
    const isPR = m.kind === 'test' && s.length >= 2 && best && best.date === s[s.length - 1].date && prev.length && (m.dir === 'lower' ? s[s.length - 1].v < Math.min(...prev) : s[s.length - 1].v > Math.max(...prev));
    const row = { m, cur, score, tr, cons, isPR, n: s.length };
    rows.push(row);
    const ev = (t) => ({ m, txt: t, score, n: cur.n, est: cur.est });
    if (score != null && score >= 70) strengths.push({ ...ev(`${fmtVal(m, cur.v)} scores ${score} on the benchmark scale.`), kind: 'Top performer', rank: score });
    if (tr && tr.per30 >= 0.02) strengths.push({ ...ev(`Improving ${(tr.per30 * 100).toFixed(1)}% per month over ${tr.n} results (${tr.span} days).`), kind: 'Fast improver', rank: 60 + tr.per30 * 400 });
    if (cons != null && m.kind === 'test' && cons <= 0.03) strengths.push({ ...ev(`Last ${recent.length} results vary only ${(cons * 100).toFixed(1)}% (CV).`), kind: 'Most consistent', rank: 50 + (0.03 - cons) * 500 });
    if (isPR) strengths.push({ ...ev(`Latest result (${fmtVal(m, s[s.length - 1].v)}) is a personal record.`), kind: 'New benchmark', rank: 65 });
    if (score != null && score < 40) weaknesses.push({ ...ev(`${fmtVal(m, cur.v)} scores ${score} on the benchmark scale.`), kind: 'Low performer', rank: 100 - score });
    if (tr && tr.span >= 45 && Math.abs(tr.per30) < 0.005 && (score == null || score < 80)) weaknesses.push({ ...ev(`No meaningful change over ${tr.span} days (${tr.n} results, ${(tr.per30 * 100).toFixed(2)}%/month).`), kind: 'Stagnant', rank: 55 });
    if (tr && tr.per30 <= -0.02) weaknesses.push({ ...ev(`Declining ${Math.abs(tr.per30 * 100).toFixed(1)}% per month over ${tr.n} results.`), kind: 'Regressing', rank: 70 + Math.abs(tr.per30) * 300 });
    if (m.pct && m.pool) {
      // Rates: compare the session-to-session spread with the spread pure chance would give at these sample sizes.
      const L = s.slice(-8);
      if (L.length >= 4) { const p = mean(L.map((x) => x.v)), nb = mean(L.map((x) => x.n)), exp = Math.sqrt((p * (1 - p)) / nb), od = exp ? sd(L.map((x) => x.v)) / exp : 0;
        row.od = od; if (od >= 1.5) weaknesses.push({ ...ev(`Session-to-session swings are ${od.toFixed(1)}× what chance alone would produce (last ${L.length} sessions, ~${Math.round(nb)} attempts each).`), kind: 'Inconsistent', rank: 50 + od * 10 }); }
    } else if (cons != null && cons >= 0.08 && !m.pct && m.kind !== 'derived') weaknesses.push({ ...ev(`Results swing ${(cons * 100).toFixed(1)}% (CV over last ${recent.length}).`), kind: 'Inconsistent', rank: 50 + cons * 100 });
  }
  // Imbalances (only when both sides have enough data).
  const l = metric('finL'), r = metric('finR'), lc = current(l, R), rc = current(r, R);
  if (lc.ok && rc.ok) { const d = Math.abs(lc.v - rc.v); if (d >= 0.15) imbalances.push({ kind: 'Finishing hands', txt: `${lc.v < rc.v ? 'Left' : 'Right'} hand finishes ${(d * 100).toFixed(0)} points lower (L ${fmtPct(lc.v, 0)} on ${lc.n}, R ${fmtPct(rc.v, 0)} on ${rc.n}).`, sev: d }); }
  const wr = current(metric('weakratio'), R);
  if (wr.ok && wr.v < 0.8) imbalances.push({ kind: 'Weak hand', txt: `Weak hand completes ${(wr.v * 100).toFixed(0)}% of the strong hand's rep rate in matched drills (${wr.n} drill${wr.n > 1 ? 's' : ''}).`, sev: 1 - wr.v });
  const vs = current(metric('vstand'), R), vm = current(metric('vmax'), R);
  if (vs.ok && vm.ok && vm.v - vs.v < 3) imbalances.push({ kind: 'Approach jump', txt: `Max vertical is only ${fmt(vm.v - vs.v)} in above standing vertical. Approach mechanics may be leaving height unused (typically 4–8 in).`, sev: 0.3 });
  const rb = current(metric('rel_bench'), R), rs = current(metric('rel_squat'), R);
  if (rb.ok && rs.ok && rs.v > 0 && rb.v / rs.v > 0.95) imbalances.push({ kind: 'Upper vs lower body', txt: `Relative bench (${fmt(rb.v, 2)}× BW) is close to relative squat (${fmt(rs.v, 2)}× BW). Lower-body strength usually leads for jumping athletes.`, sev: 0.25 });
  // Development priorities: gap × position weight × trend factor × goal factor × data confidence.
  const pri = rows.filter((x) => x.score != null && x.m.scored).map((x) => {
    const gap = 100 - x.score, pw = w[x.m.cat];
    const trf = x.tr ? (x.tr.per30 <= -0.02 ? 1.3 : Math.abs(x.tr.per30) < 0.005 && x.tr.span >= 45 ? 1.2 : x.tr.per30 >= 0.02 ? 0.85 : 1) : 1;
    const gf = goals.has(x.m.cat) ? 1.3 : 1;
    const conf = x.m.pool ? clamp(x.cur.n / (2 * (x.m.min || 1)), 0.5, 1) : clamp(x.n / 3, 0.5, 1);
    return { ...x, gap, pw, trf, gf, conf, p: gap * pw * trf * gf * conf };
  }).sort((a, b) => b.p - a.p);
  strengths.sort((a, b) => b.rank - a.rank); weaknesses.sort((a, b) => b.rank - a.rank); imbalances.sort((a, b) => b.sev - a.sev);
  return { strengths, weaknesses, imbalances, missing, priorities: pri, rows };
}

/** Plain-language insights computed from the data (no AI). */
function computedInsights(R) {
  const out = [], I = intel(R);
  for (const x of I.rows) {
    if (x.isPR) out.push({ t: 'pr', txt: `New personal record: ${x.m.name} ${fmtVal(x.m, x.cur.v)}.`, m: x.m });
    if (x.tr && Math.abs(x.tr.per30) >= 0.02) out.push({ t: x.tr.per30 > 0 ? 'up' : 'down', txt: `${x.m.name} is ${x.tr.per30 > 0 ? 'improving' : 'declining'} ${Math.abs(x.tr.per30 * 100).toFixed(1)}% per month (${x.tr.n} results).`, m: x.m });
  }
  for (const im of I.imbalances.slice(0, 2)) out.push({ t: 'imb', txt: im.txt });
  if (I.priorities[0]) out.push({ t: 'pri', txt: `Top development priority: ${I.priorities[0].m.name} (benchmark ${I.priorities[0].score}).`, m: I.priorities[0].m });
  const cs = catScores(R), missingCats = CAT_IDS.filter((c) => cs[c].score == null);
  if (missingCats.length) out.push({ t: 'gap', txt: `No scored data yet for ${missingCats.map((c) => CATS[c].name.toLowerCase()).join(', ')}.` });
  return out.slice(0, 8);
}

// ---------- ranges ----------
const RANGES = { '30': 'Last 30 days', '90': 'Last 90 days', '180': 'Last 6 months', '365': 'Last 12 months', all: 'All time', custom: 'Custom' };
function rangeFrom(key, from, to) {
  if (key === 'custom') return { key, from: from || null, to: to || null };
  if (key === 'all') return { key, from: null, to: null };
  return { key, from: addDays(isoDate(), -Number(key)), to: isoDate() };
}
const rangeLabel = (R) => (R.key === 'custom' ? `${R.from ? fmtDate(R.from) : 'Start'} – ${R.to ? fmtDate(R.to) : 'today'}` : RANGES[R.key]);
