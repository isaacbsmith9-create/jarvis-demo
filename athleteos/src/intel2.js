// ===================== ATHLETE INTELLIGENCE CENTER =====================
// An analysis layer over existing data. It stores only the athlete's decisions ("aos-intel": insight + recommendation
// status, the baseline at the time a recommendation was accepted, AI briefings). Everything else is recomputed from
// the existing logs, memoized until any data changes.
let dataV = 0; const memo = {};
const _persistI = persist; persist = function (k) { dataV++; return _persistI(k); };
function cached(key, fn) { const m = memo[key]; if (m && m.v === dataV && m.d === todayIso()) return m.val; const val = fn(); memo[key] = { v: dataV, d: todayIso(), val }; return val; }
const intel = () => doc('aos-intel');

// ----- one set of metrics, computed over any list of days -----
const pctOf = (m, a, min) => (a >= min ? (m / a) * 100 : null);
const avgOf = (xs) => { const v = xs.filter((x) => x != null && Number.isFinite(x)); return v.length ? mean(v) : null; };
// [key, label, unit, better: 'up'|'down'|null, domain, fn(days) -> number|null]
const METRICS = [
  ['shotPct', 'Shooting %', '%', 'up', 'Basketball', (ds) => { const t = shotSessions().filter((s) => ds.includes(s.date)).map(sessionTotals); return pctOf(sum(t.map((x) => x.m)), sum(t.map((x) => x.a)), 30); }],
  ['threePct', '3-point %', '%', 'up', 'Basketball', (ds) => { const t = shotSessions().filter((s) => ds.includes(s.date)).map(sessionTotals); return pctOf(sum(t.map((x) => x.m3)), sum(t.map((x) => x.a3)), 20); }],
  ['shots', 'Shots taken', '', 'up', 'Basketball', (ds) => { const t = shotSessions().filter((s) => ds.includes(s.date)); return t.length ? sum(t.map((s) => sessionTotals(s).a)) : null; }],
  ['finishPct', 'Finishing %', '%', 'up', 'Basketball', (ds) => { const t = finishTotals(finishSessions().filter((s) => ds.includes(s.date))); return pctOf(t.m, t.a, 20); }],
  ['handlesMin', 'Ball-handling minutes', 'min', 'up', 'Basketball', (ds) => { const h = handleSessions().filter((s) => ds.includes(s.date)); return h.length ? sum(h.map((s) => s.mins)) : null; }],
  ['gameScore', 'Game Score', '', 'up', 'Basketball', (ds) => avgOf(games().filter((g) => ds.includes(g.date)).map(gameScore))],
  ['sessions', 'Training sessions', '', 'up', 'Training', (ds) => sum(ds.map((d) => exList(d).length))],
  ['activeDays', 'Active days', 'days', 'up', 'Training', (ds) => ds.filter(isActive).length],
  ['hours', 'Training hours', 'h', null, 'Training', (ds) => r1(sum(ds.map((d) => trainingOf(d).mins)) / 60)],
  ['load', 'Training load', '', null, 'Workload', (ds) => sum(ds.map(loadOf))],
  ['rpe', 'Average session RPE', '', null, 'Workload', (ds) => avgOf(ds.flatMap((d) => exList(d).map(sessionRPE)))],
  ['fatigue', 'Fatigue after sessions', '/10', 'down', 'Workload', (ds) => avgOf(ds.flatMap((d) => exList(d).map((x) => x.fatigueAfter ?? null)))],
  ['readiness', 'Readiness', '', 'up', 'Recovery', (ds) => avgOf(ds.map((d) => readiness(d)?.score ?? null))],
  ['sleep', 'Sleep', 'h', 'up', 'Recovery', (ds) => avgOf(ds.map((d) => recoveryInputs(d).sleepH))],
  ['soreness', 'Soreness', '/5', 'down', 'Recovery', (ds) => avgOf(ds.map((d) => recoveryInputs(d).sore))],
  ['mental', 'Mental readiness', '', 'up', 'Mental', (ds) => avgOf(ds.map(mentalScore))],
  ['confidence', 'Confidence', '/10', 'up', 'Mental', (ds) => avgOf(ds.map((d) => mcheck(d)?.confidence ?? null))],
  ['stress', 'Stress', '/10', 'down', 'Mental', (ds) => avgOf(ds.map((d) => mcheck(d)?.stress ?? null))],
  ['protein', 'Protein per day', 'g', 'up', 'Nutrition', (ds) => avgOf(ds.filter(hasFood).map((d) => totalsOf(d).protein))],
  ['proteinHit', 'Protein goal days', '%', 'up', 'Nutrition', (ds) => { const f = ds.filter(hasFood); return f.length >= 2 ? (f.filter((d) => totalsOf(d).protein >= targets(d).protein * 0.9).length / f.length) * 100 : null; }],
  ['routine', 'Routine completion', '%', 'up', 'Routines', (ds) => { const v = avgOf(ds.map(routineDayPct)); return v == null ? null : v * 100; }],
  ['adherence', 'Calendar adherence', '%', 'up', 'Calendar', (ds) => { const a = adherence(ds); return a.sched >= 2 ? a.pct * 100 : null; }],
  ['goalPct', 'Average goal progress', '%', 'up', 'Goals', (ds) => avgOf(goals().map((g) => goalPctAt(g, ds[ds.length - 1])))],
];
const MET = Object.fromEntries(METRICS.map((m) => [m[0], m]));
const weekDays = (m) => lastNDays(7, shiftIso(m, 6)).filter((d) => d <= todayIso());
function metricOn(key, days) { return cached(`m:${key}:${days[0]}:${days.length}`, () => { const v = MET[key][5](days); return v == null || !Number.isFinite(v) ? null : r1(v); }); }
const weekMetric = (key, m) => metricOn(key, weekDays(m));
const fmtM = (key, v) => (v == null ? '—' : `${MET[key][2] === '%' ? Math.round(v) + '%' : Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : r1(v)}${MET[key][2] && MET[key][2] !== '%' ? (MET[key][2].startsWith('/') ? MET[key][2] : ' ' + MET[key][2]) : ''}`);
const weeksBack = (n, end = mondayOf(todayIso())) => Array.from({ length: n }, (_, i) => shiftIso(end, -7 * (n - 1 - i)));
/** Least-squares slope per step and the fit. */
function slopeOf(vals) { const ps = vals.map((v, i) => [i, v]).filter(([, v]) => v != null); if (ps.length < 3) return null; const f = pearson(ps); return f ? { ...f, n: ps.length } : { slope: 0, r: 0, n: ps.length }; }

