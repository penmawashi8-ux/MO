/**
 * Balance harness: run many CPU-vs-CPU matches with random team comps and
 * report per-character win rates, KDA and damage.
 * Usage: npx tsx scripts/balance-stats.ts [matches]
 */
import { Engine } from "../lib/game/engine";
import { ALL_CHAR_IDS } from "../lib/game/characters";
import type { CharId } from "../lib/game/types";

const MATCHES = Number(process.argv[2] ?? 60);
const dt = 1 / 30;
const maxSeconds = 60 * 12;

interface CharStat {
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
}

const stats = new Map<CharId, CharStat>();
for (const c of ALL_CHAR_IDS) {
  stats.set(c, { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0 });
}

let blueWins = 0;
let redWins = 0;
let stalls = 0;
let totalDuration = 0;

for (let m = 0; m < MATCHES; m++) {
  const engine = new Engine({ mode: "cpu", difficulty: "hard", humans: [], swapInterval: 0 });
  while (!engine.over && engine.time < maxSeconds) engine.update(dt);
  if (!engine.over) {
    stalls++;
    continue;
  }
  totalDuration += engine.over.durationSec;
  if (engine.over.winner === "blue") blueWins++;
  else redWins++;
  for (const h of engine.over.heroes) {
    const s = stats.get(h.charId)!;
    s.games++;
    if (h.team === engine.over.winner) s.wins++;
    s.kills += h.kills;
    s.deaths += h.deaths;
    s.assists += h.assists;
    s.damage += h.damage;
  }
}

const finished = MATCHES - stalls;
console.log(`matches=${MATCHES} finished=${finished} stalls=${stalls}`);
console.log(`blue=${blueWins} red=${redWins} avgDuration=${(totalDuration / Math.max(1, finished)).toFixed(0)}s\n`);
console.log("char        games  win%   K/D/A per game        dmg/game");
for (const c of ALL_CHAR_IDS) {
  const s = stats.get(c)!;
  const g = Math.max(1, s.games);
  console.log(
    `${c.padEnd(11)} ${String(s.games).padStart(4)}  ${((s.wins / g) * 100).toFixed(0).padStart(3)}%   ` +
      `${(s.kills / g).toFixed(1)} / ${(s.deaths / g).toFixed(1)} / ${(s.assists / g).toFixed(1)}`.padEnd(22) +
      `${(s.damage / g).toFixed(0).padStart(8)}`,
  );
}
