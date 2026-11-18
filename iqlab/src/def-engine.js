// ===================== Defense Intelligence Center: engine =====================
// One rule-based "defensive brain" is the source of truth for every defensive module: given ten players, the ball,
// the assignments and what is happening (drive, ball screen, off-ball screen, cut, closeout, transition), it says
// where each defender should be, what his job is and why. Positioning tests, rotation questions, screen coverages,
// the mistake detector and the anticipation trainer all ask this same brain, so they never disagree.
// System taught: "no middle" man-to-man (shade the ball toward the sideline and baseline, the low man builds the
// wall), ball-you-man off the ball, help the helper, never help off the strong-side corner on a wing drive.
// These are coaching approximations in feet, with a tolerance per job, not a physics model.

const DCATS = {
  onball: 'On-ball defense', screens: 'Screen navigation', helpside: 'Help-side positioning', lowman: 'Low-man duties',
  rotations: 'Rotations', closeouts: 'Closeouts', transition: 'Transition defense', communication: 'Communication',
  anticipation: 'Anticipation', decisions: 'Decision-making',
};
const DLEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];
const XN = (d) => 'X' + d[1];
const ON = (o) => ROLE[o];
const MID_SHADE = 0.9;
const shadeMid = (p) => (Math.abs(p[0]) > 6 ? [-sgn(p[0]) * MID_SHADE, 0] : [0, 0]);
const DSIDE = (p) => (Math.abs(p[0]) < 4.5 ? 0 : sgn(p[0]));
const angleAt = (at, a, b) => { const u = norm(sub(a, at)), v = norm(sub(b, at)); return Math.acos(clamp(u[0] * v[0] + u[1] * v[1], -1, 1)) * 180 / Math.PI; };
const between = (at, man) => { const v = norm(sub(T_HOOP, man)); return (at[0] - man[0]) * v[0] + (at[1] - man[1]) * v[1]; };