// ----- 1. insight feed -----
const LEVEL = { 3: ['lo', 'High'], 2: ['mid', 'Medium'], 1: ['hi', 'Low'] };
const KIND_ICON = { up: '▲', down: '▼', warn: '⚠', opp: '◆', note: '●' };
/** Compare the last 14 days with the 28 before. Returns null without enough data. */
function windowCompare(key) { const a = metricOn(key, lastNDays(14)), b = metricOn(key, lastNDays(28, shiftIso(todayIso(), -14))); return a == null || b == null ? null : { a, b, d: a - b, pct: b ? ((a - b) / Math.abs(b)) * 100 : null }; }
function buildInsights() {
  const out = [], add = (x) => out.push(x), today = todayIso();
  const cmp = (key, minAbs, minPct, cat, upTitle, downTitle, action, why) => {
    const c = windowCompare(key); if (!c) return; const [, label, , better] = MET[key], big = Math.abs(c.d) >= minAbs || (c.pct != null && Math.abs(c.pct) >= minPct); if (!big) return;
    const good = better == null ? null : (c.d > 0) === (better === 'up');
    add({ id: `${key}-${c.d > 0 ? 'up' : 'down'}-${mondayOf(today)}`, cat, kind: good == null ? 'note' : good ? 'up' : 'down', level: good === false ? 2 : 1, title: c.d > 0 ? upTitle : downTitle, desc: `${label}: ${fmtM(key, c.a)} over the last 14 days vs ${fmtM(key, c.b)} the 28 days before.`, data: `${fmtM(key, c.b)} → ${fmtM(key, c.a)} (${c.d > 0 ? '+' : ''}${r1(c.d)}${MET[key][2] === '%' ? ' pts' : ''})`, period: 'Last 14 days vs previous 28', why, action, metric: key });
  };
  cmp('shotPct', 4, 999, 'Basketball', 'Shooting percentage is climbing', 'Shooting percentage has dipped', { label: 'Review shot chart', go: 'hoops-court' }, 'Shooting is one of the most important guard skills; a 4-point swing over 14 days is bigger than normal session-to-session noise.');
  cmp('threePct', 5, 999, 'Basketball', '3-point shooting is improving', '3-point shooting has cooled off', { label: 'Shot types', go: 'hoops-categories' }, 'Three-point efficiency drives scoring value for a guard.');
  cmp('readiness', 8, 999, 'Recovery', 'Readiness is up', 'Readiness is trending down', { label: 'Load vs readiness', go: 'train-load' }, 'Lower readiness for two weeks often comes before tired legs and worse sessions.');
  cmp('mental', 8, 999, 'Mental', 'Mental readiness is rising', 'Mental readiness is slipping', { label: 'Mental trends', go: 'mind-trends' }, 'Confidence and focus affect decision-making and shooting under pressure.');
  cmp('stress', 1.5, 999, 'Mental', 'Stress has gone up', 'Stress has come down', { label: 'Focus training', go: 'mind-training' }, 'Rising stress can lower sleep quality and focus.');
  cmp('activeDays', 2, 999, 'Training', 'You are training more consistently', 'Training consistency dropped', { label: 'Calendar', go: 'train-plan' }, 'Consistency over weeks is what produces long-term improvement.');
  cmp('sleep', 0.5, 999, 'Recovery', 'You are sleeping more', 'Sleep is down', { label: 'Recovery', go: 'analytics-recovery' }, 'Teen athletes recover best with 8-10 hours; sleep debt adds up.');
  cmp('routine', 15, 999, 'Routines', 'Routine completion is up', 'Routine completion dropped', { label: 'Routines', go: 'train-routines' }, 'Routines turn good intentions into daily habits.');
  cmp('proteinHit', 20, 999, 'Nutrition', 'Hitting your protein goal more often', 'Hitting your protein goal less often', { label: 'Open MacroLens', ml: true }, 'Protein supports recovery and muscle repair after training.');
  // workload: reuse the Load Monitor's informational patterns
  for (const [c, t] of loadWarnings()) add({ id: 'load-' + t.slice(0, 24).replace(/\W+/g, '') + '-' + mondayOf(today), cat: 'Workload', kind: 'warn', level: c === 'lo' ? 3 : 2, title: c === 'lo' ? 'Workload spike' : 'Workload pattern', desc: t, data: `Acute ${loadStats().acute.toLocaleString()} · chronic ${loadStats().chronic.toLocaleString()} per week`, period: 'Last 7-28 days', why: 'Sudden jumps in training load are when overuse problems tend to appear. Informational only, not a medical assessment.', action: { label: 'Training load', go: 'train-load' } });
  // recovery after hard sessions (needs 3+ hard and 3+ normal days followed by a readiness score)
  { const hard = [], easy = []; for (const d of lastNDays(56)) { const nr = readiness(shiftIso(d, 1)); if (!nr || !isActive(d)) continue; (exList(d).some((x) => sessionRPE(x) >= 8) ? hard : easy).push(nr.score); }
    if (hard.length >= 3 && easy.length >= 3 && mean(easy) - mean(hard) >= 8) add({ id: 'hard-recovery-' + mondayOf(today), cat: 'Recovery', kind: 'warn', level: 2, title: 'Hard sessions cost you the next day', desc: `Readiness the day after an RPE 8+ session averaged ${Math.round(mean(hard))}, vs ${Math.round(mean(easy))} after other sessions.`, data: `${hard.length} hard vs ${easy.length} other sessions`, period: 'Last 8 weeks', why: 'Knowing how long you take to bounce back helps place hard days away from games.', action: { label: 'Plan an easy day', go: 'train-plan' } }); }
  // goals and milestones
  for (const g of goals()) { const s = goalState(g); if (s.status === 'overdue') add({ id: 'goal-overdue-' + g.id, cat: 'Goals', kind: 'warn', level: 3, title: `Overdue goal: ${g.title}`, desc: `Target date ${fmtD(g.date)} has passed at ${s.pct}% complete.`, data: `${s.pct}% done`, period: 'Since ' + fmtD(g.date), why: 'An overdue goal needs a new date or a new plan, or it stops guiding your training.', action: { label: 'Revisit goal', go: 'train-goals', goal: g.id } }); else if (s.status === 'behind') add({ id: 'goal-behind-' + g.id + '-' + mondayOf(today), cat: 'Goals', kind: 'down', level: 2, title: `Behind pace: ${g.title}`, desc: `${s.pct}% complete with ${s.expected}% of the time used.`, data: `${s.pct}% vs ${s.expected}% expected`, period: 'Since the goal started', why: 'Catching a slow pace early makes it easier to adjust.', action: { label: 'Open goal', go: 'train-goals', goal: g.id } });
    for (const m of g.milestones || []) if (!m.done && m.due && m.due < today) add({ id: `ms-late-${g.id}-${m.due}-${(m.label || m.v || '').toString().slice(0, 10)}`, cat: 'Goals', kind: 'warn', level: 2, title: 'Missed milestone', desc: `"${m.label || m.v}" (${g.title}) was due ${fmtD(m.due)}.`, data: `due ${fmtD(m.due)}`, period: 'Milestone', why: 'Milestones break a big goal into checkpoints; a missed one is an early signal.', action: { label: 'Open goal', go: 'train-goals', goal: g.id } }); }
  // emerging strengths / potential weaknesses (rating movement over 30 days)
  const r = skillRatings(), p = skillRatings(shiftIso(today, -30));
  for (const [k, l] of SKILLS) if (r[k] && p[k]) { const d = r[k].v - p[k].v; if (d >= 5) add({ id: `skill-up-${k}-${mondayOf(today)}`, cat: 'Development', kind: 'up', level: 1, title: `Emerging strength: ${l}`, desc: `${l} rating went from ${p[k].v} to ${r[k].v} in 30 days.`, data: r[k].basis, period: 'Last 30 days', why: 'Strengths you build on become what coaches notice.', action: { label: 'See ratings', go: 'analytics-overview' } }); if (d <= -5) add({ id: `skill-down-${k}-${mondayOf(today)}`, cat: 'Development', kind: 'down', level: 2, title: `Slipping: ${l}`, desc: `${l} rating fell from ${p[k].v} to ${r[k].v} in 30 days.`, data: r[k].basis, period: 'Last 30 days', why: 'Catching a decline early keeps it from becoming a weakness.', action: { label: 'Development priorities', go: 'intel-priorities' } }); }
  // unusual deviation: latest shooting session vs history
  { const ss = shotSessions().map(sessionTotals).filter((t) => t.a >= 20); if (ss.length >= 6) { const last = ss[ss.length - 1].pct * 100, hist = ss.slice(0, -1).map((t) => t.pct * 100), m = mean(hist), sd = stdev(hist); if (sd && Math.abs(last - m) / sd >= 2) add({ id: 'shot-dev-' + shotSessions().slice(-1)[0].id, cat: 'Basketball', kind: last > m ? 'up' : 'down', level: 1, title: last > m ? 'Unusually strong shooting session' : 'Unusually cold shooting session', desc: `Your latest session was ${Math.round(last)}%, vs your usual ${Math.round(m)}% (±${r1(sd)}).`, data: `${r1(Math.abs(last - m) / sd)} standard deviations from normal`, period: 'Latest session', why: 'One session is noise, but it\'s worth noting what was different (sleep, warm-up, fatigue).', action: { label: 'Add a note in your journal', go: 'mind-journal' } }); } }
  // PRs and opportunities
  for (const { t, r: res, prev } of allPRs().filter((x) => daysBetween(x.r.date, today) <= 14)) add({ id: `pr-${t.id}-${res.date}`, cat: 'Testing', kind: 'up', level: 1, title: `New PR: ${t.name}`, desc: `${fmtVal(t, res.value)}, up from ${fmtVal(t, prev)}.`, data: `${r1(improvePct(t, prev, res.value))}% better`, period: fmtD(res.date), why: 'Records confirm the training is working.', action: { label: 'Tests', go: 'train-tests' } });
  for (const p2 of priorities().filter((x) => x.days != null && x.days >= 14).slice(0, 2)) add({ id: `neglect-${p2.k}-${mondayOf(today)}`, cat: 'Development', kind: 'opp', level: 2, title: `${p2.l} hasn't been trained in ${p2.days} days`, desc: `Last logged ${fmtD(p2.last)}.`, data: p2.why, period: 'Since ' + fmtD(p2.last), why: 'Skills fade without regular reps.', action: { label: 'Build a workout', go: 'coach-workout' } });
  for (const r2 of routines()) { const st = routineStats(r2); const w = [...st.miss].sort((a, b) => b.missed - a.missed)[0]; if (st.sched >= 7 && w?.missed >= 4) add({ id: `rt-miss-${r2.id}-${w.i}-${mondayOf(today)}`, cat: 'Routines', kind: 'opp', level: 1, title: `Most-skipped step: ${w.s.title}`, desc: `Missed ${w.missed} times in ${st.sched} scheduled ${r2.name} routines.`, data: `${r2.name} completion ${pctTxt(st.pct)}`, period: 'Last 28 days', why: 'Fixing the one step you always skip raises the whole routine.', action: { label: 'Edit routine', go: 'train-routines' } }); }
  { const a = adherence(lastNDays(14)); if (a.sched >= 6 && a.pct < 0.6) add({ id: 'adher-low-' + mondayOf(today), cat: 'Calendar', kind: 'down', level: 2, title: 'Plan and reality are drifting apart', desc: `${a.done} of ${a.sched} scheduled items done in 14 days (${a.missed} missed).`, data: `${pctTxt(a.pct)} adherence`, period: 'Last 14 days', why: 'A plan you can actually follow beats a perfect plan you skip.', action: { label: 'Calendar', go: 'train-plan' } }); }
  const seen = new Set(); return out.filter((x) => (seen.has(x.id) ? false : seen.add(x.id))).sort((a, b) => b.level - a.level);
}
const insights2 = () => cached('insights', buildInsights);
const istate = (id) => intel().ins?.[id]?.s || 'new';
function setIns(id, s) { const I = intel(); I.ins = { ...(I.ins || {}), [id]: { s, at: Date.now() } }; persist('aos-intel'); }

