import type { AccountId, GameState, Money, Transaction, TxCategory } from '../../types/core';

/** Rolling window of ledger entries kept in the save. Older entries are summarized, never lost. */
export const LEDGER_WINDOW = 6000;

/** The "world" account represents everyone outside the simulation (customers, suppliers, banks). */
export const WORLD: AccountId = 'world';
export const PLAYER: AccountId = 'player';

export const companyAccount = (id: string): AccountId => `co:${id}`;
export const rivalAccount = (id: string): AccountId => `rival:${id}`;
export const orgAccount = (id: string): AccountId => `org:${id}`;

export function balance(state: GameState, account: AccountId): Money {
  if (account === WORLD) return 0;
  return state.balances[account] ?? 0;
}

/**
 * The ONLY function allowed to move money. Every movement is recorded in the ledger
 * and is double-entry: what leaves one account arrives in another.
 * Returns the transaction, or null for zero amounts.
 */
export function transfer(
  state: GameState,
  from: AccountId,
  to: AccountId,
  amount: Money,
  category: TxCategory,
  memo: string,
): Transaction | null {
  if (!Number.isFinite(amount)) throw new Error(`Invalid transfer amount: ${amount}`);
  const amt = Math.round(amount);
  if (amt === 0) return null;
  if (amt < 0) return transfer(state, to, from, -amt, category, memo);
  if (from === to) return null;
  if (from !== WORLD) state.balances[from] = (state.balances[from] ?? 0) - amt;
  if (to !== WORLD) state.balances[to] = (state.balances[to] ?? 0) + amt;
  const tx: Transaction = { id: state.ledger.nextId++, day: state.day, from, to, amount: amt, category, memo };
  state.ledger.entries.push(tx);
  if (state.ledger.entries.length > LEDGER_WINDOW + 500) trimLedger(state);
  return tx;
}

function trimLedger(state: GameState): void {
  const excess = state.ledger.entries.length - LEDGER_WINDOW;
  if (excess <= 0) return;
  const removed = state.ledger.entries.splice(0, excess);
  const arch = state.ledger.archived;
  for (const tx of removed) {
    arch.count++;
    arch.byCategory[tx.category] = (arch.byCategory[tx.category] ?? 0) + tx.amount;
  }
}

/** Can the account afford a payment? */
export function canAfford(state: GameState, account: AccountId, amount: Money): boolean {
  return balance(state, account) >= amount;
}

/** Net change in an account across ledger entries (within the rolling window). */
export function accountFlow(entries: Transaction[], account: AccountId): Money {
  let s = 0;
  for (const tx of entries) {
    if (tx.to === account) s += tx.amount;
    if (tx.from === account) s -= tx.amount;
  }
  return s;
}

export function isPlayerAccount(state: GameState, account: AccountId): boolean {
  if (account === PLAYER) return true;
  if (account.startsWith('co:')) return !!state.companies[account.slice(3)];
  if (account.startsWith('org:')) return state.organizations[account.slice(4)]?.controlledBy === 'player';
  return false;
}

export function accountLabel(state: GameState, account: AccountId): string {
  if (account === PLAYER) return state.player.name || 'You';
  if (account === WORLD) return 'External';
  if (account.startsWith('co:')) return state.companies[account.slice(3)]?.name ?? 'Closed company';
  if (account.startsWith('rival:')) return state.rivals[account.slice(6)]?.name ?? 'Rival';
  if (account.startsWith('org:')) return state.organizations[account.slice(4)]?.name ?? 'Organization';
  return account;
}
