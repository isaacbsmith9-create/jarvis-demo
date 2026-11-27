import { INDUSTRIES } from '../../data/companies/industries';
import type { Company, GameState, Money } from '../../types/core';
import { companyEquipment } from '../companies/units';
import { rivalValuation } from '../competitors/investments';
import { balance, companyAccount, orgAccount, PLAYER } from './ledger';

export const OWNER_SALARY = 6500000;

export function companyInventoryValue(c: Company): Money {
  let s = 0;
  for (const b of c.branches) if (b.ops.kind === 'retail') s += Math.round(b.ops.inventory * b.ops.unitCost);
  return s;
}

export function companyPropertyValue(state: GameState, c: Company): Money {
  let s = 0;
  for (const p of Object.values(state.properties)) if (p.owner === companyAccount(c.id)) s += p.value;
  return s;
}

/** Trailing 30-day profit annualized. */
export function annualizedProfit(c: Company): Money {
  const recent = c.history.slice(-30);
  if (!recent.length) return 0;
  const p = recent.reduce((s, d) => s + d.profit, 0);
  return Math.round((p / recent.length) * 365);
}

export function annualizedRevenue(c: Company): Money {
  const recent = c.history.slice(-30);
  if (!recent.length) return 0;
  return Math.round((recent.reduce((s, d) => s + d.revenue, 0) / recent.length) * 365);
}

export interface CompanyValuation {
  cash: Money;
  equipment: Money;
  inventory: Money;
  properties: Money;
  book: Money;
  goodwill: Money;
  total: Money;
}

/**
 * Valuation = book value (cash + equipment + inventory + properties) + goodwill.
 * Goodwill is earned only by profitable companies (earnings multiple), with a small
 * revenue-based component for fast-growing businesses, and needs 30 days of history.
 */
export function valueCompany(state: GameState, c: Company): CompanyValuation {
  const cash = balance(state, companyAccount(c.id));
  const equipment = companyEquipment(c);
  const inventory = companyInventoryValue(c);
  const properties = companyPropertyValue(state, c);
  const book = cash + equipment + inventory + properties;
  let goodwill = 0;
  // A solo, owner-run practice with no staff has no transferable goodwill.
  if (c.status !== 'closed' && c.history.length >= 14 && c.employeeIds.length > 0) {
    const ind = INDUSTRIES[c.industry];
    // An owner-operated business is worth less without its owner: deduct an imputed manager salary.
    const prof = annualizedProfit(c) - (c.ownerOperated ? OWNER_SALARY : 0);
    const rev = annualizedRevenue(c);
    // Goodwill phases in over the first 120 days of track record.
    const track = Math.min(1, Math.max(0, state.day - c.foundedDay) / 120);
    if (prof > 0) goodwill = Math.round((prof * ind.earningsMultiple + rev * ind.revenueMultiple * 0.03) * track);
    if (c.status === 'distressed') goodwill = 0;
  }
  return { cash, equipment, inventory, properties, book, goodwill, total: book + goodwill };
}

export interface BalanceSheet {
  cash: Money;
  companyEquity: Money;
  /** Market value of your stakes in rival companies. */
  investments: Money;
  properties: Money;
  organization: Money;
  totalAssets: Money;
  loans: Money;
  totalLiabilities: Money;
  netWorth: Money;
}

export function balanceSheet(state: GameState): BalanceSheet {
  const cash = balance(state, PLAYER);
  let companyEquity = 0;
  for (const c of Object.values(state.companies)) if (c.owner === 'player' && c.status !== 'closed') companyEquity += valueCompany(state, c).total;
  let investments = 0;
  for (const r of Object.values(state.rivals)) if (r.playerStake > 0) investments += Math.round(rivalValuation(state, r) * r.playerStake);
  let properties = 0;
  for (const p of Object.values(state.properties)) if (p.owner === 'player') properties += p.value;
  let organization = 0;
  for (const o of Object.values(state.organizations)) if (o.controlledBy === 'player') organization += balance(state, orgAccount(o.id));
  const loans = state.loans.reduce((s, l) => s + l.principal, 0);
  const totalAssets = cash + companyEquity + investments + properties + organization;
  return { cash, companyEquity, investments, properties, organization, totalAssets, loans, totalLiabilities: loans, netWorth: totalAssets - loans };
}

export function netWorth(state: GameState): Money {
  return balanceSheet(state).netWorth;
}

/** Total monthly debt service. */
export function monthlyDebtService(state: GameState): Money {
  return state.loans.reduce((s, l) => s + Math.min(l.monthlyPayment, l.principal + Math.round((l.principal * l.annualRate) / 12)), 0);
}
