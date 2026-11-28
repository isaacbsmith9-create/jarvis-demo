// ===================== Hub: Command Center, Round 1: Brain Dump + Deadline Radar =====================
// Brain Dump (Command tab + "Brain dump" shortcut): type or say everything; Claude (or the rule-based quick-add parser
// when Claude isn't available) turns it into items across any days:
//   event → aos-plan events (calendar) · task → Gameplan task with due date (or, when it names one of your classes,
//   Student Lens via sl-inbox + a pending life-school item, like quick add) · block → Gameplan block on that day.
// Preview grouped by day, each item editable/removable, conflicts with the calendar flagged; nothing saves until "Add all".
// Deadline Radar: every open item with a due date from Student Lens (life-school.items) and Gameplan (gp-core.tasks),
// bucketed overdue / today / next 48 h / this week / later, late-policy flags, Done + Dismiss (doc "hub-radar"
// { done: [key], dismissed: [key] } — Student Lens items should also be checked off there). Overdue and due-today items
// pin a card to Hub Today and a "🚨" line to the morning brief.
SUBS.hub.splice(1, 0, ['command', 'Command']);
const CC_TYPES = ['practice', 'lift', 'game', 'personal', 'film', 'school', 'other'];
let ccDraft = null, ccBusy = false, ccMode = false, ccText = '';
const ccRad = () => doc('hub-radar') || (cache['hub-radar'] = { v: 1, done: [], dismissed: [] });
const ccMin = (hhmm) => { if (!hhmm) return null; const [h, m] = String(hhmm).split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const ccHHMM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ccDayLbl = (d) => { const t = todayIso(); return d === t ? 'Today' : d === shiftIso(t, 1) ? 'Tomorrow' : `${DOW[parseIso(d).getDay()]} ${fmtD(d)}`; };
const ccCls = (name) => { if (!name) return null; const n = String(name).toLowerCase(); return (doc('life-school')?.classes || []).find((c) => { const b = c.name.toLowerCase().replace(/\b(ccp|ap|cp|honors)\b/g, '').trim(); return n.includes(b) || b.includes(n) || b.split(' ').some((w) => w.length > 3 && n.includes(w)); }) || null; };

// ---------- parsing ----------
async function ccParse(text) {
  const t = todayIso();
  if (aiOn()) {
    try {
      const classes = (doc('life-school')?.classes || []).map((c) => c.name).join(', ');
      const r = await askAI(`Today is ${DOW[parseIso(t).getDay()]} ${t}. A high-school athlete is brain-dumping his schedule and to-dos. Turn it into items.
Kinds: "event" = something at a set time on a day (practice, lift, game, church, pictures, a show to watch, scouting, appointments) — needs date, start "HH:MM" (24h), end "HH:MM" if known; type one of ${CC_TYPES.join('|')}.
"task" = something to get done by a date (homework, assignments, errands) — due "YYYY-MM-DD" or null, cls = the class name if it is schoolwork (his classes: ${classes || 'unknown'}), urgent true if overdue or due within 2 days, est minutes (guess 15–90).
"block" = time he wants to spend doing something on a day ("do homework 3 to 4") — date, start, end.
Resolve weekday names to the NEXT such date (today counts as today). "Tomorrow" = ${shiftIso(t, 1)}. Something "past due"/"was due" gets its real past date. Keep his wording short in titles. "maybe" → keep it, add "(maybe)" to the title.
Text: """${text}"""
Reply JSON only: {"items":[{"kind":"event|task|block","title":"","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","type":"","due":"YYYY-MM-DD","cls":"","urgent":false,"est":30}]}`, true);
      const items = (r?.items || []).filter((x) => x && x.title && ['event', 'task', 'block'].includes(x.kind));
      if (items.length) return items.map(ccNorm);
    } catch (e) { toast(aiError(e)); }
  }
  // rule-based: split, then the quick-add parser for each piece
  const out = [];
  for (const p of rvSplitLocal(text)) {
    const g = capGuess(p);
    if (g.dest === 'plan') { for (const b of g.blocks) out.push({ kind: ['practice', 'school'].includes(b.type) ? 'event' : 'block', title: b.title, date: g.date, start: ccHHMM(b.start), end: ccHHMM(b.start + b.mins), type: b.type === 'train' ? 'other' : b.type }); continue; }
    if (g.dest === 'cal') out.push({ kind: 'event', title: g.title, date: g.date || t, start: g.time || '', end: '', type: CC_TYPES.includes(g.type) ? g.type : 'other' });
    else if (g.dest === 'school') out.push({ kind: 'task', title: g.title, due: g.date, cls: hubSafe(() => scClass(g.classId)?.name, '') || '', est: 30 });
    else if (g.dest === 'task') out.push({ kind: 'task', title: g.title, due: g.date || null, est: 30 });
  }
  return out.map(ccNorm);
}
function ccNorm(x) { const o = ccNorm0(x); if (ccAlready(o)) { o.on = false; o.dup = true; } return o; }
function ccNorm0(x) {
  const t = todayIso(), o = { id: uid('cc'), on: true, kind: x.kind, title: String(x.title).trim().slice(0, 70) };
  if (o.kind === 'task') { o.due = /^\d{4}-\d{2}-\d{2}$/.test(x.due || '') ? x.due : null; const c = ccCls(x.cls); o.clsId = c?.id || null; o.est = Math.max(5, Math.min(240, Number(x.est) || 30)); o.urgent = !!x.urgent || (o.due && o.due <= shiftIso(t, 2)); o.date = o.due || t; }
  else { o.date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : t; o.start = ccMin(x.start) != null ? ccHHMM(ccMin(x.start)) : ''; o.end = ccMin(x.end) != null ? ccHHMM(ccMin(x.end)) : ''; o.type = CC_TYPES.includes(x.type) ? x.type : 'other'; }
  return o;
}
function ccConflicts(x) {
  if (x.kind === 'task' || !x.start) return [];
  const s = ccMin(x.start), e = x.end ? ccMin(x.end) : s + 60, its = hubSafe(() => tdItems(x.date), []) || [];
  const others = (ccDraft?.items || []).filter((y) => y !== x && y.on && y.kind !== 'task' && y.date === x.date && y.start).map((y) => ({ title: y.title, st: ccMin(y.start), mins: (y.end ? ccMin(y.end) : ccMin(y.start) + 60) - ccMin(y.start) }));
  return [...its, ...others].filter((i) => i.st != null && i.st < e && s < i.st + (i.mins || 30) && !ccDup(x, i)).map((i) => i.title).slice(0, 2);
}
const ccNormT = (t) => String(t || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ccDup = (x, i) => i.st === ccMin(x.start) && ccNormT(i.title) === ccNormT(x.title);
function ccAlready(x) { if (x.kind === 'task') { const n = ccNormT(x.title); return [...(doc('gp-core')?.tasks || []).filter((t) => !t.done), ...(doc('life-school')?.items || []).filter((t) => !t.done)].some((t) => ccNormT(t.title) === n); } if (!x.start) return false; return (hubSafe(() => tdItems(x.date), []) || []).some((i) => ccDup(x, i)); }
// ---------- save ----------
function ccSave() {
  const L = (ccDraft?.items || []).filter((x) => x.on && x.title.trim()); if (!L.length) return toast('Nothing selected');
  let ev = 0, tk = 0, bl = 0, sl = 0; const P = doc('aos-plan') || (cache['aos-plan'] = { events: [], routines: [], checks: {} }); P.events = P.events || [];
  const C = r3Core(); C.tasks = C.tasks || []; const touched = new Set();
  for (const x of L) {
    if (x.kind === 'event') { const s = ccMin(x.start), e = x.end ? ccMin(x.end) : null; P.events.push({ id: uid('e'), title: x.title, type: x.type, date: x.date, start: x.start || null, end: x.end || null, mins: s != null && e != null && e > s ? e - s : s != null ? 60 : null, notes: 'From brain dump', recur: null, skip: [], remind: 0 }); ev++; }
    else if (x.kind === 'block') { const k = 'gp-d-' + x.date, D = doc(k) || (cache[k] = { blocks: [], entries: [], night: { done: {}, completedAt: null } }); D.blocks = D.blocks || []; const s = ccMin(x.start) ?? 16 * 60, e = x.end ? ccMin(x.end) : s + 60; D.blocks.push({ id: uid('b'), title: x.title, start: ccHHMM(s), mins: Math.max(15, e - s), type: 'focus', done: false, src: 'Brain dump' }); touched.add(k); bl++; }
    else if (x.clsId && x.due) {
      const id = uid('hub'), inbox = doc('sl-inbox') || (cache['sl-inbox'] = { items: [] }), type = /test|exam|quiz/i.test(x.title) ? (/quiz/i.test(x.title) ? 'quiz' : 'exam') : 'homework';
      inbox.items = [...(inbox.items || []), { id, kind: type === 'exam' ? 'exam' : 'assignment', classId: x.clsId, title: x.title, type, date: x.due, time: '', at: Date.now() }]; touched.add('sl-inbox');
      const S = doc('life-school'); if (S) { S.items = [...(S.items || []), { id, title: x.title, cls: x.clsId, type: type === 'exam' ? 'exam' : type === 'quiz' ? 'quiz' : 'hw', due: x.due, time: '', mins: x.est, done: false, pending: true }]; touched.add('life-school'); }
      sl++;
    } else { C.tasks.push({ id: uid('t'), title: x.title, u: !!x.urgent, i: true, due: x.due || '', est: x.est, done: false, top: null, created: Date.now() }); touched.add('gp-core'); tk++; }
  }
  if (ev) persist('aos-plan'); for (const k of touched) persist(k);
  hubSafe(() => saveBrief()); ccDraft = null; ccText = '';
  toast(`Added: ${[ev && `${ev} event${ev > 1 ? 's' : ''}`, bl && `${bl} block${bl > 1 ? 's' : ''}`, tk && `${tk} task${tk > 1 ? 's' : ''}`, sl && `${sl} to Student Lens`].filter(Boolean).join(', ')}`); refresh();
}
// ---------- radar ----------
function ccRadar() {
  const t = todayIso(), R = ccRad(), hide = new Set([...(R.done || []), ...(R.dismissed || [])]), out = [];
  for (const x of doc('life-school')?.items || []) { if (x.done || !x.due) continue; const key = 'sl:' + x.id; if (hide.has(key)) continue; const c = hubSafe(() => scClass(x.cls), null); out.push({ key, src: 'school', title: x.title, due: x.due, cls: c?.name || '', late: c?.latePolicy || null, est: x.mins || null, type: x.type }); }
  for (const x of doc('gp-core')?.tasks || []) { if (x.done || !x.due) continue; const key = 'gp:' + x.id; if (hide.has(key)) continue; out.push({ key, src: 'gp', title: x.title, due: x.due, cls: '', late: null, est: x.est || null, urgent: x.u }); }
  const b = (d) => (d < t ? 'overdue' : d === t ? 'today' : d <= shiftIso(t, 2) ? 'soon' : d <= shiftIso(t, 7) ? 'week' : 'later');
  return out.map((x) => ({ ...x, bucket: b(x.due), days: daysBetween(t, x.due) })).sort((a, z) => a.due.localeCompare(z.due) || (z.late === 'none') - (a.late === 'none'));
}
const CC_B = { overdue: ['🔴', 'Overdue'], today: ['🟠', 'Due today'], soon: ['🟡', 'Next 48 hours'], week: ['🔵', 'This week'], later: ['⚪', 'Later'] };
const ccRow = (x) => `<li class="cc-r ${x.bucket}"><div class="cc-rm"><b>${esc(x.title)}</b><small>${x.cls ? esc(x.cls) + ' · ' : ''}${x.bucket === 'overdue' ? `${-x.days} day${x.days === -1 ? '' : 's'} late` : x.bucket === 'today' ? 'due today' : `due ${ccDayLbl(x.due)}`}${x.est ? ` · ~${x.est} min` : ''}${x.late === 'none' ? ' · <span class="cc-nl">no late work</span>' : x.late === 'full' && x.bucket === 'overdue' ? ' · late OK for full credit' : ''}</small></div>
  <button type="button" class="btn sm" data-ccdone="${esc(x.key)}">Done</button><button type="button" class="btn sm ghost" data-ccdis="${esc(x.key)}" aria-label="Dismiss ${esc(x.title)}">✕</button></li>`;
function ccRadarHtml(all = true) {
  const L = ccRadar(), groups = Object.keys(CC_B).map((k) => [k, L.filter((x) => x.bucket === k)]).filter(([k, v]) => v.length && (all || ['overdue', 'today', 'soon'].includes(k)));
  if (!groups.length) return all ? '<p class="small muted">Nothing due with a date. Brain-dump your assignments above and they show up here.</p>' : '';
  return groups.map(([k, v]) => `<h4 class="cc-h">${CC_B[k][0]} ${CC_B[k][1]} <span>${v.length}</span></h4><ul class="cc-list">${v.map(ccRow).join('')}</ul>`).join('');
}
function ccMark(key, kind) {
  const R = ccRad(); R[kind] = [...new Set([...(R[kind] || []), key])].slice(-300); persist('hub-radar');
  if (kind === 'done' && key.startsWith('gp:')) { const C = doc('gp-core'), x = C?.tasks?.find((y) => y.id === key.slice(3)); if (x) { x.done = true; persist('gp-core'); } }
  hubSafe(() => saveBrief()); toast(kind === 'done' ? (key.startsWith('sl:') ? 'Done. Check it off in Student Lens too.' : 'Done ✓') : 'Dismissed'); refresh();
}
// ---------- views ----------
function ccDumpHtml() {
  const D = ccDraft;
  const box = `<section class="card cc-dump"><h3>🧠 Brain dump</h3><p class="small muted" style="margin:2px 0 8px">Say or type everything: schedule, homework, plans, any day this week. ${aiOn() ? 'Claude sorts it.' : 'It gets sorted into events, tasks and blocks.'}</p>
    <textarea id="cc-in" rows="4" placeholder="Practice 9 to 10 and 10 to 11, lift till 11:20, family pictures 1 to 2. Sunday church 8:55 to 11, Bengals 1 to 4 maybe. Psych homework due the 30th…">${esc(D?.raw || ccText)}</textarea>
    <div class="row" style="gap:8px;margin-top:8px;justify-content:flex-end"><button type="button" class="btn${r1Mic && ccMode ? ' cap-mic on' : ''}" data-cc="mic">${r1Mic && ccMode ? '■ Stop' : '🎤 Talk'}</button><button type="button" class="btn primary" data-cc="go"${ccBusy ? ' disabled' : ''}>${ccBusy ? 'Sorting…' : 'Sort it'}</button></div></section>`;
  if (!D?.items) return box;
  const days = [...new Set(D.items.map((x) => (x.kind === 'task' ? (x.due || '~') : x.date)))].sort();
  const row = (x) => { const cf = ccConflicts(x); return `<li class="cc-i ${x.on ? '' : 'off'}"><input type="checkbox" data-ccon="${x.id}"${x.on ? ' checked' : ''} aria-label="Include">
    <span class="cc-k ${x.kind}">${x.kind === 'event' ? 'Event' : x.kind === 'block' ? 'Block' : x.clsId ? 'School' : 'Task'}</span>
    <input type="text" data-ccf="title" data-id="${x.id}" value="${esc(x.title)}" aria-label="Title">
    ${x.kind === 'task' ? `<input type="date" data-ccf="due" data-id="${x.id}" value="${x.due || ''}" aria-label="Due">` : `<div class="cc-dt"><input type="date" data-ccf="date" data-id="${x.id}" value="${x.date}" aria-label="Date"><input type="time" data-ccf="start" data-id="${x.id}" value="${x.start}" aria-label="Start"><span>–</span><input type="time" data-ccf="end" data-id="${x.id}" value="${x.end}" aria-label="End"></div>`}
    ${x.dup ? '<small class="cc-cf">Already on your calendar / task list (unchecked)</small>' : cf.length ? `<small class="cc-cf">⚠️ Overlaps ${esc(cf.join(', '))}</small>` : ''}</li>`; };
  return box + `<section class="card cc-prev"><div class="row" style="justify-content:space-between"><h3>Check it</h3><span class="tag">${D.items.filter((x) => x.on).length} items</span></div>
    ${days.map((d) => `<h4 class="cc-h">${d === '~' ? 'No due date' : ccDayLbl(d)}</h4><ul class="cc-items">${D.items.filter((x) => (x.kind === 'task' ? (x.due || '~') : x.date) === d).map(row).join('')}</ul>`).join('')}
    <p class="tiny muted" style="margin:8px 0 0">Events go on your calendar, blocks into Gameplan for that day, tasks into Gameplan (schoolwork for one of your classes goes to Student Lens).</p>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button type="button" class="btn sm" data-cc="clear">Cancel</button><button type="button" class="btn primary" data-cc="save">Add all</button></div></section>`;
}
HUB.command = (el) => {
  const L = ccRadar(), od = L.filter((x) => x.bucket === 'overdue').length;
  el.innerHTML = `<section class="hub-head"><h1>Command</h1><p class="hub-sum">Dump everything in your head, then see every deadline in one place.${od ? ` <b class="cc-nl">${od} overdue.</b>` : ''}</p></section>${ccDumpHtml()}<section class="card"><h3>📡 Deadline radar</h3>${ccRadarHtml(true)}</section>`;
};
function ccTodayCard() { const h = ccRadarHtml(false); return h ? `<section class="card cc-today"><div class="row" style="justify-content:space-between"><h3>📡 Due soon</h3><button type="button" class="btn sm ghost" data-ccgo>All deadlines</button></div>${h}</section>` : ''; }
async function ccGo() {
  ccMode = false; const raw = ($('#cc-in')?.value || ccText || '').trim(); ccText = raw; if (!raw) return toast('Say or type something first');
  ccBusy = true; ccDraft = { raw }; refresh();
  const items = await ccParse(raw); ccBusy = false; ccDraft = { raw, items }; refresh();
  if (!items.length) toast('Couldn’t find anything to add. Try adding days and times.');
}
// ---------- wiring ----------
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => { const c = ccTodayCard(); if (!c) return; (el.querySelector('.hsc-bar') || el.querySelector('.hub-head'))?.insertAdjacentHTML('afterend', c); }); }; }
{ const _bf = briefFor; briefFor = function (date) { const B = _bf(date); try { const L = ccRadar().filter((x) => x.due < date); if (L.length) { B.lines.splice(1, 0, `🚨 Overdue: ${L.slice(0, 3).map((x) => x.title).join(' · ')}`); B.text = B.lines.join('\n'); } } catch {} return B; }; window.Ecosystem = { ...(window.Ecosystem || {}), brief: briefFor }; }
RC_SC.dump = ['🧠', 'Brain dump', () => { go('hub', 'command'); setTimeout(() => $('#cc-in')?.focus(), 80); }];
RC_SC.radar = ['📡', 'Deadlines', () => go('hub', 'command')];
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cc]');
  if (b) { const k = b.dataset.cc;
    if (k === 'go') return ccGo();
    if (k === 'save') return ccSave();
    if (k === 'clear') { ccDraft = null; ccText = ''; return refresh(); }
    if (k === 'mic') { if (r1Mic) { r1MicTap(); return; } ccMode = true; ccText = $('#cc-in')?.value || ''; r1MicTap(); r1Base = ccText; return; } }
  const d = e.target.closest('[data-ccdone]'); if (d) return ccMark(d.dataset.ccdone, 'done');
  const x = e.target.closest('[data-ccdis]'); if (x) return ccMark(x.dataset.ccdis, 'dismissed');
  if (e.target.closest('[data-ccgo]')) return go('hub', 'command');
});
document.addEventListener('change', (e) => {
  const on = e.target.closest?.('[data-ccon]'); if (on && ccDraft?.items) { const x = ccDraft.items.find((y) => y.id === on.dataset.ccon); if (x) x.on = on.checked; return refresh(); }
  const f = e.target.closest?.('[data-ccf]'); if (f && ccDraft?.items) { const x = ccDraft.items.find((y) => y.id === f.dataset.id); if (!x) return; x[f.dataset.ccf] = f.value; if (f.dataset.ccf === 'due') x.date = f.value || todayIso(); refresh(); }
});
// voice into the brain-dump box: the quick-add mic writes here instead while the Command tab is open
{ const _say = r1Say; r1Say = function (t) { if (!ccMode) return _say(t); ccText = [r1Base, t].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(); const ta = $('#cc-in'); if (ta) ta.value = ccText; }; }
document.addEventListener('input', (e) => { if (e.target.id === 'cc-in') ccText = e.target.value; });
{ const _t = HUB.today; HUB.today = (el) => { ccMode = false; _t(el); }; }
window.Ecosystem = { ...(window.Ecosystem || {}), dump: { parse: ccParse, save: () => ccSave() }, radar: ccRadar };
