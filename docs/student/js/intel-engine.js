'use strict';
// ===================== Academic Intelligence engine =====================
// Every number here is computed from records already in Student Lens. Functions return the inputs they used so the UI
// can explain them. "Estimate" values are always labelled as such in the UI and never stored as grades.
const low = (s) => String(s || '').trim().toLowerCase();
const r5 = (m) => Math.round(m / 5) * 5;

// ---------- topics (one shared list per class; exam topics feed into it) ----------
function ensureTopics() {
  let ch = false;
  for (const e of S.exams) for (const tp of e.topics || []) {
    if (!tp.name || !e.classId) continue;
    if (!S.topics.some((t) => t.classId === e.classId && low(t.name) === low(tp.name))) { S.topics.push({ id: uid('tp'), classId: e.classId, name: tp.name, unit: '', createdAt: Date.now(), from: 'exam', ...(e.demo ? { demo: true } : {}) }); ch = true; }
  }
  if (ch) save('topics');
}
const topicsOf = (cid) => S.topics.filter((t) => t.classId === cid);
function topicCards(t) { const dk = new Set(S.decks.filter((d) => d.topicId === t.id).map((d) => d.id)); return S.cards.filter((c) => c.topicId === t.id || (!c.topicId && dk.has(c.deckId))); }
const sessMatch = (s, t) => s.topicId === t.id || (s.classId === t.classId && !!s.topic && low(s.topic).includes(low(t.name)));
function topicByName(cid, name) { return S.topics.find((t) => t.classId === cid && low(t.name) === low(name)); }
/** Exam confidence for a topic name: the rating on the nearest upcoming exam (or the most recent past one). Self-reported. */
function topicConfidence(t) {
  const ex = S.exams.filter((e) => e.classId === t.classId && (e.topics || []).some((x) => low(x.name) === low(t.name)));
  if (!ex.length) return null;
  const up = ex.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date)), e = up[0] || ex.sort((a, b) => b.date.localeCompare(a.date))[0];
  const c = (e.topics.find((x) => low(x.name) === low(t.name)) || {}).confidence; return c ? (c - 1) / 4 : null;
}
const MASTERY = { not_started: ['Not started', 'var(--dim)'], learning: ['Learning', 'var(--accent)'], review: ['Needs review', 'var(--warn)'], mastered: ['Mastered', 'var(--good)'] };
/** Topic mastery from activity: quiz answers on the topic's cards, flashcard intervals, study sessions, and (lightly) your confidence rating. */
function topicMastery(t) {
  const cards = topicCards(t), ids = new Set(cards.map((c) => c.id)), reviewed = cards.filter((c) => c.reps || c.lapses);
  const sess = S.sessions.filter((s) => sessMatch(s, t)), mins = sum(sess.map((s) => s.mins));
  const ans = []; let attempts = 0, lastQuiz = 0; const quizSeries = [];
  for (const r of [...S.results].sort((a, b) => a.at - b.at)) { const its = (r.cardResults || []).filter((x) => ids.has(x.id)); if (!its.length) continue; attempts++; ans.push(...its); lastQuiz = Math.max(lastQuiz, r.at); quizSeries.push({ at: r.at, acc: sum(its.map((x) => x.s)) / its.length }); }
  const quizAcc = ans.length ? sum(ans.map((x) => x.s)) / ans.length : null;
  const recentAcc = quizSeries.length ? avg(quizSeries.slice(-3).map((q) => q.acc)) : null;
  const strength = (c) => (c.known === false ? 0 : Math.min(1, (c.interval || 0) / 21) * (c.due && c.due < today() ? 0.6 : 1));
  const cardStr = reviewed.length ? avg(reviewed.map(strength)) : null;
  const conf = topicConfidence(t);
  const stamps = [...sess.map((s) => s.start), ...reviewed.filter((c) => c.last).map((c) => parseIso(c.last).getTime()), lastQuiz].filter(Boolean);
  const lastStudy = stamps.length ? Math.max(...stamps) : null, daysSince = lastStudy ? daysBetween(isoOf(new Date(lastStudy)), today()) : null;
  const active = sess.length > 0 || reviewed.length > 0 || attempts > 0;
  const practice = active ? Math.min(1, (sess.length + attempts + reviewed.length / 5) / 4) * (daysSince <= 7 ? 1 : daysSince <= 21 ? 0.7 : 0.4) : null;
  const parts = [{ k: 'Quiz accuracy', v: recentAcc, w: 40, src: `${ans.length} answer${ans.length === 1 ? '' : 's'} in ${attempts} quiz${attempts === 1 ? '' : 'zes'}${quizSeries.length > 3 ? ' (last 3 count)' : ''}` },
    { k: 'Flashcard retention', v: cardStr, w: 35, src: `${reviewed.length} of ${cards.length} card${cards.length === 1 ? '' : 's'} reviewed; strength = review interval / 21 days` },
    { k: 'Confidence (self-rated)', v: active ? conf : null, w: 15, src: conf == null ? 'no exam rating' : 'from the exam topic rating; only counts once you have activity' },
    { k: 'Practice & recency', v: practice, w: 10, src: `${sess.length} session${sess.length === 1 ? '' : 's'}${daysSince != null ? `, last ${daysSince === 0 ? 'today' : daysSince + ' days ago'}` : ''}` }];
  const used = parts.filter((p) => p.v != null), W = sum(used.map((p) => p.w));
  const score = W ? Math.round((sum(used.map((p) => p.v * p.w)) / W) * 100) : null;
  const measured = recentAcc != null || cardStr != null;
  let status = 'learning';
  if (!active) status = 'not_started';
  else if (score >= 85 && measured && daysSince <= 21 && (recentAcc == null || recentAcc >= 0.8) && (cardStr == null || cardStr >= 0.6)) status = 'mastered';
  else if (score < 60 || daysSince > 14 || (recentAcc != null && recentAcc < 0.7)) status = 'review';
  return { t, score, status, quizAcc, recentAcc, attempts, answers: ans.length, quizSeries, cardStr, cards: cards.length, reviewed: reviewed.length, due: cards.filter((c) => !c.due || c.due <= today()).length, sessions: sess.length, mins, lastStudy, daysSince, conf, parts, measured };
}

