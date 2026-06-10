import type { Engine } from "./engine";
import type { Difficulty, Hero, Unit, Vec } from "./types";
import { BASE_POS, TOWER_RANGE, enemyTeam } from "./map";
import { add, dist, norm, scale, sub } from "./utils";

interface DiffParams {
  react: number;
  skillChance: number;
  aggro: number;
  /** willing to fight under enemy towers */
  dive: boolean;
}

const DIFF: Record<Difficulty, DiffParams> = {
  easy: { react: 0.9, skillChance: 0.35, aggro: 430, dive: false },
  normal: { react: 0.5, skillChance: 0.65, aggro: 540, dive: false },
  hard: { react: 0.22, skillChance: 0.92, aggro: 640, dive: true },
};

function retreatThreshold(h: Hero): number {
  return h.role === "Tank" ? 0.2 : 0.3;
}

function pickTarget(e: Engine, h: Hero, p: DiffParams): Unit | null {
  // assassins (and hard CPUs) hunt the lowest-HP hero in range
  const heroes = e.heroesOf(enemyTeam(h.team)).filter(
    (x) => !x.dead && dist(x.pos, h.pos) <= p.aggro,
  );
  if (heroes.length > 0) {
    if (h.role === "Assassin" || (p.dive && Math.random() < 0.5)) {
      heroes.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return heroes[0];
    }
    heroes.sort((a, b) => dist(a.pos, h.pos) - dist(b.pos, h.pos));
    return heroes[0];
  }
  return e.nearestEnemy(h.pos, h.team, p.aggro);
}

function nearEnemyTower(e: Engine, h: Hero, pos: Vec): boolean {
  return e.units.some(
    (u) =>
      !u.dead &&
      (u.kind === "tower" || u.kind === "base") &&
      u.team === enemyTeam(h.team) &&
      dist(u.pos, pos) < TOWER_RANGE + 40,
  );
}

/** Next push objective: closest living enemy tower, then the base */
function pushObjective(e: Engine, h: Hero): Vec {
  const enemies = e.units.filter(
    (u) => !u.dead && u.team === enemyTeam(h.team) && (u.kind === "tower" || u.kind === "base"),
  );
  enemies.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "tower" ? -1 : 1;
    return dist(a.pos, h.pos) - dist(b.pos, h.pos);
  });
  const obj = enemies[0];
  if (!obj) return { ...BASE_POS[enemyTeam(h.team) as "blue" | "red"] };
  // stand slightly in front of the objective on our side
  const dir = h.team === "blue" ? -1 : 1;
  return { x: obj.pos.x + dir * 180, y: obj.pos.y + (h.id % 5 - 2) * 35 };
}

export function updateAI(e: Engine, h: Hero, dt: number) {
  if (h.dead || e.hasStatus(h, "stun")) return;
  const p = DIFF[e.config.difficulty];
  const ai = h.ai;

  ai.reactTimer -= dt;
  const decide = ai.reactTimer <= 0;
  if (decide) {
    ai.reactTimer = p.react * (0.7 + Math.random() * 0.6);

    const hpFrac = h.hp / h.maxHp;
    if (hpFrac < retreatThreshold(h)) {
      ai.state = "retreat";
      ai.targetId = null;
    } else if (ai.state === "retreat") {
      if (hpFrac > 0.85) ai.state = "patrol";
    } else {
      let target = pickTarget(e, h, p);
      // avoid tower dives unless allowed
      if (
        target &&
        target.kind === "hero" &&
        !p.dive &&
        hpFrac < 0.75 &&
        nearEnemyTower(e, h, target.pos)
      ) {
        target = e.nearestEnemy(h.pos, h.team, p.aggro * 0.7);
        if (target && target.kind === "hero" && nearEnemyTower(e, h, target.pos)) target = null;
      }
      if (target) {
        ai.targetId = target.id;
        const d = dist(h.pos, target.pos) - target.radius;
        ai.state = d <= h.attackRange ? "attack" : "chase";
      } else {
        ai.state = "patrol";
        ai.targetId = null;
      }
    }

    // role behaviours that run regardless of state
    supportRoutine(e, h, p);
  }

  executeState(e, h, p, decide);
}

function supportRoutine(e: Engine, h: Hero, p: DiffParams) {
  if (h.role !== "Support") return;
  // heal the most injured nearby ally
  const injured = e
    .heroesOf(h.team)
    .filter((a) => !a.dead && a.hp / a.maxHp < 0.75 && dist(a.pos, h.pos) < 500);
  if (injured.length > 0 && h.qCd <= 0) {
    e.castSkill(h, "q", null);
  }
  // team buff when allies are engaged nearby
  if (h.wCd <= 0 && Math.random() < p.skillChance) {
    const engagedAllies = e
      .heroesOf(h.team)
      .filter((a) => !a.dead && a.id !== h.id && dist(a.pos, h.pos) < 450).length;
    const enemiesClose = e.heroesOf(enemyTeam(h.team)).filter(
      (x) => !x.dead && dist(x.pos, h.pos) < 500,
    ).length;
    if (engagedAllies >= 1 && enemiesClose >= 1) e.castSkill(h, "w", null);
  }
}

