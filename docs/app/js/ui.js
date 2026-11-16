// Shared components: icons, rings, sheets, toast, charts, and one click dispatcher for data-act buttons.
import { $, $$, esc, clamp, shortDate, dayLabel, haptic } from './util.js';

// ---------- icons (24px, stroke) ----------
const P = {
  today: '<path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0"/><path d="M12 7v5l3 2"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1.5-3 4-3 7 0 2 1 3 3 3"/>',
  train: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  plan: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  water: '<path d="M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  task: '<path d="M9 11.5l2.5 2.5L16 9.5"/><rect x="4" y="4" width="16" height="16" rx="4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  barcode: '<path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M16.5 6v12M20 6v12"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M10 2.5h4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  week: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 10h2M14 10h2M8 14h2M14 14h2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  sleep: '<path d="M3 18h18M5 18v-6a2 2 0 0 1 2-2h10a4 4 0 0 1 4 4v4M7 10V7"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4.5 4.5 0 0 1 6 0L12.5 12"/>',
  spanish: '<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 3-3 7-6 9M13 21l4-9 4 9M14.5 18h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5"/>',
  star: '<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  flame: '<path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4-3.5-6-3.5-10-2 1-5 3.8-5 7.3-1-.6-1.5-1.8-1.5-3C6.5 10.5 5.5 12.6 5.5 14.5A6.5 6.5 0 0 0 12 21z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  chart: '<path d="M4 19h16M7 16V11M12 16V6M17 16v-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
};
export const icon = (name, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
export const chev = '<svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m1.5 1.5 5 5-5 5"/></svg>';
export const checkSvg = icon('check', 3.2);

// ---------- rings ----------
/** One progress ring. pct can exceed 1 (overflow drawn in --over). */
export function ring({ pct = 0, size = 120, stroke = 12, color = 'var(--accent)', center = '', label = '', track = true }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, p = clamp(pct, 0, 1), over = clamp(pct - 1, 0, 1);
  return `<div class="ring" style="width:${size}px;max-width:100%" role="img" aria-label="${esc(label)}">
    <svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" class="track" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" class="prog" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - p)).toFixed(2)}"${p > 0 ? '' : ' opacity="0"'}/>
    ${over > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--over)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - over)).toFixed(2)}"/>` : ''}</svg>
    <div class="center">${center}</div></div>`;
}
/** Concentric activity-style rings: [{pct, color}] outside in. */
export function rings(list, { size = 148, stroke = 14, gap = 3, center = '', label = '' } = {}) {
  let s = '';
  list.forEach((x, i) => {
    const r = size / 2 - stroke / 2 - i * (stroke + gap), C = 2 * Math.PI * r, p = clamp(x.pct, 0, 1);
    s += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${x.color}" stroke-opacity=".16" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" class="prog" stroke="${x.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - p)).toFixed(2)}"${p > 0 ? '' : ' opacity="0"'}/>`;
  });
  return `<div class="ring" style="width:${size}px;max-width:100%" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 ${size} ${size}">${s}</svg><div class="center">${center}</div></div>`;
}
/** Donut with segments [{v, color, name}]. */
export function donut(parts, { size = 120, stroke = 18, center = '', label = '' } = {}) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.v), 0), r = (size - stroke) / 2, C = 2 * Math.PI * r;
  let off = 0, s = '';
  if (total > 0) for (const p of parts) { if (p.v <= 0) continue; const len = (p.v / total) * C, g = parts.filter((x) => x.v > 0).length > 1 ? Math.min(2, len / 3) : 0;
    s += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${stroke}" stroke-dasharray="${Math.max(0, len - g).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; }
  return `<div class="ring" style="width:${size}px;max-width:100%" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" class="track" stroke-width="${stroke}"/>${s}</svg><div class="center">${center}</div></div>`;
}
export const bar = (pct, color = 'var(--accent)', over = false) => `<div class="bar${over ? ' over' : ''}"><div style="width:${(clamp(pct) * 100).toFixed(1)}%;--c:${color}"></div></div>`;

