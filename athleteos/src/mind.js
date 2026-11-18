// ===================== MENTAL PERFORMANCE CENTER =====================
// Doc "aos-mind": checks {date: {confidence, focus, motivation, stress, energy, ready, note}}, journal [], sessions [].
const MIND_METRICS = [['confidence', 'Confidence', 'var(--accent)'], ['focus', 'Focus', '#22c3ee'], ['motivation', 'Motivation', 'var(--good)'], ['stress', 'Stress', 'var(--danger)'], ['energy', 'Energy', 'var(--warn)'], ['ready', 'Competitive readiness', 'var(--purple)']];
const mind = () => doc('aos-mind');
const mcheck = (d) => mind().checks?.[d] || null;
/** Mental readiness 0-100: the five positives plus inverted stress. Needs 3+ of the six. */
function mentalScore(d) {
  const c = mcheck(d); if (!c) return null;
  const v = MIND_METRICS.map(([k]) => (c[k] == null ? null : k === 'stress' ? 11 - c[k] : c[k])).filter((x) => x != null);
  return v.length >= 3 ? Math.round(((mean(v) - 1) / 9) * 100) : null;
}
RENDER.mind = (el, sub) => MIND[sub](el);
const MIND = {};

MIND.checkin = (el) => {
  const d = ui('mDay', todayIso()), c = mcheck(d) || {}, ms = mentalScore(d), prev7 = lastNDays(7, shiftIso(d, -1)).map(mcheck).filter(Boolean);
  const avg = (k) => { const v = prev7.map((x) => x[k]).filter((x) => x != null); return v.length ? mean(v) : null; };
  el.innerHTML = `<section class="card ai"><div class="card-head"><div><h3>Daily mental check-in</h3><span class="sub">60 seconds. Rate each from 1 to 10.</span></div><input type="date" id="m-day" value="${d}" max="${todayIso()}" style="width:150px" aria-label="Check-in date"></div>
    <div class="stack" id="m-form">${MIND_METRICS.map(([k, l, col]) => `<div><div class="row-between small"><b>${l}</b><span class="num" id="mv-${k}" style="color:${col};font-weight:700">${c[k] ?? '—'}</span></div><input type="range" min="1" max="10" step="1" data-mk="${k}" value="${c[k] ?? 5}" class="mslider ${c[k] == null ? 'unset' : ''}" style="--c:${col}" aria-label="${l}"><div class="row-between tiny muted"><span>${k === 'stress' ? 'Calm' : 'Low'}</span><span>${k === 'stress' ? 'Very stressed' : 'High'}</span></div></div>`).join('')}
      <label>Reflection (optional)<textarea id="m-note" maxlength="600" placeholder="What's on your mind? What would make today a win?">${esc(c.note || '')}</textarea></label>
      <div class="row"><button type="button" class="btn primary" id="m-save" style="flex:1">Save check-in</button>${mcheck(d) ? '<button type="button" class="btn danger" id="m-del">Delete</button>' : ''}</div></div></section>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Mental readiness</h3><span class="sub">${esc(fmtDL(d))}</span></div></div>
      <div class="row" style="gap:16px;flex-wrap:nowrap">${ring(ms ?? 0, 100, { size: 120, stroke: 11, color: ms == null ? 'var(--oth)' : ms >= 70 ? 'var(--good)' : ms >= 45 ? 'var(--warn)' : 'var(--danger)', color2: 'var(--purple)', center: `<b style="font-size:30px">${ms ?? '—'}</b><span class="tiny muted">/ 100</span>` })}<div class="stack" style="gap:4px;min-width:0"><span class="small">${ms == null ? 'Save a check-in to see your score.' : ms >= 70 ? 'Locked in. Trust your preparation.' : ms >= 45 ? 'Solid. Pick one focus cue for today.' : 'Tough day. Try a 5-minute reset below before you train.'}</span>${ms != null && ms < 55 ? '<button type="button" class="btn sm" data-go="mind-training">Mental reset exercises</button>' : ''}<span class="tiny muted">Average of the six ratings (stress counted in reverse).</span></div></div></section>
    <section class="card"><div class="card-head"><div><h3>Mental profile</h3><span class="sub">Solid = this check-in · dashed = previous 7-day average</span></div></div>${radar(MIND_METRICS.map(([k, l]) => ({ label: k === 'ready' ? 'Readiness' : l, v: c[k] == null ? null : (k === 'stress' ? 11 - c[k] : c[k]) * 10, v2: avg(k) == null ? null : (k === 'stress' ? 11 - avg(k) : avg(k)) * 10 })), { size: 260, compare: true, label: 'Mental radar' })}<p class="muted tiny">Stress is flipped on the radar so bigger is always better.</p></section></div>`;
  $('#m-day').addEventListener('change', (e) => { setUi('mDay', e.target.value || todayIso()); refresh(); });
  $('#m-form').addEventListener('input', (e) => { const s = e.target.closest('[data-mk]'); if (!s) return; s.classList.remove('unset'); $('#mv-' + s.dataset.mk).textContent = s.value; });
  $('#m-save').addEventListener('click', () => {
    const vals = {}; $$('[data-mk]').forEach((s) => { if (!s.classList.contains('unset')) vals[s.dataset.mk] = Number(s.value); });
    if (Object.keys(vals).length < 3) return toast('Rate at least 3 of the 6 (drag each slider)');
    const M = mind(); M.checks = { ...(M.checks || {}), [d]: { ...vals, note: $('#m-note').value.trim().slice(0, 600), at: Date.now() } }; persist('aos-mind');
    // energy also feeds the physical recovery check-in (1-5 scale) when that wasn't filled in
    if (vals.energy != null && dayDoc(d)?.feel?.energy == null) setFeel(d, { energy: clamp(Math.round(vals.energy / 2), 1, 5) });
    toast(`Check-in saved · mental readiness ${mentalScore(d)}`); const fr = checkAchievements(); if (fr.length) setTimeout(() => toast(`Achievement unlocked: ${fr.join(', ')}`), 2600); refresh();
  });
  $('#m-del')?.addEventListener('click', () => confirmSheet('Delete this check-in?', 'Delete', () => { delete mind().checks[d]; persist('aos-mind'); refresh(); }));
};

