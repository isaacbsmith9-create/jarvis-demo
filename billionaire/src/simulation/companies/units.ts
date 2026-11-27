/**
 * Branch views. A company is the financial entity; each branch is an operating
 * unit with its own location, operations state and staff. The industry rules run
 * on an OpUnit: the company seen through one branch.
 */
import type { Branch, Company, CompanyOps, DistrictId, GameState, Money, UnitSettings } from '../../types/core';

export type OpUnit = Company & {
  branchId: string;
  locationId: string | null;
  ops: CompanyOps;
  equipment: Money;
  settings: UnitSettings;
  isPrimary: boolean;
};

export function primaryBranch(c: Company): Branch {
  return c.branches[0];
}

export function findBranch(c: Company, branchId: string | null | undefined): Branch | undefined {
  return c.branches.find((b) => b.id === branchId);
}

/** Staff ids working at a branch. Staff with no (or an unknown) branch count toward the first one. */
export function branchStaffIds(state: GameState, c: Company, b: Branch): string[] {
  const first = c.branches[0]?.id;
  return c.employeeIds.filter((id) => {
    const e = state.employees[id];
    if (!e) return false;
    const bid = e.branchId && c.branches.some((x) => x.id === e.branchId) ? e.branchId : first;
    return bid === b.id;
  });
}

/** The company as seen through one branch. ops is shared by reference, so the rules update the branch. */
export function unitFor(state: GameState, c: Company, b: Branch): OpUnit {
  const isPrimary = b === c.branches[0];
  return {
    ...c,
    branchId: b.id,
    locationId: b.locationId,
    ops: b.ops,
    equipment: b.equipment,
    settings: { ...c.settings, stockTarget: b.stockTarget },
    employeeIds: branchStaffIds(state, c, b),
    ownerOperated: c.ownerOperated && isPrimary,
    isPrimary,
  };
}

export function companyEquipment(c: Company): Money {
  return c.branches.reduce((s, b) => s + b.equipment, 0);
}

export function companyLocationIds(c: Company): string[] {
  return c.branches.map((b) => b.locationId).filter((x): x is string => !!x);
}

/** Districts a company operates in (food trucks report where they parked last). */
export function companyDistricts(state: GameState, c: Company): DistrictId[] {
  const out: DistrictId[] = [];
  for (const b of c.branches) {
    const d = b.locationId ? state.properties[b.locationId]?.district : b.ops.kind === 'hospitality' ? b.ops.foodTruckDistrict : null;
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

export function branchLabel(state: GameState, c: Company, b: Branch): string {
  if (b.locationId) return state.properties[b.locationId]?.name ?? 'Location';
  const i = c.branches.indexOf(b) + 1;
  if (c.subtype === 'foodtruck') return `Truck ${i}`;
  return c.branches.length > 1 ? `Home office ${i}` : 'Home-based';
}
