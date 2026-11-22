// ===================== Hub 2.0 · Phase A: data foundation =====================
// 1. One summary format: appSignals() turns what each app publishes into the same shape, so the Hub (and the
//    intelligence engine in Phase B) reads every app one way:
//      { app, name, color, href, updated: 'YYYY-MM-DD' | null, stale: bool, metrics: [{ k, label, v, unit }], flags: [text] }
// 2. One check-in: Recovery Lens owns it. Athlete OS's check-in buttons open Recovery Lens's morning check-in.
// 3. One goals list: Athlete OS's goal roadmap (doc "aos-goals") is the shared list. It gains school, readiness and
//    fuel sources (Student Lens, Recovery Lens, MacroLens) and shows in the Hub's Goals tab. School goals are also
//    mirrored into Student Lens (src/suite/sl-bridge.js).

// ---------- 1. summaries ----------
function appSignals() {
  const t = todayIso(), wk = lastNDays(7), age = (u) => (u ? daysBetween(u, t) : null), out = [];
  const push = (app, updated, metrics, flags = []) => { const A = EV_APPS[app]; out.push({ app, name: A.name, color: A.color, href: A.href, updated: updated || null, stale: updated ? age(updated) > 3 : true, metrics: metrics.filter((m) => m.v != null), flags }); };
  const sig = doc('aos-signals'), rd = hubSafe(() => readiness(t)?.score), w = hubSafe(() => weekStats(mondayOf(t)));
  push('aos', sig?.updated, [{ k: 'readiness', label: 'Readiness', v: rd ?? null }, { k: 'trainDays', label: 'Training days this week', v: w?.active ?? null, unit: 'days' }, { k: 'trainHours', label: 'Training hours this week', v: w ? r1(w.mins / 60) : null, unit: 'h' }, { k: 'acwr', label: 'Load ratio', v: sig?.acwr ?? null }], sig?.acwr > 1.3 ? ['Training load is climbing fast'] : []);
  const RR = doc('rl-ready')?.days || {}, rdays = Object.keys(RR).sort(), N = doc('rl-sleep')?.nights || {}, sl = wk.map((d) => N[d]?.asleepH).filter((x) => x != null), ck = doc('rl-check')?.days || {};
  const pain = (doc('rl-body')?.records || []).filter((r) => r.date >= shiftIso(t, -2) && (r.kind === 'pain' || r.kind === 'injury'));
  push('rl', rdays[rdays.length - 1], [{ k: 'readiness', label: 'Readiness', v: RR[t]?.score ?? null }, { k: 'sleep7', label: 'Average sleep (7 days)', v: sl.length ? r1(mean(sl)) : null, unit: 'h' }, { k: 'checkins7', label: 'Check-ins (7 days)', v: wk.filter((d) => ck[d]).length, unit: 'days' }], pain.length ? [`Pain flagged: ${[...new Set(pain.map((r) => r.area))].join(', ')}`] : []);
  const gp = doc('gp-sig'), bl = hubBlocks(t).filter((b) => b.type !== 'sleep');
  push('gp', gp?.updated, [{ k: 'blocksToday', label: 'Blocks planned today', v: bl.length }, { k: 'openTasks', label: 'Open tasks', v: gp?.openTasks ?? (doc('gp-core')?.tasks || []).filter((x) => !x.done).length }, { k: 'bed', label: 'Bedtime', v: doc('gp-core')?.routine?.bed || gp?.bed || null }]);
  const S = doc('life-school');
  push('school', S?.updated, S ? [{ k: 'gpa', label: 'GPA', v: S.gpa?.unweighted ?? hubSafe(() => gpa()) }, { k: 'due7', label: 'Due in 7 days', v: scDue(t, shiftIso(t, 6)).length }, { k: 'overdue', label: 'Overdue', v: scOverdue().length }] : [], S ? scOverdue().filter((x) => scClass(x.cls)?.latePolicy === 'none').map((x) => `${x.title} is overdue and late work isn't accepted`) : []);
  const bs = doc('btc-sig');
  push('btc', bs?.updated, [{ k: 'sessions', label: 'Sessions this week', v: bs?.sessionsDone ?? null }, { k: 'mins7', label: 'Drill minutes (7 days)', v: bs?.minsByArea7d ? sum(Object.values(bs.minsByArea7d)) : null, unit: 'min' }]);
  const fed = wk.filter(hasFood), last = [...fed].pop();
  push('ml', last, [{ k: 'protein7', label: 'Average protein (7 days)', v: fed.length ? Math.round(mean(fed.map((d) => totalsOf(d).protein))) : null, unit: 'g' }, { k: 'proteinDays7', label: 'Protein goal days (7 days)', v: fed.filter((d) => totalsOf(d).protein >= targets(d).protein * 0.9).length, unit: 'days' }, { k: 'logged7', label: 'Days logged (7 days)', v: fed.length, unit: 'days' }]);
  return out;
}
window.Ecosystem = { ...(window.Ecosystem || {}), signals: appSignals };

