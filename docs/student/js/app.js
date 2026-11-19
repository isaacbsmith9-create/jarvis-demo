'use strict';
// ===================== boot =====================
(async function boot() {
  $('#brand-mark').innerHTML = icon('graduation-cap', 19); $('#search-ic').innerHTML = icon('search', 17); $('#bell-ic').innerHTML = icon('bell', 18);
  $('#search-btn').onclick = openSearch; $('#bell').onclick = openAlerts;
  try { await loadAll(); } catch (e) { console.error(e); toast('Could not open storage. Changes may not be saved.'); }
  applyTheme();
  expandRecurring(); refreshOverdue();
  render();
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => S.settings.theme === 'system' && applyTheme());
  // Keep countdowns, "today" and overdue status fresh without touching anything you're typing in.
  let lastDay = today();
  setInterval(() => {
    const d = today(); if (d !== lastDay) { lastDay = d; expandRecurring(); refreshOverdue(); }
    if (!modalStack.length && !document.activeElement?.matches?.('input,textarea,select') && ['home', 'exams'].includes(route.name)) { const y = window.scrollY; render(); window.scrollTo(0, y); }
  }, 60000);
  window.addEventListener('beforeunload', () => { if (dirty.size) flushSave(); });
})();