// ---------- toast ----------
let toastT, undoFn = null;
export function toast(msg, onUndo = null) {
  const t = $('#toast'); undoFn = onUndo;
  t.innerHTML = `<span>${esc(msg)}</span>${onUndo ? '<button type="button" data-undo>Undo</button>' : ''}`;
  t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), onUndo ? 5000 : 2400);
}
document.addEventListener('click', (e) => { if (e.target.closest('#toast [data-undo]')) { $('#toast').classList.remove('show'); const f = undoFn; undoFn = null; f?.(); } });

// ---------- sheets (native <dialog>, stackable) ----------
/** opts: {title, body (html|fn), left: {label, act}, right: {label, act, bold}, foot, onMount(el), onClose} */
export function sheet(opts) {
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.setAttribute('aria-label', opts.title || 'Sheet');
  const left = opts.left ?? { label: 'Cancel', close: true };
  d.innerHTML = `<div class="sheet-grab"></div><div class="sheet-head"><div class="l">${left ? `<button type="button" class="btn ghost" ${left.close ? 'data-close' : `data-act="${left.act}"`}>${esc(left.label)}</button>` : ''}</div><h2>${esc(opts.title || '')}</h2>
    <div class="r">${opts.right ? `<button type="button" class="btn ghost${opts.right.bold !== false ? ' b' : ''}" data-act="${opts.right.act}" ${opts.right.id ? `id="${opts.right.id}"` : ''}>${esc(opts.right.label)}</button>` : ''}</div></div>
    <div class="sheet-body"></div>${opts.foot ? `<div class="sheet-foot">${opts.foot}</div>` : ''}`;
  document.body.append(d);
  const api = {
    el: d, body: $('.sheet-body', d), data: opts.data || {},
    set(html) { this.body.innerHTML = html; },
    close() { if (!d.open) return; d.classList.add('closing'); setTimeout(() => { d.close(); }, 180); },
  };
  d._sheet = api;
  const fill = () => { if (typeof opts.body === 'function') api.body.innerHTML = opts.body(api); else api.body.innerHTML = opts.body || ''; };
  api.refresh = fill;
  fill();
  d.addEventListener('close', () => { opts.onClose?.(api); d.remove(); });
  d.addEventListener('click', (e) => { if (e.target === d) api.close(); if (e.target.closest('[data-close]')) api.close(); });
  d.addEventListener('cancel', (e) => { e.preventDefault(); api.close(); });
  // swipe down on the grab bar / header to dismiss
  let y0 = null;
  d.addEventListener('touchstart', (e) => { if (e.target.closest('.sheet-grab, .sheet-head h2')) y0 = e.touches[0].clientY; }, { passive: true });
  d.addEventListener('touchmove', (e) => { if (y0 == null) return; const dy = Math.max(0, e.touches[0].clientY - y0); d.style.transform = `translateY(${dy}px)`; }, { passive: true });
  d.addEventListener('touchend', (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; d.style.transform = ''; if (dy > 90) api.close(); });
  d.showModal();
  opts.onMount?.(api);
  return api;
}
export const sheetOf = (el) => el.closest('dialog.sheet')?._sheet;
export function closeAllSheets() { $$('dialog.sheet').forEach((d) => d._sheet?.close()); }

/** Two-tap confirm for destructive buttons. */
export function confirmTap(btn, label = 'Tap again to delete') {
  if (btn.dataset.confirm === '1') return true;
  btn.dataset.confirm = '1'; const old = btn.innerHTML; btn.textContent = label; haptic(15);
  setTimeout(() => { if (btn.isConnected && btn.dataset.confirm === '1') { btn.dataset.confirm = ''; btn.innerHTML = old; } }, 3000);
  return false;
}

