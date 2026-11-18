// ===================== Command Center =====================
const CARDS = [
  { id: 'ais', title: 'Athlete Intelligence Score', span: 'span-8' },
  { id: 'radar', title: 'Performance radar', span: 'span-4' },
  { id: 'physical', title: 'Physical performance profile', span: 'span-6' },
  { id: 'skills', title: 'Basketball skill profile', span: 'span-6' },
  { id: 'strengths', title: 'Athletic strengths', span: 'span-6' },
  { id: 'weaknesses', title: 'Development weaknesses', span: 'span-6' },
  { id: 'trends', title: 'Skill development trend', span: 'span-8' },
  { id: 'distribution', title: 'Strength / weakness distribution', span: 'span-4' },
  { id: 'consistency', title: 'Performance consistency', span: 'span-6' },
  { id: 'history', title: 'Testing history', span: 'span-6' },
  { id: 'projections', title: 'Performance projections', span: 'span-6' },
  { id: 'insights', title: 'Latest insights', span: 'span-6' },
  { id: 'compare', title: 'Athletic profile comparison', span: 'span-6' },
  { id: 'activity', title: 'Training activity', span: 'span-6' },
  { id: 'reports', title: 'Recent reports', span: 'span-12' },
];
let customizing = false;
function cardLayout() {
  const c = doc('meta').cards || {}; const order = (c.order || []).filter((id) => CARDS.some((x) => x.id === id));
  for (const x of CARDS) if (!order.includes(x.id)) order.push(x.id);
  return { order, hidden: new Set(c.hidden || []) };
}
function noAthleteState() {
  return `<div class="empty"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="10" width="52" height="40" rx="4"/><path d="M14 40l10-12 8 7 10-15 8 9"/><circle cx="24" cy="28" r="2"/><circle cx="42" cy="20" r="2"/></svg>
    <h3>No athlete profile yet</h3><p>Create a profile, then log tests, shots, drills and games. Every score in the lab is calculated from what you enter, with the formula one click away.</p>
    <div class="row"><button type="button" class="btn" data-act="new-ath">Create athlete profile</button><button type="button" class="btn ghost" data-act="demo">Explore with an example athlete</button></div>
    <p class="small muted">The example athlete is clearly labelled demo data and can be deleted in one step.</p></div>`;
}
function renderCommand() {
  const el = $('#view-command'), a = curAthlete();
  if (!a) { el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Command Center</span><h1>Athlete Intelligence Lab</h1></div></div>${noAthleteState()}`; bindActs(el); return; }
  const R = S.R, L = cardLayout();
  const age = ageOf(a);
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Command Center · ${esc(rangeLabel(R))}</span><h1>${esc(a.name)}</h1>
      <p>${[a.sport, POSITIONS[a.pos], a.height ? fmtHeight(a.height) : '', a.weight ? a.weight + ' lb' : '', age != null ? age + ' yrs' : '', a.exp != null ? a.exp + ' yrs training' : ''].filter(Boolean).map(esc).join(' · ')}${a.demo ? ' <span class="tag demo">demo data</span>' : ''}</p></div>
      <div class="row"><button type="button" class="btn ghost" data-act="log">${icon('plus')} Log data</button><button type="button" class="btn ghost" data-act="customize" aria-pressed="${customizing}">Customize cards</button></div></div>
    ${customizing ? customizePanel(L) : ''}
    <div class="grid">${L.order.filter((id) => !L.hidden.has(id)).map((id) => { const c = CARDS.find((x) => x.id === id); return `<section class="card ${c.span}" id="card-${id}"><div class="card-h"><h2>${c.title}</h2><span class="meta" id="meta-${id}"></span></div>${cardBody(id, R, a)}</section>`; }).join('')}</div>`;
  bindActs(el);
  if (customizing) bindCustomize(el);
  const ts = $('#trend-metric', el); if (ts) ts.onchange = () => { uiSet('trendMetric', ts.value); renderCommand(); };
  const cs = $('#cmp-src', el); if (cs) cs.onchange = () => { uiSet('cmpSrc', cs.value); renderCommand(); };
  mountCharts(el);
}
function customizePanel(L) {
  return `<div class="card"><div class="card-h"><h3>Customize the dashboard</h3><button type="button" class="btn sm" data-act="customize">Done</button></div>
    <div class="customize">${L.order.map((id, i) => { const c = CARDS.find((x) => x.id === id); return `<div class="cz-row"><label><input type="checkbox" data-cz-show="${id}" ${L.hidden.has(id) ? '' : 'checked'}> ${c.title}</label>
      <button type="button" class="icon-btn" data-cz-up="${i}" aria-label="Move ${c.title} up" ${i ? '' : 'disabled'}>${icon('up')}</button><button type="button" class="icon-btn" data-cz-down="${i}" aria-label="Move ${c.title} down" ${i < L.order.length - 1 ? '' : 'disabled'}>${icon('down')}</button></div>`; }).join('')}</div>
    <div class="row"><button type="button" class="btn ghost sm" data-act="cz-reset">Reset layout</button></div></div>`;
}
function bindCustomize(el) {
  const save = (L) => { doc('meta').cards = { order: L.order, hidden: [...L.hidden] }; persist('meta'); renderCommand(); };
  for (const b of $$('[data-cz-show]', el)) b.onchange = () => { const L = cardLayout(); b.checked ? L.hidden.delete(b.dataset.czShow) : L.hidden.add(b.dataset.czShow); save(L); };
  for (const b of $$('[data-cz-up]', el)) b.onclick = () => { const L = cardLayout(), i = +b.dataset.czUp; [L.order[i - 1], L.order[i]] = [L.order[i], L.order[i - 1]]; save(L); };
  for (const b of $$('[data-cz-down]', el)) b.onclick = () => { const L = cardLayout(), i = +b.dataset.czDown; [L.order[i + 1], L.order[i]] = [L.order[i], L.order[i + 1]]; save(L); };
}
/** Shared button actions across views. */
function bindActs(root) {
  for (const b of $$('[data-act]', root)) b.onclick = (e) => {
    const a = b.dataset.act;
    if (a === 'new-ath') athleteForm();
    else if (a === 'demo') { loadDemo(); toast('Example athlete loaded'); rerender(); }
    else if (a === 'customize') { customizing = !customizing; renderCommand(); }
    else if (a === 'cz-reset') { doc('meta').cards = null; persist('meta'); renderCommand(); }
    else if (a === 'log') logMenu();
    else if (a === 'go') go(b.dataset.to);
    else if (a === 'report') { const r = makeReport(); go('reports'); openReport(r.id); }
    else if (a === 'ai') aiInsight(b);
  };
  for (const b of $$('[data-fx]', root)) b.onclick = () => { go('method'); setTimeout(() => document.getElementById('m-' + b.dataset.fx)?.scrollIntoView({ block: 'start' }), 60); };
}
function logMenu() {
  if (needAthlete()) return;
  openSheet('Log data', `<div class="customize">
    <button type="button" class="cz-row" data-l="test"><b>Test result</b><span class="muted small">Sprint, jump, lift, agility, conditioning</span></button>
    <button type="button" class="cz-row" data-l="session"><b>Testing session</b><span class="muted small">Several tests on one day, same conditions</span></button>
    <button type="button" class="cz-row" data-l="shot"><b>Shots on the court</b><span class="muted small">Tap locations on the shot chart</span></button>
    <button type="button" class="cz-row" data-l="tally"><b>Shooting set</b><span class="muted small">Makes / attempts by zone and shot type</span></button>
    <button type="button" class="cz-row" data-l="handle"><b>Ball-handling drill</b></button><button type="button" class="cz-row" data-l="finish"><b>Finishing set</b></button><button type="button" class="cz-row" data-l="game"><b>Game stats</b></button></div>`,
    { onOpen: (d) => { for (const b of $$('[data-l]', d)) b.onclick = () => { const k = b.dataset.l; closeSheet(); ({ test: () => testForm(), session: () => { go('testing'); startSession(); }, shot: () => { go('hoops'); setHoopsTab('chart'); }, tally: () => shotTallyForm(), handle: () => handleForm(), finish: () => finishForm(), game: () => gameForm() })[k](); }; } });
}

function cardBody(id, R, a) {
  try { return CARD_BODY[id](R, a); } catch (e) { console.error(e); return '<p class="muted small">This card could not be drawn.</p>'; }
}
const scoreChip = (s) => (s == null ? '<span class="muted">—</span>' : `<b class="num">${s}</b>`);
const CARD_BODY = {
  ais(R, a) {
    const I = intelScore(R, a), sc = I.score, C = 2 * Math.PI * 62, off = sc == null ? C : C * (1 - sc / 100);
    const nMeas = listOf('records', R).length + listOf('shots', R).length + listOf('drills', R).length + listOf('games', R).length;
    return `<div class="ais"><div class="ais-dial"><svg viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="62" fill="none" stroke="var(--surface-3)" stroke-width="10"/><circle cx="75" cy="75" r="62" fill="none" stroke="var(--acc)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 75 75)"/></svg>
      <div class="n"><b>${sc ?? '—'}</b><small>OF 100</small></div></div>
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
        <div class="row">${I.provisional ? '<span class="tag prov">Provisional · limited data</span>' : '<span class="tag m">Calculated</span>'}${I.est ? '<span class="tag e">Includes estimates</span>' : ''}${fxLink('ais')}</div>
        <div class="ais-sub">
          <div class="kpi"><span>Physical index</span><b>${I.physical.score ?? '—'}</b><small>${I.physical.cats}/${I.physical.of} categories measured</small></div>
          <div class="kpi"><span>Skill index</span><b>${I.skill.score ?? '—'}</b><small>${I.skill.cats}/${I.skill.of} categories measured</small></div>
          <div class="kpi"><span>Data coverage</span><b>${Math.round(I.coverage * 100)}%</b><div class="cov"><i style="width:${I.coverage * 100}%"></i></div></div>
          <div class="kpi"><span>Entries in range</span><b>${nMeas}</b><small>tests, shot logs, drills, games</small></div>
        </div>
        <p class="small muted">Weighted mean of category benchmark scores, weighted for a ${POSITIONS[a.pos]?.toLowerCase() || 'player'}. Categories without data are left out, not scored as zero.</p>
      </div></div>`;
  },
  radar(R) {
    const cs = catScores(R), cmp = previousRange(R), cs2 = cmp ? catScores(cmp.R) : null;
    const series = [{ name: rangeLabel(R), color: 'var(--s1)', values: CAT_IDS.map((c) => cs[c].score) }];
    if (cs2 && CAT_IDS.some((c) => cs2[c].score != null)) series.push({ name: cmp.label, color: 'var(--s2)', values: CAT_IDS.map((c) => cs2[c].score), dashed: true });
    return chart((w) => radarSVG(w, { axes: CAT_IDS.map((c) => ({ label: CATS[c].name })), series, label: 'Category benchmark scores' })) + `<p class="small muted">Benchmark score per category (0 = reference floor, 100 = reference elite). ${fxLink('bench')}</p>`;
  },
  physical(R) { return profileBars(R, PHYS); },
  skills(R) { return profileBars(R, SKILL); },
  strengths(R) {
    const I = intel(R), L = I.strengths.slice(0, 6);
    return L.length ? `<ul class="list">${L.map((s) => `<li><span class="k s">${esc(s.kind)}</span><span class="t"><b>${esc(s.m.name)}</b> ${s.est ? ESTIMATE : ''}<br><span class="muted small">${esc(s.txt)}</span></span></li>`).join('')}</ul>${fxLink('sw', 'ƒ how strengths are found')}` : '<p class="muted small">No strengths identified yet. A strength needs a benchmark score of 70+, a clear improving trend (3+ results over 14+ days), very consistent results, or a new personal record.</p>';
  },
  weaknesses(R) {
    const I = intel(R), L = [...I.weaknesses.slice(0, 5), ...I.imbalances.slice(0, 2).map((x) => ({ kind: 'Imbalance', m: { name: x.kind }, txt: x.txt }))];
    const miss = I.missing.length;
    return (L.length ? `<ul class="list">${L.map((s) => `<li><span class="k ${s.kind === 'Imbalance' ? 'i' : 'w'}">${esc(s.kind)}</span><span class="t"><b>${esc(s.m.name)}</b><br><span class="muted small">${esc(s.txt)}</span></span></li>`).join('')}</ul>` : '<p class="muted small">No weaknesses identified from the data in this range.</p>')
      + (miss ? `<p class="small muted">${miss} measure${miss > 1 ? 's have' : ' has'} too little data to judge, so ${miss > 1 ? 'they are' : 'it is'} not listed as weak. <button type="button" class="btn link" data-act="go" data-to="intel">See what to test</button></p>` : '');
  },
  trends(R) {
    const opts = metrics().filter((m) => m.series(R).length >= 2);
    if (!opts.length) return '<p class="muted small">Trends appear once a measure has 2+ results in the range.</p>';
    let id = uiGet('trendMetric', 'vmax'); if (!opts.some((m) => m.id === id)) id = opts[0].id;
    const m = metric(id);
    const metaTxt = trendOf(m, m.series(R));
    return `<div class="row"><label class="fld grow" style="max-width:340px"><span>Measure</span><select id="trend-metric">${opts.map((o) => `<option value="${o.id}" ${o.id === id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
      ${metaTxt ? `<span class="chip">${signed(metaTxt.per30 * 100, 1, '%')} / month · r² ${fmt(metaTxt.fit.r2, 2)}</span>` : ''}</div>` + chart((w) => metricLine(w, m, R));
  },
  distribution(R) {
    const I = intel(R), sc = I.rows.filter((x) => x.score != null && x.m.scored);
    if (!sc.length) return '<p class="muted small">No scored measures in this range.</p>';
    const bands = [[80, 101, '80–100 elite'], [60, 80, '60–79 strong'], [40, 60, '40–59 developing'], [20, 40, '20–39 weak'], [0, 20, '0–19 priority']];
    const max = Math.max(...bands.map(([a, b]) => sc.filter((x) => x.score >= a && x.score < b).length));
    return barsHTML(bands.map(([a, b, l]) => { const xs = sc.filter((x) => x.score >= a && x.score < b); return { label: l, value: max ? (100 * xs.length) / max : 0, display: xs.length, color: scoreColor(a + 10), tip: xs.map((x) => `${x.m.name}: ${x.score}`).join('<br>') || 'None' }; })) + `<p class="small muted">${sc.length} scored measures. Hover a band to see them.</p>`;
  },
  consistency(R) {
    const I = intel(R), L = I.rows.filter((x) => x.cons != null && x.m.kind === 'test').sort((a, b) => a.cons - b.cons).slice(0, 10);
    if (!L.length) return '<p class="muted small">Consistency needs 3+ results for a test. CV = standard deviation ÷ mean of the last 6 results.</p>';
    return barsHTML(L.map((x) => ({ label: x.m.name, value: Math.min(100, x.cons * 1000), display: (x.cons * 100).toFixed(1) + '%', color: x.cons <= 0.03 ? 'var(--good)' : x.cons <= 0.08 ? 'var(--warn)' : 'var(--crit)', tip: `CV of last ${Math.min(6, x.n)} results` }))) + `<div class="row small muted"><span class="status good">≤3% very consistent</span><span class="status warn">3–8%</span><span class="status crit">&gt;8% inconsistent</span>${fxLink('cv')}</div>`;
  },
  history(R) {
    const L = listOf('records', R).slice(-8).reverse();
    if (!L.length) return '<p class="muted small">No test results in this range. <button type="button" class="btn link" data-act="go" data-to="testing">Open the Testing Lab</button></p>';
    return `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Test</th><th class="n">Result</th><th></th></tr></thead><tbody>${L.map((r) => { const t = testDef(r.test), m = metric(r.test); if (!t) return ''; const v = recValue(r, t), best = bestOf(m, null), pr = best && best.id === r.id && m.series(null).length > 1; return `<tr><td class="mono">${fmtShort(r.date)}</td><td>${esc(t.name)}</td><td class="n">${fmtVal(m, v)}</td><td>${mtag(recEst(r, t))} ${pr ? '<span class="tag pr">PR</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
  },
  projections(R) {
    const P = metrics().map((m) => projection(m, R)).filter(Boolean).sort((a, b) => b.reliable - a.reliable || Math.abs(b.per30) - Math.abs(a.per30)).slice(0, 6);
    if (!P.length) return '<p class="muted small">Projections need 3+ results over at least 21 days for a measure.</p>';
    return `<div class="tbl-wrap"><table><thead><tr><th>Measure</th><th class="n">Latest</th><th class="n">+30 days</th><th class="n">+90 days</th><th class="n">Fit</th></tr></thead><tbody>${P.map((p) => `<tr><td>${esc(p.m.name)} ${p.reliable ? '' : '<span class="tag prov" title="Low r² or few points">weak fit</span>'}</td><td class="n">${fmtVal(p.m, p.last.v)}</td><td class="n">${fmtVal(p.m, p.p30)}</td><td class="n">${fmtVal(p.m, p.p90)}</td><td class="n">r² ${fmt(p.r2, 2)} · n ${p.n}</td></tr>`).join('')}</tbody></table></div><p class="row small muted">${ESTIMATE} Straight-line extension of the trend, capped near the elite reference. ${fxLink('proj')}</p>`;
  },
  insights(R, a) {
    const ins = computedInsights(R), ai = doc('meta').ai;
    const mine = ai && ai.aid === a.id ? ai : null;
    return `<ul class="list">${ins.map((i) => `<li><span class="k ${i.t === 'down' || i.t === 'imb' ? 'w' : i.t === 'gap' ? 'n' : 's'}">${{ pr: 'PR', up: 'Trend', down: 'Trend', imb: 'Balance', pri: 'Priority', gap: 'Coverage' }[i.t]}</span><span class="t">${esc(i.txt)}</span></li>`).join('') || '<li class="muted">Log more data to generate insights.</li>'}</ul>
      <p class="small muted">Computed from your data by fixed rules (no AI).</p>
      ${AI.sample ? `<div class="ai-box" id="ai-box">${mine ? `<span class="tag ai">AI · Claude</span> <span class="small muted">${new Date(mine.ts).toLocaleString()}</span>\n${esc(mine.text)}` : 'Ask Claude to read this summary and write a short evaluation. It only sees the computed numbers on this page.'}</div><div class="row"><button type="button" class="btn ghost sm" data-act="ai">${icon('spark')} ${mine ? 'Refresh AI analysis' : 'Generate AI analysis'}</button></div>` : ''}`;
  },
  compare(R, a) {
    const others = athletes().filter((x) => x.id !== a.id), reps = doc('meta').reports.filter((r) => r.aid === a.id);
    const opts = { prev: 'Previous period', ...Object.fromEntries(others.map((x) => ['ath:' + x.id, 'Athlete: ' + x.name])), ...Object.fromEntries(reps.map((r) => ['rep:' + r.id, 'Report: ' + fmtDate(r.date)])) };
    let src = uiGet('cmpSrc', 'prev'); if (!opts[src]) src = 'prev';
    const cs = catScores(R); let cs2 = null, label = '';
    if (src === 'prev') { const p = previousRange(R); if (p) { cs2 = catScores(p.R); label = p.label; } }
    else if (src.startsWith('ath:')) { const o = athletes().find((x) => x.id === src.slice(4)); const keep = doc('athletes').current; doc('athletes').current = o.id; cs2 = catScores(R); doc('athletes').current = keep; label = o.name; }
    else { const r = reps.find((x) => 'rep:' + x.id === src); cs2 = Object.fromEntries(CAT_IDS.map((c) => [c, { score: r.cats[c] ?? null }])); label = 'Report ' + fmtDate(r.date); }
    const series = [{ name: a.name + ' · ' + rangeLabel(R), color: 'var(--s1)', values: CAT_IDS.map((c) => cs[c].score) }];
    if (cs2) series.push({ name: label, color: 'var(--s2)', values: CAT_IDS.map((c) => cs2[c].score), dashed: true });
    return `<label class="fld" style="max-width:340px"><span>Compare with</span>${sel('cmp-src', opts, src).replace('name="cmp-src" id="f-cmp-src"', 'id="cmp-src"')}</label>` + chart((w) => radarSVG(w, { axes: CAT_IDS.map((c) => ({ label: CATS[c].name })), series })) + (cs2 ? '' : '<p class="small muted">Nothing to compare yet for this choice.</p>');
  },
  activity() {
    const counts = {};
    for (const k of ['records', 'shots', 'drills', 'games']) for (const r of listOf(k, null)) counts[r.date] = (counts[r.date] || 0) + (k === 'shots' ? 0 : 1);
    for (const s of listOf('shots', null)) counts[s.date] = (counts[s.date] || 0) + (s.att >= 5 ? 1 : 0.1);
    for (const k in counts) counts[k] = Math.round(counts[k]);
    return chart((w) => calendarSVG(w, { counts, weeks: 26, unit: 'entries' })) + '<p class="small muted">Logged entries per day, last 26 weeks (shot logs counted per set).</p>';
  },
  reports(R, a) {
    const L = doc('meta').reports.filter((r) => r.aid === a.id).slice(-3).reverse();
    return `<div class="row">${L.map((r) => `<button type="button" class="btn ghost sm" data-open-report="${r.id}">${fmtDate(r.date)} · AIS ${r.ais ?? '—'}</button>`).join('') || '<span class="muted small">No reports yet. A report freezes today\'s scores so you can compare later.</span>'}<span class="grow"></span><button type="button" class="btn sm" data-act="report">Generate report</button></div>`;
  },
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-open-report]'); if (b) { go('reports'); openReport(b.dataset.openReport); } });
function profileBars(R, cats) {
  const items = [];
  for (const c of cats) {
    const cs = catScores(R)[c];
    for (const p of cs.parts) {
      const first = p.m.series ? p.m.series(R)[0] : null;
      items.push({ label: p.m.name, sub: CATS[c].name, value: p.s, display: fmtVal(p.m, p.cur.v), ghost: first && first.v !== p.cur.v && !p.m.pool ? benchScore(p.m, first.v) : null, color: scoreColor(p.s), tip: `<b>${esc(p.m.name)}</b><br>Latest ${fmtVal(p.m, p.cur.v)}${p.cur.est ? ' (estimate)' : ''}<br>Benchmark score ${p.s}${first && !p.m.pool ? `<br>First in range: ${fmtVal(p.m, first.v)}` : ''}${p.m.pool ? `<br>${p.cur.n} attempts` : ''}` });
    }
    if (!cs.parts.length) items.push({ label: CATS[c].name, sub: 'not measured', value: null });
  }
  return barsHTML(items) + `<div class="row small muted"><span>Bar = benchmark score of the latest result · <b>|</b> marker = first result in range</span>${fxLink('bench')}</div>`;
}
function metricLine(w, m, R) {
  const s = m.series(R), tr = trendOf(m, s);
  const pts = s.map((p) => ({ x: dms(p.date), y: m.pct ? p.v * 100 : p.v, est: p.est, tip: `${fmtDate(p.date)}<br><b>${fmtVal(m, p.v)}</b>${p.n ? ` · ${p.k != null ? p.k + '/' : ''}${p.n}` : ''}${p.est ? '<br><i>estimate</i>' : ''}` }));
  const fits = tr ? [{ x1: tr.x0, y1: (tr.fit.intercept) * (m.pct ? 100 : 1), x2: dms(s[s.length - 1].date), y2: (tr.fit.intercept + tr.fit.slope * daysBetween(s[0].date, s[s.length - 1].date)) * (m.pct ? 100 : 1) }] : [];
  const r = refOf(m), refs = r ? [{ y: (m.pct ? 100 : 1) * r.elite, label: 'elite ref' }] : [];
  return lineSVG(w, { series: [{ name: m.name, color: 'var(--s1)', pts }], fits, refs: refs.filter((x) => { const ys = pts.map((p) => p.y); const span = Math.max(...ys) - Math.min(...ys) || 1; return Math.abs(x.y - mean(ys)) < span * 3; }), yFmt: m.pct ? (v) => v.toFixed(0) + '%' : null, label: m.name });
}
/** The equal-length period before R (or the athlete's first 60 days for "All time"). */
function previousRange(R) {
  if (R.from) { const len = daysBetween(R.from, R.to || isoDate()); return { R: { from: addDays(R.from, -len - 1), to: addDays(R.from, -1) }, label: 'Previous ' + len + ' days' }; }
  const dates = ['records', 'shots', 'drills', 'games'].flatMap((k) => listOf(k, null).map((r) => r.date)).sort();
  if (!dates.length) return null;
  return { R: { from: dates[0], to: addDays(dates[0], 60) }, label: 'First 60 days' };
}
