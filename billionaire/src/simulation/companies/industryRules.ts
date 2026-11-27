/**
 * Industry-specific daily operating rules. Each industry has its own demand,
 * capacity and cost model. These functions are pure calculation over state:
 * they return a DayResult and mutate only the company's ops/reputation fields.
 * Money movement happens in companies.ts through the ledger.
 */
import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import { PRICE_LEVELS, RETAIL_ECON, SUBTYPES } from '../../data/companies/industries';
import type { Company, DistrictId, GameState, HospitalityOps, Money, RealEstateOps, RetailOps, TechOps } from '../../types/core';
import { execBonus } from '../executives/executives';
import type { OpUnit } from './units';
import { clamp, dollars } from '../../utils/format';
import { nextRandom } from '../../utils/rng';
import { macroDemand, modifierMult, seasonality, weekdayFactor } from '../economy/economy';
import { avgSkill, companyStaff, roleCapacity, roleUnits } from '../employees/employees';
import { leaseRent, monthlyMarketRent, occupancyTarget } from '../properties/properties';

export interface DayResult {
  revenue: Money;
  cogs: Money;
  utilities: Money;
  hosting: Money;
  supplies: Money;
  commission: Money;
  marketing: Money;
  /** Cash spent on inventory (asset purchase, not an expense). */
  inventoryPurchase: Money;
  customers: number;
  capacity: number;
  demand: number;
  notes: string[];
}

export function emptyResult(): DayResult {
  return { revenue: 0, cogs: 0, utilities: 0, hosting: 0, supplies: 0, commission: 0, marketing: 0, inventoryPurchase: 0, customers: 0, capacity: 0, demand: 0, notes: [] };
}

export function companyDistrict(state: GameState, c: OpUnit): DistrictId | null {
  if (c.locationId) return state.properties[c.locationId]?.district ?? null;
  if (c.ops.kind === 'hospitality' && c.ops.foodTruckDistrict) return c.ops.foodTruckDistrict;
  return null;
}

export function repFactor(c: Company): number {
  return 0.6 + (c.reputation / 100) * 0.8;
}

/** Demand lift from marketing spend, with diminishing returns. A CMO makes each dollar work harder. */
export function marketingBoost(perDay: Money, scale = 250, cmo = 0): number {
  return 1 + 0.4 * (1 + cmo) * (1 - Math.exp(-perDay / 100 / scale));
}

/** Competition: active rivals in the same district and business type reduce demand. */
export function competitionFactor(state: GameState, c: OpUnit, district: DistrictId | null): number {
  let f = 1;
  for (const r of Object.values(state.rivals)) {
    if (r.status !== 'active') continue;
    const inDistrict = district ? r.districts.includes(district) : false;
    if (r.subtype === c.subtype && (inDistrict || !district)) f *= 0.9 - r.priceCut * 0.4;
    else if (r.industry === c.industry && inDistrict) f *= 0.97;
  }
  // Other player companies of the same subtype in the same district cannibalize slightly.
  for (const o of Object.values(state.companies)) {
    if (o.status === 'closed' || o.subtype !== c.subtype) continue;
    if (!district) continue;
    for (const b of o.branches) {
      if (o.id === c.id && b.id === c.branchId) continue;
      const d = b.locationId ? state.properties[b.locationId]?.district : null;
      if (d === district) f *= 0.93;
    }
  }
  return f;
}

/** Shared demand multiplier for location-based consumer businesses. */
function localDemand(state: GameState, c: OpUnit, district: DistrictId): number {
  const prof = DISTRICTS[district];
  const ds = state.economy.districts[district];
  const affinity = prof.affinity[c.subtype] ?? 1;
  const tourismShare = clamp((prof.tourism - 0.6) / 1.2, 0, 1);
  const season = seasonality(state.day, 'local') * (1 - tourismShare) + seasonality(state.day, 'tourism') * tourismShare;
  return prof.footTraffic * ds.demand * affinity * macroDemand(state) * season * modifierMult(state, district, c.industry, c.id);
}

function distressMult(c: Company): number {
  return c.status === 'distressed' ? 0.8 : 1;
}

