// Progress: Scoreboard in Baseline style. OVR, day score, habits, streaks, food, training, time, school, body.
import { esc, todayIso, shiftIso, shortDate, fmtDur, fmtNum, avg, r1, clamp, haptic, $ } from './util.js';
import * as ml from './ml.js';
import * as pd from './plan.data.js';
import { row, ovr, HABITS, streakOf } from './insights.js';
import { on, sheet, sheetOf, toast, icon, bar, barChart, lineChart, stackChart, go, profileBtn } from './ui.js';

let N = (() => { try { return Number(localStorage.getItem('bl:range')) || 14; } catch { return 14; } })();
const range = () => Array.from({ length: N }, (_, i) => shiftIso(todayIso(), i - N + 1));

export function render() {
  const days = range(), rows = days.map(row), o = ovr(), logged = rows.filter((r) => r.ml?.n);
  const sc = rows.map((r) => r.score), c = ml.core(), ws = [...(c.weights || [])].sort((a, b) => a.date.localeCompare(b.date)), last = ws.at(-1);
  const pAvg = avg(logged.map((r) => r.ml.p)), cAvg = avg(logged.map((r) => r.ml.cal)), sl = avg(rows.map((r) => r.sleepH)), tr = rows.reduce((a, r) => a + r.train, 0);
  const habitRows = HABITS.map((h) => { const v = rows.map(h.test), known = v.filter((x) => x != null); return { h, v, pct: known.length ? Math.round((known.filter(Boolean).length / known.length) * 100) : null }; });
  return `
  <header class="lt"><div><div class="eyebrow">Last ${N} days</div><h1>Progress</h1></div><div class="actions">${profileBtn()}</div></header>
  <div class="seg" style="margin-bottom:16px">${[7, 14, 30].map((n) => `<button type="button" data-act="range" data-n="${n}" aria-pressed="${N === n}">${n} days</button>`).join('')}</div>

  <div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center">
    <div style="display:grid;justify-items:center;width:96px;padding:12px 0;border-radius:18px;background:linear-gradient(160deg,var(--fg),color-mix(in srgb,var(--fg) 75%,var(--accent)));color:var(--bg)">
      <b class="num" style="font-size:46px;line-height:1">${o.total}</b><small style="font-size:11px;font-weight:700;letter-spacing:.25em;opacity:.7">OVR</small></div>
    <div class="stack-sm">${[['Fuel', 'fuel', 'var(--cal)'], ['Strength', 'str', 'var(--c-practice)'], ['Recovery', 'rec', 'var(--c-lift)'], ['IQ', 'iq', 'var(--carbs)'], ['Discipline', 'dsc', 'var(--fat)']].map(([n, k, col]) => `<div style="display:grid;grid-template-columns:76px 1fr 26px;gap:8px;align-items:center" class="sm"><span class="b" style="color:var(--fg-2)">${n}</span>${bar((o.R[k] - 40) / 59, col)}<b class="num" style="text-align:right">${o.R[k]}</b></div>`).join('')}</div>
    <div style="grid-column:1/-1" class="row-sb"><span class="pill accent">${o.tier}</span><span class="xs muted">Rated from your last 14 days</span></div>
  </div>

  <div class="grid4" style="margin-top:12px">${[[Math.round(avg(sc) ?? 0) || '–', 'day score'], [pAvg != null ? Math.round(pAvg) + 'g' : '–', 'protein'], [sl != null ? r1(sl) + 'h' : '–', 'sleep'], [fmtDur(tr / N), 'train/day']].map(([v, l]) => `<div class="stat" style="background:var(--surface)"><b style="font-size:18px">${v}</b><span>avg ${l}</span></div>`).join('')}</div>

  <div class="card" style="margin-top:12px"><div class="card-head"><div><h3>Day score</h3><div class="sub">Food, training, recovery, school and discipline, 0-100</div></div></div><div class="chart" id="p-score"></div></div>

  <div class="sh"><h2>Habits</h2><span class="sm muted">${(() => { const b = habitRows.filter((x) => x.pct != null).sort((a, b) => b.pct - a.pct)[0]; return b ? `Best: ${esc(b.h.name)} ${b.pct}%` : ''; })()}</span></div>
  <div class="card" style="padding:14px 12px">
    <div style="display:grid;gap:5px">${habitRows.map(({ h, v, pct }) => `<div style="display:grid;grid-template-columns:92px repeat(${N},minmax(0,1fr)) 34px;gap:${N > 14 ? 2 : 3}px;align-items:center">
      <span class="xs ellipsis" style="color:var(--fg-2)" title="${esc(h.name)}">${esc(h.name)}</span>${v.map((x) => `<span style="aspect-ratio:1;border-radius:${N > 14 ? 2 : 4}px;${x ? 'background:var(--accent)' : x == null ? 'border:1px dashed var(--line)' : 'background:var(--surface-2)'}"></span>`).join('')}<span class="xs num" style="text-align:right;color:var(--fg-2)">${pct == null ? '–' : pct + '%'}</span></div>`).join('')}</div>
  </div>
  <div class="chips" style="margin-top:12px">${HABITS.filter((h) => h.name !== 'Phone under goal').map((h) => { const k = streakOf(h); return `<div class="chip" style="flex-direction:column;align-items:flex-start;min-height:0;padding:10px 14px;border-radius:14px;gap:0"><b class="num" style="font-size:22px;color:${k ? 'var(--fg)' : 'var(--faint)'}">${k}${k >= 3 ? ' 🔥' : ''}</b><span class="xs muted">${esc(h.name)}</span></div>`; }).join('')}</div>

  <div class="sh"><h2>Food</h2><button class="link" data-act="go" data-href="#food">Diary</button></div>
  <div class="card"><div class="card-head"><h3>Calories</h3><span class="num b">${cAvg != null ? fmtNum(cAvg) : '–'} <span class="xs muted">avg</span></span></div><div class="chart" id="p-cal"></div></div>
  <div class="card"><div class="card-head"><h3>Protein</h3><span class="num b">${pAvg != null ? Math.round(pAvg) + ' g' : '–'} <span class="xs muted">hit ${rows.filter((r) => r.ml?.n && r.ml.p >= r.tg.protein * 0.95).length}/${logged.length} days</span></span></div><div class="chart" id="p-pro"></div></div>
  <div class="card"><div class="card-head"><h3>Water</h3></div><div class="chart" id="p-wat"></div></div>
  ${logged.length ? (() => { const p = avg(logged.map((r) => r.ml.p)), cc = avg(logged.map((r) => r.ml.c)), f = avg(logged.map((r) => r.ml.f)), k = [p * 4, cc * 4, f * 9], s = k[0] + k[1] + k[2] || 1;
    return `<div class="card"><div class="card-head"><h3>Macro split</h3><span class="xs muted">avg on logged days</span></div><div style="display:flex;gap:2px;height:22px;border-radius:7px;overflow:hidden">${[['var(--protein)', k[0]], ['var(--carbs)', k[1]], ['var(--fat)', k[2]]].map(([c2, v]) => `<div style="flex:${v};background:${c2}"></div>`).join('')}</div>
      <div class="grid3" style="margin-top:10px">${[['Protein', k[0], p, 'var(--protein)'], ['Carbs', k[1], cc, 'var(--carbs)'], ['Fat', k[2], f, 'var(--fat)']].map(([n, v, g, c2]) => `<div class="stat"><b>${Math.round((v / s) * 100)}%</b><span><span class="dot" style="--c:${c2};width:7px;height:7px"></span> ${n} · ${Math.round(g)} g</span></div>`).join('')}</div></div>`; })() : ''}

  <div class="sh"><h2>Training &amp; recovery</h2><button class="link" data-act="go" data-href="#train">Train</button></div>
  <div class="card"><div class="card-head"><h3>Training minutes</h3><span class="num b">${fmtDur(tr)} <span class="xs muted">total</span></span></div><div class="chart" id="p-train"></div></div>
  <div class="card"><div class="card-head"><h3>Sleep</h3><span class="num b">${sl != null ? r1(sl) + ' h' : '–'} <span class="xs muted">avg</span></span></div><div class="chart" id="p-sleep"></div></div>
  <div class="card"><div class="card-head"><h3>Readiness</h3></div><div class="chart" id="p-ready"></div></div>

  <div class="sh"><h2>Time</h2><button class="link" data-act="go" data-href="#plan/time">Tracker</button></div>
  <div class="card"><div class="card-head"><h3>Where your hours go</h3></div><div class="chart" id="p-time"></div></div>
  <div class="card"><div class="card-head"><div><h3>Phone vs. training</h3><div class="sub">minutes per day, dashed line is your phone goal</div></div></div><div class="chart" id="p-phone"></div></div>

  <div class="sh"><h2>School</h2><button class="link" data-act="go" data-href="#plan/week">Week</button></div>
  <div class="card"><div class="card-head"><h3>Homework &amp; study</h3></div><div class="chart" id="p-hw"></div></div>
  <div class="card"><div class="card-head"><h3>Tasks finished</h3></div><div class="chart" id="p-tasks"></div></div>
  <div class="card"><div class="card-head"><h3>Spanish</h3><button class="btn ghost sm" data-act="go" data-href="#more/spanish">Practice</button></div><div class="chart" id="p-span"></div></div>

  <div class="sh"><h2>Body</h2><button class="link" data-act="logWeight">Log weight</button></div>
  <div class="card"><div class="card-head"><h3>Weight</h3><span class="num b">${last ? `${last.lb} lb` : '–'}${c.goalW ? ` <span class="xs muted">goal ${c.goalW.lb} lb</span>` : ''}</span></div><div class="chart" id="p-weight"></div>
    <div class="row-g" style="margin-top:12px"><button class="btn sm tinted" data-act="logWeight">Log weight</button><button class="btn sm" data-act="goalWeight">${c.goalW ? 'Edit goal' : 'Set a goal'}</button></div></div>
  `;
}
export function mount(root) {
  const days = range(), rows = days.map(row), $r = (id) => root.querySelector('#' + id);
  lineChart($r('p-score'), days, [{ name: 'Day score', values: rows.map((r) => r.score), color: 'var(--accent)' }], { min: 0, max: 100, empty: 'Use any part of the app and your day score shows up here.' });
  barChart($r('p-cal'), days, rows.map((r) => (r.ml?.n ? Math.round(r.ml.cal) : null)), { color: 'var(--cal)', target: rows.map((r) => r.tg.calories), name: 'Calories', targetName: 'Target' });
  barChart($r('p-pro'), days, rows.map((r) => (r.ml?.n ? Math.round(r.ml.p) : null)), { color: 'var(--protein)', target: rows.map((r) => r.tg.protein), unit: ' g', name: 'Protein', targetName: 'Target' });
  barChart($r('p-wat'), days, rows.map((r) => r.ml?.water || null), { color: 'var(--water)', target: rows.map((r) => r.tg.waterOz), unit: ' oz', name: 'Water', targetName: 'Goal' });
  barChart($r('p-train'), days, rows.map((r) => r.train || null), { color: 'var(--c-practice)', unit: ' min', name: 'Training' });
  lineChart($r('p-sleep'), days, [{ name: 'Sleep', values: rows.map((r) => r.sleepH), color: 'var(--c-lift)' }], { min: 4, max: 11, unit: ' h', fmt: (v) => r1(v), ref: 8, refName: '8 hours', empty: 'Do a morning check-in to track sleep.' });
  lineChart($r('p-ready'), days, [{ name: 'Readiness', values: rows.map((r) => r.ru?.total ?? null), color: 'var(--good)' }], { min: 0, max: 100, empty: 'Do a morning check-in to see readiness.' });
  stackChart($r('p-time'), days, pd.CATS.map((c) => ({ name: c.name, color: c.c, values: rows.map((r) => r.by[c.id] || 0) })), { fmtTotal: fmtDur, tipFmt: fmtDur, empty: 'Start timers in Plan → Time to see this.' });
  lineChart($r('p-phone'), days, [{ name: 'Phone', values: rows.map((r) => (r.by.phone != null ? Math.round(r.by.phone) : null)), color: 'var(--c-phone)' }, { name: 'Training', values: rows.map((r) => r.train || null), color: 'var(--c-practice)' }], { min: 0, unit: ' min', ref: rows.at(-1).phoneGoal, refName: 'Phone goal', empty: 'Track phone time in Plan → Time.' });
  barChart($r('p-hw'), days, rows.map((r) => Math.round(r.study) || null), { color: 'var(--c-homework)', unit: ' min', name: 'Homework & study' });
  barChart($r('p-tasks'), days, rows.map((r) => r.finished || null), { color: 'var(--c-lift)', name: 'Tasks finished' });
  barChart($r('p-span'), days, rows.map((r) => Math.round(r.chMins) || null), { color: 'var(--carbs)', unit: ' min', target: rows.map((r) => r.chGoal), name: 'Spanish', targetName: 'Daily goal' });
  const c = ml.core(), byDay = Object.fromEntries((c.weights || []).map((w) => [w.date, w.lb]));
  lineChart($r('p-weight'), days, [{ name: 'Weight', values: days.map((d) => byDay[d] ?? null), color: 'var(--protein)' }], { min: null, unit: ' lb', fmt: (v) => r1(v), ref: c.goalW?.lb ?? null, refName: c.goalW ? `Goal ${c.goalW.lb} lb` : '', empty: (c.weights || []).length ? 'No weigh-ins in this range. Try 30 days.' : 'Log your weight to see the trend.' });
}
on({
  range(el) { N = Number(el.dataset.n); try { localStorage.setItem('bl:range', N); } catch {} go('#progress'); },
  logWeight() { openWeight(); },
  goalWeight() {
    const g = ml.core().goalW;
    sheet({ title: 'Goal weight', right: { label: 'Save', act: 'goalSave' }, body: `<div class="stack"><div class="fields2"><label class="field"><span>Goal (lb)</span><input class="input" id="gw-lb" inputmode="decimal" value="${g?.lb ?? ''}"></label><label class="field"><span>By</span><input class="input" type="date" id="gw-date" value="${g?.date ?? shiftIso(todayIso(), 90)}"></label></div>
      <p class="sm muted" style="margin:0">Growing athletes should aim for about 0.5 lb a week, up or down. Slow changes keep your strength and speed.</p><button class="btn primary block" data-act="goalSave">Save</button></div>` });
  },
  goalSave(el) { const s = sheetOf(el), lb = Number($('#gw-lb', s.el).value), date = $('#gw-date', s.el).value; if (!(lb > 50 && lb < 500) || !date) return toast('Enter a goal weight and date'); ml.saveCore((c) => { c.goalW = { lb, date }; }); s.close(); toast('Goal saved'); },
  weightSave(el) { const s = sheetOf(el), lb = Number($('#w-lb', s.el).value), date = $('#w-date', s.el).value || todayIso(); if (!(lb > 50 && lb < 500)) return toast('Enter your weight in pounds'); ml.logWeight(date, r1(lb)); s.close(); haptic(12); toast(`Logged ${r1(lb)} lb`); },
});
export function openWeight() {
  const last = (ml.core().weights || []).at(-1);
  sheet({ title: 'Log weight', right: { label: 'Save', act: 'weightSave' }, body: `<div class="stack"><div class="fields2"><label class="field"><span>Weight (lb)</span><input class="input num" id="w-lb" inputmode="decimal" placeholder="${last?.lb ?? '160'}" style="font-size:22px"></label><label class="field"><span>Day</span><input class="input" type="date" id="w-date" value="${todayIso()}"></label></div>
    ${last ? `<p class="sm muted" style="margin:0">Last: ${last.lb} lb on ${shortDate(last.date)}. Weigh in the morning, after the bathroom, before eating.</p>` : '<p class="sm muted" style="margin:0">Weigh in the morning, after the bathroom, before eating.</p>'}
    <button class="btn primary block" data-act="weightSave">Save</button></div>`, onMount: (api) => { if (matchMedia('(hover: hover)').matches) setTimeout(() => $('#w-lb', api.el)?.focus(), 60); } });
}
