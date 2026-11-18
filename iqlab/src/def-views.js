// ===================== Defense Intelligence Center: views + drill runner =====================
// Everything is played on the court: drag yourself to a spot, tap a defender or an attacker, tap the floor to cut a
// driver off. Chips only appear when the answer is a word (a coverage, a call, a job).

const DMODS = {
  position: { name: 'Positioning Academy', icon: 'court', cat: 'helpside', tone: '', desc: 'Freeze-frame half-court situations. Drag yourself to where you belong and name your job.' },
  rotation: { name: 'Help & Rotation Sim', icon: 'shield', cat: 'rotations', tone: 'purple', desc: 'Five-on-five possessions that freeze before the defense reacts. Who helps, who rotates, who\'s open?' },
  onball: { name: 'On-Ball Lab', icon: 'bolt', cat: 'onball', tone: 'green', desc: 'One-on-one against eight attacker types. Set your cushion, then react to his move.' },
  screens: { name: 'Screen Defense Lab', icon: 'book', cat: 'screens', tone: 'purple', desc: 'Every ball-screen and off-ball screen coverage, with every defender\'s job.' },
  anticipate: { name: 'Anticipation Trainer', icon: 'eye', cat: 'anticipation', tone: '', desc: 'Watch the possession, then predict the next help, pass or coverage before the clock runs out.' },
  recognize: { name: 'Coverage Recognition', icon: 'iq', cat: 'anticipation', tone: 'green', desc: 'Name the defense from how the defenders actually move, including disguised coverages.' },
  mistakes: { name: 'Mistake Detector', icon: 'spark', cat: 'decisions', tone: 'purple', desc: 'Guard one man for a whole possession. Every mistake is caught and explained.' },
  team: { name: 'Defend Our Playbook', icon: 'book', cat: 'helpside', tone: 'green', desc: 'Positioning tests built from your own Team Playbook plays: guard what we run.' },
};
const CHALLENGES = {
  pos5: { name: '5-second positioning', mod: 'position', tlim: 5000, kinds: null, desc: 'Five freeze frames, 5 seconds each.' },
  rot10: { name: '10-second rotations', mod: 'rotation', tlim: 10000, desc: 'Five rotation reads, 10 seconds per question.' },
  contain: { name: 'On-ball containment', mod: 'onball', desc: 'Five attackers. Contain them all.' },
  screen: { name: 'Screen navigation', mod: 'screens', tlim: 9000, desc: 'Five screen coverages, 9 seconds per read.' },
  help: { name: 'Help defense', mod: 'rotation', recipes: ['wingDrive', 'slotDrive', 'cornerDrive'], tlim: 8000, desc: 'Five drives: who helps, who stays, who rotates.' },
  close: { name: 'Closeouts', mod: 'position', kinds: ['closeout'], tlim: 5000, desc: 'Five closeouts: angle, distance, high hand.' },
  trans: { name: 'Transition defense', mod: 'position', kinds: ['transition'], tlim: 6000, desc: 'Five transition stops: 2-on-1, 3-on-2, numbers back.' },
  full: { name: 'Full-possession defense', mod: 'mistakes', desc: 'Three full possessions as one defender.' },
};
const DC = { sub: 'home', run: null, lvl: {}, recipe: 'auto', ob: 'auto', scr: 'auto', confirmReset: false };
const DR = { view: null, raf: 0, last: 0 };

// ---------- item factories ----------
function posItem(sit, mod = 'position', tlim) {
  const pos = { ...sit.pos, [sit.you]: sit.start };
  return { mod, title: sit.title, brief: sit.brief, lvl: sit.lvl, seed: sit.seed, key: sit.kind, start: { pos, ball: sit.ball }, phases: [{ beats: [], qs: [{ kind: 'spot', you: sit.you, sit, tlim, prompt: 'Drag yourself (the green ring) to where you should be, then tap your job.' }] }], sitDraw: sit };
}
function phasedItem(P, mod, tlim) {
  const phases = P.phases.map((ph) => ({ ...ph, qs: ph.qs.map((q) => ({ ...q, tlim: q.tlim || tlim })) }));
  return { mod, title: P.title, brief: P.desc || '', lvl: P.lvl, seed: P.seed, key: P.key, start: P.start, phases, you: P.you };
}
function onballItem(seed, lvl, type) {
  const ob = genOnBall(seed, lvl, type === 'auto' ? null : type);
  const at0 = RR(toward(ob.p, T_HOOP, 6.5));
  return { mod: 'onball', title: ob.A.name, brief: `${ob.A.name} at the ${{ top: 'top', wingL: 'left wing', wingR: 'right wing', slotL: 'left slot', slotR: 'right slot' }[ob.spot]}.${ob.late ? ' Late clock: 4 seconds left.' : ''}`, lvl, seed, key: ob.type, ob, start: { pos: { O1: ob.p, D1: at0 }, ball: 'O1' }, phases: [{ beats: [], qs: [{ kind: 'stance', you: 'D1', prompt: 'Drag yourself to your stance: distance and angle. Then tap “Set”.' }] }] };
}
function recogItem(seed, lvl) {
  const R = buildRecognition(seed, lvl);
  return { mod: 'recognize', title: 'Name the coverage', brief: lvl >= 2 ? 'Captions are hidden. Read the defenders.' : 'Watch how the defense moves with the ball and the screens.', lvl, seed, key: R.cov, start: R.start,
    phases: [{ beats: R.beats, qs: [{ kind: 'chips', prompt: R.change ? 'The defense changed during the possession. What are they in now?' : 'What defense is this?', choices: R.choices.map((k) => ({ k, t: COVERAGES[k].name })), answer: R.cov, cat: 'anticipation', tlim: lvl >= 3 ? 8000 : null, why: `${COVERAGES[R.cov].name}. The tell: ${RECOG_TELL[R.cov]}${R.change ? ` (They started in ${COVERAGES[R.change].name.toLowerCase()}.)` : ''}` }], reveal: { beats: [], labels: {}, lines: [`<b>${COVERAGES[R.cov].name}.</b> ${RECOG_TELL[R.cov]}`, `How to see it: ${COVERAGES[R.cov].desc}`, `Practice beating it on offense in the <a href="#teamsim" data-go-ts="${R.cov}">Coverage Sim</a>.`], title: 'The tell' } }] };
}
function screenItem(seed, lvl, type) {
  const r = rng(seed), t = type === 'auto' || !type ? rpick(r, lvl === 0 ? ['high', 'side', 'pin'] : Object.keys(SCREEN_TYPES)) : type;
  const map = { high: 'pnr', side: 'pnr', middle: 'pnr', empty: 'pnr', spain: 'spain', pin: 'screenAway', flare: 'screenAway', stagger: 'screenAway', multi: 'pnr' };
  const covs = lvl === 0 ? ['drop', 'hedge', 'over', 'switch'] : ['drop', 'hedge', 'hardHedge', 'blitz', 'switch', 'ice', 'under', 'show', 'weak'];
  const cov = DC.scrCov && DC.scrCov !== 'auto' ? DC.scrCov : rpick(r, t === 'side' || t === 'empty' ? ['ice', 'drop', 'hedge', 'blitz'].filter((x) => covs.includes(x)) : covs);
  if (map[t] !== 'pnr') { const P = buildRotation(map[t], seed, Math.max(1, lvl)); return { ...phasedItem(P, 'screens'), title: SCREEN_TYPES[t] }; }
  const B = new PossBuilder(seed, lvl, rpick(r, ['4out1in', '5out']), 'man');
  const H = t === 'side' || t === 'empty' ? OFF.find((o) => Math.abs(B.P(o)[0]) > 15 && B.P(o)[1] > 12) : OFF.find((o) => B.P(o)[1] > 24);
  if (H) { if (t === 'side' || t === 'empty') B.pass(H); else { B.sit.ball = H; B.start.ball = H; settle(B.sit); B.start.pos = { ...B.sit.pos }; } }
  if (t === 'empty') { // clear the ball side: the corner/wing on the ball side lifts to the other side
    const side = sgn(B.P(B.H)[0]); const mates = OFF.filter((o) => o !== B.H && B.P(o)[0] * side > 3 && isPerim(B.P(o)));
    if (mates.length) B.move(Object.fromEntries(mates.map((o, i) => [o, RR([-side * (10 + i * 8), 24 - i * 6])])), 'Empty the side');
  }
  if (t === 'middle') { B.sit.pos[B.H] = RR([sgn(B.P(B.H)[0] || 1) * 3, 27]); }
  const big = OFF.filter((o) => o !== B.H).sort((a, b) => distHoop(B.P(a)) - distHoop(B.P(b)))[0];
  B.ballScreen(big, cov);
  const { T, beats } = B.useScreen();
  const keyRoles = DEF.filter((d) => /^(scr|big|tag|fill|switchRoll|blitzBall|weakForce)/.test(T.spots[d]?.job));
  const you = lvl === 0 ? B.dOf(B.H) : rpick(r, keyRoles.length ? keyRoles : [B.dOf(B.H)]);
  const names = [...new Set(keyRoles.map((d) => JOBS[T.spots[d].job].name))];
  const distract = ['Go under the screen', 'Fight over the screen', 'Big: drop', 'Big: hedge and recover', 'Switch to the screener', 'Tag the roller', 'Ice the screen'].filter((n) => !names.includes(n));
  const choices = [...names, ...distract.sort(() => r() - 0.5).slice(0, Math.max(1, 4 - names.length))].sort(() => r() - 0.5).slice(0, 5);
  const yourJob = JOBS[T.spots[you].job].name; if (!choices.includes(yourJob)) choices[0] = yourJob;
  const qs = [
    { kind: 'chips', prompt: `${SCREEN_TYPES[t]} against ${BALL_COV[cov].name.toLowerCase()} coverage. You are ${XN(you)}. What's your job?`, choices: choices.map((n) => ({ k: n, t: n })), answer: yourJob, cat: 'screens', mark: you, why: JOBS[T.spots[you].job].why(mkCtx(B.sit, you, T)) },
    Q.spot(B.sit, you, `Now drag yourself (${XN(you)}) to that spot.`),
    lvl >= 1 && Q.call(B.sit),
    lvl >= 1 && ['hedge', 'hardHedge', 'blitz'].includes(cov) && you !== T.tagger && Q.tag(T, B.sit),
  ];
  B.freeze(qs, { beats, labels: jobLabels(T, you), lines: [...jobLines(T, B.sit, keyRoles.concat(T.tagger || []).filter((v, i, a) => a.indexOf(v) === i)), ...chainOf(T, B.sit), `<b>When to use it:</b> ${BALL_COV[cov].best}`], title: `${BALL_COV[cov].name}: the four jobs`, T });
  // mistake recovery: a teammate got caught on the screen; the handler turns the corner
  if (lvl >= 2 && ['over', 'drop', 'hedge', 'show', 'ice', 'weak'].includes(cov)) {
    const s2 = cloneSit(B.sit); clearEv(s2); const hp = s2.pos[B.H], at = driveAt(hp, DSIDE(hp) ? 'baseline' : 'middle', r);
    Object.assign(B.sit.pos, s2.pos); clearEv(B.sit); B.sit.drive = { who: B.H, from: hp, at, beaten: true, dir: 'turn' }; B.sit.pos[B.H] = at;
    const dH = B.dOf(B.H); B.push({ d: 1, m: { [B.H]: at, [dH]: toward(at, hp, 3) }, ball: B.H, cap: `${XN(dH)} got caught on the screen` });
    const aft = defReact(B.sit);
    B.freeze([{ ...Q.helper(aft.T, B.sit), prompt: `${XN(dH)} got caught on the screen and ${ON(B.H)} is turning the corner. Tap the defender who has to stop the ball.` }, aft.T.rotator && Q.rotator(aft.T, B.sit)], revealOf(B, aft, 'Recovering from a screen mistake'));
  }
  return { ...phasedItem(B.out({ title: SCREEN_TYPES[t], desc: `${BALL_COV[cov].name}: ${BALL_COV[cov].short}`, key: t + ':' + cov, seed, lvl }), 'screens'), title: SCREEN_TYPES[t] };
}
/** Positioning against the user's own plays: run a play from the Team Playbook and freeze it. */
function playbookItem(seed, lvl) {
  const r = rng(seed), plays = pbook().plays; if (!plays.length) return posItem(genPositioning(seed, lvl));
  const play = rpick(r, plays), S = newPossession({ play, covPlan: [{ cov: 'man' }], intensity: 2, mode: 'practice', seed });
  const step = advanceScript(S); if (step) { const a = step.actions.find((x) => x.type === 'pass'); if (a) { beat(S, 1, {}, { pass: [a.from, a.to] }, [], 'Pass'); applyPassRules(S, a.from, a.to, roleAt(S.pos[a.from]), roleAt(S.pos[a.to])); } S.stepIdx++; advanceScript(S); }
  // walk the beats to collect frames with a set offense
  const frames = []; let pos = { ...S.start.pos }, ball = S.start.ball;
  for (const b of S.beats) { pos = { ...pos, ...(b.m || {}) }; if (typeof b.ball === 'string') ball = b.ball; else if (b.ball?.pass) ball = b.ball.pass[1]; frames.push({ pos: { ...pos }, ball }); }
  const f = frames.length > 1 ? frames[1 + Math.floor(r() * (frames.length - 1))] : frames[0];
  const sit = { pos: {}, ball: f.ball, assign: Object.fromEntries(DEF.map((d, i) => [d, OFF[i]])), scheme: 'man' };
  for (const o of OFF) sit.pos[o] = f.pos[o];
  settle(sit); const s2 = finishSit(sit, 'static', `Our play: ${play.name}`, `This is our own “${play.name}” at the moment the ball is with ${ON(f.ball)}. Guard it.`, lvl);
  s2.seed = seed; return posItem(s2, 'team');
}
function makeItem(mod, seed, lvl, opts = {}) {
  if (mod === 'position') { const s = genPositioning(seed, lvl, opts.kinds ? { kinds: opts.kinds } : {}); s.seed = seed; return posItem(s, 'position', opts.tlim); }
  if (mod === 'rotation') { const keys = (opts.recipes || Object.keys(ROT_RECIPES)).filter((k) => ROT_RECIPES[k].min <= lvl); const key = opts.recipe && opts.recipe !== 'auto' ? opts.recipe : rpick(rng(seed), keys.length ? keys : ['wingDrive']); return phasedItem(buildRotation(key, seed, lvl), 'rotation', opts.tlim); }
  if (mod === 'onball') return onballItem(seed, lvl, opts.ob || 'auto');
  if (mod === 'screens') { const it = screenItem(seed, lvl, opts.scr || 'auto'); if (opts.tlim) for (const ph of it.phases) for (const q of ph.qs) q.tlim = q.tlim || opts.tlim; return it; }
  if (mod === 'anticipate') return phasedItem(buildAnticipation(seed, lvl), 'anticipate');
  if (mod === 'recognize') return recogItem(seed, lvl);
  if (mod === 'mistakes') return phasedItem(buildFullPossession(seed, lvl), 'mistakes');
  if (mod === 'team') return playbookItem(seed, lvl);
  return posItem(genPositioning(seed, lvl));
}
const newSeed = () => (Math.random() * 2 ** 31) >>> 0;
const modLevel = (mod) => (DC.lvl[mod] != null ? DC.lvl[mod] : dLevel(DMODS[mod]?.cat || 'decisions'));

