// ===================== DIGITAL ATHLETE PROFILE, achievements, export/import, Home widgets =====================
const STYLES_PLAY = ['Floor general', 'Scoring guard', 'Shooter', 'Slasher', '3-and-D', 'Two-way', 'Pick-and-roll creator', 'Defensive stopper'];
const ftIn = (inches) => (inches ? `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"` : '—');
RENDER.profile = (el) => {
  const p = aos().profile || {}, mp = core().profile || {}, st = availability(), r = skillRatings(), ds = devScore(), sw = strengthsWeaknesses(r);
  const wt = bodySeries('weight'), w = wt.length ? wt[wt.length - 1].v : mp.weightLb;
  const prs = allTests().map((t) => ({ t, p: prOf(t.id) })).filter((x) => x.p);
  const allDays = allDayKeys(), totS = sum(allDays.map((d) => exList(d).length)), totH = sum(allDays.map((d) => trainingOf(d).mins)) / 60, shots = sum(shotSessions().map((s) => sessionTotals(s).a));
  const fresh = checkAchievements(); if (fresh.length) setTimeout(() => toast(`Achievement unlocked: ${fresh.join(', ')}`), 300);
  const ach = aos().ach || {}, initials = (p.name || 'A').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  el.innerHTML = `<section class="card hero profile-hero">
    <div class="row" style="gap:16px;flex-wrap:nowrap;align-items:flex-start"><div class="avatar">${esc(initials)}</div>
      <div style="min-width:0;flex:1"><h1>${esc(p.name || 'Your athlete profile')}</h1><p class="muted small">${[p.position, p.grade, p.team, p.jersey ? '#' + p.jersey : ''].filter(Boolean).map(esc).join(' · ') || 'Add your position, class and team'}</p>
        <div class="tagline">${(p.style || []).map((s) => `<span class="tag blue">${esc(s)}</span>`).join('')}<span class="band ${st.status === 'available' ? 'hi' : st.status === 'limited' ? 'mid' : 'lo'}">${st.status === 'available' ? 'Available' : st.status === 'limited' ? 'Limited' : 'Out'}${st.area ? ': ' + esc(st.area) : ''}${st.back ? ' · back ' + esc(fmtD(st.back)) : ''}</span></div></div>
      ${ds ? ring(ds.score, 100, { size: 92, stroke: 9, color: 'var(--accent)', color2: 'var(--purple)', center: `<b style="font-size:24px">${ds.score}</b>`, label: 'Dev score' }) : ''}</div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn sm primary" data-act="edit-profile">Edit profile</button><button type="button" class="btn sm" data-act="status">Availability</button><button type="button" class="btn sm" data-act="settings">Goals & settings</button><button type="button" class="btn sm" data-act="data">Export / import</button></div>
  </section>
  <section class="card"><div class="card-head"><h3>Physical profile</h3></div><div class="kpis four">
    <div class="kpi"><small>Height</small><b>${ftIn(mp.heightIn)}</b></div><div class="kpi"><small>Weight</small><b>${w ? w + ' lb' : '—'}</b>${wt.length >= 2 ? spark(wt.slice(-12).map((x) => x.v), 'var(--carbs)') : ''}</div>
    <div class="kpi"><small>Wingspan</small><b>${ftIn(p.wingspan)}</b><span class="tiny muted">${p.wingspan && mp.heightIn ? `${p.wingspan - mp.heightIn >= 0 ? '+' : ''}${r1(p.wingspan - mp.heightIn)}" ape index` : ''}</span></div><div class="kpi"><small>Standing reach</small><b>${ftIn(p.reach)}</b></div>
    <div class="kpi"><small>Age</small><b>${mp.age || '—'}</b></div><div class="kpi"><small>Dominant hand</small><b style="font-size:18px">${esc(p.hand || '—')}</b></div><div class="kpi"><small>Body fat</small><b>${bodySeries('bf').slice(-1)[0]?.v ? bodySeries('bf').slice(-1)[0].v + '%' : '—'}</b></div><div class="kpi"><small>Max vertical touch</small><b>${p.reach && (prOf('appvert') || prOf('vert')) ? ftIn(p.reach + (prOf('appvert') || prOf('vert')).value) : '—'}</b></div>
  </div></section>
  <div class="grid two">
    <section class="card"><div class="card-head"><div><h3>Skill ratings</h3><span class="sub">Computed from your data</span></div><button type="button" class="btn sm" data-go="analytics-overview">Details</button></div>${radar(SKILLS.map(([k, l]) => ({ label: l.replace('Basketball ', ''), v: r[k]?.v ?? null })), { size: 280 })}</section>
    <section class="card"><div class="card-head"><h3>Strengths and weaknesses</h3></div>${sw.all.length ? `${sw.top.map((x) => `<div class="li"><span class="t up">▲ ${esc(x.l)}</span><span class="v">${x.v}</span></div>`).join('')}${sw.low.map((x) => `<div class="li"><span class="t down">▼ ${esc(x.l)}</span><span class="v">${x.v}</span></div>`).join('')}` : '<p class="muted small">Log tests and skill sessions to see these.</p>'}
      <h4 style="margin:14px 0 6px">Development goals</h4>${goals().length ? goals().slice(0, 4).map((g) => { const s = goalState(g); return `<div style="margin-bottom:8px"><div class="row-between small"><span>${esc(g.title)}</span><b>${s.pct}%</b></div>${hbar(s.pct)}</div>`; }).join('') : '<p class="muted small">No goals yet.</p>'}</section>
  </div>
  <section class="card"><div class="card-head"><div><h3>Personal records</h3><span class="sub">${prs.length} tests</span></div><button type="button" class="btn sm" data-go="train-tests">Tests</button></div>${prs.length ? `<div class="pr-grid">${prs.map(({ t, p: pr }) => `<button type="button" class="pr" data-test="${t.id}" data-go="train-tests"><small>${esc(t.name)}</small><b>${esc(fmtVal(t, pr.value))}</b><span class="tiny muted">${esc(fmtD(pr.date))}</span></button>`).join('')}</div>` : '<p class="muted small">No test results yet.</p>'}</section>
  <section class="card"><div class="card-head"><h3>Training history</h3></div><div class="kpis four"><div class="kpi"><small>Sessions</small><b>${totS}</b></div><div class="kpi"><small>Hours</small><b>${Math.round(totH)}</b></div><div class="kpi"><small>Shots logged</small><b>${shots.toLocaleString()}</b></div><div class="kpi"><small>Games</small><b>${games().length}</b></div></div>
    <h4 style="margin:14px 0 6px">Performance trends</h4><div class="list">${[['Development score', devHistory(12).map((x) => x.v), 'var(--accent)'], ['Shooting %', shotSessions().slice(-12).map((s) => sessionTotals(s).pct * 100).filter((x) => Number.isFinite(x)), 'var(--good)'], ['Weekly training hours', [7, 6, 5, 4, 3, 2, 1, 0].map((i) => sum(lastNDays(7, shiftIso(todayIso(), -7 * i)).map((d) => trainingOf(d).mins)) / 60), 'var(--purple)'], ['Game Score', games().map(gameScore).filter((x) => x != null).slice(-10), 'var(--warn)']].filter(([, v]) => v.length >= 2 && v.some((x) => x)).map(([l, v, c]) => `<div class="li"><span class="small">${l}</span><span class="row">${spark(v, c, 110)}<b class="num">${r1(v[v.length - 1])}</b></span></div>`).join('') || '<p class="muted small">Trends appear as you log.</p>'}</div></section>
  <section class="card"><div class="card-head"><div><h3>Achievements</h3><span class="sub">${Object.keys(ach).length} of ${ACHIEVEMENTS.length} unlocked</span></div></div><div class="ach-grid">${ACHIEVEMENTS.map(([id, n, d]) => `<div class="ach ${ach[id] ? 'on' : ''}" title="${esc(d)}"><span class="ach-i">${ach[id] ? '🏅' : '🔒'}</span><b>${esc(n)}</b><span class="tiny muted">${ach[id] ? esc(fmtD(ach[id])) : esc(d)}</span></div>`).join('')}</div></section>
  <section class="card"><div class="card-head"><div><h3>Milestones and PR timeline</h3><span class="sub">Every record and unlock, newest first</span></div></div>${milestoneTimeline()}</section>`;
};
function milestoneTimeline() {
  const ev = [...allPRs().map(({ t, r, prev }) => ({ date: r.date, i: '🏆', t: `${t.name}: ${fmtVal(t, r.value)}`, s: `beat ${fmtVal(t, prev)}` })), ...Object.entries(aos().ach || {}).map(([id, d]) => ({ date: d, i: '🏅', t: ACHIEVEMENTS.find((a) => a[0] === id)?.[1] || id, s: 'achievement' })), ...goals().filter((g) => goalState(g).status === 'done').map((g) => ({ date: (g.history || []).slice(-1)[0]?.date || todayIso(), i: '🎯', t: g.title, s: 'goal completed' })), ...games().filter((g) => g.pts != null && g.pts === Math.max(...games().map((x) => x.pts || 0)) && g.pts > 0).map((g) => ({ date: g.date, i: '🔥', t: `Career high: ${g.pts} pts`, s: g.opp ? 'vs ' + g.opp : '' }))].sort((a, b) => b.date.localeCompare(a.date));
  return ev.length ? `<div class="tl">${ev.slice(0, 30).map((e) => `<div class="tl-i done"><span class="tl-d">${esc(fmtD(e.date))}</span><b>${e.i} ${esc(e.t)}</b><span class="tiny muted">${esc(e.s)}</span></div>`).join('')}</div>` : emptyState('No milestones yet', 'PRs, achievements and completed goals land on this timeline.', 'trophy');
}
ACTIONS['edit-profile'] = () => {
  const p = aos().profile || {}, inch = (v) => (v ? `${Math.floor(v / 12)}-${Math.round(v % 12)}` : '');
  openSheet('Edit athlete profile', `<div class="fields"><label>Name<input id="ep-name" maxlength="30" value="${esc(p.name || '')}"></label><label>Position<input id="ep-pos" maxlength="30" value="${esc(p.position || '')}" placeholder="PG, combo guard"></label>
    <label>Team<input id="ep-team" maxlength="40" value="${esc(p.team || '')}"></label><label>Jersey #<input id="ep-num" maxlength="3" value="${esc(p.jersey || '')}" inputmode="numeric"></label>
    <label>Class / grade<input id="ep-grade" maxlength="20" value="${esc(p.grade || '')}"></label><label>Dominant hand<select id="ep-hand"><option></option>${['Right', 'Left', 'Both'].map((h) => `<option ${p.hand === h ? 'selected' : ''}>${h}</option>`).join('')}</select></label>
    <label>Wingspan (ft-in)<input id="ep-wing" value="${inch(p.wingspan)}" placeholder="6-2"></label><label>Standing reach (ft-in)<input id="ep-reach" value="${inch(p.reach)}" placeholder="7-11"></label></div>
    <div><p class="muted small" style="margin-bottom:6px">Playing style</p><div class="chips" id="ep-style">${STYLES_PLAY.map((s) => `<button type="button" class="chip ${(p.style || []).includes(s) ? 'on' : ''}" data-st="${s}">${s}</button>`).join('')}</div></div>
    <p class="muted tiny">Height, weight and age come from MacroLens (Profile). Weigh-ins update weight automatically.</p><button type="button" class="btn primary" id="ep-save">Save</button>`, (d) => {
    $('#ep-style', d).addEventListener('click', (e) => { const c = e.target.closest('[data-st]'); if (c) c.classList.toggle('on'); });
    $('#ep-save', d).addEventListener('click', () => {
      const parse = (s) => { s = s.trim(); if (!s) return null; const m = s.match(/^(\d)\D+(\d{1,2})/); const v = m ? Number(m[1]) * 12 + Number(m[2]) : Number(s); return v >= 48 && v <= 120 ? v : NaN; };
      const wing = parse($('#ep-wing', d).value), reach = parse($('#ep-reach', d).value);
      if (Number.isNaN(wing) || Number.isNaN(reach)) return toast('Use feet-inches like 6-2');
      aos().profile = { ...p, name: $('#ep-name', d).value.trim(), position: $('#ep-pos', d).value.trim(), team: $('#ep-team', d).value.trim(), jersey: $('#ep-num', d).value.trim(), grade: $('#ep-grade', d).value.trim(), hand: $('#ep-hand', d).value, wingspan: wing, reach, style: $$('[data-st].on', d).map((x) => x.dataset.st) };
      persist('aos'); closeSheet(); toast('Profile saved'); refresh();
    });
  });
};

// ----- export / import -----
const exportKeys = () => [...new Set([...Object.keys(cache), ...lsKeys()])].filter((k) => k === 'core' || k.startsWith('day-') || k.startsWith('aos'));
ACTIONS.data = () => openSheet('Export and import', `<p class="small">Export everything (food log, workouts, tests, shooting, goals, calendar) as one JSON file. Import merges a file back in: new days and entries are added, nothing you already have is overwritten.</p>
  <button type="button" class="btn primary" id="dx-exp">Export my data</button>
  <div class="hr"></div><label>Import a file<input type="file" id="dx-file" accept=".json,application/json"></label><p class="muted small" id="dx-msg"></p>`, (d) => {
  $('#dx-exp', d).addEventListener('click', async () => {
    const docs = {}; for (const k of exportKeys()) { const v = doc(k); if (v != null) docs[k] = v; }
    const data = JSON.stringify({ app: 'athlete-os', version: 2, exported: new Date().toISOString(), docs }, null, 1), name = `athlete-os-${todayIso()}.json`;
    try { const dl = window.claude?.use ? await claude.use('downloads') : null; if (!dl) throw new Error('none'); await dl.save({ filename: name, data }); $('#dx-msg', d).textContent = 'Export saved.'; }
    catch (e) { if (e?.code === 'declined') return; $('#dx-msg', d).innerHTML = `Downloading isn't available here. Copy this instead:<textarea style="min-height:140px;font-size:11px;margin-top:6px" readonly>${esc(data)}</textarea>`; }
  });
  $('#dx-file', d).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); if (j.app !== 'athlete-os' || !j.docs) throw new Error('Not an Athlete OS export');
      let added = 0;
      for (const [k, v] of Object.entries(j.docs)) {
        if (!(k === 'core' || k.startsWith('day-') || k.startsWith('aos'))) continue;
        const cur = doc(k);
        if (k.startsWith('day-')) { if (!cur) { cache[k] = v; persist(k); added++; } continue; }
        if (k === 'core') { if (!cur?.profile && v.profile) { cache.core = { ...v, ...cur, profile: v.profile }; persist('core'); added++; } continue; }
        // aos docs: merge arrays by id, keep current scalars
        const merged = { ...v, ...cur };
        for (const [field, arr] of Object.entries(v)) if (Array.isArray(arr) && Array.isArray(cur?.[field])) { const ids = new Set(cur[field].map((x) => x?.id ?? JSON.stringify(x))); const extra = arr.filter((x) => !ids.has(x?.id ?? JSON.stringify(x))); merged[field] = [...cur[field], ...extra]; added += extra.length; }
        cache[k] = merged; persist(k);
      }
      $('#dx-msg', d).textContent = `Imported ${added} new item${added === 1 ? '' : 's'}.`; refresh();
    } catch (err) { $('#dx-msg', d).textContent = err.message === 'Not an Athlete OS export' ? 'That file isn\'t an Athlete OS export.' : 'Couldn\'t read that file.'; }
  });
});

