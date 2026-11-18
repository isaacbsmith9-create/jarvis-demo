// ===================== sections =====================
const results = () => doc('results').list;
const prog = () => doc('progress');

// ---------- thumbnails: the decision frame of a scenario, drawn once and cached ----------
const THUMBS = {};
let thumbView = null;
function thumb(sid, flip = false) {
  const k = sid + (flip ? ':f' : '');
  if (THUMBS[k]) return THUMBS[k];
  if (!thumbView) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-2000px;top:0;width:420px;pointer-events:none;opacity:0';
    const c = document.createElement('canvas'); holder.appendChild(c); document.body.appendChild(holder);
    thumbView = new CourtView(c);
  }
  const sc = getScenario(sid, flip), tr = preTrack(sc);
  thumbView.draw(tr, tr.setupEnd, { captions: false, spotlight: false });
  THUMBS[k] = thumbView.c.toDataURL('image/jpeg', 0.82);
  return THUMBS[k];
}
function fillThumbs(root) {
  const imgs = $$('img[data-thumb]', root);
  let i = 0;
  const step = () => { const img = imgs[i++]; if (!img) return; if (img.isConnected) img.src = thumb(img.dataset.thumb); setTimeout(step, 0); };
  step();
}
const diffHtml = (d) => `<span class="diff" title="Difficulty ${d} of 3">${[1, 2, 3].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>`;
const bandChip = (s) => { const b = scoreBand(s); return `<span class="chip ${b.k === 'elite' ? 'green' : b.k === 'good' ? '' : b.k === 'ok' ? 'amber' : 'red'}">${s}</span>`; };

function scenCard(sc) {
  const p = prog().scen[sc.id];
  return `<button type="button" class="card scen" data-play="${sc.id}" id="sc-${sc.id}">
    <div class="thumb"><img data-thumb="${sc.id}" alt="" width="420" height="393">${p ? `<span class="best">${bandChip(p.best)}</span>` : ''}</div>
    <div class="body"><div class="meta"><span class="chip ${sc.cat === 'pnr' ? '' : 'purple'}">${esc(sc.coverage)}</span>${diffHtml(sc.diff)}</div>
    <h3>${esc(sc.title)}</h3><p>${esc(sc.brief)}</p>
    <div class="meta small muted">${p ? `Best ${p.best} · ${p.plays} play${p.plays > 1 ? 's' : ''}` : 'Not played yet'}</div></div></button>`;
}
function bindPlay(root, from) { for (const b of $$('[data-play]', root)) b.onclick = () => openPlay(b.dataset.play, { from }); }

// ---------- IQ math ----------
function iqStats() {
  const R = results();
  const recent = R.slice(-20);
  const rating = recent.length ? Math.round(mean(recent.map((r) => r.score))) : null;
  const level = rating == null ? '' : rating >= 90 ? 'Elite' : rating >= 80 ? 'Floor general' : rating >= 70 ? 'Starter' : rating >= 55 ? 'Rotation player' : 'Developing';
  const live = R.filter((r) => r.mode === 'live' && r.opt !== 'timeout' && r.rt != null);
  const rt = live.length ? mean(live.slice(-20).map((r) => r.rt)) / 1000 : null;
  const played = new Set(R.map((r) => r.sid)).size;
  const today = isoDate(); const d = prog().daily[today];
  return { rating, level, rt, played, total: R.length, daily: d ? Object.keys(d.scores).length : 0 };
}
function topicMastery(topic) {
  const R = results().filter((r) => (SC[r.sid]?.topic || r.topic) === topic).slice(-5);
  return R.length ? Math.round(mean(R.map((r) => r.score))) : null;
}
function recommend() {
  const pg = prog().scen;
  const unplayed = SCENARIOS.filter((s) => !pg[s.id]).sort((a, b) => a.diff - b.diff);
  if (unplayed.length) return { sc: unplayed[0], why: 'Next new read' };
  const weakest = [...SCENARIOS].sort((a, b) => (pg[a.id].best - pg[b.id].best) || (pg[a.id].ts - pg[b.id].ts))[0];
  return { sc: weakest, why: pg[weakest.id].best >= 90 ? 'Keep it sharp' : 'Your weakest read' };
}

