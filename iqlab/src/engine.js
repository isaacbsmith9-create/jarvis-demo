// ===================== possession engine =====================
// Court coordinates are in feet: x from -25 (left sideline) to 25, y from 0 (baseline) to 47 (half-court line).
// A possession is a list of "beats". Each beat lasts d seconds, moves players to new spots (m) and says what the
// ball does (held by a player, a pass, a shot, a steal). Beats compile into a track: the state at any time t is a pure
// function of t, so pausing, scrubbing and replaying always show exactly the same possession.
const HOOP = { x: 0, y: 5.25 };
const RIM_H = 10;
const OFF = ['O1', 'O2', 'O3', 'O4', 'O5'], DEF = ['D1', 'D2', 'D3', 'D4', 'D5'];
const ROLE = { O1: 'PG', O2: 'SG', O3: 'SF', O4: 'PF', O5: 'C' };
const easeIO = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const distHoop = (p) => Math.hypot(p[0] - HOOP.x, p[1] - HOOP.y);
const R = (v) => Math.round(v * 10) / 10;

/** Defender spot: gap feet from his man toward the rim, then pulled toward the ball by `help` (0..1). */
function guard(o, ball, gap = 3, help = 0) {
  const dx = HOOP.x - o[0], dy = HOOP.y - o[1], L = Math.hypot(dx, dy) || 1;
  let x = o[0] + (dx / L) * gap, y = o[1] + (dy / L) * gap;
  if (help && ball) { x += (ball[0] - x) * help; y += (ball[1] - y) * help; }
  return [R(x), R(y)];
}
const isShotBall = (b) => b && typeof b === 'object' && 'shot' in b;

/**
 * Compile beats into a track. start = {pos, ball}. outcome = {make, tov} decides shots and risky passes.
 * Returns {segs, dur, end}.
 */
