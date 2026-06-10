import { BASE_POS, BUSHES, LANE_HALF_WIDTH, LANE_Y, WALLS, WORLD } from "./map";
import type { Hero, RenderView, StatusType, Unit, Vec } from "./types";

function hasStatus(h: Hero, type: StatusType): boolean {
  return h.statuses.some((s) => s.type === type);
}

const TEAM_COLOR = { blue: "#42a5f5", red: "#ef5350", neutral: "#bdbdbd" } as const;

export function render(ctx: CanvasRenderingContext2D, e: RenderView) {
  const { w, h } = e.viewport;
  const cam = e.camera;

  ctx.save();
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  drawMap(ctx, e);
  drawEffects(ctx, e);
  drawUnits(ctx, e);
  drawProjectiles(ctx, e);
  drawFloats(ctx, e);

  ctx.restore();

  drawMinimap(ctx, e);
}

function drawMap(ctx: CanvasRenderingContext2D, e: RenderView) {
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

function drawUnits(ctx: CanvasRenderingContext2D, e: RenderView) {
  const active = e.activeHero();
  // draw order: structures, jungle, minions, heroes
  const order = (u: Unit) =>
    u.kind === "base" || u.kind === "tower" ? 0 : u.kind === "jungle" ? 1 : u.kind === "minion" ? 2 : 3;
  const units = [...e.units].sort((a, b) => order(a) - order(b));

  for (const u of units) {
    if (u.dead && u.kind !== "base") continue;
    switch (u.kind) {
      case "base":
        drawBase(ctx, u);
        break;
      case "tower":
        drawTower(ctx, u);
        break;
      case "jungle":
        drawCircleUnit(ctx, u, "#8d6e63", "#5d4037");
        drawHpBar(ctx, u, 36);
        break;
      case "minion":
        drawCircleUnit(ctx, u, TEAM_COLOR[u.team], shade(TEAM_COLOR[u.team]));
        drawHpBar(ctx, u, 26);
        break;
      case "hero":
        drawHero(ctx, u, active?.id === u.id);
        break;
    }
  }
}

function drawBase(ctx: CanvasRenderingContext2D, u: Unit) {
  const c = TEAM_COLOR[u.team];
  ctx.save();
  ctx.translate(u.pos.x, u.pos.y);
  // platform
  ctx.fillStyle = "#222c3a";
  ctx.beginPath();
  ctx.arc(0, 0, u.radius + 14, 0, Math.PI * 2);
  ctx.fill();
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
  drawHpBar(ctx, u, 110);
}

function drawTower(ctx: CanvasRenderingContext2D, u: Unit) {
  const c = TEAM_COLOR[u.team];
  ctx.save();
  ctx.translate(u.pos.x, u.pos.y);
  ctx.fillStyle = "#37474f";
  ctx.beginPath();
  ctx.arc(0, 0, u.radius + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c;
  ctx.fillRect(-12, -42, 24, 48);
  ctx.beginPath();
  ctx.arc(0, -44, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  drawHpBar(ctx, u, 64);
}

function drawCircleUnit(ctx: CanvasRenderingContext2D, u: Unit, fill: string, stroke: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(u.pos.x, u.pos.y, u.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawHero(ctx: CanvasRenderingContext2D, h: Hero, isActive: boolean) {
  const { x, y } = h.pos;
  const teamC = TEAM_COLOR[h.team];

  // recall channel ring
  if (h.recallTimer > 0) {
    const frac = 1 - h.recallTimer / 3;
    ctx.strokeStyle = "#80deea";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, h.radius + 16, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }

  // active player indicator
  if (isActive) {
    ctx.strokeStyle = "#ffeb3b";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, h.radius + 9, Date.now() / 400, Date.now() / 400 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // body
  ctx.fillStyle = h.color;
  ctx.strokeStyle = teamC;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, h.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // facing tick
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + h.facing.x * (h.radius - 6), y + h.facing.y * (h.radius - 6));
  ctx.lineTo(x + h.facing.x * (h.radius + 7), y + h.facing.y * (h.radius + 7));
  ctx.stroke();

  // shield bubble
  if (hasStatus(h, "shield")) {
    ctx.strokeStyle = "rgba(165,214,167,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, h.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // status markers
  let badge = "";
  if (hasStatus(h, "stun")) badge = "💫";
  else if (hasStatus(h, "root")) badge = "🌿";
  else if (hasStatus(h, "poison")) badge = "☠";
  if (badge) {
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(badge, x, y - h.radius - 30);
  }

  // name + level
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = h.humanLabel ? "#ffeb3b" : "rgba(255,255,255,0.85)";
  const label = h.humanLabel ? `${h.humanLabel}・${h.name}` : h.name;
  ctx.fillText(`${label} Lv${h.level}`, x, y + h.radius + 22);

  // hp / mp bars
  const bw = 56;
  const bx = x - bw / 2;
  const by = y - h.radius - 18;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
  ctx.fillStyle = h.team === "blue" ? "#4caf50" : "#ef5350";
  ctx.fillRect(bx, by, bw * Math.max(0, h.hp / h.maxHp), 5);
  ctx.fillStyle = "#42a5f5";
  ctx.fillRect(bx, by + 5, bw * Math.max(0, h.mp / h.maxMp), 3);
}

function drawHpBar(ctx: CanvasRenderingContext2D, u: Unit, width: number) {
  if (u.dead || u.hp >= u.maxHp) return;
  const x = u.pos.x - width / 2;
  const y = u.pos.y - u.radius - 14;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - 1, y - 1, width + 2, 7);
  ctx.fillStyle = u.team === "blue" ? "#4caf50" : u.team === "red" ? "#ef5350" : "#ffb74d";
  ctx.fillRect(x, y, width * Math.max(0, u.hp / u.maxHp), 5);
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

function drawFloats(ctx: CanvasRenderingContext2D, e: RenderView) {
  ctx.textAlign = "center";
  for (const f of e.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.font = `bold ${f.size}px sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.pos.x, f.pos.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.pos.x, f.pos.y);
  }
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx: CanvasRenderingContext2D, e: RenderView) {
  const mw = Math.min(190, e.viewport.w * 0.22);
  const mh = mw * (WORLD.h / WORLD.w);
  const mx = e.viewport.w - mw - 10;
  const my = 10;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;

  ctx.save();
  ctx.globalAlpha = 0.85;
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
    if (u.kind === "base") dot(u.pos, TEAM_COLOR[u.team], 5);
    else if (u.kind === "tower") dot(u.pos, TEAM_COLOR[u.team], 3.5);
    else if (u.kind === "minion") dot(u.pos, TEAM_COLOR[u.team], 1.5);
    else if (u.kind === "jungle") dot(u.pos, "#8d6e63", 2);
    else if (u.kind === "hero") {
      dot(u.pos, u.id === active?.id ? "#ffeb3b" : TEAM_COLOR[u.team], 3.5);
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
