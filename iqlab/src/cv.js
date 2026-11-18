// ===================== Court Vision: play by touch, from any camera =====================
// A real-time five-on-five possession where you control the ball handler with your finger, seen from a camera you
// pick: behind you (third person), through your eyes (first person), the TV sideline angle, or the classic top view.
// The defense uses the same rule-based engine as the Coverage Sim (defend()), re-run several times a second with a
// short reaction delay, so angles and change of direction beat defenders the way they do in a game.
// Every possession is logged per camera, so you can see which view you actually play best in.

const CAMS = {
  behind: { name: 'Behind you', desc: 'Third person: the camera follows over your shoulder, facing the rim.' },
  eye: { name: 'Your eyes', desc: 'First person: you see the floor the way you would on the court. You don\'t see yourself.' },
  side: { name: 'Broadcast', desc: 'TV angle from the sideline, following the ball.' },
  top: { name: 'Top-down', desc: 'The coaching view used everywhere else in the app.' },
};
const CTRLS = {
  drag: { name: 'Drag yourself', desc: 'Touch the court and drag: your player runs to wherever your finger is. Let go to stop.' },
  stick: { name: 'Thumb stick', desc: 'Touch anywhere and drag a direction like a joystick. Farther = faster. Let go to stop.' },
};
const CV_DEF = { man: 'Man-to-man', packline: 'Pack-line', pressure: 'Heavy pressure', switch: 'Switch everything', zone23: '2-3 zone' };
const CV = { cam: uiGet('cvCam', 'behind'), ctrl: uiGet('cvCtrl', 'drag'), cov: uiGet('cvCov', 'man'), G: null, raf: 0, last: 0, keys: {}, ptr: null };
const CV_SPOTS = { O1: [0, 30], O2: [-19, 19], O3: [19, 19], O4: [-21, 5], O5: [7, 9] };

