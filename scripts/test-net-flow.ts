/**
 * Headless test of the online data flow (without actual WebRTC):
 *  - commands applied to the engine move the player's hero
 *  - snapshot serialization → RemoteView reconstruction works
 * Usage: npx tsx scripts/test-net-flow.ts
 */
import { Engine } from "../lib/game/engine";
import { buildSnapshot, RemoteView } from "../lib/game/snapshot";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok: ${msg}`);
}

const engine = new Engine({
  mode: "online",
  difficulty: "normal",
  humans: [
    { charId: "solara", team: "blue", slot: 0, label: "P1" },
    { charId: "krag", team: "red", slot: 1, label: "P2" },
  ],
  swapInterval: 0,
});

const dt = 1 / 60;
const p1 = engine.heroBySlot(0)!;
const p2 = engine.heroBySlot(1)!;
assert(p1.charId === "solara" && p1.team === "blue", "P1 hero created on blue");
assert(p2.charId === "krag" && p2.team === "red", "P2 hero created on red");
assert(engine.heroes().length === 6, "CPU fills remaining 4 hero slots");

// --- guest movement command (slot 1, as received over the network)
const startX = p2.pos.x;
engine.pushCommand(1, { k: "move", x: p2.pos.x - 300, y: p2.pos.y });
for (let i = 0; i < 60; i++) engine.update(dt);
assert(p2.pos.x < startX - 100, "guest move command moves their hero");

// --- joystick command keeps applying every frame
const startY = p1.pos.y;
engine.pushCommand(0, { k: "joy", x: 0, y: 1, active: true });
for (let i = 0; i < 30; i++) engine.update(dt);
assert(p1.pos.y > startY + 40, "joystick command moves hero continuously");
engine.pushCommand(0, { k: "joy", x: 0, y: 0, active: false });

// --- skill command consumes mana and starts cooldown
const mpBefore = p1.mp;
engine.pushCommand(0, { k: "skill", slot: "q", aim: { x: p1.pos.x + 200, y: p1.pos.y } });
engine.update(dt);
assert(p1.qCd > 0 && p1.mp < mpBefore, "skill command casts Q (cd + mana spent)");

// --- snapshot round trip
const snap = buildSnapshot(engine);
const json = JSON.stringify(snap);
console.log(`   snapshot size: ${(json.length / 1024).toFixed(1)} KB`);
assert(snap.heroes.length === 6, "snapshot contains 6 heroes");
assert(snap.units.some((u) => u.k === "base"), "snapshot contains bases");

const view = new RemoteView(1);
view.setSnapshot(JSON.parse(json));
view.viewport = { w: 1280, h: 720 };
view.update(dt);
const remoteMe = view.activeHero();
assert(remoteMe !== null && remoteMe.charId === "krag", "RemoteView finds guest's own hero");
assert(view.units.length >= 10, "RemoteView reconstructs units (heroes+structures)");

const hud = view.hudData();
assert(hud.hero !== null && hud.hero.name === "KRAG", "guest HUD data built from snapshot");
assert(hud.playerTeam === "red", "guest HUD shows own team");

const world = view.screenToWorld({ x: 640, y: 360 });
assert(Number.isFinite(world.x) && Number.isFinite(world.y), "guest screenToWorld works");

// --- disconnected guest hands hero to AI
engine.releaseSlot(1);
for (let i = 0; i < 120; i++) engine.update(dt);
console.log("ok: engine keeps running after guest slot release (AI takeover)");

console.log("\nAll net-flow checks passed.");
