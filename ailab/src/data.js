// ===================== Data Center =====================
const DC = { tab: uiGet('dcTab', 'records'), type: 'all', cat: 'all', q: '', limit: 100, sel: [] };
/** Every entry for the current athlete as a uniform row. */
function allRows(R) {
  const rows = [];
  for (const r of listOf('records', R)) { const t = testDef(r.test); if (!t) continue; const m = metric(r.test); const v = recValue(r, t);
    rows.push({ src: 'records', rec: r, date: r.date, type: 'Test', cat: CATS[t.cat]?.name, name: t.name, result: fmtVal(m, v) + (t.input === 'lift' ? ` (${r.load} lb × ${r.reps})` : t.input === 'attempts' ? ` (${r.attempts.join(', ')})` : ''), v, unit: t.unit, est: recEst(r, t), cond: [r.cond?.timing, r.cond?.surface, r.cond?.note].filter(Boolean).join(' · '), notes: r.notes, edit: () => testForm(null, r) }); }
  for (const s of listOf('shots', R)) rows.push({ src: 'shots', rec: s, date: s.date, type: 'Shooting', cat: 'Shooting', name: s.type === 'ft' ? 'Free throws' : `${SHOT_TYPES[s.type]?.name || s.type} · ${ZONES[shotZone(s)]?.name || ''}`, result: `${s.makes}/${s.att}${s.att > 1 ? ' · ' + fmtPct(s.makes / s.att, 0) : s.makes ? ' make' : ' miss'}`, v: s.makes / s.att, unit: '%', cond: [CTX[s.ctx], PRESSURE[s.pressure], s.x != null ? `charted at ${fmt(distFt(s.x, s.y), 0)} ft` : ''].filter(Boolean).join(' · '), notes: s.notes, edit: () => shotTallyForm(s) });
  for (const d of listOf('drills', R)) {
    if (d.kind === 'handle') rows.push({ src: 'drills', rec: d, date: d.date, type: 'Handling', cat: 'Ball handling', name: `${DRILL[d.drill]?.name || d.drill} · ${{ strong: 'strong hand', weak: 'weak hand', both: 'both hands' }[d.hand]}`, result: `${d.reps} reps / ${d.dur}s · ${d.tov} errors${d.done ? '' : ' · not completed'}`, v: d.reps, unit: 'reps', cond: '', notes: d.notes, edit: () => handleForm(d) });
    else rows.push({ src: 'drills', rec: d, date: d.date, type: 'Finishing', cat: 'Finishing', name: `${FINISH_TYPES[d.type]} · ${d.hand === 'L' ? 'left' : 'right'} hand`, result: `${d.makes}/${d.att} · ${fmtPct(d.makes / d.att, 0)}`, v: d.makes / d.att, unit: '%', cond: CTX[d.ctx] || '', notes: d.notes, edit: () => finishForm(d) });
  }
  for (const g of listOf('games', R)) rows.push({ src: 'games', rec: g, date: g.date, type: 'Game', cat: 'Game impact', name: 'vs ' + (g.opp || 'opponent'), result: `${g.pts} pts · ${g.reb} reb · ${g.ast} ast · ${g.fgm}/${g.fga} FG`, v: g.pts, unit: 'pts', cond: g.min ? g.min + ' min' : '', notes: g.notes, edit: () => gameForm(g) });
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function renderData() {
  const el = $('#view-data'), a = curAthlete();
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Athlete Data Center</span><h1>Data Center</h1><p>Every measurement with its date, category, result, unit, conditions and notes. Edit, delete, compare and review history.</p></div>
    <div class="row"><button type="button" class="btn" data-act="log">${icon('plus')} Log data</button></div></div>
    <div class="tabs" role="tablist">${[['records', 'Records'], ['profile', 'Athlete profile'], ['athletes', 'Athletes']].map(([k, l]) => `<button type="button" role="tab" data-dct="${k}" aria-selected="${DC.tab === k}">${l}</button>`).join('')}</div>
    <div id="dc-body"></div>`;
  for (const b of $$('[data-dct]', el)) b.onclick = () => { DC.tab = b.dataset.dct; uiSet('dcTab', DC.tab); renderData(); };
  bindActs(el);
  const body = $('#dc-body', el);
  if (DC.tab === 'athletes') return renderAthletes(body);
  if (!a) { body.innerHTML = noAthleteState(); bindActs(body); return; }
  if (DC.tab === 'profile') return renderProfile(body, a);
  renderRecords(body);
}
function renderProfile(body, a) {
  const age = ageOf(a), n = { records: listOf('records', null).length, shots: sum(listOf('shots', null).map((s) => s.att)), drills: listOf('drills', null).length, games: listOf('games', null).length };
  const first = allRows(null).map((r) => r.date).sort()[0];
  body.innerHTML = `<div class="grid"><section class="card span-6"><div class="card-h"><h2>${esc(a.name)}</h2><button type="button" class="btn ghost sm" id="pf-edit">${icon('edit')} Edit profile</button></div>
    <div class="tbl-wrap"><table><tbody>${[['Sport', a.sport], ['Position', POSITIONS[a.pos]], ['Height', fmtHeight(a.height)], ['Weight', a.weight ? a.weight + ' lb' : '—'], ['Age', age != null ? age + (a.birth ? ` (born ${fmtDate(a.birth)})` : '') : '—'], ['Training experience', a.exp != null ? a.exp + ' years' : '—'], ['Dominant hand', { R: 'Right', L: 'Left', A: 'Ambidextrous' }[a.hand] || '—'], ['Dominant foot', { R: 'Right', L: 'Left', NA: 'Not applicable' }[a.foot] || '—'], ['Goals', (a.goals || []).map((g) => GOALS[g]).join(', ') || '—'], ['Goal notes', a.goalText || '—']].map(([k, v]) => `<tr><th style="width:40%">${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card span-6"><div class="card-h"><h2>Performance history</h2><span class="meta">${first ? 'since ' + fmtDate(first) : ''}</span></div>
      <div class="stats"><div class="stat"><span>Test results</span><b>${n.records}</b></div><div class="stat"><span>Shots logged</span><b>${n.shots}</b></div><div class="stat"><span>Drill sets</span><b>${n.drills}</b></div><div class="stat"><span>Games</span><b>${n.games}</b></div></div>
      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em">Personal records</h3>
      <div class="tbl-wrap"><table><thead><tr><th>Test</th><th class="n">Best</th><th>Date</th></tr></thead><tbody>${allTests().map((t) => { const b = bestOf(metric(t.id), null); return b ? `<tr><td>${esc(t.name)}</td><td class="n">${fmtVal(metric(t.id), b.v)}</td><td class="mono">${fmtShort(b.date)}</td></tr>` : ''; }).join('') || '<tr><td colspan="3" class="muted">No tests yet</td></tr>'}</tbody></table></div></section></div>`;
  $('#pf-edit').onclick = () => athleteForm(a);
}
function renderAthletes(body) {
  const A = doc('athletes');
  body.innerHTML = `<div class="row"><button type="button" class="btn" id="at-new">${icon('plus')} New athlete</button>${A.list.some((a) => a.demo) ? '' : '<button type="button" class="btn ghost" data-act="demo">Load example athlete</button>'}</div>
    ${A.list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Athlete</th><th>Position</th><th class="n">Entries</th><th class="n">AIS (all time)</th><th></th></tr></thead><tbody>${A.list.map((a) => {
      const keep = A.current; A.current = a.id; const n = allRows(null).length, ais = intelScore({ key: 'all' }, a).score; A.current = keep;
      return `<tr class="${a.id === A.current ? 'sel' : ''}"><td><b>${esc(a.name)}</b> ${a.demo ? '<span class="tag demo">demo</span>' : ''}${a.id === A.current ? ' <span class="chip">current</span>' : ''}</td><td>${esc(POSITIONS[a.pos] || '')}</td><td class="n">${n}</td><td class="n">${ais ?? '—'}</td>
        <td class="n"><button type="button" class="btn ghost sm" data-use="${a.id}">Open</button> <button type="button" class="icon-btn" data-del-ath="${a.id}" aria-label="Delete ${esc(a.name)}">${icon('trash')}</button></td></tr>`; }).join('')}</tbody></table></div>` : noAthleteState()}`;
  $('#at-new').onclick = () => athleteForm();
  bindActs(body);
  for (const b of $$('[data-use]', body)) b.onclick = () => { A.current = b.dataset.use; persist('athletes'); go('command'); };
  for (const b of $$('[data-del-ath]', body)) b.onclick = () => { const a = A.list.find((x) => x.id === b.dataset.delAth); confirmSheet('Delete athlete', `Delete ${a.name} and all of their records, shot logs, drills, games, reports and groups?`, 'Delete athlete', () => { deleteAthlete(a.id); toast('Athlete deleted'); }); };
}
function renderRecords(body) {
  const rows = allRows(S.R).filter((r) => (DC.type === 'all' || r.type === DC.type) && (DC.cat === 'all' || r.cat === DC.cat) && (!DC.q || (r.name + ' ' + r.notes + ' ' + r.cond).toLowerCase().includes(DC.q.toLowerCase())));
  const types = ['all', 'Test', 'Shooting', 'Handling', 'Finishing', 'Game'], cats = ['all', ...new Set(Object.values(CATS).map((c) => c.name))];
  const selRows = DC.sel.map((id) => rows.find((r) => r.rec.id === id) || allRows(null).find((r) => r.rec.id === id)).filter(Boolean);
  body.innerHTML = `<div class="row">
      <label class="fld" style="width:150px"><span>Type</span><select id="dc-type">${types.map((t) => `<option value="${t}" ${DC.type === t ? 'selected' : ''}>${t === 'all' ? 'All types' : t}</option>`).join('')}</select></label>
      <label class="fld" style="width:170px"><span>Category</span><select id="dc-cat">${cats.map((t) => `<option value="${t}" ${DC.cat === t ? 'selected' : ''}>${t === 'all' ? 'All categories' : t}</option>`).join('')}</select></label>
      <label class="fld grow" style="min-width:160px"><span>Search</span><input type="search" id="dc-q" value="${esc(DC.q)}" placeholder="Test, notes, conditions…"></label></div>
    <p class="small muted">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} · ${esc(rangeLabel(S.R))} (change the range at the top). Tick two entries to compare them.</p>
    ${selRows.length === 2 ? compareRows(selRows) : ''}
    ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th></th><th>Date</th><th>Type</th><th>Measurement</th><th>Result</th><th>Conditions</th><th>Notes</th><th></th></tr></thead><tbody>
      ${rows.slice(0, DC.limit).map((r) => `<tr class="${DC.sel.includes(r.rec.id) ? 'sel' : ''}"><td><input type="checkbox" data-sel="${r.rec.id}" aria-label="Select for comparison" ${DC.sel.includes(r.rec.id) ? 'checked' : ''}></td><td class="mono" style="white-space:nowrap">${fmtShort(r.date)}</td><td>${r.type}</td><td>${esc(r.name)}${r.rec.demo ? ' <span class="tag demo">demo</span>' : ''}</td><td class="mono" style="white-space:nowrap">${esc(r.result)} ${r.src === 'records' ? mtag(r.est) : ''}</td><td class="small">${esc(r.cond)}</td><td class="small">${esc(r.notes || '')}</td>
        <td class="n" style="white-space:nowrap"><button type="button" class="icon-btn" data-edit="${r.rec.id}" aria-label="Edit">${icon('edit')}</button> <button type="button" class="icon-btn" data-del="${r.src}:${r.rec.id}" aria-label="Delete">${icon('trash')}</button></td></tr>`).join('')}
      </tbody></table></div>${rows.length > DC.limit ? `<button type="button" class="btn ghost" id="dc-more">Show more (${rows.length - DC.limit} left)</button>` : ''}`
    : '<div class="empty"><h3>No entries match</h3><p>Change the filters or the date range, or log new data.</p></div>'}`;
  $('#dc-type').onchange = (e) => { DC.type = e.target.value; renderRecords(body); };
  $('#dc-cat').onchange = (e) => { DC.cat = e.target.value; renderRecords(body); };
  $('#dc-q').oninput = (e) => { DC.q = e.target.value; clearTimeout(DC.t); DC.t = setTimeout(() => { renderRecords(body); const q = $('#dc-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
  $('#dc-more') && ($('#dc-more').onclick = () => { DC.limit += 200; renderRecords(body); });
  for (const b of $$('[data-sel]', body)) b.onchange = () => { const id = b.dataset.sel; DC.sel = b.checked ? [...DC.sel.filter((x) => x !== id), id].slice(-2) : DC.sel.filter((x) => x !== id); renderRecords(body); };
  for (const b of $$('[data-edit]', body)) b.onclick = () => rows.find((r) => r.rec.id === b.dataset.edit)?.edit();
  for (const b of $$('[data-del]', body)) b.onclick = () => { const [src, id] = b.dataset.del.split(':'), r = rows.find((x) => x.rec.id === id); confirmSheet('Delete entry', `Delete ${r.name} from ${fmtDate(r.date)} (${r.result})?`, 'Delete', () => { const d = doc(src); d.list = d.list.filter((x) => x.id !== id); persist(src); DC.sel = DC.sel.filter((x) => x !== id); toast('Entry deleted'); }); };
  $('#dc-clear') && ($('#dc-clear').onclick = () => { DC.sel = []; renderRecords(body); });
}
function compareRows([a, b]) {
  const [x, y] = a.date <= b.date ? [a, b] : [b, a];
  let diff = '';
  if (x.src === 'records' && y.src === 'records' && x.rec.test === y.rec.test) { const m = metric(x.rec.test), imp = improvement(x.v, y.v, m.dir); diff = `<p><b>${esc(m.name)}</b>: ${fmtVal(m, x.v)} → ${fmtVal(m, y.v)} · change ${signed(m.dir === 'lower' ? x.v - y.v : y.v - x.v, m.dec)} ${esc(m.unit)} (${signed(imp * 100, 1, '%')} ${imp >= 0 ? 'better' : 'worse'}) over ${daysBetween(x.date, y.date)} days.</p>`; }
  else if (x.unit === y.unit && x.unit === '%' ) diff = `<p>${fmtPct(x.v)} → ${fmtPct(y.v)} (${signed((y.v - x.v) * 100, 1, ' pts')}) over ${daysBetween(x.date, y.date)} days.</p>`;
  else diff = '<p class="small muted">These are different measurements, so only the details are shown side by side.</p>';
  return `<div class="card"><div class="card-h"><h3>Comparing two entries</h3><button type="button" class="btn ghost sm" id="dc-clear">Clear</button></div>${diff}
    <div class="tbl-wrap"><table><thead><tr><th></th><th>${fmtDate(x.date)}</th><th>${fmtDate(y.date)}</th></tr></thead><tbody>${[['Measurement', x.name, y.name], ['Result', x.result, y.result], ['Conditions', x.cond, y.cond], ['Notes', x.notes, y.notes]].map(([k, p, q]) => `<tr><th>${k}</th><td>${esc(p || '—')}</td><td>${esc(q || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
