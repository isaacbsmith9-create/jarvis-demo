// ===================== Personal Team Playbook =====================
// Plays are data: starting spots, roles, and steps of actions. The editor works on the same CourtView as the
// simulator. Rules (what the offense does after each kind of pass, and called actions like Spain) are editable too.
const PB = { tab: 'library', id: null, step: -1, tool: 'move', sel: null, view: null, drag: null, preview: null, confirmDel: null, cat: 'all' };
const pbook = () => doc('playbook');
const playById = (id) => pbook().plays.find((p) => p.id === id);
const TOOLS = { move: 'Move', pass: 'Pass', dribble: 'Dribble', cut: 'Cut', screen: 'Screen' };
const PLAY_CATS = ['Base offense', 'Spain', 'Counters', 'Set plays', 'Inbounds', 'Press break', 'Other'];

/** Positions and ball handler at the start of step k (k = 0 is the first step; -1 = setup). */
function posAtStep(play, k) {
  const pos = { ...play.start }; let ball = play.ball;
  for (let i = 0; i < k && i < play.steps.length; i++) for (const a of play.steps[i].actions) {
    if (a.type === 'pass') ball = a.to;
    else if (a.type === 'screen') pos[a.who] = screenSpot(pos, a);
    else if (a.to) pos[a.who] = a.to;
  }
  return { pos, ball };
}
const screenSpot = (pos, a) => RR(toward(pos[a.for], pos[a.who], 2.2));
function actionLines(play, k, dim) {
  const { pos } = posAtStep(play, k), out = [];
  for (const a of play.steps[k]?.actions || []) {
    if (a.type === 'pass') out.push({ type: 'pass', from: pos[a.from], to: pos[a.to], dim });
    else if (a.type === 'screen') out.push({ type: 'screen', from: pos[a.who], to: screenSpot(pos, a), dim });
    else out.push({ type: a.type, from: pos[a.who], to: a.to, dim });
  }
  return out;
}
function staticTrack(pos, ball) { return compile({ pos, ball }, [{ d: 0.01, m: {} }]); }
const PB_THUMBS = {};
function playThumb(play) {
  const key = play.id + JSON.stringify(play.steps).length + JSON.stringify(play.start);
  if (PB_THUMBS[key]) return PB_THUMBS[key];
  if (!thumbView) thumb(SCENARIOS[0].id);
  const diag = play.steps.flatMap((_, k) => actionLines(play, k, k > 1));
  thumbView.draw(staticTrack(play.start, play.ball), 0, { captions: false, diagram: diag, labels: roleLabels(play) });
  return (PB_THUMBS[key] = thumbView.c.toDataURL('image/jpeg', 0.8));
}
const roleLabels = (play) => Object.fromEntries(OFF.map((o) => [o, `${o.slice(1)} ${play.roles?.[o]?.pos || ''}`.trim()]));

