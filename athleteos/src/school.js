// ===================== SCHOOL (Athlete Life OS, first module) =====================
// Its own app in the suite (school.html = this bundle in "school" mode) and small read-only pieces inside Athlete OS:
// a Home widget, school items in the week calendar and day view, "due tomorrow" in Do first, exams in the briefing.
// Data: doc "life-school" { classes, items (assignments/tests), grades, snaps (GPA by day) } — owned by School.
ICONS.book = ic('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>');
BLANK['life-school'] = () => ({ classes: [], items: [], grades: [], snaps: {} });
const school = () => doc('life-school');
const SC_TYPES = [['hw', 'Homework', '#d99a12'], ['quiz', 'Quiz', '#3d8bff'], ['test', 'Test', '#ef4444'], ['exam', 'Exam', '#b91c1c'], ['project', 'Project', '#8b5cff'], ['essay', 'Essay', '#0d9488'], ['other', 'Other', '#64748b']];
const scType = (k) => SC_TYPES.find((x) => x[0] === k) || SC_TYPES[6];
const SC_CATS = [['test', 'Tests', 50], ['quiz', 'Quizzes', 30], ['hw', 'Homework', 20]];
const SC_COLORS = ['#3d8bff', '#22c55e', '#f97316', '#8b5cff', '#ef4444', '#0ea5e9', '#eab308', '#ec4899'];
const scClass = (id) => school().classes.find((c) => c.id === id);
VIEWS.splice(VIEWS.length - 1, 0, ['school', 'School', 'book', true]);
SUBS.school = [['due', 'Due'], ['classes', 'Classes'], ['grades', 'Grades']];

