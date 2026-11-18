// ===================== intelligence layer (Edition 2) =====================
// One place for derived numbers: training load, readiness, skill ratings, development score, priorities,
// balance, projections, nutrition consistency and achievements. Every screen reads these, so they always agree.
// Nothing here invents data: a rating or score that lacks inputs is null and the UI says what to log.

// ----- training load (session RPE x minutes, Foster method) -----
const INT_RPE = { light: 3, moderate: 5, hard: 7 };
const sessionRPE = (x) => Number(x.rpe) || INT_RPE[x.int] || 5;
const sessionLoad = (x) => Math.round(sessionRPE(x) * (Number(x.mins) || 0));
const loadOf = (d) => exList(d).reduce((a, x) => a + sessionLoad(x), 0);
const loadEstimated = (d) => exList(d).some((x) => !x.rpe);
function loadStats(end = todayIso()) {
  const d7 = lastNDays(7, end), d28 = lastNDays(28, end);
  const l7 = d7.map(loadOf), l28 = d28.map(loadOf);
  const acute = sum(l7), chronic = sum(l28) / 4;
  const firstData = allDayKeys().find(isActive);
  const history = firstData ? daysBetween(firstData, end) + 1 : 0;
  const acwr = chronic > 0 && history >= 21 ? acute / chronic : null;
  const m = mean(l7), sd = Math.sqrt(mean(l7.map((v) => (v - m) ** 2)) || 0);
  const monotony = sd > 0 ? m / sd : null;
  return { acute, chronic: Math.round(chronic), acwr: acwr == null ? null : r2(acwr), monotony: monotony == null ? null : r2(monotony), strain: monotony == null ? null : Math.round(acute * monotony), history, est: d7.some(loadEstimated) };
}
const acwrZone = (r) => (r == null ? ['flat', 'Not enough history'] : r < 0.8 ? ['mid', 'Under-loaded'] : r <= 1.3 ? ['hi', 'Sweet spot'] : r <= 1.5 ? ['mid', 'Caution'] : ['lo', 'Spike risk']);
function dayIntensity(d) {
  const xs = exList(d); if (!xs.length) return 'rest';
  const L = loadOf(d), maxR = Math.max(...xs.map(sessionRPE));
  return L >= 600 || maxR >= 8 ? 'high' : L >= 300 ? 'medium' : 'low';
}
/** Readiness = recovery inputs, adjusted for load spikes and injury status. */
function readiness(date = todayIso()) {
  const rs = recoveryScore(date); if (!rs) return null;
  const ls = loadStats(date); let score = rs.score; const notes = [];
  if (ls.acwr != null && ls.acwr > 1.5) { score -= 10; notes.push('Load spike this week (-10)'); } else if (ls.acwr != null && ls.acwr > 1.3) { score -= 5; notes.push('Load climbing fast (-5)'); }
  const f = dayDoc(date)?.feel?.fatigue; if (f != null && f >= 4) { score -= 5; notes.push('High fatigue (-5)'); }
  const st = availability(); if (st.status === 'limited') { score -= 5; notes.push('Limited by injury (-5)'); }
  return { score: clamp(Math.round(score), 0, 100), base: rs, notes };
}
function restAdvice(date = todayIso()) {
  const out = [], ls = loadStats(date), rd = readiness(date), st = availability();
  let streak = 0; for (let d = date; isActive(d); d = shiftIso(d, -1)) streak++;
  if (st.status === 'out') out.push(['lo', 'You marked yourself out. Rest and follow your trainer or doctor before training.']);
  if (ls.acwr != null && ls.acwr > 1.5) out.push(['lo', `This week's load is ${ls.acwr}x your 4-week average. Take a rest or recovery day to avoid a spike.`]);
  if (streak >= 6) out.push(['mid', `You've trained ${streak} days in a row. Schedule a full rest day in the next 48 hours.`]);
  if (rd && rd.score < 45) out.push(['lo', `Readiness is ${rd.score}. Make today light: skill work, mobility, sleep.`]);
  if (ls.monotony != null && ls.monotony > 2) out.push(['mid', 'Every day this week has been about the same load. Alternate hard and easy days.']);
  if (!out.length && rd) out.push(['hi', 'No red flags. Train as planned.']);
  return out;
}
function availability() {
  const s = aos().status || {}; return { status: s.status || 'available', area: s.area || '', note: s.note || '', since: s.since || null, back: s.back || null };
}

