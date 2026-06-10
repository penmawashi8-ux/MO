"use client";

import { useEffect, useRef } from "react";
import { Engine } from "@/lib/game/engine";
import type { InputManager } from "@/lib/game/input";
import { render } from "@/lib/game/renderer";
import type { GameConfig, GameResult, HudData } from "@/lib/game/types";

interface Props {
  config: GameConfig;
  input: InputManager;
  onHud: (hud: HudData) => void;
  onEnd: (result: GameResult) => void;
}

export default function GameCanvas({ config, input, onHud, onEnd }: Props) {
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

    const engine = new Engine(config, input);
    input.attach(canvas);

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
    let ended = false;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      engine.update(dt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, engine);

      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.12;
        onHudRef.current(engine.hudData());
      }

      if (engine.over && !ended) {
        ended = true;
        setTimeout(() => onEndRef.current(engine.over!), 1800);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      input.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, input]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 block"
      style={{ touchAction: "none" }}
    />
  );
}