// ---------- assignment intelligence ----------
/** Your actual/estimated time ratio, only when 3+ assignments have both numbers. */
function estRatio() { const xs = S.assignments.filter((a) => Number(a.estMins) > 0 && Number(a.actualMins) > 0); if (xs.length < 3) return { r: 1, n: xs.length, measured: false }; return { r: clamp(sum(xs.map((a) => a.actualMins)) / sum(xs.map((a) => a.estMins)), 0.5, 2.5), n: xs.length, measured: true }; }
const baseMins = (a) => Number(a.estMins) || DEF_MINS[a.type] || 30;
function remainingMins(a) {
  if (isDone(a)) return 0;
  const R = estRatio().r, steps = a.steps || [];
  if (steps.length) { const tot = sum(steps.map((s) => Number(s.mins) || 0)); if (tot) return Math.round(sum(steps.filter((s) => !s.done).map((s) => Number(s.mins) || 0)) * R); return Math.round(baseMins(a) * R * (steps.filter((s) => !s.done).length / steps.length)); }
  const full = baseMins(a) * R; return Math.round(a.status === 'in_progress' && a.actualMins ? Math.max(full * 0.15, full - a.actualMins) : full);
}
const DIFF = ['', 'Easy', 'Medium', 'Hard'];
function difficultyOf(a) {
  if (a.difficulty) return { level: +a.difficulty, label: DIFF[a.difficulty], src: 'you set it' };
  const tw = { test: 3, project: 3, essay: 2.5, lab: 2, quiz: 2, homework: 1, reading: 1, other: 1.5 }[a.type] || 1.5;
  const m = baseMins(a), catW = cls(a.classId)?.categories?.find((k) => k.id === a.categoryId)?.weight || 0;
  const s = tw + (m >= 120 ? 1 : m >= 60 ? 0.5 : 0) + (catW >= 30 ? 0.5 : 0);
  const level = s >= 3 ? 3 : s >= 2 ? 2 : 1;
  return { level, label: DIFF[level], src: `estimated from type (${TYPES[a.type] || 'Other'}), ~${fmtMins(m)}${catW ? `, ${catW}% category` : ''}` };
}
const workCap = () => Number(S.settings.dailyWorkMins) || 120;
/** Can the remaining work fit before the deadline at your daily work capacity, after earlier-due work? */
function deadlineRisk(a) {
  if (isDone(a) || !a.due) return null;
  const t = today(), need = remainingMins(a); if (a.due < t) return { level: 'overdue', need };
  const earlier = sum(openAssignments().filter((x) => x.id !== a.id && x.due && x.due >= t && (x.due < a.due || (x.due === a.due && priorityOf(x).score > priorityOf(a).score))).map(remainingMins));
  const cap = (daysBetween(t, a.due) + 1) * workCap() - earlier;
  return { level: need > cap ? 'high' : need > cap * 0.7 ? 'tight' : 'ok', need, cap: Math.max(0, cap) };
}
const MAJOR = new Set(['test', 'project', 'essay']);
function majorDeadlines(from = today(), days = 28) {
  const to = addDays(from, days);
  return [...openAssignments().filter((a) => MAJOR.has(a.type) && a.due >= from && a.due <= to).map((a) => ({ date: a.due, title: a.title, classId: a.classId, kind: TYPES[a.type], id: a.id, k: 'a' })),
    ...S.exams.filter((e) => e.date >= from && e.date <= to && e.score == null).map((e) => ({ date: e.date, title: e.title, classId: e.classId, kind: 'Exam', id: e.id, k: 'e' }))].sort((a, b) => a.date.localeCompare(b.date));
}
function deadlineClusters() {
  // Major deadlines chained together when each is within 3 days of the previous one.
  const m = majorDeadlines(), out = []; let cur = [];
  for (const x of m) { if (cur.length && daysBetween(cur[cur.length - 1].date, x.date) > 3) { if (cur.length >= 2) out.push(cur); cur = []; } cur.push(x); }
  if (cur.length >= 2) out.push(cur);
  return out.map((items) => ({ start: items[0].date, end: items[items.length - 1].date, items }));
}
/** Earliest-deadline-first spread of remaining work over the next N days at your daily work capacity. */
function balancePlan(days = 14) {
  const t = today(), cap = workCap(), alloc = Array.from({ length: days }, (_, i) => ({ date: addDays(t, i), items: [], mins: 0 }));
  const work = openAssignments().filter((a) => a.due && a.due <= addDays(t, days - 1)).map((a) => ({ a, left: remainingMins(a), due: a.due < t ? t : a.due })).sort((x, y) => x.due.localeCompare(y.due) || priorityOf(y.a).score - priorityOf(x.a).score);
  const late = [];
  for (const w of work) {
    for (const d of alloc) { if (w.left <= 0 || d.date > w.due) break; const room = cap - d.mins; if (room < 10) continue; const m = Math.min(room, w.left); d.items.push({ a: w.a, mins: m }); d.mins += m; w.left -= m; }
    if (w.left > 0) late.push({ a: w.a, short: w.left });
  }
  return { alloc, late, cap };
}
function weeklyLoad(weeks = 8) {
  const ws = weekStart(today());
  return Array.from({ length: weeks }, (_, i) => { const from = addDays(ws, i * 7), to = addDays(from, 6);
    const asg = sum(openAssignments().filter((a) => a.due >= from && a.due <= to).map(remainingMins));
    const prep = sum(S.exams.flatMap((e) => (e.plan || []).filter((p) => !p.done && p.date >= from && p.date <= to)).map((p) => p.mins));
    return { from, asg, prep, total: asg + prep, majors: majorDeadlines(from, 6).length }; });
}

