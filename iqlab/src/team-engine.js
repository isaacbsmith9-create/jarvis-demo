// ===================== Team simulator engine =====================
// A possession is a sequence of beats (engine.js format), built step by step:
//   offense moves (from the play script, the team's rules, or the user's decision)
//   → the defense engine positions all five defenders from the coverage, the ball and the screens being set
//   → analysis (who is open, why) → options → the user's choice → outcome sampled from a seeded RNG.
// This is rule-based positioning, not physics or learned AI: defenders go where their coverage rules say, given
// where the ball and their assignment are. Everything is deterministic for a given seed and list of choices.

const T_HOOP = [0, 5.25];
const rimSpot = (side) => [side * 2.5, 8];
const sgn = (v) => (v < 0 ? -1 : 1);
const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const lerpP = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const toward = (a, b, d) => { const v = sub(b, a), L = Math.hypot(v[0], v[1]) || 1; return add(a, mul(v, d / L)); };
const RR = (p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
const clampCourt = (p) => [clamp(p[0], -24, 24), clamp(p[1], 1, 40)];
const defOf = (S, o) => Object.keys(S.assign).find((d) => S.assign[d] === o);
const covOf = (S) => COVERAGES[S.cov];
const isPerim = (p) => distHoop(p) > 13;

// ---------------- defense engine ----------------
/**
 * Where every defender should stand. pos: all ten players (offense at the end of this beat), holder: ball handler.
 * events: screens / drives / cuts happening in this beat. Returns {m, notes, assign, roles} where roles explains
 * what each defender is doing (on ball, denying, helping, trapping, switching…).
 */
function defend(S, pos, holder, events = []) {
  const cov = covOf(S), I = S.intensity, m = {}, notes = [], roles = {};
  let assign = { ...S.assign };
  const ball = pos[holder];
  if (cov.type === 'zone') return zoneDefend(S, pos, holder, events);
  const k = 0.75 + 0.15 * I; // intensity scaling
  // Switches change assignments first.
  for (const e of events) {
    if ((e.type === 'offScreen' && cov.offBall === 'switch') || (e.type === 'ballScreen' && cov.onBall === 'switch') || (e.type === 'backScreen' && cov.offBall === 'switch')) {
      const dU = Object.keys(assign).find((d) => assign[d] === e.user), dS = Object.keys(assign).find((d) => assign[d] === e.screener);
      if (dU && dS) { assign[dU] = e.screener; assign[dS] = e.user; notes.push({ t: 'switch', txt: `X${dS[1]} and X${dU[1]} switched the screen` + mismatchTxt(S, dS, e.user) }); }
    }
  }
  for (const d of DEF) {
    const o = assign[d], p = pos[o]; if (!p) continue;
    if (o === holder) {
      const gap = cov.ballGap / k;
      let q = toward(p, T_HOOP, gap);
      if (cov.overplay) q = add(q, [sgn(p[0]) * -0.8, 0]);
      m[d] = q; roles[d] = gap < 2.6 ? 'pressure' : 'on ball';
      continue;
    }
    const dB = dist(p, ball), perim = isPerim(p);
    const onePass = perim && dB < 27;
    if (distHoop(p) < 11) { // post defense: three-quarter front on the ball side, behind on the weak side
      const ballSide = sgn(p[0]) === sgn(ball[0]) || Math.abs(ball[0]) < 6;
      m[d] = ballSide ? toward(p, ball, 1.6) : toward(p, T_HOOP, 2); roles[d] = ballSide ? 'fronting post' : 'behind post';
      if (cov.packline) m[d] = lerpP(m[d], [sgn(p[0]) * 3, 10], 0.3);
      continue;
    }
    if (onePass) {
      const dn = clamp((cov.deny || 0) * k, 0, 1);
      const base = guard(p, ball, 3.2, 0.22);
      const lane = add(toward(p, ball, 2.1), mul(sub(T_HOOP, p), 0.04));
      let q = lerpP(base, lane, dn);
      if (cov.overplay) q = add(q, mul(norm(sub(p, T_HOOP)), 0.9));
      if (cov.packline) q = packIn(q, 16.5);
      m[d] = q; roles[d] = dn > 0.6 ? 'denying' : 'one pass away';
    } else {
      const helpSpot = clampCourt([clamp((ball[0] + 0) * 0.35, -7, 7), clamp((ball[1] + T_HOOP[1]) / 2, 8, 18)]);
      const h = clamp((cov.help || 0.4) * (0.8 + 0.1 * I), 0, 0.95);
      let q = lerpP(guard(p, ball, 3, 0), helpSpot, h * 0.65);
      if (cov.packline) q = packIn(q, 15.5);
      m[d] = q; roles[d] = 'help side';
    }
  }
  // Event-specific reactions.
  for (const e of events) {
    const dU = Object.keys(assign).find((d) => assign[d] === e.user), dS = Object.keys(assign).find((d) => assign[d] === e.screener);
    if (e.type === 'offScreen') {
      const style = cov.offBall;
      if (style === 'chase' && dU) { m[dU] = toward(pos[e.user], e.from || pos[e.screener], 2.6); roles[dU] = 'chasing'; notes.push({ t: 'chase', txt: `X${dU[1]} chased ${nm(S, e.user)} over the screen and trails him` }); if (dS) { m[dS] = lerpP(m[dS], pos[e.user], 0.35); roles[dS] = 'showing on the curl'; } }
      if (style === 'topLock' && dU) { m[dU] = add(pos[e.user], mul(norm(sub(ball, pos[e.user])), 1.8)); roles[dU] = 'top-locking'; notes.push({ t: 'lock', txt: `X${dU[1]} top-locked ${nm(S, e.user)} to deny the catch: the space behind him is open` }); }
      if (style === 'under' && dU) { m[dU] = toward(pos[e.screener], T_HOOP, 2.4); roles[dU] = 'under the screen'; notes.push({ t: 'under', txt: `X${dU[1]} went under the screen, giving ${nm(S, e.user)} room to catch and shoot` }); }
      if (style === 'switch' && dS) { roles[dS] = 'switched'; }
    }
    if (e.type === 'ballScreen') {
      const H = e.user, Sc = e.screener, dH = dU, dSc = dS, pH = pos[H], pSc = pos[Sc];
      const st = cov.onBall;
      if (st === 'over' && dH && dSc) { m[dH] = toward(pH, e.from || pSc, 2.4); m[dSc] = lerpP(pSc, pH, 0.35); roles[dH] = 'chasing over'; roles[dSc] = 'soft show'; }
      if (st === 'hedge' && dH && dSc) { m[dSc] = add(pH, mul(norm(sub(pH, T_HOOP)), -0.5)).map((v, i) => v + (i === 0 ? sgn(-pH[0] || 1) * 2.2 : 0)); m[dH] = toward(pH, e.from || pSc, 2.2); roles[dSc] = 'hedging'; notes.push({ t: 'hedge', txt: `X${dSc[1]} hedged hard on ${nm(S, H)}; the roller is unguarded until he recovers` }); }
      if (st === 'blitz' && dH && dSc) { m[dSc] = add(pH, [sgn(-pH[0] || 1) * 2.2, -0.6]); m[dH] = add(pH, [sgn(pH[0] || 1) * 2.0, -1.2]); roles[dSc] = roles[dH] = 'trapping'; notes.push({ t: 'blitz', txt: `X${dH[1]} and X${dSc[1]} trapped the ball. Two on the ball means 4-on-3 behind it` }); const low = lowMan(S, pos, holder, assign, [dH, dSc]); if (low) { m[low] = lerpP(m[low], pSc, 0.7); roles[low] = 'tagging the roller'; } }
      if (st === 'drop' && dH && dSc) { m[dSc] = lerpP(T_HOOP, pSc, 0.42); m[dH] = toward(pH, e.from || pSc, 2.6); roles[dSc] = 'dropping'; notes.push({ t: 'drop', txt: `X${dSc[1]} dropped toward the paint: the pull-up is open, the roll is covered` }); }
      if (st === 'ice' && dH && dSc) { m[dH] = add(pH, [sgn(pSc[0] - pH[0] || 1) * 1.8, -1]); m[dSc] = lerpP(T_HOOP, pH, 0.5); roles[dH] = 'icing'; roles[dSc] = 'waiting low'; notes.push({ t: 'ice', txt: `X${dH[1]} iced the screen, forcing ${nm(S, H)} away from the middle` }); }
      if (st === 'under' && dH) { m[dH] = toward(pSc, T_HOOP, 2.5); roles[dH] = 'under the screen'; notes.push({ t: 'under', txt: `X${dH[1]} went under the ball screen: the shot is open` }); }
      if (st === 'switch' && dSc) roles[dSc] = 'switched onto the ball';
    }
    if (e.type === 'backScreen') {
      if (cov.offBall !== 'switch' && dU) { m[dU] = add(e.from || pos[e.screener], [-(e.side || 1) * 0.5, 1.2]); roles[dU] = 'caught on the back screen'; notes.push({ t: 'back', txt: `X${dU[1]} got caught on ${nm(S, e.screener)}'s back screen; ${nm(S, e.user)} rolls free` }); if (dS && (cov.onBall === 'drop' || cov.onBall === 'over')) { m[dS] = lerpP(m[dS], pos[e.user], 0.55); roles[dS] = 'helping on the roll'; } }
    }
    if (e.type === 'drive') {
      const D = dU; if (D) { m[D] = add(pos[e.user], mul(norm(sub(e.from, pos[e.user])), 2.2)); roles[D] = 'beaten, trailing'; }
      const helper = nearestHelper(S, pos, assign, e.user, pos[e.user], [D]);
      if (helper) { m[helper] = toward(pos[e.user], T_HOOP, 2.3); roles[helper] = 'helping on the drive'; notes.push({ t: 'help', txt: `X${helper[1]} left ${nm(S, assign[helper])} to stop the drive` }); }
      if (cov.packline) { const h2 = nearestHelper(S, pos, assign, e.user, pos[e.user], [D, helper]); if (h2) { m[h2] = lerpP(m[h2], pos[e.user], 0.5); roles[h2] = 'pack-line help'; } }
    }
    if (e.type === 'cut' && dU) {
      const beat = cov.deny > 0.6 && e.basket; m[dU] = add(pos[e.user], mul(norm(sub(e.from, pos[e.user])), beat ? 3.4 : 1.8)); roles[dU] = beat ? 'beaten on the cut' : 'trailing the cutter';
    }
  }
  for (const d of DEF) if (m[d]) m[d] = RR(clampCourt(m[d]));
  return { m, notes, assign, roles };
}
const packIn = (q, r) => { const d = distHoop(q); return d <= r ? q : toward(T_HOOP, q, r); };
const nm = (S, o) => (S.names?.[o] || o);
function mismatchTxt(S, d, o) { const ds = S.size['O' + d[1]], os = S.size[o]; return Math.abs(os - ds) >= 2 ? ` (mismatch: ${ds < os ? 'smaller' : 'bigger'} defender on ${nm(S, o)})` : ''; }
function lowMan(S, pos, holder, assign, excl) {
  let best = null, bd = 1e9; for (const d of DEF) { if (excl.includes(d)) continue; const p = pos[assign[d]]; if (!p) continue; const v = distHoop(p) + (sgn(p[0]) === sgn(pos[holder][0]) ? 12 : 0); if (v < bd) { bd = v; best = d; } } return best;
}
function nearestHelper(S, pos, assign, driver, at, excl) {
  let best = null, bd = 1e9; for (const d of DEF) { if (excl.includes(d) || assign[d] === driver) continue; const p = S.pos[d] || pos[assign[d]]; const v = dist(p, toward(at, T_HOOP, 3)); if (v < bd) { bd = v; best = d; } } return best;
}
/** Zones: each defender owns an area; the one whose area holds the ball closes out, the rest shift with the ball. */
const ZONE_BASE = {
  '23': { D1: [-7, 22], D2: [7, 22], D3: [-13, 8], D4: [13, 8], D5: [0, 8.5] },
  '32': { D1: [0, 26], D2: [-14, 19], D3: [14, 19], D4: [-6, 8], D5: [6, 8] },
};
function zoneDefend(S, pos, holder, events) {
  const cov = covOf(S), base = ZONE_BASE[cov.shape], ball = pos[holder], m = {}, roles = {}, notes = [];
  let owner = null, bd = 1e9;
  for (const d of DEF) { const v = dist(base[d], ball) - (d === 'D5' && cov.shape === '23' ? 3 : 0); if (v < bd) { bd = v; owner = d; } }
  const shift = [clamp(ball[0] * 0.38, -8, 8), clamp((ball[1] - 20) * 0.12, -2, 2)];
  for (const d of DEF) {
    if (d === owner) { m[d] = toward(ball, T_HOOP, cov.ballGap / (0.8 + 0.12 * S.intensity)); roles[d] = 'zone: on the ball'; continue; }
    let q = add(base[d], shift);
    if (cov.shape === '23' && ['D3', 'D4'].includes(d) && ball[1] < 12 && sgn(ball[0]) === sgn(base[d][0])) q = lerpP(q, ball, 0.5);
    m[d] = RR(clampCourt(q)); roles[d] = 'zone: ' + (dist(q, ball) < 14 ? 'ball side' : 'weak side');
  }
  if (events.some((e) => /Screen/.test(e.type))) notes.push({ t: 'zone', txt: 'The zone ignored the screen: defenders stayed in their areas, so the screener and cutters find gaps instead of separation' });
  const assign = {}; for (const d of DEF) { let o2 = null, b2 = 1e9; for (const o of OFF) { const v = dist(m[d], pos[o]); if (v < b2) { b2 = v; o2 = o; } } assign[d] = o2; }
  return { m, notes, assign, roles };
}

// ---------------- possession state & beats ----------------
function newPossession(cfg) {
  const play = cfg.play, S = {
    cfg, cov: cfg.covPlan[0].cov, intensity: cfg.intensity, mode: cfg.mode, rng: rng(cfg.seed * 7919 + 13),
    pos: { ...play.start }, ball: play.ball, assign: Object.fromEntries(DEF.map((d, i) => [d, OFF[i]])), size: {}, names: {},
    beats: [], notes: [], decisions: [], stepIdx: 0, offScript: false, over: null, events: [], lastScreen: null, covLog: [], make: false, t: 0,
  };
  for (const o of OFF) { S.size[o] = POS_SIZE[play.roles?.[o]?.pos] || 3; S.names[o] = o; }
  const d0 = defend(S, S.pos, S.ball, []);
  Object.assign(S.pos, d0.m); S.assign = d0.assign; S.roles = d0.roles;
  S.start = { pos: { ...S.pos }, ball: S.ball };
  beat(S, 0.9, {}, S.ball, [], 'Defense sets: ' + covOf(S).name.toLowerCase());
  return S;
}
/** Add one beat: offense moves `off` (end positions), ball spec, events; the defense reacts for the same beat. */
function beat(S, d, off, ball, events, cap, extra = {}) {
  const next = { ...S.pos, ...off };
  const holder = typeof ball === 'string' ? ball : ball?.pass ? ball.pass[1] : ball?.steal ? ball.steal[1] : S.ball;
  const D = defend(S, next, holder, events);
  if (extra.freezeDef) for (const k of extra.freezeDef) delete D.m[k];
  if (extra.defOverride) Object.assign(D.m, extra.defOverride);
  const m = { ...off, ...D.m };
  S.beats.push({ d, m, ball, cap, screen: extra.screen, screenOn: extra.screenOn });
  Object.assign(S.pos, m); S.assign = D.assign; S.roles = D.roles; S.ball = holder; S.t += d;
  for (const n of D.notes) S.notes.push({ ...n, at: S.t });
  S.events = events;
}
const RR2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, RR(v)]));

