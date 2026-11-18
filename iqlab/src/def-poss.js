// ===================== Defense Intelligence Center: possession composer =====================
// Builds team-defense possessions from offensive actions (pass, drive, kick, ball screen, off-ball screen, cut, skip).
// After every action the defensive brain (teamSpots) computes the correct reaction. The possession freezes BEFORE the
// reaction is shown, asks the question, then plays the correct rotation and explains the chain.
// Output: { start, phases: [{ beats, qs, reveal: { beats, labels, lines } }] } for the drill runner.

const JOB_TAG = { ball: 'BALL', contain: 'CONTAIN', trail: 'RECOVER', closeout: 'CLOSEOUT', deny: 'DENY', gap: 'GAP', stayHome: 'STAY HOME', stunt: 'STUNT', help: 'HELP', nail: 'NAIL', low: 'LOW MAN', postFront: 'FRONT', postBehind: 'BEHIND', helpDrive: 'HELP!', showHelp: 'SHOW', rotate: 'ROTATE', peel: 'PEEL', tag: 'TAG', fill: 'FILL', scrOver: 'OVER', scrUnder: 'UNDER', scrIce: 'ICE', switchRoll: 'SWITCH', blitzBall: 'TRAP', weakForce: 'WEAK', bigDrop: 'DROP', bigHedge: 'HEDGE', bigHardHedge: 'HARD HEDGE', bigShow: 'SHOW', bigBlitz: 'TRAP', bigSwitch: 'SWITCH', bigIce: 'ICE', bigUnder: 'OPEN', offTrail: 'TRAIL', offLock: 'TOP-LOCK', offSwitch: 'SWITCH', offShow: 'SHOW', bump: 'BUMP', cutDeny: 'JUMP', transStop: 'STOP BALL', transRim: 'RIM', transMatch: 'MATCH', trans2v1: 'BLUFF', trans3v2Top: 'TOP', trans3v2Bot: 'BOTTOM' };
const cloneSit = (s) => JSON.parse(JSON.stringify(s));
function defReact(sit) { const T = teamSpots(sit), m = {}; for (const d of DEF) if (T.spots[d]) m[d] = T.spots[d].p; return { m, T }; }
const jobLabels = (T, you) => Object.fromEntries(Object.entries(T.spots).map(([d, s]) => [d, (d === you ? 'YOU ' : XN(d) + ' ') + JOB_TAG[s.job]]));
function jobLines(T, sit, only) {
  return Object.entries(T.spots).filter(([d]) => !only || only.includes(d)).map(([d, s]) => { const c = mkCtx(sit, d, T); return `<b>${XN(d)} · ${JOBS[s.job].name}.</b> ${JOBS[s.job].why(c)}`; });
}
/** The most open offensive player (largest gap to the nearest defender), excluding the ball. */
function openMan(pos, holder) {
  let best = null, bd = -1; for (const o of OFF) { if (o === holder || !pos[o]) continue; const k = Math.min(...DEF.filter((d) => pos[d]).map((d) => dist(pos[d], pos[o]))); if (k > bd) { bd = k; best = o; } }
  return best;
}
/** Re-match assignments after a scramble: fixed pairs first, then greedy by distance. */
function rematch(sit, fixed) {
  const a = { ...fixed }, usedO = new Set(Object.values(fixed));
  const pairs = []; for (const d of DEF) if (!a[d]) for (const o of OFF) if (!usedO.has(o)) pairs.push([dist(sit.pos[d], sit.pos[o]), d, o]);
  pairs.sort((x, y) => x[0] - y[0]);
  for (const [, d, o] of pairs) if (!a[d] && !usedO.has(o)) { a[d] = o; usedO.add(o); }
  sit.assign = a;
}
const clearEv = (sit) => { delete sit.drive; delete sit.screen; delete sit.cut; delete sit.closeout; };

