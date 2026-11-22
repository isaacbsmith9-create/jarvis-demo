/* ==================== Coach: assessment, skill ratings, weekly plans ====================
   Everything here is rule-based and computed from what you enter and log. Nothing is sent anywhere. */
var TESTS = {
  ft: { name: 'Free throws', area: 'Shooting', unit: 'makes', att: 10, desc: 'Shoot 10 free throws with your normal routine.', rate: function (t) { return clamp(((t.made / t.att) * 100 - 60) * 1.33 + 50, 0, 100); } },
  spot3: { name: '5-spot threes', area: 'Shooting', unit: 'makes', att: 25, desc: '5 catch-and-shoot threes from each corner, wing and the top.', rate: function (t) { return clamp(((t.made / t.att) * 100) * 1.5, 0, 100); } },
  pullup: { name: 'Pull-up jumpers', area: 'Shooting', unit: 'makes', att: 10, desc: '10 one-dribble pull-ups from the elbows, alternating sides.', rate: function (t) { return clamp(((t.made / t.att) * 100) * 1.5 + 5, 0, 100); } },
  weaklay: { name: 'Weak-hand layups (60s)', area: 'Finishing', unit: 'count', desc: 'Make as many weak-hand layups as you can in 60 seconds, alternating sides.', rate: function (t) { return clamp((t.made - 4) * 9, 0, 100); } },
  dribble: { name: 'Full-court dribble sprint', area: 'Ball Handling', unit: 'sec', desc: 'Baseline to baseline at full speed, ball in your weak hand. Time it.', rate: function (t) { return clamp((7 - t.sec) * 30, 0, 100); } },
  lane: { name: 'Lane agility', area: 'Conditioning', unit: 'sec', desc: 'Slide, sprint and backpedal around the lane and back. Time it.', rate: function (t) { return clamp((13.6 - t.sec) * 22, 0, 100); } },
};
function coachState() {
  if (!S.coach || typeof S.coach !== 'object') S.coach = {};
  var c = S.coach;
  if (!Array.isArray(c.days)) c.days = [1, 2, 4, 6];
  if (!Array.isArray(c.goals)) c.goals = [];
  if (!c.self || typeof c.self !== 'object') c.self = {};
  if (!Array.isArray(c.tests)) c.tests = [];
  if (!c.weeks || typeof c.weeks !== 'object') c.weeks = {};
  if (!c.mins) c.mins = 45;
  if (!c.position) c.position = 'Combo guard';
  return c;
}
function latestTest(key) { var xs = coachState().tests.filter(function (t) { return t.key === key; }); return xs.length ? xs[xs.length - 1] : null; }
function testScoreText(t) { if (!t) return '–'; var d = TESTS[t.key]; return d.unit === 'sec' ? t.sec + 's' : d.unit === 'count' ? t.made + ' made' : t.made + '/' + t.att; }

