import Phaser from 'phaser';
import { hashRandom } from '../../utils/rng';
import { shade, TH, TW } from '../rendering/iso';

/**
 * Interior scene: an isometric headquarters floor that reflects the company's
 * real staff. Every desk figure is an actual employee; clicking one opens their
 * profile. The layout adapts to the business type.
 */
export interface InteriorStaff {
  id: string;
  name: string;
  title: string;
  role: string;
  performance: number;
}

export interface InteriorBridge {
  getData(): { companyName: string; kind: 'office' | 'hospitality' | 'retail'; staff: InteriorStaff[]; owner: string | null; capacity: number } | null;
  onSelectEmployee(id: string): void;
  onHover(info: { name: string; title: string; x: number; y: number } | null): void;
}

const ROOM_W = 12;
const ROOM_D = 9;
const WALL_H = 110;

const ROLE_COLORS: Record<string, number> = {};
const SHIRTS = [0x3a5a8a, 0x8a3a3a, 0x3a7a6a, 0x6a4a8a, 0xb08a3a, 0x4a4a52, 0x2f6f8f, 0x9a5a3a];

function iso(x: number, y: number, ox: number, oy: number) {
  return { x: ox + (x - y) * (TW / 2), y: oy + (x + y) * (TH / 2) };
}

export class OfficeScene extends Phaser.Scene {
  private bridge!: InteriorBridge;
  private figures: { id: string; container: Phaser.GameObjects.Container; name: string; title: string }[] = [];

  constructor() {
    super('office');
  }

  init(data: { bridge: InteriorBridge }) {
    this.bridge = data.bridge;
  }

  create() {
    const data = this.bridge.getData();
    this.cameras.main.setBackgroundColor('#0c0c0f');
    if (!data) return;
    const W = this.scale.width;
    const ox = W / 2 + 10;
    const oy = 150;
    const g = this.add.graphics();
    const P = (x: number, y: number) => iso(x, y, ox, oy);

    // Floor
    const floorBase = data.kind === 'hospitality' ? 0x4a3428 : data.kind === 'retail' ? 0x3d3e45 : 0x3e3630;
    for (let y = 0; y < ROOM_D; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        const a = P(x, y);
        const b = P(x + 1, y);
        const c = P(x + 1, y + 1);
        const d = P(x, y + 1);
        const tone = shade(floorBase, 0.92 + hashRandom(x, y) * 0.14);
        g.fillStyle(tone, 1);
        g.fillPoints([a, b, c, d] as Phaser.Types.Math.Vector2Like[], true);
        g.lineStyle(1, shade(floorBase, 0.75), 0.6);
        g.strokePoints([a, b, c, d] as Phaser.Types.Math.Vector2Like[], true);
      }
    }
    // Rug under the executive area
    const rug = [P(8.2, 0.8), P(11.4, 0.8), P(11.4, 3.6), P(8.2, 3.6)];
    g.fillStyle(0x5a4630, 0.9);
    g.fillPoints(rug as Phaser.Types.Math.Vector2Like[], true);
    g.lineStyle(1.5, 0xc8a35a, 0.6);
    g.strokePoints(rug as Phaser.Types.Math.Vector2Like[], true);

