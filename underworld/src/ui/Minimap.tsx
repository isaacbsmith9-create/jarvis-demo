import { useEffect, useRef } from 'react';
import { CITY, HALF_X, HALF_Z } from '../game/config';
import { blockCenterX, blockCenterZ, LANDMARKS, LAYOUT } from '../game/city';
import { useGame } from '../game/store';
import { world } from '../game/world';

const PPM = 2; // pixels per meter on the base map
const VIEW_RADIUS_M = 75; // meters shown from center to edge

/** Draw the static district once (north-up, world space). */
function drawBase(): HTMLCanvasElement {
  const pad = 20;
  const c = document.createElement('canvas');
  c.width = (HALF_X * 2 + pad * 2) * PPM;
  c.height = (HALF_Z * 2 + pad * 2) * PPM;
  const g = c.getContext('2d')!;
  const X = (x: number) => (x + HALF_X + pad) * PPM;
  const Z = (z: number) => (z + HALF_Z + pad) * PPM;
  // water + roads
  g.fillStyle = '#0d2233';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1f1f26';
  g.fillRect(X(-HALF_X), Z(-HALF_Z), HALF_X * 2 * PPM, HALF_Z * 2 * PPM);
  // blocks (sidewalk)
  g.fillStyle = '#44444c';
  for (let bz = 0; bz < CITY.blocksZ; bz++) {
    for (let bx = 0; bx < CITY.blocksX; bx++) {
      const cx = blockCenterX(bx);
      const cz = blockCenterZ(bz);
      g.fillRect(X(cx - CITY.block / 2), Z(cz - CITY.block / 2), CITY.block * PPM, CITY.block * PPM);
    }
  }
  // buildings
  g.fillStyle = '#6b6b78';
  for (const b of LAYOUT.buildings) {
    g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * PPM, b.d * PPM);
  }
  // landmarks
  for (const l of LANDMARKS) {
    const cx = blockCenterX(l.block[0]);
    const cz = blockCenterZ(l.block[1]);
    const inner = CITY.block - CITY.sidewalk * 2;
    const color = { plaza: '#2f5a33', tower: '#8a7440', precinct: '#2a4a8c', church: '#7a6a58', docks: '#5a5148' }[l.kind];
    g.fillStyle = color;
    g.fillRect(X(cx - inner / 2), Z(cz - inner / 2), inner * PPM, inner * PPM);
  }
  return c;
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const base = drawBase();
    const pad = 20;
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; // ~30 fps is plenty
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = canvas.clientWidth;
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = canvas.height = Math.round(size * dpr);
      }
      const S = canvas.width;
      const scale = S / 2 / VIEW_RADIUS_M; // canvas px per meter
      const p = world.player.pos;
      const yaw = world.camYaw;
      const { owned } = useGame.getState();

      ctx.save();
      ctx.clearRect(0, 0, S, S);
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#0d2233';
      ctx.fillRect(0, 0, S, S);

      // map rotates so "up" is where the camera faces
      ctx.translate(S / 2, S / 2);
      ctx.rotate(yaw);
      ctx.scale(scale, scale);
      ctx.translate(-p.x, -p.z);
      ctx.drawImage(base, -HALF_X - pad, -HALF_Z - pad, base.width / PPM, base.height / PPM);

      // businesses
      const t = now / 1000;
      for (const s of LAYOUT.sites) {
        const own = !!owned[s.def.id];
        ctx.fillStyle = own ? '#5fd38a' : '#e8b84a';
        ctx.beginPath();
        ctx.arc(s.zx, s.zz, own ? 2.6 : 2.6 + Math.sin(t * 4) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // police
      const flash = Math.sin(t * 12) > 0;
      for (const u of world.police) {
        ctx.fillStyle = u.mode === 'chase' ? (flash ? '#ff3b3b' : '#3b6bff') : '#9fb4ff';
        ctx.beginPath();
        ctx.arc(u.pos.x, u.pos.z, u.mode === 'chase' ? 2.8 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // edge pips for off-map businesses that aren't owned yet
      for (const s of LAYOUT.sites) {
        if (owned[s.def.id]) continue;
        const dx = s.zx - p.x;
        const dz = s.zz - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < VIEW_RADIUS_M * 0.95) continue;
        // rotate into map space
        const c = Math.cos(yaw);
        const sn = Math.sin(yaw);
        const mx = dx * c - dz * sn;
        const mz = dx * sn + dz * c;
        const l = Math.hypot(mx, mz);
        const r = S / 2 - 6 * (S / 180);
        ctx.fillStyle = '#e8b84a';
        ctx.beginPath();
        ctx.arc(S / 2 + (mx / l) * r, S / 2 + (mz / l) * r, 3 * (S / 180), 0, Math.PI * 2);
        ctx.fill();
      }

      // player arrow (always points along facing, relative to camera)
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate(-(world.player.heading - yaw) + Math.PI);
      const a = 7 * (S / 180);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -a);
      ctx.lineTo(a * 0.7, a * 0.8);
      ctx.lineTo(0, a * 0.4);
      ctx.lineTo(-a * 0.7, a * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // ring
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="minimap">
      <canvas ref={ref} />
      <div className="minimap-label">{CITY.district.toUpperCase()}</div>
    </div>
  );
}
