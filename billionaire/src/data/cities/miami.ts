import type { DistrictId, SubtypeId } from '../../types/core';

/**
 * Static district profiles for the fictionalized Miami map.
 * Numbers are game-balance values, not real market data.
 */
export interface DistrictProfile {
  id: DistrictId;
  name: string;
  tagline: string;
  description: string;
  demographics: string;
  /** Pedestrian/customer traffic multiplier. */
  footTraffic: number;
  /** Spending power multiplier. */
  affluence: number;
  tourism: number;
  nightlife: number;
  techScene: number;
  /** Property value $/sqft (dollars) at price index 1.0 */
  valuePsf: number;
  /** Market rent, $/sqft/year (dollars) */
  rentPsf: number;
  /** Base annual appreciation */
  appreciation: number;
  /** Operating cost multiplier for utilities/upkeep */
  costFactor: number;
  /** Subtype affinity — how well each business fits this district. */
  affinity: Partial<Record<SubtypeId, number>>;
  /** Map palette */
  color: number;
  accent: string;
}

export const DISTRICTS: Record<DistrictId, DistrictProfile> = {
  wynwood: {
    id: 'wynwood',
    name: 'Wynwood',
    tagline: 'Murals, galleries and converted warehouses',
    description:
      'A former warehouse district turned creative hub. Low-rise buildings, studios, breweries and a fast-growing startup scene. Cheaper space with strong appreciation.',
    demographics: 'Young creatives, startup founders, weekend visitors, gallery crowds',
    footTraffic: 1.1,
    affluence: 1.0,
    tourism: 0.9,
    nightlife: 1.15,
    techScene: 1.35,
    valuePsf: 430,
    rentPsf: 38,
    appreciation: 0.058,
    costFactor: 0.9,
    affinity: { saas: 1.3, agency: 1.25, restaurant: 1.1, nightclub: 1.15, boutique: 1.15, foodtruck: 1.3, convenience: 0.9, brokerage: 0.85, hotel: 0.8, online: 1.0 },
    color: 0x9c6b4e,
    accent: '#c98a5f',
  },
  downtown: {
    id: 'downtown',
    name: 'Downtown',
    tagline: 'Government, finance and the bayfront core',
    description:
      'The commercial core: office towers, courts, transit and the bayfront arena. Dense weekday foot traffic, quieter nights. Strong for professional services and convenience retail.',
    demographics: 'Office workers, commuters, government employees, event crowds',
    footTraffic: 1.3,
    affluence: 1.1,
    tourism: 1.0,
    nightlife: 0.85,
    techScene: 1.1,
    valuePsf: 520,
    rentPsf: 44,
    appreciation: 0.042,
    costFactor: 1.05,
    affinity: { brokerage: 1.15, agency: 1.15, saas: 1.05, restaurant: 1.05, convenience: 1.3, boutique: 0.9, hotel: 1.05, nightclub: 0.8, foodtruck: 1.2, online: 1.0 },
    color: 0x5a6878,
    accent: '#8fa3b8',
  },
  brickell: {
    id: 'brickell',
    name: 'Brickell',
    tagline: 'Glass towers and the financial district',
    description:
      'Dense high-rise financial district with luxury condos, banks and upscale dining. Expensive space but the highest-spending local residents on the mainland.',
    demographics: 'Finance professionals, affluent condo residents, international business travelers',
    footTraffic: 1.2,
    affluence: 1.45,
    tourism: 1.05,
    nightlife: 1.05,
    techScene: 1.0,
    valuePsf: 650,
    rentPsf: 52,
    appreciation: 0.047,
    costFactor: 1.15,
    affinity: { brokerage: 1.35, restaurant: 1.2, boutique: 1.25, hotel: 1.1, saas: 1.0, agency: 1.05, convenience: 1.05, nightclub: 1.0, foodtruck: 0.8, online: 1.0 },
    color: 0x3f5a72,
    accent: '#6f9cc2',
  },
  littlehavana: {
    id: 'littlehavana',
    name: 'Little Havana',
    tagline: 'Family businesses, cafecitos and culture',
    description:
      'A tight-knit neighborhood of family restaurants, cafés, cigar shops and low-rise apartments. The most affordable district, loyal local customers, modest ticket sizes.',
    demographics: 'Established families, local regulars, culture tourists, working professionals',
    footTraffic: 1.05,
    affluence: 0.75,
    tourism: 1.05,
    nightlife: 0.95,
    techScene: 0.6,
    valuePsf: 260,
    rentPsf: 26,
    appreciation: 0.051,
    costFactor: 0.8,
    affinity: { restaurant: 1.3, convenience: 1.25, foodtruck: 1.1, boutique: 0.85, brokerage: 0.9, agency: 0.7, saas: 0.6, hotel: 0.7, nightclub: 0.9, online: 1.0 },
    color: 0xb07a4a,
    accent: '#d9a066',
  },
  southbeach: {
    id: 'southbeach',
    name: 'South Beach',
    tagline: 'Art deco, the beach and the nightlife capital',
    description:
      'Pastel art-deco hotels, beach crowds and the busiest nightlife in the state. Huge seasonal tourism swings: peak winter, soft late summer and hurricane season.',
    demographics: 'Tourists, nightlife crowds, seasonal residents, models and creatives',
    footTraffic: 1.45,
    affluence: 1.25,
    tourism: 1.6,
    nightlife: 1.6,
    techScene: 0.6,
    valuePsf: 720,
    rentPsf: 58,
    appreciation: 0.045,
    costFactor: 1.2,
    affinity: { hotel: 1.45, nightclub: 1.5, restaurant: 1.25, boutique: 1.2, convenience: 1.1, foodtruck: 0.9, brokerage: 0.9, agency: 0.6, saas: 0.55, online: 1.0 },
    color: 0xd9a9a0,
    accent: '#e8b4b8',
  },
  waterfront: {
    id: 'waterfront',
    name: 'Miami Beach Waterfront',
    tagline: 'Marinas, luxury residences and private clubs',
    description:
      'Exclusive bayside and oceanfront residences, marinas and resort hotels. The most expensive property in the city with wealthy, low-density demand.',
    demographics: 'High-net-worth residents, yacht owners, luxury travelers, private club members',
    footTraffic: 0.85,
    affluence: 1.7,
    tourism: 1.3,
    nightlife: 0.9,
    techScene: 0.7,
    valuePsf: 900,
    rentPsf: 66,
    appreciation: 0.05,
    costFactor: 1.3,
    affinity: { hotel: 1.35, brokerage: 1.3, restaurant: 1.15, boutique: 1.3, nightclub: 0.85, convenience: 0.8, foodtruck: 0.6, saas: 0.7, agency: 0.8, online: 1.0 },
    color: 0x7fa6a0,
    accent: '#8fc1b5',
  },
};

