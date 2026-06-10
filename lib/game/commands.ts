import type { Vec } from "./types";

/**
 * Player commands, world-space. Produced locally from InputManager
 * (after screen→world conversion) or received over the network,
 * and consumed by the engine each frame.
 */
export type NetCommand =
  | { k: "joy"; x: number; y: number; active: boolean }
  | { k: "move"; x: number; y: number }
  | { k: "attack" }
  | { k: "skill"; slot: "q" | "w"; aim: Vec | null }
  | { k: "recall" };

export interface JoyState {
  x: number;
  y: number;
  active: boolean;
}

/** Per-player command state. Joystick persists; the rest are one-shot. */
export class CommandBuffer {
  joy: JoyState = { x: 0, y: 0, active: false };
  moveTo: Vec | null = null;
  attack = false;
  q: { aim: Vec | null } | null = null;
  w: { aim: Vec | null } | null = null;
  recall = false;

  push(c: NetCommand) {
    switch (c.k) {
      case "joy":
        this.joy = { x: c.x, y: c.y, active: c.active };
        break;
      case "move":
        this.moveTo = { x: c.x, y: c.y };
        break;
      case "attack":
        this.attack = true;
        break;
      case "skill":
        if (c.slot === "q") this.q = { aim: c.aim };
        else this.w = { aim: c.aim };
        break;
      case "recall":
        this.recall = true;
        break;
    }
  }

  clearOneShot() {
    this.moveTo = null;
    this.attack = false;
    this.q = null;
    this.w = null;
    this.recall = false;
  }
}
