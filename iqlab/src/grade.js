// ===================== possessions & grading =====================
// A played possession is fully described by {sid, flip, opt, f, seed, mode}: scenario, side of the floor, the option
// chosen ('timeout' when the window ran out), how late in the decision window it came (f, 0..1), the RNG seed for
// the outcome, and live/film. Everything else (track, outcome, grade) is recomputed from that, so replays are exact.

const WEIGHTS = { read: 0.35, action: 0.35, spacing: 0.15, timing: 0.15 };

/** Track for the setup plus the full drift (used before the decision). */
function preTrack(sc) {
  const start = { pos: sc.pos, ball: sc.ball };
  const tr = compile(start, [...sc.setup, { ...sc.decision.drift, ball: undefined, cap: sc.decision.drift.cap }]);
  tr.setupEnd = sc.setup.reduce((a, b) => a + b.d, 0);
  return tr;
}
function holderAfterSetup(sc) { return compile({ pos: sc.pos, ball: sc.ball }, sc.setup).end.ball; }

/** The option played when the window runs out. */
function hesitation(sc, holder) {
  const late = sc.clock <= 6;
  return {
    id: 'timeout', kind: 'hold', label: late ? 'Held it: shot-clock violation' : 'Hesitated', read: 15, q: 10, sp: 40,
    make: late ? 0 : 0.24, tov: late ? 1 : 0, clock: late,
    beats: [mv(0.8, {}, 'Hesitation: the defense recovers'), shoot(holder, 1.0, {}, { cap: 'Forced, contested shot', reb: 'D5' })],
    miss: late ? 'You held the ball until the shot clock expired. Late clock means the first clean look is the shot.' : 'You waited too long. Every half-second you hold the ball, the defense gets back into position.',
  };
}
function optionFor(sc, id) {
  if (id === 'timeout') return hesitation(sc, holderAfterSetup(sc));
  return sc.decision.options.find((o) => o.id === id);
}

/** Sample the outcome from the seed: turnover first, then make/miss for the final shot. */
function sampleOutcome(opt, f, seed, forceMake) {
  const r = rng(seed * 2654435761);
  r(); r(); r();
  const u1 = r(), u2 = r();
  const tovP = opt.tov ? clamp(opt.tov + f * 0.08, 0, 1) : 0;
  const makeP = opt.make != null ? clamp(opt.make * (1 - 0.22 * f), 0, 1) : null;
  if (forceMake) return { tov: false, make: true, makeP, tovP };
  const tov = u1 < tovP;
  return { tov, make: !tov && makeP != null && u2 < makeP, makeP, tovP };
}

/** Build the full possession: setup, the part of the drift that happened before the decision, then the option. */
function buildPossession(sc, choice) {
  const opt = optionFor(sc, choice.opt), f = clamp(choice.f || 0, 0, 1);
  const pre = preTrack(sc), setupEnd = pre.setupEnd, drift = sc.decision.drift;
  const atSetup = compile({ pos: sc.pos, ball: sc.ball }, sc.setup).end;
  const beats = [...sc.setup];
  const dd = drift.d * f;
  if (dd > 0.02) {
    const e = easeIO(f), m = {};
    for (const [id, to] of Object.entries(drift.m)) { const a = atSetup.pos[id]; m[id] = [R(lerp(a[0], to[0], e)), R(lerp(a[1], to[1], e))]; }
    beats.push({ d: dd, m, cap: 'Reading the floor' });
  }
  const oc = sampleOutcome(opt, f, choice.seed, choice.forceMake);
  let ob = opt.beats.map((b) => ({ ...b }));
  const holder = atSetup.ball;
  if (oc.tov && opt.strip) {
    // Dribble gets poked away by the strip defender during the first move.
    const first = ob[0], thief = opt.strip;
    const at = first.m?.[holder] || pre.segs[0].from[holder];
    ob = [{ d: Math.max(0.45, first.d), m: { ...(first.m || {}), [thief]: [R(at[0] + 1), R(at[1] + 0.6)] }, ball: { steal: [holder, thief] }, cap: 'Stripped!' },
      { d: 1.1, m: { [thief]: [R(at[0] * 0.5), 44] }, ball: thief, cap: 'Turnover' }];
  } else if (oc.tov && opt.clock) {
    // The shot doesn't get off: replace the last shot with the horn.
    const i = ob.map((b) => isShotBall(b.ball)).lastIndexOf(true);
    if (i >= 0) { const shooter = ob[i].ball.shot; ob[i] = { d: 0.9, m: ob[i].m, ball: shooter, cap: 'Shot-clock violation' }; ob = ob.slice(0, i + 1); }
  }
  const track = compile({ pos: sc.pos, ball: sc.ball }, beats.concat(ob), { make: oc.make, tov: oc.tov && !opt.strip && !opt.clock });
  const tDecision = setupEnd + (dd > 0.02 ? dd : 0);
  // What actually happened.
  let result = 'none', pts = 0, three = false;
  for (const s of track.segs) {
    if (s.ball?.steal) result = 'tov';
    if (isShotBall(s.ball)) { three = !!s.ball.three; result = s.ball.make ? 'make' : 'miss'; }
  }
  if (oc.tov && opt.clock) result = 'violation';
  if (result === 'make') pts = three ? 3 : 2;
  // Timeline markers.
  const markers = [{ t: tDecision, kind: 'decision', label: 'Decision' }];
  for (const s of track.segs) {
    if (s.t0 < tDecision - 0.01) continue;
    if (s.ball?.pass) markers.push({ t: s.t0, kind: 'pass', label: 'Pass' });
    else if (s.ball?.steal) markers.push({ t: s.t0, kind: 'tov', label: 'Turnover' });
    else if (isShotBall(s.ball)) markers.push({ t: s.t0, kind: 'shot', label: 'Shot' });
    else if (s.ball?.net) markers.push({ t: s.t0, kind: 'make', label: 'Make' });
    else if (s.ball?.reb) markers.push({ t: s.t0, kind: 'miss', label: 'Miss' });
    else if (s.beat?.cap === 'Shot-clock violation') markers.push({ t: s.t0 + s.t1 - s.t0, kind: 'tov', label: 'Violation' });
  }
  // Floating score effects.
  const fx = [];
  for (const s of track.segs) {
    if (s.ball?.net) fx.push({ text: '+' + pts, at: [0, 9], color: '#2fd68a', t0: s.t0 });
    if (s.ball?.reb) fx.push({ text: 'MISS', at: [0, 9], color: '#c7d2f0', t0: s.t0 });
    if (s.ball?.steal) fx.push({ text: 'TURNOVER', at: [0, 22], color: '#ff5a6e', t0: s.t0 + 0.3 });
    if (s.beat?.cap === 'Shot-clock violation') fx.push({ text: '0.0', at: [0, 22], color: '#ff5a6e', t0: s.t0 + 0.3 });
  }
  return { track, opt, oc, result, pts, three, tDecision, setupEnd, markers, fx, holder };
}

