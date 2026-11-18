// ===================== Defense Intelligence Center: on-ball 1-on-1 + coverage recognition =====================
// On-ball: eight attacker types with tendencies. You set your cushion and shade (drag), he reads it and attacks what
// you gave him, then you react to his move by tapping (cut off his path, hold your ground, or contest).
// Decision quality (where you stood, how you reacted) is graded separately from whether he scored.

const ATTACKERS = {
  quick: { name: 'Extremely quick guard', cushion: [3.5, 5], burst: 0.9, shoot: 0.35, move: 'drive', tip: 'Give a little more cushion so his first step doesn\'t beat you. Make him shoot over you.' },
  downhill: { name: 'Strong downhill guard', cushion: [3, 4.2], burst: 0.7, shoot: 0.35, move: 'drive', tip: 'Body him early, take away his straight line, and beat him to the spot with your chest. Don\'t reach.' },
  shooter: { name: 'Elite shooter', cushion: [2, 3], burst: 0.4, shoot: 0.85, move: 'pull', tip: 'Crowd him: you can be beaten off the dribble because the help is there, but you can\'t give him space.' },
  crafty: { name: 'Change-of-pace guard', cushion: [3, 4.2], burst: 0.6, shoot: 0.5, move: 'hesi', tip: 'Stay in your stance and don\'t react to the slowdown. Move your feet only when his shoulders go.' },
  stepback: { name: 'Stepback specialist', cushion: [2.2, 3.3], burst: 0.5, shoot: 0.7, move: 'stepback', tip: 'Stay connected. When he steps back, step with him and contest high, without jumping into him.' },
  closeout: { name: 'Closeout attacker', cushion: [2.8, 3.8], burst: 0.75, shoot: 0.55, move: 'pumpdrive', tip: 'Close out under control and stay down on the pump fake. Keep your hand high, not your feet.' },
  hesi: { name: 'Hesitation driver', cushion: [3, 4.2], burst: 0.7, shoot: 0.4, move: 'hesi', tip: 'Hold your ground through the hesitation. If you stand up or reach, he goes.' },
  big: { name: 'Bigger physical handler', cushion: [2.6, 3.6], burst: 0.5, shoot: 0.4, move: 'post', tip: 'Meet him early with your chest, stay low and don\'t let him back you into the paint.' },
};
const OB_SPOTS = { top: [0, 27], wingL: [-18, 18], wingR: [18, 18], slotL: [-9, 26], slotR: [9, 26] };
function genOnBall(seed, lvl, type) {
  const r = rng(seed), k = type || rpick(r, Object.keys(ATTACKERS)), spot = rpick(r, Object.keys(OB_SPOTS)), late = lvl >= 2 && r() < 0.35;
  const p = RR([OB_SPOTS[spot][0] + (r() - 0.5) * 2, OB_SPOTS[spot][1] + (r() - 0.5) * 2]);
  return { type: k, A: ATTACKERS[k], spot, p, late, lvl, seed, r, clock: late ? 4 : 14 };
}
/** Grade where you stand before his move. Ideal: inside his cushion band, on the line to the rim, shaded to the middle. */
function judgeStance(ob, at) {
  const A = ob.A, p = ob.p, c = dist(at, p), [lo, hi0] = A.cushion, hi = ob.late ? hi0 - 0.6 : hi0;
  const line = between(at, p) / Math.max(0.5, c); // 1 = squarely between him and the rim
  const shade = Math.abs(p[0]) > 6 ? (at[0] - toward(p, T_HOOP, c)[0]) * -sgn(p[0]) : 0; // + = shaded to the middle
  const issues = [];
  if (c < lo - 0.4) issues.push('tight'); else if (c > hi + 0.4) issues.push('loose');
  if (line < 0.75) issues.push('offline');
  else if (Math.abs(p[0]) > 6 && shade < -0.6) issues.push('givesMiddle');
  const cScore = c < lo ? Math.max(0, 100 - (lo - c) * 45) : c > hi ? Math.max(0, 100 - (c - hi) * 30) : 100;
  const lScore = clamp((line - 0.4) / 0.5, 0, 1) * 100;
  const sScore = Math.abs(p[0]) > 6 ? (shade >= -0.3 ? 100 : Math.max(0, 100 + shade * 60)) : 100;
  const score = Math.round(cScore * 0.5 + lScore * 0.3 + sScore * 0.2);
  const ideal = add(toward(p, T_HOOP, (lo + hi) / 2), shadeMid(p));
  return { c: r1(c), score, issues, ideal: RR(ideal), lo, hi };
}
/** His response to your stance: exploit what you gave him, otherwise his signature move. */
function attackerMove(ob, st) {
  const A = ob.A, p = ob.p;
  if (st.issues.includes('loose') && A.shoot >= 0.5) return 'pull';
  if (ob.late) return A.shoot >= 0.6 ? 'stepback' : 'pull';
  if (st.issues.includes('tight') && A.burst >= 0.6) return 'blowby';
  if (st.issues.includes('givesMiddle')) return 'middle';
  if (st.issues.includes('offline')) return 'blowby';
  return A.move;
}
const MOVE_TXT = {
  pull: 'He rises up for a pull-up jumper.', blowby: 'He explodes past your side with his first step.', middle: 'He crosses over and attacks the middle you left open.',
  drive: 'He attacks downhill toward the sideline side.', hesi: 'He slows down, a hesitation... then goes.', stepback: 'He jabs at you, then steps back for a jumper.',
  pumpdrive: 'He pump-fakes, then drives.', post: 'He backs you down toward the block.',
};
/** The frozen moment of his move and what the right reaction is. */
function moveFrame(ob, mv, at) {
  const p = ob.p, s = Math.abs(p[0]) > 6 ? sgn(p[0]) : (ob.r() < 0.5 ? 1 : -1);
  const driveTo = mv === 'middle' ? RR([p[0] * 0.3, p[1] - 9]) : RR([s * clamp(Math.abs(p[0]) + 1, 8, 18), Math.max(6, p[1] - 10)]);
  if (mv === 'pull') return { off: p, freezeAt: p, want: 'contest', driveTo, txt: MOVE_TXT.pull };
  if (mv === 'stepback') { const back = RR(toward(p, T_HOOP, -3)); return { off: back, freezeAt: back, want: 'contest', driveTo, txt: MOVE_TXT.stepback }; }
  if (mv === 'hesi' || mv === 'pumpdrive') { const f = RR(toward(p, driveTo, 1.2)); return { off: f, freezeAt: f, want: 'hold', then: 'drive', driveTo, txt: MOVE_TXT[mv] }; }
  if (mv === 'post') { const f = RR(toward(p, T_HOOP, 3)); return { off: f, freezeAt: f, want: 'hold', driveTo: RR(toward(p, T_HOOP, 8)), txt: MOVE_TXT.post }; }
  const f = RR(lerpP(p, driveTo, 0.3)); return { off: f, freezeAt: f, want: 'cutoff', driveTo, txt: MOVE_TXT[mv] };
}
/** Grade your reaction tap. kind: 'cutoff' (tapped floor), 'hold' (tapped yourself), 'contest' (tapped him). */
function judgeReaction(ob, fr, kind, pt, me) {
  const want = fr.want; let score = 0, note = '';
  if (want === 'cutoff') {
    if (kind !== 'cutoff') { score = kind === 'contest' ? 15 : 25; note = kind === 'contest' ? 'You reached at the ball while he was already going by. That\'s a foul or a blow-by.' : 'You held still while he was already driving. Once his shoulders go, you have to slide.'; }
    else {
      // best cut-off: a point on his drive line ahead of him, between him and the rim
      const ideal = RR(lerpP(fr.freezeAt, fr.driveTo, 0.55)), e = dist(pt, ideal), off = segDist(pt, fr.freezeAt, fr.driveTo);
      score = Math.round(clamp(100 - Math.max(0, e - 2.5) * 14 - Math.max(0, off - 1.5) * 18, 0, 100));
      note = score >= 70 ? 'You beat him to the spot on his line. That\'s how you take a charge or force a pick-up.' : off > 3 ? 'Your slide wasn\'t on his line. Beat him to a spot in his path, not beside it.' : 'Right direction, wrong depth. Cut him off before he gets his shoulders past you.';
      fr.ideal = ideal;
    }
  } else if (want === 'hold') {
    score = kind === 'hold' ? 100 : kind === 'cutoff' ? 45 : 10;
    note = kind === 'hold' ? 'You stayed in your stance through the fake. Now he has to beat a set defender.' : kind === 'contest' ? 'You bit on the fake. He goes right past you.' : 'You moved before he did. A good fake is built to make you do that, so let his shoulders tell you when to go.';
  } else {
    score = kind === 'contest' ? 100 : kind === 'cutoff' ? 30 : 20;
    note = kind === 'contest' ? 'High hand, no jump into him: a clean contest.' : 'He was shooting. Your job was to get a hand up and contest, not to slide.';
  }
  return { score, note };
}
/** Outcome is sampled from the attacker and how good your position was, separate from the grade. */
function onBallOutcome(ob, st, re, mv, r) {
  const A = ob.A, q = (st.score * 0.45 + re.score * 0.55) / 100;
  const shot = ['pull', 'stepback'].includes(mv);
  const p = shot ? clamp(0.25 + A.shoot * 0.35 - q * 0.25, 0.08, 0.62) : clamp(0.35 + A.burst * 0.3 - q * 0.4, 0.08, 0.7);
  const foul = re.score < 30 && r() < 0.35;
  return { make: r() < p, p, foul };
}

