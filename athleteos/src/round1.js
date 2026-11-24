// ===================== Hub Round 1: quick-add for everything + voice + plan my day =====================
// Builds on capture.js. The one box on Hub › Today now also:
//   • logs food straight into today (day-*.<meal>, MacroLens's own entry shape) — macros typed ("45g protein", "600 cal")
//     or estimated by Claude when you tap Estimate (sample capability)
//   • logs a workout you already did (day-*.exercise via addWorkout), with shots/makes for shooting
//   • turns a whole day ("school 8 to 3, practice 3:30-5:30, dinner at 6, bed 10:30") into Gameplan blocks (gp-d-<date>)
//   • takes several things at once (one per line or separated by ";"), previewed one at a time
//   • voice: Claude dictation inside Claude, else the browser's speech recognition
// Nothing is saved until you confirm the preview.
CAP_DEST.splice(0, 0, ['food', 'Log food (today)', 'ml'], ['done', 'Log a workout I did', 'aos'], ['plan', 'Plan my day (Gameplan)', 'gp']);
const R1_DONE = /\b(shot|shoot|shooting|made|makes|did|done|finished|trained|lifted|ran|played|worked out|got up|got in)\b/;
const R1_FOODNUM = /(\d+)\s*(?:g|grams?)\s*(?:of\s*)?protein|(\d+)\s*(?:cal|cals|kcal|calories)\b/;
const R1_MEALKW = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', supper: 'dinner', snack: 'snacks', shake: 'snacks' };
let capQueue = [], r1Dict = null, r1Mic = false, r1Base = '';

