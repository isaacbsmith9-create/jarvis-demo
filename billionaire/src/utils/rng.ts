/**
 * Deterministic RNG (mulberry32). The generator state lives inside GameState
 * so a saved game resumes the exact same random sequence.
 */
export interface RngHolder {
  rng: number;
}

export function nextRandom(h: RngHolder): number {
  let t = (h.rng = (h.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(h: RngHolder, min: number, max: number): number {
  return min + Math.floor(nextRandom(h) * (max - min + 1));
}

export function randRange(h: RngHolder, min: number, max: number): number {
  return min + nextRandom(h) * (max - min);
}

export function chance(h: RngHolder, p: number): boolean {
  return nextRandom(h) < p;
}

export function pick<T>(h: RngHolder, arr: readonly T[]): T {
  return arr[Math.floor(nextRandom(h) * arr.length)];
}

/** Approximate normal distribution (mean 0, sd 1). */
export function gaussian(h: RngHolder): number {
  let s = 0;
  for (let i = 0; i < 6; i++) s += nextRandom(h);
  return s - 3;
}

/** Stateless hash-based random for rendering decoration (never affects simulation). */
export function hashRandom(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 1440662683) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
