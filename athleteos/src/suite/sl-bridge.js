// ===================== Student Lens ↔ Hub bridge =====================
// Loaded after Student Lens's own scripts and before its app.js (vendor/student-lens, unchanged).
// 1. App switcher in the header (saves before leaving).
// 2. Account sync: the whole Student Lens state (minus uploaded file bodies) is kept in doc "sl-data", so it follows you
//    across devices. On open, the newer of this device and the account wins.
// 3. Publishes doc "life-school" { classes, items, grades, snaps, gpa, sl:true } so Hub, Athlete OS and Gameplan see your
//    classes, due work and grades (CONTRACT.md). Student Lens owns both docs.
// 4. Downloads (backup, reports) go through the Claude downloads capability, since plain file links are blocked here.
(function () {
  const lsJ = (k) => { try { return JSON.parse(localStorage.getItem('ml:' + k)); } catch { return null; } };
  const lsW = (k, v) => { try { localStorage.setItem('ml:' + k, JSON.stringify(v)); } catch {} };
  const LOCAL_AT = 'sl:updatedAt';
  const localAt = () => { try { return Number(localStorage.getItem(LOCAL_AT)) || 0; } catch { return 0; } };
  const setLocalAt = (t) => { try { localStorage.setItem(LOCAL_AT, String(t)); } catch {} };
  let coll = null;
  const ready = (async () => {
    if (!window.claude?.use) return null;
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    const id = user ? await user.id() : null;
    if (!db || !id) return null;
    coll = db.collection('data/users/' + id); return coll;
  })().catch(() => null);
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  async function writeDoc(k, v) { const c = await ready; if (c) { try { await c.doc(k).set(JSON.parse(JSON.stringify(v))); } catch (e) { console.error(e); } } }

  // ---------- state <-> doc ----------
  function snapshotState() {
    const o = JSON.parse(exportJSON());
    o.docs = (o.docs || []).map(({ data, ...rest }) => ({ ...rest, ...(data ? { onDevice: true } : {}) })); // file bodies stay on the device
    return o;
  }
  const hasData = () => S.classes.length || S.assignments.length || S.exams.length || S.sessions.length || S.decks.length;

  // ---------- life-school projection ----------
  const TYPE_MAP = { homework: 'hw', lab: 'hw', reading: 'hw', test: 'test', quiz: 'quiz', project: 'project', essay: 'essay', other: 'other' };
  const CAT_MAP = { test: 'test', exam: 'test', quiz: 'quiz' };
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  function project() {
    const t = today(), g = gpaFor();
    const classes = S.classes.map((c) => { const cg = classGrade(c.id) || {}; return { id: c.id, name: c.name, teacher: c.teacher || '', period: c.period || '', level: c.level || 'regular', color: c.color, core: c.core !== false, active: isActiveClass(c, t), latePolicy: c.latePolicy || null, startDate: c.startDate || '', endDate: c.endDate || '', slPct: r1(cg.pct), letter: cg.letter || null }; });
    const items = [
      ...S.assignments.filter((a) => a.due).map((a) => ({ id: a.id, title: a.title, cls: a.classId, type: TYPE_MAP[a.type] || 'other', due: a.due, time: a.dueTime || '', mins: Number(a.estMins) || DEF_MINS[a.type] || 30, done: isDone(a) })),
      ...S.exams.filter((e) => e.date).map((e) => ({ id: e.id, title: e.title, cls: e.classId, type: 'exam', due: e.date, time: e.time || '', mins: 60, done: (e.score != null && e.score !== '') || e.date < t })),
    ];
    const grades = S.classes.flatMap((c) => gradedItems(c.id).map((x) => { const a = x.kind === 'assignment' ? byId('assignments', x.id) : null; return { id: x.id, cls: c.id, title: x.title, cat: x.kind === 'exam' ? 'test' : CAT_MAP[a?.type] || 'hw', score: x.score, max: x.max, date: x.date }; }));
    const snaps = {}; for (const s of S.snapshots || []) if (s.gpa != null) snaps[s.date] = Math.round(s.gpa * 100) / 100;
    if (g) snaps[t] = Math.round(g.unweighted * 100) / 100;
    return { v: 1, sl: true, updated: t, classes, items, grades, snaps, gpa: g ? { unweighted: Math.round(g.unweighted * 100) / 100, weighted: Math.round(g.weighted * 100) / 100 } : null };
  }
  let lastProj = '';
  function publish() {
    try {
      const p = project(), key = JSON.stringify({ ...p, updated: 0 });
      if (key === lastProj) return; lastProj = key;
      lsW('life-school', p); writeDoc('life-school', p);
    } catch (e) { console.error(e); }
  }

  // ---------- sync ----------
  let pushT = null, applying = false;
  async function pushNow() {
    clearTimeout(pushT); pushT = null;
    const at = Date.now(); setLocalAt(at);
    publish();
    await writeDoc('sl-data', { updatedAt: at, state: snapshotState() });
  }
  const _flush = flushSave;
  flushSave = async function () { await _flush(); if (applying) return; clearTimeout(pushT); pushT = setTimeout(pushNow, 1500); };

  const _load = loadAll;
  loadAll = async function () {
    await _load();
    const c = await withTimeout(ready, 8000); if (!c) { publish(); return; }
    try {
      const snap = await withTimeout(c.get(), 8000);
      const d = snap?.docs?.find((x) => x.exists && x.id === 'sl-data'), remote = d ? JSON.parse(JSON.stringify(d.data())) : null;
      if (remote?.state && !validateBackup(remote.state) && (!hasData() || (remote.updatedAt || 0) > localAt())) {
        const bodies = Object.fromEntries((S.docs || []).filter((x) => x.data).map((x) => [x.id, x.data]));
        remote.state.docs = (remote.state.docs || []).map((x) => (bodies[x.id] ? { ...x, data: bodies[x.id] } : x));
        applying = true; importJSON(remote.state); await _flush(); applying = false;
        setLocalAt(remote.updatedAt || Date.now()); publish();
      } else if (hasData()) pushNow();
    } catch (e) { applying = false; console.error(e); publish(); }
  };

  // ---------- late-work policy per class (class.latePolicy: 'full' | 'some' | 'none') ----------
  // Overdue and deadline risks follow the class's rule: full credit late = lower urgency, no late work = always high.
  const LATE = { full: 'Late work still gets full credit in this class.', some: 'Late work is only sometimes accepted in this class.', none: 'Late work is not accepted in this class, so a miss can be a zero.' };
  const DOWN = { high: 'medium', medium: 'low', low: 'low' };
  const _risks = risks;
  risks = function () {
    const out = _risks().map((r) => {
      const p = r.classId && cls(r.classId)?.latePolicy; if (!LATE[p] || !/^(overdue|missing|deadline):/.test(r.id)) return r;
      const level = p === 'none' ? 'high' : p === 'full' && !r.id.startsWith('deadline:') ? DOWN[r.level] : r.level;
      const action = p === 'none' && !r.id.startsWith('deadline:') ? 'Ask the teacher today whether it can still be turned in, and do it first if so.' : p === 'full' && !r.id.startsWith('deadline:') ? 'Turn it in when you can; it still counts fully. Put tighter deadlines first.' : r.action;
      return { ...r, level, why: `${LATE[p]} ${r.why}`, action };
    });
    return out.sort((a, b) => LVL[b.level][0] - LVL[a.level][0]);
  };

  // ---------- downloads ----------
  download = async function (name, text, type = 'text/plain') {
    try { const dl = window.claude?.use ? await claude.use('downloads') : null; if (!dl) throw new Error('none'); await dl.save({ filename: name, data: text }); }
    catch (e) { if (e?.code !== 'declined') toast('Saving files isn’t available here. Use Copy where offered.'); }
  };

  // ---------- switcher ----------
  async function saveNow() { try { await _flush(); if (pushT || !localAt()) await withTimeout(pushNow(), 2500); } catch {} }
  if (window.Suite) for (const id of ['suite-host-side', 'suite-host']) { const el = document.getElementById(id); if (el) Suite.mount(el, 'school', saveNow); }
  window.addEventListener('pagehide', () => { if (pushT) pushNow(); });
  window.SL_SUITE = { project, publish, pushNow, snapshotState };
})();