/* Skill rating per area: weighted average of self-rating (1x), latest tests (2x) and measured session data (3x). */
function areaEvidence(area) {
  var c = coachState(), ev = [], t = today();
  if (c.self[area]) ev.push({ v: c.self[area] * 10, w: 1, kind: 'self', src: 'You rated yourself ' + c.self[area] + '/10' });
  Object.keys(TESTS).forEach(function (k) { if (TESTS[k].area !== area) return; var lt = latestTest(k); if (lt) ev.push({ v: Math.round(TESTS[k].rate(lt)), w: 2, kind: 'test', src: TESTS[k].name + ' test: ' + testScoreText(lt) + ' (' + fmtDay(lt.date, { month: 'short', day: 'numeric' }) + ')' }); });
  var from = addDays(t, -29), att = 0, made = 0;
  rangeSessions(from, t).forEach(function (s) { s.items.forEach(function (i) {
    var d = drillById(i.drillId), cat = d ? d.category : i.category; if (cat !== area || i.metric !== 'makes') return;
    i.sets.forEach(function (x) { att += x.att || 0; made += x.made || 0; });
  }); });
  if (area === 'Shooting' && att >= 50) { var p = (made / att) * 100; ev.push({ v: Math.round(clamp(p * 2.2 - 15, 0, 100)), w: 3, kind: 'measured', src: Math.round(p) + '% on ' + att + ' logged shots, last 30 days' }); }
  if (area === 'Finishing' && att >= 30) { var q = (made / att) * 100; ev.push({ v: Math.round(clamp((q - 50) * 2 + 40, 0, 100)), w: 2, kind: 'measured', src: Math.round(q) + '% on ' + att + ' logged finishes, last 30 days' }); }
  return ev;
}
function areaRating(area) { var ev = areaEvidence(area); if (!ev.length) return { v: null, ev: ev }; var W = sum(ev, function (e) { return e.w; }); return { v: Math.round(sum(ev, function (e) { return e.v * e.w; }) / W), ev: ev }; }
function playerRatings() { var o = {}; AREAS.forEach(function (a) { o[a] = areaRating(a); }); return o; }
function overallRating(r) { r = r || playerRatings(); var vs = AREAS.map(function (a) { return r[a].v; }).filter(function (v) { return v != null; }); return vs.length ? Math.round(sum(vs) / vs.length) : null; }
function ratingTier(v) { return v == null ? '–' : v >= 85 ? 'Elite' : v >= 72 ? 'Varsity+' : v >= 58 ? 'Varsity' : v >= 45 ? 'Developing' : 'Building'; }

/* Focus areas: the lowest-rated areas, nudged toward the areas your goals care about. Unrated areas count as 50. */
function focusAreas(r) {
  r = r || playerRatings(); var c = coachState(), goalAreas = {};
  c.goals.forEach(function (g) { (GOAL_AREAS[g] || []).forEach(function (a) { goalAreas[a] = true; }); });
  var core = ['Shooting', 'Ball Handling', 'Finishing', 'Pick-and-Roll', 'Footwork', 'Conditioning', 'Game Situations', 'Movement'];
  var scored = core.map(function (a) { var v = r[a].v == null ? 50 : r[a].v; return { a: a, v: v, adj: v - (goalAreas[a] ? 10 : 0) - (PRIORITY_AREAS.indexOf(a) >= 0 ? 3 : 0) }; }).sort(function (x, y) { return x.adj - y.adj; });
  return scored.slice(0, 2).map(function (x) { var why = r[x.a].v == null ? 'not rated yet' : 'rated ' + r[x.a].v; if (goalAreas[x.a]) why += ', and it matches your goals'; return { area: x.a, rating: r[x.a].v, why: why }; });
}

