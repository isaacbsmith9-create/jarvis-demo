/* ==================== helpers ==================== */
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function keyDate(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function today() { return dayKey(Date.now()); }
function addDays(k, n) { const d = keyDate(k); d.setDate(d.getDate() + n); return dayKey(d.getTime()); }
function weekStart(k) { const d = keyDate(k); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return dayKey(d.getTime()); }
function monthStart(k) { return k.slice(0, 8) + '01'; }
function daysBetween(a, b) { return Math.round((keyDate(b) - keyDate(a)) / 86400000); }
function fmtDay(k, opts) { return keyDate(k).toLocaleDateString(undefined, opts || { weekday: 'short', month: 'short', day: 'numeric' }); }
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : null; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function sum(arr, f) { return arr.reduce((t, x) => t + (f ? f(x) : x), 0); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtMin(m) { m = Math.round(m || 0); if (m < 60) return m + 'm'; const h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? ' ' + pad(r) + 'm' : ''); }

/* ==================== state ==================== */
var STATE_VERSION = 3;
function defaultState() {
  return {
    schema: STATE_VERSION,
    savedAt: 0,
    profile: { name: '', level: 'Varsity', style: 'Scorer', env: 'Outdoor court', dominantHand: 'Right', weeklyTarget: 300, sessionTarget: 4, partnerName: '', goal: '', weekdays: [1, 3, 5] },
    customDrills: [],
    favorites: [],
    drillOverrides: {},
    drillHistoryIgnored: [],
    workouts: [],
    sessions: [],
    plan: [],
    habits: HABIT_SEED.map(function (h) { return Object.assign({ created: 0, active: true }, h); }),
    habitLog: [],
    priorities: PRIORITY_SEED(),
    goals: [],
    readiness: [],
    journal: [],
    collections: [],
    milestonesSeen: [],
    prSeen: [],
    run: null,
    lastRunSummary: null
  };
}

function migrateV2Session(s, idx) {
  // v2 saved sessions with endedAt and items[].setLog or sets. Carry forward what can be read.
  const endedAt = s.endedAt || s.savedAt || Date.now() - idx;
  const items = (s.items || []).map(function (i) {
    const sets = (i.setLog || i.sets || []).map(function (x) {
      return { att: +x.att || 0, made: +x.made || 0, zone: x.zone || null };
    });
    return { drillId: i.drillId, name: i.name || 'Drill', metric: i.metric || 'makes', sets: sets, status: i.status || 'done', skipped: !!i.skipped, reps: +i.reps || 0, goodReps: +i.goodReps || 0, seconds: +i.seconds || 0 };
  });
  return {
    id: s.id || uid(), date: dayKey(endedAt), endedAt: endedAt, minutes: +s.minutes || Math.round(s.durationSec ? s.durationSec / 60 : 0) || 0,
    workoutId: s.workoutId || null, workoutName: s.workoutName || s.name || 'Workout', items: items,
    completionPct: +s.completionPct || 0, rpe: s.rpe || null, planId: s.planId || null, notes: s.notes || '', location: s.location || ''
  };
}

function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const out = Object.assign(base, raw);
  out.schema = STATE_VERSION;
  out.profile = Object.assign({}, base.profile, raw.profile || {});
  ['customDrills', 'favorites', 'workouts', 'sessions', 'plan', 'habits', 'habitLog', 'priorities', 'goals', 'readiness', 'journal', 'collections', 'milestonesSeen', 'prSeen'].forEach(function (k) {
    if (!Array.isArray(out[k])) out[k] = base[k];
  });
  if (!raw.schema || raw.schema < 3) {
    // v2 migration: sessions stored in a different shape; keep anything readable and drop the rest.
    out.sessions = (raw.sessions || []).map(migrateV2Session);
    out.customDrills = (raw.drills || []).filter(function (d) { return d && d.custom; }).map(function (d) { return normalizeDrill(d); });
    out.workouts = (raw.workouts || []).map(function (w) { return Object.assign({ id: uid(), name: 'Workout', items: [], custom: true }, w); });
    out.plan = (raw.plan || []).map(function (p) { return Object.assign({ id: uid(), type: 'workout', title: p.title || p.name || 'Workout', date: p.date || today(), minutes: p.minutes || 30, status: 'planned' }, p); });
    out.priorities = Array.isArray(raw.priorities) && raw.priorities.length ? raw.priorities : base.priorities;
  }
  out.sessions = out.sessions.map(function (s) { return Object.assign({ date: dayKey(s.endedAt || Date.now()) }, s); });
  out.customDrills = out.customDrills.map(normalizeDrill);
  if (out.run && !Array.isArray(out.run.items)) out.run = null;
  if (out.run && out.run.items) out.run.items = out.run.items.map(function (i) { return Object.assign({ status: 'pending', sets: [] }, i); });
  return out;
}
function normalizeDrill(d) {
  return Object.assign({ id: 'c-' + uid(), name: 'Custom drill', category: 'Shooting', difficulty: 2, secondary: [], objective: '', instructions: '', coaching: [], mistakes: [], progressions: [], regressions: [], equipment: ['Ball', 'Hoop'], minutes: 10, sets: 3, attempts: 10, metric: 'makes', zone: null, partner: false, soloVariant: '', partnerVariant: null, favorite: false, custom: true, video: '', created: Date.now() }, d);
}

