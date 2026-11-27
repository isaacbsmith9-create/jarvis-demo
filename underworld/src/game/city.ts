// Deterministic layout for The Narrows district. Pure data: rendering,
// collision, minimap and police navigation all read from this.

import { BUSINESSES, BusinessDef, CITY, ECONOMY, HALF_X, HALF_Z, PITCH, Side } from './config';
import type { AABB } from './world';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const blockCenterX = (bx: number) => -HALF_X + CITY.road + CITY.block / 2 + bx * PITCH;
export const blockCenterZ = (bz: number) => -HALF_Z + CITY.road + CITY.block / 2 + bz * PITCH;
export const roadX = (i: number) => -HALF_X + CITY.road / 2 + i * PITCH;
export const roadZ = (i: number) => -HALF_Z + CITY.road / 2 + i * PITCH;

export type LandmarkKind = 'plaza' | 'tower' | 'precinct' | 'docks' | 'church';
export interface Landmark {
  kind: LandmarkKind;
  name: string;
  block: [number, number];
}

export const LANDMARKS: Landmark[] = [
  { kind: 'plaza', name: 'Plaza de la Fortuna', block: [2, 2] },
  { kind: 'tower', name: 'Aurelio Tower', block: [3, 1] },
  { kind: 'precinct', name: 'SAPD 9th Precinct', block: [5, 4] },
  { kind: 'church', name: 'Santa Lucia', block: [0, 0] },
  { kind: 'docks', name: 'Port Aurelio', block: [3, 5] },
  { kind: 'docks', name: 'Port Aurelio', block: [4, 5] },
  { kind: 'docks', name: 'Port Aurelio', block: [5, 5] },
];

export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

export interface BusinessSite {
  def: BusinessDef;
  building: Building;
  /** capture zone center */
  zx: number;
  zz: number;
  /** outward facing direction (unit) */
  nx: number;
  nz: number;
}

const SIDE_DIR: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

const PALETTE = ['#6d6a75', '#7d7064', '#5c6672', '#8a7a68', '#4f5560', '#77716b', '#685a52', '#596470', '#857c72'];

function landmarkAt(bx: number, bz: number) {
  return LANDMARKS.find((l) => l.block[0] === bx && l.block[1] === bz);
}

function buildLayout() {
  const rand = mulberry32(CITY.seed);
  const buildings: Building[] = [];
  const sites: BusinessSite[] = [];
  const parking: { x: number; z: number; w: number; d: number }[] = [];
  const inner = CITY.block - CITY.sidewalk * 2; // buildable area
  const lot = inner / 3;

  for (let bz = 0; bz < CITY.blocksZ; bz++) {
    for (let bx = 0; bx < CITY.blocksX; bx++) {
      if (landmarkAt(bx, bz)) continue;
      const cx = blockCenterX(bx);
      const cz = blockCenterZ(bz);
      const biz = BUSINESSES.find((b) => b.block[0] === bx && b.block[1] === bz);
      // lot coords: i (x) and j (z) in 0..2
      let bizLot: [number, number] | null = null;
      if (biz) {
        bizLot = { n: [1, 0], s: [1, 2], e: [2, 1], w: [0, 1] }[biz.side] as [number, number];
      }
      // downtown (near tower/plaza) is taller
      const distC = Math.hypot(bx - 3, bz - 1.5);
      const tall = Math.max(0.4, 1.4 - distC * 0.22);
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const x = cx - inner / 2 + lot * (i + 0.5);
          const z = cz - inner / 2 + lot * (j + 0.5);
          if (bizLot && bizLot[0] === i && bizLot[1] === j && biz) {
            const [nx, nz] = SIDE_DIR[biz.side];
            const b: Building = { x, z, w: lot - 0.4, d: lot - 0.4, h: 7 + (biz.baseIncome / 220) * 6, color: biz.color };
            buildings.push(b);
            const off = CITY.block / 2 - 0.6; // zone sits on the sidewalk edge
            sites.push({ def: biz, building: b, zx: cx + nx * off, zz: cz + nz * off, nx, nz });
            continue;
          }
          if (i === 1 && j === 1 && rand() < 0.35) {
            parking.push({ x, z, w: lot, d: lot });
            continue;
          }
          const h = (6 + rand() * 26) * tall + 4;
          const shrink = 0.2 + rand() * 0.5;
          buildings.push({ x, z, w: lot - shrink, d: lot - shrink, h, color: PALETTE[Math.floor(rand() * PALETTE.length)] });
        }
      }
    }
  }
  // keep business order identical to config
  sites.sort((a, b) => BUSINESSES.indexOf(a.def) - BUSINESSES.indexOf(b.def));
  return { buildings, sites, parking };
}

