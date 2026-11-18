// ===================== ATHLETE CALENDAR =====================
// One schedule for everything: events (one-off or weekly), routines, test dates and games. Completing a training event
// logs the workout (training history + load), and completed routines count toward consistency.
// [key, label, color, workout type it logs (or null)]
const EV_TYPES = [
  ['practice', 'Team practice', 'var(--hb)', 'practice'], ['game', 'Game', '#ff6a3d', 'game'], ['shooting', 'Shooting workout', '#22c3ee', 'shooting'],
  ['skill', 'Skill workout', 'var(--accent)', 'skill'], ['workout', 'Workout', 'var(--accent)', 'skill'], ['lift', 'Strength training', 'var(--str)', 'lift'],
  ['conditioning', 'Conditioning', 'var(--cond)', 'conditioning'], ['recovery', 'Recovery', 'var(--good)', 'recovery'], ['film', 'Film study', '#a78bfa', null],
  ['nutrition', 'Nutrition reminder', 'var(--carbs)', null], ['sleep', 'Sleep', '#64748b', null], ['personal', 'Personal', '#94a3b8', null],
  ['testing', 'Testing day', 'var(--warn)', null], ['routine', 'Routine', '#f472b6', null],
];
const EV_PICK = EV_TYPES.filter((x) => !['workout', 'routine'].includes(x[0]));
const evType = (k) => EV_TYPES.find((x) => x[0] === k) || EV_TYPES[4];
const plan = () => doc('aos-plan');
const endTime = (start, mins) => (start && mins ? addMin(start, mins) : null);
const minsBetween = (a, b) => { if (!a || !b) return null; const d = toMinT(b) - toMinT(a); return d > 0 ? d : d + 1440; };
function occursOn(e, date) {
  if ((e.skip || []).includes(date)) return false;
  if (e.date === date) return true;
  return !!e.recur?.days?.includes(parseIso(date).getDay()) && date >= e.date && (!e.recur.until || date <= e.recur.until);
}
/** Everything scheduled on a date, sorted by time. */
function itemsOn(date) {
  const out = [];
  for (const e of plan().events || []) if (occursOn(e, date)) out.push({ key: 'e:' + e.id, title: e.title, type: e.type, time: e.start, end: e.end || endTime(e.start, e.mins), mins: e.mins || minsBetween(e.start, e.end), ev: e, recur: !!e.recur, notes: e.notes });
  for (const r of routinesOn(date)) out.push({ key: 'rt:' + r.id, title: r.name, type: 'routine', time: r.start || null, mins: routineMins(r), routine: r });
  for (const [tid, n] of Object.entries(doc('aos-tests').next || {})) if (n === date) { const t = testById(tid); if (t) out.push({ key: 't:' + tid, title: `Test: ${t.name}`, type: 'testing', test: tid }); }
  if (aos().profile?.nextGame === date && !out.some((x) => x.type === 'game')) out.push({ key: 'g:next', title: 'Game day', type: 'game' });
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}
const isChecked = (date, key) => (key.startsWith('rt:') ? routineComplete(date, key.slice(3)) : !!plan().checks?.[date]?.[key]);
function setChecked(date, key, v) {
  if (key.startsWith('rt:')) return setRoutineAll(date, key.slice(3), v);
  const P = plan(); P.checks = P.checks || {}; P.checks[date] = { ...(P.checks[date] || {}) };
  if (v) P.checks[date][key] = true; else delete P.checks[date][key];
  persist('aos-plan');
}
/** Scheduled vs completed vs missed over a set of days (missed = past and not done). Training items also count as done when the matching workout was logged. */
function adherence(days, filter = () => true) {
  let sched = 0, done = 0, missed = 0; const today = todayIso(), missedList = [];
  for (const d of days) for (const it of itemsOn(d).filter(filter)) {
    if (d > today) continue; sched++;
    const lt = evType(it.type)[3], ok = isChecked(d, it.key) || (lt && it.type !== 'routine' && exList(d).some((x) => x.type === lt));
    if (ok) done++; else if (d < today) { missed++; missedList.push({ d, it }); }
  }
  return { sched, done, missed, pct: sched ? done / sched : null, missedList };
}

