import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BUSINESSES, ECONOMY, HEAT } from './config';
import { LAYOUT, SPAWN, ZONE_RADIUS } from './city';
import { incomePerTick, useGame, wantedStars } from './store';
import { initPolice, standDown, updatePolice } from './police';
import { isActionHeld } from './input';
import { world } from './world';

/** Mutable loop state shared with scene components (zone visuals read this). */
export const loop = {
  captureId: null as string | null,
  captureProgress: 0, // 0..1
  payoutTimer: ECONOMY.payoutInterval,
  heatAcc: 0, // fractional heat change not yet committed to the store
};

// Single place where game rules run each frame. Scene components only render.
export function GameLoop() {
  const actionWasHeld = useRef(false);
  const policeReady = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = useGame.getState();
    if (g.paused) return;
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

    // ---- police + heat ----
    if (!policeReady.current) {
      initPolice();
      policeReady.current = true;
    }
    const heat = useGame.getState().heat;
    const stars = wantedStars(heat);
    const ev = updatePolice(dt, heat, stars);
    if (ev.spotted && !g.chased) g.toast('Cops spotted you — run!', 'bad');
    if (ev.anyChasing !== g.chased) useGame.setState({ chased: ev.anyChasing });

    if (ev.busted) {
      const penalty = useGame.getState().bust();
      g.toast(`BUSTED — lost $${penalty.toLocaleString()}`, 'bad');
      standDown();
      world.bustedCooldown = 5;
      world.player.pos.set(SPAWN.x, 0, SPAWN.z);
      world.player.vel.set(0, 0, 0);
      loop.captureId = null;
      loop.captureProgress = 0;
      loop.heatAcc = 0;
    } else {
      // heat cools off — slowly while a unit is on your tail
      loop.heatAcc -= (ev.anyChasing ? HEAT.decayWhileChased : HEAT.decayPerSec) * dt;
      if (loop.heatAcc <= -1) {
        const whole = Math.ceil(loop.heatAcc);
        loop.heatAcc -= whole;
        if (heat > 0) g.setHeat(heat + whole);
      }
    }
  });

  return null;
}