// ---------- jobs: name, the intent you should pick, the category it trains, tolerance and teaching text ----------
// why/threat/next take a context {X: you, O: your man, B: ball handler, ...}.
const JOBS = {
  ball: { name: 'On the ball', intent: 'attached', cat: 'onball', tol: 2.2, why: (c) => `You guard the ball. Arm's length (about 3 ft), between ${c.O} and the rim, shaded a half step to the middle so his drive goes toward the sideline and baseline, where the low man is waiting.`, threat: (c) => `A straight-line drive to the rim, or a rhythm pull-up if you sag too far.`, next: (c) => `If he drives, slide and beat him to the spot. If he picks up the ball, crowd him and take away his passing angles.` },
  contain: { name: 'Containing the drive', intent: 'attached', cat: 'onball', tol: 2.4, why: (c) => `${c.O} is driving but you are still in front. Stay on his top side and keep your chest in his path. Don't reach.`, threat: () => 'The drive turning into a layup or a foul.', next: () => 'Wall up at the rim with high hands, or get back to him if he kicks it out.' },
  trail: { name: 'Beaten: recover', intent: 'attached', cat: 'onball', tol: 2.6, why: (c) => `${c.O} got past you. Sprint to his top hip and stay attached for a rear-view contest. Your help is coming, so make him pick up the ball early.`, threat: () => 'An uncontested layup, or a kick-out while your teammates are rotating.', next: () => 'Stay on him all the way to the rim, then find the open man if he passes.' },
  closeout: { name: 'Closeout', intent: 'attached', cat: 'closeouts', tol: 1.9, why: (c) => `The ball went to ${c.O}. Sprint the first two thirds, chop your feet the last third and finish about 3 ft away with a high hand, shaded to the middle so he can only drive toward help.`, threat: (c) => `${c.O} catching and shooting, or attacking a closeout that flies past him.`, next: () => 'Stay down on the pump fake. If he drives, you are the ball defender now.' },
  deny: { name: 'One pass away: deny', intent: 'deny', cat: 'helpside', tol: 2.4, why: (c) => `${c.O} is one pass from the ball and the scheme is denial. Get in the passing lane: one hand in it, ear on his chest. Stay close enough to react to a back cut.`, threat: (c) => `${c.O} catching in rhythm, or back-cutting if you get too high.`, next: () => 'If he cuts backdoor, open to the ball and beat him to the rim side.' },
  gap: { name: 'One pass away: gap', intent: 'gap', cat: 'helpside', tol: 2.6, why: (c) => `${c.O} is one pass from the ball. Sit in the gap, a step off him toward the ball and the rim. You can stunt at a drive and still close out on the catch.`, threat: (c) => `The ball handler driving through your gap, or ${c.O} getting a rhythm catch if you sag too far.`, next: () => 'Stunt at any drive into your gap, then close out if he passes to your man.' },
  stayHome: { name: 'Strong-side corner: stay home', intent: 'gap', cat: 'helpside', tol: 2.6, why: (c) => `Your man is in the ball-side corner. On a wing drive you do not help: the kick to the corner is the shortest pass on the floor and the most open three. Stunt with your hands, keep your feet home.`, threat: (c) => `${c.O} getting a corner three off the drive and kick.`, next: () => 'Close out short and high if the ball comes to the corner.' },
  stunt: { name: 'Nail: stunt and recover', intent: 'gap', cat: 'rotations', tol: 2.6, why: (c) => `The drive is coming toward your gap. Take one hard step at the ball to show your body and make the driver hesitate, then get back to ${c.O}. Don't fully commit: your man is one pass away.`, threat: (c) => `The driver getting downhill untouched, or a kick to ${c.O} if you overcommit.`, next: () => 'Recover to your man as the driver picks up the ball.' },
  help: { name: 'Help side', intent: 'help', cat: 'helpside', tol: 3, why: (c) => `${c.O} is two passes away. Sink toward the middle of the floor so you can see the ball and your man (ball-you-man) and get to a driver before he reaches the rim. A skip pass takes long enough for you to close out.`, threat: () => 'A drive or a cut into the lane that nobody meets.', next: () => 'Be ready to help on a drive or close out on a skip pass.' },
  nail: { name: 'Help side: at the nail', intent: 'help', cat: 'helpside', tol: 3, why: (c) => `${c.O} is two passes away at the top. Drop to the nail (middle of the free-throw line) so you clog the middle and can stunt at any drive, while staying close enough to get back on a skip.`, threat: () => 'A middle drive or a cutter running through an empty lane.', next: () => 'Stunt at middle drives, and fill toward the rim when a teammate helps.' },
  low: { name: 'Low man', intent: 'help', cat: 'lowman', tol: 3, why: (c) => `You are the low man: the weak-side defender closest to the baseline. Stand with a foot in the lane, under the rim on the weak side. You own baseline drives, the roller and anyone cutting to the basket.`, threat: () => 'A baseline drive or a roll to the rim with nobody at the basket.', next: () => 'Meet any baseline drive outside the restricted area, or tag the roller on a pick-and-roll.' },
  postFront: { name: 'Post: three-quarter front', intent: 'deny', cat: 'helpside', tol: 2.4, why: (c) => `${c.O} is posting on the ball side. Play him three-quarters on the ball side so the entry pass is hard and you stay between him and the ball.`, threat: (c) => `An easy entry to ${c.O} with deep position.`, next: () => 'Get behind him if the ball moves above the free-throw line.' },
  postBehind: { name: 'Post: behind', intent: 'attached', cat: 'helpside', tol: 2.4, why: (c) => `${c.O} is in the post with the ball at the top. Play behind him, chest on his back, so a lob over you isn't possible.`, threat: (c) => `${c.O} sealing you for a deep catch.`, next: () => 'Front him on the ball side when the ball goes to the wing.' },
  helpDrive: { name: 'Help on the drive', intent: 'help', cat: 'lowman', tol: 2.8, why: (c) => `${c.B} beat his man. You are the low man, so meet him before he gets to the rim: be set outside the restricted area in his path, vertical, hands high.`, threat: (c) => `${c.B} finishing at the rim.`, next: () => 'After the pass, sprint out to the nearest open shooter. Your teammates rotate behind you.' },
  showHelp: { name: 'Show help (don\'t commit)', intent: 'help', cat: 'decisions', tol: 2.8, why: (c) => `${c.B} is driving but his defender is still in front of him. Show your body halfway, enough to make him see you. Don't leave ${c.O} completely: the drive is contained.`, threat: () => 'Helping too early, which turns a contained drive into a kick-out three.', next: () => 'Get back to your man as soon as the driver picks up the ball or backs out.' },
  rotate: { name: 'Help the helper', intent: 'help', cat: 'rotations', tol: 3, why: (c) => `${c.H} left ${c.HM} to stop the drive. You are next in line: sink into the gap between your man and ${c.HM} so you can take ${c.HM} if the ball goes to him. He's closer to the rim; your own man is the farther, slower pass, and that's the one to give up.`, threat: (c) => `A dump-off to ${c.HM} for a dunk.`, next: (c) => `If the ball is kicked to ${c.O}, close out. The scramble has started.` },
  peel: { name: 'Peel switch', intent: 'help', cat: 'rotations', tol: 3, why: (c) => `You got beaten and the low man took your driver. Don't chase from behind: peel off to the man the helper left (${c.HM}). Now everyone is matched up again.`, threat: (c) => `${c.HM} wide open for a dump-off while two defenders chase one driver.`, next: () => 'Call "I got the corner!" so the helper knows he can stay with the driver.' },
  tag: { name: 'Tag the roller', intent: 'help', cat: 'lowman', tol: 2.8, why: (c) => `The screener's defender is up on the ball, so the roller is free. You are the low man: step into the roller's path and bump him before he catches near the rim, then get back.`, threat: (c) => `${c.R} catching the roll for a dunk.`, next: () => 'Once the screener\'s defender recovers, sprint back to your man or the open corner.' },
  fill: { name: 'Sink and fill', intent: 'help', cat: 'rotations', tol: 3.2, why: (c) => `The low man left to tag the roller. Sink into the split between your man and his so you can take the pass to either one. Help the helper.`, threat: () => 'A kick to the corner the low man left.', next: () => 'Close out to whoever the ball goes to on your side.' },
  scrOver: { name: 'Fight over the screen', intent: 'attached', cat: 'screens', tol: 2.4, why: (c) => `In this coverage you go over the screen. Get your top foot above the screener, skinny your body through and stay on ${c.O}'s hip so he can't turn the corner or pull up.`, threat: (c) => `${c.O} turning the corner, or getting a pull-up if you trail too far.`, next: () => 'Pressure from behind for a rear-view contest and get back in front.' },
  scrUnder: { name: 'Go under the screen', intent: 'attached', cat: 'screens', tol: 2.4, why: (c) => `In this coverage you go under: step behind the screener and meet ${c.O} on the other side. Do this against non-shooters.`, threat: (c) => `${c.O} pulling up behind the screen if he can shoot.`, next: () => 'Get back in front and close out under control.' },
  scrIce: { name: 'Ice the screen', intent: 'attached', cat: 'screens', tol: 2.4, why: (c) => `Ice means the ball can't use the screen toward the middle. Jump to the screen side, on top of ${c.O}, and push him toward the sideline and your big.`, threat: (c) => `${c.O} rejecting the ice back into the middle of the floor.`, next: () => 'Force him sideline into the big, then stay attached.' },
  switchRoll: { name: 'Switch to the screener', intent: 'switch', cat: 'screens', tol: 2.6, why: (c) => `It's a switch. Your teammate takes the ball, so you take the screener (${c.R}). Get between him and the rim right away so he can't slip.`, threat: (c) => `${c.R} slipping to the rim during the switch.`, next: () => 'Front or battle the roller if he posts the smaller defender.' },
  blitzBall: { name: 'Blitz: trap the ball', intent: 'attached', cat: 'screens', tol: 2.4, why: (c) => `It's a blitz: you and the screener's defender trap the ball. Take away the retreat dribble while your big takes the screen side.`, threat: () => 'A split of the trap or a quick pass to the roller.', next: () => 'Keep the trap until he gives it up, then sprint to the most dangerous open man.' },
  weakForce: { name: 'Weak: force the weak hand', intent: 'attached', cat: 'screens', tol: 2.4, why: (c) => `"Weak" means force him to his weak hand away from the screen. Sit on his strong-hand side so he has to go left.`, threat: () => 'The handler using his strong hand to attack the middle.', next: () => 'Keep him on his weak hand all the way to the help.' },
  bigDrop: { name: 'Big: drop', intent: 'help', cat: 'screens', tol: 3, why: (c) => `Drop coverage: sit back near the free-throw line, between the ball and the rim, so you can contain the drive and the roll at the same time. The guard chases over the top.`, threat: () => 'The roller behind you, or a floater in front of you if you drop too deep.', next: () => 'Stay level with the ball until your guard gets back, then recover to the roller.' },
  bigHedge: { name: 'Big: hedge and recover', intent: 'attached', cat: 'screens', tol: 2.6, why: (c) => `Hedge: jump out above the screen into the handler's path for a moment so he has to retreat. Then sprint back to the roller.`, threat: (c) => `${c.R} rolling free while you are out, until the tag arrives.`, next: () => 'Recover to the roller as soon as your guard is back in front.' },
  bigHardHedge: { name: 'Big: hard hedge', intent: 'attached', cat: 'screens', tol: 2.6, why: () => 'Hard hedge: get well above the screen and push the handler away from the basket, all the way out to 30 feet, before you recover.', threat: () => 'The handler splitting the hedge, or the roller slipping.', next: () => 'Sprint back to the roller. The low man holds him until you arrive.' },
  bigShow: { name: 'Big: show and recover', intent: 'attached', cat: 'screens', tol: 2.6, why: () => 'Show: step out to the level of the screen with your body, enough to slow the handler, then get back to your man right away. It\'s softer than a hedge.', threat: () => 'A pocket pass to the roller while you are showing.', next: () => 'Recover to the screener before he catches.' },
  bigBlitz: { name: 'Big: blitz', intent: 'attached', cat: 'screens', tol: 2.6, why: () => 'Blitz: jump out and trap the ball with the guard. Two on the ball means you are giving up the roller to the low man.', threat: () => 'A quick pocket pass to the roller playing 4-on-3.', next: () => 'Stay in the trap until the ball leaves, then sprint back toward the paint.' },
  bigSwitch: { name: 'Big: switch onto the ball', intent: 'switch', cat: 'screens', tol: 2.6, why: () => 'Switch: you take the ball handler. Give a little cushion and keep him in front. The guard takes the screener.', threat: () => 'A quick guard driving the big.', next: () => 'Contain and keep the ball out of the lane until the help arrives.' },
  bigIce: { name: 'Big: ice (low)', intent: 'help', cat: 'screens', tol: 3, why: () => 'Ice: drop to the sideline side of the screen, at about the free-throw line extended. The guard pushes the ball to you, and you keep it on the side.', threat: () => 'The handler turning the corner baseline between you and the guard.', next: () => 'Contain toward the baseline and recover to the screener on the pass.' },
  bigUnder: { name: 'Big: open the door', intent: 'attached', cat: 'screens', tol: 2.6, why: () => 'Your guard is going under. Step back off the screener so he has room to slide through.', threat: () => 'Pinching the gap and trapping your own guard behind the screen.', next: () => 'Stay with the screener as he rolls or pops.' },
  offTrail: { name: 'Trail the cutter', intent: 'attached', cat: 'screens', tol: 2.4, why: (c) => `${c.O} is using an off-ball screen. Chase on his hip, one step behind, and push him to curl into your help.`, threat: (c) => `${c.O} curling free, or popping for a catch-and-shoot if you go under.`, next: () => 'If he curls, stay on his hip; if he pops, close out high.' },
  offLock: { name: 'Top-lock the screen', intent: 'deny', cat: 'screens', tol: 2.4, why: (c) => `Denial scheme: top-lock ${c.O} on the ball side of the screen and push him toward the basket so he can't come out for a catch.`, threat: (c) => `${c.O} back-cutting behind you.`, next: () => 'Open up and run with him if he cuts backdoor.' },
  offSwitch: { name: 'Switch the off-ball screen', intent: 'switch', cat: 'screens', tol: 2.6, why: () => 'Switch: take the screener and let your teammate take the cutter. Talk early, so it happens before the screen hits.', threat: () => 'A slip by the screener during the switch.', next: () => 'Deny the slip, then guard your new man.' },
  offShow: { name: 'Screener\'s defender: show', intent: 'gap', cat: 'screens', tol: 2.6, why: (c) => `You guard the screener. Step into the cutter's path for a moment (a bump or show) so your teammate can get through, then get back to ${c.O}.`, threat: (c) => `The cutter curling free into the lane, or ${c.O} slipping if you stay out too long.`, next: () => 'Recover to the screener before he can catch on the slip or the pop.' },
  bump: { name: 'Bump the cutter', intent: 'help', cat: 'rotations', tol: 2.8, why: (c) => `${c.C} is cutting through the lane past you. Get your body into his path and bump him off his line. A cutter who gets knocked off his path can't catch it in rhythm.`, threat: (c) => `${c.C} catching a layup on the cut.`, next: () => 'Get back to your help spot once he clears.' },
  cutDeny: { name: 'Jump to the ball on the cut', intent: 'deny', cat: 'helpside', tol: 2.6, why: (c) => `${c.O} just passed and is cutting. Jump toward the ball the moment the pass leaves so he has to cut behind you, not in front of you.`, threat: (c) => `A give-and-go: ${c.O} catching in front of you for a layup.`, next: () => 'Stay between him and the ball as he cuts through, then find your help spot.' },
  transStop: { name: 'Transition: stop the ball', intent: 'attached', cat: 'transition', tol: 3, why: () => 'You are the defender nearest the ball in transition. Get in front of it above the three-point line and turn him so the offense has to slow down.', threat: () => 'The ball handler getting a full-speed layup or an open pull-up three.', next: () => 'Once the ball is stopped, match up with your teammates.' },
  transRim: { name: 'Transition: protect the rim', intent: 'help', cat: 'transition', tol: 3, why: () => 'You are back as the last line of defense. Sprint to the rim, then step up to the dotted line facing the ball. Layups are the first thing to take away.', threat: () => 'A layup or a lob to the rim before the defense is set.', next: () => 'Take the first pass, then the teammate behind you rotates down.' },
  transMatch: { name: 'Transition: match up', intent: 'attached', cat: 'transition', tol: 3.2, why: (c) => `Sprint back, then find ${c.O}. Shooters spotting up on the wing and in the corner get matched first.`, threat: (c) => `${c.O} trailing for an uncontested catch.`, next: () => 'Talk to your teammates and point at the man you have.' },
  trans2v1: { name: '2-on-1: bluff and protect', intent: 'help', cat: 'transition', tol: 3, why: () => 'You are alone against two. Stay between both of them, a step inside the free-throw line, and fake at the ball to slow it down. Make them throw a pass. Never let either one get a layup without a pass.', threat: () => 'An uncontested layup.', next: () => 'Contest the first shot and keep everything in front of you.' },
  trans3v2Top: { name: '3-on-2: top of the tandem', intent: 'attached', cat: 'transition', tol: 3, why: () => 'Tandem defense: you are on top. Stop the ball at the free-throw line extended and force a pass to a wing.', threat: () => 'The ball handler going all the way to the rim.', next: () => 'When the ball goes to a wing, the bottom defender takes it and you drop to the rim.' },
  trans3v2Bot: { name: '3-on-2: bottom of the tandem', intent: 'help', cat: 'transition', tol: 3, why: () => 'Tandem defense: you are on the bottom, in front of the rim. You take the first pass to a wing, and your partner drops behind you to the rim.', threat: () => 'A layup by the first wing if you stay too far out.', next: () => 'Close out on the first pass; your partner covers the rim.' },
};
const INTENTS = { attached: 'Stay attached', deny: 'Deny the pass', gap: 'Gap / stunt', help: 'Help / rotate', switch: 'Switch' };

