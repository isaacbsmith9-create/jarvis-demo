'use strict';
// ===================== Study Center: hub, guide builder, workspace, timer =====================
// The guide builder is local text processing: it splits headings, scores sentences by word frequency, and matches
// definition patterns ("X is a…", "X: …", "X means…"). It does not understand the material; it reorganizes your own text.
const STOP = new Set('a an the and or but if then than so of to in on at by for with from as is are was were be been being it its this that these those there their they them he she his her we our you your i me my not no yes do does did done can could would should will shall may might must also very more most less least such other into onto over under about after before between during through up down out off again further once here when where why how all any both each few some own same only just too s t don now which who whom what while because until against among per via etc e g ie eg using used use one two three first second new make made has have had having get got many much well way like'.split(' '));
const words = (s) => (s.toLowerCase().match(/[a-z][a-z'’\-]{1,}/g) || []).map((w) => w.replace(/['’]s$/, ''));
const sentences = (t) => t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=["“(A-Z0-9])/).map((s) => s.trim()).filter((s) => s.length > 2);
function isHeading(l, next) {
  if (/^#{1,6}\s+\S/.test(l)) return true;
  if (l.length > 70 || l.length < 3 || /[.!?,;]$/.test(l) || / [-–—:=] /.test(l)) return false;
  if (/:$/.test(l)) return true;
  if (/^(unit|chapter|section|lesson|part|topic|module|week)\b/i.test(l)) return true;
  if (/[A-Z]/.test(l) && l === l.toUpperCase() && l.length > 3) return true;
  const ws = l.split(/\s+/); if (ws.length <= 3 && /^[A-Z]/.test(l) && next && next.length > l.length + 20 && !/^[-•*·]/.test(l)) return true; if (ws.length <= 6 && next && next.length > l.length + 20 && ws.filter((w) => /^[A-Z0-9]/.test(w)).length >= Math.ceil(ws.length * 0.6)) return true;
  return false;
}
const BAD_TERM = /^(it|this|that|there|here|he|she|they|which|these|those|we|you|i|one|what|who|when|where|why|how|each|some|all|most|many|such|another|its|their|his|her)\b/i;
const cleanTerm = (t) => { t = t.replace(/^[\s\-•*·▪\d.)]+/, '').replace(/^(the|an?)\s+/i, '').replace(/[*_`"“”]/g, '').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
/** Term/definition pairs from text. Each pair records which pattern found it so the UI can say so. */
function extractPairs(text) {
  const out = [], seen = new Set();
  const add = (t, d, how) => { t = cleanTerm(t); d = d.trim().replace(/\s+/g, ' ').replace(/^[,:\-–—]\s*/, ''); if (t.length < 2 || t.length > 60 || d.length < 6 || BAD_TERM.test(t) || t.split(/\s+/).length > 6) return; const k = t.toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push({ term: t, def: d.charAt(0).toUpperCase() + d.slice(1), how }); };
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim(); if (!l) continue;
    let m = l.match(/^(?:q(?:uestion)?\s*[:.)]\s*)(.+?\?)\s*(?:a(?:nswer)?\s*[:.)]\s*)(.+)$/i); if (m) { add(m[1], m[2], 'Q/A line'); continue; }
    m = l.match(/^[-•*·▪\d.)\s]*([^:=–—]{2,60}?)\s*(?::|=|—|–|\s-\s)\s*(.{6,400})$/); if (m && !/^https?$/i.test(m[1].trim()) && !/\d{1,2}$/.test(m[1])) { add(m[1], m[2], 'term: definition line'); continue; }
  }
  for (const s of text.split(/\n+/).flatMap(sentences)) {
    let m = s.match(/^((?:the |an? )?[A-Za-z][\w'’\- ]{1,45}?)\s+(?:is|are)\s+((?:a|an|the|one|any|when|how|what|where|defined|called|known|made|used)\b.{6,300})$/i); if (m) { add(m[1], m[2].replace(/\.$/, ''), '"X is a…" sentence'); continue; }
    m = s.match(/^((?:the |an? )?[A-Za-z][\w'’\- ]{1,45}?)\s+(?:means|refers to|is defined as|describes|stands for)\s+(.{6,300})$/i); if (m) add(m[1], m[2].replace(/\.$/, ''), '"X means…" sentence');
  }
  return out;
}
function buildGuide(text, title = 'Study guide') {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const secs = []; let cur = { heading: 'Overview', body: [] };
  lines.forEach((l, i) => { if (!l) return; const next = lines.slice(i + 1).find(Boolean); if (isHeading(l, next)) { if (cur.body.length) secs.push(cur); cur = { heading: l.replace(/^#+\s*/, '').replace(/:$/, ''), body: [] }; } else cur.body.push(l); });
  if (cur.body.length) secs.push(cur);
  const all = words(text).filter((w) => !STOP.has(w) && w.length > 2), tf = {}; all.forEach((w) => (tf[w] = (tf[w] || 0) + 1));
  const bi = {}; const ws = words(text); for (let i = 0; i < ws.length - 1; i++) if (!STOP.has(ws[i]) && !STOP.has(ws[i + 1]) && ws[i].length > 2 && ws[i + 1].length > 2) { const k = ws[i] + ' ' + ws[i + 1]; bi[k] = (bi[k] || 0) + 1; }
  let concepts = [...Object.entries(bi).filter(([, n]) => n >= 2).map(([k, n]) => [k, n * 1.8]), ...Object.entries(tf).filter(([, n]) => n >= 2).map(([k, n]) => [k, n])].sort((a, b) => b[1] - a[1]);
  const picked = []; for (const [k] of concepts) { if (picked.some((p) => p.includes(k) || k.includes(p))) continue; picked.push(k); if (picked.length >= 12) break; }
  const pairs = extractPairs(text), terms = pairs.map((p) => p.term.toLowerCase());
  const scoreS = (s) => { const w = words(s).filter((x) => !STOP.has(x)); if (w.length < 4) return 0; let v = sum(w.map((x) => tf[x] || 0)) / Math.sqrt(w.length); if (picked.some((p) => s.toLowerCase().includes(p))) v *= 1.2; if (terms.some((t) => s.toLowerCase().includes(t))) v *= 1.15; return v; };
  const sections = secs.map((sec) => {
    const ss = sec.body.flatMap(sentences), k = Math.max(1, Math.min(4, Math.ceil(ss.length / 4)));
    const top = ss.map((s, i) => ({ s, i, v: scoreS(s) + (i === 0 ? 0.15 : 0) })).sort((a, b) => b.v - a.v).slice(0, k).sort((a, b) => a.i - b.i).map((x) => x.s);
    const bullets = sec.body.filter((l) => /^[-•*·▪]|^\d+[.)]\s/.test(l)).map((l) => l.replace(/^[-•*·▪\d.)\s]+/, '')).slice(0, 8);
    return { heading: sec.heading, summary: top, bullets, words: words(sec.body.join(' ')).length };
  }).filter((s) => s.summary.length || s.bullets.length);
  const facts = text.split(/\n+/).filter((l) => !isHeading(l.trim())).flatMap(sentences).filter((s) => s.length >= 25 && /\b\d{2,4}\b|\d%|\b(important|key|always|never|must|remember|note that|because|therefore|causes?|results? in)\b/i.test(s) && s.length < 260).slice(0, 10);
  return { id: uid('g'), title, sections, definitions: pairs, concepts: picked, facts, wordCount: words(text).length, createdAt: Date.now() };
}

// ---------- hub ----------
const ss = { tab: 'overview' };
VIEWS.study = (rt) => {
  ss.tab = ['overview', 'guides', 'cards', 'quiz', 'test', 'workspace', 'timer'].includes(rt.arg) ? rt.arg : 'overview';
  const tabs = [['overview', 'Overview', 'layout-grid'], ['guides', 'Study guides', 'book-text'], ['cards', 'Flashcards', 'layers'], ['quiz', 'Quizzes', 'circle-help'], ['test', 'Practice tests', 'clipboard-list'], ['workspace', 'Notes & materials', 'notebook-pen'], ['timer', 'Timer', 'timer']];
  const v = { overview: studyOverview, guides: guidesView, cards: cardsView, quiz: quizView, test: testView, workspace: workspaceView, timer: timerView }[ss.tab](rt.sub);
  return { title: 'Study Center', sub: v.sub || 'Guides, flashcards, quizzes, practice tests and focus time', actions: v.actions || '',
    html: `<div class="tabs" id="s-tabs">${tabs.map(([k, l, ic]) => `<button class="${ss.tab === k ? 'on' : ''}" data-t="${k}">${icon(ic, 15)}${l}</button>`).join('')}</div>${v.html}`,
    mount(root) { $('#s-tabs', root).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) go('study', b.dataset.t); }; v.mount?.(root); } };
};
function studyOverview() {
  const t = today(), wk = Array.from({ length: 7 }, (_, i) => addDays(weekStart(t), i)), mins = wk.map(studyMinsOn), goal = S.settings.dailyStudyMins;
  const due = cardsDue().length, rs = [...S.results].sort((a, b) => b.at - a.at).slice(0, 5);
  const tiles = [['guides', 'book-text', 'Build a study guide', 'Turn notes or a PDF into headings, summaries, definitions and key ideas'], ['cards', 'layers', 'Flashcards', `${S.cards.length} cards · ${due} due today`], ['quiz', 'circle-help', 'Quick quiz', 'Multiple choice, true/false, short answer and matching'], ['test', 'clipboard-list', 'Practice test', 'Timed exam mode with a full review'], ['workspace', 'notebook-pen', 'Notes & materials', `${S.notes.length} notes · ${S.docs.length} files`], ['timer', 'timer', 'Focus timer', `${fmtMins(sum(mins))} studied this week`]];
  return { html: `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${tiles.map(([k, ic, h, s]) => `<a class="card" href="#study/${k}" style="text-decoration:none;color:inherit;display:grid;gap:10px"><span class="ki" style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${icon(ic, 21)}</span><b style="font-family:var(--f-display)">${h}</b><span class="small muted">${s}</span></a>`).join('')}</div>
    <div class="grid g-12"><div class="card s-7"><div class="card-h"><h3>This week</h3><span class="end tiny muted">goal ${fmtMins(goal)} a day</span></div>${barChart(wk.map((d, i) => ({ label: fmtDay(d), short: DAYS[dow(d)], value: mins[i], color: mins[i] >= goal ? 'var(--good)' : 'var(--accent)', dim: d > t })), { goal, fmt: fmtMins, empty: 'No study time logged this week. Start the timer to track it.' })}</div>
    <div class="card s-5"><div class="card-h"><h3>Recent practice</h3></div>${rs.length ? `<div class="list">${rs.map((r) => `<div class="li"><span class="cbar" style="--c:${clsColor(r.classId)}"></span><span class="grow"><span class="t">${esc(r.title)}</span><div class="s">${r.kind === 'test' ? 'Practice test' : 'Quiz'} · ${fmtDate(isoOf(new Date(r.at)))}${r.mins ? ' · ' + fmtMins(r.mins) : ''}</div></span><b class="num" style="color:${gradeColor((r.correct / r.total) * 100)}">${Math.round((r.correct / r.total) * 100)}%</b></div>`).join('')}</div>` : '<p class="small muted">Quiz and test scores show up here.</p>'}</div></div>` };
}

// ---------- guides ----------
function guidesView(id) {
  const g = id && byId('guides', id);
  if (g) return guideDetail(g);
  return { actions: `<button class="btn primary sm" id="gd-new">${icon('plus', 15)} New guide</button>`,
    html: `<div class="grid g-12"><div class="card s-7"><div class="card-h"><h3>Build a study guide</h3></div>
      <div class="fgrid" style="margin-bottom:12px"><label class="f">Title<input type="text" id="gd-title" placeholder="e.g. Unit 4: Cell energy"></label><label class="f">Class<select id="gd-cls">${classOptions('')}</select></label>
      <label class="f full">Start from a note or file<select id="gd-from"><option value="">Paste or upload below</option>${S.notes.map((n) => `<option value="n:${n.id}">Note: ${esc(n.title)}</option>`).join('')}${S.docs.filter((d) => d.text).map((d) => `<option value="d:${d.id}">File: ${esc(d.name)}</option>`).join('')}</select></label></div>
      ${sourceBox('gd')}<div class="row" style="margin-top:12px"><button class="btn primary" id="gd-go">${icon('book-text', 16)} Build guide</button><span class="tiny dim">Rule-based: reorganizes your text. It can’t add facts that aren’t in it.</span></div></div>
      <div class="card s-5"><div class="card-h"><h3>Your guides</h3></div>${S.guides.length ? `<div class="list">${[...S.guides].sort((a, b) => b.createdAt - a.createdAt).map((g) => `<a class="li click" href="#study/guides/${g.id}" style="text-decoration:none;color:inherit"><span class="cbar" style="--c:${clsColor(g.classId)}"></span><span class="grow"><span class="t">${esc(g.title)}</span><div class="s">${esc(clsName(g.classId))} · ${g.sections.length} sections · ${g.definitions.length} terms</div></span>${icon('chevron-right', 15, 'dim')}</a>`).join('')}</div>` : emptyState('book-text', 'No guides yet', 'Paste class notes, a reading or upload a PDF to build your first one.')}</div></div>`,
    mount(root) {
      const get = wireSource(root, 'gd', '.pdf,.txt,.md,image/*', (f) => { if (!$('#gd-title', root).value) $('#gd-title', root).value = f.name.replace(/\.[^.]+$/, ''); });
      $('#gd-new').onclick = () => $('#gd-title', root).focus();
      $('#gd-from', root).onchange = (e) => { const [k, id] = e.target.value.split(':'); const src = k === 'n' ? byId('notes', id) : byId('docs', id); if (!src) return; $('#gd-tx', root).value = k === 'n' ? src.body : src.text; if (!$('#gd-title', root).value) $('#gd-title', root).value = src.title || src.name; if (src.classId) $('#gd-cls', root).value = src.classId; };
      $('#gd-go', root).onclick = () => { const t = get().trim(); if (words(t).length < 30) return toast('Add at least a paragraph or two of text.'); const g = buildGuide(t, $('#gd-title', root).value.trim() || 'Study guide'); g.classId = $('#gd-cls', root).value; g.source = t.slice(0, 100000); upsert('guides', g); go('study', 'guides', g.id); };
    } };
}
function guideDetail(g) {
  return { sub: `${esc(clsName(g.classId))} · built from ${g.wordCount} words`, actions: `<button class="btn ghost sm" id="gd-del">${icon('trash-2', 15)}</button><button class="btn sm" id="gd-print">${icon('download', 15)}<span class="hide-sm">Save as text</span></button><button class="btn primary sm" id="gd-cards" ${g.definitions.length ? '' : 'disabled'}>${icon('layers', 15)} Make flashcards</button>`,
    html: `<div class="grid g-12"><div class="s-8 stack" style="gap:18px;align-content:start">
      <div class="card"><div class="row" style="gap:10px"><span class="ki" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb, ${clsColor(g.classId)} 24%, transparent);color:${clsColor(g.classId)}">${icon('book-text', 20)}</span><div class="grow"><h2>${esc(g.title)}</h2><span class="small muted">${g.sections.length} sections · ${g.definitions.length} definitions · ${g.concepts.length} key concepts</span></div></div>
        <p class="tiny dim" style="margin:10px 0 0">Summaries are the sentences from your text that use its most frequent important words. Check them against the source.</p></div>
      ${g.sections.map((s, i) => `<div class="card"><div class="card-h"><span class="badge accent">${i + 1}</span><h3>${esc(s.heading)}</h3></div><ul style="margin:0;padding-left:20px;display:grid;gap:6px">${s.summary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${s.bullets.length ? `<div class="tiny muted" style="margin:10px 0 4px">Listed points</div><ul style="margin:0;padding-left:20px" class="small">${s.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`).join('')}
    </div><div class="s-4 stack" style="gap:18px;align-content:start">
      <div class="card"><div class="card-h"><h3>Key concepts</h3></div>${g.concepts.length ? `<div class="chips">${g.concepts.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : '<p class="small muted">No repeated terms found.</p>'}</div>
      <div class="card"><div class="card-h"><h3>Definitions</h3><span class="end badge">${g.definitions.length}</span></div>${g.definitions.length ? `<div class="stack" style="gap:10px">${g.definitions.map((d) => `<div><b>${esc(d.term)}</b><div class="small muted">${esc(d.def)}</div></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">None found. Lines like "Osmosis: movement of water…" or sentences like "Osmosis is the movement…" are picked up.</p>'}</div>
      <div class="card"><div class="card-h"><h3>Important facts</h3></div>${g.facts.length ? `<ul style="margin:0;padding-left:18px;display:grid;gap:6px" class="small">${g.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="small muted" style="margin:0">No numbers, dates or cue words ("important", "always", "causes") found.</p>'}</div>
    </div></div>`,
    mount() {
      $('#gd-cards').onclick = () => { const d = { id: uid('k'), name: g.title, classId: g.classId, createdAt: Date.now(), source: 'guide' }; S.decks.push(d); for (const p of g.definitions) S.cards.push({ id: uid('f'), deckId: d.id, front: p.term, back: p.def, createdAt: Date.now() }); save('decks', 'cards'); toast(`Deck created with ${g.definitions.length} cards`); go('study', 'cards', d.id); };
      $('#gd-print').onclick = () => download(`${g.title}.txt`, [g.title.toUpperCase(), '', ...g.sections.flatMap((s) => [s.heading, ...s.summary.map((x) => '- ' + x), ...s.bullets.map((x) => '  * ' + x), '']), 'KEY CONCEPTS', g.concepts.join(', '), '', 'DEFINITIONS', ...g.definitions.map((d) => `${d.term}: ${d.def}`), '', 'IMPORTANT FACTS', ...g.facts.map((f) => '- ' + f)].join('\n'));
      $('#gd-del').onclick = async () => { if (await confirmBox(`Delete the guide "${g.title}"?`)) { remove('guides', g.id); go('study', 'guides'); } };
    } };
}

// ---------- workspace: notes + materials ----------
function workspaceView(id) {
  const n = id && byId('notes', id);
  const notes = [...S.notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { actions: `<button class="btn sm" id="ws-up">${icon('upload', 15)}<span class="hide-sm">Upload file</span></button><button class="btn primary sm" id="ws-new">${icon('plus', 15)} Note</button>`,
    html: `<div class="grid g-12"><div class="card s-4" style="align-self:start"><div class="card-h"><h3>Notes</h3><span class="end badge">${notes.length}</span></div>
      <input type="search" id="ws-q" placeholder="Search notes" style="margin-bottom:8px"><div id="ws-list" class="list"></div>
      <div class="card-h" style="margin:18px 0 8px"><h3>Files</h3><span class="end badge">${S.docs.length}</span></div>${S.docs.length ? `<div class="stack" style="gap:6px">${S.docs.map((d) => `<div class="row"><span class="grow">${attachmentLink({ docId: d.id })}</span><button class="icon-btn" style="width:32px;height:32px" data-deldoc="${d.id}" aria-label="Delete file">${icon('trash-2', 14)}</button></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">Upload handouts and PDFs. Text in PDFs is pulled out so guides and flashcards can use it.</p>'}</div>
      <div class="card s-8" id="ws-ed">${n ? '' : emptyState('notebook-pen', n === undefined && id ? 'Note not found' : 'Pick or create a note', 'Notes are plain text. Write "Term: definition" lines and they can turn straight into flashcards and quizzes.', `<button class="btn primary" onclick="editNote(null,{})">${icon('plus', 15)} New note</button>`)}</div></div>`,
    mount(root) {
      const drawList = (q = '') => { const l = notes.filter((x) => !q || (x.title + ' ' + x.body).toLowerCase().includes(q.toLowerCase())); $('#ws-list', root).innerHTML = l.length ? l.map((x) => `<a class="li click${x.id === n?.id ? ' on' : ''}" href="#study/workspace/${x.id}" style="text-decoration:none;color:inherit;${x.id === n?.id ? 'background:var(--raised)' : ''}"><span class="cbar" style="--c:${clsColor(x.classId)}"></span><span class="grow"><span class="t">${esc(x.title || 'Untitled')}</span><div class="s">${esc(clsName(x.classId))}${x.topic ? ' · ' + esc(x.topic) : ''}</div></span></a>`).join('') : '<p class="small muted">No notes.</p>'; };
      drawList(); $('#ws-q', root).oninput = (e) => drawList(e.target.value);
      $('#ws-new').onclick = () => editNote(null, {}); $('#ws-up').onclick = () => uploadMaterial(n?.classId || '');
      root.addEventListener('click', async (e) => { const b = e.target.closest('[data-deldoc]'); if (b && (await confirmBox('Delete this file?'))) remove('docs', b.dataset.deldoc); });
      if (n) mountNoteEditor($('#ws-ed', root), n);
    } };
}
function editNote(rec, preset = {}) { const n = rec || { id: uid('n'), title: '', body: '', classId: preset.classId || '', topic: '', createdAt: Date.now(), updatedAt: Date.now() }; if (!rec) upsertQuiet('notes', n); go('study', 'workspace', n.id); }
function mountNoteEditor(el, n) {
  const pairs = extractPairs(n.body || '');
  el.innerHTML = `<div class="stack"><div class="row wrap" style="gap:8px"><input type="text" id="ne-title" value="${esc(n.title)}" placeholder="Note title" style="flex:2;min-width:180px;font:600 17px var(--f-display)" aria-label="Title"><select id="ne-cls" style="flex:1;min-width:140px;width:auto" aria-label="Class">${classOptions(n.classId)}</select><input type="text" id="ne-topic" value="${esc(n.topic || '')}" placeholder="Topic" style="flex:1;min-width:120px" aria-label="Topic"></div>
    <textarea id="ne-body" rows="18" placeholder="Write or paste notes.&#10;&#10;Tip: lines like  Photosynthesis: how plants turn light into chemical energy  become flashcards." style="min-height:340px">${esc(n.body)}</textarea>
    <div class="between small"><span class="muted" id="ne-st">${n.updatedAt ? 'Saved' : ''} · <span id="ne-wc">${words(n.body || '').length}</span> words · <span id="ne-pc">${pairs.length}</span> term/definition pairs found</span><button class="btn ghost sm danger" id="ne-del">${icon('trash-2', 14)} Delete</button></div>
    <div class="row wrap"><button class="btn" id="ne-guide">${icon('book-text', 15)} Build guide</button><button class="btn" id="ne-cards">${icon('layers', 15)} Make flashcards</button><button class="btn" id="ne-quiz">${icon('circle-help', 15)} Quiz me</button><button class="btn ghost" id="ne-timer">${icon('timer', 15)} Study this</button></div></div>`;
  let t = null;
  const saveNow = () => { n.title = $('#ne-title', el).value.trim() || 'Untitled note'; n.body = $('#ne-body', el).value; n.classId = $('#ne-cls', el).value; n.topic = $('#ne-topic', el).value.trim(); n.updatedAt = Date.now(); upsertQuiet('notes', n); $('#ne-st', el).firstChild.textContent = 'Saved'; };
  el.addEventListener('input', () => { $('#ne-st', el).firstChild.textContent = 'Saving…'; $('#ne-wc', el).textContent = words($('#ne-body', el).value).length; clearTimeout(t); t = setTimeout(() => { saveNow(); $('#ne-pc', el).textContent = extractPairs(n.body).length; }, 500); });
  el.addEventListener('change', saveNow);
  $('#ne-del', el).onclick = async () => { if (await confirmBox(`Delete "${n.title || 'this note'}"?`)) { remove('notes', n.id); go('study', 'workspace'); } };
  $('#ne-guide', el).onclick = () => { saveNow(); if (words(n.body).length < 30) return toast('Write a bit more first (30+ words).'); const g = buildGuide(n.body, n.title); g.classId = n.classId; g.source = n.body; upsert('guides', g); go('study', 'guides', g.id); };
  $('#ne-cards', el).onclick = () => { saveNow(); const p = extractPairs(n.body); if (!p.length) return toast('No "term: definition" lines found yet.'); reviewPairs(p, n.title, n.classId); };
  $('#ne-quiz', el).onclick = () => { saveNow(); const p = extractPairs(n.body); if (p.length < 2) return toast('Need at least 2 term/definition pairs to quiz you.'); runQuiz(makeQuestions(p.map((x, i) => ({ id: 'tmp' + i, front: x.term, back: x.def })), Math.min(10, p.length), 'mixed'), { title: 'Quiz: ' + n.title, classId: n.classId, kind: 'quiz' }); };
  $('#ne-timer', el).onclick = () => { saveNow(); startTimerFor(n.classId, n.topic || n.title); };
}

// ---------- timer (Pomodoro) ----------
const TM = { phase: 'focus', running: false, left: null, endAt: null, classId: '', topic: '', aid: null, focusDone: 0, startedAt: null, accrued: 0 };
let tmTick = null;
function startTimerFor(classId, topic, aid = null) { if (!TM.running) { TM.classId = classId || ''; TM.topic = topic || ''; TM.aid = aid; } go('study', 'timer'); }
const tmTotal = () => (TM.phase === 'focus' ? S.settings.pomo : S.settings.brk) * 60;
function tmRemaining() { return TM.running ? Math.max(0, Math.round((TM.endAt - Date.now()) / 1000)) : TM.left ?? tmTotal(); }
function tmStart() { if (TM.running) return; TM.endAt = Date.now() + tmRemaining() * 1000; if (TM.phase === 'focus' && !TM.startedAt) TM.startedAt = Date.now(); TM.running = true; tmLoop(); }
function tmPause() { if (!TM.running) return; TM.left = tmRemaining(); TM.running = false; tmLoop(); }
function tmReset() { TM.running = false; TM.left = null; TM.startedAt = null; TM.phase = 'focus'; tmLoop(); }
function tmLoop() {
  clearInterval(tmTick);
  const draw = () => {
    const r = tmRemaining(), face = $('#tm-face');
    if (face) { face.innerHTML = tmFace(r); $('#tm-go') && ($('#tm-go').innerHTML = TM.running ? `${icon('pause', 18)} Pause` : `${icon('play', 18)} ${TM.left != null ? 'Resume' : 'Start'}`); }
    let pill = $('#tm-pill');
    if (TM.running && ss.tab !== 'timer' || TM.running && route.name !== 'study') { if (!pill) { pill = document.createElement('a'); pill.id = 'tm-pill'; pill.href = '#study/timer'; pill.className = 'btn primary sm'; pill.style.cssText = 'position:fixed;z-index:35;right:16px;bottom:calc(92px + env(safe-area-inset-bottom,0px));text-decoration:none'; document.body.appendChild(pill); } pill.innerHTML = `${icon('timer', 15)} ${TM.phase === 'focus' ? 'Focus' : 'Break'} ${Math.floor(r / 60)}:${pad(r % 60)}`; }
    else pill?.remove();
    if (TM.running && r <= 0) tmPhaseEnd();
  };
  draw(); if (TM.running) tmTick = setInterval(draw, 1000);
}
function tmFace(r) {
  const tot = tmTotal(), p = 1 - r / tot, C = 2 * Math.PI * 120;
  return `<svg width="270" height="270" viewBox="0 0 270 270" style="transform:rotate(-90deg)"><circle cx="135" cy="135" r="120" fill="none" stroke="var(--raised-2)" stroke-width="12"/><circle cx="135" cy="135" r="120" fill="none" stroke="${TM.phase === 'focus' ? 'var(--accent)' : 'var(--good)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(p * C).toFixed(1)} ${C.toFixed(1)}"/></svg>
    <div style="position:absolute;text-align:center"><div class="eyebrow" style="color:${TM.phase === 'focus' ? 'var(--accent)' : 'var(--good)'}">${TM.phase === 'focus' ? 'Focus' : 'Break'}</div><div class="tv">${Math.floor(r / 60)}:${pad(r % 60)}</div><div class="small muted">${TM.focusDone} focus block${TM.focusDone === 1 ? '' : 's'} today</div></div>`;
}
function tmPhaseEnd() {
  TM.running = false; TM.left = null; clearInterval(tmTick);
  try { navigator.vibrate?.(200); const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.12, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.8); o.start(); o.stop(a.currentTime + 0.8); } catch { /* sound is optional */ }
  if (TM.phase === 'focus') { TM.focusDone++; logSessionPrompt(S.settings.pomo, TM.startedAt || Date.now() - S.settings.pomo * 6e4, 'pomodoro'); TM.startedAt = null; TM.phase = 'break'; }
  else { TM.phase = 'focus'; toast('Break over. Ready for the next block?'); }
  tmLoop();
}
function logSessionPrompt(mins, start, mode) {
  let rating = 0;
  modal({ title: 'Log this session', icon: 'circle-check', body: `<p style="margin:0">${fmtMins(mins)} of focus${TM.topic ? ` on <b>${esc(TM.topic)}</b>` : ''}. How productive was it?</p>
    <div class="row" id="lg-r" style="gap:6px;justify-content:center">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="btn" data-r="${i}" style="min-width:52px">${i}${icon('star', 14)}</button>`).join('')}</div>
    <div class="fgrid"><label class="f">Class<select id="lg-c">${classOptions(TM.classId)}</select></label><label class="f">Topic<input type="text" id="lg-t" value="${esc(TM.topic)}"></label><label class="f">Minutes<input type="number" id="lg-m" value="${Math.round(mins)}" min="1" max="600"></label></div>`,
    foot: `<button class="btn ghost" data-skip>Don’t log</button><button class="btn primary" data-ok>${icon('check', 15)} Save session</button>`,
    onMount: (r, close) => {
      $('#lg-r', r).onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; rating = +b.dataset.r; $$('#lg-r .btn', r).forEach((x) => x.classList.toggle('primary', +x.dataset.r <= rating)); };
      $('[data-skip]', r).onclick = close;
      $('[data-ok]', r).onclick = () => { const m = Number($('#lg-m', r).value); if (!(m > 0)) return toast('Enter the minutes'); upsert('sessions', { id: uid('s'), classId: $('#lg-c', r).value, topic: $('#lg-t', r).value.trim(), start, mins: m, rating: rating || null, mode, aid: TM.aid }); if (TM.aid) { const a = byId('assignments', TM.aid); if (a) { a.actualMins = (Number(a.actualMins) || 0) + m; if (a.status === 'not_started') a.status = 'in_progress'; save('assignments'); } } close(); toast(`Logged ${fmtMins(m)}`); };
    } });
}
function timerView() {
  const hist = [...S.sessions].sort((a, b) => b.start - a.start), t = today(), wk = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const rated = S.sessions.filter((s) => s.rating), avgR = rated.length ? avg(rated.map((s) => s.rating)) : null;
  return { html: `<div class="grid g-12"><div class="card s-5" style="display:grid;gap:16px;justify-items:center">
      <div class="timer-face" id="tm-face" style="position:relative;width:270px;height:270px">${tmFace(tmRemaining())}</div>
      <div class="seg" id="tm-ph"><button class="${TM.phase === 'focus' ? 'on' : ''}" data-p="focus">Focus ${S.settings.pomo}m</button><button class="${TM.phase === 'break' ? 'on' : ''}" data-p="break">Break ${S.settings.brk}m</button></div>
      <div class="fgrid" style="width:100%"><label class="f">Class<select id="tm-c">${classOptions(TM.classId)}</select></label><label class="f">Topic<input type="text" id="tm-t" value="${esc(TM.topic)}" placeholder="What are you working on?" list="tm-topics"><datalist id="tm-topics">${topicsOf(TM.classId).map((t) => `<option value="${esc(t.name)}">`).join('')}</datalist></label></div>
      <div class="row"><button class="btn ghost" id="tm-reset">${icon('rotate-ccw', 16)} Reset</button><button class="btn primary" id="tm-go" style="min-width:140px">${TM.running ? `${icon('pause', 18)} Pause` : `${icon('play', 18)} ${TM.left != null ? 'Resume' : 'Start'}`}</button><button class="btn ghost" id="tm-skip">${icon('chevron-right', 16)} Skip</button></div>
      <button class="btn ghost sm" id="tm-log">${icon('plus', 14)} Log time manually</button></div>
    <div class="s-7 stack" style="gap:18px;align-content:start"><div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">${kpi('flame', 'Streak', studyStreak() + ' d', 'days in a row')}${kpi('clock', 'Today', fmtMins(studyMinsOn(t)), `goal ${fmtMins(S.settings.dailyStudyMins)}`)}${kpi('star', 'Avg focus', avgR ? round(avgR, 1) + '/5' : '—', `${rated.length} rated`)}</div>
      <div class="card"><div class="card-h"><h3>Last 14 days</h3></div>${barChart(wk.map((d) => ({ label: fmtDay(d), short: fmtDate(d, { day: 'numeric' }), value: studyMinsOn(d), color: studyMinsOn(d) >= S.settings.dailyStudyMins ? 'var(--good)' : 'var(--accent)' })), { goal: S.settings.dailyStudyMins, fmt: fmtMins, h: 170, empty: 'No sessions yet.' })}</div>
      <div class="card"><div class="card-h"><h3>History</h3><span class="end badge">${hist.length}</span></div>${hist.length ? `<div class="list">${hist.slice(0, 12).map((s) => sessionRow(s).replace('</b></div>', `</b><button class="icon-btn" style="width:30px;height:30px" data-dels="${s.id}" aria-label="Delete session">${icon('x', 13)}</button></div>`)).join('')}</div>` : '<p class="small muted">Finished focus blocks are logged here with your rating.</p>'}</div></div></div>`,
    mount(root) {
      tmLoop();
      $('#tm-go', root).onclick = () => { TM.classId = $('#tm-c', root).value; TM.topic = $('#tm-t', root).value.trim(); TM.running ? tmPause() : tmStart(); };
      $('#tm-reset', root).onclick = () => { const was = TM.startedAt && TM.phase === 'focus' ? Math.round((Date.now() - TM.startedAt) / 6e4) : 0; tmReset(); if (was >= 5) logSessionPrompt(was, Date.now() - was * 6e4, 'pomodoro'); };
      $('#tm-skip', root).onclick = () => { TM.running = false; TM.left = null; TM.startedAt = null; TM.phase = TM.phase === 'focus' ? 'break' : 'focus'; render(); };
      $('#tm-ph', root).onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b || TM.running) return; TM.phase = b.dataset.p; TM.left = null; render(); };
      $('#tm-c', root).onchange = (e) => { TM.classId = e.target.value; $('#tm-topics', root).innerHTML = topicsOf(TM.classId).map((t) => `<option value="${esc(t.name)}">`).join(''); }; $('#tm-t', root).oninput = (e) => (TM.topic = e.target.value);
      $('#tm-log', root).onclick = () => logSessionPrompt(30, Date.now() - 30 * 6e4, 'manual');
      root.addEventListener('click', async (e) => { const b = e.target.closest('[data-dels]'); if (b && (await confirmBox('Delete this session?'))) remove('sessions', b.dataset.dels); });
    } };
}