// ---------------- offensive verbs ----------------
function verbScreenAway(S, passer) {
  const pp = S.pos[passer];
  const cand = OFF.filter((o) => o !== passer && o !== S.ball && isPerim(S.pos[o]) && sgn(S.pos[o][0]) === sgn(pp[0]) && roleAt(S.pos[o]) !== 'slot');
  const cutter = cand.sort((a, b) => S.pos[a][1] - S.pos[b][1])[0];
  if (!cutter) return verbReplace(S, passer);
  return offScreen(S, passer, cutter, [...pp]);
}
/** Off-ball screen: screener goes to the cutter's defender, then the cutter reads the coverage. */
function offScreen(S, screener, cutter, fillSpot) {
  const dC = defOf(S, cutter), pc = S.pos[cutter], spot = RR(toward(S.pos[dC] || pc, fillSpot, 1.6));
  beat(S, 0.9, { [screener]: spot, [cutter]: RR(add(pc, [0, -2])) }, S.ball, [], `${nm(S, screener)} screens for ${nm(S, cutter)}`, { screen: screener, screenOn: dC });
  const cov = covOf(S); let dest, read;
  if (cov.type === 'zone') { dest = RR(fillSpot); read = 'fills the gap'; }
  else if (cov.offBall === 'topLock') { dest = RR(rimSpot(sgn(pc[0]))); read = 'reads the top-lock and curls to the rim'; }
  else if (cov.offBall === 'under') { dest = RR(add(fillSpot, [sgn(fillSpot[0]) * 1.5, 1.5])); read = 'pops to the slot for a catch-and-shoot'; }
  else if (cov.offBall === 'switch') { dest = RR(fillSpot); read = 'pops while the screener slips'; }
  else { dest = RR(lerpP(fillSpot, [sgn(fillSpot[0]) * 6, 18], 0.55)); read = 'curls tight off the screen'; }
  const off = { [cutter]: dest };
  if (cov.type !== 'zone' && cov.offBall === 'switch') off[screener] = RR(rimSpot(sgn(spot[0])));
  else off[screener] = RR(add(spot, [sgn(spot[0]) * 3, -4]));
  beat(S, 1.0, off, S.ball, [{ type: 'offScreen', screener, user: cutter, from: spot }], `${nm(S, cutter)} ${read}`, { screen: screener, screenOn: dC });
  S.lastScreen = { screener, user: cutter, read };
}
function verbCutThrough(S, passer) {
  const pp = S.pos[passer], side = sgn(S.pos[S.ball][0]);
  beat(S, 1.0, { [passer]: RR(rimSpot(side)) }, S.ball, [{ type: 'cut', user: passer, from: pp, basket: true }], `${nm(S, passer)} cuts through`);
  fillSpots(S, passer, -side, 'Fill the open spots');
}
/** Generic fill: perimeter players move to the vacated four-out spots; the cutter exits to the weak side. */
function fillSpots(S, cutter, exitSide, cap) {
  const spots = ['slotL', 'slotR', 'wingL', 'wingR', 'cornerL', 'cornerR'];
  const occupied = (sp) => OFF.some((o) => o !== cutter && dist(S.pos[o], SPOTS[sp]) < 5);
  const ballSide = sgn(S.pos[S.ball][0]);
  const want = ['slotL', 'slotR'].sort((a) => (sgn(SPOTS[a][0]) === ballSide ? -1 : 1));
  const moves = {}, used = new Set([S.ball]);
  for (const sp of want) {
    if (occupied(sp)) continue;
    const c = OFF.filter((o) => !used.has(o) && o !== cutter && isPerim(S.pos[o]) && dist(S.pos[o], SPOTS[sp]) < 22).sort((a, b) => dist(S.pos[a], SPOTS[sp]) - dist(S.pos[b], SPOTS[sp]))[0];
    if (c) { moves[c] = SPOTS[sp]; used.add(c); }
  }
  const after = (sp) => OFF.some((o) => o !== cutter && dist(moves[o] || S.pos[o], SPOTS[sp]) < 5);
  const exit = spots.filter((sp) => sgn(SPOTS[sp][0]) === exitSide && !after(sp)).sort((a, b) => (a.startsWith('wing') ? -1 : 1))[0] || (exitSide < 0 ? 'cornerL' : 'cornerR');
  moves[cutter] = SPOTS[exit];
  beat(S, 1.1, RR2(moves), S.ball, [{ type: 'cut', user: cutter, from: S.pos[cutter] }], cap);
}
function verbBasketCut(S, who) { const p = S.pos[who]; beat(S, 0.9, { [who]: RR(rimSpot(sgn(p[0]))) }, S.ball, [{ type: 'cut', user: who, from: p, basket: true }], `${nm(S, who)} basket cuts`); beat(S, 0.9, { [who]: p }, S.ball, [], `${nm(S, who)} returns`); }
function verbReplace() {}
function verbPostUp(S, who) { const side = sgn(S.pos[S.ball][0]); beat(S, 0.8, { [who]: SPOTS[side < 0 ? 'postL' : 'postR'] }, S.ball, [], `${nm(S, who)} posts up`); }
function verbFollow(S, passer) { const r = S.pos[S.ball]; beat(S, 0.8, { [passer]: RR(toward(r, S.pos[passer], 3)) }, S.ball, [], `${nm(S, passer)} follows for a handoff`); }
/** Spain: ball screen by the post, back screen on the roller's defender by another player. */
function verbSpain(S, screener, backer) {
  const H = S.ball, pH = S.pos[H], dH = defOf(S, H);
  const side = pH[0] >= 0 ? 1 : -1; // the handler comes off the screen toward this side
  const top = [clamp(pH[0] * 0.3, -3, 3), 31];
  const spot = RR(add(top, [side * 1.9, -1.6]));
  const backSpot = RR([-side * 2.5, 18]);
  beat(S, 1.0, { [screener]: spot, [H]: top, ...(backer ? { [backer]: backSpot } : {}) }, H, [], 'Spain: the big comes to the middle for a ball screen', { screen: screener, screenOn: dH });
  const off = { [H]: RR([side * 8, 24]), [screener]: RR([-side * 1, 11]) };
  const ev = [{ type: 'ballScreen', screener, user: H, from: spot }];
  if (backer) { off[backer] = RR([-side * 6.5, 27]); ev.push({ type: 'backScreen', screener: backer, user: screener, from: backSpot, side }); }
  beat(S, 1.1, off, H, ev, backer ? 'Ball screen and roll; back screen on the roller\'s defender, then pop' : 'Ball screen and roll', { screen: screener, screenOn: dH });
  S.lastScreen = { screener, user: H, read: 'ball screen', backer };
}
const VERB_FN = { screenAway: verbScreenAway, cutThrough: verbCutThrough, basketCut: verbBasketCut, replace: verbReplace, postUp: verbPostUp, follow: verbFollow };

