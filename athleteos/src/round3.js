// ===================== Hub Round 3: right now · night shutdown · end-of-day recap =====================
// Right now: one card that picks the single next best thing from the clock, today's schedule (tdItems), what's due,
// protein, the daily score and readiness — rule-based, with "Ask Claude" for a fuller answer (Ask AI tab).
// Night shutdown (from 8:30 PM, or tap "Night checklist"): bedtime countdown, due tomorrow, tomorrow's Top 3 and the
// night routine. It uses Gameplan's own data (gp-core.tasks[].top = date, gp-core.routine, gp-d-<night>.night), so
// Gameplan shows the same checks. Tomorrow's Top 3 joins the morning brief.
// Recap: doc "hub-recap" { date, at, lines, text } is rewritten whenever Hub Today shows; the evening scheduled task sends it.
const R3_STEPS = [{ id: 'bag', label: 'Pack bag and lay out clothes' }, { id: 'plan', label: "Plan tomorrow's Top 3" }, { id: 'charge', label: 'Phone on the charger, outside the room' }, { id: 'shower', label: 'Shower' }, { id: 'stretch', label: 'Stretch 5 min' }, { id: 'read', label: 'Read 10 min' }, { id: 'lights', label: 'Lights out' }];
let r3NightOpen = false;
const r3Core = () => doc('gp-core') || (cache['gp-core'] = { tasks: [], routine: { steps: R3_STEPS.map((s) => ({ ...s })), bed: '22:30', wake: '06:45', wind: 45 }, running: null, settings: { phoneGoal: 120 } });
const r3Bed = () => doc('gp-core')?.routine?.bed || '22:30';
const r3NightDate = () => { const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const r3Top = (iso) => (doc('gp-core')?.tasks || []).filter((x) => x.top === iso && !x.done);
const r3Dur = (m) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
const r3Clk = (hhmm) => fmtClock(hhmm);

// ---------- right now ----------
function r3Now() {
  const t = todayIso(), now = nowM(), h = now / 60, its = hubSafe(() => tdItems(t), []) || [], out = [];
  const add = (score, title, why, act) => out.push({ score, title, why, act });
  const cur = its.find((x) => x.st <= now && now < x.st + x.mins && !x.done), next = its.find((x) => x.st > now && !x.done);
  const S = hubSafe(() => r2Score(t), null), rd = hubSafe(() => hpReady(t), null);
  const tg = hubSafe(() => targets(t).protein, 0) || 0, pr = hubSafe(() => (hasFood(t) ? totalsOf(t).protein : 0), 0) || 0, gap = Math.max(0, Math.round(tg - pr));
  const dueT = hubSafe(() => scDue(t, t), []) || [], testsTm = hubSafe(() => hpTestsOn(shiftIso(t, 1)), []) || [];
  const busy = cur && ['school', 'practice', 'game'].includes(cur.type);
  if (busy) add(100, `You're in ${cur.title} until ${tdClock(cur.st + cur.mins)}`, next ? `Then ${next.title} at ${tdClock(next.st)}.` : 'Nothing else planned after.', null);
  const bedM = (() => { const [a, b] = r3Bed().split(':').map(Number); return a * 60 + b + (a < 5 ? 1440 : 0); })();
  if (now >= bedM - 60 || h < 4) add(96, now >= bedM ? 'Lights out. It’s past your bedtime' : `Start winding down: lights out at ${r3Clk(r3Bed())}`, `${r3NightOpen ? '' : 'Open the night checklist below. '}Sleep is 15 points of your score.`, 'night');
  if (next && next.st - now <= 45 && next.st - now > 0) {
    const sport = ['practice', 'game'].includes(next.type) || /practice|game/i.test(next.title);
    add(sport && gap > 30 ? 92 : 80, sport && gap > 30 ? `Eat a snack before ${next.title}` : `Get ready for ${next.title}`, `Starts at ${tdClock(next.st)} (in ${r3Dur(next.st - now)}).${sport && gap > 30 ? ` You’re ${gap} g under protein: shake, yogurt or a sandwich.` : ''}`, null);
  }
  for (const x of dueT.slice(0, 2)) { const c = hubSafe(() => scClass(x.cls), null); add((c?.latePolicy === 'none' ? 90 : 84) - (h < 15 ? 20 : 0), `Finish ${x.title}`, `Due today${c ? ` · ${c.name}` : ''}${c?.latePolicy === 'none' ? ' · no late work' : ''}.`, null); }
  if (testsTm.length && h >= 15) add(86, `Study for ${testsTm[0].title} (30–45 min)`, 'It’s tomorrow. Short focused blocks beat one long cram.', null);
  if (gap > 40 && ((h >= 11 && h < 14) || (h >= 17 && h < 21) || (h >= 6 && h < 9))) add(78, `Eat ~${Math.min(gap, 50)} g of protein`, `${Math.round(pr)} of ${tg} g so far today.`, 'food');
  if (!hubSafe(() => exList(t).length, 0) && h >= 14 && h < 20.5 && !its.some((x) => ['practice', 'game'].includes(x.type) && x.st + x.mins > now - 180)) {
    if (rd != null && rd < 45) add(60, 'Make today a recovery day', `Readiness is ${rd}. Stretch, walk, hydrate, sleep early.`, null);
    else add(70, 'Get your workout in', `No training logged yet${rd != null ? ` and readiness is ${rd}` : ''}. Even 30 min of shooting counts (25 points).`, 'train');
  }
  if (!S?.parts?.checkin && h < 12) add(75, 'Do your morning check-in', '30 seconds in Recovery Lens. It sets your readiness.', 'checkin');
  const ac = hubSafe(() => actionCandidates(t)[0], null); if (ac) add(Math.min(68, ac.score), ac.title, ac.why || '', null);
  if (!out.length) add(10, next ? `Free until ${next.title} at ${tdClock(next.st)}` : 'You’re clear', 'Nothing urgent. Good time for extra shooting, reading or rest.', null);
  return out.sort((a, b) => b.score - a.score);
}
function r3NowCard() {
  const L = r3Now(), a = L[0], b = L.find((x, i) => i > 0 && x.title !== a.title);
  const btn = { night: '<button type="button" class="btn sm" data-r3="night">Night checklist</button>', food: '<button type="button" class="btn sm" data-r3="food">Log food</button>', train: '<a class="btn sm" href="btc.html">Training Center</a>', checkin: '<a class="btn sm" href="recovery.html#morning">Check in</a>' }[a.act] || '';
  return `<section class="card r3-now"><div class="row" style="justify-content:space-between;gap:8px"><span class="tiny muted">RIGHT NOW · ${tdClock(nowM())}</span>${a.act === 'night' || r3NightOpen ? '' : '<button type="button" class="btn sm ghost" data-r3="night">🌙 Night checklist</button>'}</div>
    <h3 class="r3-title">${esc(a.title)}</h3><p class="small muted" style="margin:4px 0 0">${esc(a.why)}</p>
    ${b ? `<p class="small" style="margin:8px 0 0"><span class="muted">Then:</span> ${esc(b.title)}</p>` : ''}
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">${btn}${aiOn() ? '<button type="button" class="btn sm" data-r3="ask">✨ Ask Claude</button>' : ''}</div></section>`;
}

// ---------- night shutdown ----------
function r3NightCard() {
  const nd = r3NightDate(), tm = shiftIso(nd, 1), C = doc('gp-core'), steps = C?.routine?.steps?.length ? C.routine.steps : R3_STEPS;
  const N = doc('gp-d-' + nd)?.night?.done || {}, top = r3Top(tm), open = (C?.tasks || []).filter((x) => !x.done && x.top !== tm).slice(0, 8);
  const done = (s) => !!N[s.id] || (s.id === 'plan' && top.length > 0), nDone = steps.filter(done).length;
  const [bh, bm] = r3Bed().split(':').map(Number), bed = new Date(); bed.setHours(bh, bm, 0, 0); if (bh < 5) bed.setDate(bed.getDate() + 1);
  if (new Date().getHours() < 4 && bh >= 5) bed.setDate(bed.getDate() - 1);
  const left = Math.round((bed - Date.now()) / 60000);
  const dueTm = hubSafe(() => scDue(tm, tm), []) || [], first = (hubSafe(() => tdItems(tm), []) || [])[0];
  return `<section class="card r3-night"><div class="row" style="justify-content:space-between"><h3>🌙 Night shutdown</h3><span class="tag">${nDone}/${steps.length}</span></div>
    <div class="r3-bed"><b>${left > 0 ? r3Dur(left) : 'Now'}</b><span>${left > 0 ? `until lights out (${r3Clk(r3Bed())})` : `Lights out was ${r3Clk(r3Bed())}`}</span></div>
    <h4>Due tomorrow</h4>${dueTm.length ? `<ul class="r3-list">${dueTm.map((x) => `<li>${esc(x.title)}<small>${esc(hubSafe(() => scClass(x.cls)?.name, '') || '')}${hubSafe(() => scClass(x.cls)?.latePolicy, '') === 'none' ? ' · no late work' : ''}</small></li>`).join('')}</ul>` : '<p class="small muted">Nothing due tomorrow.</p>'}
    ${first ? `<p class="small" style="margin:6px 0 0">First thing tomorrow: <b>${esc(first.title)}</b> at ${tdClock(first.st)}</p>` : ''}
    <h4>Tomorrow’s Top 3 <span class="tiny muted">${top.length}/3</span></h4>
    <ul class="r3-list">${top.map((x) => `<li class="on"><button type="button" class="r3-star on" data-r3top="${x.id}" aria-label="Remove from Top 3">★</button>${esc(x.title)}</li>`).join('')}
      ${top.length < 3 ? open.map((x) => `<li><button type="button" class="r3-star" data-r3top="${x.id}" aria-label="Add to Top 3">☆</button>${esc(x.title)}</li>`).join('') : ''}</ul>
    ${top.length < 3 ? `<form id="r3-add" class="r3-add"><input id="r3-new" type="text" maxlength="60" placeholder="New task for tomorrow" aria-label="New task for tomorrow"><button class="btn sm" type="submit">Add</button></form>` : ''}
    <h4>Routine</h4><ul class="r3-steps">${steps.map((s) => `<li><label><input type="checkbox" data-r3step="${esc(s.id)}"${done(s) ? ' checked' : ''}${s.id === 'plan' ? ' disabled' : ''}> ${esc(s.label)}</label></li>`).join('')}</ul>
    <p class="tiny muted" style="margin:6px 0 0">Same checklist as Gameplan’s Night tab. Your Top 3 goes into tomorrow’s 8:15 text.</p></section>`;
}
function r3StarToggle(id) {
  const C = r3Core(), tm = shiftIso(r3NightDate(), 1), x = (C.tasks || []).find((y) => y.id === id); if (!x) return;
  if (x.top === tm) x.top = null; else { if (r3Top(tm).length >= 3) return toast('Top 3 is full. Remove one first.'); x.top = tm; }
  persist('gp-core'); r3AfterNight();
}
function r3AddTask(title) {
  title = String(title || '').trim(); if (!title) return; const C = r3Core(), tm = shiftIso(r3NightDate(), 1);
  C.tasks = [...(C.tasks || []), { id: uid('t'), title: title.slice(0, 60), u: false, i: true, due: '', done: false, top: r3Top(tm).length < 3 ? tm : null, created: Date.now() }];
  persist('gp-core'); r3AfterNight();
}
function r3Step(id, on) {
  const nd = r3NightDate(), k = 'gp-d-' + nd, d = doc(k) || (cache[k] = { blocks: [], entries: [], night: { done: {}, completedAt: null } });
  d.night = d.night || { done: {}, completedAt: null }; d.night.done = d.night.done || {}; d.night.done[id] = on;
  const C = doc('gp-core'), steps = C?.routine?.steps?.length ? C.routine.steps : R3_STEPS, tm = shiftIso(nd, 1);
  const all = steps.every((s) => d.night.done[s.id] || (s.id === 'plan' && r3Top(tm).length)); d.night.completedAt = all ? Date.now() : null;
  persist(k); if (all) toast('Night routine done. Sleep well 🌙'); r3AfterNight();
}
function r3AfterNight() { hubSafe(() => saveBrief()); refresh(); }
// Tomorrow's Top 3 joins the morning brief (and so the 8:15 text).
{ const _bf = briefFor; briefFor = function (date) { const B = _bf(date); try { const top = r3Top(date).map((x) => x.title); if (top.length) { const i = B.lines.findIndex((l) => l.startsWith('👉')); B.lines.splice(i < 0 ? B.lines.length : i, 0, `⭐ Top 3: ${top.join(' · ')}`); B.text = B.lines.join('\n'); } } catch {} return B; };
  window.Ecosystem = { ...(window.Ecosystem || {}), brief: briefFor }; }

// ---------- end-of-day recap ----------
function r3Recap(t = todayIso()) {
  const S = hubSafe(() => r2Score(t), null), st = hubSafe(() => r2Streak(), 0), ex = hubSafe(() => exList(t), []) || [], tm = shiftIso(t, 1);
  const tg = hubSafe(() => targets(t).protein, 0) || 0, pr = Math.round(hubSafe(() => (hasFood(t) ? totalsOf(t).protein : 0), 0) || 0);
  const open = (hubSafe(() => scDue(t, tm), []) || []).map((x) => `${x.title}${x.due === tm ? ' (tomorrow)' : ''}`);
  const top = r3Top(tm).map((x) => x.title), first = (hubSafe(() => tdItems(tm), []) || [])[0];
  const lines = [
    `${DOW[parseIso(t).getDay()]} ${fmtD(t)} recap · Score ${S?.score ?? '—'}/100${st ? ` · 🔥 ${st}` : ''}`,
    `🏋️ ${ex.length ? ex.map((x) => `${x.name || x.type} ${x.mins} min`).slice(0, 3).join(' · ') : 'No training logged'}`,
    `🍗 Protein ${pr}/${tg} g${tg && pr < tg ? ` (${tg - pr} g short)` : tg ? ' ✓' : ''}`,
    `📚 ${open.length ? 'Still open: ' + open.slice(0, 4).join(' · ') : 'Nothing open for school'}`,
    `🌙 ${top.length ? 'Top 3 set' : 'Set tomorrow’s Top 3'} · lights out ${r3Clk(r3Bed())}${first ? ` · first up ${first.title} ${tdClock(first.st)}` : ''}`,
  ];
  return { date: t, at: Date.now(), lines, text: lines.join('\n') };
}
function r3SaveRecap() { const R = r3Recap(), cur = doc('hub-recap'); if (cur && cur.date === R.date && cur.text === R.text) return; cache['hub-recap'] = R; persist('hub-recap'); }

// ---------- wiring ----------
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => {
  const h = new Date().getHours(), night = r3NightOpen || h >= 20 && new Date().getMinutes() >= (h === 20 ? 30 : 0) || h >= 21 || h < 4;
  const cap = el.querySelector('.cap'); (cap || el.querySelector('.hub-head'))?.insertAdjacentHTML('afterend', r3NowCard() + (night ? r3NightCard() : ''));
  r3SaveRecap(); }); }; }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-r3]');
  if (b) {
    const k = b.dataset.r3;
    if (k === 'night') { r3NightOpen = true; refresh(); setTimeout(() => document.querySelector('.r3-night')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 40); }
    if (k === 'food') { const i = $('#cap-in'); if (i) { i.focus(); i.placeholder = 'What did you eat? e.g. “chicken bowl 45g protein”'; } }
    if (k === 'ask') { const q = `What should I do right now? It's ${tdClock(nowM())}. Give me the next 2–3 things in order with times.`; go('hub', 'ask'); setTimeout(() => { const ta = $('#ask-q'); if (ta) { ta.value = q; $('#ask-f')?.requestSubmit(); } }, 250); }
    return;
  }
  const s = e.target.closest('[data-r3top]'); if (s) r3StarToggle(s.dataset.r3top);
}, true);
document.addEventListener('change', (e) => { const c = e.target.closest?.('[data-r3step]'); if (c) r3Step(c.dataset.r3step, c.checked); });
document.addEventListener('submit', (e) => { if (e.target.id !== 'r3-add') return; e.preventDefault(); r3AddTask($('#r3-new')?.value); });
window.Ecosystem = { ...(window.Ecosystem || {}), now: r3Now, recap: r3Recap };
