/* SVG chart helpers. Every function takes real values and returns markup. Empty input returns '' so callers show an empty state instead. */
function niceMax(v) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/* points: [{x: label, y: number|null, title?}] */
function lineChart(points, opts) {
  opts = opts || {};
  const W = 640, H = opts.h || 220, L = 40, R = 14, T = 14, B = 30;
  const vals = points.filter(function (p) { return p.y != null; });
  if (vals.length < 2) return '';
  const max = niceMax(Math.max.apply(null, vals.map(function (p) { return p.y; })) * 1.05);
  const min = opts.min != null ? opts.min : 0;
  const n = points.length;
  const x = function (i) { return L + (n === 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R)); };
  const y = function (v) { return T + (H - T - B) - ((v - min) / (max - min || 1)) * (H - T - B); };
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const v = min + ((max - min) * g) / 4;
    grid += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
    grid += '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (opts.fmt ? opts.fmt(v) : Math.round(v)) + '</text>';
  }
  let path = '', started = false, dots = '', labels = '';
  points.forEach(function (p, i) {
    if (p.y == null) { started = false; return; }
    path += (started ? ' L ' : ' M ') + x(i) + ' ' + y(p.y);
    started = true;
  });
  points.forEach(function (p, i) {
    if (p.y != null) dots += '<circle class="pt" cx="' + x(i) + '" cy="' + y(p.y) + '" r="4"><title>' + esc(p.title || (p.x + ': ' + p.y)) + '</title></circle>';
    if (points.length <= 8 || i % Math.ceil(points.length / 8) === 0 || i === n - 1) labels += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(p.x) + '</text>';
  });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Line chart') + '">' + grid + '<path d="' + path + '" fill="none" stroke="' + (opts.color || 'var(--brand)') + '" stroke-width="2.5" stroke-linejoin="round"/>' + dots + labels + '</svg>';
}

/* bars: [{k: label, v: number, parts?: [{v, c}], title?}] Stacked when parts is given. */
function barChart(bars, opts) {
  opts = opts || {};
  if (!bars.length || bars.every(function (b) { return !b.v && !(b.parts && b.parts.length); })) return '';
  const max = niceMax(Math.max.apply(null, bars.map(function (b) { return b.v || 0; })) * 1.1);
  return '<div class="cols" role="img" aria-label="' + esc(opts.label || 'Bar chart') + '">' + bars.map(function (b, i) {
    const h = max ? Math.round(((b.v || 0) / max) * 100) : 0;
    const stack = b.parts ? b.parts.map(function (p) { return '<i style="height:' + (max ? ((p.v / max) * 100) : 0) + '%;background:' + p.c + '" title="' + esc(p.t || '') + '"></i>'; }).join('') : '<i style="height:' + h + '%;background:' + (b.c || 'linear-gradient(180deg,var(--brand),var(--brand2))') + '" title="' + esc(b.title || '') + '"></i>';
    return '<div class="col' + (b.now ? ' now' : '') + '" title="' + esc(b.title || '') + '"><span class="v">' + esc(b.label != null ? b.label : (b.v || 0)) + '</span><div class="stackbar" style="height:' + (h || 2) + '%">' + stack + '</div><span class="k">' + esc(b.k) + '</span></div>';
  }).join('') + '</div>';
}

