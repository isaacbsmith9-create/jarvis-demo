'use strict';
// ===================== Classes =====================
const CLASS_COLORS = ['#6d7cff', '#34c38f', '#f2b84b', '#f07178', '#38bdf8', '#c084fc', '#fb923c', '#2dd4bf', '#f472b6', '#a3e635'];
const LEVELS = { regular: 'Regular', honors: 'Honors', ap: 'AP / IB / Dual' };
const schedText = (c) => (c.schedule || []).map((s) => `${(s.days || []).map((d) => DAYS[d]).join('/')} ${fmtTime(s.start)}${s.end ? '–' + fmtTime(s.end) : ''}`).join(', ');
function classStats(c) {
  const g = classGrade(c.id), as = S.assignments.filter((a) => a.classId === c.id);
  const open = as.filter((a) => !isDone(a)), od = as.filter((a) => effStatus(a) === 'overdue');
  const nextEx = S.exams.filter((e) => e.classId === c.id && e.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const wk = sum(S.sessions.filter((s) => s.classId === c.id && s.start >= parseIso(weekStart(today())).setHours(0, 0, 0, 0)).map((s) => s.mins));
  const hist = gradeHistory(c.id).map((h) => h.pct);
  return { g, as, open, od, nextEx, wk, hist, done: as.filter(isDone).length };
}
VIEWS.classes = (rt) => {
  if (rt.arg && cls(rt.arg)) return classWorkspace(cls(rt.arg), rt.sub || 'overview');
  const gpa = gpaFor();
  return {
    title: 'Classes', sub: S.classes.length ? `${S.classes.length} class${S.classes.length === 1 ? '' : 'es'}${gpa ? ` · GPA ${gpa.unweighted.toFixed(2)} unweighted` : ''}` : 'Set up your schedule',
    actions: `<button class="btn ghost sm" id="c-syl">${icon('file-up', 16)}<span class="hide-sm">Scan syllabus</span></button><button class="btn primary sm" id="c-new">${icon('plus', 16)} Add class</button>`,
    html: S.classes.length ? `<div class="row" style="position:relative;max-width:380px"><span style="position:absolute;left:11px;color:var(--dim)">${icon('search', 16)}</span><input type="search" id="c-q" placeholder="Search classes or teachers" style="padding-left:34px"></div>
      <div class="grid" id="c-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))"></div>`
      : `<div class="card">${emptyState('library', 'Add your first class', 'Each class gets its own workspace with grades, assignments, notes, exams and analytics. You can type it in or scan a syllabus.', `<div class="row"><button class="btn primary" onclick="editClass()">${icon('plus', 16)} Add class</button><button class="btn" onclick="syllabusImport()">${icon('file-up', 16)} Scan syllabus</button></div>`)}</div>`,
    mount(root) {
      $('#c-new').onclick = () => editClass(); $('#c-syl').onclick = () => syllabusImport();
      const draw = (q = '') => { const g = $('#c-grid', root); if (!g) return; const list = S.classes.filter((c) => !q || (c.name + ' ' + (c.teacher || '')).toLowerCase().includes(q.toLowerCase())); g.innerHTML = list.length ? list.map(classCard).join('') : `<p class="muted">No classes match.</p>`; };
      draw(); $('#c-q', root)?.addEventListener('input', (e) => draw(e.target.value));
      root.addEventListener('click', (e) => { const c = e.target.closest('[data-cid]'); if (c) go('classes', c.dataset.cid); });
    },
  };
};
function classCard(c) {
  const st = classStats(c), pct = st.g?.pct, total = st.as.length;
  return `<div class="class-card" style="--c:${c.color}" data-cid="${c.id}" tabindex="0" role="link" aria-label="Open ${esc(c.name)}">
    <div class="cc-top"><span class="cc-icon">${icon(c.icon || 'book-open', 20)}</span><div class="cc-grade" style="color:${gradeColor(pct)}">${pct == null ? '—' : round(pct, 1) + '%'}<small>${pct == null ? 'No grades yet' : st.g.letter + (c.goal ? ` · goal ${c.goal}%` : '')}</small></div></div>
    <div style="position:relative"><h3>${esc(c.name)}</h3><div class="small muted">${esc([c.teacher, c.room].filter(Boolean).join(' · ') || LEVELS[c.level || 'regular'])}</div></div>
    <div class="between small"><span class="muted">${schedText(c) ? esc(schedText(c)) : LEVELS[c.level || 'regular']}</span>${spark(st.hist, c.color, 70, 24)}</div>
    <div><div class="between tiny muted" style="margin-bottom:5px"><span>${st.done}/${total} assignments done</span><span>${st.open.length} open${st.od.length ? ` · <b class="bad">${st.od.length} overdue</b>` : ''}</span></div><div class="bar"><i style="width:${total ? (st.done / total) * 100 : 0}%;--c:${c.color}"></i></div></div>
    <div class="between tiny"><span class="muted">${st.nextEx ? `${icon('graduation-cap', 13)} ${esc(st.nextEx.title)} · ${relDay(st.nextEx.date)}` : 'No exams scheduled'}</span><span class="muted">${fmtMins(st.wk)} studied this week</span></div>
  </div>`;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches?.('.class-card')) e.target.click(); });

