'use strict';
// ===================== toasts =====================
function toast(msg, action) {
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `${icon('circle-check', 16)}<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.remove(); };
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), action ? 6000 : 2800);
}

// ===================== modal =====================
let modalStack = [];
/** opts: { title, body (html), wide, foot (html), onMount(root), onClose } returns close() */
function modal(opts) {
  const sc = document.createElement('div'); sc.className = 'scrim';
  sc.innerHTML = `<div class="modal${opts.wide ? ' wide' : ''}${opts.cls ? ' ' + opts.cls : ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.title || 'Dialog')}">
    ${opts.title ? `<div class="modal-h">${opts.icon ? `<span class="ki" style="color:var(--accent)">${icon(opts.icon, 20)}</span>` : ''}<h2 class="grow">${esc(opts.title)}</h2>${opts.headEnd || ''}<button type="button" class="icon-btn" data-x aria-label="Close">${icon('x', 18)}</button></div>` : ''}
    <div class="modal-b">${opts.body || ''}</div>${opts.foot ? `<div class="modal-f">${opts.foot}</div>` : ''}</div>`;
  document.body.appendChild(sc);
  const close = () => { sc.remove(); modalStack = modalStack.filter((m) => m !== close); opts.onClose?.(); };
  sc.addEventListener('mousedown', (e) => { if (e.target === sc) close(); });
  sc.querySelector('[data-x]')?.addEventListener('click', close);
  modalStack.push(close);
  const root = sc.querySelector('.modal');
  opts.onMount?.(root, close);
  setTimeout(() => root.querySelector('[autofocus]')?.focus(), 30);
  return close;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) { modalStack[modalStack.length - 1](); } });
function confirmBox(text, yes = 'Delete', danger = true) {
  return new Promise((res) => {
    let ok = false;
    modal({ title: 'Are you sure?', body: `<p style="margin:0">${esc(text)}</p>`, foot: `<button class="btn ghost" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(yes)}</button>`,
      onMount: (r, close) => { r.querySelector('[data-no]').onclick = close; r.querySelector('[data-yes]').onclick = () => { ok = true; close(); }; }, onClose: () => res(ok) });
  });
}
// read named inputs in a root into an object
function formData(root) {
  const o = {};
  for (const el of $$('[name]', root)) { if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value); else o[el.name] = el.value.trim(); }
  return o;
}
const classOptions = (sel, none = 'No class') => `<option value="">${none}</option>` + S.classes.map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

// ===================== charts (SVG, theme-aware) =====================
const PALETTE = ['#6d7cff', '#34c38f', '#f2b84b', '#f07178', '#38bdf8', '#c084fc', '#fb923c', '#2dd4bf'];
let tipEl = null;
function tipShow(e, html) { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); } tipEl.innerHTML = html; tipEl.hidden = false; const x = e.clientX, y = e.clientY; tipEl.style.left = Math.min(window.innerWidth - tipEl.offsetWidth - 8, x + 12) + 'px'; tipEl.style.top = Math.max(8, y - tipEl.offsetHeight - 10) + 'px'; }
function tipHide() { if (tipEl) tipEl.hidden = true; }
document.addEventListener('pointermove', (e) => { const t = e.target.closest?.('[data-tip]'); if (t) tipShow(e, t.getAttribute('data-tip')); else tipHide(); });
document.addEventListener('scroll', tipHide, true);
/** series: [{name, color, points:[{x: number|string label idx, y}]}], opts: {labels, min, max, h, fmt, area, dots, goal} */
function lineChart(series, o = {}) {
  const W = 640, H = o.h || 220, L = 36, R = 12, T = 14, B = 26;
  const labels = o.labels || [], n = Math.max(2, labels.length || Math.max(...series.map((s) => s.points.length)));
  const vals = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => v != null);
  if (!vals.length) return emptyChart(o.empty || 'No data yet');
  let lo = o.min ?? Math.floor(Math.min(...vals) - 3), hi = o.max ?? Math.ceil(Math.max(...vals) + 3); if (o.min == null && o.max == null && hi - lo < 4) { lo -= 2; hi += 2; }
  const x = (i) => L + (i / (n - 1)) * (W - L - R), y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const fmt = o.fmt || ((v) => round(v, 1));
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${Math.round(v)}</text>`; }
  const step = Math.ceil(n / 8); labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`; });
  if (o.goal != null && o.goal >= lo && o.goal <= hi) g += `<line x1="${L}" x2="${W - R}" y1="${y(o.goal)}" y2="${y(o.goal)}" stroke="var(--warn)" stroke-dasharray="5 5" stroke-width="1.5"/><text x="${W - R}" y="${y(o.goal) - 5}" text-anchor="end" style="fill:var(--warn)">goal ${o.goal}</text>`;
  series.forEach((s, si) => {
    const pts = s.points.map((p, i) => ({ i: p.i ?? i, y: p.y, label: p.label })).filter((p) => p.y != null);
    if (!pts.length) return;
    const id = 'lg' + Math.random().toString(36).slice(2, 7), c = s.color || PALETTE[si % PALETTE.length];
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
    if (o.area !== false && series.length === 1) g += `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".32"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${x(pts[pts.length - 1].i)},${H - B}L${x(pts[0].i)},${H - B}Z" fill="url(#${id})"/>`;
    g += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const p of pts) g += `<circle cx="${x(p.i)}" cy="${y(p.y)}" r="${o.dots === false ? 0 : 3.5}" fill="${c}" stroke="var(--card)" stroke-width="2"/><circle cx="${x(p.i)}" cy="${y(p.y)}" r="11" fill="transparent" data-tip="${esc(`<b>${esc(s.name || '')}</b> ${esc(p.label || labels[p.i] || '')}: ${fmt(p.y)}`)}"/>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Line chart')}">${g}</svg></div>${series.length > 1 ? legend(series) : ''}`;
}
/** bars: [{label, value, color, sub}] opts: {max, h, fmt, horizontal, goal} */
function barChart(bars, o = {}) {
  if (!bars.length || bars.every((b) => !b.value)) return emptyChart(o.empty || 'No data yet');
  const fmt = o.fmt || ((v) => round(v, 1));
  if (o.horizontal) {
    const max = o.max || Math.max(...bars.map((b) => b.value)) || 1;
    return `<div class="stack" style="gap:10px">${bars.map((b, i) => `<div><div class="between small" style="margin-bottom:5px"><span class="row" style="gap:8px"><i class="dot-c" style="--c:${b.color || PALETTE[i % PALETTE.length]}"></i><b style="font-weight:600">${esc(b.label)}</b></span><span class="num muted">${b.sub ? esc(b.sub) + ' · ' : ''}<b style="color:var(--fg)">${fmt(b.value)}</b></span></div><div class="bar" style="height:9px"><i style="width:${clamp((b.value / max) * 100, 0, 100)}%;--c:${b.color || PALETTE[i % PALETTE.length]}"></i></div></div>`).join('')}</div>`;
  }
  const W = 640, H = o.h || 200, L = 30, R = 8, T = 16, B = 26, n = bars.length, slot = (W - L - R) / n, bw = Math.min(46, slot * 0.58);
  const max = (o.max || Math.max(...bars.map((b) => b.value))) * 1.1 || 1, y = (v) => T + (H - T - B) * (1 - v / max);
  let g = '';
  for (let k = 0; k <= 3; k++) { const v = (max * k) / 3; g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${Math.round(v)}</text>`; }
  if (o.goal) g += `<line x1="${L}" x2="${W - R}" y1="${y(o.goal)}" y2="${y(o.goal)}" stroke="var(--warn)" stroke-dasharray="5 5" stroke-width="1.5"/>`;
  bars.forEach((b, i) => {
    const cx = L + slot * i + slot / 2, h = Math.max(b.value ? 3 : 0, H - B - y(b.value)), c = b.color || 'var(--accent)';
    g += `<rect x="${cx - bw / 2}" y="${H - B - h}" width="${bw}" height="${h}" rx="6" fill="${c}" opacity="${b.dim ? .45 : 1}" data-tip="${esc(`<b>${esc(b.label)}</b>: ${fmt(b.value)}${b.sub ? ' · ' + esc(b.sub) : ''}`)}"/>`;
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(b.short || b.label)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Bar chart')}">${g}</svg></div>`;
}
/** donut: [{label, value, color}] center text */
function donut(parts, center = '', sub = '', size = 150) {
  const total = sum(parts.map((p) => p.value));
  const r = 54, C = 2 * Math.PI * r; let off = 0, g = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="var(--raised-2)" stroke-width="16"/>`;
  if (total) for (const [i, p] of parts.entries()) { const len = (p.value / total) * C; g += `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${p.color || PALETTE[i % PALETTE.length]}" stroke-width="16" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)" data-tip="${esc(`<b>${esc(p.label)}</b>: ${round(p.value, 1)} (${Math.round((p.value / total) * 100)}%)`)}"/>`; off += len; }
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 140 140" width="${size}" height="${size}" style="transform:none">${g}</svg><div class="rv"><b>${center}</b><small>${sub}</small></div></div>`;
}
function ring(pct, label, sub = '', size = 120, color = 'var(--accent)', stroke = 10) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, p = clamp(pct ?? 0, 0, 100) / 100;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--raised-2)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(p * C).toFixed(1)} ${C.toFixed(1)}" style="transition:stroke-dasharray .6s ease"/></svg><div class="rv"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}
function spark(vals, color = 'var(--accent)', w = 90, h = 30) {
  const v = vals.filter((x) => x != null); if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), rng = hi - lo || 1;
  const d = vals.map((x, i) => (x == null ? null : `${(i / (vals.length - 1)) * w},${h - 3 - ((x - lo) / rng) * (h - 6)}`)).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p).join('');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