// ---------- Home ----------
const HOME = { view: null, raf: 0, t: 0, track: null, fx: [], i: 0, last: 0, hold: 0 };
function renderHome() {
  const s = iqStats(), rec = recommend(), dIds = dailyIds();
  $('#view-home').innerHTML = `
    <div class="hero">
      <div class="hero-copy">
        <span class="eyebrow">Basketball IQ Lab · point guard edition</span>
        <h1>Read the floor.<br><em>Make the play.</em></h1>
        <p>Live possessions with real coverages: drop, switch, blitz, hedge, ice. Decide in real time, then get graded on the read, not on whether the shot fell.</p>
        <div class="row"><button type="button" class="btn green" id="h-play">${icon('play')} Play a possession</button><button type="button" class="btn ghost" id="h-daily">${icon('bolt')} Daily Three ${s.daily}/3</button></div>
      </div>
      <div class="hero-court"><canvas id="home-court" aria-label="Animated possession: best read demo" role="img"></canvas><span class="hero-tag" id="home-tag">BEST READ</span></div>
    </div>
    <div class="card stats">
      <div class="stat"><span>IQ rating</span><b>${s.rating ?? '—'}</b><small>${s.rating == null ? 'Play to get rated' : s.level}</small></div>
      <div class="stat"><span>Possessions</span><b>${s.total}</b><small>${s.played} of ${SCENARIOS.length} reads seen</small></div>
      <div class="stat"><span>Decision speed</span><b>${s.rt == null ? '—' : s.rt.toFixed(1) + 's'}</b><small>Average in live mode</small></div>
      <div class="stat"><span>Gauntlet best</span><b>${prog().best.gauntlet || 0}</b><small>Possessions in a row ≥70</small></div>
    </div>
    <div class="card next-card">
      <img data-thumb="${rec.sc.id}" alt="" width="420" height="393">
      <div class="copy"><span class="eyebrow purple">${rec.why}</span><h3>${esc(rec.sc.title)}</h3><p class="muted">${esc(rec.sc.brief)}</p>
        <div class="row"><span class="chip">${esc(rec.sc.coverage)}</span>${diffHtml(rec.sc.diff)}</div>
        <div class="row"><button type="button" class="btn" data-play="${rec.sc.id}">Play it</button></div></div>
    </div>
    <div class="section-title"><h2>Train</h2></div>
    <div class="grid">
      ${secLink('sim', 'sim', 'Possession Simulator', `${SCENARIOS.length} playable possessions, live or on film.`)}
      ${secLink('pnr', 'learn', 'Pick-and-Roll Academy', 'Drop, switch, blitz, hedge, ice, snake, low man, pocket and skip.', 'purple')}
      ${secLink('iq', 'iq', 'Basketball IQ Academy', 'Transition, closeouts, mismatches, late clock.', 'purple')}
      ${secLink('film', 'film', 'Film Room', results().length ? `${results().length} possessions saved for replay.` : 'Every possession you play is saved here.')}
      ${secLink('challenges', 'trophy', 'Challenges', `Daily Three (${s.daily}/3 today), coverage quiz, shot-clock gauntlet.`, 'green')}
      ${secLink('me', 'chart', 'My IQ', 'Rating, mastery by read, reaction time, decision vs. outcome.', 'green')}
    </div>`;
  $('#h-play').onclick = () => openPlay(rec.sc.id, { from: 'home' });
  $('#h-daily').onclick = () => startDaily(dIds);
  bindPlay($('#view-home'), 'home');
  for (const b of $$('[data-go]', $('#view-home'))) b.onclick = () => go(b.dataset.go);
  fillThumbs($('#view-home'));
  HOME.view = new CourtView($('#home-court'));
  HOME.track = null; startHomeLoop();
}
const secLink = (to, ic, title, txt, tone = '') => `<button type="button" class="card sec-link" data-go="${to}"><span class="ic ${tone}">${icon(ic)}</span><span><h3>${title}</h3><p>${txt}</p></span></button>`;
function nextHomeClip() {
  const sc = SCENARIOS[HOME.i++ % SCENARIOS.length], best = bestOption(sc);
  const e = evaluate(sc.id, { opt: best.id, f: 0, seed: 7, flip: HOME.i % 2 === 0, mode: 'film', forceMake: true });
  HOME.track = e.poss.track; HOME.fx = e.poss.fx; HOME.t = 0; HOME.hold = 0;
  const tag = $('#home-tag'); if (tag) tag.textContent = `BEST READ · ${sc.coverage.toUpperCase()}`;
}
function startHomeLoop() {
  cancelAnimationFrame(HOME.raf);
  HOME.last = performance.now();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = (now) => {
    if ($('#view-home').hidden || !$('#home-court')) return;
    const dt = Math.min(0.05, (now - HOME.last) / 1000); HOME.last = now;
    if (!HOME.track) nextHomeClip();
    if (HOME.t < HOME.track.t1) HOME.t = Math.min(HOME.track.t1, HOME.t + dt); else if ((HOME.hold += dt) > 1.4) nextHomeClip();
    HOME.view.draw(HOME.track, reduce ? HOME.track.t1 : HOME.t, { fx: HOME.fx });
    HOME.raf = requestAnimationFrame(step);
  };
  HOME.raf = requestAnimationFrame(step);
}

