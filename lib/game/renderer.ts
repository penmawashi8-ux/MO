import { BASE_POS, BUSHES, LANE_HALF_WIDTH, LANE_Y, WALLS, WORLD } from "./map";
import type { Hero, RenderView, StatusType, Unit, Vec } from "./types";

function hasStatus(h: Hero, type: StatusType): boolean {
  return h.statuses.some((s) => s.type === type);
}

const TEAM_COLOR = { blue: "#42a5f5", red: "#ef5350", neutral: "#bdbdbd" } as const;

/** deterministic 0..1 jitter from an id */
function jitter(id: number, salt = 0): number {
  const n = (id * 9301 + salt * 4243 + 49297) % 233280;
  return n / 233280;
}

export function render(ctx: CanvasRenderingContext2D, e: RenderView) {
  const { w, h } = e.viewport;
  const cam = e.camera;
  const t = performance.now() / 1000;
  // keep labels/bars readable when zoomed out
  const ui = Math.min(1.8, Math.max(1, 0.95 / cam.scale));

  ctx.save();
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  drawMap(ctx);
  drawEffects(ctx, e);
  drawUnits(ctx, e, t, ui);
  drawProjectiles(ctx, e);
  drawFloats(ctx, e, ui);

  ctx.restore();

  drawMinimap(ctx, e);
}

