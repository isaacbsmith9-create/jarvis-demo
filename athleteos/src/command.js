// ===================== COMMAND CENTER =====================
// Top of Home: a short daily briefing, a weekly briefing, one status per system (on track / watch / act),
// the top 3 priorities and up to 3 alerts. Plain rules over logged data (no AI), so it always works and never invents.
WIDGETS.unshift(['command', 'Command Center']);
DEFAULT_W.unshift('command');
const CC_LV = { ok: ['On track', 'var(--good)'], watch: ['Watch', 'var(--warn)'], act: ['Act', 'var(--danger)'], none: ['No data', 'var(--oth)'] };
function ccSystems() {
  const t = todayIso(), mon = mondayOf(t), w = weekStats(mon), lw = weekStats(shiftIso(mon, -7)), ls = loadStats(t), tgt = Number(aos().profile?.weeklyDays) || 5;
  const dayN = Math.min(7, daysBetween(mon, t) + 1), pace = Math.round((tgt * dayN) / 7);
  const out = [];
  // Training
  out.push({ k: 'train', name: 'Training', ic: 'dumbbell', go: 'train-overview', v: `${w.active}/${tgt} days`, s: w.active >= pace ? 'ok' : w.active >= pace - 1 ? 'watch' : 'act', note: w.active >= pace ? `On pace for ${tgt} days this week.` : `${pace - w.active} day${pace - w.active > 1 ? 's' : ''} behind your ${tgt}-day pace.`, fix: 'Get a session in today' });
  // Load
  const z = acwrZone(ls.acwr);
  out.push({ k: 'load', name: 'Load', ic: 'bolt', go: 'train-load', v: ls.acwr == null ? `${nf(ls.acute)} this week` : `ratio ${ls.acwr}`, s: ls.acwr == null ? (ls.acute ? 'ok' : 'none') : z[0] === 'hi' ? 'ok' : z[0] === 'lo' ? 'act' : 'watch', note: ls.acwr == null ? 'Needs 3 weeks of history for the ratio.' : `${z[1]}: this week vs your usual week.`, fix: ls.acwr != null && ls.acwr > 1.3 ? 'Make tomorrow an easy day' : 'Build back up gradually' });
  // Recovery
  const rs = recoveryScore(t)?.score ?? null;
  out.push({ k: 'rec', name: 'Recovery', ic: 'heart', go: 'analytics-recovery', v: rs == null ? (w.avgRec == null ? '—' : `${w.avgRec} avg`) : `${rs}/100 today`, s: rs == null && w.avgRec == null ? 'none' : (rs ?? w.avgRec) >= 65 ? 'ok' : (rs ?? w.avgRec) >= 45 ? 'watch' : 'act', note: w.avgSleep == null ? 'Do morning check-ins to track this.' : `Sleep ${w.avgSleep} h on average this week.`, fix: 'Aim for 8+ hours tonight' });
  // Mind
  const m7 = lastNDays(7).map(mentalScore).filter((x) => x != null), mAvg = m7.length ? Math.round(mean(m7)) : null;
  out.push({ k: 'mind', name: 'Mind', ic: 'brain', go: 'mind-checkin', v: mAvg == null ? '—' : `${mAvg} avg`, s: mAvg == null ? 'none' : mAvg >= 65 ? 'ok' : mAvg >= 45 ? 'watch' : 'act', note: `${m7.length} check-in${m7.length === 1 ? '' : 's'} in the last 7 days.`, fix: 'Do a mental check-in' });
  // Fuel
  out.push({ k: 'fuel', name: 'Fuel', ic: 'fork', go: 'analytics-nutrition', ml: true, v: w.foodDays ? `protein ${w.protHit}/${w.foodDays} days` : '—', s: !w.foodDays ? 'none' : w.protHit / w.foodDays >= 0.7 ? 'ok' : w.protHit / w.foodDays >= 0.4 ? 'watch' : 'act', note: w.avgProtein == null ? 'Log meals in MacroLens.' : `Avg ${w.avgProtein} g protein a day.`, fix: 'Hit your protein goal today' });
  // Goals
  const gs = (doc('aos-goals').goals || []).map((g) => goalState(g)).filter((x) => x.status !== 'done'), behind = gs.filter((x) => x.status === 'behind' || x.status === 'overdue').length;
  out.push({ k: 'goals', name: 'Goals', ic: 'target', go: 'train-goals', v: gs.length ? `${gs.length - behind}/${gs.length} on track` : '—', s: !gs.length ? 'none' : !behind ? 'ok' : behind === 1 ? 'watch' : 'act', note: gs.length ? `${behind} behind schedule.` : 'Set a goal to track it here.', fix: 'Review your behind goals' });
  return { out, w, lw, ls };
}
function ccDaily() {
  const t = todayIso(), now = nowM(), its = tdItems(t), rs = recoveryScore(t)?.score ?? null, sl = recoveryInputs(t).sleepH, ls = loadStats(t), s = [];
  const h = new Date().getHours(), part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  s.push(rs != null ? `Recovery is ${rs}/100${sl != null ? ` after ${sl} h of sleep` : ''}, ${rs >= 65 ? 'so you are good to push' : rs >= 45 ? 'so train but keep it controlled' : 'so keep today light'}.` : sl != null ? `You slept ${sl} h.` : 'Do your morning check-in so today\'s plan can match your recovery.');
  const left = its.filter((x) => x.st + x.mins > now && !x.done), big = left.find((x) => ['practice', 'game'].includes(x.type)) || left.find((x) => x.type === 'train' || evType(x.type)[3]);
  if (left.length) s.push(`${left.length} thing${left.length > 1 ? 's' : ''} left on your schedule this ${part}${big ? `, with ${big.title} at ${tdClock(big.st)}` : `, next is ${left[0].title} at ${tdClock(left[0].st)}`}.`);
  else if (its.length) s.push('Everything on today\'s schedule is done.');
  else s.push('Nothing is blocked off yet: plan your day in Gameplan.');
  if (ls.acwr != null && ls.acwr > 1.3) s.push(`Your load ratio is ${ls.acwr}, higher than usual, so skip extra hard work.`);
  if (hasFood(t) && h >= 14) { const tt = totalsOf(t), tg = targets(t); if (tt.protein < tg.protein * 0.6) s.push(`Protein is at ${Math.round(tt.protein)} of ${tg.protein} g, so make dinner protein-heavy.`); }
  const ng = aos().profile?.nextGame; if (ng && ng >= t) { const n = daysBetween(t, ng); s.push(n === 0 ? 'Game day: hydrate early and eat 3–4 hours before tip-off.' : n === 1 ? 'Game tomorrow: carbs at dinner and a full night of sleep.' : `Next game in ${n} days.`); }
  return s.slice(0, 4).join(' ');
}
function ccWeekly(w, lw, ls) {
  const s = [], pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const n = w.days, lwMins = sum(Array.from({ length: n }, (_, i) => trainingOf(shiftIso(lw.mon, i)).mins)), p = pct(w.mins, lwMins);
  s.push(`This week: ${w.active} training day${w.active === 1 ? '' : 's'} and ${fmtDur(w.mins)}${lwMins ? ` (${p >= 0 ? '+' : ''}${p}% vs the same ${n === 1 ? 'day' : n + ' days'} last week)` : ''}.`);
  if (w.avgSleep != null) s.push(`Sleep ${w.avgSleep} h a night${lw.avgSleep != null ? ` vs ${lw.avgSleep} last week` : ''}.`);
  if (w.shotA) s.push(`${nf(w.shotA)} shots at ${Math.round(w.shotPct * 100)}%${lw.shotA ? ` (${Math.round(lw.shotPct * 100)}% last week)` : ''}.`);
  if (w.prs.length) s.push(`${w.prs.length} new PR${w.prs.length > 1 ? 's' : ''}.`);
  if (w.foodDays) s.push(`Protein goal hit ${w.protHit} of ${w.foodDays} logged days.`);
  return s.join(' ');
}
function homeCommand(el) {
  el.classList.add('span2', 'cc');
  const { out, w, lw, ls } = ccSystems(), rank = { act: 0, watch: 1, ok: 3, none: 4 };
  const pri = out.filter((x) => x.s === 'act' || x.s === 'watch').sort((a, b) => rank[a.s] - rank[b.s]).slice(0, 3);
  const alerts = loadWarnings().slice(0, 3);
  el.innerHTML = `<div class="card-head"><div><h3>Command Center</h3><span class="sub">${esc(fmtDL(todayIso()))} · from everything you've logged</span></div><button type="button" class="btn sm" data-go="intel-feed">Insights ›</button></div>
    <div class="cc-brief"><span class="tiny muted">TODAY</span><p>${esc(ccDaily())}</p></div>
    <div class="cc-brief"><span class="tiny muted">THIS WEEK</span><p>${esc(ccWeekly(w, lw, ls))}</p></div>
    <div class="cc-sys">${out.map((x) => `<button type="button" class="cc-s" style="--c:${CC_LV[x.s][1]}" data-go="${x.go}" title="${esc(x.note)}"><span class="cc-ic">${ICONS[x.ic]}</span><span class="cc-n">${x.name}</span><b>${esc(x.v)}</b><em>${CC_LV[x.s][0]}</em></button>`).join('')}</div>
    <div class="grid two" style="margin-top:12px;gap:12px"><div><span class="tiny muted">TOP PRIORITIES</span>${pri.length ? `<ol class="cc-pri">${pri.map((x) => `<li><b>${esc(x.fix)}</b><span class="small muted">${esc(x.name)}: ${esc(x.note)}</span></li>`).join('')}</ol>` : '<p class="small" style="margin:6px 0">Everything is on track. Keep doing what you\'re doing.</p>'}</div>
      <div><span class="tiny muted">ALERTS</span>${alerts.length ? `<ul class="lab-list" style="margin-top:6px">${alerts.map(([k, txt]) => `<li class="${k}">${esc(txt)}</li>`).join('')}</ul>` : '<p class="small" style="margin:6px 0">No load or recovery alerts.</p>'}</div></div>`;
}
{
  const base = RENDER.home;
  RENDER.home = (el) => { base(el); const s = $('[data-widget="command"]', el); if (s) { try { homeCommand(s); } catch (e) { console.error(e); } } };
}
