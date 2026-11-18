// ===================== DEVELOPMENT HUB + cross-system wiring =====================
// One overview over the five systems: training consistency, workload, mental performance, routines, goals, calendar adherence.
function weekVals(m) {
  const days = lastNDays(7, shiftIso(m, 6)).filter((d) => d <= todayIso()), target = Number(aos().profile?.weeklyDays) || 5;
  const ment = days.map(mentalScore).filter((x) => x != null), rt = days.map(routineDayPct).filter((x) => x != null), ad = adherence(days);
  const gp = goals().map((g) => goalPctAt(g, days[days.length - 1] || m)).filter((x) => x != null);
  return { m, cons: Math.round(clamp(days.filter(isActive).length / Math.min(target, Math.max(1, days.length * target / 7)), 0, 1) * 100), load: sum(days.map(loadOf)), mental: ment.length ? Math.round(mean(ment)) : null, routine: rt.length ? Math.round(mean(rt) * 100) : null, adher: ad.pct == null ? null : Math.round(ad.pct * 100), goals: gp.length ? Math.round(mean(gp)) : null };
}
TRAIN.overview = (el) => {
  const mon = mondayOf(todayIso()), W = []; for (let i = 11; i >= 0; i--) W.push(weekVals(shiftIso(mon, -7 * i)));
  const cur = W[W.length - 1], prev = W[W.length - 2], peak = Math.max(1, ...W.map((w) => w.load));
  const m7 = lastNDays(7).map(mentalScore).filter((x) => x != null), r7 = lastNDays(7).map(routineDayPct).filter((x) => x != null), a7 = adherence(lastNDays(7));
  const act = goals().map((g) => goalState(g)).filter((s) => s.status !== 'done');
  const tiles = [
    ['Training consistency', trainingConsistencyScore(), '/100', W.map((w) => w.cons), 'var(--accent)', 'train-load', 'active days + plan adherence (28 d)'],
    ['Workload', cur.load.toLocaleString(), ' load', W.map((w) => w.load), 'var(--over)', 'train-load', prev.load ? `${cur.load >= prev.load ? '+' : ''}${Math.round(pctChange(cur.load, prev.load))}% vs last week` : 'this week'],
    ['Mental readiness', m7.length ? Math.round(mean(m7)) : '—', m7.length ? '/100' : '', W.map((w) => w.mental).filter((x) => x != null), 'var(--purple)', 'mind-trends', `${m7.length} check-ins (7 d)`],
    ['Routine completion', r7.length ? Math.round(mean(r7) * 100) + '%' : '—', '', W.map((w) => w.routine).filter((x) => x != null), '#f472b6', 'train-routines', 'scheduled steps done (7 d)'],
    ['Goal progress', act.length ? Math.round(mean(act.map((s) => s.pct))) + '%' : '—', '', W.map((w) => w.goals).filter((x) => x != null), 'var(--good)', 'train-goals', `${act.length} active goal${act.length === 1 ? '' : 's'}`],
    ['Calendar adherence', a7.pct == null ? '—' : pctTxt(a7.pct), '', W.map((w) => w.adher).filter((x) => x != null), 'var(--warn)', 'train-plan', a7.sched ? `${a7.done}/${a7.sched} done · ${a7.missed} missed (7 d)` : 'nothing scheduled'],
  ];
  const today = todayIso(), its = itemsOn(today), rts = routinesOn(today), mc = mcheck(today);
  el.innerHTML = `<section class="card hero"><p class="muted small">Athlete development overview</p><h1>How you're building</h1><p class="small muted" style="margin-top:4px">Training, workload, mental performance, routines, goals and your calendar in one view.</p>
    <div class="hub-tiles">${tiles.map(([l, v, u, sp, c, g, sub]) => `<button type="button" class="hub-tile" data-go="${g}" style="--c:${c}"><small>${l}</small><b>${esc(String(v))}<span class="tiny muted">${u}</span></b>${sp.length >= 2 ? spark(sp, c, 120, 30) : '<span class="tiny muted">trend builds weekly</span>'}<span class="tiny muted">${esc(sub)}</span></button>`).join('')}</div></section>
  <div class="grid two"><section class="card"><div class="card-head"><div><h3>Today</h3><span class="sub">${esc(fmtDL(today))}</span></div><button type="button" class="btn sm" data-go="train-plan">Calendar</button></div>
      <div class="list">
        <div class="li"><span class="small">🧠 Mental check-in</span>${mc ? `<span class="band hi">Done · ${mentalScore(today) ?? '—'}</span>` : '<button type="button" class="chip" data-go="mind-checkin">Check in</button>'}</div>
        <div class="li"><span class="small">💤 Recovery check-in</span>${recoveryInputs(today).sleepH != null || dayDoc(today)?.feel ? '<span class="band hi">Done</span>' : '<button type="button" class="chip" data-act="checkin">Check in</button>'}</div>
        ${rts.map((r) => `<div class="li"><span class="small">🔁 ${esc(r.name)} <span class="tiny muted">${stepsDone(today, r)}/${r.steps.length}</span></span>${routineComplete(today, r.id) ? '<span class="band hi">Done</span>' : `<button type="button" class="chip" data-act="run-routine" data-id="${r.id}" data-date="${today}">▶ Start</button>`}</div>`).join('')}
        ${its.filter((x) => x.type !== 'routine').map((x) => `<div class="li"><span class="small"><i class="dot" style="background:${evType(x.type)[2]};margin-right:6px"></i>${esc(x.title)} <span class="tiny muted">${x.time ? fmtClock(x.time) : ''}</span></span>${isChecked(today, x.key) ? '<span class="band hi">Done</span>' : '<span class="tiny muted">scheduled</span>'}</div>`).join('')}
        <div class="li"><span class="small">🏋️ Training logged</span><span class="tiny ${isActive(today) ? 'up' : 'muted'}">${isActive(today) ? `${exList(today).length} session(s) · load ${loadOf(today)}` : 'none yet'}</span></div>
      </div></section>
    <section class="card"><div class="card-head"><div><h3>What stands out</h3><span class="sub">From the last two weeks</span></div></div>${insights(W)}</section></div>
  <section class="card"><div class="card-head"><div><h3>All systems, week by week</h3><span class="sub">0-100 scale · workload shown as % of your biggest week</span></div></div><div class="chart" id="hub-multi"></div></section>
  <section class="card"><div class="card-head"><div><h3>Habit consistency</h3><span class="sub">A day counts when you trained, checked in, or completed a routine · 16 weeks</span></div></div>${heatmap(16, (d) => { const n = [isActive(d), !!mcheck(d), !!dayDoc(d)?.feel, (routineDayPct(d) || 0) >= 0.99].filter(Boolean).length; return n; }, null, (d) => [isActive(d) && 'trained', mcheck(d) && 'mental check-in', dayDoc(d)?.feel && 'recovery check-in', (routineDayPct(d) || 0) >= 0.99 && 'routines done'].filter(Boolean).join(', ') || 'nothing logged')}<p class="muted tiny" style="margin-top:6px">Brighter = more of the four habits done that day.</p></section>`;
  drawMulti($('#hub-multi'), [
    { name: 'Training consistency', color: 'var(--accent)', pts: W.map((w) => ({ date: w.m, v: w.cons })) },
    { name: 'Workload', color: 'var(--over)', dash: true, pts: W.map((w) => ({ date: w.m, v: Math.round((w.load / peak) * 100), tip: `${w.load.toLocaleString()} load` })) },
    { name: 'Mental readiness', color: 'var(--purple)', pts: W.filter((w) => w.mental != null).map((w) => ({ date: w.m, v: w.mental })) },
    { name: 'Routines', color: '#f472b6', pts: W.filter((w) => w.routine != null).map((w) => ({ date: w.m, v: w.routine, tip: w.routine + '%' })) },
    { name: 'Calendar adherence', color: 'var(--warn)', pts: W.filter((w) => w.adher != null).map((w) => ({ date: w.m, v: w.adher, tip: w.adher + '%' })) },
    { name: 'Goal progress', color: 'var(--good)', pts: W.filter((w) => w.goals != null).map((w) => ({ date: w.m, v: w.goals, tip: w.goals + '%' })) },
  ], { yMin: 0, yMax: 100, h: 220, label: 'All systems by week' });
};
function insights(W) {
  const a = W[W.length - 1], b = W[W.length - 2], out = [];
  const cmp = (k, l, good = 'up') => { if (a[k] == null || b[k] == null) return; const d = a[k] - b[k]; if (Math.abs(d) >= 10) out.push([d > 0 === (good === 'up') ? 'hi' : 'mid', `${l} ${d > 0 ? 'up' : 'down'} ${Math.abs(d)} points vs last week (${b[k]} → ${a[k]}).`]); };
  cmp('cons', 'Training consistency'); cmp('mental', 'Mental readiness'); cmp('routine', 'Routine completion'); cmp('adher', 'Calendar adherence');
  if (b.load && a.load > b.load * 1.3) out.push(['mid', `Workload up ${Math.round((a.load / b.load - 1) * 100)}% this week. Watch fatigue and sleep.`]);
  const lowM = lastNDays(14).filter((d) => (mentalScore(d) ?? 100) < 45).length; if (lowM >= 3) out.push(['mid', `${lowM} low mental-readiness days in two weeks. The confidence and focus exercises in Mind can help.`]);
  const miss = adherence(lastNDays(14)).missedList; if (miss.length >= 3) { const by = {}; for (const { it } of miss) by[it.title] = (by[it.title] || 0) + 1; const top = Object.entries(by).sort((x, y) => y[1] - x[1])[0]; out.push(['mid', `Most missed: ${top[0]} (${top[1]}× in two weeks).`]); }
  const over = goals().filter((g) => goalState(g).status === 'overdue'); if (over.length) out.push(['lo', `${over.length} overdue goal${over.length === 1 ? '' : 's'}: ${over.slice(0, 2).map((g) => g.title).join(', ')}. Update the target date or the plan.`]);
  for (const w of loadWarnings().slice(0, 1)) out.push(w);
  return out.length ? `<div class="list">${out.slice(0, 6).map(([c, t]) => `<div class="li" style="justify-content:flex-start"><span class="band ${c}" style="flex:none">${c === 'hi' ? 'Good' : c === 'lo' ? 'Act' : 'Watch'}</span><span class="small">${esc(t)}</span></div>`).join('')}</div>` : '<p class="muted small">Nothing unusual. Keep logging: patterns show up after a week or two.</p>';
}

