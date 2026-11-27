/**
 * Procedural texture generation for the isometric city. Everything is drawn
 * with Phaser Graphics once at boot and cached as textures, so rendering is
 * just batched sprites (cheap on integrated GPUs). Palette: Miami blue hour.
 */
import Phaser from 'phaser';
import type { DistrictId, PropertyType } from '../../types/core';
import { hashRandom } from '../../utils/rng';
import { mix, shade, TH, TW } from './iso';

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

export const PALETTE = {
  ground: { wynwood: 0x2b2826, downtown: 0x26282d, brickell: 0x24272d, littlehavana: 0x2c2825, southbeach: 0x2e2a2c, waterfront: 0x262b2b } as Record<DistrictId, number>,
  road: 0x18191e,
  roadLine: 0x6b5f45,
  plaza: 0x33343a,
  park: 0x1f3326,
  sand: 0x7d6e55,
  bay: 0x0f2638,
  ocean: 0x0c2131,
  river: 0x11293b,
  litWarm: 0xffcf86,
  litCool: 0xbfd6f2,
  unlit: 0x1d2433,
};

function poly(g: G, pts: Pt[], color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
}

/** Ground diamond corners for footprint starting at A (top corner) with size w×d tiles. */
function footprint(ax: number, ay: number, w: number, d: number) {
  const A = { x: ax, y: ay };
  const B = { x: ax + (w * TW) / 2, y: ay + (w * TH) / 2 };
  const C = { x: ax + ((w - d) * TW) / 2, y: ay + ((w + d) * TH) / 2 };
  const D = { x: ax - (d * TW) / 2, y: ay + (d * TH) / 2 };
  return { A, B, C, D };
}
const up = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h });

interface BoxColors {
  top: number;
  left: number;
  right: number;
}

function drawBox(g: G, ax: number, ay: number, w: number, d: number, h: number, c: BoxColors) {
  const { A, B, C, D } = footprint(ax, ay, w, d);
  poly(g, [D, C, up(C, h), up(D, h)], c.left);
  poly(g, [C, B, up(B, h), up(C, h)], c.right);
  poly(g, [up(A, h), up(B, h), up(C, h), up(D, h)], c.top);
  // crisp edge highlight on the front vertical corner
  g.lineStyle(1, shade(c.right, 1.25), 0.35);
  g.lineBetween(C.x, C.y, C.x, C.y - h);
  return { A, B, C, D };
}

/** Point on a face: u along the bottom edge (0..1), v up the height (0..1). */
function facePoint(p0: Pt, p1: Pt, h: number, u: number, v: number): Pt {
  return { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u - v * h };
}

function faceQuad(g: G, p0: Pt, p1: Pt, h: number, u0: number, u1: number, v0: number, v1: number, color: number, alpha = 1) {
  poly(g, [facePoint(p0, p1, h, u0, v0), facePoint(p0, p1, h, u1, v0), facePoint(p0, p1, h, u1, v1), facePoint(p0, p1, h, u0, v1)], color, alpha);
}

interface WindowOpts {
  floorPx: number;
  cols: number;
  litRatio: number;
  seed: number;
  winW?: number;
  winH?: number;
  startV?: number;
  endV?: number;
  cool?: number;
  ribbon?: boolean;
}

