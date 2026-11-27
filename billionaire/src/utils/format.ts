import type { Money } from '../types/core';

/** Format cents as compact currency: $1.25M, $940K, $512 */
export function money(cents: Money, opts: { compact?: boolean; sign?: boolean } = {}): string {
  const { compact = true, sign = false } = opts;
  const v = Math.abs(cents) < 50 ? 0 : cents / 100;
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (compact && a >= 1e9) s = `$${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2)}B`;
  else if (compact && a >= 1e6) s = `$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  else if (compact && a >= 1e4) s = `$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  else s = `$${a.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (neg) return `−${s}`;
  return sign && v > 0 ? `+${s}` : s;
}

export function moneyFull(cents: Money): string {
  const v = cents / 100;
  const s = Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  return v < 0 ? `−${s}` : s;
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

/** Dollars (float) to integer cents. */
export function dollars(d: number): Money {
  return Math.round(d * 100);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
