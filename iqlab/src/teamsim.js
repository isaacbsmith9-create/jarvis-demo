// ===================== Defense vs. Our Offense: Coverage Simulator =====================
const SHOT_CLOCK = 30;
const TS_MODES = {
  learn: { name: 'Learning', desc: 'Everything explained: what our action does, how the defense reacts, and who comes open, before you decide.', window: null, reveal: true, decisions: 14 },
  practice: { name: 'Practice', desc: 'Run a play against a coverage you pick. No hints before you decide.', window: 7, reveal: false, decisions: 14 },
  challenge: { name: 'Challenge', desc: 'Random play, random defense, random intensity. Graded.', window: 5, reveal: false, decisions: 14, random: true },
  elite: { name: 'Elite', desc: 'Disguised coverages that change mid-possession, high intensity, shorter decision windows.', window: 3.5, reveal: false, decisions: 14, random: true, elite: true },
  prep: { name: 'Team Prep', desc: 'Pick our play and the opponent\'s defense. Five reps, then a scouting report of what worked.', window: 6, reveal: false, decisions: 14, reps: 5 },
};
const TSIM = { pause: uiGet('tsPause', false), mode: uiGet('tsMode', 'practice'), playId: null, cov: uiGet('tsCov', 'man'), intensity: 2, phase: 'setup', S: null, track: null, t: 0, tEnd: 0, playing: false, raf: 0, last: 0, A: null, opts: null, dec: [], decideAt: 0, view: null, prep: null, reveal: null, revealAt: -1, ov: { lanes: false, help: false } };