/** Who a rule's "who" refers to, given the last pass. */
function ruleWho(S, who, passer, receiver) {
  if (who === 'passer') return passer; if (who === 'receiver') return receiver;
  if (who === 'post') return OFF.filter((o) => o !== S.ball).sort((a, b) => distHoop(S.pos[a]) - distHoop(S.pos[b]))[0];
  if (who === 'oppSlot') return OFF.filter((o) => o !== S.ball && isPerim(S.pos[o])).sort((a, b) => Math.abs(S.pos[a][1] - 27) + Math.abs(S.pos[a][0] + S.pos[S.ball][0]) - (Math.abs(S.pos[b][1] - 27) + Math.abs(S.pos[b][0] + S.pos[S.ball][0])))[0];
  const side = sgn(S.pos[S.ball][0]);
  if (who === 'strongWing') return OFF.find((o) => o !== S.ball && roleAt(S.pos[o]) === 'wing' && sgn(S.pos[o][0]) === side);
  if (who === 'weakWing') return OFF.find((o) => o !== S.ball && roleAt(S.pos[o]) === 'wing' && sgn(S.pos[o][0]) !== side);
  return null;
}
const rules = () => doc('playbook').rules;
/** After a completed pass: find the team rule for (passer role → receiver role) and run its verbs. */
function applyPassRules(S, passer, receiver, fromRole, toRole) {
  const r = rules().find((x) => x.on.type === 'pass' && (x.on.from === fromRole || x.on.from === 'any') && (x.on.to === toRole || x.on.to === 'any'));
  if (!r) { respace(S); return null; }
  for (const t of r.then) { const who = ruleWho(S, t.who, passer, receiver); if (who && VERB_FN[t.verb]) VERB_FN[t.verb](S, who); }
  return r;
}
function runCall(S, call) {
  const r = rules().find((x) => x.on.type === 'call' && x.on.call === call); if (!r) return null;
  const scr = r.then.find((t) => t.verb === 'ballScreen'), bk = r.then.find((t) => t.verb === 'backScreen');
  const screener = ruleWho(S, scr?.who || 'post'), backer = bk ? OFF.filter((o) => o !== S.ball && o !== screener && isPerim(S.pos[o])).sort((a, b) => dist(S.pos[a], [0, 27]) - dist(S.pos[b], [0, 27]))[0] : null;
  verbSpain(S, screener, backer);
  return r;
}

