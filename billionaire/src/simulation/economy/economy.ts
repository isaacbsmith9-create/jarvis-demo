import { DISTRICTS, DISTRICT_ORDER } from '../../data/cities/miami';
import type { DistrictId, EconomyState, GameState, IndustryId } from '../../types/core';
import { monthOf, weekday } from '../../utils/date';
import { clamp } from '../../utils/format';
import { gaussian } from '../../utils/rng';

export function createEconomy(): EconomyState {
  const districts = {} as EconomyState['districts'];
  for (const id of DISTRICT_ORDER) districts[id] = { id, demand: 1, priceIndex: 1, trend: DISTRICTS[id].appreciation / 365 };
  return { index: 100, indexHistory: [{ day: 0, value: 100 }], interestRate: 0.065, consumerConfidence: 62, districts };
}

/** Daily macro update: mean-reverting market index, district demand and property price drift. */
export function updateEconomy(state: GameState): void {
  const e = state.economy;
  const shock = gaussian(state) * 0.35;
  const reversion = (100 - e.index) * 0.004;
  e.index = clamp(e.index + reversion + shock + 0.012, 55, 190);
  e.consumerConfidence = clamp(e.consumerConfidence + (e.index - 100) * 0.002 + gaussian(state) * 0.4 + (62 - e.consumerConfidence) * 0.01, 10, 95);
  // Interest rates drift slowly against the economy.
  if (state.day % 30 === 0) {
    e.interestRate = clamp(e.interestRate + (e.index > 108 ? 0.0025 : e.index < 92 ? -0.0025 : 0) + gaussian(state) * 0.001, 0.03, 0.11);
  }
  for (const id of DISTRICT_ORDER) {
    const d = e.districts[id];
    const base = DISTRICTS[id].appreciation / 365;
    const macro = (e.index - 100) * 0.00002;
    d.trend = d.trend * 0.98 + (base + macro) * 0.02 + gaussian(state) * 0.00002;
    d.priceIndex = clamp(d.priceIndex * (1 + d.trend), 0.4, 4);
    d.demand = clamp(d.demand + (1 - d.demand) * 0.02 + gaussian(state) * 0.01 + (e.consumerConfidence - 60) * 0.00005, 0.6, 1.5);
  }
  if (state.day % 7 === 0) {
    e.indexHistory.push({ day: state.day, value: Math.round(e.index * 100) / 100 });
    if (e.indexHistory.length > 260) e.indexHistory.shift();
  }
  // Expire modifiers
  state.modifiers = state.modifiers.filter((m) => m.untilDay >= state.day);
}

/** Miami seasonality: winter high season, soft late summer / hurricane season. */
export function seasonality(day: number, kind: 'tourism' | 'local'): number {
  const m = monthOf(day);
  const tourism = [1.3, 1.35, 1.38, 1.2, 1.0, 0.88, 0.9, 0.82, 0.72, 0.85, 1.05, 1.28][m];
  if (kind === 'tourism') return tourism;
  return 1 + (tourism - 1) * 0.35;
}

/** Day of week factor for consumer businesses. */
export function weekdayFactor(day: number, profile: 'dining' | 'nightlife' | 'retail' | 'office' | 'hotel'): number {
  const w = weekday(day);
  switch (profile) {
    case 'dining':
      return [1.15, 0.72, 0.8, 0.88, 1.0, 1.35, 1.45][w];
    case 'nightlife':
      return [0.85, 0, 0, 0, 0.7, 1.25, 1.4][w];
    case 'retail':
      return [1.2, 0.85, 0.85, 0.9, 0.95, 1.1, 1.35][w];
    case 'office':
      return [0.1, 1.05, 1.1, 1.1, 1.05, 0.95, 0.15][w];
    case 'hotel':
      return [0.95, 0.85, 0.88, 0.92, 1.0, 1.18, 1.22][w];
  }
}

/** Product of active demand modifiers for a district/industry/company. */
export function modifierMult(state: GameState, district: DistrictId | null, industry: IndustryId, companyId?: string): number {
  let m = 1;
  for (const mod of state.modifiers) {
    if (mod.companyId && mod.companyId !== companyId) continue;
    if (mod.district !== 'all' && mod.district !== district) continue;
    if (mod.industry !== 'all' && mod.industry !== industry) continue;
    m *= mod.mult;
  }
  return m;
}

export function macroDemand(state: GameState): number {
  return 0.75 + (state.economy.index / 100) * 0.15 + (state.economy.consumerConfidence / 100) * 0.2;
}
