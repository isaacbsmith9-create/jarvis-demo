// ===================== HOOPS (Edition 2): shooting analytics, ball handling, finishing, IQ & film, game analytics =====================
const LEFT_Z = ['lc3', 'lw3', 'lbm', 'le'], RIGHT_Z = ['rc3', 'rw3', 'rbm', 're'];
const sumZ = (agg, ids) => ids.reduce((a, z) => ({ m: a.m + agg[z].m, a: a.a + agg[z].a }), { m: 0, a: 0 });
function longestStreak(log) { let best = 0, cur = 0; for (const [, mk, n] of log || []) { if (n === 1 && mk) { cur++; best = Math.max(best, cur); } else if (n === 1) cur = 0; } return best; }

// Shooting tab gets location splits, movement vs stationary, per-workout %, streaks and consistency.
const _shootTypes = HOOPS.categories;
HOOPS.categories = (el) => {
  _shootTypes(el);
  const r = ui('catRange', '30'), ss = shotSessions().filter((s) => inRange(s.date, r));
  if (!ss.length) return;
  const agg = zoneAgg(ss), L = sumZ(agg, LEFT_Z), Rt = sumZ(agg, RIGHT_Z), mid = sumZ(agg, ['lbm', 'rbm', 'le', 're', 'ft']), three = sumZ(agg, ['lc3', 'lw3', 'top3', 'rw3', 'rc3']), rim = agg.lay;
  const c = catAgg(ss), add = (a, b) => ({ m: a.m + b.m, a: a.a + b.a });
  const three2 = add(three, add(c.cs3, add(c.otd3, { m: 0, a: 0 }))), fin = add(rim, c.fin), mid2 = add(mid, c.mid);
  const mv = ss.filter((s) => s.move).map(sessionTotals), st = ss.filter((s) => !s.move).map(sessionTotals);
  const agg2 = (xs) => ({ m: sum(xs.map((x) => x.m)), a: sum(xs.map((x) => x.a)) });
  const MV = agg2(mv), ST = agg2(st);
  const per = ss.map((s) => ({ s, t: sessionTotals(s) })).filter((x) => x.t.a >= 10);
  const pcts = per.map((x) => x.t.pct * 100), sd = stdev(pcts);
  const best = Math.max(0, ...ss.map((s) => s.streak || 0)), tot = agg2(ss.map(sessionTotals));
  const p = (x) => (x.a ? pctTxt(x.m / x.a) : '—');
  el.insertAdjacentHTML('beforeend', `<section class="card"><div class="card-head"><div><h3>Shooting splits</h3><span class="sub">Same range as above · court sessions and quick logs</span></div></div>
    <div class="rings">${[['3-point', three2, 'var(--purple)'], ['Midrange', mid2, 'var(--accent)'], ['Finishing', fin, 'var(--good)']].map(([l, x, col]) => ring(x.m, x.a || 1, { size: 86, stroke: 8, color: col, label: l, sub: `${x.m}/${x.a}`, center: `<b>${p(x)}</b>` })).join('')}</div>
    <div class="cmp" style="margin-top:14px"><span class="h">Split</span><span class="h">Made/Att.</span><span class="h">%</span><span class="h"></span>
      <span>Left side</span><span class="muted num">${L.m}/${L.a}</span><b>${p(L)}</b><span></span><span>Right side</span><span class="muted num">${Rt.m}/${Rt.a}</span><b>${p(Rt)}</b>${L.a >= 20 && Rt.a >= 20 ? deltaPill((Rt.m / Rt.a - L.m / L.a) * 100, false, ' pts') : '<span></span>'}
      <span>Catch-and-shoot 3</span><span class="muted num">${c.cs3.m}/${c.cs3.a}</span><b>${p(c.cs3)}</b><span></span><span>Off-the-dribble 3</span><span class="muted num">${c.otd3.m}/${c.otd3.a}</span><b>${p(c.otd3)}</b><span></span>
      <span>Movement shooting</span><span class="muted num">${MV.m}/${MV.a}</span><b>${p(MV)}</b><span></span><span>Stationary</span><span class="muted num">${ST.m}/${ST.a}</span><b>${p(ST)}</b><span></span></div>
    ${!MV.a ? '<p class="muted tiny" style="margin-top:8px">Tick "movement shooting" when you finish a session to compare it with stationary shooting.</p>' : ''}
    <div class="kpis four" style="margin-top:12px"><div class="kpi"><small>Total makes</small><b>${tot.m.toLocaleString()}</b><span class="tiny muted">of ${tot.a.toLocaleString()}</span></div><div class="kpi"><small>Best make streak</small><b>${best || '—'}</b><span class="tiny muted">in a live session</span></div><div class="kpi"><small>Consistency</small><b>${sd == null ? '—' : sd < 6 ? 'High' : sd < 10 ? 'Medium' : 'Low'}</b><span class="tiny muted">${sd == null ? 'needs 2+ sessions' : `±${r1(sd)} pts session to session`}</span></div><div class="kpi"><small>Best session</small><b>${per.length ? pctTxt(Math.max(...per.map((x) => x.t.pct))) : '—'}</b></div></div></section>
    <section class="card"><div class="card-head"><div><h3>Shooting % by workout</h3><span class="sub">Each bar is one session (10+ shots) · tap for details</span></div></div>${per.length ? '<div class="chart" id="per-wk"></div>' : '<p class="muted small">No sessions with 10+ shots in range.</p>'}</section>`);
  if (per.length) drawBars($('#per-wk'), per.slice(-24).map(({ s, t }) => ({ label: `${parseIso(s.date).getMonth() + 1}/${parseIso(s.date).getDate()}`, full: `${fmtDL(s.date)} · ${STYLES.find((x) => x[0] === s.style)?.[1] || 'Shooting'}${s.move ? ' · movement' : ''}`, segs: [{ v: Math.round(t.pct * 100), color: t.pct >= mean(per.map((x) => x.t.pct)) ? 'var(--good)' : 'var(--accent)' }], tip: `${Math.round(t.pct * 100)}% · ${t.m}/${t.a}` })), { fmt: (v) => v + '%', tick: (v) => v + '%', h: 170, goal: Math.round(mean(pcts)) });
};