// ---------- coverage recognition: the team engine's coverages, shown and hidden ----------
const RECOG_POOL = {
  0: ['man', 'zone23', 'denial', 'packline', 'drop', 'switch'],
  1: ['man', 'zone23', 'zone32', 'denial', 'packline', 'drop', 'hedge', 'switch', 'blitz'],
  2: ['man', 'zone23', 'zone32', 'zone131', 'denial', 'packline', 'overplay', 'drop', 'hedge', 'blitz', 'ice', 'switch', 'pressure'],
  3: ['man', 'zone23', 'zone32', 'zone131', 'denial', 'packline', 'overplay', 'drop', 'hedge', 'blitz', 'ice', 'switch', 'pressure'],
};
const RECOG_TELL = {
  man: 'Each defender follows one player. One pass away sits in the gap, two passes away sinks to help.',
  pressure: 'The ball defender is right up on him (under 2 ft). The rest play normal man-to-man.',
  denial: 'One-pass-away defenders sit in the passing lanes with a hand in them. Back cuts are the weakness.',
  overplay: 'Defenders play high and outside, taking away catches at the three-point line.',
  switch: 'When the screen comes, the two defenders swap men instead of fighting through.',
  hedge: 'The screener\'s defender jumps out above the screen, then gets back.',
  blitz: 'Two defenders trap the ball on the screen. The rest drop into the paint.',
  drop: 'The screener\'s defender sits back near the free-throw line as the guard fights over.',
  ice: 'The on-ball defender jumps to the screen side, forcing the ball toward the sideline and the big.',
  packline: 'Everyone off the ball sits inside about 16 ft from the rim. The lane is crowded and the catches outside are free.',
  zone23: 'Two defenders up top, three across the baseline, and they stay in areas when players cut.',
  zone32: 'Three across the top, two low. Defenders guard areas, not players.',
  zone131: 'One at the point, three across the middle (wing, high post, wing) and one along the baseline.',
};
function buildRecognition(seed, lvl) {
  const r = rng(seed), pool = RECOG_POOL[lvl], cov = rpick(r, pool), plays = STARTER_PLAYS;
  const play = cov === 'blitz' || cov === 'hedge' || cov === 'drop' || cov === 'ice' || cov === 'switch' ? plays.find((p) => p.id === 'p-spain') || plays[0] : rpick(r, plays.filter((p) => p.id !== 'p-spain'));
  let covPlan = [{ cov }], change = null;
  if (lvl >= 3 && r() < 0.5) { let b = rpick(r, pool); while (b === cov) b = rpick(r, pool); covPlan = [{ cov: b }, { cov, from: 1 }]; change = b; }
  const S = newPossession({ play, covPlan, intensity: lvl >= 2 ? 3 : 2, mode: 'practice', seed });
  const step = advanceScript(S);
  if (change) { S.cov = cov; beat(S, 1.0, {}, S.ball, [], 'The defense changes'); }
  // run the scripted pass (if any) and the rest of the play so the coverage shows itself
  if (step) {
    const a = step.actions.find((x) => x.type === 'pass');
    if (a) { beat(S, 1.1, {}, { pass: [a.from, a.to] }, [], 'Pass'); applyPassRules(S, a.from, a.to, roleAt(S.pos[a.from]), roleAt(S.pos[a.to])); }
    S.stepIdx++; advanceScript(S);
  }
  // one more swing to show how they move with the ball
  const H = S.ball, nxt = OFF.filter((o) => o !== H && isPerim(S.pos[o])).sort((a, b) => dist(S.pos[a], S.pos[H]) - dist(S.pos[b], S.pos[H]))[0];
  if (nxt) beat(S, 1.1, {}, { pass: [H, nxt] }, [], 'Swing');
  const others = Object.keys(COVERAGES).filter((k) => k !== cov && pool.includes(k));
  const ch = [cov, ...others.sort(() => r() - 0.5).slice(0, lvl === 0 ? 2 : 3)].sort(() => r() - 0.5);
  const disguise = lvl >= 2;
  return { start: S.start, beats: S.beats.map((b) => ({ ...b, cap: disguise ? '' : b.cap?.replace(/Defense sets: .*/, 'Defense sets') })), cov, change, choices: ch, play: play.name, seed, lvl };
}

