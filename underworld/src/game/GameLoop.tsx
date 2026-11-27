import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BUSINESSES, ECONOMY } from './config';
import { LAYOUT, ZONE_RADIUS } from './city';
import { incomePerTick, useGame } from './store';
import { isActionHeld } from './input';
import { world } from './world';

/** Mutable loop state shared with scene components (zone visuals read this). */
export const loop = {
  captureId: null as string | null,
  captureProgress: 0, // 0..1
  payoutTimer: ECONOMY.payoutInterval,
};

// Single place where game rules run each frame. Scene components only render.
export function GameLoop() {
  const actionWasHeld = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = useGame.getState();
    const p = world.player.pos;

    // ---- which zone are we in? ----
    let zone: string | null = null;
    for (const s of LAYOUT.sites) {
      const dx = p.x - s.zx;
      const dz = p.z - s.zz;
      if (dx * dx + dz * dz < ZONE_RADIUS * ZONE_RADIUS) {
        zone = s.def.id;
        break;
      }
    }
    world.inZone = zone;
    if (g.zoneId !== zone) useGame.setState({ zoneId: zone });

    // ---- takeover: stand in an unowned zone ----
    if (zone && !g.owned[zone]) {
      const def = BUSINESSES.find((b) => b.id === zone)!;
      if (loop.captureId !== zone) {
        loop.captureId = zone;
        loop.captureProgress = 0;
      }
      loop.captureProgress += dt / def.captureTime;
      if (loop.captureProgress >= 1) {
        loop.captureProgress = 0;
        loop.captureId = null;
        g.takeOver(zone);
      }
    } else if (loop.captureId) {
      // leaving the zone bleeds progress quickly
      loop.captureProgress -= dt * 1.5;
      if (loop.captureProgress <= 0) {
        loop.captureProgress = 0;
        loop.captureId = null;
      }
    }
    // mirror to the store at 2% resolution so the HUD isn't re-rendered every frame
    const q = loop.captureId ? Math.round(loop.captureProgress * 50) / 50 : -1;
    const cur = g.capture ? g.capture.progress : -1;
    if (q !== cur || (g.capture?.id ?? null) !== loop.captureId) {
      useGame.setState({ capture: loop.captureId ? { id: loop.captureId, progress: q } : null });
    }

    // ---- upgrade on action press while in an owned zone ----
    const held = isActionHeld();
    if (held && !actionWasHeld.current && zone && g.owned[zone]) g.upgrade(zone);
    actionWasHeld.current = held;

    // ---- income tick ----
    loop.payoutTimer -= dt;
    if (loop.payoutTimer <= 0) {
      loop.payoutTimer += ECONOMY.payoutInterval;
      const income = incomePerTick(useGame.getState().owned);
      if (income > 0) {
        g.addCash(income);
        useGame.setState({ lastPayout: { amount: income, at: Date.now() } });
      }
    }
    const payoutIn = Math.ceil(loop.payoutTimer);
    if (payoutIn !== g.payoutIn) useGame.setState({ payoutIn });
  });

  return null;
}