// ----- views -----
TRAIN.plan = (el) => {
  const view = ui('calView', 'week'), sel = ui('calDay', todayIso());
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Athlete calendar</h3><span class="sub">Practices, games, workouts, recovery, routines, testing</span></div>
    <div class="row">${seg('calView', [['day', 'Day'], ['week', 'Week'], ['month', 'Month']], view)}<button type="button" class="btn sm primary" data-act="event" data-date="${sel}">＋ Event</button></div></div>
    <div id="cal-body"></div></section>
  <section class="card" id="day-card"></section>
  <div class="grid two"><section class="card" id="sched-dash"></section><section class="card" id="cal-dist"></section></div>`;
  calBody($('#cal-body'), view, sel);
  dayCard($('#day-card'), sel);
  schedDash($('#sched-dash'));
  calDist($('#cal-dist'));
};
function calBody(el, view, sel) {
  const nav = (label, step) => `<div class="row-between" style="margin-bottom:10px"><button type="button" class="icon-btn" data-calstep="-${step}" aria-label="Previous">‹</button><div style="text-align:center"><b style="font-family:var(--f-display)">${label}</b><br><button type="button" class="chip" data-calday="${todayIso()}" style="margin-top:4px;padding:2px 10px;font-size:11px">Today</button></div><button type="button" class="icon-btn" data-calstep="${step}" aria-label="Next">›</button></div>`;
  if (view === 'month') {
    const b = parseIso(sel.slice(0, 8) + '01'), y = b.getFullYear(), m = b.getMonth(), lead = (b.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    const cells = []; for (let i = 0; i < lead; i++) cells.push(null); for (let d = 1; d <= n; d++) cells.push(isoDate(new Date(y, m, d, 12)));
    el.innerHTML = nav(`${MON[m]} ${y}`, 'm') + `<div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="cal-h">${d}</span>`).join('')}${cells.map((d) => { if (!d) return '<span></span>'; const its = itemsOn(d), a = adherence([d]);
      return `<button type="button" class="cal-d ${d === sel ? 'sel' : ''} ${d === todayIso() ? 'today' : ''}" data-calday="${d}" aria-label="${esc(fmtDL(d))}: ${its.length} items"><span>${parseIso(d).getDate()}</span><i class="cal-dots">${its.slice(0, 4).map((x) => `<b style="background:${evType(x.type)[2]}"></b>`).join('')}</i>${isActive(d) ? '<em class="cal-act" title="Trained"></em>' : ''}${a.sched && a.done === a.sched ? '<em class="cal-done">✓</em>' : a.missed ? '<em class="cal-done" style="color:var(--danger)">•</em>' : ''}</button>`; }).join('')}</div>
      <div class="legend">${EV_PICK.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>`;
  } else if (view === 'week') {
    const mon = mondayOf(sel), days = lastNDays(7, shiftIso(mon, 6));
    el.innerHTML = nav(`${fmtD(mon)} – ${fmtD(shiftIso(mon, 6))}`, 'w') + `<div class="wk">${days.map((d) => { const its = itemsOn(d); return `<div class="wk-col ${d === todayIso() ? 'today' : ''} ${d === sel ? 'sel' : ''}"><button type="button" class="wk-h" data-calday="${d}"><b>${DOW[parseIso(d).getDay()]}</b><span>${parseIso(d).getDate()}</span></button>${its.map((x) => `<button type="button" class="wk-ev ${isChecked(d, x.key) ? 'done' : ''}" style="--c:${evType(x.type)[2]}" data-calday="${d}"><span class="tiny">${x.time ? fmtClock(x.time) : ''}</span>${esc(x.title)}</button>`).join('') || '<span class="tiny muted" style="padding:4px">—</span>'}</div>`; }).join('')}</div>`;
  } else {
    el.innerHTML = nav(fmtDL(sel), 'd') + timeline(sel);
  }
}
function timeline(date) {
  const its = itemsOn(date), timed = its.filter((x) => x.time), untimed = its.filter((x) => !x.time);
  if (!its.length) return emptyState('Nothing scheduled', 'Add a practice, workout, routine or reminder for this day.', 'calendar', `<button type="button" class="btn sm primary" data-act="event" data-date="${date}">＋ Add event</button>`);
  const h0 = Math.min(7, ...timed.map((x) => Math.floor(toMinT(x.time) / 60))), h1 = Math.max(21, ...timed.map((x) => Math.ceil((toMinT(x.time) + (x.mins || 30)) / 60)));
  const px = 44, now = date === todayIso() ? nowM() : null;
  return `${untimed.length ? `<div class="chips" style="margin-bottom:8px">${untimed.map((x) => `<span class="tag" style="border-left:3px solid ${evType(x.type)[2]}">${esc(x.title)}</span>`).join('')}</div>` : ''}
    <div class="tlday" style="height:${(h1 - h0) * px}px">${Array.from({ length: h1 - h0 }, (_, i) => `<div class="tlh" style="top:${i * px}px"><span>${fmtClock(String(h0 + i).padStart(2, '0') + ':00')}</span></div>`).join('')}
    ${now != null && now / 60 >= h0 && now / 60 <= h1 ? `<div class="tlnow" style="top:${((now - h0 * 60) / 60) * px}px"></div>` : ''}
    ${timed.map((x) => { const top = ((toMinT(x.time) - h0 * 60) / 60) * px, h = Math.max(24, ((x.mins || 30) / 60) * px - 2); return `<button type="button" class="tlev ${isChecked(date, x.key) ? 'done' : ''}" style="top:${top}px;height:${h}px;--c:${evType(x.type)[2]}" ${x.ev ? `data-act="event" data-id="${x.ev.id}" data-date="${date}"` : x.routine ? `data-act="run-routine" data-id="${x.routine.id}" data-date="${date}"` : ''}><b>${esc(x.title)}</b><span class="tiny">${fmtClock(x.time)}${x.end ? '–' + fmtClock(x.end) : ''} · ${esc(evType(x.type)[1])}</span></button>`; }).join('')}</div>`;
}
const nowM = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-calstep]'); if (s) { const v = s.dataset.calstep, n = Number(v.slice(0, -1)), u = v.slice(-1), d = parseIso(ui('calDay', todayIso())); if (u === 'm') { d.setDate(1); d.setMonth(d.getMonth() + n); } else d.setDate(d.getDate() + (u === 'w' ? 7 * n : n)); setUi('calDay', isoDate(d)); return refresh(); }
  const d = e.target.closest('[data-calday]'); if (d && !d.closest('[data-go]')) { setUi('calDay', d.dataset.calday); return refresh(); }
});
function checklistHtml(date, items) {
  return `<div class="list">${items.map((x) => { const on = isChecked(date, x.key), [, l, c] = evType(x.type), past = date < todayIso() && !on; return `<div class="li"><label class="check" style="flex:1;min-width:0"><input type="checkbox" data-chk="${date}|${esc(x.key)}" ${on ? 'checked' : ''} aria-label="Mark ${esc(x.title)} done"><span class="dot" style="background:${c}"></span><span style="min-width:0"><span class="t" style="${on ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(x.title)}</span><span class="s" style="display:block">${[x.time ? fmtClock(x.time) + (x.end ? '–' + fmtClock(x.end) : '') : '', x.mins && !x.end ? fmtDur(x.mins) : '', l, x.recur ? 'repeats' : '', past ? '<span class="down">missed</span>' : ''].filter(Boolean).join(' · ')}</span>${x.notes ? `<span class="s" style="display:block;font-style:italic">${esc(x.notes)}</span>` : ''}</span></label>${x.ev ? `<button type="button" class="chip" data-act="event" data-id="${x.ev.id}" data-date="${date}">Edit</button>` : ''}${x.routine ? `<button type="button" class="chip" data-act="run-routine" data-id="${x.routine.id}" data-date="${date}">▶ Start</button>` : ''}${x.test ? `<button type="button" class="chip" data-act="add-test" data-tid="${x.test}">Log</button>` : ''}</div>`; }).join('')}</div>`;
}
function dayCard(el, d) {
  const items = itemsOn(d), a = adherence([d]);
  el.innerHTML = `<div class="card-head"><div><h3>${esc(fmtDL(d))}</h3><span class="sub">${items.length ? `${a.done} of ${a.sched || items.length} done${a.missed ? ` · ${a.missed} missed` : ''}` : 'Nothing scheduled'}</span></div><button type="button" class="btn sm" data-act="event" data-date="${d}">＋ Add</button></div>
    ${items.length ? checklistHtml(d, items) : '<p class="muted small">Open day.</p>'}${exList(d).length ? `<div class="hr"></div><p class="muted small">Logged: ${exList(d).map((x) => `${esc(x.name)} (${fmtDur(x.mins)})`).join(', ')}</p>` : ''}`;
}
document.addEventListener('change', (e) => {
  const c = e.target.closest('[data-chk]'); if (!c) return;
  const [date, key] = c.dataset.chk.split('|'); setChecked(date, key, c.checked);
  const it = itemsOn(date).find((x) => x.key === key), lt = it && it.type !== 'routine' && evType(it.type)[3];
  if (c.checked && lt && date <= todayIso() && !exList(date).some((x) => x.type === lt && x.event === it.ev?.id)) { refresh(); return openWorkoutSheet({ date, type: lt, name: it.title, mins: it.mins || 60, time: it.time, event: it.ev?.id }); }
  if (c.checked && it?.type === 'film') { refresh(); return ACTIONS['add-film']({ dataset: { date } }); }
  refresh();
});
function schedDash(el) {
  const today = todayIso(), now = nowM(), its = itemsOn(today);
  let next = its.find((x) => x.time && toMinT(x.time) >= now && !isChecked(today, x.key)), nextDay = today;
  for (let i = 1; !next && i <= 14; i++) { const d = shiftIso(today, i), n = itemsOn(d).find((x) => x.type !== 'routine'); if (n) { next = n; nextDay = d; } }
  const wk = lastNDays(7, shiftIso(mondayOf(today), 6)), aw = adherence(wk), past7 = adherence(lastNDays(7));
  const up = (type) => { const out = []; for (let i = 0; i <= 45 && out.length < 4; i++) { const d = shiftIso(today, i); for (const x of itemsOn(d)) if (x.type === type) out.push({ d, x }); } return out; };
  const gamesUp = up('game'), testsUp = up('testing');
  el.innerHTML = `<div class="card-head"><div><h3>Schedule dashboard</h3></div></div>
    ${next ? `<div class="notice" style="border-left:3px solid ${evType(next.type)[2]}"><span class="tiny muted">NEXT UP · ${nextDay === today ? 'TODAY' : esc(fmtDL(nextDay)).toUpperCase()}</span><br><b style="color:var(--fg);font-size:16px">${esc(next.title)}</b> <span class="small">${next.time ? fmtClock(next.time) : ''}${next.time && nextDay === today ? ` · in ${fmtDur(toMinT(next.time) - now)}` : ''}</span></div>` : '<p class="muted small">Nothing coming up in the next two weeks.</p>'}
    <div class="kpis" style="margin-top:10px"><div class="kpi"><small>This week</small><b>${aw.done}/${aw.sched}</b><span class="tiny muted">completed so far</span></div><div class="kpi"><small>Missed (7 days)</small><b class="${past7.missed ? 'down' : ''}">${past7.missed}</b><span class="tiny muted">${past7.pct == null ? 'no plan' : pctTxt(past7.pct) + ' adherence'}</span></div></div>
    <h4 style="margin:12px 0 4px">Weekly training schedule</h4><div class="list">${wk.map((d) => { const t = itemsOn(d).filter((x) => evType(x.type)[3]); return t.length ? `<div class="li"><span class="small"><b>${DOW[parseIso(d).getDay()]}</b> ${t.map((x) => esc(x.title)).join(', ')}</span><span class="tiny ${t.every((x) => isChecked(d, x.key)) ? 'up' : d < today ? 'down' : 'muted'}">${t.every((x) => isChecked(d, x.key)) ? '✓ done' : d < today ? 'missed' : d === today ? 'today' : ''}</span></div>` : ''; }).join('') || '<p class="muted small">No training on the calendar this week.</p>'}</div>
    ${gamesUp.length ? `<h4 style="margin:12px 0 4px">Upcoming games</h4>${gamesUp.map(({ d, x }) => `<p class="small">🏀 ${esc(fmtDL(d))}${x.time ? ' · ' + fmtClock(x.time) : ''} · ${esc(x.title)}</p>`).join('')}` : ''}
    ${testsUp.length ? `<h4 style="margin:12px 0 4px">Upcoming testing</h4>${testsUp.map(({ d, x }) => `<p class="small">⏱ ${esc(fmtDL(d))} · ${esc(x.title)}</p>`).join('')}` : ''}
    ${past7.missedList.length ? `<details style="margin-top:8px"><summary class="small down" style="cursor:pointer">Missed activities (${past7.missedList.length})</summary>${past7.missedList.map(({ d, it }) => `<p class="small">${esc(fmtD(d))} · ${esc(it.title)}</p>`).join('')}</details>` : ''}
    <div class="row" style="margin-top:12px"><button type="button" class="btn sm" data-act="ics">Add to phone calendar (.ics)</button></div>`;
}
function calDist(el) {
  const r = ui('distR', '28'), days = lastNDays(Number(r)), by = {};
  for (const d of days) for (const x of itemsOn(d)) { const k = x.type; by[k] = by[k] || { n: 0, mins: 0, done: 0 }; by[k].n++; by[k].mins += x.mins || 0; if (isChecked(d, x.key)) by[k].done++; }
  const parts = Object.entries(by).map(([k, v]) => ({ label: evType(k)[1], v: v.n, color: evType(k)[2], done: v.done })).sort((a, b) => b.v - a.v);
  el.innerHTML = `<div class="card-head"><div><h3>Activity distribution</h3><span class="sub">Scheduled items by category</span></div>${seg('distR', [['7', '7D'], ['28', '28D'], ['90', '90D']], r)}</div>
    ${parts.length ? donut(parts, { label: 'Calendar activity by category', fmt: (v) => v + ' scheduled' }) + `<div class="cmp" style="margin-top:12px;grid-template-columns:minmax(0,1.4fr) repeat(2,minmax(0,1fr))"><span class="h">Category</span><span class="h">Done</span><span class="h">Rate</span>${parts.map((p) => `<span>${esc(p.label)}</span><b>${p.done}/${p.v}</b><b>${pctTxt(p.done / p.v)}</b>`).join('')}</div>` : emptyState('Nothing scheduled', 'Add events and routines to see how your time splits.', 'calendar')}`;
}

