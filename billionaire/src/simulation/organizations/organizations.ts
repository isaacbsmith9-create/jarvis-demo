/**
 * Underground organizations — Alpha 0.1 foundation.
 *
 * This is an abstract, fictional strategy layer. Organizations have members,
 * territory, influence, heat and a treasury that flows through the same ledger
 * as everything else. Missions, disputes and investigations build on this
 * data model in future releases.
 */
import { FIRST_NAMES, LAST_NAMES } from '../../data/employees/names';
import type { GameState, Organization } from '../../types/core';
import { clamp, dollars, money } from '../../utils/format';
import { chance, gaussian, nextRandom, pick } from '../../utils/rng';
import { addNews } from '../events/news';
import { balance, orgAccount, transfer, WORLD } from '../finance/ledger';
import { fail, ok, type ActionResult } from '../result';

export const NPC_ORGS: Omit<Organization, 'members'>[] = [
  {
    id: 'ceiba', name: 'The Ceiba Syndicate', controlledBy: 'npc', leader: 'Esteban "Viejo" Marquez', influence: 62, heat: 30, territory: ['littlehavana', 'downtown'], posture: 'active', relations: {}, frontCompanyIds: [],
    description: 'Old, disciplined and patient. Controls much of the west side.',
  },
  {
    id: 'tidebreakers', name: 'Tidebreakers', controlledBy: 'npc', leader: 'Reina Castellanos', influence: 48, heat: 41, territory: ['southbeach', 'waterfront'], posture: 'active', relations: {}, frontCompanyIds: [],
    description: 'A flashy, fast-growing outfit that runs the beach after dark.',
  },
  {
    id: 'northside', name: 'Northside Collective', controlledBy: 'npc', leader: 'Unknown', influence: 35, heat: 22, territory: ['wynwood'], posture: 'low', relations: {}, frontCompanyIds: [],
    description: 'Loose network with ties to the warehouse district. Little is known about its leadership.',
  },
];

export function createNpcOrganizations(state: GameState, excludeName?: string): Record<string, Organization> {
  const out: Record<string, Organization> = {};
  for (const def of NPC_ORGS) {
    if (excludeName && def.name === excludeName) continue;
    const members = Array.from({ length: 4 + Math.floor(nextRandom(state) * 5) }, (_, i) => ({
      id: `${def.id}-m${i}`,
      name: `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`,
      rank: (i === 0 ? 'underboss' : i < 3 ? 'lieutenant' : 'associate') as Organization['members'][number]['rank'],
      loyalty: 50 + Math.floor(nextRandom(state) * 40),
      skill: 30 + Math.floor(nextRandom(state) * 50),
      weeklyCut: 0,
    }));
    out[def.id] = { ...def, members, relations: { ...def.relations } };
  }
  return out;
}

export function playerOrganization(state: GameState): Organization | null {
  return Object.values(state.organizations).find((o) => o.controlledBy === 'player') ?? null;
}

/** Abstract weekly income from the organization's influence. */
export function weeklyOrgIncome(o: Organization): number {
  const base = 150 + o.influence * o.influence * 3 + o.members.length * 120;
  return dollars(base * (o.posture === 'low' ? 0.35 : 1));
}

export function weeklyOrgUpkeep(o: Organization): number {
  return o.members.reduce((s, m) => s + m.weeklyCut, 0);
}

export function simulateOrganizationsWeekly(state: GameState): void {
  for (const o of Object.values(state.organizations)) {
    if (o.controlledBy === 'npc') {
      o.influence = clamp(o.influence + gaussian(state) * 0.8, 5, 95);
      o.heat = clamp(o.heat + gaussian(state) * 1.2 - 0.2, 0, 100);
      continue;
    }
    const acct = orgAccount(o.id);
    const income = Math.round(weeklyOrgIncome(o) * (0.8 + nextRandom(state) * 0.4));
    transfer(state, WORLD, acct, income, 'org_income', `${o.name} weekly take`);
    const upkeep = weeklyOrgUpkeep(o);
    const treasury = balance(state, acct);
    if (treasury >= upkeep) {
      transfer(state, acct, WORLD, upkeep, 'org_upkeep', `${o.name} member cuts`);
      for (const m of o.members) m.loyalty = clamp(m.loyalty + 0.3, 0, 100);
    } else {
      transfer(state, acct, WORLD, Math.max(0, treasury), 'org_upkeep', `${o.name} partial member cuts`);
      for (const m of o.members) m.loyalty = clamp(m.loyalty - 6, 0, 100);
      addNews(state, 'underworld', 'negative', `${o.name} cannot pay its people`, 'Members went unpaid this week. Loyalty is slipping.');
    }
    // Heat rises with activity and influence; low profile cools things down.
    const heatDelta = o.posture === 'low' ? -2.2 : 0.4 + o.influence * 0.012 + gaussian(state) * 0.6;
    o.heat = clamp(o.heat + heatDelta, 0, 100);
    o.influence = clamp(o.influence + (o.posture === 'low' ? -0.4 : 0.25) + gaussian(state) * 0.3, 0, 100);
    // Heat bleeds into public reputation for leaders with legitimate businesses.
    if (o.heat > 60) state.player.reputation = clamp(state.player.reputation - 0.5, 0, 100);

    // Consequences: investigations at high heat (abstract).
    if (o.heat > 70 && chance(state, (o.heat - 70) / 120)) {
      const fine = Math.min(balance(state, acct), dollars(20000 + o.heat * 1500));
      transfer(state, acct, WORLD, fine, 'event', 'Legal defense & seized assets');
      o.heat = clamp(o.heat - 15, 0, 100);
      o.influence = clamp(o.influence - 5, 0, 100);
      addNews(state, 'underworld', 'negative', `Investigators close in on ${o.name}`, `A fictional task force raided associated locations. The organization lost ${money(fine)} and influence. Heat has dropped for now.`);
    }
    // Disloyal members walk away.
    for (const m of [...o.members]) {
      if (m.loyalty < 20 && chance(state, 0.25)) {
        o.members = o.members.filter((x) => x.id !== m.id);
        addNews(state, 'underworld', 'negative', `${m.name} leaves ${o.name}`, 'Unpaid and disillusioned, a member has walked away.');
      }
    }
  }
}

export function setPosture(state: GameState, orgId: string, posture: 'active' | 'low'): ActionResult {
  const o = state.organizations[orgId];
  if (!o || o.controlledBy !== 'player') return fail('Organization not found.');
  o.posture = posture;
  return ok(posture === 'low' ? `${o.name} is keeping a low profile. Income falls; heat cools.` : `${o.name} is back to full activity.`);
}

export function transferFromOrg(state: GameState, orgId: string, amount: number): ActionResult {
  const o = state.organizations[orgId];
  if (!o || o.controlledBy !== 'player') return fail('Organization not found.');
  if (amount <= 0) return fail('Enter a positive amount.');
  if (balance(state, orgAccount(o.id)) < amount) return fail('The treasury does not hold that much.');
  transfer(state, orgAccount(o.id), 'player', amount, 'dividend', `Withdrawal from ${o.name} treasury`);
  // Moving money out of the underground draws attention.
  o.heat = clamp(o.heat + Math.min(12, amount / dollars(25000)), 0, 100);
  return ok(`Moved ${money(amount)} to your personal account. Heat increased.`);
}
