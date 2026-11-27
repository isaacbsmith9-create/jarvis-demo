/**
 * Underground organizations — Alpha 0.3.
 *
 * An abstract, fictional strategy layer. Organizations hold shares of each
 * district's turf, run operations with their members, deal with each other
 * (truces, alliances, open conflict), face story situations and a slowly
 * building law-enforcement case. All money flows through the shared ledger.
 * Nothing here describes real-world methods: operations are named outcomes
 * with odds, costs and consequences.
 */
import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import { FIRST_NAMES, LAST_NAMES } from '../../data/employees/names';
import type { DistrictId, GameState, OpKind, Operation, Organization, OrgMember, Situation } from '../../types/core';
import { clamp, dollars, money } from '../../utils/format';
import { chance, gaussian, nextRandom, pick, randInt, randRange } from '../../utils/rng';
import { playerCompanies } from '../companies/companies';
import { companyDistricts } from '../companies/units';
import { addNews } from '../events/news';
import { balance, orgAccount, PLAYER, transfer, WORLD } from '../finance/ledger';
import { fail, ok, type ActionResult } from '../result';

/* ------------------------------------------------------------------ */
/* Static data                                                         */
/* ------------------------------------------------------------------ */

type NpcDef = Pick<Organization, 'id' | 'name' | 'leader' | 'influence' | 'heat' | 'posture' | 'description'> & { turf: Partial<Record<DistrictId, number>>; aggression: number };

export const NPC_ORGS: NpcDef[] = [
  { id: 'ceiba', name: 'The Ceiba Syndicate', leader: 'Esteban "Viejo" Marquez', influence: 62, heat: 30, posture: 'active', aggression: 0.35, turf: { littlehavana: 40, downtown: 25 }, description: 'Old, disciplined and patient. Controls much of the west side.' },
  { id: 'tidebreakers', name: 'Tidebreakers', leader: 'Reina Castellanos', influence: 48, heat: 41, posture: 'active', aggression: 0.6, turf: { southbeach: 40, waterfront: 30 }, description: 'A flashy, fast-growing outfit that runs the beach after dark.' },
  { id: 'northside', name: 'Northside Collective', leader: 'Unknown', influence: 35, heat: 22, posture: 'low', aggression: 0.2, turf: { wynwood: 35, brickell: 10 }, description: 'Loose network with ties to the warehouse district. Little is known about its leadership.' },
];

/** Weekly take at 100% control of a district (dollars). */
export const DISTRICT_WEALTH: Record<DistrictId, number> = {
  littlehavana: 16000,
  downtown: 24000,
  wynwood: 18000,
  brickell: 30000,
  southbeach: 34000,
  waterfront: 26000,
};

export interface OpDef {
  kind: OpKind;
  name: string;
  description: string;
  target: 'own-district' | 'any-district' | 'org-district' | 'rival-company' | null;
  crewMin: number;
  crewMax: number;
  days: number;
  difficulty: number;
}

export const OPS: Record<OpKind, OpDef> = {
  expand: { kind: 'expand', name: 'Expand influence', description: 'Build presence in a district and take a larger share of its turf.', target: 'any-district', crewMin: 1, crewMax: 3, days: 5, difficulty: 0.05 },
  collect: { kind: 'collect', name: 'Collect from turf', description: 'Gather what your turf in a district has built up since the last collection (full value after two weeks).', target: 'own-district', crewMin: 1, crewMax: 2, days: 3, difficulty: 0 },
  recruit: { kind: 'recruit', name: 'Recruit', description: 'Bring a new associate into the organization.', target: null, crewMin: 1, crewMax: 1, days: 4, difficulty: 0 },
  legal: { kind: 'legal', name: 'Retain lawyers', description: 'Expensive, but cools heat and sets back the case against you.', target: null, crewMin: 1, crewMax: 1, days: 6, difficulty: -0.25 },
  turf: { kind: 'turf', name: 'Move against a rival', description: "Push a rival organization out of part of a district you both hold. Starts open conflict with them.", target: 'org-district', crewMin: 2, crewMax: 4, days: 6, difficulty: 0.15 },
  sabotage: { kind: 'sabotage', name: 'Disrupt a competitor', description: 'Cause problems for a legitimate rival company. If it traces back to you, your public reputation suffers.', target: 'rival-company', crewMin: 1, crewMax: 2, days: 4, difficulty: 0.15 },
  clean: { kind: 'clean', name: 'Move funds through a front', description: 'Bring treasury money to your personal cash through your legitimate businesses, with far less heat than a direct transfer.', target: null, crewMin: 1, crewMax: 1, days: 7, difficulty: 0 },
};

export const OP_ORDER: OpKind[] = ['expand', 'collect', 'recruit', 'turf', 'sabotage', 'clean', 'legal'];

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

function blankOrgFields(): Pick<Organization, 'pacts' | 'operations' | 'situations' | 'investigation' | 'lastCollect' | 'relations' | 'frontCompanyIds'> {
  return { pacts: {}, operations: [], situations: [], investigation: 0, lastCollect: {}, relations: {}, frontCompanyIds: [] };
}

export function emptyTerritory(): Record<DistrictId, Record<string, number>> {
  const t = {} as Record<DistrictId, Record<string, number>>;
  for (const d of DISTRICT_ORDER) t[d] = {};
  return t;
}