// ---------- context ----------
function dctx(sit) {
  const pos = sit.pos, H = sit.ball, bp = pos[H];
  let side = DSIDE(bp);
  if (!side && sit.drive) side = sgn(sit.drive.at[0] || 1);
  if (!side && sit.screen?.kind === 'ball') side = -sgn(pos[sit.screen.screener][0] - bp[0] || 1);
  const info = {};
  for (const d of DEF) {
    const o = sit.assign[d], p = pos[o];
    const post = distHoop(p) < 11.5, weak = side !== 0 && p[0] * side < -3.5;
    const away = o === H ? 0 : weak ? 2 : (DSIDE(bp) === 0 && dist(p, bp) > 25 ? 2 : 1);
    info[d] = { o, p, post, weak, away };
  }
  const weakD = DEF.filter((d) => info[d].away === 2).sort((a, b) => info[a].p[1] - info[b].p[1]);
  const low = weakD[0] || null;
  return { bp, side, info, low, weakD };
}

/** Where every defender should be and why. Returns {spots: {D: {p, job, tol}}, ctx}. */
function teamSpots(sit) {
  if (sit.trans) return transSpots(sit);
  const pos = sit.pos, H = sit.ball, sc = sit.scheme || 'man', C = dctx(sit), bp = C.bp, side = C.side || 1, out = {};
  const put = (d, p, job, extra = {}) => { out[d] = { p: RR(clampCourt(p)), job, tol: JOBS[job].tol, ...extra }; };
  const scr = sit.screen, drv = sit.drive;
  const dOf = (o) => DEF.find((d) => sit.assign[d] === o);
  // Event roles first
  let helper = null, rotator = null, tagger = null, filler = null, bumper = null;
  if (drv && drv.beaten) {
    helper = C.low || DEF.filter((d) => sit.assign[d] !== H).sort((a, b) => distHoop(pos[a]) - distHoop(pos[b]))[0];
    if (drv.peel) rotator = dOf(H);
    else rotator = C.weakD.filter((d) => d !== helper).sort((a, b) => dist(C.info[a].p, C.info[helper].p) - dist(C.info[b].p, C.info[helper].p))[0] || null;
  } else if (drv) helper = C.low;
  if (scr?.kind === 'ball' && ['hedge', 'hardHedge', 'blitz', 'show', 'over', 'ice', 'drop', 'weak'].includes(scr.cov)) {
    tagger = C.weakD.filter((d) => sit.assign[d] !== scr.screener)[0] || null;
    if (['hedge', 'hardHedge', 'blitz'].includes(scr.cov)) filler = C.weakD.filter((d) => d !== tagger && sit.assign[d] !== scr.screener)[0] || null;
  }
  if (sit.cut) bumper = DEF.filter((d) => d !== dOf(sit.cut.who) && sit.assign[d] !== H && C.info[d].away === 2).sort((a, b) => segDist(pos[a] || pos[sit.assign[a]], sit.cut.from, sit.cut.to) - segDist(pos[b] || pos[sit.assign[b]], sit.cut.from, sit.cut.to))[0] || null;
  for (const d of DEF) {
    const I = C.info[d], o = I.o, p = I.p;
    // ---- the ball ----
    if (o === H) {
      if (sit.closeout && sit.closeout.to === o) { put(d, add(toward(p, T_HOOP, 3.2), shadeMid(p)), 'closeout'); continue; }
      if (drv) { if (drv.beaten && !drv.peel) put(d, toward(p, drv.from, 2), 'trail'); else if (drv.beaten && drv.peel) { /* handled as rotator below */ } else put(d, toward(p, T_HOOP, 2.4), 'contain'); if (!(drv.beaten && drv.peel)) continue; }
      else if (scr?.kind === 'ball' && scr.user === o) {
        const sp = pos[scr.screener], c = scr.cov;
        if (c === 'under') put(d, toward(sp, T_HOOP, 2.6), 'scrUnder');
        else if (c === 'ice') put(d, add(lerpP(p, sp, 0.42), [0, 0.6]), 'scrIce');
        else if (c === 'switch') put(d, toward(sp, T_HOOP, 2.2), 'switchRoll');
        else if (c === 'blitz') put(d, add(p, add(mul(norm(sub(p, sp)), 1.7), [0, -0.5])), 'blitzBall');
        else if (c === 'weak') put(d, add(toward(p, T_HOOP, 2.8), [1.3, 0]), 'weakForce');
        else put(d, add(add(p, mul(norm(sub(sp, p)), 1.3)), [0, 0.8]), 'scrOver');
        continue;
      } else { const gap = distHoop(p) > 27 ? 4.6 : sc === 'deny' ? 2.6 : 3; put(d, add(toward(p, T_HOOP, gap), shadeMid(p)), 'ball'); continue; }
    }
    if (sit.closeout && sit.closeout.to === o) { put(d, add(toward(p, T_HOOP, 3.2), shadeMid(p)), 'closeout'); continue; }
    // ---- ball screen roles ----
    if (scr?.kind === 'ball' && o === scr.screener) {
      const up = pos[scr.user], sp = p, c = scr.cov, away = norm(sub(sp, up));
      if (c === 'drop' || c === 'weak') put(d, toward(T_HOOP, sp, Math.max(8, distHoop(sp) - 8)), 'bigDrop');
      else if (c === 'hedge') put(d, add(add(sp, mul(away, -0.4)), add(mul([-away[1], away[0]], 0), [0, 1.6])), 'bigHedge');
      else if (c === 'hardHedge') put(d, add(up, [sgn(sp[0] - up[0] || 1) * 1.5, 1.8]), 'bigHardHedge');
      else if (c === 'show') put(d, add(sp, [0, 1.3]), 'bigShow');
      else if (c === 'blitz') put(d, add(up, [sgn(sp[0] - up[0] || 1) * 1.8, 0.4]), 'bigBlitz');
      else if (c === 'switch') put(d, toward(up, T_HOOP, 3), 'bigSwitch');
      else if (c === 'ice') put(d, add(toward(T_HOOP, up, 10), [sgn(up[0] || 1) * 1.5, 0]), 'bigIce');
      else if (c === 'under') put(d, toward(sp, T_HOOP, 1.6), 'bigUnder');
      else put(d, add(sp, [0, 1]), 'bigShow');
      continue;
    }
    if (d === tagger) { put(d, add(toward(T_HOOP, pos[scr.screener], 6.5), [-side * 1, 0]), 'tag'); continue; }
    if (d === filler) { const tm = pos[sit.assign[tagger]]; put(d, lerpP(p, tm, 0.5), 'fill'); continue; }
    // ---- off-ball screens ----
    if (scr && scr.kind !== 'ball') {
      if (o === scr.user) {
        if (scr.cov === 'switch') { put(d, toward(pos[scr.screener], T_HOOP, 2), 'offSwitch'); continue; }
        if (scr.cov === 'topLock') { put(d, add(p, mul(norm(sub(bp, p)), 1.6)), 'offLock'); continue; }
        put(d, toward(p, pos[scr.screener], 1.4), 'offTrail'); continue;
      }
      if (o === scr.screener) {
        if (scr.cov === 'switch') { put(d, add(pos[scr.user], mul(norm(sub(bp, pos[scr.user])), 1.8)), 'offSwitch'); continue; }
        put(d, toward(lerpP(p, pos[scr.user], 0.45), T_HOOP, 1), 'offShow'); continue;
      }
    }
    // ---- cut ----
    if (sit.cut && o === sit.cut.who) { put(d, toward(p, bp, 2.2), 'cutDeny'); continue; }
    if (d === bumper) { put(d, add(p.length ? lerpP(sit.cut.from, sit.cut.to, 0.55) : p, [0, 0]), 'bump'); continue; }
    // ---- drives ----
    if (drv) {
      const at = drv.at;
      if (d === helper) {
        if (drv.beaten) put(d, toward(T_HOOP, at, 5), 'helpDrive');
        else put(d, lerpP(lowSpot(C, side), toward(T_HOOP, at, 5.5), 0.45), 'showHelp');
        continue;
      }
      if (d === rotator && drv.beaten) {
        const hm = pos[sit.assign[helper]];
        if (drv.peel) put(d, toward(hm, T_HOOP, 2), 'peel'); else put(d, lerpP(p, hm, 0.62), 'rotate');
        continue;
      }
      if (I.away === 1 && !I.post) {
        const ballSideCorner = p[1] < 10 && Math.abs(p[0]) > 15 && sgn(p[0]) === sgn(at[0]);
        if (ballSideCorner) { put(d, lerpP(toward(p, T_HOOP, 3), at, 0.08), 'stayHome'); continue; }
        put(d, lerpP(p, at, 0.38), 'stunt'); continue;
      }
    }
    // ---- normal positioning ----
    if (I.post) {
      if (I.away === 2) { put(d, d === C.low ? lowSpot(C, side) : lerpP(p, [-side * 2.5, 9], 0.6), d === C.low ? 'low' : 'help'); continue; }
      if (bp[1] < 21) put(d, add(p, mul(norm(sub(bp, p)), 1.5)), 'postFront'); else put(d, toward(p, T_HOOP, 1.6), 'postBehind');
      continue;
    }
    if (I.away === 1) {
      if (sc === 'deny') put(d, add(add(p, mul(norm(sub(bp, p)), 2.2)), mul(norm(sub(T_HOOP, p)), 0.6)), 'deny');
      else {
        let q = toward(add(p, mul(norm(sub(bp, p)), Math.min(7, dist(p, bp) * 0.28))), T_HOOP, 2.2);
        if (sc === 'pack') q = packIn(q, 17);
        put(d, q, 'gap');
      }
      continue;
    }
    // two passes away
    const k = sc === 'pack' ? 0.85 : sc === 'deny' ? 0.62 : 0.76;
    if (DSIDE(bp) === 0) { put(d, lerpP(p, [sgn(p[0]) * 6, 9], 0.6), 'help'); continue; }
    if (d === C.low) { put(d, lowSpot(C, side), 'low'); continue; }
    if (p[1] > 21) { put(d, lerpP(p, [-side * 2.5, 19.5], Math.min(0.92, k + 0.1)), 'nail'); continue; }
    put(d, lerpP(p, [-side * 2.5, 14], k), 'help');
  }
  return { spots: out, ctx: C, helper, rotator, tagger, filler, bumper };
}
const lowSpot = (C, side) => (C.bp[1] < 10 ? [-side * 1.5, 7.5] : [-side * 3.2, 7.5]);