// ----- wiring into existing features -----
CORR_VARS.push(
  ['mental', 'Mental readiness', '', (d) => mentalScore(d)], ['confidence', 'Confidence (1-10)', '', (d) => mcheck(d)?.confidence ?? null], ['mfocus', 'Focus (1-10)', '', (d) => mcheck(d)?.focus ?? null],
  ['stress', 'Stress (1-10)', '', (d) => mcheck(d)?.stress ?? null], ['routine', 'Routine completion %', '%', (d) => { const p = routineDayPct(d); return p == null ? null : Math.round(p * 100); }], ['load', 'Training load', '', (d) => (allDayKeys().includes(d) ? loadOf(d) : null)],
);
CORR_PRESETS.push(['mental', 'shotpct', 0, 'Mental readiness → shooting %'], ['load', 'mental', 1, 'Training load → next-day mental readiness']);
const _historyItems = historyItems;
historyItems = function () {
  const out = _historyItems();
  for (const [d, c] of Object.entries(mind().checks || {})) out.push({ date: d, kind: 'mind', icon: 'spark', title: `Mental check-in · readiness ${mentalScore(d) ?? '—'}`, sub: MIND_METRICS.filter(([k]) => c[k] != null).map(([k, l]) => `${l.split(' ')[0]} ${c[k]}`).join(' · '), text: c.note || '' });
  for (const j of mind().journal || []) out.push({ date: j.date, kind: 'mind', icon: 'spark', title: `${J_TYPES.find((x) => x[0] === j.type)?.[1] || 'Journal'}${j.title ? ': ' + j.title : ''}`, sub: j.lessons ? 'Lesson: ' + j.lessons : '', text: [j.text, j.wins, j.improve, (j.tags || []).join(' ')].join(' ') });
  for (const s of mind().sessions || []) out.push({ date: s.date, kind: 'mind', icon: 'spark', title: `Mental training: ${MENTAL_EX.find((x) => x[0] === s.ex)?.[1] || s.ex}`, sub: `${s.steps}/${s.of} steps`, text: '' });
  for (const [d, rs] of Object.entries(plan().rlog || {})) for (const [id] of Object.entries(rs)) { const r = routines().find((x) => x.id === id); if (r && stepsDone(d, r)) out.push({ date: d, kind: 'routine', icon: 'calendar', title: `${r.name}: ${stepsDone(d, r)}/${r.steps.length} steps`, sub: rcat(r.cat)[1] + ' routine', text: '' }); }
  return out.sort((a, b) => b.date.localeCompare(a.date));
};
const _reportData = reportData;
reportData = function (type) {
  const R = _reportData(type);
  if (type === 'weekly' || type === 'monthly') {
    const days = lastNDays(daysBetween(R.range[0], R.range[1]) + 1, R.range[1]), ms = days.map(mentalScore).filter((x) => x != null), rt = days.map(routineDayPct).filter((x) => x != null), ad = adherence(days), gs = goals().map((g) => ({ g, s: goalState(g) }));
    const avgK = (k) => { const v = days.map((d) => mcheck(d)?.[k]).filter((x) => x != null); return v.length ? r1(mean(v)) : '—'; };
    R.S.push({ h: 'Mental performance', kpis: [['Check-ins', `${ms.length}/${days.length}`], ['Avg readiness', ms.length ? Math.round(mean(ms)) : '—'], ['Confidence', avgK('confidence')], ['Focus', avgK('focus')]], chart: ms.length >= 2 ? { kind: 'line', pts: days.map((d) => ({ date: d, v: mentalScore(d) })).filter((p) => p.v != null), fmt: (v) => v + '/100', opts: { yMin: 0, yMax: 100, color: 'var(--purple)' } } : null, bullets: (mind().journal || []).filter((j) => j.date >= R.range[0] && j.lessons).slice(-3).map((j) => `Lesson (${fmtD(j.date)}): ${j.lessons}`) });
    R.S.push({ h: 'Routines and schedule', kpis: [['Routine steps done', rt.length ? Math.round(mean(rt) * 100) + '%' : '—'], ['Calendar adherence', ad.pct == null ? '—' : pctTxt(ad.pct)], ['Completed', ad.done], ['Missed', ad.missed]], bullets: ad.missedList.slice(0, 5).map(({ d, it }) => `Missed: ${it.title} (${fmtD(d)})`) });
    R.S.push({ h: 'Goals', kpis: [['Active', gs.filter((x) => x.s.status !== 'done').length], ['Achieved', gs.filter((x) => x.s.status === 'done').length], ['Behind', gs.filter((x) => x.s.status === 'behind').length], ['Overdue', gs.filter((x) => x.s.status === 'overdue').length]], bullets: gs.filter((x) => x.s.status !== 'done').slice(0, 5).map(({ g, s }) => `${g.title}: ${s.pct}% (${STATUS_TXT[s.status][1].toLowerCase()})`) });
  }
  return R;
};
if (!REPORTS.some((r) => r[0] === 'mental')) REPORTS.push(['mental', 'Mental performance']);
const _reportData2 = reportData;
reportData = function (type) {
  if (type !== 'mental') return _reportData2(type);
  const days = lastNDays(30), ms = days.map((d) => ({ date: d, v: mentalScore(d) })).filter((p) => p.v != null);
  return { title: 'Mental performance report', name: aos().profile?.name || 'Athlete', range: [days[0], days[days.length - 1]], S: [
    { h: 'Check-ins (30 days)', kpis: MIND_METRICS.slice(0, 4).map(([k, l]) => { const v = days.map((d) => mcheck(d)?.[k]).filter((x) => x != null); return [l, v.length ? r1(mean(v)) : '—']; }), chart: ms.length >= 2 ? { kind: 'line', pts: ms, fmt: (v) => v + '/100', opts: { yMin: 0, yMax: 100, color: 'var(--purple)' } } : null },
    { h: 'Mental training', kpis: [['Exercises', (mind().sessions || []).filter((s) => inRange(s.date, '30')).length], ['Journal entries', (mind().journal || []).filter((j) => inRange(j.date, '30')).length]], bullets: (mind().journal || []).filter((j) => inRange(j.date, '30') && (j.lessons || j.wins)).slice(-6).map((j) => `${fmtD(j.date)}: ${j.lessons || j.wins}`) },
  ] };
};
const _snapshot2 = snapshot2;
snapshot2 = function () {
  const s = _snapshot2(), d14 = lastNDays(14);
  s.mental = { checkins14d: d14.filter((d) => mcheck(d)).length, avgReadiness: (() => { const v = d14.map(mentalScore).filter((x) => x != null); return v.length ? Math.round(mean(v)) : null; })(), recent: d14.filter((d) => mcheck(d)).slice(-5).map((d) => ({ date: d, ...mcheck(d), at: undefined })), lessons: (mind().journal || []).slice(-4).map((j) => j.lessons).filter(Boolean) };
  s.routines = routines().map((r) => { const st = routineStats(r); return { name: r.name, category: r.cat, completion28d: st.pct == null ? null : Math.round(st.pct * 100), streak: st.streak }; });
  s.calendarAdherence14d = (() => { const a = adherence(d14); return { scheduled: a.sched, done: a.done, missed: a.missed }; })();
  s.loadPatterns = loadWarnings().map((w) => w[1]);
  return s;
};

