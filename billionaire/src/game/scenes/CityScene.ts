import Phaser from 'phaser';
import { DISTRICTS, districtAt, enumerateLots, MAP_H, MAP_W, terrainAt, type Lot } from '../../data/cities/miami';
import type { DistrictId, GameState, Property } from '../../types/core';
import { hashRandom } from '../../utils/rng';
import { toGrid, toScreen, TH } from '../rendering/iso';
import { buildingCanvas, drawBuilding, fillerBuildingSpec, generateDecorTextures, generateGroundTextures, propertyBuildingSpec } from '../rendering/textures';

/** Interface the scene uses to talk to the outside world (React store). */
export interface CityBridge {
  getState(): GameState | null;
  onSelectProperty(id: string | null): void;
  onSelectDistrict(id: DistrictId | null): void;
  onHover(info: { propertyId: string | null; district: DistrictId | null; x: number; y: number } | null): void;
  subscribe(fn: () => void): () => void;
  getSelection(): { propertyId: string | null; district: DistrictId | null; filter: DistrictId | null };
  consumeFocus(): string | null;
  /** Construction progress 0..1 while buildings are generated over several frames. */
  onProgress(ratio: number): void;
}

type MarkerKind = 'player' | 'rival' | 'sale' | 'lease' | 'none';

interface PropertySprite {
  id: string;
  image: Phaser.GameObjects.Image;
  overlay: Phaser.GameObjects.Image;
  beacon: Phaser.GameObjects.Image;
  marker: MarkerKind;
  textureKey: string;
  anchor: { x: number; y: number };
  baseY: number;
}

interface Car {
  sprite: Phaser.GameObjects.Image;
  axis: 'x' | 'y';
  line: number;
  pos: number;
  dir: 1 | -1;
  speed: number;
  min: number;
  max: number;
}

export class CityScene extends Phaser.Scene {
  private bridge!: CityBridge;
  private props = new Map<string, PropertySprite>();
  private cars: Car[] = [];
  private boats: { sprite: Phaser.GameObjects.Image; t: number; speed: number; path: { x: number; y: number }[] }[] = [];
  private selectOverlay!: Phaser.GameObjects.Image;
  private hoverOverlay!: Phaser.GameObjects.Image;
  private districtLabels: Phaser.GameObjects.Text[] = [];
  private dragging = false;
  private dragStart = { x: 0, y: 0, sx: 0, sy: 0 };
  private hoverId: string | null = null;
  private unsub: (() => void) | null = null;
  private lastSig = '';
  private lastFilter: DistrictId | null = null;
  private buildQueue: Lot[] = [];
  private buildTotal = 0;
  private propLots = new Map<string, Property>();

  constructor() {
    super('city');
  }

  init(data: { bridge: CityBridge }) {
    this.bridge = data.bridge;
  }

