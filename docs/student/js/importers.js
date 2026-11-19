'use strict';
// ===================== local document processing: text, PDF (pdf.js), images (OCR), CSV =====================
// Nothing here calls an AI service. PDF text comes from pdf.js (bundled). OCR uses Tesseract.js, which is downloaded
// from a public CDN the first time you scan an image and then runs on your device.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function nearYear(m, d, ref) { // pick the year that puts month/day closest after ref - 60 days
  const y = +ref.slice(0, 4);
  for (const yy of [y - 1, y, y + 1]) { const s = `${yy}-${pad(m)}-${pad(d)}`; const n = daysBetween(ref, s); if (n >= -60 && n <= 305) return s; }
  return `${y}-${pad(m)}-${pad(d)}`;
}
const validMD = (m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31;
/** Find the first date in a line. Returns {date, sure, raw} or null. sure=false for relative words (weekday, "tomorrow"). */
function findDate(line, ref = today()) {
  const s = line.toLowerCase();
  let m = s.match(/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/);
  if (m && validMD(+m[2], +m[3])) return { date: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`, sure: true, raw: m[0] };
  m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m && validMD(+m[1], +m[2])) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null; return { date: y ? `${y}-${pad(+m[1])}-${pad(+m[2])}` : nearYear(+m[1], +m[2], ref), sure: true, raw: m[0] }; }
  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d\d))?\b/);
  if (m) { const mo = MONTHS.indexOf(m[1].slice(0, 3)) + 1, d = +m[2]; if (validMD(mo, d)) return { date: m[3] ? `${m[3]}-${pad(mo)}-${pad(d)}` : nearYear(mo, d, ref), sure: true, raw: m[0] }; }
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/);
  if (m) { const mo = MONTHS.indexOf(m[2].slice(0, 3)) + 1, d = +m[1]; if (validMD(mo, d)) return { date: nearYear(mo, d, ref), sure: true, raw: m[0] }; }
  if (/\btoday\b|\btonight\b/.test(s)) return { date: ref, sure: false, raw: 'today' };
  if (/\btomorrow\b/.test(s)) return { date: addDays(ref, 1), sure: false, raw: 'tomorrow' };
  m = s.match(/\b(next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|nesday|sday|urday)?\b/);
  if (m) { const w = WD.indexOf(m[2].slice(0, 3)); let n = (w - dow(ref) + 7) % 7 || 7; if (m[1]) n += n < 7 ? 7 : 0; return { date: addDays(ref, n), sure: false, raw: m[0] }; }
  return null;
}
function findTime(line) {
  const m = line.toLowerCase().match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/) || line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m) return null; let h = +m[1]; const mi = +(m[2] || 0), ap = (m[3] || '').replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (h > 23) return null;
  return `${pad(h)}:${pad(mi)}`;
}
function guessType(s) {
  s = s.toLowerCase();
  if (/\b(midterm|final exam|exam|unit test|test)\b/.test(s)) return 'test';
  if (/\bquiz/.test(s)) return 'quiz'; if (/\bproject|presentation\b/.test(s)) return 'project';
  if (/\blab\b/.test(s)) return 'lab'; if (/\b(essay|paper|draft|write-?up|report)\b/.test(s)) return 'essay';
  if (/\b(read|reading|chapter|ch\.|pages?|pp\.)\b/.test(s)) return 'reading';
  if (/\b(homework|hw|worksheet|problems?|exercises?|assignment|practice set|due)\b/.test(s)) return 'homework';
  return 'other';
}
function findMins(s) { const m = s.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/); if (!m) return null; return Math.round(/^h/.test(m[2]) ? +m[1] * 60 : +m[1]); }
function cleanTitle(line, raw) {
  let t = (raw ? line.replace(new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ') : line).replace(/\b(at|by|before)\s+\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/gi, ' ').replace(/\b(due|on)\s*$/i, '').replace(/^[\s\-•*·▪◦●○\d.)]+/, '').replace(/\b(due|on|by|is|at)\s*[:\-]?\s*$/i, '').replace(/\(\s*\)/g, '')
    .replace(/\s*[-–—:|,]\s*$/g, '').replace(/^\s*(due|by)\b\s*/i, '').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/\b(due|by)\s*$/i, '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/** Turn pasted text (assignment instructions, a schedule, a syllabus calendar) into candidate items. Every one is reviewed before saving. */
function extractItems(text, ref = today()) {
  const lines = text.split(/\r?\n|(?<=[.;])\s+(?=[A-Z])/).map((l) => l.trim()).filter((l) => l.length > 3);
  const out = [];
  for (const line of lines) {
    const d = findDate(line, ref);
    if (!d) continue;
    const title = cleanTitle(line, d.raw);
    if (/^(no (class|school)|holiday|break\b|teacher work ?day)/i.test(title)) continue;
    if (!title || title.length < 3 || /^(week|date|day)\b/i.test(title) && title.length < 10) continue;
    out.push({ title: title.slice(0, 120), due: d.date, sure: d.sure, raw: line, dueTime: findTime(line) || '', type: guessType(line), estMins: findMins(line) });
  }
  // Single block of instructions with one date: use its first line as title.
  if (!out.length) { const d = findDate(text, ref); if (d) out.push({ title: cleanTitle(lines[0] || 'Assignment', d.raw).slice(0, 120), due: d.date, sure: d.sure, raw: text.slice(0, 200), dueTime: findTime(text) || '', type: guessType(text), estMins: findMins(text) }); }
  return out;
}
/** Read a syllabus: course name, teacher, grading weights and dated items. Everything is shown for review. */
function parseSyllabus(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const res = { name: '', teacher: '', categories: [], items: [], notes: [] };
  const cm = text.match(/\b(?:course(?:\s*(?:title|name))?|class)\s*[:\-]\s*([^\n]{3,60})/i); const sylLine = lines.find((l) => /syllabus/i.test(l) && l.length <= 80 && l.replace(/syllabus/i, '').trim().length >= 3);
  res.name = (cm ? cm[1] : sylLine ? sylLine.replace(/[-–:|]?\s*(course\s+)?syllabus\s*[-–:|]?/i, ' ') : lines.find((l) => l.length >= 4 && l.length <= 60 && !/[:%]|\d{1,2}\/\d/.test(l)) || '').replace(/\s{2,}/g, ' ').trim();
  const tm = text.match(/\b(?:instructor|teacher|professor)\s*[:\-]\s*([^\n,|]{3,50})/i) || text.match(/\b((?:Mr|Ms|Mrs|Dr|Mx)\.?\s+[A-Z][A-Za-z'\-]+)/);
  res.teacher = tm ? tm[1].trim() : '';
  const seen = new Set();
  for (const l of lines) {
    const m = l.match(/^[\s\-•*·]*([A-Za-z][A-Za-z &/,'()\-]{2,40}?)\s*[:.\-–—]*\s*\(?\s*(\d{1,2}(?:\.\d+)?)\s*%\s*\)?\s*$/) || l.match(/^[\s\-•*·]*(\d{1,2}(?:\.\d+)?)\s*%\s*[:\-–—]?\s*([A-Za-z][A-Za-z &/,'\-]{2,40})$/);
    if (!m) continue;
    const [name, w] = /^\d/.test(m[1]) ? [m[2], +m[1]] : [m[1], +m[2]];
    const key = name.trim().toLowerCase(); if (seen.has(key) || /total|grade scale|^[a-f][+-]?$/i.test(key)) continue;
    seen.add(key); res.categories.push({ id: uid('k'), name: name.trim().replace(/\s+/g, ' '), weight: w });
  }
  const tot = sum(res.categories.map((c) => c.weight));
  if (res.categories.length && Math.abs(tot - 100) > 0.5) res.notes.push(`The weights found add up to ${round(tot, 1)}%, not 100%. Check them before saving.`);
  res.items = extractItems(text);
  return res;
}

// ---------- files ----------
function readAsText(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); }); }
function readAsDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }
async function pdfText(file, onProgress) {
  if (!window.pdfjsLib) await loadScript('vendor/pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise; const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`Reading page ${i} of ${doc.numPages}`);
    const tc = await (await doc.getPage(i)).getTextContent();
    const rows = new Map(); // group by baseline so lines stay lines
    for (const it of tc.items) { const y = Math.round(it.transform[5]); const k = [...rows.keys()].find((r) => Math.abs(r - y) <= 2) ?? y; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(it); }
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, its]) => its.sort((a, b) => a.transform[4] - b.transform[4]).map((x) => x.str).join(' ').replace(/\s{2,}/g, ' ').trim()).filter(Boolean).join('\n'));
  }
  return pages.join('\n\n');
}
const loaded = {};
function loadScript(src) { return loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); })); }
async function ocrImage(file, onProgress) {
  onProgress?.('Downloading the text scanner (about 15 MB, first time only)…');
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const r = await Tesseract.recognize(file, 'eng', { logger: (m) => { if (m.status) onProgress?.(`${m.status[0].toUpperCase() + m.status.slice(1)}${m.progress ? ' ' + Math.round(m.progress * 100) + '%' : ''}`); } });
  return r.data.text;
}
/** Any supported file -> plain text. */
async function fileToText(file, onProgress) {
  const n = file.name.toLowerCase();
  if (file.type === 'application/pdf' || n.endsWith('.pdf')) return pdfText(file, onProgress);
  if (file.type.startsWith('image/')) return ocrImage(file, onProgress);
  if (/\.(txt|md|csv|tsv|html?|rtf|json)$/.test(n) || file.type.startsWith('text/')) { const t = await readAsText(file); return n.endsWith('.html') || n.endsWith('.htm') ? new DOMParser().parseFromString(t, 'text/html').body.innerText : t; }
  if (n.endsWith('.docx')) throw new Error('Word files cannot be read directly. Save it as PDF or copy the text and paste it.');
  throw new Error('This file type is not supported. Use PDF, an image, or a text file.');
}

// ---------- CSV ----------
function csvParse(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}
const csvCell = (v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const csvStringify = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function pickFile(accept) { return new Promise((res) => { const i = $('#file-pick'); i.value = ''; i.accept = accept || ''; i.onchange = () => res(i.files[0] || null); i.click(); }); }

/** A drop zone + paste box that produces text. opts.onText(text, sourceName) */
function sourceBox(id, accept = '.pdf,.txt,.md,.csv,image/*') {
  return `<div class="dropzone" id="${id}-dz"><div class="ei" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${icon('file-up', 22)}</div>
    <b style="color:var(--fg)">Drop a PDF, photo or text file</b><span class="small">PDF text is read on your device. Photos use on-device OCR (a one-time ~15 MB download).</span>
    <button type="button" class="btn sm" id="${id}-pick">${icon('upload', 15)} Choose file</button><span class="small" id="${id}-st" aria-live="polite"></span></div>
    <label class="f">…or paste the text<textarea id="${id}-tx" rows="7" placeholder="Paste text here"></textarea></label>`;
}
function wireSource(root, id, accept, onFile) {
  const dz = $(`#${id}-dz`, root), st = $(`#${id}-st`, root), tx = $(`#${id}-tx`, root);
  const take = async (file) => {
    if (!file) return; st.textContent = 'Reading ' + file.name + '…';
    try { const t = await fileToText(file, (m) => (st.textContent = m)); tx.value = t.trim(); st.textContent = t.trim() ? `Read ${file.name}: ${t.trim().split(/\s+/).length} words. Check the text below.` : `No text found in ${file.name}. If it is a scan, try a photo of it, or paste the text.`; onFile?.(file, t); }
    catch (e) { st.textContent = e.message || 'Could not read that file.'; }
  };
  $(`#${id}-pick`, root).onclick = async () => take(await pickFile(accept));
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); take(e.dataTransfer.files[0]); });
  return () => tx.value;
}