function compile(start, beats, outcome = {}, t0 = 0) {
  const segs = []; let t = t0, pos = { ...start.pos }, holder = start.ball;
  const push = (d, m, ball, beat) => {
    const to = { ...pos }; for (const [id, p] of Object.entries(m || {})) to[id] = p;
    segs.push({ t0: t, t1: t + d, from: pos, to, ball, beat });
    pos = to; t += d;
  };
  for (let i = 0; i < beats.length; i++) {
    let b = beats[i], ball = b.ball ?? holder;
    // A risky pass that gets picked off: the stealer jumps the lane, the rest of the possession is gone.
    if (outcome.tov && ball?.pass && b.risky) {
      const [a, , ] = ball.pass, thief = b.risky, recv = ball.pass[1];
      const recvTo = (b.m && b.m[recv]) || pos[recv], from = pos[a];
      const mid = [R(from[0] + (recvTo[0] - from[0]) * 0.62), R(from[1] + (recvTo[1] - from[1]) * 0.62)];
      push(b.d, { ...(b.m || {}), [thief]: mid }, { steal: [a, thief] }, { ...b, cap: 'Picked off' });
      holder = thief;
      push(1.1, { [thief]: [R(mid[0] * 0.6), R(Math.min(46, mid[1] + 12))] }, thief, { cap: 'Turnover' });
      return { segs, dur: t - t0, end: { pos, ball: holder }, t1: t };
    }
    if (isShotBall(ball)) ball = { ...ball, make: !!outcome.make };
    push(b.d, b.m, ball, b);
    if (typeof ball === 'string' || ball === null) holder = ball;
    else if (ball.pass) holder = ball.pass[1];
    else if (ball.steal) holder = ball.steal[1];
    else if (isShotBall(ball)) {
      holder = null;
      if (ball.make) push(0.75, b.after || {}, { net: true }, { cap: ball.three ? 'Three!' : 'Bucket' });
      else {
        const reb = b.reb || 'D5', spot = b.rebSpot || [R(HOOP.x + 3), R(HOOP.y + 7)];
        push(0.9, { ...(b.after || {}), [reb]: spot }, { reb: spot, to: reb }, { cap: 'Rebound' });
        holder = reb;
      }
    }
  }
  return { segs, dur: t - t0, end: { pos, ball: holder }, t1: t };
}
/** State at time t, cut at the end of the track. */
function posAt(track, t) {
  const s = segAt(track, t), u = s.t1 > s.t0 ? clamp((t - s.t0) / (s.t1 - s.t0), 0, 1) : 1, e = easeIO(u), pos = {};
  for (const id in s.to) { const a = s.from[id] || s.to[id], b = s.to[id]; pos[id] = [lerp(a[0], b[0], e), lerp(a[1], b[1], e)]; }
  return { pos, s, u };
}
function segAt(track, t) {
  const segs = track.segs;
  if (t <= segs[0].t0) return segs[0];
  for (const s of segs) if (t < s.t1) return s;
  return segs[segs.length - 1];
}
function stateAt(track, t) {
  const { pos, s, u } = posAt(track, t);
  const b = s.ball; let ball;
  if (typeof b === 'string') {
    // Dribble: ball in the outside hand, bouncing.
    const f = facingOf(track, t, b, pos), side = [-f[1], f[0]];
    const ph = Math.abs(Math.sin(t * Math.PI * 1.8));
    ball = { x: pos[b][0] + side[0] * 1.05 + f[0] * 0.5, y: pos[b][1] + side[1] * 1.05 + f[1] * 0.5, z: 0.4 + ph * 2.6, holder: b, kind: 'dribble' };
  } else if (b?.pass || b?.steal) {
    const [a, c] = b.pass || b.steal, A = s.from[a], C = s.to[c], lob = b.lob ? 9 : 2.2;
    ball = { x: lerp(A[0], C[0], u), y: lerp(A[1], C[1], u), z: 4 + lob * 4 * u * (1 - u) - (b.bounce ? 3.6 * Math.sin(Math.PI * u) : 0), kind: b.steal ? 'steal' : 'pass', from: a, to: c };
    if (b.bounce) ball.z = u < 0.55 ? lerp(3.8, 0.3, u / 0.55) : lerp(0.3, 3.4, (u - 0.55) / 0.45);
  } else if (isShotBall(b)) {
    const S = s.from[b.shot], d = distHoop(S), apex = 4.5 + d * 0.32;
    const tx = b.make ? HOOP.x : HOOP.x + (S[0] > 0 ? -0.9 : 0.9), ty = b.make ? HOOP.y : HOOP.y + 0.9;
    ball = { x: lerp(S[0], tx, u), y: lerp(S[1], ty, u), z: lerp(7.5, RIM_H, u) + apex * 4 * u * (1 - u), kind: 'shot', shooter: b.shot };
  } else if (b?.net) {
    ball = { x: HOOP.x, y: HOOP.y + u * 1.2, z: RIM_H * (1 - u) * (1 - u * 0.2), kind: 'net', u };
  } else if (b?.reb) {
    const from = [HOOP.x + 0.9, HOOP.y + 0.9];
    ball = { x: lerp(from[0], b.reb[0], u), y: lerp(from[1], b.reb[1], u), z: lerp(RIM_H, 6, u) + 5 * 4 * u * (1 - u), kind: 'reb' };
  } else {
    ball = { x: HOOP.x, y: HOOP.y, z: 0, kind: 'dead' };
  }
  return { pos, ball, seg: s, u, holder: typeof b === 'string' ? b : null };
}
/** Unit facing vector (y grows away from the basket, so "toward the rim" is negative y). */
function facingOf(track, t, id, pos) {
  const a = posAt(track, Math.max(0, t - 0.12)).pos[id], c = posAt(track, t + 0.12).pos[id];
  const v = [c[0] - a[0], c[1] - a[1]], sp = Math.hypot(v[0], v[1]);
  if (sp > 0.35) return [v[0] / sp, v[1] / sp];
  const p = pos[id], h = [HOOP.x - p[0], HOOP.y - p[1]], L = Math.hypot(h[0], h[1]) || 1;
  return [h[0] / L, h[1] / L];
}
function facingFor(track, t, id, st) {
  const p = st.pos[id];
  const a = posAt(track, Math.max(0, t - 0.12)).pos[id], c = posAt(track, t + 0.12).pos[id];
  const v = [c[0] - a[0], c[1] - a[1]], sp = Math.hypot(v[0], v[1]);
  let tgt;
  if (id[0] === 'D') tgt = [st.ball.x, st.ball.y];
  else if (st.holder === id || st.ball.shooter === id) tgt = [HOOP.x, HOOP.y];
  else tgt = [st.ball.x, st.ball.y];
  const L0 = Math.hypot(tgt[0] - p[0], tgt[1] - p[1]) || 1, look = [(tgt[0] - p[0]) / L0, (tgt[1] - p[1]) / L0];
  if (sp > 0.6 && id[0] === 'O') { const w = clamp((sp - 0.6) / 1.2, 0, 1); return norm([lerp(look[0], v[0] / sp, w), lerp(look[1], v[1] / sp, w)]); }
  return look;
}
const norm = (v) => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };

/** Point-to-segment distance (feet). */
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const u = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1);
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
}
/**
 * Read the floor at a frozen moment: for each teammate, how open he is (separation from the nearest defender)
 * and how clean the passing lane is (closest defender to the lane). Also offensive spacing.
 */
function readFloor(pos, holder) {
  const hp = pos[holder] || [0, 30], out = {};
  for (const o of OFF) {
    if (o === holder) continue;
    const sep = Math.min(...DEF.map((d) => dist(pos[d], pos[o])));
    const lane = Math.min(...DEF.map((d) => (dist(pos[d], hp) < 2.5 ? 99 : segDist(pos[d], hp, pos[o]))));
    const open = clamp(Math.min(sep / 6, lane / 3.5), 0, 1);
    out[o] = { sep: R(sep), lane: R(lane), open, d: R(distHoop(pos[o])) };
  }
  const pairs = []; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) pairs.push(dist(pos[OFF[i]], pos[OFF[j]]));
  const nearest = OFF.map((a) => Math.min(...OFF.filter((b) => b !== a).map((b) => dist(pos[a], pos[b]))));
  const paint = DEF.filter((d) => Math.abs(pos[d][0]) <= 8 && pos[d][1] <= 19).length;
  const ballDef = Math.min(...DEF.map((d) => dist(pos[d], hp)));
  return { mates: out, spacing: R(mean(nearest)), avgPair: R(mean(pairs)), paint, ballDef: R(ballDef) };
}
const spacingGrade = (s) => (s >= 13 ? 'Great' : s >= 10 ? 'Good' : s >= 7.5 ? 'Cramped' : 'Crowded');