// ---------- action dispatcher ----------
const actions = {};
export const on = (map) => { for (const k in map) { if (actions[k]) console.error('Duplicate action name: ' + k); actions[k] = map[k]; } };
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = actions[el.dataset.act]; if (!f) return;
  e.preventDefault(); f(el, e);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el) actions[el.dataset.change]?.(el, e); });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el) actions[el.dataset.input]?.(el, e); });
document.addEventListener('submit', (e) => { const el = e.target.closest('[data-submit]'); if (el) { e.preventDefault(); actions[el.dataset.submit]?.(el, e); } });

// ---------- charts (sized to the card, redrawn on resize) ----------
const charts = new Map();
let tipEl;
function tip(e, html) {
  tipEl ??= Object.assign(document.body.appendChild(document.createElement('div')), { id: 'tip' });
  tipEl.innerHTML = html; tipEl.hidden = false;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight; let x = e.clientX + 12, y = e.clientY - h - 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 12; if (x < 8) x = 8; if (y < 8) y = e.clientY + 18;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
export const hideTip = () => { if (tipEl) tipEl.hidden = true; };
addEventListener('scroll', hideTip, { passive: true });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => charts.forEach((draw, el) => (el.isConnected ? draw() : charts.delete(el))), 150); });
const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
const frame = (el, H) => { const W = Math.max(240, el.clientWidth || 320), L = 34, R = 6, T = 8, B = 20; return { W, H, L, R, T, B, iw: W - L - R, ih: H - T - B }; };
const xLabel = (days, i) => (days.length > 8 ? (days.length > 16 ? ((days.length - 1 - i) % 5 === 0) : ((days.length - 1 - i) % 2 === 0)) ? String(Number(days[i].slice(8))) : '' : dayLabel(days[i], { weekday: 'narrow' }));
const kfmt = (v) => (v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : Math.round(v));
const rounded = (x, y, w, h, r = 4) => { if (h <= 0) return ''; r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
function hover(el, f, days, html) {
  const svg = el.querySelector('svg'), hl = svg.querySelector('.hl');
  const at = (e) => { const r = svg.getBoundingClientRect(), i = Math.floor(((e.clientX - r.left - f.L) / f.iw) * days.length); return i >= 0 && i < days.length ? i : -1; };
  const show = (e) => { const i = at(e); if (i < 0) { hideTip(); hl.setAttribute('opacity', 0); return; } const bw = f.iw / days.length; hl.setAttribute('x', f.L + bw * i); hl.setAttribute('width', bw); hl.setAttribute('opacity', 1); tip(e, html(i)); };
  svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => { hideTip(); hl.setAttribute('opacity', 0); });
}
const tipRow = (c, n, v) => `<div class="tr"><span>${c ? `<span class="dot" style="--c:${c};margin-right:5px"></span>` : ''}${esc(n)}</span><span>${v}</span></div>`;
/** Bars per day with optional dashed target. */
export function barChart(el, days, values, { color = 'var(--accent)', target = null, unit = '', fmt = (v) => Math.round(v).toLocaleString(), name = '', targetName = 'Goal', H = 160, colors = null } = {}) {
  const draw = () => {
    const f = frame(el, H), tv = Array.isArray(target) ? target : days.map(() => target), hasT = tv.some((v) => v);
    const max = niceMax(Math.max(1, ...values.map((v) => v || 0), ...tv.map((v) => v || 0)) * 1.05), bw = f.iw / days.length, w = Math.max(3, Math.min(26, bw * 0.6));
    let s = `<svg height="${f.H}" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="${esc(name)} per day"><rect class="hl" x="0" y="${f.T}" width="0" height="${f.ih}" fill="var(--surface-2)" opacity="0" rx="4"/>`;
    for (let i = 0; i <= 4; i++) { const v = (max / 4) * i, y = f.T + f.ih - (v / max) * f.ih; s += `<line x1="${f.L}" x2="${f.W - f.R}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${f.L - 6}" y="${y + 4}" text-anchor="end">${kfmt(v)}</text>`; }
    days.forEach((d, i) => { const lb = xLabel(days, i); if (lb) s += `<text x="${f.L + bw * (i + 0.5)}" y="${f.H - 4}" text-anchor="middle">${lb}</text>`; });
    values.forEach((v, i) => { if (!v) return; const h = (Math.min(v, max) / max) * f.ih, x = f.L + bw * i + (bw - w) / 2; s += `<path d="${rounded(x, f.T + f.ih - h, w, h)}" fill="${colors?.[i] || color}"/>`; });
    if (hasT) s += `<path d="${tv.map((v, i) => (v ? `${i && tv[i - 1] ? 'L' : 'M'}${f.L + bw * i},${f.T + f.ih - (v / max) * f.ih}H${f.L + bw * (i + 1)}` : '')).join('')}" fill="none" stroke="var(--fg-2)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>`;
    el.innerHTML = s + '</svg>' + (hasT ? `<div class="legend"><span><i style="--c:${color}"></i>${esc(name)}</span><span><i class="dash"></i>${esc(targetName)}</span></div>` : '');
    hover(el, f, days, (i) => `<b>${dayLabel(days[i])} ${shortDate(days[i])}</b>${tipRow(color, name, values[i] == null ? 'no data' : fmt(values[i]) + unit)}${tv[i] ? tipRow(null, targetName, fmt(tv[i]) + unit) : ''}`);
  };
  charts.set(el, draw); draw();
}
/** Lines with gaps for missing days. series: [{name, values, color}] */
export function lineChart(el, days, series, { min = 0, max = null, unit = '', fmt = (v) => Math.round(v), ref = null, refName = '', H = 160, empty = 'No data in this range yet.' } = {}) {
  const draw = () => {
    const f = frame(el, H), all = series.flatMap((s) => s.values).filter((v) => v != null);
    if (!all.length) { el.innerHTML = `<div class="empty">${esc(empty)}</div>`; return; }
    let lo = min, hi = max ?? niceMax(Math.max(...all, ref || 0) * 1.08);
    if (min == null) { const span = Math.max(...all) - Math.min(...all) || 2; lo = Math.floor(Math.min(...all, ref ?? Infinity) - span * 0.3); hi = Math.ceil(Math.max(...all, ref ?? -Infinity) + span * 0.3); }
    const bw = f.iw / days.length, x = (i) => f.L + bw * (i + 0.5), y = (v) => f.T + f.ih - ((v - lo) / (hi - lo || 1)) * f.ih;
    let s = `<svg height="${f.H}" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="${esc(series.map((q) => q.name).join(' and '))}"><rect class="hl" x="0" y="${f.T}" width="0" height="${f.ih}" fill="var(--surface-2)" opacity="0" rx="4"/>`;
    for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) / 4) * i; s += `<line x1="${f.L}" x2="${f.W - f.R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${f.L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
    days.forEach((d, i) => { const lb = xLabel(days, i); if (lb) s += `<text x="${x(i)}" y="${f.H - 4}" text-anchor="middle">${lb}</text>`; });
    if (ref != null) s += `<line x1="${f.L}" x2="${f.W - f.R}" y1="${y(ref)}" y2="${y(ref)}" stroke="var(--fg-2)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>`;
    for (const se of series) {
      let d = '', prev = false; se.values.forEach((v, i) => { if (v == null) { prev = false; return; } d += `${prev ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; prev = true; });
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;
      se.values.forEach((v, i) => { if (v != null && (days.length <= 14 || i === days.length - 1)) s += `<circle cx="${x(i)}" cy="${y(v)}" r="${i === days.length - 1 ? 4.5 : 3}" fill="${se.color}" stroke="var(--surface)" stroke-width="2"/>`; });
    }
    el.innerHTML = s + '</svg>' + (series.length > 1 || ref != null ? `<div class="legend">${series.map((se) => `<span><i style="--c:${se.color}"></i>${esc(se.name)}</span>`).join('')}${ref != null ? `<span><i class="dash"></i>${esc(refName)}</span>` : ''}</div>` : '');
    hover(el, f, days, (i) => `<b>${dayLabel(days[i])} ${shortDate(days[i])}</b>${series.map((se) => tipRow(se.color, se.name, se.values[i] == null ? 'no data' : fmt(se.values[i]) + unit)).join('')}`);
  };
  charts.set(el, draw); draw();
}
/** Stacked bars. cats: [{name, color, values}] */
export function stackChart(el, days, cats, { H = 180, fmtTotal = (v) => v, unitMax = 60, axis = (v) => Math.round(v / 60) + 'h', tipFmt = (v) => v, empty = 'Nothing tracked yet.' } = {}) {
  const draw = () => {
    const f = frame(el, H), tot = days.map((_, i) => cats.reduce((a, c) => a + (c.values[i] || 0), 0));
    if (!tot.some((v) => v)) { el.innerHTML = `<div class="empty">${esc(empty)}</div>`; return; }
    const max = niceMax(Math.max(...tot) / unitMax * 1.05) * unitMax, bw = f.iw / days.length, w = Math.max(3, Math.min(26, bw * 0.6));
    let s = `<svg height="${f.H}" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Stacked per day"><rect class="hl" x="0" y="${f.T}" width="0" height="${f.ih}" fill="var(--surface-2)" opacity="0" rx="4"/>`;
    for (let i = 0; i <= 4; i++) { const v = (max / 4) * i, y = f.T + f.ih - (v / max) * f.ih; s += `<line x1="${f.L}" x2="${f.W - f.R}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${f.L - 6}" y="${y + 4}" text-anchor="end">${axis(v)}</text>`; }
    days.forEach((d, i) => { const lb = xLabel(days, i); if (lb) s += `<text x="${f.L + bw * (i + 0.5)}" y="${f.H - 4}" text-anchor="middle">${lb}</text>`;
      let acc = 0; const x = f.L + bw * i + (bw - w) / 2, segs = cats.filter((c) => c.values[i] > 0);
      segs.forEach((c, j) => { const h = (c.values[i] / max) * f.ih, y0 = f.T + f.ih - ((acc + c.values[i]) / max) * f.ih; acc += c.values[i]; const hh = Math.max(0, h - (j ? 1.5 : 0));
        s += j === segs.length - 1 ? `<path d="${rounded(x, y0, w, hh)}" fill="${c.color}"/>` : `<rect x="${x}" y="${y0}" width="${w}" height="${hh}" fill="${c.color}"/>`; }); });
    const used = cats.filter((c) => c.values.some((v) => v > 0));
    el.innerHTML = s + `</svg><div class="legend">${used.map((c) => `<span><i style="--c:${c.color}"></i>${esc(c.name)}</span>`).join('')}</div>`;
    hover(el, f, days, (i) => `<b>${dayLabel(days[i])} ${shortDate(days[i])} · ${fmtTotal(tot[i])}</b>${used.filter((c) => c.values[i] > 0).map((c) => tipRow(c.color, c.name, tipFmt(c.values[i]))).join('') || 'Nothing'}`);
  };
  charts.set(el, draw); draw();
}

// ---------- theme ----------
export function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#000000' : '#f2f3f5'));
}

// ---------- navigation ----------
export const go = (hash) => { if (location.hash === hash) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };

// Profile button shown on every tab's large title: initial of the saved name, else a person glyph.
export function profileBtn() {
  let name = ''; try { name = (localStorage.getItem('bl:name') || '').trim(); } catch {}
  return `<button class="avatar" data-act="go" data-href="#more" aria-label="Profile and settings">${name ? esc(name[0].toUpperCase()) : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="9" r="3.5"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/></svg>'}</button>`;
}
