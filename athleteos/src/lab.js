// ===================== PERFORMANCE SIMULATION CENTER: SCREENS =====================
// "Lab" tab. Inputs update the results immediately (only the results area re-renders, so typing keeps focus).
// Working drafts live in this device's UI state; saved simulations go to the "aos-sim" doc with their baseline snapshot.
ICONS.flask = ic('<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>');
VIEWS.splice(VIEWS.findIndex((v) => v[0] === 'coach'), 0, ['lab', 'Lab', 'flask']);
SUBS.lab = [['dash', 'Dashboard'], ['build', 'Scenario builder'], ['train', 'Training & load'], ['shoot', 'Shooting'], ['ath', 'Athletic']];
const LAB = {}, LAB_OUT = {};
RENDER.lab = (el, sub) => LAB[sub](el);
const sim = () => doc('aos-sim');
const labSaveDoc = () => persist('aos-sim');

// ---------- labels: measured / calculated / hypothetical / forecast ----------
const KIND = { m: ['●', 'Measured', 'lab-m'], c: ['◆', 'Calculated', 'lab-c'], h: ['◇', 'Hypothetical', 'lab-h'], f: ['┅', 'Projection', 'lab-f'] };
const kTag = (k) => `<span class="lab-tag ${KIND[k][2]}" title="${KIND[k][1]}">${KIND[k][0]} ${KIND[k][1]}</span>`;
const kLegend = () => `<div class="lab-legend">${['m', 'c', 'h', 'f'].map(kTag).join('')}</div>`;

// ---------- drafts ----------
function labDraft(kind) {
  const all = ui('labD', {}), s = labSnap(kind);
  if (!all[kind]) {
    const p = s.plan, sh = s.shooting;
    all[kind] = kind === 'train' ? { A: clonePlan(p), B: clonePlan(p), weeks: 12 }
      : kind === 'build' ? { mod: clonePlan(p), sleepH: s.sleepH ?? 8, weeks: 12 }
        : kind === 'shoot' ? { pct: sh.pct ?? 40, sessions: Math.round(sh.sessionsPerWeek) || p.items.shooting.n || 3, attempts: sh.attPerSession || p.attempts, nSessions: Math.max(1, Math.round(sh.sessionsPerWeek) || p.items.shooting.n || 3), nAttempts: Math.max(100, sh.attPerSession || p.attempts) * 2, target: sh.pct != null ? Math.min(95, Math.round(sh.pct + 5)) : 45, weeks: 12, useAssume: false, assume: [...SHOOT_ASSUME] }
          : kind === 'ath' ? athDefaults(s, Object.keys(s.tests).find((k) => ATH_IDS.includes(k)) || 'vert') : {};
    setUi('labD', all);
  }
  return all[kind];
}
function athDefaults(s, test) {
  const tb = s.tests[test], t = testById(test) || { group: 'Jumping', better: 'higher' }, fk = ATH_FOCUS[t.group] || 'strength', now = s.plan.items[fk]?.n || 0;
  return { test, cur: tb ? tb.cur : '', target: tb ? r2(tb.cur * (t.better === 'lower' ? 0.95 : 1.08)) : '', weeks: 12, focusNow: now, focusNew: now + 1 };
}
const saveDraft = (kind, d) => { const all = ui('labD', {}); all[kind] = d; setUi('labD', all); };
const openId = (kind) => ui('labOpen', {})[kind] || null;
const openSc = (kind) => sim().scenarios.find((x) => x.id === openId(kind)) || null;
const labSnap = (kind) => openSc(kind)?.snap || labSnapshot();
function setPath(o, path, v) { const ks = path.split('.'); let x = o; for (const k of ks.slice(0, -1)) x = x[k] = x[k] ?? {}; x[ks[ks.length - 1]] = v; }

document.addEventListener('input', (e) => {
  const inp = e.target.closest('[data-lab]'); if (!inp) return;
  const [kind, ...rest] = inp.dataset.lab.split('.'), d = labDraft(kind);
  const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' || inp.type === 'range' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
  setPath(d, rest.join('.'), v); saveDraft(kind, d);
  const b = inp.closest('label')?.querySelector('.lab-val'); if (b) b.textContent = inp.dataset.fmt === 'h' ? v + ' h' : v;
  if (kind === 'ath' && rest[0] === 'test') { saveDraft('ath', athDefaults(labSnap('ath'), v)); return refresh(); }
  try { LAB_OUT[kind]?.(); } catch (err) { console.error(err); }
});

