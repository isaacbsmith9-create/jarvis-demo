// ===================== Methodology: every formula, plus editable benchmark references =====================
function renderMethod() {
  const el = $('#view-method');
  const sec = (id, title, html) => `<section class="card method" id="m-${id}"><h2>${title}</h2>${html}</section>`;
  const scored = metrics().filter((m) => m.ref);
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Methodology</span><h1>How every number is calculated</h1><p>Nothing here is a black box. Each score is a documented formula applied to records you entered. Measured values and estimates are labelled everywhere: ${MEASURED} ${ESTIMATE}</p></div></div>
  ${sec('bench', 'Benchmark score (0–100)', `<p>Each scored measure is placed on a linear scale between two reference points: a <b>floor</b> (scores 0) and an <b>elite</b> value (scores 100). Results beyond either end are clamped.</p>
    <div class="formula">higher is better:  score = 100 × (value − floor) ÷ (elite − floor)
lower is better:   score = 100 × (floor − value) ÷ (floor − elite)
score = clamp(score, 0, 100), rounded</div>
    <p>The default references are approximate ranges for a high-school to early-college basketball athlete. They are reference points, not norms from a study, so you can change them below to match your level, age group or team. The current value of a test is its <b>latest</b> result in the date range; for makes ÷ attempts data it is the <b>pooled rate</b> over the range.</p>`)}
  ${sec('ais', 'Athlete Intelligence Score', `<div class="formula">category score  S_c = mean(benchmark scores of the scored measures in category c that have enough data)
AIS = Σ (w_c × S_c) ÷ Σ w_c      over categories that have a score
Physical index / Skill index = same formula over physical / skill categories only
coverage = Σ w_c (categories with data) ÷ Σ w_c (all categories)</div>
    <p>Categories with no data are <b>left out</b>, never counted as zero. The score is marked <b>provisional</b> when coverage is under 60% or fewer than 4 categories have data. For strength, relative strength (estimated 1RM ÷ bodyweight) is used when bodyweight is known; otherwise the absolute lift is used.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Category</th>${Object.keys(POS_WEIGHTS).map((g) => `<th class="n">${g}</th>`).join('')}</tr></thead><tbody>${CAT_IDS.map((c) => `<tr><td>${CATS[c].name}</td>${Object.values(POS_WEIGHTS).map((w) => `<td class="n">${w[c]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="small muted">Position groups: guard = PG, SG, combo guard · wing = SF, forward · big = PF, C · any = other sports.</p>`)}
  ${sec('stats', 'Statistics', `<div class="formula">average (mean) = Σx ÷ n          median = middle value of sorted results
standard deviation = √( Σ(x − mean)² ÷ (n − 1) )      (sample SD)
consistency (CV) = SD ÷ mean           variability (range) = |best − worst|
improvement = (latest − first) ÷ first          (sign flipped when lower is better, so + = better)
trend / month = least-squares slope × 30 days ÷ mean      (needs 3+ results over 14+ days)</div>`)}
  ${sec('cv', 'Consistency', `<p>Consistency uses the coefficient of variation of a measure's last 6 results (3 minimum). ≤3% is labelled very consistent; 3–8% normal; above 8% inconsistent. Percentages (shooting, finishing) are judged differently, because a 15-shot session is noisy by nature: only sessions with 10+ attempts count, and a rate is inconsistent only when its swings are at least 1.5× what chance alone would produce at that sample size.</p>`)}
  ${sec('sw', 'Strength & weakness rules', `<div class="formula">Top performer      benchmark score ≥ 70
Fast improver      trend ≥ +2% per month (3+ results, 14+ days)
Most consistent    CV ≤ 3% over the last 3–6 test results
New benchmark      latest result is a personal record
Low performer      benchmark score < 40
Stagnant           |trend| < 0.5% per month over 45+ days, and score < 80
Regressing         trend ≤ −2% per month
Inconsistent       CV ≥ 8% for tests; for rates (FG%, finishing %), session-to-session SD ≥ 1.5 ×
                   the chance-only SD √(p(1−p)/n) over the last 4–8 sessions of 10+ attempts
Imbalances         L vs R finishing gap ≥ 15 pts (10+ attempts each hand) · weak-hand ratio < 0.8
                   max − standing vertical < 3 in · relative bench ÷ relative squat > 0.95</div>
    <p>A measure only enters these rules after it meets its minimum sample (shown on the Strengths & Weaknesses page). Otherwise it is listed as “not enough data” and is not called a weakness.</p>`)}
  ${sec('pri', 'Development priority engine', `<div class="formula">priority = gap × position weight × trend factor × goal factor × confidence
gap = 100 − benchmark score
trend factor = 1.3 regressing · 1.2 stagnant · 0.85 improving fast · 1.0 otherwise
goal factor = 1.3 if the category is one of the athlete's goals, else 1.0
confidence = clamp(results ÷ 3, 0.5, 1) for tests; clamp(attempts ÷ (2 × minimum), 0.5, 1) for rates</div>`)}
  ${sec('proj', 'Projections (estimates)', `<p>A projection extends the least-squares line through a measure's results 30 and 90 days past the latest result. It needs 3+ results spanning 21+ days, is capped at 10% of the reference span beyond the elite value, and is flagged as a <b>weak fit</b> when r² &lt; 0.3 or fewer than 4 points. Real progress is rarely linear: treat projections as a direction, not a promise.</p>`)}
  ${sec('est', 'Estimates', `<div class="formula">Estimated 1RM (Epley)         = load × (1 + reps ÷ 30)          exact when reps = 1
Relative strength              = 1RM ÷ bodyweight (bodyweight on test day, else profile weight)
VO₂max from Yo-Yo IR1         = distance(m) × 0.0084 + 36.4          (Bangsbo et al., 2008)
VO₂max from 20 m shuttle       = 31.025 + 3.238·S − 3.248·age + 0.1536·age·S   (Léger, 1988; S = final speed km/h)
Repeated-sprint fatigue index  = (slowest − fastest) ÷ fastest × 100
Jump consistency               = CV of the five repeated-jump heights</div>`)}
  ${sec('shoot', 'Shooting', `<div class="formula">FG% (any split) = Σ makes ÷ Σ attempts over the range (pooled, not an average of percentages)
catch-and-shoot = spot-up + moving catch-and-shoot + off-screen shots
off-the-dribble = pull-ups + other dribble jumpers
mid-range = 2-point shots outside the paint and restricted area
95% range shown on hover = Wilson score interval
hot / cold zone = zone FG% − expected FG% for that zone (colored only with 5+ attempts)</div>
    <p>Minimum samples before a split is scored: overall 30, three-point 20, free throw 20, mid-range 15, catch-and-shoot 15, off-the-dribble 15 attempts. Expected zone rates: ${Object.values(ZONES).map((z) => `${z.name} ${Math.round(z.exp * 100)}%`).join(', ')}.</p>`)}
  ${sec('handle', 'Ball handling', `<div class="formula">ball security = clean reps ÷ (clean reps + ball losses)          (100+ reps)
weak-hand ratio = mean over drills of (weak reps/min ÷ strong reps/min)   (same drill timed with each hand)
combination execution = ball security in combination drills
completion rate = drills completed to standard ÷ drills attempted   (5+ drills)
change-of-direction rate = reps per minute in change-of-direction drills (tracked, not scored)</div>`)}
  ${sec('finish', 'Finishing', `<div class="formula">finishing % = Σ makes ÷ Σ attempts (20+)
left/right balance = lower hand % ÷ higher hand %   (10+ attempts with each hand)</div>`)}
  ${sec('game', 'Game impact', `<div class="formula">true shooting % = PTS ÷ (2 × (FGA + 0.44 × FTA))
effective FG% = (FGM + 0.5 × 3PM) ÷ FGA
assist-to-turnover = AST ÷ max(1, TOV)
Game Score (simplified Hollinger) = PTS + 0.4·FGM − 0.7·FGA − 0.4·(FTA − FTM) + 0.5·REB + STL + 0.7·AST + 0.7·BLK − TOV</div>
    <p class="small muted">Game Score here has no offensive/defensive rebound split and no foul term, because those are not collected. Game metrics need 3+ games.</p>`)}
  ${sec('compare', 'Comparisons', `<p>Period comparisons use the mean of a test's results in each period and pooled rates for makes ÷ attempts data. Seasons run August 1 – July 31. “First vs latest” uses each measure's first and most recent result ever. Changes are direction-aware: positive always means better.</p>`)}
  ${sec('corr', 'Correlation', `<p>Pearson r between paired results (each X result paired with the nearest Y result within 14 days), shown with 4+ pairs. |r| ≥ 0.7 strong, 0.4–0.7 moderate, below 0.4 weak.</p>`)}
  ${sec('refs', 'Benchmark references (editable)', `<p class="small muted">Changing a reference changes every score that uses it, everywhere in the lab. Leave a field as it is to keep the default.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Measure</th><th>Direction</th><th class="n">Floor (0)</th><th class="n">Elite (100)</th><th></th></tr></thead><tbody>${scored.map((m) => { const r = refOf(m), mod = !!doc('meta').bench[m.id], k = m.pct ? 100 : 1; return `<tr><td>${esc(m.name)} <span class="muted small">${m.pct ? '%' : esc(m.unit)}</span>${mod ? ' <span class="tag demo">edited</span>' : ''}</td><td class="small">${m.dir === 'lower' ? 'lower better' : 'higher better'}</td><td class="n"><input class="bench-in" type="number" step="any" data-bf="${m.id}" value="${+(r.floor * k).toFixed(3)}" aria-label="${esc(m.name)} floor"></td><td class="n"><input class="bench-in" type="number" step="any" data-be="${m.id}" value="${+(r.elite * k).toFixed(3)}" aria-label="${esc(m.name)} elite"></td><td>${mod ? `<button type="button" class="btn link" data-breset="${m.id}">Reset</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`)}`;
  bindActs(el);
  const saveRef = (id) => {
    const m = metric(id), k = m.pct ? 100 : 1, f = Number($(`[data-bf="${id}"]`).value) / k, e = Number($(`[data-be="${id}"]`).value) / k;
    if (!isFinite(f) || !isFinite(e) || f === e) return toast('Floor and elite must be different numbers');
    if (m.dir === 'higher' ? e < f : e > f) return toast(m.dir === 'higher' ? 'Elite must be above the floor for this measure' : 'Elite must be below the floor for this measure');
    doc('meta').bench[id] = { floor: f, elite: e }; persist('meta'); toast('Reference updated'); renderMethod();
  };
  for (const i of $$('[data-bf], [data-be]', el)) i.onchange = () => saveRef(i.dataset.bf || i.dataset.be);
  for (const b of $$('[data-breset]', el)) b.onclick = () => { delete doc('meta').bench[b.dataset.breset]; persist('meta'); renderMethod(); };
}
