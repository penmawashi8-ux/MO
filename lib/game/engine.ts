import { ALL_CHAR_IDS, CHARACTERS, type CharDef } from "./characters";
import { CommandBuffer, type NetCommand } from "./commands";
import { updateAI } from "./ai";
import {
  BASE_HP, BASE_POS, FOUNTAIN_RADIUS, JUNGLE_DMG, JUNGLE_HP, JUNGLE_POS,
  JUNGLE_RESPAWN, MINION_AGGRO, MINION_DMG, MINION_HP, MINION_RANGE,
  MINION_SPEED, MINION_WAVE_INTERVAL, MINION_WAVE_SIZE, TOWER_ATK_CD,
  TOWER_DMG, TOWER_HP, TOWER_POS, TOWER_RANGE, WALLS, WORLD,
  enemyTeam, minionSpawnPos,
} from "./map";
import type {
  BaseCore, CharId, FloatText, GameConfig, GameResult, GroundEffect,
  Hero, HudData, JungleCamp, Minion, Projectile, StatusEffect, Team,
  Tower, Unit, Vec,
} from "./types";
import { add, circleRectResolve, clamp, dist, norm, scale, sub } from "./utils";

const EXP_TO_NEXT = [80, 150, 240, 350]; // level 1->2 ... 4->5
const MAX_LEVEL = 5;
const RECALL_TIME = 3;

export class Engine {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  effects: GroundEffect[] = [];
  floats: FloatText[] = [];
  time = 0;
  over: GameResult | null = null;
  killScore = { blue: 0, red: 0 };
  banner: { text: string; life: number } | null = null;
  camera = { x: WORLD.w / 2, y: WORLD.h / 2, scale: 1 };
  viewport = { w: 800, h: 450 };
  config: GameConfig;
  /** which human slot the local camera/HUD follows */
  cameraSlot: number | null;

  private buffers = new Map<number, CommandBuffer>();
  private nextId = 1;
  private minionTimer = 2.5;
  private activeSlotIdx = 0;
  private swapTimer: number;

  constructor(config: GameConfig) {
    this.config = config;
    this.swapTimer = config.swapInterval;
    this.cameraSlot = config.humans[0]?.slot ?? null;
    // human heroes idle awaiting input rather than falling back to AI
    for (const h of config.humans) this.ensureBuffer(h.slot);
    this.buildWorld();
    const first = this.activeHero();
    if (first && first.humanLabel && config.humans.length > 1) {
      this.banner = { text: `${first.humanLabel} の操作ターン！（${first.name}）`, life: 2.5 };
    }
  }

  // ---------------------------------------------------------------- setup

  private buildWorld() {
    for (const team of ["blue", "red"] as const) {
      const base: BaseCore = {
        kind: "base", id: this.nextId++, team, pos: { ...BASE_POS[team] },
        radius: 64, hp: BASE_HP, maxHp: BASE_HP, dead: false,
      };
      this.units.push(base);
      for (const p of TOWER_POS[team]) {
        const tower: Tower = {
          kind: "tower", id: this.nextId++, team, pos: { ...p },
          radius: 30, hp: TOWER_HP, maxHp: TOWER_HP, dead: false,
          attackCd: 0, range: TOWER_RANGE, dmg: TOWER_DMG,
        };
        this.units.push(tower);
      }
    }
    for (const p of JUNGLE_POS) {
      const camp: JungleCamp = {
        kind: "jungle", id: this.nextId++, team: "neutral", pos: { ...p },
        home: { ...p }, radius: 26, hp: JUNGLE_HP, maxHp: JUNGLE_HP,
        dead: false, respawn: 0, attackCd: 0, dmg: JUNGLE_DMG, targetId: null,
      };
      this.units.push(camp);
    }

    const taken = new Set<CharId>();
    const counts = { blue: 0, red: 0 };
    for (const h of this.config.humans) {
      this.createHero(h.charId, h.team as "blue" | "red", h.slot, h.label, counts[h.team as "blue" | "red"]++);
      taken.add(h.charId);
    }
    const remaining = ALL_CHAR_IDS.filter((c) => !taken.has(c));
    shuffle(remaining);
    for (const team of ["blue", "red"] as const) {
      while (counts[team] < 3) {
        const charId = remaining.pop();
        if (!charId) break;
        this.createHero(charId, team, null, null, counts[team]++);
      }
    }
  }

