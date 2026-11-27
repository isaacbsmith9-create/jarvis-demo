import { DISTRICTS } from '../../data/cities/miami';
import { RIVAL_DEFS } from '../../data/companies/rivals';
import { SUBTYPES } from '../../data/companies/industries';
import type { GameState, Rival } from '../../types/core';
import { periodKey } from '../../utils/date';
import { clamp, dollars, money } from '../../utils/format';
import { chance, gaussian, nextRandom, pick } from '../../utils/rng';
import { macroDemand, seasonality } from '../economy/economy';
import { addNews } from '../events/news';
import { balance, rivalAccount, transfer, WORLD } from '../finance/ledger';
import { wipeStake } from './investments';
import { companyDistricts } from '../companies/units';

export function createRivals(state: GameState): Record<string, Rival> {
  const out: Record<string, Rival> = {};
  for (const d of RIVAL_DEFS) {
    out[d.id] = {
      id: d.id,
      name: d.name,
      industry: d.industry,
      subtype: d.subtype,
      owner: d.owner,
      ceo: d.ceo,
      strategy: d.strategy,
      homeDistrict: d.homeDistrict,
      districts: [...d.districts],
      baseRevenue: dollars(d.dailyRevenue),
      margin: d.margin,
      momentum: 0,
      priceCut: 0,
      employees: d.employees,
      reputation: d.reputation,
      status: 'active',
      playerStake: 0,
      stakeCost: 0,
      weeksUnprofitable: 0,
      weekRevenue: 0,
      weekExpenses: 0,
      monthly: [],
      description: d.description,
    };
    state.balances[rivalAccount(d.id)] = 0;
    transfer(state, WORLD, rivalAccount(d.id), dollars(d.cash), 'starting_capital', `${d.name} opening balance`);
  }
  return out;
}

/** Player companies competing directly with a rival (same subtype, overlapping district). */
function playerPressure(state: GameState, r: Rival): number {
  let n = 0;
  for (const c of Object.values(state.companies)) {
    if (c.status === 'closed' || c.subtype !== r.subtype) continue;
    const ds = companyDistricts(state, c);
    const hits = ds.length ? ds.filter((d) => r.districts.includes(d)).length : 1;
    n += hits * (0.5 + c.reputation / 200);
  }
  return n;
}

/** Daily: accrue revenue and costs. Cash settles weekly to keep the ledger compact. */
export function simulateRivalsDaily(state: GameState): void {
  for (const r of Object.values(state.rivals)) {
    if (r.status !== 'active') continue;
    const season = SUBTYPES[r.subtype].industry === 'hospitality' ? seasonality(state.day, 'tourism') : seasonality(state.day, 'local');
    const noise = 1 + gaussian(state) * 0.06;
    const pressure = 1 - Math.min(0.35, playerPressure(state, r) * 0.08);
    const rev = Math.max(0, Math.round(r.baseRevenue * macroDemand(state) * season * noise * (1 + r.momentum) * (1 - r.priceCut * 0.6) * pressure));
    const fixed = r.baseRevenue * (1 - r.margin);
    const exp = Math.round(fixed * 0.85 + rev * 0.15 * (1 - r.margin));
    r.weekRevenue += rev;
    r.weekExpenses += exp;
  }
}

/** Weekly: settle cash, make strategic decisions, generate news. */
export function simulateRivalsWeekly(state: GameState): void {
  for (const r of Object.values(state.rivals)) {
    if (r.status !== 'active') continue;
    const acct = rivalAccount(r.id);
    const net = r.weekRevenue - r.weekExpenses;
    transfer(state, WORLD, acct, net, 'rival_operations', `${r.name} weekly operations`);
    const key = periodKey(state.day);
    let m = r.monthly[r.monthly.length - 1];
    if (!m || m.period !== key) {
      m = { period: key, revenue: 0, profit: 0 };
      r.monthly.push(m);
      if (r.monthly.length > 24) r.monthly.shift();
    }
    m.revenue += r.weekRevenue;
    m.profit += net;
    r.weekRevenue = 0;
    r.weekExpenses = 0;
    r.weeksUnprofitable = net < 0 ? r.weeksUnprofitable + 1 : Math.max(0, r.weeksUnprofitable - 1);
    r.momentum = clamp(r.momentum * 0.9 + gaussian(state) * 0.015 + (r.strategy === 'aggressive' ? 0.004 : 0), -0.25, 0.35);
    r.priceCut = Math.max(0, r.priceCut - 0.01);
    decide(state, r);
  }
}

