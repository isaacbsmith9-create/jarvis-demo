// ===================== charts (inline SVG, drawn at the container's real width) =====================
// chart(fn) returns a placeholder; mountCharts() measures each placeholder and renders fn(width).
// Colors come from CSS tokens (--s1..--s4 categorical, --seq-*, --div-*), so both themes work.
const CHARTS = new Map();
let chartN = 0;
function chart(fn, cls = '') { const id = 'ch' + ++chartN; CHARTS.set(id, fn); return `<div class="chart ${cls}" id="${id}"></div>`; }
function mountCharts(root = document) {
  for (const el of $$('.chart', root)) { const fn = CHARTS.get(el.id); if (!fn) continue; const w = Math.max(240, el.clientWidth || 300); if (el.dataset.w == w) continue; el.dataset.w = w; el.innerHTML = fn(w); }
  for (const id of [...CHARTS.keys()]) if (!document.getElementById(id)) CHARTS.delete(id);
}
let _rz; window.addEventListener('resize', () => { clearTimeout(_rz); _rz = setTimeout(() => mountCharts(), 150); });

// ---- tooltip ----
function initTooltip() {
  const tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  const show = (e) => {
    const t = e.target.closest?.('[data-tip]'); if (!t) { tip.classList.remove('on'); return; }
    tip.innerHTML = t.dataset.tip; tip.classList.add('on');
    const x = e.clientX ?? t.getBoundingClientRect().left, y = e.clientY ?? t.getBoundingClientRect().top;
    const r = tip.getBoundingClientRect(), W = window.innerWidth;
    tip.style.left = clamp(x - r.width / 2, 8, W - r.width - 8) + 'px'; tip.style.top = Math.max(8, y - r.height - 14) + 'px';
  };
  document.addEventListener('pointermove', show); document.addEventListener('pointerdown', show);
  document.addEventListener('scroll', () => tip.classList.remove('on'), true);
}

// ---- scales ----
function niceTicks(lo, hi, n = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return out;
}
const tickFmt = (v, step) => (Math.abs(step) >= 1 ? String(Math.round(v)) : step >= 0.1 ? v.toFixed(1) : v.toFixed(2));

/**
 * Line chart over time. o: {series:[{name, color, pts:[{x(ms), y, est, tip}], dashed}], h, yFmt, fits:[{x1,y1,x2,y2,color}],
 * refs:[{y,label}], yDomain:[lo,hi], legend:true}
 */
function lineSVG(w, o) {
  const h = o.h || 220, L = 44, Rp = 14, T = 14, B = 26;
  const pts = o.series.flatMap((s) => s.pts);
  if (!pts.length) return emptyChart(w, h, 'No data in this range');
  let xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  for (const f of o.fits || []) { xs.push(f.x1, f.x2); ys.push(f.y1, f.y2); }
  for (const r of o.refs || []) ys.push(r.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 7 * DAY; x1 += 7 * DAY; }
  const yt = niceTicks(o.yDomain?.[0] ?? Math.min(...ys), o.yDomain?.[1] ?? Math.max(...ys), 4), y0 = yt[0], y1 = yt[yt.length - 1], step = yt[1] - yt[0];
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (w - L - Rp), Y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (h - T - B);
  const yF = o.yFmt || ((v) => tickFmt(v, step));
  let g = '';
  for (const v of yt) g += `<line x1="${L}" x2="${w - Rp}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end" class="tick">${yF(v)}</text>`;
  const nx = Math.max(2, Math.min(6, Math.floor((w - L) / 90)));
  for (let i = 0; i < nx; i++) { const v = x0 + ((x1 - x0) * i) / (nx - 1); g += `<text x="${X(v)}" y="${h - 8}" text-anchor="${i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle'}" class="tick">${new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>`; }
  for (const r of o.refs || []) g += `<line x1="${L}" x2="${w - Rp}" y1="${Y(r.y)}" y2="${Y(r.y)}" class="ref"/><text x="${w - Rp}" y="${Y(r.y) - 4}" text-anchor="end" class="tick ref-t">${esc(r.label)}</text>`;
  for (const f of o.fits || []) g += `<line x1="${X(f.x1)}" y1="${Y(f.y1)}" x2="${X(f.x2)}" y2="${Y(f.y2)}" style="stroke:${f.color || 'var(--ink-3)'}" class="fit"/>`;
  for (const s of o.series) {
    const P = [...s.pts].sort((a, b) => a.x - b.x);
    if (P.length > 1) g += `<path d="${P.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ')}" class="ln ${s.dashed ? 'dash' : ''}" style="stroke:${s.color}"/>`;
    const r = P.length > 40 ? 2.5 : 4;
    for (const p of P) g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${r}" class="${p.est ? 'pt est' : 'pt'}" style="${p.est ? 'stroke' : 'fill'}:${s.color}"/><circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="11" class="hit" data-tip="${esc(p.tip || '')}"/>`;
  }
  const legend = o.series.length > 1 ? legendHTML(o.series) : '';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label || 'Line chart')}">${g}</svg>${legend}`;
}
const legendHTML = (series) => `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}${s.dashed ? ';opacity:.6' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>`;
const emptyChart = (w, h, txt) => `<div class="chart-empty" style="height:${Math.min(h, 160)}px">${esc(txt)}</div>`;

