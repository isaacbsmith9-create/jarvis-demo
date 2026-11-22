/* ==================== Spot Map shooting builder + CLA philosophy ====================
   Pick your time and rebounding setup, get an estimate of how many shots you can get up,
   then tap spots on the court and set how many of each shot. Runs in the Shot Lab tracker. */
var SP_T3 = ['catch', 'move', 'cut'], SP_MID = ['catch', 'move', 'cut'];
var SPOTS = [
  { id: 'lc3', n: 'Left corner 3', x: 17, y: 82, zone: 'Corner 3', t: SP_T3 },
  { id: 'lsc', n: 'Left short corner', x: 112, y: 78, zone: 'Midrange', t: ['catch', 'move'] },
  { id: 'lf', n: 'Left floater', x: 200, y: 122, zone: 'Floater', t: ['float'] },
  { id: 'lw3', n: 'Left wing 3', x: 72, y: 244, zone: 'Wing 3', t: SP_T3 },
  { id: 'lwm', n: 'Left wing mid', x: 128, y: 172, zone: 'Midrange', t: SP_MID },
  { id: 'le', n: 'Left elbow', x: 172, y: 206, zone: 'Midrange', t: SP_MID },
  { id: 'tm', n: 'Top of the key mid', x: 250, y: 262, zone: 'Midrange', t: SP_MID },
  { id: 't3', n: 'Top 3', x: 250, y: 322, zone: 'Top 3', t: SP_T3 },
  { id: 're', n: 'Right elbow', x: 328, y: 206, zone: 'Midrange', t: SP_MID },
  { id: 'rwm', n: 'Right wing mid', x: 372, y: 172, zone: 'Midrange', t: SP_MID },
  { id: 'rw3', n: 'Right wing 3', x: 428, y: 244, zone: 'Wing 3', t: SP_T3 },
  { id: 'rf', n: 'Right floater', x: 300, y: 122, zone: 'Floater', t: ['float'] },
  { id: 'rsc', n: 'Right short corner', x: 388, y: 78, zone: 'Midrange', t: ['catch', 'move'] },
  { id: 'rc3', n: 'Right corner 3', x: 483, y: 82, zone: 'Corner 3', t: SP_T3 },
  { id: 'ft', n: 'Free throw line', x: 250, y: 200, zone: 'Free throw', t: ['ft'] },
];
var SP_SHORT = SHOT_SHORT, SP_LONG = SHOT_LONG; /* from the Shot Book library */
/* solo shots per minute (estimate), multiplied by the rebounding setup */
var SP_RATE = SHOT_RATE;
var SP_REB = { solo: ['Solo', 'Chasing my own rebounds', 1], reb: ['Rebounder', 'Partner or net return', 1.8], machine: ['Shooting machine', 'Gun / machine feeding me', 2.5] };
var SP_CATS = {
  midCatch: { s: ['le', 're', 'lwm', 'rwm', 'tm', 'lsc', 'rsc'], t: 'catch' },
  midMove: { s: ['le', 're', 'lwm', 'rwm', 'tm'], t: 'move' },
  midCut: { s: ['lwm', 'rwm', 'le', 're'], t: 'cut' },
  catch3: { s: ['lc3', 'rc3', 'lw3', 'rw3', 't3'], t: 'catch' },
  move3: { s: ['lw3', 'rw3', 't3'], t: 'move' },
  cut3: { s: ['lw3', 'rw3', 't3', 'lc3', 'rc3'], t: 'cut' },
  ft: { s: ['ft'], t: 'ft' },
  float: { s: ['lf', 'rf'], t: 'float' },
  runner: { s: ['lf', 'rf'], t: 'runner' },
  pin3: { s: ['lw3', 'rw3', 'lc3', 'rc3', 't3'], t: 'pindown' },
  flare3: { s: ['lw3', 'rw3', 't3'], t: 'flare' },
  reloc3: { s: ['lc3', 'rc3', 'lw3', 'rw3'], t: 'reloc' },
  trans3: { s: ['lc3', 'rc3', 'lw3', 'rw3'], t: 'trans-catch' },
  transPull: { s: ['t3', 'lw3', 'rw3', 'tm'], t: 'trans-pull' },
  hesi: { s: ['le', 're', 'tm', 'lw3', 'rw3', 't3'], t: 'hesi' },
  snatch: { s: ['lwm', 'rwm', 'lw3', 'rw3'], t: 'snatch' },
  stepback: { s: ['lw3', 'rw3', 't3', 'le', 're'], t: 'stepback' },
  contMid: { s: ['le', 're', 'lwm', 'rwm', 'tm'], t: 'contested-mid' },
  bump: { s: ['lsc', 'rsc', 'le', 're'], t: 'bump' },
  spin: { s: ['lsc', 'rsc', 'lwm', 'rwm'], t: 'spin' },
  turn: { s: ['lsc', 'rsc'], t: 'turn' },
};
var SP_PRESETS = [
  { id: 'feel', n: 'Feel-good shooting', d: 'Mid catch, mid pull-ups, cuts, catch-and-shoot 3s, a few off the bounce, free throws', w: { midCatch: 20, midMove: 20, midCut: 5, cut3: 5, catch3: 25, move3: 15, ft: 10 } },
  { id: 'catch', n: 'Catch & shoot', d: 'Mostly catch-and-shoot, mid and 3', w: { midCatch: 35, catch3: 45, cut3: 10, ft: 10 } },
  { id: 'threes', n: '3s only', d: 'Catch, cut and off-the-dribble threes', w: { catch3: 55, move3: 25, cut3: 20 } },
  { id: 'mid', n: 'Mid-range day', d: 'Pull-ups, catch, cuts and floaters', w: { midMove: 35, midCatch: 30, midCut: 10, float: 15, ft: 10 } },
  { id: 'movement', n: 'Movement 3s', d: 'Pin-downs, flares, relocations, transition catch 3s', w: { pin3: 25, flare3: 20, reloc3: 20, trans3: 15, catch3: 10, ft: 10 } },
  { id: 'create', n: 'Shot creation', d: 'Hesi pulls, snatchbacks, step-backs, contested mids, bump and spin fades', w: { hesi: 20, snatch: 15, stepback: 15, contMid: 15, bump: 10, spin: 10, turn: 5, ft: 10 } },
  { id: 'transition', n: 'Transition day', d: 'Transition pull-ups, transition catch 3s, runners', w: { transPull: 35, trans3: 35, runner: 15, ft: 15 } },
];
function spState() {
  if (!S.spots || typeof S.spots !== 'object') S.spots = { mins: 30, reb: 'solo', plan: {}, sel: 'lc3', seed: 0, mine: false };
  if (!S.spots.plan) S.spots.plan = {}; if (!SP_REB[S.spots.reb]) S.spots.reb = 'solo';
  if (!Array.isArray(S.shotPlans)) S.shotPlans = [];
  return S.spots;
}
function spById(id) { return SPOTS.filter(function (s) { return s.id === id; })[0] || null; }
/* tracked pace from Shot Lab sessions (attempts per minute) */
function spTracked() {
  var ss = S.sessions.filter(function (s) { return s.shotlab && s.minutes >= 3; }).slice(-10);
  if (ss.length < 3) return null;
  var att = sum(ss, function (s) { return sessionTotals(s).att; }), mins = sum(ss, function (s) { return s.minutes; });
  return mins ? { rate: att / mins, n: ss.length } : null;
}
function spRate(type) {
  var st = spState(), tr = st.mine ? spTracked() : null;
  if (tr) return Math.max(0.5, tr.rate * ((SP_RATE[type] || 2.2) / 2.8));
  return (SP_RATE[type] || 2.2) * (/ft$/.test(type) ? Math.min(1.8, SP_REB[st.reb][2]) : SP_REB[st.reb][2]);
}
function spPresetRate(w) { var tot = 0, secs = 0; Object.keys(w).forEach(function (k) { tot += w[k]; secs += w[k] / spRate(SP_CATS[k].t); }); return secs ? tot / secs : 3; }
function spCapacity() { var st = spState(); return Math.max(5, Math.floor((st.mins * spPresetRate(SP_PRESETS[0].w)) / 5) * 5); }
function spTotals() {
  var p = spState().plan, shots = 0, mins = 0, spots = 0;
  Object.keys(p).forEach(function (id) { var any = 0; Object.keys(p[id]).forEach(function (t) { var n = p[id][t] || 0; if (n > 0) { shots += n; mins += n / spRate(t); any = 1; } }); spots += any; });
  return { shots: shots, mins: mins, spots: spots };
}
function spFill(w, total, seed) {
  var plan = {}, tw = 0; Object.keys(w).forEach(function (k) { tw += w[k]; });
  Object.keys(w).forEach(function (k, ci) {
    var c = SP_CATS[k], n = Math.round((total * w[k] / tw) / 5) * 5; if (n <= 0) return;
    var chunks = n / 5, per = {}, i = 0, off = (seed + ci) % c.s.length;
    /* hand out 5s, then bump to 10s once every spot has some, so spots stay meaningful */
    var maxSpots = Math.max(1, Math.min(c.s.length, Math.ceil(chunks / 2)));
    while (chunks > 0) { var id = c.s[(off + (i % maxSpots)) % c.s.length]; per[id] = (per[id] || 0) + 5; chunks--; i++; }
    Object.keys(per).forEach(function (id) { plan[id] = plan[id] || {}; plan[id][c.t] = (plan[id][c.t] || 0) + per[id]; });
  });
  return plan;
}
function spSteps(plan) {
  var steps = [], order = SPOTS.filter(function (s) { return s.id !== 'ft'; }).concat([spById('ft')]);
  var ord = Object.keys(SHOT_TYPES); order.forEach(function (s) { var p = plan[s.id]; if (!p) return; Object.keys(p).sort(function (a, b) { var x = ord.indexOf(a), y = ord.indexOf(b); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); }).forEach(function (t) { if (p[t] > 0) steps.push([s.zone, t, p[t], s.n, s.id]); }); });
  return steps;
}
function spPlanFromSteps(steps) { var plan = {}; steps.forEach(function (s) { var id = s[4]; if (!id || !spById(id)) return; plan[id] = plan[id] || {}; plan[id][s[1]] = (plan[id][s[1]] || 0) + s[2]; }); return plan; }
function spSyncPresets() {
  for (var i = SHOT_PRESETS.length - 1; i >= 0; i--) if (String(SHOT_PRESETS[i].id).indexOf('sp-') === 0) SHOT_PRESETS.splice(i, 1);
  (S.shotPlans || []).forEach(function (r) { SHOT_PRESETS.push({ id: r.id, name: r.name, desc: 'Your Spot Map routine · ' + r.steps.length + ' stops', steps: r.steps }); });
}
function spCourt() {
  var st = spState(), p = st.plan;
  var g = SPOTS.map(function (s) {
    var n = 0; Object.keys(p[s.id] || {}).forEach(function (t) { n += p[s.id][t] || 0; });
    var on = st.sel === s.id;
    return '<g class="sp-spot' + (on ? ' on' : '') + (n ? ' has' : '') + '" data-a="sp-spot" data-id="' + s.id + '" tabindex="0" role="button" aria-label="' + esc(s.n) + (n ? ', ' + n + ' shots' : '') + '">' +
      '<circle class="hit" cx="' + s.x + '" cy="' + s.y + '" r="26"></circle><circle cx="' + s.x + '" cy="' + s.y + '" r="' + (n ? 17 : 13) + '"></circle>' + (n ? '<text x="' + s.x + '" y="' + (s.y + 5) + '">' + n + '</text>' : '<text class="plus" x="' + s.x + '" y="' + (s.y + 5) + '">+</text>') + '</g>';
  }).join('');
  return '<svg class="sp-court" viewBox="0 0 500 360" role="group" aria-label="Half court spot map. Tap a spot.">' +
    '<rect x="2" y="2" width="496" height="356" rx="10" class="fl"></rect>' +
    '<path class="ln" d="M2 10 H498"></path><rect class="ln paint" x="170" y="10" width="160" height="190"></rect>' +
    '<circle class="ln" cx="250" cy="200" r="60"></circle><path class="ln" d="M226 52 H274"></path><circle class="ln rim" cx="250" cy="62" r="9"></circle>' +
    '<path class="ln" d="M30 10 L30 150 A237 237 0 0 0 470 150 L470 10"></path><path class="ln" d="M215 62 A35 35 0 0 0 285 62"></path>' + g + '</svg>';
}
function spEditor() {
  var st = spState(), s = spById(st.sel) || SPOTS[0], p = st.plan[s.id] || {};
  return '<div class="sp-ed"><div class="row"><div><div class="kick">' + esc(s.zone) + '</div><h3>' + esc(s.n) + '</h3></div>' + (Object.keys(p).some(function (t) { return p[t] > 0; }) ? '<button class="btn sm g" data-a="sp-clear-spot">' + ic('x', 14) + ' Clear spot</button>' : '') + '</div>' +
    s.t.concat(Object.keys(p).filter(function (t) { return s.t.indexOf(t) < 0 && p[t] > 0; })).map(function (t) { var n = p[t] || 0; return '<div class="sp-row' + (n ? ' has' : '') + '"><span class="grow"><b>' + esc(SP_LONG[t]) + '</b><small>~' + (n ? Math.max(1, Math.round(n / spRate(t))) + ' min' : Math.round(spRate(t) * 10) / 10 + ' shots/min') + '</small></span>' +
      '<button class="sp-b" data-a="sp-inc" data-t="' + t + '" data-d="-5" ' + (n ? '' : 'disabled') + ' aria-label="5 fewer">−</button><b class="sp-n num">' + n + '</b><button class="sp-b" data-a="sp-inc" data-t="' + t + '" data-d="5" aria-label="5 more">+5</button><button class="sp-b" data-a="sp-inc" data-t="' + t + '" data-d="10" aria-label="10 more">+10</button></div>'; }).join('') +
    (function () { var more = shotTypesFor(shotWhere(s.zone)).length; return more > s.t.length ? '<details class="sp-more"' + (UI.spMore ? ' open' : '') + '><summary>' + ic('plus', 14) + ' More shot types here (' + more + ')</summary><p class="tiny muted">Tap one to add 5 at this spot.</p>' + shotTypeChips(null, 'sp-inc', shotWhere(s.zone), ' data-d="5"') + '</details>' : ''; })() + '</div>';
}
function viewSpots() {
  var st = spState(), cap = spCapacity(), tot = spTotals(), tr = spTracked(), steps = spSteps(st.plan);
  var over = tot.mins > st.mins + 1, fill = Math.min(100, (tot.mins / Math.max(1, st.mins)) * 100);
  return pageHead('Shooting', 'Spot Map', '<a class="btn sm g" href="#shots">' + ic('crosshair', 16) + ' Shot Lab</a>') +
    '<section class="panel sp-top"><div class="sp-set"><div><div class="kick">How much time?</div><div class="chips">' + [15, 20, 30, 45, 60].map(function (m) { return '<button class="chip' + (st.mins === m ? ' on' : '') + '" data-a="sp-mins" data-v="' + m + '">' + m + ' min</button>'; }).join('') +
    '<input class="sp-min" type="number" min="5" max="180" step="5" value="' + st.mins + '" data-c="sp-mins" aria-label="Minutes available"></div></div>' +
    '<div><div class="kick">Rebounds</div><div class="seg">' + Object.keys(SP_REB).map(function (k) { return '<button class="' + (st.reb === k ? 'on' : '') + '" data-a="sp-reb" data-v="' + k + '" title="' + esc(SP_REB[k][1]) + '">' + esc(SP_REB[k][0]) + '</button>'; }).join('') + '</div>' +
    (tr ? '<label class="tiny sp-mine"><input type="checkbox" data-c="sp-mine" ' + (st.mine ? 'checked' : '') + '> Use my tracked pace (' + (Math.round(tr.rate * 10) / 10) + ' shots/min over ' + tr.n + ' Shot Lab sessions)</label>' : '<p class="tiny muted" style="margin:6px 0 0">Estimate uses typical pace. After 3 Shot Lab sessions you can switch to your real pace.</p>') + '</div></div>' +
    '<div class="sp-cap"><span class="kick">You can get up about</span><b class="num">' + cap + '</b><span>shots in ' + st.mins + ' min</span><small class="muted">Estimate, not a promise. Pace changes with rest and reps.</small></div></section>' +
    '<div class="row sp-pre"><span class="kick">Quick fill</span><div class="chips">' + SP_PRESETS.map(function (p) { return '<button class="chip" data-a="sp-fill" data-v="' + p.id + '" title="' + esc(p.d) + '">' + (p.id === 'feel' ? ic('sparkles', 14) + ' ' : '') + esc(p.n) + '</button>'; }).join('') +
    (tot.shots ? '<button class="chip" data-a="sp-fill" data-v="again">' + ic('repeat', 14) + ' Shuffle spots</button><button class="chip" data-a="sp-clear">' + ic('x', 14) + ' Clear</button>' : '') + '</div></div>' +
    '<div class="grid g2 sp-main"><section class="panel"><div class="phead"><div><h3>Tap a spot</h3><div class="sub">Numbers show how many shots you set there</div></div></div>' + spCourt() + '</section>' +
    '<section class="panel">' + spEditor() +
    '<div class="hr"></div><div class="sp-tot"><div class="row"><b class="num">' + tot.shots + ' shots</b><span class="small ' + (over ? 'bad' : 'muted') + '">~' + Math.round(tot.mins) + ' of ' + st.mins + ' min' + (over ? ', over your time' : '') + '</span></div><div class="prog' + (over ? ' over' : '') + '"><i style="width:' + fill + '%"></i></div>' +
    (tot.shots && !over && tot.mins < st.mins - 4 ? '<p class="tiny muted">About ' + Math.floor(((st.mins - tot.mins) * spPresetRate(SP_PRESETS[0].w)) / 5) * 5 + ' more shots fit.</p>' : '') + '</div>' +
    (steps.length ? '<div class="sp-list">' + steps.map(function (s) { return '<button class="sp-li" data-a="sp-spot" data-id="' + s[4] + '"><span>' + esc(s[3]) + '</span><em>' + s[2] + ' ' + esc(SP_SHORT[s[1]]) + '</em></button>'; }).join('') + '</div>' +
      '<div class="row" style="margin-top:12px;gap:8px"><button class="btn" data-a="sp-start">' + ic('play', 16) + ' Start in Shot Lab</button>' +
      '<form data-form="sp-save" class="row sp-save"><input name="name" placeholder="Name this routine" maxlength="40" required><button class="btn sm g" type="submit">' + ic('star', 14) + ' Save</button></form></div>'
      : '<div class="empty" style="margin-top:10px"><b>No shots yet</b>Tap a spot on the court, or hit Feel-good shooting to fill your time.</div>') + '</section></div>' +
    (S.shotPlans.length ? '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>My routines</h3><div class="sub">Also show up as presets in Shot Lab</div></div></div><div class="list">' + S.shotPlans.map(function (r) { var n = sum(r.steps, function (s) { return s[2]; }); return '<div class="li"><div class="main"><b>' + esc(r.name) + '</b><div class="tiny">' + n + ' shots · ' + r.steps.length + ' stops</div></div><button class="btn sm g" data-a="sp-load" data-id="' + r.id + '">Edit</button><button class="btn sm" data-a="shot-start" data-id="' + r.id + '">' + ic('play', 14) + ' Start</button><button class="btn sm g" data-a="sp-del" data-id="' + r.id + '" aria-label="Delete">' + ic('x', 14) + '</button></div>'; }).join('') + '</div></section>' : '');
}
ACT['sp-spot'] = function (el) { spState().sel = el.dataset.id; save(); render(); };
ACT['sp-mins'] = function (el) { spState().mins = +el.dataset.v; save(); render(); };
CHG['sp-mins'] = function (el) { var v = Math.round(+el.value); if (!(v >= 5 && v <= 180)) { toast('Pick 5 to 180 minutes', 'warn'); render(); return; } spState().mins = v; save(); render(); };
CHG['sp-mine'] = function (el) { spState().mine = !!el.checked; save(); render(); };
ACT['sp-reb'] = function (el) { spState().reb = el.dataset.v; save(); render(); };
ACT['sp-inc'] = function (el) { var st = spState(), id = st.sel, t = el.dataset.t; if (el.closest('.sp-more')) UI.spMore = true; st.plan[id] = st.plan[id] || {}; var n = Math.max(0, Math.min(200, (st.plan[id][t] || 0) + (+el.dataset.d))); if (n) st.plan[id][t] = n; else delete st.plan[id][t]; if (!Object.keys(st.plan[id]).length) delete st.plan[id]; save(); render(); };
ACT['sp-clear-spot'] = function () { var st = spState(); delete st.plan[st.sel]; save(); render(); };
ACT['sp-clear'] = function () { spState().plan = {}; save(); render(); };
ACT['sp-fill'] = function (el) {
  var st = spState(), v = el.dataset.v;
  if (v === 'again') { st.seed = (st.seed || 0) + 1; v = st.lastFill || 'feel'; } else st.lastFill = v;
  var p = SP_PRESETS.filter(function (x) { return x.id === v; })[0] || SP_PRESETS[0];
  var cap = Math.max(5, Math.floor((st.mins * spPresetRate(p.w)) / 5) * 5);
  st.plan = spFill(p.w, cap, st.seed || 0); var first = spSteps(st.plan)[0]; if (first) st.sel = first[4];
  save(); render(); var t = spTotals(); toast(p.n + ': ' + t.shots + ' shots, about ' + Math.round(t.mins) + ' min');
};
ACT['sp-start'] = function () {
  if (shotRun()) { toast('Finish the current Shot Lab session first', 'warn'); location.hash = '#shots'; return; }
  var st = spState(), steps = spSteps(st.plan); if (!steps.length) return;
  S.shotRun = { id: uid(), preset: 'spots', name: 'Spot Map', steps: steps, idx: 0, log: [], zone: null, type: null, startedAt: Date.now() };
  save(); location.hash = '#shots'; render();
};
FORM['sp-save'] = function (f) {
  var name = f.name.value.trim(), steps = spSteps(spState().plan); if (!name || !steps.length) return;
  S.shotPlans.push({ id: 'sp-' + uid(), name: name.slice(0, 40), steps: steps, created: Date.now() }); spSyncPresets(); save(); toast('Saved “' + name + '”. It’s in Shot Lab too.'); render();
};
ACT['sp-load'] = function (el) { var r = S.shotPlans.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!r) return; var st = spState(); st.plan = spPlanFromSteps(r.steps); st.sel = r.steps[0] ? r.steps[0][4] : 'lc3'; save(); window.scrollTo(0, 0); render(); toast('Loaded “' + r.name + '”. Edit, then save under a new name.'); };
ACT['sp-del'] = function (el) { var k = 'sp-del-' + el.dataset.id; if (UI.armed !== k) { UI.armed = k; toast('Tap delete again to remove this routine', 'warn'); return; } UI.armed = null; S.shotPlans = S.shotPlans.filter(function (x) { return x.id !== el.dataset.id; }); spSyncPresets(); save(); render(); };
ACT['sp-mode'] = function (el) { var o = bState().opts; o.mode = el.dataset.v; if (o.mode === 'rhythm') o.intensity = 'skill'; if (o.mode === 'game') o.intensity = 'game'; save(); location.hash = '#builder'; };

