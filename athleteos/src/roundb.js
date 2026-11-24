// ===================== Hub Round B: day-of changes + soreness adjust =====================
// Quick change (Right now card): Practice canceled / Practice added / Game added / Day off, with Undo. Stored in doc
// "hub-today" { date, change, at, undo: { skipEv: [ids], skipRep: [ids], removed: [blocks], addedEv: [ids], addedBlock: [ids] } }.
//   canceled → today's practice calendar events and Gameplan practice repeats are skipped for today (their own "skip"
//   lists), one-day Gameplan practice blocks are removed, and a "Workout (practice canceled)" block takes the slot.
//   added → a practice/game event on today's calendar. Day off → a planned rest day (counts as "Trained" in the score).
// Soreness: Recovery Lens body records (0–10) from today and yesterday, plus the check-in, change today's plan:
//   pain/injury → rest and get it checked; legs 7+ → light upper body; legs 5+ → no lower lift/conditioning/hard; sore
//   overall (4–5 of 5) → no hard day. Practice days keep practice, with a note.
// wpDay(date) = the approved weekly-plan day with both applied; the brief, Right now and the score read it.
const RB_LOWER = ['quads', 'hamstrings', 'glutes', 'calves', 'hipflex', 'adductors', 'ankles', 'knees'];
const RB_UPPER = ['shoulders', 'chest', 'upperback', 'lowerback', 'arms', 'forearms'];
const RB_NAME = { quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves', hipflex: 'hip flexors', adductors: 'adductors', ankles: 'ankles', knees: 'knees', shoulders: 'shoulders', chest: 'chest', upperback: 'upper back', lowerback: 'lower back', arms: 'arms', forearms: 'forearms' };
let rbForm = null;
const rbToday = () => { const D = doc('hub-today'); return D && D.date === todayIso() ? D : null; };
function rbSore(date) {
  const from = shiftIso(date, -1), last = {};
  for (const r of doc('rl-body')?.records || []) if (r.date >= from && r.date <= date && (!last[r.key] || (r.at || 0) > (last[r.key].at || 0))) last[r.key] = r;
  const recs = Object.values(last), lv = (r) => Math.max(+r.soreness || 0, +r.tightness || 0);
  const pain = recs.filter((r) => r.kind === 'pain' || r.kind === 'injury' || (+r.discomfort || 0) >= 4);
  const lower = recs.filter((r) => RB_LOWER.includes(r.area)), upper = recs.filter((r) => RB_UPPER.includes(r.area));
  const names = (L, min) => [...new Set(L.filter((r) => lv(r) >= min).map((r) => RB_NAME[r.area] || r.area))];
  const ck = doc('rl-check')?.days?.[date];
  return { pain: [...new Set(pain.map((r) => RB_NAME[r.area] || r.area))], lowerMax: Math.max(0, ...lower.map(lv)), upperMax: Math.max(0, ...upper.map(lv)), lowerAreas: names(lower, 5), upperAreas: names(upper, 5), overall: ck?.sore ?? null };
}
function rbAdjust(x, date) {
  const S = rbSore(date), hardish = x.level === 'hard' || /lift|conditioning|volume|finishing|game-speed|sprint/i.test(x.focus || '');
  if (S.pain.length) return { level: 'rest', focus: `Pain flagged (${S.pain.join(', ')}): skip training today${x.kind === 'practice' || x.kind === 'game' ? ' and tell your coach' : ''}. Get it checked by a trainer.`, why: 'pain' };
  if (x.kind === 'practice' || x.kind === 'game') return S.lowerMax >= 5 ? { level: x.level, focus: `${x.focus} · Legs sore (${S.lowerAreas.join(', ')}): extra warm-up, foam roll and stretch after.`, why: 'sore-note' } : null;
  if (S.lowerMax >= 7) return { level: 'light', focus: `Legs very sore (${S.lowerAreas.join(', ')}): upper body + 20 min form shooting. Foam roll and stretch legs.`, why: 'legs' };
  if (S.lowerMax >= 5 && hardish) return { level: 'moderate', focus: `Legs sore (${S.lowerAreas.join(', ')}): upper body + shooting rhythm instead. No lower-body lift, sprints or conditioning.`, why: 'legs' };
  if (S.upperMax >= 5 && /lift/i.test(x.focus || '')) return { level: x.level === 'hard' ? 'moderate' : x.level, focus: `Upper body sore (${S.upperAreas.join(', ')}): shooting + finishing instead of lifting.`, why: 'upper' };
  if ((S.overall ?? 0) >= 4 && x.level === 'hard') return { level: 'moderate', focus: `${x.focus.replace(/\s*\(keep it moderate\)/, '')} (keep it moderate: sore overall in your check-in)`, why: 'overall' };
  return null;
}
function wpDay(date) {
  const W = doc('hub-week'), base = W?.approvedAt ? W.days.find((y) => y.date === date) : null, ch = date === todayIso() ? rbToday() : null;
  let x = base ? { ...base } : { date, kind: 'off', level: 'moderate', focus: 'Your choice: 45 min shooting or skill work', unplanned: true };
  if (ch?.change === 'cancel') x = { ...x, kind: 'off', level: x.level === 'rest' ? 'moderate' : 'moderate', focus: 'Practice canceled: 45–60 min on your own (shooting + finishing)', changed: true };
  if (ch?.change === 'practice') x = { ...x, kind: 'practice', level: 'moderate', focus: 'Practice added: practice is the session', changed: true };
  if (ch?.change === 'game') x = { ...x, kind: 'game', level: 'light', focus: 'Game added: form shots + free throws before, eat 3–4 h ahead', changed: true };
  if (ch?.change === 'off') x = { ...x, kind: 'off', level: 'rest', focus: 'Day off: rest, eat well, sleep early', changed: true };
  const a = rbAdjust(x, date); if (a) Object.assign(x, { level: a.level, focus: x.changed && a.why !== 'sore-note' ? `${x.focus.split(':')[0]}. ${a.focus}` : a.focus, adjusted: a.why });
  return (base || ch || a) ? x : null;
}

// ---------- quick change ----------
function rbApply(change, form = {}) {
  const t = todayIso(), wd = parseIso(t).getDay(), U = { skipEv: [], skipRep: [], removed: [], addedEv: [], addedBlock: [] };
  if (rbToday()) rbUndo(true);
  const P = doc('aos-plan') || (cache['aos-plan'] = { events: [], routines: [], checks: {} }); P.events = P.events || [];
  if (change === 'cancel') {
    let st = null;
    for (const e of P.events) if ((e.type === 'practice' || /practice/i.test(e.title || '')) && hubSafe(() => occursOn(e, t), e.date === t)) { e.skip = [...(e.skip || []), t]; U.skipEv.push(e.id); st = st || e.start; }
    const C = doc('gp-core'); for (const r of C?.repeats || []) if (r.type === 'practice' && (r.days || []).includes(wd) && !(r.skip || []).includes(t)) { r.skip = [...(r.skip || []), t]; U.skipRep.push(r.id); st = st || r.start; }
    const k = 'gp-d-' + t, D = doc(k); if (D?.blocks) { U.removed = D.blocks.filter((b) => b.type === 'practice' || /^practice/i.test(b.title)); D.blocks = D.blocks.filter((b) => !U.removed.includes(b)); st = st || U.removed[0]?.start; }
    const D2 = doc(k) || (cache[k] = { blocks: [], entries: [], night: { done: {}, completedAt: null } }); D2.blocks = D2.blocks || [];
    const id = uid('b'); D2.blocks.push({ id, title: 'Workout (practice canceled)', start: st || '16:00', mins: 60, type: 'train', done: false, src: 'Hub' }); U.addedBlock.push(id);
    persist('aos-plan'); if (U.skipRep.length) persist('gp-core'); persist(k);
    if (!U.skipEv.length && !U.skipRep.length && !U.removed.length) toast('No practice was on today’s schedule, but your plan is updated');
  } else if (change === 'practice' || change === 'game') {
    const id = 'hub' + Date.now().toString(36), start = form.time || (change === 'game' ? '19:00' : '15:00'), mins = Number(form.mins) || (change === 'game' ? 120 : 150);
    P.events.push({ id, date: t, start, mins, title: change === 'game' ? (form.title ? `Game ${form.title}` : 'Game') : 'Practice', type: change, notes: 'Added in the Hub', recur: null, skip: [], remind: 0 });
    U.addedEv.push(id); persist('aos-plan');
  }
  cache['hub-today'] = { v: 1, date: t, change, at: Date.now(), undo: U }; persist('hub-today');
  rbForm = null; hubSafe(() => saveBrief());
  toast({ cancel: 'Practice canceled. Your own workout is on the schedule.', practice: 'Practice added to today', game: 'Game added to today', off: 'Day off: rest counts toward your score' }[change]); refresh();
}
function rbUndo(silent) {
  const D = rbToday(); if (!D) return; const t = D.date, U = D.undo || {}, P = doc('aos-plan');
  if (P) { for (const e of P.events || []) if ((U.skipEv || []).includes(e.id)) e.skip = (e.skip || []).filter((x) => x !== t); P.events = (P.events || []).filter((e) => !(U.addedEv || []).includes(e.id)); persist('aos-plan'); }
  const C = doc('gp-core'); if (C && (U.skipRep || []).length) { for (const r of C.repeats || []) if (U.skipRep.includes(r.id)) r.skip = (r.skip || []).filter((x) => x !== t); persist('gp-core'); }
  const k = 'gp-d-' + t, G = doc(k); if (G) { G.blocks = [...(G.blocks || []).filter((b) => !(U.addedBlock || []).includes(b.id)), ...(U.removed || [])]; persist(k); }
  cache['hub-today'] = { v: 1, date: '', change: null }; persist('hub-today');
  if (!silent) { hubSafe(() => saveBrief()); toast('Undone: today is back to the plan'); refresh(); }
}
function rbRow() {
  const D = rbToday();
  if (D) return `<div class="rb-row"><span class="tag">Today: ${{ cancel: 'practice canceled', practice: 'practice added', game: 'game added', off: 'day off' }[D.change]}</span><button type="button" class="btn sm" data-rb="undo">Undo</button></div>`;
  if (rbForm) return `<form class="rb-form" id="rb-form"><b class="small">${rbForm === 'game' ? 'Game today' : 'Practice today'}</b><input type="time" id="rb-time" value="${rbForm === 'game' ? '19:00' : '15:00'}" aria-label="Start time"><select id="rb-mins" aria-label="Length">${[60, 90, 120, 150, 180].map((m) => `<option value="${m}"${m === (rbForm === 'game' ? 120 : 150) ? ' selected' : ''}>${m / 60} h</option>`).join('')}</select>${rbForm === 'game' ? '<input type="text" id="rb-opp" placeholder="vs. who? (optional)" maxlength="40">' : ''}<button class="btn sm primary" type="submit">Add</button><button type="button" class="btn sm" data-rb="x">Cancel</button></form>`;
  return `<div class="rb-row"><span class="tiny muted">Today changed?</span><button type="button" class="chip" data-rb="cancel">Practice canceled</button><button type="button" class="chip" data-rb="practice">Practice added</button><button type="button" class="chip" data-rb="game">Game added</button><button type="button" class="chip" data-rb="off">Day off</button></div>`;
}

// ---------- hooks ----------
{ const _card = r3NowCard; r3NowCard = function () { const h = _card(); const i = h.lastIndexOf('</section>'); return h.slice(0, i) + rbRow() + h.slice(i); }; }
{ const _now = r3Now; r3Now = function () { const L = _now(), x = wpDay(todayIso()), h = new Date().getHours();
  if (x && (x.changed || x.adjusted) && h >= 6 && h < 21 && !hubSafe(() => exList(todayIso()).length, 0)) L.unshift({ score: 94, title: x.focus.split(':')[0], why: x.focus.includes(':') ? x.focus.slice(x.focus.indexOf(':') + 1).trim() : x.focus, act: x.level === 'rest' ? null : 'train' });
  return L.sort((a, b) => b.score - a.score); }; }
{ const _sc = r2Score; r2Score = function (d) { const S = _sc(d); try { const x = wpDay(d); if (S.parts.train === 0 && x?.level === 'rest') { S.parts.train = 25; S.note.train = x.changed ? 'Day off (you chose it)' : 'Planned rest day'; if (S.score != null) S.score += 25; else S.score = Object.values(S.parts).reduce((a, b) => a + b, 0); } } catch {} return S; }; }
{ const _bf = briefFor; briefFor = function (date) { const B = _bf(date); try { const x = wpDay(date); if (x && (x.changed || x.adjusted)) { const line = `📅 Plan: ${WP_LEVEL[x.level][0]} · ${x.focus}`, i = B.lines.findIndex((l) => l.startsWith('📅')); if (i >= 0) B.lines[i] = line; else { const j = B.lines.findIndex((l) => l.startsWith('🍗')); B.lines.splice(j < 0 ? B.lines.length : j, 0, line); } B.text = B.lines.join('\n'); } } catch {} return B; }; window.Ecosystem = { ...(window.Ecosystem || {}), brief: briefFor, day: wpDay, sore: rbSore, score: r2Score }; }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rb]'); if (!b) return; const k = b.dataset.rb;
  if (k === 'undo') return rbUndo();
  if (k === 'x') { rbForm = null; return refresh(); }
  if (k === 'practice' || k === 'game') { rbForm = k; refresh(); setTimeout(() => $('#rb-time')?.focus(), 30); return; }
  rbApply(k);
});
document.addEventListener('submit', (e) => { if (e.target.id !== 'rb-form') return; e.preventDefault(); rbApply(rbForm, { time: $('#rb-time')?.value, mins: $('#rb-mins')?.value, title: ($('#rb-opp')?.value || '').trim() }); });
