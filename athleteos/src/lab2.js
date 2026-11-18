// ===================== PERFORMANCE SIMULATION CENTER: PART B =====================
// Compare center, development forecasts, simulation history with predicted-vs-actual accuracy, the AI simulation
// assistant and "turn into a plan" (calendar events added only after explicit approval, removable in one tap).
SUBS.lab.splice(2, 0, ['compare', 'Compare'], ['forecast', 'Forecasts'], ['history', 'History & accuracy'], ['ask', 'Ask AI']);
const SC_KIND = { build: 'Scenario', train: 'Training A vs B', shoot: 'Shooting', ath: 'Athletic' };

// ---------- one profile per saved simulation, for comparing ----------
function scPlan(sc) { return sc.kind === 'build' ? sc.inputs.mod : sc.kind === 'train' ? sc.inputs.B : null; }
function scProfile(sc) {
  const snap = sc.snap, p = scPlan(sc), weeks = Number(sc.inputs.weeks) || 12, m = p ? planMetrics(p, snap, weeks) : null, sh = snap.shooting;
  let shoot = null;
  if (sc.kind === 'shoot') shoot = shootProject(snap, { ...sc.inputs, sessions: sc.inputs.nSessions, attempts: sc.inputs.nAttempts });
  else if (m && sh.pct != null) shoot = shootProject(snap, { pct: sh.pct, sessions: m.plan.items.shooting.n, attempts: m.plan.attempts, weeks });
  const tests = {};
  for (const tb of Object.values(snap.tests).filter((t) => ATH_IDS.includes(t.id))) {
    const fk = ATH_FOCUS[tb.group], now = snap.plan.items[fk]?.n || 0;
    if (sc.kind === 'ath' && sc.inputs.test !== tb.id) continue;
    const inp = sc.kind === 'ath' ? { ...sc.inputs, start: snap.date } : { cur: tb.cur, weeks, focusNow: now, focusNew: m ? m.plan.items[fk]?.n || 0 : now, start: snap.date };
    tests[tb.id] = athProject(tb, inp);
  }
  return { sc, m, shoot, tests, weeks };
}
function baselineProfile() {
  const s = labSnapshot(), now = new Date().toISOString();
  return scProfile({ id: 'base', name: 'Baseline (today)', kind: 'build', created: now, updated: now, inputs: { mod: s.plan, weeks: 12 }, snap: s });
}
const COLORS = ['var(--muted)', 'var(--purple)', '#22c3ee', '#f59e0b', '#34d399'];

