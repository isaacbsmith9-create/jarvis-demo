// ===================== court renderer (Canvas 2D) =====================
// Top-down broadcast view, basket at the top. Hardwood, painted lane, arena lighting, detailed players
// (shadow, shoulders, arms, head, jersey number), a ball with real height (its shadow separates from it in the air).
const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#6b4423', '#a86b3c', '#f1c27d', '#5c3a1e', '#b07a4f', '#d39b6a', '#7a4b2a'];
const OFF_KIT = { a: '#2f7bff', b: '#1b4fd1', trim: '#e9f1ff', num: '#ffffff' };
const DEF_KIT = { a: '#3b3f52', b: '#24273a', trim: '#ff4d6d', num: '#ffd0d8' };

class CourtView {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.fx = []; // floating texts / effects
    this.resize();
  }
  resize() {
    const w = Math.max(280, Math.round(this.c.parentElement.clientWidth));
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.s = w / 54; this.W = w; this.H = Math.round(this.s * 50.5); this.dpr = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(this.H * dpr);
    this.c.style.width = w + 'px'; this.c.style.height = this.H + 'px';
    this.drawCourt();
  }
  X(x) { return (x + 27) * this.s; }
  Y(y) { return (y + 2.2) * this.s; }
  toCourt(px, py) { return [px / this.s - 27, py / this.s - 2.2]; }

  drawCourt() {
    const { s, W, H, dpr } = this, bg = this.bg;
    bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
    const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // arena apron
    const ap = g.createLinearGradient(0, 0, 0, H); ap.addColorStop(0, '#0a1230'); ap.addColorStop(1, '#070b1d');
    g.fillStyle = ap; g.fillRect(0, 0, W, H);
    const x0 = this.X(-25), x1 = this.X(25), y0 = this.Y(0), y1 = this.Y(47);
    // hardwood planks (run the length of the court)
    const rand = rng(7);
    const pw = 0.62 * s;
    for (let x = x0, i = 0; x < x1; x += pw, i++) {
      const tone = 0.9 + rand() * 0.16;
      const base = [Math.round(205 * tone), Math.round(146 * tone), Math.round(86 * tone)];
      g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(x, y0, Math.min(pw, x1 - x) + 0.5, y1 - y0);
      // staggered butt joints
      g.fillStyle = 'rgba(70,40,15,.22)';
      for (let y = y0 + rand() * 9 * s; y < y1; y += (6 + rand() * 8) * s) g.fillRect(x, y, pw, 0.6);
      g.fillStyle = 'rgba(60,35,12,.18)'; g.fillRect(x, y0, 0.6, y1 - y0);
    }
    // grain streaks
    g.globalAlpha = 0.07;
    for (let k = 0; k < 220; k++) { g.fillStyle = rand() > 0.5 ? '#5a3311' : '#fff2d6'; g.fillRect(x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), 0.8, (1 + rand() * 4) * s); }
    g.globalAlpha = 1;
    // painted lane and center logo
    const paint = g.createLinearGradient(0, y0, 0, this.Y(19)); paint.addColorStop(0, 'rgba(23,52,140,.92)'); paint.addColorStop(1, 'rgba(36,74,190,.86)');
    g.fillStyle = paint; g.fillRect(this.X(-8), y0, 16 * s, 19 * s);
    g.save(); g.beginPath(); g.arc(this.X(0), this.Y(47), 6 * s, Math.PI, 0); g.closePath(); g.fillStyle = 'rgba(36,74,190,.86)'; g.fill(); g.restore();
    g.save(); g.fillStyle = 'rgba(255,255,255,.92)'; g.font = `700 ${2.6 * s}px "Space Grotesk", Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('IQ', this.X(0), this.Y(45.6)); g.restore();
    // arena light: bright center pool, darker edges
    const lg = g.createRadialGradient(this.X(0), this.Y(20), s * 4, this.X(0), this.Y(22), s * 40);
    lg.addColorStop(0, 'rgba(255,248,230,.18)'); lg.addColorStop(0.6, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(5,8,25,.45)');
    g.fillStyle = lg; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // lines
    g.strokeStyle = 'rgba(255,255,255,.94)'; g.lineWidth = Math.max(1.5, s * 0.17); g.lineCap = 'butt';
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeRect(this.X(-8), y0, 16 * s, 19 * s);
    g.beginPath(); g.moveTo(this.X(-6), y0); g.lineTo(this.X(-6), this.Y(19)); g.moveTo(this.X(6), y0); g.lineTo(this.X(6), this.Y(19)); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1;
    // free-throw circle (dashed inside the lane)
    g.beginPath(); g.arc(this.X(0), this.Y(19), 6 * s, 0, Math.PI); g.stroke();
    g.save(); g.setLineDash([s * 1.1, s * 1.1]); g.beginPath(); g.arc(this.X(0), this.Y(19), 6 * s, Math.PI, Math.PI * 2); g.stroke(); g.restore();
    // three-point line: corners 22 ft, arc 23.75 ft
    const a = Math.atan2(14.2 - 5.25, 22);
    g.beginPath(); g.moveTo(this.X(-22), y0); g.lineTo(this.X(-22), this.Y(14.2)); g.arc(this.X(0), this.Y(5.25), 23.75 * s, Math.PI - a, a, true); g.lineTo(this.X(22), y0); g.stroke();
    // restricted area
    g.beginPath(); g.arc(this.X(0), this.Y(5.25), 4 * s, 0, Math.PI); g.stroke();
    // lane hash marks
    for (const yy of [7, 8, 11, 14]) for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(this.X(sx * 8), this.Y(yy)); g.lineTo(this.X(sx * 8.8), this.Y(yy)); g.stroke(); }
    // half-court line and circle
    g.beginPath(); g.arc(this.X(0), this.Y(47), 6 * s, Math.PI, 0); g.stroke();
    g.beginPath(); g.arc(this.X(0), this.Y(47), 2 * s, Math.PI, 0); g.stroke();
    // baseline stanchion shadow + backboard
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(this.X(-3.2), this.Y(4) - s * 0.2, 6.4 * s, s * 0.9);
    g.fillStyle = '#e9eef8'; g.fillRect(this.X(-3), this.Y(4) - s * 0.25, 6 * s, s * 0.32);
    g.fillStyle = '#9aa6c4'; g.fillRect(this.X(-0.25), this.Y(4), 0.5 * s, s * 0.6);
    // apron branding
    g.fillStyle = 'rgba(158,186,255,.55)'; g.font = `600 ${1.05 * s}px Inter, sans-serif`; g.textAlign = 'center';
    g.fillText('BASKETBALL IQ LAB', this.X(0), this.Y(-0.75));
  }
  drawRim(ctx, swish) {
    const { s } = this, cx = this.X(HOOP.x), cy = this.Y(HOOP.y);
    // net (seen from above): a ring of white strands that sway when the ball goes through
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.9;
    const sw = swish ? Math.sin(swish * Math.PI * 3) * 0.25 * (1 - swish) : 0;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 0.75 * s, cy + Math.sin(a) * 0.75 * s); ctx.lineTo(cx + Math.cos(a + 0.4) * (0.42 + sw) * s, cy + Math.sin(a + 0.4) * (0.42 + sw) * s + s * 0.15); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.15, (0.42 + sw) * s, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(2, s * 0.2); ctx.strokeStyle = '#ff6a1f'; ctx.shadowColor = 'rgba(255,106,31,.6)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(cx, cy, 0.75 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /** Draw one frame. o: {mode, overlays:{lanes, spacing, links}, spotlight, targets, previews, hiddenBall} */
  draw(track, t, o = {}) {
    const ctx = this.ctx, { s, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(this.bg, 0, 0, this.W, this.H);
    const st = stateAt(track, t);
    const swish = st.ball.kind === 'net' ? st.ball.u : 0;
    this.drawRim(ctx, swish);
    if (o.overlays?.spacing) this.drawSpacing(ctx, st);
    if (o.trails) this.drawTrails(ctx, track, t);
    if (o.overlays?.links) this.drawLinks(ctx, st);
    if (o.overlays?.lanes && st.holder) this.drawLanes(ctx, st);
    if (o.previews) for (const p of o.previews) this.drawArrow(ctx, p.from, p.to, p.color, p.dash, p.label);
    // screen marker
    const beat = st.seg.beat || {};
    if (beat.screen && st.pos[beat.screen]) this.drawScreen(ctx, st.pos[beat.screen], st.pos[beat.screenOn] || [0, 30]);
    // players, back to front
    const ids = [...OFF, ...DEF].filter((id) => st.pos[id]).sort((a, b) => st.pos[a][1] - st.pos[b][1]);
    // ball shadow under everything in the air
    this.drawBallShadow(ctx, st.ball);
    for (const id of ids) this.drawPlayer(ctx, id, st.pos[id], facingFor(track, t, id, st), t, st, o);
    if (o.targets) for (const tg of o.targets) this.drawTarget(ctx, st.pos[tg.id] || tg.at, tg, t);
    this.drawBall(ctx, st.ball);
    if (o.spotlight && st.holder) this.drawSpot(ctx, st.pos[st.holder], t);
    if (o.fx) this.fx = o.fx.slice(); this.drawFx(ctx, t);
    // caption chip from the beat
    if (o.captions !== false && beat.cap) this.drawCaption(ctx, beat.cap);
    return st;
  }
  drawCaption(ctx, text) {
    const s = this.s; ctx.save(); ctx.font = `700 ${Math.max(11, s * 1.35)}px Inter, sans-serif`;
    const w = ctx.measureText(text).width + s * 2.4, x = this.W / 2 - w / 2, y = this.Y(41.2);
    ctx.fillStyle = 'rgba(8,12,32,.78)'; roundRect(ctx, x, y, w, s * 2.6, s * 1.3); ctx.fill();
    ctx.strokeStyle = 'rgba(120,160,255,.4)'; ctx.stroke();
    ctx.fillStyle = '#eaf1ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, this.W / 2, y + s * 1.32); ctx.restore();
  }
  drawPlayer(ctx, id, p, f, t, st, o) {
    const s = this.s, x = this.X(p[0]), y = this.Y(p[1]), R0 = [0, 1.1, 1.12, 1.18, 1.24, 1.3][Number(id[1])] * s;
    const off = id[0] === 'O', kit = off ? OFF_KIT : DEF_KIT, n = Number(id[1]);
    const ang = Math.atan2(f[0], -f[1]);
    const hasBall = st.holder === id;
    // shadow
    ctx.save(); ctx.translate(x + R0 * 0.28, y + R0 * 0.38);
    const sh = ctx.createRadialGradient(0, 0, R0 * 0.2, 0, 0, R0 * 1.5); sh.addColorStop(0, 'rgba(0,0,0,.42)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, 0, R0 * 1.55, R0 * 1.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // "you" ring
    if (id === 'O1') { ctx.save(); ctx.strokeStyle = 'rgba(80,220,140,.95)'; ctx.lineWidth = Math.max(2, s * 0.22); ctx.shadowColor = 'rgba(80,220,140,.7)'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.ellipse(x, y, R0 * 1.55, R0 * 1.55, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (o.highlight === id) { ctx.save(); ctx.strokeStyle = 'rgba(255,214,90,.95)'; ctx.lineWidth = Math.max(2, s * 0.22); ctx.beginPath(); ctx.arc(x, y, R0 * 1.9, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const skin = SKIN[(n + (off ? 0 : 5)) % SKIN.length];
    // arms: defenders in a wide stance with active hands; offense natural, ball hand forward when dribbling
    const stride = Math.sin(t * 9 + n) * 0.12;
    const hands = off
      ? hasBall ? [[1.05, -0.55], [-0.95, 0.05 + stride]] : [[0.95, 0.15 + stride], [-0.95, 0.15 - stride]]
      : [[1.35, -0.55 + stride * 0.5], [-1.35, -0.45 - stride * 0.5]];
    ctx.lineCap = 'round';
    for (const [hx, hy] of hands) {
      ctx.strokeStyle = skin; ctx.lineWidth = R0 * 0.32; ctx.beginPath(); ctx.moveTo(Math.sign(hx) * R0 * 0.72, 0); ctx.lineTo(hx * R0, hy * R0); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx * R0, hy * R0, R0 * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    // torso (shoulders) with jersey gradient
    const jg = ctx.createLinearGradient(-R0, -R0, R0, R0); jg.addColorStop(0, kit.a); jg.addColorStop(1, kit.b);
    ctx.fillStyle = jg; ctx.beginPath(); ctx.ellipse(0, R0 * 0.08, R0 * 0.98, R0 * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = kit.trim; ctx.lineWidth = Math.max(1, R0 * 0.1); ctx.stroke();
    // jersey number across the back (readable top-down)
    ctx.save(); ctx.rotate(-ang); ctx.fillStyle = kit.num; ctx.font = `800 ${R0 * 0.62}px "Space Grotesk", Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nb = [Math.sin(ang) * -R0 * 0.38, Math.cos(ang) * R0 * 0.38]; ctx.fillText(String(n), nb[0], nb[1]); ctx.restore();
    // head with hair
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -R0 * 0.05, R0 * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(20,14,10,.92)'; ctx.beginPath(); ctx.arc(0, R0 * 0.02, R0 * 0.38, 0.15 * Math.PI, 0.85 * Math.PI + Math.PI * 0.0, false); ctx.arc(0, -R0 * 0.02, R0 * 0.3, 0.85 * Math.PI, 0.15 * Math.PI, true); ctx.fill();
    if (off) { ctx.fillStyle = kit.trim; ctx.fillRect(-R0 * 0.36, -R0 * 0.28, R0 * 0.72, R0 * 0.08); } // headband
    ctx.restore();
    // label chip
    const lab = off ? (id === 'O1' ? 'YOU' : ROLE[id]) : 'X' + n;
    ctx.save(); ctx.font = `700 ${Math.max(8.5, s * 0.92)}px Inter, sans-serif`; const tw = ctx.measureText(lab).width + s * 1.1;
    ctx.fillStyle = off ? (id === 'O1' ? 'rgba(40,190,110,.92)' : 'rgba(18,40,110,.85)') : 'rgba(60,18,32,.8)';
    roundRect(ctx, x - tw / 2, y + R0 * 1.25, tw, s * 1.45, s * 0.7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, x, y + R0 * 1.25 + s * 0.74); ctx.restore();
  }
  drawBallShadow(ctx, b) {
    if (b.kind === 'dead') return;
    const s = this.s, x = this.X(b.x), y = this.Y(b.y), r = 0.42 * s, k = 1 + b.z * 0.05;
    ctx.save(); ctx.fillStyle = `rgba(0,0,0,${clamp(0.4 - b.z * 0.018, 0.12, 0.4)})`; ctx.beginPath(); ctx.ellipse(x + b.z * s * 0.08, y + b.z * s * 0.1, r * k, r * 0.7 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  drawBall(ctx, b) {
    if (b.kind === 'dead') return;
    const s = this.s, x = this.X(b.x), y = this.Y(b.y) - b.z * s * 0.16, r = 0.46 * s * (1 + b.z * 0.035);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffb067'); g.addColorStop(0.6, '#f0731f'); g.addColorStop(1, '#a8420c');
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,15,5,.75)'; ctx.lineWidth = Math.max(0.7, r * 0.12);
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - r * 1.25, y, r * 0.95, -0.7, 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(x + r * 1.25, y, r * 0.95, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke();
    if (b.kind === 'shot' || b.kind === 'pass') { ctx.globalAlpha = 0.25; ctx.strokeStyle = '#ffb067'; ctx.lineWidth = r * 0.8; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  drawScreen(ctx, p, on) {
    const s = this.s, x = this.X(p[0]), y = this.Y(p[1]);
    const v = norm([on[0] - p[0], on[1] - p[1]]), perp = [-v[1], v[0]];
    ctx.save(); ctx.strokeStyle = 'rgba(255,214,90,.95)'; ctx.lineWidth = Math.max(3, s * 0.42); ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(255,214,90,.7)'; ctx.shadowBlur = 8;
    const c = [x + v[0] * s * 1.7, y + v[1] * s * 1.7];
    ctx.beginPath(); ctx.moveTo(c[0] - perp[0] * s * 1.6, c[1] - perp[1] * s * 1.6); ctx.lineTo(c[0] + perp[0] * s * 1.6, c[1] + perp[1] * s * 1.6); ctx.stroke(); ctx.restore();
  }
  drawSpot(ctx, p, t) {
    const s = this.s, x = this.X(p[0]), y = this.Y(p[1]), pulse = 1 + Math.sin(t * 6) * 0.08;
    ctx.save(); ctx.strokeStyle = 'rgba(61,139,255,.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(x, y, s * 2.6 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  drawTarget(ctx, p, tg, t) {
    if (!p) return;
    const s = this.s, x = this.X(p[0]), y = this.Y(p[1]), pulse = (Math.sin(t * 5 + p[0]) + 1) / 2;
    ctx.save(); ctx.strokeStyle = tg.color || 'rgba(139,92,255,.95)'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.beginPath(); ctx.arc(x, y, s * (2.1 + pulse * 0.5), 0, Math.PI * 2); ctx.stroke();
    if (tg.label) { ctx.globalAlpha = 1; ctx.font = `700 ${Math.max(10, s * 1.05)}px Inter, sans-serif`; const w = ctx.measureText(tg.label).width + s; ctx.fillStyle = 'rgba(80,40,200,.92)'; roundRect(ctx, x - w / 2 - s * 2.9, y - s * 3.2, w, s * 1.55, s * 0.75); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tg.label, x - s * 2.9, y - s * 2.42); }
    ctx.restore();
  }
  drawArrow(ctx, a, b, color = 'rgba(139,92,255,.95)', dash, label) {
    const s = this.s, ax = this.X(a[0]), ay = this.Y(a[1]), bx = this.X(b[0]), by = this.Y(b[1]);
    const ang = Math.atan2(by - ay, bx - ax);
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, s * 0.3); if (dash) ctx.setLineDash([s * 0.9, s * 0.7]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - Math.cos(ang) * s, by - Math.sin(ang) * s); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(ang - 0.45) * s * 1.6, by - Math.sin(ang - 0.45) * s * 1.6); ctx.lineTo(bx - Math.cos(ang + 0.45) * s * 1.6, by - Math.sin(ang + 0.45) * s * 1.6); ctx.closePath(); ctx.fill();
    if (label) { ctx.font = `700 ${Math.max(10, s * 1)}px Inter, sans-serif`; const mx = (ax + bx) / 2, my = (ay + by) / 2, w = ctx.measureText(label).width + s; ctx.fillStyle = 'rgba(10,14,36,.85)'; roundRect(ctx, mx - w / 2, my - s * 0.8, w, s * 1.6, s * 0.8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, mx, my); }
    ctx.restore();
  }
  drawLanes(ctx, st) {
    const fl = readFloor(st.pos, st.holder), hp = st.pos[st.holder], s = this.s;
    for (const [o, m] of Object.entries(fl.mates)) {
      const col = m.open > 0.66 ? '47,214,138' : m.open > 0.38 ? '255,194,61' : '255,90,110';
      const p = st.pos[o];
      ctx.save(); ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = Math.max(1.5, s * 0.2); ctx.setLineDash([s * 0.7, s * 0.5]);
      ctx.beginPath(); ctx.moveTo(this.X(hp[0]), this.Y(hp[1])); ctx.lineTo(this.X(p[0]), this.Y(p[1])); ctx.stroke();
      ctx.setLineDash([]); ctx.font = `700 ${Math.max(9, s * 0.9)}px Inter, sans-serif`;
      const tx = this.X(p[0]), ty = this.Y(p[1]) - s * 2.4, lab = `${m.sep} ft`;
      const w = ctx.measureText(lab).width + s * 0.9; ctx.fillStyle = `rgba(${col},.92)`; roundRect(ctx, tx - w / 2, ty - s * 0.7, w, s * 1.4, s * 0.7); ctx.fill();
      ctx.fillStyle = '#071022'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, tx, ty); ctx.restore();
    }
  }
  drawLinks(ctx, st) {
    const s = this.s;
    ctx.save(); ctx.strokeStyle = 'rgba(255,77,109,.55)'; ctx.lineWidth = 1.4; ctx.setLineDash([2, 4]);
    for (const d of DEF) {
      const p = st.pos[d]; let best = null, bd = 1e9;
      for (const o of OFF) { const k = dist(p, st.pos[o]); if (k < bd) { bd = k; best = o; } }
      const q = st.pos[best]; ctx.beginPath(); ctx.moveTo(this.X(p[0]), this.Y(p[1])); ctx.lineTo(this.X(q[0]), this.Y(q[1])); ctx.stroke();
      // help defenders (far from anyone) glow
      if (bd > 7) { ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,194,61,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.X(p[0]), this.Y(p[1]), s * 2.3, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(255,194,61,.95)'; ctx.font = `700 ${Math.max(9, s * 0.85)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('HELP', this.X(p[0]), this.Y(p[1]) - s * 2.8); ctx.restore(); }
    }
    ctx.restore();
  }
  drawSpacing(ctx, st) {
    const pts = OFF.map((o) => st.pos[o]).filter(Boolean), hull = convexHull(pts);
    if (hull.length < 3) return;
    ctx.save(); ctx.fillStyle = 'rgba(61,139,255,.12)'; ctx.strokeStyle = 'rgba(61,139,255,.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); hull.forEach((p, i) => (i ? ctx.lineTo(this.X(p[0]), this.Y(p[1])) : ctx.moveTo(this.X(p[0]), this.Y(p[1])))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  drawTrails(ctx, track, t) {
    const s = this.s;
    for (const id of [...OFF, ...DEF]) {
      ctx.save(); ctx.strokeStyle = id[0] === 'O' ? 'rgba(120,170,255,.55)' : 'rgba(255,110,130,.45)'; ctx.lineWidth = Math.max(1.2, s * 0.14); ctx.setLineDash([2, 4]);
      ctx.beginPath(); let first = true;
      for (let k = 0; k <= 16; k++) { const tt = t + k * 0.12, p = posAt(track, Math.min(tt, track.t1 ?? track.dur)).pos[id]; if (!p) continue; if (first) { ctx.moveTo(this.X(p[0]), this.Y(p[1])); first = false; } else ctx.lineTo(this.X(p[0]), this.Y(p[1])); }
      ctx.stroke(); ctx.restore();
    }
  }
  addFx(text, at, color, t) { this.fx.push({ text, at, color, t0: t }); }
  drawFx(ctx, t) {
    const s = this.s;
    this.fx = this.fx.filter((f) => t - f.t0 < 1.6 && t >= f.t0 - 0.01);
    for (const f of this.fx) {
      const u = (t - f.t0) / 1.6, x = this.X(f.at[0]), y = this.Y(f.at[1]) - u * s * 5;
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.font = `800 ${s * 2.4}px "Space Grotesk", Inter, sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = f.color; ctx.shadowColor = f.color; ctx.shadowBlur = 14; ctx.fillText(f.text, x, y); ctx.restore();
    }
  }
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function convexHull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
