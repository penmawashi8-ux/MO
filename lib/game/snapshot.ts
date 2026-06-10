import { CHARACTERS } from "./characters";
import type { Engine } from "./engine";
import { WORLD } from "./map";
import type {
  CharId, FloatText, GroundEffect, Hero, HudData, Projectile, RenderView,
  StatusType, Team, Unit, Vec,
} from "./types";
import { clamp } from "./utils";

/** Compact wire format for game state, broadcast host → guests at ~15Hz */
export interface SnapHero {
  id: number;
  c: CharId;
  tm: Team;
  x: number;
  y: number;
  hp: number;
  mh: number;
  mp: number;
  mm: number;
  lv: number;
  xp: number;
  xn: number;
  dd: 0 | 1;
  rs: number; // respawn timer
  rc: number; // recall timer
  fx: number;
  fy: number;
  st: [StatusType, number][];
  sl: number | null;
  lb: string | null;
  qc: number; // Q cooldown remaining
  wc: number; // W cooldown remaining
}

export interface SnapUnit {
  id: number;
  k: "minion" | "tower" | "base" | "jungle";
  tm: Team;
  x: number;
  y: number;
  hp: number;
  mh: number;
  r: number;
  dd: 0 | 1;
}

export interface SnapProj {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface SnapEff {
  kind: GroundEffect["kind"];
  x: number;
  y: number;
  r: number;
  d: number;
  md: number;
  color: string;
}

export interface SnapFloat {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface Snapshot {
  t: number;
  ks: { blue: number; red: number };
  banner: string | null;
  heroes: SnapHero[];
  units: SnapUnit[];
  projs: SnapProj[];
  effs: SnapEff[];
  floats: SnapFloat[];
}

export function buildSnapshot(e: Engine): Snapshot {
  const heroes: SnapHero[] = [];
  const units: SnapUnit[] = [];
  for (const u of e.units) {
    if (u.kind === "hero") {
      heroes.push({
        id: u.id, c: u.charId, tm: u.team,
        x: Math.round(u.pos.x), y: Math.round(u.pos.y),
        hp: Math.round(u.hp), mh: u.maxHp,
        mp: Math.round(u.mp), mm: u.maxMp,
        lv: u.level, xp: Math.round(u.exp), xn: e.expToNext(u),
        dd: u.dead ? 1 : 0,
        rs: Math.round(u.respawnTimer * 10) / 10,
        rc: Math.round(u.recallTimer * 10) / 10,
        fx: Math.round(u.facing.x * 100) / 100,
        fy: Math.round(u.facing.y * 100) / 100,
        st: u.statuses.map((s) => [s.type, Math.round(s.duration * 10) / 10]),
        sl: u.humanSlot, lb: u.humanLabel,
        qc: Math.round(u.qCd * 10) / 10, wc: Math.round(u.wCd * 10) / 10,
      });
    } else {
      if (u.dead && u.kind !== "base") continue;
      units.push({
        id: u.id, k: u.kind, tm: u.team,
        x: Math.round(u.pos.x), y: Math.round(u.pos.y),
        hp: Math.round(u.hp), mh: u.maxHp, r: u.radius,
        dd: u.dead ? 1 : 0,
      });
    }
  }
  return {
    t: Math.round(e.time * 10) / 10,
    ks: { ...e.killScore },
    banner: e.banner?.text ?? null,
    heroes,
    units,
    projs: e.projectiles.map((p) => ({
      x: Math.round(p.pos.x), y: Math.round(p.pos.y), r: p.radius, color: p.color,
    })),
    effs: e.effects.map((ef) => ({
      kind: ef.kind, x: Math.round(ef.pos.x), y: Math.round(ef.pos.y),
      r: ef.radius, d: ef.duration, md: ef.maxDuration, color: ef.color,
    })),
    floats: e.floats.map((f) => ({
      x: Math.round(f.pos.x), y: Math.round(f.pos.y),
      text: f.text, color: f.color, life: f.life, size: f.size,
    })),
  };
}

function makeHero(s: SnapHero): Hero {
  const def = CHARACTERS[s.c];
  return {
    kind: "hero", id: s.id, team: s.tm, charId: s.c,
    name: def.name, role: def.role, color: def.color,
    pos: { x: s.x, y: s.y }, radius: def.radius,
    hp: s.hp, maxHp: s.mh, mp: s.mp, maxMp: s.mm,
    level: s.lv, exp: s.xp, dead: s.dd === 1,
    moveSpeed: def.speed, attackDamage: def.ad, attackRange: def.range,
    attackCdMax: def.atkCd, attackCd: 0, qCd: 0, wCd: 0,
    statuses: s.st.map(([type, duration]) => ({ type, duration })),
    facing: { x: s.fx, y: s.fy },
    moveTarget: null, attackTargetId: null,
    controller: s.sl !== null ? "human" : "ai",
    humanSlot: s.sl, humanLabel: s.lb,
    ai: { state: "idle", targetId: null, reactTimer: 0 },
    kills: 0, deaths: 0, assists: 0, damageDealt: 0,
    respawnTimer: s.rs, recallTimer: s.rc, lastAttackerId: null,
  };
}

/**
 * Guest-side view of the game, rebuilt from snapshots with light position
 * smoothing. Implements RenderView so the normal renderer can draw it.
 */
export class RemoteView implements RenderView {
  viewport = { w: 800, h: 450 };
  camera = { x: WORLD.w / 2, y: WORLD.h / 2, scale: 1 };
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  effects: GroundEffect[] = [];
  floats: FloatText[] = [];
  mySlot: number;
  lastSnap: Snapshot | null = null;

  /** smoothed display positions persisted across snapshots */
  private display = new Map<number, Vec>();
  private targets = new Map<number, Vec>();