class PossBuilder {
  constructor(seed, lvl, align, scheme, flip) {
    this.r = rng(seed); this.lvl = lvl;
    this.sit = baseSit(this.r, align, flip ?? this.r() < 0.5, scheme); settle(this.sit);
    this.start = { pos: { ...this.sit.pos }, ball: this.sit.ball };
    this.phases = []; this.beats = []; this.chain = [];
  }
  get H() { return this.sit.ball; }
  P(o) { return this.sit.pos[o]; }
  dOf(o) { return DEF.find((d) => this.sit.assign[d] === o); }
  push(b) { this.beats.push(b); for (const [k, v] of Object.entries(b.m || {})) this.sit.pos[k] = v; }
  /** Pass and the defense adjusts during the flight (no question). */
  pass(to, cap) { const from = this.H; clearEv(this.sit); this.sit.ball = to; const { m } = defReact(this.sit); this.push({ d: 1, m, ball: { pass: [from, to] }, cap: cap || `${ON(from)} to ${ON(to)}` }); return this; }
  move(off, cap) { clearEv(this.sit); Object.assign(this.sit.pos, off); const { m } = defReact(this.sit); this.push({ d: 1, m: { ...off, ...m }, ball: this.H, cap }); return this; }
  /** Start a drive. Only the driver and his defender move; the rest of the defense hasn't reacted yet. */
  drive(dir, beaten, peel) {
    const H = this.H, from = this.P(H), at = driveAt(from, dir, this.r), dH = this.dOf(H);
    clearEv(this.sit); this.sit.drive = { who: H, from, at, beaten, peel, dir };
    this.push({ d: 1.1, m: { [H]: at, [dH]: beaten ? toward(at, from, 2.4) : toward(at, T_HOOP, 2.4) }, ball: H, cap: `${ON(H)} drives ${dir}` });
    return this;
  }
  /** Ball screen: the screener arrives. */
  ballScreen(screener, cov, spain) {
    const H = this.H, hp = this.P(H), toMid = DSIDE(hp) ? -sgn(hp[0]) : (this.r() < 0.5 ? 1 : -1), spot = RR(add(hp, [toMid * 2.4, -1.4]));
    clearEv(this.sit); this.sit.pos[screener] = spot; this.sit.screen = { kind: 'ball', user: H, screener, cov, spain };
    this.push({ d: 1, m: { [screener]: spot }, ball: H, cap: `${ON(screener)} sets the ball screen`, screen: screener, screenOn: this.dOf(H) });
    return this;
  }
  /** The handler comes off the screen and the screener rolls; the defense plays the coverage. */
  useScreen() {
    const s = this.sit.screen, H = s.user, hp = this.P(H), sp = this.P(s.screener), dir = norm(sub(sp, hp));
    const to = RR(clampCourt(add(sp, add(mul(dir, 4), [0, -2])))), roll = RR([sgn(sp[0] || 1) * 2.5, 9]);
    // the coverage is judged at the moment of the screen; then the handler comes off it and the defense recovers
    const { m, T } = defReact(this.sit);
    const s2 = cloneSit(this.sit); Object.assign(s2.pos, m); s2.pos[H] = to; s2.pos[s.screener] = roll; clearEv(s2);
    const m2 = defReact(s2).m;
    const beats = [{ d: 0.9, m: { ...m, [H]: RR(lerpP(hp, to, 0.35)) }, ball: H, cap: BALL_COV[s.cov]?.name || 'Screen' }, { d: 1.1, m: { ...m2, [H]: to, [s.screener]: roll }, ball: H, cap: 'Recover and match up' }];
    return { m, T, to, roll, beats, m2 };
  }
  offScreen(user, screener, cov) {
    const up = this.P(user), spot = RR(toward(up, [sgn(up[0] || 1) * 12, 18], 2.5));
    clearEv(this.sit); this.sit.pos[screener] = spot; this.sit.screen = { kind: 'pin', user, screener, cov };
    this.push({ d: 1, m: { [screener]: spot }, ball: this.H, cap: `${ON(screener)} screens for ${ON(user)}`, screen: screener, screenOn: this.dOf(user) });
    return this;
  }
  cut(who) {
    const from = this.P(who), to = RR([-sgn(this.P(this.H)[0] || 1) * 3, 8]);
    clearEv(this.sit); this.sit.cut = { who, from, to };
    const mid = RR(lerpP(from, to, 0.45)); this.sit.pos[who] = mid;
    this.push({ d: 0.9, m: { [who]: mid }, ball: this.H, cap: `${ON(who)} cuts through` });
    return this;
  }
  /** Close the current phase: questions are asked on the frozen frame, then the reveal plays. */
  freeze(qs, reveal) { this.phases.push({ beats: this.beats, qs: qs.filter(Boolean), reveal, sit: cloneSit(this.sit) }); this.beats = []; return this; }
  out(meta) { return { start: this.start, phases: this.phases, ...meta }; }
}

