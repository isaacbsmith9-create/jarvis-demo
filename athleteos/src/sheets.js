// ===================== forms (sheets) =====================
ACTIONS['log-workout'] = (b) => openWorkoutSheet({ date: b.dataset.date });
ACTIONS['del-workout'] = (b) => confirmSheet('Delete this workout?', 'Delete', () => { const d = dayDoc(b.dataset.date); if (!d) return; d.exercise = (d.exercise || []).filter((x) => x.id !== b.dataset.id); persist('day-' + b.dataset.date); refresh(); toast('Workout deleted'); });
ACTIONS['plan-practice'] = () => {
  const pr = dayDoc(todayIso())?.practice || {};
  openSheet('Plan today\'s practice or game', `<p class="muted small">MacroLens uses this to time your pre- and post-workout meals.</p>
    <div class="fields"><label>Starts<input type="time" id="pp-start" value="${pr.start || '15:30'}"></label><label>Length<select id="pp-mins">${[60, 90, 120, 150, 180].map((m) => `<option value="${m}" ${Number(pr.mins || 120) === m ? 'selected' : ''}>${fmtDur(m)}</option>`).join('')}</select></label>
    <label class="full">Type<select id="pp-type"><option value="practice">Practice</option><option value="game" ${pr.type === 'game' ? 'selected' : ''}>Game</option><option value="lift" ${pr.type === 'lift' ? 'selected' : ''}>Lifting</option><option value="shooting" ${pr.type === 'shooting' ? 'selected' : ''}>Shooting</option></select></label></div>
    <div class="row"><button type="button" class="btn primary" id="pp-save" style="flex:1">Save plan</button>${pr.start ? '<button type="button" class="btn danger" id="pp-clear">Clear</button>' : ''}</div>`, (d) => {
    $('#pp-save', d).addEventListener('click', () => { const dd = dayDoc(todayIso(), true); dd.practice = { start: $('#pp-start', d).value, mins: Number($('#pp-mins', d).value), type: $('#pp-type', d).value }; if (dd.type === 'rest') dd.type = 'training'; persist('day-' + todayIso()); closeSheet(); toast('Practice planned'); refresh(); });
    $('#pp-clear', d)?.addEventListener('click', () => { delete dayDoc(todayIso()).practice; persist('day-' + todayIso()); closeSheet(); refresh(); });
  });
};
ACTIONS.checkin = () => {
  const date = todayIso(), f = recoveryInputs(date);
  const st = { energy: f.energy, sore: f.sore, fatigue: dayDoc(date)?.feel?.fatigue ?? null };
  const scale = (k, lo, hi) => `<div class="scale" data-scale="${k}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" class="${st[k] === n ? 'on' : ''}">${n}</button>`).join('')}</div><div class="row-between tiny muted" style="margin-top:3px"><span>${lo}</span><span>${hi}</span></div>`;
  openSheet('Morning check-in', `<p class="muted small" style="margin-top:-4px">20 seconds. Fill what you know; skip the rest. Shared with MacroLens.</p>
    <label>Sleep last night (hours)<input type="number" id="ci-sleep" min="0" max="16" step="0.25" value="${f.sleepH ?? ''}" inputmode="decimal" placeholder="e.g. 8.5"></label>
    <div><p class="muted small" style="margin-bottom:6px">Energy</p>${scale('energy', 'Drained', 'Great')}</div>
    <div><p class="muted small" style="margin-bottom:6px">Muscle soreness</p>${scale('sore', 'None', 'Very sore')}</div>
    <div><p class="muted small" style="margin-bottom:6px">Fatigue</p>${scale('fatigue', 'Fresh', 'Exhausted')}</div>
    <details><summary class="muted small" style="cursor:pointer">From a watch (optional)</summary><div class="fields" style="margin-top:8px"><label>Resting HR (bpm)<input type="number" id="ci-rhr" min="30" max="120" value="${dayDoc(date)?.feel?.rhr ?? ''}" inputmode="numeric"></label><label>HRV (ms)<input type="number" id="ci-hrv" min="5" max="250" value="${dayDoc(date)?.feel?.hrv ?? ''}" inputmode="numeric"></label></div></details>
    <button type="button" class="btn primary" id="ci-save">Save check-in</button>`, (d) => {
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-scale] [data-n]'); if (!b) return; const k = b.parentElement.dataset.scale, n = Number(b.dataset.n); st[k] = st[k] === n ? null : n; $$('button', b.parentElement).forEach((x) => x.classList.toggle('on', Number(x.dataset.n) === st[k])); });
    $('#ci-save', d).addEventListener('click', () => {
      const num = (s, lo, hi) => { const v = $(s, d).value; if (v === '') return null; const n = Number(v); return n >= lo && n <= hi ? n : NaN; };
      const sleepH = num('#ci-sleep', 0, 16), rhr = num('#ci-rhr', 30, 120), hrv = num('#ci-hrv', 5, 250);
      if ([sleepH, rhr, hrv].some((x) => Number.isNaN(x))) return toast('Check the numbers: sleep 0-16 h, resting HR 30-120, HRV 5-250');
      setFeel(date, { sleepH, energy: st.energy, sore: st.sore, fatigue: st.fatigue, rhr, hrv });
      closeSheet(); const rs = recoveryScore(date); toast(rs ? `Recovery ${rs.score}/100` : 'Check-in saved. Add one more input for a score.'); refresh();
    });
  });
};
ACTIONS['body-entry'] = () => {
  const k = ui('bodyMetric', 'weight');
  openSheet('Body entry', `<p class="muted small" style="margin-top:-4px">Fill any you measured. Leave the rest blank; nothing is estimated.</p>
    <div class="fields"><label class="full">Date<input type="date" id="be-date" value="${todayIso()}" max="${todayIso()}"></label>
    ${BODY_METRICS.map(([key, l, u]) => `<label>${l} (${u})<input type="number" step="0.1" min="0" data-be="${key}" inputmode="decimal" ${key === k ? 'autofocus' : ''}></label>`).join('')}</div>
    <button type="button" class="btn primary" id="be-save">Save</button>`, (d) => {
    $('#be-save', d).addEventListener('click', () => {
      const date = $('#be-date', d).value || todayIso(), vals = {};
      const lim = { weight: [50, 500], bf: [2, 60], muscle: [20, 300], waist: [15, 70], chest: [20, 70], arm: [6, 30], thigh: [10, 45] };
      for (const [key, l] of BODY_METRICS) { const v = $(`[data-be="${key}"]`, d).value; if (v === '') continue; const n = Number(v); if (!(n >= lim[key][0] && n <= lim[key][1])) return toast(`${l} should be ${lim[key][0]}-${lim[key][1]}`); vals[key] = r1(n); }
      if (!Object.keys(vals).length) return toast('Enter at least one value');
      const c = core();
      if (vals.weight != null) { c.weights = [...(c.weights || []).filter((w) => w.date !== date), { date, lb: vals.weight }].sort((a, b) => a.date.localeCompare(b.date)); if (date === todayIso() && c.profile) c.profile.weightLb = vals.weight; persist('core'); }
      const ms = ['waist', 'chest', 'arm', 'thigh'].filter((x) => vals[x] != null);
      if (ms.length) { const old = (c.measures || []).find((m) => m.date === date) || { date }; c.measures = [...(c.measures || []).filter((m) => m.date !== date), { ...old, ...Object.fromEntries(ms.map((x) => [x, vals[x]])) }]; persist('core'); }
      const bd = ['bf', 'muscle'].filter((x) => vals[x] != null);
      if (bd.length) { const B = doc('aos-body'), old = (B.entries || []).find((e) => e.date === date) || { date }; B.entries = [...(B.entries || []).filter((e) => e.date !== date), { ...old, ...Object.fromEntries(bd.map((x) => [x, vals[x]])) }]; persist('aos-body'); }
      closeSheet(); toast('Saved'); refresh();
    });
  });
};
ACTIONS['del-body'] = (b) => {
  const k = b.dataset.key, date = b.dataset.date, c = core();
  if (k === 'weight') { c.weights = (c.weights || []).filter((w) => w.date !== date); persist('core'); }
  else if (['waist', 'chest', 'arm', 'thigh'].includes(k)) { c.measures = (c.measures || []).map((m) => (m.date === date ? { ...m, [k]: undefined } : m)).map((m) => JSON.parse(JSON.stringify(m))); persist('core'); }
  else { const B = doc('aos-body'); B.entries = (B.entries || []).map((e) => (e.date === date ? JSON.parse(JSON.stringify({ ...e, [k]: undefined })) : e)); persist('aos-body'); }
  refresh(); toast('Entry deleted');
};

const PRIORITIES = ['Shooting', 'Ball handling', 'Finishing', 'Defense', 'Speed', 'Vertical', 'Strength', 'Conditioning', 'Basketball IQ'];
ACTIONS.settings = () => {
  const p = aos().profile || {}, mp = core().profile;
  openSheet('Athlete profile and settings', `<div class="fields">
    <label>Name<input id="s-name" maxlength="30" value="${esc(p.name || '')}" placeholder="What Coach calls you"></label><label>Position<input id="s-pos" maxlength="30" value="${esc(p.position || '')}" placeholder="Guard"></label>
    <label>Class / grade<input id="s-grade" maxlength="20" value="${esc(p.grade || '')}" placeholder="Sophomore"></label><label>Training days per week<input type="number" id="s-days" min="1" max="7" value="${p.weeklyDays || 5}"></label>
    <label>Next game<input type="date" id="s-game" value="${p.nextGame || ''}"></label><label>Nutrition goal<input disabled value="${esc(mp ? ({ lose: 'Lean out', maintain: 'Maintain / perform', gain: 'Build muscle' })[mp.goal] || mp.goal : 'Set in MacroLens')}"></label>
    <label class="full">Goals<textarea id="s-goals" maxlength="300" placeholder="Make varsity, 40% from three, 30-inch vertical…">${esc(p.goals || '')}</textarea></label></div>
    <div><p class="muted small" style="margin-bottom:6px">Development priorities</p><div class="chips" id="s-pri">${PRIORITIES.map((x) => `<button type="button" class="chip ${(p.priorities || []).includes(x) ? 'on' : ''}" data-pri="${x}">${x}</button>`).join('')}</div></div>
    <div><p class="muted small" style="margin-bottom:6px">Equipment you usually have</p><div class="chips" id="s-eq">${EQUIP.map(([k, l]) => `<button type="button" class="chip ${(p.equipment || []).includes(k) ? 'on' : ''}" data-eq="${k}">${l}</button>`).join('')}</div></div>
    <p class="muted tiny">Age, height, weight and calorie targets come from your MacroLens profile.</p>
    <button type="button" class="btn primary" id="s-save">Save profile</button>
    <div class="hr"></div>
    <div><p class="muted small" style="margin-bottom:6px">Appearance (shared with MacroLens)</p>${seg('theme', [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], themeChoice)}</div>
    <div class="hr"></div>
    <details><summary class="small" style="cursor:pointer;font-weight:600">Bring in data from the old MacroLens</summary>
      <p class="muted small" style="margin:8px 0">In the old MacroLens: Profile → Copy for Baseline. Paste the code here. New days are added; days that already exist here are kept.</p>
      <textarea id="s-code" placeholder="BL1:…" style="min-height:70px;font-size:12px"></textarea><button type="button" class="btn sm" id="s-import" style="margin-top:8px">Import</button></details>
    <p class="notice" id="storage-note"></p>`, (d) => {
    setSync($('#sync').dataset.s);
    d.addEventListener('click', (e) => {
      const c = e.target.closest('[data-pri],[data-eq]'); if (c) c.classList.toggle('on');
      const t = e.target.closest('[data-seg="theme"] button'); if (t) { e.stopPropagation(); themeChoice = t.dataset.v; try { localStorage.setItem(THEME_KEY, themeChoice); } catch {} applyTheme(themeChoice); $$('[data-seg="theme"] button', d).forEach((x) => x.classList.toggle('on', x === t)); }
    }, true);
    $('#s-save', d).addEventListener('click', () => {
      const days = Math.round(Number($('#s-days', d).value));
      aos().profile = { ...p, name: $('#s-name', d).value.trim(), position: $('#s-pos', d).value.trim(), grade: $('#s-grade', d).value.trim(), weeklyDays: days >= 1 && days <= 7 ? days : 5, nextGame: $('#s-game', d).value || null, goals: $('#s-goals', d).value.trim(), priorities: $$('[data-pri].on', d).map((x) => x.dataset.pri), equipment: $$('[data-eq].on', d).map((x) => x.dataset.eq) };
      persist('aos'); closeSheet(); toast('Profile saved'); refresh();
    });
    $('#s-import', d).addEventListener('click', () => {
      try {
        const code = $('#s-code', d).value.trim(); if (!code.startsWith('BL1:')) throw new Error('That isn\'t a MacroLens code (it starts with BL1:)');
        const bin = atob(code.slice(4)), bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0)), obj = JSON.parse(new TextDecoder().decode(bytes));
        let added = 0;
        for (const [k, v] of Object.entries(obj.data || {})) {
          if (!k.startsWith('ml:')) continue; const key = k.slice(3), val = JSON.parse(v);
          if (key === 'core') { const c = core(); if (!c.profile && val.profile) { cache.core = { ...val, ...c, profile: val.profile, targets: c.targets || val.targets }; persist('core'); } continue; }
          if (key.startsWith('day-') && !doc(key)) { cache[key] = val; persist(key); added++; }
        }
        closeSheet(); toast(`Imported ${added} new day(s)`); refresh();
      } catch (err) { toast(err.message || 'Couldn\'t read that code'); }
    });
  });
};
const APPS = [
  ['MacroLens', 'Food diary, AI photo scan, eating schedule, bowl builder, snacks', ML(''), true],
  ['ReadyUp', 'Readiness check-ins and recovery routines', 'https://claude.ai/artifact/S9xPngi3ZUsD6okgc7jqwG', false],
  ['Weekboard', 'Your week of school, practice and work', 'https://claude.ai/artifact/CT9KqYWe3FPY9a9n5EeLDN', false],
  ['Gameplan', 'Today at a glance, Top 3, focus timer', 'https://claude.ai/artifact/H3zsNQoe2ytrjRtUL9Jfhx', false],
  ['Charla', 'Daily Spanish conversation practice', 'https://claude.ai/artifact/Ya3DWBwNJ7gtNNvZ1Ndgvz', false],
  ['Baseline', 'All-in-one daily app', 'https://claude.ai/artifact/6yejSST4C1k4pprwDigbJc', false],
];
ACTIONS.apps = () => openSheet('Your apps', `<div class="apps">${APPS.map(([n, d, u, same]) => `<a class="app" ${same ? 'data-ml' : 'target="_blank" rel="noopener"'} href="${u}"><b>${n}</b><span>${d}</span><span class="st ${same ? '' : 'off'}">${same ? '● Same data as Athlete OS' : 'Separate app · opens in a new tab'}</span></a>`).join('')}</div>
  <p class="muted small">MacroLens is built into Athlete OS and shares one live database with it. The other apps are separate Claude artifacts, which can't read each other's data, so they open on their own.</p>`);
