// ===================== COACH: AI coaching center =====================
// AI runs through Claude (the artifact "sample" capability). Outside Claude it is unavailable and the screens say so;
// the built-in workout templates are labeled as templates, never as AI.
let ai = null;
const aiOn = () => !!ai;
const AI_RULES = `You are the AI coach inside Athlete OS, a training app for a high-school basketball athlete.
Rules: Use ONLY the data in the JSON snapshot. null or missing means "not recorded" — say so; never treat it as zero and never invent numbers, test results, sleep, heart rate or meals.
Correlations are not causation. No medical diagnoses, no injury treatment beyond "see a trainer or doctor". Never encourage restrictive eating, skipping meals or weight cutting; this is a growing teen athlete.
Be direct and specific, like a good trainer. Use the athlete's own numbers. Address the athlete as "you"; don't guess their gender.`;

/** Compact, honest picture of the athlete's data for the model. */
function snapshot(nDays = 28) {
  const p = aos().profile || {}, mp = core().profile || {}, days = lastNDays(nDays);
  const day = (d) => {
    const f = hasFood(d) ? totalsOf(d) : null, t = targets(d), r = recoveryInputs(d), rs = recoveryScore(d);
    return { date: d, food: f ? { kcal: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, targetKcal: t.calories, targetProtein: t.protein } : null, waterOz: waterOf(d) || null, waterGoal: t.waterOz,
      training: exList(d).map((x) => ({ type: x.type, name: x.name, mins: x.mins, intensity: x.int, rating: x.rating || null })), sleepH: r.sleepH, energy1to5: r.energy, soreness1to5: r.sore, restingHR: r.rhr, hrv: r.hrv, recoveryScore: rs?.score ?? null };
  };
  const tests = allTests().map((t) => { const rs = resultsOf(t.id); if (!rs.length) return null; const pr = prOf(t.id); return { test: t.name, unit: t.unit, better: t.better, results: rs.slice(-6).map((r) => ({ date: r.date, value: r.value })), pr: pr.value, prDate: pr.date }; }).filter(Boolean);
  const sh = (ss) => { const z = zoneAgg(ss), c = catAgg(ss); return { zones: Object.fromEntries(ZONES.filter((x) => z[x.id].a).map((x) => [x.name, `${z[x.id].m}/${z[x.id].a}`])), types: Object.fromEntries(SHOT_CATS.filter(([k]) => c[k].a).map(([k, l]) => [l, `${c[k].m}/${c[k].a}`])) }; };
  const s30 = shotSessions().filter((s) => inRange(s.date, '30')), sPrev = shotSessions().filter((s) => { const k = daysBetween(s.date, todayIso()); return k >= 30 && k < 60; });
  const st = streaks(), wk = weekStats(mondayOf(todayIso())), lw = weekStats(shiftIso(mondayOf(todayIso()), -7));
  return {
    today: todayIso(), athlete: { name: p.name || null, position: p.position || null, age: mp.age || null, heightIn: mp.heightIn || null, weightLb: mp.weightLb || null, goals: p.goals || null, priorities: p.priorities || [], equipment: p.equipment || [], trainingDaysPerWeekGoal: Number(p.weeklyDays) || 5, nextGame: p.nextGame || null, nutritionGoal: mp.goal || null },
    streaks: st, thisWeek: wk, lastWeek: lw, days: days.map(day).filter((x) => x.food || x.waterOz || x.training.length || x.sleepH != null || x.energy1to5 != null),
    testsAndPRs: tests, shooting: { last30Days: s30.length ? sh(s30) : null, previous30Days: sPrev.length ? sh(sPrev) : null, sessionsLast30: s30.length },
    games: games().slice(-6), bodyWeight: bodySeries('weight').slice(-8), bodyFat: bodySeries('bf').slice(-4),
    note: 'Days with nothing recorded are omitted. Absent fields = not recorded.',
  };
}
async function askAI(prompt, json = true, extra = {}) {
  if (!ai) throw Object.assign(new Error('AI is available when Athlete OS is opened inside Claude.'), { code: 'unavailable' });
  return json ? ai.json(prompt, { modelTier: 'default', ...extra }) : ai(prompt, { modelTier: 'default', cache: false, ...extra });
}
const aiError = (e) => (e?.code === 'not_granted' ? 'AI access was declined. Allow it from this artifact\'s permissions to use Coach.' : e?.code === 'rate_limited' ? 'Coach is busy. Try again in a minute.' : e?.code === 'unavailable' ? e.message : 'Coach couldn\'t answer that. Try again.');
const aiUnavailable = () => `<div class="notice warn"><b>AI needs Claude.</b> Open Athlete OS inside the Claude app or claude.ai to use AI coaching. Everything else works without it.</div>`;

RENDER.coach = (el, sub) => COACH[sub](el);
const COACH = {};

