import { PRICE_LEVELS, RETAIL_ECON, roleDef, SUBTYPES } from '../../data/companies/industries';
import type { Branch, Company, CompanyOps, Employee, GameState, Money, PeriodStatement, PriceLevel, Property, SubtypeId } from '../../types/core';
import { formatPeriod, periodKey } from '../../utils/date';
import { clamp, dollars, money } from '../../utils/format';
import { addNews } from '../events/news';
import { companyStaff, dailyPayroll, generateEmployee, hasManager, refreshCandidates, updateEmployees } from '../employees/employees';
import { balance, companyAccount, PLAYER, transfer, WORLD } from '../finance/ledger';
import { leaseRent } from '../properties/properties';
import { companyDailyRent, emptyResult, simulateIndustry, type DayResult } from './industryRules';
import { branchLabel, branchStaffIds, findBranch, primaryBranch, unitFor } from './units';

import { fail, ok, type ActionResult } from '../result';
export { fail, ok, type ActionResult };

export const HISTORY_DAYS = 180;
export const DEPRECIATION_RATE = 0.00055;
/** A second location reuses the brand, systems and know-how: fit-out costs less. */
export const BRANCH_SETUP_DISCOUNT = 0.6;
/** Moving an existing location: equipment moves with you, you pay for the move and new fit-out work. */
export const RELOCATION_COST_SHARE = 0.35;

export function emptyStatement(period: string): PeriodStatement {
  return { period, revenue: 0, cogs: 0, payroll: 0, rent: 0, marketing: 0, operating: 0, depreciation: 0, profit: 0 };
}

export function initialOps(subtype: SubtypeId): CompanyOps {
  const ind = SUBTYPES[subtype].industry;
  switch (ind) {
    case 'technology':
      return { kind: 'technology', quality: subtype === 'saas' ? 8 : 45, users: 0, version: subtype === 'saas' ? 0 : 1, devProgress: 0, utilization: 0 };
    case 'hospitality':
      return { kind: 'hospitality', quality: 50, lastCustomers: 0, lastCapacity: 0, lastDemand: 0, foodTruckDistrict: null };
    case 'retail': {
      const econ = RETAIL_ECON[subtype as 'boutique' | 'convenience' | 'online'];
      return { kind: 'retail', inventory: 0, unitCost: dollars(econ.unitCost), lastCustomers: 0, lastDemand: 0, stockouts: 0 };
    }
    case 'realestate':
      return { kind: 'realestate', dealsClosed: 0, pipeline: 0, managedUnits: 0 };
  }
}

/** Default retail stock target: about 7 days of expected unit sales. */
export function defaultStockTarget(subtype: SubtypeId, sqft: number | null): number {
  if (subtype === 'boutique') return Math.round(200 * Math.pow((sqft ?? 1200) / 1500, 0.4));
  if (subtype === 'convenience') return Math.round(1700 * Math.pow((sqft ?? 900) / 1500, 0.4));
  if (subtype === 'online') return 120;
  return 0;
}

export function playerCompanies(state: GameState, includeClosed = false): Company[] {
  return Object.values(state.companies).filter((c) => c.owner === 'player' && (includeClosed || c.status !== 'closed'));
}

/* ------------------------------------------------------------------ */
/* Location quotes (founding, new branches, relocation)                 */
/* ------------------------------------------------------------------ */

export interface FoundingPlan {
  subtype: SubtypeId;
  locationId: string | null;
  /** 'own' = operate from a player-owned property; 'lease' = lease from current owner; 'none' = home/mobile. */
  locationMode: 'own' | 'lease' | 'none';
}

export interface FoundingQuote {
  setup: Money;
  inventory: Money;
  deposit: Money;
  monthlyRent: Money;
  minimum: Money;
  recommended: Money;
  errors: string[];
}

type QuoteKind = 'found' | 'branch' | 'relocate';

function locationErrors(state: GameState, plan: FoundingPlan, kind: QuoteKind, owner: 'player' | 'market' = 'player'): string[] {
  const sub = SUBTYPES[plan.subtype];
  const errors: string[] = [];
  const prop = plan.locationId ? state.properties[plan.locationId] : null;
  if (sub.mobile && plan.locationMode !== 'none') errors.push(`${sub.name} is mobile and cannot use a property.`);
  if (plan.locationMode === 'none' && !sub.locationOptional) errors.push(`${sub.name} needs a physical location.`);
  if (plan.locationMode === 'none' && kind !== 'found' && !sub.mobile) errors.push('Pick a property for the new location.');
  if (plan.locationMode !== 'none') {
    if (!prop) errors.push('Select a property.');
    else {
      if (!sub.propertyTypes.includes(prop.type)) errors.push(`${prop.name} (${prop.type}) is not suitable for a ${sub.name}.`);
      if (plan.locationMode === 'own' && owner === 'player' && prop.owner !== 'player' && !prop.owner.startsWith('co:')) errors.push('You do not own this property.');
      if (plan.locationMode === 'lease' && !prop.forLease) errors.push('This property is not available for lease.');
      if (prop.use.kind !== 'vacant') errors.push(`${prop.name} is already in use.`);
    }
  }
  return errors;
}