// ---------- charts ----------
/** Projection chart: measured dots + lines, dashed projections and a shaded range. o: { hist, lines:[{name,color,pts,dash}], band:{lo,hi,color,name}, goal, fmt, h, label } */
function drawFan(el, o) {
  if (!el) return;
  const hist = o.hist || [], lines = (o.lines || []).filter((s) => s.pts.length), band = o.band;
  const all = [...hist, ...lines.flatMap((s) => s.pts), ...(band ? [...band.lo, ...band.hi] : [])];
  if (!all.length) { el.innerHTML = ''; return; }
  const W = widthOf(el), H = o.h || 220, L = 42, R = 14, T = 16, B = 24;
  const dates = [...new Set(all.map((p) => p.date))].sort(), t0 = parseIso(dates[0]).getTime(), t1 = parseIso(dates[dates.length - 1]).getTime();
  const xs = (d) => (t1 === t0 ? (L + W - R) / 2 : L + ((parseIso(d).getTime() - t0) / (t1 - t0)) * (W - L - R));
  const vals = all.map((p) => p.v).concat(o.goal != null ? [o.goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.12; lo -= pad; hi += pad;
  const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const ys = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B), fmt = o.fmt || ((v) => nf(v, 1));
  const P = (pts) => pts.map((p) => [r1(xs(p.date)), r1(ys(p.v))]);
  const nL = Math.min(5, dates.length), labs = []; for (let i = 0; i < nL; i++) { const k = nL === 1 ? 0 : Math.round((i * (dates.length - 1)) / (nL - 1)); if (!labs.includes(k)) labs.push(k); }
  const tx = xs(todayIso()), id = 'fan' + ++gradN;
  const bandPath = band && band.lo.length > 1 ? `M${P(band.hi).map((p) => p.join(',')).join('L')}L${P([...band.lo].reverse()).map((p) => p.join(',')).join('L')}Z` : '';
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || 'Projection chart')}">
    <defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${band?.color || 'var(--purple)'}" stop-opacity=".1"/><stop offset="1" stop-color="${band?.color || 'var(--purple)'}" stop-opacity=".3"/></linearGradient></defs>
    <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${r1(ys(v))}" y2="${r1(ys(v))}"/>`).join('')}</g>
    <g class="axis">${ticks.map((v) => `<text x="${L - 6}" y="${r1(ys(v)) + 3.5}" text-anchor="end">${esc(o.tick ? o.tick(v) : nf(v, tickDec(ticks)))}</text>`).join('')}
    ${labs.map((k) => `<text x="${r1(xs(dates[k]))}" y="${H - 6}" text-anchor="${k === 0 && labs.length > 1 ? 'start' : k === dates.length - 1 && labs.length > 1 ? 'end' : 'middle'}">${esc(fmtD(dates[k]))}</text>`).join('')}</g>
    ${tx > L && tx < W - R ? `<line x1="${r1(tx)}" x2="${r1(tx)}" y1="${T - 6}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="2 3"/><text x="${r1(tx) + 4}" y="${T - 4}" font-size="10" fill="var(--muted)">Today → hypothetical</text>` : ''}
    ${o.goal != null ? `<line x1="${L}" x2="${W - R}" y1="${r1(ys(o.goal))}" y2="${r1(ys(o.goal))}" stroke="var(--good)" stroke-width="1.4" stroke-dasharray="7 4"/><text x="${W - R}" y="${r1(ys(o.goal)) - 4}" text-anchor="end" font-size="10.5" fill="var(--good)" font-weight="700">Target ${esc(fmt(o.goal))}</text>` : ''}
    ${bandPath ? `<path d="${bandPath}" fill="url(#${id})" stroke="none"/>` : ''}
    ${hist.length > 1 ? `<path d="${smoothPath(P(hist))}" fill="none" stroke="var(--fg)" stroke-opacity=".35" stroke-width="1.4"/>` : ''}
    ${lines.map((s) => { const Q = P(s.pts); return Q.length > 1 ? `<path d="${smoothPath(Q)}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2.4}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linecap="round"/>` : ''; }).join('')}
    ${hist.map((p) => `<circle cx="${r1(xs(p.date))}" cy="${r1(ys(p.v))}" r="3.6" fill="var(--fg)" stroke="var(--surface)" stroke-width="1.5"/><circle class="hit" cx="${r1(xs(p.date))}" cy="${r1(ys(p.v))}" r="10" fill="transparent" data-tip="${esc(`Measured: ${fmt(p.v)}`)}|${esc(fmtDL(p.date))}"/>`).join('')}
    ${lines.flatMap((s) => s.pts.filter((_, i) => i % Math.max(1, Math.ceil(s.pts.length / 14)) === 0 || i === s.pts.length - 1).map((p) => `<circle class="hit" cx="${r1(xs(p.date))}" cy="${r1(ys(p.v))}" r="9" fill="transparent" data-tip="${esc(`${s.name}: ${fmt(p.v)}`)}|${esc('Hypothetical · ' + fmtDL(p.date))}"/>`)).join('')}
  </svg><div class="legend">${hist.length ? '<span><i style="background:var(--fg);border-radius:50%"></i>Measured</span>' : ''}${lines.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}${band ? `<span><i style="background:${band.color || 'var(--purple)'};opacity:.45"></i>${esc(band.name || 'Range')}</span>` : ''}${o.goal != null ? '<span><i style="background:var(--good)"></i>Target</span>' : ''}</div>`;
}
/** Seven days, two plans: stacked load bars by type (HTML). */
function weekBars(mA, mB, la = 'A', lb = 'B') {
  const max = Math.max(1, ...mA.daily, ...mB.daily), DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const col = (m, i) => `<div class="wb-bar" title="${m.daily[i]} load">${m.week[i].map((s) => `<i style="height:${((s.mins * s.rpe) / max) * 100}%;background:${simType(s.type)[2]}"></i>`).join('')}</div>`;
  return `<div class="wb">${DN.map((d, i) => `<div class="wb-day"><div class="wb-pair">${col(mA, i)}${col(mB, i)}</div><span class="tiny muted">${d}</span><span class="tiny"><b>${mA.daily[i] ? '●' : '○'}</b>${mB.daily[i] ? '●' : '○'}</span></div>`).join('')}</div>
    <p class="tiny muted" style="margin-top:6px">Left bar ${esc(la)}, right bar ${esc(lb)}. ● training day ○ rest day. Colors = session type, height = load (min × RPE).</p>`;
}
const zoneBar = (m) => { const tot = sum(m.zones.map((z) => z.mins)) || 1; return `<div class="zb">${m.zones.filter((z) => z.mins).map((z) => `<i style="width:${(z.mins / tot) * 100}%;background:${z.color}" title="${esc(z.label)}: ${z.mins} min"></i>`).join('')}</div>`; };
const diffTxt = (a, b, d = 1, better = 'up') => { if (a == null || b == null) return ''; const x = r1(b - a); if (!x) return '<span class="muted">—</span>'; const good = better === 'none' ? null : better === 'up' ? x > 0 : x < 0; return `<span class="${good == null ? '' : good ? 'up' : 'down'}">${x > 0 ? '+' : ''}${nf(x, d)}</span>`; };
const acwrTxt = (v) => (v == null ? '—' : `${v} <span class="tiny ${acwrZone(v)[0] === 'hi' ? 'up' : acwrZone(v)[0] === 'lo' ? 'down' : 'muted'}">${acwrZone(v)[1]}</span>`);

// ---------- plan editor ----------
function planEditor(path, p) {
  p = sanePlan(p);
  return `<div class="pe"><label class="pe-days">Training days / week <b class="lab-val">${p.days}</b><input type="range" min="0" max="7" step="1" value="${p.days}" data-lab="${path}.days"></label>
    <div class="pe-grid"><span></span><span class="tiny muted">Per wk</span><span class="tiny muted">Min</span><span class="tiny muted">RPE</span>
    ${SIM_TYPES.map(([k, l, c]) => `<span class="pe-l"><i class="dot" style="background:${c}"></i>${l}</span><input type="number" inputmode="numeric" min="0" max="14" value="${p.items[k].n}" data-lab="${path}.items.${k}.n" aria-label="${l} sessions per week"><input type="number" inputmode="numeric" min="0" max="240" step="5" value="${p.items[k].mins}" data-lab="${path}.items.${k}.mins" aria-label="${l} minutes"><input type="number" inputmode="numeric" min="1" max="10" value="${p.items[k].rpe}" data-lab="${path}.items.${k}.rpe" aria-label="${l} RPE 1 to 10">`).join('')}
    </div><label>Shots per shooting session<input type="number" inputmode="numeric" min="0" max="1500" step="25" value="${p.attempts}" data-lab="${path}.attempts"></label></div>`;
}
const scenarioBar = (kind) => { const sc = openSc(kind); return sc ? `<div class="notice lab-open"><span>Opened <b>${esc(sc.name)}</b> · baseline from ${esc(fmtDL(sc.snap.date))}${sc.updated !== sc.created ? ` · edited ${esc(fmtD(sc.updated.slice(0, 10)))}` : ''}</span><button type="button" class="chip" data-act="lab-close" data-kind="${kind}">Close · use today's data</button></div>` : ''; };
const saveRow = (kind) => { const sc = openSc(kind); return `<div class="row" style="margin-top:12px">${sc ? `<button type="button" class="btn sm primary" data-act="lab-update" data-kind="${kind}">Save changes</button><button type="button" class="btn sm" data-act="lab-save" data-kind="${kind}">Save as new</button>` : `<button type="button" class="btn sm primary" data-act="lab-save" data-kind="${kind}">Save simulation</button>`}<button type="button" class="btn sm ghost" data-act="lab-reset" data-kind="${kind}">Reset inputs</button></div>`; };
const listHtml = (rows) => `<ul class="lab-list">${rows.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul>`;
const formulaBox = (lines) => `<details class="lab-details"><summary>How this is calculated</summary><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`;
const LOAD_FORMULAS = ['Session load = minutes × RPE (1–10). Weekly load = sum of the week.', 'Acute = last 7 days; chronic = last 28 days ÷ 4; ACWR = acute ÷ chronic (needs 21+ days of history). Same math as the Load tab.', 'Monotony = average daily load ÷ its standard deviation over 7 days; strain = weekly load × monotony.', 'The switch chart starts from your real last 28 days, then repeats the plan week after week.'];