function transSpots(sit) {
  const pos = sit.pos, H = sit.ball, bp = pos[H], T = sit.trans, out = {};
  const put = (d, p, job) => { out[d] = { p: RR(clampCourt(p)), job, tol: JOBS[job].tol }; };
  const defs = DEF.filter((d) => pos[d]);
  if (T.kind === '2v1') { const o2 = OFF.find((o) => o !== H && pos[o]); put(defs[0], [lerp(bp[0], pos[o2][0], 0.4), 13], 'trans2v1'); return { spots: out, ctx: {} }; }
  if (T.kind === '3v2') { put(defs[0], toward(bp, T_HOOP, 4), 'trans3v2Top'); put(defs[1], [0, 8.5], 'trans3v2Bot'); return { spots: out, ctx: {} }; }
  // numbers back: closest to the ball stops it, the deepest protects the rim, the rest match the most dangerous
  const ballD = defs.slice().sort((a, b) => dist(pos[a], bp) - dist(pos[b], bp))[0];
  put(ballD, toward(bp, T_HOOP, 4), 'transStop');
  const rimD = defs.filter((d) => d !== ballD).sort((a, b) => pos[a][1] - pos[b][1])[0];
  put(rimD, [0, 8.5], 'transRim');
  const rest = defs.filter((d) => d !== ballD && d !== rimD);
  const threats = OFF.filter((o) => o !== H && pos[o]).sort((a, b) => (pos[a][1] - pos[b][1]));
  rest.forEach((d, i) => { const o = threats[i] || threats[0]; sit.assign[d] = o; put(d, toward(pos[o], T_HOOP, 4), 'transMatch'); });
  return { spots: out, ctx: {} };
}

