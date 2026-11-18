// ===================== boot & routing =====================
const RENDER = { command: renderCommand, data: renderData, testing: renderTesting, hoops: renderHoops, analytics: renderAnalytics, intel: renderIntel, reports: renderReports, method: renderMethod };
function buildNav() {
  $('#rail-nav').innerHTML = NAV.map((n) => `<button type="button" class="tab" data-v="${n.v}">${icon(n.v)}<span>${n.t}</span></button>`).join('');
  $('#tabbar').innerHTML = NAV.filter((n) => !n.more).map((n) => `<button type="button" class="tab" data-v="${n.v}">${icon(n.v)}<span>${n.m}</span></button>`).join('') + `<button type="button" class="tab" data-v="more">${icon('more')}<span>More</span></button>`;
  for (const b of $$('.tab')) b.onclick = () => (b.dataset.v === 'more' ? moreMenu() : go(b.dataset.v));
}
function moreMenu() {
  openSheet('More', `<div class="customize">${NAV.filter((n) => n.more).map((n) => `<button type="button" class="cz-row" data-mv="${n.v}">${icon(n.v)}<b>${n.t}</b></button>`).join('')}</div>`, { cancel: 'Close', onOpen: (d) => { for (const b of $$('[data-mv]', d)) b.onclick = () => { closeSheet(); go(b.dataset.mv); }; } });
}
function markNav() {
  const more = NAV.find((n) => n.v === S.view)?.more;
  for (const b of $$('.tab')) { const on = b.dataset.v === S.view || (more && b.dataset.v === 'more'); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); }
}
function go(v) {
  if (!RENDER[v]) v = 'command';
  if (v !== S.view) window.scrollTo({ top: 0 });
  S.view = v;
  for (const k of Object.keys(RENDER)) $('#view-' + k).hidden = k !== v;
  if (location.hash.slice(1) !== v) { try { history.replaceState(null, '', '#' + v); } catch {} }
  markNav(); renderHeader(); RENDER[v]();
}
function rerender() { renderHeader(); RENDER[S.view](); }
function renderHeader() {
  const a = curAthlete(), chip = $('#ath-chip');
  chip.innerHTML = a ? `<span class="av">${esc(a.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span><b>${esc(a.name)}</b>` : `<span class="av">+</span><b>Add athlete</b>`;
  chip.onclick = () => (a ? athletePicker() : athleteForm());
  const rs = $('#range-sel');
  rs.innerHTML = Object.entries(RANGES).map(([k, l]) => `<option value="${k}" ${S.R.key === k ? 'selected' : ''}>${l}</option>`).join('');
  $('#custom-range').hidden = S.R.key !== 'custom';
}
function setRange(key) {
  const from = $('#range-from').value, to = $('#range-to').value;
  S.R = rangeFrom(key, from, to); uiSet('range', { key, from, to });
  rerender();
}
function boot() {
  initTooltip();
  const saved = uiGet('range', { key: 'all' });
  $('#range-from').value = saved.from || addDays(isoDate(), -60); $('#range-to').value = saved.to || isoDate();
  S.R = rangeFrom(saved.key || 'all', $('#range-from').value, $('#range-to').value);
  buildNav();
  $('#range-sel').onchange = (e) => setRange(e.target.value);
  $('#range-from').onchange = () => setRange('custom'); $('#range-to').onchange = () => setRange('custom');
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (RENDER[v] && v !== S.view) go(v); });
  const h = location.hash.slice(1);
  go(RENDER[h] ? h : 'command');
  // Keep the mobile sync dot in step with the rail's.
  new MutationObserver(() => { const s = $('#sync'), m = $('#sync-m'); m.dataset.s = s.dataset.s; m.title = s.title; }).observe($('#sync'), { attributes: true });
  connectStore(() => rerender());
  if (window.claude?.use) claude.use('sample').then((s) => { if (s) { AI.sample = s; if (['command', 'reports'].includes(S.view)) rerender(); } }).catch(() => {});
}
boot();