/* ==================== drill lookup ==================== */
function allDrills() {
  const ov = S.drillOverrides || {};
  return DRILLS.map(function (d) { return Object.assign({}, d, ov[d.id] || {}, { favorite: S.favorites.indexOf(d.id) >= 0 }); })
    .concat(S.customDrills.map(function (d) { return Object.assign({}, d, { favorite: S.favorites.indexOf(d.id) >= 0 }); }));
}
function drillById(id) { return allDrills().find(function (d) { return d.id === id; }) || null; }
function drillUsage(id) {
  let sessions = 0, lastDay = null;
  S.sessions.forEach(function (s) { if (s.items.some(function (i) { return i.drillId === id; })) { sessions++; if (!lastDay || s.date > lastDay) lastDay = s.date; } });
  return { sessions: sessions, lastDay: lastDay };
}

/* ==================== session math ==================== */
function itemTotals(item) {
  let att = 0, made = 0, reps = 0, good = 0;
  item.sets.forEach(function (x) { att += x.att || 0; made += x.made || 0; });
  reps = item.reps || 0; good = item.goodReps || 0;
  return { att: att, made: made, reps: reps, good: good, pct: pct(made, att) };
}
function sessionTotals(s) {
  let att = 0, made = 0, reps = 0, good = 0, seconds = 0;
  const zones = {};
  s.items.forEach(function (i) {
    const t = itemTotals(i);
    reps += t.reps; good += t.good; seconds += i.seconds || 0;
    // Shooting totals count only attempt-and-make drills. Good-rep drills stay out of shooting %.
    if (i.metric === 'makes') { att += t.att; made += t.made; }
    i.sets.forEach(function (x) {
      if (x.zone && x.att && i.metric === 'makes') {
        zones[x.zone] = zones[x.zone] || { att: 0, made: 0 };
        zones[x.zone].att += x.att; zones[x.zone].made += x.made;
      }
    });
  });
  return { att: att, made: made, pct: pct(made, att), reps: reps, good: good, zones: zones, seconds: seconds };
}
function sessionLoad(s) { return (s.minutes || 0) * (s.rpe || 5); }
function rangeSessions(from, to) { return S.sessions.filter(function (s) { return s.date >= from && s.date <= to; }); }
function rangeMinutes(from, to) { return sum(rangeSessions(from, to), function (s) { return s.minutes || 0; }); }
function dailyMinutes(from, to) {
  const out = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push({ day: k, minutes: rangeMinutes(k, k), makes: sessionsMakesOn(k) });
  return out;
}
function sessionsMakesOn(k) { return sum(S.sessions.filter(function (s) { return s.date === k; }), function (s) { return sessionTotals(s).made; }); }
function weeklyMinutes(weeksBack) {
  const cur = weekStart(today());
  return addDays(cur, -7 * weeksBack);
}
function weekRange(anchor) { const a = weekStart(anchor || today()); return [a, addDays(a, 6)]; }
function monthRange(anchor) { const a = monthStart(anchor || today()); const d = keyDate(a); d.setMonth(d.getMonth() + 1); d.setDate(0); return [a, dayKey(d.getTime())]; }