// ---------------- running the play script ----------------
/** Run scripted steps until the ball handler must decide (a scripted pass) or the script ends. */
function advanceScript(S) {
  const play = S.cfg.play;
  while (!S.offScript && S.stepIdx < play.steps.length) {
    const st = play.steps[S.stepIdx];
    if (st.actions.some((a) => a.type === 'pass' && a.from === S.ball)) return st; // decision point
    runStep(S, st); S.stepIdx++;
  }
  return null;
}
function runStep(S, st, skipPass) {
  const A = st.actions;
  const scr = A.filter((a) => a.type === 'screen'), cuts = A.filter((a) => a.type === 'cut'), mv = A.filter((a) => a.type === 'move'), dr = A.filter((a) => a.type === 'dribble');
  // Ball screen + back screen in the same step = Spain-style action.
  const ballScr = scr.find((a) => a.for === S.ball), back = scr.find((a) => ballScr && a.for === ballScr.who);
  if (ballScr) { verbSpain(S, ballScr.who, back?.who); (S.calls ||= []).push('spain'); return; }
  const off = {}; for (const a of [...mv, ...dr]) off[a.who] = a.to;
  if (Object.keys(off).length) beat(S, 1.0, RR2(off), S.ball, [], st.label || 'Movement');
  for (const a of scr) { const cut = cuts.find((c) => c.who === a.for); offScreen(S, a.who, a.for, cut ? cut.to : SPOTS[sgn(S.pos[a.who][0]) < 0 ? 'slotL' : 'slotR']); }
  const loose = cuts.filter((c) => !scr.some((a) => a.for === c.who));
  if (loose.length) beat(S, 1.0, RR2(Object.fromEntries(loose.map((c) => [c.who, c.to]))), S.ball, loose.map((c) => ({ type: 'cut', user: c.who, from: S.pos[c.who], basket: distHoop(c.to) < 9 })), st.label || 'Cuts');
}

