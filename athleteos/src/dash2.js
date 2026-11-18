// ===================== COMMAND CENTER 2.0 + ADVANCED VISUALS =====================
// • Athlete Status: one overall status + a short summary built only from recorded data.
// • Daily Briefing: a row per area (priorities, training, recovery, nutrition, mental, schedule, insight) + refresh.
// • Compact / detailed Home, pinned charts.
// • New Home widgets: performance radar, consistency heatmap (switchable), trend comparison, weekly training mix,
//   development timeline. Every chart keeps its full time range, so missing days show as gaps, never as zero.
const D2_RANGE = (n) => ({ from: shiftIso(todayIso(), -(n - 1)), to: todayIso() });

// ---------- planned vs completed (consistency insight) ----------
function planVsDone() {
  const a = adherence(lastNDays(7)), b = adherence(lastNDays(7, shiftIso(todayIso(), -7)));
  const pa = a.sched ? a.done / a.sched : null, pb = b.sched ? b.done / b.sched : null;
  return { a, b, pa, pb, drop: pa != null && pb != null && a.sched >= 3 && b.sched >= 3 ? Math.round((pb - pa) * 100) : null };
}
function mindTrend() {
  const a = lastNDays(7).map(mentalScore).filter((x) => x != null), b = lastNDays(7, shiftIso(todayIso(), -7)).map(mentalScore).filter((x) => x != null);
  if (a.length < 2 || b.length < 2) return null;
  const d = mean(a) - mean(b); return { a: Math.round(mean(a)), b: Math.round(mean(b)), dir: d >= 5 ? 'up' : d <= -5 ? 'down' : 'flat' };
}
function topInsight() {
  const pv = planVsDone();
  if (pv.drop != null && pv.drop >= 20) return { text: `Training follow-through fell from ${Math.round(pv.pb * 100)}% to ${Math.round(pv.pa * 100)}% of scheduled sessions (last 7 days vs the 7 before). Sessions are still being planned but fewer get done, so review this week's schedule.`, conf: pv.a.sched + pv.b.sched >= 10 ? 'Medium' : 'Low', period: 'last 14 days' };
  const p = typeof findPatterns === 'function' ? findPatterns()[0] : null;
  if (p) { const t = ptText(p); return { text: `${t.title}. ${t.body}`, conf: p.conf, period: p.kind === 'shift' ? 'last 28 days' : 'last 120 days' }; }
  return null;
}
function athleteStatus(out) {
  const act = out.filter((x) => x.s === 'act'), watch = out.filter((x) => x.s === 'watch'), have = out.filter((x) => x.s !== 'none');
  const level = !have.length ? 'none' : act.length ? 'act' : watch.length >= 2 ? 'watch' : 'ok';
  const s = [], mt = mindTrend(), rec = out.find((x) => x.k === 'rec'), tr = out.find((x) => x.k === 'train'), pv = planVsDone();
  if (mt) s.push(`Your mental readiness is ${mt.dir === 'up' ? 'trending up' : mt.dir === 'down' ? 'trending down' : 'steady'} (${mt.b} → ${mt.a}, 7-day averages).`);
  if (rec.s !== 'none') s.push(`Recovery is ${rec.s === 'ok' ? 'good' : rec.s === 'watch' ? 'okay but not great' : 'low'} (${rec.v}).`);
  if (pv.a.sched) s.push(`You've done ${pv.a.done} of ${pv.a.sched} scheduled sessions in the last 7 days${pv.a.missed ? `, ${pv.a.missed} missed` : ''}.`);
  else if (tr.s !== 'none') s.push(`Training: ${tr.v} this week, ${tr.s === 'ok' ? 'on pace' : 'behind pace'}.`);
  const top = [...act, ...watch][0];
  s.push(top ? `Biggest priority today: ${top.fix.toLowerCase()}.` : have.length ? 'Nothing needs fixing today. Keep the routine going.' : 'Log a workout, a check-in and a meal to start your status.');
  return { level, text: s.join(' ') };
}

