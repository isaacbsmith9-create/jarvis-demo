// Placeholder art drawn in code. Each generator has a matching optional
// file in /public/assets (see assets.ts) that replaces it when present.

import * as THREE from 'three';
import { mulberry32 } from './city';

export const WINDOW_TILE = { cellW: 3, cellH: 3.5, cells: 4 };

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let windowCache: { map: THREE.Texture; emissive: THREE.Texture } | null = null;
/** Facade tile: 4x4 window cells. Wall is near-white so vertex colors tint it. */
export function windowTextures() {
  if (windowCache) return windowCache;
  const S = 512;
  const n = WINDOW_TILE.cells;
  const cell = S / n;
  const [c1, g1] = canvas(S, S);
  const [c2, g2] = canvas(S, S);
  g1.fillStyle = '#d8d6d2';
  g1.fillRect(0, 0, S, S);
  g2.fillStyle = '#000';
  g2.fillRect(0, 0, S, S);
  const rand = mulberry32(77);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * cell + cell * 0.2;
      const y = j * cell + cell * 0.22;
      const w = cell * 0.6;
      const h = cell * 0.56;
      // slight horizontal band (floor slab)
      g1.fillStyle = '#c4c1bc';
      g1.fillRect(i * cell, j * cell + cell * 0.92, cell, cell * 0.08);
      g1.fillStyle = '#26303d';
      g1.fillRect(x, y, w, h);
      g1.fillStyle = 'rgba(255,255,255,0.08)';
      g1.fillRect(x, y, w * 0.45, h);
      const lit = rand();
      if (lit < 0.32) {
        const warm = rand() < 0.75;
        g2.fillStyle = warm ? `rgb(255,${190 + Math.floor(rand() * 40)},120)` : 'rgb(150,200,255)';
        g2.fillRect(x, y, w, h);
        g1.fillStyle = warm ? '#7a6440' : '#4b6070';
        g1.fillRect(x, y, w, h);
      }
    }
  }
  windowCache = { map: finish(c1), emissive: finish(c2) };
  return windowCache;
}

export function signTexture(text: string, bg: string, fg: string) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 112);
  let size = 56;
  g.font = `900 ${size}px system-ui, sans-serif`;
  while (g.measureText(text.toUpperCase()).width > 460 && size > 20) {
    size -= 2;
    g.font = `900 ${size}px system-ui, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 18;
  g.fillStyle = fg;
  g.fillText(text.toUpperCase(), 256, 68);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function labelTexture(text: string, fg = '#fff', bg = 'rgba(0,0,0,0)') {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.font = '800 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.fillText(text, 256, 66);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

let asphalt: THREE.Texture | null = null;
export function asphaltTexture() {
  if (asphalt) return asphalt;
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#2b2c31';
  g.fillRect(0, 0, 256, 256);
  const rand = mulberry32(3);
  for (let i = 0; i < 2500; i++) {
    const v = 30 + Math.floor(rand() * 30);
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  asphalt = finish(c);
  return asphalt;
}

/** Ring texture for capture zones: soft radial glow. */
let ring: THREE.Texture | null = null;
export function ringTexture() {
  if (ring) return ring;
  const [c, g] = canvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 60, 128, 128, 126);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.75, 'rgba(255,255,255,0.25)');
  grd.addColorStop(0.92, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  ring = finish(c);
  ring.wrapS = ring.wrapT = THREE.ClampToEdgeWrapping;
  return ring;
}
