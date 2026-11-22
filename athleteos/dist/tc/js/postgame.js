/* ==================== Day after a game: strengths + weaknesses ====================
   Tap what went well and what didn't (your last logged game pre-suggests some),
   pick your time, and get a session: warm-up, one confidence block, the weak spots
   (game-like, with constraints), free throws. No conditioning: legs recover. */
var PGM_TAGS = [
  ['c3', 'Catch-and-shoot 3s', [['d-cs-5-spots', [4, 8], 'Catch on the move, 1-second release, like the game']]],
  ['pull', 'Pull-ups', [['d-one-dribble-reads', [4, 6], 'Called direction on the catch, contested every rep']]],
  ['mid', 'Mid-range', [['d-midrange-elbows', [3, 8], 'Two-dribble max, quick rise']]],
  ['create', 'Shot creation / fades', [['d-creation-wheel', [3, 6], 'Random order: snatchback, spin fade, step-back, hesi']]],
  ['move3', 'Shooting off movement', [['d-reloc-kicks', [3, 6], 'Relocate to a called spot, closeout on the catch']]],
  ['rim', 'Finishing at the rim', [['d-glass-finishing', [3, 10], 'Random hand, catch it out of the net']]],
  ['contact', 'Finishing through contact', [['d-contact-gather', [3, 6], 'Bump on the gather, and-one or it doesn’t count']]],
  ['float', 'Floaters / touch', [['d-floater-ladder', [3, 8], 'Over a raised hand, off one and two feet']]],
  ['handle', 'Handle under pressure', [['d-pressure-pocket', [3, 30], 'Reach-ins and bumps, keep it alive']]],
  ['to', 'Turnovers / decisions', [['d-read-cards', [3, 8], 'Read late: pull, drive or kick'], ['d-eyes-up-calls', [2, 30], 'Eyes up the whole time']]],
  ['trans', 'Transition', [['d-transition-finishes', [3, 6], 'Read the chaser: finish, pull-up or kick']]],
  ['ft', 'Free throws', [['d-pressure-fts', [2, 10], 'Two at a time, game routine, make both or run']]],
  ['d', 'On-ball defense', [['d-closeout-footwork', [3, 6], 'Closeout and contest, no flying by'], ['d-lateral-slide', [2, 6], 'Short slides, stay low, no heavy conditioning']]],
];
function pgmTag(k) { return PGM_TAGS.filter(function (t) { return t[0] === k; })[0]; }
var PGM = { good: [], bad: [], mins: 45, gameId: null, init: false };
function pgmLastGame() { var gs = gamesState().slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }); return gs[0] || null; }
/* rule-based hints from the box score (only when there's real data) */
function pgmHints(g) {
  var good = [], bad = [], why = [];
  if (!g) return { good: good, bad: bad, why: why };
  if (g.tpa >= 3) { var p3 = g.tpm / g.tpa; if (p3 >= 0.4) { good.push('c3'); why.push('3P ' + g.tpm + '/' + g.tpa); } else if (p3 < 0.3) { bad.push('c3'); why.push('3P ' + g.tpm + '/' + g.tpa); } }
  if (g.fta >= 2) { var pf = g.ftm / g.fta; if (pf >= 0.8) good.push('ft'); else if (pf < 0.7) { bad.push('ft'); why.push('FT ' + g.ftm + '/' + g.fta); } }
  var twoA = g.fga - g.tpa, twoM = g.fgm - g.tpm; if (twoA >= 4) { if (twoM / twoA >= 0.5) good.push('rim'); else if (twoM / twoA < 0.4) { bad.push('rim'); why.push('2P ' + twoM + '/' + twoA); } }
  if (g.to >= 3) { bad.push('to'); why.push(g.to + ' turnovers'); }
  return { good: good, bad: bad, why: why };
}
function pgmBuild() {
  var mins = PGM.mins, items = [], push = function (x) { var d = drillById(x[0]); if (!d) return; items.push({ drillId: d.id, name: d.name, category: d.category, metric: d.metric === 'makes' ? 'makes' : 'reps', targetSets: x[1][0], targetAttempts: x[1][1], restSec: 30, timeLimitSec: 0, layer: x[2] }); };
  push(['d-form-close', [1, 10], 'Easy rhythm, get loose']);
  var good = PGM.good.slice(0, 1), bad = PGM.bad.slice(0, mins <= 30 ? 2 : mins <= 45 ? 3 : 4);
  good.forEach(function (k) { var t = pgmTag(k); if (t) { var x = t[2][0]; push([x[0], [2, x[1][1]], 'Confidence: you did this well. Keep it sharp']); } });
  bad.forEach(function (k) { var t = pgmTag(k); if (t) t[2].forEach(function (x) { push(x); }); });
  if (!PGM.bad.some(function (k) { return k === 'ft'; })) push(['d-ft-timed', [1, 10], 'Finish with free throws']);
  /* trim sets to fit the time */
  var est = function () { return sum(items, function (i) { return i.metric === 'makes' ? (i.targetSets * i.targetAttempts) / 2.6 + (i.targetSets - 1) * 0.5 : i.targetSets * Math.max(1.2, i.targetAttempts * (i.targetAttempts >= 20 ? 0.05 : 0.15)) + (i.targetSets - 1) * 0.5; }) + 3; };
  var guard = 0; while (est() > mins + 3 && guard++ < 30) { var big = items.slice(1).sort(function (a, b) { return b.targetSets - a.targetSets; })[0]; if (!big || big.targetSets <= 1) break; big.targetSets--; }
  return { items: items, mins: Math.round(est()) };
}
function viewPostGame() {
  var g = PGM.gameId ? gamesState().find(function (x) { return x.id === PGM.gameId; }) : pgmLastGame();
  if (!PGM.init) { var h = pgmHints(g); PGM.good = h.good.slice(0, 2); PGM.bad = h.bad.slice(0, 3); PGM.init = true; PGM.gameId = g ? g.id : null; }
  var h2 = pgmHints(g), plan = pgmBuild();
  var chip = function (list, k, n) { var on = PGM[list].indexOf(k) >= 0; return '<button class="chip' + (on ? ' on ' + list : '') + '" data-a="pgm-tag" data-l="' + list + '" data-k="' + k + '" aria-pressed="' + on + '">' + esc(n) + '</button>'; };
  return pageHead('Day after the game', 'Strengths + weaknesses', '<a class="btn sm g" href="#games">' + ic('trophy', 15) + ' Game log</a>') +
    '<section class="panel pgm-game">' + (g ? '<div class="kick">Last game · ' + esc(fmtDay(g.date)) + (g.opp ? ' vs ' + esc(g.opp) : '') + '</div><div class="pgm-box">' + [['PTS', g.pts], ['FG', g.fgm + '/' + g.fga], ['3P', g.tpm + '/' + g.tpa], ['FT', g.ftm + '/' + g.fta], ['TO', g.to], ['AST', g.ast]].map(function (x) { return '<span><b class="num">' + x[1] + '</b><small>' + x[0] + '</small></span>'; }).join('') + '</div>' + (h2.why.length ? '<p class="tiny muted">Pre-picked from the box score: ' + esc(h2.why.join(' · ')) + '. Change anything.</p>' : '<p class="tiny muted">Tap what you felt, the box score doesn’t show everything.</p>')
      : '<div class="kick">No game logged</div><p class="small ink2" style="margin:4px 0 0">Tap what went well and what didn’t. <a href="#games">Log the game</a> and it pre-picks from your stats next time.</p>') + '</section>' +
    '<section class="panel"><h3 class="pgm-h">' + ic('star', 16) + ' What went well? <span class="tiny muted">pick 1, it gets a short confidence block</span></h3><div class="chips">' + PGM_TAGS.map(function (t) { return chip('good', t[0], t[1]); }).join('') + '</div>' +
    '<h3 class="pgm-h" style="margin-top:18px">' + ic('target', 16) + ' What needs work? <span class="tiny muted">pick up to ' + (PGM.mins <= 30 ? 2 : PGM.mins <= 45 ? 3 : 4) + '</span></h3><div class="chips">' + PGM_TAGS.map(function (t) { return chip('bad', t[0], t[1]); }).join('') + '</div>' +
    (function () { var cap = PGM.mins <= 30 ? 2 : PGM.mins <= 45 ? 3 : 4; return PGM.bad.length > cap ? '<p class="tiny" style="color:#ff913d;margin:8px 0 0">Only the first ' + cap + ' fit in ' + PGM.mins + ' min. Pick more time or drop one.</p>' : ''; })() +
    '<h3 class="pgm-h" style="margin-top:18px">' + ic('timer', 16) + ' Time</h3><div class="seg">' + [30, 45, 60].map(function (m) { return '<button class="' + (PGM.mins === m ? 'on' : '') + '" data-a="pgm-mins" data-v="' + m + '">' + m + ' min</button>'; }).join('') + '</div></section>' +
    '<section class="panel"><div class="phead"><div><h3>Your session</h3><div class="sub">~' + plan.mins + ' min · ' + plan.items.length + ' drills · no conditioning, your legs are recovering</div></div></div>' +
    (PGM.bad.length ? '<div class="pg-list pgm-list">' + plan.items.map(function (i, n) { return '<div class="pg-drill"><div class="pg-dh" style="cursor:default"><span class="pg-dn">' + (n + 1) + '</span><span class="grow"><b>' + esc(i.name) + '</b><small>' + i.targetSets + ' × ' + i.targetAttempts + (i.metric === 'makes' ? ' shots' : i.targetAttempts >= 20 ? ' sec' : ' reps') + '</small></span></div>' + (i.layer ? '<div class="pg-cue">' + ic('flame', 13) + ' ' + esc(i.layer) + '</div>' : '') + '</div>'; }).join('') + '</div>' +
      '<div class="btns" style="margin-top:14px"><button class="btn p" data-a="pgm-start">' + ic('play', 16) + ' Start session</button><button class="btn g" data-a="pgm-save">' + ic('star', 15) + ' Save as a workout</button></div>'
      : '<div class="empty"><b>Pick at least one thing that needs work</b>Your session builds from it.</div>') + '</section>';
}
function pgmWorkout() { var plan = pgmBuild(), g = PGM.gameId && gamesState().find(function (x) { return x.id === PGM.gameId; }); return { id: 'w-' + uid(), name: 'Post-game' + (g && g.opp ? ' (vs ' + g.opp + ')' : '') + ': ' + PGM.bad.map(function (k) { return pgmTag(k)[1]; }).join(', '), category: plan.items[1] ? plan.items[1].category : 'Shooting', objective: 'Day after the game: strengths and weaknesses.', minutes: plan.mins, difficulty: 3, warmup: '', notes: '', template: false, custom: true, writer: true, wt: 'post-game', created: Date.now(), items: plan.items }; }
ACT['pgm-tag'] = function (el) { var l = PGM[el.dataset.l], k = el.dataset.k, i = l.indexOf(k); if (i >= 0) l.splice(i, 1); else { if (el.dataset.l === 'good') l.length = 0; l.push(k); var other = PGM[el.dataset.l === 'good' ? 'bad' : 'good'], j = other.indexOf(k); if (j >= 0) other.splice(j, 1); } render(); };
ACT['pgm-mins'] = function (el) { PGM.mins = +el.dataset.v; render(); };
ACT['pgm-start'] = function () { var w = pgmWorkout(); var g = PGM.gameId && gamesState().find(function (x) { return x.id === PGM.gameId; }); if (g) { g.review = { good: PGM.good.slice(), bad: PGM.bad.slice(), at: today() }; save(); } startRun(w.items.map(function (i) { return Object.assign({}, i); }), w.name, null, null); };
ACT['pgm-save'] = function () { var w = pgmWorkout(); S.workouts.push(w); save(); toast('Saved. It’s in My Week under Yours and in the Workout Writer.'); };
/* ---------- wiring: My Week type, in-season week, game log button ---------- */
(function () {
  WT['post-game'] = { n: 'Post-game: strengths + weaknesses', g: 'Skill & CLA', c: '#ffb13d', ic: 'trophy', m: 45, href: '#postgame' };
  if (WR_TYPES.indexOf('post-game') < 0) WR_TYPES.push('post-game');
  var _rv = routeView; routeView = function (r) { if (r === 'postgame') return viewPostGame(); return _rv(r); };
  Object.assign(TAB_OF, { postgame: 'coach' });
  var _ws = ACT['wk-start'];
  ACT['wk-start'] = function (el) { var f = wkFind(el.dataset.bid); if (f && f.b.k === 'post-game') { PGM.init = false; PGM.gameId = null; PGM.mins = [30, 45, 60].reduce(function (a, x) { return Math.abs(x - f.b.mins) < Math.abs(a - f.b.mins) ? x : a; }, 45); WK.active = { id: f.b.id, date: addDays(f.ws, f.di) }; location.hash = '#postgame'; return; } return _ws(el); };
  /* your schedule: games Tuesday + Friday (some Saturdays), practice the other weekdays */
  var w = weekState(); if (!w.gamesSet) { w.games = [2, 5]; w.gamesSet = true; }
  var _sample = ACT['wk-sample'];
  ACT['wk-sample'] = function () {
    if (!pgState().inSeason) return _sample();
    var B = function (k, m) { return { id: uid(), k: k, mins: m == null ? WT[k].m : m, done: false }; };
    myWeek().weeks[wkStart(WK.off)] = [
      [B('rhythm', 30), B('practice'), B('handle', 15)],
      [B('rhythm', 20), B('game-day')],
      [B('post-game', 30), B('practice')],
      [B('spot-feel', 30), B('practice'), B('handle', 15)],
      [B('rhythm', 20), B('game-day')],
      [B('post-game', 45), B('creative', 20)],
      [B('rest'), B('film')]];
    save(); render(); toast('In-season week: games Tue + Fri. Playing Saturday? Drag a Game onto it and swap the post-game to Sunday.');
  };
  /* after logging a game, offer the day-after session */
  var _g = FORM['game'];
  FORM['game'] = function (f) { var before = gamesState().length; _g(f); var gs = gamesState(); if (gs.length >= before) { var g = gs.filter(function (x) { return x.date === f.date.value && x.opp === f.opp.value.trim(); }).slice(-1)[0]; if (g) { PGM.gameId = g.id; PGM.init = false; setTimeout(function () { toast('Saved. Tomorrow: tap Plan day-after on the Game log'); }, 50); } } };
  var _games = typeof viewGames === 'function' ? viewGames : null;
  if (_games) viewGames = function () { return wkDom(_games(), function (root) { var ph = root.querySelector('.pagehead'); if (!ph) return; var x = document.createElement('div'); x.innerHTML = '<a class="build-banner" href="#postgame"><span class="bb-ic">' + ic('trophy', 26) + '</span><span class="grow"><b>Plan the day after</b><small>Tap what went well and what didn’t. Get a session for your weak spots.</small></span>' + ic('arrow-right', 20) + '</a>'; ph.after(x.firstElementChild); }); };
  render();
})();
