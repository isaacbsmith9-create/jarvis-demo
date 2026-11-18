// ===================== scenarios =====================
// Every scenario is plain data. Positions are court feet (see engine.js). O1 is you (PG), O2 SG, O3 SF, O4 PF, O5 C;
// D1..D5 start on the same numbers. "setup" beats play before the decision; "drift" is what the defense keeps doing
// while you think (live mode plays it in slow motion during the decision window).
// Option fields: kind (shot|pass|drive|reset), target (teammate for passes), read/q/sp (0-100 scores for reading the
// defense, quality of the action, and what it does to spacing), make (probability the final shot goes in),
// tov (turnover probability) with risky (defender who jumps the pass) or strip (defender who pokes the dribble) or
// clock:true (shot-clock violation), beats (what happens), good/miss (feedback).

const mv = (d, m, cap, x = {}) => ({ d, m, cap, ...x });
const pass = (a, b, d = 0.5, m = {}, x = {}) => ({ d, m, ball: { pass: [a, b], ...(x.lob ? { lob: 1 } : {}), ...(x.bounce ? { bounce: 1 } : {}) }, risky: x.risky, cap: x.cap || (x.lob ? 'Lob' : x.bounce ? 'Bounce pass' : 'Pass') });
const shoot = (id, d = 1, m = {}, x = {}) => ({ d, m, ball: { shot: id, three: !!x.three }, reb: x.reb, rebSpot: x.rebSpot, cap: x.cap || (x.three ? 'Three' : 'Shot') });

// 4-out spread with the five at the elbow; the ball handler will come off a high screen toward the strong (left) side.
const spread = () => ({
  O1: [2, 33.5], D1: [2, 30.6], O2: [22, 3.5], D2: [18.8, 5.8], O3: [-22, 3.5], D3: [-19.4, 5.4],
  O4: [21, 19], D4: [17.6, 17.4], O5: [-8, 19], D5: [-5.6, 16],
});
const SCREEN = (d5, cap = 'Five sets the ball screen') => mv(0.9, { O5: [-1.2, 30.9], O1: [2.6, 33.6], D1: [2.4, 30.9], D5: d5 }, cap, { screen: 'O5', screenOn: 'D1' });
const RESET = (cap = 'Reset the offense') => [mv(1.0, { O1: [-9, 30], D1: [-8, 27.4], O5: [-5, 22], D5: [-4, 18] }, cap)];

