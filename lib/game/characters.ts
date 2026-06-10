import type { Engine } from "./engine";
import type { CharId, Hero, Role, Vec } from "./types";
import { add, dist, dot, norm, scale, sub } from "./utils";

export interface SkillDef {
  name: string;
  desc: string;
  cost: number;
  cd: number;
  cast(e: Engine, h: Hero, aim: Vec | null): boolean;
}

export interface CharDef {
  id: CharId;
  name: string;
  role: Role;
  roleJp: string;
  color: string;
  desc: string;
  hp: number;
  hpG: number;
  mp: number;
  mpG: number;
  ad: number;
  adG: number;
  range: number;
  atkCd: number;
  speed: number;
  radius: number;
  q: SkillDef;
  w: SkillDef;
}

/** Direction to aim a skill: explicit aim point > nearest enemy > facing */
function aimDir(e: Engine, h: Hero, aim: Vec | null): Vec {
  if (aim) {
    const d = norm(sub(aim, h.pos));
    if (d.x !== 0 || d.y !== 0) return d;
  }
  const t = e.nearestEnemy(h.pos, h.team, 700, { heroFirst: true });
  if (t) return norm(sub(t.pos, h.pos));
  return h.facing;
}

export const CHARACTERS: Record<CharId, CharDef> = {
  solara: {
    id: "solara",
    name: "SOLARA",
    role: "Mage",
    roleJp: "炎の魔法使い",
    color: "#ff6d3a",
    desc: "遠距離から炎の魔法で焼き尽くすDPS",
    hp: 540, hpG: 74, mp: 320, mpG: 50,
    ad: 52, adG: 11, range: 345, atkCd: 1.0, speed: 178, radius: 22,
    q: {
      name: "ファイアボール",
      desc: "直線に高ダメージの火球を放つ",
      cost: 35, cd: 5,
      cast(e, h, aim) {
        const d = aimDir(e, h, aim);
        e.spawnProjectile({
          team: h.team, ownerId: h.id, pos: { ...h.pos },
          vel: scale(d, 560), speed: 560, radius: 11,
          dmg: 80 + 22 * (h.level - 1), range: 660, pierce: false,
          kind: "fireball", color: "#ff5722",
        });
        h.facing = d;
        return true;
      },
    },
    w: {
      name: "炎の渦",
      desc: "周囲を3秒間燃やし続ける渦を展開",
      cost: 55, cd: 12,
      cast(e, h) {
        e.addEffect({
          team: h.team, ownerId: h.id, pos: { ...h.pos },
          radius: 155, duration: 3, dps: 34 + 9 * (h.level - 1),
          kind: "vortex", color: "#ff7043", followOwner: true,
        });
        return true;
      },
    },
  },

  thornwall: {
    id: "thornwall",
    name: "THORNWALL",
    role: "Tank",
    roleJp: "樹木の守護者",
    color: "#4caf50",
    desc: "前線を支える高耐久タンク",
    hp: 980, hpG: 140, mp: 240, mpG: 35,
    ad: 54, adG: 11, range: 90, atkCd: 1.0, speed: 172, radius: 27,
    q: {
      name: "根の拘束",
      desc: "最寄りの敵を2秒間拘束する",
      cost: 30, cd: 8,
      cast(e, h, aim) {
        const t = e.nearestEnemy(aim ?? h.pos, h.team, aim ? 200 : 360, { heroFirst: true })
          ?? e.nearestEnemy(h.pos, h.team, 360, { heroFirst: true });
        if (!t) return false;
        e.applyDamage(t, 55 + 16 * (h.level - 1), h);
        if (t.kind === "hero") {
          e.addStatus(t, { type: "root", duration: 2, sourceId: h.id });
        }
        e.addEffect({
          team: h.team, ownerId: h.id, pos: { ...t.pos },
          radius: 42, duration: 0.6, dps: 0, kind: "blast", color: "#66bb6a",
        });
        return true;
      },
    },
    w: {
      name: "大地の盾",
      desc: "2.5秒間すべてのダメージを無効化",
      cost: 45, cd: 13,
      cast(e, h) {
        e.addStatus(h, { type: "shield", duration: 2.5 });
        e.addFloat(h.pos, "SHIELD", "#a5d6a7", 15);
        return true;
      },
    },
  },

  vexis: {
    id: "vexis",
    name: "VEXIS",
    role: "Assassin",
    roleJp: "霊体の暗殺者",
    color: "#b388ff",
    desc: "高速移動で奇襲をしかける暗殺者",
    hp: 640, hpG: 90, mp: 260, mpG: 40,
    ad: 63, adG: 13, range: 100, atkCd: 0.75, speed: 208, radius: 22,
    q: {
      name: "シャドウステップ",
      desc: "指定位置へワープし周囲にダメージ",
      cost: 35, cd: 7,
      cast(e, h, aim) {
        let dest: Vec;
        if (aim) {
          const d = sub(aim, h.pos);
          const l = dist(aim, h.pos);
          dest = l > 420 ? add(h.pos, scale(norm(d), 420)) : { ...aim };
        } else {
          const t = e.nearestEnemy(h.pos, h.team, 420, { heroFirst: true });
          dest = t ? { ...t.pos } : add(h.pos, scale(h.facing, 300));
        }
        e.addEffect({
          team: h.team, ownerId: h.id, pos: { ...h.pos },
          radius: 36, duration: 0.4, dps: 0, kind: "warp", color: "#b388ff",
        });
        e.teleport(h, dest);
        const dmg = 70 + 24 * (h.level - 1);
        for (const u of e.enemiesNear(dest, h.team, 135)) {
          e.applyDamage(u, dmg, h);
        }
        e.addEffect({
          team: h.team, ownerId: h.id, pos: { ...dest },
          radius: 135, duration: 0.35, dps: 0, kind: "blast", color: "#b388ff",
        });
        return true;
      },
    },
    w: {
      name: "毒の刃",
      desc: "近くの敵に5秒間の毒を付与",
      cost: 30, cd: 9,
      cast(e, h, aim) {
        const t = e.nearestEnemy(aim ?? h.pos, h.team, aim ? 220 : 260, { heroFirst: true })
          ?? e.nearestEnemy(h.pos, h.team, 260, { heroFirst: true });
        if (!t) return false;
        if (t.kind === "hero") {
          e.addStatus(t, { type: "poison", duration: 5, power: 18 + 7 * (h.level - 1), sourceId: h.id });
          e.addFloat(t.pos, "毒", "#9ccc65", 14);
        } else {
          e.applyDamage(t, 55 + 15 * (h.level - 1), h);
        }
        return true;
      },
    },
  },

  aethon: {
    id: "aethon",
    name: "AETHON",
    role: "Marksman",
    roleJp: "機械弓兵",
    color: "#ffd54f",
    desc: "長射程の機械弓で敵を狙撃するアタッカー",
    hp: 480, hpG: 62, mp: 280, mpG: 42,
    ad: 44, adG: 9, range: 355, atkCd: 1.0, speed: 172, radius: 22,
    q: {
      name: "炸裂矢",
      desc: "着弾点で爆発する矢を放つ",
      cost: 30, cd: 7,
      cast(e, h, aim) {
        const d = aimDir(e, h, aim);
        e.spawnProjectile({
          team: h.team, ownerId: h.id, pos: { ...h.pos },
          vel: scale(d, 500), speed: 500, radius: 9,
          dmg: 60 + 16 * (h.level - 1), range: 540, pierce: false,
          kind: "explosive", color: "#ffb300", aoe: 110,
        });
        h.facing = d;
        return true;
      },
    },
    w: {
      name: "スナイプ",
      desc: "超長射程の貫通弾を発射",
      cost: 45, cd: 12,
      cast(e, h, aim) {
        const d = aimDir(e, h, aim);
        e.spawnProjectile({
          team: h.team, ownerId: h.id, pos: { ...h.pos },
          vel: scale(d, 950), speed: 950, radius: 8,
          dmg: 80 + 20 * (h.level - 1), range: 1200, pierce: true,
          kind: "snipe", color: "#fff176",
        });
        h.facing = d;
        return true;
      },
    },
  },

  lumis: {
    id: "lumis",
    name: "LUMIS",
    role: "Support",
    roleJp: "光の治癒師",
    color: "#80deea",
    desc: "回復とバフで味方を支えるサポート",
    hp: 620, hpG: 84, mp: 360, mpG: 55,
    ad: 46, adG: 9, range: 320, atkCd: 1.0, speed: 178, radius: 22,
    q: {
      name: "ヒールビーム",
      desc: "最も傷ついた近くの味方を回復",
      cost: 35, cd: 6,
      cast(e, h) {
        let best: Hero | null = null;
        let bestFrac = 0.999;
        for (const a of e.heroesOf(h.team)) {
          if (a.dead) continue;
          if (dist(a.pos, h.pos) > 520) continue;
          const frac = a.hp / a.maxHp;
          if (frac < bestFrac) {
            bestFrac = frac;
            best = a;
          }
        }
        if (!best) return false;
        const amount = 75 + 26 * (h.level - 1);
        e.heal(best, amount);
        e.addEffect({
          team: h.team, ownerId: h.id, pos: { ...best.pos },
          radius: 50, duration: 0.6, dps: 0, kind: "heal", color: "#80deea",
        });
        return true;
      },
    },
    w: {
      name: "光の加護",
      desc: "チーム全体に4秒間の速度+攻撃バフ",
      cost: 55, cd: 14,
      cast(e, h) {
        for (const a of e.heroesOf(h.team)) {
          if (a.dead) continue;
          e.addStatus(a, { type: "haste", duration: 4, power: 1.25 });
          e.addStatus(a, { type: "might", duration: 4, power: 1.25 });
          e.addFloat(a.pos, "加護", "#fff59d", 14);
        }
        return true;
      },
    },
  },

  krag: {
    id: "krag",
    name: "KRAG",
    role: "Fighter",
    roleJp: "岩石の戦士",
    color: "#a1887f",
    desc: "攻守のバランスに優れた戦士",
    hp: 780, hpG: 112, mp: 250, mpG: 38,
    ad: 58, adG: 12, range: 95, atkCd: 0.92, speed: 182, radius: 25,
    q: {
      name: "ロックスマッシュ",
      desc: "前方を強打しスタンさせる",
      cost: 30, cd: 7,
      cast(e, h, aim) {
        const d = aimDir(e, h, aim);
        h.facing = d;
        const dmg = 75 + 24 * (h.level - 1);
        let hit = false;
        for (const u of e.enemiesNear(h.pos, h.team, 200)) {
          const to = norm(sub(u.pos, h.pos));
          if (dot(to, d) < 0.45) continue;
          e.applyDamage(u, dmg, h);
          if (u.kind === "hero") {
            e.addStatus(u, { type: "stun", duration: 1.2, sourceId: h.id });
          }
          hit = true;
        }
        e.addEffect({
          team: h.team, ownerId: h.id, pos: add(h.pos, scale(d, 110)),
          radius: 110, duration: 0.35, dps: 0, kind: "blast", color: "#bcaaa4",
        });
        return true;
      },
    },
    w: {
      name: "チャージ",
      desc: "直線に突撃し敵を吹き飛ばす",
      cost: 40, cd: 9,
      cast(e, h, aim) {
        const d = aimDir(e, h, aim);
        h.facing = d;
        const start = { ...h.pos };
        const dest = add(h.pos, scale(d, 340));
        const dmg = 55 + 16 * (h.level - 1);
        for (const u of e.enemiesNear(h.pos, h.team, 380)) {
          // hit anything close to the dash path
          const toU = sub(u.pos, start);
          const along = dot(toU, d);
          if (along < 0 || along > 360) continue;
          const perp = Math.abs(toU.x * d.y - toU.y * d.x);
          if (perp > 110) continue;
          e.applyDamage(u, dmg, h);
          if (u.kind === "hero" || u.kind === "minion") {
            e.knockback(u, d, 150);
          }
        }
        e.teleport(h, dest);
        e.addEffect({
          team: h.team, ownerId: h.id, pos: { ...dest },
          radius: 90, duration: 0.3, dps: 0, kind: "blast", color: "#d7ccc8",
        });
        return true;
      },
    },
  },
};

export const ALL_CHAR_IDS: CharId[] = ["solara", "thornwall", "vexis", "aethon", "lumis", "krag"];
