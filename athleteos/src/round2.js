// ===================== Hub Round 2: day templates + daily score =====================
// Templates: one tap loads a whole day into the Round 1 plan preview (edit, then add to Gameplan), or saves the day you
// just built as a template. Stored in doc "hub-templates" { v, list: [{ id, name, icon, train, blocks: [{ title, start
// (minutes), mins, type }] }] }; the four built-ins are used until you save your own copy of one.
// Daily score: 0-100 from five parts (trained, protein, schoolwork due today, check-in, sleep), with a streak (days at 70+)
// and 14 days of history. Today's number is saved in doc "hub-score" { days: { date: { score, parts } } } for the recaps.
const R2_BUILTIN = [
  { id: 'school-practice', name: 'School + practice', icon: '🏀', train: 'Practice is your main session. Add 15–20 min of form shooting only if your legs feel good.', blocks: [
    ['School', 480, 420, 'school'], ['Snack', 900, 15, 'meal'], ['Practice', 930, 120, 'practice'], ['Dinner', 1080, 30, 'meal'], ['Homework', 1125, 60, 'focus'], ['Form shooting', 1200, 30, 'train'], ['Lights out', 1350, 30, 'sleep']] },
  { id: 'game', name: 'Game day', icon: '🔥', train: 'No hard training. 15 min of form shots and free throws before the game, nothing after.', blocks: [
    ['School', 480, 420, 'school'], ['Pre-game meal', 930, 30, 'meal'], ['Homework / rest', 975, 60, 'focus'], ['Warm-up', 1080, 30, 'train'], ['Game', 1140, 120, 'practice'], ['Recovery meal', 1275, 30, 'meal'], ['Lights out', 1365, 30, 'sleep']] },
  { id: 'off', name: 'Off day (school)', icon: '💪', train: 'Your best day for a full workout: shooting + finishing, or a lift.', blocks: [
    ['School', 480, 420, 'school'], ['Snack', 915, 15, 'meal'], ['Workout', 960, 75, 'train'], ['Homework', 1050, 90, 'focus'], ['Dinner', 1140, 30, 'meal'], ['Free time', 1200, 60, 'free'], ['Lights out', 1350, 30, 'sleep']] },
  { id: 'weekend', name: 'Weekend', icon: '☀️', train: 'Long skill session in the morning while you’re fresh. Get homework done before evening.', blocks: [
    ['Breakfast', 540, 30, 'meal'], ['Shooting workout', 630, 90, 'train'], ['Lunch', 750, 30, 'meal'], ['Free time', 810, 180, 'free'], ['Homework', 1020, 60, 'focus'], ['Dinner', 1110, 30, 'meal'], ['Lights out', 1380, 30, 'sleep']] },
].map((t) => ({ ...t, builtin: true, blocks: t.blocks.map(([title, start, mins, type]) => ({ title, start, mins, type })) }));
function r2List() {
  const mine = doc('hub-templates')?.list || [];
  return [...R2_BUILTIN.filter((b) => !mine.some((m) => m.id === b.id)).map((b) => ({ ...b })), ...mine].sort((a, b) => (R2_BUILTIN.findIndex((x) => x.id === a.id) + 1 || 99) - (R2_BUILTIN.findIndex((x) => x.id === b.id) + 1 || 99));
}
const r2Day = () => (new Date().getHours() >= 20 ? shiftIso(todayIso(), 1) : todayIso());
function r2Load(id) {
  const t = r2List().find((x) => x.id === id); if (!t) return;
  capQueue = []; capDraft = { raw: '', dest: 'plan', date: r2Day(), blocks: t.blocks.map((b) => ({ ...b })), tpl: { id: t.id, name: t.name, icon: t.icon, train: t.train } };
  refresh(); setTimeout(() => document.querySelector('.cap')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30);
}
function r2SaveTpl(name) {
  r1Read(); const g = capDraft; if (!g || g.dest !== 'plan' || !g.blocks.length) return;
  name = String(name || '').trim().slice(0, 30); if (!name) return toast('Name the template');
  const D = doc('hub-templates') || (cache['hub-templates'] = { v: 1, list: [] }); D.list = D.list || [];
  const same = g.tpl && g.tpl.name === name ? g.tpl.id : (r2List().find((x) => x.name.toLowerCase() === name.toLowerCase())?.id);
  const id = same || 'tpl-' + Date.now().toString(36), prev = r2List().find((x) => x.id === id);
  D.list = [...D.list.filter((x) => x.id !== id), { id, name, icon: prev?.icon || '📋', train: prev?.train || '', blocks: g.blocks.map((b) => ({ title: b.title, start: b.start, mins: b.mins, type: b.type })) }];
  persist('hub-templates'); g.tpl = { id, name, icon: prev?.icon || '📋', train: prev?.train || '' }; toast(`Saved template “${name}”`); refresh();
}
function r2Del(id) {
  const D = doc('hub-templates'); if (!D) return; D.list = (D.list || []).filter((x) => x.id !== id); persist('hub-templates');
  toast(R2_BUILTIN.some((b) => b.id === id) ? 'Back to the original template' : 'Template deleted'); refresh();
}
let r2Edit = false;
function r2Row() {
  const L = r2List();
  return `<section class="card r2-tpl"><div class="row" style="justify-content:space-between"><h3>Load a day</h3><button type="button" class="btn sm" id="r2-edit">${r2Edit ? 'Done' : 'Manage'}</button></div>
    <div class="r2-chips">${L.map((t) => `<span class="r2-chip"><button type="button" class="chip" data-r2="${t.id}">${t.icon} ${esc(t.name)}</button>${r2Edit && (!t.builtin) ? `<button type="button" class="btn sm" data-r2del="${t.id}" aria-label="${R2_BUILTIN.some((b) => b.id === t.id) ? 'Reset' : 'Delete'} ${esc(t.name)}">${R2_BUILTIN.some((b) => b.id === t.id) ? '↺' : '✕'}</button>` : ''}</span>`).join('')}</div>
    <p class="tiny muted" style="margin:8px 0 0">${r2Edit ? 'To change a template: load it, edit the blocks, then “Save as template” with the same name. ↺ puts a built-in back to how it started.' : `Loads into the planner above for ${r2Day() === todayIso() ? 'today' : 'tomorrow'}. Change anything, then add it to Gameplan.`}</p></section>`;
}
// template extras on the Round 1 plan preview: the training note + "Save as template"
{ const _hc = hubCapture; hubCapture = function () {
  let h = _hc(); const g = capDraft; if (!g || g.dest !== 'plan') return h;
  const note = g.tpl?.train ? `<p class="small r2-note full">${g.tpl.icon} <b>${esc(g.tpl.name)}:</b> ${esc(g.tpl.train)}</p>` : '';
  const save = `<div class="r2-save full"><input id="r2-name" type="text" maxlength="30" placeholder="Template name" value="${esc(g.tpl?.name || '')}" aria-label="Template name"><button type="button" class="btn sm" id="r2-savetpl"${g.blocks.length ? '' : ' disabled'}>Save as template</button></div>`;
  return h.replace('<div class="full"><ul class="r1-plan">', `${note}<div class="full"><ul class="r1-plan">`).replace(/(<\/ul>(?:<p class="tiny muted"[^>]*>[^<]*<\/p>)?<\/div>)/, `$1${save}`);
}; }

