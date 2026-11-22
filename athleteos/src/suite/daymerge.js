// ===================== Shared day records: merge instead of overwrite =====================
// Several apps write the same "day-YYYY-MM-DD" doc (MacroLens meals and water, Athlete OS and Recovery Lens check-ins,
// Training Center sessions). Each app saves its whole copy, so a page that stayed open could wipe out what another app
// (or another device) added in the meantime. This layer sits under every page's database: before a day doc is saved it
// reads the account copy and does a three-way merge against what this page last loaded:
//   - a field (or list item, matched by id) this page changed: this page's value wins
//   - anything this page did not touch: the account's newer value is kept, including items other apps added
// Loaded first on every page of the bundle; the apps themselves are unchanged.
(function () {
  const isDay = (id) => /^day-\d{4}-\d{2}-\d{2}$/.test(String(id));
  const J = (x) => JSON.stringify(x === undefined ? null : x);
  const same = (a, b) => J(a) === J(b);
  const plain = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const idList = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => plain(x) && x.id != null);
  function mergeList(b, n, r) {
    b = b || []; r = r || [];
    const B = new Map(b.map((x) => [x.id, x])), R = new Map(r.map((x) => [x.id, x])), N = new Set(n.map((x) => x.id)), out = [];
    for (const x of n) {
      const bx = B.get(x.id), rx = R.get(x.id);
      if (bx && !rx && same(x, bx)) continue; // deleted elsewhere, untouched here
      out.push(bx && rx && same(x, bx) ? rx : x);
    }
    for (const x of r) if (!N.has(x.id) && !B.has(x.id)) out.push(x); // added elsewhere
    return out;
  }
  function merge3(b, n, r) {
    if (same(n, b)) return r === undefined ? n : r; // untouched here
    if (same(r, b) || r === undefined) return n; // untouched elsewhere
    if (plain(n) && plain(r)) {
      const o = {}, bb = plain(b) ? b : {};
      for (const k of new Set([...Object.keys(n), ...Object.keys(r)])) {
        if (!(k in n) && k in bb) continue; // removed here
        const v = merge3(bb[k], n[k], r[k]); if (v !== undefined) o[k] = v;
      }
      return o;
    }
    if (Array.isArray(n) && (idList(n) || idList(r)) && (r == null || Array.isArray(r))) return mergeList(Array.isArray(b) ? b : [], n, r);
    return n; // both changed the same value: this save wins
  }
  const clone = (x) => JSON.parse(J(x));

  function wrapCollection(coll) {
    if (!coll || coll.__dm) return coll;
    const base = new Map(); // day id -> what this page last loaded or saved
    const remember = (snap) => { try { for (const d of snap?.docs || []) if (d.exists && isDay(d.id)) base.set(d.id, clone(d.data())); } catch {} return snap; };
    async function fresh(id) {
      const ref = coll.doc(id);
      if (typeof ref.get === 'function') { const d = await ref.get(); return d?.exists ? clone(d.data()) : undefined; }
      const snap = await coll.get(); const d = (snap.docs || []).find((x) => x.id === id && x.exists); return d ? clone(d.data()) : undefined;
    }
    return new Proxy(coll, {
      get(t, p) {
        if (p === '__dm') return true;
        if (p === 'get') return async (...a) => remember(await t.get(...a));
        if (p === 'doc') return (id, ...rest) => {
          const ref = t.doc(id, ...rest); if (!isDay(id)) return ref;
          return new Proxy(ref, { get(rt, rp) {
            if (rp === 'set') return async (data, ...more) => {
              const mine = clone(data);
              let out = mine;
              if (base.has(id)) { try { const r = await fresh(id); if (r !== undefined && !same(r, mine)) out = merge3(base.get(id), mine, r); } catch {} }
              const res = await rt.set(out, ...more);
              base.set(id, mine);
              return res;
            };
            if (rp === 'get') return async (...a) => { const d = await rt.get(...a); try { if (d?.exists) base.set(id, clone(d.data())); } catch {} return d; };
            const v = rt[rp]; return typeof v === 'function' ? v.bind(rt) : v;
          } });
        };
        const v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
      },
    });
  }
  function wrapClaude(c) {
    if (!c || typeof c.use !== 'function' || c.use.__dm) return;
    const use = c.use.bind(c);
    const wrapped = async (name, ...a) => {
      const cap = await use(name, ...a);
      if (name !== 'db' || !cap || typeof cap.collection !== 'function') return cap;
      return new Proxy(cap, { get(t, p) { if (p === 'collection') return (path, ...r) => { const col = t.collection(path, ...r); return /^data\/users\/[^/]+$/.test(path) ? wrapCollection(col) : col; }; const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } });
    };
    wrapped.__dm = true;
    try { c.use = wrapped; } catch {}
  }
  if (window.claude) wrapClaude(window.claude);
  else {
    try {
      let v; Object.defineProperty(window, 'claude', { configurable: true, enumerable: true, get: () => v, set: (x) => { v = x; wrapClaude(x); } });
    } catch {}
  }
  window.DayMerge = { merge3, mergeList };
})();