// ---------- mistakes: what was wrong, what to do, why it matters, what it gave up, how to fix it ----------
const MISTAKES = {
  farFromMan: { name: 'Too far from your assignment', cat: 'helpside', wrong: (c) => `You were ${c.dm} ft from ${c.O}; the job needed about ${c.im} ft.`, should: (c) => `Stay within ${c.im + 1} ft so you can close out on the catch.`, why: () => 'Each extra foot of space is time a shooter gets to set his feet.', opp: (c) => `A rhythm catch-and-shoot for ${c.O}.`, fix: () => 'Look at the ball, then at your man. If the next pass goes to him, could you touch him by the time he catches it?' },
  overhelp: { name: 'Over-helping', cat: 'decisions', wrong: (c) => `You sank toward the ball while ${c.O} was one pass away.`, should: () => 'One pass away, sit in the gap: stunt, then get back. Don\'t leave him.', why: () => 'Helping off the man one pass away gives up the easiest pass on the floor.', opp: (c) => `A one-pass catch-and-shoot or a drive for ${c.O}.`, fix: () => 'Count passes: one pass away means gap and stunt; two passes away means real help.' },
  leftCorner: { name: 'Left the corner', cat: 'decisions', wrong: (c) => `You helped off ${c.O} in the strong-side corner.`, should: () => 'Stay home on a wing drive. Show your hands, keep your feet home.', why: () => 'The drive-and-kick to the strong-side corner is the shortest pass and the best three.', opp: (c) => `A wide-open corner three for ${c.O}.`, fix: () => 'Strong-side corner = stay home. The low man on the weak side helps instead.' },
  lateHelp: { name: 'Not in help position', cat: 'helpside', wrong: (c) => `You stayed near ${c.O} even though he was two passes away.`, should: () => 'Two passes away, sink to the help line with a foot near the paint.', why: () => 'Help that starts from too far away arrives after the layup.', opp: () => 'A drive or cut straight to the rim with nobody there.', fix: () => 'If the ball is on the other side, your feet belong near the middle of the floor.' },
  earlyHelp: { name: 'Helping too early', cat: 'decisions', wrong: () => 'You fully committed to a drive that was still contained.', should: () => 'Show help (be seen) but don\'t leave your man until the driver beats his defender.', why: () => 'Committing to a contained drive turns a bad shot into a kick-out three.', opp: (c) => `A kick-out to ${c.O}.`, fix: () => 'Look at the driver\'s defender: still in front means show; beaten means commit.' },
  missLow: { name: 'Missed the low-man rotation', cat: 'lowman', wrong: () => 'The drive came and you weren\'t between the driver and the rim.', should: (c) => `As the low man, meet ${c.B} outside the restricted area in his path.`, why: () => 'If the low man doesn\'t come, the whole defense has given up a layup.', opp: () => 'A layup or dunk at the rim.', fix: () => 'Know before the drive happens: "I\'m low." Then the rotation is automatic.' },
  noTag: { name: 'Failed to tag the roller', cat: 'lowman', wrong: () => 'The screener\'s defender was up on the ball and nobody bumped the roller.', should: () => 'Low man: step into the roller\'s path and bump him, then recover.', why: () => 'During a hedge or blitz the roller is 4-on-3 open until the tag.', opp: (c) => `A pocket pass or lob to ${c.R || 'the roller'} for a dunk.`, fix: () => 'When you see the big jump out, your first step is toward the roll lane.' },
  noRotate: { name: 'Missed the rotation', cat: 'rotations', wrong: () => 'Your teammate helped and you didn\'t rotate behind him.', should: (c) => `Sink to take ${c.HM || 'the helper\'s man'} near the rim.`, why: () => 'One help without a second rotation just moves the open man closer to the basket.', opp: (c) => `A dump-off to ${c.HM || 'the helper\'s man'} for a dunk.`, fix: () => 'Help the helper: when someone in front of you leaves, you take his man.' },
  closeAngle: { name: 'Incorrect closeout angle', cat: 'closeouts', wrong: () => 'You closed out square or on the middle side, so his drive went straight to the middle.', should: () => 'Finish your closeout shaded to the middle so his only drive is toward the sideline and help.', why: () => 'A square closeout gives him two ways to drive. A shaded closeout gives him one, into the help.', opp: (c) => `A middle drive by ${c.O} into an empty lane.`, fix: () => 'Close out to his middle shoulder, not his chest.' },
  flyBy: { name: 'Flew by on the closeout', cat: 'closeouts', wrong: () => 'You ran right up on the shooter.', should: () => 'Chop your feet the last few steps and stop about 3 ft away, hand high.', why: () => 'A closeout without balance is a free drive the moment he pump-fakes.', opp: (c) => `${c.O} pump-fakes and drives past you.`, fix: () => 'Sprint two thirds, chop the last third, high hand, weight back.' },
  shortClose: { name: 'Short closeout', cat: 'closeouts', wrong: (c) => `You stopped ${c.dm} ft from the shooter.`, should: () => 'Get to about 3 ft with a high hand.', why: () => 'Shooters make open shots. A hand in the face cuts shooting percentage by more than a third.', opp: (c) => `An uncontested shot for ${c.O}.`, fix: () => 'Close all the way. If you have to give up something, give up a contested drive, not an open shot.' },
  straightLine: { name: 'Allowed a straight-line drive', cat: 'onball', wrong: (c) => `You weren't between ${c.O} and the rim.`, should: () => 'Stay on the line from the ball to the rim, shaded a half step to the middle.', why: () => 'A straight-line drive has no angle to cut off. It forces the help to come early.', opp: (c) => `${c.O} driving straight at the rim.`, fix: () => 'Nose on the ball, back to the rim: you should be in his way, not next to him.' },
  caughtScreen: { name: 'Caught on the screen', cat: 'screens', wrong: () => 'You ended up behind or into the screener.', should: (c) => `Navigate the screen the way the coverage says (${c.jobName}).`, why: () => 'A defender stuck on a screen gives the handler a two-on-one with your big.', opp: () => 'A pull-up or a free run at the big.', fix: () => 'Get your top foot above the screen before it arrives. Talk so your big tells you it\'s coming.' },
  wrongCoverage: { name: 'Wrong screen coverage', cat: 'screens', wrong: (c) => `You didn't play the coverage. The job was: ${c.jobName}.`, should: (c) => c.should, why: () => 'Screen coverages only work when all five players do the same thing. One player freelancing leaves two players open.', opp: () => 'Either the handler or the roller gets an open look.', fix: () => 'Know the coverage before the screen comes: your spot depends on it.' },
  lostSight: { name: 'Lost ball-you-man', cat: 'helpside', wrong: () => 'From your spot you can\'t see your man and the ball at the same time.', should: () => 'Make a flat triangle: ball, you, man. Point a finger at each.', why: () => 'If you lose either one, you get back-cut or you miss the drive.', opp: (c) => `A back cut by ${c.O}.`, fix: () => 'Open your stance and keep both in your vision.' },
  wrongJob: { name: 'Wrong job', cat: 'communication', wrong: (c) => `You picked "${c.pick}". The job here was "${c.want}".`, should: (c) => c.jobWhy, why: () => 'Your position and your job are the same thing. Knowing the job is how teammates can trust where you\'ll be.', opp: () => 'A gap in the defense your teammates think is covered.', fix: () => 'Before every catch, say your job out loud: "Ball!", "Help!", "Deny!", "Switch!"' },
  offSpot: { name: 'Out of position', cat: 'decisions', wrong: (c) => `You were ${c.e} ft from the right spot.`, should: (c) => c.jobWhy, why: () => 'A few feet decides whether help arrives in time.', opp: () => 'An easier shot or pass for the offense.', fix: () => 'Use the anchors: ball, your man, the rim and the middle of the floor.' },
};

