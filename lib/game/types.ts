export type Team = "blue" | "red" | "neutral";
export interface Vec {
  x: number;
  y: number;
}

export type CharId = "solara" | "thornwall" | "vexis" | "aethon" | "lumis" | "krag";
export type Role = "Mage" | "Tank" | "Assassin" | "Marksman" | "Support" | "Fighter";
export type Difficulty = "easy" | "normal" | "hard";
export type GameMode = "cpu" | "local" | "mixed";

export type StatusType = "stun" | "root" | "shield" | "poison" | "burn" | "haste" | "might" | "slow";

export interface StatusEffect {
  type: StatusType;
  duration: number;
  /** DoT: damage per second / buffs: multiplier strength */
  power?: number;
  sourceId?: number;
  /** internal accumulator for DoT ticks */
  tick?: number;
}

export interface UnitBase {
  id: number;
  team: Team;
  pos: Vec;
  radius: number;
  hp: number;
  maxHp: number;
  dead: boolean;
}

export type AIStateName = "idle" | "patrol" | "chase" | "attack" | "retreat";

export interface AIState {
  state: AIStateName;
  targetId: number | null;
  reactTimer: number;
}

export interface Hero extends UnitBase {
  kind: "hero";
  charId: CharId;
  name: string;
  role: Role;
  color: string;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCdMax: number;
  attackCd: number;
  qCd: number;
  wCd: number;
  statuses: StatusEffect[];
  facing: Vec;
  moveTarget: Vec | null;
  attackTargetId: number | null;
  controller: "human" | "ai";
  humanSlot: number | null;
  humanLabel: string | null;
  ai: AIState;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  respawnTimer: number;
  /** >0 while channeling recall */
  recallTimer: number;
  lastAttackerId: number | null;
}

export interface Minion extends UnitBase {
  kind: "minion";
  attackCd: number;
  speed: number;
  dmg: number;
  range: number;
  targetId: number | null;
}

export interface Tower extends UnitBase {
  kind: "tower";
  attackCd: number;
  range: number;
  dmg: number;
}

export interface BaseCore extends UnitBase {
  kind: "base";
}

export interface JungleCamp extends UnitBase {
  kind: "jungle";
  home: Vec;
  respawn: number;
  attackCd: number;
  dmg: number;
  targetId: number | null;
}

export type Unit = Hero | Minion | Tower | BaseCore | JungleCamp;

export type ProjectileKind = "attack" | "fireball" | "explosive" | "snipe" | "tower";

export interface Projectile {
  id: number;
  team: Team;
  ownerId: number;
  pos: Vec;
  /** linear velocity (ignored when homing via targetId) */
  vel: Vec;
  speed: number;
  radius: number;
  dmg: number;
  range: number;
  traveled: number;
  pierce: boolean;
  kind: ProjectileKind;
  color: string;
  aoe?: number;
  /** homing target (basic attacks / tower shots) */
  targetId?: number;
  onHitStatus?: StatusEffect;
  hitIds: number[];
}

export type EffectKind = "vortex" | "heal" | "blast" | "warp";

export interface GroundEffect {
  id: number;
  team: Team;
  ownerId: number;
  pos: Vec;
  radius: number;
  duration: number;
  maxDuration: number;
  dps: number;
  kind: EffectKind;
  color: string;
  followOwner?: boolean;
  tick: number;
}

export interface FloatText {
  pos: Vec;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface HumanHeroConfig {
  charId: CharId;
  team: Team;
  slot: number;
  label: string;
}

export interface GameConfig {
  mode: GameMode;
  difficulty: Difficulty;
  humans: HumanHeroConfig[];
  /** seconds between hot-seat control swaps (0 = no swap) */
  swapInterval: number;
}

export interface HeroResult {
  name: string;
  charId: CharId;
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  level: number;
  humanLabel: string | null;
}

export interface GameResult {
  winner: Team;
  durationSec: number;
  heroes: HeroResult[];
  playerTeam: Team;
}

export interface HudSkill {
  name: string;
  cd: number;
  cdMax: number;
  cost: number;
  ready: boolean;
}

export interface HudData {
  hero: {
    name: string;
    color: string;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    level: number;
    exp: number;
    expNext: number;
    dead: boolean;
    respawnIn: number;
    recalling: boolean;
    recallIn: number;
    q: HudSkill;
    w: HudSkill;
  } | null;
  kills: { blue: number; red: number };
  time: number;
  banner: string | null;
  activeLabel: string | null;
  swapIn: number | null;
  playerTeam: Team;
}
