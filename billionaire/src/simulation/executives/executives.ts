/**
 * Executive team: empire-level officers paid from your personal cash.
 *  - COO: lifts staff performance in every company and can run delegated
 *    companies that have no manager of their own.
 *  - CFO: sweeps idle company cash up to you each week (optional) and
 *    negotiates lower interest on your loans.
 *  - CMO: makes every marketing dollar work harder and lowers acquisition costs.
 */
import { FIRST_NAMES, LAST_NAMES, TRAIT_IDS, TRAITS } from '../../data/employees/names';
import type { Company, ExecRole, Executive, GameState, TraitId } from '../../types/core';
import { clamp, dollars, money } from '../../utils/format';
import { chance, gaussian, pick, randInt } from '../../utils/rng';
import { addNews } from '../events/news';
import { balance, companyAccount, PLAYER, transfer, WORLD } from '../finance/ledger';
import { fail, ok, type ActionResult } from '../result';

export const EXEC_ROLES: Record<ExecRole, { title: string; short: string; baseSalary: number; description: string; effect: (skill: number) => string }> = {
  coo: {
    title: 'Chief Operating Officer',
    short: 'COO',
    baseSalary: 210000,
    description: 'Runs operations across the empire. Raises staff performance in every company, and runs delegated companies that have no manager of their own.',
    effect: (s) => `+${Math.round(execValue(s) * 20)} staff performance in every company`,
  },
  cfo: {
    title: 'Chief Financial Officer',
    short: 'CFO',
    baseSalary: 190000,
    description: 'Manages the money. Each week moves idle company cash above a safe buffer to you (optional), and negotiates lower interest on all your loans.',
    effect: (s) => `−${(execValue(s) * 1.5).toFixed(2)}% interest on loans; weekly cash sweep`,
  },
  cmo: {
    title: 'Chief Marketing Officer',
    short: 'CMO',
    baseSalary: 175000,
    description: 'Owns the brand. Every marketing dollar brings more customers, and user or order acquisition gets cheaper.',
    effect: (s) => `+${Math.round(execValue(s) * 100)}% marketing effect`,
  },
};

export const EXEC_ORDER: ExecRole[] = ['coo', 'cfo', 'cmo'];

/** 0.1 .. ~0.6 strength from skill. */
export function execValue(skill: number): number {
  return 0.1 + skill / 200;
}

export function getExec(state: GameState, role: ExecRole): Executive | undefined {
  return state.executives.find((e) => e.role === role);
}

/** Strength of an executive's effect on one of your companies (0 for businesses you don't own). */
export function execBonus(state: GameState, c: Pick<Company, 'owner'>, role: ExecRole): number {
  if (c.owner !== 'player') return 0;
  const e = getExec(state, role);
  if (!e) return 0;
  return execValue(e.skill) * (0.75 + e.loyalty / 400);
}

function makeExec(state: GameState, role: ExecRole): Executive {
  const skill = clamp(Math.round(62 + gaussian(state) * 14), 30, 96);
  const traits: TraitId[] = [];
  if (chance(state, 0.7)) traits.push(pick(state, TRAIT_IDS));
  const base = EXEC_ROLES[role].baseSalary;
  return {
    id: `x${state.day}-${role}-${randInt(state, 1000, 9999)}`,
    name: `${pick(state, FIRST_NAMES)} ${pick(state, LAST_NAMES)}`,
    role,
    salary: dollars(Math.round((base * (0.6 + (skill / 100) * 0.8)) / 1000) * 1000),
    skill,
    loyalty: clamp(Math.round(65 + gaussian(state) * 8 + (traits.includes('loyal') ? 12 : 0)), 30, 95),
    traits,
    age: randInt(state, 34, 63),
    hiredDay: state.day,
  };
}

export function refreshExecCandidates(state: GameState): void {
  const out: Executive[] = [];
  for (const role of EXEC_ORDER) for (let i = 0; i < 2; i++) out.push(makeExec(state, role));
  state.execCandidates = out;
}

