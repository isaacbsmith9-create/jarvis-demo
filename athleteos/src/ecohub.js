// ===================== HUB: the ecosystem app (hub.html) =====================
// Its own app in the switcher. It owns no data: it reads every app's records (and the event stream in events.js),
// opens each app, organizes the day across all of them, and charts everything side by side.
// index.html (the artifact's front page) = this bundle with window.APP_MODE = 'hub' (like School).
VIEWS.splice(VIEWS.length - 1, 0, ['hub', 'Hub', 'grid', true]);
SUBS.hub = [['today', 'Today'], ['graphs', 'Graphs'], ['timeline', 'Timeline']];
const HUB = {};
RENDER.hub = (el, sub) => (HUB[sub] || HUB.today)(el);
if (window.APP_MODE === 'hub') {
  for (const v of VIEWS) v[3] = v[0] !== 'hub';
  if (!location.hash.startsWith('#hub')) history.replaceState(null, '', '#hub');
  document.documentElement.classList.add('mode-hub');
}
const hubIn = (n, end = todayIso()) => { const a = []; for (let i = n - 1; i >= 0; i--) a.push(shiftIso(end, -i)); return a; };
const hubPct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const hubSafe = (fn, fb = null) => { try { return fn(); } catch (e) { console.error(e); return fb; } };
const hubMind = (d) => hubSafe(() => mentalScore(d));
const hubSleep = (d) => hubSafe(() => recoveryInputs(d).sleepH ?? null);
const hubBlocks = (d) => hubSafe(() => gpBlocks(d), []) || [];
const btcOn = (d) => (doc('day-' + d)?.exercise || []).filter((w) => w.source === 'training-center' || (w.source === 'hub' && w.btc));

// ---------- launcher: each app with a live number ----------
function hubApps() {
  const t = todayIso(), wk = hubIn(7), T = totalsOf(t), G = targets(t), bl = hubBlocks(t).filter((b) => b.type !== 'sleep');
  const rd = hubSafe(() => readiness(t)?.score), tr = trainingOf(t).mins, st = streaks();
  const S = doc('life-school'), due = S ? scDue(t, shiftIso(t, 6)).length : 0, od = S ? scOverdue().length : 0, g = S ? hubSafe(() => gpa()) : null;
  const btcWk = sum(wk.map((d) => btcOn(d).length)), btcMin = sum(wk.flatMap((d) => btcOn(d).map((w) => w.mins || 0)));
  const fed = hasFood(t);
  return [
    { id: 'aos', href: 'athlete.html', icon: 'logo', big: rd ?? '—', unit: rd != null ? 'readiness' : 'no check-in', line: `${tr} min trained today · ${st.current}-day streak`, pct: rd },
    (() => { const R = doc('rl-ready')?.days?.[t] || null, sl = doc('rl-sleep')?.nights?.[t]; return { id: 'rl', href: 'recovery.html', icon: 'heart', big: R?.score ?? '—', unit: R?.score != null ? 'recovery readiness' : 'not enough data', line: `${R ? Math.round((R.completeness || 0) * 100) + '% of inputs' : 'Do the morning check-in'}${sl?.asleepH ? ` · slept ${nf(sl.asleepH, 1)} h` : ''}`, pct: R?.score ?? null }; })(),
    { id: 'gp', href: 'gameplan.html', icon: 'calendar', big: bl.length ? `${bl.filter((b) => b.done).length}/${bl.length}` : '—', unit: 'blocks done', line: bl.length ? (() => { const n = nowM(), nx = bl.find((b) => !b.done && b.st + b.mins > n); return nx ? `Next: ${nx.title} at ${tdClock(nx.st)}` : 'All blocks done'; })() : 'No blocks planned today', pct: bl.length ? hubPct(bl.filter((b) => b.done).length, bl.length) : null },
    { id: 'school', href: 'student.html', icon: 'book', big: due, unit: 'due this week', line: `${od} overdue${g != null ? ` · GPA ${g}` : ''}`, pct: due + od ? hubPct(due, due + od) : null },
    { id: 'btc', href: 'btc.html', icon: 'dumbbell', big: btcWk, unit: 'sessions this week', line: btcMin ? `${btcMin} min of drills` : 'Run a session to see it here', pct: hubPct(Math.min(btcWk, 5), 5) },
    { id: 'ml', href: 'macrolens.html', icon: 'fork', big: fed ? Math.round(T.calories).toLocaleString() : '—', unit: fed ? `of ${G.calories.toLocaleString()} kcal` : 'nothing logged', line: fed ? `${Math.round(T.protein)} / ${G.protein} g protein` : 'Log a meal to start the day', pct: fed ? Math.min(100, hubPct(T.calories, G.calories)) : null },
  ];
}
function hubLauncher() {
  return `<div class="hub-apps">${hubApps().map((a) => { const A = EV_APPS[a.id]; return `<a class="hub-app" href="${a.href}" data-hub-open="${a.href}" style="--c:${A.color}">
    <span class="hub-app-h"><span class="hub-app-ic" aria-hidden="true">${ICONS[a.icon] || ICONS.grid}</span><b>${A.name}</b><span class="hub-go" aria-hidden="true">↗</span></span>
    <span class="hub-app-n"><b>${a.big}</b><small>${a.unit}</small></span>
    <span class="hub-app-bar"><i style="width:${a.pct ?? 0}%"></i></span>
    <span class="hub-app-l">${esc(a.line)}</span></a>`; }).join('')}</div>`;
}

