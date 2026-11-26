// ===================== Hub Round E: readiness forecast · trend alerts · why today was good · best-day recipe =====================
// All read-only: computed from data the apps already log. Estimates say so and get better as data builds up.
// Forecast (night shutdown): tomorrow's readiness for 3 bedtimes = recent average + sleep effect (your own sleep→next-day
//   readiness slope once 8+ pairs exist, else +5 per hour vs 8 h) − today's load (hard −4, game −6).
// Trends (card on Hub Today): checks over the last 7 days vs before; up to 3 shown, worst first.
// Why (card): before noon explains yesterday, after 7 PM today — for 80+ days what went right, for ≤55 what held it back,
//   compared with your 14-day averages. Recipe (Insights tab): the average of your 80+ score days.
const reAvg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const reDays = (n, end = todayIso()) => { const o = []; for (let i = n - 1; i >= 0; i--) o.push(shiftIso(end, -i)); return o; };
function reMetrics(d) {
  const ex = hubSafe(() => exList(d), []) || [], tg = hubSafe(() => targets(d), {}) || {}, food = hubSafe(() => hasFood(d), false);
  return { date: d, sleep: hubSafe(() => hpSleepNight(d), null), ready: hubSafe(() => hpReady(d), null), mins: ex.length ? sum(ex.map((x) => +x.mins || 0)) : 0,
    hard: ex.some((x) => x.int === 'hard' || x.type === 'game'), game: ex.some((x) => x.type === 'game'), protein: food ? Math.round(totalsOf(d).protein) : null, pTarget: tg.protein || null,
    water: hubSafe(() => waterOf(d), 0) || null, wTarget: tg.waterOz || null, checkin: !!(doc('rl-check')?.days?.[d] || doc('rl-ready')?.days?.[d]), energy: doc('rl-check')?.days?.[d]?.energy ?? null,
    score: hubSafe(() => r2Score(d).score, null), def: hubSafe(() => { const H = rdDefHab(); return H ? hbDone(H, d) : null; }, null) };
}
// ---------- forecast ----------
function reSlope() {
  const pts = []; for (const d of reDays(60)) { const s = hubSafe(() => hpSleepNight(d), null), r = hubSafe(() => hpReady(d), null); if (s != null && r != null && s < 14) pts.push([s, r]); }
  if (pts.length < 8) return { k: 5, own: false, n: pts.length };
  const mx = reAvg(pts.map((p) => p[0])), my = reAvg(pts.map((p) => p[1])), cov = sum(pts.map(([x, y]) => (x - mx) * (y - my))), vx = sum(pts.map(([x]) => (x - mx) ** 2));
  const k = vx ? cov / vx : 5; return { k: Math.max(1, Math.min(12, k)), own: true, n: pts.length };
}
function reForecast(t = todayIso()) {
  const C = doc('gp-core')?.routine || {}, bed = rcMin(C.bed || '22:30'), wake = rcMin(C.wake || '06:45') + 1440, first = (hubSafe(() => tdItems(shiftIso(t, 1)), []) || [])[0];
  const wakeAt = first && first.st + 1440 - 45 < wake ? first.st + 1440 - 45 : wake;
  const base = reAvg(reDays(14, t).map((d) => hubSafe(() => hpReady(d), null)).filter((x) => x != null)) ?? 65, S = reSlope(), m = reMetrics(t);
  const load = m.game ? -6 : m.hard ? -4 : 0, pts = [0, 30, 60].map((late) => { const b = bed + late, h = Math.max(0, (wakeAt - b - 15) / 60); return { bed: b, h, score: Math.round(Math.max(20, Math.min(98, base + (h - 8) * S.k + load))) }; });
  return { pts, base: Math.round(base), slope: S, load, wakeAt };
}
const reClk = (m) => tdClock(((m % 1440) + 1440) % 1440);
function reForecastHtml() {
  const F = reForecast(); return `<h4>Tomorrow’s readiness (estimate)</h4><div class="re-fc">${F.pts.map((p, i) => `<div class="${i === 0 ? 'on' : ''}"><small>Asleep by ${reClk(p.bed)}</small><b>~${p.score}</b><span>${r1(p.h)} h</span></div>`).join('')}</div>
    <p class="tiny muted" style="margin:6px 0 0">Wake ${reClk(F.wakeAt)}. ${F.slope.own ? `Based on your own sleep vs readiness (${F.slope.n} nights).` : `Uses a general rule until you have 8+ nights of sleep and readiness logged (${F.slope.n} so far).`}${F.load ? ` Today’s ${F.load === -6 ? 'game' : 'hard session'} lowers it a bit.` : ''}</p>`;
}
{ const _n = r3NightCard; r3NightCard = function () { const h = _n(); const i = h.indexOf('<h4>Due tomorrow</h4>'); return i > 0 ? h.slice(0, i) + reForecastHtml() + h.slice(i) : h; }; }
// ---------- trends ----------
function reTrends(t = todayIso()) {
  const W = reDays(7, t).map(reMetrics), P = reDays(21, shiftIso(t, -7)).map(reMetrics), out = [];
  const add = (lvl, ic, title, why) => out.push({ lvl, ic, title, why });
  const fed = W.filter((m) => m.protein != null && m.pTarget), under = fed.filter((m) => m.protein < m.pTarget * 0.9);
  if (fed.length >= 3 && under.length >= Math.ceil(fed.length * 0.5)) add(2, '🍗', `Protein under target ${under.length} of ${fed.length} logged days`, `Average ${Math.round(reAvg(fed.map((m) => m.protein)))} g vs ${fed[0].pTarget} g. Add a shake or a second protein at lunch.`);
  if (fed.length >= 3 && !under.length) add(0, '🍗', `Protein goal hit every logged day this week`, 'Keep it going.');
  const sl = W.filter((m) => m.sleep != null), short = sl.filter((m) => m.sleep < 7);
  if (sl.length >= 3 && short.length >= 3) add(3, '😴', `Under 7 h of sleep ${short.length} of the last ${sl.length} nights`, `Average ${r1(reAvg(sl.map((m) => m.sleep)))} h. Readiness drops about ${Math.round(reSlope().k)} points per hour lost.`);
  const games = reDays(30, t).filter((d) => (hubSafe(() => itemsOn(d), []) || []).some((x) => x.type === 'game')), pre = games.map((g) => hubSafe(() => hpSleepNight(g), null)).filter((x) => x != null);
  if (pre.length >= 2 && reAvg(pre) < 7.5) add(3, '🏀', `Short sleep before games (${r1(reAvg(pre))} h avg)`, 'The night before a game is the one that matters most.');
  const mW = sum(W.map((m) => m.mins)), mP = sum(P.map((m) => m.mins)) / 3;
  if (mP >= 60 && mW > mP * 1.4) add(2, '📈', `Training up ${Math.round((mW / mP - 1) * 100)}% vs your usual week`, `${mW} min this week vs ~${Math.round(mP)}. Big jumps raise injury risk: keep the next 2 days light.`);
  if (mP >= 120 && mW < mP * 0.5 && t >= shiftIso(t, 0)) add(1, '📉', `Training down to ${mW} min this week`, `Usually ~${Math.round(mP)}. Fine if it’s a rest week; if not, get one session in.`);
  const ck = W.filter((m) => m.checkin).length; if (ck <= 3) add(1, '☀️', `Morning check-in ${ck} of 7 days`, 'It takes 60 seconds and makes readiness and training adjustments accurate.');
  const scW = W.map((m) => m.score).filter((x) => x != null), scP = reDays(7, shiftIso(t, -7)).map((d) => hubSafe(() => r2Score(d).score, null)).filter((x) => x != null);
  if (scW.length >= 4 && scP.length >= 4) { const a = reAvg(scW), b = reAvg(scP); if (a - b >= 8) add(0, '🔥', `Daily score up: ${Math.round(a)} avg vs ${Math.round(b)} last week`, 'Whatever you changed, keep it.'); else if (b - a >= 8) add(2, '⚠️', `Daily score down: ${Math.round(a)} avg vs ${Math.round(b)} last week`, 'Check sleep and protein first.'); }
  const wk = (i) => { let a = 0, m = 0; for (const d of reDays(7, shiftIso(t, -7 * i))) for (const w of hubSafe(() => btcOn(d), []) || []) { a += +w.btc?.attempts || 0; m += +w.btc?.makes || 0; } return a >= 50 ? m / a : null; };
  const s3 = [wk(2), wk(1), wk(0)]; if (s3.every((x) => x != null)) { if (s3[0] < s3[1] && s3[1] < s3[2]) add(0, '🎯', `Shooting % up 3 weeks in a row (${Math.round(s3[2] * 100)}%)`, 'Your shot is trending the right way.'); else if (s3[0] > s3[1] && s3[1] > s3[2]) add(2, '🎯', `Shooting % down 3 weeks in a row (${Math.round(s3[2] * 100)}%)`, 'More form shooting and rhythm, less volume when tired.'); }
  const dd = W.filter((m) => m.def != null), dn = dd.filter((m) => m.def).length; if (dd.length >= 5) add(dn >= 5 ? 0 : 1, '🛡️', `Defense with Owen ${dn} of 7 days`, dn >= 5 ? 'Locked in on defense.' : 'Aim for 5+ a week.');
  return out.sort((a, b) => b.lvl - a.lvl);
}
function reTrendCard() {
  const L = reTrends(); if (!L.length) return '';
  return `<section class="card re-trend"><h3>Trends this week</h3><ul class="re-list">${L.slice(0, 3).map((x) => `<li class="l${x.lvl}"><span>${x.ic}</span><div><b>${esc(x.title)}</b><small>${esc(x.why)}</small></div></li>`).join('')}</ul>${L.length > 3 ? `<p class="tiny muted" style="margin:6px 0 0">+${L.length - 3} more in Insights</p>` : ''}</section>`;
}
// ---------- why today was good ----------
function reWhy(d) {
  const m = reMetrics(d); if (m.score == null) return null;
  const base = reDays(14, shiftIso(d, -1)).map(reMetrics), av = (k) => reAvg(base.map((x) => x[k]).filter((x) => x != null)), good = m.score >= 80, bad = m.score <= 55;
  if (!good && !bad) return null;
  const f = [];
  if (m.sleep != null && av('sleep') != null) f.push({ k: 'Sleep', v: m.sleep - av('sleep'), txt: `${r1(m.sleep)} h sleep (usual ${r1(av('sleep'))})`, w: 2 });
  if (m.protein != null && m.pTarget) f.push({ k: 'Protein', v: (m.protein - m.pTarget) / 30, txt: `${m.protein} g protein (target ${m.pTarget})`, w: 1.5 });
  else if (bad) f.push({ k: 'Protein', v: -2, txt: 'No food logged', w: 1.5 });
  f.push({ k: 'Training', v: m.mins ? (m.mins - (av('mins') || 0)) / 30 + 1 : -1.5, txt: m.mins ? `${m.mins} min trained` : 'No training logged', w: 1 });
  f.push({ k: 'Check-in', v: m.checkin ? 1 : -1.5, txt: m.checkin ? `Checked in${m.energy ? ` (energy ${m.energy}/5)` : ''}` : 'No morning check-in', w: 1 });
  if (m.def != null) f.push({ k: 'Defense', v: m.def ? 1 : -0.5, txt: m.def ? 'Defense with Owen done' : 'No defense work', w: 0.8 });
  const top = f.map((x) => ({ ...x, s: x.v * x.w })).sort((a, b) => (good ? b.s - a.s : a.s - b.s)).filter((x) => (good ? x.s > 0 : x.s < 0)).slice(0, 3);
  return top.length ? { d, score: m.score, good, top } : null;
}
function reWhyCard() {
  const h = new Date().getHours(), d = h < 12 ? shiftIso(todayIso(), -1) : h >= 19 ? todayIso() : null; if (!d) return '';
  const W = reWhy(d); if (!W) return '';
  return `<section class="card re-why ${W.good ? 'good' : 'bad'}"><h3>${W.good ? '✅ Why' : '🔍 What held back'} ${d === todayIso() ? 'today' : 'yesterday'} (${W.score})</h3><ul class="re-list">${W.top.map((x) => `<li><span>${W.good ? '↑' : '↓'}</span><div><b>${esc(x.k)}</b><small>${esc(x.txt)}</small></div></li>`).join('')}</ul>${W.good ? '<p class="tiny muted" style="margin:6px 0 0">Do it again: see your best-day recipe in Insights.</p>' : ''}</section>`;
}
// ---------- best-day recipe ----------
function reRecipe() {
  const all = reDays(90).map(reMetrics).filter((m) => m.score != null), best = all.filter((m) => m.score >= 80), rest = all.filter((m) => m.score < 80);
  if (best.length < 3) return { n: best.length, need: 3 - best.length };
  const a = (L, k) => reAvg(L.map((x) => x[k]).filter((x) => x != null)), pct = (L, f) => Math.round((L.filter(f).length / Math.max(1, L.length)) * 100);
  return { n: best.length, rows: [
    ['😴 Sleep', a(best, 'sleep') != null ? `${r1(a(best, 'sleep'))} h` : '—', a(rest, 'sleep') != null ? `${r1(a(rest, 'sleep'))} h` : '—'],
    ['🍗 Protein', a(best, 'protein') != null ? `${Math.round(a(best, 'protein'))} g` : '—', a(rest, 'protein') != null ? `${Math.round(a(rest, 'protein'))} g` : '—'],
    ['💪 Training', `${Math.round(a(best, 'mins') || 0)} min`, `${Math.round(a(rest, 'mins') || 0)} min`],
    ['☀️ Checked in', `${pct(best, (m) => m.checkin)}%`, `${pct(rest, (m) => m.checkin)}%`],
    ['🛡️ Defense', `${pct(best, (m) => m.def)}%`, `${pct(rest, (m) => m.def)}%`]] };
}
function reRecipeHtml() {
  const R = reRecipe();
  if (!R.rows) return `<section class="card re-recipe"><h3>🧪 Your best-day recipe</h3><p class="small muted" style="margin:4px 0 0">Unlocks after 3 days with a score of 80+ (${R.n} so far). Then it shows what those days have in common.</p></section>`;
  return `<section class="card re-recipe"><h3>🧪 Your best-day recipe</h3><p class="small muted" style="margin:2px 0 8px">What your ${R.n} best days (80+) look like vs the rest.</p><table class="re-tbl"><thead><tr><th></th><th>Best days</th><th>Other days</th></tr></thead><tbody>${R.rows.map((r) => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td class="muted">${r[2]}</td></tr>`).join('')}</tbody></table></section>`;
}
// ---------- wiring ----------
{ const _today = HUB.today; HUB.today = (el) => { _today(el); hubSafe(() => { const at = el.querySelector('.hab-card') || el.querySelector('.r2-score') || el.querySelector('.hub-head'); at?.insertAdjacentHTML('afterend', reWhyCard() + reTrendCard()); }); }; }
{ const _g = HUB.graphs; HUB.graphs = (el) => { _g(el); hubSafe(() => { const L = reTrends(); el.querySelector('.hub-head')?.insertAdjacentHTML('afterend', reRecipeHtml() + (L.length ? `<section class="card re-trend"><h3>All trends</h3><ul class="re-list">${L.map((x) => `<li class="l${x.lvl}"><span>${x.ic}</span><div><b>${esc(x.title)}</b><small>${esc(x.why)}</small></div></li>`).join('')}</ul></section>` : '')); }); }; }
window.Ecosystem = { ...(window.Ecosystem || {}), forecast: reForecast, trends: reTrends, why: reWhy, recipe: reRecipe };