// ----- Home card: today's focus -----
function homeAI(el) {
  const c = doc('aos-coach'), f = c.focus?.date === todayIso() ? c.focus : null;
  el.innerHTML = `<div class="card-head"><div><h3>Coach recommendation <span class="ai-badge">AI</span></h3><span class="sub">${f ? 'Today\'s focus, from your logs' : 'One clear priority for today, from your real data'}</span></div>${aiOn() ? `<button type="button" class="btn sm" data-act="focus">${f ? 'Refresh' : 'Get today\'s focus'}</button>` : ''}</div>
    <div id="focus-out">${f ? focusHtml(f) : aiOn() ? '<p class="muted small">Coach looks at your sleep, recovery, training load, PRs, shooting and food, then tells you what matters most today.</p>' : ruleFocus()}</div>
    <div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-go="coach-workout">Build a workout</button><button type="button" class="btn sm" data-go="coach-ask">Ask Coach</button></div>`;
}
const focusHtml = (f) => `<div class="ai-out"><b style="font-family:var(--f-display);font-size:17px">${esc(f.headline)}</b><ul>${(f.actions || []).map((a) => `<li class="small">${esc(a)}</li>`).join('')}</ul>${f.basedOn ? `<p class="tiny muted">Based on: ${esc(f.basedOn)}</p>` : ''}</div>`;
// Without AI: simple, transparent rules (labeled as such).
function ruleFocus() {
  const t = todayIso(), rs = recoveryScore(t), w = weekStats(mondayOf(t)), out = [];
  if (rs && rs.score < 45) out.push('Recovery is low today: keep it to skill work and mobility.');
  if (!recoveryInputs(t).sleepH && !rs) out.push('Do the morning check-in so your recovery score can guide training.');
  if (w.active < Math.min(3, w.days)) out.push(`You've trained ${w.active} day(s) this week. Get a session in.`);
  if (hasFood(t) && totalsOf(t).protein < targets(t).protein * 0.5 && new Date().getHours() >= 15) out.push('Protein is under half your goal this afternoon. Add a protein-heavy snack.');
  if (!out.length) out.push('Log today\'s training and meals to get more specific guidance.');
  return `<p class="tiny muted" style="margin-bottom:6px">From simple rules on your data (AI available inside Claude)</p><ul class="small" style="margin:0;padding-left:18px">${out.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}
ACTIONS.focus = async (b) => {
  b.disabled = true; $('#focus-out').innerHTML = '<p class="muted small">Coach is reading your logs…</p>';
  try {
    const r = await askAI(`${AI_RULES}\n\nSnapshot:\n${JSON.stringify(snapshot(14))}\n\nGive today's single most important focus. Return JSON {"headline": string (max 12 words), "actions": [2-3 short specific actions for today], "basedOn": string (which recorded data you used; mention anything important that is missing)}.`);
    const c = doc('aos-coach'); c.focus = { date: todayIso(), headline: String(r.headline || ''), actions: (r.actions || []).map(String).slice(0, 4), basedOn: String(r.basedOn || '') }; persist('aos-coach');
    $('#focus-out').innerHTML = focusHtml(c.focus);
  } catch (e) { $('#focus-out').innerHTML = `<p class="small down">${esc(aiError(e))}</p>`; }
  b.disabled = false;
};