function ringChart(p, label) {
  const r = 38, c = 2 * Math.PI * r;
  const v = p == null ? 0 : clamp(p, 0, 100);
  return '<svg class="ring" viewBox="0 0 96 96" role="img" aria-label="' + esc(label || 'Progress') + ' ' + (p == null ? 'not recorded' : v + '%') + '">' +
    '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="var(--raised)" stroke-width="9"/>' +
    (p == null ? '' : '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (c * v / 100) + ' ' + c + '" transform="rotate(-90 48 48)"/>') +
    '<text x="48" y="56" text-anchor="middle" font-size="22">' + (p == null ? '–' : v + '%') + '</text></svg>';
}

/* Half-court with zones. zoneStats: {Rim: {att, made}, ...}. Zones are approximate, not measured positions. */
function courtSVG(zoneStats, opts) {
  opts = opts || {};
  const sel = opts.selected || null;
  const layout = [
    { z: 'Rim', d: 'M205 150 L295 150 L295 200 L205 200 Z', tx: 250, ty: 180 },
    { z: 'Paint', d: 'M160 200 L340 200 L340 330 L160 330 Z', tx: 250, ty: 270 },
    { z: 'Floater', d: 'M130 200 L370 200 L370 260 L130 260 Z', tx: 250, ty: 232, skip: true },
    { z: 'Free throw', d: 'M220 330 L280 330 L280 350 L220 350 Z', tx: 250, ty: 341, skip: true },
    { z: 'Midrange', d: 'M100 330 L400 330 L400 400 L335 470 L165 470 L100 400 Z', tx: 250, ty: 400 },
    { z: 'Corner 3', d: 'M0 300 L100 330 L100 400 L0 420 Z', tx: 50, ty: 360 },
    { z: 'Corner 3', d: 'M500 300 L400 330 L400 400 L500 420 Z', tx: 450, ty: 360, twin: true },
    { z: 'Wing 3', d: 'M0 420 L100 400 L165 470 L110 580 L0 580 Z', tx: 60, ty: 500 },
    { z: 'Wing 3', d: 'M500 420 L400 400 L335 470 L390 580 L500 580 Z', tx: 440, ty: 500, twin: true },
    { z: 'Top 3', d: 'M165 470 L335 470 L390 580 L110 580 Z', tx: 250, ty: 540 },
    { z: 'Deep 3', d: 'M0 0 L500 0 L500 300 L400 300 L400 330 L100 330 L100 300 L0 300 Z', tx: 250, ty: 80, skip: true }
  ];
  const sum = function (z) { const s = zoneStats[z] || { att: 0, made: 0 }; return s; };
  let shapes = '';
  layout.forEach(function (l) {
    if (l.skip) return;
    const s = sum(l.z);
    const p = s.att ? Math.round((s.made / s.att) * 100) : null;
    const tone = p == null ? 'var(--panel2)' : p >= 45 ? '#2f6e55' : p >= 30 ? '#4a4430' : '#5a2d3d';
    shapes += '<path class="zone' + (sel === l.z ? ' sel' : '') + '" d="' + l.d + '" fill="' + tone + '" data-zone="' + esc(l.z) + '" tabindex="0" role="button" aria-label="' + esc(l.z) + ' ' + (p == null ? 'no shots' : p + '% made') + '"><title>' + esc(l.z) + ': ' + (s.att ? s.made + ' of ' + s.att + ' (' + p + '%)' : 'no shots logged') + '</title></path>';
    if (!l.twin) shapes += '<text class="lbl2" x="' + l.tx + '" y="' + (l.ty + (l.z === 'Top 3' || l.z === 'Midrange' ? 0 : 0)) + '" text-anchor="middle" pointer-events="none">' + (p == null ? '–' : p + '%') + '</text>';
    else shapes += '<text class="lbl2" x="' + l.tx + '" y="' + l.ty + '" text-anchor="middle" pointer-events="none">' + (p == null ? '–' : p + '%') + '</text>';
  });
  const lines = '<g class="lines"><path d="M0 0 H500 V580 H0 Z"/><circle cx="250" cy="95" r="0"/><path d="M220 66 H280 V84 H220 Z"/><path d="M190 90 Q250 150 310 90"/><circle cx="250" cy="80" r="11"/></g>';
  return '<svg class="court" viewBox="0 0 500 590" role="group" aria-label="Court zones, approximate">' + shapes + lines + '</svg>';
}

function heatCells(days) {
  return '<div class="heat" role="img" aria-label="Training days over the last 14 days">' + days.map(function (d) {
    const lvl = d.minutes <= 0 ? '' : d.minutes < 20 ? 'l1' : d.minutes < 45 ? 'l2' : d.minutes < 75 ? 'l3' : 'l4';
    return '<i class="' + lvl + '" title="' + esc(fmtDay(d.day)) + ': ' + fmtMin(d.minutes) + '"></i>';
  }).join('') + '</div>';
}