export function utilitiesFor(state: GameState, c: OpUnit): Money {
  if (!c.locationId) return dollars(c.subtype === 'foodtruck' ? 65 : 8);
  const p = state.properties[c.locationId];
  return dollars(p.sqft * 0.03 * DISTRICTS[p.district].costFactor);
}

/** Fixed daily overhead: insurance, licences, software. */
export const OVERHEAD: Record<string, number> = {
  brokerage: 18, agency: 14, saas: 20, restaurant: 28, hotel: 140, nightclub: 70, foodtruck: 14, boutique: 16, convenience: 14, online: 9,
};

/* ------------------------------------------------------------------ */
/* TECHNOLOGY                                                          */
/* ------------------------------------------------------------------ */

function simAgency(state: GameState, c: OpUnit, ops: TechOps, r: DayResult): void {
  const price = PRICE_LEVELS[c.settings.priceLevel];
  const district = companyDistrict(state, c);
  const officeDay = weekdayFactor(state.day, 'office');
  const devUnits = roleUnits(state, c, 'dev');
  const designCap = roleCapacity(state, c, 'design');
  const salesCap = roleCapacity(state, c, 'sales');
  const pmCap = roleCapacity(state, c, 'pmgr');
  const quality = clamp(avgSkill(state, c, 'dev') * 0.6 + designCap * 18 + price.quality + 12, 5, 100);
  ops.quality = ops.quality + (quality - ops.quality) * 0.05;
  const scene = district ? DISTRICTS[district].techScene : 1;
  const capacity = devUnits * 6 * officeDay;
  const demand =
    (2 + c.reputation * 0.12 + salesCap * 45) *
    scene *
    macroDemand(state) *
    marketingBoost(c.settings.marketingPerDay, 150, execBonus(state, c, 'cmo')) *
    price.demand *
    competitionFactor(state, c, district) *
    modifierMult(state, district, 'technology', c.id) *
    distressMult(c) *
    officeDay;
  const efficiency = Math.min(1, 0.85 + pmCap * 0.12);
  const billed = Math.min(capacity, demand) * efficiency;
  const homeBased = !c.locationId ? 0.65 : 1;
  const rate = 165 * homeBased * price.mult * (0.8 + ops.quality / 250) * (0.7 + c.reputation / 200);
  r.revenue = dollars(billed * rate);
  r.supplies = dollars((companyStaff(state, c).length + (c.ownerOperated ? 1 : 0)) * 12);
  r.capacity = capacity;
  r.demand = demand;
  r.customers = Math.round(billed);
  ops.utilization = capacity > 0 ? billed / capacity : 0;
  const repTarget = ops.quality * 0.85 + (demand > capacity * 1.4 && officeDay > 0.5 ? -6 : 0);
  c.reputation = clamp(c.reputation + (repTarget - c.reputation) * 0.006, 0, 100);
}

