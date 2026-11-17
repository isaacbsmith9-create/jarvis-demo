// ===================== ANALYTICS =====================
RENDER.analytics = (el, sub) => ANALYTICS[sub](el);
const ANALYTICS = {};

// Metrics you can chart over time: every test with results, plus shooting and workout ratings.
function perfMetrics() {
  const out = [];
  for (const t of allTests()) {
    const rs = resultsOf(t.id); if (!rs.length) continue;
    out.push({ id: 't:' + t.id, name: t.name, lowerBetter: t.better === 'lower', fmt: (v) => fmtVal(t, v), pts: rs.map((r) => ({ date: r.date, v: r.value })) });
  }
  const byDay = (filter) => {
    const m = {}; for (const s of shotSessions()) { const z = filter(s); if (!z.a) continue; m[s.date] = m[s.date] || { m: 0, a: 0 }; m[s.date].m += z.m; m[s.date].a += z.a; }
    return Object.entries(m).filter(([, v]) => v.a >= 10).map(([date, v]) => ({ date, v: r1((v.m / v.a) * 100), tip: `${Math.round((v.m / v.a) * 100)}% (${v.m}/${v.a})` }));
  };
  const all = byDay(sessionTotals); if (all.length) out.push({ id: 's:all', name: 'Shooting % (all shots)', fmt: (v) => Math.round(v) + '%', pts: all });
  const three = byDay((s) => { const t = sessionTotals(s); return { m: t.m3, a: t.a3 }; }); if (three.length) out.push({ id: 's:3', name: '3-point %', fmt: (v) => Math.round(v) + '%', pts: three });
  const ft = byDay((s) => { const c = catAgg([s]).ftc; return c; }); if (ft.length) out.push({ id: 's:ft', name: 'Free throw %', fmt: (v) => Math.round(v) + '%', pts: ft });
  const gp = games().filter((g) => g.pts != null); if (gp.length) out.push({ id: 'g:pts', name: 'Points per game', fmt: (v) => nf(v), pts: gp.map((g) => ({ date: g.date, v: g.pts, tip: `${g.pts} pts${g.opp ? ' vs ' + g.opp : ''}` })) });
  const rt = allDayKeys().map((d) => { const r = exList(d).map((x) => x.rating).filter(Boolean); return r.length ? { date: d, v: r1(mean(r)) } : null; }).filter(Boolean);
  if (rt.length) out.push({ id: 'w:rating', name: 'Workout rating (1-5)', fmt: (v) => r1(v) + '/5', pts: rt });
  const vol = []; for (let i = 25; i >= 0; i--) { const m = shiftIso(mondayOf(todayIso()), -7 * i), mins = sum(lastNDays(7, shiftIso(m, 6)).map((d) => trainingOf(d).mins)); vol.push({ date: m, v: r1(mins / 60), tip: `${r1(mins / 60)} h week of ${fmtD(m)}` }); }
  if (vol.some((p) => p.v > 0)) { const first = vol.findIndex((p) => p.v > 0); out.push({ id: 'w:hours', name: 'Training hours per week', fmt: (v) => r1(v) + ' h', pts: vol.slice(first) }); }
  return out;
}