// ----- Workout generator -----
const FOCUSES = [['shooting', 'Shooting'], ['handles', 'Ball handling'], ['finishing', 'Finishing'], ['skills', 'Full guard skills'], ['strength', 'Strength'], ['speed', 'Speed & agility'], ['jump', 'Vertical / explosiveness'], ['conditioning', 'Conditioning'], ['recovery', 'Recovery / mobility']];
const EQUIP = [['hoop', 'Ball + hoop'], ['gym', 'Full gym'], ['db', 'Dumbbells'], ['bands', 'Bands'], ['cones', 'Cones'], ['none', 'Bodyweight only']];
COACH.workout = (el) => {
  const p = aos().profile || {}, f = ui('wFocus', 'shooting'), mins = ui('wMins', '60'), int = ui('wInt', 'moderate');
  const eq = ui('wEq', null) || (p.equipment?.length ? p.equipment : ['hoop']);
  const saved = [...(doc('aos-coach').workouts || [])].reverse();
  el.innerHTML = `<section class="card ai">
    <div class="card-head"><div><h3>Workout generator <span class="ai-badge">AI</span></h3><span class="sub">Built around your recovery, recent training, PRs and weak spots</span></div></div>
    <div class="stack">
      <div><p class="muted small" style="margin-bottom:6px">Focus</p><div class="chips">${FOCUSES.map(([k, l]) => `<button type="button" class="chip ${k === f ? 'on' : ''}" data-wf="${k}">${l}</button>`).join('')}</div></div>
      <div class="row"><div><p class="muted small" style="margin-bottom:6px">Time</p>${seg('wMins', [['20', '20m'], ['30', '30m'], ['45', '45m'], ['60', '60m'], ['90', '90m']], mins)}</div><div><p class="muted small" style="margin-bottom:6px">Intensity</p>${seg('wInt', [['light', 'Light'], ['moderate', 'Moderate'], ['hard', 'Hard']], int)}</div></div>
      <div><p class="muted small" style="margin-bottom:6px">Equipment</p><div class="chips">${EQUIP.map(([k, l]) => `<button type="button" class="chip ${eq.includes(k) ? 'on' : ''}" data-weq="${k}">${l}</button>`).join('')}</div></div>
      <input id="w-note" placeholder="Optional: game tomorrow, sore hamstrings, working on left hand…" maxlength="160">
      <div class="row"><button type="button" class="btn primary" style="flex:1" data-act="gen-workout" ${aiOn() ? '' : 'disabled'}>Generate with AI</button><button type="button" class="btn" data-act="tpl-workout">Use a built-in template</button></div>
      ${aiOn() ? '' : aiUnavailable()}
    </div>
  </section>
  <section class="card" id="w-out" hidden></section>
  <section class="card"><div class="card-head"><div><h3>Saved workouts</h3><span class="sub">${saved.length} saved</span></div></div>${saved.length ? `<div class="list">${saved.slice(0, 20).map((w) => `<button type="button" class="li li-btn" data-act="open-workout" data-id="${w.id}"><div><div class="t">${esc(w.title)}</div><div class="s">${esc(fmtD(w.date))} · ${w.mins} min · ${esc(w.source === 'ai' ? 'AI' : 'Template')}${w.done ? ' · ✓ done' : ''}</div></div><span class="muted">›</span></button>`).join('')}</div>` : '<p class="muted small">Generated workouts you save show up here.</p>'}</section>`;
};
document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-wf]'); if (f) { setUi('wFocus', f.dataset.wf); return refresh(); }
  const q = e.target.closest('[data-weq]'); if (q) { const cur = new Set(ui('wEq', null) || aos().profile?.equipment || ['hoop']); cur.has(q.dataset.weq) ? cur.delete(q.dataset.weq) : cur.add(q.dataset.weq); setUi('wEq', [...cur]); refresh(); }
});
function workoutHtml(w, saved) {
  return `<div class="card-head"><div><h3>${esc(w.title)}</h3><span class="sub">${w.mins} min · ${esc(w.intensity)} · ${w.source === 'ai' ? '<span class="ai-badge">AI</span>' : 'Built-in template'}</span></div></div>
    ${w.summary ? `<p class="small">${esc(w.summary)}</p>` : ''}
    ${(w.blocks || []).map((b) => `<h4 style="margin:14px 0 4px">${esc(b.name)}${b.mins ? ` <span class="muted tiny">· ${b.mins} min</span>` : ''}</h4><div>${(b.items || []).map((x) => `<div class="ex"><span class="n">${esc(x.name)}</span><span class="d">${esc(x.dose || '')}</span>${x.rest || x.cue ? `<span class="c">${x.rest ? 'Rest ' + esc(x.rest) + '. ' : ''}${esc(x.cue || '')}</span>` : ''}</div>`).join('')}</div>`).join('')}
    ${w.why ? `<p class="notice" style="margin-top:12px">${esc(w.why)}</p>` : ''}
    <div class="row" style="margin-top:12px">${saved ? '' : '<button type="button" class="btn" data-act="save-workout">Save</button>'}<button type="button" class="btn primary" data-act="done-workout" ${w.id ? `data-id="${w.id}"` : ''}>✓ Done: log it</button>${saved ? `<button type="button" class="btn danger" data-act="del-saved-workout" data-id="${w.id}">Delete</button>` : ''}</div>`;
}
let draftWorkout = null;
function showWorkout(w, saved = false) { draftWorkout = w; const o = $('#w-out'); if (o) { o.hidden = false; o.innerHTML = workoutHtml(w, saved); o.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
const focusType = (f) => ({ shooting: 'shooting', handles: 'skill', finishing: 'skill', skills: 'skill', strength: 'lift', speed: 'speed', jump: 'lift', conditioning: 'conditioning', recovery: 'recovery' })[f] || 'other';
ACTIONS['gen-workout'] = async (b) => {
  const f = ui('wFocus', 'shooting'), mins = Number(ui('wMins', '60')), int = ui('wInt', 'moderate'), eq = ui('wEq', null) || aos().profile?.equipment || ['hoop'];
  const note = $('#w-note')?.value.trim() || '';
  b.disabled = true; b.textContent = 'Building your workout…';
  try {
    const r = await askAI(`${AI_RULES}\n\nSnapshot:\n${JSON.stringify(snapshot(21))}\n\nBuild one ${mins}-minute ${int} ${FOCUSES.find((x) => x[0] === f)[1]} workout. Equipment available: ${eq.map((k) => EQUIP.find((x) => x[0] === k)?.[1]).join(', ')}. Athlete note: ${note || 'none'}.
Adjust for today's recovery score and the last 7 days of training load if recorded (if recovery is low or soreness high, scale volume down and say so). Target weak zones/shot types or tests from the data when relevant. Blocks must add up to about ${mins} minutes including warm-up and cool-down. Use safe, age-appropriate loading (RPE or % of tested max only if a max exists).
Return JSON {"title": string, "summary": string (1-2 sentences), "blocks": [{"name": string, "mins": number, "items": [{"name": string, "dose": string (sets x reps, makes, or time), "rest": string, "cue": string (one coaching cue)}]}], "why": string (why this fits your data; say what data was missing)}.`);
    showWorkout({ title: String(r.title || 'Workout'), summary: String(r.summary || ''), blocks: Array.isArray(r.blocks) ? r.blocks.slice(0, 8) : [], why: String(r.why || ''), mins, intensity: int, focus: f, source: 'ai', date: todayIso() });
  } catch (e) { toast(aiError(e)); }
  b.disabled = false; b.textContent = 'Generate with AI';
};
// Built-in templates (no AI): fixed, proven structures scaled to the time you pick.
const TEMPLATES = {
  shooting: [['Warm-up', 0.15, [['Form shooting close to rim', '25 makes', '', 'Elbow under the ball, hold the follow-through']]], ['Catch-and-shoot', 0.35, [['5-spot 3s (corners, wings, top)', '10 makes per spot', '30 s between spots', 'Hop into the catch, shoot on the way up'], ['Relocation 3s', '3 x 10 shots', '45 s', 'Pass, sprint to a new spot, feet set before the catch']]], ['Off the dribble', 0.3, [['1-dribble pull-ups (elbows)', '4 x 8 makes', '45 s', 'Low hard dribble, square shoulders'], ['Step-back 3s', '3 x 6 makes', '45 s', 'Push off the front foot, land balanced']]], ['Pressure', 0.2, [['Free throws when tired', '2 x 10 (after a down-and-back sprint)', '30 s', 'Same routine every time'], ['Beat the pro to 11', '2 games', '1 min', 'Make = +1, miss = -2']]]],
  handles: [['Warm-up', 0.15, [['Stationary pound series', '30 s each hand x 3', '15 s', 'Ball below the knee, eyes up']]], ['Two-ball', 0.3, [['Two-ball same-time / alternate', '4 x 30 s', '20 s', 'Push the ball into the floor'], ['Two-ball crossovers', '4 x 30 s', '20 s', 'Stay low, wide base']]], ['Combo moves', 0.35, [['Cone weave: cross, between, behind', '6 trips', '30 s', 'Change speed out of each move'], ['Hesi into attack', '3 x 6 each side', '45 s', 'Sell it with the shoulders']]], ['Finish', 0.2, [['Full-court speed dribble to layup', '6 each hand', '30 s', 'Max 4 dribbles half court to rim']]]],
  finishing: [['Warm-up', 0.15, [['Mikan drill', '3 x 30 s', '20 s', 'Both hands, never let the ball drop below the chin']]], ['Footwork', 0.35, [['Euro step finishes', '3 x 6 each side', '30 s', 'Long first step, protect the ball'], ['Inside-hand layups', '3 x 6 each side', '30 s', 'Finish with the hand farthest from the defender']]], ['Contact', 0.3, [['Pad / chair contact layups', '3 x 8', '45 s', 'Chin the ball, absorb then rise'], ['Floaters from 6-10 ft', '3 x 10 makes', '45 s', 'Soft release, high arc']]], ['Game speed', 0.2, [['Full-court 1v0 attacks', '8 trips', '30 s', 'Read the closeout cone, choose finish']]]],
  skills: [['Warm-up', 0.12, [['Dynamic warm-up + form shooting', '6 min', '', 'Get loose before speed']]], ['Handles', 0.25, [['Two-ball series', '4 x 30 s', '20 s', 'Eyes up'], ['Attack moves at cones', '6 trips', '30 s', 'Change of pace']]], ['Shooting', 0.38, [['5-spot catch-and-shoot', '8 makes per spot', '30 s', 'Feet set before the catch'], ['Pull-ups off a hesi', '3 x 8 each side', '45 s', 'Stop on a dime']]], ['Finishing', 0.25, [['Euro / pro-hop finishes', '3 x 6 each side', '30 s', 'Protect the ball'], ['Free throws', '2 x 10', '', 'Same routine']]]],
  strength: [['Warm-up', 0.15, [['Bike or jog + mobility', '6 min', '', 'Hips, ankles, T-spine']]], ['Main lifts', 0.5, [['Goblet or back squat', '4 x 6 (RPE 7)', '2 min', 'Chest up, knees track toes'], ['Romanian deadlift', '3 x 8', '90 s', 'Hinge, soft knees'], ['Push-ups or DB bench', '3 x 10', '90 s', 'Full range']]], ['Accessories', 0.25, [['Split squats', '3 x 8 each leg', '60 s', 'Front shin vertical'], ['Rows (DB or band)', '3 x 12', '60 s', 'Squeeze shoulder blades']]], ['Core', 0.1, [['Dead bugs + side plank', '2 rounds', '30 s', 'Ribs down']]]],
  speed: [['Warm-up', 0.2, [['A-skips, high knees, leg swings', '8 min', '', 'Build to fast']]], ['Acceleration', 0.35, [['10-yd starts', '6 reps', '60 s full rest', 'Lean, push the ground back'], ['Falling starts', '4 reps', '60 s', 'Drive arms']]], ['Change of direction', 0.3, [['5-10-5 shuttle', '5 reps', '75 s', 'Low hips at the cut'], ['Defensive slide to sprint', '6 reps', '60 s', 'Open hips, explode']]], ['Cool-down', 0.15, [['Easy jog + stretch', '5 min', '', '']]]],
  jump: [['Warm-up', 0.2, [['Dynamic warm-up + pogo hops', '8 min', '', 'Stiff ankles on pogos']]], ['Plyometrics', 0.35, [['Box jumps (step down)', '4 x 4', '90 s', 'Max intent, quiet landing'], ['Approach jumps', '4 x 3', '90 s', 'Penultimate step low']]], ['Strength', 0.3, [['Trap-bar or goblet squat', '4 x 5', '2 min', 'Fast up'], ['Single-leg RDL', '3 x 8 each', '60 s', 'Balance and hinge']]], ['Ankles & core', 0.15, [['Calf raises (slow down)', '3 x 15', '45 s', '3 s lowering'], ['Plank', '3 x 40 s', '30 s', 'Squeeze glutes']]]],
  conditioning: [['Warm-up', 0.15, [['Jog + dynamic stretch', '6 min', '', '']]], ['Intervals', 0.55, [['Court sprints (baseline to baseline x2)', '8 reps', '45 s', 'Touch every line'], ['Defensive slide intervals', '6 x 30 s', '30 s', 'Stay low the whole time']]], ['Game finish', 0.2, [['Free throws between sprints', '5 rounds of 2', '', 'Shoot tired, same routine']]], ['Cool-down', 0.1, [['Walk + stretch', '5 min', '', 'Breathe through the nose']]]],
  recovery: [['Mobility', 0.45, [['Hip 90/90 switches', '2 x 10', '', 'Tall chest'], ['World\'s greatest stretch', '2 x 5 each side', '', 'Slow'], ['Ankle rocks', '2 x 12 each', '', 'Knee over toes']]], ['Easy movement', 0.35, [['Easy bike or walk', '10 min', '', 'Conversation pace']]], ['Breathing', 0.2, [['Box breathing 4-4-4-4', '5 min', '', 'Lying down, legs up']]]],
};
ACTIONS['tpl-workout'] = () => {
  const f = ui('wFocus', 'shooting'), mins = Number(ui('wMins', '60')), int = ui('wInt', 'moderate'), T = TEMPLATES[f] || TEMPLATES.skills;
  showWorkout({ title: `${FOCUSES.find((x) => x[0] === f)[1]} · ${mins} min`, summary: 'Built-in template, scaled to your time. Not personalized. Use AI inside Claude for a plan built from your data.', blocks: T.map(([name, frac, items]) => ({ name, mins: Math.max(3, Math.round(mins * frac)), items: items.map(([n, dose, rest, cue]) => ({ name: n, dose: mins <= 30 && /x/.test(dose) ? dose.replace(/^(\d+) x/, (m, a) => `${Math.max(2, Math.round(a * 0.6))} x`) : dose, rest, cue })) })), mins, intensity: int, focus: f, source: 'template', date: todayIso() });
};
ACTIONS['save-workout'] = () => { if (!draftWorkout) return; const w = { ...draftWorkout, id: uid('w') }; const c = doc('aos-coach'); c.workouts = [...(c.workouts || []), w].slice(-60); persist('aos-coach'); draftWorkout = w; toast('Workout saved'); refresh(); showWorkout(w, true); };
ACTIONS['open-workout'] = (b) => { const w = (doc('aos-coach').workouts || []).find((x) => x.id === b.dataset.id); if (w) showWorkout(w, true); };
ACTIONS['del-saved-workout'] = (b) => { const c = doc('aos-coach'); c.workouts = (c.workouts || []).filter((x) => x.id !== b.dataset.id); persist('aos-coach'); refresh(); };
ACTIONS['done-workout'] = (b) => {
  const w = b.dataset.id ? (doc('aos-coach').workouts || []).find((x) => x.id === b.dataset.id) : draftWorkout; if (!w) return;
  openWorkoutSheet({ type: focusType(w.focus), name: w.title.slice(0, 40), mins: w.mins, int: w.intensity, after: () => { if (w.id) { w.done = todayIso(); persist('aos-coach'); } } });
};

// ----- Ask Coach -----
const SUGGEST = ['What am I improving at?', 'What are my biggest weaknesses?', 'What should I work on this week?', 'How has my shooting improved?', 'Am I training consistently?', 'What should I prioritize before my next game?'];
COACH.ask = (el) => {
  const chat = doc('aos-coach').chat || [];
  el.innerHTML = `<section class="card ai">
    <div class="card-head"><div><h3>Ask Coach <span class="ai-badge">AI</span></h3><span class="sub">Answers use your recorded data and say when something wasn't logged</span></div>${chat.length ? '<button type="button" class="btn sm" data-act="clear-chat">Clear</button>' : ''}</div>
    ${aiOn() ? '' : aiUnavailable()}
    <div class="chat" id="chat">${chat.map((m) => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.content)}</div>`).join('') || '<p class="muted small">Try one of these:</p>'}</div>
    <div class="chips" style="margin:10px 0">${SUGGEST.map((s) => `<button type="button" class="chip" data-ask="${esc(s)}" ${aiOn() ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div>
    <form class="row" id="ask-form" style="flex-wrap:nowrap"><input id="ask-in" placeholder="Ask about your training, shooting, recovery, food…" maxlength="400" autocomplete="off" ${aiOn() ? '' : 'disabled'}><button class="btn primary" ${aiOn() ? '' : 'disabled'}>Ask</button></form>
  </section>`;
  $('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#ask-in').value.trim(); if (q) ask(q); });
  const c = $('#chat'); c.scrollTop = c.scrollHeight;
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-ask]'); if (b) ask(b.dataset.ask); });
let asking = false;
async function ask(q) {
  if (asking || !aiOn()) return; asking = true;
  const c = doc('aos-coach'); c.chat = [...(c.chat || []), { role: 'user', content: q.slice(0, 400) }];
  const box = $('#chat'); box.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div><div class="msg ai" id="pending">…</div>`); box.scrollTop = box.scrollHeight; $('#ask-in').value = '';
  const hist = c.chat.slice(-10);
  const msgs = [{ role: 'user', content: `${AI_RULES}\nAnswer in plain text, under 180 words, with specific numbers from the snapshot and 1-3 concrete next steps. If the data can't answer the question, say exactly what to log.\n\nSnapshot:\n${JSON.stringify(snapshot(42))}\n\nQuestion: ${hist[0].content}` }, ...hist.slice(1)];
  if (msgs.length > 1) msgs[0].content = `${AI_RULES}\nAnswer in plain text, under 180 words, with specific numbers and 1-3 next steps.\n\nSnapshot:\n${JSON.stringify(snapshot(42))}\n\nConversation follows.\n\n${hist[0].content}`;
  try {
    const r = await askAI(msgs, false, { onText: ({ text }) => { const p = $('#pending'); if (p) p.textContent = text; } });
    c.chat.push({ role: 'assistant', content: r.text }); c.chat = c.chat.slice(-30); persist('aos-coach');
    const p = $('#pending'); if (p) { p.textContent = r.text; p.removeAttribute('id'); }
  } catch (e) { c.chat.pop(); const p = $('#pending'); if (p) { p.textContent = aiError(e); p.removeAttribute('id'); } }
  asking = false;
}
ACTIONS['clear-chat'] = () => { doc('aos-coach').chat = []; persist('aos-coach'); refresh(); };

