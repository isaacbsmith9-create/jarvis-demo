// ===================== COACH (Edition 2): Athlete Development Director =====================
// Rule-based analysis always works and shows its reasoning; the AI layer (inside Claude) explains and plans from the same data.
function snapshot2() {
  const r = skillRatings(), ls = loadStats(), rd = readiness();
  const hs = handleSessions().filter((s) => inRange(s.date, '30')), ft = finishTotals(finishSessions().filter((s) => inRange(s.date, '30')));
  return {
    skillRatings: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { rating: v.v, basis: v.basis }])), notRated: SKILLS.filter(([k]) => !r[k]).map(([, l]) => l),
    developmentScore: devScore(), readiness: rd ? { score: rd.score, notes: rd.notes } : null, availability: availability(),
    trainingLoad: { acute7: ls.acute, chronicWeekly: ls.chronic, acwr: ls.acwr, monotony: ls.monotony, estimatedFromIntensity: ls.est }, restAdvice: restAdvice().map((x) => x[1]),
    priorities: priorities().slice(0, 5).map((p) => ({ area: p.l, score: p.score, why: p.why })), balance28d: Object.fromEntries(Object.entries(balance().share).map(([k, v]) => [k, Math.round(v * 100) + '%'])),
    handles30d: hs.length ? { sessions: hs.length, minutes: sum(hs.map((s) => s.mins)), weakHandMinutes: sum(hs.map((s) => s.weakMins || 0)), losses: sum(hs.map((s) => s.losses || 0)) } : null,
    finishing30d: ft.a ? { made: ft.m, att: ft.a, left: `${ft.L.m}/${ft.L.a}`, right: `${ft.R.m}/${ft.R.a}` } : null,
    film30d: (() => { const f = filmEntries().filter((x) => inRange(x.date, '30')); return f.length ? { entries: f.length, minutes: sum(f.map((x) => x.mins || 0)), reads: sum(f.map((x) => x.reads || 0)), correct: sum(f.map((x) => x.correct || 0)), takeaways: f.map((x) => x.takeaways).filter(Boolean).slice(-5) } : null; })(),
    goals: goals().map((g) => { const s = goalState(g); return { title: g.title, current: s.cur, target: g.target, due: g.date, status: s.status, pct: s.pct }; }),
    upcoming: lastNDays(7, shiftIso(todayIso(), 7)).flatMap((d) => itemsOn(d).map((i) => `${d} ${i.time || ''} ${i.title}`)).slice(0, 20),
  };
}
const fullSnapshot = (n = 21) => ({ ...snapshot(n), edition2: snapshot2() });

