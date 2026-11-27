import * as THREE from 'three';

// Mutable, per-frame world state. Kept outside React so the render loop
// can update it at 60fps without re-rendering components.

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
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
