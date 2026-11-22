/* ==================== app state & persistence ==================== */
var KEY = 'btc-training-center-v3';
var KEY_V2 = 'btc-training-center-v2';
var S = normalize(null);
var UI = { q: '', cat: 'all', fav: false, diff: 0, custom: false, calMode: 'week', anchor: '', sel: '', range: 7, dbState: 'local', dbDoc: null, dbTimer: null, storeFailed: false, armed: null, toastT: null, tick: null, dragId: null, editWorkout: null, editDrill: null, builder: null };
var TAB_OF = { home: 'home', train: 'train', library: 'library', plan: 'plan', analytics: 'analytics', more: 'more' };

function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function anchorDay() { return UI.anchor || today(); }
function selDay() { return UI.sel || today(); }

function writeLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); UI.storeFailed = false; }
  catch (e) { UI.storeFailed = true; }
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const old = localStorage.getItem(KEY_V2); // carry over the v2 save once
    if (old) return JSON.parse(old);
  } catch (e) { UI.storeFailed = true; }
  return null;
}
/* How much real stuff a saved copy holds. Used so an empty copy can never replace one with your data. */
function stateScore(st) {
  if (!st || typeof st !== 'object') return 0;
  var n = function (a) { return Array.isArray(a) ? a.length : 0; }, sc = 0;
  sc += n(st.sessions) * 3 + n(st.plan) * 2 + n(st.games) * 3 + n(st.journal) * 2 + n(st.customDrills) * 2 + n(st.goals) + n(st.habitLog) + n(st.readiness) + n(st.shotPlans) * 2 + n(st.shotTypes);
  sc += (st.workouts || []).filter(function (w) { return w && !w.template; }).length * 2;
  if (st.myweek && st.myweek.weeks) Object.keys(st.myweek.weeks).forEach(function (k) { (st.myweek.weeks[k] || []).forEach(function (d) { sc += n(d); }); });
  if (st.progs) sc += Object.keys(st.progs.done || {}).length + n(st.progs.mine) * 2;
  if (st.film) sc += n(st.film.clips) * 2;
  if (st.philo && (st.philo.statement || n(st.philo.principles))) sc += 2;
  return sc;
}
function save() {
  /* while the app is still starting up, never stamp a save or touch your account copy */
  if (!UI.ready) { writeLocal(); return; }
  S.savedAt = Date.now();
  writeLocal();
  UI.dbState = UI.dbDoc ? 'pending' : (UI.storeFailed ? 'failed' : 'local');
  scheduleDb();
  paintStatus();
}
function scheduleDb() {
  if (!UI.dbDoc) return;
  clearTimeout(UI.dbTimer);
  UI.dbTimer = setTimeout(async function () {
    /* never push an empty copy over an account copy that has your stuff */
    if (stateScore(S) === 0 && (UI.remoteScore || 0) > 0) { UI.dbState = 'local'; paintStatus(); return; }
    try { await UI.dbDoc.set({ state: S, savedAt: S.savedAt }); UI.dbState = 'account'; UI.remoteScore = stateScore(S);
      /* refresh today's backup every 30 min while you work, as long as it isn't losing stuff */
      if (Date.now() - (UI.lastBk || 0) > 30 * 60000 && stateScore(S) >= (UI.dayScore || 0) * 0.8) { UI.lastBk = Date.now(); UI.dayScore = stateScore(S); writeBackup('day-' + dayStamp(), S); } }
    catch (e) { UI.dbState = UI.storeFailed ? 'failed' : 'local'; }
    paintStatus();
  }, 500);
}
function paintStatus() {
  const t = S.savedAt ? new Date(S.savedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  let txt = 'Saved on this device<br>' + t, tone = '';
  if (UI.dbState === 'failed') { txt = '<b>Not saved</b><br>Export a backup in Profile'; tone = 'bad'; }
  else if (UI.dbState === 'pending') { txt = 'Saving…'; tone = 'warn'; }
  else if (UI.dbState === 'account') { txt = '<b>Saved to your account</b><br>' + t; }
  $$('[data-status]').forEach(function (el) { el.innerHTML = txt; el.className = 'sync ' + tone; });
}
/* db snapshots expose data() as a function and an exists flag */
function snapData(snap) {
  if (!snap) return null;
  if (typeof snap.data === 'function') return snap.exists === false ? null : (snap.data() || null);
  if (snap.data !== undefined) return snap.data;
  return snap;
}
function dayStamp(t) { var d = new Date(t || Date.now()); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
async function writeBackup(tag, st) {
  if (!UI.dbNs || !UI.uid || stateScore(st) === 0) return;
  try { await UI.dbNs.doc('data/users/' + UI.uid + '/backup-' + tag).set({ state: st, savedAt: Date.now(), score: stateScore(st), from: st.savedAt || 0 }); } catch (e) { /* backups are best effort */ }
}
function localBackup(st) { try { if (stateScore(st) > 0) localStorage.setItem(KEY + '-backup', JSON.stringify({ at: Date.now(), state: st })); } catch (e) { /* full storage */ } }
async function initAccount() {
  var fallback = setTimeout(function () { UI.ready = true; }, 10000);
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    const ns = await window.claude.use('db');
    const user = await window.claude.use('user');
    if (!ns || !user) return;
    const id = await user.id();
    UI.dbNs = ns; UI.uid = id;
    UI.dbDoc = ns.doc('data/users/' + id + '/app');
    let remote = null, ok = true;
    try {
      const snap = await UI.dbDoc.get();
      const val = snapData(snap);
      if (val && val.state) remote = val.state;
      else if (val && snap && snap.exists !== false) ok = false; /* the doc is there but unreadable: never overwrite it */
    } catch (e) { remote = null; ok = false; }
    if (!ok) { UI.dbDoc = null; return; } /* couldn't read your account: stay on this device and never overwrite it */
    const ls = stateScore(S), rs = stateScore(remote); UI.remoteScore = rs;
    /* pick the copy that has your stuff; if both do, the most recently edited one wins */
    let useRemote = false;
    if (remote) useRemote = ls === 0 ? rs > 0 : rs === 0 ? false : (remote.savedAt || 0) > (S.savedAt || 0);
    if (useRemote) { if (ls > 0) { localBackup(S); writeBackup('replaced-device', S); } S = normalize(remote); writeLocal(); }
    else if (remote && rs > 0 && (remote.savedAt || 0) !== (S.savedAt || 0)) writeBackup('replaced-account', remote);
    UI.ready = true;
    if (!useRemote) { if (!S.savedAt && ls > 0) S.savedAt = Date.now(); UI.dbState = 'pending'; scheduleDb(); } else UI.dbState = 'account';
    /* one backup per day; never replace it with a copy that has a lot less in it */
    try { const tag = 'day-' + dayStamp(), b = await ns.doc('data/users/' + id + '/backup-' + tag).get(), bv = snapData(b); if (!bv || !bv.state || stateScore(S) >= (bv.score || 0) * 0.8) writeBackup(tag, S); } catch (e) { /* best effort */ }
    render();
  } catch (e) { /* stay on device storage */ }
  finally { clearTimeout(fallback); UI.ready = true; paintStatus(); }
}

/* ==================== seeding ==================== */
function templateToWorkout(t) {
  return {
    id: 'w-' + slug(t[0]), name: t[0], category: t[1], objective: t[2], minutes: t[3], difficulty: t[4],
    warmup: t[7], notes: t[8], template: true, custom: false, created: 0,
    items: t[6].map(function (it) {
      const d = DRILLS.find(function (x) { return x.id === 'd-' + it[0]; });
      return { drillId: 'd-' + it[0], name: d.name, category: d.category, metric: d.metric, targetSets: it[1], targetAttempts: it[2], restSec: it[3], timeLimitSec: it[4] };
    })
  };
}
function seedTemplates() {
  if (S.seeded) return;
  S.workouts = TEMPLATE_DEFS.map(templateToWorkout).concat(S.workouts);
  S.seeded = true;
}

/* ==================== pure logic used by the UI and the tests ==================== */
/* Build a finished session from the active run and the values entered on the finish sheet. */
function buildSession(run, opts) {
  const now = opts.endedAt || Date.now();
  const items = run.items.map(function (i) {
    const done = i.status === 'done' || (i.sets.length >= (i.targetSets || 1) && i.sets.length > 0);
    return { drillId: i.drillId, name: i.name, category: i.category, metric: i.metric, sets: i.sets.slice(), status: done ? 'done' : (i.sets.length ? 'partial' : 'skipped'), reps: i.reps || 0, goodReps: i.goodReps || 0, seconds: i.seconds || 0, targetSets: i.targetSets, targetAttempts: i.targetAttempts };
  });
  const doneCount = items.filter(function (i) { return i.status === 'done'; }).length;
  const measured = Math.max(1, Math.round((now - run.startedAt) / 60000));
  return {
    id: 's-' + uid(), date: dayKey(now), endedAt: now, startedAt: run.startedAt,
    minutes: Math.max(1, Math.round(opts.minutes || measured)), workoutId: run.workoutId || null, workoutName: run.name || 'Workout',
    items: items, completionPct: items.length ? Math.round((doneCount / items.length) * 100) : 0,
    rpe: opts.rpe || null, planId: run.planId || null, notes: opts.notes || '', location: opts.location || ''
  };
}
/* Save a session: detect records and milestones, link to the plan, return what was new. */
function commitSession(session) {
  const records = detectRecords(session);
  S.sessions.push(session);
  records.forEach(function (r) { S.prSeen.push(r); });
  const ms = newMilestones();
  ms.forEach(function (m) { S.milestonesSeen.push(m.id); });
  let planned = null;
  if (session.planId) planned = S.plan.find(function (p) { return p.id === session.planId; }) || null;
  if (!planned) {
    planned = S.plan.find(function (p) { return p.date === session.date && p.status !== 'done' && p.type === 'workout' && p.title === session.workoutName; }) || null;
  }
  if (planned) { planned.status = 'done'; planned.sessionId = session.id; }
  return { records: records, milestones: ms, planned: planned };
}
/* Move a plan item to another date. Returns false when the target is not a valid day key. */
function moveEvent(id, toDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDay || '')) return false;
  const p = S.plan.find(function (x) { return x.id === id; });
  if (!p) return false;
  p.date = toDay; return true;
}
/* A planned item that passed its date without completion reads as missed. */
function planState(p) {
  if (p.status === 'done') return 'done';
  if (p.date < today()) return 'missed';
  return p.type === 'game' ? 'game' : p.type === 'team' || p.type === 'school' ? 'team' : p.type === 'rest' || p.type === 'recovery' ? 'rest' : 'planned';
}
function planItemsOn(day) {
  return S.plan.filter(function (p) { return p.date === day; }).sort(function (a, b) { return (a.title || '').localeCompare(b.title || ''); });
}
function sessionsOn(day) {
  return S.sessions.filter(function (s) { return s.date === day; }).sort(function (a, b) { return a.endedAt - b.endedAt; });
}
/* Week or month view data for the plan: planned and completed minutes per day. */
function dayAgg(day) {
  const planned = planItemsOn(day).filter(function (p) { return p.status !== 'done'; });
  const ss = sessionsOn(day);
  return { planned: planned, sessions: ss, plannedMin: sum(planned, function (p) { return p.minutes || 0; }), doneMin: sum(ss, function (s) { return s.minutes || 0; }) };
}