const SCENARIOS = [
  // ---------------------------------------------------------------- PnR vs drop
  {
    id: 'drop-pullup', setting: 'High pick-and-roll', title: 'Drop: Take the Pull-Up', cat: 'pnr', topic: 'drop', coverage: 'Drop', quiz: 'Drop', diff: 1, clock: 16,
    brief: 'High pick-and-roll. Watch where the big goes when you come off the screen.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3.5, 21.5]),
      mv(1.0, { O1: [-6.5, 27.6], D1: [0.6, 30.2], O5: [-1.6, 25], D5: [-3.8, 18.5] }, 'Over the screen'),
      mv(0.75, { O1: [-8.6, 21.2], D1: [-4.2, 26.8], O5: [-1.6, 15.5], D5: [-4.2, 14.6], D2: [16.5, 6.2] }, 'The big drops'),
    ],
    decision: {
      prompt: 'The big is sitting back. Your man is trailing. What\'s the play?', window: 3.2,
      drift: { d: 1.0, m: { O1: [-8.6, 19.6], D1: [-7, 22.8], D5: [-6, 16.6], O5: [-1, 9.5] } },
      options: [
        { id: 'pullup', kind: 'shot', label: 'Pull-up jumper', read: 95, q: 95, sp: 80, make: 0.5,
          beats: [mv(0.25, { O1: [-8.6, 19.4] }, 'Rise up'), shoot('O1', 1.05, { D5: [-7.2, 17.4], D1: [-7.6, 21] }, { cap: 'Pull-up jumper', reb: 'D5' })],
          good: 'You read the drop. The big sat at the free-throw line and gave you a clean 17-footer before your man could recover.' },
        { id: 'floater', kind: 'drive', label: 'Drive at the big', to: [-5, 12.5], read: 60, q: 55, sp: 65, make: 0.38,
          beats: [mv(0.55, { O1: [-5, 12.5], D5: [-4.6, 10.8], D1: [-6.2, 15.5], O5: [1.5, 7] }, 'Drive at the big'), shoot('O1', 0.95, {}, { cap: 'Floater over the big', reb: 'D5' })],
          good: 'Attacking downhill kept pressure on the defense.', miss: 'You drove into the big. A drop wants you in the paint; the open space was at the pull-up spot.' },
        { id: 'roll', kind: 'pass', target: 'O5', label: 'Bounce pass to the roller', read: 40, q: 40, sp: 60, make: 0.55, tov: 0.32,
          beats: [pass('O1', 'O5', 0.5, { O5: [-1, 8], D5: [-4, 11] }, { bounce: 1, risky: 'D5' }), shoot('O5', 0.8, { D5: [-2.2, 8.5] }, { cap: 'Roll finish', reb: 'D5' })],
          miss: 'The big was sitting between you and the roller. That pass goes straight into the drop defender\'s hands.' },
        { id: 'corner', kind: 'pass', target: 'O3', label: 'Kick to the corner', read: 30, q: 30, sp: 70, make: 0.3,
          beats: [pass('O1', 'O3', 0.65, { D3: [-21, 5.5] }), shoot('O3', 1.0, {}, { three: 1, cap: 'Contested corner three' })],
          miss: 'The corner defender never left. Kicking to a covered shooter gives back the advantage the screen created.' },
        { id: 'reset', kind: 'reset', label: 'Reset the offense', read: 35, q: 35, sp: 60, beats: RESET(),
          miss: 'You had an open pull-up and gave it back. Resetting burns clock and lets the defense recover.' },
      ],
    },
    bestWhy: 'In drop, the big protects the rim and concedes the mid-range. The elbow pull-up is the shot the coverage gives you.',
    defense: 'Drop coverage. X5 sat back near the free-throw line to protect the rim while X1 chased over the screen from behind. Nobody could contest a pull-up without leaving the roller.',
    lesson: 'Versus drop: come off the screen tight, get two feet into the pull-up pocket (15–18 ft) and rise before the trailing defender recovers. If the big steps up to you, the lob or pocket pass to the roller opens.',
    keys: ['Big below the free-throw line = drop.', 'Is your man trailing behind you? Then you have a window.', 'Pull-up pocket: 15–18 ft, between the big and the screen.'],
  },
  {
    id: 'snake-drop', setting: 'High pick-and-roll', title: 'Snake the Drop', cat: 'pnr', topic: 'snake', coverage: 'Drop (strong chase)', quiz: 'Drop', diff: 2, clock: 15,
    brief: 'Same drop coverage, but your defender fights over the screen fast. Feel where he is.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3.5, 21.5]),
      mv(1.0, { O1: [-6.5, 27.6], D1: [-3.6, 29.4], O5: [-1.6, 25], D5: [-4, 18.8] }, 'X1 fights over the top'),
      mv(0.7, { O1: [-9.2, 23], D1: [-7.6, 25.4], O5: [-1.6, 16.5], D5: [-4.6, 16] }, 'Drop, with X1 on your hip'),
    ],
    decision: {
      prompt: 'Your defender is on your hip and the big is in the paint. Beat both.', window: 3.0,
      drift: { d: 0.9, m: { O1: [-10.2, 21.4], D1: [-9, 23.5], D5: [-5.6, 15.4], O5: [-1, 11] } },
      options: [
        { id: 'snake', kind: 'drive', label: 'Snake back to the middle', to: [-3.2, 17.2], read: 92, q: 92, sp: 85, make: 0.68,
          beats: [mv(0.7, { O1: [-3.2, 17.2], D1: [-6.8, 21.6], D5: [-3, 13.6], O5: [2.5, 8.5] }, 'Snake back to the middle'), pass('O1', 'O5', 0.55, { O5: [2.2, 6.8], D5: [-1.4, 11.4] }, { lob: 1, cap: 'Lob over the top' }), shoot('O5', 0.75, {}, { cap: 'Lob finish', reb: 'D5' })],
          good: 'You snaked back across the screen and put X1 on your back. X5 had to stop you, and the lob opened over his shoulder.' },
        { id: 'pullup', kind: 'shot', label: 'Pull-up jumper now', read: 55, q: 50, sp: 70, make: 0.34,
          beats: [shoot('O1', 1.05, { D1: [-9.6, 22.2], D5: [-7, 17] }, { cap: 'Contested pull-up', reb: 'D5' })],
          good: 'You recognized the drop and looked for the pull-up.', miss: 'X1 recovered over the top and was on your hip. A pull-up with a trailing defender gets blocked from behind or rushed.' },
        { id: 'baseline', kind: 'drive', label: 'Drive baseline', to: [-9, 10], read: 45, q: 40, sp: 50, make: 0.3,
          beats: [mv(0.6, { O1: [-9, 10], D5: [-7, 9.5], D1: [-10.5, 15], O5: [0, 7.5], D3: [-15, 6] }, 'Baseline drive'), shoot('O1', 0.9, {}, { cap: 'Tough baseline finish', reb: 'D5' })],
          miss: 'Driving baseline took you into the big and the corner help at a bad angle.' },
        { id: 'corner', kind: 'pass', target: 'O3', label: 'Kick to the corner', read: 30, q: 30, sp: 70, make: 0.3,
          beats: [pass('O1', 'O3', 0.65, { D3: [-21, 5.4] }), shoot('O3', 1.0, {}, { three: 1, cap: 'Contested corner three' })],
          miss: 'X3 stayed home. The advantage was in the middle of the floor, not the corner.' },
        { id: 'reset', kind: 'reset', label: 'Reset the offense', read: 40, q: 35, sp: 60, beats: RESET(), miss: 'Resetting wasted a 2-on-1 against the drop big.' },
      ],
    },
    bestWhy: 'Snaking keeps the chasing guard behind you and turns the drop into a 2-on-1 against X5: if he stays with the roller you get a floater, if he steps up the lob is open.',
    defense: 'Drop with a strong chase. X1 fought over the screen and stayed on your hip, so the pull-up window closed. X5 sat in the paint alone against two players.',
    lesson: 'Snake: come off the screen, then dribble back across the screener\'s path to the middle. The chasing guard is stuck on your back, and the big must guard two people.',
    keys: ['Defender on your hip = the pull-up is gone.', 'Snake back to the middle; keep him behind you.', 'Read the big: he steps up, you throw the lob.'],
  },
  // ---------------------------------------------------------------- PnR vs switch
  {
    id: 'switch-punish', setting: 'High pick-and-roll', title: 'Switch: Punish the Big', cat: 'pnr', topic: 'switch', coverage: 'Switch', quiz: 'Switch', diff: 1, clock: 14,
    brief: 'They switch everything. See who ends up guarding you.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3.2, 27.5]),
      mv(0.9, { O1: [-5.5, 28.5], D5: [-6.4, 26], D1: [-1.4, 28], O5: [-2, 24.5] }, 'Switch: the big picks you up'),
      mv(0.8, { O1: [-10, 27], D5: [-9.6, 23.4], O5: [-3.5, 15], D1: [-3.2, 17.5], D2: [14, 7] }, 'Big on the ball, guard fronting the roll'),
    ],
    decision: {
      prompt: 'A slow big is on you in space, and X1 is fronting the roll. Your move.', window: 3.2,
      drift: { d: 1.0, m: { D5: [-9.8, 24.2], O1: [-10.4, 26.6], O5: [-4, 12], D1: [-4.6, 14.5], D2: [10, 7.5] } },
      options: [
        { id: 'attack', kind: 'drive', label: 'Attack the big off the dribble', to: [-6.8, 12], read: 92, q: 92, sp: 85, make: 0.6,
          beats: [mv(0.35, { O1: [-11.6, 25.6] }, 'Hesitation'), mv(0.6, { O1: [-6.8, 12], D5: [-9.6, 17.5], D2: [-1, 7.5], D1: [-4.6, 13] }, 'Blow by the big'), shoot('O1', 0.85, {}, { cap: 'Layup vs. late help', reb: 'D2' })],
          good: 'You saw the switch and went right at the slower defender in open space. That\'s exactly what the switch gives up.' },
        { id: 'stepback', kind: 'shot', label: 'Step-back three', read: 72, q: 66, sp: 75, make: 0.36,
          beats: [mv(0.4, { O1: [-12.2, 27.6] }, 'Step-back'), shoot('O1', 1.1, { D5: [-11.2, 25.4] }, { three: 1, cap: 'Step-back three', reb: 'D1' })],
          good: 'You recognized the switch and went at the big.', miss: 'A step-back three is a fine counter, but a slow big on an island gives you a straight-line drive. A layup beats a contested three.' },
        { id: 'post', kind: 'pass', target: 'O5', label: 'Post entry to Five', read: 38, q: 35, sp: 55, make: 0.55, tov: 0.38,
          beats: [pass('O1', 'O5', 0.55, { O5: [-4.2, 12.5] }, { risky: 'D1' }), shoot('O5', 0.85, {}, { cap: 'Post finish', reb: 'D2' })],
          miss: 'X1 was fronting the roll with X2 sinking behind him. A post entry into a front with help behind it is a turnover waiting to happen.' },
        { id: 'swing', kind: 'pass', target: 'O4', label: 'Swing to the wing', read: 40, q: 40, sp: 70, make: 0.33,
          beats: [pass('O1', 'O4', 0.8, { D4: [19, 18.4] }), shoot('O4', 1.0, {}, { three: 1, cap: 'Contested wing three' })],
          miss: 'Swinging it away from the mismatch let the defense scramble back to a normal matchup.' },
        { id: 'reset', kind: 'reset', label: 'Call for a re-screen', read: 30, q: 30, sp: 60, beats: RESET('Re-screen'), miss: 'The switch already gave you the matchup you want. Re-screening throws it away.' },
      ],
    },
    bestWhy: 'After a switch, the advantage is the mismatch. A big guarding a guard in space can\'t stay in front: attack him in a straight line before the help is set.',
    defense: 'Switch. X5 took you and X1 took the roller. X1 fronted the roll with X2 sinking behind, so the post was covered, but X5 was alone on an island at the three-point line.',
    lesson: 'Versus switches: identify the mismatch the moment it happens. Big on you: attack downhill or make him guard a step-back. Small on the screener: feed the seal (next lesson).',
    keys: ['Count the switch: who is on you now?', 'Big on you = attack in a straight line.', 'Front + help behind = don\'t force the post.'],
  },
  {
    id: 'switch-seal', setting: 'High pick-and-roll', title: 'Switch: Feed the Seal', cat: 'pnr', topic: 'switch', coverage: 'Switch', quiz: 'Switch', diff: 2, clock: 13,
    brief: 'Another switch, but this time the big crowds you. Look inside.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3.2, 27.5]),
      mv(0.9, { O1: [-5.5, 28.5], D5: [-6.2, 26.4], D1: [-1.6, 27.6], O5: [-2.4, 23] }, 'Switch'),
      mv(0.9, { O1: [-11, 26.5], D5: [-10.4, 24.6], O5: [-6.4, 10.5], D1: [-3.5, 13], D2: [18, 6], D4: [17.5, 17.4] }, 'Five seals the smaller guard'),
    ],
    decision: {
      prompt: 'The big is up on you. Five has the guard pinned on his back.', window: 3.0,
      drift: { d: 0.9, m: { O5: [-6.8, 9.6], D1: [-4, 12.4], D2: [15, 6.5], D5: [-10.6, 24.8] } },
      options: [
        { id: 'seal', kind: 'pass', target: 'O5', label: 'Feed the seal', read: 95, q: 95, sp: 85, make: 0.64,
          beats: [pass('O1', 'O5', 0.5, { O5: [-6.6, 9] }), mv(0.4, { O5: [-4.4, 7.4], D1: [-3.6, 10] }, 'Drop step'), shoot('O5', 0.8, {}, { cap: 'Finish over the guard', reb: 'D2' })],
          good: 'You saw the seal. Five had a guard on his back deep in the paint, and the weak side stayed home on shooters.' },
        { id: 'drive', kind: 'drive', label: 'Drive the big', to: [-8, 13], read: 50, q: 50, sp: 60, make: 0.4,
          beats: [mv(0.65, { O1: [-8, 13], D5: [-8.6, 15.4], O5: [-4, 8], D1: [-4.4, 10.2] }, 'Drive into traffic'), shoot('O1', 0.85, {}, { cap: 'Contested runner', reb: 'D1' })],
          good: 'Attacking the big is a reasonable idea after a switch.', miss: 'X5 was up and set, and your drive brought you into Five\'s seal. The mismatch was inside.' },
        { id: 'three', kind: 'shot', label: 'Pull-up three over the big', read: 35, q: 30, sp: 70, make: 0.28,
          beats: [shoot('O1', 1.1, { D5: [-10.8, 25.4] }, { three: 1, cap: 'Contested three', reb: 'D1' })],
          miss: 'X5 was crowding you. A contested three ignores a guard getting buried in the post.' },
        { id: 'swing', kind: 'pass', target: 'O4', label: 'Swing to the wing', read: 40, q: 40, sp: 70, make: 0.33,
          beats: [pass('O1', 'O4', 0.85, { D4: [19, 18.4] }), shoot('O4', 1.0, {}, { three: 1, cap: 'Contested wing three' })],
          miss: 'The seal only lasts a second. Swinging away lets X1 fight back around.' },
      ],
    },
    floorNote: 'Five shows as tight because a defender is touching him, but that defender is a guard pinned on his back. Size beats separation here.',
    bestWhy: 'A switch puts a guard on your center. When the big seals him deep and the weak side stays home, the entry pass is a layup.',
    defense: 'Switch with the big pressuring the ball. X5 crowded you to take away the three, and X1 got sealed under the basket by a much bigger player.',
    lesson: 'When the big crowds you after a switch, look inside. Make the entry from a good angle (wing or slot), away from the defender\'s hand, as soon as the seal is made.',
    keys: ['Big crowding you = look inside.', 'Seal = defender pinned on the screener\'s back.', 'Throw it early, away from the defender.'],
  },
  {
    id: 'early-switch-slip', setting: 'High pick-and-roll', title: 'Early Switch: Slip It', cat: 'pnr', topic: 'switch', coverage: 'Early switch', quiz: 'Switch', diff: 2, clock: 17,
    brief: 'The defense talks early. Watch the two defenders before the screen arrives.',
    pos: { ...spread(), D5: [-5, 18] }, ball: 'O1',
    setup: [
      mv(0.8, { O5: [-2.6, 28.6], D5: [-1.2, 28.6], O1: [2.4, 33.6], D1: [2.2, 30.8] }, 'The defense calls the switch early'),
      mv(0.6, { O5: [-1.6, 23], D5: [2.8, 31.8], D1: [-4.2, 27.6], O1: [2.6, 33.8] }, 'Five slips before contact'),
    ],
    decision: {
      prompt: 'They switched before the screen. Five is slipping to the rim.', window: 2.8,
      drift: { d: 0.9, m: { O5: [-1, 15], D1: [-2.6, 20.5], D2: [11, 8], D5: [3, 31.6] } },
      options: [
        { id: 'slip', kind: 'pass', target: 'O5', label: 'Hit the slip', read: 95, q: 92, sp: 85, make: 0.64,
          beats: [pass('O1', 'O5', 0.55, { O5: [-0.8, 11.5], D1: [-1.8, 16.5], D2: [6, 8] }), shoot('O5', 0.8, { D2: [2, 7.5] }, { cap: 'Slip finish', reb: 'D2' })],
          good: 'You read the early switch and hit the slip before X1 could catch up. The screener was open the moment the defenders committed.' },
        { id: 'drive', kind: 'drive', label: 'Drive the big', to: [7, 16], read: 55, q: 55, sp: 65, make: 0.38,
          beats: [mv(0.7, { O1: [7, 16], D5: [6, 18.4], O5: [-2, 10], D1: [-1.6, 13] }, 'Drive the switched big'), shoot('O1', 0.85, {}, { cap: 'Contested runner', reb: 'D5' })],
          good: 'Attacking the big is a sound idea after any switch.', miss: 'X5 jumped out early and was set. The cleaner advantage was Five slipping behind the defense.' },
        { id: 'three', kind: 'shot', label: 'Pull-up three', read: 40, q: 35, sp: 70, make: 0.3,
          beats: [shoot('O1', 1.1, { D5: [2.8, 32.6] }, { three: 1, cap: 'Contested three', reb: 'D1' })],
          miss: 'A contested pull-up with X5 already on your chest ignores the open roll man.' },
        { id: 'wait', kind: 'reset', label: 'Wait for the screen', read: 25, q: 25, sp: 55, beats: [mv(1.0, { O1: [3, 34], O5: [-1, 17] }, 'Waiting for a screen that never comes')],
          miss: 'The screen was never coming. Five slipped because the defense switched early; waiting killed the advantage.' },
      ],
    },
    bestWhy: 'When defenders switch before the screen, the screener slips to the rim and the new defender is behind him. One pass beats the switch.',
    defense: 'Early switch. X5 jumped out to you before the screen was set, and X1 had to chase Five from behind.',
    lesson: 'Watch both defenders as the screen comes. If they swap early, your big slips and you pass immediately. Don\'t wait for contact that will never happen.',
    keys: ['Defenders swapping before contact = early switch.', 'Screener slips; new defender is behind him.', 'Pass on time, not late.'],
  },
  // ---------------------------------------------------------------- blitz
  {
    id: 'blitz-short-roll', setting: 'High pick-and-roll', title: 'Blitz: Hit the Short Roll', cat: 'pnr', topic: 'blitz', coverage: 'Blitz / trap', quiz: 'Blitz', diff: 2, clock: 15,
    brief: 'They\'re sending two at you. Keep your eyes up.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3.2, 28.2]),
      mv(0.8, { O1: [-3.6, 32], D5: [-5.2, 30.3], D1: [-1.6, 33.9], O5: [-1, 25.5], D2: [10, 9], D4: [12, 19], D3: [-18.5, 6.5] }, 'Blitz: two on the ball'),
    ],
    decision: {
      prompt: 'Two defenders on you. Five is short-rolling into the middle.', window: 2.8,
      drift: { d: 0.9, m: { O1: [-4.4, 33.4], D5: [-5.8, 31.5], D1: [-2.8, 34.8], O5: [-0.8, 22.5], D4: [7, 21] } },
      options: [
        { id: 'short', kind: 'pass', target: 'O5', label: 'Pass to the short roll', read: 95, q: 95, sp: 92, make: 0.43,
          beats: [pass('O1', 'O5', 0.5, { O5: [-0.8, 23], D4: [5, 20] }), mv(0.5, { O5: [-0.4, 19.5], D2: [4, 10], D4: [3, 18] }, 'Four-on-three: Five attacks'), pass('O5', 'O2', 0.65, { O2: [22, 4.5] }), shoot('O2', 1.0, { D2: [17, 6] }, { three: 1, cap: 'Open corner three', reb: 'D4' })],
          good: 'You beat the trap with one pass. Five caught it in the middle with a 4-on-3, drew the low man and found the open corner.' },
        { id: 'split', kind: 'drive', label: 'Split the trap', to: [-3.2, 27], read: 30, q: 30, sp: 50, make: 0.45, tov: 0.42, strip: 'D5',
          beats: [mv(0.5, { O1: [-3.2, 28.4], D5: [-4, 29.8], D1: [-2.4, 31] }, 'Split the trap'), mv(0.55, { O1: [-2, 12], D2: [0, 9] }, 'Into the paint'), shoot('O1', 0.85, {}, { cap: 'Layup in traffic', reb: 'D2' })],
          miss: 'Splitting a blitz means dribbling between four hands. The trap is built to strip that.' },
        { id: 'retreat', kind: 'reset', label: 'Retreat dribble', read: 55, q: 50, sp: 65,
          beats: [mv(0.9, { O1: [-7, 40], D1: [-5.5, 37], D5: [-6.5, 35.5] }, 'Retreat dribble')],
          good: 'Retreating out of the trap kept the ball safe.', miss: 'Safe, but the trap left Five open on the short roll. Retreating gives the defense time to recover.' },
        { id: 'skip', kind: 'pass', target: 'O4', label: 'Skip over the top', read: 55, q: 50, sp: 80, make: 0.4, tov: 0.3,
          beats: [pass('O1', 'O4', 0.85, {}, { lob: 1, risky: 'D4' }), shoot('O4', 1.0, {}, { three: 1, cap: 'Wing three', reb: 'D5' })],
          good: 'Getting the ball out of the trap was the right idea.', miss: 'A long skip out of a trap is the pass the rotating defense wants to jump. The short roll was right in front of you.' },
        { id: 'force', kind: 'shot', label: 'Shoot over the trap', read: 15, q: 15, sp: 50, make: 0.15,
          beats: [shoot('O1', 1.15, { D5: [-4.6, 31.4], D1: [-3, 33] }, { three: 1, cap: 'Shot over two defenders', reb: 'D4' })],
          miss: 'Two defenders were on you. A blitz means someone else is open; shooting into it is the worst result.' },
      ],
    },
    bestWhy: 'A blitz puts two defenders on the ball, so the offense has 4-on-3 behind it. The short roll catches in the middle and attacks the rotation.',
    defense: 'Blitz (trap). X5 and X1 both jumped the ball above the three-point line. X4 and X2 zoned up behind it, guarding three players with two.',
    lesson: 'Versus a blitz: don\'t pick up your dribble, retreat a step to widen the trap, and hit the short roll in the middle. Your big then makes the 4-on-3 read: shot, roll, or kick to the corner.',
    keys: ['Two on the ball = 4-on-3 behind it.', 'Retreat one step to open the passing angle.', 'Short roll at the free-throw line is the outlet.'],
  },
  // ---------------------------------------------------------------- hedge / show
  {
    id: 'hedge-recover', setting: 'High pick-and-roll', title: 'Hedge: Attack the Recovery', cat: 'pnr', topic: 'hedge', coverage: 'Hedge and recover', quiz: 'Hedge / show', diff: 2, clock: 14,
    brief: 'The big jumps out to slow you down, then has to get back. Time it.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-2.6, 28.4]),
      mv(0.8, { O1: [-4, 30.4], D5: [-5.8, 29.4], D1: [-0.6, 30], O5: [-1.6, 26] }, 'Hedge: the big jumps out'),
      mv(0.6, { O1: [-6.6, 30.8], D5: [-4.6, 26.5], D1: [-3.8, 31.2], O5: [-1.2, 20.5] }, 'Big recovers, guard chases'),
    ],
    decision: {
      prompt: 'Both defenders are recovering at the same time. Go.', window: 2.8,
      drift: { d: 0.9, m: { D5: [-2.4, 21.4], D1: [-5.8, 29.4], O5: [-0.8, 14], O1: [-7.2, 29.8] } },
      options: [
        { id: 'attack', kind: 'drive', label: 'Attack downhill now', to: [-7, 19.5], read: 92, q: 92, sp: 85, make: 0.62,
          beats: [mv(0.6, { O1: [-7, 19.5], D5: [-4.6, 16.4], D1: [-7.6, 23.5], O5: [1.6, 10.5] }, 'Attack while they recover'), pass('O1', 'O5', 0.45, { O5: [1.6, 8], D2: [8, 8] }, { bounce: 1 }), shoot('O5', 0.75, {}, { cap: 'Drop-off finish', reb: 'D2' })],
          good: 'You attacked while both defenders were moving backward. X5 had to choose between you and the roller, and you made him pay.' },
        { id: 'roll', kind: 'pass', target: 'O5', label: 'Pass to the roller now', read: 50, q: 45, sp: 65, make: 0.58, tov: 0.35,
          beats: [pass('O1', 'O5', 0.55, { O5: [-0.8, 13.5], D5: [-1.6, 17.6] }, { risky: 'D5' }), shoot('O5', 0.8, {}, { cap: 'Roll finish', reb: 'D5' })],
          good: 'Looking for the roll is the right instinct.', miss: 'X5 was recovering straight through the passing lane. Make the defense commit first, then pass.' },
        { id: 'three', kind: 'shot', label: 'Pull-up three', read: 50, q: 45, sp: 70, make: 0.32,
          beats: [shoot('O1', 1.1, { D1: [-6.6, 29.6] }, { three: 1, cap: 'Pull-up three', reb: 'D5' })],
          miss: 'X1 was arriving from behind and you were drifting away from the basket. The defense was retreating; attack it.' },
        { id: 'reset', kind: 'reset', label: 'Reset for a re-screen', read: 40, q: 40, sp: 60, beats: RESET('Re-screen'),
          miss: 'Resetting lets both defenders finish their recovery. The hedge created a moment of 2-on-1; you let it pass.' },
      ],
    },
    bestWhy: 'During a hedge recovery both defenders are moving backward. Attacking downhill at that moment forces the big to choose between you and the roller.',
    defense: 'Hedge and recover. X5 jumped out to push you wide, then sprinted back to Five while X1 scrambled to get back to you.',
    lesson: 'Versus a hedge: don\'t retreat with the dribble. Turn the corner tight, then attack the gap the instant the big starts recovering. Pass when he commits to you.',
    keys: ['Big jumps out, then runs back = hedge.', 'Attack while defenders move backward.', 'Make the big commit, then pass.'],
  },
  {
    id: 'hardshow-pocket', setting: 'High pick-and-roll', title: 'Hard Show: Pocket Pass', cat: 'pnr', topic: 'pocket', coverage: 'Hard show', quiz: 'Hedge / show', diff: 2, clock: 15,
    brief: 'The big is going to jump way out above the screen. Find the pocket.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3, 28.8]),
      mv(0.7, { O1: [-3.8, 31.2], D5: [-5.6, 31.6], D1: [-0.4, 30.4], O5: [-1.4, 28] }, 'Hard show above the screen'),
      mv(0.5, { O1: [-4.8, 31.8], D5: [-6.2, 30.4], D1: [-1.6, 31.4], O5: [-2.4, 25.6], D2: [12, 8], D4: [13.5, 17] }, 'Five rolls behind it'),
    ],
    decision: {
      prompt: 'The big is in your face. Five is rolling right behind him.', window: 2.6,
      drift: { d: 0.8, m: { O5: [-1.8, 20], D5: [-4.8, 28.4], D1: [-2.8, 29.6], D4: [9, 18] } },
      options: [
        { id: 'pocket', kind: 'pass', target: 'O5', label: 'Pocket bounce pass', read: 95, q: 95, sp: 88, make: 0.62,
          beats: [pass('O1', 'O5', 0.45, { O5: [-1.6, 19] }, { bounce: 1, cap: 'Pocket pass' }), mv(0.55, { O5: [-0.8, 10], D2: [3.5, 8.5], D4: [4, 14] }, 'Five attacks 4-on-3'), shoot('O5', 0.75, {}, { cap: 'Finish', reb: 'D2' })],
          good: 'You hit the pocket under the big\'s hands as soon as he committed. Five caught it in stride with a 4-on-3.' },
        { id: 'turn', kind: 'drive', label: 'Turn the corner', to: [-9, 26], read: 40, q: 35, sp: 55, make: 0.45, tov: 0.35, strip: 'D5',
          beats: [mv(0.6, { O1: [-9, 26], D5: [-8, 27.6], D1: [-6, 29] }, 'Turn the corner'), mv(0.5, { O1: [-6, 12] }, 'Into the paint'), shoot('O1', 0.85, {}, { cap: 'Layup', reb: 'D2' })],
          miss: 'The show was designed to wall that path. Dribbling around a hard show exposes the ball to both defenders.' },
        { id: 'retreat', kind: 'reset', label: 'Retreat and reset', read: 50, q: 50, sp: 65, beats: [mv(0.9, { O1: [-6, 38], D5: [-4.8, 33], D1: [-3.4, 35.4] }, 'Retreat dribble')],
          good: 'Retreating protected the ball.', miss: 'Five was open behind the show. Retreating lets X5 recover.' },
        { id: 'skip', kind: 'pass', target: 'O4', label: 'Skip to the wing', read: 45, q: 45, sp: 80, make: 0.38, tov: 0.25,
          beats: [pass('O1', 'O4', 0.85, {}, { lob: 1, risky: 'D4' }), shoot('O4', 1.0, {}, { three: 1, cap: 'Wing three', reb: 'D5' })],
          miss: 'The skip has to travel past X4, who was already rotating. The quick pass was right next to you.' },
      ],
    },
    bestWhy: 'A hard show takes the big away from the roll. The pocket pass goes under his hands to a roller with a head of steam and a 4-on-3 behind it.',
    defense: 'Hard show. X5 jumped out high above the screen to stop your dribble while X1 recovered. For a second nobody was guarding Five.',
    lesson: 'Versus a hard show: keep your dribble alive, and throw the one-hand bounce pass into the gap between the show and the screener as he rolls. Pass early, before X1 gets back.',
    keys: ['Big way above the screen = hard show.', 'The pocket is right behind the show.', 'One-hand bounce pass, low and early.'],
  },
  // ---------------------------------------------------------------- ice
  {
    id: 'ice-reject', setting: 'Side pick-and-roll', title: 'Ice: Reject the Screen', cat: 'pnr', topic: 'ice', coverage: 'Ice (late big)', quiz: 'Ice', diff: 3, clock: 13,
    brief: 'Side pick-and-roll. Watch which side your defender takes before the screen.',
    pos: {
      O1: [-19, 22], D1: [-17.2, 23.4], O5: [-11, 15], D5: [-9.4, 13], O4: [4, 29], D4: [3, 26.2],
      O2: [21, 19], D2: [17.4, 17.6], O3: [22, 3.5], D3: [18.6, 6],
    }, ball: 'O1',
    setup: [
      mv(0.9, { O5: [-15.6, 25], D5: [-13.4, 22.4], D1: [-17.4, 23.6], O1: [-19.5, 22.4] }, 'Side screen: X1 jumps to the top side', { screen: 'O5', screenOn: 'D1' }),
      mv(0.5, { O1: [-19.8, 21.6], D1: [-17.6, 22.8], D5: [-13.8, 21] }, 'X5 is late getting to the baseline'),
    ],
    decision: {
      prompt: 'Your man is forcing you baseline. Where\'s the big?', window: 2.8,
      drift: { d: 0.9, m: { D5: [-14.6, 17], D1: [-18.2, 22], O5: [-14.4, 22.8] } },
      options: [
        { id: 'reject', kind: 'drive', label: 'Reject: attack baseline', to: [-12, 10.5], read: 92, q: 92, sp: 85, make: 0.58,
          beats: [mv(0.7, { O1: [-12, 10.5], D1: [-16.6, 17], D5: [-11.6, 13.6], O5: [-8.5, 17], D3: [3, 8] }, 'Reject the screen: baseline'), shoot('O1', 0.85, {}, { cap: 'Baseline layup', reb: 'D3' })],
          good: 'You rejected the screen and attacked baseline before X5 could get down to wall you off.' },
        { id: 'use', kind: 'drive', label: 'Use the screen anyway', to: [-13.6, 25], read: 25, q: 25, sp: 55, make: 0.28, tov: 0.3, strip: 'D5',
          beats: [mv(0.6, { O1: [-13.6, 25], D1: [-15, 25.4], D5: [-12, 23.2] }, 'Into the screen'), shoot('O1', 1.0, {}, { cap: 'Shot into two defenders', reb: 'D5' })],
          miss: 'X1 was sitting on the screen side. Using the screen ran you straight into both defenders.' },
        { id: 'three', kind: 'shot', label: 'Pull-up three', read: 45, q: 40, sp: 70, make: 0.32,
          beats: [shoot('O1', 1.1, { D1: [-18.6, 22] }, { three: 1, cap: 'Contested three', reb: 'D5' })],
          miss: 'A contested three skips the opening. X5 was out of position for half a second.' },
        { id: 'swing', kind: 'pass', target: 'O4', label: 'Swing to the top', read: 45, q: 45, sp: 70, make: 0.3,
          beats: [pass('O1', 'O4', 0.7, { D4: [3.4, 27.4] }), shoot('O4', 1.0, {}, { three: 1, cap: 'Contested three', reb: 'D5' })],
          good: 'Swinging is safe.', miss: 'Safe, but X5 was out of position for half a second. That\'s the moment to attack.' },
      ],
    },
    bestWhy: 'Ice sends you baseline into the big. When the big is late getting there, the baseline is wide open: reject the screen and go.',
    defense: 'Ice. X1 jumped to the top side to keep you away from the screen and force you baseline, but X5 was late getting down to the baseline side to meet you.',
    lesson: 'Read your defender\'s feet before the screen. If he jumps to the screen side (ice), check the big: late big = reject and attack baseline. Big already there = swing or re-screen.',
    keys: ['Defender above the ball, on the screen side = ice.', 'Find the big before you go.', 'Late big = reject the screen.'],
  },
  // ---------------------------------------------------------------- low man
  {
    id: 'lowman-tags-skip', setting: 'High pick-and-roll', title: 'Low Man Tags: Skip It', cat: 'pnr', topic: 'lowman', coverage: 'Drop + low-man tag', quiz: 'Drop', diff: 3, clock: 14,
    brief: 'The roll will draw a help defender. Find out who.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3.5, 21.5]),
      mv(1.0, { O1: [-6.5, 27.6], D1: [0, 30], O5: [-1.6, 24], D5: [-4, 19] }, 'Over the screen'),
      mv(0.75, { O1: [-8.4, 22.6], D1: [-4.4, 27], O5: [-1, 12.5], D5: [-7.2, 19.6], D2: [5, 9.5], D4: [15, 15] }, 'The low man tags the roller'),
    ],
    decision: {
      prompt: 'The big stepped up to you. Someone helped on the roll. Who\'s open?', window: 3.0,
      drift: { d: 0.9, m: { D2: [3, 9], D4: [12.5, 13], O1: [-8.6, 21.6], D5: [-7.6, 19], O5: [-0.6, 9.5], D1: [-6.8, 24] } },
      options: [
        { id: 'skip', kind: 'pass', target: 'O2', label: 'Skip to the weak corner', read: 95, q: 95, sp: 95, make: 0.43,
          beats: [pass('O1', 'O2', 0.8, { D4: [16, 9] }, { lob: 1, cap: 'Skip pass' }), shoot('O2', 1.0, { D4: [18.6, 6] }, { three: 1, cap: 'Corner three', reb: 'D5' })],
          good: 'You found the low man. X2 left the weak corner to tag the roller, and you skipped it right where he came from.' },
        { id: 'roll', kind: 'pass', target: 'O5', label: 'Pass to the roller', read: 35, q: 35, sp: 60, make: 0.5, tov: 0.3,
          beats: [pass('O1', 'O5', 0.55, { O5: [-0.4, 9] }, { bounce: 1, risky: 'D2' }), shoot('O5', 0.8, {}, { cap: 'Roll finish', reb: 'D2' })],
          miss: 'X2 was already sitting in the lane to tag the roller. The help defender is who you pass away from.' },
        { id: 'pullup', kind: 'shot', label: 'Pull-up jumper', read: 50, q: 50, sp: 70, make: 0.34,
          beats: [shoot('O1', 1.05, { D5: [-8.2, 20.8] }, { cap: 'Contested pull-up', reb: 'D2' })],
          good: 'You read that the big came up.', miss: 'X5 stepped up into your pull-up. When the big and the low man both commit, someone on the weak side is open.' },
        { id: 'corner', kind: 'pass', target: 'O3', label: 'Kick to the near corner', read: 30, q: 30, sp: 70, make: 0.3,
          beats: [pass('O1', 'O3', 0.65, { D3: [-21, 5.4] }), shoot('O3', 1.0, {}, { three: 1, cap: 'Contested corner three' })],
          miss: 'X3 never left. The help came from the weak side, so that\'s where the open man was.' },
      ],
    },
    bestWhy: 'The low man is the weak-side defender closest to the basket. When he tags the roller, his man (the weak corner) is open. Skip it over the top.',
    defense: 'Drop with a low-man tag. X5 stepped up to you, so X2 left the weak-side corner to bump the roller. X4 was stuck guarding two players on the weak side.',
    lesson: 'Before the screen, find the low man. Then the read is simple: if he tags the roller, skip to his man; if he stays home, hit the roller.',
    keys: ['Low man = weak-side defender nearest the rim.', 'He tags the roll = skip to his man.', 'Throw the skip over the top, to the shooting pocket.'],
  },
  {
    id: 'lowman-stays-roll', setting: 'High pick-and-roll', title: 'Low Man Stays: Feed the Roll', cat: 'pnr', topic: 'lowman', coverage: 'Show + low man home', quiz: 'Hedge / show', diff: 2, clock: 15,
    brief: 'Same read as before. This time, watch whether the help comes.',
    pos: spread(), ball: 'O1',
    setup: [
      SCREEN([-3, 27.6]),
      mv(0.9, { O1: [-6, 28.8], D5: [-6.4, 26.6], D1: [-0.6, 29.6], O5: [-1.6, 22] }, 'Big shows at the level'),
      mv(0.7, { O1: [-9.2, 27], D5: [-8.8, 24.6], D1: [-5.2, 28.2], O5: [-1.4, 13], D2: [19.4, 5.4], D4: [18, 17.6] }, 'Low man stays home'),
    ],
    decision: {
      prompt: 'The big is up at the level. Did anyone pick up the roller?', window: 2.8,
      drift: { d: 0.8, m: { O5: [-0.6, 8], D2: [16, 6.6], D5: [-8, 23], D1: [-7.6, 27.4] } },
      options: [
        { id: 'lob', kind: 'pass', target: 'O5', label: 'Lob to the roller', read: 95, q: 95, sp: 88, make: 0.74,
          beats: [pass('O1', 'O5', 0.6, { O5: [-0.4, 6.4] }, { lob: 1, cap: 'Lob to the roller' }), shoot('O5', 0.6, {}, { cap: 'Dunk', reb: 'D2' })],
          good: 'You saw the low man stay home in the corner, so nobody was between Five and the rim. Lob, dunk.' },
        { id: 'skip', kind: 'pass', target: 'O2', label: 'Skip to the weak corner', read: 35, q: 35, sp: 75, make: 0.3,
          beats: [pass('O1', 'O2', 0.85, { D2: [20, 5] }, { lob: 1, cap: 'Skip pass' }), shoot('O2', 1.0, {}, { three: 1, cap: 'Contested corner three', reb: 'D5' })],
          miss: 'X2 never left the corner. The skip is the answer only when the low man helps.' },
        { id: 'pullup', kind: 'shot', label: 'Pull-up over the big', read: 45, q: 40, sp: 65, make: 0.3,
          beats: [shoot('O1', 1.05, { D5: [-9, 25.6] }, { three: 1, cap: 'Contested three', reb: 'D4' })],
          miss: 'The big was right there at the level. The open man was behind him.' },
        { id: 'turn', kind: 'drive', label: 'Turn the corner', to: [-8, 15], read: 55, q: 55, sp: 65, make: 0.4,
          beats: [mv(0.7, { O1: [-8, 15], D5: [-7.6, 18], D1: [-7.8, 20] }, 'Turn the corner'), shoot('O1', 0.9, {}, { cap: 'Runner', reb: 'D2' })],
          good: 'Attacking is better than settling.', miss: 'You took a runner when your roller had a free path to the rim.' },
      ],
    },
    bestWhy: 'If the low man stays attached to the corner shooter, nobody can meet the roller. Feed him before the big recovers.',
    defense: 'Show at the level. X5 came up to the level of the screen to stop your drive, and X2 stayed home in the weak corner instead of tagging. Nobody covered the roll.',
    lesson: 'Same low-man read, other answer: if the low man stays home, throw it to the roller (lob or bounce) the moment he passes the big.',
    keys: ['Low man home = roller is open.', 'Pass as the roller clears the big.', 'Lob when nobody is under the rim.'],
  },
  // ---------------------------------------------------------------- transition
  {
    id: 'transition-3on2', setting: 'Transition push', title: 'Transition 3-on-2', cat: 'iq', topic: 'transition', coverage: 'Two-man tandem', diff: 1, clock: 22,
    brief: 'Steal and push. Three of you, two of them. Make them guard you.',
    pos: {
      O1: [0, 44.5], O2: [17, 42], O3: [-17, 42.5], O4: [8, 49], O5: [-4, 50],
      D1: [0, 36], D2: [-1, 22], D3: [-12, 50], D4: [10, 52], D5: [2, 51],
    }, ball: 'O1',
    setup: [
      mv(1.0, { O1: [0, 34], O2: [19.5, 27], O3: [-19.5, 27], D1: [0, 28.5], D2: [0, 11], O4: [7, 44], O5: [-3, 45], D3: [-10, 45], D4: [9, 46.5], D5: [2, 46] }, 'Push it: 3-on-2'),
      mv(0.6, { O1: [0, 28.6], D1: [0, 25], O2: [20, 18.5], O3: [-20, 18], D2: [-0.6, 9.2], O4: [6.5, 38.5], O5: [-3, 40], D3: [-9, 39], D4: [8, 41], D5: [1.5, 41.5] }, 'Top defender stops the ball'),
    ],
    decision: {
      prompt: 'The top man stopped you. The bottom man is at the rim. Trailers are coming.', window: 2.6,
      drift: { d: 0.8, m: { O1: [0, 27.4], D1: [0, 25.8], O2: [20, 16], O3: [-20, 15.5], D2: [1, 9], D3: [-8, 33], D4: [7.4, 35], D5: [1.5, 35], O4: [6, 33], O5: [-3, 34] } },
      options: [
        { id: 'wing', kind: 'pass', target: 'O2', label: 'Hit the wing', read: 95, q: 93, sp: 90, make: 0.66,
          beats: [pass('O1', 'O2', 0.5, { D2: [13, 11], D1: [-2, 20] }), mv(0.3, { O3: [-14, 9] }, 'Bottom man closes out'), pass('O2', 'O3', 0.6, { O3: [-8, 6.5], D1: [-4, 11] }), shoot('O3', 0.75, {}, { cap: 'Layup off the extra pass', reb: 'D1' })],
          good: 'You made the top defender commit, then moved it. The bottom man had to close out, and the extra pass beat the last defender.' },
        { id: 'attack', kind: 'drive', label: 'Attack the rim', to: [0, 13], read: 30, q: 30, sp: 45, make: 0.32,
          beats: [mv(0.65, { O1: [0, 13], D1: [-1.5, 15], D2: [0.5, 9.5] }, 'Attack two defenders'), shoot('O1', 0.8, {}, { cap: 'Contested layup', reb: 'D2' })],
          miss: 'You drove into both defenders and turned a 3-on-2 into a 1-on-2.' },
        { id: 'three', kind: 'shot', label: 'Pull-up three', read: 45, q: 40, sp: 60, make: 0.33,
          beats: [shoot('O1', 1.1, { D1: [0, 26.4] }, { three: 1, cap: 'Early pull-up three', reb: 'D2' })],
          miss: 'An early contested three gives back a 3-on-2. Make the defense guard someone first.' },
        { id: 'pullout', kind: 'reset', label: 'Pull it out and set up', read: 20, q: 20, sp: 55, beats: [mv(1.0, { O1: [0, 38], O2: [21, 19], O3: [-21, 19], D2: [6, 10], D1: [1, 33], D3: [-12, 18], D4: [10, 26], D5: [0, 14], O4: [14, 25], O5: [-8, 15] }, 'Pull it out')],
          miss: 'A 3-on-2 is the best look you\'ll get all night. Pulling it out lets all five defenders get back.' },
      ],
    },
    bestWhy: 'Two defenders can\'t guard three. Once the top man stops the ball, pass to a wing: the bottom man must close out, and the extra pass is a layup.',
    defense: 'Two-man tandem. X1 stopped the ball at the top of the key and X2 stayed under the basket. Three defenders were still sprinting back.',
    lesson: 'In transition: push to the free-throw line extended, keep the wings wide, and make the top defender commit before you pass. One more pass beats two defenders.',
    keys: ['Wings wide = defenders spread out.', 'Make the top man stop you first.', 'Pass ahead before the trailers arrive.'],
  },
  // ---------------------------------------------------------------- closeouts
  {
    id: 'hard-closeout', setting: 'Kick-out catch', title: 'Attack the Hard Closeout', cat: 'iq', topic: 'closeout', coverage: 'Hard closeout', diff: 1, clock: 12,
    brief: 'You\'re on the wing. Four drives and kicks to you. Watch how your defender arrives.',
    pos: {
      O1: [21, 19], D1: [11, 16], O4: [2, 29], D4: [2, 26.2], O2: [22, 3.5], D2: [17.8, 6],
      O3: [-21, 19], D3: [-14, 15], O5: [-9, 5], D5: [-5.6, 7],
    }, ball: 'O4',
    setup: [
      mv(0.8, { O4: [7, 20], D4: [6, 22.4], D1: [9.4, 18.2] }, 'Four drives the gap; X1 helps'),
      pass('O4', 'O1', 0.55, { D1: [15.6, 18.6], O4: [6.5, 19] }, { cap: 'Kick-out to you' }),
      mv(0.35, { D1: [18.6, 19] }, 'X1 sprints out at you'),
    ],
    decision: {
      prompt: 'Your defender is flying at you, out of control.', window: 2.0,
      drift: { d: 0.6, m: { D1: [20, 19.4] } },
      options: [
        { id: 'attack', kind: 'drive', label: 'Shot fake, attack baseline', to: [15, 10.5], read: 93, q: 92, sp: 88, make: 0.66,
          beats: [mv(0.25, { O1: [21.2, 19.3] }, 'Shot fake'), mv(0.6, { O1: [15, 10.5], D1: [21.6, 20.6], D5: [1, 6.6], D2: [18.6, 6.4] }, 'One dribble past the closeout'), mv(0.3, { O1: [11.6, 8.2], D5: [6.8, 6.4] }, 'Help comes'), pass('O1', 'O5', 0.45, { O5: [-5, 4.5] }, { bounce: 1 }), shoot('O5', 0.7, {}, { cap: 'Drop-off dunk', reb: 'D3' })],
          good: 'You used his momentum against him: shot fake, one hard dribble past, then the drop-off when the big helped.' },
        { id: 'shoot', kind: 'shot', label: 'Shoot over him', read: 40, q: 35, sp: 70, make: 0.3,
          beats: [shoot('O1', 1.05, { D1: [20.4, 19.6] }, { three: 1, cap: 'Contested three', reb: 'D5' })],
          miss: 'X1 arrived at full speed with a high hand. Shooting into a hard closeout is a contested three.' },
        { id: 'swing', kind: 'pass', target: 'O4', label: 'Pass back to Four', read: 50, q: 50, sp: 60, make: 0.34,
          beats: [pass('O1', 'O4', 0.5, { D4: [6.4, 20.6], O4: [8, 25] }), shoot('O4', 1.0, {}, { cap: 'Contested jumper', reb: 'D5' })],
          good: 'Moving the ball is never a terrible play.', miss: 'The defense was in rotation. Passing back let it recover; the advantage was blowing by X1.' },
        { id: 'middle', kind: 'drive', label: 'Drive middle', to: [12, 16], read: 55, q: 55, sp: 60, make: 0.38,
          beats: [mv(0.6, { O1: [12, 16], D1: [16.6, 18.6], D4: [9, 17] }, 'Middle drive'), shoot('O1', 0.9, {}, { cap: 'Pull-up into help', reb: 'D4' })],
          good: 'Attacking the closeout was right.', miss: 'Middle took you back toward X4 and the help. Go away from where the defender came from: baseline.' },
      ],
    },
    bestWhy: 'A hard closeout can\'t stop. One shot fake sends him flying by, and a baseline drive puts the whole defense in rotation.',
    defense: 'Hard closeout. X1 was helping on the drive, then sprinted at you with no control and high hands, trying to take away the three.',
    lesson: 'Read the closeout, not the clock: fast and high = shot fake and drive (baseline, away from the help); short and choppy = shoot it.',
    keys: ['Fast, high, out of control = attack.', 'One shot fake, one hard dribble.', 'Drive away from where the help came from.'],
  },
  {
    id: 'short-closeout', setting: 'Kick-out catch', title: 'Short Closeout: Let It Fly', cat: 'iq', topic: 'closeout', coverage: 'Short closeout', diff: 1, clock: 11,
    brief: 'Kick-out to you on the wing again. Same question, different defender.',
    pos: {
      O1: [-21.5, 17.5], D1: [-14, 15], O4: [-4, 28], D4: [-3.6, 25.4], O2: [21, 18], D2: [16, 16],
      O3: [22, 3.5], D3: [18.5, 6], O5: [8, 5], D5: [5, 7],
    }, ball: 'O4',
    setup: [
      mv(0.8, { O4: [-6, 19], D4: [-5, 21.6], D1: [-9.6, 16.4] }, 'Four drives; X1 helps at the nail'),
      pass('O4', 'O1', 0.55, { D1: [-12.8, 16.6] }, { cap: 'Kick-out to you' }),
      mv(0.4, { D1: [-15.6, 17] }, 'X1 closes out short'),
    ],
    decision: {
      prompt: 'Your defender stopped six feet away with his hands down.', window: 2.0,
      drift: { d: 0.6, m: { D1: [-17.4, 17.2] } },
      options: [
        { id: 'shoot', kind: 'shot', label: 'Catch-and-shoot three', read: 95, q: 95, sp: 85, make: 0.42,
          beats: [shoot('O1', 1.05, { D1: [-18.6, 17.4] }, { three: 1, cap: 'Catch-and-shoot three', reb: 'D5' })],
          good: 'He gave you six feet. You shot it on the catch, before he could close the gap.' },
        { id: 'drive', kind: 'drive', label: 'Drive the closeout', to: [-14, 9], read: 45, q: 40, sp: 60, make: 0.33,
          beats: [mv(0.6, { O1: [-14, 9], D1: [-14.6, 11], D5: [-9, 8] }, 'Drive into a set defender'), shoot('O1', 0.85, {}, { cap: 'Contested layup', reb: 'D5' })],
          miss: 'X1 was set and balanced, so there was nothing to drive past. A short closeout is an invitation to shoot.' },
        { id: 'onedribble', kind: 'shot', label: 'One-dribble pull-up', read: 60, q: 60, sp: 75, make: 0.38,
          beats: [mv(0.4, { O1: [-17.6, 15.4] }, 'One dribble in'), shoot('O1', 1.0, { D1: [-16.8, 14.6] }, { cap: 'Pull-up two', reb: 'D5' })],
          good: 'You read the space and stayed aggressive.', miss: 'You traded an open three for a long two. The space was at the arc.' },
        { id: 'swing', kind: 'pass', target: 'O4', label: 'Swing it back', read: 40, q: 40, sp: 65, make: 0.3,
          beats: [pass('O1', 'O4', 0.55, { O4: [-6, 26], D4: [-5, 23.6] }), shoot('O4', 1.0, {}, { three: 1, cap: 'Contested three', reb: 'D5' })],
          miss: 'You passed up an open shot for a worse one. Open shooters shoot.' },
      ],
    },
    floorNote: 'Every teammate is covered: the open player on this possession is you. Check your own defender\'s distance.',
    bestWhy: 'A short, choppy closeout gives you space and balance. Shoot it on the catch.',
    defense: 'Short closeout. X1 was helping at the nail on Four\'s drive and recovered late and short, stopping about six feet away to avoid getting blown by.',
    lesson: 'Shot-ready on every kick-out: hands up, feet set before the catch. If the closeout is short, the decision is made: shoot.',
    keys: ['Defender stops 5+ feet away = shoot.', 'Feet set before the catch.', 'Don\'t pass up an open three for a worse shot.'],
  },
  // ---------------------------------------------------------------- mismatch
  {
    id: 'mismatch-post', setting: 'Wing entry', title: 'Mismatch: Small on Big', cat: 'iq', topic: 'mismatch', coverage: 'Cross-match', diff: 2, clock: 13,
    brief: 'After a scramble, the defense cross-matched. Find the mismatch.',
    pos: {
      O1: [-21, 20], D1: [-17.8, 20.8], O4: [-10, 13], D2: [-8.6, 12], O2: [21, 19], D4: [17.6, 17.6],
      O5: [8.5, 4.5], D5: [5.6, 6.5], O3: [10, 27], D3: [8.2, 24],
    }, ball: 'O1',
    setup: [
      mv(0.9, { O4: [-9.6, 8.4], D2: [-7.8, 7.6], O1: [-20.6, 19], D1: [-17.8, 20.8] }, 'Cross-match: X2 is guarding your Four'),
      mv(0.6, { O4: [-10.2, 9.2], D2: [-8.4, 8.4] }, 'Four posts up the smaller guard'),
    ],
    decision: {
      prompt: 'Your Four has a guard on his back. The help is on the far side.', window: 3.0,
      drift: { d: 0.8, m: { D5: [2, 6.6], O4: [-10.4, 9.2] } },
      options: [
        { id: 'post', kind: 'pass', target: 'O4', label: 'Feed the post', read: 95, q: 95, sp: 85, make: 0.6,
          beats: [pass('O1', 'O4', 0.55, {}, { bounce: 1, cap: 'Post entry' }), mv(0.5, { O4: [-7.6, 7], D2: [-6.6, 7.8], D5: [-2.6, 7], O1: [-22, 16] }, 'Back down the smaller defender'), shoot('O4', 0.8, {}, { cap: 'Turnaround over the guard', reb: 'D5' })],
          good: 'You found the mismatch and delivered it. A big forward with a guard on his back is the best shot on the floor.' },
        { id: 'drive', kind: 'drive', label: 'Drive your man', to: [-13, 10], read: 40, q: 40, sp: 55, make: 0.38,
          beats: [mv(0.7, { O1: [-13, 10], D1: [-13.6, 12.4], O4: [-8, 15] }, 'Drive into the post'), shoot('O1', 0.85, {}, { cap: 'Crowded layup', reb: 'D5' })],
          miss: 'You drove into your own post player\'s space and ignored the mismatch.' },
        { id: 'swing', kind: 'pass', target: 'O3', label: 'Swing to the slot', read: 35, q: 35, sp: 70, make: 0.33,
          beats: [pass('O1', 'O3', 0.8, { D3: [9, 25.6] }), shoot('O3', 1.0, {}, { three: 1, cap: 'Contested three', reb: 'D5' })],
          miss: 'Swinging away lets the defense fix the cross-match. Mismatches disappear quickly.' },
        { id: 'three', kind: 'shot', label: 'Pull-up three', read: 40, q: 35, sp: 70, make: 0.33,
          beats: [shoot('O1', 1.1, { D1: [-18.8, 20] }, { three: 1, cap: 'Contested three', reb: 'D5' })],
          miss: 'A contested three when your Four is posting a guard is the low-percentage choice.' },
      ],
    },
    floorNote: 'Four shows as tight because X2 is on his back, but X2 gives up several inches and the help is across the floor.',
    bestWhy: 'After a cross-match, the post-up is the mismatch. A big forward against a guard scores at a high rate, and the help is a full court-width away.',
    defense: 'Cross-match after a scramble. X2, the shooting guard, ended up on your power forward in the post, with X5 guarding the weak-side dunker.',
    lesson: 'After any scramble or switch, count the matchups. Size mismatch inside = feed the post from the wing with a bounce pass, then relocate for the kick-out.',
    keys: ['Count matchups after every scramble.', 'Small on big inside = post entry.', 'Enter from the wing, then relocate.'],
  },
  // ---------------------------------------------------------------- late clock
  {
    id: 'late-clock', setting: 'Late-clock drag screen', title: 'Late Clock: 4 Seconds', cat: 'iq', topic: 'lateclock', coverage: 'Drop (late clock)', quiz: 'Drop', diff: 3, clock: 4,
    brief: 'Four seconds on the shot clock. Quick drag screen. No time for a second action.',
    pos: {
      O1: [0, 31], D1: [0, 28.4], O2: [22, 3.5], D2: [19, 5.5], O3: [-22, 3.5], D3: [-19, 5.5],
      O4: [21, 19], D4: [17.5, 17.5], O5: [-6, 22], D5: [-4.4, 19],
    }, ball: 'O1',
    setup: [
      mv(0.7, { O5: [-1.4, 28.6], D5: [-3, 24], O1: [0.6, 31.4] }, '4 seconds: quick drag screen', { screen: 'O5', screenOn: 'D1' }),
      mv(0.8, { O1: [-6, 24.4], D1: [-1.8, 27.6], O5: [-1.6, 22], D5: [-4.2, 17.8] }, 'The big drops'),
    ],
    decision: {
      prompt: 'Under three seconds left. Get the best shot available — now.', window: 2.0,
      drift: { d: 1.0, m: { O1: [-7.2, 21.6], D1: [-5.4, 24.4], D5: [-5.8, 17.8], O5: [-1, 14] } },
      options: [
        { id: 'pullup', kind: 'shot', label: 'Pull-up jumper now', read: 92, q: 92, sp: 80, make: 0.42,
          beats: [shoot('O1', 1.0, { D5: [-6.4, 19], D1: [-6.6, 23] }, { cap: 'Pull-up at the horn', reb: 'D5' })],
          good: 'You took the shot the drop gave you, on time. With under three seconds, a clean pull-up is the best shot you\'ll get.' },
        { id: 'kick', kind: 'pass', target: 'O3', label: 'Drive and kick', read: 50, q: 45, sp: 75, make: 0.4, tov: 0.55, clock: true,
          beats: [mv(0.6, { O1: [-6, 14], D5: [-5, 12], D3: [-14, 6] }, 'Drive'), pass('O1', 'O3', 0.55), shoot('O3', 1.0, {}, { three: 1, cap: 'Corner three at the horn', reb: 'D5' })],
          good: 'Drive-and-kick is a great action with time on the clock.', miss: 'A drive, a pass and a catch-and-shoot takes over two seconds. With the clock under three, it usually doesn\'t get off in time.' },
        { id: 'stepback', kind: 'shot', label: 'Step back to the arc', read: 60, q: 55, sp: 70, make: 0.3,
          beats: [mv(0.4, { O1: [-9.4, 25.6] }, 'Step back'), shoot('O1', 1.0, { D1: [-8, 24] }, { three: 1, cap: 'Step-back three', reb: 'D5' })],
          good: 'Getting a shot up on time matters.', miss: 'The step-back cost a dribble and turned an open 17-footer into a contested three.' },
        { id: 'swing', kind: 'pass', target: 'O4', label: 'Swing to the wing', read: 20, q: 20, sp: 60, make: 0.3, tov: 0.8, clock: true,
          beats: [pass('O1', 'O4', 0.9), mv(0.5, {}, 'Catch'), shoot('O4', 1.0, {}, { three: 1, cap: 'Late heave', reb: 'D5' })],
          miss: 'A cross-court swing with under three seconds left almost never gets a shot off. Late clock = shoot the best look you have.' },
      ],
    },
    bestWhy: 'Late clock flips the priorities: a decent shot now beats a great shot that never gets off. The drop gave you a clean pull-up.',
    defense: 'Drop on a late-clock drag screen. X5 sat back to protect the rim and dared you to shoot a mid-range jumper with time running out.',
    lesson: 'Late clock: know the time before the screen, use one action, and take the first clean look. Under three seconds, one pass is the limit.',
    keys: ['Check the clock before the screen.', 'One action, one look.', 'Under 3 seconds: shoot the first clean shot.'],
  },
];

