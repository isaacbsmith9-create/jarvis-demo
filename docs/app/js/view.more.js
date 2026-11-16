// More: profile, settings, Spanish flashcards, data backup, links to the original apps.
import { esc, todayIso, fmtDur, haptic, $ } from './util.js';
import { keys, raw, setRaw, invalidate } from './store.js';
import * as ml from './ml.js';
import { chCore, saveChCore, chDay, dueWords, gradeWord, addWord, addSpanishSecs, spanishGoal, spanishStreak } from './insights.js';
import { on, sheet, sheetOf, toast, icon, chev, ring, go, applyTheme } from './ui.js';
import { openProfile } from './view.food.js';

const SITE = 'https://isaacbsmith9-create.github.io/jarvis-demo/';
const theme = () => { try { return localStorage.getItem('bl:theme') || 'system'; } catch { return 'system'; } };
const name = () => { try { return localStorage.getItem('bl:name') || ''; } catch { return ''; } };

export function render(rest) {
  if (rest[0] === 'spanish') return spanish();
  const c = ml.core(), t = ml.targets(todayIso()), n = name();
  return `<nav class="navbar"><button class="back" data-act="back" data-href="#today">${icon('back', 2.4)}Back</button><h2>Profile</h2><span class="right"></span></nav>
  <div style="display:grid;justify-items:center;gap:8px;padding:8px 0 20px">
    <div class="avatar" style="width:76px;height:76px;font-size:32px">${n ? esc(n[0].toUpperCase()) : icon('today')}</div>
    <form data-submit="saveName" style="width:100%;max-width:260px"><input class="input" name="n" value="${esc(n)}" placeholder="Your name" maxlength="30" style="text-align:center;font-weight:600;font-size:18px;background:none" data-change="saveNameChange" aria-label="Your name"></form>
  </div>

  <div class="sh"><h2>Targets</h2></div>
  <div class="list">
    <button type="button" class="li" data-act="openProfile"><span class="ic" style="--ic:var(--cal)">${icon('food')}</span><span class="tx"><div class="t1">Calories &amp; macros</div><div class="t2">${c.profile || c.targets ? `${t.calories.toLocaleString()} cal · ${t.protein}P · ${t.carbs}C · ${t.fat}F · ${t.waterOz} oz` : 'Not set yet'}</div></span>${chev}</button>
    <button type="button" class="li" data-act="sleepSettings"><span class="ic" style="--ic:var(--c-lift)">${icon('moon')}</span><span class="tx"><div class="t1">Sleep</div><div class="t2">Wake time and sleep goal</div></span>${chev}</button>
    <button type="button" class="li" data-act="routineEdit"><span class="ic" style="--ic:var(--c-practice)">${icon('task')}</span><span class="tx"><div class="t1">Night routine</div><div class="t2">Bedtime, steps</div></span>${chev}</button>
    <label class="li"><span class="ic" style="--ic:var(--accent)">${icon('bolt')}</span><span class="tx"><div class="t1">Smart targets</div><div class="t2">More carbs on long practice days, recovery bump on low readiness</div></span><span class="switch"><input type="checkbox" ${c.prefs?.smart !== false ? 'checked' : ''} data-change="smart"><span></span></span></label>
  </div>

  <div class="sh"><h2>Appearance</h2></div>
  <div class="card tight"><div class="seg">${[['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" data-act="theme" data-t="${k}" aria-pressed="${theme() === k}">${l}</button>`).join('')}</div></div>

  <div class="sh"><h2>School</h2></div>
  <div class="list"><button type="button" class="li" data-act="go" data-href="#more/spanish"><span class="ic" style="--ic:var(--carbs)">${icon('spanish')}</span><span class="tx"><div class="t1">Spanish</div><div class="t2">${dueWords().length} cards due · ${spanishStreak()} day streak</div></span>${chev}</button>
    <button type="button" class="li" data-act="wbSettings"><span class="ic" style="--ic:var(--c-homework)">${icon('week')}</span><span class="tx"><div class="t1">Homework auto-fit</div><div class="t2">School ends, bedtime, daily limit</div></span>${chev}</button></div>

  <div class="sh"><h2>Your data</h2></div>
  <div class="list">
    <button type="button" class="li" data-act="exportData"><span class="ic" style="--ic:var(--protein)">${icon('download')}</span><span class="tx"><div class="t1">Back up</div><div class="t2">Download everything as one file</div></span>${chev}</button>
    <label class="li" style="cursor:pointer"><span class="ic" style="--ic:var(--c-work)">${icon('upload')}</span><span class="tx"><div class="t1">Restore from backup</div><div class="t2">Loads a backup file onto this phone</div></span>${chev}<input type="file" accept="application/json,.json" data-change="importData" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
  </div>
  <p class="xs muted" style="margin:8px 4px 0">Everything is saved on this phone and shared with MacroLens, ReadyUp, Weekboard, Gameplan, Charla and Scoreboard on this website. Nothing is sent anywhere.</p>

  <div class="sh"><h2>Original apps</h2></div>
  <div class="list">${[['MacroLens', '', 'var(--cal)', 'food'], ['ReadyUp', 'recovery/', 'var(--fat)', 'heart'], ['Weekboard', 'weekboard/', 'var(--c-lift)', 'week'], ['Gameplan', 'gameplan/', 'var(--warn)', 'task'], ['Charla', 'charla/', 'var(--carbs)', 'spanish'], ['Scoreboard', 'scoreboard/', 'var(--protein)', 'chart'], ['Locker', 'locker/', 'var(--fg-2)', 'grid']]
    .map(([n2, p, c2, ic]) => `<a class="li" href="${SITE}${p}"><span class="ic" style="--ic:${c2}">${icon(ic)}</span><span class="tx"><div class="t1">${n2}</div></span>${chev}</a>`).join('')}</div>
  <p class="xs muted" style="margin:20px 4px 0;text-align:center">Baseline · works offline · no account, no API key</p>`;
}
on({
  saveName(form) { setRaw('bl:name', form.n.value.trim()); form.n.blur(); go('#more'); },
  saveNameChange(el) { setRaw('bl:name', el.value.trim()); go('#more'); },
  theme(el) { setRaw('bl:theme', el.dataset.t); applyTheme(el.dataset.t); go('#more'); },
  smart(el) { ml.saveCore((c) => { c.prefs = { ...(c.prefs || {}), smart: el.checked }; }); },
  wbSettings() {
    import('./plan.data.js').then((pd) => { const st = pd.wbCore().settings;
      sheet({ title: 'Homework auto-fit', right: { label: 'Save', act: 'wbSetSave' }, body: `<div class="stack"><div class="fields2"><label class="field"><span>School ends</span><input class="input" type="time" id="ws-school" value="${st.school}"></label><label class="field"><span>Weekend start</span><input class="input" type="time" id="ws-wk" value="${st.wkstart}"></label></div>
        <div class="fields2"><label class="field"><span>Bedtime</span><input class="input" type="time" id="ws-bed" value="${st.bed}"></label><label class="field"><span>Max homework/day</span><select class="input" id="ws-max">${[60, 90, 120, 150, 180, 240].map((m) => `<option value="${m}"${Number(st.max) === m ? ' selected' : ''}>${fmtDur(m)}</option>`).join('')}</select></label></div>
        <button class="btn primary block" data-act="wbSetSave">Save</button></div>` }); });
  },
  wbSetSave(el) { const s = sheetOf(el); import('./plan.data.js').then((pd) => { pd.saveWbCore((c) => { Object.assign(c.settings, { school: $('#ws-school', s.el).value, wkstart: $('#ws-wk', s.el).value, bed: $('#ws-bed', s.el).value, max: Number($('#ws-max', s.el).value) }); }); s.close(); toast('Saved'); }); },
  exportData() {
    const data = {}; for (const k of keys()) if (/^(ml|mlw|ru|wb|gp|ch|lk|bl|sb):/.test(k)) data[k] = raw(k);
    const blob = new Blob([JSON.stringify({ app: 'baseline', at: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `baseline-backup-${todayIso()}.json` }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast(`Backed up ${Object.keys(data).length} items`);
  },
  async importData(el) {
    const f = el.files?.[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()), data = j.data || {}; let n = 0;
      for (const [k, v] of Object.entries(data)) if (/^(ml|mlw|ru|wb|gp|ch|lk|bl|sb):/.test(k) && typeof v === 'string') { setRaw(k, v); n++; }
      invalidate(); toast(`Restored ${n} items`); go('#today');
    } catch { toast("That file isn't a Baseline backup"); }
    el.value = '';
  },
});

// ===================== Spanish =====================
let reviewQ = null, flipped = false, reviewStart = 0;
function spanish() {
  const c = chCore(), goal = spanishGoal(), secs = chDay(todayIso())?.secs || 0, mins = Math.floor(secs / 60), due = dueWords();
  if (!reviewQ) reviewQ = due.slice().sort(() => Math.random() - 0.5);
  reviewQ = reviewQ.filter((w) => c.words.some((x) => x.es === w.es));
  const w = reviewQ[0];
  return `<nav class="navbar"><button class="back" data-act="back" data-href="#more">${icon('back', 2.4)}Back</button><h2>Spanish</h2><span class="right"></span></nav>
  <div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center">
    ${ring({ pct: secs / (goal * 60), size: 96, stroke: 10, color: 'var(--carbs)', center: `<b style="font-size:24px">${mins}</b><span>of ${goal} min</span>`, label: `${mins} of ${goal} minutes` })}
    <div><div class="big" style="font-size:28px">${spanishStreak()} <small>day streak</small></div><div class="sm muted" style="margin-top:4px">${c.words.length} words · ${c.words.filter((x) => x.box >= 5).length} learned</div>
      <div class="row-g" style="margin-top:10px"><select class="input" style="min-height:34px;width:auto;padding:4px 30px 4px 10px;font-size:14px" data-change="chGoal" aria-label="Daily goal">${[5, 10, 15, 20, 30].map((m) => `<option value="${m}"${m === goal ? ' selected' : ''}>${m} min goal</option>`).join('')}</select></div></div>
  </div>
  <div class="sh"><h2>Review</h2><span class="sm muted">${due.length} due today</span></div>
  ${w ? `<button type="button" class="card" data-act="flip" style="display:grid;place-items:center;gap:8px;min-height:190px;width:100%;border:0;color:inherit;text-align:center">
      <b lang="es" style="font-size:30px;letter-spacing:-.01em">${esc(w.es)}</b>${flipped ? `<span style="font-size:19px;color:var(--fg-2)">${esc(w.en)}</span>` : '<span class="sm muted">Tap to see the meaning</span>'}</button>
    ${flipped ? `<div class="grid2" style="margin-top:12px"><button class="btn danger" data-act="grade" data-g="0">Missed it</button><button class="btn primary" data-act="grade" data-g="1">Got it</button></div>` : `<div class="grid2" style="margin-top:12px"><button class="btn" data-act="say">${icon('spanish')} Hear it</button><button class="btn tinted" data-act="flip">Flip</button></div>`}
    <p class="xs muted" style="text-align:center;margin:8px 0 0">${reviewQ.length} left · review time counts toward your daily goal</p>`
  : `<div class="card empty"><b>All caught up</b>${c.words.length ? 'New cards show up as they come due.' : 'Add words from class below and they turn into flashcards.'}</div>`}
  <div class="sh"><h2>Add a word</h2></div>
  <form class="card stack" data-submit="addWord"><div class="fields2"><label class="field"><span>Spanish</span><input class="input" name="es" lang="es" autocomplete="off" maxlength="60"></label><label class="field"><span>English</span><input class="input" name="en" autocomplete="off" maxlength="60"></label></div><button class="btn tinted block">Add card</button></form>
  ${c.words.length ? `<div class="sh"><h2>Words</h2><span class="sm muted">${c.words.length}</span></div><div class="list">${c.words.slice().reverse().slice(0, 60).map((x) => `<div class="li" style="min-height:46px"><span class="tx"><b lang="es">${esc(x.es)}</b> <span class="muted">· ${esc(x.en)}</span></span><span class="pill${x.box >= 5 ? ' good' : ''}">${x.box >= 5 ? 'learned' : 'level ' + (x.box || 1)}</span></div>`).join('')}</div>` : ''}
  <div class="list" style="margin-top:16px"><a class="li" href="${SITE}charla/"><span class="ic" style="--ic:var(--carbs)">${icon('spanish')}</span><span class="tx"><div class="t1">Open Charla</div><div class="t2">Conversation practice lives there</div></span>${chev}</a></div>`;
}
const tickReview = () => { if (reviewStart) { const s = Math.round((Date.now() - reviewStart) / 1000); if (s > 0) addSpanishSecs(Math.min(s, 120)); } reviewStart = Date.now(); };
on({
  flip() { if (!reviewStart) reviewStart = Date.now(); flipped = !flipped; haptic(); go('#more/spanish'); },
  grade(el) {
    const w = reviewQ.shift(), got = el.dataset.g === '1'; if (!w) return;
    gradeWord(w.es, got); if (!got) reviewQ.push(w);
    flipped = false; haptic(got ? 12 : 25); tickReview();
  },
  say() { try { const u = new SpeechSynthesisUtterance(reviewQ?.[0]?.es || ''); u.lang = chCore().settings.accent || 'es-MX'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} },
  addWord(form) { const es = form.es.value.trim(), en = form.en.value.trim(); if (!es || !en) return toast('Add both the Spanish and the English'); if (addWord(es, en)) { reviewQ = null; toast(`Added “${es}”`); } else toast('Already in your deck'); form.reset(); },
  chGoal(el) { saveChCore((c) => { c.settings.goal = Number(el.value); }); },
});