// ---------- organized: one agenda + what needs attention ----------
function hubAgenda() {
  const t = todayIso(), n = nowM(), its = hubSafe(() => tdItems(t), []) || [];
  const S = doc('life-school'), dueT = S ? scDue(t, t) : [];
  const rows = its.map((x) => ({ st: x.st, end: x.st + (x.mins || 30), title: x.title, src: x.src, done: x.done, color: x.color, app: x.src === 'Gameplan' ? 'gp' : 'aos' }));
  const html = rows.length ? `<ol class="hub-ag">${rows.map((r) => `<li class="${r.done ? 'done' : ''}${!r.done && r.st <= n && r.end > n ? ' now' : ''}${!r.done && r.end <= n ? ' past' : ''}" style="--c:${r.color};--a:${EV_APPS[r.app].color}">
      <span class="hub-ag-t">${tdClock(r.st)}</span><span class="hub-ag-b"><b>${esc(r.title)}</b><small>${tdClock(r.end)} · ${esc(r.src)}${r.done ? ' · done' : ''}</small></span></li>`).join('')}</ol>`
    : `<p class="small muted" style="margin:4px 0 0">Nothing on the clock today. Plan your day in Gameplan and it lines up here.</p>`;
  return `${html}${dueT.length ? `<div class="hub-due"><b>Due today</b>${dueT.map((x) => `<span style="--c:${scClass(x.cls)?.color || EV_APPS.school.color}">${esc(x.title)}</span>`).join('')}</div>` : ''}`;
}
function hubAttention() {
  const t = todayIso(), h = new Date().getHours(), out = [];
  const S = doc('life-school');
  if (S) {
    for (const x of scOverdue().slice(0, 3)) { const lp = scClass(x.cls)?.latePolicy; out.push({ app: 'school', lvl: lp === 'full' ? 'watch' : 'act', t: `Overdue: ${x.title}`, s: `was due ${fmtD(x.due)}${lp === 'full' ? ' · late still gets full credit' : lp === 'none' ? ' · no late work in this class' : ''}`, href: 'student.html' }); }
    for (const x of scDue(shiftIso(t, 1), shiftIso(t, 3)).filter((x) => ['test', 'exam', 'quiz', 'project'].includes(x.type))) out.push({ app: 'school', lvl: 'watch', t: `${x.type[0].toUpperCase() + x.type.slice(1)} ${evWhen(x.due).toLowerCase() === 'tomorrow' ? 'tomorrow' : 'on ' + fmtDL(x.due)}: ${x.title}`, s: 'Plan study time and a lighter session the night before', href: 'gameplan.html' });
    const e = hubSafe(() => eligibility()); if (e && (e.flag === 'act' || e.flag === 'watch')) out.push({ app: 'school', lvl: e.flag, t: 'Grades to watch for eligibility', s: (e.low || []).map((c) => c.name || c).join(', '), href: 'student.html' });
  }
  if (!mcheck(t) && !doc('rl-check')?.days?.[t] && h >= 7) out.push({ app: 'aos', lvl: 'info', t: 'No mental check-in yet', s: '30 seconds in Athlete OS › Mind', href: 'athlete.html#mind-checkin' });
  if (hubSleep(t) == null && !doc('rl-check')?.days?.[t] && h >= 7) out.push({ app: 'rl', lvl: 'info', t: 'No morning check-in yet', s: 'Sleep, feel and soreness in Recovery Lens, 30 seconds', href: 'recovery.html' });
  const pain = (doc('rl-body')?.records || []).filter((r) => r.date >= shiftIso(t, -2) && (r.kind === 'pain' || r.kind === 'injury'));
  if (pain.length) out.push({ app: 'rl', lvl: 'act', t: `Pain flagged: ${[...new Set(pain.map((r) => r.area))].join(', ')}`, s: 'Get it checked by your athletic trainer before training through it', href: 'recovery.html' });
  const T = totalsOf(t), G = targets(t);
  if (h >= 17 && T.protein < G.protein * 0.6) out.push({ app: 'ml', lvl: 'watch', t: `Protein at ${Math.round(T.protein)} of ${G.protein} g`, s: 'A protein-heavy dinner closes the gap', href: 'macrolens.html' });
  const sig = doc('aos-signals'); if (sig?.acwr > 1.3) out.push({ app: 'aos', lvl: 'watch', t: `Training load ratio ${sig.acwr}`, s: 'Load is rising fast. Keep today lighter.', href: 'athlete.html#train-load' });
  const tasks = (doc('gp-core')?.tasks || []).filter((x) => !x.done);
  if (tasks.length) out.push({ app: 'gp', lvl: 'info', t: `${tasks.length} open task${tasks.length > 1 ? 's' : ''} in Gameplan`, s: tasks.slice(0, 2).map((x) => x.title).join(' · '), href: 'gameplan.html' });
  const order = { act: 0, watch: 1, info: 2 };
  return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
}