function executeState(e: Engine, h: Hero, p: DiffParams, decide: boolean) {
  const ai = h.ai;
  switch (ai.state) {
    case "retreat": {
      const base = BASE_POS[h.team as "blue" | "red"];
      const enemyNear = e.nearestEnemy(h.pos, h.team, 520, { heroesOnly: true });
      h.attackTargetId = null;
      // defensive skills while running
      if (decide && enemyNear && Math.random() < p.skillChance) {
        if (h.charId === "thornwall") e.castSkill(h, "w", null);
        if (h.charId === "vexis") e.castSkill(h, "q", add(h.pos, scale(norm(sub(base, h.pos)), 400)));
      }
      if (!enemyNear && dist(h.pos, base) > 700 && h.recallTimer <= 0) {
        e.startRecall(h);
      } else if (h.recallTimer <= 0) {
        h.moveTarget = { ...base };
      }
      break;
    }
    case "chase": {
      const target = e.unitById(ai.targetId);
      if (!target || dist(target.pos, h.pos) > p.aggro * 1.5) {
        ai.state = "patrol";
        ai.targetId = null;
        break;
      }
      h.moveTarget = { ...target.pos };
      h.attackTargetId = null;
      // gap closers while chasing heroes
      if (decide && target.kind === "hero" && Math.random() < p.skillChance) {
        const d = dist(target.pos, h.pos);
        if (h.charId === "vexis" && d < 420 && d > 150) e.castSkill(h, "q", target.pos);
        if (h.charId === "krag" && d < 330 && d > 120) e.castSkill(h, "w", target.pos);
        if (h.charId === "thornwall" && d < 340) e.castSkill(h, "q", target.pos);
      }
      break;
    }
    case "attack": {
      const target = e.unitById(ai.targetId);
      if (!target) {
        ai.state = "patrol";
        break;
      }
      const d = dist(h.pos, target.pos) - target.radius;
      if (d > h.attackRange * 1.1) {
        ai.state = "chase";
        break;
      }
      h.attackTargetId = target.id;
      // ranged kiting: back off when the enemy gets too close
      if (h.attackRange > 200 && d < h.attackRange * 0.45) {
        const away = norm(sub(h.pos, target.pos));
        h.moveTarget = add(h.pos, scale(away, 130));
      } else {
        h.moveTarget = null;
      }
      if (decide && Math.random() < p.skillChance) {
        useOffensiveSkill(e, h, target);
      }
      break;
    }
    case "patrol":
    case "idle": {
      h.attackTargetId = null;
      if (h.role === "Support") {
        // shadow the closest fighting ally instead of pushing alone
        const allies = e
          .heroesOf(h.team)
          .filter((a) => !a.dead && a.id !== h.id)
          .sort((a, b) => dist(a.pos, h.pos) - dist(b.pos, h.pos));
        if (allies.length > 0) {
          const lead = allies[0];
          if (dist(lead.pos, h.pos) > 200) {
            h.moveTarget = { x: lead.pos.x + 40, y: lead.pos.y + 60 };
          }
          break;
        }
      }
      if (decide || !h.moveTarget) h.moveTarget = pushObjective(e, h);
      break;
    }
  }
}

function useOffensiveSkill(e: Engine, h: Hero, target: Unit) {
  const aim = { ...target.pos };
  switch (h.charId) {
    case "solara":
      if (!e.castSkill(h, "q", aim)) {
        if (dist(target.pos, h.pos) < 180) e.castSkill(h, "w", null);
      }
      break;
    case "thornwall":
      if (!e.castSkill(h, "q", aim)) {
        if (h.hp / h.maxHp < 0.6) e.castSkill(h, "w", null);
      }
      break;
    case "vexis":
      if (!e.castSkill(h, "w", aim)) e.castSkill(h, "q", aim);
      break;
    case "aethon":
      if (!e.castSkill(h, "q", aim)) {
        if (target.kind === "hero") e.castSkill(h, "w", aim);
      }
      break;
    case "lumis":
      // handled by supportRoutine; pokes with basic attacks otherwise
      break;
    case "krag":
      if (!e.castSkill(h, "q", aim)) {
        if (dist(target.pos, h.pos) > 140) e.castSkill(h, "w", aim);
      }
      break;
  }
}