  create() {
    generateGroundTextures(this);
    generateDecorTextures(this);
    this.cameras.main.setBackgroundColor('#0b1a26');
    this.buildGround();
    this.buildBuildings();
    this.buildTraffic();
    this.buildLabels();

    this.selectOverlay = this.add.image(0, 0, 'o-select').setOrigin(0.5, 0).setVisible(false).setDepth(5);
    this.hoverOverlay = this.add.image(0, 0, 'o-hover').setOrigin(0.5, 0).setVisible(false).setDepth(4);

    this.setupCamera();
    this.setupInput();
    this.syncFromState(true);
    this.unsub = this.bridge.subscribe(() => this.syncFromState(false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsub?.());
  }

  /* ------------------------------------------------------------ */
  /* Construction                                                  */
  /* ------------------------------------------------------------ */

  private tileKey(x: number, y: number): string {
    const t = terrainAt(x, y);
    const v = Math.floor(hashRandom(x, y, 1) * 3);
    switch (t) {
      case 'ocean':
        return `t-ocean-${v}`;
      case 'bay':
        return `t-bay-${v}`;
      case 'river':
        return `t-river-${v}`;
      case 'sand':
        return 't-sand';
      case 'park':
        return 't-park';
      case 'plaza':
        return 't-plaza';
      case 'bridge':
        return x >= 34 && x <= 40 ? 't-bridge-x' : 't-bridge-y';
      case 'road': {
        const alongY = x <= 33 ? x % 6 === 0 : x === 43 || x === 47;
        const alongX = x <= 33 ? y % 6 === 0 : y % 5 === 0;
        return alongX && alongY ? 't-road-both' : alongY ? 't-road-y' : 't-road-x';
      }
      default: {
        const d = districtAt(x, y) ?? 'downtown';
        return `t-ground-${d}`;
      }
    }
  }

  private buildGround() {
    // Extend water beyond the map edges so the city sits in the sea.
    for (let y = -6; y < MAP_H + 6; y++) {
      for (let x = -6; x < MAP_W + 6; x++) {
        const inside = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
        let key: string;
        if (inside) key = this.tileKey(x, y);
        else if (x >= 34 || y < 0 || y >= MAP_H) key = `t-ocean-${Math.floor(hashRandom(x + 100, y + 100) * 3)}`;
        else key = `t-ground-${districtAt(Math.max(0, x), Math.max(0, Math.min(MAP_H - 1, y))) ?? 'littlehavana'}`;
        if (!inside && x < 0) key = 't-ground-littlehavana';
        const p = toScreen(x + 0.5, y + 0.5);
        this.add.image(p.x, p.y, key).setDepth(-10000);
      }
    }
    // Decoration: palms, park trees and street lamps.
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = terrainAt(x, y);
        const r = hashRandom(x, y, 21);
        const p = toScreen(x + 0.5, y + 0.5);
        const depth = (x + y + 1) * 10;
        if (t === 'park' && r < 0.55) {
          const palmy = (districtAt(x, y) ?? '') !== 'wynwood';
          this.add.image(p.x + (r - 0.3) * 18, p.y + 4, palmy && r < 0.25 ? 'palm' : 'tree').setOrigin(0.5, 0.9).setDepth(depth);
        } else if (t === 'plaza') {
          const d = districtAt(x, y);
          if ((d === 'southbeach' || d === 'waterfront' || d === 'brickell') && r < 0.45) this.add.image(p.x, p.y + 6, 'palm').setOrigin(0.5, 0.92).setDepth(depth);
          else if (r < 0.12) this.add.image(p.x, p.y + 4, 'tree').setOrigin(0.5, 0.9).setDepth(depth);
        } else if (t === 'sand' && x === 51 && y % 3 === 0) {
          this.add.image(p.x, p.y, 'palm').setOrigin(0.5, 0.9).setDepth(depth);
        } else if (t === 'road' && x <= 33 && x % 6 === 0 && y % 6 === 3 && r < 0.7) {
          this.add.image(p.x + 18, p.y - 2, 'lamp').setOrigin(0.5, 0.95).setDepth(depth);
        }
      }
    }
  }

  /** Queue every lot; buildings are generated a few per frame (nearest the camera first) so the UI never freezes. */
  private buildBuildings() {
    const state = this.bridge.getState();
    if (state) for (const p of Object.values(state.properties)) this.propLots.set(`${p.lot.x},${p.lot.y}`, p);
    this.buildQueue = enumerateLots().sort((a, b) => Math.hypot(a.x - 27, a.y - 27) - Math.hypot(b.x - 27, b.y - 27));
    this.buildTotal = this.buildQueue.length;
    this.bridge.onProgress(0);
  }

  private processBuildQueue() {
    const t0 = performance.now();
    while (this.buildQueue.length && performance.now() - t0 < 12) this.buildLot(this.buildQueue.shift()!);
    const done = this.buildTotal - this.buildQueue.length;
    this.bridge.onProgress(done / this.buildTotal);
    if (!this.buildQueue.length) {
      this.lastSig = '';
      this.syncFromState(true);
    }
  }

  private buildLot(lot: Lot) {
    {
      const prop = this.propLots.get(`${lot.x},${lot.y}`);
      const A = toScreen(lot.x, lot.y);
      const depth = (lot.x + lot.y + 4) * 10;
      if (prop) {
        const seed = Math.floor(hashRandom(lot.x, lot.y, 3) * 1e6);
        const spec = propertyBuildingSpec(prop.district, prop.type, prop.sqft, seed);
        const key = `bp-${prop.id}`;
        drawBuilding(this, key, spec);
        const c = buildingCanvas(spec.height);
        const img = this.add.image(A.x, A.y, key).setOrigin(c.anchorX / c.width, c.anchorY / c.height).setDepth(depth);
        const overlay = this.add.image(A.x, A.y, 'o-player').setOrigin(0.5, 0).setDepth(depth - 1).setVisible(false);
        const topY = A.y - spec.height - 6 + TH;
        const beacon = this.add.image(A.x, topY, 'b-player').setOrigin(0.5, 1).setDepth(depth + 1).setVisible(false);
        this.tweens.add({ targets: beacon, y: topY - 5, duration: 1300 + hashRandom(lot.x, lot.y) * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.props.set(prop.id, { id: prop.id, image: img, overlay, beacon, marker: 'none', textureKey: key, anchor: { x: c.anchorX, y: c.anchorY }, baseY: topY });
      } else {
        const spec = fillerBuildingSpec(lot.district, lot.x, lot.y);
        const variant = Math.floor(hashRandom(lot.x, lot.y, 17) * 4);
        const bucket = Math.round(spec.height / 24);
        const key = `bf-${lot.district}-${spec.style}-${variant}-${bucket}`;
        const h = Math.max(18, bucket * 24);
        drawBuilding(this, key, { ...spec, height: h, seed: variant * 7919 + bucket });
        const c = buildingCanvas(h);
        this.add.image(A.x, A.y, key).setOrigin(c.anchorX / c.width, c.anchorY / c.height).setDepth(depth);
      }
    }
  }

  private buildTraffic() {
    const roadsX: number[] = [];
    for (let y = 6; y < MAP_H; y += 6) if (y !== 33) roadsX.push(y);
    const roadsY: number[] = [];
    for (let x = 0; x <= 30; x += 6) roadsY.push(x);
    for (let i = 0; i < 34; i++) {
      const axis: 'x' | 'y' = i % 2 === 0 ? 'x' : 'y';
      const island = i % 5 === 0;
      let line: number;
      let min: number;
      let max: number;
      if (island) {
        line = axis === 'y' ? [43, 47][i % 2] : [5, 10, 15, 20, 25, 30, 35, 40, 45, 50][i % 10];
        min = axis === 'y' ? 0 : 41;
        max = axis === 'y' ? MAP_H - 1 : 49;
      } else {
        line = axis === 'x' ? roadsX[i % roadsX.length] : roadsY[i % roadsY.length];
        min = 0;
        max = axis === 'x' ? 33 : MAP_H - 1;
      }
      if (axis === 'x' && (line === 9 || line === 28) && !island) max = 49; // causeways cross the bay
      const color = Math.floor(hashRandom(i, 3) * 6);
      const sprite = this.add.image(0, 0, `car-${axis}-${color}`).setOrigin(0.5, 0.7);
      const dir: 1 | -1 = hashRandom(i, 9) < 0.5 ? 1 : -1;
      this.cars.push({ sprite, axis, line, pos: min + hashRandom(i, 5) * (max - min), dir, speed: 1.2 + hashRandom(i, 7) * 1.4, min, max });
    }
    // Causeway cars
    for (let i = 0; i < 6; i++) {
      const line = i % 2 ? 9 : 28;
      const sprite = this.add.image(0, 0, `car-x-${i % 6}`).setOrigin(0.5, 0.7);
      const dir: 1 | -1 = i < 3 ? 1 : -1;
      this.cars.push({ sprite, axis: 'x', line, pos: 30 + i * 3, dir, speed: 2 + i * 0.2, min: 24, max: 49 });
    }
    // Boats in the bay
    for (let i = 0; i < 7; i++) {
      const gx = 35 + hashRandom(i, 1) * 4.5;
      const path = [toScreen(gx, 2 + hashRandom(i, 2) * 5), toScreen(gx + 0.6, 52 - hashRandom(i, 3) * 6)];
      const sprite = this.add.image(path[0].x, path[0].y, 'boat').setDepth(-5000);
      this.boats.push({ sprite, t: hashRandom(i, 4), speed: 0.006 + hashRandom(i, 5) * 0.008, path });
    }
  }

  private buildLabels() {
    const centers: Record<DistrictId, [number, number]> = {
      wynwood: [16, 8],
      downtown: [24, 24],
      brickell: [24, 44],
      littlehavana: [7, 36],
      southbeach: [46, 41],
      waterfront: [46, 13],
    };
    for (const [id, [gx, gy]] of Object.entries(centers) as [DistrictId, [number, number]][]) {
      const p = toScreen(gx, gy);
      const t = this.add
        .text(p.x, p.y - 40, DISTRICTS[id].name.toUpperCase(), {
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: '30px',
          fontStyle: '600',
          color: '#efe6d2',
          stroke: '#0b0b0e',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(20000)
        .setAlpha(0.78);
      t.setLetterSpacing(6);
      this.districtLabels.push(t);
    }
  }

  private setupCamera() {
    const cam = this.cameras.main;
    const left = toScreen(0, MAP_H).x - 400;
    const right = toScreen(MAP_W, 0).x + 400;
    const top = toScreen(0, 0).y - 500;
    const bottom = toScreen(MAP_W, MAP_H).y + 300;
    cam.setBounds(left, top, right - left, bottom - top);
    cam.setZoom(0.62);
    const c = toScreen(28, 28);
    cam.centerOn(c.x, c.y);
    this.scale.on('resize', () => this.updateLabelScale());
    this.updateLabelScale();
  }

  zoomBy(f: number, px?: number, py?: number) {
    const cam = this.cameras.main;
    const old = cam.zoom;
    const nz = Phaser.Math.Clamp(old * f, 0.3, 2.2);
    if (px !== undefined && py !== undefined) {
      const before = cam.getWorldPoint(px, py);
      cam.setZoom(nz);
      const after = cam.getWorldPoint(px, py);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
    } else cam.setZoom(nz);
    this.updateLabelScale();
  }

  private updateLabelScale() {
    const z = this.cameras.main.zoom;
    for (const t of this.districtLabels) {
      t.setScale(Math.max(0.8, 0.9 / z));
      t.setAlpha(z > 1.3 ? 0.25 : 0.8);
    }
  }

  focusProperty(id: string) {
    const p = this.bridge.getState()?.properties[id];
    if (!p) return;
    const c = toScreen(p.lot.x + 1, p.lot.y + 1);
    const cam = this.cameras.main;
    const z = Math.max(cam.zoom, 1);
    if (cam.zoom < 1) cam.zoomTo(1, 400);
    // Offset to the left so the building isn't hidden behind the inspector panel on the right.
    cam.pan(c.x + 190 / z, c.y - 60, 450, 'Sine.easeInOut');
    this.time.delayedCall(420, () => this.updateLabelScale());
  }

  private setupInput() {
    const cam = this.cameras.main;
    // Second touch pointer for pinch-to-zoom on phones and tablets.
    this.input.addPointer(1);
    let pinch: { dist: number; zoom: number } | null = null;
    const touchDist = () => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        pinch = { dist: touchDist(), zoom: cam.zoom };
        this.dragging = true;
        return;
      }
      this.dragging = false;
      this.dragStart = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (pinch && this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const a = this.input.pointer1;
        const b = this.input.pointer2;
        const target = Phaser.Math.Clamp(pinch.zoom * (touchDist() / Math.max(1, pinch.dist)), 0.3, 2.2);
        this.zoomBy(target / cam.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (p.isDown) {
        const dx = p.x - this.dragStart.x;
        const dy = p.y - this.dragStart.y;
        if (!this.dragging && Math.hypot(dx, dy) > 8) this.dragging = true;
        if (this.dragging) {
          cam.scrollX = this.dragStart.sx - dx / cam.zoom;
          cam.scrollY = this.dragStart.sy - dy / cam.zoom;
          this.setHover(null, p);
        }
        return;
      }
      const hit = this.pick(p.worldX, p.worldY);
      this.setHover(hit, p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (pinch) {
        if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) pinch = null;
        // Resume single-finger drag from the remaining finger without a jump.
        const rest = this.input.pointer1.isDown ? this.input.pointer1 : this.input.pointer2.isDown ? this.input.pointer2 : null;
        if (rest) this.dragStart = { x: rest.x, y: rest.y, sx: cam.scrollX, sy: cam.scrollY };
        this.dragging = true;
        return;
      }
      if (this.dragging) {
        this.dragging = false;
        return;
      }
      const hit = this.pick(p.worldX, p.worldY);
      if (hit) {
        this.bridge.onSelectProperty(hit);
      } else {
        const g = toGrid(p.worldX, p.worldY);
        const d = g.gx >= 0 && g.gy >= 0 && g.gx < MAP_W && g.gy < MAP_H ? districtAt(Math.floor(g.gx), Math.floor(g.gy)) : null;
        this.bridge.onSelectDistrict(d);
      }
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? 0.9 : 1.1, p.x, p.y);
    });
    this.input.on('gameout', () => this.setHover(null));
    // Keyboard panning
    const keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.events.on('update', (_t: number, dt: number) => {
      if (!keys) return;
      const s = (0.6 * dt) / cam.zoom;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (keys.A.isDown || keys.LEFT.isDown) cam.scrollX -= s;
      if (keys.D.isDown || keys.RIGHT.isDown) cam.scrollX += s;
      if (keys.W.isDown || keys.UP.isDown) cam.scrollY -= s;
      if (keys.S.isDown || keys.DOWN.isDown) cam.scrollY += s;
    });
  }

  /** Pixel-accurate pick of a property building, falling back to its lot footprint. */
  private pick(wx: number, wy: number): string | null {
    const candidates = [...this.props.values()].sort((a, b) => b.image.depth - a.image.depth);
    for (const ps of candidates) {
      const img = ps.image;
      const lx = wx - (img.x - img.displayOriginX);
      const ly = wy - (img.y - img.displayOriginY);
      if (lx < 0 || ly < 0 || lx >= img.width || ly >= img.height) continue;
      const a = this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), ps.textureKey);
      if (a && a > 40) return ps.id;
    }
    const g = toGrid(wx, wy);
    const state = this.bridge.getState();
    if (!state) return null;
    for (const p of Object.values(state.properties)) {
      if (g.gx >= p.lot.x && g.gx < p.lot.x + p.lot.w && g.gy >= p.lot.y && g.gy < p.lot.y + p.lot.h) return p.id;
    }
    return null;
  }

  private setHover(id: string | null, p?: Phaser.Input.Pointer) {
    if (id !== this.hoverId) {
      if (this.hoverId) this.props.get(this.hoverId)?.image.clearTint();
      this.hoverId = id;
      if (id) {
        const ps = this.props.get(id)!;
        ps.image.setTint(0xfff3dc);
        this.hoverOverlay.setPosition(ps.image.x, ps.image.y).setVisible(true).setDepth(ps.image.depth - 0.5);
      } else this.hoverOverlay.setVisible(false);
    }
    if (!p) {
      this.bridge.onHover(null);
      return;
    }
    const g = toGrid(p.worldX, p.worldY);
    const d = g.gx >= 0 && g.gy >= 0 && g.gx < MAP_W && g.gy < MAP_H ? districtAt(Math.floor(g.gx), Math.floor(g.gy)) : null;
    this.bridge.onHover(id || d ? { propertyId: id, district: d, x: p.x, y: p.y } : null);
  }

  /* ------------------------------------------------------------ */
  /* State sync                                                    */
  /* ------------------------------------------------------------ */

  private syncFromState(force: boolean) {
    const state = this.bridge.getState();
    if (!state) return;
    const sel = this.bridge.getSelection();
    let sig = `${sel.propertyId}|${sel.filter}|`;
    for (const p of Object.values(state.properties)) sig += `${p.owner}${p.forSale !== null ? 's' : ''}${p.forLease ? 'l' : ''};`;
    const focus = this.bridge.consumeFocus();
    if (focus) this.focusProperty(focus);
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;

    for (const p of Object.values(state.properties)) {
      const ps = this.props.get(p.id);
      if (!ps) continue;
      const kind: MarkerKind =
        p.owner === 'player' || p.owner.startsWith('co:') ? 'player' : p.owner.startsWith('rival:') ? 'rival' : p.forSale !== null ? 'sale' : p.forLease ? 'lease' : 'none';
      if (kind !== ps.marker) {
        ps.marker = kind;
        ps.overlay.setVisible(kind !== 'none');
        ps.beacon.setVisible(kind !== 'none');
        if (kind !== 'none') {
          ps.overlay.setTexture(`o-${kind}`);
          ps.beacon.setTexture(`b-${kind}`);
        }
      }
      const dimmed = sel.filter !== null && p.district !== sel.filter;
      ps.image.setAlpha(dimmed ? 0.35 : 1);
      ps.beacon.setAlpha(dimmed ? 0.2 : 1);
    }
    if (sel.filter !== this.lastFilter) {
      this.lastFilter = sel.filter;
    }
    if (sel.propertyId && this.props.has(sel.propertyId)) {
      const ps = this.props.get(sel.propertyId)!;
      this.selectOverlay.setPosition(ps.image.x, ps.image.y).setVisible(true).setDepth(ps.image.depth - 0.4);
    } else this.selectOverlay.setVisible(false);
  }

  update(_time: number, delta: number) {
    if (this.buildQueue.length) this.processBuildQueue();
    const dt = delta / 1000;
    for (const car of this.cars) {
      car.pos += car.dir * car.speed * dt;
      if (car.pos > car.max) car.pos = car.min;
      if (car.pos < car.min) car.pos = car.max;
      const lane = car.dir === 1 ? 0.3 : 0.7;
      const gx = car.axis === 'x' ? car.pos : car.line + lane;
      const gy = car.axis === 'x' ? car.line + lane : car.pos;
      const s = toScreen(gx, gy);
      car.sprite.setPosition(s.x, s.y).setDepth((gx + gy) * 10 + 2);
    }
    for (const b of this.boats) {
      b.t += b.speed * dt;
      if (b.t > 1) b.t -= 1;
      const tt = b.t < 0.5 ? b.t * 2 : 2 - b.t * 2;
      const [a, c] = b.path;
      b.sprite.setPosition(a.x + (c.x - a.x) * tt, a.y + (c.y - a.y) * tt);
      b.sprite.setFlipX(b.t >= 0.5);
    }
  }
}
