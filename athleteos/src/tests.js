// ===================== TESTS & PERSONAL RECORDS =====================
RENDER.tests = (el) => {
  const sel = ui('test', null), results = doc('aos-tests').results || [];
  const groups = TEST_GROUPS.map((g) => [g, allTests().filter((t) => t.group === g)]).filter(([, ts]) => ts.length);
  const prCount = allPRs().length, tested = allTests().filter((t) => resultsOf(t.id).length).length;
  el.innerHTML = `<section class="card hero">
    <div class="row-between"><div><p class="muted small">Athletic testing center</p><h1>Personal records</h1></div><div class="row"><button type="button" class="btn sm" data-act="custom-test">＋ Custom test</button><button type="button" class="btn primary" data-act="add-test">＋ Add result</button></div></div>
    <div class="kpis four" style="margin-top:14px">
      <div class="kpi"><small>Tests tracked</small><b>${tested}</b></div><div class="kpi"><small>Results logged</small><b>${results.length}</b></div>
      <div class="kpi"><small>PRs beaten</small><b>${prCount}</b></div><div class="kpi"><small>Last test</small><b style="font-size:17px">${results.length ? esc(fmtD([...results].sort((a, b) => b.date.localeCompare(a.date))[0].date)) : '—'}</b></div>
    </div>
  </section>
  <section class="card" id="test-detail" ${sel && testById(sel) ? '' : 'hidden'}></section>
  ${groups.map(([g, ts]) => `<section class="card"><div class="card-head"><h3>${g}</h3></div><div class="pr-grid">${ts.map((t) => { const pr = prOf(t.id), rs = resultsOf(t.id); const imp = rs.length >= 2 ? improvePct(t, rs[0].value, pr.value) : null; return `<button type="button" class="pr ${sel === t.id ? 'on' : ''}" data-pick-test="${t.id}"><small>${esc(t.name)}</small>${pr ? `<b>${esc(fmtVal(t, pr.value))}</b><span class="row" style="gap:6px">${imp != null ? deltaPill(imp) : ''}<span class="tiny muted">${rs.length} result${rs.length === 1 ? '' : 's'}</span></span>` : '<span class="none">Not tested</span>'}</button>`; }).join('')}</div></section>`).join('')}`;
  if (sel && testById(sel)) testDetail($('#test-detail'), sel);
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-pick-test]'); if (!b) return; setUi('test', ui('test') === b.dataset.pickTest ? null : b.dataset.pickTest); refresh(); if (ui('test')) $('#test-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
function testDetail(el, id) {
  const t = testById(id), rs = resultsOf(id), pr = prOf(id), r = ui('testRange', 'all');
  const pts = rs.filter((x) => inRange(x.date, r)).map((x) => ({ date: x.date, v: x.value, tip: fmtVal(t, x.value) + (x === pr ? ' · PR' : '') }));
  const prev = rs.length >= 2 ? rs[rs.length - 2] : null, last = rs[rs.length - 1];
  el.innerHTML = `<div class="card-head"><div><h3>${esc(t.name)}</h3><span class="sub">${t.better === 'lower' ? 'Lower is better' : 'Higher is better'} · unit: ${esc(t.unit)}</span></div><div class="row"><button type="button" class="btn sm primary" data-act="add-test" data-tid="${id}">＋ Result</button><button type="button" class="icon-btn" data-pick-test="${id}" aria-label="Close">✕</button></div></div>
    ${rs.length ? `<div class="kpis four">
      <div class="kpi"><small>Personal record</small><b>${esc(fmtVal(t, pr.value))}</b><span class="tiny muted">${esc(fmtD(pr.date))}</span></div>
      <div class="kpi"><small>Latest</small><b>${esc(fmtVal(t, last.value))}</b><span class="tiny muted">${prev ? 'vs previous ' + esc(fmtVal(t, prev.value)) : 'first result'}</span></div>
      <div class="kpi"><small>Since first</small><b style="font-size:20px">${rs.length >= 2 ? deltaPill(improvePct(t, rs[0].value, pr.value)) : '—'}</b><span class="tiny muted">${esc(fmtVal(t, rs[0].value))} → ${esc(fmtVal(t, pr.value))}</span></div>
      <div class="kpi"><small>Latest vs PR</small><b style="font-size:20px">${last === pr ? '🏆' : deltaPill(improvePct(t, pr.value, last.value))}</b><span class="tiny muted">${last === pr ? 'latest is your record' : 'off your best'}</span></div>
    </div>
    ${rs.length >= 2 ? `<div class="chart-top" style="margin-top:12px"><span class="muted small">Progression</span>${seg('testRange', RANGES, r)}</div><div class="chart" id="test-chart"></div>` : '<p class="notice" style="margin-top:12px">Log this test again in a few weeks to see your progression graph.</p>'}
    <details style="margin-top:12px" ${rs.length <= 6 ? 'open' : ''}><summary class="muted small" style="cursor:pointer">Testing history (${rs.length})</summary><div class="list">${[...rs].reverse().map((x) => `<div class="li"><div><div class="t">${esc(fmtVal(t, x.value))}${x === pr ? ' 🏆' : ''}</div><div class="s">${esc(fmtDL(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</div></div><div class="row"><button type="button" class="chip" data-act="add-test" data-rid="${x.id}">Edit</button><button type="button" class="chip" data-act="del-test" data-rid="${x.id}">Delete</button></div></div>`).join('')}</div></details>`
    : emptyState('No results yet', `Log your first ${t.name.toLowerCase()} to set the bar.`, 'trophy')}
    ${t.custom ? `<button type="button" class="btn sm danger" data-act="del-custom" data-tid="${id}" style="margin-top:10px">Delete this custom test</button>` : ''}`;
  if (rs.length >= 2 && pts.length) drawLine($('#test-chart'), pts, { fmt: (v) => fmtVal(t, v), label: t.name, tick: t.unit === 's' && pts.some((p) => p.v >= 60) ? (v) => fmtVal(t, v) : null });
}
/** Accepts 4.52, "1:05.3" or "5:30" for time tests. */
function parseTestValue(t, s) {
  s = String(s).trim();
  if (t.unit === 's' && s.includes(':')) { const [m, sec] = s.split(':'); const v = Number(m) * 60 + Number(sec); return Number.isFinite(v) ? v : NaN; }
  return Number(s);
}
ACTIONS['add-test'] = (b) => {
  const editing = b.dataset.rid ? (doc('aos-tests').results || []).find((r) => r.id === b.dataset.rid) : null;
  const tid = editing?.test || b.dataset.tid || ui('test') || 'vert';
  openSheet(editing ? 'Edit result' : 'Add test result', `<div class="fields">
    <label class="full">Test<select id="t-test">${TEST_GROUPS.map((g) => { const ts = allTests().filter((t) => t.group === g); return ts.length ? `<optgroup label="${g}">${ts.map((t) => `<option value="${t.id}" ${t.id === tid ? 'selected' : ''}>${esc(t.name)} (${esc(t.unit)})</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
    <label>Result <span id="t-unit" class="tiny"></span><input id="t-val" inputmode="decimal" autocomplete="off" value="${editing ? esc(editing.value) : ''}"></label>
    <label>Date<input type="date" id="t-date" value="${editing?.date || todayIso()}" max="${todayIso()}"></label>
    <label class="full">Note<input id="t-note" maxlength="120" placeholder="Optional: hand-timed, after practice, new shoes…" value="${esc(editing?.note || '')}"></label></div>
    <p class="muted small" id="t-pr"></p>
    <button type="button" class="btn primary" id="t-save">${editing ? 'Save changes' : 'Save result'}</button>`, (d) => {
    const upd = () => { const t = testById($('#t-test', d).value), pr = prOf(t.id); $('#t-unit', d).textContent = t.unit === 's' ? '(seconds, or m:ss)' : `(${t.unit})`; $('#t-pr', d).textContent = pr ? `Current record: ${fmtVal(t, pr.value)} on ${fmtD(pr.date)} (${t.better === 'lower' ? 'lower' : 'higher'} is better)` : 'First result for this test.'; };
    upd(); $('#t-test', d).addEventListener('change', upd); $('#t-val', d).focus();
    $('#t-save', d).addEventListener('click', () => {
      const t = testById($('#t-test', d).value), v = parseTestValue(t, $('#t-val', d).value);
      if (!(v > 0 && v < 100000)) return toast('Enter a number above 0');
      if (t.unit === 'made' && v > 100) return toast('That\'s more than the shots in this test');
      const before = prOf(t.id), hadAny = resultsOf(t.id).filter((r) => r.id !== editing?.id).length;
      const rec = { id: editing?.id || uid('r'), test: t.id, value: r2(v), date: $('#t-date', d).value || todayIso(), note: $('#t-note', d).value.trim().slice(0, 120), at: editing?.at || Date.now() };
      const D = doc('aos-tests'); D.results = [...(D.results || []).filter((r) => r.id !== rec.id), rec]; persist('aos-tests');
      closeSheet(); setUi('test', t.id);
      const beat = before && before.id !== rec.id && hadAny && betterOf(t, before.value, rec.value) === rec.value && rec.value !== before.value;
      if (beat) celebrate('New personal record', fmtVal(t, rec.value), `${t.name} · previous best ${fmtVal(t, before.value)} (${deltaText(improvePct(t, before.value, rec.value))})`);
      else toast(editing ? 'Result updated' : `Saved ${t.name}: ${fmtVal(t, rec.value)}`);
      if (state.view !== 'tests') go('tests'); else refresh();
    });
  });
};
const deltaText = (p) => `${p >= 0 ? '+' : ''}${r1(p)}%`;
ACTIONS['del-test'] = (b) => confirmSheet('Delete this result?', 'Delete', () => { const D = doc('aos-tests'); D.results = (D.results || []).filter((r) => r.id !== b.dataset.rid); persist('aos-tests'); refresh(); toast('Result deleted'); });
ACTIONS['custom-test'] = () => openSheet('Custom test', `<div class="fields"><label class="full">Name<input id="c-name" maxlength="40" placeholder="Trap bar deadlift, Mikan drill (60s)…"></label>
  <label>Unit<input id="c-unit" maxlength="10" placeholder="lb, s, reps, made"></label><label>Better is<select id="c-better"><option value="higher">Higher</option><option value="lower">Lower (times)</option></select></label></div>
  <button type="button" class="btn primary" id="c-save">Create test</button>`, (d) => {
  $('#c-save', d).addEventListener('click', () => {
    const name = $('#c-name', d).value.trim(), unit = $('#c-unit', d).value.trim() || 'pts';
    if (!name) return toast('Name your test');
    if (allTests().some((t) => t.name.toLowerCase() === name.toLowerCase())) return toast('That test already exists');
    const t = { id: uid('c'), name: name.slice(0, 40), unit: unit === 'sec' || unit === 'seconds' ? 's' : unit.slice(0, 10), better: $('#c-better', d).value };
    aos().customTests = [...(aos().customTests || []), t]; persist('aos'); setUi('test', t.id); closeSheet(); go('tests'); toast('Custom test added');
  });
});
ACTIONS['del-custom'] = (b) => {
  const n = resultsOf(b.dataset.tid).length;
  confirmSheet(`Delete this test${n ? ` and its ${n} result(s)` : ''}?`, 'Delete', () => {
  aos().customTests = (aos().customTests || []).filter((t) => t.id !== b.dataset.tid); persist('aos');
  const D = doc('aos-tests'); D.results = (D.results || []).filter((r) => r.test !== b.dataset.tid); persist('aos-tests'); setUi('test', null); refresh();
  });
};

// PR celebration: trophy, confetti, the number.
function celebrate(title, value, sub) {
  const box = document.createElement('div'); box.className = 'celebrate'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-label', title);
  box.innerHTML = `<div class="box"><div class="trophy">🏆</div><p style="text-transform:uppercase;letter-spacing:.12em;font-size:12px;font-weight:700;color:#9fc2ff;margin-top:6px">${esc(title)}</p><div class="big" style="margin:6px 0">${esc(value)}</div><p style="font-size:13px;opacity:.85">${esc(sub)}</p><button type="button" class="btn primary" style="margin-top:16px;width:100%">Let's go</button></div>`;
  document.body.appendChild(box);
  const colors = ['#3d8bff', '#8b5cff', '#2fd68a', '#ffc23d', '#ff6fb1', '#33d1ff'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's'; c.style.animationDelay = Math.random() * 0.4 + 's'; c.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(c); setTimeout(() => c.remove(), 4200);
  }
  if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
  const close = () => box.remove();
  box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('button')) close(); });
  $('button', box).focus();
}
