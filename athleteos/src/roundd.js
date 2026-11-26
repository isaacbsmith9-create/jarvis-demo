// ===================== Hub Round D: 60-second morning routine + daily defense with Owen =====================
// Morning: one card (until noon, or from the Check-in shortcut) with 3 steps:
//   1. Check-in: sleep hours, energy 1–5, soreness 1–5, mood 1–5 → rl-check.days[today] (source "hub"),
//      rl-sleep.nights[today].asleepH, and day-*.feel {sleepH, energy, sore} (same fields Recovery Lens/Athlete OS use).
//   2. Today: the plan (wpDay), schedule (tdItems) and what's due.
//   3. Top 3 for today: Gameplan tasks with top = today (same data Gameplan uses).
// Defense: a daily habit "Defense with Owen" (habit with def: true, added to hub-habits once by hand), done when a workout named defense/Owen is logged or you tap
// it; shown on Right now in the afternoon (not game days, not with pain) with a 35-min drill list; in the morning brief.
const RD_DEF = [['Stance + slide ladder', '3 × 30 s, low and wide, no crossing feet'], ['Mirror drill with Owen', '3 × 20 s, he leads, you stay in front'], ['Closeouts', '3 × 6, sprint, chop feet, high hand, contest'], ['Zig-zag full court', '4 trips, Owen dribbles, you turn him'], ['1-on-1 from the wing', '10 live possessions each, 3 dribbles max'], ['Deny the wing', '3 × 6, stay between him and the ball']];
let rdOpen = false, rdStep = 1, rdDefShow = false;
const rdDone = (d = todayIso()) => !!doc('rl-check')?.days?.[d];
// ---------- defense habit ----------
const rdDefHab = () => hbDoc().list.find((h) => h.def);
{ const _hd = hbDone; hbDone = function (h, d) { if (h?.def && (hubSafe(() => exList(d), []) || []).some((x) => /defen|owen/i.test(x.name || ''))) return true; return _hd(h, d); }; }
CAP_TRAIN.defense = 'skill'; CAP_TRAIN.defensive = 'skill';
{ const _g = capGuess; capGuess = function (raw) { const s = raw.toLowerCase(), w = capWhen(raw);
  if (/defen/.test(s) && !(w.date && w.date > todayIso()) && /\d+\s*(m|min|mins|minutes|h|hr|hrs|hour|hours)\b/.test(s)) { const g = r1Done(raw, w); return { ...g, type: 'skill', title: /owen/.test(s) ? 'Defense with Owen' : 'Defense workout' }; }
  return _g(raw); }; }
function rdDefCard() {
  return `<div class="rd-def"><p class="small" style="margin:0 0 6px"><b>🛡️ Defense with Owen · ~35 min</b></p><ol>${RD_DEF.map(([a, b]) => `<li><b>${esc(a)}</b> <span class="muted">${esc(b)}</span></li>`).join('')}</ol><div class="row" style="gap:6px"><button type="button" class="btn sm primary" data-rd="defdone">Done today</button><button type="button" class="btn sm" data-rd="deflog">Log minutes</button></div></div>`;
}
{ const _now = r3Now; r3Now = function () { const L = _now(); try { const t = todayIso(), h = new Date().getHours(), H = rdDefHab(), x = hubSafe(() => wpDay(t), null), S = hubSafe(() => rbSore(t), { pain: [] });
  if (H && !hbDone(H, t) && h >= 13 && h < 21 && x?.kind !== 'game' && !S.pain.length && x?.level !== 'rest') L.push({ score: 83, title: 'Defense workout with Owen (~35 min)', why: 'Slides, mirror, closeouts, zig-zag, live 1-on-1. Your daily defense habit.', act: 'def' });
  } catch {} return L.sort((a, b) => b.score - a.score); }; }
{ const _card = r3NowCard; r3NowCard = function () { let h = _card(); if (/Defense workout with Owen/.test(h)) { const btn = `<button type="button" class="btn sm" data-rd="defshow">${rdDefShow ? 'Hide drills' : '🛡️ Show drills'}</button>`; h = h.replace('<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">', `<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">${btn}`); if (rdDefShow) { const i = h.indexOf('<div class="rb-row'); h = i > 0 ? h.slice(0, i) + rdDefCard() + h.slice(i) : h; } } return h; }; }
{ const _bf = briefFor; briefFor = function (date) { const B = _bf(date); try { const x = wpDay(date), H = rdDefHab(); if (H && x?.kind !== 'game' && x?.level !== 'rest') { const j = B.lines.findIndex((l) => l.startsWith('🍗')); B.lines.splice(j < 0 ? B.lines.length : j, 0, '🛡️ Defense with Owen: ~35 min'); B.text = B.lines.join('\n'); } } catch {} return B; }; window.Ecosystem = { ...(window.Ecosystem || {}), brief: briefFor }; }