    // Back walls with skyline windows
    const wallL = 0x2a2b31;
    const wallR = 0x33343b;
    const back0 = P(0, 0);
    const backR = P(ROOM_W, 0);
    const backL = P(0, ROOM_D);
    g.fillStyle(wallR, 1);
    g.fillPoints([back0, backR, { x: backR.x, y: backR.y - WALL_H }, { x: back0.x, y: back0.y - WALL_H }] as Phaser.Types.Math.Vector2Like[], true);
    g.fillStyle(wallL, 1);
    g.fillPoints([back0, backL, { x: backL.x, y: backL.y - WALL_H }, { x: back0.x, y: back0.y - WALL_H }] as Phaser.Types.Math.Vector2Like[], true);
    // windows on right wall: night skyline
    for (let i = 0; i < 5; i++) {
      const u0 = 0.06 + i * 0.19;
      const u1 = u0 + 0.15;
      const pa = { x: back0.x + (backR.x - back0.x) * u0, y: back0.y + (backR.y - back0.y) * u0 };
      const pb = { x: back0.x + (backR.x - back0.x) * u1, y: back0.y + (backR.y - back0.y) * u1 };
      const top = WALL_H - 14;
      const bot = 28;
      g.fillStyle(0x0f2234, 1);
      g.fillPoints([{ x: pa.x, y: pa.y - bot }, { x: pb.x, y: pb.y - bot }, { x: pb.x, y: pb.y - top }, { x: pa.x, y: pa.y - top }] as Phaser.Types.Math.Vector2Like[], true);
      // skyline silhouettes
      for (let k = 0; k < 6; k++) {
        const t0 = k / 6;
        const t1 = (k + 0.8) / 6;
        const bh = 14 + hashRandom(i, k) * 40;
        const qa = { x: pa.x + (pb.x - pa.x) * t0, y: pa.y + (pb.y - pa.y) * t0 };
        const qb = { x: pa.x + (pb.x - pa.x) * t1, y: pa.y + (pb.y - pa.y) * t1 };
        g.fillStyle(0x1b2a3c, 1);
        g.fillPoints([{ x: qa.x, y: qa.y - bot }, { x: qb.x, y: qb.y - bot }, { x: qb.x, y: qb.y - bot - bh }, { x: qa.x, y: qa.y - bot - bh }] as Phaser.Types.Math.Vector2Like[], true);
        for (let w = 0; w < 4; w++) {
          if (hashRandom(i, k, w) < 0.5) {
            g.fillStyle(0xffcf86, 0.8);
            g.fillRect(qa.x + 2 + (w % 2) * 3, qa.y - bot - 6 - Math.floor(w / 2) * 7 - (qb.y - qa.y) * 0.3, 1.5, 2);
          }
        }
      }
      g.lineStyle(2, 0x4a4b54, 1);
      g.strokePoints([{ x: pa.x, y: pa.y - bot }, { x: pb.x, y: pb.y - bot }, { x: pb.x, y: pb.y - top }, { x: pa.x, y: pa.y - top }] as Phaser.Types.Math.Vector2Like[], true);
    }
    // company name plaque on left wall
    const plaque = { x: (back0.x + backL.x) / 2, y: (back0.y + backL.y) / 2 - WALL_H * 0.62 };
    this.add
      .text(plaque.x, plaque.y, data.companyName.toUpperCase(), { fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '20px', color: '#e4c98e', fontStyle: '600' })
      .setOrigin(0.5)
      .setLetterSpacing(4);
    // floor-wall trim
    g.lineStyle(2, 0xc8a35a, 0.35);
    g.lineBetween(back0.x, back0.y, backR.x, backR.y);
    g.lineBetween(back0.x, back0.y, backL.x, backL.y);

