import { PRICE_LEVELS, RETAIL_ECON, roleDef, SUBTYPES } from '../../data/companies/industries';
import type { Company, CompanyOps, GameState, Money, PeriodStatement, PriceLevel, SubtypeId } from '../../types/core';
import { formatPeriod, periodKey } from '../../utils/date';
import { clamp, dollars, money } from '../../utils/format';
import { addNews } from '../events/news';
import { companyStaff, dailyPayroll, generateEmployee, hasManager, refreshCandidates, updateEmployees } from '../employees/employees';
import { balance, companyAccount, PLAYER, transfer, WORLD } from '../finance/ledger';
import { leaseRent } from '../properties/properties';
import { companyDailyRent, simulateIndustry } from './industryRules';

import { fail, ok, type ActionResult } from '../result';
export { fail, ok, type ActionResult };

export const HISTORY_DAYS = 180;
export const DEPRECIATION_RATE = 0.00055;

export function emptyStatement(period: string): PeriodStatement {
  return { period, revenue: 0, cogs: 0, payroll: 0, rent: 0, marketing: 0, operating: 0, depreciation: 0, profit: 0 };
}

function initialOps(subtype: SubtypeId): CompanyOps {
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

/** Cost breakdown and validation for founding a company. */
export function quoteFounding(state: GameState, plan: FoundingPlan): FoundingQuote {
  const sub = SUBTYPES[plan.subtype];
  const errors: string[] = [];
  const prop = plan.locationId ? state.properties[plan.locationId] : null;
  if (sub.mobile && plan.locationMode !== 'none') errors.push(`${sub.name} is mobile and cannot use a property.`);
  if (plan.locationMode === 'none' && !sub.locationOptional) errors.push(`${sub.name} needs a physical location.`);
  if (plan.locationMode !== 'none') {
    if (!prop) errors.push('Select a property.');
    else {
      if (!sub.propertyTypes.includes(prop.type)) errors.push(`${prop.name} (${prop.type}) is not suitable for a ${sub.name}.`);
      if (plan.locationMode === 'own' && prop.owner !== 'player' && !prop.owner.startsWith('co:')) errors.push('You do not own this property.');
      if (plan.locationMode === 'lease' && !prop.forLease) errors.push('This property is not available for lease.');
      if (prop.use.kind !== 'vacant') errors.push(`${prop.name} is already in use.`);
    }
  }
  const sqft = prop && plan.locationMode !== 'none' ? prop.sqft : 0;
  const homeBased = plan.locationMode === 'none' && !sub.mobile && sub.homeSetup !== undefined;
  const setup = dollars(homeBased ? sub.homeSetup! : sub.setupBase + sub.setupPerSqft * sqft);
  let inventory = 0;
  if (sub.industry === 'retail') {
    const econ = RETAIL_ECON[plan.subtype as 'boutique' | 'convenience' | 'online'];
    inventory = dollars(defaultStockTarget(plan.subtype, sqft || null) * econ.unitCost);
  }
  const monthlyRent = prop && plan.locationMode === 'lease' ? leaseRent(prop) : 0;
  const deposit = monthlyRent;
  const minimum = setup + inventory + deposit;
  const recommended = homeBased ? minimum + dollars(300) : minimum + Math.max(dollars(2000), monthlyRent * 2) + dollars(sub.industry === 'technology' ? 15000 : 5000);
  return { setup, inventory, deposit, monthlyRent, minimum, recommended, errors };
}

export function foundCompany(state: GameState, name: string, plan: FoundingPlan, capital: Money, opts: { silent?: boolean; fromScenario?: boolean } = {}): ActionResult {
  const trimmed = name.trim();
  if (trimmed.length < 2) return fail('Company name must be at least 2 characters.');
  if (trimmed.length > 40) return fail('Company name must be 40 characters or fewer.');
  if (Object.values(state.companies).some((c) => c.status !== 'closed' && c.name.toLowerCase() === trimmed.toLowerCase())) return fail('You already have a company with that name.');
  const q = quoteFounding(state, plan);
  if (q.errors.length) return fail(q.errors[0]);
  if (!opts.fromScenario && capital < q.minimum) return fail(`Starting capital must be at least ${money(q.minimum)}.`);
  if (!opts.fromScenario && balance(state, PLAYER) < capital) return fail(`You need ${money(capital)} in cash to fund this company.`);

  state.counters.company++;
  const id = `c${state.counters.company}`;
  const sub = SUBTYPES[plan.subtype];
  const prop = plan.locationId ? state.properties[plan.locationId] : null;
  const company: Company = {
    id,
    name: trimmed,
    industry: sub.industry,
    subtype: plan.subtype,
    owner: 'player',
    foundedDay: state.day,
    locationId: plan.locationMode === 'none' ? null : plan.locationId,
    status: 'operating',
    ownerOperated: false,
    reputation: clamp(Math.round(10 + state.player.reputation * 0.5), 5, 60),
    equipment: q.setup,
    startingCapital: capital,
    settings: {
      priceLevel: 'standard',
      marketingPerDay: 0,
      autoFund: true,
      delegated: false,
      stockTarget: defaultStockTarget(plan.subtype, prop && plan.locationMode !== 'none' ? prop.sqft : null),
    },
    ops: initialOps(plan.subtype),
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
  transfer(state, opts.fromScenario ? WORLD : PLAYER, acct, capital, opts.fromScenario ? 'starting_capital' : 'capital_injection', `Founding capital for ${trimmed}`);
  transfer(state, acct, WORLD, q.setup, 'setup', `${sub.name} setup & equipment`);
  if (company.ops.kind === 'retail' && q.inventory > 0) {
    company.ops.inventory = company.settings.stockTarget;
    transfer(state, acct, WORLD, q.inventory, 'inventory', 'Opening inventory');
  }
  if (prop && plan.locationMode !== 'none') {
    prop.use = { kind: 'company', companyId: id };
    if (plan.locationMode === 'lease') {
      const landlord = prop.owner === 'private' ? WORLD : prop.owner;
      prop.lease = { companyId: id, monthlyRent: q.monthlyRent, sinceDay: state.day };
      prop.forLease = false;
      transfer(state, acct, landlord, q.deposit, 'rent', `Lease deposit — ${prop.name}`);
    }
  }
  // Owner-operator by default if the player isn't already operating another company.
  if (!Object.values(state.companies).some((c) => c.id !== id && c.ownerOperated && c.status !== 'closed')) company.ownerOperated = true;
  refreshCandidates(state, company);
  state.stats.companiesFounded++;
  if (!opts.silent) {
    addNews(state, 'company', 'positive', `${trimmed} opens for business`, `A new ${sub.name.toLowerCase()} has launched${prop && plan.locationMode !== 'none' ? ` at ${prop.name}` : ''} with ${money(capital)} in starting capital.`, { companyId: id });
  }
  return ok(`${trimmed} founded.`, id);
}

/* ------------------------------------------------------------------ */
/* Daily operations                                                    */
/* ------------------------------------------------------------------ */

export function simulateCompanyDay(state: GameState, c: Company): void {
  if (c.status === 'closed') return;
  const acct = companyAccount(c.id);
  const r = simulateIndustry(state, c);
  const payroll = dailyPayroll(state, c);
  const rent = companyDailyRent(state, c);
  const depreciation = Math.round(c.equipment * DEPRECIATION_RATE);
  c.equipment -= depreciation;

  const prop = c.locationId ? state.properties[c.locationId] : null;
  const landlord = prop?.lease ? (prop.owner === 'private' ? WORLD : prop.owner) : WORLD;

  transfer(state, WORLD, acct, r.revenue, 'revenue', 'Daily sales');
  transfer(state, acct, WORLD, payroll, 'payroll', `Payroll (${c.employeeIds.length} staff)`);
  transfer(state, acct, landlord, rent, 'rent', prop ? `Lease — ${prop.name}` : 'Lease');
  transfer(state, acct, WORLD, r.cogs && c.ops.kind !== 'retail' ? r.cogs : 0, 'cogs', 'Cost of goods');
  transfer(state, acct, WORLD, r.inventoryPurchase, 'inventory', 'Inventory restock');
  transfer(state, acct, WORLD, r.marketing, 'marketing', 'Marketing');
  transfer(state, acct, WORLD, r.utilities, 'utilities', 'Utilities & overhead');
  transfer(state, acct, WORLD, r.hosting, 'hosting', 'Cloud hosting');
  transfer(state, acct, WORLD, r.supplies, 'supplies', 'Supplies & operations');
  transfer(state, acct, WORLD, r.commission, 'commission', 'Agent commissions');

  const operating = r.utilities + r.hosting + r.supplies + r.commission;
  const expenses = r.cogs + payroll + rent + r.marketing + operating + depreciation;
  const profit = r.revenue - expenses;
  const cur = c.current;
  cur.revenue += r.revenue;
  cur.cogs += r.cogs;
  cur.payroll += payroll;
  cur.rent += rent;
  cur.marketing += r.marketing;
  cur.operating += operating;
  cur.depreciation += depreciation;
  cur.profit += profit;
  c.lifetime.revenue += r.revenue;
  c.lifetime.expenses += expenses;

  for (const note of r.notes) {
    if (note.startsWith('shipped')) addNews(state, 'company', 'positive', `${c.name} ${note}`, 'The new release raises product quality and should improve growth and retention.', { companyId: c.id });
  }

  // Funding / distress
  let cash = balance(state, acct);
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

  c.history.push({ day: state.day, revenue: r.revenue, expenses, profit, cash: balance(state, acct), customers: r.customers });
  if (c.history.length > HISTORY_DAYS) c.history.shift();
}

/** Close the month's statement when the period rolls over. */
export function rollStatement(state: GameState, c: Company): void {
  const key = periodKey(state.day);
  if (c.current.period === key) return;
  c.statements.push(c.current);
  if (c.statements.length > 36) c.statements.shift();
  const s = c.current;
  if (c.status !== 'closed' && s.revenue > 0) {
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

/** Weekly management by a hired manager when the player delegates. */
export function delegateWeekly(state: GameState, c: Company): string | null {
  if (!c.settings.delegated || c.status === 'closed' || !hasManager(state, c)) return null;
  const levels: PriceLevel[] = ['budget', 'standard', 'premium', 'luxury'];
  const recent = c.history.slice(-7);
  const rev = recent.reduce((s, d) => s + d.revenue, 0) / Math.max(1, recent.length);
  let change: string | null = null;
  let demand = 0;
  let capacity = 0;
  if (c.ops.kind === 'hospitality') {
    demand = c.ops.lastDemand;
    capacity = c.ops.lastCapacity;
  } else if (c.ops.kind === 'retail') {
    demand = c.ops.lastDemand;
    capacity = c.ops.lastCustomers || 1;
  } else if (c.ops.kind === 'technology' && c.subtype === 'agency') {
    demand = c.ops.utilization;
    capacity = 0.85;
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
  if (c.ops.kind === 'retail') {
    const unitsPerDay = recent.length ? recent.reduce((s, d) => s + d.customers, 0) / recent.length : 0;
    const econ = RETAIL_ECON[c.subtype as 'boutique' | 'convenience' | 'online'];
    const conv = c.subtype === 'online' ? 1 : econ.conversion;
    c.settings.stockTarget = Math.max(20, Math.round(unitsPerDay * conv * econ.unitsPerCustomer * 8));
  }
  return change;
}

/* ------------------------------------------------------------------ */
/* Player actions                                                      */
/* ------------------------------------------------------------------ */

export function hireEmployee(state: GameState, companyId: string, candidateId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status === 'closed') return fail('Company not found.');
  const idx = c.candidates.findIndex((e) => e.id === candidateId);
  if (idx < 0) return fail('Candidate is no longer available.');
  if (c.employeeIds.length >= maxStaff(state, c)) return fail(`${c.name} has no room for more staff at its current location.`);
  const e = c.candidates[idx];
  c.candidates.splice(idx, 1);
  e.companyId = c.id;
  e.hiredDay = state.day;
  state.employees[e.id] = e;
  c.employeeIds.push(e.id);
  state.stats.hires++;
  return ok(`Hired ${e.name} as ${roleDef(c.subtype, e.role)?.title}.`, e.id);
}

/** Staff limit based on location size. */
export function maxStaff(state: GameState, c: Company): number {
  if (!c.locationId) return c.subtype === 'foodtruck' ? 4 : c.subtype === 'online' ? 8 : 6;
  const p = state.properties[c.locationId];
  return Math.max(4, Math.floor(p.sqft / (c.industry === 'hospitality' ? 180 : 150)));
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
  const acct = companyAccount(e.companyId);
  const c = state.companies[e.companyId];
  if (balance(state, acct) < cost && !(c.settings.autoFund && balance(state, PLAYER) >= cost)) return fail(`Training costs ${money(cost)}; ${c.name} cannot afford it.`);
  if (balance(state, acct) < cost) transfer(state, PLAYER, acct, cost - balance(state, acct), 'capital_injection', `Funding training at ${c.name}`);
  transfer(state, acct, WORLD, cost, 'training', `Training — ${e.name}`);
  const gain = e.skill < 50 ? 6 : e.skill < 75 ? 4 : 2;
  e.skill = Math.min(99, e.skill + gain);
  e.loyalty = clamp(e.loyalty + 5, 0, 100);
  return ok(`${e.name} completed training (+${gain} skill).`);
}

export function injectCapital(state: GameState, companyId: string, amount: Money): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status === 'closed') return fail('Company not found.');
  if (amount <= 0) return fail('Enter a positive amount.');
  if (balance(state, PLAYER) < amount) return fail('You do not have enough cash.');
  transfer(state, PLAYER, companyAccount(c.id), amount, 'capital_injection', `Capital injection into ${c.name}`);
  return ok(`Invested ${money(amount)} into ${c.name}.`);
}

export function withdrawDividend(state: GameState, companyId: string, amount: Money): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status === 'closed') return fail('Company not found.');
  if (amount <= 0) return fail('Enter a positive amount.');
  if (balance(state, companyAccount(c.id)) < amount) return fail(`${c.name} does not have that much cash.`);
  transfer(state, companyAccount(c.id), PLAYER, amount, 'dividend', `Dividend from ${c.name}`);
  return ok(`Withdrew ${money(amount)} from ${c.name}.`);
}

