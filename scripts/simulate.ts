/**
 * Headless smoke test: run a full CPU-vs-CPU match and make sure the
 * engine progresses without crashing and reaches a result.
 * Usage: npx tsx scripts/simulate.ts
 */
import { Engine } from "../lib/game/engine";
import { InputManager } from "../lib/game/input";

const input = new InputManager();
const engine = new Engine(
  {
    mode: "cpu",
    difficulty: "hard",
    humans: [], // all heroes AI-controlled
    swapInterval: 0,
  },
  input,
);

const dt = 1 / 60;
const maxSeconds = 60 * 12;
let steps = 0;

while (!engine.over && engine.time < maxSeconds) {
  engine.update(dt);
  steps++;
  if (steps % (60 * 60) === 0) {
    const heroes = engine.heroes();
    const minions = engine.units.filter((u) => u.kind === "minion").length;
    console.log(
      `t=${Math.round(engine.time)}s kills B${engine.killScore.blue}:R${engine.killScore.red}` +
        ` minions=${minions} projectiles=${engine.projectiles.length}` +
        ` lvls=[${heroes.map((h) => h.level).join(",")}]`,
    );
  }
}

if (engine.over) {
  console.log("\n=== GAME OVER ===");
  console.log(`winner: ${engine.over.winner}, duration: ${Math.round(engine.over.durationSec)}s`);
  for (const h of engine.over.heroes) {
    console.log(
      `  [${h.team}] ${h.name} Lv${h.level} ${h.kills}/${h.deaths}/${h.assists} dmg=${h.damage}`,
    );
  }
  console.log("\nSmoke test passed.");
} else {
  console.log(`\nNo winner after ${maxSeconds}s — game stalled? (not necessarily a bug, but check balance)`);
  const bases = engine.units.filter((u) => u.kind === "base");
  for (const b of bases) console.log(`  base ${b.team}: ${Math.round(b.hp)}/${b.maxHp}`);
  process.exit(1);
}