function simSaas(state: GameState, c: OpUnit, ops: TechOps, r: DayResult): void {
  const price = PRICE_LEVELS[c.settings.priceLevel];
  const district = companyDistrict(state, c);
  const engCap = roleCapacity(state, c, 'eng') + roleCapacity(state, c, 'cto') * 1.5;
  const growthCap = roleCapacity(state, c, 'growth');
  const supportCap = roleCapacity(state, c, 'support');
  // Product development
  ops.quality = clamp(ops.quality + engCap * 0.3 * (1 - ops.quality / 100) - 0.02, 0, 100);
  ops.devProgress += engCap * 1.2;
  if (ops.devProgress >= 100) {
    ops.devProgress = 0;
    ops.version++;
    ops.quality = clamp(ops.quality + 3, 0, 100);
    r.notes.push(`shipped version ${ops.version}.0`);
  }
  const scene = district ? DISTRICTS[district].techScene : 1;
  const q = ops.quality / 100;
  const mkt = c.settings.marketingPerDay / 100;
  const cac = (35 / (0.5 + q)) / (1 + growthCap * 0.6 + execBonus(state, c, 'cmo')) * Math.pow(price.mult, 1.3) * (1 + mkt / 5000);
  const paid = q > 0.08 ? mkt / cac : 0;
  const organic =
    (ops.users * 0.0015 * (q / 0.6) * (1 + growthCap * 0.3) + q * q * 6 * scene) *
    repFactor(c) *
    macroDemand(state) *
    price.demand *
    competitionFactor(state, c, district) *
    modifierMult(state, district, 'technology', c.id) *
    distressMult(c);
  const supportRatio = ops.users > 0 ? (supportCap * 1500) / ops.users : 1;
  const churnRate = (0.0045 + (1 - q) * 0.007) * Math.pow(price.mult, 0.8) * (1.25 - 0.4 * Math.min(1, supportRatio));
  const churned = ops.users * churnRate;
  const added = paid + organic;
  ops.users = Math.max(0, ops.users + added - churned);
  const monthlyPrice = 39 * price.mult;
  r.revenue = dollars((ops.users * monthlyPrice) / 30);
  r.hosting = dollars(ops.users * 0.05 + 15);
  r.marketing = c.settings.marketingPerDay;
  r.supplies = dollars((companyStaff(state, c).length + (c.ownerOperated ? 1 : 0)) * 12);
  r.customers = Math.round(ops.users);
  r.demand = added;
  r.capacity = churned;
  ops.utilization = churnRate;
  const repTarget = ops.quality * 0.9;
  c.reputation = clamp(c.reputation + (repTarget - c.reputation) * 0.004, 0, 100);
}

/* ------------------------------------------------------------------ */
/* HOSPITALITY                                                         */
/* ------------------------------------------------------------------ */

