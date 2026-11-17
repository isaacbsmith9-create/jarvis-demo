// ===================== chart kit =====================
// Every chart is drawn as SVG at the container's real width (so text stays crisp), from live data, and redrawn on change.
// Tooltips: any element with data-tip="Title|Detail" inside a .chart shows a bubble when tapped or hovered.
let gradN = 0;
const nf = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }));
function niceTicks(lo, hi, n = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}
/** Monotone cubic path (no overshoot between points). */
function smoothPath(P) {
  if (P.length < 2) return '';
  if (P.length === 2) return `M${P[0][0]},${P[0][1]}L${P[1][0]},${P[1][1]}`;
  const n = P.length, dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = P[i + 1][0] - P[i][0] || 1e-6; m[i] = (P[i + 1][1] - P[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${P[i][0] + h},${P[i][1] + t[i] * h} ${P[i + 1][0] - h},${P[i + 1][1] - t[i + 1] * h} ${P[i + 1][0]},${P[i + 1][1]}`;
  }
  return d;
}
const widthOf = (el) => Math.max(260, Math.round(el.clientWidth || el.parentElement?.clientWidth || 320));
function emptyState(title, text, icon = 'chart', action = '') {
  const ic = ICONS[icon] || ICONS.chart;
  return `<div class="empty"><div class="ico">${ic}</div><b>${esc(title)}</b><p>${esc(text)}</p>${action}</div>`;
}

/**
 * Line chart. pts: [{date, v, tip?}] in date order. opts: fmt(v), color, h, goal, bands [[lo,hi,color]], yMin, yMax, lowerBetter, dateAxis.
 */
function drawLine(el, pts, o = {}) {
  if (!el) return;
  const W = widthOf(el), H = o.h || 190, L = 40, R = 14, T = 14, B = 24;
  if (!pts.length) { el.innerHTML = ''; return; }
  const fmt = o.fmt || ((v) => nf(v, 1));
  const color = o.color || 'var(--accent)';
  const t0 = parseIso(pts[0].date).getTime(), t1 = parseIso(pts[pts.length - 1].date).getTime();
  const xs = (d) => (t1 === t0 ? (L + W - R) / 2 : L + ((parseIso(d).getTime() - t0) / (t1 - t0)) * (W - L - R));
  let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  if (o.goal != null) { lo = Math.min(lo, o.goal); hi = Math.max(hi, o.goal); }
  if (o.yMin != null) lo = Math.min(lo, o.yMin);
  if (o.yMax != null) hi = Math.max(hi, o.yMax);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12; lo -= pad; hi += pad;
  if (o.yMin != null) lo = Math.max(lo, o.yMin);
  if (o.yMax != null) hi = Math.min(hi, o.yMax);
  const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const ys = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const P = pts.map((p) => [r1(xs(p.date)), r1(ys(p.v))]);
  const id = 'g' + ++gradN;
  const line = smoothPath(P), base = H - B;
  const area = P.length > 1 ? `${line}L${P[P.length - 1][0]},${base}L${P[0][0]},${base}Z` : '';
  // date labels: up to 5, evenly spaced, no duplicates
  const nL = Math.min(5, pts.length), labs = [];
  for (let i = 0; i < nL; i++) { const k = nL === 1 ? 0 : Math.round((i * (pts.length - 1)) / (nL - 1)); if (!labs.includes(k)) labs.push(k); }
  const bands = (o.bands || []).map(([a, b, c]) => { const y1 = ys(Math.min(b, hi)), y2 = ys(Math.max(a, lo)); return y2 > y1 ? `<rect x="${L}" y="${r1(y1)}" width="${W - L - R}" height="${r1(y2 - y1)}" fill="${c}" opacity=".09"/>` : ''; }).join('');
  const last = P[P.length - 1];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || 'Line chart')}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".38"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
    <filter id="${id}f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    ${bands}
    <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${r1(ys(v))}" y2="${r1(ys(v))}"/>`).join('')}</g>
    <g class="axis">${ticks.map((v) => `<text x="${L - 6}" y="${r1(ys(v)) + 3.5}" text-anchor="end">${esc(o.tick ? o.tick(v) : nf(v, Math.abs(hi - lo) < 5 ? 1 : 0))}</text>`).join('')}
    ${labs.map((k) => `<text x="${P[k][0]}" y="${H - 6}" text-anchor="${k === 0 && labs.length > 1 ? 'start' : k === pts.length - 1 && labs.length > 1 ? 'end' : 'middle'}">${esc(fmtD(pts[k].date))}</text>`).join('')}</g>
    ${o.goal != null ? `<line x1="${L}" x2="${W - R}" y1="${r1(ys(o.goal))}" y2="${r1(ys(o.goal))}" stroke="var(--good)" stroke-dasharray="5 4" stroke-width="1.4"/><text x="${W - R}" y="${r1(ys(o.goal)) - 5}" text-anchor="end" fill="var(--good)" font-size="10.5" font-weight="600">${esc(o.goalLabel || 'Goal')}</text>` : ''}
    ${area ? `<path d="${area}" fill="url(#${id})"/>` : ''}
    ${P.length > 1 ? `<path d="${line}" fill="none" stroke="${color}" stroke-width="5" opacity=".35" filter="url(#${id}f)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>` : ''}
    ${P.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${pts.length > 40 ? 2 : 3.2}" fill="var(--surface)" stroke="${color}" stroke-width="2"/>`).join('')}
    <circle cx="${last[0]}" cy="${last[1]}" r="9" fill="${color}" opacity=".22"/><circle cx="${last[0]}" cy="${last[1]}" r="5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
    ${P.map(([x, y], i) => `<circle class="hit" cx="${x}" cy="${y}" r="13" fill="transparent" data-tip="${esc(pts[i].tip || fmt(pts[i].v))}|${esc(fmtDL(pts[i].date))}"/>`).join('')}
  </svg>`;
}

/** Stacked bars. groups: [{label, segs:[{v,color,name}], tip}] ; opts: h, fmt, goal. Rounded tops on the top segment. */
function drawBars(el, groups, o = {}) {
  if (!el) return;
  const W = widthOf(el), H = o.h || 190, L = 36, R = 8, T = 12, B = 24;
  const tot = groups.map((g) => sum(g.segs.map((s) => s.v)));
  let hi = Math.max(1, ...tot, o.goal || 0);
  const ticks = niceTicks(0, hi, 4); hi = ticks[ticks.length - 1];
  const ys = (v) => T + (1 - v / hi) * (H - T - B);
  const slot = (W - L - R) / groups.length, bw = Math.max(4, Math.min(30, slot * 0.62)), rad = Math.min(6, bw / 2);
  const id = 'b' + ++gradN;
  const fmt = o.fmt || ((v) => nf(v));
  let bars = '';
  groups.forEach((g, i) => {
    const x = L + slot * i + (slot - bw) / 2; let acc = 0;
    const segs = g.segs.filter((s) => s.v > 0);
    segs.forEach((s, j) => {
      const y0 = ys(acc), y1 = ys(acc + s.v); acc += s.v;
      const h = y0 - y1, top = j === segs.length - 1, r = top ? Math.min(rad, h) : 0;
      bars += top
        ? `<path d="M${r1(x)},${r1(y0)}V${r1(y1 + r)}Q${r1(x)},${r1(y1)} ${r1(x + r)},${r1(y1)}H${r1(x + bw - r)}Q${r1(x + bw)},${r1(y1)} ${r1(x + bw)},${r1(y1 + r)}V${r1(y0)}Z" fill="${s.color}"/>`
        : `<rect x="${r1(x)}" y="${r1(y1)}" width="${r1(bw)}" height="${r1(h)}" fill="${s.color}"/>`;
    });
    bars += `<rect class="hit" x="${r1(L + slot * i)}" y="${T}" width="${r1(slot)}" height="${H - T - B}" fill="transparent" data-tip="${esc(g.tip || fmt(tot[i]))}|${esc(g.full || g.label)}"/>`;
  });
  const every = Math.ceil(groups.length / 8);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || 'Bar chart')}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${r1(ys(v))}" y2="${r1(ys(v))}"/>`).join('')}</g>
    <g class="axis">${ticks.map((v) => `<text x="${L - 6}" y="${r1(ys(v)) + 3.5}" text-anchor="end">${esc(o.tick ? o.tick(v) : nf(v))}</text>`).join('')}
    ${groups.map((g, i) => (i % every === 0 || i === groups.length - 1 ? `<text x="${r1(L + slot * i + slot / 2)}" y="${H - 6}" text-anchor="middle">${esc(g.label)}</text>` : '')).join('')}</g>
    ${o.goal ? `<line x1="${L}" x2="${W - R}" y1="${r1(ys(o.goal))}" y2="${r1(ys(o.goal))}" stroke="var(--good)" stroke-dasharray="5 4" stroke-width="1.4"/>` : ''}
    <g>${bars}</g>
  </svg>`;
}

/** Circular progress ring (HTML string). Animates from empty on insert: call animateRings() after adding to the page. */
function ring(v, max, o = {}) {
  const size = o.size || 92, sw = o.stroke || 9, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const frac = max > 0 ? clamp01(v / max) : 0, over = max > 0 && v > max * 1.08 && o.overWarn;
  const color = over ? 'var(--over)' : o.color || 'var(--accent)';
  const id = 'r' + ++gradN;
  return `<div class="ring"><div class="ring-svg" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${o.color2 || color}"/></linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${sw}"/>
      <circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${r1(c)}" stroke-dashoffset="${r1(c)}" data-off="${r1(c * (1 - frac))}" style="filter:drop-shadow(0 0 5px ${color})"/>
    </svg><div class="center">${o.center ?? `<b style="font-size:${size > 120 ? 28 : 17}px">${Math.round(frac * 100)}%</b>`}</div></div>
    ${o.label ? `<div class="lab">${o.label}</div>` : ''}${o.sub ? `<div class="sub">${o.sub}</div>` : ''}</div>`;
}
function animateRings(root = document) {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('circle.fg[data-off]', root).forEach((c) => { c.style.strokeDashoffset = c.dataset.off; })));
}

/** Calendar heatmap: columns are weeks (Mon-Sun), most recent on the right. levelFn(date) -> 0..4 */
function heatmap(weeks, levelFn, sel, tipFn) {
  const end = todayIso(), start = mondayOf(shiftIso(end, -(weeks * 7 - 1)));
  let html = '';
  for (let d = start; daysBetween(d, shiftIso(mondayOf(end), 6)) >= 0; d = shiftIso(d, 1)) {
    const fut = d > end, l = fut ? 0 : levelFn(d);
    html += `<button type="button" data-day="${d}" data-l="${l}" class="${fut ? 'future' : ''}${d === sel ? ' sel' : ''}" ${fut ? 'disabled' : ''} aria-label="${esc(fmtDL(d))}${tipFn ? ': ' + esc(tipFn(d)) : ''}" title="${esc(fmtDL(d))}${tipFn ? ' · ' + esc(tipFn(d)) : ''}"></button>`;
  }
  return `<div class="heat">${html}</div>`;
}

/** Scatter plot with least-squares trend line. ps: [[x,y,date]] */
function drawScatter(el, ps, o = {}) {
  if (!el) return;
  const W = widthOf(el), H = o.h || 220, L = 42, R = 12, T = 12, B = 34;
  let xl = Math.min(...ps.map((p) => p[0])), xh = Math.max(...ps.map((p) => p[0])), yl = Math.min(...ps.map((p) => p[1])), yh = Math.max(...ps.map((p) => p[1]));
  const xt = niceTicks(xl, xh, 4), yt = niceTicks(yl, yh, 4);
  xl = xt[0]; xh = xt[xt.length - 1]; yl = yt[0]; yh = yt[yt.length - 1];
  const xs = (v) => L + ((v - xl) / (xh - xl || 1)) * (W - L - R), ys = (v) => T + (1 - (v - yl) / (yh - yl || 1)) * (H - T - B);
  const fit = o.fit;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || 'Scatter plot')}">
    <g class="grid">${yt.map((v) => `<line x1="${L}" x2="${W - R}" y1="${r1(ys(v))}" y2="${r1(ys(v))}"/>`).join('')}${xt.map((v) => `<line y1="${T}" y2="${H - B}" x1="${r1(xs(v))}" x2="${r1(xs(v))}"/>`).join('')}</g>
    <g class="axis">${yt.map((v) => `<text x="${L - 6}" y="${r1(ys(v)) + 3.5}" text-anchor="end">${nf(v, 1)}</text>`).join('')}${xt.map((v) => `<text x="${r1(xs(v))}" y="${H - B + 14}" text-anchor="middle">${nf(v, 1)}</text>`).join('')}
    <text x="${(L + W - R) / 2}" y="${H - 3}" text-anchor="middle" font-weight="600">${esc(o.xl || '')}</text>
    <text transform="translate(11 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" font-weight="600">${esc(o.yl || '')}</text></g>
    ${fit ? `<line x1="${xs(xl)}" y1="${r1(ys(fit.icpt + fit.slope * xl))}" x2="${xs(xh)}" y2="${r1(ys(fit.icpt + fit.slope * xh))}" stroke="var(--purple)" stroke-width="2.2" stroke-dasharray="6 4" clip-path="inset(0)"/>` : ''}
    ${ps.map(([x, y, d]) => `<circle cx="${r1(xs(x))}" cy="${r1(ys(y))}" r="5.5" fill="var(--accent)" fill-opacity=".75" stroke="var(--surface)" stroke-width="1.5"/><circle class="hit" cx="${r1(xs(x))}" cy="${r1(ys(y))}" r="12" fill="transparent" data-tip="${esc(`${o.xl}: ${nf(x, 1)} · ${o.yl}: ${nf(y, 1)}`)}|${esc(d ? fmtDL(d) : '')}"/>`).join('')}
  </svg>`;
}

