'use strict';
// ===================== Home dashboard =====================
/** Daily briefing: fixed rules over your own records. Every line says what it's based on. */
function briefing() {
  const t = today(), out = [], r = ranked();
  const od = r.filter((x) => effStatus(x.a) === 'overdue');
  if (od.length) out.push({ ic: 'triangle-alert', lvl: 'bad', text: `Start with <b>${esc(od[0].a.title)}</b>. It's ${-daysBetween(t, od[0].a.due)} day${daysBetween(t, od[0].a.due) === -1 ? '' : 's'} overdue${od.length > 1 ? `, and ${od.length - 1} more ${od.length === 2 ? 'is' : 'are'} overdue` : ''}.`, why: 'Overdue assignments', go: () => openAssignment(od[0].a.id) });
  const top = r.find((x) => effStatus(x.a) !== 'overdue');
  if (top) out.push({ ic: 'target', lvl: 'info', text: `Highest priority: <b>${esc(top.a.title)}</b> (${esc(clsName(top.a.classId))}), ${esc(top.why.slice(0, 2).join(', '))}.`, why: `Priority score ${top.score}`, go: () => openAssignment(top.a.id) });
  const plans = S.exams.flatMap((e) => (e.plan || []).filter((p) => p.date === t && !p.done).map((p) => ({ p, e })));
  if (plans.length) out.push({ ic: 'graduation-cap', lvl: 'warn', text: `${plans.length} exam prep session${plans.length === 1 ? '' : 's'} planned today (${fmtMins(sum(plans.map((x) => x.p.mins)))}): ${[...new Set(plans.map((x) => x.p.label))].map(esc).slice(0, 3).join(', ')}.`, why: 'Your exam study plans', go: () => go('exams', plans[0].e.id) });
  const missed = S.exams.filter((e) => e.date >= t && (e.plan || []).some((p) => p.date < t && !p.done));
  if (missed.length) out.push({ ic: 'calendar-clock', lvl: 'warn', text: `You're behind on the plan for <b>${esc(missed[0].title)}</b>. Open it to move missed sessions forward (nothing moves without you).`, why: 'Unfinished past sessions', go: () => go('exams', missed[0].id) });
  const due = cardsDue().length;
  if (due) out.push({ ic: 'layers', lvl: 'info', text: `${due} flashcard${due === 1 ? ' is' : 's are'} due. That's about ${Math.max(1, Math.round(due * 0.3))} minutes of review.`, why: 'Spaced-repetition schedule', go: () => go('study', 'cards') });
  const done = studyMinsOn(t), goal = S.settings.dailyStudyMins;
  if (goal) out.push({ ic: 'timer', lvl: done >= goal ? 'good' : 'info', text: done >= goal ? `Study goal hit: ${fmtMins(done)} today.` : `${fmtMins(goal - done)} left to reach today's ${fmtMins(goal)} study goal.`, why: 'Logged study sessions', go: () => go('study', 'timer') });
  const under = S.classes.map((c) => ({ c, g: classGrade(c.id) })).filter((x) => x.g.pct != null && x.c.goal && x.g.pct < x.c.goal).sort((a, b) => (a.g.pct - a.c.goal) - (b.g.pct - b.c.goal))[0];
  if (under) out.push({ ic: 'trending-down', lvl: 'warn', text: `${esc(under.c.name)} is ${round(under.c.goal - under.g.pct, 1)} points under your ${under.c.goal}% goal. The goal calculator shows what you need next.`, why: 'Current grade vs. goal', go: () => go('grades', 'goal', under.c.id) });
  const tom = openAssignments().filter((a) => a.due === addDays(t, 1));
  if (tom.length && !out.some((x) => x.text.includes(tom[0].title))) out.push({ ic: 'alarm-clock', lvl: 'info', text: `Due tomorrow: ${tom.map((a) => esc(a.title)).slice(0, 3).join(', ')}${tom.length > 3 ? ` +${tom.length - 3}` : ''} (~${fmtMins(workloadOn(addDays(t, 1)))}).`, why: 'Due dates', go: () => go('assignments') });
  return out;
}
VIEWS.home = () => {
  const t = today(), h = new Date().getHours(), name = (S.profile.name || '').split(' ')[0];
  const greet = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if (!S.classes.length && !S.assignments.length) return welcome(greet, name);
  const r = ranked(), od = S.assignments.filter((a) => effStatus(a) === 'overdue');
  const wkStart = weekStart(t), wkEnd = addDays(wkStart, 6), wk = S.assignments.filter((a) => a.due >= wkStart && a.due <= wkEnd), wkDone = wk.filter(isDone).length;
  const g = gpaFor(), exams = S.exams.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)), next = exams[0];
  const days = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i)), mins = days.map(studyMinsOn), goal = S.settings.dailyStudyMins;
  const upcoming = openAssignments().filter((a) => a.due && a.due >= t && a.due <= addDays(t, 7)).sort((a, b) => a.due.localeCompare(b.due) || (a.dueTime || '99').localeCompare(b.dueTime || '99'));
  const todayItems = itemsOn(t).filter((i) => i.s != null && i.k !== 'study').sort((a, b) => a.s - b.s);
  const al = alerts(), br = briefing();
  const gHist = [...new Set(S.classes.flatMap((c) => gradedItems(c.id).map((x) => x.date)))].sort().slice(-10).map((d) => gpaFor(undefined, d)?.unweighted ?? null);
  return {
    title: `${greet}${name ? ', ' + name : ''}`, sub: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    actions: `<button class="btn primary sm" id="h-add">${icon('plus', 15)} Quick add</button>`,
    html: `<div class="hero"><div class="grid g-12" style="position:relative;z-index:1;align-items:center">
        <div class="s-7"><div class="eyebrow">Today at a glance</div>
          <h2 style="font-size:24px;margin:8px 0 6px;color:#fff;line-height:1.3">${od.length ? `${od.length} overdue, ` : ''}${openAssignments().filter((a) => a.due === t).length} due today, ${todayItems.filter((i) => i.k === 'class').length} class${todayItems.filter((i) => i.k === 'class').length === 1 ? '' : 'es'} on your schedule.</h2>
          <p style="margin:0;color:#c7cdf5" class="small">${wk.length ? `${wkDone} of ${wk.length} assignments done this week · ` : ''}${fmtMins(sum(mins))} studied this week${goal ? ` of ${fmtMins(goal * 7)} goal` : ''}</p>
          <div class="row wrap" style="margin-top:14px;gap:8px"><a class="btn sm" href="#planner/day/${t}" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.14);color:#fff">${icon('calendar-days', 15)} Today's plan</a><a class="btn sm" href="#study/timer" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.14);color:#fff">${icon('timer', 15)} Focus timer</a>${cardsDue().length ? `<a class="btn sm" href="#study/cards" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.14);color:#fff">${icon('layers', 15)} ${cardsDue().length} cards due</a>` : ''}</div></div>
        <div class="s-5">${next ? (() => { const c = countdown(next), rd = readiness(next); return `<a href="#exams/${next.id}" style="display:block;text-decoration:none;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px"><div class="between"><span class="eyebrow">Next exam</span>${rd != null ? `<span class="badge" style="background:rgba(255,255,255,.12);color:#fff">${rd}% ready</span>` : ''}</div><b style="display:block;font:650 17px var(--f-display);margin:6px 0 2px">${esc(next.title)}</b><span class="small" style="color:#c7cdf5">${esc(clsName(next.classId))} · ${fmtDay(next.date)}</span><div class="count" style="margin-top:10px"><div><b>${c.d}</b><small>days</small></div><div><b>${c.h}</b><small>hrs</small></div><div><b>${c.m}</b><small>min</small></div><div><b>${exams.length}</b><small>upcoming</small></div></div></a>`; })() : `<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px;color:#c7cdf5" class="small">No exams scheduled. <a href="#exams" style="color:#fff">Add one</a> to get a countdown and a study plan.</div>`}</div></div></div>
      <div class="kpis">
        ${kpi('award', 'GPA', g ? g.unweighted.toFixed(2) : '—', g ? `${g.weighted.toFixed(2)} weighted` : 'enter grades to see it', null, spark(gHist))}
        ${kpi('list-todo', 'Due this week', wk.length - wkDone, `${wkDone} done · ${od.length} overdue`, od.length ? 'var(--bad)' : null)}
        ${kpi('clock', 'Studied this week', fmtMins(sum(mins)), `${studyStreak()}-day streak`, 'var(--good)', spark(mins, 'var(--good)'))}
        ${kpi('circle-check', 'Completion', wk.length ? Math.round((wkDone / wk.length) * 100) + '%' : '—', 'of this week’s work', 'var(--warn)')}
      </div>
      ${intelStrip()}
      <div class="grid g-12">
        <div class="card s-7"><div class="card-h"><span class="ki" style="color:var(--accent)">${icon('sparkles', 18)}</span><h2>Daily briefing</h2><span class="end tiny muted">rules over your records</span></div>
          ${br.length ? `<div class="stack" style="gap:8px">${br.map((b, i) => `<div class="alert ${b.lvl}" style="cursor:pointer" data-br="${i}"><span class="ai">${icon(b.ic, 15)}</span><span class="grow"><span>${b.text}</span><div class="tiny dim" style="margin-top:2px">Based on: ${esc(b.why)}</div></span>${icon('chevron-right', 15, 'dim')}</div>`).join('')}</div>` : '<p class="muted small">Nothing to flag. Add assignments and exams and the briefing will fill in.</p>'}</div>
        <div class="card s-5"><div class="card-h"><h2>Top priorities</h2><a class="end btn ghost sm" href="#assignments">All ${icon('arrow-right', 14)}</a></div>
          ${r.length ? `<div class="list">${r.slice(0, 5).map(({ a, score, why }) => assignmentRow(a, { pri: { score, why } })).join('')}</div>` : emptyState('circle-check', 'All clear', 'No open assignments.')}</div>
        <div class="card s-4"><div class="card-h"><h2>Deadlines</h2><span class="end tiny muted">next 7 days</span></div>
          ${od.length ? `<div class="alert bad" style="margin-bottom:10px;cursor:pointer" onclick="go('assignments','overdue')"><span class="ai">${icon('triangle-alert', 15)}</span><span><b>${od.length} overdue</b><br><span class="small muted">${od.slice(0, 2).map((a) => esc(a.title)).join(', ')}</span></span></div>` : ''}
          ${upcoming.length ? `<div class="stack" style="gap:2px">${upcoming.slice(0, 7).map((a) => `<div class="li click" data-aid="${a.id}" style="padding:8px"><div style="width:42px;text-align:center;flex:none"><div class="tiny muted" style="text-transform:uppercase;font-weight:700">${DAYS[dow(a.due)]}</div><b style="font:700 17px var(--f-display)">${+a.due.slice(8)}</b></div><span class="cbar" style="--c:${clsColor(a.classId)}"></span><span class="grow"><span class="t">${esc(a.title)}</span><div class="s">${esc(clsName(a.classId))}${a.dueTime ? ' · ' + fmtTime(a.dueTime) : ''}</div></span></div>`).join('')}</div>` : '<p class="small muted">Nothing due in the next 7 days.</p>'}</div>
        <div class="card s-4"><div class="card-h"><h2>Grades</h2><a class="end btn ghost sm" href="#grades">Details ${icon('arrow-right', 14)}</a></div>
          ${S.classes.length ? `<div class="stack" style="gap:12px">${activeClasses().map((c) => { const gg = classGrade(c.id); return `<a href="#classes/${c.id}" style="text-decoration:none;color:inherit"><div class="between small" style="margin-bottom:5px"><span class="row" style="gap:8px;min-width:0"><i class="dot-c" style="--c:${c.color}"></i><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</b></span><b class="num" style="color:${gradeColor(gg.pct)}">${gg.pct == null ? '—' : round(gg.pct, 1) + '%'} ${gg.letter ? `<span class="badge">${gg.letter}</span>` : ''}</b></div><div class="bar"><i style="width:${clamp(gg.pct ?? 0, 0, 100)}%;--c:${c.color}"></i></div></a>`; }).join('')}</div>` : ''}</div>
        <div class="card s-4"><div class="card-h"><h2>Today</h2><a class="end btn ghost sm" href="#planner/day/${t}">Planner ${icon('arrow-right', 14)}</a></div>
          ${todayItems.length ? `<div class="stack" style="gap:2px">${todayItems.slice(0, 7).map((i) => `<div class="li" style="padding:7px 4px"><span class="tiny muted num" style="width:58px">${fmtTime(fromMin(i.s))}</span><span class="cbar" style="--c:${i.color}"></span><span class="grow"><span class="t">${esc(i.title)}</span><div class="s">${esc(i.sub)}</div></span></div>`).join('')}</div>` : '<p class="small muted">Nothing scheduled. Add class meeting times or events in the planner.</p>'}</div>
        <div class="card s-8"><div class="card-h"><h2>Study this week</h2><span class="end tiny muted">${goal ? `goal ${fmtMins(goal)} / day` : ''}</span></div>${barChart(days.map((d, i) => ({ label: fmtDay(d), short: DAYS[dow(d)], value: mins[i], color: d === t ? 'var(--accent-2)' : mins[i] >= goal ? 'var(--good)' : 'var(--accent)', dim: d > t })), { goal, fmt: fmtMins, empty: 'Log study time with the timer to see your week.' })}</div>
        <div class="card s-4"><div class="card-h"><h2>Alerts</h2><span class="end badge ${al.length ? 'bad' : 'good'}">${al.length}</span></div>${al.length ? `<div class="stack" style="gap:8px">${al.slice(0, 5).map((x, i) => `<div class="alert ${x.lvl}" style="cursor:pointer" data-al="${i}"><span class="ai">${icon(x.ic, 15)}</span><span class="grow"><b class="small">${esc(x.t)}</b><div class="tiny muted">${esc(x.s)}</div></span></div>`).join('')}</div>` : emptyState('bell', 'No alerts', 'You’re on top of things.')}</div>
      </div>`,
    mount(root) {
      root.addEventListener('click', (e) => { const b = e.target.closest('[data-br]'); if (b) br[+b.dataset.br].go(); const a = e.target.closest('[data-al]'); if (a) al[+a.dataset.al].go(); });
      $('#h-add').onclick = quickAdd;
    },
  };
};
function quickAdd() {
  modal({ title: 'Quick add', icon: 'plus', body: `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${[['a', 'list-checks', 'Assignment'], ['e', 'graduation-cap', 'Exam'], ['v', 'calendar-plus', 'Event'], ['c', 'library', 'Class'], ['n', 'notebook-pen', 'Note'], ['p', 'scan-text', 'Paste instructions'], ['s', 'file-up', 'Scan syllabus'], ['t', 'timer', 'Study timer']].map(([k, ic, l]) => `<button class="card flat" data-q="${k}" style="display:flex;gap:10px;align-items:center;padding:14px;text-align:left;color:inherit">${icon(ic, 19)}<b>${l}</b></button>`).join('')}</div>`,
    onMount: (r, close) => r.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; close(); ({ a: () => editAssignment(), e: () => editExam(), v: () => editEvent(null, { date: today() }), c: () => editClass(), n: () => editNote(null, {}), p: () => pasteExtract(), s: () => syllabusImport(), t: () => go('study', 'timer') })[b.dataset.q](); }) });
}
function welcome(greet, name) {
  return { title: `${greet}${name ? ', ' + name : ''}`, sub: 'Welcome to Student Lens',
    html: `<div class="hero"><div style="position:relative;z-index:1;max-width:640px"><div class="eyebrow">Your academic command center</div><h2 style="font-size:28px;margin:10px 0;color:#fff;line-height:1.25">Classes, grades, deadlines, study tools and exam prep in one place.</h2><p style="color:#c7cdf5;margin:0 0 18px">Everything stays on this device. No account, no AI services, no data sent anywhere. Start by adding your classes.</p>
      <div class="row wrap"><button class="btn primary" onclick="editClass()">${icon('plus', 16)} Add your first class</button><button class="btn" onclick="syllabusImport()" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.16);color:#fff">${icon('file-up', 16)} Scan a syllabus</button></div></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${[['library', 'Classes with their own workspace', 'Grades by category, assignments, notes, exams and analytics for each class.'], ['target', 'Priorities that explain themselves', 'A rule-based score ranks your work and tells you why each item is where it is.'], ['chart-line', 'Grade math you can trust', 'Weighted and points grading, what-if, goal and GPA calculators.'], ['brain', 'Study tools from your notes', 'Guides, spaced-repetition flashcards, quizzes and timed practice tests.'], ['graduation-cap', 'Exam prep plans', 'A schedule built around your workload that adjusts when you fall behind, only when you say so.'], ['calendar-days', 'One planner', 'Classes, due dates, exams, study blocks and events with conflict checks.']].map(([ic, h, s]) => `<div class="card"><span class="ki" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);margin-bottom:10px">${icon(ic, 20)}</span><b style="font-family:var(--f-display)">${h}</b><p class="small muted" style="margin:6px 0 0">${s}</p></div>`).join('')}</div>
      <div class="card"><div class="between" style="flex-wrap:wrap;gap:10px"><div><b>Want to look around first?</b><div class="small muted">Load a sample semester. It's made-up demo data, clearly marked, and you can clear it in one click.</div></div><div class="row"><button class="btn" onclick="restoreBackup()">${icon('upload', 15)} Restore backup</button><button class="btn" onclick="loadSample()">${icon('sparkles', 15)} Load sample semester</button></div></div></div>`, actions: '' };
}