function classWorkspace(c, tab) {
  const st = classStats(c), g = st.g, tabs = [['overview', 'Overview', 'house'], ['assignments', 'Assignments', 'list-checks'], ['grades', 'Grades', 'chart-line'], ['notes', 'Notes & materials', 'notebook-pen'], ['exams', 'Exams', 'graduation-cap'], ['study', 'Study', 'brain'], ['mastery', 'Mastery', 'layout-grid'], ['analytics', 'Analytics', 'gauge']];
  const body = { overview: cwOverview, assignments: cwAssignments, grades: () => gradebookHTML(c.id), notes: cwNotes, exams: cwExams, study: cwStudy, analytics: cwAnalytics, mastery: (c) => { ensureTopics(); return `<div class="card"><div class="card-h"><h3>Topic mastery</h3><span class="end"><a class="btn sm" href="#intel/mastery/${c.id}">Manage topics ${icon('arrow-right', 13)}</a></span></div>${masteryMap(c.id, true)}</div>`; } }[tab] || cwOverview;
  return {
    title: c.name, sub: `<a href="#classes" style="color:var(--muted);text-decoration:none">Classes</a> / ${esc(c.name)}`,
    actions: `<button class="btn ghost sm" id="cw-edit">${icon('pencil', 15)}<span class="hide-sm">Edit class</span></button><button class="btn primary sm" id="cw-add">${icon('plus', 15)} Assignment</button>`,
    html: `<div class="class-hero" style="--c:${c.color}"><div class="row wrap" style="gap:18px;align-items:center;position:relative">
        ${ring(g?.pct ?? 0, g?.pct == null ? '—' : round(g.pct, 1) + '%', g?.letter || 'no grades', 112, c.color)}
        <div class="grow" style="min-width:200px"><div class="eyebrow" style="color:${c.color}">${LEVELS[c.level || 'regular']} · ${Number(c.credits) || 1} credit${Number(c.credits) === 1 || !c.credits ? '' : 's'}</div><h2 style="font-size:24px;margin:4px 0">${esc(c.name)}</h2>
          <div class="small muted">${esc([c.teacher, c.room].filter(Boolean).join(' · '))}${schedText(c) ? ' · ' + esc(schedText(c)) : ''}</div>
          ${c.goal && g?.pct != null ? `<div class="row small" style="margin-top:8px;gap:6px">${g.pct >= c.goal ? `<span class="badge good">${icon('circle-check', 12)} At or above goal ${c.goal}%</span>` : `<span class="badge warn">${icon('target', 12)} ${round(c.goal - g.pct, 1)} points under goal ${c.goal}%</span>`}</div>` : ''}</div>
        <div class="row" style="gap:10px">${[['Open', st.open.length], ['Overdue', st.od.length], ['Studied', fmtMins(st.wk)]].map(([l, v]) => `<div class="card flat" style="padding:10px 14px;text-align:center;background:rgba(255,255,255,.04)"><b class="num" style="font:700 20px var(--f-display)">${v}</b><div class="tiny muted">${l}${l === 'Studied' ? ' this wk' : ''}</div></div>`).join('')}</div>
      </div></div>
      <div class="tabs" style="--c:${c.color}" id="cw-tabs">${tabs.map(([k, l, ic]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${icon(ic, 15)}${l}</button>`).join('')}</div>
      <div id="cw-body">${body(c, st)}</div>`,
    mount(root) {
      $('#cw-tabs', root).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) go('classes', c.id, b.dataset.t); };
      $('#cw-edit').onclick = () => editClass(c); $('#cw-add').onclick = () => editAssignment(null, { classId: c.id });
      if (tab === 'grades') mountGradebook(root, c.id);
      if (tab === 'mastery') root.addEventListener('click', (e) => { const b = e.target.closest('[data-tid]'); if (b) topicDetail(b.dataset.tid); });
      root.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
        if (a === 'note') editNote(null, { classId: c.id }); if (a === 'exam') editExam(null, { classId: c.id }); if (a === 'paste') pasteExtract(c.id); if (a === 'timer') startTimerFor(c.id, ''); if (a === 'guide') go('study', 'guides');
        if (a === 'upload') uploadMaterial(c.id); if (a === 'deck') newDeck(c.id); });
    },
  };
}
function cwOverview(c, st) {
  const up = st.open.map((a) => ({ a, p: priorityOf(a) })).sort((x, y) => y.p.score - x.p.score).slice(0, 6);
  const recent = gradedItems(c.id).slice(-5).reverse();
  return `<div class="grid g-12">
    <div class="card s-7"><div class="card-h"><h3>Up next</h3><span class="end"><button class="btn ghost sm" data-act="paste">${icon('scan-text', 14)} Paste instructions</button></span></div>${up.length ? `<div class="list">${up.map(({ a, p }) => assignmentRow(a, { pri: p })).join('')}</div>` : emptyState('circle-check', 'Nothing open', 'All work for this class is done.')}</div>
    <div class="card s-5"><div class="card-h"><h3>Grade breakdown</h3><span class="end tiny muted">${c.gradingMode === 'points' ? 'points-based' : 'weighted'}</span></div>
      ${st.g?.cats?.length ? barChart(st.g.cats.filter((k) => k.pct != null).map((k, i) => ({ label: `${k.name}${k.weight && k.id !== '_all' ? ` (${k.weight}%)` : ''}`, value: k.pct, sub: `${round(k.earned, 1)}/${round(k.possible, 1)} pts`, color: gradeColor(k.pct) })), { horizontal: true, max: 100, fmt: (v) => round(v, 1) + '%' }) + (st.g.cats.some((k) => k.pct == null) ? `<p class="tiny dim" style="margin:10px 0 0">No grades yet in: ${st.g.cats.filter((k) => k.pct == null).map((k) => esc(k.name)).join(', ')}. Those weights are left out until they have grades.</p>` : '') : emptyState('chart-line', 'No grades yet', 'Enter a score on an assignment or exam to see the breakdown.')}</div>
    <div class="card s-6"><div class="card-h"><h3>Recent grades</h3></div>${recent.length ? `<div class="list">${recent.map((x) => `<div class="li"><span class="grow"><span class="t">${esc(x.title)}</span><div class="s">${fmtDate(x.date)} · ${esc(c.categories?.find((k) => k.id === x.cat)?.name || 'Uncategorized')}</div></span><b class="num" style="color:${gradeColor((x.score / x.max) * 100)}">${round((x.score / x.max) * 100, 1)}%</b><span class="tiny muted num">${round(x.score, 2)}/${x.max}</span></div>`).join('')}</div>` : '<p class="muted small">No graded work yet.</p>'}</div>
    <div class="card s-6"><div class="card-h"><h3>Exams</h3><span class="end"><button class="btn ghost sm" data-act="exam">${icon('plus', 14)} Exam</button></span></div>${examMiniList(S.exams.filter((e) => e.classId === c.id))}</div>
  </div>`;
}
function cwAssignments(c) {
  const as = S.assignments.filter((a) => a.classId === c.id).sort((x, y) => Number(isDone(x)) - Number(isDone(y)) || (x.due || '9').localeCompare(y.due || '9'));
  return `<div class="card"><div class="card-h"><h3>All assignments</h3><span class="end"><button class="btn ghost sm" data-act="paste">${icon('scan-text', 14)} Paste instructions</button></span></div>${as.length ? `<div class="list">${as.map((a) => assignmentRow(a)).join('')}</div>` : emptyState('list-checks', 'No assignments', 'Add one with the button above.')}</div>`;
}
function cwNotes(c) {
  const notes = S.notes.filter((n) => n.classId === c.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const docs = S.docs.filter((d) => d.classId === c.id), guides = S.guides.filter((g) => g.classId === c.id);
  return `<div class="grid g-12"><div class="card s-7"><div class="card-h"><h3>Notes</h3><span class="end"><button class="btn sm" data-act="note">${icon('plus', 14)} Note</button></span></div>${notes.length ? `<div class="list">${notes.map((n) => `<a class="li click" href="#study/workspace/${n.id}" style="text-decoration:none;color:inherit">${icon('notebook-pen', 16)}<span class="grow"><span class="t">${esc(n.title)}</span><div class="s">${esc((n.body || '').slice(0, 90))}</div></span><span class="tiny muted">${n.updatedAt ? fmtDate(isoOf(new Date(n.updatedAt))) : ''}</span></a>`).join('')}</div>` : emptyState('notebook-pen', 'No notes yet', 'Notes you write here can become study guides, flashcards and quizzes.')}</div>
    <div class="s-5 stack" style="gap:18px;align-content:start"><div class="card"><div class="card-h"><h3>Materials</h3><span class="end"><button class="btn sm" data-act="upload">${icon('upload', 14)} Upload</button></span></div>${docs.length ? `<div class="stack" style="gap:6px">${docs.map((d) => attachmentLink({ docId: d.id })).join('')}</div>` : '<p class="small muted" style="margin:0">Upload PDFs, handouts or images (up to 4 MB each). They stay on this device.</p>'}</div>
    <div class="card"><div class="card-h"><h3>Study guides</h3><span class="end"><button class="btn ghost sm" data-act="guide">${icon('plus', 14)} Build</button></span></div>${guides.length ? `<div class="list">${guides.map((g) => `<a class="li click" href="#study/guides/${g.id}" style="text-decoration:none;color:inherit">${icon('book-text', 16)}<span class="grow t">${esc(g.title)}</span></a>`).join('')}</div>` : '<p class="small muted" style="margin:0">None yet.</p>'}</div></div></div>`;
}
function cwExams(c) { return `<div class="card"><div class="card-h"><h3>Exams</h3><span class="end"><button class="btn sm" data-act="exam">${icon('plus', 14)} Add exam</button></span></div>${examMiniList(S.exams.filter((e) => e.classId === c.id), true)}</div>`; }
function cwStudy(c) {
  const ss = S.sessions.filter((s) => s.classId === c.id).sort((a, b) => b.start - a.start), decks = S.decks.filter((d) => d.classId === c.id);
  return `<div class="grid g-12"><div class="card s-6"><div class="card-h"><h3>Flashcard decks</h3><span class="end"><button class="btn sm" data-act="deck">${icon('plus', 14)} Deck</button></span></div>${decks.length ? `<div class="list">${decks.map((d) => { const n = S.cards.filter((x) => x.deckId === d.id).length; return `<a class="li click" href="#study/cards/${d.id}" style="text-decoration:none;color:inherit">${icon('layers', 16)}<span class="grow"><span class="t">${esc(d.name)}</span><div class="s">${n} cards · ${cardsDue(d.id).length} due · ${Math.round(deckMastery(d.id) * 100)}% mastered</div></span>${icon('chevron-right', 15, 'dim')}</a>`; }).join('')}</div>` : '<p class="small muted">No decks for this class.</p>'}</div>
    <div class="card s-6"><div class="card-h"><h3>Study sessions</h3><span class="end"><button class="btn primary sm" data-act="timer">${icon('timer', 14)} Start timer</button></span></div>${ss.length ? `<div class="list">${ss.slice(0, 8).map(sessionRow).join('')}</div>` : '<p class="small muted">No sessions logged yet.</p>'}</div></div>`;
}
const sessionRow = (s) => `<div class="li"><span class="cbar" style="--c:${clsColor(s.classId)}"></span><span class="grow"><span class="t">${esc(s.topic || clsName(s.classId))}</span><div class="s">${fmtDay(isoOf(new Date(s.start)))} · ${new Date(s.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${s.rating ? ' · ' + '★'.repeat(s.rating) : ''}</div></span><b class="num">${fmtMins(s.mins)}</b></div>`;
function cwAnalytics(c) {
  const h = gradeHistory(c.id), weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(today()), -7 * (7 - i)));
  const mins = weeks.map((w) => sum(S.sessions.filter((s) => s.classId === c.id && isoOf(new Date(s.start)) >= w && isoOf(new Date(s.start)) <= addDays(w, 6)).map((s) => s.mins)));
  const as = S.assignments.filter((a) => a.classId === c.id && isDone(a) && a.completedAt && a.due), onTime = as.filter((a) => isoOf(new Date(a.completedAt)) <= a.due).length;
  const items = gradedItems(c.id), byType = {};
  for (const x of items) { const t = x.kind === 'exam' ? 'test' : byId('assignments', x.id)?.type || 'other'; (byType[t] ||= []).push((x.score / x.max) * 100); }
  return `<div class="grid g-12"><div class="card s-8"><div class="card-h"><h3>Grade over time</h3><span class="end tiny muted">after each graded item</span></div>${lineChart([{ name: c.name, color: c.color, points: h.map((x, i) => ({ i, y: x.pct == null ? null : round(x.pct, 2), label: fmtDate(x.date) })) }], { labels: h.map((x) => fmtDate(x.date)), goal: c.goal || null, fmt: (v) => v + '%', empty: 'Grades will chart here once you have two or more.' })}</div>
    <div class="card s-4"><div class="card-h"><h3>On-time rate</h3></div><div class="row" style="justify-content:center">${ring(as.length ? (onTime / as.length) * 100 : 0, as.length ? Math.round((onTime / as.length) * 100) + '%' : '—', `${onTime}/${as.length} on time`, 130, c.color)}</div></div>
    <div class="card s-6"><div class="card-h"><h3>Study minutes by week</h3></div>${barChart(weeks.map((w, i) => ({ label: fmtDate(w), short: fmtDate(w, { month: 'numeric', day: 'numeric' }), value: mins[i], color: c.color })), { fmt: fmtMins, empty: 'No study sessions logged for this class.' })}</div>
    <div class="card s-6"><div class="card-h"><h3>Average by work type</h3></div>${barChart(Object.entries(byType).map(([t, v]) => ({ label: TYPES[t] || t, value: avg(v), sub: `${v.length} graded`, color: gradeColor(avg(v)) })), { horizontal: true, max: 100, fmt: (v) => round(v, 1) + '%', empty: 'No graded work yet.' })}</div></div>`;
}
async function uploadMaterial(classId) {
  const f = await pickFile('.pdf,image/*,.txt,.md,.doc,.docx,.ppt,.pptx'); if (!f) return;
  if (f.size > 4e6) return toast('Files over 4 MB are too big to keep on this device.');
  const d = { id: uid('d'), name: f.name, size: f.size, type: f.type, data: await readAsDataURL(f), classId, at: Date.now() };
  try { const t = /pdf|text|image/.test(f.type) || /\.(pdf|txt|md)$/i.test(f.name) ? (f.type.startsWith('image/') ? '' : await fileToText(f)) : ''; if (t) d.text = t.slice(0, 200000); } catch { /* keep the file even if text can't be read */ }
  upsert('docs', d); toast(`Saved ${f.name}${d.text ? ' (text extracted for study tools)' : ''}`);
}

// ---------- editor ----------
function editClass(rec = null, preset = {}) {
  const isNew = !rec;
  const c = rec ? JSON.parse(JSON.stringify(rec)) : { id: uid('c'), name: '', teacher: '', room: '', color: CLASS_COLORS[S.classes.length % CLASS_COLORS.length], level: 'regular', credits: 1, goal: 90, gradingMode: 'weighted', categories: [{ id: uid('k'), name: 'Tests', weight: 40 }, { id: uid('k'), name: 'Quizzes', weight: 20 }, { id: uid('k'), name: 'Homework', weight: 25 }, { id: uid('k'), name: 'Projects', weight: 15 }], schedule: [], createdAt: Date.now(), ...preset };
  let cats = c.categories.map((k) => ({ ...k })), sched = (c.schedule || []).map((s) => ({ ...s, days: [...s.days] })), color = c.color, mode = c.gradingMode || 'weighted';
  modal({ title: isNew ? 'Add class' : 'Edit class', icon: 'library', wide: true,
    body: `<div class="fgrid">
      <label class="f">Class name<input type="text" name="name" value="${esc(c.name)}" placeholder="e.g. AP Biology" autofocus maxlength="60"></label>
      <label class="f">Teacher<input type="text" name="teacher" value="${esc(c.teacher || '')}" placeholder="e.g. Ms. Rivera"></label>
      <label class="f">Room (optional)<input type="text" name="room" value="${esc(c.room || '')}"></label>
      <label class="f">Level<select name="level">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}"${c.level === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f">Credits<input type="number" name="credits" min="0.25" max="10" step="0.25" value="${c.credits ?? 1}"></label>
      <label class="f">Goal grade %<input type="number" name="goal" min="0" max="110" step="0.5" value="${c.goal ?? ''}"></label>
      <div class="full"><div class="small" style="font-weight:600;color:var(--muted);margin-bottom:6px">Color</div><div class="swatches" id="ce-col">${CLASS_COLORS.map((x) => `<button type="button" style="--c:${x}" class="${x === color ? 'on' : ''}" data-c="${x}" aria-label="Color ${x}"></button>`).join('')}<input type="color" id="ce-custom" value="${color}" aria-label="Custom color"></div></div>
      <div class="full"><div class="between" style="margin-bottom:8px"><span class="small" style="font-weight:600;color:var(--muted)">Grading</span><div class="seg" id="ce-mode"><button type="button" data-m="weighted" class="${mode === 'weighted' ? 'on' : ''}">Weighted categories</button><button type="button" data-m="points" class="${mode === 'points' ? 'on' : ''}">Total points</button></div></div><div id="ce-cats"></div></div>
      <div class="full"><div class="between" style="margin-bottom:8px"><span class="small" style="font-weight:600;color:var(--muted)">Meeting times</span><button type="button" class="btn sm" id="ce-addsch">${icon('plus', 14)} Add time</button></div><div id="ce-sch" class="stack" style="gap:8px"></div></div>
    </div><div id="ce-warn"></div>`,
    foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${icon('trash-2', 15)} Delete class</button>`}<span class="grow"></span><button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-save>${icon('check', 15)} ${isNew ? 'Add class' : 'Save'}</button>`,
    onMount: (r, close) => {
      const drawCats = () => {
        const tot = sum(cats.map((k) => Number(k.weight) || 0));
        $('#ce-cats', r).innerHTML = mode === 'points' ? `<p class="small muted" style="margin:0">Grade = total points earned ÷ total points possible. Categories are still used for labels.</p>` + catRows(false) : catRows(true) + `<div class="between small" style="margin-top:8px"><button type="button" class="btn sm" id="ce-addcat">${icon('plus', 14)} Category</button><span class="${Math.abs(tot - 100) < 0.01 ? 'good' : 'warn'}">Weights total ${round(tot, 2)}%${Math.abs(tot - 100) < 0.01 ? '' : ' (should be 100%)'}</span></div>`;
        if (mode === 'points') $('#ce-cats', r).insertAdjacentHTML('beforeend', `<button type="button" class="btn sm" id="ce-addcat" style="margin-top:8px">${icon('plus', 14)} Category</button>`);
      };
      const catRows = (w) => `<div class="stack" style="gap:6px">${cats.map((k, i) => `<div class="row" data-ci="${i}"><input type="text" data-k="name" value="${esc(k.name)}" placeholder="Category" aria-label="Category name">${w ? `<input type="number" data-k="weight" value="${k.weight}" min="0" max="100" step="any" style="width:90px" aria-label="Weight percent"><span class="muted">%</span>` : ''}<button type="button" class="icon-btn" style="width:34px;height:34px" data-rmc="${i}" aria-label="Remove category">${icon('x', 14)}</button></div>`).join('')}</div>`;
      const drawSch = () => { $('#ce-sch', r).innerHTML = sched.length ? sched.map((s, i) => `<div class="row wrap" data-si="${i}" style="border:1px solid var(--line);border-radius:12px;padding:8px"><div class="chips">${DAYS.map((d, j) => `<button type="button" class="chip${s.days.includes(j) ? ' on' : ''}" data-day="${j}">${d}</button>`).join('')}</div><input type="time" data-k="start" value="${s.start}" style="width:auto" aria-label="Start"><span class="muted">to</span><input type="time" data-k="end" value="${s.end}" style="width:auto" aria-label="End"><button type="button" class="icon-btn" style="width:34px;height:34px" data-rms="${i}" aria-label="Remove time">${icon('x', 14)}</button></div>`).join('') : '<span class="tiny dim">Add meeting times to show this class on your planner.</span>'; };
      drawCats(); drawSch();
      $('#ce-col', r).onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; $$('#ce-col button', r).forEach((x) => x.classList.toggle('on', x === b)); };
      $('#ce-custom', r).oninput = (e) => { color = e.target.value; $$('#ce-col button', r).forEach((x) => x.classList.remove('on')); };
      $('#ce-mode', r).onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; $$('#ce-mode button', r).forEach((x) => x.classList.toggle('on', x === b)); drawCats(); };
      $('#ce-cats', r).addEventListener('input', (e) => { const row = e.target.closest('[data-ci]'); if (!row) return; cats[+row.dataset.ci][e.target.dataset.k] = e.target.dataset.k === 'weight' ? Number(e.target.value) : e.target.value; if (e.target.dataset.k === 'weight') { const tot = sum(cats.map((k) => Number(k.weight) || 0)); const s = $('#ce-cats .between span', r); if (s) { s.className = Math.abs(tot - 100) < 0.01 ? 'good' : 'warn'; s.textContent = `Weights total ${round(tot, 2)}%${Math.abs(tot - 100) < 0.01 ? '' : ' (should be 100%)'}`; } } });
      $('#ce-cats', r).addEventListener('click', (e) => { if (e.target.closest('#ce-addcat')) { cats.push({ id: uid('k'), name: '', weight: 0 }); drawCats(); } const b = e.target.closest('[data-rmc]'); if (b) { const k = cats[+b.dataset.rmc]; const used = S.assignments.some((a) => a.classId === c.id && a.categoryId === k.id); if (used && !confirm(`Some assignments use "${k.name}". Remove it anyway? They will become uncategorized.`)) return; cats.splice(+b.dataset.rmc, 1); drawCats(); } });
      $('#ce-addsch', r).onclick = () => { sched.push({ days: [1, 3, 5], start: '08:00', end: '08:50' }); drawSch(); };
      $('#ce-sch', r).addEventListener('click', (e) => { const row = e.target.closest('[data-si]'); if (!row) return; const s = sched[+row.dataset.si]; const d = e.target.closest('[data-day]'); if (d) { const j = +d.dataset.day; s.days = s.days.includes(j) ? s.days.filter((x) => x !== j) : [...s.days, j].sort(); d.classList.toggle('on'); } if (e.target.closest('[data-rms]')) { sched.splice(+row.dataset.si, 1); drawSch(); } });
      $('#ce-sch', r).addEventListener('input', (e) => { const row = e.target.closest('[data-si]'); if (row && e.target.dataset.k) sched[+row.dataset.si][e.target.dataset.k] = e.target.value; });
      $('[data-x2]', r).onclick = close;
      $('[data-del]', r)?.addEventListener('click', async () => {
        const n = S.assignments.filter((a) => a.classId === c.id).length;
        if (!(await confirmBox(`Delete ${c.name}? Its ${n} assignment${n === 1 ? '' : 's'}, exams and notes will be deleted too.`, 'Delete class'))) return;
        const snap = Object.fromEntries(['classes', 'assignments', 'exams', 'notes', 'decks', 'sessions', 'guides', 'docs', 'events'].map((k) => [k, S[k]]));
        S.classes = S.classes.filter((x) => x.id !== c.id); for (const k of ['assignments', 'exams', 'notes', 'guides', 'docs', 'events']) S[k] = S[k].filter((x) => x.classId !== c.id);
        save('classes', 'assignments', 'exams', 'notes', 'guides', 'docs', 'events'); close(); go('classes');
        toast(`${c.name} deleted`, { label: 'Undo', fn: () => { Object.assign(S, snap); save(...Object.keys(snap)); } });
      });
      $('[data-save]', r).onclick = () => {
        const f = formData(r), warn = $('#ce-warn', r), bad = (m) => (warn.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>${m}</div>`);
        if (!f.name) return bad('Give the class a name.');
        if (S.classes.some((x) => x.id !== c.id && x.name.trim().toLowerCase() === f.name.toLowerCase())) return bad('You already have a class with that name.');
        const cleanCats = cats.filter((k) => k.name.trim()).map((k) => ({ ...k, name: k.name.trim(), weight: Number(k.weight) || 0 }));
        if (mode === 'weighted' && cleanCats.length) { const tot = sum(cleanCats.map((k) => k.weight)); if (cleanCats.some((k) => k.weight < 0)) return bad('Weights can’t be negative.'); if (Math.abs(tot - 100) > 0.01 && !warn.dataset.confirmed) { warn.dataset.confirmed = 1; warn.innerHTML = `<div class="alert warn"><span class="ai">${icon('triangle-alert', 15)}</span>Weights add up to ${round(tot, 2)}%, not 100%. Grades are still calculated correctly (weights are scaled), but check your syllabus. Press save again to keep them.</div>`; return; } }
        for (const s of sched) if (!s.days.length || !s.start || (s.end && s.end <= s.start)) return bad('Each meeting time needs at least one day and an end after its start.');
        upsert('classes', { ...c, name: f.name, teacher: f.teacher, room: f.room, level: f.level, credits: f.credits || 1, goal: f.goal, color, gradingMode: mode, categories: cleanCats, schedule: sched });
        close(); toast(isNew ? `${f.name} added` : 'Class saved'); if (isNew) go('classes', c.id); else render();
      };
    } });
}

