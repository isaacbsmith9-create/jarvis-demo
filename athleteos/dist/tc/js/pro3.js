/* ==================== Time and place: training modes, weekly blend, outside programs ====================
   Your philosophy: everything has its place. Rhythm before practice, skill work on purpose, game-like when you can go hard,
   creative work to expand your range, and strength with the ball. The week decides which one each day gets. */
var MODES = {
  rhythm: { n: 'Rhythm', c: '#55c98b', ic: 'repeat', d: 'Basics and volume. Get up shots and feel the ball go in.', when: 'Before practice, game days, the day before a game.', ex: '200 makes: mid pull-ups off the dribble, mid catch-and-shoot, floaters, catch-and-shoot threes.' },
  skill: { n: 'Skill', c: '#8db8de', ic: 'target', d: 'Specific moves on purpose. Blocked reps until they are clean.', when: 'The day after a game, light days, learning a new move.', ex: 'Pickups, cross-jab sweep, your exact mid-range moves, specific finishes, the cuff.' },
  game: { n: 'Game-like', c: '#ff913d', ic: 'flame', d: 'As hard as possible. Reads, time, contact, fatigue and consequences.', when: 'Off days and days with no game for 2+ days.', ex: 'Shot clock, one dribble max, catch on the move, miss = sprint.' },
  creative: { n: 'Creative', c: '#e9d98d', ic: 'sparkles', d: 'Expand what your body can do. Wild reps you would never script.', when: 'End of a hard session or a fun day.', ex: 'Self-lobs, catch at the highest point and score, freestyle handle combos.' },
  strength: { n: 'Strength', c: '#f5c154', ic: 'shield', d: 'Strong with the ball: absorb contact and keep control.', when: 'Off days, paired with game-like work.', ex: 'Cuff and power dribbles, finishing through a pad, holding your line.' },
};
var MODE_ORDER = ['rhythm', 'skill', 'game', 'creative', 'strength'];
/* New drills from how you actually train (your descriptions, our wording). */
(function () {
  var add = [
    DR({ slug: 'mid-catch', name: 'Midrange Catch-and-Shoot', cat: 'Shooting', diff: 2, obj: 'Rhythm jumpers from 15–17 feet off the catch.', ins: 'Self-toss or rebounder. Elbows, short corners and the top of the key. Feet set before the catch, same rhythm every shot.', coach: ['Same rhythm every rep', 'Hold the follow-through'], min: 8, sets: 5, att: 10, metric: 'makes' }),
    DR({ slug: 'cross-jab-sweep', name: 'Cross-Jab Sweep Pickup', cat: 'Finishing', diff: 3, sec: ['Footwork'], obj: 'A pickup that turns a jab into a downhill finish or pull-up.', ins: 'From the wing: jab, cross the ball low across your body, sweep through and explode to the rim on the long step. Alternate the finish and a mid-range pull-up. Both sides.', coach: ['Sweep the ball low, below the knees', 'Long first step past the defender’s hip', 'Same look whether you finish or pull up'], min: 8, sets: 4, att: 8, metric: 'makes' }),
    DR({ slug: 'pickup-series', name: 'Pickup Series', cat: 'Finishing', diff: 2, sec: ['Footwork'], obj: 'Own every gather so you can finish off any foot.', ins: 'Drive and gather 5 ways: inside foot, outside foot, jump stop, hop, and a one-two from the weak side. Finish each with the best hand.', coach: ['Ball meets the gather foot', 'Eyes on the rim through the pickup'], min: 8, sets: 5, att: 6, metric: 'makes' }),
    DR({ slug: 'transition-finishes', name: 'Transition Finishing Reads', cat: 'Finishing', diff: 3, sec: ['Conditioning'], obj: 'Finish at full speed in the open floor.', ins: 'Start at half court at full speed. Pick a finish as you cross the three-point line: euro, two-foot power, reverse, floater. Jog back and go again.', coach: ['Decide before the paint', 'Stay balanced at speed'], min: 8, sets: 4, att: 6, metric: 'makes' }),
    DR({ slug: 'self-lob', name: 'Self-Lob Finishes', cat: 'Finishing', diff: 3, obj: 'Catch above the rim line and finish.', ins: 'Toss the ball off the backboard or into the air, attack it, catch it high and finish with a layup, reverse or dunk.', coach: ['Catch at the top of your jump', 'Two hands on the catch, then finish'], min: 6, sets: 4, att: 6, metric: 'makes' }),
    DR({ slug: 'highest-point', name: 'Highest-Point Catch and Score', cat: 'Finishing', diff: 4, sec: ['Footwork'], obj: 'Body control: catch at the peak, land balanced, score.', ins: 'Throw the ball high in the air, jump to catch it at the highest point, land balanced and score right away: finish, floater or pull-up.', coach: ['Land on two feet, ready to go up', 'No extra dribble after the catch'], min: 6, sets: 4, att: 6, metric: 'makes' }),
    DR({ slug: 'cuff-handle', name: 'Strong-Ball Handling (Cuff and Power)', cat: 'Ball Handling', diff: 3, obj: 'Keep the ball when bodies hit you.', ins: 'Power dribble and cuff the ball (wrist wrapped over the top) while bumping into a pad, wall or partner with your shoulder. 30 seconds each hand, then attack and finish.', coach: ['Shoulder lower than the defender', 'Ball on the far hip from contact'], min: 6, sets: 4, att: 30, metric: 'reps' }),
    DR({ slug: 'freestyle-combos', name: 'Freestyle Combo Flow', cat: 'Ball Handling', diff: 3, obj: 'Link moves without a script.', ins: '30 seconds of nonstop moves: link 3–5 moves in a row, change speed and height, never repeat a combo. Finish the set with an attack and a shot.', coach: ['Change speed inside the combo', 'Stay low through every move'], min: 6, sets: 4, att: 30, metric: 'reps' }),
  ];
  add.forEach(function (d) { if (!DRILLS.some(function (x) { return x.id === d.id; })) DRILLS.push(d); });
  SHOT_PRESETS.unshift({ id: 'rhythm200', name: 'Rhythm 200', desc: 'Pre-practice: mid pull-ups, mid catch, floaters, threes', steps: [['Midrange', 'move', 50], ['Midrange', 'catch', 50], ['Floater', 'float', 40], ['Corner 3', 'catch', 20], ['Wing 3', 'catch', 20], ['Top 3', 'catch', 20]] });
})();
var MODE_MAP = { 'd-ft-timed': ['rhythm'], 'd-form-close': ['rhythm'], 'd-pound-series': ['rhythm', 'strength'], 'd-spider': ['rhythm'], 'd-mid-catch': ['rhythm'], 'd-two-ball': ['skill', 'creative'], 'd-cone-weave': ['skill'], 'd-full-court-cod': ['game'], 'd-movement-3s': ['game'], 'd-late-clock': ['game'], 'd-pressure-fts': ['game'], 'd-read-cards': ['game'], 'd-chair-pnr': ['skill', 'game'], 'd-cross-jab-sweep': ['skill'], 'd-pickup-series': ['skill'], 'd-transition-finishes': ['skill', 'game'], 'd-self-lob': ['creative'], 'd-highest-point': ['creative'], 'd-cuff-handle': ['strength', 'skill'], 'd-freestyle-combos': ['creative'], 'd-tired-fts': ['game'], 'd-retreat-attack': ['skill', 'strength'], 'd-hesi-drive': ['skill'], 'd-two-foot-power': ['strength', 'skill'], 'd-up-and-under': ['skill', 'strength'], 'd-euro-footwork': ['skill'], 'd-gather-types': ['rhythm', 'skill'], 'd-closeout-footwork': ['rhythm'] };
function drillModes(d) {
  if (!d) return ['skill']; if (d.modes && d.modes.length) return d.modes; if (MODE_MAP[d.id]) return MODE_MAP[d.id];
  var m = [], c = d.category, txt = (d.name + ' ' + (d.secondary || []).join(' ')).toLowerCase();
  if (c === 'Game Situations' || d.partner || c === 'Conditioning' || d.difficulty >= 4) m.push('game');
  if (d.difficulty <= 2 && (c === 'Shooting' || c === 'Ball Handling')) m.push('rhythm');
  if (/contact|power|strong/.test(txt)) m.push('strength');
  if (c === 'Footwork' || c === 'Finishing' || c === 'Pick-and-Roll' || (c === 'Ball Handling' && d.difficulty === 3) || (c === 'Shooting' && d.difficulty === 3) || c === 'Movement') m.push('skill');
  return m.length ? m : ['skill'];
}
var GAME_LAYERS = {
  Shooting: ['Shot clock: 4 seconds from the catch', 'Catch on the move off a self-pass, never standing still', 'One dribble max, then shoot', 'Miss your goal: sprint baseline and back'],
  Finishing: ['Chair or pad contest on every rep', 'Finish within 2 seconds of the gather', 'Start every rep from a sprint', 'Weak hand on every other rep'],
  'Ball Handling': ['Toss a tennis ball between moves', 'Partner pokes at the ball or swipes with a pad', 'Eyes up: call out fingers someone holds up', 'Finish every rep with a shot at game speed'],
  Footwork: ['React to a random call instead of a set side', 'Tired legs: do it right after a sprint'],
  'Pick-and-Roll': ['Read a random cue each rep (card or partner)', 'Score within 2 dribbles off the screen'],
  Movement: ['Catch on the move and score in 1 dribble', 'Sprint to every spot'],
  'Game Situations': ['Play to a score with a consequence for losing'],
  Conditioning: ['Beat your last time or add a set'],
};
function weekState() { if (!S.week || typeof S.week !== 'object') S.week = { practice: [2, 3, 4], games: [5], target: { rhythm: 30, skill: 25, game: 30, creative: 10, strength: 5 }, programs: [] }; if (!Array.isArray(S.week.programs)) S.week.programs = []; return S.week; }
/* Rules that pick a mode for a day. */
function dayModesForWeek(ws) {
  var w = weekState(), tg = w.target, out = [], cnt = {}, tot = sum(MODE_ORDER, function (m) { return +tg[m] || 0; }) || 1;
  var pick = function (opts) { return opts.slice().sort(function (a, b) { var da = (+tg[a] || 0) / tot - (cnt[a] || 0) / (out.length + 1), db = (+tg[b] || 0) / tot - (cnt[b] || 0) / (out.length + 1); return db - da || opts.indexOf(a) - opts.indexOf(b); })[0]; };
  for (var i = 0; i < 7; i++) {
    var d = addDays(ws, i), dw = keyDate(d).getDay(), prev = (dw + 6) % 7, next = (dw + 1) % 7, r;
    if (w.games.indexOf(dw) >= 0) r = { m: 'rhythm', why: 'Game day: stay loose, get your rhythm', cap: 25 };
    else if (w.games.indexOf(next) >= 0) r = { m: 'rhythm', why: 'Day before a game: rhythm and confidence', cap: 35 };
    else if (w.games.indexOf(prev) >= 0) r = { m: 'skill', why: 'Day after a game: lighter, technique-focused', cap: 40 };
    else if (w.practice.indexOf(dw) >= 0) { var pm = pick(['rhythm', 'skill']); r = { m: pm, why: pm === 'rhythm' ? 'Team practice day: pre-practice rhythm, save your legs' : 'Team practice day: short skill work on your moves', cap: 30 }; }
    else { var om = pick(['game', 'creative', 'strength']); r = { m: om, why: om === 'game' ? 'Open day: go as hard as possible' : om === 'creative' ? 'Open day: creative work to expand your range' : 'Open day: get strong with the ball', cap: null }; }
    cnt[r.m] = (cnt[r.m] || 0) + 1; out.push(r);
  }
  return out;
}
function dayMode(date) { var ws = weekStart(date); return dayModesForWeek(ws)[daysBetween(ws, date)]; }
function sessionMode(s) { if (s.mode) return s.mode; var c = {}; s.items.forEach(function (i) { var d = drillById(i.drillId); drillModes(d).forEach(function (m) { c[m] = (c[m] || 0) + 1; }); }); var best = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0]; return best || 'skill'; }
function modeMinutes(from, to) { var o = {}; MODE_ORDER.forEach(function (m) { o[m] = 0; }); rangeSessions(from, to).forEach(function (s) { o[sessionMode(s)] += s.minutes || 0; }); return o; }
function blendBar(mins, label) { var tot = sum(MODE_ORDER, function (m) { return mins[m]; }); return '<div class="blend"><div class="tiny" style="margin-bottom:4px">' + label + (tot && label !== 'Target' ? ' · ' + fmtMin(tot) : '') + '</div><div class="stackbar big">' + (tot ? MODE_ORDER.map(function (m) { return mins[m] ? '<i style="flex:' + mins[m] + ';background:' + MODES[m].c + '" title="' + MODES[m].n + ': ' + Math.round((mins[m] / tot) * 100) + '%"></i>' : ''; }).join('') : '<i style="flex:1;background:var(--raised)"></i>') + '</div></div>'; }
function modeChip(m) { return '<span class="mchip" style="--mc:' + MODES[m].c + '">' + ic(MODES[m].ic, 12) + ' ' + MODES[m].n + '</span>'; }