// ===================== Dashboard =====================
LAB.dash = (el) => {
  const s = labSnapshot(), m = planMetrics(s.plan, s), sh = s.shooting, scs = [...sim().scenarios].sort((a, b) => b.updated.localeCompare(a.updated));
  const tests = Object.values(s.tests).filter((t) => ATH_IDS.includes(t.id));
  const bd = ui('labD', {}).build, active = bd ? planMetrics(bd.mod, labSnap('build')) : null;
  el.innerHTML = `<section class="card hero lab-hero"><span class="tiny muted">PERFORMANCE SIMULATION CENTER</span><h1>What if you changed your training?</h1>
      <p class="muted small" style="max-width:560px">Try changes to training, shooting volume, strength, conditioning and recovery, compare them, and see a range of possible outcomes built from your own numbers. Nothing here changes your real workouts, goals or calendar.</p>
      ${kLegend()}<div class="row" style="margin-top:10px"><button type="button" class="btn primary" data-go="lab-build">Build a scenario</button><button type="button" class="btn" data-go="lab-shoot">Shooting simulator</button><button type="button" class="btn" data-go="lab-ath">Athletic simulator</button></div></section>
    <section class="card"><div class="card-head"><div><h3>Your baseline</h3><span class="sub">${s.isDefault ? 'No training logged in 28 days: using a default template until you log workouts' : `Last 28 days · ${s.sessions28} sessions`}</span></div>${kTag(s.isDefault ? 'h' : 'm')}</div>
      <div class="kpis four"><div class="kpi"><small>Training days / wk</small><b>${s.isDefault ? '—' : r1(s.activeDays28 / 4)}</b></div><div class="kpi"><small>Hours / wk</small><b>${m.hours}</b></div>
      <div class="kpi"><small>Load / wk</small><b>${nf(m.load)}</b></div><div class="kpi"><small>Shots / wk</small><b>${sh.sessions ? nf(sh.attemptsPerWeek) : '—'}</b></div>
      <div class="kpi"><small>Shooting % (30 d)</small><b>${sh.pct == null ? '—' : sh.pct + '%'}</b></div><div class="kpi"><small>Strength / wk</small><b>${s.plan.items.strength.n}</b></div>
      <div class="kpi"><small>Sleep (14 d avg)</small><b>${s.sleepH == null ? '—' : s.sleepH + ' h'}</b></div><div class="kpi"><small>Tests on record</small><b>${Object.keys(s.tests).length}</b></div></div>
      <p class="tiny muted" style="margin-top:8px">Hours and load are ◆ calculated from your logged sessions, rounded to a typical week.</p></section>
    ${active ? `<section class="card"><div class="card-head"><div><h3>Active simulation</h3><span class="sub">${openSc('build') ? esc(openSc('build').name) : 'Unsaved draft in the scenario builder'}</span></div>${kTag('h')}</div>
      <div class="kpis four"><div class="kpi"><small>Hours / wk</small><b>${active.hours}</b><span class="delta">${diffTxt(m.hours, active.hours, 1, 'none')}</span></div><div class="kpi"><small>Load / wk</small><b>${nf(active.load)}</b><span class="delta">${diffTxt(m.load, active.load, 0, 'none')}</span></div>
      <div class="kpi"><small>Rest days</small><b>${active.restDays}</b></div><div class="kpi"><small>Switch-week ACWR</small><b style="font-size:19px">${acwrTxt(active.acwrFirst)}</b></div></div>
      <button type="button" class="btn sm" data-go="lab-build" style="margin-top:10px">Open builder ›</button></section>` : ''}
    <section class="card"><div class="card-head"><div><h3>Recommended experiments</h3><span class="sub">Picked from gaps in your own data. Tap to load one into the builder.</span></div></div>
      <div class="lab-exp">${labExperiments(s).map((x) => `<button type="button" class="lab-x" data-act="lab-preset" data-p="${x.id}"><b>${esc(x.title)}</b><span>${esc(x.why)}</span></button>`).join('')}</div></section>
    <section class="card"><div class="card-head"><div><h3>Saved simulations</h3><span class="sub">${scs.length ? `${scs.length} saved · newest first` : 'Save a simulation to compare it later'}</span></div></div>
      ${scs.length ? `<div class="list">${scs.map(scRow).join('')}</div>` : emptyState('No saved simulations yet', 'Build a scenario and tap Save. Each one keeps its inputs, your baseline that day and its results.', 'flask')}</section>
    <section class="card"><div class="card-head"><div><h3>Development projections</h3><span class="sub">Tests you've logged, 12 weeks out on your current plan</span></div>${kTag('f')}</div>
      ${tests.length ? `<div class="list">${tests.slice(0, 6).map((tb) => { const fk = ATH_FOCUS[tb.group], n = s.plan.items[fk]?.n || 0, pr = athProject(tb, { cur: tb.cur, weeks: 12, focusNow: n, focusNew: n, start: s.date }), e = pr.rows[pr.rows.length - 1], t = testById(tb.id);
        return `<div class="li"><div><div class="t">${esc(tb.name)}</div><div class="s">Now ${esc(fmtVal(t, tb.cur))} ● · ${pr.src === 'history' ? 'from your test history' : 'general assumption'}</div></div><span class="v small">${esc(fmtVal(t, e.cons))} – ${esc(fmtVal(t, e.opt))}</span></div>`; }).join('')}</div><p class="tiny muted">Range = conservative to optimistic. Not a prediction.</p>`
    : emptyState('No test results yet', 'Log a vertical, sprint or strength test and projections show up here.', 'chart', '<button type="button" class="btn sm primary" data-act="add-test">Log a test</button>')}</section>`;
};
const scRow = (sc) => `<div class="li"><div><div class="t">${esc(sc.name)}</div><div class="s">${esc({ build: 'Scenario', train: 'Training A vs B', shoot: 'Shooting', ath: 'Athletic' }[sc.kind] || sc.kind)} · ${esc(fmtD(sc.created.slice(0, 10)))}${sc.summary ? ' · ' + esc(sc.summary) : ''}</div></div>
  <div class="row" style="flex-wrap:nowrap;gap:4px"><button type="button" class="chip" data-act="lab-open" data-id="${sc.id}">Open</button><button type="button" class="chip" data-act="lab-more" data-id="${sc.id}" aria-label="More options for ${esc(sc.name)}">⋯</button></div></div>`;
function labExperiments(s) {
  const p = s.plan, out = [], sh = s.shooting;
  if ((sh.attemptsPerWeek || 0) < 800) out.push({ id: 'shoot1000', title: 'Shoot 1,000 a week', why: `You average ${nf(sh.attemptsPerWeek || 0)} logged shots a week.` });
  if (p.items.strength.n < 2) out.push({ id: 'strength2', title: 'Add 2 strength sessions', why: `${p.items.strength.n} strength session${p.items.strength.n === 1 ? '' : 's'} a week now.` });
  if (p.items.conditioning.n < 2) out.push({ id: 'cond8', title: '8-week conditioning focus', why: `${p.items.conditioning.n} conditioning session${p.items.conditioning.n === 1 ? '' : 's'} a week now.` });
  if (p.days >= 6) out.push({ id: 'rest', title: 'Add a rest day', why: `You train about ${p.days} days a week.` });
  const ls = loadStats(); if (ls.acwr != null && ls.acwr > 1.3) out.push({ id: 'deload', title: 'Ease load 20% for 2 weeks', why: `Your acute:chronic ratio is ${ls.acwr}.` });
  if (p.days <= 4) out.push({ id: 'six', title: 'Train 6 days instead of ' + p.days, why: 'See the load and recovery cost first.' });
  out.push({ id: 'sleep', title: 'Prioritize recovery', why: s.sleepH == null ? 'Add sleep in check-ins to make this sharper.' : `Your sleep averages ${s.sleepH} h.` });
  return out.slice(0, 5);
}
const PRESETS = {
  shoot1000: (p) => { p.items.shooting.n = Math.max(4, p.items.shooting.n); p.attempts = Math.ceil(1000 / p.items.shooting.n / 25) * 25; p.days = Math.max(p.days, p.items.shooting.n); },
  strength2: (p) => { p.items.strength.n += 2; if (!p.items.strength.mins) p.items.strength.mins = 50; },
  cond8: (p, d) => { p.items.conditioning.n += 2; if (!p.items.conditioning.mins) p.items.conditioning.mins = 40; d.weeks = 8; },
  rest: (p) => { p.days = Math.max(1, p.days - 1); },
  deload: (p, d) => { for (const it of Object.values(p.items)) it.mins = Math.round((it.mins * 0.8) / 5) * 5; d.weeks = 2; },
  six: (p) => { p.days = 6; p.items.shooting.n += 1; p.items.handles.n += 1; },
  sleep: (p, d) => { d.sleepH = Math.max(9, d.sleepH || 0); p.days = Math.min(p.days, 5); for (const it of Object.values(p.items)) if (it.rpe >= 8) it.rpe = 7; },
};
ACTIONS['lab-preset'] = (b) => { const s = labSnapshot(), d = { mod: clonePlan(s.plan), sleepH: s.sleepH ?? 8, weeks: 12 }; PRESETS[b.dataset.p]?.(d.mod, d); d.mod = sanePlan(d.mod); const o = ui('labOpen', {}); delete o.build; setUi('labOpen', o); saveDraft('build', d); go('lab', 'build'); toast('Loaded into the builder. Nothing is changed for real.'); };