COACH.director = (el) => {
  const pr = priorities(), b = balance(), st = availability(), rd = readiness(), an = doc('aos-coach').analysis;
  const neglected = pr.filter((p) => p.days == null || p.days >= 10);
  el.innerHTML = `<section class="card ai"><div class="card-head"><div><h3>Development Director <span class="ai-badge">AI</span></h3><span class="sub">Strengths, weaknesses, priorities and a plan for this week, from your logs</span></div>${aiOn() ? `<button type="button" class="btn sm primary" data-act="analyze">${an ? 'Re-analyze' : 'Analyze me'}</button>` : ''}</div>
    <div id="an-out">${an ? analysisHtml(an) : aiOn() ? '<p class="muted small">Coach reads your ratings, load, recovery, goals, shooting, handles, finishing, film and games, then explains what to prioritize and why.</p>' : aiUnavailable()}</div></section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Today's status</h3></div><button type="button" class="btn sm" data-act="status">Availability</button></div>
      <div class="row" style="gap:12px;flex-wrap:nowrap">${rd ? ring(rd.score, 100, { size: 84, stroke: 8, color: rd.score >= 70 ? 'var(--good)' : rd.score >= 45 ? 'var(--warn)' : 'var(--danger)', center: `<b>${rd.score}</b>`, label: 'Readiness' }) : ''}<div class="stack" style="gap:6px"><span class="band ${st.status === 'available' ? 'hi' : st.status === 'limited' ? 'mid' : 'lo'}" style="width:max-content">${st.status === 'available' ? 'Available' : st.status === 'limited' ? 'Limited' : 'Out'}${st.area ? ': ' + esc(st.area) : ''}</span>${restAdvice().map(([c, t]) => `<span class="small">${c === 'hi' ? '✅' : c === 'mid' ? '⚠️' : '⛔'} ${esc(t)}</span>`).join('') || '<span class="muted small">Check in for recovery-based adjustments.</span>'}</div></div></section>
    <section class="card"><div class="card-head"><div><h3>Neglected areas</h3><span class="sub">Not trained in 10+ days</span></div></div>${neglected.length ? `<div class="list">${neglected.map((p) => `<div class="li"><span class="t">${p.l}</span><span class="tiny muted">${p.days == null ? 'never logged' : p.days + ' days'}</span></div>`).join('')}</div>` : '<p class="small">Every area was trained in the last 10 days.</p>'}</section>
  </div>
  <section class="card"><div class="card-head"><div><h3>Skill priority calculator</h3><span class="sub">Gap to an 85 rating × importance for a guard × days since trained × your priorities</span></div><button type="button" class="btn sm" data-act="settings">Edit priorities</button></div>
    <div class="list">${pr.map((p, i) => `<div class="li" style="display:block"><div class="row-between"><span class="t">${i + 1}. ${p.l}</span><span class="v">${p.score}</span></div><div class="s">${esc(p.why)}</div>${hbar((p.score / Math.max(1, pr[0].score)) * 100, i < 3 ? '' : 'var(--oth)')}</div>`).join('')}</div></section>
  <section class="card"><div class="card-head"><div><h3>Training balance</h3><span class="sub">Last 28 days vs a suggested in-season guard mix</span></div></div>
    ${b.tot ? `<div class="stack">${CATS.map(([k, l, c]) => { const s = b.share[k], tg = BALANCE_TARGET[k], d = s - tg; return `<div><div class="row-between small"><span>${l} <span class="muted">${fmtDur(b.by[k])}</span></span><span><b>${Math.round(s * 100)}%</b> <span class="muted">/ ${Math.round(tg * 100)}%</span> ${Math.abs(d) >= 0.08 ? `<span class="${d > 0 ? 'flat' : 'down'}">${d > 0 ? 'heavy' : 'light'}</span>` : '<span class="up">✓</span>'}</span></div><div class="bar" style="position:relative"><i style="width:${Math.round(s * 100)}%;background:${c}"></i><span style="position:absolute;left:${Math.round(tg * 100)}%;top:-3px;bottom:-3px;width:2px;background:var(--fg);opacity:.6"></span></div></div>`; }).join('')}</div>
      <p class="small" style="margin-top:10px">${(() => { const lo = CATS.filter(([k]) => b.share[k] < BALANCE_TARGET[k] - 0.08).map(([, l]) => l.toLowerCase()); return lo.length ? `Add more ${lo.join(' and ')} next week.` : 'Balanced. Keep the mix.'; })()}</p>` : emptyState('No training in 28 days', 'Log workouts to see your balance.', 'dumbbell')}</section>`;
};
const analysisHtml = (a) => `<div class="ai-out"><p class="small">${esc(a.summary || '')}</p>
  ${a.strengths?.length ? `<div><h4 class="up">Strengths</h4><ul>${a.strengths.map((x) => `<li class="small">${esc(x)}</li>`).join('')}</ul></div>` : ''}
  ${a.weaknesses?.length ? `<div><h4 class="down">Weaknesses</h4><ul>${a.weaknesses.map((x) => `<li class="small">${esc(x)}</li>`).join('')}</ul></div>` : ''}
  ${a.priorities?.length ? `<div><h4>Priorities</h4><ol style="margin:0;padding-left:18px;display:grid;gap:6px">${a.priorities.map((p) => `<li class="small"><b>${esc(p.area)}</b>: ${esc(p.action)}<br><span class="muted">${esc(p.why)}</span></li>`).join('')}</ol></div>` : ''}
  ${a.recovery?.length ? `<div><h4>Recovery adjustments</h4><ul>${a.recovery.map((x) => `<li class="small">${esc(x)}</li>`).join('')}</ul></div>` : ''}
  ${a.week?.length ? `<div><h4>This week</h4><div class="list">${a.week.map((d) => `<div class="li"><span class="t">${esc(d.day)}</span><span class="small" style="text-align:right">${esc(d.focus)}</span></div>`).join('')}</div></div>` : ''}
  ${a.missing ? `<p class="tiny muted">Missing data: ${esc(a.missing)}</p>` : ''}<p class="tiny muted">Analyzed ${esc(fmtD(a.date))}</p></div>`;