// ----- skill ratings (0-99) from your own data, against general high-school guard reference points -----
const SKILLS = [
  ['shooting', 'Shooting', 'ball'], ['finishing', 'Finishing', 'ball'], ['handles', 'Ball handling', 'ball'], ['iq', 'Basketball IQ', 'spark'],
  ['athleticism', 'Athleticism', 'bolt'], ['strength', 'Strength', 'dumbbell'], ['conditioning', 'Conditioning', 'heart'], ['impact', 'Game impact', 'trophy'],
];
const rate = (v) => clamp(Math.round(v), 25, 99);
const lin = (x, x0, y0, x1, y1) => y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
/** Best result for a test on or before a date. */
function prAsOf(id, asOf) {
  const t = testById(id); if (!t) return null;
  const rs = resultsOf(id).filter((r) => r.date <= asOf); if (!rs.length) return null;
  return rs.reduce((b, r) => betterOf(t, b, r.value), rs[0].value);
}
const bodyWeightAsOf = (asOf) => { const w = bodySeries('weight').filter((p) => p.date <= asOf); return w.length ? w[w.length - 1].v : core().profile?.weightLb || null; };
function skillRatings(asOf = todayIso()) {
  const from = shiftIso(asOf, -60), inWin = (d) => d >= from && d <= asOf, out = {};
  // Shooting: all shots and 3s in the last 60 days (100+ shots needed)
  const ss = shotSessions().filter((s) => inWin(s.date)).map(sessionTotals), m = sum(ss.map((s) => s.m)), a = sum(ss.map((s) => s.a)), m3 = sum(ss.map((s) => s.m3)), a3 = sum(ss.map((s) => s.a3));
  if (a >= 100) { const parts = [lin(m / a, 0.4, 60, 0.55, 85)]; if (a3 >= 50) parts.push(lin(m3 / a3, 0.33, 60, 0.45, 85)); out.shooting = { v: rate(mean(parts)), basis: `${pctTxt(m / a)} on ${a} shots${a3 >= 50 ? `, ${pctTxt(m3 / a3)} from three` : ''} (60 days)` }; }
  // Finishing: finishing sessions, both hands
  const fs = finishSessions().filter((s) => inWin(s.date)), ft = finishTotals(fs);
  if (ft.a >= 40) { let v = lin(ft.m / ft.a, 0.55, 60, 0.75, 85); if (ft.L.a >= 15 && ft.R.a >= 15) v -= Math.max(0, (ft.R.m / ft.R.a - ft.L.m / ft.L.a) * 40); out.finishing = { v: rate(v), basis: `${pctTxt(ft.m / ft.a)} on ${ft.a} finishes${ft.L.a ? `, weak hand ${pctTxt(ft.L.m / ft.L.a)}` : ''}` }; }
  // Ball handling: weak-hand share, ball security, time
  const hs = handleSessions().filter((s) => inWin(s.date));
  if (hs.length >= 2) { const mins = sum(hs.map((s) => s.mins)), weak = sum(hs.map((s) => s.weakMins || 0)), loss = sum(hs.map((s) => s.losses || 0)); const share = mins ? weak / mins : 0, per10 = mins ? (loss / mins) * 10 : 0; const v = 45 + Math.min(22, (share / 0.4) * 22) + Math.max(0, 18 - per10 * 6) + Math.min(14, mins / 60); out.handles = { v: rate(v), basis: `${hs.length} sessions, ${Math.round(share * 100)}% weak hand, ${r1(per10)} ball losses per 10 min` }; }
  // IQ: film work and read accuracy
  const fl = filmEntries().filter((f) => inWin(f.date)), reads = sum(fl.map((f) => f.reads || 0)), good = sum(fl.map((f) => f.correct || 0)), fmins = sum(fl.map((f) => f.mins || 0));
  if (fl.length >= 2) { const acc = reads >= 10 ? good / reads : null; const v = 48 + (acc != null ? (acc - 0.5) * 70 : 8) + Math.min(16, (fmins / 60) * 3); out.iq = { v: rate(v), basis: `${fl.length} film/IQ entries, ${Math.round(fmins)} min${acc != null ? `, ${pctTxt(acc)} correct reads` : ''}` }; }
  // Athleticism: vertical, 40, lane agility
  const ath = [], ab = [], v = prAsOf('vert', asOf) ?? prAsOf('appvert', asOf), s40 = prAsOf('sprint40', asOf), lane = prAsOf('lane', asOf), sh = prAsOf('shuttle', asOf);
  if (v) { ath.push(lin(v, 20, 50, 32, 85)); ab.push(`${v}" vertical`); } if (s40) { ath.push(lin(s40, 5.4, 50, 4.7, 85)); ab.push(`${s40}s 40`); } if (lane) { ath.push(lin(lane, 12, 50, 10.6, 85)); ab.push(`${lane}s lane agility`); } if (sh) { ath.push(lin(sh, 5.3, 50, 4.4, 85)); ab.push(`${sh}s pro agility`); }
  if (ath.length) out.athleticism = { v: rate(mean(ath)), basis: ab.join(', ') };
  // Strength: relative to body weight
  const bw = bodyWeightAsOf(asOf), st = [], sb = [], sq = prAsOf('squat', asOf), bp = prAsOf('bench', asOf), dl = prAsOf('deadlift', asOf), pu = prAsOf('pullups', asOf), push = prAsOf('pushups', asOf);
  if (sq && bw) { st.push(lin(sq / bw, 1, 50, 1.9, 85)); sb.push(`squat ${r2(sq / bw)}x BW`); } if (bp && bw) { st.push(lin(bp / bw, 0.7, 50, 1.3, 85)); sb.push(`bench ${r2(bp / bw)}x BW`); } if (dl && bw) { st.push(lin(dl / bw, 1.3, 50, 2.3, 85)); sb.push(`deadlift ${r2(dl / bw)}x BW`); } if (pu) { st.push(lin(pu, 5, 50, 18, 85)); sb.push(`${pu} pull-ups`); } if (push) { st.push(lin(push, 25, 50, 60, 85)); sb.push(`${push} push-ups`); }
  if (st.length) out.strength = { v: rate(mean(st)), basis: sb.join(', ') };
  // Conditioning: mile, beep, suicides
  const co = [], cb = [], mile = prAsOf('mile', asOf), beep = prAsOf('beep', asOf), sui = prAsOf('suicides', asOf);
  if (mile) { co.push(lin(mile, 480, 50, 340, 85)); cb.push(`mile ${fmtVal(testById('mile'), mile)}`); } if (beep) { co.push(lin(beep, 8, 50, 13, 85)); cb.push(`beep level ${beep}`); } if (sui) { co.push(lin(sui, 34, 50, 28, 85)); cb.push(`suicides ${sui}s`); }
  if (co.length) out.conditioning = { v: rate(mean(co)), basis: cb.join(', ') };
  // Game impact: average Game Score over recent games
  const gs = games().filter((g) => g.date <= asOf).slice(-8).map(gameScore).filter((x) => x != null);
  if (gs.length >= 2) out.impact = { v: rate(lin(mean(gs), 4, 50, 16, 85)), basis: `${r1(mean(gs))} avg Game Score over ${gs.length} games` };
  return out;
}
/** Athlete development score: average skill rating, plus training consistency and recent momentum. */
function devScore(asOf = todayIso()) {
  const r = skillRatings(asOf), vals = Object.values(r).map((x) => x.v);
  if (vals.length < 2) return null;
  const active = lastNDays(30, asOf).filter(isActive).length, cons = clamp(active / Math.min(30, (Number(aos().profile?.weeklyDays) || 5) * 30 / 7), 0, 1);
  const past = skillRatings(shiftIso(asOf, -30)), common = Object.keys(r).filter((k) => past[k]);
  const mom = common.length ? clamp(50 + mean(common.map((k) => r[k].v - past[k].v)) * 5, 0, 100) : 50;
  return { score: Math.round(0.7 * mean(vals) + 0.15 * cons * 100 + 0.15 * mom), skill: Math.round(mean(vals)), cons: Math.round(cons * 100), mom: Math.round(mom), n: vals.length };
}
function devHistory(weeks = 12) {
  const out = []; for (let i = weeks - 1; i >= 0; i--) { const d = shiftIso(todayIso(), -7 * i), s = devScore(d); if (s) out.push({ date: d, v: s.score, tip: `Score ${s.score}` }); }
  return out;
}