/** Cost breakdown and validation for founding a company, opening a branch or moving one. */
export function quoteLocation(state: GameState, plan: FoundingPlan, kind: QuoteKind = 'found', owner: 'player' | 'market' = 'player'): FoundingQuote {
  const sub = SUBTYPES[plan.subtype];
  const errors = locationErrors(state, plan, kind, owner);
  const prop = plan.locationId ? state.properties[plan.locationId] : null;
  const sqft = prop && plan.locationMode !== 'none' ? prop.sqft : 0;
  const homeBased = plan.locationMode === 'none' && !sub.mobile && sub.homeSetup !== undefined;
  let setup = dollars(homeBased ? sub.homeSetup! : sub.setupBase + sub.setupPerSqft * sqft);
  if (kind === 'branch') setup = Math.round(setup * BRANCH_SETUP_DISCOUNT);
  if (kind === 'relocate') setup = Math.round(setup * RELOCATION_COST_SHARE);
  let inventory = 0;
  if (sub.industry === 'retail' && kind !== 'relocate') {
    const econ = RETAIL_ECON[plan.subtype as 'boutique' | 'convenience' | 'online'];
    inventory = dollars(defaultStockTarget(plan.subtype, sqft || null) * econ.unitCost);
  }
  const monthlyRent = prop && plan.locationMode === 'lease' ? leaseRent(prop) : 0;
  const deposit = monthlyRent;
  const minimum = setup + inventory + deposit;
  const recommended =
    kind !== 'found' ? minimum : homeBased ? minimum + dollars(300) : minimum + Math.max(dollars(2000), monthlyRent * 2) + dollars(sub.industry === 'technology' ? 15000 : 5000);
  return { setup, inventory, deposit, monthlyRent, minimum, recommended, errors };
}

export function quoteFounding(state: GameState, plan: FoundingPlan): FoundingQuote {
  return quoteLocation(state, plan, 'found');
}

/** Occupy a property for a branch: mark it used and, for a lease, sign it and pay the deposit. */
function occupy(state: GameState, c: Company, b: Branch, prop: Property, mode: FoundingPlan['locationMode'], q: FoundingQuote): void {
  prop.use = { kind: 'company', companyId: c.id };
  if (mode === 'lease') {
    const landlord = prop.owner === 'private' ? WORLD : prop.owner;
    prop.lease = { companyId: c.id, monthlyRent: q.monthlyRent, sinceDay: state.day };
    prop.forLease = false;
    transfer(state, companyAccount(c.id), landlord, q.deposit, 'rent', `Lease deposit — ${prop.name}`);
  }
  b.locationId = prop.id;
}

/** Give up a branch's property: end the lease (back on the market) or leave an owned building vacant. */
function release(state: GameState, c: Company, b: Branch): void {
  if (!b.locationId) return;
  const p = state.properties[b.locationId];
  if (p) {
    p.use = { kind: 'vacant' };
    if (p.lease?.companyId === c.id) {
      p.lease = null;
      p.forLease = p.owner === 'private' || p.owner.startsWith('rival:');
    }
  }
  b.locationId = null;
}

