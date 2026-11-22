/* ==================== My Program (philosophy + your workouts), game log, XP, weekly challenges ==================== */
function philoState() { if (!S.philo || typeof S.philo !== 'object') S.philo = {}; var p = S.philo; if (!Array.isArray(p.principles)) p.principles = []; if (!Array.isArray(p.standards)) p.standards = []; if (!p.log || typeof p.log !== 'object') p.log = {}; return p; }
function gamesState() { if (!Array.isArray(S.games)) S.games = []; return S.games; }
function myWorkouts() { return S.workouts.filter(function (w) { return !w.coach && !w.template; }); }
function standardsDoneOn(d) { var p = philoState(); return (p.log[d] || []).filter(function (id) { return p.standards.some(function (s) { return s.id === id; }); }); }
function principleOfDay() { var p = philoState(); if (!p.principles.length) return null; var n = daysBetween('2026-01-01', today()); return p.principles[((n % p.principles.length) + p.principles.length) % p.principles.length]; }

/* ---------- My Program ---------- */
function viewProgram() {
  var p = philoState(), mine = myWorkouts(), t = today(), done = standardsDoneOn(t);
  var streak = 0; if (p.standards.length) { var d = done.length === p.standards.length ? t : addDays(t, -1); while (streak < 400 && standardsDoneOn(d).length === p.standards.length) { streak++; d = addDays(d, -1); } }
  return pageHead('My Program', esc(p.title || 'Your philosophy'), '<a class="btn sm" href="#workout-new">' + ic('plus', 15) + ' New workout</a>') +
    '<section class="panel hero philo"><div class="kick">Philosophy</div>' + (p.statement ? '<blockquote>' + esc(p.statement) + '</blockquote>' : '<p class="ink2">Write what you believe about how you train and play. It shows on your Home screen and frames everything your coach plans.</p>') +
    '<form data-form="philo" class="stack" style="margin-top:12px"><div class="grid g2"><div class="fld"><label class="f" for="ph-title">Program name</label><input id="ph-title" name="title" value="' + esc(p.title || '') + '" placeholder="e.g. The Grind Plan"></div></div><div class="fld"><label class="f" for="ph-st">Philosophy statement</label><textarea id="ph-st" name="statement" placeholder="e.g. Game speed or no speed. Every rep has a purpose. Earn it in the dark.">' + esc(p.statement || '') + '</textarea></div><button class="btn sm b" type="submit">Save philosophy</button></form></section>' +
    '<div class="grid g2" style="margin-top:14px"><section class="panel"><div class="phead"><div><h3>Principles</h3><div class="sub">One shows on Home each day</div></div></div>' + (p.principles.length ? '<div class="list">' + p.principles.map(function (x, i) { return '<div class="li"><span class="fn">' + (i + 1) + '</span><div class="main"><b>' + esc(x.t) + '</b>' + (x.d ? '<div class="tiny">' + esc(x.d) + '</div>' : '') + '</div><button class="btn xs g" data-a="ph-del" data-k="principles" data-id="' + x.id + '" aria-label="Remove">' + ic('x', 12) + '</button></div>'; }).join('') + '</div>' : '<div class="empty">Add the rules you train by, like “Finish every rep at game speed”.</div>') +
    '<form data-form="ph-add" data-k="principles" class="row" style="margin-top:10px;flex-wrap:nowrap"><input name="t" placeholder="Principle" required><input name="d" placeholder="Why (optional)"><button class="btn sm" type="submit">' + ic('plus', 14) + '</button></form></section>' +
    '<section class="panel"><div class="phead"><div><h3>Daily standards</h3><div class="sub">Non-negotiables you check off every day' + (streak ? ' · ' + ic('flame', 13) + ' ' + streak + '-day streak' : '') + '</div></div></div>' + (p.standards.length ? p.standards.map(function (s) { return '<div class="row s" style="flex-wrap:nowrap"><label class="check grow"><input type="checkbox" data-c="std" data-id="' + s.id + '"' + (done.indexOf(s.id) >= 0 ? ' checked' : '') + '>' + esc(s.t) + '</label><button class="btn xs g" data-a="ph-del" data-k="standards" data-id="' + s.id + '" aria-label="Remove">' + ic('x', 12) + '</button></div>'; }).join('') + '<div class="tiny" style="margin-top:6px">' + done.length + ' of ' + p.standards.length + ' today</div>' : '<div class="empty">Examples: 200 makes, 8 hours of sleep, stretch 10 minutes, no phone before bed.</div>') +
    '<form data-form="ph-add" data-k="standards" class="row" style="margin-top:10px;flex-wrap:nowrap"><input name="t" placeholder="Standard" required><button class="btn sm" type="submit">' + ic('plus', 14) + '</button></form></section></div>' +
    '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Your workouts</h3><div class="sub">Turn on “Coach uses it” and your coach schedules your workout instead of a generated one on days that focus on its area</div></div><a class="btn sm" href="#workout-new">' + ic('plus', 15) + ' New workout</a></div>' +
    (mine.length ? '<div class="list">' + mine.map(function (w) { return '<div class="li"><div class="main"><a href="#workout-' + w.id + '" style="text-decoration:none"><b>' + esc(w.name) + '</b></a><div class="tiny">' + esc(w.category || '') + ' · ' + (w.minutes || '?') + ' min · ' + w.items.length + ' drills</div></div><label class="check small" style="min-height:0"><input type="checkbox" data-c="coach-pick" data-id="' + w.id + '"' + (w.coachPick ? ' checked' : '') + '> Coach uses it</label><button class="btn sm p" data-a="start-template" data-id="' + w.id + '">' + ic('play', 14) + '</button></div>'; }).join('') + '</div>' : '<div class="empty"><b>No workouts of your own yet</b>Build them in Train with your drills, sets and reps. Add drills that aren’t in the library with “New drill”.<div class="btns" style="justify-content:center;margin-top:10px"><a class="btn sm" href="#workout-new">New workout</a><a class="btn sm" href="#drill-new">New drill</a></div></div>') + '</section>';
}
FORM['philo'] = function (f) { var p = philoState(); p.title = f.title.value.trim(); p.statement = f.statement.value.trim(); save(); toast('Philosophy saved'); render(); };
FORM['ph-add'] = function (f) { var p = philoState(), k = f.dataset.k, t = f.t.value.trim(); if (!t) return; p[k].push({ id: uid(), t: t.slice(0, 140), d: f.d ? f.d.value.trim().slice(0, 200) : '' }); save(); render(); setTimeout(function () { var el = $('form[data-k="' + k + '"] input[name=t]'); if (el) el.focus(); }, 30); };
ACT['ph-del'] = function (el) { var p = philoState(); p[el.dataset.k] = p[el.dataset.k].filter(function (x) { return x.id !== el.dataset.id; }); save(); render(); };
CHG['std'] = function (el) { var p = philoState(), t = today(), arr = p.log[t] = p.log[t] || []; if (el.checked) { if (arr.indexOf(el.dataset.id) < 0) arr.push(el.dataset.id); } else p.log[t] = arr.filter(function (x) { return x !== el.dataset.id; }); save(); if (standardsDoneOn(t).length === p.standards.length) toast('All standards done today ' + String.fromCodePoint(0x1F525)); render(); };
CHG['coach-pick'] = function (el) { var w = S.workouts.find(function (x) { return x.id === el.dataset.id; }); if (!w) return; w.coachPick = el.checked; save(); toast(el.checked ? 'Your coach will use ' + w.name + ' on ' + (w.category || 'matching') + ' days. Rebuild your week to apply it.' : 'Coach will stop using ' + w.name); };

