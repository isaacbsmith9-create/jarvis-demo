import * as THREE from 'three';

// Mutable, per-frame world state. Kept outside React so the render loop
// can update it at 60fps without re-rendering components.

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** height in meters; used for camera occlusion. 0/undefined = not a camera blocker */
  h?: number;
}

export interface PoliceUnit {
  id: number;
  pos: THREE.Vector3;
  heading: number;
  mode: 'patrol' | 'chase' | 'return';
  // patrol: current target intersection index
  targetNode: number;
  prevNode: number;
  speed: number;
}

export const world = {
  player: {
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    radius: 0.55,
  },
  camYaw: 0,
  colliders: [] as AABB[],
  police: [] as PoliceUnit[],
  /** id of business whose zone the player is in, or null */
  inZone: null as string | null,
  bustedCooldown: 0,
};

export function resolveCircleVsAABBs(pos: THREE.Vector3, r: number, boxes: AABB[]) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (pos.x < b.minX - r || pos.x > b.maxX + r || pos.z < b.minZ - r || pos.z > b.maxZ + r) continue;
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > r * r) continue;
    if (d2 < 1e-8) {
      // center inside box: push out along the shallowest axis
      const pushL = pos.x - b.minX, pushR = b.maxX - pos.x;
      const pushB = pos.z - b.minZ, pushF = b.maxZ - pos.z;
      const m = Math.min(pushL, pushR, pushB, pushF);
      if (m === pushL) pos.x = b.minX - r;
      else if (m === pushR) pos.x = b.maxX + r;
      else if (m === pushB) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
      continue;
    }
    const d = Math.sqrt(d2);
    dx /= d;
    dz /= d;
    pos.x = cx + dx * r;
    pos.z = cz + dz * r;
  }
}

/**
 * Returns the fraction (0..1) along the segment from (ax,ay,az) to (bx,by,bz)
 * at which it first enters a box tall enough to block it. 1 = clear.
 */
export function segmentHit(ax: number, ay: number, az: number, bx: number, by: number, bz: number, boxes: AABB[]) {
  const dx = bx - ax;
  const dz = bz - az;
  let best = 1;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b.h) continue;
    let t0 = 0;
    let t1 = best;
    if (Math.abs(dx) < 1e-9) {
      if (ax < b.minX || ax > b.maxX) continue;
    } else {
      let ta = (b.minX - ax) / dx;
      let tb = (b.maxX - ax) / dx;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) {
      if (az < b.minZ || az > b.maxZ) continue;
    } else {
      let ta = (b.minZ - az) / dz;
      let tb = (b.maxZ - az) / dz;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    const y = ay + (by - ay) * t0;
    if (y > b.h) continue;
    if (t0 < best) best = t0;
  }
  return best;
}