// ----- skill priority calculator and training balance -----
const POS_WEIGHT = { shooting: 1.25, handles: 1.2, iq: 1.15, finishing: 1.05, athleticism: 1, conditioning: 0.95, strength: 0.9, impact: 0.8 };
function lastTrained(skill) {
  const ds = [];
  if (skill === 'shooting') ds.push(...shotSessions().map((s) => s.date), ...allDayKeys().filter((d) => exList(d).some((x) => x.type === 'shooting')));
  if (skill === 'handles') ds.push(...handleSessions().map((s) => s.date), ...allDayKeys().filter((d) => exList(d).some((x) => x.type === 'handles')));
  if (skill === 'finishing') ds.push(...finishSessions().map((s) => s.date), ...allDayKeys().filter((d) => exList(d).some((x) => x.type === 'finishing')));
  if (skill === 'iq') ds.push(...filmEntries().map((f) => f.date));
  if (skill === 'strength') ds.push(...allDayKeys().filter((d) => exList(d).some((x) => x.type === 'lift')));
  if (skill === 'athleticism') ds.push(...allDayKeys().filter((d) => exList(d).some((x) => ['speed', 'lift'].includes(x.type))));
  if (skill === 'conditioning') ds.push(...allDayKeys().filter((d) => exList(d).some((x) => ['conditioning', 'run', 'bike'].includes(x.type))));
  if (skill === 'impact') ds.push(...games().map((g) => g.date));
  const d = ds.filter((x) => x <= todayIso()).sort().pop();
  return d || null;
}
function priorities() {
  const r = skillRatings(), pri = new Set((aos().profile?.priorities || []).map((x) => x.toLowerCase()));
  return SKILLS.map(([k, l]) => {
    const rating = r[k]?.v ?? null, last = lastTrained(k), days = last ? daysBetween(last, todayIso()) : null;
    const gap = rating == null ? 25 : Math.max(0, 85 - rating);
    const neglect = days == null ? 1.4 : clamp(days / 10, 0.3, 1.6);
    const want = [...pri].some((p) => l.toLowerCase().includes(p.split(' ')[0])) ? 1.25 : 1;
    return { k, l, rating, last, days, score: Math.round(gap * (POS_WEIGHT[k] || 1) * neglect * want), why: [rating == null ? 'no rating yet (log it)' : `rating ${rating}`, days == null ? 'never logged' : `last trained ${days} day${days === 1 ? '' : 's'} ago`, want > 1 ? 'one of your priorities' : ''].filter(Boolean).join(' · ') };
  }).sort((a, b) => b.score - a.score);
}
const BALANCE_TARGET = { hoops: 0.55, strength: 0.2, cond: 0.15, other: 0.1 };
function balance(days = 28) {
  const by = { hoops: 0, strength: 0, cond: 0, other: 0 };
  for (const d of lastNDays(days)) { const t = trainingOf(d); for (const k in by) by[k] += t.by[k]; }
  const tot = sum(Object.values(by));
  return { by, tot, share: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, tot ? v / tot : 0])) };
}

