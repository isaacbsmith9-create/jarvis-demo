// ===================== TRAIN: calendar, daily checklist, load, tests, goals, library, history =====================
RENDER.train = (el, sub) => TRAIN[sub](el);
const TRAIN = {};
TRAIN.tests = (el) => RENDER.tests(el);


// ----- library -----
TRAIN.library = (el) => {
  const tab = ui('libTab', 'drill'), q = ui('libQ', ''), cat = ui('libCat', 'all'), favs = doc('aos-lib').favs || [];
  const items = tab === 'fav' ? LIB.filter((x) => favs.includes(x.id)) : tab === 'mine' ? [] : LIB.filter((x) => x.kind === (tab === 'drill' ? 'drill' : 'exercise'));
  const cats = [...new Set(items.map((x) => x.cat))];
  const shown = items.filter((x) => (cat === 'all' || x.cat === cat) && (!q || `${x.name} ${x.cat} ${x.cue} ${x.eq}`.toLowerCase().includes(q.toLowerCase())));
  const mine = doc('aos-lib').workouts || [];
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Workout library</h3><span class="sub">${DRILLS.length} basketball drills · ${EXERCISES.length} exercises · your custom workouts</span></div><button type="button" class="btn sm primary" data-act="build-workout">＋ Build a workout</button></div>
    <div class="row" style="margin-bottom:10px">${seg('libTab', [['drill', 'Drills'], ['exercise', 'Exercises'], ['mine', `My workouts (${mine.length})`], ['fav', `Favorites (${favs.length})`]], tab)}</div>
    ${tab !== 'mine' ? `<input id="lib-q" placeholder="Search drills and exercises…" value="${esc(q)}" style="margin-bottom:10px"><div class="chips" style="margin-bottom:10px"><button type="button" class="chip ${cat === 'all' ? 'on' : ''}" data-libcat="all">All</button>${cats.map((c) => `<button type="button" class="chip ${cat === c ? 'on' : ''}" data-libcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${shown.length ? `<div class="list">${shown.map((x) => `<div class="li" style="align-items:flex-start"><div><div class="t">${esc(x.name)}</div><div class="s">${esc(x.cat)} · ${esc(x.eq)} · <b>${esc(x.dose)}</b></div><div class="s" style="margin-top:2px">${esc(x.cue)}</div></div><button type="button" class="chip ${isFav(x.id) ? 'on' : ''}" data-fav="${x.id}" aria-label="Favorite">${isFav(x.id) ? '★' : '☆'}</button></div>`).join('')}</div>` : emptyState(tab === 'fav' ? 'No favorites yet' : 'Nothing matches', tab === 'fav' ? 'Tap ☆ on any drill or exercise to keep it here.' : 'Try another word or category.', 'grid')}`
    : mine.length ? `<div class="list">${mine.map((w) => { const n = sum(allDayKeys().map((d) => exList(d).filter((x) => x.workoutId === w.id).length)); return `<div class="li" style="align-items:flex-start"><div><div class="t">${esc(w.name)}</div><div class="s">${esc(w.focus || '')} · ${w.items.length} items · ~${w.mins} min · done ${n}×</div><div class="s">${w.items.slice(0, 4).map((i) => esc(libItem(i.id)?.name || i.name)).join(', ')}${w.items.length > 4 ? '…' : ''}</div></div><div class="row"><button type="button" class="chip" data-act="start-workout" data-id="${w.id}">Start</button><button type="button" class="chip" data-act="build-workout" data-id="${w.id}">Edit</button></div></div>`; }).join('')}</div>` : emptyState('No custom workouts', 'Build one from the drill and exercise library. It becomes one tap to start and log.', 'dumbbell', '<button type="button" class="btn sm primary" data-act="build-workout">Build a workout</button>')}
  </section><section class="card" id="w-run" hidden></section>`;
  $('#lib-q')?.addEventListener('input', (e) => { setUi('libQ', e.target.value); clearTimeout(TRAIN.qT); TRAIN.qT = setTimeout(() => { refresh(); const i = $('#lib-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
};
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-libcat]'); if (c) { setUi('libCat', c.dataset.libcat); return refresh(); }
  const f = e.target.closest('[data-fav]'); if (f) { toggleFav(f.dataset.fav); return refresh(); }
});
ACTIONS['build-workout'] = (b) => {
  const w = b.dataset.id ? (doc('aos-lib').workouts || []).find((x) => x.id === b.dataset.id) : null;
  let items = w ? w.items.map((x) => ({ ...x })) : [];
  const draw = (d) => { $('#bw-items', d).innerHTML = items.length ? items.map((it, i) => `<div class="li"><div style="min-width:0"><div class="t">${esc(libItem(it.id)?.name || it.name)}</div></div><div class="row" style="flex-wrap:nowrap"><input data-dose="${i}" value="${esc(it.dose)}" style="width:130px"><button type="button" class="chip" data-rm="${i}" aria-label="Remove">✕</button></div></div>`).join('') : '<p class="muted small">Add drills or exercises below.</p>'; };
  openSheet(w ? 'Edit workout' : 'Build a workout', `<div class="fields"><label class="full">Name<input id="bw-name" maxlength="40" value="${esc(w?.name || '')}" placeholder="Guard skills, Lower power…"></label><label>Focus<select id="bw-focus">${FOCUSES.map(([k, l]) => `<option value="${k}" ${w?.focus === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Minutes<input type="number" id="bw-mins" min="10" max="240" value="${w?.mins || 60}"></label></div>
    <div class="list" id="bw-items"></div>
    <input id="bw-q" placeholder="Search to add: pull-ups, euro step, two-ball…"><div class="list" id="bw-res"></div>
    <div class="row"><button type="button" class="btn primary" id="bw-save" style="flex:1">Save workout</button>${w ? '<button type="button" class="btn danger" id="bw-del">Delete</button>' : ''}</div>`, (d) => {
    draw(d);
    const search = () => { const q = $('#bw-q', d).value.toLowerCase(); const r = (q ? LIB.filter((x) => `${x.name} ${x.cat}`.toLowerCase().includes(q)) : LIB.filter((x) => isFav(x.id))).slice(0, 8); $('#bw-res', d).innerHTML = r.map((x) => `<button type="button" class="li li-btn" data-addlib="${x.id}"><span><span class="t">${esc(x.name)}</span> <span class="s">${esc(x.cat)}</span></span><span class="muted">＋</span></button>`).join(''); };
    search(); $('#bw-q', d).addEventListener('input', search);
    d.addEventListener('click', (e) => { const a = e.target.closest('[data-addlib]'); if (a) { const x = libItem(a.dataset.addlib); items.push({ id: x.id, dose: x.dose }); draw(d); } const r = e.target.closest('[data-rm]'); if (r) { items.splice(Number(r.dataset.rm), 1); draw(d); } });
    d.addEventListener('input', (e) => { const x = e.target.closest('[data-dose]'); if (x) items[Number(x.dataset.dose)].dose = x.value; });
    $('#bw-save', d).addEventListener('click', () => { if (!items.length) return toast('Add at least one drill or exercise'); const rec = { id: w?.id || uid('lw'), name: $('#bw-name', d).value.trim() || 'My workout', focus: $('#bw-focus', d).value, mins: Number($('#bw-mins', d).value) || 60, items }; const L = doc('aos-lib'); L.workouts = [...(L.workouts || []).filter((x) => x.id !== rec.id), rec]; persist('aos-lib'); setUi('libTab', 'mine'); closeSheet(); toast('Workout saved'); go('train', 'library'); });
    $('#bw-del', d)?.addEventListener('click', () => confirmSheet('Delete this workout?', 'Delete', () => { const L = doc('aos-lib'); L.workouts = L.workouts.filter((x) => x.id !== w.id); persist('aos-lib'); refresh(); }));
  });
};
ACTIONS['start-workout'] = (b) => {
  const w = (doc('aos-lib').workouts || []).find((x) => x.id === b.dataset.id), o = $('#w-run'); if (!w || !o) return;
  o.hidden = false;
  o.innerHTML = `<div class="card-head"><div><h3>${esc(w.name)}</h3><span class="sub">Check items off as you go</span></div></div><div class="list">${w.items.map((it) => { const x = libItem(it.id) || {}; return `<label class="li check"><input type="checkbox"><span style="flex:1;min-width:0"><span class="t">${esc(x.name || it.name)}</span><span class="s" style="display:block">${esc(it.dose)} · ${esc(x.cue || '')}</span></span></label>`; }).join('')}</div><button type="button" class="btn primary block" data-act="finish-lib" data-id="${w.id}" style="margin-top:12px">✓ Finish and log</button>`;
  o.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
ACTIONS['finish-lib'] = (b) => { const w = (doc('aos-lib').workouts || []).find((x) => x.id === b.dataset.id); openWorkoutSheet({ type: focusType(w.focus), name: w.name, mins: w.mins, workoutId: w.id }); };

// ----- searchable history -----
function historyItems() {
  const out = [];
  for (const d of allDayKeys()) for (const x of exList(d)) out.push({ date: d, kind: 'workout', icon: 'dumbbell', title: x.name || 'Workout', sub: `${fmtDur(x.mins)} · ${x.int || ''}${x.rpe ? ' · RPE ' + x.rpe : ''}${x.rating ? ' · rated ' + x.rating + '/5' : ''}`, text: x.notes || '' });
  for (const s of shotSessions()) { const t = sessionTotals(s); out.push({ date: s.date, kind: 'shooting', icon: 'ball', title: `Shooting ${t.m}/${t.a} (${pctTxt(t.pct)})`, sub: STYLES.find((x) => x[0] === s.style)?.[1] || '', text: s.note || '' }); }
  for (const s of handleSessions()) out.push({ date: s.date, kind: 'handles', icon: 'ball', title: `Ball handling · ${fmtDur(s.mins)}`, sub: `${s.weakMins || 0} min weak hand · ${s.losses || 0} ball losses`, text: [(s.combos || []).join(', '), s.note].join(' ') });
  for (const s of finishSessions()) { const t = finishTotals([s]); out.push({ date: s.date, kind: 'finishing', icon: 'ball', title: `Finishing ${t.m}/${t.a} (${pctTxt(t.a ? t.m / t.a : null)})`, sub: `Left ${t.L.m}/${t.L.a} · right ${t.R.m}/${t.R.a}`, text: s.note || '' }); }
  for (const f of filmEntries()) out.push({ date: f.date, kind: 'film', icon: 'spark', title: f.title || 'Film study', sub: `${FILM_TYPES.find((x) => x[0] === f.type)?.[1] || ''}${f.mins ? ' · ' + f.mins + ' min' : ''}${f.player ? ' · ' + f.player : ''}`, text: [f.notes, f.takeaways, (f.tags || []).join(' ')].join(' ') });
  for (const g of games()) out.push({ date: g.date, kind: 'game', icon: 'trophy', title: `Game${g.opp ? ' vs ' + g.opp : ''}${g.result ? ' (' + g.result + ')' : ''}`, sub: `${g.pts ?? '—'} pts · ${g.reb ?? '—'} reb · ${g.ast ?? '—'} ast`, text: g.opp || '' });
  for (const r of doc('aos-tests').results || []) { const t = testById(r.test); if (t) out.push({ date: r.date, kind: 'test', icon: 'trophy', title: `${t.name}: ${fmtVal(t, r.value)}`, sub: t.group, text: r.note || '' }); }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
TRAIN.history = (el) => {
  const q = ui('hq', ''), k = ui('hk', 'all'), all = historyItems();
  const items = all.filter((x) => (k === 'all' || x.kind === k) && (!q || `${x.title} ${x.sub} ${x.text} ${x.date} ${fmtDL(x.date)}`.toLowerCase().includes(q.toLowerCase())));
  el.innerHTML = `<section class="card"><div class="card-head"><div><h3>Training history</h3><span class="sub">${all.length} entries across workouts, shooting, handles, finishing, film, games and tests</span></div></div>
    <input id="h-q" placeholder="Search notes, opponents, drills, dates…" value="${esc(q)}" style="margin-bottom:10px">
    <div class="chips" style="margin-bottom:10px">${[['all', 'All'], ['workout', 'Workouts'], ['shooting', 'Shooting'], ['handles', 'Handles'], ['finishing', 'Finishing'], ['film', 'Film'], ['game', 'Games'], ['test', 'Tests'], ['mind', 'Mental'], ['routine', 'Routines']].map(([v, l]) => `<button type="button" class="chip ${k === v ? 'on' : ''}" data-hk="${v}">${l}</button>`).join('')}</div>
    ${items.length ? `<div class="list">${items.slice(0, 150).map((x) => `<div class="li" style="justify-content:flex-start;align-items:flex-start"><span style="width:20px;height:20px;flex:none;color:var(--accent)">${ICONS[x.icon]}</span><div style="flex:1;min-width:0"><div class="row-between"><span class="t">${esc(x.title)}</span><span class="tiny muted">${esc(fmtD(x.date))}</span></div><div class="s">${esc(x.sub)}</div>${x.text.trim() ? `<div class="s" style="font-style:italic">${esc(x.text.trim().slice(0, 140))}</div>` : ''}</div></div>`).join('')}</div>${items.length > 150 ? `<p class="muted tiny">Showing 150 of ${items.length}. Search to narrow it down.</p>` : ''}` : emptyState(all.length ? 'No matches' : 'No history yet', all.length ? 'Try another word or filter.' : 'Everything you log in Athlete OS and MacroLens shows up here.', 'calendar')}</section>`;
  $('#h-q').addEventListener('input', (e) => { setUi('hq', e.target.value); clearTimeout(TRAIN.hT); TRAIN.hT = setTimeout(() => { refresh(); const i = $('#h-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
};
document.addEventListener('click', (e) => { const c = e.target.closest('[data-hk]'); if (c) { setUi('hk', c.dataset.hk); refresh(); } });
