import { TIER_FACTOR } from '../../data/properties/miami';
import type { AccountId, GameState, Money, Property } from '../../types/core';
import { clamp, money } from '../../utils/format';
import { chance, randRange } from '../../utils/rng';
import { managementInfo } from '../companies/industryRules';
import { addNews } from '../events/news';
import { balance, companyAccount, PLAYER, transfer, WORLD } from '../finance/ledger';
import { fail, ok, type ActionResult } from '../result';
import { CLOSING_COST_RATE, dailyUpkeep, isOwnedByPlayer, monthlyMarketRent, occupancyTarget, renovationCost, revalue, SALE_COST_RATE } from './properties';

export function sellerAccount(p: Property): AccountId {
  return p.owner === 'private' ? WORLD : p.owner;
}

export function purchaseTotal(p: Property): Money {
  if (p.forSale === null) return 0;
  return p.forSale + Math.round(p.forSale * CLOSING_COST_RATE);
}

/** Buy a listed property, either personally or through a player-owned real estate company. */
export function buyProperty(state: GameState, propertyId: string, buyer: 'player' | string = 'player'): ActionResult {
  const p = state.properties[propertyId];
  if (!p) return fail('Property not found.');
  if (p.forSale === null) return fail(`${p.name} is not for sale.`);
  if (isOwnedByPlayer(state, p)) return fail('You already own this property.');
  let acct: AccountId = PLAYER;
  if (buyer !== 'player') {
    const c = state.companies[buyer];
    if (!c || c.status === 'closed') return fail('Company not found.');
    if (c.industry !== 'realestate') return fail('Only real estate companies can hold property.');
    acct = companyAccount(c.id);
  }
  const price = p.forSale;
  const closing = Math.round(price * CLOSING_COST_RATE);
  if (balance(state, acct) < price + closing) return fail(`You need ${money(price + closing)} (price + ${Math.round(CLOSING_COST_RATE * 100)}% closing costs).`);
  const seller = sellerAccount(p);
  const sellerName = p.owner.startsWith('rival:') ? state.rivals[p.owner.slice(6)]?.name : null;
  transfer(state, acct, seller, price, 'property_purchase', `Purchase of ${p.name}`);
  transfer(state, acct, WORLD, closing, 'closing_costs', `Closing costs — ${p.name}`);
  if (p.owner.startsWith('rival:')) {
    const r = state.rivals[p.owner.slice(6)];
    if (r) r.baseRevenue = Math.round(r.baseRevenue * 0.94);
  }
  p.owner = acct;
  p.forSale = null;
  p.forLease = false;
  p.purchasedDay = state.day;
  p.purchasePrice = price;
  // Existing tenants stay on; company leases continue with you as landlord.
  if (p.use.kind === 'rented') p.use = { kind: 'rented', occupancy: p.use.occupancy };
  else if (p.use.kind === 'company' && p.lease && state.companies[p.lease.companyId]) {
    // Your own company was leasing it: the lease ends now that you own it.
    p.lease = null;
  }
  state.stats.propertiesBought++;
  addNews(state, 'property', 'positive', `${p.name} changes hands`, `Acquired for ${money(price)}${sellerName ? ` from ${sellerName}` : ''}.`, { propertyId: p.id });
  return ok(`You bought ${p.name} for ${money(price)}.`);
}

export function saleProceeds(p: Property): { gross: Money; costs: Money; net: Money } {
  const gross = p.value;
  const costs = Math.round(gross * SALE_COST_RATE);
  return { gross, costs, net: gross - costs };
}