// ===================== Compare =====================
LAB.compare = (el) => {
  const scs = [...sim().scenarios].sort((a, b) => b.updated.localeCompare(a.updated));
  let sel = ui('labCmp', []).filter((id) => scs.some((s) => s.id === id));
  if (!sel.length) sel = scs.slice(0, 2).map((s) => s.id);
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Scenario comparison</h3><span class="sub">Pick up to 4 saved simulations. Your baseline is always included.</span></div>${kTag('h')}</div>
    ${scs.length ? `<div class="chips">${scs.map((s) => `<button type="button" class="chip ${sel.includes(s.id) ? 'on' : ''}" data-cmp="${s.id}" aria-pressed="${sel.includes(s.id)}">${esc(s.name)}</button>`).join('')}</div>
      <p class="tiny muted" style="margin-top:8px">Manage: ${scs.map((s) => `<button type="button" class="linkish" data-act="lab-more" data-id="${s.id}">${esc(s.name)}</button>`).join(' · ')}</p>`
    : emptyState('Nothing saved to compare yet', 'Save a scenario from the builder, training, shooting or athletic simulator, then compare them here.', 'flask', '<button type="button" class="btn sm primary" data-go="lab-build">Open the builder</button>')}</section>
    <div id="lab-out" class="stack" style="gap:14px"></div>`;
  if (scs.length) cmpOut(sel);
};
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-cmp]'); if (!c) return;
  let sel = ui('labCmp', []).filter((id) => sim().scenarios.some((s) => s.id === id));
  if (!sel.length) sel = [...sim().scenarios].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 2).map((s) => s.id);
  sel = sel.includes(c.dataset.cmp) ? sel.filter((x) => x !== c.dataset.cmp) : [...sel, c.dataset.cmp].slice(-4);
  setUi('labCmp', sel); refresh();
});
function cmpOut(sel) {
  const out = $('#lab-out'); if (!out) return;
  const P = [baselineProfile(), ...sel.map((id) => sim().scenarios.find((s) => s.id === id)).filter(Boolean).map(scProfile)];
  const col = (i) => COLORS[i % COLORS.length], last = (pr, k) => (pr ? pr.rows[pr.rows.length - 1][k] : null);
  const rows = [
    ['Training hours / wk', (p) => p.m?.hours, 1], ['Training load / wk', (p) => p.m?.load, 0], ['Shots / wk', (p) => p.shoot?.perWeek ?? p.m?.shotsWeek, 0],
    ['Strength sessions / wk', (p) => p.m?.strengthN, 0], ['Conditioning / wk', (p) => p.m?.condN, 0], ['Rest days', (p) => p.m?.restDays, 0],
    ['Switch-week ACWR', (p) => p.m?.acwrFirst, 2], ['Peak ACWR', (p) => p.m?.acwrPeak, 2], ['Monotony', (p) => p.m?.monotony, 2],
  ];
  const tids = [...new Set(P.flatMap((p) => Object.keys(p.tests)))];
  const head = `<div class="lt-h" style="grid-template-columns:minmax(0,1.3fr) repeat(${P.length},minmax(0,1fr))"><span></span>${P.map((p, i) => `<span><i class="dot" style="background:${col(i)};margin-right:4px"></i>${esc(p.sc.name)}</span>`).join('')}</div>`;
  const row = (l, vals) => `<div class="lt-r" style="grid-template-columns:minmax(0,1.3fr) repeat(${P.length},minmax(0,1fr))"><span>${l}</span>${vals.map((v) => `<b class="num small">${v ?? '—'}</b>`).join('')}</div>`;
  out.innerHTML = `<section class="card"><div class="card-head"><div><h3>Side by side</h3><span class="sub">Typical week ◆ and end-of-period projections ┅ (middle, with range)</span></div></div>
      <div class="lab-table lab-cmp">${head}${rows.map(([l, f, d]) => row(l, P.map((p) => (f(p) == null ? null : nf(f(p), d))))).join('')}
      ${row('Shooting % at end', P.map((p) => (p.shoot ? `${last(p.shoot, 'base')}%<span class="tiny muted" style="display:block">${last(p.shoot, 'cons')}–${last(p.shoot, 'opt')}</span>` : null)))}
      ${tids.map((id) => { const t = testById(id); return row(esc(t?.name || id), P.map((p) => (p.tests[id] ? `${esc(fmtVal(t, last(p.tests[id], 'base')))}<span class="tiny muted" style="display:block">${esc(fmtVal(t, last(p.tests[id], 'cons')))}–${esc(fmtVal(t, last(p.tests[id], 'opt')))}</span>` : null))); }).join('')}
      ${row('Period', P.map((p) => p.weeks + ' wk'))}</div></section>
    <section class="card"><div class="card-head"><div><h3>Training volume & load</h3></div></div><div class="chart" id="cmp-bars"></div></section>
    <section class="card"><div class="card-head"><div><h3>Development profile</h3><span class="sub">Each axis scaled 0–100 across the scenarios shown (relative, not absolute)</span></div></div><div id="cmp-radar"></div></section>
    <section class="card"><div class="card-head"><div><h3>Workload over time</h3><span class="sub">7-day load, week by week after switching</span></div>${kTag('f')}</div><div class="chart" id="cmp-load"></div></section>
    ${P.some((p) => p.shoot) ? `<section class="card"><div class="card-head"><div><h3>Shooting % paths</h3><span class="sub">Middle estimate for each scenario</span></div>${kTag('f')}</div><div class="chart" id="cmp-shot"></div></section>` : ''}`;
  // grouped bars: hours and shots per scenario
  const bars = (lbl, f, fmt) => { const vals = P.map(f), mx = Math.max(1, ...vals.map((v) => v || 0)); return `<div class="cmp-g"><span class="tiny muted">${lbl}</span>${P.map((p, i) => `<div class="cmp-b"><span class="small">${esc(p.sc.name)}</span><div><i style="width:${((vals[i] || 0) / mx) * 100}%;background:${col(i)}"></i></div><b class="tiny num">${vals[i] == null ? '—' : fmt(vals[i])}</b></div>`).join('')}</div>`; };
  $('#cmp-bars').innerHTML = bars('HOURS / WEEK', (p) => p.m?.hours, (v) => nf(v, 1)) + bars('LOAD / WEEK', (p) => p.m?.load, (v) => nf(v)) + bars('SHOTS / WEEK', (p) => p.shoot?.perWeek ?? p.m?.shotsWeek, (v) => nf(v)) + bars('REST DAYS', (p) => p.m?.restDays, (v) => v);
  // radar: relative 0-100 per axis
  const axes = [['Volume', (p) => p.m?.hours], ['Shooting reps', (p) => p.shoot?.perWeek ?? p.m?.shotsWeek], ['Strength', (p) => p.m?.strengthN], ['Conditioning', (p) => p.m?.condN], ['Recovery', (p) => p.m?.restDays], ['Variety', (p) => (p.m?.monotony ? 1 / p.m.monotony : null)]];
  const scale = axes.map(([, f]) => Math.max(...P.map((p) => f(p) || 0)) || 1), withPlan = P.filter((p) => p.m);
  $('#cmp-radar').innerHTML = withPlan.length >= 2 ? `${radar(axes.map(([l, f], i) => ({ label: l, v: Math.round(((f(withPlan[1]) || 0) / scale[i]) * 100), v2: Math.round(((f(withPlan[0]) || 0) / scale[i]) * 100) })), { compare: true, size: 260, label: 'Scenario profile' })}<div class="legend" style="justify-content:center"><span><i style="background:var(--muted)"></i>${esc(withPlan[0].sc.name)} (dashed)</span><span><i style="background:var(--accent)"></i>${esc(withPlan[1].sc.name)}</span></div>`
    : '<p class="muted small">Needs at least one saved training scenario to draw against your baseline.</p>';
  drawMulti($('#cmp-load'), P.filter((p) => p.m).map((p, i) => ({ name: p.sc.name, color: col(P.indexOf(p)), dash: i === 0, pts: p.m.trans.map((t, w) => ({ date: shiftIso(todayIso(), 7 * (w + 1)), v: t.acute })) })), { h: 190, yMin: 0, label: 'Weekly load by scenario' });
  if ($('#cmp-shot')) drawMulti($('#cmp-shot'), P.filter((p) => p.shoot).map((p) => ({ name: p.sc.name, color: col(P.indexOf(p)), dash: p.sc.id === 'base', pts: p.shoot.rows.map((r) => ({ date: shiftIso(todayIso(), 7 * r.w), v: r.base })) })), { h: 190, label: 'Shooting % middle paths', fmt: (v) => nf(v, 1) + '%' });
}

// ===================== Forecasts (continue your current trend) =====================
// Damped linear trend on your own measurements with an 80% prediction interval:
// value(h) = fit(last) + slope × Σ 0.92^i (i = 1..weeks) × 7 days;  ±1.28 × s × √(1 + 1/n + (x−x̄)²/Sxx).
const FC_H = [[4, '4 weeks'], [8, '8 weeks'], [12, '12 weeks'], [26, '6 months']];
function forecastSeries(pts, o = {}) {
  // pts: [{date, v}] oldest first. Needs o.minN points over o.minDays days.
  const n = pts.length, minN = o.minN || 4, minDays = o.minDays || 21;
  if (n < minN) return { ok: false, need: `${minN - n} more ${o.unitWord || 'result'}${minN - n > 1 ? 's' : ''}` };
  const d0 = pts[0].date, xs = pts.map((p) => daysBetween(d0, p.date)), span = xs[n - 1];
  if (span < minDays) return { ok: false, need: `results spread over ${minDays}+ days (now ${span})` };
  const fit = ols(xs, pts.map((p) => p.v)); if (!fit) return { ok: false, need: 'more varied dates' };
  const mx = mean(xs), sxx = sum(xs.map((x) => (x - mx) ** 2)), s = fit.se * Math.sqrt(sxx), lastX = xs[n - 1], base0 = fit.a + fit.b * lastX;
  const start = o.start || todayIso(), gap = daysBetween(pts[n - 1].date, start);
  const rows = [];
  for (let w = 0; w <= 26; w++) {
    let eff = gap; for (let i = 1; i <= w; i++) eff += 7 * 0.92 ** i;
    const x0 = lastX + gap + 7 * w, half = 1.28 * s * Math.sqrt(1 + 1 / n + (x0 - mx) ** 2 / sxx);
    let mid = base0 + fit.b * eff, lo = mid - half, hi = mid + half;
    if (o.clamp) [mid, lo, hi] = [mid, lo, hi].map((v) => clamp(v, o.clamp[0], o.clamp[1]));
    if (o.maxPer4 && o.cur != null) { const lim = (k) => Math.abs(o.cur) * (o.maxPer4 / 100) * ((7 * w + gap) / 28); [mid, lo, hi] = [mid, lo, hi].map((v) => clamp(v, o.cur - lim() - half, o.cur + lim() + half)); }
    rows.push({ w, date: shiftIso(start, 7 * w), base: r2(mid), cons: r2(Math.min(lo, hi)), opt: r2(Math.max(lo, hi)) });
  }
  return { ok: true, n, span, slopePerWeek: r2(fit.b * 7), rows };
}
function labForecasts() {
  return cached('labFc', () => {
    const out = [], today = todayIso();
    // shooting %: sessions with 20+ shots
    const sp = shotSessions().map((s) => ({ date: s.date, ...sessionTotals(s) })).filter((s) => s.a >= 20).map((s) => ({ date: s.date, v: r1(s.pct * 100) })).slice(-40);
    out.push({ id: 'shoot', name: 'Shooting % (sessions with 20+ shots)', fmt: (v) => nf(v, 1) + '%', hist: sp, fc: forecastSeries(sp, { minN: 8, minDays: 21, unitWord: 'shooting session', clamp: [0, 100] }), higher: true });
    // weekly training hours (last 12 complete weeks)
    const weeks = []; for (let i = 12; i >= 1; i--) { const mon = shiftIso(mondayOf(today), -7 * i), ds = Array.from({ length: 7 }, (_, j) => shiftIso(mon, j)); weeks.push({ date: shiftIso(mon, 6), v: r1(sum(ds.flatMap((d) => exList(d).map((x) => Number(x.mins) || 0))) / 60) }); }
    const firstAct = allDayKeys().find(isActive), wk = firstAct ? weeks.filter((w) => w.date >= firstAct) : [];
    out.push({ id: 'hours', name: 'Training hours per week', fmt: (v) => nf(v, 1) + ' h', hist: wk, fc: forecastSeries(wk, { minN: 4, minDays: 21, unitWord: 'week of training', clamp: [0, 40] }), higher: true });
    for (const t of allTests()) {
      const rs = resultsOf(t.id); if (!rs.length) continue;
      const pts = rs.map((r) => ({ date: r.date, v: r.value }));
      out.push({ id: 'test:' + t.id, name: t.name, fmt: (v) => fmtVal(t, v), hist: pts, fc: forecastSeries(pts, { minN: 4, minDays: 21, unitWord: 'result', cur: rs[rs.length - 1].value, maxPer4: ATH_MAX[t.group] || ATH_MAX.Custom, clamp: [0, Infinity] }), higher: t.better !== 'lower' });
    }
    return out;
  });
}
LAB.forecast = (el) => {
  const F = labForecasts(), ok = F.filter((f) => f.fc.ok), no = F.filter((f) => !f.fc.ok), h = Number(ui('fcH', 12));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Development forecasts</h3><span class="sub">What happens if your current trend simply continues. Not a goal, not a guarantee.</span></div>${kTag('f')}</div>
      <div class="row-between">${seg('fcH', FC_H.map(([w, l]) => [w, l]), h)}<span class="tiny muted">${ok.length} of ${F.length || 0} metrics have enough data</span></div>
      <p class="tiny muted" style="margin-top:8px">● dots are your real measurements. The dashed line continues your trend, slowing a little each week; the shaded band is an 80% range that widens the further out it goes.</p></section>
    ${ok.map((f, i) => { const r = f.fc.rows[h], dir = f.fc.slopePerWeek; return `<section class="card"><div class="card-head"><div><h3>${esc(f.name)}</h3><span class="sub">${f.fc.n} measurements over ${f.fc.span} days · trend ${dir > 0 ? '+' : ''}${esc(f.fmt(dir))}/week ◆</span></div>
      <div style="text-align:right"><b class="num" style="font-size:20px">${esc(f.fmt(r.base))}</b><span class="tiny muted" style="display:block">${esc(f.fmt(r.cons))} – ${esc(f.fmt(r.opt))} in ${h === 26 ? '6 months' : h + ' weeks'}</span></div></div>
      <div class="chart" id="fc-${i}"></div><div class="lab-table four" style="margin-top:8px"><div class="lt-h"><span></span>${FC_H.map(([, l]) => `<span>${l}</span>`).join('')}</div>
      <div class="lt-r"><span>Middle</span>${FC_H.map(([w]) => `<b class="num small">${esc(f.fmt(f.fc.rows[w].base))}</b>`).join('')}</div><div class="lt-r"><span>80% range</span>${FC_H.map(([w]) => `<span class="tiny num">${esc(f.fmt(f.fc.rows[w].cons))}–${esc(f.fmt(f.fc.rows[w].opt))}</span>`).join('')}</div></div></section>`; }).join('')}
    ${no.length || !F.length ? `<section class="card"><div class="card-head"><div><h3>Not enough data yet</h3><span class="sub">Forecasts appear once there's enough real history. Nothing is guessed.</span></div></div>
      ${F.length ? `<div class="list">${no.map((f) => `<div class="li"><span class="small">${esc(f.name)}</span><span class="tiny muted">needs ${esc(f.fc.need)}</span></div>`).join('')}</div>` : emptyState('No measurements yet', 'Log shooting sessions, workouts or test results to unlock forecasts.', 'chart')}</section>` : ''}
    <section class="card">${formulaBox(['Fit: least-squares line through your measurements over time.', 'Forecast = fitted value at your last measurement + weekly trend × 0.92^week (the trend fades a little each week, so it does not run away).', '80% range = ±1.28 × residual spread × √(1 + 1/n + distance² / spread of dates): wider for noisy data, few points and long horizons.', 'Tests are also limited to the same per-4-week caps as the athletic simulator. Shooting % stays within 0–100.', 'Needs: shooting 8 sessions over 21+ days; tests 4 results over 21+ days; training hours 4 weeks.'])}</section>`;
  ok.forEach((f, i) => drawFan($(`#fc-${i}`), { hist: f.hist.slice(-30), fmt: f.fmt, label: f.name + ' forecast', lines: [{ name: 'Trend continues (middle)', color: 'var(--purple)', dash: '7 4', pts: f.fc.rows.slice(0, h + 1).map((r) => ({ date: r.date, v: r.base })) }], band: { name: '80% range', color: 'var(--purple)', lo: f.fc.rows.slice(0, h + 1).map((r) => ({ date: r.date, v: r.cons })), hi: f.fc.rows.slice(0, h + 1).map((r) => ({ date: r.date, v: r.opt })) } }));
};

