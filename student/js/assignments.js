'use strict';
// ===================== Assignments =====================
const af = { view: 'smart', q: '', cls: '', type: '', status: 'open' };
const statusBadge = (a) => { const [l, c] = STATUS[effStatus(a)] || STATUS.not_started; return `<span class="badge ${c}">${l}</span>`; };
const dueText = (a) => a.due ? `${relDay(a.due)}${a.dueTime ? ' · ' + fmtTime(a.dueTime) : ''}` : 'No due date';
function assignmentRow(a, o = {}) {
  const p = o.pri, done = isDone(a), late = effStatus(a) === 'overdue';
  return `<div class="li click" data-aid="${a.id}">
    <button type="button" class="check${done ? ' on' : ''}" data-done="${a.id}" aria-label="${done ? 'Mark not done' : 'Mark done'}">${done ? icon('check', 14) : ''}</button>
    <span class="cbar" style="--c:${clsColor(a.classId)}"></span>
    <div class="grow"><div class="t" style="${done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(a.title)}</div>
      <div class="s">${esc(clsName(a.classId))} · ${TYPES[a.type] || 'Other'} · <span class="${late ? 'bad' : ''}">${dueText(a)}</span>${a.estMins ? ' · ~' + fmtMins(a.estMins) : ''}${isGraded(a) ? ` · <b style="color:${gradeColor((a.score / a.max) * 100)}">${round(a.score, 2)}/${a.max}</b>` : ''}${a.recur || a.recurOf ? ' · ' + icon('repeat', 12) : ''}${(a.attachments || []).length ? ' · ' + icon('link', 12) + ' ' + a.attachments.length : ''}</div>
      ${p && !done ? `<div class="why">${p.why.slice(0, 4).map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : ''}</div>
    ${p && !done ? `<span class="pri ${p.score >= 85 ? 'p3' : p.score >= 55 ? 'p2' : 'p1'}" title="Priority score ${p.score}">${p.score}</span>` : statusBadge(a)}
  </div>`;
}
function toggleDone(id) {
  const a = byId('assignments', id); if (!a) return;
  const was = { status: a.status, completedAt: a.completedAt };
  if (isDone(a)) { a.status = 'in_progress'; a.completedAt = null; } else { a.status = 'completed'; a.completedAt = Date.now(); }
  save('assignments'); refreshOverdue();
  toast(isDone(a) ? `Done: ${a.title}` : `Reopened: ${a.title}`, { label: 'Undo', fn: () => { Object.assign(a, was); save('assignments'); refreshOverdue(); } });
}
document.addEventListener('click', (e) => {
  const d = e.target.closest('[data-done]'); if (d) { e.stopPropagation(); toggleDone(d.dataset.done); return; }
  const r = e.target.closest('[data-aid]'); if (r && !e.target.closest('button,a,input,select')) openAssignment(r.dataset.aid);
});

VIEWS.assignments = (rt) => {
  if (rt.arg === 'overdue') { af.status = 'overdue'; history.replaceState(null, '', '#assignments'); }
  const t = today(), all = S.assignments;
  const openN = openAssignments().length, od = all.filter((a) => effStatus(a) === 'overdue').length;
  const wk = all.filter((a) => a.due >= weekStart(t) && a.due <= addDays(weekStart(t), 6));
  const wkDone = wk.filter(isDone).length;
  const onTime = all.filter((a) => isDone(a) && a.due && a.completedAt), onTimeN = onTime.filter((a) => isoOf(new Date(a.completedAt)) <= a.due).length;
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  const load = days.map((d) => ({ label: i18day(d), short: i18day(d), value: workloadOn(d), sub: `${openAssignments().filter((a) => a.due === d).length} due`, color: workloadOn(d) > 150 ? 'var(--bad)' : workloadOn(d) > 90 ? 'var(--warn)' : 'var(--accent)' }));
  return {
    title: 'Assignments', sub: `${openN} open${od ? ` · <span class="bad">${od} overdue</span>` : ''}`,
    actions: `<button class="btn ghost sm" id="a-more">${icon('ellipsis', 16)}<span class="hide-sm">Import / export</span></button><button class="btn primary sm" id="a-new">${icon('plus', 16)} New</button>`,
    html: `<div class="kpis">
      ${kpi('list-todo', 'Open', openN, `${all.length} total`)}
      ${kpi('triangle-alert', 'Overdue', od, od ? 'needs attention' : 'none', od ? 'var(--bad)' : null)}
      ${kpi('circle-check', 'This week', `${wkDone}/${wk.length}`, 'completed')}
      ${kpi('clock', 'On-time rate', onTime.length ? Math.round((onTimeN / onTime.length) * 100) + '%' : '—', onTime.length ? `${onTimeN} of ${onTime.length} finished on time` : 'finish work to track it')}
    </div>
    <div class="grid g-12">
      <div class="card s-8"><div class="card-h"><h2>Your work</h2><div class="end"><div class="seg" id="a-view">${[['smart', 'Smart order'], ['due', 'By due date'], ['class', 'By class']].map(([k, l]) => `<button class="${af.view === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div></div></div>
        <div class="row wrap" style="margin-bottom:12px;gap:8px">
          <div class="row grow" style="min-width:180px;position:relative"><span style="position:absolute;left:11px;color:var(--dim)">${icon('search', 16)}</span><input type="search" id="a-q" placeholder="Search assignments" value="${esc(af.q)}" style="padding-left:34px"></div>
          <select id="a-cls" style="width:auto">${classOptions(af.cls, 'All classes')}</select>
          <select id="a-type" style="width:auto"><option value="">All types</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${af.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="chips" id="a-st" style="margin-bottom:6px">${[['open', 'Open'], ['overdue', 'Overdue'], ['today', 'Due today'], ['week', 'Next 7 days'], ['done', 'Done'], ['all', 'All']].map(([k, l]) => `<button class="chip${af.status === k ? ' on' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
        <div id="a-list"></div></div>
      <div class="s-4 stack" style="gap:18px;align-content:start">
        <div class="card"><div class="card-h"><h3>Workload, next 7 days</h3><span class="end tiny muted">est. minutes due</span></div>${barChart(load, { h: 170, fmt: (v) => fmtMins(v), empty: 'Nothing due in the next 7 days' })}
          <p class="tiny dim" style="margin:8px 0 0">Uses each assignment's time estimate, or a default for its type.</p></div>
        <div class="card"><div class="card-h"><h3>How Smart order works</h3></div><p class="small muted" style="margin:0">A fixed set of rules scores every open assignment: how soon it is due, overdue days, the type (tests and projects weigh more), the priority you set, time needed, an exam in the same class within 5 days, and whether that class is under your goal. Each row shows the reasons it was ranked there. No AI is involved.</p></div>
      </div>
    </div>`,
    mount(root) {
      const draw = () => { $('#a-list', root).innerHTML = assignmentList(); };
      draw();
      $('#a-q', root).addEventListener('input', (e) => { af.q = e.target.value; draw(); });
      $('#a-cls', root).onchange = (e) => { af.cls = e.target.value; draw(); };
      $('#a-type', root).onchange = (e) => { af.type = e.target.value; draw(); };
      $('#a-st', root).onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; af.status = b.dataset.s; $$('#a-st .chip', root).forEach((x) => x.classList.toggle('on', x === b)); draw(); };
      $('#a-view', root).onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; af.view = b.dataset.v; $$('#a-view button', root).forEach((x) => x.classList.toggle('on', x === b)); draw(); };
      $('#a-new').onclick = () => editAssignment();
      $('#a-more').onclick = assignmentIO;
    },
  };
};
const i18day = (d) => (d === today() ? 'Today' : DAYS[dow(d)]);
function kpi(ic, label, value, sub, color, sp = '') { return `<div class="kpi"><div class="k-l"><span class="ki" ${color ? `style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color}"` : ''}>${icon(ic, 15)}</span>${esc(label)}</div><div class="k-v num">${value}</div><div class="k-s">${sub}</div>${sp}</div>`; }
function assignmentList() {
  const t = today(), q = af.q.toLowerCase();
  let list = S.assignments.filter((a) => (!af.cls || a.classId === af.cls) && (!af.type || a.type === af.type) && (!q || (a.title + ' ' + (a.description || '') + ' ' + clsName(a.classId)).toLowerCase().includes(q)));
  const st = af.status;
  list = list.filter((a) => st === 'all' ? true : st === 'done' ? isDone(a) : st === 'overdue' ? effStatus(a) === 'overdue' : st === 'today' ? !isDone(a) && a.due === t : st === 'week' ? !isDone(a) && a.due >= t && a.due <= addDays(t, 6) : !isDone(a));
  if (!S.classes.length && !S.assignments.length) return emptyState('list-checks', 'No assignments yet', 'Add one, paste instructions to pull them out automatically, or import a CSV.', `<div class="row"><button class="btn primary sm" onclick="editAssignment()">${icon('plus', 15)} Add assignment</button><button class="btn sm" onclick="pasteExtract()">${icon('scan-text', 15)} Paste instructions</button></div>`);
  if (!list.length) return emptyState('circle-check', 'Nothing here', st === 'overdue' ? 'No overdue work. Nice.' : 'No assignments match these filters.');
  if (af.view === 'smart' && st !== 'done') {
    const open = list.filter((a) => !isDone(a)).map((a) => ({ a, p: priorityOf(a) })).sort((x, y) => y.p.score - x.p.score);
    const done = list.filter(isDone);
    return `<div class="list">${open.map(({ a, p }) => assignmentRow(a, { pri: p })).join('')}${done.map((a) => assignmentRow(a)).join('')}</div>`;
  }
  if (af.view === 'class') {
    const groups = {}; for (const a of list) (groups[a.classId || ''] ||= []).push(a);
    return Object.entries(groups).map(([cid, as]) => `<h4 class="row" style="margin:14px 0 4px"><i class="dot-c" style="--c:${clsColor(cid)}"></i>${esc(clsName(cid))} <span class="muted tiny">${as.length}</span></h4><div class="list">${as.sort((x, y) => (x.due || '9').localeCompare(y.due || '9')).map((a) => assignmentRow(a)).join('')}</div>`).join('');
  }
  const bucket = (a) => { if (!a.due) return 'No due date'; if (isDone(a)) return 'Done'; const n = daysBetween(t, a.due); return n < 0 ? 'Overdue' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n <= 6 ? 'This week' : n <= 13 ? 'Next week' : 'Later'; };
  const order = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Next week', 'Later', 'No due date', 'Done'], groups = {};
  for (const a of list.sort((x, y) => (x.due || '9').localeCompare(y.due || '9') || (x.dueTime || '99').localeCompare(y.dueTime || '99'))) (groups[bucket(a)] ||= []).push(a);
  return order.filter((k) => groups[k]).map((k) => `<h4 style="margin:14px 0 4px" class="${k === 'Overdue' ? 'bad' : ''}">${k} <span class="muted tiny">${groups[k].length}</span></h4><div class="list">${groups[k].map((a) => assignmentRow(a)).join('')}</div>`).join('');
}

// ---------- detail ----------
const STEP_TPL = { project: [['Research and sources', 25], ['Outline / plan', 15], ['Build the first draft', 30], ['Revise and polish', 20], ['Final check and submit', 10]], essay: [['Read prompt and gather evidence', 20], ['Thesis and outline', 15], ['Write the draft', 35], ['Revise', 20], ['Proofread and submit', 10]], lab: [['Organize data', 20], ['Graphs and tables', 25], ['Analysis and conclusion', 40], ['Proofread and submit', 15]], test: [['List topics and gather notes', 15], ['Review notes and flashcards', 35], ['Practice problems', 30], ['Practice test and review misses', 20]], other: [['Get started', 30], ['Finish', 50], ['Check and submit', 20]] };
function openAssignment(id) {
  const a = byId('assignments', id); if (!a) return;
  const p = priorityOf(a), c = cls(a.classId), cat = c?.categories?.find((k) => k.id === a.categoryId);
  modal({ title: a.title, icon: TYPE_ICON[a.type] || 'file-text', headEnd: statusBadge(a),
    body: `<div class="row wrap" style="gap:6px"><span class="badge" style="background:color-mix(in srgb, ${clsColor(a.classId)} 22%, transparent);color:var(--fg)">${esc(clsName(a.classId))}</span><span class="badge">${TYPES[a.type] || 'Other'}</span>${cat ? `<span class="badge">${esc(cat.name)}</span>` : ''}<span class="badge ${['', '', 'warn', 'bad'][a.priority || 2]}">${['', 'Low', 'Medium', 'High'][a.priority || 2]} priority</span>${a.recur ? `<span class="badge accent">${icon('repeat', 11)} Repeats</span>` : ''}</div>
      <div class="fgrid">
        <div class="card flat raised" style="padding:12px"><div class="tiny muted">Due</div><b>${a.due ? fmtDay(a.due) : '—'}${a.dueTime ? ' · ' + fmtTime(a.dueTime) : ''}</b><div class="tiny ${effStatus(a) === 'overdue' ? 'bad' : 'muted'}">${a.due ? relDay(a.due) : ''}</div></div>
        <div class="card flat raised" style="padding:12px"><div class="tiny muted">Time</div><b>${a.estMins ? '~' + fmtMins(a.estMins) + ' estimated' : 'No estimate'}</b><div class="tiny muted">${a.actualMins ? fmtMins(a.actualMins) + ' actual' : 'Actual time not logged'}</div></div>
        <div class="card flat raised" style="padding:12px"><div class="tiny muted">Grade</div><b>${isGraded(a) ? `${round(a.score, 2)} / ${a.max} · ${round((a.score / a.max) * 100, 1)}%` : 'Not graded yet'}</b></div>
        <div class="card flat raised" style="padding:12px"><div class="tiny muted">Priority score</div><b>${isDone(a) ? '—' : p.score}</b><div class="tiny muted">${isDone(a) ? 'Finished' : esc(p.why.join(', ') || 'Nothing urgent')}</div></div>
      </div>
      ${a.description ? `<div><div class="tiny muted" style="margin-bottom:4px">Instructions</div><div style="white-space:pre-wrap">${esc(a.description)}</div></div>` : ''}
      ${(a.attachments || []).length ? `<div><div class="tiny muted" style="margin-bottom:6px">Attachments</div><div class="stack" style="gap:6px">${a.attachments.map((x) => attachmentLink(x)).join('')}</div></div>` : ''}
      ${isDone(a) ? '' : (() => { const df = difficultyOf(a), dr = deadlineRisk(a), st = a.steps || [], R = estRatio(); return `<div class="card flat raised" style="padding:12px"><div class="between"><b class="small">${icon('gauge', 14)} Assignment intelligence</b><span class="tag-obs a">Estimates</span></div><div class="row wrap small" style="gap:14px;margin-top:8px"><span>Difficulty <b class="${df.level === 3 ? 'bad' : df.level === 2 ? 'warn' : 'good'}">${df.label}</b> <span class="tiny dim">(${esc(df.src)})</span></span><span>Time left <b>~${fmtMins(remainingMins(a))}</b>${R.measured ? ` <span class="tiny dim">(×${round(R.r, 2)} from your history)</span>` : ''}</span>${dr ? `<span>Deadline <b class="${dr.level === 'ok' ? 'good' : dr.level === 'tight' ? 'warn' : 'bad'}">${{ overdue: 'Overdue', high: 'Won’t fit', tight: 'Tight', ok: 'On track' }[dr.level]}</b>${dr.cap != null && dr.level !== 'overdue' ? ` <span class="tiny dim">(${fmtMins(dr.cap)} of work time before it’s due)</span>` : ''}</span>` : ''}</div></div>`; })()}
      <div><div class="between" style="margin-bottom:6px"><span class="tiny muted">Steps ${(a.steps || []).length ? `· ${(a.steps || []).filter((s) => s.done).length}/${a.steps.length} done` : ''}</span>${(a.steps || []).length ? '' : `<button class="btn ghost sm" id="st-tpl">${icon('sparkles', 13)} Suggest steps</button>`}</div>${(a.steps || []).length ? `<div class="bar" style="margin-bottom:8px"><i style="width:${(a.steps.filter((s) => s.done).length / a.steps.length) * 100}%"></i></div>` : ''}<div class="stack" style="gap:4px" id="st-list">${(a.steps || []).map((s) => `<div class="row" data-sid="${s.id}"><button type="button" class="check${s.done ? ' on' : ''}" data-stog aria-label="Toggle step">${s.done ? icon('check', 14) : ''}</button><span class="grow small" style="${s.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(s.title)}</span><span class="tiny muted num">${s.mins ? fmtMins(s.mins) : ''}</span><button type="button" class="icon-btn" style="width:26px;height:26px" data-srm aria-label="Remove step">${icon('x', 12)}</button></div>`).join('')}</div><form class="row" id="st-add" style="gap:6px;margin-top:6px"><input type="text" id="st-t" placeholder="Add a step" aria-label="New step"><input type="number" id="st-m" placeholder="min" min="0" max="600" style="width:76px" aria-label="Minutes"><button class="btn sm" type="submit">${icon('plus', 13)}</button></form></div>
      <div><div class="tiny muted" style="margin-bottom:6px">Status</div><div class="chips" id="ad-st">${['not_started', 'in_progress', 'completed', 'submitted'].map((k) => `<button class="chip${a.status === k ? ' on' : ''}" data-s="${k}">${STATUS[k][0]}</button>`).join('')}</div></div>`,
    foot: `<button class="btn ghost danger" data-del>${icon('trash-2', 15)} Delete</button><span class="grow"></span><button class="btn" data-time>${icon('timer', 15)} Study timer</button><button class="btn primary" data-edit>${icon('pencil', 15)} Edit</button>`,
    onMount: (r, close) => {
      $('#ad-st', r).onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; a.status = b.dataset.s; if (isDone(a)) { a.completedAt ||= Date.now(); if (a.status === 'submitted') a.submittedAt ||= Date.now(); } else a.completedAt = null; save('assignments'); refreshOverdue(); close(); openAssignment(id); };
      $('[data-edit]', r).onclick = () => { close(); editAssignment(a); };
      const reopen = () => { save('assignments'); close(); openAssignment(id); };
      $('#st-tpl', r)?.addEventListener('click', () => { const tpl = STEP_TPL[a.type] || STEP_TPL[MAJOR.has(a.type) ? 'project' : 'other'], tot = baseMins(a); a.steps = tpl.map(([t, p]) => ({ id: uid('s'), title: t, mins: Math.max(5, Math.round((tot * p) / 100 / 5) * 5), done: false })); toast('Template steps added. Edit them to fit the assignment.'); reopen(); });
      $('#st-add', r).onsubmit = (e) => { e.preventDefault(); const t = $('#st-t', r).value.trim(); if (!t) return; (a.steps ||= []).push({ id: uid('s'), title: t, mins: Number($('#st-m', r).value) || null, done: false }); reopen(); };
      $('#st-list', r).addEventListener('click', (e) => { const row = e.target.closest('[data-sid]'); if (!row) return; const s = a.steps.find((x) => x.id === row.dataset.sid); if (e.target.closest('[data-stog]')) { s.done = !s.done; if (s.done && a.status === 'not_started') a.status = 'in_progress'; reopen(); } if (e.target.closest('[data-srm]')) { a.steps = a.steps.filter((x) => x !== s); reopen(); } });
      $('[data-time]', r).onclick = () => { close(); startTimerFor(a.classId, a.title, a.id); };
      $('[data-del]', r).onclick = async () => { if (await confirmBox(`Delete "${a.title}"?`)) { const copy = { ...a }; remove('assignments', a.id); close(); toast('Assignment deleted', { label: 'Undo', fn: () => upsert('assignments', copy) }); } };
    } });
}
function attachmentLink(x) {
  const d = x.docId ? byId('docs', x.docId) : null;
  if (d) return `<a class="li click" style="text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:10px" href="${d.data || '#'}" download="${esc(d.name)}">${icon('file-text', 16)}<span class="grow">${esc(d.name)}</span><span class="tiny muted">${Math.round((d.size || 0) / 1024)} KB</span></a>`;
  return `<a class="li click" style="text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:10px" href="${esc(/^https?:/.test(x.url) ? x.url : '#')}" target="_blank" rel="noopener">${icon('link', 16)}<span class="grow">${esc(x.name || x.url)}</span>${icon('arrow-right', 14, 'dim')}</a>`;
}

// ---------- editor ----------
function editAssignment(rec = null, preset = {}) {
  const isNew = !rec;
  const a = rec ? JSON.parse(JSON.stringify(rec)) : { id: uid('a'), classId: preset.classId || af.cls || S.classes[0]?.id || '', title: '', description: '', type: 'homework', categoryId: '', due: preset.due || addDays(today(), 1), dueTime: '', priority: 2, estMins: null, actualMins: null, status: 'not_started', score: null, max: null, attachments: [], createdAt: Date.now(), ...preset };
  const catOpts = (cid, sel) => { const c = cls(cid); return `<option value="">${c?.categories?.length ? 'Pick a category' : 'No categories'}</option>` + (c?.categories || []).map((k) => `<option value="${k.id}"${k.id === sel ? ' selected' : ''}>${esc(k.name)} (${k.weight}%)</option>`).join(''); };
  const guessCat = (cid, type) => { const c = cls(cid); if (!c?.categories) return ''; const words = { test: /test|exam|assess/i, quiz: /quiz/i, homework: /home|hw|practice|class ?work/i, project: /project/i, essay: /essay|writ|paper/i, lab: /lab/i, reading: /read/i }[type]; return c.categories.find((k) => words?.test(k.name))?.id || ''; };
  const atts = [...(a.attachments || [])];
  modal({ title: isNew ? 'New assignment' : 'Edit assignment', icon: 'list-checks', wide: true,
    body: `<div class="fgrid">
      <label class="f full">Title<input type="text" name="title" value="${esc(a.title)}" placeholder="e.g. Chapter 6 problem set" autofocus maxlength="140"></label>
      <label class="f">Class<select name="classId">${classOptions(a.classId)}</select></label>
      <label class="f">Type<select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${a.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f">Due date<input type="date" name="due" value="${a.due || ''}"></label>
      <label class="f">Due time (optional)<input type="time" name="dueTime" value="${a.dueTime || ''}"></label>
      <label class="f">Difficulty<select name="difficulty"><option value="">Estimate it for me</option>${[[1, 'Easy'], [2, 'Medium'], [3, 'Hard']].map(([v, l]) => `<option value="${v}"${+a.difficulty === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Priority<select name="priority">${[[1, 'Low'], [2, 'Medium'], [3, 'High']].map(([v, l]) => `<option value="${v}"${(a.priority || 2) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f">Status<select name="status">${['not_started', 'in_progress', 'completed', 'submitted'].map((k) => `<option value="${k}"${(a.status === 'overdue' ? 'not_started' : a.status) === k ? ' selected' : ''}>${STATUS[k][0]}</option>`).join('')}</select></label>
      <label class="f">Estimated minutes<input type="number" name="estMins" min="0" max="1440" step="5" value="${a.estMins ?? ''}" placeholder="default ${DEF_MINS[a.type]}"></label>
      <label class="f">Actual minutes<input type="number" name="actualMins" min="0" max="10000" step="5" value="${a.actualMins ?? ''}"></label>
      <label class="f">Grade category<select name="categoryId">${catOpts(a.classId, a.categoryId || (isNew ? guessCat(a.classId, a.type) : ''))}</select></label>
      <div class="f" style="display:grid;gap:5px;font-size:12.5px;font-weight:600;color:var(--muted)">Score<div class="row"><input type="number" name="score" step="any" min="0" value="${a.score ?? ''}" placeholder="earned" aria-label="Points earned"><span>/</span><input type="number" name="max" step="any" min="0" value="${a.max ?? ''}" placeholder="possible" aria-label="Points possible"></div></div>
      <label class="f full">Description / instructions<textarea name="description" rows="4" placeholder="Paste the instructions, rubric notes or anything you need">${esc(a.description || '')}</textarea></label>
      <div class="full"><div class="between"><span class="small" style="font-weight:600;color:var(--muted)">Repeats</span><label class="row small"><input type="checkbox" name="recurOn" ${a.recur ? 'checked' : ''}${a.recurOf ? ' disabled' : ''}> Weekly</label></div>
        <div id="ae-recur" ${a.recur ? '' : 'hidden'} style="margin-top:8px"><div class="chips" id="ae-days">${DAYS.map((d, i) => `<button type="button" class="chip${(a.recur?.days || [dow(a.due || today())]).includes(i) ? ' on' : ''}" data-d="${i}">${d}</button>`).join('')}</div>
        <label class="f" style="margin-top:8px;max-width:240px">Until<input type="date" name="until" value="${a.recur?.until || ''}"></label><p class="tiny dim" style="margin:6px 0 0">Copies are created up to 3 weeks ahead so each one can be finished on its own.</p></div>
        ${a.recurOf ? '<p class="tiny dim" style="margin:6px 0 0">This is one copy of a repeating assignment. Edit the first one to change the pattern.</p>' : ''}</div>
      <div class="full"><div class="between" style="margin-bottom:6px"><span class="small" style="font-weight:600;color:var(--muted)">Attachments</span><span class="row"><button type="button" class="btn sm" id="ae-link">${icon('link', 14)} Link</button><button type="button" class="btn sm" id="ae-file">${icon('upload', 14)} File</button></span></div><div id="ae-atts" class="stack" style="gap:6px"></div></div>
    </div><div id="ae-warn"></div>`,
    foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${icon('trash-2', 15)} Delete</button>`}<span class="grow"></span><button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-save>${icon('check', 15)} ${isNew ? 'Add assignment' : 'Save'}</button>`,
    onMount: (r, close) => {
      const drawAtts = () => { $('#ae-atts', r).innerHTML = atts.length ? atts.map((x, i) => `<div class="row" style="border:1px solid var(--line);border-radius:10px;padding:6px 10px">${icon(x.docId ? 'file-text' : 'link', 15)}<span class="grow small">${esc(x.name || x.url)}</span><button type="button" class="icon-btn" style="width:30px;height:30px" data-rm="${i}" aria-label="Remove">${icon('x', 14)}</button></div>`).join('') : '<span class="tiny dim">None</span>'; };
      drawAtts();
      $('#ae-atts', r).onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { atts.splice(+b.dataset.rm, 1); drawAtts(); } };
      $('#ae-link', r).onclick = () => { const url = prompt('Paste a link (https://…)'); if (!url) return; if (!/^https?:\/\//i.test(url.trim())) return toast('Links must start with http:// or https://'); atts.push({ url: url.trim(), name: url.trim().replace(/^https?:\/\//, '').slice(0, 60) }); drawAtts(); };
      $('#ae-file', r).onclick = async () => { const f = await pickFile(); if (!f) return; if (f.size > 4e6) return toast('Files over 4 MB are too big to keep on this device. Add a link instead.'); const d = { id: uid('d'), name: f.name, size: f.size, type: f.type, data: await readAsDataURL(f), classId: $('[name=classId]', r).value, at: Date.now() }; upsertQuiet('docs', d); atts.push({ docId: d.id, name: f.name }); drawAtts(); };
      $('[name=classId]', r).onchange = (e) => { $('[name=categoryId]', r).innerHTML = catOpts(e.target.value, guessCat(e.target.value, $('[name=type]', r).value)); };
      $('[name=type]', r).onchange = (e) => { $('[name=estMins]', r).placeholder = 'default ' + DEF_MINS[e.target.value]; const g = guessCat($('[name=classId]', r).value, e.target.value); if (!catPicked) $('[name=categoryId]', r).value = g; };
      let catPicked = !isNew && !!a.categoryId; $('[name=categoryId]', r).addEventListener('change', () => (catPicked = true));
      $('[name=recurOn]', r).onchange = (e) => ($('#ae-recur', r).hidden = !e.target.checked);
      $('#ae-days', r).onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) b.classList.toggle('on'); };
      $('[data-x2]', r).onclick = close;
      $('[data-del]', r)?.addEventListener('click', async () => { if (await confirmBox(`Delete "${a.title}"?`)) { remove('assignments', a.id); close(); toast('Assignment deleted', { label: 'Undo', fn: () => upsert('assignments', rec) }); } });
      $('[data-save]', r).onclick = () => {
        const f = formData(r), warn = $('#ae-warn', r);
        if (!f.title) { warn.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>Give the assignment a title.</div>`; return; }
        if ((f.score != null) !== (f.max != null)) { warn.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>Enter both points earned and points possible, or leave both empty.</div>`; return; }
        if (f.max != null && f.max <= 0) { warn.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>Points possible must be more than 0.</div>`; return; }
        if (f.score != null && f.score < 0) { warn.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>Score can't be negative.</div>`; return; }
        const out = { ...a, title: f.title, classId: f.classId, type: f.type, due: f.due || '', dueTime: f.dueTime, priority: Number(f.priority), difficulty: f.difficulty ? Number(f.difficulty) : null, status: f.status, estMins: f.estMins, actualMins: f.actualMins, categoryId: f.categoryId, score: f.score, max: f.max, description: f.description, attachments: atts };
        if (out.score != null && !rec?.score) out.gradedOn = today();
        if (isDone(out)) out.completedAt ||= Date.now(); else out.completedAt = null;
        if (out.status === 'submitted') out.submittedAt ||= Date.now();
        if (f.recurOn && !a.recurOf) { const days = $$('#ae-days .chip.on', r).map((b) => +b.dataset.d); if (!out.due) { warn.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>A repeating assignment needs a first due date.</div>`; return; } out.recur = { days: days.length ? days : [dow(out.due)], until: f.until || '' }; } else if (!a.recurOf) delete out.recur;
        if (isDuplicate(out) && !warn.dataset.confirmed) { warn.dataset.confirmed = '1'; warn.innerHTML = `<div class="alert warn"><span class="ai">${icon('copy', 15)}</span>An assignment with this title, class and due date already exists. Press save again to keep both.</div>`; return; }
        upsert('assignments', out); expandRecurring(); refreshOverdue(); close(); toast(isNew ? 'Assignment added' : 'Saved');
      };
    } });
}
function upsertQuiet(col, rec) { const i = S[col].findIndex((x) => x.id === rec.id); if (i >= 0) S[col][i] = rec; else S[col].push(rec); save(col); }

// ---------- paste instructions -> assignments (rule-based, every item reviewed) ----------
function pasteExtract(classId = '') {
  modal({ title: 'Pull assignments out of text', icon: 'scan-text', wide: true,
    body: `<p class="small muted" style="margin:0">Paste a teacher's post, an assignment sheet, a weekly schedule or a calendar page. Student Lens looks for lines with dates and turns each one into an assignment for you to check. This uses pattern matching, not AI, so review every row.</p>
      <label class="f" style="max-width:320px">Class for these<select id="px-cls">${classOptions(classId, 'Choose later')}</select></label>${sourceBox('px')}`,
    foot: `<button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-go>${icon('arrow-right', 15)} Find assignments</button>`,
    onMount: (r, close) => {
      const get = wireSource(r, 'px');
      $('[data-x2]', r).onclick = close;
      $('[data-go]', r).onclick = () => { const items = extractItems(get()); if (!items.length) return toast('No dated items found. Lines need a date like 11/21, Nov 21 or Friday.'); const cid = $('#px-cls', r).value; close(); reviewItems(items.map((x) => ({ ...x, classId: cid })), 'pasted text'); };
    } });
}
/** Review screen shared by paste, syllabus and CSV import. Nothing is saved until you press Add. */
function reviewItems(items, source, after) {
  const old = addDays(today(), -7), rows = items.map((x) => ({ keep: !x.due || x.due >= old, ...x, type: x.type || 'homework', classId: x.classId || '' }));
  modal({ title: `Review ${rows.length} item${rows.length === 1 ? '' : 's'}`, icon: 'list-checks', wide: true,
    body: `<p class="small muted" style="margin:0">Found in ${esc(source)}. Fix anything that is wrong and untick what you don't want. Dates marked <span class="badge warn">check date</span> came from words like "Friday" or "tomorrow" and need your confirmation. Rows marked <span class="badge warn">duplicate</span> already exist. Items more than a week in the past start unticked.</p>
      <div class="row" style="gap:8px"><span class="small muted">Set class for all</span><select id="rv-all" style="width:auto">${classOptions('', 'Keep as is')}</select></div><div id="rv" class="stack" style="gap:8px"></div>`,
    foot: `<button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-add>${icon('check', 15)} Add selected</button>`,
    onMount: (r, close) => {
      const draw = () => { $('#rv', r).innerHTML = rows.map((x, i) => { const dup = isDuplicate({ id: '_', classId: x.classId, title: x.title, due: x.due }); return `<div class="review-row${dup ? ' dup' : ''}" data-i="${i}"><input type="checkbox" data-k="keep" ${x.keep ? 'checked' : ''} aria-label="Keep"><div class="stack" style="gap:6px">
        <div class="row" style="gap:6px"><input type="text" data-k="title" value="${esc(x.title)}" aria-label="Title">${dup ? '<span class="badge warn">duplicate</span>' : ''}${!x.sure ? '<span class="badge warn">check date</span>' : ''}${x.due && x.due < old ? '<span class="badge">already past</span>' : ''}</div>
        <div class="row wrap" style="gap:6px"><input type="date" data-k="due" value="${x.due || ''}" style="width:auto" aria-label="Due date"><select data-k="type" style="width:auto" aria-label="Type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${x.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select><select data-k="classId" style="width:auto" aria-label="Class">${classOptions(x.classId)}</select></div>
        ${x.raw && x.raw !== x.title ? `<span class="tiny dim">From: "${esc(x.raw.slice(0, 140))}"</span>` : ''}</div></div>`; }).join(''); };
      draw();
      $('#rv', r).addEventListener('change', (e) => { const row = e.target.closest('[data-i]'), k = e.target.dataset.k; if (!row || !k) return; const x = rows[+row.dataset.i]; x[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; if (k === 'due') x.sure = true; if (k !== 'keep' && k !== 'title') draw(); });
      $('#rv', r).addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (row && e.target.dataset.k === 'title') rows[+row.dataset.i].title = e.target.value; });
      $('#rv-all', r).onchange = (e) => { if (!e.target.value) return; rows.forEach((x) => (x.classId = e.target.value)); draw(); };
      $('[data-x2]', r).onclick = close;
      $('[data-add]', r).onclick = () => {
        const keep = rows.filter((x) => x.keep && x.title.trim()); let n = 0, skipped = 0;
        for (const x of keep) { const rec = { id: uid('a'), classId: x.classId, title: x.title.trim(), description: x.raw && x.raw !== x.title ? x.raw : '', type: x.type, categoryId: '', due: x.due, dueTime: x.dueTime || '', priority: 2, estMins: x.estMins || null, actualMins: null, status: 'not_started', score: null, max: null, attachments: [], createdAt: Date.now(), source };
          const c = cls(rec.classId); if (c?.categories) { const re = { test: /test|exam|assess/i, quiz: /quiz/i, homework: /home|hw|practice/i, project: /project/i, essay: /essay|writ/i, lab: /lab/i }[rec.type]; rec.categoryId = c.categories.find((k) => re?.test(k.name))?.id || ''; }
          if (isDuplicate(rec)) { skipped++; continue; } S.assignments.push(rec); n++; }
        save('assignments'); refreshOverdue(); close(); toast(`Added ${n} assignment${n === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}`); after?.(n);
      };
    } });
}

// ---------- CSV ----------
const A_COLS = ['title', 'class', 'type', 'due', 'dueTime', 'status', 'priority', 'estMins', 'actualMins', 'score', 'max', 'category', 'description'];
function exportAssignmentsCSV() {
  const rows = [A_COLS, ...S.assignments.map((a) => [a.title, clsName(a.classId), a.type, a.due, a.dueTime, effStatus(a), a.priority, a.estMins, a.actualMins, a.score, a.max, cls(a.classId)?.categories?.find((k) => k.id === a.categoryId)?.name || '', a.description])];
  download(`assignments-${today()}.csv`, csvStringify(rows), 'text/csv'); toast(`Exported ${S.assignments.length} assignments`);
}
async function importAssignmentsCSV() {
  const f = await pickFile('.csv,text/csv'); if (!f) return;
  const rows = csvParse(await readAsText(f)); if (rows.length < 2) return toast('That CSV has no rows.');
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const ix = { title: col('title', 'name', 'assignment', 'task'), cls: col('class', 'course', 'subject'), type: col('type', 'kind'), due: col('due', 'duedate', 'date', 'deadline'), score: col('score', 'earned', 'points'), max: col('max', 'possible', 'outof', 'total'), est: col('estmins', 'minutes', 'estimate'), desc: col('description', 'notes', 'details') };
  if (ix.title < 0) return toast('The CSV needs a "title" column.');
  const items = []; let bad = 0;
  for (const r of rows.slice(1)) {
    const title = (r[ix.title] || '').trim(); if (!title) continue;
    const rawDue = ix.due >= 0 ? (r[ix.due] || '').trim() : ''; const d = rawDue ? findDate(rawDue) : null; if (rawDue && !d) bad++;
    const cname = ix.cls >= 0 ? (r[ix.cls] || '').trim().toLowerCase() : '', c = S.classes.find((x) => x.name.toLowerCase() === cname);
    const ty = ix.type >= 0 ? (r[ix.type] || '').trim().toLowerCase() : '';
    items.push({ title, due: d?.date || '', sure: !rawDue || !!d?.sure, classId: c?.id || '', type: TYPES[ty] ? ty : guessType(title + ' ' + ty), raw: '', estMins: ix.est >= 0 ? Number(r[ix.est]) || null : null });
  }
  if (bad) toast(`${bad} row${bad === 1 ? '' : 's'} had a date that couldn't be read; set ${bad === 1 ? 'it' : 'them'} in the review.`);
  reviewItems(items, f.name);
}
function assignmentIO() {
  modal({ title: 'Import & export', icon: 'arrow-up-down', body: `<div class="stack">
    <button class="li click" style="border:1px solid var(--line);background:none;text-align:left" data-k="paste">${icon('scan-text', 18)}<span class="grow"><b>Paste instructions or a schedule</b><br><span class="small muted">Finds dated items in text, PDF or a photo</span></span></button>
    <button class="li click" style="border:1px solid var(--line);background:none;text-align:left" data-k="syl">${icon('file-up', 18)}<span class="grow"><b>Scan a syllabus</b><br><span class="small muted">Class, teacher, grade weights and due dates</span></span></button>
    <button class="li click" style="border:1px solid var(--line);background:none;text-align:left" data-k="csvin">${icon('upload', 18)}<span class="grow"><b>Import CSV</b><br><span class="small muted">Columns: title, class, type, due, score, max…</span></span></button>
    <button class="li click" style="border:1px solid var(--line);background:none;text-align:left" data-k="csvout">${icon('download', 18)}<span class="grow"><b>Export CSV</b><br><span class="small muted">All ${S.assignments.length} assignments</span></span></button></div>`,
    onMount: (r, close) => r.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; close(); ({ paste: () => pasteExtract(), syl: () => syllabusImport(), csvin: importAssignmentsCSV, csvout: exportAssignmentsCSV })[b.dataset.k](); }) });
}
