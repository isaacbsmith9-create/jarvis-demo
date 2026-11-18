// ===================== Visual dashboard + Coach hand-off =====================
// Home gets a "Your numbers" chart dashboard (all from logged data; empty charts say what to log).
// The AI Coach moves to the athlete's new app: its tab is hidden, its Home card removed, and the Coach screen is a
// placeholder until that app is connected. The coach code stays in place so reconnecting is a small change.
VIEWS.find((v) => v[0] === 'coach')[3] = true;
{ const i = WIDGETS.findIndex((w) => w[0] === 'ai'); if (i >= 0) WIDGETS.splice(i, 1); const j = DEFAULT_W.indexOf('ai'); if (j >= 0) DEFAULT_W.splice(j, 1); }
RENDER.coach = (el) => { el.innerHTML = `<section class="card">${emptyState('Coach is moving to your new app', 'Your AI coach will live in the coaching app you are building and connect here when it is ready. Your training, food and recovery data is already shared, so it will see everything.', 'spark', `<div class="row" style="justify-content:center"><a class="btn sm" data-ml href="btc.html">Open Training Center</a><a class="btn sm" data-ml href="macrolens.html#coach-schedule">MacroLens fuel tools</a></div>`)}</section>`; };

WIDGETS.unshift(['charts', 'Your numbers (charts)']);
DEFAULT_W.splice(1, 0, 'charts');
const VZ_CAT = Object.fromEntries(CATS.map((c) => [c[0], c]));
function homeCharts(el) {
  el.classList.add('span2');
  const t = todayIso(), d14 = lastNDays(14), d7 = lastNDays(7), short = (d) => fmtD(d).replace(/^[A-Za-z]+ /, '');
  const box = (id, title, sub) => `<div class="vz"><div class="vz-h"><b>${title}</b><span class="tiny muted">${sub}</span></div><div class="chart" id="${id}"></div></div>`;
  el.innerHTML = `<div class="card-head"><div><h3>Your numbers</h3><span class="sub">Training, load, recovery, fuel and shooting at a glance</span></div><button type="button" class="btn sm" data-go="analytics">All analytics ›</button></div>
    <div class="vz-grid">${box('vz-mins', 'Training minutes', 'last 14 days')}${box('vz-load', 'Training load', '7-day vs usual, 10 weeks')}${box('vz-sleep', 'Sleep', 'hours, last 14 nights')}${box('vz-ready', 'Recovery score', 'last 14 days')}${box('vz-cal', 'Calories vs target', 'last 7 days')}${box('vz-pro', 'Protein vs target', 'grams, last 7 days')}${box('vz-shot', 'Shooting %', 'last 12 sessions')}<div class="vz"><div class="vz-h"><b>Training mix</b><span class="tiny muted">last 28 days</span></div><div id="vz-mix" style="padding:8px 0"></div></div></div>`;
  const none = (id, msg) => { const c = $('#' + id, el); if (c) c.innerHTML = `<p class="tiny muted vz-none">${msg}</p>`; };
  // 1. minutes by category
  const mg = d14.map((d) => { const tr = trainingOf(d); return { label: short(d), tip: fmtDL(d), segs: Object.entries(tr.by).filter(([, v]) => v).map(([k, v]) => ({ v, color: VZ_CAT[k]?.[2] || 'var(--accent)', name: VZ_CAT[k]?.[1] })) }; });
  if (mg.some((g) => g.segs.length)) drawBars($('#vz-mins', el), mg, { h: 150, fmt: (v) => Math.round(v) + ' min', label: 'Training minutes per day' }); else none('vz-mins', 'Log workouts to fill this in.');
  // 2. load: acute vs chronic, weekly
  const wk = Array.from({ length: 10 }, (_, i) => shiftIso(t, -7 * (9 - i)));
  const ls = wk.map((d) => ({ d, s: loadStats(d) }));
  if (ls.some((x) => x.s.acute)) drawMulti($('#vz-load', el), [{ name: 'Last 7 days', color: 'var(--purple)', area: true, pts: ls.map((x) => ({ date: x.d, v: x.s.acute })) }, { name: 'Usual week (28-day avg)', color: 'var(--accent)', dash: true, pts: ls.map((x) => ({ date: x.d, v: x.s.chronic })) }], { h: 150, yMin: 0, label: 'Training load' }); else none('vz-load', 'Load appears once workouts are logged.');
  // 3. sleep
  const sl = d14.map((d) => ({ date: d, v: recoveryInputs(d).sleepH })).filter((p) => p.v != null);
  if (sl.length) drawLine($('#vz-sleep', el), sl, { h: 150, color: '#8b5cff', goal: 8, fmt: (v) => r1(v) + ' h', bands: [[8, 10, 'var(--good)']] }); else none('vz-sleep', 'Add sleep in your morning check-in.');
  // 4. recovery
  const rc = d14.map((d) => ({ date: d, v: recoveryScore(d)?.score ?? null })).filter((p) => p.v != null);
  if (rc.length) drawLine($('#vz-ready', el), rc, { h: 150, color: 'var(--good)', yMin: 0, yMax: 100, fmt: (v) => Math.round(v) + '/100', bands: [[0, 45, 'var(--danger)'], [70, 100, 'var(--good)']] }); else none('vz-ready', 'Recovery scores come from check-ins.');
  // 5-6. calories / protein vs target
  const fd = d7.filter(hasFood);
  const fuel = (id, key, unit, color) => {
    if (!fd.length) return none(id, 'Log meals in MacroLens to see this.');
    drawBars($('#' + id, el), d7.map((d) => ({ label: short(d), tip: fmtDL(d), segs: hasFood(d) ? [{ v: totalsOf(d)[key], color, name: key }] : [] })), { h: 150, goal: targets(t)[key], fmt: (v) => Math.round(v) + unit, label: key + ' per day' });
  };
  fuel('vz-cal', 'calories', ' kcal', 'var(--carbs)'); fuel('vz-pro', 'protein', ' g', 'var(--protein)');
  // 7. shooting %
  const sp = shotSessions().map((s) => ({ date: s.date, ...sessionTotals(s) })).filter((s) => s.a >= 10).slice(-12).map((s) => ({ date: s.date, v: r1(s.pct * 100), tip: `${s.m}/${s.a}` }));
  if (sp.length) drawLine($('#vz-shot', el), sp, { h: 150, color: '#22c3ee', fmt: (v) => r1(v) + '%' }); else none('vz-shot', 'Log a shooting session in Hoops.');
  // 8. mix donut
  const mix = { hoops: 0, strength: 0, cond: 0, other: 0 }; for (const d of lastNDays(28)) { const b = trainingOf(d).by; for (const k in b) mix[k] += b[k]; }
  const parts = Object.entries(mix).filter(([, v]) => v).map(([k, v]) => ({ label: VZ_CAT[k][1], v, color: VZ_CAT[k][2] }));
  const mc = $('#vz-mix', el); if (mc) mc.innerHTML = parts.length ? donut(parts, { size: 120, fmt: (v) => fmtDur(v), label: 'Training mix' }) : '<p class="tiny muted vz-none">Log workouts to see your mix.</p>';
}
{
  const base = RENDER.home;
  RENDER.home = (el) => { base(el); const s = $('[data-widget="charts"]', el); if (s) { try { homeCharts(s); } catch (e) { console.error(e); } } };
}
