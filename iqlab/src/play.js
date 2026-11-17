// ===================== possession simulator (play view) =====================
// Phases: intro → setup (possession plays) → decide (live: slow-motion countdown; film: frozen, scrub + overlays)
// → outcome (your choice plays out) → breakdown. Also: replay (any finished possession), demo (the best read).
const P = {
  view: null, sid: null, sc: null, flip: false, mode: 'live', phase: 'intro', t: 0, playing: false, speed: 1,
  pre: null, res: null, choice: null, demoTrack: null, decideStart: 0, raf: 0, last: 0,
  ov: { lanes: false, links: false, spacing: false, trails: false },
  queue: null, saved: null, from: 'sim', coachText: '',
};
const LETTERS = 'ABCDEF';
const AI = { sample: null };

function openPlay(sid, o = {}) {
  P.sid = sid; P.flip = !!o.flip; P.sc = getScenario(sid, P.flip);
  P.queue = o.queue || null; P.saved = null; P.from = o.from || P.from || 'sim';
  P.mode = P.queue ? 'live' : (o.mode || lsGet('mode') || 'live');
  P.pre = preTrack(P.sc); P.res = null; P.choice = null; P.demoTrack = null; P.coachText = '';
  P.phase = 'intro'; P.t = 0; P.playing = false;
  showView('play');
  renderPlayHead(); renderPanel(); syncTimeline(); ensureLoop();
}
/** Film Room: rebuild a saved possession exactly. */
function openReplay(r) {
  if (!SC[r.sid]) return toast('That scenario is no longer available.');
  P.sid = r.sid; P.flip = !!r.flip; P.sc = getScenario(r.sid, P.flip); P.queue = null; P.saved = r; P.from = 'film';
  P.mode = r.mode; P.pre = preTrack(P.sc); P.coachText = '';
  P.choice = { opt: r.opt, f: r.f, seed: r.seed, flip: r.flip, mode: r.mode, rt: r.rt };
  P.res = evaluate(r.sid, P.choice); P.demoTrack = null;
  P.phase = 'replay'; P.t = 0; P.playing = true;
  P.ov = { lanes: false, links: true, spacing: false, trails: false };
  showView('play');
  renderPlayHead(); renderPanel(); syncTimeline(); ensureLoop();
}

function curTrack() { return P.phase === 'demo' ? P.demoTrack : (P.res && ['outcome', 'replay', 'done'].includes(P.phase) ? P.res.poss.track : P.pre); }

function renderPlayHead() {
  const sc = P.sc, revealed = !!P.res || P.mode === 'film';
  $('#pl-eyebrow').textContent = P.queue ? (P.queue.kind === 'daily' ? `Daily Three · ${P.queue.i + 1} of ${P.queue.ids.length}` : `Shot-Clock Gauntlet · streak ${P.queue.streak}`) : `${sc.cat === 'pnr' ? 'Pick-and-roll' : 'Basketball IQ'} · ${sc.setting}`;
  $('#pl-title').textContent = revealed ? sc.title : sc.setting;
  const lock = !!P.queue || !!P.saved || !['intro'].includes(P.phase);
  $('#pl-mode').hidden = !!P.queue || !!P.saved;
  for (const b of $$('#pl-mode button')) { b.setAttribute('aria-pressed', String(b.dataset.mode === P.mode)); b.disabled = lock; }
  const hm = $('#hud-mode');
  hm.dataset.m = P.phase === 'demo' ? 'film' : P.mode;
  hm.textContent = P.phase === 'demo' ? 'BEST READ · DEMO' : P.saved ? 'FILM ROOM' : P.mode === 'live' ? 'LIVE' : 'FILM';
  $('#overlays').hidden = P.mode === 'live' && ['intro', 'setup', 'decide'].includes(P.phase);
  for (const b of $$('#overlays .tog')) b.setAttribute('aria-pressed', String(!!P.ov[b.dataset.ov]));
}