// ---------------------------------------------------------------- lessons (academies)
const LESSONS = {
  pnr: [
    { id: 'drop', title: 'Drop', tag: 'Big sits back', look: 'The screener\'s defender retreats toward the rim (at or below the free-throw line) while your man chases over the screen.', beat: 'Pull-up in the pocket. If the big steps up, lob or pocket to the roller.', scen: ['drop-pullup', 'late-clock'] },
    { id: 'snake', title: 'Snake', tag: 'Chaser on your hip', look: 'Drop coverage, but your defender fights over the screen and stays attached to your hip.', beat: 'Dribble back to the middle across the screener\'s path. Your man is stuck behind you; the big guards two.', scen: ['snake-drop'] },
    { id: 'switch', title: 'Switch', tag: 'Defenders swap', look: 'The two defenders exchange assignments. Now a big is on you and a guard is on the screener.', beat: 'Attack the big in space, or feed the screener sealing the smaller guard. Early switch: the screener slips.', scen: ['switch-punish', 'switch-seal', 'early-switch-slip'] },
    { id: 'blitz', title: 'Blitz', tag: 'Two on the ball', look: 'Both defenders jump the ball handler above the three-point line to force the ball out.', beat: 'Retreat a step, keep the dribble, hit the short roll. Your big makes the 4-on-3 read.', scen: ['blitz-short-roll'] },
    { id: 'hedge', title: 'Hedge & show', tag: 'Big jumps out, recovers', look: 'The big steps out hard to stop your dribble, then sprints back to the screener.', beat: 'Attack while they recover, or hit the pocket pass under a hard show.', scen: ['hedge-recover', 'hardshow-pocket'] },
    { id: 'ice', title: 'Ice', tag: 'Forced baseline', look: 'On a side screen, your defender jumps to the screen side to force you baseline toward the big.', beat: 'If the big is late, reject the screen and attack baseline. If he\'s there, swing or re-screen.', scen: ['ice-reject'] },
    { id: 'lowman', title: 'Low man', tag: 'The roll\'s help defender', look: 'The weak-side defender closest to the rim decides what the roller gets.', beat: 'Low man tags the roll: skip to his man. Low man stays: hit the roller.', scen: ['lowman-tags-skip', 'lowman-stays-roll'] },
    { id: 'pocket', title: 'Pocket & skip', tag: 'The two passes', look: 'Pocket: one-hand bounce pass right behind the big\'s show. Skip: two-hand overhead pass to the weak side.', beat: 'Pocket beats a show or blitz. Skip beats help from the weak side.', scen: ['hardshow-pocket', 'lowman-tags-skip'] },
  ],
  iq: [
    { id: 'transition', title: 'Transition', tag: 'Numbers advantages', look: 'More attackers than defenders before the defense is set.', beat: 'Wings wide, make the top defender commit, pass ahead, one more pass.', scen: ['transition-3on2'] },
    { id: 'closeout', title: 'Closeouts', tag: 'Read the defender\'s feet', look: 'A defender recovering to you after helping. How he arrives tells you what to do.', beat: 'Hard and high: fake and drive. Short and choppy: shoot.', scen: ['hard-closeout', 'short-closeout'] },
    { id: 'mismatch', title: 'Mismatches', tag: 'Count the matchups', look: 'After switches and scrambles, a smaller defender ends up on a big (or a big on a guard).', beat: 'Small on big inside: post it. Big on small outside: attack.', scen: ['mismatch-post', 'switch-punish'] },
    { id: 'lateclock', title: 'Late clock', tag: 'Time and score', look: 'Under five seconds on the shot clock with no set play left.', beat: 'One action, first clean look. Under three seconds: shoot it.', scen: ['late-clock'] },
  ],
};
const TOPIC_NAMES = { drop: 'Drop', snake: 'Snake', switch: 'Switch', blitz: 'Blitz', hedge: 'Hedge', ice: 'Ice', lowman: 'Low man', pocket: 'Pocket pass', transition: 'Transition', closeout: 'Closeouts', mismatch: 'Mismatch', lateclock: 'Late clock' };
const QUIZ_CHOICES = ['Drop', 'Switch', 'Blitz', 'Hedge / show', 'Ice'];
const SC = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/** A mirrored copy (x → -x) so the same read shows up on the other side of the floor. */
function flipScenario(sc) {
  const f = (p) => [R(-p[0]), p[1]];
  const fm = (m) => (m ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, f(v)])) : m);
  const fb = (b) => ({ ...b, m: fm(b.m), rebSpot: b.rebSpot ? f(b.rebSpot) : undefined, after: fm(b.after) });
  return {
    ...sc, flipped: true,
    pos: fm(sc.pos), setup: sc.setup.map(fb),
    decision: { ...sc.decision, drift: fb(sc.decision.drift), options: sc.decision.options.map((o) => ({ ...o, to: o.to ? f(o.to) : undefined, beats: o.beats.map(fb) })) },
  };
}
const getScenario = (id, flip) => (flip ? flipScenario(SC[id]) : SC[id]);
const bestOption = (sc) => sc.decision.options.reduce((a, b) => (score3(b) > score3(a) ? b : a));
const score3 = (o) => 0.35 * o.read + 0.35 * o.q + 0.15 * o.sp;
