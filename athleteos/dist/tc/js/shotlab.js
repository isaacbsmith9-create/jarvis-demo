/* ==================== Shot Lab: live make/miss tracking, shot charts, splits ====================
   Sessions save as normal sessions (one item per shot type, sets carry zone + type), so analytics, records and goals all see them. */
var SL = { range: 30, type: 'all' };
function shotSets(from, to) {
  var out = [];
  (from ? rangeSessions(from, to) : S.sessions).forEach(function (s) { s.items.forEach(function (i) { if (i.metric !== 'makes') return; var d = drillById(i.drillId), cat = d ? d.category : i.category;
    i.sets.forEach(function (x) { if (!(x.att > 0)) return; out.push({ date: s.date, zone: x.zone || (d && d.zone) || null, type: x.type || (i.drillId && i.drillId.indexOf('shot-') === 0 ? i.drillId.slice(5) : null), att: x.att, made: x.made || 0, lab: !!s.shotlab, cat: cat }); }); }); });
  return out;
}
var THREES = ['Corner 3', 'Wing 3', 'Top 3', 'Deep 3'];
function splitStats(sets) {
  var z = {}, t = {}, tot = { att: 0, made: 0 }, three = { att: 0, made: 0 }, ft = { att: 0, made: 0 };
  sets.forEach(function (x) { tot.att += x.att; tot.made += x.made; if (x.zone) { z[x.zone] = z[x.zone] || { att: 0, made: 0 }; z[x.zone].att += x.att; z[x.zone].made += x.made; }
    if (x.type) { t[x.type] = t[x.type] || { att: 0, made: 0 }; t[x.type].att += x.att; t[x.type].made += x.made; }
    if (THREES.indexOf(x.zone) >= 0) { three.att += x.att; three.made += x.made; } if (x.zone === 'Free throw' || x.type === 'ft') { ft.att += x.att; ft.made += x.made; } });
  return { z: z, t: t, tot: tot, three: three, ft: ft };
}
function shotRun() { return S.shotRun && Array.isArray(S.shotRun.log) ? S.shotRun : null; }
function curStep(r) { return r.steps[r.idx] || null; }
function curLog(r) { var st = curStep(r), z = st ? st[0] : r.zone, ty = st ? st[1] : r.type; var x = r.log.filter(function (l) { return l.step === r.idx && l.zone === z && l.type === ty; })[0]; if (!x) { x = { step: r.idx, zone: z, type: ty, made: 0, att: 0 }; r.log.push(x); } return x; }