// ===================== History & accuracy (predicted vs actual) =====================
function actualShootPct(date, win = 14) { const xs = shotSessions().filter((s) => s.date <= date && daysBetween(s.date, date) < win).map(sessionTotals); const a = sum(xs.map((x) => x.a)); return a >= 20 ? r1((sum(xs.map((x) => x.m)) / a) * 100) : null; }
function actualTest(id, date, after) { const rs = resultsOf(id).filter((r) => r.date > after && Math.abs(daysBetween(r.date, date)) <= 10); return rs.length ? rs.sort((a, b) => Math.abs(daysBetween(a.date, date)) - Math.abs(daysBetween(b.date, date)))[0] : null; }
/** Checkpoints whose date has passed, with the real value and whether it landed in the projected range. */
function labAccuracy(sc) {
  const res = sc.results, today = todayIso(), out = { checks: [], plan: null, next: null };
  if (!res) return out;
  const rows = res.metric === 'plan' ? res.shootRows || [] : res.rows || [];
  for (const r of rows) {
    if (!r.w) continue;
    if (r.date > today) { out.next = out.next || r.date; continue; }
    let act = null, label = '';
    if (res.metric === 'test:' + sc.inputs?.test || res.metric?.startsWith('test:')) { const id = res.metric.slice(5), x = actualTest(id, r.date, sc.snap.date); act = x?.value ?? null; label = testById(id)?.name || id; }
    else { act = actualShootPct(r.date); label = 'Shooting %'; }
    const lo = Math.min(r.cons, r.opt), hi = Math.max(r.cons, r.opt);
    out.checks.push({ w: r.w, date: r.date, label, pred: r, act, verdict: act == null ? 'none' : act < lo ? 'below' : act > hi ? 'above' : 'inside' });
  }
  if (res.metric === 'plan') {
    const days = []; for (let d = shiftIso(sc.snap.date, 1); d <= today && days.length < 182; d = shiftIso(d, 1)) days.push(d);
    if (days.length >= 7) { const wks = days.length / 7, ss = sessionsIn(days); out.plan = { weeks: r1(wks), hours: r1(sum(ss.map((x) => Number(x.mins) || 0)) / 60 / wks), load: Math.round(sum(ss.map((x) => x.load)) / wks), restDays: r1((days.length - days.filter(isActive).length) / wks) }; }
    else out.next = out.next || shiftIso(sc.snap.date, 7);
  }
  return out;
}
LAB.history = (el) => {
  const scs = [...sim().scenarios].sort((a, b) => b.created.localeCompare(a.created)), A = scs.map((s) => ({ s, a: labAccuracy(s) }));
  const all = A.flatMap((x) => x.a.checks.filter((c) => c.verdict !== 'none')), inside = all.filter((c) => c.verdict === 'inside').length;
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>How accurate have simulations been?</h3><span class="sub">Each saved projection is checked against what really happened once its date passes</span></div></div>
      ${all.length ? `<div class="kpis four"><div class="kpi"><small>Checkpoints scored</small><b>${all.length}</b></div><div class="kpi"><small>Inside the range</small><b>${Math.round((inside / all.length) * 100)}%</b><span class="delta tiny muted">80% ranges should catch ~8 in 10</span></div><div class="kpi"><small>Above range</small><b>${all.filter((c) => c.verdict === 'above').length}</b></div><div class="kpi"><small>Below range</small><b>${all.filter((c) => c.verdict === 'below').length}</b></div></div>`
    : `<p class="muted small">${scs.length ? `No checkpoint has passed yet. The first one is ${esc(fmtDL(A.map((x) => x.a.next).filter(Boolean).sort()[0] || shiftIso(todayIso(), 28)))}.` : 'Save a simulation and come back after its first checkpoint (4 weeks for shooting and tests, 1 week for training plans).'}</p>`}</section>
    ${scs.length ? A.map(({ s, a }) => `<section class="card"><div class="card-head"><div><h3>${esc(s.name)}</h3><span class="sub">${esc(SC_KIND[s.kind] || s.kind)} · saved ${esc(fmtDL(s.created.slice(0, 10)))} · baseline ${esc(fmtD(s.snap.date))}</span></div><div class="row" style="gap:4px"><button type="button" class="chip" data-act="lab-open" data-id="${s.id}">Open</button><button type="button" class="chip" data-act="lab-more" data-id="${s.id}" aria-label="More options">⋯</button></div></div>
      <p class="small muted">${esc(s.summary || '')}</p>
      <details class="lab-details"><summary>Variables & assumptions</summary><ul>${histVars(s).map((v) => `<li>${esc(v)}</li>`).join('')}</ul></details>
      ${a.checks.length ? `<div class="lab-table four" style="margin-top:8px"><div class="lt-h"><span>Checkpoint</span><span>Projected</span><span>Actual ●</span><span>Result</span></div>${a.checks.map((c) => `<div class="lt-r"><span>${c.w === 26 ? '6 months' : 'Week ' + c.w}<span class="tiny muted" style="display:block">${esc(fmtD(c.date))} · ${esc(c.label)}</span></span><span class="tiny num">${c.pred.cons}–${c.pred.opt}</span><b class="num small">${c.act ?? '—'}</b><span class="small ${c.verdict === 'inside' ? 'up' : c.verdict === 'none' ? 'muted' : 'down'}">${{ inside: '✓ in range', above: '↑ beat it', below: '↓ under', none: 'no data near date' }[c.verdict]}</span></div>`).join('')}</div>` : ''}
      ${a.plan ? `<div class="lab-table four" style="margin-top:8px"><div class="lt-h"><span>Since saving (${a.plan.weeks} wk)</span><span>Planned</span><span>Actual ●</span><span></span></div><div class="lt-r"><span>Hours / wk</span><span class="num">${s.results.hours}</span><b class="num">${a.plan.hours}</b><span class="tiny muted">${pctTxt(s.results.hours ? a.plan.hours / s.results.hours : null)} of plan</span></div><div class="lt-r"><span>Load / wk</span><span class="num">${nf(s.results.load)}</span><b class="num">${nf(a.plan.load)}</b><span></span></div><div class="lt-r"><span>Rest days / wk</span><span class="num">${s.results.restDays}</span><b class="num">${a.plan.restDays}</b><span></span></div></div>` : ''}
      ${!a.checks.length && !a.plan ? `<p class="tiny muted">${a.next ? `First check on ${esc(fmtDL(a.next))}.` : 'No checkpoints in this simulation.'}</p>` : ''}
      ${planOnCal(s.id) ? `<p class="tiny" style="margin-top:6px">📅 ${planOnCal(s.id)} calendar events from this plan</p>` : ''}</section>`).join('') : ''}`;
};
function histVars(s) {
  const i = s.inputs, out = [];
  if (s.kind === 'build' || s.kind === 'train') { const p = sanePlan(s.kind === 'build' ? i.mod : i.B); out.push(`${p.days} training days; ` + SIM_TYPES.filter(([k]) => p.items[k].n).map(([k, l]) => `${l} ${p.items[k].n}×${p.items[k].mins} min RPE ${p.items[k].rpe}`).join(', ')); out.push(`${p.attempts} shots per shooting session; ${i.weeks || 8} weeks${i.sleepH ? `; sleep ${i.sleepH} h` : ''}`); }
  if (s.kind === 'shoot') out.push(`Now ${i.sessions}×${i.attempts}, scenario ${i.nSessions}×${i.nAttempts} shots a week; start ${i.pct}%, target ${i.target}%; ${i.weeks} weeks; rates ${i.useAssume || !s.snap.shooting.trend ? 'assumed ' + (i.assume || SHOOT_ASSUME).join('/') : 'from history'}`);
  if (s.kind === 'ath') out.push(`${testById(i.test)?.name || i.test}: now ${i.cur}, target ${i.target}; focus sessions ${i.focusNow} → ${i.focusNew}; ${i.weeks} weeks`);
  out.push(`Baseline: ${s.snap.sessions28} sessions in the 28 days before ${fmtD(s.snap.date)}${s.snap.isDefault ? ' (template)' : ''}`, `Model ${s.model}`);
  return out;
}

// ===================== Turn a scenario into a proposed calendar plan =====================
const PLAN_EV = { shooting: 'shooting', handles: 'skill', finishing: 'skill', skill: 'skill', strength: 'lift', conditioning: 'conditioning', practice: 'practice' };
const planOnCal = (simId) => (plan().events || []).filter((e) => e.src === 'lab' && e.simId === simId).length;
function proposeEvents(p, simId, name, start, weeks) {
  const wk = weekSchedule(p), until = shiftIso(start, 7 * weeks - 1), out = [];
  wk.forEach((day, i) => { const date = shiftIso(start, i); day.forEach((s, j) => out.push({ id: uid('e'), title: `${simType(s.type)[1]} · Lab plan`, type: PLAN_EV[s.type] || 'workout', date, start: null, end: null, mins: s.mins, remind: 0, notes: `Proposed from the simulation "${name}" (RPE ${s.rpe}). Not done until you check it off.`, recur: { days: [parseIso(date).getDay()], until }, skip: [], src: 'lab', simId, order: j })); });
  return out;
}
ACTIONS['lab-plan'] = (b) => {
  const kind = b.dataset.kind || 'build', sc = b.dataset.id ? sim().scenarios.find((x) => x.id === b.dataset.id) : openSc(kind);
  const p = sc ? scPlan(sc) : kind === 'train' ? labDraft('train').B : labDraft('build').mod, simId = sc?.id || 'draft-' + kind, name = sc?.name || 'Unsaved scenario';
  if (!p) return toast('Only training scenarios can become a calendar plan');
  const nextMon = shiftIso(mondayOf(todayIso()), 7), weeks = clamp(Number(sc?.inputs.weeks || labDraft(kind).weeks) || 4, 1, 12);
  const ev = proposeEvents(p, simId, name, nextMon, weeks), existing = planOnCal(simId);
  if (!ev.length) return toast('This scenario has no sessions to schedule');
  const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  openSheet('Proposed plan', `<p class="small">From <b>${esc(name)}</b>: ${ev.length} weekly sessions, every week from <b>${esc(fmtDL(nextMon))}</b> for ${weeks} weeks. Nothing is added until you approve.</p>
    <div class="list">${DN.map((d, i) => { const xs = ev.filter((e) => e.date === shiftIso(nextMon, i)); return `<div class="li"><b class="small">${d}</b><span class="small" style="text-align:right">${xs.length ? xs.map((e) => `${esc(simType(Object.keys(PLAN_EV).find((k) => e.title.startsWith(simType(k)[1])) || 'skill')[1])} ${e.mins}m`).join(', ') : '<span class="muted">Rest</span>'}</span></div>`; }).join('')}</div>
    ${existing ? `<p class="notice warn small">${existing} events from this simulation are already on your calendar. Approving replaces them.</p>` : ''}
    <p class="tiny muted">They show up as planned items in your calendar, Home and Gameplan. A session only counts as done when you check it off or log the workout. Your goals and logged workouts are not changed.</p>
    <label class="check"><input type="checkbox" id="lp-ok"> I approve adding these to my calendar</label>
    <button type="button" class="btn primary block" id="lp-go" disabled>Add to calendar</button>`, (d) => {
    $('#lp-ok', d).addEventListener('change', (e) => { $('#lp-go', d).disabled = !e.target.checked; });
    $('#lp-go', d).addEventListener('click', () => {
      if (!$('#lp-ok', d).checked) return;
      const P = plan(); P.events = (P.events || []).filter((e) => !(e.src === 'lab' && e.simId === simId)).concat(ev); persist('aos-plan'); closeSheet(); refresh(); toast(`${ev.length} sessions added to your calendar`);
    });
  });
};
ACTIONS['lab-unplan'] = (b) => confirmSheet('Remove the Lab plan sessions from your calendar? Workouts you already logged stay.', 'Remove', () => { const P = plan(); const n = (P.events || []).length; P.events = (P.events || []).filter((e) => !(e.src === 'lab' && e.simId === b.dataset.id)); persist('aos-plan'); refresh(); toast(`Removed ${n - P.events.length} sessions`); });
// Add the plan buttons under the builder and training results.
for (const k of ['build', 'train']) {
  const base = LAB_OUT[k];
  LAB_OUT[k] = () => {
    base(); const out = $('#lab-out'); if (!out) return;
    const sc = openSc(k), id = sc?.id || 'draft-' + k, n = planOnCal(id);
    out.insertAdjacentHTML('beforeend', `<section class="card"><div class="card-head"><div><h3>Use this as a plan?</h3><span class="sub">Turns ${k === 'train' ? 'schedule B' : 'the scenario'} into proposed calendar sessions. You review and approve first.</span></div></div>
      <div class="row"><button type="button" class="btn sm primary" data-act="lab-plan" data-kind="${k}">Propose a calendar plan…</button>${n ? `<button type="button" class="btn sm danger" data-act="lab-unplan" data-id="${id}">Remove ${n} planned sessions</button>` : ''}<button type="button" class="btn sm" data-go="lab-ask">Ask AI about it</button></div></section>`);
  };
}

// ===================== AI simulation assistant =====================
// One AI call per question. The engine computes several standard variants first, so the answer is grounded in real,
// reproducible numbers; the model only explains and picks which computed variant fits the question.
const LAB_QS = ['What if I shoot 1,000 shots per week?', 'What if I train six days per week instead of four?', 'What if I dedicate more time to strength training?', 'What if I focus on conditioning for eight weeks?', 'What if I prioritize recovery?', 'Which of my saved schedules is more sustainable?', 'Which scenario best aligns with my current goals?'];
function labVariants() {
  const s = labSnapshot(), V = [['current', 'Current plan (baseline)', () => {}], ['shoot1000', 'Shoot ~1,000 a week', PRESETS.shoot1000], ['six', 'Train 6 days', PRESETS.six], ['strength2', '+2 strength sessions', PRESETS.strength2], ['cond8', '+2 conditioning for 8 weeks', PRESETS.cond8], ['sleep', 'Prioritize recovery', PRESETS.sleep], ['rest', 'One more rest day', PRESETS.rest]];
  const bd = ui('labD', {}).build;
  const vs = V.map(([id, name, fn]) => { const d = { mod: clonePlan(s.plan), sleepH: s.sleepH ?? 8, weeks: 12 }; fn(d.mod, d); return { id, name, plan: sanePlan(d.mod), weeks: d.weeks, sleepH: d.sleepH }; });
  if (bd) vs.push({ id: 'builder', name: 'Your builder draft', plan: sanePlan(bd.mod), weeks: Number(bd.weeks) || 12, sleepH: bd.sleepH });
  for (const sc of sim().scenarios.filter((x) => scPlan(x)).slice(-5)) vs.push({ id: 'saved:' + sc.id, name: 'Saved: ' + sc.name, plan: sanePlan(scPlan(sc)), weeks: Number(sc.inputs.weeks) || 12, sleepH: sc.inputs.sleepH, snap: sc.snap });
  return vs.map((v) => { const pr = scProfile({ id: v.id, name: v.name, kind: 'build', created: '', updated: '', inputs: { mod: v.plan, weeks: v.weeks, sleepH: v.sleepH }, snap: v.snap || s }), m = pr.m, last = (x) => x.rows[x.rows.length - 1];
    return { id: v.id, name: v.name, weeks: v.weeks, sleepH: v.sleepH ?? null, trainDays: m.trainDays, sessions: m.sessions, hoursPerWeek: m.hours, loadPerWeek: m.load, restDays: m.restDays, longestStreak: m.maxStreak, hardDaysInRow: m.hardStreak, monotony: m.monotony, switchWeekACWR: m.acwrFirst, peakACWR: m.acwrPeak, shotsPerWeek: m.shotsWeek, strengthPerWeek: m.strengthN, conditioningPerWeek: m.condN,
      shootingPctAtEnd: pr.shoot ? { conservative: last(pr.shoot).cons, middle: last(pr.shoot).base, optimistic: last(pr.shoot).opt, rateSource: pr.shoot.src } : null,
      testsAtEnd: Object.fromEntries(Object.entries(pr.tests).map(([k, p]) => [k, { now: p.cur, conservative: last(p).cons, middle: last(p).base, optimistic: last(p).opt, rateSource: p.src }])), tradeoffs: labTradeoffs(planMetrics(s.plan, s), m, v.sleepH).map((t) => t[1]) }; });
}
function labAIContext() {
  const s = labSnapshot(), goals = (doc('aos-goals').goals || []).filter((g) => goalState(g).status !== 'done' && goalState(g).status !== 'archived').slice(0, 6).map((g) => ({ title: g.title, target: g.target, by: g.date || null, source: g.source || 'manual' }));
  return {
    baseline: { date: s.date, isTemplate: s.isDefault, sessionsLast28Days: s.sessions28, activeDaysLast28: s.activeDays28, targetDaysPerWeek: s.targetDays, sleepAvg14d: s.sleepH, plan: s.plan, loadHistoryDays: s.history, currentACWR: loadStats().acwr,
      shooting: { pct30d: s.shooting.pct, attemptsPerWeek: s.shooting.attemptsPerWeek, sessions: s.shooting.sessions, trendPer1000Shots: s.shooting.trend }, tests: Object.values(s.tests).map((t) => ({ name: t.name, now: t.cur, unit: t.unit, results: t.n, ratePer4WeeksPct: t.rate })) },
    goals, variants: labVariants(), forecasts: labForecasts().filter((f) => f.fc.ok).map((f) => ({ metric: f.name, trendPerWeek: f.fc.slopePerWeek, in12Weeks: { low: f.fc.rows[12].cons, mid: f.fc.rows[12].base, high: f.fc.rows[12].opt } })),
  };
}
const LAB_AI_SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'variant', 'changed', 'predicts', 'why', 'assumptions', 'uncertainties', 'tradeoffs', 'basedOn'], properties: { headline: { type: 'string' }, variant: { type: 'string' }, changed: { type: 'array', items: { type: 'string' } }, predicts: { type: 'string' }, why: { type: 'string' }, assumptions: { type: 'array', items: { type: 'string' } }, uncertainties: { type: 'array', items: { type: 'string' } }, tradeoffs: { type: 'array', items: { type: 'string' } }, basedOn: { type: 'string' } } };
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
LAB.ask = (el) => {
  const hist = (sim().ai || []).slice(-6).reverse();
  el.innerHTML = `<section class="card ai"><div class="card-head"><div><h3>Simulation assistant <span class="ai-badge">AI</span></h3><span class="sub">Ask a what-if. It answers from simulations the app calculates on your real data.</span></div></div>
    ${aiOn() ? `<div class="chips">${LAB_QS.map((q) => `<button type="button" class="chip" data-labq="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="lab-q" maxlength="300" placeholder="What if I…" aria-label="Your question"><button type="button" class="btn primary" data-act="lab-ask">Ask</button></div>` : aiUnavailable()}
    <p class="tiny muted" style="margin-top:8px">Each question is one AI request. Answers are saved here, so asking the same thing about the same data again costs nothing.</p></section>
    <div id="lab-ai-out">${hist.map(aiCard).join('')}</div>`;
};
document.addEventListener('click', (e) => { const q = e.target.closest('[data-labq]'); if (q) { $('#lab-q').value = q.dataset.labq; ACTIONS['lab-ask']($('[data-act="lab-ask"]')); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'lab-q') ACTIONS['lab-ask']($('[data-act="lab-ask"]')); });
const aiCard = (a) => `<section class="card ai"><div class="card-head"><div><span class="tiny muted">${esc(fmtDL(a.date))} · YOU ASKED</span><h3 style="margin-top:2px">${esc(a.q)}</h3></div>${kTag('h')}</div>
  <div class="ai-out"><b style="font-family:var(--f-display);font-size:17px">${esc(a.r.headline)}</b>
  <p class="small"><b>Prediction:</b> ${esc(a.r.predicts)}</p><p class="small"><b>Why it differs:</b> ${esc(a.r.why)}</p>
  ${[['What changed', a.r.changed], ['Tradeoffs', a.r.tradeoffs], ['Assumptions', a.r.assumptions], ['Uncertainties', a.r.uncertainties]].map(([h, xs]) => (xs?.length ? `<h4 class="lab-h4" style="margin-top:10px">${h}</h4><ul class="small" style="margin:0;padding-left:18px">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '')).join('')}
  <p class="tiny muted" style="margin-top:8px">Based on: ${esc(a.r.basedOn)}</p></div>
  ${a.variant && PRESETS[a.r.variant] ? `<button type="button" class="btn sm" data-act="lab-preset" data-p="${esc(a.r.variant)}" style="margin-top:8px">Open this scenario in the builder</button>` : ''}</section>`;
ACTIONS['lab-ask'] = async (b) => {
  const q = ($('#lab-q')?.value || '').trim(); if (!q) return toast('Type a question first');
  const ctx = labAIContext(), key = hashStr(q.toLowerCase() + JSON.stringify(ctx)), S = sim(); S.ai = S.ai || [];
  const hit = S.ai.find((x) => x.key === key);
  if (hit) { $('#lab-ai-out').innerHTML = aiCard(hit) + $('#lab-ai-out').innerHTML.replace(aiCard(hit), ''); return toast('Same question, same data: saved answer'); }
  b.disabled = true; b.textContent = 'Thinking…';
  try {
    const r = await askAI(`${AI_RULES}
You are the Performance Simulation assistant in Athlete OS. The app has ALREADY computed every simulation in "variants" with deterministic formulas on the athlete's real data; you must not invent other numbers.
Answer the athlete's what-if question:
1. Pick the variant id that best matches the question (or "builder"/"saved:…" if the question is about those, or "current"). If none matches well, say so in the headline and explain using the closest variants; suggest building it in the Scenario builder.
2. "changed": the variables that differ from the baseline (use the plan numbers).
3. "predicts": what the simulation shows (hours, load, ACWR, rest, shots, shooting % range, test ranges), quoting the computed numbers.
4. "why": why results differ from the baseline.
5. "assumptions" and "uncertainties": include rateSource ("assumption" = general, not their data), missing data, and that projections are hypothetical, never guaranteed. Mention goals when relevant.
6. "tradeoffs": time, recovery, load spikes, competing priorities.
No medical diagnoses or injury predictions. Keep each list to 2–4 short items. "basedOn": which data you used.
Question: <<${q.slice(0, 300)}>>
Data: ${JSON.stringify(ctx)}`, true, { schema: LAB_AI_SCHEMA });
    const rec = { key, q, date: todayIso(), r, variant: r.variant };
    S.ai = [...S.ai.filter((x) => x.key !== key), rec].slice(-20); labSaveDoc();
    $('#lab-ai-out').innerHTML = aiCard(rec) + $('#lab-ai-out').innerHTML;
  } catch (e) { toast(aiError(e)); } finally { b.disabled = false; b.textContent = 'Ask'; }
};

// ===================== Dashboard additions: history, comparisons, goals, plan =====================
{
  const base = LAB.dash;
  LAB.dash = (el) => {
    base(el);
    const scs = sim().scenarios, A = scs.map(labAccuracy).flatMap((a) => a.checks.filter((c) => c.verdict !== 'none'));
    const goals = (doc('aos-goals').goals || []).filter((g) => g.source?.startsWith('test:') && goalState(g).status !== 'done' && testById(g.source.slice(5))).slice(0, 3);
    const labEv = (plan().events || []).filter((e) => e.src === 'lab'), F = labForecasts().filter((f) => f.fc.ok);
    el.insertAdjacentHTML('beforeend', `<section class="card"><div class="card-head"><div><h3>Forecasts, comparisons & history</h3><span class="sub">Where your current trend is heading and how past simulations held up</span></div></div>
      <div class="kpis four"><button type="button" class="kpi lab-kbtn" data-go="lab-forecast"><small>Forecasts ready</small><b>${F.length}</b><span class="delta tiny muted">${F.length ? esc(F.slice(0, 2).map((f) => f.name.split(' (')[0]).join(', ')) : 'Need more data'}</span></button>
      <button type="button" class="kpi lab-kbtn" data-go="lab-compare"><small>Saved to compare</small><b>${scs.length}</b></button>
      <button type="button" class="kpi lab-kbtn" data-go="lab-history"><small>Checkpoints scored</small><b>${A.length}</b><span class="delta tiny muted">${A.length ? Math.round((A.filter((c) => c.verdict === 'inside').length / A.length) * 100) + '% in range' : 'none due yet'}</span></button>
      <button type="button" class="kpi lab-kbtn" data-go="lab-ask"><small>AI assistant</small><b style="font-size:17px">${aiOn() ? 'Ask a what-if' : 'Inside Claude'}</b></button></div>
      ${labEv.length ? `<p class="small" style="margin-top:10px">📅 ${labEv.length} sessions from Lab plans are on your calendar. <button type="button" class="linkish" data-go="train-plan">View calendar</button></p>` : ''}
      ${goals.length ? `<div class="hr"></div><span class="tiny muted">SIMULATE A GOAL</span><div class="chips" style="margin-top:6px">${goals.map((g) => `<button type="button" class="chip" data-act="lab-goal" data-id="${g.id}">${esc(g.title)}</button>`).join('')}</div>` : ''}</section>`);
  };
}
ACTIONS['lab-goal'] = (b) => {
  const g = (doc('aos-goals').goals || []).find((x) => x.id === b.dataset.id); if (!g) return;
  const s = labSnapshot(), id = g.source.slice(5), d = athDefaults(s, id); d.target = g.target;
  if (g.date) d.weeks = clamp(Math.ceil(daysBetween(todayIso(), g.date) / 7), 2, 26);
  const o = ui('labOpen', {}); delete o.ath; setUi('labOpen', o); saveDraft('ath', d); go('lab', 'ath');
};