export function hireExecutive(state: GameState, candidateId: string): ActionResult {
  const c = state.execCandidates.find((x) => x.id === candidateId);
  if (!c) return fail('That candidate is no longer available.');
  const current = getExec(state, c.role);
  if (current) return fail(`You already have a ${EXEC_ROLES[c.role].short} (${current.name}). Let them go first.`);
  state.execCandidates = state.execCandidates.filter((x) => x.id !== c.id);
  state.executives.push({ ...c, hiredDay: state.day });
  addNews(state, 'business', 'positive', `${c.name} joins as ${EXEC_ROLES[c.role].title}`, `${state.player.name} has hired a new ${EXEC_ROLES[c.role].short} on ${money(c.salary)} a year.`);
  return ok(`${c.name} is your new ${EXEC_ROLES[c.role].short}.`);
}

export function fireExecutive(state: GameState, execId: string): ActionResult {
  const e = state.executives.find((x) => x.id === execId);
  if (!e) return fail('Executive not found.');
  const severance = Math.round(e.salary / 12);
  transfer(state, PLAYER, WORLD, severance, 'severance', `Severance — ${e.name} (${EXEC_ROLES[e.role].short})`);
  state.executives = state.executives.filter((x) => x.id !== e.id);
  return ok(`${e.name} has left with ${money(severance)} severance.`);
}

export function raiseExecutive(state: GameState, execId: string): ActionResult {
  const e = state.executives.find((x) => x.id === execId);
  if (!e) return fail('Executive not found.');
  e.salary = Math.round((e.salary * 1.1) / 100000) * 100000;
  e.loyalty = clamp(e.loyalty + 12, 0, 100);
  return ok(`${e.name}'s salary is now ${money(e.salary)} a year.`);
}

export function setCashSweep(state: GameState, on: boolean): ActionResult {
  state.settings.cashSweep = on;
  return ok(on ? 'Your CFO will move idle company cash to you every Monday.' : 'Cash sweep turned off.');
}

/** Daily: pay executive salaries from personal cash. */
export function payExecutives(state: GameState): void {
  if (!state.executives.length) return;
  const total = state.executives.reduce((s, e) => s + Math.round(e.salary / 365), 0);
  transfer(state, PLAYER, WORLD, total, 'payroll', 'Executive salaries');
}

/** Weekly: loyalty drift, resignations, and the CFO's cash sweep. */
export function executivesWeekly(state: GameState): void {
  const broke = balance(state, PLAYER) < 0;
  for (const e of [...state.executives]) {
    const market = EXEC_ROLES[e.role].baseSalary * (0.6 + (e.skill / 100) * 0.8);
    const pay = e.salary / 100 / market;
    const target = clamp(60 + (pay - 1) * 70 + (broke ? -30 : 0) + (e.traits.includes('loyal') ? 15 : 0) + (e.traits.includes('ambitious') ? -8 : 0), 0, 100);
    e.loyalty = clamp(e.loyalty + (target - e.loyalty) * 0.08 + gaussian(state) * 0.6, 0, 100);
    if (e.loyalty < 25 && chance(state, 0.25)) {
      state.executives = state.executives.filter((x) => x.id !== e.id);
      addNews(state, 'staff', 'negative', `${e.name} resigns as ${EXEC_ROLES[e.role].short}`, broke ? 'Your personal cash ran dry and their pay was at risk.' : 'They felt underpaid. Raises keep executives loyal.');
    }
    if (e.skill < 95 && chance(state, 0.03)) e.skill++;
  }
  const cfo = getExec(state, 'cfo');
  if (cfo && state.settings.cashSweep) {
    let moved = 0;
    for (const c of Object.values(state.companies)) {
      if (c.owner !== 'player' || c.status !== 'operating') continue;
      const recent = c.history.slice(-30);
      const dailyCost = recent.length ? recent.reduce((s, d) => s + d.expenses, 0) / recent.length : 0;
      const buffer = Math.max(dollars(20000), Math.round(dailyCost * 45));
      const excess = balance(state, companyAccount(c.id)) - buffer;
      if (excess > dollars(1000)) {
        transfer(state, companyAccount(c.id), PLAYER, excess, 'dividend', `CFO cash sweep from ${c.name}`);
        moved += excess;
      }
    }
    if (moved > 0) addNews(state, 'finance', 'neutral', `CFO moves ${money(moved)} to your account`, `${cfo.name} swept idle cash above each company's safety buffer (45 days of costs, at least $20K).`);
  }
}

/** Interest-rate reduction the CFO negotiates on loans (annual rate, absolute). */
export function cfoRateCut(state: GameState): number {
  const cfo = getExec(state, 'cfo');
  return cfo ? (execValue(cfo.skill) * 1.5) / 100 : 0;
}

export { TRAITS };