/** Compact link into Academic Intelligence: same engine, same numbers. */
function intelStrip() {
  ensureTopics(); const ps = performanceScore(), pg = projectedGPA(), rk = risks(), hi = rk.filter((r) => r.level === 'high').length, rec = directorRecs().find((r) => r.status === 'open' || r.status === 'accepted');
  const gl = S.goals.filter((g) => !g.archived), reached = gl.filter((g) => goalProgress(g).done).length;
  return `<a class="intel-strip" href="#intel"><div class="row" style="gap:12px">${ps.score == null ? '' : segRing(ps.comps, ps.score, '', 64)}<div><div class="eyebrow">Academic Intelligence</div><b style="font-family:var(--f-display)">${ps.score == null ? 'Not enough data yet' : `Performance ${ps.score}/100 · ${ps.label}`}</b></div></div>
    <div class="is-cell"><span class="tiny muted">Projected GPA <span class="tag-obs a">Est.</span></span><b class="num">${pg ? pg.unweighted.toFixed(2) : '—'}</b></div>
    <div class="is-cell"><span class="tiny muted">Risks</span><b class="num ${hi ? 'bad' : ''}">${rk.length}${hi ? ` <span class="tiny">(${hi} high)</span>` : ''}</b></div>
    <div class="is-cell"><span class="tiny muted">Goals</span><b class="num">${gl.length ? `${reached}/${gl.length}` : '—'}</b></div>
    <div class="is-cell grow" style="min-width:180px"><span class="tiny muted">Study next</span><b class="small" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${rec ? `${esc(rec.topic)} · ${fmtMins(rec.mins)}` : 'Nothing recommended'}</b></div>${icon('chevron-right', 18, 'dim')}</a>`;
}