function drawWindows(g: G, p0: Pt, p1: Pt, h: number, o: WindowOpts) {
  const floors = Math.max(1, Math.floor((h * ((o.endV ?? 0.96) - (o.startV ?? 0.06))) / o.floorPx));
  const winW = o.winW ?? 0.55;
  const winH = o.winH ?? 0.55;
  const v0 = o.startV ?? 0.06;
  for (let f = 0; f < floors; f++) {
    const fv0 = v0 + (f * o.floorPx) / h;
    const fv1 = fv0 + (o.floorPx * winH) / h;
    if (o.ribbon) {
      const r = hashRandom(o.seed, f, 7);
      const color = r < o.litRatio ? (r < o.litRatio * (o.cool ?? 0.3) ? PALETTE.litCool : PALETTE.litWarm) : PALETTE.unlit;
      faceQuad(g, p0, p1, h, 0.06, 0.94, fv0, fv1, color, r < o.litRatio ? 0.55 + hashRandom(o.seed, f) * 0.35 : 0.9);
      continue;
    }
    for (let c = 0; c < o.cols; c++) {
      const cw = 1 / o.cols;
      const u0 = c * cw + (cw * (1 - winW)) / 2;
      const r = hashRandom(o.seed, f * 31 + c, 3);
      const lit = r < o.litRatio;
      const color = lit ? (r < o.litRatio * (o.cool ?? 0.3) ? PALETTE.litCool : PALETTE.litWarm) : PALETTE.unlit;
      faceQuad(g, p0, p1, h, u0, u0 + cw * winW, fv0, fv1, color, lit ? 0.6 + hashRandom(o.seed, f, c) * 0.4 : 0.95);
    }
  }
}

export type BuildingStyle = 'tower' | 'office' | 'warehouse' | 'stucco' | 'deco' | 'luxury' | 'club' | 'restaurant' | 'villa';

export interface BuildingSpec {
  style: BuildingStyle;
  height: number;
  seed: number;
  district: DistrictId;
  storefront?: boolean;
}

const LOT_W = 128;
const LOT_GROUND_H = 64;
const HEADROOM = 30;

/** Texture size and anchor for a 2×2 lot building. */
export function buildingCanvas(height: number) {
  const top = height + HEADROOM;
  return { width: LOT_W, height: top + LOT_GROUND_H, anchorX: LOT_W / 2, anchorY: top };
}

const STUCCO = [0xb9805a, 0xc2a263, 0x55918a, 0xb8705f, 0xa9977d, 0xc79a7a, 0x8a9f6f];
const DECO = [0xe0a9b0, 0x9fcfbb, 0xe8d9a0, 0x95c7d6, 0xcdb7e0, 0xf0c8a8];
const NEON = [0xff5fa2, 0x5ff0ff, 0xb57bff, 0xffd166];