// ----- projections (least-squares trend of a test) -----
function projectTest(id, daysAhead = 90) {
  const t = testById(id), rs = resultsOf(id); if (!t || rs.length < 3) return null;
  const t0 = parseIso(rs[0].date).getTime(), ps = rs.map((r) => [(parseIso(r.date).getTime() - t0) / 864e5, r.value]);
  const fit = pearson(ps); if (!fit) return null;
  const lastX = ps[ps.length - 1][0], end = shiftIso(rs[rs.length - 1].date, daysAhead), x = lastX + daysAhead;
  let val = fit.icpt + fit.slope * x;
  // don't project past sensible limits: no more than 15% beyond the current best
  const pr = prOf(id).value; val = t.better === 'lower' ? Math.max(val, pr * 0.85) : Math.min(val, pr * 1.15);
  const target = doc('aos-tests').targets?.[id]?.value;
  let hitDate = null;
  if (target != null && fit.slope && ((t.better === 'lower') === (fit.slope < 0))) { const xt = (target - fit.icpt) / fit.slope; if (xt > lastX) hitDate = isoDate(new Date(t0 + xt * 864e5)); }
  return { from: rs[rs.length - 1].date, end, value: r2(val), perMonth: r2(fit.slope * 30), r: fit.r, hitDate, improving: t.better === 'lower' ? fit.slope < 0 : fit.slope > 0 };
}