    // Furniture layout: desks in rows, executive desk at back right.
    const desks: { x: number; y: number }[] = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) desks.push({ x: 1.2 + col * 1.15 + (row % 2) * 0.2, y: 4.2 + row * 1.5 });
    const box = (x: number, y: number, w: number, d: number, h: number, color: number, z = 0) => {
      const a = P(x, y);
      const b = P(x + w, y);
      const c = P(x + w, y + d);
      const dd = P(x, y + d);
      const up = (p: { x: number; y: number }, hh: number) => ({ x: p.x, y: p.y - hh });
      const gg = this.add.graphics();
      gg.fillStyle(shade(color, 0.62), 1);
      gg.fillPoints([up(dd, z), up(c, z), up(c, z + h), up(dd, z + h)] as Phaser.Types.Math.Vector2Like[], true);
      gg.fillStyle(shade(color, 0.85), 1);
      gg.fillPoints([up(c, z), up(b, z), up(b, z + h), up(c, z + h)] as Phaser.Types.Math.Vector2Like[], true);
      gg.fillStyle(shade(color, 1.15), 1);
      gg.fillPoints([up(a, z + h), up(b, z + h), up(c, z + h), up(dd, z + h)] as Phaser.Types.Math.Vector2Like[], true);
      gg.setDepth((x + w + y + d) * 10);
      return gg;
    };
    // Executive desk
    box(9, 1.6, 1.8, 0.8, 14, 0x4a3324);
    box(9.3, 1.75, 0.5, 0.35, 6, 0x15161a, 14); // monitor
    // Plants
    for (const [px, py] of [
      [0.4, 0.4],
      [11.4, 0.4],
      [0.4, 8.4],
    ]) {
      box(px, py, 0.4, 0.4, 10, 0x6a5a48);
      const c = P(px + 0.2, py + 0.2);
      const pl = this.add.graphics().setDepth((px + py + 1) * 10 + 1);
      pl.fillStyle(0x2f5d3f, 1);
      pl.fillCircle(c.x, c.y - 20, 9);
      pl.fillStyle(0x3a6e4b, 1);
      pl.fillCircle(c.x - 4, c.y - 24, 6);
    }
    // Meeting table
    box(1.2, 1.0, 3.2, 1.2, 11, 0x3b3d45);
    for (let i = 0; i < 4; i++) box(1.4 + i * 0.8, 0.55, 0.35, 0.3, 8, 0x1d1e23);

    // Staff at desks
    const staff = data.staff.slice(0, desks.length);
    staff.forEach((s, i) => {
      const d = desks[i];
      box(d.x, d.y, 0.9, 0.55, 11, 0x5a4a3a);
      box(d.x + 0.25, d.y + 0.05, 0.38, 0.12, 6, 0x15161a, 11);
      const screen = P(d.x + 0.44, d.y + 0.11);
      const glow = this.add.graphics().setDepth((d.x + d.y + 0.7) * 10 + 1);
      glow.fillStyle(0x9fc4ff, 0.18);
      glow.fillCircle(screen.x, screen.y - 14, 7);
      this.addFigure(P(d.x + 0.45, d.y + 0.95), (d.x + d.y + 1.6) * 10, s, i);
    });
    // Empty desks up to capacity
    for (let i = staff.length; i < Math.min(desks.length, Math.max(staff.length + 2, data.capacity)); i++) {
      const d = desks[i];
      box(d.x, d.y, 0.9, 0.55, 11, 0x3e352c);
    }
    if (data.owner) {
      this.addFigure(P(9.9, 1.35), (9.9 + 1.35) * 10 + 4, { id: '__owner', name: data.owner, title: 'Owner', role: 'owner', performance: 100 }, 99, true);
    }
    if (data.staff.length > desks.length) {
      this.add.text(W / 2, this.scale.height - 24, `+${data.staff.length - desks.length} more staff on other floors`, { fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#8a867e' }).setOrigin(0.5);
    }
  }

  private addFigure(p: { x: number; y: number }, depth: number, s: InteriorStaff, i: number, owner = false) {
    const shirt = owner ? 0xc8a35a : ROLE_COLORS[s.role] ?? SHIRTS[Math.floor(hashRandom(i, s.name.length) * SHIRTS.length)];
    const skin = [0xe0b48f, 0xc28e68, 0x8d5a3c, 0xf0c8a5, 0x6e4530][Math.floor(hashRandom(i, 3) * 5)];
    const hair = [0x1a1410, 0x3a2a1c, 0x6b4a2a, 0x0f0f10, 0x8a6a4a][Math.floor(hashRandom(i, 4) * 5)];
    const c = this.add.container(p.x, p.y).setDepth(depth);
    const gg = this.add.graphics();
    gg.fillStyle(0x000000, 0.3);
    gg.fillEllipse(0, 0, 18, 7);
    gg.fillStyle(0x23242a, 1);
    gg.fillRect(-5, -12, 4, 12);
    gg.fillRect(1, -12, 4, 12);
    gg.fillStyle(shirt, 1);
    gg.fillRoundedRect(-7, -28, 14, 17, 3);
    gg.fillStyle(skin, 1);
    gg.fillCircle(0, -34, 6);
    gg.fillStyle(hair, 1);
    gg.fillEllipse(0, -38, 12, 6);
    c.add(gg);
    if (s.performance > 75 && !owner) {
      const star = this.add.graphics();
      star.fillStyle(0xe4c98e, 1);
      star.fillCircle(0, -48, 2);
      c.add(star);
    }
    c.setSize(20, 50);
    c.setInteractive(new Phaser.Geom.Rectangle(-10, -44, 20, 46), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', (ptr: Phaser.Input.Pointer) => {
      gg.setAlpha(0.85);
      this.bridge.onHover({ name: s.name, title: s.title, x: ptr.x, y: ptr.y });
    });
    c.on('pointerout', () => {
      gg.setAlpha(1);
      this.bridge.onHover(null);
    });
    if (!owner) c.on('pointerup', () => this.bridge.onSelectEmployee(s.id));
    this.tweens.add({ targets: c, y: p.y - 1.5, duration: 900 + hashRandom(i, 9) * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: hashRandom(i, 2) * 800 });
    this.figures.push({ id: s.id, container: c, name: s.name, title: s.title });
  }
}