function renderTeamSim() {
  const el = $('#view-teamsim');
  if (TSIM.phase !== 'setup' && TSIM.S) return renderTSRun(el);
  const plays = pbook().plays; if (!TSIM.playId || !playById(TSIM.playId)) TSIM.playId = plays[0]?.id || null;
  const M = TS_MODES[TSIM.mode];
  el.innerHTML = `
    <div class="page-head"><span class="eyebrow">Defense vs. our offense</span><h1>Coverage Sim</h1><p>Run our plays against 12 defensive coverages. All ten players move by rules: defenders position from their coverage, the ball and the screens being set. The play freezes at each decision, you make the read, and the possession continues from what you chose.</p></div>
    <div class="mode-pick ts-modes">${Object.entries(TS_MODES).map(([k, m]) => `<button type="button" class="mode-card" data-tsmode="${k}" aria-pressed="${TSIM.mode === k}"><b>${m.name}</b><span>${m.desc}</span></button>`).join('')}</div>
    <div class="card ts-setup">
      ${plays.length ? `<label class="fld"><span>Our play</span><select id="ts-play">${plays.map((p) => `<option value="${p.id}" ${p.id === TSIM.playId ? 'selected' : ''}>${esc(p.name)} · ${esc(p.cat)}</option>`).join('')}</select></label>` : '<p>Create a play in the Playbook first.</p>'}
      ${M.random ? `<p class="small muted">${M.name} mode picks the play${M.elite ? ', a disguised coverage that changes mid-possession,' : ' and the defense'} at random.</p>` : `<label class="fld"><span>Defense</span><select id="ts-cov">${['Man', 'Ball screens', 'Zone'].map((g) => `<optgroup label="${g}">${Object.entries(COVERAGES).filter(([, c]) => c.group === g).map(([k, c]) => `<option value="${k}" ${k === TSIM.cov ? 'selected' : ''}>${c.name}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <div class="fld"><span>Intensity</span><div class="seg" role="group" aria-label="Intensity">${[1, 2, 3].map((i) => `<button type="button" data-int="${i}" aria-pressed="${TSIM.intensity === i}">${INTENSITY[i]}</button>`).join('')}</div></div>`}
      ${!M.random ? `<p class="small muted" id="ts-covdesc">${esc(COVERAGES[TSIM.cov].desc)}</p>` : ''}
      ${pauseToggle()}
      <button type="button" class="btn green" id="ts-start" ${plays.length ? '' : 'disabled'}>${icon('play')} ${TSIM.mode === 'prep' ? 'Start 5-rep prep' : 'Start possession'}</button>
    </div>
    <div class="card dc-link"><span class="small"><b>Switch sides:</b> guard our own plays in the Defense center. The defensive positioning tests are built from your playbook.</span><button type="button" class="btn ghost sm" id="ts-defend">Defend our plays ›</button></div>
    ${tsHistory()}`;
  $('#ts-defend').onclick = () => { DC.mod = 'team'; DC.sub = 'setup'; DC.run = null; go('defense'); };
  for (const b of $$('[data-tsmode]', el)) b.onclick = () => { TSIM.mode = b.dataset.tsmode; uiSet('tsMode', TSIM.mode); renderTeamSim(); };
  $('#ts-play') && ($('#ts-play').onchange = (e) => { TSIM.playId = e.target.value; });
  $('#ts-cov') && ($('#ts-cov').onchange = (e) => { TSIM.cov = e.target.value; uiSet('tsCov', TSIM.cov); $('#ts-covdesc').textContent = COVERAGES[TSIM.cov].desc; });
  bindPause(el);
  for (const b of $$('[data-int]', el)) b.onclick = () => { TSIM.intensity = Number(b.dataset.int); renderTeamSim(); };
  $('#ts-start').onclick = () => { if (TSIM.mode === 'prep') TSIM.prep = { reps: [], cov: TSIM.cov, playId: TSIM.playId, intensity: TSIM.intensity }; else TSIM.prep = null; startTS(); };
  mountTSCharts(el);
}
function startTS() {
  const M = TS_MODES[TSIM.mode], plays = pbook().plays, seed = (Math.random() * 2 ** 31) >>> 0, r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  let play = playById(TSIM.playId), covPlan = [{ cov: TSIM.cov }], intensity = TSIM.intensity;
  if (M.random) {
    play = pick(plays);
    const keys = Object.keys(COVERAGES), a = pick(keys);
    covPlan = [{ cov: a }]; intensity = M.elite ? 3 : pick([1, 2, 3]);
    if (M.elite) { let b = pick(keys); while (b === a) b = pick(keys); covPlan.push({ cov: b, from: 1 + Math.floor(r() * 2) }); }
  }
  if (TSIM.prep) { play = playById(TSIM.prep.playId); covPlan = [{ cov: TSIM.prep.cov }]; intensity = TSIM.prep.intensity; }
  const S = newPossession({ play, covPlan, intensity, mode: TSIM.mode, seed });
  advanceScript(S);
  Object.assign(TSIM, { violation: false, over: false, S, dec: [], phase: 'running', t: 0, playing: true, reveal: null, revealAt: -1 });
  compileTS(); TSIM.target = TSIM.tEnd; nextDecisionReady();
  renderTSRun($('#view-teamsim')); tsLoop(); courtIntoView();
}
function compileTS() { TSIM.track = compile(TSIM.S.start, TSIM.S.beats, { make: TSIM.S.make }); TSIM.tEnd = TSIM.track.t1; }
/** Prepare the analysis and options for the coming decision (computed now, revealed only after the choice in testing modes). */
function nextDecisionReady() {
  const S = TSIM.S, M = TS_MODES[TSIM.mode], k = TSIM.dec.length;
  const change = S.cfg.covPlan.find((c) => c.from === k);
  if (change && S.cov !== change.cov) { const old = covOf(S).name; S.cov = change.cov; beat(S, 1.0, {}, S.ball, [], `Defense changes: ${old} → ${covOf(S).name}`); S.covChanged = true; compileTS(); }
  TSIM.A = analyze(S); TSIM.opts = optionsFor(S, TSIM.A);
  S.covChanged = false;
}
function tsLoop() {
  cancelAnimationFrame(TSIM.raf); TSIM.last = performance.now();
  const step = (now) => {
    if ($('#view-teamsim').hidden || !$('#ts-court')) return;
    const dt = Math.min(0.05, (now - TSIM.last) / 1000); TSIM.last = now;
    if (TSIM.playing) { TSIM.t = Math.min(TSIM.target, TSIM.t + dt); if (TSIM.t >= TSIM.target - 1e-6) { TSIM.playing = false; arrive(); } }
    if (TSIM.phase === 'decide' && TS_MODES[TSIM.mode].window) {
      const w = TS_MODES[TSIM.mode].window, el = (now - TSIM.decideAt) / 1000, f = clamp(el / w, 0, 1);
      const ring = $('#hud-ring-ts'); if (ring) { ring.style.strokeDashoffset = String(119.4 * f); ring.style.stroke = f > 0.7 ? 'var(--red)' : f > 0.4 ? 'var(--amber)' : 'var(--green)'; $('#hud-n-ts').textContent = Math.max(0, w - el).toFixed(1); }
      if (f >= 1) chooseTS({ id: 'hold', kind: 'hold', label: 'Held the ball (window ran out)', ev: 0.6, principle: false });
    }
    drawTS(); updateTSTimeline(); updateShotClock();
    TSIM.raf = requestAnimationFrame(step);
  };
  TSIM.raf = requestAnimationFrame(step);
}
function updateShotClock() {
  const el = $('#ts-clock'); if (!el || !TSIM.track) return;
  let shotT = Infinity; for (const sg of TSIM.track.segs) if (isShotBall(sg.ball)) { shotT = sg.t0; break; }
  const left = Math.max(0, SHOT_CLOCK - Math.min(TSIM.t, shotT));
  el.querySelector('b').textContent = left.toFixed(1); el.classList.toggle('low', left <= 5);
}
function arrive() {
  if (TSIM.phase === 'running') { TSIM.phase = 'decide'; TSIM.decideAt = performance.now(); renderTSRun($('#view-teamsim')); }
  else if (TSIM.phase === 'outcome') {
    if (TSIM.over) return finishTS();
    if (!TSIM.pause) return continueTS(); // keep the possession flowing into the next read
    renderTSRun($('#view-teamsim'));
  }
}
function drawTS() {
  if (!TSIM.view || !TSIM.track) return;
  const S = TSIM.S, st = stateAt(TSIM.track, TSIM.t), M = TS_MODES[TSIM.mode];
  const o = { you: st.holder || S.ball, labels: Object.fromEntries(OFF.map((x) => [x, x.slice(1) + ' ' + (S.cfg.play.roles?.[x]?.pos || '')])) };
  const showReveal = (TSIM.phase === 'decide' && M.reveal) || (TSIM.reveal && Math.abs(TSIM.t - TSIM.revealAt) < 0.05);
  if (showReveal) { const R = TSIM.phase === 'decide' ? whyOpen(S, TSIM.A) : TSIM.reveal.why; o.reveal = R.map((r) => ({ id: r.o, tag: r.tag })); const A = TSIM.phase === 'decide' ? TSIM.A : TSIM.reveal.A; o.window = { id: A.H, state: A.window }; }
  if (M.reveal || TSIM.phase === 'done' || TSIM.phase === 'outcome') o.overlays = { lanes: TSIM.ov.lanes, links: TSIM.ov.help };
  if (TSIM.phase === 'decide' && !M.reveal) o.overlays = { lanes: false, links: false };
  const hv = TSIM.phase === 'decide' && TSIM.hover;
  if (hv) {
    if (hv.type === 'pass') o.diagram = [{ type: 'pass', from: hv.from, to: st.pos[hv.to], label: 'Pass to ' + hv.to }];
    else if (hv.type === 'dribble') o.diagram = [{ type: 'dribble', from: hv.from, to: hv.at, label: hv.attack ? 'Attack the rim' : 'Dribble here' }];
    else if (hv.type === 'rim') o.diagram = [{ type: 'dribble', from: hv.from, to: hv.opt.at, label: 'Drive & finish' }];
    else if (hv.type === 'shoot') o.diagram = [{ type: 'pass', from: hv.from, to: [0, 5.6], label: hv.opt ? 'Shoot' : 'Out of range', color: hv.opt ? 'rgba(255,140,90,.95)' : 'rgba(160,170,190,.8)' }];
  }
  TSIM.view.draw(TSIM.track, TSIM.t, o);
}
function updateTSTimeline() {
  const rg = $('#ts-range'); if (!rg) return;
  rg.max = String(TSIM.tEnd); if (document.activeElement !== rg) rg.value = String(TSIM.t);
  $('#ts-time').textContent = TSIM.t.toFixed(1) + 's';
}
const decisionLabelOf = (o) => o.label;
function chooseTS(opt) {
  if (TSIM.phase !== 'decide') return;
  const S = TSIM.S, M = TS_MODES[TSIM.mode], A = TSIM.A, opts = TSIM.opts;
  const el = (performance.now() - TSIM.decideAt) / 1000;
  const timing = M.window ? (opt.kind === 'hold' ? 0 : Math.round(100 - 70 * clamp((el / M.window - 0.4) / 0.6, 0, 1))) : null;
  const all = opts.includes(opt) ? opts : [...opts, opt];
  const g = gradeTeamDecision(A, all, opt, { timing });
  const why = whyOpen(S, A), notesBefore = S.notes.filter((n) => n.at <= S.t + 1e-6 && n.at > (TSIM.dec.at(-1)?.tAfter ?? -1));
  const tDecision = S.t, res = applyChoice(S, opt, A);
  compileTS();
  const exec = res.result === 'tov' ? false : res.result === 'miss' ? false : true;
  const d = { i: TSIM.dec.length, tDecision, tAfter: S.t, cov: S.cov, covName: covOf(S).name, label: opt.label, kind: opt.kind, choice: opt, best: g.best, score: g.score, parts: g.parts, why, A, notes: notesBefore, res, exec, quad: quadrant(g.score, exec), rt: el, opts: all };
  TSIM.hover = null;
  TSIM.dec.push(d);
  TSIM.reveal = { why, A }; TSIM.revealAt = tDecision;
  TSIM.phase = 'outcome'; TSIM.target = TSIM.tEnd; TSIM.t = tDecision; TSIM.playing = true;
  TSIM.over = res.ended || TSIM.dec.length >= M.decisions;
  if (!TSIM.over && SHOT_CLOCK - S.t <= 0.6) { beat(S, 0.8, {}, S.ball, [], 'Shot-clock violation'); compileTS(); TSIM.target = TSIM.tEnd; TSIM.over = true; TSIM.violation = true; d.res = { ...d.res, result: 'violation', txt: d.res.txt + ' The shot clock ran out.' }; }
  renderTSRun($('#view-teamsim'));
}
function continueTS() {
  if (TSIM.over) return finishTS();
  if (TSIM.phase !== 'outcome') return;
  nextDecisionReady(); TSIM.phase = 'decide'; TSIM.decideAt = performance.now(); TSIM.t = TSIM.tEnd; renderTSRun($('#view-teamsim'));
  courtIntoView();
}
/** On phones the panel sits under the court: bring the court back on screen for each decision. */
function courtIntoView() { if (window.innerWidth < 1020) $('#ts-stage')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
function finishTS() {
  TSIM.phase = 'done';
  const S = TSIM.S, D = TSIM.dec, last = D.at(-1)?.res || {};
  const score = D.length ? Math.round(mean(D.map((d) => d.score))) : 0;
  const entry = { id: uid('t'), ts: Date.now(), mode: TSIM.mode, play: S.cfg.play.name, playId: S.cfg.play.id, covs: [...new Set(S.cfg.covPlan.map((c) => c.cov))], intensity: S.intensity, score, result: TSIM.violation ? 'violation' : last.result === 'cont' ? 'none' : last.result || 'none', pts: last.pts || 0,
    decisions: D.map((d) => ({ score: d.score, parts: d.parts, label: d.label, best: d.best.label, kind: d.kind, quad: d.quad.k, cov: d.cov })) };
  const L = doc('team').list; L.push(entry); if (L.length > 200) L.splice(0, L.length - 200); persist('team');
  if (TSIM.prep) TSIM.prep.reps.push({ entry, D });
  TSIM.saved = entry;
  renderTSRun($('#view-teamsim'));
}

// ---------- run view ----------
function renderTSRun(el) {
  const S = TSIM.S, M = TS_MODES[TSIM.mode], ph = TSIM.phase, cov = covOf(S);
  const showCov = M.reveal || ph === 'outcome' || ph === 'done' || (!M.random);
  if (!$('#ts-court') || !el.querySelector('.ts-run')) {
    el.innerHTML = `<div class="ts-run">
      <div class="play-head"><button type="button" class="btn ghost sm" id="ts-back">‹ Coverage Sim</button><div class="ph-title"><span class="eyebrow" id="ts-eyebrow"></span><h2 id="ts-title"></h2></div></div>
      <div class="play-grid"><div class="stage-col">
        <div class="stage" id="ts-stage"><canvas id="ts-court" role="img" aria-label="Five-on-five simulation"></canvas>
          <div class="hud"><div class="hud-mode" data-m="film" id="ts-mode-hud"></div><div class="hud-clock" id="ts-clock"><small>SHOT CLOCK</small><b>30.0</b></div>
            <div class="hud-count" id="ts-count" hidden><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="ring-bg"></circle><circle cx="22" cy="22" r="19" class="ring-fg" id="hud-ring-ts"></circle></svg><b id="hud-n-ts"></b></div>
            <div class="hud-prompt" id="ts-prompt" hidden></div></div></div>
        <div class="timeline"><button type="button" class="icon-btn" id="ts-replay" aria-label="Replay possession">${icon('restart')}</button><div class="tl-track"><input type="range" id="ts-range" min="0" max="10" step="0.01" value="0" aria-label="Possession timeline"><div class="tl-marks" id="ts-marks"></div></div><span class="tl-time" id="ts-time">0.0s</span></div>
        <div class="overlays" id="ts-ovs"><button type="button" class="tog" data-tov="lanes"><span class="sw lanes"></span>Passing lanes</button><button type="button" class="tog" data-tov="help"><span class="sw help"></span>Help defense</button></div>
      </div><aside class="panel" id="ts-panel" aria-live="polite"></aside></div></div>`;
    TSIM.view = new CourtView($('#ts-court'));
    $('#ts-back').onclick = () => { TSIM.phase = 'setup'; TSIM.S = null; renderTeamSim(); };
    $('#ts-replay').onclick = () => { if (['outcome', 'done'].includes(TSIM.phase)) { TSIM.t = 0; TSIM.target = TSIM.tEnd; TSIM.playing = true; } };
    $('#ts-range').addEventListener('input', (e) => { if (!['outcome', 'done'].includes(TSIM.phase)) { e.target.value = String(TSIM.t); return; } TSIM.playing = false; TSIM.t = Number(e.target.value); });
    for (const b of $$('[data-tov]', el)) b.onclick = () => { TSIM.ov[b.dataset.tov] = !TSIM.ov[b.dataset.tov]; b.setAttribute('aria-pressed', String(TSIM.ov[b.dataset.tov])); };
    const cv = $('#ts-court');
    cv.addEventListener('pointerdown', (e) => {
      if (TSIM.phase !== 'decide') return;
      const a = courtTarget(e); TSIM.hover = null; if (!a) return;
      if (a.type === 'pass') return chooseTS(a.opt);
      if (a.type === 'shoot') return a.opt ? chooseTS(a.opt) : toast('Too far to shoot from here. Tap open floor to dribble closer.');
      if (a.type === 'rim') return chooseTS(a.opt);
      if (a.type === 'defender') return toast(`That's X${a.id[1]}. Tap a teammate to pass, your player to shoot, or open floor to dribble.`);
      chooseTS(dribbleOption(TSIM.S, TSIM.A, a.at));
    });
    cv.addEventListener('pointermove', (e) => { if (TSIM.phase !== 'decide' || e.pointerType === 'touch') return; TSIM.hover = courtTarget(e); });
    cv.addEventListener('pointerleave', () => { TSIM.hover = null; });
  }
  $('#ts-eyebrow').textContent = `${M.name}${TSIM.prep ? ` · rep ${TSIM.prep.reps.length + (ph === 'done' ? 0 : 1)} of 5` : ''} · ${INTENSITY[S.intensity]} intensity`;
  $('#ts-title').textContent = `${S.cfg.play.name} vs ${showCov ? cov.name : '???'}`;
  $('#ts-mode-hud').textContent = ph === 'decide' ? `DECISION ${TSIM.dec.length + 1}` : ph === 'done' ? 'POSSESSION OVER' : 'LIVE';
  $('#ts-count').hidden = !(ph === 'decide' && M.window);
  const pr = $('#ts-prompt'); pr.hidden = ph !== 'decide'; pr.textContent = `You have the ball (${S.ball}). What's the read?`;
  $('#ts-ovs').hidden = !(M.reveal || ph === 'outcome' || ph === 'done');
  $('#ts-marks').innerHTML = TSIM.dec.map((d) => `<i data-k="decision" style="left:${(d.tDecision / TSIM.tEnd) * 100}%" title="Decision ${d.i + 1}"></i>`).join('');
  $('#ts-stage').classList.toggle('pickable', ph === 'decide');
  const P = $('#ts-panel');
  if (ph === 'running') P.innerHTML = `<div class="decide-head"><span class="eyebrow">Running the play</span><h3>${esc(S.cfg.play.name)}</h3></div><p class="brief">${esc(S.cfg.play.note || '')}</p>${M.reveal ? learnNotes(S) : '<p class="hint">Watch the defense react. The play will freeze at your decision.</p>'}`;
  else if (ph === 'decide') renderDecide(P);
  else if (ph === 'outcome') renderOutcome(P);
  else if (ph === 'done') renderSummary(P);
}
/** What a tap/click at this spot means: pass to a teammate, shoot (your player or the ball), or dribble to open floor. */
function courtTarget(e) {
  const r = $('#ts-court').getBoundingClientRect(), p = TSIM.view.toCourt(e.clientX - r.left, e.clientY - r.top), st = stateAt(TSIM.track, TSIM.t), H = TSIM.S.ball;
  if (dist(st.pos[H], p) < 3 || dist([st.ball.x, st.ball.y], p) < 2.2) return { type: 'shoot', opt: TSIM.opts.find((x) => x.kind === 'shoot'), from: st.pos[H] };
  let best = null, bd = 3.5; for (const o of OFF) { if (o === H) continue; const d = dist(st.pos[o], p); if (d < bd) { bd = d; best = o; } }
  if (best) { const opt = TSIM.opts.find((x) => x.kind === 'pass' && x.to === best); if (opt) return { type: 'pass', opt, to: best, from: st.pos[H] }; }
  if (distHoop(p) <= 6.5) return { type: 'rim', opt: TSIM.opts.find((x) => x.kind === 'rim'), from: st.pos[H] };
  for (const d of DEF) if (dist(st.pos[d], p) < 1.6) return { type: 'defender', id: d };
  let to = [clamp(p[0], -24.5, 24.5), clamp(p[1], 1, 40)]; if (dist(st.pos[H], to) > 22) to = toward(st.pos[H], to, 22);
  return { type: 'dribble', at: RR(to), from: st.pos[H], attack: distHoop(to) < distHoop(st.pos[H]) - 3 && distHoop(to) < 16 };
}
function learnNotes(S) {
  const c = covOf(S);
  return `<div class="bd def"><h4>The defense · ${esc(c.name)}</h4><p>${esc(c.desc)}</p>${S.notes.slice(-4).map((n) => `<p class="small">• ${esc(n.txt)}</p>`).join('')}</div>`;
}
function renderDecide(P) {
  const S = TSIM.S, M = TS_MODES[TSIM.mode], opts = TSIM.opts;
  const kindTxt = { rim: 'Drive & finish', pass: 'Pass', backdoor: 'Backdoor', drive: 'Drive', shoot: 'Shot', script: 'Play', call: 'Call', reset: 'Reset', dribble: 'Dribble' };
  P.innerHTML = `<div class="decide-head"><span class="eyebrow purple">Read ${TSIM.dec.length + 1} · ${Math.max(0, SHOT_CLOCK - S.t).toFixed(1)}s on the shot clock</span><p>${S.ball} has the ball at the ${SPOT_LABEL[spotName(S.pos[S.ball])]}. ${M.window ? 'Decide before the countdown runs out.' : ''}</p></div>
    ${lastReadStrip(TSIM.dec.at(-1))}
    ${M.reveal ? learnNotes(S) + `<div class="bd"><h4>Who's available (Learning mode shows this)</h4>${whyOpen(S, TSIM.A).map((w) => `<p class="small"><span class="chip ${w.tag === 'open' ? 'green' : w.tag === 'backdoor' ? 'purple' : w.tag === 'workable' ? 'amber' : 'red'}">${w.o} ${w.tag}</span> ${esc(w.txt)}</p>`).join('')}<p class="small">Your shot: <b>${TSIM.A.window}</b> · drive lane ${TSIM.A.drive >= 0.6 ? 'open' : TSIM.A.drive >= 0.35 ? 'possible' : 'closed'}</p></div>` : ''}
    <div class="opts">${opts.map((o, i) => `<button type="button" class="opt" data-o="${i}"><span class="k">${i + 1}</span><span><b>${esc(o.label)}</b><small>${kindTxt[o.kind] || ''}</small></span><span class="kind"></span></button>`).join('')}</div>
    <div class="row">${pauseToggle()}<span class="grow"></span><button type="button" class="btn ghost sm" id="ts-end">End possession</button></div>
    <p class="hint"><b>On the court:</b> tap a teammate to pass · tap yourself or the ball to shoot · tap the rim to drive and finish · tap open floor to dribble there (toward the rim = attack and read the help). Keys 1–${Math.min(9, opts.length)} pick from the list.</p>`;
  for (const b of $$('[data-o]', P)) b.onclick = () => chooseTS(opts[Number(b.dataset.o)]);
  bindPause(P);
  $('#ts-end').onclick = () => { if (TSIM.dec.length) finishTS(); else { TSIM.phase = 'setup'; TSIM.S = null; renderTeamSim(); } };
}
const partBar = (name, v) => (v == null ? '' : part(name, v));
function decisionCard(d, full = true) {
  const b = scoreBand(d.score), why = d.why, best = d.best;
  const ev = (o) => (o.ev ?? 0).toFixed(2);
  const bestWhy = bestReason(d);
  return `<div class="score-row"><div class="score-ring band-${b.k}"><svg viewBox="0 0 104 104"><circle class="bg" cx="52" cy="52" r="46"></circle><circle class="fg" cx="52" cy="52" r="46" style="stroke-dashoffset:${289 * (1 - d.score / 100)}"></circle></svg><div class="n"><div><b>${d.score}</b><small>/ 100</small></div></div></div>
    <div class="parts"><b class="band-${b.k}" style="font:700 15px var(--f-display)">${b.t}</b>${partBar('Read', d.parts.read)}${partBar('Timing', d.parts.timing)}${partBar('Awareness', d.parts.awareness)}${partBar('Principles', d.parts.principles)}</div></div>
    <div class="outcome quad-${d.quad.k}"><div class="o-big">${d.exec ? 'Executed' : 'Not executed'}</div><p>${esc(d.quad.t)}. ${esc(d.res.txt)}</p></div>
    <div class="bd"><h4>You chose</h4><p>${esc(d.label)} <span class="muted small">(${ev(d.choice)} expected pts vs ${ev(best)} for the best read)</span></p></div>
    ${full ? `<div class="bd def"><h4>What the defense did · ${esc(d.covName)}</h4>${d.notes.length ? d.notes.slice(-4).map((n) => `<p class="small">• ${esc(n.txt)}</p>`).join('') : `<p class="small">${esc(COVERAGES[d.cov].desc)}</p>`}</div>
    <div class="bd"><h4>Who was available, and why</h4>${why.map((w) => `<p class="small"><span class="chip ${w.tag === 'open' ? 'green' : w.tag === 'backdoor' ? 'purple' : w.tag === 'workable' ? 'amber' : 'red'}">${w.o} ${w.tag}</span> ${esc(w.txt)}</p>`).join('')}<p class="small">Your own shot: <b>${d.A.window}</b> (closest defender ${fmtFt(d.A.closest)}) · drive lane ${d.A.drive >= 0.6 ? 'open' : d.A.drive >= 0.35 ? 'possible' : 'closed'}${d.A.trapped ? ' · you were trapped' : ''}</p></div>
    <div class="bd best"><h4>${best.id === d.choice.id ? 'Best read · you found it' : 'Best read · ' + esc(best.label)}</h4><p>${esc(bestWhy)}</p></div>
    ${d.choice.rule ? `<div class="bd rulebox"><h4>Our rule</h4><p>${esc(d.choice.rule.name)}: ${esc(d.choice.rule.note || '')}</p></div>` : !d.choice.principle && d.choice.kind !== 'hold' ? `<div class="bd miss"><h4>Our principles</h4><p>This choice isn't one of our offense's actions or a recognized counter. ${d.choice.kind === 'reset' ? 'Resetting gives the defense time to recover.' : 'It breaks the flow of the play without a read that justifies it.'}</p></div>` : ''}` : ''}`;
}
function bestReason(d) {
  const b = d.best, A = d.A, m = b.to ? A.mates[b.to] : null;
  if (b.kind === 'backdoor') return `${b.to}'s defender was overplaying the passing lane with nobody behind him. The back cut beats denial every time the rim is empty.`;
  if (b.kind === 'pass' && m) return m.open >= 0.75 ? `${b.to} was open on the catch (${fmtFt(m.sep)} away, ${fmtFt(m.sepCatch)} after the closeout) with a clean lane${m.helping ? ', because his defender was helping elsewhere' : ''}.` : b.scripted || b.rule ? `This pass keeps our action going: ${b.rule ? b.rule.name : 'the next pass in the play'}. The look it creates was worth more than anything available right now.` : `This pass moved the defense into a better next look.`;
  if (b.kind === 'drive') return `Your defender was out of position (${A.gap < 2.3 ? 'crowding you' : A.behind ? 'trailing' : 'off the line to the rim'}) and the drive lane had ${A.corridorHelp} helper${A.corridorHelp === 1 ? '' : 's'} in it.`;
  if (b.kind === 'shoot') return `Your shot was ${A.window}: the closest defender was ${fmtFt(A.closest)} away.`;
  if (b.kind === 'call') return `${covOf(TSIM.S).name} is vulnerable to the ball screen: ${({ drop: 'the big sits back, so the back screen frees the roller and the pull-up is open', blitz: 'two on the ball leaves 4-on-3 behind it', hedge: 'the hedge leaves the roller alone', switch: 'the switch creates a mismatch', over: 'the chase leaves a 2-on-1 against the big', under: 'going under gives up the shot' })[covOf(TSIM.S).onBall] || 'it creates a new advantage'}.`;
  if (b.kind === 'rim') return `Going all the way was worth it: your defender was ${A.gap < 2.3 ? 'crowding you' : A.behind ? 'trailing' : A.line > 1.8 ? 'off the line to the rim' : 'in front, but the finish was still the best look'} and the lane had ${A.corridorHelp} helper${A.corridorHelp === 1 ? '' : 's'} in it.`;
  if (b.kind === 'dribble') return b.attack ? 'Attacking off the dribble was the best way to make the defense react.' : 'Moving the ball with the dribble improved the angle for the next read.';
  if (b.kind === 'script') return 'Running our next action was the best way to create an advantage here.';
  return 'Nothing better was available.';
}
/** Compact, expandable feedback on the read just made (keeps the possession flowing). */
function lastReadStrip(d) {
  if (!d) return '';
  const b = scoreBand(d.score), same = d.best.id === d.choice.id;
  return `<details class="last-read band-${b.k}"><summary><b class="lr-score">${d.score}</b><span class="lr-txt"><b>${esc(b.t)}</b> · ${esc(d.label)}${same ? ' · best read' : ` · best: ${esc(d.best.label)}`}</span></summary><div class="lr-body">${decisionCard(d)}</div></details>`;
}
function pauseToggle() { return `<label class="pause-tog"><input type="checkbox" id="ts-pause" ${TSIM.pause ? 'checked' : ''}> Pause after each read for full coaching</label>`; }
function bindPause(root) { const c = $('#ts-pause', root); if (c) c.onchange = () => { TSIM.pause = c.checked; uiSet('tsPause', TSIM.pause); }; }
function renderOutcome(P) {
  const d = TSIM.dec.at(-1);
  if (!TSIM.pause && !TSIM.over) {
    P.innerHTML = `<div class="decide-head"><span class="eyebrow">Playing it out · read ${d.i + 1}</span><p>${esc(d.res.txt)}</p></div>${lastReadStrip(d)}${pauseToggle()}`;
    bindPause(P); return;
  }
  P.innerHTML = `<div class="decide-head"><span class="eyebrow">Decision ${d.i + 1} · result</span></div>${decisionCard(d)}
    <div class="actions"><button type="button" class="btn green" id="ts-cont">${TSIM.over ? 'See possession summary' : 'Continue the possession ›'}</button><button type="button" class="btn ghost" id="ts-frame">Show the decision frame</button></div>`;
  $('#ts-cont').onclick = continueTS;
  $('#ts-frame').onclick = () => { TSIM.playing = false; TSIM.t = d.tDecision; TSIM.ov.lanes = true; };
}
function renderSummary(P) {
  const D = TSIM.dec, e = TSIM.saved, b = scoreBand(e.score), prep = TSIM.prep;
  const resTxt = { make: `Make +${e.pts}`, miss: 'Missed shot', tov: 'Turnover', violation: 'Shot-clock violation', none: 'No shot (possession ended)' }[e.result];
  P.innerHTML = `<div class="decide-head"><span class="eyebrow">Possession summary</span><h3>${esc(TSIM.S.cfg.play.name)}</h3></div>
    <div class="score-row"><div class="score-ring band-${b.k}"><svg viewBox="0 0 104 104"><circle class="bg" cx="52" cy="52" r="46"></circle><circle class="fg" cx="52" cy="52" r="46" style="stroke-dashoffset:${289 * (1 - e.score / 100)}"></circle></svg><div class="n"><div><b>${e.score}</b><small>/ 100</small></div></div></div>
      <div class="parts"><b class="band-${b.k}" style="font:700 15px var(--f-display)">${b.t}</b><p class="small">Decision IQ averaged over ${D.length} decision${D.length > 1 ? 's' : ''}. Result: <b>${resTxt}</b> (graded separately).</p><p class="small muted">Defense: ${e.covs.map((c) => COVERAGES[c].name).join(' → ')} · ${INTENSITY[e.intensity]} intensity</p></div></div>
    <div class="tbl-wrap"><table class="ts-tbl"><thead><tr><th>#</th><th>You</th><th>Best read</th><th>Score</th></tr></thead><tbody>${D.map((d) => `<tr><td>${d.i + 1}</td><td>${esc(d.label)}<br><span class="small muted">${esc(d.quad.t)}</span></td><td>${d.best.id === d.choice.id ? '✓ same' : esc(d.best.label)}</td><td><b>${d.score}</b></td></tr>`).join('')}</tbody></table></div>
    <details class="bd"><summary><b>Full breakdown of each decision</b></summary>${D.map((d) => `<div style="margin-top:12px"><h4>Decision ${d.i + 1}</h4>${decisionCard(d)}</div>`).join('')}</details>
    ${prep ? prepBox(prep) : ''}
    <div class="actions">${prep && prep.reps.length < 5 ? '<button type="button" class="btn green" id="ts-next">Next rep ›</button>' : '<button type="button" class="btn green" id="ts-again">Run it again</button>'}<button type="button" class="btn ghost" id="ts-setup">Change play or defense</button></div>`;
  $('#ts-next') && ($('#ts-next').onclick = startTS);
  $('#ts-again') && ($('#ts-again').onclick = () => { if (TSIM.prep) TSIM.prep.reps = []; startTS(); });
  $('#ts-setup').onclick = () => { TSIM.phase = 'setup'; TSIM.S = null; TSIM.prep = null; renderTeamSim(); };
}
function prepBox(prep) {
  const all = prep.reps.flatMap((r) => r.D), byBest = {};
  for (const d of all) byBest[d.best.label.replace(/\(.*\)/, '').trim()] = (byBest[d.best.label.replace(/\(.*\)/, '').trim()] || 0) + 1;
  const top = Object.entries(byBest).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const avg = Math.round(mean(prep.reps.map((r) => r.entry.score)));
  return `<div class="lesson-box"><span class="eyebrow purple">Scouting report · ${prep.reps.length}/5 reps vs ${esc(COVERAGES[prep.cov].name)}</span>
    <p>Average decision IQ: <b>${avg}</b>. ${prep.reps.length < 5 ? 'Keep going to complete the report.' : ''}</p>
    <p class="small"><b>What beat this defense most often:</b></p><ul class="keys">${top.map(([k, n]) => `<li>${esc(k)} (best read ${n}×)</li>`).join('')}</ul>
    <p class="small">${esc(COVERAGES[prep.cov].desc)}</p></div>`;
}

// ---------- history & analytics on the setup page ----------
function tsHistory() {
  const L = doc('team').list;
  if (!L.length) return `<div class="empty">${emptyArt()}<h3>No possessions yet</h3><p>Your decision IQ by coverage and the decision-vs-execution matrix appear here after your first possession.</p></div>`;
  const D = L.flatMap((e) => e.decisions), q = { gg: 0, gb: 0, bg: 0, bb: 0 }; for (const d of D) q[d.quad]++;
  const byCov = Object.keys(COVERAGES).map((k) => { const X = D.filter((d) => d.cov === k); return { k, n: X.length, v: X.length ? Math.round(mean(X.map((d) => d.score))) : null }; });
  return `<div class="two-col"><div class="card"><div class="section-title"><h2>Decision IQ by coverage</h2><span class="muted small">${D.length} decisions</span></div>
      <div class="mastery-list" style="margin-top:10px">${byCov.map((c) => `<div class="m-row"><span>${esc(COVERAGES[c.k].name)}</span><span class="bar"><i style="width:${c.v ?? 0}%;background:${c.v == null ? 'transparent' : c.v >= 85 ? 'var(--green)' : c.v >= 70 ? 'var(--blue)' : c.v >= 55 ? 'var(--amber)' : 'var(--red)'}"></i></span><span>${c.v == null ? '—' : c.v + ' · ' + c.n}</span></div>`).join('')}</div></div>
    <div class="card"><div class="section-title"><h2>Decision vs execution</h2></div>
      <div class="matrix" style="margin-top:10px"><span></span><span class="h">Executed</span><span class="h">Not executed</span>
        <span class="h left">Correct read</span><div class="c gg"><b>${q.gg}</b><span>Right read, it worked</span></div><div class="c gb"><b>${q.gb}</b><span>Right read, poor execution or luck</span></div>
        <span class="h left">Wrong read</span><div class="c bg"><b>${q.bg}</b><span>Wrong read that worked anyway</span></div><div class="c bb"><b>${q.bb}</b><span>Wrong read, bad result</span></div></div>
</div></div>
    <div class="card"><div class="section-title"><h2>Recent possessions</h2></div><div class="film-list" style="margin-top:8px">${[...L].reverse().slice(0, 10).map((e) => `<div class="film-row" style="cursor:default"><span class="sc" style="color:${{ elite: 'var(--green)', good: 'var(--blue-2)', ok: 'var(--amber)', bad: 'var(--red)' }[scoreBand(e.score).k]}">${e.score}</span><span class="t"><b>${esc(e.play)}</b><span>vs ${e.covs.map((c) => COVERAGES[c].name).join(' → ')} · ${TS_MODES[e.mode]?.name || ''} · ${new Date(e.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span><span class="r"><span class="chip ${e.result === 'make' ? 'green' : e.result === 'tov' ? 'red' : 'gray'}">${{ make: 'Make +' + e.pts, miss: 'Miss', tov: 'Turnover', violation: 'Violation', none: 'No shot' }[e.result]}</span></span></div>`).join('')}</div></div>`;
}
function mountTSCharts() {}
document.addEventListener('keydown', (e) => {
  if ($('#view-teamsim')?.hidden || TSIM.phase !== 'decide' || e.target.closest('input, textarea, select')) return;
  if (/^[1-9]$/.test(e.key)) { const o = TSIM.opts[Number(e.key) - 1]; if (o) { e.preventDefault(); chooseTS(o); } }
});