export function createNpcOrganizations(state: GameState, excludeName?: string): Record<string, Organization> {
  const out: Record<string, Organization> = {};
  for (const def of NPC_ORGS) {
    if (excludeName && def.name === excludeName) continue;
    const members: OrgMember[] = Array.from({ length: 4 + Math.floor(nextRandom(state) * 5) }, (_, i) => ({
      id: `${def.id}-m${i}`,
      name: `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`,
      rank: (i === 0 ? 'underboss' : i < 3 ? 'lieutenant' : 'associate') as OrgMember['rank'],
      loyalty: 50 + Math.floor(nextRandom(state) * 40),
      skill: 30 + Math.floor(nextRandom(state) * 50),
      weeklyCut: 0,
    }));
    const { turf, aggression: _a, ...rest } = def;
    void _a;
    out[def.id] = { ...rest, controlledBy: 'npc', members, territory: Object.keys(turf) as DistrictId[], ...blankOrgFields() };
    for (const [d, share] of Object.entries(turf) as [DistrictId, number][]) state.territory[d][def.id] = share;
  }
  return out;
}

export function playerOrganization(state: GameState): Organization | null {
  return Object.values(state.organizations).find((o) => o.controlledBy === 'player') ?? null;
}

export function shareOf(state: GameState, orgId: string, d: DistrictId): number {
  return state.territory[d]?.[orgId] ?? 0;
}

export function unclaimed(state: GameState, d: DistrictId): number {
  return Math.max(0, 100 - Object.values(state.territory[d]).reduce((s, v) => s + v, 0));
}

function setShare(state: GameState, orgId: string, d: DistrictId, v: number): void {
  const t = state.territory[d];
  t[orgId] = clamp(Math.round(v * 10) / 10, 0, 100);
  if (t[orgId] <= 0) delete t[orgId];
}

/** Move share from one holder (or unclaimed) to another. Returns the amount moved. */
function moveShare(state: GameState, d: DistrictId, to: string, from: string | null, amount: number): number {
  const available = from === null ? unclaimed(state, d) : shareOf(state, from, d);
  const moved = Math.max(0, Math.min(amount, available));
  if (from !== null) setShare(state, from, d, shareOf(state, from, d) - moved);
  setShare(state, to, d, shareOf(state, to, d) + moved);
  return moved;
}

function refreshTerritoryList(state: GameState, o: Organization): void {
  o.territory = DISTRICT_ORDER.filter((d) => shareOf(state, o.id, d) >= 10);
}

export function totalTurf(state: GameState, orgId: string): number {
  return DISTRICT_ORDER.reduce((s, d) => s + shareOf(state, orgId, d), 0);
}

/* ------------------------------------------------------------------ */
/* Economics                                                           */
/* ------------------------------------------------------------------ */

/** Estimated weekly income from turf (passive), before member cuts. */
export function weeklyOrgIncome(state: GameState, o: Organization): number {
  let s = 0;
  for (const d of DISTRICT_ORDER) s += (shareOf(state, o.id, d) / 100) * DISTRICT_WEALTH[d] * 0.6;
  s += o.members.length * 120;
  return dollars(s * (o.posture === 'low' ? 0.35 : 1));
}

export function weeklyOrgUpkeep(o: Organization): number {
  return o.members.reduce((s, m) => s + m.weeklyCut, 0);
}

export function relationOf(o: Organization, otherId: string): number {
  return o.relations[otherId] ?? 0;
}

export function atWar(o: Organization, otherId: string): boolean {
  return relationOf(o, otherId) <= -50 && !o.pacts[otherId];
}