/* Shot and skill totals across all sessions. */
function shootingSummary(from, to) {
  const ss = from ? rangeSessions(from, to) : S.sessions;
  let att = 0, made = 0;
  ss.forEach(function (s) { const t = sessionTotals(s); att += t.att; made += t.made; });
  return { att: att, made: made, pct: pct(made, att) };
}
function areaMinutes(from, to) {
  const out = {};
  AREAS.forEach(function (a) { out[a] = 0; });
  rangeSessions(from, to).forEach(function (s) {
    s.items.forEach(function (i) {
      const d = drillById(i.drillId);
      const cat = d ? d.category : (i.category || 'Shooting');
      out[cat] = (out[cat] || 0) + (i.seconds ? i.seconds / 60 : 0) + (i.minutesShare || 0);
    });
  });
  return out;
}
function monthMinutesLabel(from, to) { return fmtMin(rangeMinutes(from, to)); }

/* Records: new best makes/attempts on a drill, longest session, and milestone thresholds. */
/* Best single-session makes on a drill across all saved sessions. Call before the new session is saved. */
function bestMakesFor(drillId) {
  let best = null;
  S.sessions.forEach(function (s) {
    s.items.forEach(function (i) {
      if (i.drillId !== drillId || i.metric !== 'makes') return;
      const t = itemTotals(i);
      if (t.made > 0 && (!best || t.made > best.made)) best = { made: t.made, att: t.att, date: s.date };
    });
  });
  return best;
}
function detectRecords(s) {
  const found = [];
  s.items.forEach(function (i) {
    const t = itemTotals(i);
    if (!t.made || i.metric !== 'makes') return;
    const prior = bestMakesFor(i.drillId);
    if (!prior || t.made > prior.made) {
      found.push({ id: 'pr-' + s.id + '-' + i.drillId, kind: 'pr', title: 'New best: ' + i.name, detail: t.made + ' makes' + (prior ? ' (previous ' + prior.made + ')' : ' · first recorded score'), date: s.date });
    }
  });
  return found;
}
var MILESTONES = [
  { id: 'att-100', label: '100 total attempts', test: function (t) { return t.att >= 100; } },
  { id: 'att-500', label: '500 total attempts', test: function (t) { return t.att >= 500; } },
  { id: 'att-1000', label: '1,000 total attempts', test: function (t) { return t.att >= 1000; } },
  { id: 'att-2500', label: '2,500 total attempts', test: function (t) { return t.att >= 2500; } },
  { id: 'made-500', label: '500 total makes', test: function (t) { return t.made >= 500; } },
  { id: 'sess-10', label: '10 logged sessions', test: function (t) { return t.sessions >= 10; } },
  { id: 'sess-25', label: '25 logged sessions', test: function (t) { return t.sessions >= 25; } },
  { id: 'sess-50', label: '50 logged sessions', test: function (t) { return t.sessions >= 50; } },
  { id: 'min-600', label: '10 hours trained', test: function (t) { return t.minutes >= 600; } },
  { id: 'min-3000', label: '50 hours trained', test: function (t) { return t.minutes >= 3000; } }
];
function lifetimeTotals() {
  let att = 0, made = 0, minutes = 0;
  S.sessions.forEach(function (s) { const t = sessionTotals(s); att += t.att; made += t.made; minutes += s.minutes || 0; });
  return { att: att, made: made, minutes: minutes, sessions: S.sessions.length };
}
function newMilestones() {
  const t = lifetimeTotals();
  return MILESTONES.filter(function (m) { return m.test(t) && S.milestonesSeen.indexOf(m.id) < 0; });
}