export function drawBuilding(scene: Phaser.Scene, key: string, spec: BuildingSpec): void {
  if (scene.textures.exists(key)) return;
  const { width, height, anchorX, anchorY } = buildingCanvas(spec.height);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = (n: number) => hashRandom(spec.seed, n, 11);
  const h = spec.height;
  // Lot pad (sidewalk around the building)
  const lot = footprint(anchorX, anchorY, 2, 2);
  poly(g, [lot.A, lot.B, lot.C, lot.D], 0x2f3036);
  const inner = footprint(anchorX, anchorY + 0.08 * TH * 2, 1.84, 1.84);
  poly(g, [inner.A, inner.B, inner.C, inner.D], 0x26272c);

  const box = (inset: number, bh: number, c: BoxColors, yOff = 0) => {
    const w = 2 - inset * 2;
    return drawBox(g, anchorX, anchorY + inset * TH - yOff, w, w, bh, c);
  };
  const colorsFor = (base: number, light = 1): BoxColors => ({ top: shade(base, 1.18 * light), left: shade(base, 0.62 * light), right: shade(base, 0.86 * light) });

  switch (spec.style) {
    case 'tower': {
      const base = r(1) < 0.5 ? 0x34465c : r(1) < 0.8 ? 0x2d3a4a : 0x3b4a55;
      const inset = 0.28;
      const f = box(inset, h, colorsFor(base));
      const cols = 5;
      drawWindows(g, f.D, f.C, h, { floorPx: 7, cols, litRatio: 0.42, seed: spec.seed, winW: 0.62, winH: 0.5, cool: 0.45 });
      drawWindows(g, f.C, f.B, h, { floorPx: 7, cols, litRatio: 0.48, seed: spec.seed + 1, winW: 0.62, winH: 0.5, cool: 0.45 });
      // crown setback
      const crownH = 8 + r(2) * 10;
      const ci = inset + 0.22;
      drawBox(g, anchorX, anchorY + ci * TH - h, 2 - ci * 2, 2 - ci * 2, crownH, colorsFor(shade(base, 1.15)));
      if (r(3) < 0.55) {
        const top = { x: anchorX, y: anchorY + 2 * TH * 0.5 - h - crownH + 0 };
        g.lineStyle(1.5, 0x8a8f99, 1);
        g.lineBetween(top.x, top.y, top.x, top.y - 14 - r(4) * 10);
        g.fillStyle(0xff4d4d, 1);
        g.fillCircle(top.x, top.y - 14 - r(4) * 10, 1.6);
      }
      break;
    }
    case 'office': {
      const base = [0x6b665f, 0x5b5d63, 0x75695a, 0x4f5660][Math.floor(r(1) * 4)];
      const f = box(0.22, h, colorsFor(base));
      drawWindows(g, f.D, f.C, h, { floorPx: 8, cols: 1, litRatio: 0.45, seed: spec.seed, ribbon: true, winH: 0.45 });
      drawWindows(g, f.C, f.B, h, { floorPx: 8, cols: 1, litRatio: 0.5, seed: spec.seed + 3, ribbon: true, winH: 0.45 });
      // rooftop mechanical
      drawBox(g, anchorX + 6, anchorY + 0.8 * TH - h, 0.45, 0.4, 5, colorsFor(0x55565c));
      break;
    }
    case 'warehouse': {
      const base = [0x6b3d32, 0x5a4a40, 0x4d4744, 0x704a36][Math.floor(r(1) * 4)];
      const f = box(0.12, h, colorsFor(base));
      // murals
      const muralColors = [0xd2557a, 0x3fb7b0, 0xe8b33e, 0x6a6ce0, 0xe0703f];
      const mc = muralColors[Math.floor(r(2) * muralColors.length)];
      const mc2 = muralColors[Math.floor(r(3) * muralColors.length)];
      faceQuad(g, f.D, f.C, h, 0.08, 0.92, 0.12, 0.88, shade(mc, 0.62));
      faceQuad(g, f.D, f.C, h, 0.15 + r(4) * 0.3, 0.55 + r(5) * 0.35, 0.2, 0.75, shade(mc2, 0.7));
      faceQuad(g, f.C, f.B, h, 0.1, 0.5, 0.15, 0.8, shade(mc2, 0.85));
      faceQuad(g, f.C, f.B, h, 0.6, 0.9, 0.12, 0.52, PALETTE.litWarm, 0.75);
      // sawtooth roof ridges
      const top = footprint(anchorX, anchorY + 0.12 * TH - h, 1.76, 1.76);
      g.lineStyle(1, shade(base, 1.45), 0.6);
      for (let i = 1; i < 5; i++) {
        const a = { x: top.A.x + (top.D.x - top.A.x) * (i / 5), y: top.A.y + (top.D.y - top.A.y) * (i / 5) };
        g.lineBetween(a.x, a.y, a.x + (top.B.x - top.A.x), a.y + (top.B.y - top.A.y));
      }
      break;
    }
    case 'stucco':
    case 'restaurant': {
      const base = STUCCO[Math.floor(r(1) * STUCCO.length)];
      const inset = spec.style === 'restaurant' ? 0.2 : 0.26;
      const f = box(inset, h, colorsFor(base, 0.82));
      drawWindows(g, f.D, f.C, h, { floorPx: 11, cols: 3, litRatio: 0.55, seed: spec.seed, winW: 0.4, winH: 0.5, startV: 0.18, cool: 0.1 });
      drawWindows(g, f.C, f.B, h, { floorPx: 11, cols: 3, litRatio: 0.6, seed: spec.seed + 2, winW: 0.4, winH: 0.5, startV: 0.18, cool: 0.1 });
      // hip roof in terracotta
      const w = 2 - inset * 2;
      const t = footprint(anchorX, anchorY + inset * TH - h, w, w);
      const apex = { x: (t.A.x + t.C.x) / 2, y: (t.A.y + t.C.y) / 2 - 9 - r(3) * 4 };
      const roof = r(2) < 0.7 ? 0x8f4a32 : 0x6e6a62;
      poly(g, [t.D, t.C, apex], shade(roof, 0.72));
      poly(g, [t.C, t.B, apex], shade(roof, 0.95));
      poly(g, [t.A, t.D, apex], shade(roof, 0.6));
      poly(g, [t.A, t.B, apex], shade(roof, 0.8));
      if (spec.style === 'restaurant' || spec.storefront) {
        const awn = [0xb33a3a, 0x2f7a6a, 0xd1a03a, 0x2f4f8a][Math.floor(r(4) * 4)];
        faceQuad(g, f.D, f.C, h, 0.05, 0.95, 0.02, 0.16, PALETTE.litWarm, 0.85);
        faceQuad(g, f.C, f.B, h, 0.05, 0.95, 0.02, 0.16, PALETTE.litWarm, 0.9);
        for (let i = 0; i < 8; i++) {
          faceQuad(g, f.D, f.C, h, i / 8, (i + 0.5) / 8, 0.18, 0.26, i % 2 ? 0xe9e1d0 : awn);
          faceQuad(g, f.C, f.B, h, i / 8, (i + 0.5) / 8, 0.18, 0.26, i % 2 ? 0xf2ead8 : awn);
        }
      }
      break;
    }
    case 'deco': {
      const base = DECO[Math.floor(r(1) * DECO.length)];
      const f = box(0.22, h, colorsFor(base, 0.72));
      const floorPx = 10;
      const floors = Math.floor(h / floorPx);
      for (let i = 1; i < floors; i++) {
        faceQuad(g, f.D, f.C, h, 0, 1, (i * floorPx) / h, (i * floorPx + 1.5) / h, 0xe9e3d6, 0.55);
        faceQuad(g, f.C, f.B, h, 0, 1, (i * floorPx) / h, (i * floorPx + 1.5) / h, 0xf3eee2, 0.6);
      }
      drawWindows(g, f.D, f.C, h, { floorPx, cols: 4, litRatio: 0.55, seed: spec.seed, winW: 0.5, winH: 0.42, startV: 0.12, cool: 0.2 });
      drawWindows(g, f.C, f.B, h, { floorPx, cols: 4, litRatio: 0.6, seed: spec.seed + 4, winW: 0.5, winH: 0.42, startV: 0.12, cool: 0.2 });
      // vertical neon fin
      const neon = NEON[Math.floor(r(2) * NEON.length)];
      faceQuad(g, f.C, f.B, h, 0.46, 0.54, 0.08, 1.12, shade(base, 0.95));
      faceQuad(g, f.C, f.B, h, 0.485, 0.515, 0.12, 1.08, neon, 0.95);
      faceQuad(g, f.C, f.B, h, 0.43, 0.57, 0.1, 1.1, neon, 0.18);
      faceQuad(g, f.D, f.C, h, 0.04, 0.96, 0.0, 0.07, neon, 0.35);
      break;
    }
    case 'luxury': {
      const base = r(1) < 0.6 ? 0xd9d3c6 : 0xc3cbd0;
      const f = box(0.24, h, colorsFor(base, 0.62));
      const floorPx = 7;
      const floors = Math.floor(h / floorPx);
      for (let i = 0; i < floors; i++) {
        const v0 = (i * floorPx + 2) / h;
        const v1 = (i * floorPx + 5.5) / h;
        const lit = hashRandom(spec.seed, i) < 0.5;
        faceQuad(g, f.D, f.C, h, 0.04, 0.96, v0, v1, lit ? PALETTE.litWarm : 0x2a3a4a, lit ? 0.5 : 0.9);
        faceQuad(g, f.C, f.B, h, 0.04, 0.96, v0, v1, hashRandom(spec.seed, i, 2) < 0.55 ? PALETTE.litWarm : 0x30445a, 0.6);
        faceQuad(g, f.C, f.B, h, 0.0, 1, v1, v1 + 1 / h, 0xf4f1ea, 0.45);
      }
      const crown = 6 + r(3) * 6;
      drawBox(g, anchorX, anchorY + 0.42 * TH - h, 1.16, 1.16, crown, colorsFor(base, 0.72));
      break;
    }
    case 'club': {
      const base = 0x24222b;
      const f = box(0.16, h, colorsFor(base));
      const neon = NEON[Math.floor(r(2) * 2)];
      const neon2 = NEON[2 + Math.floor(r(3) * 2)];
      faceQuad(g, f.D, f.C, h, 0, 1, 0.78, 0.86, neon, 0.95);
      faceQuad(g, f.C, f.B, h, 0, 1, 0.78, 0.86, neon, 0.95);
      faceQuad(g, f.D, f.C, h, 0, 1, 0.7, 0.94, neon, 0.15);
      faceQuad(g, f.C, f.B, h, 0, 1, 0.7, 0.94, neon, 0.15);
      faceQuad(g, f.C, f.B, h, 0.35, 0.65, 0.04, 0.4, neon2, 0.8);
      faceQuad(g, f.D, f.C, h, 0.2, 0.3, 0.04, 0.36, PALETTE.litWarm, 0.7);
      break;
    }
    case 'villa': {
      const base = 0xe2dccd;
      const f = box(0.32, h, colorsFor(base, 0.68));
      drawWindows(g, f.D, f.C, h, { floorPx: 11, cols: 3, litRatio: 0.7, seed: spec.seed, winW: 0.6, winH: 0.55, startV: 0.15, cool: 0.1 });
      drawWindows(g, f.C, f.B, h, { floorPx: 11, cols: 3, litRatio: 0.7, seed: spec.seed + 2, winW: 0.6, winH: 0.55, startV: 0.15, cool: 0.1 });
      // pool
      const p = footprint(anchorX + 22, anchorY + 1.2 * TH, 0.5, 0.35);
      poly(g, [p.A, p.B, p.C, p.D], 0x3fc0d0, 0.85);
      break;
    }
  }
  g.generateTexture(key, width, height);
  g.destroy();
}

