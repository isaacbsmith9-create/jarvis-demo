import { roleDef, SUBTYPES } from '../../data/companies/industries';
import { FIRST_NAMES, LAST_NAMES, TRAIT_IDS, TRAITS } from '../../data/employees/names';
import type { Company, Employee, GameState, Money, TraitId } from '../../types/core';
import { clamp, dollars } from '../../utils/format';
import { chance, gaussian, nextRandom, pick, randInt } from '../../utils/rng';

export function generateEmployee(state: GameState, company: Company, roleId: string, skillRange?: [number, number]): Employee {
  const role = roleDef(company.subtype, roleId);
  if (!role) throw new Error(`Unknown role ${roleId} for ${company.subtype}`);
  const skill = skillRange ? randInt(state, skillRange[0], skillRange[1]) : clamp(Math.round(50 + gaussian(state) * 15), 15, 95);
  const traits: TraitId[] = [];
  const nTraits = chance(state, 0.6) ? 1 : chance(state, 0.5) ? 2 : 0;
  while (traits.length < nTraits) {
    const t = pick(state, TRAIT_IDS);
    if (!traits.includes(t)) traits.push(t);
  }
  const salaryFactor = 0.68 + (skill / 100) * 0.7 + gaussian(state) * 0.04;
  const salary = dollars(Math.round((role.baseSalary * salaryFactor) / 500) * 500);
  state.counters.employee++;
  return {
    id: `e${state.counters.employee}`,
    name: `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`,
    role: roleId,
    companyId: null,
    salary,
    skill,
    performance: clamp(Math.round(55 + gaussian(state) * 10), 20, 90),
    loyalty: clamp(Math.round(60 + gaussian(state) * 10 + traits.reduce((s, t) => s + TRAITS[t].loyalty, 0)), 15, 98),
    traits,
    hiredDay: state.day,
    age: randInt(state, 21, 58),
  };
}

/** Refresh the hiring pool: a few candidates per role. */
export function refreshCandidates(state: GameState, company: Company): void {
  const sub = SUBTYPES[company.subtype];
  const pool: Employee[] = [];
  for (const role of sub.roles) {
    const n = role.id === sub.primaryRole ? 3 : role.manager ? 1 : 2;
    for (let i = 0; i < n; i++) pool.push(generateEmployee(state, company, role.id));
  }
  company.candidates = pool;
}

/** Effective contribution of one employee (0..~1.3). */
export function effectiveness(e: Employee, managerBoost = 0): number {
  const traitPerf = e.traits.reduce((s, t) => s + TRAITS[t].perf, 0);
  const perf = clamp(e.performance + traitPerf + managerBoost, 0, 110);
  return (e.skill / 100) * (0.55 + (perf / 100) * 0.55);
}

export function companyStaff(state: GameState, company: Company): Employee[] {
  return company.employeeIds.map((id) => state.employees[id]).filter(Boolean);
}

/** Manager boost: best manager's skill raises everyone's performance. */
export function managerBoost(state: GameState, company: Company): number {
  let best = 0;
  for (const e of companyStaff(state, company)) {
    if (roleDef(company.subtype, e.role)?.manager) best = Math.max(best, e.skill);
  }
  return best > 0 ? 4 + best * 0.1 : 0;
}

export function hasManager(state: GameState, company: Company): boolean {
  return managerBoost(state, company) > 0;
}

/** Sum of effectiveness for a role, including the owner-operator if applicable. */
export function roleCapacity(state: GameState, company: Company, roleId: string): number {
  const boost = managerBoost(state, company);
  let s = 0;
  for (const e of companyStaff(state, company)) if (e.role === roleId) s += effectiveness(e, boost);
  if (company.ownerOperated && roleId === SUBTYPES[company.subtype].primaryRole) {
    s += (state.player.businessSkill / 100) * 0.95;
  }
  return s;
}

/**
 * Throughput units for a role: every worker contributes a base 0.5 plus their effectiveness,
 * so even weak staff produce something. The owner-operator counts as one worker.
 */
export function roleUnits(state: GameState, company: Company, roleId: string): number {
  const boost = managerBoost(state, company);
  let s = 0;
  for (const e of companyStaff(state, company)) if (e.role === roleId) s += 0.5 + effectiveness(e, boost);
  if (company.ownerOperated && roleId === SUBTYPES[company.subtype].primaryRole) {
    s += 0.5 + (state.player.businessSkill / 100) * 0.95;
  }
  return s;
}

export function roleCount(state: GameState, company: Company, roleId: string): number {
  return companyStaff(state, company).filter((e) => e.role === roleId).length;
}

export function avgSkill(state: GameState, company: Company, roleId?: string): number {
  const staff = companyStaff(state, company).filter((e) => !roleId || e.role === roleId);
  if (!staff.length) return company.ownerOperated ? state.player.businessSkill : 0;
  return staff.reduce((s, e) => s + e.skill, 0) / staff.length;
}

export function dailyPayroll(state: GameState, company: Company): Money {
  let s = 0;
  for (const e of companyStaff(state, company)) s += e.salary;
  return Math.round(s / 365);
}

/** Daily drift in performance and loyalty; occasional skill growth. */
export function updateEmployees(state: GameState, company: Company, distressed: boolean): void {
  const staff = companyStaff(state, company);
  const boost = managerBoost(state, company);
  const hasMentor = staff.some((e) => e.traits.includes('mentor'));
  for (const e of staff) {
    const market = (roleDef(company.subtype, e.role)?.baseSalary ?? 40000) * (0.68 + (e.skill / 100) * 0.7);
    const payRatio = e.salary / 100 / market;
    const volatile = e.traits.includes('volatile') ? gaussian(state) * 4 : 0;
    const targetPerf = clamp(55 + boost * 1.2 + (payRatio - 1) * 40 + (distressed ? -15 : 0), 10, 98);
    e.performance = clamp(e.performance + (targetPerf - e.performance) * 0.03 + gaussian(state) * 0.8 + volatile, 0, 100);
    const ambitious = e.traits.includes('ambitious') ? -0.04 : 0;
    const targetLoyalty = clamp(60 + (payRatio - 1) * 70 + boost * 0.6 + (distressed ? -25 : 0) + (e.traits.includes('loyal') ? 15 : 0), 0, 100);
    e.loyalty = clamp(e.loyalty + (targetLoyalty - e.loyalty) * 0.01 + ambitious + gaussian(state) * 0.3, 0, 100);
    const growth = (hasMentor ? 0.025 : 0.012) * (e.traits.includes('ambitious') ? 1.6 : 1) * (e.skill < 85 ? 1 : 0.3);
    if (nextRandom(state) < growth) e.skill = Math.min(99, e.skill + 1);
  }
}

export function staffNeedsSummary(state: GameState, company: Company): string[] {
  const sub = SUBTYPES[company.subtype];
  const notes: string[] = [];
  if (roleCapacity(state, company, sub.primaryRole) === 0) notes.push(`No ${roleDef(company.subtype, sub.primaryRole)?.title}: the business cannot operate.`);
  return notes;
}
