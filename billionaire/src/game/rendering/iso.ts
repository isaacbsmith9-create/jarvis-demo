/** Isometric projection helpers (2:1 diamond tiles). */
export const TW = 64;
export const TH = 32;

export function toScreen(gx: number, gy: number): { x: number; y: number } {
  return { x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) };
}

export function toGrid(sx: number, sy: number): { gx: number; gy: number } {
  const gx = (sy / (TH / 2) + sx / (TW / 2)) / 2;
  const gy = (sy / (TH / 2) - sx / (TW / 2)) / 2;
  return { gx, gy };
}

export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}
