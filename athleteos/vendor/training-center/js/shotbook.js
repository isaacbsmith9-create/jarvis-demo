/* ==================== Shot Book: the full shot-type library ====================
   Every shot type has a family, where it can be taken (3 / mid / floater / FT / rim),
   a short label for chips, a solo pace estimate (shots/min) and a coaching cue.
   Players can add their own types; those save in S.shotTypes. */
var SHOT_FAMS = [
  { k: 'catch', n: 'Off the catch', c: '#7fb0d6', ic: 'crosshair' },
  { k: 'move', n: 'Off the dribble', c: '#ff913d', ic: 'zap' },
  { k: 'create', n: 'Fades & shot creation', c: '#c8a46b', ic: 'sparkles' },
  { k: 'touch', n: 'Touch & finishing', c: '#55c98b', ic: 'circle-dot' },
  { k: 'ft', n: 'Free throws', c: '#ffd166', ic: 'target' },
];
/* [key, name, short, family, where, pace, cue] */
var SHOT_SEED = [
  ['catch', 'Catch & shoot', 'C&S', 'catch', '3 mid', 3, 'Feet ready before the ball gets there. Same shot every time.'],
  ['cut', 'Off a cut', 'Cut', 'catch', '3 mid', 2.2, 'Cut hard, plant the inside foot, square up on the catch.'],
  ['pindown', 'Off a pin-down', 'Pin-down', 'catch', '3 mid', 2, 'Walk your man in, sprint off the screen, hop into the shot.'],
  ['flare', 'Off a flare screen', 'Flare', 'catch', '3', 2, 'Fade away from the ball, catch with your chest to the rim, no drift.'],
  ['reloc', 'Relocation', 'Reloc', 'catch', '3', 2.2, 'Pass or drive-and-kick, then slide to the open spot and catch ready.'],
  ['trans-catch', 'Transition catch 3', 'Trans C&S', 'catch', '3', 1.6, 'Sprint the lane to the corner or wing, turn and catch on balance.'],
  ['dho', 'Off a handoff', 'DHO', 'catch', '3 mid', 2.2, 'Take it tight off the hip, shoot if they go under.'],
  ['pop', 'Pick-and-pop', 'Pop', 'catch', '3 mid', 2.2, 'Set the screen, open to the ball, shoot off the pop.'],
  ['curl', 'Off a curl', 'Curl', 'catch', 'mid', 2, 'Curl tight to the screen, inside foot first, rise on the catch.'],
  ['closeout', 'Catch vs closeout', 'Closeout', 'catch', '3 mid', 2.4, 'A chair, pad or partner flies at you. Shoot over it, don’t flinch.'],
  ['move', 'Pull-up', 'Pull-up', 'move', '3 mid', 2.4, 'Hard last dribble, sit into it, go straight up.'],
  ['one-dribble', 'Catch, 1-dribble pull-up', '1-dribble', 'move', '3 mid', 2.4, 'Rip or jab, one hard dribble to a side, pull.'],
  ['hesi', 'Hesi pull-up', 'Hesi', 'move', '3 mid', 2.3, 'Sell the drive with your eyes and shoulders, then rise out of the hesi.'],
  ['cross-pull', 'Crossover pull-up', 'Cross', 'move', '3 mid', 2.3, 'Cross low and tight, pull before the defender recovers.'],
  ['btl-pull', 'Between-the-legs pull-up', 'BTL', 'move', '3 mid', 2.3, 'Through the legs into the pickup in one rhythm.'],
  ['snatch', 'Snatchback', 'Snatch', 'move', '3 mid', 2.2, 'Attack, plant, snatch the ball back to your shooting pocket, shoot.'],
  ['stepback', 'Step-back', 'Step-back', 'move', '3 mid', 2.2, 'Push off the front foot, land balanced, don’t fall away.'],
  ['sidestep', 'Side-step', 'Side-step', 'move', '3', 2.2, 'Big lateral step off the dribble, gather and shoot square.'],
  ['jab', 'Jab-step jumper', 'Jab', 'move', '3 mid', 2.6, 'Jab hard, if they sag, rise straight off the jab foot.'],
  ['pnr-pull', 'Pull-up off a ball screen', 'PnR pull', 'move', '3 mid', 2, 'Come off tight, read the big, pull in the gap.'],
  ['trans-pull', 'Transition pull-up', 'Trans pull', 'move', '3 mid', 1.6, 'Push the ball full speed, stop on a dime, pull.'],
  ['contested-mid', 'Contested mid pull-up', 'Contested', 'move', 'mid', 2, 'Hand in your face (chair, pad or partner). Rise higher, hold the follow-through.'],
  ['bump', 'Bump fade', 'Bump fade', 'create', 'mid', 2, 'Bump the defender with your shoulder, create space, fade.'],
  ['spin', 'Spin fade', 'Spin fade', 'create', 'mid', 2, 'Spin off the hip, land square, fade on balance.'],
  ['turn', 'Turnaround fade', 'Turnaround', 'create', 'mid', 2, 'Back to the basket, pivot to the high side, fade.'],
  ['onelegged', 'One-legged fade', '1-leg fade', 'create', 'mid', 2, 'Knee up, fade off one foot, high release.'],
  ['sweep', 'Sweep jumper', 'Sweep', 'create', '3 mid', 2.4, 'Rip the ball low across, step through or rise.'],
  ['pivot', 'Pivot / step-through jumper', 'Pivot', 'create', 'mid', 2.2, 'Pump, pivot through, quick release before they recover.'],
  ['float', 'Floater', 'Float', 'touch', 'float', 3.5, 'Soft, high, off one or two feet. Release before the help gets there.'],
  ['runner', 'Runner', 'Runner', 'touch', 'float', 3, 'On the move, one foot, push it high off the glass or straight in.'],
  ['hook', 'Hook / push shot', 'Hook', 'touch', 'float', 3, 'Shoulder to the defender, high release with either hand.'],
  ['layup', 'Finish', 'Finish', 'touch', 'rim', 3.5, 'Finish with the hand away from the defender.'],
  ['ft', 'Free throws', 'FT', 'ft', 'ft', 3, 'Same routine every time.'],
  ['tired-ft', 'Tired free throws', 'Tired FT', 'ft', 'ft', 1.5, 'Sprint baseline and back, then 2 shots. Game legs.'],
];
var SHOT_LIB = {}, SHOT_SHORT = {}, SHOT_LONG = {}, SHOT_RATE = {};
function shotAdd(k, n, s, fam, where, rate, cue, custom) {
  SHOT_LIB[k] = { k: k, n: n, s: s, fam: fam, where: where.split(' '), rate: rate, cue: cue || '', custom: !!custom };
  SHOT_TYPES[k] = n; SHOT_SHORT[k] = s; SHOT_LONG[k] = n; SHOT_RATE[k] = rate;
}
SHOT_SEED.forEach(function (x) { shotAdd.apply(null, x); });
var SHOT_FAM_RATE = { catch: 2.4, move: 2.2, create: 2, touch: 3, ft: 3 };
function shotTypesState() { if (!Array.isArray(S.shotTypes)) S.shotTypes = []; return S.shotTypes; }
function registerCustomShots() {
  Object.keys(SHOT_LIB).forEach(function (k) { if (SHOT_LIB[k].custom) { delete SHOT_LIB[k]; delete SHOT_TYPES[k]; delete SHOT_SHORT[k]; delete SHOT_LONG[k]; delete SHOT_RATE[k]; } });
  shotTypesState().forEach(function (c) { if (c && c.k && c.n && !SHOT_LIB[c.k]) shotAdd(c.k, c.n, c.s || c.n, SHOT_FAM_RATE[c.fam] ? c.fam : 'move', (c.where || ['mid']).join(' '), SHOT_FAM_RATE[c.fam] || 2.2, c.cue || '', true); });
}
function shotWhere(zone) { return /3$/.test(zone || '') ? '3' : zone === 'Midrange' ? 'mid' : zone === 'Free throw' ? 'ft' : zone === 'Floater' ? 'float' : zone === 'Rim' || zone === 'Paint' ? 'rim' : null; }
function shotTypesFor(where) { return Object.keys(SHOT_LIB).filter(function (k) { return !where || SHOT_LIB[k].where.indexOf(where) >= 0; }); }
function shotTypesUsed(from, to) { var u = {}; shotSets(from, to).forEach(function (x) { if (x.type) u[x.type] = 1; }); if (SL.type !== 'all') u[SL.type] = 1; return Object.keys(SHOT_TYPES).filter(function (k) { return u[k]; }); }
/* grouped chips: used in the free-shooting tracker and the spot editor */
function shotTypeChips(sel, action, where, extra) {
  var keys = shotTypesFor(where);
  return SHOT_FAMS.map(function (f) { var ks = keys.filter(function (k) { return SHOT_LIB[k].fam === f.k; }); if (!ks.length) return '';
    return '<div class="sb-fam"><span class="sb-fl" style="--fc:' + f.c + '">' + esc(f.n) + '</span><div class="chips">' + ks.map(function (k) { return '<button class="chip' + (sel === k ? ' on' : '') + '" data-a="' + action + '" data-t="' + k + '" data-v="' + k + '"' + (extra || '') + '>' + esc(SHOT_LIB[k].s) + '</button>'; }).join('') + '</div></div>'; }).join('');
}
function shotBookStats() { var t = splitStats(shotSets(null, today())).t; return t; }
function viewShotBook() {
  registerCustomShots();
  var st = shotBookStats(), total = Object.keys(SHOT_LIB).length, WL = { '3': '3PT', mid: 'Mid', float: 'Floater', ft: 'FT', rim: 'Rim' };
  return pageHead('Shot Lab', 'Shot Book', '<a class="btn sm g" href="#shots">' + ic('chevron-left', 16) + ' Shot Lab</a>') +
    '<section class="panel sb-intro"><div><div class="kick">' + total + ' shot types</div><h2>Every shot in your bag</h2><p class="ink2 small">Track any of these in Shot Lab or put them on the Spot Map. Your make % shows next to each shot once you’ve tracked it. Got a new one? Add it at the bottom.</p></div></section>' +
    SHOT_FAMS.map(function (f) { var ks = Object.keys(SHOT_LIB).filter(function (k) { return SHOT_LIB[k].fam === f.k; }); if (!ks.length) return '';
      return '<section class="panel sb-sec" style="--fc:' + f.c + '"><div class="phead"><div><h3><span class="sb-dot"></span>' + esc(f.n) + '</h3><div class="sub">' + ks.length + ' shots</div></div></div><div class="sb-grid">' +
        ks.map(function (k) { var x = SHOT_LIB[k], s = st[k], p = s && s.att ? pct(s.made, s.att) : null;
          return '<div class="sb-card"><div class="row"><b>' + esc(x.n) + '</b>' + (p != null ? '<span class="tag ' + (p >= 45 ? 'g' : p >= 30 ? 'p' : 'b') + '">' + p + '%</span>' : '') + '</div>' +
            '<div class="sb-where">' + x.where.map(function (w) { return '<span>' + (WL[w] || w) + '</span>'; }).join('') + (s && s.att ? '<em class="tiny num">' + s.made + '/' + s.att + '</em>' : '') + (x.custom ? '<span class="mine">Mine</span>' : '') + '</div>' +
            (x.cue ? '<p class="small ink2">' + esc(x.cue) + '</p>' : '') +
            '<div class="row sb-act"><button class="btn sm" data-a="sb-track" data-t="' + k + '">' + ic('play', 14) + ' Track</button>' + (x.custom ? '<button class="btn sm g" data-a="sb-del" data-t="' + k + '" aria-label="Delete ' + esc(x.n) + '">' + ic('x', 14) + '</button>' : '') + '</div></div>'; }).join('') + '</div></section>'; }).join('') +
    '<section class="panel" style="margin-top:14px"><div class="phead"><div><h3>Add your own shot</h3><div class="sub">New move you’re working on? Add it and it shows up everywhere: Shot Lab, Spot Map and your stats.</div></div></div>' +
    '<form data-form="sb-add" class="sb-form"><div class="grid g2"><div class="fld"><label class="f" for="sb-n">Shot name</label><input id="sb-n" name="n" maxlength="32" placeholder="e.g. Double-cross step-back" required></div>' +
    '<div class="fld"><label class="f" for="sb-s">Short label (optional)</label><input id="sb-s" name="s" maxlength="12" placeholder="e.g. DX step"></div></div>' +
    '<div class="grid g2"><div class="fld"><label class="f" for="sb-f">Family</label><select id="sb-f" name="fam">' + SHOT_FAMS.map(function (f) { return '<option value="' + f.k + '"' + (f.k === 'move' ? ' selected' : '') + '>' + esc(f.n) + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><span class="f">Where you take it</span><div class="chips sb-wh">' + [['3', '3PT'], ['mid', 'Mid-range'], ['float', 'Floater range'], ['rim', 'Rim'], ['ft', 'Free throw']].map(function (w, i) { return '<label class="chip"><input type="checkbox" name="w" value="' + w[0] + '"' + (i < 2 ? ' checked' : '') + '> ' + w[1] + '</label>'; }).join('') + '</div></div></div>' +
    '<div class="fld"><label class="f" for="sb-c">Coaching cue (optional)</label><input id="sb-c" name="cue" maxlength="120" placeholder="What makes this shot go in?"></div>' +
    '<button class="btn" type="submit">' + ic('plus', 16) + ' Add shot</button></form></section>';
}
FORM['sb-add'] = function (f) {
  var n = f.n.value.trim(), where = Array.prototype.slice.call(f.querySelectorAll('input[name="w"]:checked')).map(function (x) { return x.value; });
  if (!n) return; if (!where.length) { toast('Pick at least one place you take it', 'warn'); return; }
  if (Object.keys(SHOT_LIB).some(function (k) { return SHOT_LIB[k].n.toLowerCase() === n.toLowerCase(); })) { toast('You already have “' + n + '”', 'warn'); return; }
  shotTypesState().push({ k: 'c-' + uid(), n: n, s: f.s.value.trim() || n.slice(0, 12), fam: f.fam.value, where: where, cue: f.cue.value.trim(), created: Date.now() });
  registerCustomShots(); save(); toast('Added “' + n + '” to your Shot Book'); render();
};
ACT['sb-del'] = function (el) { var k = el.dataset.t, key = 'sb-del-' + k; if (UI.armed !== key) { UI.armed = key; toast('Tap again to remove this shot type. Shots you already tracked stay in your history.', 'warn'); return; } UI.armed = null; S.shotTypes = shotTypesState().filter(function (c) { return c.k !== k; }); registerCustomShots(); save(); render(); };
ACT['sb-track'] = function (el) {
  if (shotRun()) { toast('Finish the current Shot Lab session first', 'warn'); location.hash = '#shots'; return; }
  var x = SHOT_LIB[el.dataset.t]; if (!x) return; var zone = { '3': 'Wing 3', mid: 'Midrange', float: 'Floater', ft: 'Free throw', rim: 'Rim' }[x.where[0]] || 'Midrange';
  S.shotRun = { id: uid(), preset: 'free', name: x.n, steps: [], idx: 0, log: [], zone: zone, type: x.k, startedAt: Date.now() }; save(); location.hash = '#shots'; render();
};
(function () {
  registerCustomShots();
  var _rv = routeView; routeView = function (r) { registerCustomShots(); if (r === 'shotbook') return viewShotBook(); return _rv(r); };
  Object.assign(TAB_OF, { shotbook: 'shots' });
})();
