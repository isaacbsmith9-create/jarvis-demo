/**
 * Layout mode: 'phone' or 'desktop'.
 * A page can force a mode by setting window.__BILLIONAIRE_LAYOUT before the app loads
 * ('phone' | 'desktop'); otherwise narrow screens get the phone layout automatically.
 */
import { useSyncExternalStore } from 'react';

export type Layout = 'phone' | 'desktop';

const forced = (typeof window !== 'undefined' ? (window as unknown as { __BILLIONAIRE_LAYOUT?: string }).__BILLIONAIRE_LAYOUT : undefined) as Layout | 'auto' | undefined;
const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
const listeners = new Set<() => void>();

function compute(): Layout {
  if (forced === 'phone' || forced === 'desktop') return forced;
  return query?.matches ? 'phone' : 'desktop';
}

let current: Layout = compute();

function apply() {
  current = compute();
  if (typeof document !== 'undefined') document.documentElement.dataset.layout = current;
  for (const l of listeners) l();
}

apply();
query?.addEventListener?.('change', apply);

export function getLayout(): Layout {
  return current;
}

export function useLayout(): Layout {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