/* ---------- Builder: session type step, mode-aware drill pool, game-like layers ---------- */
var BMODE = null;
(function () {
  var _all = allDrills;
  allDrills = function () { var a = _all(); if (!BMODE || BMODE === 'mix') return a; return a.filter(function (d) { if (drillModes(d).indexOf(BMODE) >= 0) return true; return a.filter(function (x) { return x.category === d.category && drillModes(x).indexOf(BMODE) >= 0; }).length < 2; }); };
  var _gen = genWorkout;
  genWorkout = function (o, seed) {
    BMODE = o.mode || null; var w; try { w = _gen(o, seed); } finally { BMODE = null; }
    if (o.mode && o.mode !== 'mix') { var have = w.blocks.map(function (bl) { return bl.name; }), miss = bFocus(o).filter(function (a) { return have.indexOf(a) < 0; }); if (miss.length || Math.abs(bTotal(w) - o.mins) > 5) { var w2 = _gen(o, seed + 'f'); w2.blocks.forEach(function (bl) { if (have.indexOf(bl.name) < 0 && miss.indexOf(bl.name) >= 0) { var at = w.blocks.length - (w.blocks.length > 1 && /finisher/.test(w.blocks[w.blocks.length - 1].name) ? 1 : 0); w.blocks.splice(at, 0, bl); } }); } }
    var g3 = 0; while (bTotal(w) > o.mins + 2 && g3 < 80) { g3++; var all = w.blocks.reduce(function (acc, bl) { return acc.concat(bl.items); }, []).filter(function (it) { return it.targetSets > 1 && bMins(it) > 3; }).sort(function (x, y) { return bMins(y) - bMins(x); }); if (all.length) all[0].targetSets--; else { var lb = w.blocks[w.blocks.length - 1]; if (!lb || w.blocks.length <= 1) break; lb.items.pop(); w.blocks = w.blocks.filter(function (bl) { return bl.items.length; }); } }
    var main4 = w.blocks.filter(function (bl) { return bl.name !== 'Warm-up' && !/finisher/.test(bl.name); }).reduce(function (acc, bl) { return acc.concat(bl.items); }, []), g4 = 0;
    while (main4.length && bTotal(w) < o.mins - 4 && g4 < 120) { var it4 = main4[g4 % main4.length]; if (it4.targetSets < (it4.baseSets || 3) + 6) it4.targetSets++; g4++; }
    if (o.mode && o.mode !== 'mix') {
      var k = 0;
      w.blocks.forEach(function (bl) { bl.items.forEach(function (it) {
        if (o.mode === 'game') { var L = GAME_LAYERS[it.category] || GAME_LAYERS.Shooting; it.layer = L[(hashStr(it.drillId + seed) + k++) % L.length]; }
        if (o.mode === 'rhythm' && it.goal) it.goal = Math.min(it.targetAttempts, Math.round(it.goal * 1.12));
        if (o.mode === 'creative' && it.goal) it.goal = Math.max(1, Math.round(it.goal * 0.8));
      }); });
      w.mode = o.mode; w.name = o.mins + '-Min ' + MODES[o.mode].n + ' · ' + bFocus(o).slice(0, 2).join(' + ');
    }
    return w;
  };
  var _flat = bFlat;
  bFlat = function () { var dr = bDraft(), out = _flat(), k = 0; dr.blocks.forEach(function (bl) { bl.items.forEach(function (it) { if (out[k]) { out[k].goal = it.goal || null; out[k].layer = it.layer || null; } k++; }); }); return out; };
  var _vb = viewBuilder;
  viewBuilder = function () {
    var o = bState().opts, h = _vb();
    if (bState().draft) { var dr = bState().draft; if (dr.mode) h = h.replace('<div class="kick">', '<div class="kick">' + MODES[dr.mode].n.toUpperCase() + ' · '); return h.replace(/<span class="goal">/g, function (m) { return m; }).replace(/(<div class="bdrill">[\s\S]*?<div class="bdm">)/g, function (m) { return m; }) + ''; }
    for (var n = 5; n >= 1; n--) h = h.split('<span class="bn">' + n + '</span>').join('<span class="bn">' + (n + 1) + '</span>');
    var step = '<div class="bstep"><span class="bn">1</span><div class="grow"><h3>What kind of session?</h3><div class="bopts modes">' + MODE_ORDER.map(function (m) { return '<button type="button" class="bopt mopt' + ((o.mode || 'mix') === m ? ' on' : '') + '" style="--mc:' + MODES[m].c + '" data-a="b-mode" data-v="' + m + '"><b>' + ic(MODES[m].ic, 16) + ' ' + MODES[m].n + '</b><small>' + esc(MODES[m].d) + '</small></button>'; }).join('') + '<button type="button" class="bopt' + ((o.mode || 'mix') === 'mix' ? ' on' : '') + '" data-a="b-mode" data-v="mix"><b>' + ic('layout-grid', 16) + ' Mix</b><small>Any drill that fits</small></button></div>' + (o.mode && o.mode !== 'mix' ? '<p class="tiny" style="margin:8px 0 0"><b>When:</b> ' + esc(MODES[o.mode].when) + ' <b>Example:</b> ' + esc(MODES[o.mode].ex) + '</p>' : '') + '</div></div>';
    return h.replace('<section class="panel bwiz">', '<section class="panel bwiz">' + step);
  };
  /* show goal + game-like layer in the preview rows */
  var _bp = bPreview;
  bPreview = function (dr, o) { var h = _bp(dr, o), its = dr.blocks.reduce(function (a, bl) { return a.concat(bl.items); }, []), i = 0; return h.replace(/<\/div><\/div><div class="bctl">/g, function (m) { var it = its[i++]; return (it && it.layer ? '<div class="layer">' + ic('flame', 12) + ' Game-like layer: ' + esc(it.layer) + '</div>' : '') + m; }); };
  ACT['b-mode'] = function (el) { var o = bState().opts; o.mode = el.dataset.v; if (o.mode === 'rhythm') o.intensity = 'skill'; if (o.mode === 'game') o.intensity = 'game'; save(); render(); };
  /* runner: show the goal and the game-like layer for the current drill */
  var _rh = runnerHtml;
  runnerHtml = function () { var h = _rh(), r = S.run, it = r && r.items[r.idx]; if (!it || (!it.layer && !it.goal)) return h; var add = '<div class="runlayer">' + (it.goal ? '<span>' + ic('target', 14) + ' Goal: ' + it.goal + '/' + it.targetAttempts + ' per set</span>' : '') + (it.layer ? '<span class="gl">' + ic('flame', 14) + ' ' + esc(it.layer) + '</span>' : '') + '</div>'; var key = '<div style="margin:12px 0"><div class="tiny" style="margin-bottom:6px">Sets</div>'; return h.indexOf(key) >= 0 ? h.replace(key, function () { return add + key; }) : h; };
})();