// ----- Home cards -----
WIDGETS.push(['mind', 'Mental check-in'], ['upnext', 'Up next']);
DEFAULT_W.splice(1, 0, 'upnext', 'mind');
function homeMind(el) { const d = todayIso(), c = mcheck(d), s = mentalScore(d), m7 = lastNDays(7).map(mentalScore).filter((x) => x != null);
  el.innerHTML = `<div class="card-head"><div><h3>Mental check-in</h3><span class="sub">${c ? 'Done today' : 'Not done today'}</span></div><button type="button" class="btn sm ${c ? '' : 'primary'}" data-go="mind-checkin">${c ? 'View' : 'Check in'}</button></div>
  <div class="row" style="gap:14px;flex-wrap:nowrap">${ring(s ?? 0, 100, { size: 86, stroke: 8, color: s == null ? 'var(--oth)' : 'var(--purple)', center: `<b style="font-size:22px">${s ?? '—'}</b>` })}<div class="stack" style="gap:4px;min-width:0">${c ? MIND_METRICS.filter(([k]) => c[k] != null).slice(0, 4).map(([k, l]) => `<span class="small">${l} <b>${c[k]}</b></span>`).join('') : '<span class="small muted">Rate confidence, focus, motivation, stress, energy and readiness.</span>'}${m7.length >= 2 ? spark(m7, 'var(--purple)', 110, 24) : ''}</div></div>`; }