// ---------- question builders ----------
const Q = {
  helper: (T, sit) => T.helper && { kind: 'tapD', prompt: 'Tap the defender who has to help on this drive.', answer: T.helper, cat: 'lowman', why: `${XN(T.helper)} is the low man: the weak-side defender closest to the baseline. Weak-side help comes from under the rim. Never from the strong-side corner.` },
  rotator: (T, sit) => T.rotator && !sit.drive?.peel && { kind: 'tapD', prompt: `${XN(T.helper)} helps. Tap the defender who rotates behind him (help the helper).`, answer: T.rotator, cat: 'rotations', why: `${XN(T.rotator)} is next in line on the weak side. He sinks to take ${ON(sit.assign[T.helper])}, the man ${XN(T.helper)} left, because that man is now closest to the rim.` },
  open: (sitAfter, holder, cat = 'anticipation') => { const o = openMan(sitAfter.pos, holder); return o && { kind: 'tapO', prompt: 'After the rotation, tap the offensive player who is open.', answer: o, cat, why: `${ON(o)} is the man the last rotation gave up. A good defense gives up the pass that is farthest from the rim and takes the longest to throw.` }; },
  stayHome: (T) => { const d = Object.keys(T.spots).find((k) => T.spots[k].job === 'stayHome'); return d && { kind: 'chips', prompt: `${XN(d)} guards the strong-side corner. What does he do on this drive?`, choices: [{ k: 'stay', t: 'Stay home, show hands' }, { k: 'help', t: 'Help on the driver' }, { k: 'rim', t: 'Sprint to the rim' }], answer: 'stay', cat: 'decisions', mark: d, why: 'The strong-side corner never helps on a wing drive. The drive-and-kick to that corner is the shortest pass on the floor and the best three in basketball.' }; },
  stunt: (T, sit) => { const d = Object.keys(T.spots).find((k) => T.spots[k].job === 'stunt'); if (!d || sit.drive?.beaten) return null; return { kind: 'chips', prompt: `The driver is still contained. ${XN(d)} is one pass away. What should he do?`, choices: [{ k: 'stunt', t: 'Stunt and recover' }, { k: 'commit', t: 'Fully commit to help' }, { k: 'stay', t: 'Stay glued to his man' }], answer: 'stunt', cat: 'decisions', mark: d, why: 'A contained drive gets a stunt: one hard step to be seen, then back. Fully committing turns a contained drive into a kick-out. Staying glued lets the driver go downhill untouched.' }; },
  commit: (T, sit) => T.helper && sit.drive && { kind: 'chips', prompt: `Is this a drive ${XN(T.helper)} should fully commit to?`, choices: [{ k: 'commit', t: 'Yes: he\'s beaten, commit' }, { k: 'show', t: 'No: show and stay home' }], answer: sit.drive.beaten ? 'commit' : 'show', cat: 'decisions', mark: T.helper, why: sit.drive.beaten ? 'His defender is behind him, so the ball is headed to the rim: the low man commits and meets him outside the restricted area.' : 'His defender is still in front. Show your body, but don\'t give up your man for a drive that is already stopped.' },
  tag: (T, sit) => T.tagger && { kind: 'tapD', prompt: 'The screener\'s defender is up on the ball. Tap the defender who tags the roller.', answer: T.tagger, cat: 'lowman', why: `${XN(T.tagger)} is the low man. When the big jumps out, the roller is open for a moment, and the low man bumps him until the big gets back.` },
  call: (sit) => { const c = sit.screen?.cov; if (!c || !BALL_COV[c]) return null; const keys = Object.keys(BALL_COV).filter((k) => k !== c), r = rng(keys.length * 13 + c.length), wrong = keys.sort(() => r() - 0.5).slice(0, 3); const ch = [c, ...wrong].sort(() => r() - 0.5); return { kind: 'chips', prompt: `The coverage is ${BALL_COV[c].name.toLowerCase()}. What does the screener's defender yell as the screen comes?`, choices: ch.map((k) => ({ k, t: `"${BALL_COV[k].call}"` })), answer: c, cat: 'communication', why: `The big sees the screen first, so he calls it: "${BALL_COV[c].call}" tells the guard what to do before contact.` }; },
  covName: (sit) => { const c = sit.screen?.cov; if (!c) return null; const keys = Object.keys(BALL_COV).filter((k) => k !== c), r = rng(keys.length * 31 + c.length * 7), ch = [c, ...keys.sort(() => r() - 0.5).slice(0, 3)].sort(() => r() - 0.5); return { kind: 'chips', prompt: 'Watch the screener\'s defender. Which coverage is this?', choices: ch.map((k) => ({ k, t: BALL_COV[k].name })), answer: c, cat: 'anticipation', why: `${BALL_COV[c].name}: ${BALL_COV[c].short}` }; },
  closer: (sit, to) => { const d = DEF.find((k) => sit.assign[k] === to); return d && { kind: 'tapD', prompt: `The ball is kicked to ${ON(to)}. Tap the defender who closes out.`, answer: d, cat: 'closeouts', why: `${XN(d)} is closest and isn't responsible for anyone more dangerous. In a scramble, the nearest defender takes the ball and the rest match up behind him (an X-out).` }; },
  spot: (sit, you, prompt) => ({ kind: 'spot', prompt: prompt || 'Drag yourself to the right spot, then pick your job.', you, sit: cloneSit(sit), cat: null }),
  bumper: (T) => T.bumper && { kind: 'tapD', prompt: 'A cutter is coming through the lane. Tap the defender who bumps him.', answer: T.bumper, cat: 'rotations', why: `${XN(T.bumper)} is in the cutter's path on the help side. Bumping him off his line makes the give-and-go pass impossible.` },
  peel: (T, sit) => sit.drive?.peel && { kind: 'chips', prompt: `${XN(DEF.find((d) => sit.assign[d] === sit.ball))} got beaten baseline and the low man came over. What does the beaten defender do?`, choices: [{ k: 'peel', t: `Peel to ${ON(sit.assign[T.helper])}` }, { k: 'chase', t: 'Chase the driver' }, { k: 'stay', t: 'Stop and point' }], answer: 'peel', cat: 'rotations', why: 'Peel switch: the helper now has the driver, so the beaten defender takes the helper\'s man. Two defenders chasing one driver leaves the dunker spot open.' },
  spainBack: (sit) => sit.screen?.spain && { kind: 'chips', prompt: 'Spain action: the back-screener is about to pop to the top. What does his defender do?', choices: [{ k: 'bump', t: 'Bump the roller, then sprint to the popper' }, { k: 'stay', t: 'Stay attached to the popper only' }, { k: 'switch', t: 'Switch onto the ball handler' }], answer: 'bump', cat: 'screens', why: 'The back screen is meant to stop your big from getting back to the roller. The back-screener\'s defender bumps the roller first (the bigger threat at the rim), then sprints out to the popper as the pass is in the air.' },
};