/** heatmap of minutes per day for the last `weeks` weeks (columns = weeks, rows Mon..Sun) */
function heatmap(valueOf, weeks = 16, label = 'min') {
  const end = today(), start = addDays(weekStart(end), -(weeks - 1) * 7); let cells = '';
  const vals = []; for (let d = start; d <= addDays(weekStart(end), 6); d = addDays(d, 1)) vals.push([d, d <= end ? valueOf(d) : null]);
  const max = Math.max(1, ...vals.map(([, v]) => v || 0));
  for (const [d, v] of vals) { const a = v == null ? 0 : v ? 0.25 + 0.75 * (v / max) : 0; cells += `<i style="${v ? `background:color-mix(in srgb, var(--accent) ${Math.round(a * 100)}%, var(--raised-2))` : v == null ? 'opacity:.25' : ''}" data-tip="${esc(`${fmtDay(d)}: ${v ? Math.round(v) + ' ' + label : 'none'}`)}"></i>`; }
  return `<div style="overflow-x:auto"><div class="heat">${cells}</div></div>`;
}
const legend = (series) => `<div class="legend">${series.map((s, i) => `<span><i class="dot-c" style="--c:${s.color || PALETTE[i % PALETTE.length]}"></i>${esc(s.name)}</span>`).join('')}</div>`;
const emptyChart = (msg) => `<div class="empty" style="padding:30px 10px"><div class="ei">${icon('chart-line', 22)}</div><span class="small">${esc(msg)}</span></div>`;
function emptyState(ic, title, text, btn = '') { return `<div class="empty"><div class="ei">${icon(ic, 22)}</div><b>${esc(title)}</b><span class="small" style="max-width:42ch">${esc(text)}</span>${btn}</div>`; }
function gradeColor(p) { return p == null ? 'var(--muted)' : p >= 90 ? 'var(--good)' : p >= 80 ? '#7cc4ff' : p >= 70 ? 'var(--warn)' : 'var(--bad)'; }