/** Pick a building spec for a property based on district and type. */
export function propertyBuildingSpec(district: DistrictId, type: PropertyType, sqft: number, seed: number): BuildingSpec {
  const floors = sqft / 1700;
  const height = Math.round(Math.max(18, Math.min(260, floors * 8 + 14)));
  let style: BuildingStyle = 'office';
  switch (type) {
    case 'hotel':
      style = district === 'southbeach' ? 'deco' : district === 'waterfront' ? 'luxury' : 'tower';
      break;
    case 'residential':
      style = district === 'littlehavana' ? 'stucco' : district === 'southbeach' ? 'deco' : district === 'wynwood' ? 'office' : district === 'waterfront' && sqft < 6000 ? 'villa' : 'luxury';
      break;
    case 'office':
      style = district === 'wynwood' ? 'warehouse' : district === 'littlehavana' ? 'stucco' : district === 'waterfront' ? 'luxury' : sqft > 6000 ? 'tower' : 'office';
      break;
    case 'retail':
      style = district === 'southbeach' ? 'deco' : district === 'brickell' || district === 'downtown' ? 'office' : 'stucco';
      break;
    case 'restaurant':
      style = district === 'southbeach' ? 'deco' : 'restaurant';
      break;
    case 'nightclub':
      style = 'club';
      break;
    case 'warehouse':
      style = 'warehouse';
      break;
  }
  const minH = style === 'tower' ? 90 : style === 'deco' ? 34 : style === 'club' ? 28 : 18;
  return { style, height: Math.max(minH, height), seed, district, storefront: type === 'retail' || type === 'restaurant' };
}