function homeUpNext(el) { const today = todayIso(), now = nowM(), its = itemsOn(today); let next = its.find((x) => x.time && toMinT(x.time) >= now - 15 && !isChecked(today, x.key)), nd = today; for (let i = 1; !next && i <= 7; i++) { const d = shiftIso(today, i), n = itemsOn(d)[0]; if (n) { next = n; nd = d; } }
  const a = adherence([today]);
  el.innerHTML = `<div class="card-head"><div><h3>Up next</h3><span class="sub">${a.sched ? `${a.done}/${a.sched} done today` : 'Calendar'}</span></div><button type="button" class="btn sm" data-go="train-plan">Calendar</button></div>
  ${next ? `<div class="notice" style="border-left:3px solid ${evType(next.type)[2]}"><span class="tiny muted">${nd === today ? 'TODAY' : esc(fmtDL(nd)).toUpperCase()}${next.time ? ' · ' + fmtClock(next.time) : ''}${next.time && nd === today && toMinT(next.time) > now ? ` · in ${fmtDur(toMinT(next.time) - now)}` : ''}</span><br><b style="color:var(--fg);font-size:16px">${esc(next.title)}</b> <span class="tiny">${esc(evType(next.type)[1])}</span></div>${next.routine ? `<button type="button" class="btn sm primary" data-act="run-routine" data-id="${next.routine.id}" data-date="${nd}" style="margin-top:8px">▶ Start routine</button>` : ''}` : emptyState('Nothing scheduled', 'Add practices, workouts and routines to your calendar.', 'calendar', '<button type="button" class="btn sm primary" data-act="event">＋ Event</button>')}`; }
const _homeR = RENDER.home;
RENDER.home = (el) => { _homeR(el); for (const [k, fn] of [['mind', homeMind], ['upnext', homeUpNext]]) { const s = $(`[data-widget="${k}"]`, el); if (s) { try { fn(s); } catch (e) { console.error(e); } } } };
ACHIEVEMENTS.push(
  ['mind-7', 'Mentally tough', '7 mental check-ins', () => Object.keys(mind().checks || {}).length >= 7],
  ['journal-5', 'Reflective', '5 journal entries', () => (mind().journal || []).length >= 5],
  ['routine-7', 'Creature of habit', '7-day routine streak', () => routines().some((r) => routineStats(r, 60).streak >= 7)],
  ['milestone', 'Step by step', 'Complete a goal milestone', () => goals().some((g) => (g.milestones || []).some((m) => m.done))],
  ['plan-week', 'Followed the plan', '100% calendar adherence for a week (5+ items)', () => { for (let i = 1; i <= 8; i++) { const a = adherence(lastNDays(7, shiftIso(todayIso(), -7 * (i - 1)))); if (a.sched >= 5 && a.done === a.sched) return true; } return false; }],
);