function changeRelation(state: GameState, player: Organization, npcId: string, delta: number): void {
  player.relations[npcId] = clamp(relationOf(player, npcId) + delta, -100, 100);
  const npc = state.organizations[npcId];
  if (npc) npc.relations[player.id] = player.relations[npcId];
  if (player.pacts[npcId] === 'alliance' && player.relations[npcId] < 20) {
    delete player.pacts[npcId];
    addNews(state, 'underworld', 'negative', `Alliance with ${npc?.name ?? 'a rival'} collapses`, 'Relations soured too far for the alliance to hold.');
  }
  if (player.pacts[npcId] === 'truce' && player.relations[npcId] < -30) {
    delete player.pacts[npcId];
    addNews(state, 'underworld', 'negative', `Truce with ${npc?.name ?? 'a rival'} is over`, 'They no longer consider themselves bound by it.');
  }
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export interface OpPlan {
  kind: OpKind;
  crew: string[];
  district?: DistrictId | null;
  targetOrgId?: string | null;
  targetRivalId?: string | null;
}

export function busyMembers(o: Organization): Set<string> {
  return new Set(o.operations.flatMap((op) => op.crew));
}

function frontCapacity(state: GameState): number {
  let s = 0;
  for (const c of playerCompanies(state)) s += c.history.slice(-30).reduce((a, d) => a + d.revenue, 0) * 0.25;
  return Math.round(s);
}

export function opCost(state: GameState, o: Organization, plan: OpPlan): number {
  const d = plan.district ?? null;
  switch (plan.kind) {
    case 'expand':
      return dollars(6000 + 150 * (d ? shareOf(state, o.id, d) : 0));
    case 'collect':
      return dollars(500);
    case 'recruit':
      return dollars(5000);
    case 'legal':
      return dollars(12000 + Math.round(o.heat) * 400);
    case 'turf':
      return dollars(9000);
    case 'sabotage':
      return dollars(7000);
    case 'clean':
      return dollars(2000);
  }
}

/** Expected value of a collection right now (dollars, as cents). */
export function collectYield(state: GameState, o: Organization, d: DistrictId): number {
  const last = o.lastCollect[d] ?? state.day - 30;
  const days = Math.min(30, Math.max(0, state.day - last));
  return dollars((shareOf(state, o.id, d) / 100) * DISTRICT_WEALTH[d] * Math.min(1, days / 14) * 1.5);
}

export interface OpQuote {
  cost: number;
  chance: number;
  days: number;
  errors: string[];
  preview: string;
}

export function quoteOperation(state: GameState, o: Organization, plan: OpPlan): OpQuote {
  const def = OPS[plan.kind];
  const errors: string[] = [];
  const busy = busyMembers(o);
  const crew = plan.crew.map((id) => o.members.find((m) => m.id === id)).filter((m): m is OrgMember => !!m);
  if (crew.length < def.crewMin) errors.push(`Assign at least ${def.crewMin} member${def.crewMin > 1 ? 's' : ''}.`);
  if (crew.length > def.crewMax) errors.push(`At most ${def.crewMax} members on this.`);
  if (crew.some((m) => busy.has(m.id))) errors.push('Someone on the crew is already on another operation.');
  if (crew.some((m) => m.rank === 'boss')) errors.push('You run the organization; send your people.');
  const d = plan.district ?? null;
  let difficulty = def.difficulty;
  let preview = '';
  if (def.target === 'any-district' || def.target === 'own-district' || def.target === 'org-district') {
    if (!d) errors.push('Choose a district.');
  }
  if (d && def.target === 'own-district' && shareOf(state, o.id, d) <= 0) errors.push(`You hold no turf in ${DISTRICTS[d].name}.`);
  if (plan.kind === 'expand' && d) {
    const others = Object.entries(state.territory[d]).filter(([id]) => id !== o.id);
    const strongest = Math.max(0, ...others.map(([, v]) => v));
    difficulty += strongest / 300 + shareOf(state, o.id, d) / 250;
    if (unclaimed(state, d) < 5 && !others.length) errors.push('There is nothing left to take there.');
    preview = unclaimed(state, d) >= 8 ? `Claims open turf in ${DISTRICTS[d].name}.` : `Little open turf left: success takes share from the strongest group there and angers them.`;
  }
  if (plan.kind === 'collect' && d) preview = `About ${money(collectYield(state, o, d))} is waiting in ${DISTRICTS[d].name}.`;
  if (plan.kind === 'turf') {
    const t = plan.targetOrgId ? state.organizations[plan.targetOrgId] : null;
    if (!t) errors.push('Choose a rival organization.');
    else {
      if (d && shareOf(state, t.id, d) <= 0) errors.push(`${t.name} holds nothing in ${d ? DISTRICTS[d].name : 'that district'}.`);
      if (o.pacts[t.id] === 'alliance') errors.push(`${t.name} is your ally.`);
      difficulty += t.influence / 250;
      preview = `${t.name} will treat this as an act of war${o.pacts[t.id] ? ' and the pact ends' : ''}.`;
    }
  }
  if (plan.kind === 'sabotage') {
    const r = plan.targetRivalId ? state.rivals[plan.targetRivalId] : null;
    if (!r || r.status !== 'active') errors.push('Choose an active competitor.');
    else difficulty += r.reputation / 400;
  }
  if (plan.kind === 'clean') {
    const cap = frontCapacity(state);
    if (cap <= 0) errors.push('You need an operating legitimate business with recent revenue to act as a front.');
    preview = `Moves up to ${money(Math.min(cap, Math.max(0, balance(state, orgAccount(o.id)))))} (a quarter of your companies' last 30 days of revenue).`;
  }
  if (plan.kind === 'legal') preview = 'Cools heat by 15–25 and sets the case back by 15–25.';
  if (plan.kind === 'recruit') preview = 'A new associate joins on a $500 weekly cut.';
  const cost = opCost(state, o, plan);
  if (balance(state, orgAccount(o.id)) < cost) errors.push(`The treasury needs ${money(cost)}.`);
  const avgSkill = crew.length ? crew.reduce((s, m) => s + m.skill, 0) / crew.length : 0;
  const ally = d && Object.entries(o.pacts).some(([id, p]) => p === 'alliance' && shareOf(state, id, d) > 0) ? 0.08 : 0;
  const c = clamp(0.25 + (avgSkill / 100) * 0.5 + Math.max(0, crew.length - 1) * 0.05 + o.influence / 500 - o.heat / 300 - difficulty + ally, 0.08, 0.95);
  return { cost, chance: Math.round(c * 100) / 100, days: def.days, errors, preview };
}

export function launchOperation(state: GameState, plan: OpPlan): ActionResult {
  const o = playerOrganization(state);
  if (!o) return fail('You have no organization.');
  const q = quoteOperation(state, o, plan);
  if (q.errors.length) return fail(q.errors[0]);
  transfer(state, orgAccount(o.id), WORLD, q.cost, 'org_upkeep', `Operation: ${OPS[plan.kind].name}`);
  state.counters.op++;
  const op: Operation = {
    id: `op${state.counters.op}`,
    kind: plan.kind,
    crew: [...plan.crew],
    district: plan.district ?? null,
    targetOrgId: plan.targetOrgId ?? null,
    targetRivalId: plan.targetRivalId ?? null,
    cost: q.cost,
    chance: q.chance,
    startDay: state.day,
    endDay: state.day + q.days,
  };
  o.operations.push(op);
  return ok(`${OPS[plan.kind].name} is under way. Results in ${q.days} days.`, op.id);
}

function report(state: GameState, o: Organization, op: Operation, outcome: 'success' | 'partial' | 'failure', summary: string): void {
  state.opReports.unshift({ id: op.id, day: state.day, kind: op.kind, outcome, summary });
  if (state.opReports.length > 40) state.opReports.length = 40;
  addNews(state, 'underworld', outcome === 'failure' ? 'negative' : 'positive', `${OPS[op.kind].name}: ${outcome === 'success' ? 'success' : outcome === 'partial' ? 'partly worked' : 'failed'}`, summary);
  void o;
}

function loseMember(state: GameState, o: Organization, crew: string[], why: string): string | null {
  const candidates = o.members.filter((m) => crew.includes(m.id) && m.rank !== 'boss');
  if (!candidates.length) return null;
  const m = pick(state, candidates);
  o.members = o.members.filter((x) => x.id !== m.id);
  return `${m.name} ${why}.`;
}

function resolveOperation(state: GameState, o: Organization, op: Operation): void {
  const roll = nextRandom(state);
  const outcome: 'success' | 'partial' | 'failure' = roll < op.chance ? 'success' : roll < op.chance + (1 - op.chance) * 0.35 ? 'partial' : 'failure';
  const crew = o.members.filter((m) => op.crew.includes(m.id));
  const d = op.district;
  const acct = orgAccount(o.id);
  let summary = '';
  // Small crews draw less attention than big organizations.
  const scale = 0.5 + Math.min(1, totalTurf(state, o.id) / 120) * 0.6;
  const heat = (n: number) => (o.heat = clamp(o.heat + (n > 0 ? n * scale : n), 0, 100));
  const loyalty = (n: number) => crew.forEach((m) => (m.loyalty = clamp(m.loyalty + n, 0, 100)));
  if (outcome === 'success') crew.forEach((m) => m.skill < 95 && chance(state, 0.5) && m.skill++);

  switch (op.kind) {
    case 'expand': {
      if (!d) break;
      // The more you already hold, the harder each extra point is to win.
      const room = 1 - shareOf(state, o.id, d) / 120;
      const want = Math.round((outcome === 'success' ? randInt(state, 8, 14) : outcome === 'partial' ? 3 : 0) * room);
      let got = moveShare(state, d, o.id, null, want);
      if (got < want) {
        const others = Object.entries(state.territory[d]).filter(([id]) => id !== o.id).sort((a, b) => b[1] - a[1]);
        if (others.length) {
          const [victim] = others[0];
          got += moveShare(state, d, o.id, victim, want - got);
          if (state.organizations[victim]?.controlledBy === 'npc') changeRelation(state, o, victim, -10);
        }
      }
      heat(outcome === 'failure' ? 5 : 3);
      if (outcome === 'failure') loyalty(-3);
      summary = outcome === 'failure' ? `The push into ${DISTRICTS[d].name} went nowhere and drew attention.` : `Gained ${Math.round(got)}% of ${DISTRICTS[d].name}. You now hold ${Math.round(shareOf(state, o.id, d))}%.`;
      break;
    }
    case 'collect': {
      if (!d) break;
      const full = collectYield(state, o, d) * (0.7 + crew.length * 0.15);
      const amount = Math.round(outcome === 'success' ? full : outcome === 'partial' ? full * 0.5 : 0);
      if (amount > 0) transfer(state, WORLD, acct, amount, 'org_income', `Collection in ${DISTRICTS[d].name}`);
      o.lastCollect[d] = state.day;
      heat(outcome === 'failure' ? 6 : 4);
      summary = amount > 0 ? `Brought ${money(amount)} into the treasury from ${DISTRICTS[d].name}.` : `The collection in ${DISTRICTS[d].name} fell apart. Nothing came in.`;
      break;
    }
    case 'recruit': {
      if (outcome === 'failure') {
        heat(1);
        summary = 'Nobody suitable could be found this time.';
        break;
      }
      const m: OrgMember = { id: `pm-${state.counters.op}-${randInt(state, 100, 999)}`, name: `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`, rank: 'associate', loyalty: randInt(state, 55, 80), skill: outcome === 'success' ? randInt(state, 40, 68) : randInt(state, 25, 45), weeklyCut: dollars(500) };
      o.members.push(m);
      summary = `${m.name} joined as an associate (skill ${m.skill}).`;
      break;
    }
    case 'legal': {
      const k = outcome === 'success' ? 1 : outcome === 'partial' ? 0.5 : 0.25;
      const cool = Math.round(randRange(state, 15, 25) * k);
      const setback = Math.round(randRange(state, 15, 25) * k);
      heat(-cool);
      o.investigation = clamp(o.investigation - setback, 0, 100);
      summary = `Heat down ${cool}, case set back ${setback}.`;
      break;
    }
    case 'turf': {
      const t = op.targetOrgId ? state.organizations[op.targetOrgId] : null;
      if (!t || !d) break;
      changeRelation(state, o, t.id, -25);
      delete o.pacts[t.id];
      if (outcome !== 'failure') {
        const got = moveShare(state, d, o.id, t.id, outcome === 'success' ? randInt(state, 10, 20) : 5);
        t.influence = clamp(t.influence - (outcome === 'success' ? 3 : 1), 0, 100);
        heat(5);
        summary = `Took ${Math.round(got)}% of ${DISTRICTS[d].name} from ${t.name}. They will want it back.`;
      } else {
        const lost = moveShare(state, d, t.id, o.id, randInt(state, 3, 8));
        heat(8);
        loyalty(-5);
        const gone = chance(state, 0.3) ? loseMember(state, o, op.crew, 'was arrested in the aftermath') : null;
        summary = `${t.name} was ready. You lost ${Math.round(lost)}% of ${DISTRICTS[d].name}.${gone ? ` ${gone}` : ''}`;
      }
      break;
    }
    case 'sabotage': {
      const r = op.targetRivalId ? state.rivals[op.targetRivalId] : null;
      if (!r) break;
      if (outcome !== 'failure') {
        const k = outcome === 'success' ? 1 : 0.5;
        r.momentum = clamp(r.momentum - 0.15 * k, -0.35, 0.35);
        r.baseRevenue = Math.round(r.baseRevenue * (1 - 0.03 * k));
        r.reputation = clamp(r.reputation - 4 * k, 0, 100);
        heat(6);
        addNews(state, 'competitor', 'negative', `Problems pile up at ${r.name}`, 'Disruptions and bad press are hurting business. Nobody can say where the trouble started.', { rivalId: r.id });
        summary = `${r.name} is struggling with sudden problems.`;
      } else {
        heat(10);
        state.player.reputation = clamp(state.player.reputation - 3, 0, 100);
        summary = `It went wrong, and rumors now link your name to trouble at ${r.name}. Public reputation down.`;
      }
      break;
    }
    case 'clean': {
      const cap = Math.min(frontCapacity(state), Math.max(0, balance(state, acct)));
      const amount = Math.round(outcome === 'success' ? cap : outcome === 'partial' ? cap * 0.6 : cap * 0.3);
      if (amount > 0) transfer(state, acct, PLAYER, amount, 'dividend', 'Funds moved through a front business');
      heat(outcome === 'failure' ? 8 : 1);
      summary = `${money(amount)} reached your personal account${outcome === 'failure' ? ', but the transfers drew scrutiny' : ''}.`;
      break;
    }
  }
  refreshTerritoryList(state, o);
  report(state, o, op, outcome, summary);
}

/** Daily: finish operations that are due. */
export function resolveOperationsDaily(state: GameState): void {
  const o = playerOrganization(state);
  if (!o) return;
  const due = o.operations.filter((op) => op.endDay <= state.day);
  if (!due.length) return;
  o.operations = o.operations.filter((op) => op.endDay > state.day);
  for (const op of due) resolveOperation(state, o, op);
}

/* ------------------------------------------------------------------ */
/* Diplomacy & membership                                               */
/* ------------------------------------------------------------------ */

export function sendGift(state: GameState, orgId: string, amount: number): ActionResult {
  const o = playerOrganization(state);
  const t = state.organizations[orgId];
  if (!o || !t || t.controlledBy !== 'npc') return fail('Organization not found.');
  if (amount <= 0) return fail('Choose an amount.');
  if (balance(state, orgAccount(o.id)) < amount) return fail('The treasury does not hold that much.');
  transfer(state, orgAccount(o.id), WORLD, amount, 'org_upkeep', `Gift to ${t.name}`);
  const delta = Math.min(30, Math.round(amount / dollars(1500)));
  changeRelation(state, o, orgId, delta);
  return ok(`${t.name} accepts the gift. Relations +${delta} (now ${Math.round(relationOf(o, orgId))}).`);
}

export function proposeTruce(state: GameState, orgId: string): ActionResult {
  const o = playerOrganization(state);
  const t = state.organizations[orgId];
  if (!o || !t) return fail('Organization not found.');
  if (o.pacts[orgId]) return fail(`You already have a ${o.pacts[orgId]} with ${t.name}.`);
  if (relationOf(o, orgId) < -10) {
    changeRelation(state, o, orgId, -3);
    return fail(`${t.name} refuses. Improve relations first (they need to be above −10).`);
  }
  o.pacts[orgId] = 'truce';
  changeRelation(state, o, orgId, 5);
  addNews(state, 'underworld', 'positive', `Truce with ${t.name}`, 'Neither side will move against the other while it holds.');
  return ok(`Truce agreed with ${t.name}. They won't move on your turf while it holds.`);
}

export function proposeAlliance(state: GameState, orgId: string): ActionResult {
  const o = playerOrganization(state);
  const t = state.organizations[orgId];
  if (!o || !t) return fail('Organization not found.');
  if (o.pacts[orgId] !== 'truce') return fail('Agree a truce first.');
  if (relationOf(o, orgId) < 50) return fail(`${t.name} isn't ready. Relations must reach 50 (now ${Math.round(relationOf(o, orgId))}).`);
  const cost = dollars(20000);
  if (balance(state, orgAccount(o.id)) < cost) return fail(`Sealing an alliance costs ${money(cost)} from the treasury.`);
  transfer(state, orgAccount(o.id), WORLD, cost, 'org_upkeep', `Alliance with ${t.name}`);
  o.pacts[orgId] = 'alliance';
  addNews(state, 'underworld', 'positive', `Alliance with ${t.name}`, 'Your operations in their districts are more likely to succeed.');
  return ok(`Alliance sealed with ${t.name}. Operations in districts where they hold turf get better odds.`);
}

export function promoteMember(state: GameState, memberId: string): ActionResult {
  const o = playerOrganization(state);
  const m = o?.members.find((x) => x.id === memberId);
  if (!o || !m) return fail('Member not found.');
  if (m.rank === 'associate') {
    if (m.skill < 50) return fail(`${m.name} needs skill 50 to become a lieutenant.`);
    m.rank = 'lieutenant';
    m.weeklyCut = Math.max(m.weeklyCut * 2, dollars(1200));
  } else if (m.rank === 'lieutenant') {
    if (o.members.some((x) => x.rank === 'underboss')) return fail('You already have an underboss.');
    if (m.skill < 60) return fail(`${m.name} needs skill 60 to become underboss.`);
    m.rank = 'underboss';
    m.weeklyCut = Math.max(Math.round(m.weeklyCut * 1.6), dollars(2500));
  } else return fail(`${m.name} can't be promoted further.`);
  m.loyalty = clamp(m.loyalty + 15, 0, 100);
  return ok(`${m.name} is now ${m.rank === 'underboss' ? 'underboss' : 'a lieutenant'}. Weekly cut ${money(m.weeklyCut)}.`);
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
  transfer(state, orgAccount(o.id), PLAYER, amount, 'dividend', `Withdrawal from ${o.name} treasury`);
  o.heat = clamp(o.heat + Math.min(12, amount / dollars(25000)), 0, 100);
  return ok(`Moved ${money(amount)} to your personal account. Heat increased.`);
}

export function transferToOrg(state: GameState, amount: number): ActionResult {
  const o = playerOrganization(state);
  if (!o) return fail('You have no organization.');
  if (amount <= 0) return fail('Enter a positive amount.');
  if (balance(state, PLAYER) < amount) return fail('You do not have that much cash.');
  transfer(state, PLAYER, orgAccount(o.id), amount, 'capital_injection', `Funding ${o.name}`);
  return ok(`Moved ${money(amount)} into the ${o.name} treasury.`);
}

export const FOUNDING_COST = dollars(25000);

/** Start an organization (for legitimate backgrounds). */
export function foundOrganization(state: GameState, name: string, district: DistrictId): ActionResult {
  if (playerOrganization(state)) return fail('You already run an organization.');
  const t = name.trim();
  if (t.length < 3 || t.length > 32) return fail('Name it with 3–32 characters.');
  if (Object.values(state.organizations).some((o) => o.name.toLowerCase() === t.toLowerCase())) return fail('That name is taken.');
  if (balance(state, PLAYER) < FOUNDING_COST) return fail(`You need ${money(FOUNDING_COST)} to start an organization.`);
  const org: Organization = {
    id: 'player-org',
    name: t,
    controlledBy: 'player',
    leader: state.player.name,
    members: [
      { id: 'pm-0', name: state.player.name, rank: 'boss', loyalty: 100, skill: Math.max(25, state.player.streetCred), weeklyCut: 0 },
      ...Array.from({ length: 2 }, (_, i) => ({ id: `pm-f${i}`, name: `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`, rank: 'associate' as const, loyalty: randInt(state, 60, 80), skill: randInt(state, 35, 55), weeklyCut: dollars(500) })),
    ],
    influence: 6,
    heat: 5,
    territory: [],
    posture: 'active',
    description: 'A new organization with something to prove.',
    ...blankOrgFields(),
  };
  state.organizations[org.id] = org;
  state.balances[orgAccount(org.id)] = 0;
  transfer(state, PLAYER, orgAccount(org.id), FOUNDING_COST, 'capital_injection', `Founding ${t}`);
  moveShare(state, district, org.id, null, 4);
  refreshTerritoryList(state, org);
  addNews(state, 'underworld', 'neutral', `Word spreads of a new crew in ${DISTRICTS[district].name}`, `They call themselves ${t}.`);
  return ok(`${t} is up and running with two associates and a small foothold in ${DISTRICTS[district].name}.`);
}

/* ------------------------------------------------------------------ */
/* Situations                                                           */
/* ------------------------------------------------------------------ */

function newSituation(state: GameState, o: Organization, s: Omit<Situation, 'id' | 'expiresDay'>): void {
  state.counters.op++;
  o.situations.push({ ...s, id: `sit${state.counters.op}`, expiresDay: state.day + 14 });
}

function maybeCreateSituation(state: GameState, o: Organization): void {
  if (o.situations.length >= 2 || !chance(state, 0.22)) return;
  const options: (() => boolean)[] = [
    () => {
      const m = o.members.find((x) => x.rank !== 'boss' && x.skill > 50 && x.loyalty < 60);
      if (!m) return false;
      newSituation(state, o, {
        kind: 'demand_cut',
        title: `${m.name} wants a bigger cut`,
        body: `${m.name} (${m.rank}, skill ${m.skill}) says they're worth more than ${money(m.weeklyCut)} a week, and other people have noticed.`,
        options: [
          { id: 'agree', label: 'Agree', detail: `Cut rises 50%. Loyalty +25.` },
          { id: 'refuse', label: 'Refuse', detail: 'Loyalty −20. They might walk, and take contacts with them.' },
        ],
        defaultOption: 'refuse',
        memberId: m.id,
      });
      return true;
    },
    () => {
      if (o.investigation < 45) return false;
      const m = o.members.filter((x) => x.rank !== 'boss').sort((a, b) => b.skill - a.skill)[0];
      if (!m) return false;
      newSituation(state, o, {
        kind: 'investigation_target',
        title: `Investigators lean on ${m.name}`,
        body: `The case against ${o.name} is focusing on ${m.name}. What happens next depends on you.`,
        options: [
          { id: 'defend', label: `Pay for their defense (${money(dollars(20000))})`, detail: 'Case −15. Their loyalty +15.' },
          { id: 'cut', label: 'Cut them loose', detail: 'They leave the organization. Case −30. Everyone else loses 10 loyalty.' },
        ],
        defaultOption: 'cut',
        memberId: m.id,
        amount: dollars(20000),
      });
      return true;
    },
    () => {
      const rivals = Object.values(state.organizations).filter((x) => x.controlledBy === 'npc' && !o.pacts[x.id] && relationOf(o, x.id) > -40);
      if (!rivals.length) return false;
      const t = pick(state, rivals);
      const amount = dollars(randInt(state, 8, 20) * 1000);
      newSituation(state, o, {
        kind: 'rival_offer',
        title: `${t.name} proposes a truce`,
        body: `${t.leader} sends word: pay ${money(amount)} as a gesture and both sides keep to their own turf.`,
        options: [
          { id: 'accept', label: `Pay ${money(amount)}`, detail: 'Truce agreed. Relations +30.' },
          { id: 'decline', label: 'Decline', detail: 'Relations −10.' },
        ],
        defaultOption: 'decline',
        orgId: t.id,
        amount,
      });
      return true;
    },
    () => {
      const amount = dollars(randInt(state, 20, 60) * 1000);
      newSituation(state, o, {
        kind: 'opportunity',
        title: 'A contact offers a big score',
        body: `Someone you've worked with has a lucrative, risky opportunity. It could bring in around ${money(amount)}.`,
        options: [
          { id: 'take', label: 'Take it', detail: '55% chance of the money and +5 influence; otherwise heat +15.' },
          { id: 'pass', label: 'Pass', detail: 'Nothing happens.' },
        ],
        defaultOption: 'pass',
        amount,
      });
      return true;
    },
  ];
  // Try in a random order until one fits.
  const order = options.map((f, i) => ({ f, k: nextRandom(state) + i * 0 })).sort((a, b) => a.k - b.k);
  for (const { f } of order) if (f()) return;
}

export function resolveSituation(state: GameState, situationId: string, optionId: string): ActionResult {
  const o = playerOrganization(state);
  const s = o?.situations.find((x) => x.id === situationId);
  if (!o || !s) return fail('That situation has passed.');
  const m = s.memberId ? o.members.find((x) => x.id === s.memberId) : undefined;
  const acct = orgAccount(o.id);
  let msg = '';
  switch (s.kind) {
    case 'demand_cut':
      if (!m) break;
      if (optionId === 'agree') {
        m.weeklyCut = Math.round(m.weeklyCut * 1.5);
        m.loyalty = clamp(m.loyalty + 25, 0, 100);
        msg = `${m.name}'s cut is now ${money(m.weeklyCut)} a week.`;
      } else {
        m.loyalty = clamp(m.loyalty - 20, 0, 100);
        if (chance(state, 0.35)) {
          o.members = o.members.filter((x) => x.id !== m.id);
          o.influence = clamp(o.influence - 4, 0, 100);
          const rival = pick(state, Object.values(state.organizations).filter((x) => x.controlledBy === 'npc'));
          if (rival) rival.influence = clamp(rival.influence + 3, 0, 100);
          msg = `${m.name} walked out${rival ? ` and joined ${rival.name}` : ''}. Influence −4.`;
          addNews(state, 'underworld', 'negative', `${m.name} defects`, msg);
        } else msg = `${m.name} backs down, unhappy.`;
      }
      break;
    case 'investigation_target':
      if (optionId === 'defend') {
        if (balance(state, acct) < (s.amount ?? 0)) return fail(`The treasury needs ${money(s.amount ?? 0)}.`);
        transfer(state, acct, WORLD, s.amount ?? 0, 'org_upkeep', `Legal defense for ${m?.name ?? 'a member'}`);
        o.investigation = clamp(o.investigation - 15, 0, 100);
        if (m) m.loyalty = clamp(m.loyalty + 15, 0, 100);
        msg = 'The defense holds. The case slows down.';
      } else {
        if (m) o.members = o.members.filter((x) => x.id !== m.id);
        o.investigation = clamp(o.investigation - 30, 0, 100);
        for (const x of o.members) if (x.rank !== 'boss') x.loyalty = clamp(x.loyalty - 10, 0, 100);
        msg = `${m?.name ?? 'They'} took the fall. The case loses momentum, but your people noticed.`;
      }
      break;
    case 'rival_offer':
      if (!s.orgId) break;
      if (optionId === 'accept') {
        if (balance(state, acct) < (s.amount ?? 0)) return fail(`The treasury needs ${money(s.amount ?? 0)}.`);
        transfer(state, acct, WORLD, s.amount ?? 0, 'org_upkeep', `Truce payment to ${state.organizations[s.orgId]?.name}`);
        changeRelation(state, o, s.orgId, 30);
        o.pacts[s.orgId] = 'truce';
        msg = `Truce agreed with ${state.organizations[s.orgId]?.name}.`;
      } else {
        changeRelation(state, o, s.orgId, -10);
        msg = 'Offer declined.';
      }
      break;
    case 'opportunity':
      if (optionId === 'take') {
        if (chance(state, 0.55)) {
          transfer(state, WORLD, acct, s.amount ?? 0, 'org_income', 'A risky opportunity paid off');
          o.influence = clamp(o.influence + 5, 0, 100);
          msg = `It paid off: ${money(s.amount ?? 0)} into the treasury.`;
        } else {
          o.heat = clamp(o.heat + 15, 0, 100);
          msg = 'It went bad. Heat +15.';
        }
      } else msg = 'You passed.';
      break;
    case 'defector':
      break;
  }
  o.situations = o.situations.filter((x) => x.id !== s.id);
  return ok(msg || 'Done.');
}

/* ------------------------------------------------------------------ */
/* Weekly                                                              */
/* ------------------------------------------------------------------ */

function npcWeekly(state: GameState, npc: Organization, player: Organization | null): void {
  const def = NPC_ORGS.find((d) => d.id === npc.id);
  const aggression = def?.aggression ?? 0.3;
  npc.influence = clamp(npc.influence + gaussian(state) * 0.6 + (totalTurf(state, npc.id) / 4 - npc.influence) * 0.03, 5, 95);
  npc.heat = clamp(npc.heat + gaussian(state) * 1.2 - 0.2, 0, 100);
  // Expand into open turf in or near their districts.
  if (chance(state, 0.45)) {
    const own = DISTRICT_ORDER.filter((d) => shareOf(state, npc.id, d) > 0 && unclaimed(state, d) > 2);
    const pool = own.length ? own : DISTRICT_ORDER.filter((d) => unclaimed(state, d) > 10);
    if (pool.length) moveShare(state, pick(state, pool), npc.id, null, randInt(state, 2, 5));
  }
  if (!player) {
    refreshTerritoryList(state, npc);
    return;
  }
  // Relations slowly drift back toward neutral.
  const rel = relationOf(player, npc.id);
  if (rel < 0) changeRelation(state, player, npc.id, 1);
  if (player.pacts[npc.id]) {
    refreshTerritoryList(state, npc);
    return;
  }
  const war = atWar(player, npc.id);
  const contested = DISTRICT_ORDER.filter((d) => shareOf(state, player.id, d) > 0 && (shareOf(state, npc.id, d) > 0 || war));
  if (contested.length && chance(state, war ? 0.6 : aggression * 0.35)) {
    const d = pick(state, contested);
    const took = moveShare(state, d, npc.id, player.id, randInt(state, 3, war ? 10 : 6));
    if (took > 0) {
      changeRelation(state, player, npc.id, -5);
      addNews(state, 'underworld', 'negative', `${npc.name} pushes into your turf`, `You lost ${Math.round(took)}% of ${DISTRICTS[d].name}. You hold ${Math.round(shareOf(state, player.id, d))}% there now.`);
      // In open conflict they may hit one of your legitimate businesses in that district.
      if (war && chance(state, 0.35)) {
        const target = playerCompanies(state).find((c) => companyDistricts(state, c).includes(d));
        if (target) {
          state.counters.modifier++;
          state.modifiers.push({ id: `m${state.counters.modifier}`, kind: 'demand', district: d, industry: target.industry, companyId: target.id, mult: 0.8, untilDay: state.day + 10, label: `Trouble from ${npc.name}` });
          addNews(state, 'underworld', 'negative', `${target.name} caught up in the conflict`, `Customers are staying away for now (−20% demand for 10 days).`, { companyId: target.id });
        }
      }
    }
  }
  refreshTerritoryList(state, npc);
}

function raid(state: GameState, o: Organization): void {
  const acct = orgAccount(o.id);
  const seized = Math.round(Math.max(0, balance(state, acct)) * 0.3);
  if (seized > 0) transfer(state, acct, WORLD, seized, 'event', 'Assets seized in raid');
  const gone: string[] = [];
  for (let i = 0; i < 2; i++) {
    const g = loseMember(state, o, o.members.filter((m) => m.rank !== 'boss').map((m) => m.id), 'was arrested');
    if (g) gone.push(g);
  }
  o.influence = clamp(o.influence - 10, 0, 100);
  for (const d of DISTRICT_ORDER) setShare(state, o.id, d, shareOf(state, o.id, d) * 0.8);
  o.heat = 40;
  o.investigation = 0;
  o.operations = [];
  state.player.reputation = clamp(state.player.reputation - 6, 0, 100);
  refreshTerritoryList(state, o);
  addNews(state, 'underworld', 'negative', `Raid on ${o.name}`, `A fictional task force closed its case. ${money(seized)} seized, a fifth of your turf lost. ${gone.join(' ')} Your public reputation suffered too.`);
}

export function simulateOrganizationsWeekly(state: GameState): void {
  const player = playerOrganization(state);
  for (const npc of Object.values(state.organizations)) if (npc.controlledBy === 'npc') npcWeekly(state, npc, player);
  if (!player) return;
  const o = player;
  const acct = orgAccount(o.id);
  const income = Math.round(weeklyOrgIncome(state, o) * (0.85 + nextRandom(state) * 0.3));
  transfer(state, WORLD, acct, income, 'org_income', `${o.name} weekly take from turf`);
  const upkeep = weeklyOrgUpkeep(o);
  const treasury = balance(state, acct);
  if (treasury >= upkeep) {
    transfer(state, acct, WORLD, upkeep, 'org_upkeep', `${o.name} member cuts`);
    for (const m of o.members) m.loyalty = clamp(m.loyalty + 0.3, 0, 100);
  } else {
    transfer(state, acct, WORLD, Math.max(0, treasury), 'org_upkeep', `${o.name} partial member cuts`);
    for (const m of o.members) if (m.rank !== 'boss') m.loyalty = clamp(m.loyalty - 6, 0, 100);
    addNews(state, 'underworld', 'negative', `${o.name} cannot pay its people`, 'Members went unpaid this week. Loyalty is slipping.');
  }
  const turf = totalTurf(state, o.id);
  o.heat = clamp(o.heat + (o.posture === 'low' ? -2.5 : 0.2 + turf * 0.008) + gaussian(state) * 0.4, 0, 100);
  o.influence = clamp(o.influence + (Math.min(95, 5 + turf / 4) - o.influence) * 0.1, 0, 100);
  if (o.heat > 60) state.player.reputation = clamp(state.player.reputation - 0.5, 0, 100);
  // The case builds with heat and fades when things are quiet.
  o.investigation = clamp(o.investigation + (o.heat > 35 ? (o.heat - 35) / 5 : o.heat < 25 ? -3 : 0), 0, 100);
  if (o.investigation >= 100) raid(state, o);
  // Disloyal members walk away.
  for (const m of [...o.members]) {
    if (m.rank !== 'boss' && m.loyalty < 20 && chance(state, 0.25)) {
      o.members = o.members.filter((x) => x.id !== m.id);
      addNews(state, 'underworld', 'negative', `${m.name} leaves ${o.name}`, 'Unpaid and disillusioned, a member has walked away.');
    }
  }
  // Expired decisions resolve with their default.
  for (const s of [...o.situations]) if (s.expiresDay <= state.day) resolveSituation(state, s.id, s.defaultOption);
  maybeCreateSituation(state, o);
  refreshTerritoryList(state, o);
}
