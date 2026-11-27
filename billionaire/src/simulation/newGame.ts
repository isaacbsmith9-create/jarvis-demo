import { scenarioById } from '../data/scenarios/scenarios';
import type { Contact, GameState, Organization } from '../types/core';
import { dollars } from '../utils/format';
import { seedFromString } from '../utils/rng';
import { foundCompany, seedEmployees } from './companies/companies';
import { createRivals } from './competitors/competitors';
import { createEconomy } from './economy/economy';
import { addNews } from './events/news';
import { orgAccount, PLAYER, transfer, WORLD } from './finance/ledger';
import { netWorth } from './finance/valuation';
import { createNpcOrganizations } from './organizations/organizations';
import { createProperties } from './properties/properties';

export const SCHEMA_VERSION = 1;

export interface NewGameOptions {
  playerName: string;
  scenarioId: string;
  seed?: string;
}

export function createNewGame(opts: NewGameOptions): GameState {
  const scenario = scenarioById(opts.scenarioId);
  const seedText = opts.seed?.trim() || `${Date.now()}-${Math.random()}`;
  const seed = seedFromString(seedText);
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    id: `g${seed.toString(36)}${Date.now().toString(36)}`,
    createdAt: Date.now(),
    seed,
    rng: seed,
    day: 0,
    player: {
      name: opts.playerName.trim() || 'Player',
      scenarioId: scenario.id,
      businessSkill: scenario.businessSkill,
      reputation: scenario.reputation,
      streetCred: scenario.streetCred,
      netWorthHistory: [],
    },
    balances: { player: 0 },
    ledger: { nextId: 1, entries: [], archived: { count: 0, byCategory: {} } },
    properties: createProperties(),
    companies: {},
    employees: {},
    rivals: {},
    organizations: {},
    contacts: [],
    loans: [],
    economy: createEconomy(),
    modifiers: [],
    news: [],
    nextNewsId: 1,
    objective: {
      kind: scenario.objective.kind,
      target: ['netWorth', 'cash', 'monthlyProfit'].includes(scenario.objective.kind) ? dollars(scenario.objective.target) : scenario.objective.target,
      title: scenario.objective.title,
      description: scenario.objective.description,
      startValue: 0,
      deadlineDay: scenario.objective.days,
      completedDay: null,
      failed: false,
    },
    counters: { company: 0, employee: 0, loan: 0, modifier: 0 },
    stats: { daysPlayed: 0, propertiesBought: 0, companiesFounded: 0, hires: 0 },
  };

  transfer(state, WORLD, PLAYER, dollars(scenario.cash), 'starting_capital', `Starting capital — ${scenario.title}`);
  state.rivals = createRivals(state);

  // Starting properties (owned outright).
  for (const sp of scenario.properties) {
    const p = state.properties[sp.id];
    p.owner = PLAYER;
    p.forSale = null;
    p.forLease = false;
    p.purchasedDay = 0;
    p.purchasePrice = p.value;
    p.use = sp.use === 'rented' ? { kind: 'rented', occupancy: 0.88 } : { kind: 'vacant' };
  }

  // Starting loans: proceeds were spent before the campaign, so they are recorded as liabilities only.
  for (const l of scenario.loans) {
    state.counters.loan++;
    state.loans.push({
      id: `l${state.counters.loan}`,
      lender: l.lender,
      kind: l.kind,
      principal: dollars(l.principal),
      annualRate: l.annualRate,
      monthlyPayment: dollars(l.monthlyPayment),
      originatedDay: 0,
      missedPayments: 0,
    });
  }

  // Starting companies
  for (const sc of scenario.companies) {
    const p = sc.propertyId ? state.properties[sc.propertyId] : null;
    if (p && !sc.ownedProperty) {
      p.forLease = true;
      p.forSale = null;
    }
    const res = foundCompany(
      state,
      sc.name,
      { subtype: sc.subtype, locationId: sc.propertyId, locationMode: sc.propertyId ? (sc.ownedProperty ? 'own' : 'lease') : 'none' },
      0,
      { silent: true, fromScenario: true },
    );
    if (!res.ok || !res.id) throw new Error(`Scenario company failed: ${res.message}`);
    const c = state.companies[res.id];
    // Scenario companies are established: equipment is already in place, so replace founding flows with a cash balance.
    const acct = `co:${c.id}`;
    const bal = state.balances[acct] ?? 0;
    transfer(state, WORLD, acct, dollars(sc.cash) - bal, 'starting_capital', `${c.name} opening balance`);
    c.startingCapital = dollars(sc.cash);
    c.reputation = sc.reputation;
    c.ownerOperated = !!sc.ownerOperated;
    c.foundedDay = -365;
    if (c.ops.kind === 'technology' && c.subtype === 'agency') c.ops.quality = 55;
    if (c.ops.kind === 'hospitality') c.ops.quality = Math.max(40, sc.reputation - 5);
    seedEmployees(state, c, sc.employees);
  }

  // Organization
  if (scenario.organization) {
    const so = scenario.organization;
    const org: Organization = {
      id: 'player-org',
      name: so.name,
      controlledBy: 'player',
      leader: state.player.name,
      members: [
        { id: 'pm-0', name: state.player.name, rank: 'boss', loyalty: 100, skill: scenario.streetCred, weeklyCut: 0 },
        ...so.members.map((m, i) => ({ id: `pm-${i + 1}`, name: m.name, rank: m.rank, loyalty: 60 + ((i * 7) % 25), skill: 40 + ((i * 13) % 40), weeklyCut: dollars(m.weeklyCut) })),
      ],
      influence: so.influence,
      heat: so.heat,
      territory: [...so.territory],
      posture: 'active',
      relations: {},
      frontCompanyIds: [],
      description: so.description,
    };
    state.organizations[org.id] = org;
    state.balances[orgAccount(org.id)] = 0;
    transfer(state, WORLD, orgAccount(org.id), dollars(so.treasury), 'starting_capital', `${org.name} treasury`);
  }
  const npc = createNpcOrganizations(state, scenario.organization?.name);
  Object.assign(state.organizations, npc);

  state.contacts = scenario.contacts.map(
    (c, i): Contact => ({ id: `ct${i}`, name: c.name, title: c.title, affiliation: c.affiliation, relationship: c.relationship, note: c.note, underworld: !!c.underworld }),
  );

  if (state.objective.kind === 'debtFree') state.objective.startValue = state.loans.reduce((s, l) => s + l.principal, 0);
  state.player.netWorthHistory.push({ day: 0, value: netWorth(state) });
  addNews(state, 'business', 'neutral', `${state.player.name} arrives in Miami`, `${scenario.story} Objective: ${scenario.objective.description}`);
  return state;
}