// ---------- morning routine ----------
const rdDraft = { sleep: null, energy: null, sore: null, mood: null };
const rdPick = (k, n, labels) => `<div class="rd-pick" role="group" aria-label="${k}">${Array.from({ length: n }, (_, i) => i + 1).map((v) => `<button type="button" class="${rdDraft[k] === v ? 'on' : ''}" data-rdv="${k}" data-v="${v}">${v}${labels ? `<small>${labels[v - 1]}</small>` : ''}</button>`).join('')}</div>`;
function rdCard() {
  const t = todayIso(), done = rdDone(t), h = new Date().getHours();
  if (!rdOpen && (h >= 12 || done)) return done && h < 12 ? `<section class="card rd-card rd-mini"><span>☀️ Morning done ✓</span><button type="button" class="btn sm ghost" data-rd="open">Open</button></section>` : '';
  if (done && rdStep === 1) rdStep = 2;
  const steps = ['Check-in', 'Today', 'Top 3'];
  let body = '';
  if (rdStep === 1) {
    const sl = rdDraft.sleep ?? (hubSafe(() => hpSleepNight(t), null) ?? '');
    body = `<label class="rd-l">Hours of sleep<input id="rd-sleep" type="number" step="0.25" min="0" max="14" inputmode="decimal" value="${sl}" placeholder="8"></label>
      <p class="rd-l">Energy</p>${rdPick('energy', 5, ['dead', 'low', 'ok', 'good', 'great'])}
      <p class="rd-l">Soreness</p>${rdPick('sore', 5, ['none', 'a bit', 'some', 'sore', 'very'])}
      <p class="rd-l">Mood</p>${rdPick('mood', 5, ['bad', 'meh', 'ok', 'good', 'great'])}
      <p class="tiny muted" style="margin:8px 0 0">Sore in one spot? Log the area in Recovery Lens too, so training adjusts.</p>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn primary" data-rd="save">Next →</button></div>`;
  } else if (rdStep === 2) {
    const x = hubSafe(() => wpDay(t), null), its = (hubSafe(() => tdItems(t), []) || []).slice(0, 6), due = hubSafe(() => scDue(t, t), []) || [], rd = hubSafe(() => hpReady(t), null);
    body = `${rd != null ? `<p class="small" style="margin:0">Readiness <b>${rd}</b></p>` : ''}${x ? `<p class="small" style="margin:6px 0 0">📅 <b>${WP_LEVEL[x.level]?.[0] || ''}</b> · ${esc(x.focus)}</p>` : ''}
      <ul class="r3-list" style="margin-top:8px">${its.length ? its.map((i) => `<li><b style="min-width:62px">${tdClock(i.st)}</b>${esc(i.title)}</li>`).join('') : '<li class="muted">Nothing scheduled</li>'}</ul>
      ${due.length ? `<p class="small" style="margin:8px 0 0">📚 Due: ${due.map((d) => esc(d.title)).join(' · ')}</p>` : ''}
      <div class="row" style="justify-content:space-between;margin-top:10px"><button type="button" class="btn sm" data-rd="back">← Back</button><button type="button" class="btn primary" data-rd="next">Next →</button></div>`;
  } else {
    const C = doc('gp-core'), top = (C?.tasks || []).filter((x) => x.top === t && !x.done), open = (C?.tasks || []).filter((x) => !x.done && x.top !== t).slice(0, 8);
    body = `<ul class="r3-list">${top.map((x) => `<li class="on"><button type="button" class="r3-star on" data-rdtop="${x.id}">★</button>${esc(x.title)}</li>`).join('')}${top.length < 3 ? open.map((x) => `<li><button type="button" class="r3-star" data-rdtop="${x.id}">☆</button>${esc(x.title)}</li>`).join('') : ''}</ul>
      ${top.length < 3 ? '<form id="rd-add" class="r3-add"><input id="rd-new" type="text" maxlength="60" placeholder="Something for today" aria-label="New task for today"><button class="btn sm" type="submit">Add</button></form>' : ''}
      <div class="row" style="justify-content:space-between;margin-top:10px"><button type="button" class="btn sm" data-rd="back">← Back</button><button type="button" class="btn primary" data-rd="finish">Done ✓</button></div>`;
  }
  return `<section class="card rd-card"><div class="row" style="justify-content:space-between"><h3>☀️ Morning · 60 seconds</h3><span class="tiny muted">${rdStep}/3</span></div>
    <div class="rd-steps">${steps.map((s, i) => `<span class="${i + 1 === rdStep ? 'on' : i + 1 < rdStep ? 'done' : ''}">${s}</span>`).join('')}</div>${body}</section>`;
}
function rdSave() {
  const t = todayIso(), sl = Number($('#rd-sleep')?.value); if (!(sl > 0) || !rdDraft.energy || !rdDraft.sore) return toast('Add sleep, energy and soreness');
  rdDraft.sleep = sl;
  const C = doc('rl-check') || (cache['rl-check'] = { days: {} }); C.days = C.days || {}; C.days[t] = { ...(C.days[t] || {}), energy: rdDraft.energy, sore: rdDraft.sore, ...(rdDraft.mood ? { mood: rdDraft.mood } : {}), at: Date.now(), createdAt: C.days[t]?.createdAt || Date.now(), source: 'hub' }; persist('rl-check');
  const S = doc('rl-sleep') || (cache['rl-sleep'] = { nights: {}, routineLog: {} }); S.nights = S.nights || {}; S.nights[t] = { ...(S.nights[t] || {}), asleepH: sl, source: S.nights[t]?.source || 'Hub' }; persist('rl-sleep');
  const d = dayDoc(t, true); d.feel = { ...(d.feel || {}), sleepH: sl, energy: rdDraft.energy, sore: rdDraft.sore }; persist('day-' + t);
  rdStep = 2; rdOpen = true; refresh();
}
function rdTop(id) { const C = r3Core(), x = (C.tasks || []).find((y) => y.id === id), t = todayIso(); if (!x) return; if (x.top === t) x.top = null; else { if ((C.tasks || []).filter((y) => y.top === t && !y.done).length >= 3) return toast('Top 3 is full'); x.top = t; } persist('gp-core'); refresh(); }
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => { const c = rdCard(); if (!c) return; (el.querySelector('.hsc-bar') || el.querySelector('.hub-head'))?.insertAdjacentHTML('afterend', c); }); }; }
RC_SC.checkin = ['☀️', 'Morning', () => { rdOpen = true; rdStep = rdDone() ? 2 : 1; go('hub', 'today'); setTimeout(() => document.querySelector('.rd-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); }];
document.addEventListener('click', (e) => {
  const v = e.target.closest('[data-rdv]'); if (v) { const s = $('#rd-sleep'); if (s) rdDraft.sleep = Number(s.value) || rdDraft.sleep; rdDraft[v.dataset.rdv] = +v.dataset.v; rdOpen = true; return refresh(); }
  const tp = e.target.closest('[data-rdtop]'); if (tp) return rdTop(tp.dataset.rdtop);
  const b = e.target.closest('[data-rd]'); if (!b) return; const k = b.dataset.rd;
  if (k === 'save') return rdSave();
  if (k === 'next') { rdStep = 3; return refresh(); } if (k === 'back') { rdStep = Math.max(1, rdStep - 1); return refresh(); }
  if (k === 'finish') { rdOpen = false; rdStep = 1; hubSafe(() => saveBrief()); toast('Morning done. Go get it.'); return refresh(); }
  if (k === 'open') { rdOpen = true; rdStep = 2; return refresh(); }
  if (k === 'defshow') { rdDefShow = !rdDefShow; return refresh(); }
  if (k === 'defdone') { const H = rdDefHab(); if (H && !hbDone(H, todayIso())) hbToggle(H.id); rdDefShow = false; toast('Defense done 🛡️'); return refresh(); }
  if (k === 'deflog') { const i = $('#cap-in'); if (i) { i.value = 'defense with Owen 35 min'; $('#cap-f')?.requestSubmit(); } }
});
document.addEventListener('submit', (e) => { if (e.target.id !== 'rd-add') return; e.preventDefault(); const tt = ($('#rd-new')?.value || '').trim(); if (!tt) return; const C = r3Core(), t = todayIso(); C.tasks = [...(C.tasks || []), { id: uid('t'), title: tt.slice(0, 60), u: true, i: true, due: t, done: false, top: (C.tasks || []).filter((y) => y.top === t && !y.done).length < 3 ? t : null, created: Date.now() }]; persist('gp-core'); refresh(); });