// ---------- rotation simulator recipes ----------
const ROT_RECIPES = {
  wingDrive: { name: 'Wing drive baseline', cat: 'lowman', min: 0, desc: 'Ball swings to the wing, he drives baseline past his man. Help, rotate, find the open man.', build(B) {
    const wing = OFF.filter((o) => Math.abs(B.P(o)[0]) > 15 && B.P(o)[1] > 12)[0] || 'O3';
    B.pass(wing); B.drive('baseline', true);
    const after = defReact(B.sit); B.freeze([Q.helper(after.T, B.sit), Q.stayHome(after.T), B.lvl >= 1 && Q.rotator(after.T, B.sit), B.lvl >= 2 && Q.open({ ...B.sit, pos: { ...B.sit.pos, ...after.m } }, B.H)], revealOf(B, after, 'Low man helps, the weak side rotates behind him'));
    kickOut(B);
  } },
  slotDrive: { name: 'Slot drive to the middle', cat: 'decisions', min: 0, desc: 'A slot drive into the gaps. Stunt or commit?', build(B) {
    B.drive('middle', B.lvl >= 2 && B.r() < 0.5);
    const after = defReact(B.sit); B.freeze([Q.stunt(after.T, B.sit), Q.commit(after.T, B.sit), B.sit.drive.beaten && Q.rotator(after.T, B.sit)], revealOf(B, after, B.sit.drive.beaten ? 'Beaten: the help commits' : 'Contained: stunt and recover'));
    if (B.sit.drive.beaten) kickOut(B);
  } },
  cornerDrive: { name: 'Corner baseline drive', cat: 'lowman', min: 1, desc: 'Ball to the corner, baseline drive. The low man has to beat him to the spot.', build(B) {
    const cor = OFF.find((o) => B.P(o)[1] < 8 && Math.abs(B.P(o)[0]) > 15);
    if (cor && cor !== B.H) B.pass(cor); else B.pass(OFF.filter((o) => o !== B.H && isPerim(B.P(o)))[0]);
    B.drive('baseline', true);
    const after = defReact(B.sit); B.freeze([Q.helper(after.T, B.sit), Q.rotator(after.T, B.sit), Q.open({ ...B.sit, pos: { ...B.sit.pos, ...after.m } }, B.H)], revealOf(B, after, 'Low man meets the baseline drive'));
    kickOut(B);
  } },
  peel: { name: 'Peel switch', cat: 'rotations', min: 2, desc: 'Baseline drive, the low man helps, and the beaten defender peels.', build(B) {
    const wing = OFF.filter((o) => Math.abs(B.P(o)[0]) > 15 && B.P(o)[1] > 12)[0] || 'O3'; B.pass(wing); B.drive('baseline', true, true);
    const after = defReact(B.sit); B.freeze([Q.helper(after.T, B.sit), Q.peel(after.T, B.sit)], revealOf(B, after, 'Low man takes the driver, the beaten defender peels'));
    kickOut(B);
  } },
  skip: { name: 'Help, then skip: X-out', cat: 'rotations', min: 1, desc: 'Drive, help, rotate, then a skip pass to the far side. Who closes out?', build(B) {
    const wing = OFF.filter((o) => Math.abs(B.P(o)[0]) > 15 && B.P(o)[1] > 12)[0] || 'O3'; B.pass(wing); B.drive('baseline', true);
    const after = defReact(B.sit); B.freeze([Q.helper(after.T, B.sit)], revealOf(B, after, 'Help and rotate'));
    Object.assign(B.sit.pos, after.m); const helper = after.T.helper, rot = after.T.rotator, driverD = B.dOf(B.H);
    const fixed = { [helper]: B.H, [driverD]: B.sit.assign[helper] }; if (rot) fixed[rot] = B.sit.assign[helper];
    // the skip goes to the far perimeter player
    const far = OFF.filter((o) => o !== B.H && isPerim(B.P(o))).sort((a, b) => dist(B.P(b), B.P(B.H)) - dist(B.P(a), B.P(B.H)))[0];
    const closer = DEF.filter((d) => d !== driverD && d !== helper).sort((a, b) => dist(B.P(a), B.P(far)) - dist(B.P(b), B.P(far)))[0];
    const fx = { [helper]: B.H, [closer]: far }; rematch(B.sit, fx);
    const from = B.H; clearEv(B.sit); B.sit.ball = far; B.sit.closeout = { to: far, from };
    B.push({ d: 1.2, m: {}, ball: { pass: [from, far] }, cap: 'Skip pass' });
    const after2 = defReact(B.sit);
    B.freeze([Q.closer(B.sit, far), B.lvl >= 2 && Q.spot(B.sit, closer, `You are ${XN(closer)}. Drag yourself to where your closeout should finish.`)], revealOf(B, after2, 'X-out: the nearest defender closes, everyone re-matches'));
  } },
  pnrDrop: { name: 'High pick-and-roll: drop', cat: 'screens', min: 0, desc: 'High ball screen against drop coverage.', build(B) { pnr(B, 'drop'); } },
  pnrHedge: { name: 'Pick-and-roll: hedge + tag', cat: 'lowman', min: 1, desc: 'The big hedges, the low man tags the roller, the weak side fills.', build(B) { pnr(B, 'hedge'); } },
  pnrBlitz: { name: 'Pick-and-roll: blitz', cat: 'rotations', min: 2, desc: 'Two on the ball: the defense plays 4-on-3 behind it.', build(B) { pnr(B, 'blitz'); } },
  pnrSwitch: { name: 'Pick-and-roll: switch', cat: 'screens', min: 1, desc: 'Switch the screen and talk through it.', build(B) { pnr(B, 'switch'); } },
  spain: { name: 'Spain pick-and-roll', cat: 'screens', min: 2, desc: 'Ball screen plus a back screen on your big. Who covers the popper?', build(B) { pnr(B, 'drop', true); } },
  screenAway: { name: 'Screen away', cat: 'screens', min: 1, desc: 'Slot to slot, then the passer screens away. Show and trail.', build(B) {
    const other = OFF.find((o) => o !== B.H && Math.abs(B.P(o)[1] - 27.5) < 4 && isPerim(B.P(o)));
    if (other) B.pass(other);
    const passer = B.beats[0]?.ball?.pass?.[0] || OFF.find((o) => o !== B.H && isPerim(B.P(o)));
    const wing = OFF.filter((o) => o !== B.H && o !== passer && isPerim(B.P(o))).sort((a, b) => dist(B.P(a), B.P(passer)) - dist(B.P(b), B.P(passer)))[0];
    B.offScreen(wing, passer, B.sit.scheme === 'deny' ? 'topLock' : B.lvl >= 2 && B.r() < 0.4 ? 'switch' : 'chase');
    const after = defReact(B.sit), dS = B.dOf(passer);
    B.freeze([{ kind: 'chips', prompt: `${XN(dS)} guards the screener. What's his job?`, choices: [{ k: 'show', t: 'Show / bump the cutter, then recover' }, { k: 'stay', t: 'Stay attached to the screener' }, { k: 'switch', t: 'Switch onto the cutter' }, { k: 'sag', t: 'Sag into the paint' }], answer: B.sit.screen.cov === 'switch' ? 'switch' : 'show', cat: 'screens', mark: dS, why: B.sit.screen.cov === 'switch' ? 'The scheme is switch: call "Switch!" early and take the cutter. Your teammate takes the screener.' : 'Chase scheme: the cutter\'s defender trails, so you buy him a step by showing into the cutter\'s path, then get back to the screener before he can slip.' },
    B.lvl >= 1 && Q.spot(B.sit, B.dOf(wing), `You guard ${ON(wing)}, who is using the screen. Drag yourself to the right spot.`)], revealOf(B, after, 'Off-ball screen coverage'));
  } },
  cut: { name: 'Give-and-go cut', cat: 'helpside', min: 1, desc: 'Pass and cut through the lane: jump to the ball, bump the cutter.', build(B) {
    const wing = OFF.filter((o) => Math.abs(B.P(o)[0]) > 15 && B.P(o)[1] > 12)[0] || 'O3'; const passer = B.H; B.pass(wing); B.cut(passer);
    const after = defReact(B.sit); B.freeze([Q.bumper(after.T), Q.spot(B.sit, B.dOf(passer), `You guard ${ON(passer)}, the cutter. Drag yourself to the right spot.`)], revealOf(B, after, 'Jump to the ball, bump the cutter'));
  } },
};
function pnr(B, cov, spain) {
  const H = B.H, big = OFF.filter((o) => o !== H).sort((a, b) => distHoop(B.P(a)) - distHoop(B.P(b)))[0];
  B.ballScreen(big, cov, spain);
  const { m, T, to, roll, beats, m2 } = B.useScreen();
  const qs = [Q.call(B.sit), ['hedge', 'blitz', 'hardHedge'].includes(cov) && Q.tag(T, B.sit), B.lvl >= 1 && Q.spot(B.sit, B.dOf(H), `You guard ${ON(H)}. The screen is coming. Drag yourself to where the coverage puts you.`), spain && Q.spainBack(B.sit)];
  B.freeze(qs, { beats, labels: jobLabels(T), lines: [...jobLines(T, B.sit, DEF.filter((d) => !['help', 'gap', 'low', 'nail', 'deny'].includes(T.spots[d]?.job))), ...chainOf(T, B.sit)], title: `${BALL_COV[cov].name}: everyone's job`, T });
  clearEv(B.sit); Object.assign(B.sit.pos, m2); B.sit.pos[H] = to; B.sit.pos[big] = roll;
  if (B.lvl >= 2 && cov !== 'switch') {
    const sitA = { ...B.sit, pos: { ...B.sit.pos } }; clearEv(sitA);
    const o = openMan(sitA.pos, H);
    B.freeze([{ kind: 'tapO', prompt: 'The coverage is in place. Tap the offensive player the defense is giving up.', answer: o, cat: 'anticipation', why: `${ON(o)}: every coverage gives up something. Here the help came from his defender, so he's the pressure release.` }], { beats: [{ d: 1, m: {}, ball: { pass: [H, o] }, cap: 'Pressure release' }], labels: {}, lines: [`The pass goes to ${ON(o)}. The defense's next job: the nearest defender closes out under control while the big recovers to the roller.`], title: 'Where the ball goes next' });
  }
}
function revealOf(B, after, title) {
  const sit = cloneSit(B.sit);
  const lines = jobLines(after.T, sit, DEF.filter((d) => ['helpDrive', 'rotate', 'peel', 'stayHome', 'stunt', 'showHelp', 'tag', 'fill', 'closeout', 'trail', 'contain', 'offTrail', 'offShow', 'offLock', 'offSwitch', 'bump', 'cutDeny', 'bigDrop', 'bigHedge', 'scrOver'].includes(after.T.spots[d]?.job)));
  const chain = chainOf(after.T, sit);
  return { beats: [{ d: 1.1, m: after.m, ball: B.H, cap: title }], labels: jobLabels(after.T), lines: [...lines, ...chain], title, T: after.T };
}
/** The chain reaction: what breaks if each link fails. */
function chainOf(T, sit) {
  const out = [];
  if (T.helper && sit.drive?.beaten) {
    out.push(`<span class="chain">If ${XN(T.helper)} doesn't help → ${ON(sit.ball)} gets a layup.</span>`);
    if (T.rotator && !sit.drive.peel) out.push(`<span class="chain">If ${XN(T.rotator)} doesn't rotate → dump-off to ${ON(sit.assign[T.helper])} for a dunk.</span>`);
    const sh = Object.keys(T.spots).find((d) => T.spots[d].job === 'stayHome'); if (sh) out.push(`<span class="chain">If ${XN(sh)} helps from the corner → kick to ${ON(sit.assign[sh])} for an open corner three.</span>`);
  }
  if (T.tagger) out.push(`<span class="chain">If ${XN(T.tagger)} doesn't tag → pocket pass to ${ON(sit.screen.screener)} for a dunk. If he tags too long → his corner man is open.</span>`);
  return out;
}
function kickOut(B) {
  if (B.lvl < 1) return;
  const after = defReact(B.sit); Object.assign(B.sit.pos, after.m);
  const to = openMan(B.sit.pos, B.H), from = B.H, helper = after.T.helper, driverD = B.dOf(from);
  const closer = DEF.filter((d) => d !== driverD).sort((a, b) => dist(B.P(a), B.P(to)) - dist(B.P(b), B.P(to)))[0];
  rematch(B.sit, { [closer]: to, ...(helper && helper !== closer ? { [helper]: from } : {}) });
  clearEv(B.sit); B.sit.ball = to; B.sit.closeout = { to, from };
  B.push({ d: 1, m: {}, ball: { pass: [from, to] }, cap: 'Kick-out' });
  const after2 = defReact(B.sit);
  B.freeze([Q.closer(B.sit, to), B.lvl >= 2 && Q.spot(B.sit, closer, `You are ${XN(closer)}. Drag yourself to where your closeout should finish.`)], revealOf(B, after2, 'Close out and match up'));
}
function buildRotation(key, seed, lvl) {
  const R = ROT_RECIPES[key], r = rng(seed), align = rpick(r, key.startsWith('pnr') || key === 'spain' ? ['4out1in', '5out'] : key === 'cornerDrive' ? ['4outCorner', '5out'] : ['4out1in', '4outCorner', '5out']);
  const scheme = lvl >= 2 ? rpick(r, ['man', 'pack']) : 'man';
  const B = new PossBuilder(seed, lvl, align, scheme);
  if (key === 'wingDrive' || key === 'peel' || key === 'skip' || key === 'cut') { const s = OFF.find((o) => B.P(o)[1] > 24 && Math.abs(B.P(o)[0]) > 4); if (s) { B.sit.ball = s; B.start.ball = s; settle(B.sit); B.start.pos = { ...B.sit.pos }; } }
  if (key === 'slotDrive' || key.startsWith('pnr') || key === 'spain') { const s = OFF.find((o) => B.P(o)[1] > 24); if (s) { B.sit.ball = s; B.start.ball = s; settle(B.sit); B.start.pos = { ...B.sit.pos }; } }
  R.build(B);
  return B.out({ title: R.name, cat: R.cat, desc: R.desc, key, seed, lvl });
}

