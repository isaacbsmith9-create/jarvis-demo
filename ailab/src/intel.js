// ===================== Strength & Weakness Identification =====================
function renderIntel() {
  const el = $('#view-intel'), a = curAthlete();
  if (!a) { el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Strength & weakness identification</span><h1>Strengths & Weaknesses</h1></div></div>${noAthleteState()}`; bindActs(el); return; }
  const R = S.R, I = intel(R, a), w = POS_WEIGHTS[posGroup(a.pos)];
  const group = (L) => { const g = {}; for (const x of L) (g[x.kind] ||= []).push(x); return g; };
  const sg = group(I.strengths), wg = group(I.weaknesses);
  const block = (g, cls) => Object.entries(g).map(([k, L]) => `<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-top:6px">${esc(k)}</h3><ul class="list">${L.slice(0, 6).map((s) => `<li><span class="k ${cls}">${s.score != null ? s.score : '·'}</span><span class="t"><b>${esc(s.m.name)}</b> <span class="muted small">${CATS[s.m.cat].name}</span> ${s.est ? ESTIMATE : ''}<br><span class="small muted">${esc(s.txt)} n = ${s.n}</span></span></li>`).join('')}</ul>`).join('');
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Strength & weakness identification · ${esc(rangeLabel(R))}</span><h1>Strengths & Weaknesses</h1><p>Found by fixed rules applied to your records. A measure with too little data is never called a weakness; it is listed under “Not enough data” with what is needed. ${fxLink('sw')}</p></div></div>
    <div class="grid">
      <section class="card span-12"><div class="card-h"><h2>Development priority engine</h2><span class="meta">gap × position weight × trend × goal × confidence ${fxLink('pri')}</span></div>
        ${I.priorities.length ? `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Measure</th><th class="n">Current</th><th class="n">Benchmark</th><th class="n">Gap</th><th class="n">Position ×</th><th class="n">Trend ×</th><th class="n">Goal ×</th><th class="n">Confidence ×</th><th class="n">Priority</th></tr></thead><tbody>${I.priorities.slice(0, 12).map((p, i) => `<tr><td class="mono">${i + 1}</td><td><b>${esc(p.m.name)}</b><br><span class="small muted">${CATS[p.m.cat].name}${p.tr ? ' · ' + signed(p.tr.per30 * 100, 1, '%/mo') : ''}</span></td><td class="n">${fmtVal(p.m, p.cur.v)}</td><td class="n">${p.score}</td><td class="n">${p.gap}</td><td class="n">${p.pw}</td><td class="n">${p.trf}</td><td class="n">${p.gf}</td><td class="n">${fmt(p.conf, 2)}</td><td class="n"><b>${Math.round(p.p)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">No scored measures yet. Priorities need at least one measure with a benchmark reference and enough data.</p>'}</section>
      <section class="card span-6"><div class="card-h"><h2>Strengths</h2><span class="meta">${I.strengths.length} found</span></div>${I.strengths.length ? block(sg, 's') : '<p class="muted small">None identified yet.</p>'}</section>
      <section class="card span-6"><div class="card-h"><h2>Weaknesses</h2><span class="meta">${I.weaknesses.length} found</span></div>${I.weaknesses.length ? block(wg, 'w') : '<p class="muted small">None identified from the data in this range.</p>'}</section>
      <section class="card span-6"><div class="card-h"><h2>Physical & skill imbalances</h2></div>${I.imbalances.length ? `<ul class="list">${I.imbalances.map((x) => `<li><span class="k i">${esc(x.kind)}</span><span class="t">${esc(x.txt)}</span></li>`).join('')}</ul>` : '<p class="muted small">No imbalances detected. Checks run when both sides have data: left vs right finishing (10+ each), weak vs strong hand drills, approach vs standing vertical, upper vs lower relative strength.</p>'}</section>
      <section class="card span-6"><div class="card-h"><h2>Not enough data</h2><span class="meta">not judged</span></div>${I.missing.length ? `<ul class="list">${I.missing.map((x) => `<li><span class="k n">${CATS[x.m.cat].name}</span><span class="t"><b>${esc(x.m.name)}</b><br><span class="small muted">Have ${x.have}${x.m.pool ? '' : ' result' + (x.have === 1 ? '' : 's')}; needs ${esc(x.need)}.</span></span></li>`).join('')}</ul>` : '<p class="muted small">Every measure has enough data.</p>'}</section>
      <section class="card span-12"><div class="card-h"><h2>Category position weights</h2><span class="meta">${esc(POSITIONS[a.pos] || '')}</span></div>${barsHTML(CAT_IDS.map((c) => ({ label: CATS[c].name, value: (w[c] / 1.5) * 100, display: '× ' + w[c], color: 'var(--s3)', sub: (a.goals || []).includes(c) ? 'goal ×1.3' : '' })))}<p class="small muted">How much each category counts for this position in the Athlete Intelligence Score and the priority engine. Goals from the athlete profile add ×1.3 to priorities.</p></section>
    </div>`;
  bindActs(el);
}

// ===================== Reports =====================
function makeReport() {
  const R = S.R, a = curAthlete(), I = intel(R, a), A = intelScore(R, a);
  const r = { id: uid('rep'), aid: a.id, date: isoDate(), ts: Date.now(), range: { ...R, label: rangeLabel(R) }, ais: A.score, coverage: A.coverage, provisional: A.provisional, physical: A.physical.score, skill: A.skill.score,
    cats: Object.fromEntries(CAT_IDS.map((c) => [c, A.cs[c].score])),
    strengths: I.strengths.slice(0, 6).map((s) => ({ kind: s.kind, name: s.m.name, txt: s.txt })), weaknesses: I.weaknesses.slice(0, 6).map((s) => ({ kind: s.kind, name: s.m.name, txt: s.txt })),
    imbalances: I.imbalances.map((x) => x.txt), priorities: I.priorities.slice(0, 6).map((p) => ({ name: p.m.name, score: p.score, p: Math.round(p.p) })),
    prs: metrics().filter((m) => m.kind === 'test').map((m) => { const b = bestOf(m, R); return b ? { name: m.name, v: fmtVal(m, b.v), date: b.date } : null; }).filter(Boolean),
    missing: I.missing.map((x) => x.m.name), ai: null };
  const md = doc('meta'); md.reports.push(r); if (md.reports.length > 40) md.reports.splice(0, md.reports.length - 40); persist('meta');
  toast('Report generated');
  return r;
}
let openReportId = null;
function openReport(id) { openReportId = id; renderReports(); }
function renderReports() {
  const el = $('#view-reports'), a = curAthlete();
  if (!a) { el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Analytics reports</span><h1>Reports</h1></div></div>${noAthleteState()}`; bindActs(el); return; }
  const L = doc('meta').reports.filter((r) => r.aid === a.id).sort((x, y) => y.ts - x.ts);
  const r = L.find((x) => x.id === openReportId) || null;
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Analytics reports</span><h1>Reports</h1><p>A report freezes the scores, strengths, weaknesses and priorities for the selected date range, so you can compare them later.</p></div>
    <div class="row"><button type="button" class="btn" data-act="report">Generate report (${esc(rangeLabel(S.R))})</button></div></div>
    ${r ? reportView(r, L) : ''}
    <section class="card"><div class="card-h"><h2>All reports</h2><span class="meta">${L.length}</span></div>${L.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Range</th><th class="n">AIS</th><th class="n">Physical</th><th class="n">Skill</th><th class="n">Coverage</th><th></th></tr></thead><tbody>${L.map((x) => `<tr class="${x.id === openReportId ? 'sel' : ''}"><td class="mono">${fmtDate(x.date)}</td><td>${esc(x.range.label)}</td><td class="n">${x.ais ?? '—'}${x.provisional ? '*' : ''}</td><td class="n">${x.physical ?? '—'}</td><td class="n">${x.skill ?? '—'}</td><td class="n">${Math.round(x.coverage * 100)}%</td><td class="n" style="white-space:nowrap"><button type="button" class="btn ghost sm" data-open-report="${x.id}">Open</button> <button type="button" class="icon-btn" data-rep-del="${x.id}" aria-label="Delete report">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div><p class="small muted">* provisional: under 60% data coverage or fewer than 4 categories.</p>` : '<p class="muted small">No reports yet.</p>'}</section>`;
  bindActs(el); mountCharts(el);
  for (const b of $$('[data-rep-del]', el)) b.onclick = () => confirmSheet('Delete report', 'Delete this report snapshot?', 'Delete', () => { const md = doc('meta'); md.reports = md.reports.filter((x) => x.id !== b.dataset.repDel); persist('meta'); if (openReportId === b.dataset.repDel) openReportId = null; });
  $('#rep-copy') && ($('#rep-copy').onclick = async () => { try { await navigator.clipboard.writeText(reportText(r)); toast('Report copied'); } catch { const t = $('#rep-text'); t.hidden = false; t.select(); toast('Select and copy the text below'); } });
  $('#rep-ai') && ($('#rep-ai').onclick = () => reportAI(r));
  $('#rep-close') && ($('#rep-close').onclick = () => { openReportId = null; renderReports(); });
}
function reportView(r, L) {
  const prev = L.find((x) => x.ts < r.ts);
  const d = (k) => (prev && r[k] != null && prev[k] != null ? ` <span class="status ${r[k] >= prev[k] ? 'good' : 'crit'}">${signed(r[k] - prev[k], 0)}</span>` : '');
  return `<section class="card report"><div class="card-h"><h2>Report · ${fmtDate(r.date)}</h2><div class="row"><button type="button" class="btn ghost sm" id="rep-copy">${icon('copy')} Copy as text</button>${AI.sample ? `<button type="button" class="btn ghost sm" id="rep-ai">${icon('spark')} ${r.ai ? 'Rewrite' : 'Add'} AI summary</button>` : ''}<button type="button" class="icon-btn" id="rep-close" aria-label="Close report">${icon('x')}</button></div></div>
    <p class="muted small">${esc(curAthlete().name)} · ${esc(r.range.label)} · data coverage ${Math.round(r.coverage * 100)}%${r.provisional ? ' · <span class="tag prov">provisional</span>' : ''}${prev ? ` · changes vs report of ${fmtDate(prev.date)}` : ''}</p>
    <div class="stats"><div class="stat"><span>Athlete Intelligence Score</span><b>${r.ais ?? '—'}${d('ais')}</b></div><div class="stat"><span>Physical index</span><b>${r.physical ?? '—'}${d('physical')}</b></div><div class="stat"><span>Skill index</span><b>${r.skill ?? '—'}${d('skill')}</b></div></div>
    <div class="grid"><div class="span-6">${chart((w) => radarSVG(w, { axes: CAT_IDS.map((c) => ({ label: CATS[c].name })), series: [{ name: 'This report', color: 'var(--s1)', values: CAT_IDS.map((c) => r.cats[c]) }, ...(prev ? [{ name: 'Previous report', color: 'var(--s2)', values: CAT_IDS.map((c) => prev.cats[c]), dashed: true }] : [])] }))}</div>
      <div class="span-6" style="display:flex;flex-direction:column;gap:10px">
        <div><h3 style="font-size:13px;text-transform:uppercase">Strengths</h3><ul class="list">${r.strengths.map((s) => `<li><span class="k s">${esc(s.kind)}</span><span class="t"><b>${esc(s.name)}</b> <span class="small muted">${esc(s.txt)}</span></span></li>`).join('') || '<li class="muted">None</li>'}</ul></div>
        <div><h3 style="font-size:13px;text-transform:uppercase">Weaknesses</h3><ul class="list">${r.weaknesses.map((s) => `<li><span class="k w">${esc(s.kind)}</span><span class="t"><b>${esc(s.name)}</b> <span class="small muted">${esc(s.txt)}</span></span></li>`).join('') || '<li class="muted">None</li>'}</ul></div></div></div>
    <div class="grid"><div class="span-6"><h3 style="font-size:13px;text-transform:uppercase">Top development priorities</h3><ol>${r.priorities.map((p) => `<li>${esc(p.name)} <span class="muted small">benchmark ${p.score}, priority ${p.p}</span></li>`).join('') || '<li class="muted">None</li>'}</ol>${r.imbalances.length ? `<h3 style="font-size:13px;text-transform:uppercase">Imbalances</h3><ul>${r.imbalances.map((t) => `<li class="small">${esc(t)}</li>`).join('')}</ul>` : ''}</div>
      <div class="span-6"><h3 style="font-size:13px;text-transform:uppercase">Personal records in range</h3><div class="tbl-wrap"><table><tbody>${r.prs.map((p) => `<tr><td>${esc(p.name)}</td><td class="n">${esc(p.v)}</td><td class="mono small">${fmtShort(p.date)}</td></tr>`).join('') || '<tr><td class="muted">None</td></tr>'}</tbody></table></div></div></div>
    ${r.missing.length ? `<p class="small muted">Not judged (too little data): ${r.missing.map(esc).join(', ')}.</p>` : ''}
    ${r.ai ? `<div class="ai-box"><span class="tag ai">AI summary · Claude</span>\n${esc(r.ai)}</div>` : ''}
    <textarea id="rep-text" hidden readonly style="min-height:160px">${esc(reportText(r))}</textarea></section>`;
}
function reportText(r) {
  return [`ATHLETE INTELLIGENCE REPORT — ${curAthlete().name}`, `${fmtDate(r.date)} · ${r.range.label} · coverage ${Math.round(r.coverage * 100)}%${r.provisional ? ' (provisional)' : ''}`, '',
    `Athlete Intelligence Score: ${r.ais ?? '—'} | Physical ${r.physical ?? '—'} | Skill ${r.skill ?? '—'}`, 'Categories: ' + CAT_IDS.map((c) => `${CATS[c].name} ${r.cats[c] ?? '—'}`).join(', '), '',
    'STRENGTHS', ...r.strengths.map((s) => `- ${s.name} (${s.kind}): ${s.txt}`), '', 'WEAKNESSES', ...r.weaknesses.map((s) => `- ${s.name} (${s.kind}): ${s.txt}`), '',
    'PRIORITIES', ...r.priorities.map((p, i) => `${i + 1}. ${p.name} (benchmark ${p.score})`), ...(r.imbalances.length ? ['', 'IMBALANCES', ...r.imbalances.map((t) => '- ' + t)] : []),
    ...(r.ai ? ['', 'AI SUMMARY (Claude)', r.ai] : []), '', 'Scores are computed from entered data; formulas in the Methodology page of Athlete Intelligence Lab.'].join('\n');
}

// ===================== AI (sample capability, optional) =====================
const AI = { sample: null };
function aiPayload(R) {
  const a = curAthlete(), A = intelScore(R, a), I = intel(R, a);
  return { athlete: { sport: a.sport, position: POSITIONS[a.pos], age: ageOf(a), height_in: a.height, weight_lb: a.weight, training_years: a.exp, goals: (a.goals || []).map((g) => GOALS[g]), goal_notes: a.goalText || '' },
    range: rangeLabel(R), intelligence_score: A.score, data_coverage: Math.round(A.coverage * 100) + '%', provisional: A.provisional,
    categories: Object.fromEntries(CAT_IDS.map((c) => [CATS[c].name, A.cs[c].score])),
    measures: I.rows.filter((x) => x.score != null || x.tr).slice(0, 40).map((x) => ({ name: x.m.name, latest: fmtVal(x.m, x.cur.v), benchmark: x.score, trend_per_month: x.tr ? signed(x.tr.per30 * 100, 1, '%') : null, estimate: !!x.cur.est, n: x.cur.n })),
    strengths: I.strengths.slice(0, 6).map((s) => `${s.m.name}: ${s.kind}, ${s.txt}`), weaknesses: I.weaknesses.slice(0, 6).map((s) => `${s.m.name}: ${s.kind}, ${s.txt}`),
    imbalances: I.imbalances.map((x) => x.txt), priorities: I.priorities.slice(0, 6).map((p) => `${p.m.name} (benchmark ${p.score})`), not_enough_data: I.missing.map((x) => x.m.name) };
}
const AI_RULES = 'Use ONLY the data below. Do not invent measurements or numbers that are not in it. Where data is missing, say it is missing instead of guessing. Mark anything that comes from an estimate as an estimate. Plain text, no markdown headings, under 170 words, written to the athlete as "you".';
async function aiInsight(btn) {
  const box = $('#ai-box'); btn.disabled = true; box.textContent = 'Thinking…';
  const prompt = `You are a sports scientist reviewing one athlete's performance analytics.\n${AI_RULES}\nGive: (1) a two-sentence overall evaluation, (2) the two most important things to work on and why, (3) one thing going well.\n\nDATA:\n${JSON.stringify(aiPayload(S.R), null, 1)}`;
  try {
    const res = await AI.sample(prompt, { onText: ({ text }) => { box.textContent = text; } });
    doc('meta').ai = { aid: AID(), ts: Date.now(), text: res.text }; persist('meta');
    box.innerHTML = `<span class="tag ai">AI · Claude</span> <span class="small muted">just now</span>\n${esc(res.text)}`;
  } catch (e) { if (e?.code === 'not_granted') { AI.sample = null; rerender(); return; } box.textContent = e?.code === 'rate_limited' ? 'Claude is busy. Try again in a minute.' : 'Could not reach Claude right now.'; }
  btn.disabled = false;
}
async function reportAI(r) {
  const btn = $('#rep-ai'); btn.disabled = true; btn.textContent = 'Writing…';
  const data = { ...r, ai: undefined, id: undefined, aid: undefined, ts: undefined };
  try {
    const res = await AI.sample(`Write a short performance report summary for this athlete snapshot.\n${AI_RULES}\n\nSNAPSHOT:\n${JSON.stringify(data, null, 1)}`, {});
    const md = doc('meta'); md.reports.find((x) => x.id === r.id).ai = res.text; persist('meta'); renderReports();
  } catch (e) { if (e?.code === 'not_granted') { AI.sample = null; } toast('Could not get an AI summary'); renderReports(); }
}
