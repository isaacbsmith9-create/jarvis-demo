// Central tuning values for the slice. Tweak here, not in components.

export const PLAYER = {
  walkSpeed: 5,
  sprintSpeed: 10,
  accel: 12,
  decel: 10,
  camDistance: 9,
  camHeight: 6.5,
};

export const CITY = {
  name: 'San Aurelio',
  district: 'The Narrows',
  blocksX: 6,
  blocksZ: 6,
  block: 26, // block size (m), includes sidewalk ring
  road: 10, // road width (m)
  sidewalk: 2,
  seed: 1931,
};
export const PITCH = CITY.block + CITY.road;
export const HALF_X = (CITY.blocksX * CITY.block + (CITY.blocksX + 1) * CITY.road) / 2;
export const HALF_Z = (CITY.blocksZ * CITY.block + (CITY.blocksZ + 1) * CITY.road) / 2;

export type Side = 'n' | 's' | 'e' | 'w';

export interface BusinessDef {
  id: string;
  name: string;
  kind: string;
  block: [number, number]; // block column (x), row (z)
  side: Side; // which side of the block the storefront faces (n = -z)
  color: string; // facade color
  signBg: string;
  signFg: string;
  baseIncome: number; // $ per payout tick at level 1
  captureTime: number; // seconds standing in zone
  heatGain: number; // heat added on successful takeover
  /** Optional swap-in art in /public/assets (falls back to code-drawn sign). */
  signImage?: string;
}

export const BUSINESSES: BusinessDef[] = [
  { id: 'laundromat', name: 'Lucky Star Laundromat', kind: 'Laundromat', block: [1, 1], side: 's', color: '#4f7a8c', signBg: '#1d3b4a', signFg: '#9ff0ff', baseIncome: 40, captureTime: 3, heatGain: 12, signImage: '/assets/ui/sign_laundromat.png' },
  { id: 'taqueria', name: 'Marisol Taqueria', kind: 'Restaurant', block: [2, 1], side: 'w', color: '#c46a2f', signBg: '#5a1e0e', signFg: '#ffd36b', baseIncome: 55, captureTime: 3.5, heatGain: 14, signImage: '/assets/ui/sign_taqueria.png' },
  { id: 'pawn', name: "Vito's Pawn & Loan", kind: 'Pawn Shop', block: [4, 2], side: 'n', color: '#7c6a3a', signBg: '#2b230e', signFg: '#f2d27a', baseIncome: 70, captureTime: 4, heatGain: 18, signImage: '/assets/ui/sign_pawn.png' },
  { id: 'arcade', name: 'Golden Reel Arcade', kind: 'Arcade', block: [1, 3], side: 'e', color: '#5b3f8c', signBg: '#1c0f33', signFg: '#ff7af0', baseIncome: 85, captureTime: 4, heatGain: 20, signImage: '/assets/ui/sign_arcade.png' },
  { id: 'liquor', name: 'Dos Rios Liquor', kind: 'Liquor Store', block: [3, 3], side: 's', color: '#3c6b45', signBg: '#0f2a16', signFg: '#8dff9e', baseIncome: 100, captureTime: 4.5, heatGain: 22, signImage: '/assets/ui/sign_liquor.png' },
  { id: 'chopshop', name: 'Harbor Chop Shop', kind: 'Garage', block: [2, 4], side: 'n', color: '#6b6f76', signBg: '#222428', signFg: '#ff9a3d', baseIncome: 130, captureTime: 5, heatGain: 26, signImage: '/assets/ui/sign_chopshop.png' },
  { id: 'club', name: 'Neon Palms Club', kind: 'Nightclub', block: [4, 4], side: 'w', color: '#8c2f5b', signBg: '#2a0718', signFg: '#ff4fa8', baseIncome: 170, captureTime: 5.5, heatGain: 30, signImage: '/assets/ui/sign_club.png' },
  { id: 'hotel', name: 'Hotel Bellaventura', kind: 'Hotel', block: [5, 1], side: 'w', color: '#a8865a', signBg: '#2e1f0c', signFg: '#ffe2a6', baseIncome: 220, captureTime: 6, heatGain: 34, signImage: '/assets/ui/sign_hotel.png' },
];

export const ECONOMY = {
  startCash: 250,
  payoutInterval: 5, // seconds between income ticks
  maxLevel: 4,
  levelMultiplier: [0, 1, 1.6, 2.4, 3.5], // index by level
  upgradeCost: (baseIncome: number, level: number) => Math.round(baseIncome * 18 * level),
  zoneRadius: 2.6,
};

export const HEAT = {
  max: 100,
  decayPerSec: 1.2, // when no police are chasing
  decayWhileChased: 0.25,
  chaseThreshold: 40, // heat at which patrols start chasing on sight
  sightRange: 26,
  loseRange: 55, // chase dropped when this far away
  bustRange: 1.6,
  bustPenaltyPct: 0.25,
  bustMinPenalty: 100,
  bustHeatAfter: 10,
  wanted: [20, 40, 60, 80, 95], // star thresholds
  patrolUnits: 4,
  extraUnitsPerStar: 1,
  patrolSpeed: 7,
  chaseSpeed: 9.2, // player sprint is 10 — outrunnable, but barely
};

export const SAVE_KEY = 'underworld.save.v1';