// ----- Weekly report: stats + charts always; AI write-up on demand -----
COACH.report = (el) => {
  const weeks = []; for (let i = 0; i < 8; i++) weeks.push(shiftIso(mondayOf(todayIso()), -7 * i));
  const mon = ui('repWeek', weeks[0]), w = weekStats(mon), lw = weekStats(shiftIso(mon, -7)), saved = (doc('aos-coach').reports || []).find((r) => r.mon === mon);
  const row = (l, a, b, u = '', lower = false, pts = false) => `<span>${l}</span><b>${a == null ? '—' : a.toLocaleString() + u}</b><span class="muted">${b == null ? '—' : b.toLocaleString() + u}</span>${pts && a != null && b != null ? deltaPill(a - b, lower, ' pts') : deltaPill(pctChange(a, b), lower)}`;
  el.innerHTML = `<section class="card">
    <div class="card-head"><div><h3>Weekly athlete report</h3><span class="sub">Week of ${esc(fmtD(mon))}${mon === weeks[0] ? ' (so far)' : ''} vs the week before</span></div><select id="rep-week" style="max-width:200px" aria-label="Week">${weeks.map((m, i) => `<option value="${m}" ${m === mon ? 'selected' : ''}>${i === 0 ? 'This week' : i === 1 ? 'Last week' : 'Week of ' + fmtD(m)}</option>`).join('')}</select></div>
    <div class="rings" style="margin-bottom:14px">
      ${ring(w.active, Number(aos().profile?.weeklyDays) || 5, { label: 'Active days', sub: `${w.active} of ${Number(aos().profile?.weeklyDays) || 5}`, center: `<b>${w.active}</b>` })}
      ${ring(w.protHit, w.foodDays || 1, { color: 'var(--protein)', label: 'Protein goal', sub: w.foodDays ? `${w.protHit} of ${w.foodDays} logged days` : 'no food logged', center: `<b>${w.foodDays ? Math.round((w.protHit / w.foodDays) * 100) + '%' : '—'}</b>` })}
      ${ring(w.waterGoalDays, w.days || 1, { color: 'var(--water)', label: 'Water goal', sub: `${w.waterGoalDays} of ${w.days} days`, center: `<b>${w.waterGoalDays}</b>` })}
      ${ring(w.avgRec ?? 0, 100, { color: 'var(--good)', label: 'Avg recovery', sub: w.avgRec == null ? 'no check-ins' : recBand(w.avgRec)[1], center: `<b>${w.avgRec ?? '—'}</b>` })}
    </div>
    <div class="chart" id="rep-chart"></div><div class="legend">${CATS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>
    <div class="cmp" style="margin-top:14px"><span class="h">This week</span><span class="h">Value</span><span class="h">Prior</span><span class="h">Change</span>
      ${row('Training sessions', w.sessions, lw.sessions)}${row('Training hours', r1(w.mins / 60), r1(lw.mins / 60), ' h')}${row('Basketball workouts', w.hoopsN, lw.hoopsN)}${row('Strength workouts', w.liftN, lw.liftN)}
      ${row('Shots taken', w.shotA || null, lw.shotA || null)}${row('Shooting %', w.shotPct == null ? null : r1(w.shotPct * 100), lw.shotPct == null ? null : r1(lw.shotPct * 100), '%', false, true)}
      ${row('Avg calories', w.avgKcal, lw.avgKcal)}${row('Avg protein', w.avgProtein, lw.avgProtein, ' g')}${row('Avg water', w.avgWater, lw.avgWater, ' oz')}${row('Avg sleep', w.avgSleep, lw.avgSleep, ' h')}${row('Avg recovery', w.avgRec, lw.avgRec)}
    </div>
    ${w.prs.length ? `<div class="notice" style="margin-top:12px"><b style="color:var(--fg)">🏆 New PRs this week:</b> ${w.prs.map((p) => `${esc(p.t.name)} ${esc(fmtVal(p.t, p.r.value))}`).join(', ')}</div>` : ''}
  </section>
  <section class="card ai"><div class="card-head"><div><h3>Coach's write-up <span class="ai-badge">AI</span></h3><span class="sub">${saved ? 'Saved ' + esc(fmtD(saved.date)) : 'Training, improvements, nutrition, recovery, PRs, what to fix, next week\'s priorities'}</span></div>${aiOn() ? `<button type="button" class="btn sm primary" data-act="gen-report">${saved ? 'Redo' : 'Write my report'}</button>` : ''}</div>
    <div id="rep-out">${saved ? reportHtml(saved) : aiOn() ? '<p class="muted small">Uses only this week\'s logs and says what\'s missing.</p>' : aiUnavailable()}</div></section>`;
  const days = lastNDays(7, shiftIso(mon, 6));
  drawBars($('#rep-chart'), days.map((d) => { const t = trainingOf(d); return { label: DOW[parseIso(d).getDay()].slice(0, 2), full: fmtDL(d), segs: CATS.map(([k, , c]) => ({ v: t.by[k], color: c })), tip: t.mins ? fmtDur(t.mins) : d > todayIso() ? 'upcoming' : 'no training' }; }), { fmt: (v) => fmtDur(v), tick: (v) => v + 'm', h: 150 });
  $('#rep-week').addEventListener('change', (e) => { setUi('repWeek', e.target.value); refresh(); });
};
const REP_SECTIONS = [['training', 'Training completed'], ['improvements', 'Performance improvements'], ['nutrition', 'Nutrition consistency'], ['recovery', 'Recovery trends'], ['prs', 'Personal records'], ['fix', 'Areas to improve'], ['next', 'Priorities for next week']];
const reportHtml = (r) => `<div class="ai-out">${r.grade ? `<p><span class="big" style="font-size:28px">${esc(r.grade)}</span> <span class="small">${esc(r.headline || '')}</span></p>` : ''}${REP_SECTIONS.map(([k, l]) => (r[k]?.length ? `<div><h4>${l}</h4><ul>${r[k].map((x) => `<li class="small">${esc(x)}</li>`).join('')}</ul></div>` : '')).join('')}${r.missing ? `<p class="tiny muted">Not recorded: ${esc(r.missing)}</p>` : ''}</div>`;
ACTIONS['gen-report'] = async (b) => {
  const mon = ui('repWeek', mondayOf(todayIso())); b.disabled = true; $('#rep-out').innerHTML = '<p class="muted small">Coach is reviewing your week…</p>';
  try {
    const snap = snapshot(21); snap.reportWeek = weekStats(mon); snap.weekBefore = weekStats(shiftIso(mon, -7)); snap.reportWeek.prs = snap.reportWeek.prs.map((p) => ({ test: p.t.name, value: p.r.value, prev: p.prev })); snap.weekBefore.prs = snap.weekBefore.prs.length;
    const r = await askAI(`${AI_RULES}\n\nSnapshot:\n${JSON.stringify(snap)}\n\nWrite the weekly report for the week starting ${mon} (reportWeek) compared with weekBefore. Return JSON {"grade": "A|B|C|D" (effort and consistency only, never body weight), "headline": string (one sentence), ${REP_SECTIONS.map(([k]) => `"${k}": [1-3 short bullet strings]`).join(', ')}, "missing": string (what wasn't logged that would make this more accurate)}. Use real numbers. Empty array if a section has no data.`);
    const rep = { mon, date: todayIso(), grade: String(r.grade || '').slice(0, 2), headline: String(r.headline || ''), missing: String(r.missing || '') };
    for (const [k] of REP_SECTIONS) rep[k] = (Array.isArray(r[k]) ? r[k] : []).map(String).slice(0, 4);
    const c = doc('aos-coach'); c.reports = [...(c.reports || []).filter((x) => x.mon !== mon), rep].slice(-20); persist('aos-coach');
    $('#rep-out').innerHTML = reportHtml(rep);
  } catch (e) { $('#rep-out').innerHTML = `<p class="small down">${esc(aiError(e))}</p>`; }
  b.disabled = false;
};

