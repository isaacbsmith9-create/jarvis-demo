'use strict';
// ===================== Exam Center =====================
function countdown(e) { const at = new Date(`${e.date}T${e.time || '08:00'}:00`).getTime(), ms = Math.max(0, at - Date.now()); return { d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4), past: at < Date.now() }; }
function examMiniList(list, showPast = false) {
  const t = today(), up = list.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)), past = list.filter((e) => e.date < t).sort((a, b) => b.date.localeCompare(a.date));
  const row = (e) => { const r = readiness(e), done = e.date < t; return `<a class="li click" href="#exams/${e.id}" style="text-decoration:none;color:inherit"><span class="cbar" style="--c:${clsColor(e.classId)}"></span><span class="grow"><span class="t">${esc(e.title)}</span><div class="s">${esc(clsName(e.classId))} · ${fmtDay(e.date)}${e.time ? ' · ' + fmtTime(e.time) : ''}</div></span>${done ? (e.score != null && e.max ? `<b class="num" style="color:${gradeColor((e.score / e.max) * 100)}">${round((e.score / e.max) * 100, 1)}%</b>` : '<span class="badge">Add score</span>') : `<span class="badge ${daysBetween(t, e.date) <= 3 ? 'warn' : 'accent'}">${relDay(e.date)}</span>${r != null ? `<span class="tiny muted num" style="min-width:42px;text-align:right">${r}% ready</span>` : ''}`}</a>`; };
  if (!up.length && !(showPast && past.length)) return emptyState('graduation-cap', 'No upcoming exams', 'Add an exam to get a countdown and a study plan.');
  return `<div class="list">${up.map(row).join('')}${showPast && past.length ? `<h4 style="margin:12px 0 2px" class="muted">Past</h4>${past.map(row).join('')}` : ''}</div>`;
}
VIEWS.exams = (rt) => {
  const e = rt.arg && byId('exams', rt.arg);
  if (e) return examDetail(e);
  const t = today(), up = S.exams.filter((x) => x.date >= t).sort((a, b) => a.date.localeCompare(b.date)), past = S.exams.filter((x) => x.date < t);
  const next = up[0], scored = past.filter((x) => x.score != null && x.max > 0);
  const behind = up.filter((x) => (x.plan || []).some((p) => p.date < t && !p.done));
  const planMins = sum(up.flatMap((x) => (x.plan || []).filter((p) => p.date >= t && !p.done).map((p) => p.mins)));
  return {
    title: 'Exams', sub: up.length ? `${up.length} upcoming${next ? ` · next ${relDayL(next.date)}` : ''}` : 'Countdowns, readiness and study plans',
    actions: `<button class="btn primary sm" id="ex-new">${icon('plus', 15)} Add exam</button>`,
    html: `${next ? (() => { const c = countdown(next), r = readiness(next); return `<div class="hero"><div class="row wrap" style="gap:22px;position:relative;z-index:1"><div class="grow" style="min-width:220px"><div class="eyebrow">Next exam · ${esc(clsName(next.classId))}</div><h2 style="font-size:26px;margin:6px 0 4px;color:#fff">${esc(next.title)}</h2><div class="small" style="color:#c7cdf5">${fmtDay(next.date)}${next.time ? ' at ' + fmtTime(next.time) : ''} · ${(next.topics || []).length} topics</div>
        <div class="count" style="margin-top:16px;max-width:360px;color:#fff"><div><b>${c.d}</b><small>days</small></div><div><b>${c.h}</b><small>hours</small></div><div><b>${c.m}</b><small>min</small></div><div><b>${(next.plan || []).filter((p) => !p.done).length}</b><small>sessions</small></div></div></div>
        <div style="color:#fff">${ring(r ?? 0, r == null ? '—' : r + '%', 'readiness', 132, r == null ? 'rgba(255,255,255,.4)' : r >= 75 ? 'var(--good)' : r >= 50 ? 'var(--warn)' : 'var(--bad)', 11)}</div>
        <a class="btn primary" href="#exams/${next.id}" style="align-self:center">Open prep ${icon('arrow-right', 15)}</a></div></div>`; })() : ''}
      <div class="kpis">${kpi('graduation-cap', 'Upcoming', up.length, up.filter((x) => daysBetween(t, x.date) <= 7).length + ' in the next 7 days')}${kpi('calendar-clock', 'Prep planned', fmtMins(planMins), 'study time left in your plans')}${kpi('triangle-alert', 'Behind plan', behind.length, behind.length ? 'missed sessions to move' : 'all on schedule', behind.length ? 'var(--warn)' : 'var(--good)')}${kpi('award', 'Exam average', scored.length ? round(avg(scored.map((x) => (x.score / x.max) * 100)), 1) + '%' : '—', `${scored.length} scored`)}</div>
      <div class="grid g-12"><div class="card s-7"><div class="card-h"><h2>All exams</h2></div>${examMiniList(S.exams, true)}</div>
        <div class="card s-5"><div class="card-h"><h2>Exam calendar</h2><span class="end tiny muted">${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></div>${miniMonth(t, (d) => S.exams.filter((x) => x.date === d))}
          <div class="legend">${S.classes.filter((c) => S.exams.some((x) => x.classId === c.id)).map((c) => `<span><i class="dot-c" style="--c:${c.color}"></i>${esc(c.name)}</span>`).join('')}</div></div></div>`,
    mount() { $('#ex-new').onclick = () => editExam(); },
  };
};
function miniMonth(ref, itemsOn) {
  const first = ref.slice(0, 8) + '01', start = weekStart(first), mo = ref.slice(5, 7);
  let h = `<div class="cal-month" style="gap:4px">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow" style="text-align:center;padding:0">${d}</div>`).join('')}`;
  for (let i = 0; i < 42; i++) { const d = addDays(start, i); if (i >= 35 && d.slice(5, 7) !== mo) break; const its = itemsOn(d);
    h += `<a href="${its.length ? '#exams/' + its[0].id : '#planner/day/' + d}" class="d${d.slice(5, 7) !== mo ? ' out' : ''}${d === today() ? ' today' : ''}" style="min-height:44px;padding:5px;text-decoration:none;color:inherit;align-items:center;${its.length ? `background:color-mix(in srgb, ${clsColor(its[0].classId)} 26%, var(--card));` : ''}" ${its.length ? `data-tip="${esc(its.map((x) => esc(x.title)).join('<br>'))}"` : ''}><span class="tiny" style="font-weight:700">${+d.slice(8)}</span>${its.length ? `<i class="dot-c" style="--c:${clsColor(its[0].classId)}"></i>` : ''}</a>`; }
  return h + '</div>';
}
function examDetail(e) {
  const t = today(), c = countdown(e), r = readiness(e), past = e.date < t, plan = e.plan || [];
  const missed = plan.filter((p) => p.date < t && !p.done), donePl = plan.filter((p) => p.done).length;
  const rs = S.results.filter((x) => x.classId === e.classId).sort((a, b) => b.at - a.at);
  const decks = S.decks.filter((d) => d.classId === e.classId), notes = S.notes.filter((n) => n.classId === e.classId), guides = S.guides.filter((g) => g.classId === e.classId);
  const tps = e.topics || [], conf = tps.length ? avg(tps.map((x) => ((x.confidence || 1) - 1) / 4)) * 100 : null;
  const planPart = plan.length ? (() => { const due = plan.filter((p) => p.date < t || (p.date === t && p.done)); return due.length ? (due.filter((p) => p.done).length / due.length) * 100 : 100; })() : null;
  const byDay = {}; for (const p of plan) (byDay[p.date] ||= []).push(p);
  return {
    title: e.title, sub: `<a href="#exams" style="color:var(--muted);text-decoration:none">Exams</a> / ${esc(clsName(e.classId))}`,
    actions: `<button class="btn ghost sm" id="ed-edit">${icon('pencil', 15)}<span class="hide-sm">Edit</span></button>${decks.length ? `<button class="btn primary sm" id="ed-test">${icon('clipboard-list', 15)}<span class="hide-sm">Practice test</span></button>` : ''}`,
    html: `<div class="class-hero" style="--c:${clsColor(e.classId)}"><div class="row wrap" style="gap:22px;position:relative">
        ${ring(r ?? 0, r == null ? '—' : r + '%', 'readiness', 122, r == null ? 'var(--muted)' : r >= 75 ? 'var(--good)' : r >= 50 ? 'var(--warn)' : 'var(--bad)')}
        <div class="grow" style="min-width:220px"><div class="eyebrow" style="color:${clsColor(e.classId)}">${esc(clsName(e.classId))}</div><h2 style="font-size:24px;margin:4px 0">${esc(e.title)}</h2><div class="small muted">${fmtDay(e.date)}${e.time ? ' · ' + fmtTime(e.time) : ''}</div>
          ${past ? '' : `<div class="count" style="margin-top:12px;max-width:300px">${[[c.d, 'days'], [c.h, 'hours'], [c.m, 'min']].map(([v, l]) => `<div style="background:var(--raised)"><b>${v}</b><small>${l}</small></div>`).join('')}<div style="background:var(--raised)"><b>${plan.length ? Math.round((donePl / plan.length) * 100) : 0}%</b><small>plan</small></div></div>`}</div>
        <div class="stack small" style="gap:6px;min-width:200px">${[['Topic confidence', conf, '50%'], ['Plan on schedule', planPart, '30%'], ['Best recent practice', rs.filter((x) => x.at > Date.now() - 30 * 864e5).length ? Math.max(...rs.filter((x) => x.at > Date.now() - 30 * 864e5).map((x) => (x.correct / x.total) * 100)) : null, '20%']].map(([l, v, w]) => `<div><div class="between"><span class="muted">${l} <span class="dim">(${w})</span></span><b class="num">${v == null ? '—' : Math.round(v) + '%'}</b></div><div class="bar" style="height:5px;margin-top:3px"><i style="width:${v ?? 0}%"></i></div></div>`).join('')}<span class="tiny dim">Readiness is a weighted average of the parts that have data.</span></div>
      </div></div>
      ${past ? `<div class="card"><div class="card-h"><h3>Result</h3></div><div class="row wrap" style="gap:10px"><span class="small muted">Score</span><input type="number" id="ed-score" value="${e.score ?? ''}" step="any" min="0" style="width:100px" aria-label="Score"><span>/</span><input type="number" id="ed-max" value="${e.max ?? 100}" step="any" min="1" style="width:100px" aria-label="Max"><select id="ed-cat" style="width:auto" aria-label="Category"><option value="">Grade category</option>${(cls(e.classId)?.categories || []).map((k) => `<option value="${k.id}"${e.categoryId === k.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select><button class="btn primary sm" id="ed-save">Save to gradebook</button></div></div>` : ''}
      ${missed.length && !past ? `<div class="alert warn"><span class="ai">${icon('triangle-alert', 16)}</span><span class="grow"><b>You're behind: ${missed.length} session${missed.length === 1 ? '' : 's'} (${fmtMins(sum(missed.map((p) => p.mins)))}) not done.</b><br><span class="small muted">Student Lens won't move anything without asking. Spread them over the days you have left?</span></span><button class="btn sm primary" id="ed-rebal">Move them</button></div>` : ''}
      <div class="grid g-12">
        <div class="card s-7"><div class="card-h"><h3>Study plan</h3><span class="end row">${plan.length ? `<span class="tiny muted">${donePl}/${plan.length} done · ${fmtMins(sum(plan.map((p) => p.mins)))}</span>` : ''}${past ? '' : `<button class="btn sm" id="ed-addp">${icon('plus', 14)}</button><button class="btn sm ${plan.length ? '' : 'primary'}" id="ed-gen">${icon('sparkles', 14)} ${plan.length ? 'Rebuild' : 'Generate plan'}</button>`}</span></div>
          ${plan.length ? Object.entries(byDay).sort().map(([d, ps]) => `<div style="margin-bottom:10px"><div class="tiny ${d === t ? 'accent' : d < t ? 'muted' : 'muted'}" style="font-weight:700;margin-bottom:4px;${d === t ? 'color:var(--accent)' : ''}">${d === t ? 'TODAY · ' : ''}${fmtDay(d).toUpperCase()}</div>${ps.map((p) => `<div class="li" style="padding:7px 4px"><button type="button" class="check${p.done ? ' on' : ''}" data-pd="${p.id}" aria-label="Mark session done">${p.done ? icon('check', 14) : ''}</button><span class="grow"><span class="t" style="${p.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(p.label)}</span>${p.moved ? ' <span class="badge warn">moved</span>' : ''}${p.kind === 'review' ? ' <span class="badge accent">review</span>' : ''}${p.custom ? ' <span class="badge">added</span>' : ''}</span><input type="number" value="${p.mins}" min="5" max="300" step="5" data-pm="${p.id}" style="width:70px;padding:5px 8px" aria-label="Minutes"><span class="tiny muted">min</span><input type="date" value="${p.date}" max="${e.date}" data-pdt="${p.id}" style="width:auto;padding:5px 8px" aria-label="Date"><button class="icon-btn" style="width:30px;height:30px" data-prm="${p.id}" aria-label="Remove session">${icon('x', 13)}</button></div>`).join('')}</div>`).join('')
            : emptyState('calendar-clock', past ? 'No plan was made' : 'No plan yet', past ? '' : 'Rate your topics, then generate a plan. It splits your daily study budget across the days left, gives more time to topics you’re less sure about, skips time already used by homework and other exams, and saves the last day for a full review.')}
          <p class="tiny dim" style="margin:8px 0 0">Rule-based scheduler. Edit any session; rebuilding keeps sessions you've finished.</p></div>
        <div class="s-5 stack" style="gap:18px;align-content:start">
          <div class="card"><div class="card-h"><h3>Topics</h3><span class="end tiny muted">how sure are you?</span></div>${tps.length ? `<div class="stack" style="gap:10px">${tps.map((tp) => `<div><div class="between small"><b>${esc(tp.name)}</b><button class="icon-btn" style="width:26px;height:26px" data-trm="${tp.id}" aria-label="Remove topic">${icon('x', 12)}</button></div><div class="seg" style="width:100%;margin-top:4px" data-tc="${tp.id}">${[1, 2, 3, 4, 5].map((v) => `<button type="button" class="${tp.confidence === v ? 'on' : ''}" data-v="${v}" style="flex:1" title="${['', 'Lost', 'Shaky', 'Okay', 'Good', 'Nailed it'][v]}">${['', 'Lost', 'Shaky', 'Okay', 'Good', 'Solid'][v]}</button>`).join('')}</div></div>`).join('')}</div>` : '<p class="small muted" style="margin:0 0 8px">Add the topics this exam covers.</p>'}
            <form class="row" id="ed-tadd" style="margin-top:10px"><input type="text" placeholder="Add a topic" id="ed-tn" aria-label="New topic"><button class="btn sm" type="submit">${icon('plus', 14)}</button></form></div>
          <div class="card"><div class="card-h"><h3>Checklist</h3><span class="end tiny muted">${(e.checklist || []).filter((x) => x.done).length}/${(e.checklist || []).length}</span></div><div class="stack" style="gap:4px">${(e.checklist || []).map((x) => `<div class="row"><button type="button" class="check${x.done ? ' on' : ''}" data-ck="${x.id}" aria-label="Toggle">${x.done ? icon('check', 14) : ''}</button><span class="grow small" style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.text)}</span><button class="icon-btn" style="width:26px;height:26px" data-ckrm="${x.id}" aria-label="Remove">${icon('x', 12)}</button></div>`).join('')}</div>
            <form class="row" id="ed-cadd" style="margin-top:8px"><input type="text" placeholder="e.g. Bring a calculator" id="ed-cn" aria-label="New checklist item"><button class="btn sm" type="submit">${icon('plus', 14)}</button></form></div>
          <div class="card"><div class="card-h"><h3>Materials</h3></div>${decks.length + notes.length + guides.length ? `<div class="list">${decks.map((d) => `<a class="li click" href="#study/cards/${d.id}" style="text-decoration:none;color:inherit">${icon('layers', 15)}<span class="grow t">${esc(d.name)}</span><span class="tiny muted">${cardsDue(d.id).length} due</span></a>`).join('')}${guides.map((g) => `<a class="li click" href="#study/guides/${g.id}" style="text-decoration:none;color:inherit">${icon('book-text', 15)}<span class="grow t">${esc(g.title)}</span></a>`).join('')}${notes.map((n) => `<a class="li click" href="#study/workspace/${n.id}" style="text-decoration:none;color:inherit">${icon('notebook-pen', 15)}<span class="grow t">${esc(n.title)}</span></a>`).join('')}</div>` : `<p class="small muted" style="margin:0">Decks, guides and notes for ${esc(clsName(e.classId))} show up here.</p>`}</div>
          <div class="card"><div class="card-h"><h3>Practice history</h3></div>${rs.length ? `<div class="list">${rs.slice(0, 6).map((x) => `<div class="li"><span class="grow"><span class="t">${esc(x.title)}</span><div class="s">${x.kind === 'test' ? 'Practice test' : 'Quiz'} · ${fmtDate(isoOf(new Date(x.at)))}</div></span><b class="num" style="color:${gradeColor((x.correct / x.total) * 100)}">${Math.round((x.correct / x.total) * 100)}%</b></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">Take a quiz or practice test from this class’s decks.</p>'}</div>
        </div></div>`,
    mount(root) {
      const sv = () => upsert('exams', e);
      $('#ed-edit').onclick = () => editExam(e);
      $('#ed-test')?.addEventListener('click', () => { const cards = S.cards.filter((x) => decks.some((d) => d.id === x.deckId)); if (cards.length < 2) return toast('Add cards to this class’s decks first'); runQuiz(makeQuestions(cards, Math.min(20, cards.length), 'mixed'), { title: 'Test: ' + e.title, classId: e.classId, deckIds: decks.map((d) => d.id), kind: 'test', exam: true, timeLimit: 20 }); });
      $('#ed-gen', root)?.addEventListener('click', async () => {
        if (!(e.topics || []).length && !(await confirmBox('No topics yet, so the plan will be general review sessions. Continue?', 'Generate', false))) return;
        const kept = plan.filter((p) => p.done); const fresh = buildExamPlan(e, { from: new Date().getHours() >= 20 ? addDays(t, 1) : t });
        if (!fresh.length) return toast('No days left before the exam to plan.');
        e.plan = [...kept, ...fresh].sort((a, b) => a.date.localeCompare(b.date)); sv(); toast(`Planned ${fresh.length} sessions · ${fmtMins(sum(fresh.map((p) => p.mins)))}`);
      });
      $('#ed-rebal', root)?.addEventListener('click', () => { const n = rebalancePlan(e); sv(); toast(n ? `Moved ${n} session${n === 1 ? '' : 's'} to the days ahead` : 'Nothing to move'); });
      $('#ed-addp', root)?.addEventListener('click', () => { e.plan = [...plan, { id: uid('p'), date: t <= e.date ? t : e.date, topicIds: [], label: 'Study session', mins: 30, kind: 'study', done: false, custom: true }]; sv(); });
      root.addEventListener('click', (ev) => {
        const pd = ev.target.closest('[data-pd]'); if (pd) { const p = plan.find((x) => x.id === pd.dataset.pd); p.done = !p.done; if (p.done) { p.doneAt = Date.now(); if (!S.sessions.some((s) => s.planId === p.id)) S.sessions.push({ id: uid('s'), classId: e.classId, topic: p.label, start: Date.now(), mins: p.mins, rating: null, mode: 'exam-plan', planId: p.id }); } else S.sessions = S.sessions.filter((s) => s.planId !== p.id); save('sessions'); sv(); return; }
        const prm = ev.target.closest('[data-prm]'); if (prm) { e.plan = plan.filter((x) => x.id !== prm.dataset.prm); sv(); return; }
        const tc = ev.target.closest('[data-tc] [data-v]'); if (tc) { const tp = e.topics.find((x) => x.id === tc.closest('[data-tc]').dataset.tc); tp.confidence = +tc.dataset.v; sv(); return; }
        const trm = ev.target.closest('[data-trm]'); if (trm) { e.topics = e.topics.filter((x) => x.id !== trm.dataset.trm); sv(); return; }
        const ck = ev.target.closest('[data-ck]'); if (ck) { const x = e.checklist.find((y) => y.id === ck.dataset.ck); x.done = !x.done; sv(); return; }
        const ckrm = ev.target.closest('[data-ckrm]'); if (ckrm) { e.checklist = e.checklist.filter((y) => y.id !== ckrm.dataset.ckrm); sv(); }
      });
      root.addEventListener('change', (ev) => { const m = ev.target.dataset.pm, d = ev.target.dataset.pdt; if (m) { const p = plan.find((x) => x.id === m); const v = Number(ev.target.value); if (v > 0) { p.mins = v; sv(); } } if (d) { const p = plan.find((x) => x.id === d); if (ev.target.value && ev.target.value <= e.date) { p.date = ev.target.value; e.plan.sort((a, b) => a.date.localeCompare(b.date)); sv(); render(); } } });
      $('#ed-tadd', root).onsubmit = (ev) => { ev.preventDefault(); const v = $('#ed-tn', root).value.trim(); if (!v) return; e.topics = [...tps, { id: uid('t'), name: v, confidence: 3 }]; sv(); render(); setTimeout(() => $('#ed-tn')?.focus(), 40); };
      $('#ed-cadd', root).onsubmit = (ev) => { ev.preventDefault(); const v = $('#ed-cn', root).value.trim(); if (!v) return; e.checklist = [...(e.checklist || []), { id: uid('c'), text: v, done: false }]; sv(); render(); setTimeout(() => $('#ed-cn')?.focus(), 40); };
      $('#ed-save', root)?.addEventListener('click', () => { const s = $('#ed-score', root).value, m = Number($('#ed-max', root).value); if (s === '') { e.score = null; sv(); return toast('Score cleared'); } if (!(m > 0) || Number(s) < 0) return toast('Enter a valid score and max'); e.score = Number(s); e.max = m; e.categoryId = $('#ed-cat', root).value; sv(); toast(`Saved: ${round((e.score / m) * 100, 1)}%${e.categoryId ? '' : ' (pick a category so it counts in weighted grades)'}`); });
    },
  };
}
function editExam(rec = null, preset = {}) {
  const isNew = !rec;
  const e = rec ? JSON.parse(JSON.stringify(rec)) : { id: uid('e'), classId: preset.classId || S.classes[0]?.id || '', title: '', date: addDays(today(), 7), time: '', topics: [], checklist: [{ id: uid('c'), text: 'Review all class notes', done: false }, { id: uid('c'), text: 'Do a full practice test', done: false }, { id: uid('c'), text: 'Pack supplies the night before', done: false }], plan: [], categoryId: '', score: null, max: 100, createdAt: Date.now(), ...preset };
  const cats = (cid) => `<option value="">None</option>` + (cls(cid)?.categories || []).map((k) => `<option value="${k.id}"${(e.categoryId || (isNew && /test|exam/i.test(k.name) ? k.id : '')) === k.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('');
  modal({ title: isNew ? 'Add exam' : 'Edit exam', icon: 'graduation-cap', wide: true,
    body: `<div class="fgrid"><label class="f full">Exam name<input type="text" name="title" value="${esc(e.title)}" placeholder="e.g. Unit 5 test" autofocus></label>
      <label class="f">Class<select name="classId">${classOptions(e.classId)}</select></label><label class="f">Counts in grade category<select name="categoryId">${cats(e.classId)}</select></label>
      <label class="f">Date<input type="date" name="date" value="${e.date}"></label><label class="f">Time (optional)<input type="time" name="time" value="${e.time || ''}"></label>
      <label class="f">Points possible<input type="number" name="max" value="${e.max ?? 100}" min="1" step="any"></label><span></span>
      <label class="f full">Topics (one per line)<textarea name="topics" rows="5" placeholder="Photosynthesis&#10;Cellular respiration&#10;Enzymes">${esc((e.topics || []).map((x) => x.name).join('\n'))}</textarea></label></div><div id="ee-w"></div>`,
    foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${icon('trash-2', 15)} Delete</button>`}<span class="grow"></span><button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-ok>${icon('check', 15)} ${isNew ? 'Add exam' : 'Save'}</button>`,
    onMount: (r, close) => {
      $('[name=classId]', r).onchange = (ev) => ($('[name=categoryId]', r).innerHTML = cats(ev.target.value));
      $('[data-x2]', r).onclick = close;
      $('[data-del]', r)?.addEventListener('click', async () => { if (await confirmBox(`Delete ${e.title}? Its study plan goes too.`)) { remove('exams', e.id); close(); go('exams'); toast('Exam deleted', { label: 'Undo', fn: () => upsert('exams', rec) }); } });
      $('[data-ok]', r).onclick = () => {
        const f = formData(r), w = $('#ee-w', r);
        if (!f.title || !f.date) return (w.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>Name and date are required.</div>`);
        const names = f.topics.split(/\n/).map((x) => x.trim()).filter(Boolean), old = e.topics || [];
        const topics = names.map((n) => old.find((x) => x.name.toLowerCase() === n.toLowerCase()) || { id: uid('t'), name: n, confidence: 3 });
        const out = { ...e, title: f.title, classId: f.classId, categoryId: f.categoryId, date: f.date, time: f.time, max: f.max || 100, topics };
        if (isDuplicate({ ...out, due: out.date }, 'exams') && !w.dataset.confirmed) { w.dataset.confirmed = 1; w.innerHTML = `<div class="alert warn"><span class="ai">${icon('copy', 15)}</span>This class already has an exam with that name on that date. Save again to keep both.</div>`; return; }
        if (rec && rec.date !== out.date && (out.plan || []).some((p) => !p.done)) w.dataset.dateChanged = 1;
        out.plan = (out.plan || []).filter((p) => p.done || p.date < out.date);
        upsert('exams', out); close(); toast(isNew ? 'Exam added. Rate your topics, then generate a plan.' : 'Exam saved'); go('exams', out.id);
      };
    } });
}
