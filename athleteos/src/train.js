// ===================== TRAIN: calendar, daily checklist, load, tests, goals, library, history =====================
RENDER.train = (el, sub) => TRAIN[sub](el);
const TRAIN = {};
TRAIN.tests = (el) => RENDER.tests(el);

// ----- calendar data -----
const EV_TYPES = [['practice', 'Practice', 'var(--hb)', 'practice'], ['game', 'Game', '#ff6a3d', 'game'], ['workout', 'Skill workout', 'var(--accent)', 'skill'], ['lift', 'Weights', 'var(--str)', 'lift'], ['conditioning', 'Conditioning', 'var(--cond)', 'conditioning'], ['recovery', 'Recovery', 'var(--good)', 'recovery'], ['film', 'Film study', 'var(--purple)', null], ['nutrition', 'Nutrition', 'var(--carbs)', null], ['sleep', 'Sleep', '#64748b', null], ['testing', 'Testing', 'var(--warn)', null]];
const evType = (k) => EV_TYPES.find((x) => x[0] === k) || EV_TYPES[2];
const plan = () => doc('aos-plan');
/** Every calendar item on a date: one-off and weekly-recurring events, routine items and test reminders. */
function itemsOn(date) {
  const dow = parseIso(date).getDay(), out = [];
  for (const e of plan().events || []) {
    const hit = e.date === date || (e.recur?.days?.includes(dow) && date >= e.date && (!e.recur.until || date <= e.recur.until));
    if (hit && !(e.skip || []).includes(date)) out.push({ key: 'e:' + e.id, title: e.title, type: e.type, time: e.start, mins: e.mins, ev: e, recur: !!e.recur });
  }
  for (const r of plan().routines || []) if (r.days?.includes(dow)) (r.items || []).forEach((it, i) => out.push({ key: `r:${r.id}:${i}`, title: it.title, type: it.type || 'workout', time: it.time, routine: r.name }));
  for (const [tid, n] of Object.entries(doc('aos-tests').next || {})) if (n === date) { const t = testById(tid); if (t) out.push({ key: 't:' + tid, title: `Test: ${t.name}`, type: 'testing', test: tid }); }
  if (aos().profile?.nextGame === date && !out.some((x) => x.type === 'game')) out.push({ key: 'g:next', title: 'Game day', type: 'game' });
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}
const isChecked = (date, key) => !!plan().checks?.[date]?.[key];
function setChecked(date, key, v) { const P = plan(); P.checks = P.checks || {}; P.checks[date] = { ...(P.checks[date] || {}), [key]: v || undefined }; if (!v) delete P.checks[date][key]; persist('aos-plan'); }

