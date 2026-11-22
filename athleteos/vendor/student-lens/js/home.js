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
function setupSteps() {
  const cs = activeClasses(), firstMissing = (f) => cs.find((c) => !f(c));
  const wOk = (c) => (c.categories || []).length || c.weightsSet, tOk = (c) => (c.schedule || []).length;
  return [
    { done: S.classes.length > 0, t: 'Add your classes', s: S.classes.length ? `${S.classes.length} added` : 'paste a list or scan a syllabus', ic: 'library', go: () => bulkAddClasses() },
    { done: !!cs.length && cs.every(wOk), t: 'Set grade weights', s: `${cs.filter(wOk).length} of ${cs.length} classes`, ic: 'percent', go: () => { const c = firstMissing(wOk); c ? editClass(c) : go('classes'); } },
    { done: !!cs.length && cs.every(tOk), t: 'Add meeting times', s: `${cs.filter(tOk).length} of ${cs.length} classes`, ic: 'calendar-clock', go: () => { const c = firstMissing(tOk); c ? editClass(c) : go('classes'); } },
    { done: S.assignments.length > 0, t: 'Add an assignment', s: 'or paste the instructions', ic: 'list-checks', go: () => editAssignment() },
    { done: S.exams.length > 0, t: 'Add your next test', s: 'countdown + study plan', ic: 'graduation-cap', go: () => editExam() },
    { done: S.sessions.length > 0, t: 'Log a study session', s: 'start the focus timer', ic: 'timer', go: () => go('study', 'timer') },
    { done: S.goals.length > 0, t: 'Set a goal', s: 'GPA, a grade or study hours', ic: 'flag', go: () => { go('intel', 'goals'); setTimeout(() => editGoal(), 80); } },
  ];
}
function classTile(c) {
  const g = classGrade(c.id), nx = openAssignments().filter((a) => a.classId === c.id && a.due).sort((a, b) => a.due.localeCompare(b.due))[0], active = isActiveClass(c);
  const ex = S.exams.filter((e) => e.classId === c.id && e.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  return `<a class="ctile${active ? '' : ' ended'}" href="#classes/${c.id}" style="--c:${c.color}"><div class="between" style="align-items:flex-start"><span class="ct-ic">${icon(c.icon || subjectIcon(c.name), 19)}</span>${g.pct == null ? `<span class="ct-ng">No grades</span>` : `<b class="ct-g num" style="color:${gradeColor(g.pct)}">${round(g.pct, 1)}<small>%</small></b>`}</div>
    <b class="ct-n">${esc(c.name)}</b><span class="ct-t">${c.teacher ? esc(c.teacher) : LEVELS[c.level || 'regular']}</span>
    <span class="ct-f">${ex ? `${icon('graduation-cap', 12)} ${esc(ex.title)} · ${relDay(ex.date)}` : nx ? `${icon('list-checks', 12)} ${esc(nx.title)} · ${relDay(nx.due)}` : c.endDate ? (active ? `${icon('hourglass', 12)} Ends ${fmtDate(c.endDate)}` : 'Ended') : 'Nothing due'}</span></a>`;
}
VIEWS.home = () => {
  const t = today(), h = new Date().getHours(), name = (S.profile.name || '').split(' ')[0];
  const greet = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if (!S.classes.length && !S.assignments.length) return welcome(greet, name);
  const r = ranked(), od = S.assignments.filter((a) => effStatus(a) === 'overdue'), dueToday = openAssignments().filter((a) => a.due === t);
  const wkStart = weekStart(t), wk = S.assignments.filter((a) => a.due >= wkStart && a.due <= addDays(wkStart, 6)), wkDone = wk.filter(isDone).length;
  const g = gpaFor(), exams = S.exams.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)), next = exams[0];
  const days = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i)), mins = days.map(studyMinsOn), goal = S.settings.dailyStudyMins, studiedToday = studyMinsOn(t);
  const upcoming = openAssignments().filter((a) => a.due && a.due >= t && a.due <= addDays(t, 7)).sort((a, b) => a.due.localeCompare(b.due) || (a.dueTime || '99').localeCompare(b.dueTime || '99'));
  const todayItems = itemsOn(t).filter((i) => i.s != null && i.k !== 'study').sort((a, b) => a.s - b.s), classesToday = todayItems.filter((i) => i.k === 'class').length;
  const al = alerts(), br = briefing(), steps = setupSteps(), stepsDone = steps.filter((s) => s.done).length, showSetup = stepsDone < steps.length && !S.settings.setupHidden;
  const anyGrades = S.classes.some((c) => classGrade(c.id).pct != null), studied14 = sum(Array.from({ length: 14 }, (_, i) => studyMinsOn(addDays(t, -i))));
  const gHist = [...new Set(S.classes.flatMap((c) => gradedItems(c.id).map((x) => x.date)))].sort().slice(-10).map((d) => gpaFor(undefined, d)?.unweighted ?? null);
  const headline = od.length ? `You have ${od.length} overdue assignment${od.length === 1 ? '' : 's'}. Start with <b>${esc(od[0].title)}</b>.`
    : dueToday.length ? `${dueToday.length} thing${dueToday.length === 1 ? ' is' : 's are'} due today, starting with <b>${esc(dueToday[0].title)}</b>.`
    : next && daysBetween(t, next.date) <= 7 ? `<b>${esc(next.title)}</b> is ${relDayL(next.date)}. Today is a good day to prep.`
    : !S.assignments.length ? 'Your classes are in. Add assignments and tests and this page will plan your day for you.'
    : 'Nothing due today. A good day to get ahead.';
  const chip = (ic, v, l, c = '') => `<div class="hh-chip"${c ? ` style="--c:${c}"` : ''}>${icon(ic, 15)}<b class="num">${v}</b><span>${l}</span></div>`;
  const cardsMid = [
    upcoming.length || od.length ? `<div class="card"><div class="card-h"><h2>Deadlines</h2><span class="end tiny muted">next 7 days</span></div>
      ${od.length ? `<div class="alert bad" style="margin-bottom:10px;cursor:pointer" onclick="go('assignments','overdue')"><span class="ai">${icon('triangle-alert', 15)}</span><span><b>${od.length} overdue</b><br><span class="small muted">${od.slice(0, 2).map((a) => esc(a.title)).join(', ')}</span></span></div>` : ''}
      <div class="stack" style="gap:2px">${upcoming.slice(0, 6).map((a) => `<div class="li click" data-aid="${a.id}" style="padding:8px"><div class="datebox"><span>${DAYS[dow(a.due)]}</span><b>${+a.due.slice(8)}</b></div><span class="cbar" style="--c:${clsColor(a.classId)}"></span><span class="grow"><span class="t">${esc(a.title)}</span><div class="s">${esc(clsName(a.classId))}${a.dueTime ? ' · ' + fmtTime(a.dueTime) : ''}</div></span></div>`).join('')}</div></div>` : '',
    todayItems.length ? `<div class="card"><div class="card-h"><h2>Today</h2><a class="end btn ghost sm" href="#planner/day/${t}">Planner ${icon('arrow-right', 14)}</a></div><div class="timeline">${todayItems.slice(0, 7).map((i) => `<div class="tl-row" style="--c:${i.color}"><span class="tl-time num">${fmtTime(fromMin(i.s))}</span><span class="tl-dot"></span><span class="grow"><b class="small">${esc(i.title)}</b><div class="tiny muted">${esc(i.sub)}</div></span></div>`).join('')}</div></div>` : '',
    anyGrades ? `<div class="card"><div class="card-h"><h2>Grades</h2><a class="end btn ghost sm" href="#grades">Details ${icon('arrow-right', 14)}</a></div><div class="stack" style="gap:12px">${activeClasses().map((c) => { const gg = classGrade(c.id); return `<a href="#classes/${c.id}" style="text-decoration:none;color:inherit"><div class="between small" style="margin-bottom:5px"><span class="row" style="gap:8px;min-width:0"><i class="dot-c" style="--c:${c.color}"></i><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</b></span><b class="num" style="color:${gradeColor(gg.pct)}">${gg.pct == null ? '—' : round(gg.pct, 1) + '%'} ${gg.letter ? `<span class="badge">${gg.letter}</span>` : ''}</b></div><div class="bar"><i style="width:${clamp(gg.pct ?? 0, 0, 100)}%;--c:${c.color}"></i></div></a>`; }).join('')}</div></div>` : '',
    al.length ? `<div class="card"><div class="card-h"><h2>Alerts</h2><span class="end badge bad">${al.length}</span></div><div class="stack" style="gap:8px">${al.slice(0, 5).map((x, i) => `<div class="alert ${x.lvl}" style="cursor:pointer" data-al="${i}"><span class="ai">${icon(x.ic, 15)}</span><span class="grow"><b class="small">${esc(x.t)}</b><div class="tiny muted">${esc(x.s)}</div></span></div>`).join('')}</div></div>` : '',
    studied14 ? `<div class="card"><div class="card-h"><h2>Study this week</h2><span class="end tiny muted">${goal ? `goal ${fmtMins(goal)} / day` : ''}</span></div>${barChart(days.map((d, i) => ({ label: fmtDay(d), short: DAYS[dow(d)], value: mins[i], color: d === t ? 'var(--accent-2)' : mins[i] >= goal ? 'var(--good)' : 'var(--accent)', dim: d > t })), { goal, fmt: fmtMins, h: 200 })}</div>` : '',
  ].filter(Boolean);
  const meaningfulBrief = br.filter((b) => !/study goal/.test(b.text));
  return {
    title: 'Today', sub: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    actions: `<button class="btn primary sm" id="h-add" aria-label="Quick add">${icon('plus', 15)}<span class="hide-sm">Quick add</span></button>`,
    html: `<section class="hero home-hero"><div class="hh-main"><div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h2 class="hh-title">${greet}${name ? `, ${esc(name)}` : ''}</h2><p class="hh-sub">${headline}</p>
        <div class="hh-chips">${chip('library', classesToday, `class${classesToday === 1 ? '' : 'es'} today`)}${chip('list-checks', dueToday.length, 'due today', dueToday.length ? 'var(--warn)' : '')}${chip('timer', fmtMins(studiedToday), `of ${fmtMins(goal)} study`, studiedToday >= goal ? 'var(--good)' : '')}${cardsDue().length ? chip('layers', cardsDue().length, 'cards due') : ''}</div>
        <div class="hh-acts"><a class="btn sm glass" href="#planner/day/${t}">${icon('calendar-days', 15)} Plan my day</a><a class="btn sm glass" href="#study/timer">${icon('timer', 15)} Focus timer</a><a class="btn sm glass" href="#intel/director">${icon('target', 15)} What to study</a></div></div>
      <div class="hh-side">${next ? (() => { const c = countdown(next), rd = readiness(next); return `<a href="#exams/${next.id}" class="hh-exam"><div class="between"><span class="eyebrow">Next exam</span>${rd != null ? `<span class="badge glassb">${rd}% ready</span>` : ''}</div><b class="hh-exam-t">${esc(next.title)}</b><span class="small" style="color:#c7cdf5">${esc(clsName(next.classId))} · ${fmtDay(next.date)}</span><div class="count" style="margin-top:12px"><div><b>${c.d}</b><small>days</small></div><div><b>${c.h}</b><small>hrs</small></div><div><b>${c.m}</b><small>min</small></div></div></a>`; })()
        : `<div class="hh-week">${Array.from({ length: 7 }, (_, i) => addDays(t, i)).map((d, i) => { const n = itemsOn(d).filter((x) => x.k !== 'class').length, cl = itemsOn(d).filter((x) => x.k === 'class').length; return `<a href="#planner/day/${d}" class="hw-d${d === t ? ' on' : ''}"><span>${i === 0 ? 'Today' : DAYS[dow(d)]}</span><b>${+d.slice(8)}</b><i>${cl ? `<em style="background:#8ea0ff"></em>` : ''}${n ? `<em style="background:var(--warn)"></em>` : ''}</i></a>`; }).join('')}</div><p class="tiny" style="color:#aab4e6;margin:10px 2px 0">No exams scheduled. <a href="#" onclick="editExam();return false" style="color:#fff">Add one</a> to get a countdown.</p>`}</div></section>
      ${showSetup ? `<section class="card setup"><div class="setup-h">${ring((stepsDone / steps.length) * 100, `${stepsDone}/${steps.length}`, 'done', 66, 'var(--accent)', 7)}<div class="grow"><h2>Get Student Lens set up</h2><p class="small muted" style="margin:2px 0 0">Each step makes the planner, priorities and study plans smarter.</p></div><button class="btn ghost sm" id="setup-hide">Hide</button></div>
        <div class="setup-grid">${steps.map((s, i) => `<button class="step${s.done ? ' done' : ''}" data-step="${i}" ${s.done && i === 0 ? '' : ''}><span class="st-ic">${s.done ? icon('check', 16) : icon(s.ic, 16)}</span><span class="grow"><b>${s.t}</b><small>${s.s}</small></span>${s.done ? '' : icon('chevron-right', 15, 'dim')}</button>`).join('')}</div></section>` : ''}
      <section><div class="sec-h"><h2>Your classes</h2><a class="btn ghost sm" href="#classes">All classes ${icon('arrow-right', 14)}</a></div><div class="ctiles">${[...activeClasses(), ...S.classes.filter((c) => !isActiveClass(c))].map(classTile).join('')}</div></section>
      ${anyGrades || wk.length || studied14 ? `<div class="kpis">
        ${kpi('award', 'GPA', g ? g.unweighted.toFixed(2) : '—', g ? `${g.weighted.toFixed(2)} weighted` : 'enter grades to see it', 'var(--accent)', spark(gHist))}
        ${kpi('list-todo', 'Due this week', wk.length - wkDone, `${wkDone} done · ${od.length} overdue`, od.length ? 'var(--bad)' : 'var(--accent-2)')}
        ${kpi('clock', 'Studied this week', fmtMins(sum(mins)), `${studyStreak()}-day streak`, 'var(--good)', spark(mins, 'var(--good)'))}
        ${kpi('circle-check', 'Completion', wk.length ? Math.round((wkDone / wk.length) * 100) + '%' : '—', 'of this week’s work', 'var(--warn)')}</div>` : ''}
      ${anyGrades || S.assignments.length || S.sessions.length ? intelStrip() : ''}
      ${meaningfulBrief.length || r.length ? `<div class="grid g-12">
        <div class="card ${r.length ? 's-7' : 's-12'}"><div class="card-h"><span class="ki" style="color:var(--accent)">${icon('sparkles', 18)}</span><h2>Daily briefing</h2><span class="end tiny muted">rules over your records</span></div>
          <div class="stack" style="gap:8px">${br.map((b, i) => `<div class="alert ${b.lvl}" style="cursor:pointer" data-br="${i}"><span class="ai">${icon(b.ic, 15)}</span><span class="grow"><span>${b.text}</span><div class="tiny dim" style="margin-top:2px">Based on: ${esc(b.why)}</div></span>${icon('chevron-right', 15, 'dim')}</div>`).join('')}</div></div>
        ${r.length ? `<div class="card s-5"><div class="card-h"><h2>Top priorities</h2><a class="end btn ghost sm" href="#assignments">All ${icon('arrow-right', 14)}</a></div><div class="list">${r.slice(0, 5).map(({ a, score, why }) => assignmentRow(a, { pri: { score, why } })).join('')}</div></div>` : ''}</div>` : ''}
      ${cardsMid.length ? `<div class="grid auto-cards">${cardsMid.join('')}</div>` : ''}
`,
    mount(root) {
      root.addEventListener('click', (e) => { const b = e.target.closest('[data-br]'); if (b) br[+b.dataset.br].go(); const a = e.target.closest('[data-al]'); if (a) al[+a.dataset.al].go(); const s = e.target.closest('[data-step]'); if (s) steps[+s.dataset.step].go(); });
      $('#h-add').onclick = quickAdd;
      $('#setup-hide', root)?.addEventListener('click', () => { S.settings.setupHidden = true; save('settings'); toast('Setup hidden. You can bring it back in Settings.', { label: 'Undo', fn: () => { S.settings.setupHidden = false; save('settings'); } }); });
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
      <div class="row wrap"><button class="btn primary" onclick="bulkAddClasses()">${icon('list', 16)} Add your classes</button><button class="btn" onclick="editClass()" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.16);color:#fff">${icon('plus', 16)} Add one</button><button class="btn" onclick="syllabusImport()" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.16);color:#fff">${icon('file-up', 16)} Scan a syllabus</button></div></div></div>
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