// ----- basketball development data -----
const handleSessions = () => [...(doc('aos-handles').sessions || [])].sort((a, b) => a.date.localeCompare(b.date));
const finishSessions = () => [...(doc('aos-finish').sessions || [])].sort((a, b) => a.date.localeCompare(b.date));
const filmEntries = () => [...(doc('aos-film').entries || [])].sort((a, b) => a.date.localeCompare(b.date));
const FINISH_TYPES = [['layup', 'Layups'], ['reverse', 'Reverses'], ['floater', 'Floaters'], ['euro', 'Euro / pro-hop'], ['contact', 'Contact finishes'], ['scoop', 'Scoops / high glass'], ['power', 'Power finishes']];
function finishTotals(sessions) {
  const by = {}, L = { m: 0, a: 0 }, Rr = { m: 0, a: 0 };
  for (const [k] of FINISH_TYPES) by[k] = { m: 0, a: 0, L: { m: 0, a: 0 }, R: { m: 0, a: 0 } };
  for (const s of sessions) for (const [k, v] of Object.entries(s.rows || {})) {
    if (!by[k]) continue;
    for (const h of ['L', 'R']) { const x = v[h] || { m: 0, a: 0 }; by[k][h].m += x.m || 0; by[k][h].a += x.a || 0; by[k].m += x.m || 0; by[k].a += x.a || 0; (h === 'L' ? L : Rr).m += x.m || 0; (h === 'L' ? L : Rr).a += x.a || 0; }
  }
  return { by, L, R: Rr, m: L.m + Rr.m, a: L.a + Rr.a };
}
/** Hollinger Game Score; needs points and shooting. */
function gameScore(g) {
  if (g.pts == null) return null;
  const n = (k) => Number(g[k]) || 0;
  return r1(n('pts') + 0.4 * n('fgm') - 0.7 * n('fga') - 0.4 * (n('fta') - n('ftm')) + 0.7 * n('reb') * 0.3 + 0.3 * n('reb') * 0.7 + n('stl') + 0.7 * n('ast') + 0.7 * n('blk') - n('tov'));
}
const tsPct = (g) => { const d = 2 * ((Number(g.fga) || 0) + 0.44 * (Number(g.fta) || 0)); return g.pts != null && d ? g.pts / d : null; };
const efgPct = (g) => (g.fga ? ((Number(g.fgm) || 0) + 0.5 * (Number(g.tpm) || 0)) / g.fga : null);
const stdev = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(mean(a.map((v) => (v - m) ** 2))) : null; };

// ----- nutrition intelligence -----
function nutritionScore(days = 14) {
  const ds = lastNDays(days), food = ds.filter(hasFood); if (food.length < 3) return null;
  const T = (d) => targets(d), tot = (d) => totalsOf(d);
  const prot = food.filter((d) => tot(d).protein >= T(d).protein * 0.9).length / food.length;
  const kcal = food.filter((d) => Math.abs(tot(d).calories / T(d).calories - 1) <= 0.15).length / food.length;
  const water = ds.filter((d) => waterOf(d) >= T(d).waterOz * 0.9).length / ds.length;
  const logging = food.length / days;
  return { score: Math.round(prot * 40 + kcal * 30 + water * 20 + logging * 10), prot, kcal, water, logging, n: food.length };
}
const addedMin = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
const toMinT = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
/** Food around each timed workout: pre = 15 min-4 h before (150+ kcal), post = within 2.5 h after (20+ g protein). */
function fuelingOf(date) {
  const ws = exList(date).filter((x) => x.time).map((x) => ({ ...x, st: toMinT(x.time), en: toMinT(x.time) + Number(x.mins) }));
  const es = entriesOf(date).filter((e) => e.addedAt).map((e) => ({ m: addedMin(e.addedAt), kcal: (e.calories || 0) * (e.servings ?? 1), p: (e.protein || 0) * (e.servings ?? 1), name: e.name }));
  return ws.map((w) => {
    const pre = es.filter((e) => e.m >= w.st - 240 && e.m <= w.st - 15), post = es.filter((e) => e.m >= w.en - 10 && e.m <= w.en + 150);
    return { w, pre: sum(pre.map((e) => e.kcal)), preItems: pre.map((e) => e.name), postP: sum(post.map((e) => e.p)), postItems: post.map((e) => e.name), preOk: sum(pre.map((e) => e.kcal)) >= 150, postOk: sum(post.map((e) => e.p)) >= 20 };
  });
}