// ===================== router + shell =====================
const ROUTES = {
  home: ['Home', 'house'], classes: ['Classes', 'library'], assignments: ['Assignments', 'list-checks'], grades: ['Grades', 'chart-line'],
  study: ['Study Center', 'brain'], exams: ['Exams', 'graduation-cap'], planner: ['Planner', 'calendar-days'], insights: ['Insights', 'lightbulb'], intel: ['Intelligence', 'gauge'], settings: ['Settings', 'settings'],
};
const VIEWS = {};
let route = { name: 'home', arg: null, sub: null };
function parseHash() { const [n, arg, sub] = location.hash.slice(1).split('/'); return { name: ROUTES[n] ? n : 'home', arg: arg ? decodeURIComponent(arg) : null, sub: sub || null }; }
function go(name, arg = null, sub = null) { const h = '#' + [name, arg, sub].filter((x) => x != null).map(encodeURIComponent).join('/'); if (location.hash === h) render(); else location.hash = h; }
function renderNav() {
  const n = alerts().length, due = cardsDue().length, open = openAssignments().filter((a) => effStatus(a) === 'overdue').length;
  const item = (k) => `<a href="#${k}" class="${route.name === k ? 'on' : ''}">${icon(ROUTES[k][1], 18)}<span>${ROUTES[k][0]}</span>${k === 'assignments' && open ? `<span class="badge bad">${open}</span>` : k === 'study' && due ? `<span class="badge accent">${due}</span>` : ''}</a>`;
  $('#side-nav').innerHTML = `<div class="nav">${['home', 'classes', 'assignments', 'grades'].map(item).join('')}</div><div class="nav-sec">Intelligence</div><div class="nav">${item('intel')}</div><div class="nav-sec">Prepare</div><div class="nav">${['study', 'exams', 'planner', 'insights'].map(item).join('')}</div><div class="nav-sec">You</div><div class="nav">${item('settings')}</div>`;
  const nm = S.profile.name || 'Student';
  $('#side-foot').innerHTML = `<span class="avatar">${esc(nm.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span><span class="grow" style="min-width:0"><b style="display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(nm)}</b><span class="tiny muted">${esc([S.profile.grade, S.profile.term].filter(Boolean).join(' · ') || 'Set up your profile')}</span></span><a class="icon-btn" href="#settings" aria-label="Settings" style="width:32px;height:32px">${icon('settings', 16)}</a>`;
  const tb = ['home', 'assignments', 'planner', 'study'];
  const moreOn = !tb.includes(route.name);
  $('#tabbar').innerHTML = tb.map((k) => `<a href="#${k}" class="${route.name === k ? 'on' : ''}">${icon(ROUTES[k][1], 21)}<span>${k === 'study' ? 'Study' : ROUTES[k][0]}</span></a>`).join('') + `<a href="#" data-more class="${moreOn ? 'on' : ''}">${icon('layout-grid', 21)}<span>More</span></a>`;
  $('#bell-dot').hidden = !n;
}
function render() {
  route = parseHash();
  refreshOverdue();
  renderNav();
  const [title] = ROUTES[route.name];
  const v = VIEWS[route.name];
  const out = v ? v(route) : { html: '' };
  $('#crumb').innerHTML = `<h1>${esc(out.title || title)}</h1>${out.sub ? `<p>${out.sub}</p>` : ''}`;
  $('#top-actions').innerHTML = (S.classes.some((c) => c.demo) ? `<a class="badge warn hide-sm" href="#settings" style="text-decoration:none" title="Sample data is loaded. Remove it in Settings.">${icon('sparkles', 12)} Sample data</a>` : '') + (out.actions || '');
  const old = $('#page'), page = old.cloneNode(false); old.replaceWith(page); page.innerHTML = out.html; // fresh node: listeners from the last render are dropped
  out.mount?.(page);
  document.title = `${out.title || title} · Student Lens`;
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
let rerenderT = null;
onChange(() => { clearTimeout(rerenderT); rerenderT = setTimeout(() => { if (!modalStack.length && !document.activeElement?.matches?.('input,textarea,select')) render(); else renderNav(); }, 60); });
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-more]')) { e.preventDefault(); openMore(); }
});
function openMore() {
  const close = modal({ title: 'Everything', body: `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${['intel', 'classes', 'grades', 'exams', 'insights', 'settings'].map((k) => `<a class="card flat" href="#${k}" style="text-decoration:none;color:inherit;display:flex;gap:10px;align-items:center;padding:14px">${icon(ROUTES[k][1], 20)}<b>${ROUTES[k][0]}</b></a>`).join('')}</div>`,
    onMount: (r, c) => r.addEventListener('click', (e) => { if (e.target.closest('a')) c(); }) });
}

