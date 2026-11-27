import type { GameState } from '../types/core';
import { SCHEMA_VERSION } from '../simulation/newGame';

/**
 * Save validation and migration. Saves carry a schemaVersion; older saves are
 * migrated step by step, newer or malformed saves are rejected with a reason.
 */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a version-n save to version n+1. */
export const MIGRATIONS: Record<number, Migration> = {};

export class SaveValidationError extends Error {}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function req(cond: boolean, msg: string): void {
  if (!cond) throw new SaveValidationError(msg);
}

export function migrate(raw: unknown): Record<string, unknown> {
  req(isObj(raw), 'Save data is not an object.');
  let data = raw as Record<string, unknown>;
  let v = data.schemaVersion;
  req(typeof v === 'number' && Number.isInteger(v), 'Save has no schema version.');
  req((v as number) <= SCHEMA_VERSION, `Save was created by a newer version of the game (schema ${v}).`);
  while ((v as number) < SCHEMA_VERSION) {
    const m = MIGRATIONS[v as number];
    req(!!m, `No migration from schema ${v}.`);
    data = m(data);
    v = data.schemaVersion;
  }
  return data;
}

/** Structural validation of a (migrated) save. Throws SaveValidationError on problems. */
export function validateState(raw: unknown): GameState {
  const data = migrate(raw);
  req(typeof data.day === 'number' && data.day >= 0, 'Invalid game date.');
  req(typeof data.rng === 'number', 'Missing random state.');
  req(isObj(data.player) && typeof (data.player as Record<string, unknown>).name === 'string', 'Missing player profile.');
  req(isObj(data.balances), 'Missing balances.');
  for (const [k, v] of Object.entries(data.balances as Record<string, unknown>)) req(typeof v === 'number' && Number.isFinite(v), `Corrupt balance for ${k}.`);
  req(isObj(data.ledger) && Array.isArray((data.ledger as Record<string, unknown>).entries), 'Missing ledger.');
  req(isObj(data.properties), 'Missing properties.');
  for (const p of Object.values(data.properties as Record<string, unknown>)) {
    req(isObj(p) && typeof p.id === 'string' && typeof p.value === 'number' && isObj(p.lot) && isObj(p.use), 'Corrupt property record.');
  }
  req(isObj(data.companies), 'Missing companies.');
  for (const c of Object.values(data.companies as Record<string, unknown>)) {
    req(isObj(c) && typeof c.id === 'string' && isObj(c.ops) && isObj(c.settings) && Array.isArray(c.employeeIds) && isObj(c.current), 'Corrupt company record.');
  }
  req(isObj(data.employees), 'Missing employees.');
  req(isObj(data.rivals), 'Missing competitors.');
  req(isObj(data.organizations), 'Missing organizations.');
  req(Array.isArray(data.loans), 'Missing loans.');
  req(isObj(data.economy) && isObj((data.economy as Record<string, unknown>).districts), 'Missing economy.');
  req(Array.isArray(data.news), 'Missing news.');
  req(isObj(data.objective), 'Missing objective.');
  req(isObj(data.counters) && isObj(data.stats), 'Missing counters.');
  // Referential integrity: employees belong to existing companies.
  const companies = data.companies as Record<string, { employeeIds: string[] }>;
  const employees = data.employees as Record<string, unknown>;
  for (const c of Object.values(companies)) for (const id of c.employeeIds) req(!!employees[id], 'Company references a missing employee.');
  return data as unknown as GameState;
}