  private createHero(
    charId: CharId, team: "blue" | "red",
    slot: number | null, label: string | null, idx: number,
  ) {
    const def = CHARACTERS[charId];
    const base = BASE_POS[team];
    const dir = team === "blue" ? 1 : -1;
    const hero: Hero = {
      kind: "hero", id: this.nextId++, team, charId,
      name: def.name, role: def.role, color: def.color,
      pos: { x: base.x + dir * 120, y: base.y + (idx - 1) * 90 },
      radius: def.radius,
      hp: def.hp, maxHp: def.hp, mp: def.mp, maxMp: def.mp,
      level: 1, exp: 0, dead: false,
      moveSpeed: def.speed, attackDamage: def.ad, attackRange: def.range,
      attackCdMax: def.atkCd, attackCd: 0, qCd: 0, wCd: 0,
      statuses: [], facing: { x: dir, y: 0 },
      moveTarget: null, attackTargetId: null,
      controller: slot !== null ? "human" : "ai",
      humanSlot: slot, humanLabel: label,
      ai: { state: "idle", targetId: null, reactTimer: Math.random() * 0.5 },
      kills: 0, deaths: 0, assists: 0, damageDealt: 0,
      respawnTimer: 0, recallTimer: 0, lastAttackerId: null,
    };
    this.units.push(hero);
  }

  // ---------------------------------------------------------------- queries

  heroes(): Hero[] {
    return this.units.filter((u): u is Hero => u.kind === "hero");
  }

  heroesOf(team: Team): Hero[] {
    return this.heroes().filter((h) => h.team === team);
  }

  unitById(id: number | null | undefined): Unit | null {
    if (id == null) return null;
    const u = this.units.find((u) => u.id === id);
    return u && !u.dead ? u : null;
  }

  charDef(h: Hero): CharDef {
    return CHARACTERS[h.charId];
  }

  /** The hero followed by the local camera/HUD */
  activeHero(): Hero | null {
    if (this.cameraSlot === null) return null;
    return this.heroes().find((h) => h.humanSlot === this.cameraSlot) ?? null;
  }

  heroBySlot(slot: number): Hero | null {
    return this.heroes().find((h) => h.humanSlot === slot) ?? null;
  }

  ensureBuffer(slot: number): CommandBuffer {
    let buf = this.buffers.get(slot);
    if (!buf) {
      buf = new CommandBuffer();
      this.buffers.set(slot, buf);
    }
    return buf;
  }

  pushCommand(slot: number, c: NetCommand) {
    this.ensureBuffer(slot).push(c);
  }

  /** Hand a (disconnected) player's hero over to the AI */
  releaseSlot(slot: number) {
    this.buffers.delete(slot);
    const h = this.heroBySlot(slot);
    if (h) {
      this.banner = { text: `${h.humanLabel ?? "プレイヤー"} が切断 — CPUが引き継ぎます`, life: 3 };
    }
  }

  /** In hot-seat modes only the active slot receives input; online all do */
  private slotActive(slot: number): boolean {
    if (this.config.swapInterval > 0 && this.config.humans.length > 1) {
      return this.config.humans[this.activeSlotIdx]?.slot === slot;
    }
    return true;
  }

  isEnemy(a: Unit, b: Unit): boolean {
    return a.team !== b.team;
  }

  enemiesNear(pos: Vec, team: Team, range: number): Unit[] {
    return this.units.filter(
      (u) => !u.dead && u.team !== team && dist(u.pos, pos) <= range + u.radius,
    );
  }

  nearestEnemy(
    pos: Vec, team: Team, range: number,
    opts: { heroFirst?: boolean; heroesOnly?: boolean; includeStructures?: boolean } = {},
  ): Unit | null {
    let best: Unit | null = null;
    let bestD = Infinity;
    let bestHero: Unit | null = null;
    let bestHeroD = Infinity;
    for (const u of this.units) {
      if (u.dead || u.team === team) continue;
      if (opts.heroesOnly && u.kind !== "hero") continue;
      if (!opts.includeStructures && (u.kind === "tower" || u.kind === "base") && opts.heroesOnly) continue;
      const d = dist(u.pos, pos) - u.radius;
      if (d > range) continue;
      if (d < bestD) {
        bestD = d;
        best = u;
      }
      if (u.kind === "hero" && d < bestHeroD) {
        bestHeroD = d;
        bestHero = u;
      }
    }
    return opts.heroFirst && bestHero ? bestHero : best;
  }

