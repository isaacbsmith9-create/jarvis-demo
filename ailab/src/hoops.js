// ===================== Basketball Performance Intelligence =====================
const HP = { tab: uiGet('hpTab', 'shooting'), mode: uiGet('courtMode', 'both'), pend: null, fCtx: 'all', fGrp: 'all', fPr: 'all', last: [] };
function setHoopsTab(t) { HP.tab = t; uiSet('hpTab', t); renderHoops(); }
function renderHoops() {
  const el = $('#view-hoops');
  const tabs = [['shooting', 'Shooting analytics'], ['chart', 'Shot chart'], ['handling', 'Ball handling'], ['finishing', 'Finishing'], ['games', 'Games']];
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Basketball Performance Intelligence</span><h1>Basketball Intel</h1><p>Shooting, handling, finishing and game data. Percentages need a minimum sample before they count toward scores.</p></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-ht="${k}" aria-selected="${HP.tab === k}">${l}</button>`).join('')}</div><div id="hp-body"></div>`;
  for (const b of $$('[data-ht]', el)) b.onclick = () => setHoopsTab(b.dataset.ht);
  const body = $('#hp-body', el);
  if (!curAthlete()) { body.innerHTML = noAthleteState(); bindActs(body); return; }
  ({ shooting: hpShooting, chart: hpChart, handling: hpHandling, finishing: hpFinishing, games: hpGames })[HP.tab](body);
  bindActs(el); mountCharts(el);
}
const pctCell = (k, n, min) => `<b>${n ? fmtPct(k / n) : '—'}</b><small>${k}/${n}${n && n < min ? ` · need ${min}+` : ''}</small>`;