/** Filler buildings give each district its skyline character. */
export function fillerBuildingSpec(district: DistrictId, x: number, y: number): BuildingSpec {
  const r = hashRandom(x, y, 99);
  const r2 = hashRandom(x, y, 7);
  const seed = Math.floor(hashRandom(x, y, 5) * 1e6);
  const H = (min: number, max: number) => Math.round(min + r2 * (max - min));
  switch (district) {
    case 'brickell':
      return r < 0.58 ? { style: 'tower', height: H(120, 250), seed, district } : r < 0.85 ? { style: 'luxury', height: H(90, 200), seed, district } : { style: 'office', height: H(50, 100), seed, district };
    case 'downtown':
      return r < 0.45 ? { style: 'office', height: H(50, 130), seed, district } : r < 0.85 ? { style: 'tower', height: H(100, 210), seed, district } : { style: 'stucco', height: H(22, 36), seed, district, storefront: true };
    case 'wynwood':
      return r < 0.66 ? { style: 'warehouse', height: H(22, 40), seed, district } : r < 0.86 ? { style: 'stucco', height: H(20, 34), seed, district, storefront: r2 > 0.5 } : { style: 'office', height: H(36, 64), seed, district };
    case 'littlehavana':
      return r < 0.85 ? { style: 'stucco', height: H(18, 40), seed, district, storefront: r2 > 0.6 } : { style: 'office', height: H(32, 58), seed, district };
    case 'southbeach':
      return r < 0.78 ? { style: 'deco', height: H(34, 80), seed, district } : { style: 'luxury', height: H(70, 150), seed, district };
    case 'waterfront':
      return r < 0.6 ? { style: 'luxury', height: H(80, 210), seed, district } : r < 0.8 ? { style: 'villa', height: H(20, 30), seed, district } : { style: 'deco', height: H(40, 70), seed, district };
  }
}

