// ===================== TRAINING LOAD MONITOR =====================
// Session load = minutes × session RPE (Foster). Every workout, from any part of the app or MacroLens, feeds this.
const LOAD_CATS = [
  ['shooting', 'Shooting', '#22c3ee', ['shooting']], ['handles', 'Ball handling', '#60a5fa', ['handles']], ['finishing', 'Finishing', 'var(--good)', ['finishing']],
  ['skill', 'Skill (mixed)', 'var(--accent)', ['skill']], ['strength', 'Strength', 'var(--str)', ['lift']], ['conditioning', 'Conditioning', 'var(--cond)', ['conditioning', 'run', 'bike', 'speed']],
  ['practice', 'Team practice', 'var(--hb)', ['practice']], ['game', 'Games', '#ff6a3d', ['game']], ['recovery', 'Recovery', '#94a3b8', ['recovery', 'walk']], ['other', 'Other', '#64748b', ['other']],
];
const loadCatOf = (type) => LOAD_CATS.find((c) => c[3].includes(type))?.[0] || 'other';
const MUSCLES = ['Legs', 'Glutes', 'Hamstrings', 'Calves', 'Core', 'Chest', 'Back', 'Shoulders', 'Arms', 'Full body'];
const DIFF = ['Easy', 'Moderate', 'Hard', 'Very hard', 'Max effort'];
const RPE_ZONES = [['Low (1-3)', 1, 3, 'var(--accent)'], ['Moderate (4-6)', 4, 6, 'var(--good)'], ['Hard (7-8)', 7, 8, 'var(--warn)'], ['Max (9-10)', 9, 10, 'var(--danger)']];
/** All sessions in a date range, with their date. */
function sessionsIn(days) { return days.flatMap((d) => exList(d).map((x) => ({ ...x, date: d, load: sessionLoad(x), cat: loadCatOf(x.type) }))); }
function trainingConsistencyScore() {
  const target = Number(aos().profile?.weeklyDays) || 5, act = lastNDays(28).filter(isActive).length;
  const a = adherence(lastNDays(28), (x) => !!evType(x.type)[3] && x.type !== 'routine');
  const part1 = clamp(act / (target * 4), 0, 1);
  return Math.round((a.pct == null ? part1 : part1 * 0.6 + a.pct * 0.4) * 100);
}
/** Informational load patterns. Not medical advice. */
function loadWarnings() {
  const out = [], ls = loadStats(), thisW = sum(lastNDays(7).map(loadOf)), lastW = sum(lastNDays(7, shiftIso(todayIso(), -7)).map(loadOf));
  if (lastW > 0 && thisW > lastW * 1.3) out.push(['mid', `Load in the last 7 days is ${Math.round((thisW / lastW - 1) * 100)}% higher than the 7 days before. Big week-to-week jumps are when overuse problems tend to show up.`]);
  if (ls.acwr != null && ls.acwr > 1.5) out.push(['lo', `Acute:chronic ratio is ${ls.acwr}. This week is much heavier than what your body is used to.`]);
  if (ls.acwr != null && ls.acwr < 0.8) out.push(['mid', `Acute:chronic ratio is ${ls.acwr}. You're training less than usual; ramp back up gradually.`]);
  if (ls.monotony != null && ls.monotony > 2) out.push(['mid', `Monotony ${ls.monotony}: most days had similar load. Mixing hard and easy days helps you recover.`]);
  let hard = 0, run = 0; for (const d of lastNDays(10)) { if (exList(d).some((x) => sessionRPE(x) >= 8)) { run++; hard = Math.max(hard, run); } else run = 0; }
  if (hard >= 3) out.push(['mid', `${hard} hard days (RPE 8+) in a row recently. Plan an easier day.`]);
  const fa = sessionsIn(lastNDays(10)).filter((x) => x.fatigueAfter != null).slice(-5);
  if (fa.length >= 3 && mean(fa.map((x) => x.fatigueAfter)) >= 8) out.push(['lo', `Average fatigue after your last ${fa.length} sessions was ${r1(mean(fa.map((x) => x.fatigueAfter)))}/10.`]);
  let streak = 0; for (let d = todayIso(); isActive(d) && streak < 30; d = shiftIso(d, -1)) streak++;
  if (streak >= 7) out.push(['mid', `${streak} days in a row with training. A full rest day helps adaptation.`]);
  return out;
}

