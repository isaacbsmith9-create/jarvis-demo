import type { GameState, Loan, Money } from '../../types/core';
import { clamp, dollars, money } from '../../utils/format';
import { fail, ok, type ActionResult } from '../result';
import { addNews } from '../events/news';
import { balance, PLAYER, transfer, WORLD } from './ledger';
import { balanceSheet } from './valuation';

export const BANK_NAME = 'Biscayne National Bank';

export interface CreditOffer {
  available: boolean;
  maxAmount: Money;
  annualRate: number;
  termMonths: number;
  reason: string;
}

/** Bank credit depends on reputation, collateral (property) and existing debt. */
export function creditOffer(state: GameState): CreditOffer {
  const rep = state.player.reputation;
  const bs = balanceSheet(state);
  const termMonths = 60;
  if (rep < 10) return { available: false, maxAmount: 0, annualRate: 0, termMonths, reason: 'Your business reputation is too low for bank credit (needs 10+).' };
  if (state.loans.some((l) => l.missedPayments > 0)) return { available: false, maxAmount: 0, annualRate: 0, termMonths, reason: 'You have missed loan payments. Banks will not lend until you are current.' };
  const collateral = bs.properties * 0.6 + bs.companyEquity * 0.25 + Math.max(0, bs.cash) * 0.3;
  const capacity = Math.max(0, collateral - bs.loans);
  const maxAmount = Math.floor(capacity / 100000) * 100000;
  const annualRate = clamp(state.economy.interestRate + 0.02 + (60 - rep) * 0.0008, 0.04, 0.2);
  if (maxAmount < dollars(1000)) return { available: false, maxAmount: 0, annualRate, termMonths, reason: 'Not enough collateral. Banks lend against property, company equity and cash.' };
  return { available: true, maxAmount, annualRate, termMonths, reason: `Secured against your assets at ${(annualRate * 100).toFixed(2)}% APR.` };
}

export function amortizedPayment(principal: Money, annualRate: number, months: number): Money {
  const r = annualRate / 12;
  if (r === 0) return Math.round(principal / months);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
}

export function takeLoan(state: GameState, amount: Money): ActionResult {
  const offer = creditOffer(state);
  if (!offer.available) return fail(offer.reason);
  if (amount <= 0) return fail('Enter a positive amount.');
  if (amount > offer.maxAmount) return fail(`The bank will lend at most ${money(offer.maxAmount)}.`);
  state.counters.loan++;
  const loan: Loan = {
    id: `l${state.counters.loan}`,
    lender: BANK_NAME,
    kind: 'bank',
    principal: amount,
    annualRate: offer.annualRate,
    monthlyPayment: amortizedPayment(amount, offer.annualRate, offer.termMonths),
    originatedDay: state.day,
    missedPayments: 0,
  };
  state.loans.push(loan);
  transfer(state, WORLD, PLAYER, amount, 'loan_proceeds', `Loan from ${BANK_NAME}`);
  return ok(`Borrowed ${money(amount)} at ${(offer.annualRate * 100).toFixed(2)}%. Monthly payment ${money(loan.monthlyPayment)}.`);
}

export function repayLoan(state: GameState, loanId: string, amount: Money): ActionResult {
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) return fail('Loan not found.');
  const amt = Math.min(amount, loan.principal);
  if (amt <= 0) return fail('Enter a positive amount.');
  if (balance(state, PLAYER) < amt) return fail('Not enough cash.');
  transfer(state, PLAYER, WORLD, amt, 'loan_principal', `Early repayment — ${loan.lender}`);
  loan.principal -= amt;
  if (loan.principal <= 0) {
    state.loans = state.loans.filter((l) => l.id !== loan.id);
    addNews(state, 'finance', 'positive', `Loan from ${loan.lender} paid off`, 'The debt has been fully repaid.');
    return ok(`Paid off the ${loan.lender} loan.`);
  }
  return ok(`Repaid ${money(amt)}. Remaining balance ${money(loan.principal)}.`);
}

/** Monthly debt service on the 1st of each month. */
export function serviceLoans(state: GameState): void {
  for (const loan of [...state.loans]) {
    const interest = Math.round((loan.principal * loan.annualRate) / 12);
    const due = Math.min(loan.monthlyPayment, loan.principal + interest);
    const cash = balance(state, PLAYER);
    if (cash >= due) {
      transfer(state, PLAYER, WORLD, interest, 'loan_interest', `Interest — ${loan.lender}`);
      transfer(state, PLAYER, WORLD, due - interest, 'loan_principal', `Principal — ${loan.lender}`);
      loan.principal -= due - interest;
      loan.missedPayments = 0;
      if (loan.principal <= 0) {
        state.loans = state.loans.filter((l) => l.id !== loan.id);
        addNews(state, 'finance', 'positive', `Loan from ${loan.lender} paid off`, 'The final payment has been made.');
      }
    } else {
      // Missed payment: interest capitalizes plus a late fee; reputation suffers.
      loan.principal += interest + Math.round(due * 0.05);
      loan.missedPayments++;
      state.player.reputation = clamp(state.player.reputation - 4, 0, 100);
      addNews(state, 'finance', 'negative', `Missed payment to ${loan.lender}`, `You could not cover the ${money(due)} payment. Interest and a late fee were added to the balance and your reputation took a hit.`);
    }
  }
}
