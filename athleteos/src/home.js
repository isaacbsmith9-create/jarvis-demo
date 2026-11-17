// ===================== HOME: the command center =====================
const ML = (route) => `macrolens.html${route ? '#' + route : ''}`;
const mlLink = (route, label, cls = 'btn sm') => `<a class="${cls}" data-ml href="${ML(route)}">${label}</a>`;
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
const fmtClock = (hhmm) => { if (!hhmm) return ''; const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const addMin = (hhmm, m) => { const [h, mm] = hhmm.split(':').map(Number); const t = (h * 60 + mm + Number(m)) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

RENDER.home = (el) => {
  const p = aos().profile || {}, today = todayIso(), st = streaks();
  const name = p.name || core().profile?.name || '';
  const ng = p.nextGame && p.nextGame >= today ? daysBetween(today, p.nextGame) : null;
  el.innerHTML = `
  <section class="card hero">
    <p class="muted small">${esc(fmtDL(today))}</p>
    <h1>${greeting()}${name ? ', ' + esc(name) : ''}</h1>
    <div class="tagline">
      ${p.position ? `<span class="tag blue">${esc(p.position)}</span>` : ''}
      ${st.current ? `<span class="tag blue">🔥 ${st.current}-day training streak</span>` : ''}
      ${ng != null ? `<span class="tag">${ng === 0 ? 'Game day' : `Next game in ${ng} day${ng === 1 ? '' : 's'}`}</span>` : ''}
      ${!p.name ? `<button type="button" class="tag" data-act="settings" style="border:0;cursor:pointer">Set up your athlete profile ›</button>` : ''}
    </div>
  </section>
  <div class="grid two">
    <section class="card" id="h-today"></section>
    <section class="card" id="h-rec"></section>
  </div>
  <section class="card" id="h-fuel"></section>
  <div class="grid two">
    <section class="card ai" id="h-ai"></section>
    <section class="card" id="h-week"></section>
  </div>
  <div class="grid two">
    <section class="card" id="h-prs"></section>
    <section class="card" id="h-preview"></section>
  </div>`;
  homeToday($('#h-today')); homeRecovery($('#h-rec')); homeFuel($('#h-fuel')); homeAI($('#h-ai')); homeWeek($('#h-week')); homePRs($('#h-prs')); homePreview($('#h-preview'));
};

function homeToday(el) {
  const today = todayIso(), d = dayDoc(today) || {}, pr = d.practice, sch = core().sched, rows = [];
  if (pr?.start) rows.push({ t: pr.start, title: `${pr.type === 'game' ? 'Game' : 'Practice'} · ${fmtDur(Number(pr.mins) || 120)}`, s: `Ends ${fmtClock(addMin(pr.start, Number(pr.mins) || 120))}`, c: 'var(--hb)' });
  if (sch?.on) for (const [k, l] of [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']]) if (sch[k]) rows.push({ t: sch[k], title: l, s: 'Eating schedule', c: 'var(--good)' });
  rows.sort((a, b) => a.t.localeCompare(b.t));
  const done = exList(today);
  el.innerHTML = `<div class="card-head"><div><h3>Today's schedule</h3><span class="sub">${done.length ? `${done.length} workout${done.length > 1 ? 's' : ''} logged · ${fmtDur(trainingOf(today).mins)}` : d.type === 'rest' ? 'Rest day' : 'Nothing logged yet'}</span></div>
    <div class="row"><button type="button" class="btn sm" data-act="plan-practice">Plan practice</button><button type="button" class="btn sm primary" data-act="log-workout">＋ Workout</button></div></div>
    <div class="list">
      ${rows.map((r) => `<div class="li"><div class="row" style="flex-wrap:nowrap"><span class="dot" style="background:${r.c}"></span><div><div class="t">${esc(r.title)}</div><div class="s">${esc(r.s)}</div></div></div><span class="v small">${fmtClock(r.t)}</span></div>`).join('')}
      ${done.map((x) => `<div class="li"><div class="row" style="flex-wrap:nowrap"><span class="dot" style="background:${CATS.find((c) => c[0] === catOf(x.type))[2]}"></span><div><div class="t">✓ ${esc(x.name || 'Workout')}</div><div class="s">${fmtDur(x.mins)} · ${esc(x.int || 'moderate')}${x.source === 'apple-health' ? ' · Apple Health' : ''}</div></div></div><span class="v small">${x.time ? fmtClock(x.time) : ''}</span></div>`).join('')}
    </div>
    ${!rows.length && !done.length ? emptyState('No plan for today yet', 'Plan a practice or game, or turn on the smart eating schedule in MacroLens to see meal times here.', 'calendar', `<div class="row" style="justify-content:center">${mlLink('coach-schedule', 'Eating schedule')}</div>`) : ''}`;
}

function homeRecovery(el) {
  const today = todayIso(), rs = recoveryScore(today), r = recoveryInputs(today);
  const prev = lastNDays(7, shiftIso(today, -1)).map(recoveryScore).filter(Boolean).map((x) => x.score);
  if (!rs) {
    el.innerHTML = `<div class="card-head"><div><h3>Recovery</h3><span class="sub">0-100 score from sleep, energy, soreness and heart rate</span></div></div>
      ${emptyState('Check in to get your score', 'Your score needs at least two of: sleep hours, energy, soreness, resting heart rate or HRV. Nothing is guessed.', 'moon', '<button type="button" class="btn sm primary" data-act="checkin">Morning check-in</button>')}
      ${r.sleepH != null || r.energy != null || r.sore != null ? `<p class="muted small" style="margin-top:8px">Today so far: ${[r.sleepH != null && `${r.sleepH} h sleep`, r.energy != null && `energy ${r.energy}/5`, r.sore != null && `soreness ${r.sore}/5`].filter(Boolean).join(' · ')}</p>` : ''}`;
    return;
  }
  const [cls, lab] = recBand(rs.score), avg = prev.length ? Math.round(mean(prev)) : null;
  el.innerHTML = `<div class="card-head"><div><h3>Recovery</h3><span class="sub">Based on ${rs.parts.map((p) => p[0].toLowerCase()).join(', ')}</span></div><button type="button" class="btn sm" data-act="checkin">Update</button></div>
    <div class="row" style="gap:16px;flex-wrap:nowrap">
      ${ring(rs.score, 100, { size: 112, stroke: 11, color: cls === 'hi' ? 'var(--good)' : cls === 'mid' ? 'var(--warn)' : 'var(--danger)', color2: 'var(--accent)', center: `<b style="font-size:30px">${rs.score}</b><span class="tiny muted">/ 100</span>` })}
      <div class="stack" style="gap:6px;min-width:0">
        <span class="band ${cls}">${lab} recovery</span>
        <span class="small">${recAdvice(rs.score, r)}</span>
        ${avg != null ? `<span class="tiny muted">7-day average ${avg} ${deltaPill(rs.score - avg, false, '')}</span>` : ''}
      </div>
    </div>`;
}
function recAdvice(s, r) {
  if (s >= 70) return 'Good to train hard today.';
  if (s >= 45) return r.sleepH != null && r.sleepH < 7 ? 'Train, but keep the hardest work short. Aim for 8+ hours tonight.' : 'Normal session, watch how your legs feel in warmups.';
  return 'Go lighter today: skill work, mobility, extra sleep and a full dinner.';
}

function homeFuel(el) {
  const today = todayIso(), t = targets(today), n = totalsOf(today), w = waterOf(today);
  const left = Math.max(0, t.calories - n.calories);
  const mac = (k, l, c) => ring(n[k], t[k], { size: 84, stroke: 8, color: c, overWarn: k === 'fat', label: l, sub: `${Math.round(n[k])} / ${t[k]} g · ${Math.max(0, Math.round(t[k] - n[k]))} left`, center: `<b>${Math.round(clamp01(n[k] / t[k]) * 100)}%</b>` });
  el.innerHTML = `<div class="card-head"><div><h3>Fuel today</h3><span class="sub">Live from MacroLens: every meal you log there shows up here</span></div>${mlLink('', 'Open MacroLens ›', 'btn sm primary')}</div>
    <div class="grid two" style="align-items:center">
      <div class="row" style="gap:16px;flex-wrap:nowrap;justify-content:center">
        ${ring(n.calories, t.calories, { size: 150, stroke: 13, color: 'var(--accent)', color2: 'var(--purple)', overWarn: true, center: `<b style="font-size:30px">${left.toLocaleString()}</b><span class="tiny muted">kcal left</span>` })}
        <div class="stack" style="gap:4px"><span class="muted small">Goal</span><b class="num">${t.calories.toLocaleString()}</b><span class="muted small">Eaten</span><b class="num">${n.calories.toLocaleString()}</b>${exerciseKcal(today) ? `<span class="tiny muted">Includes ${exerciseKcal(today).toLocaleString()} kcal for logged training</span>` : ''}</div>
      </div>
      <div class="rings">${mac('protein', 'Protein', 'var(--protein)')}${mac('carbs', 'Carbs', 'var(--carbs)')}${mac('fat', 'Fat', 'var(--fat)')}</div>
    </div>
    <div class="hr"></div>
    <div class="row" style="gap:14px;flex-wrap:nowrap">
      ${ring(w, t.waterOz, { size: 78, stroke: 8, color: 'var(--water)', center: `<b>${w}</b><span class="tiny muted">oz</span>` })}
      <div class="stack" style="gap:8px;min-width:0;flex:1">
        <div class="row-between"><b>Hydration</b><span class="muted small num">${w} / ${t.waterOz} oz · ${pctTxt(t.waterOz ? w / t.waterOz : 0)}</span></div>
        <div class="chips"><button type="button" class="chip" data-water="8">+8 oz</button><button type="button" class="chip" data-water="16">+16 oz</button><button type="button" class="chip" data-water="24">+24 oz</button><button type="button" class="chip" data-water="-8" aria-label="Remove 8 oz">−8</button></div>
      </div>
    </div>
    ${!hasFood(today) ? `<p class="notice" style="margin-top:12px">No food logged today yet. Snap or search a meal in MacroLens and these rings fill in.</p>` : ''}`;
}

function homeWeek(el) {
  const s = streaks(), mon = mondayOf(todayIso()), w = weekStats(mon), goal = Number(aos().profile?.weeklyDays) || 5;
  el.innerHTML = `<div class="card-head"><div><h3>Training consistency</h3><span class="sub">Last 8 weeks · tap a day</span></div><button type="button" class="btn sm" data-go="analytics-training">Details</button></div>
    ${heatmap(8, activityLevel, null, (d) => (isActive(d) ? `${trainingOf(d).sessions} session(s), ${fmtDur(trainingOf(d).mins)}` : 'no training logged'))}
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><small>This week</small><b>${w.active}/${goal}</b><span class="tiny muted">active days (${pctTxt(clamp01(w.active / goal))})</span></div>
      <div class="kpi"><small>Streak</small><b>${s.current}</b><span class="tiny muted">days · best ${s.longest}</span></div>
    </div>`;
}

function homePRs(el) {
  const prs = allPRs().slice(0, 4);
  const recent = (doc('aos-tests').results || []).length;
  el.innerHTML = `<div class="card-head"><div><h3>Latest personal records</h3><span class="sub">${recent} test result${recent === 1 ? '' : 's'} logged</span></div><button type="button" class="btn sm primary" data-act="add-test">＋ Result</button></div>
    ${prs.length ? `<div class="list">${prs.map(({ t, r, prev }) => `<button type="button" class="li li-btn" data-go="tests" data-test="${t.id}"><div><div class="t">🏆 ${esc(t.name)}</div><div class="s">${esc(fmtD(r.date))} · was ${esc(fmtVal(t, prev))}</div></div><div style="text-align:right"><div class="v">${esc(fmtVal(t, r.value))}</div>${deltaPill(improvePct(t, prev, r.value))}</div></button>`).join('')}</div>`
      : emptyState('No PRs yet', 'Log a vertical, sprint, lift or shooting test. Beat it later and it shows up here.', 'trophy')}`;
}

function homePreview(el) {
  const days = lastNDays(28), cards = [];
  const wk = []; for (let i = 7; i >= 0; i--) { const m = shiftIso(mondayOf(todayIso()), -7 * i); wk.push(sum(lastNDays(7, shiftIso(m, 6)).map((d) => trainingOf(d).mins)) / 60); }
  if (wk.some((x) => x > 0)) cards.push(['Training hours / week', r1(wk[wk.length - 1]) + ' h', spark(wk), 'analytics-training']);
  const ss = shotSessions().filter((s) => sessionTotals(s).a >= 10).slice(-12).map((s) => sessionTotals(s).pct * 100);
  if (ss.length >= 2) cards.push(['Shooting % by session', Math.round(ss[ss.length - 1]) + '%', spark(ss, 'var(--good)'), 'hoops-categories']);
  const v = resultsOf('vert'); if (v.length >= 2) cards.push(['Vertical jump', fmtVal(testById('vert'), v[v.length - 1].value), spark(v.map((x) => x.value), 'var(--purple)'), 'analytics-performance']);
  const wt = bodySeries('weight').slice(-12); if (wt.length >= 2) cards.push(['Body weight', wt[wt.length - 1].v + ' lb', spark(wt.map((x) => x.v), 'var(--carbs)'), 'analytics-body']);
  const kc = days.filter(hasFood).slice(-14).map((d) => totalsOf(d).protein); if (kc.length >= 2) cards.push(['Protein per day', Math.round(kc[kc.length - 1]) + ' g', spark(kc, 'var(--protein)'), 'analytics-nutrition']);
  el.innerHTML = `<div class="card-head"><div><h3>Performance analytics</h3><span class="sub">Trends from your real logs</span></div><button type="button" class="btn sm" data-go="analytics">All analytics</button></div>
    ${cards.length ? `<div class="list">${cards.slice(0, 4).map(([t, v, s, g]) => `<button type="button" class="li li-btn" data-go="${g}"><div><div class="s">${esc(t)}</div><div class="v" style="font-size:20px">${esc(v)}</div></div>${s}</button>`).join('')}</div>`
      : emptyState('Trends appear as you log', 'Log workouts, shooting sessions, tests and meals. Each trend needs at least two entries.', 'chart')}`;
}

// Delegated actions used across screens
document.addEventListener('click', (e) => {
  const w = e.target.closest('[data-water]');
  if (w) { addWater(Number(w.dataset.water)); toast(Number(w.dataset.water) > 0 ? `+${w.dataset.water} oz water (also in MacroLens)` : 'Removed 8 oz'); return refresh(); }
  const t = e.target.closest('[data-test]'); if (t) { setUi('test', t.dataset.test); }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, fn = ACTIONS[act];
  if (fn) { e.preventDefault(); fn(a); }
});
const ACTIONS = {};