/** Grade a placed defender. Returns score (0-100), ok, error, ideal, and mistakes with teaching text. */
function judgeSpot(sit, d, at, intent) {
  const T = teamSpots(sit), I = T.spots[d], J = JOBS[I.job], man = sit.pos[sit.assign[d]], bp = sit.pos[sit.ball];
  const e = r1(dist(at, I.p)), dm = r1(dist(at, man)), im = r1(dist(I.p, man));
  const c = mkCtx(sit, d, T);
  Object.assign(c, { e, dm, im, jobName: J.name, jobWhy: J.why(c), should: J.why(c) });
  const codes = [];
  const job = I.job;
  if (e > I.tol) {
    if (['ball', 'contain'].includes(job) && between(at, man) < 0.8) codes.push('straightLine');
    else if (job === 'ball' && dm > im + 3) codes.push('farFromMan');
    else if (job === 'closeout') { if (dm < 1.8) codes.push('flyBy'); else if (dm > 5.2) codes.push('shortClose'); else codes.push('closeAngle'); }
    else if (['deny', 'gap', 'postFront', 'postBehind', 'stunt', 'cutDeny', 'transMatch'].includes(job)) codes.push(dm > im + 3 ? 'overhelp' : 'offSpot');
    else if (job === 'stayHome') codes.push(dm > im + 3 ? 'leftCorner' : 'offSpot');
    else if (['help', 'nail', 'low'].includes(job)) codes.push(dm < im - 3 ? 'lateHelp' : 'offSpot');
    else if (job === 'helpDrive') codes.push('missLow');
    else if (job === 'showHelp') codes.push(distHoop(at) < 7.5 ? 'earlyHelp' : 'offSpot');
    else if (job === 'tag') codes.push('noTag');
    else if (['rotate', 'fill', 'peel', 'bump'].includes(job)) codes.push('noRotate');
    else if (['scrOver', 'scrUnder', 'scrIce', 'blitzBall', 'weakForce', 'offTrail', 'offLock'].includes(job)) codes.push(sit.screen && dist(at, sit.pos[sit.screen.screener]) < 2.2 ? 'caughtScreen' : 'wrongCoverage');
    else if (/^big|switch|offShow|offSwitch/.test(job)) codes.push('wrongCoverage');
    else codes.push('offSpot');
  } else if (job === 'closeout' && Math.abs(man[0]) > 6 && (at[0] - I.p[0]) * sgn(man[0]) > 1.2) codes.push('closeAngle');
  if (!['ball', 'contain', 'trail', 'closeout', 'transStop', 'trans2v1', 'trans3v2Top', 'trans3v2Bot', 'transRim'].includes(job) && dist(at, man) > 2.5 && dist(at, bp) > 2.5 && angleAt(at, bp, man) > 160) codes.push('lostSight');
  const posScore = e <= I.tol ? 100 : Math.max(0, Math.round(100 - (e - I.tol) * 11));
  const want = J.intent, intentOk = intent == null ? null : intent === want;
  if (intentOk === false) { c.pick = INTENTS[intent]; c.want = INTENTS[want]; codes.push('wrongJob'); }
  const score = intent == null ? posScore : Math.round(posScore * 0.75 + (intentOk ? 25 : 0));
  const mistakes = [...new Set(codes)].map((k) => mistakeOut(k, c));
  return { score, ok: score >= 70, posScore, intentOk, e, ideal: I.p, job, jobName: J.name, cat: J.cat, tol: I.tol, mistakes, ctx: c, T, want };
}
function mkCtx(sit, d, T) {
  const o = sit.assign[d];
  const c = { X: XN(d), O: ON(o) || o, B: ON(sit.ball) };
  if (T.helper) { c.H = XN(T.helper); c.HM = ON(sit.assign[T.helper]); }
  if (sit.screen) c.R = ON(sit.screen.screener);
  if (sit.cut) c.C = ON(sit.cut.who);
  return c;
}
const mistakeOut = (k, c) => { const M = MISTAKES[k]; return { code: k, name: M.name, cat: M.cat, wrong: M.wrong(c), should: M.should(c), why: M.why(c), opp: M.opp(c), fix: M.fix(c) }; };

/** "What if you stood there": a short clip of the offense punishing the mistake. Returns beats (engine.js format). */
function whatIfBeats(sit, d, at, code) { return whatIfBeats0(sit, d, at, code).map((b) => (isShotBall(b.ball) && !b.reb ? { ...b, reb: d, rebSpot: [0, 9] } : b)); }
function whatIfBeats0(sit, d, at, code) {
  const o = sit.assign[d], H = sit.ball, man = sit.pos[o];
  const m0 = { [d]: at };
  if (['farFromMan', 'overhelp', 'leftCorner', 'shortClose', 'noRotate'].includes(code) && o !== H)
    return [{ d: 0.9, m: m0, ball: { pass: [H, o] }, cap: 'Ball swings to your man' }, { d: 1.1, m: { [d]: toward(at, man, 2) }, ball: { shot: o, three: distHoop(man) > 22 }, cap: 'Open shot', reb: d, rebSpot: [0, 9] }];
  if (['straightLine', 'flyBy', 'closeAngle', 'caughtScreen'].includes(code)) {
    const h = o === H || sit.closeout?.to === o ? o : H, hp = sit.pos[h];
    return [{ d: 1.1, m: { ...m0, [h]: toward(hp, T_HOOP, Math.max(2, distHoop(hp) - 4)) }, ball: h, cap: code === 'caughtScreen' ? 'He turns the corner' : 'Straight-line drive' }, { d: 0.9, m: {}, ball: { shot: h }, cap: 'Layup' }];
  }
  if (['missLow', 'lateHelp', 'earlyHelp'].includes(code) && sit.drive) return [{ d: 1, m: { ...m0, [sit.ball]: toward(sit.drive.at, T_HOOP, Math.max(1, distHoop(sit.drive.at) - 4)) }, ball: sit.ball, cap: 'Nobody meets him' }, { d: 0.9, m: {}, ball: { shot: sit.ball }, cap: 'Layup' }];
  if (code === 'noTag' && sit.screen) { const r = sit.screen.screener; return [{ d: 1, m: { ...m0, [r]: [sgn(sit.pos[r][0] || 1) * 2, 8] }, ball: H, cap: 'Roller is free' }, { d: 0.7, m: {}, ball: { pass: [H, r], lob: true }, cap: 'Lob' }, { d: 0.8, m: {}, ball: { shot: r }, cap: 'Dunk' }]; }
  if (code === 'lostSight' && o !== H) return [{ d: 1, m: { ...m0, [o]: [sgn(man[0] || 1) * 3, 8] }, ball: H, cap: 'Back cut' }, { d: 0.7, m: {}, ball: { pass: [H, o], bounce: true }, cap: 'Bounce pass' }, { d: 0.8, m: {}, ball: { shot: o }, cap: 'Layup' }];
  return [];
}

// ---------- situation generators ----------
const ALIGN = {
  '4out1in': { O1: SPOTS.slotL, O2: SPOTS.slotR, O3: SPOTS.wingL, O4: SPOTS.wingR, O5: SPOTS.postL },
  '5out': { O1: [0, 29], O2: [-19, 20], O3: [19, 20], O4: SPOTS.cornerL, O5: SPOTS.cornerR },
  '4outCorner': { O1: SPOTS.slotL, O2: SPOTS.slotR, O3: SPOTS.cornerL, O4: SPOTS.wingR, O5: SPOTS.postR },
  '3out2in': { O1: [0, 29], O2: [-19, 19], O3: [19, 19], O4: [-7, 8], O5: [7, 9] },
};
const SCHEME_NAME = { man: 'Man-to-man (no middle)', pack: 'Pack-line', deny: 'Denial' };
function baseSit(r, align, flip, scheme) {
  const pos = {}, A = ALIGN[align];
  for (const o of OFF) { const p = A[o]; pos[o] = RR([(flip ? -p[0] : p[0]) + (r() - 0.5) * 1.6, clamp(p[1] + (r() - 0.5) * 1.6, 2.5, 34)]); }
  return { pos, ball: 'O1', assign: Object.fromEntries(DEF.map((d, i) => [d, OFF[i]])), scheme, align };
}
function settle(sit) { const T = teamSpots(sit); for (const d of DEF) if (T.spots[d]) sit.pos[d] = T.spots[d].p; return sit; }
const rpick = (r, a) => a[Math.floor(r() * a.length)];

/**
 * Positioning test. kind: 'static' | 'drive' | 'screen' | 'closeout' | 'transition' | 'offscreen' | 'cut'.
 * focus (optional): a job or category to steer which defender you are.
 */