// ---------- grade math ----------
function classPct(c) {
  if (school().sl) return c.slPct ?? null; // published by Student Lens (its own weights and categories)
  const gs = school().grades.filter((g) => g.cls === c.id && Number(g.max) > 0);
  if (!gs.length) return null;
  const w = c.weights || Object.fromEntries(SC_CATS.map(([k, , v]) => [k, v])); let tot = 0, wsum = 0;
  for (const [k] of SC_CATS) { const xs = gs.filter((g) => (g.cat || 'hw') === k); if (!xs.length) continue; const p = sum(xs.map((g) => g.score)) / sum(xs.map((g) => g.max)); tot += p * (w[k] || 0); wsum += w[k] || 0; }
  return wsum ? r1((tot / wsum) * 100) : null;
}
const letterOf = (p) => (p == null ? '—' : p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');
const pointsOf = (p) => (p == null ? null : p >= 90 ? 4 : p >= 80 ? 3 : p >= 70 ? 2 : p >= 60 ? 1 : 0);
function gpa(filter = () => true, weighted = false) {
  if (school().sl && school().gpa && arguments.length === 0) return school().gpa.unweighted;
  if (school().sl && school().gpa && arguments.length === 2 && weighted && filter.toString() === '() => true') return school().gpa.weighted;
  const cs = school().classes.filter(filter).map((c) => ({ c, p: pointsOf(classPct(c)) })).filter((x) => x.p != null);
  if (!cs.length) return null;
  const bump = (c) => (!weighted ? 0 : c.level === 'ap' ? 1 : c.level === 'honors' ? 0.5 : 0);
  return r2(mean(cs.map((x) => x.p + (x.p > 0 ? bump(x.c) : 0))));
}
function eligibility() {
  const low = school().classes.map((c) => ({ c, p: classPct(c) })).filter((x) => x.p != null && x.p < 70), g = gpa();
  return { low, g, flag: low.some((x) => x.p < 60) || (g != null && g < 2) ? 'act' : low.length ? 'watch' : g == null ? 'none' : 'ok' };
}
function snapGpa() { const g = gpa(); if (g == null) return; const S = school(), t = todayIso(); if (S.snaps[t] !== g) { S.snaps[t] = g; persist('life-school'); } }
const scDue = (from, to) => school().items.filter((x) => !x.done && x.due >= from && x.due <= to).sort((a, b) => a.due.localeCompare(b.due) || (a.time || '').localeCompare(b.time || ''));
const scOverdue = () => school().items.filter((x) => !x.done && x.due < todayIso());
const scOn = (d) => school().items.filter((x) => x.due === d);

// ---------- School app screens ----------
RENDER.school = (el, sub) => {
  if (!school().sl) return SCHOOL[sub](el);
  // Student Lens owns school data now: show it read-only here and send edits there (they would be overwritten otherwise).
  SCHOOL[sub](el);
  el.insertAdjacentHTML('afterbegin', `<section class="card" style="border-left:4px solid #6d7cff"><div class="card-head"><div><h3>From Student Lens</h3><span class="sub">Classes, assignments and grades come from Student Lens. Make changes there.</span></div><a class="btn sm primary" data-ml href="student.html">Open Student Lens</a></div></section>`);
  el.querySelectorAll('[data-act^="sc-"]').forEach((b) => { b.hidden = true; });
};
const SCHOOL = {};
const itemRow = (x) => { const c = scClass(x.cls), [, l, col] = scType(x.type), late = !x.done && x.due < todayIso();
  return `<div class="li"><label class="check" style="flex:1;min-width:0"><input type="checkbox" data-sc-done="${x.id}" ${x.done ? 'checked' : ''} aria-label="Mark ${esc(x.title)} done"><span class="dot" style="background:${c?.color || col}"></span><span style="min-width:0"><span class="t" style="${x.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(x.title)}</span><span class="s" style="display:block">${esc(c?.name || 'No class')} · <span style="color:${col}">${l}</span> · ${late ? '<span class="down">late · </span>' : ''}${esc(fmtDL(x.due))}${x.mins ? ` · ~${fmtDur(x.mins)}` : ''}</span></span></label><button type="button" class="chip" data-act="sc-item" data-id="${x.id}">Edit</button></div>`; };
SCHOOL.due = (el) => {
  snapGpa();
  const t = todayIso(), od = scOverdue(), wk = scDue(t, shiftIso(t, 6)), later = scDue(shiftIso(t, 7), shiftIso(t, 30)), e = eligibility(), cs = school().classes;
  const days = Array.from({ length: 7 }, (_, i) => shiftIso(t, i)), load = days.map((d) => sum(scDue(d, d).map((x) => Number(x.mins) || 0))), mx = Math.max(60, ...load);
  el.innerHTML = `<section class="card hero"><span class="tiny muted">SCHOOL</span><h1>${od.length ? `${od.length} overdue · ` : ''}${wk.length} due this week</h1>
      <div class="kpis four" style="margin-top:10px"><div class="kpi"><small>GPA</small><b>${gpa() ?? '—'}</b><span class="delta tiny muted">${gpa(() => true, true) != null ? 'weighted ' + gpa(() => true, true) : 'add grades'}</span></div><div class="kpi"><small>Core GPA</small><b>${gpa((c) => c.core) ?? '—'}</b></div><div class="kpi"><small>Classes</small><b>${cs.length}</b></div><div class="kpi"><small>Eligibility</small><b style="font-size:17px;color:${CC_LV[e.flag][1]}">${e.flag === 'ok' ? 'Passing' : e.flag === 'none' ? '—' : e.flag === 'watch' ? 'Watch' : 'At risk'}</b></div></div>
      <div class="row" style="margin-top:12px"><button type="button" class="btn primary" data-act="sc-item">＋ Assignment or test</button><button type="button" class="btn" data-act="sc-grade">＋ Grade</button>${cs.length ? '' : '<button type="button" class="btn" data-act="sc-class">＋ Add your classes</button>'}</div></section>
    <section class="card"><div class="card-head"><div><h3>Homework load, next 7 days</h3><span class="sub">Estimated minutes due each day</span></div></div>
      <div class="sc-load">${days.map((d, i) => `<div><span class="tiny num">${load[i] ? Math.round(load[i]) + 'm' : ''}</span><i style="height:${Math.max(3, (load[i] / mx) * 72)}%"></i><span class="tiny muted">${i ? DOW[parseIso(d).getDay()] : 'Today'}</span></div>`).join('')}</div></section>
    ${od.length ? `<section class="card"><div class="card-head"><div><h3 class="down">Overdue</h3></div></div><div class="list">${od.map(itemRow).join('')}</div></section>` : ''}
    <section class="card"><div class="card-head"><div><h3>This week</h3></div></div>${wk.length ? `<div class="list">${wk.map(itemRow).join('')}</div>` : '<p class="muted small">Nothing due in the next 7 days.</p>'}</section>
    ${later.length ? `<section class="card"><div class="card-head"><div><h3>Coming up</h3><span class="sub">Next 30 days</span></div></div><div class="list">${later.map(itemRow).join('')}</div></section>` : ''}
    ${e.low.length ? `<section class="card"><div class="notice warn"><b>Grades to watch:</b> ${e.low.map((x) => `${esc(x.c.name)} ${x.p}%`).join(', ')}. Many schools need passing grades (often 70%+) and a 2.0 GPA to play. Check your school's exact rule.</div></section>` : ''}`;
};
SCHOOL.classes = (el) => {
  const cs = school().classes;
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Your classes</h3><span class="sub">Mark core classes for the NCAA core GPA</span></div><button type="button" class="btn sm primary" data-act="sc-class">＋ Class</button></div>
    ${cs.length ? `<div class="list">${cs.map((c) => { const p = classPct(c), due = school().items.filter((x) => x.cls === c.id && !x.done).length; return `<div class="li"><div class="row" style="flex-wrap:nowrap;min-width:0"><span class="dot" style="background:${c.color}"></span><div style="min-width:0"><div class="t">${esc(c.name)} ${c.core ? '<span class="tag">Core</span>' : ''}${c.level && c.level !== 'regular' ? `<span class="tag">${c.level === 'ap' ? 'AP' : 'Honors'}</span>` : ''}</div><div class="s">${[c.teacher, c.period && 'Period ' + c.period, due && `${due} open`].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div></div></div><span class="row" style="gap:6px;flex-wrap:nowrap"><b class="v">${p == null ? '—' : `${letterOf(p)} ${p}%`}</b><button type="button" class="chip" data-act="sc-class" data-id="${c.id}">Edit</button></span></div>`; }).join('')}</div>`
    : emptyState('Add your classes', 'Add each class once: name, teacher, period, and whether it is a core class.', 'book', '<button type="button" class="btn sm primary" data-act="sc-class">＋ Class</button>')}</section>`;
};
SCHOOL.grades = (el) => {
  snapGpa();
  const cs = school().classes, gs = [...school().grades].sort((a, b) => b.date.localeCompare(a.date)), snaps = Object.entries(school().snaps).sort().map(([date, v]) => ({ date, v }));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Grades by class</h3><span class="sub">Tests 50% · quizzes 30% · homework 20% unless you change a class's weights</span></div><button type="button" class="btn sm primary" data-act="sc-grade">＋ Grade</button></div>
      ${cs.some((c) => classPct(c) != null) ? `<div class="sc-bars">${cs.map((c) => { const p = classPct(c); return p == null ? '' : `<div class="sc-bar"><span class="small">${esc(c.name)}</span><div><i style="width:${Math.min(100, p)}%;background:${p >= 80 ? 'var(--good)' : p >= 70 ? 'var(--warn)' : 'var(--danger)'}"></i><b style="left:70%"></b></div><span class="small num">${letterOf(p)} ${p}%</span></div>`; }).join('')}</div><p class="tiny muted" style="margin-top:6px">Line at 70% = a common eligibility cutoff.</p>` : emptyState('No grades yet', 'Add test, quiz and homework scores to see each class and your GPA.', 'chart')}</section>
    <section class="card"><div class="card-head"><div><h3>GPA over time</h3><span class="sub">Saved each day your grades change</span></div></div><div class="chart" id="sc-gpa"></div>${snaps.length < 2 ? '<p class="muted small">Shows a trend once grades change on 2 different days.</p>' : ''}</section>
    <section class="card"><div class="card-head"><div><h3>All grades</h3></div></div>${gs.length ? `<div class="list">${gs.map((g) => { const c = scClass(g.cls); return `<div class="li"><div><div class="t">${esc(g.title || SC_CATS.find((x) => x[0] === g.cat)?.[1] || 'Grade')}</div><div class="s">${esc(c?.name || '')} · ${esc(fmtD(g.date))} · ${esc(SC_CATS.find((x) => x[0] === g.cat)?.[1] || '')}</div></div><span class="row" style="gap:6px;flex-wrap:nowrap"><b class="v">${g.score}/${g.max}</b><button type="button" class="chip" data-act="sc-grade" data-id="${g.id}">Edit</button></span></div>`; }).join('')}</div>` : '<p class="muted small">None yet.</p>'}</section>`;
  if (snaps.length >= 2) drawLine($('#sc-gpa'), snaps, { h: 170, color: 'var(--accent)', yMin: 0, yMax: 4, fmt: (v) => nf(v, 2), bands: [[0, 2, 'var(--danger)']] });
};

// ---------- forms ----------
const scOpts = (sel) => school().classes.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
ACTIONS['sc-class'] = (b) => {
  const c = b.dataset.id ? scClass(b.dataset.id) : null;
  openSheet(c ? 'Edit class' : 'Add class', `<div class="fields"><label class="full">Class name<input id="c-name" maxlength="40" value="${esc(c?.name || '')}" placeholder="e.g. Chemistry"></label>
    <label>Teacher<input id="c-teacher" maxlength="40" value="${esc(c?.teacher || '')}"></label><label>Period<input id="c-period" maxlength="10" value="${esc(c?.period || '')}"></label>
    <label>Level<select id="c-level">${[['regular', 'Regular'], ['honors', 'Honors'], ['ap', 'AP / dual credit']].map(([k, l]) => `<option value="${k}" ${c?.level === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="check" style="align-self:end"><input type="checkbox" id="c-core" ${c?.core ?? true ? 'checked' : ''}> Core class (English, math, science, social studies, language)</label></div>
    <button type="button" class="btn primary block" id="c-save">${c ? 'Save' : 'Add class'}</button>${c ? '<button type="button" class="btn danger block" id="c-del" style="margin-top:8px">Delete class</button>' : ''}`, (d) => {
    $('#c-name', d).focus();
    $('#c-save', d).addEventListener('click', () => {
      const name = $('#c-name', d).value.trim(); if (!name) return toast('Name the class');
      const S = school(), rec = { id: c?.id || uid('cl'), name, teacher: $('#c-teacher', d).value.trim(), period: $('#c-period', d).value.trim(), level: $('#c-level', d).value, core: $('#c-core', d).checked, color: c?.color || SC_COLORS[S.classes.length % SC_COLORS.length], weights: c?.weights };
      if (c) Object.assign(c, rec); else S.classes.push(rec); persist('life-school'); closeSheet(); refresh(); toast(c ? 'Saved' : 'Class added');
    });
    $('#c-del', d)?.addEventListener('click', () => confirmSheet(`Delete ${c.name}? Its assignments and grades stay but lose their class.`, 'Delete', () => { school().classes = school().classes.filter((x) => x.id !== c.id); persist('life-school'); refresh(); }));
  });
};
ACTIONS['sc-item'] = (b) => {
  const x = b.dataset.id ? school().items.find((i) => i.id === b.dataset.id) : null;
  openSheet(x ? 'Edit' : 'Add assignment or test', `<div class="fields"><label class="full">What<input id="i-title" maxlength="60" value="${esc(x?.title || '')}" placeholder="e.g. Chapter 5 test"></label>
    <label>Class<select id="i-cls"><option value="">No class</option>${scOpts(x?.cls)}</select></label><label>Type<select id="i-type">${SC_TYPES.map(([k, l]) => `<option value="${k}" ${(x?.type || 'hw') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Due<input type="date" id="i-due" value="${x?.due || shiftIso(todayIso(), 1)}"></label><label>Time (optional)<input type="time" id="i-time" value="${x?.time || ''}"></label>
    <label class="full">Study / work time (minutes)<input type="number" id="i-mins" min="0" max="600" step="5" value="${x?.mins ?? 30}"></label></div>
    <button type="button" class="btn primary block" id="i-save">${x ? 'Save' : 'Add'}</button>${x ? '<button type="button" class="btn danger block" id="i-del" style="margin-top:8px">Delete</button>' : ''}`, (d) => {
    $('#i-title', d).focus();
    $('#i-save', d).addEventListener('click', () => {
      const title = $('#i-title', d).value.trim(); if (!title) return toast('What is due?');
      const rec = { id: x?.id || uid('as'), title, cls: $('#i-cls', d).value, type: $('#i-type', d).value, due: $('#i-due', d).value || todayIso(), time: $('#i-time', d).value || '', mins: Math.max(0, Number($('#i-mins', d).value) || 0), done: x?.done || false };
      if (x) Object.assign(x, rec); else school().items.push(rec); persist('life-school'); closeSheet(); refresh(); toast('Saved');
    });
    $('#i-del', d)?.addEventListener('click', () => confirmSheet(`Delete "${x.title}"?`, 'Delete', () => { school().items = school().items.filter((i) => i.id !== x.id); persist('life-school'); refresh(); }));
  });
};
ACTIONS['sc-grade'] = (b) => {
  const g = b.dataset.id ? school().grades.find((i) => i.id === b.dataset.id) : null;
  if (!school().classes.length) return ACTIONS['sc-class']({ dataset: {} });
  openSheet(g ? 'Edit grade' : 'Add grade', `<div class="fields"><label>Class<select id="g-cls">${scOpts(g?.cls)}</select></label><label>Kind<select id="g-cat">${SC_CATS.map(([k, l]) => `<option value="${k}" ${(g?.cat || 'test') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="full">Name (optional)<input id="g-title" maxlength="50" value="${esc(g?.title || '')}" placeholder="e.g. Unit 3 test"></label>
    <label>Score<input type="number" id="g-score" min="0" step="0.5" value="${g?.score ?? ''}" inputmode="decimal"></label><label>Out of<input type="number" id="g-max" min="1" step="0.5" value="${g?.max ?? 100}" inputmode="decimal"></label>
    <label class="full">Date<input type="date" id="g-date" value="${g?.date || todayIso()}"></label></div>
    <button type="button" class="btn primary block" id="g-save">${g ? 'Save' : 'Add grade'}</button>${g ? '<button type="button" class="btn danger block" id="g-del" style="margin-top:8px">Delete</button>' : ''}`, (d) => {
    $('#g-save', d).addEventListener('click', () => {
      const score = Number($('#g-score', d).value), max = Number($('#g-max', d).value);
      if (!(max > 0) || !(score >= 0) || $('#g-score', d).value === '') return toast('Enter the score and what it was out of');
      const rec = { id: g?.id || uid('gr'), cls: $('#g-cls', d).value, cat: $('#g-cat', d).value, title: $('#g-title', d).value.trim(), score, max, date: $('#g-date', d).value || todayIso() };
      if (g) Object.assign(g, rec); else school().grades.push(rec); persist('life-school'); snapGpa(); closeSheet(); refresh(); toast('Grade saved');
    });
    $('#g-del', d)?.addEventListener('click', () => confirmSheet('Delete this grade?', 'Delete', () => { school().grades = school().grades.filter((i) => i.id !== g.id); persist('life-school'); refresh(); }));
  });
};
document.addEventListener('change', (e) => { const c = e.target.closest('[data-sc-done]'); if (!c) return; const x = school().items.find((i) => i.id === c.dataset.scDone); if (!x) return; x.done = c.checked; persist('life-school'); setTimeout(refresh, 80); if (x.done) toast('Done ✓'); });

// ---------- School mode (school.html) ----------
if (window.APP_MODE === 'school') {
  for (const v of VIEWS) v[3] = v[0] !== 'school';
  if (!location.hash.startsWith('#school')) history.replaceState(null, '', '#school');
  document.documentElement.classList.add('mode-school');
}

// ---------- inside Athlete OS ----------
WIDGETS.splice(2, 0, ['school', 'School this week']);
DEFAULT_W.splice(DEFAULT_W.indexOf('calendar') + 1, 0, 'school');
function homeSchool(el) {
  const t = todayIso(), od = scOverdue(), wk = scDue(t, shiftIso(t, 6)), tests = wk.filter((x) => ['test', 'exam', 'quiz', 'project'].includes(x.type)), e = eligibility();
  el.innerHTML = `<div class="card-head"><div><h3>School this week</h3><span class="sub">${wk.length} due · ${od.length} overdue${gpa() != null ? ` · GPA ${gpa()}` : ''}</span></div><a class="btn sm" data-ml href="student.html">Open Student Lens</a></div>
    ${school().classes.length || school().items.length ? `<div class="list">${[...od, ...wk].slice(0, 4).map((x) => `<div class="li"><span class="small" style="min-width:0"><i class="dot" style="background:${scClass(x.cls)?.color || scType(x.type)[2]};margin-right:6px"></i>${esc(x.title)} <span class="muted">· ${esc(scType(x.type)[1])}</span></span><span class="tiny ${x.due < t ? 'down' : 'muted'}">${x.due < t ? 'late' : x.due === t ? 'today' : esc(DOW[parseIso(x.due).getDay()])}</span></div>`).join('') || '<p class="muted small">Nothing due this week.</p>'}</div>
      ${tests.length ? `<p class="tiny" style="margin-top:6px">${tests.length} test/project day${tests.length > 1 ? 's' : ''} this week: plan lighter training the night before.</p>` : ''}${e.flag === 'act' || e.flag === 'watch' ? `<p class="tiny down" style="margin-top:4px">Grades to watch: ${e.low.map((x) => esc(x.c.name)).join(', ')}</p>` : ''}`
    : emptyState('Add your classes', 'Track assignments, tests and grades. Tests show up on your calendar and in your daily briefing.', 'book', '<a class="btn sm primary" data-ml href="student.html">Set up Student Lens</a>')}`;
}
{
  const base = RENDER.home;
  RENDER.home = (el) => {
    base(el);
    const s = $('[data-widget="school"]', el); if (s) { try { homeSchool(s); } catch (err) { console.error(err); } }
    // week calendar: school badge per day
    $$('[data-wkc]', el).forEach((b) => { const n = scOn(b.dataset.wkc).filter((x) => !x.done).length; if (n) b.insertAdjacentHTML('beforeend', `<span class="wkc-sc" title="${n} school item${n > 1 ? 's' : ''} due">${n}</span>`); });
  };
}
// Do first: due tomorrow / overdue
{
  const base = doFirst;
  doFirst = function () {
    const out = base(), t = todayIso(), tm = scDue(shiftIso(t, 1), shiftIso(t, 1)), od = scOverdue();
    if (od.length) out.push({ id: 'sc-od', ic: 'book', title: `${od.length} overdue assignment${od.length > 1 ? 's' : ''}`, why: od.slice(0, 2).map((x) => x.title).join(', '), btn: '<a class="btn sm" data-ml href="student.html">Student Lens</a>' });
    if (tm.length && new Date().getHours() >= 12) out.push({ id: 'sc-tm', ic: 'book', title: `Due tomorrow: ${tm[0].title}${tm.length > 1 ? ` +${tm.length - 1}` : ''}`, why: tm[0].mins ? `About ${fmtDur(sum(tm.map((x) => Number(x.mins) || 0)))} of work. Block it in Gameplan.` : 'Block time for it in Gameplan.', btn: '<a class="btn sm" data-ml href="gameplan.html">Block time</a>' });
    return out;
  };
}
// Daily briefing: tests today/tomorrow
{
  const base = ccDaily;
  ccDaily = function () {
    const t = todayIso(), tt = [...scDue(t, t), ...scDue(shiftIso(t, 1), shiftIso(t, 1))].filter((x) => ['test', 'exam', 'quiz'].includes(x.type)), s = base();
    if (!tt.length) return s;
    const x = tt[0], when = x.due === t ? 'today' : 'tomorrow';
    return `${s} ${scType(x.type)[1]} ${when}: ${x.title}${x.due !== t ? ', so study tonight and get to bed on time' : ''}.`;
  };
}
// Calendar day card: school items
{
  const base = dayCard;
  dayCard = function (el, d) { base(el, d); const xs = scOn(d); if (xs.length) el.insertAdjacentHTML('beforeend', `<div class="hr"></div><div class="gp-head"><span class="tiny muted">FROM STUDENT LENS · ${xs.length}</span><a class="chip" data-ml href="student.html">Open Student Lens ›</a></div><div class="list">${xs.map(itemRow).join('')}</div>`); };
}
