"use client";

import { useState } from "react";
import { ALL_CHAR_IDS, CHARACTERS } from "@/lib/game/characters";
import type { CharId, Difficulty, GameConfig } from "@/lib/game/types";

const DIFFS: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "易しい" },
  { id: "normal", name: "普通" },
  { id: "hard", name: "難しい" },
];

interface Props {
  onStart: (config: GameConfig) => void;
  onOnline: () => void;
}

export default function TitleScreen({ onStart, onOnline }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [step, setStep] = useState<"top" | "chars">("top");

  const pickChar = (charId: CharId) => {
    onStart({
      mode: "cpu",
      difficulty,
      humans: [{ charId, team: "blue", slot: 0, label: "P1" }],
      swapInterval: 0,
    });
  };

  if (step === "chars") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
        <h2 className="text-xl font-bold text-white">キャラクターを選択</h2>
        <p className="text-xs text-slate-400">
          味方CPU2体・敵CPU3体は残りのキャラクターから自動編成されます
        </p>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
          {ALL_CHAR_IDS.map((id) => {
            const c = CHARACTERS[id];
            return (
              <button
                key={id}
                onClick={() => pickChar(id)}
                className="rounded-xl border-2 border-slate-700 bg-slate-800/80 p-3 text-left transition hover:border-amber-400 hover:bg-slate-700 active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-6 w-6 rounded-full border-2 border-white/40"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="font-bold text-white">{c.name}</span>
                </div>
                <div className="mt-1 text-[11px] text-amber-300">
                  {c.roleJp}／{c.role}
                </div>
                <div className="mt-1 text-[11px] leading-tight text-slate-300">{c.desc}</div>
                <div className="mt-1 text-[10px] leading-tight text-slate-400">
                  Q: {c.q.name} ／ W: {c.w.name}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setStep("top")}
          className="mt-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← 戻る
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-amber-300 via-orange-400 to-purple-400 bg-clip-text text-5xl font-black tracking-widest text-transparent drop-shadow-lg sm:text-6xl">
          AETHER CLASH
        </h1>
        <p className="mt-1 text-sm tracking-widest text-slate-400">3vs3 ONLINE BROWSER MOBA</p>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-2">
        <button
          onClick={onOnline}
          className="rounded-xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-500/20 to-orange-600/20 p-4 text-left transition hover:border-amber-300 hover:from-amber-500/30 hover:to-orange-600/30 active:scale-[0.98]"
        >
          <div className="text-lg font-black text-amber-300">オンライン対戦</div>
          <div className="text-xs text-slate-300">
            ルームコードで友達と対戦（最大6人・P2P接続・空き枠はCPU補完）
          </div>
        </button>
        <button
          onClick={() => setStep("chars")}
          className="rounded-xl border-2 border-slate-700 bg-slate-800/60 p-4 text-left transition hover:border-slate-500 active:scale-[0.98]"
        >
          <div className="text-lg font-black text-white">CPU戦（1人プレイ）</div>
          <div className="text-xs text-slate-400">あなた1人 + 味方CPU2体 vs 敵CPU3体</div>
        </button>
      </div>

      <div className="flex w-full max-w-2xl items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">CPU難易度</h3>
        {DIFFS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDifficulty(d.id)}
            className={`rounded-lg border-2 px-4 py-2 font-bold transition ${
              difficulty === d.id
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : "border-slate-700 bg-slate-800/60 text-slate-300"
            }`}
          >
            {d.name}
          </button>
        ))}
        <span className="text-[10px] text-slate-500">（CPU戦用。オンラインはロビーで設定）</span>
      </div>

      <p className="max-w-md text-center text-[11px] leading-relaxed text-slate-500">
        スマホは横向きでプレイしてください。左スティックで移動、A=攻撃 / Q・W=スキル / B=帰還。
        PCはクリック移動 + Q/Wキー + A(Space)キー攻撃。
      </p>
    </div>
  );
}