// ---------- the new Command Center ----------
const D2_LV = { ok: ['On track', 'var(--good)'], watch: ['Watch', 'var(--warn)'], act: ['Needs attention', 'var(--danger)'], none: ['Getting started', 'var(--oth)'] };
homeCommand = function (el) {
  el.classList.add('span2', 'cc');
  const { out, w, lw, ls } = ccSystems(), rank = { act: 0, watch: 1, ok: 3, none: 4 }, st = athleteStatus(out), t = todayIso(), now = nowM();
  const pri = out.filter((x) => x.s === 'act' || x.s === 'watch').sort((a, b) => rank[a.s] - rank[b.s]).slice(0, 3), alerts = loadWarnings().slice(0, 3);
  // briefing rows
  const its = tdItems(t), trainT = its.filter((x) => x.type === 'train' || ['practice', 'game'].includes(x.type) || evType(x.type)[3]), done = exList(t), tt = totalsOf(t), tg = targets(t);
  const rs = recoveryScore(t)?.score ?? null, sl = recoveryInputs(t).sleepH, ms = mentalScore(t), m7 = lastNDays(7).map(mentalScore).filter((x) => x != null), pv = planVsDone(), ins = topInsight();
  const next = its.filter((x) => x.st + x.mins > now && !x.done).slice(0, 3), tm = typeof scDue === 'function' ? scDue(shiftIso(t, 1), shiftIso(t, 1)) : [], ng = aos().profile?.nextGame;
  const rows = [
    ['spark', 'Priorities', pri.length ? pri.map((x) => x.fix).join(' · ') : 'Nothing urgent. Stick to the plan.'],
    ['dumbbell', 'Training', `${trainT.length ? 'Planned: ' + trainT.map((x) => `${x.title} ${tdClock(x.st)}`).join(', ') : 'Nothing planned today'}${done.length ? ` · Done: ${done.length} session${done.length > 1 ? 's' : ''}, ${fmtDur(sum(done.map((x) => Number(x.mins) || 0)))}` : ''}${pv.a.missed ? ` · ${pv.a.missed} missed this week` : ''}`],
    ['heart', 'Recovery', rs != null ? `${rs}/100${sl != null ? ` · ${sl} h sleep` : ''} · ${rs >= 65 ? 'ready to push' : rs >= 45 ? 'train controlled' : 'go light'}` : 'No check-in yet today'],
    ['fork', 'Nutrition', hasFood(t) ? `${nf(tt.calories)} / ${nf(tg.calories)} kcal · ${Math.round(tt.protein)} / ${tg.protein} g protein · ${waterOf(t)} / ${tg.waterOz} oz water` : 'Nothing logged yet today'],
    ['brain', 'Mental', ms != null ? `Today ${ms}/100${m7.length ? ` · 7-day avg ${Math.round(mean(m7))}` : ''}` : m7.length ? `No check-in today · 7-day avg ${Math.round(mean(m7))}` : 'No mental check-ins yet'],
    ['calendar', 'Schedule', [next.length ? next.map((x) => `${x.title} ${tdClock(x.st)}`).join(', ') : 'Nothing else blocked today', tm.length ? tm.map((x) => `${scType(x.type)[1]} tomorrow: ${x.title}`).join(', ') : '', ng && ng >= t ? `next game ${ng === t ? 'today' : 'in ' + daysBetween(t, ng) + ' days'}` : ''].filter(Boolean).join(' · ')],
    ['target', 'Insight', ins ? `${ins.text} (${ins.conf} confidence · ${ins.period})` : 'Not enough history for an insight yet.'],
  ];
  el.innerHTML = `<div class="card-head"><div><h3>Command Center</h3><span class="sub">${esc(fmtDL(t))} · updated ${tdClock(now)}</span></div><div class="row" style="gap:6px"><button type="button" class="btn sm" data-d2-refresh>↻ Refresh</button><button type="button" class="btn sm" data-go="intel-feed">Intelligence ›</button></div></div>
    <div class="d2-status" style="--c:${D2_LV[st.level][1]}"><span class="d2-badge">${D2_LV[st.level][0]}</span><p>${esc(st.text)}</p></div>
    <div class="cc-sys">${out.map((x) => `<button type="button" class="cc-s" style="--c:${CC_LV[x.s][1]}" data-go="${x.go}" title="${esc(x.note)}"><span class="cc-ic">${ICONS[x.ic]}</span><span class="cc-n">${x.name}</span><b>${esc(x.v)}</b><em>${CC_LV[x.s][0]}</em></button>`).join('')}</div>
    <div class="d2-brief"><div class="d2-bh"><b>Daily briefing</b><span class="tiny muted">from today's data</span></div>${rows.map(([ic, h, v]) => `<div class="d2-row"><span class="d2-ic">${ICONS[ic]}</span><span class="d2-k">${h}</span><span class="d2-v">${esc(v)}</span></div>`).join('')}</div>
    <div class="d2-more"><div class="cc-brief"><span class="tiny muted">THIS WEEK</span><p>${esc(ccWeekly(w, lw, ls))}</p></div>
      ${alerts.length ? `<ul class="lab-list" style="margin-top:8px">${alerts.map(([k, txt]) => `<li class="${k}">${esc(txt)}</li>`).join('')}</ul>` : ''}</div>`;
};
// Mental tile: say which number it is.
{
  const base = ccSystems;
  ccSystems = function () { const r = base(), m = r.out.find((x) => x.k === 'mind'), today = mentalScore(todayIso()); if (m && today != null) m.v = `${today} today`; else if (m && m.v !== '—') m.v = m.v.replace(' avg', ' · 7-day avg'); return r; };
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-d2-refresh]')) { refresh(); toast('Briefing updated from your latest data'); } });