/** Grade a decision. Timing only counts in live mode. */
function gradeDecision(sc, opt, f, mode) {
  const parts = { read: opt.read, action: opt.q, spacing: opt.sp };
  let score;
  if (mode === 'live') {
    parts.timing = opt.id === 'timeout' ? 0 : Math.round(100 - 85 * Math.max(0, f - 0.15) / 0.85);
    score = WEIGHTS.read * parts.read + WEIGHTS.action * parts.action + WEIGHTS.spacing * parts.spacing + WEIGHTS.timing * parts.timing;
  } else {
    score = (WEIGHTS.read * parts.read + WEIGHTS.action * parts.action + WEIGHTS.spacing * parts.spacing) / (1 - WEIGHTS.timing);
  }
  return { score: Math.round(score), parts };
}
const scoreBand = (s) => (s >= 90 ? { k: 'elite', t: 'Elite read' } : s >= 75 ? { k: 'good', t: 'Good read' } : s >= 55 ? { k: 'ok', t: 'Playable' } : { k: 'bad', t: 'Wrong read' });
const RESULT_TEXT = { make: 'Make', miss: 'Miss', tov: 'Turnover', violation: 'Shot-clock violation', none: 'Possession reset' };

/** Readable floor read at the decision moment, computed from the geometry. */
function floorReport(track, t, holder) {
  const st = stateAt(track, t), fl = readFloor(st.pos, holder);
  const mates = Object.entries(fl.mates).map(([id, m]) => ({ id, role: ROLE[id], ...m })).sort((a, b) => b.open - a.open);
  const tag = (m) => (m.open > 0.66 ? 'open' : m.open > 0.38 ? 'workable' : 'covered');
  return {
    mates: mates.map((m) => ({ ...m, tag: tag(m), laneTxt: m.lane >= 6 ? 'clean lane' : m.lane >= 3 ? 'lane tight' : 'lane blocked' })),
    spacing: fl.spacing, spacingTxt: spacingGrade(fl.spacing), paint: fl.paint, ballDef: fl.ballDef,
  };
}

/** One-stop: play + grade a choice. */
function evaluate(sid, choice) {
  const sc = getScenario(sid, choice.flip);
  const poss = buildPossession(sc, choice);
  const g = gradeDecision(sc, poss.opt, choice.f || 0, choice.mode);
  const best = bestOption(sc);
  const floor = floorReport(poss.track, poss.tDecision, poss.holder);
  return { sc, poss, ...g, best, floor, isBest: poss.opt.id === best.id };
}

/** Expected points of an option if chosen at lateness f: P(no turnover) x P(make) x shot value. */
function expectedPts(opt, f = 0) {
  if (opt.make == null) return 0;
  const shotBeat = [...opt.beats].reverse().find((b) => isShotBall(b.ball));
  const val = shotBeat?.ball.three ? 3 : 2;
  const tov = opt.tov ? clamp(opt.tov + f * 0.08, 0, 1) : 0;
  return (1 - tov) * clamp(opt.make * (1 - 0.22 * f), 0, 1) * val;
}