// ----- achievements -----
const ACHIEVEMENTS = [
  ['first-workout', 'First rep', 'Log your first workout', () => allDayKeys().some(isActive)],
  ['streak-7', 'Locked in', '7-day training streak', () => streaks().longest >= 7],
  ['streak-14', 'Relentless', '14-day training streak', () => streaks().longest >= 14],
  ['sessions-50', 'Gym rat', '50 training sessions', () => sum(allDayKeys().map((d) => exList(d).length)) >= 50],
  ['first-pr', 'New standard', 'Beat a personal record', () => allPRs().length >= 1],
  ['pr-10', 'Record breaker', '10 personal records', () => allPRs().length >= 10],
  ['shots-1000', '1,000 shots', 'Log 1,000 shots', () => sum(shotSessions().map((s) => sessionTotals(s).a)) >= 1000],
  ['shots-5000', '5,000 shots', 'Log 5,000 shots', () => sum(shotSessions().map((s) => sessionTotals(s).a)) >= 5000],
  ['sniper', 'Sniper', '50%+ from three on a 50+ attempt session', () => shotSessions().some((s) => { const t = sessionTotals(s); return t.a3 >= 50 && t.m3 / t.a3 >= 0.5; })],
  ['weak-hand', 'Off hand', '60 minutes of weak-hand handles', () => sum(handleSessions().map((s) => s.weakMins || 0)) >= 60],
  ['film-5', 'Film junkie', '5 film study sessions', () => filmEntries().length >= 5],
  ['double-double', 'Double-double', 'Log a double-double', () => games().some((g) => ['pts', 'reb', 'ast', 'stl', 'blk'].filter((k) => (g[k] || 0) >= 10).length >= 2)],
  ['goal-done', 'Goal getter', 'Complete a goal', () => goals().some((g) => goalState(g).status === 'done')],
  ['checkin-7', 'Self-aware', '7 morning check-ins', () => allDayKeys().filter((d) => dayDoc(d)?.feel).length >= 7],
  ['fuel-week', 'Fueled', 'Hit protein goal 5 days in one week', () => { for (let i = 0; i < 8; i++) { const w = weekStats(shiftIso(mondayOf(todayIso()), -7 * i)); if (w.protHit >= 5) return true; } return false; }],
  ['vert-30', '30-inch club', '30" vertical', () => (prOf('vert')?.value || 0) >= 30 || (prOf('appvert')?.value || 0) >= 30],
];
/** Records unlock dates; returns the newly unlocked ones. */
function checkAchievements() {
  const a = aos(); a.ach = a.ach || {}; const fresh = [];
  for (const [id, name, , fn] of ACHIEVEMENTS) { let ok = false; try { ok = fn(); } catch {} if (ok && !a.ach[id]) { a.ach[id] = todayIso(); fresh.push(name); } }
  if (fresh.length) persist('aos');
  return fresh;
}