// ----- create / edit events -----
ACTIONS.event = (b) => {
  const e = b.dataset.id ? (plan().events || []).find((x) => x.id === b.dataset.id) : null, date = b.dataset.date || todayIso();
  const days = e?.recur?.days || [], start = e?.start || '', end = e?.end || endTime(e?.start, e?.mins) || '';
  openSheet(e ? 'Edit event' : 'New event', `<div class="fields">
    <label class="full">Title<input id="ev-title" maxlength="50" value="${esc(e?.title || '')}" placeholder="Varsity practice, Lower-body lift, Dentist…"></label>
    <label>Category<select id="ev-type">${EV_PICK.map(([k, l]) => `<option value="${k}" ${(e?.type || 'practice') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Date<input type="date" id="ev-date" value="${e?.date || date}"></label>
    <label>Start<input type="time" id="ev-start" value="${start}"></label><label>End<input type="time" id="ev-end" value="${end}"></label>
    <label>Reminder<select id="ev-rem">${[[0, 'None'], [10, '10 min before'], [30, '30 min before'], [60, '1 hour before'], [120, '2 hours before']].map(([v, l]) => `<option value="${v}" ${Number(e?.remind || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Repeat until<input type="date" id="ev-until" value="${e?.recur?.until || ''}"></label>
    <label class="full">Description / notes<textarea id="ev-notes" maxlength="400" style="min-height:60px">${esc(e?.notes || '')}</textarea></label></div>
    <div><p class="muted small" style="margin-bottom:6px">Repeat weekly on</p><div class="chips" id="ev-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="chip ${days.includes(d) ? 'on' : ''}" data-dow="${d}">${DOW[d]}</button>`).join('')}</div></div>
    <p class="muted tiny">Reminders pop up while Athlete OS is open. For alerts on your phone's lock screen, use "Add to phone calendar" (push notifications need a native app).</p>
    <div class="row"><button type="button" class="btn primary" id="ev-save" style="flex:1">Save</button>${e ? `${e.recur ? '<button type="button" class="btn" id="ev-skip">Skip this day</button>' : ''}<button type="button" class="btn danger" id="ev-del">Delete</button>` : ''}</div>`, (d) => {
    $('#ev-days', d).addEventListener('click', (x) => { const c = x.target.closest('[data-dow]'); if (c) c.classList.toggle('on'); });
    $('#ev-save', d).addEventListener('click', () => {
      const s = $('#ev-start', d).value || null, en = $('#ev-end', d).value || null;
      const title = $('#ev-title', d).value.trim() || evType($('#ev-type', d).value)[1], dd = $$('[data-dow].on', d).map((x) => Number(x.dataset.dow));
      if (en && !s) return toast('Add a start time too');
      const rec = { id: e?.id || uid('e'), title: title.slice(0, 50), type: $('#ev-type', d).value, date: $('#ev-date', d).value || date, start: s, end: en, mins: s && en ? minsBetween(s, en) : e?.mins && !en ? e.mins : null, remind: Number($('#ev-rem', d).value) || 0, notes: $('#ev-notes', d).value.trim().slice(0, 400), recur: dd.length ? { days: dd, until: $('#ev-until', d).value || null } : null, skip: e?.skip || [], program: e?.program };
      plan().events = [...(plan().events || []).filter((x) => x.id !== rec.id), rec]; persist('aos-plan'); closeSheet(); toast('Saved to calendar'); refresh();
    });
    $('#ev-skip', d)?.addEventListener('click', () => { e.skip = [...(e.skip || []), date]; persist('aos-plan'); closeSheet(); refresh(); });
    $('#ev-del', d)?.addEventListener('click', () => confirmSheet(`Delete "${e.title}"${e.recur ? ' and all its repeats' : ''}?`, 'Delete', () => { plan().events = plan().events.filter((x) => x.id !== e.id); persist('aos-plan'); refresh(); }));
  });
};
// In-app reminders while the app is open (checked every 30 s).
function checkReminders() {
  const today = todayIso(), now = nowM();
  let fired = []; try { fired = JSON.parse(sessionStorage.getItem('aos-rem') || '[]'); } catch {}
  for (const x of itemsOn(today)) {
    const rem = x.ev?.remind; if (!rem || !x.time || isChecked(today, x.key)) continue;
    const st = toMinT(x.time), key = today + x.key;
    if (now >= st - rem && now < st && !fired.includes(key)) { fired.push(key); toast(`⏰ ${x.title} at ${fmtClock(x.time)} (in ${st - now} min)`); if (navigator.vibrate) navigator.vibrate([40, 60, 40]); }
  }
  try { sessionStorage.setItem('aos-rem', JSON.stringify(fired.slice(-50))); } catch {}
}
setInterval(checkReminders, 30000);
// Phone calendar export: the next 60 days as an .ics file (works with Apple/Google Calendar alerts).
ACTIONS.ics = async () => {
  const pad = (n) => String(n).padStart(2, '0'), stamp = (d, t) => d.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Athlete OS//EN'];
  for (let i = 0; i < 60; i++) { const d = shiftIso(todayIso(), i); for (const x of itemsOn(d)) { if (!x.time) continue; const end = x.end || addMin(x.time, x.mins || 60);
    lines.push('BEGIN:VEVENT', `UID:${x.key}-${d}@athleteos`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART:${stamp(d, x.time)}`, `DTEND:${stamp(d, end)}`, `SUMMARY:${x.title.replace(/[,;]/g, ' ')}`, ...(x.notes ? [`DESCRIPTION:${x.notes.replace(/\n/g, ' ').replace(/[,;]/g, ' ')}`] : []), ...(x.ev?.remind ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${x.title.replace(/[,;]/g, ' ')}`, `TRIGGER:-PT${x.ev.remind}M`, 'END:VALARM'] : []), 'END:VEVENT'); } }
  lines.push('END:VCALENDAR'); const data = lines.join('\r\n'), n = lines.filter((l) => l === 'BEGIN:VEVENT').length;
  if (!n) return toast('No timed events in the next 60 days');
  try { const dl = window.claude?.use ? await claude.use('downloads') : null; if (!dl) throw new Error('none'); await dl.save({ filename: 'athlete-os-schedule.ics', data }); toast(`Exported ${n} events`); }
  catch (e) { if (e?.code === 'declined') return; openSheet('Calendar file', `<p class="small">Downloading isn't available here. Copy this, save it as <b>schedule.ics</b> and open it on your phone.</p><textarea readonly style="min-height:200px;font-size:11px">${esc(data)}</textarea>`); }
};