export function sellProperty(state: GameState, propertyId: string): ActionResult {
  const p = state.properties[propertyId];
  if (!p) return fail('Property not found.');
  if (!isOwnedByPlayer(state, p)) return fail('You do not own this property.');
  if (p.use.kind === 'company') {
    const occ = state.companies[p.use.companyId];
    if (occ && occ.status !== 'closed') return fail(`${occ.name} operates here. Close or move the company first.`);
  }
  const acct = p.owner;
  const { gross, costs } = saleProceeds(p);
  transfer(state, WORLD, acct, gross, 'property_sale', `Sale of ${p.name}`);
  transfer(state, acct, WORLD, costs, 'closing_costs', `Broker & closing costs — ${p.name}`);
  const gain = p.purchasePrice !== null ? gross - costs - p.purchasePrice : null;
  p.owner = 'private';
  p.forSale = null;
  p.forLease = false;
  p.use = p.use.kind === 'rented' ? p.use : { kind: 'vacant' };
  p.purchasedDay = null;
  p.purchasePrice = null;
  addNews(state, 'property', 'neutral', `${p.name} sold`, `Sold for ${money(gross)}${gain !== null ? ` (${gain >= 0 ? 'gain' : 'loss'} of ${money(Math.abs(gain))} vs purchase price)` : ''}.`, { propertyId: p.id });
  return ok(`Sold ${p.name} for ${money(gross - costs)} after costs.`);
}

export function rentOut(state: GameState, propertyId: string): ActionResult {
  const p = state.properties[propertyId];
  if (!p || !isOwnedByPlayer(state, p)) return fail('You do not own this property.');
  if (p.use.kind !== 'vacant') return fail(`${p.name} is not vacant.`);
  p.use = { kind: 'rented', occupancy: 0.25 };
  return ok(`${p.name} is now listed for tenants. Occupancy will build over the coming weeks.`);
}

export function stopRenting(state: GameState, propertyId: string): ActionResult {
  const p = state.properties[propertyId];
  if (!p || !isOwnedByPlayer(state, p)) return fail('You do not own this property.');
  if (p.use.kind !== 'rented') return fail(`${p.name} is not rented out.`);
  p.use = { kind: 'vacant' };
  return ok(`Tenants have been given notice. ${p.name} is now vacant.`);
}

export function renovateProperty(state: GameState, propertyId: string): ActionResult {
  const p = state.properties[propertyId];
  if (!p || !isOwnedByPlayer(state, p)) return fail('You do not own this property.');
  if (p.tier >= 5) return fail(`${p.name} is already top-tier.`);
  const cost = renovationCost(p);
  if (balance(state, p.owner) < cost) return fail(`Renovation costs ${money(cost)}.`);
  transfer(state, p.owner, WORLD, cost, 'renovation', `Renovation — ${p.name}`);
  const ratio = TIER_FACTOR[p.tier + 1] / TIER_FACTOR[p.tier];
  p.tier++;
  p.baseValue = Math.round(p.baseValue * ratio);
  p.rentPsf = Math.round(p.rentPsf * (1 + (ratio - 1) * 0.6) * 100) / 100;
  if (p.use.kind === 'rented') p.use.occupancy = clamp(p.use.occupancy - 0.12, 0, 1);
  revalue(state, p);
  return ok(`${p.name} renovated to tier ${p.tier}. New estimated value ${money(p.value)}.`);
}

/** Transfer a personally owned property into a real estate company (or back). */
export function transferProperty(state: GameState, propertyId: string, to: 'player' | string): ActionResult {
  const p = state.properties[propertyId];
  if (!p || !isOwnedByPlayer(state, p)) return fail('You do not own this property.');
  const target: AccountId = to === 'player' ? PLAYER : companyAccount(to);
  if (to !== 'player') {
    const c = state.companies[to];
    if (!c || c.status === 'closed' || c.industry !== 'realestate') return fail('Only active real estate companies can hold property.');
  }
  if (p.owner === target) return fail('Already held there.');
  p.owner = target;
  return ok(`${p.name} is now held by ${to === 'player' ? 'you personally' : state.companies[to].name}.`);
}

/* ------------------------------------------------------------------ */
/* Daily property simulation                                           */
/* ------------------------------------------------------------------ */

