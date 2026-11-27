import type { GameState } from '../types/core';
import { SCHEMA_VERSION } from '../simulation/newGame';

/**
 * Save validation and migration. Saves carry a schemaVersion; older saves are
 * migrated step by step, newer or malformed saves are rejected with a reason.
 */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a version-n save to version n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  /** v1 → v2: companies get branches; executives, investments and the business market are added. */
  1: (raw) => {
    const d = raw as Record<string, any>;
    for (const c of Object.values(d.companies ?? {}) as any[]) {
      if (Array.isArray(c.branches)) continue;
      c.branches = [
        {
          id: 'b1',
          locationId: c.locationId ?? null,
          ops: c.ops,
          equipment: c.equipment ?? 0,
          stockTarget: c.settings?.stockTarget ?? 0,
          openedDay: c.foundedDay ?? 0,
        },
      ];
      c.nextBranch = 2;
      c.listing = null;
      c.owner = c.owner ?? 'player';
      delete c.locationId;
      delete c.ops;
      delete c.equipment;
      if (c.settings) delete c.settings.stockTarget;
    }
    for (const e of Object.values(d.employees ?? {}) as any[]) if (e.branchId === undefined) e.branchId = 'b1';
    for (const r of Object.values(d.rivals ?? {}) as any[]) {
      r.playerStake = r.playerStake ?? 0;
      r.stakeCost = r.stakeCost ?? 0;
    }
    d.executives = d.executives ?? [];
    d.execCandidates = d.execCandidates ?? [];
    d.settings = d.settings ?? { cashSweep: true };
    d.schemaVersion = 2;
    return d;
  },
  /** v2 → v3: district turf shares, operations, situations, investigations and pacts. */
  2: (raw) => {
    const d = raw as Record<string, any>;
    const districts = ['brickell', 'downtown', 'wynwood', 'southbeach', 'littlehavana', 'waterfront'];
    d.territory = d.territory ?? Object.fromEntries(districts.map((x) => [x, {}]));
    for (const o of Object.values(d.organizations ?? {}) as any[]) {
      o.pacts = o.pacts ?? {};
      o.operations = o.operations ?? [];
      o.situations = o.situations ?? [];
      o.investigation = o.investigation ?? Math.max(0, (o.heat ?? 0) - 30);
      o.lastCollect = o.lastCollect ?? {};
      const list: string[] = o.territory ?? [];
      const first = Math.max(4, Math.round((o.influence ?? 10) * 0.6));
      list.forEach((x, i) => {
        const t = d.territory[x];
        if (!t) return;
        const used = Object.values(t).reduce((a: number, v) => a + (v as number), 0) as number;
        t[o.id] = Math.max(0, Math.min(i === 0 ? first : Math.round(first * 0.6), 100 - used));
      });
    }
    d.counters = { ...d.counters, op: d.counters?.op ?? 0 };
    d.opReports = d.opReports ?? [];
    d.schemaVersion = 3;
    return d;
  },
};

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
    req(isObj(c) && typeof c.id === 'string' && Array.isArray(c.branches) && (c.branches as unknown[]).length > 0 && isObj(c.settings) && Array.isArray(c.employeeIds) && isObj(c.current), 'Corrupt company record.');
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