function pickFoodTruckDistrict(state: GameState, c: OpUnit): DistrictId {
  let best: DistrictId = 'downtown';
  let bestScore = -1;
  for (const d of DISTRICT_ORDER) {
    const prof = DISTRICTS[d];
    const score = prof.footTraffic * state.economy.districts[d].demand * (prof.affinity.foodtruck ?? 1) * modifierMult(state, d, 'hospitality', c.id) * competitionFactor(state, c, d);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function simHospitality(state: GameState, c: OpUnit, ops: HospitalityOps, r: DayResult): void {
  const price = PRICE_LEVELS[c.settings.priceLevel];
  const prop = c.locationId ? state.properties[c.locationId] : null;
  if (c.subtype === 'foodtruck') ops.foodTruckDistrict = pickFoodTruckDistrict(state, c);
  const district = companyDistrict(state, c);
  if (!district) return;
  const prof = DISTRICTS[district];
  const tier = prop?.tier ?? 2;
  const base = localDemand(state, c, district) * repFactor(c) * price.demand * competitionFactor(state, c, district) * distressMult(c) * marketingBoost(c.settings.marketingPerDay, 250, execBonus(state, c, 'cmo'));
  const qualityF = 0.7 + ops.quality / 170;

  let capacity = 0;
  let demand = 0;
  let revenue = 0;
  let cogs = 0;
  let supplies = 0;
  let quality = 50;

  switch (c.subtype) {
    case 'restaurant': {
      const sqft = prop?.sqft ?? 1500;
      const seatCap = (sqft / 28) * 2.4;
      const kitchen = roleUnits(state, c, 'chef') * 58 + roleUnits(state, c, 'cook') * 45;
      const service = roleUnits(state, c, 'server') * 34;
      capacity = Math.min(seatCap, kitchen, service > 0 ? service : kitchen * 0.3);
      quality = avgSkill(state, c, 'chef') * 0.55 + avgSkill(state, c, 'cook') * 0.15 + avgSkill(state, c, 'server') * 0.15 + tier * 3 + price.quality;
      demand = 110 * base * weekdayFactor(state.day, 'dining') * qualityF;
      const covers = Math.min(capacity, demand);
      const ticket = 24 * price.mult * (0.55 + prof.affluence * 0.45) * (0.9 + tier * 0.04);
      revenue = covers * ticket;
      cogs = revenue * 0.32;
      supplies = covers * 1.2;
      r.customers = Math.round(covers);
      break;
    }
    case 'hotel': {
      const sqft = prop?.sqft ?? 20000;
      const rooms = Math.floor(sqft / 450);
      const hk = roleUnits(state, c, 'housekeeper') * 14;
      const desk = roleUnits(state, c, 'desk') * 45;
      const concierge = roleCapacity(state, c, 'concierge');
      capacity = Math.min(rooms, hk, desk);
      quality = avgSkill(state, c, 'desk') * 0.3 + avgSkill(state, c, 'housekeeper') * 0.3 + concierge * 12 + tier * 6 + price.quality;
      const tourism = Math.pow(prof.tourism, 0.6) * (seasonality(state.day, 'tourism') / seasonality(state.day, 'local'));
      demand = rooms * 0.68 * tourism * base * weekdayFactor(state.day, 'hotel') * qualityF / prof.footTraffic;
      const sold = Math.min(capacity, demand);
      const adr = 165 * price.mult * (0.5 + prof.affluence * 0.5) * (0.85 + tier * 0.06) * (1 + Math.min(0.1, concierge * 0.05));
      revenue = sold * adr * 1.18;
      cogs = sold * 38 + sold * adr * 0.18 * 0.3;
      supplies = rooms * 6;
      r.customers = Math.round(sold);
      r.notes.push(`occupancy ${rooms ? Math.round((sold / rooms) * 100) : 0}%`);
      break;
    }
    case 'nightclub': {
      const open = weekdayFactor(state.day, 'nightlife');
      const sqft = prop?.sqft ?? 5000;
      const venue = sqft / 9;
      const security = roleUnits(state, c, 'security') * 70;
      const bar = roleUnits(state, c, 'bartender') * 120;
      const promoters = roleCapacity(state, c, 'promoter');
      capacity = open > 0 ? Math.min(venue, security, bar) : 0;
      quality = avgSkill(state, c, 'bartender') * 0.35 + promoters * 15 + tier * 6 + price.quality + 15;
      demand = open > 0 ? (320 * base * open * (prof.nightlife / prof.footTraffic) * (1 + promoters * 0.25) * qualityF) : 0;
      const guests = Math.min(capacity, demand);
      const cover = 25 * price.mult;
      const barSpend = 42 * Math.sqrt(price.mult) * (0.6 + prof.affluence * 0.4);
      revenue = guests * (cover + barSpend);
      cogs = guests * barSpend * 0.22;
      supplies = open > 0 ? 1100 + guests * 2 : 0;
      r.customers = Math.round(guests);
      if (open > 0 && demand > security * 1.3) r.notes.push('security stretched thin');
      break;
    }
    case 'foodtruck': {
      capacity = Math.min(260, roleUnits(state, c, 'cook') * 115 + roleUnits(state, c, 'cashier') * 40);
      quality = avgSkill(state, c, 'cook') * 0.7 + price.quality + 10;
      demand = 150 * base * weekdayFactor(state.day, 'dining') * qualityF;
      const orders = Math.min(capacity, demand);
      const ticket = 13 * price.mult * (0.6 + prof.affluence * 0.4);
      revenue = orders * ticket;
      cogs = revenue * 0.33;
      supplies = 20 + orders * 0.4;
      r.customers = Math.round(orders);
      r.notes.push(`parked in ${prof.name}`);
      break;
    }
  }
  ops.quality = clamp(ops.quality + (clamp(quality, 0, 100) - ops.quality) * 0.05, 0, 100);
  ops.lastCapacity = capacity;
  ops.lastDemand = demand;
  ops.lastCustomers = r.customers;
  r.capacity = capacity;
  r.demand = demand;
  r.revenue = dollars(revenue);
  r.cogs = dollars(cogs);
  r.supplies = dollars(supplies);
  r.marketing = c.settings.marketingPerDay;
  const overflow = capacity > 0 && demand > capacity * 1.35 ? -6 : 0;
  const repTarget = ops.quality + overflow;
  if (capacity > 0) c.reputation = clamp(c.reputation + (repTarget - c.reputation) * 0.008, 0, 100);
}

/* ------------------------------------------------------------------ */
/* RETAIL                                                              */
/* ------------------------------------------------------------------ */

function simRetail(state: GameState, c: OpUnit, ops: RetailOps, r: DayResult): void {
  const sub = c.subtype as 'boutique' | 'convenience' | 'online';
  const econ = RETAIL_ECON[sub];
  const price = PRICE_LEVELS[c.settings.priceLevel];
  const district = companyDistrict(state, c);
  const prop = c.locationId ? state.properties[c.locationId] : null;
  const stockClerk = roleCapacity(state, c, 'stock');
  let shoppers = 0;
  let capacity = 0;
  let demand = 0;

  if (sub === 'online') {
    const growth = roleCapacity(state, c, 'growth');
    const mkt = c.settings.marketingPerDay / 100;
    const cac = (18 / (1 + growth * 0.5 + execBonus(state, c, 'cmo'))) * Math.pow(price.mult, 1.2) * (1 + mkt / 3000);
    demand = (mkt / cac + c.reputation * 0.15) * macroDemand(state) * modifierMult(state, null, 'retail', c.id) * distressMult(c) * weekdayFactor(state.day, 'retail');
    capacity = roleUnits(state, c, 'fulfill') * 90;
    shoppers = Math.min(demand, capacity);
  } else if (district) {
    const sizeF = Math.pow((prop?.sqft ?? 1200) / 1500, 0.4);
    demand =
      econ.baseCustomers *
      sizeF *
      localDemand(state, c, district) *
      weekdayFactor(state.day, 'retail') *
      marketingBoost(c.settings.marketingPerDay, 250, execBonus(state, c, 'cmo')) *
      repFactor(c) *
      price.demand *
      competitionFactor(state, c, district) *
      distressMult(c);
    capacity = roleUnits(state, c, sub === 'boutique' ? 'associate' : 'cashier') * (sub === 'boutique' ? 60 : 140);
    shoppers = Math.min(demand, capacity);
  }
  const buyers = sub === 'online' ? shoppers : shoppers * econ.conversion;
  const wanted = buyers * econ.unitsPerCustomer;
  const sold = Math.min(wanted, ops.inventory);
  if (wanted > ops.inventory + 0.5) {
    ops.stockouts++;
    r.notes.push('ran out of stock');
  }
  const unitCost = ops.unitCost / 100;
  const unitPrice = unitCost * econ.markup * price.mult;
  ops.inventory -= sold;
  const shrink = ops.inventory * 0.0015 * (stockClerk > 0 ? 0.5 : 1);
  ops.inventory -= shrink;
  r.revenue = dollars(sold * unitPrice);
  r.cogs = dollars((sold + shrink) * unitCost);
  r.customers = Math.round(sub === 'online' ? buyers : shoppers);
  r.capacity = capacity;
  r.demand = demand;
  r.marketing = c.settings.marketingPerDay;
  if (sub === 'online') r.supplies = dollars(buyers * 7);
  ops.lastCustomers = r.customers;
  ops.lastDemand = demand;
  // Restock policy
  if (ops.inventory < c.settings.stockTarget * 0.35 && c.settings.stockTarget > 0) {
    const qty = Math.ceil(c.settings.stockTarget - ops.inventory);
    const cost = qty * unitCost * (stockClerk > 0 ? 0.96 : 1) + 60;
    const cash = state.balances[`co:${c.id}`] ?? 0;
    const affordable = c.settings.autoFund ? cost : Math.min(cost, Math.max(0, cash / 100));
    const affordableQty = Math.floor(Math.max(0, affordable - 60) / (unitCost * (stockClerk > 0 ? 0.96 : 1)));
    if (affordableQty > 0) {
      ops.inventory += affordableQty;
      r.inventoryPurchase = dollars(affordableQty * unitCost * (stockClerk > 0 ? 0.96 : 1) + 60);
      r.notes.push(`restocked ${affordableQty} units`);
    }
  }
  const quality = 50 + (price.quality * 2) + (prop ? prop.tier * 3 : 5) + (ops.stockouts > 0 && wanted > sold ? -15 : 0) + roleCapacity(state, c, 'support') * 10;
  const repTarget = clamp(quality, 0, 100);
  c.reputation = clamp(c.reputation + (repTarget - c.reputation) * 0.006, 0, 100);
}

/* ------------------------------------------------------------------ */
/* REAL ESTATE                                                         */
/* ------------------------------------------------------------------ */

export interface ManagementInfo {
  capacity: number;
  managedIds: string[];
  coverage: number;
}

/** Property units the brokerage's managers can cover (one property ≈ sqft/6000 units, min 0.5). */
export function managementInfo(state: GameState, c: Company): ManagementInfo {
  const capacity = roleUnits(state, c, 'pm') * 6;
  const managed = Object.values(state.properties).filter(
    (p) => (p.owner === 'player' || p.owner === `co:${c.id}`) && p.use.kind === 'rented',
  );
  const need = managed.reduce((s, p) => s + Math.max(0.5, p.sqft / 6000), 0);
  return { capacity, managedIds: managed.map((p) => p.id), coverage: need > 0 ? Math.min(1, capacity / need) : 0 };
}

function simBrokerage(state: GameState, c: OpUnit, ops: RealEstateOps, r: DayResult): void {
  const district = companyDistrict(state, c);
  const officeDay = weekdayFactor(state.day, 'office');
  const agents = roleUnits(state, c, 'agent');
  const affinity = district ? (DISTRICTS[district].affinity.brokerage ?? 1) : 0.9;
  const lambda =
    agents * 0.03 * (state.economy.index / 100) * repFactor(c) * affinity * officeDay * marketingBoost(c.settings.marketingPerDay, 200, execBonus(state, c, 'cmo')) * competitionFactor(state, c, district) * distressMult(c);
  ops.pipeline = ops.pipeline * 0.95 + lambda * 20;
  let deals = Math.floor(lambda);
  if (nextRandom(state) < lambda - deals) deals++;
  let commissionRevenue = 0;
  for (let i = 0; i < deals; i++) {
    const affluence = district ? DISTRICTS[district].affluence : 1;
    const dealValue = 780000 * affluence * (0.6 + nextRandom(state) * 0.8) * PRICE_LEVELS[c.settings.priceLevel].mult;
    commissionRevenue += dealValue * 0.025;
  }
  ops.dealsClosed += deals;
  if (deals > 0) r.notes.push(`closed ${deals} deal${deals > 1 ? 's' : ''}`);
  r.revenue = dollars(commissionRevenue);
  const ownerUnits = c.ownerOperated ? 0.5 + (state.player.businessSkill / 100) * 0.95 : 0;
  const staffShare = agents > 0 ? (agents - ownerUnits) / agents : 0;
  r.commission = dollars(commissionRevenue * 0.4 * staffShare);
  r.marketing = c.settings.marketingPerDay;
  r.customers = deals;
  r.capacity = agents;
  r.demand = lambda;
  const info = managementInfo(state, c);
  ops.managedUnits = info.managedIds.length;
  const repTarget = 40 + Math.min(40, ops.dealsClosed * 1.5) + info.coverage * 10;
  c.reputation = clamp(c.reputation + (repTarget - c.reputation) * 0.004, 0, 100);
}

/* ------------------------------------------------------------------ */

export function simulateIndustry(state: GameState, c: OpUnit): DayResult {
  const r = emptyResult();
  const ops = c.ops;
  switch (ops.kind) {
    case 'technology':
      if (c.subtype === 'saas') simSaas(state, c, ops, r);
      else simAgency(state, c, ops, r);
      break;
    case 'hospitality':
      simHospitality(state, c, ops, r);
      break;
    case 'retail':
      simRetail(state, c, ops, r);
      break;
    case 'realestate':
      simBrokerage(state, c, ops, r);
      break;
  }
  r.utilities = utilitiesFor(state, c) + dollars(OVERHEAD[c.subtype] ?? 10);
  return r;
}

/** Monthly rent owed by a company occupying a property it doesn't own. */
export function companyDailyRent(state: GameState, c: OpUnit): Money {
  if (!c.locationId) return 0;
  const p = state.properties[c.locationId];
  if (!p?.lease || p.lease.companyId !== c.id) return 0;
  return Math.round((p.lease.monthlyRent * 12) / 365);
}

export { leaseRent, monthlyMarketRent, occupancyTarget, SUBTYPES };
