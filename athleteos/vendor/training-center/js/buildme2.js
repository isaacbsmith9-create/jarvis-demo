/* ==================== Build for me, upgraded ====================
   1. Session flow: warm-up → skill → game-like → compete finisher.
   2. Intensity: light / medium / game-like changes which drills get picked.
   3. Every drill says what to do inside its time (rounds or a makes goal).
   4. "Make it harder": add a CLA constraint to any drill.
   5. Quick picks: one-tap ready-made sessions.
   6. More drills: scored compete finishers + more game-like work. */
BM_PRINCIPLES.compete = ['Compete', 'Keep score. Pressure you choose in practice beats pressure you meet in games.'];
(function () {
  var more = [
    /* compete finishers: [slug, name, area, subs, mins, flags, principle, how, cue, shot, format] */
    ['bm-beat-number', 'Beat Your Number', 'Shooting', 'compete', 3, 'h', 'compete', 'Two minutes, five spots around the arc. Count every make. Write the number down and beat it next time.', 'Every shot counts like a game shot.', 'catch', 'Record your makes. Beat your last number.'],
    ['bm-ghost-21', 'Ghost to 21', 'Shooting', 'compete', 5, 'h', 'compete', 'Make a three = +3 for you, make a two = +2. Every miss = +3 for the ghost. First to 21. Lose = 3 sprints.', 'Shot selection matters when misses cost you.', 'catch', 'First to 21. Lose = 3 sprints.'],
    ['bm-make-two', 'Make Two or Run', 'Shooting', 'compete', 3, 'h', 'compete', 'Free throws in pairs, game routine. Miss either one: sprint baseline to baseline, then shoot again.', 'Same routine when you’re tired.', 'ft', 'Pairs. Miss one = sprint.'],
    ['bm-ten-before-three', '10 Before 3 Misses', 'Finishing', 'compete', 4, 'h', 'compete', 'Any finish from any angle, different every rep. Get 10 makes before 3 misses, or start over.', 'Hard finishes, soft touch.', 'layup', '10 makes before 3 misses, or restart.'],
    ['bm-and-one', 'And-One Game', 'Finishing', 'compete', 4, 'h', 'compete', 'Every finish comes with a bump (pad, partner or wall-push on the gather). Make it = 1 point, make it after a real bump = 2. Play to 10.', 'Finish through it, not around it.', 'layup', 'Play to 10. Contact makes count double.'],
    ['bm-survive-60', '60-Second Survival', 'Ball Handling', 'compete', 3, '', 'compete', 'Non-stop moves for 60 seconds. Any fumble or double-touch resets the clock. Beat your longest streak.', 'Fast but clean.', '', 'Longest clean streak wins.'],
    ['bm-combo-score', 'Combo-to-Score to 7', 'Ball Handling', 'compete', 4, 'h', 'compete', 'Three-move combo at the top, then score: pull-up = 2, finish = 1. A miss gives the ghost 1. First to 7.', 'Make the last move set up the shot.', 'move', 'First to 7.'],
    /* more game-like work */
    ['bm-closeout-reads', 'Closeout Reads', 'Shooting', 'catch dribble', 4, 'h', 'reactive', 'Self-pass or partner pass. On the catch read the closeout (partner, or call it yourself late): no closeout = shoot, hard closeout = one-dribble pull-up, flying closeout = drive.', 'Read it before you catch it.', 'catch'],
    ['bm-shot-clock', 'Shot-Clock Creation', 'Shooting', 'dribble mid', 4, 'h', 'speed', 'Start at the top with a 5-second count. Create any shot off the dribble before it hits 0. New move every rep.', 'Get to your spot, don’t settle.', 'move'],
    ['bm-snatch-series', 'Snatchback & Step-Back Series', 'Shooting', 'dribble range', 4, 'h', 'balance', 'Attack, then snatchback or step-back into the shot. Alternate sides. Land balanced.', 'Create space with the feet, not the lean.', 'stepback'],
    ['bm-read-help', 'Drive & Read the Help', 'Finishing', 'speed float', 4, 'h', 'reactive', 'Drive at a chair or partner as the help defender. They step up or stay: floater if they step up, finish if they stay, kick (throw off the wall) if they come hard.', 'Eyes on the help, not the rim.', 'layup'],
    ['bm-weak-circuit', 'Weak-Hand Finishing Circuit', 'Finishing', 'footwork touch', 3, 'h', 'variable', 'Weak hand only: layup, reverse, floater, power, euro. Both sides. Different finish every rep.', 'High pickup, soft wrist.', 'layup'],
    ['bm-cone-reads', 'Cone Attack Reads', 'Ball Handling', 'change score', 4, 'h', 'reactive', 'Three cones in different spots. On a random call (or a coin flip), attack that cone with a move and score.', 'Decide late, go hard.', 'layup'],
  ];
  more.forEach(function (x) {
    if (BM_DRILLS.some(function (d) { return d.id === 'd-' + x[0]; })) return;
    var d = { id: 'd-' + x[0], slug: x[0], name: x[1], area: x[2], subs: x[3].split(' '), mins: x[4], hoop: x[5].indexOf('h') >= 0, noHoopOnly: false, partner: x[5].indexOf('p') >= 0, bam: false, grp: 'd-' + x[0], pr: x[6], how: x[7], cue: x[8], shot: x[9] || null, fmt: x[10] || '' };
    BM_DRILLS.push(d);
    var makes = d.area !== 'Ball Handling' || !!d.shot;
    if (!DRILLS.some(function (q) { return q.id === d.id; })) DRILLS.push(DR({ slug: d.slug, name: d.name, cat: d.area, diff: 3, min: Math.ceil(d.mins), sets: 1, att: makes ? Math.round(d.mins * 2.5) : Math.round(d.mins * 60), metric: makes ? 'makes' : 'reps', obj: BM_PRINCIPLES[d.pr][0] + '.', ins: d.how, coach: [d.cue], eq: d.hoop ? ['Ball', 'Hoop'] : ['Ball'], partner: d.partner }));
  });
})();
/* stage in the session flow */
function bmStage(d) { if (d.subs.indexOf('warm') >= 0) return 0; if (d.subs.indexOf('compete') >= 0) return 3; return ['reactive', 'tight', 'fatigue', 'speed'].indexOf(d.pr) >= 0 ? 2 : 1; }
var BM_INT = { light: ['Light', 'Rhythm, form, touch. No sprints or live play.'], med: ['Medium', 'A mix of skill and game-like work.'], hard: ['Game-like', 'Reactive, tight spaces, tired legs.'] };
function bmIntWeight(st, d) { var i = st.int || 'med', s = bmStage(d); if (i === 'light') return ['volume', 'balance', 'mental', 'touch'].indexOf(d.pr) >= 0 ? 2 : s === 2 ? -1 : 0; if (i === 'hard') return s === 2 ? 2 : d.pr === 'athletic' ? 1 : 0; return 0; }
/* compete drills only go in the compete block; light days skip sprints and live play */
var _bmFree = bmFree;
bmFree = function (st, d, used) {
  if (bmStage(d) === 3 && !st._compete) return false;
  var i = st._relax ? 'med' : (st.int || 'med');
  if (i === 'light' && bmStage(d) === 2) return false; /* light: no reactive, live, sprint or speed drills */
  if (i === 'hard' && (d.pr === 'volume' || d.pr === 'mental') && bmStage(d) !== 0) return false; /* game-like: no pure rhythm or visualization blocks */
  return _bmFree(st, d, used);
};
var _bmFav = bmFavFirst;
bmFavFirst = function (st, list) { var sc = function (d) { return (d.bam && st.bamFav !== false ? 2 : 0) + bmIntWeight(st, d); }; return list.map(function (d, i) { return [d, i]; }).sort(function (a, b) { return sc(b[0]) - sc(a[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; }); };
/* build: reserve time for the compete finisher, order each section skill → game-like */
var _bmBuild = bmBuild;
bmBuild = function (seed) {
  var st = bmState(), full = st.mins, cb = full < 30 ? 0 : (st.int === 'light' ? 3 : Math.min(8, Math.max(4, Math.round(full * 0.12))));
  st.mins = full - cb; st._full = full; var s; try { s = _bmBuild(seed); } finally { st.mins = full; delete st._full; }
  /* an intensity filter that left a section empty or a session short: rebuild without it rather than give a broken session */
  if (Math.abs(sum(s.sections, bmSecMins) - (full - cb)) > (full - cb) * 0.2) { st.mins = full - cb; st._full = full; st._relax = true; try { s = _bmBuild(seed); } finally { st.mins = full; delete st._full; delete st._relax; } }
  s.mins = full;
  s.sections.forEach(function (sec) { if (sec.key === 'warm') return; sec.drills.sort(function (a, b) { return bmStage(bmById(a)) - bmStage(bmById(b)); }); });
  if (cb) {
    var used = [].concat.apply([], s.sections.map(function (x) { return x.drills; })), rnd = bmRand((seed || 7) * 31 + 3);
    st._compete = true;
    var pool = BM_DRILLS.filter(function (d) { return bmStage(d) === 3 && s.areas.indexOf(d.area) >= 0 && (st.hoop ? !d.noHoopOnly : !d.hoop) && (st.who === 'partner' || !d.partner) && bmFree(st, d, used); });
    if (st.int === 'light') pool = pool.filter(function (d) { return d.slug === 'bm-make-two' || d.slug === 'bm-beat-number' || !d.hoop; });
    if (!pool.length) pool = BM_DRILLS.filter(function (d) { return bmStage(d) === 3 && (st.hoop || !d.hoop) && (st.who === 'partner' || !d.partner); });
    st._compete = false;
    pool.sort(function () { return rnd() - 0.5; }); pool = pool.map(function (d, i) { return [d, i]; }).sort(function (a, b) { var ia = s.areas.indexOf(a[0].area), ib = s.areas.indexOf(b[0].area); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a[1] - b[1]; }).map(function (x) { return x[0]; });
    var sec = { key: 'compete', area: pool[0] ? pool[0].area : 'Shooting', name: 'Compete', drills: [], m: {} }, t = 0;
    pool.forEach(function (d) { if (t + d.mins <= cb + 1 || !sec.drills.length) { sec.drills.push(d.id); t += d.mins; } });
    if (sec.drills.length) { var f = cb / t; sec.drills.forEach(function (id) { sec.m[id] = Math.max(2, Math.round(bmById(id).mins * f * 2) / 2); }); s.sections.push(sec); }
  }
  s.int = st.int || 'med';
  return s;
};
var _bmName = bmName;
bmName = function (s) { var a = s.sections.filter(function (x) { return x.key !== 'warm' && x.key !== 'compete'; }).map(function (x) { return x.name; }); return s.mins + '-Min ' + (a.length ? a.slice(0, 2).join(' + ') : 'Session'); };
/* what to do inside the time */
function bmFmt(d, mins) {
  if (!d) return ''; if (d.fmt) return d.fmt;
  var secs = Math.round(mins * 60);
  if (d.area === 'Ball Handling' && !d.shot) { var r = Math.max(2, Math.floor(secs / 60)); return r + ' rounds · 45s on / 15s off'; }
  if (d.pr === 'fatigue' || d.pr === 'speed') { var r2 = Math.max(2, Math.floor(secs / 50)); return r2 + ' rounds · 35s on / 15s off'; }
  if (d.pr === 'mental') return 'Slow and detailed';
  var goal = Math.max(3, Math.round(mins * (d.area === 'Finishing' ? 3 : 2.5) * 0.6));
  return 'Goal: ' + goal + '+ makes';
}
/* make it harder: one CLA constraint at a time */
var BM_CONS = {
  Shooting: ['1-second release from the catch', 'Closeout (chair or partner) on every catch', 'Move to a new spot every shot', 'Miss = sprint to half court and back', 'One dribble with the weak hand before the shot', 'Shoot off a self-pass on the move only'],
  Finishing: ['Weak hand only', 'Pad bump on every gather', 'Random call at the gather: left, right, reverse', '2-second clock from the catch', 'Finish off the “wrong” foot', 'Start every rep from a sprint'],
  'Ball Handling': ['Eyes up the whole time', 'Tennis ball toss mixed in', 'Partner swipes at the ball', 'Change speed on a clap', 'Finish every combo with a shot', 'Weak hand leads every move'],
};
function bmConsText(sec, id) { var d = bmById(id); if (!d || !sec.c || sec.c[id] == null) return ''; var l = BM_CONS[d.area] || BM_CONS.Shooting; return l[sec.c[id] % l.length]; }
function bmConsLine(sec, id) { var t = bmConsText(sec, id); return t ? '<div class="bm-cons">' + ic('flame', 13) + ' <b>Harder:</b> ' + esc(t) + '</div>' : ''; }
ACT['bm-harder'] = function (el) {
  var st = bmState(), sec = st.session.sections[+el.dataset.s], id = sec.drills[+el.dataset.d], d = bmById(id), l = BM_CONS[d.area] || BM_CONS.Shooting;
  sec.c = sec.c || {}; var n = sec.c[id] == null ? 0 : sec.c[id] + 1;
  if (n >= l.length) { delete sec.c[id]; save(); render(); toast('Back to the normal version'); return; }
  sec.c[id] = n; save(); render(); toast('Harder: ' + l[n] + ' (tap again for another)');
};
/* quick picks */
var BM_QUICK = [
  { n: 'Pre-practice light', d: '30 min · rhythm + touch', o: { mins: 30, int: 'light', hoop: true, areas: ['Shooting', 'Finishing'], subs: { Shooting: ['form', 'volume'], Finishing: ['touch'] } } },
  { n: 'CLA finishing', d: '45 min · game-like', o: { mins: 45, int: 'hard', hoop: true, areas: ['Finishing'], subs: { Finishing: ['footwork', 'speed', 'athletic'] } } },
  { n: 'Shot creation', d: '45 min · off the dribble', o: { mins: 45, int: 'hard', hoop: true, areas: ['Shooting', 'Ball Handling'], subs: { Shooting: ['dribble', 'mid'], 'Ball Handling': ['score'] } } },
  { n: 'Catch & shoot + floaters', d: '60 min · medium', o: { mins: 60, int: 'med', hoop: true, areas: ['Shooting', 'Finishing'], subs: { Shooting: ['catch'], Finishing: ['float'] } } },
  { n: 'Game-day tune-up', d: '20 min · light', o: { mins: 20, int: 'light', hoop: true, areas: ['Shooting'], subs: { Shooting: ['form', 'catch'] } } },
  { n: 'No-hoop handles', d: '30 min · anywhere', o: { mins: 30, int: 'med', hoop: false, areas: ['Ball Handling'], subs: {} } },
  { n: 'Full guard workout', d: '75 min · game-like', o: { mins: 75, int: 'hard', hoop: true, areas: ['Shooting', 'Ball Handling', 'Finishing'], subs: {} } },
];
function bmQuickHTML() { return '<div class="bm-lab" style="margin-top:4px">Quick picks</div><div class="bm-quick">' + BM_QUICK.map(function (q, i) { return '<button class="bm-q" data-a="bm-quick" data-i="' + i + '"><b>' + esc(q.n) + '</b><small>' + esc(q.d) + '</small></button>'; }).join('') + '</div>'; }
function bmIntHTML() { var st = bmState(), cur = st.int || 'med'; return '<div class="bm-lab" style="margin-top:20px">Intensity</div><div class="bm-seg bm-int">' + Object.keys(BM_INT).map(function (k) { return '<button class="' + (cur === k ? 'on' : '') + '" data-a="bm-set" data-k="int" data-v="' + k + '"><b>' + BM_INT[k][0] + '</b><small>' + BM_INT[k][1] + '</small></button>'; }).join('') + '</div>'; }
ACT['bm-quick'] = function (el) { var q = BM_QUICK[+el.dataset.i], st = bmState(); Object.assign(st, JSON.parse(JSON.stringify(q.o)), { surprise: false }); ACT['bm-build'](); toast(q.n + ': built. Swap anything you don’t like.'); };