// ----- ball handling -----
const COMBOS = ['Crossover', 'Between the legs', 'Behind the back', 'Hesitation', 'In-and-out', 'Spin', 'Retreat', 'Snatch back', 'Double cross', 'Between-cross'];
HOOPS.handles = (el) => {
  const hs = handleSessions(), r = ui('hRange', '90'), cur = hs.filter((s) => inRange(s.date, r));
  const mins = sum(cur.map((s) => s.mins)), weak = sum(cur.map((s) => s.weakMins || 0)), loss = sum(cur.map((s) => s.losses || 0));
  const combos = {}; for (const s of cur) for (const c of s.combos || []) combos[c] = (combos[c] || 0) + 1;
  const cod = hs.filter((s) => s.cod).map((s) => ({ date: s.date, v: s.cod, tip: `${s.cod}s` }));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Ball handling</h3><span class="sub">Weak hand, combos, change of direction, ball security</span></div><div class="row">${seg('hRange', [['30', '30D'], ['90', '90D'], ['365', '1Y'], ['all', 'All']], r)}<button type="button" class="btn sm primary" data-act="add-handles">＋ Session</button></div></div>
    ${cur.length ? `<div class="kpis four"><div class="kpi"><small>Sessions</small><b>${cur.length}</b><span class="tiny muted">${fmtDur(mins)} total</span></div><div class="kpi"><small>Weak hand share</small><b>${mins ? Math.round((weak / mins) * 100) + '%' : '—'}</b><span class="tiny muted">${fmtDur(weak)} · aim for 40%+</span></div><div class="kpi"><small>Ball security</small><b>${mins ? r1((loss / mins) * 10) : '—'}</b><span class="tiny muted">losses per 10 min</span></div><div class="kpi"><small>Best COD time</small><b>${cod.length ? Math.min(...cod.map((x) => x.v)) + 's' : '—'}</b><span class="tiny muted">cone drill</span></div></div>
      <h4 style="margin:14px 0 6px">Weak vs strong hand minutes by week</h4><div class="chart" id="h-wk"></div><div class="legend"><span><i style="background:var(--purple)"></i>Weak hand</span><span><i style="background:var(--accent)"></i>Strong hand / both</span></div>`
    : emptyState('No ball-handling sessions', 'Log minutes, how much was weak hand, the combos you drilled and ball losses. Weak-hand development and ball security trend from here.', 'ball', '<button type="button" class="btn sm primary" data-act="add-handles">Log a session</button>')}</section>
  ${cur.length ? `<div class="grid two"><section class="card"><div class="card-head"><div><h3>Combos drilled</h3><span class="sub">Sessions that included each move</span></div></div>${Object.keys(combos).length ? `<div class="stack">${Object.entries(combos).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<div><div class="row-between small"><span>${esc(c)}</span><b>${n}</b></div>${hbar((n / cur.length) * 100)}</div>`).join('')}</div><p class="muted tiny" style="margin-top:8px">Not drilled in range: ${COMBOS.filter((c) => !combos[c]).join(', ') || 'none, nice'}</p>` : '<p class="muted small">Tag combos when you log a session.</p>'}</section>
    <section class="card"><div class="card-head"><div><h3>Change of direction and ball security</h3></div></div>${cod.length >= 2 ? '<div class="chart" id="h-cod"></div>' : '<p class="muted small">Time the same cone drill each session to see change-of-direction progress (needs 2 timed sessions).</p>'}<div class="chart" id="h-loss" style="margin-top:10px"></div></section></div>
    <section class="card"><div class="card-head"><h3>Sessions</h3></div><div class="list">${[...cur].reverse().slice(0, 20).map((s) => `<div class="li"><div><div class="t">${esc(fmtDL(s.date))} · ${fmtDur(s.mins)}</div><div class="s">${s.weakMins || 0} min weak · ${s.losses || 0} losses${s.cod ? ` · COD ${s.cod}s` : ''}${(s.combos || []).length ? ' · ' + esc(s.combos.join(', ')) : ''}</div></div><button type="button" class="chip" data-act="del-dev" data-doc="aos-handles" data-id="${s.id}">Delete</button></div>`).join('')}</div></section>` : ''}`;
  if (!cur.length) return;
  const wk = []; for (let i = 7; i >= 0; i--) { const m = shiftIso(mondayOf(todayIso()), -7 * i), xs = hs.filter((s) => s.date >= m && s.date <= shiftIso(m, 6)), wm = sum(xs.map((s) => s.weakMins || 0)), tm = sum(xs.map((s) => s.mins)); wk.push({ label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: [{ v: wm, color: 'var(--purple)' }, { v: Math.max(0, tm - wm), color: 'var(--accent)' }], tip: tm ? `${tm} min · ${Math.round((wm / tm) * 100)}% weak hand` : 'none' }); }
  drawBars($('#h-wk'), wk, { fmt: (v) => v + ' min', h: 160 });
  if (cod.length >= 2) drawLine($('#h-cod'), cod, { fmt: (v) => v + 's', h: 140, color: 'var(--good)', label: 'Change-of-direction time' });
  drawLine($('#h-loss'), cur.filter((s) => s.mins).map((s) => ({ date: s.date, v: r1(((s.losses || 0) / s.mins) * 10), tip: `${s.losses || 0} losses in ${s.mins} min` })), { fmt: (v) => v + ' per 10 min', h: 140, color: 'var(--over)', yMin: 0, label: 'Ball losses per 10 minutes' });
};
ACTIONS['add-handles'] = () => {
  const drills = DRILLS.filter((d) => d[2] === 'Ball handling');
  openSheet('Ball-handling session', `<div class="fields"><label>Date<input type="date" id="bh-date" value="${todayIso()}" max="${todayIso()}"></label><label>Total minutes<input type="number" id="bh-mins" min="5" max="240" value="30" inputmode="numeric"></label>
    <label>Weak-hand minutes<input type="number" id="bh-weak" min="0" max="240" value="10" inputmode="numeric"></label><label>Ball losses (fumbles, kicked balls)<input type="number" id="bh-loss" min="0" max="200" value="0" inputmode="numeric"></label>
    <label class="full">Cone drill time (s, optional)<input type="number" id="bh-cod" step="0.01" min="3" max="120" inputmode="decimal" placeholder="Same course every time"></label></div>
    <div><p class="muted small" style="margin-bottom:6px">Combos drilled</p><div class="chips" id="bh-c">${COMBOS.map((c) => `<button type="button" class="chip" data-combo="${c}">${c}</button>`).join('')}</div></div>
    <div><p class="muted small" style="margin-bottom:6px">Drills</p><div class="chips" id="bh-d">${drills.map((d) => `<button type="button" class="chip" data-drill="${d[0]}">${d[1]}</button>`).join('')}</div></div>
    <label>Notes<input id="bh-note" maxlength="160"></label><label class="check"><input type="checkbox" id="bh-ex" checked> Also log it as a skill workout</label>
    <button type="button" class="btn primary" id="bh-save">Save session</button>`, (d) => {
    d.addEventListener('click', (e) => { const c = e.target.closest('[data-combo],[data-drill]'); if (c) c.classList.toggle('on'); });
    $('#bh-save', d).addEventListener('click', () => {
      const mins = Math.round(Number($('#bh-mins', d).value)), weak = Math.round(Number($('#bh-weak', d).value) || 0), cod = Number($('#bh-cod', d).value) || null;
      if (!(mins >= 5)) return toast('Minutes must be 5 or more'); if (weak > mins) return toast('Weak-hand minutes can\'t exceed the total');
      const s = { id: uid('h'), date: $('#bh-date', d).value || todayIso(), mins, weakMins: weak, losses: Math.round(Number($('#bh-loss', d).value) || 0), cod, combos: $$('[data-combo].on', d).map((x) => x.dataset.combo), drills: $$('[data-drill].on', d).map((x) => x.dataset.drill), note: $('#bh-note', d).value.trim().slice(0, 160) };
      const H = doc('aos-handles'); H.sessions = [...(H.sessions || []), s]; persist('aos-handles');
      if ($('#bh-ex', d).checked) addWorkout(s.date, { type: 'skill', name: 'Ball handling', mins, int: 'moderate', notes: s.combos.join(', '), source: 'athlete-os' });
      if (cod) { const prev = handleSessions().filter((x) => x.id !== s.id && x.cod).map((x) => x.cod); if (prev.length && cod < Math.min(...prev)) celebrate('Fastest cone drill', cod + 's', `Previous best ${Math.min(...prev)}s`); }
      closeSheet(); toast('Session saved'); refresh();
    });
  });
};
ACTIONS['del-dev'] = (b) => confirmSheet('Delete this entry?', 'Delete', () => { const D = doc(b.dataset.doc), k = D.sessions ? 'sessions' : 'entries'; D[k] = (D[k] || []).filter((x) => x.id !== b.dataset.id); persist(b.dataset.doc); refresh(); });

// ----- finishing -----
HOOPS.finishing = (el) => {
  const r = ui('fRange', '90'), fs = finishSessions(), cur = fs.filter((s) => inRange(s.date, r)), T = finishTotals(cur);
  const p = (x) => (x.a ? pctTxt(x.m / x.a) : '—');
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Finishing</h3><span class="sub">By finish type and hand · contact finishing</span></div><div class="row">${seg('fRange', [['30', '30D'], ['90', '90D'], ['365', '1Y'], ['all', 'All']], r)}<button type="button" class="btn sm primary" data-act="add-finish">＋ Session</button></div></div>
    ${T.a ? `<div class="rings">${ring(T.m, T.a, { size: 96, stroke: 9, color: 'var(--good)', label: 'Overall', sub: `${T.m}/${T.a}`, center: `<b>${p(T)}</b>` })}${ring(T.L.m, T.L.a || 1, { size: 96, stroke: 9, color: 'var(--purple)', label: 'Left hand', sub: `${T.L.m}/${T.L.a}`, center: `<b>${p(T.L)}</b>` })}${ring(T.R.m, T.R.a || 1, { size: 96, stroke: 9, color: 'var(--accent)', label: 'Right hand', sub: `${T.R.m}/${T.R.a}`, center: `<b>${p(T.R)}</b>` })}${ring(T.by.contact.m, T.by.contact.a || 1, { size: 96, stroke: 9, color: 'var(--over)', label: 'Contact', sub: `${T.by.contact.m}/${T.by.contact.a}`, center: `<b>${p(T.by.contact)}</b>` })}</div>
      <h4 style="margin:16px 0 6px">By finish type (left vs right)</h4><div class="chart" id="f-type"></div><div class="legend"><span><i style="background:var(--purple)"></i>Left</span><span><i style="background:var(--accent)"></i>Right</span></div>
      <div class="cmp" style="margin-top:12px"><span class="h">Type</span><span class="h">Left</span><span class="h">Right</span><span class="h">All</span>${FINISH_TYPES.filter(([k]) => T.by[k].a).map(([k, l]) => `<span>${l}</span><span class="muted num">${p(T.by[k].L)} <span class="tiny">(${T.by[k].L.a})</span></span><span class="muted num">${p(T.by[k].R)} <span class="tiny">(${T.by[k].R.a})</span></span><b>${p(T.by[k])}</b>`).join('')}</div>`
    : emptyState('No finishing sessions', 'Log makes and attempts by finish type and hand (layups, reverses, floaters, euro, contact, scoops, power). Weak-hand finishing is where guards separate.', 'ball', '<button type="button" class="btn sm primary" data-act="add-finish">Log a session</button>')}</section>
  ${fs.length >= 2 ? `<section class="card"><div class="card-head"><div><h3>Finishing trend</h3><span class="sub">% per session</span></div></div><div class="chart" id="f-trend"></div></section>` : ''}
  ${cur.length ? `<section class="card"><div class="card-head"><h3>Sessions</h3></div><div class="list">${[...cur].reverse().slice(0, 20).map((s) => { const t = finishTotals([s]); return `<div class="li"><div><div class="t">${esc(fmtDL(s.date))} · ${t.m}/${t.a}</div><div class="s">Left ${t.L.m}/${t.L.a} · right ${t.R.m}/${t.R.a}${s.note ? ' · ' + esc(s.note) : ''}</div></div><div class="row"><span class="v">${p(t)}</span><button type="button" class="chip" data-act="del-dev" data-doc="aos-finish" data-id="${s.id}">Delete</button></div></div>`; }).join('')}</div></section>` : ''}`;
  if (T.a) drawGroupedBars($('#f-type'), FINISH_TYPES.filter(([k]) => T.by[k].a).map(([k, l]) => ({ label: l.split(' ')[0], full: l, a: T.by[k].L, b: T.by[k].R })));
  if (fs.length >= 2) drawLine($('#f-trend'), fs.map((s) => { const t = finishTotals([s]); return t.a ? { date: s.date, v: r1((t.m / t.a) * 100), tip: `${Math.round((t.m / t.a) * 100)}% (${t.m}/${t.a})` } : null; }).filter(Boolean), { fmt: (v) => Math.round(v) + '%', color: 'var(--good)', label: 'Finishing %' });
};
/** Two bars per group (left / right percentages). */
function drawGroupedBars(el, groups) {
  drawBars(el, groups.flatMap((g) => [
    { label: g.label, full: g.full + ' · left', segs: [{ v: g.a.a ? Math.round((g.a.m / g.a.a) * 100) : 0, color: 'var(--purple)' }], tip: g.a.a ? `Left ${Math.round((g.a.m / g.a.a) * 100)}% (${g.a.m}/${g.a.a})` : 'Left: none' },
    { label: '', full: g.full + ' · right', segs: [{ v: g.b.a ? Math.round((g.b.m / g.b.a) * 100) : 0, color: 'var(--accent)' }], tip: g.b.a ? `Right ${Math.round((g.b.m / g.b.a) * 100)}% (${g.b.m}/${g.b.a})` : 'Right: none' },
  ]), { fmt: (v) => v + '%', tick: (v) => v + '%', h: 180 });
}
ACTIONS['add-finish'] = () => openSheet('Finishing session', `<div class="fields"><label>Date<input type="date" id="fi-date" value="${todayIso()}" max="${todayIso()}"></label><label>Minutes (optional)<input type="number" id="fi-mins" min="5" max="240" inputmode="numeric"></label></div>
  <div class="cmp" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span class="h">Type</span><span class="h">Left made/att</span><span class="h">Right made/att</span>
  ${FINISH_TYPES.map(([k, l]) => `<span class="small">${l}</span>${['L', 'R'].map((h) => `<span class="row" style="flex-wrap:nowrap;gap:4px"><input type="number" min="0" data-fm="${k}${h}" placeholder="M" inputmode="numeric" style="padding:8px 6px"><input type="number" min="0" data-fa="${k}${h}" placeholder="A" inputmode="numeric" style="padding:8px 6px"></span>`).join('')}`).join('')}</div>
  <label>Notes<input id="fi-note" maxlength="160"></label><button type="button" class="btn primary" id="fi-save">Save session</button>`, (d) => {
  $('#fi-save', d).addEventListener('click', () => {
    const rows = {};
    for (const [k, l] of FINISH_TYPES) for (const h of ['L', 'R']) { const m = Number($(`[data-fm="${k}${h}"]`, d).value), a = Number($(`[data-fa="${k}${h}"]`, d).value); if (!m && !a) continue; if (!(a > 0 && m >= 0 && m <= a)) return toast(`${l} ${h === 'L' ? 'left' : 'right'}: made must be 0 to attempts`); rows[k] = rows[k] || {}; rows[k][h] = { m: Math.round(m), a: Math.round(a) }; }
    if (!Object.keys(rows).length) return toast('Enter at least one row');
    const s = { id: uid('f'), date: $('#fi-date', d).value || todayIso(), rows, note: $('#fi-note', d).value.trim().slice(0, 160) };
    const F = doc('aos-finish'); F.sessions = [...(F.sessions || []), s]; persist('aos-finish');
    const mins = Number($('#fi-mins', d).value); if (mins >= 5) addWorkout(s.date, { type: 'skill', name: 'Finishing', mins: Math.round(mins), int: 'moderate', source: 'athlete-os' });
    closeSheet(); toast('Finishing saved'); refresh();
  });
});

// ----- basketball IQ and film -----
const FILM_TYPES = [['film', 'Game film'], ['study', 'Player study'], ['obs', 'Game observation'], ['pnr', 'Pick-and-roll reads'], ['def', 'Defensive recognition']];
HOOPS.iq = (el) => {
  const fs = filmEntries(), q = ui('fq', ''), mins30 = sum(fs.filter((f) => inRange(f.date, '30')).map((f) => f.mins || 0));
  const acc = (type) => { const xs = fs.filter((f) => f.type === type && f.reads); return { r: sum(xs.map((f) => f.reads)), c: sum(xs.map((f) => f.correct || 0)), ser: xs.map((f) => ({ date: f.date, v: Math.round(((f.correct || 0) / f.reads) * 100), tip: `${f.correct}/${f.reads} correct` })) }; };
  const P = acc('pnr'), D = acc('def');
  const players = {}; for (const f of fs) if (f.player) (players[f.player] = players[f.player] || []).push(f);
  const shown = fs.filter((f) => !q || `${f.title} ${f.player} ${f.notes} ${f.takeaways} ${(f.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())).reverse();
  const iqGoals = goals().filter((g) => g.source === 'film:mins30' || /iq|film|read|decision/i.test(g.title));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Basketball IQ</h3><span class="sub">Film study, game observation, pick-and-roll reads, defensive recognition</span></div><button type="button" class="btn sm primary" data-act="add-film">＋ Entry</button></div>
    ${fs.length ? `<div class="kpis four"><div class="kpi"><small>Film (30 days)</small><b>${mins30}</b><span class="tiny muted">minutes</span></div><div class="kpi"><small>Entries</small><b>${fs.length}</b></div><div class="kpi"><small>PnR read accuracy</small><b>${P.r ? pctTxt(P.c / P.r) : '—'}</b><span class="tiny muted">${P.c}/${P.r} reads</span></div><div class="kpi"><small>Defensive recognition</small><b>${D.r ? pctTxt(D.c / D.r) : '—'}</b><span class="tiny muted">${D.c}/${D.r}</span></div></div>
      <h4 style="margin:14px 0 6px">Film minutes per week</h4><div class="chart" id="film-wk"></div>`
    : emptyState('Start your film log', 'Log film sessions, notes from games you watch, and your pick-and-roll and defensive reads (how many you got right). Your IQ rating comes from this.', 'spark', '<button type="button" class="btn sm primary" data-act="add-film">Add an entry</button>')}</section>
  ${P.ser.length >= 2 || D.ser.length >= 2 ? `<section class="card"><div class="card-head"><div><h3>Read accuracy trend</h3><span class="sub">% of reads you got right per session</span></div></div>${P.ser.length >= 2 ? '<h4 style="margin-bottom:4px">Pick-and-roll</h4><div class="chart" id="pnr-acc"></div>' : ''}${D.ser.length >= 2 ? '<h4 style="margin:10px 0 4px">Defense</h4><div class="chart" id="def-acc"></div>' : ''}</section>` : ''}
  <section class="card"><div class="card-head"><div><h3>IQ development goals</h3></div><button type="button" class="btn sm" data-act="goal">＋ Goal</button></div>${iqGoals.length ? `<div class="list">${iqGoals.map((g) => { const s = goalState(g); return `<button type="button" class="li li-btn" data-goal="${g.id}" data-go="train-goals" style="display:block"><div class="row-between"><span class="t">${esc(g.title)}</span><b>${s.pct}%</b></div>${hbar(s.pct)}</button>`; }).join('')}</div>` : '<p class="muted small">Create a goal like "60 minutes of film a week" (track it with "Film study minutes").</p>'}</section>
  ${Object.keys(players).length ? `<section class="card"><div class="card-head"><div><h3>Player study library</h3><span class="sub">Players you've studied and what you took from them</span></div></div><div class="list">${Object.entries(players).sort((a, b) => b[1].length - a[1].length).map(([p, xs]) => `<details class="li" style="display:block"><summary class="row-between" style="cursor:pointer"><span class="t">${esc(p)}</span><span class="tiny muted">${xs.length} session${xs.length === 1 ? '' : 's'} · ${sum(xs.map((x) => x.mins || 0))} min</span></summary><ul class="small" style="margin:8px 0 0;padding-left:18px">${xs.filter((x) => x.takeaways || x.notes).map((x) => `<li>${esc(x.takeaways || x.notes)} <span class="muted tiny">(${esc(fmtD(x.date))})</span></li>`).join('') || '<li class="muted">No takeaways written yet.</li>'}</ul></details>`).join('')}</div></section>` : ''}
  ${fs.length ? `<section class="card"><div class="card-head"><h3>Film library</h3></div><input id="fq" placeholder="Search notes, players, tags…" value="${esc(q)}" style="margin-bottom:10px"><div class="list">${shown.slice(0, 40).map((f) => `<div class="li" style="align-items:flex-start"><div><div class="t">${esc(f.title || FILM_TYPES.find((x) => x[0] === f.type)?.[1])}</div><div class="s">${esc(fmtD(f.date))} · ${esc(FILM_TYPES.find((x) => x[0] === f.type)?.[1] || '')}${f.mins ? ' · ' + f.mins + ' min' : ''}${f.player ? ' · ' + esc(f.player) : ''}${f.reads ? ` · ${f.correct}/${f.reads} reads` : ''}</div>${f.takeaways ? `<div class="s">💡 ${esc(f.takeaways)}</div>` : ''}${f.notes ? `<div class="s">${esc(f.notes)}</div>` : ''}${(f.tags || []).length ? `<div class="chips" style="margin-top:4px">${f.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div><button type="button" class="chip" data-act="del-dev" data-doc="aos-film" data-id="${f.id}">Delete</button></div>`).join('') || '<p class="muted small">No matches.</p>'}</div></section>` : ''}`;
  if (fs.length) { const wk = []; for (let i = 7; i >= 0; i--) { const m = shiftIso(mondayOf(todayIso()), -7 * i), v = sum(fs.filter((f) => f.date >= m && f.date <= shiftIso(m, 6)).map((f) => f.mins || 0)); wk.push({ label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: [{ v, color: 'var(--purple)' }], tip: `${v} min` }); } drawBars($('#film-wk'), wk, { h: 150, fmt: (v) => v + ' min' }); }
  if (P.ser.length >= 2) drawLine($('#pnr-acc'), P.ser, { fmt: (v) => v + '%', yMin: 0, yMax: 100, h: 150, color: 'var(--purple)' });
  if (D.ser.length >= 2) drawLine($('#def-acc'), D.ser, { fmt: (v) => v + '%', yMin: 0, yMax: 100, h: 150, color: 'var(--danger)' });
  $('#fq')?.addEventListener('input', (e) => { setUi('fq', e.target.value); clearTimeout(HOOPS.t); HOOPS.t = setTimeout(() => { refresh(); const i = $('#fq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
};
ACTIONS['add-film'] = (b) => openSheet('IQ / film entry', `<div class="fields"><label>Type<select id="fl-type">${FILM_TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label>Date<input type="date" id="fl-date" value="${b?.dataset?.date || todayIso()}" max="${todayIso()}"></label>
  <label class="full">Title<input id="fl-title" maxlength="60" placeholder="Last game vs Central, Chris Paul PnR reads…"></label>
  <label>Player or team studied<input id="fl-player" maxlength="40" placeholder="Optional"></label><label>Minutes<input type="number" id="fl-mins" min="0" max="300" inputmode="numeric"></label>
  <label>Reads tracked<input type="number" id="fl-reads" min="0" max="500" inputmode="numeric" placeholder="e.g. 20"></label><label>Read correctly<input type="number" id="fl-correct" min="0" max="500" inputmode="numeric" placeholder="e.g. 14"></label>
  <label class="full">Key takeaway<input id="fl-take" maxlength="200" placeholder="Reject the screen when the big is high"></label>
  <label class="full">Notes<textarea id="fl-notes" maxlength="800"></textarea></label><label class="full">Tags (comma-separated)<input id="fl-tags" maxlength="100" placeholder="pnr, transition, defense"></label></div>
  <button type="button" class="btn primary" id="fl-save">Save entry</button>`, (d) => {
  $('#fl-save', d).addEventListener('click', () => {
    const reads = Math.round(Number($('#fl-reads', d).value) || 0), correct = Math.round(Number($('#fl-correct', d).value) || 0);
    if (correct > reads) return toast('Correct reads can\'t exceed reads tracked');
    const f = { id: uid('fl'), type: $('#fl-type', d).value, date: $('#fl-date', d).value || todayIso(), title: $('#fl-title', d).value.trim().slice(0, 60), player: $('#fl-player', d).value.trim().slice(0, 40), mins: Math.round(Number($('#fl-mins', d).value) || 0), reads: reads || null, correct: reads ? correct : null, takeaways: $('#fl-take', d).value.trim().slice(0, 200), notes: $('#fl-notes', d).value.trim().slice(0, 800), tags: $('#fl-tags', d).value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8) };
    if (!f.title && !f.notes && !f.takeaways && !f.mins) return toast('Add a title, minutes or a note');
    const F = doc('aos-film'); F.entries = [...(F.entries || []), f]; persist('aos-film'); closeSheet(); toast('Saved to your film log'); refresh();
  });
});

// ----- game analytics -----
const _games = HOOPS.games;
HOOPS.games = (el) => {
  _games(el);
  const gs = games(); if (!gs.length) return;
  const stat = ui('gStat', 'gs'), STATS = [['gs', 'Game Score'], ['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['tov', 'Turnovers'], ['ts', 'True shooting %']];
  const val = (g) => (stat === 'gs' ? gameScore(g) : stat === 'ts' ? (tsPct(g) == null ? null : r1(tsPct(g) * 100)) : g[stat] ?? null);
  const scores = gs.map(gameScore).filter((x) => x != null), cv = scores.length >= 3 ? stdev(scores) / Math.max(1, mean(scores)) : null;
  const n = (k) => sum(gs.map((g) => Number(g[k]) || 0)), tsAll = (() => { const d = 2 * (n('fga') + 0.44 * n('fta')); return d ? n('pts') / d : null; })(), efgAll = n('fga') ? (n('fgm') + 0.5 * n('tpm')) / n('fga') : null;
  const best = [...gs].filter((g) => gameScore(g) != null).sort((a, b) => gameScore(b) - gameScore(a)).slice(0, 3);
  el.insertAdjacentHTML('beforeend', `<section class="card"><div class="card-head"><div><h3>Advanced efficiency</h3><span class="sub">Season to date</span></div></div>
    <div class="kpis four"><div class="kpi"><small>True shooting</small><b>${pctTxt(tsAll)}</b><span class="tiny muted">points per shot incl. FTs</span></div><div class="kpi"><small>Effective FG</small><b>${pctTxt(efgAll)}</b><span class="tiny muted">3s count 1.5x</span></div><div class="kpi"><small>Avg Game Score</small><b>${scores.length ? r1(mean(scores)) : '—'}</b><span class="tiny muted">10 = solid, 15+ = great</span></div><div class="kpi"><small>Consistency</small><b>${cv == null ? '—' : cv < 0.35 ? 'High' : cv < 0.6 ? 'Medium' : 'Low'}</b><span class="tiny muted">${cv == null ? 'needs 3 games' : `Game Score varies ±${r1(stdev(scores))}`}</span></div></div></section>
    <section class="card"><div class="card-head"><div><h3>Game by game</h3></div><select id="g-stat" style="max-width:190px" aria-label="Stat">${STATS.map(([k, l]) => `<option value="${k}" ${k === stat ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="chart" id="g-chart"></div></section>
    ${best.length ? `<section class="card"><div class="card-head"><div><h3>Best performances</h3><span class="sub">By Game Score</span></div></div><div class="list">${best.map((g, i) => `<div class="li"><div><div class="t">${['🥇', '🥈', '🥉'][i]} ${esc(fmtDL(g.date))}${g.opp ? ' vs ' + esc(g.opp) : ''}</div><div class="s">${g.pts ?? 0} pts · ${g.reb ?? 0} reb · ${g.ast ?? 0} ast${g.fga ? ` · ${g.fgm}/${g.fga} FG` : ''}</div></div><span class="v">${gameScore(g)}</span></div>`).join('')}</div></section>` : ''}`);
  const pts = gs.map((g) => ({ date: g.date, v: val(g), tip: `${val(g)}${g.opp ? ' vs ' + g.opp : ''}` })).filter((p) => p.v != null);
  if (pts.length) drawBars($('#g-chart'), pts.map((p) => ({ label: `${parseIso(p.date).getMonth() + 1}/${parseIso(p.date).getDate()}`, full: fmtDL(p.date), segs: [{ v: Math.max(0, p.v), color: stat === 'tov' ? 'var(--over)' : 'var(--accent)' }], tip: p.tip })), { goal: Math.round(mean(pts.map((p) => p.v)) * 10) / 10, h: 180 });
  else $('#g-chart').innerHTML = '<p class="muted small">Not recorded in your games yet.</p>';
  $('#g-stat').addEventListener('change', (e) => { setUi('gStat', e.target.value); refresh(); });
};
