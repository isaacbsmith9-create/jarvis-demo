// Plan: Gameplan (day, tasks, time, night) + Weekboard (week). Reads/writes gp:* and wb:*.
import { esc, todayIso, shiftIso, mondayOf, weekdayNum, shortDate, dayLabel, relDay, fmtDur, fmtTime, toMin, toHHMM, nowMin, clamp, haptic, uid, $, $$ } from './util.js';
import * as pd from './plan.data.js';
import { on, sheet, sheetOf, toast, icon, chev, ring, bar, stackChart, confirmTap, checkSvg, go, profileBtn } from './ui.js';
import { agendaRow, taskRow } from './view.today.js';

const SUBS = [['day', 'Day'], ['week', 'Week'], ['tasks', 'Tasks'], ['time', 'Time'], ['night', 'Night']];
let wbMon = mondayOf(todayIso());

export function render(rest) {
  const sub = SUBS.some(([k]) => k === rest[0]) ? rest[0] : 'day';
  const body = { day: dayView, week: weekView, tasks: tasksView, time: timeView, night: nightView }[sub]();
  return `<header class="lt"><div><div class="eyebrow">${esc(dayLabel(todayIso(), { weekday: 'long', month: 'short', day: 'numeric' }))}</div><h1>Plan</h1></div><div class="actions">${profileBtn()}</div></header>
    <div class="seg" role="tablist" style="margin-bottom:16px">${SUBS.map(([k, l]) => `<button type="button" role="tab" data-act="go" data-href="#plan${k === 'day' ? '' : '-' + k}" aria-pressed="${sub === k}">${l}</button>`).join('')}</div>
    ${body}`;
}

// ===================== Day =====================
function dayView() {
  const iso = todayIso(), s = pd.dayScore(iso), ag = pd.agenda(iso), nm = nowMin();
  const cur = ag.find((b) => toMin(b.start) <= nm && nm < toMin(b.start) + b.mins), next = ag.find((b) => toMin(b.start) > nm);
  const firstOpen = s.tops.find((t) => !t.done);
  let timeline = '', placed = false;
  for (const b of ag) {
    if (!placed && toMin(b.start) > nm) { timeline += nowLine(nm); placed = true; }
    timeline += b.src === 'gp' ? agendaRow(b, b === cur ? 'now' : '').replace('class="tx"', `class="tx" data-act="editBlock" data-id="${esc(b.id)}" role="button" style="cursor:pointer"`) : agendaRow(b, b === cur ? 'now' : '');
  }
  if (ag.length && !placed) timeline += nowLine(nm);
  return `
  <div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center">
    ${ring({ pct: s.total / 100, size: 108, stroke: 11, color: 'var(--accent)', center: `<b style="font-size:32px">${s.total}</b><span>day score</span>`, label: `Day score ${s.total}` })}
    <div class="stack-sm">${[['Top 3', s.topPts, 40], ['Schedule', s.blockPts, 20], ['Night', s.nightPts, 20], ['Phone', s.phonePts, 20]].map(([l, v, m]) => `<div><div class="row-sb xs"><span class="b">${l}</span><span class="num muted">${v}/${m}</span></div><div style="margin-top:3px">${bar(v / m)}</div></div>`).join('')}</div>
  </div>
  <div class="card" style="background:var(--fg);color:var(--bg)">
    <div class="xs b" style="opacity:.7;text-transform:uppercase;letter-spacing:.06em">${cur ? `Right now · until ${fmtTime(toMin(cur.start) + cur.mins)}` : firstOpen ? 'Free time · knock out' : 'Right now'}</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px">${esc(cur ? cur.title : firstOpen ? firstOpen.title : 'Free time')}</div>
    ${next ? `<div class="sm" style="opacity:.75;margin-top:4px">Next: ${esc(next.title)} at ${fmtTime(next.start)}</div>` : ''}
  </div>
  <div class="sh"><h2>Top 3</h2><button class="link" data-act="pickTop" data-day="today">${s.tops.length ? 'Edit' : 'Pick'}</button></div>
  ${s.tops.length ? `<div class="list">${s.tops.map((t, i) => taskRow(t, i + 1)).join('')}</div>` : `<div class="card empty" style="padding:16px">No Top 3 yet. <button class="btn ghost sm" data-act="pickTop" data-day="today">Pick 3</button></div>`}
  <div class="sh"><h2>Schedule</h2><button class="link" data-act="addBlock">Add block</button></div>
  ${ag.length ? `<div class="list">${timeline}</div><p class="xs muted" style="margin:8px 4px 0">Colored bars are from your week. Tap a block's name to edit it.</p>` : `<div class="card empty" style="padding:16px"><b>Nothing scheduled</b>Add blocks like a shooting workout or homework, or add repeating practice in Week.<br><br><button class="btn tinted sm" data-act="addBlock">Add a block</button></div>`}`;
}
const nowLine = (nm) => `<div style="display:flex;align-items:center;gap:8px;padding:2px 16px;font-size:12px;font-weight:700;color:var(--bad)"><span class="dot" style="--c:var(--bad)"></span>Now ${fmtTime(nm)}<span style="flex:1;border-top:1.5px solid var(--bad)"></span></div>`;

