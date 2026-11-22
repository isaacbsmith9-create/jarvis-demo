// ===================== Hub 2.0 · Phase B: cross-app intelligence engine =====================
// One function, insights(), reads every app (through Ecosystem.signals and the shared docs) and returns one list.
// Every insight carries its evidence (the actual numbers and how many days), a confidence level and one action.
// Nothing is guessed: when there isn't enough data the engine says what's missing instead.
// The list is saved to doc "hub-insights" { date, items } so other pages and the morning text read the same thing.
//   item: { id, kind: alert|trend|pattern|win|unlock, lvl: act|watch|info|good, apps: [app ids], title,
//           evidence: [text], confidence: high|medium|low, action, href }
const ENG_WIN = 14, ENG_MIN = 4;
const engAvg = (xs) => (xs.length ? mean(xs) : null);
function engWindows(fn) {
  const t = todayIso(), now = lastNDays(ENG_WIN, t), prev = lastNDays(ENG_WIN, shiftIso(t, -ENG_WIN));
  const a = now.map(fn).filter((x) => x != null), b = prev.map(fn).filter((x) => x != null);
  return { a, b, na: a.length, nb: b.length, va: engAvg(a), vb: engAvg(b) };
}
const ENG_TRENDS = [
  { id: 'sleep', app: 'rl', label: 'Sleep', unit: 'h', dec: 1, min: 0.4, fn: (d) => hpSleepNight(d), up: 'good', unlock: 'Log sleep in Recovery Lens' },
  { id: 'ready', app: 'rl', label: 'Readiness', unit: '', dec: 0, min: 5, fn: (d) => hpReady(d), up: 'good', unlock: 'Do the morning check-in' },
  { id: 'protein', app: 'ml', label: 'Protein', unit: 'g', dec: 0, min: 15, fn: (d) => (hasFood(d) ? totalsOf(d).protein : null), up: 'good', unlock: 'Log meals in MacroLens' },
  { id: 'shoot', app: 'aos', label: 'Shooting %', unit: '%', dec: 1, min: 4, fn: (d) => hpShotPct(d), up: 'good', unlock: 'Log shooting sessions (20+ shots)' },
  { id: 'train', app: 'aos', label: 'Training minutes', unit: 'min/day', dec: 0, min: 15, fn: (d) => { const m = trainingOf(d).mins; return m || null; }, up: 'neutral', unlock: 'Log workouts' },
  { id: 'plan', app: 'gp', label: 'Plan kept', unit: '%', dec: 0, min: 12, fn: (d) => { const b = hubBlocks(d).filter((x) => x.type !== 'sleep'); return b.length && d < todayIso() ? (b.filter((x) => x.done).length / b.length) * 100 : null; }, up: 'good', unlock: 'Plan days in Gameplan and check off blocks' },
];
const ENG_PATTERNS = [
  { id: 'sleep-shoot', apps: ['rl', 'aos'], x: hpSleepNight, y: hpShotPct, lag: 0, xl: 'sleep', yl: 'shooting %', act: (s) => (s > 0 ? 'Protect your sleep the night before shooting work.' : null) },
  { id: 'ready-shoot', apps: ['rl', 'aos'], x: hpReady, y: hpShotPct, lag: 0, xl: 'readiness', yl: 'shooting %', act: (s) => (s > 0 ? 'Put your hardest shooting work on high-readiness days.' : null) },
  { id: 'protein-sore', apps: ['ml', 'rl'], x: (d) => (hasFood(d) ? totalsOf(d).protein : null), y: (d) => recoveryInputs(d).sore, lag: 1, xl: 'protein', yl: 'next-day soreness', act: (s) => (s < 0 ? 'Hit your protein target on hard training days.' : null) },
  { id: 'train-ready', apps: ['aos', 'rl'], x: (d) => trainingOf(d).mins || null, y: hpReady, lag: 1, xl: 'training minutes', yl: 'next-day readiness', act: (s) => (s < 0 ? 'Follow your longest sessions with an easier day.' : null) },
  { id: 'sleep-mood', apps: ['rl', 'aos'], x: hpSleepNight, y: (d) => doc('rl-check')?.days?.[d]?.mood ?? null, lag: 0, xl: 'sleep', yl: 'mood', act: (s) => (s > 0 ? 'Bedtime is a mood lever too. Keep it steady.' : null) },
];
function engInsights() {
  const t = todayIso(), out = [], add = (x) => out.push({ confidence: 'medium', apps: [], evidence: [], ...x });
  // 1. alerts: everything the Hub already flags (deadlines, pain, conflicts, load, fuel)
  for (const a of hubSafe(() => hubAttention(), []) || []) add({ id: 'alert:' + a.t, kind: 'alert', lvl: a.lvl, apps: [a.app], title: a.t, evidence: a.s ? [a.s] : [], confidence: 'high', action: a.s || '', href: a.href });
  // 2. school
  const S = doc('life-school');
  if (S) {
    for (const c of S.classes || []) { const p = hubSafe(() => classPct(c)); if (p != null && p < 80 && c.active !== false) add({ id: 'grade:' + c.id, kind: 'alert', lvl: p < 70 ? 'act' : 'watch', apps: ['school'], title: `${c.name} is at ${r1(p)}%`, evidence: [`Current grade from Student Lens: ${r1(p)}% (${c.letter || letterOf(p)})`], confidence: 'high', action: 'Open the class in Student Lens and use the grade simulator to see what you need.', href: 'student.html' }); }
    const sn = Object.entries(S.snaps || {}).sort(), last = sn[sn.length - 1], old = [...sn].reverse().find(([d]) => d <= shiftIso(t, -14));
    if (last && old && Math.abs(last[1] - old[1]) >= 0.1) add({ id: 'gpa-trend', kind: 'trend', lvl: last[1] > old[1] ? 'good' : 'watch', apps: ['school'], title: `GPA ${last[1] > old[1] ? 'up' : 'down'} ${nf(Math.abs(last[1] - old[1]), 2)} in 2 weeks`, evidence: [`${nf(old[1], 2)} on ${fmtD(old[0])} → ${nf(last[1], 2)} now`], confidence: 'high', action: last[1] > old[1] ? 'Keep the same routine.' : 'Check which class dropped in Student Lens.', href: 'student.html' });
  }
  // 3. trends: last 14 days vs the 14 before
  for (const T of ENG_TRENDS) {
    const w = hubSafe(() => engWindows(T.fn)); if (!w) continue;
    if (w.na < ENG_MIN || w.nb < ENG_MIN) { add({ id: 'unlock:' + T.id, kind: 'unlock', lvl: 'info', apps: [T.app], title: `${T.label} trend`, evidence: [w.na < ENG_MIN ? `${w.na} of ${ENG_MIN} days logged in the last 2 weeks` : `Last 2 weeks: ${w.na} days logged. The comparison starts when the 2 weeks before have ${ENG_MIN}+ days (now ${w.nb}).`], confidence: 'low', action: `${T.unlock} to unlock this.`, href: EV_APPS[T.app].href }); continue; }
    const d = w.va - w.vb; if (Math.abs(d) < T.min) continue;
    const better = T.up === 'neutral' ? null : d > 0, f = (v) => nf(v, T.dec);
    add({ id: 'trend:' + T.id, kind: 'trend', lvl: better == null ? 'info' : better ? 'good' : 'watch', apps: [T.app], title: `${T.label} ${d > 0 ? 'up' : 'down'} ${f(Math.abs(d))}${T.unit ? ' ' + T.unit : ''}`, evidence: [`Last 14 days: ${f(w.va)}${T.unit ? ' ' + T.unit : ''} average (${w.na} days)`, `14 days before: ${f(w.vb)}${T.unit ? ' ' + T.unit : ''} (${w.nb} days)`], confidence: w.na >= 10 && w.nb >= 10 ? 'high' : 'medium', action: better ? 'Whatever changed is working. Keep it.' : better === false ? `Look at what changed in the last two weeks for ${T.label.toLowerCase()}.` : 'Make sure your load matches your recovery.', href: EV_APPS[T.app].href });
  }
  // 4. patterns: two apps moving together (60 days, needs 10+ paired days and |r| >= 0.4)
  const days = lastNDays(60);
  for (const P of ENG_PATTERNS) {
    const ps = days.map((d) => [hubSafe(() => P.x(d)), hubSafe(() => P.y(P.lag ? shiftIso(d, P.lag) : d)), d]).filter((p) => p[0] != null && p[1] != null && (!P.lag || shiftIso(p[2], P.lag) <= t));
    if (ps.length < 10) continue;
    const st = pearson(ps); if (!st || Math.abs(st.r) < 0.4) continue;
    add({ id: 'pattern:' + P.id, kind: 'pattern', lvl: 'info', apps: P.apps, title: `Higher ${P.xl} goes with ${st.r > 0 ? 'higher' : 'lower'} ${P.yl}`, evidence: [`r = ${st.r >= 0 ? '+' : ''}${st.r.toFixed(2)} (${strength(st.r)}) over ${ps.length} days`, 'A pattern, not proof: other things can drive both.'], confidence: ps.length >= 20 && Math.abs(st.r) >= 0.5 ? 'high' : 'medium', action: P.act(st.r) || 'Worth watching as more days come in.', href: 'index.html' });
  }
  // 5. goals
  for (const g of goals()) { const s = goalState(g); if (s.status === 'done') add({ id: 'goal-done:' + g.id, kind: 'win', lvl: 'good', apps: ['aos'], title: `Goal reached: ${g.title}`, evidence: [`Now ${fmtGoal(g, s.cur)}, target ${fmtGoal(g, g.target)}`], confidence: 'high', action: 'Set the next target.', href: 'index.html' });
    else if (s.status === 'behind' || s.status === 'overdue') add({ id: 'goal-behind:' + g.id, kind: 'alert', lvl: 'watch', apps: ['aos'], title: `Behind on: ${g.title}`, evidence: [`${s.pct}% there with ${s.expected ?? 100}% of the time used`, `Now ${fmtGoal(g, s.cur)}, target ${fmtGoal(g, g.target)}`], confidence: 'high', action: 'Pick one session this week that moves this number.', href: 'index.html' }); }
  // 6. wins: consistency streaks
  const ck = doc('rl-check')?.days || {}; let streak = 0; for (let d = t; ck[d]; d = shiftIso(d, -1)) streak++;
  if (streak >= 5) add({ id: 'win:checkin', kind: 'win', lvl: 'good', apps: ['rl'], title: `${streak}-day check-in streak`, evidence: [`Recovery Lens check-ins every day since ${fmtD(shiftIso(t, -(streak - 1)))}`], confidence: 'high', action: 'Keep it going. Trends get sharper every day.', href: 'recovery.html' });
  const pd = lastNDays(7).filter((d) => hasFood(d) && totalsOf(d).protein >= targets(d).protein * 0.9).length;
  if (pd >= 5) add({ id: 'win:protein', kind: 'win', lvl: 'good', apps: ['ml'], title: `Protein goal hit ${pd} of 7 days`, evidence: ['From MacroLens totals vs your target'], confidence: 'high', action: 'Same plan next week.', href: 'macrolens.html' });
  const order = { act: 0, watch: 1, good: 2, info: 3 }, kOrder = { alert: 0, trend: 1, pattern: 2, win: 3, unlock: 4 };
  const seen = new Set(), list = out.filter((x) => (seen.has(x.id) ? false : seen.add(x.id))).sort((a, b) => order[a.lvl] - order[b.lvl] || kOrder[a.kind] - kOrder[b.kind]);
  hubSafe(() => { const cur = doc('hub-insights'), key = JSON.stringify(list); if (!cur || cur.date !== t || JSON.stringify(cur.items) !== key) { cache['hub-insights'] = { v: 1, date: t, at: Date.now(), items: list }; persist('hub-insights'); } });
  return list;
}
window.Ecosystem = { ...(window.Ecosystem || {}), insights: engInsights };