export function updateSettings(state: GameState, companyId: string, patch: Partial<Company['settings']>): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status === 'closed') return fail('Company not found.');
  if (patch.delegated && !hasManager(state, c)) return fail('Hire a manager before delegating operations.');
  if (patch.marketingPerDay !== undefined && (patch.marketingPerDay < 0 || patch.marketingPerDay > dollars(50000))) return fail('Marketing budget must be between $0 and $50,000 per day.');
  if (patch.stockTarget !== undefined && (patch.stockTarget < 0 || patch.stockTarget > 200000)) return fail('Invalid stock target.');
  Object.assign(c.settings, patch);
  return ok('Settings updated.');
}

export function setOwnerOperated(state: GameState, companyId: string, on: boolean): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status === 'closed') return fail('Company not found.');
  if (on) for (const o of Object.values(state.companies)) o.ownerOperated = false;
  c.ownerOperated = on;
  return ok(on ? `You are now working day-to-day at ${c.name}.` : `You stepped back from daily work at ${c.name}.`);
}

export function renameCompany(state: GameState, companyId: string, name: string): ActionResult {
  const c = state.companies[companyId];
  if (!c) return fail('Company not found.');
  const t = name.trim();
  if (t.length < 2 || t.length > 40) return fail('Name must be 2–40 characters.');
  c.name = t;
  return ok('Company renamed.');
}

