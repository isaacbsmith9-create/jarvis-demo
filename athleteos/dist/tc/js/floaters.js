/* ==================== Floater types + ball-screen reads ====================
   Floaters: 10 floater types in the Shot Book, Shot Lab, Spot Map (new middle spot + Floater menu fill),
   Workout Writer parsing, and new Build for me floater drills.
   Ball screens: a new Build for me area with coverage reads, pull-ups, getting downhill,
   rejects/re-screens, passing reads and snake/split, plus a compete game. */
(function () {
  /* ---------- floater shot types ---------- */
  [['float-1', 'One-foot floater', '1-foot float', 3.2, 'Off one foot on the move. Release early and high, before the big can jump.'],
   ['float-2', 'Two-foot floater', '2-foot float', 3, 'Jump stop, chin the ball, then float it over the big. Balanced and strong.'],
   ['float-euro', 'Euro-step floater', 'Euro float', 2.6, 'Euro past the first defender, float it over the second.'],
   ['float-hop', 'Hop-step floater', 'Hop float', 2.8, 'Hop into a two-foot landing, rise straight up, soft touch.'],
   ['float-wrong', 'Wrong-foot floater', 'Wrong-foot', 2.8, 'Same-side foot and hand. It throws off the shot-blocker’s timing.'],
   ['float-tear', 'Teardrop', 'Teardrop', 3, 'Extra-high arc over a tall defender. Push it up, let it fall in.'],
   ['float-bank', 'Bank floater', 'Bank float', 3, 'Off the glass from the angle. Aim high on the square.'],
   ['float-push', 'Push floater', 'Push float', 3, 'One-hand push from the chest on the gather. Quick, no wind-up.'],
   ['float-spin', 'Spin-back floater', 'Spin float', 2.4, 'Spin off the defender’s hip, land square, float it.'],
   ['float-drop', 'Floater in the drop', 'Drop float', 2.4, 'Off a ball screen: get into the gap in front of the dropping big and float it.'],
  ].forEach(function (x) { if (!SHOT_LIB[x[0]]) shotAdd(x[0], x[1], x[2], 'touch', 'float', x[3], x[4]); });
  shotAdd('pnr-3', 'Three off a ball screen (under)', 'PnR 3', 'move', '3', 2, 'They go under the screen: stop behind it and shoot.');

  /* ---------- Ball screens get their own group; floaters + ball screens are offered at every spot ---------- */
  if (!SHOT_FAMS.some(function (f) { return f.k === 'pnr'; })) SHOT_FAMS.splice(3, 0, { k: 'pnr', n: 'Ball screens', c: '#e9d98d', ic: 'shield' });
  SHOT_FAMS.forEach(function (f) { if (f.k === 'touch') f.n = 'Floaters & finishing'; });
  var FAM_ORDER = ['catch', 'move', 'pnr', 'touch', 'create', 'ft']; SHOT_FAMS.sort(function (a, b) { var x = FAM_ORDER.indexOf(a.k), y = FAM_ORDER.indexOf(b.k); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
  [['pnr-reject', 'Reject pull-up', 'Reject pull', '3 mid', 2.2, 'They jump the screen: reject it, attack the other way, pull up.'],
   ['pnr-snake', 'Snake pull-up', 'Snake pull', 'mid', 2, 'Come off the screen, snake back middle, pull up with the defender on your back.'],
   ['pnr-rescreen', 'Re-screen pull-up', 'Re-screen', '3 mid', 2, 'Retreat, the screen flips, come off the other way and pull.'],
  ].forEach(function (x) { if (!SHOT_LIB[x[0]]) shotAdd(x[0], x[1], x[2], 'pnr', x[3], x[4], x[5]); });
  ['pnr-pull', 'pnr-3', 'float-drop'].forEach(function (k) { if (SHOT_LIB[k]) SHOT_LIB[k].fam = 'pnr'; });
  var _stf = shotTypesFor;
  shotTypesFor = function (where) {
    var base = _stf(where); if (!where || where === 'ft') return base;
    Object.keys(SHOT_LIB).forEach(function (k) { var x = SHOT_LIB[k]; if (base.indexOf(k) < 0 && (x.fam === 'pnr' || (x.fam === 'touch' && x.where.indexOf('float') >= 0))) base.push(k); });
    return base;
  };
  /* a floater started from a three-point spot is recorded as a floater (keeps your 3P% honest) */
  var ZONE_OF = { float: 'Floater', mid: 'Midrange', rim: 'Rim', ft: 'Free throw' };
  var _sps = spSteps;
  spSteps = function (plan) { return _sps(plan).map(function (st) { var x = SHOT_LIB[st[1]], w = shotWhere(st[0]); if (x && w && x.where.indexOf(w) < 0) { var z = x.where[0] === '3' ? st[0] : (ZONE_OF[x.where[0]] || st[0]); return [z, st[1], st[2], st[3] + ' (attack)', st[4]]; } return st; }); };

  /* ---------- Spot Map: a middle floater spot + Floater menu fill ---------- */
  if (!spById('mf')) SPOTS.splice(SPOTS.length - 1, 0, { id: 'mf', n: 'Middle floater', x: 250, y: 132, zone: 'Floater', t: ['float'] });
  var fl = ['lf', 'mf', 'rf'];
  Object.assign(SP_CATS, { f1: { s: fl, t: 'float-1' }, f2: { s: fl, t: 'float-2' }, fEuro: { s: ['lf', 'rf'], t: 'float-euro' }, fHop: { s: fl, t: 'float-hop' }, fWrong: { s: ['lf', 'rf'], t: 'float-wrong' }, fTear: { s: ['mf'], t: 'float-tear' }, fBank: { s: ['lf', 'rf'], t: 'float-bank' }, fRun: { s: ['lf', 'rf'], t: 'runner' } });
  /* floaters and ball-screen shots show right on the spots (not hidden under "More shot types") */
  var setT = function (id, list) { var sp = spById(id); if (sp) sp.t = list; };
  var addT = function (id, k) { var sp = spById(id); if (sp && sp.t.indexOf(k) < 0) sp.t = sp.t.concat([k]); };
  setT('lf', ['float-1', 'float-2', 'float-euro', 'runner']); setT('rf', ['float-1', 'float-2', 'float-euro', 'runner']); setT('mf', ['float-2', 'float-tear', 'float-drop']);
  ['le', 're', 'tm'].forEach(function (id) { addT(id, 'pnr-pull'); });
  ['t3', 'lw3', 'rw3'].forEach(function (id) { addT(id, 'pnr-3'); });
  Object.assign(SP_CATS, { bsPull: { s: ['le', 're', 'tm'], t: 'pnr-pull' }, bs3: { s: ['t3', 'lw3', 'rw3'], t: 'pnr-3' }, bsFloat: { s: ['mf'], t: 'float-drop' } });
  if (!SP_PRESETS.some(function (p) { return p.id === 'ballscreen'; })) SP_PRESETS.push({ id: 'ballscreen', n: 'Ball-screen shooting', d: 'Pull-ups off the screen at the elbows and top, threes when they go under, floaters in the drop', w: { bsPull: 40, bs3: 30, bsFloat: 20, ft: 10 } });
  if (!SP_PRESETS.some(function (p) { return p.id === 'fullshoot'; })) SP_PRESETS.push({ id: 'fullshoot', n: 'Full shooting workout', d: 'Your feel-good mix plus floaters and ball-screen shots', w: { midCatch: 14, midMove: 12, midCut: 4, catch3: 18, move3: 8, f1: 6, f2: 4, fTear: 4, bsPull: 10, bs3: 6, bsFloat: 6, ft: 8 } });
  if (!SP_PRESETS.some(function (p) { return p.id === 'floaters'; })) SP_PRESETS.push({ id: 'floaters', n: 'Floater menu', d: 'One-foot, two-foot, euro, hop, wrong-foot, teardrop, bank and runners', w: { f1: 20, f2: 15, fEuro: 15, fHop: 10, fWrong: 10, fTear: 10, fBank: 10, fRun: 10 } });

  /* ---------- Shot Lab preset ---------- */
  if (!SHOT_PRESETS.some(function (p) { return p.id === 'floater-pkg'; })) SHOT_PRESETS.splice(1, 0, { id: 'floater-pkg', name: 'Floater Package', desc: 'Every floater type, both sides', steps: [['Floater', 'float-1', 10, 'Left floater'], ['Floater', 'float-1', 10, 'Right floater'], ['Floater', 'float-2', 10, 'Middle floater'], ['Floater', 'float-euro', 8, 'Left floater'], ['Floater', 'float-hop', 8, 'Right floater'], ['Floater', 'float-wrong', 8, 'Left floater'], ['Floater', 'float-tear', 8, 'Middle floater'], ['Floater', 'float-bank', 8, 'Right floater'], ['Floater', 'runner', 10, 'Left floater']] });

  /* ---------- Workout Writer: read floater + ball-screen names ---------- */
  var FL_ALIAS = [[/one[\s-]?foot(ed)? float/, 'float-1'], [/two[\s-]?foot(ed)? float/, 'float-2'], [/euro[\s-]?(step )?float/, 'float-euro'], [/hop[\s-]?(step )?float/, 'float-hop'], [/wrong[\s-]?foot(ed)? float/, 'float-wrong'], [/tear[\s-]?drop/, 'float-tear'], [/bank[\s-]?float/, 'float-bank'], [/push[\s-]?float/, 'float-push'], [/spin[\s-]?(back )?float/, 'float-spin'], [/(drop|pnr|ball[\s-]?screen|pick[\s-]?(and|&|n)[\s-]?roll)[\s-]?float/, 'float-drop'], [/(pnr|ball[\s-]?screen|pick[\s-]?(and|&|n)[\s-]?roll)[\s-]?(3|three)/, 'pnr-3'], [/(pnr|ball[\s-]?screen|pick[\s-]?(and|&|n)[\s-]?roll)[\s-]?pull/, 'pnr-pull']];
  var _wso = wrShotOf; wrShotOf = function (t) { for (var i = 0; i < FL_ALIAS.length; i++) if (FL_ALIAS[i][0].test(t)) return FL_ALIAS[i][1]; return _wso(t); };

  /* ---------- Build for me: floater drills + Ball Screens area ---------- */
  BM_AREAS['Ball Screens'] = { ic: 'shield', subs: [['reads', 'Coverage reads'], ['pull', 'Pull-ups off the screen'], ['attack', 'Getting downhill'], ['reject', 'Reject & re-screen'], ['pass', 'Passing reads'], ['snake', 'Snake & split']] };
  BM_CONS['Ball Screens'] = ['Coverage called late, right at the screen', 'Two dribbles max after the screen', 'Use the screen going to your weak hand', 'Partner (or chair) trails from behind', 'Score in 4 seconds from the screen', 'Hesitation before you use the screen'];
  BM_CONS.Finishing.push('New floater type every rep (1-foot, 2-foot, euro, teardrop, bank)');
  var add = [
    ['bm-float-wheel', 'Floater Type Wheel', 'Finishing', 'float touch', 4, 'h', 'variable', 'Rotate every rep: one-foot, two-foot, euro, hop-step, teardrop, bank. Both sides. Never the same floater twice in a row.', 'Same soft release, different feet.', 'float'],
    ['bm-float-tempo', 'Floater Tempo Changes', 'Finishing', 'float speed', 3, 'h', 'speed', 'Rep 1: slow approach, early release from far. Rep 2: full speed, late release close. Keep switching.', 'Release before the help gets there.', 'float-1'],
    ['bm-float-wrongfoot', 'Wrong-Foot & Euro Floaters', 'Finishing', 'float footwork', 3, 'h', 'variable', 'Alternate wrong-foot floaters and euro floaters from both lanes. A chair or pad in the lane as the help.', 'Change the timing, not the touch.', 'float-wrong'],
    ['bm-float-bank', 'Bank Floater Angles', 'Finishing', 'float touch', 3, 'h', 'touch', 'Bank floaters from the short corner, the block and the lane line, both sides. Find the spot on the glass from each angle.', 'Aim high on the square.', 'float-bank'],
    ['bm-teardrop-ladder', 'Teardrop Ladder', 'Finishing', 'float touch', 3, 'h', 'touch', 'Teardrops from 6, 9 and 12 feet over a raised hand (partner, stick, or chair with a ball on top). Two makes at each, then back up.', 'Higher arc, softer hands.', 'float-tear'],
    /* ball screens */
    ['bm-pnr-coverage', 'Coverage Call Reads', 'Ball Screens', 'reads', 5, 'h', 'reactive', 'Chair (or partner) sets a ball screen at the top. Before each rep a partner, voice note or shuffled card calls the coverage: Drop = pull-up or floater in the gap. Hedge/Show = retreat, then re-attack or split. Switch = attack the big (step-back or blow-by). Under = stop behind the screen and shoot. Ice = reject baseline or come back middle for the pull.', 'Read the big’s feet, not his hands.', 'pnr-pull'],
    ['bm-pnr-drop-pull', 'Pull-Up in the Drop', 'Ball Screens', 'pull reads', 4, 'h', 'speed', 'Come off the screen tight (shoulder to the screener’s hip), one or two dribbles, pull up at the elbow or free-throw line before the dropping big. Both sides.', 'Tight off the screen, sit into the pull.', 'pnr-pull'],
    ['bm-pnr-under-3', 'Under the Screen? Shoot It', 'Ball Screens', 'pull reads', 3, 'h', 'reactive', 'Set up the screen. When the coverage call is “under” (or on a coin flip), stop behind the screen and shoot the three. Otherwise attack.', 'Feet set behind the screen before the ball goes up.', 'pnr-3'],
    ['bm-pnr-drop-float', 'Floater in the Drop', 'Ball Screens', 'attack reads', 4, 'h', 'reactive', 'Come off the screen, get into the gap in front of the big. Pull-up if he stays back, floater if he steps up, finish if he’s late. Use different floater types.', 'Decide in the gap.', 'float-drop'],
    ['bm-pnr-snake', 'Snake Dribble Attack', 'Ball Screens', 'snake attack', 4, 'h', 'variable', 'Come off the screen, snake back to the middle (dribble across the screener’s path), then finish, float or pull. Keep the defender on your back.', 'Body between the defender and the ball.', 'layup'],
    ['bm-pnr-split', 'Split the Hedge', 'Ball Screens', 'snake attack', 3, 'h', 'tight', 'Two chairs side by side as the hedge. Low, quick split dribble through the gap, then explode to the rim.', 'Low and quick, protect the ball.', 'layup'],
    ['bm-pnr-reject', 'Reject the Screen', 'Ball Screens', 'reject reads', 3, 'h', 'reactive', 'Set up to use the screen. When the call is “over the top” or “ice”, reject it and attack the other way: finish or pull-up.', 'Sell the screen first.', 'move'],
    ['bm-pnr-rescreen', 'Re-Screen Reads', 'Ball Screens', 'reject', 4, 'h', 'variable', 'Use the screen, retreat two dribbles, the screen flips (move the chair or partner re-screens), attack the other way. Read it again.', 'Patience: make the defense move twice.', 'pnr-pull'],
    ['bm-pnr-downhill', 'Turn the Corner', 'Ball Screens', 'attack', 3, 'h', 'speed', 'Come off the screen and turn the corner, two dribbles max to the rim. Finish with whatever the angle gives you.', 'First step past the screener’s hip.', 'layup'],
    ['bm-pnr-kick', 'Kick When They Tag', 'Ball Screens', 'pass reads', 3, 'h', 'reactive', 'Off the screen, attack. On a call of “tag” (or a coin flip), kick to the corner: throw to a wall target, rebounder or partner. Otherwise score.', 'See the help before you get there.', ''],
    ['bm-pnr-pocket', 'Pocket & Lob Reads', 'Ball Screens', 'pass', 4, 'hp', 'reactive', 'Partner sets the screen and rolls. Big drops = pocket bounce pass. Big jumps out = lob. Help tags the roller = skip to the corner.', 'Pass with the hand away from the defender.', ''],
    ['bm-pnr-switch', 'Attack the Switch', 'Ball Screens', 'attack reads', 4, 'hp', 'tight', 'Partner plays the switched big. Isolate: step-back, blow-by or pull-up, three dribbles max.', 'Make the big move his feet.', 'move'],
    ['bm-pnr-footwork', 'Ball-Screen Footwork Shadow', 'Ball Screens', 'reads snake reject', 3, 'n', 'variable', 'No hoop: chair as the screen. Rep coming off tight, snake, retreat, reject and re-screen footwork at game speed. No shot.', 'Shoulder to the screener’s hip.', ''],
    ['bm-pnr-game', 'Ball-Screen Read Game', 'Ball Screens', 'compete', 5, 'h', 'compete', 'Random coverage every rep. Right read + make = 2, right read + miss = 1, wrong read = 0. Play to 12. Beat your time.', 'Read first, then score.', 'pnr-pull', 'Play to 12. Right read + make = 2.'],
  ];
  add.forEach(function (x) {
    if (BM_DRILLS.some(function (d) { return d.id === 'd-' + x[0]; })) return;
    var d = { id: 'd-' + x[0], slug: x[0], name: x[1], area: x[2], subs: x[3].split(' '), mins: x[4], hoop: x[5].indexOf('h') >= 0, noHoopOnly: x[5].indexOf('n') >= 0, partner: x[5].indexOf('p') >= 0, bam: false, grp: 'd-' + x[0], pr: x[6], how: x[7], cue: x[8], shot: x[9] || null, fmt: x[10] || '' };
    BM_DRILLS.push(d);
    var cat = d.area === 'Ball Screens' ? 'Pick-and-Roll' : d.area, makes = !!d.shot || d.area === 'Finishing' || d.area === 'Shooting';
    if (!DRILLS.some(function (q) { return q.id === d.id; })) DRILLS.push(DR({ slug: d.slug, name: d.name, cat: cat, diff: 3, min: Math.ceil(d.mins), sets: 1, att: makes ? Math.round(d.mins * 2.5) : Math.round(d.mins * 6), metric: makes ? 'makes' : 'reps', obj: BM_PRINCIPLES[d.pr][0] + '.', ins: d.how, coach: [d.cue], eq: d.hoop ? ['Ball', 'Hoop', 'Chair'] : ['Ball', 'Chair'], partner: d.partner }));
    if (typeof MODE_MAP === 'object') MODE_MAP[d.id] = bmStage(d) >= 2 ? ['game', 'skill'] : ['skill'];
  });
  /* runner items: ball-screen drills count as Pick-and-Roll; passing reads are reps, not makes */
  var _bi = bmItems;
  bmItems = function (s) { return _bi(s).map(function (i) { var d = bmById(i.drillId); if (d && d.area === 'Ball Screens') { i.category = 'Pick-and-Roll'; if (!d.shot) { i.metric = 'reps'; i.targetAttempts = 1; } } return i; }); };
  /* a drill goes to the section that is its main topic first (its first tag) */
  var _pool = bmPool; bmPool = function (st, area, sub, used) { st._sub = sub; return _pool(st, area, sub, used); };
  var _fav = bmFavFirst; bmFavFirst = function (st, list) { var sub = st._sub; var r = _fav(st, list); return sub ? r.map(function (d, i) { return [d, i]; }).sort(function (a, b) { return ((b[0].subs[0] === sub) - (a[0].subs[0] === sub)) || a[1] - b[1]; }).map(function (x) { return x[0]; }) : r; };
  var _fmt = bmFmt; bmFmt = function (d, m) { if (d && d.area === 'Ball Screens' && !d.shot && !d.fmt) return Math.max(6, Math.round(m * 3)) + ' reads · right read every rep'; return _fmt(d, m); };
  if (!BM_QUICK.some(function (q) { return q.n === 'Ball-screen reads'; })) BM_QUICK.splice(2, 0, { n: 'Ball-screen reads', d: '45 min · game-like', o: { mins: 45, int: 'hard', hoop: true, areas: ['Ball Screens', 'Finishing'], subs: { 'Ball Screens': ['reads', 'pull', 'attack'], Finishing: ['float'] } } });
  if (!BM_QUICK.some(function (q) { return q.n === 'Floater day'; })) BM_QUICK.splice(3, 0, { n: 'Floater day', d: '30 min · every floater', o: { mins: 30, int: 'med', hoop: true, areas: ['Finishing'], subs: { Finishing: ['float', 'touch'] } } });
  render();
})();