// ----- Fuel tools: MacroLens features, one tap away -----
COACH.fuel = (el) => {
  const tools = [
    ['coach-schedule', 'Smart eating schedule', 'Breakfast, lunch, dinner, pre- and post-workout meals timed around today\'s practice.', 'calendar'],
    ['coach-bowl', 'Build-a-bowl', 'Pick ingredients and portions, see calories and macros update live, then log it.', 'fork'],
    ['coach-whatif', 'What if calculator', 'Try another serving of rice, add chicken, remove a snack: totals update instantly.', 'chart'],
    ['coach-review', 'AI food diary review', 'Nutrition breakdown, strengths, gaps and whether the day fit your goals.', 'spark'],
    ['coach-snacks', 'Smart snack finder', 'High protein, high carb, pre- or post-workout, quick energy: picked from what you have left.', 'bolt'],
    ['coach-plans', 'Meal plan and grocery list', 'A week of meals and a shopping list built from foods you eat.', 'grid'],
    ['today', 'Food diary', 'Log meals by photo, search or barcode. Everything here reads from it.', 'fork'],
  ];
  const hc = core().health;
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Nutrition tools</h3><span class="sub">These live in MacroLens and share the same food log</span></div></div>
    <div class="apps">${tools.map(([r, t, d, i]) => `<a class="app" data-ml href="${ML(r)}"><span style="color:var(--accent);width:22px;height:22px;display:block">${ICONS[i]}</span><b>${t}</b><span>${d}</span></a>`).join('')}</div></section>
    <section class="card"><div class="card-head"><div><h3>Apple Health and wearables</h3><span class="sub">Connection status</span></div><span class="band ${hc ? 'hi' : 'mid'}">${hc ? 'Imported' : 'Not connected'}</span></div>
    <p class="small">${hc ? `Apple Health data was imported${hc.lastSync ? ' on ' + esc(fmtD(isoDate(new Date(hc.lastSync)))) : ''}. Steps, sleep, resting heart rate and workouts from it appear in Recovery, Training and Correlations.` : 'Not connected. A web app can\'t read Apple Health live; that needs a native iPhone app. What works today: export your Health data on the iPhone and import the file in MacroLens. Steps, sleep, resting heart rate and workouts then show up across Athlete OS.'}</p>
    <div class="cmp" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);margin-top:10px"><span class="h">Metric</span><span class="h">Status</span>
      ${[['Steps', 'Import'], ['Sleep', 'Import or check-in'], ['Heart rate (resting)', 'Import or check-in'], ['HRV', 'Check-in only (not in import yet)'], ['Active energy', 'Import (daily kcal)'], ['Workout duration', 'Import or log here']].map(([m, s]) => `<span>${m}</span><span class="muted">${s}</span>`).join('')}</div>
    <div class="row" style="margin-top:12px">${mlLink('profile', hc ? 'Manage import in MacroLens' : 'Import Apple Health in MacroLens', 'btn sm primary')}</div></section>`;
};
