/* ==================== Programs: weeks → sessions → numbered drill lists ====================
   Built-in programs are original, CLA-first (constraints change week to week: learn it, add a rule,
   speed it up, compete). You can also build your own program from Workout Writer workouts.
   In-season mode trims every session (fewer sets, no optional drills). */
(function () {
  var add = [
    DR({ slug: 'random-side-finish', name: 'Random-Call Finishing', cat: 'Finishing', diff: 3, sec: ['Footwork'], min: 8, sets: 4, att: 8, obj: 'Finish off whatever foot and hand the call says, decided late.', ins: 'Drive from the wing. A partner (or a voice-memo of random calls) shouts “left,” “right,” “reverse” or “two-foot” at the gather. Finish that way.', coach: ['Decide at the gather, not before', 'Eyes on the rim, not the ground'] }),
    DR({ slug: 'rim-60', name: 'Rim Runner 60s', cat: 'Finishing', diff: 3, sec: ['Conditioning'], min: 6, sets: 4, att: 12, obj: 'Sixty seconds of non-stop finishing. Count your makes.', ins: 'Start under the rim. Finish, grab it out of the net, outlet dribble to a cone at the elbow or wing, attack again. Alternate sides every rep for 60 seconds.', coach: ['Soft touch when tired', 'Never jog back'] }),
    DR({ slug: 'contact-gather', name: 'Bump-Through Gathers', cat: 'Finishing', diff: 4, min: 8, sets: 4, att: 6, obj: 'Hold your line and finish after contact on the gather.', ins: 'Partner with a pad (or a wall/crash pad) bumps you on the gather step. Absorb, stay square, finish high off the glass.', coach: ['Chin over chest on contact', 'Two hands through the gather'] }),
    DR({ slug: 'short-clock-finish', name: '3-Second Finishes', cat: 'Finishing', diff: 3, min: 6, sets: 3, att: 8, obj: 'Score at the rim within 3 seconds of the catch.', ins: 'Self-pass from the wing or corner, catch on the move, score in 3 seconds or less. Count it in your head out loud.', coach: ['Attack the first step', 'One hard dribble, not three soft ones'] }),
    DR({ slug: 'off-hand-ladder', name: 'Off-Hand Ladder', cat: 'Finishing', diff: 2, min: 6, sets: 3, att: 10, obj: 'Off-hand finishes from close to far.', ins: 'Off-hand only. 2 makes from each step: 1 dribble, 2 dribbles, from the elbow, from the wing, from half court.', coach: ['High pickup', 'Wrist flick, not a push'] }),
    DR({ slug: 'creation-wheel', name: 'Shot Creation Wheel', cat: 'Shooting', diff: 4, sec: ['Ball Handling'], min: 12, sets: 4, att: 8, obj: 'Rotate creation shots so no two reps are the same.', ins: 'From the wing: rep 1 snatchback, rep 2 spin fade, rep 3 step-back, rep 4 hesi pull. Then switch sides. Same shot pocket every time.', coach: ['Land where you took off', 'Ball goes up with your eyes'] }),
    DR({ slug: 'reloc-kicks', name: 'Drive, Kick, Relocate', cat: 'Shooting', diff: 3, sec: ['Movement'], min: 8, sets: 4, att: 6, obj: 'Catch-and-shoot after relocating off your own drive.', ins: 'Drive baseline, throw it off the wall/out to a target (or a rebounder), drift to the corner or lift to the wing, catch and shoot.', coach: ['Feet set before the catch', 'Move to the open spot, not back where you were'] }),
    DR({ slug: 'one-dribble-reads', name: 'One-Dribble Reads', cat: 'Shooting', diff: 3, min: 8, sets: 4, att: 8, obj: 'Catch, read, one dribble pull-up either direction.', ins: 'Catch on the wing. Partner points left or right as you catch (or flip a coin). One hard dribble that way, pull-up.', coach: ['Shot pocket on the gather', 'Shoulders square before you rise'] }),
    DR({ slug: 'ghost-11', name: 'Ghost Game to 11', cat: 'Shooting', diff: 3, sec: ['Game Situations'], min: 10, sets: 1, att: 20, obj: 'A shooting game with a score and a consequence.', ins: 'Move around the arc. Make = +1 for you. Miss = +2 for the ghost. First to 11. Lose? 2 sprints and play again.', coach: ['Treat every shot like a game shot', 'Same routine on the last shot as the first'] }),
    DR({ slug: 'fatigue-threes', name: 'Sprint-In Threes', cat: 'Shooting', diff: 3, sec: ['Conditioning'], min: 8, sets: 4, att: 6, obj: 'Shoot on tired legs.', ins: 'Sprint to half court and back, catch at the wing or corner, shoot. Every rep starts with the sprint.', coach: ['Legs into the shot', 'Hold the follow-through even when tired'] }),
    DR({ slug: 'tennis-handle', name: 'Tennis-Ball Handles', cat: 'Ball Handling', diff: 3, min: 8, sets: 4, att: 20, metric: 'reps', obj: 'Handle with your eyes and hands busy.', ins: 'Dribble with one hand, toss and catch a tennis ball with the other. Add moves: cross, between, behind, while keeping the toss going.', coach: ['Eyes up', 'Don’t slow the dribble to catch'] }),
    DR({ slug: 'pressure-pocket', name: 'Pressure Pocket', cat: 'Ball Handling', diff: 4, sec: ['Game Situations'], min: 8, sets: 4, att: 30, metric: 'reps', obj: 'Keep the ball alive with someone reaching for it.', ins: '30 seconds: a partner swipes, bumps and pokes while you keep a live dribble in a 10×10 box. Any turnover = restart the clock.', coach: ['Body between the ball and the hand', 'Low and strong, then explode out'] }),
    DR({ slug: 'eyes-up-calls', name: 'Eyes-Up Calls', cat: 'Ball Handling', diff: 2, min: 6, sets: 3, att: 30, metric: 'reps', obj: 'Handle without looking down.', ins: 'Partner holds up fingers or calls a move. Say the number out loud and do the called move. No looking at the ball.', coach: ['Read, then react', 'Stay in your stance'] }),
    DR({ slug: 'weak-hand-flow', name: 'Weak-Hand Flow', cat: 'Ball Handling', diff: 2, min: 6, sets: 3, att: 30, metric: 'reps', obj: 'Freestyle with only your weak hand.', ins: '30 seconds of non-stop moves with your weak hand only: pound, in-and-out, crossover to the same hand, wraps. Change speed and height.', coach: ['Push the ball, don’t pat it', 'Change speeds'] }),
  ];
  add.forEach(function (d) { if (!DRILLS.some(function (x) { return x.id === d.id; })) DRILLS.push(d); });
  MODE_MAP['d-random-side-finish'] = ['game']; MODE_MAP['d-rim-60'] = ['game', 'skill']; MODE_MAP['d-contact-gather'] = ['game', 'strength']; MODE_MAP['d-short-clock-finish'] = ['game']; MODE_MAP['d-off-hand-ladder'] = ['skill'];
  MODE_MAP['d-creation-wheel'] = ['skill', 'game']; MODE_MAP['d-reloc-kicks'] = ['game']; MODE_MAP['d-one-dribble-reads'] = ['game']; MODE_MAP['d-ghost-11'] = ['game']; MODE_MAP['d-fatigue-threes'] = ['game'];
  MODE_MAP['d-tennis-handle'] = ['creative', 'skill']; MODE_MAP['d-pressure-pocket'] = ['game', 'strength']; MODE_MAP['d-eyes-up-calls'] = ['skill']; MODE_MAP['d-weak-hand-flow'] = ['creative', 'skill'];
})();
var PG_WEEKS = ['Learn it', 'Add a rule', 'Speed it up', 'Compete'];
/* each drill: [drillId, [sets, reps] or 'm:minutes', [week 1..4 constraint]] */
var PROGRAMS = [
  { id: 'finish', n: 'Finish Through Anything', sub: 'CLA finishing', c: '#ff5d5d', ic: 'flame', about: 'Constraints-led finishing. Week 1 you learn each pattern. Then every week adds a rule (random calls, a clock, contact, a score), so your body learns to solve it instead of repeating one perfect rep.',
    s: [
      { n: 'Glass & Gathers', focus: 'Finishing', d: [
        ['d-gather-types', [2, 8], ['Hop, then 1-2. Same spot both sides', 'Partner calls hop or 1-2 at the dribble', 'Gather within 2 dribbles from the 3-point line', 'Lose a make if you travel or shuffle']],
        ['d-glass-finishing', [4, 10], ['Right hand off the toss, catch out of the net, finish left', 'Random hand: decide on the catch', 'Continuous 45 seconds, count makes', 'Pad bump on every landing. Beat last week’s count']],
        ['d-pickup-series', [3, 8], ['Inside foot, outside foot, two-foot, both sides', 'Pickup on the “wrong” foot every other rep', 'Full speed from half court', 'Chair or pad contest at the rim']],
        ['d-off-hand-ladder', [3, 10], ['2 makes from each step', 'Off-hand reverse at every step', 'Clock it: under 90 seconds', 'Miss = start the ladder over']],
        ['d-rim-60', [3, 12], ['Alternate sides, soft touch', 'Random side: look at the rim and go', 'Beat your best 60-second count', 'Two rounds, best count wins']],
      ], opt: [['d-self-lob', [3, 6], ['Catch at the highest point', 'Off one foot', 'Finish off the other side of the rim', '5 in a row or restart']]] },
      { n: 'Contact & Angles', focus: 'Finishing', d: [
        ['d-euro-footwork', [2, 8], ['Walk-through, then game speed', 'Euro or straight line: decide at the gather', 'From a sprint', 'Pad contest on the second step']],
        ['d-two-foot-power', [3, 8], ['Jump stop, chin the ball, go up strong', 'Pump fake first if the call says “pump”', 'Score within 2 seconds of the stop', 'Contact on every rep']],
        ['d-contact-gather', [4, 6], ['Light bumps, hold your line', 'Bump comes at a random time', 'Harder bumps, finish high off the glass', 'And-one: make it after contact or it doesn’t count']],
        ['d-up-and-under', [3, 8], ['Both sides, clean footwork', 'Read the pump fake: if they bite, go under', 'One pivot only', 'Partner contests the shot']],
        ['d-transition-finishes', [3, 6], ['Full speed, simple finish', 'Partner chases from behind', 'Read: pull-up, finish, or kick', 'Score in 4 seconds from half court']],
      ], opt: [['d-finish-vs-help', [3, 6], ['Floater or finish over the help', 'Help comes from a random side', 'One gather only', 'Play to 5 makes']]] },
      { n: 'Creative Finishes', focus: 'Finishing', d: [
        ['d-cross-jab-sweep', [3, 6], ['Jab, cross, sweep and go', 'Read the jab: pull-up or drive', 'From the catch in 1 second', 'Live: partner guards the drive']],
        ['d-highest-point', [3, 6], ['Toss high, catch at the peak, land balanced', 'Finish off the opposite foot', 'Catch, one dribble, finish', 'Beat your make count']],
        ['d-random-side-finish', [4, 8], ['Calls come early', 'Calls come at the gather', 'Calls at the gather + pad contact', 'Miss = 2 push-ups. Track makes']],
        ['d-short-clock-finish', [3, 8], ['Count out loud', 'Start from the corner and the wing', 'Two-second clock', 'First to 10 makes']],
      ], opt: [['d-floater-ladder', [3, 8], ['Short, medium, long', 'Off one foot and two feet', 'Floater over a raised hand', '3 in a row from each distance']]] },
    ] },
  { id: 'shooter', n: 'Shot Maker', sub: 'Feel-good + creation + movement', c: '#ff913d', ic: 'crosshair', about: 'Three kinds of shooting days. Rhythm days keep the shot feeling good. Creation days rotate snatchbacks, spin fades, step-backs and hesi pulls. Movement days shoot off cuts, relocations and sprints. Constraints get tighter each week.',
    s: [
      { n: 'Feel-Good Rhythm', focus: 'Shooting', d: [
        ['d-form-close', [2, 10], ['Close and one-handed: swish only', 'Step back after every swish', 'Eyes closed on the release, check the follow-through', '10 swishes in a row']],
        ['d-mid-catch', [3, 15], ['Elbows, short corners, top', 'Catch on a hop every other shot', 'Shoot in under 1 second', 'Make 12 of 15 to move on']],
        ['d-midrange-elbows', [3, 10], ['One hard dribble, sit into it, rise', 'Dribble left and right, called on the catch', 'Two-dribble max, quick release', 'Beat 7 of 10']],
        ['d-cs-5-spots', [5, 10], ['Corner, wing, top, wing, corner', 'Catch off a self-pass on the move', 'Shot clock: 1 second from the catch', 'Need 7 of 10 at each spot or repeat it']],
        ['d-ft-timed', [2, 10], ['Same routine every time', 'After every 2, a sprint', 'Shoot within 5 seconds of the catch', 'Miss = start the set over']],
      ], opt: [] },
      { n: 'Shot Creation', focus: 'Shooting', d: [
        ['d-hesi-drive', [2, 8], ['Hesi into a drive, sell it', 'Hesi into the pull-up or drive: decide on the hesi', 'Full speed from half court', 'Partner guards, live']],
        ['d-creation-wheel', [4, 8], ['Snatchback, spin fade, step-back, hesi pull', 'Random order: call it on the catch', 'Two dribbles max into each shot', 'Contest on every shot, track makes per move']],
        ['d-difficult-fade', [3, 8], ['Elbow fade, both shoulders', 'Bump before the fade', 'From the catch in 2 seconds', 'Hand in your face every rep']],
        ['d-late-clock', [3, 6], ['5-second clock, any pull-up', '3-second clock', '3 seconds, defender (or chair) closing', 'Lose the game = 5 sprints']],
      ], opt: [['d-pressure-fts', [2, 10], ['Two shots, game routine', 'After a sprint', 'Make both or run', 'Win 8 of 10']]] },
      { n: 'Movement & Pressure', focus: 'Shooting', d: [
        ['d-pin-down-shooting', [3, 8], ['Walk in, sprint out, hop into the shot', 'Read: curl, fade, or straight', 'Catch to release under 1 second', 'Make 6 of 8 or repeat']],
        ['d-reloc-kicks', [4, 6], ['Corner drift and wing lift', 'Relocate to a random spot called on the kick', 'Shoot within 1 second of the catch', 'Partner closes out on every catch']],
        ['d-one-dribble-reads', [4, 8], ['Call comes early', 'Call comes on the catch', 'Closeout from a partner', 'First to 15 makes']],
        ['d-fatigue-threes', [4, 6], ['Sprint, set your feet, shoot', 'Sprint + defensive slide first', 'Shot clock 2 seconds after the sprint', 'Beat last week’s makes']],
        ['d-ghost-11', 'm:10', ['Ghost gets +2 on a miss', 'Only catch-and-shoot after a move', 'Ghost gets +3 on a miss', 'Best of three']],
      ], opt: [] },
    ] },
  { id: 'handle', n: 'Handle Under Pressure', sub: 'Strong, creative, eyes up', c: '#c8a46b', ic: 'activity', about: 'Basics, then strength, then chaos. Cuff and power dribbles so bodies don’t knock it loose, creative flow so moves link together, then pressure and calls so you handle without thinking.',
    s: [
      { n: 'Strong Ball', focus: 'Ball Handling', d: [
        ['d-pound-series', 'm:5', ['High, medium, low pounds, both hands', 'Pound through a partner tapping the ball', 'Faster: 20 seconds per height', 'Max pounds in 30 seconds, beat it']],
        ['d-cuff-handle', [4, 20], ['Cuff and power dribble, stay low', 'Partner bumps your shoulder on every move', 'Change direction on a clap', 'Bump + swipe: keep it alive 30 seconds']],
        ['d-retreat-attack', [3, 8], ['Two retreats, re-attack', 'Partner pressures the retreat', 'Score in 2 dribbles off the re-attack', 'Live 1v1 from half court']],
        ['d-pressure-pocket', [4, 30], ['Light reach-ins', 'Bumps plus reach-ins', 'Two defenders (or a chair + partner)', 'Turnover = restart the clock']],
      ], opt: [['d-bh-finish', [3, 6], ['Combo into a finish', 'Combo called by a partner', 'Finish in 3 dribbles', 'Contact at the rim']]] },
      { n: 'Creative Flow', focus: 'Ball Handling', d: [
        ['d-two-ball', 'm:6', ['Same time, alternate, one high one low', 'Add crosses and wraps', '30-second rounds max speed', 'Lose it = 5 push-ups']],
        ['d-weak-hand-flow', [3, 30], ['Weak hand only, change speeds', 'Add a move called out', 'Walking forward and back', 'No mistakes for 45 seconds']],
        ['d-freestyle-combos', [4, 30], ['3–5 moves linked', 'Tennis ball toss mixed in', 'Finish every combo with a shot', 'Partner guards, play to 3']],
        ['d-tennis-handle', [4, 20], ['Stationary, simple moves', 'Moves between tosses', 'Walking and changing direction', 'Partner throws the tennis ball']],
      ], opt: [['d-spider', 'm:3', ['Slow and clean', 'Faster', 'Eyes up the whole time', 'Max touches in 30 seconds']]] },
      { n: 'Read & Attack', focus: 'Ball Handling', d: [
        ['d-eyes-up-calls', [3, 30], ['Say the fingers out loud', 'Called move on the number', 'Moving forward', 'Wrong move = restart']],
        ['d-change-of-pace', [3, 6], ['Slow, fast, slow', 'Speed change on a clap', 'Score after the change', 'Partner guards']],
        ['d-read-cards', [3, 8], ['Card shown early', 'Card shown at the last second', 'Shot clock 4 seconds', 'Play to 10 points']],
        ['d-scoring-11', 'm:10', ['Live 1v1, make it, take it', 'Max 3 dribbles', 'Shot clock 6 seconds', 'Lose = sprint']],
      ], opt: [] },
    ] },
  { id: 'inseason', n: 'In-Season Tune-Up', sub: '20–30 min, stay sharp', c: '#7fb0d6', ic: 'repeat', about: 'Short sessions for game weeks. Rhythm shots, a quick finishing hit and a handle touch-up. Never hard: you save your legs for practice and games.',
    s: [
      { n: 'Rhythm + Finish', focus: 'Shooting', d: [
        ['d-form-close', [1, 10], ['Swish only', 'Swish only', 'Swish only', 'Swish only']],
        ['d-mid-catch', [3, 10], ['Elbows and top', 'Short corners added', 'Catch on a hop', 'Make 8 of 10']],
        ['d-cs-5-spots', [3, 10], ['Corners and wings', 'All 5 spots', '1-second release', '7 of 10 per spot']],
        ['d-glass-finishing', [2, 10], ['Easy rhythm, both hands', 'Random hand', 'Catch it out of the net', 'Count makes, no contact']],
        ['d-ft-timed', [1, 10], ['Game routine', 'Game routine', 'After a sprint', 'Make 8']],
      ], opt: [] },
      { n: 'Handle + Pull-ups', focus: 'Ball Handling', d: [
        ['d-pound-series', 'm:3', ['Both hands', 'Both hands', 'Eyes up', 'Eyes up']],
        ['d-freestyle-combos', [2, 30], ['Easy flow', 'Add a move', 'Finish with a pull-up', 'Finish with a pull-up']],
        ['d-midrange-elbows', [3, 8], ['One dribble pull', 'Either direction', 'Quick release', '6 of 8']],
        ['d-pressure-fts', [2, 10], ['Game routine', 'Game routine', 'After a sprint', 'Make both or run']],
      ], opt: [] },
    ] },
];
function pgState() {
  if (!S.progs || typeof S.progs !== 'object') S.progs = { active: {}, done: {}, inSeason: false, mine: [] };
  ['active', 'done'].forEach(function (k) { if (!S.progs[k] || typeof S.progs[k] !== 'object') S.progs[k] = {}; }); if (!Array.isArray(S.progs.mine)) S.progs.mine = []; return S.progs;
}
var PG = { week: {}, open: {}, active: null };
function pgDrillSpec(x, w) {
  var d = drillById(x[0]); if (!d) return null; var t = typeof x[1] === 'string', ins = pgState().inSeason;
  var sets = t ? 1 : x[1][0], n = t ? 1 : x[1][1], mins = t ? +x[1].slice(2) : 0;
  if (ins) { if (t) mins = Math.max(2, Math.round(mins * 0.67)); else sets = Math.max(1, Math.round(sets * 0.67)); }
  return { id: d.id, name: d.name, cat: d.category, metric: d.metric, sets: sets, n: n, mins: mins, time: t, cue: x[2] ? x[2][Math.min(w, x[2].length - 1)] : '', d: d };
}
/* normalized program: { id, n, sub, c, ic, about, custom, weeks: [ [ session ] ] } */
function pgById(id) {
  var p = PROGRAMS.filter(function (x) { return x.id === id; })[0];
  if (p) return { id: p.id, n: p.n, sub: p.sub, c: p.c, ic: p.ic, about: p.about, custom: false, weeks: PG_WEEKS.map(function (wn, w) { return p.s.map(function (s) { return { n: s.n, focus: s.focus, drills: s.d.map(function (x) { return pgDrillSpec(x, w); }).filter(Boolean), opt: pgState().inSeason ? [] : (s.opt || []).map(function (x) { return pgDrillSpec(x, w); }).filter(Boolean) }; }); }), wnames: PG_WEEKS };
  var m = pgState().mine.filter(function (x) { return x.id === id; })[0]; if (!m) return null;
  return { id: m.id, n: m.n, sub: 'My program', c: m.c || '#e9d98d', ic: 'notebook-pen', about: m.about || '', custom: true, wnames: m.weeks.map(function (_, i) { return 'Week ' + (i + 1); }),
    weeks: m.weeks.map(function (wk) { return wk.map(function (wid) { var wo = S.workouts.find(function (x) { return x.id === wid; }); return wo ? { n: wo.name, focus: wo.category, workoutId: wo.id, drills: wo.items.map(function (i) { return { id: i.drillId, name: i.name, cat: i.category, metric: i.metric, sets: i.targetSets, n: i.targetAttempts, mins: i.timeLimitSec ? Math.round(i.timeLimitSec / 60) : 0, time: !!i.timeLimitSec, cue: i.layer || '', item: i }; }), opt: [] } : { n: 'Removed workout', focus: '', drills: [], opt: [], gone: true }; }); }) };
}
function pgAll() { return PROGRAMS.map(function (p) { return p.id; }).concat(pgState().mine.map(function (m) { return m.id; })); }
function pgKey(pid, w, s) { return pid + ':' + w + ':' + s; }
function pgDone(pid, w, s) { return !!pgState().done[pgKey(pid, w, s)]; }
function pgProgress(p) { var tot = 0, dn = 0; p.weeks.forEach(function (wk, w) { wk.forEach(function (_, s) { tot++; if (pgDone(p.id, w, s)) dn++; }); }); return { tot: tot, done: dn, pct: tot ? Math.round(dn / tot * 100) : 0 }; }
function pgNext(p) { for (var w = 0; w < p.weeks.length; w++) for (var s = 0; s < p.weeks[w].length; s++) if (!pgDone(p.id, w, s) && !p.weeks[w][s].gone) return { w: w, s: s, sess: p.weeks[w][s] }; return null; }
function pgMins(sess, withOpt) { return Math.round(sum(sess.drills.concat(withOpt ? sess.opt : []), function (x) { return x.time ? x.mins : x.metric === 'makes' ? (x.sets * x.n) / 2.6 + (x.sets - 1) * 0.5 : x.sets * Math.max(1.2, x.n * (x.n >= 20 ? 0.05 : 0.15)) + (x.sets - 1) * 0.5; }) + 3); }
function pgItems(sess) {
  return sess.drills.concat(sess.opt).map(function (x) { if (x.item) return Object.assign({}, x.item);
    return { drillId: x.id, name: x.name, category: x.cat, metric: x.metric === 'makes' ? 'makes' : 'reps', targetSets: x.sets, targetAttempts: x.time ? 1 : x.n, restSec: 30, timeLimitSec: x.time ? x.mins * 60 : 0, layer: (x.time ? x.mins + ' min. ' : '') + (x.cue || '') }; });
}
function pgSpec(x) { return x.time ? x.mins + ' min' : x.sets + ' × ' + x.n + (x.metric === 'makes' ? ' shots' : x.n >= 20 ? ' sec' : ' reps'); }
/* ---------- views ---------- */
function pgTile(p, size) { return '<span class="pg-tile" style="--c:' + p.c + ';--s:' + (size || 44) + 'px">' + ic(p.ic, Math.round((size || 44) * 0.45)) + '</span>'; }
function viewPrograms() {
  var st = pgState(), act = pgAll().filter(function (id) { return st.active[id]; }).map(pgById).filter(Boolean), others = pgAll().filter(function (id) { return !st.active[id]; }).map(pgById).filter(Boolean);
  var row = function (p) { var pr = pgProgress(p), nx = pgNext(p); return '<div class="pg-row"><a class="pg-rowl" href="#prog-' + p.id + '">' + pgTile(p, 46) + '<span class="grow"><b>' + esc(p.n) + '</b><small>' + (nx ? esc(p.wnames[nx.w]) + ' · Day ' + (nx.s + 1) + ' · ' + esc(nx.sess.n) : 'Finished') + '</small><span class="pg-bar"><i style="width:' + pr.pct + '%;background:' + p.c + '"></i></span></span></a>' + (nx ? '<button class="btn sm" data-a="pg-start" data-p="' + p.id + '" data-w="' + nx.w + '" data-s="' + nx.s + '">' + ic('play', 14) + ' Start</button>' : '<span class="tag g">Done</span>') + '</div>'; };
  return pageHead('Train', 'Programs', '<button class="btn sm" data-a="pg-new">' + ic('plus', 15) + ' Build my own</button>') + pgSeasonRow() +
    (act.length ? '<section class="panel pg-mine"><div class="phead"><div><h3>My programs</h3><div class="sub">Pick up where you left off</div></div></div>' + act.map(row).join('') + '</section>' : '') +
    '<div class="kick" style="margin:18px 2px 10px">' + (act.length ? 'More programs' : 'Pick a program') + '</div><div class="pg-grid">' + others.map(function (p) { var ss = sum(p.weeks, function (w) { return w.length; }); return '<a class="pg-card" href="#prog-' + p.id + '" style="--c:' + p.c + '">' + pgTile(p, 48) + '<b>' + esc(p.n) + '</b><small>' + esc(p.sub) + '</small><em>' + p.weeks.length + ' weeks · ' + ss + ' sessions</em></a>'; }).join('') +
    '<button class="pg-card pg-newc" data-a="pg-new">' + '<span class="pg-tile" style="--c:#e9d98d;--s:48px">' + ic('plus', 22) + '</span><b>Build my own</b><small>Weeks made of your Workout Writer workouts</small></button></div>';
}
function pgSeasonRow() { var on = pgState().inSeason; return '<label class="pg-season"><span><b>In-season mode</b><small>' + (on ? 'On: sessions are about a third shorter, optional drills hidden' : 'Shorter sessions for game weeks') + '</small></span><input type="checkbox" class="pg-switch" data-c="pg-season" ' + (on ? 'checked' : '') + ' aria-label="In-season mode"></label>'; }
function viewProgramPage(id) {
  var p = pgById(id); if (!p) return '<div class="empty"><b>Program not found</b><a href="#programs">Back to programs</a></div>';
  var st = pgState(), nx = pgNext(p), w = PG.week[id] != null ? PG.week[id] : nx ? nx.w : 0, wk = p.weeks[w] || [], ss = sum(p.weeks, function (x) { return x.length; });
  return '<a class="crumb" href="#programs">' + ic('chevron-left', 14) + ' Programs</a>' +
    '<div class="pg-head">' + pgTile(p, 52) + '<div class="grow"><h1>' + esc(p.n) + '</h1><div class="small ink2">' + p.weeks.length + ' weeks · ' + ss + ' sessions · <button class="linkbtn" data-a="pg-about" data-p="' + p.id + '">About</button></div></div><div class="btns">' +
    (st.active[id] ? '<button class="btn sm" data-a="pg-week-add" data-p="' + p.id + '" data-w="' + w + '">' + ic('calendar-days', 15) + ' Add week ' + (w + 1) + ' to my week</button>' : '<button class="btn sm p" data-a="pg-join" data-p="' + p.id + '">' + ic('plus', 15) + ' Start this program</button>') +
    (p.custom ? '<button class="btn sm g" data-a="pg-edit" data-p="' + p.id + '">Edit</button>' : '') + '</div></div>' +
    (PG.open['about-' + id] ? '<p class="pg-about">' + esc(p.about || 'Your own program.') + '</p>' : '') +
    (nx ? '<button class="pg-next" data-a="pg-start" data-p="' + p.id + '" data-w="' + nx.w + '" data-s="' + nx.s + '" style="--c:' + p.c + '"><span><span class="kick">' + (pgProgress(p).done ? 'Up next' : 'Start here') + '</span><b>W' + (nx.w + 1) + ' · Day ' + (nx.s + 1) + ' · ' + esc(nx.sess.n) + '</b><small>' + nx.sess.drills.length + ' drills · ~' + pgMins(nx.sess) + ' min' + (st.inSeason ? ' · in-season' : '') + '</small></span><span class="pg-play">' + ic('play', 22) + '</span></button>' : '<div class="pg-next done"><b>Program complete</b><small>Every session done. Run it back or pick another.</small></div>') +
    '<div class="pg-weeks" role="tablist">' + p.weeks.map(function (x, i) { var all = x.length && x.every(function (_, s) { return pgDone(id, i, s); }); return '<button role="tab" aria-selected="' + (i === w) + '" class="' + (i === w ? 'on' : '') + (all ? ' all' : '') + '" data-a="pg-wk" data-p="' + id + '" data-v="' + i + '">W' + (i + 1) + (all ? ' ' + ic('check', 12) : '') + '</button>'; }).join('') + (p.custom ? '<button data-a="pg-addweek" data-p="' + id + '" aria-label="Add a week">' + ic('plus', 13) + '</button>' : '') + '</div>' +
    '<div class="pg-wname">' + esc(p.wnames[w] || '') + (p.custom ? '' : ' <span class="tiny muted">· constraints change every week</span>') + '</div>' +
    '<div class="pg-sessions">' + wk.map(function (sess, s) { var dn = pgDone(id, w, s); return '<div class="pg-sess' + (dn ? ' done' : '') + '"><a href="#psess-' + id + '-' + w + '-' + s + '"><span class="pg-num" style="--c:' + p.c + '">' + (dn ? ic('check', 18) : s + 1) + '</span><span class="grow"><b>Day ' + (s + 1) + ' · ' + esc(sess.n) + '</b><small>' + sess.drills.length + ' drills · ~' + pgMins(sess) + ' min' + (sess.opt.length ? ' · +' + sess.opt.length + ' optional' : '') + '</small></span>' + ic('chevron-right', 18) + '</a>' +
      (p.custom ? '<button class="wk-ib" data-a="pg-rmsess" data-p="' + id + '" data-w="' + w + '" data-s="' + s + '" aria-label="Remove">' + ic('x', 13) + '</button>' : '') + '</div>'; }).join('') +
    (p.custom ? '<button class="pg-addsess" data-a="pg-addsess" data-p="' + id + '" data-w="' + w + '">' + ic('plus', 15) + ' Add a session from my workouts</button>' : '') + (!wk.length && !p.custom ? '<div class="empty">No sessions this week</div>' : '') + '</div>';
}
function viewPSession(rest) {
  var m = rest.match(/^(.+)-(\d+)-(\d+)$/); if (!m) return viewPrograms(); var id = m[1], w = +m[2], s = +m[3], p = pgById(id), sess = p && p.weeks[w] && p.weeks[w][s]; if (!sess) return viewPrograms();
  var dn = pgDone(id, w, s), li = function (x, i) { var k = 'd' + i + x.id, op = PG.open[k]; return '<div class="pg-drill' + (op ? ' open' : '') + '"><button class="pg-dh" data-a="pg-open" data-k="' + esc(k) + '" aria-expanded="' + !!op + '"><span class="pg-dn">' + (i + 1) + '</span><span class="grow"><b>' + esc(x.name) + '</b><small>' + pgSpec(x) + '</small></span>' + ic('chevron-right', 16, 'pg-chev') + '</button>' +
    (x.cue ? '<div class="pg-cue">' + ic('flame', 13) + ' ' + esc(x.cue) + '</div>' : '') +
    (op && x.d ? '<div class="pg-dbody"><p>' + esc(x.d.instructions || x.d.objective || '') + '</p>' + (x.d.coaching && x.d.coaching.length ? '<ul>' + x.d.coaching.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') + '<a class="tiny" href="#drill-' + esc(x.id) + '">Full drill page ' + ic('arrow-right', 11) + '</a></div>' : '') + '</div>'; };
  return '<a class="crumb" href="#prog-' + id + '">' + ic('chevron-left', 14) + ' ' + esc(p.n) + '</a>' +
    '<div class="pg-shead" style="--c:' + p.c + '"><div class="kick">W' + (w + 1) + ' · Day ' + (s + 1) + ' · ' + esc(p.wnames[w] || '') + '</div><h1>' + esc(sess.n) + '</h1><div class="small ink2">' + sess.drills.length + ' drills · ~' + pgMins(sess) + ' min' + (pgState().inSeason && !p.custom ? ' · in-season version' : '') + '</div>' +
    '<div class="btns" style="margin-top:14px"><button class="btn p" data-a="pg-start" data-p="' + id + '" data-w="' + w + '" data-s="' + s + '">' + ic('play', 16) + ' Start session</button><button class="btn' + (dn ? ' g' : '') + '" data-a="pg-done" data-p="' + id + '" data-w="' + w + '" data-s="' + s + '">' + ic('check', 15) + (dn ? ' Done' : ' Mark done') + '</button><button class="btn g" data-a="pg-to-week" data-p="' + id + '" data-w="' + w + '" data-s="' + s + '">' + ic('calendar-days', 15) + ' Add to my week</button></div></div>' +
    '<div class="pg-list">' + sess.drills.map(li).join('') + '</div>' +
    (sess.opt.length ? '<div class="pg-optlab"><span>Optional · when you want more</span></div><div class="pg-list">' + sess.opt.map(function (x, i) { return li(x, sess.drills.length + i); }).join('') + '</div>' : '');
}
/* ---------- actions ---------- */
function pgRun(pid, w, s) {
  var p = pgById(pid), sess = p && p.weeks[w] && p.weeks[w][s]; if (!sess || !sess.drills.length) { toast('That session has no drills', 'warn'); return; }
  if (!pgState().active[pid]) pgState().active[pid] = { started: Date.now() };
  PG.active = { p: pid, w: w, s: s }; startRun(pgItems(sess), p.n + ': ' + sess.n, sess.workoutId || null, null);
}
ACT['pg-start'] = function (el) { pgRun(el.dataset.p, +el.dataset.w, +el.dataset.s); };
ACT['pg-join'] = function (el) { pgState().active[el.dataset.p] = { started: Date.now() }; save(); render(); toast('Added to My programs'); };
ACT['pg-about'] = function (el) { var k = 'about-' + el.dataset.p; PG.open[k] = !PG.open[k]; render(); };
ACT['pg-wk'] = function (el) { PG.week[el.dataset.p] = +el.dataset.v; render(); };
ACT['pg-open'] = function (el) { var k = el.dataset.k; PG.open[k] = !PG.open[k]; render(); };
ACT['pg-done'] = function (el) { var k = pgKey(el.dataset.p, +el.dataset.w, +el.dataset.s), st = pgState(); if (st.done[k]) delete st.done[k]; else { st.done[k] = today(); if (!st.active[el.dataset.p]) st.active[el.dataset.p] = { started: Date.now() }; } save(); render(); };
CHG['pg-season'] = function (el) { pgState().inSeason = !!el.checked; save(); render(); toast(el.checked ? 'In-season mode on: shorter sessions' : 'In-season mode off'); };
function pgWeekAdd(key, di) { var keep = WK.off; WK.off = 0; var b = wkAdd(di, key); WK.off = keep; return b; }
ACT['pg-to-week'] = function (el) {
  var t = today(), ws = weekStart(t), d = wkDays(ws, true), di = Math.round((keyDate(t) - keyDate(ws)) / 864e5);
  var b = pgWeekAdd('ps:' + pgKey(el.dataset.p, +el.dataset.w, +el.dataset.s), di); b.mins = wtInfo(b.k).m; save(); toast('Added to today in My Week. Drag it to another day there.'); render();
};
/* spread a week of sessions over the lightest days left this week */
ACT['pg-week-add'] = function (el) {
  var p = pgById(el.dataset.p), w = +el.dataset.w, t = today(), ws = weekStart(t), d = wkDays(ws, true), ti = Math.round((keyDate(t) - keyDate(ws)) / 864e5);
  var todo = p.weeks[w].map(function (_, s) { return s; }).filter(function (s) { return !pgDone(p.id, w, s) && !d.some(function (day) { return day.some(function (b) { return b.k === 'ps:' + pgKey(p.id, w, s); }); }); });
  if (!todo.length) { toast('That week is already planned or done'); return; }
  var days = []; for (var i = ti; i < 7; i++) days.push(i); if (!days.length) days = [6];
  days.sort(function (a, b) { var la = sum(d[a], function (x) { return x.mins; }), lb = sum(d[b], function (x) { return x.mins; }); return la - lb || a - b; });
  var pick = days.slice(0, todo.length).sort(function (a, b) { return a - b; });
  todo.forEach(function (s, i) { var b = pgWeekAdd('ps:' + pgKey(p.id, w, s), pick[i % pick.length]); b.mins = pgMins(p.weeks[w][s]); });
  save(); render(); toast('Added ' + todo.length + ' session' + (todo.length > 1 ? 's' : '') + ' to your lightest days. Move them in My Week.');
};
/* build-your-own */
ACT['pg-new'] = function () { modal('Build a program', '<form data-form="pg-new" class="grid" style="gap:12px"><div class="fld"><label class="f" for="pg-nn">Name</label><input id="pg-nn" name="n" maxlength="40" required placeholder="e.g. Summer Guard Program"></div><div class="fld"><label class="f" for="pg-nw">Weeks</label><select id="pg-nw" name="w">' + [1, 2, 3, 4, 6, 8, 10, 12].map(function (n) { return '<option' + (n === 4 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div><div class="fld"><label class="f" for="pg-na">What it’s for (optional)</label><input id="pg-na" name="a" maxlength="160"></div><p class="tiny muted">Sessions come from your Workout Writer workouts. You add them week by week.</p><div class="btns"><button class="btn p" type="submit">Create</button></div></form>'); };
FORM['pg-new'] = function (f) { var n = f.n.value.trim(); if (!n) return; var p = { id: 'my-' + uid(), n: n, about: f.a.value.trim(), weeks: [], c: '#e9d98d' }; for (var i = 0; i < +f.w.value; i++) p.weeks.push([]); pgState().mine.push(p); pgState().active[p.id] = { started: Date.now() }; save(); closeModalSafe(); location.hash = '#prog-' + p.id; };
function closeModalSafe() { closeModal(); }
function pgMine(id) { return pgState().mine.filter(function (x) { return x.id === id; })[0]; }
ACT['pg-addweek'] = function (el) { var m = pgMine(el.dataset.p); if (!m) return; m.weeks.push([]); PG.week[m.id] = m.weeks.length - 1; save(); render(); };
ACT['pg-addsess'] = function (el) {
  var ws = S.workouts.filter(function (w) { return w.writer || (w.custom && !w.coach); });
  if (!ws.length) { toast('Write a workout first in the Workout Writer', 'warn'); location.hash = '#writer'; return; }
  modal('Add a session to week ' + (+el.dataset.w + 1), '<div class="list">' + ws.map(function (w) { return '<button class="li pg-pick" data-a="pg-pick" data-p="' + el.dataset.p + '" data-w="' + el.dataset.w + '" data-id="' + w.id + '"><div class="main"><b>' + esc(w.name) + '</b><div class="tiny">' + w.items.length + ' drills · ~' + w.minutes + ' min</div></div>' + ic('plus', 16) + '</button>'; }).join('') + '</div><p class="tiny muted" style="margin-top:10px">Need a new one? <a href="#writer">Open the Workout Writer</a>.</p>');
};
ACT['pg-pick'] = function (el) { var m = pgMine(el.dataset.p); if (!m) return; m.weeks[+el.dataset.w].push(el.dataset.id); save(); closeModalSafe(); render(); toast('Session added'); };
ACT['pg-rmsess'] = function (el) { var m = pgMine(el.dataset.p); if (!m) return; m.weeks[+el.dataset.w].splice(+el.dataset.s, 1); save(); render(); };
ACT['pg-edit'] = function (el) { var m = pgMine(el.dataset.p); if (!m) return; modal('Edit program', '<form data-form="pg-edit" data-p="' + m.id + '" class="grid" style="gap:12px"><div class="fld"><label class="f" for="pg-en">Name</label><input id="pg-en" name="n" value="' + esc(m.n) + '" maxlength="40" required></div><div class="fld"><label class="f" for="pg-ea">What it’s for</label><input id="pg-ea" name="a" value="' + esc(m.about || '') + '" maxlength="160"></div><div class="btns"><button class="btn p" type="submit">Save</button><button class="btn g" type="button" data-a="pg-del" data-p="' + m.id + '">Delete program</button></div></form>'); };
FORM['pg-edit'] = function (f) { var m = pgMine(f.dataset.p); if (!m) return; m.n = f.n.value.trim() || m.n; m.about = f.a.value.trim(); save(); closeModalSafe(); render(); };
ACT['pg-del'] = function (el) { if (UI.armed !== 'pg-del') { UI.armed = 'pg-del'; toast('Tap Delete again to remove this program. Workouts stay.', 'warn'); return; } UI.armed = null; var st = pgState(); st.mine = st.mine.filter(function (x) { return x.id !== el.dataset.p; }); delete st.active[el.dataset.p]; save(); closeModalSafe(); location.hash = '#programs'; };
/* ---------- My Week + Home integration ---------- */
(function () {
  pgState();
  var _wi = wtInfo;
  wtInfo = function (k) {
    if (k.indexOf('ps:') !== 0) return _wi(k);
    var a = k.slice(3).split(':'), s = +a.pop(), w = +a.pop(), pid = a.join(':'), p = pgById(pid), sess = p && p.weeks[w] && p.weeks[w][s];
    if (!sess) return { n: 'Removed session', g: 'Programs', c: '#666', ic: 'x', m: 0, gone: 1 };
    return { n: sess.n + ' · W' + (w + 1) + 'D' + (s + 1), g: 'Programs', c: p.c, ic: p.ic, m: pgMins(sess), hard: p.id === 'finish' || p.id === 'handle' ? 1 : 0, psess: [pid, w, s], sub: p.n };
  };
  if (WT_GROUPS.indexOf('Programs') < 0) WT_GROUPS.splice(WT_GROUPS.length - 1, 0, 'Programs');
  WT_GC.Programs = '#e07a8c';
  var _wy = wtYours;
  wtYours = function () { var st = pgState(), out = []; pgAll().forEach(function (id) { if (!st.active[id]) return; var p = pgById(id), nx = p && pgNext(p); if (!nx) return; p.weeks[nx.w].forEach(function (_, s) { if (!pgDone(id, nx.w, s)) out.push('ps:' + pgKey(id, nx.w, s)); }); }); return out.concat(_wy()); };
  var _ws = ACT['wk-start'];
  ACT['wk-start'] = function (el) { var f = wkFind(el.dataset.bid); if (f && f.b.k.indexOf('ps:') === 0) { var t = wtInfo(f.b.k); if (t.gone) return; WK.active = { id: f.b.id, date: addDays(f.ws, f.di) }; pgRun(t.psess[0], t.psess[1], t.psess[2]); return; } return _ws(el); };
  var _commit = commitSession;
  commitSession = function (s) { var r = _commit.apply(this, arguments); try { if (PG.active && s) { pgState().done[pgKey(PG.active.p, PG.active.w, PG.active.s)] = s.date || today(); PG.active = null; save(); } } catch (e) { /* keep the save */ } return r; };
  /* a week block marked done also completes the program session, and the other way round */
  var _wd = ACT['wk-done'];
  ACT['wk-done'] = function (el) { _wd(el); var f = wkFind(el.dataset.bid); if (f && f.b.k.indexOf('ps:') === 0) { var t = wtInfo(f.b.k); if (t.psess) { var k = pgKey(t.psess[0], t.psess[1], t.psess[2]); if (f.b.done) pgState().done[k] = today(); else delete pgState().done[k]; save(); render(); } } };
  var _rv = routeView; routeView = function (r) { if (r === 'programs') return viewPrograms(); if (r.indexOf('prog-') === 0) return viewProgramPage(r.slice(5)); if (r.indexOf('psess-') === 0) return viewPSession(r.slice(6)); return _rv(r); };
  Object.assign(TAB_OF, { programs: 'train', prog: 'train', psess: 'train' });
  /* Today list on Home: this week's blocks for today + the next session of each program you're running */
  function todayRows() {
    var t = today(), ws = weekStart(t), d = wkDays(ws, true), di = Math.round((keyDate(t) - keyDate(ws)) / 864e5), rows = [];
    (d[di] || []).forEach(function (b) { var x = wtInfo(b.k); rows.push({ b: b, x: x, sub: x.sub || (x.g === 'Yours' ? 'My workout' : x.g) }); });
    var st = pgState(), inWeek = {}; d.forEach(function (day) { day.forEach(function (b) { inWeek[b.k] = 1; }); });
    pgAll().forEach(function (id) { if (!st.active[id]) return; var p = pgById(id), nx = p && pgNext(p); if (!nx) return; var k = 'ps:' + pgKey(id, nx.w, nx.s); if (inWeek[k]) return; rows.push({ x: wtInfo(k), prog: { p: id, w: nx.w, s: nx.s }, sub: p.n + ' · Week ' + (nx.w + 1) }); });
    return rows;
  }
  function todayHTML() {
    var rows = todayRows(), act = pgAll().filter(function (id) { return pgState().active[id]; }).map(pgById).filter(Boolean);
    var r = '<section class="pg-today"><div class="pg-th"><h2>Today</h2><span>' + rows.length + ' workout' + (rows.length === 1 ? '' : 's') + '</span></div>' +
      (rows.length ? '<div class="pg-tlist">' + rows.map(function (o) { var done = o.b && o.b.done, startable = o.prog || (o.b && !['rest', 'practice', 'game-day'].includes(o.b.k) && !o.x.gone);
        var main = o.prog ? 'data-a="pg-start" data-p="' + o.prog.p + '" data-w="' + o.prog.w + '" data-s="' + o.prog.s + '"' : startable && !done ? 'data-a="wk-start" data-bid="' + o.b.id + '"' : '';
        return '<div class="pg-trow' + (done ? ' done' : '') + '"><button class="pg-tmain" ' + main + (main ? '' : ' disabled') + '><span class="pg-tile" style="--c:' + o.x.c + ';--s:52px">' + ic(o.x.ic, 22) + '</span><span class="grow"><b>' + esc(o.x.n.replace(/ · W\d+D\d+$/, '')) + '</b><small>' + esc(o.sub || '') + (o.b && o.b.mins ? ' · ' + o.b.mins + ' min' : '') + '</small></span></button>' +
          (o.b ? '<button class="pg-check' + (done ? ' on' : '') + '" data-a="wk-done" data-bid="' + o.b.id + '" aria-label="' + (done ? 'Mark not done' : 'Mark done') + '">' + (done ? ic('check', 18) : '') + '</button>' : '<button class="pg-check" data-a="pg-done" data-p="' + o.prog.p + '" data-w="' + o.prog.w + '" data-s="' + o.prog.s + '" aria-label="Mark done"></button>') + '</div>'; }).join('') + '</div>'
        : '<div class="pg-tempty">Nothing planned. <a href="#week">Plan your week</a> or <a href="#programs">start a program</a>.</div>') + '</section>';
    r += '<section class="pg-today"><div class="pg-th"><h2>My programs</h2><a href="#programs">All programs</a></div>' + (act.length ? '<div class="pg-tlist">' + act.map(function (p) { var pr = pgProgress(p), nx = pgNext(p); return '<div class="pg-trow"><a class="pg-tmain" href="#prog-' + p.id + '"><span class="grow"><b>' + esc(p.n) + '</b><small>' + (nx ? 'Week ' + (nx.w + 1) + ' · Day ' + (nx.s + 1) + ' · ' + esc(nx.sess.n) : 'Complete') + '</small><span class="pg-bar"><i style="width:' + pr.pct + '%;background:' + p.c + '"></i></span></span></a>' + (nx ? '<button class="btn sm" data-a="pg-start" data-p="' + p.id + '" data-w="' + nx.w + '" data-s="' + nx.s + '">Start</button>' : '') + '</div>'; }).join('') + '</div>' : '<div class="pg-tempty"><a href="#programs">Pick a program</a>: CLA finishing, shooting, handles or an in-season tune-up.</div>') + '</section>';
    return r;
  }
  var _home = viewHomePro;
  viewHomePro = function () { return wkDom(_home(), function (root) {
    var tc = root.querySelector('.today-card'); if (tc) tc.remove();
    var hero = root.querySelector('.home-hero2'), x = document.createElement('div'); x.innerHTML = pgSeasonRow() + todayHTML();
    var mini = root.querySelector('.wk-mini'), nodes = Array.prototype.slice.call(x.children);
    /* order like a training app: greeting → in-season → this week → today → my programs → everything else */
    if (mini) nodes.splice(1, 0, mini);
    if (hero) { var ref = hero.nextSibling; nodes.forEach(function (n) { hero.parentNode.insertBefore(n, ref); }); } else nodes.reverse().forEach(function (n) { root.insertBefore(n, root.firstChild); });
  }); };
  var _train = viewTrain; viewTrain = function () { var h = _train(); return h.replace('<div class="sp-tgrid">', '<div class="sp-tgrid"><a class="sp-tc" href="#programs"><span class="sp-ti" style="--mc:#e07a8c;background:#e07a8c">' + ic('layout-grid', 20) + '</span><b>Programs</b><small>Multi-week CLA programs, or build your own</small></a>'); };
  var tr = $('.side a[data-r="train"]'); if (tr && !$('.side a[data-r="programs"]')) tr.insertAdjacentHTML('afterend', '<a href="#programs" data-r="programs"><i>' + ic('layout-grid', 20) + '</i>Programs</a>');
  render();
})();
