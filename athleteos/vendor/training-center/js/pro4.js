/* ==================== Daily windows: one main session + short quick hits around school and practice ==================== */
var QUICK = [
  { k: 'finish', n: 'Finishing quick hit', mode: 'skill', focus: ['Finishing'] },
  { k: 'handle', n: 'Ball-handling quick hit', mode: 'skill', focus: ['Ball Handling'] },
  { k: 'game', n: '15-min game-like burst', mode: 'game', focus: ['Shooting', 'Finishing'] },
  { k: 'shots', n: 'Light shooting', mode: 'rhythm', focus: ['Shooting'] },
  { k: 'creative', n: 'Creative quick hit', mode: 'creative', focus: ['Finishing', 'Ball Handling'] },
];
function dayCfg() { var w = weekState(); if (!w.practiceStart) w.practiceStart = '15:00'; if (!w.practiceMins) w.practiceMins = 150; if (!w.perDay) w.perDay = 3; if (!w.quickMins) w.quickMins = 15; if (!w.schoolEnd) w.schoolEnd = '12:45'; return w; }
function fmt12(t) { var p = t.split(':'), h = +p[0], m = p[1]; return (h % 12 || 12) + ':' + m + (h < 12 ? 'am' : 'pm'); }
function addMin(t, m) { var p = t.split(':'), x = (+p[0]) * 60 + (+p[1]) + m; return pad(Math.floor(x / 60) % 24) + ':' + pad(x % 60); }
function slotsFor(date) {
  var w = dayCfg(), dw = keyDate(date).getDay(), prac = w.practice.indexOf(dw) >= 0, game = w.games.indexOf(dw) >= 0;
  if (prac) return [{ s: 'am', n: 'Before school' }, { s: 'pre', n: 'After school', t: 'before ' + fmt12(w.practiceStart) + ' practice' }, { s: 'post', n: 'After practice', t: 'after ' + fmt12(addMin(w.practiceStart, w.practiceMins)) }];
  if (game) return [{ s: 'am', n: 'Morning' }, { s: 'pre', n: 'Pre-game' }, { s: 'pm', n: 'Evening' }];
  return [{ s: 'am', n: 'Morning' }, { s: 'mid', n: 'Midday' }, { s: 'pm', n: 'Evening' }];
}
/* What goes in each window. Only the main session can be hard; quick hits stay short and light. */
function dayRecipe(date, idx) {
  var w = dayCfg(), dm = dayMode(date), dw = keyDate(date).getDay(), prac = w.practice.indexOf(dw) >= 0, game = w.games.indexOf(dw) >= 0, before = w.games.indexOf((dw + 1) % 7) >= 0;
  var rot = function (opts) { return opts[(idx + hashStr(date)) % opts.length]; }, q = [];
  if (game) return { main: 'pre', quick: [] };
  if (before) q = [{ slot: 'pm', pick: rot(['handle', 'shots']) }];
  else if (prac) q = [{ slot: 'post', pick: rot(['finish', 'handle', 'game', 'creative']) }, { slot: 'am', pick: rot(['shots', 'handle']) }];
  else q = [{ slot: 'am', pick: 'shots' }, { slot: 'pm', pick: rot(['handle', 'finish', 'creative']) }];
  if (dm.m === 'game') q = q.filter(function (x) { return x.pick !== 'game'; });
  return { main: prac ? 'pre' : game ? 'pre' : 'mid', quick: q.slice(0, Math.max(0, w.perDay - 1)) };
}
(function () {
  var _build = buildCoachWeek;
  buildCoachWeek = function (ws) {
    var n = _build(ws), w = dayCfg(), lvl = { 'Freshman / JV': 2, JV: 2, Varsity: 3, 'Varsity starter': 3, 'Club / AAU': 3, Other: 3 }[S.profile.level] || 3, gear = (bState().opts || {}).gear || [], i = 0;
    S.plan.filter(function (p) { return p.coach && !p.quick && p.date >= ws && p.date <= addDays(ws, 6) && p.status !== 'done' && p.date >= today(); }).forEach(function (p) {
      var rc = dayRecipe(p.date, i++); p.slot = rc.main; var sl = slotsFor(p.date).find(function (x) { return x.s === rc.main; }); p.slotName = sl ? sl.n : '';
      rc.quick.forEach(function (qq) {
        if (S.plan.some(function (x) { return x.date === p.date && x.quick && x.slot === qq.slot; })) return;
        var Q = QUICK.find(function (x) { return x.k === qq.pick; }), g = genWorkout({ mins: w.quickMins, level: lvl, focus: Q.focus, partner: false, gear: gear, court: 'half', intensity: Q.mode === 'rhythm' ? 'skill' : 'game', mode: Q.mode }, p.date + qq.slot);
        var items = g.blocks.filter(function (bl) { return bl.name !== 'Warm-up' || g.blocks.length === 1; }).reduce(function (a, bl) { return a.concat(bl.items.map(function (it) { return { drillId: it.drillId, name: it.name, category: it.category, metric: it.metric, targetSets: it.targetSets, targetAttempts: it.targetAttempts, restSec: it.restSec, timeLimitSec: 0, goal: it.goal || null, layer: it.layer || null }; })); }, []);
        if (!items.length) return;
        var mins = Math.max(8, bTotal({ blocks: [{ items: g.blocks.filter(function (bl) { return bl.name !== 'Warm-up' || g.blocks.length === 1; }).reduce(function (a, bl) { return a.concat(bl.items); }, []) }] })), wid = 'w-coach-q' + uid();
        S.workouts.push({ id: wid, name: Q.n, category: Q.focus[0], objective: 'Short, light session in the gaps of your day.', minutes: mins, difficulty: 2, warmup: '', notes: '', template: false, custom: true, coach: true, mode: Q.mode, created: Date.now(), items: items });
        var sl2 = slotsFor(p.date).find(function (x) { return x.s === qq.slot; });
        S.plan.push({ id: 'p-coach-' + uid(), title: 'Quick: ' + Q.n, date: p.date, type: 'workout', minutes: mins, workoutId: wid, status: 'planned', created: Date.now(), coach: true, quick: true, mode: Q.mode, slot: qq.slot, slotName: sl2 ? sl2.n : '', reason: 'Quick hit (' + mins + ' min). Light work in the gaps; your main session is the only hard one.' });
      });
    });
    save(); return n;
  };
  var _cwi = coachWeekItems;
  coachWeekItems = function (ws) { return _cwi(ws).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.quick ? 1 : 0) - (b.quick ? 1 : 0); }); };
})();
var SLOT_ORDER = { am: 0, pre: 1, mid: 1, post: 2, pm: 2 };
function dayItems(date) { return S.plan.filter(function (p) { return p.date === date && p.type === 'workout' && (p.coach || p.workoutId); }).sort(function (a, b) { return (SLOT_ORDER[a.slot] == null ? 1 : SLOT_ORDER[a.slot]) - (SLOT_ORDER[b.slot] == null ? 1 : SLOT_ORDER[b.slot]); }); }
function weekLoad(ws) {
  var w = dayCfg(), prac = 0, games = 0, extra = 0, hard = 0, quick = 0;
  for (var i = 0; i < 7; i++) { var d = addDays(ws, i), dw = keyDate(d).getDay(); if (w.practice.indexOf(dw) >= 0) prac += w.practiceMins; if (w.games.indexOf(dw) >= 0) games += 90; }
  S.plan.filter(function (p) { return p.date >= ws && p.date <= addDays(ws, 6) && p.type === 'workout'; }).forEach(function (p) { extra += p.minutes || 0; if (p.quick) quick++; else if (p.mode === 'game') hard++; });
  var done = rangeMinutes(ws, addDays(ws, 6));
  return { prac: prac, games: games, extra: extra, hard: hard, quick: quick, done: done, total: prac + games + extra };
}
function loadMeter(ws) {
  var L = weekLoad(ws), tot = L.total || 1, hrs = function (m) { return (m / 60).toFixed(1).replace(/\.0$/, '') + 'h'; };
  var lvl = L.total > 1500 ? ['High', 'var(--bad)', 'Lots of volume. Keep quick hits light and protect sleep.'] : L.total > 1100 ? ['Solid', 'var(--warn)', 'Good working week. Watch your legs before game days.'] : ['Light', 'var(--good)', 'Room for more if you feel fresh.'];
  return '<div class="loadm"><div class="row"><b>Week load</b><span class="tag" style="color:' + lvl[1] + '">' + lvl[0] + ' · ' + hrs(L.total) + '</span></div><div class="stackbar big" style="margin:8px 0 6px">' + (L.prac ? '<i style="flex:' + L.prac + ';background:#8db8de" title="Practice ' + hrs(L.prac) + '"></i>' : '') + (L.games ? '<i style="flex:' + L.games + ';background:#ef6a5e" title="Games ' + hrs(L.games) + '"></i>' : '') + (L.extra ? '<i style="flex:' + L.extra + ';background:var(--accent)" title="Your training ' + hrs(L.extra) + '"></i>' : '') + '</div><div class="legend" style="margin-top:0"><span><i style="background:#8db8de"></i>Practice ' + hrs(L.prac) + '</span><span><i style="background:#ef6a5e"></i>Games ~' + hrs(L.games) + '</span><span><i style="background:var(--accent)"></i>Your training ' + hrs(L.extra) + '</span></div><p class="tiny" style="margin:6px 0 0">' + L.hard + ' hard session' + (L.hard === 1 ? '' : 's') + ' and ' + L.quick + ' quick hits planned. ' + lvl[2] + '</p></div>';
}
function todayPlanHTML() {
  var t = today(), items = dayItems(t), sl = slotsFor(t), w = dayCfg(), dw = keyDate(t).getDay();
  if (!coachState().setupAt && !items.length) return '';
  var rows = sl.map(function (s) { var its = items.filter(function (p) { return p.slot === s.s || (!p.slot && s.s === (w.practice.indexOf(dw) >= 0 ? 'pre' : 'mid')); });
    return '<div class="slot"><div class="sl-h"><b>' + esc(s.n) + '</b>' + (s.t ? '<span class="tiny">' + esc(s.t) + '</span>' : '') + '</div>' + (its.length ? its.map(function (p) { var m = p.mode || 'skill'; return '<div class="sl-item' + (p.status === 'done' ? ' done' : '') + '" style="--mc:' + MODES[m].c + '"><div class="grow"><b>' + esc(p.title.replace(/^(Coach|Quick): /, '')) + '</b><div class="tiny">' + (p.quick ? 'Quick hit · ' : 'Main session · ') + p.minutes + ' min · ' + MODES[m].n + '</div></div>' + (p.status === 'done' ? '<span class="tag g">' + ic('check', 12) + ' Done</span>' : '<button class="btn sm ' + (p.quick ? '' : 'p') + '" data-a="plan-start" data-id="' + p.id + '">' + ic('play', 14) + ' Start</button>') + '</div>'; }).join('') : '<div class="sl-empty tiny">Open: rest, mobility, film or Mental Skills</div>') + '</div>'; });
  var prac = w.practice.indexOf(dw) >= 0, game = w.games.indexOf(dw) >= 0;
  return '<section class="panel daywin"><div class="phead"><div><h3>Today’s windows</h3><div class="sub">' + (game ? 'Game day: one short rhythm session, then go play.' : prac ? 'School until ' + fmt12(w.schoolEnd) + ' · practice ' + fmt12(w.practiceStart) + '–' + fmt12(addMin(w.practiceStart, w.practiceMins)) : 'No practice today') + '</div></div><a class="btn sm" href="#program">Windows</a></div><div class="slots">' + rows.join('') + '</div><p class="tiny" style="margin:8px 0 0">One main session a day can be hard. Quick hits are ' + w.quickMins + ' minutes and light. Skip any of them if your legs say so.</p></section>';
}
/* settings + wiring */
function windowsSettingsHTML() {
  var w = dayCfg(), ws = weekStart(today());
  return '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Daily windows</h3><div class="sub">Your day: school ends ' + fmt12(w.schoolEnd) + ', then practice. Your coach fills the gaps.</div></div></div>' +
    '<div class="grid g4"><div class="fld"><label class="f" for="dw-ps">Practice starts</label><input type="time" id="dw-ps" data-c="dw" data-k="practiceStart" value="' + esc(w.practiceStart) + '"></div><div class="fld"><label class="f" for="dw-pm">Practice length (min)</label><input type="number" id="dw-pm" data-c="dw" data-k="practiceMins" min="30" max="300" step="15" value="' + w.practiceMins + '"></div><div class="fld"><label class="f" for="dw-se">School ends</label><input type="time" id="dw-se" data-c="dw" data-k="schoolEnd" value="' + esc(w.schoolEnd) + '"></div><div class="fld"><label class="f" for="dw-q">Quick hit length</label><select id="dw-q" data-c="dw" data-k="quickMins">' + [10, 15, 20].map(function (x) { return '<option value="' + x + '"' + (w.quickMins === x ? ' selected' : '') + '>' + x + ' min</option>'; }).join('') + '</select></div></div>' +
    '<div class="tiny" style="margin:12px 0 6px">Sessions per day (max)</div><div class="seg">' + [[1, '1 · main only'], [2, '2 · main + quick hit'], [3, '3 · main + 2 quick hits']].map(function (o) { return '<button class="' + (w.perDay === o[0] ? 'on' : '') + '" data-a="dw-per" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' +
    '<div class="hr"></div>' + loadMeter(ws) + '<div class="btns" style="margin-top:12px"><button class="btn sm b" data-a="coach-build">' + ic('repeat', 14) + ' Rebuild this week</button></div></section>';
}
CHG['dw'] = function (el) { var w = dayCfg(), k = el.dataset.k; if (k === 'practiceMins' || k === 'quickMins') { var v = +el.value; if (!(v > 0)) return; w[k] = v; } else { if (!/^\d\d:\d\d$/.test(el.value)) return; w[k] = el.value; } save(); render(); };
ACT['dw-per'] = function (el) { dayCfg().perDay = +el.dataset.v; save(); render(); toast('Rebuild your week to apply it'); };
(function () {
  var _prog = viewProgram;
  viewProgram = function () { var h = _prog(), k = '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Programs I follow</h3>'; return h.indexOf(k) >= 0 ? h.replace(k, windowsSettingsHTML() + k) : h + windowsSettingsHTML(); };
  var _home = viewHomePro;
  viewHomePro = function () { var h = _home(), tp = todayPlanHTML(), i = h.indexOf('</section>'); return tp && i >= 0 ? h.slice(0, i + 10) + tp + h.slice(i + 10) : h; };
  var _coach = viewCoach;
  viewCoach = function () { var h = _coach(), k = '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Weekly check-in</h3>'; return coachState().setupAt && h.indexOf(k) >= 0 ? h.replace(k, '<section class="panel" style="margin-top:14px">' + loadMeter(weekStart(today())) + '</section>' + k) : h; };
  render();
})();