// ---------- parsing ----------
const r1Num = (s, re) => { const m = s.match(re); return m ? Number(m[1]) : null; };
function r1Food(raw, w) {
  const s = raw.toLowerCase(), h = new Date().getHours();
  const meal = Object.entries(R1_MEALKW).find(([k]) => s.includes(k))?.[1] || (h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks');
  const protein = r1Num(s, /(\d+)\s*(?:g|grams?)\s*(?:of\s*)?protein/), calories = r1Num(s, /(\d+)\s*(?:cal|cals|kcal|calories)\b/);
  const carbs = r1Num(s, /(\d+)\s*(?:g|grams?)\s*(?:of\s*)?carbs?/), fat = r1Num(s, /(\d+)\s*(?:g|grams?)\s*(?:of\s*)?fat/);
  const name = capCap(raw.replace(/(\d+)\s*(?:g|grams?)\s*(?:of\s*)?(protein|carbs?|fat)/gi, '').replace(/(\d+)\s*(?:cal|cals|kcal|calories)\b/gi, '').replace(/\b(ate|had|for (breakfast|lunch|dinner)|i)\b/gi, '').replace(/[,·]+\s*$/, '').replace(/\s+/g, ' ').trim()) || 'Food';
  return { dest: 'food', title: name, meal, protein, calories, carbs, fat, date: w.date && w.date <= todayIso() ? w.date : todayIso() };
}
function r1Done(raw, w) {
  const s = raw.toLowerCase();
  const shots = r1Num(s, /(?:shot|shoot|took|hit|got up|got in)\s+(\d+)/) ?? r1Num(s, /(\d+)\s*(?:shots|threes|3s|jumpers|free throws)/);
  const made = r1Num(s, /(?:made|make|makes|hit|knocked down)\s+(\d+)/) ?? r1Num(s, /(\d+)\s*(?:makes|made)\b/);
  const hrs = r1Num(s, /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/), mins = r1Num(s, /(\d+)\s*(?:m|min|mins|minutes)\b/) ?? (hrs != null ? Math.round(hrs * 60) : null);
  const tk = Object.keys(CAP_TRAIN).find((k) => new RegExp(`\\b${k}\\b`).test(s));
  const type = shots != null || made != null ? 'shooting' : (tk && CAP_TRAIN[tk] !== 'film' ? CAP_TRAIN[tk] : 'skill');
  const att = shots != null && made != null && made > shots ? made : shots;
  const name = type === 'shooting' ? `Shooting${att ? ` · ${att} shots` : ''}` : capCap(w.rest.replace(/\b(i|did|done|finished|trained|today|for)\b/g, '').replace(/\d+\s*(?:m|min|mins|minutes|h|hr|hrs|hour|hours)\b/g, '').replace(/\s+/g, ' ').trim()) || 'Workout';
  return { dest: 'done', title: name, type, mins: mins || (type === 'shooting' && att ? Math.max(15, Math.round(att / 4)) : 45), shots: att, made, int: /\bhard|intense|tough|grind\b/.test(s) ? 'hard' : /\blight|easy|chill\b/.test(s) ? 'light' : 'moderate', date: w.date && w.date <= todayIso() ? w.date : todayIso() };
}
// "school 8 to 3, practice 3:30-5:30, dinner at 6, homework for an hour, shoot at 8, bed at 10:30"
const R1_PTYPE = [[/\bschool|class(es)?\b/, 'school'], [/\bpractice|game|scrimmage\b/, 'practice'], [/\blift|gym|workout|shoot|shooting|train|run|conditioning|skill|handles\b/, 'train'], [/\bhomework|study|studying|hw|essay|read\b/, 'focus'], [/\bbreakfast|lunch|dinner|eat|meal|snack\b/, 'meal'], [/\bbed|sleep|lights out\b/, 'sleep'], [/\bwork|business|clients?|clip\b/, 'work'], [/\bfree|chill|games|xbox|friends\b/, 'free']];
const R1_PMINS = { school: 420, practice: 120, train: 60, focus: 60, meal: 30, sleep: 480, work: 60, free: 60, life: 30 };
function r1Clock(h, m, ap, prevEnd) {
  h = Number(h); m = Number(m || 0);
  if (ap) { h = h % 12 + (ap === 'pm' ? 12 : 0); }
  else if (h <= 12) { if (h === 12) h = 12; else if (h < 7) h += 12; else if (prevEnd != null && h * 60 + m < prevEnd - 60) h += 12; }
  return h * 60 + m;
}
function r1Plan(raw) {
  let date = todayIso(); const low = raw.toLowerCase();
  if (/\btomorrow\b/.test(low)) date = shiftIso(date, 1);
  const parts = raw.replace(/\btomorrow\b|\btoday\b/gi, '').split(/\s*(?:,|;|\n|\bthen\b|\band then\b|\.\s)\s*/i).map((x) => x.trim()).filter(Boolean);
  const blocks = []; let prevEnd = null;
  for (const p of parts) {
    const s = p.toLowerCase(), T = '(\\d{1,2})(?::(\\d{2}))?(?:\\s*(am|pm)\\b)?';
    let start = null, end = null, mins = null, m;
    if ((m = s.match(new RegExp(`(?:from\\s+)?${T}\\s*(?:to|-|–|until|till)\\s*${T}`)))) { start = r1Clock(m[1], m[2], m[3] || (m[6] === 'pm' && Number(m[1]) < Number(m[4]) ? 'pm' : null), prevEnd); end = r1Clock(m[4], m[5], m[6], start); if (end <= start) end += 720; }
    else if ((m = s.match(new RegExp(`(?:at|@)\\s*${T}`))) || (m = s.match(new RegExp(`^${T}\\b`)))) start = r1Clock(m[1], m[2], m[3], prevEnd);
    const dm = s.match(/for\s+(an?|one|\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|h|min|mins|minutes)\b/);
    if (dm) { const n = /^(an?|one)$/.test(dm[1]) ? 1 : Number(dm[1]); mins = /^h/.test(dm[2]) ? Math.round(n * 60) : Math.round(n); }
    const type = R1_PTYPE.find(([re]) => re.test(s))?.[1] || 'life';
    if (start == null) start = prevEnd ?? 16 * 60;
    if (end != null) mins = end - start;
    if (mins == null) mins = type === 'sleep' ? 30 : R1_PMINS[type];
    const title = capCap(p.replace(new RegExp(`(?:from\\s+)?${T}\\s*(?:to|-|–|until|till)\\s*${T}`, 'i'), '').replace(new RegExp(`(?:at|@)\\s*${T}`, 'i'), '').replace(/for\s+(an?|one|\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|h|min|mins|minutes)\b/i, '').replace(/^\d{1,2}(:\d{2})?\s*(am|pm)?\s*/i, '').replace(/\s+/g, ' ').trim()) || GP_TYPES[type][0];
    blocks.push({ title: type === 'sleep' ? 'Lights out' : title, start, mins, type });
    prevEnd = start + mins;
  }
  return { dest: 'plan', date, blocks: blocks.sort((a, b) => a.start - b.start) };
}
const r1Times = (s) => (s.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-|–)\s*\d{1,2}|\bat\s+\d{1,2}|\bfor\s+(?:an?|\d+)\s*(?:hour|hr|min)/gi) || []).length;
const _capGuess = capGuess;
capGuess = function (raw) {
  const s = raw.toLowerCase(), w = capWhen(raw), future = w.date && w.date > todayIso();
  if (r1Times(raw) >= 2 && (raw.match(/,|;|\n|\bthen\b/g) || []).length >= 1) return r1Plan(raw);
  if (/^plan\b/i.test(raw.trim())) return r1Plan(raw.replace(/^plan( my day)?:?\s*/i, ''));
  if (!future && R1_FOODNUM.test(s)) return r1Food(raw, w);
  if (!future && R1_DONE.test(s) && /\d/.test(s) && !CAP_SCHOOL.test(s) && !CAP_FOOD.test(s)) return r1Done(raw, w);
  const g = _capGuess(raw);
  if (g.dest === 'ml' && !future) return r1Food(raw, w);
  return g;
};
const r1Clk = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ---------- preview ----------
const _hubCapture = hubCapture;
hubCapture = function () {
  const g = capDraft, more = capQueue.length ? `<span class="tiny muted">${capQueue.length} more after this</span>` : '';
  const mic = `<button type="button" class="btn cap-mic${r1Mic ? ' on' : ''}" id="cap-mic" aria-label="${r1Mic ? 'Stop listening' : 'Say it'}" title="Say it">${r1Mic ? '■' : '🎤'}</button>`;
  if (!g || !['food', 'done', 'plan'].includes(g.dest)) {
    return _hubCapture().replace('<button class="btn primary" type="submit">Add</button>', `${mic}<button class="btn primary" type="submit">Add</button>`)
      .replace('Add anything: “Spanish quiz Friday”, “lift legs tomorrow 4pm”…', 'Add or say anything: “chicken bowl 45g protein”, “shot 200 made 120”, “Spanish quiz Friday”…')
      .replace('</form>', `</form><div class="cap-hint tiny muted">${r1Mic ? 'Listening… tap ■ when done' : 'Food, a workout you did, schoolwork, plans, or your whole day (“school 8 to 3, practice 3:30-5:30, homework for an hour, bed 10:30”). One per line for several.'}</div>`)
      .replace('<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px">', `<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px">${more}`);
  }
  const destSel = `<label>Goes to<select id="cap-dest">${CAP_DEST.map(([k, l]) => `<option value="${k}"${k === g.dest ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const num = (id, label, v, ph = '') => `<label>${label}<input id="${id}" type="number" min="0" inputmode="numeric" value="${v ?? ''}" placeholder="${ph}"></label>`;
  let body = '', ok = 'Save', color = EV_APPS[CAP_DEST.find((d) => d[0] === g.dest)[2]].color;
  if (g.dest === 'food') {
    body = `<label class="full">Food<input id="cap-title" type="text" value="${esc(g.title)}"></label>
      <label>Meal<select id="r1-meal">${MEALS.map(([k, l]) => `<option value="${k}"${k === g.meal ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      ${num('r1-p', 'Protein (g)', g.protein)}${num('r1-cal', 'Calories', g.calories)}${num('r1-c', 'Carbs (g)', g.carbs)}${num('r1-f', 'Fat (g)', g.fat)}
      ${aiOn() ? `<div class="full"><button type="button" class="btn sm" id="r1-est">${g.est ? 'Estimating…' : '✨ Estimate macros with Claude'}</button><span class="tiny muted" style="margin-left:8px">${g.est ? '' : 'Claude fills in what you didn’t type. Check before saving.'}</span></div>` : '<p class="tiny muted full" style="margin:0">Type the protein at least. For exact macros from a photo or label, use MacroLens.</p>'}`;
    ok = 'Log food';
  } else if (g.dest === 'done') {
    body = `<label class="full">Workout<input id="cap-title" type="text" value="${esc(g.title)}"></label>
      <label>Type<select id="cap-type">${EV_PICK.filter((x) => !['film', 'recovery', 'sleep', 'nutrition', 'personal', 'testing'].includes(x[0])).map((x) => `<option value="${x[0]}"${x[0] === g.type ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>
      ${num('r1-min', 'Minutes', g.mins)}
      <label>Effort<select id="r1-int">${[['light', 'Light'], ['moderate', 'Moderate'], ['hard', 'Hard']].map(([k, l]) => `<option value="${k}"${k === g.int ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Date<input id="cap-date" type="date" max="${todayIso()}" value="${g.date}"></label>
      ${g.type === 'shooting' ? `${num('r1-shots', 'Shots', g.shots)}${num('r1-made', 'Makes (optional)', g.made, '—')}` : ''}`;
    ok = 'Log workout';
  } else {
    const rows = g.blocks.map((b, i) => `<li style="--c:${GP_TYPES[b.type][1]}"><i></i><input type="time" data-r1t="${i}" value="${r1Clk(b.start)}"><input type="text" data-r1n="${i}" value="${esc(b.title)}"><select data-r1m="${i}">${[15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480].map((x) => `<option value="${x}"${x === b.mins ? ' selected' : ''}>${x < 60 ? x + ' min' : x / 60 + ' h'}</option>`).join('')}${[15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480].includes(b.mins) ? '' : `<option value="${b.mins}" selected>${b.mins} min</option>`}</select><button type="button" class="btn sm" data-r1x="${i}" aria-label="Remove">✕</button></li>`).join('');
    const have = (doc('gp-d-' + g.date)?.blocks || []).length;
    body = `<label>Day<select id="r1-day"><option value="${todayIso()}"${g.date === todayIso() ? ' selected' : ''}>Today</option><option value="${shiftIso(todayIso(), 1)}"${g.date !== todayIso() ? ' selected' : ''}>Tomorrow</option></select></label>
      <div class="full"><ul class="r1-plan">${rows || '<li class="muted">No blocks found. Try “school 8 to 3, practice 3:30-5:30”.</li>'}</ul>${have ? `<p class="tiny muted" style="margin:6px 0 0">${have} block${have > 1 ? 's' : ''} already planned that day. These get added next to them (same title + time is skipped).</p>` : ''}</div>`;
    ok = `Add ${g.blocks.length} block${g.blocks.length === 1 ? '' : 's'} to Gameplan`;
  }
  return `<section class="card cap"><form id="cap-f" class="cap-row" autocomplete="off"><input id="cap-in" type="text" aria-label="Quick add" value="${esc(g.raw || '')}">${mic}<button class="btn primary" type="submit">Add</button></form>
    <div class="cap-prev" style="--c:${color}"><div class="fields">${destSel}${body}</div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px">${more}<button type="button" class="btn sm" id="cap-x">${capQueue.length ? 'Skip' : 'Cancel'}</button><button type="button" class="btn sm primary" id="cap-ok"${g.dest === 'plan' && !g.blocks.length ? ' disabled' : ''}>${ok}</button></div></div></section>`;
};
function r1Read() {
  const g = capDraft; if (!g) return; const v = (id) => $('#' + id)?.value, n = (id) => { const x = v(id); return x === '' || x == null ? null : Number(x); };
  if (g.dest === 'food') Object.assign(g, { title: v('cap-title') ?? g.title, meal: v('r1-meal') ?? g.meal, protein: n('r1-p'), calories: n('r1-cal'), carbs: n('r1-c'), fat: n('r1-f') });
  if (g.dest === 'done') Object.assign(g, { title: v('cap-title') ?? g.title, type: v('cap-type') ?? g.type, mins: n('r1-min') ?? g.mins, int: v('r1-int') ?? g.int, date: v('cap-date') || g.date, shots: $('#r1-shots') ? n('r1-shots') : g.shots, made: $('#r1-made') ? n('r1-made') : g.made });
  if (g.dest === 'plan') {
    g.date = v('r1-day') || g.date;
    $$('[data-r1t]').forEach((el) => { const b = g.blocks[+el.dataset.r1t], [h, m] = el.value.split(':').map(Number); if (b && !isNaN(h)) b.start = h * 60 + (m || 0); });
    $$('[data-r1n]').forEach((el) => { const b = g.blocks[+el.dataset.r1n]; if (b) b.title = el.value.trim() || b.title; });
    $$('[data-r1m]').forEach((el) => { const b = g.blocks[+el.dataset.r1m]; if (b) b.mins = Number(el.value); });
  }
}
function r1Auto() { const g = capDraft; if (g?.dest === 'food' && aiOn() && (g.calories == null || g.protein == null)) r1Estimate(); }
function r1Next() { capDraft = capQueue.length ? capQueue.shift() : null; refresh(); if (capDraft) { setTimeout(() => $('#cap-ok')?.focus(), 30); r1Auto(); } }
const _capSave = capSave;
capSave = async function () {
  const g = capDraft; if (!g) return;
  if (!['food', 'done', 'plan'].includes(g.dest)) { const q = capQueue; capQueue = []; await _capSave(); capQueue = q; if (!capDraft && q.length) r1Next(); return; }
  r1Read();
  if (g.dest === 'food') {
    if (!String(g.title || '').trim()) return toast('Add what you ate');
    if (g.protein == null && g.calories == null) return toast(aiOn() ? 'Add protein or calories, or tap Estimate' : 'Add protein or calories');
    const d = dayDoc(g.date, true), cal = g.calories ?? Math.round((g.protein || 0) * 4 + (g.carbs || 0) * 4 + (g.fat || 0) * 9);
    d[g.meal] = [...(d[g.meal] || []), { id: 'h' + Date.now().toString(36), name: g.title.trim().slice(0, 80), calories: cal, protein: g.protein || 0, carbs: g.carbs || 0, fat: g.fat || 0, servings: 1, addedAt: Date.now(), source: 'hub' }];
    persist('day-' + g.date); toast(`Logged ${g.title.trim()} · ${g.protein || 0} g protein`);
  } else if (g.dest === 'done') {
    if (!(g.mins > 0)) return toast('How many minutes?');
    if (g.made != null && g.shots != null && g.made > g.shots) return toast('Makes can’t be more than shots');
    const rec = { type: g.type, name: g.title.trim() || 'Workout', mins: g.mins, int: g.int, source: 'hub' };
    if (g.type === 'shooting' && g.shots) rec.btc = { attempts: g.made != null ? g.shots : 0, makes: g.made ?? 0, shots: g.shots, pct: g.made != null ? Math.round((g.made / g.shots) * 100) : null };
    addWorkout(g.date, rec); toast(`Logged ${rec.name}`);
  } else {
    const k = 'gp-d-' + g.date, d = doc(k) || (cache[k] = { blocks: [], entries: [], night: { done: {}, completedAt: null } });
    d.blocks = d.blocks || []; let n = 0;
    for (const b of g.blocks) { const st = r1Clk(b.start); if (d.blocks.some((x) => x.title === b.title && x.start === st)) continue; d.blocks.push({ id: uid('b'), title: b.title.slice(0, 60), start: st, mins: b.mins, type: b.type, done: false, src: 'Hub' }); n++; }
    persist(k); toast(`Added ${n} block${n === 1 ? '' : 's'} to ${g.date === todayIso() ? 'today' : 'tomorrow'}`);
  }
  r1Next();
};
async function r1Estimate() {
  const g = capDraft; if (!g || g.dest !== 'food' || g.est) return; r1Read(); g.est = true; refresh();
  try {
    const r = await askAI(`Estimate the nutrition for this food a 16-year-old athlete ate: "${g.title}". Typical US portion unless a size is given. Reply as JSON only: {"calories": number, "protein": number, "carbs": number, "fat": number} (grams, whole numbers).`, true);
    for (const k of ['calories', 'protein', 'carbs', 'fat']) if (g[k] == null && Number.isFinite(+r?.[k])) g[k] = Math.round(+r[k]);
  } catch (e) { toast(aiError(e)); }
  g.est = false; refresh();
}

// ---------- voice ----------
function r1SetMic(on) { r1Mic = on; refresh(); if (!on) { const v = $('#cap-in')?.value.trim(); if (v && !capDraft) $('#cap-f')?.requestSubmit(); } }
function r1Say(t) { const i = $('#cap-in'); if (i) i.value = [r1Base, t].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(); }
async function r1MicTap() {
  if (r1Mic) { try { if (r1Dict) await r1Dict.stop(); else window.__r1sr?.stop(); } catch {} return r1SetMic(false); }
  r1Base = $('#cap-in')?.value.trim() || ''; capDraft = null; capQueue = [];
  if (!r1Dict && window.claude?.use) { try { r1Dict = await claude.use('dictation'); } catch { r1Dict = null; }
    if (r1Dict) { r1Dict.onPartial?.(({ text }) => { if (r1Mic) r1Say(text); }); r1Dict.onFinal?.(({ text }) => { r1Base = [r1Base, text].filter(Boolean).join(' ').trim(); r1Say(''); });
      r1Dict.onState?.(({ state }) => { if (state === 'idle' && r1Mic) { const v = r1Base; r1SetMic(false); const i = $('#cap-in'); if (i && v) { i.value = v; $('#cap-f')?.requestSubmit(); } } }); } }
  if (r1Dict) { try { await r1Dict.start(); r1Mic = true; refresh(); r1Say(''); } catch (e) { toast(e?.code === 'not_granted' ? 'Allow Dictation in this page’s permissions to talk to the Hub' : 'Voice isn’t available here. Use your keyboard’s 🎤.'); } return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Voice isn’t available here. Tap the box, then your keyboard’s 🎤.');
  const sr = window.__r1sr = new SR(); sr.lang = 'en-US'; sr.interimResults = true; sr.continuous = true;
  sr.onresult = (ev) => { let t = ''; for (const r of ev.results) t += r[0].transcript + ' '; r1Say(t); };
  sr.onend = () => r1SetMic(false); sr.onerror = () => r1SetMic(false);
  try { sr.start(); r1Mic = true; refresh(); r1Say(''); } catch { r1SetMic(false); }
}

// ---------- wiring (capture: runs before capture.js's own submit handler) ----------
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'cap-f') return; const raw = $('#cap-in')?.value.trim(); if (!raw) return;
  const isPlan = r1Times(raw) >= 2 || /^plan\b/i.test(raw);
  const parts = isPlan ? [raw] : raw.split(/\s*(?:\n|;)\s*/).filter(Boolean);
  e.preventDefault(); e.stopImmediatePropagation();
  const all = parts.map((p) => ({ raw: p, ...capGuess(p) }));
  capDraft = all.shift(); capQueue = all; refresh(); setTimeout(() => $('#cap-ok')?.focus(), 30); r1Auto();
}, true);
document.addEventListener('change', (e) => {
  if (!capDraft) return;
  if (e.target.id === 'cap-dest' && ['food', 'done', 'plan'].includes(e.target.value)) {
    e.stopImmediatePropagation(); const raw = capDraft.raw || capDraft.title || '', w = capWhen(raw);
    capDraft = { raw, ...(e.target.value === 'food' ? r1Food(raw, w) : e.target.value === 'done' ? r1Done(raw, w) : r1Plan(raw)) }; refresh(); return;
  }
  if (e.target.id === 'cap-dest' && ['food', 'done', 'plan'].includes(capDraft.dest)) { capDraft = { raw: capDraft.raw, title: capDraft.title || capDraft.raw, dest: e.target.value, type: 'homework', date: capDraft.date || todayIso() }; e.stopImmediatePropagation(); refresh(); return; }
  if (['cap-type', 'r1-day'].includes(e.target.id) && ['done', 'plan'].includes(capDraft.dest)) { r1Read(); refresh(); }
}, true);
document.addEventListener('click', (e) => {
  if (e.target.closest('#cap-mic')) { e.preventDefault(); r1MicTap(); return; }
  if (e.target.id === 'r1-est') { r1Estimate(); return; }
  const x = e.target.closest('[data-r1x]'); if (x && capDraft?.dest === 'plan') { r1Read(); capDraft.blocks.splice(+x.dataset.r1x, 1); refresh(); return; }
  if (e.target.id === 'cap-x' && capQueue.length) { e.stopImmediatePropagation(); r1Next(); }
}, true);
window.Ecosystem = { ...(window.Ecosystem || {}), capture: { guess: (s) => capGuess(s), plan: r1Plan } };