// ---------------- analysis: who is open and why ----------------
function analyze(S) {
  const H = S.ball, pos = S.pos, hp = pos[H], cov = covOf(S), mates = {};
  const dH = defOf(S, H);
  for (const o of OFF) {
    if (o === H) continue;
    const p = pos[o];
    const near = DEF.map((d) => ({ d, k: dist(pos[d], p) })).sort((a, b) => a.k - b.k), sep = near[0].k;
    const Lv = dist(hp, p) || 1, end = lerpP(hp, p, Math.max(0, (Lv - 3) / Lv));
    const laneD = DEF.filter((d) => dist(pos[d], hp) >= 3.6).map((d) => ({ d, k: segDist(pos[d], hp, end) })).sort((a, b) => a.k - b.k)[0] || { k: 99 };
    // Open on the catch: the nearest defender closes ~5 ft per second of ball flight.
    // Defenders who are screened, beaten or trapping close more slowly than a set defender.
    const nr = S.roles?.[near[0].d] || '', closeSpeed = /caught|beaten|trailing|chasing/.test(nr) ? 2 : /trapping|hedging/.test(nr) ? 2.5 : 5;
    const flight = dist(hp, p) / 32 + 0.3, sepCatch = Math.max(0, sep - closeSpeed * flight);
    const open = clamp(Math.min(sepCatch / 4.5, laneD.k / 3.5), 0, 1);
    const myD = defOf(S, o) || near[0].d, dp = pos[myD];
    const toBall = norm(sub(hp, p)), toDef = sub(dp, p);
    const denied = cov.type === 'man' && isPerim(p) && dist(dp, p) < 3.3 && (toBall[0] * toDef[0] + toBall[1] * toDef[1]) > 1.0;
    const rim = rimSpot(sgn(p[0]));
    const bdClear = Math.min(...DEF.filter((d) => d !== myD).map((d) => segDist(pos[d], p, rim)));
    const backdoor = denied && bdClear >= 4;
    const helping = cov.type === 'man' && myD && dist(dp, p) > 7.5 && S.roles?.[myD] && /help|trap|tag/.test(S.roles[myD]);
    const sizeD = S.size['O' + myD[1]], mis = cov.type === 'man' && myD && Math.abs(S.size[o] - sizeD) >= 2 ? (S.size[o] > sizeD ? 'big on small' : 'small on big') : null;
    const d = distHoop(p), inRange = d <= 24.5;
    const zoneGap = cov.type === 'zone' && near[0].k >= 5 && near[1] && near[1].k >= 5;
    mates[o] = { o, p, sep, sepCatch, flight, lane: laneD.k, laneBy: laneD.d, open, denied, backdoor, bdClear, helping, myD, mis, inRange, d, zoneGap, spot: spotName(p), role: roleAt(p) };
  }
  // ball handler
  const gap = dH ? dist(pos[dH], hp) : 9, corridorHelp = DEF.filter((d) => d !== dH && segDist(pos[d], hp, toward(T_HOOP, hp, 4)) < 6).length;
  const trapped = Object.values(S.roles || {}).filter((r) => r === 'trapping').length >= 2;
  // Drive advantage comes from the on-ball defender being out of position, not from the drive itself:
  // crowding (too close to react), off the line to the rim, or trailing behind the handler.
  const line = dH ? segDist(pos[dH], hp, T_HOOP) : 9, behind = dH ? distHoop(pos[dH]) > distHoop(hp) + 0.5 : true;
  const beatDef = (gap < 2.3 ? 0.3 : 0) + (line > 1.8 ? 0.3 : 0) + (behind ? 0.35 : 0) + (gap > 6 ? 0.25 : 0);
  const drive = clamp(0.3 + beatDef - 0.22 * corridorHelp - (trapped ? 0.5 : 0) - (cov.type === 'zone' ? 0.1 : 0), 0, 1);
  const closest = Math.min(...DEF.map((d) => dist(pos[d], hp))), hd = distHoop(hp), three = hd >= 22 || (Math.abs(hp[0]) >= 22 && hp[1] <= 14.2);
  const window = hd > 25 ? 'out of range' : closest >= 5.5 ? 'open' : closest >= 3.5 ? 'tight' : 'contested';
  const helpers = DEF.filter((d) => /help|trap|tag/.test(S.roles?.[d] || '')).map((d) => ({ d, man: S.assign[d] }));
  return { H, hp, mates, gap, line, behind, corridorHelp, trapped, drive, closest, hd, three, window, helpers, cov: S.cov };
}