/* Build one session: warm-up, main focus (60%), second focus (25%), shooting finisher. Difficulty follows the rating. */
function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function composeCoachWorkout(date, main, second, mins, used) {
  var r = playerRatings(), pool = allDrills().filter(function (d) { return !d.partner; });
  var target = function (a) { var v = r[a] && r[a].v; return v == null ? 2.5 : v < 45 ? 2 : v < 65 ? 3 : 4; };
  var pick = function (area, budget, avoid) {
    var t = target(area), seed = hashStr(date + area);
    var cands = pool.filter(function (d) { return (d.category === area || (d.secondary || []).indexOf(area) >= 0) && avoid.indexOf(d.id) < 0; })
      .sort(function (a, b) { var ua = used[a.id] ? 1 : 0, ub = used[b.id] ? 1 : 0; return ua - ub || Math.abs(a.difficulty - t) - Math.abs(b.difficulty - t) || ((hashStr(a.id) + seed) % 7) - ((hashStr(b.id) + seed) % 7); });
    var out = [], m = 0;
    for (var i = 0; i < cands.length && m < budget - 2; i++) { if (m + cands[i].minutes > budget + 3 && out.length) continue; out.push(cands[i]); m += cands[i].minutes; }
    return out;
  };
  var items = [], ids = [];
  var addAll = function (ds) { ds.forEach(function (d) { if (ids.indexOf(d.id) >= 0) return; ids.push(d.id); used[d.id] = true; items.push({ drillId: d.id, name: d.name, category: d.category, metric: d.metric, targetSets: d.sets, targetAttempts: d.attempts, restSec: 30, timeLimitSec: 0 }); }); };
  if (mins >= 30) addAll(pick(main === 'Ball Handling' ? 'Footwork' : 'Ball Handling', 5, []).slice(0, 1));
  addAll(pick(main, Math.round(mins * 0.6), ids));
  if (second) addAll(pick(second, Math.round(mins * 0.25), ids));
  if (mins >= 30 && main !== 'Shooting' && second !== 'Shooting') addAll(pool.filter(function (d) { return d.id === 'd-tired-fts' || d.id === 'd-ft-timed'; }).slice(0, 1));
  return items;
}
function weekDates(ws) { var c = coachState(), out = []; for (var i = 0; i < 7; i++) { var d = addDays(ws, i); if (c.days.indexOf(keyDate(d).getDay()) >= 0) out.push(d); } return out; }
/* Replace the coach's own unfinished future sessions in a week. Never touches your own plan items or finished work. */
function buildCoachWeek(ws) {
  var c = coachState(), r = playerRatings(), f = focusAreas(r), t = today();
  var keep = function (p) { return !(p.coach && p.date >= ws && p.date <= addDays(ws, 6) && p.date >= t && p.status !== 'done'); };
  var removed = S.plan.filter(function (p) { return !keep(p); }).map(function (p) { return p.workoutId; });
  S.plan = S.plan.filter(keep);
  S.workouts = S.workouts.filter(function (w) { return !(w.coach && removed.indexOf(w.id) >= 0); });
  var dates = weekDates(ws).filter(function (d) { return d >= t && !S.plan.some(function (p) { return p.coach && p.date === d; }); });
  var used = {}, n = 0;
  dates.forEach(function (d, i) {
    var main = f.length ? (i % 3 === 2 && f[1] ? f[1].area : f[0].area) : 'Shooting', second = f.length > 1 ? (main === f[0].area ? f[1].area : f[0].area) : null;
    var r0 = readinessScore(d === t ? readinessToday() : null), mins = c.mins;
    if (r0 != null && r0 < 55) mins = Math.max(20, Math.round(mins * 0.6 / 5) * 5);
    var items = composeCoachWorkout(d, main, second, mins, used);
    var wid = 'w-coach-' + d.replace(/-/g, '') + '-' + uid().slice(0, 4);
    var why = main + ' is a focus (' + (f.find(function (x) { return x.area === main; }) || { why: '' }).why + ')' + (second ? '; ' + second + ' as secondary' : '');
    S.workouts.push({ id: wid, name: main + ' Day', category: main, objective: 'Coach session built for your weak spots.', minutes: mins, difficulty: 3, warmup: 'Five minutes of form shooting and stationary handles.', notes: why, template: false, custom: true, coach: true, created: Date.now(), items: items });
    S.plan.push({ id: 'p-coach-' + uid(), title: 'Coach: ' + main, date: d, type: 'workout', minutes: mins, workoutId: wid, status: 'planned', created: Date.now(), coach: true, reason: why });
    n++;
  });
  c.weeks[ws] = { built: Date.now(), focus: f.map(function (x) { return x.area; }), sessions: n };
  save();
  return n;
}
function coachWeekItems(ws) { return S.plan.filter(function (p) { return p.coach && p.date >= ws && p.date <= addDays(ws, 6); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
function weekReview(ws) {
  var items = coachWeekItems(ws), done = items.filter(function (p) { return p.status === 'done'; }).length, past = items.filter(function (p) { return p.date < today() || p.status === 'done'; }).length;
  var we = addDays(ws, 6), mins = rangeMinutes(ws, we), sh = shootingSummary(ws, we), prev = shootingSummary(addDays(ws, -7), addDays(ws, -1));
  return { items: items, done: done, past: past, mins: mins, sh: sh, prev: prev, rate: past ? done / past : null };
}

/* ---------- views ---------- */
function selStr(id, label, opts, val) { return '<div class="fld"><label class="f" for="' + id + '">' + label + '</label><select id="' + id + '" name="' + id + '">' + opts.map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>'; }
function skillBars(r) {
  return '<div class="skills">' + AREAS.map(function (a) { var x = r[a], v = x.v; var kinds = x.ev.map(function (e) { return e.kind; });
    return '<div class="sk"><div class="row"><b>' + esc(a) + '</b><span class="num ' + (v == null ? 'muted' : '') + '">' + (v == null ? 'Not rated' : v) + '</span></div><div class="bar"><i style="width:' + (v || 0) + '%"></i></div><div class="tiny">' + (x.ev.length ? x.ev.map(function (e) { return esc(e.src); }).join(' · ') : 'Rate yourself or take a test') + (kinds.indexOf('measured') >= 0 ? ' <span class="tag g">measured</span>' : kinds.indexOf('test') >= 0 ? ' <span class="tag i">tested</span>' : x.ev.length ? ' <span class="tag">self-rated</span>' : '') + '</div></div>'; }).join('') + '</div>';
}
function radarSVG(r, size) {
  size = size || 260; var cx = size / 2, cy = size / 2, R = size / 2 - 38, n = AREAS.length, pts = [], grid = '', labels = '';
  for (var k = 1; k <= 4; k++) { var ring = []; for (var i = 0; i < n; i++) { var ang = -Math.PI / 2 + (i / n) * 2 * Math.PI; ring.push((cx + Math.cos(ang) * R * k / 4).toFixed(1) + ',' + (cy + Math.sin(ang) * R * k / 4).toFixed(1)); } grid += '<polygon points="' + ring.join(' ') + '" fill="none" stroke="var(--line)" />'; }
  AREAS.forEach(function (a, i) { var ang = -Math.PI / 2 + (i / n) * 2 * Math.PI, v = (r[a].v == null ? 0 : r[a].v) / 100; pts.push((cx + Math.cos(ang) * R * v).toFixed(1) + ',' + (cy + Math.sin(ang) * R * v).toFixed(1));
    var lx = cx + Math.cos(ang) * (R + 20), ly = cy + Math.sin(ang) * (R + 20); labels += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + (Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end') + '">' + esc(a.replace('Game Situations', 'Game IQ').replace('Pick-and-Roll', 'PnR').replace('Ball Handling', 'Handle')) + '</text>';
    grid += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(ang) * R).toFixed(1) + '" y2="' + (cy + Math.sin(ang) * R).toFixed(1) + '" stroke="var(--line)"/>'; });
  return '<svg class="radar" viewBox="-56 -6 ' + (size + 112) + ' ' + (size + 12) + '" role="img" aria-label="Skill ratings">' + grid + '<polygon points="' + pts.join(' ') + '" fill="rgba(255, 145, 61, 0.22)" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>' + labels + '</svg>';
}
function weekStrip(ws) {
  var items = coachWeekItems(ws), own = S.plan.filter(function (p) { return !p.coach && p.date >= ws && p.date <= addDays(ws, 6); });
  var out = '';
  for (var i = 0; i < 7; i++) { var d = addDays(ws, i), it = items.filter(function (p) { return p.date === d; })[0], o = own.filter(function (p) { return p.date === d; });
    var st = it ? (it.status === 'done' ? 'done' : d < today() ? 'missed' : 'planned') : (o.length ? 'own' : 'off');
    out += '<button class="wk ' + st + (d === today() ? ' now' : '') + '" ' + (it ? 'data-a="coach-open" data-id="' + it.id + '"' : 'data-a="go" data-href="#plan"') + ' aria-label="' + esc(fmtDay(d) + ': ' + (it ? it.title : o.length ? o[0].title : 'off')) + '"><span>' + esc(keyDate(d).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)) + '</span><b>' + keyDate(d).getDate() + '</b><i>' + (st === 'done' ? ic('check', 14) : st === 'missed' ? ic('x', 14) : st === 'planned' ? ic('dumbbell', 14) : st === 'own' ? ic('circle-dot', 12) : '') + '</i><small>' + (it ? esc(it.title.replace('Coach: ', '')) : o.length ? esc(PLAN_TYPES[o[0].type] || o[0].title) : 'Rest') + '</small></button>';
  }
  return '<div class="wkstrip">' + out + '</div>';
}
function coachSessionCard(p, big) {
  var w = S.workouts.find(function (x) { return x.id === p.workoutId; }); if (!w) return '';
  var cats = {}; w.items.forEach(function (i) { cats[i.category] = (cats[i.category] || 0) + 1; });
  return '<div class="sess' + (big ? ' big' : '') + '"><div class="row"><div><div class="kick">' + (p.date === today() ? 'Today' : esc(fmtDay(p.date))) + ' · ' + p.minutes + ' min · ' + w.items.length + ' drills</div><h3>' + esc(w.name) + '</h3></div>' + (p.status === 'done' ? '<span class="tag g">' + ic('check', 12) + ' Done</span>' : '') + '</div>' +
    '<div class="chips" style="margin:8px 0">' + Object.keys(cats).map(function (k) { return '<span class="tag">' + esc(k) + ' ×' + cats[k] + '</span>'; }).join('') + '</div>' +
    (big ? '<ol class="drl">' + w.items.map(function (i) { var d = drillById(i.drillId); return '<li><a href="#drill-' + i.drillId.slice(2) + '">' + esc(i.name) + '</a><span class="tiny">' + (i.targetSets || 1) + '×' + (i.targetAttempts || '') + (d ? ' · ' + d.minutes + 'm' : '') + '</span></li>'; }).join('') + '</ol>' : '') +
    '<p class="tiny" style="margin:8px 0 0">Why: ' + esc(p.reason || w.notes || '') + '</p>' +
    (p.status === 'done' ? '' : '<div class="btns" style="margin-top:12px"><button class="btn p' + (big ? ' xl' : '') + '" data-a="plan-start" data-id="' + p.id + '">' + ic('play', 18) + ' Start session</button></div>') + '</div>';
}
function autoWeek() { var c = coachState(), ws = weekStart(today()); if (c.setupAt && !c.weeks[ws]) { buildCoachWeek(ws); toast('New week: your coach built this week’s plan'); } }
function viewCoach() {
  var c = coachState(); autoWeek();
  if (!c.setupAt) return pageHead('Coach', 'Your personal coach', '') + '<section class="panel hero coach-intro"><div class="ci-art">' + ic('target', 44) + '</div><h2>Let’s build your plan</h2><p class="ink2">Answer a few questions and take a quick skills test. Your coach rates your game, finds your weak spots and builds a weekly plan around them, then adjusts it every week from what you actually log.</p><p class="tiny">The coach is a set of fixed rules over your own data. It does not use AI and nothing leaves your device or account.</p><a class="btn p xl" href="#coach-setup" style="max-width:320px">Start assessment ' + ic('arrow-right', 18) + '</a></section>';
  var r = playerRatings(), ov = overallRating(r), f = focusAreas(r), ws = weekStart(today()), wk = coachWeekItems(ws), rv = weekReview(addDays(ws, -7));
  var todayItem = wk.filter(function (p) { return p.date === today(); })[0], next = wk.filter(function (p) { return p.date >= today() && p.status !== 'done'; })[0];
  return pageHead('Coach', esc(S.profile.name ? S.profile.name.split(' ')[0] + '’s plan' : 'Your plan'), '<a class="btn sm" href="#coach-setup">' + ic('settings', 15) + ' Edit assessment</a>') +
    '<div class="grid g2 coach-top"><section class="panel player-card"><div class="row s" style="gap:16px;align-items:center"><div class="ovr"><b class="num">' + (ov == null ? '–' : ov) + '</b><span>' + ratingTier(ov) + '</span></div><div><h2>' + esc(S.profile.name || 'Player') + '</h2><div class="ink2 small">' + esc(c.position) + (c.gradYear ? ' · Class of ' + esc(c.gradYear) : '') + ' · ' + esc(S.profile.level || '') + '</div><div class="chips" style="margin-top:8px">' + c.goals.map(function (g) { return '<span class="tag o">' + esc(COACH_GOALS[g]) + '</span>'; }).join('') + '</div></div></div>' + radarSVG(r, 300) + '<p class="tiny" style="text-align:center;margin:0">Overall = average of rated areas. Ratings are estimates from your self-ratings, tests and logged sessions.</p></section>' +
    '<section class="panel"><div class="phead"><div><h3>This week’s focus</h3><div class="sub">Your two lowest-rated areas, weighted toward your goals</div></div></div>' + f.map(function (x, i) { return '<div class="focus"><span class="fn">' + (i + 1) + '</span><div><b>' + esc(x.area) + '</b><div class="tiny">' + esc(x.why) + '</div></div></div>'; }).join('') +
    '<div class="hr"></div><div class="phead" style="margin-bottom:8px"><div><h3>Week of ' + esc(fmtDay(ws, { month: 'short', day: 'numeric' })) + '</h3><div class="sub">' + wk.filter(function (p) { return p.status === 'done'; }).length + ' of ' + wk.length + ' coach sessions done</div></div><button class="btn sm" data-a="coach-build">' + ic('repeat', 15) + (wk.length ? ' Rebuild week' : ' Build my week') + '</button></div>' + weekStrip(ws) + (coachWeekItems(addDays(ws, 7)).length ? '<div class="tiny" style="margin:10px 0 4px">Next week</div>' + weekStrip(addDays(ws, 7)) : '') + '</section></div>' +
    (todayItem || next ? '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>' + (todayItem ? 'Today’s session' : 'Next session') + '</h3></div></div>' + coachSessionCard(todayItem || next, true) + '</section>' : '') +
    '<div class="grid g2" style="margin-top:14px"><section class="panel"><div class="phead"><div><h3>Skill ratings</h3><div class="sub">Where each number comes from</div></div></div>' + skillBars(r) + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Skills tests</h3><div class="sub">Retest every 2–4 weeks to update your ratings</div></div></div><div class="list">' + Object.keys(TESTS).map(function (k) { var t = TESTS[k], lt = latestTest(k), hist = c.tests.filter(function (x) { return x.key === k; }); return '<div class="li"><div class="main"><b>' + esc(t.name) + '</b><div class="tiny">' + esc(t.area) + ' · ' + (lt ? 'Last: ' + testScoreText(lt) + ' on ' + esc(fmtDay(lt.date, { month: 'short', day: 'numeric' })) + (hist.length > 1 ? ' (before: ' + testScoreText(hist[hist.length - 2]) + ')' : '') : 'Not taken') + '</div></div><button class="btn sm" data-a="coach-test" data-id="' + k + '">' + (lt ? 'Retest' : 'Take test') + '</button></div>'; }).join('') + '</div></section></div>' +
    '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Weekly check-in</h3><div class="sub">Last week, from your logged sessions</div></div></div>' + (rv.items.length ? '<div class="grid g4">' + kpi(rv.done + '<small>/' + rv.items.length + '</small>', 'Coach sessions done') + kpi(fmtMin(rv.mins), 'Minutes trained') + kpi(rv.sh.pct == null ? '–' : rv.sh.pct + '<small>%</small>', 'Shooting', '', rv.prev.pct != null && rv.sh.pct != null ? (rv.sh.pct >= rv.prev.pct ? '<span class="good">▲ ' : '<span class="bad">▼ ') + Math.abs(rv.sh.pct - rv.prev.pct) + ' pts vs week before</span>' : '') + kpi(rv.rate == null ? '–' : Math.round(rv.rate * 100) + '<small>%</small>', 'Plan completion') + '</div>' +
      '<div class="note" style="margin-top:12px">' + (rv.rate == null ? 'No coach sessions were due last week.' : rv.rate < 0.5 ? 'You finished under half of last week’s sessions. A shorter week you actually finish beats a long one you skip. <button class="btn xs" data-a="coach-adjust" data-d="-1">Drop to ' + Math.max(2, c.days.length - 1) + ' days</button> <button class="btn xs" data-a="coach-adjust" data-m="-10">Make sessions 10 min shorter</button>' : rv.rate >= 0.9 ? 'You finished ' + Math.round(rv.rate * 100) + '% of last week. You can handle more. <button class="btn xs" data-a="coach-adjust" data-m="10">Add 10 min per session</button>' : 'Solid week. Keep the same load and stay consistent.') + '</div>' : '<div class="empty"><b>No check-in yet</b>Your first check-in appears after your first coach week.</div>') + '</section>';
}
function viewCoachSetup() {
  var c = coachState(), p = S.profile;
  var days = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
  return '<a class="crumb" href="#coach">' + ic('chevron-left', 14) + ' Coach</a>' + pageHead('Assessment', 'Tell your coach about your game', '') +
    '<form data-form="coach-setup" class="stack setup-form">' +
    '<section class="panel"><h3>' + ic('user', 18) + ' About you</h3><div class="grid g3" style="margin-top:12px"><div class="fld"><label class="f" for="cs-name">Name</label><input id="cs-name" name="name" value="' + esc(p.name || '') + '"></div>' + selStr('cs-pos', 'Position', POSITIONS, c.position) + '<div class="fld"><label class="f" for="cs-grad">Graduation year</label><input id="cs-grad" name="gradYear" inputmode="numeric" value="' + esc(c.gradYear || '') + '" placeholder="e.g. 2028"></div>' + selStr('cs-level', 'Level', LEVELS, p.level) + '</div></section>' +
    '<section class="panel"><h3>' + ic('target', 18) + ' Goals <span class="tiny">pick up to 3</span></h3><div class="chips" style="margin-top:12px">' + Object.keys(COACH_GOALS).map(function (k) { return '<label class="chip' + (c.goals.indexOf(k) >= 0 ? ' on' : '') + '"><input type="checkbox" name="goal" value="' + k + '"' + (c.goals.indexOf(k) >= 0 ? ' checked' : '') + ' hidden>' + esc(COACH_GOALS[k]) + '</label>'; }).join('') + '</div></section>' +
    '<section class="panel"><h3>' + ic('calendar-days', 18) + ' Your schedule</h3><div class="help">Which days can you train on your own, and for how long?</div><div class="chips" style="margin-top:12px">' + days.map(function (d) { return '<label class="chip' + (c.days.indexOf(d[0]) >= 0 ? ' on' : '') + '"><input type="checkbox" name="day" value="' + d[0] + '"' + (c.days.indexOf(d[0]) >= 0 ? ' checked' : '') + ' hidden>' + d[1] + '</label>'; }).join('') + '</div><div style="max-width:260px;margin-top:12px">' + selectField('cs-mins', 'Minutes per session', [20, 30, 45, 60, 75, 90], c.mins) + '</div></section>' +
    '<section class="panel"><h3>' + ic('gauge', 18) + ' Rate your game <span class="tiny">1 = needs a lot of work, 10 = elite for your level</span></h3><div class="grid g2" style="margin-top:12px">' + AREAS.map(function (a) { var v = c.self[a] || 5; return '<div class="fld rate"><label class="f" for="r-' + a.replace(/\W/g, '') + '">' + esc(a) + ' <b class="num" data-out>' + v + '</b></label><input type="range" min="1" max="10" step="1" id="r-' + a.replace(/\W/g, '') + '" name="self:' + esc(a) + '" value="' + v + '" oninput="this.previousElementSibling.querySelector(\'[data-out]\').textContent=this.value"></div>'; }).join('') + '</div><p class="tiny">Self-ratings count least. Tests and logged shots outweigh them as soon as you have them.</p></section>' +
    '<div class="btns"><button class="btn p xl" type="submit" style="max-width:360px">' + ic('sparkles', 18) + ' Save and build my week</button></div></form>';
}
function testModal(k) {
  var t = TESTS[k];
  modal(t.name + ' test', '<p class="ink2">' + esc(t.desc) + '</p><form data-form="coach-test" data-id="' + k + '" class="stack">' + (t.unit === 'sec' ? '<div class="fld"><label class="f" for="ct-sec">Time in seconds</label><input id="ct-sec" name="sec" inputmode="decimal" required placeholder="e.g. 5.8"></div>' : t.unit === 'count' ? '<div class="fld"><label class="f" for="ct-m">Layups made in 60 seconds</label><input id="ct-m" name="made" type="number" min="0" max="60" required></div>' : '<div class="fld"><label class="f" for="ct-m">Makes out of ' + t.att + '</label><input id="ct-m" name="made" type="number" min="0" max="' + t.att + '" required></div>') + '<button class="btn p" type="submit">Save result</button></form>');
}
ACT['coach-test'] = function (el) { testModal(el.dataset.id); };
ACT['coach-build'] = function () { var n = buildCoachWeek(weekStart(today())); toast(n ? 'Built ' + n + ' session' + (n === 1 ? '' : 's') + ' for this week' : 'No training days left this week. Check your schedule in the assessment.'); render(); };
ACT['coach-open'] = function (el) { var p = S.plan.find(function (x) { return x.id === el.dataset.id; }); if (!p) return; modal(p.title, coachSessionCard(p, true)); };
ACT['coach-adjust'] = function (el) { var c = coachState(); if (el.dataset.d) { var drop = c.days[c.days.length - 1]; if (c.days.length > 2) c.days = c.days.filter(function (d) { return d !== drop; }); } if (el.dataset.m) c.mins = clamp(c.mins + (+el.dataset.m), 20, 90); buildCoachWeek(weekStart(today())); toast('Plan adjusted and this week rebuilt'); render(); };
ACT['go'] = function (el) { location.hash = el.dataset.href; };
FORM['coach-test'] = function (f) {
  var k = f.dataset.id, t = TESTS[k], rec = { id: uid(), key: k, date: today() };
  if (t.unit === 'sec') { var s = parseFloat(f.sec.value); if (!(s > 0 && s < 60)) { toast('Enter a time in seconds', 'warn'); return; } rec.sec = Math.round(s * 10) / 10; }
  else { var m = +f.made.value; if (!(m >= 0)) { toast('Enter how many you made', 'warn'); return; } rec.made = m; rec.att = t.att || null; }
  var before = areaRating(t.area).v; coachState().tests.push(rec); save(); closeModal();
  var after = areaRating(t.area).v; toast(t.area + ' rating ' + (before == null ? 'set to ' + after : before === after ? 'stays ' + after : (after > before ? 'up' : 'down') + ' to ' + after)); render();
};
FORM['coach-setup'] = function (f) {
  var c = coachState(), goals = $$('input[name=goal]:checked', f).map(function (x) { return x.value; }), days = $$('input[name=day]:checked', f).map(function (x) { return +x.value; });
  if (goals.length > 3) { toast('Pick up to 3 goals', 'warn'); return; }
  if (!days.length) { toast('Pick at least one training day', 'warn'); return; }
  S.profile.name = f.name.value.trim(); S.profile.level = f.querySelector('#cs-level').value;
  c.position = f.querySelector('#cs-pos').value; c.gradYear = f.gradYear.value.trim(); c.goals = goals; c.days = days.sort(); c.mins = +f.querySelector('#cs-mins').value;
  AREAS.forEach(function (a) { var el = f.querySelector('[name="self:' + a + '"]'); if (el) c.self[a] = +el.value; });
  var first = !c.setupAt; c.setupAt = c.setupAt || Date.now();
  var n = buildCoachWeek(weekStart(today())); if (n < 2 || first) n += buildCoachWeek(addDays(weekStart(today()), 7)); save();
  toast(first ? 'Plan ready: ' + n + ' session' + (n === 1 ? '' : 's') + ' this week. Take a skills test to sharpen your ratings.' : 'Assessment saved and week rebuilt');
  location.hash = '#coach';
};
/* Chips with hidden checkboxes toggle their look */
document.addEventListener('change', function (e) { var cb = e.target; if (cb && cb.type === 'checkbox' && cb.parentElement && cb.parentElement.classList.contains('chip')) cb.parentElement.classList.toggle('on', cb.checked); });