// ---------- 2. one check-in (Recovery Lens) ----------
ACTIONS.checkin = () => goTo('recovery.html#morning');

// ---------- 3. one goals list ----------
GOAL_SOURCES.push(['school:gpa', 'GPA (Student Lens)', '', 'higher'], ['school:wgpa', 'Weighted GPA (Student Lens)', '', 'higher'], ['rl:ready7', 'Average readiness (7 days, Recovery Lens)', '', 'higher'], ['nut:pdays7', 'Days protein goal hit (7 days, MacroLens)', 'days', 'higher']);
function syncClassSources() {
  for (let i = GOAL_SOURCES.length - 1; i >= 0; i--) if (GOAL_SOURCES[i][0].startsWith('school:cls:')) GOAL_SOURCES.splice(i, 1);
  for (const c of doc('life-school')?.classes || []) GOAL_SOURCES.push(['school:cls:' + c.id, `${c.name} grade (Student Lens)`, '%', 'higher']);
}
const _srcVal = sourceValue;
sourceValue = function (src) {
  if (src.startsWith('school:')) {
    const S = doc('life-school'); if (!S) return null;
    if (src === 'school:gpa') return S.gpa?.unweighted ?? hubSafe(() => gpa());
    if (src === 'school:wgpa') return S.gpa?.weighted ?? null;
    if (src.startsWith('school:cls:')) { const c = (S.classes || []).find((x) => x.id === src.slice(11)); return c ? hubSafe(() => classPct(c)) : null; }
    return null;
  }
  if (src === 'rl:ready7') { const R = doc('rl-ready')?.days || {}, v = lastNDays(7).map((d) => R[d]?.score).filter((x) => x != null); return v.length ? Math.round(mean(v)) : null; }
  if (src === 'nut:pdays7') return lastNDays(7).filter((d) => hasFood(d) && totalsOf(d).protein >= targets(d).protein * 0.9).length;
  return _srcVal(src);
};
const _goalAct = ACTIONS.goal;
ACTIONS.goal = (b) => { syncClassSources(); return _goalAct(b); };
const GOAL_APP = (g) => (!g.source || g.source === 'manual' || g.mode === 'ms' ? null : g.source.startsWith('school:') ? 'school' : g.source.startsWith('rl:') || g.source.startsWith('sleep:') ? 'rl' : g.source.startsWith('nut:') ? 'ml' : 'aos');

SUBS.hub.splice(SUBS.hub.findIndex((s) => s[0] === 'timeline'), 0, ['goals', 'Goals']);
HUB.goals = (el) => {
  syncClassSources(); hubSafe(() => snapshotGoals());
  const all = goals().map((g) => ({ g, s: goalState(g) })), active = all.filter((x) => x.s.status !== 'done');
  const card = ({ g, s }) => { const c = gcat(g.cat), app = GOAL_APP(g), lbl = STATUS_TXT[s.status];
    return `<li class="hg" style="--c:${c[2]}"><div class="hg-h"><span class="hg-cat">${esc(c[1])}</span>${app ? `<span class="hg-app" style="--a:${EV_APPS[app].color}">${esc(EV_APPS[app].name)}</span>` : '<span class="hg-app">You update it</span>'}<span class="tag ${lbl[0]}">${lbl[1]}</span></div>
      <b class="hg-t">${esc(g.title)}</b><div class="hg-n"><span><b>${fmtGoal(g, s.cur)}</b> now</span><span>target <b>${fmtGoal(g, g.mode === 'ms' ? (g.milestones || []).length : g.target)}</b>${g.date ? ` · by ${fmtD(g.date)}` : ''}</span></div>
      <div class="hub-app-bar"><i style="width:${s.pct}%"></i></div>
      <div class="row" style="justify-content:space-between;margin-top:6px"><span class="tiny muted">${s.pct}% there${s.expected != null && s.status !== 'done' ? ` · ${s.expected}% of the time used` : ''}</span><button type="button" class="btn sm" data-act="goal" data-id="${g.id}">Edit</button></div></li>`; };
  el.innerHTML = `<section class="hub-head"><h1>Goals</h1><p class="hub-sum">One list for basketball, body, school, recovery and fuel. Progress fills in from the app that tracks it.</p><div style="margin-top:10px"><button type="button" class="btn primary" data-act="goal">＋ Add goal</button></div></section>
    ${all.length ? `${active.length ? `<ul class="hg-list">${active.map(card).join('')}</ul>` : ''}${all.length > active.length ? `<h3 style="margin:16px 0 8px">Achieved</h3><ul class="hg-list">${all.filter((x) => x.s.status === 'done').map(card).join('')}</ul>` : ''}`
      : `<section class="card">${emptyState('No goals yet', 'Add one when you’re ready. Link it to GPA, a class grade, a test like your vertical, shooting %, readiness, sleep or protein and it tracks itself.', 'trophy', '<button type="button" class="btn sm primary" data-act="goal">＋ Add goal</button>')}</section>`}`;
};