function viewShots() {
  var r = shotRun(); if (r) return shotTracker(r);
  var t = today(), from = SL.range === 'all' ? null : addDays(t, -(SL.range - 1)), sets = shotSets(from, t).filter(function (x) { return SL.type === 'all' || x.type === SL.type; }), st = splitStats(sets);
  var weeks = []; for (var i = 7; i >= 0; i--) { var ws = addDays(weekStart(t), -7 * i), s2 = splitStats(shotSets(ws, addDays(ws, 6))); weeks.push({ x: fmtDay(ws, { month: 'numeric', day: 'numeric' }), y: s2.tot.att >= 10 ? pct(s2.tot.made, s2.tot.att) : null, title: 'Week of ' + fmtDay(ws) + ': ' + (s2.tot.att ? s2.tot.made + '/' + s2.tot.att : 'no shots') }); }
  var labs = S.sessions.filter(function (s) { return s.shotlab; }).slice(-6).reverse();
  var zones = Object.keys(st.z).sort(function (a, b) { return st.z[b].att - st.z[a].att; });
  return pageHead('Shot Lab', 'Track every shot', '') +
    '<section class="panel hero shot-hero"><div><div class="kick">Start a shooting session</div><h2>Tap make or miss. See the truth.</h2><p class="ink2 small">Pick a routine. Big buttons for one-handed tapping between shots. Every attempt feeds your shot chart, ratings and coach plan.</p></div><div class="presets">' +
    SHOT_PRESETS.map(function (p) { var n = sum(p.steps, function (s) { return s[2]; }); return '<button class="preset" data-a="shot-start" data-id="' + p.id + '"><b>' + esc(p.name) + '</b><span>' + esc(p.desc) + '</span><em>' + (n ? n + ' shots' : 'Open') + ' ' + ic('arrow-right', 14) + '</em></button>'; }).join('') + '</div></section>' +
    '<div class="row" style="margin:18px 0 10px"><div class="seg">' + [[7, '7 days'], [30, '30 days'], ['all', 'All time']].map(function (o) { return '<button class="' + (SL.range === o[0] ? 'on' : '') + '" data-a="sl-range" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div><div class="chips">' + [['all', 'All shots']].concat(shotTypesUsed(from, t).map(function (k) { return [k, SHOT_SHORT[k] || SHOT_TYPES[k]]; })).map(function (o) { return '<button class="chip' + (SL.type === o[0] ? ' on' : '') + '" data-a="sl-type" data-v="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join('') + '</div></div>' +
    (sets.length ? '<div class="grid g4">' + kpi(fmtPct(pct(st.tot.made, st.tot.att)), 'Field goal %', '', st.tot.made + ' of ' + st.tot.att) + kpi(fmtPct(pct(st.three.made, st.three.att)), '3-point %', '', st.three.att ? st.three.made + ' of ' + st.three.att : 'no threes') + kpi(fmtPct(pct(st.ft.made, st.ft.att)), 'Free throw %', '', st.ft.att ? st.ft.made + ' of ' + st.ft.att : 'none') + kpi(st.tot.att, 'Shots tracked', '', SL.range === 'all' ? 'all time' : 'last ' + SL.range + ' days') + '</div>' +
      '<div class="grid g2" style="margin-top:14px"><section class="panel"><div class="phead"><div><h3>Shot chart</h3><div class="sub">Make % by zone. Green 45%+, purple 30–44%, red under 30%.</div></div></div>' + courtSVG(st.z, {}) + '</section>' +
      '<section class="panel"><div class="phead"><div><h3>Shot diet</h3><div class="sub">Where your attempts come from</div></div></div>' + (zones.length ? zones.map(function (zn) { var x = st.z[zn], share = Math.round((x.att / st.tot.att) * 100); return '<div class="diet"><div class="row"><b>' + esc(zn) + '</b><span class="tiny num">' + x.made + '/' + x.att + ' · <b class="' + (pct(x.made, x.att) >= 45 ? 'good' : pct(x.made, x.att) >= 30 ? '' : 'bad') + '">' + pct(x.made, x.att) + '%</b></span></div><div class="bar"><i style="width:' + share + '%"></i></div><span class="tiny">' + share + '% of attempts</span></div>'; }).join('') : '<div class="empty">No zones recorded. Shot Lab records the zone automatically.</div>') +
      (Object.keys(st.t).length ? '<div class="hr"></div><h4>By shot type</h4><div class="list">' + Object.keys(st.t).map(function (k) { var x = st.t[k]; return '<div class="li"><div class="main"><b>' + esc(SHOT_TYPES[k] || k) + '</b></div><span class="num small">' + x.made + '/' + x.att + '</span><span class="tag ' + (pct(x.made, x.att) >= 45 ? 'g' : pct(x.made, x.att) >= 30 ? 'p' : 'b') + '">' + pct(x.made, x.att) + '%</span></div>'; }).join('') + '</div>' : '') + '</section></div>' +
      '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Trend</h3><div class="sub">Weekly make %, weeks with 10+ shots</div></div></div>' + (lineChart(weeks, { label: 'Weekly make percentage', fmt: function (v) { return Math.round(v) + '%'; } }) || '<div class="empty">Two weeks of shooting draws the trend line.</div>') + '</section>'
      : '<div class="empty" style="margin-top:6px"><b>No shots tracked ' + (SL.range === 'all' ? 'yet' : 'in this range') + '</b>Start a routine above. Shooting drills from your workouts count here too.</div>') +
    (labs.length ? '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Recent Shot Lab sessions</h3></div></div><div class="list">' + labs.map(function (s) { var tt = sessionTotals(s); return '<a class="tapwrap" href="#session-' + s.id + '"><div class="main"><b class="nm">' + esc(s.workoutName.replace('Shot Lab: ', '')) + '</b><div class="tiny">' + esc(fmtDay(s.date)) + ' · ' + s.minutes + ' min</div></div><span class="num">' + tt.made + '/' + tt.att + '</span><span class="tag ' + (tt.pct >= 45 ? 'g' : 'p') + '">' + fmtPct(tt.pct) + '</span></a>'; }).join('') + '</div></section>' : '');
}
function shotTracker(r) {
  var st = curStep(r), x = curLog(r), all = splitStats(r.log), target = st ? st[2] : null, zone = st ? st[0] : r.zone, type = st ? st[1] : r.type;
  var mins = Math.max(0, Math.round((Date.now() - r.startedAt) / 60000));
  return '<div class="tracker"><div class="row"><div><div class="kick">' + esc(r.name) + ' · ' + mins + ' min</div><h1 class="num">' + all.tot.made + '<span class="muted">/' + all.tot.att + '</span> <small class="' + (pct(all.tot.made, all.tot.att) >= 45 ? 'good' : '') + '">' + fmtPct(pct(all.tot.made, all.tot.att)) + '</small></h1></div><div class="btns"><button class="btn sm" data-a="shot-finish">' + ic('check', 15) + ' Finish & save</button><button class="btn sm g d" data-a="shot-discard">Discard</button></div></div>' +
    (r.steps.length ? '<div class="steps">' + r.steps.map(function (s, i) { var l = r.log.filter(function (q) { return q.step === i; })[0]; return '<button class="stp' + (i === r.idx ? ' on' : '') + (l && l.att >= s[2] ? ' done' : '') + '" data-a="shot-step" data-i="' + i + '"><b>' + esc(s[3] ? s[3] + ' · ' + (SHOT_SHORT[s[1]] || SHOT_TYPES[s[1]] || '') : s[0]) + '</b><span>' + (l ? l.made + '/' + l.att : '0/' + s[2]) + '</span></button>'; }).join('') + '</div>' : '') +
    '<div class="grid g2 trk"><div class="spot"><div class="kick">' + (st ? 'Spot ' + (r.idx + 1) + ' of ' + r.steps.length : 'Free shooting') + '</div><h2>' + esc((st && st[3]) || zone || 'Pick a zone') + '</h2><div class="ink2">' + esc(SHOT_TYPES[type] || 'Pick a shot type') + '</div>' +
    (!st ? '<div class="sb-pick">' + shotTypeChips(r.type, 'shot-type', shotWhere(r.zone)) + '</div><p class="tiny">Tap a zone on the court to change spots.</p>' : '') +
    '<div class="count num">' + x.made + '<span>/' + x.att + (target ? ' of ' + target : '') + '</span></div>' + (target ? '<div class="prog"><i style="width:' + Math.min(100, (x.att / target) * 100) + '%"></i></div>' : '') +
    '<div class="mm"><button class="make" data-a="shot-mark" data-v="1" ' + (zone && type ? '' : 'disabled') + '>' + ic('check', 30) + '<span>Make</span></button><button class="miss" data-a="shot-mark" data-v="0" ' + (zone && type ? '' : 'disabled') + '>' + ic('x', 30) + '<span>Miss</span></button></div><button class="btn sm g" data-a="shot-undo" ' + (x.att ? '' : 'disabled') + '>' + ic('rotate-ccw', 14) + ' Undo last</button>' + (st && r.idx < r.steps.length - 1 ? ' <button class="btn sm g" data-a="shot-step" data-i="' + (r.idx + 1) + '">Next spot ' + ic('chevron-right', 14) + '</button>' : '') + '</div>' +
    '<div class="court-pick" ' + (st ? '' : 'data-pick="1"') + '>' + courtSVG(all.z, { selected: zone }) + '<p class="tiny" style="text-align:center">Keys: M = make, N = miss, U = undo</p></div></div></div>';
}
ACT['shot-start'] = function (el) {
  if (shotRun()) { toast('Finish the current Shot Lab session first', 'warn'); return; }
  var p = SHOT_PRESETS.find(function (x) { return x.id === el.dataset.id; });
  S.shotRun = { id: uid(), preset: p.id, name: p.name, steps: p.steps.map(function (s) { return s.slice(); }), idx: 0, log: [], zone: p.steps.length ? null : 'Wing 3', type: p.steps.length ? null : 'catch', startedAt: Date.now() };
  save(); location.hash = '#shots'; render();
};
ACT['shot-mark'] = function (el) {
  var r = shotRun(); if (!r) return; var x = curLog(r), st = curStep(r); x.att++; if (el.dataset.v === '1') x.made++;
  if (navigator.vibrate) try { navigator.vibrate(el.dataset.v === '1' ? 25 : [15, 40, 15]); } catch (e) { /* optional */ }
  if (st && x.att >= st[2] && r.idx < r.steps.length - 1) { r.idx++; toast(x.made + '/' + x.att + ' there. Next: ' + (r.steps[r.idx][3] || r.steps[r.idx][0])); }
  else if (st && x.att >= st[2]) toast('Routine done: tap Finish & save');
  save(); render();
};
ACT['shot-undo'] = function () { var r = shotRun(); if (!r) return; var x = curLog(r); if (!x.att) return; x.att--; if (x.made > x.att) x.made = x.att; save(); render(); };
ACT['shot-step'] = function (el) { var r = shotRun(); if (!r) return; r.idx = +el.dataset.i; save(); render(); };
ACT['shot-type'] = function (el) { var r = shotRun(); if (!r) return; r.type = el.dataset.v; save(); render(); };
ACT['shot-discard'] = function () { if (UI.armed !== 'shot-discard') { UI.armed = 'shot-discard'; toast('Tap Discard again to throw this session away', 'warn'); return; } UI.armed = null; S.shotRun = null; save(); render(); };
ACT['shot-finish'] = function () {
  var r = shotRun(); if (!r) return; var log = r.log.filter(function (l) { return l.att > 0; });
  if (!log.length) { S.shotRun = null; save(); render(); toast('Nothing tracked, session closed'); return; }
  var byType = {}; log.forEach(function (l) { (byType[l.type] = byType[l.type] || []).push({ att: l.att, made: l.made, zone: l.zone, type: l.type }); });
  var now = Date.now(), session = { id: 's-' + uid(), date: dayKey(now), endedAt: now, startedAt: r.startedAt, minutes: Math.max(1, Math.round((now - r.startedAt) / 60000)), workoutId: null, workoutName: 'Shot Lab: ' + r.name, shotlab: true,
    items: Object.keys(byType).map(function (k) { return { drillId: 'shot-' + k, name: SHOT_TYPES[k] || k, category: (SHOT_LIB[k] && SHOT_LIB[k].fam === 'touch' && k !== 'hook') ? 'Finishing' : 'Shooting', metric: 'makes', sets: byType[k], status: 'done', reps: 0, goodReps: 0, seconds: 0 }; }), completionPct: 100, rpe: null, planId: null, notes: '', location: '' };
  var res = commitSession(session); S.shotRun = null; save(); var t = sessionTotals(session);
  toast('Saved: ' + t.made + '/' + t.att + ' (' + t.pct + '%)' + (res && res.records && res.records.length ? ' · ' + res.records[0].title : '')); location.hash = '#shots'; render();
};
ACT['sl-range'] = function (el) { SL.range = el.dataset.v === 'all' ? 'all' : +el.dataset.v; render(); };
ACT['sl-type'] = function (el) { SL.type = el.dataset.v; render(); };
document.addEventListener('click', function (e) { var z = e.target.closest && e.target.closest('.court-pick[data-pick] .zone'); if (!z) return; var r = shotRun(); if (!r) return; r.zone = z.dataset.zone; save(); render(); });
document.addEventListener('keydown', function (e) { if (!shotRun() || (location.hash || '') !== '#shots' || /input|textarea|select/i.test((e.target && e.target.tagName) || '')) return; var k = e.key.toLowerCase(); var b = k === 'm' ? $('[data-a="shot-mark"][data-v="1"]') : k === 'n' ? $('[data-a="shot-mark"][data-v="0"]') : k === 'u' ? $('[data-a="shot-undo"]') : null; if (b && !b.disabled) { e.preventDefault(); b.click(); } });