  screenToWorld(p: Vec): Vec {
    const { x, y, scale: s } = this.camera;
    return {
      x: x + (p.x - this.viewport.w / 2) / s,
      y: y + (p.y - this.viewport.h / 2) / s,
    };
  }

  // ---------------------------------------------------------------- actions

  spawnProjectile(p: Omit<Projectile, "id" | "traveled" | "hitIds">) {
    this.projectiles.push({ ...p, id: this.nextId++, traveled: 0, hitIds: [] });
  }

  addEffect(e: Omit<GroundEffect, "id" | "tick" | "maxDuration">) {
    this.effects.push({ ...e, id: this.nextId++, tick: 0, maxDuration: e.duration });
  }

  addFloat(pos: Vec, text: string, color: string, size = 13) {
    if (this.floats.length > 80) this.floats.shift();
    this.floats.push({ pos: { x: pos.x, y: pos.y - 20 }, text, color, life: 0.9, size });
  }

  addStatus(h: Hero, st: StatusEffect) {
    if (h.dead) return;
    const existing = h.statuses.find((s) => s.type === st.type);
    if (existing) {
      existing.duration = Math.max(existing.duration, st.duration);
      if (st.power) existing.power = st.power;
    } else {
      h.statuses.push({ ...st });
    }
  }

  hasStatus(h: Hero, type: StatusEffect["type"]): boolean {
    return h.statuses.some((s) => s.type === type);
  }

  heal(u: Unit, amount: number) {
    if (u.dead) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    const gained = Math.round(u.hp - before);
    if (gained > 2) this.addFloat(u.pos, `+${gained}`, "#69f0ae");
  }

  teleport(h: Hero, dest: Vec) {
    h.pos = { x: clamp(dest.x, h.radius, WORLD.w - h.radius), y: clamp(dest.y, h.radius, WORLD.h - h.radius) };
    for (const w of WALLS) circleRectResolve(h.pos, h.radius, w);
    h.moveTarget = null;
  }

  knockback(u: Unit, dir: Vec, distance: number) {
    u.pos = add(u.pos, scale(dir, distance));
    u.pos.x = clamp(u.pos.x, u.radius, WORLD.w - u.radius);
    u.pos.y = clamp(u.pos.y, u.radius, WORLD.h - u.radius);
    for (const w of WALLS) circleRectResolve(u.pos, u.radius, w);
  }

  applyDamage(target: Unit, amount: number, source: Unit | null, opts: { silent?: boolean } = {}) {
    if (target.dead || this.over) return;
    if (target.kind === "hero") {
      if (this.hasStatus(target, "shield")) {
        if (!opts.silent) this.addFloat(target.pos, "BLOCK", "#a5d6a7");
        return;
      }
      if (target.recallTimer > 0) {
        target.recallTimer = 0;
        this.addFloat(target.pos, "帰還中断！", "#ef9a9a");
      }
      if (source) target.lastAttackerId = source.id;
    }
    if (target.kind === "jungle" && source) target.targetId = source.id;
    target.hp -= amount;
    if (source?.kind === "hero") source.damageDealt += amount;
    if (!opts.silent) {
      const color = target.kind === "hero" && target.controller === "human" ? "#ff8a80" : "#ffffff";
      this.addFloat(target.pos, `${Math.round(amount)}`, color);
    }
    if (target.hp <= 0) this.onKill(target, source);
  }

  private onKill(victim: Unit, source: Unit | null) {
    victim.hp = 0;
    victim.dead = true;
    const killerHero = source && source.kind === "hero" ? source : null;

    if (victim.kind === "hero") {
      victim.deaths++;
      victim.respawnTimer = 4 + victim.level * 2;
      victim.statuses = [];
      victim.moveTarget = null;
      victim.attackTargetId = null;
      victim.recallTimer = 0;
      const enemy = enemyTeam(victim.team) as "blue" | "red";
      this.killScore[enemy]++;
      if (killerHero) {
        killerHero.kills++;
        this.addExp(killerHero, 70 + victim.level * 15);
        this.addFloat(killerHero.pos, "KILL!", "#ffd740", 18);
      }
      for (const a of this.heroesOf(enemy)) {
        if (a.dead || a === killerHero) continue;
        if (dist(a.pos, victim.pos) < 600) {
          a.assists++;
          this.addExp(a, 45);
        }
      }
      this.addEffect({
        team: victim.team, ownerId: victim.id, pos: { ...victim.pos },
        radius: 60, duration: 0.5, dps: 0, kind: "blast", color: "#ef5350",
      });
    } else if (victim.kind === "minion") {
      if (killerHero) this.addExp(killerHero, 32);
      this.shareExp(victim, killerHero, 18);
    } else if (victim.kind === "jungle") {
      victim.respawn = JUNGLE_RESPAWN;
      victim.targetId = null;
      if (killerHero) this.addExp(killerHero, 60);
    } else if (victim.kind === "tower") {
      if (killerHero) this.addExp(killerHero, 90);
      for (const a of this.heroesOf(enemyTeam(victim.team))) {
        if (!a.dead && a !== killerHero) this.addExp(a, 45);
      }
      this.addFloat(victim.pos, "タワー破壊！", "#ffd740", 18);
    } else if (victim.kind === "base") {
      this.finish(enemyTeam(victim.team) as "blue" | "red");
    }
  }

