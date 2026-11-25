// ===================== Hub Round C: auto-logged practices · shortcut bar · voice-only mode =====================
// Auto-log: when a practice / lift / game on the calendar (aos-plan) has ended, it becomes a workout in day-*.exercise
// (source "auto-calendar", autoFrom "<event id>|<date>"). A lift inside a practice's time merges into it. Looks back 3
// days. Skipped: events skipped for that day (Practice canceled), days that already have a workout of that type logged
// some other way, and anything you marked "Didn't go" (doc "hub-autolog" { declined: [key] }).
// Shortcut bar: 4 buttons you choose at the top of Hub Today (doc "hub-shortcuts" { list: [id] }).
// Voice-only: "🎙 Tell me your day" dictates into the quick-add box, then splits it into separate items (Claude when
// available, otherwise by sentence) and previews them one by one.
const RC_TYPE = { practice: ['practice', 'moderate'], lift: ['lift', 'moderate'], game: ['game', 'hard'] };
const rcAuto = () => doc('hub-autolog') || (cache['hub-autolog'] = { v: 1, declined: [] });
const rcMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
function rcEvents(d) {
  const evs = (doc('aos-plan')?.events || []).filter((e) => RC_TYPE[e.type] && e.start && hubSafe(() => occursOn(e, d), e.date === d))
    .map((e) => ({ e, st: rcMin(e.start), en: rcMin(e.start) + (Number(e.mins) || (e.end ? rcMin(e.end) - rcMin(e.start) : 90)) }));
  const prac = evs.filter((x) => x.e.type !== 'lift');
  return evs.filter((x) => !(x.e.type === 'lift' && prac.some((p) => x.st >= p.st && x.en <= p.en)))
    .map((x) => ({ ...x, withLift: x.e.type !== 'lift' && evs.some((l) => l.e.type === 'lift' && l.st >= x.st && l.en <= x.en) }));
}
function rcRun() {
  const t = todayIso(), now = nowM(), A = rcAuto(); let added = 0;
  for (let i = 3; i >= 0; i--) {
    const d = shiftIso(t, -i), list = rcEvents(d); if (!list.length) continue;
    const day = dayDoc(d, true); day.exercise = day.exercise || []; let ch = false;
    for (const x of list) {
      const key = `${x.e.id}|${d}`; if (d === t && x.en > now) continue;
      if ((A.declined || []).includes(key) || day.exercise.some((w) => w.autoFrom === key)) continue;
      const [type, int] = RC_TYPE[x.e.type];
      if (day.exercise.some((w) => w.source !== 'auto-calendar' && (w.type === type || (type === 'practice' && /practice/i.test(w.name || ''))))) continue;
      const name = x.e.title + (x.withLift && !/lift/i.test(x.e.title) ? ' + lift' : ''), mins = x.en - x.st;
      day.exercise.push({ id: 'auto-' + x.e.id + '-' + d, addedAt: Date.now(), type, name, mins, int, kcal: hubSafe(() => exBurn(type, mins, int), null), source: 'auto-calendar', autoFrom: key, time: x.e.start });
      ch = true; added++;
    }
    if (ch) persist('day-' + d);
  }
  return added;
}
function rcToday() { return (dayDoc(todayIso())?.exercise || []).filter((w) => w.source === 'auto-calendar'); }
function rcDecline(key) {
  const A = rcAuto(); A.declined = [...new Set([...(A.declined || []), key])].slice(-200); persist('hub-autolog');
  const d = key.split('|')[1], day = dayDoc(d); if (day) { day.exercise = (day.exercise || []).filter((w) => w.autoFrom !== key); persist('day-' + d); }
  toast('Removed. It won’t be logged again.'); refresh();
}
function rcEffort(key, int) { const d = key.split('|')[1], day = dayDoc(d), w = day?.exercise?.find((x) => x.autoFrom === key); if (!w) return; w.int = int; w.kcal = hubSafe(() => exBurn(w.type, w.mins, int), w.kcal); persist('day-' + d); refresh(); }
function rcRow() {
  const L = rcToday(); if (!L.length) return '';
  return L.map((w) => `<div class="rb-row rc-auto"><span class="small">✅ Auto-logged: <b>${esc(w.name)}</b> · ${w.mins} min</span><select data-rceff="${esc(w.autoFrom)}" aria-label="Effort">${[['light', 'Light'], ['moderate', 'Moderate'], ['hard', 'Hard']].map(([k, l]) => `<option value="${k}"${w.int === k ? ' selected' : ''}>${l}</option>`).join('')}</select><button type="button" class="btn sm" data-rcno="${esc(w.autoFrom)}">Didn’t go</button></div>`).join('');
}

