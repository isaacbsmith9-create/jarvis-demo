/**
 * Minority stakes in rival companies. You buy newly issued shares (the money goes
 * into the rival's treasury), receive a share of each profitable month as a
 * dividend, and can sell back at the current valuation less a discount.
 */
import { INDUSTRIES } from '../../data/companies/industries';
import type { GameState, Money, Rival } from '../../types/core';
import { periodKey } from '../../utils/date';
import { money, pct } from '../../utils/format';
import { addNews } from '../events/news';
import { balance, PLAYER, rivalAccount, transfer, WORLD } from '../finance/ledger';
import { fail, ok, type ActionResult } from '../result';

export const MAX_STAKE = 0.49;
export const DIVIDEND_PAYOUT = 0.35;
export const BUY_PREMIUM = 1.1;
export const SELL_DISCOUNT = 0.92;

/** Rival company valuation: cash + property + earnings multiple on the last three months. */
export function rivalValuation(state: GameState, r: Rival): Money {
  if (r.status !== 'active') return 0;
  const cash = Math.max(0, balance(state, rivalAccount(r.id)));
  let props = 0;
  for (const p of Object.values(state.properties)) if (p.owner === rivalAccount(r.id)) props += p.value;
  const recent = r.monthly.slice(-3);
  const monthlyProfit = recent.length ? recent.reduce((s, m) => s + m.profit, 0) / recent.length : r.baseRevenue * 30 * r.margin;
  const monthlyRevenue = recent.length ? recent.reduce((s, m) => s + m.revenue, 0) / recent.length : r.baseRevenue * 30;
  const earnings = Math.max(0, monthlyProfit * 12) * INDUSTRIES[r.industry].earningsMultiple;
  return Math.round(cash + props + earnings + monthlyRevenue * 12 * 0.15);
}

export function stakeValue(state: GameState, r: Rival): Money {
  return Math.round(rivalValuation(state, r) * r.playerStake);
}

export function stakePrice(state: GameState, r: Rival, fraction: number): Money {
  return Math.round(rivalValuation(state, r) * fraction * BUY_PREMIUM);
}

export function buyStake(state: GameState, rivalId: string, fraction: number): ActionResult {
  const r = state.rivals[rivalId];
  if (!r || r.status !== 'active') return fail('That company is not available.');
  if (fraction <= 0) return fail('Choose a stake size.');
  if (r.playerStake + fraction > MAX_STAKE + 1e-9) return fail(`You can own at most ${pct(MAX_STAKE)} of ${r.name}. The founders keep control.`);
  const price = stakePrice(state, r, fraction);
  if (balance(state, PLAYER) < price) return fail(`A ${pct(fraction)} stake costs ${money(price)}.`);
  transfer(state, PLAYER, rivalAccount(r.id), price, 'investment', `${pct(fraction)} stake in ${r.name}`);
  r.playerStake = Math.round((r.playerStake + fraction) * 1000) / 1000;
  r.stakeCost += price;
  addNews(state, 'finance', 'positive', `${state.player.name} takes a stake in ${r.name}`, `A ${pct(fraction)} stake for ${money(price)}. Total holding: ${pct(r.playerStake)}.`, { rivalId: r.id });
  return ok(`You now own ${pct(r.playerStake)} of ${r.name}.`);
}

export function sellStake(state: GameState, rivalId: string, fraction: number): ActionResult {
  const r = state.rivals[rivalId];
  if (!r) return fail('Company not found.');
  const f = Math.min(fraction, r.playerStake);
  if (f <= 0) return fail(`You don't own shares in ${r.name}.`);
  const proceeds = Math.round(rivalValuation(state, r) * f * SELL_DISCOUNT);
  transfer(state, WORLD, PLAYER, proceeds, 'investment', `Sale of ${pct(f)} of ${r.name}`);
  const basisShare = Math.round(r.stakeCost * (f / r.playerStake));
  r.stakeCost -= basisShare;
  r.playerStake = Math.round((r.playerStake - f) * 1000) / 1000;
  if (r.playerStake <= 0) {
    r.playerStake = 0;
    r.stakeCost = 0;
  }
  return ok(`Sold ${pct(f)} of ${r.name} for ${money(proceeds)} (${proceeds - basisShare >= 0 ? 'gain' : 'loss'} of ${money(Math.abs(proceeds - basisShare))}).`);
}

/** Monthly: profitable rivals pay a dividend to shareholders. */
export function payRivalDividends(state: GameState): void {
  for (const r of Object.values(state.rivals)) {
    if (r.status !== 'active' || r.playerStake <= 0) continue;
    const prev = periodKey(state.day - 1);
    const last = r.monthly.find((m) => m.period === prev);
    if (!last || last.profit <= 0) continue;
    const amount = Math.round(last.profit * DIVIDEND_PAYOUT * r.playerStake);
    if (amount <= 0) continue;
    transfer(state, rivalAccount(r.id), PLAYER, amount, 'dividend', `Dividend from ${r.name}`);
    addNews(state, 'finance', 'positive', `Dividend from ${r.name}`, `Your ${pct(r.playerStake)} stake paid ${money(amount)}.`, { rivalId: r.id });
  }
}

/** When a rival goes bankrupt, shareholders are wiped out. */
export function wipeStake(state: GameState, r: Rival): void {
  if (r.playerStake <= 0) return;
  addNews(state, 'finance', 'negative', `Your stake in ${r.name} is worthless`, `You lose the ${money(r.stakeCost)} you invested.`, { rivalId: r.id });
  r.playerStake = 0;
  r.stakeCost = 0;
}
