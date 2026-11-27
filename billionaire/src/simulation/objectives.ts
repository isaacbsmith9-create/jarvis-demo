import type { GameState, Objective } from '../types/core';
import { money } from '../utils/format';
import { addNews } from './events/news';
import { balance, PLAYER } from './finance/ledger';
import { netWorth } from './finance/valuation';
import { playerOrganization } from './organizations/organizations';

export interface ObjectiveProgress {
  current: number;
  target: number;
  ratio: number;
  label: string;
}

export function objectiveProgress(state: GameState, o: Objective = state.objective): ObjectiveProgress {
  const active = Object.values(state.companies).filter((c) => c.status !== 'closed');
  switch (o.kind) {
    case 'netWorth': {
      const nw = netWorth(state);
      return { current: nw, target: o.target, ratio: Math.max(0, nw / o.target), label: `${money(nw)} / ${money(o.target)}` };
    }
    case 'cash': {
      const c = balance(state, PLAYER);
      return { current: c, target: o.target, ratio: Math.max(0, c / o.target), label: `${money(c)} / ${money(o.target)}` };
    }
    case 'companies':
      return { current: active.length, target: o.target, ratio: active.length / o.target, label: `${active.length} / ${o.target} companies` };
    case 'properties': {
      const n = Object.values(state.properties).filter((p) => p.owner === PLAYER || p.owner.startsWith('co:')).length;
      return { current: n, target: o.target, ratio: n / o.target, label: `${n} / ${o.target} properties` };
    }
    case 'monthlyProfit': {
      // Best completed month across all companies combined, or current month to date.
      const byPeriod = new Map<string, number>();
      for (const c of Object.values(state.companies)) {
        for (const s of [...c.statements, c.current]) byPeriod.set(s.period, (byPeriod.get(s.period) ?? 0) + s.profit);
      }
      const best = Math.max(0, ...byPeriod.values());
      return { current: best, target: o.target, ratio: best / o.target, label: `Best month ${money(best)} / ${money(o.target)}` };
    }
    case 'debtFree': {
      const debt = state.loans.reduce((s, l) => s + l.principal, 0);
      return { current: debt, target: 0, ratio: debt === 0 ? 1 : Math.max(0, 1 - debt / Math.max(1, o.startValue)), label: debt === 0 ? 'Debt free' : `${money(debt)} remaining` };
    }
    case 'employees': {
      const n = Object.values(state.employees).filter((e) => e.companyId).length;
      return { current: n, target: o.target, ratio: n / o.target, label: `${n} / ${o.target} employees` };
    }
    case 'influence': {
      const org = playerOrganization(state);
      const v = org?.influence ?? 0;
      return { current: v, target: o.target, ratio: v / o.target, label: `Influence ${Math.round(v)} / ${o.target}` };
    }
  }
}

export function checkObjective(state: GameState): void {
  const o = state.objective;
  if (o.completedDay !== null || o.failed) return;
  const p = objectiveProgress(state);
  if (p.ratio >= 1) {
    o.completedDay = state.day;
    state.player.reputation = Math.min(100, state.player.reputation + 5);
    addNews(state, 'objective', 'positive', `Objective complete: ${o.title}`, `${o.description} You can keep building your empire without limits.`);
  } else if (o.deadlineDay !== null && state.day > o.deadlineDay) {
    o.failed = true;
    addNews(state, 'objective', 'negative', `Objective missed: ${o.title}`, 'The deadline has passed. The campaign continues: your empire is still yours to build.');
  }
}
