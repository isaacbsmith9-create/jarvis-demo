// ===================== ANALYTICS (Edition 2): overview, nutrition intelligence, reports =====================
function strengthsWeaknesses(r = skillRatings()) {
  const xs = SKILLS.filter(([k]) => r[k]).map(([k, l]) => ({ k, l, v: r[k].v, basis: r[k].basis })).sort((a, b) => b.v - a.v);
  return { top: xs.slice(0, Math.min(3, Math.ceil(xs.length / 2))), low: xs.length >= 2 ? xs.slice(-Math.min(3, Math.floor(xs.length / 2))).reverse() : [], all: xs, missing: SKILLS.filter(([k]) => !r[k]).map(([, l]) => l) };
}
function efficiencyStats() {
  const out = [];
  const ss = shotSessions().map((s) => ({ s, t: sessionTotals(s) })).filter((x) => x.t.a >= 10);
  if (ss.length >= 4) {
    const k = Math.max(2, Math.floor(ss.length / 3)), a = ss.slice(0, k), b = ss.slice(-k), pa = sum(a.map((x) => x.t.m)) / sum(a.map((x) => x.t.a)), pb = sum(b.map((x) => x.t.m)) / sum(b.map((x) => x.t.a));
    const shots = sum(ss.map((x) => x.t.a));
    out.push(['Shooting', `${pb - pa >= 0 ? '+' : ''}${r1((pb - pa) * 100)} pts`, `from your first ${k} sessions to your last ${k} · ${r1(((pb - pa) * 100 * 1000) / shots)} pts per 1,000 shots`]);
  }
  const v = resultsOf('vert'); if (v.length >= 2) { const hrs = sum(allDayKeys().filter((d) => d >= v[0].date && d <= v[v.length - 1].date).map((d) => exList(d).filter((x) => ['lift', 'speed'].includes(x.type)).reduce((a, x) => a + Number(x.mins), 0))) / 60; out.push(['Vertical', `${r1(v[v.length - 1].value - v[0].value) >= 0 ? '+' : ''}${r1(v[v.length - 1].value - v[0].value)}"`, hrs ? `${r1(hrs)} h of strength/speed work in between · ${r2((v[v.length - 1].value - v[0].value) / (hrs / 10))}" per 10 h` : 'no strength or speed sessions logged between tests']); }
  const fs = finishSessions(); if (fs.length >= 4) { const k = Math.floor(fs.length / 2), a = finishTotals(fs.slice(0, k)), b = finishTotals(fs.slice(k)); out.push(['Finishing', `${(b.m / b.a - a.m / a.a) >= 0 ? '+' : ''}${r1((b.m / b.a - a.m / a.a) * 100)} pts`, 'first half of sessions vs second half']); }
  return out;
}
function benchmarks() {
  const out = [], all = shotSessions().map(sessionTotals), recent = shotSessions().filter((s) => inRange(s.date, '30')).map(sessionTotals);
  const pct = (xs) => (sum(xs.map((x) => x.a)) ? sum(xs.map((x) => x.m)) / sum(xs.map((x) => x.a)) : null);
  if (pct(recent) != null && pct(all) != null) out.push(['Shooting % (30 days vs all-time)', pctTxt(pct(recent)), pctTxt(pct(all)), (pct(recent) - pct(all)) * 100, ' pts']);
  const wk = (i) => sum(lastNDays(7, shiftIso(todayIso(), -7 * i)).map((d) => trainingOf(d).mins)) / 60;
  const avg8 = mean([1, 2, 3, 4, 5, 6, 7, 8].map(wk));
  if (avg8 > 0) out.push(['Training hours (last 7 days vs 8-week avg)', r1(wk(0)) + ' h', r1(avg8) + ' h', pctChange(wk(0), avg8), '%']);
  const gs = games().map(gameScore).filter((x) => x != null);
  if (gs.length >= 4) out.push(['Game Score (last 3 vs season)', r1(mean(gs.slice(-3))), r1(mean(gs)), pctChange(mean(gs.slice(-3)), mean(gs)), '%']);
  const rd = lastNDays(7).map((d) => readiness(d)?.score).filter((x) => x != null), rd30 = lastNDays(30).map((d) => readiness(d)?.score).filter((x) => x != null);
  if (rd.length && rd30.length > rd.length) out.push(['Readiness (7 days vs 30 days)', Math.round(mean(rd)), Math.round(mean(rd30)), pctChange(mean(rd), mean(rd30)), '%']);
  const pr = allTests().map((t) => { const p = prOf(t.id), rs = resultsOf(t.id); return p && rs.length >= 2 ? [t, rs[rs.length - 1], p] : null; }).filter(Boolean);
  for (const [t, last, p] of pr.slice(0, 4)) out.push([`${t.name} (latest vs PR)`, fmtVal(t, last.value), fmtVal(t, p.value), improvePct(t, p.value, last.value), '%']);
  return out;
}
ANALYTICS.overview = (el) => {
  const r = skillRatings(), past = skillRatings(shiftIso(todayIso(), -30)), ds = devScore(), hist = devHistory(12), sw = strengthsWeaknesses(r);
  const consTrain = Math.round((lastNDays(30).filter(isActive).length / Math.min(30, ((Number(aos().profile?.weeklyDays) || 5) * 30) / 7)) * 100);
  const ns = nutritionScore(), shotSd = stdev(shotSessions().filter((s) => inRange(s.date, '60')).map(sessionTotals).filter((t) => t.a >= 10).map((t) => t.pct * 100));
  const preds = allTests().map((t) => ({ t, p: projectTest(t.id) })).filter((x) => x.p);
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Athlete development score</h3><span class="sub">Skill ratings (70%) + training consistency (15%) + 30-day momentum (15%) · updates as you log</span></div><button type="button" class="btn sm" data-go="profile">Profile</button></div>
    ${ds ? `<div class="grid two" style="align-items:center"><div class="row" style="gap:18px;flex-wrap:nowrap;justify-content:center">${ring(ds.score, 100, { size: 150, stroke: 13, color: 'var(--accent)', color2: 'var(--purple)', center: `<b style="font-size:40px">${ds.score}</b><span class="tiny muted">of 100</span>` })}
      <div class="stack" style="gap:6px"><span class="small">Skill average <b>${ds.skill}</b></span><span class="small">Consistency <b>${ds.cons}</b></span><span class="small">Momentum <b>${ds.mom}</b> ${ds.mom > 55 ? '<span class="up">▲</span>' : ds.mom < 45 ? '<span class="down">▼</span>' : ''}</span><span class="tiny muted">${ds.n} of ${SKILLS.length} skills rated</span></div></div>
      <div>${hist.length >= 2 ? '<div class="chart" id="dev-hist"></div>' : '<p class="notice">Your score history builds week by week.</p>'}</div></div>`
    : emptyState('Not enough data for a score yet', `The score needs at least two skill ratings. Log tests (vertical, sprints, lifts), shooting, finishing, handles, film or games. Rated so far: ${Object.keys(r).length}.`, 'chart', '<div class="row" style="justify-content:center"><button type="button" class="btn sm primary" data-act="add-test">＋ Test</button><button type="button" class="btn sm" data-go="hoops-court">Shooting</button></div>')}
  </section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Performance radar</h3><span class="sub">Solid = now · dashed = 30 days ago</span></div></div>${radar(SKILLS.map(([k, l]) => ({ label: l.replace('Basketball ', ''), v: r[k]?.v ?? null, v2: past[k]?.v ?? r[k]?.v ?? null })), { compare: true, label: 'Skill ratings radar' })}
      <p class="muted tiny">Ratings compare your numbers with general high-school guard reference points. They're a guide, not official norms. Skills with no data show —.</p></section>
    <section class="card"><div class="card-head"><div><h3>Strengths and weaknesses</h3><span class="sub">From your ratings</span></div></div>
      ${sw.all.length ? `<h4 class="up" style="margin-bottom:6px">Strengths</h4><div class="list">${sw.top.map((x) => `<div class="li"><div><div class="t">${esc(x.l)}</div><div class="s">${esc(x.basis)}</div></div><span class="v">${x.v}</span></div>`).join('')}</div>
        ${sw.low.length ? `<h4 class="down" style="margin:12px 0 6px">Work on</h4><div class="list">${sw.low.map((x) => `<div class="li"><div><div class="t">${esc(x.l)}</div><div class="s">${esc(x.basis)}</div></div><span class="v">${x.v}</span></div>`).join('')}</div>` : ''}
        ${sw.missing.length ? `<p class="muted tiny" style="margin-top:8px">Not rated yet (no data): ${sw.missing.join(', ')}</p>` : ''}` : emptyState('No ratings yet', 'Strengths and weaknesses appear once skills have data.', 'trophy')}</section>
  </div>
  <section class="card"><div class="card-head"><div><h3>Skill ratings</h3><span class="sub">What each rating is based on</span></div></div><div class="list">${SKILLS.map(([k, l]) => `<div class="li"><div style="min-width:0;flex:1"><div class="row-between"><span class="t">${l}</span><span class="v">${r[k]?.v ?? '—'} ${r[k] && past[k] ? deltaPill(r[k].v - past[k].v, false, '') : ''}</span></div><div class="s">${r[k] ? esc(r[k].basis) : 'No data yet'}</div>${r[k] ? hbar(r[k].v) : ''}</div></div>`).join('')}</div></section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Consistency scores</h3></div></div><div class="kpis">
      <div class="kpi"><small>Training</small><b>${clamp(consTrain, 0, 100)}</b><span class="tiny muted">active days vs your weekly target (30 d)</span></div>
      <div class="kpi"><small>Nutrition</small><b>${ns?.score ?? '—'}</b><span class="tiny muted">${ns ? 'protein, calories, water, logging' : 'log 3+ days of food'}</span></div>
      <div class="kpi"><small>Shooting</small><b>${shotSd == null ? '—' : Math.round(clamp(100 - shotSd * 5, 0, 100))}</b><span class="tiny muted">${shotSd == null ? 'needs 2+ sessions' : `±${r1(shotSd)} pts session to session`}</span></div>
      <div class="kpi"><small>Check-ins</small><b>${Math.round((lastNDays(30).filter((d) => dayDoc(d)?.feel).length / 30) * 100)}</b><span class="tiny muted">% of last 30 days</span></div></div></section>
    <section class="card"><div class="card-head"><div><h3>Training efficiency</h3><span class="sub">Improvement relative to the work</span></div></div>${(() => { const e = efficiencyStats(); return e.length ? `<div class="list">${e.map(([a, b, c]) => `<div class="li"><div><div class="t">${a}</div><div class="s">${esc(c)}</div></div><span class="v">${esc(b)}</span></div>`).join('')}</div>` : '<p class="muted small">Needs repeat tests or 4+ shooting/finishing sessions.</p>'; })()}</section>
  </div>
  <section class="card"><div class="card-head"><div><h3>Personal benchmarks</h3><span class="sub">You vs your own averages and bests</span></div></div>${(() => { const b = benchmarks(); return b.length ? `<div class="cmp"><span class="h">Metric</span><span class="h">Now</span><span class="h">Benchmark</span><span class="h">Δ</span>${b.map(([l, a, c, d, u]) => `<span>${esc(l)}</span><b>${esc(a)}</b><span class="muted">${esc(c)}</span>${deltaPill(d, false, u === ' pts' ? ' pts' : '%')}`).join('')}</div>` : '<p class="muted small">Benchmarks appear as you build history.</p>'; })()}</section>
  <section class="card"><div class="card-head"><div><h3>Trend predictions</h3><span class="sub">Straight-line projection 90 days out from tests with 3+ results</span></div></div>${preds.length ? `<div class="list">${preds.map(({ t, p }) => `<button type="button" class="li li-btn" data-test="${t.id}" data-go="train-tests"><div><div class="t">${esc(t.name)}</div><div class="s">${p.improving ? 'Improving' : 'Flat or slipping'} · ${esc(fmtVal(t, Math.abs(p.perMonth)))}/month${p.hitDate ? ` · target around ${esc(fmtD(p.hitDate))}` : ''}</div></div><span class="v">${esc(fmtVal(t, p.value))}</span></button>`).join('')}</div><p class="muted tiny" style="margin-top:6px">Progress usually slows as you get better, so treat these as optimistic.</p>` : '<p class="muted small">Log the same test 3+ times to see where your trend is heading.</p>'}</section>`;
  if (hist.length >= 2) drawLine($('#dev-hist'), hist, { fmt: (v) => 'Score ' + v, h: 150, label: 'Development score history' });
};

// ----- nutrition intelligence additions -----
const _nut = ANALYTICS.nutrition;
ANALYTICS.nutrition = (el) => {
  _nut(el);
  const ns = nutritionScore(), days = lastNDays(14), fuel = days.flatMap((d) => fuelingOf(d).map((f) => ({ d, ...f })));
  const wt = bodySeries('weight'), q = ui('mq', '');
  const meals = allDayKeys().filter(hasFood).reverse().slice(0, 60).map((d) => ({ d, items: MEALS.flatMap(([k, l]) => (dayDoc(d)[k] || []).map((e) => ({ meal: l, e }))) })).map((x) => ({ ...x, items: x.items.filter((i) => !q || i.e.name?.toLowerCase().includes(q.toLowerCase())) })).filter((x) => x.items.length);
  el.insertAdjacentHTML('afterbegin', `<section class="card"><div class="card-head"><div><h3>Nutrition consistency score</h3><span class="sub">Last 14 days · protein 40% · calories in range 30% · water 20% · logging 10%</span></div>${mlLink('', 'Log food ›', 'btn sm primary')}</div>
    ${ns ? `<div class="row" style="gap:16px;flex-wrap:nowrap">${ring(ns.score, 100, { size: 110, stroke: 10, color: 'var(--good)', color2: 'var(--accent)', center: `<b style="font-size:28px">${ns.score}</b>` })}<div class="stack" style="flex:1;gap:8px">${[['Protein goal days', ns.prot, 'var(--protein)'], ['Calories in range', ns.kcal, 'var(--accent)'], ['Water goal days', ns.water, 'var(--water)'], ['Days logged', ns.logging, 'var(--purple)']].map(([l, v, c]) => `<div><div class="row-between small"><span>${l}</span><b>${pctTxt(v)}</b></div>${hbar(v * 100, c)}</div>`).join('')}</div></div>` : '<p class="muted small">Log food on 3+ of the last 14 days to get a score.</p>'}</section>`);
  el.insertAdjacentHTML('beforeend', `<section class="card"><div class="card-head"><div><h3>Pre- and post-workout fueling</h3><span class="sub">Workouts with a start time · last 14 days</span></div></div>
    ${fuel.length ? `<div class="kpis"><div class="kpi"><small>Fueled before</small><b>${pctTxt(fuel.filter((f) => f.preOk).length / fuel.length)}</b><span class="tiny muted">150+ kcal, 15 min-4 h before</span></div><div class="kpi"><small>Refueled after</small><b>${pctTxt(fuel.filter((f) => f.postOk).length / fuel.length)}</b><span class="tiny muted">20+ g protein within 2.5 h</span></div></div>
      <div class="list" style="margin-top:10px">${fuel.reverse().slice(0, 10).map((f) => `<div class="li"><div><div class="t">${esc(fmtD(f.d))} · ${esc(f.w.name || 'Workout')} ${fmtClock(f.w.time)}</div><div class="s">Before: ${f.preItems.length ? esc(f.preItems.join(', ')) : 'nothing logged'} · After: ${f.postItems.length ? esc(f.postItems.join(', ')) : 'nothing logged'}</div></div><span class="row" style="gap:4px"><span class="band ${f.preOk ? 'hi' : 'lo'}">Pre</span><span class="band ${f.postOk ? 'hi' : 'lo'}">Post</span></span></div>`).join('')}</div>`
    : emptyState('No timed workouts', 'Add a start time when you log workouts. Athlete OS then checks what you ate before and after from your MacroLens log.', 'fork')}</section>
    <section class="card"><div class="card-head"><div><h3>Body weight</h3><span class="sub">Shared with MacroLens</span></div><button type="button" class="btn sm" data-act="body-entry">＋ Weigh-in</button></div>${wt.length >= 2 ? '<div class="chart" id="nut-wt"></div>' : '<p class="muted small">Two weigh-ins start the graph.</p>'}</section>
    <section class="card"><div class="card-head"><div><h3>Meal history</h3><span class="sub">Every meal from MacroLens</span></div></div><input id="mq" placeholder="Search foods: chicken, smoothie…" value="${esc(q)}" style="margin-bottom:10px">
      ${meals.length ? meals.slice(0, 20).map(({ d, items }) => `<details class="li" style="display:block"><summary class="row-between" style="cursor:pointer"><span class="t">${esc(fmtDL(d))}</span><span class="tiny muted">${totalsOf(d).calories.toLocaleString()} kcal · ${Math.round(totalsOf(d).protein)} g protein</span></summary><div class="list">${items.map(({ meal, e }) => `<div class="li"><span class="small">${esc(e.name)} <span class="muted tiny">${meal}${e.addedAt ? ' · ' + new Date(e.addedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span></span><span class="tiny muted num">${Math.round((e.calories || 0) * (e.servings ?? 1))} kcal</span></div>`).join('')}</div></details>`).join('') : '<p class="muted small">No meals match.</p>'}</section>`);
  if (wt.length >= 2) drawLine($('#nut-wt'), wt.slice(-60), { fmt: (v) => v + ' lb', color: 'var(--carbs)', h: 160 });
  $('#mq').addEventListener('input', (e) => { setUi('mq', e.target.value); clearTimeout(ANALYTICS.t); ANALYTICS.t = setTimeout(() => { refresh(); const i = $('#mq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); });
};

// ----- reports -----
const REPORTS = [['weekly', 'Weekly performance'], ['monthly', 'Monthly development'], ['skills', 'Basketball skills'], ['testing', 'Athletic testing'], ['consistency', 'Training consistency'], ['recovery', 'Recovery'], ['nutrition', 'Nutrition'], ['sw', 'Strengths & weaknesses']];
function reportData(type) {
  const today = todayIso(), name = aos().profile?.name || 'Athlete', S = [];
  const range = type === 'weekly' ? [mondayOf(today), today] : type === 'monthly' ? [shiftIso(today, -29), today] : [shiftIso(today, -89), today];
  const days = lastNDays(daysBetween(range[0], range[1]) + 1, range[1]);
  const tr = days.map(trainingOf), mins = sum(tr.map((x) => x.mins)), sess = sum(tr.map((x) => x.sessions)), act = days.filter(isActive).length;
  const shots = shotSessions().filter((s) => s.date >= range[0]).map(sessionTotals), sm = sum(shots.map((s) => s.m)), sa = sum(shots.map((s) => s.a));
  const prs = allPRs().filter((p) => p.r.date >= range[0]);
  if (['weekly', 'monthly'].includes(type)) {
    S.push({ h: 'Training', kpis: [['Sessions', sess], ['Hours', r1(mins / 60)], ['Active days', `${act}/${days.length}`], ['Avg load/day', Math.round(sum(days.map(loadOf)) / days.length)]], chart: { kind: 'bars', groups: days.map((d) => { const t = trainingOf(d); return { label: type === 'weekly' ? DOW[parseIso(d).getDay()].slice(0, 2) : String(parseIso(d).getDate()), full: fmtDL(d), segs: CATS.map(([k, , c]) => ({ v: t.by[k], color: c })), tip: t.mins ? fmtDur(t.mins) : 'rest' }; }) } });
    S.push({ h: 'Basketball', kpis: [['Shots', sa || '—'], ['Shooting %', sa ? pctTxt(sm / sa) : '—'], ['Games', games().filter((g) => g.date >= range[0]).length], ['Film min', sum(filmEntries().filter((f) => f.date >= range[0]).map((f) => f.mins || 0))]] });
    S.push({ h: 'Personal records', bullets: prs.length ? prs.map((p) => `${p.t.name}: ${fmtVal(p.t, p.r.value)} (was ${fmtVal(p.t, p.prev)}) on ${fmtD(p.r.date)}`) : ['No new PRs in this period.'] });
  }
  if (['weekly', 'monthly', 'recovery'].includes(type)) {
    const rs = days.map((d) => readiness(d)?.score).filter((x) => x != null), sl = days.map((d) => recoveryInputs(d).sleepH).filter((x) => x != null), so = days.map((d) => recoveryInputs(d).sore).filter((x) => x != null), ls = loadStats(range[1]);
    S.push({ h: 'Recovery', kpis: [['Avg readiness', rs.length ? Math.round(mean(rs)) : '—'], ['Avg sleep', sl.length ? r1(mean(sl)) + ' h' : '—'], ['Avg soreness', so.length ? r1(mean(so)) + '/5' : '—'], ['ACWR', ls.acwr ?? '—']], chart: rs.length >= 2 ? { kind: 'line', pts: seriesOf((d) => readiness(d)?.score ?? null, days), fmt: (v) => Math.round(v) + '', opts: { yMin: 0, yMax: 100, bands: [[70, 100, 'var(--good)'], [45, 70, 'var(--warn)'], [0, 45, 'var(--danger)']] } } : null, bullets: restAdvice().map((x) => x[1]) });
  }
  if (['weekly', 'monthly', 'nutrition'].includes(type)) {
    const food = days.filter(hasFood), ns = nutritionScore(Math.min(30, days.length));
    S.push({ h: 'Nutrition', kpis: [['Days logged', `${food.length}/${days.length}`], ['Avg kcal', food.length ? Math.round(mean(food.map((d) => totalsOf(d).calories))).toLocaleString() : '—'], ['Avg protein', food.length ? Math.round(mean(food.map((d) => totalsOf(d).protein))) + ' g' : '—'], ['Consistency', ns?.score ?? '—']], chart: food.length >= 2 ? { kind: 'line', pts: food.map((d) => ({ date: d, v: totalsOf(d).protein, tip: `${Math.round(totalsOf(d).protein)} g of ${targets(d).protein}` })), fmt: (v) => Math.round(v) + ' g protein', opts: { goal: Math.round(mean(food.map((d) => targets(d).protein))), color: 'var(--protein)' } } : null });
  }
  if (type === 'skills') {
    const r = skillRatings(), ss = shotSessions().filter((s) => inRange(s.date, '90')), c = catAgg(ss), ft = finishTotals(finishSessions().filter((s) => inRange(s.date, '90'))), hs = handleSessions().filter((s) => inRange(s.date, '90'));
    S.push({ h: 'Skill ratings', radar: SKILLS.map(([k, l]) => ({ label: l.replace('Basketball ', ''), v: r[k]?.v ?? null })), bullets: SKILLS.filter(([k]) => r[k]).map(([k, l]) => `${l} ${r[k].v}: ${r[k].basis}`) });
    S.push({ h: 'Shooting (90 days)', kpis: SHOT_CATS.filter(([k]) => c[k].a).slice(0, 4).map(([k, l]) => [l, `${pctTxt(c[k].m / c[k].a)} (${c[k].a})`]) });
    S.push({ h: 'Finishing and handles (90 days)', kpis: [['Finishing', ft.a ? pctTxt(ft.m / ft.a) : '—'], ['Weak-hand finishing', ft.L.a ? pctTxt(ft.L.m / ft.L.a) : '—'], ['Handles sessions', hs.length], ['Weak-hand share', sum(hs.map((s) => s.mins)) ? Math.round((sum(hs.map((s) => s.weakMins || 0)) / sum(hs.map((s) => s.mins))) * 100) + '%' : '—']] });
  }
  if (type === 'testing') {
    const ts = allTests().filter((t) => resultsOf(t.id).length);
    S.push({ h: 'Results', table: ts.map((t) => { const rs = resultsOf(t.id), p = prOf(t.id); return [t.name, fmtVal(t, p.value), fmtVal(t, rs[0].value), rs.length >= 2 ? `${r1(improvePct(t, rs[0].value, p.value))}%` : '—']; }), cols: ['Test', 'PR', 'First', 'Gain'] });
    const pj = ts.map((t) => ({ t, p: projectTest(t.id) })).filter((x) => x.p); if (pj.length) S.push({ h: 'Projections (90 days)', bullets: pj.map(({ t, p }) => `${t.name}: about ${fmtVal(t, p.value)} by ${fmtD(p.end)} if the trend holds`) });
  }
  if (type === 'consistency') {
    const st = streaks(), wk = []; for (let i = 11; i >= 0; i--) { const m = shiftIso(mondayOf(today), -7 * i); wk.push({ label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: [{ v: lastNDays(7, shiftIso(m, 6)).filter((d) => d <= today && isActive(d)).length, color: 'var(--accent)' }], tip: '' }); wk[wk.length - 1].tip = `${wk[wk.length - 1].segs[0].v} active days`; }
    S.push({ h: 'Consistency', kpis: [['Current streak', st.current], ['Longest streak', st.longest], ['Active days (90 d)', days.filter(isActive).length], ['Weekly target', (Number(aos().profile?.weeklyDays) || 5) + ' days']], chart: { kind: 'bars', groups: wk, opts: { goal: Number(aos().profile?.weeklyDays) || 5 } }, heat: true });
    const b = balance(); S.push({ h: 'Training balance (28 days)', bullets: CATS.map(([k, l]) => `${l}: ${Math.round(b.share[k] * 100)}% (suggested ~${Math.round(BALANCE_TARGET[k] * 100)}%)`) });
  }
  if (type === 'sw') {
    const sw = strengthsWeaknesses(), pr = priorities().slice(0, 4);
    S.push({ h: 'Strengths', bullets: sw.top.length ? sw.top.map((x) => `${x.l} (${x.v}): ${x.basis}`) : ['Not enough data yet.'] });
    S.push({ h: 'Weaknesses', bullets: sw.low.length ? sw.low.map((x) => `${x.l} (${x.v}): ${x.basis}`) : ['Not enough data yet.'] });
    S.push({ h: 'Priority order', bullets: pr.map((p, i) => `${i + 1}. ${p.l}: ${p.why}`) });
    if (sw.missing.length) S.push({ h: 'Unrated (no data)', bullets: [sw.missing.join(', ')] });
  }
  return { title: REPORTS.find((x) => x[0] === type)[1] + ' report', name, range, S };
}
ANALYTICS.reports = (el) => {
  const type = ui('rep', 'weekly'), R = reportData(type), ai = (doc('aos-coach').reports || []).find((x) => x.mon === mondayOf(todayIso()));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Performance reports</h3><span class="sub">Built from your logs · copy the summary to share with a coach or parent</span></div><button type="button" class="btn sm" data-act="copy-report">Copy summary</button></div><div class="chips">${REPORTS.map(([k, l]) => `<button type="button" class="chip ${k === type ? 'on' : ''}" data-rep="${k}">${l}</button>`).join('')}</div></section>
  <article class="card report"><header class="report-head"><div><p class="tiny muted" style="text-transform:uppercase;letter-spacing:.1em">Athlete OS · ${esc(R.title)}</p><h2>${esc(R.name)}</h2><p class="small muted">${esc(fmtDL(R.range[0]))} – ${esc(fmtDL(R.range[1]))}</p></div>${(() => { const d = devScore(); return d ? ring(d.score, 100, { size: 84, stroke: 8, color: 'var(--accent)', color2: 'var(--purple)', center: `<b>${d.score}</b>`, label: 'Dev score' }) : ''; })()}</header>
    ${R.S.map((s, i) => `<section class="report-sec"><h3>${esc(s.h)}</h3>${s.kpis ? `<div class="kpis four">${s.kpis.map(([l, v]) => `<div class="kpi"><small>${esc(l)}</small><b style="font-size:20px">${esc(v)}</b></div>`).join('')}</div>` : ''}${s.chart ? `<div class="chart" id="rc${i}" style="margin-top:10px"></div>` : ''}${s.radar ? radar(s.radar, { size: 260 }) : ''}${s.heat ? heatmap(12, activityLevel) : ''}${s.table ? `<div class="cmp" style="grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,1fr))">${s.cols.map((c) => `<span class="h">${c}</span>`).join('')}${s.table.map((row) => row.map((c, j) => (j ? `<b>${esc(c)}</b>` : `<span>${esc(c)}</span>`)).join('')).join('')}</div>` : ''}${s.bullets ? `<ul class="small" style="margin:8px 0 0;padding-left:18px;display:grid;gap:4px">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</section>`).join('')}
    ${type === 'weekly' && ai ? `<section class="report-sec"><h3>Coach's evaluation <span class="ai-badge">AI</span></h3>${reportHtml(ai)}</section>` : type === 'weekly' ? `<p class="muted small" style="margin-top:12px">Add an AI write-up in Coach → Weekly evaluation.</p>` : ''}
  </article>`;
  R.S.forEach((s, i) => { if (!s.chart) return; const c = $('#rc' + i); if (s.chart.kind === 'bars') drawBars(c, s.chart.groups, { h: 160, fmt: (v) => fmtDur(v), ...(s.chart.opts || {}) }); else if (s.chart.pts.length) drawLine(c, s.chart.pts, { fmt: s.chart.fmt, h: 160, ...(s.chart.opts || {}) }); });
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-rep]'); if (b) { setUi('rep', b.dataset.rep); refresh(); } });
ACTIONS['copy-report'] = () => {
  const R = reportData(ui('rep', 'weekly'));
  const txt = [`${R.title}: ${R.name}`, `${fmtDL(R.range[0])} – ${fmtDL(R.range[1])}`, '', ...R.S.flatMap((s) => [s.h.toUpperCase(), ...(s.kpis || []).map(([l, v]) => `• ${l}: ${v}`), ...(s.table || []).map((r) => `• ${r.join(' | ')}`), ...(s.bullets || []).map((b) => `• ${b}`), ''])].join('\n');
  navigator.clipboard.writeText(txt).then(() => toast('Report summary copied'), () => openSheet('Copy the report', `<textarea style="min-height:280px;font-size:13px" readonly>${esc(txt)}</textarea><p class="muted small">Select all and copy.</p>`));
};