TRAIN.plan = (el) => {
  const sel = ui('calDay', todayIso()), base = parseIso(ui('calMonth', todayIso().slice(0, 8) + '01'));
  const y = base.getFullYear(), m = base.getMonth(), first = new Date(y, m, 1, 12), lead = (first.getDay() + 6) % 7, nDays = new Date(y, m + 1, 0).getDate();
  const cells = []; for (let i = 0; i < lead; i++) cells.push(null); for (let d = 1; d <= nDays; d++) cells.push(isoDate(new Date(y, m, d, 12)));
  const items = itemsOn(sel);
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Training calendar</h3><span class="sub">Practices, games, workouts, lifts, recovery, film, testing</span></div><div class="row"><button type="button" class="btn sm" data-act="routine">＋ Routine</button><button type="button" class="btn sm primary" data-act="event" data-date="${sel}">＋ Event</button></div></div>
    <div class="row-between" style="margin-bottom:8px"><button type="button" class="icon-btn" data-cal="-1" aria-label="Previous month">‹</button><b style="font-family:var(--f-display)">${MON[m]} ${y}</b><button type="button" class="icon-btn" data-cal="1" aria-label="Next month">›</button></div>
    <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="cal-h">${d}</span>`).join('')}
      ${cells.map((d) => { if (!d) return '<span></span>'; const its = itemsOn(d), done = its.filter((x) => isChecked(d, x.key)).length, act = isActive(d);
        return `<button type="button" class="cal-d ${d === sel ? 'sel' : ''} ${d === todayIso() ? 'today' : ''}" data-calday="${d}"><span>${parseIso(d).getDate()}</span><i class="cal-dots">${its.slice(0, 4).map((x) => `<b style="background:${evType(x.type)[2]}"></b>`).join('')}</i>${act ? '<em class="cal-act" title="Trained"></em>' : ''}${its.length && done === its.length ? '<em class="cal-done">✓</em>' : ''}</button>`; }).join('')}
    </div>
    <div class="legend">${EV_TYPES.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>
  </section>
  <section class="card"><div class="card-head"><div><h3>${esc(fmtDL(sel))}</h3><span class="sub">${items.length ? `${items.filter((x) => isChecked(sel, x.key)).length} of ${items.length} done` : 'Nothing scheduled'}</span></div><button type="button" class="btn sm" data-act="event" data-date="${sel}">＋ Add</button></div>
    ${items.length ? checklistHtml(sel, items) : emptyState('Open day', 'Add a practice, lift, film session or a recurring routine. Recurring events repeat on the weekdays you pick.', 'calendar')}
    ${exList(sel).length ? `<div class="hr"></div><p class="muted small">Logged: ${exList(sel).map((x) => `${esc(x.name)} (${fmtDur(x.mins)})`).join(', ')}</p>` : ''}</section>
  <section class="card"><div class="card-head"><div><h3>Routines</h3><span class="sub">Daily and weekly templates that fill your checklist</span></div></div>${routinesHtml()}</section>`;
};
function checklistHtml(date, items) {
  return `<div class="list">${items.map((x) => { const on = isChecked(date, x.key), [, l, c] = evType(x.type); return `<div class="li"><label class="check" style="flex:1;min-width:0"><input type="checkbox" data-chk="${date}|${esc(x.key)}" ${on ? 'checked' : ''}><span class="dot" style="background:${c}"></span><span style="min-width:0"><span class="t" style="${on ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(x.title)}</span><span class="s" style="display:block">${[x.time ? fmtClock(x.time) : '', x.mins ? fmtDur(x.mins) : '', l, x.recur ? 'repeats' : '', x.routine ? 'routine: ' + esc(x.routine) : ''].filter(Boolean).join(' · ')}</span></span></label>${x.ev ? `<button type="button" class="chip" data-act="event" data-id="${x.ev.id}" data-date="${date}">Edit</button>` : ''}${x.test ? `<button type="button" class="chip" data-act="add-test" data-tid="${x.test}">Log</button>` : ''}</div>`; }).join('')}</div>`;
}
function routinesHtml() {
  const rs = plan().routines || [];
  return rs.length ? `<div class="list">${rs.map((r) => `<div class="li"><div><div class="t">${esc(r.name)}</div><div class="s">${(r.days || []).map((d) => DOW[d]).join(', ') || 'no days'} · ${(r.items || []).length} items</div></div><button type="button" class="chip" data-act="routine" data-id="${r.id}">Edit</button></div>`).join('')}</div>` : emptyState('No routines yet', 'Build a school-day or game-day routine (wake, breakfast, practice, recovery, film, lights out) once and it fills your checklist every week.', 'calendar');
}
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-cal]'); if (c) { const b = parseIso(ui('calMonth', todayIso().slice(0, 8) + '01')); b.setMonth(b.getMonth() + Number(c.dataset.cal)); b.setDate(1); setUi('calMonth', isoDate(b)); return refresh(); }
  const d = e.target.closest('[data-calday]'); if (d) { setUi('calDay', d.dataset.calday); return refresh(); }
});
document.addEventListener('change', (e) => {
  const c = e.target.closest('[data-chk]'); if (!c) return;
  const [date, key] = c.dataset.chk.split('|'); setChecked(date, key, c.checked);
  const it = itemsOn(date).find((x) => x.key === key), lt = it && evType(it.type)[3];
  if (c.checked && lt && date <= todayIso() && !exList(date).some((x) => x.type === lt)) { refresh(); return openWorkoutSheet({ date, type: lt, name: it.title, mins: it.mins || 60 }); }
  if (c.checked && it?.type === 'film') { refresh(); return ACTIONS['add-film']({ dataset: { date } }); }
  refresh();
});
ACTIONS.event = (b) => {
  const e = b.dataset.id ? (plan().events || []).find((x) => x.id === b.dataset.id) : null, date = b.dataset.date || todayIso();
  const days = e?.recur?.days || [];
  openSheet(e ? 'Edit event' : 'Add to calendar', `<div class="fields">
    <label class="full">Title<input id="ev-title" maxlength="50" value="${esc(e?.title || '')}" placeholder="Varsity practice, Lower-body lift, Film: last game…"></label>
    <label>Type<select id="ev-type">${EV_TYPES.map(([k, l]) => `<option value="${k}" ${e?.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Date<input type="date" id="ev-date" value="${e?.date || date}"></label>
    <label>Start<input type="time" id="ev-start" value="${e?.start || ''}"></label><label>Minutes<input type="number" id="ev-mins" min="5" max="600" value="${e?.mins || ''}" inputmode="numeric"></label>
    <label class="full">Notes<input id="ev-notes" maxlength="160" value="${esc(e?.notes || '')}"></label></div>
    <div><p class="muted small" style="margin-bottom:6px">Repeat weekly on (optional)</p><div class="chips" id="ev-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="chip ${days.includes(d) ? 'on' : ''}" data-dow="${d}">${DOW[d]}</button>`).join('')}</div></div>
    <label>Repeat until (optional)<input type="date" id="ev-until" value="${e?.recur?.until || ''}"></label>
    <div class="row"><button type="button" class="btn primary" id="ev-save" style="flex:1">Save</button>${e ? `${e.recur ? '<button type="button" class="btn" id="ev-skip">Skip this day</button>' : ''}<button type="button" class="btn danger" id="ev-del">Delete</button>` : ''}</div>`, (d) => {
    $('#ev-days', d).addEventListener('click', (x) => { const c = x.target.closest('[data-dow]'); if (c) c.classList.toggle('on'); });
    $('#ev-save', d).addEventListener('click', () => {
      const title = $('#ev-title', d).value.trim() || evType($('#ev-type', d).value)[1];
      const dd = $$('[data-dow].on', d).map((x) => Number(x.dataset.dow)), mins = Number($('#ev-mins', d).value) || null;
      const rec = { id: e?.id || uid('e'), title: title.slice(0, 50), type: $('#ev-type', d).value, date: $('#ev-date', d).value || date, start: $('#ev-start', d).value || null, mins, notes: $('#ev-notes', d).value.trim().slice(0, 160), recur: dd.length ? { days: dd, until: $('#ev-until', d).value || null } : null, skip: e?.skip || [] };
      plan().events = [...(plan().events || []).filter((x) => x.id !== rec.id), rec]; persist('aos-plan'); closeSheet(); toast('Saved to calendar'); refresh();
    });
    $('#ev-skip', d)?.addEventListener('click', () => { e.skip = [...(e.skip || []), date]; persist('aos-plan'); closeSheet(); refresh(); });
    $('#ev-del', d)?.addEventListener('click', () => confirmSheet(`Delete "${e.title}"${e.recur ? ' and all its repeats' : ''}?`, 'Delete', () => { plan().events = plan().events.filter((x) => x.id !== e.id); persist('aos-plan'); refresh(); }));
  });
};
ACTIONS.routine = (b) => {
  const r = b.dataset.id ? (plan().routines || []).find((x) => x.id === b.dataset.id) : null;
  const items = r?.items?.length ? r.items : [{ time: '07:00', title: 'Wake up + water', type: 'nutrition' }, { time: '', title: '', type: 'workout' }];
  const row = (it, i) => `<div class="row rt-row" style="flex-wrap:nowrap"><input type="time" data-rt="time" value="${it.time || ''}" style="width:118px"><input data-rt="title" maxlength="50" value="${esc(it.title || '')}" placeholder="Task"><select data-rt="type" style="width:120px">${EV_TYPES.map(([k, l]) => `<option value="${k}" ${it.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
  openSheet(r ? 'Edit routine' : 'New routine', `<label>Name<input id="rt-name" maxlength="40" value="${esc(r?.name || '')}" placeholder="School day, Game day, Saturday grind"></label>
    <div><p class="muted small" style="margin-bottom:6px">Days</p><div class="chips" id="rt-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="chip ${(r?.days || [1, 2, 3, 4, 5]).includes(d) ? 'on' : ''}" data-dow="${d}">${DOW[d]}</button>`).join('')}</div></div>
    <div class="stack" id="rt-items">${items.map(row).join('')}</div><button type="button" class="btn sm" id="rt-add">＋ Add item</button>
    <div class="row"><button type="button" class="btn primary" id="rt-save" style="flex:1">Save routine</button>${r ? '<button type="button" class="btn danger" id="rt-del">Delete</button>' : ''}</div>`, (d) => {
    $('#rt-days', d).addEventListener('click', (x) => { const c = x.target.closest('[data-dow]'); if (c) c.classList.toggle('on'); });
    $('#rt-add', d).addEventListener('click', () => $('#rt-items', d).insertAdjacentHTML('beforeend', row({ type: 'workout' })));
    $('#rt-save', d).addEventListener('click', () => {
      const its = $$('.rt-row', d).map((x) => ({ time: $('[data-rt="time"]', x).value || '', title: $('[data-rt="title"]', x).value.trim(), type: $('[data-rt="type"]', x).value })).filter((x) => x.title);
      if (!its.length) return toast('Add at least one item');
      const rec = { id: r?.id || uid('rt'), name: $('#rt-name', d).value.trim() || 'Routine', days: $$('[data-dow].on', d).map((x) => Number(x.dataset.dow)), items: its.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')) };
      plan().routines = [...(plan().routines || []).filter((x) => x.id !== rec.id), rec]; persist('aos-plan'); closeSheet(); toast('Routine saved'); refresh();
    });
    $('#rt-del', d)?.addEventListener('click', () => confirmSheet('Delete this routine?', 'Delete', () => { plan().routines = plan().routines.filter((x) => x.id !== r.id); persist('aos-plan'); refresh(); }));
  });
};
TRAIN.today = (el) => {
  const d = todayIso(), items = itemsOn(d), done = items.filter((x) => isChecked(d, x.key)).length;
  const next7 = []; for (let i = 1; i <= 7; i++) { const x = shiftIso(d, i), its = itemsOn(x); if (its.length) next7.push([x, its]); }
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Today's checklist</h3><span class="sub">Checking off a practice or workout offers to log it</span></div>${ring(done, items.length || 1, { size: 70, stroke: 7, color: 'var(--good)', center: `<b>${done}/${items.length}</b>` })}</div>
    ${items.length ? checklistHtml(d, items) : emptyState('No checklist for today', 'Build a routine or add events in the calendar.', 'calendar', '<div class="row" style="justify-content:center"><button type="button" class="btn sm primary" data-act="routine">Build a routine</button><button type="button" class="btn sm" data-go="train-plan">Calendar</button></div>')}</section>
    <section class="card"><div class="card-head"><div><h3>Next 7 days</h3></div></div>${next7.length ? `<div class="list">${next7.map(([x, its]) => `<button type="button" class="li li-btn" data-calday="${x}" data-go="train-plan"><div><div class="t">${esc(fmtDL(x))}</div><div class="s">${its.map((i) => esc(i.title)).join(' · ')}</div></div><span class="row" style="gap:3px">${its.slice(0, 5).map((i) => `<span class="dot" style="background:${evType(i.type)[2]}"></span>`).join('')}</span></button>`).join('')}</div>` : '<p class="muted small">Nothing scheduled this week.</p>'}</section>
    <section class="card"><div class="card-head"><div><h3>Workout completion</h3><span class="sub">Last 28 days</span></div></div>${completionHtml()}</section>`;
};
function completionHtml() {
  const days = lastNDays(28).filter((x) => x <= todayIso()); let sched = 0, chk = 0, trainSched = 0, trainDone = 0;
  for (const d of days) for (const it of itemsOn(d)) { sched++; if (isChecked(d, it.key)) chk++; if (evType(it.type)[3]) { trainSched++; if (isChecked(d, it.key) || exList(d).some((x) => x.type === evType(it.type)[3])) trainDone++; } }
  const lib = doc('aos-lib').workouts || [], logs = {}; for (const d of allDayKeys()) for (const x of exList(d)) if (x.workoutId) logs[x.workoutId] = (logs[x.workoutId] || 0) + 1;
  return `<div class="kpis four"><div class="kpi"><small>Checklist done</small><b>${sched ? pctTxt(chk / sched) : '—'}</b><span class="tiny muted">${chk} of ${sched} items</span></div><div class="kpi"><small>Scheduled training done</small><b>${trainSched ? pctTxt(trainDone / trainSched) : '—'}</b><span class="tiny muted">${trainDone} of ${trainSched}</span></div><div class="kpi"><small>Sessions logged</small><b>${sum(days.map((d) => exList(d).length))}</b></div><div class="kpi"><small>Saved workouts done</small><b>${sum(Object.values(logs))}</b><span class="tiny muted">${lib.length} in your library</span></div></div>`;
}

// ----- load and recovery intelligence -----
TRAIN.load = (el) => {
  const ls = loadStats(), rd = readiness(), [zc, zl] = acwrZone(ls.acwr), days = lastNDays(28);
  const ic = { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--accent)', rest: 'var(--surface-2)' };
  const counts = { high: 0, medium: 0, low: 0, rest: 0 }; days.forEach((d) => counts[dayIntensity(d)]++);
  const st = availability();
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Training load</h3><span class="sub">Session RPE × minutes${ls.est ? ' · some sessions estimated from intensity (add RPE when logging)' : ''}</span></div><button type="button" class="btn sm primary" data-act="log-workout">＋ Workout</button></div>
    <div class="grid two" style="align-items:center">
      <div class="row" style="gap:16px;flex-wrap:nowrap">${rd ? ring(rd.score, 100, { size: 120, stroke: 11, color: recBand(rd.score)[0] === 'hi' ? 'var(--good)' : recBand(rd.score)[0] === 'mid' ? 'var(--warn)' : 'var(--danger)', center: `<b style="font-size:30px">${rd.score}</b><span class="tiny muted">readiness</span>` }) : ring(0, 100, { size: 120, stroke: 11, center: '<b>—</b><span class="tiny muted">readiness</span>' })}
        <div class="stack" style="gap:6px;min-width:0"><span class="band ${zc}">ACWR ${ls.acwr ?? '—'} · ${zl}</span><span class="small">${rd ? rd.notes.join(' · ') || 'Based on your check-in' : 'Check in (sleep, energy, soreness, fatigue) to get readiness.'}</span>${st.status !== 'available' ? `<span class="band ${st.status === 'out' ? 'lo' : 'mid'}">${st.status === 'out' ? 'Out' : 'Limited'}${st.area ? ': ' + esc(st.area) : ''}</span>` : ''}<button type="button" class="btn sm" data-act="checkin">Check in</button></div></div>
      <div class="kpis"><div class="kpi"><small>Acute (7 d)</small><b>${ls.acute.toLocaleString()}</b><span class="tiny muted">load units</span></div><div class="kpi"><small>Chronic (28 d avg/wk)</small><b>${ls.chronic.toLocaleString()}</b></div><div class="kpi"><small>Monotony</small><b>${ls.monotony ?? '—'}</b><span class="tiny muted">${ls.monotony == null ? 'needs varied days' : ls.monotony > 2 ? 'too repetitive' : 'good variety'}</span></div><div class="kpi"><small>Strain</small><b>${ls.strain?.toLocaleString() ?? '—'}</b></div></div>
    </div>
    ${ls.history < 21 ? `<p class="notice" style="margin-top:12px">The acute:chronic ratio needs 3+ weeks of logged training (you have ${ls.history} day${ls.history === 1 ? '' : 's'}).</p>` : ''}
  </section>
  <section class="card"><div class="card-head"><div><h3>Load vs readiness</h3><span class="sub">Bars = daily load (color = intensity) · green line = readiness · 🏆 PR · 🏀 game</span></div></div>
    ${days.some((d) => loadOf(d)) || days.some((d) => readiness(d)) ? '<div class="chart" id="combo"></div>' : emptyState('No load yet', 'Log workouts with an RPE (1-10) and do morning check-ins to see how your body responds to training.', 'chart')}
    <div class="legend"><span><i style="background:var(--danger)"></i>High</span><span><i style="background:var(--warn)"></i>Medium</span><span><i style="background:var(--accent)"></i>Low</span><span><i style="background:var(--good)"></i>Readiness</span></div></section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Intensity mix</h3><span class="sub">Last 28 days</span></div></div>
      <div class="stack">${Object.entries(counts).map(([k, n]) => `<div><div class="row-between small"><span style="text-transform:capitalize">${k === 'rest' ? 'Rest days' : k + ' days'}</span><b>${n}</b></div>${hbar((n / 28) * 100, ic[k] === 'var(--surface-2)' ? 'var(--oth)' : ic[k])}</div>`).join('')}</div>
      <p class="muted tiny" style="margin-top:8px">High = 600+ load or RPE 8+. A good week mixes 1-2 high, 2-3 medium/low and 1-2 rest days.</p></section>
    <section class="card"><div class="card-head"><div><h3>Rest-day recommendations</h3></div></div><div class="list">${restAdvice().map(([c, t]) => `<div class="li" style="justify-content:flex-start"><span class="band ${c}" style="flex:none">${c === 'hi' ? 'OK' : c === 'mid' ? 'Watch' : 'Act'}</span><span class="small">${esc(t)}</span></div>`).join('') || '<p class="muted small">Check in and log training to get recommendations.</p>'}</div></section>
  </div>
  <section class="card"><div class="card-head"><div><h3>Weekly load progression</h3><span class="sub">12 weeks · a safe ramp is roughly 10% per week</span></div></div><div class="chart" id="wk-load"></div></section>
  <section class="card"><div class="card-head"><div><h3>Fatigue, soreness and sleep</h3><span class="sub">From check-ins · last 28 days</span></div><button type="button" class="btn sm" data-go="analytics-recovery">Recovery</button></div><div id="fss"></div></section>
  <section class="card"><div class="card-head"><div><h3>Consistency calendar</h3><span class="sub">Last 16 weeks</span></div></div>${heatmap(16, activityLevel, null, (d) => (isActive(d) ? `load ${loadOf(d)}` : 'rest'))}</section>`;
  drawCombo($('#combo'), days.map((d) => { const L = loadOf(d), r = readiness(d), pr = allPRs().some((p) => p.r.date === d), g = games().some((x) => x.date === d); return { label: String(parseIso(d).getDate()), full: fmtDL(d), bar: L, color: ic[dayIntensity(d)], line: r?.score ?? null, mark: pr ? '🏆' : g ? '🏀' : '', tip: `${L ? `Load ${L} (${dayIntensity(d)})` : 'Rest'}${r ? ` · readiness ${r.score}` : ''}${pr ? ' · PR' : ''}` }; }), { label: 'Daily load and readiness' });
  const wk = []; for (let i = 11; i >= 0; i--) { const mo = shiftIso(mondayOf(todayIso()), -7 * i), v = sum(lastNDays(7, shiftIso(mo, 6)).map(loadOf)); wk.push({ label: `${parseIso(mo).getMonth() + 1}/${parseIso(mo).getDate()}`, full: 'Week of ' + fmtD(mo), segs: [{ v, color: 'var(--accent)' }], tip: `${v.toLocaleString()} load` }); }
  for (let i = 1; i < wk.length; i++) { const a = wk[i].segs[0].v, b = wk[i - 1].segs[0].v; if (b && a > b * 1.3) { wk[i].segs[0].color = 'var(--over)'; wk[i].tip += ` · +${Math.round((a / b - 1) * 100)}% jump`; } }
  drawBars($('#wk-load'), wk, { h: 170 });
  const ser = (k) => seriesOf((d) => (k === 'fatigue' ? dayDoc(d)?.feel?.fatigue ?? null : recoveryInputs(d)[k]), days);
  const f = ser('fatigue'), so = ser('sore'), sl = ser('sleepH');
  $('#fss').innerHTML = f.length + so.length + sl.length ? `<div class="kpis four"><div class="kpi"><small>Fatigue avg</small><b>${f.length ? r1(mean(f.map((p) => p.v))) + '/5' : '—'}</b>${spark(f.map((p) => p.v), 'var(--over)')}</div><div class="kpi"><small>Soreness avg</small><b>${so.length ? r1(mean(so.map((p) => p.v))) + '/5' : '—'}</b>${spark(so.map((p) => p.v), 'var(--warn)')}</div><div class="kpi"><small>Sleep avg</small><b>${sl.length ? r1(mean(sl.map((p) => p.v))) + ' h' : '—'}</b>${spark(sl.map((p) => p.v), 'var(--purple)')}</div><div class="kpi"><small>Check-ins</small><b>${days.filter((d) => dayDoc(d)?.feel).length}</b><span class="tiny muted">of 28 days</span></div></div>` : emptyState('No check-ins', 'Morning check-ins (sleep, energy, soreness, fatigue) power readiness.', 'moon');
};

// ----- goals -----
const HORIZONS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['season', 'Season'], ['annual', 'Annual'], ['long', 'Long-term']];
const STATUS_TXT = { done: ['hi', 'Done'], 'on-track': ['hi', 'On track'], behind: ['mid', 'Behind'], overdue: ['lo', 'Overdue'] };
const fmtGoal = (g, v) => (v == null ? '—' : g.source?.startsWith('test:') ? fmtVal(testById(g.source.slice(5)), v) : `${r1(v)}${g.unit ? (g.unit === '%' ? '%' : ' ' + g.unit) : ''}`);
TRAIN.goals = (el) => {
  snapshotGoals();
  const gs = goals(), sel = gs.find((g) => g.id === ui('goal')), st = gs.map((g) => goalState(g));
  const n = (s) => st.filter((x) => x.status === s).length;
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Goal roadmap</h3><span class="sub">Measurable targets that update from your logs</span></div><button type="button" class="btn sm primary" data-act="goal">＋ Goal</button></div>
    ${gs.length ? `<div class="kpis four"><div class="kpi"><small>Active</small><b>${gs.length - n('done')}</b></div><div class="kpi"><small>On track</small><b class="up">${n('on-track')}</b></div><div class="kpi"><small>Behind / overdue</small><b class="down">${n('behind') + n('overdue')}</b></div><div class="kpi"><small>Completed</small><b>${n('done')}</b></div></div>` : emptyState('No goals yet', 'Set a target like "30-inch vertical by June", "40% from three this season" or "train 5 days a week". Link it to a test or stat and it tracks itself.', 'trophy', '<button type="button" class="btn sm primary" data-act="goal">Create your first goal</button>')}
  </section>
  ${sel ? `<section class="card" id="goal-detail"></section>` : ''}
  ${HORIZONS.map(([h, l]) => { const hs = gs.filter((g) => g.horizon === h); return hs.length ? `<section class="card"><div class="card-head"><h3>${l} goals</h3></div><div class="list">${hs.map((g) => { const s = goalState(g), [c, t] = STATUS_TXT[s.status]; return `<button type="button" class="li li-btn" data-goal="${g.id}" style="display:block"><div class="row-between"><span class="t">${esc(g.title)}</span><span class="band ${c}">${t}</span></div><div class="row-between s" style="margin:4px 0"><span>${esc(fmtGoal(g, s.cur))} → ${esc(fmtGoal(g, g.target))}${g.date ? ' by ' + esc(fmtD(g.date)) : ''}</span><b class="num">${s.pct}%</b></div>${hbar(s.pct, s.status === 'done' ? 'var(--good)' : '')}</button>`; }).join('')}</div></section>` : ''; }).join('')}
  ${gs.some((g) => g.date) ? `<section class="card"><div class="card-head"><div><h3>Timeline</h3><span class="sub">Target dates</span></div></div><div class="tl">${[...gs].filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date)).map((g) => { const s = goalState(g); return `<div class="tl-i ${s.status}"><span class="tl-d">${esc(fmtD(g.date))}</span><b>${esc(g.title)}</b><span class="tiny muted">${s.pct}% · ${STATUS_TXT[s.status][1]}</span></div>`; }).join('')}</div></section>` : ''}`;
  if (sel) goalDetail($('#goal-detail'), sel);
};
document.addEventListener('click', (e) => { const g = e.target.closest('[data-goal]'); if (!g) return; setUi('goal', ui('goal') === g.dataset.goal ? null : g.dataset.goal); refresh(); $('#goal-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
function goalDetail(el, g) {
  const s = goalState(g), h = [{ date: isoDate(new Date(g.created || Date.now())), v: g.start }, ...(g.history || [])].filter((p, i, a) => i === a.length - 1 || p.date !== a[i + 1].date);
  el.innerHTML = `<div class="card-head"><div><h3>${esc(g.title)}</h3><span class="sub">${esc(HORIZONS.find((x) => x[0] === g.horizon)?.[1] || '')} goal · ${g.source && g.source !== 'manual' ? 'auto-tracked from ' + esc(GOAL_SOURCES.find((x) => x[0] === g.source)?.[1] || g.source) : 'updated by you'}</span></div><button type="button" class="icon-btn" data-goal="${g.id}" aria-label="Close">✕</button></div>
    <div class="row" style="gap:16px;flex-wrap:nowrap">${ring(s.pct, 100, { size: 104, stroke: 10, color: s.status === 'done' ? 'var(--good)' : 'var(--accent)', color2: 'var(--purple)', center: `<b style="font-size:22px">${s.pct}%</b>` })}
      <div class="stack" style="gap:4px"><span class="small">Start <b>${esc(fmtGoal(g, g.start))}</b> · Now <b>${esc(fmtGoal(g, s.cur))}</b> · Target <b>${esc(fmtGoal(g, g.target))}</b></span>${g.date ? `<span class="small muted">Due ${esc(fmtDL(g.date))} · ${daysBetween(todayIso(), g.date)} days left${s.expected != null ? ` · time used ${s.expected}%` : ''}</span>` : ''}<span class="band ${STATUS_TXT[s.status][0]}" style="width:max-content">${STATUS_TXT[s.status][1]}</span></div></div>
    ${h.length >= 2 || (g.date && s.status !== 'done') ? '<div class="chart" id="goal-chart" style="margin-top:12px"></div>' : '<p class="notice" style="margin-top:12px">The chart fills in as you log progress on different days, or add a target date to see the path to it.</p>'}
    ${g.milestones?.length ? `<h4 style="margin:12px 0 6px">Milestones</h4><div class="list">${g.milestones.map((m) => `<div class="li"><span class="small">${m.done ? '✅' : '⬜'} ${esc(m.label || fmtGoal(g, m.v))}</span><span class="tiny muted">${m.done ? 'reached ' + esc(fmtD(m.done)) : esc(fmtGoal(g, m.v))}</span></div>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:12px">${!g.source || g.source === 'manual' ? `<button type="button" class="btn sm primary" data-act="goal-update" data-id="${g.id}">Update progress</button>` : ''}<button type="button" class="btn sm" data-act="goal" data-id="${g.id}">Edit</button><button type="button" class="btn sm danger" data-act="goal-del" data-id="${g.id}">Delete</button></div>`;
  if ($('#goal-chart')) drawLine($('#goal-chart'), h.map((p) => ({ date: p.date, v: p.v, tip: fmtGoal(g, p.v) })), { goal: g.target, goalLabel: 'Target', fmt: (v) => fmtGoal(g, v), proj: g.date && g.date > h[h.length - 1].date && s.status !== 'done' ? [{ date: g.date, v: g.target }] : null, label: g.title });
}
ACTIONS.goal = (b) => {
  const g = b.dataset.id ? goals().find((x) => x.id === b.dataset.id) : null;
  openSheet(g ? 'Edit goal' : 'New goal', `<div class="fields">
    <label class="full">Goal<input id="go-title" maxlength="60" value="${esc(g?.title || '')}" placeholder="30-inch vertical, 40% from three, 5 training days a week"></label>
    <label>Horizon<select id="go-h">${HORIZONS.map(([k, l]) => `<option value="${k}" ${(g?.horizon || 'season') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Target date<input type="date" id="go-date" value="${g?.date || ''}"></label>
    <label class="full">Track it with<select id="go-src">${GOAL_SOURCES.map(([k, l]) => `<option value="${k}" ${(g?.source || 'manual') === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    <label>Start value<input id="go-start" inputmode="decimal" value="${g?.start ?? ''}"></label><label>Target value<input id="go-target" inputmode="decimal" value="${g?.target ?? ''}"></label>
    <label>Unit<input id="go-unit" maxlength="10" value="${esc(g?.unit || '')}"></label><label>Better is<select id="go-better"><option value="higher">Higher</option><option value="lower" ${g?.better === 'lower' ? 'selected' : ''}>Lower</option></select></label>
    <label class="full">Milestones (optional, comma-separated values)<input id="go-ms" value="${esc((g?.milestones || []).map((m) => m.v).join(', '))}" placeholder="27, 28, 29"></label></div>
    <p class="muted tiny" id="go-hint"></p><button type="button" class="btn primary" id="go-save">Save goal</button>`, (d) => {
    const sync = () => { const src = $('#go-src', d).value, meta = GOAL_SOURCES.find((x) => x[0] === src), cur = src === 'manual' ? null : sourceValue(src); $('#go-hint', d).textContent = src === 'manual' ? 'You will log progress yourself.' : cur == null ? 'No data for this yet. It starts tracking when you log it.' : `Current value: ${cur}`; if (!g) { $('#go-unit', d).value = meta[2] === 's' ? 's' : meta[2]; $('#go-better', d).value = meta[3]; if (cur != null) $('#go-start', d).value = cur; } };
    sync(); $('#go-src', d).addEventListener('change', sync);
    $('#go-save', d).addEventListener('click', () => {
      const src = $('#go-src', d).value, t = src.startsWith('test:') ? testById(src.slice(5)) : null, num = (s) => (t ? parseTestValue(t, s) : Number(s));
      const start = num($('#go-start', d).value), target = num($('#go-target', d).value), title = $('#go-title', d).value.trim();
      if (!title) return toast('Name your goal'); if (!Number.isFinite(start) || !Number.isFinite(target) || $('#go-target', d).value === '') return toast('Enter a start and target value'); if (start === target) return toast('Target must differ from start');
      const ms = $('#go-ms', d).value.split(',').map((x) => num(x.trim())).filter((x) => Number.isFinite(x)).map((v) => ({ v, done: (g?.milestones || []).find((m) => m.v === v)?.done || null }));
      const rec = { ...(g || {}), id: g?.id || uid('goal'), title: title.slice(0, 60), horizon: $('#go-h', d).value, date: $('#go-date', d).value || null, source: src, start, target, unit: $('#go-unit', d).value.trim(), better: $('#go-better', d).value, milestones: ms, created: g?.created || Date.now(), history: g?.history || [] };
      doc('aos-goals').goals = [...goals().filter((x) => x.id !== rec.id), rec]; persist('aos-goals'); setUi('goal', rec.id); closeSheet(); toast('Goal saved'); go('train', 'goals');
    });
  });
};
ACTIONS['goal-update'] = (b) => { const g = goals().find((x) => x.id === b.dataset.id); openSheet('Update progress', `<label>Current value (${esc(g.unit || '')})<input id="gu-v" inputmode="decimal" value="${goalCurrent(g)}"></label><button type="button" class="btn primary" id="gu-save">Save</button>`, (d) => $('#gu-save', d).addEventListener('click', () => { const v = Number($('#gu-v', d).value); if (!Number.isFinite(v)) return toast('Enter a number'); g.history = [...(g.history || []).filter((h) => h.date !== todayIso()), { date: todayIso(), v }]; for (const m of g.milestones || []) if (!m.done && (g.better === 'lower' ? v <= m.v : v >= m.v)) m.done = todayIso(); persist('aos-goals'); closeSheet(); if (goalState(g).status === 'done') celebrate('Goal complete', fmtGoal(g, v), g.title); refresh(); })); };
ACTIONS['goal-del'] = (b) => confirmSheet('Delete this goal and its history?', 'Delete', () => { doc('aos-goals').goals = goals().filter((x) => x.id !== b.dataset.id); persist('aos-goals'); setUi('goal', null); refresh(); });

// ----- library -----
TRAIN.library = (el) => {
  const tab = ui('libTab', 'drill'), q = ui('libQ', ''), cat = ui('libCat', 'all'), favs = doc('aos-lib').favs || [];
  const items = tab === 'fav' ? LIB.filter((x) => favs.includes(x.id)) : tab === 'mine' ? [] : LIB.filter((x) => x.kind === (tab === 'drill' ? 'drill' : 'exercise'));
  const cats = [...new Set(items.map((x) => x.cat))];
  const shown = items.filter((x) => (cat === 'all' || x.cat === cat) && (!q || `${x.name} ${x.cat} ${x.cue} ${x.eq}`.toLowerCase().includes(q.toLowerCase())));
  const mine = doc('aos-lib').workouts || [];
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Workout library</h3><span class="sub">${DRILLS.length} basketball drills · ${EXERCISES.length} exercises · your custom workouts</span></div><button type="button" class="btn sm primary" data-act="build-workout">＋ Build a workout</button></div>
    <div class="row" style="margin-bottom:10px">${seg('libTab', [['drill', 'Drills'], ['exercise', 'Exercises'], ['mine', `My workouts (${mine.length})`], ['fav', `Favorites (${favs.length})`]], tab)}</div>
    ${tab !== 'mine' ? `<input id="lib-q" placeholder="Search drills and exercises…" value="${esc(q)}" style="margin-bottom:10px"><div class="chips" style="margin-bottom:10px"><button type="button" class="chip ${cat === 'all' ? 'on' : ''}" data-libcat="all">All</button>${cats.map((c) => `<button type="button" class="chip ${cat === c ? 'on' : ''}" data-libcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${shown.length ? `<div class="list">${shown.map((x) => `<div class="li" style="align-items:flex-start"><div><div class="t">${esc(x.name)}</div><div class="s">${esc(x.cat)} · ${esc(x.eq)} · <b>${esc(x.dose)}</b></div><div class="s" style="margin-top:2px">${esc(x.cue)}</div></div><button type="button" class="chip ${isFav(x.id) ? 'on' : ''}" data-fav="${x.id}" aria-label="Favorite">${isFav(x.id) ? '★' : '☆'}</button></div>`).join('')}</div>` : emptyState(tab === 'fav' ? 'No favorites yet' : 'Nothing matches', tab === 'fav' ? 'Tap ☆ on any drill or exercise to keep it here.' : 'Try another word or category.', 'grid')}`
    : mine.length ? `<div class="list">${mine.map((w) => { const n = sum(allDayKeys().map((d) => exList(d).filter((x) => x.workoutId === w.id).length)); return `<div class="li" style="align-items:flex-start"><div><div class="t">${esc(w.name)}</div><div class="s">${esc(w.focus || '')} · ${w.items.length} items · ~${w.mins} min · done ${n}×</div><div class="s">${w.items.slice(0, 4).map((i) => esc(libItem(i.id)?.name || i.name)).join(', ')}${w.items.length > 4 ? '…' : ''}</div></div><div class="row"><button type="button" class="chip" data-act="start-workout" data-id="${w.id}">Start</button><button type="button" class="chip" data-act="build-workout" data-id="${w.id}">Edit</button></div></div>`; }).join('')}</div>` : emptyState('No custom workouts', 'Build one from the drill and exercise library. It becomes one tap to start and log.', 'dumbbell', '<button type="button" class="btn sm primary" data-act="build-workout">Build a workout</button>')}
  </section><section class="card" id="w-run" hidden></section>`;
  $('#lib-q')?.addEventListener('input', (e) => { setUi('libQ', e.target.value); clearTimeout(TRAIN.qT); TRAIN.qT = setTimeout(() => { refresh(); const i = $('#lib-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
};
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-libcat]'); if (c) { setUi('libCat', c.dataset.libcat); return refresh(); }
  const f = e.target.closest('[data-fav]'); if (f) { toggleFav(f.dataset.fav); return refresh(); }
});
ACTIONS['build-workout'] = (b) => {
  const w = b.dataset.id ? (doc('aos-lib').workouts || []).find((x) => x.id === b.dataset.id) : null;
  let items = w ? w.items.map((x) => ({ ...x })) : [];
  const draw = (d) => { $('#bw-items', d).innerHTML = items.length ? items.map((it, i) => `<div class="li"><div style="min-width:0"><div class="t">${esc(libItem(it.id)?.name || it.name)}</div></div><div class="row" style="flex-wrap:nowrap"><input data-dose="${i}" value="${esc(it.dose)}" style="width:130px"><button type="button" class="chip" data-rm="${i}" aria-label="Remove">✕</button></div></div>`).join('') : '<p class="muted small">Add drills or exercises below.</p>'; };
  openSheet(w ? 'Edit workout' : 'Build a workout', `<div class="fields"><label class="full">Name<input id="bw-name" maxlength="40" value="${esc(w?.name || '')}" placeholder="Guard skills, Lower power…"></label><label>Focus<select id="bw-focus">${FOCUSES.map(([k, l]) => `<option value="${k}" ${w?.focus === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Minutes<input type="number" id="bw-mins" min="10" max="240" value="${w?.mins || 60}"></label></div>
    <div class="list" id="bw-items"></div>
    <input id="bw-q" placeholder="Search to add: pull-ups, euro step, two-ball…"><div class="list" id="bw-res"></div>
    <div class="row"><button type="button" class="btn primary" id="bw-save" style="flex:1">Save workout</button>${w ? '<button type="button" class="btn danger" id="bw-del">Delete</button>' : ''}</div>`, (d) => {
    draw(d);
    const search = () => { const q = $('#bw-q', d).value.toLowerCase(); const r = (q ? LIB.filter((x) => `${x.name} ${x.cat}`.toLowerCase().includes(q)) : LIB.filter((x) => isFav(x.id))).slice(0, 8); $('#bw-res', d).innerHTML = r.map((x) => `<button type="button" class="li li-btn" data-addlib="${x.id}"><span><span class="t">${esc(x.name)}</span> <span class="s">${esc(x.cat)}</span></span><span class="muted">＋</span></button>`).join(''); };
    search(); $('#bw-q', d).addEventListener('input', search);
    d.addEventListener('click', (e) => { const a = e.target.closest('[data-addlib]'); if (a) { const x = libItem(a.dataset.addlib); items.push({ id: x.id, dose: x.dose }); draw(d); } const r = e.target.closest('[data-rm]'); if (r) { items.splice(Number(r.dataset.rm), 1); draw(d); } });
    d.addEventListener('input', (e) => { const x = e.target.closest('[data-dose]'); if (x) items[Number(x.dataset.dose)].dose = x.value; });
    $('#bw-save', d).addEventListener('click', () => { if (!items.length) return toast('Add at least one drill or exercise'); const rec = { id: w?.id || uid('lw'), name: $('#bw-name', d).value.trim() || 'My workout', focus: $('#bw-focus', d).value, mins: Number($('#bw-mins', d).value) || 60, items }; const L = doc('aos-lib'); L.workouts = [...(L.workouts || []).filter((x) => x.id !== rec.id), rec]; persist('aos-lib'); setUi('libTab', 'mine'); closeSheet(); toast('Workout saved'); go('train', 'library'); });
    $('#bw-del', d)?.addEventListener('click', () => confirmSheet('Delete this workout?', 'Delete', () => { const L = doc('aos-lib'); L.workouts = L.workouts.filter((x) => x.id !== w.id); persist('aos-lib'); refresh(); }));
  });
};
ACTIONS['start-workout'] = (b) => {
  const w = (doc('aos-lib').workouts || []).find((x) => x.id === b.dataset.id), o = $('#w-run'); if (!w || !o) return;
  o.hidden = false;
  o.innerHTML = `<div class="card-head"><div><h3>${esc(w.name)}</h3><span class="sub">Check items off as you go</span></div></div><div class="list">${w.items.map((it) => { const x = libItem(it.id) || {}; return `<label class="li check"><input type="checkbox"><span style="flex:1;min-width:0"><span class="t">${esc(x.name || it.name)}</span><span class="s" style="display:block">${esc(it.dose)} · ${esc(x.cue || '')}</span></span></label>`; }).join('')}</div><button type="button" class="btn primary block" data-act="finish-lib" data-id="${w.id}" style="margin-top:12px">✓ Finish and log</button>`;
  o.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
ACTIONS['finish-lib'] = (b) => { const w = (doc('aos-lib').workouts || []).find((x) => x.id === b.dataset.id); openWorkoutSheet({ type: focusType(w.focus), name: w.name, mins: w.mins, workoutId: w.id }); };

// ----- searchable history -----
function historyItems() {
  const out = [];
  for (const d of allDayKeys()) for (const x of exList(d)) out.push({ date: d, kind: 'workout', icon: 'dumbbell', title: x.name || 'Workout', sub: `${fmtDur(x.mins)} · ${x.int || ''}${x.rpe ? ' · RPE ' + x.rpe : ''}${x.rating ? ' · rated ' + x.rating + '/5' : ''}`, text: x.notes || '' });
  for (const s of shotSessions()) { const t = sessionTotals(s); out.push({ date: s.date, kind: 'shooting', icon: 'ball', title: `Shooting ${t.m}/${t.a} (${pctTxt(t.pct)})`, sub: STYLES.find((x) => x[0] === s.style)?.[1] || '', text: s.note || '' }); }
  for (const s of handleSessions()) out.push({ date: s.date, kind: 'handles', icon: 'ball', title: `Ball handling · ${fmtDur(s.mins)}`, sub: `${s.weakMins || 0} min weak hand · ${s.losses || 0} ball losses`, text: [(s.combos || []).join(', '), s.note].join(' ') });
  for (const s of finishSessions()) { const t = finishTotals([s]); out.push({ date: s.date, kind: 'finishing', icon: 'ball', title: `Finishing ${t.m}/${t.a} (${pctTxt(t.a ? t.m / t.a : null)})`, sub: `Left ${t.L.m}/${t.L.a} · right ${t.R.m}/${t.R.a}`, text: s.note || '' }); }
  for (const f of filmEntries()) out.push({ date: f.date, kind: 'film', icon: 'spark', title: f.title || 'Film study', sub: `${FILM_TYPES.find((x) => x[0] === f.type)?.[1] || ''}${f.mins ? ' · ' + f.mins + ' min' : ''}${f.player ? ' · ' + f.player : ''}`, text: [f.notes, f.takeaways, (f.tags || []).join(' ')].join(' ') });
  for (const g of games()) out.push({ date: g.date, kind: 'game', icon: 'trophy', title: `Game${g.opp ? ' vs ' + g.opp : ''}${g.result ? ' (' + g.result + ')' : ''}`, sub: `${g.pts ?? '—'} pts · ${g.reb ?? '—'} reb · ${g.ast ?? '—'} ast`, text: g.opp || '' });
  for (const r of doc('aos-tests').results || []) { const t = testById(r.test); if (t) out.push({ date: r.date, kind: 'test', icon: 'trophy', title: `${t.name}: ${fmtVal(t, r.value)}`, sub: t.group, text: r.note || '' }); }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
TRAIN.history = (el) => {
  const q = ui('hq', ''), k = ui('hk', 'all'), all = historyItems();
  const items = all.filter((x) => (k === 'all' || x.kind === k) && (!q || `${x.title} ${x.sub} ${x.text} ${x.date} ${fmtDL(x.date)}`.toLowerCase().includes(q.toLowerCase())));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Training history</h3><span class="sub">${all.length} entries across workouts, shooting, handles, finishing, film, games and tests</span></div></div>
    <input id="h-q" placeholder="Search notes, opponents, drills, dates…" value="${esc(q)}" style="margin-bottom:10px">
    <div class="chips" style="margin-bottom:10px">${[['all', 'All'], ['workout', 'Workouts'], ['shooting', 'Shooting'], ['handles', 'Handles'], ['finishing', 'Finishing'], ['film', 'Film'], ['game', 'Games'], ['test', 'Tests']].map(([v, l]) => `<button type="button" class="chip ${k === v ? 'on' : ''}" data-hk="${v}">${l}</button>`).join('')}</div>
    ${items.length ? `<div class="list">${items.slice(0, 150).map((x) => `<div class="li" style="justify-content:flex-start;align-items:flex-start"><span style="width:20px;height:20px;flex:none;color:var(--accent)">${ICONS[x.icon]}</span><div style="flex:1;min-width:0"><div class="row-between"><span class="t">${esc(x.title)}</span><span class="tiny muted">${esc(fmtD(x.date))}</span></div><div class="s">${esc(x.sub)}</div>${x.text.trim() ? `<div class="s" style="font-style:italic">${esc(x.text.trim().slice(0, 140))}</div>` : ''}</div></div>`).join('')}</div>${items.length > 150 ? `<p class="muted tiny">Showing 150 of ${items.length}. Search to narrow it down.</p>` : ''}` : emptyState(all.length ? 'No matches' : 'No history yet', all.length ? 'Try another word or filter.' : 'Everything you log in Athlete OS and MacroLens shows up here.', 'calendar')}</section>`;
  $('#h-q').addEventListener('input', (e) => { setUi('hq', e.target.value); clearTimeout(TRAIN.hT); TRAIN.hT = setTimeout(() => { refresh(); const i = $('#h-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
};
document.addEventListener('click', (e) => { const c = e.target.closest('[data-hk]'); if (c) { setUi('hk', c.dataset.hk); refresh(); } });