// ---------- anticipation: freeze mid-action and predict ----------
function buildAnticipation(seed, lvl) {
  const r = rng(seed), kinds = ['drive', 'pnr', 'swing', 'corner', 'reject'], kind = rpick(r, lvl === 0 ? ['drive', 'swing'] : kinds);
  const B = new PossBuilder(seed, lvl, rpick(r, ['4out1in', '5out', '4outCorner']), 'man');
  const tl = [9000, 7000, 5000, 3500][lvl];
  const top = OFF.find((o) => B.P(o)[1] > 24); if (top) { B.sit.ball = top; B.start.ball = top; settle(B.sit); B.start.pos = { ...B.sit.pos }; }
  if (kind === 'drive' || kind === 'corner') {
    const tgt = kind === 'corner' ? OFF.find((o) => B.P(o)[1] < 8 && Math.abs(B.P(o)[0]) > 15) : OFF.filter((o) => Math.abs(B.P(o)[0]) > 15 && B.P(o)[1] > 12)[0];
    if (tgt && tgt !== B.H) B.pass(tgt);
    const from = B.P(B.H), at = driveAt(from, 'baseline', B.r), H = B.H, dH = B.dOf(H);
    // only the first part of the drive is shown: predict before the help moves
    const mid = RR(lerpP(from, at, 0.45)); B.push({ d: 0.7, m: { [H]: mid, [dH]: toward(mid, from, 2) }, ball: H, cap: 'Drive' });
    B.sit.drive = { who: H, from, at, beaten: true, dir: 'baseline' }; B.sit.pos[H] = at;
    const after = defReact(B.sit), sitA = { ...B.sit, pos: { ...B.sit.pos, ...after.m } };
    const o = openMan(sitA.pos, H);
    B.freeze([{ ...Q.helper(after.T, B.sit), prompt: 'Predict: who has to help on this drive?', cat: 'anticipation', tlim: tl }, lvl >= 1 && { kind: 'tapO', prompt: 'Predict: after the help and rotation, where does the ball go next?', answer: o, cat: 'anticipation', tlim: tl, why: `${ON(o)} is the man the rotation gives up, so that's the pass a good driver looks for.` }],
      { beats: [{ d: 0.8, m: { ...after.m, [H]: at }, ball: H, cap: 'The defense reacts' }, { d: 1, m: {}, ball: { pass: [H, o] }, cap: 'Kick-out' }], labels: jobLabels(after.T), lines: chainOf(after.T, B.sit), title: 'What happened' });
  } else if (kind === 'pnr') {
    const big = OFF.filter((o) => o !== B.H).sort((a, b) => distHoop(B.P(a)) - distHoop(B.P(b)))[0], cov = rpick(r, ['drop', 'hedge', 'blitz', 'switch', 'ice', 'show']);
    B.ballScreen(big, cov); const { m, T, to, roll, beats } = B.useScreen(); const H = B.H;
    // show the coverage start (most of the defensive movement), then ask what it is
    const half = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, RR(lerpP(B.sit.pos[k], v, 0.7))]));
    B.push({ d: 0.9, m: { ...half, [H]: RR(lerpP(B.P(H), to, 0.4)) }, ball: H, cap: 'Screen' });
    B.freeze([{ ...Q.covName(B.sit), tlim: tl + 2000 }, lvl >= 1 && ['hedge', 'blitz'].includes(cov) && { ...Q.tag(T, B.sit), prompt: 'Predict: who has to tag the roller?', cat: 'anticipation', tlim: tl }],
      { beats, labels: jobLabels(T), lines: jobLines(T, B.sit, DEF.filter((d) => /^big|scr|tag|fill|switch|blitz/.test(T.spots[d]?.job))), title: BALL_COV[cov].name });
  } else if (kind === 'swing') {
    const nxt = OFF.find((o) => o !== B.H && Math.abs(B.P(o)[1] - B.P(B.H)[1]) < 6 && isPerim(B.P(o))) || OFF.find((o) => o !== B.H && isPerim(B.P(o)));
    const from = B.H; B.sit.ball = nxt; const after = defReact(B.sit); B.sit.ball = from;
    const moved = DEF.slice().sort((a, b) => dist(after.m[b], B.P(b)) - dist(after.m[a], B.P(a)))[0];
    B.freeze([{ kind: 'tapD', prompt: `Predict: ${ON(from)} swings it to ${ON(nxt)}. Which defender has to move the most?`, answer: moved, cat: 'anticipation', tlim: tl, mark: null, why: `${XN(moved)} goes from help to one-pass-away (or the reverse): every swing flips the help side, and the defender whose job changes moves the most.` }],
      { beats: [{ d: 1.1, m: after.m, ball: { pass: [from, nxt] }, cap: 'Ball reversal' }], labels: jobLabels(after.T), lines: jobLines(after.T, { ...B.sit, ball: nxt }, [moved]), title: 'The help side flips' });
  } else {
    // reject: the handler refuses the screen and goes the other way
    const big = OFF.filter((o) => o !== B.H).sort((a, b) => distHoop(B.P(a)) - distHoop(B.P(b)))[0]; B.ballScreen(big, 'over');
    const H = B.H, hp = B.P(H), sp = B.P(big), away = RR(clampCourt(add(hp, add(mul(norm(sub(hp, sp)), 6), [0, -5]))));
    const dH = B.dOf(H);
    B.freeze([{ kind: 'chips', prompt: 'Predict: the ball handler rejects the screen and goes the other way. Whose job is it to stop him first?', choices: [{ k: 'onball', t: 'His own defender' }, { k: 'big', t: 'The screener\'s defender' }, { k: 'low', t: 'The low man' }], answer: 'onball', cat: 'anticipation', tlim: tl, why: 'On a rejected screen his defender should already have been on the high side, so he still has to stop the ball. The low man is ready behind him. That\'s why the on-ball defender must never jump the screen early.' }],
      { beats: [{ d: 1.1, m: { [H]: away, [dH]: toward(away, T_HOOP, 2.6) }, ball: H, cap: 'Reject' }], labels: { [dH]: XN(dH) + ' CONTAIN' }, lines: ['Stay square until the handler commits to the screen. Jumping it early is how rejects beat you.'], title: 'Rejected screen' });
  }
  return B.out({ title: 'Read the next action', cat: 'anticipation', key: kind, seed, lvl });
}

