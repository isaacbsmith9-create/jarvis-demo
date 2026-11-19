'use strict';
// ===================== utilities =====================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const pad = (n) => String(n).padStart(2, '0');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : null);

// ===================== dates (all local, YYYY-MM-DD strings) =====================
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const parseIso = (s) => new Date(s + 'T12:00:00');
const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return isoOf(d); };
const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
const dow = (s) => parseIso(s).getDay();
const weekStart = (s) => addDays(s, -((dow(s) + 6) % 7)); // Monday
const toMin = (t) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
const fromMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const fmtTime = (t) => { if (!t) return ''; const m = toMin(t), h = Math.floor(m / 60); return `${h % 12 || 12}:${pad(m % 60)}${h < 12 ? 'am' : 'pm'}`; };
const fmtDate = (s, o = { month: 'short', day: 'numeric' }) => (s ? parseIso(s).toLocaleDateString(undefined, o) : '');
const fmtDay = (s) => parseIso(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtMins = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
function relDay(s) {
  const n = daysBetween(today(), s);
  if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days ago`; if (n < 7) return parseIso(s).toLocaleDateString(undefined, { weekday: 'long' });
  return fmtDate(s);
}
const relDayL = (s) => { const r = relDay(s); return /^(Today|Tomorrow|Yesterday)$/.test(r) ? r.toLowerCase() : /days ago$/.test(r) ? r : 'on ' + r; };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ===================== storage: IndexedDB (one record per collection), with a localStorage fallback =====================
// Collections are kept in memory and written through. The layout is backend-ready: each collection is an array of records with ids.
const DB_NAME = 'student-lens', STORE = 'kv', VERSION = 1;
const COLLECTIONS = ['classes', 'assignments', 'exams', 'events', 'sessions', 'decks', 'cards', 'guides', 'notes', 'results', 'docs', 'topics', 'goals', 'recs', 'snapshots'];
const S = { profile: null, settings: null, ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])) };
let idb = null, useLS = false;
function openDB() {
  return new Promise((res) => {
    if (!window.indexedDB) { useLS = true; return res(null); }
    const rq = indexedDB.open(DB_NAME, VERSION);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => { useLS = true; res(null); };
  });
}
function idbGet(k) { return new Promise((res) => { try { const r = idb.transaction(STORE).objectStore(STORE).get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch { res(undefined); } }); }
function idbSet(k, v) { return new Promise((res, rej) => { try { const tx = idb.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); } catch (e) { rej(e); } }); }
const DEFAULT_SETTINGS = () => ({ theme: 'dark', dailyStudyMins: 60, dailyWorkMins: 120, studyStart: '16:00', studyEnd: '21:30', pomo: 25, brk: 5, weekStartsMonday: true,
  scale: [['A', 93, 4.0], ['A-', 90, 3.7], ['B+', 87, 3.3], ['B', 83, 3.0], ['B-', 80, 2.7], ['C+', 77, 2.3], ['C', 73, 2.0], ['C-', 70, 1.7], ['D+', 67, 1.3], ['D', 63, 1.0], ['D-', 60, 0.7], ['F', 0, 0]],
  honorsBonus: 0.5, apBonus: 1.0, demo: false });
const DEFAULT_PROFILE = () => ({ name: '', school: '', grade: '', term: '' });
async function loadAll() {
  idb = await openDB();
  for (const k of ['profile', 'settings', ...COLLECTIONS]) {
    let v;
    if (idb) v = await idbGet(k); else { try { v = JSON.parse(localStorage.getItem('sl:' + k) || 'null'); } catch { v = null; } }
    if (v != null) S[k] = v;
  }
  S.profile = { ...DEFAULT_PROFILE(), ...(S.profile || {}) };
  S.settings = { ...DEFAULT_SETTINGS(), ...(S.settings || {}) };
}
const dirty = new Set(); let saveT = null;
function save(...keys) {
  keys.forEach((k) => dirty.add(k));
  clearTimeout(saveT); saveT = setTimeout(flushSave, 120);
  emit();
}
async function flushSave() {
  const ks = [...dirty]; dirty.clear();
  for (const k of ks) {
    try { if (idb) await idbSet(k, JSON.parse(JSON.stringify(S[k]))); else localStorage.setItem('sl:' + k, JSON.stringify(S[k])); }
    catch (e) { toast('Could not save. Your device storage may be full.'); console.error(e); }
  }
}
window.addEventListener('pagehide', () => { if (dirty.size) flushSave(); });
const listeners = new Set();
const onChange = (f) => listeners.add(f);
function emit() { listeners.forEach((f) => f()); }

// generic CRUD
function upsert(col, rec) { const a = S[col], i = a.findIndex((x) => x.id === rec.id); if (i >= 0) a[i] = rec; else a.push(rec); save(col); return rec; }
function remove(col, id) { S[col] = S[col].filter((x) => x.id !== id); save(col); }
const byId = (col, id) => S[col].find((x) => x.id === id);
const cls = (id) => byId('classes', id);
const clsColor = (id) => cls(id)?.color || '#6d7cff';
const clsName = (id) => cls(id)?.name || 'No class';

// ===================== backup / restore =====================
function exportJSON() { return JSON.stringify({ app: 'student-lens', version: 1, exportedAt: new Date().toISOString(), profile: S.profile, settings: S.settings, ...Object.fromEntries(COLLECTIONS.map((c) => [c, S[c]])) }, null, 2); }
function validateBackup(o) {
  if (!o || typeof o !== 'object' || o.app !== 'student-lens') return 'This is not a Student Lens backup file.';
  for (const c of COLLECTIONS) if (o[c] != null && !Array.isArray(o[c])) return `The "${c}" section is damaged.`;
  for (const c of COLLECTIONS) for (const r of o[c] || []) if (!r || typeof r.id !== 'string') return `A record in "${c}" has no id.`;
  return null;
}
function importJSON(o) {
  S.profile = { ...DEFAULT_PROFILE(), ...(o.profile || {}) }; S.settings = { ...DEFAULT_SETTINGS(), ...(o.settings || {}) };
  for (const c of COLLECTIONS) S[c] = Array.isArray(o[c]) ? o[c] : [];
  save('profile', 'settings', ...COLLECTIONS);
}

// ===================== assignments: status, overdue, workload =====================
const DONE_ST = new Set(['completed', 'submitted']);
const isDone = (a) => DONE_ST.has(a.status);
const isGraded = (a) => a.score != null && a.score !== '' && a.max > 0;
function effStatus(a) { if (isDone(a)) return a.status; if (a.due && a.due < today()) return 'overdue'; return a.status || 'not_started'; }
const STATUS = { not_started: ['Not started', ''], in_progress: ['In progress', 'accent'], completed: ['Completed', 'good'], submitted: ['Submitted', 'good'], overdue: ['Overdue', 'bad'] };
const TYPES = { homework: 'Homework', project: 'Project', quiz: 'Quiz', test: 'Test', essay: 'Essay', lab: 'Lab', reading: 'Reading', other: 'Other' };
const TYPE_ICON = { homework: 'file-text', project: 'layers', quiz: 'circle-help', test: 'graduation-cap', essay: 'notebook-pen', lab: 'zap', reading: 'book-open', other: 'circle' };
const DEF_MINS = { homework: 30, project: 90, quiz: 30, test: 60, essay: 90, lab: 45, reading: 30, other: 30 };
// Automatic overdue detection: store the status so lists and analytics agree.
function refreshOverdue() {
  let ch = false; const t = today();
  for (const a of S.assignments) { if (!isDone(a) && a.due && a.due < t && a.status !== 'overdue') { a.status = 'overdue'; ch = true; } if (a.status === 'overdue' && a.due >= t) { a.status = 'not_started'; ch = true; } }
  if (ch) save('assignments');
}
const openAssignments = () => S.assignments.filter((a) => !isDone(a));
function workloadOn(date) { return sum(openAssignments().filter((a) => a.due === date).map((a) => Number(a.estMins) || DEF_MINS[a.type] || 30)); }
// Expand recurring assignments into real records up to N weeks ahead (each copy is its own assignment you can finish).
function expandRecurring() {
  let ch = false; const horizon = addDays(today(), 21);
  for (const tpl of S.assignments.filter((a) => a.recur && !a.recurOf)) {
    const until = tpl.recur.until || horizon, days = tpl.recur.days || [dow(tpl.due)];
    for (let d = addDays(tpl.due, 1); d <= until && d <= horizon; d = addDays(d, 1)) {
      if (!days.includes(dow(d))) continue;
      if (S.assignments.some((x) => x.recurOf === tpl.id && x.due === d)) continue;
      const { id, recur, score, completedAt, submittedAt, actualMins, ...rest } = tpl;
      S.assignments.push({ ...rest, id: uid('a'), recurOf: tpl.id, due: d, status: 'not_started', score: null, createdAt: Date.now() }); ch = true;
    }
  }
  if (ch) save('assignments');
}
const isDuplicate = (rec, col = 'assignments') => S[col].some((x) => x.id !== rec.id && x.classId === rec.classId && (x.title || '').trim().toLowerCase() === (rec.title || '').trim().toLowerCase() && (x.due || x.date) === (rec.due || rec.date));

// ===================== grades =====================
function letterOf(pct) { if (pct == null) return null; for (const [l, min] of S.settings.scale) if (pct >= min - 1e-9) return l; return 'F'; }
function pointsOf(letter) { const r = S.settings.scale.find((x) => x[0] === letter); return r ? r[2] : 0; }
/** Every graded item of a class: assignments with a score, and exams with a score. */
function gradedItems(cid, upTo = null) {
  const items = [];
  for (const a of S.assignments) if (a.classId === cid && isGraded(a)) items.push({ id: a.id, title: a.title, cat: a.categoryId, score: +a.score, max: +a.max, date: a.gradedOn || a.due || today(), kind: 'assignment' });
  for (const e of S.exams) if (e.classId === cid && e.score != null && e.score !== '' && e.max > 0) items.push({ id: e.id, title: e.title, cat: e.categoryId, score: +e.score, max: +e.max, date: e.date, kind: 'exam' });
  return items.filter((x) => !upTo || x.date <= upTo).sort((a, b) => a.date.localeCompare(b.date));
}
/** Current grade for a class. Weighted: points within each category, weights re-normalized over categories that have grades. */
function classGrade(cid, extra = [], upTo = null) {
  const c = cls(cid); if (!c) return null;
  const items = [...gradedItems(cid, upTo), ...extra];
  if (!items.length) return { pct: null, letter: null, cats: [], count: 0 };
  if (c.gradingMode === 'points' || !(c.categories || []).length) {
    const s = sum(items.map((x) => x.score)), m = sum(items.map((x) => x.max)), pct = (s / m) * 100;
    return { pct, letter: letterOf(pct), cats: [{ id: '_all', name: 'All work', weight: 100, pct, earned: s, possible: m, n: items.length }], count: items.length };
  }
  const cats = c.categories.map((k) => { const its = items.filter((x) => x.cat === k.id); const s = sum(its.map((x) => x.score)), m = sum(its.map((x) => x.max)); return { id: k.id, name: k.name, weight: +k.weight, pct: m ? (s / m) * 100 : null, earned: s, possible: m, n: its.length }; });
  const uncategorized = items.filter((x) => !c.categories.some((k) => k.id === x.cat));
  const used = cats.filter((k) => k.pct != null && k.weight > 0), W = sum(used.map((k) => k.weight));
  if (!W) { const s = sum(items.map((x) => x.score)), m = sum(items.map((x) => x.max)); const pct = (s / m) * 100; return { pct, letter: letterOf(pct), cats, count: items.length, uncategorized: uncategorized.length }; }
  const pct = sum(used.map((k) => k.weight * k.pct)) / W;
  return { pct, letter: letterOf(pct), cats, count: items.length, uncategorized: uncategorized.length, coverage: W / sum(cats.map((k) => k.weight || 0)) };
}
/** Score needed on one more item (worth `max` points, in category `catId`) to finish at `target` percent. Null = impossible to express. */
function neededScore(cid, catId, max, target) {
  const c = cls(cid); const items = gradedItems(cid);
  if (c.gradingMode === 'points' || !(c.categories || []).length) {
    const s = sum(items.map((x) => x.score)), m = sum(items.map((x) => x.max));
    return (target / 100) * (m + max) - s;
  }
  const g = classGrade(cid), cats = g.cats.length ? g.cats : [];
  const k = cats.find((x) => x.id === catId); if (!k || !(k.weight > 0)) return null;
  const others = cats.filter((x) => x.id !== catId && x.pct != null && x.weight > 0);
  const W = sum(others.map((x) => x.weight)) + k.weight, rest = sum(others.map((x) => x.weight * x.pct));
  const needCatPct = (target * W - rest) / k.weight; // percent needed in that category afterwards
  return (needCatPct / 100) * (k.possible + max) - k.earned;
}
function gpaFor(classIds = S.classes.map((c) => c.id), upTo = null) {
  let u = 0, w = 0, cr = 0;
  for (const id of classIds) {
    const c = cls(id), g = classGrade(id, [], upTo); if (!c || !g || g.pct == null) continue;
    const credits = Number(c.credits) || 1, p = pointsOf(g.letter);
    const bonus = p > 0 ? (c.level === 'ap' ? S.settings.apBonus : c.level === 'honors' ? S.settings.honorsBonus : 0) : 0;
    u += p * credits; w += (p + bonus) * credits; cr += credits;
  }
  return cr ? { unweighted: u / cr, weighted: w / cr, credits: cr } : null;
}
/** A class grade after each graded item, oldest first (for trend lines). */
function gradeHistory(cid) {
  const dates = [...new Set(gradedItems(cid).map((x) => x.date))];
  return dates.map((d) => ({ date: d, pct: classGrade(cid, [], d).pct }));
}

// ===================== priority engine (explainable, rule-based) =====================
function priorityOf(a) {
  const t = today(), d = a.due ? daysBetween(t, a.due) : 14, why = [];
  let s;
  if (d < 0) { s = 100 + Math.min(20, -d * 4); why.push(`${-d} day${d === -1 ? '' : 's'} overdue`); }
  else if (d === 0) { s = 90; why.push('due today'); } else if (d === 1) { s = 78; why.push('due tomorrow'); }
  else if (d <= 3) { s = 64 - d * 3; why.push(`due in ${d} days`); } else if (d <= 7) { s = 44 - d; why.push('due this week'); } else s = Math.max(8, 30 - d);
  const imp = { test: 14, project: 12, essay: 10, quiz: 8, lab: 6, homework: 3, reading: 2, other: 2 }[a.type] || 2;
  s += imp; if (imp >= 8) why.push(`${TYPES[a.type].toLowerCase()} counts a lot`);
  if (a.priority === 3) { s += 12; why.push('you marked it high priority'); } else if (a.priority === 1) s -= 6;
  const mins = Number(a.estMins) || DEF_MINS[a.type] || 30;
  if (mins >= 90 && d >= 0 && d <= 4) { s += 10; why.push(`needs ~${fmtMins(mins)}, start early`); }
  const ex = S.exams.find((e) => e.classId === a.classId && e.date >= t && daysBetween(t, e.date) <= 5);
  if (ex) { s += 6; why.push(`${clsName(a.classId)} exam ${relDayL(ex.date)}`); }
  const g = a.classId ? classGrade(a.classId) : null, c = cls(a.classId);
  if (g?.pct != null && c?.goal && g.pct < c.goal) { s += 6; why.push(`${c.name} is under your ${c.goal}% goal`); }
  if (a.status === 'in_progress') { s += 3; why.push('already started'); }
  if (typeof remainingMins === 'function' && d >= 0) { const left = remainingMins(a); if (left > (d + 1) * workCap() * 0.6) { s += 8; why.push(`~${fmtMins(left)} left, tight on time`); } }
  return { score: Math.round(s), why };
}
const ranked = () => openAssignments().map((a) => ({ a, ...priorityOf(a) })).sort((x, y) => y.score - x.score);

// ===================== exam preparation scheduler =====================
/** Builds study sessions from tomorrow (or today if early) to the day before the exam, around assignment workload. */
function buildExamPlan(exam, opts = {}) {
  const t = today(), start = opts.from || t, last = addDays(exam.date, -1);
  const topics = (exam.topics || []).length ? exam.topics : [{ id: 'general', name: 'Review all material', confidence: 2 }];
  const days = []; for (let d = start; d <= last; d = addDays(d, 1)) days.push(d);
  if (!days.length) return [];
  const base = Number(S.settings.dailyStudyMins) || 60;
  // Time available each day: the daily study budget minus homework due the next day, minus other exams' sessions already planned.
  const avail = days.map((d) => {
    const hw = workloadOn(addDays(d, 1)) * 0.5;
    const other = sum(S.exams.filter((e) => e.id !== exam.id).flatMap((e) => (e.plan || []).filter((p) => p.date === d && !p.done)).map((p) => p.mins));
    return Math.max(20, Math.round((base - hw - other) / 5) * 5);
  });
  const need = topics.map((tp) => ({ tp, w: 6 - clamp(Number(tp.confidence) || 3, 1, 5) }));
  const totalW = sum(need.map((x) => x.w)) || 1;
  const plan = [];
  // Last day before the exam: a full review / practice test.
  const reviewDay = days.length > 1 ? days.pop() : null, reviewAvail = reviewDay ? avail.pop() : 0;
  const totalMins = sum(avail);
  // Each topic gets time in proportion to how unsure you are; spaced across the days (interleaved).
  const queue = [];
  for (const x of need) { let m = Math.max(25, Math.round((totalMins * x.w) / totalW / 5) * 5); while (m > 0) { const chunk = Math.min(45, m); queue.push({ tp: x.tp, mins: chunk }); m -= chunk; } }
  queue.sort((a, b) => (6 - (b.tp.confidence || 3)) - (6 - (a.tp.confidence || 3)));
  let di = 0; const left = [...avail];
  for (const q of queue) {
    let tries = 0; while (left[di] < 20 && tries < days.length) { di = (di + 1) % days.length; tries++; }
    if (tries >= days.length) break;
    const m = Math.min(q.mins, left[di]);
    const ex = plan.find((p) => p.date === days[di] && p.topicIds.length === 1 && p.topicIds[0] === q.tp.id);
    if (ex) ex.mins += m; else plan.push({ id: uid('p'), date: days[di], topicIds: [q.tp.id], label: q.tp.name, mins: m, kind: 'study', done: false });
    left[di] -= m; di = (di + 1) % days.length;
  }
  if (reviewDay) plan.push({ id: uid('p'), date: reviewDay, topicIds: topics.map((x) => x.id), label: 'Full review + practice test', mins: Math.max(30, Math.min(90, reviewAvail)), kind: 'review', done: false });
  return plan.sort((a, b) => a.date.localeCompare(b.date));
}
/** Missed sessions (past and not done) are spread over the remaining days. Never touches done sessions. */
function rebalancePlan(exam) {
  const t = today(), missed = (exam.plan || []).filter((p) => p.date < t && !p.done);
  if (!missed.length) return 0;
  const future = [...new Set((exam.plan || []).filter((p) => p.date >= t).map((p) => p.date))];
  const lastDay = addDays(exam.date, -1);
  for (let d = t; d <= lastDay; d = addDays(d, 1)) if (!future.includes(d)) future.push(d);
  future.sort();
  if (!future.length) return 0;
  missed.forEach((p, i) => { p.date = future[i % future.length]; p.moved = true; });
  exam.plan.sort((a, b) => a.date.localeCompare(b.date));
  return missed.length;
}
function readiness(exam) {
  // 50% topic confidence, 30% plan sessions done (of those due by today), 20% best practice score for the class's decks.
  const tps = exam.topics || [];
  const conf = tps.length ? avg(tps.map((x) => ((Number(x.confidence) || 1) - 1) / 4)) : null;
  const due = (exam.plan || []).filter((p) => p.date < today() || (p.date === today() && p.done)), done = due.filter((p) => p.done).length;
  const planPart = (exam.plan || []).length ? (due.length ? done / due.length : 1) : null;
  const rs = S.results.filter((r) => r.classId === exam.classId && r.at > Date.now() - 30 * 864e5);
  const quiz = rs.length ? Math.max(...rs.map((r) => r.correct / r.total)) : null;
  const parts = [[conf, 0.5], [planPart, 0.3], [quiz, 0.2]].filter(([v]) => v != null);
  if (!parts.length) return null;
  return Math.round((sum(parts.map(([v, w]) => v * w)) / sum(parts.map(([, w]) => w))) * 100);
}

// ===================== study sessions =====================
function studyMinsOn(date) { return sum(S.sessions.filter((s) => isoOf(new Date(s.start)) === date).map((s) => s.mins)); }
function studyStreak() { let n = 0, d = today(); if (!studyMinsOn(d)) d = addDays(d, -1); while (studyMinsOn(d) > 0 && n < 999) { n++; d = addDays(d, -1); } return n; }

// ===================== flashcards: spaced repetition (SM-2 style) =====================
function reviewCard(card, q) { // q: 0 again, 1 hard, 2 good, 3 easy
  card.ease = card.ease || 2.5; card.reps = card.reps || 0; card.interval = card.interval || 0;
  if (q === 0) { card.reps = 0; card.interval = 0; card.lapses = (card.lapses || 0) + 1; card.ease = Math.max(1.3, card.ease - 0.2); }
  else {
    card.reps++;
    card.interval = card.reps === 1 ? (q === 3 ? 3 : 1) : card.reps === 2 ? (q === 1 ? 3 : 6) : Math.round(card.interval * (q === 1 ? 1.2 : card.ease * (q === 3 ? 1.3 : 1)));
    card.ease = Math.max(1.3, card.ease + (q === 3 ? 0.15 : q === 1 ? -0.15 : 0));
  }
  card.due = addDays(today(), card.interval); card.last = today(); card.known = q >= 2;
}
const cardsDue = (deckId = null) => S.cards.filter((c) => (!deckId || c.deckId === deckId) && (!c.due || c.due <= today()));
const deckMastery = (deckId) => { const cs = S.cards.filter((c) => c.deckId === deckId); return cs.length ? cs.filter((c) => (c.interval || 0) >= 6).length / cs.length : 0; };