// ---------- daily score ----------
const R2_PARTS = [['train', 'Trained', 25], ['protein', 'Protein', 25], ['school', 'Schoolwork', 20], ['checkin', 'Check-in', 15], ['sleep', 'Sleep', 15]];
function r2Score(d) {
  const t = todayIso(), past = d < t, parts = {}, note = {};
  const ex = hubSafe(() => exList(d), []) || [], mins = sum(ex.map((x) => +x.mins || 0)), rd = hubSafe(() => hpReady(d), null);
  const restOk = ex.length === 0 && rd != null && rd < 45;
  parts.train = ex.length || restOk ? 25 : 0; note.train = ex.length ? `${mins} min logged` : restOk ? `Rest day (readiness ${rd})` : 'Nothing logged yet';
  const tg = hubSafe(() => targets(d).protein, null) || 0, pr = hubSafe(() => (hasFood(d) ? totalsOf(d).protein : 0), 0) || 0;
  parts.protein = tg ? Math.round(25 * Math.min(1, pr / tg)) : 0; note.protein = tg ? (pr >= tg ? `${Math.round(pr)} / ${tg} g ✓` : `${Math.round(pr)} / ${tg} g · ${Math.round(tg - pr)} g to go`) : 'No target set';
  const items = (doc('life-school')?.items || []).filter((x) => x.due === d), done = items.filter((x) => x.done).length;
  parts.school = items.length ? Math.round(20 * done / items.length) : 20; note.school = items.length ? `${done} of ${items.length} due today done` : 'Nothing due';
  const ck = doc('rl-check')?.days?.[d] || doc('rl-ready')?.days?.[d];
  parts.checkin = ck ? 15 : 0; note.checkin = ck ? 'Done' : 'Not yet (Recovery Lens)';
  const sl = hubSafe(() => hpSleepNight(d), null);
  parts.sleep = sl == null ? 0 : sl >= 8 ? 15 : sl >= 7 ? 10 : sl >= 6 ? 5 : 0; note.sleep = sl == null ? 'Not logged' : `${r1(sl)} h last night`;
  const score = sum(Object.values(parts)), logged = ex.length || pr || ck || sl != null;
  return { date: d, score: logged || !past ? score : null, parts, note };
}
function r2Hist(n = 14) { const t = todayIso(), out = []; for (let i = n - 1; i >= 0; i--) out.push(r2Score(shiftIso(t, -i))); return out; }
function r2Streak() { let s = 0, d = todayIso(); const today = r2Score(d); if (!(today.score >= 70)) d = shiftIso(d, -1); else s = 1, d = shiftIso(d, -1); for (let i = 0; i < 365; i++, d = shiftIso(d, -1)) { if (r2Score(d).score >= 70) s++; else break; } return s; }
function r2SaveScore(S) {
  const D = doc('hub-score') || (cache['hub-score'] = { v: 1, days: {} }); D.days = D.days || {};
  const cur = D.days[S.date]; if (cur && cur.score === S.score && JSON.stringify(cur.parts) === JSON.stringify(S.parts)) return;
  D.days[S.date] = { score: S.score, parts: S.parts, at: Date.now() };
  for (const k of Object.keys(D.days)) if (k < shiftIso(S.date, -90)) delete D.days[k];
  persist('hub-score');
}
function r2Card() {
  const S = r2Score(todayIso()), H = r2Hist(), st = r2Streak(), c = S.score >= 80 ? '#22c55e' : S.score >= 60 ? '#eab308' : '#f97316';
  hubSafe(() => r2SaveScore(S));
  const next = R2_PARTS.map(([k, l, max]) => ({ k, l, gap: max - S.parts[k] })).filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap)[0];
  return `<section class="card r2-score"><div class="r2-top"><div class="r2-num" style="--c:${c};--p:${S.score}"><b>${S.score}</b><small>/100</small></div>
      <div class="r2-side"><h3>Daily score</h3><p class="small muted" style="margin:2px 0 0">${st ? `🔥 ${st}-day streak at 70+` : 'Hit 70+ to start a streak'}</p>${next ? `<p class="small" style="margin:6px 0 0">Biggest gain: <b>${esc(next.l)}</b> (+${next.gap})</p>` : '<p class="small" style="margin:6px 0 0">Perfect day 🎯</p>'}</div></div>
    <ul class="r2-parts">${R2_PARTS.map(([k, l, max]) => `<li><span>${l}</span><div class="hub-app-bar"><i style="width:${Math.round(S.parts[k] / max * 100)}%;background:${S.parts[k] === max ? '#22c55e' : '#eab308'}"></i></div><b>${S.parts[k]}/${max}</b><small>${esc(S.note[k])}</small></li>`).join('')}</ul>
    <div class="r2-hist" aria-label="Last 14 days">${H.map((h) => `<span title="${fmtD(h.date)}: ${h.score ?? 'no data'}" style="--h:${h.score ?? 0}%" class="${h.score == null ? 'none' : h.score >= 70 ? 'good' : ''}${h.date === todayIso() ? ' now' : ''}"></span>`).join('')}</div>
    <div class="row tiny muted" style="justify-content:space-between;margin-top:4px"><span>${fmtD(H[0].date)}</span><span>Today</span></div></section>`;
}
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => { const cap = el.querySelector('.cap'); (cap || el.querySelector('.hub-head'))?.insertAdjacentHTML('afterend', r2Row() + r2Card()); }); }; }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-r2]'); if (b) { r2Load(b.dataset.r2); return; }
  const d = e.target.closest('[data-r2del]'); if (d) { r2Del(d.dataset.r2del); return; }
  if (e.target.id === 'r2-edit') { r2Edit = !r2Edit; refresh(); return; }
  if (e.target.id === 'r2-savetpl') { e.stopImmediatePropagation(); r2SaveTpl($('#r2-name')?.value); }
}, true);
window.Ecosystem = { ...(window.Ecosystem || {}), score: r2Score, templates: r2List };