// ---------- shooting ----------
function hpShooting(body) {
  const R = S.R, shots = listOf('shots', R);
  if (!shots.length) { body.innerHTML = `<div class="empty"><h3>No shooting data in this range</h3><p>Chart shots on the court one at a time, or log a set (e.g. 7/10 from the left wing).</p><div class="row"><button type="button" class="btn" id="sh-chart">Open shot chart</button><button type="button" class="btn ghost" id="sh-tally">Log shooting set</button></div></div>`; $('#sh-chart').onclick = () => setHoopsTab('chart'); $('#sh-tally').onclick = () => shotTallyForm(); return; }
  const splits = HOOP_METRICS.map((h) => { const m = metric(h.id), c = current(m, R); return { m, c }; });
  const zs = zoneStats(shots.filter((s) => s.type !== 'ft'));
  const byType = Object.entries(SHOT_TYPES).map(([k, t]) => { const L = shots.filter((s) => s.type === k); return { label: t.name, k: sum(L.map((s) => s.makes)), n: sum(L.map((s) => s.att)) }; }).filter((x) => x.n);
  const byPr = Object.entries(PRESSURE).map(([k, t]) => { const L = shots.filter((s) => s.pressure === k && s.type !== 'ft'); return { label: t, k: sum(L.map((s) => s.makes)), n: sum(L.map((s) => s.att)) }; }).filter((x) => x.n);
  const byCtx = Object.entries(CTX).map(([k, t]) => { const L = shots.filter((s) => s.ctx === k && s.type !== 'ft'); return { label: t, k: sum(L.map((s) => s.makes)), n: sum(L.map((s) => s.att)) }; }).filter((x) => x.n);
  const buckets = [[0, 4, 'At rim (0–4 ft)'], [4, 10, 'Short (4–10 ft)'], [10, 16, 'Mid (10–16 ft)'], [16, 22, 'Long 2 (16–22 ft)'], [22, 99, 'Three-point range']];
  const charted = shots.filter((s) => s.x != null);
  const byDist = buckets.map(([a, b, l]) => { const L = charted.filter((s) => { const d = distFt(s.x, s.y); return d >= a && d < b; }); return { label: l, k: sum(L.map((s) => s.makes)), n: sum(L.map((s) => s.att)) }; }).filter((x) => x.n);
  const pctBars = (L) => barsHTML(L.map((x) => ({ label: x.label, sub: `${x.k}/${x.n}`, value: (100 * x.k) / x.n, display: fmtPct(x.k / x.n, 0), color: x.n < 10 ? 'var(--ink-4)' : 'var(--s1)', tip: `${x.label}: ${x.k}/${x.n} (${fmtPct(x.k / x.n)})${x.n < 10 ? '<br>Small sample (under 10)' : ''}<br>95% range ${wilson(x.k, x.n).map((v) => fmtPct(v, 0)).join('–')}` })));
  const fg = metric('fg'), three = metric('three');
  body.innerHTML = `<div class="row"><button type="button" class="btn" id="sh-tally">${icon('plus')} Log shooting set</button><button type="button" class="btn ghost" id="sh-chart">Chart shots</button><span class="small muted">${sum(shots.map((s) => s.att))} attempts · ${esc(rangeLabel(R))}</span></div>
    <section class="card"><div class="card-h"><h2>Shooting splits</h2><span class="meta">pooled makes ÷ attempts ${fxLink('shoot')}</span></div>
      <div class="splits">${splits.map(({ m, c }) => `<div class="split ${c.ok ? '' : 'low'}" ${c.ci ? `data-tip="95% range ${c.ci.map((v) => fmtPct(v, 0)).join('–')}"` : ''}><span>${esc(m.name.replace(' %', ''))}</span>${pctCell(c.k || 0, c.n || 0, m.min)}${c.ok && m.ref ? `<small>Benchmark ${benchScore(m, c.v)}</small>` : ''}</div>`).join('')}</div></section>
    <div class="grid">
      <section class="card span-8"><div class="card-h"><h2>Shooting trend</h2><span class="meta">per session, 5+ attempts</span></div>${chart((w) => lineSVG(w, { series: [{ m: fg, color: 'var(--s1)' }, { m: three, color: 'var(--s2)' }].map(({ m, color }) => ({ name: m.name, color, pts: m.series(R).map((p) => ({ x: dms(p.date), y: p.v * 100, tip: `${fmtDate(p.date)}<br>${m.name}: <b>${fmtPct(p.v)}</b> (${p.k}/${p.n})` })) })), yFmt: (v) => v.toFixed(0) + '%', yDomain: [0, 100] }))}</section>
      <section class="card span-4"><div class="card-h"><h2>Hot & cold zones</h2></div>${courtSVG({ shots: shots.filter((s) => s.type !== 'ft'), mode: 'zones' })}${zoneKey()}</section>
      <section class="card span-6"><div class="card-h"><h2>By shot type</h2></div>${pctBars(byType)}</section>
      <section class="card span-6"><div class="card-h"><h2>By distance</h2><span class="meta">charted shots only</span></div>${byDist.length ? pctBars(byDist) : '<p class="muted small">Chart shots on the court to see distance splits.</p>'}</section>
      <section class="card span-6"><div class="card-h"><h2>By defensive pressure</h2></div>${pctBars(byPr)}</section>
      <section class="card span-6"><div class="card-h"><h2>Game vs workout</h2></div>${pctBars(byCtx)}</section>
      <section class="card span-12"><div class="card-h"><h2>Shooting % by location</h2></div><div class="tbl-wrap"><table><thead><tr><th>Zone</th><th class="n">Makes</th><th class="n">Attempts</th><th class="n">FG%</th><th class="n">Expected</th><th class="n">Difference</th><th class="n">Points / shot</th></tr></thead><tbody>${Object.entries(zs).filter(([, z]) => z.n).map(([k, z]) => `<tr><td>${ZONES[k].name}</td><td class="n">${z.k}</td><td class="n">${z.n}</td><td class="n">${fmtPct(z.k / z.n)}</td><td class="n">${fmtPct(ZONES[k].exp, 0)}</td><td class="n">${z.n >= 5 ? signed((z.k / z.n - ZONES[k].exp) * 100, 1, ' pts') : '<span class="muted">few shots</span>'}</td><td class="n">${fmt((ZONES[k].pts * z.k) / z.n, 2)}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Expected rates are fixed reference values for each zone (see Methodology), used only to color hot and cold zones.</p></section>
    </div>`;
  $('#sh-tally').onclick = () => shotTallyForm(); $('#sh-chart').onclick = () => setHoopsTab('chart');
}
const zoneKey = () => `<div class="zone-key">Cold<i style="background:var(--cold-3)"></i><i style="background:var(--cold-2)"></i><i style="background:var(--cold-1)"></i><i style="background:var(--cold-0)"></i><i style="background:var(--hot-1)"></i><i style="background:var(--hot-2)"></i><i style="background:var(--hot-3)"></i>Hot · vs zone expectation · <i style="background:var(--zone-none);border:1px solid var(--line-2)"></i> under 5 attempts</div>`;

// ---------- interactive shot chart ----------
function hpChart(body) {
  const R = S.R;
  const shots = listOf('shots', R).filter((s) => s.type !== 'ft' && (HP.fCtx === 'all' || s.ctx === HP.fCtx) && (HP.fGrp === 'all' || SHOT_TYPES[s.type]?.group === HP.fGrp) && (HP.fPr === 'all' || s.pressure === HP.fPr));
  const today = listOf('shots', { from: isoDate(), to: isoDate() }).filter((s) => s.x != null);
  const t = uiGet('shotType', 'spotup'), c = uiGet('ctx', 'workout'), p = uiGet('pressure', 'open');
  const pend = HP.pend, z = pend ? zoneOf(pend[0], pend[1]) : null;
  const k = sum(shots.map((s) => s.makes)), n = sum(shots.map((s) => s.att));
  body.innerHTML = `<div class="grid">
    <section class="card span-8"><div class="card-h"><h2>Shot chart</h2><div class="seg" role="group" aria-label="View">${[['zones', 'Zones'], ['dots', 'Shots'], ['both', 'Both']].map(([kk, l]) => `<button type="button" data-cm="${kk}" aria-pressed="${HP.mode === kk}">${l}</button>`).join('')}</div></div>
      <div class="row">${filterSel('f-ctx', { all: 'Game + workout', ...CTX }, HP.fCtx)}${filterSel('f-grp', { all: 'All shot types', catch: 'Catch & shoot', dribble: 'Off the dribble', rim: 'At the rim' }, HP.fGrp)}${filterSel('f-pr', { all: 'Any pressure', ...PRESSURE }, HP.fPr)}<span class="small muted">${n ? `${k}/${n} · ${fmtPct(k / n)}` : 'No shots match'}</span></div>
      <div class="court-wrap" id="court-wrap">${courtSVG({ shots, mode: HP.mode, pending: pend })}</div>${HP.mode !== 'dots' ? zoneKey() : '<div class="zone-key"><i style="background:var(--s3);border-radius:50%;width:10px"></i> make <span style="color:var(--crit);font-weight:700;margin-left:8px">×</span> miss</div>'}</section>
    <section class="card span-4"><div class="card-h"><h2>Record a shot</h2><span class="meta">${today.length} charted today</span></div>
      <div class="shot-entry">
        <p class="small ${pend ? '' : 'muted'}">${pend ? `<b>${ZONES[z].name}</b> · ${fmt(distFt(pend[0], pend[1]), 1)} ft · ${ZONES[z].pts}-pointer` : 'Tap the court where the shot was taken.'}</p>
        <div class="form" style="grid-template-columns:1fr">
          ${fld('Shot type', sel('st', Object.fromEntries(Object.entries(SHOT_TYPES).map(([kk, v]) => [kk, v.name])), t))}
          ${fld('Game or workout', sel('sc', CTX, c))}${fld('Defensive pressure', sel('sp', PRESSURE, p))}${fld('Date', inp('sd', uiGet('shotDate', isoDate()), { type: 'date' }))}${fld('Notes (optional)', inp('sn', ''))}
        </div>
        <div class="mm"><button type="button" class="make" id="sh-make" ${pend ? '' : 'disabled'}>Make</button><button type="button" class="miss" id="sh-miss" ${pend ? '' : 'disabled'}>Miss</button></div>
        <div class="row"><button type="button" class="btn ghost sm" id="sh-undo" ${HP.last.length ? '' : 'disabled'}>Undo last shot</button><button type="button" class="btn ghost sm" id="sh-ft">Log free throws</button></div>
        <p class="small muted">Type, context, pressure and date stay selected between shots for fast charting.</p></div></section></div>`;
  const svg = $('.court', body);
  svg.addEventListener('click', (e) => { if (e.target.closest('.z-lab')) return; HP.pend = courtPoint(svg, e); hpChart(body); });
  for (const b of $$('[data-cm]', body)) b.onclick = () => { HP.mode = b.dataset.cm; uiSet('courtMode', HP.mode); hpChart(body); };
  $('#f-ctx').onchange = (e) => { HP.fCtx = e.target.value; hpChart(body); }; $('#f-grp').onchange = (e) => { HP.fGrp = e.target.value; hpChart(body); }; $('#f-pr').onchange = (e) => { HP.fPr = e.target.value; hpChart(body); };
  $('#f-st').onchange = (e) => uiSet('shotType', e.target.value); $('#f-sc').onchange = (e) => uiSet('ctx', e.target.value); $('#f-sp').onchange = (e) => uiSet('pressure', e.target.value); $('#f-sd').onchange = (e) => uiSet('shotDate', e.target.value);
  const save = (made) => {
    const date = $('#f-sd').value || isoDate(); if (date > isoDate()) return toast('Date is in the future');
    const s = { id: uid('s'), aid: AID(), date, x: HP.pend[0], y: HP.pend[1], type: $('#f-st').value, ctx: $('#f-sc').value, pressure: $('#f-sp').value, makes: made ? 1 : 0, att: 1, notes: $('#f-sn').value.trim() };
    doc('shots').list.push(s); persist('shots'); HP.last.push(s.id); HP.pend = null;
    toast(made ? 'Make recorded' : 'Miss recorded'); hpChart(body);
  };
  $('#sh-make').onclick = () => save(true); $('#sh-miss').onclick = () => save(false);
  $('#sh-undo').onclick = () => { const id = HP.last.pop(); const d = doc('shots'); d.list = d.list.filter((x) => x.id !== id); persist('shots'); toast('Last shot removed'); hpChart(body); };
  $('#sh-ft').onclick = () => openSheet('Log free throws', `<div class="form">${fld('Date', inp('date', isoDate(), { type: 'date' }))}${fld('Game or workout', sel('ctx', CTX, c))}${fld('Makes', inp('makes', '', { type: 'number', min: 0 }))}${fld('Attempts', inp('att', '', { type: 'number', min: 1 }))}</div>`, { submit: 'Save', onSubmit: (fd) => { const mk = num(fd, 'makes'), at = num(fd, 'att'); if (!(at >= 1) || !Number.isInteger(at)) return 'Attempts must be a whole number of at least 1.'; if (!(mk >= 0) || mk > at || !Number.isInteger(mk)) return 'Makes must be between 0 and attempts.'; doc('shots').list.push({ id: uid('s'), aid: AID(), date: fd.get('date') || isoDate(), type: 'ft', ctx: fd.get('ctx'), pressure: 'open', makes: mk, att: at, notes: '' }); persist('shots'); toast(`Logged ${mk}/${at} free throws`); } });
}
const filterSel = (id, opts, val) => `<select id="${id}" aria-label="Filter" style="width:auto">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;

// ---------- handling ----------
function hpHandling(body) {
  const R = S.R, L = listOf('drills', R).filter((d) => d.kind === 'handle');
  const ids = ['security', 'weakratio', 'completion', 'combo', 'codrate'];
  const kp = ids.map((id) => { const m = metric(id), c = current(m, R); return `<div class="stat"><span>${esc(m.name)}</span><b>${c.ok || (m.id === 'codrate' && c.v != null) ? fmtVal(m, c.v) : '—'}</b><small class="muted">${c.ok ? (m.ref ? 'benchmark ' + benchScore(m, c.v) : 'tracked') : 'need ' + esc(c.need || 'data')}</small></div>`; }).join('');
  const per = {}; for (const d of L) { const o = (per[d.drill] ||= { n: 0, strong: [0, 0], weak: [0, 0], both: [0, 0], tov: 0, dur: 0 }); o.n++; o[d.hand][0] += d.reps; o[d.hand][1] += d.dur; o.tov += d.tov; o.dur += d.dur; }
  const rpm = (x) => (x[1] ? (60 * x[0]) / x[1] : null);
  body.innerHTML = `<div class="row"><button type="button" class="btn" id="hd-log">${icon('plus')} Log drill</button><span class="small muted">${L.length} drill sets · ${esc(rangeLabel(R))}</span></div>
    ${L.length ? `<section class="card"><div class="card-h"><h2>Ball-handling profile</h2>${fxLink('handle')}</div><div class="stats">${kp}</div></section>
    <div class="grid"><section class="card span-6"><div class="card-h"><h2>Ball security trend</h2><span class="meta">per day, 20+ reps</span></div>${chart((w) => metricLine(w, metric('security'), R))}</section>
      <section class="card span-6"><div class="card-h"><h2>Weak-hand ratio trend</h2></div>${chart((w) => metricLine(w, metric('weakratio'), R))}</section>
      <section class="card span-12"><div class="card-h"><h2>By drill</h2></div><div class="tbl-wrap"><table><thead><tr><th>Drill</th><th>Type</th><th class="n">Sets</th><th class="n">Strong reps/min</th><th class="n">Weak reps/min</th><th class="n">Weak ÷ strong</th><th class="n">Both hands reps/min</th><th class="n">Errors / min</th></tr></thead><tbody>${Object.entries(per).map(([id, o]) => { const s = rpm(o.strong), w = rpm(o.weak); return `<tr><td>${esc(DRILL[id]?.name || id)}</td><td class="small">${DRILL[id]?.kind || ''}</td><td class="n">${o.n}</td><td class="n">${fmt(s)}</td><td class="n">${fmt(w)}</td><td class="n">${s && w ? fmt(w / s, 2) : '—'}</td><td class="n">${fmt(rpm(o.both))}</td><td class="n">${fmt((60 * o.tov) / o.dur, 2)}</td></tr>`; }).join('')}</tbody></table></div></section></div>`
    : '<div class="empty"><h3>No handling drills yet</h3><p>Log timed drills with clean reps and ball losses. Time the same drill with each hand to measure your weak hand.</p></div>'}`;
  $('#hd-log').onclick = () => handleForm();
}

// ---------- finishing ----------
function hpFinishing(body) {
  const R = S.R, L = listOf('drills', R).filter((d) => d.kind === 'finish');
  const agg = (f) => { const X = L.filter(f); return { k: sum(X.map((d) => d.makes)), n: sum(X.map((d) => d.att)) }; };
  const ids = ['finish', 'finL', 'finR', 'finbal'];
  const kp = ids.map((id) => { const m = metric(id), c = current(m, R); return `<div class="stat"><span>${esc(m.name)}</span><b>${c.ok ? fmtVal(m, c.v) : '—'}</b><small class="muted">${c.ok ? (c.k != null ? `${c.k}/${c.n}` : '') + (m.scored ? ' · benchmark ' + benchScore(m, c.v) : '') : 'need ' + esc(c.need)}</small></div>`; }).join('');
  const types = Object.entries(FINISH_TYPES).map(([k, l]) => ({ k, l, L: agg((d) => d.type === k && d.hand === 'L'), Rr: agg((d) => d.type === k && d.hand === 'R') })).filter((x) => x.L.n || x.Rr.n);
  body.innerHTML = `<div class="row"><button type="button" class="btn" id="fn-log">${icon('plus')} Log finishing set</button><span class="small muted">${sum(L.map((d) => d.att))} attempts · ${esc(rangeLabel(R))}</span></div>
    ${L.length ? `<section class="card"><div class="card-h"><h2>Finishing profile</h2>${fxLink('finish')}</div><div class="stats">${kp}</div></section>
    <div class="grid"><section class="card span-6"><div class="card-h"><h2>Left vs right by finish type</h2></div>
      ${types.map((x) => `<div><div class="small" style="font-weight:600;margin-bottom:4px">${x.l}</div>${barsHTML([{ label: 'Left', sub: `${x.L.k}/${x.L.n}`, value: x.L.n ? (100 * x.L.k) / x.L.n : null, display: x.L.n ? fmtPct(x.L.k / x.L.n, 0) : '', color: 'var(--s1)' }, { label: 'Right', sub: `${x.Rr.k}/${x.Rr.n}`, value: x.Rr.n ? (100 * x.Rr.k) / x.Rr.n : null, display: x.Rr.n ? fmtPct(x.Rr.k / x.Rr.n, 0) : '', color: 'var(--s2)' }])}</div>`).join('')}
      <div class="legend"><span><i style="background:var(--s1)"></i>Left hand</span><span><i style="background:var(--s2)"></i>Right hand</span></div></section>
      <section class="card span-6"><div class="card-h"><h2>Finishing trend</h2><span class="meta">per day, 5+ attempts</span></div>${chart((w) => lineSVG(w, { series: [['finL', 'var(--s1)'], ['finR', 'var(--s2)']].map(([id, color]) => { const m = metric(id); return { name: m.name, color, pts: m.series(R).map((p) => ({ x: dms(p.date), y: p.v * 100, tip: `${fmtDate(p.date)}<br>${m.name}: <b>${fmtPct(p.v)}</b> (${p.n})` })) }; }), yFmt: (v) => v.toFixed(0) + '%', yDomain: [0, 100] }))}</section></div>`
    : '<div class="empty"><h3>No finishing data yet</h3><p>Log sets by finish type and hand: layups, floaters, contact, reverse, through traffic.</p></div>'}`;
  $('#fn-log').onclick = () => finishForm();
}

// ---------- games ----------
function hpGames(body) {
  const R = S.R, G = listOf('games', R);
  const avg = (k) => (G.length ? mean(G.map((g) => g[k])) : null), tot = (k) => sum(G.map((g) => g[k]));
  const pms = G.filter((g) => g.pm != null);
  const fga = tot('fga'), tpa = tot('tpa'), fta = tot('fta'), tsa = fga + 0.44 * fta;
  body.innerHTML = `<div class="row"><button type="button" class="btn" id="gm-log">${icon('plus')} Log game</button><span class="small muted">${G.length} game${G.length === 1 ? '' : 's'} · ${esc(rangeLabel(R))}</span></div>
    ${G.length ? `<section class="card"><div class="card-h"><h2>Per-game averages</h2>${fxLink('game')}</div><div class="stats">${[['Minutes', avg('min')], ['Points', avg('pts')], ['Rebounds', avg('reb')], ['Assists', avg('ast')], ['Steals', avg('stl')], ['Blocks', avg('blk')], ['Turnovers', avg('tov')], ['Plus/minus', pms.length ? mean(pms.map((g) => g.pm)) : null], ['Game Score', mean(G.map(gameScore))]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${fmt(v)}</b></div>`).join('')}</div>
      <div class="stats">${[['FG', fga ? `${fmtPct(tot('fgm') / fga)}` : '—', `${tot('fgm')}/${fga}`], ['3P', tpa ? fmtPct(tot('tpm') / tpa) : '—', `${tot('tpm')}/${tpa}`], ['FT', fta ? fmtPct(tot('ftm') / fta) : '—', `${tot('ftm')}/${fta}`], ['eFG%', fga ? fmtPct((tot('fgm') + 0.5 * tot('tpm')) / fga) : '—', ''], ['TS%', tsa ? fmtPct(tot('pts') / (2 * tsa)) : '—', ''], ['AST/TO', fmt(tot('ast') / Math.max(1, tot('tov')), 2), '']].map(([k, v, s]) => `<div class="stat"><span>${k}</span><b>${v}</b><small class="muted">${s}</small></div>`).join('')}</div></section>
    <div class="grid"><section class="card span-6"><div class="card-h"><h2>Points per game</h2></div>${chart((w) => metricLine(w, metric('ppg'), R))}</section><section class="card span-6"><div class="card-h"><h2>Game Score</h2></div>${chart((w) => metricLine(w, metric('gmsc'), R))}</section>
    <section class="card span-12"><div class="card-h"><h2>Game log</h2></div><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Opponent</th>${['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3P', 'FT', '+/−', 'GmSc'].map((h) => `<th class="n">${h}</th>`).join('')}<th></th></tr></thead><tbody>${[...G].reverse().map((g) => `<tr><td class="mono">${fmtShort(g.date)}</td><td>${esc(g.opp || '')}${g.demo ? ' <span class="tag demo">demo</span>' : ''}</td>${[g.min, g.pts, g.reb, g.ast, g.stl, g.blk, g.tov, `${g.fgm}-${g.fga}`, `${g.tpm}-${g.tpa}`, `${g.ftm}-${g.fta}`, g.pm ?? '—', fmt(gameScore(g))].map((v) => `<td class="n">${v}</td>`).join('')}<td class="n" style="white-space:nowrap"><button type="button" class="icon-btn" data-gedit="${g.id}" aria-label="Edit">${icon('edit')}</button> <button type="button" class="icon-btn" data-gdel="${g.id}" aria-label="Delete">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div></section></div>`
    : '<div class="empty"><h3>No games logged</h3><p>Log box-score lines to track points, shooting splits, true shooting, assist-to-turnover and Game Score.</p></div>'}`;
  $('#gm-log').onclick = () => gameForm();
  for (const b of $$('[data-gedit]', body)) b.onclick = () => gameForm(doc('games').list.find((g) => g.id === b.dataset.gedit));
  for (const b of $$('[data-gdel]', body)) b.onclick = () => { const g = doc('games').list.find((x) => x.id === b.dataset.gdel); confirmSheet('Delete game', `Delete the ${fmtDate(g.date)} game vs ${g.opp || 'opponent'}?`, 'Delete', () => { const d = doc('games'); d.list = d.list.filter((x) => x.id !== g.id); persist('games'); }); };
}