// ---------------- options & values ----------------
const makeBase = (d, three) => (d < 6 ? 0.6 : d < 14 ? 0.45 : three ? 0.36 : 0.4);
function shotProb(d, closest, three, I) {
  const adj = closest >= 6 ? 0.04 : closest >= 4 ? 0 : closest >= 2.5 ? -0.08 : -0.16;
  return clamp(makeBase(d, three) + adj - (I - 2) * 0.02, 0.05, 0.75);
}
function optionsFor(S, A, depth = 0) {
  const opts = [], I = S.intensity, play = S.cfg.play, nextStep = play.steps[S.stepIdx];
  const scriptedTo = !S.offScript && nextStep ? nextStep.actions.find((a) => a.type === 'pass' && a.from === A.H)?.to : null;
  const fromRole = roleAt(A.hp);
  for (const m of Object.values(A.mates)) {
    const risk = (m.lane < 1.5 ? 0.42 : m.lane < 3 ? 0.18 : 0.04) * (0.6 + 0.25 * I) + (m.denied ? 0.12 : 0) + (A.trapped && dist(A.hp, m.p) > 30 ? 0.12 : 0);
    const comp = clamp(1 - risk, 0.3, 0.99);
    const closeD = m.sep, three = m.d >= 22;
    const shotEV = m.inRange ? shotProb(m.d, closeD, three, I) * (three ? 3 : 2) : 0;
    const cc = m.sepCatch;
    const shotC = m.inRange ? shotProb(m.d, cc, three, I) * (three ? 3 : 2) : 0;
    const catchV = Math.max(m.d < 9 && cc > 2.5 ? 2 * shotProb(m.d, cc, false, I) : 0, cc >= 4 ? shotC : 0, 0.9 + 0.12 * m.open);
    const rule = rules().find((x) => x.on.type === 'pass' && (x.on.from === fromRole || x.on.from === 'any') && (x.on.to === m.role || x.on.to === 'any'));
    const createsAction = !!rule || m.o === scriptedTo;
    opts.push({ id: 'pass-' + m.o, kind: 'pass', to: m.o, label: `Pass to ${m.o} (${SPOT_LABEL[m.spot]})`, catchV, ev: comp * catchV - (1 - comp) * 0.7, comp, principle: !!rule || m.o === scriptedTo, rule, scripted: m.o === scriptedTo, open: m.open });
    if (m.backdoor) opts.push({ id: 'bd-' + m.o, kind: 'backdoor', to: m.o, label: `Hit ${m.o}'s backdoor cut`, ev: 0.88 * 2 * clamp(0.62 - (m.bdClear < 6 ? 0.08 : 0), 0.3, 0.7), comp: 0.88, principle: true, open: 1 });
  }
  opts.push({ id: 'drive', kind: 'drive', label: 'Attack your defender (drive)', ev: 0.55 + 0.7 * A.drive - (A.trapped ? 0.4 : 0), principle: A.drive >= 0.6, drive: A.drive });
  if (A.hd <= 25) { const p = shotProb(A.hd, A.closest, A.three, I); opts.push({ id: 'shoot', kind: 'shoot', label: A.three ? 'Shoot the three' : 'Pull up and shoot', ev: p * (A.three ? 3 : 2), p, principle: A.window === 'open' }); }
  if (!S.offScript && nextStep && !nextStep.actions.some((a) => a.type === 'pass')) opts.push({ id: 'script', kind: 'script', label: `Run the next action: ${nextStep.label || 'step ' + (S.stepIdx + 1)}`, ev: 0.97, principle: true });
  for (const r of rules().filter((x) => x.on.type === 'call')) if (!S.calls?.includes(r.on.call)) opts.push({ id: 'call-' + r.on.call, kind: 'call', call: r.on.call, label: `Call ${r.name}`, ev: callEV(S, A, r), principle: true });
  opts.push({ id: 'reset', kind: 'reset', label: 'Reset: dribble out and restart', ev: A.trapped ? 0.55 : 0.8, principle: false });
  if (depth === 0) for (const o of opts) {
    // One-move lookahead: play the option forward on a copy (forced completion) and value it by the best read after it.
    if (o.kind === 'pass') { const la = lookValue(S, o, A); o.la = la; o.ev = o.comp * Math.max(o.catchV, 0.96 * la) - (1 - o.comp) * 0.7; }
    else if (o.kind === 'call' || o.kind === 'script') { o.la = lookValue(S, o, A); o.ev = 0.96 * o.la; }
    else if (o.kind === 'reset') { o.la = lookValue(S, o, A); o.ev = Math.min(0.9 * o.la, A.trapped ? 0.6 : 0.95); }
    else if (o.kind === 'drive') {
      const win = lookValue(S, o, A, { forceDrive: true }), stall = lookValue(S, o, A, { forceDrive: false }), fin = 2 * shotProb(6, 2.5, false, S.intensity);
      o.la = win; o.ev = A.drive * (A.drive >= 0.75 ? 0.6 * fin + 0.4 * win : win) + (1 - A.drive) * 0.93 * stall - (A.trapped ? 0.45 : 0);
    }
  } else for (const o of opts) if (o.kind === 'call' || o.kind === 'script') o.ev = 0.9;
  return opts;
}
function callEV() { return 0.9; } // replaced by the lookahead at depth 0
function cloneS(S) { return { ...S, pos: { ...S.pos }, assign: { ...S.assign }, roles: { ...S.roles }, beats: [...S.beats], notes: [...S.notes], calls: [...(S.calls || [])], rng: () => 0, lookahead: true }; }
function lookValue(S, o, A, extra = {}) {
  const C = Object.assign(cloneS(S), extra), res = applyChoice(C, o, A);
  if (res.ended) return res.ev ?? 0;
  const A2 = analyze(C); return Math.max(...optionsFor(C, A2, 1).map((x) => x.ev));
}

