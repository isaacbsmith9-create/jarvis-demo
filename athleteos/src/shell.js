// ===================== shell: routing, sheets, theme =====================
const VIEWS = [['home', 'Home', 'home'], ['analytics', 'Analytics', 'chart'], ['hoops', 'Hoops', 'ball'], ['train', 'Train', 'calendar'], ['mind', 'Mind', 'brain'], ['intel', 'Intel', 'target'], ['coach', 'Coach', 'spark'], ['profile', 'Profile', 'trophy', true]];
const SUBS = {
  analytics: [['overview', 'Overview'], ['performance', 'Performance'], ['training', 'Training'], ['body', 'Body'], ['recovery', 'Recovery'], ['nutrition', 'Nutrition'], ['correlations', 'Correlations'], ['compare', 'Compare'], ['reports', 'Reports']],
  hoops: [['court', 'Shot chart'], ['categories', 'Shooting'], ['handles', 'Handles'], ['finishing', 'Finishing'], ['iq', 'IQ & film'], ['games', 'Games']],
  train: [['overview', 'Overview'], ['plan', 'Calendar'], ['routines', 'Routines'], ['load', 'Load'], ['goals', 'Goals'], ['tests', 'Tests'], ['library', 'Library'], ['history', 'History']],
  intel: [['feed', 'Insights'], ['actions', 'Action center'], ['profile', 'Profile'], ['review', 'Weekly review'], ['trends', 'Trends'], ['priorities', 'Priorities']],
  mind: [['checkin', 'Check-in'], ['trends', 'Trends'], ['training', 'Mental training'], ['journal', 'Journal']],
  coach: [['director', 'Director'], ['workout', 'Workout'], ['program', 'S&C program'], ['devplan', 'Dev plan'], ['ask', 'Ask'], ['report', 'Weekly evaluation'], ['fuel', 'Fuel tools']],
};
const state = { view: 'home', sub: {} };
const RENDER = {};
function parseHash() {
  let [v, s] = (location.hash.slice(1) || 'home').split(/[-/]/);
  if (v === 'tests') { v = 'train'; s = 'tests'; }
  if (v === 'train' && s === 'today') s = 'routines';
  const view = VIEWS.some((x) => x[0] === v) ? v : 'home';
  state.view = view;
  if (s && SUBS[view]?.some((x) => x[0] === s)) state.sub[view] = s;
}
function go(view, sub) {
  if (view === 'tests') { view = 'train'; sub = 'tests'; }
  const h = '#' + view + (sub ? '-' + sub : '');
  if (location.hash !== h) history.replaceState(null, '', h);
  parseHash(); render(); window.scrollTo(0, 0);
}
const subOf = (v) => state.sub[v] || SUBS[v]?.[0][0];
function render() {
  // Only the active screen keeps content, so element ids are never duplicated.
  for (const [v] of VIEWS) { const x = $('#view-' + v); x.hidden = v !== state.view; if (x.hidden) x.innerHTML = ''; }
  $$('.tab').forEach((t) => { const on = t.dataset.view === state.view; t.classList.toggle('on', on); t.setAttribute('aria-current', on ? 'page' : 'false'); });
  const el = $('#view-' + state.view);
  const subs = SUBS[state.view];
  const nav = subs ? `<nav class="subnav" aria-label="Sections">${subs.map(([k, l]) => `<button type="button" data-sub="${k}" class="${k === subOf(state.view) ? 'on' : ''}">${l}</button>`).join('')}</nav>` : '';
  el.innerHTML = nav + `<div class="view" id="vbody"></div>`;
  try { RENDER[state.view]($('#vbody', el), subOf(state.view)); } catch (err) { console.error(err); $('#vbody', el).innerHTML = `<div class="card"><b>Something went wrong drawing this screen.</b><p class="muted small">${esc(err.message)}</p></div>`; }
  animateRings(el);
  $$('.heat', el).forEach((h) => { h.scrollLeft = h.scrollWidth; }); // newest weeks in view first
  $('.subnav .on', el)?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
// Re-render only the active screen body (keeps scroll position).
function refresh() { const y = window.scrollY; render(); window.scrollTo(0, y); }
document.addEventListener('click', (e) => {
  const sb = e.target.closest('[data-sub]'); if (sb && sb.closest('.subnav')) return go(state.view, sb.dataset.sub);
  const g = e.target.closest('[data-go]'); if (g) { const [v, s] = g.dataset.go.split('-'); return go(v, s); }
  const ml = e.target.closest('a[data-ml]'); if (ml) { e.preventDefault(); return goTo(ml.getAttribute('href')); }
});
window.addEventListener('hashchange', () => { parseHash(); render(); });
let rzT; let lastW = window.innerWidth;
window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (Math.abs(window.innerWidth - lastW) > 30) { lastW = window.innerWidth; refresh(); } }, 200); });

// Sheets: one dialog reused for every form.
function openSheet(title, html, mount) {
  const d = $('#sheet');
  d.innerHTML = `<div class="sheet-in"><div class="sheet-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>${html}</div>`;
  if (!d.open) d.showModal();
  mount?.(d);
  return d;
}
// The artifact viewer blocks confirm(), so confirmations happen in a sheet.
function confirmSheet(msg, okLabel, fn) {
  openSheet('Are you sure?', `<p>${esc(msg)}</p><div class="row"><button type="button" class="btn" data-close style="flex:1">Cancel</button><button type="button" class="btn danger" id="cf-ok" style="flex:1">${esc(okLabel)}</button></div>`, (d) => $('#cf-ok', d).addEventListener('click', () => { closeSheet(); fn(); }));
}
const closeSheet = () => { const d = $('#sheet'); if (d.open) d.close(); };
$('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === $('#sheet')) closeSheet(); });

// Theme: shares MacroLens's saved choice (dark by default).
const THEME_KEY = 'macrolens-theme';
function applyTheme(choice) {
  if (choice === 'light' || choice === 'dark') document.documentElement.setAttribute('data-theme', choice);
  else document.documentElement.removeAttribute('data-theme');
}
let themeChoice = 'dark'; try { themeChoice = localStorage.getItem(THEME_KEY) || 'dark'; } catch {}
applyTheme(themeChoice);

// Range filter helper
const RANGES = [['7', '7D'], ['30', '30D'], ['90', '90D'], ['182', '6M'], ['365', '1Y'], ['all', 'All']];
function seg(name, opts, cur) { return `<div class="seg" role="group" data-seg="${name}">${opts.map(([k, l]) => `<button type="button" data-v="${k}" class="${String(k) === String(cur) ? 'on' : ''}" aria-pressed="${String(k) === String(cur)}">${l}</button>`).join('')}</div>`; }
const UI = (() => { try { return JSON.parse(localStorage.getItem('aos-ui') || '{}'); } catch { return {}; } })();
function ui(k, d) { return UI[k] ?? d; }
function setUi(k, v) { UI[k] = v; try { localStorage.setItem('aos-ui', JSON.stringify(UI)); } catch {} }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-seg] button'); if (!b) return;
  setUi(b.parentElement.dataset.seg, b.dataset.v); refresh();
});
const inRange = (iso, r) => r === 'all' || daysBetween(iso, todayIso()) < Number(r);
const rangeStart = (r, pts) => (r === 'all' ? pts[0]?.date || todayIso() : shiftIso(todayIso(), -(Number(r) - 1)));