/* ---------- CLA: your finishing + what "game-like" means here ---------- */
(function () {
  var add = [
    DR({ slug: 'glass-finishing', name: 'Continuous Glass Finishing', cat: 'Finishing', diff: 3, sec: ['Footwork'], min: 8, sets: 4, att: 10, metric: 'makes',
      obj: 'Non-stop finishing off the backboard. Every rep looks a little different, so your body solves it instead of repeating one pattern.',
      ins: 'Toss the ball off the glass, go get it and finish right hand. Catch it out of the net in the air, finish left hand. Keep it continuous: no resets, no standing still. Change the variation every set.',
      coach: ['Catch it at its highest point', 'Never let it hit the floor if you can help it', 'Change the angle and the foot every few reps', 'Finish with the hand away from the defender'],
      prog: ['One-foot and two-foot finishes mixed', 'Reverse finishes off the toss', 'Add contact: pad or chair on the landing', 'Off-hand only set', 'Toss from farther out so you have to sprint'],
      reg: ['Toss softer and closer', 'Strong hand only to start'] }),
    DR({ slug: 'cla-shooting', name: 'Constraint Catch-and-Shoot', cat: 'Shooting', diff: 3, sec: ['Movement'], min: 10, sets: 5, att: 10, metric: 'makes',
      obj: 'Catch-and-shoot where the rules change every set, so the shot adapts like it does in games.',
      ins: 'Pick one constraint per set: catch on the move off a self-pass, shoot within 1 second, a closeout (chair or partner) on every catch, a random spot called out, or one dribble max to a side. Same shot, different problem each time.',
      coach: ['Feet ready before the ball arrives', 'Same release, different footwork', 'Track makes per constraint'],
      prog: ['Stack two constraints', 'Add fatigue: sprint before each catch'], reg: ['Stationary catch with the constraint only on timing'] }),
  ];
  add.forEach(function (d) { if (!DRILLS.some(function (x) { return x.id === d.id; })) DRILLS.push(d); });
  MODE_MAP['d-glass-finishing'] = ['game', 'skill', 'creative'];
  MODE_MAP['d-cla-shooting'] = ['game'];
  MODES.game.n = 'Game-like (CLA)';
  MODES.game.d = 'Constraints-led: change the task, the space, the time or the rules so you solve problems like in a game, instead of repeating one perfect rep.';
  MODES.game.ex = 'Continuous glass finishing, shot clock off the catch, one dribble max, random spot calls, contact on the landing.';
  if (GAME_LAYERS.Finishing.indexOf('Continuous: catch it out of the net in the air, next finish, no resets') < 0) GAME_LAYERS.Finishing.unshift('Continuous: catch it out of the net in the air, next finish, no resets');
})();

