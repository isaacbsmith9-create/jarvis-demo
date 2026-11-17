// ===================== HOOPS: basketball development center =====================
RENDER.hoops = (el, sub) => HOOPS[sub](el);
const HOOPS = {};
const STYLES = [['cs', 'Catch-and-shoot'], ['otd', 'Off the dribble'], ['mixed', 'Mixed / drills'], ['game', 'Game shots']];
// A live session (not saved until "Finish").
let live = null;
const liveKey = 'aos-live-shots';
try { live = JSON.parse(localStorage.getItem(liveKey) || 'null'); } catch {}
const saveLive = () => { try { localStorage.setItem(liveKey, JSON.stringify(live)); } catch {} };

HOOPS.court = (el) => {
  if (live) return liveSession(el);
  const r = ui('courtRange', '30'), sessions = shotSessions().filter((s) => inRange(s.date, r));
  const agg = zoneAgg(sessions), sel = ui('zone', null);
  const tot = sessions.map(sessionTotals), m = sum(tot.map((x) => x.m)), a = sum(tot.map((x) => x.a)), m3 = sum(tot.map((x) => x.m3)), a3 = sum(tot.map((x) => x.a3));
  const zs = ZONES.map((z) => ({ z, ...agg[z.id], pct: agg[z.id].a ? agg[z.id].m / agg[z.id].a : null })).filter((x) => x.a >= 10);
  const rel = (x) => x.pct - (x.z.pts === 3 ? 0.35 : x.z.pts === 1 ? 0.72 : 0.45);
  const hot = [...zs].sort((p, q) => rel(q) - rel(p)).filter((x) => rel(x) > 0).slice(0, 3), cold = [...zs].sort((p, q) => rel(p) - rel(q)).filter((x) => rel(x) < 0).slice(0, 3);
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Shot chart</h3><span class="sub">Shooting % by spot · tap a zone for its trend</span></div><div class="row">${seg('courtRange', RANGES, r)}</div></div>
    <div class="court-wrap" id="court">${courtSvg(agg, { selected: sel })}</div>
    <div class="legend" style="justify-content:center"><span><i style="background:#2563eb"></i>Cold</span><span><i style="background:#8b5cff"></i>Average for that distance</span><span><i style="background:#ff6a3d"></i>Hot</span></div>
    <div id="zone-detail"></div>
    <div class="kpis four" style="margin-top:12px">
      <div class="kpi"><small>Field goal %</small><b>${pctTxt(a ? m / a : null)}</b><span class="tiny muted">${m}/${a} makes</span></div>
      <div class="kpi"><small>3-point %</small><b>${pctTxt(a3 ? m3 / a3 : null)}</b><span class="tiny muted">${m3}/${a3}</span></div>
      <div class="kpi"><small>Sessions</small><b>${sessions.length}</b><span class="tiny muted">in range</span></div>
      <div class="kpi"><small>Shots / session</small><b>${sessions.length ? Math.round(a / sessions.length) : '—'}</b></div>
    </div>
    <button type="button" class="btn primary block" data-act="shoot" style="margin-top:12px">● Start a shooting session</button>
  </section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>🔥 Hot zones</h3><span class="sub">Above average for the distance · 10+ shots</span></div></div>${hot.length ? zoneList(hot) : '<p class="muted small">Need 10+ shots in a zone, above the typical % for that distance.</p>'}</section>
    <section class="card"><div class="card-head"><div><h3>🧊 Cold zones</h3><span class="sub">Where extra reps will pay off most</span></div></div>${cold.length ? zoneList(cold) : '<p class="muted small">Need 10+ shots in a zone, below the typical % for that distance.</p>'}</section>
  </div>
  <section class="card"><div class="card-head"><div><h3>Session history</h3><span class="sub">All sessions · tap to delete</span></div><button type="button" class="btn sm" data-act="quick-shots">Quick log totals</button></div>${sessionHistory()}</section>`;
  if (sel) zoneDetail($('#zone-detail'), sel);
};
const zoneList = (xs) => `<div class="list">${xs.map((x) => `<div class="li"><div><div class="t">${esc(x.z.name)}</div><div class="s">${x.m}/${x.a}</div></div><span class="v">${pctTxt(x.pct)}</span></div>`).join('')}</div>`;
function zoneDetail(el, id) {
  const z = ZONES.find((x) => x.id === id); if (!z) return;
  const pts = shotSessions().map((s) => ({ date: s.date, v: s.spots?.[id] })).filter((p) => p.v?.a);
  const byDay = {}; for (const p of pts) { byDay[p.date] = byDay[p.date] || { m: 0, a: 0 }; byDay[p.date].m += p.v.m; byDay[p.date].a += p.v.a; }
  const ser = Object.entries(byDay).map(([date, v]) => ({ date, v: r1((v.m / v.a) * 100), tip: `${Math.round((v.m / v.a) * 100)}% (${v.m}/${v.a})` }));
  el.innerHTML = `<div class="notice" style="margin-top:10px"><div class="row-between"><b style="color:var(--fg)">${esc(z.name)}</b><button type="button" class="chip" data-zone-close>Close</button></div>${ser.length >= 2 ? '<div class="chart" id="zone-chart" style="margin-top:6px"></div>' : `<p style="margin-top:6px">${ser.length ? 'One day logged here so far. A trend needs two.' : 'No shots logged from here yet.'}</p>`}</div>`;
  if (ser.length >= 2) drawLine($('#zone-chart'), ser, { fmt: (v) => Math.round(v) + '%', h: 150, label: z.name + ' shooting %' });
}
function sessionHistory() {
  const ss = [...shotSessions()].reverse().slice(0, 30);
  if (!ss.length) return emptyState('No shooting sessions yet', 'Start a session and tap makes and misses by spot, or quick-log totals after a workout.', 'ball');
  return `<div class="list">${ss.map((s) => { const t = sessionTotals(s); return `<div class="li"><div><div class="t">${esc(fmtDL(s.date))} · ${esc(STYLES.find((x) => x[0] === s.style)?.[1] || 'Shooting')}</div><div class="s">${t.m}/${t.a}${t.a3 ? ` · 3PT ${t.m3}/${t.a3}` : ''}${s.note ? ' · ' + esc(s.note) : ''}</div></div><div class="row"><span class="v">${pctTxt(t.pct)}</span><button type="button" class="chip" data-act="del-shots" data-id="${s.id}">Delete</button></div></div>`; }).join('')}</div>`;
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-zone-close]')) { setUi('zone', null); return refresh(); }
  const z = e.target.closest('.court [data-zone]'); if (!z || state.view !== 'hoops') return;
  if (live) { live.zone = z.dataset.zone; saveLive(); return refresh(); }
  setUi('zone', ui('zone') === z.dataset.zone ? null : z.dataset.zone); refresh();
});

// ----- live session -----
ACTIONS.shoot = () => { live = { id: uid('s'), date: todayIso(), at: Date.now(), style: 'cs', zone: 'top3', spots: {}, log: [] }; saveLive(); go('hoops', 'court'); };
function liveSession(el) {
  const z = ZONES.find((x) => x.id === live.zone) || ZONES[0], v = live.spots[z.id] || { m: 0, a: 0 };
  const t = sessionTotals(live);
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Shooting session <span class="tag blue" style="font-size:11px">LIVE</span></h3><span class="sub">Tap a spot on the court, then Make or Miss</span></div><button type="button" class="btn sm danger" data-shot="discard">Discard</button></div>
    <div class="row" style="margin-bottom:10px"><label style="flex:1">Shot type<select id="live-style">${STYLES.map(([k, l]) => `<option value="${k}" ${k === live.style ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label style="flex:1">Date<input type="date" id="live-date" value="${live.date}" max="${todayIso()}"></label></div>
    <div class="court-wrap">${courtSvg(live.spots, { selected: z.id })}</div>
    <div class="row-between" style="margin:12px 0 8px"><div><b style="font-family:var(--f-display);font-size:18px">${esc(z.name)}</b><div class="muted small">${v.m}/${v.a} here · ${pctTxt(v.a ? v.m / v.a : null)}</div></div><div style="text-align:right"><div class="big" style="font-size:26px">${pctTxt(t.pct)}</div><div class="muted small">${t.m}/${t.a} session</div></div></div>
    <div class="counter"><button type="button" class="btn miss" data-shot="miss">✕ Miss</button><button type="button" class="btn sm" data-shot="undo" ${live.log.length ? '' : 'disabled'}>Undo</button><button type="button" class="btn make" data-shot="make">● Make</button></div>
    <details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Enter a batch for ${esc(z.name)} (e.g. 7 of 10)</summary>
      <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input type="number" id="b-m" min="0" max="500" placeholder="Made" inputmode="numeric"><input type="number" id="b-a" min="1" max="500" placeholder="Attempts" inputmode="numeric"><button type="button" class="btn sm" data-shot="batch">Add</button></div></details>
    <div class="hr"></div>
    <div class="fields"><label>Minutes (to log the workout)<input type="number" id="live-mins" min="5" max="300" value="${live.mins || 45}"></label><label>Note<input id="live-note" maxlength="120" placeholder="Optional" value="${esc(live.note || '')}"></label>
      <label class="check full"><input type="checkbox" id="live-ex" ${live.noEx ? '' : 'checked'}> Also log it as a Shooting workout (training volume and MacroLens calories)</label></div>
    <button type="button" class="btn primary block" data-shot="finish" style="margin-top:12px" ${t.a ? '' : 'disabled'}>Finish and save session</button>
  </section>`;
  $('#live-style').addEventListener('change', (e) => { live.style = e.target.value; saveLive(); });
  $('#live-date').addEventListener('change', (e) => { if (e.target.value) { live.date = e.target.value; saveLive(); } });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-shot]'); if (!b || !live) return;
  const k = b.dataset.shot, z = live.zone;
  if (k === 'make' || k === 'miss') { const v = live.spots[z] || { m: 0, a: 0 }; v.a++; if (k === 'make') v.m++; live.spots[z] = v; live.log.push([z, k === 'make' ? 1 : 0, 1]); if (navigator.vibrate) navigator.vibrate(k === 'make' ? 12 : [6, 30, 6]); }
  else if (k === 'undo') { const [zz, mk, n] = live.log.pop() || []; if (zz) { const v = live.spots[zz]; v.a -= n; v.m -= mk; if (v.a <= 0) delete live.spots[zz]; } }
  else if (k === 'batch') { const m = Math.round(Number($('#b-m').value)), a = Math.round(Number($('#b-a').value)); if (!(a > 0 && m >= 0 && m <= a)) return toast('Made must be between 0 and attempts'); const v = live.spots[z] || { m: 0, a: 0 }; v.m += m; v.a += a; live.spots[z] = v; live.log.push([z, m, a]); }
  else if (k === 'discard') return confirmSheet('Discard this session? Nothing will be saved.', 'Discard', () => { live = null; try { localStorage.removeItem(liveKey); } catch {} refresh(); });
  else if (k === 'finish') {
    const mins = Math.round(Number($('#live-mins').value) || 0), note = $('#live-note').value.trim(), logEx = $('#live-ex').checked;
    const s = { id: live.id, date: live.date, at: live.at, style: live.style, spots: live.spots, note: note.slice(0, 120) };
    doc('aos-shots').sessions = [...(doc('aos-shots').sessions || []), s]; persist('aos-shots'); mirrorCourtLab();
    const t = sessionTotals(s);
    if (logEx && mins >= 5) addWorkout(s.date, { type: s.style === 'game' ? 'game' : 'shooting', name: 'Shooting', mins, int: 'moderate', notes: `${t.m}/${t.a} (${pctTxt(t.pct)})`, source: 'athlete-os' });
    live = null; localStorage.removeItem(liveKey);
    toast(`Saved: ${t.m}/${t.a} · ${pctTxt(t.pct)}`);
    checkShootingPRs(s);
    return refresh();
  }
  saveLive(); refresh();
});
document.addEventListener('change', (e) => { if (!live) return; if (e.target.id === 'live-mins') { live.mins = Number(e.target.value); saveLive(); } if (e.target.id === 'live-note') { live.note = e.target.value; saveLive(); } if (e.target.id === 'live-ex') { live.noEx = !e.target.checked; saveLive(); } });
// Best session % at 25+ attempts counts as a shooting record.
function checkShootingPRs(s) {
  const t = sessionTotals(s); if (t.a < 25) return;
  const prev = shotSessions().filter((x) => x.id !== s.id).map(sessionTotals).filter((x) => x.a >= 25);
  if (prev.length && prev.every((x) => t.pct > x.pct)) celebrate('Best shooting session', pctTxt(t.pct), `${t.m}/${t.a} · previous best ${pctTxt(Math.max(...prev.map((x) => x.pct)))}`);
}
ACTIONS['del-shots'] = (b) => confirmSheet('Delete this shooting session?', 'Delete', () => { doc('aos-shots').sessions = (doc('aos-shots').sessions || []).filter((s) => s.id !== b.dataset.id); persist('aos-shots'); mirrorCourtLab(); refresh(); toast('Session deleted'); });
ACTIONS['quick-shots'] = () => openSheet('Quick log shooting', `<p class="muted small">For a workout you already finished. Fill in any rows you tracked.</p>
  <div class="fields"><label>Date<input type="date" id="q-date" value="${todayIso()}" max="${todayIso()}"></label><label>Minutes<input type="number" id="q-mins" min="0" max="300" placeholder="Optional"></label></div>
  <div class="list">${SHOT_CATS.map(([k, l]) => `<div class="li"><span class="t">${l}</span><div class="row" style="flex-wrap:nowrap;width:180px"><input type="number" min="0" data-qm="${k}" placeholder="Made" inputmode="numeric"><input type="number" min="0" data-qa="${k}" placeholder="Att." inputmode="numeric"></div></div>`).join('')}</div>
  <button type="button" class="btn primary" id="q-save">Save</button>`, (d) => {
  $('#q-save', d).addEventListener('click', () => {
    const cats = {};
    for (const [k, l] of SHOT_CATS) { const m = Number($(`[data-qm="${k}"]`, d).value), a = Number($(`[data-qa="${k}"]`, d).value); if (!a && !m) continue; if (!(a > 0 && m >= 0 && m <= a)) return toast(`${l}: made must be 0 to attempts`); cats[k] = { m: Math.round(m), a: Math.round(a) }; }
    if (!Object.keys(cats).length) return toast('Enter at least one row');
    const date = $('#q-date', d).value || todayIso(), s = { id: uid('s'), date, at: Date.now(), style: 'mixed', spots: {}, cats };
    doc('aos-shots').sessions = [...(doc('aos-shots').sessions || []), s]; persist('aos-shots');
    const mins = Number($('#q-mins', d).value); if (mins >= 5) addWorkout(date, { type: 'shooting', name: 'Shooting', mins: Math.round(mins), int: 'moderate', source: 'athlete-os' });
    closeSheet(); toast('Shooting saved'); checkShootingPRs(s); refresh();
  });
});

HOOPS.categories = (el) => {
  const r = ui('catRange', '30'), n = r === 'all' ? null : Number(r);
  const cur = shotSessions().filter((s) => inRange(s.date, r)), prev = n ? shotSessions().filter((s) => { const k = daysBetween(s.date, todayIso()); return k >= n && k < 2 * n; }) : [];
  const A = catAgg(cur), P = catAgg(prev), any = SHOT_CATS.some(([k]) => A[k].a);
  const selC = ui('shotCat', 'all');
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Shot types</h3><span class="sub">Compare categories · ${n ? `vs previous ${n} days` : 'all time'}</span></div>${seg('catRange', [['30', '30D'], ['90', '90D'], ['365', '1Y'], ['all', 'All']], r)}</div>
    ${any ? `<div class="chart" id="cat-chart"></div>
      <div class="cmp" style="margin-top:12px"><span class="h">Type</span><span class="h">Made/Att.</span><span class="h">%</span><span class="h">${n ? 'vs prev' : ''}</span>
      ${SHOT_CATS.map(([k, l]) => `<span>${l}</span><span class="muted num">${A[k].m}/${A[k].a}</span><b>${pctTxt(A[k].a ? A[k].m / A[k].a : null)}</b>${n && A[k].a && P[k].a ? deltaPill((A[k].m / A[k].a - P[k].m / P[k].a) * 100, false, ' pts') : '<span class="muted">—</span>'}`).join('')}</div>
      <p class="muted tiny" style="margin-top:8px">Court sessions count toward types by their shot style: 3s in a catch-and-shoot session → catch-and-shoot 3s, midrange zones in an off-the-dribble session → pull-ups. Free throws, corners and rim shots always count.</p>`
    : emptyState('No shots logged yet', 'Log a court session (pick catch-and-shoot or off the dribble) or quick-log totals by type.', 'ball', '<div class="row" style="justify-content:center"><button type="button" class="btn sm primary" data-act="shoot">Court session</button><button type="button" class="btn sm" data-act="quick-shots">Quick log</button></div>')}
  </section>
  <section class="card"><div class="card-head"><div><h3>Shooting progression</h3><span class="sub">% per day with 10+ shots of that type</span></div>
    <select id="shot-cat" style="max-width:220px" aria-label="Shot type"><option value="all">All shots</option><option value="three" ${selC === 'three' ? 'selected' : ''}>All 3-pointers</option>${SHOT_CATS.map(([k, l]) => `<option value="${k}" ${k === selC ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div id="prog"></div></section>`;
  if (any) drawBars($('#cat-chart'), SHOT_CATS.map(([k, l]) => ({ label: l.split(' ')[0].replace('-and-', '&').slice(0, 8), full: l, segs: [{ v: A[k].a ? Math.round((A[k].m / A[k].a) * 100) : 0, color: k.endsWith('3') ? 'var(--purple)' : 'var(--accent)' }], tip: A[k].a ? `${Math.round((A[k].m / A[k].a) * 100)}% · ${A[k].m}/${A[k].a}` : 'no shots' })), { fmt: (v) => v + '%', tick: (v) => v + '%', h: 180 });
  const byDay = {};
  for (const s of shotSessions()) {
    const v = selC === 'all' ? sessionTotals(s) : selC === 'three' ? (() => { const t = sessionTotals(s); return { m: t.m3, a: t.a3 }; })() : catAgg([s])[selC];
    if (!v?.a) continue; byDay[s.date] = byDay[s.date] || { m: 0, a: 0 }; byDay[s.date].m += v.m; byDay[s.date].a += v.a;
  }
  const ser = Object.entries(byDay).filter(([, v]) => v.a >= 10).map(([date, v]) => ({ date, v: r1((v.m / v.a) * 100), tip: `${Math.round((v.m / v.a) * 100)}% (${v.m}/${v.a})` })).sort((a, b) => a.date.localeCompare(b.date));
  $('#prog').innerHTML = ser.length >= 2 ? '<div class="chart" id="prog-chart"></div>' : emptyState(ser.length ? 'One day so far' : 'No days with 10+ shots', 'A trend line needs two or more days with at least 10 shots of this type.', 'chart');
  if (ser.length >= 2) drawLine($('#prog-chart'), ser, { fmt: (v) => Math.round(v) + '%', tick: (v) => v + '%', label: 'Shooting progression' });
  $('#shot-cat').addEventListener('change', (e) => { setUi('shotCat', e.target.value); refresh(); });
};

const GSTATS = [['min', 'MIN'], ['pts', 'PTS'], ['fgm', 'FGM'], ['fga', 'FGA'], ['tpm', '3PM'], ['tpa', '3PA'], ['ftm', 'FTM'], ['fta', 'FTA'], ['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'], ['tov', 'TOV']];
HOOPS.games = (el) => {
  const gs = games();
  const avg = (k) => (gs.filter((g) => g[k] != null).length ? r1(mean(gs.filter((g) => g[k] != null).map((g) => g[k]))) : null);
  const tot = (k) => sum(gs.map((g) => g[k] || 0));
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Game performance</h3><span class="sub">${gs.length} game${gs.length === 1 ? '' : 's'} logged</span></div><button type="button" class="btn sm primary" data-act="add-game">＋ Game</button></div>
    ${gs.length ? `<div class="kpis four">
      <div class="kpi"><small>Points</small><b>${avg('pts') ?? '—'}</b><span class="tiny muted">per game</span></div>
      <div class="kpi"><small>FG%</small><b>${pctTxt(tot('fga') ? tot('fgm') / tot('fga') : null)}</b><span class="tiny muted">${tot('fgm')}/${tot('fga')}</span></div>
      <div class="kpi"><small>3P%</small><b>${pctTxt(tot('tpa') ? tot('tpm') / tot('tpa') : null)}</b><span class="tiny muted">${tot('tpm')}/${tot('tpa')}</span></div>
      <div class="kpi"><small>FT%</small><b>${pctTxt(tot('fta') ? tot('ftm') / tot('fta') : null)}</b><span class="tiny muted">${tot('ftm')}/${tot('fta')}</span></div>
      <div class="kpi"><small>Reb · Ast</small><b>${avg('reb') ?? '—'} · ${avg('ast') ?? '—'}</b><span class="tiny muted">per game</span></div>
      <div class="kpi"><small>Stl · Tov</small><b>${avg('stl') ?? '—'} · ${avg('tov') ?? '—'}</b><span class="tiny muted">per game</span></div>
      <div class="kpi"><small>AST/TO</small><b>${tot('tov') ? r1(tot('ast') / tot('tov')) : '—'}</b></div>
      <div class="kpi"><small>Minutes</small><b>${avg('min') ?? '—'}</b><span class="tiny muted">per game</span></div>
    </div>
    ${gs.length >= 2 ? `<div class="chart" id="pts-chart" style="margin-top:14px"></div>` : ''}`
    : emptyState('No games logged', 'Add your box score after each game: points, shooting, rebounds, assists, turnovers. Trends start at 2 games.', 'ball')}
  </section>
  ${gs.length ? `<section class="card"><div class="card-head"><h3>Game log</h3></div><div class="list">${[...gs].reverse().map((g) => `<div class="li"><div><div class="t">${esc(fmtDL(g.date))}${g.opp ? ' vs ' + esc(g.opp) : ''}${g.result ? ` <span class="tag" style="padding:1px 7px">${esc(g.result)}</span>` : ''}</div><div class="s">${[g.fga != null && `${g.fgm}/${g.fga} FG`, g.tpa != null && `${g.tpm}/${g.tpa} 3P`, g.fta != null && `${g.ftm}/${g.fta} FT`, g.reb != null && `${g.reb} reb`, g.ast != null && `${g.ast} ast`, g.tov != null && `${g.tov} tov`].filter(Boolean).join(' · ')}</div></div><div class="row"><span class="v">${g.pts ?? '—'} pts</span><button type="button" class="chip" data-act="add-game" data-id="${g.id}">Edit</button></div></div>`).join('')}</div></section>` : ''}`;
  if (gs.length >= 2) drawLine($('#pts-chart'), gs.filter((g) => g.pts != null).map((g) => ({ date: g.date, v: g.pts, tip: `${g.pts} pts${g.opp ? ' vs ' + g.opp : ''}` })), { fmt: (v) => v + ' pts', label: 'Points per game', yMin: 0 });
};
ACTIONS['add-game'] = (b) => {
  const g = b.dataset.id ? games().find((x) => x.id === b.dataset.id) : null;
  openSheet(g ? 'Edit game' : 'Add a game', `<div class="fields">
    <label>Date<input type="date" id="g-date" value="${g?.date || todayIso()}" max="${todayIso()}"></label><label>Opponent<input id="g-opp" maxlength="40" value="${esc(g?.opp || '')}"></label>
    <label class="full">Result<select id="g-res"><option value="">—</option>${['W', 'L'].map((x) => `<option ${g?.result === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    ${GSTATS.map(([k, l]) => `<label>${l}<input type="number" min="0" max="200" inputmode="numeric" data-g="${k}" value="${g?.[k] ?? ''}"></label>`).join('')}</div>
    <p class="muted tiny">Leave blank anything you didn't track. Blank is "not recorded", not zero.</p>
    <div class="row"><button type="button" class="btn primary" id="g-save" style="flex:1">Save game</button>${g ? '<button type="button" class="btn danger" id="g-del">Delete</button>' : ''}</div>`, (d) => {
    $('#g-save', d).addEventListener('click', () => {
      const rec = { id: g?.id || uid('g'), date: $('#g-date', d).value || todayIso(), opp: $('#g-opp', d).value.trim().slice(0, 40), result: $('#g-res', d).value };
      for (const [k] of GSTATS) { const v = $(`[data-g="${k}"]`, d).value; if (v !== '') rec[k] = Math.round(Number(v)); }
      for (const [m, a] of [['fgm', 'fga'], ['tpm', 'tpa'], ['ftm', 'fta']]) if (rec[m] != null && rec[a] != null && rec[m] > rec[a]) return toast('Makes can\'t be more than attempts');
      if (rec.tpm != null && rec.fgm != null && rec.tpm > rec.fgm) return toast('3PM is part of FGM, so it can\'t be higher');
      const list = (doc('aos-games').games || []).filter((x) => x.id !== rec.id);
      const prevBest = Math.max(-1, ...list.map((x) => x.pts ?? -1));
      doc('aos-games').games = [...list, rec]; persist('aos-games');
      if (!g && !exList(rec.date).some((x) => x.type === 'game')) addWorkout(rec.date, { type: 'game', name: 'Game', mins: Math.max(20, (rec.min || 0) + 40), int: 'hard', notes: rec.opp ? 'vs ' + rec.opp : '', source: 'athlete-os' });
      closeSheet(); toast('Game saved');
      if (!g && rec.pts != null && list.length && rec.pts > prevBest) celebrate('Career high', rec.pts + ' points', `Previous best ${prevBest} pts`);
      refresh();
    });
    $('#g-del', d)?.addEventListener('click', () => confirmSheet('Delete this game?', 'Delete', () => { doc('aos-games').games = games().filter((x) => x.id !== g.id); persist('aos-games'); closeSheet(); refresh(); }));
  });
};