/** Pay from company cash, topping up from your cash when auto-funding allows. */
function payFromCompany(state: GameState, c: Company, amount: Money, why: string): boolean {
  const acct = companyAccount(c.id);
  const short = amount - balance(state, acct);
  if (short > 0) {
    if (c.owner !== 'player' || !c.settings.autoFund || balance(state, PLAYER) < short) return false;
    transfer(state, PLAYER, acct, short, 'capital_injection', `Funding ${why} at ${c.name}`);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Founding                                                             */
/* ------------------------------------------------------------------ */

interface CreateOpts {
  silent?: boolean;
  fromScenario?: boolean;
  owner?: 'player' | 'market';
}

export function foundCompany(state: GameState, name: string, plan: FoundingPlan, capital: Money, opts: CreateOpts = {}): ActionResult {
  const owner = opts.owner ?? 'player';
  const funded = opts.fromScenario || owner === 'market';
  const trimmed = name.trim();
  if (trimmed.length < 2) return fail('Company name must be at least 2 characters.');
  if (trimmed.length > 40) return fail('Company name must be 40 characters or fewer.');
  if (Object.values(state.companies).some((c) => c.status !== 'closed' && c.name.toLowerCase() === trimmed.toLowerCase())) return fail('A company with that name already exists.');
  const q = quoteLocation(state, plan, 'found', owner);
  if (q.errors.length) return fail(q.errors[0]);
  if (!funded && capital < q.minimum) return fail(`Starting capital must be at least ${money(q.minimum)}.`);
  if (!funded && balance(state, PLAYER) < capital) return fail(`You need ${money(capital)} in cash to fund this company.`);

  state.counters.company++;
  const id = `c${state.counters.company}`;
  const sub = SUBTYPES[plan.subtype];
  const prop = plan.locationId && plan.locationMode !== 'none' ? state.properties[plan.locationId] : null;
  const branch: Branch = {
    id: 'b1',
    locationId: null,
    ops: initialOps(plan.subtype),
    equipment: q.setup,
    stockTarget: defaultStockTarget(plan.subtype, prop ? prop.sqft : null),
    openedDay: state.day,
  };
  const company: Company = {
    id,
    name: trimmed,
    industry: sub.industry,
    subtype: plan.subtype,
    owner,
    foundedDay: state.day,
    status: 'operating',
    ownerOperated: false,
    reputation: clamp(Math.round(10 + state.player.reputation * 0.5), 5, 60),
    startingCapital: capital,
    settings: { priceLevel: 'standard', marketingPerDay: 0, autoFund: owner === 'player', delegated: false },
    branches: [branch],
    nextBranch: 2,
    listing: null,
    history: [],
    statements: [],
    current: emptyStatement(periodKey(state.day)),
    lifetime: { revenue: 0, expenses: 0 },
    employeeIds: [],
    candidates: [],
    distressDays: 0,
  };
  state.companies[id] = company;
  const acct = companyAccount(id);
  state.balances[acct] = 0;
  transfer(state, funded ? WORLD : PLAYER, acct, capital, funded ? 'starting_capital' : 'capital_injection', `Founding capital for ${trimmed}`);
  transfer(state, acct, WORLD, q.setup, 'setup', `${sub.name} setup & equipment`);
  if (branch.ops.kind === 'retail' && q.inventory > 0) {
    branch.ops.inventory = branch.stockTarget;
    transfer(state, acct, WORLD, q.inventory, 'inventory', 'Opening inventory');
  }
  if (prop) occupy(state, company, branch, prop, plan.locationMode, q);
  // Owner-operator by default if the player isn't already operating another company.
  if (owner === 'player' && !playerCompanies(state).some((c) => c.id !== id && c.ownerOperated)) company.ownerOperated = true;
  refreshCandidates(state, company);
  if (owner === 'player') state.stats.companiesFounded++;
  if (!opts.silent) {
    addNews(state, 'company', 'positive', `${trimmed} opens for business`, `A new ${sub.name.toLowerCase()} has launched${prop ? ` at ${prop.name}` : ''} with ${money(capital)} in starting capital.`, { companyId: id });
  }
  return ok(`${trimmed} founded.`, id);
}

/* ------------------------------------------------------------------ */
/* Branches                                                             */
/* ------------------------------------------------------------------ */

export function canHaveBranches(subtype: SubtypeId): boolean {
  const sub = SUBTYPES[subtype];
  // A SaaS product is one product: it can move offices but not split into branches.
  return subtype !== 'saas' && (sub.mobile === true || sub.propertyTypes.length > 0);
}

export function quoteBranch(state: GameState, companyId: string, locationId: string | null): FoundingQuote {
  const c = state.companies[companyId];
  const prop = locationId ? state.properties[locationId] : null;
  const mode: FoundingPlan['locationMode'] = !prop ? 'none' : prop.owner === 'player' || prop.owner.startsWith('co:') ? 'own' : 'lease';
  return quoteLocation(state, { subtype: c.subtype, locationId, locationMode: mode }, 'branch');
}

/** Open another location of an existing company, paid from company cash. */
export function openBranch(state: GameState, companyId: string, locationId: string | null): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  if (!canHaveBranches(c.subtype)) return fail(`A ${SUBTYPES[c.subtype].name} runs from one place.`);
  if (c.status === 'distressed') return fail(`${c.name} is overdrawn. Fix its finances before expanding.`);
  if (c.branches.length >= 12) return fail('Twelve locations is the limit for one company in this version.');
  const q = quoteBranch(state, companyId, locationId);
  if (q.errors.length) return fail(q.errors[0]);
  if (!payFromCompany(state, c, q.minimum, 'a new location')) return fail(`Opening costs ${money(q.minimum)}. ${c.name} has ${money(balance(state, companyAccount(c.id)))}; add capital or turn on auto-funding.`);
  const prop = locationId ? state.properties[locationId] : null;
  const b: Branch = {
    id: `b${c.nextBranch++}`,
    locationId: null,
    ops: initialOps(c.subtype),
    equipment: q.setup,
    stockTarget: defaultStockTarget(c.subtype, prop ? prop.sqft : null),
    openedDay: state.day,
  };
  // New locations inherit the company's product and know-how.
  const first = primaryBranch(c);
  if (b.ops.kind === 'technology' && first.ops.kind === 'technology') {
    b.ops.quality = first.ops.quality;
    b.ops.version = first.ops.version;
  }
  if (b.ops.kind === 'hospitality' && first.ops.kind === 'hospitality') b.ops.quality = Math.max(40, first.ops.quality - 8);
  c.branches.push(b);
  const acct = companyAccount(c.id);
  transfer(state, acct, WORLD, q.setup, 'setup', `New location fit-out${prop ? ` — ${prop.name}` : ''}`);
  if (b.ops.kind === 'retail' && q.inventory > 0) {
    b.ops.inventory = b.stockTarget;
    transfer(state, acct, WORLD, q.inventory, 'inventory', 'Opening inventory for new location');
  }
  if (prop) occupy(state, c, b, prop, prop.owner === 'player' || prop.owner.startsWith('co:') ? 'own' : 'lease', q);
  addNews(state, 'company', 'positive', `${c.name} opens a new location`, `${c.name} now operates ${c.branches.length} locations${prop ? `, adding ${prop.name}` : ''}.`, { companyId: c.id });
  return ok(`Opened ${branchLabel(state, c, b)}. Hire staff for it from the Staff tab.`, b.id);
}

export function quoteRelocation(state: GameState, companyId: string, locationId: string): FoundingQuote {
  const c = state.companies[companyId];
  const prop = state.properties[locationId];
  const mode: FoundingPlan['locationMode'] = prop && (prop.owner === 'player' || prop.owner.startsWith('co:')) ? 'own' : 'lease';
  return quoteLocation(state, { subtype: c.subtype, locationId, locationMode: mode }, 'relocate');
}

/** Move a branch to a new property. Staff, equipment, stock and know-how move with it. */
export function relocateBranch(state: GameState, companyId: string, branchId: string, locationId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  const b = findBranch(c, branchId);
  if (!b) return fail('Location not found.');
  if (b.locationId === locationId) return fail('That is already where it operates.');
  const q = quoteRelocation(state, companyId, locationId);
  if (q.errors.length) return fail(q.errors[0]);
  if (!payFromCompany(state, c, q.minimum, 'a move')) return fail(`The move costs ${money(q.minimum)}. ${c.name} doesn't have it; add capital or turn on auto-funding.`);
  const from = branchLabel(state, c, b);
  release(state, c, b);
  const prop = state.properties[locationId];
  transfer(state, companyAccount(c.id), WORLD, q.setup, 'setup', `Moving to ${prop.name}`);
  b.equipment += Math.round(q.setup * 0.5);
  occupy(state, c, b, prop, prop.owner === 'player' || prop.owner.startsWith('co:') ? 'own' : 'lease', q);
  if (b.ops.kind === 'retail') b.stockTarget = Math.max(b.stockTarget, defaultStockTarget(c.subtype, prop.sqft));
  addNews(state, 'company', 'neutral', `${c.name} moves to ${prop.name}`, `The business relocated from ${from}.`, { companyId: c.id, propertyId: prop.id });
  return ok(`${c.name} moved from ${from} to ${prop.name}.`);
}

/** Close one location. Its staff move to other locations where there's room; the rest are let go. */
export function closeBranch(state: GameState, companyId: string, branchId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  if (c.branches.length < 2) return fail('This is the last location. Close the company instead.');
  const b = findBranch(c, branchId);
  if (!b) return fail('Location not found.');
  const label = branchLabel(state, c, b);
  const acct = companyAccount(c.id);
  const staff = branchStaffIds(state, c, b).map((id) => state.employees[id]);
  c.branches = c.branches.filter((x) => x.id !== b.id);
  let moved = 0;
  let laidOff = 0;
  for (const e of staff) {
    const target = c.branches.find((x) => branchStaffIds(state, c, x).length < maxStaffAt(state, c, x));
    if (target) {
      e.branchId = target.id;
      moved++;
    } else {
      transfer(state, acct, WORLD, Math.round((e.salary / 52) * 2), 'severance', `Severance — ${e.name}`);
      c.employeeIds = c.employeeIds.filter((id) => id !== e.id);
      delete state.employees[e.id];
      laidOff++;
    }
  }
  transfer(state, WORLD, acct, Math.round(b.equipment * 0.25), 'equipment_sale', `Equipment sale — ${label}`);
  if (b.ops.kind === 'retail' && b.ops.inventory > 0) {
    const dest = c.branches[0].ops;
    if (dest.kind === 'retail') dest.inventory += b.ops.inventory;
  }
  release(state, c, b);
  return ok(`Closed ${label}. ${moved ? `${moved} staff moved to other locations. ` : ''}${laidOff ? `${laidOff} let go with severance.` : ''}`.trim());
}

/* ------------------------------------------------------------------ */
/* Daily operations                                                    */
/* ------------------------------------------------------------------ */

export interface CompanyDay {
  result: DayResult;
  payroll: Money;
  rent: Money;
  depreciation: Money;
}

export function simulateCompanyDay(state: GameState, c: Company): void {
  if (c.status === 'closed') return;
  const acct = companyAccount(c.id);
  const isPlayer = c.owner === 'player';
  const total = emptyResult();
  let payroll = 0;
  let rent = 0;
  let depreciation = 0;
  const startRep = c.reputation;
  let repDelta = 0;

  for (const b of c.branches) {
    const unit = unitFor(state, c, b);
    const r = simulateIndustry(state, unit);
    repDelta += unit.reputation - startRep;
    const bPayroll = dailyPayroll(state, unit);
    const bRent = companyDailyRent(state, unit);
    const dep = Math.round(b.equipment * DEPRECIATION_RATE);
    b.equipment -= dep;
    const prop = b.locationId ? state.properties[b.locationId] : null;
    if (bRent > 0) transfer(state, acct, prop?.owner && prop.owner !== 'private' ? prop.owner : WORLD, bRent, 'rent', prop ? `Lease — ${prop.name}` : 'Lease');
    payroll += bPayroll;
    rent += bRent;
    depreciation += dep;
    for (const k of ['revenue', 'cogs', 'utilities', 'hosting', 'supplies', 'commission', 'marketing', 'inventoryPurchase', 'customers', 'capacity', 'demand'] as const) total[k] += r[k];
    total.notes.push(...r.notes);
  }
  // Marketing is one company-wide budget: every location benefits, it's paid once.
  total.marketing = total.marketing > 0 ? c.settings.marketingPerDay : 0;
  c.reputation = clamp(startRep + repDelta / c.branches.length, 0, 100);

  const n = c.branches.length;
  const where = n > 1 ? ` (${n} locations)` : '';
  transfer(state, WORLD, acct, total.revenue, 'revenue', `Daily sales${where}`);
  transfer(state, acct, WORLD, payroll, 'payroll', `Payroll (${c.employeeIds.length} staff)`);
  transfer(state, acct, WORLD, total.cogs && c.industry !== 'retail' ? total.cogs : 0, 'cogs', 'Cost of goods');
  transfer(state, acct, WORLD, total.inventoryPurchase, 'inventory', 'Inventory restock');
  transfer(state, acct, WORLD, total.marketing, 'marketing', 'Marketing');
  transfer(state, acct, WORLD, total.utilities, 'utilities', `Utilities & overhead${where}`);
  transfer(state, acct, WORLD, total.hosting, 'hosting', 'Cloud hosting');
  transfer(state, acct, WORLD, total.supplies, 'supplies', 'Supplies & operations');
  transfer(state, acct, WORLD, total.commission, 'commission', 'Agent commissions');

  const operating = total.utilities + total.hosting + total.supplies + total.commission;
  const expenses = total.cogs + payroll + rent + total.marketing + operating + depreciation;
  const profit = total.revenue - expenses;
  const cur = c.current;
  cur.revenue += total.revenue;
  cur.cogs += total.cogs;
  cur.payroll += payroll;
  cur.rent += rent;
  cur.marketing += total.marketing;
  cur.operating += operating;
  cur.depreciation += depreciation;
  cur.profit += profit;
  c.lifetime.revenue += total.revenue;
  c.lifetime.expenses += expenses;

  if (isPlayer) {
    for (const note of total.notes) {
      if (note.startsWith('shipped')) addNews(state, 'company', 'positive', `${c.name} ${note}`, 'The new release raises product quality and should improve growth and retention.', { companyId: c.id });
    }
  }

  // Funding / distress
  let cash = balance(state, acct);
  if (cash < 0 && !isPlayer) {
    // Independent owners cover their own shortfalls.
    transfer(state, WORLD, acct, -cash + Math.max(dollars(1000), payroll * 7), 'capital_injection', 'Owner funding');
    cash = balance(state, acct);
  }
  if (cash < 0 && c.settings.autoFund) {
    const need = -cash + Math.max(dollars(1000), payroll * 7);
    const available = Math.max(0, balance(state, PLAYER));
    const amt = Math.min(need, available);
    if (amt > 0) transfer(state, PLAYER, acct, amt, 'capital_injection', `Auto-funding ${c.name}`);
    cash = balance(state, acct);
  }
  if (cash < 0) {
    if (c.status !== 'distressed') {
      c.status = 'distressed';
      addNews(state, 'company', 'negative', `${c.name} cannot cover its bills`, 'The company is overdrawn. Staff morale and customer confidence are falling. Inject capital or cut costs before creditors force a closure.', { companyId: c.id });
    }
    c.distressDays++;
    if (c.distressDays >= 45) closeCompany(state, c.id, true);
  } else if (c.status === 'distressed') {
    c.status = 'operating';
    c.distressDays = 0;
    addNews(state, 'company', 'positive', `${c.name} back on solid footing`, 'The company is solvent again.', { companyId: c.id });
  }

  updateEmployees(state, c, c.status === 'distressed');

  c.history.push({ day: state.day, revenue: total.revenue, expenses, profit, cash: balance(state, acct), customers: total.customers });
  if (c.history.length > HISTORY_DAYS) c.history.shift();
}

/** Close the month's statement when the period rolls over. */
export function rollStatement(state: GameState, c: Company): void {
  const key = periodKey(state.day);
  if (c.current.period === key) return;
  c.statements.push(c.current);
  if (c.statements.length > 36) c.statements.shift();
  const s = c.current;
  if (c.owner === 'player' && c.status !== 'closed' && s.revenue > 0) {
    addNews(
      state,
      'company',
      s.profit >= 0 ? 'positive' : 'negative',
      `${c.name}: ${formatPeriod(s.period)} results`,
      `Revenue ${money(s.revenue)}, ${s.profit >= 0 ? 'profit' : 'loss'} of ${money(Math.abs(s.profit))}.`,
      { companyId: c.id },
    );
  }
  c.current = emptyStatement(key);
}

/** Weekly management by a hired manager (or your COO) when the player delegates. */
export function delegateWeekly(state: GameState, c: Company): string | null {
  if (c.owner !== 'player' || !c.settings.delegated || c.status === 'closed' || !hasManager(state, c)) return null;
  const levels: PriceLevel[] = ['budget', 'standard', 'premium', 'luxury'];
  const recent = c.history.slice(-7);
  const rev = recent.reduce((s, d) => s + d.revenue, 0) / Math.max(1, recent.length);
  let change: string | null = null;
  let demand = 0;
  let capacity = 0;
  for (const b of c.branches) {
    const o = b.ops;
    if (o.kind === 'hospitality') {
      demand += o.lastDemand;
      capacity += o.lastCapacity;
    } else if (o.kind === 'retail') {
      demand += o.lastDemand;
      capacity += o.lastCustomers || 1;
    } else if (o.kind === 'technology' && c.subtype === 'agency') {
      demand += o.utilization;
      capacity += 0.85;
    }
  }
  const i = levels.indexOf(c.settings.priceLevel);
  if (capacity > 0 && demand > capacity * 1.3 && i < 3) {
    c.settings.priceLevel = levels[i + 1];
    change = `raised prices to ${PRICE_LEVELS[levels[i + 1]].label}`;
  } else if (capacity > 0 && demand < capacity * 0.6 && i > 0) {
    c.settings.priceLevel = levels[i - 1];
    change = `lowered prices to ${PRICE_LEVELS[levels[i - 1]].label}`;
  }
  // Marketing at ~4% of revenue, rounded to $10.
  const targetMkt = Math.round((rev * 0.04) / 1000) * 1000;
  if (c.industry !== 'realestate') c.settings.marketingPerDay = clamp(targetMkt, 0, dollars(20000));
  if (c.industry === 'retail') {
    const econ = RETAIL_ECON[c.subtype as 'boutique' | 'convenience' | 'online'];
    const conv = c.subtype === 'online' ? 1 : econ.conversion;
    for (const b of c.branches) if (b.ops.kind === 'retail') b.stockTarget = Math.max(20, Math.round(b.ops.lastCustomers * conv * econ.unitsPerCustomer * 8));
  }
  return change;
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

/** Staff limit at one location, based on its size. */
export function maxStaffAt(state: GameState, c: Company, b: Branch): number {
  if (!b.locationId) return c.subtype === 'foodtruck' ? 4 : c.subtype === 'online' ? 8 : 6;
  const p = state.properties[b.locationId];
  return Math.max(4, Math.floor(p.sqft / (c.industry === 'hospitality' ? 180 : 150)));
}

/** Total staff limit across all locations. */
export function maxStaff(state: GameState, c: Company): number {
  return c.branches.reduce((s, b) => s + maxStaffAt(state, c, b), 0);
}

/** The location with the most free room (for hiring when no location is chosen). */
export function roomiestBranch(state: GameState, c: Company): Branch | null {
  let best: Branch | null = null;
  let bestRoom = 0;
  for (const b of c.branches) {
    const room = maxStaffAt(state, c, b) - branchStaffIds(state, c, b).length;
    if (room > bestRoom) {
      best = b;
      bestRoom = room;
    }
  }
  return best;
}

export function hireEmployee(state: GameState, companyId: string, candidateId: string, branchId?: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  const idx = c.candidates.findIndex((e) => e.id === candidateId);
  if (idx < 0) return fail('Candidate is no longer available.');
  const b = branchId ? findBranch(c, branchId) : roomiestBranch(state, c);
  if (!b) return fail(`${c.name} has no room for more staff. Open another location or move to a bigger one.`);
  if (branchStaffIds(state, c, b).length >= maxStaffAt(state, c, b)) return fail(`${branchLabel(state, c, b)} is full.`);
  const e = c.candidates[idx];
  c.candidates.splice(idx, 1);
  e.companyId = c.id;
  e.branchId = b.id;
  e.hiredDay = state.day;
  state.employees[e.id] = e;
  c.employeeIds.push(e.id);
  state.stats.hires++;
  return ok(`Hired ${e.name} as ${roleDef(c.subtype, e.role)?.title}${c.branches.length > 1 ? ` at ${branchLabel(state, c, b)}` : ''}.`, e.id);
}

export function transferEmployee(state: GameState, employeeId: string, branchId: string): ActionResult {
  const e = state.employees[employeeId];
  if (!e || !e.companyId) return fail('Employee not found.');
  const c = state.companies[e.companyId];
  const b = findBranch(c, branchId);
  if (!b) return fail('Location not found.');
  if (e.branchId === b.id) return fail(`${e.name} already works there.`);
  if (branchStaffIds(state, c, b).length >= maxStaffAt(state, c, b)) return fail(`${branchLabel(state, c, b)} is full.`);
  e.branchId = b.id;
  return ok(`${e.name} now works at ${branchLabel(state, c, b)}.`);
}

export function fireEmployee(state: GameState, employeeId: string): ActionResult {
  const e = state.employees[employeeId];
  if (!e || !e.companyId) return fail('Employee not found.');
  const c = state.companies[e.companyId];
  const severance = Math.round((e.salary / 52) * 2);
  transfer(state, companyAccount(c.id), WORLD, severance, 'severance', `Severance — ${e.name}`);
  c.employeeIds = c.employeeIds.filter((id) => id !== e.id);
  delete state.employees[e.id];
  for (const other of companyStaff(state, c)) other.loyalty = Math.max(0, other.loyalty - 2);
  return ok(`${e.name} let go with ${money(severance)} severance.`);
}

export function giveRaise(state: GameState, employeeId: string, pctRaise = 0.1): ActionResult {
  const e = state.employees[employeeId];
  if (!e) return fail('Employee not found.');
  e.salary = Math.round((e.salary * (1 + pctRaise)) / 50000) * 50000;
  e.loyalty = clamp(e.loyalty + 12, 0, 100);
  e.performance = clamp(e.performance + 4, 0, 100);
  return ok(`${e.name}'s salary raised to ${money(e.salary)} per year.`);
}

export function trainingCost(e: { skill: number }): Money {
  return dollars(1500 + e.skill * 60);
}

export function trainEmployee(state: GameState, employeeId: string): ActionResult {
  const e = state.employees[employeeId];
  if (!e || !e.companyId) return fail('Employee not found.');
  if (e.skill >= 95) return fail(`${e.name} is already at the top of their field.`);
  const cost = trainingCost(e);
  const c = state.companies[e.companyId];
  if (!payFromCompany(state, c, cost, 'training')) return fail(`Training costs ${money(cost)}; ${c.name} cannot afford it.`);
  transfer(state, companyAccount(c.id), WORLD, cost, 'training', `Training — ${e.name}`);
  const gain = e.skill < 50 ? 6 : e.skill < 75 ? 4 : 2;
  e.skill = Math.min(99, e.skill + gain);
  e.loyalty = clamp(e.loyalty + 5, 0, 100);
  return ok(`${e.name} completed training (+${gain} skill).`);
}

/* ------------------------------------------------------------------ */
/* Capital & settings                                                   */
/* ------------------------------------------------------------------ */

export function injectCapital(state: GameState, companyId: string, amount: Money): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  if (amount <= 0) return fail('Enter a positive amount.');
  if (balance(state, PLAYER) < amount) return fail('You do not have enough cash.');
  transfer(state, PLAYER, companyAccount(c.id), amount, 'capital_injection', `Capital injection into ${c.name}`);
  return ok(`Invested ${money(amount)} into ${c.name}.`);
}

export function withdrawDividend(state: GameState, companyId: string, amount: Money): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  if (amount <= 0) return fail('Enter a positive amount.');
  if (balance(state, companyAccount(c.id)) < amount) return fail(`${c.name} does not have that much cash.`);
  transfer(state, companyAccount(c.id), PLAYER, amount, 'dividend', `Dividend from ${c.name}`);
  return ok(`Withdrew ${money(amount)} from ${c.name}.`);
}

