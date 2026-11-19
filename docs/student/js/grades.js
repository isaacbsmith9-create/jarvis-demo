'use strict';
// ===================== Grades: analytics, gradebook, calculators =====================
const gs = { tab: 'overview', range: 'all', cid: null };
VIEWS.grades = (rt) => {
  if (rt.arg && ['overview', 'gradebook', 'whatif', 'goal', 'gpa'].includes(rt.arg)) gs.tab = rt.arg;
  if (rt.sub && cls(rt.sub)) gs.cid = rt.sub;
  if (!gs.cid || !cls(gs.cid)) gs.cid = S.classes[0]?.id || null;
  const tabs = [['overview', 'Overview', 'chart-line'], ['gradebook', 'Gradebook', 'book-marked'], ['whatif', 'What-if', 'sliders-horizontal'], ['goal', 'Goal calculator', 'target'], ['gpa', 'GPA calculator', 'calculator']];
  const body = !S.classes.length ? `<div class="card">${emptyState('chart-line', 'No classes yet', 'Add a class and enter scores to see grades, GPA and trends.', `<button class="btn primary" onclick="editClass()">${icon('plus', 16)} Add class</button>`)}</div>`
    : ({ overview: gradesOverview, gradebook: () => classPicker() + gradebookHTML(gs.cid), whatif: whatIfHTML, goal: goalHTML, gpa: gpaCalcHTML }[gs.tab])();
  const g = gpaFor();
  return {
    title: 'Grades', sub: g ? `GPA ${g.unweighted.toFixed(2)} unweighted · ${g.weighted.toFixed(2)} weighted` : 'Grades, GPA and calculators',
    actions: S.classes.length ? `<button class="btn primary sm" id="g-add">${icon('plus', 15)} Add grade</button>` : '',
    html: `<div class="tabs" id="g-tabs">${tabs.map(([k, l, ic]) => `<button class="${gs.tab === k ? 'on' : ''}" data-t="${k}">${icon(ic, 15)}${l}</button>`).join('')}</div>${body}`,
    mount(root) {
      $('#g-tabs', root).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { gs.tab = b.dataset.t; go('grades', gs.tab); } };
      $('#g-add')?.addEventListener('click', () => editAssignment(null, { classId: gs.cid, status: 'completed', due: today() }));
      $('#g-cls', root)?.addEventListener('change', (e) => { gs.cid = e.target.value; render(); });
      $('#g-range', root)?.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { gs.range = b.dataset.r; render(); } });
      if (gs.tab === 'gradebook') mountGradebook(root, gs.cid);
      if (gs.tab === 'whatif') mountWhatIf(root); if (gs.tab === 'goal') mountGoal(root); if (gs.tab === 'gpa') mountGpaCalc(root);
    },
  };
};
const classPicker = () => `<div class="row" style="gap:8px"><span class="small muted">Class</span><select id="g-cls" style="width:auto;min-width:200px">${S.classes.map((c) => `<option value="${c.id}"${c.id === gs.cid ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`;

function gradesOverview() {
  const from = gs.range === '30' ? addDays(today(), -30) : gs.range === '90' ? addDays(today(), -90) : '0000';
  const dates = [...new Set(S.classes.flatMap((c) => gradedItems(c.id).map((x) => x.date)))].sort();
  const shown = dates.filter((d) => d >= from);
  const gpaSeries = shown.map((d) => { const g = gpaFor(undefined, d); return g ? round(g.unweighted, 2) : null; });
  const gpaW = shown.map((d) => { const g = gpaFor(undefined, d); return g ? round(g.weighted, 2) : null; });
  const now = gpaFor(), before = gpaFor(undefined, addDays(today(), -30));
  const delta = now && before ? now.unweighted - before.unweighted : null;
  const rows = S.classes.map((c) => ({ c, g: classGrade(c.id), h: gradeHistory(c.id) }));
  const graded = rows.filter((r) => r.g.pct != null);
  const onGoal = graded.filter((r) => r.c.goal && r.g.pct >= r.c.goal).length, withGoal = graded.filter((r) => r.c.goal).length;
  const best = [...graded].sort((a, b) => b.g.pct - a.g.pct)[0], worst = [...graded].sort((a, b) => a.g.pct - b.g.pct)[0];
  const items = S.classes.flatMap((c) => gradedItems(c.id).map((x) => ({ ...x, c })));
  const recent30 = items.filter((x) => x.date >= addDays(today(), -30));
  const trendFor = (r) => { const pts = r.h.filter((x) => x.date <= addDays(today(), -14)); const old = pts.length ? pts[pts.length - 1].pct : null; return old == null || r.g.pct == null ? null : r.g.pct - old; };
  const series = rows.filter((r) => r.h.length).map((r) => ({ name: r.c.name, color: r.c.color, points: shown.map((d, i) => { const hp = r.h.filter((x) => x.date <= d); return { i, y: hp.length ? round(hp[hp.length - 1].pct, 2) : null, label: fmtDate(d) }; }) }));
  const typeAvg = {}; for (const x of items) { const t = x.kind === 'exam' ? 'test' : byId('assignments', x.id)?.type || 'other'; (typeAvg[t] ||= []).push((x.score / x.max) * 100); }
  return `<div class="kpis">
    ${kpi('award', 'Unweighted GPA', now ? now.unweighted.toFixed(2) : '—', delta == null ? `${graded.length} graded classes` : `<span class="${delta >= 0 ? 'good' : 'bad'}">${icon(delta >= 0 ? 'trending-up' : 'trending-down', 13)} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}</span> vs 30 days ago`, null, spark(gpaSeries.slice(-12)))}
    ${kpi('star', 'Weighted GPA', now ? now.weighted.toFixed(2) : '—', `Honors +${S.settings.honorsBonus}, AP +${S.settings.apBonus}`, 'var(--accent-2)', spark(gpaW.slice(-12), 'var(--accent-2)'))}
    ${kpi('target', 'Classes at goal', withGoal ? `${onGoal}/${withGoal}` : '—', withGoal ? (onGoal === withGoal ? 'all on track' : `${withGoal - onGoal} below goal`) : 'set goals on your classes', onGoal === withGoal ? 'var(--good)' : 'var(--warn)')}
    ${kpi('percent', 'Average score', items.length ? round(avg(items.map((x) => (x.score / x.max) * 100)), 1) + '%' : '—', recent30.length ? `${round(avg(recent30.map((x) => (x.score / x.max) * 100)), 1)}% in the last 30 days` : `${items.length} graded items`, 'var(--good)')}
  </div>
  <div class="grid g-12">
    <div class="card s-8"><div class="card-h"><h2>GPA progression</h2><div class="end seg" id="g-range">${[['30', '30 days'], ['90', '90 days'], ['all', 'All']].map(([k, l]) => `<button class="${gs.range === k ? 'on' : ''}" data-r="${k}">${l}</button>`).join('')}</div></div>
      ${lineChart([{ name: 'Unweighted', color: 'var(--accent)', points: gpaSeries.map((y, i) => ({ i, y })) }, { name: 'Weighted', color: 'var(--accent-2)', points: gpaW.map((y, i) => ({ i, y })) }], { labels: shown.map((d) => fmtDate(d)), min: Math.max(0, Math.floor(Math.min(4, ...gpaSeries.filter((x) => x != null)) - 0.6)), max: Math.max(...gpaW.filter((x) => x != null), 4) > 4.2 ? 5 : 4.2, fmt: (v) => v.toFixed(2), empty: 'Your GPA trend appears once grades are entered.', aria: 'GPA over time' })}
      <p class="tiny dim" style="margin:8px 0 0">Each point is your GPA recalculated with only the grades entered up to that date.</p></div>
    <div class="card s-4"><div class="card-h"><h2>Class standings</h2></div>
      ${graded.length ? `<div class="stack" style="gap:12px">${graded.sort((a, b) => b.g.pct - a.g.pct).map((r) => { const t = trendFor(r); return `<a href="#classes/${r.c.id}" style="text-decoration:none;color:inherit"><div class="between small" style="margin-bottom:5px"><span class="row" style="gap:8px"><i class="dot-c" style="--c:${r.c.color}"></i><b>${esc(r.c.name)}</b></span><span class="row num" style="gap:6px">${t != null && Math.abs(t) >= 0.05 ? `<span class="tiny ${t > 0 ? 'good' : 'bad'}">${t > 0 ? '▲' : '▼'} ${Math.abs(round(t, 1))}</span>` : ''}<b style="color:${gradeColor(r.g.pct)}">${round(r.g.pct, 1)}%</b><span class="badge">${r.g.letter}</span></span></div><div class="bar" style="height:8px;position:relative"><i style="width:${clamp(r.g.pct, 0, 100)}%;--c:${r.c.color}"></i>${r.c.goal ? `<span style="position:absolute;top:-2px;bottom:-2px;left:${clamp(r.c.goal, 0, 100)}%;width:2px;background:var(--fg);opacity:.6" title="Goal ${r.c.goal}%"></span>` : ''}</div></a>`; }).join('')}</div><p class="tiny dim" style="margin:12px 0 0">The white tick is your goal. Arrows compare with two weeks ago.</p>` : emptyState('chart-line', 'No grades yet', 'Enter scores on assignments or exams.')}</div>
    <div class="card s-8"><div class="card-h"><h2>Class grade trends</h2></div>${series.length ? lineChart(series, { labels: shown.map((d) => fmtDate(d)), fmt: (v) => v + '%', area: false }) : emptyChart('No grade history yet')}</div>
    <div class="card s-4"><div class="card-h"><h2>Highlights</h2></div><div class="stack">
      ${best ? `<div class="alert good"><span class="ai">${icon('trending-up', 15)}</span><span><b>Strongest: ${esc(best.c.name)}</b><br><span class="small muted">${round(best.g.pct, 1)}% (${best.g.letter})</span></span></div>` : ''}
      ${worst && worst !== best ? `<div class="alert ${worst.c.goal && worst.g.pct < worst.c.goal ? 'warn' : 'info'}"><span class="ai">${icon('target', 15)}</span><span><b>Most room to grow: ${esc(worst.c.name)}</b><br><span class="small muted">${round(worst.g.pct, 1)}%${worst.c.goal ? `, goal ${worst.c.goal}%` : ''}</span></span></div>` : ''}
      ${Object.keys(typeAvg).length ? `<div><div class="small muted" style="margin:4px 0 8px">Average by type of work</div>${barChart(Object.entries(typeAvg).map(([t, v]) => ({ label: TYPES[t] || t, value: avg(v), sub: `${v.length}`, color: gradeColor(avg(v)) })).sort((a, b) => b.value - a.value), { horizontal: true, max: 100, fmt: (v) => round(v, 1) + '%' })}</div>` : ''}
    </div></div>
    <div class="card s-12"><div class="card-h"><h2>Category breakdown</h2><span class="end tiny muted">earned / possible in each category</span></div>${graded.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Class</th>${['Grade', 'Mode'].map((h) => `<th>${h}</th>`).join('')}<th>Categories</th></tr></thead><tbody>${rows.map((r) => `<tr><td><span class="row"><i class="dot-c" style="--c:${r.c.color}"></i><b>${esc(r.c.name)}</b></span></td><td class="num"><b style="color:${gradeColor(r.g.pct)}">${r.g.pct == null ? '—' : round(r.g.pct, 2) + '%'}</b></td><td class="small muted">${r.c.gradingMode === 'points' ? 'Points' : 'Weighted'}</td><td><div class="row wrap" style="gap:6px">${(r.g.cats || []).map((k) => `<span class="badge" style="background:var(--raised)">${esc(k.name)}${k.weight && k.id !== '_all' ? ` ${k.weight}%` : ''}: <b style="color:${gradeColor(k.pct)}">${k.pct == null ? '—' : round(k.pct, 1) + '%'}</b></span>`).join('') || '<span class="tiny dim">No grades</span>'}</div></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nothing to break down yet.</p>'}</div>
  </div>`;
}

// ---------- gradebook ----------
function gradebookHTML(cid) {
  const c = cls(cid); if (!c) return '';
  const g = classGrade(cid), as = S.assignments.filter((a) => a.classId === cid).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
  const exams = S.exams.filter((e) => e.classId === cid);
  const catName = (id) => c.categories?.find((k) => k.id === id)?.name || '';
  const catSel = (rec, kind) => `<select data-gcat="${kind}:${rec.id}" style="width:auto;padding:6px 8px;font-size:12.5px" aria-label="Category"><option value="">—</option>${(c.categories || []).map((k) => `<option value="${k.id}"${rec.categoryId === k.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select>`;
  const scoreIn = (rec, kind) => `<span class="row" style="gap:4px"><input type="number" step="any" min="0" data-gs="${kind}:${rec.id}" value="${rec.score ?? ''}" placeholder="—" style="width:76px;padding:6px 8px" aria-label="Points earned"><span class="muted">/</span><input type="number" step="any" min="0" data-gm="${kind}:${rec.id}" value="${rec.max ?? ''}" placeholder="max" style="width:76px;padding:6px 8px" aria-label="Points possible"></span>`;
  const rowsHtml = [...as.map((a) => ({ rec: a, kind: 'a', date: a.due, title: a.title, type: TYPES[a.type] })), ...exams.map((e) => ({ rec: e, kind: 'e', date: e.date, title: e.title, type: 'Exam' }))].sort((x, y) => (x.date || '').localeCompare(y.date || ''));
  return `<div class="grid g-12" style="margin-top:4px">
    <div class="card s-4"><div class="row" style="gap:16px">${ring(g.pct ?? 0, g.pct == null ? '—' : round(g.pct, 2) + '%', g.letter || 'no grades', 120, c.color)}<div class="stack" style="gap:4px"><b style="font-family:var(--f-display);font-size:17px">${esc(c.name)}</b><span class="small muted">${c.gradingMode === 'points' ? 'Total points' : 'Weighted categories'}</span><span class="small muted">${g.count} graded item${g.count === 1 ? '' : 's'}</span>${g.uncategorized ? `<span class="small warn">${g.uncategorized} graded item${g.uncategorized === 1 ? ' has' : 's have'} no category and ${c.gradingMode === 'points' ? 'still count' : 'are not counted'}</span>` : ''}${g.coverage != null && g.coverage < 0.999 ? `<span class="tiny dim">Based on ${Math.round(g.coverage * 100)}% of the course weight so far.</span>` : ''}</div></div></div>
    <div class="card s-8"><div class="card-h"><h3>Categories</h3></div>${(g.cats || []).length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">${g.cats.map((k) => `<div class="card flat raised" style="padding:12px"><div class="between tiny muted"><span>${esc(k.name)}</span><span>${k.id === '_all' ? '' : k.weight + '%'}</span></div><b class="num" style="font:700 20px var(--f-display);color:${gradeColor(k.pct)}">${k.pct == null ? '—' : round(k.pct, 1) + '%'}</b><div class="tiny muted num">${round(k.earned, 2)} / ${round(k.possible, 2)} pts · ${k.n} item${k.n === 1 ? '' : 's'}</div><div class="bar" style="margin-top:6px"><i style="width:${clamp(k.pct || 0, 0, 100)}%;--c:${gradeColor(k.pct)}"></i></div></div>`).join('')}</div>` : '<p class="small muted">No categories set. Edit the class to add them.</p>'}</div>
    <div class="card s-12"><div class="card-h"><h3>All work</h3><span class="end tiny muted">Type a score to grade it. Changes save instantly.</span></div>
      ${rowsHtml.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Date</th><th>Category</th><th>Score</th><th>%</th><th>Letter</th></tr></thead><tbody>${rowsHtml.map((r) => { const ok = r.rec.score != null && r.rec.score !== '' && r.rec.max > 0, p = ok ? (r.rec.score / r.rec.max) * 100 : null; return `<tr><td><b style="font-weight:600">${esc(r.title)}</b><div class="tiny muted">${r.type}${!ok && r.kind === 'a' ? ' · ' + STATUS[effStatus(r.rec)][0] : ''}</div></td><td class="small muted" style="white-space:nowrap">${r.date ? fmtDate(r.date) : '—'}</td><td>${catSel(r.rec, r.kind)}</td><td>${scoreIn(r.rec, r.kind)}</td><td class="num" data-pc="${r.kind}:${r.rec.id}"><b style="color:${gradeColor(p)}">${p == null ? '—' : round(p, 1) + '%'}</b></td><td>${p == null ? '' : `<span class="badge">${letterOf(p)}</span>`}</td></tr>`; }).join('')}</tbody></table></div>` : emptyState('book-marked', 'Nothing to grade yet', 'Add assignments or exams to this class.')}</div>
  </div>`;
}
function mountGradebook(root, cid) {
  const rec = (key) => { const [k, id] = key.split(':'); return [k === 'a' ? 'assignments' : 'exams', byId(k === 'a' ? 'assignments' : 'exams', id)]; };
  root.addEventListener('change', (e) => {
    const el = e.target, key = el.dataset.gs || el.dataset.gm || el.dataset.gcat; if (!key) return;
    const [col, r] = rec(key); if (!r) return;
    if (el.dataset.gcat) { r.categoryId = el.value; save(col); return; }
    const v = el.value === '' ? null : Number(el.value);
    if (v != null && (v < 0 || !isFinite(v))) { toast('Scores must be 0 or more'); el.value = ''; return; }
    if (el.dataset.gm && v === 0) { toast('Points possible must be more than 0'); el.value = r.max ?? ''; return; }
    if (el.dataset.gs) { r.score = v; if (v != null && !r.gradedOn) r.gradedOn = today(); if (v != null && col === 'assignments' && !isDone(r)) { r.status = 'completed'; r.completedAt ||= Date.now(); } } else r.max = v;
    if (r.score != null && r.max == null) { const m = el.closest('tr').querySelector('[data-gm]'); m.focus(); toast('Add points possible to count this score'); }
    save(col);
    const ok = r.score != null && r.max > 0, p = ok ? (r.score / r.max) * 100 : null, cell = el.closest('tr').querySelector('[data-pc]');
    if (cell) { cell.innerHTML = `<b style="color:${gradeColor(p)}">${p == null ? '—' : round(p, 1) + '%'}</b>`; cell.nextElementSibling.innerHTML = p == null ? '' : `<span class="badge">${letterOf(p)}</span>`; }
  });
  root.addEventListener('focusout', (e) => { if (!e.target.matches('[data-gs],[data-gm]')) return; setTimeout(() => { if (!document.activeElement?.matches?.('[data-gs],[data-gm]') && !modalStack.length) { const y = scrollY; render(); scrollTo(0, y); } }, 250); });
}

// ---------- what-if ----------
let wiRows = [];
function whatIfHTML() {
  const c = cls(gs.cid); if (!c) return '';
  return classPicker() + `<div class="grid g-12" style="margin-top:4px"><div class="card s-7"><div class="card-h"><h3>Try scores</h3><span class="end"><button class="btn sm" id="wi-add">${icon('plus', 14)} Add item</button></span></div>
    <p class="small muted" style="margin:0 0 12px">Enter hypothetical scores. Nothing here is saved to your gradebook. Upcoming ungraded work from this class is listed so you can fill it in.</p><div id="wi-rows" class="stack" style="gap:8px"></div></div>
    <div class="card s-5"><div class="card-h"><h3>Result</h3></div><div id="wi-out"></div></div></div>`;
}
function mountWhatIf(root) {
  const c = cls(gs.cid); if (!c) return;
  if (!wiRows.length || wiRows.cid !== c.id) {
    wiRows = S.assignments.filter((a) => a.classId === c.id && !isGraded(a)).slice(0, 6).map((a) => ({ title: a.title, cat: a.categoryId || '', score: '', max: a.max || '' }));
    if (!wiRows.length) wiRows = [{ title: 'Next test', cat: c.categories?.find((k) => /test|exam/i.test(k.name))?.id || c.categories?.[0]?.id || '', score: '', max: 100 }];
    wiRows.cid = c.id;
  }
  const draw = () => {
    $('#wi-rows', root).innerHTML = wiRows.map((r, i) => `<div class="row wrap" data-i="${i}" style="gap:6px;padding:8px;border:1px solid var(--line);border-radius:12px"><input type="text" data-k="title" value="${esc(r.title)}" placeholder="Item" style="flex:2;min-width:140px" aria-label="Item"><select data-k="cat" style="flex:1;min-width:110px;width:auto" aria-label="Category">${c.gradingMode === 'points' ? '<option value="">Points</option>' : (c.categories || []).map((k) => `<option value="${k.id}"${r.cat === k.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select><input type="number" data-k="score" value="${r.score}" placeholder="score" step="any" min="0" style="width:80px" aria-label="Score"><span class="muted">/</span><input type="number" data-k="max" value="${r.max}" placeholder="max" step="any" min="0" style="width:80px" aria-label="Max"><button type="button" class="icon-btn" style="width:34px;height:34px" data-rm="${i}" aria-label="Remove">${icon('x', 14)}</button></div>`).join('');
    out();
  };
  const out = () => {
    const extra = wiRows.filter((r) => r.score !== '' && Number(r.max) > 0).map((r, i) => ({ id: 'w' + i, title: r.title, cat: r.cat, score: Number(r.score), max: Number(r.max), date: today(), kind: 'whatif' }));
    const now = classGrade(c.id), next = classGrade(c.id, extra), d = next.pct != null && now.pct != null ? next.pct - now.pct : null;
    $('#wi-out', root).innerHTML = `<div class="row" style="gap:18px;justify-content:center">${ring(now.pct ?? 0, now.pct == null ? '—' : round(now.pct, 2) + '%', 'now', 110, 'var(--muted)')}${icon('arrow-right', 22, 'dim')}${ring(next.pct ?? 0, next.pct == null ? '—' : round(next.pct, 2) + '%', next.letter || 'projected', 130, c.color)}</div>
      <p style="text-align:center;margin:12px 0 0" class="${d == null ? 'muted' : d >= 0 ? 'good' : 'bad'}">${d == null ? 'Enter a score to see the projection.' : `${d >= 0 ? '+' : ''}${round(d, 2)} points · ${now.letter || '—'} → ${next.letter}`}</p>
      ${extra.length ? `<p class="tiny dim" style="text-align:center;margin:6px 0 0">Using ${extra.length} hypothetical item${extra.length === 1 ? '' : 's'} with the same formula as your gradebook.</p>` : ''}`;
  };
  draw();
  $('#wi-add', root).onclick = () => { wiRows.push({ title: '', cat: c.categories?.[0]?.id || '', score: '', max: 100 }); draw(); };
  $('#wi-rows', root).addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (!row || !e.target.dataset.k) return; wiRows[+row.dataset.i][e.target.dataset.k] = e.target.value; out(); });
  $('#wi-rows', root).addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { wiRows.splice(+b.dataset.rm, 1); draw(); } });
}

// ---------- goal calculator ----------
function goalHTML() {
  const c = cls(gs.cid); if (!c) return '';
  const nextTest = S.exams.filter((e) => e.classId === c.id && e.date >= today() && e.score == null).sort((a, b) => a.date.localeCompare(b.date))[0];
  return classPicker() + `<div class="grid g-12" style="margin-top:4px"><div class="card s-6"><div class="card-h"><h3>What do I need?</h3></div><div class="fgrid">
    <label class="f">Target grade %<input type="number" id="gl-target" value="${c.goal || 90}" step="0.5" min="0" max="120"></label>
    <label class="f">Next item is worth (points)<input type="number" id="gl-max" value="${nextTest?.max || 100}" step="any" min="1"></label>
    ${c.gradingMode === 'points' || !(c.categories || []).length ? '' : `<label class="f full">It counts in<select id="gl-cat">${c.categories.map((k) => `<option value="${k.id}"${(nextTest?.categoryId || c.categories.find((x) => /test|exam/i.test(x.name))?.id) === k.id ? ' selected' : ''}>${esc(k.name)} (${k.weight}%)</option>`).join('')}</select></label>`}
    </div>${nextTest ? `<p class="tiny dim" style="margin:10px 0 0">Prefilled from your next exam: ${esc(nextTest.title)} (${relDay(nextTest.date)}).</p>` : ''}</div>
    <div class="card s-6"><div class="card-h"><h3>Answer</h3></div><div id="gl-out"></div></div></div>`;
}
function mountGoal(root) {
  const c = cls(gs.cid); if (!c) return;
  const run = () => {
    const target = Number($('#gl-target', root).value), max = Number($('#gl-max', root).value), cat = $('#gl-cat', root)?.value || null, now = classGrade(c.id);
    const o = $('#gl-out', root);
    if (!(max > 0) || !isFinite(target)) { o.innerHTML = '<p class="muted">Enter a target and the points the item is worth.</p>'; return; }
    const need = neededScore(c.id, cat, max, target);
    if (need == null) { o.innerHTML = '<p class="muted">That category has no weight, so it can’t change your grade.</p>'; return; }
    const pct = (need / max) * 100;
    let msg, lvl;
    if (need <= 0) { msg = `You’ll finish at ${target}% or higher even with a 0 on this item.`; lvl = 'good'; }
    else if (need > max) { const best = classGrade(c.id, [{ id: 'x', cat, score: max, max, date: today() }]).pct; msg = `Not reachable with this item alone. You'd need ${round(need, 1)} of ${max} points (${round(pct, 1)}%). A perfect score gets you to ${round(best, 2)}%.`; lvl = 'bad'; }
    else { msg = `You need at least <b>${Math.ceil(need * 100) / 100}</b> of ${max} points (<b>${round(pct, 1)}%</b>) to reach ${target}%.`; lvl = pct > 90 ? 'warn' : 'good'; }
    o.innerHTML = `<div class="row" style="gap:18px">${ring(clamp(pct, 0, 100), need <= 0 ? '✓' : need > max ? '✕' : round(pct, 1) + '%', 'needed', 120, `var(--${lvl})`)}<div class="grow"><p style="margin:0">${msg}</p><p class="tiny dim" style="margin:8px 0 0">Current grade: ${now.pct == null ? 'none yet' : round(now.pct, 2) + '%'}. Assumes no other new grades before this one.</p></div></div>`;
  };
  root.addEventListener('input', (e) => { if (e.target.closest('#gl-target,#gl-max,#gl-cat')) run(); });
  $('#gl-cat', root)?.addEventListener('change', run); run();
}

// ---------- GPA calculator ----------
let gpaRows = null;
function gpaCalcHTML() {
  return `<div class="grid g-12"><div class="card s-8"><div class="card-h"><h3>GPA calculator</h3><span class="end row"><button class="btn ghost sm" id="gc-reset">${icon('rotate-ccw', 14)} From my classes</button><button class="btn sm" id="gc-add">${icon('plus', 14)} Row</button></span></div>
    <p class="small muted" style="margin:0 0 12px">Starts with your current classes. Change letters, levels or credits to plan ahead; this does not change your real grades. Uses your grade scale from Settings.</p><div id="gc-rows" class="stack" style="gap:8px"></div></div>
    <div class="card s-4"><div class="card-h"><h3>Result</h3></div><div id="gc-out"></div></div>
    <div class="card s-12"><div class="card-h"><h3>Your grade scale</h3><span class="end"><a class="btn ghost sm" href="#settings">${icon('settings', 14)} Edit</a></span></div><div class="row wrap" style="gap:6px">${S.settings.scale.map(([l, m, p]) => `<span class="badge" style="background:var(--raised);padding:5px 10px">${l} ≥ ${m}% = ${p.toFixed(1)}</span>`).join('')}</div></div></div>`;
}
function mountGpaCalc(root) {
  const fromClasses = () => S.classes.map((c) => { const g = classGrade(c.id); return { name: c.name, letter: g.letter || 'A', level: c.level || 'regular', credits: Number(c.credits) || 1, real: g.letter != null }; });
  if (!gpaRows) gpaRows = fromClasses();
  const draw = () => { $('#gc-rows', root).innerHTML = gpaRows.map((r, i) => `<div class="row wrap" data-i="${i}" style="gap:6px"><input type="text" data-k="name" value="${esc(r.name)}" placeholder="Class" style="flex:2;min-width:140px" aria-label="Class"><select data-k="letter" style="width:auto" aria-label="Letter">${S.settings.scale.map(([l]) => `<option${r.letter === l ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-k="level" style="width:auto" aria-label="Level">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}"${r.level === k ? ' selected' : ''}>${v}</option>`).join('')}</select><input type="number" data-k="credits" value="${r.credits}" min="0" step="0.25" style="width:80px" aria-label="Credits"><button type="button" class="icon-btn" style="width:34px;height:34px" data-rm="${i}" aria-label="Remove">${icon('x', 14)}</button></div>`).join(''); out(); };
  const out = () => {
    let u = 0, w = 0, cr = 0;
    for (const r of gpaRows) { const c = Number(r.credits) || 0, p = pointsOf(r.letter), b = p > 0 ? (r.level === 'ap' ? S.settings.apBonus : r.level === 'honors' ? S.settings.honorsBonus : 0) : 0; u += p * c; w += (p + b) * c; cr += c; }
    $('#gc-out', root).innerHTML = cr ? `<div class="row" style="gap:14px;justify-content:center">${ring((u / cr / 4) * 100, (u / cr).toFixed(2), 'unweighted', 116)}${ring((w / cr / 5) * 100, (w / cr).toFixed(2), 'weighted', 116, 'var(--accent-2)')}</div><p class="small muted" style="text-align:center;margin:10px 0 0">${cr} credits · ${gpaRows.length} classes</p>` : '<p class="muted">Add a class with credits.</p>';
  };
  draw();
  $('#gc-add', root).onclick = () => { gpaRows.push({ name: '', letter: 'A', level: 'regular', credits: 1 }); draw(); };
  $('#gc-reset', root).onclick = () => { gpaRows = fromClasses(); draw(); };
  $('#gc-rows', root).addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (row && e.target.dataset.k) { gpaRows[+row.dataset.i][e.target.dataset.k] = e.target.value; out(); } });
  $('#gc-rows', root).addEventListener('change', (e) => { const row = e.target.closest('[data-i]'); if (row && e.target.dataset.k) { gpaRows[+row.dataset.i][e.target.dataset.k] = e.target.value; out(); } });
  $('#gc-rows', root).addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { gpaRows.splice(+b.dataset.rm, 1); draw(); } });
}
