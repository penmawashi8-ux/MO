"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_CHAR_IDS, CHARACTERS } from "@/lib/game/characters";
import { GuestNet, HostNet, type LobbyState } from "@/lib/game/net";
import type { CharId, Difficulty, GameConfig } from "@/lib/game/types";

const DIFFS: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "易しい" },
  { id: "normal", name: "普通" },
  { id: "hard", name: "難しい" },
];

interface Props {
  onHostStart: (net: HostNet, config: GameConfig) => void;
  onGuestStart: (net: GuestNet, slot: number) => void;
  onBack: () => void;
}

type Phase = "menu" | "connecting" | "host" | "guest";

export default function OnlineLobby({ onHostStart, onGuestStart, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [mySlot, setMySlot] = useState(0);
  const hostRef = useRef<HostNet | null>(null);
  const guestRef = useRef<GuestNet | null>(null);
  const startedRef = useRef(false);

  // clean up the connection if the user leaves the lobby without starting
  useEffect(() => {
    return () => {
      if (!startedRef.current) {
        hostRef.current?.destroy();
        guestRef.current?.destroy();
      }
    };
  }, []);

  const createRoom = async () => {
    setPhase("connecting");
    setError(null);
    try {
      const net = await HostNet.create();
      hostRef.current = net;
      net.onLobbyChange = setLobby;
      setLobby(net.lobbyState());
      setMySlot(0);
      setPhase("host");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ルームを作成できませんでした");
      setPhase("menu");
    }
  };

  const joinRoom = async () => {
    if (joinCode.trim().length < 5) {
      setError("5文字のルームコードを入力してください");
      return;
    }
    setPhase("connecting");
    setError(null);
    try {
      const net = await GuestNet.join(joinCode);
      guestRef.current = net;
      net.onLobby = setLobby;
      net.onStart = (slot) => {
        startedRef.current = true;
        setMySlot(slot);
        onGuestStart(net, slot);
      };
      net.onClose = () => {
        setError("ホストとの接続が切れました");
        setPhase("menu");
        setLobby(null);
      };
      setPhase("guest");
    } catch (err) {
      setError(err instanceof Error ? err.message : "参加できませんでした");
      setPhase("menu");
    }
  };

  const pickChar = (charId: CharId) => {
    if (phase === "host") {
      hostRef.current?.setChar(0, charId);
    } else if (phase === "guest") {
      guestRef.current?.sendPick(charId);
    }
  };

  const startGame = () => {
    const net = hostRef.current;
    if (!net || !net.allPicked()) return;
    startedRef.current = true;
    const config = net.start();
    onHostStart(net, config);
  };

  // ---------------------------------------------------------------- views

  if (phase === "menu" || phase === "connecting") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
        <h2 className="text-3xl font-black tracking-widest text-white">オンライン対戦</h2>
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {phase === "connecting" ? (
          <div className="animate-pulse text-lg font-bold text-amber-300">接続中…</div>
        ) : (
          <>
            <button
              onClick={createRoom}
              className="w-72 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-black tracking-widest text-white shadow-lg transition hover:scale-105 active:scale-95"
            >
              ルームを作成
            </button>
            <div className="flex w-72 items-center gap-2">
              <div className="h-px flex-1 bg-slate-700" />
              <span className="text-xs text-slate-500">または</span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>
            <div className="flex w-72 flex-col gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="ルームコード（5文字）"
                className="rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-3 text-center text-xl font-black tracking-[0.4em] text-white placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                onClick={joinRoom}
                className="rounded-xl border-2 border-amber-400/60 bg-amber-400/10 px-8 py-3 text-lg font-black tracking-widest text-amber-300 transition hover:bg-amber-400/20 active:scale-95"
              >
                ルームに参加
              </button>
            </div>
          </>
        )}
        <button
          onClick={onBack}
          className="mt-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← タイトルへ戻る
        </button>
        <p className="max-w-sm text-center text-[11px] leading-relaxed text-slate-500">
          P2P通信（WebRTC）で接続します。ホストがルームコードを共有し、最大6人で3vs3。
          空き枠はCPUが補完します。
        </p>
      </div>
    );
  }

  // host / guest lobby
  const isHost = phase === "host";
  const taken = new Set(lobby?.players.map((p) => p.charId).filter(Boolean) as CharId[]);
  const me = lobby?.players.find((p) => p.slot === (isHost ? 0 : mySlot));
  const myPick = isHost
    ? lobby?.players.find((p) => p.slot === 0)?.charId
    : me?.charId;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
      {isHost && hostRef.current && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-amber-400/50 bg-amber-400/10 px-5 py-2">
          <span className="text-xs font-bold text-slate-300">ルームコード</span>
          <span className="text-3xl font-black tracking-[0.3em] text-amber-300">
            {hostRef.current.code}
          </span>
        </div>
      )}
      {!isHost && (
        <div className="text-sm font-bold text-slate-300">
          ルームに参加中 — ホストの開始を待っています
        </div>
      )}

      {/* players */}
      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
        {lobby?.players.map((p) => {
          const def = p.charId ? CHARACTERS[p.charId] : null;
          return (
            <div
              key={p.slot}
              className={`flex min-w-[100px] flex-col items-center rounded-lg border-2 px-3 py-2 ${
                p.team === "blue" ? "border-sky-500/60 bg-sky-950/40" : "border-red-500/60 bg-red-950/40"
              }`}
            >
              <span className="text-xs font-black text-white">
                {p.label}
                {p.isHost && <span className="ml-1 text-amber-300">★</span>}
                {(isHost ? p.slot === 0 : p.slot === mySlot) && (
                  <span className="ml-1 text-green-400">（あなた）</span>
                )}
              </span>
              <span className="text-[10px] text-slate-400">
                {p.team === "blue" ? "青チーム" : "赤チーム"}
              </span>
              <span className="mt-1 text-[11px] font-bold" style={{ color: def?.color ?? "#64748b" }}>
                {def ? def.name : "選択中…"}
              </span>
            </div>
          );
        })}
        {(lobby?.players.length ?? 0) < 6 && (
          <div className="flex min-w-[100px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 px-3 py-2 text-[11px] text-slate-500">
            空き枠はCPU
          </div>
        )}
      </div>

      {/* char select */}
      <h3 className="text-sm font-bold text-white">キャラクターを選択</h3>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
        {ALL_CHAR_IDS.map((id) => {
          const c = CHARACTERS[id];
          const isMine = myPick === id;
          const disabled = taken.has(id) && !isMine;
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => pickChar(id)}
              className={`rounded-xl border-2 p-2 text-left transition ${
                isMine
                  ? "border-amber-400 bg-amber-400/10"
                  : disabled
                    ? "cursor-not-allowed border-slate-800 bg-slate-900 opacity-40"
                    : "border-slate-700 bg-slate-800/80 hover:border-amber-400 active:scale-95"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-5 w-5 rounded-full border-2 border-white/40"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-sm font-bold text-white">{c.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-amber-300">
                {c.roleJp}／{c.role}
              </div>
              <div className="text-[10px] leading-tight text-slate-400">
                Q: {c.q.name} ／ W: {c.w.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* difficulty (host only) */}
      {isHost && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">CPU難易度</span>
          {DIFFS.map((d) => (
            <button
              key={d.id}
              onClick={() => hostRef.current?.setDifficulty(d.id)}
              className={`rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition ${
                lobby?.difficulty === d.id
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-slate-700 bg-slate-800/60 text-slate-300"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
      {!isHost && lobby && (
        <div className="text-xs text-slate-400">
          CPU難易度: {DIFFS.find((d) => d.id === lobby.difficulty)?.name}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← 退出
        </button>
        {isHost && (
          <button
            disabled={!lobby || lobby.players.some((p) => p.charId === null)}
            onClick={startGame}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-10 py-2.5 text-lg font-black tracking-widest text-white shadow-lg transition enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-30"
          >
            ゲーム開始
          </button>
        )}
      </div>
    </div>
  );
}
