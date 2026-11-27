/**
 * Random world events. Each event has a deterministic probability check (seeded RNG),
 * an eligibility rule and a concrete effect: demand modifiers, costs through the
 * ledger, reputation or staff changes.
 */
import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import { roleDef } from '../../data/companies/industries';
import type { DistrictId, GameState, IndustryId, Modifier } from '../../types/core';
import { monthOf } from '../../utils/date';
import { clamp, dollars, money } from '../../utils/format';
import { chance, nextRandom, pick, randInt } from '../../utils/rng';
import { companyDistrict } from '../companies/industryRules';
import { companyStaff } from '../employees/employees';
import { companyAccount, PLAYER, transfer, WORLD } from '../finance/ledger';
import { addNews } from './news';

function addModifier(state: GameState, m: Omit<Modifier, 'id'>): void {
  state.counters.modifier++;
  state.modifiers.push({ ...m, id: `m${state.counters.modifier}` });
}

interface EventDef {
  id: string;
  /** Daily probability. */
  p: number;
  run: (state: GameState) => boolean;
}

const EVENTS: EventDef[] = [
  {
    id: 'tourism_surge',
    p: 0.006,
    run(state) {
      const d = pick(state, ['southbeach', 'waterfront', 'brickell'] as DistrictId[]);
      addModifier(state, { kind: 'demand', district: d, industry: 'hospitality', mult: 1.2, untilDay: state.day + 14, label: 'Convention & tourism surge' });
      addNews(state, 'economy', 'positive', `International conference books out ${DISTRICTS[d].name}`, 'Hotels, restaurants and nightlife in the district can expect a two-week surge in demand.');
      return true;
    },
  },
  {
    id: 'storm',
    p: 0.012,
    run(state) {
      const m = monthOf(state.day);
      if (m < 7 || m > 9) return false;
      for (const d of ['southbeach', 'waterfront'] as DistrictId[]) addModifier(state, { kind: 'demand', district: d, industry: 'all', mult: 0.55, untilDay: state.day + 5, label: 'Tropical storm warning' });
      addModifier(state, { kind: 'demand', district: 'all', industry: 'hospitality', mult: 0.85, untilDay: state.day + 5, label: 'Tropical storm warning' });
      addNews(state, 'economy', 'negative', 'Tropical storm warning issued for Miami-Dade', 'Visitors are cancelling plans. Beach districts will see sharply lower demand for the next several days.');
      return true;
    },
  },
  {
    id: 'art_week',
    p: 0.004,
    run(state) {
      addModifier(state, { kind: 'demand', district: 'wynwood', industry: 'all', mult: 1.25, untilDay: state.day + 7, label: 'Art week crowds' });
      addNews(state, 'economy', 'positive', 'Art week draws record crowds to Wynwood', 'Galleries, restaurants, bars and shops in Wynwood are packed this week.');
      return true;
    },
  },
  {
    id: 'tech_funding',
    p: 0.004,
    run(state) {
      addModifier(state, { kind: 'demand', district: 'all', industry: 'technology', mult: 1.15, untilDay: state.day + 30, label: 'Tech funding boom' });
      addNews(state, 'business', 'positive', 'Venture funding floods into Miami tech', 'Startups are spending on software and services. Technology demand is up for the next month.');
      return true;
    },
  },
  {
    id: 'consumer_slump',
    p: 0.003,
    run(state) {
      addModifier(state, { kind: 'demand', district: 'all', industry: 'retail', mult: 0.88, untilDay: state.day + 21, label: 'Consumer spending slump' });
      state.economy.consumerConfidence = clamp(state.economy.consumerConfidence - 8, 10, 95);
      addNews(state, 'economy', 'negative', 'Consumer confidence dips', 'Shoppers are tightening their belts. Retail demand is softer for the next three weeks.');
      return true;
    },
  },
  {
    id: 'viral_review',
    p: 0.01,
    run(state) {
      const cs = Object.values(state.companies).filter((c) => c.status === 'operating' && (c.industry === 'hospitality' || c.industry === 'retail') && c.reputation > 45);
      if (!cs.length) return false;
      const c = pick(state, cs);
      c.reputation = clamp(c.reputation + 6, 0, 100);
      addModifier(state, { kind: 'demand', district: 'all', industry: c.industry, companyId: c.id, mult: 1.3, untilDay: state.day + 10, label: 'Viral social media buzz' });
      addNews(state, 'company', 'positive', `${c.name} goes viral`, 'A glowing video review is spreading fast. Expect a rush of new customers for about ten days.', { companyId: c.id });
      return true;
    },
  },
  {
    id: 'inspection',
    p: 0.008,
    run(state) {
      const cs = Object.values(state.companies).filter((c) => c.status !== 'closed' && (c.subtype === 'restaurant' || c.subtype === 'foodtruck' || c.subtype === 'hotel'));
      if (!cs.length) return false;
      const c = pick(state, cs);
      const ops = c.ops.kind === 'hospitality' ? c.ops : null;
      const passed = (ops?.quality ?? 50) + nextRandom(state) * 40 > 55;
      if (passed) {
        c.reputation = clamp(c.reputation + 1, 0, 100);
        addNews(state, 'company', 'positive', `${c.name} passes health inspection`, 'A clean report from the county inspector.', { companyId: c.id });
      } else {
        const fine = dollars(randInt(state, 1500, 6000));
        transfer(state, companyAccount(c.id), WORLD, fine, 'event', 'Health code violation fine');
        c.reputation = clamp(c.reputation - 6, 0, 100);
        addNews(state, 'company', 'negative', `${c.name} cited by health inspectors`, `Fined ${money(fine)}. Better-trained staff and higher kitchen quality reduce the risk.`, { companyId: c.id });
      }
      return true;
    },
  },
  {
    id: 'equipment_failure',
    p: 0.006,
    run(state) {
      const cs = Object.values(state.companies).filter((c) => c.status !== 'closed' && c.equipment > 0);
      if (!cs.length) return false;
      const c = pick(state, cs);
      const cost = Math.max(dollars(500), Math.round(c.equipment * (0.03 + nextRandom(state) * 0.05)));
      transfer(state, companyAccount(c.id), WORLD, cost, 'event', 'Emergency equipment repair');
      addNews(state, 'company', 'negative', `Equipment breakdown at ${c.name}`, `Emergency repairs cost ${money(cost)}.`, { companyId: c.id });
      return true;
    },
  },
  {
    id: 'poaching',
    p: 0.008,
    run(state) {
      const staff = Object.values(state.employees).filter((e) => e.companyId && e.skill >= 65);
      if (!staff.length) return false;
      const e = pick(state, staff);
      const c = state.companies[e.companyId!];
      e.loyalty = clamp(e.loyalty - 18, 0, 100);
      addNews(state, 'staff', 'negative', `Recruiters target ${e.name}`, `A competitor is courting your ${roleDef(c.subtype, e.role)?.title.toLowerCase()} at ${c.name}. Their loyalty has dropped. A raise would help keep them.`, { companyId: c.id });
      return true;
    },
  },
  {
    id: 'nightclub_incident',
    p: 0.02,
    run(state) {
      const cs = Object.values(state.companies).filter((c) => c.status !== 'closed' && c.subtype === 'nightclub' && c.ops.kind === 'hospitality' && c.ops.lastDemand > 0);
      const risky = cs.filter((c) => {
        const sec = companyStaff(state, c).filter((e) => e.role === 'security').length;
        return c.ops.kind === 'hospitality' && c.ops.lastCustomers > sec * 80;
      });
      if (!risky.length) return false;
      const c = pick(state, risky);
      const fine = dollars(randInt(state, 4000, 15000));
      transfer(state, companyAccount(c.id), WORLD, fine, 'event', 'Licensing fine after incident');
      c.reputation = clamp(c.reputation - 5, 0, 100);
      addNews(state, 'company', 'negative', `Overcrowding incident at ${c.name}`, `Regulators fined the club ${money(fine)}. More security staff would prevent this.`, { companyId: c.id });
      return true;
    },
  },
  {
    id: 'press_feature',
    p: 0.004,
    run(state) {
      if (!Object.values(state.companies).some((c) => c.status === 'operating')) return false;
      state.player.reputation = clamp(state.player.reputation + 3, 0, 100);
      addNews(state, 'business', 'positive', `${state.player.name} profiled in the business press`, 'A feature on your growing empire lifts your public reputation.');
      return true;
    },
  },
  {
    id: 'tax_refund',
    p: 0.002,
    run(state) {
      if (!Object.values(state.properties).some((p) => p.owner === PLAYER)) return false;
      const amt = dollars(randInt(state, 2000, 12000));
      transfer(state, WORLD, PLAYER, amt, 'event', 'Property tax reassessment refund');
      addNews(state, 'finance', 'positive', 'Property tax reassessment in your favor', `The county refunded ${money(amt)}.`);
      return true;
    },
  },
];

export function rollRandomEvents(state: GameState): void {
  // At most one event per day keeps the news feed readable.
  for (const e of EVENTS) {
    if (chance(state, e.p)) {
      if (e.run(state)) return;
    }
  }
}

/** Demand modifiers currently affecting a given company. */
export function activeModifiersFor(state: GameState, companyId: string, industry: IndustryId): Modifier[] {
  const c = state.companies[companyId];
  const d = c ? companyDistrict(state, c) : null;
  return state.modifiers.filter((m) => (!m.companyId || m.companyId === companyId) && (m.district === 'all' || m.district === d) && (m.industry === 'all' || m.industry === industry));
}

export { DISTRICT_ORDER };
