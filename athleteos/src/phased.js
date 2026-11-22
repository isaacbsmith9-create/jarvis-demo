// ===================== Hub 2.0 · Phase D: Insights tab =====================
// Hub › Insights, under the engine's "What your data says":
//   1. Compare: last 7 / 30 / 365 days vs the same length before, for every app's key numbers.
//   2. Habits: 28-day consistency grid for the daily habits that matter, with % and current streak.
//   3. Long-term: vertical, GPA, weekly shooting %, weekly readiness and sleep.
//   4. Week in review (the Sunday report): last full week Mon–Sun (this week on Sundays): wins, slips, best day.
//      On Sundays the morning text gets a "📈 Week:" line from it.
const PD_PER = [['7', '7 days'], ['30', '30 days'], ['365', '1 year']];
const pdDays = (n, end) => lastNDays(n, end);
const pdLogged = (d) => doc('day-' + d) != null;
const PD_METRICS = [
  { k: 'sleep', l: 'Sleep', app: 'rl', u: 'h', dec: 1, agg: 'avg', fn: (d) => hpSleepNight(d) },
  { k: 'ready', l: 'Readiness', app: 'rl', u: '', dec: 0, agg: 'avg', fn: (d) => hpReady(d) },
  { k: 'checkins', l: 'Check-ins', app: 'rl', u: 'days', dec: 0, agg: 'count', fn: (d) => (doc('rl-check')?.days?.[d] ? 1 : null) },
  { k: 'trainH', l: 'Training', app: 'aos', u: 'h', dec: 1, agg: 'sum', fn: (d) => { const m = trainingOf(d).mins; return m ? m / 60 : null; } },
  { k: 'trainD', l: 'Training days', app: 'aos', u: 'days', dec: 0, agg: 'count', fn: (d) => (trainingOf(d).mins ? 1 : null) },
  { k: 'shots', l: 'Shots taken', app: 'aos', u: '', dec: 0, agg: 'sum', fn: (d) => hubSafe(() => hpCorr('shots')(d)) },
  { k: 'shootPct', l: 'Shooting %', app: 'aos', u: '%', dec: 1, agg: 'avg', fn: (d) => hpShotPct(d) },
  { k: 'protein', l: 'Protein (logged days)', app: 'ml', u: 'g', dec: 0, agg: 'avg', fn: (d) => (hasFood(d) ? totalsOf(d).protein : null) },
  { k: 'proteinD', l: 'Protein goal days', app: 'ml', u: 'days', dec: 0, agg: 'count', fn: (d) => (hasFood(d) && totalsOf(d).protein >= targets(d).protein * 0.9 ? 1 : null) },
  { k: 'plan', l: 'Plan kept', app: 'gp', u: '%', dec: 0, agg: 'avg', fn: (d) => { const b = hubBlocks(d).filter((x) => x.type !== 'sleep'); return b.length && d < todayIso() ? (b.filter((x) => x.done).length / b.length) * 100 : null; } },
  { k: 'actions', l: 'Top-3 actions done', app: 'hub', u: '', dec: 0, agg: 'sum', fn: (d) => { const D = doc('hub-actions')?.days?.[d]; const n = D ? Object.values(D.s).filter((v) => v.s === 'done').length : 0; return n || null; } },
  { k: 'school', l: 'School work done on time', app: 'school', u: '%', dec: 0, agg: 'ratio', fn: (d) => { const its = (doc('life-school')?.items || []).filter((x) => x.due === d && d < todayIso()); return its.length ? [its.filter((x) => x.done).length, its.length] : null; } },
];
function pdAgg(m, days) {
  const v = days.map((d) => hubSafe(() => m.fn(d))).filter((x) => x != null);
  if (!v.length) return { v: null, n: 0 };
  if (m.agg === 'ratio') { const a = sum(v.map((x) => x[0])), b = sum(v.map((x) => x[1])); return { v: b ? (a / b) * 100 : null, n: v.length }; }
  return { v: m.agg === 'avg' ? mean(v) : m.agg === 'sum' ? sum(v) : v.length, n: v.length };
}
function pdCompare(n, end = todayIso()) {
  const now = pdDays(n, end), prev = pdDays(n, shiftIso(end, -n));
  return PD_METRICS.map((m) => ({ m, a: pdAgg(m, now), b: pdAgg(m, prev) }));
}
const pdF = (m, v) => (v == null ? '—' : `${nf(v, m.dec)}${m.u === '%' ? '%' : m.u === 'h' ? ' h' : m.u === 'g' ? ' g' : ''}`);
const pdAppColor = (k) => (k === 'hub' ? '#14b8a6' : EV_APPS[k]?.color);