// ---------- Simulator picker ----------
let simFilter = 'all';
function renderSim() {
  const cats = [['all', 'All'], ['pnr', 'Pick-and-roll'], ['iq', 'IQ situations'], ['new', 'Not played']];
  const list = SCENARIOS.filter((s) => simFilter === 'all' || s.cat === simFilter || (simFilter === 'new' && !prog().scen[s.id]));
  $('#view-sim').innerHTML = `
    <div class="page-head"><span class="eyebrow">Possession Simulator</span><h1>Pick a possession</h1><p>Each one is a real read with a decision window. Play it live to train speed, or on film to study the floor first.</p></div>
    <div class="filters" role="group" aria-label="Filter">${cats.map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${simFilter === k}">${t}</button>`).join('')}</div>
    ${list.length ? `<div class="grid">${list.map(scenCard).join('')}</div>` : emptyState('court', 'You\'ve played every read', 'Switch the filter to All and chase a higher score, or try the Shot-Clock Gauntlet.')}`;
  for (const b of $$('[data-f]', $('#view-sim'))) b.onclick = () => { simFilter = b.dataset.f; renderSim(); };
  bindPlay($('#view-sim'), 'sim'); fillThumbs($('#view-sim'));
}
function emptyState(ic, title, txt, btn) {
  return `<div class="empty">${emptyArt(ic)}<h3>${title}</h3><p>${txt}</p>${btn || ''}</div>`;
}
// Small court diagram used in empty states.
function emptyArt() {
  return `<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="6" y="6" width="68" height="68" rx="3" opacity=".5"/><path d="M28 6v24h24V6" opacity=".7"/><path d="M14 6v14a26 26 0 0 0 52 0V6" opacity=".5"/><circle cx="40" cy="12" r="2.4"/><circle cx="40" cy="56" r="4.5" fill="currentColor" opacity=".25"/><path d="M40 52l-9-14M40 52l10-12" stroke-dasharray="3 3"/><circle cx="31" cy="36" r="3.5"/><circle cx="51" cy="38" r="3.5"/></svg>`;
}

// ---------- Academies ----------
function renderAcademy(which) {
  const el = $('#view-' + which), lessons = LESSONS[which];
  el.innerHTML = `
    <div class="seg" role="group" aria-label="Academy"><button type="button" data-ac="pnr" aria-pressed="${which === 'pnr'}">Pick-and-Roll Academy</button><button type="button" data-ac="iq" aria-pressed="${which === 'iq'}">Basketball IQ Academy</button></div>
    <div class="page-head"><span class="eyebrow purple">${which === 'pnr' ? 'Pick-and-Roll Academy' : 'Basketball IQ Academy'}</span>
      <h1>${which === 'pnr' ? 'Beat every coverage' : 'Win the moments between plays'}</h1>
      <p>${which === 'pnr' ? 'Every defense has a tell. Learn what each coverage looks like from the ball handler\'s eyes, how to beat it, then prove it in a live possession.' : 'Transition, closeouts, mismatches and the shot clock decide more possessions than set plays. Learn the cue, then play it.'}</p></div>
    <div class="lessons">${lessons.map((l) => {
      const m = topicMastery(l.id) ?? (l.scen.map((id) => prog().scen[id]?.best).filter((x) => x != null).length ? Math.round(mean(l.scen.map((id) => prog().scen[id]?.best ?? 0))) : null);
      return `<article class="card lesson" id="lesson-${l.id}"><img data-thumb="${l.scen[0]}" alt="Decision frame: ${esc(SC[l.scen[0]].title)}" width="420" height="393">
        <div class="copy"><div class="row"><span class="chip ${which === 'pnr' ? '' : 'purple'}">${esc(l.tag)}</span></div><h3>${esc(l.title)}</h3>
          <dl><div><dt>What it looks like</dt><dd>${esc(l.look)}</dd></div><div><dt>How to beat it</dt><dd>${esc(l.beat)}</dd></div></dl>
          <div class="mastery">Mastery <span class="bar"><i style="width:${m ?? 0}%"></i></span>${m == null ? 'Not started' : m + ' / 100'}</div>
          <div class="scen-mini">${l.scen.map((id) => { const p = prog().scen[id]; return `<button type="button" data-play="${id}">${icon('play')} ${esc(SC[id].title)}${p ? ' · ' + p.best : ''}</button>`; }).join('')}</div></div></article>`;
    }).join('')}</div>`;
  for (const b of $$('[data-ac]', el)) b.onclick = () => go(b.dataset.ac);
  bindPlay(el, which); fillThumbs(el);
}

// ---------- Film Room ----------
let filmFilter = 'all';
function renderFilm() {
  const R = [...results()].reverse();
  const fl = { all: () => true, star: (r) => r.star, good: (r) => r.score >= 75, bad: (r) => r.score < 75, lucky: (r) => r.score < 75 && r.result === 'make', unlucky: (r) => r.score >= 75 && r.result !== 'make' && r.result !== 'none' }[filmFilter];
  const list = R.filter(fl).slice(0, 80);
  const tabs = [['all', 'All'], ['star', 'Starred'], ['good', 'Good reads'], ['bad', 'Wrong reads'], ['unlucky', 'Right read, no bucket'], ['lucky', 'Lucky makes']];
  $('#view-film').innerHTML = `
    <div class="page-head"><span class="eyebrow">Film Room</span><h1>Your possessions on tape</h1><p>Every possession is saved and replays exactly: same movement, same decision, same result. Open one to scrub it, turn on overlays and compare it with the best read.</p></div>
    ${R.length ? `<div class="filters" role="group" aria-label="Filter">${tabs.map(([k, t]) => `<button type="button" data-ff="${k}" aria-pressed="${filmFilter === k}">${t}</button>`).join('')}</div>` : ''}
    ${!R.length ? emptyState('film', 'No film yet', 'Play a possession and it lands here automatically, ready to replay with passing lanes, help defense and spacing overlays.', '<button type="button" class="btn" data-go="sim">Play your first possession</button>')
      : list.length ? `<div class="film-list">${list.map(filmRow).join('')}</div>` : emptyState('film', 'Nothing in this filter', filmFilter === 'star' ? 'Star a possession to keep it here for later study.' : 'Play more possessions to fill this view.')}`;
  for (const b of $$('[data-ff]', $('#view-film'))) b.onclick = () => { filmFilter = b.dataset.ff; renderFilm(); };
  for (const b of $$('[data-go]', $('#view-film'))) b.onclick = () => go(b.dataset.go);
  for (const row of $$('[data-rid]', $('#view-film'))) row.onclick = (e) => {
    const r = results().find((x) => x.id === row.dataset.rid); if (!r) return;
    if (e.target.closest('.star')) { e.stopPropagation(); r.star = !r.star; persist('results'); renderFilm(); return; }
    openReplay(r);
  };
}
function filmRow(r) {
  const sc = SC[r.sid], b = scoreBand(r.score), opt = sc && (r.opt === 'timeout' ? { label: 'Hesitated' } : sc.decision.options.find((o) => o.id === r.opt));
  const col = { elite: 'var(--green)', good: 'var(--blue-2)', ok: 'var(--amber)', bad: 'var(--red)' }[b.k];
  const oc = { make: 'green', miss: 'gray', tov: 'red', violation: 'red', none: '' }[r.result];
  return `<div class="film-row" role="button" tabindex="0" data-rid="${r.id}"><span class="sc" style="color:${col}">${r.score}</span>
    <span class="t"><b>${esc(sc?.title || r.sid)}</b><span>${esc(opt?.label || '')} · ${r.mode === 'live' ? 'Live' : 'Film'} · ${fmtDate(r.ts)}</span></span>
    <span class="r"><span class="chip ${oc}">${RESULT_TEXT[r.result]}${r.result === 'make' ? ' +' + r.pts : ''}</span><button type="button" class="star" aria-label="Star" aria-pressed="${!!r.star}">${icon('star')}</button></span></div>`;
}

// ---------- Challenges ----------
function dailyIds(date = isoDate()) {
  const r = rng(Number(date.replace(/-/g, '')) * 7919);
  const pool = SCENARIOS.map((s) => s.id), out = [];
  while (out.length < 3) { const i = Math.floor(r() * pool.length); out.push(pool.splice(i, 1)[0]); }
  return { ids: out, flips: out.map(() => r() < 0.5), date };
}
function startDaily(d = dailyIds()) {
  const done = prog().daily[d.date]?.scores || {};
  const i = Math.max(0, d.ids.findIndex((id) => done[id] == null));
  const q = { kind: 'daily', ids: d.ids, flips: d.flips, date: d.date, i: d.ids.every((id) => done[id] != null) ? 0 : i };
  openPlay(q.ids[q.i], { queue: q, flip: q.flips[q.i] });
}
function startGauntlet() {
  const q = { kind: 'gauntlet', streak: 0, recent: [] };
  const n = gauntletPick(q); openPlay(n.id, { queue: q, flip: n.flip });
}
function renderChallenges() {
  const d = dailyIds(), sc = prog().daily[d.date]?.scores || {}, doneN = d.ids.filter((id) => sc[id] != null).length;
  const avg = doneN ? Math.round(mean(d.ids.filter((id) => sc[id] != null).map((id) => sc[id]))) : null;
  const streak = dailyStreak();
  $('#view-challenges').innerHTML = `
    <div class="page-head"><span class="eyebrow green">Challenges</span><h1>Prove it under pressure</h1><p>All challenges run in Live mode. Scenarios may be mirrored to the other side of the floor, so you read the defense, not the memory.</p></div>
    <div class="grid">
      <div class="card ch-card"><span class="eyebrow green">Daily Three · ${fmtDate(Date.now())}</span><h3>Three reads, every day</h3>
        <div class="daily">${d.ids.map((id, i) => `<div class="daily-item"><span class="st ${sc[id] != null ? 'done' : ''}">${sc[id] != null ? '✓' : i + 1}</span><span>${sc[id] != null ? esc(SC[id].title) + ' · <b>' + sc[id] + '</b>' : 'Hidden until you play it'}</span></div>`).join('')}</div>
        <p class="small muted">${doneN === 3 ? `Done. Average ${avg}. New three tomorrow.` : `${doneN}/3 complete.`} ${streak ? `Streak: ${streak} day${streak > 1 ? 's' : ''}.` : ''}</p>
        <button type="button" class="btn green" id="ch-daily">${doneN === 3 ? 'Replay today\'s three' : doneN ? 'Continue' : 'Start Daily Three'}</button></div>
      <div class="card ch-card"><span class="eyebrow">Coverage ID quiz</span><h3>Name that coverage</h3>
        <p class="muted small">Watch a pick-and-roll develop with no captions, then name the coverage before the possession continues. 8 clips.</p>
        <div class="big">${prog().best.quiz != null ? prog().best.quiz + '<span class="muted small"> / 8 best</span>' : '<span class="muted small">No score yet</span>'}</div>
        <button type="button" class="btn" id="ch-quiz">Start quiz</button></div>
      <div class="card ch-card"><span class="eyebrow" style="color:var(--amber)">Shot-Clock Gauntlet</span><h3>Survive the streak</h3>
        <p class="muted small">Random possessions back to back. Score 70+ on your decision to stay alive. One bad read ends the run.</p>
        <div class="big">${prog().best.gauntlet || 0}<span class="muted small"> best streak</span></div>
        <button type="button" class="btn" id="ch-gauntlet">Start the gauntlet</button></div>
    </div>`;
  $('#ch-daily').onclick = () => startDaily(d);
  $('#ch-quiz').onclick = startQuiz;
  $('#ch-gauntlet').onclick = startGauntlet;
}
function dailyStreak() {
  const daily = prog().daily; let n = 0; const d = new Date();
  const full = (k) => { const x = daily[k]; return x && Object.keys(x.scores).length >= 3; };
  if (!full(isoDate(d))) d.setDate(d.getDate() - 1);
  while (full(isoDate(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- Coverage quiz ----------
const QZ = { view: null, items: [], i: 0, answers: [], t: 0, raf: 0, phase: 'play', track: null, last: 0 };
function startQuiz() {
  const pool = SCENARIOS.filter((s) => s.quiz && s.cat === 'pnr');
  const r = Math.random;
  const items = [];
  const bag = [...pool].sort(() => r() - 0.5);
  while (items.length < 8) items.push({ id: bag[items.length % bag.length].id, flip: r() < 0.5 });
  Object.assign(QZ, { items, i: 0, answers: [] });
  showView('quiz'); renderQuiz(); playQuizClip();
}
function renderQuiz() {
  const it = QZ.items[QZ.i], sc = getScenario(it.id, it.flip), a = QZ.answers[QZ.i];
  const done = QZ.i >= QZ.items.length;
  if (done) {
    const n = QZ.answers.filter((x) => x.right).length, pg = prog();
    const best = pg.best.quiz == null || n > pg.best.quiz; if (best) { pg.best.quiz = n; persist('progress'); }
    $('#view-quiz').innerHTML = `<div class="page-head"><span class="eyebrow">Coverage ID quiz</span><h1>${n} / ${QZ.items.length}</h1><p>${n >= 7 ? 'You see coverages early. That\'s the first step to beating them.' : n >= 5 ? 'Solid. Review the coverages you missed in the Pick-and-Roll Academy.' : 'Watch the big first: where he is when you come off the screen tells you the coverage.'}${best ? ' New personal best.' : ''}</p></div>
      <div class="quiz-progress">${QZ.answers.map((x) => `<i class="${x.right ? 'right' : 'wrong'}"></i>`).join('')}</div>
      <div class="row"><button type="button" class="btn" id="qz-again">Take it again</button><button type="button" class="btn ghost" id="qz-academy">Pick-and-Roll Academy</button><button type="button" class="btn ghost" id="qz-back">Challenges</button></div>`;
    $('#qz-again').onclick = startQuiz; $('#qz-academy').onclick = () => go('pnr'); $('#qz-back').onclick = () => go('challenges');
    return;
  }
  $('#view-quiz').innerHTML = `
    <div class="play-head"><button type="button" class="btn ghost sm" id="qz-quit">‹ Quit</button><div class="ph-title"><span class="eyebrow">Coverage ID quiz · clip ${QZ.i + 1} of ${QZ.items.length}</span><h2>What coverage is this?</h2></div></div>
    <div class="quiz-progress">${QZ.items.map((_, k) => `<i class="${k < QZ.i ? (QZ.answers[k].right ? 'right' : 'wrong') : k === QZ.i ? 'cur' : ''}"></i>`).join('')}</div>
    <div class="quiz-wrap">
      <div class="stage-col"><div class="stage"><canvas id="quiz-court" aria-label="Pick-and-roll clip" role="img"></canvas></div>
        <div class="row"><button type="button" class="btn ghost sm" id="qz-replay">${icon('restart')} Replay clip</button><span class="hint">Watch the screener's defender and your defender.</span></div></div>
      <div class="panel">
        <div class="quiz-choices">${QUIZ_CHOICES.map((c) => `<button type="button" data-q="${c}" class="${a ? (c === sc.quiz ? 'right' : c === a.pick ? 'wrong' : '') : ''}" ${a ? 'disabled' : ''}>${c}</button>`).join('')}</div>
        ${a ? `<div class="bd ${a.right ? 'good' : 'miss'}"><h4>${a.right ? 'Correct' : 'It was ' + esc(sc.quiz)}</h4><p>${esc(sc.defense)}</p></div>
          <button type="button" class="btn" id="qz-next">${QZ.i + 1 < QZ.items.length ? 'Next clip ›' : 'See score'}</button>` : '<p class="hint">Pick as soon as you recognize it.</p>'}
      </div></div>`;
  $('#qz-quit').onclick = () => go('challenges');
  $('#qz-replay').onclick = playQuizClip;
  for (const b of $$('[data-q]', $('#view-quiz'))) b.onclick = () => { QZ.answers[QZ.i] = { pick: b.dataset.q, right: b.dataset.q === sc.quiz }; renderQuiz(); };
  $('#qz-next') && ($('#qz-next').onclick = () => { QZ.i++; renderQuiz(); if (QZ.i < QZ.items.length) playQuizClip(); });
  QZ.view = new CourtView($('#quiz-court'));
  if (!QZ.track || QZ.trackFor !== QZ.i) playQuizClip(); else drawQuiz();
}
function playQuizClip() {
  const it = QZ.items[QZ.i]; if (!it) return;
  QZ.track = preTrack(getScenario(it.id, it.flip)); QZ.trackFor = QZ.i; QZ.t = 0; QZ.last = performance.now();
  cancelAnimationFrame(QZ.raf);
  const step = (now) => {
    if ($('#view-quiz').hidden || !$('#quiz-court')) return;
    QZ.t = Math.min(QZ.track.setupEnd, QZ.t + Math.min(0.05, (now - QZ.last) / 1000)); QZ.last = now;
    drawQuiz();
    if (QZ.t < QZ.track.setupEnd) QZ.raf = requestAnimationFrame(step);
  };
  QZ.raf = requestAnimationFrame(step);
}
function drawQuiz() { if (QZ.view && QZ.track) QZ.view.draw(QZ.track, QZ.t, { captions: false, overlays: QZ.answers[QZ.i] ? { links: true } : {} }); }

// ---------- My IQ ----------
let meConfirm = false;
function renderMe() {
  const R = results(), s = iqStats();
  if (!R.length) {
    $('#view-me').innerHTML = `<div class="page-head"><span class="eyebrow green">My IQ</span><h1>Your basketball IQ</h1></div>
      ${emptyState('chart', 'No possessions yet', 'Your IQ rating, mastery by read, reaction time and decision-vs-outcome matrix build from the possessions you play.', '<button type="button" class="btn" data-go="sim">Play a possession</button>')}`;
    for (const b of $$('[data-go]', $('#view-me'))) b.onclick = () => go(b.dataset.go);
    return;
  }
  const scored = R.filter((r) => r.result !== 'none');
  const m = { gg: 0, gb: 0, bg: 0, bb: 0 };
  for (const r of scored) { const g = r.score >= 75, ok = r.result === 'make'; m[(g ? 'g' : 'b') + (ok ? 'g' : 'b')]++; }
  const topics = Object.keys(TOPIC_NAMES).map((k) => ({ k, name: TOPIC_NAMES[k], v: topicMastery(k), n: R.filter((r) => (SC[r.sid]?.topic || r.topic) === k).length }));
  const live = R.filter((r) => r.mode === 'live' && r.rt != null && r.opt !== 'timeout');
  const fast = live.length ? Math.min(...live.map((r) => r.rt)) / 1000 : null;
  const timeouts = R.filter((r) => r.opt === 'timeout').length;
  const bestPct = Math.round(100 * R.filter((r) => r.best).length / R.length);
  $('#view-me').innerHTML = `
    <div class="page-head"><span class="eyebrow green">My IQ</span><h1>Your basketball IQ</h1><p>Built from the decision scores of your last 20 possessions. Outcomes are tracked separately: a good read that misses still counts as a good read.</p></div>
    <div class="card iq-hero">
      <div class="iq-rating"><b>${s.rating}</b><span>${s.level}</span></div>
      <div class="stats" style="min-width:0">
        <div class="stat"><span>Possessions</span><b>${R.length}</b><small>${s.played}/${SCENARIOS.length} reads seen</small></div>
        <div class="stat"><span>Best read found</span><b>${bestPct}%</b><small>Chose the top option</small></div>
        <div class="stat"><span>Avg decision</span><b>${s.rt == null ? '—' : s.rt.toFixed(2) + 's'}</b><small>${fast == null ? 'Play live to measure' : 'Fastest ' + fast.toFixed(2) + 's'}</small></div>
        <div class="stat"><span>Hesitations</span><b>${timeouts}</b><small>Window ran out</small></div>
      </div>
    </div>
    <div class="card"><div class="section-title"><h2>Decision score trend</h2><span class="muted small">Last ${Math.min(30, R.length)} possessions</span></div>${trendChart(R.slice(-30))}</div>
    <div class="two-col">
      <div class="card"><div class="section-title"><h2>Mastery by read</h2><span class="muted small">Avg of last 5</span></div>
        <div class="mastery-list" style="margin-top:12px">${topics.map((t) => `<div class="m-row"><span>${t.name}</span><span class="bar"><i style="width:${t.v ?? 0}%;background:${t.v == null ? 'transparent' : t.v >= 90 ? 'var(--green)' : t.v >= 75 ? 'var(--blue)' : t.v >= 55 ? 'var(--amber)' : 'var(--red)'}"></i></span><span>${t.v == null ? 'not played' : t.v + ' · ' + t.n}</span></div>`).join('')}</div></div>
      <div class="card"><div class="section-title"><h2>Decision vs. outcome</h2><span class="muted small">${scored.length} shots or turnovers</span></div>
        <div class="matrix" style="margin-top:12px">
          <span></span><span class="h">Made it</span><span class="h">Missed / turnover</span>
          <span class="h left">Good read (75+)</span><div class="c gg"><b>${m.gg}</b><span>Right read, rewarded</span></div><div class="c gb"><b>${m.gb}</b><span>Right read, unlucky. Keep doing it.</span></div>
          <span class="h left">Wrong read</span><div class="c bg"><b>${m.bg}</b><span>Lucky. Don't trust these.</span></div><div class="c bb"><b>${m.bb}</b><span>Wrong read, punished</span></div>
        </div>
        <p class="hint" style="margin-top:10px">The left column is what you control. Grow the top row.</p></div>
    </div>
    <div class="card"><div class="section-title"><h2>Reaction time</h2><span class="muted small">Live mode, seconds to decide</span></div>${rtChart(live.slice(-30))}</div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><h3 style="font-size:16px">Data</h3>
      <p class="muted small">Progress is saved on this device${doc('profile') && remoteReady() ? ' and synced to your Claude account' : ''}.</p>
      ${meConfirm ? `<div class="confirm"><b>Erase all possessions and progress?</b><p class="small muted">This removes your Film Room, IQ history, scores and challenge records. It can't be undone.</p><div class="row"><button type="button" class="btn sm" style="background:var(--red)" id="me-erase">Erase everything</button><button type="button" class="btn ghost sm" id="me-cancel">Cancel</button></div></div>` : '<div><button type="button" class="btn ghost sm" id="me-reset">Reset progress…</button></div>'}
    </div>`;
  $('#me-reset') && ($('#me-reset').onclick = () => { meConfirm = true; renderMe(); });
  $('#me-cancel') && ($('#me-cancel').onclick = () => { meConfirm = false; renderMe(); });
  $('#me-erase') && ($('#me-erase').onclick = () => { cache.results = BLANK.results(); cache.progress = BLANK.progress(); persist('results'); persist('progress'); meConfirm = false; toast('Progress erased'); renderMe(); });
}
const remoteReady = () => !!remote;
function trendChart(R) {
  const W = 640, H = 200, L = 30, Rr = 10, T = 12, B = 22, n = R.length;
  const x = (i) => L + (n <= 1 ? (W - L - Rr) / 2 : (i / (n - 1)) * (W - L - Rr)), y = (v) => T + (1 - v / 100) * (H - T - B);
  const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(130,160,255,${v === 75 ? '.35' : '.1'})" ${v === 75 ? 'stroke-dasharray="4 4"' : ''}/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  const pts = R.map((r, i) => [x(i), y(r.score)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = n > 1 ? `${line} L${pts[n - 1][0].toFixed(1)} ${y(0)} L${pts[0][0].toFixed(1)} ${y(0)} Z` : '';
  const dots = R.map((r, i) => `<circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="${i === n - 1 ? 5 : 3}" fill="${r.result === 'make' ? '#2fd68a' : r.result === 'none' ? '#79aeff' : '#0f1629'}" stroke="${scoreBand(r.score).k === 'bad' ? '#ff5a6e' : '#79aeff'}" stroke-width="2"><title>${esc(SC[r.sid]?.title || '')}: ${r.score} (${RESULT_TEXT[r.result]})</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Decision scores over time"><defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3d8bff" stop-opacity=".35"/><stop offset="1" stop-color="#3d8bff" stop-opacity="0"/></linearGradient></defs>${grid}<text x="${W - Rr}" y="${y(75) - 5}" text-anchor="end">good read</text>${area ? `<path d="${area}" fill="url(#tg)"/>` : ''}<path d="${line}" fill="none" stroke="#3d8bff" stroke-width="2.2" stroke-linejoin="round"/>${dots}</svg>
    <div class="row small muted" style="gap:14px;margin-top:6px"><span><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#2fd68a"/></svg> made</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="#0f1629" stroke="#79aeff" stroke-width="2"/></svg> missed / turnover</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#79aeff"/></svg> reset</span></div>`;
}
function rtChart(L) {
  if (!L.length) return '<p class="muted small" style="margin-top:10px">Play in Live mode to measure how fast you read the floor.</p>';
  const W = 640, H = 150, Lm = 30, T = 10, B = 20, n = L.length, max = Math.max(3, ...L.map((r) => r.rt / 1000));
  const bw = (W - Lm - 10) / n;
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const grid = [0, 1, 2, 3].filter((v) => v <= max).map((v) => `<line x1="${Lm}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(130,160,255,.1)"/><text x="${Lm - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}s</text>`).join('');
  const bars = L.map((r, i) => { const v = r.rt / 1000, h = y(0) - y(v); return `<rect x="${(Lm + i * bw + bw * 0.18).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${r.score >= 75 ? '#2fd68a' : '#ffc23d'}"><title>${v.toFixed(2)}s · score ${r.score}</title></rect>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Decision time per live possession">${grid}${bars}</svg><div class="row small muted" style="gap:14px;margin-top:6px"><span><svg width="10" height="10"><rect width="10" height="10" rx="2" fill="#2fd68a"/></svg> good read</span><span><svg width="10" height="10"><rect width="10" height="10" rx="2" fill="#ffc23d"/></svg> below 75</span></div>`;
}