// ---------- grade projection + simulation ----------
const CAT_RE = { test: /test|exam|assess/i, quiz: /quiz|check/i, homework: /home|hw|practice|class ?work/i, project: /project/i, essay: /essay|writ|paper/i, lab: /lab/i, reading: /read/i };
function catFor(c, a) { if (a.categoryId && c.categories?.some((k) => k.id === a.categoryId)) return a.categoryId; return c.categories?.find((k) => CAT_RE[a.type]?.test(k.name))?.id || ''; }
/** Ungraded work still to come in a class (assignments without a score, exams without a score). */
function remainingItems(cid) {
  const c = cls(cid); if (!c) return [];
  const pts = c.gradingMode === 'points' || !(c.categories || []).length;
  const a = S.assignments.filter((x) => x.classId === cid && !isGraded(x)).map((x) => ({ id: x.id, title: x.title, kind: TYPES[x.type] || 'Assignment', due: x.due, cat: pts ? '' : catFor(c, x), max: x.max > 0 ? +x.max : 100, assumedMax: !(x.max > 0), late: effStatus(x) === 'overdue' }));
  const e = S.exams.filter((x) => x.classId === cid && (x.score == null || x.score === '')).map((x) => ({ id: x.id, title: x.title, kind: 'Exam', due: x.date, cat: pts ? '' : x.categoryId || catFor(c, { type: 'test' }), max: +x.max || 100, assumedMax: !(x.max > 0), exam: true }));
  return [...a, ...e].map((x) => ({ ...x, counted: pts || !!x.cat })).sort((p, q) => (p.due || '9').localeCompare(q.due || '9'));
}
function gradeWith(cid, items, pctOf) { return classGrade(cid, items.filter((x) => x.counted).map((x) => ({ id: 'sim' + x.id, cat: x.cat, score: (x.max * pctOf(x)) / 100, max: x.max, date: today() }))).pct; }
/** Category averages (and lowest score) from graded work, used for the expected and low scenarios. */
function catStats(cid) {
  const items = gradedItems(cid), by = {};
  for (const x of items) (by[x.cat || '_'] ||= []).push((x.score / x.max) * 100);
  const all = items.map((x) => (x.score / x.max) * 100);
  return { n: items.length, recent: (cat) => { const xs = by[cat]?.length ? by[cat] : all; return avg(xs.slice(-3)); }, avg: (cat) => (by[cat]?.length ? avg(by[cat]) : avg(all)), min: (cat) => (by[cat]?.length ? Math.min(...by[cat]) : Math.min(...all)), allAvg: avg(all) };
}
function scenarios(cid, items = remainingItems(cid)) {
  const cur = classGrade(cid).pct, st = catStats(cid), counted = items.filter((x) => x.counted);
  const best = counted.length ? gradeWith(cid, items, () => 100) : cur, zero = counted.length ? gradeWith(cid, items, () => 0) : cur;
  const expected = st.n >= 3 && counted.length ? gradeWith(cid, items, (x) => st.recent(x.cat)) : st.n >= 3 ? cur : null;
  const lowCase = st.n >= 1 && counted.length ? gradeWith(cid, items, (x) => st.min(x.cat)) : null;
  return { cur, best, zero, expected, low: lowCase, n: st.n, counted: counted.length, items };
}
/** Uniform score (same % on every remaining item) needed to finish at target. */
function requiredUniform(cid, target, items = remainingItems(cid)) {
  if (!items.some((x) => x.counted)) return { status: 'none' };
  const f = (p) => gradeWith(cid, items, () => p);
  if (f(100) < target - 1e-9) return { status: 'impossible', best: f(100) };
  if (f(0) >= target) return { status: 'secured', p: 0 };
  let lo = 0, hi = 100; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) >= target) hi = m; else lo = m; }
  return { status: 'needed', p: hi };
}
function realism(cid, p) { const st = catStats(cid); if (p == null) return null; if (st.n < 3) return { k: 'unknown', label: 'Not enough grades to judge' }; const best = Math.max(st.allAvg, ...gradedItems(cid).slice(-5).map((x) => (x.score / x.max) * 100)); return p <= st.allAvg ? { k: 'good', label: `At or below your ${round(st.allAvg, 1)}% average` } : p <= best + 2 ? { k: 'warn', label: `Above your average (${round(st.allAvg, 1)}%) but you’ve scored this recently` } : p <= 100 ? { k: 'bad', label: `Higher than you’ve scored lately (best recent ${round(best, 1)}%)` } : null; }
/** Expected class grade (estimate): remaining work at your recent form (average of your last 3 scores in each category). Needs 3+ graded items. */
function projectedGrade(cid) { const s = scenarios(cid); return s.expected; }
function gpaFromPcts(map) {
  let u = 0, w = 0, cr = 0;
  for (const [id, pct] of Object.entries(map)) { const c = cls(id); if (!c || pct == null) continue; const credits = Number(c.credits) || 1, p = pointsOf(letterOf(pct)), b = p > 0 ? (c.level === 'ap' ? S.settings.apBonus : c.level === 'honors' ? S.settings.honorsBonus : 0) : 0; u += p * credits; w += (p + b) * credits; cr += credits; }
  return cr ? { unweighted: u / cr, weighted: w / cr, credits: cr } : null;
}
function projectedGPA() { const m = {}; let n = 0; for (const c of S.classes) { const p = projectedGrade(c.id); if (p != null) { m[c.id] = p; n++; } else m[c.id] = classGrade(c.id).pct; } return n ? { ...gpaFromPcts(m), basis: n } : null; }
/** Grade slope in points per week (least squares over the last 45 days of grade history). Needs 3+ points. */
function gradeTrend(cid) {
  const h = gradeHistory(cid).filter((x) => x.date >= addDays(today(), -45) && x.pct != null); if (h.length < 3) return null;
  const xs = h.map((x) => daysBetween(h[0].date, x.date)), ys = h.map((x) => x.pct), mx = avg(xs), my = avg(ys);
  const den = sum(xs.map((x) => (x - mx) ** 2)); if (!den) return null;
  return { perWeek: (sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / den) * 7, n: h.length, from: h[0].pct, to: h[h.length - 1].pct };
}