function drawMap(ctx: CanvasRenderingContext2D) {
  // ground
  ctx.fillStyle = "#13241a";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // jungle texture dots
  ctx.fillStyle = "rgba(40, 80, 50, 0.5)";
  for (let i = 0; i < 60; i++) {
    const x = (i * 397) % WORLD.w;
    const y = (i * 631) % WORLD.h;
    ctx.beginPath();
    ctx.arc(x, y, 14 + (i % 4) * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // lane
  ctx.fillStyle = "#3a3326";
  ctx.fillRect(120, LANE_Y - LANE_HALF_WIDTH, WORLD.w - 240, LANE_HALF_WIDTH * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  ctx.moveTo(160, LANE_Y);
  ctx.lineTo(WORLD.w - 160, LANE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // fountains
  for (const team of ["blue", "red"] as const) {
    const b = BASE_POS[team];
    const grad = ctx.createRadialGradient(b.x, b.y, 30, b.x, b.y, 240);
    grad.addColorStop(0, team === "blue" ? "rgba(66,165,245,0.25)" : "rgba(239,83,80,0.25)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 240, 0, Math.PI * 2);
    ctx.fill();
  }

  // bushes
  for (const b of BUSHES) {
    ctx.fillStyle = "#1d3a24";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(80,160,90,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // walls
  for (const wl of WALLS) {
    ctx.fillStyle = "#2c3540";
    ctx.fillRect(wl.x, wl.y, wl.w, wl.h);
    ctx.strokeStyle = "#46566a";
    ctx.lineWidth = 3;
    ctx.strokeRect(wl.x, wl.y, wl.w, wl.h);
    // rocky highlights
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(wl.x + 8, wl.y + 8, wl.w - 16, 14);
  }

  // world border
  ctx.strokeStyle = "#324055";
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
}

function drawUnits(ctx: CanvasRenderingContext2D, e: RenderView, t: number, ui: number) {
  const active = e.activeHero();
  // draw order: structures, jungle, minions, heroes
  const order = (u: Unit) =>
    u.kind === "base" || u.kind === "tower" ? 0 : u.kind === "jungle" ? 1 : u.kind === "minion" ? 2 : 3;
  const units = [...e.units].sort((a, b) => order(a) - order(b));

  for (const u of units) {
    if (u.dead && u.kind !== "base") continue;
    switch (u.kind) {
      case "base":
        drawBase(ctx, u, ui);
        break;
      case "tower":
        drawTower(ctx, u, t, ui);
        break;
      case "jungle":
        drawJungleBeast(ctx, u, t);
        drawHpBar(ctx, u, 40, ui);
        break;
      case "minion":
        drawMinion(ctx, u, t);
        drawHpBar(ctx, u, 28, ui);
        break;
      case "hero":
        drawHero(ctx, u, active?.id === u.id, t, ui);
        break;
    }
  }
}

function drawBase(ctx: CanvasRenderingContext2D, u: Unit, ui: number) {
  const c = TEAM_COLOR[u.team];
  ctx.save();
  ctx.translate(u.pos.x, u.pos.y);
  // platform
  ctx.fillStyle = "#222c3a";
  ctx.beginPath();
  ctx.arc(0, 0, u.radius + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a4a60";
  ctx.lineWidth = 4;
  ctx.stroke();
  // crystal core
  const t = Date.now() / 600;
  const glow = u.dead ? 0 : 0.5 + Math.sin(t) * 0.2;
  ctx.fillStyle = u.dead ? "#444" : c;
  ctx.globalAlpha = u.dead ? 0.4 : 1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.3;
    const r = u.radius * (i % 2 === 0 ? 1 : 0.62);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  if (!u.dead) {
    ctx.globalAlpha = glow;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  drawHpBar(ctx, u, 110, ui);
}

function drawTower(ctx: CanvasRenderingContext2D, u: Unit, t: number, ui: number) {
  const c = TEAM_COLOR[u.team];
  ctx.save();
  ctx.translate(u.pos.x, u.pos.y);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 10, u.radius + 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // stone base (trapezoid)
  const g = ctx.createLinearGradient(0, -50, 0, 14);
  g.addColorStop(0, "#546e7a");
  g.addColorStop(1, "#37474f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-24, 12);
  ctx.lineTo(-14, -40);
  ctx.lineTo(14, -40);
  ctx.lineTo(24, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#263238";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // brick lines
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-19, -10);
  ctx.lineTo(19, -10);
  ctx.moveTo(-16, -26);
  ctx.lineTo(16, -26);
  ctx.stroke();
  // floating crystal, pulsing
  const pulse = 1 + Math.sin(t * 3 + u.id) * 0.08;
  ctx.save();
  ctx.translate(0, -52);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = c;
  ctx.shadowBlur = 14;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(9, 0);
  ctx.lineTo(0, 13);
  ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  drawHpBar(ctx, u, 64, ui);
}

function drawMinion(ctx: CanvasRenderingContext2D, u: Unit, t: number) {
  const c = TEAM_COLOR[u.team];
  const bob = Math.sin(t * 6 + u.id) * 1.5;
  ctx.save();
  ctx.translate(u.pos.x, u.pos.y + bob);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, u.radius - bob, u.radius * 0.9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // slime body
  const g = ctx.createRadialGradient(-3, -5, 2, 0, 0, u.radius + 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.25, c);
  g.addColorStop(1, shade(c));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, u.radius, u.radius * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(c);
  ctx.lineWidth = 2;
  ctx.stroke();
  // eyes
  const look = u.team === "blue" ? 3 : -3;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-4 + look, -3, 3.4, 0, Math.PI * 2);
  ctx.arc(4 + look, -3, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(-4 + look * 1.4, -3, 1.7, 0, Math.PI * 2);
  ctx.arc(4 + look * 1.4, -3, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawJungleBeast(ctx: CanvasRenderingContext2D, u: Unit, t: number) {
  const bob = Math.sin(t * 2.5 + u.id) * 2;
  ctx.save();
  ctx.translate(u.pos.x, u.pos.y + bob);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, u.radius - bob + 2, u.radius, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // furry body
  const g = ctx.createRadialGradient(-5, -8, 4, 0, 0, u.radius + 4);
  g.addColorStop(0, "#bcaaa4");
  g.addColorStop(0.6, "#8d6e63");
  g.addColorStop(1, "#4e342e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, u.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3e2723";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // horns
  ctx.fillStyle = "#efebe9";
  ctx.beginPath();
  ctx.moveTo(-u.radius * 0.55, -u.radius * 0.6);
  ctx.lineTo(-u.radius * 0.95, -u.radius * 1.25);
  ctx.lineTo(-u.radius * 0.25, -u.radius * 0.85);
  ctx.closePath();
  ctx.moveTo(u.radius * 0.55, -u.radius * 0.6);
  ctx.lineTo(u.radius * 0.95, -u.radius * 1.25);
  ctx.lineTo(u.radius * 0.25, -u.radius * 0.85);
  ctx.closePath();
  ctx.fill();
  // glowing eyes
  ctx.fillStyle = "#ffca28";
  ctx.shadowColor = "#ffca28";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(-6, -3, 3, 0, Math.PI * 2);
  ctx.arc(6, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // snout
  ctx.fillStyle = "#5d4037";
  ctx.beginPath();
  ctx.ellipse(0, 6, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- heroes

function drawHero(
  ctx: CanvasRenderingContext2D,
  h: Hero,
  isActive: boolean,
  t: number,
  ui: number,
) {
  const { x, y } = h.pos;
  const teamC = TEAM_COLOR[h.team];
  const r = h.radius;
  const bob = Math.sin(t * 3 + h.id) * 1.5;

  // recall channel ring
  if (h.recallTimer > 0) {
    const frac = 1 - h.recallTimer / 3;
    ctx.strokeStyle = "#80deea";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, r + 16, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }

  // active player indicator
  if (isActive) {
    ctx.strokeStyle = "#ffeb3b";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, r + 10, t * 1.5, t * 1.5 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.translate(x, y);

  // drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.85, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // team ring under the character
  ctx.strokeStyle = teamC;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.8, r * 1.05, r * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.translate(0, bob);
  drawCharacterArt(ctx, h, t);
  ctx.restore();

  // shield bubble
  if (hasStatus(h, "shield")) {
    ctx.strokeStyle = "rgba(165,214,167,0.95)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.arc(x, y, r + 8, t * 2, t * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // status markers
  let badge = "";
  if (hasStatus(h, "stun")) badge = "💫";
  else if (hasStatus(h, "root")) badge = "🌿";
  else if (hasStatus(h, "poison")) badge = "☠";
  if (badge) {
    ctx.font = `${Math.round(16 * ui)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(badge, x, y - r - 30 * ui);
  }

  // name + level
  ctx.font = `bold ${Math.round(12 * ui)}px sans-serif`;
  ctx.textAlign = "center";
  const label = h.humanLabel ? `${h.humanLabel}・${h.name}` : h.name;
  const ny = y + r + 20 * ui;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 3;
  ctx.strokeText(`${label} Lv${h.level}`, x, ny);
  ctx.fillStyle = h.humanLabel ? "#ffeb3b" : "rgba(255,255,255,0.9)";
  ctx.fillText(`${label} Lv${h.level}`, x, ny);

  // hp / mp bars
  const bw = 52 * ui;
  const bx = x - bw / 2;
  const by = y - r - 16 * ui;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(bx - 1, by - 1, bw + 2, 9 * ui);
  ctx.fillStyle = h.team === "blue" ? "#4caf50" : "#ef5350";
  ctx.fillRect(bx, by, bw * Math.max(0, h.hp / h.maxHp), 5 * ui);
  ctx.fillStyle = "#42a5f5";
  ctx.fillRect(bx, by + 5 * ui, bw * Math.max(0, h.mp / h.maxMp), 2.5 * ui);
}

/** facing angle, defaulting to "down" when idle */
function faceAngle(h: Hero): number {
  if (h.facing.x === 0 && h.facing.y === 0) return Math.PI / 2;
  return Math.atan2(h.facing.y, h.facing.x);
}

function drawCharacterArt(ctx: CanvasRenderingContext2D, h: Hero, t: number) {
  switch (h.charId) {
    case "solara":
      drawSolara(ctx, h, t);
      break;
    case "thornwall":
      drawThornwall(ctx, h, t);
      break;
    case "vexis":
      drawVexis(ctx, h, t);
      break;
    case "aethon":
      drawAethon(ctx, h, t);
      break;
    case "lumis":
      drawLumis(ctx, h, t);
      break;
    case "krag":
      drawKrag(ctx, h, t);
      break;
  }
}

function drawSolara(ctx: CanvasRenderingContext2D, h: Hero, t: number) {
  const r = h.radius;
  // robe body
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 2, 0, 0, r * 1.05);
  g.addColorStop(0, "#ffd180");
  g.addColorStop(0.5, "#ff6d3a");
  g.addColorStop(1, "#b71c1c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8e1b0f";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // face
  ctx.fillStyle = "#ffe0b2";
  ctx.beginPath();
  ctx.arc(0, -r * 0.1, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4e342e";
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.15, 2.2, 0, Math.PI * 2);
  ctx.arc(r * 0.18, -r * 0.15, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // witch hat
  ctx.fillStyle = "#7b1fa2";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.55, r * 0.85, r * 0.28, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r * 0.6);
  ctx.quadraticCurveTo(-r * 0.1, -r * 1.9, r * 0.55, -r * 1.45);
  ctx.quadraticCurveTo(r * 0.1, -r * 1.25, r * 0.45, -r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4a148c";
  ctx.lineWidth = 2;
  ctx.stroke();
  // hat band
  ctx.fillStyle = "#ffb300";
  ctx.fillRect(-r * 0.42, -r * 0.78, r * 0.84, r * 0.18);
  // orbiting flames
  for (let i = 0; i < 2; i++) {
    const a = t * 2.5 + i * Math.PI;
    const fx = Math.cos(a) * (r + 7);
    const fy = Math.sin(a) * (r + 7) * 0.5;
    ctx.fillStyle = i === 0 ? "#ffca28" : "#ff7043";
    ctx.shadowColor = "#ff9800";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawThornwall(ctx: CanvasRenderingContext2D, h: Hero, t: number) {
  const r = h.radius;
  // thorn spikes around the body
  ctx.fillStyle = "#2e7d32";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r * 0.75, -4);
    ctx.lineTo(r * 1.25, 0);
    ctx.lineTo(r * 0.75, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // bark body
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 3, 0, 0, r);
  g.addColorStop(0, "#8d6e63");
  g.addColorStop(0.55, "#5d4037");
  g.addColorStop(1, "#3e2723");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#33691e";
  ctx.lineWidth = 3;
  ctx.stroke();
  // bark cracks
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, r * 0.15);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.45, -r * 0.35, r * 0.7);
  ctx.moveTo(r * 0.45, r * 0.05);
  ctx.quadraticCurveTo(r * 0.25, r * 0.4, r * 0.45, r * 0.65);
  ctx.stroke();
  // leaf crown
  const sway = Math.sin(t * 2 + h.id) * 0.1;
  ctx.fillStyle = "#66bb6a";
  for (let i = -2; i <= 2; i++) {
    ctx.save();
    ctx.rotate(i * 0.42 + sway);
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.05, r * 0.18, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // glowing amber eyes
  ctx.fillStyle = "#ffc107";
  ctx.shadowColor = "#ffc107";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.12, 3, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // mouth knot
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, r * 0.25, r * 0.18, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawVexis(ctx: CanvasRenderingContext2D, h: Hero, t: number) {
  const r = h.radius;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = "#b388ff";
  ctx.shadowBlur = 12;
  // ghost body with wavy tail
  const g = ctx.createRadialGradient(0, -r * 0.4, 2, 0, 0, r * 1.15);
  g.addColorStop(0, "#e1bee7");
  g.addColorStop(0.5, "#9575cd");
  g.addColorStop(1, "#4527a0");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -r * 0.15, r * 0.85, Math.PI, 0);
  const wave = t * 6 + h.id;
  ctx.lineTo(r * 0.85, r * 0.45);
  for (let i = 3; i >= -3; i--) {
    const wx = (i / 3) * r * 0.85;
    const wy = r * 0.7 + Math.sin(wave + i * 1.6) * r * 0.18;
    ctx.lineTo(wx, wy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // hood shadow
  ctx.fillStyle = "rgba(26,9,56,0.85)";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.3, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // glowing slit eyes
  ctx.fillStyle = "#84ffff";
  ctx.shadowColor = "#84ffff";
  ctx.shadowBlur = 8;
  ctx.save();
  ctx.translate(0, -r * 0.32);
  ctx.rotate(-0.18);
  ctx.fillRect(-r * 0.36, -1.6, r * 0.26, 3.2);
  ctx.rotate(0.36);
  ctx.fillRect(r * 0.1, -1.6, r * 0.26, 3.2);
  ctx.restore();
  ctx.shadowBlur = 0;
  // twin daggers
  const ang = faceAngle(h);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(ang + (side * Math.PI) / 2.6);
    ctx.translate(r * 0.95, 0);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#cfd8dc";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(3, 0);
    ctx.lineTo(0, 4);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6a1b9a";
    ctx.fillRect(-1.5, 4, 3, 5);
    ctx.restore();
  }
  ctx.restore();
}

function drawAethon(ctx: CanvasRenderingContext2D, h: Hero, t: number) {
  const r = h.radius;
  const ang = faceAngle(h);
  // bow held toward facing
  ctx.save();
  ctx.rotate(ang);
  ctx.strokeStyle = "#8d6e63";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(r * 0.55, 0, r * 0.85, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.2;
  const tipY = Math.sin(Math.PI / 2.4) * r * 0.85;
  const tipX = r * 0.55 + Math.cos(Math.PI / 2.4) * r * 0.85;
  ctx.beginPath();
  ctx.moveTo(tipX, -tipY);
  ctx.lineTo(r * 0.3, 0);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.restore();
  // mech torso (rounded square)
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, "#fff8e1");
  g.addColorStop(0.45, "#ffd54f");
  g.addColorStop(1, "#f57f17");
  ctx.fillStyle = g;
  roundRect(ctx, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.45);
  ctx.fill();
  ctx.strokeStyle = "#bf360c";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // panel seams
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, r * 0.25);
  ctx.lineTo(r * 0.8, r * 0.25);
  ctx.stroke();
  // visor with scanning eye
  ctx.fillStyle = "#263238";
  roundRect(ctx, -r * 0.62, -r * 0.45, r * 1.24, r * 0.5, r * 0.2);
  ctx.fill();
  const scan = Math.sin(t * 4 + h.id) * r * 0.35;
  ctx.fillStyle = "#00e5ff";
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(scan, -r * 0.2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // antenna
  ctx.strokeStyle = "#90a4ae";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.35, -r * 0.8);
  ctx.lineTo(r * 0.55, -r * 1.25);
  ctx.stroke();
  ctx.fillStyle = "#ef5350";
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 1.25, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLumis(ctx: CanvasRenderingContext2D, h: Hero, t: number) {
  const r = h.radius;
  const pulse = 1 + Math.sin(t * 2.5 + h.id) * 0.06;
  // wings
  ctx.fillStyle = "rgba(224,247,250,0.7)";
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(Math.sin(t * 5) * 0.12);
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.1);
    ctx.quadraticCurveTo(r * 1.7, -r * 0.9, r * 1.5, r * 0.35);
    ctx.quadraticCurveTo(r * 1.1, r * 0.15, r * 0.5, r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // glowing orb body
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#80deea";
  ctx.shadowBlur = 16;
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, 2, 0, 0, r * 0.95);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.55, "#80deea");
  g.addColorStop(1, "#00838f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  // gentle face
  ctx.fillStyle = "#006064";
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.08, 2.4, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.08, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#006064";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, r * 0.12, r * 0.16, 0.3, Math.PI - 0.3);
  ctx.stroke();
  // halo
  ctx.strokeStyle = "#fff59d";
  ctx.shadowColor = "#fff59d";
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -r * 1.15, r * 0.5, r * 0.16, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // orbiting sparkle
  const sa = t * 3 + h.id;
  const sx = Math.cos(sa) * (r + 6);
  const sy = Math.sin(sa) * (r + 6) * 0.6;
  ctx.fillStyle = "#fff59d";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦", sx, sy + 3);
}

function drawKrag(ctx: CanvasRenderingContext2D, h: Hero, t: number) {
  const r = h.radius;
  const ang = faceAngle(h);
  // fists swing while moving
  const swing = Math.sin(t * 7 + h.id) * 0.25;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(ang + (side * Math.PI) / 2.4 + side * swing * 0.3);
    ctx.translate(r * 1.0, 0);
    const fg = ctx.createRadialGradient(-2, -2, 1, 0, 0, r * 0.4);
    fg.addColorStop(0, "#bcaaa4");
    fg.addColorStop(1, "#6d4c41");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3e2723";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  // boulder body (irregular polygon)
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 3, 0, 0, r * 1.1);
  g.addColorStop(0, "#cfd8dc");
  g.addColorStop(0.5, "#90a4ae");
  g.addColorStop(1, "#455a64");
  ctx.fillStyle = g;
  ctx.beginPath();
  const verts = 8;
  for (let i = 0; i < verts; i++) {
    const a = (i / verts) * Math.PI * 2;
    const rr = r * (0.85 + jitter(h.id, i) * 0.25);
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#263238";
  ctx.lineWidth = 3;
  ctx.stroke();
  // cracks with magma glow
  ctx.strokeStyle = "#ff7043";
  ctx.shadowColor = "#ff7043";
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, r * 0.3);
  ctx.lineTo(-r * 0.15, r * 0.45);
  ctx.lineTo(-r * 0.25, r * 0.7);
  ctx.moveTo(r * 0.5, -r * 0.5);
  ctx.lineTo(r * 0.3, -r * 0.25);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // deep-set glowing eyes
  ctx.fillStyle = "#212121";
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.18, r * 0.2, r * 0.14, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.28, -r * 0.18, r * 0.2, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffab40";
  ctx.shadowColor = "#ffab40";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.18, 2.4, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.18, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // heavy brow
  ctx.strokeStyle = "#37474f";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.38);
  ctx.lineTo(-r * 0.08, -r * 0.3);
  ctx.moveTo(r * 0.5, -r * 0.38);
  ctx.lineTo(r * 0.08, -r * 0.3);
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- misc

function drawHpBar(ctx: CanvasRenderingContext2D, u: Unit, width: number, ui: number) {
  if (u.dead || u.hp >= u.maxHp) return;
  const w = width * ui;
  const x = u.pos.x - w / 2;
  const y = u.pos.y - u.radius - 14 * ui;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - 1, y - 1, w + 2, 7 * ui);
  ctx.fillStyle = u.team === "blue" ? "#4caf50" : u.team === "red" ? "#ef5350" : "#ffb74d";
  ctx.fillRect(x, y, w * Math.max(0, u.hp / u.maxHp), 5 * ui);
}

function drawProjectiles(ctx: CanvasRenderingContext2D, e: RenderView) {
  for (const p of e.projectiles) {
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, e: RenderView) {
  for (const ef of e.effects) {
    const frac = ef.duration / ef.maxDuration;
    ctx.save();
    if (ef.kind === "vortex") {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = ef.color;
      ctx.beginPath();
      ctx.arc(ef.pos.x, ef.pos.y, ef.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 4;
      const t = Date.now() / 200;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(ef.pos.x, ef.pos.y, ef.radius * (0.4 + i * 0.3), t + i, t + i + Math.PI * 1.2);
        ctx.stroke();
      }
    } else if (ef.kind === "heal") {
      ctx.globalAlpha = frac;
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ef.pos.x, ef.pos.y, ef.radius * (1.4 - frac * 0.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = ef.color;
      ctx.fillText("✚", ef.pos.x, ef.pos.y - ef.radius - 6);
    } else if (ef.kind === "warp") {
      ctx.globalAlpha = frac * 0.8;
      ctx.strokeStyle = ef.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ef.pos.x, ef.pos.y, ef.radius * (2 - frac), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // blast
      ctx.globalAlpha = frac * 0.5;
      ctx.fillStyle = ef.color;
      ctx.beginPath();
      ctx.arc(ef.pos.x, ef.pos.y, ef.radius * (1.3 - frac * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFloats(ctx: CanvasRenderingContext2D, e: RenderView, ui: number) {
  ctx.textAlign = "center";
  for (const f of e.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `bold ${Math.round(f.size * ui)}px sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.pos.x, f.pos.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.pos.x, f.pos.y);
  }
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx: CanvasRenderingContext2D, e: RenderView) {
  // top-left, clear of the virtual pad and score banner
  const mw = Math.min(150, e.viewport.w * 0.2);
  const mh = mw * (WORLD.h / WORLD.w);
  const mx = 8;
  const my = 8;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;

  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = "#10231a";
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = "#46566a";
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, mw, mh);

  // lane
  ctx.fillStyle = "#3a3326";
  ctx.fillRect(mx, my + (LANE_Y - LANE_HALF_WIDTH) * sy, mw, LANE_HALF_WIDTH * 2 * sy);
  // walls
  ctx.fillStyle = "#2c3540";
  for (const wl of WALLS) {
    ctx.fillRect(mx + wl.x * sx, my + wl.y * sy, wl.w * sx, wl.h * sy);
  }

  const dot = (pos: Vec, color: string, r: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + pos.x * sx, my + pos.y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const active = e.activeHero();
  for (const u of e.units) {
    if (u.dead) continue;
    if (u.kind === "base") dot(u.pos, TEAM_COLOR[u.team], 4);
    else if (u.kind === "tower") dot(u.pos, TEAM_COLOR[u.team], 3);
    else if (u.kind === "minion") dot(u.pos, TEAM_COLOR[u.team], 1.3);
    else if (u.kind === "jungle") dot(u.pos, "#8d6e63", 1.8);
    else if (u.kind === "hero") {
      dot(u.pos, u.id === active?.id ? "#ffeb3b" : TEAM_COLOR[u.team], 3);
    }
  }

  // viewport rect
  const vw = e.viewport.w / e.camera.scale;
  const vh = e.viewport.h / e.camera.scale;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mx + (e.camera.x - vw / 2) * sx,
    my + (e.camera.y - vh / 2) * sy,
    vw * sx,
    vh * sy,
  );
  ctx.restore();
}

function shade(hex: string): string {
  // crude darken for outlines
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 60);
  const g = Math.max(0, ((n >> 8) & 255) - 60);
  const b = Math.max(0, (n & 255) - 60);
  return `rgb(${r},${g},${b})`;
}