/* ==================== readiness & workload ==================== */
function readinessToday() { return S.readiness.find(function (r) { return r.date === today(); }) || null; }
function readinessScore(r) {
  if (!r) return null;
  // 1–5 each. Sleep is hours-band based; soreness inverted.
  const sleep = clamp(r.sleep || 3, 1, 5), soreness = clamp(r.soreness || 3, 1, 5), energy = clamp(r.energy || 3, 1, 5);
  return Math.round(((sleep + (6 - soreness) + energy) / 15) * 100);
}
function readinessLabel(score) {
  if (score == null) return { label: 'No check-in', tone: 'i' };
  if (score >= 75) return { label: 'Ready to push', tone: 'g' };
  if (score >= 55) return { label: 'Train as planned', tone: 'w' };
  return { label: 'Keep it light', tone: 'b' };
}
/* Acute:chronic workload ratio: last 7 days load vs average weekly load over the prior 28 days. */
function workloadRatio() {
  const t = today();
  const acute = sum(rangeSessions(addDays(t, -6), t), sessionLoad);
  const chronicWeeks = sum(rangeSessions(addDays(t, -34), addDays(t, -7)), sessionLoad) / 4;
  if (!S.sessions.length) return { acute: 0, chronic: 0, ratio: null, state: 'none' };
  if (chronicWeeks === 0) return { acute: acute, chronic: 0, ratio: null, state: 'building' };
  const ratio = Math.round((acute / chronicWeeks) * 100) / 100;
  let state = 'ok';
  if (ratio > 1.5) state = 'high'; else if (ratio < 0.8) state = 'low';
  return { acute: acute, chronic: chronicWeeks, ratio: ratio, state: state };
}

/* ==================== goals ==================== */
var GOAL_TYPES = {
  shot_pct: { label: 'Shooting %', unit: '%', dir: 'up', help: 'Team-wide make percentage over the period.' },
  minutes_week: { label: 'Minutes per week', unit: 'min', dir: 'up', help: 'Logged training minutes in a calendar week.' },
  sessions_count: { label: 'Sessions per week', unit: 'sessions', dir: 'up', help: 'Completed sessions in a calendar week.' },
  makes_week: { label: 'Makes per week', unit: 'makes', dir: 'up', help: 'Made shots in a calendar week.' }
};
function goalProgress(g) {
  const t = today();
  const [wa, wb] = weekRange(t);
  let current = null;
  if (g.type === 'minutes_week') current = rangeMinutes(wa, wb);
  if (g.type === 'sessions_count') current = rangeSessions(wa, wb).length;
  if (g.type === 'makes_week') current = sum(rangeSessions(wa, wb), function (s) { return sessionTotals(s).made; });
  if (g.type === 'shot_pct') {
    const from = g.start || addDays(t, -27);
    current = shootingSummary(from, t).pct;
  }
  if (current == null) return { current: null, pct: null, done: false };
  const target = +g.target || 0;
  const p = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return { current: current, pct: p, done: target > 0 && current >= target };
}

/* ==================== recommendations ==================== */
function priorityGap() {
  const from = addDays(today(), -13);
  const mins = areaMinutes(from, today());
  const active = S.priorities.filter(function (p) { return p.status === 'active'; });
  if (!active.length) return null;
  return active.slice().sort(function (a, b) { return (mins[a.area] || 0) - (mins[b.area] || 0); })[0];
}
function recommendToday() {
  const notes = [];
  const r = readinessScore(readinessToday());
  const ratio = workloadRatio();
  const plannedToday = S.plan.filter(function (p) { return p.date === today() && p.status !== 'done'; });
  const gap = priorityGap();
  let mode = 'train';
  if (r != null && r < 55) { mode = 'light'; notes.push('Readiness is low today. Keep the session to a micro workout.'); }
  if (ratio.state === 'high') { mode = 'light'; notes.push('Last 7 days are well above your 4-week average. Cut volume to protect durability.'); }
  if (ratio.state === 'low' && mode === 'train') notes.push('Load has dropped off. A focused session will rebuild it.');
  if (plannedToday.length) notes.push('You have ' + plannedToday.length + ' planned item' + (plannedToday.length > 1 ? 's' : '') + ' today.');
  if (!S.sessions.length) notes.push('No sessions logged yet. Start with a 15-minute micro workout to set the baseline.');
  let headline;
  if (plannedToday.length) headline = 'Complete today\'s planned work: ' + plannedToday[0].title;
  else if (mode === 'light') headline = 'Light session: micro workout, 15 minutes';
  else if (gap) headline = 'Focus on ' + gap.area + ' (least minutes in the last 2 weeks)';
  else headline = 'Pick a focused workout and log it';
  const tmpl = pickTemplateFor(mode, gap);
  return { headline: headline, notes: notes, template: tmpl, mode: mode, gap: gap };
}
function pickTemplateFor(mode, gap) {
  const pool = S.workouts.length ? S.workouts : [];
  if (!pool.length) return null;
  let cands = pool;
  if (mode === 'light') cands = pool.filter(function (w) { return w.category === 'micro'; });
  if (!cands.length) cands = pool;
  if (gap) {
    const match = cands.find(function (w) { return w.objective === gap.area; });
    if (match) return match;
  }
  return cands[0];
}

