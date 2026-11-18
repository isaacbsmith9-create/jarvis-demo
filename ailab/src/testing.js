// ===================== Advanced Athlete Testing Lab =====================
const TL = { cat: uiGet('tlCat', 'all'), sel: null, session: null };
function startSession() {
  if (needAthlete()) return;
  openSheet('Start a testing session', `<p class="muted small">A session groups several tests done on the same day under the same conditions. Each result is still saved on its own.</p><div class="form">
    ${fld('Date', inp('date', isoDate(), { type: 'date' }))}${fld('Timing / measurement method', sel('timing', { '': '—', electronic: 'Electronic / gates', hand: 'Hand-timed', video: 'Video', mat: 'Jump mat', vertec: 'Vertec / reach', tape: 'Tape measure' }, 'electronic'))}
    ${fld('Surface / location', inp('surface', '', { ph: 'Gym hardwood' }))}${fld('Conditions', inp('note', '', { ph: 'Warm-up done, fresh legs…' }))}</div>`,
    { submit: 'Start session', onSubmit: (fd) => { if (!fd.get('date')) return 'Enter a date.'; TL.session = { id: uid('ses'), date: fd.get('date'), timing: fd.get('timing'), surface: String(fd.get('surface') || ''), note: String(fd.get('note') || ''), logged: [] }; } });
}
function finishSession() {
  const s = TL.session; TL.session = null;
  const L = doc('records').list.filter((r) => s.logged.includes(r.id));
  if (!L.length) { toast('Session closed (no results logged)'); return renderTesting(); }
  openSheet('Session summary', `<p class="muted">${fmtDate(s.date)} · ${L.length} result${L.length > 1 ? 's' : ''}</p><div class="tbl-wrap"><table><thead><tr><th>Test</th><th class="n">Result</th><th class="n">Benchmark</th><th></th></tr></thead><tbody>${L.map((r) => { const t = testDef(r.test), m = metric(r.test), v = recValue(r, t), prior = m.series(null).filter((p) => p.id !== r.id), pb = prior.length ? (t.dir === 'lower' ? Math.min(...prior.map((p) => p.v)) : Math.max(...prior.map((p) => p.v))) : null, pr = pb != null && (t.dir === 'lower' ? v < pb : v > pb); return `<tr><td>${esc(t.name)}</td><td class="n">${fmtVal(m, v)}</td><td class="n">${benchScore(m, v) ?? '—'}</td><td>${mtag(recEst(r, t))} ${pr ? '<span class="tag pr">PR</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`, { cancel: 'Close' });
  renderTesting();
}
function renderTesting() {
  const el = $('#view-testing');
  if (TL.sel && testDef(TL.sel)) return renderTestDetail(el, testDef(TL.sel));
  const cats = [['all', 'All tests'], ...PHYS.map((c) => [c, CATS[c].name]), ['custom', 'Custom']];
  const list = allTests().filter((t) => TL.cat === 'all' || (TL.cat === 'custom' ? t.custom : t.cat === TL.cat));
  const a = curAthlete();
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Advanced Athlete Testing Lab</span><h1>Testing Lab</h1><p>Standardized protocols with units and measurement guidance. Personal records are detected automatically; lifts above one rep are marked as estimates.</p></div>
    <div class="row"><button type="button" class="btn" id="tl-log">${icon('plus')} Log result</button><button type="button" class="btn ghost" id="tl-ses">${TL.session ? 'Session running' : 'Start testing session'}</button><button type="button" class="btn ghost" id="tl-custom">Create custom test</button></div></div>
    ${TL.session ? `<div class="card" style="border-color:var(--acc)"><div class="row"><b>Testing session · ${fmtDate(TL.session.date)}</b><span class="muted small">${TL.session.logged.length} logged · ${esc([TL.session.timing, TL.session.surface, TL.session.note].filter(Boolean).join(' · '))}</span><span class="grow"></span><button type="button" class="btn sm" id="ses-next">Log next test</button><button type="button" class="btn ghost sm" id="ses-end">Finish session</button></div></div>` : ''}
    <div class="tabs" role="tablist">${cats.map(([k, l]) => `<button type="button" role="tab" data-tc="${k}" aria-selected="${TL.cat === k}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="tests">${list.map((t) => testCard(t, a)).join('')}</div>` : '<div class="empty"><h3>No custom tests yet</h3><p>Create a test with its own unit, direction and optional reference values.</p></div>'}`;
  for (const b of $$('[data-tc]', el)) b.onclick = () => { TL.cat = b.dataset.tc; uiSet('tlCat', TL.cat); renderTesting(); };
  for (const b of $$('[data-test]', el)) b.onclick = () => { TL.sel = b.dataset.test; renderTesting(); window.scrollTo({ top: 0 }); };
  $('#tl-log').onclick = () => testForm(TL.cat !== 'all' && TL.cat !== 'custom' ? allTests().find((t) => t.cat === TL.cat)?.id : null, null, TL.session);
  $('#tl-ses').onclick = () => (TL.session ? null : startSession());
  $('#tl-custom').onclick = customTestForm;
  $('#ses-next') && ($('#ses-next').onclick = () => testForm(null, null, TL.session));
  $('#ses-end') && ($('#ses-end').onclick = finishSession);
}
function testCard(t, a) {
  const m = metric(t.id), s = a ? m.series(null) : [], last = s[s.length - 1], best = a ? bestOf(m, null) : null, sc = last ? benchScore(m, last.v) : null;
  return `<button type="button" class="test" data-test="${t.id}"><div class="h"><div><h3>${esc(t.name)}</h3><span class="muted small">${CATS[t.cat].name} · ${esc(t.unit)} · ${t.dir === 'lower' ? 'lower is better' : 'higher is better'}</span></div>${t.custom ? '<span class="tag demo">custom</span>' : ''}</div>
    <div class="v"><b>${last ? fmtVal(m, last.v).replace(/ (\S+)$/, '<small>$1</small>') : '<span class="muted" style="font-size:14px">Not tested</span>'}</b>${spark(s.slice(-10).map((p) => p.v), t.dir)}</div>
    <div class="meta">${last ? `<span>${fmtShort(last.date)}</span>${last.est ? '<span>estimate</span>' : ''}<span>${s.length} result${s.length > 1 ? 's' : ''}</span>${best ? `<span>PR ${fmtVal(m, best.v)}</span>` : ''}${sc != null ? `<span>score ${sc}</span>` : ''}` : '<span>Tap for protocol</span>'}</div></button>`;
}
function renderTestDetail(el, t) {
  const m = metric(t.id), R = S.R, s = m.series(R), all = m.series(null), a = curAthlete();
  const vals = s.map((p) => p.v), last = s[s.length - 1], first = s[0], best = bestOf(m, R), worst = s.length ? s.reduce((x, y) => ((t.dir === 'lower' ? y.v > x.v : y.v < x.v) ? y : x)) : null;
  const tr = trendOf(m, s), imp = first && last ? improvement(first.v, last.v, t.dir) : null;
  const prs = new Set(); let run = null; for (const p of all) { if (run == null || (t.dir === 'lower' ? p.v < run : p.v > run)) { prs.add(p.id); run = p.v; } }
  const derived = metrics().filter((x) => x.base === t.id);
  const recs = listOf('records', R).filter((r) => r.test === t.id).reverse();
  el.innerHTML = `<div class="row"><button type="button" class="btn ghost sm" id="td-back">‹ All tests</button></div>
    <div class="page-head"><div><span class="eyebrow">${CATS[t.cat].name} · ${esc(t.unit)} · ${t.dir === 'lower' ? 'lower is better' : 'higher is better'}</span><h1>${esc(t.name)}</h1></div>
      <div class="row"><button type="button" class="btn" id="td-log">${icon('plus')} Log result</button>${t.custom ? `<button type="button" class="btn ghost" id="td-delt">${icon('trash')} Delete test</button>` : ''}</div></div>
    <div class="grid">
      <section class="card span-4"><div class="card-h"><h2>Protocol</h2></div><div class="proto"><h4>How to test</h4><p>${esc(t.inst || '—')}</p></div>${t.guide ? `<div class="proto"><h4>Measurement guidance</h4><p>${esc(t.guide)}</p></div>` : ''}
        ${t.ref ? `<div class="proto"><h4>Benchmark reference ${fxLink('bench')}</h4><p class="mono small">0 = ${fmtVal(m, refOf(m).floor)} · 100 = ${fmtVal(m, refOf(m).elite)}</p></div>` : '<p class="small muted">No benchmark reference: tracked for progress only.</p>'}</section>
      <section class="card span-8"><div class="card-h"><h2>Progression</h2><span class="meta">${esc(rangeLabel(R))} · ${s.length} result${s.length === 1 ? '' : 's'}</span></div>
        ${s.length ? chart((w) => lineSVG(w, { series: [{ name: t.name, color: 'var(--s1)', pts: s.map((p) => ({ x: dms(p.date), y: p.v, est: p.est, tip: `${fmtDate(p.date)}<br><b>${fmtVal(m, p.v)}</b>${prs.has(p.id) ? ' · PR at the time' : ''}${p.est ? '<br><i>estimate</i>' : ''}` })) }], fits: tr ? [{ x1: tr.x0, y1: tr.fit.intercept, x2: dms(last.date), y2: tr.fit.intercept + tr.fit.slope * daysBetween(first.date, last.date) }] : [], label: t.name })) : '<div class="chart-empty" style="height:140px">No results in this range yet</div>'}
        <div class="stats">${[['Latest', last && fmtVal(m, last.v)], ['Best', best && fmtVal(m, best.v)], ['Worst', worst && fmtVal(m, worst.v)], ['Average', vals.length ? fmtVal(m, mean(vals)) : null], ['Median', vals.length ? fmtVal(m, median(vals)) : null], ['Std dev', sd(vals) != null ? fmt(sd(vals), t.dec + 1) : null], ['Consistency (CV)', cv(vals) != null ? (cv(vals) * 100).toFixed(1) + '%' : null], ['First → latest', imp != null && s.length > 1 ? signed(imp * 100, 1, '%') : null], ['Trend / month', tr ? signed(tr.per30 * 100, 1, '%') : null], ['Benchmark', last ? benchScore(m, last.v) : null]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v ?? '—'}</b></div>`).join('')}</div>
        ${derived.length ? `<div class="stats">${derived.map((d) => { const c = current(d, R); return `<div class="stat"><span>${esc(d.name)}</span><b>${c.ok ? fmtVal(d, c.v) : '—'}</b>${c.ok ? (d.alwaysEst || c.est ? ESTIMATE : '') : `<small class="muted">${d.id.startsWith('rel_') ? 'needs bodyweight' : 'needs data'}</small>`}</div>`; }).join('')}</div>` : ''}
        <p class="small muted">${fxLink('stats', 'ƒ statistics definitions')}</p></section>
      <section class="card span-8"><div class="card-h"><h2>History</h2><span class="meta">PR = best result up to that date</span></div>
        ${recs.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Result</th><th>Detail</th><th>Conditions</th><th>Notes</th><th></th></tr></thead><tbody>${recs.map((r) => `<tr><td class="mono">${fmtShort(r.date)}</td><td class="n">${fmtVal(m, recValue(r, t))}</td><td class="small">${mtag(recEst(r, t))} ${prs.has(r.id) ? '<span class="tag pr">PR</span>' : ''} ${t.input === 'lift' ? `${r.load} lb × ${r.reps}` : r.attempts ? r.attempts.join(', ') : ''}</td><td class="small">${esc([r.cond?.timing, r.cond?.surface, r.cond?.note].filter(Boolean).join(' · '))}</td><td class="small">${esc(r.notes || '')}</td><td class="n" style="white-space:nowrap"><button type="button" class="icon-btn" data-redit="${r.id}" aria-label="Edit">${icon('edit')}</button> <button type="button" class="icon-btn" data-rdel="${r.id}" aria-label="Delete">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">No results in this range.</p>'}</section>
      <section class="card span-4"><div class="card-h"><h2>Leaderboard</h2><span class="meta">manually entered</span></div>${leaderboard(t, m, a)}</section>
    </div>`;
  $('#td-back').onclick = () => { TL.sel = null; renderTesting(); };
  $('#td-log').onclick = () => testForm(t.id, null, TL.session);
  $('#td-delt') && ($('#td-delt').onclick = () => confirmSheet('Delete custom test', `Delete "${t.name}" and all of its results?`, 'Delete test', () => { const md = doc('meta'); md.customTests = md.customTests.filter((x) => x.id !== t.id); persist('meta'); const d = doc('records'); d.list = d.list.filter((r) => r.test !== t.id); persist('records'); TL.sel = null; }));
  for (const b of $$('[data-redit]', el)) b.onclick = () => testForm(null, doc('records').list.find((r) => r.id === b.dataset.redit));
  for (const b of $$('[data-rdel]', el)) b.onclick = () => { const r = doc('records').list.find((x) => x.id === b.dataset.rdel); confirmSheet('Delete result', `Delete the ${fmtDate(r.date)} result (${fmtVal(m, recValue(r, t))})?`, 'Delete', () => { const d = doc('records'); d.list = d.list.filter((x) => x.id !== r.id); persist('records'); }); };
  bindLeaderboard(el, t, m);
  bindActs(el);
  mountCharts(el);
}
function leaderboard(t, m, a) {
  const G = doc('meta').groups.filter((g) => g.aid === a?.id && g.test === t.id);
  const gid = uiGet('lb:' + t.id, G[0]?.id); const g = G.find((x) => x.id === gid) || G[0];
  const best = bestOf(m, null);
  let body = '<p class="muted small">Create a comparison group (teammates, a position group, a camp) and enter their results by hand to rank against them.</p>';
  if (g) {
    const rows = [...g.entries.map((e, i) => ({ ...e, i })), ...(best ? [{ name: a.name + ' (best)', value: best.v, me: true }] : [])].sort((x, y) => (t.dir === 'lower' ? x.value - y.value : y.value - x.value));
    body = `<div class="lb">${rows.map((r, k) => `<div class="lb-row ${r.me ? 'me' : ''}"><span class="r">${k + 1}</span><span>${esc(r.name)}</span><span class="row"><b class="num">${fmtVal(m, r.value)}</b>${r.me ? '' : `<button type="button" class="icon-btn" data-lbdel="${r.i}" aria-label="Remove ${esc(r.name)}">${icon('x')}</button>`}</span></div>`).join('')}</div>
      ${best ? `<p class="small muted">Rank ${rows.findIndex((r) => r.me) + 1} of ${rows.length}.</p>` : '<p class="small muted">Log a result to appear on the board.</p>'}
      <div class="row"><input type="text" id="lb-name" placeholder="Name" style="flex:1;min-width:90px" aria-label="Name"><input type="number" step="any" id="lb-val" placeholder="${esc(t.unit)}" style="width:90px" aria-label="Result"><button type="button" class="btn sm" id="lb-add">Add</button></div>`;
  }
  return `<div class="row">${G.length ? `<select id="lb-group" style="flex:1" aria-label="Comparison group">${G.map((x) => `<option value="${x.id}" ${x.id === g?.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}<button type="button" class="btn ghost sm" id="lb-new">New group</button>${g ? `<button type="button" class="icon-btn" id="lb-delg" aria-label="Delete group">${icon('trash')}</button>` : ''}</div>${body}`;
}
function bindLeaderboard(el, t, m) {
  const G = () => doc('meta').groups.filter((g) => g.aid === AID() && g.test === t.id);
  const cur = () => { const gid = uiGet('lb:' + t.id, G()[0]?.id); return G().find((x) => x.id === gid) || G()[0]; };
  $('#lb-group', el) && ($('#lb-group', el).onchange = (e) => { uiSet('lb:' + t.id, e.target.value); renderTesting(); });
  $('#lb-new', el).onclick = () => openSheet('New comparison group', `<div class="form">${fld('Group name', inp('name', '', { ph: 'Varsity guards' }), { full: true })}</div><p class="small muted">Results you enter for others stay in this lab; they are not linked to anyone's account.</p>`, { submit: 'Create', onSubmit: (fd) => { const name = String(fd.get('name') || '').trim(); if (!name) return 'Name the group.'; const g = { id: uid('grp'), aid: AID(), name, test: t.id, entries: [] }; doc('meta').groups.push(g); persist('meta'); uiSet('lb:' + t.id, g.id); } });
  $('#lb-delg', el) && ($('#lb-delg', el).onclick = () => { const g = cur(); confirmSheet('Delete group', `Delete the group "${g.name}"?`, 'Delete', () => { const md = doc('meta'); md.groups = md.groups.filter((x) => x.id !== g.id); persist('meta'); }); });
  $('#lb-add', el) && ($('#lb-add', el).onclick = () => { const name = $('#lb-name').value.trim(), v = Number($('#lb-val').value); if (!name || !isFinite(v) || $('#lb-val').value === '') return toast('Enter a name and a result'); cur().entries.push({ name, value: v }); persist('meta'); renderTesting(); });
  for (const b of $$('[data-lbdel]', el)) b.onclick = () => { cur().entries.splice(+b.dataset.lbdel, 1); persist('meta'); renderTesting(); };
}
