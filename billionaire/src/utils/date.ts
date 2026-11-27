import type { Day } from '../types/core';

/** Campaign epoch: Monday, 4 January 2027. */
const EPOCH = Date.UTC(2027, 0, 4);
const MS_DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayToDate(day: Day): Date {
  return new Date(EPOCH + day * MS_DAY);
}
export function formatDate(day: Day): string {
  const d = dayToDate(day);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export function formatShortDate(day: Day): string {
  const d = dayToDate(day);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function weekdayName(day: Day): string {
  return WEEKDAYS[dayToDate(day).getUTCDay()];
}
/** 0 = Sunday ... 6 = Saturday */
export function weekday(day: Day): number {
  return dayToDate(day).getUTCDay();
}
/** 0..11 */
export function monthOf(day: Day): number {
  return dayToDate(day).getUTCMonth();
}
export function dayOfMonth(day: Day): number {
  return dayToDate(day).getUTCDate();
}
export function periodKey(day: Day): string {
  const d = dayToDate(day);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function formatPeriod(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}
export function isNewMonth(day: Day): boolean {
  return dayOfMonth(day) === 1;
}
