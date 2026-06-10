"use client";

import { useEffect, useRef } from "react";
import type { InputManager } from "@/lib/game/input";
import type { GuestNet } from "@/lib/game/net";
import { render } from "@/lib/game/renderer";
import { RemoteView } from "@/lib/game/snapshot";
import type { GameResult, HudData } from "@/lib/game/types";

interface Props {
  net: GuestNet;
  slot: number;
  input: InputManager;
  onHud: (hud: HudData) => void;
  onEnd: (result: GameResult) => void;
  onDisconnect: () => void;
}

/** Guest-side game screen: renders snapshots, sends input to the host. */
export default function RemoteGameCanvas({ net, slot, input, onHud, onEnd, onDisconnect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onHudRef = useRef(onHud);
  const onEndRef = useRef(onEnd);
  const onDisconnectRef = useRef(onDisconnect);
  onHudRef.current = onHud;
  onEndRef.current = onEnd;
  onDisconnectRef.current = onDisconnect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const view = new RemoteView(slot);
    input.attach(canvas);

    let ended = false;
    net.onSnap = (s) => view.setSnapshot(s);
    net.onEnd = (r) => {
      if (ended) return;
      ended = true;
      setTimeout(() => onEndRef.current(r), 1800);
    };
    net.onClose = () => {
      if (!ended) onDisconnectRef.current();
    };

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
      view.viewport = { w, h };
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    let joySendTimer = 0;
    let lastJoy = { x: 0, y: 0, active: false };

    const sendInput = (dt: number) => {
      const kb = input.keyboardDir();
      const joy = input.joy.active
        ? input.joy
        : kb
          ? { x: kb.x, y: kb.y, active: true }
          : { x: 0, y: 0, active: false };

      joySendTimer -= dt;
      const changed =
        joy.active !== lastJoy.active ||
        Math.abs(joy.x - lastJoy.x) > 0.08 ||
        Math.abs(joy.y - lastJoy.y) > 0.08;
      if (changed || (joy.active && joySendTimer <= 0)) {
        net.sendCmd({ k: "joy", x: joy.x, y: joy.y, active: joy.active });
        lastJoy = { ...joy };
        joySendTimer = 0.1;
      }

      const click = input.consumeClick();
      if (click) {
        const w = view.screenToWorld(click);
        net.sendCmd({ k: "move", x: w.x, y: w.y });
      }
      const aim = input.mouseScreen ? view.screenToWorld(input.mouseScreen) : null;
      if (input.consumePressed("A")) net.sendCmd({ k: "attack" });
      if (input.consumePressed("Q")) net.sendCmd({ k: "skill", slot: "q", aim });
      if (input.consumePressed("W")) net.sendCmd({ k: "skill", slot: "w", aim });
      if (input.consumePressed("B")) net.sendCmd({ k: "recall" });
      input.endFrame();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      sendInput(dt);
      view.update(dt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, view);

      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.12;
        onHudRef.current(view.hudData());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      input.detach();
      net.onSnap = null;
      net.onEnd = null;
      net.onClose = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, slot, input]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 block"
      style={{ touchAction: "none" }}
    />
  );
}