// ---------- full possession (mistake detector): you guard one man the whole way ----------
function buildFullPossession(seed, lvl) {
  const r = rng(seed), B = new PossBuilder(seed, lvl, rpick(r, ['4out1in', '5out', '4outCorner']), lvl >= 2 ? rpick(r, ['man', 'pack']) : 'man');
  const top = OFF.find((o) => B.P(o)[1] > 24); if (top) { B.sit.ball = top; B.start.ball = top; settle(B.sit); B.start.pos = { ...B.sit.pos }; }
  const you = rpick(r, DEF.filter((d) => B.sit.assign[d] !== B.H)), man = () => B.sit.assign[you];
  const ask = (prompt) => Q.spot(B.sit, you, prompt);
  const after = (title) => { const a = defReact(B.sit); return { beats: [{ d: 0.9, m: a.m, ball: B.H, cap: title }], labels: jobLabels(a.T, you), lines: jobLines(a.T, B.sit, [you]), title, T: a.T }; };
  // 1) ball reversal: where are you after the pass?
  const swing = OFF.find((o) => o !== B.H && o !== man() && isPerim(B.P(o)) && Math.abs(B.P(o)[0]) > 8) || OFF.find((o) => o !== B.H && o !== man());
  const from = B.H; B.push({ d: 1, m: {}, ball: { pass: [from, swing] }, cap: 'Ball moves' }); B.sit.ball = swing;
  B.freeze([ask('The ball moved. Where should you be now?')], after('Adjust to the ball'));
  Object.assign(B.sit.pos, defReact(B.sit).m);
  // 2) drive or ball screen
  if (r() < 0.55) {
    B.drive(DSIDE(B.P(B.H)) ? 'baseline' : 'middle', lvl === 0 || r() < 0.7);
    B.freeze([ask(`${ON(B.H)} is driving. Where should you be?`)], after('React to the drive'));
    Object.assign(B.sit.pos, defReact(B.sit).m);
    kickOut(B);
    if (!B.phases.at(-1).qs.some((q) => q.kind === 'spot' && q.you === you)) B.phases.at(-1).qs.push(ask('The ball was kicked out. Where should you be?'));
  } else {
    const big = OFF.filter((o) => o !== B.H).sort((a, b) => distHoop(B.P(a)) - distHoop(B.P(b)))[0];
    B.ballScreen(big, rpick(r, ['drop', 'hedge', 'switch', 'blitz']));
    const { T, beats } = B.useScreen();
    B.freeze([ask(`Ball screen, ${BALL_COV[B.sit.screen.cov].name.toLowerCase()} coverage. Where should you be?`)], { beats, labels: jobLabels(T, you), lines: jobLines(T, B.sit, [you]), title: 'Coverage' });
  }
  return B.out({ title: `Full possession: you are ${XN(you)}`, cat: 'decisions', key: 'full', seed, lvl, you });
}
