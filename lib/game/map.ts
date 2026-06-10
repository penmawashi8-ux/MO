import type { Rect } from "./utils";
import type { Team, Vec } from "./types";

export const WORLD = { w: 2400, h: 1400 };
export const LANE_Y = 700;
export const LANE_HALF_WIDTH = 110;

/** Impassable jungle walls */
export const WALLS: Rect[] = [
  { x: 420, y: 150, w: 340, h: 110 },
  { x: 420, y: 1140, w: 340, h: 110 },
  { x: 1640, y: 150, w: 340, h: 110 },
  { x: 1640, y: 1140, w: 340, h: 110 },
  { x: 1080, y: 320, w: 240, h: 140 },
  { x: 1080, y: 940, w: 240, h: 140 },
];

/** Decorative bushes (visual only) */
export const BUSHES: { x: number; y: number; rx: number; ry: number }[] = [
  { x: 560, y: 540, rx: 80, ry: 42 },
  { x: 560, y: 860, rx: 80, ry: 42 },
  { x: 1840, y: 540, rx: 80, ry: 42 },
  { x: 1840, y: 860, rx: 80, ry: 42 },
  { x: 1200, y: 180, rx: 100, ry: 46 },
  { x: 1200, y: 1220, rx: 100, ry: 46 },
];

export const BASE_POS: Record<"blue" | "red", Vec> = {
  blue: { x: 170, y: LANE_Y },
  red: { x: 2230, y: LANE_Y },
};

export const TOWER_POS: Record<"blue" | "red", Vec[]> = {
  blue: [
    { x: 1040, y: LANE_Y },
    { x: 620, y: LANE_Y },
  ],
  red: [
    { x: 1360, y: LANE_Y },
    { x: 1780, y: LANE_Y },
  ],
};

export const JUNGLE_POS: Vec[] = [
  { x: 760, y: 300 },
  { x: 760, y: 1100 },
  { x: 1640, y: 300 },
  { x: 1640, y: 1100 },
];

export const FOUNTAIN_RADIUS = 240;

export const BASE_HP = 4200;
export const TOWER_HP = 1400;
export const TOWER_RANGE = 290;
export const TOWER_DMG = 78;
export const TOWER_ATK_CD = 1.15;

export const MINION_HP = 160;
export const MINION_DMG = 13;
export const MINION_SPEED = 95;
export const MINION_RANGE = 48;
export const MINION_AGGRO = 230;
export const MINION_WAVE_INTERVAL = 22;
export const MINION_WAVE_SIZE = 3;

export const JUNGLE_HP = 320;
export const JUNGLE_DMG = 26;
export const JUNGLE_RESPAWN = 45;

export function minionSpawnPos(team: Team, i: number): Vec {
  const x = team === "blue" ? 320 : 2080;
  return { x, y: LANE_Y + (i - 1) * 45 };
}

export function enemyTeam(team: Team): Team {
  return team === "blue" ? "red" : "blue";
}