ACTIONS.analyze = async (b) => {
  b.disabled = true; $('#an-out').innerHTML = '<p class="muted small">Your development director is reviewing everything you\'ve logged…</p>';
  try {
    const r = await askAI(`${AI_RULES}\n\nSnapshot:\n${JSON.stringify(fullSnapshot(28))}\n\nAct as the athlete's development director. Use the skill ratings, priority scores, training load, readiness, balance, goals and logs. Explain each recommendation with the data behind it. Return JSON {"summary": string (2-3 sentences), "strengths": [2-3 strings with numbers], "weaknesses": [2-3 strings with numbers], "priorities": [{"area": string, "why": string (cite data), "action": string (specific, this week)}] (3 items), "recovery": [0-3 strings], "week": [{"day": "Mon".."Sun", "focus": string}] (7 items, respect availability and the upcoming calendar), "missing": string}.`);
    const a = { date: todayIso(), summary: String(r.summary || ''), strengths: (r.strengths || []).map(String).slice(0, 4), weaknesses: (r.weaknesses || []).map(String).slice(0, 4), priorities: (r.priorities || []).slice(0, 4).map((p) => ({ area: String(p.area || ''), why: String(p.why || ''), action: String(p.action || '') })), recovery: (r.recovery || []).map(String).slice(0, 4), week: (r.week || []).slice(0, 7).map((d) => ({ day: String(d.day || ''), focus: String(d.focus || '') })), missing: String(r.missing || '') };
    doc('aos-coach').analysis = a; persist('aos-coach'); $('#an-out').innerHTML = analysisHtml(a);
  } catch (e) { $('#an-out').innerHTML = `<p class="small down">${esc(aiError(e))}</p>`; }
  b.disabled = false;
};
ACTIONS.status = () => {
  const s = availability();
  openSheet('Injury and availability', `<div class="scale" id="av">${[['available', 'Available'], ['limited', 'Limited'], ['out', 'Out']].map(([k, l]) => `<button type="button" data-av="${k}" class="${s.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="fields"><label>Area / injury<input id="av-area" maxlength="40" value="${esc(s.area)}" placeholder="Left ankle sprain"></label><label>Expected back<input type="date" id="av-back" value="${s.back || ''}"></label><label class="full">Notes<input id="av-note" maxlength="160" value="${esc(s.note)}" placeholder="Cleared for shooting, no jumping"></label></div>
    <p class="muted tiny">Athlete OS doesn't diagnose injuries. See your trainer or doctor. This status lowers readiness, shows on your profile, and Coach plans around it.</p>
    <button type="button" class="btn primary" id="av-save">Save</button>`, (d) => {
    let cur = s.status; d.addEventListener('click', (e) => { const x = e.target.closest('[data-av]'); if (!x) return; cur = x.dataset.av; $$('[data-av]', d).forEach((y) => y.classList.toggle('on', y === x)); });
    $('#av-save', d).addEventListener('click', () => { const A = aos(); const prev = A.status?.status; A.status = { status: cur, area: cur === 'available' ? '' : $('#av-area', d).value.trim(), note: cur === 'available' ? '' : $('#av-note', d).value.trim(), back: cur === 'available' ? null : $('#av-back', d).value || null, since: cur !== prev ? todayIso() : A.status?.since || todayIso() }; A.statusLog = [...(A.statusLog || []), { date: todayIso(), status: cur, area: A.status.area }].slice(-50); persist('aos'); closeSheet(); toast('Status saved'); refresh(); });
  });
};

// ----- strength & conditioning program generator -----
const PROG_GOALS = [['strength', 'Strength'], ['power', 'Power / vertical'], ['speed', 'Speed & agility'], ['conditioning', 'Conditioning'], ['inseason', 'In-season maintenance']];
const PROG_TPL = {
  strength: [['Lower strength', ['backsq', 'rdl', 'split', 'calf', 'deadbug']], ['Upper strength', ['bench', 'pullup', 'row', 'ohp', 'plank']], ['Total body', ['trapdl', 'dbbench', 'slrdl', 'pushup', 'pallof']]],
  power: [['Jump + lower', ['pogo', 'boxjump', 'trapdl', 'split', 'calf']], ['Upper + core', ['mbslam', 'dbbench', 'pullup', 'row', 'sideplank']], ['Elastic power', ['depth', 'approach', 'broadj', 'gobsq', 'nordic']]],
  speed: [['Acceleration', ['starts', 'broadj', 'split', 'nordic', 'deadbug']], ['Change of direction', ['shuttle', 'slidesprint', 'ladder', 'slrdl', 'sideplank']], ['Top speed + strength', ['starts', 'trapdl', 'calf', 'pallof', 'ankle']]],
  conditioning: [['Court intervals', ['courtsprint', 'slidesprint', 'plank']], ['Tempo + strength', ['tempo', 'gobsq', 'pushup', 'row']], ['Bike + mobility', ['bike', '9090', 'wgs', 'foam']]],
  inseason: [['Lower maintenance', ['trapdl', 'split', 'nordic', 'calf', 'deadbug']], ['Upper + mobility', ['dbbench', 'row', 'pullup', '9090', 'wgs']], ['Power primer', ['pogo', 'boxjump', 'mbslam', 'plank']]],
};
COACH.program = (el) => {
  const g = ui('pGoal', 'power'), wk = ui('pWeeks', '6'), dpw = ui('pDays', '3'), saved = [...(doc('aos-coach').programs || [])].reverse(), cur = saved.find((p) => p.id === ui('prog')) || null;
  el.innerHTML = `<section class="card ai"><div class="card-head"><div><h3>Strength & conditioning program <span class="ai-badge">AI</span></h3><span class="sub">A multi-week plan that fits your schedule, load and test results</span></div></div>
    <div class="stack"><div><p class="muted small" style="margin-bottom:6px">Goal</p><div class="chips">${PROG_GOALS.map(([k, l]) => `<button type="button" class="chip ${k === g ? 'on' : ''}" data-pg="${k}">${l}</button>`).join('')}</div></div>
      <div class="row"><div><p class="muted small" style="margin-bottom:6px">Weeks</p>${seg('pWeeks', [['4', '4'], ['6', '6'], ['8', '8']], wk)}</div><div><p class="muted small" style="margin-bottom:6px">Days per week</p>${seg('pDays', [['2', '2'], ['3', '3'], ['4', '4']], dpw)}</div></div>
      <div class="row"><button type="button" class="btn primary" style="flex:1" data-act="gen-program" ${aiOn() ? '' : 'disabled'}>Generate with AI</button><button type="button" class="btn" data-act="tpl-program">Built-in template</button></div>${aiOn() ? '' : aiUnavailable()}</div></section>
  <section class="card" id="prog-out" ${cur ? '' : 'hidden'}>${cur ? programHtml(cur, true) : ''}</section>
  <section class="card"><div class="card-head"><div><h3>Saved programs</h3></div></div>${saved.length ? `<div class="list">${saved.map((p) => `<button type="button" class="li li-btn" data-prog="${p.id}"><div><div class="t">${esc(p.title)}</div><div class="s">${p.weeks.length} weeks · ${esc(p.source === 'ai' ? 'AI' : 'Template')} · ${esc(fmtD(p.date))}${p.scheduled ? ' · on calendar' : ''}</div></div><span class="muted">›</span></button>`).join('')}</div>` : '<p class="muted small">Programs you save show up here.</p>'}</section>`;
};
document.addEventListener('click', (e) => { const g = e.target.closest('[data-pg]'); if (g) { setUi('pGoal', g.dataset.pg); return refresh(); } const p = e.target.closest('[data-prog]'); if (p) { setUi('prog', p.dataset.prog); refresh(); $('#prog-out')?.scrollIntoView({ behavior: 'smooth' }); } });
let draftProgram = null;
function programHtml(p, saved) {
  return `<div class="card-head"><div><h3>${esc(p.title)}</h3><span class="sub">${p.weeks.length} weeks · ${p.days} days/week · ${p.source === 'ai' ? '<span class="ai-badge">AI</span>' : 'Built-in template'}</span></div></div>
    ${p.overview ? `<p class="small">${esc(p.overview)}</p>` : ''}
    ${p.weeks.map((w, wi) => `<details ${wi === 0 ? 'open' : ''} style="margin-top:10px"><summary style="cursor:pointer"><b>Week ${w.week}</b> <span class="muted small">· ${esc(w.focus || '')}</span></summary>${(w.days || []).map((d) => `<h4 style="margin:10px 0 4px">${esc(d.name)}</h4>${(d.exercises || []).map((x) => `<div class="ex"><span class="n">${esc(x.name)}</span><span class="d">${esc(x.sets ? `${x.sets} x ${x.reps}` : x.reps || '')}</span>${x.load || x.rest ? `<span class="c">${x.load ? esc(x.load) + '. ' : ''}${x.rest ? 'Rest ' + esc(x.rest) : ''}</span>` : ''}</div>`).join('')}`).join('')}</details>`).join('')}
    ${p.progression ? `<p class="notice" style="margin-top:12px">${esc(p.progression)}</p>` : ''}
    <div class="row" style="margin-top:12px">${saved ? '' : '<button type="button" class="btn" data-act="save-program">Save</button>'}<button type="button" class="btn primary" data-act="sched-program" ${saved ? `data-id="${p.id}"` : ''}>Put it on my calendar</button>${saved ? `<button type="button" class="btn danger" data-act="del-program" data-id="${p.id}">Delete</button>` : ''}</div>`;
}
function showProgram(p, saved) { draftProgram = p; const o = $('#prog-out'); o.hidden = false; o.innerHTML = programHtml(p, saved); o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
ACTIONS['gen-program'] = async (b) => {
  const g = ui('pGoal', 'power'), wk = Number(ui('pWeeks', '6')), dpw = Number(ui('pDays', '3'));
  b.disabled = true; b.textContent = 'Building your program…';
  try {
    const r = await askAI(`${AI_RULES}\n\nSnapshot:\n${JSON.stringify(fullSnapshot(28))}\n\nDesign a ${wk}-week ${PROG_GOALS.find((x) => x[0] === g)[1]} strength and conditioning program, ${dpw} sessions per week, for a high-school basketball guard. Fit it around the practices and games on the calendar, the current training load (ACWR) and availability/injury status. Use tested maxes only if present (otherwise RPE). Age-appropriate, technique first, progressive overload, a deload in the last week of each 3-4 week block. Exercises can come from: ${EXERCISES.map((x) => x[1]).join(', ')}.
Return JSON {"title": string, "overview": string, "weeks": [{"week": number, "focus": string, "days": [{"name": string, "exercises": [{"name": string, "sets": number, "reps": string, "load": string, "rest": string}]}]}], "progression": string (how to progress and when to re-test, with which tests)}.`);
    showProgram({ title: String(r.title || 'Program'), overview: String(r.overview || ''), weeks: (r.weeks || []).slice(0, 12), progression: String(r.progression || ''), days: dpw, goal: g, source: 'ai', date: todayIso() });
  } catch (e) { toast(aiError(e)); }
  b.disabled = false; b.textContent = 'Generate with AI';
};
ACTIONS['tpl-program'] = () => {
  const g = ui('pGoal', 'power'), wk = Number(ui('pWeeks', '6')), dpw = Number(ui('pDays', '3')), T = PROG_TPL[g];
  const weeks = [];
  for (let w = 1; w <= wk; w++) {
    const deload = w % 4 === 0 || (w === wk && wk >= 6), sets = deload ? 2 : w <= 2 ? 3 : 4;
    weeks.push({ week: w, focus: deload ? 'Deload: lighter, crisp technique' : w <= 2 ? 'Learn the movements (RPE 6-7)' : 'Build (RPE 7-8)', days: T.slice(0, dpw).concat(dpw > T.length ? [T[0]] : []).slice(0, dpw).map(([name, ids]) => ({ name, exercises: ids.map((id) => { const x = EXERCISES.find((e) => e[0] === id); return { name: x[1], sets, reps: x[4].replace(/^\d+ x /, ''), load: deload ? 'RPE 6' : w <= 2 ? 'RPE 6-7' : 'RPE 7-8', rest: x[2] === 'Power' ? '90 s' : x[2] === 'Mobility' ? '' : '60-120 s' }; }) })) });
  }
  showProgram({ title: `${PROG_GOALS.find((x) => x[0] === g)[1]} · ${wk} weeks`, overview: 'Built-in template: proven structure, not personalized to your data. Use AI inside Claude for a program built around your calendar, load and tests.', weeks, progression: 'Add a little weight or a rep when the last set feels RPE 7 or easier. Re-test vertical, sprint or lifts in the week after the program ends.', days: dpw, goal: g, source: 'template', date: todayIso() });
};
ACTIONS['save-program'] = () => { if (!draftProgram) return; const p = { ...draftProgram, id: uid('pg') }; const C = doc('aos-coach'); C.programs = [...(C.programs || []), p].slice(-20); persist('aos-coach'); setUi('prog', p.id); toast('Program saved'); refresh(); };
ACTIONS['del-program'] = (b) => confirmSheet('Delete this program?', 'Delete', () => { const C = doc('aos-coach'); C.programs = (C.programs || []).filter((x) => x.id !== b.dataset.id); persist('aos-coach'); setUi('prog', null); refresh(); });
ACTIONS['sched-program'] = (b) => {
  let p = b.dataset.id ? (doc('aos-coach').programs || []).find((x) => x.id === b.dataset.id) : draftProgram; if (!p) return;
  const def = { 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5] }[p.days] || [1, 3, 5];
  openSheet('Schedule program', `<p class="muted small">Pick the days. Each becomes a weekly recurring Weights event for ${p.weeks.length} weeks.</p><div class="chips" id="sp-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="chip ${def.includes(d) ? 'on' : ''}" data-dow="${d}">${DOW[d]}</button>`).join('')}</div>
    <div class="fields"><label>Start<input type="date" id="sp-start" value="${shiftIso(mondayOf(todayIso()), 7)}"></label><label>Time<input type="time" id="sp-time" value="06:45"></label></div><button type="button" class="btn primary" id="sp-save">Add to calendar</button>`, (d) => {
    $('#sp-days', d).addEventListener('click', (e) => { const c = e.target.closest('[data-dow]'); if (c) c.classList.toggle('on'); });
    $('#sp-save', d).addEventListener('click', () => {
      const days = $$('[data-dow].on', d).map((x) => Number(x.dataset.dow)); if (!days.length) return toast('Pick at least one day');
      if (!p.id) { p = { ...p, id: uid('pg') }; const C = doc('aos-coach'); C.programs = [...(C.programs || []), p]; draftProgram = p; }
      const start = $('#sp-start', d).value || todayIso();
      plan().events = [...(plan().events || []), { id: uid('e'), title: p.title.slice(0, 50), type: 'lift', date: start, start: $('#sp-time', d).value || null, mins: 60, notes: 'From your S&C program', recur: { days, until: shiftIso(start, p.weeks.length * 7 - 1) }, skip: [], program: p.id }];
      p.scheduled = true; persist('aos-plan'); persist('aos-coach'); closeSheet(); toast('Program added to your calendar'); refresh();
    });
  });
};

// ----- personalized development plan -----
COACH.devplan = (el) => {
  const dp = doc('aos-coach').devplan, pr = priorities().slice(0, 3);
  el.innerHTML = `<section class="card ai"><div class="card-head"><div><h3>Development plan <span class="ai-badge">AI</span></h3><span class="sub">An 8-week roadmap built from your priorities, ratings and goals</span></div><div class="row">${aiOn() ? `<button type="button" class="btn sm primary" data-act="gen-devplan">${dp?.source === 'ai' ? 'Rebuild' : 'Build with AI'}</button>` : ''}<button type="button" class="btn sm" data-act="rule-devplan">From my priorities</button></div></div>
    <div id="dp-out">${dp ? devplanHtml(dp) : `<p class="muted small">Your top priorities right now: ${pr.map((p) => `<b>${p.l}</b>`).join(', ')}. Build a plan to turn them into weekly work.</p>${aiOn() ? '' : aiUnavailable()}`}</div></section>`;
};
const devplanHtml = (p) => `<div class="ai-out"><p class="small">${esc(p.summary)}</p><p class="tiny muted">${p.source === 'ai' ? 'AI plan' : 'Built from your priority ranking (no AI)'} · ${esc(fmtD(p.date))}</p>
  ${p.phases.map((ph) => `<div class="notice"><b style="color:var(--fg)">${esc(ph.name)}</b> <span class="tiny">${esc(ph.weeks)}</span><ul style="margin-top:6px">${ph.focus.map((f) => `<li class="small">${esc(f)}</li>`).join('')}</ul></div>`).join('')}
  ${p.weekly?.length ? `<h4>Weekly structure</h4><div class="list">${p.weekly.map((w) => `<div class="li"><span class="t">${esc(w.day)}</span><span class="small" style="text-align:right">${esc(w.work)}</span></div>`).join('')}</div>` : ''}
  ${p.kpis?.length ? `<h4>Track these</h4><div class="list">${p.kpis.map((k, i) => `<div class="li"><span class="small">${esc(k.metric)}: ${esc(String(k.target))}</span>${k.source ? `<button type="button" class="chip" data-act="kpi-goal" data-i="${i}">Make it a goal</button>` : ''}</div>`).join('')}</div>` : ''}</div>`;
ACTIONS['rule-devplan'] = () => {
  const pr = priorities().slice(0, 3), b = balance(), r = skillRatings();
  const work = { shooting: 'Shooting: 300+ shots, track by spot', handles: 'Ball handling: 25 min, 40% weak hand', finishing: 'Finishing: 60 reps both hands, contact', iq: 'Film: 30 min with PnR read tracking', athleticism: 'Speed + plyos: 30 min', strength: 'Lift: 45-60 min', conditioning: 'Conditioning intervals: 25 min', impact: 'Game review: box score + 3 clips' };
  const plan = { source: 'rules', date: todayIso(), summary: `Your top priorities are ${pr.map((p) => p.l.toLowerCase()).join(', ')} (from the priority calculator: rating gaps, guard importance and days since trained). This plan gives them the most sessions while keeping strength and recovery in the week.`,
    phases: [{ name: 'Phase 1: Build the base', weeks: 'Weeks 1-3', focus: pr.map((p) => `${p.l}: ${work[p.k]}, 3x per week`) }, { name: 'Phase 2: Add game speed', weeks: 'Weeks 4-6', focus: pr.map((p) => `${p.l}: same volume at game speed, add pressure or a defender`) }, { name: 'Phase 3: Test and adjust', weeks: 'Weeks 7-8', focus: ['Re-test the metrics below', 'Lower volume ~30% in week 8 before re-testing', 'Rebuild the plan from the new ratings'] }],
    weekly: [['Mon', `${pr[0]?.l || 'Skill'} + lift`], ['Tue', `${pr[1]?.l || 'Skill'} + film`], ['Wed', `${pr[0]?.l || 'Skill'} + conditioning`], ['Thu', `${pr[2]?.l || 'Skill'} + lift`], ['Fri', `${pr[1]?.l || 'Skill'}`], ['Sat', 'Game / scrimmage or full workout'], ['Sun', 'Rest + recovery']].map(([day, w]) => ({ day, work: w })),
    kpis: pr.map((p) => ({ metric: p.l, target: r[p.k] ? `rating ${Math.min(99, r[p.k].v + 5)}` : 'get a first rating', source: { shooting: 'shoot:pct', handles: null, finishing: null, iq: 'film:mins30', athleticism: 'test:vert', strength: 'test:squat', conditioning: 'test:mile', impact: 'game:ppg' }[p.k] })) };
  if (b.share.strength < 0.12) plan.weekly[0].work += ' (you are light on strength)';
  doc('aos-coach').devplan = plan; persist('aos-coach'); refresh();
};
ACTIONS['gen-devplan'] = async (b) => {
  b.disabled = true; $('#dp-out').innerHTML = '<p class="muted small">Building your development plan…</p>';
  try {
    const r = await askAI(`${AI_RULES}\n\nSnapshot:\n${JSON.stringify(fullSnapshot(28))}\n\nBuild an 8-week personalized development plan from the priorities, ratings, goals, availability and calendar. Explain the reasoning with data in the summary. Return JSON {"summary": string, "phases": [{"name": string, "weeks": string, "focus": [2-4 strings]}] (3 phases), "weekly": [{"day": "Mon".."Sun", "work": string}] (7), "kpis": [{"metric": string, "target": string, "source": one of ${JSON.stringify(GOAL_SOURCES.map((x) => x[0]))} or null}] (3-5)}.`);
    const p = { source: 'ai', date: todayIso(), summary: String(r.summary || ''), phases: (r.phases || []).slice(0, 4).map((x) => ({ name: String(x.name || ''), weeks: String(x.weeks || ''), focus: (x.focus || []).map(String).slice(0, 5) })), weekly: (r.weekly || []).slice(0, 7).map((x) => ({ day: String(x.day || ''), work: String(x.work || '') })), kpis: (r.kpis || []).slice(0, 6).map((k) => ({ metric: String(k.metric || ''), target: String(k.target || ''), source: GOAL_SOURCES.some((x) => x[0] === k.source) ? k.source : null })) };
    doc('aos-coach').devplan = p; persist('aos-coach'); $('#dp-out').innerHTML = devplanHtml(p);
  } catch (e) { $('#dp-out').innerHTML = `<p class="small down">${esc(aiError(e))}</p>`; }
  b.disabled = false;
};
ACTIONS['kpi-goal'] = (b) => { const k = doc('aos-coach').devplan?.kpis?.[Number(b.dataset.i)]; if (!k) return; const cur = k.source ? sourceValue(k.source) : null, meta = GOAL_SOURCES.find((x) => x[0] === k.source); openSheet('Create goal', `<p class="small">${esc(k.metric)}: ${esc(k.target)}${cur != null ? ` · current ${cur}` : ''}</p><label>Target value<input id="kg-t" inputmode="decimal"></label><label>By<input type="date" id="kg-d" value="${shiftIso(todayIso(), 56)}"></label><button type="button" class="btn primary" id="kg-s">Create</button>`, (d) => $('#kg-s', d).addEventListener('click', () => { const t = Number($('#kg-t', d).value); if (!Number.isFinite(t) || $('#kg-t', d).value === '') return toast('Enter a target'); doc('aos-goals').goals = [...goals(), { id: uid('goal'), title: k.metric.slice(0, 60), horizon: 'monthly', date: $('#kg-d', d).value, source: k.source, start: cur ?? 0, target: t, unit: meta?.[2] || '', better: meta?.[3] || 'higher', milestones: [], created: Date.now(), history: [] }]; persist('aos-goals'); closeSheet(); toast('Goal created'); })); };