/* Coach prefers your own workouts: wrap the plan builder so a marked workout replaces the generated one for that focus. */
(function () {
  var _build = buildCoachWeek;
  buildCoachWeek = function (ws) {
    var n = _build(ws), mine = S.workouts.filter(function (w) { return w.coachPick && !w.coach; }), used = 0;
    if (!mine.length) return n;
    S.plan.filter(function (p) { return p.coach && p.date >= ws && p.date <= addDays(ws, 6) && p.status !== 'done' && p.date >= today(); }).forEach(function (p, i) {
      var gen = S.workouts.find(function (w) { return w.id === p.workoutId; }); if (!gen || !gen.coach) return;
      var match = mine.filter(function (w) { return w.category === gen.category; }); if (!match.length) return;
      var w = match[(i + hashStr(ws)) % match.length];
      S.workouts = S.workouts.filter(function (x) { return x.id !== gen.id; });
      p.workoutId = w.id; p.minutes = w.minutes || p.minutes; p.title = 'Coach: ' + w.name; p.reason = 'Your workout (you marked it for your coach). ' + (p.reason || ''); used++;
    });
    if (used) save();
    return n;
  };
})();

/* ---------- Game log ---------- */
function gameAvg(gs) {
  var n = gs.length; if (!n) return null; var s = function (k) { return sum(gs, function (g) { return +g[k] || 0; }); };
  return { n: n, pts: s('pts') / n, reb: s('reb') / n, ast: s('ast') / n, stl: s('stl') / n, to: s('to') / n, min: s('min') / n, fg: pct(s('fgm'), s('fga')), tp: pct(s('tpm'), s('tpa')), ft: pct(s('ftm'), s('fta')), fga: s('fga'), tpa: s('tpa'), fta: s('fta') };
}
function viewGames() {
  var gs = gamesState().slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }), a = gameAvg(gs), last5 = gameAvg(gs.slice(0, 5)), t = today(), wk = splitStats(shotSets(addDays(t, -89), t));
  var trend = gs.slice(0, 12).reverse().map(function (g) { return { x: fmtDay(g.date, { month: 'numeric', day: 'numeric' }), y: +g.pts || 0, title: (g.opp ? 'vs ' + g.opp + ': ' : '') + (g.pts || 0) + ' pts' }; });
  var cmp = function (label, work, wAtt, game, gAtt) { if (work == null || game == null) return ''; var d = game - work; return '<div class="li"><div class="main"><b>' + label + '</b><div class="tiny">Workouts ' + work + '% (' + wAtt + ' att) · Games ' + game + '% (' + gAtt + ' att)</div></div><span class="tag ' + (d >= -5 ? 'g' : d >= -15 ? 'w' : 'b') + '">' + (d >= 0 ? '+' : '') + d + ' pts in games</span></div>'; };
  return pageHead('Game log', 'Your games', '<button class="btn p" data-a="game-add">' + ic('plus', 16) + ' Log a game</button>') +
    (a ? '<div class="grid g4">' + kpi(a.pts.toFixed(1), 'Points per game', '', last5 && a.n > 5 ? 'last 5: ' + last5.pts.toFixed(1) : a.n + ' game' + (a.n === 1 ? '' : 's')) + kpi(fmtPct(a.fg), 'Field goal %', '', a.fga + ' attempts') + kpi(fmtPct(a.tp), '3-point %', '', a.tpa + ' attempts') + kpi(fmtPct(a.ft), 'Free throw %', '', a.fta + ' attempts') + '</div>' +
      '<div class="grid g2" style="margin-top:14px"><section class="panel"><div class="phead"><div><h3>Scoring trend</h3><div class="sub">Points, last 12 games</div></div></div>' + (lineChart(trend, { label: 'Points per game' }) || '<div class="empty">Two games draw the trend.</div>') + '<div class="grid g4" style="margin-top:12px">' + kpi(a.reb.toFixed(1), 'Rebounds') + kpi(a.ast.toFixed(1), 'Assists') + kpi(a.stl.toFixed(1), 'Steals') + kpi(a.to.toFixed(1), 'Turnovers', '', a.to ? 'A/TO ' + (a.ast / a.to).toFixed(1) : '') + '</div></section>' +
      '<section class="panel"><div class="phead"><div><h3>Does practice carry over?</h3><div class="sub">Workout shooting (last 90 days) vs game shooting</div></div></div>' + ((cmp('3-pointers', wk.three.att >= 25 ? pct(wk.three.made, wk.three.att) : null, wk.three.att, a.tpa >= 10 ? a.tp : null, a.tpa) + cmp('Free throws', wk.ft.att >= 20 ? pct(wk.ft.made, wk.ft.att) : null, wk.ft.att, a.fta >= 10 ? a.ft : null, a.fta) + cmp('All shots', wk.tot.att >= 50 ? pct(wk.tot.made, wk.tot.att) : null, wk.tot.att, a.fga >= 20 ? a.fg : null, a.fga)) ? '<div class="list">' + cmp('3-pointers', wk.three.att >= 25 ? pct(wk.three.made, wk.three.att) : null, wk.three.att, a.tpa >= 10 ? a.tp : null, a.tpa) + cmp('Free throws', wk.ft.att >= 20 ? pct(wk.ft.made, wk.ft.att) : null, wk.ft.att, a.fta >= 10 ? a.ft : null, a.fta) + cmp('All shots', wk.tot.att >= 50 ? pct(wk.tot.made, wk.tot.att) : null, wk.tot.att, a.fga >= 20 ? a.fg : null, a.fga) + '</div><p class="tiny">Games are contested, so some drop is normal. A drop of 15+ points usually means practice shots are too easy: add game-speed and fatigue reps.</p>' : '<div class="empty">Needs 25+ workout threes and 10+ game threes (or 20+ FTs and 10+ game FTs) to compare.</div>') + '</section></div>' : '<section class="panel hero coach-intro"><div class="ci-art">' + ic('trophy', 44) + '</div><h2>Log your games</h2><p class="ink2">Box score in under a minute. You get season averages, a scoring trend, and whether your workout shooting carries over to games. Game shooting also updates your coach rating and fills your recruiting card.</p><button class="btn p xl" data-a="game-add" style="max-width:280px">' + ic('plus', 18) + ' Log a game</button></section>') +
    (gs.length ? '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>All games</h3></div></div><div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Opponent</th><th class="n">MIN</th><th class="n">PTS</th><th class="n">FG</th><th class="n">3P</th><th class="n">FT</th><th class="n">REB</th><th class="n">AST</th><th class="n">STL</th><th class="n">TO</th><th></th></tr></thead><tbody>' + gs.map(function (g) { return '<tr><td>' + esc(fmtDay(g.date, { month: 'short', day: 'numeric' })) + '</td><td>' + (g.result ? '<span class="tag ' + (g.result === 'W' ? 'g' : 'b') + '">' + g.result + '</span> ' : '') + esc(g.opp || '') + '</td><td class="n">' + (g.min || '') + '</td><td class="n"><b>' + (g.pts || 0) + '</b></td><td class="n">' + (g.fgm || 0) + '-' + (g.fga || 0) + '</td><td class="n">' + (g.tpm || 0) + '-' + (g.tpa || 0) + '</td><td class="n">' + (g.ftm || 0) + '-' + (g.fta || 0) + '</td><td class="n">' + (g.reb || 0) + '</td><td class="n">' + (g.ast || 0) + '</td><td class="n">' + (g.stl || 0) + '</td><td class="n">' + (g.to || 0) + '</td><td><button class="btn xs g" data-a="game-edit" data-id="' + g.id + '">Edit</button></td></tr>'; }).join('') + '</tbody></table></div></section>' : '');
}
var GAME_F = [['min', 'Minutes'], ['pts', 'Points'], ['fgm', 'FG made'], ['fga', 'FG att'], ['tpm', '3P made'], ['tpa', '3P att'], ['ftm', 'FT made'], ['fta', 'FT att'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['blk', 'Blocks'], ['to', 'Turnovers']];
function gameForm(g) {
  g = g || { date: today() };
  modal(g.id ? 'Edit game' : 'Log a game', '<form data-form="game" class="stack"' + (g.id ? ' data-id="' + g.id + '"' : '') + '><div class="grid g3"><div class="fld"><label class="f" for="gm-d">Date</label><input type="date" id="gm-d" name="date" value="' + esc(g.date) + '" required></div><div class="fld"><label class="f" for="gm-o">Opponent</label><input id="gm-o" name="opp" value="' + esc(g.opp || '') + '"></div><div class="fld"><label class="f" for="gm-r">Result</label><select id="gm-r" name="result"><option value="">–</option><option' + (g.result === 'W' ? ' selected' : '') + '>W</option><option' + (g.result === 'L' ? ' selected' : '') + '>L</option></select></div></div>' +
    '<div class="grid g4">' + GAME_F.map(function (f) { return '<div class="fld"><label class="f" for="gm-' + f[0] + '">' + f[1] + '</label><input type="number" min="0" max="99" inputmode="numeric" id="gm-' + f[0] + '" name="' + f[0] + '" value="' + (g[f[0]] != null ? g[f[0]] : '') + '"></div>'; }).join('') + '</div><div class="fld"><label class="f" for="gm-n">Notes</label><textarea id="gm-n" name="notes" placeholder="What worked, what to fix">' + esc(g.notes || '') + '</textarea></div><div class="btns"><button class="btn p" type="submit">Save game</button>' + (g.id ? '<button class="btn g d" type="button" data-a="game-del" data-id="' + g.id + '">Delete</button>' : '') + '</div></form>');
}
ACT['game-add'] = function () { gameForm(null); };
ACT['game-edit'] = function (el) { gameForm(gamesState().find(function (x) { return x.id === el.dataset.id; })); };
ACT['game-del'] = function (el) { if (UI.armed !== 'gd' + el.dataset.id) { UI.armed = 'gd' + el.dataset.id; toast('Tap Delete again to remove this game', 'warn'); return; } UI.armed = null; S.games = gamesState().filter(function (x) { return x.id !== el.dataset.id; }); save(); closeModal(); render(); };
FORM['game'] = function (f) {
  var g = { id: f.dataset.id || 'g' + uid(), date: f.date.value, opp: f.opp.value.trim(), result: f.result.value, notes: f.notes.value.trim() };
  GAME_F.forEach(function (x) { var v = f[x[0]].value; g[x[0]] = v === '' ? 0 : Math.max(0, Math.round(+v)); });
  if (g.fgm > g.fga || g.tpm > g.tpa || g.ftm > g.fta) { toast('Makes can’t be more than attempts', 'warn'); return; }
  if (g.tpm > g.fgm || g.tpa > g.fga) { toast('3-pointers are part of field goals: FG must include them', 'warn'); return; }
  if (g.pts && g.pts !== 2 * (g.fgm - g.tpm) + 3 * g.tpm + g.ftm) toast('Heads up: points don’t match the makes (' + (2 * (g.fgm - g.tpm) + 3 * g.tpm + g.ftm) + ' from FG/3P/FT). Saved anyway.', 'warn');
  var gs = gamesState(), i = gs.findIndex(function (x) { return x.id === g.id; }); if (i >= 0) gs[i] = g; else gs.push(g);
  save(); closeModal(); if (!(g.pts && g.pts !== 2 * (g.fgm - g.tpm) + 3 * g.tpm + g.ftm)) toast('Game saved'); location.hash = '#games'; render();
};
/* Game shooting feeds the Shooting rating as measured evidence (3+ games, 20+ attempts). */
(function () {
  var _ev = areaEvidence;
  areaEvidence = function (area) {
    var ev = _ev(area); if (area !== 'Shooting') return ev;
    var gs = gamesState().filter(function (g) { return g.date >= addDays(today(), -60); }), a = gameAvg(gs);
    if (a && a.n >= 3 && a.fga >= 20) { var efg = ((sum(gs, function (g) { return g.fgm; }) + 0.5 * sum(gs, function (g) { return g.tpm; })) / a.fga) * 100; ev.push({ v: Math.round(clamp((efg - 30) * 2.2 + 30, 0, 100)), w: 3, kind: 'measured', src: 'Games: ' + Math.round(efg) + '% effective FG over ' + a.n + ' games' }); }
    return ev;
  };
})();
ACT['rc-fill'] = function () { var a = gameAvg(gamesState()); if (!a) { toast('Log games first', 'warn'); return; } var r = recruitState(); r.stats = { ppg: a.pts.toFixed(1), rpg: a.reb.toFixed(1), apg: a.ast.toFixed(1), spg: a.stl.toFixed(1), fg: a.fg == null ? '' : String(a.fg), tp: a.tp == null ? '' : String(a.tp), ft: a.ft == null ? '' : String(a.ft) }; save(); toast('Season stats filled from ' + a.n + ' logged game' + (a.n === 1 ? '' : 's')); render(); };

/* ---------- XP, levels, weekly challenges ---------- */
var LEVEL_TITLES = ['Rookie', 'Gym Rat', 'Hooper', 'Shot Maker', 'Starter', 'Floor General', 'All-Conference', 'All-State', 'Elite', 'Legend'];
function weekChallenges(ws) {
  var c = coachState(), we = addDays(ws, 6), prev = [1, 2, 3, 4].map(function (k) { var a = addDays(ws, -7 * k); return { days: (function () { var n = 0; for (var i = 0; i < 7; i++) if (rangeSessions(addDays(a, i), addDays(a, i)).length) n++; return n; })(), makes: shotSets(a, addDays(a, 6)).reduce(function (s, x) { return s + x.made; }, 0), three: shotSets(a, addDays(a, 6)).filter(function (x) { return THREES.indexOf(x.zone) >= 0; }).reduce(function (s, x) { return s + x.made; }, 0) }; });
  var avg = function (k) { return sum(prev, function (p) { return p[k]; }) / 4; };
  var r5 = function (v) { return Math.max(5, Math.round(v / 5) * 5); }, r25 = function (v) { return Math.max(25, Math.round(v / 25) * 25); };
  var days = 0; for (var i = 0; i < 7; i++) if (rangeSessions(addDays(ws, i), addDays(ws, i)).length) days++;
  var sets = shotSets(ws, we), makes = sum(sets, function (x) { return x.made; }), threes = sum(sets.filter(function (x) { return THREES.indexOf(x.zone) >= 0; }), function (x) { return x.made; });
  var coachDone = S.plan.filter(function (p) { return p.coach && p.date >= ws && p.date <= we && p.status === 'done'; }).length, coachAll = S.plan.filter(function (p) { return p.coach && p.date >= ws && p.date <= we; }).length;
  var lessons = Object.keys(courseState().done).filter(function (k) { var d = courseState().done[k]; return d >= ws && d <= we; }).length;
  var stdDays = 0, ph = philoState(); if (ph.standards.length) for (var j = 0; j < 7; j++) if (standardsDoneOn(addDays(ws, j)).length === ph.standards.length) stdDays++;
  var list = [
    { id: 'days', t: 'Train ' + Math.min(6, Math.max(3, Math.round(avg('days')) + 1)) + ' days', cur: days, goal: Math.min(6, Math.max(3, Math.round(avg('days')) + 1)), ic: 'calendar-days' },
    { id: 'makes', t: 'Make ' + r25(Math.max(150, avg('makes') * 1.15)) + ' shots', cur: makes, goal: r25(Math.max(150, avg('makes') * 1.15)), ic: 'crosshair' },
    { id: 'threes', t: 'Make ' + r5(Math.max(50, avg('three') * 1.15)) + ' threes', cur: threes, goal: r5(Math.max(50, avg('three') * 1.15)), ic: 'target' },
  ];
  if (coachAll) list.push({ id: 'coach', t: 'Finish all ' + coachAll + ' coach sessions', cur: coachDone, goal: coachAll, ic: 'dumbbell' });
  else list.push({ id: 'lesson', t: 'Complete 2 course lessons', cur: lessons, goal: 2, ic: 'graduation-cap' });
  if (ph.standards.length) list.push({ id: 'std', t: 'Hit every standard 5 days', cur: stdDays, goal: 5, ic: 'flame' });
  list.forEach(function (x) { x.done = x.cur >= x.goal; });
  return list;
}
/* XP is recalculated from your records every time, so it can’t drift from what you actually did. */
function xpTotal() {
  var xp = 0, parts = {};
  var add = function (k, v) { parts[k] = (parts[k] || 0) + v; xp += v; };
  S.sessions.forEach(function (s) { add('Sessions', 10 + Math.min(120, s.minutes || 0)); add('Makes', Math.round(sessionTotals(s).made * 0.2)); });
  add('Lessons', Object.keys(courseState().done).length * 25);
  add('Skills tests', coachState().tests.length * 30);
  add('Games logged', gamesState().length * 20);
  var ph = philoState(); if (ph.standards.length) add('Standards', Object.keys(ph.log).filter(function (d) { return standardsDoneOn(d).length === ph.standards.length; }).length * 10);
  var ws = weekStart(today()); for (var k = 1; k <= 12; k++) { var w = addDays(ws, -7 * k); if (S.sessions.some(function (s) { return s.date >= w && s.date <= addDays(w, 6); })) add('Challenges', weekChallenges(w).filter(function (c) { return c.done; }).length * 50); }
  add('Challenges', weekChallenges(ws).filter(function (c) { return c.done; }).length * 50);
  return { xp: xp, parts: parts };
}
function levelOf(xp) { var lv = Math.floor(Math.sqrt(xp / 60)) + 1, base = 60 * (lv - 1) * (lv - 1), next = 60 * lv * lv; return { lv: lv, title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((lv - 1) / 2))], into: xp - base, need: next - base, pct: Math.round(((xp - base) / (next - base)) * 100) }; }
function challengesCard() {
  var ws = weekStart(today()), ch = weekChallenges(ws), x = xpTotal(), L = levelOf(x.xp);
  return '<section class="panel lvl-card"><div class="row" style="flex-wrap:nowrap"><div class="lvl"><b>' + L.lv + '</b><span>LVL</span></div><div class="grow"><div class="row"><h3>' + esc(L.title) + '</h3><span class="tiny num">' + x.xp + ' XP</span></div><div class="bar" style="margin:6px 0 4px"><i style="width:' + L.pct + '%"></i></div><div class="tiny">' + (L.need - L.into) + ' XP to level ' + (L.lv + 1) + ' · earned from sessions, makes, lessons, tests, games and challenges</div></div></div>' +
    '<div class="hr"></div><div class="row" style="margin-bottom:8px"><h4>This week’s challenges</h4><span class="tiny">' + ch.filter(function (c) { return c.done; }).length + '/' + ch.length + ' · +50 XP each</span></div><div class="chal">' + ch.map(function (c) { return '<div class="ch' + (c.done ? ' done' : '') + '"><span class="chi">' + (c.done ? ic('check', 16) : ic(c.ic, 16)) + '</span><div class="grow"><b>' + esc(c.t) + '</b><div class="bar"><i style="width:' + Math.min(100, Math.round((c.cur / c.goal) * 100)) + '%"></i></div></div><span class="num small">' + Math.min(c.cur, c.goal) + '/' + c.goal + '</span></div>'; }).join('') + '</div><p class="tiny" style="margin:8px 0 0">Targets scale from your last 4 weeks so they stay a stretch, not a wall.</p></section>';
}

