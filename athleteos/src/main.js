// ===================== boot =====================
$('#tabbar').innerHTML = `<div class="tabbar-inner">${VIEWS.map(([k, l, i]) => `<button type="button" class="tab" data-view="${k}">${ICONS[i]}${l}</button>`).join('')}</div>`;
$('#tabbar').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) go(t.dataset.view); });
$('#brand-mark').innerHTML = ICONS.logo;
$('#btn-apps').innerHTML = ICONS.grid;
$('#btn-settings').innerHTML = ICONS.gear;
parseHash();
mirrorCourtLab();
render();
connectStore(() => { mirrorCourtLab(); refresh(); });
(async () => {
  if (!window.claude?.use) return;
  try { ai = await claude.use('sample'); } catch { ai = null; }
  if (ai) refresh();
})();
// Day rollover while the app stays open.
let lastDay = todayIso();
setInterval(() => { if (todayIso() !== lastDay) { lastDay = todayIso(); refresh(); } }, 60000);