function renderPlaybook() {
  const el = $('#view-playbook');
  if (PB.id && playById(PB.id)) return renderEditor(el, playById(PB.id));
  PB.id = null;
  const plays = pbook().plays, cats = ['all', ...new Set(plays.map((p) => p.cat))];
  const list = plays.filter((p) => PB.cat === 'all' || p.cat === PB.cat);
  el.innerHTML = `
    <div class="page-head"><span class="eyebrow">Personal Team Playbook</span><h1>Our offense</h1><p>Rebuild your school's four-out, one-in offense: plays as steps of passes, cuts, screens and dribbles, plus the rules your team follows after every pass. The Coverage Sim runs these plays against any defense.</p></div>
    <div class="seg" role="group" aria-label="Playbook section"><button type="button" data-pt="library" aria-pressed="${PB.tab === 'library'}">Plays (${plays.length})</button><button type="button" data-pt="rules" aria-pressed="${PB.tab === 'rules'}">Offensive rules (${pbook().rules.length})</button></div>
    ${PB.tab === 'rules' ? rulesHtml() : `
    <div class="row"><button type="button" class="btn green" id="pb-new">${icon('play')} New play</button><div class="filters" role="group" aria-label="Category">${cats.map((c) => `<button type="button" data-pc="${esc(c)}" aria-pressed="${PB.cat === c}">${c === 'all' ? 'All' : esc(c)}</button>`).join('')}</div></div>
    ${list.length ? `<div class="grid">${list.map((p) => `<div class="card scen pb-card"><div class="thumb"><img data-pthumb="${p.id}" alt="Diagram of ${esc(p.name)}" width="420" height="393"></div>
      <div class="body"><div class="meta"><span class="chip">${esc(p.cat)}</span><span class="chip gray">${p.steps.length} step${p.steps.length === 1 ? '' : 's'}</span>${p.parent && playById(p.parent) ? `<span class="chip purple">Variation of ${esc(playById(p.parent).name)}</span>` : ''}</div>
      <h3>${esc(p.name)}</h3><p>${esc(p.note || '')}</p>
      ${PB.confirmDel === p.id ? `<div class="confirm"><b>Delete “${esc(p.name)}”?</b><div class="row"><button type="button" class="btn sm" style="background:var(--red)" data-pdel-yes="${p.id}">Delete</button><button type="button" class="btn ghost sm" data-pdel-no>Cancel</button></div></div>` : ''}
      <div class="row"><button type="button" class="btn sm" data-pedit="${p.id}">Edit</button><button type="button" class="btn ghost sm" data-ppractice="${p.id}">Practice vs defense</button><button type="button" class="btn ghost sm" data-pvar="${p.id}">Variation</button><button type="button" class="btn ghost sm" data-pdel="${p.id}" aria-label="Delete ${esc(p.name)}">Delete</button></div></div></div>`).join('')}</div>`
      : `<div class="empty">${emptyArt()}<h3>No plays in this category</h3><p>Create a play, or switch the filter to All.</p></div>`}`}`;
  for (const b of $$('[data-pt]', el)) b.onclick = () => { PB.tab = b.dataset.pt; renderPlaybook(); };
  for (const b of $$('[data-pc]', el)) b.onclick = () => { PB.cat = b.dataset.pc; renderPlaybook(); };
  $('#pb-new') && ($('#pb-new').onclick = () => { const p = { id: uid('p'), name: 'New play', cat: 'Set plays', note: '', start: { ...BASE_4OUT }, ball: 'O1', roles: JSON.parse(JSON.stringify(BASE_ROLES)), steps: [] }; pbook().plays.push(p); persist('playbook'); openEditor(p.id); });
  for (const b of $$('[data-pedit]', el)) b.onclick = () => openEditor(b.dataset.pedit);
  for (const b of $$('[data-ppractice]', el)) b.onclick = () => { TSIM.playId = b.dataset.ppractice; go('teamsim'); };
  for (const b of $$('[data-pvar]', el)) b.onclick = () => { const src = playById(b.dataset.pvar), p = { ...JSON.parse(JSON.stringify(src)), id: uid('p'), name: src.name + ' (variation)', parent: src.id }; pbook().plays.push(p); persist('playbook'); toast('Variation created'); openEditor(p.id); };
  for (const b of $$('[data-pdel]', el)) b.onclick = () => { PB.confirmDel = b.dataset.pdel; renderPlaybook(); };
  for (const b of $$('[data-pdel-yes]', el)) b.onclick = () => { const pb = pbook(); pb.plays = pb.plays.filter((p) => p.id !== b.dataset.pdelYes); PB.confirmDel = null; persist('playbook'); toast('Play deleted'); renderPlaybook(); };
  for (const b of $$('[data-pdel-no]', el)) b.onclick = () => { PB.confirmDel = null; renderPlaybook(); };
  if (PB.tab === 'rules') bindRules(el);
  const imgs = $$('img[data-pthumb]', el); let i = 0; const stepT = () => { const img = imgs[i++]; if (!img) return; const p = playById(img.dataset.pthumb); if (p && img.isConnected) img.src = playThumb(p); setTimeout(stepT, 0); }; stepT();
}
function openEditor(id) { PB.id = id; PB.step = playById(id).steps.length ? 0 : -1; PB.sel = null; PB.tool = PB.step < 0 ? 'move' : 'pass'; PB.preview = null; renderPlaybook(); window.scrollTo({ top: 0 }); }