const PD_HABITS = [
  ['Morning check-in', 'rl', (d) => !!doc('rl-check')?.days?.[d]],
  ['Slept 8+ h', 'rl', (d) => (hpSleepNight(d) ?? 0) >= 8],
  ['Trained', 'aos', (d) => trainingOf(d).mins > 0],
  ['Logged food', 'ml', (d) => hasFood(d)],
  ['Hit protein', 'ml', (d) => hasFood(d) && totalsOf(d).protein >= targets(d).protein * 0.9],
  ['Kept the plan (70%+)', 'gp', (d) => { const b = hubBlocks(d).filter((x) => x.type !== 'sleep'); return b.length > 0 && b.filter((x) => x.done).length / b.length >= 0.7; }],
];
function pdHabits() {
  const days = pdDays(28), t = todayIso();
  return PD_HABITS.map(([l, app, fn]) => { const hit = days.map((d) => hubSafe(() => fn(d), false)); let st = 0; for (let i = hit.length - 1; i >= 0; i--) { if (hit[i]) st++; else if (days[i] === t) continue; else break; } return { l, app, hit, days, pct: Math.round((hit.filter(Boolean).length / days.length) * 100), streak: st }; });
}

function weekReview(end) {
  const t = end || todayIso(), dow = parseIso(t).getDay(), sun = dow === 0 ? t : shiftIso(t, 7 - dow), mon = shiftIso(sun, -6), days = pdDays(7, sun);
  const cmp = PD_METRICS.map((m) => ({ m, a: pdAgg(m, days), b: pdAgg(m, pdDays(7, shiftIso(sun, -7))) }));
  const score = (d) => PD_HABITS.filter(([, , fn]) => hubSafe(() => fn(d), false)).length, ranked = days.filter((d) => d <= todayIso()).map((d) => ({ d, s: score(d) })).sort((a, b) => b.s - a.s);
  const better = (x) => { const d = x.a.v - x.b.v; return ['sleep', 'ready', 'checkins', 'trainD', 'shootPct', 'protein', 'proteinD', 'plan', 'actions', 'school'].includes(x.m.k) ? d > 0 : null; };
  const moves = cmp.filter((x) => x.a.v != null && x.b.v != null && Math.abs(x.a.v - x.b.v) >= (x.m.u === '%' ? 5 : x.m.u === 'h' ? 0.3 : x.m.u === 'days' ? 1 : x.m.u === 'g' ? 10 : 1));
  return { mon, sun, partial: sun > todayIso(), cmp, wins: moves.filter((x) => better(x) === true), slips: moves.filter((x) => better(x) === false), best: ranked[0], worst: ranked[ranked.length - 1] };
}
const pdMove = (x) => `${x.m.l} ${pdF(x.m, x.b.v)} → ${pdF(x.m, x.a.v)}`;