// ----- 2. recommendations (action center) -----
// Each one names its measurable outcome as a metric, so accepted recommendations can be tracked against a baseline.
function buildRecs() {
  const out = [], pr = devPriorities().slice(0, 3), ins = insights2().filter((x) => istate(x.id) !== 'dismissed');
  const has = (pref) => ins.find((x) => x.id.startsWith(pref));
  const add = (r) => out.push(r);
  const sh = has('shotPct-down') || has('threePct-down'); if (sh) add({ id: 'rec-shoot-' + mondayOf(todayIso()), text: 'Prioritize shooting consistency this week', reason: sh.desc, data: sh.data, priority: 3, timeframe: 'Next 14 days', metric: sh.metric, target: 'Back to your previous level', feature: ['Shooting', 'hoops-court'], goal: { title: 'Shooting % back to baseline', cat: 'shooting', source: 'shoot:pct' }, event: { title: 'Shooting workout: form + 5-spot', type: 'shooting' } });
  const ld = ins.find((x) => x.cat === 'Workload'); if (ld) add({ id: 'rec-load-' + mondayOf(todayIso()), text: 'Adjust training volume this week', reason: ld.desc, data: ld.data, priority: ld.level, timeframe: 'Next 7 days', metric: 'load', target: 'Keep the weekly increase under ~10-30%', feature: ['Training load', 'train-load'], event: { title: 'Recovery session', type: 'recovery' } });
  const rec = has('readiness-down') || has('hard-recovery'); if (rec) add({ id: 'rec-recover-' + mondayOf(todayIso()), text: 'Focus on recovery after demanding sessions', reason: rec.desc, data: rec.data, priority: 2, timeframe: 'Next 7 days', metric: 'readiness', target: 'Average readiness up 5+ points', feature: ['Recovery', 'analytics-recovery'], event: { title: 'Recovery: mobility + early bedtime', type: 'recovery' } });
  for (const g of ins.filter((x) => x.id.startsWith('goal-overdue')).slice(0, 2)) add({ id: 'rec-' + g.id, text: 'Revisit an overdue goal', reason: g.desc, data: g.data, priority: 2, timeframe: 'This week', metric: 'goalPct', target: 'New date or plan set', feature: ['Goal roadmap', 'train-goals'], goalId: g.action.goal });
  const rt = has('routine-down') || ins.find((x) => x.id.startsWith('rt-miss')); if (rt) add({ id: 'rec-routine-' + mondayOf(todayIso()), text: 'Improve daily routine consistency', reason: rt.desc, data: rt.data, priority: 1, timeframe: 'Next 14 days', metric: 'routine', target: 'Routine completion 80%+', feature: ['Routines', 'train-routines'] });
  const due = Object.entries(doc('aos-tests').next || {}).filter(([, d]) => d < todayIso()).map(([id]) => testById(id)).filter(Boolean); if (due.length) add({ id: 'rec-test-' + due[0].id, text: `Complete the missed ${due[0].name} test`, reason: `It was scheduled for ${fmtD(doc('aos-tests').next[due[0].id])} and hasn't been logged.`, data: `${resultsOf(due[0].id).length} past results`, priority: 1, timeframe: 'Next 7 days', metric: null, target: 'New result logged', feature: ['Tests', 'train-tests'], event: { title: `Test: ${due[0].name}`, type: 'testing' } });
  const mn = has('mental-down') || has('stress-up'); if (mn) add({ id: 'rec-mind-' + mondayOf(todayIso()), text: 'Add two short mental-training sessions', reason: mn.desc, data: mn.data, priority: 2, timeframe: 'Next 7 days', metric: 'mental', target: 'Mental readiness up 5+ points', feature: ['Mental training', 'mind-training'] });
  for (const p of pr) add({ id: `rec-pri-${p.k}-${mondayOf(todayIso())}`, text: `Make ${p.l.toLowerCase()} a focus`, reason: p.reasons.join('; '), data: p.rating == null ? 'No rating yet' : `Rating ${p.rating}`, priority: p.score >= 60 ? 3 : 2, timeframe: 'Next 4 weeks', metric: { shooting: 'shotPct', finishing: 'finishPct', handles: 'handlesMin', impact: 'gameScore', conditioning: 'sessions', strength: 'sessions', athleticism: 'sessions', iq: null }[p.k], target: p.rating == null ? 'Log enough to get a first rating' : `Rating ${Math.min(99, p.rating + 5)}+`, feature: ['Workout generator', 'coach-workout'], goal: { title: `${p.l}: rating ${p.rating == null ? 'first rating' : Math.min(99, p.rating + 5)}`, cat: { shooting: 'shooting', handles: 'handles', finishing: 'finishing', athleticism: 'athleticism', strength: 'strength', conditioning: 'conditioning', iq: 'skills', impact: 'skills' }[p.k] }, event: { title: `${p.l} workout`, type: p.k === 'strength' ? 'lift' : p.k === 'conditioning' ? 'conditioning' : p.k === 'shooting' ? 'shooting' : 'skill' } });
  const seen = new Set(); return out.filter((x) => (seen.has(x.id) ? false : seen.add(x.id))).sort((a, b) => b.priority - a.priority);
}
const recs = () => cached('recs', buildRecs);
const rstate = (id) => intel().recs?.[id] || null;
const metricNow = (key) => (key ? metricOn(key, lastNDays(7)) : null);
function setRec(r, s, extra = {}) { const I = intel(); const prev = I.recs?.[r.id] || {}; I.recs = { ...(I.recs || {}), [r.id]: { ...prev, s, at: Date.now(), text: r.text, metric: r.metric, ...(s === 'accepted' && !prev.base ? { base: metricNow(r.metric), baseDate: todayIso() } : {}), ...extra } }; persist('aos-intel'); }

// ----- 3. development priorities (transparent scoring) -----
// score = 30% gap + 20% goal importance + 20% trend + 15% guard impact + 15% neglect, then × data confidence.
function devPriorities() {
  return cached('prios', () => {
    const r = skillRatings(), p = skillRatings(shiftIso(todayIso(), -30)), gs = goals().filter((g) => goalState(g).status !== 'done'), base = priorities();
    const catMap = { shooting: ['shooting'], handles: ['handles'], finishing: ['finishing'], athleticism: ['athleticism'], strength: ['strength'], conditioning: ['conditioning'], iq: ['skills', 'mental'], impact: ['skills'] };
    return SKILLS.map(([k, l]) => {
      const rating = r[k]?.v ?? null, b = base.find((x) => x.k === k);
      const gap = rating == null ? 50 : clamp((85 - rating) / 35, 0, 1) * 100;
      const rel = gs.filter((g) => catMap[k].includes(g.cat)), goalImp = rel.length ? Math.min(100, sum(rel.map((g) => (g.priority === 'high' ? 60 : g.priority === 'low' ? 20 : 40)))) : 0;
      const tr = rating != null && p[k] ? rating - p[k].v : null, trend = tr == null ? 50 : clamp(50 - tr * 8, 0, 100);
      const impact = clamp(((POS_WEIGHT[k] || 1) - 0.8) / 0.45, 0, 1) * 100, neglect = b.days == null ? 100 : clamp(b.days / 21, 0, 1) * 100;
      const conf = rating == null ? 0.6 : (r[k].basis.match(/\d+/g) || []).length >= 2 ? 1 : 0.85;
      const score = Math.round((0.3 * gap + 0.2 * goalImp + 0.2 * trend + 0.15 * impact + 0.15 * neglect) * conf);
      const reasons = [rating == null ? 'no rating yet' : `rating ${rating} (gap ${85 - rating} to 85)`, rel.length ? `${rel.length} active goal${rel.length > 1 ? 's' : ''}` : 'no linked goals', tr == null ? 'no 30-day trend' : `${tr >= 0 ? '+' : ''}${tr} in 30 days`, b.days == null ? 'never trained' : `trained ${b.days}d ago`];
      return { k, l, rating, score, parts: { gap: Math.round(gap), goalImp, trend: Math.round(trend), impact: Math.round(impact), neglect: Math.round(neglect) }, conf, confLabel: conf >= 1 ? 'High' : conf >= 0.85 ? 'Medium' : 'Low', reasons };
    }).sort((a, b) => b.score - a.score);
  });
}

