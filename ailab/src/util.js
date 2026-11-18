// ===================== helpers & statistics =====================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const uid = (p = 'id') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DAY = 86400000;
const pad2 = (n) => String(n).padStart(2, '0');
const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** 'YYYY-MM-DD' → ms at local noon (so day arithmetic never crosses a DST edge). */
const dms = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12).getTime(); };
const addDays = (iso, n) => isoDate(new Date(dms(iso) + n * DAY));
const fmtDate = (iso, opt = { month: 'short', day: 'numeric', year: 'numeric' }) => new Date(dms(iso)).toLocaleDateString(undefined, opt);
const fmtShort = (iso) => fmtDate(iso, { month: 'short', day: 'numeric' });
const daysBetween = (a, b) => Math.round((dms(b) - dms(a)) / DAY);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
const uiGet = (k, d) => { try { const v = localStorage.getItem('ailui:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const uiSet = (k, v) => { try { localStorage.setItem('ailui:' + k, JSON.stringify(v)); } catch {} };

/** Format a number with fixed decimals; '—' for null. */
const fmt = (v, dec = 1) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(dec));
const fmtPct = (v, dec = 1) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(dec) + '%');
const signed = (v, dec = 1, suf = '') => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(dec) + suf);
/** Parse "4:32", "4:32.5" or "272" into seconds. */
function parseTime(s) {
  s = String(s).trim(); if (!s) return null;
  if (s.includes(':')) { const [m, sec] = s.split(':'); const v = Number(m) * 60 + Number(sec); return isFinite(v) ? v : null; }
  const v = Number(s); return isFinite(v) ? v : null;
}
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;

// ---- statistics (all documented on the Methodology page) ----
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
/** Sample standard deviation (n − 1). */
function sd(a) { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); }
/** Coefficient of variation = SD / mean. Lower = more consistent. */
function cv(a) { const s = sd(a), m = mean(a); return s == null || !m ? null : Math.abs(s / m); }
/** Least-squares line through (x, y). Returns slope, intercept, r² and n. */
function linreg(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (!sxx) return null;
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 1;
  return { slope, intercept, r2, n };
}
/** Pearson correlation. */
function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys); let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; }
  return b && c ? a / Math.sqrt(b * c) : null;
}
/** Improvement from a to b as a fraction, positive = better given the metric's direction. */
const improvement = (a, b, dir) => (a == null || b == null || !a ? null : dir === 'lower' ? (a - b) / Math.abs(a) : (b - a) / Math.abs(a));
/** Wilson 95% interval for a proportion (used to show shooting uncertainty). */
function wilson(k, n) {
  if (!n) return null; const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
