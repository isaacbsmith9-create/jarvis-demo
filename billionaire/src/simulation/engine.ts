/**
 * Daily simulation step. Deterministic: given the same state (including RNG state)
 * it always produces the same next state. The engine never touches React or Phaser.
 */
import { roleDef } from '../data/companies/industries';
import type { GameState } from '../types/core';
import { dayOfMonth, weekday } from '../utils/date';
import { clamp } from '../utils/format';
import { chance } from '../utils/rng';
import { delegateWeekly, rollStatement, simulateCompanyDay, weeklyCandidateRefresh } from './companies/companies';
import { simulateRivalsDaily, simulateRivalsWeekly } from './competitors/competitors';
import { updateEconomy } from './economy/economy';
import { companyStaff } from './employees/employees';
import { addNews } from './events/news';
import { rollRandomEvents } from './events/randomEvents';
import { serviceLoans } from './finance/loans';
import { netWorth } from './finance/valuation';
import { checkObjective } from './objectives';
import { resolveOperationsDaily, simulateOrganizationsWeekly } from './organizations/organizations';
import { marketWeekly } from './companies/market';
import { payRivalDividends } from './competitors/investments';
import { executivesWeekly, payExecutives, refreshExecCandidates } from './executives/executives';
import { refreshListings, simulateProperties } from './properties/propertyActions';

export interface DayReport {
  day: number;
  newMonth: boolean;
}

export function advanceDay(state: GameState): DayReport {
  state.day++;
  state.stats.daysPlayed++;
  const newMonth = dayOfMonth(state.day) === 1;
  const newWeek = weekday(state.day) === 1; // Mondays

  updateEconomy(state);

  const companies = Object.values(state.companies);
  for (const c of companies) {
    rollStatement(state, c);
    simulateCompanyDay(state, c);
  }
  simulateProperties(state);
  simulateRivalsDaily(state);
  payExecutives(state);
  resolveOperationsDaily(state);

  if (newWeek) {
    simulateRivalsWeekly(state);
    simulateOrganizationsWeekly(state);
    refreshListings(state);
    weeklyCandidateRefresh(state);
    marketWeekly(state);
    executivesWeekly(state);
    for (const c of companies) {
      const change = delegateWeekly(state, c);
      if (change) addNews(state, 'company', 'neutral', `${c.name}: manager ${change}`, 'Delegated management adjusted operations based on last week’s demand.', { companyId: c.id });
    }
    staffTurnover(state);
  }
  if (newMonth) {
    serviceLoans(state);
    payRivalDividends(state);
    refreshExecCandidates(state);
    // Reputation slowly tracks the quality of your operating businesses.
    const active = companies.filter((c) => c.status !== 'closed' && c.owner === 'player');
    if (active.length) {
      const avg = active.reduce((s, c) => s + c.reputation, 0) / active.length;
      state.player.reputation = clamp(state.player.reputation + (avg - state.player.reputation) * 0.05, 0, 100);
    }
  }

  rollRandomEvents(state);

  if (state.day % 7 === 0 || newMonth) {
    state.player.netWorthHistory.push({ day: state.day, value: netWorth(state) });
    if (state.player.netWorthHistory.length > 400) state.player.netWorthHistory.shift();
  }
  checkObjective(state);
  return { day: state.day, newMonth };
}

function staffTurnover(state: GameState): void {
  for (const c of Object.values(state.companies)) {
    if (c.status === 'closed' || c.owner !== 'player') continue;
    for (const e of companyStaff(state, c)) {
      if (e.loyalty < 30 && chance(state, (30 - e.loyalty) / 100)) {
        c.employeeIds = c.employeeIds.filter((id) => id !== e.id);
        delete state.employees[e.id];
        addNews(state, 'staff', 'negative', `${e.name} quits ${c.name}`, `Your ${roleDef(c.subtype, e.role)?.title.toLowerCase()} resigned. Low pay, a struggling company and poor management drive turnover.`, { companyId: c.id });
      }
    }
  }
}

export function advanceDays(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) advanceDay(state);
}
