'use strict';
// ===================== Planner: day, week, month, agenda =====================
const pl = { view: window.innerWidth < 700 ? 'day' : 'week', date: null, hide: new Set() };
const EV_KINDS = { personal: ['Personal', '#94a3b8'], study: ['Study block', '#6d7cff'], activity: ['Practice / activity', '#fb923c'], work: ['Work', '#2dd4bf'], other: ['Other', '#c084fc'] };
const FILTERS = [['class', 'Classes'], ['due', 'Due work'], ['exam', 'Exams'], ['study', 'Study'], ['event', 'Events']];
/** Everything on a date, normalized. Timed items have start/end minutes. Nothing here moves or edits records. */
function itemsOn(d) {
  const out = [], wd = dow(d);
  for (const c of S.classes) for (const s of c.schedule || []) if (s.days.includes(wd)) out.push({ k: 'class', id: c.id, title: c.name, s: toMin(s.start), e: toMin(s.end) || toMin(s.start) + 50, color: c.color, sub: c.room || c.teacher || '' });
  for (const ev of S.events) { if (!(ev.date === d || (ev.weekly && ev.date < d && dow(ev.date) === wd && (!ev.until || d <= ev.until) && !(ev.skip || []).includes(d)))) continue;
    out.push({ k: ev.kind === 'study' ? 'study' : 'event', id: ev.id, title: ev.title, s: ev.allDay ? null : toMin(ev.start), e: ev.allDay ? null : toMin(ev.end) || toMin(ev.start) + 60, color: ev.color || (ev.classId ? clsColor(ev.classId) : EV_KINDS[ev.kind]?.[1]), sub: ev.classId ? clsName(ev.classId) : EV_KINDS[ev.kind]?.[0], ev }); }
  for (const e of S.exams) { if (e.date === d) out.push({ k: 'exam', id: e.id, title: e.title, s: e.time ? toMin(e.time) : null, e: e.time ? toMin(e.time) + 60 : null, color: clsColor(e.classId), sub: clsName(e.classId) + ' exam' });
    for (const p of e.plan || []) if (p.date === d) out.push({ k: 'study', id: e.id, pid: p.id, title: p.label, s: null, color: clsColor(e.classId), sub: `${fmtMins(p.mins)} · prep for ${e.title}`, done: p.done, mins: p.mins }); }
  for (const a of S.assignments) if (a.due === d) out.push({ k: 'due', id: a.id, title: a.title, s: a.dueTime ? toMin(a.dueTime) : null, e: null, color: clsColor(a.classId), sub: `${clsName(a.classId)} · ${STATUS[effStatus(a)][0]}`, done: isDone(a) });
  for (const s of S.sessions) if (isoOf(new Date(s.start)) === d && s.mode !== 'exam-plan') { const st = new Date(s.start); out.push({ k: 'study', id: s.id, logged: true, title: s.topic || clsName(s.classId), s: st.getHours() * 60 + st.getMinutes(), e: st.getHours() * 60 + st.getMinutes() + s.mins, color: clsColor(s.classId), sub: `Logged · ${fmtMins(s.mins)}` }); }
  return out.filter((x) => !pl.hide.has(x.k));
}
function conflictsOn(items) { const t = items.filter((x) => x.s != null && x.e != null && x.e > x.s && !x.logged && x.k !== 'due'); const bad = new Set(), pairs = []; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i].s < t[j].e && t[j].s < t[i].e) { bad.add(t[i]); bad.add(t[j]); pairs.push([t[i], t[j]]); } return { bad, pairs }; }
VIEWS.planner = (rt) => {
  if (['day', 'week', 'month', 'agenda'].includes(rt.arg)) pl.view = rt.arg;
  pl.date = rt.sub && /^\d{4}-\d\d-\d\d$/.test(rt.sub) ? rt.sub : pl.date || today();
  const d = pl.date, step = { day: 1, week: 7, month: 0, agenda: 14 }[pl.view];
  const label = pl.view === 'day' ? fmtDay(d) : pl.view === 'week' ? `${fmtDate(weekStart(d))} – ${fmtDate(addDays(weekStart(d), 6))}` : pl.view === 'month' ? parseIso(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : `${fmtDate(d)} – ${fmtDate(addDays(d, 13))}`;
  const body = { day: () => timeGrid([d]), week: () => timeGrid(Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i))), month: () => monthGrid(d), agenda: () => agenda(d) }[pl.view]();
  const days = pl.view === 'day' ? [d] : pl.view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i)) : pl.view === 'agenda' ? Array.from({ length: 14 }, (_, i) => addDays(d, i)) : [];
  const conf = days.flatMap((x) => conflictsOn(itemsOn(x)).pairs.map((p) => [x, p]));
  return {
    title: 'Planner', sub: label,
    actions: `<button class="btn ghost sm" id="pl-ics" title="Export calendar (.ics)">${icon('download', 15)}<span class="hide-sm">Export</span></button><button class="btn primary sm" id="pl-new">${icon('plus', 15)} Event</button>`,
    html: `<div class="between" style="flex-wrap:wrap;gap:10px"><div class="row"><button class="icon-btn" id="pl-prev" aria-label="Previous">${icon('chevron-left', 18)}</button><button class="btn sm" id="pl-today">Today</button><button class="icon-btn" id="pl-next" aria-label="Next">${icon('chevron-right', 18)}</button><b style="font-family:var(--f-display);margin-left:6px">${label}</b></div>
        <div class="seg" id="pl-view">${['day', 'week', 'month', 'agenda'].map((v) => `<button class="${pl.view === v ? 'on' : ''}" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
      <div class="chips" id="pl-f">${FILTERS.map(([k, l]) => `<button class="chip${pl.hide.has(k) ? '' : ' on'}" data-f="${k}">${l}</button>`).join('')}</div>
      ${conf.length ? `<div class="alert warn"><span class="ai">${icon('triangle-alert', 15)}</span><span><b>${conf.length} time conflict${conf.length === 1 ? '' : 's'}</b><br><span class="small muted">${conf.slice(0, 3).map(([x, [a, b]]) => `${DAYS[dow(x)]}: ${esc(a.title)} overlaps ${esc(b.title)}`).join(' · ')}. Nothing is moved automatically; edit an item to fix it.</span></span></div>` : ''}
      ${days.length && pl.view !== 'agenda' ? workloadStrip(days) : ''}
      <div class="card" style="padding:${pl.view === 'month' ? '14px' : '0'};overflow:hidden">${body}</div>`,
    mount(root) {
      const nav = (n) => { const nd = pl.view === 'month' ? (() => { const p = parseIso(d); p.setDate(1); p.setMonth(p.getMonth() + n); return isoOf(p); })() : addDays(d, n * step); go('planner', pl.view, nd); };
      $('#pl-prev', root).onclick = () => nav(-1); $('#pl-next', root).onclick = () => nav(1); $('#pl-today', root).onclick = () => go('planner', pl.view, today());
      $('#pl-view', root).onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) go('planner', b.dataset.v, d); };
      $('#pl-f', root).onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; pl.hide.has(b.dataset.f) ? pl.hide.delete(b.dataset.f) : pl.hide.add(b.dataset.f); render(); };
      $('#pl-new').onclick = () => editEvent(null, { date: d }); $('#pl-ics').onclick = exportICS;
      root.addEventListener('click', (e) => {
        const it = e.target.closest('[data-k]');
        if (it) { e.stopPropagation(); const { k, id, pid, logged } = it.dataset;
          if (k === 'due') return openAssignment(id); if (k === 'exam') return go('exams', id); if (k === 'class') return go('classes', id);
          if (pid) return go('exams', id); if (logged) return go('study', 'timer'); return editEvent(byId('events', id)); }
        const md = e.target.closest('[data-day]'); if (md) return go('planner', 'day', md.dataset.day);
        const col = e.target.closest('.tg-col[data-date]'); if (col) { const y = e.clientY - col.getBoundingClientRect().top, m = Math.floor((GRID.from * 60 + (y / 52) * 60) / 30) * 30; editEvent(null, { date: col.dataset.date, start: fromMin(m), end: fromMin(Math.min(m + 60, 23 * 60 + 59)) }); }
      });
      const sc = $('.tg-scroll', root); if (sc) { const nowM = new Date().getHours() * 60 + new Date().getMinutes(); const tgt = $('.tg-now', root) ? ((nowM - GRID.from * 60) / 60) * 52 - sc.clientHeight / 3 : (8 - GRID.from) * 52; sc.scrollTop = Math.max(0, tgt); }
    },
  };
};
function workloadStrip(days) {
  return `<div class="grid wl" style="grid-template-columns:repeat(${days.length},minmax(0,1fr));gap:6px">${days.map((d) => { const its = itemsOn(d), due = S.assignments.filter((a) => a.due === d && !isDone(a)), w = workloadOn(d), st = sum(its.filter((x) => x.k === 'study' && !x.logged).map((x) => x.mins || (x.e && x.s != null ? x.e - x.s : 0))), cl = sum(its.filter((x) => x.k === 'class').map((x) => x.e - x.s)), load = w + st, lvl = load > 180 ? 'bad' : load > 90 ? 'warn' : 'good';
    return `<div class="card flat" style="padding:8px 10px;border-color:${d === today() ? 'var(--accent)' : 'var(--line)'}" data-tip="${esc(`<b>${fmtDay(d)}</b><br>${fmtMins(cl)} of class<br>${due.length} due (${fmtMins(w)})<br>${fmtMins(st)} study planned`)}"><div class="between tiny"><b>${days.length > 1 ? DAYS[dow(d)] : 'Workload'}</b><span class="${lvl}">${load ? fmtMins(load) : 'free'}</span></div><div class="bar" style="height:4px;margin-top:5px"><i style="width:${clamp((load / 240) * 100, 0, 100)}%;--c:var(--${lvl})"></i></div></div>`; }).join('')}</div>`;
}
const GRID = { from: 7, to: 22 };
function timeGrid(days) {
  const all = days.map((d) => ({ d, its: itemsOn(d) }));
  const timed = all.flatMap((x) => x.its.filter((i) => i.s != null));
  GRID.from = Math.max(0, Math.min(7, ...timed.map((i) => Math.floor(i.s / 60)))); GRID.to = Math.min(24, Math.max(22, ...timed.map((i) => Math.ceil((i.e ?? i.s + 30) / 60))));
  const H = 52, top = (m) => ((m - GRID.from * 60) / 60) * H, hours = []; for (let h = GRID.from; h < GRID.to; h++) hours.push(h);
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const chip = (i) => `<div class="ev${i.k === 'exam' ? ' exam' : ''}" style="--c:${i.color};${i.done ? 'opacity:.55;text-decoration:line-through' : ''};cursor:pointer" data-k="${i.k}" data-id="${i.id}"${i.pid ? ` data-pid="${i.pid}"` : ''} title="${esc(i.title + ' · ' + i.sub)}">${icon({ due: 'list-checks', exam: 'graduation-cap', study: 'brain', event: 'calendar' }[i.k] || 'circle', 11)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(i.title)}</span></div>`;
  let html = `<div class="tg" style="--days:${days.length}"><div class="tg-h" style="border-right:0"></div>${all.map(({ d }) => `<div class="tg-h${d === today() ? ' today' : ''}" data-day="${d}" style="cursor:pointer">${days.length > 1 ? `${DAYS[dow(d)]} <span style="font:700 15px var(--f-display);display:block">${+d.slice(8)}</span>` : fmtDay(d)}</div>`).join('')}
    <div class="tg-lbl" style="height:auto;padding:4px 8px 4px 0;transform:none;font-size:10px">all day</div>${all.map(({ d, its }) => `<div class="tg-due" style="border-left:1px solid var(--line)">${its.filter((i) => i.s == null).map(chip).join('')}</div>`).join('')}</div>`;
  html += `<div class="tg-scroll" style="max-height:62vh;overflow:auto"><div class="tg" style="--days:${days.length}"><div>${hours.map((h) => `<div class="tg-lbl">${h % 12 || 12}${h < 12 ? 'am' : 'pm'}</div>`).join('')}</div>`;
  for (const { d, its } of all) {
    const t = its.filter((i) => i.s != null).sort((a, b) => a.s - b.s), { bad } = conflictsOn(t);
    const lanes = []; for (const i of t) { const e = i.e ?? i.s + 30; let l = lanes.findIndex((end) => end <= i.s); if (l < 0) { l = lanes.length; lanes.push(e); } else lanes[l] = e; i.lane = l; }
    const n = Math.max(1, lanes.length);
    html += `<div class="tg-col" data-date="${d}">${hours.map(() => '<div class="tg-hour"></div>').join('')}
      ${t.map((i) => { const e = i.e ?? i.s + 30, h = Math.max(22, top(e) - top(i.s) - 2); return `<div class="tg-ev${bad.has(i) ? ' conflict' : ''}" style="--c:${i.color};top:${top(i.s)}px;height:${h}px;left:calc(${(i.lane / n) * 100}% + 3px);right:auto;width:calc(${100 / n}% - 6px);${i.logged ? 'opacity:.6;border-left-style:dashed' : ''}${i.k === 'due' ? ';border-left-width:5px' : ''}" data-k="${i.k}" data-id="${i.id}"${i.logged ? ' data-logged="1"' : ''}>${esc(i.title)}${h > 34 ? `<small>${fmtTime(fromMin(i.s))}${i.e ? '–' + fmtTime(fromMin(Math.min(e, 1439))) : ''} · ${esc(i.sub)}</small>` : ''}</div>`; }).join('')}
      ${d === today() && nowM >= GRID.from * 60 && nowM < GRID.to * 60 ? `<div class="tg-now" style="top:${top(nowM)}px"></div>` : ''}</div>`;
  }
  return html + '</div></div><p class="tiny dim" style="padding:8px 14px;margin:0">Click an empty time to add an event. Dashed blocks are study time you logged. Red outlines are overlaps.</p>';
}
function monthGrid(d) {
  const first = d.slice(0, 8) + '01', start = weekStart(first), mo = d.slice(5, 7); let h = `<div class="cal-month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => `<div class="dow">${x}</div>`).join('')}`;
  for (let i = 0; i < 42; i++) {
    const x = addDays(start, i); if (i >= 35 && x.slice(5, 7) !== mo) break;
    const its = itemsOn(x).filter((it) => it.k !== 'class').sort((a, b) => ({ exam: 0, due: 1, event: 2, study: 3 }[a.k] - { exam: 0, due: 1, event: 2, study: 3 }[b.k]));
    const cl = itemsOn(x).filter((it) => it.k === 'class');
    h += `<div class="d${x.slice(5, 7) !== mo ? ' out' : ''}${x === today() ? ' today' : ''}" data-day="${x}"><div class="n"><span>${+x.slice(8)}</span>${cl.length ? `<span class="row" style="gap:2px">${cl.slice(0, 4).map((c) => `<i class="dot-c" style="--c:${c.color};width:6px;height:6px"></i>`).join('')}</span>` : ''}</div>
      ${its.slice(0, 3).map((it) => `<div class="ev${it.k === 'exam' ? ' exam' : ''}" style="--c:${it.color};${it.done ? 'opacity:.5' : ''}" data-k="${it.k}" data-id="${it.id}"${it.pid ? ` data-pid="${it.pid}"` : ''}>${icon({ due: 'list-checks', exam: 'graduation-cap', study: 'brain', event: 'calendar' }[it.k], 11)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(it.title)}</span></div>`).join('')}${its.length > 3 ? `<span class="tiny muted">+${its.length - 3} more</span>` : ''}</div>`;
  }
  return h + '</div>';
}
function agenda(d) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(d, i)).map((x) => ({ x, its: itemsOn(x).sort((a, b) => (a.s ?? -1) - (b.s ?? -1)) })).filter((g) => g.its.length);
  if (!days.length) return `<div style="padding:18px">${emptyState('calendar-days', 'Nothing in the next two weeks', 'Add classes with meeting times, assignments, exams or events.')}</div>`;
  return `<div style="padding:6px 18px 14px">${days.map(({ x, its }) => { const { bad } = conflictsOn(its); return `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="between" style="margin-bottom:6px"><b class="${x === today() ? '' : ''}" style="${x === today() ? 'color:var(--accent)' : ''}">${relDay(x)} <span class="muted small" style="font-weight:500">${fmtDay(x)}</span></b><span class="tiny muted">${fmtMins(workloadOn(x))} due</span></div>${its.map((i) => `<div class="li click" data-k="${i.k}" data-id="${i.id}"${i.pid ? ` data-pid="${i.pid}"` : ''}${i.logged ? ' data-logged="1"' : ''} style="padding:7px 8px"><span class="tiny muted num" style="width:64px">${i.s != null ? fmtTime(fromMin(i.s)) : i.k === 'due' ? 'due' : 'any time'}</span><span class="cbar" style="--c:${i.color}"></span><span class="grow"><span class="t" style="${i.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(i.title)}</span><div class="s">${esc(i.sub)}</div></span>${bad.has(i) ? '<span class="badge bad">overlap</span>' : ''}<span class="badge">${{ class: 'Class', due: 'Due', exam: 'Exam', study: 'Study', event: 'Event' }[i.k]}</span></div>`).join('')}</div>`; }).join('')}</div>`;
}
function editEvent(rec, preset = {}) {
  const isNew = !rec;
  const ev = rec ? { ...rec } : { id: uid('v'), title: '', date: preset.date || today(), start: preset.start || '16:00', end: preset.end || '17:00', allDay: false, kind: 'personal', classId: '', color: '', weekly: false, until: '', notes: '', ...preset };
  modal({ title: isNew ? 'New event' : 'Edit event', icon: 'calendar-plus',
    body: `<div class="fgrid"><label class="f full">Title<input type="text" name="title" value="${esc(ev.title)}" placeholder="e.g. Basketball practice" autofocus></label>
      <label class="f">Type<select name="kind">${Object.entries(EV_KINDS).map(([k, [l]]) => `<option value="${k}"${ev.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="f">Class (optional)<select name="classId">${classOptions(ev.classId, 'None')}</select></label>
      <label class="f">Date<input type="date" name="date" value="${ev.date}"></label><label class="row small" style="align-self:end"><input type="checkbox" name="allDay" ${ev.allDay ? 'checked' : ''}> All day</label>
      <label class="f">Start<input type="time" name="start" value="${ev.start || ''}"></label><label class="f">End<input type="time" name="end" value="${ev.end || ''}"></label>
      <label class="row small"><input type="checkbox" name="weekly" ${ev.weekly ? 'checked' : ''}> Repeat every week</label><label class="f">Until (optional)<input type="date" name="until" value="${ev.until || ''}"></label>
      <label class="f full">Notes<textarea name="notes" rows="2" style="min-height:0">${esc(ev.notes || '')}</textarea></label></div><div id="ev-w"></div>`,
    foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${icon('trash-2', 15)} Delete</button>`}<span class="grow"></span><button class="btn ghost" data-x2>Cancel</button><button class="btn primary" data-ok>${icon('check', 15)} Save</button>`,
    onMount: (r, close) => {
      $('[data-x2]', r).onclick = close;
      $('[data-del]', r)?.addEventListener('click', async () => { if (await confirmBox(`Delete "${ev.title}"${ev.weekly ? ' (every week)' : ''}?`)) { remove('events', ev.id); close(); toast('Event deleted', { label: 'Undo', fn: () => upsert('events', rec) }); } });
      $('[data-ok]', r).onclick = () => {
        const f = formData(r), w = $('#ev-w', r);
        if (!f.title || !f.date) return (w.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>Add a title and date.</div>`);
        if (!f.allDay && (!f.start || !f.end || f.end <= f.start)) return (w.innerHTML = `<div class="alert bad"><span class="ai">${icon('circle-x', 15)}</span>The end time must be after the start time.</div>`);
        const out = { ...ev, ...f, color: f.classId ? '' : EV_KINDS[f.kind][1] };
        if (!out.allDay && !w.dataset.confirmed) {
          const clash = itemsOn(out.date).filter((i) => i.id !== out.id && i.s != null && i.e != null && !i.logged && i.k !== 'due' && i.s < toMin(out.end) && toMin(out.start) < i.e);
          if (clash.length) { w.dataset.confirmed = 1; w.innerHTML = `<div class="alert warn"><span class="ai">${icon('triangle-alert', 15)}</span><span>Overlaps ${clash.map((c) => `<b>${esc(c.title)}</b> (${fmtTime(fromMin(c.s))}–${fmtTime(fromMin(c.e))})`).join(', ')}. Press save again to keep it anyway.</span></div>`; return; }
        }
        upsert('events', out); close(); toast(isNew ? 'Event added' : 'Event saved');
      };
    } });
}
function exportICS() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), dt = (d) => d.replace(/-/g, ''), tm = (d, t) => `${dt(d)}T${t.replace(':', '')}00`;
  const escI = (s) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Student Lens//EN', 'CALSCALE:GREGORIAN'];
  const add = (uidv, title, d, s, e, desc = '', rr = '') => { L.push('BEGIN:VEVENT', `UID:${uidv}@studentlens`, `DTSTAMP:${stamp}`, s ? `DTSTART:${tm(d, s)}` : `DTSTART;VALUE=DATE:${dt(d)}`, s ? `DTEND:${tm(d, e || s)}` : `DTEND;VALUE=DATE:${dt(addDays(d, 1))}`, `SUMMARY:${escI(title)}`); if (desc) L.push(`DESCRIPTION:${escI(desc)}`); if (rr) L.push(rr); L.push('END:VEVENT'); };
  for (const ev of S.events) add(ev.id, ev.title, ev.date, ev.allDay ? null : ev.start, ev.end, ev.notes, ev.weekly ? `RRULE:FREQ=WEEKLY${ev.until ? ';UNTIL=' + dt(ev.until) + 'T235959' : ''}` : '');
  for (const e of S.exams) add(e.id, `${e.title} (${clsName(e.classId)})`, e.date, e.time || null, e.time ? fromMin(toMin(e.time) + 60) : null, (e.topics || []).map((x) => x.name).join(', '));
  for (const a of S.assignments.filter((x) => x.due && !isDone(x))) add(a.id, `Due: ${a.title} (${clsName(a.classId)})`, a.due, null, null, a.description);
  L.push('END:VCALENDAR');
  download('student-lens.ics', L.join('\r\n'), 'text/calendar'); toast('Calendar file saved. Open it to add to Google, Apple or Outlook calendar.');
}
