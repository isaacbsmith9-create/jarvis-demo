// ===================== PATTERN FINDER =====================
// Scans the last 120 days automatically: every driver × outcome pair (same day and next day), weekday patterns and
// recent shifts. Keeps only findings with enough data and a real signal (|r| ≥ .3, t ≥ 2.1 ≈ p < .05, 10+ paired days),
// explains each in plain words with the numbers behind it, says how confident it is, never claims cause, and links to
// Analytics → Correlations to look closer. Many pairs are tested, so a few findings can be chance; that is said too.
SUBS.intel.splice(1, 0, ['patterns', 'Patterns']);
const PT_DRIVERS = ['sleep', 'water', 'kcal', 'protein', 'carbs', 'volume', 'shots', 'steps', 'energy', 'sore'];
const PT_OUTCOMES = ['shotpct', 'recovery', 'energy', 'sore', 'rating', 'rhr'];
const PT_SKIP = new Set(['sleep>recovery@0', 'energy>recovery@0', 'sore>recovery@0', 'energy>sore@0', 'sore>energy@0']);
const PT_LOWER_BETTER = new Set(['sore', 'rhr']);
const ptVar = (k) => CORR_VARS.find((v) => v[0] === k);
const ptFmt = (k, v) => { const u = ptVar(k)[2]; return v == null ? '—' : u === '%' ? Math.round(v) + '%' : u === 'h' ? r1(v) + ' h' : u ? Math.round(v).toLocaleString() + ' ' + u : r1(v); };
const ptName = (k) => ptVar(k)[1].replace(/ \(1-5\)/, '').toLowerCase();
function ptSeries(days) { const s = {}; for (const [k, , , f] of CORR_VARS) s[k] = Object.fromEntries(days.map((d) => [d, f(d)])); return s; }
function findPatterns() {
  return cached('patterns', () => {
    const days = lastNDays(120), S = ptSeries([...days, shiftIso(todayIso(), 1)]), out = [];
    for (const x of PT_DRIVERS) for (const y of PT_OUTCOMES) for (const lag of [0, 1]) {
      if (x === y || PT_SKIP.has(`${x}>${y}@${lag}`)) continue;
      const ps = []; for (const d of days) { const a = S[x][d], b = S[y][lag ? shiftIso(d, 1) : d]; if (a != null && b != null) ps.push([a, b, d]); }
      if (ps.length < 10) continue;
      const p = pearson(ps); if (!p || Math.abs(p.r) < 0.3) continue;
      const t = Math.abs(p.r) * Math.sqrt((ps.length - 2) / Math.max(1e-9, 1 - p.r * p.r)); if (t < 2.1) continue;
      // Effect in plain terms: outcome when the driver is in its top third vs its bottom third.
      const xs = ps.map((q) => q[0]).sort((a, b) => a - b), lo = xs[Math.floor(xs.length / 3)], hi = xs[Math.floor((2 * xs.length) / 3)];
      const top = ps.filter((q) => q[0] >= hi), bot = ps.filter((q) => q[0] <= lo); if (top.length < 3 || bot.length < 3) continue;
      const yt = mean(top.map((q) => q[1])), yb = mean(bot.map((q) => q[1]));
      const good = PT_LOWER_BETTER.has(y) ? p.r < 0 : p.r > 0;
      const conf = ps.length >= 25 && t >= 3 ? 'High' : ps.length >= 15 && t >= 2.5 ? 'Medium' : 'Low';
      out.push({ kind: 'pair', id: `${x}-${y}-${lag}`, x, y, lag, r: r2(p.r), n: ps.length, t: r1(t), conf, good, ps, hi, lo, yt, yb, score: Math.abs(p.r) * Math.sqrt(ps.length) });
    }
    // Weekday patterns for a few outcomes
    const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const k of ['shotpct', 'volume', 'sleep', 'recovery']) {
      const by = Array.from({ length: 7 }, () => []), all = [];
      for (const d of days) { const v = S[k][d]; if (v == null || (k === 'volume' && !v)) continue; by[parseIso(d).getDay()].push(v); all.push(v); }
      const ok = by.map((a, i) => ({ i, n: a.length, m: a.length ? mean(a) : null })).filter((x) => x.n >= 3);
      if (ok.length < 4 || all.length < 14) continue;
      const m = mean(all), sd = Math.sqrt(mean(all.map((v) => (v - m) ** 2))) || 1, best = [...ok].sort((a, b) => b.m - a.m)[0], worst = [...ok].sort((a, b) => a.m - b.m)[0];
      if ((best.m - worst.m) / sd < 0.8) continue;
      out.push({ kind: 'weekday', id: 'wd-' + k, y: k, best: { ...best, day: WD[best.i] }, worst: { ...worst, day: WD[worst.i] }, n: all.length, conf: all.length >= 30 ? 'Medium' : 'Low', by: ok, score: ((best.m - worst.m) / sd) * 1.2 });
    }
    // Recent shifts: last 14 days vs the 14 before
    for (const k of ['sleep', 'recovery', 'shotpct', 'protein', 'volume', 'energy']) {
      const a = lastNDays(14).map((d) => S[k][d]).filter((v) => v != null), b = lastNDays(14, shiftIso(todayIso(), -14)).map((d) => S[k][d]).filter((v) => v != null);
      if (a.length < 5 || b.length < 5) continue;
      const ma = mean(a), mb = mean(b), sd = Math.sqrt((mean(a.map((v) => (v - ma) ** 2)) + mean(b.map((v) => (v - mb) ** 2))) / 2) || 1, eff = (ma - mb) / sd;
      if (Math.abs(eff) < 0.6) continue;
      const up = ma > mb, good = PT_LOWER_BETTER.has(k) ? !up : up;
      out.push({ kind: 'shift', id: 'sh-' + k, y: k, ma, mb, na: a.length, nb: b.length, up, good, conf: Math.abs(eff) >= 1 && a.length >= 8 ? 'Medium' : 'Low', score: Math.abs(eff) });
    }
    return out.sort((a, b) => b.score - a.score);
  });
}
function ptText(p) {
  if (p.kind === 'pair') {
    const when = p.lag ? 'the next day' : 'the same day', dir = p.r > 0 ? 'higher' : 'lower';
    return { title: `More ${ptName(p.x)} goes with ${dir} ${ptName(p.y)} ${when}`,
      body: `On days with ${ptName(p.x)} of ${ptFmt(p.x, p.hi)} or more, your ${ptName(p.y)}${p.lag ? ' the next day' : ''} averaged ${ptFmt(p.y, p.yt)}, vs ${ptFmt(p.y, p.yb)} on days with ${ptFmt(p.x, p.lo)} or less.`,
      why: p.good ? `If it holds up, more ${ptName(p.x)} is something you control that may help your ${ptName(p.y)}.` : `If it holds up, watch your ${ptName(p.x)}: it lines up with worse ${ptName(p.y)}.`,
      test: `For the next 2 weeks keep ${ptName(p.x)} steady at the higher level on purpose, keep logging ${ptName(p.y)}, then check this card again.`,
      stats: `r = ${p.r} · ${p.n} paired days` };
  }
  if (p.kind === 'weekday') return { title: `Your ${ptName(p.y)} is best on ${p.best.day}s, lowest on ${p.worst.day}s`, body: `${p.best.day}: ${ptFmt(p.y, p.best.m)} on average (${p.best.n} days). ${p.worst.day}: ${ptFmt(p.y, p.worst.m)} (${p.worst.n} days).`, why: 'Weekly routines (school, practice, weekends) often shape this.', test: `Look at what is different about your ${p.worst.day}s, change one thing, and see if it moves.`, stats: `${p.n} days logged` };
  return { title: `${ptVar(p.y)[1].replace(/ \(1-5\)/, '')} ${p.up ? 'up' : 'down'} in the last 2 weeks`, body: `Last 14 days: ${ptFmt(p.y, p.ma)} on average (${p.na} days). The 14 before: ${ptFmt(p.y, p.mb)} (${p.nb} days).`, why: p.good ? 'A change in the right direction. Worth knowing what caused it so you keep it.' : 'A change in the wrong direction. Check sleep, load and schedule changes in the same weeks.', test: 'Compare your calendar and training load for both periods.', stats: `${p.na} vs ${p.nb} days` };
}
const PT_CONF = { High: 'var(--good)', Medium: 'var(--warn)', Low: 'var(--muted)' };
function ptCard(p, i) {
  const t = ptText(p), kind = { pair: 'Link', weekday: 'Weekly rhythm', shift: 'Recent change' }[p.kind];
  return `<section class="card pt"><div class="card-head"><div><span class="tiny muted">${kind.toUpperCase()}</span><h3 style="margin-top:2px">${esc(t.title)}</h3></div><span class="tag" style="color:${PT_CONF[p.conf]}">${p.conf} confidence</span></div>
    <p class="small" style="margin:0 0 8px">${esc(t.body)}</p>${p.kind === 'pair' ? `<div class="chart" id="pt-${i}"></div>` : p.kind === 'weekday' ? `<div class="pt-wd">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, d) => { const x = p.by.find((b) => b.i === d), mx = Math.max(...p.by.map((b) => b.m)), mn = Math.min(...p.by.map((b) => b.m)); return `<div><i style="height:${x ? 12 + ((x.m - mn) / (mx - mn || 1)) * 62 : 4}%;background:${x ? (d === p.best.i ? 'var(--good)' : d === p.worst.i ? 'var(--danger)' : 'var(--accent)') : 'var(--line)'}"></i><span class="tiny muted">${l}</span></div>`; }).join('')}</div>` : ''}
    <div class="pt-meta"><span class="tiny muted">${esc(t.stats)}</span><span class="tiny muted">${p.kind === 'pair' ? 'Associated, not proven cause' : 'Pattern, not proven cause'}</span></div>
    <p class="small" style="margin:8px 0 0"><b>Why it might matter:</b> ${esc(t.why)}</p><p class="small" style="margin:4px 0 0"><b>How to test it:</b> ${esc(t.test)}</p>
    ${p.kind === 'pair' ? `<button type="button" class="btn sm" style="margin-top:10px" data-pt-open="${p.x}|${p.y}|${p.lag}">Explore in Correlations ›</button>` : ''}</section>`;
}
INTEL.patterns = (el) => {
  const P = findPatterns(), days = allDayKeys().filter((d) => d >= shiftIso(todayIso(), -119)).length;
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Patterns in your data</h3><span class="sub">Found automatically in the last 120 days · ${days} days logged</span></div></div>
      <p class="small muted" style="margin:0">Each finding shows the numbers behind it and how confident it is. These are associations, not proof that one thing causes another, and because many pairs are checked, a low-confidence finding can be chance. Use "How to test it" to find out for real.</p></section>
    ${P.length ? P.slice(0, 12).map(ptCard).join('') : `<section class="card">${emptyState('No clear patterns yet', 'Patterns need about 10+ days where both things are logged (for example sleep and shooting). Keep doing morning check-ins, logging meals and shooting sessions.', 'chart')}</section>`}`;
  P.slice(0, 12).forEach((p, i) => { if (p.kind === 'pair') drawScatter($('#pt-' + i), p.ps, { h: 170, xl: ptVar(p.x)[1], yl: ptVar(p.y)[1] + (p.lag ? ' (next day)' : ''), fit: pearson(p.ps), label: ptText(p).title }); });
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-pt-open]'); if (!b) return; const [x, y, lag] = b.dataset.ptOpen.split('|'); setUi('cx', x); setUi('cy', y); setUi('clag', Number(lag)); setUi('crange', '90'); go('analytics', 'correlations'); });
// Command Center: the strongest pattern, one line.
{
  const base = homeCommand;
  homeCommand = function (el) {
    base(el); const p = findPatterns()[0]; if (!p) return;
    const t = ptText(p), b = el.querySelectorAll('.cc-brief')[1];
    b?.insertAdjacentHTML('afterend', `<button type="button" class="cc-brief cc-pt" data-go="intel-patterns"><span class="tiny muted">PATTERN SPOTTED · ${p.conf.toUpperCase()} CONFIDENCE</span><p>${esc(t.title)}. <span class="muted">${esc(t.body)}</span></p></button>`);
  };
}