export function simulateProperties(state: GameState): void {
  // Find the best brokerage (by management coverage) for occupancy/rent bonuses and fees.
  let manager: { id: string; coverage: number } | null = null;
  for (const c of Object.values(state.companies)) {
    if (c.status === 'closed' || c.industry !== 'realestate') continue;
    const info = managementInfo(state, c);
    if (info.capacity > 0 && (!manager || info.coverage > manager.coverage)) manager = { id: c.id, coverage: info.coverage };
  }
  const income = new Map<AccountId, Money>();
  const upkeep = new Map<AccountId, Money>();
  let fees = 0;

  for (const p of Object.values(state.properties)) {
    revalue(state, p);
    if (!isOwnedByPlayer(state, p)) continue;
    const owner = p.owner;
    upkeep.set(owner, (upkeep.get(owner) ?? 0) + dailyUpkeep(p));
    if (p.use.kind === 'rented') {
      const boost = manager ? manager.coverage * 0.08 : 0;
      const target = occupancyTarget(state, p, boost);
      p.use.occupancy = clamp(p.use.occupancy + (target - p.use.occupancy) * 0.03, 0, 1);
      const rent = Math.round(((monthlyMarketRent(p) * 12) / 365) * p.use.occupancy * (1 + (manager ? manager.coverage * 0.04 : 0)));
      income.set(owner, (income.get(owner) ?? 0) + rent);
      if (manager && owner === PLAYER) fees += Math.round(rent * 0.08 * manager.coverage);
    }
  }
  for (const [acct, amt] of income) transfer(state, WORLD, acct, amt, 'rental_income', `Rental income`);
  for (const [acct, amt] of upkeep) transfer(state, acct, WORLD, amt, 'upkeep', 'Property tax, insurance & maintenance');
  if (manager && fees > 0) {
    transfer(state, PLAYER, companyAccount(manager.id), fees, 'management_fee', 'Property management fees');
    const c = state.companies[manager.id];
    c.current.revenue += fees;
    c.current.profit += fees;
    c.lifetime.revenue += fees;
    const last = c.history[c.history.length - 1];
    if (last && last.day === state.day) {
      last.revenue += fees;
      last.profit += fees;
    }
  }
  // Rental income on company-held properties counts as company revenue; upkeep as operating cost.
  for (const c of Object.values(state.companies)) {
    if (c.status === 'closed') continue;
    const acct = companyAccount(c.id);
    const inc = income.get(acct) ?? 0;
    const up = upkeep.get(acct) ?? 0;
    if (!inc && !up) continue;
    c.current.revenue += inc;
    c.current.operating += up;
    c.current.profit += inc - up;
    c.lifetime.revenue += inc;
    c.lifetime.expenses += up;
    const last = c.history[c.history.length - 1];
    if (last && last.day === state.day) {
      last.revenue += inc;
      last.expenses += up;
      last.profit += inc - up;
      last.cash = balance(state, acct);
    }
  }
}

/** Weekly market activity: private owners list, delist and reprice properties. */
export function refreshListings(state: GameState): void {
  for (const p of Object.values(state.properties)) {
    if (p.owner !== 'private') continue;
    if (p.forSale === null) {
      if (chance(state, 0.05)) {
        p.forSale = Math.round((p.value * randRange(state, 0.98, 1.1)) / 100000) * 100000;
        if (chance(state, 0.4)) addNews(state, 'property', 'neutral', `New listing: ${p.name}`, `Asking ${money(p.forSale)}.`, { propertyId: p.id });
      }
    } else {
      if (chance(state, 0.025)) p.forSale = null;
      else p.forSale = Math.round(((p.forSale * 0.85 + p.value * 1.03 * 0.15)) / 100000) * 100000;
    }
    const leaseable = p.type !== 'residential' && p.use.kind === 'vacant' && !p.lease;
    if (leaseable && !p.forLease && chance(state, 0.06)) p.forLease = true;
    else if (p.forLease && chance(state, 0.02)) p.forLease = false;
  }
}