export const LAYOUT = buildLayout();

/** Collision boxes for landmarks (in addition to buildings). */
function landmarkColliders(): AABB[] {
  const out: AABB[] = [];
  const box = (x: number, z: number, w: number, d: number, h = 0) =>
    out.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
  for (const l of LANDMARKS) {
    const cx = blockCenterX(l.block[0]);
    const cz = blockCenterZ(l.block[1]);
    switch (l.kind) {
      case 'tower': box(cx, cz, 16, 16, 80); break;
      case 'precinct': box(cx, cz - 3, 18, 10, 9); break;
      case 'church': box(cx, cz + 1, 10, 16, 14); box(cx, cz - 8, 5, 5, 20); break;
      case 'plaza': box(cx, cz, 3.2, 3.2); break; // fountain
      case 'docks':
        for (const c of dockContainers(l.block[0])) box(c.x, c.z, c.w, c.d, c.h);
        break;
    }
  }
  return out;
}

export function dockContainers(bx: number) {
  const cx = blockCenterX(bx);
  const cz = blockCenterZ(CITY.blocksZ - 1);
  const rand = mulberry32(bx * 97 + 5);
  const list: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [];
  const colors = ['#a8382c', '#2f6aa1', '#c48a24', '#3b7d4a', '#7b3f8c'];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const stacks = 1 + Math.floor(rand() * 3);
      list.push({ x: cx - 5 + c * 10, z: cz - 6 + r * 9, w: 7, d: 3, h: stacks * 2.6, color: colors[Math.floor(rand() * colors.length)] });
    }
  }
  return list;
}

function boundaryColliders(): AABB[] {
  const t = 4;
  return [
    { minX: -HALF_X - t, maxX: HALF_X + t, minZ: -HALF_Z - t, maxZ: -HALF_Z }, // north
    { minX: -HALF_X - t, maxX: HALF_X + t, minZ: HALF_Z, maxZ: HALF_Z + t }, // south (waterfront)
    { minX: -HALF_X - t, maxX: -HALF_X, minZ: -HALF_Z, maxZ: HALF_Z },
    { minX: HALF_X, maxX: HALF_X + t, minZ: -HALF_Z, maxZ: HALF_Z },
  ];
}

export function buildColliders(): AABB[] {
  return [
    ...LAYOUT.buildings.map((b) => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: b.h })),
    ...landmarkColliders(),
    ...boundaryColliders(),
  ];
}

// ---- road graph (intersections) for police navigation ----
export const NODES_X = CITY.blocksX + 1;
export const NODES_Z = CITY.blocksZ + 1;
export const nodeIndex = (i: number, j: number) => j * NODES_X + i;
export const nodePos = (n: number) => ({ x: roadX(n % NODES_X), z: roadZ(Math.floor(n / NODES_X)) });
export function nodeNeighbors(n: number): number[] {
  const i = n % NODES_X;
  const j = Math.floor(n / NODES_X);
  const out: number[] = [];
  if (i > 0) out.push(nodeIndex(i - 1, j));
  if (i < NODES_X - 1) out.push(nodeIndex(i + 1, j));
  if (j > 0) out.push(nodeIndex(i, j - 1));
  if (j < NODES_Z - 1) out.push(nodeIndex(i, j + 1));
  return out;
}
export function nearestNode(x: number, z: number) {
  const i = Math.max(0, Math.min(NODES_X - 1, Math.round((x - roadX(0)) / PITCH)));
  const j = Math.max(0, Math.min(NODES_Z - 1, Math.round((z - roadZ(0)) / PITCH)));
  return nodeIndex(i, j);
}

export const SPAWN = { x: roadX(2), z: roadZ(3) };
export const PRECINCT_NODE = nodeIndex(5, 4);
export const ZONE_RADIUS = ECONOMY.zoneRadius;