function decide(state: GameState, r: Rival): void {
  const cash = balance(state, rivalAccount(r.id));
  const roll = nextRandom(state);
  const pressure = playerPressure(state, r);

  // Bankruptcy
  if (cash < 0) {
    r.status = 'bankrupt';
    wipeStake(state, r);
    let released = 0;
    for (const p of Object.values(state.properties)) {
      if (p.owner === rivalAccount(r.id)) {
        p.owner = 'private';
        p.forSale = Math.round((p.value * 0.82) / 100000) * 100000;
        p.use = { kind: 'vacant' };
        released++;
      }
    }
    // Remaining negative balance is written off by creditors (outside the simulation).
    transfer(state, WORLD, rivalAccount(r.id), -cash, 'rival_operations', `${r.name} creditor write-off`);
    addNews(state, 'competitor', 'neutral', `${r.name} files for bankruptcy`, `After months of losses the company has collapsed.${released ? ` ${released} propert${released > 1 ? 'ies are' : 'y is'} now listed at distressed prices.` : ''}`, { rivalId: r.id });
    return;
  }

  // Cost cutting when losing money.
  if (r.weeksUnprofitable >= 6 && roll < 0.35) {
    const cut = Math.max(1, Math.round(r.employees * 0.12));
    r.employees -= cut;
    r.margin = clamp(r.margin + 0.04, -0.4, 0.35);
    r.baseRevenue = Math.round(r.baseRevenue * 0.95);
    r.weeksUnprofitable = 2;
    addNews(state, 'competitor', 'neutral', `${r.name} cuts ${cut} jobs`, 'The company is restructuring after sustained losses.', { rivalId: r.id });
    return;
  }

  // Price war against the player.
  if (pressure > 0.6 && r.strategy !== 'premium' && roll < 0.07 && r.priceCut < 0.1) {
    r.priceCut = 0.18;
    addNews(state, 'competitor', 'negative', `${r.name} slashes prices`, `${r.ceo} announced aggressive discounts, putting pressure on competing ${SUBTYPES[r.subtype].name.toLowerCase()}s.`, { rivalId: r.id });
    return;
  }

  // Acquisition of a listed property in its districts.
  const appetite = r.strategy === 'aggressive' ? 0.12 : r.strategy === 'steady' ? 0.05 : r.strategy === 'premium' ? 0.04 : 0.02;
  if (roll < appetite) {
    const targets = Object.values(state.properties).filter((p) => p.owner === 'private' && p.forSale !== null && r.districts.includes(p.district) && p.forSale < cash * 0.6);
    if (targets.length) {
      const p = pick(state, targets);
      const price = p.forSale!;
      transfer(state, rivalAccount(r.id), WORLD, price, 'property_purchase', `${r.name} acquires ${p.name}`);
      p.owner = rivalAccount(r.id);
      p.forSale = null;
      p.forLease = false;
      if (p.use.kind === 'vacant') p.use = { kind: 'rented', occupancy: 0.85 };
      r.baseRevenue = Math.round(r.baseRevenue * 1.06 + (price * 0.07) / 365);
      r.employees += Math.round(3 + nextRandom(state) * 8);
      addNews(state, 'competitor', 'neutral', `${r.name} acquires ${p.name}`, `The ${DISTRICTS[p.district].name} property sold for ${money(price)}. ${r.ceo} called it "a cornerstone of our expansion."`, { rivalId: r.id, propertyId: p.id });
      return;
    }
  }

  // Expansion into a new district.
  if (roll > 0.985 && cash > r.baseRevenue * 120) {
    const options = (Object.keys(DISTRICTS) as (keyof typeof DISTRICTS)[]).filter((d) => !r.districts.includes(d) && (DISTRICTS[d].affinity[r.subtype] ?? 1) > 1);
    if (options.length) {
      const d = pick(state, options);
      r.districts.push(d);
      r.baseRevenue = Math.round(r.baseRevenue * 1.12);
      r.employees += 12;
      addNews(state, 'competitor', 'neutral', `${r.name} expands into ${DISTRICTS[d].name}`, 'The new location increases competition in the district.', { rivalId: r.id });
      return;
    }
  }

  // Product launch / campaign
  if (roll > 0.96 && (r.industry === 'technology' || r.industry === 'retail')) {
    r.momentum = clamp(r.momentum + 0.1, -0.25, 0.35);
    r.reputation = clamp(r.reputation + 3, 0, 100);
    addNews(state, 'competitor', 'neutral', r.industry === 'technology' ? `${r.name} launches a major product update` : `${r.name} unveils a new collection`, 'Analysts expect a short-term boost in sales.', { rivalId: r.id });
    return;
  }

  // Growing rivals occasionally hire.
  if (r.momentum > 0.1 && chance(state, 0.15)) {
    const n = Math.round(2 + nextRandom(state) * 6);
    r.employees += n;
    r.baseRevenue = Math.round(r.baseRevenue * 1.03);
  }
}

export function rivalTrailingRevenue(r: Rival): number {
  const last = r.monthly.slice(-3);
  if (!last.length) return r.baseRevenue * 30;
  return last.reduce((s, m) => s + m.revenue, 0) / last.length;
}
