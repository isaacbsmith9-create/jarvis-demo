import { DISTRICTS, enumerateLots } from '../../data/cities/miami';
import { PROPERTY_DEFS, TIER_FACTOR } from '../../data/properties/miami';
import type { AccountId, GameState, Money, Property } from '../../types/core';
import { clamp, dollars } from '../../utils/format';
import { hashRandom } from '../../utils/rng';

export const CLOSING_COST_RATE = 0.03;
export const SALE_COST_RATE = 0.05;

/** Build the property records and assign each to a map lot deterministically. */
export function createProperties(): Record<string, Property> {
  const lots = enumerateLots();
  const byDistrict = new Map<string, typeof lots>();
  for (const l of lots) {
    if (!byDistrict.has(l.district)) byDistrict.set(l.district, []);
    byDistrict.get(l.district)!.push(l);
  }
  const used = new Set<string>();
  const out: Record<string, Property> = {};
  const counters: Record<string, number> = {};
  for (const def of PROPERTY_DEFS) {
    const list = byDistrict.get(def.district) ?? [];
    const n = PROPERTY_DEFS.filter((d) => d.district === def.district).length;
    const i = counters[def.district] ?? 0;
    counters[def.district] = i + 1;
    // Spread properties across the district's lots.
    let idx = Math.floor(((i + 0.5) / n) * list.length);
    let guard = 0;
    while (used.has(`${list[idx]?.x},${list[idx]?.y}`) && guard++ < list.length) idx = (idx + 1) % list.length;
    const lot = list[idx];
    used.add(`${lot.x},${lot.y}`);
    const prof = DISTRICTS[def.district];
    const baseValue = dollars(def.sqft * prof.valuePsf * TIER_FACTOR[def.tier]);
    const owner: AccountId | 'private' = def.status.startsWith('rival:') ? def.status : 'private';
    out[def.id] = {
      id: def.id,
      name: def.name,
      district: def.district,
      type: def.type,
      sqft: def.sqft,
      tier: def.tier,
      lot: { x: lot.x, y: lot.y, w: lot.w, h: lot.h },
      baseValue,
      value: baseValue,
      rentPsf: Math.round(prof.rentPsf * (0.75 + TIER_FACTOR[def.tier] * 0.25) * 100) / 100,
      owner,
      forSale: def.status === 'sale' || def.status === 'both' ? askingPrice(baseValue, def.id) : null,
      forLease: def.status === 'lease' || def.status === 'both',
      use: owner.startsWith('rival:') ? { kind: 'rented', occupancy: 0.9 } : { kind: 'vacant' },
      lease: null,
      purchasedDay: null,
      purchasePrice: null,
    };
  }
  return out;
}

function askingPrice(value: Money, id: string): Money {
  const premium = 0.98 + hashRandom(id.length, id.charCodeAt(0), id.charCodeAt(id.length - 1)) * 0.1;
  return Math.round((value * premium) / 100000) * 100000;
}

/** Market rent per month for the whole property (cents). */
export function monthlyMarketRent(p: Property): Money {
  return dollars((p.sqft * p.rentPsf) / 12);
}

/** Lease price a company pays to occupy a property it doesn't own (slight premium). */
export function leaseRent(p: Property): Money {
  return Math.round(monthlyMarketRent(p) * 1.08);
}

/** Daily ownership cost: property tax, insurance and maintenance (cents). */
export function dailyUpkeep(p: Property): Money {
  const rate = 0.026 * DISTRICTS[p.district].costFactor;
  return Math.round((p.value * rate) / 365);
}

export function renovationCost(p: Property): Money {
  return Math.round(p.sqft * (40 + p.tier * 22) * 100 * DISTRICTS[p.district].costFactor);
}

export function isOwnedByPlayer(state: GameState, p: Property): boolean {
  return p.owner === 'player' || (p.owner.startsWith('co:') && !!state.companies[p.owner.slice(3)]);
}

/** Recompute market value from base value, district price index and tier. */
export function revalue(state: GameState, p: Property): void {
  const idx = state.economy.districts[p.district].priceIndex;
  p.value = Math.round(p.baseValue * idx);
}

/** Occupancy target for rented properties. Brokerage property managers raise it. */
export function occupancyTarget(state: GameState, p: Property, managerBoost: number): number {
  const d = state.economy.districts[p.district];
  return clamp(0.78 + (d.demand - 1) * 0.5 + p.tier * 0.02 + managerBoost, 0.4, 0.99);
}
