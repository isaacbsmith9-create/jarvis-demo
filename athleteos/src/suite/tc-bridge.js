// ===================== Training Center ↔ Hub bridge =====================
// Runs after the Training Center's own scripts (vendor/training-center, unchanged except its storage names:
// account doc "tc-app", backups "tc-backup-*" in 14 rotating daily slots, device key "tc:local-v3").
// 1. App switcher in place of its brand (saves before leaving).
// 2. Finished sessions become workouts in day-YYYY-MM-DD → exercise[] (CONTRACT.md), one entry per session
//    (id "btc-<session id>", source "training-center"), so they count in the Hub, Athlete OS load and MacroLens.
// 3. Publishes "btc-sig", the Training Center's weekly summary.
(function () {
  const DAY = 864e5;
  const lsJ = (k) => { try { return JSON.parse(localStorage.getItem('ml:' + k)); } catch { return null; } };
  const lsW = (k, v) => { try { localStorage.setItem('ml:' + k, JSON.stringify(v)); } catch {} };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (t) => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  let coll = null;
  const ready = (async () => {
    if (!window.claude?.use) return null;
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    const id = user ? await user.id() : null;
    if (!db || !id) return null;
    coll = db.collection('data/users/' + id); return coll;
  })().catch(() => null);
  async function getDoc(k) {
    const c = await ready; if (!c) return lsJ(k);
    try { const d = await c.doc(k).get(); if (d && d.exists) { const v = JSON.parse(JSON.stringify(d.data())); lsW(k, v); return v; } return null; } catch { return lsJ(k); }
  }
  async function writeDoc(k, v) { lsW(k, v); const c = await ready; if (c) { try { await c.doc(k).set(JSON.parse(JSON.stringify(v))); } catch {} } }

  // ---------- 1. switcher ----------
  async function saveNow() {
    try { clearTimeout(UI.dbTimer); if (UI.dbDoc && UI.ready) await UI.dbDoc.set({ state: S, savedAt: S.savedAt }); } catch {}
    await exportSessions();
  }
  for (const id of ['suite-host-side', 'suite-host']) { const el = document.getElementById(id); if (el) Suite.mount(el, 'btc', saveNow); }

  // ---------- 2. sessions → workouts ----------
  const AREA_TYPE = { Shooting: 'shooting', 'Ball Handling': 'handles', Finishing: 'finishing', Conditioning: 'conditioning', Movement: 'conditioning', Footwork: 'skill', Defense: 'skill' };
  const MET = { shooting: 4.5, handles: 5, finishing: 6, skill: 5.5, conditioning: 9 }, INTF = { light: 0.8, moderate: 1, hard: 1.2 };
  const setsOf = (i) => (Array.isArray(i.sets) ? i.sets : []);
  function stats(s) {
    let att = 0, made = 0, shots = 0;
    for (const i of s.items || []) {
      if (i.metric === 'makes') for (const x of setsOf(i)) { att += +x.att || 0; made += +x.made || 0; }
      else if ((i.category === 'Shooting' || /^shot-/.test(i.drillId || '')) && !setsOf(i).length) shots += +i.reps || 0; // logged shots, makes not counted
    }
    return { attempts: att, makes: made, pct: att ? Math.round((made / att) * 100) : null, shots: att + shots };
  }
  function areaWeights(s) {
    const w = {};
    for (const i of s.items || []) if (i.status !== 'skipped') w[i.category || 'Shooting'] = (w[i.category || 'Shooting'] || 0) + Math.max(1, setsOf(i).length);
    return w;
  }
  function asWorkout(s, weightLb) {
    const w = areaWeights(s), top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Shooting', type = AREA_TYPE[top] || 'skill';
    const rpe = s.rpe ? Math.max(1, Math.min(10, Math.round(+s.rpe))) : null;
    const int = rpe == null ? 'moderate' : rpe >= 7 ? 'hard' : rpe <= 3 ? 'light' : 'moderate', st = stats(s), t = s.startedAt || s.endedAt || Date.now(), d = new Date(t);
    const kcal = Math.round(MET[type] * INTF[int] * (weightLb || 150) * 0.4536 * ((s.minutes || 0) / 60));
    return { date: s.date || iso(t), entry: { id: 'btc-' + s.id, type, name: s.workoutName || 'Training Center session', mins: s.minutes || 0, int, ...(rpe ? { rpe } : {}), time: pad(d.getHours()) + ':' + pad(d.getMinutes()), kcal, addedAt: s.endedAt || t, source: 'training-center', btc: { sessionId: s.id, workoutId: s.workoutId || null, area: top, attempts: st.attempts, makes: st.makes, pct: st.pct, shots: st.shots, completionPct: s.completionPct ?? null } } };
  }
  let exporting = null;
  function exportSessions() {
    if (exporting) return exporting;
    exporting = (async () => {
      await null;
      try {
        const since = Date.now() - 60 * DAY, todo = (S.sessions || []).filter((s) => s && s.id && (s.endedAt || 0) >= since && !s.external);
        if (!todo.length) return;
        const sync = (await getDoc('tc-sync')) || { exported: {} }; sync.exported ||= {};
        const pending = todo.filter((s) => !sync.exported[s.id]);
        if (!pending.length) return;
        const wl = (await getDoc('core'))?.profile?.weightLb;
        const byDate = {}; for (const s of pending) { const x = asWorkout(s, wl); (byDate[x.date] ||= []).push(x.entry); }
        for (const [date, entries] of Object.entries(byDate)) {
          const k = 'day-' + date, doc = (await getDoc(k)) || { breakfast: [], lunch: [], dinner: [], snacks: [], water: 0 }, ids = new Set(entries.map((e) => e.id));
          doc.exercise = [...(doc.exercise || []).filter((e) => !ids.has(e.id)), ...entries];
          if (doc.type === 'rest') doc.type = 'training';
          await writeDoc(k, doc);
          for (const e of entries) sync.exported[e.btc.sessionId] = date;
        }
        await writeDoc('tc-sync', sync);
      } catch (e) { console.error(e); } finally { exporting = null; }
    })();
    return exporting;
  }
  const _commit = commitSession;
  commitSession = function () { const r = _commit.apply(this, arguments); setTimeout(() => { exportSessions().then(writeSig); }, 300); return r; };

  // ---------- 3. weekly signals ----------
  function writeSig() {
    try {
      const now = new Date(), t = iso(now), wd = (now.getDay() + 6) % 7, monMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - wd).getTime();
      const mins = {};
      for (const s of S.sessions || []) {
        if ((s.endedAt || 0) < Date.now() - 7 * DAY) continue;
        const w = areaWeights(s), tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
        for (const [a, n] of Object.entries(w)) mins[a] = (mins[a] || 0) + (s.minutes || 0) * n / tot;
      }
      const next = (S.plan || []).filter((p) => p.date >= t && p.status !== 'done').sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
      const s = { v: 1, app: 'btc', week: iso(monMs), updated: t, sessionsDone: (S.sessions || []).filter((x) => (x.endedAt || 0) >= monMs).length, minsByArea7d: Object.fromEntries(Object.entries(mins).filter(([, m]) => m > 0).map(([a, m]) => [a, Math.round(m)])), nextPlanned: next ? { date: next.date, title: next.title, type: next.type } : null };
      const cur = lsJ('btc-sig') || {}; if (JSON.stringify({ ...cur, updated: 0 }) === JSON.stringify({ ...s, updated: 0 })) return;
      writeDoc('btc-sig', s);
    } catch (e) { console.error(e); }
  }

  const start = () => { exportSessions().then(writeSig); };
  (function waitReady(n) { if (window.UI && UI.ready) setTimeout(start, 800); else if (n < 60) setTimeout(() => waitReady(n + 1), 250); })(0);
  window.addEventListener('pagehide', () => { try { if (UI.dbDoc && UI.ready) UI.dbDoc.set({ state: S, savedAt: S.savedAt }); } catch {} });
  window.TC_SUITE = { exportSessions, asWorkout, writeSig };
})();
