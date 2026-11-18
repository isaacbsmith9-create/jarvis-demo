// ===================== DAILY ROUTINE BUILDER =====================
// A routine = category + ordered steps (title, minutes, description) + a schedule (weekdays, game days or training days).
// Each day it appears on the calendar as one block; step-by-step completion is stored per date.
const ROUTINE_CATS = [['morning', 'Morning', '#ffc23d'], ['pre', 'Pre-workout', 'var(--accent)'], ['post', 'Post-workout', 'var(--good)'], ['pregame', 'Pregame', '#ff6a3d'], ['postgame', 'Postgame', '#f472b6'], ['evening', 'Evening', '#8b5cff'], ['recovery', 'Recovery', 'var(--cond)']];
const rcat = (k) => ROUTINE_CATS.find((x) => x[0] === k) || ROUTINE_CATS[0];
const ROUTINE_TEMPLATES = {
  morning: [['Wake up', 1, 'Same time every day, even on weekends.'], ['Hydration', 2, '16-20 oz of water before anything else.'], ['Mobility', 8, 'Hips, ankles, T-spine. World\'s greatest stretch, ankle rocks.'], ['Breakfast', 15, 'Protein + carbs: eggs, oats, fruit, milk.'], ['Mental preparation', 3, 'Three slow breaths. Picture one thing you\'ll do well today.'], ['Review daily goals', 2, 'Read your top 3 for today.']],
  pre: [['Snack + water', 5, 'Easy carbs 30-60 min before: banana, granola bar, 12-16 oz water.'], ['Dynamic warm-up', 8, 'Skips, lunges, leg swings, lateral shuffles.'], ['Activation', 4, 'Glute bridges, band walks, pogo hops.'], ['Set an intention', 1, 'One focus for this session.']],
  post: [['Cool-down', 5, 'Easy jog or bike, then walk.'], ['Stretch', 8, 'Hips, hamstrings, calves, shoulders.'], ['Recovery fuel', 5, '20-30 g protein + carbs within an hour.'], ['Log the session', 2, 'RPE, notes, how it felt.']],
  pregame: [['Pregame meal', 20, '3-4 hours before tip: carbs, lean protein, low fat.'], ['Hydrate', 2, '16-20 oz over the two hours before.'], ['Visualization', 5, 'See your first three possessions. Feel the ball leave your hand.'], ['Dynamic warm-up', 10, 'Full-court movement, defensive slides, sprints.'], ['Form shooting', 8, 'Close to the rim, then step back.'], ['Focus cue', 1, 'Pick one word for tonight.']],
  postgame: [['Refuel', 10, 'Protein + carbs within an hour.'], ['Cool-down + stretch', 10, 'Let the heart rate come down.'], ['Reflection', 5, 'One win, one lesson, one thing to work on.'], ['Screens off', 1, 'Wind down for sleep.']],
  evening: [['Prep tomorrow', 5, 'Bag, clothes, water bottle.'], ['Stretch or foam roll', 10, 'Easy, slow.'], ['Journal', 5, 'Three things from today.'], ['Screens off', 1, '30-60 min before bed.'], ['Lights out', 1, 'Aim for 8-10 hours.']],
  recovery: [['Easy movement', 15, 'Walk or easy bike.'], ['Mobility flow', 12, 'Hips, ankles, thoracic spine.'], ['Foam roll', 8, 'Quads, calves, back.'], ['Breathing', 5, 'Box breathing 4-4-4-4.']],
};
/** Upgrade routines saved by Edition 2 (time + title items) into step lists. */
function normRoutine(r) {
  if (r.steps) return r;
  return { ...r, cat: r.cat || 'morning', start: r.items?.find((i) => i.time)?.time || null, when: 'days', steps: (r.items || []).map((i) => ({ title: i.title, mins: 5, desc: '' })) };
}
const routines = () => (plan().routines || []).map(normRoutine);
const routineMins = (r) => sum(r.steps.map((s) => Number(s.mins) || 0));
function routineScheduled(r, date) {
  if (r.paused) return false;
  if (r.when === 'game') return itemsOnBase(date).some((x) => x.type === 'game') || games().some((g) => g.date === date);
  if (r.when === 'training') return exList(date).length > 0 || itemsOnBase(date).some((x) => evType(x.type)[3]);
  return (r.days || []).includes(parseIso(date).getDay());
}
// Events only (no routines), so routine scheduling doesn't recurse.
const itemsOnBase = (date) => (plan().events || []).filter((e) => occursOn(e, date)).map((e) => ({ type: e.type }));
const routinesOn = (date) => routines().filter((r) => routineScheduled(r, date));
const rlog = () => (plan().rlog = plan().rlog || {});
const routineState = (date, id) => rlog()[date]?.[id] || null;
function routineComplete(date, id) { const s = routineState(date, id), r = routines().find((x) => x.id === id); return !!(s && r && s.done?.length >= r.steps.length && s.done.slice(0, r.steps.length).every(Boolean)); }
function setStep(date, id, i, v) { const L = rlog(); L[date] = { ...(L[date] || {}) }; const s = L[date][id] || { done: [] }; s.done = [...(s.done || [])]; s.done[i] = !!v; s.at = Date.now(); L[date][id] = s; persist('aos-plan'); }
function setRoutineAll(date, id, v) { const r = routines().find((x) => x.id === id); if (!r) return; const L = rlog(); L[date] = { ...(L[date] || {}) }; L[date][id] = { done: r.steps.map(() => !!v), at: Date.now() }; persist('aos-plan'); }
const stepsDone = (date, r) => (routineState(date, r.id)?.done || []).slice(0, r.steps.length).filter(Boolean).length;
function routineStats(r, days = 28) {
  const ds = lastNDays(days).filter((d) => d <= todayIso() && routineScheduled(r, d) && d >= (r.created ? isoDate(new Date(r.created)) : '0'));
  const full = ds.filter((d) => routineComplete(d, r.id)).length, stepsTot = ds.length * r.steps.length, stepsHit = sum(ds.map((d) => stepsDone(d, r)));
  let streak = 0; for (const d of [...ds].reverse()) { if (routineComplete(d, r.id)) streak++; else if (d !== todayIso()) break; }
  const miss = r.steps.map((s, i) => ({ s, i, missed: ds.filter((d) => d < todayIso() && !(routineState(d, r.id)?.done || [])[i]).length }));
  return { sched: ds.length, full, pct: ds.length ? full / ds.length : null, stepPct: stepsTot ? stepsHit / stepsTot : null, streak, miss };
}
/** Share of today's scheduled routine steps completed, for any date (null if nothing scheduled). */
function routineDayPct(date) { const rs = routinesOn(date); if (!rs.length) return null; const tot = sum(rs.map((r) => r.steps.length)); return tot ? sum(rs.map((r) => stepsDone(date, r))) / tot : null; }

