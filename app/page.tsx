"use client";

import { useCallback, useRef, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import ResultScreen from "@/components/ResultScreen";
import TitleScreen from "@/components/TitleScreen";
import VirtualPad from "@/components/VirtualPad";
import { InputManager } from "@/lib/game/input";
import type { GameConfig, GameResult, HudData } from "@/lib/game/types";

type Screen = "title" | "game" | "result";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  if (!inputRef.current) inputRef.current = new InputManager();

  const handleStart = useCallback((cfg: GameConfig) => {
    // best-effort fullscreen on the user gesture that starts the game
    document.documentElement.requestFullscreen?.().catch(() => {});
    setConfig(cfg);
    setHud(null);
    setScreen("game");
  }, []);

  const handleEnd = useCallback((res: GameResult) => {
    setResult(res);
    setScreen("result");
  }, []);

  const handleBackToTitle = useCallback(() => {
    setResult(null);
    setConfig(null);
    setScreen("title");
  }, []);

  return (
    <main>
      {screen === "title" && <TitleScreen onStart={handleStart} />}

      {screen === "game" && config && (
        <>
          <GameCanvas
            config={config}
            input={inputRef.current}
            onHud={setHud}
            onEnd={handleEnd}
          />
          <HUD hud={hud} />
          <VirtualPad input={inputRef.current} hud={hud} />
        </>
      )}

      {screen === "result" && result && (
        <ResultScreen result={result} onBackToTitle={handleBackToTitle} />
      )}

      {/* portrait orientation warning */}
      <div className="portrait-overlay fixed inset-0 z-[200] flex-col items-center justify-center gap-4 bg-slate-950/95 p-8 text-center">
        <div className="animate-pulse text-6xl">📱↻</div>
        <div className="text-xl font-bold text-white">横向きにしてください</div>
        <p className="text-sm text-slate-400">
          AETHER CLASH はスマホ横向き（ランドスケープ）専用です。
          <br />
          端末を回転してプレイしてください。
        </p>
      </div>
    </main>
  );
}