// ---------------------------------------------------------------- panel
function renderPanel() {
  const el = $('#panel'), sc = P.sc;
  if (P.phase === 'intro') {
    el.innerHTML = `
      ${queueBar()}
      <div class="decide-head"><span class="eyebrow purple">Scouting report</span><h3>${esc(sc.setting)}</h3></div>
      <p class="brief">${esc(sc.brief)}</p>
      <div class="row"><span class="chip gray">Shot clock ${sc.clock}s</span><span class="chip gray">Decision window ${sc.decision.window}s</span><span class="diff" title="Difficulty ${sc.diff} of 3">${[1, 2, 3].map((i) => `<i class="${i <= sc.diff ? 'on' : ''}"></i>`).join('')}</span></div>
      ${P.queue ? '' : `<div class="mode-pick">
        <button type="button" class="mode-card" data-pick="live" id="mp-live" aria-pressed="${P.mode === 'live'}"><b>Live</b><span>Decide in real time. The defense keeps moving while you think.</span></button>
        <button type="button" class="mode-card" data-pick="film" id="mp-film" aria-pressed="${P.mode === 'film'}"><b>Film</b><span>Freeze at the decision. Scrub, turn on overlays, take your time.</span></button>
      </div>`}
      <button type="button" class="btn green" id="pl-start">${icon('play')} Start possession</button>
      <p class="hint">You are <b>YOU</b> (green ring), the point guard. ${P.mode === 'live' ? 'When the moment comes, tap an option or tap a teammate on the court to pass.' : 'At the decision the play freezes so you can study the floor.'}</p>`;
    $('#pl-start').onclick = startPossession;
    for (const b of $$('[data-pick]', el)) b.onclick = () => { P.mode = b.dataset.pick; lsSet('mode', P.mode); renderPlayHead(); renderPanel(); };
    return;
  }
  if (P.phase === 'setup') {
    el.innerHTML = `${queueBar()}<div class="decide-head"><span class="eyebrow">Possession in progress</span><h3>Read the defense</h3></div>
      <p class="brief">${P.mode === 'live' ? 'Watch the screen, the big and the help. The decision is coming.' : 'Watch the action develop. The play will freeze at your decision.'}</p>`;
    return;
  }
  if (P.phase === 'decide') {
    const opts = sc.decision.options;
    el.innerHTML = `${queueBar()}<div class="decide-head"><span class="eyebrow purple">Your decision</span><p class="decide-prompt">${esc(sc.decision.prompt)}</p></div>
      <div class="opts">${opts.map((o, i) => `<button type="button" class="opt" data-opt="${o.id}" id="opt-${o.id}"><span class="k">${LETTERS[i]}</span><span><b>${esc(o.label)}</b><small>${o.kind === 'pass' ? 'Pass to ' + roleName(o.target) : { shot: 'Shoot', drive: 'Drive', reset: 'Reset' }[o.kind]}</small></span><span class="kind">${i + 1}</span></button>`).join('')}</div>
      <p class="hint">${P.mode === 'live' ? 'Tap a teammate on the court to pass to him. Keys 1–' + opts.length + ' work too.' : 'Scrub back on the timeline and toggle overlays to study the floor. Lettered arrows on the court show each option.'}</p>`;
    for (const b of $$('[data-opt]', el)) b.onclick = () => commit(b.dataset.opt);
    return;
  }
  if (P.phase === 'outcome') {
    el.innerHTML = `${queueBar()}<div class="decide-head"><span class="eyebrow">Playing it out</span><h3>${esc(P.res.poss.opt.label)}</h3></div><p class="brief">Your breakdown appears when the possession ends.</p><button type="button" class="btn ghost sm" id="pl-skip">Skip to breakdown</button>`;
    $('#pl-skip').onclick = () => { P.t = P.res.poss.track.t1; P.playing = false; finishOutcome(); };
    return;
  }
  renderBreakdown();
}
const roleName = (id) => ({ O1: 'you', O2: 'the shooting guard', O3: 'the small forward', O4: 'the power forward', O5: 'the center' })[id] || id;
function queueBar() {
  const q = P.queue; if (!q) return '';
  if (q.kind === 'daily') return `<div class="queue-bar">${icon('bolt')} Daily Three<span class="dots">${q.ids.map((_, i) => `<i class="${i < q.i ? 'done' : i === q.i ? 'cur' : ''}"></i>`).join('')}</span></div>`;
  return `<div class="queue-bar">${icon('bolt')} Gauntlet streak: ${q.streak}<span class="muted small" style="margin-left:auto">Score 70+ to survive</span></div>`;
}

