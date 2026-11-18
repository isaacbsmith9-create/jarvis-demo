// ===================== shot chart court (SVG in feet; hoop at the top) =====================
// x −25..25 (sideline to sideline), y 0 = baseline, hoop at (0, 5.25). Zones colored by FG% minus the zone's
// expected rate (diverging: cold blue → neutral → hot red), only when a zone has 5+ attempts.
const CELL = 1.25;
let ZONE_CELLS = null;
function zoneCells() {
  if (ZONE_CELLS) return ZONE_CELLS;
  ZONE_CELLS = [];
  for (let x = -25; x < 25; x += CELL) for (let y = 0; y < 34; y += CELL) ZONE_CELLS.push({ x, y, z: zoneOf(x + CELL / 2, y + CELL / 2) });
  return ZONE_CELLS;
}
const ZONE_LABEL_AT = { ra: [0, 7.6], paint: [0, 14.5], midL: [-15, 6], midLW: [-12.5, 18.5], midC: [0, 23.5], midRW: [12.5, 18.5], midR: [15, 6], c3L: [-23.6, 7.5], w3L: [-19, 26], t3: [0, 31.5], w3R: [19, 26], c3R: [23.6, 7.5] };
/** Aggregate shots by zone. */
function zoneStats(shots) {
  const z = {}; for (const k of Object.keys(ZONES)) z[k] = { k: 0, n: 0 };
  for (const s of shots) { const zz = shotZone(s); if (zz && z[zz]) { z[zz].k += s.makes; z[zz].n += s.att; } }
  return z;
}
function zoneFill(st, zk) {
  if (st.n < 5) return 'var(--zone-none)';
  const d = st.k / st.n - ZONES[zk].exp; // + hot, − cold
  const t = clamp(Math.abs(d) / 0.15, 0, 1), step = Math.round(t * 3);
  return d >= 0 ? `var(--hot-${step})` : `var(--cold-${step})`;
}
/** Court SVG. o: {shots, mode: 'zones'|'dots'|'both', pending:[x,y]} */
function courtSVG(o) {
  const shots = o.shots || [], zs = zoneStats(shots);
  let g = `<rect x="-25" y="-1.5" width="50" height="37.5" class="c-floor"/>`;
  if (o.mode !== 'dots') for (const c of zoneCells()) g += `<rect x="${c.x}" y="${c.y}" width="${CELL + 0.02}" height="${CELL + 0.02}" style="fill:${zoneFill(zs[c.z], c.z)}"/>`;
  // lines
  const a = Math.atan2(14.2 - 5.25, 22) ;
  g += `<g class="c-lines"><rect x="-25" y="0" width="50" height="36" fill="none"/><rect x="-8" y="0" width="16" height="19" fill="none"/><path d="M-6 0V19M6 0V19" class="thin"/>
    <path d="M-6 19A6 6 0 0 0 6 19"/><path d="M-6 19A6 6 0 0 1 6 19" class="thin dash"/>
    <path d="M-22 0V14.2A23.75 23.75 0 0 0 22 14.2V0"/><path d="M-4 5.25A4 4 0 0 0 4 5.25"/>
    <line x1="-3" x2="3" y1="4" y2="4" class="board"/><circle cx="0" cy="5.25" r="0.75" class="rim"/></g>`;
  if (o.mode !== 'dots') for (const [k, [lx, ly]] of Object.entries(ZONE_LABEL_AT)) {
    const st = zs[k]; if (!st.n) continue;
    g += `<g class="z-lab" data-tip="<b>${esc(ZONES[k].name)}</b><br>${st.k}/${st.n} · ${fmtPct(st.k / st.n)}<br>Expected ${fmtPct(ZONES[k].exp, 0)}${st.n < 5 ? '<br><i>Under 5 attempts: not colored</i>' : ''}"><rect x="${lx - 3.3}" y="${ly - 1.55}" width="6.6" height="3.1" rx="0.6"/><text x="${lx}" y="${ly - 0.15}" text-anchor="middle">${Math.round((100 * st.k) / st.n)}%</text><text x="${lx}" y="${ly + 1.05}" text-anchor="middle" class="sm">${st.k}/${st.n}</text></g>`;
  }
  if (o.mode !== 'zones') for (const s of shots) {
    if (s.x == null) continue;
    const tip = `${s.makes ? 'Make' : 'Miss'} · ${esc(SHOT_TYPES[s.type]?.name || s.type)} · ${fmt(distFt(s.x, s.y), 0)} ft<br>${fmtDate(s.date)} · ${CTX[s.ctx] || ''} · ${PRESSURE[s.pressure] || ''}${s.notes ? '<br>' + esc(s.notes) : ''}`;
    g += s.makes ? `<circle cx="${s.x}" cy="${s.y}" r="0.55" class="mk" data-tip="${tip}"/>` : `<path d="M${s.x - 0.45} ${s.y - 0.45}L${s.x + 0.45} ${s.y + 0.45}M${s.x + 0.45} ${s.y - 0.45}L${s.x - 0.45} ${s.y + 0.45}" class="ms" data-tip="${tip}"/>`;
  }
  if (o.pending) g += `<circle cx="${o.pending[0]}" cy="${o.pending[1]}" r="1.1" class="pend"/><circle cx="${o.pending[0]}" cy="${o.pending[1]}" r="0.35" class="pend-d"/>`;
  return `<svg class="court" viewBox="-25.5 -2 51 38.5" role="img" aria-label="Shot chart">${g}</svg>`;
}
/** Convert a click on the court SVG into court feet. */
function courtPoint(svg, e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [Math.round(clamp(p.x, -25, 25) * 10) / 10, Math.round(clamp(p.y, 0, 35.5) * 10) / 10];
}
