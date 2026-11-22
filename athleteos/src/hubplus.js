// ===================== Hub+: Morning Briefing, conflict alerts, Week calendar, connection graphs =====================
// Builds on ecohub.js. Everything is read from docs the apps already write; nothing here writes data.
SUBS.hub.splice(1, 0, ['week', 'Week']);
const hpCorr = (k) => CORR_VARS.find((v) => v[0] === k)[3];
const hpReady = (d) => doc('rl-ready')?.days?.[d]?.score ?? hubSafe(() => readiness(d)?.score);
const hpSleepNight = (d) => doc('rl-sleep')?.nights?.[d]?.asleepH ?? hubSleep(d);
const HP_TESTS = ['test', 'exam', 'quiz'];
const hpTestsOn = (d) => (doc('life-school') ? scDue(d, d).filter((x) => HP_TESTS.includes(x.type)) : []);
const hpHard = (its) => its.filter((x) => ['lift', 'game', 'conditioning', 'practice'].includes(x.type) || (x.src === 'Gameplan' && x.type === 'training'));
const hpBed = () => doc('gp-core')?.routine?.bed || doc('gp-sig')?.bed || null;
const hpPain = (t) => (doc('rl-body')?.records || []).filter((r) => r.date >= shiftIso(t, -2) && (r.kind === 'pain' || r.kind === 'injury'));
function hpShotPct(d) {
  const a = hubSafe(() => hpCorr('shotpct')(d)); if (a != null) return a;
  const b = btcOn(d).map((w) => w.btc).filter((x) => x?.attempts >= 20);
  return b.length ? r1((sum(b.map((x) => x.makes)) / sum(b.map((x) => x.attempts))) * 100) : null;
}
const hpClsName = (id) => hubSafe(() => scClass(id)?.name) || '';