// ----- 4. trends and relationships -----
function trendRows(weeks, minN) {
  const W = weeksBack(weeks), rows = [];
  for (const [key, label, , better, domain] of METRICS) {
    const vals = W.map((m) => weekMetric(key, m)), n = vals.filter((v) => v != null).length; if (n < minN) continue;
    const s = slopeOf(vals), v = vals.filter((x) => x != null), m = mean(v), sd = stdev(v) || 0, last = vals[vals.length - 1];
    const rel = m ? Math.abs((s.slope * (weeks - 1)) / m) : 0, dir = s.slope > 0 ? 'up' : 'down';
    const kind = rel < 0.08 || Math.abs(s.r) < 0.3 ? 'plateau' : better == null ? 'change' : (dir === 'up') === (better === 'up') ? 'positive' : 'negative';
    const half = Math.floor(v.length / 2), cv1 = stdev(v.slice(0, half)), cv2 = stdev(v.slice(half));
    const dev = last != null && sd && v.length >= 5 ? (last - mean(v.slice(0, -1))) / (stdev(v.slice(0, -1)) || sd) : null;
    rows.push({ key, label, domain, vals, W, n, slope: s.slope, r: s.r, kind, rel, dev: dev != null && Math.abs(dev) >= 2 ? dev : null, consist: cv1 != null && cv2 != null && Math.abs(cv2 - cv1) > sd * 0.5 ? (cv2 < cv1 ? 'steadier' : 'less steady') : null });
  }
  return rows;
}
// Predefined relationships from across the systems. [id, label, xKey, yKey, unit of pairing: 'day'|'nextday'|'week'|'session']
const RELATIONS = [
  ['loadReady', 'Training load → next-day readiness', 'load', 'readiness', 'nextday'], ['mentalShot', 'Mental readiness → shooting %', 'mental', 'shotPct', 'day'],
  ['consGoal', 'Workout consistency → goal progress', 'activeDays', 'goalPct', 'week'], ['volFat', 'Session volume → fatigue after', 'sessLoad', 'sessFatigue', 'session'],
  ['routineCons', 'Routine completion → training consistency', 'routine', 'activeDays', 'week'], ['sleepShot', 'Sleep → shooting %', 'sleep', 'shotPct', 'day'], ['stressReady', 'Stress → readiness', 'stress', 'readiness', 'day'],
];
function relationPairs([, , x, y, unit], weeks) {
  const days = lastNDays(weeks * 7);
  if (unit === 'session') return sessionsIn(days).filter((s) => s.fatigueAfter != null).map((s) => [s.load, s.fatigueAfter, s.date]);
  if (unit === 'week') return weeksBack(weeks).map((m) => [weekMetric(x, m), weekMetric(y, m), m]).filter(([a, b]) => a != null && b != null);
  return days.map((d) => [metricOn(x, [d]), metricOn(y, [unit === 'nextday' ? shiftIso(d, 1) : d]), d]).filter(([a, b]) => a != null && b != null && (x !== 'load' || a > 0));
}

// ----- 5. weekly intelligence review -----
const REVIEW_DOMAINS = [['Training', ['sessions', 'activeDays', 'hours']], ['Workload', ['load', 'rpe', 'fatigue']], ['Basketball', ['shots', 'shotPct', 'threePct', 'finishPct', 'handlesMin', 'gameScore']], ['Mental', ['mental', 'confidence', 'stress']], ['Recovery', ['readiness', 'sleep', 'soreness']], ['Nutrition', ['protein', 'proteinHit']], ['Routines', ['routine']], ['Goals', ['goalPct']], ['Calendar', ['adherence']]];
function reviewData(mon) {
  return cached('review:' + mon, () => {
    const prev = [1, 2, 3, 4].map((i) => shiftIso(mon, -7 * i)), rows = [];
    for (const [dom, keys] of REVIEW_DOMAINS) for (const k of keys) { const a = weekMetric(k, mon), b = weekMetric(k, prev[0]), avg = avgOf(prev.map((m) => weekMetric(k, m))); rows.push({ dom, k, a, b, avg, d: a != null && avg != null ? a - avg : null, pct: a != null && avg ? ((a - avg) / Math.abs(avg)) * 100 : null }); }
    const scored = rows.filter((x) => x.pct != null && MET[x.k][3] && Math.abs(x.pct) >= 5).map((x) => ({ ...x, good: (x.d > 0) === (MET[x.k][3] === 'up') }));
    const end = shiftIso(mon, 6), inW = (d) => d >= mon && d <= end;
    const acc = [...allPRs().filter((p) => inW(p.r.date)).map((p) => `🏆 PR: ${p.t.name} ${fmtVal(p.t, p.r.value)}`), ...goals().flatMap((g) => (g.milestones || []).filter((m) => m.done && inW(m.done)).map((m) => `✓ Milestone: ${m.label || fmtGoal(g, m.v)} (${g.title})`)), ...goals().filter((g) => goalState(g).status === 'done' && (g.history || []).some((h) => inW(h.date))).map((g) => `🎯 Goal achieved: ${g.title}`), ...routines().filter((r) => weekDays(mon).filter((d) => routineScheduled(r, d)).length >= 3 && weekDays(mon).filter((d) => routineScheduled(r, d)).every((d) => routineComplete(d, r.id))).map((r) => `🔁 Every ${r.name} done`), ...(weekMetric('activeDays', mon) >= (Number(aos().profile?.weeklyDays) || 5) ? [`📅 Hit your ${Number(aos().profile?.weeklyDays) || 5}-day training target`] : [])];
    return { mon, rows, improvements: scored.filter((x) => x.good).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4), setbacks: scored.filter((x) => !x.good).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4), acc, attention: insights2().filter((x) => x.level >= 2 && istate(x.id) !== 'dismissed').slice(0, 4), priorities: devPriorities().slice(0, 3) };
  });
}

// ===================== screens =====================
RENDER.intel = (el, sub) => INTEL[sub](el);
const INTEL = {};
const insCard = (x) => { const st = istate(x.id), [lc, ll] = LEVEL[x.level]; return `<details class="ins ${x.kind} ${st}" data-ins="${esc(x.id)}"><summary><span class="ins-k">${KIND_ICON[x.kind]}</span><span style="flex:1;min-width:0"><span class="tiny muted">${esc(x.cat)} · ${esc(x.period)}</span><b>${esc(x.title)}</b><span class="small">${esc(x.desc)}</span></span><span class="band ${lc}">${ll}</span></summary>
  <div class="ins-body"><p class="small"><b>Data:</b> ${esc(x.data)}</p><p class="small"><b>Why it matters:</b> ${esc(x.why)}</p><p class="small"><b>Next step:</b> ${esc(x.action.label)}</p>
  <div class="row"><button type="button" class="btn sm primary" ${x.action.ml ? `data-ml-go="1"` : `data-go="${x.action.go}"`} ${x.action.goal ? `data-goal="${x.action.goal}"` : ''}>${esc(x.action.label)} ›</button><button type="button" class="chip" data-insset="reviewed">${st === 'reviewed' ? '✓ Reviewed' : 'Mark reviewed'}</button><button type="button" class="chip ${st === 'saved' ? 'on' : ''}" data-insset="saved">${st === 'saved' ? '★ Saved' : '☆ Save'}</button><button type="button" class="chip" data-insset="task">＋ Task</button><button type="button" class="chip" data-insset="dismissed">Dismiss</button></div></div></details>`; };