function renderCV() {
  const el = $('#view-cv');
  if (CV.G) return renderCVPlay(el);
  const L = doc('cv').list;
  el.innerHTML = `<div class="page-head"><span class="eyebrow green">Court Vision</span><h1>Play it from the floor</h1><p>Control the ball with your finger and see the court from different cameras. Drag to dribble, tap a teammate to pass, tap the rim to shoot. This mode is for experimenting: the defense reacts live, and every possession is logged by camera so you can see which view you actually play best in.</p></div>
    <div class="card"><div class="section-title"><h2>Camera</h2></div><div class="mode-pick">${Object.entries(CAMS).map(([k, c]) => `<button type="button" class="mode-card" data-cam="${k}" aria-pressed="${CV.cam === k}"><b>${c.name}</b><span>${c.desc}</span></button>`).join('')}</div>
      <div class="section-title" style="margin-top:14px"><h2>Movement</h2></div><div class="mode-pick">${Object.entries(CTRLS).map(([k, c]) => `<button type="button" class="mode-card" data-ctrl="${k}" aria-pressed="${CV.ctrl === k}"><b>${c.name}</b><span>${c.desc}</span></button>`).join('')}</div>
      <label class="fld" style="margin-top:14px"><span>Defense</span><select id="cv-cov">${Object.entries(CV_DEF).map(([k, n]) => `<option value="${k}" ${CV.cov === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="row" style="margin-top:12px"><button type="button" class="btn green" id="cv-go">${icon('play')} Play</button></div>
      <p class="hint" style="margin-top:10px"><b>Controls:</b> drag on the court to move with the ball · tap a teammate to pass (you then control him) · tap the rim, or double-tap your player, to shoot · near the rim a shot is a layup. Keyboard: WASD or arrows to move, Space to shoot, 2–5 to pass. You can switch cameras during play.</p></div>
    ${cvStatsCard(L)}`;
  for (const b of $$('[data-cam]', el)) b.onclick = () => { CV.cam = b.dataset.cam; uiSet('cvCam', CV.cam); renderCV(); };
  for (const b of $$('[data-ctrl]', el)) b.onclick = () => { CV.ctrl = b.dataset.ctrl; uiSet('cvCtrl', CV.ctrl); renderCV(); };
  $('#cv-cov').onchange = (e) => { CV.cov = e.target.value; uiSet('cvCov', CV.cov); };
  $('#cv-go').onclick = () => { cvNewGame(); renderCV(); };
}
function cvStatsCard(L) {
  if (!L.length) return `<div class="card"><div class="section-title"><h2>Which camera works for you?</h2></div><p class="muted small" style="margin-top:8px">After you play, this compares cameras: points per possession, shot quality (how open your shots were, separate from whether they went in) and turnovers.</p></div>`;
  const rows = Object.keys(CAMS).map((k) => { const a = L.filter((x) => x.cam === k); if (!a.length) return null; const sh = a.filter((x) => x.q != null); return { k, n: a.length, ppp: (a.reduce((s, x) => s + (x.pts || 0), 0) / a.length).toFixed(2), q: sh.length ? Math.round(100 * mean(sh.map((x) => x.q))) : null, tov: Math.round(100 * a.filter((x) => x.res === 'tov').length / a.length), dr: mean(a.map((x) => x.drib || 0)) }; }).filter(Boolean);
  const best = rows.filter((r) => r.n >= 5 && r.q != null).sort((a, b) => b.q - a.q - (b.tov - a.tov) * 0.3)[0];
  return `<div class="card"><div class="section-title"><h2>Which camera works for you?</h2><span class="muted small">${L.length} possessions</span></div>
    <div class="tbl-wrap"><table class="ts-tbl"><thead><tr><th>Camera</th><th>Poss.</th><th>Pts / poss.</th><th>Avg shot quality</th><th>Turnovers</th><th>Avg dribble time</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${CAMS[r.k].name}</td><td>${r.n}</td><td>${r.ppp}</td><td>${r.q == null ? '—' : r.q + '%'}</td><td>${r.tov}%</td><td>${r.dr.toFixed(1)}s</td></tr>`).join('')}</tbody></table></div>
    <p class="small" style="margin-top:8px">${best ? `So far your best decisions come from <b>${CAMS[best.k].name}</b>: the most open shots (${best.q}% average make chance) with ${best.tov}% turnovers.` : 'Play at least 5 possessions with a camera to compare it.'} Shot quality is the make chance at release: it measures your decision, not your luck.</p></div>`;
}

// ---------- game state ----------
function cvNewGame() { CV.G = { score: 0, poss: 0, log: [], msg: '' }; cvNewPoss(); }
function cvNewPoss() {
  const G = CV.G, pos = {}, vel = {};
  for (const o of OFF) { const p = CV_SPOTS[o]; pos[o] = [p[0] + (Math.random() - 0.5) * 2, p[1] + (Math.random() - 0.5) * 2]; vel[o] = [0, 0]; }
  const S = { cov: CV.cov, intensity: 2, assign: Object.fromEntries(DEF.map((d, i) => [d, OFF[i]])), size: { O1: 1, O2: 2, O3: 3, O4: 4, O5: 5 }, names: Object.fromEntries(OFF.map((o) => [o, ROLE[o]])), pos };
  const d0 = defend(S, pos, 'O1', []); for (const d of DEF) { pos[d] = d0.m[d]; vel[d] = [0, 0]; }
  Object.assign(G, { pos, vel, S, holder: 'O1', ball: { kind: 'hold' }, t: 0, clock: 24, tgt: {}, hist: [], defT: 0, over: null, passes: 0, drib: 0, q: null, face: {}, camYaw: null, lastTap: 0, stick: null, dragAt: null });
  G.face = Object.fromEntries([...OFF, ...DEF].map((id) => [id, norm(sub(T_HOOP, pos[id]))]));
  G.tgt = { ...d0.m };
}
function cvEnd(res, pts) {
  const G = CV.G; if (G.over) return;
  G.over = { res, pts, at: G.t };
  G.score += pts; G.poss++;
  const rec = { ts: Date.now(), cam: CV.cam, ctrl: CV.ctrl, cov: CV.cov, res, pts, q: G.q, passes: G.passes, drib: r1(G.drib) };
  const D = doc('cv'); D.list.push(rec); if (D.list.length > 400) D.list.splice(0, D.list.length - 400); persist('cv');
  G.msg = { make: pts === 3 ? 'Three!' : 'Bucket!', miss: 'Miss', tov: 'Turnover', violation: 'Shot-clock violation' }[res];
  cvPanel();
  setTimeout(() => { if (CV.G === G && current === 'cv') { cvNewPoss(); G.msg = ''; cvPanel(); } }, 1900);
}

// ---------- simulation step ----------
const CV_SPEED = { ball: 16, off: 14, onBall: 15, def: 13.5 };
function cvStep(dt) {
  const G = CV.G; if (!G || G.over && G.ball.kind !== 'shot' && G.ball.kind !== 'reb') { if (G) G.t += dt; return; }
  G.t += dt; const pos = G.pos, H = G.holder;
  if (!G.over && G.ball.kind !== 'shot') { G.clock -= dt; if (G.clock <= 0) return cvEnd('violation', 0); }
  // --- your player
  let want = [0, 0];
  if (G.ball.kind === 'hold') {
    const me = pos[H];
    if (CV.ctrl === 'drag' && G.dragAt) { const v = sub(G.dragAt, me), L = Math.hypot(v[0], v[1]); if (L > 0.6) want = mul(v, Math.min(1, L / 4) * CV_SPEED.ball / L); }
    if (CV.ctrl === 'stick' && G.stick) want = mul(G.stick, CV_SPEED.ball);
    const kv = cvKeyVec(); if (kv) want = mul(kv, CV_SPEED.ball);
  }
  const k = 1 - Math.exp(-dt * 9);
  G.vel[H] = lerpP(G.vel[H], want, k);
  if (Math.hypot(...G.vel[H]) > 2) G.drib += dt;
  // --- teammates: hold spots, clear out of the driver's way, drift to open space
  for (const o of OFF) {
    if (o === H) continue;
    let home = CV_SPOTS[o]; const p = pos[o];
    if (dist(p, pos[H]) < 9) home = add(p, mul(norm(sub(p, pos[H])), 6));
    if (distHoop(pos[H]) < 14 && sgn(pos[H][0]) === sgn(home[0]) && home[1] > 12 && home[1] < 22) home = [sgn(home[0]) * 21, 6]; // drift to the corner on a drive
    const v = sub(home, p), L = Math.hypot(v[0], v[1]);
    G.vel[o] = lerpP(G.vel[o], L > 0.8 ? mul(v, Math.min(CV_SPEED.off, L * 2) / L) : [0, 0], k);
  }
  // --- defense: re-run the coverage engine with a reaction delay
  G.hist.push({ t: G.t, p: [...pos[H]] }); while (G.hist.length && G.hist[0].t < G.t - 0.6) G.hist.shift();
  G.defT -= dt;
  if (G.defT <= 0 && G.ball.kind !== 'shot') {
    G.defT = 0.14;
    const lag = G.hist.find((h) => h.t >= G.t - 0.24) || G.hist[0], seen = { ...pos, [H]: lag.p };
    const dH = DEF.find((d) => G.S.assign[d] === H), hv = G.vel[H], sp = Math.hypot(hv[0], hv[1]);
    const behind = dH && distHoop(pos[dH]) > distHoop(pos[H]) + 0.8, ev = [];
    if (G.ball.kind === 'hold' && sp > 8 && distHoop(pos[H]) < 22 && (hv[0] * (0 - pos[H][0]) + hv[1] * (T_HOOP[1] - pos[H][1])) > 0) ev.push({ type: 'drive', user: H, from: G.hist[0].p, contained: !behind });
    G.S.pos = pos;
    const D = defend(G.S, seen, G.ball.kind === 'pass' ? G.ball.to : H, ev);
    G.S.assign = D.assign; G.tgt = D.m; G.roles = D.roles;
  }
  for (const d of DEF) {
    const t = G.tgt[d] || pos[d], v = sub(t, pos[d]), L = Math.hypot(v[0], v[1]), onBall = G.S.assign[d] === H;
    const vmax = onBall ? CV_SPEED.onBall : CV_SPEED.def;
    G.vel[d] = lerpP(G.vel[d], L > 0.3 ? mul(v, Math.min(vmax, L * 3.2) / L) : [0, 0], 1 - Math.exp(-dt * (onBall ? 7 : 5)));
  }
  for (const id of [...OFF, ...DEF]) { pos[id] = clampCourt(add(pos[id], mul(G.vel[id], dt))); }
  // bodies don't overlap: offense vs defense push apart (the ball handler is slowed by a set defender)
  for (const o of OFF) for (const d of DEF) {
    const v = sub(pos[o], pos[d]), L = Math.hypot(v[0], v[1]) || 0.01, min = 2.3;
    if (L < min) { const push = mul(v, (min - L) / L / 2); pos[o] = add(pos[o], push); pos[d] = sub(pos[d], push); if (o === H) G.vel[H] = mul(G.vel[H], 0.6); }
  }
  // facing
  for (const id of [...OFF, ...DEF]) {
    const v = G.vel[id], sp = Math.hypot(v[0], v[1]);
    let f = id[0] === 'D' ? norm(sub(cvBallXY(), pos[id])) : id === H ? (sp > 3 ? norm(v) : norm(sub(T_HOOP, pos[id]))) : norm(sub(cvBallXY(), pos[id]));
    G.face[id] = norm(lerpP(G.face[id], f, 1 - Math.exp(-dt * 8)));
  }
  // --- ball
  const B = G.ball;
  if (B.kind === 'hold') {
    // strip chance when a defender is on the ball side and you dribble into him
    const bp = cvBallXY();
    for (const d of DEF) if (dist(pos[d], bp) < 1.5 && Math.hypot(...G.vel[H]) > 4 && Math.random() < dt * 0.9) { G.msg = `Stripped by X${d[1]}`; return cvEnd('tov', 0); }
  } else if (B.kind === 'pass') {
    B.u += dt / B.dur;
    if (B.u >= 1 && B.to[0] === 'D') { G.ball = { kind: 'dead' }; }
    else if (B.u >= 1) { G.holder = B.to; G.ball = { kind: 'hold' }; G.passes++; G.dragAt = null; G.stick = null; cvPanel(); }
  } else if (B.kind === 'shot') {
    B.u += dt / B.dur;
    if (B.u >= 1 && !B.done) { B.done = true; if (B.make) cvEnd('make', B.three ? 3 : 2); else { cvEnd('miss', 0); G.ball = { kind: 'reb', u: 0, to: DEF.slice().sort((a, b) => distHoop(pos[a]) - distHoop(pos[b]))[0] }; } }
  } else if (B.kind === 'reb') B.u = Math.min(1, B.u + dt / 0.8);
}
function cvKeyVec() {
  const K = CV.keys; let x = (K.ArrowRight || K.d ? 1 : 0) - (K.ArrowLeft || K.a ? 1 : 0), y = (K.ArrowUp || K.w ? 1 : 0) - (K.ArrowDown || K.s ? 1 : 0);
  if (!x && !y) return null;
  // keys are camera-relative: "up" = the way the camera looks
  const fw = cvCamForward(), rt = [-fw[1], fw[0]];
  return norm(add(mul(fw, y), mul(rt, -x)));
}
function cvCamForward() { const G = CV.G; if (CV.cam === 'top') return [0, -1]; if (CV.cam === 'side') return [1, 0]; return G.camF || [0, -1]; }
function cvBallXY() { const G = CV.G, B = G.ball; if (B.kind === 'hold') { const p = G.pos[G.holder], f = G.face[G.holder] || [0, -1]; return add(p, add(mul([-f[1], f[0]], -1.0), mul(f, 0.6))); } if (B.kind === 'pass') return lerpP(G.pos[B.from], G.pos[B.to], B.u); if (B.kind === 'shot') return lerpP(B.from, T_HOOP, B.u); if (B.kind === 'reb') return lerpP(T_HOOP, G.pos[B.to], B.u); return T_HOOP; }
function cvBallZ() { const G = CV.G, B = G.ball; if (B.kind === 'hold') return 0.4 + Math.abs(Math.sin(G.t * Math.PI * 2.1)) * 2.7; if (B.kind === 'pass') return 4.2 + 2 * 4 * B.u * (1 - B.u); if (B.kind === 'shot') { const d = distHoop(B.from); return lerp(7.5, 10, B.u) + (4.5 + d * 0.32) * 4 * B.u * (1 - B.u); } if (B.kind === 'reb') return lerp(10, 5, B.u) + 4 * 4 * B.u * (1 - B.u); return 0; }

// ---------- actions ----------
function cvPass(to) {
  const G = CV.G; if (!G || G.over || G.ball.kind !== 'hold' || to === G.holder) return;
  const a = G.pos[G.holder], b = G.pos[to], L = dist(a, b);
  // a defender sitting in the lane can deflect it
  let steal = null;
  for (const d of DEF) { const k = segDist(G.pos[d], toward(a, b, 2), toward(b, a, 2.5)); if (k < 1.4 && Math.random() < 0.55) { steal = d; break; } }
  if (steal) { G.msg = `Picked off by X${steal[1]}`; G.ball = { kind: 'pass', from: G.holder, to: steal, u: 0, dur: L / 60 + 0.1 }; return setTimeout(() => cvEnd('tov', 0), 250); }
  G.ball = { kind: 'pass', from: G.holder, to, u: 0, dur: L / 45 + 0.15 }; G.dragAt = null; G.stick = null;
}
function cvShoot() {
  const G = CV.G; if (!G || G.over || G.ball.kind !== 'hold') return;
  const p = G.pos[G.holder], d = distHoop(p), closest = Math.min(...DEF.map((x) => dist(G.pos[x], p)));
  const three = d >= 22 || (Math.abs(p[0]) >= 22 && p[1] <= 14.2);
  const q = d > 30 ? 0.04 : shotProb(d, closest, three, 2);
  G.q = q; G.ball = { kind: 'shot', from: [...p], u: 0, dur: 0.85 + d * 0.022, make: Math.random() < q, three, q };
  G.msg = `${d < 6 ? 'Layup' : three ? 'Three' : 'Jumper'} · ${Math.round(q * 100)}% shot (closest defender ${closest.toFixed(1)} ft)`;
  cvPanel();
}

// ---------- 3D renderer ----------
class Court3D {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.resize(); this.hits = []; }
  resize() {
    const w = Math.max(280, Math.round(this.c.parentElement.clientWidth)), dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const h = Math.round(w < 700 ? w * 1.2 : w * 0.62);
    this.W = w; this.H = h; this.dpr = dpr; this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
  }
  setCam(eye, target, fovK = 0.85) {
    this.eye = eye; const f = norm3(sub3(target, eye)); let r = cross3(f, [0, 0, 1]); r = norm3(r); const u = cross3(r, f);
    this.f = f; this.r = r; this.u = u; this.F = Math.max(this.W, this.H) * fovK;
  }
  cam(p) { const v = sub3(p, this.eye); return [dot3(v, this.r), dot3(v, this.u), dot3(v, this.f)]; }
  proj(c) { return [this.W / 2 + (c[0] / c[2]) * this.F, this.H / 2 - (c[1] / c[2]) * this.F]; }
  P(p) { const c = this.cam(p); return c[2] > 0.3 ? this.proj(c) : null; }
  /** polygon on the floor (or anywhere), clipped to the near plane */
  poly(pts, fill, stroke) {
    const N = 0.4, C = pts.map((p) => this.cam(p)), out = [];
    for (let i = 0; i < C.length; i++) { const a = C[i], b = C[(i + 1) % C.length]; const ai = a[2] >= N, bi = b[2] >= N; if (ai) out.push(a); if (ai !== bi) { const t = (N - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, N]); } }
    if (out.length < 3) return; const g = this.ctx; g.beginPath(); out.forEach((c, i) => { const s = this.proj(c); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); }); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); }
  }
  line(pts, col, w) {
    const g = this.ctx, N = 0.4; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); let pen = false;
    for (let i = 0; i < pts.length - 1; i++) {
      let a = this.cam(pts[i]), b = this.cam(pts[i + 1]);
      if (a[2] < N && b[2] < N) { pen = false; continue; }
      if (a[2] < N) { const t = (N - a[2]) / (b[2] - a[2]); a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, N]; pen = false; }
      let cut = false; if (b[2] < N) { const t = (N - a[2]) / (b[2] - a[2]); b = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, N]; cut = true; }
      const sa = this.proj(a), sb = this.proj(b); if (!pen) g.moveTo(sa[0], sa[1]); g.lineTo(sb[0], sb[1]); pen = !cut;
    }
    g.stroke();
  }
  floorAt(sx, sy) { const dx = (sx - this.W / 2) / this.F, dy = -(sy - this.H / 2) / this.F; const d = add3(this.f, add3(mul3(this.r, dx), mul3(this.u, dy))); if (d[2] >= -1e-3) return null; const t = -this.eye[2] / d[2]; return [this.eye[0] + d[0] * t, this.eye[1] + d[1] * t]; }
  draw(G, hideYou) {
    const g = this.ctx, { W, H } = this; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // arena: dark crowd above the horizon
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#05081a'); sky.addColorStop(0.5, '#0d1636'); sky.addColorStop(1, '#070b1d'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const hz = this.proj([0, 1e-6 + 0, 1]); void hz;
    this.poly([[-40, -12, 0], [40, -12, 0], [40, 64, 0], [-40, 64, 0]], '#0b1330');
    // stands: rows of dots along the far sides to give depth
    g.fillStyle = 'rgba(120,140,200,.10)';
    for (let x = -38; x <= 38; x += 3) for (const y of [-10, 62]) for (let z = 1; z < 14; z += 3) { const s = this.P([x, y, z]); if (s) g.fillRect(s[0], s[1], 2, 2); }
    for (let y = -8; y <= 60; y += 3) for (const x of [-38, 38]) for (let z = 1; z < 14; z += 3) { const s = this.P([x, y, z]); if (s) g.fillRect(s[0], s[1], 2, 2); }
    // hardwood
    this.poly([[-25, 0, 0], [25, 0, 0], [25, 47, 0], [-25, 47, 0]], '#c98d52');
    g.globalAlpha = 0.18; for (let x = -24; x < 25; x += 2) this.line([[x, 0, 0], [x, 47, 0]], '#7a4a1e', 1); g.globalAlpha = 1;
    this.poly([[-8, 0, 0], [8, 0, 0], [8, 19, 0], [-8, 19, 0]], 'rgba(30,64,170,.9)');
    const arc = (cx, cy, r, a0, a1, n = 36) => { const a = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * (i / n); a.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r, 0.01]); } return a; };
    const LW = 2, LC = 'rgba(255,255,255,.92)';
    this.line([[-25, 0, 0.01], [25, 0, 0.01], [25, 47, 0.01], [-25, 47, 0.01], [-25, 0, 0.01]], LC, LW);
    this.line([[-8, 0, 0.01], [-8, 19, 0.01], [8, 19, 0.01], [8, 0, 0.01]], LC, LW);
    this.line(arc(0, 19, 6, 0, Math.PI * 2, 40), LC, LW);
    const a = Math.atan2(14.2 - 5.25, 22); this.line([[-22, 0, 0.01], [-22, 14.2, 0.01], ...arc(0, 5.25, 23.75, Math.PI - a, a, 48), [22, 14.2, 0.01], [22, 0, 0.01]], LC, LW);
    this.line(arc(0, 5.25, 4, 0, Math.PI, 20), LC, LW);
    this.line(arc(0, 47, 6, Math.PI, Math.PI * 2, 24), LC, LW);
    // objects sorted far to near: players, ball, hoop
    const objs = [];
    for (const id of [...OFF, ...DEF]) { if (hideYou && id === G.holder && G.ball.kind !== 'pass') continue; const p = G.pos[id]; const c = this.cam([p[0], p[1], 3]); if (c[2] > 0.8) objs.push({ z: c[2], fn: () => this.player(G, id) }); }
    const bxy = cvBallXY(), bz = cvBallZ(), bc = this.cam([bxy[0], bxy[1], bz]); if (bc[2] > 0.5) objs.push({ z: bc[2] - 0.3, fn: () => this.ball(bxy, bz) });
    const hc = this.cam([0, 5, 10]); objs.push({ z: hc[2], fn: () => this.hoop() });
    objs.sort((p, q) => q.z - p.z); this.hits = []; for (const o of objs) o.fn();
    if (hideYou && G.ball.kind === 'hold') this.firstPersonBall(G);
  }
  hoop() {
    const g = this.ctx;
    this.line([[0, -2.5, 0], [0, -2.5, 11.5], [0, 4, 11.5]], '#8892ad', 3);
    this.poly([[-3, 4, 9], [3, 4, 9], [3, 4, 12.5], [-3, 4, 12.5]], 'rgba(220,235,255,.22)', 'rgba(255,255,255,.9)');
    this.poly([[-1, 4, 10], [1, 4, 10], [1, 4, 11.5], [-1, 4, 11.5]], null, 'rgba(255,255,255,.9)');
    const rim = [], net = []; for (let i = 0; i <= 20; i++) { const t = (i / 20) * Math.PI * 2; rim.push([Math.cos(t) * 0.75, 5.25 + Math.sin(t) * 0.75, 10]); net.push([Math.cos(t + 0.3) * 0.45, 5.25 + Math.sin(t + 0.3) * 0.45, 8.6]); }
    g.globalAlpha = 0.75; for (let i = 0; i < 20; i += 2) this.line([rim[i], net[i]], '#ffffff', 1); this.line(net, '#ffffff', 1); g.globalAlpha = 1;
    this.line(rim, '#ff6a1f', 3);
    const s = this.P([0, 5.25, 10]); if (s) this.hits.push({ id: 'RIM', x: s[0], y: s[1], r: 34 });
  }
  ball(xy, z) {
    const g = this.ctx, s = this.P([xy[0], xy[1], z]); if (!s) return; const c = this.cam([xy[0], xy[1], z]), r = Math.max(2.5, (0.39 / c[2]) * this.F);
    const sh = this.P([xy[0], xy[1], 0]); if (sh) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(sh[0], sh[1], r, r * 0.4, 0, 0, Math.PI * 2); g.fill(); }
    const gr = g.createRadialGradient(s[0] - r * 0.3, s[1] - r * 0.3, r * 0.1, s[0], s[1], r); gr.addColorStop(0, '#ffb067'); gr.addColorStop(0.6, '#f0731f'); gr.addColorStop(1, '#a8420c');
    g.fillStyle = gr; g.beginPath(); g.arc(s[0], s[1], r, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(40,15,5,.7)'; g.lineWidth = Math.max(0.8, r * 0.12); g.beginPath(); g.moveTo(s[0] - r, s[1]); g.lineTo(s[0] + r, s[1]); g.moveTo(s[0], s[1] - r); g.lineTo(s[0], s[1] + r); g.stroke();
  }
  firstPersonBall(G) {
    // your hands and the ball at the bottom of the screen, bouncing with the dribble
    const g = this.ctx, W = this.W, H = this.H, z = cvBallZ(), y = H - 30 - (z / 3.2) * H * 0.16, r = W * 0.06;
    const gr = g.createRadialGradient(W * 0.68 - r * 0.3, y - r * 0.3, r * 0.1, W * 0.68, y, r); gr.addColorStop(0, '#ffb067'); gr.addColorStop(0.6, '#f0731f'); gr.addColorStop(1, '#a8420c');
    g.fillStyle = gr; g.beginPath(); g.arc(W * 0.68, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = SKIN[1]; g.beginPath(); g.ellipse(W * 0.68, y - r * 1.05, r * 0.7, r * 0.35, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(W * 0.22, H + 10, r * 0.9, r * 1.6, 0.3, 0, Math.PI * 2); g.fill();
    this.hits.push({ id: G.holder, x: W * 0.68, y, r: r * 1.4 });
  }
  player(G, id) {
    const g = this.ctx, p = G.pos[id], off = id[0] === 'O', kit = off ? OFF_KIT : DEF_KIT, n = Number(id[1]);
    const hgt = off ? 6.4 : 6.0, F = this.P([p[0], p[1], 0]), Hd = this.P([p[0], p[1], hgt]); if (!F || !Hd) return;
    const k = (F[1] - Hd[1]) / hgt; if (k <= 0.5) return;
    const sp = Math.hypot(...G.vel[id]), run = Math.sin(G.t * 11 + n) * clamp(sp / 12, 0, 1);
    const face = G.face[id] || [0, -1], toCam = norm([this.eye[0] - p[0], this.eye[1] - p[1]]), back = face[0] * toCam[0] + face[1] * toCam[1] < 0;
    const lat = (face[0] * this.r[0] + face[1] * this.r[1]); // + = facing screen-right
    const x = F[0], y = F[1], skin = SKIN[(n + (off ? 0 : 5)) % SKIN.length];
    const contest = !off && G.ball.kind === 'shot' && dist(p, G.ball.from) < 7;
    // shadow
    g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(x, y, 1.3 * k, 0.45 * k, 0, 0, Math.PI * 2); g.fill();
    if (id === G.holder && !G.over) { g.strokeStyle = 'rgba(80,220,140,.95)'; g.lineWidth = Math.max(2, k * 0.18); g.beginPath(); g.ellipse(x, y, 1.6 * k, 0.6 * k, 0, 0, Math.PI * 2); g.stroke(); }
    const hipY = y - (off ? 3.2 : 2.7) * k, shY = y - (off ? 5.2 : 4.7) * k, stance = off ? 0.42 : 0.85;
    g.lineCap = 'round';
    // legs
    for (const s of [-1, 1]) {
      const fx = x + s * stance * k + run * s * 0.5 * k, kx = x + s * stance * 0.75 * k, ky = y - (off ? 1.6 : 1.3) * k;
      g.strokeStyle = skin; g.lineWidth = 0.42 * k; g.beginPath(); g.moveTo(x + s * 0.32 * k, hipY); g.lineTo(kx, ky); g.lineTo(fx, y - 0.25 * k); g.stroke();
      g.fillStyle = '#111827'; g.beginPath(); g.ellipse(fx + lat * 0.2 * k, y - 0.15 * k, 0.38 * k, 0.2 * k, 0, 0, Math.PI * 2); g.fill();
    }
    // shorts + torso
    g.fillStyle = kit.b; roundRect(g, x - 0.75 * k, hipY - 0.2 * k, 1.5 * k, 1.1 * k, 0.25 * k); g.fill();
    const tg = g.createLinearGradient(x - k, shY, x + k, hipY); tg.addColorStop(0, kit.a); tg.addColorStop(1, kit.b);
    g.fillStyle = tg; roundRect(g, x - 0.82 * k, shY, 1.64 * k, hipY - shY + 0.1 * k, 0.4 * k); g.fill(); g.strokeStyle = kit.trim; g.lineWidth = Math.max(1, 0.08 * k); g.stroke();
    // arms
    const arm = (sx, hx, hy) => { g.strokeStyle = skin; g.lineWidth = 0.32 * k; g.beginPath(); g.moveTo(x + sx * 0.75 * k, shY + 0.3 * k); g.lineTo(x + hx * k, y - hy * k); g.stroke(); g.fillStyle = skin; g.beginPath(); g.arc(x + hx * k, y - hy * k, 0.18 * k, 0, Math.PI * 2); g.fill(); };
    if (!off) { if (contest) { arm(-1, -0.5, 7.4); arm(1, 0.5, 7.4); } else { arm(-1, -1.7, 4.1 + run * 0.2); arm(1, 1.7, 4.3 - run * 0.2); } }
    else if (id === G.holder && G.ball.kind === 'hold') { const bs = lat >= 0 ? -1 : 1; arm(bs, bs * 1.05, 2.4); arm(-bs, -bs * 0.9, 3.6); }
    else { arm(-1, -1.0 - run * 0.3, 3.3); arm(1, 1.0 + run * 0.3, 3.3); }
    // number
    g.fillStyle = kit.num; g.font = `800 ${Math.max(7, (back ? 0.95 : 0.6) * k)}px "Space Grotesk", Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x, shY + (back ? 0.9 : 0.6) * k);
    // head
    const hy = shY - 0.55 * k; g.fillStyle = skin; g.beginPath(); g.arc(x, hy, 0.45 * k, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(20,14,10,.92)'; g.beginPath(); if (back) g.arc(x, hy, 0.46 * k, 0, Math.PI * 2); else g.arc(x, hy - 0.12 * k, 0.42 * k, Math.PI, 0); g.fill();
    if (off) { g.fillStyle = kit.trim; g.fillRect(x - 0.42 * k, hy - 0.2 * k, 0.84 * k, 0.1 * k); }
    // label
    const lab = id === G.holder && off ? 'YOU' : off ? ROLE[id] : 'X' + n;
    g.font = `700 ${clamp(0.75 * k, 9, 13)}px Inter, sans-serif`; const tw = g.measureText(lab).width + 8;
    g.fillStyle = off ? (lab === 'YOU' ? 'rgba(40,190,110,.92)' : 'rgba(18,40,110,.85)') : 'rgba(60,18,32,.8)'; roundRect(g, x - tw / 2, hy - 0.9 * k - 16, tw, 15, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText(lab, x, hy - 0.9 * k - 8.5);
    this.hits.push({ id, x, y: (y + hy) / 2, r: Math.max(18, 1.4 * k), top: hy - 0.6 * k, bot: y, w: Math.max(20, 1.2 * k) });
  }
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };

// ---------- play view ----------
function renderCVPlay(el) {
  if (!el.querySelector('.cv-run')) {
    el.innerHTML = `<div class="cv-run"><div class="play-head"><button type="button" class="btn ghost sm" id="cv-back">‹ Court Vision</button><div class="ph-title"><span class="eyebrow green" id="cv-eyebrow"></span><h2>Live possession</h2></div></div>
      <div class="play-grid"><div class="stage-col"><div class="stage cv-stage" id="cv-stage"><canvas id="cv-3d" aria-label="Live five-on-five possession"></canvas><canvas id="cv-top" hidden aria-label="Live possession, top view"></canvas>
        <div class="hud"><div class="hud-mode" data-m="live" id="cv-hud">LIVE</div><div class="hud-clock" id="cv-clock"><small>SHOT CLOCK</small><b>24.0</b></div><div class="hud-prompt" id="cv-msg" hidden></div></div>
        <div class="cv-cams" role="group" aria-label="Camera">${Object.entries(CAMS).map(([k, c]) => `<button type="button" data-cvcam="${k}" aria-pressed="${CV.cam === k}">${c.name}</button>`).join('')}</div></div>
        <div class="row small muted cv-help" id="cv-help"></div></div>
      <aside class="panel" id="cv-panel" aria-live="polite"></aside></div></div>`;
    CV.v3 = new Court3D($('#cv-3d')); CV.v2 = new CourtView($('#cv-top'));
    $('#cv-back').onclick = () => { cancelAnimationFrame(CV.raf); CV.raf = 0; CV.G = null; renderCV(); };
    for (const b of $$('[data-cvcam]', el)) b.onclick = () => { CV.cam = b.dataset.cvcam; uiSet('cvCam', CV.cam); for (const x of $$('[data-cvcam]', el)) x.setAttribute('aria-pressed', String(x === b)); cvShowCanvas(); cvPanel(); };
    for (const c of [$('#cv-3d'), $('#cv-top')]) cvBindInput(c);
  }
  cvShowCanvas(); cvPanel(); cvLoop();
}
function cvShowCanvas() { const top = CV.cam === 'top'; $('#cv-3d').hidden = top; $('#cv-top').hidden = !top; if (top) CV.v2.resize(); else CV.v3.resize(); $('#cv-help').innerHTML = `<span>${CTRLS[CV.ctrl].name}: ${CTRLS[CV.ctrl].desc}</span>`; }
function cvPanel() {
  const P = $('#cv-panel'), G = CV.G; if (!P || !G) return;
  $('#cv-eyebrow').textContent = `${CAMS[CV.cam].name} · ${CTRLS[CV.ctrl].name} · vs ${CV_DEF[CV.cov]}`;
  const m = $('#cv-msg'); m.hidden = !G.msg; m.textContent = G.msg || '';
  const L = doc('cv').list.filter((x) => x.cam === CV.cam), sh = L.filter((x) => x.q != null);
  P.innerHTML = `<div class="decide-head"><span class="eyebrow">Score</span><h3>${G.score} pts · ${G.poss} possession${G.poss === 1 ? '' : 's'}</h3></div>
    <p class="small">You have the ball: <b>${ROLE[G.holder]}</b>. ${G.ball.kind === 'hold' ? 'Drag to move, tap a teammate to pass, tap the rim to shoot.' : ''}</p>
    <div class="bd"><h4>This camera so far</h4><p class="small">${L.length ? `${L.length} possessions · ${(L.reduce((s, x) => s + (x.pts || 0), 0) / L.length).toFixed(2)} pts each · avg shot quality ${sh.length ? Math.round(100 * mean(sh.map((x) => x.q))) + '%' : '—'} · ${Math.round(100 * L.filter((x) => x.res === 'tov').length / L.length)}% turnovers` : 'No possessions with this camera yet.'}</p></div>
    <div class="bd def"><h4>How the defense plays</h4><p class="small">${esc(COVERAGES[CV.cov].desc)} The defenders react about a quarter-second after you move, so a hard change of direction gets you a step.</p></div>
    <p class="hint">Shot quality = make chance at release (distance + closest defender). It grades the decision, not the result.</p>`;
}
function cvBindInput(cv) {
  cv.style.touchAction = 'none';
  const hitTest = (sx, sy) => {
    const G = CV.G;
    if (CV.cam === 'top') {
      const p = CV.v2.toCourt(sx, sy); if (distHoop(p) < 2.6) return { id: 'RIM' };
      let best = null, bd = 2.8; for (const o of OFF) { const d = dist(G.pos[o], p); if (d < bd) { bd = d; best = o; } } return best ? { id: best } : { floor: p };
    }
    const V = CV.v3; let best = null, bd = 1e9;
    // players first (a teammate standing under the rim is a pass, not a shot), then the rim
    for (const h of V.hits) { if (h.id === 'RIM' || h.id[0] !== 'O') continue; const inBox = h.top != null ? (Math.abs(sx - h.x) < h.w && sy > h.top - 18 && sy < h.bot + 6) : Math.hypot(sx - h.x, sy - h.y) < h.r; if (inBox) { const d = Math.hypot(sx - h.x, sy - h.y); if (d < bd) { bd = d; best = h.id; } } }
    if (best) return { id: best };
    const rim = V.hits.find((h) => h.id === 'RIM'); if (rim && Math.hypot(sx - rim.x, sy - rim.y) < rim.r) return { id: 'RIM' };
    const f = V.floorAt(sx, sy); return f ? { floor: f } : {};
  };
  cv.addEventListener('pointerdown', (e) => {
    const G = CV.G; if (!G || G.over) return; const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const h = hitTest(sx, sy);
    if (h.id === 'RIM') return cvShoot();
    if (h.id && h.id !== G.holder) return cvPass(h.id);
    if (h.id === G.holder) { const now = performance.now(); if (now - G.lastTap < 350) return cvShoot(); G.lastTap = now; }
    cv.setPointerCapture?.(e.pointerId);
    CV.ptr = { x0: sx, y0: sy, id: e.pointerId };
    if (CV.ctrl === 'drag' && h.floor) G.dragAt = clampCourt(h.floor);
  });
  cv.addEventListener('pointermove', (e) => {
    const G = CV.G; if (!G || !CV.ptr || CV.ptr.id !== e.pointerId) return; const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (CV.ctrl === 'drag') { const f = CV.cam === 'top' ? CV.v2.toCourt(sx, sy) : CV.v3.floorAt(sx, sy); if (f) G.dragAt = clampCourt(f); }
    else {
      const dx = sx - CV.ptr.x0, dy = sy - CV.ptr.y0, L = Math.hypot(dx, dy); if (L < 6) { G.stick = null; return; }
      const fw = cvCamForward(), rt = CV.cam === 'top' ? [1, 0] : CV.cam === 'side' ? [0, -1] : [-fw[1], fw[0]];
      const right = CV.cam === 'top' ? [1, 0] : CV.cam === 'side' ? [0, -1] : [CV.v3.r[0], CV.v3.r[1]];
      const fwd = CV.cam === 'top' ? [0, -1] : CV.cam === 'side' ? [1, 0] : norm([CV.v3.f[0], CV.v3.f[1]]);
      void rt; G.stick = mul(norm(add(mul(right, dx), mul(fwd, -dy))), Math.min(1, L / 60));
    }
  });
  const up = (e) => { if (CV.ptr && CV.ptr.id === e.pointerId) { CV.ptr = null; const G = CV.G; if (G) { G.stick = null; G.dragAt = null; } } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
window.addEventListener('keydown', (e) => {
  if (current !== 'cv' || !CV.G || /input|select|textarea/i.test(e.target.tagName)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { CV.keys[k] = true; e.preventDefault(); }
  if (k === ' ') { e.preventDefault(); cvShoot(); }
  if (['2', '3', '4', '5'].includes(k)) { const o = 'O' + k; cvPass(o === CV.G.holder ? 'O1' : o); }
});
window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; delete CV.keys[k]; });
function cvLoop() {
  if (CV.raf) return; CV.last = performance.now();
  const step = (now) => {
    CV.raf = 0; if (current !== 'cv' || !CV.G) return;
    const dt = Math.min(0.04, (now - CV.last) / 1000); CV.last = now;
    cvStep(dt); cvDraw();
    const c = $('#cv-clock b'); if (c) { c.textContent = Math.max(0, CV.G.clock).toFixed(1); $('#cv-clock').classList.toggle('low', CV.G.clock < 5); }
    CV.raf = requestAnimationFrame(step);
  };
  CV.raf = requestAnimationFrame(step);
}
function cvDraw() {
  const G = CV.G;
  if (CV.cam === 'top') {
    const B = G.ball, ball = B.kind === 'hold' ? G.holder : B.kind === 'pass' ? { pass: [B.from, B.to] } : B.kind === 'shot' ? { shot: G.holder, make: B.make, three: B.three } : B.kind === 'reb' ? { reb: G.pos[B.to] } : null;
    const from = { ...G.pos }; if (B.kind === 'shot') from[G.holder] = B.from;
    const tr = { segs: [{ t0: 0, t1: 1, from, to: { ...G.pos }, ball, beat: {} }], t1: 1 };
    const u = B.kind === 'hold' ? (G.t % 1) * 0.98 : clamp(B.u ?? 1, 0, 0.999);
    CV.v2.draw(tr, u, { you: G.holder, labels: { [G.holder]: 'YOU' }, captions: false });
    if (G.dragAt) { const V = CV.v2, c = V.ctx; c.save(); c.strokeStyle = 'rgba(80,220,140,.8)'; c.setLineDash([4, 4]); c.beginPath(); c.arc(V.X(G.dragAt[0]), V.Y(G.dragAt[1]), V.s * 1.2, 0, Math.PI * 2); c.stroke(); c.restore(); }
    return;
  }
  const V = CV.v3, me = G.pos[G.holder];
  // camera yaw follows the line from you to the rim, smoothed so it doesn't whip around
  const want = norm(sub(T_HOOP, me)); G.camF = G.camF ? norm(lerpP(G.camF, want, 0.06)) : want;
  if (CV.cam === 'behind') { const f = G.camF; V.setCam([me[0] - f[0] * 13, me[1] - f[1] * 13, 9.5], [me[0] + f[0] * 10, me[1] + f[1] * 10, 3.2], 0.8); }
  else if (CV.cam === 'eye') { const fv = G.face[G.holder], f = norm(lerpP(G.camF, fv, 0.35)); V.setCam([me[0] - f[0] * 0.4, me[1] - f[1] * 0.4, 6.2], [me[0] + f[0] * 12, me[1] + f[1] * 12, 4.3], 0.75); }
  else { const by = clamp((cvBallXY()[1] + 5.25) / 2, 9, 21); G.sideY = G.sideY == null ? by : lerp(G.sideY, by, 0.05); V.setCam([-40, G.sideY + 1, 27], [1, G.sideY, 0], V.W < 700 ? 0.62 : 0.78); }
  V.draw(G, CV.cam === 'eye');
  if (G.dragAt && CV.ctrl === 'drag') { const s = V.P([G.dragAt[0], G.dragAt[1], 0.02]); if (s) { const g = V.ctx; g.strokeStyle = 'rgba(80,220,140,.85)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.ellipse(s[0], s[1], 16, 6, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); } }
  if (CV.ptr && CV.ctrl === 'stick') { const g = V.ctx; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(CV.ptr.x0, CV.ptr.y0, 44, 0, Math.PI * 2); g.stroke(); }
}
