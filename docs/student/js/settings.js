'use strict';
// ===================== Settings, backup, restore =====================
function applyTheme() { const th = S.settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : S.settings.theme; document.documentElement.dataset.theme = th; try { localStorage.setItem('sl:theme', th); } catch { /* private mode */ } $('meta[name=theme-color]').content = th === 'light' ? '#f3f5fa' : '#0b0f17'; }
async function restoreBackup() {
  const f = await pickFile('.json,application/json'); if (!f) return;
  let o; try { o = JSON.parse(await readAsText(f)); } catch { return toast('That file isn’t valid JSON.'); }
  const err = validateBackup(o); if (err) return toast(err);
  const n = sum(COLLECTIONS.map((c) => (o[c] || []).length));
  if (!(await confirmBox(`Replace everything on this device with the backup from ${o.exportedAt ? new Date(o.exportedAt).toLocaleString() : 'this file'} (${n} records)? Download a backup of your current data first if you need it.`, 'Restore', true))) return;
  importJSON(o); applyTheme(); toast(`Restored ${n} records`); go('home');
}
function backupNow() { download(`student-lens-backup-${today()}.json`, exportJSON(), 'application/json'); S.settings.lastBackup = Date.now(); save('settings'); toast('Backup downloaded'); }
VIEWS.settings = () => {
  const st = S.settings, p = S.profile, counts = COLLECTIONS.map((c) => [c, S[c].length]), demoN = sum(COLLECTIONS.map((c) => S[c].filter((x) => x.demo).length));
  return { title: 'Settings', sub: 'Profile, preferences and your data',
    html: `<div class="grid g-12">
      <div class="card s-6"><div class="card-h"><h2>Profile</h2></div><div class="fgrid" id="st-prof">
        <label class="f">Name<input type="text" name="name" value="${esc(p.name)}" placeholder="Your name"></label><label class="f">School<input type="text" name="school" value="${esc(p.school)}"></label>
        <label class="f">Grade / year<input type="text" name="grade" value="${esc(p.grade)}" placeholder="e.g. 11th grade"></label><label class="f">Current term<input type="text" name="term" value="${esc(p.term)}" placeholder="e.g. Fall 2026"></label></div></div>
      <div class="card s-6"><div class="card-h"><h2>Preferences</h2></div><div class="fgrid" id="st-pref">
        <label class="f">Theme<select name="theme">${[['dark', 'Dark'], ['light', 'Light'], ['system', 'Match device']].map(([k, l]) => `<option value="${k}"${st.theme === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">Daily study goal (minutes)<input type="number" name="dailyStudyMins" value="${st.dailyStudyMins}" min="0" max="600" step="5"></label>
        <label class="f">Focus block (minutes)<input type="number" name="pomo" value="${st.pomo}" min="5" max="120"></label><label class="f">Break (minutes)<input type="number" name="brk" value="${st.brk}" min="1" max="60"></label>
        <label class="f">Honors GPA bonus<input type="number" name="honorsBonus" value="${st.honorsBonus}" min="0" max="2" step="0.25"></label><label class="f">AP / IB GPA bonus<input type="number" name="apBonus" value="${st.apBonus}" min="0" max="2" step="0.25"></label></div>
        <p class="tiny dim" style="margin:10px 0 0">The study goal sets how much time exam plans schedule each day.</p></div>
      <div class="card s-6"><div class="card-h"><h2>Grade scale</h2><span class="end"><button class="btn ghost sm" id="st-scale-reset">${icon('rotate-ccw', 14)} Default</button></span></div>
        <p class="small muted" style="margin:0 0 10px">Minimum percent for each letter, and its GPA points. Letters are checked top to bottom.</p>
        <div class="table-wrap"><table class="table" id="st-scale"><thead><tr><th>Letter</th><th>Min %</th><th>Points</th></tr></thead><tbody>${st.scale.map(([l, m, pt], i) => `<tr data-i="${i}"><td><b>${esc(l)}</b></td><td><input type="number" data-k="1" value="${m}" step="any" min="0" max="110" style="width:90px;padding:6px 8px" aria-label="Minimum for ${esc(l)}"></td><td><input type="number" data-k="2" value="${pt}" step="0.1" min="0" max="6" style="width:90px;padding:6px 8px" aria-label="Points for ${esc(l)}"></td></tr>`).join('')}</tbody></table></div></div>
      <div class="card s-6"><div class="card-h"><h2>Your data</h2></div>
        <p class="small muted" style="margin:0 0 12px">Everything is stored in this browser (IndexedDB) on this device only. Nothing is uploaded. Clearing browser data deletes it, so download backups.</p>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:12px">${counts.map(([c, n]) => `<div class="card flat raised" style="padding:10px"><b class="num" style="font:700 18px var(--f-display)">${n}</b><div class="tiny muted">${c}</div></div>`).join('')}</div>
        <div class="row wrap"><button class="btn primary" id="st-back">${icon('download', 15)} Download backup</button><button class="btn" id="st-rest">${icon('upload', 15)} Restore backup</button><button class="btn" id="st-csvo">${icon('file-text', 15)} Export assignments CSV</button><button class="btn" id="st-csvi">${icon('file-up', 15)} Import CSV</button></div>
        <p class="tiny dim" style="margin:10px 0 0" id="st-store">${st.lastBackup ? `Last backup: ${new Date(st.lastBackup).toLocaleString()}` : 'No backup downloaded yet.'}</p></div>
      <div class="card s-6"><div class="card-h"><h2>Sample semester</h2></div><p class="small muted" style="margin:0 0 12px">Made-up demo data for trying the app. Every sample record is tagged so it can be removed without touching your own data.</p>
        <div class="row wrap">${demoN ? `<button class="btn" id="st-sclear">${icon('trash-2', 15)} Remove sample data (${demoN} records)</button>` : `<button class="btn" id="st-sload">${icon('sparkles', 15)} Load sample semester</button>`}</div></div>
      <div class="card s-6"><div class="card-h"><h2>About</h2></div><p class="small muted" style="margin:0">Student Lens v1.0. Smart features (priorities, briefing, advisor, study guides, quizzes, syllabus scanning, exam plans) are rule-based and run on your device. PDF reading uses pdf.js (Apache 2.0). Photo text scanning uses Tesseract.js, downloaded the first time you use it. Icons: Lucide (ISC).</p>
        <div class="row" style="margin-top:12px"><button class="btn danger" id="st-wipe">${icon('trash-2', 15)} Erase all data</button></div></div>
    </div>`,
    mount(root) {
      $('#st-prof', root).addEventListener('change', (e) => { if (e.target.name) { S.profile[e.target.name] = e.target.value.trim(); save('profile'); toast('Profile saved'); } });
      $('#st-pref', root).addEventListener('change', (e) => { const n = e.target.name; if (!n) return; let v = e.target.type === 'number' ? Number(e.target.value) : e.target.value; if (e.target.type === 'number' && (!isFinite(v) || v < Number(e.target.min) || v > Number(e.target.max))) { toast(`Enter a value from ${e.target.min} to ${e.target.max}`); e.target.value = st[n]; return; } st[n] = v; save('settings'); if (n === 'theme') applyTheme(); toast('Saved'); });
      $('#st-scale', root).addEventListener('change', (e) => { const row = e.target.closest('[data-i]'); if (!row) return; const v = Number(e.target.value); if (!isFinite(v) || v < 0) return toast('Enter a number'); st.scale[+row.dataset.i][+e.target.dataset.k] = v; const mins = st.scale.map((x) => x[1]); if (mins.some((m, i) => i && m >= mins[i - 1])) toast('Each letter’s minimum should be lower than the one above it'); save('settings'); });
      $('#st-scale-reset', root).onclick = () => { st.scale = DEFAULT_SETTINGS().scale; save('settings'); render(); toast('Grade scale reset'); };
      $('#st-back', root).onclick = backupNow; $('#st-rest', root).onclick = restoreBackup; $('#st-csvo', root).onclick = exportAssignmentsCSV; $('#st-csvi', root).onclick = importAssignmentsCSV;
      $('#st-sload', root)?.addEventListener('click', loadSample); $('#st-sclear', root)?.addEventListener('click', clearSample);
      $('#st-wipe', root).onclick = () => { modal({ title: 'Erase everything?', icon: 'triangle-alert', body: `<p style="margin:0">This deletes all classes, assignments, grades, notes, cards and history on this device. It can’t be undone. Type <b>ERASE</b> to confirm.</p><input type="text" id="wp" autocomplete="off" aria-label="Type ERASE">`, foot: `<button class="btn danger" data-ok>Erase all data</button>`, onMount: (r, close) => { $('[data-ok]', r).onclick = () => { if ($('#wp', r).value.trim() !== 'ERASE') return toast('Type ERASE to confirm'); for (const c of COLLECTIONS) S[c] = []; S.profile = DEFAULT_PROFILE(); const th = S.settings.theme; S.settings = { ...DEFAULT_SETTINGS(), theme: th }; save('profile', 'settings', ...COLLECTIONS); close(); toast('All data erased'); go('home'); }; } }); };
      navigator.storage?.estimate?.().then((e) => { const el = $('#st-store'); if (el && e.usage != null) el.textContent += ` · Using ${(e.usage / 1048576).toFixed(1)} MB of storage.`; });
    } };
};