/* ------------------------------------------------------------------ */
/* Ground and decoration textures                                       */
/* ------------------------------------------------------------------ */

function diamond(cx: number, cy: number): Pt[] {
  return [
    { x: cx, y: cy - TH / 2 },
    { x: cx + TW / 2, y: cy },
    { x: cx, y: cy + TH / 2 },
    { x: cx - TW / 2, y: cy },
  ];
}

function tile(scene: Phaser.Scene, key: string, draw: (g: G) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, TW, TH);
  g.destroy();
}

export function generateGroundTextures(scene: Phaser.Scene) {
  const cx = TW / 2;
  const cy = TH / 2;
  const d = diamond(cx, cy);
  for (const [id, color] of Object.entries(PALETTE.ground)) {
    tile(scene, `t-ground-${id}`, (g) => {
      poly(g, d, color);
      g.lineStyle(1, shade(color, 0.8), 0.6);
      g.strokePoints(d as Phaser.Types.Math.Vector2Like[], true);
    });
  }
  const road = (key: string, dir: 'x' | 'y' | 'both', bridge = false) =>
    tile(scene, key, (g) => {
      poly(g, d, bridge ? 0x23242a : PALETTE.road);
      g.lineStyle(1, bridge ? 0x5d5f68 : 0x2a2b31, 1);
      g.strokePoints(d as Phaser.Types.Math.Vector2Like[], true);
      g.lineStyle(1, PALETTE.roadLine, 0.7);
      if (dir === 'x') {
        // along grid x: from left-top edge midpoint to right-bottom edge midpoint
        g.lineBetween(cx - TW / 4 + 4, cy - TH / 4 + 2, cx - 2, cy - 1);
        g.lineBetween(cx + 6, cy + 3, cx + TW / 4 - 2, cy + TH / 4 - 1);
      } else if (dir === 'y') {
        g.lineBetween(cx + TW / 4 - 4, cy - TH / 4 + 2, cx + 2, cy - 1);
        g.lineBetween(cx - 6, cy + 3, cx - TW / 4 + 2, cy + TH / 4 - 1);
      } else {
        g.lineStyle(1, 0x77736a, 0.35);
        for (let i = -2; i <= 2; i++) g.lineBetween(cx - 10 + i * 5, cy - 2 + i * 2.5, cx - 4 + i * 5, cy + 1 + i * 2.5);
      }
    });
  road('t-road-x', 'x');
  road('t-road-y', 'y');
  road('t-road-both', 'both');
  road('t-bridge-x', 'x', true);
  road('t-bridge-y', 'y', true);
  tile(scene, 't-plaza', (g) => {
    poly(g, d, PALETTE.plaza);
    g.lineStyle(1, 0x2a2b30, 1);
    g.strokePoints(d as Phaser.Types.Math.Vector2Like[], true);
  });
  tile(scene, 't-park', (g) => {
    poly(g, d, PALETTE.park);
    for (let i = 0; i < 10; i++) {
      g.fillStyle(0x2a4433, 0.7);
      g.fillCircle(cx - 16 + hashRandom(i, 1) * 32, cy - 6 + hashRandom(i, 2) * 12, 1.2);
    }
  });
  tile(scene, 't-sand', (g) => {
    poly(g, d, PALETTE.sand);
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0x93836a, 0.6);
      g.fillCircle(cx - 16 + hashRandom(i, 3) * 32, cy - 6 + hashRandom(i, 4) * 12, 0.9);
    }
  });
  for (let v = 0; v < 3; v++) {
    for (const [key, color] of [
      ['bay', PALETTE.bay],
      ['ocean', PALETTE.ocean],
      ['river', PALETTE.river],
    ] as const) {
      tile(scene, `t-${key}-${v}`, (g) => {
        poly(g, d, color);
        g.lineStyle(1, shade(color, 1.6), 0.35);
        const ox = hashRandom(v, key.length) * 20 - 10;
        g.lineBetween(cx - 8 + ox, cy - 2, cx - 1 + ox, cy - 2);
        g.lineBetween(cx + 4 - ox, cy + 4, cx + 10 - ox, cy + 4);
      });
    }
  }
  // Lot overlays
  const lotDiamond = (gw: number) => {
    const w = gw * TW;
    const h = gw * TH;
    return [
      { x: w / 2, y: 1 },
      { x: w - 1, y: h / 2 },
      { x: w / 2, y: h - 1 },
      { x: 1, y: h / 2 },
    ];
  };
  const overlay = (key: string, color: number, fillAlpha: number, lineAlpha: number, width: number) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const pts = lotDiamond(2);
    g.fillStyle(color, fillAlpha);
    g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
    g.lineStyle(width, color, lineAlpha);
    g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], true);
    g.generateTexture(key, TW * 2, TH * 2);
    g.destroy();
  };
  overlay('o-player', 0xd8b260, 0.22, 0.95, 2);
  overlay('o-rival', 0xc0505a, 0.14, 0.7, 1.5);
  overlay('o-sale', 0x4fc3b0, 0.12, 0.75, 1.5);
  overlay('o-lease', 0x7ea6c9, 0.1, 0.6, 1.5);
  overlay('o-select', 0xffffff, 0.1, 1, 2.5);
  overlay('o-hover', 0xffffff, 0.07, 0.5, 1.5);
}