// on-ball mistakes (same teaching format as the team mistakes)
Object.assign(MISTAKES, {
  tooTight: { name: 'Crowded a quick attacker', cat: 'onball', wrong: (c) => `You were only ${c.dm} ft off; this attacker needed about ${c.im} ft.`, should: () => 'Give a quick or strong driver an extra half step so his first step doesn\'t get past your hip.', why: () => 'Space buys you reaction time. Against a fast first step, being too close is the same as being beaten.', opp: () => 'A blow-by straight into the paint.', fix: () => 'Match the cushion to the scouting report: shooters tight, drivers a step off.' },
  gaveMiddle: { name: 'Gave up the middle', cat: 'onball', wrong: () => 'You were shaded toward the sideline, which opened the middle of the floor.', should: () => 'Shade a half step to the middle so his drive goes toward the sideline and the baseline help.', why: () => 'A middle drive has help on both sides to kick to; a sideline drive has only one.', opp: () => 'A middle drive with kick-outs to both sides.', fix: () => 'Your inside foot should be level with his middle shoulder.' },
  lateSlide: { name: 'Didn\'t beat him to the spot', cat: 'onball', wrong: () => 'When he drove, your slide didn\'t get in front of his path.', should: () => 'Push off your back foot and slide to a spot on his line, ahead of his shoulders.', why: () => 'You stop a drive by getting to the spot first, not by chasing it.', opp: () => 'A straight-line finish or a foul.', fix: () => 'Read his hips and shoulders, then slide to where he\'s going, not where he is.' },
  bitFake: { name: 'Bit on the fake', cat: 'onball', wrong: () => 'You reacted to the hesitation or pump fake.', should: () => 'Stay in your stance with your hand up until his feet or shoulders commit.', why: () => 'Fakes are designed to get you off balance. A set defender is hard to beat.', opp: () => 'An easy drive past an off-balance defender.', fix: () => 'Watch his midsection, not the ball.' },
  noContest: { name: 'No contest on the shot', cat: 'onball', wrong: () => 'He rose up and you didn\'t get a hand up.', should: () => 'Step in with a high hand, staying vertical, without jumping into him.', why: () => 'A contested jumper goes in far less often than an open one.', opp: () => 'An open jumper.', fix: () => 'When his eyes go to the rim, your hand goes to his eyes.' },
});
