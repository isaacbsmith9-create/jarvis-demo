// ===================== Hub: Habit Builder =====================
// Pick 3–6 daily habits. "Auto" habits check themselves from data the apps already log; the rest you tap.
// Doc "hub-habits" { v, list: [{ id, name, icon, auto }], log: { date: { habitId: true } } } — log holds manual checks only.
// Shown as a "Habits" card on Hub Today and a Habits tab (28-day grid, streaks). The evening recap adds "✅ Habits x/y".
SUBS.hub.splice(SUBS.hub.findIndex((s) => s[0] === 'goals'), 0, ['habits', 'Habits']);
const HB_AUTO = {
  makes100: ['100 makes', '🏀', (d) => sum(exList(d).map((x) => +x.btc?.makes || 0)) >= 100, 'Counts makes you log (Training Center or quick add)'],
  shots200: ['200 shots', '🎯', (d) => sum(exList(d).map((x) => +(x.btc?.shots ?? x.btc?.attempts) || 0)) >= 200, 'Counts every shot you log'],
  train: ['Train', '💪', (d) => exList(d).length > 0 || hubSafe(() => wpDay(d)?.level === 'rest', false), 'Any workout logged (planned rest days count)'],
  protein: ['Hit protein', '🍗', (d) => hasFood(d) && totalsOf(d).protein >= targets(d).protein, 'Protein target from MacroLens'],
  water: ['Water goal', '💧', (d) => waterOf(d) >= (targets(d).waterOz || 100), 'Water you log in MacroLens or the Hub'],
  sleep8: ['8 h sleep', '😴', (d) => (hubSafe(() => hpSleepNight(d), null) ?? 0) >= 8, 'Last night’s sleep from Recovery Lens'],
  checkin: ['Morning check-in', '☀️', (d) => !!(doc('rl-check')?.days?.[d] || doc('rl-ready')?.days?.[d]), 'Recovery Lens check-in'],
  night: ['Night routine', '🌙', (d) => !!doc('gp-d-' + d)?.night?.completedAt, 'Night shutdown checklist done'],
  homework: ['Homework done', '📚', (d) => { const it = (doc('life-school')?.items || []).filter((x) => x.due === d); return it.length > 0 && it.every((x) => x.done); }, 'Everything due that day marked done in Student Lens'],
  score70: ['Score 70+', '🔥', (d) => (hubSafe(() => r2Score(d).score, 0) ?? 0) >= 70, 'Daily score of 70 or more'],
};
const HB_MANUAL = [['Stretch 10 min', '🧘'], ['Ball handling 15 min', '🏀'], ['Read 10 min', '📖'], ['No phone after 10 PM', '📵'], ['Visualize 5 min', '🧠'], ['Free throws: 50', '🎯'], ['Core 10 min', '🔥'], ['Journal 3 wins', '✍️']];
const hbDoc = () => doc('hub-habits') || (cache['hub-habits'] = { v: 1, list: [], log: {} });
function hbDone(h, d) { if (h.auto && HB_AUTO[h.auto]) return !!hubSafe(() => HB_AUTO[h.auto][2](d), false); return !!hbDoc().log?.[d]?.[h.id]; }
function hbStreak(h) { let n = 0, d = todayIso(); if (!hbDone(h, d)) d = shiftIso(d, -1); for (let i = 0; i < 366 && hbDone(h, d); i++, d = shiftIso(d, -1)) n++; return n; }
function hbBest(h) { let best = 0, run = 0; for (let i = 89; i >= 0; i--) { if (hbDone(h, shiftIso(todayIso(), -i))) best = Math.max(best, ++run); else run = 0; } return best; }
function hbAdd(h) { const D = hbDoc(); if (D.list.length >= 8) return toast('8 habits max. Fewer habits stick better.'); if (D.list.some((x) => (h.auto && x.auto === h.auto) || x.name.toLowerCase() === h.name.toLowerCase())) return toast('Already in your habits'); D.list.push({ id: 'h' + Date.now().toString(36), ...h }); persist('hub-habits'); refresh(); }
function hbToggle(id, d = todayIso()) { const D = hbDoc(), h = D.list.find((x) => x.id === id); if (!h || h.auto) return; D.log = D.log || {}; const L = (D.log[d] = D.log[d] || {}); if (L[id]) delete L[id]; else L[id] = true; for (const k of Object.keys(D.log)) if (k < shiftIso(todayIso(), -120)) delete D.log[k]; persist('hub-habits'); refresh(); }
const hbRow = (h, d = todayIso()) => { const ok = hbDone(h, d), st = hbStreak(h); return `<li class="${ok ? 'on' : ''}"><button type="button" class="hab-check" ${h.auto ? 'disabled title="Checks itself"' : `data-hab="${h.id}"`} aria-label="${esc(h.name)}${ok ? ' done' : ''}">${ok ? '✓' : ''}</button><span class="hab-n">${h.icon || '•'} ${esc(h.name)}${h.auto ? ' <small>auto</small>' : ''}</span><span class="hab-st">${st ? `🔥 ${st}` : ''}</span></li>`; };
function hbCard() {
  const L = hbDoc().list; if (!L.length) return `<section class="card hab-card"><h3>Habits</h3><p class="small muted" style="margin:4px 0 10px">Pick 3–5 daily habits. Most check themselves from what you already log.</p><button type="button" class="btn primary" data-habgo>Pick habits</button></section>`;
  const n = L.filter((h) => hbDone(h, todayIso())).length;
  return `<section class="card hab-card"><div class="row" style="justify-content:space-between"><h3>Habits</h3><span class="tag">${n}/${L.length} today</span></div><ul class="hab-list">${L.map((h) => hbRow(h)).join('')}</ul><button type="button" class="btn sm ghost" data-habgo style="margin-top:6px">See streaks</button></section>`;
}
HUB.habits = (el) => {
  const D = hbDoc(), L = D.list, days = []; for (let i = 27; i >= 0; i--) days.push(shiftIso(todayIso(), -i));
  const autoOpts = Object.entries(HB_AUTO).filter(([k]) => !L.some((h) => h.auto === k)), manOpts = HB_MANUAL.filter(([n]) => !L.some((h) => h.name === n));
  el.innerHTML = `<section class="hub-head"><h1>Habits</h1><p class="hub-sum">Small things every day. Auto habits check themselves; tap the others. Keep it to 3–6.</p></section>
    ${L.length ? `<section class="card"><ul class="hab-full">${L.map((h, i) => `<li><div class="row" style="justify-content:space-between;gap:8px"><b>${h.icon || '•'} ${esc(h.name)}${h.auto ? ' <small class="muted">auto</small>' : ''}</b><span class="small">🔥 ${hbStreak(h)} · best ${hbBest(h)}</span></div>
      <div class="hab-grid" aria-label="Last 28 days">${days.map((d) => `<span class="${hbDone(h, d) ? 'on' : ''}${d === todayIso() ? ' now' : ''}" title="${fmtD(d)}"></span>`).join('')}</div>
      ${h.auto ? `<p class="tiny muted" style="margin:4px 0 0">${esc(HB_AUTO[h.auto]?.[3] || '')}</p>` : ''}
      <div class="row" style="gap:6px;margin-top:6px">${h.auto ? '' : `<button type="button" class="btn sm" data-hab="${h.id}">${hbDone(h, todayIso()) ? 'Undo today' : 'Done today'}</button>`}<button type="button" class="btn sm" data-habmv="${i}" data-d="-1"${i ? '' : ' disabled'}>↑</button><button type="button" class="btn sm" data-habrm="${h.id}">Remove</button></div></li>`).join('')}</ul></section>` : ''}
    <section class="card"><h3>Add a habit</h3><p class="tiny muted" style="margin:2px 0 8px">Auto (checks itself)</p><div class="hab-add">${autoOpts.map(([k, v]) => `<button type="button" class="chip" data-habauto="${k}">${v[1]} ${esc(v[0])}</button>`).join('') || '<span class="tiny muted">All added</span>'}</div>
      <p class="tiny muted" style="margin:12px 0 8px">You check it</p><div class="hab-add">${manOpts.map(([n, ic]) => `<button type="button" class="chip" data-habman="${esc(n)}" data-ic="${ic}">${ic} ${esc(n)}</button>`).join('')}</div>
      <form id="hab-new" class="r3-add" style="margin-top:12px"><input id="hab-name" type="text" maxlength="40" placeholder="Your own habit, e.g. 30 pushups" aria-label="New habit"><button class="btn sm" type="submit">Add</button></form></section>`;
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-hab]'); if (t) return hbToggle(t.dataset.hab);
  if (e.target.closest('[data-habgo]')) return go('hub', 'habits');
  const a = e.target.closest('[data-habauto]'); if (a) { const v = HB_AUTO[a.dataset.habauto]; return hbAdd({ name: v[0], icon: v[1], auto: a.dataset.habauto }); }
  const m = e.target.closest('[data-habman]'); if (m) return hbAdd({ name: m.dataset.habman, icon: m.dataset.ic, auto: null });
  const r = e.target.closest('[data-habrm]'); if (r) { const D = hbDoc(); D.list = D.list.filter((h) => h.id !== r.dataset.habrm); persist('hub-habits'); return refresh(); }
  const mv = e.target.closest('[data-habmv]'); if (mv) { const D = hbDoc(), i = +mv.dataset.habmv; if (i > 0) { [D.list[i - 1], D.list[i]] = [D.list[i], D.list[i - 1]]; persist('hub-habits'); refresh(); } }
});
document.addEventListener('submit', (e) => { if (e.target.id !== 'hab-new') return; e.preventDefault(); const n = ($('#hab-name')?.value || '').trim(); if (n) hbAdd({ name: n.slice(0, 40), icon: '⭐', auto: null }); });
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => { const at = el.querySelector('.r2-score') || el.querySelector('.r3-now') || el.querySelector('.hub-head'); at?.insertAdjacentHTML('afterend', hbCard()); }); }; }
{ const _rc = r3Recap; r3Recap = function (t = todayIso()) { const R = _rc(t); try { const L = hbDoc().list; if (L.length) { R.lines.splice(R.lines.length - 1, 0, `✅ Habits ${L.filter((h) => hbDone(h, t)).length}/${L.length}${L.filter((h) => !hbDone(h, t)).length ? ' · left: ' + L.filter((h) => !hbDone(h, t)).map((h) => h.name).slice(0, 3).join(', ') : ''}`); R.text = R.lines.join('\n'); } } catch {} return R; }; }
window.Ecosystem = { ...(window.Ecosystem || {}), habits: { list: () => hbDoc().list, done: hbDone } };
