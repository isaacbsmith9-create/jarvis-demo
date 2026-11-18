// ===================== shell, sheets & record forms =====================
const ICONS = {
  command: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  testing: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  hoops: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/><path d="M5.6 5.6c3 2.4 3 10.4 0 12.8M18.4 5.6c-3 2.4-3 10.4 0 12.8"/>',
  analytics: '<path d="M3 21h18"/><path d="M5 17l4-6 4 3 6-9"/><circle cx="9" cy="11" r="1"/><circle cx="13" cy="14" r="1"/>',
  intel: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  reports: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  method: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const NAV = [
  { v: 'command', t: 'Command Center', m: 'Command' }, { v: 'data', t: 'Data Center', m: 'Data' }, { v: 'testing', t: 'Testing Lab', m: 'Testing' },
  { v: 'hoops', t: 'Basketball Intel', m: 'Hoops' }, { v: 'analytics', t: 'Analytics Lab', more: true }, { v: 'intel', t: 'Strengths & Weaknesses', more: true },
  { v: 'reports', t: 'Reports', more: true }, { v: 'method', t: 'Methodology', more: true },
];
const S = { view: 'command', R: null };
const MEASURED = '<span class="tag m" title="Directly measured">Measured</span>', ESTIMATE = '<span class="tag e" title="Calculated estimate, not a direct measurement">Estimate</span>';
const mtag = (est) => (est ? ESTIMATE : MEASURED);
const fxLink = (anchor, label = 'ƒ formula') => `<button type="button" class="fx" data-fx="${anchor}">${label}</button>`;

// ---------- sheet (modal form) ----------
let sheetSubmit = null;
function openSheet(title, body, o = {}) {
  const d = $('#sheet');
  d.innerHTML = `<form class="sheet-in" id="sheet-form" novalidate><div class="sheet-h"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
    ${body}<p class="err" id="sheet-err" hidden></p>
    <div class="sheet-f">${o.extra || ''}<button type="button" class="btn ghost" data-close>${o.cancel || 'Cancel'}</button>${o.onSubmit ? `<button type="submit" class="btn ${o.danger ? 'danger' : ''}">${esc(o.submit || 'Save')}</button>` : ''}</div></form>`;
  sheetSubmit = o.onSubmit || null;
  for (const b of $$('[data-close]', d)) b.onclick = closeSheet;
  $('#sheet-form').onsubmit = (e) => {
    e.preventDefault(); if (!sheetSubmit) return closeSheet();
    const err = sheetSubmit(new FormData(e.target), e.target);
    if (typeof err === 'string') { const el = $('#sheet-err'); el.textContent = err; el.hidden = false; return; }
    closeSheet(); rerender();
  };
  if (!d.open) d.showModal();
  o.onOpen?.(d);
  return d;
}
function closeSheet() { const d = $('#sheet'); if (d.open) d.close(); }
/** In-page confirmation (the viewer blocks window.confirm). */
function confirmSheet(title, text, label, fn) {
  openSheet(title, `<div class="confirm"><b>${esc(text)}</b><span class="small muted">This can't be undone.</span></div>`, { submit: label, danger: true, onSubmit: () => { fn(); } });
}
const fld = (label, input, o = {}) => `<label class="fld ${o.full ? 'full' : ''}"><span>${esc(label)}</span>${input}${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
const inp = (name, val = '', o = {}) => `<input type="${o.type || 'text'}" name="${name}" id="f-${name}" value="${esc(val ?? '')}" ${o.step ? `step="${o.step}"` : ''} ${o.min != null ? `min="${o.min}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.req ? 'required' : ''} inputmode="${o.type === 'number' ? 'decimal' : 'text'}">`;
const sel = (name, opts, val) => `<select name="${name}" id="f-${name}">${Object.entries(opts).map(([k, v]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
const num = (fd, k) => { const v = fd.get(k); if (v == null || String(v).trim() === '') return null; const n = Number(v); return isFinite(n) ? n : NaN; };
const needAthlete = () => { if (!curAthlete()) { toast('Add an athlete first'); athleteForm(); return true; } return false; };
function testOptions(val) {
  return `<select name="test" id="f-test">${CAT_IDS.filter((c) => CATS[c].group === 'physical').map((c) => `<optgroup label="${CATS[c].name}">${allTests().filter((t) => t.cat === c).map((t) => `<option value="${t.id}" ${t.id === val ? 'selected' : ''}>${esc(t.name)} (${t.unit})</option>`).join('')}</optgroup>`).join('')}</select>`;
}

// ---------- athlete ----------
function athleteForm(a = null) {
  const isNew = !a; a = a || { sport: 'Basketball', pos: 'PG', hand: 'R', foot: 'L', goals: [] };
  openSheet(isNew ? 'New athlete' : 'Edit athlete profile', `<div class="form">
    ${fld('Name', inp('name', a.name, { req: true }), { full: true })}
    ${fld('Sport', inp('sport', a.sport))}${fld('Position', sel('pos', POSITIONS, a.pos))}
    ${fld('Height (ft)', inp('hft', a.height ? Math.floor(a.height / 12) : '', { type: 'number', min: 3 }))}${fld('Height (in)', inp('hin', a.height ? Math.round(a.height % 12) : '', { type: 'number', min: 0, step: '0.5' }))}
    ${fld('Weight (lb)', inp('weight', a.weight, { type: 'number', step: '0.1' }), { hint: 'Used for relative strength.' })}
    ${fld('Birth date', inp('birth', a.birth, { type: 'date' }), { hint: 'Age is calculated from it.' })}
    ${fld('Training experience (years)', inp('exp', a.exp, { type: 'number', step: '0.5', min: 0 }))}
    ${fld('Dominant hand', sel('hand', { R: 'Right', L: 'Left', A: 'Ambidextrous' }, a.hand))}${fld('Dominant foot', sel('foot', { L: 'Left', R: 'Right', NA: 'Not applicable' }, a.foot))}
    <div class="fld full"><span>Goals (raise priority in the development engine)</span><div class="checks">${Object.entries(GOALS).map(([k, v]) => `<label><input type="checkbox" name="goals" value="${k}" ${a.goals?.includes(k) ? 'checked' : ''}>${v}</label>`).join('')}</div></div>
    ${fld('Goal notes', `<textarea name="goalText" id="f-goalText">${esc(a.goalText || '')}</textarea>`, { full: true })}
  </div>`, { submit: isNew ? 'Create athlete' : 'Save profile', onSubmit: (fd) => {
    const name = String(fd.get('name') || '').trim(); if (!name) return 'Enter a name.';
    const hft = num(fd, 'hft'), hin = num(fd, 'hin'), weight = num(fd, 'weight'), exp = num(fd, 'exp');
    if ([hft, hin, weight, exp].some((x) => Number.isNaN(x))) return 'Height, weight and experience must be numbers.';
    if (weight != null && (weight < 50 || weight > 450)) return 'Weight looks off. Enter pounds (50–450).';
    const o = { name, sport: String(fd.get('sport') || '').trim(), pos: fd.get('pos'), height: hft != null ? hft * 12 + (hin || 0) : null, weight, birth: fd.get('birth') || null, exp, hand: fd.get('hand'), foot: fd.get('foot'), goals: fd.getAll('goals'), goalText: String(fd.get('goalText') || '') };
    const A = doc('athletes');
    if (isNew) { const na = { id: uid('ath'), created: Date.now(), ...o }; A.list.push(na); A.current = na.id; toast('Athlete created'); }
    else Object.assign(A.list.find((x) => x.id === a.id), o);
    persist('athletes');
  } });
}
function athletePicker() {
  const A = doc('athletes');
  openSheet('Athletes', `<div class="list">${A.list.map((a) => `<div class="cz-row"><label><input type="radio" name="cur" value="${a.id}" ${a.id === A.current ? 'checked' : ''}> <b>${esc(a.name)}</b> <span class="muted small">${esc(POSITIONS[a.pos] || '')}</span>${a.demo ? ' <span class="tag demo">demo</span>' : ''}</label></div>`).join('') || '<p class="muted">No athletes yet.</p>'}</div>`,
    { submit: 'Switch', extra: `<button type="button" class="btn ghost" id="ap-new">${icon('plus')} New athlete</button>${A.list.some((a) => a.demo) ? '' : '<button type="button" class="btn ghost" id="ap-demo">Load example athlete</button>'}`,
      onSubmit: (fd) => { const v = fd.get('cur'); if (v) { A.current = v; persist('athletes'); } },
      onOpen: () => { $('#ap-new').onclick = () => athleteForm(); $('#ap-demo') && ($('#ap-demo').onclick = () => { loadDemo(); closeSheet(); toast('Example athlete loaded'); rerender(); }); } });
}

// ---------- test result ----------
function testForm(testId, rec = null, session = null) {
  if (needAthlete()) return;
  const t0 = testDef(rec?.test || testId) || TESTS[0];
  const body = (t) => {
    const a = curAthlete(), r = rec || {};
    let v = '';
    if (t.input === 'lift') v = `${fld('Load (lb)', inp('load', r.load, { type: 'number', step: '2.5', min: 0 }))}${fld('Reps', inp('reps', r.reps ?? 1, { type: 'number', min: 1 }), { hint: 'Above 1 rep = estimated 1RM (Epley).' })}${fld('Bodyweight on test day (lb)', inp('bw', r.bw ?? a?.weight ?? '', { type: 'number', step: '0.1' }), { hint: 'For relative strength.' })}`;
    else if (t.input === 'attempts') { const n = t.id === 'rsa' ? 6 : t.id === 'rjump' ? 5 : 3, at = r.attempts || []; v = `<div class="fld full"><span>Attempts (${t.unit}) · result = ${t.agg === 'mean' ? 'average' : 'best'}</span><div class="row">${Array.from({ length: n }, (_, i) => `<input type="number" step="any" name="att" aria-label="Attempt ${i + 1}" value="${at[i] ?? ''}" style="width:84px">`).join('')}</div></div>`; }
    else if (t.input === 'time') v = fld(`Result (m:ss)`, inp('value', r.value != null ? fmtClock(r.value) : '', { ph: '6:45' }));
    else v = fld(`Result (${t.unit})`, inp('value', r.value, { type: 'number', step: 'any' }));
    return `<div class="form">
      ${fld('Test', testOptions(t.id), { full: true })}
      <div class="proto full"><h4>Protocol</h4><p>${esc(t.inst || 'Custom test.')}</p>${t.guide ? `<p class="small muted">${esc(t.guide)}</p>` : ''}</div>
      ${fld('Date', inp('date', r.date || session?.date || isoDate(), { type: 'date' }))}${v}
      ${fld('Timing / measurement method', sel('timing', { '': '—', electronic: 'Electronic / gates', hand: 'Hand-timed', video: 'Video', mat: 'Jump mat', vertec: 'Vertec / reach', tape: 'Tape measure', other: 'Other' }, r.cond?.timing ?? session?.timing ?? ''))}
      ${fld('Surface / location', inp('surface', r.cond?.surface ?? session?.surface ?? ''))}
      ${fld('Conditions', inp('cnote', r.cond?.note ?? session?.note ?? '', { ph: 'e.g. after practice, fresh, 2-point start' }), { full: true })}
      ${fld('Notes', `<textarea name="notes" id="f-notes">${esc(r.notes || '')}</textarea>`, { full: true })}</div>`;
  };
  const save = (fd) => {
    const t = testDef(fd.get('test')), date = fd.get('date'); if (!t) return 'Choose a test.'; if (!date) return 'Enter a date.';
    if (date > isoDate()) return 'Date is in the future.';
    const o = { test: t.id, date, cond: { timing: fd.get('timing') || '', surface: String(fd.get('surface') || ''), note: String(fd.get('cnote') || '') }, notes: String(fd.get('notes') || '') };
    if (t.input === 'lift') { const load = num(fd, 'load'), reps = num(fd, 'reps'), bw = num(fd, 'bw'); if (!(load > 0)) return 'Enter the load.'; if (!(reps >= 1) || reps > 20) return 'Reps must be 1–20.'; if (Number.isNaN(bw)) return 'Bodyweight must be a number.'; Object.assign(o, { load, reps: Math.round(reps), bw }); }
    else if (t.input === 'attempts') { const at = fd.getAll('att').map((x) => String(x).trim()).filter(Boolean).map(Number); if (!at.length || at.some((x) => !isFinite(x) || x <= 0)) return 'Enter at least one valid attempt.'; o.attempts = at; }
    else if (t.input === 'time') { const v = parseTime(fd.get('value')); if (!(v > 0)) return 'Enter a time like 6:45.'; o.value = v; }
    else { const v = num(fd, 'value'); if (v == null || Number.isNaN(v)) return 'Enter a result.'; if (v < 0) return 'Result cannot be negative.'; o.value = v; }
    const L = doc('records').list;
    if (rec) { Object.assign(L.find((x) => x.id === rec.id), o); toast('Result updated'); }
    else {
      const prevBest = bestOf(metric(t.id), null);
      const nr = { id: uid('rec'), aid: AID(), ts: Date.now(), ...o, session: session?.id || null }; L.push(nr);
      const v = recValue(nr, t), better = prevBest && (t.dir === 'lower' ? v < prevBest.v : v > prevBest.v);
      toast(better ? `New PR: ${t.name} ${fmtVal(metric(t.id), v)} (prev ${fmtVal(metric(t.id), prevBest.v)})` : prevBest ? 'Result saved' : `First ${t.name} result saved`);
      if (session) session.logged.push(nr.id);
    }
    persist('records');
  };
  const d = openSheet(rec ? 'Edit result' : session ? `Testing session · ${fmtShort(session.date)}` : 'Log test result', body(t0), { submit: rec ? 'Save changes' : 'Save result', onSubmit: save,
    onOpen: (dlg) => { $('#f-test', dlg).onchange = (e) => { const t = testDef(e.target.value), wrap = $('.form', dlg); wrap.outerHTML = body(t); testFormRebind(dlg, body); }; } });
  return d;
}
function testFormRebind(dlg, body) { $('#f-test', dlg).onchange = (e) => { $('.form', dlg).outerHTML = body(testDef(e.target.value)); testFormRebind(dlg, body); }; }

// ---------- basketball entries ----------
function shotTallyForm(rec = null) {
  if (needAthlete()) return;
  const r = rec || { date: isoDate(), ctx: uiGet('ctx', 'workout'), type: 'spotup', pressure: 'open' };
  const zones = { ...Object.fromEntries(Object.entries(ZONES).map(([k, z]) => [k, z.name])), ft: 'Free throws' };
  openSheet(rec ? 'Edit shooting entry' : 'Log shooting set', `<div class="form">
    ${fld('Date', inp('date', r.date, { type: 'date' }))}${fld('Game or workout', sel('ctx', CTX, r.ctx))}
    ${fld('Zone', sel('zone', zones, r.type === 'ft' ? 'ft' : r.zone || shotZone(r) || 'w3L'))}${fld('Shot type', sel('type', Object.fromEntries(Object.entries(SHOT_TYPES).map(([k, v]) => [k, v.name])), r.type === 'ft' ? 'spotup' : r.type), { hint: 'Ignored for free throws.' })}
    ${fld('Makes', inp('makes', r.makes, { type: 'number', min: 0 }))}${fld('Attempts', inp('att', r.att, { type: 'number', min: 1 }))}
    ${fld('Defensive pressure', sel('pressure', PRESSURE, r.pressure))}${fld('Notes', inp('notes', r.notes))}</div>
    ${rec?.x != null ? '<p class="small muted">This shot was placed on the court; its zone comes from the location unless you change it here.</p>' : ''}`, { submit: 'Save', onSubmit: (fd) => {
    const makes = num(fd, 'makes'), att = num(fd, 'att'), date = fd.get('date');
    if (!date) return 'Enter a date.'; if (!(att >= 1) || !Number.isInteger(att)) return 'Attempts must be a whole number of at least 1.'; if (!(makes >= 0) || !Number.isInteger(makes) || makes > att) return 'Makes must be a whole number between 0 and attempts.';
    const zone = fd.get('zone'), o = { date, ctx: fd.get('ctx'), pressure: fd.get('pressure'), makes, att, notes: String(fd.get('notes') || ''), type: zone === 'ft' ? 'ft' : fd.get('type') };
    if (zone !== 'ft') { if (!rec || rec.x == null || zone !== shotZone(rec)) { o.zone = zone; o.x = null; o.y = null; } } else { o.zone = null; o.x = null; o.y = null; }
    uiSet('ctx', o.ctx);
    const L = doc('shots').list; if (rec) Object.assign(L.find((x) => x.id === rec.id), o); else L.push({ id: uid('s'), aid: AID(), ...o });
    persist('shots'); toast(rec ? 'Entry updated' : `Logged ${makes}/${att}`);
  } });
}
function handleForm(rec = null) {
  if (needAthlete()) return;
  const r = rec || { date: isoDate(), drill: 'cross', hand: 'strong', dur: 60, done: true };
  openSheet(rec ? 'Edit handling drill' : 'Log ball-handling drill', `<div class="form">
    ${fld('Date', inp('date', r.date, { type: 'date' }))}${fld('Drill', sel('drill', Object.fromEntries(DRILLS.map((d) => [d.id, d.name])), r.drill))}
    ${fld('Hand', sel('hand', { strong: 'Strong hand', weak: 'Weak hand', both: 'Both / alternating' }, r.hand), { hint: 'Time the same drill with each hand to get the weak-hand ratio.' })}${fld('Duration (s)', inp('dur', r.dur, { type: 'number', min: 1 }))}
    ${fld('Clean reps', inp('reps', r.reps, { type: 'number', min: 0 }))}${fld('Ball losses / errors', inp('tov', r.tov ?? 0, { type: 'number', min: 0 }))}
    <label class="fld full"><span>Completed</span><span class="checks"><label><input type="checkbox" name="done" ${r.done ? 'checked' : ''}> Finished the drill to standard</label></span></label>
    ${fld('Notes', inp('notes', r.notes), { full: true })}</div>`, { submit: 'Save', onSubmit: (fd) => {
    const dur = num(fd, 'dur'), reps = num(fd, 'reps'), tov = num(fd, 'tov') ?? 0;
    if (!fd.get('date')) return 'Enter a date.'; if (!(dur > 0)) return 'Duration must be over 0 seconds.'; if (!(reps >= 0) || !(tov >= 0)) return 'Reps and errors must be 0 or more.';
    const o = { kind: 'handle', date: fd.get('date'), drill: fd.get('drill'), hand: fd.get('hand'), dur, reps, tov, done: !!fd.get('done'), notes: String(fd.get('notes') || '') };
    const L = doc('drills').list; if (rec) Object.assign(L.find((x) => x.id === rec.id), o); else L.push({ id: uid('dr'), aid: AID(), ...o });
    persist('drills'); toast('Drill saved');
  } });
}
function finishForm(rec = null) {
  if (needAthlete()) return;
  const r = rec || { date: isoDate(), type: 'layup', hand: 'R', ctx: 'workout' };
  openSheet(rec ? 'Edit finishing set' : 'Log finishing set', `<div class="form">
    ${fld('Date', inp('date', r.date, { type: 'date' }))}${fld('Finish type', sel('type', FINISH_TYPES, r.type))}
    ${fld('Hand', sel('hand', { R: 'Right hand', L: 'Left hand' }, r.hand))}${fld('Game or workout', sel('ctx', CTX, r.ctx))}
    ${fld('Makes', inp('makes', r.makes, { type: 'number', min: 0 }))}${fld('Attempts', inp('att', r.att, { type: 'number', min: 1 }))}
    ${fld('Notes', inp('notes', r.notes), { full: true })}</div>`, { submit: 'Save', onSubmit: (fd) => {
    const makes = num(fd, 'makes'), att = num(fd, 'att');
    if (!fd.get('date')) return 'Enter a date.'; if (!(att >= 1) || !Number.isInteger(att)) return 'Attempts must be a whole number of at least 1.'; if (!(makes >= 0) || makes > att || !Number.isInteger(makes)) return 'Makes must be between 0 and attempts.';
    const o = { kind: 'finish', date: fd.get('date'), type: fd.get('type'), hand: fd.get('hand'), ctx: fd.get('ctx'), makes, att, notes: String(fd.get('notes') || '') };
    const L = doc('drills').list; if (rec) Object.assign(L.find((x) => x.id === rec.id), o); else L.push({ id: uid('dr'), aid: AID(), ...o });
    persist('drills'); toast(`Logged ${makes}/${att}`);
  } });
}
const GAME_F = [['min', 'Minutes'], ['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['blk', 'Blocks'], ['tov', 'Turnovers'], ['fgm', 'FG made'], ['fga', 'FG attempts'], ['tpm', '3P made'], ['tpa', '3P attempts'], ['ftm', 'FT made'], ['fta', 'FT attempts'], ['pm', 'Plus/minus (optional)']];
function gameForm(rec = null) {
  if (needAthlete()) return;
  const r = rec || { date: isoDate() };
  openSheet(rec ? 'Edit game' : 'Log game', `<div class="form">${fld('Date', inp('date', r.date, { type: 'date' }))}${fld('Opponent', inp('opp', r.opp))}
    ${GAME_F.map(([k, l]) => fld(l, inp(k, r[k], { type: 'number', step: k === 'min' ? '0.5' : '1' }))).join('')}${fld('Notes', inp('notes', r.notes), { full: true })}</div>`, { submit: 'Save game', onSubmit: (fd) => {
    if (!fd.get('date')) return 'Enter a date.';
    const o = { date: fd.get('date'), opp: String(fd.get('opp') || ''), notes: String(fd.get('notes') || '') };
    for (const [k, l] of GAME_F) { const v = num(fd, k); if (Number.isNaN(v)) return `${l} must be a number.`; if (k !== 'pm' && v != null && v < 0) return `${l} cannot be negative.`; o[k] = v ?? (k === 'pm' ? null : 0); }
    if (o.fgm > o.fga || o.tpm > o.tpa || o.ftm > o.fta) return 'Makes cannot exceed attempts.';
    if (o.tpm > o.fgm || o.tpa > o.fga) return '3-pointers are part of field goals: 3P made/attempts cannot exceed FG made/attempts.';
    const calc = 2 * (o.fgm - o.tpm) + 3 * o.tpm + o.ftm; if (o.pts && o.pts !== calc) return `Points (${o.pts}) don't match the shooting line (${calc}). Fix one of them.`;
    if (!o.pts) o.pts = calc;
    const L = doc('games').list; if (rec) Object.assign(L.find((x) => x.id === rec.id), o); else L.push({ id: uid('gm'), aid: AID(), ...o });
    persist('games'); toast('Game saved');
  } });
}
function customTestForm() {
  openSheet('Create custom test', `<div class="form">${fld('Test name', inp('name', '', { req: true }), { full: true })}
    ${fld('Category', sel('cat', Object.fromEntries(PHYS.map((c) => [c, CATS[c].name])), 'speed'))}${fld('Unit', inp('unit', '', { ph: 's, in, reps, lb…' }))}
    ${fld('Better is', sel('dir', { higher: 'Higher', lower: 'Lower' }, 'higher'))}${fld('Decimals', inp('dec', 1, { type: 'number', min: 0 }))}
    ${fld('Reference floor (scores 0)', inp('floor', '', { type: 'number', step: 'any' }), { hint: 'Optional. Leave both blank to track progress without a benchmark score.' })}${fld('Reference elite (scores 100)', inp('elite', '', { type: 'number', step: 'any' }))}
    ${fld('Instructions', `<textarea name="inst" id="f-inst"></textarea>`, { full: true })}</div>`, { submit: 'Create test', onSubmit: (fd) => {
    const name = String(fd.get('name') || '').trim(), unit = String(fd.get('unit') || '').trim(); if (!name) return 'Name the test.'; if (!unit) return 'Give a unit.';
    const floor = num(fd, 'floor'), elite = num(fd, 'elite'), dir = fd.get('dir');
    if ((floor == null) !== (elite == null)) return 'Enter both reference values or neither.';
    if (floor != null && (dir === 'higher' ? elite <= floor : elite >= floor)) return dir === 'higher' ? 'Elite must be above the floor when higher is better.' : 'Elite must be below the floor when lower is better.';
    doc('meta').customTests.push({ id: uid('ct'), custom: true, name, cat: fd.get('cat'), unit, dir, dec: clamp(num(fd, 'dec') ?? 1, 0, 3), input: 'value', ref: floor != null ? { floor, elite } : null, inst: String(fd.get('inst') || '') });
    persist('meta'); toast('Custom test created');
  } });
}