// ---------- performance score ----------
const sessDay = (s) => isoOf(new Date(s.start));
function onTimeStats(from = '0000', to = '9999') { const fin = S.assignments.filter((a) => isDone(a) && a.due && a.completedAt && a.due >= from && a.due <= to); const ot = fin.filter((a) => isoOf(new Date(a.completedAt)) <= a.due).length; return { n: fin.length, ot, rate: fin.length ? ot / fin.length : null }; }
function completionStats(from, to) { const due = S.assignments.filter((a) => a.due && a.due >= from && a.due <= to && a.due < today()); return { n: due.length, done: due.filter(isDone).length, rate: due.length ? due.filter(isDone).length / due.length : null }; }
function consistency(days = 28, end = today()) { const ds = Array.from({ length: days }, (_, i) => addDays(end, -i)); const n = ds.filter((d) => studyMinsOn(d) >= 10).length; return { n, days, rate: n / days }; }
function quizStats(from, to) { const rs = S.results.filter((r) => { const d = isoOf(new Date(r.at)); return d >= from && d <= to; }); return { n: rs.length, acc: rs.length ? sum(rs.map((r) => r.correct)) / sum(rs.map((r) => r.total)) : null }; }
function performanceScore() {
  const t = today(), comps = [];
  const grades = S.classes.map((c) => classGrade(c.id).pct).filter((x) => x != null);
  if (grades.length) comps.push({ k: 'Grades', w: 35, v: clamp((avg(grades) - 60) / 40, 0, 1), how: `Average class grade ${round(avg(grades), 1)}% across ${grades.length} class${grades.length === 1 ? '' : 'es'}; 60% scores 0, 100% scores full.` });
  const cs = completionStats(addDays(t, -30), addDays(t, -1)); if (cs.n) comps.push({ k: 'Completion', w: 15, v: cs.rate, how: `${cs.done} of ${cs.n} assignments due in the last 30 days are done.` });
  const ot = onTimeStats(addDays(t, -60), t); if (ot.n) comps.push({ k: 'On time', w: 15, v: ot.rate, how: `${ot.ot} of ${ot.n} assignments finished in the last 60 days were done by the due date.` });
  if (S.sessions.length) { const c = consistency(); comps.push({ k: 'Consistency', w: 15, v: Math.min(1, c.n / 20), how: `Studied 10+ minutes on ${c.n} of the last 28 days; 20 days (about 5 a week) scores full.` }); }
  const ms = S.topics.map(topicMastery).filter((m) => m.score != null); if (ms.length) comps.push({ k: 'Mastery', w: 10, v: avg(ms.map((m) => m.score)) / 100, how: `Average mastery of ${ms.length} topic${ms.length === 1 ? '' : 's'} with activity.` });
  const q = quizStats(addDays(t, -30), t); if (q.n) comps.push({ k: 'Practice', w: 10, v: q.acc, how: `${Math.round(q.acc * 100)}% correct across ${q.n} quiz/test${q.n === 1 ? '' : 's'} in the last 30 days.` });
  const W = sum(comps.map((c) => c.w));
  const score = W ? Math.round((sum(comps.map((c) => c.v * c.w)) / W) * 100) : null;
  return { score, comps, coverage: W / 100, label: score == null ? 'No data' : score >= 85 ? 'Excellent' : score >= 72 ? 'Solid' : score >= 58 ? 'Mixed' : 'At risk' };
}

