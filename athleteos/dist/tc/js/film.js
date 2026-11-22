/* ==================== Film Room: your own clips, slow-mo, frame step, tagged moments ====================
   Videos stay in this browser (IndexedDB). Only the clip details, tags and notes sync with the rest of your data. */
var FILM_TAGS = { make: ['Make', 'var(--good)'], miss: ['Miss', 'var(--bad)'], good: ['Good decision', '#8db8de'], bad: ['Bad decision', 'var(--warn)'], to: ['Turnover', '#ef6a5e'], def: ['Defense', '#e9d98d'], form: ['Shot form', '#ff913d'], note: ['Note', '#a5a3aa'] };
var FORM_CHECKS = ['Balanced base, feet set before the catch', 'Elbow under the ball', 'One motion, no hitch', 'Eyes on the target the whole shot', 'Held the follow-through', 'Landed where I took off'];
var FILM = { db: null, url: null, urlFor: null };
function filmState() { if (!S.film || !Array.isArray(S.film.clips)) S.film = { clips: [] }; return S.film; }
function filmDB() {
  if (FILM.db) return Promise.resolve(FILM.db);
  return new Promise(function (res, rej) { if (!window.indexedDB) return rej(new Error('no idb')); var rq = indexedDB.open('btc-film', 1); rq.onupgradeneeded = function () { rq.result.createObjectStore('videos'); }; rq.onsuccess = function () { FILM.db = rq.result; res(FILM.db); }; rq.onerror = function () { rej(rq.error); }; });
}
function idbPut(k, v) { return filmDB().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction('videos', 'readwrite'); tx.objectStore('videos').put(v, k); tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); }; }); }); }
function idbGet(k) { return filmDB().then(function (db) { return new Promise(function (res) { var rq = db.transaction('videos').objectStore('videos').get(k); rq.onsuccess = function () { res(rq.result || null); }; rq.onerror = function () { res(null); }; }); }); }
function idbDel(k) { return filmDB().then(function (db) { return new Promise(function (res) { var tx = db.transaction('videos', 'readwrite'); tx.objectStore('videos').delete(k); tx.oncomplete = function () { res(); }; }); }); }
function fmtT(s) { s = Math.max(0, s || 0); var m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }
function tagCounts(notes) { var c = {}; notes.forEach(function (n) { c[n.tag] = (c[n.tag] || 0) + 1; }); return c; }

