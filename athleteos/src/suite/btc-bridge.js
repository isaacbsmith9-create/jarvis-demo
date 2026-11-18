// ===================== Training Center ↔ Athlete suite bridge =====================
// Runs after the Training Center's own script (vendor/btc.html, unchanged except its storage names).
// 1. App switcher (saves before leaving).
// 2. Finished sessions become workouts in day-YYYY-MM-DD → exercise[] (CONTRACT.md), so they count in Athlete OS load,
//    analytics and the Lab, and in MacroLens calories. One entry per session (id "btc-<session id>"), never twice.
// 3. Today's recommendation also reads Athlete OS: the calendar (games, practices), load ratio and readiness (read-only).
// 4. Publishes "btc-sig", the Training Center's weekly summary.
(function () {
  const lsJ = (k) => { try { return JSON.parse(localStorage.getItem('ml:' + k)); } catch { return null; } };
  const lsW = (k, v) => { try { localStorage.setItem('ml:' + k, JSON.stringify(v)); } catch {} };
  let coll = null;
  const ready = (async () => {
    if (!window.claude?.use) return null;
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    const id = user ? await user.id() : null;
    if (!db || !id) return null;
    coll = db.collection('data/users/' + id); return coll;
  })().catch(() => null);
  /** Fresh copies of the docs we need (from the account when available, else this device). */
  async function fetchDocs(keys) {
    const out = {}; for (const k of keys) out[k] = lsJ(k);
    const c = await ready; if (!c) return out;
    try { const snap = await c.get(); for (const d of snap.docs) if (d.exists && keys.includes(d.id)) { out[d.id] = JSON.parse(JSON.stringify(d.data())); lsW(d.id, out[d.id]); } } catch {}
    return out;
  }
  async function writeDoc(k, v) { lsW(k, v); const c = await ready; if (c) { try { await c.doc(k).set(JSON.parse(JSON.stringify(v))); } catch {} } }

  // ---------- 1. switcher ----------
  async function saveNow() {
    clearTimeout(dbTimer);
    if (dbDoc) { try { await dbDoc.set({ state: S, savedAt: S.savedAt }); } catch {} }
    await exportSessions();
  }
  Suite.mount(document.getElementById('suite-host'), 'btc', saveNow);

  // ---------- 2. sessions → workouts ----------
  const AREA_TYPE = { Shooting: 'shooting', 'Ball Handling': 'handles', Finishing: 'finishing', Conditioning: 'conditioning', Movement: 'conditioning' };
  const MET = { shooting: 4.5, handles: 5, finishing: 6, skill: 5.5, conditioning: 9 }, INTF = { light: 0.8, moderate: 1, hard: 1.2 };
  function asWorkout(s, weightLb) {
    const items = activeItems(s), w = {};
    for (const i of items) w[i.category] = (w[i.category] || 0) + Math.max(1, (i.setLog || []).length);
    const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] || s.objective, type = AREA_TYPE[top] || 'skill';
    const rated = items.filter((i) => i.rating), rpe = rated.length ? Math.max(2, Math.min(10, Math.round((sum(rated, (i) => i.rating) / rated.length) * 2))) : null;
    const int = rpe == null ? 'moderate' : rpe >= 7 ? 'hard' : rpe <= 3 ? 'light' : 'moderate', st = itemStats(items), d = new Date(s.startedAt);
    const kcal = Math.round(MET[type] * INTF[int] * (weightLb || 150) * 0.4536 * (s.minutes / 60));
    return { date: fmtD(d), entry: { id: 'btc-' + s.id, type, name: s.name, mins: s.minutes, int, ...(rpe ? { rpe } : {}), time: pad(d.getHours()) + ':' + pad(d.getMinutes()), kcal, addedAt: s.endedAt, source: 'training-center', btc: { sessionId: s.id, workoutId: s.workoutId, area: top, attempts: st.att, makes: st.made, pct: st.pct, completionPct: s.completionPct } } };
  }
  let exporting = null;
  function exportSessions() {
    if (exporting) return exporting;
    // The finally below must run after this assignment, so the work starts after one await.
    exporting = (async () => {
      await null;
      try {
        const since = Date.now() - 60 * DAY, todo = S.sessions.filter((s) => s.endedAt >= since);
        if (!todo.length) return;
        const sync = (await fetchDocs(['btc-sync']))['btc-sync'] || { exported: {} }, pending = todo.filter((s) => !sync.exported[s.id]);
        if (!pending.length) return;
        const wl = (await fetchDocs(['core'])).core?.profile?.weightLb;
        const byDate = {}; for (const s of pending) { const x = asWorkout(s, wl); (byDate[x.date] ||= []).push(x.entry); }
        const days = await fetchDocs(Object.keys(byDate).map((d) => 'day-' + d));
        for (const [date, entries] of Object.entries(byDate)) {
          const k = 'day-' + date, doc = days[k] || { breakfast: [], lunch: [], dinner: [], snacks: [], water: 0 }, ids = new Set(entries.map((e) => e.id));
          doc.exercise = [...(doc.exercise || []).filter((e) => !ids.has(e.id)), ...entries];
          if (doc.type === 'rest') doc.type = 'training';
          await writeDoc(k, doc);
          for (const e of entries) sync.exported[e.btc.sessionId] = date;
        }
        await writeDoc('btc-sync', sync);
      } catch (e) { console.error(e); } finally { exporting = null; }
    })();
    return exporting;
  }
  const _finish = finishRun;
  finishRun = function () { _finish(); exportSessions().then(writeSig); };

  // ---------- 3. Athlete OS context for today's recommendation ----------
  let ctx = null;
  function aosToday() {
    const t = today(), wd = new Date(t + 'T12:00:00').getDay(), evs = (ctx?.plan?.events || []).filter((e) => !(e.skip || []).includes(t) && (e.date === t || (e.recur?.days?.includes(wd) && t >= e.date && (!e.recur.until || t <= e.recur.until))));
    return { game: evs.some((e) => e.type === 'game') || ctx?.aos?.profile?.nextGame === t || (ctx?.core?.game?.date === t), practice: evs.some((e) => e.type === 'practice') };
  }
  const _rec = recommend;
  recommend = function () {
    const r = _rec(); if (!ctx) return r;
    const fresh = ctx.sig && ctx.sig.updated && (Date.now() - new Date(ctx.sig.updated + 'T12:00:00')) < 3 * DAY ? ctx.sig : null, td = aosToday(), notes = [];
    if (td.game && r.mode !== 'Game day') { Object.assign(r, { mode: 'Game day', minutes: 15, hard: false }); notes.push('Your Athlete OS calendar has a game today: form shots and free throws only.'); }
    else if (td.practice && r.mode === 'Full session') { Object.assign(r, { mode: 'Practice day', minutes: 20, hard: false }); notes.push('Your Athlete OS calendar has team practice today.'); }
    if (r.hard && fresh?.acwr != null && fresh.acwr > 1.3) { Object.assign(r, { mode: 'Recovery-leaning', minutes: Math.min(r.minutes, 20), hard: false }); notes.push(`Athlete OS load ratio is ${fresh.acwr}, above 1.3, so this block is lighter.`); }
    else if (r.hard && fresh?.readiness != null && fresh.readiness < 45) { Object.assign(r, { mode: 'Recovery-leaning', minutes: Math.min(r.minutes, 20), hard: false }); notes.push(`Athlete OS readiness is ${fresh.readiness}/100 today.`); }
    if (r.mode === 'Full session' && fresh?.acwr != null) r.reason = r.reason.replace('recent load is low', `your Athlete OS load ratio is ${fresh.acwr}`);
    if (notes.length) r.reason = [r.reason.replace('No practice or game today and recent load is low.', '').trim(), ...notes].filter(Boolean).join(' ');
    r.fromAos = true;
    return r;
  };

  // ---------- 4. weekly signals ----------
  function writeSig() {
    try {
      const t = today(), wd = (new Date(t + 'T12:00:00').getDay() + 6) % 7, mon = addDays(t, -wd), monMs = new Date(mon + 'T00:00:00').getTime();
      const mins = areaMinutes(7), next = S.plan.filter((p) => p.date >= t && p.status !== 'done').sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
      const s = { v: 1, app: 'btc', week: mon, updated: t, sessionsDone: S.sessions.filter((x) => x.endedAt >= monMs).length, minsByArea7d: Object.fromEntries(Object.entries(mins).filter(([, m]) => m > 0).map(([a, m]) => [a, Math.round(m)])), nextPlanned: next ? { date: next.date, title: next.title, type: next.type } : null };
      const cur = lsJ('btc-sig') || {}; if (JSON.stringify({ ...cur, updated: 0 }) === JSON.stringify({ ...s, updated: 0 })) return;
      writeDoc('btc-sig', s);
    } catch (e) { console.error(e); }
  }

  (async () => {
    const d = await fetchDocs(['aos-signals', 'aos-plan', 'aos', 'core']);
    ctx = { sig: d['aos-signals'], plan: d['aos-plan'], aos: d.aos, core: d.core };
    render();
    setTimeout(() => { exportSessions().then(writeSig); }, 1500);
  })();
  window.addEventListener('pagehide', () => { try { if (dbDoc) dbDoc.set({ state: S, savedAt: S.savedAt }); } catch {} });
  window.BTC_SUITE = { exportSessions, asWorkout, ctx: () => ctx };
})();