  constructor(mySlot: number) {
    this.mySlot = mySlot;
  }

  setSnapshot(s: Snapshot) {
    this.lastSnap = s;
    const units: Unit[] = [];
    const seen = new Set<number>();

    for (const sh of s.heroes) {
      const h = makeHero(sh);
      seen.add(h.id);
      const disp = this.display.get(h.id);
      this.targets.set(h.id, { x: sh.x, y: sh.y });
      if (disp && !h.dead) {
        h.pos = disp;
      } else {
        this.display.set(h.id, h.pos);
      }
      units.push(h);
    }
    for (const su of s.units) {
      seen.add(su.id);
      let pos: Vec = { x: su.x, y: su.y };
      if (su.k === "minion" || su.k === "jungle") {
        this.targets.set(su.id, { x: su.x, y: su.y });
        const disp = this.display.get(su.id);
        if (disp) pos = disp;
        else this.display.set(su.id, pos);
      }
      const base = {
        id: su.id, team: su.tm, pos, radius: su.r,
        hp: su.hp, maxHp: su.mh, dead: su.dd === 1,
      };
      if (su.k === "minion") {
        units.push({ ...base, kind: "minion", attackCd: 0, speed: 0, dmg: 0, range: 0, targetId: null });
      } else if (su.k === "tower") {
        units.push({ ...base, kind: "tower", attackCd: 0, range: 0, dmg: 0 });
      } else if (su.k === "jungle") {
        units.push({ ...base, kind: "jungle", home: pos, respawn: 0, attackCd: 0, dmg: 0, targetId: null });
      } else {
        units.push({ ...base, kind: "base" });
      }
    }
    for (const id of [...this.display.keys()]) {
      if (!seen.has(id)) {
        this.display.delete(id);
        this.targets.delete(id);
      }
    }

    this.units = units;
    this.projectiles = s.projs.map((p, i) => ({
      id: i, team: "neutral" as Team, ownerId: 0,
      pos: { x: p.x, y: p.y }, vel: { x: 0, y: 0 }, speed: 0,
      radius: p.r, dmg: 0, range: 0, traveled: 0, pierce: false,
      kind: "attack" as const, color: p.color, hitIds: [],
    }));
    this.effects = s.effs.map((ef, i) => ({
      id: i, team: "neutral" as Team, ownerId: 0,
      pos: { x: ef.x, y: ef.y }, radius: ef.r,
      duration: ef.d, maxDuration: ef.md, dps: 0,
      kind: ef.kind, color: ef.color, tick: 0,
    }));
    this.floats = s.floats.map((f) => ({
      pos: { x: f.x, y: f.y }, text: f.text, color: f.color,
      life: f.life, size: f.size,
    }));
  }

  update(dt: number) {
    // exponential smoothing toward the latest snapshot positions
    const k = 1 - Math.exp(-14 * dt);
    for (const [id, target] of this.targets) {
      const disp = this.display.get(id);
      if (!disp) continue;
      const dx = target.x - disp.x;
      const dy = target.y - disp.y;
      // snap on big jumps (teleport / respawn)
      if (dx * dx + dy * dy > 300 * 300) {
        disp.x = target.x;
        disp.y = target.y;
      } else {
        disp.x += dx * k;
        disp.y += dy * k;
      }
    }
    this.updateCamera();
  }

  activeHero(): Hero | null {
    return (
      this.units.find(
        (u): u is Hero => u.kind === "hero" && u.humanSlot === this.mySlot,
      ) ?? null
    );
  }

  screenToWorld(p: Vec): Vec {
    const { x, y, scale } = this.camera;
    return {
      x: x + (p.x - this.viewport.w / 2) / scale,
      y: y + (p.y - this.viewport.h / 2) / scale,
    };
  }

  private updateCamera() {
    const h = this.activeHero();
    const s = Math.max(this.viewport.h / 900, this.viewport.w / 2400);
    this.camera.scale = s;
    const target = h ? h.pos : { x: WORLD.w / 2, y: WORLD.h / 2 };
    const halfW = this.viewport.w / 2 / s;
    const halfH = this.viewport.h / 2 / s;
    this.camera.x = halfW * 2 >= WORLD.w ? WORLD.w / 2 : clamp(target.x, halfW, WORLD.w - halfW);
    this.camera.y = halfH * 2 >= WORLD.h ? WORLD.h / 2 : clamp(target.y, halfH, WORLD.h - halfH);
  }

  hudData(): HudData {
    const s = this.lastSnap;
    const sh = s?.heroes.find((h) => h.sl === this.mySlot) ?? null;
    const def = sh ? CHARACTERS[sh.c] : null;
    return {
      hero:
        sh && def
          ? {
              name: def.name, color: def.color,
              hp: Math.max(0, sh.hp), maxHp: sh.mh,
              mp: sh.mp, maxMp: sh.mm,
              level: sh.lv, exp: sh.xp, expNext: sh.xn,
              dead: sh.dd === 1, respawnIn: sh.rs,
              recalling: sh.rc > 0, recallIn: sh.rc,
              q: { name: def.q.name, cd: sh.qc, cdMax: def.q.cd, cost: def.q.cost, ready: sh.qc <= 0 && sh.mp >= def.q.cost && sh.dd === 0 },
              w: { name: def.w.name, cd: sh.wc, cdMax: def.w.cd, cost: def.w.cost, ready: sh.wc <= 0 && sh.mp >= def.w.cost && sh.dd === 0 },
            }
          : null,
      kills: s?.ks ?? { blue: 0, red: 0 },
      time: s?.t ?? 0,
      banner: s?.banner ?? null,
      activeLabel: null,
      swapIn: null,
      playerTeam: sh ? sh.tm : "blue",
    };
  }
}