function viewFilm() {
  var f = filmState(), all = f.clips.reduce(function (a, c) { return a.concat(c.notes || []); }, []), tc = tagCounts(all);
  return pageHead('Film Room', 'Watch yourself like a coach', '<button class="btn p" data-a="film-add">' + ic('upload', 16) + ' Add clip</button>') +
    (all.length ? '<section class="panel" style="margin-bottom:14px"><div class="phead"><div><h3>Your breakdown</h3><div class="sub">Every moment you tagged across ' + f.clips.length + ' clip' + (f.clips.length === 1 ? '' : 's') + '</div></div></div><div class="grid g4">' + kpi(tc.make || tc.miss ? Math.round(((tc.make || 0) / ((tc.make || 0) + (tc.miss || 0))) * 100) + '<small>%</small>' : '–', 'Shots made on film', '', (tc.make || 0) + ' makes · ' + (tc.miss || 0) + ' misses') + kpi(tc.good || tc.bad ? Math.round(((tc.good || 0) / ((tc.good || 0) + (tc.bad || 0))) * 100) + '<small>%</small>' : '–', 'Good decisions', '', (tc.good || 0) + ' good · ' + (tc.bad || 0) + ' bad') + kpi(tc.to || 0, 'Turnovers tagged') + kpi(all.length, 'Moments tagged') + '</div></section>' : '') +
    (f.clips.length ? '<div class="clips">' + f.clips.slice().reverse().map(function (c) { var cc = tagCounts(c.notes || []); return '<a class="clip" href="#film-' + c.id + '"><div class="thumb"' + (c.thumb ? ' style="background-image:url(' + c.thumb + ')"' : '') + '>' + ic('play', 26) + (c.dur ? '<span>' + fmtT(c.dur).replace(/\.\d$/, '') + '</span>' : '') + '</div><div class="cb"><b>' + esc(c.title) + '</b><div class="tiny">' + esc(c.kind) + ' · ' + esc(fmtDay(c.date)) + '</div><div class="chips" style="margin-top:6px">' + Object.keys(cc).map(function (k) { return '<span class="tag" style="color:' + FILM_TAGS[k][1] + '">' + esc(FILM_TAGS[k][0]) + ' ' + cc[k] + '</span>'; }).join('') + '</div></div></a>'; }).join('') + '</div>'
      : '<section class="panel hero coach-intro"><div class="ci-art">' + ic('clapperboard', 44) + '</div><h2>Bring your film</h2><p class="ink2">Add a game clip or a workout video from your phone. Slow it down, step frame by frame, and tag every make, miss, turnover and decision. Your tags turn into a breakdown so you see patterns, not just highlights.</p><p class="tiny">Videos stay on this device. Tags and notes save with your account.</p><button class="btn p xl" data-a="film-add" style="max-width:300px">' + ic('upload', 18) + ' Add your first clip</button></section>');
}
function viewFilmClip(id) {
  var c = filmState().clips.find(function (x) { return x.id === id; }); if (!c) return pageHead('Film Room', 'Clip not found', '') + '<a class="btn" href="#film">Back to Film Room</a>';
  var notes = (c.notes || []).slice().sort(function (a, b) { return a.t - b.t; }), cc = tagCounts(notes), checks = c.checks || [];
  setTimeout(function () { loadClipVideo(c); }, 0);
  return '<a class="crumb" href="#film">' + ic('chevron-left', 14) + ' Film Room</a>' + pageHead(esc(c.kind), esc(c.title), '<button class="btn sm g d" data-a="film-del" data-id="' + c.id + '">Delete clip</button>') +
    '<div class="grid film-grid"><section class="panel player"><div class="vwrap"><video id="fv" playsinline preload="metadata"></video><div class="vmiss" id="fv-miss" hidden><b>Video not on this device</b><span class="tiny">The tags synced, but the video file lives on the device you added it from.</span><button class="btn sm" data-a="film-reattach" data-id="' + c.id + '">' + ic('upload', 14) + ' Attach the file here</button></div></div>' +
    '<div class="vbar"><button class="btn sm" data-a="fv" data-v="back5" aria-label="Back 5 seconds">' + ic('rewind', 16) + '</button><button class="btn sm" data-a="fv" data-v="frame-" aria-label="Previous frame">' + ic('skip-back', 16) + '</button><button class="btn sm b" data-a="fv" data-v="play" id="fv-play" aria-label="Play or pause">' + ic('play', 18) + '</button><button class="btn sm" data-a="fv" data-v="frame+" aria-label="Next frame">' + ic('skip-forward', 16) + '</button><button class="btn sm" data-a="fv" data-v="fwd5" aria-label="Forward 5 seconds">' + ic('fast-forward', 16) + '</button><span class="num small" id="fv-t">0:00.0</span><div class="seg" id="fv-rate">' + [0.25, 0.5, 1].map(function (r) { return '<button class="' + (r === 1 ? 'on' : '') + '" data-a="fv-rate" data-v="' + r + '">' + r + '×</button>'; }).join('') + '</div><label class="check small" style="min-height:0"><input type="checkbox" id="fv-loop"> Loop last 3s</label></div>' +
    '<input type="range" id="fv-seek" min="0" max="1000" value="0" aria-label="Seek" style="min-height:0;padding:0;margin-top:10px">' +
    '<div class="tagbar">' + Object.keys(FILM_TAGS).map(function (k) { return '<button class="tagbtn" style="--c:' + FILM_TAGS[k][1] + '" data-a="film-tag" data-id="' + c.id + '" data-v="' + k + '">' + esc(FILM_TAGS[k][0]) + '</button>'; }).join('') + '</div><input id="fv-note" placeholder="Optional note for the next tag (e.g. late closeout, left early)" style="margin-top:8px"><p class="tiny">Keys: Space play/pause, , and . step frames, M make, X miss.</p></section>' +
    '<aside class="stack"><section class="panel"><div class="phead"><div><h3>Moments</h3><div class="sub">' + notes.length + ' tagged · tap to jump</div></div></div>' + (notes.length ? '<div class="moments">' + notes.map(function (n) { return '<div class="mo"><button class="mt" data-a="fv-seek" data-v="' + n.t + '">' + fmtT(n.t) + '</button><span class="tag" style="color:' + FILM_TAGS[n.tag][1] + '">' + esc(FILM_TAGS[n.tag][0]) + '</span><span class="grow small">' + esc(n.note || '') + '</span><button class="btn xs g" data-a="film-untag" data-id="' + c.id + '" data-n="' + n.id + '" aria-label="Remove">' + ic('x', 12) + '</button></div>'; }).join('') + '</div>' : '<div class="empty">Play the clip and tap a tag button at the moment it happens.</div>') + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>This clip</h3></div></div><div class="chips">' + Object.keys(cc).map(function (k) { return '<span class="tag" style="color:' + FILM_TAGS[k][1] + '">' + esc(FILM_TAGS[k][0]) + ' ' + cc[k] + '</span>'; }).join('') + '</div>' + (cc.make || cc.miss ? '<p class="small">Shooting on film: <b>' + (cc.make || 0) + '/' + ((cc.make || 0) + (cc.miss || 0)) + '</b></p>' : '') + '</section>' +
    '<section class="panel"><div class="phead"><div><h3>Shot form check</h3><div class="sub">Watch a shot at 0.25× and tick what you see</div></div></div>' + FORM_CHECKS.map(function (q, i) { return '<label class="check"><input type="checkbox" data-c="film-check" data-id="' + c.id + '" data-i="' + i + '"' + (checks[i] ? ' checked' : '') + '>' + esc(q) + '</label>'; }).join('') + '<p class="tiny">' + checks.filter(Boolean).length + ' of ' + FORM_CHECKS.length + ' look right in this clip.</p></section></aside></div>';
}
function loadClipVideo(c) {
  var v = $('#fv'); if (!v) return;
  idbGet(c.id).then(function (blob) {
    if (!$('#fv')) return;
    if (!blob) { $('#fv-miss').hidden = false; return; }
    if (FILM.url && FILM.urlFor !== c.id) { URL.revokeObjectURL(FILM.url); FILM.url = null; }
    if (!FILM.url) { FILM.url = URL.createObjectURL(blob); FILM.urlFor = c.id; }
    v.src = FILM.url; wireVideo(v);
  }).catch(function () { var m = $('#fv-miss'); if (m) m.hidden = false; });
}
function wireVideo(v) {
  var seek = $('#fv-seek'), tEl = $('#fv-t');
  v.ontimeupdate = function () { if (tEl) tEl.textContent = fmtT(v.currentTime) + ' / ' + fmtT(v.duration || 0); if (seek && v.duration) seek.value = Math.round((v.currentTime / v.duration) * 1000); var lp = $('#fv-loop'); if (lp && lp.checked && v.currentTime >= (v._loopEnd || 0) && v._loopEnd) v.currentTime = Math.max(0, v._loopEnd - 3); };
  v.onplay = function () { var b = $('#fv-play'); if (b) b.innerHTML = ic('pause', 18); var lp = $('#fv-loop'); if (lp && lp.checked && !v._loopEnd) v._loopEnd = v.currentTime; };
  v.onpause = function () { var b = $('#fv-play'); if (b) b.innerHTML = ic('play', 18); };
  if (seek) seek.oninput = function () { if (v.duration) v.currentTime = (seek.value / 1000) * v.duration; };
  var lp = $('#fv-loop'); if (lp) lp.onchange = function () { v._loopEnd = lp.checked ? v.currentTime : 0; if (lp.checked) toast('Looping the 3 seconds before ' + fmtT(v.currentTime)); };
}
ACT['fv'] = function (el) { var v = $('#fv'); if (!v || !v.src) return; var k = el.dataset.v; if (k === 'play') { if (v.paused) v.play(); else v.pause(); } if (k === 'back5') v.currentTime = Math.max(0, v.currentTime - 5); if (k === 'fwd5') v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); if (k === 'frame-' || k === 'frame+') { v.pause(); v.currentTime = Math.max(0, v.currentTime + (k === 'frame+' ? 1 : -1) / 30); } };
ACT['fv-rate'] = function (el) { var v = $('#fv'); if (!v) return; v.playbackRate = +el.dataset.v; $$('#fv-rate button').forEach(function (b) { b.classList.toggle('on', b === el); }); };
ACT['fv-seek'] = function (el) { var v = $('#fv'); if (v && v.src) { v.currentTime = Math.max(0, +el.dataset.v - 1); v.pause(); } };
ACT['film-tag'] = function (el) {
  var c = filmState().clips.find(function (x) { return x.id === el.dataset.id; }), v = $('#fv'); if (!c) return;
  var note = $('#fv-note'); (c.notes = c.notes || []).push({ id: uid(), t: v && v.src ? Math.round(v.currentTime * 10) / 10 : 0, tag: el.dataset.v, note: note ? note.value.trim() : '' }); if (note) note.value = '';
  save(); var playing = v && !v.paused, ct = v ? v.currentTime : 0; render(); var v2 = $('#fv'); if (v2) { v2.addEventListener('loadedmetadata', function once() { v2.currentTime = ct; if (playing) v2.play(); v2.removeEventListener('loadedmetadata', once); }); } toast(FILM_TAGS[el.dataset.v][0] + ' tagged at ' + fmtT(ct));
};
ACT['film-untag'] = function (el) { var c = filmState().clips.find(function (x) { return x.id === el.dataset.id; }); if (!c) return; c.notes = c.notes.filter(function (n) { return n.id !== el.dataset.n; }); save(); render(); };
CHG['film-check'] = function (el) { var c = filmState().clips.find(function (x) { return x.id === el.dataset.id; }); if (!c) return; c.checks = c.checks || []; c.checks[+el.dataset.i] = el.checked; save(); };
ACT['film-del'] = function (el) { if (UI.armed !== 'fd-' + el.dataset.id) { UI.armed = 'fd-' + el.dataset.id; toast('Tap Delete clip again to remove it and its tags', 'warn'); return; } UI.armed = null; var f = filmState(); f.clips = f.clips.filter(function (x) { return x.id !== el.dataset.id; }); idbDel(el.dataset.id).catch(function () {}); save(); location.hash = '#film'; };
function filmForm(c) {
  modal(c ? 'Attach video' : 'Add a clip', '<form data-form="film-add" class="stack"' + (c ? ' data-id="' + c.id + '"' : '') + '><div class="fld"><label class="f" for="fa-file">Video file</label><input type="file" id="fa-file" name="file" accept="video/*" required></div>' + (c ? '' : '<div class="fld"><label class="f" for="fa-t">Title</label><input id="fa-t" name="title" placeholder="e.g. vs Central, 2nd half"></div><div class="fld"><label class="f" for="fa-k">Type</label><select id="fa-k" name="kind"><option>Game</option><option>Scrimmage</option><option>Workout</option><option>Shooting form</option></select></div>') + '<p class="tiny">The video is stored in this browser only (it can be large). Tags and notes sync with your account.</p><button class="btn p" type="submit">' + ic('upload', 16) + ' ' + (c ? 'Attach' : 'Add clip') + '</button></form>');
}
ACT['film-add'] = function () { filmForm(null); };
ACT['film-reattach'] = function (el) { filmForm(filmState().clips.find(function (x) { return x.id === el.dataset.id; })); };
FORM['film-add'] = function (f) {
  var file = f.file.files[0]; if (!file) { toast('Choose a video file', 'warn'); return; }
  if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) { toast('That is not a video file', 'warn'); return; }
  var existing = f.dataset.id ? filmState().clips.find(function (x) { return x.id === f.dataset.id; }) : null;
  var c = existing || { id: 'f' + uid(), title: (f.title.value.trim() || file.name.replace(/\.[^.]+$/, '')).slice(0, 80), kind: f.kind.value, date: today(), notes: [], checks: [] };
  toast('Saving video…');
  idbPut(c.id, file).then(function () { return makeThumb(file); }).then(function (th) {
    if (th) { c.thumb = th.img; c.dur = th.dur; }
    if (!existing) filmState().clips.push(c); save(); closeModal(); location.hash = '#film-' + c.id; render(); toast('Clip ready. Tag moments as you watch.');
  }).catch(function () { toast('Could not store that video in this browser (it may be too large or storage is blocked).', 'bad'); });
};
function makeThumb(file) {
  return new Promise(function (res) {
    var v = document.createElement('video'), u = URL.createObjectURL(file), done = false; v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = u;
    var fin = function (out) { if (done) return; done = true; URL.revokeObjectURL(u); res(out); };
    v.onloadeddata = function () { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = function () { try { var cv = document.createElement('canvas'), w = 320, h = Math.round((v.videoHeight / v.videoWidth) * w) || 180; cv.width = w; cv.height = h; cv.getContext('2d').drawImage(v, 0, 0, w, h); fin({ img: cv.toDataURL('image/jpeg', 0.6), dur: v.duration }); } catch (e) { fin({ img: null, dur: v.duration }); } };
    v.onerror = function () { fin(null); }; setTimeout(function () { fin(null); }, 6000);
  });
}
document.addEventListener('keydown', function (e) {
  if (!/^#film-/.test(location.hash || '') || /input|textarea|select/i.test((e.target && e.target.tagName) || '')) return; var v = $('#fv'); if (!v || !v.src) return;
  if (e.key === ' ') { e.preventDefault(); if (v.paused) v.play(); else v.pause(); }
  if (e.key === ',' || e.key === '.') { v.pause(); v.currentTime = Math.max(0, v.currentTime + (e.key === '.' ? 1 : -1) / 30); }
  var map = { m: 'make', x: 'miss' }; var b = map[e.key.toLowerCase()] && $('[data-a="film-tag"][data-v="' + map[e.key.toLowerCase()] + '"]'); if (b) b.click();
});
