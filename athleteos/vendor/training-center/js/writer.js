/* ==================== Workout Writer: your workouts, your words ====================
   Write it like you'd text it (one block per line), or add blocks by hand.
   Blocks: a drill (makes / reps / time) with your variations, or a Spot Map shooting block.
   Saved workouts run in the normal runner, feed Shot Lab stats, and show up in My Week. */
var WR_TYPES = ['spot-feel', 'rhythm', 'game', 'cla-finish', 'skill', 'handle', 'creative', 'strength'];
var WR_EXAMPLES = [
  ['Light shooting + glass finishing', '200 light shots\nContinuous glass finishing 4x10: right hand off the toss, catch out of the net, finish left, reverse\nCuff handle 15 min'],
  ['Feel-good shooting', '30 mid catch and shoot\n30 midi pulls\n20 cut into shots\n40 catch and shoot threes\n20 off the dribble threes\n10 free throws'],
  ['Shot creation', '3x10 snatchbacks: left wing, right wing, top\n3x10 spin fades: left block, right block\n20 contested mid pulls\nSelf-lob finishes 3x6: catch at the highest point\n10 tired free throws'],
];
function wrState() { if (!S.writer || typeof S.writer !== 'object') S.writer = { draft: null }; return S.writer; }
function wrNewDraft(name) { return { wid: null, name: name || 'My workout', wt: 'skill', notes: '', blocks: [] }; }
function wrArea(cat) { return AREAS.indexOf(cat) >= 0 ? cat : (AREAS[0] || 'Shooting'); }
/* ---------- the text parser (rule-based, no AI) ---------- */
var WR_SHOT_ALIASES = [
  [/catch[\s-]*(and|&|n)[\s-]*shoot|c&s|spot[\s-]?up/, 'catch'], [/off (the )?dribble|pull[\s-]?ups?|pulls\b|pullups/, 'move'], [/\bcuts?\b|cutting|cut into/, 'cut'],
  [/tired (free throws|fts?)/, 'tired-ft'], [/free throws?|\bfts?\b/, 'ft'], [/floaters?/, 'float'], [/runners?/, 'runner'], [/snatch ?backs?/, 'snatch'], [/step[\s-]?backs?/, 'stepback'],
  [/side[\s-]?steps?/, 'sidestep'], [/spin fades?/, 'spin'], [/bump fades?/, 'bump'], [/turn ?arounds?/, 'turn'], [/one[\s-]?leg(ged)? fades?/, 'onelegged'], [/hesi/, 'hesi'],
  [/pin[\s-]?downs?/, 'pindown'], [/flares?/, 'flare'], [/relocat/, 'reloc'], [/contested/, 'contested-mid'], [/transition (catch|3|three)/, 'trans-catch'], [/transition pull/, 'trans-pull'],
  [/handoffs?|\bdho\b/, 'dho'], [/pick[\s-]?(and|&|n)[\s-]?pop|\bpops?\b/, 'pop'], [/curls?/, 'curl'], [/closeouts?/, 'closeout'], [/jab/, 'jab'], [/sweep/, 'sweep'], [/between the legs|btl/, 'btl-pull'], [/crossover pull|cross pull/, 'cross-pull'],
];
function wrShotOf(t) {
  /* most specific first: contested + transition + creation moves, then catch/pull-up/cut */
  var order = ['tired-ft', 'contested-mid', 'trans-catch', 'trans-pull', 'snatch', 'stepback', 'sidestep', 'spin', 'bump', 'turn', 'onelegged', 'hesi', 'pindown', 'flare', 'reloc', 'dho', 'pop', 'curl', 'closeout', 'btl-pull', 'cross-pull', 'sweep', 'jab', 'float', 'runner', 'ft', 'cut', 'catch', 'move'];
  for (var i = 0; i < order.length; i++) { var a = WR_SHOT_ALIASES.filter(function (x) { return x[1] === order[i]; })[0]; if (a && a[0].test(t) && SHOT_LIB[order[i]]) return order[i]; }
  var ks = Object.keys(SHOT_LIB).filter(function (k) { return SHOT_LIB[k].custom && t.indexOf(SHOT_LIB[k].n.toLowerCase()) >= 0; }); return ks[0] || null;
}
function wrZoneOf(t, shot) {
  if (/free throw|\bfts?\b/.test(t) || shot === 'ft' || shot === 'tired-ft') return 'Free throw';
  if (/floater|runner/.test(t) || shot === 'float' || shot === 'runner') return 'Floater';
  if (/corner/.test(t) && /three|\b3s?\b|3pt|3-point|corner 3/.test(t)) return 'Corner 3';
  if (/three|\b3s\b|\b3pt|3-point|from 3|deep/.test(t)) return /top/.test(t) ? 'Top 3' : 'Wing 3';
  if (/mid|midi|elbow|short corner|block/.test(t)) return 'Midrange';
  if (shot && SHOT_LIB[shot]) { var w = SHOT_LIB[shot].where; return w.indexOf('mid') >= 0 && w.indexOf('3') < 0 ? 'Midrange' : null; }
  return null;
}
function wrCatOf(t, shot) {
  if (/glass|finish|layup|lob|rim|reverse|euro|pickup|gather|floater|runner/.test(t)) return 'Finishing';
  if (/handl|dribble|cuff|combo|crossover(?! pull)|pound|two[\s-]?ball|tennis/.test(t)) return 'Ball Handling';
  if (/defen|slide|closeout drill/.test(t)) return AREAS.indexOf('Defense') >= 0 ? 'Defense' : 'Footwork';
  if (/footwork|pivot|jab series/.test(t)) return 'Footwork';
  if (/sprint|condition|lift|squat|jump|plyo|core/.test(t)) return 'Conditioning';
  if (/pick[\s-]?and[\s-]?roll|pnr|screen/.test(t) && !shot) return 'Pick-and-Roll';
  if (shot || /shot|shoot|jumper|three|\b3s\b|pull|fade|mid/.test(t)) return 'Shooting';
  return 'Ball Handling';
}
function wrFindDrill(name) {
  var n = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); if (n.length < 4) return null;
  var norm = function (x) { return x.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var all = allDrills(), exact = all.filter(function (d) { return norm(d.name) === n; })[0]; if (exact) return exact;
  return all.filter(function (d) { var dn = norm(d.name); return dn.indexOf(n) >= 0 || (n.indexOf(dn) >= 0 && dn.length >= 8); })[0] || null;
}
function wrParseLine(line) {
  var raw = line.replace(/^\s*([-*•–]|\d+[.)])\s*/, '').trim(); if (!raw) return null;
  var ci = raw.indexOf(':'), head = ci >= 0 ? raw.slice(0, ci) : raw, tail = ci >= 0 ? raw.slice(ci + 1) : '';
  var vars = tail.split(/\s*(?:,|;|→|->|\bthen\b|\/)\s*/).map(function (v) { return v.trim(); }).filter(Boolean).map(function (v) { return v.charAt(0).toUpperCase() + v.slice(1); });
  var t = head.toLowerCase(), b = { id: uid(), kind: 'drill', name: '', cat: 'Shooting', metric: 'reps', sets: 3, n: 10, goal: 0, mins: 10, shot: null, zone: null, vars: vars };
  var mx = t.match(/(\d+)\s*[x×]\s*(\d+)/), mm = t.match(/(\d+)\s*(?:-|\s)?(?:min|mins|minutes|m)\b/), mn = !mx && t.match(/(?:^|\s)(\d+)\s+(?!x)/) || (!mx && t.match(/^(\d+)/));
  var shot = wrShotOf(t), shotWords = /shots?|shooting|jumpers?|threes|\b3s\b|makes|free throws|fts?\b|floaters/.test(t);
  /* "200 light shots" with no specific shot → a Spot Map block */
  if (mn && !mx && !mm && /\bshots?\b|shooting/.test(t) && !shot) {
    var light = /light|rhythm|feel|easy/.test(t); b.kind = 'spot'; b.preset = light ? 'feel' : 'catch'; b.shots = +mn[1]; b.name = (light ? 'Light shooting' : 'Shooting') + ' (' + b.shots + ' shots)'; b.cat = 'Shooting'; return b;
  }
  if (shot) { b.shot = shot; b.zone = wrZoneOf(t, shot); b.metric = 'makes'; b.cat = SHOT_LIB[shot].fam === 'touch' ? 'Finishing' : 'Shooting'; }
  else b.cat = wrCatOf(t, null);
  if (mx) { b.sets = +mx[1]; b.n = +mx[2]; if (!shot && (b.cat === 'Shooting' || b.cat === 'Finishing')) b.metric = 'makes'; }
  else if (mm) { b.metric = 'time'; b.mins = +mm[1]; }
  else if (mn) { var tot = +mn[1]; if (shot || shotWords) { b.metric = 'makes'; b.sets = tot > 30 ? Math.ceil(tot / 25) : 1; b.n = Math.round(tot / b.sets); } else { b.sets = 1; b.n = tot; } }
  else if (b.cat === 'Shooting' || b.cat === 'Finishing') b.metric = 'makes';
  var nm = head.replace(/(\d+)\s*[x×]\s*(\d+)/i, '').replace(/(\d+)\s*(?:-|\s)?(?:min|mins|minutes|m)\b/i, '').replace(/^\s*\d+\s+/, '').replace(/\s+/g, ' ').trim();
  nm = nm.replace(/^(of|for|x)\s+/i, ''); b.name = nm ? nm.charAt(0).toUpperCase() + nm.slice(1) : (shot ? SHOT_LIB[shot].n : 'Drill');
  var d = wrFindDrill(b.name); if (d) { b.drillId = d.id; b.cat = d.category; if (!mx && !mn && !mm) { b.sets = d.sets || 3; b.n = d.attempts || 10; b.metric = d.metric === 'makes' ? 'makes' : 'reps'; } }
  if (b.metric === 'time') b.cat = b.cat || 'Ball Handling';
  return b;
}
function wrParse(text) { return text.split(/\n+/).map(wrParseLine).filter(Boolean); }
/* ---------- estimates + conversion to runner items ---------- */
function wrSpotSteps(b) {
  if (b.routine) { var r = (S.shotPlans || []).find(function (x) { return x.id === b.routine; }); return r ? r.steps : []; }
  var p = SP_PRESETS.filter(function (x) { return x.id === b.preset; })[0] || SP_PRESETS[0]; return spSteps(spFill(p.w, Math.max(5, Math.round((b.shots || 100) / 5) * 5), 0));
}
function wrMins(b) {
  if (b.kind === 'spot') return Math.round(sum(wrSpotSteps(b), function (s) { return s[2] / spRate(s[1]); }));
  if (b.metric === 'time') return b.mins || 0;
  if (b.metric === 'makes') return Math.round((b.sets * b.n) / (b.shot ? spRate(b.shot) : 2.6) + (b.sets - 1) * 0.5);
  return Math.round(b.sets * Math.max(1.5, b.n * 0.15) + (b.sets - 1) * 0.5);
}
function wrTotal(doc) { return sum(doc.blocks, wrMins); }
function wrVarText(b) { return b.vars && b.vars.length ? (b.vars.length > 1 ? 'Rotate each set: ' : '') + b.vars.join(' → ') : ''; }
function wrItems(doc) {
  var out = [];
  doc.blocks.forEach(function (b) {
    if (b.kind === 'spot') { wrSpotSteps(b).forEach(function (s) { out.push({ drillId: 'shot-' + s[1], name: (s[3] || s[0]) + ' · ' + (SHOT_SHORT[s[1]] || SHOT_TYPES[s[1]]), category: SHOT_LIB[s[1]] && SHOT_LIB[s[1]].fam === 'touch' ? 'Finishing' : 'Shooting', metric: 'makes', targetSets: 1, targetAttempts: s[2], restSec: 15, timeLimitSec: 0, zone: s[0], shotType: s[1] }); }); return; }
    var it = { drillId: b.drillId || ('shot-' + (b.shot || 'catch')), name: b.name, category: wrArea(b.cat), metric: b.metric === 'makes' ? 'makes' : 'reps', targetSets: b.metric === 'time' ? 1 : b.sets, targetAttempts: b.metric === 'time' ? 1 : b.n, restSec: 30, timeLimitSec: b.metric === 'time' ? b.mins * 60 : 0, layer: (b.metric === 'time' ? b.mins + ' min continuous' + (b.vars.length ? '. ' : '') : '') + wrVarText(b) };
    if (b.goal && b.metric === 'makes') it.goal = b.goal; if (b.shot) it.shotType = b.shot; if (b.zone) it.zone = b.zone; if (!it.layer) delete it.layer;
    out.push(it);
  });
  return out;
}
/* new drill names become real drills in your library, with your variations */
function wrEnsureDrills(doc) {
  doc.blocks.forEach(function (b) {
    if (b.kind !== 'drill' || b.drillId) return;
    var ex = wrFindDrill(b.name); if (ex && ex.name.toLowerCase().replace(/[^a-z0-9]/g, '') === b.name.toLowerCase().replace(/[^a-z0-9]/g, '')) { b.drillId = ex.id; return; }
    if (b.shot && !b.vars.length && b.name.toLowerCase() === SHOT_LIB[b.shot].n.toLowerCase()) return; /* plain shot reps use the shot type */
    var d = normalizeDrill({ id: 'c-' + uid(), name: b.name, category: wrArea(b.cat), difficulty: 3, minutes: wrMins(b) || 10, sets: b.metric === 'time' ? 1 : b.sets, attempts: b.metric === 'time' ? 1 : b.n, metric: b.metric === 'makes' ? 'makes' : 'reps', zone: b.zone, objective: 'From your Workout Writer.', instructions: b.vars.length ? 'Variations: ' + b.vars.join(', ') + '.' : '', progressions: b.vars.slice(), custom: true, created: Date.now() });
    S.customDrills.push(d); b.drillId = d.id;
  });
}
function wrToWorkout(doc) {
  wrEnsureDrills(doc);
  var items = wrItems(doc), cats = {}; items.forEach(function (i) { cats[i.category] = (cats[i.category] || 0) + 1; });
  var main = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0] || 'Shooting';
  return { name: doc.name.trim() || 'My workout', category: main, objective: doc.notes || 'Written in the Workout Writer.', minutes: Math.max(5, wrTotal(doc)), difficulty: 3, warmup: '', notes: doc.blocks.map(function (b) { return b.name + (b.vars.length ? ': ' + b.vars.join(', ') : ''); }).join('\n'), template: false, custom: true, writer: true, wt: doc.wt, doc: JSON.parse(JSON.stringify(doc)), items: items };
}
/* finished sets keep the spot and shot type you planned, so Shot Lab stats see them */
(function () {
  var _bs = buildSession;
  buildSession = function (run, opts) { var s = _bs.apply(this, arguments); try { s.items.forEach(function (i, k) { var src = run.items[k]; if (!src || (!src.zone && !src.shotType)) return; i.sets.forEach(function (x) { if (src.zone) x.zone = src.zone; if (src.shotType && !x.type) x.type = src.shotType; }); }); } catch (e) { /* keep the save */ } return s; };
})();
/* ---------- views ---------- */
function wrWorkouts() { return S.workouts.filter(function (w) { return w.writer; }).slice().reverse(); }
function viewWriterList() {
  var ws = wrWorkouts();
  return pageHead('Train', 'Workout Writer', '<button class="btn p" data-a="wr-new">' + ic('plus', 16) + ' New workout</button>') +
    '<section class="panel wr-hero"><div><div class="kick">Your workouts, your words</div><h2>Write it like you’d text it</h2><p class="ink2 small">One line per block. <b>4x10</b> = sets × reps, <b>15 min</b> = timed, <b>50 snatchbacks</b> = shots of that type. Put your variations after a colon. New drills get saved to your drill library.</p></div>' +
    '<div class="wr-ex">' + WR_EXAMPLES.map(function (e, i) { return '<button class="wr-exb" data-a="wr-example" data-i="' + i + '"><b>' + esc(e[0]) + '</b><pre>' + esc(e[1]) + '</pre><em>Use this ' + ic('arrow-right', 13) + '</em></button>'; }).join('') + '</div></section>' +
    (ws.length ? '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>My workouts</h3><div class="sub">These are in My Week under “Yours”</div></div></div><div class="list">' + ws.map(function (w) { var t = WT[w.wt] || WT.skill; return '<div class="li wr-li" style="--c:' + t.c + '"><span class="wk-bi">' + ic(t.ic, 14) + '</span><div class="main"><b>' + esc(w.name) + '</b><div class="tiny">' + (w.doc ? w.doc.blocks.length : w.items.length) + ' blocks · ~' + w.minutes + ' min · ' + esc(t.n) + '</div></div>' +
      '<button class="btn sm" data-a="start-template" data-id="' + w.id + '">' + ic('play', 14) + ' Start</button><button class="btn sm g" data-a="wr-edit" data-id="' + w.id + '">Edit</button><button class="btn sm g" data-a="wr-dup" data-id="' + w.id + '" aria-label="Duplicate">' + ic('repeat', 14) + '</button><button class="btn sm g" data-a="wr-del" data-id="' + w.id + '" aria-label="Delete">' + ic('x', 14) + '</button></div>'; }).join('') + '</div></section>'
      : '<div class="empty" style="margin-top:14px"><b>No workouts written yet</b>Hit New workout, or start from one of the examples above and change it to how you really do it.</div>');
}
function wrSel(f, bid, val, opts, label) { return '<select data-c="wr-f" data-f="' + f + '" data-bid="' + bid + '" aria-label="' + esc(label) + '">' + opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(String(v)) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(String(l)) + '</option>'; }).join('') + '</select>'; }
function wrNum(f, bid, val, label, max) { return '<label class="wr-num"><span>' + esc(label) + '</span><input type="number" min="0" max="' + (max || 500) + '" value="' + (val || 0) + '" data-c="wr-f" data-f="' + f + '" data-bid="' + bid + '"></label>'; }
function wrBlockHTML(b, i, n) {
  var mins = wrMins(b), head = '<div class="wr-bh"><span class="wr-no">' + (i + 1) + '</span><input class="wr-name" value="' + esc(b.name) + '" data-c="wr-f" data-f="name" data-bid="' + b.id + '" aria-label="Block name" maxlength="60"><span class="tiny muted">~' + mins + ' min</span>' +
    '<div class="wr-ctl"><button class="wk-ib" data-a="wr-mv" data-bid="' + b.id + '" data-d="-1" ' + (i ? '' : 'disabled') + ' aria-label="Move up">' + ic('chevron-left', 13, 'up') + '</button><button class="wk-ib" data-a="wr-mv" data-bid="' + b.id + '" data-d="1" ' + (i < n - 1 ? '' : 'disabled') + ' aria-label="Move down">' + ic('chevron-right', 13, 'up') + '</button><button class="wk-ib" data-a="wr-cp" data-bid="' + b.id + '" aria-label="Duplicate">' + ic('repeat', 13) + '</button><button class="wk-ib" data-a="wr-rm" data-bid="' + b.id + '" aria-label="Delete">' + ic('x', 13) + '</button></div></div>';
  if (b.kind === 'spot') {
    var opts = SP_PRESETS.map(function (p) { return ['p:' + p.id, p.n]; }).concat((S.shotPlans || []).map(function (r) { return ['r:' + r.id, 'My routine: ' + r.name]; })), steps = wrSpotSteps(b);
    return '<div class="wr-b spot" data-bid="' + b.id + '">' + head + '<div class="wr-row"><span class="wr-kind">' + ic('crosshair', 13) + ' Spot Map</span>' + wrSel('src', b.id, b.routine ? 'r:' + b.routine : 'p:' + (b.preset || 'feel'), opts, 'Shooting mix') + (b.routine ? '' : wrNum('shots', b.id, b.shots, 'Shots', 600)) + '</div>' +
      '<div class="sp-list">' + steps.slice(0, 14).map(function (s) { return '<span class="sp-li"><span>' + esc(s[3] || s[0]) + '</span><em>' + s[2] + ' ' + esc(SHOT_SHORT[s[1]] || s[1]) + '</em></span>'; }).join('') + (steps.length > 14 ? '<span class="tiny muted">+' + (steps.length - 14) + ' more</span>' : '') + '</div></div>';
  }
  var shotOpts = [['', 'Any / not a shot']].concat(Object.keys(SHOT_LIB).map(function (k) { return [k, SHOT_LIB[k].n]; })), zoneOpts = [['', 'Any spot']].concat(ZONES.map(function (z) { return [z, z]; }));
  return '<div class="wr-b" data-bid="' + b.id + '">' + head +
    '<div class="wr-row"><div class="seg sm">' + [['makes', 'Makes'], ['reps', 'Reps'], ['time', 'Time']].map(function (m) { return '<button class="' + (b.metric === m[0] ? 'on' : '') + '" data-a="wr-metric" data-bid="' + b.id + '" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>' +
    (b.metric === 'time' ? wrNum('mins', b.id, b.mins, 'Minutes', 180) : wrNum('sets', b.id, b.sets, 'Sets', 20) + wrNum('n', b.id, b.n, b.metric === 'makes' ? 'Shots / set' : 'Reps / set', 300) + (b.metric === 'makes' ? wrNum('goal', b.id, b.goal, 'Goal makes', 300) : '')) +
    wrSel('cat', b.id, wrArea(b.cat), AREAS, 'Category') + '</div>' +
    (b.metric === 'makes' || b.shot ? '<div class="wr-row"><span class="tiny muted">Counts in Shot Lab as</span>' + wrSel('shot', b.id, b.shot || '', shotOpts, 'Shot type') + wrSel('zone', b.id, b.zone || '', zoneOpts, 'Spot') + '</div>' : '') +
    '<div class="wr-vars"><span class="tiny muted">Variations / constraints</span>' + b.vars.map(function (v, j) { return '<span class="wr-var">' + esc(v) + '<button data-a="wr-vrm" data-bid="' + b.id + '" data-j="' + j + '" aria-label="Remove ' + esc(v) + '">' + ic('x', 11) + '</button></span>'; }).join('') +
    '<form data-form="wr-var" data-bid="' + b.id + '" class="wr-vadd"><input name="v" placeholder="Add one (e.g. finish left)" maxlength="60"><button class="wk-ib" type="submit" aria-label="Add variation">' + ic('plus', 13) + '</button></form></div>' +
    (b.drillId ? '<a class="tiny wr-lib" href="#drill-' + esc(b.drillId) + '">From your drill library ' + ic('arrow-right', 11) + '</a>' : '') + '</div>';
}
function viewWriter() {
  var st = wrState(), d = st.draft; if (!d) { location.hash = '#writer'; return viewWriterList(); }
  var tot = wrTotal(d);
  return '<a class="crumb" href="#writer">' + ic('chevron-left', 14) + ' Workout Writer</a>' + pageHead(d.wid ? 'Editing' : 'New workout', esc(d.name || 'My workout'), '<span class="tag">~' + tot + ' min</span>') +
    '<section class="panel wr-top"><div class="grid g2"><div class="fld"><label class="f" for="wr-n">Workout name</label><input id="wr-n" value="' + esc(d.name) + '" data-c="wr-doc" data-f="name" maxlength="50"></div>' +
    '<div class="fld"><span class="f">What kind (color in My Week)</span><div class="chips">' + WR_TYPES.map(function (k) { return '<button class="chip' + (d.wt === k ? ' on' : '') + '" data-a="wr-wt" data-v="' + k + '" style="' + (d.wt === k ? 'background:' + WT[k].c + ';color:#0d0d0e;border-color:transparent' : '') + '">' + esc(WT[k].n) + '</button>'; }).join('') + '</div></div></div>' +
    '<div class="fld" style="margin-top:12px"><label class="f" for="wr-notes">Notes (optional)</label><input id="wr-notes" value="' + esc(d.notes || '') + '" data-c="wr-doc" data-f="notes" maxlength="160" placeholder="When you do this, what it’s for"></div></section>' +
    '<section class="panel wr-quick"><div class="phead"><div><h3>Write it out</h3><div class="sub">One block per line. Variations after a colon. Adds to the blocks below.</div></div></div>' +
    '<form data-form="wr-parse"><textarea name="t" rows="4" placeholder="200 light shots&#10;Continuous glass finishing 4x10: right hand, catch out of the net, finish left&#10;Cuff handle 15 min&#10;3x10 snatchbacks: left wing, right wing"></textarea><div class="row" style="margin-top:8px;justify-content:flex-start;gap:8px"><button class="btn" type="submit">' + ic('sparkles', 15) + ' Turn into blocks</button><span class="tiny muted">Rule-based: it reads numbers and shot names. Fix anything below.</span></div></form></section>' +
    '<div class="wr-blocks">' + (d.blocks.length ? d.blocks.map(function (b, i) { return wrBlockHTML(b, i, d.blocks.length); }).join('') : '<div class="empty"><b>No blocks yet</b>Write it out above, or add blocks one at a time.</div>') + '</div>' +
    '<div class="wr-add"><button class="btn g" data-a="wr-add" data-v="drill">' + ic('plus', 15) + ' Drill</button><button class="btn g" data-a="wr-add" data-v="time">' + ic('timer', 15) + ' Timed block</button><button class="btn g" data-a="wr-add" data-v="shots">' + ic('target', 15) + ' Shots of one type</button><button class="btn g" data-a="wr-add" data-v="spot">' + ic('crosshair', 15) + ' Spot Map shooting</button></div>' +
    (d.blocks.length ? '<section class="panel wr-save"><div class="row"><div><b>~' + tot + ' min</b> · ' + d.blocks.length + ' blocks</div><div class="btns"><button class="btn p" data-a="wr-save">' + ic('check', 15) + ' Save</button><button class="btn" data-a="wr-save" data-then="start">' + ic('play', 15) + ' Save & start</button></div></div>' +
      '<div class="wr-days"><span class="tiny muted">Save & add to this week:</span>' + [0, 1, 2, 3, 4, 5, 6].map(function (i) { var dk = addDays(weekStart(today()), i); return '<button class="chip' + (dk === today() ? ' on' : '') + '" data-a="wr-save" data-then="day" data-day="' + i + '">' + esc(fmtDay(dk, { weekday: 'short' })) + '</button>'; }).join('') + '</div></section>' : '');
}
/* ---------- actions ---------- */
function wrB(id) { var d = wrState().draft; return d ? d.blocks.find(function (b) { return b.id === id; }) : null; }
ACT['wr-new'] = function () { wrState().draft = wrNewDraft(); save(); location.hash = '#writer-edit'; };
ACT['wr-example'] = function (el) { var e = WR_EXAMPLES[+el.dataset.i], d = wrNewDraft(e[0]); d.blocks = wrParse(e[1]); d.wt = +el.dataset.i === 1 ? 'spot-feel' : +el.dataset.i === 2 ? 'game' : 'cla-finish'; wrState().draft = d; save(); location.hash = '#writer-edit'; toast('Loaded. Change anything to match how you really do it.'); };
ACT['wr-edit'] = function (el) { var w = S.workouts.find(function (x) { return x.id === el.dataset.id; }); if (!w) return; var d = w.doc ? JSON.parse(JSON.stringify(w.doc)) : wrNewDraft(w.name); d.wid = w.id; d.name = w.name; d.wt = w.wt || d.wt; wrState().draft = d; save(); location.hash = '#writer-edit'; };
ACT['wr-dup'] = function (el) { var w = S.workouts.find(function (x) { return x.id === el.dataset.id; }); if (!w) return; var c = JSON.parse(JSON.stringify(w)); c.id = 'w-' + uid(); c.name = w.name + ' (copy)'; c.created = Date.now(); if (c.doc) c.doc.wid = null; S.workouts.push(c); save(); render(); toast('Duplicated'); };
ACT['wr-del'] = function (el) { var k = 'wr-del-' + el.dataset.id; if (UI.armed !== k) { UI.armed = k; toast('Tap delete again. Your past sessions with it stay in history.', 'warn'); return; } UI.armed = null; S.workouts = S.workouts.filter(function (w) { return w.id !== el.dataset.id; }); save(); render(); };
ACT['wr-wt'] = function (el) { wrState().draft.wt = el.dataset.v; save(); render(); };
CHG['wr-doc'] = function (el) { var d = wrState().draft; if (!d) return; d[el.dataset.f] = el.value; save(); if (el.dataset.f === 'name') render(); };
FORM['wr-parse'] = function (f) { var d = wrState().draft, bs = wrParse(f.t.value || ''); if (!bs.length) { toast('Write at least one line', 'warn'); return; } d.blocks = d.blocks.concat(bs); save(); render(); toast('Added ' + bs.length + ' block' + (bs.length > 1 ? 's' : '') + '. Check the numbers.'); };
ACT['wr-add'] = function (el) {
  var v = el.dataset.v, b = { id: uid(), kind: 'drill', name: 'New drill', cat: 'Finishing', metric: 'reps', sets: 3, n: 10, goal: 0, mins: 10, shot: null, zone: null, vars: [] };
  if (v === 'time') { b.name = 'Timed block'; b.metric = 'time'; b.cat = 'Ball Handling'; b.mins = 15; }
  if (v === 'shots') { b.name = 'Catch & shoot'; b.metric = 'makes'; b.cat = 'Shooting'; b.shot = 'catch'; b.sets = 3; b.n = 10; }
  if (v === 'spot') { b = { id: uid(), kind: 'spot', name: 'Feel-good shooting', preset: 'feel', shots: 100, vars: [] }; }
  wrState().draft.blocks.push(b); save(); render(); setTimeout(function () { var n = $('.wr-b[data-bid="' + b.id + '"] .wr-name'); if (n) { n.focus(); n.select(); } }, 30);
};
ACT['wr-metric'] = function (el) { var b = wrB(el.dataset.bid); if (!b) return; b.metric = el.dataset.v; save(); render(); };
ACT['wr-mv'] = function (el) { var d = wrState().draft, i = d.blocks.findIndex(function (b) { return b.id === el.dataset.bid; }), j = i + (+el.dataset.d); if (i < 0 || j < 0 || j >= d.blocks.length) return; var t = d.blocks[i]; d.blocks[i] = d.blocks[j]; d.blocks[j] = t; save(); render(); };
ACT['wr-cp'] = function (el) { var d = wrState().draft, i = d.blocks.findIndex(function (b) { return b.id === el.dataset.bid; }); if (i < 0) return; var c = JSON.parse(JSON.stringify(d.blocks[i])); c.id = uid(); d.blocks.splice(i + 1, 0, c); save(); render(); };
ACT['wr-rm'] = function (el) { var d = wrState().draft; d.blocks = d.blocks.filter(function (b) { return b.id !== el.dataset.bid; }); save(); render(); };
ACT['wr-vrm'] = function (el) { var b = wrB(el.dataset.bid); if (!b) return; b.vars.splice(+el.dataset.j, 1); save(); render(); };
FORM['wr-var'] = function (f, el) { var b = wrB((el || f).dataset.bid), v = f.v.value.trim(); if (!b || !v) return; b.vars.push(v.charAt(0).toUpperCase() + v.slice(1)); save(); render(); setTimeout(function () { var i = $('.wr-b[data-bid="' + b.id + '"] .wr-vadd input'); if (i) i.focus(); }, 30); };
CHG['wr-f'] = function (el) {
  var b = wrB(el.dataset.bid), f = el.dataset.f; if (!b) return; var v = el.value;
  if (f === 'name') { b.name = v.trim() || b.name; if (b.kind === 'drill') { var d = wrFindDrill(b.name); b.drillId = d && d.name.toLowerCase() === b.name.toLowerCase() ? d.id : null; } }
  else if (f === 'src') { if (v.indexOf('r:') === 0) { b.routine = v.slice(2); b.preset = null; } else { b.preset = v.slice(2); b.routine = null; } }
  else if (f === 'shot') { b.shot = v || null; if (b.shot && !b.zone) b.zone = wrZoneOf('', b.shot); }
  else if (f === 'zone') b.zone = v || null;
  else if (f === 'cat') b.cat = v;
  else { var n = Math.max(0, Math.min(600, Math.round(+v || 0))); b[f] = f === 'sets' ? Math.max(1, n) : n; }
  save(); render();
};
ACT['wr-save'] = function (el) {
  var d = wrState().draft; if (!d || !d.blocks.length) return;
  var bad = d.blocks.filter(function (b) { return b.kind === 'drill' && (b.metric === 'time' ? !(b.mins > 0) : !(b.n > 0)); }); if (bad.length) { toast('“' + bad[0].name + '” needs a number above 0', 'warn'); return; }
  var w = wrToWorkout(d), ex = d.wid ? S.workouts.find(function (x) { return x.id === d.wid; }) : null;
  if (ex) Object.assign(ex, w); else { w.id = 'w-' + uid(); w.created = Date.now(); S.workouts.push(w); ex = w; }
  d.wid = ex.id; ex.doc.wid = ex.id; save();
  var then = el.dataset.then;
  if (then === 'day') { var keep = WK.off; WK.off = 0; wkAdd(+el.dataset.day, 'w:' + ex.id); WK.off = keep; var b = myWeek().weeks[wkStart(0)][+el.dataset.day].slice(-1)[0]; if (b) b.mins = ex.minutes; save(); toast('Saved and added to ' + fmtDay(addDays(weekStart(today()), +el.dataset.day), { weekday: 'long' })); render(); return; }
  if (then === 'start') { wrState().draft = null; save(); startRun(ex.items.map(function (i) { return Object.assign({}, i); }), ex.name, ex.id, null); return; }
  toast('Saved “' + ex.name + '”. It’s in My Week under Yours.'); render();
};
/* ---------- wiring ---------- */
(function () {
  wrState();
  var _rv = routeView; routeView = function (r) { if (r === 'writer') return viewWriterList(); if (r === 'writer-edit') return viewWriter(); return _rv(r); };
  Object.assign(TAB_OF, { writer: 'train', 'writer-edit': 'train' });
  var _train = viewTrain; viewTrain = function () { var h = _train(); return h.replace('<div class="sp-tgrid">', '<div class="sp-tgrid"><a class="sp-tc" href="#writer"><span class="sp-ti" style="--mc:#e9d98d;background:#e9d98d">' + ic('notebook-pen', 20) + '</span><b>Write my own</b><small>Your drills, your variations, your words</small></a>'); };
  var bl = $('.side a[data-r="builder"]'); if (bl && !$('.side a[data-r="writer"]')) bl.insertAdjacentHTML('beforebegin', '<a href="#writer" data-r="writer"><i>' + ic('notebook-pen', 20) + '</i>Workout Writer</a>');
  render();
})();
