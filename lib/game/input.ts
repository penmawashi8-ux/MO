import type { Vec } from "./types";

export type ActionButton = "A" | "Q" | "W" | "B";

/**
 * Collects input from keyboard / mouse / virtual pad.
 * The engine consumes edge-triggered presses and click targets each frame.
 */
export class InputManager {
  /** virtual joystick (also fed by WASD/arrow keys) */
  joy: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  /** edge-triggered action presses */
  private pressed = new Set<ActionButton>();
  private keys = new Set<string>();
  /** last screen-space click/tap on the canvas (move command) */
  clickScreen: Vec | null = null;
  /** last known mouse position (screen space, null on touch-only devices) */
  mouseScreen: Vec | null = null;

  private canvas: HTMLCanvasElement | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  detach() {
    const c = this.canvas;
    if (c) {
      c.removeEventListener("mousedown", this.onMouseDown);
      c.removeEventListener("mousemove", this.onMouseMove);
      c.removeEventListener("contextmenu", this.onContextMenu);
      c.removeEventListener("touchstart", this.onTouchStart);
    }
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas = null;
  }

  /** Virtual pad API */
  setJoystick(x: number, y: number, active: boolean) {
    this.joy = { x, y, active };
  }

  press(btn: ActionButton) {
    this.pressed.add(btn);
  }

  consumePressed(btn: ActionButton): boolean {
    if (this.pressed.has(btn)) {
      this.pressed.delete(btn);
      return true;
    }
    return false;
  }

  consumeClick(): Vec | null {
    const c = this.clickScreen;
    this.clickScreen = null;
    return c;
  }

  /** Arrow keys act as a digital joystick (Q/W are reserved for skills) */
  keyboardDir(): Vec | null {
    let x = 0;
    let y = 0;
    if (this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("ArrowDown")) y += 1;
    if (this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("ArrowRight")) x += 1;
    if (x === 0 && y === 0) return null;
    const l = Math.hypot(x, y);
    return { x: x / l, y: y / l };
  }

  endFrame() {
    this.pressed.clear();
    this.clickScreen = null;
  }

  private onMouseDown = (ev: MouseEvent) => {
    ev.preventDefault();
    this.clickScreen = { x: ev.clientX, y: ev.clientY };
  };

  private onMouseMove = (ev: MouseEvent) => {
    this.mouseScreen = { x: ev.clientX, y: ev.clientY };
  };

  private onContextMenu = (ev: Event) => {
    ev.preventDefault();
  };

  private onTouchStart = (ev: TouchEvent) => {
    // taps on the canvas itself act as move commands (virtual pad stops propagation)
    if (ev.touches.length > 0) {
      const t = ev.touches[0];
      this.clickScreen = { x: t.clientX, y: t.clientY };
    }
    ev.preventDefault();
  };

  private onKeyDown = (ev: KeyboardEvent) => {
    if (ev.repeat) return;
    this.keys.add(ev.code);
    if (ev.code === "KeyQ") this.press("Q");
    if (ev.code === "KeyW") this.press("W");
    if (ev.code === "KeyA" || ev.code === "Space") this.press("A");
    if (ev.code === "KeyB") this.press("B");
  };

  private onKeyUp = (ev: KeyboardEvent) => {
    this.keys.delete(ev.code);
  };
}