function phaseDHtml() {
  const per = ui('insPer', '7'), rows = pdCompare(Number(per)), hb = pdHabits(), W = weekReview();
  const cmpRow = ({ m, a, b }) => { const d = a.v != null && b.v != null ? a.v - b.v : null, good = d == null || Math.abs(d) < 1e-9 ? null : ['trainH', 'shots'].includes(m.k) ? null : d > 0;
    return `<tr><td><i class="dot" style="background:${pdAppColor(m.app)}"></i> ${esc(m.l)}</td><td class="num"><b>${pdF(m, a.v)}</b></td><td class="num muted">${pdF(m, b.v)}</td><td class="num ${good === true ? 'up' : good === false ? 'down' : 'muted'}">${d == null ? '' : `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${nf(Math.abs(d), m.dec)}`}</td></tr>`; };
  return `<section class="card" id="pd-week"><div class="card-head"><div><h3>Week in review</h3><span class="sub">${fmtD(W.mon)} – ${fmtD(W.sun)}${W.partial ? ' · so far' : ''} vs the week before</span></div></div>
      <div class="grid two"><div><h4 class="ins-g" style="margin-top:0">Better</h4>${W.wins.length ? `<ul class="pd-ul up">${W.wins.map((x) => `<li>${esc(pdMove(x))}</li>`).join('')}</ul>` : '<p class="small muted">Nothing measurably better yet.</p>'}</div>
      <div><h4 class="ins-g" style="margin-top:0">Slipped</h4>${W.slips.length ? `<ul class="pd-ul down">${W.slips.map((x) => `<li>${esc(pdMove(x))}</li>`).join('')}</ul>` : '<p class="small muted">Nothing slipped.</p>'}</div></div>
      ${W.best && W.best.s ? `<p class="small" style="margin:10px 0 0">Best day: <b>${fmtDL(W.best.d)}</b> (${W.best.s} of ${PD_HABITS.length} habits)${W.worst && W.worst.d !== W.best.d ? ` · Toughest: <b>${fmtDL(W.worst.d)}</b> (${W.worst.s})` : ''}</p>` : ''}</section>
    <section class="card"><div class="card-head"><div><h3>Compare</h3><span class="sub">Last ${PD_PER.find((p) => p[0] === per)[1]} vs the ${PD_PER.find((p) => p[0] === per)[1]} before</span></div>${seg('insPer', PD_PER, per)}</div>
      <div class="table-wrap"><table class="pd-t"><thead><tr><th></th><th>Now</th><th>Before</th><th>Change</th></tr></thead><tbody>${rows.map(cmpRow).join('')}</tbody></table></div></section>
    <section class="card"><div class="card-head"><div><h3>Habits · last 28 days</h3><span class="sub">Each square is a day, oldest on the left</span></div></div>
      <div class="pd-hab">${hb.map((h) => `<div class="pd-h"><span class="pd-hl"><i class="dot" style="background:${pdAppColor(h.app)}"></i>${esc(h.l)}</span><span class="pd-sq" style="--c:${pdAppColor(h.app)}">${h.hit.map((x, i) => `<i class="${x ? 'on' : ''}" title="${esc(fmtDL(h.days[i]))}"></i>`).join('')}</span><span class="pd-hp"><b>${h.pct}%</b>${h.streak > 1 ? ` · ${h.streak}-day streak` : ''}</span></div>`).join('')}</div></section>
    <section class="card"><div class="card-head"><div><h3>Long-term</h3><span class="sub">The numbers that build over a season</span></div></div>
      <div class="grid two"><div><b class="small">Vertical</b><div class="chart" id="pd-vert"></div></div><div><b class="small">GPA</b><div class="chart" id="pd-gpa"></div></div>
      <div><b class="small">Shooting % by week</b><div class="chart" id="pd-shoot"></div></div><div><b class="small">Readiness and sleep by week</b><div class="chart" id="pd-rs"></div></div></div></section>`;
}
function phaseDDraw(el) {
  const empty = (id, msg) => { const c = $('#' + id, el); if (c && !c.innerHTML.trim()) c.innerHTML = `<p class="small muted">${msg}</p>`; };
  const vt = (doc('aos-tests')?.results || []).filter((r) => r.test === 'vert').sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ date: r.date, v: r.value }));
  if (vt.length > 1) drawLine($('#pd-vert', el), vt, { h: 140, color: EV_APPS.aos.color, fmt: (v) => `${nf(v, 1)}"` });
  const sn = Object.entries(doc('life-school')?.snaps || {}).sort().map(([date, v]) => ({ date, v }));
  if (sn.length > 1) drawLine($('#pd-gpa', el), sn, { h: 140, color: EV_APPS.school.color, fmt: (v) => nf(v, 2) });
  const weeks = Array.from({ length: 12 }, (_, i) => shiftIso(mondayOf(todayIso()), -7 * (11 - i)));
  const wk = (fn) => weeks.map((m) => ({ date: m, v: engAvg(pdDays(7, shiftIso(m, 6)).map((d) => hubSafe(() => fn(d))).filter((x) => x != null)) })).filter((p) => p.v != null);
  const sp = wk(hpShotPct); if (sp.length > 1) drawLine($('#pd-shoot', el), sp, { h: 140, color: EV_APPS.btc.color, fmt: (v) => `${Math.round(v)}%` });
  const rr = wk(hpReady), ss = wk(hpSleepNight); if (rr.length > 1 || ss.length > 1) drawMulti($('#pd-rs', el), [{ name: 'Readiness', color: EV_APPS.rl.color, pts: rr }, { name: 'Sleep ×10', color: '#8b5cff', pts: ss.map((p) => ({ ...p, v: p.v * 10 })) }], { h: 140 });
  empty('pd-vert', 'Log 2+ vertical tests in Athlete OS › Tests.'); empty('pd-gpa', 'Fills in as Student Lens grades change.'); empty('pd-shoot', 'Needs shooting logged in 2+ weeks.'); empty('pd-rs', 'Needs 2+ weeks of check-ins.');
}
const pdGraphs = HUB.graphs;
HUB.graphs = (el) => { pdGraphs(el); hubSafe(() => { const first = el.querySelector('.hub-head + section'); (first || $('.hub-head', el)).insertAdjacentHTML('afterend', phaseDHtml()); phaseDDraw(el); }); };

// Sunday morning text gets a week line
const pdBrief = briefFor;
briefFor = function (date) {
  const b = pdBrief(date); if (parseIso(date).getDay() !== 0) return b;
  const W = hubSafe(() => weekReview(date)); if (!W) return b;
  const pick = (k) => W.cmp.find((x) => x.m.k === k), parts = [];
  const sl = pick('sleep'), td = pick('trainD'), pd = pick('proteinD');
  if (sl.a.v != null) parts.push(`sleep ${nf(sl.a.v, 1)} h${sl.b.v != null ? ` (${sl.a.v >= sl.b.v ? '+' : '−'}${nf(Math.abs(sl.a.v - sl.b.v), 1)})` : ''}`);
  if (td.a.v != null) parts.push(`${td.a.v} training day${td.a.v === 1 ? "" : "s"}`); if (pd.a.v != null) parts.push(`protein ${pd.a.v}/7`);
  if (!parts.length) return b;
  const lines = [...b.lines.slice(0, -1), `📈 Week: ${parts.join(' · ')}`, b.lines[b.lines.length - 1]];
  return { ...b, lines, text: lines.join('\n') };
};
window.Ecosystem = { ...(window.Ecosystem || {}), compare: pdCompare, habits: pdHabits, weekReview, brief: briefFor };