export const DISTRICT_ORDER: DistrictId[] = ['brickell', 'downtown', 'wynwood', 'southbeach', 'littlehavana', 'waterfront'];

/* ------------------------------------------------------------------ */
/* Map layout                                                          */
/* ------------------------------------------------------------------ */

export const MAP_W = 56;
export const MAP_H = 56;

export type Terrain = 'ocean' | 'bay' | 'river' | 'sand' | 'road' | 'bridge' | 'ground' | 'park' | 'plaza';

const PARK_BLOCKS = new Set(['28,18', '4,36', '16,0', '41,16']);

function mainlandRoad(x: number, y: number): boolean {
  return x % 6 === 0 || (y % 6 === 0 && y !== 0) || y === 0;
}

export function districtAt(x: number, y: number): DistrictId | null {
  if (x >= 41 && x <= 51) return y <= 26 ? 'waterfront' : 'southbeach';
  if (x > 33) return null;
  if (y <= 17) return 'wynwood';
  if (x <= 15) return 'littlehavana';
  if (y <= 32) return 'downtown';
  return 'brickell';
}

export function terrainAt(x: number, y: number): Terrain {
  if (x >= 52) return 'ocean';
  if (x >= 50) return 'sand';
  if (x >= 34 && x <= 40) {
    if (y === 9 || y === 28) return 'bridge';
    return 'bay';
  }
  if (x >= 41) {
    if (x === 43 || x === 47 || y % 5 === 0) return 'road';
    const bk = `41,${Math.floor(y / 5) * 5 + 1}`;
    if (x <= 42 && PARK_BLOCKS.has(bk)) return 'park';
    if (x === 46) return 'plaza';
    return 'ground';
  }
  // mainland
  if (y === 33) return x % 6 === 0 ? 'bridge' : 'river';
  if (mainlandRoad(x, y)) return 'road';
  const bx = Math.floor(x / 6) * 6;
  const by = Math.floor(y / 6) * 6;
  if (PARK_BLOCKS.has(`${bx},${by}`)) return 'park';
  const lx = x - bx;
  const ly = y - by;
  if (lx === 5 || ly === 5) return 'plaza';
  return 'ground';
}

export interface Lot {
  x: number;
  y: number;
  w: number;
  h: number;
  district: DistrictId;
  /** Rough desirability: corner/waterfront lots score higher. */
  score: number;
}

/** Enumerate every buildable 2x2 lot on the map, deterministic order. */
export function enumerateLots(): Lot[] {
  const lots: Lot[] = [];
  const push = (x: number, y: number) => {
    if (x + 1 >= MAP_W || y + 1 >= MAP_H) return;
    for (let dx = 0; dx < 2; dx++)
      for (let dy = 0; dy < 2; dy++) if (terrainAt(x + dx, y + dy) !== 'ground') return;
    const d = districtAt(x, y);
    if (!d) return;
    const waterAdj = x >= 30 || x >= 48 ? 0.3 : 0;
    lots.push({ x, y, w: 2, h: 2, district: d, score: 0.5 + waterAdj });
  };
  // mainland blocks
  for (let bx = 0; bx < 34; bx += 6) {
    for (let by = 0; by < 56; by += 6) {
      for (const [ox, oy] of [
        [1, 1],
        [3, 1],
        [1, 3],
        [3, 3],
      ]) {
        push(bx + ox, by + oy);
      }
    }
  }
  // island blocks
  for (let by = 1; by < 56; by += 5) {
    for (const x of [41, 44, 48]) {
      push(x, by);
      push(x, by + 2);
    }
  }
  return lots;
}