// ---------- risk detection ----------
const LVL = { high: [3, 'High', 'var(--bad)'], medium: [2, 'Medium', 'var(--warn)'], low: [1, 'Low', 'var(--accent)'] };
function risks() {
  const t = today(), out = [], add = (r) => out.push(r);
  // 1. declining grades
  for (const c of activeClasses()) {
    const tr = gradeTrend(c.id), h = gradeHistory(c.id), g = classGrade(c.id).pct; if (g == null) continue;
    const past = h.filter((x) => x.date <= addDays(t, -21)).pop(), drop = past ? past.pct - g : null;
    if ((drop != null && drop >= 2) || (tr && tr.perWeek <= -1)) {
      const big = (drop ?? 0) >= 5 || (tr && tr.perWeek <= -2) || (c.goal && g < c.goal);
      add({ id: 'decline:' + c.id, level: big ? 'high' : 'medium', type: 'Declining grade', classId: c.id, title: `${c.name} is trending down`, trigger: drop != null && drop >= 2 ? `Grade fell from ${round(past.pct, 1)}% (${fmtDate(past.date)}) to ${round(g, 1)}% now (−${round(drop, 1)} pts).` : `Grade trend is ${round(tr.perWeek, 1)} points per week over the last ${tr.n} grade changes.`, why: c.goal ? `${round(g, 1)}% vs your ${c.goal}% goal. Small slides compound as more work gets graded.` : 'Small slides compound as more work gets graded.', action: (() => { const recent = gradedItems(c.id).slice(-4).sort((a, b) => a.score / a.max - b.score / b.max)[0]; return recent ? `Review "${recent.title}" (${round((recent.score / recent.max) * 100, 1)}%), your lowest recent score, and fix the mistakes before the next assessment.` : 'Review your most recent graded work.'; })(), go: ['classes', c.id, 'analytics'] });
    }
  }
  // 2/3. overdue + missing work
  const od = S.assignments.filter((a) => effStatus(a) === 'overdue');
  const byCls = {}; od.forEach((a) => (byCls[a.classId] ||= []).push(a));
  for (const [cid, as] of Object.entries(byCls)) {
    const c = cls(cid), due30 = S.assignments.filter((a) => a.classId === cid && a.due >= addDays(t, -30) && a.due < t), missRate = due30.length ? as.filter((a) => a.due >= addDays(t, -30)).length / due30.length : 0;
    if (as.length >= 2 || missRate >= 0.2) add({ id: 'missing:' + cid, level: as.length >= 3 || missRate >= 0.3 ? 'high' : 'medium', type: 'Missing work', classId: cid, title: `${as.length} missing in ${c?.name || 'No class'}`, trigger: `${as.length} overdue: ${as.slice(0, 3).map((a) => a.title).join(', ')}${due30.length ? ` (${Math.round(missRate * 100)}% of work due in the last 30 days)` : ''}.`, why: 'Missing work usually counts as zero until it’s turned in, and late penalties often grow.', action: `Turn in "${[...as].sort((a, b) => remainingMins(a) - remainingMins(b))[0].title}" first (smallest, ~${fmtMins(remainingMins([...as].sort((a, b) => remainingMins(a) - remainingMins(b))[0]))}), then ask about late credit for the rest.`, go: ['assignments', 'overdue'] });
    else for (const a of as) { const days = -daysBetween(t, a.due); add({ id: 'overdue:' + a.id, level: MAJOR.has(a.type) || days >= 3 ? 'high' : 'medium', type: 'Overdue', classId: a.classId, aid: a.id, title: `"${a.title}" is overdue`, trigger: `Due ${fmtDate(a.due)} (${days} day${days === 1 ? '' : 's'} ago), status ${STATUS[a.status === 'overdue' ? 'overdue' : a.status]?.[0] || 'Not started'}.`, why: `${TYPES[a.type]} in ${clsName(a.classId)}${cls(a.classId)?.categories?.find((k) => k.id === a.categoryId) ? `, ${cls(a.classId).categories.find((k) => k.id === a.categoryId).weight}% category` : ''}.`, action: `Finish it today (~${fmtMins(remainingMins(a))} left) and submit, even for partial credit.`, go: ['assignments', 'overdue'] }); }
  }
  // 4. deadline risk on upcoming work
  for (const a of openAssignments().filter((x) => x.due >= t && x.due <= addDays(t, 7))) {
    const dr = deadlineRisk(a); if (!dr || dr.level === 'ok') continue; const notStarted = a.status !== 'in_progress' && !(a.steps || []).some((s) => s.done);
    if (dr.level === 'high' || (notStarted && daysBetween(t, a.due) <= 2 && dr.need >= 60)) add({ id: 'deadline:' + a.id, level: dr.level === 'high' ? 'high' : 'medium', type: 'Deadline', classId: a.classId, aid: a.id, title: `"${a.title}" may not fit before ${relDay(a.due)}`, trigger: `~${fmtMins(dr.need)} of work left${notStarted ? ', not started' : ''}; about ${fmtMins(dr.cap)} of work time before it’s due after earlier deadlines (at ${fmtMins(workCap())}/day).`, why: dr.level === 'high' ? 'At your daily capacity this won’t be finished on time without extra hours.' : 'Little slack left; one busy evening and it slips.', action: `Start today: block ${fmtMins(Math.min(dr.need, 60))} ${a.steps?.find((s) => !s.done) ? `for "${a.steps.find((s) => !s.done).title}"` : 'on it'}.`, go: ['intel', 'workload'] });
  }
  // 5. exams with weak preparation
  for (const e of S.exams.filter((x) => x.date >= t && daysBetween(t, x.date) <= 10 && x.score == null)) {
    const d = daysBetween(t, e.date), rd = readiness(e), plan = e.plan || [], left = sum(plan.filter((p) => !p.done).map((p) => p.mins));
    const weak = (e.topics || []).map((tp) => topicByName(e.classId, tp.name)).filter(Boolean).map(topicMastery).filter((m) => m.status === 'not_started' || m.status === 'review');
    if (rd == null || rd < 65 || !plan.length || weak.length) {
      add({ id: 'exam:' + e.id, level: d <= 3 && (rd == null || rd < 65 || weak.length) ? 'high' : 'medium', type: 'Exam prep', classId: e.classId, title: `${e.title} in ${d} day${d === 1 ? '' : 's'}`, trigger: [rd == null ? 'No readiness data yet' : `Readiness ${rd}%`, plan.length ? `${plan.filter((p) => p.done).length}/${plan.length} plan sessions done (${fmtMins(left)} left)` : 'no study plan', weak.length ? `${weak.length} topic${weak.length === 1 ? '' : 's'} not started or needing review: ${weak.slice(0, 3).map((m) => m.t.name).join(', ')}` : ''].filter(Boolean).join(' · ') + '.', why: `Counts in ${cls(e.classId)?.categories?.find((k) => k.id === e.categoryId)?.name || 'your grade'}${cls(e.classId)?.categories?.find((k) => k.id === e.categoryId) ? ` (${cls(e.classId).categories.find((k) => k.id === e.categoryId).weight}%)` : ''}.`, action: !plan.length ? 'Open the exam and generate a study plan.' : weak.length ? `Study ${weak[0].t.name} next (${MASTERY[weak[0].status][0].toLowerCase()}), then take a practice test.` : 'Finish today’s planned session and take a timed practice test.', go: ['exams', e.id] });
    }
  }
  // 6. weak quiz topics
  for (const m of S.topics.map(topicMastery).filter((m) => m.attempts >= 2 && m.recentAcc != null && m.recentAcc < 0.7)) add({ id: 'quiz:' + m.t.id, level: S.exams.some((e) => e.classId === m.t.classId && e.date >= t && daysBetween(t, e.date) <= 14 && (e.topics || []).some((x) => low(x.name) === low(m.t.name))) ? 'high' : 'medium', type: 'Weak topic', classId: m.t.classId, title: `${m.t.name}: ${Math.round(m.recentAcc * 100)}% on recent quizzes`, trigger: `${Math.round(m.recentAcc * 100)}% correct across the last ${Math.min(3, m.quizSeries.length)} quizzes that covered it (${m.answers} answers total).`, why: 'Repeated misses on the same topic mean it isn’t sticking yet.', action: `Review ${m.t.name} flashcards you missed (they’re due today), then quiz just that deck again.`, go: ['intel', 'mastery', m.t.classId] });
  // 7. classes getting too little study
  const s14 = S.sessions.filter((s) => sessDay(s) >= addDays(t, -14)), tot = sum(s14.map((s) => s.mins));
  for (const c of activeClasses()) {
    const g = classGrade(c.id).pct, m = sum(s14.filter((s) => s.classId === c.id).map((s) => s.mins)), share = tot ? m / tot : 0, fair = 1 / Math.max(1, activeClasses().length);
    const exam = S.exams.find((e) => e.classId === c.id && e.date >= t && daysBetween(t, e.date) <= 14);
    if (((c.goal && g != null && g < c.goal) || exam) && tot >= 60 && share < fair * 0.6) add({ id: 'study:' + c.id, level: exam && daysBetween(t, exam.date) <= 7 ? 'medium' : 'low', type: 'Study time', classId: c.id, title: `${c.name} is getting little study time`, trigger: `${fmtMins(m)} (${Math.round(share * 100)}%) of your ${fmtMins(tot)} logged in the last 14 days${exam ? `, with ${exam.title} ${relDayL(exam.date)}` : ''}.`, why: g != null && c.goal && g < c.goal ? `It’s ${round(c.goal - g, 1)} points under your ${c.goal}% goal.` : 'An exam is coming up.', action: `Add two ${fmtMins(30)} sessions for ${c.name} this week (the Study Director can schedule them).`, go: ['intel', 'director'] });
  }
  // 8. busy weeks + clustered deadlines
  const wl = weeklyLoad(6), nz = wl.map((w) => w.total).filter(Boolean).sort((a, b) => a - b), med = nz.length ? nz[Math.floor(nz.length / 2)] : 0;
  wl.forEach((w, i) => { if (w.total >= 240 && w.total > med * 1.5 && nz.length >= 2) add({ id: 'week:' + w.from, level: w.total > workCap() * 6 ? 'high' : 'medium', type: 'Busy week', title: `Heavy week of ${fmtDate(w.from)}`, trigger: `~${fmtMins(w.total)} of work and exam prep planned, vs a typical ${fmtMins(med)} week${w.majors ? `; ${w.majors} major deadline${w.majors === 1 ? '' : 's'}` : ''}.`, why: 'Crunch weeks are when work gets rushed or missed.', action: i === 0 ? 'Use the balanced plan in Workload to start the biggest items now.' : `Start the biggest item due that week ${daysBetween(t, w.from) > 7 ? 'next week' : 'this weekend'}.`, go: ['intel', 'workload'] }); });
  for (const cl of deadlineClusters()) add({ id: 'cluster:' + cl.start + cl.items.length, level: cl.items.length >= 3 ? 'high' : 'medium', type: 'Deadline cluster', title: `${cl.items.length} major deadlines ${fmtDate(cl.start)}–${fmtDate(cl.end)}`, trigger: cl.items.map((x) => `${x.title} (${clsName(x.classId)}, ${fmtDate(x.date)})`).join('; ') + '.', why: 'Major tests and projects within 3 days compete for the same prep time.', action: `Start ${cl.items.find((x) => x.k === 'a')?.title || 'prep for ' + cl.items[0].title} early so the last days are free for review.`, go: ['intel', 'workload'] });
  // 9. goals falling behind
  for (const g of S.goals.filter((g) => !g.archived)) { const p = goalProgress(g); if (p.onTrack === false) add({ id: 'goal:' + g.id, level: 'low', type: 'Goal', classId: g.classId, title: `Goal behind: ${goalTitle(g)}`, trigger: p.detail, why: 'Goals slip quietly unless you adjust.', action: p.next[0] || 'Open the goal for next steps.', go: ['intel', 'goals'] }); }
  return out.sort((a, b) => LVL[b.level][0] - LVL[a.level][0]);
}

