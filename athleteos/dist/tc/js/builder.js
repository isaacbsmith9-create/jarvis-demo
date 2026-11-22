/* ==================== Workout Builder: pick time, level, focus, gear, intensity → editable block workout ==================== */
var B_LEVELS = [[1, 'Middle school', 'Learning the basics'], [2, 'JV', 'Solid fundamentals'], [3, 'Varsity', 'Game-speed reps'], [4, 'College-ready', 'Hardest variations']];
var B_INT = { skill: ['Skill', 'Slower, cleaner reps. More rest.', 45], game: ['Game speed', 'Full speed with game rest.', 30], grind: ['Grind', 'Short rest and a conditioning finisher.', 20] };
var B_GEAR = ['Cones', 'Chair', 'Two balls', 'Jump rope'];
var B_TIMES = [10, 15, 20, 30, 45, 60, 75, 90];
var B_QUICK = [{ n: '15-min shooting', o: { mins: 15, focus: ['Shooting'], intensity: 'game' } }, { n: '30-min guard skills', o: { mins: 30, focus: ['Ball Handling', 'Finishing'], intensity: 'game' } }, { n: '45-min my weak spots', o: { mins: 45, focus: ['coach'], intensity: 'game' } }, { n: '60-min grind', o: { mins: 60, focus: ['Shooting', 'Ball Handling', 'Conditioning'], intensity: 'grind' } }];
function bState() {
  if (!S.builder || typeof S.builder !== 'object') S.builder = {};
  var b = S.builder; if (!b.opts) b.opts = { mins: 30, level: 3, focus: ['Shooting'], partner: false, gear: [], court: 'half', intensity: 'game' };
  return b;
}
function bAllowed(d, o) {
  if (d.partner && !o.partner) return false;
  if (o.court !== 'full' && /full[- ]court|baseline to baseline|suicide/i.test(d.name + ' ' + d.instructions)) return false;
  return (d.equipment || ['Ball', 'Hoop']).every(function (e) { return ['Ball', 'Hoop', 'Free-throw line', 'Index cards'].indexOf(e) >= 0 || o.gear.indexOf(e) >= 0 || (e === 'Partner' && o.partner) || e === 'Court'; });
}
function bFocus(o) { var f = o.focus.indexOf('coach') >= 0 ? focusAreas().map(function (x) { return x.area; }) : o.focus.slice(); return f.length ? f : ['Shooting']; }
function bItem(d, o, sets) {
  sets = sets || d.sets; var lvl = o.level, gp = clamp(0.75 - (d.difficulty - lvl) * 0.08 - (o.intensity === 'grind' ? 0.05 : 0), 0.4, 0.9);
  return { drillId: d.id, name: d.name, category: d.category, metric: d.metric, targetSets: sets, targetAttempts: d.attempts, restSec: B_INT[o.intensity][2], timeLimitSec: 0, baseSets: d.sets, baseMin: d.minutes, goal: d.metric === 'makes' ? Math.max(1, Math.round(d.attempts * gp)) : null };
}
var bMins = function (it) { return Math.max(2, Math.round((it.baseMin || 6) * (it.targetSets / (it.baseSets || it.targetSets || 1)))); };
function bTotal(dr) { return sum(dr.blocks, function (bl) { return sum(bl.items, bMins); }); }
function genWorkout(o, seed) {
  var pool = allDrills().filter(function (d) { return bAllowed(d, o); }), target = { 1: 1.8, 2: 2.6, 3: 3.3, 4: 4 }[o.level] + (o.intensity === 'grind' ? 0.4 : o.intensity === 'skill' ? -0.4 : 0);
  var used = {}, rnd = function (id) { return (hashStr(id + ':' + seed) % 100) / 100; };
  var pick = function (areas, budget, maxDiff) {
    var c = pool.filter(function (d) { return !used[d.id] && (!maxDiff || d.difficulty <= maxDiff) && areas.some(function (a) { return d.category === a; }); })
      .sort(function (a, b) { return (Math.abs(a.difficulty - target) + rnd(a.id) * 1.2) - (Math.abs(b.difficulty - target) + rnd(b.id) * 1.2); });
    var out = [], m = 0;
    for (var i = 0; i < c.length && m < budget - 2; i++) { if (m + c[i].minutes > budget + 2 && out.length) continue; out.push(c[i]); used[c[i].id] = true; m += c[i].minutes; }
    return out;
  };
  var focus = bFocus(o), mins = o.mins, warm = mins >= 20 ? 5 : 3, fin = mins >= 30 ? (o.intensity === 'grind' ? 8 : 4) : 0, main = mins - warm - fin, blocks = [];
  var WU = ['d-form-close', 'd-pound-series', 'd-spider', 'd-pivot-series', 'd-jump-rope'], wu = pool.filter(function (d) { return WU.indexOf(d.id) >= 0; }).sort(function (a, b) { return rnd(a.id) - rnd(b.id); }).slice(0, 1); wu.forEach(function (d) { used[d.id] = true; });
  blocks.push({ name: 'Warm-up', items: wu.slice(0, 1).map(function (d) { return bItem(d, o, Math.max(2, d.sets - 1)); }) });
  focus.forEach(function (a, i) { var share = Math.round(main / focus.length) + (i === 0 ? main - Math.round(main / focus.length) * focus.length : 0); var ds = pick([a], share); if (ds.length) blocks.push({ name: a, items: ds.map(function (d) { return bItem(d, o); }) }); });
  var ftf = function () { return pool.filter(function (d) { return (d.id === 'd-ft-timed' || d.id === 'd-tired-fts' || d.id === 'd-pressure-fts') && !used[d.id]; }).slice(0, 1); };
  if (fin) { var f = o.intensity === 'grind' ? pick(['Conditioning'], fin) : pool.filter(function (d) { return (d.id === 'd-ft-timed' || d.id === 'd-tired-fts' || d.id === 'd-pressure-fts') && !used[d.id]; }).slice(0, 1); var cond = f.length && f[0].category === 'Conditioning'; if (!f.length) f = ftf(); if (f.length) blocks.push({ name: cond ? 'Conditioning finisher' : 'Free throw finisher', items: f.map(function (d) { return bItem(d, o); }) }); }
  var out = blocks.filter(function (bl) { return bl.items.length; }), mainItems = out.slice(1).reduce(function (a, bl) { return bl.name.indexOf('finisher') < 0 ? a.concat(bl.items) : a; }, []), guard = 0;
  while (mainItems.length && sum(out, function (bl) { return sum(bl.items, bMins); }) < mins - 3 && guard < 40) { var it = mainItems[guard % mainItems.length]; if (it.targetSets < it.baseSets + 3) it.targetSets++; guard++; }
  var tot = function () { return sum(out, function (bl) { return sum(bl.items, bMins); }); }, g2 = 0;
  while (tot() > mins + 3 && g2 < 60) { g2++; var all = out.reduce(function (a, bl) { return a.concat(bl.items.map(function (it) { return { bl: bl, it: it }; })); }, []).sort(function (x, y) { return bMins(y.it) - bMins(x.it); });
    var big = all.filter(function (x) { return x.it.targetSets > 1; })[0];
    if (big && bMins(big.it) > 4) big.it.targetSets--; else { var last = out.filter(function (bl) { return bl.items.length; }).slice(-1)[0]; if (!last || all.length <= 1) break; last.items.pop(); out = out.filter(function (bl) { return bl.items.length; }); } }
  return { seed: seed, built: Date.now(), name: mins + '-Min ' + (focus.length > 2 ? 'Full' : focus.join(' + ')) + ' Workout', blocks: out };
}
function bOpt(key, val, label, sub, on, multi) { return '<button type="button" class="bopt' + (on ? ' on' : '') + '" data-a="b-opt" data-k="' + key + '" data-v="' + esc(val) + '"' + (multi ? ' data-m="1"' : '') + '><b>' + label + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</button>'; }
function viewBuilder() {
  var b = bState(), o = b.opts, dr = b.draft;
  var areas = ['Shooting', 'Ball Handling', 'Finishing', 'Footwork', 'Pick-and-Roll', 'Movement', 'Game Situations', 'Conditioning'];
  var form = '<section class="panel bwiz"><div class="bstep"><span class="bn">1</span><div class="grow"><h3>How much time do you have?</h3><div class="bopts">' + B_TIMES.map(function (t) { return bOpt('mins', t, t + '<span> min</span>', '', o.mins === t); }).join('') + '</div></div></div>' +
    '<div class="bstep"><span class="bn">2</span><div class="grow"><h3>Your level</h3><div class="bopts">' + B_LEVELS.map(function (l) { return bOpt('level', l[0], l[1], l[2], o.level === l[0]); }).join('') + '</div></div></div>' +
    '<div class="bstep"><span class="bn">3</span><div class="grow"><h3>What do you want to work on? <span class="tiny">up to 3</span></h3><div class="bopts">' + bOpt('focus', 'coach', ic('target', 16) + ' My weak spots', coachState().setupAt ? focusAreas().map(function (x) { return x.area; }).join(' + ') : 'from your Coach ratings', o.focus.indexOf('coach') >= 0, true) + areas.map(function (a) { return bOpt('focus', a, esc(a), allDrills().filter(function (d) { return d.category === a && bAllowed(d, o); }).length + ' drills', o.focus.indexOf(a) >= 0, true); }).join('') + '</div></div></div>' +
    '<div class="bstep"><span class="bn">4</span><div class="grow"><h3>Setup</h3><div class="bopts">' + bOpt('partner', 'false', 'Solo', 'Just you and a hoop', !o.partner) + bOpt('partner', 'true', 'With a partner', 'Passer or defender', o.partner) + bOpt('court', 'half', 'Half court', '', o.court === 'half') + bOpt('court', 'full', 'Full court', 'Sprints and full-court drills', o.court === 'full') + '</div><div class="tiny" style="margin:10px 0 6px">Equipment you have</div><div class="chips">' + B_GEAR.map(function (g) { return '<button type="button" class="chip' + (o.gear.indexOf(g) >= 0 ? ' on' : '') + '" data-a="b-gear" data-v="' + g + '">' + g + '</button>'; }).join('') + '</div></div></div>' +
    '<div class="bstep"><span class="bn">5</span><div class="grow"><h3>Intensity</h3><div class="bopts">' + Object.keys(B_INT).map(function (k) { return bOpt('intensity', k, B_INT[k][0], B_INT[k][1], o.intensity === k); }).join('') + '</div></div></div>' +
    '<button class="btn p xl" data-a="b-gen">' + ic('sparkles', 20) + ' ' + (dr ? 'Build a new workout' : 'Build my workout') + '</button></section>';
  var quick = '<div class="bquick">' + B_QUICK.map(function (q, i) { return '<button class="preset" data-a="b-quick" data-i="' + i + '"><b>' + esc(q.n) + '</b><em>Build ' + ic('arrow-right', 14) + '</em></button>'; }).join('') + '</div>';
  return pageHead('Workout Builder', 'Build your workout', dr ? '<button class="btn sm" data-a="b-clear">Start over</button>' : '') + (dr ? bPreview(dr, o) : quick + form);
}
function bPreview(dr, o) {
  var tot = bTotal(dr), n = sum(dr.blocks, function (bl) { return bl.items.length; }), k = 0;
  return '<section class="panel hero bhead"><div class="row"><div class="grow"><div class="kick">' + esc(B_INT[o.intensity][0]) + ' · ' + esc(B_LEVELS[o.level - 1][1]) + ' · ' + (o.partner ? 'With partner' : 'Solo') + '</div><input class="bname" id="b-name" value="' + esc(dr.name) + '" aria-label="Workout name"><div class="bmeta"><span>' + ic('timer', 15) + ' <b class="num">' + tot + '</b> min' + (Math.abs(tot - o.mins) > 4 ? ' <span class="tag w">target ' + o.mins + '</span>' : '') + '</span><span>' + ic('dumbbell', 15) + ' ' + n + ' drills</span><span>' + ic('layout-grid', 15) + ' ' + dr.blocks.length + ' blocks</span></div></div></div>' +
    '<div class="btns" style="margin-top:14px"><button class="btn p" data-a="b-start">' + ic('play', 18) + ' Start workout</button><button class="btn b" data-a="b-save">' + ic('check', 16) + ' Save workout</button><button class="btn" data-a="b-regen">' + ic('repeat', 16) + ' Shuffle drills</button><button class="btn g" data-a="b-edit">' + ic('settings', 16) + ' Change options</button></div></section>' +
    dr.blocks.map(function (bl, bi) { var bm = sum(bl.items, bMins); return '<section class="bblock"><div class="bbh"><h3>' + esc(bl.name) + '</h3><span class="tiny">' + bm + ' min</span><button class="btn xs" data-a="b-add" data-b="' + bi + '">' + ic('plus', 13) + ' Add drill</button></div>' + bl.items.map(function (it, ii) { k++; var d = drillById(it.drillId) || {};
      return '<div class="bdrill"><span class="bdn">' + k + '</span><div class="grow"><a href="#drill-' + it.drillId.slice(2) + '" class="nm">' + esc(it.name) + '</a><div class="tiny">' + esc(d.objective || '') + '</div><div class="bdm"><span class="diff" title="Difficulty ' + (d.difficulty || '?') + ' of 5">' + [1, 2, 3, 4, 5].map(function (x) { return '<i class="' + (x <= (d.difficulty || 0) ? 'on' : '') + '"></i>'; }).join('') + '</span><span>' + it.targetSets + ' × ' + it.targetAttempts + (it.metric === 'makes' ? ' shots' : ' reps') + '</span><span>' + bMins(it) + ' min</span>' + (it.goal ? '<span class="goal">' + ic('target', 12) + ' Goal ' + it.goal + '/' + it.targetAttempts + ' per set</span>' : '<span class="goal">' + ic('zap', 12) + ' Clean reps, game speed</span>') + '</div></div>' +
        '<div class="bctl"><div class="stepper-s"><button class="btn xs" data-a="b-sets" data-b="' + bi + '" data-i="' + ii + '" data-d="-1" aria-label="Fewer sets">' + ic('minus', 12) + '</button><b class="num">' + it.targetSets + '</b><button class="btn xs" data-a="b-sets" data-b="' + bi + '" data-i="' + ii + '" data-d="1" aria-label="More sets">' + ic('plus', 12) + '</button></div><div class="row s" style="gap:4px;flex-wrap:nowrap"><button class="btn xs" data-a="b-swap" data-b="' + bi + '" data-i="' + ii + '" title="Swap for a similar drill">' + ic('repeat', 13) + '</button><button class="btn xs" data-a="b-move" data-b="' + bi + '" data-i="' + ii + '" data-d="-1" aria-label="Move up"' + (ii ? '' : ' disabled') + '>↑</button><button class="btn xs" data-a="b-move" data-b="' + bi + '" data-i="' + ii + '" data-d="1" aria-label="Move down"' + (ii < bl.items.length - 1 ? '' : ' disabled') + '>↓</button><button class="btn xs g d" data-a="b-rm" data-b="' + bi + '" data-i="' + ii + '" aria-label="Remove">' + ic('x', 13) + '</button></div></div></div>'; }).join('') + '</section>'; }).join('') +
    '<p class="tiny" style="margin-top:12px">Goals are sized to your level and the drill’s difficulty. Built from your drill library, including drills you add yourself.</p>';
}
function bDraft() { return bState().draft; }
function bNameSync() { var n = $('#b-name'), d = bDraft(); if (n && d) d.name = n.value.trim() || d.name; }
ACT['b-opt'] = function (el) {
  var o = bState().opts, k = el.dataset.k, v = el.dataset.v;
  if (k === 'focus') { if (v === 'coach') o.focus = o.focus.indexOf('coach') >= 0 ? [] : ['coach']; else { o.focus = o.focus.filter(function (x) { return x !== 'coach'; }); var i = o.focus.indexOf(v); if (i >= 0) o.focus.splice(i, 1); else if (o.focus.length < 3) o.focus.push(v); else toast('Pick up to 3 areas', 'warn'); } }
  else if (k === 'mins' || k === 'level') o[k] = +v; else if (k === 'partner') o.partner = v === 'true'; else o[k] = v;
  if (k === 'focus' && v === 'coach' && !coachState().setupAt) toast('Take the Coach assessment so “My weak spots” knows your weak spots. Until then it uses Shooting.', 'warn');
  save(); render();
};
ACT['b-gear'] = function (el) { var o = bState().opts, i = o.gear.indexOf(el.dataset.v); if (i >= 0) o.gear.splice(i, 1); else o.gear.push(el.dataset.v); save(); render(); };
ACT['b-gen'] = function () { var b = bState(); if (!b.opts.focus.length) { toast('Pick at least one area to work on', 'warn'); return; } b.draft = genWorkout(b.opts, uid()); save(); render(); };
ACT['b-quick'] = function (el) { var b = bState(); Object.assign(b.opts, B_QUICK[+el.dataset.i].o); b.draft = genWorkout(b.opts, uid()); save(); render(); };
ACT['b-regen'] = function () { var b = bState(); bNameSync(); var keep = b.draft.name; b.draft = genWorkout(b.opts, uid()); if (!/^\d+-Min /.test(keep)) b.draft.name = keep; save(); render(); toast('New drill mix, same options'); };
ACT['b-edit'] = function () { var b = bState(); bNameSync(); b.draft = null; save(); render(); };
ACT['b-clear'] = function () { bState().draft = null; save(); render(); };
ACT['b-sets'] = function (el) { bNameSync(); var it = bDraft().blocks[+el.dataset.b].items[+el.dataset.i]; it.targetSets = clamp(it.targetSets + (+el.dataset.d), 1, 10); save(); render(); };
ACT['b-rm'] = function (el) { bNameSync(); var bl = bDraft().blocks[+el.dataset.b]; bl.items.splice(+el.dataset.i, 1); if (!bl.items.length) bDraft().blocks.splice(+el.dataset.b, 1); save(); render(); };
ACT['b-move'] = function (el) { bNameSync(); var its = bDraft().blocks[+el.dataset.b].items, i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= its.length) return; var t = its[i]; its[i] = its[j]; its[j] = t; save(); render(); };
ACT['b-swap'] = function (el) {
  bNameSync(); var dr = bDraft(), o = bState().opts, it = dr.blocks[+el.dataset.b].items[+el.dataset.i], cur = drillById(it.drillId) || {}, inUse = dr.blocks.reduce(function (a, bl) { return a.concat(bl.items.map(function (x) { return x.drillId; })); }, []);
  var c = allDrills().filter(function (d) { return d.category === it.category && inUse.indexOf(d.id) < 0 && bAllowed(d, o); }).sort(function (a, b) { return Math.abs(a.difficulty - (cur.difficulty || 3)) - Math.abs(b.difficulty - (cur.difficulty || 3)) || (hashStr(a.id + dr.seed + it.drillId) % 7) - (hashStr(b.id + dr.seed + it.drillId) % 7); });
  if (!c.length) { toast('No other ' + it.category + ' drills fit your setup. Add equipment or a partner, or create a drill.', 'warn'); return; }
  dr.blocks[+el.dataset.b].items[+el.dataset.i] = bItem(c[0], o); save(); render(); toast('Swapped in ' + c[0].name);
};
ACT['b-add'] = function (el) {
  bNameSync(); var dr = bDraft(), o = bState().opts, bl = dr.blocks[+el.dataset.b], inUse = dr.blocks.reduce(function (a, b2) { return a.concat(b2.items.map(function (x) { return x.drillId; })); }, []);
  var area = AREAS.indexOf(bl.name) >= 0 ? bl.name : null, list = allDrills().filter(function (d) { return inUse.indexOf(d.id) < 0 && bAllowed(d, o) && (!area || d.category === area); }).sort(function (a, b) { return a.difficulty - b.difficulty; });
  modal('Add a drill to ' + bl.name, list.length ? '<div class="list">' + list.map(function (d) { return '<button class="tapwrap" data-a="b-addpick" data-b="' + el.dataset.b + '" data-id="' + d.id + '"><div class="main"><b class="nm">' + esc(d.name) + '</b><div class="tiny">' + esc(d.category) + ' · difficulty ' + d.difficulty + ' · ' + d.minutes + ' min</div></div>' + ic('plus', 16) + '</button>'; }).join('') + '</div>' : '<div class="empty">No more drills fit this block and your setup.</div>');
};
ACT['b-addpick'] = function (el) { var d = drillById(el.dataset.id); bDraft().blocks[+el.dataset.b].items.push(bItem(d, bState().opts)); save(); closeModal(); render(); toast('Added ' + d.name); };
function bFlat() { return bDraft().blocks.reduce(function (a, bl) { return a.concat(bl.items.map(function (it) { return { drillId: it.drillId, name: it.name, category: it.category, metric: it.metric, targetSets: it.targetSets, targetAttempts: it.targetAttempts, restSec: it.restSec, timeLimitSec: 0 }; })); }, []); }
ACT['b-start'] = function () { bNameSync(); var dr = bDraft(); if (!bFlat().length) { toast('Add at least one drill', 'warn'); return; } save(); startRun(bFlat(), dr.name, null, null); };
ACT['b-save'] = function () {
  bNameSync(); var dr = bDraft(), o = bState().opts, items = bFlat(); if (!items.length) { toast('Add at least one drill', 'warn'); return; }
  var cats = {}; items.forEach(function (i) { cats[i.category] = (cats[i.category] || 0) + 1; }); var main = Object.keys(cats).filter(function (k) { return k !== 'Conditioning' || Object.keys(cats).length === 1; }).sort(function (a, b) { return cats[b] - cats[a]; })[0];
  var w = { id: 'w-' + uid(), name: dr.name, category: main, objective: 'Built in the Workout Builder: ' + bFocus(o).join(', ') + ', ' + B_INT[o.intensity][0].toLowerCase() + '.', minutes: bTotal(dr), difficulty: Math.round(sum(items, function (i) { return (drillById(i.drillId) || { difficulty: 3 }).difficulty; }) / items.length), warmup: '', notes: dr.blocks.map(function (bl) { return bl.name + ': ' + bl.items.map(function (i) { return i.name + (i.goal ? ' (goal ' + i.goal + '/' + i.targetAttempts + ')' : ''); }).join(', '); }).join('\n'), template: false, custom: true, created: Date.now(), items: items };
  S.workouts.push(w); save(); toast('Saved “' + w.name + '”. Find it in Train and My Program, where you can let your coach use it.'); render();
};
/* wire in: route, Train banner, Home quick tile, sidebar */
(function () {
  var _rv = routeView; routeView = function (r) { if (r === 'builder') return viewBuilder(); return _rv(r); };
  Object.assign(TAB_OF, { builder: 'train' });
  var _train = viewTrain; viewTrain = function () { var h = _train(), banner = '<a class="build-banner" href="#builder"><span class="bb-ic">' + ic('sparkles', 26) + '</span><span class="grow"><b>Workout Builder</b><small>Pick your time, level and focus. Get a full workout with goals in seconds.</small></span>' + ic('arrow-right', 20) + '</a>'; var ph = h.indexOf('class="pagehead"'), cands = [h.indexOf('<section', ph), h.indexOf('<div class="grid', ph)].filter(function (x) { return x > ph; }), j = cands.length ? Math.min.apply(null, cands) : -1; return j > 0 ? h.slice(0, j) + banner + h.slice(j) : banner + h; };
  var _home = viewHomePro; viewHomePro = function () { return _home().replace('<div class="quick">', '<div class="quick"><a class="qt" href="#builder"><span>' + ic('sparkles', 22) + '</span><b>Build</b><small>Custom workout</small></a>').replace(/<a class="qt" href="#recruit">[\s\S]*?<\/a>/, ''); };
  var tr = $('.side a[data-r="train"]'); if (tr) tr.insertAdjacentHTML('afterend', '<a href="#builder" data-r="builder"><i>' + ic('sparkles', 20) + '</i>Workout Builder</a>');
  render();
})();
