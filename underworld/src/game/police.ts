// Police AI: patrol the road graph, chase on sight when heat is high,
// bust the player on contact. Pure logic; Police.tsx only draws.

import * as THREE from 'three';
import { HEAT } from './config';
import {
  mulberry32, nearestNode, nodeNeighbors, nodePos, NODES_X, NODES_Z, PRECINCT_NODE,
} from './city';
import { PoliceUnit, resolveCircleVsAABBs, segmentHit, world } from './world';

export const CAR_RADIUS = 1.3;
export const MAX_UNITS = HEAT.patrolUnits + HEAT.extraUnitsPerStar * HEAT.wanted.length;
const LANE = 2.2;
const rand = mulberry32(2024);
let nextId = 1;

function spawn(node: number): PoliceUnit {
  const p = nodePos(node);
  const nbrs = nodeNeighbors(node);
  return {
    id: nextId++,
    pos: new THREE.Vector3(p.x, 0, p.z),
    heading: 0,
    mode: 'patrol',
    prevNode: node,
    targetNode: nbrs[Math.floor(rand() * nbrs.length)],
    speed: 0,
  };
}

export function initPolice() {
  world.police = [];
  const total = NODES_X * NODES_Z;
  for (let i = 0; i < HEAT.patrolUnits; i++) {
    let n = Math.floor(rand() * total);
    // don't start right on top of the player
    const pp = nodePos(n);
    if (Math.hypot(pp.x - world.player.pos.x, pp.z - world.player.pos.z) < 40) n = (n + 17) % total;
    world.police.push(spawn(n));
  }
}

// ---- BFS distance field toward the player, refreshed a few times a second ----
const dist = new Int16Array(NODES_X * NODES_Z);
let fieldTimer = 0;
function refreshField(target: number) {
  dist.fill(-1);
  const q = [target];
  dist[target] = 0;
  while (q.length) {
    const n = q.shift()!;
    for (const m of nodeNeighbors(n)) {
      if (dist[m] === -1) {
        dist[m] = dist[n] + 1;
        q.push(m);
      }
    }
  }
}

function pickPatrolNext(u: PoliceUnit) {
  const nbrs = nodeNeighbors(u.targetNode).filter((n) => n !== u.prevNode);
  const choice = nbrs[Math.floor(rand() * nbrs.length)] ?? u.prevNode;
  u.prevNode = u.targetNode;
  u.targetNode = choice;
}

function pickChaseNext(u: PoliceUnit) {
  const nbrs = nodeNeighbors(u.targetNode);
  let best = nbrs[0];
  for (const n of nbrs) if (dist[n] < dist[best]) best = n;
  u.prevNode = u.targetNode;
  u.targetNode = best;
}

const tmp = new THREE.Vector3();

export interface PoliceEvents {
  busted: boolean;
  anyChasing: boolean;
  spotted: boolean;
}

/** Advance all police. `stars` scales unit count and pursuit speed. */
export function updatePolice(dt: number, heat: number, stars: number): PoliceEvents {
  const ev: PoliceEvents = { busted: false, anyChasing: false, spotted: false };
  const player = world.player.pos;

  // reinforcements roll out of the precinct as wanted level rises
  const wantUnits = HEAT.patrolUnits + HEAT.extraUnitsPerStar * stars;
  if (world.police.length < wantUnits) world.police.push(spawn(PRECINCT_NODE));
  else if (world.police.length > wantUnits) {
    // stand down off-screen so cars don't pop out of existence in view
    const idx = world.police.findIndex(
      (u) => u.mode !== 'chase' && Math.hypot(u.pos.x - player.x, u.pos.z - player.z) > 70,
    );
    if (idx >= 0 && world.police.length > HEAT.patrolUnits) world.police.splice(idx, 1);
  }

  fieldTimer -= dt;
  if (fieldTimer <= 0) {
    fieldTimer = 0.4;
    refreshField(nearestNode(player.x, player.z));
  }

  world.bustedCooldown = Math.max(0, world.bustedCooldown - dt);
  const canChase = heat >= HEAT.chaseThreshold && world.bustedCooldown <= 0;
  const allPoints = stars >= 4; // dispatch: every unit knows where you are

  for (const u of world.police) {
    const dx = player.x - u.pos.x;
    const dz = player.z - u.pos.z;
    const d = Math.hypot(dx, dz);
    const los = d < HEAT.sightRange * 1.6 && segmentHit(u.pos.x, 1.2, u.pos.z, player.x, 1.2, player.z, world.colliders) >= 1;

    // ---- mode transitions ----
    if (u.mode === 'chase') {
      if (!canChase || d > HEAT.loseRange) {
        u.mode = 'patrol';
        u.prevNode = u.targetNode;
        u.targetNode = nearestNode(u.pos.x, u.pos.z);
      }
    } else if (canChase && ((d < HEAT.sightRange && los) || allPoints)) {
      u.mode = 'chase';
      ev.spotted = true;
      u.targetNode = nearestNode(u.pos.x, u.pos.z);
    }

    // ---- steering target ----
    let tx: number;
    let tz: number;
    if (u.mode === 'chase' && los && d < HEAT.sightRange * 1.6) {
      tx = player.x;
      tz = player.z;
    } else {
      const np = nodePos(u.targetNode);
      const pp = nodePos(u.prevNode);
      // drive in the right-hand lane
      let fx = np.x - pp.x;
      let fz = np.z - pp.z;
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      tx = np.x - fz * LANE;
      tz = np.z + fx * LANE;
      if (Math.hypot(tx - u.pos.x, tz - u.pos.z) < 2.5) {
        if (u.mode === 'chase') pickChaseNext(u);
        else pickPatrolNext(u);
      }
    }

    // ---- move ----
    const want = Math.atan2(tx - u.pos.x, tz - u.pos.z);
    let diff = want - u.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turnRate = u.mode === 'chase' ? 4.5 : 3;
    u.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const topSpeed = u.mode === 'chase' ? HEAT.chaseSpeed + 0.12 * stars : HEAT.patrolSpeed;
    // slow down for sharp turns
    const target = topSpeed * (1 - Math.min(0.65, Math.abs(diff) / Math.PI));
    u.speed += (target - u.speed) * (1 - Math.exp(-2.5 * dt));
    u.pos.x += Math.sin(u.heading) * u.speed * dt;
    u.pos.z += Math.cos(u.heading) * u.speed * dt;
    resolveCircleVsAABBs(u.pos, CAR_RADIUS, world.colliders);

    if (u.mode === 'chase') {
      ev.anyChasing = true;
      if (d < HEAT.bustRange + CAR_RADIUS && world.bustedCooldown <= 0) ev.busted = true;
    }
  }

  // keep cars from stacking on each other
  for (let i = 0; i < world.police.length; i++) {
    for (let j = i + 1; j < world.police.length; j++) {
      const a = world.police[i].pos;
      const b = world.police[j].pos;
      tmp.subVectors(a, b);
      tmp.y = 0;
      const l = tmp.length();
      const min = CAR_RADIUS * 2;
      if (l > 0.001 && l < min) {
        tmp.multiplyScalar((min - l) / l / 2);
        a.add(tmp);
        b.sub(tmp);
      }
    }
  }
  return ev;
}

/** After a bust every unit breaks off and resumes patrol. */
export function standDown() {
  for (const u of world.police) {
    if (u.mode === 'chase') {
      u.mode = 'patrol';
      u.prevNode = u.targetNode;
      u.targetNode = nearestNode(u.pos.x, u.pos.z);
    }
  }
}