TRAIN.routines = (el) => {
  const rs = routines(), today = todayIso(), todays = routinesOn(today);
  const wk = []; for (let i = 7; i >= 0; i--) { const m = shiftIso(mondayOf(today), -7 * i), ps = lastNDays(7, shiftIso(m, 6)).filter((d) => d <= today).map(routineDayPct).filter((x) => x != null); wk.push({ label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: [{ v: ps.length ? Math.round(mean(ps) * 100) : 0, color: 'var(--good)' }], tip: ps.length ? `${Math.round(mean(ps) * 100)}% of routine steps done` : 'nothing scheduled' }); }
  const stats = rs.map((r) => ({ r, ...routineStats(r) })).filter((x) => x.sched);
  const daily7 = lastNDays(7).map(routineDayPct).filter((x) => x != null);
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Today's routines</h3><span class="sub">${todays.length ? `${todays.filter((r) => routineComplete(today, r.id)).length} of ${todays.length} complete` : 'None scheduled today'}</span></div><button type="button" class="btn sm primary" data-act="routine">＋ Routine</button></div>
    ${todays.length ? todays.map((r) => { const n = stepsDone(today, r); return `<div class="rt-card" style="--c:${rcat(r.cat)[2]}"><div class="row-between"><div><span class="tiny" style="color:${rcat(r.cat)[2]};font-weight:700;text-transform:uppercase;letter-spacing:.06em">${rcat(r.cat)[1]}${r.start ? ' · ' + fmtClock(r.start) : ''}</span><div class="t">${esc(r.name)}</div><div class="s">${r.steps.length} steps · ${fmtDur(routineMins(r))}</div></div><div class="row"><button type="button" class="btn sm primary" data-act="run-routine" data-id="${r.id}" data-date="${today}">▶ ${n ? 'Resume' : 'Start'}</button></div></div>
      ${hbar((n / r.steps.length) * 100, 'var(--good)')}<div class="list" style="margin-top:6px">${r.steps.map((s, i) => `<label class="li check"><input type="checkbox" data-step="${today}|${r.id}|${i}" ${(routineState(today, r.id)?.done || [])[i] ? 'checked' : ''}><span style="flex:1;min-width:0"><span class="t">${esc(s.title)}</span> <span class="tiny muted">${s.mins} min</span></span></label>`).join('')}</div></div>`; }).join('') : emptyState(rs.length ? 'Nothing scheduled today' : 'Build your first routine', rs.length ? 'Your routines run on other days. Start one anyway from the list below.' : 'Start from a template (morning, pregame, evening…) and adjust the steps, times and days.', 'calendar', rs.length ? '' : '<button type="button" class="btn sm primary" data-act="routine">Build a routine</button>')}</section>
  ${rs.length ? `<div class="grid two"><section class="card"><div class="card-head"><div><h3>Routine consistency</h3><span class="sub">Share of scheduled steps completed</span></div></div>
      <div class="kpis"><div class="kpi"><small>Last 7 days</small><b>${daily7.length ? Math.round(mean(daily7) * 100) + '%' : '—'}</b></div><div class="kpi"><small>Best streak now</small><b>${Math.max(0, ...stats.map((x) => x.streak))}</b><span class="tiny muted">days fully complete</span></div></div>
      <div class="chart" id="rt-wk" style="margin-top:10px"></div></section>
    <section class="card"><div class="card-head"><div><h3>Habit heatmap</h3><span class="sub">Daily routine completion · 16 weeks</span></div></div>${heatmap(16, (d) => { const p = routineDayPct(d); return p == null || p === 0 ? 0 : p < 0.34 ? 1 : p < 0.67 ? 2 : p < 1 ? 3 : 4; }, null, (d) => { const p = routineDayPct(d); return p == null ? 'nothing scheduled' : Math.round(p * 100) + '% done'; })}<p class="muted tiny" style="margin-top:6px">Purple = every scheduled step done.</p></section></div>
  <section class="card"><div class="card-head"><div><h3>Your routines</h3><span class="sub">Most consistent first · last 28 days</span></div></div><div class="list">${[...rs].sort((a, b) => (routineStats(b).pct ?? -1) - (routineStats(a).pct ?? -1)).map((r) => { const st = routineStats(r), worst = [...st.miss].sort((a, b) => b.missed - a.missed)[0]; return `<div class="li" style="align-items:flex-start"><div style="min-width:0;flex:1"><div class="row-between"><span class="t"><span class="dot" style="background:${rcat(r.cat)[2]};margin-right:6px"></span>${esc(r.name)}${r.paused ? ' <span class="tag">paused</span>' : ''}</span><b class="num">${st.pct == null ? '—' : pctTxt(st.pct)}</b></div>
      <div class="s">${rcat(r.cat)[1]} · ${r.when === 'game' ? 'game days' : r.when === 'training' ? 'training days' : (r.days || []).map((d) => DOW[d]).join(', ') || 'no days'}${r.start ? ' · ' + fmtClock(r.start) : ''} · ${r.steps.length} steps, ${fmtDur(routineMins(r))} · streak ${st.streak}</div>
      ${st.pct != null ? hbar(st.pct * 100, rcat(r.cat)[2]) : ''}${worst?.missed ? `<div class="s" style="margin-top:3px">Most missed step: <b>${esc(worst.s.title)}</b> (${worst.missed}×)</div>` : ''}</div>
      <div class="row" style="margin-left:8px"><button type="button" class="chip" data-act="run-routine" data-id="${r.id}" data-date="${today}">▶</button><button type="button" class="chip" data-act="routine" data-id="${r.id}">Edit</button></div></div>`; }).join('')}</div></section>` : ''}`;
  if (rs.length) drawBars($('#rt-wk'), wk, { fmt: (v) => v + '%', tick: (v) => v + '%', h: 150 });
};
document.addEventListener('change', (e) => { const c = e.target.closest('[data-step]'); if (!c) return; const [d, id, i] = c.dataset.step.split('|'); setStep(d, id, Number(i), c.checked); if (routineComplete(d, id)) toast('Routine complete ✓'); refresh(); });

ACTIONS.routine = (b) => {
  const r0 = b.dataset.id ? routines().find((x) => x.id === b.dataset.id) : null;
  let steps = r0 ? r0.steps.map((s) => ({ ...s })) : ROUTINE_TEMPLATES.morning.map(([title, mins, desc]) => ({ title, mins, desc }));
  const draw = (d) => { $('#rt-steps', d).innerHTML = steps.map((s, i) => `<div class="rt-step"><span class="rt-n">${i + 1}</span><div class="stack" style="gap:4px;flex:1;min-width:0"><div class="row" style="flex-wrap:nowrap"><input data-sf="title" data-i="${i}" value="${esc(s.title)}" maxlength="40" placeholder="Step"><input type="number" data-sf="mins" data-i="${i}" value="${s.mins}" min="1" max="120" style="width:74px" aria-label="Minutes"></div><input data-sf="desc" data-i="${i}" value="${esc(s.desc || '')}" maxlength="140" placeholder="Description (optional)" style="font-size:14px;padding:7px 10px"></div><div class="stack" style="gap:2px"><button type="button" class="chip" data-mv="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" class="chip" data-mv="1" data-i="${i}" ${i === steps.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button type="button" class="chip" data-rm="${i}" aria-label="Remove">✕</button></div></div>`).join(''); $('#rt-total', d).textContent = `${steps.length} steps · ${fmtDur(sum(steps.map((s) => Number(s.mins) || 0)))}`; };
  const when = r0?.when || 'days';
  openSheet(r0 ? 'Edit routine' : 'New routine', `<div class="fields"><label class="full">Name<input id="rt-name" maxlength="40" value="${esc(r0?.name || 'Morning routine')}"></label>
    <label>Category<select id="rt-cat">${ROUTINE_CATS.map(([k, l]) => `<option value="${k}" ${(r0?.cat || 'morning') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Start time<input type="time" id="rt-start" value="${r0?.start || '07:00'}"></label>
    <label class="full">Runs on<select id="rt-when"><option value="days" ${when === 'days' ? 'selected' : ''}>Days I pick</option><option value="game" ${when === 'game' ? 'selected' : ''}>Game days (from calendar/games)</option><option value="training" ${when === 'training' ? 'selected' : ''}>Training days (calendar or logged)</option></select></label></div>
    <div id="rt-dayrow"><div class="chips" id="rt-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="chip ${(r0?.days || [1, 2, 3, 4, 5]).includes(d) ? 'on' : ''}" data-dow="${d}">${DOW[d]}</button>`).join('')}</div></div>
    ${r0 ? '' : `<div><p class="muted small" style="margin-bottom:6px">Start from a template</p><div class="chips">${ROUTINE_CATS.map(([k, l]) => `<button type="button" class="chip" data-tpl="${k}">${l}</button>`).join('')}</div></div>`}
    <div class="row-between"><b>Steps</b><span class="muted small" id="rt-total"></span></div><div class="stack" id="rt-steps"></div><button type="button" class="btn sm" id="rt-add">＋ Add step</button>
    ${r0 ? `<label class="check"><input type="checkbox" id="rt-pause" ${r0.paused ? 'checked' : ''}> Pause this routine</label>` : ''}
    <div class="row"><button type="button" class="btn primary" id="rt-save" style="flex:1">Save routine</button>${r0 ? '<button type="button" class="btn danger" id="rt-del">Delete</button>' : ''}</div>`, (d) => {
    draw(d);
    const syncWhen = () => { $('#rt-dayrow', d).hidden = $('#rt-when', d).value !== 'days'; }; syncWhen(); $('#rt-when', d).addEventListener('change', syncWhen);
    d.addEventListener('input', (e) => { const f = e.target.closest('[data-sf]'); if (!f) return; const s = steps[Number(f.dataset.i)]; s[f.dataset.sf] = f.dataset.sf === 'mins' ? Number(f.value) || 1 : f.value; if (f.dataset.sf === 'mins') $('#rt-total', d).textContent = `${steps.length} steps · ${fmtDur(sum(steps.map((x) => Number(x.mins) || 0)))}`; });
    d.addEventListener('click', (e) => {
      const day = e.target.closest('[data-dow]'); if (day) day.classList.toggle('on');
      const t = e.target.closest('[data-tpl]'); if (t) { steps = ROUTINE_TEMPLATES[t.dataset.tpl].map(([title, mins, desc]) => ({ title, mins, desc })); $('#rt-cat', d).value = t.dataset.tpl; $('#rt-name', d).value = rcat(t.dataset.tpl)[1] + ' routine'; if (t.dataset.tpl === 'pregame' || t.dataset.tpl === 'postgame') { $('#rt-when', d).value = 'game'; syncWhen(); } draw(d); }
      const mv = e.target.closest('[data-mv]'); if (mv) { const i = Number(mv.dataset.i), j = i + Number(mv.dataset.mv); [steps[i], steps[j]] = [steps[j], steps[i]]; draw(d); }
      const rm = e.target.closest('[data-rm]'); if (rm) { steps.splice(Number(rm.dataset.rm), 1); draw(d); }
    });
    $('#rt-add', d).addEventListener('click', () => { steps.push({ title: '', mins: 5, desc: '' }); draw(d); $$('[data-sf="title"]', d).pop()?.focus(); });
    $('#rt-save', d).addEventListener('click', () => {
      const clean = steps.map((s) => ({ title: String(s.title).trim(), mins: clamp(Math.round(Number(s.mins) || 1), 1, 120), desc: String(s.desc || '').trim() })).filter((s) => s.title);
      if (!clean.length) return toast('Add at least one step');
      const w = $('#rt-when', d).value, days = $$('#rt-days [data-dow].on', d).map((x) => Number(x.dataset.dow));
      if (w === 'days' && !days.length) return toast('Pick at least one day');
      const rec = { id: r0?.id || uid('rt'), name: $('#rt-name', d).value.trim() || 'Routine', cat: $('#rt-cat', d).value, start: $('#rt-start', d).value || null, when: w, days, steps: clean, created: r0?.created || Date.now(), paused: $('#rt-pause', d)?.checked || false };
      plan().routines = [...(plan().routines || []).filter((x) => x.id !== rec.id), rec]; persist('aos-plan'); closeSheet(); toast('Routine saved'); refresh();
    });
    $('#rt-del', d)?.addEventListener('click', () => confirmSheet('Delete this routine and its history?', 'Delete', () => { plan().routines = plan().routines.filter((x) => x.id !== r0.id); persist('aos-plan'); refresh(); }));
  });
};

// ----- guided player: routine timer (also used by mental training exercises) -----
/** steps: [{title, mins|secs, desc}] ; o: {title, sub, color, startAt, onStep(i, done), onFinish()} */
function runPlayer(steps, o = {}) {
  let i = o.startAt || 0, left = 0, timer = null, paused = false;
  const secsOf = (s) => (s.secs ?? (Number(s.mins) || 1) * 60);
  const d = $('#sheet');
  const tick = () => { if (paused) return; left = Math.max(0, left - 1); paint(); if (left === 0) { clearInterval(timer); timer = null; if (navigator.vibrate) navigator.vibrate([60, 40, 60]); $('#pl-next', d)?.classList.add('pulse'); } };
  const start = () => { left = secsOf(steps[i]); paused = false; clearInterval(timer); timer = setInterval(tick, 1000); draw(); };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const paint = () => { const tot = secsOf(steps[i]), f = tot ? 1 - left / tot : 1, c = 2 * Math.PI * 88; const ring = $('#pl-ring', d); if (ring) ring.style.strokeDashoffset = String(c * (1 - f)); const t = $('#pl-time', d); if (t) t.textContent = fmt(left); };
  const draw = () => {
    const s = steps[i], c = 2 * Math.PI * 88;
    d.innerHTML = `<div class="sheet-in player" style="--c:${o.color || 'var(--accent)'}"><div class="sheet-head"><div><span class="tiny muted" style="text-transform:uppercase;letter-spacing:.08em">${esc(o.sub || '')}</span><h3>${esc(o.title || 'Routine')}</h3></div><button type="button" class="icon-btn" id="pl-x" aria-label="Close">✕</button></div>
      <div class="pl-dots">${steps.map((_, k) => `<span class="${k < i ? 'done' : k === i ? 'on' : ''}"></span>`).join('')}</div>
      <p class="muted small" style="text-align:center">Step ${i + 1} of ${steps.length}</p>
      <div class="pl-ring"><svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true"><circle cx="100" cy="100" r="88" fill="none" stroke="var(--surface-2)" stroke-width="12"/><circle id="pl-ring" cx="100" cy="100" r="88" fill="none" stroke="var(--c)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${r1(c)}" stroke-dashoffset="${r1(c)}" transform="rotate(-90 100 100)" style="transition:stroke-dashoffset 1s linear;filter:drop-shadow(0 0 6px var(--c))"/></svg><div class="pl-center"><b id="pl-time" class="num">${fmt(left)}</b></div></div>
      <h2 style="text-align:center;font-size:24px">${esc(s.title)}</h2>${s.desc ? `<p class="small" style="text-align:center;max-width:42ch;margin:0 auto">${esc(s.desc)}</p>` : ''}
      ${steps[i + 1] ? `<p class="muted tiny" style="text-align:center">Next: ${esc(steps[i + 1].title)}</p>` : ''}
      <div class="row" style="justify-content:center"><button type="button" class="btn" id="pl-prev" ${i === 0 ? 'disabled' : ''}>‹ Back</button><button type="button" class="btn" id="pl-pause">${paused ? '▶ Resume' : '❚❚ Pause'}</button><button type="button" class="btn" id="pl-skip">Skip</button><button type="button" class="btn primary" id="pl-next">${i === steps.length - 1 ? '✓ Finish' : '✓ Done, next'}</button></div></div>`;
    paint();
    $('#pl-x', d).onclick = () => { clearInterval(timer); closeSheet(); refresh(); };
    $('#pl-prev', d).onclick = () => { i--; start(); };
    $('#pl-pause', d).onclick = () => { paused = !paused; $('#pl-pause', d).textContent = paused ? '▶ Resume' : '❚❚ Pause'; };
    $('#pl-skip', d).onclick = () => { o.onStep?.(i, false); next(); };
    $('#pl-next', d).onclick = () => { o.onStep?.(i, true); next(); };
  };
  const next = () => { if (i >= steps.length - 1) { clearInterval(timer); closeSheet(); o.onFinish?.(); return refresh(); } i++; start(); };
  d.innerHTML = '<div class="sheet-in"></div>'; if (!d.open) d.showModal();
  d.addEventListener('close', () => clearInterval(timer), { once: true });
  start();
}
ACTIONS['run-routine'] = (b) => {
  const r = routines().find((x) => x.id === b.dataset.id); if (!r) return; const date = b.dataset.date || todayIso();
  const done = routineState(date, r.id)?.done || [], first = r.steps.findIndex((_, k) => !done[k]);
  runPlayer(r.steps, { title: r.name, sub: `${rcat(r.cat)[1]} routine`, color: rcat(r.cat)[2], startAt: first < 0 ? 0 : first, onStep: (k, ok) => setStep(date, r.id, k, ok), onFinish: () => { const n = stepsDone(date, r); toast(n === r.steps.length ? `${r.name} complete ✓` : `${n} of ${r.steps.length} steps done`); const fr = checkAchievements(); if (fr.length) setTimeout(() => toast(`Achievement unlocked: ${fr.join(', ')}`), 2600); } });
};
