// ===================== Hub Round 4: choose and order the cards on Hub Today =====================
// "Customize" on Hub Today opens a list of every card: move it up or down, or hide it. Saved in doc "hub-layout"
// { v, order: [key], hidden: [key] }. Cards added later (new features) appear in their default spot until moved.
// Runs last, so it sees every card the other layers added.
const R4_KEYS = { ac: ['actions', 'Do these today'], cap: ['add', 'Quick add'], 'r3-now': ['now', 'Right now'], 'r3-night': ['night', 'Night shutdown'], 'r2-tpl': ['templates', 'Load a day'], 'r2-score': ['score', 'Daily score'], hb: ['brief', 'Morning briefing'], 'sync-card': ['sync', 'Sync status'], 'wp-card': ['weekplan', 'Plan the week (weekends)'] };
let r4Cards = [];
const r4Lay = () => doc('hub-layout') || { v: 1, order: [], hidden: [] };
function r4Key(c) {
  for (const k of Object.keys(R4_KEYS)) if (c.classList.contains(k)) return R4_KEYS[k];
  if (c.querySelector(':scope > .hub-apps, .hub-apps')) return ['apps', 'Your apps'];
  const h = (c.querySelector('h1,h2,h3')?.textContent || '').trim();
  return h ? ['h:' + h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), h] : null;
}
function r4Apply(el) {
  const head = el.querySelector('.hub-head'); if (!head) return;
  const host = head.parentElement, cards = [...host.children].filter((c) => c !== head).map((c) => ({ c, k: r4Key(c) })).filter((x) => x.k);
  r4Cards = cards.map(({ k }) => ({ key: k[0], label: k[1] }));
  const L = r4Lay(), def = cards.map((x) => x.k[0]), order = (L.order || []).filter((k) => def.includes(k));
  def.forEach((k, i) => { if (!order.includes(k)) order.splice(Math.min(i, order.length), 0, k); });
  let ref = head;
  for (const k of order) { const x = cards.find((y) => y.k[0] === k); if (!x) continue; ref.after(x.c); ref = x.c; x.c.hidden = (L.hidden || []).includes(k); }
  r4Cards.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  if (!head.querySelector('#r4-btn')) head.insertAdjacentHTML('beforeend', `<button type="button" class="btn sm r4-btn" id="r4-btn">⚙︎ Customize${(L.hidden || []).filter((k) => def.includes(k)).length ? ` · ${(L.hidden || []).filter((k) => def.includes(k)).length} hidden` : ''}</button>`);
}
function r4SheetHtml() {
  const L = r4Lay(), hid = new Set(L.hidden || []), n = r4Cards.length;
  return `<p class="small muted" style="margin:0 0 10px">Move cards up or down, or turn them off. New cards show up in their usual spot.</p>
    <ul class="r4-list">${r4Cards.map((c, i) => `<li class="${hid.has(c.key) ? 'off' : ''}"><label><input type="checkbox" data-r4show="${esc(c.key)}"${hid.has(c.key) ? '' : ' checked'}> ${esc(c.label)}</label>
      <button type="button" class="btn sm" data-r4mv="${esc(c.key)}" data-d="-1"${i ? '' : ' disabled'} aria-label="Move ${esc(c.label)} up">↑</button><button type="button" class="btn sm" data-r4mv="${esc(c.key)}" data-d="1"${i < n - 1 ? '' : ' disabled'} aria-label="Move ${esc(c.label)} down">↓</button></li>`).join('')}</ul>
    <div class="row" style="justify-content:space-between;margin-top:12px"><button type="button" class="btn sm" id="r4-reset">Reset to default</button><button type="button" class="btn sm primary" data-close>Done</button></div>`;
}
function r4Save(L) { cache['hub-layout'] = { v: 1, order: L.order, hidden: L.hidden }; persist('hub-layout'); }
function r4Open() { openSheet('Customize Hub Today', r4SheetHtml(), () => {}); }
function r4Redraw() { refresh(); setTimeout(() => { const s = document.querySelector('.r4-list'); if (s) s.outerHTML = r4SheetHtml().match(/<ul class="r4-list">[\s\S]*<\/ul>/)[0]; }, 30); }
document.addEventListener('click', (e) => {
  if (e.target.closest('#r4-btn')) { r4Open(); return; }
  const m = e.target.closest('[data-r4mv]');
  if (m) { const L = r4Lay(), keys = r4Cards.map((c) => c.key), i = keys.indexOf(m.dataset.r4mv), j = i + Number(m.dataset.d); if (i < 0 || j < 0 || j >= keys.length) return; [keys[i], keys[j]] = [keys[j], keys[i]]; r4Save({ order: keys, hidden: L.hidden || [] }); r4Redraw(); return; }
  if (e.target.id === 'r4-reset') { r4Save({ order: [], hidden: [] }); r4Redraw(); toast('Back to the default layout'); }
});
document.addEventListener('change', (e) => {
  const c = e.target.closest?.('[data-r4show]'); if (!c) return;
  const L = r4Lay(), hid = new Set(L.hidden || []); if (c.checked) hid.delete(c.dataset.r4show); else hid.add(c.dataset.r4show);
  r4Save({ order: r4Cards.map((x) => x.key), hidden: [...hid] }); r4Redraw();
});
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => r4Apply(el)); }; }
window.Ecosystem = { ...(window.Ecosystem || {}), layout: () => ({ ...r4Lay(), cards: r4Cards }) };