/* ---------- Coach: each day gets a mode from your week ---------- */
(function () {
  var _build = buildCoachWeek;
  buildCoachWeek = function (ws) {
    var n = _build(ws), c = coachState(), lvl = { 'Freshman / JV': 2, JV: 2, Varsity: 3, 'Varsity starter': 3, 'Club / AAU': 3, Other: 3 }[S.profile.level] || 3, gear = (bState().opts || {}).gear || [];
    S.plan.filter(function (p) { return p.coach && p.date >= ws && p.date <= addDays(ws, 6) && p.status !== 'done' && p.date >= today(); }).forEach(function (p) {
      var w = S.workouts.find(function (x) { return x.id === p.workoutId; }); if (!w || !w.coach) return;
      var dm = dayMode(p.date), mins = dm.cap ? Math.min(c.mins, dm.cap) : c.mins, f = focusAreas().map(function (x) { return x.area; });
      var focus = dm.m === 'rhythm' ? ['Shooting'] : dm.m === 'creative' ? ['Finishing', 'Ball Handling'] : dm.m === 'strength' ? ['Finishing', 'Ball Handling'] : [w.category].concat(f.filter(function (a) { return a !== w.category; }).slice(0, 1));
      var g = genWorkout({ mins: mins, level: lvl, focus: focus, partner: false, gear: gear, court: 'half', intensity: dm.m === 'rhythm' ? 'skill' : 'game', mode: dm.m }, p.date + w.id);
      w.items = g.blocks.reduce(function (a, bl) { return a.concat(bl.items.map(function (it) { return { drillId: it.drillId, name: it.name, category: it.category, metric: it.metric, targetSets: it.targetSets, targetAttempts: it.targetAttempts, restSec: it.restSec, timeLimitSec: 0, goal: it.goal || null, layer: it.layer || null }; })); }, []);
      w.mode = dm.m; w.minutes = bTotal(g); w.name = MODES[dm.m].n + ' · ' + focus.slice(0, 2).join(' + '); p.title = 'Coach: ' + w.name; p.minutes = w.minutes; p.mode = dm.m; p.reason = dm.why + '. ' + (p.reason || '');
    });
    save(); return n;
  };
  /* sessions remember their mode */
  var _commit = commitSession;
  commitSession = function (s) { if (!s.mode) { var w = s.workoutId && S.workouts.find(function (x) { return x.id === s.workoutId; }); if (w && w.mode) s.mode = w.mode; else if (/^Shot Lab: Rhythm/.test(s.workoutName || '')) s.mode = 'rhythm'; } return _commit(s); };
})();