INTEL.feed = (el) => {
  const all = insights2(), f = ui('insF', 'active'), c = ui('insC', 'all');
  const shown = all.filter((x) => (f === 'all' || (f === 'active' ? !['dismissed', 'reviewed'].includes(istate(x.id)) : istate(x.id) === f)) && (c === 'all' || x.cat === c));
  const cats = [...new Set(all.map((x) => x.cat))], n = (k) => all.filter((x) => x.kind === k && istate(x.id) !== 'dismissed').length;
  el.innerHTML = `<section class="card hero intel-hero"><p class="muted small">Athlete Intelligence</p><h1>Insight feed</h1><p class="small muted">Built from your logs across training, basketball, load, mind, calendar, routines, goals, nutrition and recovery. Updated every time you log.</p>
    <div class="kpis four" style="margin-top:12px"><div class="kpi"><small>Improving</small><b class="up">${n('up')}</b></div><div class="kpi"><small>Declining</small><b class="down">${n('down')}</b></div><div class="kpi"><small>Watch</small><b style="color:var(--warn)">${n('warn')}</b></div><div class="kpi"><small>Opportunities</small><b style="color:var(--accent)">${n('opp')}</b></div></div></section>
  <section class="card"><div class="row" style="margin-bottom:10px">${seg('insF', [['active', 'New'], ['saved', 'Saved'], ['reviewed', 'Reviewed'], ['dismissed', 'Dismissed'], ['all', 'All']], f)}</div>
    <div class="chips" style="margin-bottom:10px"><button type="button" class="chip ${c === 'all' ? 'on' : ''}" data-insc="all">All areas</button>${cats.map((x) => `<button type="button" class="chip ${c === x ? 'on' : ''}" data-insc="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    ${shown.length ? `<div class="stack">${shown.map(insCard).join('')}</div>` : all.length ? '<p class="muted small">Nothing in this view.</p>' : emptyState('Not enough data for insights yet', 'Insights need history to compare: two or more weeks of shooting, training, check-ins or goals. Nothing is generated from guesses.', 'spark')}
    <p class="muted tiny" style="margin-top:10px">Insights compare periods and point out patterns. They aren't medical assessments, and a pattern doesn't mean one thing caused another.</p></section>`;
};
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-insc]'); if (c) { setUi('insC', c.dataset.insc); return refresh(); }
  const b = e.target.closest('[data-insset]'); if (b) { const id = b.closest('[data-ins]').dataset.ins, s = b.dataset.insset; e.preventDefault();
    if (s === 'task') { const x = insights2().find((i) => i.id === id); setIns(id, 'saved'); return ACTIONS.event({ dataset: { date: todayIso(), pre: JSON.stringify({ title: x.title.slice(0, 50), type: 'skill', notes: `${x.desc} Next step: ${x.action.label}.` }) } }); }
    setIns(id, istate(id) === s ? 'new' : s); toast(s === 'dismissed' ? 'Dismissed' : s === 'saved' ? 'Saved' : 'Marked reviewed'); return refresh(); }
  const m = e.target.closest('[data-ml-go]'); if (m) goTo('macrolens.html');
});

INTEL.actions = (el) => {
  const rs = recs(), f = ui('recF', 'open'), I = intel().recs || {};
  const shown = rs.filter((r) => { const s = I[r.id]?.s; return f === 'open' ? !s || s === 'saved' : f === 'saved' ? s === 'saved' : f === 'accepted' ? s === 'accepted' || s === 'done' : s === 'dismissed'; });
  const tracked = Object.entries(I).filter(([, v]) => v.s === 'accepted' || v.s === 'done');
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Action center</h3><span class="sub">Recommendations from your insights and priorities. Nothing changes in your plan until you choose.</span></div>${seg('recF', [['open', 'Open'], ['saved', 'Saved'], ['accepted', 'Accepted'], ['dismissed', 'Dismissed']], f)}</div>
    ${shown.length ? `<div class="stack">${shown.map((r) => { const st = I[r.id]; return `<article class="rec p${r.priority}"><div class="row-between"><span class="band ${r.priority >= 3 ? 'lo' : r.priority === 2 ? 'mid' : 'hi'}">${r.priority >= 3 ? 'High' : r.priority === 2 ? 'Medium' : 'Low'} priority</span><span class="tiny muted">${esc(r.timeframe)}</span></div>
      <h4 style="font-size:16px;margin-top:6px">${esc(r.text)}</h4><p class="small"><b>Why:</b> ${esc(r.reason)}</p><p class="small"><b>Data:</b> ${esc(r.data)}</p><p class="small"><b>Measurable outcome:</b> ${esc(r.target)}${r.metric ? ` · tracked by ${esc(MET[r.metric][1].toLowerCase())} (now ${fmtM(r.metric, metricNow(r.metric))})` : ''}</p><p class="small"><b>Where:</b> <button type="button" class="chip" data-go="${r.feature[1]}">${esc(r.feature[0])} ›</button></p>
      ${st?.s === 'accepted' || st?.s === 'done' ? recTrack(r.id, st) : ''}
      <div class="row" style="margin-top:8px">${!st || st.s === 'saved' ? `<button type="button" class="btn sm primary" data-rec="accept" data-id="${r.id}">Accept</button>` : ''}${st?.s === 'accepted' ? `<button type="button" class="btn sm" data-rec="done" data-id="${r.id}">Mark done</button>` : ''}${r.goal || r.goalId ? `<button type="button" class="btn sm" data-rec="goal" data-id="${r.id}">→ Goal</button>` : ''}${r.event ? `<button type="button" class="btn sm" data-rec="event" data-id="${r.id}">→ Schedule</button>` : ''}${!st ? `<button type="button" class="chip" data-rec="save" data-id="${r.id}">☆ Save</button>` : ''}${st?.s !== 'dismissed' ? `<button type="button" class="chip" data-rec="dismiss" data-id="${r.id}">Dismiss</button>` : `<button type="button" class="chip" data-rec="restore" data-id="${r.id}">Restore</button>`}</div></article>`; }).join('')}</div>`
    : emptyState(rs.length ? 'Nothing here' : 'No recommendations yet', rs.length ? 'Try another filter.' : 'Recommendations come from insights and your development priorities. Keep logging and they appear.', 'spark')}</section>
  ${tracked.length ? `<section class="card"><div class="card-head"><div><h3>Results of accepted recommendations</h3><span class="sub">Baseline when you accepted vs the last 7 days</span></div></div><div class="list">${tracked.map(([id, v]) => `<div class="li" style="display:block"><div class="row-between"><span class="t">${esc(v.text)}</span><span class="band ${v.s === 'done' ? 'hi' : 'mid'}">${v.s === 'done' ? 'Done' : 'In progress'}</span></div>${recTrack(id, v)}</div>`).join('')}</div></section>` : ''}`;
};
function recTrack(id, st) {
  if (!st.metric) return `<p class="tiny muted">Accepted ${esc(fmtD(isoDate(new Date(st.at))))}. No numeric outcome to track; mark it done when complete.</p>`;
  const now = metricNow(st.metric), b = st.base, better = MET[st.metric][3], days = st.baseDate ? daysBetween(st.baseDate, todayIso()) : 0;
  const res = now == null || b == null ? 'Not enough new data yet' : Math.abs(now - b) < 0.5 ? 'No change yet' : (now > b) === (better !== 'down') ? 'Moving the right way' : 'Moving the wrong way';
  return `<p class="small" style="margin-top:4px">${esc(MET[st.metric][1])}: <b>${fmtM(st.metric, b)}</b> at start → <b>${fmtM(st.metric, now)}</b> now · ${days} day${days === 1 ? '' : 's'} · <span class="${res.includes('right') ? 'up' : res.includes('wrong') ? 'down' : 'muted'}">${res}</span></p>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rec]'); if (!b) return; const r = recs().find((x) => x.id === b.dataset.id) || { id: b.dataset.id, text: intel().recs?.[b.dataset.id]?.text }, a = b.dataset.rec;
  if (a === 'accept') { setRec(r, 'accepted'); toast('Accepted. Tracking starts now.'); }
  else if (a === 'done') setRec(r, 'done', { result: metricNow(r.metric) });
  else if (a === 'save') setRec(r, 'saved');
  else if (a === 'dismiss') setRec(r, 'dismissed');
  else if (a === 'restore') { const I = intel(); delete I.recs[r.id]; persist('aos-intel'); }
  else if (a === 'goal') { if (r.goalId) { setUi('goal', r.goalId); return go('train', 'goals'); } return ACTIONS.goal({ dataset: { pre: JSON.stringify({ ...r.goal, desc: r.reason, date: shiftIso(todayIso(), 28) }) } }); }
  else if (a === 'event') return ACTIONS.event({ dataset: { date: shiftIso(todayIso(), 1), pre: JSON.stringify({ ...r.event, notes: `${r.text}. ${r.reason}` }) } });
  refresh();
});

INTEL.profile = (el) => {
  const r = skillRatings(), past = skillRatings(shiftIso(todayIso(), -90)), ds = devScore(), sw = strengthsWeaknesses(r), W = weeksBack(12);
  const mon6 = []; for (let i = 5; i >= 0; i--) mon6.push(shiftIso(todayIso(), -30 * i));
  const hist = SKILLS.map(([k, l], i) => ({ name: l, color: ['var(--accent)', 'var(--good)', '#60a5fa', 'var(--purple)', 'var(--warn)', 'var(--str)', 'var(--cond)', '#ff6a3d'][i], pts: mon6.map((d) => ({ date: d, v: skillRatings(d)[k]?.v ?? null })).filter((p) => p.v != null) })).filter((s) => s.pts.length >= 2);
  const mind7 = MIND_METRICS.map(([k, l]) => { const v = avgOf(lastNDays(28).map((d) => mcheck(d)?.[k] ?? null)); return { label: k === 'ready' ? 'Readiness' : l, v: v == null ? null : Math.round((k === 'stress' ? 11 - v : v) * 10) }; });
  const attention = insights2().filter((x) => (x.kind === 'down' || x.kind === 'warn') && istate(x.id) !== 'dismissed').slice(0, 5);
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Development overview</h3><span class="sub">How the composite score is built, and what it can't tell you</span></div></div>
    ${ds ? `<div class="grid two" style="align-items:center"><div class="row" style="gap:16px;flex-wrap:nowrap">${ring(ds.score, 100, { size: 120, stroke: 11, color: 'var(--accent)', color2: 'var(--purple)', center: `<b style="font-size:30px">${ds.score}</b>` })}<div class="stack" style="gap:3px"><span class="small">= 0.70 × skill average (<b>${ds.skill}</b>)</span><span class="small">+ 0.15 × training consistency (<b>${ds.cons}</b>)</span><span class="small">+ 0.15 × 30-day momentum (<b>${ds.mom}</b>)</span><span class="tiny muted">${ds.n} of ${SKILLS.length} skills have data</span></div></div>
      <details class="notice"><summary class="small" style="cursor:pointer"><b>Limitations</b></summary><ul class="small" style="margin:6px 0 0;padding-left:18px"><li>Skill ratings compare your numbers with general high-school guard reference points, not official norms.</li><li>Skills without data are left out, so the score covers only what you log.</li><li>Practice shooting and tests aren't the same as game performance.</li><li>Use it to track your own direction over time, not to compare yourself with other players.</li></ul></details></div>` : emptyState('No composite yet', 'The overview needs at least two skill ratings (tests, shooting, finishing, handles, film or games).', 'chart')}</section>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Performance radar</h3><span class="sub">Now vs 90 days ago (dashed)</span></div></div>${radar(SKILLS.map(([k, l]) => ({ label: l.replace('Basketball ', ''), v: r[k]?.v ?? null, v2: past[k]?.v ?? r[k]?.v ?? null })), { compare: true, size: 270 })}</section>
    <section class="card"><div class="card-head"><div><h3>Strengths and weaknesses</h3></div></div>${sw.all.length ? `<div class="stack">${sw.all.map((x) => `<div><div class="row-between small"><span>${esc(x.l)}</span><b>${x.v}</b></div><div class="bar"><i style="width:${x.v}%;background:${x.v >= 75 ? 'var(--good)' : x.v >= 60 ? 'var(--accent)' : 'var(--warn)'}"></i></div><span class="tiny muted">${esc(x.basis)}</span></div>`).join('')}</div>` : '<p class="muted small">Log tests and skill sessions to see these.</p>'}${sw.missing.length ? `<p class="tiny muted" style="margin-top:8px">No data: ${sw.missing.join(', ')}</p>` : ''}</section></div>
  <section class="card"><div class="card-head"><div><h3>Historical development curves</h3><span class="sub">Skill ratings over the last 6 months (only skills with 2+ points)</span></div></div>${hist.length ? '<div class="chart" id="ip-hist"></div>' : '<p class="muted small">Curves appear once a skill has ratings at two different times.</p>'}</section>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Basketball profile</h3></div></div><div class="kpis">${['shotPct', 'threePct', 'finishPct', 'gameScore'].map((k) => `<div class="kpi"><small>${MET[k][1]} (30 d)</small><b>${fmtM(k, metricOn(k, lastNDays(30)))}</b></div>`).join('')}</div></section>
    <section class="card"><div class="card-head"><div><h3>Physical profile</h3></div></div><div class="kpis">${['vert', 'sprint40', 'squat', 'mile'].map((id) => { const t = testById(id), p = prOf(id); return `<div class="kpi"><small>${esc(t.name)}</small><b>${p ? esc(fmtVal(t, p.value)) : '—'}</b></div>`; }).join('')}</div></section></div>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Mental profile</h3><span class="sub">28-day average · stress flipped so bigger is better</span></div></div>${mind7.some((x) => x.v != null) ? radar(mind7, { size: 240 }) : '<p class="muted small">Do mental check-ins to build this.</p>'}</section>
    <section class="card"><div class="card-head"><div><h3>Consistency and recovery</h3><span class="sub">Weekly, last 12 weeks</span></div></div><div class="chart" id="ip-cons"></div></section></div>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Category comparison</h3><span class="sub">This 4 weeks vs the 4 before</span></div></div>${catCompare()}</section>
    <section class="card"><div class="card-head"><div><h3>Goal progression</h3></div></div>${goals().length ? goals().slice(0, 6).map((g) => { const s = goalState(g); return `<div style="margin-bottom:8px"><div class="row-between small"><span>${esc(g.title)}</span><b>${s.pct}%</b></div>${hbar(s.pct, s.status === 'done' ? 'var(--good)' : '')}</div>`; }).join('') : '<p class="muted small">No goals yet.</p>'}</section></div>
  <section class="card"><div class="card-head"><div><h3>Areas requiring attention</h3></div></div>${attention.length ? `<div class="stack">${attention.map(insCard).join('')}</div>` : '<p class="muted small">Nothing flagged right now.</p>'}</section>`;
  if (hist.length) drawMulti($('#ip-hist'), hist, { yMin: 25, yMax: 99, label: 'Skill rating history' });
  drawMulti($('#ip-cons'), [['activeDays', 'Active days', 'var(--accent)'], ['readiness', 'Readiness ÷ 10', 'var(--good)'], ['routine', 'Routines ÷ 10', '#f472b6']].map(([k, l, c]) => ({ name: l, color: c, pts: W.map((m) => ({ date: m, v: weekMetric(k, m) })).filter((p) => p.v != null).map((p) => ({ ...p, v: k === 'activeDays' ? p.v : r1(p.v / 10), tip: fmtM(k, k === 'activeDays' ? p.v : p.v) })) })), { yMin: 0, yMax: 10, h: 170 });
};
function catCompare() {
  const a = lastNDays(28), b = lastNDays(28, shiftIso(todayIso(), -28));
  const rows = ['shotPct', 'finishPct', 'activeDays', 'load', 'readiness', 'mental', 'protein', 'routine', 'adherence'].map((k) => ({ k, a: metricOn(k, a), b: metricOn(k, b) })).filter((x) => x.a != null || x.b != null);
  return rows.length ? `<div class="cmp"><span class="h">Metric</span><span class="h">Last 4 wk</span><span class="h">Before</span><span class="h">Δ</span>${rows.map((x) => `<span>${MET[x.k][1]}</span><b>${fmtM(x.k, x.a)}</b><span class="muted">${fmtM(x.k, x.b)}</span>${MET[x.k][2] === '%' && x.a != null && x.b != null ? deltaPill(x.a - x.b, MET[x.k][3] === 'down', ' pts') : deltaPill(pctChange(x.a, x.b), MET[x.k][3] === 'down')}`).join('')}</div>` : '<p class="muted small">Needs data in both periods.</p>';
}

INTEL.review = (el) => {
  const wks = weeksBack(8).reverse(), mon = ui('irWeek', shiftIso(mondayOf(todayIso()), -7)), R = reviewData(mon), ai = intel().reviews?.[mon];
  const line = (x) => `<div class="li"><span class="small">${esc(MET[x.k][1])}</span><span class="small"><b>${fmtM(x.k, x.a)}</b> <span class="muted">vs ${fmtM(x.k, x.avg)} avg</span> ${MET[x.k][2] === '%' ? deltaPill(x.d, MET[x.k][3] === 'down', ' pts') : deltaPill(x.pct, MET[x.k][3] === 'down')}</span></div>`;
  el.innerHTML = `<section class="card hero intel-hero"><div class="row-between"><div><p class="muted small">Weekly intelligence review</p><h1>Week of ${esc(fmtD(mon))}</h1><p class="small muted">Compared with your previous 4-week average</p></div><select id="ir-week" style="max-width:180px" aria-label="Week">${wks.map((m, i) => `<option value="${m}" ${m === mon ? 'selected' : ''}>${i === 0 ? 'This week (so far)' : i === 1 ? 'Last week' : 'Week of ' + fmtD(m)}</option>`).join('')}</select></div></section>
  <div class="grid two"><section class="card"><div class="card-head"><h3 class="up">Biggest improvements</h3></div>${R.improvements.length ? `<div class="list">${R.improvements.map(line).join('')}</div>` : '<p class="muted small">No clear improvements (5%+ vs average) this week.</p>'}</section>
    <section class="card"><div class="card-head"><h3 class="down">Biggest setbacks</h3></div>${R.setbacks.length ? `<div class="list">${R.setbacks.map(line).join('')}</div>` : '<p class="muted small">No clear setbacks this week.</p>'}</section></div>
  <section class="card"><div class="card-head"><div><h3>All nine areas</h3><span class="sub">This week vs last week vs 4-week average · tap an area for its 8-week trend</span></div></div><div class="stack">${REVIEW_DOMAINS.map(([dom, keys]) => { const rs = R.rows.filter((x) => x.dom === dom && (x.a != null || x.avg != null)); return `<details class="dom"><summary class="row-between"><b>${dom}</b><span class="tiny muted">${rs.length ? rs.map((x) => `${MET[x.k][1]} ${fmtM(x.k, x.a)}`).slice(0, 2).join(' · ') : 'no data'}</span></summary>${rs.length ? `<div class="cmp" style="margin-top:8px"><span class="h">Metric</span><span class="h">This wk</span><span class="h">Last wk</span><span class="h">vs avg</span>${rs.map((x) => `<span>${esc(MET[x.k][1])}</span><b>${fmtM(x.k, x.a)}</b><span class="muted">${fmtM(x.k, x.b)}</span>${MET[x.k][2] === '%' && x.d != null ? deltaPill(x.d, MET[x.k][3] === 'down', ' pts') : deltaPill(x.pct, MET[x.k][3] === 'down')}`).join('')}</div><div class="spark-row">${keys.map((k) => { const v = weeksBack(8, mon).map((m) => weekMetric(k, m)).filter((x) => x != null); return v.length >= 2 ? `<span class="tiny">${esc(MET[k][1])} ${spark(v, 'var(--accent)', 90, 24)}</span>` : ''; }).join('')}</div>` : '<p class="muted small">Nothing logged in this area.</p>'}</details>`; }).join('')}</div></section>
  <section class="card"><div class="card-head"><div><h3>Index vs your average</h3><span class="sub">100 = your 4-week average · above is better for most metrics</span></div></div><div class="chart" id="ir-idx"></div></section>
  <div class="grid two"><section class="card"><div class="card-head"><h3>Accomplishments</h3></div>${R.acc.length ? `<ul class="small" style="margin:0;padding-left:18px;display:grid;gap:4px">${R.acc.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="muted small">No PRs, milestones or completed routines this week.</p>'}</section>
    <section class="card"><div class="card-head"><h3>Needs attention</h3></div>${R.attention.length ? R.attention.map((x) => `<p class="small">⚠ <b>${esc(x.title)}</b> · ${esc(x.desc)}</p>`).join('') : '<p class="muted small">Nothing urgent.</p>'}</section></div>
  <section class="card"><div class="card-head"><div><h3>Priorities for next week</h3><span class="sub">From the development priority system</span></div><button type="button" class="btn sm" data-go="intel-priorities">Details</button></div>${R.priorities.map((p, i) => `<p class="small"><b>${i + 1}. ${esc(p.l)}</b> · score ${p.score} · ${esc(p.reasons.join(', '))}</p>`).join('')}</section>
  <section class="card ai"><div class="card-head"><div><h3>Coach's read <span class="ai-badge">AI</span></h3><span class="sub">Observations vs hypotheses, with follow-up on accepted recommendations</span></div>${aiOn() ? `<button type="button" class="btn sm primary" data-act="ai-review" data-mon="${mon}">${ai ? 'Redo' : 'Write it'}</button>` : ''}</div><div id="ir-ai">${ai ? aiReviewHtml(ai) : aiOn() ? '<p class="muted small">One request per week; the result is saved.</p>' : aiUnavailable()}</div></section>`;
  const idx = R.rows.filter((x) => x.a != null && x.avg && MET[x.k][3]).map((x) => ({ label: MET[x.k][1].split(' ')[0].slice(0, 8), full: `${MET[x.k][1]} (${x.dom})`, segs: [{ v: Math.max(0, Math.round((x.a / x.avg) * 100)), color: (x.a >= x.avg) === (MET[x.k][3] === 'up') ? 'var(--good)' : 'var(--over)' }], tip: `${fmtM(x.k, x.a)} vs ${fmtM(x.k, x.avg)} avg` }));
  if (idx.length) drawBars($('#ir-idx'), idx, { goal: 100, h: 190 }); else $('#ir-idx').innerHTML = '<p class="muted small">Needs this week and earlier weeks to compare.</p>';
  $('#ir-week').addEventListener('change', (e) => { setUi('irWeek', e.target.value); refresh(); });
};
const aiReviewHtml = (a) => `<div class="ai-out">${['observations', 'hypotheses', 'followUp', 'priorities'].map((k) => (a[k]?.length ? `<div><h4>${{ observations: 'Observations (from your data)', hypotheses: 'Hypotheses (possible explanations, unproven)', followUp: 'Follow-up on recommendations', priorities: 'Next week' }[k]}</h4><ul>${a[k].map((x) => `<li class="small">${esc(x)}</li>`).join('')}</ul></div>` : '')).join('')}${a.insufficient ? `<p class="tiny muted">Not enough data: ${esc(a.insufficient)}</p>` : ''}</div>`;
ACTIONS['ai-review'] = async (b) => {
  const mon = b.dataset.mon, R = reviewData(mon); b.disabled = true; $('#ir-ai').innerHTML = '<p class="muted small">Reviewing your week…</p>';
  try {
    const tracked = Object.values(intel().recs || {}).filter((v) => ['accepted', 'done', 'dismissed'].includes(v.s)).map((v) => ({ rec: v.text, status: v.s, metric: v.metric && MET[v.metric][1], atStart: v.base, now: v.metric ? metricNow(v.metric) : null, since: v.baseDate }));
    const r = await askAI(`${AI_RULES}\nSeparate observations (facts in the data) from hypotheses (possible explanations). If there isn't enough data for a point, say so. No medical claims.\n\nWeek ${mon} vs 4-week average:\n${JSON.stringify(R.rows.filter((x) => x.a != null || x.avg != null).map((x) => ({ metric: MET[x.k][1], thisWeek: x.a, lastWeek: x.b, avg4: x.avg })))}\nAccomplishments: ${JSON.stringify(R.acc)}\nInsights: ${JSON.stringify(insights2().slice(0, 10).map((x) => x.title + ': ' + x.desc))}\nPriorities: ${JSON.stringify(R.priorities.map((p) => ({ area: p.l, score: p.score, reasons: p.reasons })))}\nRecommendations previously accepted or dismissed (were they followed? did the metric move?): ${JSON.stringify(tracked)}\n\nReturn JSON {"observations": [3-5 strings citing numbers], "hypotheses": [1-3 strings, each phrased as a possibility], "followUp": [0-3 strings about the tracked recommendations], "priorities": [3 measurable actions for next week], "insufficient": string}.`);
    const a = { observations: (r.observations || []).map(String).slice(0, 6), hypotheses: (r.hypotheses || []).map(String).slice(0, 4), followUp: (r.followUp || []).map(String).slice(0, 4), priorities: (r.priorities || []).map(String).slice(0, 4), insufficient: String(r.insufficient || '') };
    const I = intel(); I.reviews = { ...(I.reviews || {}), [mon]: a }; persist('aos-intel'); $('#ir-ai').innerHTML = aiReviewHtml(a);
  } catch (e) { $('#ir-ai').innerHTML = `<p class="small down">${esc(aiError(e))}</p>`; }
  b.disabled = false;
};

INTEL.trends = (el) => {
  const weeks = Number(ui('trW', '12')), minN = Number(ui('trMin', '4')), rows = trendRows(weeks, minN), kf = ui('trK', 'all');
  const shown = rows.filter((x) => kf === 'all' || x.kind === kf || (kf === 'deviation' && x.dev) || (kf === 'consistency' && x.consist));
  const K = { positive: ['hi', 'Positive'], negative: ['lo', 'Negative'], plateau: ['flat', 'Plateau'], change: ['mid', 'Changing'] };
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Trend detection</h3><span class="sub">Weekly values, least-squares trend · a plateau = less than 8% change across the range or a weak fit</span></div></div>
    <div class="row">${seg('trW', [['4', '4 wk'], ['8', '8 wk'], ['12', '12 wk'], ['26', '26 wk']], String(weeks))}<label class="row small" style="gap:6px;color:var(--fg)">Min weeks of data <select id="tr-min" style="width:70px">${[3, 4, 6, 8].map((n) => `<option ${n === minN ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <div class="chips" style="margin-top:10px">${[['all', 'All'], ['positive', 'Positive'], ['negative', 'Negative'], ['plateau', 'Plateaus'], ['deviation', 'Unusual weeks'], ['consistency', 'Consistency changes']].map(([k, l]) => `<button type="button" class="chip ${kf === k ? 'on' : ''}" data-trk="${k}">${l}</button>`).join('')}</div></section>
  ${shown.length ? `<div class="trend-grid">${shown.map((x) => `<details class="card trend"><summary><div class="row-between"><span class="tiny muted">${esc(x.domain)}</span><span class="band ${K[x.kind][0]}">${K[x.kind][1]}</span></div><b>${esc(x.label)}</b><div class="row-between">${spark(x.vals.filter((v) => v != null), x.kind === 'positive' ? 'var(--good)' : x.kind === 'negative' ? 'var(--danger)' : 'var(--accent)', 120, 30)}<span class="small num">${fmtM(x.key, x.vals.filter((v) => v != null).slice(-1)[0])}</span></div><span class="tiny muted">${x.n} weeks · ${x.slope >= 0 ? '+' : ''}${r2(x.slope)}/week · fit r ${x.r.toFixed(2)}${x.dev ? ` · last week ${r1(Math.abs(x.dev))} SD ${x.dev > 0 ? 'above' : 'below'} normal` : ''}${x.consist ? ` · ${x.consist}` : ''}</span></summary><div class="chart tr-c" data-trkey="${x.key}"></div></details>`).join('')}</div>`
    : `<section class="card">${emptyState('No trends at these settings', `Trends need at least ${minN} weeks with data in the last ${weeks}. Lower the minimum or widen the range.`, 'chart')}</section>`}
  <section class="card"><div class="card-head"><div><h3>Relationships between systems</h3><span class="sub">Correlation, not causation · needs ${Math.max(6, minN * 2)}+ paired points</span></div></div><div class="stack">${RELATIONS.map((R) => { const ps = relationPairs(R, weeks), need = R[4] === 'week' ? minN : Math.max(6, minN * 2), f = ps.length >= need ? pearson(ps) : null; return `<details class="dom" data-rel="${R[0]}"><summary class="row-between"><span class="small"><b>${esc(R[1])}</b></span><span class="tiny ${f ? '' : 'muted'}">${f ? `r ${f.r >= 0 ? '+' : ''}${f.r.toFixed(2)} · ${strength(f.r)} · n ${f.n}` : `${ps.length}/${need} points`}</span></summary>${f ? `<div class="chart rel-c" data-relid="${R[0]}"></div><p class="small">${Math.abs(f.r) < 0.2 ? 'No clear relationship in this range.' : `When the first went up, the second tended to go ${f.r > 0 ? 'up' : 'down'}. This is a pattern only; other factors (games, school, sleep) could explain both.`}</p>` : '<p class="muted small">Not enough paired data yet.</p>'}</details>`; }).join('')}</div></section>`;
  $('#tr-min').addEventListener('change', (e) => { setUi('trMin', e.target.value); refresh(); });
  el.querySelectorAll('details.trend').forEach((d) => d.addEventListener('toggle', () => { const c = $('.tr-c', d); if (d.open && !c.innerHTML) { const x = rows.find((r) => r.key === c.dataset.trkey); drawLine(c, x.W.map((m, i) => ({ date: m, v: x.vals[i] })).filter((p) => p.v != null).map((p) => ({ ...p, tip: fmtM(x.key, p.v) })), { h: 150, fmt: (v) => fmtM(x.key, v), label: x.label }); } }));
  el.querySelectorAll('details[data-rel]').forEach((d) => d.addEventListener('toggle', () => { const c = $('.rel-c', d); if (d.open && c && !c.innerHTML) { const R = RELATIONS.find((x) => x[0] === d.dataset.rel), ps = relationPairs(R, weeks); drawScatter(c, ps, { xl: R[1].split(' → ')[0], yl: R[1].split(' → ')[1], fit: pearson(ps), h: 200 }); } }));
};
document.addEventListener('click', (e) => { const t = e.target.closest('[data-trk]'); if (t) { setUi('trK', t.dataset.trk); refresh(); } });

INTEL.priorities = (el) => {
  const ps = devPriorities();
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Development priorities</h3><span class="sub">Ranked by a transparent formula · tap one to see the parts</span></div></div>
    <p class="notice small">Score = (30% gap to an 85 rating + 20% importance to your goals + 20% recent trend + 15% impact for a guard + 15% time since trained) × data confidence. Low confidence (little data) lowers the score instead of guessing.</p>
    <div class="stack" style="margin-top:10px">${ps.map((p, i) => `<details class="prio ${i < 3 ? 'top' : ''}"><summary><span class="prio-n">${i + 1}</span><span style="flex:1;min-width:0"><b>${esc(p.l)}</b><span class="tiny muted" style="display:block">${esc(p.reasons.join(' · '))}</span>${hbar(p.score, i < 3 ? '' : 'var(--oth)')}</span><span class="v">${p.score}</span></summary>
      <div class="cmp" style="grid-template-columns:minmax(0,1.6fr) repeat(2,minmax(0,1fr));margin-top:8px"><span class="h">Criterion</span><span class="h">Value</span><span class="h">Weight</span>${[['Gap to target', p.parts.gap, '30%'], ['Goal importance', p.parts.goalImp, '20%'], ['Recent trend (higher = declining)', p.parts.trend, '20%'], ['Impact for a guard', p.parts.impact, '15%'], ['Time since trained', p.parts.neglect, '15%']].map(([l, v, w]) => `<span class="small">${l}</span><b>${v}</b><span class="muted">${w}</span>`).join('')}<span class="small">Data confidence</span><b>${p.confLabel}</b><span class="muted">× ${p.conf}</span></div>
      <div class="row" style="margin-top:10px"><button type="button" class="btn sm primary" data-pri-to="goal" data-k="${p.k}">→ Goal</button><button type="button" class="btn sm" data-pri-to="workout" data-k="${p.k}">→ Workout</button><button type="button" class="btn sm" data-pri-to="event" data-k="${p.k}">→ Schedule</button></div></details>`).join('')}</div></section>`;
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pri-to]'); if (!b) return; const p = devPriorities().find((x) => x.k === b.dataset.k), to = b.dataset.priTo;
  const cat = { shooting: 'shooting', handles: 'handles', finishing: 'finishing', athleticism: 'athleticism', strength: 'strength', conditioning: 'conditioning', iq: 'skills', impact: 'skills' }[p.k];
  if (to === 'goal') return ACTIONS.goal({ dataset: { pre: JSON.stringify({ title: `${p.l}: rating ${p.rating == null ? 'first rating' : Math.min(99, p.rating + 5)}`, cat, desc: p.reasons.join('; '), date: shiftIso(todayIso(), 42) }) } });
  if (to === 'workout') { setUi('wFocus', { shooting: 'shooting', handles: 'handles', finishing: 'finishing', athleticism: 'jump', strength: 'strength', conditioning: 'conditioning', iq: 'skills', impact: 'skills' }[p.k]); return go('coach', 'workout'); }
  return ACTIONS.event({ dataset: { date: shiftIso(todayIso(), 1), pre: JSON.stringify({ title: `${p.l} session`, type: p.k === 'strength' ? 'lift' : p.k === 'conditioning' ? 'conditioning' : p.k === 'shooting' ? 'shooting' : 'skill', notes: 'Development priority: ' + p.reasons.join(', ') }) } });
});
