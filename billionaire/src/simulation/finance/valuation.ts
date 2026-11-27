import { INDUSTRIES } from '../../data/companies/industries';
import type { Company, GameState, Money } from '../../types/core';
import { balance, companyAccount, orgAccount, PLAYER } from './ledger';

export const OWNER_SALARY = 6500000;

export function companyInventoryValue(c: Company): Money {
  return c.ops.kind === 'retail' ? Math.round(c.ops.inventory * c.ops.unitCost) : 0;
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
  const equipment = c.equipment;
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
  for (const c of Object.values(state.companies)) if (c.status !== 'closed') companyEquity += valueCompany(state, c).total;
  let properties = 0;
  for (const p of Object.values(state.properties)) if (p.owner === 'player') properties += p.value;
  let organization = 0;
  for (const o of Object.values(state.organizations)) if (o.controlledBy === 'player') organization += balance(state, orgAccount(o.id));
  const loans = state.loans.reduce((s, l) => s + l.principal, 0);
  const totalAssets = cash + companyEquity + properties + organization;
  return { cash, companyEquity, properties, organization, totalAssets, loans, totalLiabilities: loans, netWorth: totalAssets - loans };
}

export function netWorth(state: GameState): Money {
  return balanceSheet(state).netWorth;
}

/** Total monthly debt service. */
export function monthlyDebtService(state: GameState): Money {
  return state.loans.reduce((s, l) => s + Math.min(l.monthlyPayment, l.principal + Math.round((l.principal * l.annualRate) / 12)), 0);
}