/** Tiny sparkline (inline SVG string). */
function spark(vals, color = 'var(--accent)', w = 90, h = 28) {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const P = vals.map((v, i) => [r1((i / (vals.length - 1)) * (w - 4) + 2), r1(h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6))]);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${smoothPath(P)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/><circle cx="${P[P.length - 1][0]}" cy="${P[P.length - 1][1]}" r="2.6" fill="${color}"/></svg>`;
}

/** Shooting % color scale: cold blue -> neutral -> hot. Benchmarks differ by shot distance. */
function heatColor(pct, pts) {
  if (pct == null) return 'var(--surface-2)';
  const mid = pts === 3 ? 0.35 : pts === 1 ? 0.72 : 0.45;
  const t = clamp((pct - mid) / 0.2, -1, 1);
  if (t >= 0) return `color-mix(in srgb, #ff6a3d ${Math.round(25 + t * 70)}%, #8b5cff)`;
  return `color-mix(in srgb, #2563eb ${Math.round(25 + -t * 70)}%, #8b5cff)`;
}
/** Top-down half court (500x380). zones -> {m,a}; tappable zones carry data-zone. */
function courtSvg(agg, o = {}) {
  const z = (id) => ZONES.find((x) => x.id === id);
  const line = 'var(--court-line, rgba(160,180,255,.55))';
  const zoneShape = {
    lc3: 'M0,0H32V140H0Z', rc3: 'M468,0H500V140H468Z',
    lw3: 'M0,140H32C60,220 110,280 170,312L130,380H0Z', rw3: 'M500,140H468C440,220 390,280 330,312L370,380H500Z',
    top3: 'M170,312C220,334 280,334 330,312L370,380H130Z',
    lbm: 'M32,0H180V130H40C36,90 33,45 32,0Z', rbm: 'M468,0H320V130H460C464,90 467,45 468,0Z',
    lay: 'M180,0H320V130H180Z',
    le: 'M40,130H180V250C120,230 70,190 40,130Z', re: 'M460,130H320V250C380,230 430,190 460,130Z',
    ft: 'M180,130H320V250C290,262 210,262 180,250Z',
  };
  const cells = ZONES.map((zz) => {
    const v = agg[zz.id] || { m: 0, a: 0 }, pct = v.a ? v.m / v.a : null, on = o.selected === zz.id;
    return `<path class="zone" data-zone="${zz.id}" d="${zoneShape[zz.id]}" fill="${heatColor(pct, zz.pts)}" fill-opacity="${v.a ? 0.85 : 0.35}" stroke="${on ? '#fff' : 'rgba(10,15,40,.6)'}" stroke-width="${on ? 3 : 1.5}" role="button" tabindex="0" aria-label="${esc(zz.name)}: ${v.a ? `${v.m} of ${v.a}` : 'no shots'}"/>`;
  }).join('');
  const labels = ZONES.map((zz) => {
    const v = agg[zz.id] || { m: 0, a: 0 };
    return `<text x="${zz.x}" y="${zz.y}" text-anchor="middle" fill="#fff" font-size="${v.a ? 17 : 11}" font-weight="700" style="paint-order:stroke;stroke:rgba(0,0,0,.45);stroke-width:3px">${v.a ? Math.round((v.m / v.a) * 100) + '%' : esc(zz.name)}</text>${v.a ? `<text x="${zz.x}" y="${zz.y + 15}" text-anchor="middle" fill="#fff" font-size="11" opacity=".9" style="paint-order:stroke;stroke:rgba(0,0,0,.45);stroke-width:3px">${v.m}/${v.a}</text>` : ''}`;
  }).join('');
  return `<div class="court"><svg viewBox="0 0 500 380" role="group" aria-label="Basketball half court shot chart">
    <rect width="500" height="380" rx="16" fill="#0e1735"/>
    ${cells}
    <g fill="none" stroke="${line}" stroke-width="2.4" pointer-events="none">
      <path d="M32,0V140C60,230 150,330 250,334C350,330 440,230 468,140V0"/>
      <rect x="180" y="0" width="140" height="190"/><circle cx="250" cy="190" r="60"/>
      <path d="M210,40A40,40 0 0 0 290,40"/><line x1="220" y1="38" x2="280" y2="38"/><circle cx="250" cy="52" r="9" stroke="#ff8a4c"/>
      <path d="M190,380A60,60 0 0 1 310,380"/>
    </g>
    ${labels}
  </svg></div>`;
}

// tooltips
function showTip(target) {
  const chart = target.closest('.chart'); if (!chart) return;
  let tip = $('.tip', chart);
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; chart.appendChild(tip); }
  const [a, b] = (target.dataset.tip || '').split('|');
  tip.innerHTML = `${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}`;
  const cr = chart.getBoundingClientRect(), tr = target.getBoundingClientRect();
  let x = tr.left + tr.width / 2 - cr.left;
  tip.style.left = x + 'px'; tip.style.top = tr.top + tr.height / 2 - cr.top + 'px';
  const w = tip.offsetWidth; x = clamp(x, w / 2 + 2, cr.width - w / 2 - 2); tip.style.left = x + 'px';
}
document.addEventListener('pointerover', (e) => { const t = e.target.closest?.('.chart [data-tip]'); if (t && e.pointerType === 'mouse') showTip(t); });
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('.chart [data-tip]');
  if (t) return showTip(t);
  if (!e.target.closest?.('.chart')) $$('.chart .tip').forEach((x) => x.remove());
});
document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target.closest?.('.chart [data-tip]') && !e.relatedTarget?.closest?.('.chart [data-tip]')) e.target.closest('.chart')?.querySelector('.tip')?.remove(); });

/** Delta pill: positive is good unless lowerBetter. */
function deltaPill(pct, lowerBetter = false, suffix = '%') {
  if (pct == null || !Number.isFinite(pct)) return '<span class="delta-pill flat">—</span>';
  const good = lowerBetter ? pct < 0 : pct > 0, z = Math.abs(pct) < 0.5;
  return `<span class="delta-pill ${z ? 'flat' : good ? 'up' : 'down'}">${z ? '→' : pct > 0 ? '▲' : '▼'} ${Math.abs(pct) < 10 ? r1(Math.abs(pct)) : Math.round(Math.abs(pct))}${suffix}</span>`;
}