/** Close a company: lay off staff, sell equipment at 25% of book, release location, return cash to owner. */
export function closeCompany(state: GameState, companyId: string, forced = false): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status === 'closed') return fail('Company not found.');
  const acct = companyAccount(c.id);
  for (const e of companyStaff(state, c)) {
    transfer(state, acct, WORLD, Math.round((e.salary / 52) * 2), 'severance', `Severance — ${e.name}`);
    delete state.employees[e.id];
  }
  c.employeeIds = [];
  c.candidates = [];
  const salvage = Math.round(c.equipment * 0.25);
  transfer(state, WORLD, acct, salvage, 'equipment_sale', 'Equipment liquidation');
  c.equipment = 0;
  if (c.ops.kind === 'retail' && c.ops.inventory > 0) {
    transfer(state, WORLD, acct, Math.round(c.ops.inventory * c.ops.unitCost * 0.5), 'equipment_sale', 'Inventory liquidation');
    c.ops.inventory = 0;
  }
  if (c.locationId) {
    const p = state.properties[c.locationId];
    if (p) {
      p.use = { kind: 'vacant' };
      if (p.lease?.companyId === c.id) {
        p.lease = null;
        p.forLease = p.owner === 'private' || p.owner.startsWith('rival:');
      }
    }
  }
  // Any company-owned properties revert to the player.
  for (const p of Object.values(state.properties)) if (p.owner === acct) p.owner = 'player';
  const cash = balance(state, acct);
  if (cash > 0) transfer(state, acct, PLAYER, cash, 'dividend', `Final distribution from ${c.name}`);
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
  addNews(
    state,
    'company',
    'negative',
    forced ? `${c.name} forced to close` : `${c.name} closes its doors`,
    forced ? 'After weeks unable to pay its bills, creditors forced the company to shut down. Remaining debts fall to the owner.' : 'The owner has wound down the business and liquidated its equipment.',
    { companyId: c.id },
  );
  return ok(`${c.name} has been closed.`);
}

export function weeklyCandidateRefresh(state: GameState): void {
  for (const c of Object.values(state.companies)) if (c.status !== 'closed') refreshCandidates(state, c);
}

/** Seeded employees for scenario companies. */
export function seedEmployees(state: GameState, c: Company, roles: { role: string; skill: [number, number] }[]): void {
  for (const r of roles) {
    const e = generateEmployee(state, c, r.role, r.skill);
    e.companyId = c.id;
    state.employees[e.id] = e;
    c.employeeIds.push(e.id);
  }
}
