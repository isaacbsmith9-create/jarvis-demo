// ===================== shell: navigation, routing, boot =====================
const NAV = [
  { v: 'home', t: 'Home', i: 'home' },
  { v: 'sim', t: 'Simulator', i: 'sim' },
  { v: 'pnr', t: 'PnR Academy', i: 'learn', m: 'Learn' },
  { v: 'iq', t: 'IQ Academy', i: 'iq', rail: true },
  { v: 'playbook', t: 'Team Playbook', i: 'book', m: 'Team' },
  { v: 'teamsim', t: 'Coverage Sim', i: 'shield', rail: true },
  { v: 'defense', t: 'Defense IQ', i: 'def', m: 'Defense' },
  { v: 'cv', t: 'Court Vision', i: 'cam', m: 'Play' },
  { v: 'challenges', t: 'Challenges', i: 'trophy', rail: true },
  { v: 'film', t: 'Film Room', i: 'film', m: 'Film', rail: true },
  { v: 'me', t: 'My IQ', i: 'chart' },
];
const VIEWS = ['home', 'sim', 'pnr', 'iq', 'playbook', 'teamsim', 'defense', 'cv', 'film', 'challenges', 'me', 'play', 'quiz'];
const RENDER = { home: renderHome, sim: renderSim, pnr: () => renderAcademy('pnr'), iq: () => renderAcademy('iq'), film: renderFilm, challenges: renderChallenges, me: renderMe, playbook: renderPlaybook, teamsim: renderTeamSim, defense: renderDefense, cv: renderCV };
let current = 'home';

function buildNav() {
  $('#rail-nav').innerHTML = NAV.map((n) => `<button type="button" class="tab" data-v="${n.v}">${icon(n.i)}<span>${n.t}</span></button>`).join('');
  $('#tabbar').innerHTML = NAV.filter((n) => !n.rail).map((n) => `<button type="button" class="tab" data-v="${n.v}">${icon(n.i)}<span>${n.m || n.t.replace(' Academy', '')}</span></button>`).join('');
  for (const b of $$('.tab')) b.onclick = () => go(b.dataset.v);
}
function markNav(v) {
  const navV = v === 'play' ? (P.from && VIEWS.includes(P.from) ? P.from : 'sim') : v === 'quiz' ? 'challenges' : v;
  for (const b of $$('.tab')) {
    const on = b.dataset.v === navV || (b.closest('#tabbar') && ((b.dataset.v === 'pnr' && navV === 'iq') || (b.dataset.v === 'playbook' && navV === 'teamsim')));
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
}
/** Show a view without re-routing (used by play and quiz, which carry in-page state). */
function showView(v) {
  current = v;
  document.body.dataset.v = v;
  for (const id of VIEWS) $('#view-' + id).hidden = id !== v;
  markNav(v);
  if (location.hash.slice(1) !== v) { try { history.replaceState(null, '', '#' + v); } catch {} }
  window.scrollTo({ top: 0 });
  if (v === 'play') ensureLoop();
  if (v === 'teamsim' && TSIM.S && TSIM.phase !== 'setup') setTimeout(tsLoop, 0);
  if (v === 'defense' && DC.run && DC.sub === 'run') setTimeout(loopD, 0);
  if (v === 'cv' && CV.G) setTimeout(cvLoop, 0);
}
function go(v) {
  if (!RENDER[v]) v = 'home';
  showView(v);
  RENDER[v]();
}
function rerender() { if (RENDER[current]) RENDER[current](); else if (current === 'play') renderPanel(); }

window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1);
  if (v === current) return;
  if (v === 'play' && P.sc) return showView('play');
  go(v);
});

function boot() {
  buildNav();
  initPlayControls();
  const h = location.hash.slice(1);
  go(RENDER[h] ? h : 'home');
  connectStore(() => { const s = $('#sync'), m = $('#sync-m'); if (m) { m.dataset.s = s.dataset.s; m.textContent = ''; } rerender(); });
  // Mirror the sync dot onto the mobile header.
  new MutationObserver(() => { const s = $('#sync'), m = $('#sync-m'); m.dataset.s = s.dataset.s; m.title = s.title; s.textContent = { synced: 'Synced', error: 'Sync failed', loading: 'Syncing…' }[s.dataset.s] || 'This device'; }).observe($('#sync'), { attributes: true });
  if (window.claude?.use) claude.use('sample').then((s) => { if (s) { AI.sample = s; if (current === 'play' && P.phase === 'done') renderPanel(); } }).catch(() => {});
}
boot();