// ---------- Morning Briefing ----------
function hubBriefing() {
  const t = todayIso(), tm = shiftIso(t, 1), rd = hpReady(t), sl = hpSleepNight(t), its = hubSafe(() => tdItems(t), []) || [];
  const S = doc('life-school'), dueT = S ? scDue(t, t) : [], testsTm = hpTestsOn(tm), soon = S ? scDue(tm, shiftIso(t, 3)).filter((x) => HP_TESTS.includes(x.type)) : [];
  const hard = hpHard(its), game = its.some((x) => x.type === 'game'), pain = hpPain(t), G = targets(t), T = totalsOf(t);
  const sig = doc('gp-sig'), top3 = sig?.updated === t ? sig.top3Today || [] : [];
  const bed = hpBed();
  const tile = (c, k, v, s) => `<div class="hb-t" style="--c:${c}"><small>${k}</small><b>${v}</b><span>${s}</span></div>`;
  let call;
  if (pain.length) call = `Pain flagged (${[...new Set(pain.map((r) => r.area))].join(', ')}). Get it checked before training hard today.`;
  else if (game) call = `Game day. Keep shooting light, eat a carb-heavy meal 3–4 hours before, and finish ${dueT.length || testsTm.length ? 'homework' : 'anything due'} before you leave.`;
  else if (testsTm.length && (hard.length || (rd != null && rd < 60))) call = `${testsTm[0].title} tomorrow${hpClsName(testsTm[0].cls) ? ' (' + hpClsName(testsTm[0].cls) + ')' : ''}. Keep training ${hard.length ? 'moderate' : 'light'}, study 30–45 min tonight${bed ? `, in bed by ${fmtClock(bed)}` : ''}.`;
  else if (testsTm.length) call = `${testsTm[0].title} tomorrow. Block 30–45 min of review before dinner${bed ? ` and keep bedtime at ${fmtClock(bed)}` : ''}.`;
  else if (rd != null && rd < 50) call = `Readiness is low (${rd}). Swap hard work for skill work, mobility and an early night.`;
  else if (rd != null && rd >= 75) call = `Green light (readiness ${rd}). Good day for your hardest session${dueT.length ? `, after the ${dueT.length} thing${dueT.length > 1 ? 's' : ''} due today` : ''}.`;
  else call = `Normal day. ${dueT.length ? `Knock out the ${dueT.length} thing${dueT.length > 1 ? 's' : ''} due today first, then train.` : 'Train, eat and sleep on schedule.'}`;
  return `<section class="card hb"><div class="card-head"><div><h3>Morning briefing</h3><span class="sub">Recovery, school, training, plan and fuel in one look</span></div></div>
    <div class="hb-grid">
      ${tile(EV_APPS.rl.color, 'Readiness', rd ?? '—', sl != null ? `slept ${nf(sl, 1)} h` : 'no check-in yet')}
      ${tile(EV_APPS.school.color, 'School', dueT.length, `due today${soon.length ? ` · ${soon.length} test${soon.length > 1 ? 's' : ''} soon` : ''}`)}
      ${tile(EV_APPS.aos.color, 'Training', hard.length || '—', hard.length ? esc(hard.map((x) => x.title).slice(0, 2).join(', ')) : 'nothing on the calendar')}
      ${tile(EV_APPS.ml.color, 'Fuel', `${Math.round(T.protein)}<i>/${G.protein}g</i>`, `protein · ${G.calories.toLocaleString()} kcal target`)}
    </div>
    ${top3.length ? `<div class="hb-top"><small>Gameplan Top 3</small>${top3.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
    <p class="hb-call"><b>Today's call</b>${esc(call)}</p></section>`;
}

// ---------- conflict alerts (added to Needs attention) ----------
const hpAtt = hubAttention;
hubAttention = function () {
  const out = hpAtt(), t = todayIso(), tm = shiftIso(t, 1), S = doc('life-school');
  const its = hubSafe(() => tdItems(t), []) || [], hard = hpHard(its), testsTm = hpTestsOn(tm), sl = hpSleepNight(t);
  if (testsTm.length && hard.length) out.push({ app: 'aos', lvl: 'watch', t: `${hard[0].title} tonight, ${testsTm[0].title} tomorrow`, s: 'Keep the session moderate and finish studying before it', href: 'athlete.html' });
  if (S && its.some((x) => x.type === 'game')) { const d = scDue(tm, tm), mins = sum(d.map((x) => x.mins || 30)); if (d.length >= 2 || mins >= 120) out.push({ app: 'school', lvl: 'watch', t: `Game today and ${d.length} due tomorrow (~${Math.round(mins / 6) / 10} h)`, s: 'Get it done before you leave for the game', href: 'student.html' }); }
  if (S) for (const x of scDue(t, shiftIso(t, 2)).filter((x) => scClass(x.cls)?.latePolicy === 'none')) out.push({ app: 'school', lvl: x.due <= tm ? 'act' : 'watch', t: `${hpClsName(x.cls)}: ${x.title} due ${evWhen(x.due).toLowerCase()}`, s: 'No late work in this class. Finish it early.', href: 'student.html' });
  if (testsTm.length && sl != null && sl < 7) out.push({ app: 'rl', lvl: 'watch', t: `Only ${nf(sl, 1)} h of sleep and a test tomorrow`, s: `Aim for bed ${hpBed() ? 'by ' + fmtClock(hpBed()) : '30 minutes earlier'} tonight`, href: 'gameplan.html' });
  const order = { act: 0, watch: 1, info: 2 };
  return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
};
const hpToday = HUB.today;
HUB.today = (el) => { hpToday(el); hubSafe(() => $('.hub-head', el)?.insertAdjacentHTML('afterend', hubBriefing())); };

// ---------- Week: one calendar for every app ----------
HUB.week = (el) => {
  const off = Number(ui('hubWk', '0')), mon = shiftIso(mondayOf(todayIso()), off * 7), days = Array.from({ length: 7 }, (_, i) => shiftIso(mon, i)), t = todayIso(), S = doc('life-school');
  const col = (d) => {
    const its = hubSafe(() => tdItems(d), []) || [], due = S ? S.items.filter((x) => x.due === d) : [], btc = btcOn(d);
    const rows = [
      ...due.map((x) => `<li class="wk-due${x.done ? ' done' : ''}" style="--c:${scClass(x.cls)?.color || EV_APPS.school.color}"><b>${esc(x.title)}</b><small>${HP_TESTS.includes(x.type) ? x.type.toUpperCase() : 'due'}${hpClsName(x.cls) ? ' · ' + esc(hpClsName(x.cls)) : ''}</small></li>`),
      ...its.map((x) => `<li${x.done ? ' class="done"' : ''} style="--c:${x.color}"><b>${esc(x.title)}</b><small>${tdClock(x.st)} · ${x.src}</small></li>`),
      ...btc.map((w) => `<li style="--c:${EV_APPS.btc.color}"><b>${esc(w.name || 'Training Center')}</b><small>${w.mins} min · done</small></li>`),
    ];
    return `<div class="wk-d${d === t ? ' today' : ''}"><div class="wk-h"><span>${DOW[parseIso(d).getDay()]}</span><b>${parseIso(d).getDate()}</b>${hpTestsOn(d).length ? '<i class="wk-flag">Test</i>' : ''}</div>${rows.length ? `<ul>${rows.join('')}</ul>` : '<p class="tiny muted">Free</p>'}</div>`;
  };
  el.innerHTML = `<section class="hub-head"><h1>Week</h1><p class="hub-sum">Classes due, calendar, Gameplan blocks and sessions · ${fmtD(days[0])} – ${fmtD(days[6])}</p><div style="margin-top:10px">${seg('hubWk', [['-1', 'Last'], ['0', 'This week'], ['1', 'Next'], ['2', '+2']], String(off))}</div></section>
    <div class="wk-grid">${days.map(col).join('')}</div>
    <div class="legend small muted" style="margin-top:8px">${['school', 'aos', 'gp', 'btc'].map((k) => `<span><i class="dot" style="background:${EV_APPS[k].color}"></i>${EV_APPS[k].name}</span>`).join(' ')}</div>`;
};

// ---------- Graphs: how your apps affect each other ----------
const hpGraphs = HUB.graphs;
HUB.graphs = (el) => {
  hpGraphs(el);
  const n = Number(ui('hubRange', '30')), days = hubIn(Math.max(n, 60)), S = doc('life-school');
  const sets = [
    { id: 'hc-sleep', h: 'Sleep → test and quiz scores', s: 'Sleep the night before each graded test or quiz', xl: 'Sleep (h)', yl: 'Score %', ps: (S?.grades || []).filter((g) => ['test', 'quiz'].includes(g.cat) && g.max > 0).map((g) => [hpSleepNight(g.date), r1((g.score / g.max) * 100), g.date]).filter((p) => p[0] != null) },
    { id: 'hc-shoot', h: 'Readiness → shooting %', s: 'Recovery readiness vs. makes that day (20+ shots)', xl: 'Readiness', yl: 'Shooting %', ps: days.map((d) => [hpReady(d), hpShotPct(d), d]).filter((p) => p[0] != null && p[1] != null) },
    { id: 'hc-prot', h: 'Protein → next-day soreness', s: 'MacroLens protein vs. soreness the morning after', xl: 'Protein (g)', yl: 'Soreness (1–5)', ps: hubSafe(() => corrPairs('protein', 'sore', days, 1), []) || [] },
  ];
  el.insertAdjacentHTML('beforeend', `<section class="card"><div class="card-head"><div><h3>How your apps connect</h3><span class="sub">Each dot is one day. A pattern needs ${CORR_MIN}+ days; correlation is not proof.</span></div></div>
    <div class="grid three">${sets.map((x) => { const st = x.ps.length >= CORR_MIN ? pearson(x.ps) : null; return `<div><b class="small">${x.h}</b><p class="tiny muted" style="margin:2px 0 6px">${x.s}</p>${st ? `<div class="chart" id="${x.id}"></div><p class="tiny"><b>r = ${st.r >= 0 ? '+' : ''}${st.r.toFixed(2)}</b> · ${strength(st.r)} ${st.r >= 0 ? 'positive' : 'negative'} · ${x.ps.length} days</p>` : `<p class="small muted">${x.ps.length} of ${CORR_MIN} days so far. Keep logging and this fills in.</p>`}</div>`; }).join('')}</div></section>`);
  for (const x of sets) { const st = x.ps.length >= CORR_MIN ? pearson(x.ps) : null; if (st) drawScatter($('#' + x.id, el), x.ps, { xl: x.xl, yl: x.yl, fit: st, h: 200, label: x.h }); }
};