// ---------------- applying a decision ----------------
/** Execute the chosen option. Returns {result, ended, txt} and appends beats. */
function applyChoice(S, opt, A) {
  const H = S.ball, r = S.rng(), I = S.intensity;
  if (opt.kind === 'pass') {
    const m = A.mates[opt.to];
    if (r > opt.comp) { // picked off
      const thief = m.laneBy || defOf(S, opt.to);
      beat(S, 0.6, { [thief]: RR(lerpP(A.hp, m.p, 0.6)) }, { steal: [H, thief] }, [], `Pass picked off by X${thief[1]}`, { defOverride: { [thief]: RR(lerpP(A.hp, m.p, 0.6)) } });
      beat(S, 1.0, { [thief]: [S.pos[thief][0] * 0.5, 44] }, thief, [], 'Turnover');
      return { result: 'tov', ended: true, txt: `The pass was picked off: X${thief[1]} was ${fmtFt(m.lane)} from the passing lane.` };
    }
    const fromRole = roleAt(A.hp);
    beat(S, clamp(dist(A.hp, m.p) / 32 + 0.3, 0.45, 1.1), { [opt.to]: RR(toward(m.p, A.hp, 1)) }, { pass: [H, opt.to], bounce: m.lane < 2.5 ? 1 : undefined }, [], `${H} to ${opt.to}`);
    if (opt.scripted) { S.stepIdx++; runStepRestAfterPass(S); }
    else { S.offScript = S.offScript || !!S.cfg.play.steps[S.stepIdx]; const rule = applyPassRules(S, H, opt.to, fromRole, m.role); if (rule) S.notes.push({ t: 'rule', txt: `Team rule: ${rule.name}`, at: S.t }); }
    // A catch at the rim with space is finished right away.
    const after = analyzeReceiver(S, opt.to);
    if (after.d < 9 && after.closest > 2.5) return finishShot(S, opt.to, after, 'Finish at the rim');
    return { result: 'cont', ended: false, txt: 'Pass completed.' };
  }
  if (opt.kind === 'backdoor') {
    const m = A.mates[opt.to], rim = rimSpot(sgn(m.p[0]));
    if (r > opt.comp) { const thief = defOf(S, opt.to); beat(S, 0.7, { [opt.to]: RR(rim) }, { steal: [H, thief] }, [{ type: 'cut', user: opt.to, from: m.p, basket: true }], 'Backdoor pass deflected'); beat(S, 1, { [thief]: [S.pos[thief][0] * 0.5, 44] }, thief, [], 'Turnover'); return { result: 'tov', ended: true, txt: 'The bounce pass was deflected.' }; }
    beat(S, 0.8, { [opt.to]: RR(rim) }, { pass: [H, opt.to], bounce: 1 }, [{ type: 'cut', user: opt.to, from: m.p, basket: true }], `${opt.to} back-cuts, bounce pass`);
    return finishShot(S, opt.to, analyzeReceiver(S, opt.to), 'Backdoor layup');
  }
  if (opt.kind === 'drive') return driveTo(S, A, H, RR(toward(T_HOOP, A.hp, A.drive > 0.5 ? 6 : 11)), r);
  if (opt.kind === 'dribble') {
    const from = A.hp, to = opt.at, dH = defOf(S, H);
    // Another defender standing in the dribble path stops you (your own man slides with you, so he doesn't count).
    const blk = DEF.filter((d) => d !== dH && dist(S.pos[d], from) > 2 && segDist(S.pos[d], from, to) < 2.2).sort((x, y) => dist(S.pos[x], from) - dist(S.pos[y], from))[0];
    if (blk) {
      if (!S.lookahead && r < (A.trapped ? 0.4 : 0.15)) { beat(S, 0.6, { [H]: RR(toward(S.pos[blk], from, 2.5)) }, { steal: [H, blk] }, [], `Dribbled into X${blk[1]}: stripped`); beat(S, 1, { [blk]: [S.pos[blk][0] * 0.5, 44] }, blk, [], 'Turnover'); return { result: 'tov', ended: true, txt: `X${blk[1]} was standing in your dribble path and poked the ball away.` }; }
      beat(S, 0.7, { [H]: RR(toward(S.pos[blk], from, 3)) }, H, [], `${H} dribbles into X${blk[1]}: path blocked`);
      return { result: 'cont', ended: false, txt: `X${blk[1]} was in your dribble path, so the dribble went nowhere.` };
    }
    if (opt.attack) return driveTo(S, A, H, to, r);
    const escape = A.trapped && dist(to, from) >= 6;
    beat(S, clamp(dist(from, to) / 14 + 0.3, 0.5, 1.3), { [H]: to }, H, [], `${H} dribbles to the ${SPOT_LABEL[spotName(to)]}`);
    return { result: 'cont', ended: false, txt: escape ? 'You dribbled out of the trap; the defense had to reset.' : 'You moved the ball with the dribble. The defense shifted with you.' };
  }
  if (opt.kind === 'shoot') return finishShot(S, H, analyzeReceiver(S, H), A.three ? 'Three-point attempt' : 'Pull-up');
  return applyRest(S, opt, A, H);
}
/** Drive toward `to`: the on-ball defender either stays in front (no advantage) or gets beaten (help rotates). */
function driveTo(S, A, H, to, r) {
  {
    const from = A.hp;
    if (A.trapped && r < 0.45 && !S.lookahead) { const t2 = defOf(S, H); beat(S, 0.7, {}, { steal: [H, t2] }, [], 'Stripped in the trap'); beat(S, 1, { [t2]: [S.pos[t2][0] * 0.5, 44] }, t2, [], 'Turnover'); return { result: 'tov', ended: true, txt: 'Dribbling into a two-man trap: the ball was stripped.' }; }
    const beatHim = S.lookahead ? S.forceDrive : r < A.drive;
    if (!beatHim) { // the on-ball defender stays in front: no help needed, no advantage
      const dH = defOf(S, H), stop = RR(toward(from, to, 4));
      beat(S, 0.8, { [H]: stop }, H, [], `${H} drives, ${dH ? 'X' + dH[1] : 'the defense'} cuts it off`, { defOverride: dH ? { [dH]: RR(toward(stop, T_HOOP, 2.2)) } : {} });
      return { result: 'cont', ended: false, txt: 'The drive was cut off: your defender stayed in front, so nobody had to help.' };
    }
    beat(S, 0.9, { [H]: to }, H, [{ type: 'drive', user: H, from }], `${H} drives`);
    if (!S.lookahead && A.drive >= 0.75 && S.rng() < 0.6) return finishShot(S, H, analyzeReceiver(S, H), 'Layup off the drive');
    return { result: 'cont', ended: false, txt: 'The drive drew help. New read.' };
  }
}
function applyRest(S, opt, A, H) {
  if (opt.kind === 'script') { const st = S.cfg.play.steps[S.stepIdx]; runStep(S, st); S.stepIdx++; advanceScript(S); return { result: 'cont', ended: false, txt: `Ran: ${st.label}.` }; }
  if (opt.kind === 'call') { (S.calls ||= []).push(opt.call); S.offScript = true; runCall(S, opt.call); return { result: 'cont', ended: false, txt: `Called ${opt.label.replace('Call ', '')}.` }; }
  if (opt.kind === 'reset') { beat(S, 1.1, { [H]: [clamp(A.hp[0] * 0.5, -6, 6), 32] }, H, [], 'Reset the offense'); return { result: 'cont', ended: false, txt: 'Reset. The defense recovered.' }; }
  if (opt.kind === 'hold') { beat(S, 1.0, {}, H, [], 'Hesitation: the defense recovers'); return { result: 'cont', ended: false, txt: 'You held the ball and the window closed.' }; }
  return { result: 'cont', ended: false, txt: '' };
}
function runStepRestAfterPass(S) { const st = S.cfg.play.steps[S.stepIdx - 1]; const rest = { ...st, actions: st.actions.filter((a) => a.type !== 'pass') }; if (rest.actions.length) runStep(S, rest); advanceScript(S); }
function analyzeReceiver(S, o) { const p = S.pos[o]; const closest = Math.min(...DEF.map((d) => dist(S.pos[d], p))), d = distHoop(p); return { p, closest, d, three: d >= 22 || (Math.abs(p[0]) >= 22 && p[1] <= 14.2) }; }
function finishShot(S, who, a, cap) {
  const p = shotProb(a.d, a.closest, a.three, S.intensity), made = S.rng() < p;
  S.make = made;
  beat(S, 1.05, {}, { shot: who, three: a.three }, [], `${cap} (${Math.round(p * 100)}% look)`, { contest: true });
  S.beats[S.beats.length - 1].reb = 'D5'; S.beats[S.beats.length - 1].rebSpot = [2, 11];
  return { result: made ? 'make' : 'miss', ended: true, ev: p * (a.three ? 3 : 2), p, pts: made ? (a.three ? 3 : 2) : 0, txt: `${cap}: ${made ? 'made' : 'missed'} (${Math.round(p * 100)}% shot, closest defender ${fmtFt(a.closest)}).` };
}
const fmtFt = (v) => (v >= 20 ? '20+ ft' : v.toFixed(1) + ' ft');

