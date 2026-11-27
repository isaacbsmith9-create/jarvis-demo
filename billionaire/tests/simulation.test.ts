import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../src/data/scenarios/scenarios';
import { closeBranch, foundCompany, hireEmployee, openBranch, quoteFounding, relocateBranch, updateSettings } from '../src/simulation/companies/companies';
import { buyBusiness, listedBusinesses } from '../src/simulation/companies/market';
import { buyStake, sellStake } from '../src/simulation/competitors/investments';
import { hasManager } from '../src/simulation/employees/employees';
import { fireExecutive, hireExecutive } from '../src/simulation/executives/executives';
import { LEDGER_WINDOW, ledgerConfig } from '../src/simulation/finance/ledger';
import { advanceDays } from '../src/simulation/engine';
import { balanceSheet, netWorth } from '../src/simulation/finance/valuation';
import { buyProperty, rentOut, sellProperty } from '../src/simulation/properties/propertyActions';
import { createNewGame } from '../src/simulation/newGame';
import type { GameState } from '../src/types/core';
import { validateState } from '../src/persistence/schema';
import { takeLoan } from '../src/simulation/finance/loans';

function totalBalances(s: GameState): number {
  return Object.values(s.balances).reduce((a, b) => a + b, 0);
}

/** Net money that entered the simulation from the outside world, per the ledger. */
function externalInflow(s: GameState): number {
  let n = 0;
  for (const tx of s.ledger.entries) {
    if (tx.from === 'world') n += tx.amount;
    if (tx.to === 'world') n -= tx.amount;
  }
  return n;
}

describe('new game', () => {
  it.each(SCENARIOS.map((s) => s.id))('creates scenario %s', (id) => {
    const s = createNewGame({ playerName: 'Test', scenarioId: id, seed: 'abc' });
    expect(s.player.scenarioId).toBe(id);
    expect(Number.isFinite(netWorth(s))).toBe(true);
    expect(totalBalances(s)).toBe(externalInflow(s));
  });

  it('fallen executive starts with negative net worth from explicit liabilities', () => {
    const s = createNewGame({ playerName: 'T', scenarioId: 'fallen', seed: 'x' });
    const bs = balanceSheet(s);
    expect(bs.loans).toBe(44400000);
    expect(bs.netWorth).toBeLessThan(0);
  });
});

describe('ledger', () => {
  it.each(SCENARIOS.map((s) => s.id))('conserves money over 300 days (%s)', (id) => {
    ledgerConfig.window = 1e9; // keep every entry so the whole history can be audited
    try {
      const s = createNewGame({ playerName: 'Test', scenarioId: id, seed: 'conserve' });
      advanceDays(s, 300);
      expect(s.ledger.archived.count).toBe(0);
      expect(totalBalances(s)).toBe(externalInflow(s));
      for (const v of Object.values(s.balances)) expect(Number.isInteger(v)).toBe(true);
    } finally {
      ledgerConfig.window = LEDGER_WINDOW;
    }
  });
});