// ---------- editor ----------
function renderEditor(el, play) {
  const k = PB.step, st = play.steps[k];
  const holder = posAtStep(play, Math.max(0, k)).ball;
  el.innerHTML = `
    <div class="play-head"><button type="button" class="btn ghost sm" id="pe-back">‹ Playbook</button><div class="ph-title"><span class="eyebrow">Play editor · ${esc(play.cat)}</span><h2>${esc(play.name)}</h2></div>
      <div class="row"><button type="button" class="btn ghost sm" id="pe-preview">${icon('play')} Preview</button><button type="button" class="btn sm" id="pe-practice">Practice vs defense</button></div></div>
    <div class="play-grid">
      <div class="stage-col">
        <div class="stage pickable" id="pe-stage"><canvas id="pe-court" role="img" aria-label="Play diagram editor"></canvas>
          <div class="hud"><div class="hud-mode" data-m="film">${k < 0 ? 'SETUP · DRAG PLAYERS' : `STEP ${k + 1} · ${TOOLS[PB.tool].toUpperCase()}`}</div><div class="hud-prompt" id="pe-hint">${editorHint(play, holder)}</div></div></div>
        <div class="steps-bar" role="tablist" aria-label="Steps">
          <button type="button" class="step-chip" data-step="-1" aria-pressed="${k === -1}">Setup</button>
          ${play.steps.map((s, i) => `<button type="button" class="step-chip" data-step="${i}" aria-pressed="${k === i}">${i + 1}. ${esc(s.label || 'Step')}</button>`).join('')}
          <button type="button" class="step-chip add" id="pe-addstep">+ Step</button></div>
        ${k >= 0 ? `<div class="seg tools" role="group" aria-label="Drawing tool">${Object.entries(TOOLS).map(([t, l]) => `<button type="button" data-tool="${t}" aria-pressed="${PB.tool === t}">${l}</button>`).join('')}</div>` : ''}
        <div class="legend-row"><span><i class="lg cut"></i>Cut</span><span><i class="lg dribble"></i>Dribble</span><span><i class="lg pass"></i>Pass</span><span><i class="lg screen"></i>Screen</span><span><i class="lg move"></i>Move</span></div>
      </div>
      <aside class="panel">
        <div class="form-grid">
          <label class="fld"><span>Play name</span><input type="text" id="pe-name" value="${esc(play.name)}"></label>
          <label class="fld"><span>Category</span><select id="pe-cat">${[...new Set([...PLAY_CATS, play.cat])].map((c) => `<option ${c === play.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="fld"><span>Variation of</span><select id="pe-parent"><option value="">— none —</option>${pbook().plays.filter((p) => p.id !== play.id).map((p) => `<option value="${p.id}" ${p.id === play.parent ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <label class="fld full"><span>Explanation</span><textarea id="pe-note" rows="3">${esc(play.note || '')}</textarea></label>
        </div>
        ${k >= 0 ? `<div class="bd"><h4>Step ${k + 1}</h4>
          <label class="fld"><span>Step name</span><input type="text" id="pe-slabel" value="${esc(st.label || '')}"></label>
          <ul class="act-list">${st.actions.map((a, i) => `<li><span>${actionText(a)}</span><button type="button" class="icon-x" data-adel="${i}" aria-label="Remove action">×</button></li>`).join('') || '<li class="muted small">No actions yet. Pick a tool and tap players on the court.</li>'}</ul>
          <div class="row"><button type="button" class="btn ghost sm" id="pe-rules" ${st.actions.some((a) => a.type === 'pass') ? '' : 'disabled'}>Add next step from our rules</button><button type="button" class="btn ghost sm" id="pe-delstep">Delete step</button></div>
          <p class="hint">Actions in one step happen together. A step can hold one pass.</p></div>` : `<div class="bd"><h4>Setup</h4><p class="small muted">Drag players to their starting spots. Tap a player to give them the ball.</p><div class="row"><button type="button" class="btn ghost sm" id="pe-base">Reset to 4-out, 1-in</button></div></div>`}
        <div class="bd"><h4>Players & responsibilities</h4>
          ${OFF.map((o) => `<div class="resp"><b>${o.slice(1)}</b><select data-rpos="${o}" aria-label="${o} position">${Object.entries(POSITIONS_T).map(([kk, v]) => `<option value="${kk}" ${play.roles?.[o]?.pos === kk ? 'selected' : ''}>${kk} · ${v}</option>`).join('')}</select><textarea data-rresp="${o}" rows="2" aria-label="${o} responsibility" placeholder="Responsibility">${esc(play.roles?.[o]?.resp || '')}</textarea></div>`).join('')}</div>
      </aside>
    </div>`;
  const save = () => { persist('playbook'); };
  $('#pe-back').onclick = () => { PB.id = null; renderPlaybook(); };
  $('#pe-practice').onclick = () => { TSIM.playId = play.id; go('teamsim'); };
  $('#pe-preview').onclick = () => startPreview(play);
  $('#pe-name').onchange = (e) => { play.name = e.target.value.trim() || 'Untitled play'; save(); renderPlaybook(); };
  $('#pe-cat').onchange = (e) => { play.cat = e.target.value; save(); };
  $('#pe-parent').onchange = (e) => { play.parent = e.target.value || null; save(); };
  $('#pe-note').onchange = (e) => { play.note = e.target.value; save(); };
  for (const s of $$('[data-rpos]', el)) s.onchange = () => { (play.roles[s.dataset.rpos] ||= {}).pos = s.value; save(); drawEditor(play); };
  for (const t of $$('[data-rresp]', el)) t.onchange = () => { (play.roles[t.dataset.rresp] ||= {}).resp = t.value; save(); };
  for (const b of $$('[data-step]', el)) b.onclick = () => { PB.step = Number(b.dataset.step); PB.sel = null; if (PB.step < 0) PB.tool = 'move'; else if (PB.tool === 'move' && !play.steps[PB.step].actions.length) PB.tool = 'pass'; renderPlaybook(); };
  $('#pe-addstep').onclick = () => { play.steps.push({ label: 'Step ' + (play.steps.length + 1), actions: [] }); PB.step = play.steps.length - 1; PB.tool = 'pass'; save(); renderPlaybook(); };
  for (const b of $$('[data-tool]', el)) b.onclick = () => { PB.tool = b.dataset.tool; PB.sel = null; renderPlaybook(); };
  if (k >= 0) {
    $('#pe-slabel').onchange = (e) => { st.label = e.target.value; save(); renderPlaybook(); };
    for (const b of $$('[data-adel]', el)) b.onclick = () => { st.actions.splice(Number(b.dataset.adel), 1); save(); renderPlaybook(); };
    $('#pe-delstep').onclick = () => { play.steps.splice(k, 1); PB.step = Math.min(k, play.steps.length - 1); save(); renderPlaybook(); };
    $('#pe-rules').onclick = () => { const n = stepFromRules(play, k); if (!n) return toast('No team rule matches this pass'); play.steps.splice(k + 1, 0, n); PB.step = k + 1; save(); toast(`Added: ${n.label}`); renderPlaybook(); };
  } else $('#pe-base').onclick = () => { play.start = { ...BASE_4OUT }; play.ball = 'O1'; save(); renderPlaybook(); };
  PB.view = new CourtView($('#pe-court'));
  bindEditorCanvas(play);
  drawEditor(play);
}
const actionText = (a) => ({ pass: () => `Pass ${a.from} → ${a.to}`, dribble: () => `${a.who} dribbles to ${SPOT_LABEL[spotName(a.to)]}`, cut: () => `${a.who} cuts to ${SPOT_LABEL[spotName(a.to)]}`, move: () => `${a.who} moves to ${SPOT_LABEL[spotName(a.to)]}`, screen: () => `${a.who} screens for ${a.for}` })[a.type]();
function editorHint(play, holder) {
  if (PB.step < 0) return 'Drag players to set the formation. Tap a player to give him the ball.';
  const t = PB.tool, s = PB.sel;
  if (t === 'pass') return s ? `Now tap the receiver for ${s}'s pass` : `Tap the passer (ball: ${holder})`;
  if (t === 'screen') return s ? `Tap the player ${s} screens for` : 'Tap the screener';
  return s ? `Tap where ${s} ${t === 'dribble' ? 'dribbles' : t === 'cut' ? 'cuts' : 'moves'} to` : `Tap the player who ${t === 'dribble' ? 'dribbles (must have the ball)' : t === 'cut' ? 'cuts' : 'moves'}`;
}
function drawEditor(play, t = 0) {
  if (!PB.view) return;
  const k = Math.max(0, PB.step), { pos, ball } = PB.step < 0 ? { pos: play.start, ball: play.ball } : posAtStep(play, k);
  const diag = PB.step < 0 ? [] : [...(k > 0 ? actionLines(play, k - 1, true) : []), ...actionLines(play, k, false)];
  PB.view.draw(staticTrack(pos, ball), t, { captions: false, diagram: diag, labels: roleLabels(play), you: ball, highlight: PB.sel, spotlight: false });
}
function bindEditorCanvas(play) {
  const cv = $('#pe-court');
  const at = (e) => { const r = cv.getBoundingClientRect(); return PB.view.toCourt(e.clientX - r.left, e.clientY - r.top).map((v) => Math.round(v * 2) / 2); };
  const k = Math.max(0, PB.step), cur = () => (PB.step < 0 ? { pos: play.start, ball: play.ball } : posAtStep(play, k));
  const hit = (p) => { const { pos } = cur(); let best = null, bd = 3.2; for (const o of OFF) { const d = dist(pos[o], p); if (d < bd) { bd = d; best = o; } } return best; };
  cv.onpointerdown = (e) => {
    const p = at(e), who = hit(p);
    if (PB.step < 0) { if (who) { PB.drag = { who, moved: false }; cv.setPointerCapture(e.pointerId); } return; }
    const st = play.steps[PB.step], { ball } = cur(), t = PB.tool;
    if (!PB.sel) {
      if (!who) return;
      if ((t === 'pass' || t === 'dribble') && who !== ball) return toast(`${who} doesn't have the ball at this step (${ball} does)`);
      if (t === 'pass' && st.actions.some((a) => a.type === 'pass')) return toast('This step already has a pass. Add a new step.');
      PB.sel = who; $('#pe-hint').textContent = editorHint(play, ball); drawEditor(play); return;
    }
    const s = PB.sel;
    if (t === 'pass') { if (!who || who === s) return toast('Tap a teammate to receive the pass'); st.actions.push({ type: 'pass', from: s, to: who }); }
    else if (t === 'screen') { if (!who || who === s) return toast('Tap the teammate being screened'); st.actions.push({ type: 'screen', who: s, for: who }); }
    else { st.actions = st.actions.filter((a) => !(a.who === s && ['move', 'cut', 'dribble'].includes(a.type))); st.actions.push({ type: t, who: s, to: [clamp(p[0], -24.5, 24.5), clamp(p[1], 1, 40)] }); }
    PB.sel = null; persist('playbook'); renderPlaybook();
  };
  cv.onpointermove = (e) => { if (!PB.drag) return; PB.drag.moved = true; const p = at(e); play.start[PB.drag.who] = [clamp(p[0], -24.5, 24.5), clamp(p[1], 1, 40)]; drawEditor(play); };
  cv.onpointerup = () => { if (!PB.drag) return; const d = PB.drag; PB.drag = null; if (!d.moved) { play.ball = d.who; toast(`${d.who} starts with the ball`); } persist('playbook'); drawEditor(play); };
}
/** Translate the matching team rule into an editable step. */
function stepFromRules(play, k) {
  const pass = play.steps[k].actions.find((a) => a.type === 'pass'), { pos } = posAtStep(play, k);
  const fromRole = roleAt(pos[pass.from]), toRole = roleAt(pos[pass.to]);
  const r = pbook().rules.find((x) => x.on.type === 'pass' && (x.on.from === fromRole || x.on.from === 'any') && (x.on.to === toRole || x.on.to === 'any'));
  if (!r) return null;
  const after = posAtStep(play, k + 1).pos, acts = [];
  for (const t of r.then) {
    const who = t.who === 'passer' ? pass.from : t.who === 'receiver' ? pass.to : null; if (!who) continue;
    if (t.verb === 'screenAway') { const cutter = OFF.filter((o) => o !== who && o !== pass.to && sgn(after[o][0]) === sgn(after[who][0]) && roleAt(after[o]) !== 'slot' && distHoop(after[o]) > 13)[0]; if (cutter) { acts.push({ type: 'screen', who, for: cutter }); acts.push({ type: 'cut', who: cutter, to: after[who] }); } }
    if (t.verb === 'cutThrough') { acts.push({ type: 'cut', who, to: [sgn(after[pass.to][0]) * -2.5, 8] }); }
    if (t.verb === 'basketCut') acts.push({ type: 'cut', who, to: [sgn(after[who][0]) * 2.5, 8] });
    if (t.verb === 'postUp') acts.push({ type: 'move', who, to: SPOTS[sgn(after[pass.to][0]) < 0 ? 'postL' : 'postR'] });
  }
  return acts.length ? { label: r.name.split(':').pop().trim(), actions: acts } : null;
}
/** Animate the whole play (offense only). */
function startPreview(play) {
  const beats = []; let { pos, ball } = { pos: { ...play.start }, ball: play.ball };
  for (const st of play.steps) {
    const m = {}; let pass = null, scr = null;
    for (const a of st.actions) { if (a.type === 'pass') pass = a; else if (a.type === 'screen') { m[a.who] = screenSpot(pos, a); scr = a; } else m[a.who] = a.to; }
    if (Object.keys(m).length) beats.push({ d: 1.1, m, ball, cap: st.label, screen: scr?.who });
    Object.assign(pos, m);
    if (pass) { beats.push({ d: 0.7, m: {}, ball: { pass: [pass.from, pass.to] }, cap: st.label }); ball = pass.to; }
  }
  if (!beats.length) return toast('Add steps to preview the play');
  const tr = compile({ pos: { ...play.start }, ball: play.ball }, beats);
  const t0 = performance.now(); cancelAnimationFrame(PB.raf);
  const stepF = (now) => { const t = (now - t0) / 1000; if (!$('#pe-court') || $('#view-playbook').hidden) return; PB.view.draw(tr, Math.min(t, tr.t1), { labels: roleLabels(play), you: stateAt(tr, Math.min(t, tr.t1)).holder || ball }); if (t < tr.t1 + 0.6) PB.raf = requestAnimationFrame(stepF); else drawEditor(play); };
  PB.raf = requestAnimationFrame(stepF);
}

// ---------- rules ----------
function rulesHtml() {
  const R = pbook().rules;
  return `<p class="muted">Rules tell the simulator what our players do after each kind of pass, and what a called action (like Spain) means. Add rules as you learn more of the offense.</p>
    <div class="rules">${R.map((r, i) => `<div class="card rule"><div class="row"><b class="grow">${esc(r.name)}</b><button type="button" class="btn ghost sm" data-rdel="${i}">Delete</button></div>
      <div class="rule-grid">${r.on.type === 'pass' ? `<label class="fld"><span>When the ball goes from</span><select data-rf="${i}">${Object.entries(TRIGGER_ROLES).map(([k, v]) => `<option value="${k}" ${r.on.from === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="fld"><span>to</span><select data-rt="${i}">${Object.entries(TRIGGER_ROLES).map(([k, v]) => `<option value="${k}" ${r.on.to === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : `<label class="fld"><span>Called action</span><input type="text" value="${esc(r.on.call)}" disabled></label>`}
      ${r.then.map((t, j) => `<label class="fld"><span>${j ? 'and' : 'then'} the</span><select data-rw="${i}:${j}">${Object.entries(RESP_WHO).map(([k, v]) => `<option value="${k}" ${t.who === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="fld"><span>does</span><select data-rv="${i}:${j}">${Object.entries(VERBS).map(([k, v]) => `<option value="${k}" ${t.verb === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>`).join('')}</div>
      <label class="fld"><span>Coaching note</span><textarea data-rn="${i}" rows="2">${esc(r.note || '')}</textarea></label></div>`).join('')}</div>
    <div class="row"><button type="button" class="btn" id="rule-add">+ Add pass rule</button><button type="button" class="btn ghost" id="rule-reset">Restore starting rules</button></div>
    <p class="hint">Movement verbs: ${Object.values(VERBS).map((v) => `<b>${v.name}</b> (${esc(v.desc)})`).join(' · ')}</p>`;
}
function bindRules(el) {
  const R = pbook().rules, save = () => persist('playbook');
  for (const s of $$('[data-rf]', el)) s.onchange = () => { R[+s.dataset.rf].on.from = s.value; R[+s.dataset.rf].name = autoRuleName(R[+s.dataset.rf]); save(); renderPlaybook(); };
  for (const s of $$('[data-rt]', el)) s.onchange = () => { R[+s.dataset.rt].on.to = s.value; R[+s.dataset.rt].name = autoRuleName(R[+s.dataset.rt]); save(); renderPlaybook(); };
  for (const s of $$('[data-rw]', el)) s.onchange = () => { const [i, j] = s.dataset.rw.split(':').map(Number); R[i].then[j].who = s.value; save(); };
  for (const s of $$('[data-rv]', el)) s.onchange = () => { const [i, j] = s.dataset.rv.split(':').map(Number); R[i].then[j].verb = s.value; if (R[i].on.type === 'pass') R[i].name = autoRuleName(R[i]); save(); renderPlaybook(); };
  for (const t of $$('[data-rn]', el)) t.onchange = () => { R[+t.dataset.rn].note = t.value; save(); };
  for (const b of $$('[data-rdel]', el)) b.onclick = () => { R.splice(+b.dataset.rdel, 1); save(); renderPlaybook(); };
  $('#rule-add').onclick = () => { const r = { id: uid('r'), on: { type: 'pass', from: 'wing', to: 'post' }, then: [{ who: 'passer', verb: 'basketCut' }], note: '' }; r.name = autoRuleName(r); R.push(r); save(); renderPlaybook(); };
  $('#rule-reset').onclick = () => { pbook().rules = JSON.parse(JSON.stringify(DEFAULT_RULES)); save(); toast('Starting rules restored'); renderPlaybook(); };
}
const autoRuleName = (r) => `${TRIGGER_ROLES[r.on.from]} to ${TRIGGER_ROLES[r.on.to].toLowerCase()}: ${VERBS[r.then[0]?.verb]?.name.toLowerCase() || '—'}`;