TRAIN.load = (el) => {
  const R = Number(ui('ldR', '12')), cat = ui('ldCat', 'all'), weeks = R, days = lastNDays(weeks * 7);
  const flt = (x) => cat === 'all' || x.cat === cat, ss = sessionsIn(days).filter(flt), dayLoad = (d) => sessionsIn([d]).filter(flt).reduce((a, x) => a + x.load, 0);
  const ls = loadStats(), rd = readiness(), [zc, zl] = acwrZone(ls.acwr), today = todayIso();
  const wkLoad = (m) => sum(lastNDays(7, shiftIso(m, 6)).map(dayLoad)), mon = mondayOf(today), wThis = wkLoad(mon), wLast = wkLoad(shiftIso(mon, -7));
  const avgW = mean(Array.from({ length: 4 }, (_, i) => wkLoad(shiftIso(mon, -7 * (i + 1)))));
  const cons = trainingConsistencyScore(), warns = loadWarnings();
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Training load monitor</h3><span class="sub">Load = minutes × session RPE${ls.est ? ' · sessions without an RPE are estimated from intensity' : ''}</span></div><button type="button" class="btn sm primary" data-act="log-workout">＋ Log session</button></div>
    <div class="row" style="margin-bottom:10px">${seg('ldR', [['4', '4W'], ['12', '12W'], ['26', '6M'], ['52', '1Y']], String(R))}</div>
    <div class="chips" style="margin-bottom:12px"><button type="button" class="chip ${cat === 'all' ? 'on' : ''}" data-ldcat="all">All</button>${LOAD_CATS.map(([k, l, c]) => `<button type="button" class="chip ${cat === k ? 'on' : ''}" data-ldcat="${k}"><i class="dot" style="background:${c};margin-right:5px"></i>${l}</button>`).join('')}</div>
    <div class="kpis four"><div class="kpi"><small>Today</small><b>${dayLoad(today).toLocaleString()}</b><span class="tiny muted">load units</span></div><div class="kpi"><small>This week</small><b>${wThis.toLocaleString()}</b><span class="delta">${deltaPill(pctChange(wThis, wLast))} <span class="tiny muted">vs last</span></span></div><div class="kpi"><small>4-week avg / week</small><b>${Math.round(avgW || 0).toLocaleString()}</b></div><div class="kpi"><small>Consistency score</small><b>${cons}</b><span class="tiny muted">active days + plan adherence</span></div>
      <div class="kpi"><small>Sessions / week</small><b>${r1(ss.length / weeks)}</b></div><div class="kpi"><small>Avg duration</small><b>${ss.length ? fmtDur(mean(ss.map((x) => Number(x.mins)))) : '—'}</b></div><div class="kpi"><small>Avg RPE</small><b>${ss.length ? r1(mean(ss.map(sessionRPE))) : '—'}</b></div><div class="kpi"><small>ACWR</small><b>${ls.acwr ?? '—'}</b><span class="band ${zc}">${zl}</span></div></div>
  </section>
  ${warns.length ? `<section class="card"><div class="card-head"><div><h3>Workload patterns</h3><span class="sub">Informational only, not a medical assessment. If something hurts, talk to a trainer or doctor.</span></div></div><div class="list">${warns.map(([c, t]) => `<div class="li" style="justify-content:flex-start"><span class="band ${c}" style="flex:none">${c === 'lo' ? 'High' : 'Note'}</span><span class="small">${esc(t)}</span></div>`).join('')}</div></section>` : ''}
  ${ss.length ? `<section class="card"><div class="card-head"><div><h3>Weekly workload</h3><span class="sub">Total load per week and the 4-week rolling average</span></div></div><div class="chart" id="ld-wk"></div></section>
  <section class="card"><div class="card-head"><div><h3>Acute vs chronic load</h3><span class="sub">Acute = last 7 days · chronic = 28-day weekly average · the gap is your ratio</span></div></div><div class="chart" id="ld-ac"></div></section>
  <section class="card"><div class="card-head"><div><h3>Load vs readiness</h3><span class="sub">Last 28 days · bars = daily load (colour = intensity) · green line = readiness · 🏆 PR · 🏀 game</span></div><button type="button" class="btn sm" data-act="checkin">Check in</button></div><div class="chart" id="combo"></div>
    <div class="legend"><span><i style="background:var(--danger)"></i>High</span><span><i style="background:var(--warn)"></i>Medium</span><span><i style="background:var(--accent)"></i>Low</span><span><i style="background:var(--good)"></i>Readiness ${rd ? rd.score : '—'}</span></div>
    <div class="list" style="margin-top:8px">${restAdvice().map(([c, t]) => `<div class="li" style="justify-content:flex-start"><span class="band ${c}" style="flex:none">${c === 'hi' ? 'OK' : c === 'mid' ? 'Watch' : 'Rest'}</span><span class="small">${esc(t)}</span></div>`).join('') || '<p class="muted small">Check in (sleep, energy, soreness, fatigue) to get rest-day recommendations.</p>'}</div></section>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Intensity distribution</h3><span class="sub">Training minutes by session RPE</span></div></div>${donut(RPE_ZONES.map(([l, a, b, c]) => ({ label: l, v: sum(ss.filter((x) => sessionRPE(x) >= a && sessionRPE(x) <= b).map((x) => Number(x.mins))), color: c })), { fmt: (v) => fmtDur(v), label: 'Minutes by intensity' })}<div class="chart" id="ld-int" style="margin-top:12px"></div></section>
    <section class="card"><div class="card-head"><div><h3>Workload by category</h3><span class="sub">${weeks} weeks</span></div></div>${donut(LOAD_CATS.map(([k, l, c]) => ({ label: l, v: sum(sessionsIn(days).filter((x) => x.cat === k).map((x) => x.load)), color: c })), { fmt: (v) => v.toLocaleString() + ' load', label: 'Load by category' })}</section></div>
  <section class="card"><div class="card-head"><div><h3>Basketball workload by week</h3><span class="sub">Stacked by category · tap a bar</span></div></div><div class="chart" id="ld-cat"></div><div class="legend">${LOAD_CATS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></section>
  <section class="card"><div class="card-head"><div><h3>This week vs last week</h3><span class="sub">Load by category (Mon-Sun)</span></div></div>${weekCompare(mon)}</section>
  <section class="card"><div class="card-head"><div><h3>Monthly training volume</h3><span class="sub">Hours per month by category</span></div></div><div class="chart" id="ld-mo"></div></section>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Fatigue vs workload</h3><span class="sub">Each dot is a session with a fatigue rating</span></div></div><div id="ld-fat"></div></section>
    <section class="card"><div class="card-head"><div><h3>Frequency and duration</h3><span class="sub">Sessions per week · average minutes</span></div></div><div class="chart" id="ld-freq"></div></section></div>
  <section class="card"><div class="card-head"><div><h3>Training consistency</h3><span class="sub">Colour = how hard you trained · ${cons}/100 consistency</span></div></div>${heatmap(Math.min(26, weeks), activityLevel, null, (d) => (isActive(d) ? `load ${loadOf(d)}` : 'rest'))}</section>`
  : `<section class="card">${emptyState('No sessions in this range', 'Log a session with its RPE (1-10). Shooting, handles, finishing, lifts, conditioning, practices and games all count.', 'dumbbell', '<button type="button" class="btn sm primary" data-act="log-workout">Log a session</button>')}</section>`}
  <section class="card"><div class="card-head"><div><h3>Session log</h3><span class="sub">${ss.length} session${ss.length === 1 ? '' : 's'} in range · edit or delete</span></div></div>${ss.length ? `<div class="list">${[...ss].reverse().slice(0, 40).map((x) => `<div class="li" style="align-items:flex-start"><div style="min-width:0"><div class="t"><i class="dot" style="background:${LOAD_CATS.find((c) => c[0] === x.cat)[2]};margin-right:6px"></i>${esc(x.name || 'Workout')}</div><div class="s">${esc(fmtD(x.date))} · ${fmtDur(x.mins)} · RPE ${sessionRPE(x)}${x.rpe ? '' : ' (est.)'} · load ${x.load}${x.difficulty ? ' · ' + DIFF[x.difficulty - 1] : ''}${x.energyBefore ? ` · energy ${x.energyBefore}/10` : ''}${x.fatigueAfter ? ` · fatigue ${x.fatigueAfter}/10` : ''}</div>${(x.muscles || []).length ? `<div class="s">${x.muscles.map(esc).join(', ')}</div>` : ''}${x.notes ? `<div class="s" style="font-style:italic">${esc(x.notes)}</div>` : ''}</div><div class="row" style="flex:none"><button type="button" class="chip" data-act="edit-workout" data-date="${x.date}" data-id="${esc(x.id)}">Edit</button><button type="button" class="chip" data-act="del-workout" data-date="${x.date}" data-id="${esc(x.id)}">Delete</button></div></div>`).join('')}</div>` : '<p class="muted small">Nothing logged in this range.</p>'}</section>`;
  if (!ss.length) return;
  const wks = []; for (let i = weeks - 1; i >= 0; i--) wks.push(shiftIso(mon, -7 * i));
  const wl = wks.map((m) => ({ date: m, v: wkLoad(m), tip: `${wkLoad(m).toLocaleString()} load` }));
  const ic = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--accent)', rest: 'var(--oth)' };
  drawCombo($('#combo'), lastNDays(28).map((d) => { const L = loadOf(d), r = readiness(d), pr = allPRs().some((p) => p.r.date === d), g = games().some((x) => x.date === d); return { label: String(parseIso(d).getDate()), full: fmtDL(d), bar: L, color: ic[dayIntensity(d)], line: r?.score ?? null, mark: pr ? '🏆' : g ? '🏀' : '', tip: `${L ? `Load ${L} (${dayIntensity(d)})` : 'Rest'}${r ? ` · readiness ${r.score}` : ''}${pr ? ' · PR' : ''}` }; }), { label: 'Daily load and readiness' });
  drawMulti($('#ld-wk'), [{ name: 'Weekly load', color: 'var(--accent)', pts: wl, area: true }, { name: '4-week average', color: 'var(--purple)', dash: true, pts: wl.map((p, i) => { const a = wl.slice(Math.max(0, i - 3), i + 1); return { date: p.date, v: Math.round(mean(a.map((x) => x.v))) }; }) }], { yMin: 0, fmt: (v) => Math.round(v).toLocaleString() });
  const roll = days.map((d) => { const a = sum(lastNDays(7, d).map(dayLoad)), c = sum(lastNDays(28, d).map(dayLoad)) / 4; return { d, a, c }; });
  drawMulti($('#ld-ac'), [{ name: 'Acute (7-day)', color: 'var(--over)', pts: roll.map((x) => ({ date: x.d, v: x.a })) }, { name: 'Chronic (28-day avg/wk)', color: 'var(--accent)', pts: roll.map((x) => ({ date: x.d, v: Math.round(x.c), tip: `${Math.round(x.c).toLocaleString()} · ratio ${x.c ? r2(x.a / x.c) : '—'}` })) }], { yMin: 0, fmt: (v) => Math.round(v).toLocaleString() });
  drawBars($('#ld-int'), wks.map((m) => { const w = sessionsIn(lastNDays(7, shiftIso(m, 6))).filter(flt); return { label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: RPE_ZONES.map(([, a, b, c]) => ({ v: sum(w.filter((x) => sessionRPE(x) >= a && sessionRPE(x) <= b).map((x) => Number(x.mins))), color: c })), tip: `${fmtDur(sum(w.map((x) => Number(x.mins))))} · avg RPE ${w.length ? r1(mean(w.map(sessionRPE))) : '—'}` }; }), { fmt: (v) => fmtDur(v), h: 150 });
  drawBars($('#ld-cat'), wks.map((m) => { const w = sessionsIn(lastNDays(7, shiftIso(m, 6))); return { label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: LOAD_CATS.map(([k, , c]) => ({ v: sum(w.filter((x) => x.cat === k).map((x) => x.load)), color: c })), tip: LOAD_CATS.map(([k, l]) => [l, sum(w.filter((x) => x.cat === k).map((x) => x.load))]).filter(([, v]) => v).map(([l, v]) => `${l} ${v}`).join(', ') || 'no training' }; }), { h: 180 });
  const months = []; for (let i = 11; i >= 0; i--) { const d = parseIso(today); d.setDate(1); d.setMonth(d.getMonth() - i); months.push([d.getFullYear(), d.getMonth()]); }
  drawBars($('#ld-mo'), months.map(([y, m]) => { const ds = []; for (let k = 1; k <= 31; k++) { const x = new Date(y, m, k, 12); if (x.getMonth() !== m) break; ds.push(isoDate(x)); } const w = sessionsIn(ds).filter(flt); return { label: MON[m], full: `${MON[m]} ${y}`, segs: LOAD_CATS.map(([k, , c]) => ({ v: r1(sum(w.filter((x) => x.cat === k).map((x) => Number(x.mins))) / 60), color: c })), tip: `${r1(sum(w.map((x) => Number(x.mins))) / 60)} h · ${w.length} sessions` }; }), { fmt: (v) => v + ' h', tick: (v) => v + 'h', h: 170 });
  const fp = ss.filter((x) => x.fatigueAfter != null).map((x) => [x.load, x.fatigueAfter, x.date]), fit = fp.length >= 5 ? pearson(fp) : null;
  $('#ld-fat').innerHTML = fp.length >= 3 ? `<div class="chart" id="ld-fat-c"></div>${fit ? `<p class="small" style="margin-top:6px">r = ${fit.r >= 0 ? '+' : ''}${fit.r.toFixed(2)} (${strength(fit.r)}): ${fit.r > 0.2 ? 'heavier sessions tended to leave you more tired' : fit.r < -0.2 ? 'heavier sessions did not leave you more tired' : 'no clear link yet'}. A pattern, not proof.</p>` : '<p class="muted tiny">5+ rated sessions to show a trend line.</p>'}` : emptyState('Rate fatigue after sessions', 'Add "fatigue afterward" when logging. With 3+ rated sessions this shows how load relates to how tired you feel.', 'bolt');
  if (fp.length >= 3) drawScatter($('#ld-fat-c'), fp, { xl: 'Session load', yl: 'Fatigue after', fit, h: 200 });
  drawBars($('#ld-freq'), wks.map((m) => { const w = sessionsIn(lastNDays(7, shiftIso(m, 6))).filter(flt); return { label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: [{ v: w.length, color: 'var(--accent)' }], tip: `${w.length} sessions · avg ${w.length ? fmtDur(mean(w.map((x) => Number(x.mins)))) : '—'}` }; }), { h: 150, goal: Number(aos().profile?.weeklyDays) || 5 });
};
function weekCompare(mon) {
  const a = sessionsIn(lastNDays(7, shiftIso(mon, 6))), b = sessionsIn(lastNDays(7, shiftIso(mon, -1)));
  const rows = LOAD_CATS.map(([k, l, c]) => ({ l, c, a: sum(a.filter((x) => x.cat === k).map((x) => x.load)), b: sum(b.filter((x) => x.cat === k).map((x) => x.load)) })).filter((r) => r.a || r.b);
  if (!rows.length) return '<p class="muted small">No training in the last two weeks.</p>';
  const mx = Math.max(...rows.flatMap((r) => [r.a, r.b]));
  return `<div class="stack">${rows.map((r) => `<div><div class="row-between small"><span><i class="dot" style="background:${r.c};margin-right:6px"></i>${r.l}</span><span><b class="num">${r.a.toLocaleString()}</b> <span class="muted">vs ${r.b.toLocaleString()}</span> ${deltaPill(pctChange(r.a, r.b))}</span></div><div class="bar" style="margin-top:4px"><i style="width:${(r.a / mx) * 100}%;background:${r.c}"></i></div><div class="bar" style="margin-top:2px;height:5px;opacity:.5"><i style="width:${(r.b / mx) * 100}%;background:var(--muted)"></i></div></div>`).join('')}</div><p class="muted tiny" style="margin-top:6px">Thick bar = this week · thin grey = last week</p>`;
}
document.addEventListener('click', (e) => { const c = e.target.closest('[data-ldcat]'); if (c) { setUi('ldCat', c.dataset.ldcat); refresh(); } });

// ----- the session logger (shared by every "log workout" button) -----
function openWorkoutSheet(o = {}) {
  const ed = o.edit, date = ed?.date || o.date || todayIso();
  let type = ed?.type || o.type || 'practice', rating = ed?.rating || 0, rpe = ed?.rpe || 0, diff = ed?.difficulty || 0, energy = ed?.energyBefore || 0, fatigue = ed?.fatigueAfter || 0, muscles = new Set(ed?.muscles || []);
  const scale10 = (id, cur) => `<div class="scale" id="${id}" style="flex-wrap:wrap">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button type="button" data-n="${n}" class="${cur === n ? 'on' : ''}" style="flex:1 0 8%">${n}</button>`).join('')}</div>`;
  openSheet(ed ? 'Edit session' : 'Log a training session', `<p class="muted small" style="margin-top:-4px">Saved to your training history and the same diary as MacroLens.</p>
    <div class="chips" id="ws-types">${EX_TYPES.map(([k, l]) => `<button type="button" class="chip ${k === type ? 'on' : ''}" data-wt="${k}">${l}</button>`).join('')}</div>
    <div class="fields"><label class="full">Name<input id="ws-name" maxlength="40" value="${esc(ed?.name || o.name || '')}" placeholder="Optional"></label>
      <label>Minutes<input type="number" id="ws-mins" min="5" max="480" value="${ed?.mins || o.mins || 60}" inputmode="numeric"></label><label>Start time<input type="time" id="ws-time" value="${ed?.time || o.time || ''}"></label>
      <label>Date<input type="date" id="ws-date" value="${date}" max="${todayIso()}" ${ed ? 'disabled' : ''}></label><label>Intensity<select id="ws-int">${['light', 'moderate', 'hard'].map((k) => `<option ${k === (ed?.int || o.int || 'moderate') ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
    <div><p class="muted small" style="margin-bottom:6px">Session RPE: how hard was it overall? (1 very easy · 10 max)</p>${scale10('ws-rpe', rpe)}</div>
    <div><p class="muted small" style="margin-bottom:6px">Perceived difficulty</p><div class="chips" id="ws-diff">${DIFF.map((l, i) => `<button type="button" class="chip ${diff === i + 1 ? 'on' : ''}" data-d="${i + 1}">${l}</button>`).join('')}</div></div>
    <div><p class="muted small" style="margin-bottom:6px">Muscle groups trained</p><div class="chips" id="ws-mus">${MUSCLES.map((m) => `<button type="button" class="chip ${muscles.has(m) ? 'on' : ''}" data-mu="${m}">${m}</button>`).join('')}</div></div>
    <div><p class="muted small" style="margin-bottom:6px">Energy before (1 drained · 10 great)</p>${scale10('ws-en', energy)}</div>
    <div><p class="muted small" style="margin-bottom:6px">Fatigue afterward (1 fresh · 10 wrecked)</p>${scale10('ws-fa', fatigue)}</div>
    <div><p class="muted small" style="margin-bottom:6px">How did it go? (1-5, used for correlations)</p><div class="scale" id="ws-rate">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" class="${rating === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <label>Notes<textarea id="ws-notes" maxlength="300" style="min-height:56px" placeholder="Optional">${esc(ed?.notes || '')}</textarea></label>
    <p class="muted small" id="ws-kcal"></p>
    <button type="button" class="btn primary" id="ws-save">${ed ? 'Save changes' : 'Save session'}</button>`, (d) => {
    const kc = () => { const m = Number($('#ws-mins', d).value) || 0; $('#ws-kcal', d).textContent = `Session load ${rpe ? rpe * m : `≈ ${INT_RPE[$('#ws-int', d).value] * m} (estimated, add RPE)`} · about ${exBurn(type, m, $('#ws-int', d).value).toLocaleString()} kcal (MacroLens estimate)`; };
    kc(); ['#ws-mins', '#ws-int'].forEach((s) => $(s, d).addEventListener('input', kc));
    const pick = (id, set) => $(id, d).addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (!b) return; const n = Number(b.dataset.n), v = set(n); $$('[data-n]', $(id, d)).forEach((x) => x.classList.toggle('on', Number(x.dataset.n) === v)); kc(); });
    pick('#ws-rpe', (n) => (rpe = rpe === n ? 0 : n)); pick('#ws-en', (n) => (energy = energy === n ? 0 : n)); pick('#ws-fa', (n) => (fatigue = fatigue === n ? 0 : n)); pick('#ws-rate', (n) => (rating = rating === n ? 0 : n));
    $('#ws-types', d).addEventListener('click', (e) => { const b = e.target.closest('[data-wt]'); if (!b) return; type = b.dataset.wt; $$('[data-wt]', d).forEach((x) => x.classList.toggle('on', x === b)); kc(); });
    $('#ws-diff', d).addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b) return; diff = diff === Number(b.dataset.d) ? 0 : Number(b.dataset.d); $$('[data-d]', d).forEach((x) => x.classList.toggle('on', Number(x.dataset.d) === diff)); });
    $('#ws-mus', d).addEventListener('click', (e) => { const b = e.target.closest('[data-mu]'); if (!b) return; muscles.has(b.dataset.mu) ? muscles.delete(b.dataset.mu) : muscles.add(b.dataset.mu); b.classList.toggle('on'); });
    $('#ws-save', d).addEventListener('click', () => {
      const mins = Math.round(Number($('#ws-mins', d).value)); if (!(mins >= 5 && mins <= 480)) return toast('Minutes must be 5 to 480');
      const dt = ed?.date || $('#ws-date', d).value || todayIso(), name = $('#ws-name', d).value.trim() || EX_TYPES.find((x) => x[0] === type)[1];
      const rec = { type, name: name.slice(0, 40), mins, int: $('#ws-int', d).value, time: $('#ws-time', d).value || null, notes: $('#ws-notes', d).value.trim().slice(0, 300), rating: rating || null, rpe: rpe || null, difficulty: diff || null, muscles: [...muscles], energyBefore: energy || null, fatigueAfter: fatigue || null, workoutId: ed?.workoutId || o.workoutId || null, event: ed?.event || o.event || null, source: ed?.source || 'athlete-os' };
      if (ed) { const dd = dayDoc(dt); dd.exercise = (dd.exercise || []).map((x) => (x.id === ed.id ? { ...x, ...rec, kcal: exBurn(type, mins, rec.int) } : x)); persist('day-' + dt); }
      else addWorkout(dt, rec);
      o.after?.(); closeSheet(); toast(ed ? 'Session updated' : `Logged ${name}${rpe ? ` · load ${rpe * mins}` : ''}`);
      const fr = checkAchievements(); if (fr.length) setTimeout(() => toast(`Achievement unlocked: ${fr.join(', ')}`), 2700);
      refresh();
    });
  });
}
ACTIONS['edit-workout'] = (b) => { const x = exList(b.dataset.date).find((y) => y.id === b.dataset.id); if (x) openWorkoutSheet({ edit: { ...x, date: b.dataset.date } }); };