function genPositioning(seed, lvl = 0, opts = {}) {
  const r = rng(seed), flip = r() < 0.5, kinds = opts.kinds || [['static'], ['static', 'static', 'closeout', 'drive'], ['drive', 'screen', 'closeout', 'static', 'offscreen', 'transition'], ['drive', 'screen', 'offscreen', 'cut', 'transition', 'closeout']][lvl];
  const kind = rpick(r, kinds), scheme = lvl === 0 ? 'man' : rpick(r, ['man', 'man', 'pack', 'deny']);
  if (kind === 'transition') return genTransition(seed, lvl);
  const align = rpick(r, kind === 'screen' ? ['4out1in', '5out'] : Object.keys(ALIGN));
  const sit = baseSit(r, align, flip, scheme);
  const cand = OFF.filter((o) => sit.pos[o][1] > 12 && distHoop(sit.pos[o]) > 15);
  sit.ball = rpick(r, cand.length ? cand : OFF);
  let title = 'Half-court positioning', brief = '';
  if (kind === 'closeout') {
    const recv = rpick(r, OFF.filter((o) => o !== sit.ball && isPerim(sit.pos[o])));
    settle(sit); const prev = sit.ball; sit.ball = recv; sit.closeout = { to: recv, from: prev };
    // defenders are still where they were before the pass; you finish the closeout
    sit.you = DEF.find((d) => sit.assign[d] === recv);
    title = 'Closeout'; brief = `The ball was just swung to ${ON(recv)}. You were in help. Where does your closeout finish?`;
    return finishSit(sit, kind, title, brief, lvl);
  }
  if (kind === 'drive') {
    const H = rpick(r, OFF.filter((o) => isPerim(sit.pos[o])));
    sit.ball = H; settle(sit);
    const hp = sit.pos[H], base = DSIDE(hp) ? (r() < 0.6 ? 'baseline' : 'middle') : 'middle';
    const at = driveAt(hp, base, r);
    const beaten = lvl === 0 ? true : r() < 0.72;
    sit.drive = { who: H, from: hp, at, beaten, dir: base }; sit.pos[H] = at;
    title = beaten ? 'Help on a drive' : 'Contained drive';
    brief = `${ON(H)} is driving ${base === 'baseline' ? 'baseline' : 'toward the middle'}. His defender is ${beaten ? 'beaten and trailing' : 'still in front of him'}.`;
    sit.youPrefer = ['helpDrive', 'rotate', 'stayHome', 'stunt', 'showHelp', 'low'];
    return finishSit(sit, kind, title, brief, lvl, (s) => { s.pos[DEF.find((d) => s.assign[d] === H)] = beaten ? toward(at, hp, 2.4) : toward(at, T_HOOP, 2.4); });
  }
  if (kind === 'screen') {
    const H = rpick(r, OFF.filter((o) => sit.pos[o][1] > 16 && isPerim(sit.pos[o])));
    sit.ball = H; const scrO = OFF.filter((o) => o !== H).sort((a, b) => distHoop(sit.pos[a]) - distHoop(sit.pos[b]))[0];
    const hp = sit.pos[H], toMid = DSIDE(hp) ? -sgn(hp[0]) : (r() < 0.5 ? 1 : -1);
    sit.pos[scrO] = RR(add(hp, [toMid * 2.4, -1.4]));
    const cov = rpick(r, lvl < 2 ? ['drop', 'hedge', 'over', 'switch'] : ['drop', 'hedge', 'hardHedge', 'blitz', 'switch', 'ice', 'under', 'show', 'weak']);
    sit.screen = { kind: 'ball', user: H, screener: scrO, cov }; settle(sit);
    title = 'Ball screen: ' + BALL_COV[cov].name; brief = `${ON(scrO)} sets a ball screen for ${ON(H)}. Coverage: ${BALL_COV[cov].name}. ${BALL_COV[cov].short}`;
    sit.youPrefer = ['scrOver', 'scrUnder', 'scrIce', 'bigDrop', 'bigHedge', 'bigHardHedge', 'bigBlitz', 'bigShow', 'bigSwitch', 'switchRoll', 'tag', 'fill', 'bigIce', 'weakForce'];
    return finishSit(sit, kind, title, brief, lvl);
  }
  if (kind === 'offscreen') {
    const H = rpick(r, OFF.filter((o) => sit.pos[o][1] > 20)); sit.ball = H;
    const others = OFF.filter((o) => o !== H && isPerim(sit.pos[o]));
    const user = rpick(r, others), scr = OFF.filter((o) => o !== H && o !== user).sort((a, b) => dist(sit.pos[a], sit.pos[user]) - dist(sit.pos[b], sit.pos[user]))[0];
    const up = sit.pos[user]; sit.pos[scr] = RR(toward(up, [sgn(up[0] || 1) * 12, 18], 2.5));
    const cov = scheme === 'deny' ? 'topLock' : rpick(r, ['chase', 'chase', 'switch']);
    sit.screen = { kind: 'pin', user, screener: scr, cov }; settle(sit);
    title = 'Off-ball screen'; brief = `${ON(scr)} is screening for ${ON(user)}. Scheme: ${cov === 'switch' ? 'switch off-ball screens' : cov === 'topLock' ? 'top-lock (deny)' : 'chase (trail the cutter)'}.`;
    sit.youPrefer = ['offTrail', 'offShow', 'offLock', 'offSwitch'];
    return finishSit(sit, kind, title, brief, lvl);
  }
  if (kind === 'cut') {
    const H = rpick(r, OFF.filter((o) => isPerim(sit.pos[o]) && Math.abs(sit.pos[o][0]) > 12)); sit.ball = H;
    const who = OFF.filter((o) => o !== H && isPerim(sit.pos[o])).sort((a, b) => dist(sit.pos[a], sit.pos[H]) - dist(sit.pos[b], sit.pos[H]))[0];
    const from = sit.pos[who], to = [-sgn(sit.pos[H][0]) * 3, 8];
    sit.pos[who] = RR(lerpP(from, to, 0.45)); sit.cut = { who, from, to }; settle(sit);
    title = 'Cutter through the lane'; brief = `${ON(who)} passed and is cutting through the lane toward the weak side.`;
    sit.youPrefer = ['bump', 'cutDeny'];
    return finishSit(sit, kind, title, brief, lvl);
  }
  settle(sit);
  title = 'Ball-you-man'; brief = `The ball is with ${ON(sit.ball)} at the ${SPOT_LABEL[spotName(sit.pos[sit.ball])]}. Scheme: ${SCHEME_NAME[scheme]}.`;
  return finishSit(sit, 'static', title, brief, lvl);
}
function driveAt(hp, dir, r) {
  const s = sgn(hp[0] || 1);
  if (dir === 'baseline') return RR([s * clamp(Math.abs(hp[0]) - 7, 8, 13), clamp(hp[1] - 9, 4, 9)]);
  if (!DSIDE(hp)) return RR([s * 3, clamp(hp[1] - 11, 12, 16)]);
  return RR([s * clamp(Math.abs(hp[0]) - 10, 4, 9), clamp(hp[1] - 4, 11, 15)]);
}
function finishSit(sit, kind, title, brief, lvl, after) {
  const T = teamSpots(sit);
  // pick "you": prefer interesting jobs for this situation, never the same as nothing to do
  if (!sit.you) {
    const pref = sit.youPrefer || [];
    const pool = DEF.filter((d) => T.spots[d] && pref.includes(T.spots[d].job));
    const r = rng((sit.pos.O1[0] * 1000 + sit.pos.O2[1] * 77) >>> 0);
    sit.you = (pool.length && r() < 0.8 ? rpick(r, pool) : rpick(r, DEF.filter((d) => T.spots[d])));
  }
  if (after) after(sit);
  // your defender starts where he was before this moment (one step off his man toward the rim): you move him
  const man = sit.pos[sit.assign[sit.you]];
  sit.start = sit.closeout ? RR(lerpP(T.spots[sit.you].p, [0, 10], 0.7)) : RR(toward(man, T_HOOP, 1.2));
  if (sit.closeout) sit.start = RR(clampCourt(toward(T_HOOP, man, Math.min(12, distHoop(man) - 4))));
  sit.kind = kind; sit.title = title; sit.brief = brief; sit.lvl = lvl;
  sit.cat = JOBS[T.spots[sit.you].job].cat;
  return sit;
}
function genTransition(seed, lvl) {
  const r = rng(seed), kind = rpick(r, lvl < 2 ? ['2v1', '3v2'] : ['3v2', 'numbers', 'numbers']), pos = {}, flip = r() < 0.5 ? -1 : 1;
  let ball = 'O1', assign = {};
  if (kind === '2v1') { pos.O1 = [flip * 4, 32]; pos.O2 = [-flip * 14, 26]; pos.D1 = [0, 18]; assign = { D1: 'O1' }; }
  else if (kind === '3v2') { pos.O1 = [flip * 1, 33]; pos.O2 = [-17, 27]; pos.O3 = [17, 26]; pos.D1 = [flip * 4, 22]; pos.D2 = [-flip * 2, 15]; assign = { D1: 'O1', D2: 'O2' }; }
  else {
    pos.O1 = [flip * 6, 33]; pos.O2 = [-flip * 19, 24]; pos.O3 = [flip * 20, 22]; pos.O4 = [-flip * 3, 40]; pos.D1 = [flip * 2, 26]; pos.D2 = [-flip * 8, 18]; pos.D3 = [flip * 9, 30]; pos.D4 = [0, 38];
    assign = { D1: 'O1', D2: 'O2', D3: 'O3', D4: 'O4' };
  }
  for (const k in pos) pos[k] = RR([pos[k][0] + (r() - 0.5) * 2, pos[k][1] + (r() - 0.5) * 2]);
  const sit = { pos, ball, assign, trans: { kind }, scheme: 'man' };
  const T = teamSpots(sit), ds = Object.keys(T.spots);
  sit.you = rpick(r, ds);
  sit.start = RR([pos[sit.you][0], Math.min(40, pos[sit.you][1] + 6)]);
  sit.kind = 'transition'; sit.lvl = lvl; sit.cat = 'transition';
  sit.title = kind === '2v1' ? 'Transition: 2-on-1' : kind === '3v2' ? 'Transition: 3-on-2' : 'Transition: numbers back';
  sit.brief = kind === '2v1' ? 'Two attackers, one defender: you.' : kind === '3v2' ? 'Three attackers are running at two defenders.' : 'Four attackers are pushing. You and your teammates are sprinting back.';
  return sit;
}

