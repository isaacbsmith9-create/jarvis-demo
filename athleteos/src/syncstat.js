// ===================== Hub: sync status =====================
// One card on Hub Today: when each app last sent data to the Hub. A gap (more than 3 days) shows as a warning, so a
// workout or check-in logged in an old standalone copy (which can't reach the Hub) gets noticed the same week.
function syncRows() {
  const t = todayIso(), sig = hubSafe(() => appSignals(), []) || [];
  const lastDay = (f) => { const ks = allDayKeys().filter((d) => d <= t); for (let i = ks.length - 1; i >= 0; i--) if (hubSafe(() => f(ks[i]), false)) return ks[i]; return null; };
  const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
  const extra = { btc: lastDay((d) => btcOn(d).length), ml: lastDay((d) => hasFood(d)), aos: lastDay((d) => exList(d).some((x) => !x.source || x.source === 'athlete-os')) };
  return sig.map((s) => {
    const upd = later(s.updated, extra[s.app] || null), age = upd ? daysBetween(upd, t) : null;
    return { ...s, upd, age, warn: age == null || age > 3 };
  });
}
function syncCardHtml() {
  const rows = syncRows(); if (!rows.length) return '';
  const lbl = (a) => (a == null ? 'Nothing yet' : a === 0 ? 'Today' : a === 1 ? 'Yesterday' : `${a} days ago`);
  const bad = rows.filter((r) => r.warn).length;
  return `<section class="card sync-card"><div class="row" style="justify-content:space-between"><h3>Sync status</h3><span class="tag ${bad ? 'warn' : ''}">${bad ? `${bad} quiet` : 'All synced'}</span></div>
    <ul class="sync-list">${rows.map((r) => `<li style="--c:${r.color}"><i></i><b>${esc(r.name)}</b><span class="${r.warn ? 'sync-warn' : 'muted'}">${lbl(r.age)}</span>${r.href ? `<a class="btn sm" href="${r.href}">Open</a>` : ''}</li>`).join('')}</ul>
    <p class="tiny muted" style="margin:8px 0 0">Log everything from the Hub's own copies (the app switcher). Old standalone apps can't send data here.</p></section>`;
}
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => { const b = el.querySelector('.hub-brief, .hb'); const at = b ? b.closest('section') : el.querySelector('.hub-head'); (at || el.firstElementChild)?.insertAdjacentHTML('afterend', syncCardHtml()); }); }; }
window.Ecosystem = { ...(window.Ecosystem || {}), sync: syncRows };