// ---------- study director ----------
const METHODS = { recall: 'Active recall: flashcards, say the answer before flipping', practice: 'Practice questions, then study the explanations for misses', build: 'Make 5–10 flashcards from your notes, then self-quiz', spaced: 'Quick spaced review: 10-minute recall check', test: 'Timed practice test, then review every miss', work: 'Focused work session (phone away, 25-min blocks)', redo: 'Redo missed problems from recent graded work' };
function directorRecs() {
  const t = today(), C = [], add = (r) => { if (!C.some((x) => x.key === r.key || (r.topicId && x.topicId === r.topicId))) C.push(r); };
  const methodFor = (m) => (m.recentAcc != null && m.recentAcc < 0.7 ? 'practice' : m.due > 0 && m.cards ? 'recall' : !m.cards && !m.attempts ? 'build' : m.status === 'mastered' ? 'spaced' : 'recall');
  // exam plans for today
  for (const e of S.exams.filter((x) => x.date >= t)) for (const p of (e.plan || []).filter((p) => p.date <= t && !p.done)) {
    const tp = topicByName(e.classId, p.label), m = tp ? topicMastery(tp) : null;
    add({ key: 'plan:' + p.id, kind: 'exam-plan', classId: e.classId, topic: p.label, topicId: tp?.id, mins: p.mins, score: 92 - Math.min(20, daysBetween(t, e.date)) + (p.date < t ? 5 : 0), reason: `${p.date < t ? 'Missed session from ' : 'Today’s session in '}your ${e.title} plan (${relDayL(e.date)})${m?.score != null ? `; mastery ${m.score}%` : ''}.`, method: p.kind === 'review' ? 'test' : m ? methodFor(m) : 'recall', link: ['exams', e.id], planId: p.id, examId: e.id });
  }
  // weak topics for exams in the next 14 days
  for (const e of S.exams.filter((x) => x.date >= t && daysBetween(t, x.date) <= 14 && x.score == null)) {
    const d = Math.max(1, daysBetween(t, e.date));
    for (const tp of e.topics || []) {
      const top = topicByName(e.classId, tp.name); if (!top || C.some((x) => x.topicId === top.id)) continue;
      const m = topicMastery(top), need = m.score == null ? 0.75 : 1 - m.score / 100; if (m.status === 'mastered' && m.daysSince <= 5) continue;
      add({ key: 'topic:' + top.id, kind: 'topic', classId: e.classId, topic: top.name, topicId: top.id, mins: clamp(r5(20 + need * 40), 15, 60), score: need * 100 * (d <= 3 ? 1 : d <= 7 ? 0.8 : 0.55) + 10, reason: `${e.title} ${relDayL(e.date)}; ${m.score == null ? 'no study or quiz activity on this topic yet' : `mastery ${m.score}% (${MASTERY[m.status][0].toLowerCase()})`}${m.recentAcc != null ? `, ${Math.round(m.recentAcc * 100)}% on recent quizzes` : ''}${m.daysSince != null ? `, last studied ${m.daysSince === 0 ? 'today' : m.daysSince + ' days ago'}` : ''}.`, method: methodFor(m), link: ['intel', 'mastery', e.classId] });
    }
  }
  // weak quiz topics anywhere
  for (const m of S.topics.map(topicMastery).filter((m) => m.recentAcc != null && m.recentAcc < 0.7)) add({ key: 'topic:' + m.t.id, kind: 'topic', classId: m.t.classId, topic: m.t.name, topicId: m.t.id, mins: 25, score: 45 + (0.7 - m.recentAcc) * 60, reason: `${Math.round(m.recentAcc * 100)}% on recent quizzes covering ${m.t.name} (${m.answers} answers).`, method: 'practice', link: ['intel', 'mastery', m.t.classId] });
  // due flashcards by deck
  for (const dk of S.decks) { const due = cardsDue(dk.id).filter((c) => c.reps || c.lapses).length; if (due >= 5) add({ key: 'deck:' + dk.id, kind: 'deck', classId: dk.classId, topic: dk.name, deckId: dk.id, mins: clamp(r5(due * 0.5), 10, 30), score: 30 + Math.min(25, due), reason: `${due} reviewed card${due === 1 ? ' is' : 's are'} due; reviewing on time keeps intervals growing.`, method: 'recall', link: ['study', 'cards', dk.id] }); }
  // stale topics
  for (const m of S.topics.map(topicMastery).filter((m) => m.status !== 'not_started' && m.daysSince > 10)) { const c = cls(m.t.classId), g = classGrade(m.t.classId).pct; if (!(c?.goal && g != null && g < c.goal) && !S.exams.some((e) => e.classId === m.t.classId && e.date >= t && daysBetween(t, e.date) <= 21)) continue; add({ key: 'topic:' + m.t.id, kind: 'topic', classId: m.t.classId, topic: m.t.name, topicId: m.t.id, mins: 15, score: 28 + Math.min(15, m.daysSince / 2), reason: `Not studied in ${m.daysSince} days; spacing reviews out keeps it from fading.`, method: 'spaced', link: ['intel', 'mastery', m.t.classId] }); }
  // assignments due soon
  for (const { a, score, why } of ranked().filter((x) => x.a.due && daysBetween(t, x.a.due) <= 3).slice(0, 4)) { const left = remainingMins(a); if (left < 20) continue; const step = (a.steps || []).find((s) => !s.done); add({ key: 'asg:' + a.id, kind: 'assignment', classId: a.classId, topic: a.title, aid: a.id, mins: clamp(r5(Math.min(left, 60)), 20, 60), score: score / 1.6, reason: `${why.slice(0, 2).join(', ')}; ~${fmtMins(left)} left${step ? `. Next step: ${step.title}` : ''}.`, method: 'work', link: ['assignments'] }); }
  // under-goal classes with low study share
  const s14 = S.sessions.filter((s) => sessDay(s) >= addDays(t, -14)), tot = sum(s14.map((s) => s.mins));
  for (const c of activeClasses()) { const g = classGrade(c.id).pct; if (!(c.goal && g != null && g < c.goal)) continue; const m = sum(s14.filter((s) => s.classId === c.id).map((s) => s.mins)); if (tot && m / tot >= 1 / activeClasses().length) continue; add({ key: 'class:' + c.id, kind: 'class', classId: c.id, topic: `${c.name} review`, mins: 30, score: 38 + (c.goal - g), reason: `${round(g, 1)}% vs your ${c.goal}% goal, and only ${fmtMins(m)} studied for it in 14 days.`, method: 'redo', link: ['classes', c.id] }); }
  // apply decisions + completion from logged sessions
  const studiedToday = S.sessions.filter((s) => sessDay(s) === t);
  return C.map((r) => {
    const dec = S.recs.find((x) => x.key === r.key && x.date === t) || S.recs.find((x) => x.key === r.key && x.date > t && x.status === 'scheduled');
    const done = (r.planId && false) || studiedToday.some((s) => s.mins >= 10 && s.classId === r.classId && ((r.topicId && sessMatch(s, byId('topics', r.topicId) || {})) || (r.aid && s.aid === r.aid) || (r.deckId && low(s.topic).includes(low(r.topic)))));
    const o = { ...r, mins: dec?.mins || r.mins, method: dec?.method || r.method, status: done ? 'done' : dec?.status || 'open', dec, priority: r.score >= 70 ? 'High' : r.score >= 45 ? 'Medium' : 'Low' };
    return o;
  }).sort((a, b) => b.score - a.score);
}
/** First free slot on a date between your study hours, avoiding timed items on the planner. */
function freeSlot(date, mins) {
  const s0 = toMin(S.settings.studyStart || '16:00'), e0 = toMin(S.settings.studyEnd || '21:30');
  let from = s0; if (date === today()) { const n = new Date(); from = Math.max(s0, Math.ceil((n.getHours() * 60 + n.getMinutes() + 5) / 15) * 15); }
  const busy = itemsOn(date).filter((i) => i.s != null && i.e != null && !i.logged && i.k !== 'due').map((i) => [i.s, i.e]).sort((a, b) => a[0] - b[0]);
  let cur = from; for (const [a, b] of busy) { if (b <= cur) continue; if (a - cur >= mins) break; cur = Math.max(cur, b); }
  return cur + mins <= e0 ? cur : null;
}