/* ---------- My Program: time and place, my week, programs I follow ---------- */
function timePlaceHTML() {
  var w = weekState(), t = today(), ws = weekStart(t), days = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
  var plan = []; for (var i = 0; i < 7; i++) { var d = addDays(ws, i); plan.push({ d: d, dm: dayMode(d) }); }
  var tg = w.target, ttot = sum(MODE_ORDER, function (m) { return +tg[m] || 0; });
  var tgMins = {}; MODE_ORDER.forEach(function (m) { tgMins[m] = +tg[m] || 0; });
  return '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Time and place</h3><div class="sub">Five ways to train. Each has its moment.</div></div></div><div class="modes-grid">' + MODE_ORDER.map(function (m) { var x = MODES[m]; return '<div class="modecard" style="--mc:' + x.c + '"><div class="row s" style="gap:8px">' + ic(x.ic, 18) + '<b>' + x.n + '</b></div><p class="small">' + esc(x.d) + '</p><p class="tiny"><b>When:</b> ' + esc(x.when) + '</p><p class="tiny"><b>Looks like:</b> ' + esc(x.ex) + '</p><button class="btn xs" data-a="mode-build" data-v="' + m + '">Build a ' + x.n.toLowerCase() + ' session</button></div>'; }).join('') + '</div></section>' +
    '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>My week</h3><div class="sub">Your coach picks each day’s mode from your team schedule</div></div></div>' +
    '<div class="grid g2"><div><div class="tiny" style="margin-bottom:6px">Team practice days</div><div class="chips">' + days.map(function (x) { return '<button class="chip' + (w.practice.indexOf(x[0]) >= 0 ? ' on' : '') + '" data-a="wk-day" data-k="practice" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div class="tiny" style="margin:12px 0 6px">Game days</div><div class="chips">' + days.map(function (x) { return '<button class="chip' + (w.games.indexOf(x[0]) >= 0 ? ' on' : '') + '" data-a="wk-day" data-k="games" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
    '<div><div class="tiny" style="margin-bottom:6px">This week, day by day</div><div class="daymodes">' + plan.map(function (p) { return '<div class="dmode' + (p.d === t ? ' now' : '') + '" style="--mc:' + MODES[p.dm.m].c + '" title="' + esc(p.dm.why) + '"><span>' + esc(keyDate(p.d).toLocaleDateString(undefined, { weekday: 'short' })) + '</span><b>' + MODES[p.dm.m].n + '</b></div>'; }).join('') + '</div><p class="tiny" style="margin:8px 0 0">Rules: game day and the day before = Rhythm, the day after = Skill, team practice days alternate Rhythm and Skill, open days rotate Game-like, Creative and Strength toward your blend (Game-like first). Hover a day for the reason. Coach sessions follow this when you rebuild your week.</p></div></div>' +
    '<div class="hr"></div><div class="row"><h4>Blend</h4><span class="tiny">Target vs what you actually did in the last 14 days</span></div><div class="grid g2" style="margin-top:8px">' + blendBar(tgMins, 'Target') + blendBar(modeMinutes(addDays(t, -13), t), 'Actual') + '</div><div class="legend">' + MODE_ORDER.map(function (m) { return '<span><i style="background:' + MODES[m].c + '"></i>' + MODES[m].n + ' <input type="number" min="0" max="100" data-c="blend" data-m="' + m + '" value="' + (+tg[m] || 0) + '" style="width:58px;min-height:30px;padding:2px 6px;display:inline-block">%</span>'; }).join('') + (ttot !== 100 ? '<span class="warn">Targets add to ' + ttot + '%</span>' : '') + '</div>' +
    '<div class="btns" style="margin-top:12px"><button class="btn sm b" data-a="coach-build">' + ic('repeat', 14) + ' Rebuild this week with these rules</button></div></section>' +
    '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Programs I follow</h3><div class="sub">Outside programs (like BAM) count toward your week when you log them</div></div></div>' +
    (w.programs.length ? '<div class="list">' + w.programs.map(function (p) { var n = S.sessions.filter(function (s) { return s.programId === p.id; }); return '<div class="li"><div class="main"><b>' + esc(p.name) + '</b><div class="tiny">' + n.length + ' session' + (n.length === 1 ? '' : 's') + ' logged · ' + fmtMin(sum(n, function (s) { return s.minutes; })) + (p.url ? ' · <a href="' + esc(p.url) + '" target="_blank" rel="noopener">Open</a>' : '') + '</div></div><button class="btn sm p" data-a="ext-log" data-id="' + p.id + '">' + ic('plus', 14) + ' Log session</button><button class="btn xs g" data-a="ext-del" data-id="' + p.id + '" aria-label="Remove">' + ic('x', 12) + '</button></div>'; }).join('') + '</div>' : '<div class="empty">Add a program you train with. Log each session you do from it (workout name, minutes, mode, notes) so it counts in your minutes, blend and challenges.</div>') +
    '<form data-form="ext-add" class="row" style="margin-top:10px;flex-wrap:nowrap"><input name="name" placeholder="Program name (e.g. BAM Virtual Academy)" required><input name="url" placeholder="Link (optional)"><button class="btn sm" type="submit">' + ic('plus', 14) + '</button></form></section>';
}
ACT['mode-build'] = function (el) { var o = bState().opts; o.mode = el.dataset.v; if (o.mode === 'rhythm') { o.intensity = 'skill'; o.focus = ['Shooting']; o.mins = 30; } if (o.mode === 'game') o.intensity = 'game'; if (o.mode === 'creative' || o.mode === 'strength') o.focus = ['Finishing', 'Ball Handling']; bState().draft = genWorkout(o, uid()); save(); location.hash = '#builder'; };
ACT['wk-day'] = function (el) { var w = weekState(), k = el.dataset.k, v = +el.dataset.v, i = w[k].indexOf(v); if (i >= 0) w[k].splice(i, 1); else w[k].push(v); save(); render(); };
CHG['blend'] = function (el) { var v = clamp(+el.value || 0, 0, 100); weekState().target[el.dataset.m] = v; save(); render(); };
FORM['ext-add'] = function (f) { var n = f.name.value.trim(), u = f.url.value.trim(); if (!n) return; if (u && !/^https?:\/\//i.test(u)) { toast('Links start with https://', 'warn'); return; } weekState().programs.push({ id: 'x' + uid(), name: n.slice(0, 80), url: u }); save(); render(); };
ACT['ext-del'] = function (el) { var w = weekState(); w.programs = w.programs.filter(function (p) { return p.id !== el.dataset.id; }); save(); render(); };
ACT['ext-log'] = function (el) {
  var p = weekState().programs.find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
  modal('Log a session: ' + p.name, '<form data-form="ext-log" data-id="' + p.id + '" class="stack"><div class="grid g2"><div class="fld"><label class="f" for="xl-w">Workout</label><input id="xl-w" name="w" placeholder="e.g. Week 3, Day 2" required></div><div class="fld"><label class="f" for="xl-m">Minutes</label><input id="xl-m" name="m" type="number" min="5" max="240" value="45" required></div><div class="fld"><label class="f" for="xl-d">Date</label><input id="xl-d" name="d" type="date" value="' + today() + '"></div><div class="fld"><label class="f" for="xl-a">Main area</label><select id="xl-a" name="a">' + AREAS.map(function (a) { return '<option>' + esc(a) + '</option>'; }).join('') + '</select></div></div><div class="fld"><label class="f">Mode</label><div class="chips">' + MODE_ORDER.map(function (m, i) { return '<label class="chip' + (m === 'game' ? ' on' : '') + '"><input type="radio" name="mode" value="' + m + '"' + (m === 'game' ? ' checked' : '') + ' hidden>' + MODES[m].n + '</label>'; }).join('') + '</div></div><div class="grid g2"><div class="fld"><label class="f" for="xl-ma">Shots made (optional)</label><input id="xl-ma" name="made" type="number" min="0"></div><div class="fld"><label class="f" for="xl-at">Shots attempted (optional)</label><input id="xl-at" name="att" type="number" min="0"></div></div><div class="fld"><label class="f" for="xl-n">Your notes</label><textarea id="xl-n" name="n" placeholder="What you worked on, what clicked, what to fix"></textarea></div><button class="btn p" type="submit">Save session</button></form>');
};
document.addEventListener('change', function (e) { var r = e.target; if (r && r.type === 'radio' && r.name === 'mode' && r.closest('.chips')) $$('label.chip', r.closest('.chips')).forEach(function (l) { l.classList.toggle('on', l.contains(r)); }); });
FORM['ext-log'] = function (f) {
  var p = weekState().programs.find(function (x) { return x.id === f.dataset.id; }), mins = +f.m.value, made = f.made.value === '' ? null : +f.made.value, att = f.att.value === '' ? null : +f.att.value, mode = (f.querySelector('input[name=mode]:checked') || {}).value || 'game';
  if (!(mins > 0)) { toast('Enter minutes', 'warn'); return; } if (made != null && (att == null || made > att)) { toast('Shots made needs attempts, and can’t be more', 'warn'); return; }
  var date = f.d.value || today(), end = keyDate(date).getTime() + 18 * 3600000, area = f.a.value;
  var s = { id: 's-' + uid(), date: date, endedAt: end, startedAt: end - mins * 60000, minutes: mins, workoutId: null, workoutName: p.name + ': ' + f.w.value.trim(), programId: p.id, mode: mode, external: true,
    items: [{ drillId: 'ext-' + p.id, name: f.w.value.trim(), category: area, metric: att ? 'makes' : 'reps', sets: att ? [{ att: att, made: made || 0, zone: null }] : [], status: 'done', reps: 0, goodReps: 0, seconds: mins * 60 }], completionPct: 100, rpe: null, planId: null, notes: f.n.value.trim(), location: '' };
  commitSession(s); save(); closeModal(); toast('Logged ' + fmtMin(mins) + ' of ' + MODES[mode].n + ' from ' + p.name); render();
};

(function () {
  var _prog = viewProgram;
  viewProgram = function () { var h = _prog(), k = '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Your workouts</h3>'; return h.indexOf(k) >= 0 ? h.replace(k, timePlaceHTML() + k) : h + timePlaceHTML(); };
  var _home = viewHomePro;
  viewHomePro = function () { var dm = dayMode(today()); return _home().replace('<div class="today-card"><div class="kick">', '<div class="today-card"><div class="todaymode" style="--mc:' + MODES[dm.m].c + '">' + ic(MODES[dm.m].ic, 14) + ' ' + MODES[dm.m].n + ' day · ' + esc(dm.why) + '</div><div class="kick">'); };
  render();
})();