  private shareExp(victim: Unit, killer: Hero | null, amount: number) {
    const team = killer ? killer.team : enemyTeam(victim.team);
    for (const a of this.heroesOf(team)) {
      if (a.dead || a === killer) continue;
      if (dist(a.pos, victim.pos) < 550) this.addExp(a, amount);
    }
  }

  addExp(h: Hero, amount: number) {
    if (h.level >= MAX_LEVEL) return;
    h.exp += amount;
    while (h.level < MAX_LEVEL && h.exp >= EXP_TO_NEXT[h.level - 1]) {
      h.exp -= EXP_TO_NEXT[h.level - 1];
      h.level++;
      const def = this.charDef(h);
      h.maxHp += def.hpG;
      h.maxMp += def.mpG;
      h.attackDamage += def.adG;
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.3);
      h.mp = Math.min(h.maxMp, h.mp + 40);
      this.addFloat(h.pos, `LEVEL ${h.level}!`, "#ffeb3b", 17);
    }
    if (h.level >= MAX_LEVEL) h.exp = 0;
  }

  expToNext(h: Hero): number {
    return h.level >= MAX_LEVEL ? 0 : EXP_TO_NEXT[h.level - 1];
  }

  castSkill(h: Hero, slot: "q" | "w", aim: Vec | null): boolean {
    if (h.dead || this.hasStatus(h, "stun")) return false;
    const def = this.charDef(h);
    const skill = slot === "q" ? def.q : def.w;
    const cd = slot === "q" ? h.qCd : h.wCd;
    if (cd > 0 || h.mp < skill.cost) return false;
    if (!skill.cast(this, h, aim)) return false;
    h.mp -= skill.cost;
    if (slot === "q") h.qCd = skill.cd;
    else h.wCd = skill.cd;
    h.recallTimer = 0;
    return true;
  }

  startRecall(h: Hero) {
    if (h.dead || h.recallTimer > 0) return;
    h.recallTimer = RECALL_TIME;
    h.moveTarget = null;
    h.attackTargetId = null;
  }

  performAttack(h: Hero, target: Unit) {
    const dirToTarget = norm(sub(target.pos, h.pos));
    if (dirToTarget.x !== 0 || dirToTarget.y !== 0) h.facing = dirToTarget;
    const might = h.statuses.find((s) => s.type === "might");
    const dmg = h.attackDamage * (might?.power ?? 1);
    if (h.attackRange <= 120) {
      this.applyDamage(target, dmg, h);
    } else {
      this.spawnProjectile({
        team: h.team, ownerId: h.id, pos: { ...h.pos },
        vel: scale(dirToTarget, 620), speed: 620, radius: 6,
        dmg, range: h.attackRange + 250, pierce: false,
        kind: "attack", color: h.color, targetId: target.id,
      });
    }
    h.attackCd = h.attackCdMax;
    h.recallTimer = 0;
  }

  moveSpeedOf(h: Hero): number {
    if (this.hasStatus(h, "stun") || this.hasStatus(h, "root")) return 0;
    let s = h.moveSpeed;
    const haste = h.statuses.find((st) => st.type === "haste");
    if (haste) s *= haste.power ?? 1.3;
    if (this.hasStatus(h, "slow")) s *= 0.6;
    return s;
  }

  private finish(winner: "blue" | "red") {
    if (this.over) return;
    const playerTeam = (this.config.humans[0]?.team ?? "blue") as Team;
    this.over = {
      winner,
      durationSec: this.time,
      playerTeam,
      heroes: this.heroes().map((h) => ({
        name: h.name, charId: h.charId, team: h.team,
        kills: h.kills, deaths: h.deaths, assists: h.assists,
        damage: Math.round(h.damageDealt), level: h.level,
        humanLabel: h.humanLabel,
      })),
    };
  }

  // ---------------------------------------------------------------- update

  update(dt: number) {
    if (this.over) return;
    this.time += dt;

    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }

    this.updateSwap(dt);
    this.updateMinionWaves(dt);

    for (const u of this.units) {
      if (u.kind === "hero") this.updateHero(u, dt);
      else if (u.kind === "minion") this.updateMinion(u, dt);
      else if (u.kind === "tower") this.updateTower(u, dt);
      else if (u.kind === "jungle") this.updateJungle(u, dt);
    }

    this.updateProjectiles(dt);
    this.updateEffects(dt);

    for (const f of this.floats) {
      f.life -= dt;
      f.pos.y -= 42 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.units = this.units.filter(
      (u) => !u.dead || u.kind === "hero" || u.kind === "jungle" || u.kind === "base",
    );

    this.updateCamera();
  }

  private updateSwap(dt: number) {
    if (this.config.swapInterval <= 0 || this.config.humans.length <= 1) return;
    this.swapTimer -= dt;
    if (this.swapTimer <= 0) {
      this.swapTimer = this.config.swapInterval;
      this.activeSlotIdx = (this.activeSlotIdx + 1) % this.config.humans.length;
      this.cameraSlot = this.config.humans[this.activeSlotIdx].slot;
      const h = this.activeHero();
      if (h) {
        h.moveTarget = null;
        h.attackTargetId = null;
        this.banner = { text: `${h.humanLabel} の操作ターン！（${h.name}）`, life: 2.5 };
      }
    }
  }

  swapCountdown(): number | null {
    if (this.config.swapInterval <= 0 || this.config.humans.length <= 1) return null;
    return this.swapTimer;
  }

  private updateMinionWaves(dt: number) {
    this.minionTimer -= dt;
    if (this.minionTimer > 0) return;
    this.minionTimer = MINION_WAVE_INTERVAL;
    for (const team of ["blue", "red"] as const) {
      for (let i = 0; i < MINION_WAVE_SIZE; i++) {
        const minion: Minion = {
          kind: "minion", id: this.nextId++, team,
          pos: minionSpawnPos(team, i), radius: 14,
          hp: MINION_HP, maxHp: MINION_HP, dead: false,
          attackCd: 0, speed: MINION_SPEED, dmg: MINION_DMG,
          range: MINION_RANGE, targetId: null,
        };
        this.units.push(minion);
      }
    }
  }

  private updateHero(h: Hero, dt: number) {
    if (h.dead) {
      h.respawnTimer -= dt;
      if (h.respawnTimer <= 0) this.respawnHero(h);
      return;
    }

    // status tick
    for (const s of h.statuses) {
      s.duration -= dt;
      if (s.type === "poison" || s.type === "burn") {
        s.tick = (s.tick ?? 0) + dt;
        if (s.tick >= 0.5) {
          s.tick -= 0.5;
          this.applyDamage(h, (s.power ?? 10) * 0.5, this.unitById(s.sourceId), { silent: false });
        }
      }
    }
    h.statuses = h.statuses.filter((s) => s.duration > 0);
    if (h.dead) return; // poison may have killed

    // regen (boosted at own fountain)
    const atFountain = dist(h.pos, BASE_POS[h.team as "blue" | "red"]) < FOUNTAIN_RADIUS;
    h.hp = Math.min(h.maxHp, h.hp + (atFountain ? 50 : 1.6) * dt);
    h.mp = Math.min(h.maxMp, h.mp + (atFountain ? 30 : 4.5) * dt);

    h.attackCd = Math.max(0, h.attackCd - dt);
    h.qCd = Math.max(0, h.qCd - dt);
    h.wCd = Math.max(0, h.wCd - dt);

    const buf =
      h.humanSlot !== null && this.buffers.has(h.humanSlot) && this.slotActive(h.humanSlot)
        ? this.ensureBuffer(h.humanSlot)
        : null;
    if (buf) this.handleHumanControl(h, buf);
    else updateAI(this, h, dt);

    // recall channel
    if (h.recallTimer > 0) {
      h.recallTimer -= dt;
      if (h.recallTimer <= 0) {
        this.teleport(h, { ...BASE_POS[h.team as "blue" | "red"] });
        this.addFloat(h.pos, "帰還", "#80deea", 15);
      }
      return; // stand still while channeling
    }

    this.handleAutoAttack(h);
    this.applyMovement(h, dt, buf);
  }

  private respawnHero(h: Hero) {
    h.dead = false;
    h.hp = h.maxHp;
    h.mp = h.maxMp;
    const base = BASE_POS[h.team as "blue" | "red"];
    const dir = h.team === "blue" ? 1 : -1;
    h.pos = { x: base.x + dir * 110, y: base.y + (Math.random() - 0.5) * 120 };
    h.ai.state = "idle";
    h.ai.targetId = null;
  }

  private handleHumanControl(h: Hero, buf: CommandBuffer) {
    if (buf.recall) this.startRecall(h);

    if (buf.moveTo) {
      // clicking an enemy = attack it; clicking ground = move
      const world = buf.moveTo;
      const target = this.nearestEnemy(world, h.team, 40);
      if (target) {
        h.attackTargetId = target.id;
        h.moveTarget = null;
      } else {
        h.moveTarget = {
          x: clamp(world.x, h.radius, WORLD.w - h.radius),
          y: clamp(world.y, h.radius, WORLD.h - h.radius),
        };
        h.attackTargetId = null;
      }
      h.recallTimer = 0;
    }

    if (buf.attack) {
      const t = this.nearestEnemy(h.pos, h.team, h.attackRange + 220);
      if (t) {
        h.attackTargetId = t.id;
        h.moveTarget = null;
        h.recallTimer = 0;
      }
    }

    if (buf.q) this.castSkill(h, "q", buf.q.aim);
    if (buf.w) this.castSkill(h, "w", buf.w.aim);
    buf.clearOneShot();
  }

  private handleAutoAttack(h: Hero) {
    if (this.hasStatus(h, "stun")) return;
    let target = this.unitById(h.attackTargetId);
    if (!target) {
      h.attackTargetId = null;
      // passively attack nearby enemies when not moving
      const moving = h.moveTarget !== null;
      if (!moving) {
        target = this.nearestEnemy(h.pos, h.team, h.attackRange);
      }
    }
    if (!target) return;

    const d = dist(h.pos, target.pos) - target.radius;
    if (d <= h.attackRange) {
      if (h.attackTargetId !== null) h.moveTarget = null;
      if (h.attackCd <= 0) this.performAttack(h, target);
    } else if (h.attackTargetId !== null) {
      h.moveTarget = { ...target.pos };
    }
  }

  private applyMovement(h: Hero, dt: number, buf: CommandBuffer | null) {
    const speed = this.moveSpeedOf(h);
    if (speed <= 0) return;

    let moved = false;
    if (buf && buf.joy.active) {
      const d = norm({ x: buf.joy.x, y: buf.joy.y });
      if (d.x !== 0 || d.y !== 0) {
        h.pos = add(h.pos, scale(d, speed * dt));
        h.facing = d;
        h.moveTarget = null;
        h.attackTargetId = null;
        h.recallTimer = 0;
        moved = true;
      }
    }

    if (!moved && h.moveTarget) {
      const to = sub(h.moveTarget, h.pos);
      const d = Math.hypot(to.x, to.y);
      if (d < 8) {
        h.moveTarget = null;
      } else {
        const dir = { x: to.x / d, y: to.y / d };
        h.pos = add(h.pos, scale(dir, Math.min(speed * dt, d)));
        h.facing = dir;
      }
    }

    h.pos.x = clamp(h.pos.x, h.radius, WORLD.w - h.radius);
    h.pos.y = clamp(h.pos.y, h.radius, WORLD.h - h.radius);
    for (const w of WALLS) circleRectResolve(h.pos, h.radius, w);
  }

  private updateMinion(m: Minion, dt: number) {
    if (m.dead) return;
    m.attackCd = Math.max(0, m.attackCd - dt);

    let target = this.unitById(m.targetId);
    if (target && (target.team === "neutral" || dist(target.pos, m.pos) > MINION_AGGRO * 1.6)) {
      target = null;
    }
    if (!target) {
      let best: Unit | null = null;
      let bestD = Infinity;
      for (const u of this.units) {
        if (u.dead || u.team === m.team || u.team === "neutral") continue;
        const d = dist(u.pos, m.pos) - u.radius;
        const aggro = u.kind === "tower" || u.kind === "base" ? MINION_AGGRO + 60 : MINION_AGGRO;
        if (d <= aggro && d < bestD) {
          bestD = d;
          best = u;
        }
      }
      target = best;
      m.targetId = best?.id ?? null;
    }

    if (target) {
      const d = dist(m.pos, target.pos) - target.radius;
      if (d <= m.range) {
        if (m.attackCd <= 0) {
          this.applyDamage(target, m.dmg, m, { silent: true });
          m.attackCd = 1.0;
        }
      } else {
        const dir = norm(sub(target.pos, m.pos));
        m.pos = add(m.pos, scale(dir, m.speed * dt));
      }
    } else {
      // march down the lane
      const goal = BASE_POS[enemyTeam(m.team) as "blue" | "red"];
      const dir = norm(sub({ x: goal.x, y: goal.y + (m.id % 3 - 1) * 30 }, m.pos));
      m.pos = add(m.pos, scale(dir, m.speed * dt));
    }

    m.pos.x = clamp(m.pos.x, m.radius, WORLD.w - m.radius);
    m.pos.y = clamp(m.pos.y, m.radius, WORLD.h - m.radius);
    for (const w of WALLS) circleRectResolve(m.pos, m.radius, w);
  }

  private updateTower(t: Tower, dt: number) {
    if (t.dead) return;
    t.attackCd = Math.max(0, t.attackCd - dt);
    if (t.attackCd > 0) return;

    // prefer minions, then heroes
    let target: Unit | null = null;
    let bestD = Infinity;
    for (const pass of ["minion", "hero"] as const) {
      for (const u of this.units) {
        if (u.dead || u.team === t.team || u.team === "neutral" || u.kind !== pass) continue;
        const d = dist(u.pos, t.pos) - u.radius;
        if (d <= t.range && d < bestD) {
          bestD = d;
          target = u;
        }
      }
      if (target) break;
      bestD = Infinity;
    }
    if (!target) return;

    this.spawnProjectile({
      team: t.team, ownerId: t.id, pos: { x: t.pos.x, y: t.pos.y - 30 },
      vel: { x: 0, y: 0 }, speed: 520, radius: 8,
      dmg: t.dmg, range: t.range + 320, pierce: false,
      kind: "tower", color: t.team === "blue" ? "#42a5f5" : "#ef5350",
      targetId: target.id,
    });
    t.attackCd = TOWER_ATK_CD;
  }

  private updateJungle(j: JungleCamp, dt: number) {
    if (j.dead) {
      j.respawn -= dt;
      if (j.respawn <= 0) {
        j.dead = false;
        j.hp = j.maxHp;
        j.pos = { ...j.home };
        j.targetId = null;
      }
      return;
    }
    j.attackCd = Math.max(0, j.attackCd - dt);
    const target = this.unitById(j.targetId);
    const leashed = dist(j.pos, j.home) > 320;
    if (!target || target.dead || leashed || dist(target.pos, j.home) > 380) {
      j.targetId = null;
      // return home and heal
      const d = dist(j.pos, j.home);
      if (d > 6) {
        const dir = norm(sub(j.home, j.pos));
        j.pos = add(j.pos, scale(dir, 130 * dt));
        j.hp = Math.min(j.maxHp, j.hp + 80 * dt);
      } else if (j.hp < j.maxHp) {
        j.hp = Math.min(j.maxHp, j.hp + 120 * dt);
      }
      return;
    }
    const d = dist(j.pos, target.pos) - target.radius;
    if (d <= 55) {
      if (j.attackCd <= 0) {
        this.applyDamage(target, j.dmg, j);
        j.attackCd = 1.1;
      }
    } else {
      const dir = norm(sub(target.pos, j.pos));
      j.pos = add(j.pos, scale(dir, 120 * dt));
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (p.targetId !== undefined) {
        // homing
        const target = this.unitById(p.targetId);
        if (!target) {
          p.traveled = p.range + 1;
          continue;
        }
        const dir = norm(sub(target.pos, p.pos));
        p.pos = add(p.pos, scale(dir, p.speed * dt));
        p.traveled += p.speed * dt;
        if (dist(p.pos, target.pos) <= p.radius + target.radius) {
          this.projectileHit(p, target);
          p.traveled = p.range + 1;
        }
        continue;
      }
      // linear
      p.pos = add(p.pos, scale(p.vel, dt));
      p.traveled += p.speed * dt;
      if (p.pos.x < 0 || p.pos.x > WORLD.w || p.pos.y < 0 || p.pos.y > WORLD.h) {
        p.traveled = p.range + 1;
        continue;
      }
      for (const u of this.units) {
        if (u.dead || u.team === p.team) continue;
        if (p.hitIds.includes(u.id)) continue;
        if (dist(p.pos, u.pos) <= p.radius + u.radius) {
          this.projectileHit(p, u);
          p.hitIds.push(u.id);
          if (!p.pierce) {
            p.traveled = p.range + 1;
            break;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.traveled <= p.range);
  }

  private projectileHit(p: Projectile, target: Unit) {
    const owner = this.unitById(p.ownerId);
    if (p.aoe) {
      for (const u of this.enemiesNear(p.pos, p.team, p.aoe)) {
        this.applyDamage(u, p.dmg, owner);
      }
      this.addEffect({
        team: p.team, ownerId: p.ownerId, pos: { ...p.pos },
        radius: p.aoe, duration: 0.35, dps: 0, kind: "blast", color: p.color,
      });
    } else {
      this.applyDamage(target, p.dmg, owner);
    }
    if (p.onHitStatus && target.kind === "hero") {
      this.addStatus(target, { ...p.onHitStatus });
    }
  }

  private updateEffects(dt: number) {
    for (const e of this.effects) {
      e.duration -= dt;
      if (e.followOwner) {
        const owner = this.unitById(e.ownerId);
        if (owner) e.pos = { ...owner.pos };
        else e.duration = 0;
      }
      if (e.dps > 0) {
        e.tick += dt;
        while (e.tick >= 0.4) {
          e.tick -= 0.4;
          const owner = this.unitById(e.ownerId);
          for (const u of this.enemiesNear(e.pos, e.team, e.radius)) {
            this.applyDamage(u, e.dps * 0.4, owner);
          }
        }
      }
    }
    this.effects = this.effects.filter((e) => e.duration > 0);
  }

  private updateCamera() {
    const h = this.activeHero();
    // closer zoom so characters stay readable on small screens
    const s = Math.min(1.25, Math.max(0.55, this.viewport.h / 620, this.viewport.w / 1500));
    this.camera.scale = s;
    const target = h ? h.pos : { x: WORLD.w / 2, y: WORLD.h / 2 };
    const halfW = this.viewport.w / 2 / s;
    const halfH = this.viewport.h / 2 / s;
    this.camera.x = halfW * 2 >= WORLD.w ? WORLD.w / 2 : clamp(target.x, halfW, WORLD.w - halfW);
    this.camera.y = halfH * 2 >= WORLD.h ? WORLD.h / 2 : clamp(target.y, halfH, WORLD.h - halfH);
  }

  // ---------------------------------------------------------------- HUD

  hudData(slot: number | null = this.cameraSlot): HudData {
    const h = slot !== null ? this.heroBySlot(slot) : null;
    const def = h ? this.charDef(h) : null;
    return {
      hero: h && def
        ? {
            name: h.name, color: h.color,
            hp: Math.max(0, Math.round(h.hp)), maxHp: h.maxHp,
            mp: Math.round(h.mp), maxMp: h.maxMp,
            level: h.level, exp: h.exp, expNext: this.expToNext(h),
            dead: h.dead, respawnIn: Math.max(0, h.respawnTimer),
            recalling: h.recallTimer > 0, recallIn: Math.max(0, h.recallTimer),
            q: {
              name: def.q.name, cd: h.qCd, cdMax: def.q.cd, cost: def.q.cost,
              ready: h.qCd <= 0 && h.mp >= def.q.cost && !h.dead,
            },
            w: {
              name: def.w.name, cd: h.wCd, cdMax: def.w.cd, cost: def.w.cost,
              ready: h.wCd <= 0 && h.mp >= def.w.cost && !h.dead,
            },
          }
        : null,
      kills: { ...this.killScore },
      time: this.time,
      banner: this.banner?.text ?? null,
      activeLabel: this.config.humans.length > 1
        ? (this.config.humans[this.activeSlotIdx]?.label ?? null)
        : null,
      swapIn: this.swapCountdown(),
      playerTeam: (this.config.humans[0]?.team ?? "blue") as Team,
    };
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