// ---------- ball-screen coverages (screen lab) ----------
const BALL_COV = {
  drop: { name: 'Drop', short: 'The big sits back; the guard goes over.', call: 'Drop!', best: 'Against a non-shooting guard and a lob-threat roller.' },
  hedge: { name: 'Hedge and recover', short: 'The big jumps out for a moment, then recovers.', call: 'Hedge! Hedge!', best: 'To stop a guard from turning the corner, when you trust your low man to tag.' },
  hardHedge: { name: 'Hard hedge', short: 'The big pushes the handler back to 30 ft.', call: 'Hard hedge!', best: 'To take the ball out of an elite guard\'s hands for a moment.' },
  blitz: { name: 'Blitz', short: 'Two defenders trap the ball.', call: 'Blitz! Trap!', best: 'Late clock or against one star creator.' },
  switch: { name: 'Switch', short: 'The two defenders swap men.', call: 'Switch! I got ball!', best: 'When the defenders are similar sizes, or late in the clock.' },
  ice: { name: 'Ice', short: 'Side screens are forced away from the middle.', call: 'Ice! Ice!', best: 'Side pick-and-roll: keep the ball out of the middle.' },
  under: { name: 'Under', short: 'The guard goes under the screen.', call: 'Under!', best: 'Against a ball handler who can\'t shoot.' },
  show: { name: 'Show and recover', short: 'The big shows at the level of the screen, then gets back.', call: 'Show!', best: 'A softer hedge that keeps the big closer to the roller.' },
  over: { name: 'Over (soft show)', short: 'The guard fights over; the big shows lightly.', call: 'Screen left! / Screen right!', best: 'The default for most teams.' },
  weak: { name: 'Weak', short: 'Force the handler to his weak hand, away from the screen.', call: 'Weak! Weak!', best: 'Against a dominant-hand ball handler.' },
};
const SCREEN_TYPES = { high: 'High pick-and-roll', side: 'Side pick-and-roll', middle: 'Middle pick-and-roll', empty: 'Empty-side pick-and-roll', pin: 'Pin-down', flare: 'Flare screen', stagger: 'Staggered screens', spain: 'Spain pick-and-roll', multi: 'Multiple screens' };

// ---------- level adaptation & analytics ----------
const ddoc = () => doc('defense');
function dRecord(e) {
  const D = ddoc(); D.list.push({ ts: Date.now(), ...e });
  if (D.list.length > 900) D.list.splice(0, D.list.length - 900);
  // adapt the level for the category: 80%+ over the last 8 at this level → up, 40% or less → down
  const cat = e.cat, L = D.lvl[cat] ?? 0, recent = D.list.filter((x) => x.cat === cat && x.lvl === L).slice(-8);
  if (recent.length >= 6) {
    const acc = recent.filter((x) => x.ok).length / recent.length;
    if (acc >= 0.8 && L < 3) { D.lvl[cat] = L + 1; D.events.push({ ts: Date.now(), cat, up: true, to: L + 1 }); }
    else if (acc <= 0.4 && L > 0) { D.lvl[cat] = L - 1; D.events.push({ ts: Date.now(), cat, up: false, to: L - 1 }); }
  }
  if (D.events.length > 60) D.events.splice(0, D.events.length - 60);
  persist('defense');
}
const dLevel = (cat) => ddoc().lvl[cat] ?? 0;
function dStats() {
  const L = ddoc().list, by = {};
  for (const k of Object.keys(DCATS)) { const a = L.filter((x) => x.cat === k), last = a.slice(-12); by[k] = { n: a.length, acc: last.length ? Math.round(100 * last.filter((x) => x.ok).length / last.length) : null, avg: last.length ? Math.round(mean(last.map((x) => x.score))) : null, lvl: dLevel(k) }; }
  const last = L.slice(-40), rated = Object.values(by).filter((b) => b.avg != null);
  // Defensive IQ: average recent decision score per trained category, weighted by level reached
  const iq = rated.length ? Math.round(mean(rated.map((b) => b.avg * 0.85 + b.lvl * 5))) : null;
  const level = iq == null ? 'Not rated yet' : iq >= 90 ? 'Elite defender' : iq >= 78 ? 'Varsity-level IQ' : iq >= 62 ? 'Solid team defender' : iq >= 45 ? 'Developing' : 'Learning the basics';
  const mist = {}; for (const x of L.slice(-150)) for (const m of x.mistakes || []) mist[m] = (mist[m] || 0) + 1;
  const ms = L.filter((x) => x.ms != null).slice(-30);
  return { by, iq, level, n: L.length, recent: last, mist, speed: ms.length ? mean(ms.map((x) => x.ms)) / 1000 : null };
}
/** Coach: recommendations from recorded performance only. */
function dCoach() {
  const s = dStats(), out = [];
  const tried = Object.entries(s.by).filter(([, b]) => b.n >= 3);
  const weak = tried.filter(([, b]) => b.acc != null).sort((a, b) => a[1].acc - b[1].acc);
  const rep = Object.entries(s.mist).sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= 3);
  if (rep[0]) { const M = MISTAKES[rep[0][0]]; out.push({ k: 'mistake', cat: M.cat, title: `Fix: ${M.name.toLowerCase()}`, txt: `This mistake came up ${rep[0][1]} times in your last ${Math.min(150, s.n)} reps. ${M.fix({})}`, mod: CAT_MODULE[M.cat] }); }
  if (weak[0] && weak[0][1].acc < 75) out.push({ k: 'weak', cat: weak[0][0], title: `Work on ${DCATS[weak[0][0]].toLowerCase()}`, txt: `${weak[0][1].acc}% correct over your last ${Math.min(12, weak[0][1].n)} reps. That's your lowest category with enough reps to judge.`, mod: CAT_MODULE[weak[0][0]] });
  const untried = Object.keys(DCATS).filter((k) => !s.by[k].n);
  if (untried.length) out.push({ k: 'new', cat: untried[0], title: `Start ${DCATS[untried[0]].toLowerCase()}`, txt: `You haven't trained this yet, so there's no data on it.`, mod: CAT_MODULE[untried[0]] });
  const up = ddoc().events.slice(-1)[0];
  if (up && Date.now() - up.ts < 864e5 * 3) out.push({ k: 'level', cat: up.cat, title: up.up ? `Level up: ${DCATS[up.cat]}` : `Back to ${DLEVELS[up.to]}: ${DCATS[up.cat]}`, txt: up.up ? `You were 80%+ over 8 reps, so these reps are now ${DLEVELS[up.to]}.` : `You were 40% or lower over 8 reps, so the reps step back to ${DLEVELS[up.to]} until it clicks.`, mod: CAT_MODULE[up.cat] });
  return out;
}
const CAT_MODULE = { onball: 'onball', screens: 'screens', helpside: 'position', lowman: 'rotation', rotations: 'rotation', closeouts: 'position', transition: 'position', communication: 'screens', anticipation: 'anticipate', decisions: 'rotation' };
