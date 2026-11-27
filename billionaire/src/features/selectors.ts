/** Derived, read-only views over GameState used by the interface. */
import { roleDef, SUBTYPES } from '../data/companies/industries';
import { roleUnits } from '../simulation/employees/employees';
import { branchLabel, unitFor } from '../simulation/companies/units';
import { isPlayerAccount } from '../simulation/finance/ledger';
import { monthlyDebtService } from '../simulation/finance/valuation';
import { playerOrganization } from '../simulation/organizations/organizations';
import type { GameState, Money, TxCategory } from '../types/core';
import { formatShortDate } from '../utils/date';
import { money } from '../utils/format';

/** Investment and financing flows: excluded from the operating view (inventory restocking stays in, as an operating cash cost). */
const CAPITAL: TxCategory[] = ['starting_capital', 'property_purchase', 'property_sale', 'loan_proceeds', 'loan_principal', 'setup', 'renovation', 'capital_injection', 'dividend'];

export interface DailyFlow {
  day: number;
  income: Money;
  expenses: Money;
  net: Money;
}

/** Empire-wide operating income vs expenses per day, from the ledger (external flows only). */
export function empireDailyFlows(state: GameState, days = 60): DailyFlow[] {
  const from = state.day - days + 1;
  const map = new Map<number, DailyFlow>();
  for (let d = Math.max(0, from); d <= state.day; d++) map.set(d, { day: d, income: 0, expenses: 0, net: 0 });
  const owned = new Map<string, boolean>();
  const mine = (a: string) => {
    let v = owned.get(a);
    if (v === undefined) owned.set(a, (v = isPlayerAccount(state, a)));
    return v;
  };
  for (let i = state.ledger.entries.length - 1; i >= 0; i--) {
    const tx = state.ledger.entries[i];
    if (tx.day < from) break;
    if (CAPITAL.includes(tx.category)) continue;
    const toMine = mine(tx.to);
    const fromMine = mine(tx.from);
    if (toMine === fromMine) continue; // internal transfer or unrelated
    const f = map.get(tx.day);
    if (!f) continue;
    if (toMine) f.income += tx.amount;
    else f.expenses += tx.amount;
  }
  const out = [...map.values()];
  for (const f of out) f.net = f.income - f.expenses;
  return out;
}

export function sumFlows(flows: DailyFlow[], n: number) {
  const s = flows.slice(-n);
  return {
    income: s.reduce((a, f) => a + f.income, 0),
    expenses: s.reduce((a, f) => a + f.expenses, 0),
    net: s.reduce((a, f) => a + f.net, 0),
  };
}

export function flowLabels(flows: { day: number }[]): string[] {
  return flows.map((f) => formatShortDate(f.day));
}

export interface Alert {
  level: 'neg' | 'warn';
  text: string;
  companyId?: string;
  propertyId?: string;
  view?: 'finance' | 'organization' | 'staff';
}

export function alerts(state: GameState): Alert[] {
  const out: Alert[] = [];
  for (const c of Object.values(state.companies)) {
    if (c.status === 'closed' || c.owner !== 'player') continue;
    if (c.status === 'distressed') out.push({ level: 'neg', text: `${c.name} is overdrawn (${45 - c.distressDays} days until forced closure).`, companyId: c.id });
    const sub = SUBTYPES[c.subtype];
    for (const b of c.branches) {
      const unit = unitFor(state, c, b);
      const where = c.branches.length > 1 ? ` at ${branchLabel(state, c, b)}` : '';
      if (roleUnits(state, unit, sub.primaryRole) === 0) out.push({ level: 'neg', text: `${c.name}${where} has no ${roleDef(c.subtype, sub.primaryRole)?.title} and cannot operate.`, companyId: c.id });
      if (b.ops.kind === 'retail' && b.ops.inventory < 5 && b.stockTarget > 0) out.push({ level: 'warn', text: `${c.name}${where} is out of stock.`, companyId: c.id });
      if (b.ops.kind === 'hospitality' && b.ops.lastCapacity > 0 && b.ops.lastDemand > b.ops.lastCapacity * 1.5) out.push({ level: 'warn', text: `${c.name}${where} is turning customers away: demand far exceeds capacity. Hire staff or raise prices.`, companyId: c.id });
    }
  }
  const flight = Object.values(state.employees).filter((e) => e.companyId && state.companies[e.companyId]?.owner === 'player' && e.loyalty < 30);
  if (flight.length) out.push({ level: 'warn', text: `${flight.length} employee${flight.length > 1 ? 's are' : ' is'} a flight risk (loyalty under 30).`, view: 'staff' });
  const debt = monthlyDebtService(state);
  if (debt > 0 && (state.balances.player ?? 0) < debt) out.push({ level: 'neg', text: `Next month's debt payments (${money(debt)}) exceed your personal cash. Withdraw from a company or the loan will be missed.`, view: 'finance' });
  const missed = state.loans.filter((l) => l.missedPayments > 0);
  if (missed.length) out.push({ level: 'neg', text: `${missed.length} loan${missed.length > 1 ? 's are' : ' is'} behind on payments.`, view: 'finance' });
  const vacant = Object.values(state.properties).filter((p) => (p.owner === 'player' || p.owner.startsWith('co:')) && p.use.kind === 'vacant');
  for (const p of vacant) out.push({ level: 'warn', text: `${p.name} is vacant and earning nothing.`, propertyId: p.id });
  const org = playerOrganization(state);
  if (org && org.situations.length) out.push({ level: 'warn', text: `${org.name}: ${org.situations.length} decision${org.situations.length > 1 ? 's' : ''} waiting.`, view: 'organization' });
  if (org) for (const n of Object.values(state.organizations)) if (n.controlledBy === 'npc' && (org.relations[n.id] ?? 0) <= -50 && !org.pacts[n.id]) out.push({ level: 'neg', text: `Open conflict with ${n.name}. Expect them to push into your turf.`, view: 'organization' });
  if (org && org.investigation > 70) out.push({ level: 'neg', text: `The case against ${org.name} is ${Math.round(org.investigation)}% complete. A raid comes at 100%.`, view: 'organization' });
  if (org && org.heat > 65) out.push({ level: 'neg', text: `${org.name} heat is ${Math.round(org.heat)}. Investigations become likely above 70.`, view: 'organization' });
  return out;
}