/* ==================== actions ==================== */
function render() {
  const route = (location.hash || '#home').slice(1) || 'home';
  const tab = TAB_OF[route.split('-')[0]] || (route.indexOf('workout') === 0 ? 'train' : route.indexOf('drill') === 0 ? 'library' : route.indexOf('session') === 0 ? 'analytics' : route.indexOf('run') === 0 ? 'train' : route.indexOf('dev') === 0 || route.indexOf('journal') === 0 || route.indexOf('habits') === 0 || route.indexOf('profile') === 0 ? 'more' : 'home');
  const body = routeView(route);
  $('#app').innerHTML = body;
  $$('.side a[data-tab],.tabbar a[data-tab]').forEach(function (a) { const on = a.dataset.tab === tab; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $$('.side a[data-sub]').forEach(function (a) { const on = a.dataset.sub === route; a.classList.toggle('on', on); });
  document.title = 'Training Center · ' + (tab === 'home' ? 'Home' : tab.charAt(0).toUpperCase() + tab.slice(1));
  renderRunner();
  paintStatus();
}
function routeView(route) {
  if (route === 'home') return viewHome();
  if (route === 'train') return viewTrain();
  if (route === 'library') return viewLibrary();
  if (route.indexOf('drill-') === 0) return viewDrill(route.slice(6));
  if (route === 'drill-new') return viewDrillEdit(null);
  if (route.indexOf('drilledit-') === 0) return viewDrillEdit(route.slice(10));
  if (route === 'workout-new') return viewWorkoutEdit(null);
  if (route.indexOf('workout-') === 0) return viewWorkoutEdit(route.slice(8));
  if (route.indexOf('session-') === 0) return viewSession(route.slice(8));
  if (route === 'plan') return viewPlan();
  if (route === 'analytics') return viewAnalytics();
  if (route === 'more' || route === 'dev') return viewDev();
  if (route === 'journal') return viewJournal();
  if (route === 'habits') return viewHabits();
  if (route === 'profile') return viewProfile();
  return viewHome();
}

/* ---------- small view helpers ---------- */
function kpi(v, label, unit, sub) {
  return '<div class="kpi"><div class="v">' + v + (unit ? '<small>' + unit + '</small>' : '') + '</div><div class="l">' + label + '</div>' + (sub ? '<div class="d tiny">' + sub + '</div>' : '') + '</div>';
}
function empty(title, body, action) {
  return '<div class="empty"><b>' + title + '</b>' + body + (action ? '<div style="margin-top:10px">' + action + '</div>' : '') + '</div>';
}
function pageHead(kick, title, right) {
  return '<div class="pagehead"><div><div class="kick">' + kick + '</div><h1>' + title + '</h1></div>' + (right || '') + '</div>';
}
function drillLink(id, name) { return '<a href="#drill-' + id + '" style="text-decoration:none;font-weight:700">' + esc(name) + '</a>'; }
function fmtPct(p) { return p == null ? '–' : p + '%'; }
function setsLabel(i) { return (i.targetSets || 1) + ' × ' + (i.targetAttempts || 1) + (i.metric === 'makes' ? ' att' : ' reps'); }

/* ---------- HOME ---------- */
function viewHome() {
  const t = today();
  const wk = weekRange(t), mo = monthRange(t);
  const dayMin = rangeMinutes(t, t), weekMin = rangeMinutes(wk[0], wk[1]), monthMin = rangeMinutes(mo[0], mo[1]);
  const target = +S.profile.weeklyTarget || 0;
  const wpct = target ? Math.min(100, Math.round((weekMin / target) * 100)) : null;
  const rec = recommendToday();
  const rd = readinessToday(), rs = readinessScore(rd), rl = readinessLabel(rs);
  const wl = workloadRatio();
  const shoot7 = shootingSummary(addDays(t, -6), t);
  const upcoming = S.plan.filter(function (p) { return p.date >= t && p.status !== 'done'; }).sort(function (a, b) { return a.date.localeCompare(b.date) || (a.title || '').localeCompare(b.title || ''); }).slice(0, 4);
  const recent = S.sessions.slice().sort(function (a, b) { return b.endedAt - a.endedAt; }).slice(0, 3);
  const areas = areaMinutes(addDays(t, -13), t);
  const maxArea = Math.max(1, Math.max.apply(null, AREAS.map(function (a) { return areas[a] || 0; })));
  const days = dailyMinutes(addDays(t, -13), t);
  const goals = S.goals.slice(0, 3);
  const pr = S.prSeen.slice().reverse().slice(0, 3);
  const ms = S.milestonesSeen.slice(-2);
  const wlTone = wl.state === 'high' ? 'b' : wl.state === 'low' ? 'w' : wl.state === 'ok' ? 'g' : 'i';
  const wlText = wl.state === 'none' ? 'No load yet' : wl.state === 'building' ? 'Building a baseline' : wl.ratio + 'x';

  return pageHead('Athlete command center', 'Home' + (S.profile.name ? ' · ' + esc(S.profile.name) : ''), '<button class="btn b" data-a="open-builder">Build a session</button>') +
    '<section class="panel hero" style="margin-bottom:14px"><div class="row" style="align-items:flex-start"><div style="flex:1;min-width:240px"><div class="tiny" style="letter-spacing:.12em;text-transform:uppercase;font-weight:700">Today\'s recommendation</div><h2 style="margin-top:6px">' + esc(rec.headline) + '</h2>' +
    '<ul class="small" style="margin-top:8px">' + rec.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' +
    '<div class="btns" style="margin-top:12px">' + (rec.template ? '<button class="btn p" data-a="start-template" data-id="' + rec.template.id + '">Start ' + esc(rec.template.name) + '</button>' : '<a class="btn p" href="#train">Choose a workout</a>') + (S.run ? '<button class="btn" data-a="run-resume">Resume workout in progress</button>' : '') + '</div></div>' +
    '<div style="min-width:200px;flex:0 0 auto"><span class="tag ' + rl.tone + '">' + rl.label + '</span><div class="tiny" style="margin-top:8px">Readiness ' + (rs == null ? 'not logged' : rs + '/100') + '</div><div class="tiny">Workload ' + wlText + '</div></div></div></section>' +
    (ms.length || S.prSeen.length ? '' : '') +
    '<div class="grid g4" style="margin-bottom:14px">' +
    kpi(fmtMin(dayMin), 'Minutes today', '', dayMin ? '' : 'Nothing logged yet') +
    kpi(fmtMin(weekMin), 'This week', '', target ? 'Target ' + fmtMin(target) : 'Set a weekly target in Profile') +
    kpi(fmtMin(monthMin), 'This month', '', monthMin ? '' : 'Logged minutes this month') +
    kpi(fmtPct(shoot7.pct), 'Shooting, 7 days', '', shoot7.att ? shoot7.made + ' of ' + shoot7.att : 'No shots logged') +
    '</div>' +
    '<div class="grid g3" style="margin-bottom:14px">' +
    '<section class="panel"><div class="phead"><div><h3>Weekly target</h3><div class="sub">' + (target ? fmtMin(weekMin) + ' of ' + fmtMin(target) : 'No target set') + '</div></div></div>' +
    '<div class="row" style="justify-content:flex-start;gap:16px">' + ringChart(wpct, 'Weekly target') + '<div class="small muted" style="flex:1">' + (wpct == null ? 'Set a weekly minutes target in Profile to track completion.' : wpct + '% of this week\'s target complete.') + '</div></div></section>' +
    '<section class="panel"><div class="phead"><div><h3>Readiness</h3><div class="sub">Check in once a day</div></div></div>' +
    (rd ? '<div class="small">Sleep ' + rd.sleep + '/5 · Soreness ' + rd.soreness + '/5 · Energy ' + rd.energy + '/5</div>' : '') +
    '<form data-form="readiness" class="grid" style="gap:8px;margin-top:8px"><div class="grid g3" style="gap:8px">' +
    selectField('rd-sleep', 'Sleep', [1, 2, 3, 4, 5], rd ? rd.sleep : 3) + selectField('rd-sore', 'Soreness', [1, 2, 3, 4, 5], rd ? rd.soreness : 2) + selectField('rd-energy', 'Energy', [1, 2, 3, 4, 5], rd ? rd.energy : 3) +
    '</div><button class="btn sm" type="submit">' + (rd ? 'Update check-in' : 'Save check-in') + '</button></form></section>' +
    '<section class="panel"><div class="phead"><div><h3>Training load</h3><div class="sub">Last 7 days against your 4-week average</div></div><span class="tag ' + wlTone + '">' + wlText + '</span></div>' +
    '<div class="small">Last 7 days: ' + fmtMin(wl.acute) + '</div><div class="small muted">Weekly average, prior 4 weeks: ' + fmtMin(wl.chronic / 1) + '</div>' +
    '<div class="note" style="margin-top:10px">' + (wl.state === 'high' ? 'Load is spiking. Keep the next session light.' : wl.state === 'low' ? 'Load has dropped. Rebuild with a focused session.' : wl.state === 'none' ? 'Log sessions to see your workload ratio.' : wl.state === 'building' ? 'Need about 3 weeks of logs for a stable comparison.' : 'Load is in a sustainable range.') + '</div></section></div>' +
    '<div class="grid g2" style="margin-bottom:14px">' +
    '<section class="panel"><div class="phead"><div><h3>Skill progress</h3><div class="sub">Minutes by skill, last 14 days</div></div></div>' +
    (AREAS.some(function (a) { return areas[a] > 0; }) ? '<div class="list">' + AREAS.map(function (a) { return '<div class="li"><div class="main"><div class="row" style="justify-content:space-between"><span>' + a + '</span><span class="tiny num">' + fmtMin(areas[a]) + '</span></div><div class="bar" style="margin-top:6px"><i style="width:' + Math.round((areas[a] / maxArea) * 100) + '%"></i></div></div></div>'; }).join('') + '</div>' : empty('No skill minutes yet', 'Log a session and each skill area fills in here.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Training days</h3><div class="sub">Last 14 days, darker means more minutes</div></div></div>' + heatCells(days) + '<div class="small" style="margin-top:12px">' + (priorityGap() ? 'Least trained priority: <b>' + priorityGap().area + '</b>' : 'Set priorities in Development') + '</div></section></div>' +
    '<div class="grid g2" style="margin-bottom:14px">' +
    '<section class="panel"><div class="phead"><div><h3>Upcoming</h3><div class="sub">From your plan</div></div><a class="btn sm" href="#plan">Open plan</a></div>' +
    (upcoming.length ? '<div class="list">' + upcoming.map(function (p) { return '<div class="li"><div class="main"><b>' + esc(p.title) + '</b><div class="tiny">' + fmtDay(p.date) + ' · ' + (PLAN_TYPES[p.type] || p.type) + ' · ' + fmtMin(p.minutes || 0) + '</div></div><span class="tag">' + (PLAN_TYPES[p.type] || 'Plan') + '</span></div>'; }).join('') + '</div>' : empty('Nothing planned', 'Add practices, games and workouts in Plan. They appear here in date order.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Recent sessions</h3><div class="sub">Latest first</div></div><a class="btn sm" href="#analytics">Analytics</a></div>' +
    (recent.length ? '<div class="list">' + recent.map(function (s) { const tt = sessionTotals(s); return '<a class="tapwrap" href="#session-' + s.id + '"><div class="main"><b>' + esc(s.workoutName) + '</b><div class="tiny">' + fmtDay(s.date) + ' · ' + fmtMin(s.minutes) + (tt.att ? ' · ' + tt.made + '/' + tt.att + ' (' + tt.pct + '%)' : '') + '</div></div><span class="tag ' + (s.completionPct >= 100 ? 'g' : 'w') + '">' + s.completionPct + '%</span></a>'; }).join('') + '</div>' : empty('No sessions logged', 'Finish a workout and it appears here.')) + '</section></div>' +
    '<div class="grid g3" style="margin-bottom:14px">' +
    '<section class="panel"><div class="phead"><div><h3>Priority focus</h3><div class="sub">Ranked by your development plan</div></div></div>' + S.priorities.filter(function (p) { return p.status === 'active'; }).slice(0, 4).map(function (p) { return '<div class="li"><div class="main"><b>' + esc(p.area) + '</b><div class="tiny">' + (p.assessment ? esc(p.assessment) : 'Assess in Development') + '</div></div><span class="tag">' + (p.targetValue ? 'Goal ' + p.targetValue + '%' : 'No target') + '</span></div>'; }).join('') + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Records</h3><div class="sub">Personal bests and milestones</div></div></div>' +
    (pr.length || ms.length ? '<div class="list">' + pr.map(function (r) { return '<div class="li"><div class="main"><b>' + esc(r.title) + '</b><div class="tiny">' + esc(r.detail) + ' · ' + fmtDay(r.date) + '</div></div><span class="tag g">PR</span></div>'; }).join('') + ms.map(function (id) { const m = MILESTONES.find(function (x) { return x.id === id; }); return m ? '<div class="li"><div class="main"><b>' + esc(m.label) + '</b></div><span class="tag p">Milestone</span></div>' : ''; }).join('') + '</div>' : empty('No records yet', 'A new personal best or a milestone appears here after a session with recorded makes.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Goals</h3><div class="sub">Tracked from recorded data</div></div><a class="btn sm" href="#more">Manage</a></div>' +
    (goals.length ? '<div class="list">' + goals.map(function (g) { const pr2 = goalProgress(g); return '<div class="li"><div class="main"><div class="row" style="justify-content:space-between"><b>' + esc(g.label || GOAL_TYPES[g.type].label) + '</b><span class="tiny num">' + (pr2.current == null ? 'no data' : pr2.current + ' / ' + g.target) + '</span></div><div class="bar" style="margin-top:6px"><i style="width:' + (pr2.pct || 0) + '%"></i></div></div></div>'; }).join('') + '</div>' : empty('No goals set', 'Add a weekly goal in Development. Progress updates from logged sessions.')) + '</section></div>' +
    '<section class="panel" style="margin-bottom:14px"><div class="phead"><div><h3>Weekly volume</h3><div class="sub">Minutes trained, last 8 weeks</div></div></div>' + weeklyMinutesChart(8) + '</section>';
}
function selectField(id, label, opts, val) {
  return '<div class="fld"><label class="f" for="' + id + '">' + label + '</label><select id="' + id + '" name="' + id + '">' + opts.map(function (o) { return '<option value="' + o + '"' + (+o === +val ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>';
}
function weeklyMinutesChart(n) {
  const t = today();
  const first = weekStart(t);
  const bars = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = addDays(first, -7 * i), b = addDays(a, 6);
    const m = rangeMinutes(a, b);
    bars.push({ k: fmtDay(a, { month: 'short', day: 'numeric' }), v: m, now: i === 0, title: fmtDay(a) + ' week: ' + fmtMin(m), label: m ? fmtMin(m) : '' });
  }
  if (!bars.some(function (b) { return b.v > 0; })) return empty('No minutes logged in the last 8 weeks', 'Charts fill in from completed sessions.');
  return barChart(bars, { label: 'Minutes per week' });
}

/* ---------- TRAIN ---------- */
function viewTrain() {
  const tab = UI.trainTab || 'hub';
  const hubBody = trainHub();
  const workouts = S.workouts.slice().sort(function (a, b) { return (a.template === b.template) ? a.name.localeCompare(b.name) : (a.template ? 1 : -1); });
  return pageHead('Train', 'Workouts and sessions', '<div class="btns"><a class="btn" href="#workout-new">New workout</a><button class="btn b" data-a="open-builder">Build a session</button></div>') +
    (S.run ? '<div class="panel warn" style="margin-bottom:14px"><div class="row"><div><b>Workout in progress: ' + esc(S.run.name) + '</b><div class="tiny">' + S.run.items.filter(function (i) { return i.status === 'done'; }).length + ' of ' + S.run.items.length + ' drills complete</div></div><button class="btn p" data-a="run-resume">Resume</button></div></div>' : '') +
    '<div class="grid g2">' +
    '<section class="panel"><div class="phead"><div><h3>Quick start</h3><div class="sub">Use a template or your own saved workout</div></div></div>' +
    (workouts.length ? '<div class="list">' + workouts.map(function (w) { return '<div class="li"><div class="main"><div class="row s" style="gap:8px"><b>' + esc(w.name) + '</b>' + (w.template ? '<span class="tag">Template</span>' : '<span class="tag p">Custom</span>') + '</div><div class="tiny">' + (CAT_SHORT[w.category] || '') + ' · ' + w.minutes + ' min · ' + (w.items || []).length + ' drills · ' + esc(w.objective || '') + '</div></div><div class="btns"><button class="btn sm p" data-a="start-template" data-id="' + w.id + '">Start</button><a class="btn sm" href="#workout-' + w.id + '">Edit</a></div></div>'; }).join('') + '</div>' : empty('No workouts', 'Create one with New workout.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Build a session</h3><div class="sub">Describe what you want. The builder picks drills and sizes the session.</div></div></div>' +
    builderForm() + '</section></div>' +
    '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Recent workouts</h3><div class="sub">Completed sessions</div></div><a class="btn sm" href="#analytics">All analytics</a></div>' +
    (S.sessions.length ? '<div class="list">' + S.sessions.slice().sort(function (a, b) { return b.endedAt - a.endedAt; }).slice(0, 6).map(function (s) { return '<a class="tapwrap" href="#session-' + s.id + '"><div class="main"><b>' + esc(s.workoutName) + '</b><div class="tiny">' + fmtDay(s.date) + ' · ' + fmtMin(s.minutes) + ' · RPE ' + (s.rpe || '–') + '</div></div><span class="tag ' + (s.completionPct >= 100 ? 'g' : 'w') + '">' + s.completionPct + '%</span></a>'; }).join('') + '</div>' : empty('No sessions yet', 'Start a workout. Each completed run is saved here with its drills, sets and makes.')) + '</section>' +
    (tab === 'hub' ? '' : '');
}
function trainHub() { return ''; }
function builderForm() {
  const b = UI.builder || { text: '', minutes: 30, area: '', partner: false, hard: false };
  return '<form data-form="builder" class="grid" style="gap:10px">' +
    '<div class="fld"><label class="f" for="bd-text">Describe the session</label><input id="bd-text" name="text" value="' + esc(b.text) + '" placeholder="e.g. 40 min shooting, challenging"></div>' +
    '<div class="grid g2" style="gap:10px"><div class="fld"><label class="f" for="bd-min">Minutes</label><select id="bd-min" name="minutes">' + DURATIONS.concat([90]).map(function (m) { return '<option value="' + m + '"' + (m === +b.minutes ? ' selected' : '') + '>' + m + ' min</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label class="f" for="bd-area">Focus</label><select id="bd-area" name="area"><option value="">Auto</option>' + AREAS.map(function (a) { return '<option' + (a === b.area ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="row s" style="gap:16px"><label class="check"><input type="checkbox" name="hard"' + (b.hard ? ' checked' : '') + '> Harder drills</label><label class="check"><input type="checkbox" name="partner"' + (b.partner ? ' checked' : '') + '> Include partner drills</label></div>' +
    '<div class="btns"><button class="btn b" type="submit">Build session</button></div></form>' + builderPreview();
}
function builderPreview() {
  const b = UI.builder;
  if (!b || !b.draft) return '';
  const d = b.draft;
  return '<div class="panel" style="margin-top:12px;padding:14px"><div class="phead"><div><h3>' + esc(d.name) + '</h3><div class="sub">' + d.minutes + ' min · ' + d.items.length + ' drills</div></div></div>' +
    (d.items.length ? '<div class="list">' + d.items.map(function (i) { return '<div class="li"><div class="main"><b>' + esc(i.name) + '</b><div class="tiny">' + i.category + ' · ' + (i.metric === 'makes' ? (i.targetSets + ' × ' + i.targetAttempts + ' attempts') : (i.targetSets + ' × ' + i.targetAttempts + ' reps')) + '</div></div></div>'; }).join('') + '</div>' : empty('No drills match', 'Remove the focus or allow partner drills.')) +
    '<div class="btns" style="margin-top:12px"><button class="btn p" data-a="builder-start"' + (d.items.length ? '' : ' disabled') + '>Start now</button><button class="btn" data-a="builder-save"' + (d.items.length ? '' : ' disabled') + '>Save as workout</button></div></div>';
}

/* ---------- LIBRARY ---------- */
function filteredDrills() {
  const q = UI.q.trim().toLowerCase();
  return allDrills().filter(function (d) {
    if (UI.cat !== 'all' && d.category !== UI.cat) return false;
    if (UI.fav && !d.favorite) return false;
    if (UI.custom && !d.custom) return false;
    if (UI.diff && d.difficulty !== UI.diff) return false;
    if (q && (d.name + ' ' + d.objective + ' ' + d.category + ' ' + (d.equipment || []).join(' ')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function viewLibrary() {
  const list = filteredDrills();
  return pageHead('Drill library', 'Library', '<a class="btn b" href="#drill-new">Add custom drill</a>') +
    '<section class="panel" style="margin-bottom:14px"><div class="grid g3" style="gap:10px">' +
    '<div class="fld"><label class="f" for="lib-q">Search</label><input id="lib-q" data-c="lib-q" value="' + esc(UI.q) + '" placeholder="Name, skill or equipment"></div>' +
    '<div class="fld"><label class="f" for="lib-diff">Difficulty</label><select id="lib-diff" data-c="lib-diff"><option value="0">All levels</option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (UI.diff === n ? ' selected' : '') + '>Level ' + n + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label class="f">Show</label><div class="chips"><button class="chip' + (UI.fav ? ' on' : '') + '" data-a="lib-fav">Favorites</button><button class="chip' + (UI.custom ? ' on' : '') + '" data-a="lib-custom">Custom</button></div></div></div>' +
    '<div class="chips" style="margin-top:12px">' + ['all'].concat(AREAS.filter(function (a) { return a !== 'Conditioning' && a !== 'Movement' ? true : true; })).map(function (c) { return '<button class="chip' + (UI.cat === c ? ' on' : '') + '" data-a="lib-cat" data-id="' + c + '">' + (c === 'all' ? 'All skills' : c) + '</button>'; }).join('') + '</div></section>' +
    '<div class="tiny" style="margin-bottom:8px">' + list.length + ' drill' + (list.length === 1 ? '' : 's') + '</div>' +
    (list.length ? '<div class="grid g2">' + list.map(drillCard).join('') + '</div>' : empty('No drills match these filters', 'Clear a filter, or add a custom drill with the button above.'));
}
function drillCard(d) {
  return '<div class="panel" style="padding:14px"><div class="row" style="align-items:flex-start;justify-content:space-between"><div style="min-width:0"><a href="#drill-' + d.id + '" style="text-decoration:none"><h3 style="font-size:19px">' + esc(d.name) + '</h3></a><div class="btns" style="margin-top:6px"><span class="tag p">' + esc(d.category) + '</span><span class="tag">Level ' + d.difficulty + '</span><span class="tag">' + d.minutes + ' min</span>' + (d.partner ? '<span class="tag o">Partner</span>' : '<span class="tag g">Solo</span>') + (d.custom ? '<span class="tag i">Custom</span>' : '') + '</div></div><button class="btn xs ' + (d.favorite ? 'p' : '') + '" data-a="fav" data-id="' + d.id + '" aria-pressed="' + (d.favorite ? 'true' : 'false') + '">' + (d.favorite ? 'Favorite' : 'Favorite?') + '</button></div><p class="small muted" style="margin-top:8px">' + esc(d.objective) + '</p><div class="tiny">' + setsLabel(d) + '</div></div>';
}
function viewDrill(id) {
  const d = drillById(id);
  if (!d) return empty('Drill not found', 'It may have been deleted.', '<a class="btn" href="#library">Back to library</a>');
  const u = drillUsage(id);
  const hist = S.sessions.filter(function (s) { return s.items.some(function (i) { return i.drillId === id; }); }).sort(function (a, b) { return b.endedAt - a.endedAt; }).slice(0, 8);
  const best = bestMakesFor(id);
  return '<a class="crumb" href="#library">← Library</a>' + pageHead((d.category) + ' · level ' + d.difficulty, esc(d.name), '<div class="btns">' + (d.custom ? '<a class="btn" href="#drilledit-' + d.id + '">Edit</a>' : '') + '<button class="btn ' + (d.favorite ? 'p' : '') + '" data-a="fav" data-id="' + d.id + '">' + (d.favorite ? 'Favorited' : 'Favorite') + '</button><button class="btn b" data-a="drill-start" data-id="' + d.id + '">Run this drill</button></div>') +
    '<div class="grid g2"><section class="panel"><h3>Objective</h3><p>' + esc(d.objective) + '</p><div class="hr"></div><h4>Instructions</h4><p>' + esc(d.instructions || 'No written instructions.') + '</p>' +
    '<div class="hr"></div><div class="grid g2" style="gap:10px"><div><h4>Prescription</h4><div class="small">' + setsLabel(d) + ' · ' + d.minutes + ' min</div><div class="small muted">Metric: ' + (d.metric === 'makes' ? 'attempts and makes' : 'good reps') + '</div></div><div><h4>Equipment</h4><div class="small">' + esc((d.equipment || []).join(', ') || 'None') + '</div><div class="small muted">Zone: ' + esc(d.zone || 'Not tied to a zone') + '</div></div></div></section>' +
    '<section class="panel"><h3>Coaching points</h3>' + listOrEmpty(d.coaching, 'None written yet') + '<div class="hr"></div><h4>Common mistakes</h4>' + listOrEmpty(d.mistakes, 'None written yet') + '</section>' +
    '<section class="panel"><h3>Progressions</h3>' + listOrEmpty(d.progressions, 'None written yet') + '<h4 style="margin-top:12px">Regressions</h4>' + listOrEmpty(d.regressions, 'None written yet') + '</section>' +
    '<section class="panel"><h3>Variations</h3><h4>Solo</h4><p class="small">' + esc(d.soloVariant || 'No solo version written.') + '</p><h4 style="margin-top:12px">Partner</h4><p class="small">' + esc(d.partnerVariant || (d.partner ? 'This drill needs a partner.' : 'No partner version.')) + '</p></section>' +
    '<section class="panel" style="grid-column:1/-1"><div class="phead"><div><h3>Drill history</h3><div class="sub">' + u.sessions + ' session' + (u.sessions === 1 ? '' : 's') + (u.lastDay ? ' · last ' + fmtDay(u.lastDay) : '') + (best ? ' · best ' + best.made + ' makes' : '') + '</div></div></div>' +
    (hist.length ? '<div class="list">' + hist.map(function (s) { const it = s.items.find(function (x) { return x.drillId === id; }); const tt = itemTotals(it); return '<a class="tapwrap" href="#session-' + s.id + '"><div class="main"><b>' + fmtDay(s.date) + '</b><div class="tiny">' + (tt.att ? tt.made + ' of ' + tt.att + ' (' + tt.pct + '%)' : tt.reps + ' reps · ' + tt.good + ' good') + '</div></div><span class="tag ' + (it.status === 'done' ? 'g' : 'w') + '">' + it.status + '</span></a>'; }).join('') + '</div>' : empty('No history yet', 'Sessions that include this drill appear here.')) + '</section></div>';
}
function listOrEmpty(arr, msg) { return arr && arr.length ? '<ul class="small">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="small muted">' + msg + '</p>'; }
function viewDrillEdit(id) {
  const d = id ? S.customDrills.find(function (x) { return x.id === id; }) : null;
  const v = d || { name: '', category: 'Shooting', difficulty: 2, minutes: 10, sets: 3, attempts: 10, metric: 'makes', zone: '', partner: false, objective: '', instructions: '', coaching: [], mistakes: [], progressions: [], regressions: [], equipment: ['Ball', 'Hoop'], soloVariant: '', partnerVariant: '' };
  return '<a class="crumb" href="' + (d ? '#drill-' + d.id : '#library') + '">← Back</a>' + pageHead('Custom drill', d ? 'Edit drill' : 'New drill', '') +
    '<form data-form="drill" data-id="' + (d ? d.id : '') + '" class="panel grid" style="gap:12px;max-width:820px">' +
    '<div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="cd-name">Name</label><input id="cd-name" name="name" required value="' + esc(v.name) + '"></div>' +
    '<div class="fld"><label class="f" for="cd-cat">Skill</label><select id="cd-cat" name="category">' + AREAS.map(function (a) { return '<option' + (a === v.category ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="grid g3" style="gap:12px">' + selectField('cd-diff', 'Difficulty (1–5)', [1, 2, 3, 4, 5], v.difficulty) + selectField('cd-min', 'Minutes', DURATIONS, v.minutes) + '<div class="fld"><label class="f" for="cd-metric">Tracks</label><select id="cd-metric" name="metric"><option value="makes"' + (v.metric === 'makes' ? ' selected' : '') + '>Attempts and makes</option><option value="reps"' + (v.metric === 'reps' ? ' selected' : '') + '>Good reps</option></select></div></div>' +
    '<div class="grid g3" style="gap:12px">' + selectField('cd-sets', 'Sets', [1, 2, 3, 4, 5, 6], v.sets) + '<div class="fld"><label class="f" for="cd-att">Attempts or reps per set</label><input id="cd-att" name="attempts" type="number" min="1" max="200" value="' + v.attempts + '"></div><div class="fld"><label class="f" for="cd-zone">Shot zone</label><select id="cd-zone" name="zone"><option value="">None</option>' + ZONES.map(function (z) { return '<option' + (z === v.zone ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="fld"><label class="f" for="cd-obj">Objective</label><input id="cd-obj" name="objective" value="' + esc(v.objective) + '"></div>' +
    '<div class="fld"><label class="f" for="cd-ins">Instructions</label><textarea id="cd-ins" name="instructions">' + esc(v.instructions) + '</textarea></div>' +
    '<div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="cd-coach">Coaching points (one per line)</label><textarea id="cd-coach" name="coaching">' + esc(v.coaching.join('\n')) + '</textarea></div><div class="fld"><label class="f" for="cd-mist">Common mistakes (one per line)</label><textarea id="cd-mist" name="mistakes">' + esc(v.mistakes.join('\n')) + '</textarea></div></div>' +
    '<div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="cd-prog">Progressions (one per line)</label><textarea id="cd-prog" name="progressions">' + esc(v.progressions.join('\n')) + '</textarea></div><div class="fld"><label class="f" for="cd-reg">Regressions (one per line)</label><textarea id="cd-reg" name="regressions">' + esc(v.regressions.join('\n')) + '</textarea></div></div>' +
    '<div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="cd-solo">Solo variation</label><textarea id="cd-solo" name="soloVariant">' + esc(v.soloVariant) + '</textarea></div><div class="fld"><label class="f" for="cd-pv">Partner variation</label><textarea id="cd-pv" name="partnerVariant">' + esc(v.partnerVariant || '') + '</textarea></div></div>' +
    '<label class="check"><input type="checkbox" name="partner"' + (v.partner ? ' checked' : '') + '> This drill needs a partner</label>' +
    '<div class="btns"><button class="btn p" type="submit">Save drill</button>' + (d ? '<button class="btn d" type="button" data-a="drill-delete" data-id="' + d.id + '">Delete drill</button>' : '') + '</div></form>';
}
function linesOf(s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }

/* ---------- WORKOUT EDITOR ---------- */
function viewWorkoutEdit(id) {
  const w = id ? S.workouts.find(function (x) { return x.id === id; }) : null;
  const draft = UI.editWorkout && (!w || UI.editWorkout.id === w.id) ? UI.editWorkout : (w ? JSON.parse(JSON.stringify(w)) : { id: 'w-' + uid(), name: '', category: 'focused', objective: 'Shooting', minutes: 30, difficulty: 3, items: [], notes: '', custom: true });
  UI.editWorkout = draft;
  const pool = allDrills();
  return '<a class="crumb" href="#train">← Train</a>' + pageHead('Workout', w ? 'Edit workout' : 'New workout', '') +
    '<section class="panel grid" style="gap:12px;margin-bottom:14px"><div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="ww-name">Name</label><input id="ww-name" data-c="ww-field" data-k="name" value="' + esc(draft.name) + '" placeholder="e.g. Friday shooting"></div>' +
    '<div class="fld"><label class="f" for="ww-cat">Type</label><select id="ww-cat" data-c="ww-field" data-k="category">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (k === draft.category ? ' selected' : '') + '>' + CATS[k] + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="grid g3" style="gap:12px">' + selectField('ww-min', 'Target minutes', DURATIONS.concat([90]), draft.minutes) + '<div class="fld"><label class="f" for="ww-obj">Objective</label><select id="ww-obj" data-c="ww-field" data-k="objective">' + AREAS.map(function (a) { return '<option' + (a === draft.objective ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>' + selectField('ww-diff', 'Difficulty', [1, 2, 3, 4, 5], draft.difficulty) + '</div></section>' +
    '<section class="panel" style="margin-bottom:14px"><div class="phead"><div><h3>Drills in order</h3><div class="sub">' + draft.items.length + ' drill' + (draft.items.length === 1 ? '' : 's') + ' · total ' + fmtMin(sum(draft.items, function (i) { const d = drillById(i.drillId); return d ? d.minutes : 0; })) + ' planned</div></div></div>' +
    (draft.items.length ? '<div class="list">' + draft.items.map(function (it, idx) { return '<div class="li" style="flex-wrap:wrap"><div class="main" style="min-width:180px"><b>' + (idx + 1) + '. ' + esc(it.name) + '</b><div class="tiny">' + esc(it.category) + '</div></div><label class="tiny">Sets <input style="width:70px;display:inline-block;min-height:36px" type="number" min="1" max="10" value="' + it.targetSets + '" data-c="ww-item" data-i="' + idx + '" data-k="targetSets"></label><label class="tiny">' + (it.metric === 'makes' ? 'Attempts' : 'Reps') + ' <input style="width:80px;display:inline-block;min-height:36px" type="number" min="1" max="200" value="' + it.targetAttempts + '" data-c="ww-item" data-i="' + idx + '" data-k="targetAttempts"></label><div class="btns"><button class="btn xs" data-a="ww-up" data-i="' + idx + '"' + (idx === 0 ? ' disabled' : '') + '>Up</button><button class="btn xs" data-a="ww-down" data-i="' + idx + '"' + (idx === draft.items.length - 1 ? ' disabled' : '') + '>Down</button><button class="btn xs d" data-a="ww-remove" data-i="' + idx + '">Remove</button></div></div>'; }).join('') + '</div>' : empty('No drills yet', 'Add drills from the list below.')) +
    '<div class="hr"></div><div class="fld"><label class="f" for="ww-add">Add a drill</label><select id="ww-add" data-c="ww-add">' + '<option value="">Choose a drill…</option>' + pool.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + ' (' + esc(d.category) + ', ' + d.minutes + ' min' + (d.partner ? ', partner' : '') + ')</option>'; }).join('') + '</select></div></section>' +
    '<div class="btns"><button class="btn p" data-a="ww-save">Save workout</button><button class="btn" data-a="ww-start">Start now</button>' + (w ? '<button class="btn d" data-a="ww-delete" data-id="' + w.id + '">Delete</button>' : '') + '</div>';
}

/* ---------- SESSION DETAIL ---------- */
function viewSession(id) {
  const s = S.sessions.find(function (x) { return x.id === id; });
  if (!s) return empty('Session not found', 'It may have been removed.', '<a class="btn" href="#train">Back to train</a>');
  const t = sessionTotals(s);
  const prs = S.prSeen.filter(function (r) { return r.id && r.id.indexOf('pr-' + s.id + '-') === 0; });
  return '<a class="crumb" href="#train">← Train</a>' + pageHead(fmtDay(s.date, { weekday: 'long', month: 'long', day: 'numeric' }), esc(s.workoutName), '') +
    '<div class="grid g4" style="margin-bottom:14px">' + kpi(fmtMin(s.minutes), 'Duration') + kpi(s.completionPct + '%', 'Complete') + kpi(fmtPct(t.pct), 'Shooting', '', t.att ? t.made + ' of ' + t.att : 'No attempts') + kpi(s.rpe || '–', 'RPE', '', s.location || '') + '</div>' +
    (prs.length ? '<div class="note" style="margin-bottom:14px;border-color:#24553f;color:#b5f0d6">New personal bests: ' + prs.map(function (r) { return esc(r.title); }).join(', ') + '</div>' : '') +
    '<section class="panel"><div class="phead"><div><h3>Drills</h3><div class="sub">' + s.items.filter(function (i) { return i.status === 'done'; }).length + ' of ' + s.items.length + ' complete</div></div></div>' +
    '<div class="scroll"><table class="tbl"><thead><tr><th>Drill</th><th>Status</th><th class="n">Sets</th><th class="n">Makes/Att</th><th class="n">%</th></tr></thead><tbody>' +
    s.items.map(function (i) { const tt = itemTotals(i); return '<tr><td>' + drillLink(i.drillId, i.name) + '</td><td><span class="tag ' + (i.status === 'done' ? 'g' : i.status === 'partial' ? 'w' : '') + '">' + i.status + '</span></td><td class="n">' + i.sets.length + '</td><td class="n">' + (tt.att ? tt.made + '/' + tt.att : tt.reps + ' reps') + '</td><td class="n">' + fmtPct(tt.pct) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' + (s.notes ? '<div class="hr"></div><p class="small">' + esc(s.notes) + '</p>' : '') + '</section>';
}

/* ---------- PLAN ---------- */
function viewPlan() {
  const mode = UI.calMode, anchor = anchorDay(), sel = selDay();
  const head = '<div class="btns"><div class="seg" role="tablist"><button class="' + (mode === 'week' ? 'on' : '') + '" data-a="cal-mode" data-id="week">Week</button><button class="' + (mode === 'month' ? 'on' : '') + '" data-a="cal-mode" data-id="month">Month</button></div><button class="btn sm" data-a="cal-prev">‹ Prev</button><button class="btn sm" data-a="cal-today">Today</button><button class="btn sm" data-a="cal-next">Next ›</button><button class="btn b" data-a="plan-add" data-id="' + sel + '">Add to plan</button></div>';
  return pageHead('Plan', mode === 'week' ? 'Week of ' + fmtDay(weekStart(anchor), { month: 'short', day: 'numeric' }) : monthTitle(anchor), head) +
    (mode === 'week' ? planWeek(anchor) : planMonth(anchor)) + planDayPanel(sel);
}
function monthTitle(k) { return keyDate(k).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function eventHtml(p) {
  const st = planState(p);
  return '<button class="evt ' + st + ' draggable" draggable="true" data-drag="' + p.id + '" data-a="plan-edit" data-id="' + p.id + '" title="' + esc(p.title) + '">' + esc(p.title) + '</button>';
}
function doneHtml(s) {
  return '<a class="evt done" href="#session-' + s.id + '" title="' + esc(s.workoutName) + '">' + esc(s.workoutName) + '</a>';
}
function dayCellsHtml(day, compact) {
  const a = dayAgg(day);
  const items = a.planned.map(eventHtml).concat(a.sessions.map(doneHtml));
  const shown = compact ? items.slice(0, 3) : items;
  const more = items.length - shown.length;
  return shown.join('') + (more > 0 ? '<span class="evt more">+' + more + ' more</span>' : '');
}
function planWeek(anchor) {
  const first = weekStart(anchor);
  const t = today();
  let cols = '';
  let plannedTotal = 0, doneTotal = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(first, i);
    const a = dayAgg(day);
    plannedTotal += a.plannedMin; doneTotal += a.doneMin;
    cols += '<div class="wcol"><div class="wh"><span class="small"><b>' + fmtDay(day, { weekday: 'short' }) + '</b> <span class="tiny">' + keyDate(day).getDate() + '</span></span><span class="tiny num">' + (a.doneMin ? fmtMin(a.doneMin) : '') + '</span></div>' +
      '<button class="dz' + (day === t ? ' today' : '') + (UI.dragOver === day ? ' over' : '') + '" data-drop="' + day + '" data-a="cal-day" data-id="' + day + '">' + dayCellsHtml(day, false) + (!a.planned.length && !a.sessions.length ? '<span class="tiny muted">Nothing yet. Drop items here or tap Add.</span>' : '') + '</button></div>';
  }
  const doneWeek = sum(rangeSessions(first, addDays(first, 6)), function (s) { return s.minutes || 0; });
  return '<section class="panel" style="margin-bottom:14px"><div class="grid g4" style="margin-bottom:12px">' + kpi(fmtMin(plannedTotal), 'Planned this week') + kpi(fmtMin(doneWeek), 'Completed') + kpi(plannedTotal ? Math.round((doneWeek / (plannedTotal + doneWeek || 1)) * 100) + '%' : '–', 'Done vs planned') + kpi(S.plan.filter(function (p) { return p.date >= first && p.date <= addDays(first, 6) && p.status === 'done'; }).length, 'Items finished') + '</div>' +
    '<div class="grid" style="grid-template-columns:repeat(7,minmax(0,1fr));gap:8px">' + cols + '</div><p class="tiny" style="margin-top:10px">Drag items between days on desktop, or open an item and change its date on touch screens. Completed workouts appear automatically.</p></section>';
}
function planMonth(anchor) {
  const [a, b] = monthRange(anchor);
  const startDow = (keyDate(a).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div></div>');
  const t = today(), days = daysBetween(a, b) + 1;
  for (let i = 0; i < days; i++) {
    const day = addDays(a, i);
    cells.push('<button class="dcell' + (day === t ? ' today' : '') + (day === selDay() ? ' sel' : '') + '" data-drop="' + day + '" data-a="cal-day" data-id="' + day + '"><span class="dn">' + (i + 1) + '</span>' + dayCellsHtml(day, true) + '</button>');
  }
  const hd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<div class="hd">' + x + '</div>'; }).join('');
  return '<section class="panel" style="margin-bottom:14px"><div class="mcal">' + hd + cells.join('') + '</div><p class="tiny" style="margin-top:10px">Tap a day to see details. Dots and labels show planned items (solid) and completed sessions (faded).</p></section>';
}
function planDayPanel(day) {
  const a = dayAgg(day);
  return '<section class="panel"><div class="phead"><div><h3>' + fmtDay(day, { weekday: 'long', month: 'long', day: 'numeric' }) + '</h3><div class="sub">' + (a.plannedMin ? fmtMin(a.plannedMin) + ' planned' : 'Nothing planned') + (a.doneMin ? ' · ' + fmtMin(a.doneMin) + ' done' : '') + '</div></div><button class="btn sm b" data-a="plan-add" data-id="' + day + '">Add</button></div>' +
    (a.planned.length || a.sessions.length ? '<div class="list">' + a.planned.map(function (p) { return '<div class="li"><div class="main"><b>' + esc(p.title) + '</b><div class="tiny">' + (PLAN_TYPES[p.type] || p.type) + ' · ' + fmtMin(p.minutes || 0) + ' · ' + planState(p) + '</div></div><div class="btns">' + (p.workoutId ? '<button class="btn xs p" data-a="plan-start" data-id="' + p.id + '">Start</button>' : '') + '<button class="btn xs" data-a="plan-edit" data-id="' + p.id + '">Edit</button></div></div>'; }).join('') + a.sessions.map(function (s) { return '<a class="tapwrap" href="#session-' + s.id + '"><div class="main"><b>' + esc(s.workoutName) + '</b><div class="tiny">Completed · ' + fmtMin(s.minutes) + '</div></div><span class="tag g">Done</span></a>'; }).join('') + '</div>' : empty('Nothing on this day', 'Add a practice, game, rest day or workout.')) + '</section>';
}

/* ---------- ANALYTICS ---------- */
function viewAnalytics() {
  const t = today();
  const n = UI.range || 7;
  const from = addDays(t, -(n - 1));
  const ss = rangeSessions(from, t);
  const sh = shootingSummary(from, t);
  const minutes = sum(ss, function (s) { return s.minutes || 0; });
  const zones = {};
  ss.forEach(function (s) { const z = sessionTotals(s).zones; Object.keys(z).forEach(function (k) { zones[k] = zones[k] || { att: 0, made: 0 }; zones[k].att += z[k].att; zones[k].made += z[k].made; }); });
  const pts = [];
  for (let k = from; k <= t; k = addDays(k, 1)) { const x = shootingSummary(k, k); pts.push({ x: fmtDay(k, { month: 'numeric', day: 'numeric' }), y: x.pct, title: fmtDay(k) + ': ' + (x.att ? x.made + '/' + x.att + ' (' + x.pct + '%)' : 'no shots') }); }
  const areas = areaMinutes(from, t);
  const maxA = Math.max(1, Math.max.apply(null, AREAS.map(function (a) { return areas[a] || 0; })));
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const a = addDays(weekStart(t), -7 * i), b = addDays(a, 6);
    const wss = rangeSessions(a, b);
    const st = shootingSummary(a, b);
    weeks.push({ k: fmtDay(a, { month: 'numeric', day: 'numeric' }), v: st.att, parts: [{ v: st.made, c: 'var(--brand)', t: 'makes' }, { v: st.att - st.made, c: 'var(--raised)', t: 'misses' }], title: 'Week of ' + fmtDay(a) + ': ' + st.made + '/' + st.att + ' · ' + wss.length + ' sessions', label: st.att ? st.made + '/' + st.att : '' });
  }
  const intensity = [];
  for (let i = 7; i >= 0; i--) {
    const a = addDays(weekStart(t), -7 * i), b = addDays(a, 6);
    const rp = rangeSessions(a, b).filter(function (s) { return s.rpe; });
    intensity.push({ x: fmtDay(a, { month: 'numeric', day: 'numeric' }), y: rp.length ? Math.round(sum(rp, function (s) { return s.rpe; }) / rp.length * 10) / 10 : null, title: 'Avg RPE week of ' + fmtDay(a) });
  }
  const locs = {};
  ss.forEach(function (s) { if (!s.location) return; const st = sessionTotals(s); locs[s.location] = locs[s.location] || { att: 0, made: 0, n: 0 }; locs[s.location].att += st.att; locs[s.location].made += st.made; locs[s.location].n++; });
  const goalRows = S.goals.map(function (g) { const p = goalProgress(g); return '<div class="li"><div class="main"><div class="row" style="justify-content:space-between"><b>' + esc(g.label || GOAL_TYPES[g.type].label) + '</b><span class="tiny num">' + (p.current == null ? 'no data' : p.current + ' / ' + g.target) + '</span></div><div class="bar" style="margin-top:6px"><i style="width:' + (p.pct || 0) + '%"></i></div></div></div>'; }).join('');
  const range = '<div class="seg">' + [7, 30, 90].map(function (d) { return '<button class="' + (UI.range === d ? 'on' : '') + '" data-a="range" data-id="' + d + '">' + d + ' days</button>'; }).join('') + '</div>';
  return pageHead('Analytics', 'Performance', range) +
    '<div class="grid g4" style="margin-bottom:14px">' + kpi(fmtPct(sh.pct), 'Shooting %', '', sh.att ? sh.made + ' of ' + sh.att : 'No attempts') + kpi(sh.att, 'Attempts') + kpi(sh.made, 'Makes') + kpi(fmtMin(minutes), 'Minutes', '', ss.length + ' session' + (ss.length === 1 ? '' : 's')) + '</div>' +
    '<div class="grid g2" style="margin-bottom:14px">' +
    '<section class="panel"><div class="phead"><div><h3>Shooting % over time</h3><div class="sub">Daily, only days with attempts</div></div></div>' + (pts.some(function (p) { return p.y != null; }) ? lineChart(pts, { label: 'Shooting percentage by day', fmt: function (v) { return v + '%'; }, min: 0 }) : empty('No shooting data in this range', 'Log a session with attempts and makes. Each day with shots plots here.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Makes vs attempts</h3><div class="sub">Weekly, last 8 weeks</div></div></div>' + (weeks.some(function (w) { return w.v > 0; }) ? barChart(weeks, { label: 'Makes and attempts per week' }) + '<div class="legend"><span><i style="background:var(--brand)"></i>Makes</span><span><i style="background:var(--raised)"></i>Misses</span></div>' : empty('No attempts in the last 8 weeks', 'Stacked bars show makes and misses once shots are logged.')) + '</section></div>' +
    '<div class="grid g2" style="margin-bottom:14px">' +
    '<section class="panel"><div class="phead"><div><h3>Shot zones</h3><div class="sub">Approximate court map. Set a zone on each set in the runner.</div></div></div>' + (Object.keys(zones).length ? courtSVG(zones) : empty('No zone data yet', 'Choose a zone for each shot set during a workout. Percentages fill in here by zone.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Skill scorecard</h3><div class="sub">Minutes in each skill area</div></div></div>' + (AREAS.some(function (a) { return areas[a] > 0; }) ? '<div class="list">' + AREAS.map(function (a) { return '<div class="li"><div class="main"><div class="row" style="justify-content:space-between"><span>' + a + '</span><span class="tiny num">' + fmtMin(areas[a]) + '</span></div><div class="bar" style="margin-top:6px"><i style="width:' + Math.round((areas[a] / maxA) * 100) + '%"></i></div></div></div>'; }).join('') + '</div>' : empty('No skill minutes yet', 'Minutes are attributed by each drill\'s skill area.')) + '</section></div>' +
    '<div class="grid g2" style="margin-bottom:14px">' +
    '<section class="panel"><div class="phead"><div><h3>Training intensity</h3><div class="sub">Average RPE per week, last 8 weeks</div></div></div>' + (intensity.some(function (p) { return p.y != null; }) ? lineChart(intensity, { label: 'Average RPE by week', min: 0, fmt: function (v) { return Math.round(v); } }) : empty('No RPE logged', 'Rate each session on the finish sheet to see intensity trends.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>By location</h3><div class="sub">Shooting % by where you trained</div></div></div>' + (Object.keys(locs).length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Location</th><th class="n">Sessions</th><th class="n">Makes/Att</th><th class="n">%</th></tr></thead><tbody>' + Object.keys(locs).map(function (k) { const l = locs[k]; return '<tr><td>' + esc(k) + '</td><td class="n">' + l.n + '</td><td class="n">' + l.made + '/' + l.att + '</td><td class="n">' + fmtPct(pct(l.made, l.att)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty('No location data', 'Choose a location when you finish a session.')) + '</section></div>' +
    '<div class="grid g2">' +
    '<section class="panel"><div class="phead"><div><h3>Goals</h3><div class="sub">Progress from recorded data</div></div><a class="btn sm" href="#more">Manage</a></div>' + (goalRows ? '<div class="list">' + goalRows + '</div>' : empty('No goals yet', 'Add a goal in Development to track it here.')) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Records</h3><div class="sub">Personal bests</div></div></div>' + (S.prSeen.length ? '<div class="list">' + S.prSeen.slice().reverse().slice(0, 8).map(function (r) { return '<div class="li"><div class="main"><b>' + esc(r.title) + '</b><div class="tiny">' + esc(r.detail) + ' · ' + fmtDay(r.date) + '</div></div></div>'; }).join('') + '</div>' : empty('No personal bests yet', 'A new best on any drill is recorded here.')) + '</section></div>';
}

/* ---------- DEVELOPMENT ---------- */
function viewDev() {
  const gap = priorityGap();
  return pageHead('Development', 'Priorities & goals', '') +
    '<section class="panel" style="margin-bottom:14px"><div class="phead"><div><h3>Priorities</h3><div class="sub">Assess each area. The builder favors the one you train least.</div></div></div>' +
    '<div class="list">' + S.priorities.map(function (p) { return '<form data-form="priority" data-id="' + p.id + '" class="li" style="flex-wrap:wrap;align-items:flex-start"><div class="main" style="min-width:220px"><div class="row s" style="gap:8px"><b>' + esc(p.area) + '</b>' + (gap && gap.id === p.id ? '<span class="tag o">Least trained</span>' : '') + '</div><div class="tiny">' + p.subskills.slice(0, 4).map(esc).join(' · ') + '</div></div><div class="grid" style="gap:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));min-width:260px;flex:1"><select name="assessment" aria-label="' + esc(p.area) + ' assessment">' + ['', 'Strength', 'Developing', 'Priority'].map(function (o) { return '<option' + (o === p.assessment ? ' selected' : '') + ' value="' + o + '">' + (o || 'Not assessed') + '</option>'; }).join('') + '</select><input name="targetValue" type="number" min="0" max="100" aria-label="' + esc(p.area) + ' target percentage" placeholder="Target %" value="' + esc(p.targetValue) + '"></div><button class="btn xs" type="submit">Save</button></form>'; }).join('') + '</div></section>' +
    '<div class="grid g2"><section class="panel"><div class="phead"><div><h3>Goals</h3><div class="sub">Weekly targets are tracked from sessions</div></div></div>' +
    (S.goals.length ? '<div class="list">' + S.goals.map(function (g) { const p = goalProgress(g); return '<div class="li"><div class="main"><b>' + esc(g.label || GOAL_TYPES[g.type].label) + '</b><div class="tiny">' + (p.current == null ? 'Needs logged data' : p.current + ' of ' + g.target + ' ' + GOAL_TYPES[g.type].unit) + '</div></div><button class="btn xs d" data-a="goal-del" data-id="' + g.id + '">Remove</button></div>'; }).join('') + '</div>' : empty('No goals', 'Set one below.')) +
    '<form data-form="goal" class="grid" style="gap:10px;margin-top:12px;grid-template-columns:1fr 1fr auto;align-items:end"><div class="fld"><label class="f" for="g-type">Goal</label><select id="g-type" name="type">' + Object.keys(GOAL_TYPES).map(function (k) { return '<option value="' + k + '">' + GOAL_TYPES[k].label + '</option>'; }).join('') + '</select></div><div class="fld"><label class="f" for="g-target">Target</label><input id="g-target" name="target" type="number" min="1" required></div><button class="btn p" type="submit">Add goal</button></form></section>' +
    '<section class="panel"><div class="phead"><div><h3>Habits</h3><div class="sub">Daily checks, logged each day</div></div><a class="btn sm" href="#habits">Log habits</a></div>' +
    '<div class="list">' + S.habits.map(function (h) { const v = habitToday(h.id); return '<div class="li"><div class="main"><b>' + esc(h.name) + '</b><div class="tiny">' + esc(h.cat) + ' · ' + v + ' of ' + h.target + ' ' + h.unit + ' today</div></div><div class="bar" style="width:90px"><i style="width:' + Math.min(100, Math.round((v / h.target) * 100)) + '%"></i></div></div>'; }).join('') + '</div></section></div>';
}
function habitToday(id) { return sum(S.habitLog.filter(function (l) { return l.habitId === id && l.date === today(); }), function (l) { return l.value; }); }
function viewHabits() {
  return '<a class="crumb" href="#more">← Development</a>' + pageHead('Habits', 'Daily habits', '') +
    '<section class="panel"><div class="list">' + S.habits.map(function (h) { const v = habitToday(h.id); return '<div class="li"><div class="main"><b>' + esc(h.name) + '</b><div class="tiny">' + esc(h.cat) + ' · target ' + h.target + ' ' + h.unit + '</div></div><div class="btns"><span class="tag ' + (v >= h.target ? 'g' : '') + '">' + v + '/' + h.target + '</span><button class="btn xs" data-a="habit-log" data-id="' + h.id + '" data-d="1">+1</button><button class="btn xs" data-a="habit-log" data-id="' + h.id + '" data-d="5">+5</button><button class="btn xs" data-a="habit-log" data-id="' + h.id + '" data-d="-1">−1</button></div></div>'; }).join('') + '</div></section>';
}
function viewJournal() {
  const entries = S.journal.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
  const tagCounts = {};
  S.journal.forEach(function (j) { (j.tags || []).forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; }); });
  const recurring = Object.keys(tagCounts).filter(function (t) { return tagCounts[t] >= 3; });
  return '<a class="crumb" href="#more">← Development</a>' + pageHead('Practice journal', 'Journal', '') +
    '<section class="panel" style="margin-bottom:14px"><form data-form="journal" class="grid" style="gap:10px"><div class="fld"><label class="f" for="j-text">What happened in practice?</label><textarea id="j-text" name="text" required placeholder="Short notes: what worked, what did not, what to fix"></textarea></div>' +
    '<div><label class="f">Tags</label><div class="chips">' + TAGS.map(function (t) { return '<label class="chip"><input type="checkbox" name="tags" value="' + t.id + '" style="width:16px;min-height:0"> ' + esc(t.label) + '</label>'; }).join('') + '</div></div>' +
    '<div class="btns"><button class="btn p" type="submit">Save entry</button></div></form></section>' +
    (recurring.length ? '<section class="panel" style="margin-bottom:14px"><h3>Recurring patterns</h3><p class="small muted">Tags you have logged three or more times. Target these in your next session.</p><div class="chips">' + recurring.map(function (t) { const tag = TAGS.find(function (x) { return x.id === t; }); return '<span class="tag b">' + esc(tag ? tag.label : t) + ' · ' + tagCounts[t] + '×</span>'; }).join('') + '</div></section>' : '') +
    (entries.length ? '<div class="list">' + entries.slice(0, 30).map(function (j) { return '<div class="li" style="align-items:flex-start"><div class="main"><div class="tiny">' + fmtDay(j.date, { weekday: 'long', month: 'short', day: 'numeric' }) + '</div><p>' + esc(j.text) + '</p><div class="btns">' + (j.tags || []).map(function (t) { const tag = TAGS.find(function (x) { return x.id === t; }); return '<span class="tag">' + esc(tag ? tag.label : t) + '</span>'; }).join('') + '</div></div><button class="btn xs d" data-a="journal-del" data-id="' + j.id + '">Delete</button></div>'; }).join('') + '</div>' : empty('No entries yet', 'Write one after each practice. Tags build the recurring patterns above.'));
}
function viewProfile() {
  const p = S.profile;
  return pageHead('Profile', 'Profile & data', '') +
    '<div class="grid g2"><section class="panel"><h3>Your details</h3><form data-form="profile" class="grid" style="gap:10px;margin-top:10px"><div class="fld"><label class="f" for="p-name">Name</label><input id="p-name" name="name" value="' + esc(p.name) + '"></div>' +
    '<div class="grid g2" style="gap:10px">' + selectField('p-week', 'Weekly target (min)', [120, 180, 240, 300, 360, 420, 480], p.weeklyTarget) + selectField('p-sess', 'Sessions per week', [1, 2, 3, 4, 5, 6, 7], p.sessionTarget) + '</div>' +
    '<div class="fld"><label class="f" for="p-level">Level</label><select id="p-level" name="level">' + LEVELS.map(function (x) { return '<option' + (x === p.level ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label class="f" for="p-env">Usual location</label><select id="p-env" name="env">' + ENVIRONMENTS.map(function (x) { return '<option' + (x === p.env ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
    '<div class="btns"><button class="btn p" type="submit">Save profile</button></div></form></section>' +
    '<section class="panel"><h3>Backup & restore</h3><p class="small muted">Your data saves on this device and to your account when it is available. Export a backup to keep a copy.</p><div class="btns" style="margin:10px 0"><button class="btn" data-a="export">Export backup</button><button class="btn" data-a="copy-backup">Copy backup</button></div><textarea id="backup-text" readonly aria-label="Backup text" style="min-height:120px;font-family:monospace;font-size:12px" placeholder="Export to show your backup here"></textarea><form data-form="restore" class="grid" style="gap:8px;margin-top:12px"><div class="fld"><label class="f" for="restore-text">Restore from backup</label><textarea id="restore-text" name="backup" placeholder="Paste a backup here"></textarea></div><div class="btns"><button class="btn" type="submit">Restore</button></div></form></section></div>';
}

/* ==================== RUNNER ==================== */
function startRun(items, name, workoutId, planId) {
  if (S.run) { toast('Finish or discard the workout in progress first', 'warn'); return false; }
  if (!items.length) { toast('Add at least one drill first', 'warn'); return false; }
  const now = Date.now();
  S.run = {
    id: uid(), name: name || 'Workout', workoutId: workoutId || null, planId: planId || null, startedAt: now, lastTick: now, idx: 0, restEnd: 0, zone: null,
    items: items.map(function (i) { return Object.assign({ status: 'pending', sets: [], reps: 0, goodReps: 0, seconds: 0 }, i); })
  };
  S.run.idx = nextPending(S.run, 0);
  save();
  location.hash = '#run';
  render();
  return true;
}
function nextPending(r, from) {
  for (let i = from; i < r.items.length; i++) if (r.items[i].status === 'pending') return i;
  for (let i = 0; i < r.items.length; i++) if (r.items[i].status === 'pending') return i;
  return r.items.length;
}
function runAll() { return S.run && S.run.idx >= S.run.items.length; }
function renderRunner() {
  const el = $('#runner');
  if (!el) return;
  if (!S.run) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = runnerHtml();
  if (!UI.tick) UI.tick = setInterval(tickRunner, 1000);
}
function tickRunner() {
  const el = $('#runner');
  if (!S.run || !el || el.hidden) return;
  const clock = $('[data-clock]', el);
  if (clock) clock.textContent = fmtClock(Date.now() - S.run.startedAt);
  const rest = $('[data-rest]', el);
  if (rest) {
    const left = Math.max(0, Math.ceil((S.run.restEnd - Date.now()) / 1000));
    rest.textContent = left > 0 ? 'Rest ' + fmtClock(left * 1000) : 'Rest done. Log the next set.';
  }
}
function fmtClock(ms) { const s = Math.floor(ms / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
function runnerHtml() {
  const r = S.run;
  const total = r.items.length;
  const doneN = r.items.filter(function (i) { return i.status === 'done'; }).length;
  const it = r.items[r.idx];
  const head = '<div class="row" style="margin-bottom:10px"><button class="btn sm" data-a="run-exit">Pause and exit</button><div class="tiny" style="text-align:center">' + esc(r.name) + '</div><button class="btn sm d" data-a="run-cancel">' + (UI.armed === 'cancel' ? 'Tap again to discard' : 'Discard') + '</button></div>';
  if (!it || runAll()) {
    return '<div class="in">' + head + '<div class="clock" data-clock>' + fmtClock(Date.now() - r.startedAt) + '</div><section class="panel hero" style="text-align:center"><h2>Workout complete?</h2><p class="muted">' + doneN + ' of ' + total + ' drills done. Review the list, then finish to save the session.</p><div class="btns" style="justify-content:center"><button class="btn p xl" data-a="run-finish">Finish and save</button></div></section>' + runnerList(r) + '</div>';
  }
  const isReps = it.metric !== 'makes';
  const sets = it.sets.length;
  const target = it.targetSets || 1;
  const restLeft = r.restEnd > Date.now();
  const dots = [];
  for (let i = 0; i < target; i++) dots.push('<i class="' + (i < sets ? 'done' : i === sets ? 'cur' : '') + '">' + (i + 1) + '</i>');
  const att = isReps ? '' : '<div class="fld"><label class="f" for="r-att">Attempts</label><div class="stepper"><button class="btn rd" data-a="run-step" data-t="r-att" data-d="-1" aria-label="Fewer attempts">−</button><input id="r-att" type="number" inputmode="numeric" min="0" value="' + (it.targetAttempts || 10) + '"><button class="btn rd" data-a="run-step" data-t="r-att" data-d="1" aria-label="More attempts">+</button></div></div>' + '<div class="fld"><label class="f" for="r-made">Makes</label><div class="stepper"><button class="btn rd" data-a="run-step" data-t="r-made" data-d="-1" aria-label="Fewer makes">−</button><input id="r-made" type="number" inputmode="numeric" min="0" value="0"><button class="btn rd" data-a="run-step" data-t="r-made" data-d="1" aria-label="More makes">+</button></div></div>';
  const reps = isReps ? '<div class="fld"><label class="f" for="r-reps">Reps</label><div class="stepper"><button class="btn rd" data-a="run-step" data-t="r-reps" data-d="-1" aria-label="Fewer reps">−</button><input id="r-reps" type="number" inputmode="numeric" min="0" value="' + (it.targetAttempts || 10) + '"><button class="btn rd" data-a="run-step" data-t="r-reps" data-d="1" aria-label="More reps">+</button></div></div><div class="fld"><label class="f" for="r-good">Good reps</label><div class="stepper"><button class="btn rd" data-a="run-step" data-t="r-good" data-d="-1" aria-label="Fewer good reps">−</button><input id="r-good" type="number" inputmode="numeric" min="0" value="0"><button class="btn rd" data-a="run-step" data-t="r-good" data-d="1" aria-label="More good reps">+</button></div></div>' : '';
  const zones = isReps ? '' : '<div class="fld"><label class="f">Shot zone for this set</label><div class="chips">' + ZONES.map(function (z) { return '<button class="chip' + (r.zone === z ? ' on' : '') + '" data-a="run-zone" data-id="' + z + '" aria-pressed="' + (r.zone === z) + '">' + z + '</button>'; }).join('') + '</div></div>';
  const drill = drillById(it.drillId);
  return '<div class="in">' + head +
    '<div class="prog" aria-label="Workout progress"><i style="width:' + Math.round((doneN / total) * 100) + '%"></i></div><div class="row" style="margin:6px 0 4px"><span class="tiny">Drill ' + (r.idx + 1) + ' of ' + total + '</span><span class="tiny num" data-clock>' + fmtClock(Date.now() - r.startedAt) + '</span></div>' +
    '<section class="panel" style="margin-top:8px"><div class="row" style="align-items:flex-start"><div style="min-width:0;flex:1"><h2 style="font-size:30px">' + esc(it.name) + '</h2><div class="tiny">' + esc(it.category) + ' · ' + setsLabel(it) + (it.restSec ? ' · rest ' + it.restSec + 's' : '') + '</div></div><a class="btn sm" href="#drill-' + it.drillId + '">Details</a></div>' +
    (drill ? '<p class="small muted" style="margin-top:8px">' + esc(drill.coaching && drill.coaching[0] ? 'Cue: ' + drill.coaching[0] : drill.objective) + '</p>' : '') +
    '<div style="margin:12px 0"><div class="tiny" style="margin-bottom:6px">Sets</div><div class="setdots">' + dots.join('') + '</div></div>' +
    '<div class="grid g2" style="gap:12px">' + att + reps + '</div>' + zones +
    '<div class="btns" style="margin-top:14px"><button class="btn xl p" data-a="run-log">Log set ' + (sets + 1) + ' of ' + target + '</button></div>' +
    '<div class="row" style="margin-top:10px"><span class="small" data-rest>' + (restLeft ? 'Rest ' + fmtClock(r.restEnd - Date.now()) : (sets ? 'Rest done. Log the next set.' : 'Start when ready')) + '</span><div class="btns"><button class="btn sm" data-a="run-repeat">Repeat drill</button><button class="btn sm" data-a="run-skip">Skip drill</button></div></div></section>' +
    '<div style="margin-top:12px">' + runnerList(r) + '</div></div>';
}
function runnerList(r) {
  return '<section class="panel" style="padding:12px"><h4 style="margin-bottom:6px">Queue</h4><div class="list">' + r.items.map(function (i, idx) { return '<div class="li" style="padding:9px 0"><div class="main"><span class="small' + (idx === r.idx ? ' ink2' : '') + '"><b>' + (idx + 1) + '.</b> ' + esc(i.name) + '</span></div><span class="tag ' + (i.status === 'done' ? 'g' : i.status === 'skipped' ? 'b' : i.status === 'partial' ? 'w' : '') + '">' + i.status + '</span></div>'; }).join('') + '</div></section>';
}

/* ==================== ACTIONS ==================== */
var ACT = {};
ACT['open-builder'] = function () { location.hash = '#train'; setTimeout(function () { const el = $('#bd-text'); if (el) el.focus(); }, 30); };
ACT['start-template'] = function (el) {
  const w = S.workouts.find(function (x) { return x.id === el.dataset.id; });
  if (!w) return;
  startRun(w.items.map(function (i) { return Object.assign({}, i); }), w.name, w.id, null);
};
ACT['run-resume'] = function () { if (S.run) { location.hash = '#run'; render(); } };
ACT['run-exit'] = function () { location.hash = '#train'; render(); };
ACT['run-cancel'] = function () {
  if (UI.armed !== 'cancel') { UI.armed = 'cancel'; renderRunner(); setTimeout(function () { if (UI.armed === 'cancel') { UI.armed = null; renderRunner(); } }, 4000); return; }
  UI.armed = null; S.run = null; save(); location.hash = '#train'; render(); toast('Workout discarded');
};
ACT['run-step'] = function (el) {
  const input = $('#' + el.dataset.t); if (!input) return;
  input.value = Math.max(0, (+input.value || 0) + (+el.dataset.d));
};
ACT['run-zone'] = function (el) { S.run.zone = S.run.zone === el.dataset.id ? null : el.dataset.id; save(); renderRunner(); };
ACT['run-log'] = function () {
  const r = S.run; if (!r) return;
  const it = r.items[r.idx]; if (!it || it.status !== 'pending') return;
  const now = Date.now();
  if (it.metric === 'makes') {
    const a = +($('#r-att') && $('#r-att').value) || 0, m = +($('#r-made') && $('#r-made').value) || 0;
    if (a <= 0) { toast('Enter attempts first', 'warn'); return; }
    if (m > a) { toast('Makes cannot be more than attempts', 'warn'); return; }
    it.sets.push({ att: a, made: m, zone: r.zone || null });
  } else {
    const rp = +($('#r-reps') && $('#r-reps').value) || 0, g = +($('#r-good') && $('#r-good').value) || 0;
    if (rp <= 0) { toast('Enter reps first', 'warn'); return; }
    if (g > rp) { toast('Good reps cannot be more than reps', 'warn'); return; }
    it.reps += rp; it.goodReps += g; it.sets.push({ att: rp, made: g, zone: null });
  }
  it.seconds += Math.min(900, Math.round((now - (r.lastTick || r.startedAt)) / 1000));
  r.lastTick = now;
  if (it.sets.length >= (it.targetSets || 1)) {
    it.status = 'done'; r.restEnd = 0;
    r.idx = nextPending(r, r.idx + 1);
    if (r.idx >= r.items.length) toast('All drills done. Finish to save.');
  } else {
    r.restEnd = now + (it.restSec || 0) * 1000;
  }
  save(); renderRunner();
};
ACT['run-skip'] = function () {
  const r = S.run; if (!r) return;
  const it = r.items[r.idx];
  if (!it || it.status !== 'pending') return;
  it.status = 'skipped'; r.restEnd = 0;
  r.idx = nextPending(r, r.idx + 1);
  save(); renderRunner();
};
ACT['run-repeat'] = function () {
  const r = S.run; if (!r) return;
  const it = r.items[r.idx];
  if (!it) return;
  it.status = 'pending'; it.sets = []; it.reps = 0; it.goodReps = 0; r.restEnd = 0;
  save(); renderRunner();
  toast('Drill reset. Start the first set again.');
};
ACT['run-finish'] = function () {
  const r = S.run; if (!r) return;
  const measured = Math.max(1, Math.round((Date.now() - r.startedAt) / 60000));
  modal('Finish workout', '<form data-form="finish" class="grid" style="gap:12px"><div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="f-min">Minutes trained</label><input id="f-min" name="minutes" type="number" min="1" max="300" value="' + measured + '"></div>' + selectField('f-rpe', 'Effort (RPE 1–10)', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 6) + '</div>' +
    '<div class="fld"><label class="f" for="f-loc">Where</label><select id="f-loc" name="location"><option value="">Not set</option>' + ENVIRONMENTS.map(function (e) { return '<option' + (e === S.profile.env ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label class="f" for="f-notes">Notes</label><textarea id="f-notes" name="notes" placeholder="How it felt, what to change next time"></textarea></div><div class="btns"><button class="btn p" type="submit">Save session</button><button class="btn" type="button" data-a="modal-close">Keep training</button></div></form>');
};
ACT['cal-mode'] = function (el) { UI.calMode = el.dataset.id; render(); };
ACT['cal-prev'] = function () { const m = UI.calMode === 'week' ? -7 : 0; UI.anchor = UI.calMode === 'week' ? addDays(anchorDay(), m) : addMonths(anchorDay(), -1); render(); };
ACT['cal-next'] = function () { UI.anchor = UI.calMode === 'week' ? addDays(anchorDay(), 7) : addMonths(anchorDay(), 1); render(); };
ACT['cal-today'] = function () { UI.anchor = today(); UI.sel = today(); render(); };
ACT['cal-day'] = function (el) { UI.sel = el.dataset.id; render(); };
function addMonths(k, n) { const d = keyDate(k); d.setMonth(d.getMonth() + n, 1); return dayKey(d.getTime()); }
ACT['plan-add'] = function (el) {
  const day = el.dataset.id || selDay();
  modal('Add to plan', '<form data-form="plan-add" class="grid" style="gap:12px"><div class="fld"><label class="f" for="pa-title">Title</label><input id="pa-title" name="title" required placeholder="e.g. Team practice, Shooting session"></div>' +
    '<div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="pa-date">Date</label><input id="pa-date" name="date" type="date" value="' + day + '" required></div><div class="fld"><label class="f" for="pa-type">Type</label><select id="pa-type" name="type">' + Object.keys(PLAN_TYPES).map(function (k) { return '<option value="' + k + '">' + PLAN_TYPES[k] + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="grid g2" style="gap:12px">' + selectField('pa-min', 'Minutes', DURATIONS.concat([90, 120]), 60) + '<div class="fld"><label class="f" for="pa-w">Workout (optional)</label><select id="pa-w" name="workoutId"><option value="">None</option>' + S.workouts.map(function (w) { return '<option value="' + w.id + '">' + esc(w.name) + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="btns"><button class="btn p" type="submit">Add</button></div></form>');
};
ACT['plan-edit'] = function (el) {
  const p = S.plan.find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
  modal('Edit plan item', '<form data-form="plan-edit" data-id="' + p.id + '" class="grid" style="gap:12px"><div class="fld"><label class="f" for="pe-title">Title</label><input id="pe-title" name="title" value="' + esc(p.title) + '"></div>' +
    '<div class="grid g2" style="gap:12px"><div class="fld"><label class="f" for="pe-date">Move to date</label><input id="pe-date" name="date" type="date" value="' + p.date + '"></div><div class="fld"><label class="f" for="pe-type">Type</label><select id="pe-type" name="type">' + Object.keys(PLAN_TYPES).map(function (k) { return '<option value="' + k + '"' + (k === p.type ? ' selected' : '') + '>' + PLAN_TYPES[k] + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="grid g2" style="gap:12px">' + selectField('pe-min', 'Minutes', DURATIONS.concat([90, 120]), p.minutes || 60) + '<div class="fld"><label class="f" for="pe-status">Status</label><select id="pe-status" name="status"><option value="planned"' + (p.status !== 'done' ? ' selected' : '') + '>Planned</option><option value="done"' + (p.status === 'done' ? ' selected' : '') + '>Done</option></select></div></div>' +
    '<div class="btns"><button class="btn p" type="submit">Save</button>' + (p.workoutId ? '<button class="btn b" type="button" data-a="plan-start" data-id="' + p.id + '">Start workout</button>' : '') + '<button class="btn d" type="button" data-a="plan-delete" data-id="' + p.id + '">Delete</button></div></form>');
};
ACT['plan-start'] = function (el) {
  const p = S.plan.find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
  const w = S.workouts.find(function (x) { return x.id === p.workoutId; });
  if (!w) { toast('Link a workout to this item first', 'warn'); return; }
  closeModal();
  startRun(w.items.map(function (i) { return Object.assign({}, i); }), w.name, w.id, p.id);
};
ACT['plan-delete'] = function (el) {
  if (UI.armed !== 'pd-' + el.dataset.id) { UI.armed = 'pd-' + el.dataset.id; toast('Tap delete again to confirm', 'warn'); return; }
  UI.armed = null;
  S.plan = S.plan.filter(function (x) { return x.id !== el.dataset.id; });
  save(); closeModal(); render(); toast('Plan item removed');
};
ACT['fav'] = function (el) {
  const id = el.dataset.id, i = S.favorites.indexOf(id);
  if (i >= 0) S.favorites.splice(i, 1); else S.favorites.push(id);
  save(); render();
};
ACT['drill-start'] = function (el) {
  const d = drillById(el.dataset.id); if (!d) return;
  startRun([{ drillId: d.id, name: d.name, category: d.category, metric: d.metric, targetSets: d.sets, targetAttempts: d.attempts, restSec: 30, timeLimitSec: 0 }], d.name, null, null);
};
ACT['drill-delete'] = function (el) {
  if (UI.armed !== 'dd-' + el.dataset.id) { UI.armed = 'dd-' + el.dataset.id; toast('Tap delete again to confirm', 'warn'); return; }
  UI.armed = null;
  S.customDrills = S.customDrills.filter(function (x) { return x.id !== el.dataset.id; });
  S.favorites = S.favorites.filter(function (x) { return x !== el.dataset.id; });
  save(); location.hash = '#library'; render(); toast('Custom drill deleted');
};
ACT['lib-fav'] = function () { UI.fav = !UI.fav; render(); };
ACT['lib-custom'] = function () { UI.custom = !UI.custom; render(); };
ACT['lib-cat'] = function (el) { UI.cat = el.dataset.id; render(); };
ACT['builder-start'] = function () { const d = UI.builder && UI.builder.draft; if (!d || !d.items.length) return; startRun(d.items.map(function (i) { return Object.assign({}, i); }), d.name, null, null); };
ACT['builder-save'] = function () {
  const d = UI.builder && UI.builder.draft; if (!d || !d.items.length) return;
  const w = { id: 'w-' + uid(), name: d.name, category: d.category, objective: d.objective, minutes: d.minutes, difficulty: d.difficulty || 3, items: d.items.map(function (i) { return Object.assign({}, i); }), notes: '', custom: true, template: false, created: Date.now() };
  S.workouts.push(w); save(); toast('Saved to Train'); UI.builder = null; render();
};
ACT['ww-up'] = function (el) { const d = UI.editWorkout, i = +el.dataset.i; if (i <= 0) return; const t = d.items[i]; d.items[i] = d.items[i - 1]; d.items[i - 1] = t; render(); };
ACT['ww-down'] = function (el) { const d = UI.editWorkout, i = +el.dataset.i; if (i >= d.items.length - 1) return; const t = d.items[i]; d.items[i] = d.items[i + 1]; d.items[i + 1] = t; render(); };
ACT['ww-remove'] = function (el) { UI.editWorkout.items.splice(+el.dataset.i, 1); render(); };
ACT['ww-save'] = function () {
  const d = UI.editWorkout; if (!d) return;
  if (!d.name.trim()) { toast('Name the workout first', 'warn'); return; }
  const idx = S.workouts.findIndex(function (x) { return x.id === d.id; });
  const copy = Object.assign({}, d, { template: false, custom: true });
  if (idx >= 0) S.workouts[idx] = copy; else { copy.created = Date.now(); S.workouts.push(copy); }
  UI.editWorkout = null; save(); location.hash = '#train'; render(); toast('Workout saved');
};
ACT['ww-start'] = function () { const d = UI.editWorkout; if (!d || !d.items.length) { toast('Add a drill first', 'warn'); return; } startRun(d.items.map(function (i) { return Object.assign({}, i); }), d.name || 'Workout', d.id, null); };
ACT['ww-delete'] = function (el) {
  if (UI.armed !== 'wd-' + el.dataset.id) { UI.armed = 'wd-' + el.dataset.id; toast('Tap delete again to confirm', 'warn'); return; }
  UI.armed = null; S.workouts = S.workouts.filter(function (x) { return x.id !== el.dataset.id; }); UI.editWorkout = null; save(); location.hash = '#train'; render(); toast('Workout deleted');
};
ACT['goal-del'] = function (el) { S.goals = S.goals.filter(function (g) { return g.id !== el.dataset.id; }); save(); render(); };
ACT['habit-log'] = function (el) {
  const h = S.habits.find(function (x) { return x.id === el.dataset.id; }); if (!h) return;
  const d = +el.dataset.d;
  const cur = habitToday(h.id);
  const next = Math.max(0, cur + d);
  const delta = next - cur;
  if (delta) S.habitLog.push({ id: uid(), habitId: h.id, date: today(), value: delta });
  save(); render();
};
ACT['journal-del'] = function (el) { S.journal = S.journal.filter(function (j) { return j.id !== el.dataset.id; }); save(); render(); };
ACT['range'] = function (el) { UI.range = +el.dataset.id; render(); };
ACT['export'] = function () { const t = $('#backup-text'); if (t) t.value = JSON.stringify({ schema: S.schema, exportedAt: new Date().toISOString(), state: S }, null, 2); toast('Backup ready below'); };
ACT['copy-backup'] = async function () {
  const t = $('#backup-text');
  if (!t || !t.value) { ACT.export(); return; }
  try { await navigator.clipboard.writeText(t.value); toast('Backup copied'); }
  catch (e) { t.select(); toast('Select the text and copy it', 'warn'); }
};
ACT['modal-close'] = function () { closeModal(); };

/* ==================== FORMS ==================== */
var FORM = {};
FORM.readiness = function (f) {
  const v = { date: today(), sleep: +f['rd-sleep'].value, soreness: +f['rd-sore'].value, energy: +f['rd-energy'].value };
  S.readiness = S.readiness.filter(function (r) { return r.date !== v.date; });
  S.readiness.push(v); save(); render(); toast('Check-in saved');
};
FORM.builder = function (f) {
  const text = f.text.value, minutes = +f.minutes.value;
  const parsed = parseRequest(text);
  const opts = { minutes: minutes || parsed.minutes || 30, area: f.area.value || parsed.area || '', partner: !!f.partner.checked || parsed.partner, hard: !!f.hard.checked || parsed.hard };
  const draft = generateSession(opts);
  draft.category = opts.minutes <= 20 ? 'micro' : opts.minutes <= 60 ? 'focused' : 'competitive';
  draft.objective = opts.area || 'Shooting';
  draft.difficulty = opts.hard ? 4 : 3;
  UI.builder = { text: text, minutes: opts.minutes, area: opts.area, partner: opts.partner, hard: opts.hard, draft: draft };
  render();
};
FORM.drill = function (f, el) {
  const v = normalizeDrill({
    id: el.dataset.id || 'c-' + uid(), name: f.name.value.trim() || 'Custom drill', category: f.category.value, difficulty: +f.difficulty.value, minutes: +f.minutes.value,
    sets: +f.sets.value, attempts: +f.attempts.value, metric: f.metric.value, zone: f.zone.value || null, partner: !!f.partner.checked,
    objective: f.objective.value, instructions: f.instructions.value, coaching: linesOf(f.coaching.value), mistakes: linesOf(f.mistakes.value),
    progressions: linesOf(f.progressions.value), regressions: linesOf(f.regressions.value), soloVariant: f.soloVariant.value, partnerVariant: f.partnerVariant.value || null,
    equipment: ['Ball', 'Hoop'], custom: true, created: Date.now()
  });
  const i = S.customDrills.findIndex(function (x) { return x.id === v.id; });
  const prev = i >= 0 ? S.customDrills[i] : null;
  if (prev) S.customDrills[i] = Object.assign({}, prev, v, { created: prev.created }); else S.customDrills.push(v);
  save(); location.hash = '#drill-' + v.id; render(); toast('Custom drill saved');
};
FORM.finish = function (f) {
  const r = S.run; if (!r) return;
  const session = buildSession(r, { minutes: +f.minutes.value, rpe: +(f.rpe || f['f-rpe']).value, location: f.location.value, notes: f.notes.value });
  const res = commitSession(session);
  S.run = null;
  save(); closeModal();
  location.hash = '#session-' + session.id; render();
  const msg = [];
  if (res.planned) msg.push('Plan item marked done');
  res.records.forEach(function (x) { msg.push(x.title); });
  res.milestones.forEach(function (m) { msg.push('Milestone: ' + m.label); });
  toast(msg.length ? msg.join(' · ') : 'Session saved', res.records.length ? '' : '');
};
FORM['plan-add'] = function (f) {
  if (!f.title.value.trim()) { toast('Give it a title', 'warn'); return; }
  S.plan.push({ id: 'p-' + uid(), title: f.title.value.trim(), date: f.date.value, type: f.type.value, minutes: +f.minutes.value, workoutId: f.workoutId.value || null, status: 'planned', created: Date.now() });
  save(); closeModal(); UI.sel = f.date.value; render(); toast('Added to plan');
};
FORM['plan-edit'] = function (f, el) {
  const p = S.plan.find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
  if (f.date.value && !moveEvent(p.id, f.date.value)) { toast('Pick a valid date', 'warn'); return; }
  p.title = f.title.value.trim() || p.title; p.type = f.type.value; p.minutes = +f.minutes.value; p.status = f.status.value;
  if (p.status === 'done' && !p.sessionId) p.completedManually = true;
  UI.sel = p.date; save(); closeModal(); render();
};
FORM.priority = function (f, el) {
  const p = S.priorities.find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
  p.assessment = f.assessment.value; p.targetValue = f.targetValue.value; save(); render(); toast(p.area + ' saved');
};
FORM.goal = function (f) {
  const target = +f.target.value; if (!target || target <= 0) { toast('Enter a target above zero', 'warn'); return; }
  S.goals.push({ id: 'g-' + uid(), type: f.type.value, target: target, label: GOAL_TYPES[f.type.value].label + ' ' + target, created: Date.now() });
  save(); render(); toast('Goal added');
};
FORM.journal = function (f) {
  const tags = Array.prototype.slice.call(f.querySelectorAll('input[name=tags]:checked')).map(function (x) { return x.value; });
  S.journal.push({ id: 'j-' + uid(), date: today(), text: f.text.value.trim(), tags: tags, created: Date.now() });
  save(); render(); toast('Journal entry saved');
};
FORM.profile = function (f) {
  S.profile.name = f.name.value.trim();
  S.profile.weeklyTarget = +f['p-week'].value;
  S.profile.sessionTarget = +f['p-sess'].value;
  S.profile.level = f.level.value; S.profile.env = f.env.value;
  save(); render(); toast('Profile saved');
};
FORM.restore = function (f) {
  try {
    const parsed = JSON.parse(f.backup.value);
    const st = parsed && parsed.state ? parsed.state : parsed;
    if (!st || typeof st !== 'object') throw new Error('bad');
    S = normalize(st); UI.ready = true; save(); render(); toast('Backup restored');
  } catch (e) { toast('That is not a valid backup', 'bad'); }
};

/* ==================== change handlers ==================== */
var CHG = {};
CHG['lib-q'] = function (el) { UI.q = el.value; render(); };
CHG['lib-diff'] = function (el) { UI.diff = +el.value; render(); };
CHG['ww-field'] = function (el) { if (UI.editWorkout) { const k = el.dataset.k; UI.editWorkout[k] = (k === 'minutes' || k === 'difficulty') ? +el.value : el.value; } };
CHG['ww-item'] = function (el) { if (UI.editWorkout) { const it = UI.editWorkout.items[+el.dataset.i]; if (it) it[el.dataset.k] = Math.max(1, +el.value || 1); } };
CHG['ww-add'] = function (el) {
  if (!el.value || !UI.editWorkout) return;
  const d = drillById(el.value); if (!d) return;
  UI.editWorkout.items.push({ drillId: d.id, name: d.name, category: d.category, metric: d.metric, targetSets: d.sets, targetAttempts: d.attempts, restSec: 30, timeLimitSec: 0 });
  render();
};

/* ==================== modal & toast ==================== */
function modal(title, body) {
  const m = $('#modal'); if (!m) return;
  m.hidden = false;
  m.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sh"><h3>' + esc(title) + '</h3><button class="btn sm" data-a="modal-close">Close</button></div>' + body + '</div>';
  const first = $('input,select,textarea', m); if (first) first.focus();
}
function closeModal() { const m = $('#modal'); if (m) { m.hidden = true; m.innerHTML = ''; } }
function toast(msg, tone) {
  const t = $('#toast'); if (!t) return;
  t.className = 'toast' + (tone ? ' ' + tone : '');
  t.textContent = msg; t.hidden = false;
  clearTimeout(UI.toastT);
  UI.toastT = setTimeout(function () { t.hidden = true; }, 3200);
}

/* ==================== events & boot ==================== */
function bindEvents() {
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'modal') { closeModal(); return; }
    const el = e.target.closest && e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.a];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', function (e) {
    const el = e.target.closest && e.target.closest('[data-c]');
    if (el && CHG[el.dataset.c]) CHG[el.dataset.c](el, e);
  });
  document.addEventListener('input', function (e) {
    const el = e.target;
    if (el && el.dataset && el.dataset.c === 'lib-q') { UI.q = el.value; const pos = el.selectionStart; render(); const n = $('#lib-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('submit', function (e) {
    const f = e.target;
    if (!f.dataset || !f.dataset.form) return;
    e.preventDefault();
    const fn = FORM[f.dataset.form];
    if (fn) fn(f, f);
  });
  document.addEventListener('dragstart', function (e) {
    const el = e.target.closest && e.target.closest('[data-drag]');
    if (!el) return;
    UI.dragId = el.dataset.drag;
    try { e.dataTransfer.setData('text/plain', UI.dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignore */ }
  });
  document.addEventListener('dragover', function (e) {
    const el = e.target.closest && e.target.closest('[data-drop]');
    if (!el || !UI.dragId) return;
    e.preventDefault();
  });
  document.addEventListener('drop', function (e) {
    const el = e.target.closest && e.target.closest('[data-drop]');
    if (!el || !UI.dragId) return;
    e.preventDefault();
    const id = UI.dragId; UI.dragId = null;
    if (moveEvent(id, el.dataset.drop)) { UI.sel = el.dataset.drop; save(); render(); toast('Moved to ' + fmtDay(el.dataset.drop)); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.evt[data-a], .dz[data-a], .dcell[data-a], .zone')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('hashchange', function () { closeModal(); render(); });
}
function boot() {
  S = normalize(loadLocal());
  seedTemplates();
  bindEvents();
  render();
  paintStatus();
  initAccount();
  if (!UI.tick) UI.tick = setInterval(tickRunner, 1000);
}
if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById && document.getElementById('app')) {
  boot();
}