// ===================== global search =====================
function searchAll(q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const hit = (s) => String(s || '').toLowerCase().includes(q), out = [];
  for (const c of S.classes) if (hit(c.name) || hit(c.teacher)) out.push({ ic: 'library', t: c.name, s: c.teacher ? 'Class · ' + c.teacher : 'Class', c: c.color, go: () => go('classes', c.id) });
  for (const a of S.assignments) if (hit(a.title) || hit(a.description)) out.push({ ic: 'list-checks', t: a.title, s: `${clsName(a.classId)} · due ${fmtDate(a.due)}`, c: clsColor(a.classId), go: () => openAssignment(a.id) });
  for (const e of S.exams) if (hit(e.title)) out.push({ ic: 'graduation-cap', t: e.title, s: `${clsName(e.classId)} exam · ${fmtDate(e.date)}`, c: clsColor(e.classId), go: () => go('exams', e.id) });
  for (const n of S.notes) if (hit(n.title) || hit(n.body)) out.push({ ic: 'notebook-pen', t: n.title, s: `Note · ${clsName(n.classId)}`, c: clsColor(n.classId), go: () => go('study', 'workspace', n.id) });
  for (const g of S.guides) if (hit(g.title)) out.push({ ic: 'book-text', t: g.title, s: `Study guide · ${clsName(g.classId)}`, c: clsColor(g.classId), go: () => go('study', 'guides', g.id) });
  for (const d of S.decks) if (hit(d.name)) out.push({ ic: 'layers', t: d.name, s: `Flashcard deck · ${clsName(d.classId)}`, c: clsColor(d.classId), go: () => go('study', 'cards', d.id) });
  for (const c of S.cards) if (hit(c.front) || hit(c.back)) out.push({ ic: 'layers', t: c.front, s: `Card · ${byId('decks', c.deckId)?.name || ''}`, c: clsColor(byId('decks', c.deckId)?.classId), go: () => go('study', 'cards', c.deckId) });
  for (const tp of S.topics) if (hit(tp.name) || hit(tp.unit)) out.push({ ic: 'layout-grid', t: tp.name, s: `Topic · ${clsName(tp.classId)}${tp.unit ? ' · ' + tp.unit : ''}`, c: clsColor(tp.classId), go: () => topicDetail(tp.id) });
  for (const g of S.goals) if (hit(goalTitle(g))) out.push({ ic: 'flag', t: goalTitle(g), s: 'Goal', go: () => go('intel', 'goals') });
  for (const ev of S.events) if (hit(ev.title)) out.push({ ic: 'calendar', t: ev.title, s: `Event · ${fmtDate(ev.date)}`, c: ev.color || clsColor(ev.classId), go: () => go('planner', 'day', ev.date) });
  return out.slice(0, 30);
}
function openSearch() {
  let sel = 0, res = [];
  modal({ cls: 'palette', body: `<div style="margin:-18px -18px 0;border-bottom:1px solid var(--line)" class="row">${icon('search', 18, 'muted')}<input type="search" id="gs-q" placeholder="Search classes, assignments, exams, notes, cards…" autofocus autocomplete="off" aria-label="Search"></div><div id="gs-r" style="max-height:60vh;overflow:auto;margin:0 -10px"></div>`,
    onMount: (r, close) => {
      const draw = () => { res = searchAll($('#gs-q', r).value); sel = Math.min(sel, Math.max(0, res.length - 1));
        $('#gs-r', r).innerHTML = res.length ? res.map((x, i) => `<div class="res${i === sel ? ' on' : ''}" data-i="${i}"><span class="ki" style="color:${x.c || 'var(--accent)'}">${icon(x.ic, 18)}</span><span class="grow"><b style="display:block">${esc(x.t)}</b><span class="tiny muted">${esc(x.s)}</span></span>${icon('arrow-right', 15, 'dim')}</div>`).join('') : `<p class="muted small" style="padding:12px 14px;margin:0">${$('#gs-q', r).value ? 'No matches.' : 'Type to search everything you have saved.'}</p>`; };
      $('#gs-q', r).addEventListener('input', () => { sel = 0; draw(); });
      $('#gs-q', r).addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } if (e.key === 'Enter' && res[sel]) { close(); res[sel].go(); } });
      $('#gs-r', r).addEventListener('click', (e) => { const d = e.target.closest('[data-i]'); if (d) { close(); res[+d.dataset.i].go(); } });
      draw();
    } });
}
document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); } });