// ---------- shortcut bar ----------
const RC_SC = {
  food: ['🍗', 'Log food', () => rcFocus('What did you eat? e.g. “chicken bowl 45g protein”')],
  shots: ['🏀', 'Log shots', () => rcFocus('e.g. “shot 200 made 130 in 45 min”')],
  water: ['💧', '+16 oz water', () => { const d = dayDoc(todayIso(), true); d.water = (Number(d.water) || 0) + 16; persist('day-' + todayIso()); toast(`Water: ${d.water} oz today`); refresh(); }],
  voice: ['🎙', 'Tell me your day', () => rvStart()],
  checkin: ['☀️', 'Check-in', () => goTo('recovery.html#morning')],
  plan: ['🗓', 'Plan day', () => rcFocus('e.g. “school 8 to 3, practice 3-5:30, homework for an hour, bed 10:30”')],
  week: ['📅', 'Plan week', () => go('hub', 'weekplan')],
  habits: ['✅', 'Habits', () => go('hub', 'habits')],
  ask: ['✨', 'Ask AI', () => go('hub', 'ask')],
  night: ['🌙', 'Night', () => { r3NightOpen = true; refresh(); setTimeout(() => document.querySelector('.r3-night')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 40); }],
  tc: ['🎯', 'Training Center', () => goTo('btc.html')],
};
const rcSc = () => doc('hub-shortcuts')?.list?.filter((k) => RC_SC[k]).slice(0, 4) || ['food', 'shots', 'voice', 'checkin'];
function rcFocus(ph) { const i = $('#cap-in'); if (!i) return; i.placeholder = ph; i.focus(); i.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
function rcBar() { return `<section class="card hsc-bar"><div class="hsc-btns">${rcSc().map((k) => `<button type="button" class="hsc-btn" data-sc="${k}"><span>${RC_SC[k][0]}</span>${esc(RC_SC[k][1])}</button>`).join('')}</div><button type="button" class="hsc-edit" data-scedit aria-label="Choose shortcuts">⋯</button></section>`; }
function rcPick() {
  const cur = rcSc();
  openSheet('Pick 4 shortcuts', `<p class="small muted" style="margin:0 0 10px">These sit at the top of Hub Today. Pick up to 4.</p><div class="hab-add">${Object.entries(RC_SC).map(([k, v]) => `<button type="button" class="chip${cur.includes(k) ? ' on' : ''}" data-scpick="${k}">${v[0]} ${esc(v[1])}</button>`).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn sm primary" data-close>Done</button></div>`, () => {});
}

// ---------- voice-only ----------
let rvMode = false;
async function rvStart() { rvMode = true; const i = $('#cap-in'); if (i) { i.value = ''; i.placeholder = 'Talk: what you ate, trained, what’s due… tap ■ when done'; } await r1MicTap(); }
function rvSplitLocal(t) { return t.split(/\s*(?:[.;!?\n]+|,\s*(?:and\s+)?(?:then|also|plus)\b|\b(?:and then|also|plus|then)\b)\s*/i).map((x) => x.trim()).filter((x) => x.length > 2); }
async function rvSplit(text) {
  if (aiOn()) { try { const r = await askAI(`Split what this athlete said into separate things to log. Each item is one short phrase keeping all numbers, e.g. "chicken and rice 50g protein", "shot 200 made 130 in 45 min", "Spanish quiz Friday", "practice tomorrow 3pm". Keep "X and Y" together when it is one meal. Text: "${text.replace(/"/g, "'")}". Reply JSON only: {"items": ["..."]}`, true); const it = (r?.items || []).map(String).filter((x) => x.trim()); if (it.length) return it; } catch {} }
  return rvSplitLocal(text);
}
window.addEventListener('submit', async (e) => {
  if (!rvMode || e.target.id !== 'cap-f') return; e.preventDefault(); e.stopImmediatePropagation(); rvMode = false;
  const raw = ($('#cap-in')?.value || '').trim(); if (!raw) return;
  toast('Sorting what you said…'); const parts = await rvSplit(raw);
  const all = parts.map((p) => ({ raw: p, ...capGuess(p) })); capDraft = all.shift(); capQueue = all; refresh(); hubSafe(() => r1Auto());
  if (all.length) toast(`${all.length + 1} things to check. Save or skip each one.`);
}, true);

// ---------- wiring ----------
{ const _today = HUB.today; HUB.today = (el) => { hubSafe(() => rcRun()); _today(el); hubSafe(() => el.querySelector('.hub-head')?.insertAdjacentHTML('afterend', rcBar())); }; }
{ const _card = r3NowCard; r3NowCard = function () { const h = _card(), r = rcRow(); if (!r) return h; const i = h.lastIndexOf('</section>'); return h.slice(0, i) + r + h.slice(i); }; }
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-sc]'); if (s) return RC_SC[s.dataset.sc]?.[2]();
  if (e.target.closest('[data-scedit]')) return rcPick();
  const p = e.target.closest('[data-scpick]');
  if (p) { let L = rcSc(); const k = p.dataset.scpick; L = L.includes(k) ? L.filter((x) => x !== k) : L.length >= 4 ? (toast('4 max. Tap one to remove it first.'), L) : [...L, k]; cache['hub-shortcuts'] = { v: 1, list: L }; persist('hub-shortcuts'); document.querySelectorAll('[data-scpick]').forEach((b) => b.classList.toggle('on', L.includes(b.dataset.scpick))); refresh(); return; }
  const n = e.target.closest('[data-rcno]'); if (n) return rcDecline(n.dataset.rcno);
});
document.addEventListener('change', (e) => { const s = e.target.closest?.('[data-rceff]'); if (s) rcEffort(s.dataset.rceff, s.value); });
window.Ecosystem = { ...(window.Ecosystem || {}), autolog: rcRun, splitVoice: rvSplitLocal };
