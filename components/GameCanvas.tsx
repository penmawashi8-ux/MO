"use client";

import { useEffect, useRef } from "react";
import { audio, type SfxEvent } from "@/lib/game/audio";
import { Engine } from "@/lib/game/engine";
import type { InputManager } from "@/lib/game/input";
import type { HostNet } from "@/lib/game/net";
import { render } from "@/lib/game/renderer";
import { buildSnapshot } from "@/lib/game/snapshot";
import type { GameConfig, GameResult, HudData } from "@/lib/game/types";

interface Props {
  config: GameConfig;
  input: InputManager;
  onHud: (hud: HudData) => void;
  onEnd: (result: GameResult) => void;
  /** present when hosting an online room: broadcast state, apply guest input */
  net?: HostNet | null;
}

export default function GameCanvas({ config, input, onHud, onEnd, net }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onHudRef = useRef(onHud);
  const onEndRef = useRef(onEnd);
  onHudRef.current = onHud;
  onEndRef.current = onEnd;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = new Engine(config);
    input.attach(canvas);
    audio.startBgm();

    if (net) {
      net.onCommand = (slot, c) => engine.pushCommand(slot, c);
      net.onGuestLeft = (slot) => engine.releaseSlot(slot);
    }

    // best-effort landscape lock (requires fullscreen on some browsers)
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      orientation.lock?.("landscape").catch(() => {});
    } catch {
      /* unsupported */
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      engine.viewport = { w, h };
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    let snapTimer = 0;
    let ended = false;
    let wasDead = false;
    const pendingSfx: SfxEvent[] = [];

    const feedLocalInput = () => {
      const slot = engine.cameraSlot;
      if (slot === null) {
        input.endFrame();
        return;
      }
      const buf = engine.ensureBuffer(slot);
      const kb = input.keyboardDir();
      const joy = input.joy.active
        ? input.joy
        : kb
          ? { x: kb.x, y: kb.y, active: true }
          : { x: 0, y: 0, active: false };
      buf.push({ k: "joy", ...joy });

      const click = input.consumeClick();
      if (click) {
        const w = engine.screenToWorld(click);
        buf.push({ k: "move", x: w.x, y: w.y });
      }
      const aim = input.mouseScreen ? engine.screenToWorld(input.mouseScreen) : null;
      if (input.consumePressed("A")) buf.push({ k: "attack" });
      if (input.consumePressed("Q")) buf.push({ k: "skill", slot: "q", aim });
      if (input.consumePressed("W")) buf.push({ k: "skill", slot: "w", aim });
      if (input.consumePressed("B")) buf.push({ k: "recall" });
      input.endFrame();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      feedLocalInput();
      engine.update(dt);

      // play new sound events near the local hero; queue them for guests
      const events = engine.sfx.splice(0);
      if (events.length > 0) {
        const me = engine.activeHero();
        for (const ev of events) audio.playAt(ev, me?.pos ?? null);
        if (net) pendingSfx.push(...events);
      }
      const meNow = engine.activeHero();
      if (meNow) {
        if (meNow.dead && !wasDead) audio.play("death");
        wasDead = meNow.dead;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, engine);

      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.12;
        onHudRef.current(engine.hudData());
      }

      if (net) {
        snapTimer -= dt;
        if (snapTimer <= 0) {
          snapTimer = 1 / 15;
          net.broadcastSnapshot(buildSnapshot(engine, pendingSfx.splice(0)));
        }
      }

      if (engine.over && !ended) {
        ended = true;
        net?.sendEnd(engine.over);
        setTimeout(() => onEndRef.current(engine.over!), 1800);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      audio.stopBgm();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      input.detach();
      if (net) {
        net.onCommand = null;
        net.onGuestLeft = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, input, net]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 block"
      style={{ touchAction: "none" }}
    />
  );
}