// ----- customizable Home -----
const WIDGETS = [['status', 'Readiness & availability'], ['today', "Today's schedule"], ['checklist', 'Daily checklist'], ['rec', 'Recovery'], ['fuel', 'Fuel today'], ['ai', 'Coach recommendation'], ['score', 'Development score'], ['load', 'Training load'], ['goals', 'Goals'], ['week', 'Training consistency'], ['prs', 'Latest PRs'], ['preview', 'Analytics preview'], ['ach', 'Achievements']];
const DEFAULT_W = ['status', 'today', 'rec', 'fuel', 'ai', 'score', 'goals', 'week', 'prs', 'preview'];
const widgetList = () => { const w = aos().profile?.widgets; return Array.isArray(w) && w.length ? w.filter((k) => WIDGETS.some((x) => x[0] === k)) : DEFAULT_W; };
const _homeHero = RENDER.home;
RENDER.home = (el) => {
  _homeHero(el);
  const hero = $('.hero', el); [...el.children].forEach((c) => { if (c !== hero) c.remove(); });
  const fresh = checkAchievements(); if (fresh.length) setTimeout(() => toast(`Achievement unlocked: ${fresh.join(', ')}`), 400);
  snapshotGoals();
  const R = { status: homeStatus, today: homeToday, checklist: homeChecklist, rec: homeRecovery, fuel: homeFuel, ai: homeAI, score: homeScore, load: homeLoad, goals: homeGoals, week: homeWeek, prs: homePRs, preview: homePreview, ach: homeAch };
  const wide = new Set(['fuel']);
  const grid = document.createElement('div'); grid.className = 'grid two widgets'; el.appendChild(grid);
  for (const k of widgetList()) { const s = document.createElement('section'); s.className = 'card' + (k === 'ai' ? ' ai' : '') + (wide.has(k) ? ' span2' : ''); s.dataset.widget = k; grid.appendChild(s); try { R[k](s); } catch (err) { console.error(err); s.innerHTML = `<p class="muted small">Couldn't draw this card.</p>`; } }
  el.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost block" data-act="widgets">Customize home</button>');
};
function homeStatus(el) {
  const st = availability(), rd = readiness(), ls = loadStats(), [zc, zl] = acwrZone(ls.acwr);
  el.innerHTML = `<div class="card-head"><div><h3>Ready to train?</h3><span class="sub">Readiness, load and availability</span></div><button type="button" class="btn sm" data-act="status">Status</button></div>
    <div class="row" style="gap:14px;flex-wrap:nowrap">${ring(rd?.score ?? 0, 100, { size: 92, stroke: 9, color: !rd ? 'var(--oth)' : rd.score >= 70 ? 'var(--good)' : rd.score >= 45 ? 'var(--warn)' : 'var(--danger)', center: `<b style="font-size:24px">${rd?.score ?? '—'}</b><span class="tiny muted">ready</span>` })}
    <div class="stack" style="gap:5px;min-width:0"><span class="band ${st.status === 'available' ? 'hi' : st.status === 'limited' ? 'mid' : 'lo'}" style="width:max-content">${st.status === 'available' ? 'Available' : st.status === 'limited' ? 'Limited' : 'Out'}${st.area ? ': ' + esc(st.area) : ''}</span><span class="band ${zc}" style="width:max-content">Load: ${zl}</span><span class="small">${esc(restAdvice()[0]?.[1] || 'Check in to get today\'s readiness.')}</span></div></div>`;
}
function homeChecklist(el) { const d = todayIso(), items = itemsOn(d); el.innerHTML = `<div class="card-head"><div><h3>Daily checklist</h3><span class="sub">${items.filter((x) => isChecked(d, x.key)).length} of ${items.length} done</span></div><button type="button" class="btn sm" data-go="train-today">Open</button></div>${items.length ? checklistHtml(d, items) : emptyState('No checklist', 'Build a routine in Train.', 'calendar', '<button type="button" class="btn sm primary" data-act="routine">Build a routine</button>')}`; }
function homeScore(el) { const ds = devScore(), h = devHistory(8); el.innerHTML = `<div class="card-head"><div><h3>Development score</h3><span class="sub">Updates as you log</span></div><button type="button" class="btn sm" data-go="analytics-overview">Breakdown</button></div>${ds ? `<div class="row" style="gap:14px;flex-wrap:nowrap">${ring(ds.score, 100, { size: 100, stroke: 10, color: 'var(--accent)', color2: 'var(--purple)', center: `<b style="font-size:28px">${ds.score}</b>` })}<div class="stack" style="gap:4px"><span class="small">Skills ${ds.skill} · consistency ${ds.cons} · momentum ${ds.mom}</span>${h.length >= 2 ? spark(h.map((x) => x.v), 'var(--accent)', 140, 34) : ''}</div></div>` : emptyState('Needs two skill ratings', 'Log tests, shooting or skill sessions to get your score.', 'chart')}`; }
function homeLoad(el) { const days = lastNDays(14), ls = loadStats(), [zc, zl] = acwrZone(ls.acwr); el.innerHTML = `<div class="card-head"><div><h3>Training load</h3><span class="sub">14 days · <span class="band ${zc}">${zl}</span></span></div><button type="button" class="btn sm" data-go="train-load">Details</button></div>${days.some((d) => loadOf(d)) ? '<div class="chart" id="hw-load"></div>' : '<p class="muted small">No training logged in 14 days.</p>'}`; if (days.some((d) => loadOf(d))) drawCombo($('#hw-load', el), days.map((d) => ({ label: String(parseIso(d).getDate()), full: fmtDL(d), bar: loadOf(d), color: { high: 'var(--danger)', medium: 'var(--warn)', low: 'var(--accent)', rest: 'var(--oth)' }[dayIntensity(d)], line: readiness(d)?.score ?? null, tip: `Load ${loadOf(d)}` })), { h: 150 }); }
function homeGoals(el) { const gs = goals().filter((g) => goalState(g).status !== 'done').slice(0, 4); el.innerHTML = `<div class="card-head"><div><h3>Goals</h3><span class="sub">${goals().length} total</span></div><button type="button" class="btn sm" data-go="train-goals">Roadmap</button></div>${gs.length ? gs.map((g) => { const s = goalState(g); return `<div style="margin-bottom:10px"><div class="row-between small"><span class="t">${esc(g.title)}</span><span><span class="band ${STATUS_TXT[s.status][0]}">${STATUS_TXT[s.status][1]}</span> <b>${s.pct}%</b></span></div>${hbar(s.pct)}</div>`; }).join('') : emptyState('No active goals', 'Set measurable targets that track themselves.', 'trophy', '<button type="button" class="btn sm primary" data-act="goal">＋ Goal</button>')}`; }
function homeAch(el) { const a = aos().ach || {}, got = ACHIEVEMENTS.filter((x) => a[x[0]]).sort((x, y) => a[y[0]].localeCompare(a[x[0]])); el.innerHTML = `<div class="card-head"><div><h3>Achievements</h3><span class="sub">${got.length} of ${ACHIEVEMENTS.length}</span></div><button type="button" class="btn sm" data-go="profile">All</button></div>${got.length ? `<div class="chips">${got.slice(0, 8).map((x) => `<span class="tag blue">🏅 ${esc(x[1])}</span>`).join('')}</div>` : '<p class="muted small">Your first workout unlocks the first badge.</p>'}`; }
ACTIONS.widgets = () => {
  let list = [...widgetList()];
  const draw = (d) => { $('#wl', d).innerHTML = [...list, ...WIDGETS.map((w) => w[0]).filter((k) => !list.includes(k))].map((k) => { const on = list.includes(k), i = list.indexOf(k); return `<div class="li"><label class="check" style="flex:1"><input type="checkbox" data-wk="${k}" ${on ? 'checked' : ''}> ${esc(WIDGETS.find((w) => w[0] === k)[1])}</label>${on ? `<button type="button" class="chip" data-wu="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" class="chip" data-wd="${i}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>` : ''}</div>`; }).join(''); };
  openSheet('Customize home', '<p class="muted small">Pick the cards on your Home screen and their order.</p><div class="list" id="wl"></div><div class="row"><button type="button" class="btn" id="w-reset">Reset</button><button type="button" class="btn primary" id="w-save" style="flex:1">Save</button></div>', (d) => {
    draw(d);
    d.addEventListener('change', (e) => { const c = e.target.closest('[data-wk]'); if (!c) return; list = c.checked ? [...list, c.dataset.wk] : list.filter((k) => k !== c.dataset.wk); draw(d); });
    d.addEventListener('click', (e) => { const u = e.target.closest('[data-wu]'), w = e.target.closest('[data-wd]'); const i = Number((u || w)?.dataset.wu ?? (u || w)?.dataset.wd); if (!u && !w) return; const j = u ? i - 1 : i + 1; [list[i], list[j]] = [list[j], list[i]]; draw(d); });
    $('#w-reset', d).addEventListener('click', () => { list = [...DEFAULT_W]; draw(d); });
    $('#w-save', d).addEventListener('click', () => { if (!list.length) return toast('Keep at least one card'); aos().profile = { ...(aos().profile || {}), widgets: list }; persist('aos'); closeSheet(); refresh(); });
  });
};