MIND.trends = (el) => {
  const r = ui('mR', '30'), days = lastNDays(Number(r)), sel = ui('mMet', ['confidence', 'focus', 'motivation']);
  const pts = (k) => days.filter((d) => mcheck(d)?.[k] != null).map((d) => ({ date: d, v: mcheck(d)[k], tip: `${mcheck(d)[k]}/10` }));
  const ms = days.map((d) => ({ date: d, v: mentalScore(d) })).filter((p) => p.v != null).map((p) => ({ ...p, tip: `${p.v}/100` }));
  const n = days.filter((d) => mcheck(d)).length, hist = Object.keys(mind().checks || {}).sort().reverse();
  const perfOpts = [['rating', 'Workout rating'], ['shotpct', 'Shooting %'], ['gamescore', 'Game Score'], ['recovery', 'Physical recovery']], perf = ui('mPerf', 'rating');
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Mental trends</h3><span class="sub">${n} check-in${n === 1 ? '' : 's'} in range</span></div>${seg('mR', [['14', '14D'], ['30', '30D'], ['90', '90D'], ['365', '1Y']], r)}</div>
    ${n ? `<div class="kpis four">${MIND_METRICS.slice(0, 4).map(([k, l, c]) => { const v = days.map((d) => mcheck(d)?.[k]).filter((x) => x != null), a = v.length ? mean(v) : null, half = Math.floor(v.length / 2), tr = v.length >= 4 ? mean(v.slice(half)) - mean(v.slice(0, half)) : null; return `<div class="kpi"><small>${l}</small><b style="color:${c}">${a == null ? '—' : r1(a)}</b><span class="tiny muted">${tr == null ? 'avg' : `${tr >= 0 ? '▲' : '▼'} ${r1(Math.abs(tr))} vs earlier`}</span></div>`; }).join('')}</div>
      <div class="chips" style="margin:14px 0 6px">${MIND_METRICS.map(([k, l, c]) => `<button type="button" class="chip ${sel.includes(k) ? 'on' : ''}" data-mmet="${k}"><i class="dot" style="background:${c};margin-right:5px"></i>${l}</button>`).join('')}</div><div class="chart" id="m-lines"></div>
      <h4 style="margin:14px 0 4px">Mental readiness (0-100)</h4>${ms.length ? '<div class="chart" id="m-score"></div>' : '<p class="muted small">Needs 3+ ratings per check-in.</p>'}`
    : emptyState('No check-ins yet', 'Do the daily mental check-in. Confidence, focus, motivation, stress, energy and readiness trends appear here.', 'spark', '<button type="button" class="btn sm primary" data-go="mind-checkin">Check in now</button>')}</section>
  ${n ? `<section class="card"><div class="card-head"><div><h3>Check-in consistency</h3><span class="sub">Last 16 weeks · colour = mental readiness</span></div></div>${heatmap(16, (d) => { const s = mentalScore(d); return s == null ? 0 : s < 40 ? 1 : s < 60 ? 2 : s < 80 ? 3 : 4; }, null, (d) => (mentalScore(d) == null ? 'no check-in' : `readiness ${mentalScore(d)}`))}</section>
  <section class="card"><div class="card-head"><div><h3>Mental readiness vs performance</h3><span class="sub">Same-day comparison · shows a pattern, not cause and effect</span></div><select id="m-perf" style="max-width:190px" aria-label="Performance measure">${perfOpts.map(([k, l]) => `<option value="${k}" ${k === perf ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div id="m-vs"></div></section>
  <section class="card"><div class="card-head"><div><h3>Check-in history</h3></div></div><div class="list">${hist.slice(0, 30).map((d) => { const c = mcheck(d); return `<div class="li" style="align-items:flex-start"><div style="min-width:0"><div class="t">${esc(fmtDL(d))} · readiness ${mentalScore(d) ?? '—'}</div><div class="s">${MIND_METRICS.filter(([k]) => c[k] != null).map(([k, l]) => `${l.split(' ')[0]} ${c[k]}`).join(' · ')}</div>${c.note ? `<div class="s" style="font-style:italic">${esc(c.note)}</div>` : ''}</div><button type="button" class="chip" data-mday="${d}">Edit</button></div>`; }).join('')}</div></section>` : ''}`;
  if (!n) return;
  drawMulti($('#m-lines'), MIND_METRICS.filter(([k]) => sel.includes(k)).map(([k, l, c]) => ({ name: l, color: c, pts: pts(k) })), { yMin: 1, yMax: 10, fmt: (v) => v + '/10', label: 'Mental ratings over time' });
  if (ms.length) drawLine($('#m-score'), ms, { yMin: 0, yMax: 100, color: 'var(--purple)', bands: [[70, 100, 'var(--good)'], [45, 70, 'var(--warn)'], [0, 45, 'var(--danger)']], fmt: (v) => v + '/100', h: 160 });
  const pv = (d) => perf === 'rating' ? (() => { const x = exList(d).map((w) => w.rating).filter(Boolean); return x.length ? mean(x) : null; })() : perf === 'shotpct' ? CORR_VARS.find((v) => v[0] === 'shotpct')[3](d) : perf === 'gamescore' ? (games().filter((g) => g.date === d).map(gameScore).filter((x) => x != null)[0] ?? null) : recoveryScore(d)?.score ?? null;
  const ps = lastNDays(365).map((d) => [mentalScore(d), pv(d), d]).filter(([a, b]) => a != null && b != null), fit = ps.length >= 5 ? pearson(ps) : null;
  $('#m-vs').innerHTML = ps.length >= 3 ? `<div class="chart" id="m-sc"></div><p class="small" style="margin-top:6px">${fit ? `${ps.length} days · r = ${fit.r >= 0 ? '+' : ''}${fit.r.toFixed(2)} (${strength(fit.r)}). ${Math.abs(fit.r) >= 0.2 ? `On days you felt more mentally ready, your ${perfOpts.find((x) => x[0] === perf)[1].toLowerCase()} tended to be ${fit.r > 0 ? 'higher' : 'lower'}.` : 'No clear pattern yet.'}` : 'Needs 5+ days with both to measure the relationship.'} Correlation is not causation.</p>` : emptyState('Not enough overlapping days', `Needs 3+ days with both a mental check-in and a ${perfOpts.find((x) => x[0] === perf)[1].toLowerCase()}.`, 'chart');
  if (ps.length >= 3) drawScatter($('#m-sc'), ps, { xl: 'Mental readiness', yl: perfOpts.find((x) => x[0] === perf)[1], fit, h: 210 });
  $('#m-perf').addEventListener('change', (e) => { setUi('mPerf', e.target.value); refresh(); });
};
document.addEventListener('click', (e) => {
  const m = e.target.closest('[data-mmet]'); if (m) { const cur = new Set(ui('mMet', ['confidence', 'focus', 'motivation'])); cur.has(m.dataset.mmet) ? cur.delete(m.dataset.mmet) : cur.add(m.dataset.mmet); setUi('mMet', [...cur]); return refresh(); }
  const d = e.target.closest('[data-mday]'); if (d) { setUi('mDay', d.dataset.mday); go('mind', 'checkin'); }
});

// ----- mental training: guided exercises (run in the same player as routines) -----
const MENTAL_EX = [
  ['visual', 'Visualization', 'See it before you do it', 'var(--purple)', [['Get comfortable', 30, 'Sit or lie down. Close your eyes. Three slow breaths, in through the nose, out through the mouth.'], ['See the gym', 45, 'Picture the court: the lights, the sound of the ball, the feel of your shoes on the floor.'], ['Your first possession', 60, 'See yourself bringing it up, reading the defense, making the right play. First person, real speed.'], ['Your shot', 60, 'Catch, set, release. Feel your fingertips on the seams and watch the ball go through. Ten makes in a row.'], ['Adversity', 45, 'You miss one or turn it over. See yourself sprint back, talk on defense and get the next one.'], ['Finish', 30, 'See the final buzzer. How do you feel? Open your eyes.']]],
  ['pregame', 'Pre-game preparation', 'Lock in before tip-off', '#ff6a3d', [['Breathe', 60, 'Box breathing: in 4, hold 4, out 4, hold 4.'], ['Your job', 45, 'Name your role tonight in one sentence.'], ['Three keys', 60, 'Pick three controllables: effort, communication, shot selection.'], ['Focus word', 30, 'Pick one word to come back to when it gets hard. Say it out loud.'], ['Highlight reel', 60, 'Replay three of your best plays this season.']]],
  ['confidence', 'Confidence builder', 'Build belief from evidence', 'var(--accent)', [['Evidence', 90, 'Write or say three things you have done well recently. Use real examples: a PR, a good game, a tough practice.'], ['Preparation', 60, 'List the work you have put in this week. Confidence comes from preparation.'], ['Power pose', 30, 'Stand tall, shoulders back, chin up. Breathe slowly.'], ['Affirmation', 30, 'Say: "I have done the work. I trust my game."']]],
  ['focus', 'Focus training', 'Train attention like a muscle', '#22c3ee', [['Settle', 30, 'Sit tall, eyes on one spot on the floor.'], ['Count breaths', 120, 'Count each exhale up to 10, then start again. If your mind wanders, notice it and go back to 1.'], ['Narrow focus', 60, 'Pick a small object. Notice every detail of it for one minute.'], ['Reset cue', 30, 'Practice your reset: deep breath, a tap on the thigh, your focus word.']]],
  ['selftalk', 'Positive self-talk', 'Change the voice in your head', 'var(--good)', [['Catch it', 60, 'Think of a negative thought you had recently ("I can\'t hit from the corner").'], ['Flip it', 60, 'Rewrite it into something true and useful ("I make corner 3s in practice; stay in my form").'], ['Cue words', 45, 'Make three short cues: "Next play", "Stay low", "Shoot it with confidence".'], ['Rehearse', 45, 'Say each cue out loud three times.']]],
  ['mistakes', 'Handling mistakes', 'Flush it and get the next one', 'var(--warn)', [['Name it', 30, 'Think of a recent mistake. Say what happened in one sentence, no judging.'], ['Feel it, briefly', 30, 'Let yourself feel frustrated for 10 seconds. That\'s normal.'], ['Flush routine', 45, 'Practice your physical reset: wipe your hands on your shorts, a deep breath, your focus word.'], ['Next play', 45, 'Picture the very next possession going well: sprinting back, talking on defense.'], ['Lesson', 60, 'What is the one thing to learn? Then let the rest go.']]],
  ['postgame', 'Post-game reflection', 'Learn from every game', '#f472b6', [['Breathe and reset', 30, 'Three slow breaths. The game is over.'], ['Wins', 60, 'Three things you did well.'], ['Lessons', 60, 'One thing to improve, without beating yourself up.'], ['Next step', 30, 'One specific thing to work on this week. Then write it in your journal.']]],
];
MIND.training = (el) => {
  const ss = mind().sessions || [], d30 = ss.filter((s) => inRange(s.date, '30'));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Mental training</h3><span class="sub">Guided exercises with a timer · ${d30.length} completed in 30 days</span></div></div>
    <div class="ex-grid">${MENTAL_EX.map(([id, name, tag, col, steps]) => { const n = ss.filter((s) => s.ex === id).length; return `<button type="button" class="ex-card" data-act="mental-ex" data-id="${id}" style="--c:${col}"><span class="tiny" style="color:${col};font-weight:700;text-transform:uppercase">${fmtDur(Math.round(sum(steps.map((s) => s[1])) / 60) || 1)}</span><b>${esc(name)}</b><span class="small muted">${esc(tag)}</span><span class="tiny muted">${steps.length} steps${n ? ` · done ${n}×` : ''}</span><span class="ex-go">▶</span></button>`; }).join('')}</div></section>
  ${ss.length ? `<section class="card"><div class="card-head"><div><h3>Practice log</h3></div></div><div class="chart" id="mx-wk"></div><div class="list" style="margin-top:8px">${[...ss].reverse().slice(0, 12).map((s) => `<div class="li"><span class="small">${esc(MENTAL_EX.find((x) => x[0] === s.ex)?.[1] || s.ex)}</span><span class="tiny muted">${esc(fmtD(s.date))} · ${s.steps}/${s.of} steps</span></div>`).join('')}</div></section>` : ''}`;
  if (ss.length) { const wk = []; for (let i = 7; i >= 0; i--) { const m = shiftIso(mondayOf(todayIso()), -7 * i), n = ss.filter((s) => s.date >= m && s.date <= shiftIso(m, 6)).length; wk.push({ label: `${parseIso(m).getMonth() + 1}/${parseIso(m).getDate()}`, full: 'Week of ' + fmtD(m), segs: [{ v: n, color: 'var(--purple)' }], tip: `${n} exercises` }); } drawBars($('#mx-wk'), wk, { h: 140 }); }
};
ACTIONS['mental-ex'] = (b) => {
  const ex = MENTAL_EX.find((x) => x[0] === b.dataset.id); if (!ex) return; let done = 0;
  runPlayer(ex[4].map(([title, secs, desc]) => ({ title, secs, desc })), { title: ex[1], sub: 'Mental training', color: ex[3], onStep: (i, ok) => { if (ok) done++; }, onFinish: () => {
    const M = mind(); M.sessions = [...(M.sessions || []), { id: uid('mx'), ex: ex[0], date: todayIso(), steps: done, of: ex[4].length }].slice(-300); persist('aos-mind');
    toast(`${ex[1]} done`); if (ex[0] === 'postgame') setTimeout(() => ACTIONS['journal']({ dataset: { type: 'game' } }), 400);
  } });
};

// ----- performance journal -----
const J_TYPES = [['daily', 'Daily entry'], ['game', 'Game reflection'], ['practice', 'Practice reflection']];
MIND.journal = (el) => {
  const q = ui('jq', ''), t = ui('jt', 'all'), js = [...(mind().journal || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
  const shown = js.filter((j) => (t === 'all' || j.type === t) && (!q || `${j.title} ${j.text} ${j.wins} ${j.improve} ${j.lessons} ${(j.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Performance journal</h3><span class="sub">${js.length} entr${js.length === 1 ? 'y' : 'ies'} · wins, things to improve, lessons</span></div><button type="button" class="btn sm primary" data-act="journal">＋ Entry</button></div>
    ${js.length ? `<input id="jq" placeholder="Search your journal…" value="${esc(q)}" style="margin-bottom:10px"><div class="chips" style="margin-bottom:10px"><button type="button" class="chip ${t === 'all' ? 'on' : ''}" data-jt="all">All</button>${J_TYPES.map(([k, l]) => `<button type="button" class="chip ${t === k ? 'on' : ''}" data-jt="${k}">${l}</button>`).join('')}</div>
      ${shown.length ? shown.slice(0, 50).map((j) => `<article class="jentry"><div class="row-between"><span class="tiny" style="color:var(--purple);font-weight:700;text-transform:uppercase">${esc(J_TYPES.find((x) => x[0] === j.type)?.[1] || '')} · ${esc(fmtDL(j.date))}</span><button type="button" class="chip" data-act="journal" data-id="${j.id}">Edit</button></div>${j.title ? `<h4>${esc(j.title)}</h4>` : ''}${j.text ? `<p class="small">${esc(j.text)}</p>` : ''}${j.wins ? `<p class="small"><b class="up">Mental wins:</b> ${esc(j.wins)}</p>` : ''}${j.improve ? `<p class="small"><b class="down">To improve:</b> ${esc(j.improve)}</p>` : ''}${j.lessons ? `<p class="small"><b style="color:var(--accent)">Lesson:</b> ${esc(j.lessons)}</p>` : ''}${(j.tags || []).length ? `<div class="chips" style="margin-top:4px">${j.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}</article>`).join('') : '<p class="muted small">No entries match.</p>'}`
    : emptyState('Start your journal', 'Write after games and practices: mental wins, what to improve, the lesson. Over a season this becomes your playbook.', 'spark', '<button type="button" class="btn sm primary" data-act="journal">Write your first entry</button>')}</section>`;
  $('#jq')?.addEventListener('input', (e) => { setUi('jq', e.target.value); clearTimeout(MIND.t); MIND.t = setTimeout(() => { refresh(); const i = $('#jq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
};
document.addEventListener('click', (e) => { const j = e.target.closest('[data-jt]'); if (j) { setUi('jt', j.dataset.jt); refresh(); } });
ACTIONS.journal = (b) => {
  const j = b.dataset.id ? (mind().journal || []).find((x) => x.id === b.dataset.id) : null, type = j?.type || b.dataset.type || 'daily';
  openSheet(j ? 'Edit journal entry' : 'New journal entry', `<div class="fields"><label>Type<select id="j-type">${J_TYPES.map(([k, l]) => `<option value="${k}" ${type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Date<input type="date" id="j-date" value="${j?.date || todayIso()}" max="${todayIso()}"></label>
    <label class="full">Title<input id="j-title" maxlength="80" value="${esc(j?.title || '')}" placeholder="vs Central, Tuesday practice…"></label>
    <label class="full">Entry<textarea id="j-text" maxlength="2000" style="min-height:100px">${esc(j?.text || '')}</textarea></label>
    <label class="full">Mental wins<input id="j-wins" maxlength="200" value="${esc(j?.wins || '')}" placeholder="Stayed composed after two turnovers"></label>
    <label class="full">Areas to improve<input id="j-imp" maxlength="200" value="${esc(j?.improve || '')}"></label>
    <label class="full">Lesson learned<input id="j-les" maxlength="200" value="${esc(j?.lessons || '')}"></label>
    <label class="full">Tags (comma-separated)<input id="j-tags" maxlength="100" value="${esc((j?.tags || []).join(', '))}" placeholder="confidence, defense"></label></div>
    <div class="row"><button type="button" class="btn primary" id="j-save" style="flex:1">Save</button>${j ? '<button type="button" class="btn danger" id="j-del">Delete</button>' : ''}</div>`, (d) => {
    $('#j-save', d).addEventListener('click', () => {
      const rec = { id: j?.id || uid('j'), type: $('#j-type', d).value, date: $('#j-date', d).value || todayIso(), title: $('#j-title', d).value.trim(), text: $('#j-text', d).value.trim(), wins: $('#j-wins', d).value.trim(), improve: $('#j-imp', d).value.trim(), lessons: $('#j-les', d).value.trim(), tags: $('#j-tags', d).value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8), at: j?.at || Date.now() };
      if (!rec.text && !rec.wins && !rec.improve && !rec.lessons && !rec.title) return toast('Write something first');
      const M = mind(); M.journal = [...(M.journal || []).filter((x) => x.id !== rec.id), rec]; persist('aos-mind'); closeSheet(); toast('Journal saved'); if (state.view === 'mind') go('mind', 'journal'); else refresh();
    });
    $('#j-del', d)?.addEventListener('click', () => confirmSheet('Delete this entry?', 'Delete', () => { mind().journal = mind().journal.filter((x) => x.id !== j.id); persist('aos-mind'); refresh(); }));
  });
};
