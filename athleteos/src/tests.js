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
  testsOverview(el);
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
    ${testExtras(t, rs, pr)}
    ${t.custom ? `<button type="button" class="btn sm danger" data-act="del-custom" data-tid="${id}" style="margin-top:10px">Delete this custom test</button>` : ''}`;
  const pj = projectTest(id), tg = doc('aos-tests').targets?.[id];
  if (rs.length >= 2 && pts.length) drawLine($('#test-chart'), pts, { fmt: (v) => fmtVal(t, v), label: t.name, tick: t.unit === 's' && pts.some((p) => p.v >= 60) ? (v) => fmtVal(t, v) : null, goal: tg?.value ?? null, goalLabel: 'Target', proj: pj && ui('showProj', '1') === '1' ? [{ date: pj.end, v: pj.value }] : null });
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

// ----- Edition 2: targets, next test dates, leaderboards, comparisons, projections -----
function testExtras(t, rs, pr) {
  const T = doc('aos-tests'), tg = T.targets?.[t.id], next = T.next?.[t.id], pj = projectTest(t.id);
  const prog = tg && rs.length ? clamp(t.better === 'lower' ? ((rs[0].value - pr.value) / Math.max(0.0001, rs[0].value - tg.value)) * 100 : ((pr.value - rs[0].value) / Math.max(0.0001, tg.value - rs[0].value)) * 100, 0, 100) : null;
  const top = [...rs].sort((a, b) => (t.better === 'lower' ? a.value - b.value : b.value - a.value)).slice(0, 5);
  return `<div class="grid two" style="margin-top:12px">
    <div class="notice"><div class="row-between"><b style="color:var(--fg)">Target and next test</b><button type="button" class="chip" data-act="test-target" data-tid="${t.id}">Set</button></div>
      ${tg ? `<p class="small" style="margin-top:6px">Target <b>${esc(fmtVal(t, tg.value))}</b>${tg.date ? ' by ' + esc(fmtD(tg.date)) : ''} · ${prog == null ? '' : Math.round(prog) + '% of the way'}</p>${prog != null ? hbar(prog, 'var(--good)') : ''}` : '<p class="small" style="margin-top:6px">No target yet.</p>'}
      <p class="small" style="margin-top:6px">${next ? `Next test: <b>${esc(fmtDL(next))}</b>${next < todayIso() ? ' (overdue)' : ` (in ${daysBetween(todayIso(), next)} days)`} · on your calendar` : 'No next test date. Re-testing every 4-6 weeks shows real progress.'}</p></div>
    <div class="notice"><b style="color:var(--fg)">Projection</b> <label class="check tiny" style="display:inline-flex;margin-left:6px"><input type="checkbox" data-proj ${ui('showProj', '1') === '1' ? 'checked' : ''}> show on chart</label>
      <p class="small" style="margin-top:6px">${pj ? `At your current trend: <b>${esc(fmtVal(t, pj.value))}</b> by ${esc(fmtD(pj.end))} (${pj.improving ? 'improving' : 'not improving'} ${esc(fmtVal(t, Math.abs(pj.perMonth)))} per month)${tg && pj.hitDate ? `. You'd reach your target around ${esc(fmtD(pj.hitDate))}.` : ''} This is a straight-line trend from your results, not a guarantee.` : 'Needs 3+ results to project a trend.'}</p></div>
  </div>
  ${top.length >= 2 ? `<h4 style="margin:14px 0 6px">Personal leaderboard</h4><div class="list">${top.map((r, i) => `<div class="li"><span class="small">${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${esc(fmtDL(r.date))}${r.note ? ' · ' + esc(r.note) : ''}</span><b class="v">${esc(fmtVal(t, r.value))}</b></div>`).join('')}</div>` : ''}`;
}
document.addEventListener('change', (e) => { if (e.target.matches('[data-proj]')) { setUi('showProj', e.target.checked ? '1' : '0'); refresh(); } });
ACTIONS['test-target'] = (b) => {
  const t = testById(b.dataset.tid), T = doc('aos-tests'), tg = T.targets?.[t.id] || {};
  openSheet(`${t.name}: target`, `<div class="fields"><label>Target (${esc(t.unit)})<input id="tt-v" inputmode="decimal" value="${tg.value ?? ''}"></label><label>By date<input type="date" id="tt-d" value="${tg.date || ''}"></label><label class="full">Next test date (adds a calendar reminder)<input type="date" id="tt-n" value="${T.next?.[t.id] || shiftIso(todayIso(), 28)}"></label></div>
    <label class="check"><input type="checkbox" id="tt-g"> Also create a goal for this target</label><button type="button" class="btn primary" id="tt-save">Save</button>`, (d) => {
    $('#tt-save', d).addEventListener('click', () => {
      const raw = $('#tt-v', d).value, v = raw === '' ? null : parseTestValue(t, raw);
      if (raw !== '' && !(v > 0)) return toast('Enter a number above 0');
      T.targets = { ...(T.targets || {}) }; if (v == null) delete T.targets[t.id]; else T.targets[t.id] = { value: r2(v), date: $('#tt-d', d).value || null };
      T.next = { ...(T.next || {}) }; if ($('#tt-n', d).value) T.next[t.id] = $('#tt-n', d).value; else delete T.next[t.id];
      persist('aos-tests');
      if (v != null && $('#tt-g', d).checked) { const pr = prOf(t.id); doc('aos-goals').goals = [...goals(), { id: uid('goal'), title: `${t.name}: ${fmtVal(t, v)}`, horizon: 'season', date: $('#tt-d', d).value || null, source: 'test:' + t.id, start: pr?.value ?? v, target: r2(v), unit: t.unit, better: t.better, milestones: [], created: Date.now(), history: [] }]; persist('aos-goals'); }
      closeSheet(); toast('Saved'); refresh();
    });
  });
};
function testsOverview(el) {
  const T = doc('aos-tests'), tested = allTests().filter((t) => resultsOf(t.id).length >= 2);
  const upcoming = Object.entries(T.next || {}).map(([id, d]) => ({ t: testById(id), d })).filter((x) => x.t).sort((a, b) => a.d.localeCompare(b.d));
  const due = allTests().filter((t) => { const rs = resultsOf(t.id); return rs.length && !T.next?.[t.id] && daysBetween(rs[rs.length - 1].date, todayIso()) >= 42; });
  const hero = $('.hero', el); if (!hero) return;
  hero.insertAdjacentHTML('afterend', `<div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Testing comparison</h3><span class="sub">% improvement from first result to best</span></div></div>${tested.length ? '<div class="chart" id="t-cmp"></div>' : emptyState('Needs repeat tests', 'Test the same thing twice to compare improvement across tests.', 'trophy')}</section>
    <section class="card"><div class="card-head"><div><h3>Testing schedule</h3><span class="sub">Next test dates also show on your calendar</span></div></div>
      ${upcoming.length ? `<div class="list">${upcoming.map(({ t, d }) => `<button type="button" class="li li-btn" data-pick-test="${t.id}"><div><div class="t">${esc(t.name)}</div><div class="s">${esc(fmtDL(d))}</div></div><span class="band ${d < todayIso() ? 'lo' : daysBetween(todayIso(), d) <= 3 ? 'mid' : 'hi'}">${d < todayIso() ? 'Overdue' : d === todayIso() ? 'Today' : `In ${daysBetween(todayIso(), d)}d`}</span></button>`).join('')}</div>` : '<p class="muted small">No tests scheduled. Open a test and tap "Set" to pick a target and a next test date.</p>'}
      ${due.length ? `<p class="notice warn" style="margin-top:10px">Due for a re-test (6+ weeks): ${due.map((t) => esc(t.name)).join(', ')}</p>` : ''}</section></div>`);
  if (tested.length) drawBars($('#t-cmp'), tested.map((t) => { const rs = resultsOf(t.id), p = improvePct(t, rs[0].value, prOf(t.id).value); return { label: t.name.split(' ')[0].slice(0, 7), full: t.name, segs: [{ v: Math.max(0, r1(p)), color: p > 0 ? 'var(--good)' : 'var(--oth)' }], tip: `${r1(p)}% (${fmtVal(t, rs[0].value)} → ${fmtVal(t, prOf(t.id).value)})` }; }), { fmt: (v) => v + '%', tick: (v) => v + '%', h: 170 });
}
