// ===================== Performance Analytics Lab =====================
const AN = { tab: uiGet('anTab', 'explore'), metric: uiGet('anMetric', 'vmax'), ctx: 'all', mode: 'month', A: null, B: null, x: 'vmax', y: 'sprint10', g1: null, g2: null, d1: null, d2: null };
function metricSelect(id, val, f = () => true) {
  return `<select id="${id}">${CAT_IDS.map((c) => { const ms = metrics().filter((m) => m.cat === c && f(m)); return ms.length ? `<optgroup label="${CATS[c].name}">${ms.map((m) => `<option value="${m.id}" ${m.id === val ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>`;
}
/** Summary statistics for a metric's results in a range (documented in Methodology). */
function statsOf(m, s) {
  const v = s.map((p) => p.v); if (!v.length) return null;
  const first = s[0], last = s[s.length - 1], better = (a, b) => (m.dir === 'lower' ? a < b : a > b);
  return { n: v.length, mean: mean(v), median: median(v), best: v.reduce((a, b) => (better(b, a) ? b : a)), worst: v.reduce((a, b) => (better(b, a) ? a : b)), sd: sd(v), cv: cv(v), imp: v.length > 1 ? improvement(first.v, last.v, m.dir) : null, tr: trendOf(m, s), first, last };
}
/** Value of a metric over a period: pooled rate for makes/attempts data, mean of results otherwise. */
function periodValue(m, R) {
  if (m.pool) { const c = current(m, R); return c.v != null && c.n ? { v: c.v, n: c.n, ok: c.ok } : null; }
  const s = m.series(R); return s.length ? { v: mean(s.map((p) => p.v)), n: s.length, ok: true } : null;
}
function renderAnalytics() {
  const el = $('#view-analytics');
  const tabs = [['explore', 'Metric explorer'], ['compare', 'Period comparison'], ['cats', 'Category comparison'], ['scatter', 'Correlations'], ['blocks', 'Blocks & sessions'], ['heat', 'Heatmaps']];
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Performance Analytics Lab</span><h1>Analytics Lab</h1><p>Statistics, comparisons and visualizations. Everything recalculates from your records whenever you add, edit or delete data.</p></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-at="${k}" aria-selected="${AN.tab === k}">${l}</button>`).join('')}</div><div id="an-body"></div>`;
  for (const b of $$('[data-at]', el)) b.onclick = () => { AN.tab = b.dataset.at; uiSet('anTab', AN.tab); renderAnalytics(); };
  const body = $('#an-body', el);
  if (!curAthlete()) { body.innerHTML = noAthleteState(); bindActs(body); return; }
  ({ explore: anExplore, compare: anCompare, cats: anCats, scatter: anScatter, blocks: anBlocks, heat: anHeat })[AN.tab](body);
  bindActs(el); mountCharts(el);
}
function anExplore(body) {
  const R = { ...S.R, ctx: AN.ctx === 'all' ? null : AN.ctx };
  if (!metric(AN.metric)) AN.metric = 'vmax';
  const m = metric(AN.metric), s = m.series(R), st = statsOf(m, s), f = (v) => fmtVal(m, v);
  body.innerHTML = `<div class="row"><label class="fld" style="min-width:240px;flex:1;max-width:380px"><span>Measure</span>${metricSelect('an-metric', AN.metric)}</label>
      <label class="fld" style="width:180px"><span>Workout type</span>${filterSel('an-ctx', { all: 'Games + workouts', ...CTX }, AN.ctx)}</label><span class="small muted">${esc(rangeLabel(S.R))}${m.pool ? ' · points are per-session rates' : ''}</span></div>
    ${st ? `<section class="card"><div class="card-h"><h2>${esc(m.name)}</h2><span class="meta">${st.n} data point${st.n > 1 ? 's' : ''} · ${m.dir === 'lower' ? 'lower is better' : 'higher is better'} ${fxLink('stats')}</span></div>
      <div class="stats">${[['Average', f(st.mean)], ['Median', f(st.median)], ['Best', f(st.best)], ['Worst', f(st.worst)], ['Std deviation', st.sd != null ? (m.pct ? fmt(st.sd * 100, 1) + ' pts' : fmt(st.sd, m.dec + 1)) : '—'], ['Consistency (CV)', st.cv != null ? (st.cv * 100).toFixed(1) + '%' : '—'], ['Variability (range)', f(Math.abs(st.best - st.worst)).replace(/^/, '')], ['First → latest', st.imp != null ? signed(st.imp * 100, 1, '%') : '—'], ['Trend / month', st.tr ? signed(st.tr.per30 * 100, 1, '%') : '—'], ['Pooled / latest', m.pool ? (current(m, R).v != null ? fmtVal(m, current(m, R).v) : '—') : f(st.last.v)]].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('')}</div></section>
    <div class="grid"><section class="card span-8"><div class="card-h"><h2>Progression</h2><span class="meta">dashed line = least-squares trend</span></div>${chart((w) => metricLine(w, m, R))}</section>
      <section class="card span-4"><div class="card-h"><h2>Distribution</h2></div>${chart((w) => histSVG(w, { values: s.map((p) => (m.pct ? p.v * 100 : p.v)), fmt: (v) => (m.pct ? v.toFixed(0) + '%' : fmt(v, m.dec)), mark: m.pct ? st.last.v * 100 : st.last.v }))}</section>
      <section class="card span-12"><div class="card-h"><h2>Data</h2></div><div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Value</th><th class="n">vs average</th><th class="n">Sample</th><th></th></tr></thead><tbody>${[...s].reverse().map((p) => `<tr><td class="mono">${fmtDate(p.date)}</td><td class="n">${f(p.v)}</td><td class="n">${m.pct ? signed((p.v - st.mean) * 100, 1, ' pts') : signed(p.v - st.mean, m.dec)}</td><td class="n">${p.n ? (p.k != null ? p.k + '/' : '') + p.n : '—'}</td><td>${p.est || m.alwaysEst ? ESTIMATE : MEASURED}</td></tr>`).join('')}</tbody></table></div></section></div>`
    : '<div class="empty"><h3>No data for this measure</h3><p>Choose another measure, widen the date range, or log results.</p></div>'}`;
  $('#an-metric').onchange = (e) => { AN.metric = e.target.value; uiSet('anMetric', AN.metric); renderAnalytics(); };
  $('#an-ctx').onchange = (e) => { AN.ctx = e.target.value; renderAnalytics(); };
}
function periods() {
  const t = isoDate(), d = new Date(dms(t));
  if (AN.mode === 'month') { const m0 = new Date(d.getFullYear(), d.getMonth(), 1, 12), p0 = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12), p1 = new Date(d.getFullYear(), d.getMonth(), 0, 12); return [{ from: isoDate(p0), to: isoDate(p1), label: p0.toLocaleDateString(undefined, { month: 'long' }) }, { from: isoDate(m0), to: t, label: m0.toLocaleDateString(undefined, { month: 'long' }) + ' (to date)' }]; }
  if (AN.mode === 'season') { const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return [{ from: `${y - 1}-08-01`, to: `${y}-07-31`, label: `${y - 1}–${String(y).slice(2)} season` }, { from: `${y}-08-01`, to: t, label: `${y}–${String(y + 1).slice(2)} season (to date)` }]; }
  if (AN.mode === 'blocks') { const B = doc('meta').blocks.filter((b) => b.aid === AID()); const a = B.find((b) => b.id === AN.A) || B[0], b = B.find((x) => x.id === AN.B) || B[1]; return a && b ? [{ from: a.from, to: a.to, label: a.name }, { from: b.from, to: b.to, label: b.name }] : null; }
  if (AN.mode === 'custom') { const A = AN.cA || { from: addDays(t, -120), to: addDays(t, -61) }, B = AN.cB || { from: addDays(t, -60), to: t }; AN.cA = A; AN.cB = B; return [{ ...A, label: `${fmtShort(A.from)} – ${fmtShort(A.to)}` }, { ...B, label: `${fmtShort(B.from)} – ${fmtShort(B.to)}` }]; }
  return null; // first vs latest handled separately
}
function anCompare(body) {
  const modes = { month: 'This month vs last month', season: 'This season vs last season', first: 'First test vs latest test', blocks: 'Training block vs block', custom: 'Custom date ranges' };
  const P = periods(), rows = [];
  for (const m of metrics()) {
    let a, b;
    if (AN.mode === 'first') { const s = m.series(null); if (s.length < 2) continue; a = { v: s[0].v, n: 1, d: s[0].date, ok: true }; b = { v: s[s.length - 1].v, n: 1, d: s[s.length - 1].date, ok: true }; }
    else { if (!P) break; a = periodValue(m, P[0]); b = periodValue(m, P[1]); if (!a || !b) continue; }
    const ch = improvement(a.v, b.v, m.dir); rows.push({ m, a, b, ch, small: !(a.ok && b.ok) });
  }
  rows.sort((x, y) => Math.abs(y.ch ?? 0) - Math.abs(x.ch ?? 0));
  const B = doc('meta').blocks.filter((b) => b.aid === AID());
  body.innerHTML = `<div class="row"><label class="fld" style="width:280px"><span>Compare</span>${filterSel('cmp-mode', modes, AN.mode)}</label>
      ${AN.mode === 'blocks' ? (B.length >= 2 ? `<label class="fld" style="width:220px"><span>Block A</span>${filterSel('blk-a', Object.fromEntries(B.map((b) => [b.id, b.name])), AN.A || B[0].id)}</label><label class="fld" style="width:220px"><span>Block B</span>${filterSel('blk-b', Object.fromEntries(B.map((b) => [b.id, b.name])), AN.B || B[1].id)}</label>` : '<span class="small muted">Create at least two training blocks in Blocks & sessions.</span>') : ''}
      ${AN.mode === 'custom' ? `<label class="fld"><span>A from</span><input type="date" id="ca-f" value="${AN.cA?.from || ''}"></label><label class="fld"><span>A to</span><input type="date" id="ca-t" value="${AN.cA?.to || ''}"></label><label class="fld"><span>B from</span><input type="date" id="cb-f" value="${AN.cB?.from || ''}"></label><label class="fld"><span>B to</span><input type="date" id="cb-t" value="${AN.cB?.to || ''}"></label>` : ''}</div>
    ${P ? `<p class="small muted">A = ${esc(P[0].label)} · B = ${esc(P[1].label)}. Tests use the mean of results in each period; percentages use pooled makes ÷ attempts. ${fxLink('compare')}</p>` : AN.mode === 'first' ? '<p class="small muted">Each measure\'s very first result against its most recent one (all time).</p>' : ''}
    ${rows.length ? `<div class="grid"><section class="card span-6"><div class="card-h"><h2>Biggest changes</h2><span class="meta">positive = better</span></div>${changeBars(rows.slice(0, 12))}</section>
      <section class="card span-6"><div class="card-h"><h2>All measures</h2></div><div class="tbl-wrap"><table><thead><tr><th>Measure</th><th class="n">A</th><th class="n">B</th><th class="n">Change</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.m.name)}${r.small ? ' <span class="tag prov" title="Below the minimum sample in a period">small sample</span>' : ''}</td><td class="n">${fmtVal(r.m, r.a.v)}${r.a.d ? `<br><span class="muted small">${fmtShort(r.a.d)}</span>` : ''}</td><td class="n">${fmtVal(r.m, r.b.v)}${r.b.d ? `<br><span class="muted small">${fmtShort(r.b.d)}</span>` : ''}</td><td class="n"><span class="status ${r.ch > 0.005 ? 'good' : r.ch < -0.005 ? 'crit' : ''}">${signed(r.ch * 100, 1, '%')}</span></td></tr>`).join('')}</tbody></table></div></section></div>`
      : '<div class="empty"><h3>Nothing to compare</h3><p>No measure has data in both periods. Try another comparison or widen the periods.</p></div>'}`;
  $('#cmp-mode').onchange = (e) => { AN.mode = e.target.value; renderAnalytics(); };
  $('#blk-a') && ($('#blk-a').onchange = (e) => { AN.A = e.target.value; renderAnalytics(); });
  $('#blk-b') && ($('#blk-b').onchange = (e) => { AN.B = e.target.value; renderAnalytics(); });
  for (const [id, k, f] of [['ca-f', 'cA', 'from'], ['ca-t', 'cA', 'to'], ['cb-f', 'cB', 'from'], ['cb-t', 'cB', 'to']]) { const i = $('#' + id); if (i) i.onchange = () => { if (i.value) { AN[k] = { ...AN[k], [f]: i.value }; renderAnalytics(); } }; }
}
/** Diverging bars around zero: better to the right (blue), worse to the left (red). */
function changeBars(rows) {
  const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.ch)));
  return `<div class="hbars">${rows.map((r) => { const w = (50 * Math.abs(r.ch)) / max; return `<div class="hbar" data-tip="<b>${esc(r.m.name)}</b><br>${esc(fmtVal(r.m, r.a.v))} → ${esc(fmtVal(r.m, r.b.v))}"><span class="hb-l">${esc(r.m.name)}</span><span class="hb-t" style="background:var(--surface-3)"><i class="hb-f" style="left:${r.ch >= 0 ? 50 : 50 - w}%;width:${w}%;background:${r.ch >= 0 ? 'var(--cold-3)' : 'var(--hot-3)'};border-radius:${r.ch >= 0 ? '0 4px 4px 0' : '4px 0 0 4px'}"></i><i class="hb-g" style="left:50%;background:var(--ink-3)"></i></span><span class="hb-v">${signed(r.ch * 100, 1, '%')}</span></div>`; }).join('')}</div>
    <div class="legend"><span><i style="background:var(--cold-3)"></i>Improved</span><span><i style="background:var(--hot-3)"></i>Declined</span></div>`;
}
function anCats(body) {
  const R = S.R, cs = catScores(R), w = POS_WEIGHTS[posGroup(curAthlete().pos)];
  body.innerHTML = `<div class="grid"><section class="card span-6"><div class="card-h"><h2>Category scores</h2><span class="meta">${esc(rangeLabel(R))} ${fxLink('bench')}</span></div>
      ${barsHTML(CAT_IDS.map((c) => ({ label: CATS[c].name, sub: `${cs[c].parts.length}/${cs[c].total} measured`, value: cs[c].score, color: scoreColor(cs[c].score), tip: cs[c].parts.map((p) => `${p.m.name}: ${p.s}`).join('<br>') || 'No data' })))}</section>
    <section class="card span-6"><div class="card-h"><h2>Physical vs skill</h2></div>${chart((wd) => radarSVG(wd, { axes: CAT_IDS.map((c) => ({ label: CATS[c].name })), series: [{ name: 'Category score', color: 'var(--s1)', values: CAT_IDS.map((c) => cs[c].score) }] }))}</section>
    <section class="card span-12"><div class="card-h"><h2>What each category is made of</h2></div><div class="tbl-wrap"><table><thead><tr><th>Category</th><th class="n">Weight (${posGroup(curAthlete().pos)})</th><th class="n">Score</th><th>Measures used (benchmark score)</th><th class="n">Coverage</th></tr></thead><tbody>${CAT_IDS.map((c) => `<tr><td>${CATS[c].name}</td><td class="n">${w[c]}</td><td class="n">${cs[c].score ?? '—'}</td><td class="small">${cs[c].parts.map((p) => `${esc(p.m.name)} (${p.s}${p.cur.est ? ', est.' : ''})`).join(', ') || '<span class="muted">none</span>'}</td><td class="n">${Math.round(cs[c].coverage * 100)}%</td></tr>`).join('')}</tbody></table></div></section></div>`;
}
function anScatter(body) {
  const R = S.R, mx = metric(AN.x) || metric('vmax'), my = metric(AN.y) || metric('sprint10');
  const sx = mx.series(R), sy = my.series(R), pts = [];
  for (const p of sx) { let best = null, bd = 15; for (const q of sy) { const d = Math.abs(daysBetween(p.date, q.date)); if (d < bd) { bd = d; best = q; } } if (best) pts.push({ x: mx.pct ? p.v * 100 : p.v, y: my.pct ? best.v * 100 : best.v, tip: `${fmtDate(p.date)}: ${fmtVal(mx, p.v)}<br>${fmtDate(best.date)}: ${fmtVal(my, best.v)}` }); }
  const r = pts.length >= 4 ? pearson(pts.map((p) => p.x), pts.map((p) => p.y)) : null, fit = pts.length >= 3 ? linreg(pts.map((p) => p.x), pts.map((p) => p.y)) : null;
  body.innerHTML = `<div class="row"><label class="fld" style="flex:1;min-width:200px;max-width:320px"><span>X measure</span>${metricSelect('sc-x', mx.id)}</label><label class="fld" style="flex:1;min-width:200px;max-width:320px"><span>Y measure</span>${metricSelect('sc-y', my.id)}</label></div>
    <section class="card"><div class="card-h"><h2>${esc(mx.name)} vs ${esc(my.name)}</h2><span class="meta">${pts.length} pairs${r != null ? ` · r = ${fmt(r, 2)}` : ''}</span></div>${chart((w) => scatterSVG(w, { pts, xLabel: mx.name + (mx.pct ? ' (%)' : ` (${mx.unit})`), yLabel: my.name + (my.pct ? ' (%)' : ` (${my.unit})`), fit }))}
      <p class="small muted">Each ${esc(mx.name)} result is paired with the nearest ${esc(my.name)} result within 14 days. ${r == null ? 'Correlation needs 4+ pairs.' : `r = ${fmt(r, 2)}: ${Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : 'weak'} ${r > 0 ? 'positive' : 'negative'} relationship. Correlation is not causation, and small samples move it a lot.`} ${fxLink('corr')}</p></section>`;
  $('#sc-x').onchange = (e) => { AN.x = e.target.value; renderAnalytics(); }; $('#sc-y').onchange = (e) => { AN.y = e.target.value; renderAnalytics(); };
}
function anBlocks(body) {
  const B = doc('meta').blocks.filter((b) => b.aid === AID()).sort((a, b) => (a.from < b.from ? -1 : 1));
  const rows = allRows(null), dates = [...new Set(rows.map((r) => r.date))].sort().reverse();
  AN.d1 = AN.d1 && dates.includes(AN.d1) ? AN.d1 : dates[1]; AN.d2 = AN.d2 && dates.includes(AN.d2) ? AN.d2 : dates[0];
  const G = listOf('games', null).reverse(); AN.g1 = AN.g1 || G[1]?.id; AN.g2 = AN.g2 || G[0]?.id;
  const g1 = G.find((g) => g.id === AN.g1), g2 = G.find((g) => g.id === AN.g2);
  const day = (d) => rows.filter((r) => r.date === d);
  body.innerHTML = `<div class="grid"><section class="card span-12"><div class="card-h"><h2>Training blocks</h2><button type="button" class="btn sm" id="blk-new">${icon('plus')} New block</button></div>
    ${B.length ? `<div class="tbl-wrap"><table><thead><tr><th>Block</th><th>Dates</th><th>Focus</th><th class="n">Entries</th><th>Key changes inside the block</th><th></th></tr></thead><tbody>${B.map((b) => { const Rb = { from: b.from, to: b.to }, ch = metrics().filter((m) => m.kind === 'test').map((m) => { const s = m.series(Rb); return s.length >= 2 ? { m, c: improvement(s[0].v, s[s.length - 1].v, m.dir) } : null; }).filter(Boolean).sort((a, c) => c.c - a.c).slice(0, 3); return `<tr><td><b>${esc(b.name)}</b>${b.demo ? ' <span class="tag demo">demo</span>' : ''}</td><td class="mono small">${fmtShort(b.from)} – ${fmtShort(b.to)}</td><td>${esc(b.focus || '')}</td><td class="n">${allRows(Rb).length}</td><td class="small">${ch.map((x) => `${esc(x.m.name)} ${signed(x.c * 100, 1, '%')}`).join(' · ') || '—'}</td><td class="n"><button type="button" class="icon-btn" data-bdel="${b.id}" aria-label="Delete block">${icon('trash')}</button></td></tr>`; }).join('')}</tbody></table></div><p class="small muted">Compare two blocks in Period comparison → Training block vs block.</p>` : '<p class="muted small">Define phases (off-season, pre-season, a 6-week jump program) to compare them.</p>'}</section>
    <section class="card span-6"><div class="card-h"><h2>Compare two workouts</h2></div>${dates.length >= 2 ? `<div class="row">${filterSel('d1', Object.fromEntries(dates.map((d) => [d, fmtDate(d)])), AN.d1)}<span>vs</span>${filterSel('d2', Object.fromEntries(dates.map((d) => [d, fmtDate(d)])), AN.d2)}</div>
      <div class="tbl-wrap"><table><thead><tr><th>Measurement</th><th>${fmtShort(AN.d1)}</th><th>${fmtShort(AN.d2)}</th></tr></thead><tbody>${[...new Set([...day(AN.d1), ...day(AN.d2)].map((r) => r.name))].slice(0, 40).map((n) => { const a = day(AN.d1).filter((r) => r.name === n), b = day(AN.d2).filter((r) => r.name === n); const agg = (L) => (!L.length ? '—' : L[0].src === 'shots' ? (() => { const k = sum(L.map((r) => r.rec.makes)), t = sum(L.map((r) => r.rec.att)); return `${k}/${t} (${fmtPct(k / t, 0)})`; })() : L.map((r) => r.result).join('; ')); return `<tr><td class="small">${esc(n)}</td><td class="small mono">${esc(agg(a))}</td><td class="small mono">${esc(agg(b))}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted small">Needs entries on at least two days.</p>'}</section>
    <section class="card span-6"><div class="card-h"><h2>Compare two games</h2></div>${G.length >= 2 ? `<div class="row">${filterSel('g1', Object.fromEntries(G.map((g) => [g.id, fmtShort(g.date) + ' ' + (g.opp || '')])), AN.g1)}<span>vs</span>${filterSel('g2', Object.fromEntries(G.map((g) => [g.id, fmtShort(g.date) + ' ' + (g.opp || '')])), AN.g2)}</div>
      ${g1 && g2 ? `<div class="tbl-wrap"><table><thead><tr><th>Stat</th><th class="n">${esc(g1.opp || fmtShort(g1.date))}</th><th class="n">${esc(g2.opp || fmtShort(g2.date))}</th><th class="n">Diff</th></tr></thead><tbody>${[['Minutes', 'min'], ['Points', 'pts'], ['Rebounds', 'reb'], ['Assists', 'ast'], ['Steals', 'stl'], ['Blocks', 'blk'], ['Turnovers', 'tov']].map(([l, k]) => `<tr><td>${l}</td><td class="n">${g1[k]}</td><td class="n">${g2[k]}</td><td class="n">${signed(g2[k] - g1[k], 0)}</td></tr>`).join('')}${[['FG%', (g) => (g.fga ? g.fgm / g.fga : null)], ['3P%', (g) => (g.tpa ? g.tpm / g.tpa : null)], ['TS%', (g) => (g.fga + g.fta ? g.pts / (2 * (g.fga + 0.44 * g.fta)) : null)]].map(([l, f]) => `<tr><td>${l}</td><td class="n">${fmtPct(f(g1), 0)}</td><td class="n">${fmtPct(f(g2), 0)}</td><td class="n">${f(g1) != null && f(g2) != null ? signed((f(g2) - f(g1)) * 100, 0, ' pts') : '—'}</td></tr>`).join('')}<tr><td>Game Score</td><td class="n">${fmt(gameScore(g1))}</td><td class="n">${fmt(gameScore(g2))}</td><td class="n">${signed(gameScore(g2) - gameScore(g1))}</td></tr></tbody></table></div>` : ''}` : '<p class="muted small">Log at least two games.</p>'}</section></div>`;
  $('#blk-new').onclick = () => openSheet('New training block', `<div class="form">${fld('Name', inp('name', '', { ph: 'Summer jump program' }), { full: true })}${fld('Start', inp('from', addDays(isoDate(), -42), { type: 'date' }))}${fld('End', inp('to', isoDate(), { type: 'date' }))}${fld('Focus', inp('focus', '', { ph: 'Power, speed…' }), { full: true })}</div>`, { submit: 'Create block', onSubmit: (fd) => { const name = String(fd.get('name') || '').trim(), from = fd.get('from'), to = fd.get('to'); if (!name) return 'Name the block.'; if (!from || !to) return 'Enter both dates.'; if (to < from) return 'End must be after start.'; doc('meta').blocks.push({ id: uid('blk'), aid: AID(), name, from, to, focus: String(fd.get('focus') || '') }); persist('meta'); } });
  for (const b of $$('[data-bdel]', body)) b.onclick = () => { const x = doc('meta').blocks.find((y) => y.id === b.dataset.bdel); confirmSheet('Delete block', `Delete the block "${x.name}"? Records inside it are kept.`, 'Delete', () => { const md = doc('meta'); md.blocks = md.blocks.filter((y) => y.id !== x.id); persist('meta'); }); };
  for (const id of ['d1', 'd2', 'g1', 'g2']) { const s = $('#' + id); if (s) s.onchange = () => { AN[id] = s.value; renderAnalytics(); }; }
}
function anHeat(body) {
  const counts = {}, shotsPerDay = {};
  for (const r of allRows(null)) counts[r.date] = (counts[r.date] || 0) + 1;
  for (const s of listOf('shots', null)) shotsPerDay[s.date] = (shotsPerDay[s.date] || 0) + s.att;
  const dow = Array.from({ length: 7 }, () => ({})), cats = ['Test', 'Shooting', 'Handling', 'Finishing', 'Game'];
  for (const r of allRows(S.R)) { const d = new Date(dms(r.date)).getDay(); dow[d][r.type] = (dow[d][r.type] || 0) + 1; }
  const mx = Math.max(1, ...dow.flatMap((o) => cats.map((c) => o[c] || 0)));
  const lvl = (n) => (n ? Math.min(4, Math.ceil((n / mx) * 4)) : 0);
  body.innerHTML = `<div class="grid"><section class="card span-12"><div class="card-h"><h2>Training calendar</h2><span class="meta">entries per day</span></div>${chart((w) => calendarSVG(w, { counts, weeks: 26 }))}</section>
    <section class="card span-12"><div class="card-h"><h2>Shot volume calendar</h2><span class="meta">attempts per day</span></div>${chart((w) => calendarSVG(w, { counts: shotsPerDay, weeks: 26, unit: 'shots' }))}</section>
    <section class="card span-6"><div class="card-h"><h2>Weekly pattern</h2><span class="meta">${esc(rangeLabel(S.R))}</span></div><div class="tbl-wrap"><table><thead><tr><th></th>${cats.map((c) => `<th class="n">${c}</th>`).join('')}</tr></thead><tbody>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `<tr><th>${d}</th>${cats.map((c) => `<td class="n"><span class="cal-k l${lvl(dow[i][c] || 0)}" style="display:inline-block;width:100%;height:20px;border-radius:4px;line-height:20px;text-align:center;font-size:11px;color:${lvl(dow[i][c] || 0) >= 3 ? '#fff' : 'inherit'}">${dow[i][c] || ''}</span></td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <section class="card span-6"><div class="card-h"><h2>Shooting heat by zone</h2></div>${courtSVG({ shots: listOf('shots', S.R).filter((s) => s.type !== 'ft'), mode: 'zones' })}${zoneKey()}</section></div>`;
}