ANALYTICS.performance = (el) => {
  const ms = perfMetrics(), r = ui('perfRange', '90');
  if (!ms.length) {
    el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Performance progression</h3><span class="sub">Vertical, sprints, lifts, shooting and more over time</span></div></div>
      ${emptyState('Nothing to chart yet', 'Add a test result (vertical, 40-yard, squat…) or log a shooting session. Each metric gets its own progression graph.', 'chart', '<div class="row" style="justify-content:center"><button type="button" class="btn sm primary" data-act="add-test">＋ Test result</button><button type="button" class="btn sm" data-act="shoot">Shooting session</button></div>')}</section>`;
    return;
  }
  const cur = ms.find((m) => m.id === ui('perfMetric')) || ms[0];
  const pts = cur.pts.filter((p) => inRange(p.date, r));
  const first = pts[0], last = pts[pts.length - 1];
  const ch = pts.length >= 2 ? (cur.lowerBetter ? -1 : 1) * pctChange(last.v, first.v) : null;
  const best = cur.pts.reduce((b, p) => (b == null || (cur.lowerBetter ? p.v < b : p.v > b) ? p.v : b), null);
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Performance progression</h3><span class="sub">Pick a metric and a time range</span></div>
      <select id="perf-metric" aria-label="Metric" style="max-width:240px">${ms.map((m) => `<option value="${m.id}" ${m.id === cur.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
    <div class="chart-top"><div class="latest"><small>Latest · ${last ? esc(fmtD(last.date)) : ''}</small><span class="big">${last ? esc(cur.fmt(last.v)) : '—'}</span> ${ch != null ? deltaPill(ch) : ''} <span class="tiny muted">${ch != null ? 'vs start of range (green = better)' : ''}</span></div>${seg('perfRange', RANGES, r)}</div>
    <div class="chart" id="perf-chart"></div>
    ${pts.length < 2 ? `<p class="notice">Only ${pts.length} result${pts.length === 1 ? '' : 's'} in this range. Pick a wider range or log more to see a trend.</p>` : ''}
    <div class="kpis four" style="margin-top:12px">
      <div class="kpi"><small>All-time best</small><b>${esc(cur.fmt(best))}</b></div>
      <div class="kpi"><small>Entries</small><b>${cur.pts.length}</b></div>
      <div class="kpi"><small>First logged</small><b style="font-size:17px">${esc(fmtD(cur.pts[0].date))}</b></div>
      <div class="kpi"><small>Change overall</small><b style="font-size:20px">${cur.pts.length >= 2 ? deltaPill((cur.lowerBetter ? -1 : 1) * pctChange(cur.pts[cur.pts.length - 1].v, cur.pts[0].v)) : '—'}</b></div>
    </div>
  </section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Improvement by test</h3><span class="sub">First result → personal record</span></div></div><div id="imp-list"></div></section>
    <section class="card"><div class="card-head"><div><h3>Personal record history</h3><span class="sub">Every time you beat your best</span></div><button type="button" class="btn sm" data-go="tests">Tests</button></div><div id="pr-hist"></div></section>
  </div>`;
  drawLine($('#perf-chart'), pts, { fmt: cur.fmt, label: cur.name, color: 'var(--accent)' });
  $('#perf-metric').addEventListener('change', (e) => { setUi('perfMetric', e.target.value); refresh(); });
  const imp = allTests().map((t) => { const rs = resultsOf(t.id); if (rs.length < 2) return null; const pr = prOf(t.id); return { t, first: rs[0].value, pr: pr.value, pct: improvePct(t, rs[0].value, pr.value) }; }).filter(Boolean).sort((a, b) => b.pct - a.pct);
  $('#imp-list').innerHTML = imp.length ? `<div class="list">${imp.map((x) => `<div class="li"><div><div class="t">${esc(x.t.name)}</div><div class="s">${esc(fmtVal(x.t, x.first))} → ${esc(fmtVal(x.t, x.pr))}</div></div>${deltaPill(x.pct)}</div>`).join('')}</div>` : emptyState('Needs two results per test', 'Re-test the same thing every 4-6 weeks to see your improvement percentage.', 'trophy');
  const h = allPRs().slice(0, 8);
  $('#pr-hist').innerHTML = h.length ? `<div class="list">${h.map(({ t, r, prev }) => `<div class="li"><div><div class="t">${esc(t.name)}</div><div class="s">${esc(fmtDL(r.date))}</div></div><div style="text-align:right"><div class="v">${esc(fmtVal(t, r.value))}</div><div class="tiny muted">from ${esc(fmtVal(t, prev))}</div></div></div>`).join('')}</div>` : emptyState('No PRs beaten yet', 'Your first result for a test sets the bar. Beat it and it lands here.', 'trophy');
};

ANALYTICS.training = (el) => {
  const mode = ui('volMode', 'weekly'), sel = ui('heatDay', null);
  const groups = [];
  const seg4 = (days) => { const by = { hoops: 0, strength: 0, cond: 0, other: 0 }; let n = 0; for (const d of days) { const t = trainingOf(d); n += t.sessions; for (const k in by) by[k] += t.by[k]; } return { by, n }; };
  const mk = (label, full, days) => { const { by, n } = seg4(days); const tot = sum(Object.values(by)); groups.push({ label, full, segs: CATS.map(([k, , c]) => ({ v: r1(by[k] / 60), color: c })), tip: `${r1(tot / 60)} h · ${n} session${n === 1 ? '' : 's'} (${CATS.filter(([k]) => by[k]).map(([k, l]) => `${l} ${fmtDur(by[k])}`).join(', ') || 'none'})` }); };
  if (mode === 'daily') for (const d of lastNDays(14)) mk(String(parseIso(d).getDate()), fmtDL(d), [d]);
  else if (mode === 'weekly') for (let i = 11; i >= 0; i--) { const m = shiftIso(mondayOf(todayIso()), -7 * i); mk(fmtD(m).split(' ')[1] && `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, 'Week of ' + fmtD(m), lastNDays(7, shiftIso(m, 6))); }
  else for (let i = 11; i >= 0; i--) { const d = parseIso(todayIso()); d.setDate(1); d.setMonth(d.getMonth() - i); const y = d.getFullYear(), mo = d.getMonth(); const days = []; for (let k = 1; k <= 31; k++) { const x = new Date(y, mo, k, 12); if (x.getMonth() !== mo) break; days.push(isoDate(x)); } mk(MON[mo], `${MON[mo]} ${y}`, days); }
  const any = groups.some((g) => g.segs.some((s) => s.v > 0));
  const st = streaks(), mon = mondayOf(todayIso()), w = weekStats(mon), lw = weekStats(shiftIso(mon, -7)), goal = Number(aos().profile?.weeklyDays) || 5;
  const m30 = lastNDays(30), active30 = m30.filter(isActive).length;
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Training volume</h3><span class="sub">Hours by category · tap a bar</span></div>${seg('volMode', [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']], mode)}</div>
    ${any ? `<div class="chart" id="vol-chart"></div><div class="legend">${CATS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>` : emptyState('No workouts logged yet', 'Log practices, lifts and conditioning here or in MacroLens. Each one fills these bars by category.', 'dumbbell', '<button type="button" class="btn sm primary" data-act="log-workout">＋ Log a workout</button>')}
    <div class="kpis four" style="margin-top:12px">
      <div class="kpi"><small>Sessions this week</small><b>${w.sessions}</b><span class="delta">${deltaPill(pctChange(w.sessions, lw.sessions))}</span></div>
      <div class="kpi"><small>Hours this week</small><b>${r1(w.mins / 60)}</b><span class="delta">${deltaPill(pctChange(w.mins, lw.mins))}</span></div>
      <div class="kpi"><small>Basketball</small><b>${r1(w.hoops / 60)} h</b><span class="tiny muted">${w.hoopsN} session(s)</span></div>
      <div class="kpi"><small>Strength · Cond.</small><b>${r1(w.strength / 60)} · ${r1(w.cond / 60)}</b><span class="tiny muted">hours</span></div>
    </div>
  </section>
  <section class="card">
    <div class="card-head"><div><h3>Consistency heatmap</h3><span class="sub">Last 26 weeks · color = how hard you trained · tap a day</span></div>
      <div class="heat-legend">Less <span style="background:var(--h0)"></span><span style="background:var(--h1)"></span><span style="background:var(--h2)"></span><span style="background:var(--h3)"></span><span style="background:var(--h4)"></span> More</div></div>
    ${heatmap(26, activityLevel, sel, (d) => (isActive(d) ? fmtDur(trainingOf(d).mins) : 'rest'))}
    <div id="heat-day"></div>
    <div class="kpis four" style="margin-top:12px">
      <div class="kpi"><small>Current streak</small><b>${st.current}</b><span class="tiny muted">days in a row</span></div>
      <div class="kpi"><small>Longest streak</small><b>${st.longest}</b><span class="tiny muted">days</span></div>
      <div class="kpi"><small>Week completion</small><b>${pctTxt(clamp01(w.active / goal))}</b><span class="tiny muted">${w.active} of ${goal} planned days <button type="button" class="chip" data-act="settings" style="padding:1px 7px;font-size:11px">edit</button></span></div>
      <div class="kpi"><small>30-day consistency</small><b>${pctTxt(active30 / 30)}</b><span class="tiny muted">${active30} active days · ${st.total} all-time</span></div>
    </div>
  </section>`;
  if (any) drawBars($('#vol-chart'), groups, { fmt: (v) => r1(v) + ' h', tick: (v) => v + 'h', label: 'Training hours by category' });
  if (sel) heatDay($('#heat-day'), sel);
};
function heatDay(el, d) {
  const xs = exList(d), t = totalsOf(d), r = recoveryScore(d);
  el.innerHTML = `<div class="notice" style="margin-top:10px"><div class="row-between"><b style="color:var(--fg)">${esc(fmtDL(d))}</b><button type="button" class="btn sm" data-act="log-workout" data-date="${d}">＋ Add workout</button></div>
    ${xs.length ? xs.map((x) => `<div class="li"><div><div class="t" style="color:var(--fg)">${esc(x.name || 'Workout')}</div><div class="s">${fmtDur(x.mins)} · ${esc(x.int || '')}${x.rating ? ` · rated ${x.rating}/5` : ''}${x.notes ? ' · ' + esc(x.notes) : ''}</div></div><button type="button" class="chip" data-act="del-workout" data-date="${d}" data-id="${esc(x.id)}" aria-label="Delete workout">Delete</button></div>`).join('') : '<p style="margin-top:6px">No training logged this day.</p>'}
    <p class="tiny" style="margin-top:6px">${hasFood(d) ? `Ate ${t.calories.toLocaleString()} kcal, ${Math.round(t.protein)} g protein` : 'No food logged'} · ${waterOf(d)} oz water${r ? ` · recovery ${r.score}` : ''}</p></div>`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('.heat button[data-day]'); if (!b || state.view !== 'analytics') return; setUi('heatDay', b.dataset.day); refresh(); });

ANALYTICS.body = (el) => {
  const k = ui('bodyMetric', 'weight'), r = ui('bodyRange', 'all');
  const meta = BODY_METRICS.find((m) => m[0] === k) || BODY_METRICS[0];
  const all = bodySeries(meta[0]), pts = all.filter((p) => inRange(p.date, r));
  const has = BODY_METRICS.filter(([key]) => bodySeries(key).length);
  const last = all[all.length - 1], first = all[0];
  const d30 = all.filter((p) => daysBetween(p.date, todayIso()) <= 30), prev30 = all.filter((p) => daysBetween(p.date, todayIso()) > 30 && daysBetween(p.date, todayIso()) <= 60);
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Body composition</h3><span class="sub">Only what you've entered. Body weight and measurements are shared with MacroLens.</span></div><button type="button" class="btn sm primary" data-act="body-entry">＋ Entry</button></div>
    <div class="chips" style="margin-bottom:10px">${BODY_METRICS.map(([key, l]) => `<button type="button" class="chip ${key === k ? 'on' : ''}" data-body="${key}">${l}${bodySeries(key).length ? '' : ' ·'}</button>`).join('')}</div>
    ${all.length ? `<div class="chart-top"><div class="latest"><small>${esc(meta[1])} · ${esc(fmtD(last.date))}</small><span class="big">${r1(last.v)}${meta[2] === '%' ? '%' : ' ' + meta[2]}</span></div>${seg('bodyRange', RANGES, r)}</div>
      ${pts.length ? '<div class="chart" id="body-chart"></div>' : '<p class="notice">No entries in this range.</p>'}
      <div class="kpis four" style="margin-top:12px">
        <div class="kpi"><small>Since first entry</small><b style="font-size:19px">${all.length >= 2 ? `${last.v - first.v >= 0 ? '+' : ''}${r1(last.v - first.v)} ${meta[2]}` : '—'}</b><span class="tiny muted">${all.length >= 2 ? `${r1(pctChange(last.v, first.v))}% since ${fmtD(first.date)}` : 'needs 2 entries'}</span></div>
        <div class="kpi"><small>Last 30 days avg</small><b style="font-size:19px">${d30.length ? r1(mean(d30.map((p) => p.v))) : '—'}</b><span class="tiny muted">${prev30.length && d30.length ? `prior 30 days ${r1(mean(prev30.map((p) => p.v)))}` : 'no earlier month to compare'}</span></div>
        <div class="kpi"><small>Entries</small><b>${all.length}</b></div>
        <div class="kpi"><small>Lowest · highest</small><b style="font-size:17px">${r1(Math.min(...all.map((p) => p.v)))} · ${r1(Math.max(...all.map((p) => p.v)))}</b></div>
      </div>
      <details style="margin-top:12px"><summary class="muted small" style="cursor:pointer">History and edits</summary><div class="list">${[...all].reverse().slice(0, 40).map((p) => `<div class="li"><div class="t">${esc(fmtDL(p.date))}</div><div class="row"><span class="v">${r1(p.v)} ${meta[2]}</span><button type="button" class="chip" data-act="del-body" data-key="${k}" data-date="${p.date}">Delete</button></div></div>`).join('')}</div></details>`
    : emptyState(`No ${meta[1].toLowerCase()} entries`, k === 'bf' || k === 'muscle' ? 'Body fat and muscle mass are only shown if you enter them (from a smart scale, DEXA or a trainer). Nothing is estimated.' : 'Add an entry to start the trend. Weigh in the same way each time, ideally in the morning.', 'scale', '<button type="button" class="btn sm primary" data-act="body-entry">＋ Add entry</button>')}
  </section>
  ${has.length > 1 ? `<section class="card"><div class="card-head"><div><h3>All body metrics</h3><span class="sub">Latest value and change from your first entry</span></div></div><div class="list">${has.map(([key, l, u]) => { const s = bodySeries(key), a = s[0], b = s[s.length - 1]; return `<button type="button" class="li li-btn" data-body="${key}"><div><div class="t">${l}</div><div class="s">${s.length} entr${s.length === 1 ? 'y' : 'ies'} since ${fmtD(a.date)}</div></div><div class="row">${spark(s.map((p) => p.v))}<span class="v">${r1(b.v)} ${u}</span></div></button>`; }).join('')}</div></section>` : ''}`;
  if (pts.length) drawLine($('#body-chart'), pts, { fmt: (v) => `${r1(v)} ${meta[2]}`, label: meta[1], color: 'var(--accent)' });
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-body]'); if (!b) return; setUi('bodyMetric', b.dataset.body); refresh(); });

ANALYTICS.recovery = (el) => {
  const r = ui('recRange', '30'), n = r === 'all' ? Math.max(30, allDayKeys().length ? daysBetween(allDayKeys()[0], todayIso()) + 1 : 30) : Number(r);
  const days = lastNDays(n);
  const score = seriesOf((d) => recoveryScore(d)?.score ?? null, days);
  const ser = (k) => seriesOf((d) => recoveryInputs(d)[k], days);
  const sleep = ser('sleepH'), energy = ser('energy'), sore = ser('sore'), rhr = ser('rhr'), hrv = ser('hrv');
  const rest = days.filter((d) => !isActive(d) && (hasFood(d) || dayDoc(d)?.type === 'rest')).length;
  const hc = core().health;
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Recovery score</h3><span class="sub">0-100 · needs at least two inputs that day · green band = high</span></div><div class="row">${seg('recRange', [['7', '7D'], ['30', '30D'], ['90', '90D'], ['365', '1Y']], r)}<button type="button" class="btn sm primary" data-act="checkin">Check in</button></div></div>
    ${score.length ? `<div class="chart" id="rec-chart"></div><div class="legend"><span><i style="background:var(--good)"></i>High 70+</span><span><i style="background:var(--warn)"></i>Moderate 45-69</span><span><i style="background:var(--danger)"></i>Low under 45</span></div>`
      : emptyState('No recovery scores yet', 'Do the 20-second morning check-in (sleep, energy, soreness). After a day with two or more inputs, your score appears here.', 'moon', '<button type="button" class="btn sm primary" data-act="checkin">Morning check-in</button>')}
    <div class="kpis four" style="margin-top:12px">
      <div class="kpi"><small>Avg score</small><b>${score.length ? Math.round(mean(score.map((p) => p.v))) : '—'}</b><span class="tiny muted">${score.length} scored day(s)</span></div>
      <div class="kpi"><small>Avg sleep</small><b>${sleep.length ? r1(mean(sleep.map((p) => p.v))) + ' h' : '—'}</b><span class="tiny muted">${sleep.filter((p) => p.v >= 8).length} night(s) 8 h+</span></div>
      <div class="kpi"><small>Rest days</small><b>${rest}</b><span class="tiny muted">logged days with no training</span></div>
      <div class="kpi"><small>Avg soreness</small><b>${sore.length ? r1(mean(sore.map((p) => p.v))) + '/5' : '—'}</b></div>
    </div>
  </section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Sleep</h3><span class="sub">Hours per night (check-ins or Apple Health)</span></div></div>${sleep.length ? '<div class="chart" id="sleep-chart"></div>' : emptyState('No sleep logged', 'Add sleep in the check-in, or import Apple Health in MacroLens.', 'moon')}</section>
    <section class="card"><div class="card-head"><div><h3>Energy and soreness</h3><span class="sub">1-5 from your check-ins</span></div></div>${energy.length || sore.length ? '<div class="chart" id="es-chart"></div><div class="legend"><span><i style="background:var(--good)"></i>Energy</span><span><i style="background:var(--over)"></i>Soreness</span></div>' : emptyState('No check-ins yet', 'Rate energy and soreness each morning to see the pattern.', 'bolt')}</section>
    <section class="card"><div class="card-head"><div><h3>Resting heart rate</h3><span class="sub">${hc ? 'Apple Health import or manual' : 'Manual entries (or import Apple Health in MacroLens)'}</span></div></div>${rhr.length ? '<div class="chart" id="rhr-chart"></div>' : emptyState('No heart-rate data', 'Not recorded. Add it in the check-in if your watch shows it. Athlete OS never estimates it.', 'heart')}</section>
    <section class="card"><div class="card-head"><div><h3>HRV</h3><span class="sub">Heart-rate variability (ms)</span></div></div>${hrv.length ? '<div class="chart" id="hrv-chart"></div>' : emptyState('No HRV data', 'HRV isn\'t part of the Apple Health import yet. If your watch shows it, add it in the check-in.', 'heart')}</section>
  </div>
  <section class="card"><div class="card-head"><div><h3>Recovery recommendations</h3><span class="sub">Rules from sports-science basics, applied to your logs</span></div></div><div id="rec-tips"></div></section>`;
  if (score.length) drawLine($('#rec-chart'), score, { fmt: (v) => `${Math.round(v)} / 100`, yMin: 0, yMax: 100, bands: [[70, 100, 'var(--good)'], [45, 70, 'var(--warn)'], [0, 45, 'var(--danger)']], label: 'Recovery score' });
  if (sleep.length) drawBars($('#sleep-chart'), sleep.slice(-21).map((p) => ({ label: String(parseIso(p.date).getDate()), full: fmtDL(p.date), segs: [{ v: p.v, color: p.v >= 8 ? 'var(--purple)' : p.v >= 7 ? 'var(--accent)' : 'var(--over)' }], tip: `${p.v} h` })), { goal: 8, fmt: (v) => v + ' h', h: 160 });
  if (energy.length || sore.length) {
    // Two series share one chart: draw energy, overlay soreness as a second path.
    drawLine($('#es-chart'), energy.length ? energy : sore, { color: energy.length ? 'var(--good)' : 'var(--over)', yMin: 1, yMax: 5, fmt: (v) => `${energy.length ? 'Energy' : 'Soreness'} ${v}/5`, h: 160 });
    if (energy.length && sore.length) overlayLine($('#es-chart'), energy, sore, 'var(--over)', 1, 5, 'Soreness');
  }
  if (rhr.length) drawLine($('#rhr-chart'), rhr, { color: 'var(--danger)', fmt: (v) => Math.round(v) + ' bpm', h: 160 });
  if (hrv.length) drawLine($('#hrv-chart'), hrv, { color: 'var(--purple)', fmt: (v) => Math.round(v) + ' ms', h: 160 });
  $('#rec-tips').innerHTML = recTips(days);
};
/** Adds a second series to a line chart drawn by drawLine with a fixed y range (same x domain from the base series). */
function overlayLine(el, base, pts, color, yMin, yMax, name) {
  const svg = $('svg', el); if (!svg) return;
  const W = Number(svg.getAttribute('width')), H = Number(svg.getAttribute('height')), L = 40, R = 14, T = 14, B = 24;
  const dates = [...base, ...pts].map((p) => parseIso(p.date).getTime()), t0 = parseIso(base[0].date).getTime(), t1 = parseIso(base[base.length - 1].date).getTime();
  if (Math.min(...dates) < t0 || Math.max(...dates) > t1) { /* drawn on the base series' axis; points outside are clipped */ }
  const ticks = niceTicks(yMin - (yMax - yMin) * 0.12, yMax + (yMax - yMin) * 0.12, 4), lo = Math.max(ticks[0], yMin), hi = Math.min(ticks[ticks.length - 1], yMax);
  const xs = (d) => (t1 === t0 ? (L + W - R) / 2 : L + ((parseIso(d).getTime() - t0) / (t1 - t0)) * (W - L - R)), ys = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const P = pts.filter((p) => parseIso(p.date).getTime() >= t0 && parseIso(p.date).getTime() <= t1).map((p) => [r1(xs(p.date)), r1(ys(p.v)), p]);
  svg.insertAdjacentHTML('beforeend', `<path d="${smoothPath(P)}" fill="none" stroke="${color}" stroke-width="2.4" stroke-dasharray="1 0"/>${P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="var(--surface)" stroke="${color}" stroke-width="2"/>`).join('')}${P.map(([x, y, p]) => `<circle class="hit" cx="${x}" cy="${y}" r="11" fill="transparent" data-tip="${name} ${p.v}/5|${esc(fmtDL(p.date))}"/>`).join('')}`);
}
function recTips(days) {
  const tips = [], last7 = days.slice(-7);
  const sl = last7.map((d) => recoveryInputs(d).sleepH).filter((x) => x != null);
  if (sl.length >= 3 && mean(sl) < 8) tips.push(['moon', `You averaged ${r1(mean(sl))} h of sleep on ${sl.length} logged nights. Teen athletes recover best with 8-10 h: try a fixed bedtime 30 minutes earlier.`]);
  const vol = last7.map((d) => trainingOf(d).mins), restN = last7.filter((d) => !isActive(d)).length;
  if (sum(vol) > 0 && restN === 0) tips.push(['calendar', 'You trained all 7 of the last 7 days. Plan at least one full rest or easy mobility day each week.']);
  const so = last7.map((d) => recoveryInputs(d).sore).filter((x) => x != null);
  if (so.length >= 2 && mean(so) >= 3.5) tips.push(['bolt', `Soreness has averaged ${r1(mean(so))}/5. Keep hard lower-body work away from game days, and add 10 minutes of mobility after practice.`]);
  const food = last7.filter(hasFood), lowP = food.filter((d) => totalsOf(d).protein < targets(d).protein * 0.8).length;
  if (food.length >= 3 && lowP >= 2) tips.push(['fork', `Protein was under 80% of your goal on ${lowP} of ${food.length} logged days. A 20-30 g protein snack within 2 hours after training helps muscles repair.`]);
  const wd = last7.filter((d) => waterOf(d) > 0), lowW = wd.filter((d) => waterOf(d) < targets(d).waterOz * 0.7).length;
  if (wd.length >= 3 && lowW >= 2) tips.push(['drop', `Water was under 70% of your goal on ${lowW} days. Even mild dehydration lowers energy and shooting accuracy late in practice.`]);
  if (!tips.length) return sl.length || so.length || food.length ? '<p class="muted small">Nothing stands out in the last 7 days. Keep checking in so patterns can show up.</p>' : emptyState('Not enough data yet', 'Recommendations come from your check-ins, training, food and water logs from the last 7 days.', 'moon');
  return `<div class="list">${tips.map(([i, t]) => `<div class="li" style="justify-content:flex-start;align-items:flex-start"><span class="ico" style="width:30px;height:30px;flex:none;color:var(--accent)">${ICONS[i]}</span><span class="small">${esc(t)}</span></div>`).join('')}</div>`;
}

ANALYTICS.nutrition = (el) => {
  const r = ui('nutRange', '30'), days = lastNDays(Number(r)), food = days.filter(hasFood);
  if (!food.length) {
    el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Nutrition trends</h3><span class="sub">From your MacroLens food log</span></div>${seg('nutRange', [['7', '7D'], ['30', '30D'], ['90', '90D']], r)}</div>${emptyState('No food logged in this range', 'Log meals in MacroLens (photo, search or barcode). Days you don\'t log are left blank, never counted as zero.', 'fork', `<div class="row" style="justify-content:center">${mlLink('', 'Open MacroLens', 'btn sm primary')}</div>`)}</section>`;
    return;
  }
  const T = (d) => targets(d), tot = (d) => totalsOf(d);
  const avg = (k) => Math.round(mean(food.map((d) => tot(d)[k])));
  const hit = (k, lo = 0.9, hi = Infinity) => food.filter((d) => { const x = tot(d)[k] / T(d)[k]; return x >= lo && x <= hi; }).length;
  const wDays = days.filter((d) => waterOf(d) > 0);
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Calories vs target</h3><span class="sub">${food.length} logged day(s) of ${days.length} · unlogged days are skipped</span></div>${seg('nutRange', [['7', '7D'], ['30', '30D'], ['90', '90D']], r)}</div>
    <div class="chart" id="kcal-chart"></div>
    <div class="kpis four" style="margin-top:12px">
      <div class="kpi"><small>Avg calories</small><b>${avg('calories').toLocaleString()}</b><span class="tiny muted">target avg ${Math.round(mean(food.map((d) => T(d).calories))).toLocaleString()}</span></div>
      <div class="kpi"><small>Calories on target</small><b>${pctTxt(hit('calories', 0.85, 1.15) / food.length)}</b><span class="tiny muted">within ±15% (${hit('calories', 0.85, 1.15)} days)</span></div>
      <div class="kpi"><small>Protein goal hit</small><b>${pctTxt(hit('protein') / food.length)}</b><span class="tiny muted">90%+ of goal (${hit('protein')} days)</span></div>
      <div class="kpi"><small>Water goal hit</small><b>${wDays.length ? pctTxt(wDays.filter((d) => waterOf(d) >= T(d).waterOz * 0.9).length / wDays.length) : '—'}</b><span class="tiny muted">${wDays.length} day(s) with water logged</span></div>
    </div>
  </section>
  <section class="card"><div class="card-head"><div><h3>Macros per day</h3><span class="sub">Grams eaten · dashed line = your goal</span></div>${seg('macroK', [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']], ui('macroK', 'protein'))}</div><div class="chart" id="macro-chart"></div>
    <div class="cmp" style="margin-top:12px"><span class="h">Average</span><span class="h">Eaten</span><span class="h">Goal</span><span class="h">%</span>
      ${[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, l]) => { const g = Math.round(mean(food.map((d) => T(d)[k]))); return `<span>${l}</span><b>${avg(k)} g</b><span class="muted">${g} g</span><b>${pctTxt(avg(k) / g)}</b>`; }).join('')}
    </div></section>
  <section class="card"><div class="card-head"><div><h3>Hydration</h3><span class="sub">Ounces per day vs goal</span></div></div>${wDays.length ? '<div class="chart" id="water-chart"></div>' : emptyState('No water logged', 'Tap +8/+16/+24 oz on Home or in MacroLens.', 'drop')}</section>
  <section class="card"><div class="card-head"><div><h3>Weekly averages</h3><span class="sub">Logged days only</span></div></div><div id="nut-weeks"></div></section>`;
  drawBars($('#kcal-chart'), days.map((d) => ({ label: String(parseIso(d).getDate()), full: fmtDL(d), segs: [{ v: hasFood(d) ? tot(d).calories : 0, color: hasFood(d) && Math.abs(tot(d).calories / T(d).calories - 1) <= 0.15 ? 'var(--accent)' : 'var(--purple)' }], tip: hasFood(d) ? `${tot(d).calories.toLocaleString()} of ${T(d).calories.toLocaleString()} kcal` : 'not logged' })), { goal: Math.round(mean(food.map((d) => T(d).calories))), fmt: (v) => v.toLocaleString() + ' kcal' });
  const mk = ui('macroK', 'protein'), col = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' }[mk];
  drawLine($('#macro-chart'), food.map((d) => ({ date: d, v: tot(d)[mk], tip: `${Math.round(tot(d)[mk])} of ${T(d)[mk]} g` })), { color: col, goal: Math.round(mean(food.map((d) => T(d)[mk]))), goalLabel: 'Avg goal', fmt: (v) => Math.round(v) + ' g' });
  if (wDays.length) drawBars($('#water-chart'), days.map((d) => ({ label: String(parseIso(d).getDate()), full: fmtDL(d), segs: [{ v: waterOf(d), color: waterOf(d) >= T(d).waterOz * 0.9 ? 'var(--water)' : 'color-mix(in srgb, var(--water) 45%, transparent)' }], tip: `${waterOf(d)} of ${T(d).waterOz} oz` })), { goal: Math.round(mean(days.map((d) => T(d).waterOz))), fmt: (v) => v + ' oz', h: 160 });
  const weeks = []; for (let i = 0; i < Math.min(8, Math.ceil(days.length / 7)); i++) { const m = shiftIso(mondayOf(todayIso()), -7 * i), w = weekStats(m); if (w.foodDays) weeks.push(w); }
  $('#nut-weeks').innerHTML = weeks.length ? `<div class="cmp" style="grid-template-columns:minmax(0,1.2fr) repeat(3,minmax(0,1fr))"><span class="h">Week of</span><span class="h">Calories</span><span class="h">Protein</span><span class="h">Water</span>${weeks.map((w) => `<span>${fmtD(w.mon)} <span class="tiny muted">(${w.foodDays}d)</span></span><b>${w.avgKcal?.toLocaleString() ?? '—'}</b><b>${w.avgProtein ?? '—'} g</b><b>${w.avgWater ?? '—'}${w.avgWater ? ' oz' : ''}</b>`).join('')}</div>` : '<p class="muted small">No logged weeks in range.</p>';
};

const CORR_PRESETS = [['sleep', 'shotpct', 0, 'Sleep → shooting %'], ['water', 'energy', 0, 'Water → energy'], ['volume', 'recovery', 1, 'Training minutes → next-day recovery'], ['kcal', 'rating', 0, 'Calories → workout rating'], ['shots', 'shotpct', 0, 'Shooting volume → shooting %'], ['sleep', 'rating', 0, 'Sleep → workout rating'], ['protein', 'sore', 1, 'Protein → next-day soreness']];
ANALYTICS.correlations = (el) => {
  const x = ui('cx', 'sleep'), y = ui('cy', 'shotpct'), lag = Number(ui('clag', 0)), r = ui('crange', '90');
  const days = lastNDays(r === 'all' ? 730 : Number(r));
  const ps = corrPairs(x, y, days, lag), X = CORR_VARS.find((v) => v[0] === x), Y = CORR_VARS.find((v) => v[0] === y), st = ps.length >= CORR_MIN ? pearson(ps) : null;
  const opts = (cur) => CORR_VARS.map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const ready = CORR_PRESETS.map((p) => ({ p, n: corrPairs(p[0], p[1], days, p[2]).length }));
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Performance correlations</h3><span class="sub">Do two things move together on the same days?</span></div>${seg('crange', [['30', '30D'], ['90', '90D'], ['365', '1Y'], ['all', 'All']], r)}</div>
    <div class="chips" style="margin-bottom:12px">${ready.map(({ p, n }) => `<button type="button" class="chip ${p[0] === x && p[1] === y && p[2] === lag ? 'on' : ''}" data-corr="${p[0]}|${p[1]}|${p[2]}">${esc(p[3])} <span class="tiny" style="opacity:.7">${n}d</span></button>`).join('')}</div>
    <div class="fields"><label>X (the thing you change)<select id="cx">${opts(x)}</select></label><label>Y (the result)<select id="cy">${opts(y)}</select></label>
      <label class="check full"><input type="checkbox" id="clag" ${lag ? 'checked' : ''}> Compare with the <b>next</b> day's result</label></div>
    <div style="margin-top:12px">${st ? `<div class="chart" id="scatter"></div>` : emptyState(`${ps.length} of ${CORR_MIN} days so far`, `This needs at least ${CORR_MIN} days with both "${X[1]}" and "${Y[1]}" recorded${lag ? ' (Y on the next day)' : ''}. Keep logging both and it unlocks.`, 'chart')}</div>
    ${st ? `<div class="row" style="margin-top:12px;gap:14px"><div class="kpi" style="flex:1"><small>Correlation (r)</small><b>${st.r >= 0 ? '+' : ''}${st.r.toFixed(2)}</b><span class="tiny muted">${strength(st.r)} ${st.r >= 0 ? 'positive' : 'negative'}</span></div><div class="kpi" style="flex:1"><small>Days compared</small><b>${st.n}</b><span class="tiny muted">${st.n < 15 ? 'small sample: treat as a hint' : 'decent sample'}</span></div></div>
      <p class="small" style="margin-top:12px">${corrText(X, Y, st, lag)}</p>` : ''}
    <p class="notice" style="margin-top:12px">Correlation is not causation. Two things can move together because of something else (a tough week, games, school stress). Use this to spot patterns worth testing, not as proof.</p>
  </section>`;
  if (st) drawScatter($('#scatter'), ps, { xl: X[1], yl: Y[1] + (lag ? ' (next day)' : ''), fit: st, label: `${X[1]} vs ${Y[1]}` });
  $('#cx').addEventListener('change', (e) => { setUi('cx', e.target.value); refresh(); });
  $('#cy').addEventListener('change', (e) => { setUi('cy', e.target.value); refresh(); });
  $('#clag').addEventListener('change', (e) => { setUi('clag', e.target.checked ? 1 : 0); refresh(); });
};
function corrText(X, Y, st, lag) {
  const s = strength(st.r);
  if (s === 'no clear') return `On your ${st.n} days there's no clear link between ${X[1].toLowerCase()} and ${Y[1].toLowerCase()}${lag ? ' the next day' : ''}.`;
  const dir = st.r > 0 ? 'higher' : 'lower', unit = X[2] ? ' ' + X[2] : '';
  const step = X[0] === 'sleep' ? 1 : X[0] === 'water' ? 16 : X[0] === 'kcal' ? 300 : X[0] === 'volume' ? 30 : X[0] === 'protein' ? 20 : X[0] === 'shots' ? 50 : 1;
  return `There's a ${s} ${st.r > 0 ? 'positive' : 'negative'} pattern: on days with more ${X[1].toLowerCase()}, your ${Y[1].toLowerCase()}${lag ? ' the next day' : ''} tended to be ${dir}. On average, every +${step}${unit} went with about ${st.slope * step >= 0 ? '+' : ''}${r1(st.slope * step)} ${Y[2] || 'points'} of ${Y[1].toLowerCase()}.`;
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-corr]'); if (!b) return; const [x, y, l] = b.dataset.corr.split('|'); setUi('cx', x); setUi('cy', y); setUi('clag', Number(l)); refresh(); });

ANALYTICS.compare = (el) => {
  const mode = ui('cmpMode', 'week'), today = todayIso();
  let a, b, la, lb;
  if (mode === 'week') { const m = mondayOf(today); a = lastNDays(daysBetween(m, today) + 1); b = lastNDays(7, shiftIso(m, -1)).slice(0, a.length); la = 'This week'; lb = 'Same days last week'; }
  else if (mode === 'month') { const d = parseIso(today), n = d.getDate(); a = lastNDays(n); const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12), b0 = []; for (let i = 0; i < n; i++) { const x = new Date(pm.getFullYear(), pm.getMonth(), 1 + i, 12); if (x.getMonth() === pm.getMonth()) b0.push(isoDate(x)); } b = b0; la = 'This month'; lb = 'Same days last month'; }
  else { a = lastNDays(30); b = lastNDays(30, shiftIso(today, -30)); la = 'Last 30 days'; lb = 'Previous 30'; }
  const S = (days) => {
    const food = days.filter(hasFood), t = days.map(trainingOf), rec = days.map(recoveryScore).filter(Boolean), sl = days.map((d) => recoveryInputs(d).sleepH).filter((x) => x != null);
    const sh = shotSessions().filter((s) => days.includes(s.date)).map(sessionTotals), m = sum(sh.map((s) => s.m)), at = sum(sh.map((s) => s.a)), m3 = sum(sh.map((s) => s.m3)), a3 = sum(sh.map((s) => s.a3));
    const g = games().filter((x) => days.includes(x.date));
    return {
      sessions: sum(t.map((x) => x.sessions)), hours: r1(sum(t.map((x) => x.mins)) / 60), active: days.filter(isActive).length, hoops: r1(sum(t.map((x) => x.by.hoops)) / 60),
      kcal: food.length ? Math.round(mean(food.map((d) => totalsOf(d).calories))) : null, protein: food.length ? Math.round(mean(food.map((d) => totalsOf(d).protein))) : null,
      water: days.some((d) => waterOf(d)) ? Math.round(mean(days.filter((d) => waterOf(d)).map(waterOf))) : null,
      rec: rec.length ? Math.round(mean(rec.map((x) => x.score))) : null, sleep: sl.length ? r1(mean(sl)) : null,
      shots: at || null, pct: at ? r1((m / at) * 100) : null, p3: a3 ? r1((m3 / a3) * 100) : null, ppg: g.length ? r1(mean(g.map((x) => x.pts || 0))) : null,
      prs: allPRs().filter((p) => days.includes(p.r.date)).length,
    };
  };
  const A = S(a), B = S(b);
  const rows = [['Training sessions', 'sessions', ''], ['Training hours', 'hours', ' h'], ['Active days', 'active', ''], ['Basketball hours', 'hoops', ' h'], ['Shots taken', 'shots', ''], ['Shooting %', 'pct', '%'], ['3-point %', 'p3', '%'], ['Points per game', 'ppg', ''], ['New PRs', 'prs', ''], ['Avg calories', 'kcal', ''], ['Avg protein', 'protein', ' g'], ['Avg water', 'water', ' oz'], ['Avg recovery', 'rec', ''], ['Avg sleep', 'sleep', ' h']];
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Compare periods</h3><span class="sub">${esc(la)} vs ${esc(lb.toLowerCase())} · same number of days</span></div>${seg('cmpMode', [['week', 'Week'], ['month', 'Month'], ['30', '30 days']], mode)}</div>
    <div class="cmp"><span class="h">Metric</span><span class="h">${esc(la)}</span><span class="h">${esc(lb)}</span><span class="h">Change</span>
      ${rows.map(([l, k, u]) => `<span>${l}</span><b>${A[k] == null ? '—' : A[k].toLocaleString() + u}</b><span class="muted">${B[k] == null ? '—' : B[k].toLocaleString() + u}</span>${['pct', 'p3'].includes(k) && A[k] != null && B[k] != null ? deltaPill(A[k] - B[k], false, ' pts') : deltaPill(pctChange(A[k], B[k]))}`).join('')}
    </div>
    <p class="muted tiny" style="margin-top:10px">— means nothing was logged for that period. Changes only compare periods where both have data.</p>
  </section>
  <section class="card"><div class="card-head"><div><h3>Current vs previous record</h3><span class="sub">How far each PR moved the bar</span></div></div>
    ${(() => { const rowsPr = allTests().map((t) => { const rs = resultsOf(t.id); if (!rs.length) return null; const pr = prOf(t.id); const prevBest = rs.filter((r) => r !== pr && r.date <= pr.date).reduce((bv, r) => (bv == null ? r.value : betterOf(t, bv, r.value)), null); return { t, pr, prevBest, last: rs[rs.length - 1] }; }).filter(Boolean);
      return rowsPr.length ? `<div class="cmp"><span class="h">Test</span><span class="h">Record</span><span class="h">Before it</span><span class="h">Gain</span>${rowsPr.map(({ t, pr, prevBest }) => `<span>${esc(t.name)}</span><b>${esc(fmtVal(t, pr.value))}</b><span class="muted">${esc(fmtVal(t, prevBest))}</span>${deltaPill(prevBest == null ? null : improvePct(t, prevBest, pr.value))}`).join('')}</div>` : emptyState('No tests logged', 'Log test results to compare your current record with the one before it.', 'trophy'); })()}
  </section>`;
};