/* ---------- wiring: route, Train "pick a type", Shot Lab button, sidebar ---------- */
(function () {
  spState(); spSyncPresets();
  var _rv = routeView; routeView = function (r) { if (r === 'spots') { spState(); return viewSpots(); } return _rv(r); };
  Object.assign(TAB_OF, { spots: 'shots' });
  function typesHTML() {
    var cards = [['#spots', 'crosshair', 'Feel-good shooting', 'Spot map: tap spots, set shots, fits your time', '#ff913d', '']]
      .concat(MODE_ORDER.map(function (m) { return [null, MODES[m].ic, MODES[m].n, MODES[m].d, MODES[m].c, m]; }));
    return '<section class="panel sp-types"><div class="phead"><div><h3>What kind of workout?</h3><div class="sub">Tap a type. Shooting opens the spot map, the rest open the builder set to that type.</div></div></div><div class="sp-tgrid">' +
      cards.map(function (c) { var inner = '<span class="sp-ti" style="--mc:' + c[4] + '">' + ic(c[1], 20) + '</span><b>' + esc(c[2]) + '</b><small>' + esc(c[3]) + '</small>'; return c[0] ? '<a class="sp-tc" href="' + c[0] + '">' + inner + '</a>' : '<button class="sp-tc" data-a="sp-mode" data-v="' + c[5] + '">' + inner + '</button>'; }).join('') + '</div></section>';
  }
  var _train = viewTrain; viewTrain = function () { var h = _train(), k = '</a>', i = h.indexOf('class="build-banner"'); if (i < 0) return typesHTML() + h; var j = h.indexOf(k, i) + k.length; return h.slice(0, j) + typesHTML() + h.slice(j); };
  var _shots = viewShots; viewShots = function () { var h = _shots(); if (shotRun()) return h; return h.replace('<div class="presets">', '<div class="presets"><a class="preset sp-preset" href="#shotbook"><b>' + ic('book-open', 16) + ' Shot Book</b><span>' + Object.keys(SHOT_LIB).length + ' shot types: pin-downs, flares, snatchbacks, spin fades and more. Add your own.</span><em>Open ' + ic('arrow-right', 14) + '</em></a><a class="preset sp-preset" href="#spots"><b>' + ic('crosshair', 16) + ' Spot Map</b><span>Tap spots on a court, set shots per spot, fit it to your time</span><em>Build ' + ic('arrow-right', 14) + '</em></a>'); };
  document.addEventListener('toggle', function (e) { if (e.target && e.target.classList && e.target.classList.contains('sp-more')) UI.spMore = e.target.open; }, true);
  var sl0 = $('.side a[data-r="shots"]'); if (sl0 && !$('.side a[data-r="shotbook"]')) sl0.insertAdjacentHTML('afterend', '<a href="#shotbook" data-r="shotbook"><i>' + ic('book-open', 20) + '</i>Shot Book</a>');
  var sl = $('.side a[data-r="shots"]'); if (sl && !$('.side a[data-r="spots"]')) sl.insertAdjacentHTML('afterend', '<a href="#spots" data-r="spots"><i>' + ic('circle-dot', 20) + '</i>Spot Map</a>');
  render();
})();
