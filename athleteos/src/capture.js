// ===================== Quick capture (Hub › Today) =====================
// One box: type what happened or what's coming ("Spanish quiz Friday", "lift legs tomorrow 4pm", "email coach").
// It guesses where it belongs, shows the guess so you can fix it, then saves it:
//   Student Lens  → doc "sl-inbox" (Student Lens adds it the next time it opens) + shows in life-school right away
//   Calendar      → Athlete OS calendar (aos-plan events)
//   Gameplan task → gp-core tasks
//   MacroLens     → opens MacroLens with the text copied, since its AI food logging does the macros
const CAP_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const CAP_MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CAP_ALIAS = { biology: ['bio'], 'pre-calculus': ['precalc', 'pre-calc', 'pre calc', 'calc', 'math'], psychology: ['psych'], spanish: ['espanol', 'español'], english: ['eng'], nutrition: ['nutr'], history: ['hist'], marketing: ['mkt'] };
const CAP_TRAIN = { lift: 'lift', legs: 'lift', 'upper body': 'lift', 'lower body': 'lift', weights: 'lift', gym: 'lift', practice: 'practice', game: 'game', shooting: 'shooting', shoot: 'shooting', shots: 'shooting', workout: 'skill', 'skill work': 'skill', handles: 'skill', conditioning: 'conditioning', sprints: 'conditioning', run: 'conditioning', 'film study': 'film', 'watch film': 'film', stretch: 'recovery', recovery: 'recovery', mobility: 'recovery' };
const CAP_SCHOOL = /\b(quiz|test|exam|midterm|final|hw|homework|assignment|project|essay|paper|lab|reading|worksheet|due|study guide)\b/;
const CAP_FOOD = /\b(ate|eat|eating|breakfast|lunch|dinner|snack|shake|protein bar|chicken|rice|pasta|eggs|sandwich|burger|pizza|smoothie|oatmeal)\b/;