// ---------- page shell ----------
function renderDefense() {
  const el = $('#view-defense');
  if (DC.run && DC.sub === 'run') return renderDRun(el);
  stopDR();
  const tabs = [['home', 'Overview'], ['modules', 'Train'], ['challenge', 'Challenges'], ['mistakes', 'Mistakes'], ['analytics', 'Analytics']];
  el.innerHTML = `<div class="page-head"><span class="eyebrow purple">Defense Intelligence Center</span><h1>Defensive IQ</h1><p>Learn where to stand, when to help, how to guard screens and what the offense is about to do. Every rep is graded on the decision; whether the shot went in is tracked separately.</p></div>
    <div class="filters dc-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" data-dsub="${k}" aria-pressed="${DC.sub === k || (DC.sub === 'setup' && k === 'modules')}">${t}</button>`).join('')}</div>
    <div id="dc-body"></div>`;
  for (const b of $$('[data-dsub]', el)) b.onclick = () => { DC.sub = b.dataset.dsub; renderDefense(); };
  const body = $('#dc-body');
  ({ home: dcHome, modules: dcModules, setup: dcSetup, challenge: dcChallenges, mistakes: dcMistakes, analytics: dcAnalytics }[DC.sub] || dcHome)(body);
  for (const b of $$('[data-dmod]', el)) b.onclick = () => { DC.mod = b.dataset.dmod; DC.sub = 'setup'; renderDefense(); window.scrollTo({ top: 0 }); };
  for (const b of $$('[data-dstart]', el)) b.onclick = () => startDSession(b.dataset.dstart, {});
  for (const b of $$('[data-dgo]', el)) b.onclick = () => go(b.dataset.dgo);
}
function catBars(s) {
  return `<div class="mastery-list">${Object.entries(DCATS).map(([k, n]) => { const b = s.by[k], v = b.acc; return `<div class="m-row"><span>${n}</span><span class="bar"><i style="width:${v ?? 0}%;background:${v == null ? 'transparent' : v >= 85 ? 'var(--green)' : v >= 65 ? 'var(--blue)' : v >= 45 ? 'var(--amber)' : 'var(--red)'}"></i></span><span>${v == null ? 'no reps' : `${v}% · ${DLEVELS[b.lvl]}`}</span></div>`; }).join('')}</div>`;
}
function dcHome(el) {
  const s = dStats(), D = ddoc(), today = isoDate(), dd = D.daily[today], coach = dCoach();
  const weak = Object.entries(s.by).filter(([, b]) => b.acc != null && b.n >= 3).sort((a, b) => a[1].acc - b[1].acc).slice(0, 3);
  el.innerHTML = `
    <div class="card iq-hero">
      <div class="iq-rating"><b>${s.iq ?? '—'}</b><span>${s.level}</span></div>
      <div class="stats" style="min-width:0">
        <div class="stat"><span>Reps</span><b>${s.n}</b><small>graded decisions</small></div>
        <div class="stat"><span>Last 40 correct</span><b>${s.recent.length ? Math.round(100 * s.recent.filter((x) => x.ok).length / s.recent.length) + '%' : '—'}</b><small>${s.recent.length ? 'decision accuracy' : 'no reps yet'}</small></div>
        <div class="stat"><span>Decision speed</span><b>${s.speed == null ? '—' : s.speed.toFixed(1) + 's'}</b><small>avg, last 30</small></div>
        <div class="stat"><span>Daily challenge</span><b>${dd ? dd.score : '—'}</b><small>${dd ? 'done today' : 'not played today'} · streak ${dStreak()}</small></div>
      </div>
    </div>
    <div class="two-col">
      <div class="card"><div class="section-title"><h2>Coach</h2><span class="muted small">From your recorded reps</span></div>
        ${coach.length ? coach.map((c) => `<div class="bd ${c.k === 'mistake' ? 'miss' : c.k === 'level' ? 'good' : 'best'}"><h4>${esc(c.title)}</h4><p class="small">${esc(c.txt)}</p><div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-dstart="${c.mod}">${icon('play')} ${DMODS[c.mod].name}</button></div></div>`).join('') : '<p class="muted small" style="margin-top:8px">No recommendations yet: the coach needs at least a few reps to see a pattern. Start with the Positioning Academy.</p><div class="row" style="margin-top:10px"><button type="button" class="btn" data-dstart="position">' + icon('play') + ' Start positioning</button></div>'}
      </div>
      <div class="card"><div class="section-title"><h2>Daily defensive challenge</h2><span class="muted small">${today}</span></div>
        <p class="small muted" style="margin:8px 0 12px">Five reps across positioning, rotations, on-ball, anticipation and recognition at your current levels. It counts toward your progress.</p>
        ${dd ? `<p><b>Done: ${dd.score}</b> <span class="muted small">(${dd.right}/${dd.total} correct)</span></p>` : '<button type="button" class="btn green" id="dc-daily">' + icon('bolt') + ' Play today\'s challenge</button>'}
      </div>
    </div>
    <div class="two-col">
      <div class="card"><div class="section-title"><h2>Skill by category</h2><span class="muted small">Accuracy, last 12 reps · level</span></div><div style="margin-top:12px">${catBars(s)}</div></div>
      <div class="card"><div class="section-title"><h2>Trend</h2><span class="muted small">Decision score per rep</span></div>${s.n ? dTrend(ddoc().list.slice(-40)) : '<p class="muted small" style="margin-top:10px">Your trend appears after your first reps.</p>'}
        ${weak.length ? `<p class="small" style="margin-top:10px"><b>Weakest:</b> ${weak.map(([k, b]) => `${DCATS[k]} (${b.acc}%)`).join(' · ')}</p>` : ''}</div>
    </div>
    <div class="section-title"><h2>Training modules</h2></div>
    <div class="grid dc-mods">${Object.entries(DMODS).map(([k, m]) => modCard(k, m)).join('')}</div>
    ${s.n ? `<div class="card"><div class="section-title"><h2>Recent reps</h2></div>${recentList(ddoc().list.slice(-8).reverse())}</div>` : ''}`;
  $('#dc-daily') && ($('#dc-daily').onclick = startDaily_D);
}
const modCard = (k, m) => `<button type="button" class="card sec-link" data-dmod="${k}"><span class="ic ${m.tone}">${icon(m.icon)}</span><span><h3>${m.name}</h3><p>${m.desc}</p><span class="small muted">Level: ${DLEVELS[modLevel(k)]}</span></span></button>`;
function recentList(L) { return `<div class="film-list">${L.map((x) => `<div class="film-row"><span class="sc ${x.ok ? 'band-good' : 'band-bad'}">${x.score}</span><span class="t"><b>${esc(x.title || DMODS[x.mod]?.name || '')}</b><span>${DMODS[x.mod]?.name || x.mod} · ${DCATS[x.cat] || ''} · ${DLEVELS[x.lvl] || ''}${x.out ? ' · ' + x.out : ''}</span></span><span class="r small muted">${fmtDate(x.ts)}</span></div>`).join('')}</div>`; }
function dcModules(el) { el.innerHTML = `<div class="grid dc-mods">${Object.entries(DMODS).map(([k, m]) => modCard(k, m)).join('')}</div>`; }
function dcSetup(el) {
  const k = DC.mod, m = DMODS[k], L = modLevel(k);
  el.innerHTML = `<div class="card ts-setup"><div class="section-title"><h2>${m.name}</h2></div><p class="muted">${m.desc}</p>
    <div class="fld"><span>Difficulty</span><div class="seg" role="group" aria-label="Difficulty">${DLEVELS.map((n, i) => `<button type="button" data-dl="${i}" aria-pressed="${L === i}">${n}</button>`).join('')}</div></div>
    <p class="small muted">The coach sets this from your accuracy (80%+ over 8 reps moves you up). Changing it here overrides that for this session.</p>
    ${k === 'rotation' ? `<label class="fld"><span>Situation</span><select id="dc-recipe"><option value="auto">Mixed (recommended)</option>${Object.entries(ROT_RECIPES).map(([rk, r]) => `<option value="${rk}" ${DC.recipe === rk ? 'selected' : ''}>${r.name}${r.min > L ? ' (harder)' : ''}</option>`).join('')}</select></label>` : ''}
    ${k === 'onball' ? `<label class="fld"><span>Attacker</span><select id="dc-ob"><option value="auto">Random</option>${Object.entries(ATTACKERS).map(([ak, a]) => `<option value="${ak}" ${DC.ob === ak ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label>` : ''}
    ${k === 'screens' ? `<div class="form-grid"><label class="fld"><span>Screen</span><select id="dc-scr"><option value="auto">Random</option>${Object.entries(SCREEN_TYPES).map(([sk, n]) => `<option value="${sk}" ${DC.scr === sk ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="fld"><span>Coverage (ball screens)</span><select id="dc-scrcov"><option value="auto">Random</option>${Object.entries(BALL_COV).map(([ck, c]) => `<option value="${ck}" ${DC.scrCov === ck ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label></div>` : ''}
    ${k === 'team' ? `<p class="small">Uses the ${pbook().plays.length} plays in your <a href="#playbook">Team Playbook</a>.</p>` : ''}
    <div class="row"><button type="button" class="btn green" id="dc-go">${icon('play')} Start</button><button type="button" class="btn ghost" id="dc-back">‹ All modules</button></div></div>
    ${moduleHistory(k)}`;
  for (const b of $$('[data-dl]', el)) b.onclick = () => { DC.lvl[k] = Number(b.dataset.dl); dcSetup(el); };
  $('#dc-recipe') && ($('#dc-recipe').onchange = (e) => { DC.recipe = e.target.value; });
  $('#dc-ob') && ($('#dc-ob').onchange = (e) => { DC.ob = e.target.value; });
  $('#dc-scr') && ($('#dc-scr').onchange = (e) => { DC.scr = e.target.value; });
  $('#dc-scrcov') && ($('#dc-scrcov').onchange = (e) => { DC.scrCov = e.target.value; });
  $('#dc-go').onclick = () => startDSession(k, { recipe: DC.recipe, ob: DC.ob, scr: DC.scr, lvl: modLevel(k) });
  $('#dc-back').onclick = () => { DC.sub = 'modules'; renderDefense(); };
}
function moduleHistory(k) {
  const L = ddoc().list.filter((x) => x.mod === k);
  if (!L.length) return `<div class="card"><p class="muted small">No reps in this module yet. Your accuracy by level and your repeated mistakes here will show after you play.</p></div>`;
  const byL = DLEVELS.map((n, i) => { const a = L.filter((x) => x.lvl === i); return a.length ? `${n}: ${Math.round(100 * a.filter((x) => x.ok).length / a.length)}% (${a.length})` : null; }).filter(Boolean);
  return `<div class="card"><div class="section-title"><h2>Your history here</h2><span class="muted small">${L.length} reps</span></div><p class="small" style="margin:8px 0">${byL.join(' · ')}</p>${recentList(L.slice(-6).reverse())}</div>`;
}
function dcChallenges(el) {
  const D = ddoc();
  el.innerHTML = `<p class="muted" style="margin-bottom:12px">Timed sets of five. Pick a difficulty: Beginner is clear assignments and simple actions; Elite is disguised actions, late adjustments and rapid decisions.</p>
    <div class="fld" style="margin-bottom:12px"><span>Difficulty</span><div class="seg" role="group" aria-label="Challenge difficulty">${DLEVELS.map((n, i) => `<button type="button" data-cl="${i}" aria-pressed="${(DC.cl ?? 0) === i}">${n}</button>`).join('')}</div></div>
    <div class="grid dc-mods">${Object.entries(CHALLENGES).map(([k, c]) => { const best = D.chal[k + ':' + (DC.cl ?? 0)]; return `<button type="button" class="card sec-link" data-chal="${k}"><span class="ic">${icon('trophy')}</span><span><h3>${c.name}</h3><p>${c.desc}</p><span class="small muted">${best ? `Best at ${DLEVELS[DC.cl ?? 0]}: ${best}` : 'Not completed at this level'}</span></span></button>`; }).join('')}</div>`;
  for (const b of $$('[data-cl]', el)) b.onclick = () => { DC.cl = Number(b.dataset.cl); dcChallenges(el); };
  for (const b of $$('[data-chal]', el)) b.onclick = () => { const c = CHALLENGES[b.dataset.chal]; startDSession(c.mod, { lvl: DC.cl ?? 0, tlim: c.tlim, kinds: c.kinds, recipes: c.recipes, n: c.mod === 'mistakes' ? 3 : 5, chal: b.dataset.chal }); };
}
function dcMistakes(el) {
  const L = ddoc().list.filter((x) => x.mistakes?.length).slice(-40).reverse(), s = dStats();
  const rep = Object.entries(s.mist).sort((a, b) => b[1] - a[1]);
  el.innerHTML = `<div class="card"><div class="section-title"><h2>Mistake Detector</h2></div><p class="muted" style="margin:6px 0 12px">Guard one man through a full possession: ball movement, a drive or a ball screen, a kick-out. Every freeze checks your spot against your job and names the mistake, with how to fix it.</p>
      <button type="button" class="btn purple" data-dstart="mistakes">${icon('play')} Defend a full possession</button></div>
    <div class="card"><div class="section-title"><h2>Repeated mistakes</h2><span class="muted small">Last 150 reps</span></div>
      ${rep.length ? rep.map(([k, n]) => { const M = MISTAKES[k]; return `<details class="bd ${n >= 3 ? 'miss' : ''}"><summary><b>${M.name}</b> · ${n}×</summary><p class="small"><b>Why it matters:</b> ${esc(M.why({}))}</p><p class="small"><b>How to fix it:</b> ${esc(M.fix({}))}</p><div class="row" style="margin-top:6px"><button type="button" class="btn sm" data-dstart="${CAT_MODULE[M.cat]}">Train it: ${DMODS[CAT_MODULE[M.cat]].name}</button></div></details>`; }).join('') : '<p class="muted small" style="margin-top:8px">No mistakes recorded yet.</p>'}</div>
    <div class="card"><div class="section-title"><h2>Defensive film</h2><span class="muted small">Replay any rep where something went wrong</span></div>
      ${L.length ? `<div class="film-list">${L.map((x, i) => `<div class="film-row"><span class="sc band-bad">${x.score}</span><span class="t"><b>${esc(x.mistakes.map((m) => MISTAKES[m]?.name).filter(Boolean).join(', '))}</b><span>${esc(x.title || '')} · ${DMODS[x.mod]?.name || ''} · ${fmtDate(x.ts)}</span></span><button type="button" class="btn ghost sm" data-replay="${i}">Replay</button></div>`).join('')}</div>` : '<p class="muted small" style="margin-top:8px">Reps with mistakes are saved here so you can run them again.</p>'}</div>`;
  for (const b of $$('[data-replay]', el)) b.onclick = () => { const x = L[Number(b.dataset.replay)]; startDSession(x.mod, { lvl: x.lvl, replay: x }); };
}
function dcAnalytics(el) {
  const s = dStats(), L = ddoc().list;
  if (!L.length) { el.innerHTML = emptyState('chart', 'No defensive reps yet', 'Accuracy by category and difficulty, decision speed, repeated mistakes and decision-vs-outcome build from the reps you play.', '<button type="button" class="btn" data-dstart="position">Start the Positioning Academy</button>'); return; }
  const byLvl = DLEVELS.map((n, i) => { const a = L.filter((x) => x.lvl === i); return { n, k: a.length, acc: a.length ? Math.round(100 * a.filter((x) => x.ok).length / a.length) : null }; });
  const byMod = Object.entries(DMODS).map(([k, m]) => { const a = L.filter((x) => x.mod === k), t = a.filter((x) => x.ms != null); return { name: m.name, k: a.length, acc: a.length ? Math.round(100 * a.filter((x) => x.ok).length / a.length) : null, sp: t.length ? mean(t.map((x) => x.ms)) / 1000 : null }; }).filter((x) => x.k);
  const ob = L.filter((x) => x.out && x.out !== 'none'), m = { gg: 0, gb: 0, bg: 0, bb: 0 };
  for (const x of ob) { const g = x.ok, stop = x.out === 'stop'; m[(g ? 'g' : 'b') + (stop ? 'g' : 'b')]++; }
  const strong = Object.entries(s.by).filter(([, b]) => b.acc != null && b.n >= 3).sort((a, b) => b[1].acc - a[1].acc);
  el.innerHTML = `
    <div class="card"><div class="section-title"><h2>Progress over time</h2><span class="muted small">Last ${Math.min(60, L.length)} reps</span></div>${dTrend(L.slice(-60))}</div>
    <div class="two-col">
      <div class="card"><div class="section-title"><h2>By category</h2></div><div class="tbl-wrap"><table class="ts-tbl"><thead><tr><th>Category</th><th>Reps</th><th>Accuracy</th><th>Avg</th><th>Level</th></tr></thead><tbody>${Object.entries(DCATS).map(([k, n]) => { const b = s.by[k]; return `<tr><td>${n}</td><td>${b.n}</td><td>${b.acc == null ? '—' : b.acc + '%'}</td><td>${b.avg ?? '—'}</td><td>${DLEVELS[b.lvl]}</td></tr>`; }).join('')}</tbody></table></div>
        ${strong.length ? `<p class="small" style="margin-top:10px"><b>Strongest:</b> ${strong.slice(0, 2).map(([k, b]) => `${DCATS[k]} (${b.acc}%)`).join(', ')} · <b>Weakest:</b> ${strong.slice(-2).reverse().map(([k, b]) => `${DCATS[k]} (${b.acc}%)`).join(', ')}</p>` : ''}</div>
      <div class="card"><div class="section-title"><h2>Accuracy by difficulty</h2></div>${barChart(byLvl.map((x) => ({ l: x.n, v: x.acc, n: x.k })))}
        <div class="section-title" style="margin-top:14px"><h2>Decision speed by module</h2></div>${byMod.filter((x) => x.sp != null).length ? barChart(byMod.filter((x) => x.sp != null).map((x) => ({ l: x.name.replace(/ (Academy|Lab|Sim|Trainer|Detector)$/, ''), v: x.sp, n: x.k, unit: 's', max: Math.max(5, ...byMod.map((y) => y.sp || 0)) }))) : '<p class="muted small">Timed questions measure speed.</p>'}</div>
    </div>
    <div class="two-col">
      <div class="card"><div class="section-title"><h2>On-ball: decision vs. outcome</h2><span class="muted small">${ob.length} one-on-one reps</span></div>
        <div class="matrix" style="margin-top:12px"><span></span><span class="h">Stopped him</span><span class="h">He scored / foul</span>
          <span class="h left">Good defense (70+)</span><div class="c gg"><b>${m.gg}</b><span>Right and rewarded</span></div><div class="c gb"><b>${m.gb}</b><span>Right, he made a tough one. Keep doing it.</span></div>
          <span class="h left">Wrong</span><div class="c bg"><b>${m.bg}</b><span>Lucky stop</span></div><div class="c bb"><b>${m.bb}</b><span>Wrong and punished</span></div></div>
        <p class="hint" style="margin-top:10px">A made shot against good defense is not counted as your mistake.</p></div>
      <div class="card"><div class="section-title"><h2>Mistake frequency</h2></div>${Object.keys(s.mist).length ? barChart(Object.entries(s.mist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ l: MISTAKES[k].name, v: n, n, unit: '×', max: Math.max(...Object.values(s.mist)) }))) : '<p class="muted small">No mistakes recorded.</p>'}</div>
    </div>
    <div class="card"><div class="section-title"><h2>Training priorities</h2></div>${dCoach().map((c) => `<p class="small" style="margin-top:8px">• <b>${esc(c.title)}</b>: ${esc(c.txt)}</p>`).join('') || '<p class="muted small">Play more reps for recommendations.</p>'}</div>
    <div class="card"><div class="row"><span class="grow small muted">Defensive progress is stored with the rest of your IQ Lab data.</span>${DC.confirmReset ? `<span class="small"><b>Erase all defensive reps?</b></span><button type="button" class="btn sm" style="background:var(--red)" id="dc-erase">Erase</button><button type="button" class="btn ghost sm" id="dc-cancel">Cancel</button>` : '<button type="button" class="btn ghost sm" id="dc-reset">Reset defense progress…</button>'}</div></div>`;
  $('#dc-reset') && ($('#dc-reset').onclick = () => { DC.confirmReset = true; dcAnalytics(el); });
  $('#dc-cancel') && ($('#dc-cancel').onclick = () => { DC.confirmReset = false; dcAnalytics(el); });
  $('#dc-erase') && ($('#dc-erase').onclick = () => { cache.defense = BLANK.defense(); persist('defense'); DC.confirmReset = false; toast('Defensive progress erased'); dcAnalytics(el); });
}
function barChart(rows) {
  const max = rows[0]?.max ?? 100;
  return `<div class="mastery-list" style="margin-top:10px">${rows.map((r) => `<div class="m-row"><span>${esc(r.l)}</span><span class="bar"><i style="width:${r.v == null ? 0 : clamp((r.v / max) * 100, 2, 100)}%;background:${r.unit ? 'var(--blue)' : r.v >= 85 ? 'var(--green)' : r.v >= 65 ? 'var(--blue)' : r.v >= 45 ? 'var(--amber)' : 'var(--red)'}"></i></span><span>${r.v == null ? 'no reps' : (r.unit === 's' ? r.v.toFixed(1) + 's' : r.unit ? r.v + r.unit : r.v + '%') + (r.unit === '×' ? '' : ' · ' + r.n)}</span></div>`).join('')}</div>`;
}
function dTrend(L) {
  const W = 640, H = 180, Lm = 30, Rr = 10, T = 12, B = 20, n = L.length;
  const x = (i) => Lm + (n <= 1 ? (W - Lm - Rr) / 2 : (i / (n - 1)) * (W - Lm - Rr)), y = (v) => T + (1 - v / 100) * (H - T - B);
  const grid = [0, 50, 70, 100].map((v) => `<line x1="${Lm}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(130,160,255,${v === 70 ? '.35' : '.1'})" ${v === 70 ? 'stroke-dasharray="4 4"' : ''}/><text x="${Lm - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  // rolling average of 5 makes the trend readable; dots are the individual reps
  const roll = L.map((_, i) => mean(L.slice(Math.max(0, i - 4), i + 1).map((r) => r.score)));
  const line = roll.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const dots = L.map((r, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(r.score).toFixed(1)}" r="3" fill="${r.ok ? '#2fd68a' : '#ff5a6e'}" opacity=".8"><title>${esc(r.title || '')}: ${r.score}</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Defensive decision scores over time">${grid}<text x="${W - Rr}" y="${y(70) - 5}" text-anchor="end">correct</text>${dots}<path d="${line}" fill="none" stroke="#9b7bff" stroke-width="2.4" stroke-linejoin="round"/></svg>
    <div class="row small muted" style="gap:14px;margin-top:6px"><span><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#2fd68a"/></svg> correct</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#ff5a6e"/></svg> wrong</span><span><svg width="16" height="10"><path d="M0 5h16" stroke="#9b7bff" stroke-width="2.4"/></svg> 5-rep average</span></div>`;
}
function dStreak() { const D = ddoc().daily; let n = 0; const d = new Date(); if (!D[isoDate(d)]) d.setDate(d.getDate() - 1); while (D[isoDate(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
function startDaily_D() {
  const day = isoDate(), seed = [...day].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), r = rng(seed);
  const mods = ['position', 'rotation', 'onball', 'anticipate', 'recognize'];
  const items = mods.map((m, i) => makeItem(m, (seed + i * 7919) >>> 0, modLevel(m), {}));
  startDSessionItems(items, { daily: day, title: 'Daily defensive challenge' });
  void r;
}

// ---------- session + runner ----------
function startDSession(mod, opts) {
  if (opts.replay) { const x = opts.replay; const it = makeItem(mod, x.seed, x.lvl, { recipe: x.key && ROT_RECIPES[x.key] ? x.key : 'auto', ob: x.mod === 'onball' ? x.key : 'auto' }); return startDSessionItems([it], { title: 'Replay', mod }); }
  const lvl = opts.lvl ?? modLevel(mod);
  const run = { mod, opts, lvl, n: opts.n || 0, items: [], i: -1, results: [], chal: opts.chal, title: DMODS[mod].name };
  DC.run = run; DC.sub = 'run'; nextDItem(); go('defense');
}
function startDSessionItems(items, meta) { DC.run = { items, i: -1, results: [], n: items.length, fixed: true, ...meta }; DC.sub = 'run'; nextDItem(); go('defense'); }
function nextDItem() {
  const run = DC.run; run.i++;
  if (!run.fixed) { if (run.n && run.i >= run.n) return finishDSession(); run.items[run.i] = makeItem(run.mod, newSeed(), run.lvl, run.opts); }
  else if (run.i >= run.items.length) return finishDSession();
  const it = run.items[run.i];
  Object.assign(DR, { item: it, beats: [], ph: -1, qi: 0, st: 'play', t: 0, tEnd: 0, playing: false, fb: null, static: null, picks: [], qres: [], make: false, mark: null, labels: {}, you: it.you || it.phases[0]?.qs.find((q) => q.you)?.you || 'none' });
  nextPhase();
}
function nextPhase() {
  const it = DR.item; DR.ph++; DR.qi = 0; DR.fb = null; DR.static = null; DR.labels = {}; DR.mark = null; DR.picks = [];
  if (DR.ph >= it.phases.length) return endItem();
  const ph = it.phases[DR.ph];
  DR.beats.push(...ph.beats);
  if (!DR.beats.length) { DR.track = staticTrack(it.start.pos, it.start.ball); DR.t = DR.tEnd = 1; DR.playing = false; DR.st = 'play'; return arriveD(); }
  DR.track = compile(it.start, DR.beats, { make: DR.make }); DR.tEnd = DR.track.t1;
  DR.target = DR.tEnd; DR.playing = true; DR.st = 'play';
  if (DR.ph === 0) DR.t = 0;
  renderDRunPanel(); loopD();
}
function staticTrack(pos, ball) { return { segs: [{ t0: 0, t1: 1, from: { ...pos }, to: { ...pos }, ball, beat: {} }], dur: 1, t1: 1, end: { pos, ball } }; }
function frameState() { const st = DR.static ? stateAt(DR.static, 1) : stateAt(DR.track, DR.t); return st; }
function arriveD() {
  DR.playing = false;
  if (DR.st === 'reveal') { DR.st = 'revealed'; return renderDRunPanel(); }
  if (DR.st === 'whatif') { DR.st = 'feedback'; DR.static = DR.fbStatic; return renderDRunPanel(); }
  const ph = DR.item.phases[DR.ph];
  if (ph.qs.length) return askQ();
  return revealPhase();
}
function askQ() {
  const q = DR.item.phases[DR.ph].qs[DR.qi]; DR.q = q; DR.st = 'ask'; DR.fb = null; DR.tAsk = performance.now(); DR.mark = q.mark || null;
  const st = frameState();
  if (q.kind === 'spot' || q.kind === 'stance') {
    const pos = { ...st.pos }; DR.at = pos[q.you]; DR.intent = null; DR.you = q.you;
    DR.static = staticTrack(pos, st.holder || DR.item.start.ball);
  } else DR.static = staticTrack({ ...st.pos }, st.holder || null);
  DR.labels = DR.you && DR.you !== 'none' ? { [DR.you]: 'YOU' } : {};
  DR.deadline = q.tlim ? performance.now() + q.tlim : 0;
  renderDRunPanel(); loopD();
}
function answerQ(ans) {
  const q = DR.q; if (DR.st !== 'ask') return;
  const ms = Math.round(performance.now() - DR.tAsk), it = DR.item;
  let res;
  if (q.kind === 'spot') {
    const j = judgeSpot(q.sit, q.you, ans.at, ans.intent ?? null);
    res = { ok: j.ok, score: j.score, cat: j.cat, mistakes: j.mistakes, j, ms, kind: 'spot' };
    DR.fb = { kind: 'spot', at: ans.at, ideal: j.ideal, tol: j.tol, j };
    DR.labels = jobLabels(j.T, q.you);
    const pos = { ...DR.static.segs[0].from, [q.you]: ans.at }; DR.static = staticTrack(pos, DR.static.segs[0].ball); DR.fbStatic = DR.static;
  } else if (q.kind === 'stance') {
    const ob = it.ob, stc = judgeStance(ob, ans.at), mv = attackerMove(ob, stc), fr = moveFrame(ob, mv, ans.at);
    it.st = stc; it.mv = mv; it.fr = fr; it.at = ans.at;
    DR.fb = { kind: 'stance', at: ans.at, ideal: stc.ideal };
    // he reacts: append his move and the reaction question
    const tl = [2600, 2100, 1600, 1200][it.lvl];
    it.phases.push({ beats: [{ d: mv === 'hesi' || mv === 'pumpdrive' ? 0.7 : 0.5, m: { O1: fr.off, D1: ans.at }, ball: 'O1', cap: '' }], qs: [{ kind: 'react', you: 'D1', tlim: tl, prompt: `${fr.txt} React! Tap the floor in his path to cut him off · tap yourself to hold · tap him to contest.` }] });
    DR.st = 'answered'; DR.ansAt = performance.now(); renderDRunPanel();
    setTimeout(() => { if (DR.item === it && DR.st === 'answered') { DR.st = 'play'; nextPhase(); } }, 350);
    return;
  } else if (q.kind === 'react') {
    const re = judgeReaction(it.ob, it.fr, ans.kind, ans.at, it.at), out = onBallOutcome(it.ob, it.st, re, it.mv, it.ob.r);
    const score = Math.round(it.st.score * 0.45 + re.score * 0.55), ok = score >= 70;
    const codes = [...it.st.issues.map((i) => ({ tight: 'tooTight', loose: 'farFromMan', offline: 'straightLine', givesMiddle: 'gaveMiddle' })[i]), re.score < 60 ? ({ cutoff: 'lateSlide', hold: 'bitFake', contest: 'noContest' })[it.fr.want] : null].filter(Boolean);
    const c = { X: 'You', O: 'the attacker', dm: it.st.c, im: r1((it.st.lo + it.st.hi) / 2) };
    res = { ok, score, cat: 'onball', mistakes: codes.map((k) => mistakeOut(k, c)), ms, kind: 'react', out: out.foul ? 'foul' : out.make ? 'scored' : 'stop', re, stc: it.st };
    DR.fb = { kind: 'react', at: ans.at, ideal: it.fr.ideal, rk: ans.kind };
    DR.make = out.make && !out.foul;
    it.phases.push({ beats: onBallResultBeats(it, ans, re, out), qs: [], reveal: { beats: [], labels: {}, title: out.foul ? 'Foul' : out.make ? 'He scored' : 'Stop', lines: [`<b>Stance (${it.st.score}).</b> You were ${it.st.c} ft away; against a ${it.ob.A.name.toLowerCase()} the cushion is ${it.st.lo}–${it.st.hi} ft${it.ob.late ? ' (closer late in the clock)' : ''}. ${it.st.issues.length ? 'Issues: ' + it.st.issues.map((i) => ({ tight: 'too tight for his speed', loose: 'too much space', offline: 'not between him and the rim', givesMiddle: 'you gave him the middle' })[i]).join(', ') + '.' : 'Good distance and angle.'}`, `<b>His move:</b> ${it.fr.txt} He went for that because ${it.st.issues.length ? 'of what your stance gave him' : 'it\'s his go-to move'}.`, `<b>Reaction (${re.score}).</b> ${re.note}`, `<b>Scouting tip:</b> ${it.ob.A.tip}`, `<b>Outcome (separate from your grade):</b> ${out.foul ? 'Foul on the play.' : out.make ? `He scored. The shot had about a ${Math.round(out.p * 100)}% chance against your defense${ok ? ', so you did your job' : ''}.` : 'He didn\'t score.'}`] } });
  } else {
    const ok = ans === q.answer; res = { ok, score: ok ? 100 : 0, cat: q.cat, mistakes: [], ms, kind: q.kind, pick: ans };
    if (!ok && q.kind === 'chips' && q.cat === 'communication') res.mistakes = [mistakeOut('wrongJob', { pick: q.choices.find((c) => c.k === ans)?.t || 'no answer', want: q.choices.find((c) => c.k === q.answer)?.t, jobWhy: q.why })];
    if (!ok && q.cat === 'lowman' && q.kind === 'tapD') res.mistakes = [mistakeOut(/tag/i.test(q.prompt) ? 'noTag' : 'missLow', { B: 'the driver', R: 'the roller' })];
    if (!ok && q.cat === 'rotations' && q.kind === 'tapD') res.mistakes = [mistakeOut('noRotate', {})];
    DR.fb = { kind: q.kind, pick: ans, answer: q.answer, ok };
  }
  if (q.tlim && ms > q.tlim) { res.ok = false; res.score = Math.min(res.score, 40); res.late = true; }
  DR.qres.push({ q, res });
  dRecord({ mod: it.mod, cat: res.cat || DMODS[it.mod].cat, lvl: it.lvl, score: res.score, ok: res.ok, ms: q.tlim || q.kind === 'react' ? ms : null, mistakes: res.mistakes.map((m) => m.code), seed: it.seed, key: it.key, title: it.title, out: res.out });
  DR.st = 'feedback'; renderDRunPanel();
}
function onBallResultBeats(it, ans, re, out) {
  const fr = it.fr, p0 = fr.off, D0 = it.at;
  if (fr.want === 'contest') return [{ d: 0.35, m: { D1: ans.kind === 'contest' ? toward(p0, D0, 2.2) : D0 }, ball: 'O1', cap: ans.kind === 'contest' ? 'Contest' : 'No contest' }, { d: 1.1, m: {}, ball: { shot: 'O1', three: distHoop(p0) > 22 }, cap: '', reb: 'D1', rebSpot: [1, 9] }];
  if (re.score >= 70) { const stopAt = fr.want === 'hold' ? toward(p0, fr.driveTo, 3) : toward(p0, fr.driveTo, Math.max(1.5, dist(p0, re.score && fr.ideal ? fr.ideal : D0) - 2.5)); const dTo = fr.want === 'hold' ? toward(stopAt, T_HOOP, 2.4) : ans.at; return [{ d: 0.9, m: { O1: stopAt, D1: dTo }, ball: 'O1', cap: 'Cut off' }, { d: 1.1, m: { D1: toward(stopAt, dTo, 2) }, ball: { shot: 'O1' }, cap: 'Tough shot over you', reb: 'D1', rebSpot: [1, 9] }]; }
  const drv = toward(fr.driveTo, T_HOOP, -1);
  return [{ d: 1, m: { O1: drv, D1: ans.kind === 'cutoff' ? ans.at : toward(D0, drv, 1.5) }, ball: 'O1', cap: 'Blow-by' }, { d: 0.9, m: { O1: toward(drv, T_HOOP, 3) }, ball: { shot: 'O1' }, cap: out.foul ? 'And-one chance' : 'At the rim', reb: 'D1', rebSpot: [1, 9] }];
}
function continueD() {
  const ph = DR.item.phases[DR.ph];
  if (DR.st === 'feedback') {
    if (DR.qi + 1 < ph.qs.length) { DR.qi++; DR.static = null; return askQ(); }
    return revealPhase();
  }
  if (DR.st === 'revealed' || DR.st === 'noreveal') return nextPhase();
}
function revealPhase() {
  const ph = DR.item.phases[DR.ph], rv = ph.reveal;
  DR.static = null; DR.fb = null;
  if (!rv) { DR.st = 'noreveal'; return continueD(); }
  DR.labels = rv.labels || {}; DR.revealTitle = rv.title; DR.revealLines = rv.lines || [];
  if (rv.beats?.length) { DR.beats.push(...rv.beats); DR.track = compile(DR.item.start, DR.beats, { make: DR.make }); DR.tEnd = DR.track.t1; DR.target = DR.tEnd; DR.playing = true; DR.st = 'reveal'; renderDRunPanel(); loopD(); }
  else { DR.st = 'revealed'; renderDRunPanel(); }
}
function showWhatIf() {
  const f = DR.fb; if (!f?.j) return;
  const code = f.j.mistakes[0]?.code; const beats = whatIfBeats(DR.q.sit, DR.q.you, f.at, code); if (!beats.length) return;
  const start = { pos: { ...DR.fbStatic.segs[0].from }, ball: DR.q.sit.ball };
  DR.whatTrack = compile(start, beats, { make: true }); DR.static = null; DR.wt = 0; DR.st = 'whatif'; loopD(); renderDRunPanel();
}
function endItem() {
  const run = DC.run, sc = DR.qres.length ? Math.round(mean(DR.qres.map((x) => x.res.score))) : 0;
  run.results.push({ title: DR.item.title, score: sc, right: DR.qres.filter((x) => x.res.ok).length, total: DR.qres.length, mistakes: DR.qres.flatMap((x) => x.res.mistakes) });
  DR.st = 'itemdone'; renderDRunPanel();
}
function finishDSession() {
  const run = DC.run, R = run.results, score = R.length ? Math.round(mean(R.map((x) => x.score))) : 0, right = R.reduce((a, x) => a + x.right, 0), total = R.reduce((a, x) => a + x.total, 0);
  if (run.daily) { ddoc().daily[run.daily] = { score, right, total }; persist('defense'); }
  if (run.chal) { const k = run.chal + ':' + run.lvl, D = ddoc(); if (!D.chal[k] || D.chal[k] < score) D.chal[k] = score; persist('defense'); }
  run.done = { score, right, total }; DR.st = 'sessiondone'; renderDRunPanel();
}
function stopDR() { cancelAnimationFrame(DR.raf); DR.raf = 0; }
function loopD() {
  if (DR.raf) return;
  DR.last = performance.now();
  const step = (now) => {
    DR.raf = 0; if (current !== 'defense' || DC.sub !== 'run') return;
    const dt = Math.min(0.05, (now - DR.last) / 1000); DR.last = now;
    if (DR.st === 'whatif') { DR.wt += dt; if (DR.wt >= DR.whatTrack.t1 + 0.6) { arriveD(); } }
    else if (DR.playing) { DR.t = Math.min(DR.target, DR.t + dt); if (DR.t >= DR.target) arriveD(); }
    if (DR.st === 'ask' && DR.deadline) {
      const left = DR.deadline - now, bar = $('#dr-timer i'); if (bar) bar.style.width = clamp((left / DR.q.tlim) * 100, 0, 100) + '%';
      if (left <= 0) { DR.deadline = 0; timeoutQ(); }
    }
    try { drawD(); } catch (e) { console.warn('draw', e); }
    if (!DR.raf) DR.raf = requestAnimationFrame(step);
  };
  DR.raf = requestAnimationFrame(step);
}
function timeoutQ() {
  const q = DR.q;
  if (q.kind === 'spot' || q.kind === 'stance') answerQ({ at: DR.at, intent: DR.intent });
  else if (q.kind === 'react') answerQ({ kind: 'late', at: DR.at });
  else answerQ(null);
  toast('Time! Decide faster: the play doesn\'t wait.');
}

// ---------- drawing ----------
function drawD() {
  const V = DR.view; if (!V) return;
  const it = DR.item, o = { captions: DR.st !== 'ask', you: DR.you || 'none', labels: DR.labels, highlight: DR.mark };
  if (DR.st === 'whatif') { V.draw(DR.whatTrack, Math.min(DR.wt, DR.whatTrack.t1), { ...o, labels: { [DR.q.you]: 'YOU' } }); return; }
  let track = DR.track, t = DR.t;
  if (DR.static) { track = DR.static; t = 1; }
  if ((DR.st === 'ask' || DR.st === 'feedback' || DR.st === 'answered') && DR.at && DR.you && DR.static && ['spot', 'stance'].includes(DR.q?.kind) && DR.st === 'ask') {
    const pos = { ...DR.static.segs[0].from, [DR.you]: DR.at }; track = staticTrack(pos, DR.static.segs[0].ball);
  }
  // situation cues while you decide: drive arrow, screen, closeout pass
  const sd = DR.q?.sit || it.sitDraw;
  const pre = [], diag = [];
  if (sd && (DR.st === 'ask' || DR.st === 'feedback')) {
    if (sd.drive) pre.push({ from: sd.drive.from, to: toward(sd.drive.at, T_HOOP, -0.5), color: 'rgba(255,90,110,.85)', label: 'DRIVE' });
    if (sd.screen) diag.push({ type: 'screen', from: sd.pos[sd.screen.screener], to: toward(sd.pos[sd.screen.screener], sd.pos[sd.screen.user], 1.6) });
    if (sd.cut) pre.push({ from: sd.cut.from, to: sd.cut.to, color: 'rgba(255,255,255,.8)', dash: true, label: 'CUT' });
    if (sd.closeout) pre.push({ from: sd.pos[sd.closeout.from] || sd.pos[sd.ball], to: sd.pos[sd.closeout.to], color: 'rgba(255,214,90,.9)', dash: true });
    if (sd.trans) pre.push({ from: sd.pos[sd.ball], to: toward(sd.pos[sd.ball], T_HOOP, 8), color: 'rgba(255,90,110,.7)', dash: true, label: 'PUSH' });
  }
  if (it.ob && DR.st === 'ask' && DR.q.kind === 'stance') pre.push({ from: it.ob.p, to: toward(it.ob.p, T_HOOP, 5), color: 'rgba(255,255,255,.25)', dash: true });
  V.draw(track, t, { ...o, previews: pre, diagram: diag });
  const ctx = V.ctx, s = V.s;
  const ring = (p, col, r = 2.2, lab, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, s * 0.24); if (dash) ctx.setLineDash([s * 0.6, s * 0.5]); ctx.beginPath(); ctx.arc(V.X(p[0]), V.Y(p[1]), s * r, 0, Math.PI * 2); ctx.stroke(); if (lab) { ctx.setLineDash([]); ctx.font = `800 ${Math.max(9, s * 0.95)}px Inter, sans-serif`; const w = ctx.measureText(lab).width + s; ctx.fillStyle = col; roundRect(ctx, V.X(p[0]) - w / 2, V.Y(p[1]) - s * (r + 2), w, s * 1.5, s * 0.7); ctx.fill(); ctx.fillStyle = '#071022'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, V.X(p[0]), V.Y(p[1]) - s * (r + 1.25)); } ctx.restore(); };
  const f = DR.fb;
  if (f && (f.kind === 'spot' || f.kind === 'stance')) {
    const good = f.kind === 'spot' ? f.j.ok : true;
    ctx.save(); ctx.fillStyle = 'rgba(47,214,138,.14)'; ctx.beginPath(); ctx.arc(V.X(f.ideal[0]), V.Y(f.ideal[1]), s * (f.tol || 2), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ring(f.ideal, 'rgba(47,214,138,.95)', f.tol || 2, 'RIGHT SPOT', true);
    if (dist(f.at, f.ideal) > 0.6) { ctx.save(); ctx.strokeStyle = good ? 'rgba(47,214,138,.7)' : 'rgba(255,90,110,.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(V.X(f.at[0]), V.Y(f.at[1])); ctx.lineTo(V.X(f.ideal[0]), V.Y(f.ideal[1])); ctx.stroke(); ctx.restore(); }
    // ball-you-man triangle from the right spot
    const sd2 = DR.q?.sit; if (f.kind === 'spot' && sd2 && !sd2.trans) { const man = sd2.pos[sd2.assign[DR.q.you]], bp = sd2.pos[sd2.ball]; if (man && bp && sd2.assign[DR.q.you] !== sd2.ball) { ctx.save(); ctx.strokeStyle = 'rgba(155,123,255,.7)'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(V.X(bp[0]), V.Y(bp[1])); ctx.lineTo(V.X(f.ideal[0]), V.Y(f.ideal[1])); ctx.lineTo(V.X(man[0]), V.Y(man[1])); ctx.stroke(); ctx.restore(); } }
  }
  if (f && f.kind === 'react' && f.ideal) ring(f.ideal, 'rgba(47,214,138,.95)', 2, 'CUT-OFF SPOT', true);
  if (f && (f.kind === 'tapD' || f.kind === 'tapO')) {
    const st = frameState();
    if (f.pick && st.pos[f.pick] && !f.ok) ring(st.pos[f.pick], 'rgba(255,90,110,.95)', 2.4, 'YOUR PICK');
    if (st.pos[f.answer]) ring(st.pos[f.answer], 'rgba(47,214,138,.95)', 2.6, f.ok ? 'CORRECT' : 'ANSWER');
  }
  if (DR.st === 'ask' && DR.q && ['spot', 'stance'].includes(DR.q.kind) && DR.at) ring(DR.at, 'rgba(80,220,140,.6)', 1.9, null, true);
}

// ---------- run view ----------
function renderDRun(el) {
  if (!$('#dr-court') || !el.querySelector('.dr-run')) {
    el.innerHTML = `<div class="dr-run"><div class="play-head"><button type="button" class="btn ghost sm" id="dr-back">‹ Defense</button><div class="ph-title"><span class="eyebrow purple" id="dr-eyebrow"></span><h2 id="dr-title"></h2></div></div>
      <div class="play-grid"><div class="stage-col"><div class="stage pickable" id="dr-stage"><canvas id="dr-court" role="img" aria-label="Defensive situation on a half court"></canvas>
        <div class="hud"><div class="hud-mode" data-m="film" id="dr-hud"></div><div class="hud-prompt" id="dr-prompt" hidden></div><div class="dr-timer" id="dr-timer" hidden><i></i></div></div><div class="dr-act" id="dr-act" hidden></div></div>
        <div class="dr-legend small muted"><span><i class="lg-dot you"></i> you</span><span><i class="lg-dot man"></i> your man</span><span><i class="lg-dot good"></i> right spot (after you answer)</span></div>
      </div><aside class="panel" id="dr-panel" aria-live="polite"></aside></div></div>`;
    DR.view = new CourtView($('#dr-court'));
    $('#dr-back').onclick = () => { stopDR(); DC.run = null; DC.sub = 'home'; renderDefense(); };
    const cv = $('#dr-court'); let drag = false;
    const ptOf = (e) => { const r = cv.getBoundingClientRect(); const p = DR.view.toCourt(e.clientX - r.left, e.clientY - r.top); return [clamp(p[0], -25, 25), clamp(p[1], 0.5, 46)]; };
    cv.addEventListener('pointerdown', (e) => {
      const p = ptOf(e), q = DR.q;
      if (DR.st === 'ask' && (q.kind === 'spot' || q.kind === 'stance')) { drag = true; cv.setPointerCapture?.(e.pointerId); DR.at = RR(p); return; }
      if (DR.st === 'ask' && (q.kind === 'tapD' || q.kind === 'tapO')) {
        const st = frameState(), ids = q.kind === 'tapD' ? DEF : OFF; let best = null, bd = 4.2;
        for (const id of ids) { if (!st.pos[id]) continue; const d = dist(st.pos[id], p); if (d < bd) { bd = d; best = id; } }
        if (best) answerQ(best); else toast(q.kind === 'tapD' ? 'Tap a defender (dark jerseys).' : 'Tap an offensive player (blue jerseys).');
        return;
      }
      if (DR.st === 'ask' && q.kind === 'react') {
        const st = frameState(); const kind = dist(st.pos.O1, p) < 2.6 ? 'contest' : dist(st.pos.D1, p) < 2.6 ? 'hold' : 'cutoff';
        return answerQ({ kind, at: RR(p) });
      }
      if (['feedback', 'revealed', 'noreveal'].includes(DR.st) && e.pointerType !== 'mouse') return continueD();
    });
    cv.addEventListener('pointermove', (e) => { if (drag && DR.st === 'ask') DR.at = RR(ptOf(e)); });
    const up = () => { if (drag) { drag = false; renderDRunPanel(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', () => { if (['feedback', 'revealed'].includes(DR.st)) continueD(); });
  }
  renderDRunPanel(); loopD();
}
function renderDRunPanel() {
  const P = $('#dr-panel'); if (!P) return;
  const run = DC.run, it = DR.item, q = DR.q, st = DR.st;
  $('#dr-eyebrow').textContent = `${run.title || DMODS[run.mod]?.name || ''} · ${DLEVELS[it.lvl] ?? ''}${run.n ? ` · rep ${Math.min(run.i + 1, run.n)} of ${run.n}` : ` · rep ${run.i + 1}`}`;
  $('#dr-title').textContent = it.title;
  $('#dr-hud').textContent = st === 'ask' ? 'YOUR READ' : st === 'play' || st === 'reveal' ? 'LIVE' : st === 'whatif' ? 'WHAT IF' : 'FROZEN';
  const pr = $('#dr-prompt'); pr.hidden = st !== 'ask'; if (st === 'ask') pr.textContent = q.kind === 'tapD' ? 'Tap a defender' : q.kind === 'tapO' ? 'Tap an offensive player' : q.kind === 'spot' ? 'Drag yourself into position' : q.kind === 'stance' ? 'Drag to set your stance' : q.kind === 'react' ? 'React!' : 'Choose';
  $('#dr-timer').hidden = !(st === 'ask' && q.tlim);
  if (st !== 'ask') $('#dr-act').hidden = true;
  if (st === 'play') { P.innerHTML = `<div class="decide-head"><span class="eyebrow">Watch</span><h3>${esc(it.title)}</h3></div><p class="brief">${esc(it.brief || '')}</p><p class="hint">The play will freeze before the defense reacts.</p>`; return; }
  if (st === 'ask') {
    let body = '';
    if (q.kind === 'spot') body = `<p class="brief">${esc(it.mod === 'position' || it.mod === 'team' ? it.brief : '')}</p><p><b>${esc(q.prompt)}</b></p><p class="small muted">You: green ring (X${q.you[1]}). Your man: yellow ring. Tap or drag on the court.</p><div class="opts intents">${Object.entries(INTENTS).filter(([k]) => k !== 'switch' || q.sit.screen).map(([k, t]) => `<button type="button" class="opt" data-int="${k}"><span><b>${t}</b><small>${{ attached: 'guard him / the ball', deny: 'take away the catch', gap: 'one pass away, stunt', help: 'two away, protect the rim', switch: 'swap assignments' }[k]}</small></span></button>`).join('')}</div><p class="hint">Picking your job locks in your spot.</p>`;
    else if (q.kind === 'stance') body = `<p class="brief">${esc(it.brief)}</p><p><b>${esc(q.prompt)}</b></p><p class="small muted">Distance and angle matter. Different attackers punish different mistakes.</p><div class="row"><button type="button" class="btn green" id="dr-set">Set</button></div>`;
    else if (q.kind === 'react') body = `<p><b>${esc(q.prompt)}</b></p>`;
    else if (q.kind === 'chips') body = `<p><b>${esc(q.prompt)}</b></p><div class="opts">${q.choices.map((c, i) => `<button type="button" class="opt" data-ch="${esc(c.k)}"><span class="k">${i + 1}</span><span><b>${esc(c.t)}</b></span></button>`).join('')}</div>`;
    else body = `<p><b>${esc(q.prompt)}</b></p><p class="small muted">Tap ${q.kind === 'tapD' ? 'a defender (dark jersey, X)' : 'an offensive player (blue jersey)'} on the court.</p>`;
    P.innerHTML = `<div class="decide-head"><span class="eyebrow purple">${q.tlim ? `${(q.tlim / 1000).toFixed(0)}-second read` : 'Your read'} · ${DCATS[q.cat] || DCATS[DMODS[it.mod].cat]}</span></div>${body}`;
    // the same answers as a bar on the court, so on a phone you never leave the court to answer
    const act = $('#dr-act');
    act.innerHTML = q.kind === 'spot' ? Object.entries(INTENTS).filter(([k]) => k !== 'switch' || q.sit.screen).map(([k, t]) => `<button type="button" data-int="${k}">${t}</button>`).join('')
      : q.kind === 'stance' ? '<button type="button" class="go" data-set="1">Set</button>'
      : q.kind === 'chips' ? q.choices.map((c) => `<button type="button" data-ch="${esc(c.k)}">${esc(c.t)}</button>`).join('') : '';
    act.hidden = !act.innerHTML; if (!act.hidden) pr.hidden = true;
    const root = $('.dr-run');
    for (const b of $$('[data-int]', root)) b.onclick = () => { DR.intent = b.dataset.int; answerQ({ at: DR.at, intent: DR.intent }); };
    for (const b of $$('[data-ch]', root)) b.onclick = () => answerQ(b.dataset.ch);
    for (const b of [$('#dr-set'), $('[data-set]', act)].filter(Boolean)) b.onclick = () => answerQ({ at: DR.at });
    return;
  }
  if (st === 'answered') { P.innerHTML = `<p class="brief">Stance set. Watch him…</p>`; return; }
  if (st === 'whatif') { P.innerHTML = `<div class="decide-head"><span class="eyebrow">What your spot gives up</span></div><p class="brief">${esc(DR.fb?.j?.mistakes[0]?.opp || '')}</p>`; return; }
  if (st === 'feedback') {
    const x = DR.qres.at(-1), r = x.res;
    let body = '';
    if (r.kind === 'spot') {
      const j = r.j, c = j.ctx;
      body = `<div class="score-row"><div class="score-ring ${r.ok ? 'band-good' : 'band-bad'}"><div class="n"><b>${r.score}</b><small>${r.ok ? 'correct' : 'off'}</small></div></div><div><h3>${esc(j.jobName)}</h3><p class="small muted">You were ${j.e} ft from the right spot (allowed: ${j.tol} ft)${j.intentOk === false ? ` · job: you picked “${INTENTS[DR.intent]}”, it's “${INTENTS[j.want]}”` : j.intentOk ? ' · right job' : ''}${r.late ? ' · too slow' : ''}</p></div></div>
        <div class="bd best"><h4>1 · Where you should be</h4><p class="small">The green ring. ${esc(JOBS[j.job].why(c))}</p></div>
        <div class="bd def"><h4>2 · The threat to recognize</h4><p class="small">${esc(JOBS[j.job].threat(c))}</p></div>
        ${j.mistakes.length ? `<p class="small" style="margin:8px 0 4px"><b>3 · What your spot gave up</b></p>` + j.mistakes.map((m) => mistakeCard(m)).join('') : `<div class="bd good"><h4>3 · If you'd stood somewhere else</h4><p class="small">${esc(whatElse(j))}</p></div>`}
        <div class="bd"><h4>4 · Your next responsibility</h4><p class="small">${esc(JOBS[j.job].next(c))}</p></div>
        ${j.mistakes.length && whatIfBeats(DR.q.sit, DR.q.you, DR.fb.at, j.mistakes[0].code).length ? '<button type="button" class="btn ghost sm" id="dr-whatif">▶ Show what your spot gives up</button>' : ''}`;
    } else if (r.kind === 'react') {
      body = `<div class="score-row"><div class="score-ring ${r.ok ? 'band-good' : 'band-bad'}"><div class="n"><b>${r.score}</b><small>defense</small></div></div><div><h3>${r.ok ? 'Good defense' : 'He got you'}</h3><p class="small muted">Stance ${r.stc.score} · reaction ${r.re.score}${r.late ? ' · too slow' : ''} · ${(r.ms / 1000).toFixed(2)}s</p></div></div><p class="small">${esc(r.re.note)}</p>${r.mistakes.map((m) => mistakeCard(m)).join('')}`;
    } else {
      body = `<div class="outcome ${r.ok ? 'quad-gg' : ''}"><div class="o-big">${r.ok ? '✓ Correct' : r.late ? '⏱ Too slow' : '✗ Not quite'}</div><p class="small">${esc(q.why || '')}</p></div>${r.mistakes.map((m) => mistakeCard(m)).join('')}`;
    }
    const more = DR.qi + 1 < DR.item.phases[DR.ph].qs.length;
    P.innerHTML = `${body}<div class="row" style="margin-top:12px"><button type="button" class="btn" id="dr-next">${more ? 'Next question' : 'Show the defense'} ›</button></div><p class="hint">Or tap the court (double-click on desktop).</p>`;
    $('#dr-next').onclick = continueD; $('#dr-whatif') && ($('#dr-whatif').onclick = showWhatIf);
    return;
  }
  if (st === 'reveal' || st === 'revealed') {
    P.innerHTML = `<div class="decide-head"><span class="eyebrow green">The right defense</span><h3>${esc(DR.revealTitle || '')}</h3></div>${(DR.revealLines || []).map((l) => `<p class="small reveal-line">${l}</p>`).join('')}${st === 'revealed' ? `<div class="row" style="margin-top:12px"><button type="button" class="btn" id="dr-next">Continue ›</button><button type="button" class="btn ghost sm" id="dr-replay">${icon('restart')} Replay</button></div>` : ''}`;
    $('#dr-next') && ($('#dr-next').onclick = continueD);
    $('#dr-replay') && ($('#dr-replay').onclick = () => { DR.t = Math.max(0, DR.tEnd - 3); DR.target = DR.tEnd; DR.playing = true; DR.st = 'reveal'; loopD(); renderDRunPanel(); });
    for (const a of $$('[data-go-ts]', P)) a.onclick = (e) => { e.preventDefault(); TSIM.cov = a.dataset.goTs; TSIM.mode = 'practice'; TSIM.phase = 'setup'; TSIM.S = null; DC.run = null; go('teamsim'); };
    return;
  }
  if (st === 'itemdone') {
    const R = run.results.at(-1), last = run.n && run.i + 1 >= run.n;
    P.innerHTML = `<div class="decide-head"><span class="eyebrow green">Rep complete</span><h3>${esc(it.title)}</h3></div>
      <div class="score-row"><div class="score-ring ${R.score >= 70 ? 'band-good' : 'band-bad'}"><div class="n"><b>${R.score}</b><small>${R.right}/${R.total}</small></div></div><div><p class="small">${R.right === R.total ? 'Every read correct.' : `${R.total - R.right} read${R.total - R.right > 1 ? 's' : ''} to fix.`}</p></div></div>
      ${R.mistakes.length ? `<p class="small muted">Saved to your Mistakes tab: ${[...new Set(R.mistakes.map((m) => m.name))].join(', ')}.</p>` : ''}
      <div class="row" style="margin-top:12px"><button type="button" class="btn green" id="dr-more">${last ? 'See results' : 'Next rep'} ›</button><button type="button" class="btn ghost" id="dr-stop">Done</button></div>`;
    $('#dr-more').onclick = () => nextDItem();
    $('#dr-stop').onclick = () => (run.n ? finishDSession() : (() => { stopDR(); DC.run = null; DC.sub = DC.mod ? 'setup' : 'home'; renderDefense(); })());
    return;
  }
  if (st === 'sessiondone') {
    const d = run.done;
    P.innerHTML = `<div class="decide-head"><span class="eyebrow green">${run.daily ? 'Daily challenge complete' : run.chal ? 'Challenge complete' : 'Session complete'}</span><h3>${d.score} · ${d.right}/${d.total} correct</h3></div>
      ${run.results.map((x) => `<div class="part"><span>${esc(x.title)}</span><span class="bar"><i style="width:${x.score}%;background:${x.score >= 70 ? 'var(--green)' : 'var(--amber)'}"></i></span><b>${x.score}</b></div>`).join('')}
      <div class="row" style="margin-top:12px"><button type="button" class="btn" id="dr-home">Back to the Defense Center</button></div>`;
    $('#dr-home').onclick = () => { stopDR(); DC.run = null; DC.sub = 'home'; renderDefense(); };
  }
}
function mistakeCard(m) { return `<div class="bd miss"><h4>${esc(m.name)}</h4><p class="small"><b>What you did:</b> ${esc(m.wrong)}</p><p class="small"><b>What to do:</b> ${esc(m.should)}</p><p class="small"><b>Why it matters:</b> ${esc(m.why)}</p><p class="small"><b>What it gives the offense:</b> ${esc(m.opp)}</p><p class="small"><b>Next time:</b> ${esc(m.fix)}</p></div>`; }
function whatElse(j) {
  const k = j.job;
  if (['help', 'nail', 'low', 'helpDrive', 'rotate', 'tag', 'fill'].includes(k)) return 'Closer to your man, you wouldn\'t get to the drive or the roll in time. Deeper than this, you couldn\'t close out on a skip pass.';
  if (['deny', 'gap', 'stayHome', 'stunt'].includes(k)) return 'Farther off, he catches and shoots in rhythm. Tighter or higher, he back-cuts or the driver goes through your gap untouched.';
  if (['ball', 'contain', 'closeout'].includes(k)) return 'Farther away, he shoots over you. Closer or square, his first step goes by you. Off the line to the rim, he drives straight at the basket.';
  return 'A step off this spot and the coverage leaks: either the ball handler or the screener gets a clean look.';
}