// ===================== notifications (derived from your data; nothing is sent anywhere) =====================
function alerts() {
  const t = today(), out = [];
  const od = S.assignments.filter((a) => effStatus(a) === 'overdue');
  if (od.length) out.push({ lvl: 'bad', ic: 'triangle-alert', t: `${od.length} overdue assignment${od.length === 1 ? '' : 's'}`, s: od.slice(0, 3).map((a) => a.title).join(', '), go: () => go('assignments', 'overdue') });
  const tom = openAssignments().filter((a) => a.due === addDays(t, 1));
  if (tom.length) out.push({ lvl: 'warn', ic: 'alarm-clock', t: `${tom.length} due tomorrow`, s: tom.map((a) => a.title).join(', '), go: () => go('assignments') });
  for (const e of S.exams.filter((e) => e.date >= t && daysBetween(t, e.date) <= 5)) { const r = readiness(e); out.push({ lvl: r != null && r < 60 ? 'bad' : 'warn', ic: 'graduation-cap', t: `${e.title} ${relDayL(e.date)}`, s: r == null ? 'No prep tracked yet' : `Readiness ${r}%`, go: () => go('exams', e.id) }); }
  for (const c of S.classes) { const g = classGrade(c.id); if (g?.pct != null && c.goal && g.pct < c.goal) out.push({ lvl: 'warn', ic: 'trending-down', t: `${c.name} is below your goal`, s: `${round(g.pct, 1)}% now, goal ${c.goal}%`, go: () => go('classes', c.id) }); }
  if (typeof risks === 'function' && S.classes.length) { const hr = risks().filter((r) => r.level === 'high' && !/^(overdue|missing|exam):/.test(r.id)); if (hr.length) out.push({ lvl: 'bad', ic: 'gauge', t: `${hr.length} high academic risk${hr.length === 1 ? '' : 's'}`, s: hr.slice(0, 2).map((r) => r.title).join(' · '), go: () => go('intel', 'risks') }); }
  const due = cardsDue().length; if (due >= 10) out.push({ lvl: 'info', ic: 'layers', t: `${due} flashcards due for review`, s: 'Spaced repetition works best on time', go: () => go('study', 'cards') });
  return out;
}
function openAlerts() {
  const a = alerts();
  modal({ title: 'Notifications', icon: 'bell', body: a.length ? `<div class="stack">${a.map((x, i) => `<div class="alert ${x.lvl}" style="cursor:pointer" data-i="${i}"><span class="ai">${icon(x.ic, 16)}</span><span class="grow"><b style="display:block">${esc(x.t)}</b><span class="small muted">${esc(x.s)}</span></span>${icon('chevron-right', 16, 'dim')}</div>`).join('')}</div><p class="tiny dim" style="margin:0">Built from your own records on this device. Nothing is sent anywhere.</p>` : emptyState('bell', 'All clear', 'Nothing overdue, no exams in the next 5 days, and every class is at or above its goal.'),
    onMount: (r, close) => r.addEventListener('click', (e) => { const d = e.target.closest('[data-i]'); if (d) { close(); a[+d.dataset.i].go(); } }) });
}