describe('Alpha 0.2 systems', () => {
  function richCompany() {
    const s = createNewGame({ playerName: 'B', scenarioId: 'investor', seed: 'branches' });
    const plan = { subtype: 'convenience' as const, locationId: 'lh-07', locationMode: 'lease' as const };
    const c = s.companies[foundCompany(s, 'Esq', plan, quoteFounding(s, plan).recommended + 5000000).id!];
    return { s, c };
  }

  it('opens, staffs, moves and closes a second location', () => {
    const { s, c } = richCompany();
    const spot = Object.values(s.properties).find((p) => p.type === 'retail' && p.forLease && p.use.kind === 'vacant' && p.id !== 'lh-07')!;
    const res = openBranch(s, c.id, spot.id);
    expect(res.ok, res.message).toBe(true);
    expect(c.branches).toHaveLength(2);
    expect(s.properties[spot.id].use).toEqual({ kind: 'company', companyId: c.id });
    const cand = c.candidates.find((e) => e.role === 'cashier')!;
    expect(hireEmployee(s, c.id, cand.id, res.id).ok).toBe(true);
    expect(s.employees[cand.id].branchId).toBe(res.id);
    advanceDays(s, 20);
    expect(c.branches.every((b) => b.ops.kind === 'retail' && b.ops.lastCustomers > 0)).toBe(true);
    const next = Object.values(s.properties).find((p) => p.type === 'retail' && p.forLease && p.use.kind === 'vacant')!;
    expect(relocateBranch(s, c.id, res.id!, next.id).ok).toBe(true);
    expect(s.properties[spot.id].use.kind).toBe('vacant');
    expect(closeBranch(s, c.id, res.id!).ok).toBe(true);
    expect(c.branches).toHaveLength(1);
    expect(s.employees[cand.id].branchId).toBe('b1'); // moved, not fired
  });

  it('lists independent businesses with real track records and sells them', () => {
    const s = createNewGame({ playerName: 'B', scenarioId: 'investor', seed: 'market' });
    advanceDays(s, 35);
    const listed = listedBusinesses(s);
    expect(listed.length).toBeGreaterThan(0);
    const biz = listed[0];
    expect(biz.history.length).toBeGreaterThanOrEqual(21);
    const nw = netWorth(s);
    const r = buyBusiness(s, biz.id);
    expect(r.ok, r.message).toBe(true);
    expect(biz.owner).toBe('player');
    expect(netWorth(s)).toBeLessThan(nw); // the seller's premium isn't free
  });

  it('buys a rival stake, earns dividends, caps at 49%', () => {
    const s = createNewGame({ playerName: 'B', scenarioId: 'investor', seed: 'stake' });
    expect(buyStake(s, 'vela', 0.25).ok).toBe(true);
    expect(buyStake(s, 'vela', 0.25).ok).toBe(false);
    advanceDays(s, 70);
    expect(s.ledger.entries.some((t) => t.category === 'dividend' && t.from === 'rival:vela')).toBe(true);
    expect(balanceSheet(s).investments).toBeGreaterThan(0);
    expect(sellStake(s, 'vela', 0.25).ok).toBe(true);
    expect(s.rivals.vela.playerStake).toBe(0);
  });

  it('executives cost salary and have effects', () => {
    const { s, c } = richCompany();
    const coo = s.execCandidates.find((e) => e.role === 'coo')!;
    expect(hireExecutive(s, coo.id).ok).toBe(true);
    expect(hasManager(s, c)).toBe(true); // COO can run delegated companies
    expect(updateSettings(s, c.id, { delegated: true }).ok).toBe(true);
    advanceDays(s, 3);
    expect(s.ledger.entries.some((t) => t.memo === 'Executive salaries')).toBe(true);
    expect(fireExecutive(s, coo.id).ok).toBe(true);
    expect(s.executives).toHaveLength(0);
  });

  it('migrates a v1 save to branches', () => {
    const s = createNewGame({ playerName: 'Old', scenarioId: 'owner', seed: 'v1' });
    const raw = JSON.parse(JSON.stringify(s));
    for (const c of Object.values(raw.companies) as any[]) {
      c.locationId = c.branches[0].locationId;
      c.ops = c.branches[0].ops;
      c.equipment = c.branches[0].equipment;
      c.settings.stockTarget = c.branches[0].stockTarget;
      delete c.branches;
      delete c.nextBranch;
      delete c.listing;
    }
    for (const e of Object.values(raw.employees) as any[]) delete e.branchId;
    delete raw.executives;
    delete raw.execCandidates;
    delete raw.settings;
    raw.schemaVersion = 1;
    const m = validateState(raw);
    expect(m.schemaVersion).toBe(2);
    const cafe = Object.values(m.companies).find((c) => c.owner === 'player')!;
    expect(cafe.branches[0].locationId).toBe('lh-01');
    advanceDays(m, 10);
    expect(cafe.lifetime.revenue).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  it('same seed and actions produce identical states', () => {
    const run = () => {
      const s = createNewGame({ playerName: 'D', scenarioId: 'owner', seed: 'same-seed' });
      s.createdAt = 0;
      s.id = 'fixed';
      advanceDays(s, 120);
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});

describe('core gameplay loop', () => {
  it('entrepreneur leases a storefront, opens a store, hires and earns revenue', () => {
    const s = createNewGame({ playerName: 'E', scenarioId: 'entrepreneur', seed: 'loop' });
    const plan = { subtype: 'convenience' as const, locationId: 'lh-07', locationMode: 'lease' as const };
    const q = quoteFounding(s, plan);
    expect(q.errors).toEqual([]);
    expect(q.minimum).toBeLessThanOrEqual(2500000);
    const res = foundCompany(s, 'Esquina Market', plan, q.minimum + 100000);
    expect(res.ok).toBe(true);
    const c = s.companies[res.id!];
    const cashier = c.candidates.find((e) => e.role === 'cashier')!;
    expect(hireEmployee(s, c.id, cashier.id).ok).toBe(true);
    advanceDays(s, 60);
    expect(c.lifetime.revenue).toBeGreaterThan(0);
    expect(c.statements.length).toBeGreaterThan(0);
    expect(c.history.length).toBe(60);
  });

  it('investor buys a property, rents it, then sells it', () => {
    const s = createNewGame({ playerName: 'I', scenarioId: 'investor', seed: 'prop' });
    const target = Object.values(s.properties).find((p) => p.forSale !== null && p.forSale < 300000000)!;
    const before = s.balances.player;
    expect(buyProperty(s, target.id).ok).toBe(true);
    expect(s.balances.player).toBeLessThan(before);
    expect(rentOut(s, target.id).ok).toBe(true);
    advanceDays(s, 45);
    const rent = s.ledger.entries.filter((t) => t.category === 'rental_income' && t.to === 'player');
    expect(rent.length).toBeGreaterThan(0);
    expect(sellProperty(s, target.id).ok).toBe(true);
    expect(s.properties[target.id].owner).toBe('private');
  });

  it('rejects invalid actions with clear messages', () => {
    const s = createNewGame({ playerName: 'N', scenarioId: 'nobody', seed: 'n' });
    const listed = Object.values(s.properties).find((p) => p.forSale !== null)!;
    const r = buyProperty(s, listed.id);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/need/);
    const hotel = foundCompany(s, 'X', { subtype: 'hotel', locationId: null, locationMode: 'none' }, 100);
    expect(hotel.ok).toBe(false);
    expect(takeLoan(s, 100000).ok).toBe(false);
  });

  it('nobody can freelance from home and grow', () => {
    const s = createNewGame({ playerName: 'N', scenarioId: 'nobody', seed: 'free' });
    const plan = { subtype: 'agency' as const, locationId: null, locationMode: 'none' as const };
    const q = quoteFounding(s, plan);
    expect(q.minimum).toBeLessThanOrEqual(50000 * 100);
    const r = foundCompany(s, 'Solo Dev', plan, q.minimum);
    expect(r.ok, r.message).toBe(true);
    const c = s.companies[r.id!];
    expect(c.ownerOperated).toBe(true);
    advanceDays(s, 180);
    expect(c.lifetime.revenue).toBeGreaterThan(0);
    expect(netWorth(s)).toBeGreaterThan(500000);
  });

  it('every industry runs for 90 days without NaN', () => {
    const s = createNewGame({ playerName: 'I', scenarioId: 'investor', seed: 'ind' });
    const plans = [
      { subtype: 'saas' as const, locationId: null, locationMode: 'none' as const },
      { subtype: 'agency' as const, locationId: null, locationMode: 'none' as const },
      { subtype: 'foodtruck' as const, locationId: null, locationMode: 'none' as const },
      { subtype: 'online' as const, locationId: null, locationMode: 'none' as const },
      { subtype: 'brokerage' as const, locationId: null, locationMode: 'none' as const },
      { subtype: 'restaurant' as const, locationId: 'brk-04', locationMode: 'lease' as const },
      { subtype: 'boutique' as const, locationId: 'sb-04', locationMode: 'lease' as const },
    ];
    for (const [i, plan] of plans.entries()) {
      const q = quoteFounding(s, plan);
      const r = foundCompany(s, `Co ${i}`, plan, q.recommended);
      expect(r.ok, r.message).toBe(true);
      const c = s.companies[r.id!];
      for (const cand of c.candidates.slice(0, 3)) hireEmployee(s, c.id, cand.id);
      updateSettings(s, c.id, { marketingPerDay: 20000 });
    }
    advanceDays(s, 90);
    for (const c of Object.values(s.companies)) {
      expect(Number.isFinite(c.lifetime.revenue)).toBe(true);
      expect(c.lifetime.revenue).toBeGreaterThan(0);
    }
    expect(Number.isFinite(netWorth(s))).toBe(true);
  });
});

describe('save validation', () => {
  it('accepts a round-tripped state', () => {
    const s = createNewGame({ playerName: 'S', scenarioId: 'double', seed: 's' });
    advanceDays(s, 10);
    const copy = JSON.parse(JSON.stringify(s));
    expect(() => validateState(copy)).not.toThrow();
  });
  it('rejects corrupted and future saves', () => {
    const s = createNewGame({ playerName: 'S', scenarioId: 'owner', seed: 's' });
    const bad = JSON.parse(JSON.stringify(s));
    bad.balances.player = 'lots';
    expect(() => validateState(bad)).toThrow(/Corrupt balance/);
    const future = JSON.parse(JSON.stringify(s));
    future.schemaVersion = 999;
    expect(() => validateState(future)).toThrow(/newer version/);
    expect(() => validateState(null)).toThrow();
  });
});
