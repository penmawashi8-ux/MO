"use client";

import { useCallback, useRef, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import OnlineLobby from "@/components/OnlineLobby";
import RemoteGameCanvas from "@/components/RemoteGameCanvas";
import ResultScreen from "@/components/ResultScreen";
import TitleScreen from "@/components/TitleScreen";
import VirtualPad from "@/components/VirtualPad";
import { InputManager } from "@/lib/game/input";
import type { GuestNet, HostNet } from "@/lib/game/net";
import type { GameConfig, GameResult, HudData } from "@/lib/game/types";

type Screen = "title" | "online" | "game" | "guest-game" | "result";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [guestSlot, setGuestSlot] = useState(0);
  const hostNetRef = useRef<HostNet | null>(null);
  const guestNetRef = useRef<GuestNet | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  if (!inputRef.current) inputRef.current = new InputManager();

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const handleStartCpu = useCallback((cfg: GameConfig) => {
    requestFullscreen();
    setConfig(cfg);
    setHud(null);
    setNotice(null);
    setScreen("game");
  }, []);

  const handleHostStart = useCallback((net: HostNet, cfg: GameConfig) => {
    requestFullscreen();
    hostNetRef.current = net;
    setConfig(cfg);
    setHud(null);
    setNotice(null);
    setScreen("game");
  }, []);

  const handleGuestStart = useCallback((net: GuestNet, slot: number) => {
    requestFullscreen();
    guestNetRef.current = net;
    setGuestSlot(slot);
    setHud(null);
    setNotice(null);
    setScreen("guest-game");
  }, []);

  const handleEnd = useCallback((res: GameResult) => {
    setResult(res);
    setScreen("result");
  }, []);

  const cleanupNets = () => {
    hostNetRef.current?.destroy();
    guestNetRef.current?.destroy();
    hostNetRef.current = null;
    guestNetRef.current = null;
  };

  const handleBackToTitle = useCallback(() => {
    cleanupNets();
    setResult(null);
    setConfig(null);
    setHud(null);
    setScreen("title");
  }, []);

  const handleGuestDisconnect = useCallback(() => {
    cleanupNets();
    setConfig(null);
    setHud(null);
    setNotice("ホストとの接続が切れました");
    setScreen("title");
  }, []);

  return (
    <main>
      {screen === "title" && (
        <>
          <TitleScreen onStart={handleStartCpu} onOnline={() => setScreen("online")} />
          {notice && (
            <div className="fixed left-1/2 top-4 z-[210] -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-950/90 px-4 py-2 text-sm text-red-200">
              {notice}
            </div>
          )}
        </>
      )}

      {screen === "online" && (
        <OnlineLobby
          onHostStart={handleHostStart}
          onGuestStart={handleGuestStart}
          onBack={handleBackToTitle}
        />
      )}

      {screen === "game" && config && (
        <>
          <GameCanvas
            config={config}
            input={inputRef.current}
            onHud={setHud}
            onEnd={handleEnd}
            net={hostNetRef.current}
          />
          <HUD hud={hud} />
          <VirtualPad input={inputRef.current} hud={hud} />
        </>
      )}

      {screen === "guest-game" && guestNetRef.current && (
        <>
          <RemoteGameCanvas
            net={guestNetRef.current}
            slot={guestSlot}
            input={inputRef.current}
            onHud={setHud}
            onEnd={(r) =>
              // victory/defeat from the guest's own team perspective
              handleEnd({ ...r, playerTeam: guestSlot % 2 === 0 ? "blue" : "red" })
            }
            onDisconnect={handleGuestDisconnect}
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