export function updateSettings(state: GameState, companyId: string, patch: Partial<Company['settings']>): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  if (patch.delegated && !hasManager(state, c)) return fail('Hire a manager (or an empire COO) before delegating operations.');
  if (patch.marketingPerDay !== undefined && (patch.marketingPerDay < 0 || patch.marketingPerDay > dollars(50000))) return fail('Marketing budget must be between $0 and $50,000 per day.');
  Object.assign(c.settings, patch);
  return ok('Settings updated.');
}

export function setStockTarget(state: GameState, companyId: string, branchId: string, units: number): ActionResult {
  const c = state.companies[companyId];
  const b = c ? findBranch(c, branchId) : undefined;
  if (!c || !b) return fail('Location not found.');
  if (!Number.isFinite(units) || units < 0 || units > 200000) return fail('Invalid stock target.');
  b.stockTarget = Math.round(units);
  return ok('Restock target updated.');
}

export function setOwnerOperated(state: GameState, companyId: string, on: boolean): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player' || c.status === 'closed') return fail('Company not found.');
  if (on) for (const o of playerCompanies(state, true)) o.ownerOperated = false;
  c.ownerOperated = on;
  return ok(on ? `You are now working day-to-day at ${c.name}.` : `You stepped back from daily work at ${c.name}.`);
}