/** Radar: axes [{label}], series [{name, color, values (0–100 or null)}]. Null axes are drawn as "no data" gaps. */
function radarSVG(w, o) {
  const size = Math.min(w, o.max || 380), h = size * 0.86, cx = w / 2, cy = h / 2 + 4, R = size * 0.32, n = o.axes.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n, P = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 100), cy + Math.sin(ang(i)) * R * (v / 100)];
  let g = '';
  for (const lv of [25, 50, 75, 100]) g += `<polygon points="${o.axes.map((_, i) => P(i, lv).join(',')).join(' ')}" class="grid rgrid"/>`;
  o.axes.forEach((a, i) => {
    const [x, y] = P(i, 100), [lx, ly] = P(i, 122), none = o.series.every((s) => s.values[i] == null);
    g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="grid"/><text x="${lx}" y="${ly + 4}" text-anchor="${Math.abs(lx - cx) < 8 ? 'middle' : lx < cx ? 'end' : 'start'}" class="tick ${none ? 'nodata' : ''}">${esc(a.label)}${none ? ' · no data' : ''}</text>`;
  });
  for (const s of o.series) {
    const vals = s.values.map((v) => v ?? 0);
    g += `<polygon points="${vals.map((v, i) => P(i, v).join(',')).join(' ')}" class="rpoly ${s.dashed ? 'dash' : ''}" style="stroke:${s.color};fill:${s.color}"/>`;
    s.values.forEach((v, i) => { if (v == null) return; const [x, y] = P(i, v); g += `<circle cx="${x}" cy="${y}" r="4" class="pt" style="fill:${s.color}"/><circle cx="${x}" cy="${y}" r="11" class="hit" data-tip="<b>${esc(o.axes[i].label)}</b><br>${esc(s.name)}: ${v}"/>`; });
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label || 'Radar chart')}">${g}</svg>${o.series.length > 1 ? legendHTML(o.series) : ''}`;
}

/** Scatter with optional least-squares line. o: {pts:[{x,y,tip}], xLabel, yLabel, xFmt, yFmt, fit} */
function scatterSVG(w, o) {
  const h = o.h || 260, L = 48, Rp = 14, T = 12, B = 38;
  if (o.pts.length < 2) return emptyChart(w, h, 'Need at least 2 paired results');
  const xt = niceTicks(Math.min(...o.pts.map((p) => p.x)), Math.max(...o.pts.map((p) => p.x)), 4), yt = niceTicks(Math.min(...o.pts.map((p) => p.y)), Math.max(...o.pts.map((p) => p.y)), 4);
  const X = (v) => L + ((v - xt[0]) / (xt[xt.length - 1] - xt[0])) * (w - L - Rp), Y = (v) => T + (1 - (v - yt[0]) / (yt[yt.length - 1] - yt[0])) * (h - T - B);
  let g = '';
  for (const v of yt) g += `<line x1="${L}" x2="${w - Rp}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end" class="tick">${(o.yFmt || ((x) => tickFmt(x, yt[1] - yt[0])))(v)}</text>`;
  for (const v of xt) g += `<text x="${X(v)}" y="${h - 22}" text-anchor="middle" class="tick">${(o.xFmt || ((x) => tickFmt(x, xt[1] - xt[0])))(v)}</text>`;
  g += `<text x="${(L + w - Rp) / 2}" y="${h - 4}" text-anchor="middle" class="tick axl">${esc(o.xLabel)}</text><text x="12" y="${T + (h - T - B) / 2}" text-anchor="middle" class="tick axl" transform="rotate(-90 12 ${T + (h - T - B) / 2})">${esc(o.yLabel)}</text>`;
  if (o.fit) { const a = xt[0], b = xt[xt.length - 1]; g += `<line x1="${X(a)}" y1="${Y(o.fit.intercept + o.fit.slope * a)}" x2="${X(b)}" y2="${Y(o.fit.intercept + o.fit.slope * b)}" class="fit" style="stroke:var(--ink-3)"/>`; }
  for (const p of o.pts) g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" class="pt ring" style="fill:var(--s1)"/><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="11" class="hit" data-tip="${esc(p.tip || '')}"/>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Scatter plot">${g}</svg>`;
}

/** Histogram of values. o: {values, fmt, bins, color, mark (value to highlight)} */
function histSVG(w, o) {
  const h = o.h || 170, L = 30, Rp = 10, T = 10, B = 26, v = o.values;
  if (v.length < 3) return emptyChart(w, h, 'Need 3+ results for a distribution');
  const lo = Math.min(...v), hi = Math.max(...v), nb = o.bins || Math.min(10, Math.max(4, Math.round(Math.sqrt(v.length)))), bw = (hi - lo || 1) / nb;
  const counts = Array(nb).fill(0); for (const x of v) counts[Math.min(nb - 1, Math.floor((x - lo) / bw))]++;
  const cmax = Math.max(...counts), cw = (w - L - Rp) / nb, Y = (c) => T + (1 - c / cmax) * (h - T - B);
  let g = `<line x1="${L}" x2="${w - Rp}" y1="${Y(0)}" y2="${Y(0)}" class="axis"/>`;
  for (const c of niceTicks(0, cmax, 3).filter((c) => c <= cmax && c > 0)) g += `<line x1="${L}" x2="${w - Rp}" y1="${Y(c)}" y2="${Y(c)}" class="grid"/><text x="${L - 5}" y="${Y(c) + 3.5}" text-anchor="end" class="tick">${c}</text>`;
  counts.forEach((c, i) => {
    const a = lo + i * bw, b = a + bw, x = L + i * cw + 1;
    if (c) g += `<path d="${barPath(x, Y(c), cw - 2, Y(0) - Y(c))}" style="fill:${o.color || 'var(--s1)'}" data-tip="${esc((o.fmt || fmt)(a))} – ${esc((o.fmt || fmt)(b))}: ${c} result${c > 1 ? 's' : ''}"/>`;
  });
  for (const i of [0, nb]) g += `<text x="${L + i * cw}" y="${h - 8}" text-anchor="${i ? 'end' : 'start'}" class="tick">${(o.fmt || fmt)(lo + i * bw)}</text>`;
  if (o.mark != null) { const x = L + ((o.mark - lo) / (hi - lo || 1)) * (w - L - Rp); g += `<line x1="${x}" x2="${x}" y1="${T}" y2="${Y(0)}" class="ref"/><text x="${x}" y="${T + 9}" text-anchor="${x > w / 2 ? 'end' : 'start'}" dx="${x > w / 2 ? -4 : 4}" class="tick ref-t">latest</text>`; }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Distribution">${g}</svg>`;
}
/** Bar with a 4px rounded data end, square at the baseline. */
function barPath(x, y, bw, bh) { const r = Math.min(4, bw / 2, bh); return `M${x} ${y + bh}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${y + bh}Z`; }

/** Calendar heatmap: counts {iso: n}, last `weeks` weeks, sequential single hue. */
function calendarSVG(w, o) {
  const weeks = o.weeks || 26, cell = Math.max(8, Math.min(16, Math.floor((w - 30) / weeks) - 2)), gap = 2, h = 7 * (cell + gap) + 22;
  const end = new Date(dms(isoDate())), start = new Date(end.getTime() - (weeks * 7 - 1 + end.getDay()) * DAY);
  const max = Math.max(1, ...Object.values(o.counts));
  const lvl = (n) => (n ? Math.min(4, Math.ceil((n / max) * 4)) : 0);
  let g = '';
  for (let i = 0; i < weeks * 7 + end.getDay() + 1; i++) {
    const d = new Date(start.getTime() + i * DAY), iso = isoDate(d), c = Math.floor(i / 7), r = d.getDay(), n = o.counts[iso] || 0;
    g += `<rect x="${26 + c * (cell + gap)}" y="${r * (cell + gap)}" width="${cell}" height="${cell}" rx="2" class="cal l${lvl(n)}" data-tip="${fmtDate(iso)}: ${n} ${esc(o.unit || 'entries')}"/>`;
    if (r === 0 && d.getDate() <= 7) g += `<text x="${26 + c * (cell + gap)}" y="${7 * (cell + gap) + 12}" class="tick">${d.toLocaleDateString(undefined, { month: 'short' })}</text>`;
  }
  for (const [r, t] of [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']]) g += `<text x="0" y="${r * (cell + gap) + cell - 2}" class="tick">${t}</text>`;
  const W = 26 + Math.ceil((weeks * 7 + end.getDay() + 1) / 7) * (cell + gap);
  return `<div class="cal-wrap"><svg width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="Activity calendar">${g}</svg></div><div class="legend seq">Less ${[0, 1, 2, 3, 4].map((l) => `<i class="cal-k l${l}"></i>`).join('')} More</div>`;
}

/** Horizontal bars as HTML (crisp at any width). items: [{label, value 0–100 or null, display, ghost, tip, color, sub}] */
function barsHTML(items, o = {}) {
  if (!items.length) return `<div class="chart-empty" style="height:80px">${esc(o.empty || 'No data')}</div>`;
  return `<div class="hbars">${items.map((it) => `<div class="hbar" ${it.tip ? `data-tip="${esc(it.tip)}"` : ''}>
    <span class="hb-l">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
    <span class="hb-t">${it.value == null ? '<span class="hb-none">no data</span>' : `<i class="hb-f" style="width:${clamp(it.value, 0, 100)}%;background:${it.color || 'var(--s1)'}"></i>${it.ghost != null ? `<i class="hb-g" style="left:${clamp(it.ghost, 0, 100)}%"></i>` : ''}`}</span>
    <span class="hb-v">${it.display ?? (it.value == null ? '' : Math.round(it.value))}</span></div>`).join('')}</div>`;
}
/** Tiny trend line. */
function spark(vals, dir) {
  if (vals.length < 2) return '';
  const w = 84, h = 24, lo = Math.min(...vals), hi = Math.max(...vals), X = (i) => 2 + (i / (vals.length - 1)) * (w - 4), Y = (v) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6);
  const better = dir === 'lower' ? vals[vals.length - 1] <= vals[0] : vals[vals.length - 1] >= vals[0];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ')}" style="stroke:${better ? 'var(--good)' : 'var(--ink-3)'}"/><circle cx="${X(vals.length - 1)}" cy="${Y(vals[vals.length - 1])}" r="2.5" style="fill:${better ? 'var(--good)' : 'var(--ink-3)'}"/></svg>`;
}
/** Score → sequential color step (one hue, light→dark). */
const scoreColor = (s) => (s == null ? 'var(--ink-4)' : s >= 80 ? 'var(--seq-5)' : s >= 60 ? 'var(--seq-4)' : s >= 40 ? 'var(--seq-3)' : s >= 20 ? 'var(--seq-2)' : 'var(--seq-1)');