export function generateDecorTextures(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, draw: (g: G) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  make('palm', 26, 40, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(13, 37, 14, 5);
    g.lineStyle(2, 0x5b4a36, 1);
    g.beginPath();
    g.moveTo(13, 37);
    g.lineTo(14, 26);
    g.lineTo(13, 12);
    g.strokePath();
    const fr = [0x2f5d3f, 0x3a6e4b, 0x28503a];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillStyle(fr[i % 3], 1);
      g.fillTriangle(13, 12, 13 + Math.cos(a) * 12, 12 + Math.sin(a) * 6 + 3, 13 + Math.cos(a + 0.4) * 10, 12 + Math.sin(a + 0.4) * 5 + 4);
    }
  });
  make('tree', 22, 26, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(11, 23, 14, 5);
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(10, 15, 2, 8);
    g.fillStyle(0x24432f, 1);
    g.fillCircle(11, 11, 8);
    g.fillStyle(0x2f5539, 1);
    g.fillCircle(9, 9, 5);
  });
  make('lamp', 12, 22, (g) => {
    g.fillStyle(0xffd38a, 0.16);
    g.fillCircle(6, 5, 6);
    g.fillStyle(0xffe2a8, 1);
    g.fillCircle(6, 5, 1.6);
    g.lineStyle(1, 0x55575e, 1);
    g.lineBetween(6, 6, 6, 21);
  });
  const carColors = [0xd9d9d9, 0x2b2b30, 0xa33a3a, 0x3a5a8a, 0xc9a35a, 0x6a6a72];
  carColors.forEach((c, i) => {
    // Car travelling along grid x (screen: down-right)
    make(`car-x-${i}`, 20, 14, (g) => {
      const f = footprint(10, 2, 0.32, 0.17);
      const h = 4;
      poly(g, [f.D, f.C, up(f.C, h), up(f.D, h)], shade(c, 0.6));
      poly(g, [f.C, f.B, up(f.B, h), up(f.C, h)], shade(c, 0.85));
      poly(g, [up(f.A, h), up(f.B, h), up(f.C, h), up(f.D, h)], shade(c, 1.1));
      g.fillStyle(0xfff2c4, 0.9);
      g.fillCircle(f.B.x - 1, f.B.y - 1.5, 1);
    });
    make(`car-y-${i}`, 20, 14, (g) => {
      const f = footprint(10, 2, 0.17, 0.32);
      const h = 4;
      poly(g, [f.D, f.C, up(f.C, h), up(f.D, h)], shade(c, 0.6));
      poly(g, [f.C, f.B, up(f.B, h), up(f.C, h)], shade(c, 0.85));
      poly(g, [up(f.A, h), up(f.B, h), up(f.C, h), up(f.D, h)], shade(c, 1.1));
      g.fillStyle(0xfff2c4, 0.9);
      g.fillCircle(f.D.x + 1, f.D.y - 1.5, 1);
    });
  });
  make('boat', 24, 14, (g) => {
    g.fillStyle(0xffffff, 0.12);
    g.fillEllipse(8, 9, 16, 4);
    g.fillStyle(0xe8e6e0, 1);
    g.fillTriangle(4, 8, 20, 8, 17, 11);
    g.fillRect(4, 6, 13, 2);
    g.fillStyle(0x9fb8c8, 1);
    g.fillRect(9, 4, 5, 2);
  });
  // Ownership beacons
  const beacon = (key: string, color: number) =>
    make(key, 22, 30, (g) => {
      g.fillStyle(color, 0.18);
      g.fillCircle(11, 10, 10);
      g.fillStyle(color, 1);
      g.fillPoints([{ x: 11, y: 2 }, { x: 18, y: 10 }, { x: 11, y: 18 }, { x: 4, y: 10 }] as Phaser.Types.Math.Vector2Like[], true);
      g.fillStyle(mix(color, 0xffffff, 0.5), 1);
      g.fillPoints([{ x: 11, y: 2 }, { x: 18, y: 10 }, { x: 11, y: 10 }] as Phaser.Types.Math.Vector2Like[], true);
      g.lineStyle(1, color, 0.6);
      g.lineBetween(11, 18, 11, 29);
    });
  beacon('b-player', 0xd8b260);
  beacon('b-rival', 0xc65a63);
  beacon('b-sale', 0x4fc3b0);
  beacon('b-lease', 0x7ea6c9);
}