export function renameCompany(state: GameState, companyId: string, name: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.owner !== 'player') return fail('Company not found.');
  const t = name.trim();
  if (t.length < 2 || t.length > 40) return fail('Name must be 2–40 characters.');
  c.name = t;
  return ok('Company renamed.');
}

/** Close a company: lay off staff, sell equipment at 25% of book, release locations, return cash to owner. */
export function closeCompany(state: GameState, companyId: string, forced = false, quiet = false): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status === 'closed') return fail('Company not found.');
  const acct = companyAccount(c.id);
  const ownerAcct = c.owner === 'player' ? PLAYER : WORLD;
  for (const e of companyStaff(state, c)) {
    transfer(state, acct, WORLD, Math.round((e.salary / 52) * 2), 'severance', `Severance — ${e.name}`);
    delete state.employees[e.id];
  }
  c.employeeIds = [];
  c.candidates = [];
  for (const b of c.branches) {
    transfer(state, WORLD, acct, Math.round(b.equipment * 0.25), 'equipment_sale', 'Equipment liquidation');
    b.equipment = 0;
    if (b.ops.kind === 'retail' && b.ops.inventory > 0) {
      transfer(state, WORLD, acct, Math.round(b.ops.inventory * b.ops.unitCost * 0.5), 'equipment_sale', 'Inventory liquidation');
      b.ops.inventory = 0;
    }
    release(state, c, b);
  }
  // Any company-owned properties revert to the player.
  for (const p of Object.values(state.properties)) if (p.owner === acct) p.owner = 'player';
  const cash = balance(state, acct);
  if (cash > 0) transfer(state, acct, ownerAcct, cash, 'dividend', `Final distribution from ${c.name}`);
  else if (cash < 0 && c.owner !== 'player') transfer(state, WORLD, acct, -cash, 'capital_injection', 'Owner settles debts');
  else if (cash < 0) {
    const pay = Math.min(-cash, Math.max(0, balance(state, PLAYER)));
    if (pay > 0) transfer(state, PLAYER, acct, pay, 'capital_injection', `Settling ${c.name}'s debts`);
    const rest = -balance(state, acct);
    if (rest > 0) {
      // Remaining creditor claims become a personal liability.
      transfer(state, WORLD, acct, rest, 'loan_proceeds', `Creditor settlement for ${c.name}`);
      state.counters.loan++;
      state.loans.push({ id: `l${state.counters.loan}`, lender: `${c.name} creditors`, kind: 'judgment', principal: rest, annualRate: 0.09, monthlyPayment: Math.max(dollars(250), Math.round(rest / 24)), originatedDay: state.day, missedPayments: 0 });
    }
  }
  c.status = 'closed';
  c.ownerOperated = false;
  c.settings.delegated = false;
  c.listing = null;
  if (!quiet) {
    addNews(
      state,
      'company',
      'negative',
      forced ? `${c.name} forced to close` : `${c.name} closes its doors`,
      forced ? 'After weeks unable to pay its bills, creditors forced the company to shut down. Remaining debts fall to the owner.' : 'The owner has wound down the business and liquidated its equipment.',
      { companyId: c.id },
    );
  }
  return ok(`${c.name} has been closed.`);
}

export function weeklyCandidateRefresh(state: GameState): void {
  for (const c of playerCompanies(state)) refreshCandidates(state, c);
}

/** Seeded employees for scenario and market companies, spread across locations. */
export function seedEmployees(state: GameState, c: Company, roles: { role: string; skill: [number, number] }[], branchId?: string): Employee[] {
  const out: Employee[] = [];
  for (const r of roles) {
    const e = generateEmployee(state, c, r.role, r.skill);
    e.companyId = c.id;
    e.branchId = branchId ?? c.branches[0].id;
    state.employees[e.id] = e;
    c.employeeIds.push(e.id);
    out.push(e);
  }
  return out;
}