/* ---------- wire into home, recruiting, nav, routes ---------- */
(function () {
  var _home = viewHomePro;
  viewHomePro = function () {
    var h = _home(), pr = principleOfDay(), ph = philoState(), t = today();
    var extra = (pr ? '<div class="pod">' + ic('sparkles', 16) + '<div><span class="kick">' + esc(ph.title || 'Your philosophy') + '</span><b>' + esc(pr.t) + '</b>' + (pr.d ? '<span class="tiny">' + esc(pr.d) + '</span>' : '') + '</div><a class="btn xs" href="#program">Program</a></div>' : '') +
      '<div class="grid g2" style="margin-bottom:14px">' + challengesCard() + (ph.standards.length ? '<section class="panel"><div class="phead"><div><h3>Today’s standards</h3><div class="sub">' + standardsDoneOn(t).length + ' of ' + ph.standards.length + ' done</div></div><a class="btn sm" href="#program">Edit</a></div>' + ph.standards.map(function (s) { return '<label class="check"><input type="checkbox" data-c="std" data-id="' + s.id + '"' + (standardsDoneOn(t).indexOf(s.id) >= 0 ? ' checked' : '') + '>' + esc(s.t) + '</label>'; }).join('') + '</section>' : '<section class="panel"><div class="phead"><div><h3>Build your program</h3><div class="sub">Your philosophy, daily standards and your own workouts</div></div></div><p class="small ink2">Write the rules you train by and the non-negotiables you hit every day. Mark your own workouts and your coach will schedule them.</p><a class="btn b" href="#program">' + ic('notebook-pen', 16) + ' Open My Program</a></section>') + '</div>';
    var i = h.indexOf('<div class="quick">'); return i >= 0 ? h.slice(0, i) + extra + h.slice(i) : h + extra;
  };
  var _rec = viewRecruit;
  viewRecruit = function () { var h = _rec(); return h.replace('<section class="panel"><h3>Season stats</h3>', '<section class="panel"><div class="row"><h3>Season stats</h3>' + (gamesState().length ? '<button class="btn xs" type="button" data-a="rc-fill">' + ic('trophy', 13) + ' Fill from game log (' + gamesState().length + ')</button>' : '<a class="btn xs" href="#games">Log games to auto-fill</a>') + '</div>'); };
  var _more = viewMore;
  viewMore = function () { return _more().replace('<div class="morehub">', '<div class="morehub"><a href="#program"><span>' + ic('notebook-pen', 22) + '</span><b>My Program</b><small>Philosophy, standards, your workouts</small></a><a href="#games"><span>' + ic('trophy', 22) + '</span><b>Game log</b><small>Box scores and season averages</small></a>'); };
  var _rv = routeView;
  routeView = function (route) { philoState(); gamesState(); if (route === 'program') return viewProgram(); if (route === 'games') return viewGames(); return _rv(route); };
  Object.assign(TAB_OF, { program: 'more', games: 'more' });
  var lib = $('.side a[data-r="library"]');
  if (lib) { lib.insertAdjacentHTML('beforebegin', '<a href="#program" data-r="program"><i>' + ic('notebook-pen', 20) + '</i>My Program</a><a href="#games" data-r="games"><i>' + ic('trophy', 20) + '</i>Game log</a>'); }
  render();
})();