// ----- goals -----
const goals = () => doc('aos-goals').goals || [];
const GOAL_SOURCES = [
  ['manual', 'I update it myself', '', 'higher'],
  ...TESTS.map((t) => ['test:' + t.id, `${t.name} (best)`, t.unit, t.better]),
  ['shoot:pct', 'Shooting % (last 30 days)', '%', 'higher'], ['shoot:3pct', '3-point % (last 30 days)', '%', 'higher'], ['shoot:ft', 'Free throw % (last 30 days)', '%', 'higher'],
  ['shoot:shots7', 'Shots per week', 'shots', 'higher'], ['game:ppg', 'Points per game (season)', 'pts', 'higher'], ['game:apg', 'Assists per game', 'ast', 'higher'], ['game:ato', 'Assist/turnover ratio', '', 'higher'],
  ['train:days7', 'Training days this week', 'days', 'higher'], ['train:hours7', 'Training hours this week', 'h', 'higher'],
  ['body:weight', 'Body weight', 'lb', 'higher'], ['sleep:avg7', 'Average sleep (7 days)', 'h', 'higher'], ['nut:protein7', 'Average protein (7 days)', 'g', 'higher'], ['film:mins30', 'Film study minutes (30 days)', 'min', 'higher'],
];
function sourceValue(src) {
  const [k, v] = src.split(':'), d30 = (s) => inRange(s.date, '30');
  if (k === 'test') return prOf(v)?.value ?? null;
  if (k === 'shoot') {
    if (v === 'shots7') return sum(shotSessions().filter((s) => inRange(s.date, '7')).map((s) => sessionTotals(s).a));
    const ss = shotSessions().filter(d30); if (v === 'ft') { const c = catAgg(ss).ftc; return c.a ? r1((c.m / c.a) * 100) : null; }
    const t = ss.map(sessionTotals), m = sum(t.map((x) => (v === '3pct' ? x.m3 : x.m))), a = sum(t.map((x) => (v === '3pct' ? x.a3 : x.a))); return a ? r1((m / a) * 100) : null;
  }
  if (k === 'game') { const g = games(); if (!g.length) return null; if (v === 'ato') { const t = sum(g.map((x) => x.tov || 0)); return t ? r2(sum(g.map((x) => x.ast || 0)) / t) : null; } return r1(mean(g.map((x) => x[v === 'ppg' ? 'pts' : 'ast'] || 0))); }
  if (k === 'train') { const w = weekStats(mondayOf(todayIso())); return v === 'days7' ? w.active : r1(w.mins / 60); }
  if (k === 'body') { const s = bodySeries('weight'); return s.length ? s[s.length - 1].v : null; }
  if (k === 'sleep') { const s = lastNDays(7).map((d) => recoveryInputs(d).sleepH).filter((x) => x != null); return s.length ? r1(mean(s)) : null; }
  if (k === 'nut') { const f = lastNDays(7).filter(hasFood); return f.length ? Math.round(mean(f.map((d) => totalsOf(d).protein))) : null; }
  if (k === 'film') return sum(filmEntries().filter(d30).map((f) => f.mins || 0));
  return null;
}
function goalCurrent(g) {
  if (g.source && g.source !== 'manual') { const v = sourceValue(g.source); if (v != null) return v; }
  const h = g.history || []; return h.length ? h[h.length - 1].v : g.start;
}
function goalState(g) {
  let cur, pct, reached;
  if (g.mode === 'ms') {
    const ms = g.milestones || [], n = ms.filter((m) => m.done).length;
    cur = n; pct = ms.length ? (n / ms.length) * 100 : 0; reached = ms.length > 0 && n === ms.length;
  } else {
    cur = goalCurrent(g); const lower = g.better === 'lower', span = g.target - g.start;
    pct = span ? clamp(((cur - g.start) / span) * 100, 0, 100) : cur === g.target ? 100 : 0;
    reached = lower ? cur <= g.target : cur >= g.target;
  }
  const total = g.created && g.date ? Math.max(1, daysBetween(isoDate(new Date(g.created)), g.date)) : null;
  const elapsed = g.created ? daysBetween(isoDate(new Date(g.created)), todayIso()) : 0;
  const expected = total ? clamp((elapsed / total) * 100, 0, 100) : null;
  const status = reached ? 'done' : g.date && g.date < todayIso() ? 'overdue' : expected == null || pct >= expected - 10 ? 'on-track' : 'behind';
  return { cur, pct: Math.round(pct), status, expected: expected == null ? null : Math.round(expected) };
}
/** Auto-sourced goals: record one snapshot per day so the history chart fills itself. */
function snapshotGoals() {
  let changed = false; const today = todayIso();
  for (const g of goals()) {
    if (!g.source || g.source === 'manual') continue;
    const v = sourceValue(g.source); if (v == null) continue;
    g.history = g.history || []; const last = g.history[g.history.length - 1];
    if (last?.date === today) { if (last.v !== v) { last.v = v; changed = true; } } else if (!last || last.v !== v) { g.history.push({ date: today, v }); changed = true; }
    for (const m of g.milestones || []) if (!m.done && m.v != null && (g.better === 'lower' ? v <= m.v : v >= m.v)) { m.done = today; changed = true; }
  }
  if (changed) persist('aos-goals');
}