// ===================== Scenario builder (multi-variable) =====================
LAB.build = (el) => {
  const d = labDraft('build');
  el.innerHTML = `${scenarioBar('build')}<section class="card"><div class="card-head"><div><h3>Scenario builder</h3><span class="sub">Change several things at once. Results update as you type.</span></div>${kTag('h')}</div>
    <div class="grid two lab-cols"><div><h4 class="lab-h4">Your baseline ${kTag(labSnap('build').isDefault ? 'h' : 'm')}</h4><div id="lab-base"></div></div>
    <div><h4 class="lab-h4">Scenario</h4>${planEditor('build.mod', d.mod)}
      <div class="fields" style="margin-top:10px"><label>Sleep per night <b class="lab-val">${d.sleepH} h</b><input type="range" min="5" max="11" step="0.5" value="${d.sleepH}" data-lab="build.sleepH" data-fmt="h"></label>
      <label>Simulate for<select data-lab="build.weeks">${[[4, '4 weeks'], [8, '8 weeks'], [12, '12 weeks'], [26, '6 months']].map(([v, l]) => `<option value="${v}" ${Number(d.weeks) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div></div></div>
    ${saveRow('build')}</section><div id="lab-out" class="stack" style="gap:14px"></div>`;
  LAB_OUT.build();
};
function baseSummary(p) {
  return `<div class="list">${SIM_TYPES.filter(([k]) => p.items[k].n).map(([k, l, c]) => `<div class="li"><span class="small"><i class="dot" style="background:${c};margin-right:6px"></i>${l}</span><span class="small num">${p.items[k].n} × ${p.items[k].mins} min · RPE ${p.items[k].rpe}</span></div>`).join('') || '<p class="muted small">No sessions.</p>'}
    <div class="li"><span class="small">Training days</span><span class="small num">${p.days} / wk</span></div><div class="li"><span class="small">Shots per shooting session</span><span class="small num">${p.attempts}</span></div></div>`;
}
LAB_OUT.build = () => {
  const out = $('#lab-out'); if (!out) return;
  const d = labDraft('build'), s = labSnap('build'), mA = planMetrics(s.plan, s, d.weeks), mB = planMetrics(d.mod, s, d.weeks);
  $('#lab-base').innerHTML = baseSummary(s.plan) + `<p class="tiny muted" style="margin-top:6px">Sleep ${s.sleepH == null ? 'not recorded' : s.sleepH + ' h avg'} · locked to your data${s.isDefault ? ' (default template: nothing logged)' : ''}</p>`;
  const sh = s.shooting, shIn = (m) => ({ pct: sh.pct, sessions: m.plan.items.shooting.n, attempts: m.plan.attempts, weeks: d.weeks });
  const spA = sh.pct != null ? shootProject(s, shIn(mA)) : null, spB = sh.pct != null ? shootProject(s, shIn(mB)) : null;
  const tests = Object.values(s.tests).filter((t) => ATH_IDS.includes(t.id)).slice(0, 6);
  const rows = [['Training days', mA.trainDays, mB.trainDays, 0, 'none'], ['Sessions', mA.sessions, mB.sessions, 0, 'none'], ['Hours / week', mA.hours, mB.hours, 1, 'none'], ['Load / week', mA.load, mB.load, 0, 'none'], ['Rest days', mA.restDays, mB.restDays, 0, 'up'], ['Longest training streak', mA.maxStreak, mB.maxStreak, 0, 'down'], ['Monotony', mA.monotony, mB.monotony, 2, 'down'], ['Strength sessions', mA.strengthN, mB.strengthN, 0, 'none'], ['Conditioning sessions', mA.condN, mB.condN, 0, 'none'], ['Shots / week', mA.shotsWeek, mB.shotsWeek, 0, 'none']];
  const trade = labTradeoffs(mA, mB, d.sleepH);
  const unc = [];
  if (s.isDefault) unc.push('No training logged in the last 28 days, so the baseline is a template.');
  if (s.history < 21) unc.push(`Only ${s.history} days of training history: the acute:chronic ratio can't be computed until 21.`);
  if (sh.pct == null) unc.push('No shooting sessions logged, so there is no shooting projection.'); else if (!sh.trend) unc.push(`Shooting trend needs 5+ sessions with 20+ shots over 14+ days (you have ${sh.pts.length}). Using general assumptions.`);
  if (!tests.length) unc.push('No test results, so there are no athletic projections.');
  tests.filter((t) => t.rate == null).length && unc.push(`${tests.filter((t) => t.rate == null).map((t) => t.name).join(', ')}: not enough results for a personal rate, so general assumptions are used.`);
  if (d.sleepH && s.sleepH == null) unc.push('Sleep isn\'t recorded, so the sleep change can\'t be compared to your real average.');
  unc.push('Real progress depends on things this model can\'t see: technique, coaching, growth, stress, illness.');
  out.innerHTML = `<section class="card"><div class="card-head"><div><h3>Baseline vs scenario</h3><span class="sub">Typical week · ◆ calculated from the plan</span></div>${kTag('c')}</div>
      <div class="lab-table"><div class="lt-h"><span></span><span>Baseline</span><span>Scenario</span><span>Change</span></div>${rows.map(([l, a, b, dd, bt]) => `<div class="lt-r"><span>${l}</span><b class="num">${a == null ? '—' : nf(a, dd)}</b><b class="num">${b == null ? '—' : nf(b, dd)}</b><span class="num">${diffTxt(a, b, dd, bt)}</span></div>`).join('')}
      <div class="lt-r"><span>ACWR in switch week</span><b class="num small">${mA.acwrFirst ?? '—'}</b><b class="num small">${acwrTxt(mB.acwrFirst)}</b><span></span></div>${d.sleepH != null ? `<div class="lt-r"><span>Sleep / night</span><b class="num">${s.sleepH ?? '—'}</b><b class="num">${d.sleepH}</b><span class="num">${diffTxt(s.sleepH, d.sleepH, 1, 'up')}</span></div>` : ''}</div></section>
    <section class="card"><div class="card-head"><div><h3>Week layout</h3><span class="sub">How sessions land across the days</span></div></div>${weekBars(mA, mB, 'baseline', 'scenario')}
      <div class="grid two" style="margin-top:12px"><div><span class="tiny muted">BASELINE MIX</span>${donut(mA.byType.filter((t) => t.mins).map((t) => ({ label: t.label, v: t.mins, color: t.color })), { size: 110, fmt: (v) => v + ' min' })}<span class="tiny muted">INTENSITY</span>${zoneBar(mA)}</div>
      <div><span class="tiny muted">SCENARIO MIX</span>${donut(mB.byType.filter((t) => t.mins).map((t) => ({ label: t.label, v: t.mins, color: t.color })), { size: 110, fmt: (v) => v + ' min' })}<span class="tiny muted">INTENSITY</span>${zoneBar(mB)}</div></div>
      <div class="legend">${RPE_ZONES.map(([l, , , c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></section>
    <section class="card"><div class="card-head"><div><h3>Workload during the switch</h3><span class="sub">Short-term (7-day) vs long-term (28-day) load, week by week</span></div>${kTag('f')}</div>
      <div class="chart" id="lab-acwr"></div><div class="chart" id="lab-ac" style="margin-top:8px"></div><p class="tiny muted">Shaded band = 0.8–1.3, the "sweet spot" used by the Load tab. Information only, not an injury prediction.</p></section>
    ${spB ? `<section class="card"><div class="card-head"><div><h3>Shooting outlook</h3><span class="sub">${nf(spA.perWeek)} → ${nf(spB.perWeek)} shots a week · ${spB.src === 'history' ? 'rate from your history' : 'general assumption (not your data)'}</span></div>${kTag('f')}</div><div class="chart" id="lab-shot"></div>
      <p class="tiny muted">Volume alone doesn't guarantee a higher %. The shaded range runs from the conservative to the optimistic rate.</p></section>` : ''}
    <section class="card"><div class="card-head"><div><h3>Athletic outlook · ${d.weeks} weeks</h3><span class="sub">Baseline plan vs scenario, middle estimate with range</span></div>${kTag('f')}</div>
      ${tests.length ? `<div class="lab-table four"><div class="lt-h"><span></span><span>Now ●</span><span>Baseline</span><span>Scenario</span></div>${tests.map((tb) => { const t = testById(tb.id), fk = ATH_FOCUS[tb.group], a = athProject(tb, { cur: tb.cur, weeks: d.weeks, focusNow: s.plan.items[fk]?.n || 0, focusNew: s.plan.items[fk]?.n || 0, start: s.date }), b = athProject(tb, { cur: tb.cur, weeks: d.weeks, focusNow: s.plan.items[fk]?.n || 0, focusNew: mB.plan.items[fk]?.n || 0, start: s.date }), ea = a.rows[a.rows.length - 1], eb = b.rows[b.rows.length - 1];
        return `<div class="lt-r"><span>${esc(tb.name)}<span class="tiny muted" style="display:block">${b.src === 'history' ? 'your rate' : 'assumption'} · ${simType(fk)[1].toLowerCase()} ×${b.factor}</span></span><b class="num small">${esc(fmtVal(t, tb.cur))}</b><b class="num small">${esc(fmtVal(t, ea.base))}<span class="tiny muted" style="display:block">${esc(fmtVal(t, ea.cons))}–${esc(fmtVal(t, ea.opt))}</span></b><b class="num small">${esc(fmtVal(t, eb.base))}<span class="tiny muted" style="display:block">${esc(fmtVal(t, eb.cons))}–${esc(fmtVal(t, eb.opt))}</span></b></div>`; }).join('')}</div>`
    : emptyState('No test results yet', 'Log tests to see athletic projections.', 'chart')}</section>
    <section class="card"><div class="card-head"><div><h3>Tradeoffs</h3><span class="sub">Rule-based checks on the scenario (not medical advice)</span></div></div>${listHtml(trade)}</section>
    <section class="card"><div class="card-head"><div><h3>Uncertainties & assumptions</h3></div></div>${listHtml(unc.map((u) => ['flat', u]))}<div class="hr"></div>${listHtml(labAssumptions(s, ['Athletic progress shrinks 15% each 4-week block, is scaled by how many sessions target that quality (×0.5 to ×1.5) and is limited per 4 weeks (e.g. strength 8%, jumping 4%, speed 2%).', `Shooting: ${spB?.src === 'history' ? 'rate per 1,000 shots from your own sessions' : 'general rate assumption of 0 / 0.3 / 0.8 % points per 1,000 shots'}, flattening toward a ceiling.`]).map((a) => ['flat', a]))}
      ${formulaBox([...LOAD_FORMULAS, 'Shooting % path: p = cap − (cap − now) × e^(−rate × shots ÷ (cap − now)), cap = now + 25 points (at most 90%); rates limited to ±2 per 1,000 shots.', 'Athletic: weekly change = (rate per 4 weeks ÷ 4) × 0.85^(block), focus factor = √((new + 0.5) ÷ (now + 0.5)), limited to 0.5–1.5.'])}</section>`;
  const series = (m, nm, c, dash) => ({ name: nm, color: c, dash, pts: m.trans.filter((t) => t.acwr != null).map((t) => ({ date: t.date, v: t.acwr })) });
  const sa = series(mA, 'Baseline ACWR', 'var(--muted)', true), sb = series(mB, 'Scenario ACWR', 'var(--purple)');
  if (sa.pts.length || sb.pts.length) drawMulti($('#lab-acwr'), [sa, sb], { h: 180, bands: [[0.8, 1.3, 'var(--good)']], yMin: 0, label: 'Acute to chronic ratio by week' });
  else $('#lab-acwr').innerHTML = `<p class="muted small">ACWR needs 21+ days of training history (you have ${s.history}). Acute and chronic load are shown below.</p>`;
  drawMulti($('#lab-ac'), [{ name: 'Scenario 7-day load', color: 'var(--purple)', area: true, pts: mB.trans.map((t) => ({ date: t.date, v: t.acute })) }, { name: 'Scenario 28-day avg week', color: 'var(--accent)', pts: mB.trans.map((t) => ({ date: t.date, v: t.chronic })) }, { name: 'Baseline 7-day load', color: 'var(--muted)', dash: true, pts: mA.trans.map((t) => ({ date: t.date, v: t.acute })) }], { h: 180, yMin: 0, label: 'Acute and chronic load' });
  if (spB) drawFan($('#lab-shot'), { hist: sh.pts.filter((p) => daysBetween(p.date, s.date) < 120), lines: [{ name: 'Current volume (middle)', color: 'var(--muted)', dash: '5 5', pts: spA.rows.map((r) => ({ date: r.date, v: r.base })) }, { name: 'Scenario (middle)', color: 'var(--purple)', dash: '7 4', pts: spB.rows.map((r) => ({ date: r.date, v: r.base })) }], band: { name: 'Scenario range', color: 'var(--purple)', lo: spB.rows.map((r) => ({ date: r.date, v: r.cons })), hi: spB.rows.map((r) => ({ date: r.date, v: r.opt })) }, fmt: (v) => nf(v, 1) + '%', label: 'Shooting percentage projection' });
};

// ===================== Training A vs B (+ recovery & workload) =====================
LAB.train = (el) => {
  const d = labDraft('train');
  el.innerHTML = `${scenarioBar('train')}<section class="card"><div class="card-head"><div><h3>Training volume simulator</h3><span class="sub">Compare two weekly schedules. Uses the Load tab's math.</span></div>${kTag('h')}</div>
    <div class="grid two lab-cols"><div><h4 class="lab-h4"><span class="lab-ab a">A</span> Schedule A</h4>${planEditor('train.A', d.A)}</div><div><h4 class="lab-h4"><span class="lab-ab b">B</span> Schedule B</h4>${planEditor('train.B', d.B)}</div></div>
    <div class="row" style="margin-top:10px"><button type="button" class="chip" data-act="lab-ab" data-w="A">A = my data</button><button type="button" class="chip" data-act="lab-ab" data-w="B">B = my data</button><button type="button" class="chip" data-act="lab-ab" data-w="swap">Swap A ⇄ B</button></div>
    ${saveRow('train')}</section><div id="lab-out" class="stack" style="gap:14px"></div>`;
  LAB_OUT.train();
};
ACTIONS['lab-ab'] = (b) => { const d = labDraft('train'), s = labSnap('train'); if (b.dataset.w === 'swap') [d.A, d.B] = [d.B, d.A]; else d[b.dataset.w] = clonePlan(s.plan); saveDraft('train', d); refresh(); };
LAB_OUT.train = () => {
  const out = $('#lab-out'); if (!out) return;
  const d = labDraft('train'), s = labSnap('train'), A = planMetrics(d.A, s, 8), B = planMetrics(d.B, s, 8), tgt = s.targetDays;
  const k = (l, a, b, dd = 0, bt = 'none', fmt) => `<div class="kpi"><small>${l}</small><b>${fmt ? fmt(a) : nf(a, dd)} <span class="muted" style="font-size:15px">vs</span> ${fmt ? fmt(b) : nf(b, dd)}</b><span class="delta">B ${diffTxt(a, b, dd, bt)}</span></div>`;
  out.innerHTML = `<section class="card"><div class="card-head"><div><h3>A vs B</h3><span class="sub">One typical week of each ◆</span></div>${kTag('c')}</div>
      <div class="kpis four">${k('Hours / week', A.hours, B.hours, 1)}${k('Load / week', A.load, B.load)}${k('Sessions', A.sessions, B.sessions)}${k('Rest days', A.restDays, B.restDays, 0, 'up')}
      ${k('Longest streak', A.maxStreak, B.maxStreak, 0, 'down')}${k('Monotony', A.monotony ?? 0, B.monotony ?? 0, 2, 'down')}${k('Strain', A.strain ?? 0, B.strain ?? 0, 0, 'down')}${k('Shots / week', A.shotsWeek, B.shotsWeek)}</div>
      <p class="small" style="margin-top:10px"><b>Consistency:</b> A trains ${A.trainDays} days, B ${B.trainDays} days${tgt ? ` against your goal of ${tgt}` : ''}. Over the last 28 days you actually trained ${r1(s.activeDays28 / 4)} days a week ●${B.trainDays - s.activeDays28 / 4 >= 2 ? `, so B asks for ${r1(B.trainDays - s.activeDays28 / 4)} more days than you've been doing` : ''}.</p></section>
    <section class="card"><div class="card-head"><div><h3>Training distribution</h3></div></div>${weekBars(A, B)}
      <div class="lab-dist">${SIM_TYPES.map(([kk, l, c]) => { const a = A.byType.find((x) => x.k === kk).mins, b = B.byType.find((x) => x.k === kk).mins, mx = Math.max(1, ...A.byType.map((x) => x.mins), ...B.byType.map((x) => x.mins)); return a || b ? `<div class="ld-r"><span class="small">${l}</span><div><i style="width:${(a / mx) * 100}%;background:${c};opacity:.55"></i><i style="width:${(b / mx) * 100}%;background:${c}"></i></div><span class="tiny num">${a}→${b} min</span></div>` : ''; }).join('')}</div>
      <div class="grid two" style="margin-top:10px"><div><span class="tiny muted">A INTENSITY</span>${zoneBar(A)}</div><div><span class="tiny muted">B INTENSITY</span>${zoneBar(B)}</div></div></section>
    <section class="card"><div class="card-head"><div><h3>Recovery & workload</h3><span class="sub">If you switched from your real last 28 days to each plan</span></div>${kTag('f')}</div>
      <div class="chart" id="lab-tacwr"></div><div class="chart" id="lab-tload" style="margin-top:8px"></div>
      <div class="kpis four" style="margin-top:10px"><div class="kpi"><small>A switch-week ACWR</small><b style="font-size:18px">${acwrTxt(A.acwrFirst)}</b></div><div class="kpi"><small>B switch-week ACWR</small><b style="font-size:18px">${acwrTxt(B.acwrFirst)}</b></div><div class="kpi"><small>A hard days in a row</small><b>${A.hardStreak}</b></div><div class="kpi"><small>B hard days in a row</small><b>${B.hardStreak}</b></div></div>
      <p class="tiny muted" style="margin-top:8px">The 7-day line is an estimate of short-term fatigue from load only, not a measurement of how you feel. Information only, not an injury prediction.</p></section>
    <section class="card"><div class="card-head"><div><h3>Which is more sustainable?</h3><span class="sub">Checks on B compared with A</span></div></div>${listHtml(labTradeoffs(A, B, null))}${formulaBox(LOAD_FORMULAS)}</section>`;
  const ser = (m, n, c, dash) => ({ name: n, color: c, dash, pts: m.trans.filter((t) => t.acwr != null).map((t) => ({ date: t.date, v: t.acwr })) });
  const a1 = ser(A, 'A ratio', '#22c3ee'), b1 = ser(B, 'B ratio', 'var(--purple)');
  if (a1.pts.length || b1.pts.length) drawMulti($('#lab-tacwr'), [a1, b1], { h: 170, yMin: 0, bands: [[0.8, 1.3, 'var(--good)']], label: 'Acute to chronic ratio' });
  else $('#lab-tacwr').innerHTML = `<p class="muted small">ACWR needs 21+ days of history (you have ${s.history}).</p>`;
  drawMulti($('#lab-tload'), [{ name: 'A 7-day load', color: '#22c3ee', pts: A.trans.map((t) => ({ date: t.date, v: t.acute })) }, { name: 'B 7-day load', color: 'var(--purple)', area: true, pts: B.trans.map((t) => ({ date: t.date, v: t.acute })) }], { h: 170, yMin: 0, label: 'Weekly load by plan' });
};

// ===================== Shooting simulator =====================
LAB.shoot = (el) => {
  const d = labDraft('shoot'), s = labSnap('shoot'), sh = s.shooting;
  const n = (path, v, l, o = '') => `<label>${l}<input type="number" inputmode="decimal" value="${v ?? ''}" data-lab="shoot.${path}" ${o}></label>`;
  el.innerHTML = `${scenarioBar('shoot')}<section class="card"><div class="card-head"><div><h3>Shooting development simulator</h3><span class="sub">${sh.sessions ? `${sh.sessions} sessions on record · ${nf(sh.totalAttempts)} logged shots ●` : 'No shooting sessions logged: enter your numbers'}</span></div>${kTag('h')}</div>
    <div class="fields">${n('pct', d.pct, `Current % ${sh.pct != null ? `<span class="tiny muted">(30-day: ${sh.pct}%)</span>` : ''}`, 'min="0" max="100" step="0.5"')}${n('target', d.target, 'Target %', 'min="0" max="100" step="0.5"')}
      ${n('sessions', d.sessions, 'Now: sessions / week', 'min="0" max="14"')}${n('attempts', d.attempts, 'Now: shots / session', 'min="0" max="1500" step="25"')}
      ${n('nSessions', d.nSessions, 'Scenario: sessions / week', 'min="0" max="14"')}${n('nAttempts', d.nAttempts, 'Scenario: shots / session', 'min="0" max="1500" step="25"')}
      <label class="full">Training period <b class="lab-val">${d.weeks}</b> weeks<input type="range" min="2" max="26" value="${d.weeks}" data-lab="shoot.weeks"></label></div>
    <details class="lab-details" ${d.useAssume || !sh.trend ? 'open' : ''}><summary>Improvement rate ${sh.trend ? '(from your history)' : '(general assumption)'}</summary>
      ${sh.trend ? `<p class="small">Your sessions: <b>${sh.trend.per1000 > 0 ? '+' : ''}${sh.trend.per1000} % points per 1,000 shots</b> ± ${sh.trend.se} (${sh.trend.n} sessions over ${sh.trend.span} days, least squares) ◆. The range uses ±1.28 standard errors (about 80%).</p><label class="check"><input type="checkbox" data-lab="shoot.useAssume" ${d.useAssume ? 'checked' : ''}> Use my own assumption instead</label>`
    : `<p class="small">Not enough history for a personal rate (needs 5+ sessions of 20+ shots over 14+ days; you have ${sh.pts.length}). These are general assumptions, <b>not your data</b>. Edit them:</p>`}
      <div class="fields three">${['Conservative', 'Middle', 'Optimistic'].map((l, i) => `<label>${l}<input type="number" step="0.1" value="${d.assume?.[i] ?? SHOOT_ASSUME[i]}" data-lab="shoot.assume.${i}"></label>`).join('')}</div><p class="tiny muted">% points gained per 1,000 shots, before the slowdown near the ceiling. Conservative 0 means more volume alone doesn't move your %.</p></details>
    ${saveRow('shoot')}</section><div id="lab-out" class="stack" style="gap:14px"></div>`;
  LAB_OUT.shoot();
};
LAB_OUT.shoot = () => {
  const out = $('#lab-out'); if (!out) return;
  const d = labDraft('shoot'), s = labSnap('shoot'), sh = s.shooting;
  const now = shootProject(s, { ...d, sessions: d.sessions, attempts: d.attempts }), nw = shootProject(s, { ...d, sessions: d.nSessions, attempts: d.nAttempts });
  const at = (pr, w) => pr.rows[Math.min(w, pr.weeks)], marks = [4, 8, 12, 26].filter((w) => w <= nw.weeks);
  const hitTxt = (w) => (w == null ? 'not in period' : w === 0 ? 'already there' : `week ${w}`);
  out.innerHTML = `<section class="card"><div class="card-head"><div><h3>Volume</h3><span class="sub">Exact math from your inputs ◆</span></div>${kTag('c')}</div>
      <div class="kpis four"><div class="kpi"><small>Shots / week</small><b>${nf(now.perWeek)} → ${nf(nw.perWeek)}</b><span class="delta">${diffTxt(now.perWeek, nw.perWeek, 0, 'none')}</span></div><div class="kpi"><small>Shots / month</small><b>${nf(now.perMonth)} → ${nf(nw.perMonth)}</b></div>
      <div class="kpi"><small>Total in ${nw.weeks} weeks</small><b>${nf(now.total)} → ${nf(nw.total)}</b></div><div class="kpi"><small>Extra shots</small><b>${nf(nw.total - now.total)}</b><span class="delta tiny muted">≈ ${r1(((nw.total - now.total) / Math.max(1, nw.weeks)) / 10)} min more a week at ~10 shots/min</span></div></div>
      <div class="chart" id="lab-vol" style="margin-top:10px"></div></section>
    <section class="card"><div class="card-head"><div><h3>Shooting % scenarios</h3><span class="sub">${nw.src === 'history' ? 'Rates from your own sessions' : 'General assumption: not your data'} · not a prediction</span></div>${kTag('f')}</div>
      <div class="chart" id="lab-pct"></div>
      <div class="lab-table four" style="margin-top:10px"><div class="lt-h"><span>Week</span><span>Conservative</span><span>Middle</span><span>Optimistic</span></div>${marks.map((w) => `<div class="lt-r"><span>${w === 26 ? '6 months' : w + ' weeks'}</span><b class="num">${at(nw, w).cons}%</b><b class="num">${at(nw, w).base}%</b><b class="num">${at(nw, w).opt}%</b></div>`).join('')}
      <div class="lt-r"><span>Reach ${nw.target ?? '—'}%</span><span class="small">${hitTxt(nw.hit.cons)}</span><span class="small">${hitTxt(nw.hit.base)}</span><span class="small">${hitTxt(nw.hit.opt)}</span></div></div>
      <p class="small" style="margin-top:10px">At your current volume the middle line reaches <b>${at(now, now.weeks).base}%</b> by week ${now.weeks}; at the scenario volume, <b>${at(nw, nw.weeks).base}%</b>. ${nw.rates[0] <= 0 ? 'The conservative line shows the honest possibility that more shots alone don\'t change your %.' : ''}</p>
      ${formulaBox(['Volume = sessions × shots per session (per week); month = week × 52 ÷ 12.', `Rates (per 1,000 shots): conservative ${nw.rates[0]}, middle ${nw.rates[1]}, optimistic ${nw.rates[2]} % points${nw.src === 'history' ? ' = your least-squares trend ± 1.28 standard errors' : ' = general assumptions you can edit'}.`, 'Path: p = cap − (cap − now) × e^(−rate × shots ÷ (cap − now)), cap = now + 25 points (at most 90%). Negative rates fall in a straight line, at most 15 points.', 'Every rate is limited to ±2 points per 1,000 shots, because a few noisy sessions can make a trend look much steeper than it is.', 'Measured dots are your session %s with 20+ shots.'])}</section>`;
  drawMulti($('#lab-vol'), [{ name: 'Now', color: 'var(--muted)', dash: true, pts: now.rows.map((r) => ({ date: r.date, v: r.shots })) }, { name: 'Scenario', color: '#22c3ee', area: true, pts: nw.rows.map((r) => ({ date: r.date, v: r.shots })) }], { h: 160, yMin: 0, label: 'Cumulative shots' });
  drawFan($('#lab-pct'), { hist: sh.pts.filter((p) => daysBetween(p.date, s.date) < 120), goal: nw.target, fmt: (v) => nf(v, 1) + '%', label: 'Shooting percentage scenarios',
    lines: [{ name: 'No change', color: 'var(--muted)', dash: '2 4', w: 1.6, pts: nw.rows.map((r) => ({ date: r.date, v: r.flat })) }, { name: 'Now volume (middle)', color: '#22c3ee', dash: '5 5', pts: now.rows.map((r) => ({ date: r.date, v: r.base })) }, { name: 'Scenario (middle)', color: 'var(--purple)', dash: '8 4', pts: nw.rows.map((r) => ({ date: r.date, v: r.base })) }],
    band: { name: 'Scenario range', color: 'var(--purple)', lo: nw.rows.map((r) => ({ date: r.date, v: r.cons })), hi: nw.rows.map((r) => ({ date: r.date, v: r.opt })) } });
};

// ===================== Athletic simulator =====================
LAB.ath = (el) => {
  const d = labDraft('ath'), s = labSnap('ath'), tb = s.tests[d.test], t = testById(d.test) || TESTS[0], fk = ATH_FOCUS[t.group] || 'strength';
  const opts = allTests().filter((x) => ATH_IDS.includes(x.id) || s.tests[x.id]);
  el.innerHTML = `${scenarioBar('ath')}<section class="card"><div class="card-head"><div><h3>Athletic development simulator</h3><span class="sub">Vertical, speed, agility, strength and conditioning</span></div>${kTag('h')}</div>
    <div class="fields"><label class="full">Test<select data-lab="ath.test">${opts.map((x) => `<option value="${x.id}" ${x.id === d.test ? 'selected' : ''}>${esc(x.name)}${s.tests[x.id] ? ` · ${s.tests[x.id].n} result${s.tests[x.id].n > 1 ? 's' : ''}` : ''}</option>`).join('')}</select></label>
      <label>Current (${esc(t.unit)}) ${tb ? '<span class="tiny muted">● latest</span>' : ''}<input type="number" inputmode="decimal" step="0.1" value="${d.cur}" data-lab="ath.cur" placeholder="Enter"></label><label>Target (${esc(t.unit)})<input type="number" inputmode="decimal" step="0.1" value="${d.target}" data-lab="ath.target"></label>
      <label>${esc(simType(fk)[1])} sessions / wk now<input type="number" min="0" max="14" value="${d.focusNow}" data-lab="ath.focusNow"></label><label>${esc(simType(fk)[1])} sessions / wk in scenario<input type="number" min="0" max="14" value="${d.focusNew}" data-lab="ath.focusNew"></label>
      <label class="full">Training period <b class="lab-val">${d.weeks}</b> weeks<input type="range" min="2" max="26" value="${d.weeks}" data-lab="ath.weeks"></label></div>
    <p class="tiny muted">${t.better === 'lower' ? 'Lower is better for this test.' : 'Higher is better for this test.'} Sessions that target it: ${esc(simType(fk)[1].toLowerCase())}.</p>${saveRow('ath')}</section><div id="lab-out" class="stack" style="gap:14px"></div>`;
  LAB_OUT.ath();
};
LAB_OUT.ath = () => {
  const out = $('#lab-out'); if (!out) return;
  const d = labDraft('ath'), s = labSnap('ath'), t = testById(d.test) || TESTS[0], tb = s.tests[d.test] || { id: t.id, name: t.name, unit: t.unit, better: t.better, group: t.group, cur: null, rate: null, n: 0, span: 0, pts: [] };
  if (d.cur === '' || d.cur == null || !Number.isFinite(Number(d.cur))) { out.innerHTML = `<section class="card">${emptyState('Enter your current number', `There's no ${t.name} result on record. Type your current value above, or log a test so it's measured.`, 'chart', '<button type="button" class="btn sm primary" data-act="add-test">Log a test</button>')}</section>`; return; }
  const p = athProject(tb, { ...d, start: s.date }), base = athProject(tb, { ...d, focusNew: d.focusNow, start: s.date }), f = (v) => fmtVal(t, v);
  const marks = [4, 8, 12, 26].filter((w) => w <= p.weeks), hitTxt = (w) => (w == null ? 'not in period' : w === 0 ? 'already there' : `week ${w}`);
  out.innerHTML = `<section class="card"><div class="card-head"><div><h3>${esc(t.name)} trajectories</h3><span class="sub">${p.src === 'history' ? `Your rate: ${tb.rate > 0 ? '+' : ''}${tb.rate}% per 4 weeks from ${tb.n} results over ${tb.span} days ◆` : `General assumption for ${t.group.toLowerCase()} (not your data)${tb.n === 1 ? ': one result isn\'t enough for a personal rate' : ''}`}</span></div>${kTag('f')}</div>
      <div class="chart" id="lab-ath"></div>
      <div class="lab-table four" style="margin-top:10px"><div class="lt-h"><span>Week</span><span>Conservative</span><span>Middle</span><span>Optimistic</span></div>${marks.map((w) => `<div class="lt-r"><span>${w === 26 ? '6 months' : w + ' weeks'}</span><b class="num">${esc(f(p.rows[w].cons))}</b><b class="num">${esc(f(p.rows[w].base))}</b><b class="num">${esc(f(p.rows[w].opt))}</b></div>`).join('')}
      ${p.target != null ? `<div class="lt-r"><span>Reach ${esc(f(p.target))}</span><span class="small">${hitTxt(p.hit.cons)}</span><span class="small">${hitTxt(p.hit.base)}</span><span class="small">${hitTxt(p.hit.opt)}</span></div>` : ''}</div>
      <p class="small" style="margin-top:10px">Going from ${d.focusNow} to ${d.focusNew} ${esc(simType(ATH_FOCUS[t.group] || 'strength')[1].toLowerCase())} sessions a week changes the rate by ×${p.factor} in this model. Middle estimate after ${p.weeks} weeks: <b>${esc(f(base.rows[p.weeks].base))}</b> without the change vs <b>${esc(f(p.rows[p.weeks].base))}</b> with it.</p>
      ${formulaBox([`Rates per 4 weeks: conservative ${p.rates[0]}%, middle ${p.rates[1]}%, optimistic ${p.rates[2]}% (after the focus factor ×${p.factor}).`, p.src === 'history' ? 'Personal rate = least-squares slope of your results (or first-to-last with 2), as % of your first result per 28 days. Conservative = half, optimistic = 1.5×. If you have been getting worse, conservative keeps that rate and middle assumes no change.' : `General assumption for ${t.group}: ${(ATH_ASSUME[t.group] || ATH_ASSUME.Custom).join(' / ')}% per 4 weeks. Editable by logging real results: 2 results 14+ days apart switch it to your own rate.`, 'Gains shrink 15% each 4-week block (progress slows as you get closer to your ceiling).', 'Focus factor = √((scenario sessions + 0.5) ÷ (current sessions + 0.5)), limited to 0.5–1.5.', `Rates are limited to ±${p.max}% per 4 weeks for ${t.group.toLowerCase()}: short test histories make trends look steeper than they last.`])}</section>`;
  const pts = (k) => p.rows.map((r) => ({ date: r.date, v: r[k] }));
  drawFan($('#lab-ath'), { hist: tb.pts || [], goal: p.target, fmt: f, label: t.name + ' projection', lines: [{ name: 'Without change (middle)', color: 'var(--muted)', dash: '5 5', pts: base.rows.map((r) => ({ date: r.date, v: r.base })) }, { name: 'Scenario (middle)', color: 'var(--purple)', dash: '8 4', pts: pts('base') }], band: { name: 'Scenario range', color: 'var(--purple)', lo: pts('cons'), hi: pts('opt') } });
};

// ===================== saving & managing simulations =====================
function labSummary(kind, d, snap) {
  if (kind === 'build' || kind === 'train') { const a = planMetrics(kind === 'build' ? snap.plan : d.A, snap), b = planMetrics(kind === 'build' ? d.mod : d.B, snap); return `${a.hours} → ${b.hours} h/wk · load ${nf(a.load)} → ${nf(b.load)}`; }
  if (kind === 'shoot') { const p = shootProject(snap, { ...d, sessions: d.nSessions, attempts: d.nAttempts }); return `${nf(p.perWeek)} shots/wk · ${p.rows[p.weeks].cons}–${p.rows[p.weeks].opt}% at wk ${p.weeks}`; }
  if (kind === 'ath') { const tb = snap.tests[d.test] || { ...testById(d.test), rate: null }, t = testById(d.test); if (d.cur === '' || !t) return ''; const p = athProject(tb, { ...d, start: snap.date }); return `${t.name}: ${fmtVal(t, p.rows[p.weeks].cons)}–${fmtVal(t, p.rows[p.weeks].opt)} at wk ${p.weeks}`; }
  return '';
}
function labResults(kind, d, snap) {
  // What the simulation said, frozen at save time (used later to compare with real results).
  if (kind === 'shoot') { const p = shootProject(snap, { ...d, sessions: d.nSessions, attempts: d.nAttempts }); return { metric: 'shootPct', rows: p.rows.filter((r) => [4, 8, 12, 26].includes(r.w) || r.w === p.weeks) }; }
  if (kind === 'ath' && d.cur !== '') { const tb = snap.tests[d.test] || { ...testById(d.test), rate: null }, p = athProject(tb, { ...d, start: snap.date }); return { metric: 'test:' + d.test, rows: p.rows.filter((r) => [4, 8, 12, 26].includes(r.w) || r.w === p.weeks) }; }
  if (kind === 'build' || kind === 'train') { const b = planMetrics(kind === 'build' ? d.mod : d.B, snap); return { metric: 'plan', hours: b.hours, load: b.load, restDays: b.restDays, acwrFirst: b.acwrFirst, shotsWeek: b.shotsWeek }; }
  return null;
}
ACTIONS['lab-save'] = (b) => {
  const kind = b.dataset.kind, def = { build: 'My scenario', train: 'Schedule A vs B', shoot: 'Shooting plan', ath: (testById(labDraft('ath').test)?.name || 'Athletic') + ' plan' }[kind];
  openSheet('Save simulation', `<label>Name<input id="lab-name" maxlength="60" value="${esc(def)} · ${esc(fmtD(todayIso()))}"></label><p class="tiny muted">Saves the inputs, your baseline as of today and the results. It never changes your real training.</p><button type="button" class="btn primary block" id="lab-name-ok">Save</button>`, (dlg) => {
    const inp = $('#lab-name', dlg); inp.select();
    $('#lab-name-ok', dlg).addEventListener('click', () => {
      const name = inp.value.trim() || def, d = JSON.parse(JSON.stringify(labDraft(kind))), snap = JSON.parse(JSON.stringify(labSnap(kind))), now = new Date().toISOString();
      if (sim().scenarios.some((x) => x.name === name && x.kind === kind && JSON.stringify(x.inputs) === JSON.stringify(d))) { closeSheet(); return toast('Already saved with the same name and inputs'); }
      const sc = { id: uid('sim'), name: name.slice(0, 60), kind, created: now, updated: now, model: LAB_MODEL, inputs: d, snap, summary: labSummary(kind, d, snap), results: labResults(kind, d, snap) };
      sim().scenarios.push(sc); labSaveDoc(); const o = ui('labOpen', {}); o[kind] = sc.id; setUi('labOpen', o); closeSheet(); refresh(); toast('Simulation saved');
    });
  });
};
ACTIONS['lab-update'] = (b) => { const kind = b.dataset.kind, sc = openSc(kind); if (!sc) return; sc.inputs = JSON.parse(JSON.stringify(labDraft(kind))); sc.updated = new Date().toISOString(); sc.summary = labSummary(kind, sc.inputs, sc.snap); sc.results = labResults(kind, sc.inputs, sc.snap); labSaveDoc(); refresh(); toast('Changes saved'); };
ACTIONS['lab-open'] = (b) => { const sc = sim().scenarios.find((x) => x.id === b.dataset.id); if (!sc) return; const o = ui('labOpen', {}); o[sc.kind] = sc.id; setUi('labOpen', o); saveDraft(sc.kind, JSON.parse(JSON.stringify(sc.inputs))); closeSheet(); go('lab', sc.kind); };
ACTIONS['lab-close'] = (b) => { const o = ui('labOpen', {}); delete o[b.dataset.kind]; setUi('labOpen', o); refresh(); };
ACTIONS['lab-reset'] = (b) => { const all = ui('labD', {}), k = b.dataset.kind; delete all[k]; setUi('labD', all); const sc = openSc(k); if (sc) saveDraft(k, JSON.parse(JSON.stringify(sc.inputs))); refresh(); };
ACTIONS['lab-more'] = (b) => {
  const sc = sim().scenarios.find((x) => x.id === b.dataset.id); if (!sc) return;
  openSheet(sc.name, `<p class="tiny muted">Created ${esc(fmtDL(sc.created.slice(0, 10)))} · baseline from ${esc(fmtDL(sc.snap.date))}</p>
    <label>Rename<input id="lab-rn" maxlength="60" value="${esc(sc.name)}"></label><div class="row"><button type="button" class="btn sm primary" id="lab-rn-ok">Save name</button><button type="button" class="btn sm" data-act="lab-open" data-id="${sc.id}">Open</button><button type="button" class="btn sm" id="lab-dup">Duplicate</button><button type="button" class="btn sm danger" id="lab-del">Delete</button></div>`, (dlg) => {
    $('#lab-rn-ok', dlg).addEventListener('click', () => { const v = $('#lab-rn', dlg).value.trim(); if (!v) return; sc.name = v.slice(0, 60); sc.updated = new Date().toISOString(); labSaveDoc(); closeSheet(); refresh(); toast('Renamed'); });
    $('#lab-dup', dlg).addEventListener('click', () => { const c = JSON.parse(JSON.stringify(sc)), now = new Date().toISOString(); Object.assign(c, { id: uid('sim'), name: (sc.name + ' (copy)').slice(0, 60), created: now, updated: now }); sim().scenarios.push(c); labSaveDoc(); closeSheet(); refresh(); toast('Duplicated'); });
    $('#lab-del', dlg).addEventListener('click', () => confirmSheet(`Delete "${sc.name}"? Your real training data is not affected.`, 'Delete', () => { sim().scenarios = sim().scenarios.filter((x) => x.id !== sc.id); const o = ui('labOpen', {}); for (const k of Object.keys(o)) if (o[k] === sc.id) delete o[k]; setUi('labOpen', o); labSaveDoc(); refresh(); toast('Simulation deleted'); }));
  });
};