// ---------------- grading ----------------
const TEAM_W = { read: 0.4, timing: 0.1, awareness: 0.25, principles: 0.25 };
function gradeTeamDecision(A, opts, choice, info) {
  const best = opts.reduce((a, b) => (b.ev > a.ev ? b : a)), worst = Math.min(...opts.map((o) => o.ev));
  const parts = {};
  parts.read = choice.kind === 'hold' ? 5 : Math.round(clamp(best.ev - choice.ev <= 0.04 ? 100 : (100 * (choice.ev - worst)) / Math.max(0.01, best.ev - worst), 0, 100));
  const openMates = Object.values(A.mates).filter((m) => m.open >= 0.75 || m.backdoor);
  const chosenOpen = choice.to ? Math.max(A.mates[choice.to].open, choice.kind === 'backdoor' ? 1 : 0) : null;
  parts.awareness = choice.kind === 'hold' ? 0 : !openMates.length ? 90 : chosenOpen != null ? Math.round(60 + 40 * chosenOpen) : choice.ev >= best.ev - 0.04 ? 85 : 45;
  parts.principles = choice.kind === 'hold' ? 0 : choice.principle ? 100 : 55;
  if (info.timing != null) parts.timing = info.timing;
  let s = 0, w = 0; for (const [k, v] of Object.entries(parts)) { s += TEAM_W[k] * v; w += TEAM_W[k]; }
  return { score: Math.round(s / w), parts, best };
}
const quadrant = (score, ok) => (score >= 70 ? (ok ? { k: 'gg', t: 'Correct decision, successful execution' } : { k: 'gb', t: 'Correct decision, poor execution or result' }) : ok ? { k: 'bg', t: 'Incorrect decision that happened to work' } : { k: 'bb', t: 'Incorrect decision and poor result' });

/** Plain-language reasons each teammate was (or wasn't) available. */
function whyOpen(S, A) {
  const out = [];
  for (const m of Object.values(A.mates)) {
    const d = m.myD ? `X${m.myD[1]}` : 'his defender', reasons = [];
    if (m.backdoor) reasons.push(`${d} was denying ${fmtFt(dist(S.pos[m.myD], m.p))} off with nobody between ${m.o} and the rim: backdoor`);
    else if (m.denied) reasons.push(`${d} was in the passing lane (denied), but help was behind him, so no backdoor`);
    if (m.helping) reasons.push(`${d} left him to ${S.roles[m.myD]}`);
    if (m.mis) reasons.push(`switch left a ${m.mis === 'big on small' ? 'smaller defender on him (post it / seal)' : 'bigger defender on him (attack off the dribble)'}`);
    if (m.zoneGap) reasons.push('sitting in a gap between two zone defenders');
    if (S.lastScreen && S.lastScreen.user === m.o) reasons.push(`came off ${S.lastScreen.screener}'s screen with ${fmtFt(m.sep)} of separation (${S.lastScreen.read})`);
    if (S.lastScreen && S.lastScreen.screener === m.o && covOf(S).offBall === 'switch') reasons.push('slipped the screen as the defense switched');
    if (!reasons.length) reasons.push(m.open >= 0.75 ? `${fmtFt(m.sep)} from the nearest defender and a clean lane` : m.lane < 2 ? `X${m.laneBy?.[1] || '?'} sat in the passing lane (${fmtFt(m.lane)} from it)` : m.open >= 0.45 ? `${fmtFt(m.sep)} of space now, but the defender closes to ${fmtFt(m.sepCatch)} by the time the pass arrives` : `only ${fmtFt(m.sepCatch)} of space on the catch: covered`);
    out.push({ o: m.o, open: m.open >= 0.75 || m.backdoor, tag: m.backdoor ? 'backdoor' : m.open >= 0.75 ? 'open' : m.open >= 0.45 ? 'workable' : 'covered', txt: reasons.join('; ') });
  }
  return out.sort((a, b) => b.open - a.open);
}

/** A free dribble to a spot the player tapped (up to 14 ft per decision). Valued by playing it forward. */
function dribbleOption(S, A, pt) {
  const from = A.hp; let to = RR(clampCourt(pt));
  if (dist(from, to) > 14) to = RR(toward(from, to, 14));
  const attack = distHoop(to) < distHoop(from) - 3 && distHoop(to) < 16;
  const o = { id: 'dribble', kind: 'dribble', at: to, attack, label: attack ? `Attack off the dribble toward the rim` : `Dribble to the ${SPOT_LABEL[spotName(to)]}` };
  if (attack) { const win = lookValue(S, o, A, { forceDrive: true }), stall = lookValue(S, o, A, { forceDrive: false }); o.ev = A.drive * win + (1 - A.drive) * 0.93 * stall - (A.trapped ? 0.3 : 0); }
  else o.ev = 0.95 * lookValue(S, o, A);
  o.principle = (attack && A.drive >= 0.6) || (A.trapped && dist(to, from) >= 6 && !attack);
  return o;
}

/** Default continuity when no team rule covers a pass: off-ball perimeter players move to open four-out spots. */
function respace(S) {
  const spots = ['slotL', 'slotR', 'wingL', 'wingR', 'cornerL', 'cornerR'], taken = new Set(), moves = {};
  const own = (o) => spots.slice().sort((x, y) => dist(S.pos[o], SPOTS[x]) - dist(S.pos[o], SPOTS[y]));
  const H = S.ball; if (isPerim(S.pos[H])) taken.add(own(H)[0]);
  const players = OFF.filter((o) => o !== H && isPerim(S.pos[o])).sort((a, b) => dist(S.pos[a], SPOTS[own(a)[0]]) - dist(S.pos[b], SPOTS[own(b)[0]]));
  for (const o of players) {
    const sp = own(o).find((x) => !taken.has(x) && !(x.startsWith('corner') && !players.some((p) => p !== o && dist(S.pos[p], SPOTS[x.replace('corner', 'wing')]) < 6)));
    const pick = sp || own(o).find((x) => !taken.has(x)); if (!pick) continue;
    taken.add(pick); if (dist(S.pos[o], SPOTS[pick]) > 3) moves[o] = SPOTS[pick];
  }
  if (Object.keys(moves).length) beat(S, 0.9, RR2(moves), H, [], 'Offense re-spaces');
}
