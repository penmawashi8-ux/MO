/**
 * Headless visual check: run a match for a while, render frames with
 * node-canvas, and save PNGs (phone landscape + desktop sizes).
 * Usage: npx tsx scripts/render-preview.ts
 */
import { createCanvas } from "canvas";
import * as fs from "node:fs";
import { Engine } from "../lib/game/engine";
import { render } from "../lib/game/renderer";

function shot(name: string, w: number, h: number, warmupSec: number) {
  const engine = new Engine({
    mode: "cpu",
    difficulty: "normal",
    humans: [{ charId: "krag", team: "blue", slot: 0, label: "P1" }],
    swapInterval: 0,
  });
  engine.viewport = { w, h };
  // give the player hero some commands so the camera follows action
  engine.pushCommand(0, { k: "move", x: 900, y: 700 });
  const dt = 1 / 60;
  for (let i = 0; i < warmupSec * 60; i++) {
    engine.update(dt);
    if (i === Math.floor(warmupSec * 30)) {
      engine.pushCommand(0, { k: "skill", slot: "q", aim: { x: 1200, y: 700 } });
      engine.pushCommand(0, { k: "attack" });
    }
  }
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  render(ctx, engine);
  fs.writeFileSync(`/tmp/${name}.png`, canvas.toBuffer("image/png"));
  console.log(`saved /tmp/${name}.png (${w}x${h})`);
}

// hero lineup closeup: place all six heroes side by side
function lineup() {
  const w = 900;
  const h = 320;
  const engine = new Engine({
    mode: "cpu",
    difficulty: "easy",
    humans: [
      { charId: "solara", team: "blue", slot: 0, label: "P1" },
      { charId: "vexis", team: "blue", slot: 2, label: "P2" },
      { charId: "lumis", team: "blue", slot: 4, label: "P3" },
      { charId: "thornwall", team: "red", slot: 1, label: "P4" },
      { charId: "aethon", team: "red", slot: 3, label: "P5" },
      { charId: "krag", team: "red", slot: 5, label: "P6" },
    ],
    swapInterval: 0,
  });
  engine.viewport = { w, h };
  const heroes = engine.heroes();
  heroes.forEach((hero, i) => {
    hero.pos = { x: 1000 + i * 110, y: 700 };
    hero.facing = { x: 1, y: 0.2 };
  });
  engine.camera = { x: 1000 + 2.5 * 110, y: 690, scale: 1.15 };
  // render without updating (so they stay posed)
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  render(ctx, engine);
  fs.writeFileSync("/tmp/lineup.png", canvas.toBuffer("image/png"));
  console.log("saved /tmp/lineup.png");
}

shot("phone-landscape", 844, 390, 35);
shot("phone-short", 599, 270, 50);
lineup();
console.log("done");