/* Free-text builder (rule-based). parseRequest reads minutes, area, hard, partner from the request. */
function parseRequest(text) {
  const t = String(text || '').toLowerCase();
  const out = { minutes: null, area: null, hard: /hard|challeng|difficult|tough/.test(t), partner: /partner|with a friend|with someone|1v1|one on one/.test(t) };
  const m = t.match(/(\d{1,3})\s*(min|minute)/);
  if (m) out.minutes = +m[1];
  if (!out.minutes) { const h = t.match(/(\d)\s*(hour|hr)/); if (h) out.minutes = +h[1] * 60; }
  if (/shoot|shot|jump|three|3/.test(t)) out.area = 'Shooting';
  else if (/finish|layup|rim/.test(t)) out.area = 'Finishing';
  else if (/handle|dribbl|ball/.test(t)) out.area = 'Ball Handling';
  else if (/pick|roll|screen/.test(t)) out.area = 'Pick-and-Roll';
  else if (/conditioning|sprint|speed|agility/.test(t)) out.area = 'Conditioning';
  else if (/footwork|slide|movement/.test(t)) out.area = 'Movement';
  else if (/game|situation|scrimmage/.test(t)) out.area = 'Game Situations';
  return out;
}
/* Build a session from a request. Solo drills are used unless partner is requested. */
function generateSession(opts) {
  const minutes = clamp(opts.minutes || 30, 10, 120);
  const pool = allDrills().filter(function (d) {
    if (opts.area && d.category !== opts.area && (d.secondary || []).indexOf(opts.area) < 0) return false;
    if (!opts.partner && d.partner) return false;
    return true;
  });
  const sorted = pool.slice().sort(function (a, b) {
    const ha = (opts.hard ? b.difficulty : a.difficulty), hb = (opts.hard ? a.difficulty : b.difficulty);
    return ha - hb;
  });
  const picked = [];
  let used = 0;
  for (let i = 0; i < sorted.length && used < minutes; i++) {
    const d = sorted[i];
    if (picked.some(function (p) { return p.category === d.category; }) && picked.length < 3) continue;
    picked.push(d); used += d.minutes;
  }
  const items = picked.map(function (d) {
    return { drillId: d.id, name: d.name, category: d.category, metric: d.metric, sets: [], targetSets: d.sets, targetAttempts: d.attempts, restSec: 30, timeLimitSec: 0, status: 'pending' };
  });
  return { name: opts.name || (opts.area ? opts.area + ' session' : 'Custom session'), minutes: minutes, items: items, notes: opts.notes || '' };
}
function nextStepsFor(sessionCount) {
  const steps = [];
  if (!S.sessions.length) steps.push('Log your first session to start the shooting and minutes baselines.');
  if (!S.readiness.length) steps.push('Add a readiness check-in to get a daily training recommendation.');
  if (!S.goals.length) steps.push('Set one weekly goal so progress shows on Home.');
  if (!S.customDrills.length) steps.push('Save a custom drill when you find one that works for you.');
  return steps.slice(0, sessionCount || 3);
}