// ---------- syllabus scanner ----------
function syllabusImport() {
  modal({ title: 'Scan a syllabus', icon: 'file-up', wide: true,
    body: `<p class="small muted" style="margin:0">Student Lens reads the text and looks for the course name, teacher, grade weights (like "Tests 40%") and dated items. It uses patterns, not AI, so you'll review everything before it is saved.</p>${sourceBox('sy')}`,
    foot: `<button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-go>${icon('arrow-right', 15)} Read syllabus</button>`,
    onMount: (r, close) => {
      const get = wireSource(r, 'sy'); $('[data-x2]', r).onclick = close;
      $('[data-go]', r).onclick = () => { const t = get().trim(); if (t.length < 20) return toast('Add the syllabus text first.'); close(); syllabusReview(parseSyllabus(t)); };
    } });
}
function syllabusReview(p) {
  let cats = p.categories;
  modal({ title: 'Check what was found', icon: 'scan-text', wide: true,
    body: `${p.notes.map((n) => `<div class="alert warn"><span class="ai">${icon('triangle-alert', 15)}</span>${esc(n)}</div>`).join('')}
      <div class="fgrid"><label class="f">Save into<select id="sr-target"><option value="new">A new class</option>${S.classes.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f">Class name<input type="text" id="sr-name" value="${esc(p.name)}" placeholder="Not found, type it"></label>
      <label class="f">Teacher<input type="text" id="sr-teacher" value="${esc(p.teacher)}" placeholder="Not found"></label>
      <label class="row small" style="align-self:end"><input type="checkbox" id="sr-usecats" ${cats.length ? 'checked' : 'disabled'}> Use these grade weights</label></div>
      <div><div class="small" style="font-weight:600;color:var(--muted);margin-bottom:6px">Grade weights found (${cats.length})</div>${cats.length ? `<div class="stack" style="gap:6px" id="sr-cats">${cats.map((k, i) => `<div class="row" data-ci="${i}"><input type="text" value="${esc(k.name)}" data-k="name" aria-label="Category"><input type="number" value="${k.weight}" data-k="weight" style="width:90px" aria-label="Weight"><span class="muted">%</span></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">None found. Lines like "Tests 40%" or "Homework – 20%" are recognized. You can set categories in the class editor.</p>'}</div>
      <p class="small muted" style="margin:0">${p.items.length} dated item${p.items.length === 1 ? '' : 's'} found. You'll review them next.</p>`,
    foot: `<button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-go>${icon('arrow-right', 15)} Continue</button>`,
    onMount: (r, close) => {
      $('#sr-cats', r)?.addEventListener('input', (e) => { const row = e.target.closest('[data-ci]'); if (row) cats[+row.dataset.ci][e.target.dataset.k] = e.target.dataset.k === 'weight' ? Number(e.target.value) : e.target.value; });
      $('[data-x2]', r).onclick = close;
      $('[data-go]', r).onclick = () => {
        const target = $('#sr-target', r).value, name = $('#sr-name', r).value.trim(), teacher = $('#sr-teacher', r).value.trim(), useCats = $('#sr-usecats', r).checked;
        let c;
        if (target === 'new') { if (!name) return toast('Type the class name.'); if (S.classes.some((x) => x.name.toLowerCase() === name.toLowerCase())) return toast('A class with that name exists. Pick it under "Save into".');
          c = { id: uid('c'), name, teacher, room: '', color: CLASS_COLORS[S.classes.length % CLASS_COLORS.length], level: /\bap\b|honors/i.test(name) ? (/\bap\b/i.test(name) ? 'ap' : 'honors') : 'regular', credits: 1, goal: 90, gradingMode: 'weighted', categories: useCats ? cats : [], schedule: [], createdAt: Date.now() };
        } else { c = { ...cls(target) }; if (teacher && !c.teacher) c.teacher = teacher; if (useCats && cats.length) { if (S.assignments.some((a) => a.classId === c.id && a.categoryId) && !confirm('Replace this class’s grade categories? Assignments already sorted into categories will become uncategorized.')) return; c.categories = cats; } }
        upsert('classes', c); close();
        if (p.items.length) reviewItems(p.items.map((x) => ({ ...x, classId: c.id })), 'the syllabus', () => go('classes', c.id)); else { toast('Class saved'); go('classes', c.id); }
      };
    } });
}