function capWhen(raw) {
  let s = ` ${raw.toLowerCase()} `, date = null, time = null;
  const t = todayIso(), cut = (re) => { s = s.replace(re, ' '); };
  const tm = s.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || s.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (tm) { let h = Number(tm[1]) % (tm[3] ? 12 : 24); if (tm[3] === 'pm') h += 12; time = `${String(h).padStart(2, '0')}:${tm[2] || '00'}`; cut(tm[0]); }
  let m;
  if ((m = s.match(/\b(today|tonight)\b/))) { date = t; cut(m[0]); }
  else if ((m = s.match(/\b(tomorrow|tmrw|tmr)\b/))) { date = shiftIso(t, 1); cut(m[0]); }
  else if ((m = s.match(/\bin (\d+) days?\b/))) { date = shiftIso(t, Number(m[1])); cut(m[0]); }
  else if ((m = s.match(/\b(?:on\s+)?(?:(next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)\b/))) {
    const want = CAP_DAYS.findIndex((d) => d.startsWith(m[2].slice(0, 3))), cur = parseIso(t).getDay();
    let add = (want - cur + 7) % 7 || 7; if (m[1]) add += add < 7 ? 7 : 0; date = shiftIso(t, add); cut(m[0]);
  } else if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/))) { date = capYear(Number(m[1]), Number(m[2])); cut(m[0]); }
  else if ((m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/))) { date = capYear(CAP_MON.indexOf(m[1].slice(0, 3)) + 1, Number(m[2])); cut(m[0]); }
  cut(/\b(due|on|at|by)\s*$/); cut(/\s(due|by|on)\s+(?=\s|$)/g);
  return { date, time, rest: s.replace(/\s+/g, ' ').trim() };
}
function capYear(mo, d) { const t = todayIso(), y = Number(t.slice(0, 4)); let iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; if (iso < shiftIso(t, -30)) iso = `${y + 1}${iso.slice(4)}`; return iso; }
function capClass(s) {
  const cs = doc('life-school')?.classes || [];
  for (const c of cs) {
    const base = c.name.toLowerCase().replace(/\b(ccp|ap|cp|honors|h)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const keys = [base, ...base.split(' ').filter((w) => w.length > 3), ...Object.entries(CAP_ALIAS).filter(([k]) => base.includes(k)).flatMap(([, v]) => v)];
    const hit = keys.find((k) => k && new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(s));
    if (hit) return { c, hit };
  }
  return null;
}
const capCap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function capGuess(raw) {
  const w = capWhen(raw), s = ` ${w.rest} `, cl = capClass(s);
  if (cl || CAP_SCHOOL.test(s)) {
    const kw = (s.match(CAP_SCHOOL) || [])[1] || 'homework';
    const type = /exam|midterm|final|test/.test(kw) ? 'exam' : kw === 'quiz' ? 'quiz' : /project/.test(kw) ? 'project' : /essay|paper/.test(kw) ? 'essay' : kw === 'lab' ? 'lab' : kw === 'reading' ? 'reading' : 'homework';
    return { dest: 'school', title: capCap(w.rest.replace(/\bdue\b/g, '').replace(/\s+/g, ' ').trim()) || 'Assignment', classId: cl?.c.id || '', type, date: w.date || shiftIso(todayIso(), 1), time: w.time };
  }
  const tk = Object.keys(CAP_TRAIN).find((k) => new RegExp(`\\b${k}\\b`).test(s));
  if (tk && !CAP_FOOD.test(s)) return { dest: 'cal', title: capCap(w.rest), type: CAP_TRAIN[tk], date: w.date || todayIso(), time: w.time };
  if (CAP_FOOD.test(s)) return { dest: 'ml', title: raw.trim(), date: w.date || todayIso() };
  return { dest: 'task', title: capCap(w.rest) || raw.trim(), date: w.date, time: w.time };
}
const CAP_DEST = [['school', 'Student Lens', 'school'], ['cal', 'Calendar (Athlete OS)', 'aos'], ['task', 'Gameplan task', 'gp'], ['ml', 'MacroLens', 'ml']];
const CAP_STYPES = [['homework', 'Homework'], ['quiz', 'Quiz'], ['exam', 'Test / exam'], ['project', 'Project'], ['essay', 'Essay'], ['lab', 'Lab'], ['reading', 'Reading']];
let capDraft = null;

function hubCapture() {
  const g = capDraft, cs = doc('life-school')?.classes || [];
  const opt = (list, cur) => list.map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
  return `<section class="card cap"><form id="cap-f" class="cap-row" autocomplete="off"><input id="cap-in" type="text" placeholder="Add anything: “Spanish quiz Friday”, “lift legs tomorrow 4pm”…" aria-label="Quick add" value="${esc(g?.raw || '')}"><button class="btn primary" type="submit">Add</button></form>
    ${g ? `<div class="cap-prev" style="--c:${EV_APPS[CAP_DEST.find((d) => d[0] === g.dest)[2]].color}">
      <div class="fields">
        <label>Goes to<select id="cap-dest">${opt(CAP_DEST.map(([k, l]) => [k, l]), g.dest)}</select></label>
        ${g.dest === 'ml' ? '' : `<label class="full">Title<input id="cap-title" type="text" value="${esc(g.title)}"></label>`}
        ${g.dest === 'school' ? `<label>Class<select id="cap-cls"><option value="">Pick a class</option>${opt(cs.map((c) => [c.id, c.name]), g.classId)}</select></label><label>Type<select id="cap-type">${opt(CAP_STYPES, g.type)}</select></label>` : ''}
        ${g.dest === 'cal' ? `<label>Type<select id="cap-type">${opt(EV_PICK.map((x) => [x[0], x[1]]), g.type)}</select></label>` : ''}
        ${g.dest === 'ml' ? `<p class="small muted full" style="margin:0">MacroLens works out the calories and macros. Saving copies “${esc(g.title)}” and opens MacroLens so you can paste it into its food box.</p>` : `<label>${g.dest === 'school' ? 'Due' : 'Date'}<input id="cap-date" type="date" value="${g.date || ''}"></label><label>Time<input id="cap-time" type="time" value="${g.time || ''}"></label>`}
      </div>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button type="button" class="btn sm" id="cap-x">Cancel</button><button type="button" class="btn sm primary" id="cap-ok">${g.dest === 'ml' ? 'Copy and open MacroLens' : 'Save'}</button></div>
    </div>` : ''}</section>`;
}
function capRead() {
  const v = (id) => $('#' + id)?.value;
  if ($('#cap-dest')) Object.assign(capDraft, { title: v('cap-title') ?? capDraft.title, classId: v('cap-cls') ?? capDraft.classId, type: v('cap-type') ?? capDraft.type, date: v('cap-date') ?? capDraft.date, time: v('cap-time') ?? capDraft.time });
}
async function capSave() {
  capRead(); const g = capDraft; if (!g) return;
  if (g.dest !== 'ml' && !String(g.title || '').trim()) return toast('Add a title');
  if (g.dest === 'school') {
    if (!g.classId) return toast('Pick a class');
    if (!g.date) return toast('Pick a due date');
    const id = uid('hub'), inbox = doc('sl-inbox') || (cache['sl-inbox'] = { items: [] });
    inbox.items = [...(inbox.items || []).filter((x) => !x.done || x.done > Date.now() - 30 * 864e5), { id, kind: g.type === 'exam' ? 'exam' : 'assignment', classId: g.classId, title: g.title.trim(), type: g.type, date: g.date, time: g.time || '', at: Date.now() }];
    persist('sl-inbox');
    const S = doc('life-school'); if (S) { S.items = [...(S.items || []), { id, title: g.title.trim(), cls: g.classId, type: g.type === 'exam' ? 'exam' : g.type === 'quiz' ? 'quiz' : ['project', 'essay'].includes(g.type) ? g.type : 'hw', due: g.date, time: g.time || '', mins: 30, done: false, pending: true }]; persist('life-school'); }
    toast(`Added to Student Lens: ${g.title.trim()}`);
  } else if (g.dest === 'cal') {
    const P = plan(); P.events = [...(P.events || []), { id: uid('e'), title: g.title.trim().slice(0, 50), type: g.type || 'skill', date: g.date || todayIso(), start: g.time || null, end: null, mins: g.time ? 60 : null, remind: 0, notes: '', recur: null }];
    persist('aos-plan'); toast('Added to your calendar');
  } else if (g.dest === 'task') {
    const C = doc('gp-core'); if (!C) return toast('Open Gameplan once first, then tasks can be added from here');
    C.tasks = [...(C.tasks || []), { id: uid('t'), title: g.title.trim(), u: false, i: false, due: g.date || '', done: false, top: null, created: Date.now() }];
    persist('gp-core'); toast('Added to Gameplan tasks');
  } else {
    try { await navigator.clipboard.writeText(g.title); } catch {}
    capDraft = null; return goTo('macrolens.html#today');
  }
  capDraft = null; refresh();
}
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'cap-f') return; e.preventDefault();
  const raw = $('#cap-in').value.trim(); if (!raw) return;
  capDraft = { raw, ...capGuess(raw) }; refresh(); setTimeout(() => $('#cap-ok')?.focus(), 30);
});
document.addEventListener('change', (e) => { if (e.target.id === 'cap-dest') { capRead(); capDraft.dest = e.target.value; if (capDraft.dest === 'cal' && !EV_PICK.some((x) => x[0] === capDraft.type)) capDraft.type = 'skill'; if (capDraft.dest === 'school' && !CAP_STYPES.some((x) => x[0] === capDraft.type)) capDraft.type = 'homework'; refresh(); } });
document.addEventListener('click', (e) => {
  if (e.target.id === 'cap-x') { capDraft = null; refresh(); }
  if (e.target.id === 'cap-ok') capSave();
});
const capToday = HUB.today;
HUB.today = (el) => { capToday(el); hubSafe(() => $('.hub-head', el)?.insertAdjacentHTML('afterend', hubCapture())); };