// ---------- shown at the top of Hub › Insights ----------
const ENG_KIND = { alert: 'Needs attention', trend: 'Trends · last 2 weeks vs 2 before', pattern: 'Patterns across apps', win: 'Wins', unlock: 'Unlock more' };
function insightCard(x) {
  const A = EV_APPS[x.apps[0]] || EV_APPS.aos;
  return `<li class="ins ${x.lvl}" style="--c:${A.color}"><div class="ins-h"><b>${esc(x.title)}</b><span class="tag ${x.confidence === 'high' ? 'hi' : x.confidence === 'medium' ? 'mid' : 'lo'}">${x.confidence}</span></div>
    ${x.evidence.length ? `<ul class="ins-ev">${x.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    <div class="ins-f"><span class="ins-apps">${x.apps.map((k) => `<i style="background:${EV_APPS[k]?.color}"></i>${esc(EV_APPS[k]?.name || k)}`).join(' ')}</span>${x.action && x.kind !== 'alert' ? `<span class="ins-a">→ ${esc(x.action)}</span>` : ''}${x.href && x.href !== 'index.html' ? `<a class="btn sm" data-hub-open="${x.href}" href="${x.href}">Open</a>` : ''}</div></li>`;
}
function insightsHtml() {
  const list = engInsights(), groups = Object.keys(ENG_KIND).map((k) => [k, list.filter((x) => x.kind === k)]).filter(([, xs]) => xs.length);
  return `<section class="card"><div class="card-head"><div><h3>What your data says</h3><span class="sub">${list.filter((x) => x.kind !== 'unlock').length} insights from ${new Set(list.flatMap((x) => x.apps)).size} apps · every one shows its numbers</span></div></div>
    ${groups.map(([k, xs]) => `<h4 class="ins-g">${ENG_KIND[k]}</h4><ul class="ins-list">${xs.map(insightCard).join('')}</ul>`).join('')}</section>`;
}
SUBS.hub = SUBS.hub.map((s) => (s[0] === 'graphs' ? ['graphs', 'Insights'] : s));
const engGraphs = HUB.graphs;
HUB.graphs = (el) => { engGraphs(el); hubSafe(() => $('.hub-head', el)?.insertAdjacentHTML('afterend', insightsHtml())); const h = $('.hub-head h1', el); if (h) h.textContent = 'Insights'; };