// ---------- Today ----------
HUB.today = (el) => {
  const t = todayIso(), att = hubAttention(), wk = evStream(shiftIso(t, -6)), tod = evStream(t);
  const hr = new Date().getHours(), name = aos().profile?.name;
  el.innerHTML = `<section class="hub-head"><p class="tiny muted">${fmtDL(t)}</p><h1>${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}${name ? ', ' + esc(name) : ''}</h1>
      <p class="hub-sum">${tod.length} things logged today across ${new Set(tod.map((e) => e.app)).size} apps · ${att.length ? `${att.length} need${att.length === 1 ? 's' : ''} attention` : 'nothing needs attention'}</p></section>
    <section aria-label="Your apps">${hubLauncher()}</section>
    <div class="grid two">
      <section class="card"><div class="card-head"><div><h3>Your day</h3><span class="sub">Calendar and Gameplan in one schedule</span></div><a class="btn sm" data-hub-open="gameplan.html" href="gameplan.html">Plan</a></div>${hubAgenda()}</section>
      <section class="card"><div class="card-head"><div><h3>Needs attention</h3><span class="sub">From every app, most urgent first</span></div></div>
        ${att.length ? `<ul class="hub-att">${att.map((a) => `<li class="${a.lvl}" style="--c:${EV_APPS[a.app].color}"><span class="hub-att-d"></span><span class="hub-att-b"><b>${esc(a.t)}</b>${a.s ? `<small>${esc(a.s)}</small>` : ''}</span><a class="btn sm" data-hub-open="${a.href}" href="${a.href}">${EV_APPS[a.app].name.split(' ')[0]}</a></li>`).join('')}</ul>` : `<p class="small muted" style="margin:4px 0 0">You're caught up everywhere.</p>`}</section>
    </div>
    <section class="card"><div class="card-head"><div><h3>This week across your apps</h3><span class="sub">${wk.length} events · last 7 days</span></div><button type="button" class="btn sm" data-go="hub-graphs">All graphs</button></div>
      ${hubKpis()}<div class="chart" id="hub-act"></div></section>
    <section class="card"><div class="card-head"><div><h3>Latest</h3><span class="sub">Newest activity from every app</span></div><button type="button" class="btn sm" data-go="hub-timeline">Timeline</button></div>
      ${tod.length || wk.length ? `<ul class="ev-list">${(tod.length ? tod : wk).slice(0, 6).map(evRow).join('')}</ul>` : emptyState('Nothing logged yet', 'Log a meal, finish a session or check off a block. It shows up here.', 'calendar')}</section>`;
  hubActivity($('#hub-act', el), 7);
};
function hubKpis() {
  const wk = hubIn(7), tm = sum(wk.map((d) => trainingOf(d).mins)), sl = wk.map(hubSleep).filter((x) => x != null), md = wk.map(hubMind).filter((x) => x != null);
  const pd = wk.filter((d) => hasFood(d) && totalsOf(d).protein >= targets(d).protein * 0.9).length;
  const bl = wk.flatMap((d) => hubBlocks(d).filter((b) => b.type !== 'sleep' && b.st + b.mins <= (d === todayIso() ? nowM() : 1e9)));
  return `<div class="hub-kpis">
    <div style="--c:${EV_APPS.aos.color}"><small>Training</small><b>${Math.round(tm / 6) / 10}<i>h</i></b><span>${wk.filter(isActive).length} active days</span></div>
    <div style="--c:#8b5cff"><small>Sleep</small><b>${sl.length ? nf(mean(sl), 1) : '—'}<i>h</i></b><span>avg per night</span></div>
    <div style="--c:${EV_APPS.ml.color}"><small>Protein goal</small><b>${pd}<i>/7</i></b><span>days hit</span></div>
    <div style="--c:${EV_APPS.gp.color}"><small>Plan kept</small><b>${bl.length ? hubPct(bl.filter((b) => b.done).length, bl.length) : '—'}<i>${bl.length ? '%' : ''}</i></b><span>blocks done</span></div>
    <div style="--c:#e879f9"><small>Mind</small><b>${md.length ? Math.round(mean(md)) : '—'}</b><span>avg mental score</span></div>
  </div>`;
}
function hubActivity(el, n) {
  const days = hubIn(n), ev = evStream(days[0]);
  drawBars(el, days.map((d, i) => ({ label: n <= 7 ? DOW[parseIso(d).getDay()] : i % Math.ceil(n / 7) === 0 ? fmtD(d) : '', tip: fmtDL(d), segs: Object.entries(EV_APPS).map(([k, A]) => ({ v: ev.filter((e) => e.date === d && e.app === k).length, color: A.color, name: A.name })) })), { h: 150, fmt: (v) => String(Math.round(v)) });
}

// ---------- Graphs ----------
function hubBalance(end) {
  const wk = hubIn(7, end), wd = Number(aos().profile?.weeklyDays) || 5;
  const sl = wk.map(hubSleep).filter((x) => x != null), md = wk.map(hubMind).filter((x) => x != null);
  const fed = wk.filter(hasFood), bl = wk.flatMap((d) => hubBlocks(d).filter((b) => b.type !== 'sleep'));
  const S = doc('life-school'), due = S ? S.items.filter((x) => x.due >= wk[0] && x.due <= end) : [];
  return [
    { label: 'Training', v: Math.min(100, hubPct(wk.filter(isActive).length, wd)) },
    { label: 'Sleep', v: sl.length ? Math.min(100, Math.round((mean(sl) / 8) * 100)) : null },
    { label: 'Nutrition', v: fed.length ? Math.round(mean(fed.map((d) => Math.min(1, totalsOf(d).protein / (targets(d).protein || 1)))) * 100) : null },
    { label: 'Mind', v: md.length ? Math.round(mean(md)) : null },
    { label: 'School', v: due.length ? hubPct(due.filter((x) => x.done || x.due >= todayIso()).length, due.length) : null },
    { label: 'Planning', v: bl.length ? hubPct(bl.filter((b) => b.done).length, bl.length) : null },
  ];
}
HUB.graphs = (el) => {
  const r = ui('hubRange', '30'), n = Number(r), days = hubIn(n), from = days[0], t = todayIso();
  const now = hubBalance(t), prev = hubBalance(shiftIso(t, -7)), items = now.map((x, i) => ({ ...x, v2: prev[i].v ?? 0 }));
  const ev = evStream(from), cnt = evCountBy(ev);
  const S = doc('life-school'), classes = S?.classes || [];
  el.innerHTML = `<section class="hub-head"><h1>Graphs</h1><p class="hub-sum">Every app side by side · ${ev.length} events in ${n} days</p><div style="margin-top:10px">${seg('hubRange', [['14', '14D'], ['30', '30D'], ['60', '60D']], r)}</div></section>
    <div class="grid two">
      <section class="card"><div class="card-head"><div><h3>Life balance</h3><span class="sub">This week (solid) vs last week (dashed), 0–100</span></div></div>${radar(items, { size: 240, compare: true, label: 'Life balance' })}
        <div class="list">${now.map((x, i) => `<div class="li"><span class="small">${x.label}</span><span class="small"><b>${x.v ?? '—'}</b> <span class="tiny ${x.v != null && prev[i].v != null ? (x.v >= prev[i].v ? 'up' : 'down') : 'muted'}">${x.v != null && prev[i].v != null ? (x.v >= prev[i].v ? '+' : '') + (x.v - prev[i].v) : ''}</span></span></div>`).join('')}</div></section>
      <section class="card"><div class="card-head"><div><h3>Where your time goes</h3><span class="sub">Share of everything logged, by app</span></div></div>${donut(Object.entries(EV_APPS).map(([k, A]) => ({ label: A.name, v: cnt[k], color: A.color })), { size: 150, fmt: (v) => `${v}`, label: 'Events by app' })}
        <h4 class="hub-h4">App pulse</h4><div class="hub-pulse" style="--n:${Math.min(n, 30)}">${Object.entries(EV_APPS).map(([k, A]) => `<span class="hub-pulse-l">${A.name.split(' ')[0]}</span>${days.slice(-30).map((d) => { const c = ev.filter((e) => e.app === k && e.date === d).length; return `<i style="--c:${A.color};--o:${c ? Math.min(1, 0.3 + c * 0.2) : 0}" title="${A.name} · ${fmtD(d)}: ${c}"></i>`; }).join('')}`).join('')}</div><p class="tiny muted" style="margin:6px 0 0">Each square is a day (last ${Math.min(n, 30)}). Darker = more logged.</p></section>
    </div>
    <section class="card"><div class="card-head"><div><h3>Activity by app</h3><span class="sub">Events per day, stacked by app</span></div></div><div class="chart" id="hg-act"></div></section>
    <div class="grid two">
      <section class="card"><div class="card-head"><div><h3>Training minutes</h3><span class="sub">Athlete OS + Training Center sessions</span></div></div><div class="chart" id="hg-train"></div></section>
      <section class="card"><div class="card-head"><div><h3>Nutrition vs goals</h3><span class="sub">MacroLens · % of daily target</span></div></div><div class="chart" id="hg-fuel"></div></section>
      <section class="card"><div class="card-head"><div><h3>Sleep and readiness</h3><span class="sub">Hours slept · readiness from Athlete OS and Recovery Lens</span></div></div><div class="chart" id="hg-sleep"></div><div class="chart" id="hg-ready"></div></section>
      <section class="card"><div class="card-head"><div><h3>Mental score</h3><span class="sub">Daily check-ins, 0–100</span></div></div><div class="chart" id="hg-mind"></div></section>
      <section class="card"><div class="card-head"><div><h3>How your days are planned</h3><span class="sub">Gameplan hours per day by type</span></div></div><div class="chart" id="hg-plan"></div></section>
      <section class="card"><div class="card-head"><div><h3>School</h3><span class="sub">${classes.length ? `Current grade by class${hubSafe(() => gpa()) != null ? ` · GPA ${gpa()}` : ''}` : 'Add classes in Student Lens to see grades'}</span></div></div><div class="chart" id="hg-school"></div><div class="chart" id="hg-gpa"></div></section>
    </div>`;
  const opt = { from, to: t, h: 170 };
  hubActivity($('#hg-act', el), n);
  // Training: stacked by source
  drawBars($('#hg-train', el), days.map((d, i) => { const ex = doc('day-' + d)?.exercise || []; return { label: i % Math.ceil(n / 6) === 0 ? fmtD(d) : '', tip: fmtDL(d), segs: [{ v: sum(ex.filter((w) => w.source !== 'training-center').map((w) => w.mins || 0)), color: EV_APPS.aos.color, name: 'Athlete OS' }, { v: sum(ex.filter((w) => w.source === 'training-center').map((w) => w.mins || 0)), color: EV_APPS.btc.color, name: 'Training Center' }] }; }), { h: 170, fmt: (v) => `${Math.round(v)} min` });
  const fed = days.filter(hasFood);
  drawMulti($('#hg-fuel', el), [
    { name: 'Calories', color: EV_APPS.ml.color, pts: fed.map((d) => ({ date: d, v: hubPct(totalsOf(d).calories, targets(d).calories) })) },
    { name: 'Protein', color: 'var(--protein)', pts: fed.map((d) => ({ date: d, v: hubPct(totalsOf(d).protein, targets(d).protein) })) },
  ], { ...opt, yMin: 0, fmt: (v) => `${Math.round(v)}%` });
  drawLine($('#hg-sleep', el), days.map((d) => ({ date: d, v: hubSleep(d) })).filter((p) => p.v != null), { ...opt, h: 130, color: '#8b5cff', fmt: (v) => `${nf(v, 1)} h` });
  const RR = doc('rl-ready')?.days || {};
  drawMulti($('#hg-ready', el), [{ name: 'Athlete OS readiness', color: 'var(--good)', pts: days.map((d) => ({ date: d, v: hubSafe(() => readiness(d)?.score) })).filter((p) => p.v != null) }, { name: 'Recovery Lens readiness', color: EV_APPS.rl.color, pts: days.map((d) => ({ date: d, v: RR[d]?.score ?? null })).filter((p) => p.v != null) }], { ...opt, h: 150, yMin: 0, yMax: 100, fmt: (v) => String(Math.round(v)) });
  drawLine($('#hg-mind', el), days.map((d) => ({ date: d, v: hubMind(d) })).filter((p) => p.v != null), { ...opt, color: '#e879f9', yMin: 0, yMax: 100, fmt: (v) => String(Math.round(v)) });
  const pd = days.slice(-14), types = [...new Set(pd.flatMap((d) => hubBlocks(d).map((b) => b.type)))].filter((x) => x !== 'sleep');
  drawBars($('#hg-plan', el), pd.map((d, i) => ({ label: i % 2 === 0 ? fmtD(d) : '', tip: fmtDL(d), segs: types.map((ty) => ({ v: sum(hubBlocks(d).filter((b) => b.type === ty).map((b) => b.mins || 0)) / 60, color: gpType(ty)[1], name: gpType(ty)[0] })) })), { h: 170, fmt: (v) => `${nf(v, 1)} h` });
  if (classes.length) {
    drawBars($('#hg-school', el), classes.map((c) => ({ label: c.name.slice(0, 8), tip: c.name, segs: [{ v: hubSafe(() => classPct(c)) ?? 0, color: c.color || EV_APPS.school.color, name: c.name }] })), { h: 160, goal: 90, fmt: (v) => `${Math.round(v)}%` });
    const sn = Object.entries(S.snaps || {}).sort().map(([d, v]) => ({ date: d, v }));
    if (sn.length > 1) drawLine($('#hg-gpa', el), sn, { h: 120, color: EV_APPS.school.color, fmt: (v) => nf(v, 2) });
  } else $('#hg-school', el).innerHTML = emptyState('No classes yet', 'Add your classes and grades in Student Lens.', 'chart', '<a class="btn sm primary" href="student.html" data-hub-open="student.html">Open Student Lens</a>');
  for (const id of ['hg-fuel', 'hg-sleep', 'hg-ready', 'hg-mind']) { const c = $('#' + id, el); if (c && !c.innerHTML.trim()) c.innerHTML = '<p class="small muted">Not enough data in this range yet.</p>'; }
};
HUB.timeline = (el) => INTEL.timeline(el);

// Open another app after saving
document.addEventListener('click', (e) => { const a = e.target.closest('[data-hub-open]'); if (!a) return; e.preventDefault(); goTo(a.dataset.hubOpen); });