// ===================== Week (Weekboard) =====================
function weekView() {
  const dates = Array.from({ length: 7 }, (_, i) => shiftIso(wbMon, i)), today = todayIso(), isThis = wbMon === mondayOf(today);
  const all = dates.flatMap(pd.itemsOn), mins = (types) => all.filter((i) => types.includes(i.type)).reduce((a, i) => a + i.mins, 0);
  const hw = all.filter((i) => ['homework', 'study'].includes(i.type)), freeNights = dates.slice(0, 5).filter((d) => !pd.itemsOn(d).some((i) => i.start && toMin(i.start) >= 17 * 60)).length;
  const tray = pd.wbCore().tray;
  return `
  <div class="card tight" style="display:flex;align-items:center;gap:6px;padding:6px">
    <button class="icon-btn plain" data-act="wbWeek" data-n="-7" aria-label="Previous week">${icon('back')}</button>
    <button class="grow btn ghost" data-act="wbWeek" data-n="0" style="color:var(--fg);font-weight:700">${shortDate(dates[0])} – ${shortDate(dates[6])}${isThis ? '' : ' · back to now'}</button>
    <button class="icon-btn plain" data-act="wbWeek" data-n="7" aria-label="Next week">${icon('chev')}</button>
  </div>
  <div class="grid4" style="margin-top:12px">${[[fmtDur(mins(['practice', 'game', 'lift'])), 'Training'], [`${hw.filter((i) => i.done).length}/${hw.length}`, 'Homework'], [fmtDur(mins(['work'])), 'Work'], [freeNights, 'Free nights']].map(([v, l]) => `<div class="stat" style="background:var(--surface)"><b style="font-size:18px">${v}</b><span>${l}</span></div>`).join('')}</div>
  ${tray.length ? `<div class="card" style="margin-top:12px;background:var(--warn-soft)"><div class="row-sb"><div><h3>To schedule (${tray.length})</h3><div class="sub" style="color:var(--fg-2)">Auto-fit slots these in before they're due.</div></div><button class="btn sm primary" data-act="wbAutofit">Auto-fit</button></div>
    <div class="list" style="margin-top:10px;box-shadow:none">${tray.map((t) => `<button type="button" class="li" data-act="wbEdit" data-id="${esc(t.id)}"><span class="dot" style="--c:${pd.WB_TYPES[t.type]?.color}"></span><span class="tx"><div class="t1">${esc(t.title)}</div><div class="t2">${fmtDur(t.mins)}${t.due ? ` · due ${dayLabel(t.due)}` : ''}</div></span>${chev}</button>`).join('')}</div></div>` : ''}
  <div class="row-g" style="margin-top:12px"><button class="btn tinted grow" data-act="addWbItem">${icon('plus', 2.4)} Add</button><button class="btn grow" data-act="wbRules">Repeating</button></div>
  ${dates.map((d) => {
    const list = pd.itemsOn(d), bad = pd.conflicts(list), total = list.reduce((a, x) => a + x.mins, 0);
    return `<div class="sh" style="margin-top:20px"><h2 style="font-size:17px">${dayLabel(d, { weekday: 'long' })} <span class="muted" style="font-weight:500">${shortDate(d)}</span>${d === today ? ' <span class="pill accent">Today</span>' : ''}</h2><span class="xs muted">${list.length ? `${list.filter((x) => x.done).length}/${list.length} · ${fmtDur(total)}` : ''}</span></div>
      <div class="list" style="${d < today ? 'opacity:.7' : ''}">${list.length ? list.map((it) => wbRow(it, bad.has(it.id))).join('') : `<button type="button" class="li" data-act="addWbItem" data-date="${d}"><span class="tx t2" style="color:var(--faint)">Free. Tap to add something.</span></button>`}</div>`;
  }).join('')}`;
}
function wbRow(it, conflict) {
  const t = pd.WB_TYPES[it.type] || pd.WB_TYPES.other, late = it.due && !it.done && it.due <= todayIso();
  return `<div class="li${it.done ? ' done' : ''}"><span style="width:4px;align-self:stretch;border-radius:4px;background:${t.color};flex:none"></span>
    <button type="button" class="tx" data-act="wbEdit" data-id="${esc(it.id)}" data-date="${it.date}" style="border:0;background:none;padding:0;text-align:left;color:inherit"><div class="t1">${esc(it.title)}</div>
    <div class="t2">${it.start ? fmtTime(it.start) + ' · ' : ''}${fmtDur(it.mins)} · ${t.label}${it.rule ? ' · weekly' : ''}${it.due ? ` · <span style="${late ? 'color:var(--bad);font-weight:600' : ''}">due ${dayLabel(it.due)}</span>` : ''}${conflict ? ' · <span style="color:var(--bad);font-weight:600">overlaps</span>' : ''}</div></button>
    <button type="button" class="check${it.done ? ' on' : ''}" data-act="wbCheck" data-id="${esc(it.id)}" data-date="${it.date}" aria-label="${it.done ? 'Mark not done' : 'Mark done'}">${checkSvg}</button></div>`;
}
on({
  wbWeek(el) { const n = Number(el.dataset.n); wbMon = n ? shiftIso(wbMon, n) : mondayOf(todayIso()); go('#plan-week'); },
  wbCheck(el) { pd.toggleWb(el.dataset.id, el.dataset.date); haptic(); },
  wbAutofit() { const r = pd.autoFit(wbMon); toast(r.placed ? `Scheduled ${r.placed}.${r.stuck ? ` ${r.stuck} didn't fit before the due date.` : ''}` : `Couldn't fit anything${r.stuck ? ' before the due dates' : ''}. Raise the daily homework limit or add it to a day.`); },
  addWbItem(el) { openWbItem({ date: el.dataset.date || (wbMon === mondayOf(todayIso()) ? todayIso() : wbMon) }); },
  wbEdit(el) { openWbItem({ id: el.dataset.id, date: el.dataset.date }); },
  wbRules() { openRules(); },
});
export function openWbItem({ id = null, date = todayIso() } = {}) {
  const found = id ? pd.findWbItem(id, date) : null;
  if (found?.kind === 'rep') return openRule(found.rule.id, date);
  const it = found?.item;
  const d = it ? { title: it.title, type: it.type, date: it.date || '', start: it.start || '', mins: it.mins, due: it.due || '', tray: found.kind === 'tray' } : { title: '', type: 'homework', date, start: '', mins: 45, due: '', tray: false };
  sheet({ title: it ? 'Edit' : 'Add to your week', right: { label: 'Save', act: 'wbSave' }, data: { d, id, kind: found?.kind }, body: (api) => {
    const x = api.data.d;
    return `<label class="field"><span>What</span><input class="input" id="wb-title" value="${esc(x.title)}" placeholder="e.g. Chem worksheet, Lift, Shift at work" maxlength="80" data-input="wbF" data-k="title"></label>
      <div class="label" style="margin:14px 4px 8px">Type</div><div class="wrap-chips">${Object.entries(pd.WB_TYPES).map(([k, t]) => `<button type="button" class="chip${x.type === k ? ' on' : ''}" data-act="wbType" data-t="${k}">${t.label}</button>`).join('')}</div>
      ${['homework', 'study'].includes(x.type) ? `<label class="row-sb card" style="margin-top:14px"><span><span class="b">Let Auto-fit pick the time</span><div class="sm muted">Goes in "To schedule" until you tap Auto-fit</div></span><span class="switch"><input type="checkbox" ${x.tray ? 'checked' : ''} data-change="wbTray"><span></span></span></label>` : ''}
      <div class="fields2" style="margin-top:14px">${x.tray ? '' : `<label class="field"><span>Day</span><input class="input" type="date" value="${x.date}" data-input="wbF" data-k="date"></label><label class="field"><span>Start (optional)</span><input class="input" type="time" value="${x.start}" data-input="wbF" data-k="start"></label>`}
        <label class="field"><span>Minutes</span><input class="input" inputmode="numeric" value="${x.mins}" data-input="wbF" data-k="mins"></label>
        ${['homework', 'study'].includes(x.type) ? `<label class="field"><span>Due</span><input class="input" type="date" value="${x.due}" data-input="wbF" data-k="due"></label>` : ''}</div>
      <div class="stack-sm" style="margin-top:18px"><button class="btn primary block" data-act="wbSave">Save</button>${it ? '<button class="btn danger block" data-act="wbDelete">Delete</button>' : ''}</div>`;
  }, onMount: (api) => { if (!it && matchMedia('(hover: hover)').matches) setTimeout(() => $('#wb-title', api.el)?.focus(), 60); } });
}
const keep = (s) => { const y = s.body.scrollTop; s.refresh(); s.body.scrollTop = y; };
on({
  wbF(el) { const s = sheetOf(el); s.data.d[el.dataset.k] = el.value; },
  wbType(el) { const s = sheetOf(el); s.data.d.type = el.dataset.t; if (!['homework', 'study'].includes(el.dataset.t)) s.data.d.tray = false; keep(s); },
  wbTray(el) { const s = sheetOf(el); s.data.d.tray = el.checked; keep(s); },
  wbSave(el) {
    const s = sheetOf(el), { d, id, kind } = s.data, title = d.title.trim(), mins = clamp(Math.round(Number(d.mins) || 0), 5, 720);
    if (!title) return toast('Name it first');
    if (!d.tray && !d.date) return toast('Pick a day');
    const fields = { title, type: d.type, mins, due: d.due || null };
    if (id) pd.removeWbItem(id, d.date);
    if (d.tray) pd.saveWbCore((c) => { c.tray.push({ id: id || uid(), ...fields }); });
    else pd.addWbItem({ ...(id ? { id } : {}), ...fields, date: d.date, start: d.start || null, done: false });
    s.close(); haptic(12); toast(d.tray ? 'Added to "To schedule"' : `Added to ${relDay(d.date)}`);
  },
  wbDelete(el) { if (!confirmTap(el)) return; const s = sheetOf(el); pd.removeWbItem(s.data.id, s.data.d.date); s.close(); toast('Deleted'); },
});
// Repeating rules
function openRules() {
  sheet({ title: 'Repeating', left: { label: 'Done', close: true }, right: { label: 'Add', act: 'ruleNew' }, body: () => {
    const rules = pd.wbCore().rules;
    return `<p class="sm muted" style="margin:0 4px 12px">Practice, lifts, work shifts and anything else that happens every week.</p>
      ${rules.length ? `<div class="list">${rules.map((r) => `<button type="button" class="li" data-act="ruleOpen" data-id="${r.id}"><span class="dot" style="--c:${pd.WB_TYPES[r.type]?.color}"></span><span class="tx"><div class="t1">${esc(r.title)}</div><div class="t2">${(r.days || []).map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(', ')}${r.start ? ' · ' + fmtTime(r.start) : ''} · ${fmtDur(r.mins)}</div></span>${chev}</button>`).join('')}</div>` : '<div class="card empty"><b>No repeating items</b>Add practice so it shows up every week.</div>'}
      <button class="btn tinted block" style="margin-top:12px" data-act="ruleNew">Add repeating item</button>`;
  } }).el.dataset.rules = '1';
}
function openRule(rid = null) {
  const r = rid ? pd.wbCore().rules.find((x) => x.id === rid) : null;
  const d = r ? { ...r, days: [...(r.days || [])] } : { title: 'Practice', type: 'practice', days: [0, 1, 2, 3, 4], start: '15:30', mins: 120 };
  sheet({ title: r ? 'Edit repeating' : 'New repeating', right: { label: 'Save', act: 'ruleSave' }, data: { d, rid }, body: (api) => {
    const x = api.data.d;
    return `<label class="field"><span>What</span><input class="input" value="${esc(x.title)}" maxlength="60" data-input="ruleF" data-k="title"></label>
      <div class="label" style="margin:14px 4px 8px">Type</div><div class="wrap-chips">${Object.entries(pd.WB_TYPES).map(([k, t]) => `<button type="button" class="chip${x.type === k ? ' on' : ''}" data-act="ruleType" data-t="${k}">${t.label}</button>`).join('')}</div>
      <div class="label" style="margin:14px 4px 8px">Days</div><div class="grid4" style="grid-template-columns:repeat(7,1fr);gap:6px">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => `<button type="button" class="btn sm${x.days.includes(i) ? ' primary' : ''}" style="padding:0" data-act="ruleDay" data-d="${i}" aria-pressed="${x.days.includes(i)}" aria-label="${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}">${l}</button>`).join('')}</div>
      <div class="fields2" style="margin-top:14px"><label class="field"><span>Start</span><input class="input" type="time" value="${x.start || ''}" data-input="ruleF" data-k="start"></label><label class="field"><span>Minutes</span><input class="input" inputmode="numeric" value="${x.mins}" data-input="ruleF" data-k="mins"></label></div>
      <div class="stack-sm" style="margin-top:18px"><button class="btn primary block" data-act="ruleSave">Save</button>${r ? '<button class="btn danger block" data-act="ruleDelete">Delete</button>' : ''}</div>`;
  } });
}
on({
  ruleNew() { openRule(); }, ruleOpen(el) { openRule(el.dataset.id); },
  ruleF(el) { sheetOf(el).data.d[el.dataset.k] = el.value; },
  ruleType(el) { const s = sheetOf(el); s.data.d.type = el.dataset.t; keep(s); },
  ruleDay(el) { const s = sheetOf(el), d = s.data.d, n = Number(el.dataset.d); d.days = d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n].sort(); keep(s); },
  ruleSave(el) {
    const s = sheetOf(el), { d, rid } = s.data; if (!d.title.trim() || !d.days.length) return toast('Add a name and at least one day');
    const rule = { id: rid || uid(), title: d.title.trim(), type: d.type, days: d.days, start: d.start || null, mins: clamp(Number(d.mins) || 60, 5, 720) };
    pd.saveWbCore((c) => { const i = c.rules.findIndex((x) => x.id === rule.id); if (i >= 0) c.rules[i] = rule; else c.rules.push(rule); });
    s.close(); $$('dialog[data-rules]').forEach((x) => x._sheet.refresh()); toast('Saved');
  },
  ruleDelete(el) { if (!confirmTap(el)) return; const s = sheetOf(el); pd.saveWbCore((c) => { c.rules = c.rules.filter((x) => x.id !== s.data.rid); }); s.close(); $$('dialog[data-rules]').forEach((x) => x._sheet.refresh()); toast('Deleted'); },
});

// ===================== Tasks (priority matrix) =====================
function tasksView() {
  const tasks = pd.gpCore().tasks, open = tasks.filter((t) => !t.done), done = tasks.filter((t) => t.done), today = todayIso();
  return `<form class="search" data-submit="taskQuick" style="margin-bottom:12px"><span class="sr">New task</span>${icon('plus', 2.4)}<input class="input" name="t" placeholder="New task (goes in Do now)" autocomplete="off" maxlength="120" enterkeyhint="done"></form>
  <div class="grid2">${pd.QUADS.map((q) => { const list = open.filter((t) => pd.quadOf(t) === q).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    return `<div class="card" style="padding:12px;border-top:4px solid ${q.c};min-height:140px;display:flex;flex-direction:column;gap:6px;margin:0">
      <div class="row-sb" style="align-items:flex-start"><div><div class="b" style="color:${q.c};font-size:15px">${q.name}</div><div class="xs muted">${q.sub}</div></div><button class="icon-btn" style="width:30px;height:30px;background:var(--surface-2);box-shadow:none" data-act="taskNew" data-q="${q.id}" aria-label="Add to ${q.name}">${icon('plus', 2.4)}</button></div>
      ${list.length ? list.map((t) => `<div style="display:flex;gap:8px;align-items:flex-start"><button type="button" class="check" style="width:22px;height:22px" data-act="taskCheck" data-id="${t.id}" aria-label="Done">${checkSvg}</button><button type="button" data-act="taskOpen" data-id="${t.id}" style="border:0;background:none;padding:0;text-align:left;font-size:14px;font-weight:500;overflow-wrap:anywhere;min-width:0">${esc(t.title)}${t.top === today ? ' <span style="color:var(--warn)">★</span>' : ''}${t.due ? `<span class="xs" style="display:block;color:${t.due < today ? 'var(--bad)' : 'var(--muted)'}">${t.due < today ? 'Late · ' : 'Due '}${t.due === today ? 'today' : dayLabel(t.due) + ' ' + shortDate(t.due)}</span>` : ''}</button></div>`).join('') : '<div class="xs muted" style="margin-top:4px">Empty</div>'}
    </div>`; }).join('')}</div>
  ${done.length ? `<div class="sh"><h2>Done</h2><button class="link" data-act="taskClear">Clear</button></div><div class="list">${done.slice(-8).reverse().map((t) => taskRow(t)).join('')}</div>` : ''}`;
}
let pickIso = todayIso();
export function openTask(id = null, quad = 'do') {
  const t = id ? pd.gpCore().tasks.find((x) => x.id === id) : null, q = t ? pd.quadOf(t) : pd.QUADS.find((x) => x.id === quad) || pd.QUADS[0], today = todayIso();
  const d = { title: t?.title || '', u: q.u, i: q.i, due: t?.due || '', top: t?.top === today ? 'today' : t?.top === shiftIso(today, 1) ? 'tomorrow' : '' };
  sheet({ title: t ? 'Edit task' : 'New task', right: { label: 'Save', act: 'taskSave' }, data: { d, id }, body: (api) => {
    const x = api.data.d;
    return `<label class="field"><span>Task</span><input class="input" id="task-title" value="${esc(x.title)}" maxlength="120" placeholder="What needs doing?" data-input="taskF" data-k="title"></label>
      <div class="label" style="margin:14px 4px 8px">Priority</div><div class="grid2" style="gap:8px">${pd.QUADS.map((qq) => `<button type="button" class="btn sm" data-act="taskQuad" data-q="${qq.id}" style="${qq.u === x.u && qq.i === x.i ? `background:${qq.c};color:#fff` : ''}">${qq.name}</button>`).join('')}</div>
      <div class="label" style="margin:14px 4px 8px">Top 3</div><div class="seg">${[['', 'No'], ['today', 'Today'], ['tomorrow', 'Tomorrow']].map(([k, l]) => `<button type="button" data-act="taskTop" data-v="${k}" aria-pressed="${x.top === k}">${l}</button>`).join('')}</div>
      <label class="field" style="margin-top:14px"><span>Due (optional)</span><input class="input" type="date" value="${x.due}" data-input="taskF" data-k="due"></label>
      <div class="stack-sm" style="margin-top:18px"><button class="btn primary block" data-act="taskSave">Save</button>${t ? '<button class="btn danger block" data-act="taskDelete">Delete</button>' : ''}</div>`;
  }, onMount: (api) => { if (!t && matchMedia('(hover: hover)').matches) setTimeout(() => $('#task-title', api.el)?.focus(), 60); } });
}
on({
  taskQuick(form) { const v = form.t.value.trim(); if (!v) return; pd.addTask(v, true, true); form.t.value = ''; haptic(); toast('Added to Do now'); setTimeout(() => $('form[data-submit="taskQuick"] input')?.focus(), 20); },
  taskNew(el) { openTask(null, el.dataset.q); },
  taskOpen(el) { openTask(el.dataset.id); },
  taskCheck(el) { const done = pd.toggleTask(el.dataset.id); haptic(done ? 15 : 5); if (done) toast('Done. Nice.'); },
  taskClear(el) { if (!confirmTap(el, 'Tap again to clear')) return; pd.saveGpCore((c) => { c.tasks = c.tasks.filter((t) => !t.done); }); },
  taskF(el) { sheetOf(el).data.d[el.dataset.k] = el.value; },
  taskQuad(el) { const s = sheetOf(el), q = pd.QUADS.find((x) => x.id === el.dataset.q); s.data.d.u = q.u; s.data.d.i = q.i; keep(s); },
  taskTop(el) { const s = sheetOf(el); s.data.d.top = el.dataset.v; keep(s); },
  taskSave(el) {
    const s = sheetOf(el), { d, id } = s.data, title = d.title.trim(); if (!title) return toast('Give the task a name');
    const today = todayIso(), topIso = d.top === 'today' ? today : d.top === 'tomorrow' ? shiftIso(today, 1) : null;
    let msg = 'Saved';
    pd.saveGpCore((c) => {
      let t = id ? c.tasks.find((x) => x.id === id) : null;
      if (!t) { t = { id: uid(), title, u: d.u, i: d.i, due: '', done: false, top: null, created: Date.now() }; c.tasks.push(t); }
      Object.assign(t, { title, u: d.u, i: d.i, due: d.due });
      if (topIso && t.top !== topIso && c.tasks.filter((x) => x.top === topIso && x.id !== t.id).length >= 3) msg = `${d.top === 'today' ? 'Today' : 'Tomorrow'} already has 3. Saved without the star.`;
      else t.top = topIso;
    });
    s.close(); toast(msg);
  },
  taskDelete(el) { if (!confirmTap(el)) return; const s = sheetOf(el); pd.saveGpCore((c) => { c.tasks = c.tasks.filter((t) => t.id !== s.data.id); }); s.close(); toast('Task deleted'); },
  pickTop(el) { openPicker(el.dataset.day === 'tomorrow' ? shiftIso(pd.nightDate(), 1) : todayIso()); },
});
function openPicker(iso) {
  pickIso = iso;
  sheet({ title: iso === todayIso() ? "Today's Top 3" : "Tomorrow's Top 3", left: { label: 'Done', close: true }, body: () => {
    const open = pd.gpCore().tasks.filter((t) => !t.done).sort((a, b) => pd.QUADS.indexOf(pd.quadOf(a)) - pd.QUADS.indexOf(pd.quadOf(b))), n = pd.topFor(pickIso).length;
    return `<p class="sm muted" style="margin:0 4px 12px">${n} of 3 picked. Do-now and Schedule tasks are listed first.</p>
      <form class="search" data-submit="pickNew" style="margin-bottom:12px">${icon('plus', 2.4)}<input class="input" name="t" placeholder="New task for ${iso === todayIso() ? 'today' : 'tomorrow'}" autocomplete="off" maxlength="120"></form>
      ${open.length ? `<div class="list">${open.map((t) => `<button type="button" class="li" data-act="pickToggle" data-id="${t.id}"><span class="dot" style="--c:${pd.quadOf(t).c}"></span><span class="tx"><div class="t1">${esc(t.title)}</div><div class="t2">${pd.quadOf(t).name}${t.top && t.top !== pickIso ? ' · picked for another day' : ''}</div></span>${t.top === pickIso ? `<span style="color:var(--warn)">${icon('star', 2.2)}</span>` : ''}</button>`).join('')}</div>` : '<div class="card empty">No open tasks yet. Type one above.</div>'}`;
  } });
}
on({
  pickToggle(el) {
    const s = sheetOf(el); let msg = null;
    pd.saveGpCore((c) => { const t = c.tasks.find((x) => x.id === el.dataset.id); if (!t) return; if (t.top === pickIso) t.top = null; else if (c.tasks.filter((x) => x.top === pickIso).length >= 3) msg = '3 max. Unpick one first.'; else t.top = pickIso; });
    if (msg) toast(msg); haptic(); s.refresh();
  },
  pickNew(form) { const v = form.t.value.trim(); if (!v) return; if (pd.topFor(pickIso).length >= 3) return toast('3 max. Unpick one first.'); pd.addTask(v, true, true, pickIso); sheetOf(form).refresh(); },
});
// Blocks (Gameplan schedule)
function openBlock(id = null) {
  const b = id ? pd.gpDay(todayIso())?.blocks?.find((x) => x.id === id) : null;
  const d = b ? { ...b } : { title: '', start: toHHMM(Math.min(23 * 60, (Math.floor(nowMin() / 60) + 1) * 60)), mins: 60, type: 'train' };
  sheet({ title: b ? 'Edit block' : 'Add block', right: { label: 'Save', act: 'blockSave' }, data: { d, id }, body: (api) => { const x = api.data.d;
    return `<label class="field"><span>What</span><input class="input" value="${esc(x.title)}" placeholder="e.g. Shooting workout" maxlength="80" data-input="blockF" data-k="title"></label>
      <div class="fields2" style="margin-top:12px"><label class="field"><span>Start</span><input class="input" type="time" value="${x.start}" data-input="blockF" data-k="start"></label><label class="field"><span>Minutes</span><input class="input" inputmode="numeric" value="${x.mins}" data-input="blockF" data-k="mins"></label></div>
      <div class="label" style="margin:14px 4px 8px">Type</div><div class="seg">${pd.BTYPES.map((t) => `<button type="button" data-act="blockType" data-t="${t.id}" aria-pressed="${x.type === t.id}">${t.name}</button>`).join('')}</div>
      <div class="stack-sm" style="margin-top:18px"><button class="btn primary block" data-act="blockSave">Save</button>${b ? '<button class="btn danger block" data-act="blockDelete">Delete</button>' : ''}</div>`; } });
}
on({
  addBlock() { openBlock(); }, editBlock(el) { openBlock(el.dataset.id); },
  blockF(el) { sheetOf(el).data.d[el.dataset.k] = el.value; },
  blockType(el) { const s = sheetOf(el); s.data.d.type = el.dataset.t; keep(s); },
  blockSave(el) {
    const s = sheetOf(el), { d, id } = s.data, title = d.title.trim(); if (!title) return toast('Name the block');
    const x = { title, start: d.start || '16:00', mins: clamp(Number(d.mins) || 60, 5, 720), type: d.type };
    pd.saveGpDay(todayIso(), (day) => { if (id) Object.assign(day.blocks.find((b) => b.id === id), x); else day.blocks.push({ id: uid(), ...x, done: false }); });
    s.close(); toast('Saved');
  },
  blockDelete(el) { if (!confirmTap(el)) return; const s = sheetOf(el); pd.saveGpDay(todayIso(), (day) => { day.blocks = day.blocks.filter((b) => b.id !== s.data.id); }); s.close(); },
});

// ===================== Time tracker =====================
function timeView() {
  const r = pd.gpCore().running, iso = todayIso(), by = pd.minsBy(iso), total = Object.values(by).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]), max = sorted[0]?.[1] || 1, goal = pd.gpCore().settings.phoneGoal || 120;
  const days = Array.from({ length: 7 }, (_, i) => shiftIso(iso, i - 6)), data = days.map(pd.minsBy), sumC = (id) => data.reduce((a, o) => a + (o[id] || 0), 0);
  const phoneDays = data.filter((o) => o.phone).length, phoneAvg = phoneDays ? sumC('phone') / phoneDays : 0, work = sumC('practice') + sumC('training');
  const tips = [];
  if (data.some((o) => Object.keys(o).length)) {
    const top = pd.CATS.map((c) => [c, sumC(c.id)]).sort((a, b) => b[1] - a[1])[0];
    tips.push(`Most time this week: <b>${top[0].name}</b>, ${fmtDur(top[1])}.`);
    if (phoneDays) tips.push(phoneAvg > goal ? `Phone averages <b>${fmtDur(phoneAvg)}</b>/day, ${fmtDur(phoneAvg - goal)} over goal. That's ${fmtDur((phoneAvg - goal) * 7)} a week you could put into shooting.` : `Phone averages <b>${fmtDur(phoneAvg)}</b>/day, under your ${fmtDur(goal)} goal.`);
    if (work) tips.push(`Practice + training: <b>${fmtDur(work)}</b> this week.`);
    if (sumC('gaming') > work && work) tips.push('Gaming beat training this week. Flip that next week.');
  }
  const entries = [...(pd.gpDay(iso)?.entries || [])].sort((a, b) => a.start - b.start);
  return `
  <div class="card" style="text-align:center;${r ? `background:color-mix(in srgb, ${pd.catOf(r.cat).c} 14%, var(--surface))` : ''}">
    <div class="xs b muted" style="text-transform:uppercase;letter-spacing:.06em">${r ? `Tracking ${esc(pd.catOf(r.cat).name)}` : 'No timer running'}</div>
    <div class="num" style="font-size:52px;font-weight:700;letter-spacing:-.02em;margin:6px 0" ${r ? `data-since="${r.start}"` : ''}>0:00:00</div>
    ${r ? `<button class="btn primary" style="min-width:160px;background:var(--bad);color:#fff" data-act="timerStop">${icon('stop')} Stop</button>` : '<div class="sm muted">Tap a category to start.</div>'}
  </div>
  <div class="grid3" style="margin-top:12px">${pd.CATS.map((c) => `<button type="button" class="btn" style="min-height:52px;flex-direction:column;gap:4px;font-size:13px;padding:6px;white-space:normal;line-height:1.15;${r?.cat === c.id ? `background:${c.c};color:#fff` : 'background:var(--surface);box-shadow:var(--shadow-1)'}" data-act="timerCat" data-cat="${c.id}"><span class="dot" style="--c:${r?.cat === c.id ? '#fff' : c.c}"></span>${c.name}</button>`).join('')}</div>
  <div class="sh"><h2>Today</h2><span class="sm muted">${total ? fmtDur(total) + ' tracked' : ''}</span></div>
  <div class="card">${sorted.length ? `<div class="stack-sm">${sorted.map(([id, m]) => { const c = pd.catOf(id); return `<div><div class="row-sb sm"><span class="row-g" style="gap:6px"><span class="dot" style="--c:${c.c}"></span>${c.name}</span><span class="num b">${fmtDur(m)}</span></div><div style="margin-top:4px">${bar(m / max, c.c)}</div></div>`; }).join('')}</div>` : '<div class="empty" style="padding:8px">Nothing tracked today.</div>'}
    <div class="row-sb" style="margin-top:14px"><button class="btn sm" data-act="entryAdd">Add time manually</button><label class="row-g sm muted" style="gap:6px">Phone goal <select class="input" style="min-height:34px;width:auto;padding:4px 30px 4px 10px;font-size:14px" data-change="phoneGoal">${[30, 60, 90, 120, 150, 180, 240].map((m) => `<option value="${m}"${m === goal ? ' selected' : ''}>${fmtDur(m)}</option>`).join('')}</select></label></div></div>
  <div class="card"><div class="card-head"><h3>This week</h3></div><div class="chart" id="c-time"></div></div>
  ${tips.length ? `<div class="card"><h3>Insights</h3><ul style="margin:8px 0 0;padding-left:18px;display:grid;gap:6px" class="sm">${tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : ''}
  ${entries.length ? `<div class="sh"><h2>Entries</h2></div><div class="list">${entries.map((e) => { const c = pd.catOf(e.cat), d = new Date(e.start); return `<div class="li"><span class="dot" style="--c:${c.c}"></span><span class="tx"><div class="t1">${c.name}</div><div class="t2">${fmtTime(d.getHours() * 60 + d.getMinutes())} · ${fmtDur(e.mins)}</div></span><button class="btn ghost sm" style="color:var(--bad)" data-act="entryDel" data-id="${e.id}">Delete</button></div>`; }).join('')}</div>` : ''}`;
}
on({
  timerCat(el) { const r = pd.gpCore().running; haptic(12); if (r?.cat === el.dataset.cat) { const x = pd.stopTimer(); toast(x.mins >= 1 ? `Logged ${fmtDur(x.mins)} of ${pd.catOf(x.cat).name}` : 'Under a minute, not logged'); return; } if (r) pd.stopTimer(); pd.startTimer(el.dataset.cat); },
  timerStop() { const x = pd.stopTimer(); haptic(12); if (x) toast(x.mins >= 1 ? `Logged ${fmtDur(x.mins)} of ${pd.catOf(x.cat).name}` : 'Under a minute, not logged'); },
  phoneGoal(el) { pd.saveGpCore((c) => { c.settings.phoneGoal = Number(el.value); }); },
  entryDel(el) { if (!confirmTap(el, 'Sure?')) return; pd.saveGpDay(todayIso(), (d) => { d.entries = d.entries.filter((x) => x.id !== el.dataset.id); }); },
  entryAdd() {
    sheet({ title: 'Add time', right: { label: 'Save', act: 'timeEntrySave' }, body: `<div class="stack"><label class="field"><span>Category</span><select class="input" id="e-cat">${pd.CATS.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
      <div class="fields3"><label class="field"><span>Day</span><input class="input" type="date" id="e-date" value="${todayIso()}"></label><label class="field"><span>Start</span><input class="input" type="time" id="e-start" value="${toHHMM(Math.max(0, nowMin() - 60))}"></label><label class="field"><span>Minutes</span><input class="input" id="e-mins" inputmode="numeric" value="30"></label></div>
      <button class="btn primary block" data-act="timeEntrySave">Save</button></div>` });
  },
  timeEntrySave(el) {
    const s = sheetOf(el), iso = $('#e-date', s.el).value || todayIso(), mins = Math.round(Number($('#e-mins', s.el).value));
    if (!(mins > 0 && mins <= 720)) return toast('Minutes must be 1 to 720');
    const start = new Date(`${iso}T${$('#e-start', s.el).value || '12:00'}:00`).getTime();
    pd.saveGpDay(iso, (d) => { d.entries.push({ id: uid(), cat: $('#e-cat', s.el).value, start, mins }); }); s.close(); toast(`Logged ${fmtDur(mins)}`);
  },
});

// ===================== Night =====================
function nightView() {
  const rt = pd.gpCore().routine, iso = pd.nightDate(), d = new Date();
  let nm = d.getHours() * 60 + d.getMinutes(); const bed = toMin(rt.bed), bedAbs = bed < 12 * 60 ? bed + 1440 : bed; if (d.getHours() < 4) nm += 1440;
  const windAt = bedAbs - (Number(rt.wind) || 45), sleepMins = ((toMin(rt.wake) + 1440 - bed) % 1440) || 1440;
  const [label, big, sub] = nm < windAt ? ['Wind-down starts in', fmtDur(windAt - nm), `At ${fmtTime(windAt)}. Phone goes on the charger then.`] : nm < bedAbs ? ['Wind down now · lights out in', fmtDur(bedAbs - nm), 'Work through the list below.'] : ['Past lights out', `+${fmtDur(nm - bedAbs)}`, `Get to bed. You'll still get ${fmtDur(Math.max(0, sleepMins - (nm - bedAbs)))} before ${fmtTime(rt.wake)}.`];
  const n = pd.gpDay(iso)?.night?.done || {}, tTops = pd.topFor(shiftIso(iso, 1)), st = pd.nightState(iso);
  const full = (x) => { const s = pd.nightState(x); return s.total && s.done === s.total; };
  let streak = 0, cur = full(iso) ? iso : shiftIso(iso, -1); while (full(cur) && streak < 999) { streak++; cur = shiftIso(cur, -1); }
  return `
  <div class="card" style="background:linear-gradient(160deg,#1b1f3b,#3a2d6b);color:#fff;text-align:center;padding:22px 16px">
    <div class="xs b" style="opacity:.75;text-transform:uppercase;letter-spacing:.06em">${label}</div>
    <div class="num" style="font-size:46px;font-weight:700;margin:4px 0">${big}</div><div class="sm" style="opacity:.8">${sub}</div>
    <div class="row-g" style="justify-content:center;margin-top:14px">${[`Lights out ${fmtTime(rt.bed)}`, `Wake ${fmtTime(rt.wake)}`, `${fmtDur(sleepMins)} sleep`].map((x) => `<span class="pill" style="background:rgba(255,255,255,.14);color:#fff">${x}</span>`).join('')}</div>
  </div>
  <div class="sh"><h2>Tonight</h2><button class="link" data-act="routineEdit">Edit</button></div>
  <div class="card tight" style="padding:12px 16px">${bar(st.total ? st.done / st.total : 0, 'var(--c-lift)')}<div class="row-sb xs muted" style="margin-top:6px"><span>${st.done} of ${st.total}</span><span>${streak} night${streak === 1 ? '' : 's'} in a row</span></div></div>
  <div class="list" style="margin-top:12px">${(rt.steps || []).map((s) => { const auto = s.id === 'plan' && tTops.length, on = n[s.id] || auto;
    return `<div class="li${on ? ' done' : ''}"><button type="button" class="check${on ? ' on' : ''}" data-act="nightStep" data-id="${s.id}" aria-label="${esc(s.label)}">${checkSvg}</button><span class="tx"><div class="t1">${esc(s.label)}</div></span>${s.id === 'plan' && !auto ? '<button class="btn sm tinted" data-act="pickTop" data-day="tomorrow">Pick</button>' : ''}</div>`; }).join('') || '<div class="li"><span class="tx muted">No steps. Tap Edit to build your routine.</span></div>'}</div>
  ${st.total && st.done === st.total ? '<div class="note good" style="margin-top:12px;text-align:center"><b>Routine done.</b> Locked in for tomorrow.</div>' : ''}
  <div class="sh"><h2>Tomorrow's Top 3</h2><button class="link" data-act="pickTop" data-day="tomorrow">${tTops.length ? 'Edit' : 'Pick'}</button></div>
  ${tTops.length ? `<div class="list">${tTops.map((t, i) => taskRow(t, i + 1)).join('')}</div>` : '<div class="card empty" style="padding:16px">Pick 3 tonight so you wake up knowing what matters.</div>'}
  <div class="card" style="margin-top:12px"><div class="label" style="margin-bottom:8px">Last 14 nights</div><div style="display:grid;grid-template-columns:repeat(14,1fr);gap:4px">${Array.from({ length: 14 }, (_, i) => shiftIso(iso, i - 13)).map((x) => { const s = pd.nightState(x); return `<span title="${shortDate(x)}: ${s.done}/${s.total}" style="aspect-ratio:1;border-radius:5px;background:${s.total && s.done === s.total ? 'var(--c-lift)' : s.done ? 'color-mix(in srgb,var(--c-lift) 40%,transparent)' : 'var(--surface-2)'};${x === iso ? 'outline:2px solid var(--fg);outline-offset:1px' : ''}"></span>`; }).join('')}</div></div>`;
}
on({
  nightStep(el) {
    const id = el.dataset.id, iso = pd.nightDate();
    if (id === 'plan' && pd.topFor(shiftIso(iso, 1)).length) return toast("Checked because tomorrow's Top 3 is picked");
    pd.saveGpDay(iso, (d) => { d.night.done[id] = !d.night.done[id]; }); haptic();
    const st = pd.nightState(iso); pd.saveGpDay(iso, (d) => { d.night.completedAt = st.done === st.total ? Date.now() : null; });
    if (st.done === st.total) toast('Routine done. Good night.');
  },
  routineEdit() {
    sheet({ title: 'Night routine', left: { label: 'Done', close: true }, body: () => { const rt = pd.gpCore().routine;
      return `<div class="fields3"><label class="field"><span>Lights out</span><input class="input" type="time" value="${rt.bed}" data-change="rtF" data-k="bed"></label><label class="field"><span>Wake</span><input class="input" type="time" value="${rt.wake}" data-change="rtF" data-k="wake"></label><label class="field"><span>Wind-down</span><select class="input" data-change="rtF" data-k="wind">${[15, 30, 45, 60, 90].map((m) => `<option value="${m}"${Number(rt.wind) === m ? ' selected' : ''}>${m} min</option>`).join('')}</select></label></div>
        <div class="list" style="margin-top:14px">${rt.steps.map((s, i) => `<div class="li"><span class="tx">${esc(s.label)}</span>${i ? `<button class="btn ghost sm" data-act="rtUp" data-i="${i}" aria-label="Move up">↑</button>` : ''}<button class="btn ghost sm" style="color:var(--bad)" data-act="rtDel" data-id="${s.id}">Remove</button></div>`).join('')}</div>
        <form class="search" data-submit="rtAdd" style="margin-top:12px">${icon('plus', 2.4)}<input class="input" name="t" placeholder="Add a step" maxlength="80"></form>`; } });
  },
  rtF(el) { pd.saveGpCore((c) => { c.routine[el.dataset.k] = el.dataset.k === 'wind' ? Number(el.value) : el.value; }); },
  rtUp(el) { const i = Number(el.dataset.i); pd.saveGpCore((c) => { const s = c.routine.steps; [s[i - 1], s[i]] = [s[i], s[i - 1]]; }); sheetOf(el).refresh(); },
  rtDel(el) { if (!confirmTap(el, 'Sure?')) return; pd.saveGpCore((c) => { c.routine.steps = c.routine.steps.filter((s) => s.id !== el.dataset.id); }); sheetOf(el).refresh(); },
  rtAdd(form) { const v = form.t.value.trim(); if (!v) return; pd.saveGpCore((c) => { c.routine.steps.push({ id: uid(), label: v }); }); sheetOf(form).refresh(); },
});

export function mount(root, rest) {
  if (rest[0] === 'time') {
    const days = Array.from({ length: 7 }, (_, i) => shiftIso(todayIso(), i - 6)), data = days.map(pd.minsBy);
    stackChart(root.querySelector('#c-time'), days, pd.CATS.map((c) => ({ name: c.name, color: c.c, values: data.map((o) => o[c.id] || 0) })), { fmtTotal: fmtDur, tipFmt: fmtDur, empty: 'Track a few days and this fills in.' });
  }
}