// ---------- compact / detailed + pinned charts ----------
const d2Pins = () => ui('pins', []);
document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-pin]'); if (p) { const id = p.dataset.pin, pins = d2Pins(); setUi('pins', pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id]); return refresh(); }
  const m = e.target.closest('[data-homemode]'); if (m) { setUi('homeMode', m.dataset.homemode); refresh(); }
});

// ---------- new widgets ----------
WIDGETS.push(['radar', 'Performance radar'], ['heat', 'Consistency heatmap'], ['compare', 'Trend comparison'], ['mix', 'Weekly training mix'], ['timeline', 'Development timeline']);
DEFAULT_W.splice(DEFAULT_W.indexOf('charts') + 1, 0, 'radar', 'heat', 'mix', 'compare', 'timeline');
function d2Radar(el) {
  const sk = skillRatings(), items = SKILLS.filter(([k]) => sk[k]).map(([k, l]) => ({ label: l, v: sk[k].v, basis: sk[k].basis }));
  const m28 = lastNDays(28).map(mentalScore).filter((x) => x != null); if (m28.length >= 3) items.push({ label: 'Mental', v: Math.round(mean(m28)), basis: `${m28.length} check-ins, 28 days` });
  const rc = lastNDays(14).map((d) => recoveryScore(d)?.score).filter((x) => x != null); if (rc.length >= 3) items.push({ label: 'Recovery', v: Math.round(mean(rc)), basis: `${rc.length} days, 14-day average` });
  if (allDayKeys().some(isActive)) items.push({ label: 'Consistency', v: trainingConsistencyScore(), basis: 'last 28 days vs your target' });
  el.innerHTML = `<div class="card-head"><div><h3>Performance radar</h3><span class="sub">Only areas with real results · 0–100</span></div><button type="button" class="btn sm" data-go="intel-profile">Details</button></div>
    ${items.length >= 3 ? radar(items, { size: 250, label: 'Performance radar' }) + `<div class="list" style="margin-top:6px">${items.map((x) => `<div class="li"><span class="small">${esc(x.label)}</span><span class="tiny muted" style="text-align:right">${x.v} · ${esc(x.basis)}</span></div>`).join('')}</div>`
    : emptyState('Not enough results yet', 'Log tests, shooting sessions and check-ins. Each area appears once it has real data.', 'target')}`;
}
const HEAT_CATS = [['train', 'Training'], ['check', 'Check-ins'], ['mind', 'Mental'], ['food', 'Nutrition'], ['rout', 'Routines']];
function d2HeatLevel(cat, d) {
  if (cat === 'train') return activityLevel(d);
  if (cat === 'check') return recoveryInputs(d).sleepH != null || dayDoc(d)?.feel ? 3 : 0;
  if (cat === 'mind') { const s = mentalScore(d); return s == null ? 0 : s >= 75 ? 4 : s >= 55 ? 3 : s >= 35 ? 2 : 1; }
  if (cat === 'food') { if (!hasFood(d)) return 0; const r = totalsOf(d).protein / (targets(d).protein || 1); return r >= 0.9 ? 4 : r >= 0.7 ? 3 : r >= 0.4 ? 2 : 1; }
  if (cat === 'rout') { const rs = routinesOn(d); if (!rs.length) return 0; const n = rs.filter((r) => routineComplete(d, r.id)).length; return n ? Math.max(1, Math.round((n / rs.length) * 4)) : 0; }
  return 0;
}
function d2Heat(el) {
  el.classList.add('span2');
  const cat = ui('heatCat', 'train'), t = todayIso(), start = shiftIso(mondayOf(t), -7 * 15), weeks = Array.from({ length: 16 }, (_, i) => shiftIso(start, 7 * i));
  let on = 0, tot = 0; const cells = weeks.map((w) => Array.from({ length: 7 }, (_, j) => { const d = shiftIso(w, j); if (d > t) return `<i class="fut"></i>`; const l = d2HeatLevel(cat, d); tot++; if (l) on++; return `<i class="h${l}" title="${esc(fmtDL(d))}: ${l ? ['', 'light', 'some', 'good', 'great'][l] : 'nothing logged'}"></i>`; }).join(''));
  el.innerHTML = `<div class="card-head"><div><h3>Consistency heatmap</h3><span class="sub">${on} of ${tot} days · last 16 weeks · blank = nothing logged</span></div></div>
    ${seg('heatCat', HEAT_CATS, cat)}<div class="d2-heat" style="margin-top:10px">${cells.map((c) => `<div>${c}</div>`).join('')}</div>
    <div class="d2-hl tiny muted"><span>${esc(fmtD(start))}</span><span class="row" style="gap:3px">Less <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> More</span><span>Today</span></div>`;
}
const CMP_VARS = () => [...CORR_VARS.map(([k, l, u, f]) => [k, l, u, f]), ['mental', 'Mental readiness', '', (d) => mentalScore(d)], ['load', 'Training load', '', (d) => (allDayKeys().includes(d) ? loadOf(d) : null)]];
function d2Compare(el) {
  el.classList.add('span2');
  const V = CMP_VARS(), a = ui('cmpA', 'load'), b = ui('cmpB', 'recovery'), A = V.find((v) => v[0] === a) || V[0], B = V.find((v) => v[0] === b) || V[1], days = lastNDays(30), rg = D2_RANGE(30);
  const pa = days.map((d) => ({ date: d, raw: A[3](d) })).filter((p) => p.raw != null), pb = days.map((d) => ({ date: d, raw: B[3](d) })).filter((p) => p.raw != null);
  const norm = (ps) => { const lo = Math.min(...ps.map((p) => p.raw)), hi = Math.max(...ps.map((p) => p.raw)); return ps.map((p) => ({ date: p.date, v: hi === lo ? 50 : Math.round(((p.raw - lo) / (hi - lo)) * 100), tip: `${r1(p.raw)}${A[2] && ps === pa ? ' ' + A[2] : B[2] && ps === pb ? ' ' + B[2] : ''}` })); };
  const pairs = days.map((d) => [A[3](d), B[3](d)]).filter(([x, y]) => x != null && y != null), pr = pairs.length >= 7 ? pearson(pairs) : null;
  const sel = (id, cur) => `<select data-cmp-sel="${id}" aria-label="Metric ${id === 'cmpA' ? 1 : 2}">${V.map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  el.innerHTML = `<div class="card-head"><div><h3>Trend comparison</h3><span class="sub">Two measures on one timeline, last 30 days (each scaled 0–100)</span></div></div>
    <div class="fields">${sel('cmpA', a)}${sel('cmpB', b)}</div><div class="chart" id="d2-cmp" style="margin-top:8px"></div>
    <p class="tiny muted" style="margin-top:4px">${pr ? `On the ${pr.n} days with both: ${strength(pr.r)} ${pr.r >= 0 ? 'positive' : 'negative'} relationship (r = ${r2(pr.r)}). Moving together is not proof that one causes the other.` : 'Needs 7+ days where both are logged to measure how they move together.'}</p>`;
  if (pa.length || pb.length) drawMulti($('#d2-cmp', el), [{ name: A[1], color: 'var(--accent)', pts: pa.length ? norm(pa) : [] }, { name: B[1], color: 'var(--good)', dash: true, pts: pb.length ? norm(pb) : [] }], { h: 180, yMin: 0, yMax: 100, ...rg, label: 'Trend comparison' });
  else $('#d2-cmp', el).innerHTML = '<p class="tiny muted vz-none">Nothing logged for either measure in 30 days.</p>';
}
document.addEventListener('change', (e) => { const s = e.target.closest('[data-cmp-sel]'); if (s) { setUi(s.dataset.cmpSel, s.value); refresh(); } });
function d2Mix(el) {
  el.classList.add('span2');
  const t = todayIso(), weeks = Array.from({ length: 8 }, (_, i) => shiftIso(mondayOf(t), -7 * (7 - i)));
  const groups = weeks.map((w) => { const ss = sessionsIn(Array.from({ length: 7 }, (_, j) => shiftIso(w, j)).filter((d) => d <= t)); return { label: fmtD(w).replace(/^[A-Za-z]+ /, MON[parseIso(w).getMonth()] + ' '), tip: `Week of ${fmtD(w)}`, segs: LOAD_CATS.map(([k, l, c]) => ({ v: sum(ss.filter((s) => s.cat === k).map((s) => Number(s.mins) || 0)), color: c, name: l })).filter((s) => s.v) }; });
  const used = LOAD_CATS.filter(([k]) => groups.some((g) => g.segs.some((s) => s.name === LOAD_CATS.find((c) => c[0] === k)[1])));
  el.innerHTML = `<div class="card-head"><div><h3>Weekly training mix</h3><span class="sub">Minutes by type, last 8 weeks</span></div><button type="button" class="btn sm" data-go="train-load">Load</button></div><div class="chart" id="d2-mix"></div>
    <div class="legend">${used.map(([, l, c]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;
  if (groups.some((g) => g.segs.length)) drawBars($('#d2-mix', el), groups, { h: 180, fmt: (v) => fmtDur(v), label: 'Weekly training minutes by type' }); else $('#d2-mix', el).innerHTML = '<p class="tiny muted vz-none">Log workouts to see your mix.</p>';
}
function d2Timeline(el) {
  const t = todayIso(), from = shiftIso(t, -182), ev = [];
  for (const p of allPRs()) if (p.r.date >= from) ev.push({ d: p.r.date, ic: 'trophy', c: 'var(--warn)', t: `New ${p.t.name} record: ${fmtVal(p.t, p.r.value)}`, s: `was ${fmtVal(p.t, p.prev)}` });
  for (const [id, d] of Object.entries(aos().ach || {})) { const a = ACHIEVEMENTS.find((x) => x[0] === id); if (a && d >= from) ev.push({ d, ic: 'spark', c: 'var(--purple)', t: `Achievement: ${a[1]}`, s: a[2] }); }
  for (const g of doc('aos-goals').goals || []) { if (goalState(g).status === 'done') { const d = g.doneAt ? (typeof g.doneAt === 'number' ? isoDate(new Date(g.doneAt)) : g.doneAt) : (g.history || []).slice(-1)[0]?.date; if (d && d >= from) ev.push({ d, ic: 'target', c: 'var(--good)', t: `Goal reached: ${g.title}`, s: '' }); } for (const m of g.milestones || []) if (m.done && m.doneAt && String(m.doneAt) >= from) ev.push({ d: String(m.doneAt).slice(0, 10), ic: 'target', c: 'var(--accent)', t: `Milestone: ${m.title || m.label || ''}`, s: g.title }); }
  const best = shotSessions().map((s) => ({ date: s.date, ...sessionTotals(s) })).filter((s) => s.a >= 50 && s.date >= from).sort((a, b) => b.pct - a.pct)[0];
  if (best) ev.push({ d: best.date, ic: 'ball', c: '#22c3ee', t: `Best shooting session: ${Math.round(best.pct * 100)}%`, s: `${best.m}/${best.a} shots` });
  ev.sort((a, b) => b.d.localeCompare(a.d));
  const pos = (d) => clamp((daysBetween(from, d) / 182) * 100, 0, 100);
  el.innerHTML = `<div class="card-head"><div><h3>Development timeline</h3><span class="sub">Records, milestones and achievements, last 6 months</span></div></div>
    ${ev.length ? `<div class="d2-tl">${ev.map((x) => `<i style="left:${pos(x.d)}%;background:${x.c}" title="${esc(fmtD(x.d))}: ${esc(x.t)}"></i>`).join('')}</div><div class="d2-hl tiny muted"><span>${esc(fmtD(from))}</span><span>Today</span></div>
      <div class="d2-ev">${ev.slice(0, 8).map((x) => `<div class="d2-e"><span class="d2-ic" style="color:${x.c}">${ICONS[x.ic]}</span><div style="min-width:0"><b>${esc(x.t)}</b><span class="tiny muted">${esc(fmtD(x.d))}${x.s ? ' · ' + esc(x.s) : ''}</span></div></div>`).join('')}</div>`
    : emptyState('Your timeline starts with your first record', 'Log tests, shooting sessions and goals. Records and milestones land here automatically.', 'trophy')}`;
}

// ---------- full time range on Home charts (missing days = gaps) ----------
{
  const base = homeCharts;
  homeCharts = function (el) {
    base(el);
    const rg = D2_RANGE(14);
    const sl = lastNDays(14).map((d) => ({ date: d, v: recoveryInputs(d).sleepH })).filter((p) => p.v != null);
    if (sl.length) drawLine($('#vz-sleep', el), sl, { h: 150, color: '#8b5cff', goal: 8, fmt: (v) => r1(v) + ' h', bands: [[8, 10, 'var(--good)']], ...rg });
    const rc = lastNDays(14).map((d) => ({ date: d, v: recoveryScore(d)?.score ?? null })).filter((p) => p.v != null);
    if (rc.length) drawLine($('#vz-ready', el), rc, { h: 150, color: 'var(--good)', yMin: 0, yMax: 100, fmt: (v) => Math.round(v) + '/100', bands: [[0, 45, 'var(--danger)'], [70, 100, 'var(--good)']], ...rg });
    // pin buttons + pinned first
    const grid = $('.vz-grid', el), pins = d2Pins(); if (!grid) return;
    [...grid.children].forEach((v) => { const id = v.querySelector('[id^="vz-"]')?.id; if (!id) return; v.dataset.vz = id; v.querySelector('.vz-h')?.insertAdjacentHTML('beforeend', `<button type="button" class="d2-pin ${pins.includes(id) ? 'on' : ''}" data-pin="${id}" aria-label="${pins.includes(id) ? 'Unpin' : 'Pin'} chart" aria-pressed="${pins.includes(id)}">${pins.includes(id) ? '★' : '☆'}</button>`); });
    [...grid.children].filter((v) => pins.includes(v.dataset.vz)).reverse().forEach((v) => grid.prepend(v));
    if (ui('homeMode', 'detailed') === 'compact') { const keep = pins.length ? pins : [...grid.children].slice(0, 4).map((v) => v.dataset.vz); [...grid.children].forEach((v) => { if (!keep.includes(v.dataset.vz)) v.remove(); }); }
  };
}
{
  const base = RENDER.home;
  RENDER.home = (el) => {
    base(el);
    const mode = ui('homeMode', 'detailed');
    el.classList.toggle('home-compact', mode === 'compact');
    $('.hero', el)?.insertAdjacentHTML('beforeend', `<div class="seg d2-mode" role="group" aria-label="Home layout"><button type="button" data-homemode="detailed" class="${mode === 'detailed' ? 'on' : ''}" aria-pressed="${mode === 'detailed'}">Detailed</button><button type="button" data-homemode="compact" class="${mode === 'compact' ? 'on' : ''}" aria-pressed="${mode === 'compact'}">Compact</button></div>`);
    for (const [k, fn] of [['radar', d2Radar], ['heat', d2Heat], ['compare', d2Compare], ['mix', d2Mix], ['timeline', d2Timeline]]) { const s = $(`[data-widget="${k}"]`, el); if (s) { try { fn(s); } catch (e) { console.error(e); s.innerHTML = '<p class="muted small">Could not draw this card.</p>'; } } }
    if (mode === 'compact') $$('[data-widget]', el).forEach((s) => { if (['heat', 'compare', 'timeline', 'ach', 'preview', 'prs', 'week', 'checklist'].includes(s.dataset.widget)) s.remove(); });
  };
}