// ---------------------------------------------------------------- flow
function startPossession() {
  P.phase = 'setup'; P.t = 0; P.playing = true; P.speed = 1; $('#tl-speed').textContent = '1×';
  if (P.mode === 'film') P.ov = { ...P.ov };
  hideStamp(); renderPlayHead(); renderPanel(); syncTimeline();
  if (window.innerWidth < 1020) $('#stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function enterDecide() {
  P.phase = 'decide'; P.t = P.pre.setupEnd;
  if (P.mode === 'live') { P.decideStart = performance.now(); P.playing = true; $('#hud-count').hidden = false; }
  else { P.playing = false; }
  const pr = $('#hud-prompt'); pr.textContent = P.sc.decision.prompt; pr.hidden = false;
  $('#stage').classList.add('pickable');
  renderPlayHead(); renderPanel(); syncTimeline();
}
function commit(optId) {
  if (P.phase !== 'decide') return;
  let f = 0, rt = null;
  if (P.mode === 'live') { const el = (performance.now() - P.decideStart) / 1000; f = clamp(el / P.sc.decision.window, 0, 1); rt = Math.round(el * 1000); }
  const seed = (Math.random() * 2 ** 31) >>> 0;
  P.choice = { opt: optId, f: r1(f * 100) / 100, seed, flip: P.flip, mode: P.mode, rt };
  P.res = evaluate(P.sid, P.choice);
  P.phase = 'outcome'; P.t = P.res.poss.tDecision; P.playing = true;
  $('#hud-count').hidden = true; $('#hud-prompt').hidden = true; $('#stage').classList.remove('pickable');
  saveResult();
  renderPlayHead(); renderPanel(); syncTimeline();
}
function finishOutcome() {
  P.phase = 'done'; P.playing = false;
  showStamp(); renderPlayHead(); renderPanel(); syncTimeline();
  if (P.queue) advanceQueueState();
}
function showStamp() {
  const r = P.res.poss.result, el = $('#hud-stamp');
  const map = { make: ['var(--green)', `+${P.res.poss.pts}`], miss: ['#c7d2f0', 'MISS'], tov: ['var(--red)', 'TURNOVER'], violation: ['var(--red)', 'VIOLATION'], none: ['var(--blue-2)', 'RESET'] };
  const [c, txt] = map[r]; el.style.color = c; el.textContent = txt; el.hidden = false;
  clearTimeout(showStamp.t); showStamp.t = setTimeout(() => (el.hidden = true), 1800);
}
const hideStamp = () => { $('#hud-stamp').hidden = true; };

function saveResult() {
  if (P.saved) return;
  const r = P.res, c = P.choice, now = Date.now();
  const entry = { id: uid('r'), sid: P.sid, opt: c.opt, f: c.f, seed: c.seed, flip: c.flip, mode: c.mode, rt: c.rt, score: r.score, parts: r.parts, result: r.poss.result, pts: r.poss.pts, best: r.isBest, topic: P.sc.topic, ts: now, q: P.queue?.kind || null };
  const res = doc('results'); res.list.push(entry); if (res.list.length > 400) res.list.splice(0, res.list.length - 400); persist('results');
  const pg = doc('progress'), s = pg.scen[P.sid] || (pg.scen[P.sid] = { best: 0, plays: 0 });
  s.plays++; s.best = Math.max(s.best, r.score); s.last = r.score; s.ts = now;
  if (P.queue?.kind === 'daily') { const d = pg.daily[P.queue.date] || (pg.daily[P.queue.date] = { scores: {} }); d.scores[P.sid] = Math.max(d.scores[P.sid] || 0, r.score); }
  persist('progress');
  P.savedEntry = entry;
}
function advanceQueueState() {
  const q = P.queue;
  if (q.kind === 'gauntlet') {
    if (P.res.score >= 70) q.streak++; else q.over = true;
    const pg = doc('progress'); if (q.streak > (pg.best.gauntlet || 0)) { pg.best.gauntlet = q.streak; persist('progress'); q.record = true; }
  }
  renderPanel();
}
function nextInQueue() {
  const q = P.queue;
  if (q.kind === 'daily') {
    q.i++;
    if (q.i >= q.ids.length) { toast('Daily Three complete'); P.queue = null; return go('challenges'); }
    return openPlay(q.ids[q.i], { queue: q, flip: q.flips[q.i] });
  }
  const next = gauntletPick(q);
  openPlay(next.id, { queue: q, flip: next.flip });
}
function gauntletPick(q) {
  const pool = SCENARIOS.filter((s) => s.id !== q.lastId && !(q.recent || []).includes(s.id));
  const sc = pool[Math.floor(Math.random() * pool.length)];
  q.recent = [...(q.recent || []), sc.id].slice(-6); q.lastId = sc.id;
  return { id: sc.id, flip: Math.random() < 0.5 };
}

// ---------------------------------------------------------------- breakdown
function renderBreakdown() {
  const el = $('#panel'), r = P.res, sc = P.sc, opt = r.poss.opt, c = P.choice, band = scoreBand(r.score);
  const off = 289 * (1 - r.score / 100);
  const live = c.mode === 'live';
  const goodDecision = r.score >= 75;
  const res = r.poss.result;
  const evMine = expectedPts(opt, c.f), evBest = expectedPts(r.best, 0);
  let oTxt;
  if (res === 'none') oTxt = 'No shot: the possession resets. Graded on the decision only.';
  else if (goodDecision && res === 'make') oTxt = 'Right read, and it went in.';
  else if (goodDecision && res === 'miss') oTxt = 'Right read, missed shot. That\'s basketball: keep making this decision.';
  else if (goodDecision) oTxt = 'Right idea, but it didn\'t come off this time.';
  else if (res === 'make') oTxt = 'It went in, but the read was wrong. Over many reps this choice loses.';
  else oTxt = 'Wrong read, and the result followed.';
  const did = [];
  if (opt.good) did.push(opt.good);
  if (live && c.opt !== 'timeout' && r.parts.timing >= 85) did.push(`You decided fast (${(c.rt / 1000).toFixed(1)}s), before the defense could recover.`);
  if (!did.length && opt.sp >= 70) did.push('Your choice kept the floor spaced.');
  if (!did.length) did.push('You made a decision and lived with it. Now learn the read below.');
  const missed = [];
  if (opt.miss) missed.push(opt.miss);
  if (live && c.opt !== 'timeout' && r.parts.timing < 60) missed.push(`You took ${(c.rt / 1000).toFixed(1)}s. The defense recovered while you waited, which lowered your shot quality.`);
  if (!missed.length) missed.push(r.isBest ? 'Nothing major. That was the best read on the floor.' : 'Close. Compare with the best read below.');
  const fl = r.floor;
  const flipNote = P.flip ? ' (mirrored to the other side of the floor)' : '';
  const sNote = P.saved ? `<span class="chip gray">${fmtDate(P.saved.ts)}</span>` : '';
  el.innerHTML = `
    ${queueBar()}${queueResult()}
    <div class="score-row">
      <div class="score-ring band-${band.k}"><svg viewBox="0 0 104 104"><circle class="bg" cx="52" cy="52" r="46"></circle><circle class="fg" cx="52" cy="52" r="46" style="stroke-dashoffset:${off}"></circle></svg>
        <div class="n"><div><b>${r.score}</b><small>/ 100</small></div></div></div>
      <div class="parts">
        <div class="row" style="gap:6px"><b class="band-${band.k}" style="font:700 16px var(--f-display)">${band.t}</b>${sNote}</div>
        ${part('Read', r.parts.read)}${part('Action', r.parts.action)}${part('Spacing', r.parts.spacing)}
        ${live ? part('Timing', r.parts.timing) : '<div class="part"><span>Timing</span><span class="muted small">Film mode: untimed</span><b></b></div>'}
      </div>
    </div>
    <div class="outcome"><div class="o-big" style="color:${{ make: 'var(--green)', miss: '#c7d2f0', tov: 'var(--red)', violation: 'var(--red)', none: 'var(--blue-2)' }[res]}">${RESULT_TEXT[res]}${res === 'make' ? ' +' + r.poss.pts : ''}</div><p>${oTxt} <span class="mono">${evMine.toFixed(2)}</span> expected pts for your choice vs <span class="mono">${evBest.toFixed(2)}</span> for the best read.</p></div>
    <div class="bd"><h4>What you did</h4><p>${esc(opt.label)}${live && c.rt != null && c.opt !== 'timeout' ? ` after ${(c.rt / 1000).toFixed(1)}s` : ''}${flipNote}.</p></div>
    <div class="bd good"><h4>What you did well</h4>${did.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
    <div class="bd miss"><h4>What you missed</h4>${missed.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
    <div class="bd def"><h4>What the defense was doing · ${esc(sc.coverage)}</h4><p>${esc(sc.defense)}</p></div>
    <div class="bd best"><h4>${r.isBest ? 'Best read · you found it' : 'Best alternative · ' + esc(r.best.label)}</h4><p>${esc(sc.bestWhy)}</p>
      <div class="row" style="margin-top:6px"><button type="button" class="btn sm" id="bd-demo">${icon('eye')} Watch the best read</button><button type="button" class="btn ghost sm" id="bd-replay">${icon('restart')} Replay mine</button></div></div>
    <div class="bd"><h4>Floor read at your decision</h4>
      <ul class="floor-list">${fl.mates.map((m) => `<li><span class="who">${m.role}</span><span>${m.sep} ft from nearest defender · ${m.laneTxt}</span><span class="chip ${m.tag === 'open' ? 'green' : m.tag === 'workable' ? 'amber' : 'red'}">${m.tag}</span></li>`).join('')}</ul>
      <div class="floor-meta"><span class="chip gray">Spacing: ${fl.spacingTxt} (${fl.spacing} ft avg)</span><span class="chip gray">Defenders in the paint: ${fl.paint}</span><span class="chip gray">Your defender: ${fl.ballDef} ft</span></div>
      ${sc.floorNote ? `<p class="small muted">${esc(sc.floorNote)}</p>` : ''}
      <p class="hint">Computed from player positions at the moment you decided. Turn on Passing lanes and scrub to that marker to see it.</p></div>
    <div class="lesson-box"><span class="eyebrow purple">Lesson</span><p>${esc(sc.lesson)}</p><ul class="keys">${sc.keys.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>
    ${AI.sample ? `<div class="coach"><div class="ai-label">${icon('spark')} AI coach · Claude</div><p class="small muted">Sends this possession's data (scenario, your choice, scores, floor read) to Claude for extra coaching. Uses your Claude account.</p><div class="coach-out" id="coach-out">${esc(P.coachText)}</div><button type="button" class="btn purple sm" id="bd-coach">Ask the coach about this possession</button></div>` : ''}
    <div class="actions">${actionsHtml()}</div>`;
  $('#bd-demo').onclick = playDemo;
  $('#bd-replay').onclick = () => { P.phase = P.saved ? 'replay' : 'replay'; P.t = 0; P.playing = true; hideStamp(); renderPlayHead(); syncTimeline(); };
  $('#bd-coach') && ($('#bd-coach').onclick = askCoach);
  for (const b of $$('[data-act]', el)) b.onclick = () => panelAction(b.dataset.act);
}
const part = (name, v) => `<div class="part"><span>${name}</span><span class="bar"><i style="width:${v}%;background:${v >= 85 ? 'var(--green)' : v >= 60 ? 'var(--blue)' : v >= 40 ? 'var(--amber)' : 'var(--red)'}"></i></span><b>${v}</b></div>`;
function queueResult() {
  const q = P.queue; if (!q || P.phase === 'intro') return '';
  if (q.kind === 'gauntlet' && q.over) return `<div class="confirm" style="border-color:rgba(255,194,61,.4);background:rgba(255,194,61,.07)"><b>Gauntlet over</b><p class="small">Final streak: ${q.streak}${q.record ? ' · new personal best!' : ` · best ${doc('progress').best.gauntlet || 0}`}</p></div>`;
  return '';
}
function actionsHtml() {
  if (P.saved) return `<button type="button" class="btn green" data-act="again">Play this scenario</button><button type="button" class="btn ghost" data-act="back">Back to Film Room</button>`;
  if (P.queue) {
    if (P.queue.kind === 'gauntlet' && P.queue.over) return `<button type="button" class="btn green" data-act="gauntlet">Run it back</button><button type="button" class="btn ghost" data-act="back">Challenges</button>`;
    const last = P.queue.kind === 'daily' && P.queue.i >= P.queue.ids.length - 1;
    return `<button type="button" class="btn green" data-act="next">${last ? 'Finish Daily Three' : 'Next possession ›'}</button><button type="button" class="btn ghost" data-act="back">Quit</button>`;
  }
  return `<button type="button" class="btn green" data-act="again">Try again</button><button type="button" class="btn ghost" data-act="flip">Run it on the other side</button><button type="button" class="btn ghost" data-act="next-scen">Next scenario ›</button>`;
}
function panelAction(a) {
  if (a === 'again') return openPlay(P.sid, { flip: P.flip, from: P.from === 'film' ? 'sim' : P.from });
  if (a === 'flip') return openPlay(P.sid, { flip: !P.flip });
  if (a === 'next') return nextInQueue();
  if (a === 'gauntlet') return startGauntlet();
  if (a === 'next-scen') { const i = SCENARIOS.findIndex((s) => s.id === P.sid); return openPlay(SCENARIOS[(i + 1) % SCENARIOS.length].id); }
  if (a === 'back') { const to = P.saved ? 'film' : P.queue ? 'challenges' : P.from; P.queue = null; return go(to); }
}
function playDemo() {
  const c = P.choice;
  const d = evaluate(P.sid, { opt: P.res.best.id, f: 0, seed: c.seed, flip: P.flip, mode: 'film', forceMake: true });
  P.demoTrack = d.poss.track; P.demoFx = d.poss.fx;
  P.phase = 'demo'; P.t = 0; P.playing = true; hideStamp();
  renderPlayHead(); syncTimeline();
  $('#stage').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function askCoach() {
  const btn = $('#bd-coach'), out = $('#coach-out'), r = P.res, sc = P.sc, c = P.choice;
  btn.disabled = true; btn.textContent = 'Thinking…';
  const data = {
    scenario: sc.title, setting: sc.setting, coverage: sc.coverage, defense: sc.defense, mode: c.mode,
    decision_time_s: c.rt != null ? c.rt / 1000 : null, chose: r.poss.opt.label, best_read: r.best.label, best_why: sc.bestWhy,
    scores: { total: r.score, ...r.parts }, outcome: RESULT_TEXT[r.poss.result],
    feedback: { good: r.poss.opt.good || '', missed: r.poss.opt.miss || '' },
    floor_read: r.floor.mates.map((m) => `${m.role}: ${m.sep} ft separation, ${m.laneTxt}, ${m.tag}`), spacing: r.floor.spacingTxt,
    other_options: sc.decision.options.map((o) => o.label),
  };
  const prompt = `You are a basketball skills coach talking to a high-school point guard who just played one possession in a decision-training simulator. The data below is everything you know about the possession (it's a simulation, not video). Using only this data, give:\n1. A one-sentence verdict on the decision.\n2. The cue to look for next time (what to see, when).\n3. One short on-court drill to build this read.\nKeep it under 130 words, plain text, no markdown headings, talk directly to the player as "you".\n\nPOSSESSION DATA:\n${JSON.stringify(data, null, 1)}`;
  try {
    out.textContent = 'Thinking…';
    const ans = await AI.sample(prompt, { modelTier: 'quick', onText: ({ text }) => { out.textContent = text; } });
    P.coachText = ans.text; out.textContent = ans.text;
    btn.textContent = 'Ask again'; btn.disabled = false;
  } catch (e) {
    if (e?.code === 'not_granted') { AI.sample = null; $('.coach')?.remove(); return; }
    out.textContent = e?.code === 'rate_limited' ? 'The coach is busy. Try again in a minute.' : 'Couldn\'t reach the coach right now.';
    btn.textContent = 'Try again'; btn.disabled = false;
  }
}

// ---------------------------------------------------------------- render loop
function ensureLoop() { if (!P.raf) { P.last = performance.now(); P.raf = requestAnimationFrame(tick); } }
function tick(now) {
  P.raf = 0;
  if ($('#view-play').hidden) return;
  if (!P.view) P.view = new CourtView($('#court'));
  const dt = Math.min(0.05, (now - P.last) / 1000); P.last = now;
  const tr = curTrack();
  if (P.phase === 'setup' && P.playing) {
    P.t += dt * P.speed;
    if (P.t >= P.pre.setupEnd) enterDecide();
  } else if (P.phase === 'decide' && P.mode === 'live') {
    const el = (now - P.decideStart) / 1000, w = P.sc.decision.window, f = clamp(el / w, 0, 1);
    P.t = P.pre.setupEnd + P.sc.decision.drift.d * f;
    const ring = $('#hud-ring'); ring.style.strokeDashoffset = String(119.4 * f); ring.style.stroke = f > 0.7 ? 'var(--red)' : f > 0.4 ? 'var(--amber)' : 'var(--green)';
    $('#hud-count-n').textContent = Math.max(0, w - el).toFixed(1);
    if (f >= 1) commit('timeout');
  } else if (['outcome', 'replay', 'demo'].includes(P.phase) && P.playing) {
    P.t += dt * P.speed;
    if (P.t >= tr.t1 + 0.35) {
      P.t = tr.t1; P.playing = false;
      if (P.phase === 'outcome') finishOutcome();
      else if (P.phase === 'replay' && P.saved && P.res) { P.phase = 'done'; showStamp(); }
      else { P.phase = 'done'; }
      syncTimeline();
    }
  }
  draw();
  updateHud();
  P.raf = requestAnimationFrame(tick);
}
function draw() {
  const tr = curTrack(), o = { captions: !(P.mode === 'live' && ['setup', 'decide'].includes(P.phase)), spotlight: P.phase === 'decide' };
  const study = P.mode === 'film' || !['setup', 'decide', 'intro'].includes(P.phase);
  if (study) { o.overlays = { lanes: P.ov.lanes, links: P.ov.links, spacing: P.ov.spacing }; o.trails = P.ov.trails; }
  if (P.phase === 'decide') {
    const st = stateAt(P.pre, P.t), h = st.holder || 'O1';
    o.targets = []; o.previews = [];
    P.sc.decision.options.forEach((op, i) => {
      if (op.kind === 'pass') { o.targets.push({ id: op.target, label: LETTERS[i], color: 'rgba(155,123,255,.95)' }); if (P.mode === 'film') o.previews.push({ from: st.pos[h], to: st.pos[op.target], color: 'rgba(155,123,255,.75)', dash: true }); }
      else if (P.mode === 'film' && op.kind === 'drive' && op.to) o.previews.push({ from: st.pos[h], to: op.to, color: 'rgba(61,139,255,.85)', label: LETTERS[i] });
      else if (P.mode === 'film' && op.kind === 'shot') o.previews.push({ from: st.pos[h], to: [st.pos[h][0] * 0.8, st.pos[h][1] - 3.5], color: 'rgba(255,194,61,.9)', label: LETTERS[i] });
    });
  }
  if (P.phase === 'demo') o.fx = P.demoFx; else if (P.res && P.phase !== 'decide') o.fx = P.res.poss.fx; else o.fx = [];
  if (P.res && ['replay', 'done'].includes(P.phase) && Math.abs(P.t - P.res.poss.tDecision) < 0.06 && P.phase !== 'demo') o.highlight = P.res.poss.opt.target;
  P.view.draw(tr, P.t, o);
}
function updateHud() {
  const tr = curTrack();
  let shotT = Infinity; for (const s of tr.segs) if (isShotBall(s.ball)) { shotT = s.t0; break; }
  const clk = Math.max(0, P.sc.clock - Math.min(P.t, shotT));
  const hc = $('#hud-clock'); hc.querySelector('b').textContent = clk.toFixed(1); hc.classList.toggle('low', clk <= 5);
  const rg = $('#tl-range'); if (document.activeElement !== rg || !P.playing) rg.value = String(P.t);
  $('#tl-time').textContent = P.t.toFixed(1) + 's';
  const pb = $('#tl-play'), playingNow = P.playing && P.phase !== 'decide';
  if (pb.dataset.s !== String(playingNow)) { pb.dataset.s = String(playingNow); pb.innerHTML = icon(playingNow ? 'pause' : 'play'); pb.setAttribute('aria-label', playingNow ? 'Pause' : 'Play'); }
}
function syncTimeline() {
  const tr = curTrack(), rg = $('#tl-range');
  const liveLock = P.mode === 'live' && ['intro', 'setup', 'decide'].includes(P.phase);
  const filmDecide = P.mode === 'film' && P.phase === 'decide';
  rg.max = String(filmDecide ? P.pre.setupEnd : tr.t1);
  rg.disabled = liveLock || P.phase === 'intro';
  $('#tl-play').disabled = liveLock && P.phase !== 'setup';
  $('#tl-restart').disabled = P.phase === 'intro' || (liveLock && P.phase !== 'setup');
  const marks = P.res && ['outcome', 'replay', 'done'].includes(P.phase) ? P.res.poss.markers : filmDecide || P.phase === 'setup' || P.phase === 'decide' ? [{ t: P.pre.setupEnd, kind: 'decision' }] : [];
  const max = Number(rg.max) || 1;
  $('#tl-marks').innerHTML = marks.filter((m) => m.t <= max + 0.01).map((m) => `<i data-k="${m.kind}" style="left:${(m.t / max) * 100}%" title="${esc(m.label || '')}"></i>`).join('');
}

// ---------------------------------------------------------------- input
function initPlayControls() {
  $('#tl-restart').innerHTML = icon('restart');
  $('#pl-back').onclick = () => { const to = P.saved ? 'film' : P.queue ? 'challenges' : P.from; P.queue = null; go(to); };
  for (const b of $$('#pl-mode button')) b.onclick = () => { if (P.phase !== 'intro') return; P.mode = b.dataset.mode; lsSet('mode', P.mode); renderPlayHead(); renderPanel(); };
  $('#tl-play').onclick = () => {
    if (P.phase === 'decide') return;
    if (P.phase === 'done') { P.phase = P.saved || P.res ? 'replay' : P.phase; if (P.t >= curTrack().t1 - 0.01) P.t = 0; P.playing = true; hideStamp(); syncTimeline(); return; }
    P.playing = !P.playing;
  };
  $('#tl-restart').onclick = () => {
    if (P.phase === 'setup') { P.t = 0; P.playing = true; return; }
    if (P.res) { P.phase = 'replay'; P.t = 0; P.playing = true; hideStamp(); renderPlayHead(); syncTimeline(); }
    else if (P.mode === 'film' && P.phase === 'decide') { P.t = 0; }
  };
  $('#tl-range').addEventListener('input', (e) => {
    P.t = Number(e.target.value); P.playing = false;
    if (P.phase === 'outcome') { P.phase = 'replay'; }
    if (P.phase === 'done' && P.res) P.phase = 'replay';
    hideStamp();
  });
  $('#tl-speed').onclick = () => { P.speed = P.speed === 1 ? 0.5 : P.speed === 0.5 ? 0.25 : 1; $('#tl-speed').textContent = (P.speed === 1 ? '1' : P.speed === 0.5 ? '½' : '¼') + '×'; };
  for (const b of $$('#overlays .tog')) b.onclick = () => { P.ov[b.dataset.ov] = !P.ov[b.dataset.ov]; b.setAttribute('aria-pressed', String(P.ov[b.dataset.ov])); };
  $('#court').addEventListener('pointerdown', (e) => {
    if (P.phase !== 'decide' || !P.view) return;
    const rect = e.currentTarget.getBoundingClientRect(), [cx, cy] = P.view.toCourt(e.clientX - rect.left, e.clientY - rect.top);
    const st = stateAt(P.pre, P.t); let best = null, bd = 4.2;
    for (const id of OFF) { if (id === st.holder) continue; const d = dist(st.pos[id], [cx, cy]); if (d < bd) { bd = d; best = id; } }
    if (!best) return;
    const op = P.sc.decision.options.find((o) => o.kind === 'pass' && o.target === best);
    if (op) commit(op.id); else toast(`No pass to ${roleName(best)} in this read. Pick an option.`);
  });
  document.addEventListener('keydown', (e) => {
    if ($('#view-play').hidden || e.target.closest('input, textarea')) return;
    if (P.phase === 'decide' && /^[1-6]$/.test(e.key)) { const o = P.sc.decision.options[Number(e.key) - 1]; if (o) { e.preventDefault(); commit(o.id); } }
    else if (e.key === ' ' && P.phase !== 'decide' && P.phase !== 'intro' && !e.target.closest('button')) { e.preventDefault(); $('#tl-play').click(); }
  });
  window.addEventListener('resize', () => { if (P.view) { P.view.resize(); } });
}