// ---------- snapshots (for reports and mastery change over time) ----------
function takeSnapshot() {
  if (!S.classes.length) return;
  const g = gpaFor(), snap = { id: today(), date: today(), gpa: g?.unweighted ?? null, wgpa: g?.weighted ?? null, score: performanceScore().score, classes: Object.fromEntries(S.classes.map((c) => [c.id, classGrade(c.id).pct])), mastery: Object.fromEntries(S.topics.map((t) => { const m = topicMastery(t); return [t.id, [m.score, m.status]]; })) };
  const i = S.snapshots.findIndex((s) => s.id === snap.id); if (i >= 0 && JSON.stringify(S.snapshots[i]) === JSON.stringify({ ...S.snapshots[i], ...snap })) return; if (i >= 0) S.snapshots[i] = { ...S.snapshots[i], ...snap }; else S.snapshots.push(snap);
  S.snapshots = S.snapshots.sort((a, b) => a.date.localeCompare(b.date)).slice(-400); save('snapshots');
}
const snapshotOn = (d) => [...S.snapshots].filter((s) => s.date <= d).pop() || null;

// ---------- goals ----------
const GOAL_TYPES = { gpa: 'Reach a GPA', class_grade: 'Raise a class grade', on_time: 'Turn work in on time', study_hours: 'Study hours per week', master_topics: 'Master topics', quiz_accuracy: 'Improve quiz accuracy' };
function goalTitle(g) { return g.title || ({ gpa: `${g.weighted ? 'Weighted' : 'Unweighted'} GPA ${(+g.target).toFixed(2)}`, class_grade: `${clsName(g.classId)} to ${g.target}%`, on_time: `${g.target}% on time`, study_hours: `${g.target} h study / week`, master_topics: `Master ${(g.topicIds || []).length} topic${(g.topicIds || []).length === 1 ? '' : 's'}`, quiz_accuracy: `${g.target}% quiz accuracy${g.classId ? ' in ' + clsName(g.classId) : ''}` }[g.type]); }
function goalProgress(g) {
  const target = +g.target, start = g.start ?? null;
  const t = today(), since = isoOf(new Date(g.createdAt)), next = []; let cur = null, unit = '', series = [], detail = '', onTrack = null, fmt = (v) => round(v, 1);
  if (g.type === 'gpa') { const x = gpaFor(); cur = x ? (g.weighted ? x.weighted : x.unweighted) : null; fmt = (v) => v.toFixed(2); const ds = [...new Set(S.classes.flatMap((c) => gradedItems(c.id).map((i) => i.date)))].sort().slice(-16); series = ds.map((d) => { const y = gpaFor(undefined, d); return { label: fmtDate(d), y: y ? round(g.weighted ? y.weighted : y.unweighted, 2) : null }; });
    const opp = S.classes.map((c) => { const p = classGrade(c.id).pct; if (p == null) return null; const sc = S.settings.scale, i = sc.findIndex(([l]) => l === letterOf(p)); return i > 0 ? { c, gap: sc[i - 1][1] - p, to: sc[i - 1][0] } : null; }).filter(Boolean).sort((a, b) => a.gap - b.gap)[0];
    if (opp && cur != null && cur < g.target) next.push(`${opp.c.name} is ${round(opp.gap, 2)} points from ${opp.to}: the cheapest GPA gain right now.`); }
  if (g.type === 'class_grade') { cur = classGrade(g.classId)?.pct ?? null; unit = '%'; series = gradeHistory(g.classId).slice(-16).map((h) => ({ label: fmtDate(h.date), y: round(h.pct, 2) })); const ru = requiredUniform(g.classId, +g.target); if (cur != null && cur < g.target) next.push(ru.status === 'needed' ? `Average ${round(ru.p, 1)}% on the remaining ${remainingItems(g.classId).filter((x) => x.counted).length} graded item${remainingItems(g.classId).filter((x) => x.counted).length === 1 ? '' : 's'} to get there.` : ru.status === 'impossible' ? `Not reachable with the work entered so far (best case ${round(ru.best, 2)}%). Ask about extra credit or retakes.` : 'Add upcoming assignments and exams so the simulator can calculate what you need.'); }
  if (g.type === 'on_time') { const s = onTimeStats(since, t); cur = s.rate == null ? null : s.rate * 100; unit = '%'; detail = s.n ? `${s.ot} of ${s.n} finished on time since ${fmtDate(since)} (${Math.round(s.rate * 100)}%), target ${g.target}%.` : `No work finished since ${fmtDate(since)} yet.`; const wk = Array.from({ length: 8 }, (_, i) => addDays(weekStart(t), -7 * (7 - i))).filter((w) => addDays(w, 6) >= since); series = wk.map((w) => { const x = onTimeStats(since, addDays(w, 6)); return { label: fmtDate(w), y: x.rate == null ? null : Math.round(x.rate * 100) }; }); const soon = ranked()[0]; if (soon) next.push(`Next up: "${soon.a.title}" due ${relDayL(soon.a.due)}.`); }
  if (g.type === 'study_hours') { const ws = weekStart(t), mins = sum(Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter((d) => d <= t).map(studyMinsOn)); cur = mins / 60; unit = ' h'; series = Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i))).map((w) => ({ label: fmtDate(w), y: round(sum(Array.from({ length: 7 }, (_, j) => studyMinsOn(addDays(w, j)))) / 60, 1) })); const left = Math.max(0, g.target * 60 - mins), daysLeft = 7 - ((dow(t) + 6) % 7); detail = `${fmtMins(mins)} so far this week`; if (left) { next.push(`${fmtMins(left)} to go: about ${fmtMins(Math.ceil(left / daysLeft / 5) * 5)} a day for the ${daysLeft} day${daysLeft === 1 ? '' : 's'} left this week.`); onTrack = mins >= (g.target * 60 * (7 - daysLeft)) / 7 * 0.8; } }
  if (g.type === 'master_topics') { const ms = (g.topicIds || []).map((id) => byId('topics', id)).filter(Boolean).map(topicMastery); cur = ms.filter((m) => m.status === 'mastered').length; unit = ` of ${ms.length}`; series = S.snapshots.slice(-16).map((s) => ({ label: fmtDate(s.date), y: (g.topicIds || []).filter((id) => s.mastery?.[id]?.[1] === 'mastered').length })); const nx = ms.filter((m) => m.status !== 'mastered').sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0]; if (nx) next.push(`Closest: ${nx.t.name} (${nx.score == null ? 'not started' : nx.score + '%'}). ${METHODS[nx.recentAcc != null && nx.recentAcc < 0.7 ? 'practice' : nx.cards ? 'recall' : 'build']}.`); }
  if (g.type === 'quiz_accuracy') { const rs = S.results.filter((r) => (!g.classId || r.classId === g.classId)).sort((a, b) => a.at - b.at), r30 = rs.filter((r) => r.at >= parseIso(addDays(t, -30)).getTime()); cur = r30.length ? (sum(r30.map((r) => r.correct)) / sum(r30.map((r) => r.total))) * 100 : null; unit = '%'; detail = cur == null ? 'No quizzes in the last 30 days.' : `Now ${round(cur, 1)}% over ${r30.length} quiz/test${r30.length === 1 ? '' : 's'} in the last 30 days (started at ${start == null ? '—' : round(start, 1) + '%'}), target ${g.target}%.`; series = rs.slice(-16).map((r) => ({ label: fmtDate(isoOf(new Date(r.at))), y: Math.round((r.correct / r.total) * 100) })); const weak = S.topics.filter((tp) => !g.classId || tp.classId === g.classId).map(topicMastery).filter((m) => m.recentAcc != null).sort((a, b) => a.recentAcc - b.recentAcc)[0]; if (weak && cur != null && cur < g.target) next.push(`Your weakest quizzed topic is ${weak.t.name} (${Math.round(weak.recentAcc * 100)}%). Focus there first.`); }
  let pct = null; if (cur != null) { if (g.type === 'master_topics') pct = (g.topicIds || []).length ? (cur / g.topicIds.length) * 100 : null; else if (start != null && start < target && g.type !== 'study_hours') pct = clamp(((cur - start) / (target - start)) * 100, 0, 100); else pct = clamp((cur / target) * 100, 0, 100); if (cur >= (g.type === 'master_topics' ? (g.topicIds || []).length : target)) pct = 100; }
  if (!detail) detail = cur == null ? 'No data for this goal yet.' : `Now ${fmt(cur)}${unit}, target ${g.type === 'master_topics' ? (g.topicIds || []).length : fmt(target)}${g.type === 'master_topics' ? '' : unit}${start != null && g.type !== 'study_hours' && g.type !== 'master_topics' ? ` (started at ${fmt(start)}${unit})` : ''}.`;
  if (onTrack == null && g.deadline && pct != null && pct < 100) { const span = daysBetween(since, g.deadline), gone = daysBetween(since, t); if (span > 0) onTrack = pct >= (gone / span) * 100 - 15; }
  return { cur, pct, unit, fmt, series, next, detail, onTrack, done: pct === 100 };
}
function goalBaseline(g) { const p = goalProgress({ ...g, start: null }); return p.cur; }
function checkGoals() { let ch = false; for (const g of S.goals) { if (g.archived) continue; const p = goalProgress(g); if (p.done && !g.achievedAt) { g.achievedAt = Date.now(); ch = true; setTimeout(() => toast(`Goal reached: ${goalTitle(g)}`), 300); } } if (ch) save('goals'); }
