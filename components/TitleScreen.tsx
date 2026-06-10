"use client";

import { useState } from "react";
import { ALL_CHAR_IDS, CHARACTERS } from "@/lib/game/characters";
import type { CharId, Difficulty, GameConfig, GameMode, HumanHeroConfig } from "@/lib/game/types";

const MODES: { id: GameMode; name: string; desc: string }[] = [
  { id: "cpu", name: "CPU戦", desc: "あなた1人 + 味方CPU2体 vs 敵CPU3体" },
  { id: "local", name: "ローカル対人戦", desc: "同一端末で6人が交代操作（3vs3全員プレイヤー）" },
  { id: "mixed", name: "CPU混合対人戦", desc: "プレイヤー複数 + CPU補完（交代操作）" },
];

const DIFFS: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "易しい" },
  { id: "normal", name: "普通" },
  { id: "hard", name: "難しい" },
];

interface Props {
  onStart: (config: GameConfig) => void;
}

export default function TitleScreen({ onStart }: Props) {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [humanCount, setHumanCount] = useState(2);
  const [picks, setPicks] = useState<HumanHeroConfig[]>([]);
  const [step, setStep] = useState<"mode" | "chars">("mode");

  const totalHumans = mode === "cpu" ? 1 : mode === "local" ? 6 : humanCount;
  const currentSlot = picks.length;
  const currentTeam = currentSlot % 2 === 0 ? "blue" : "red";
  const taken = new Set(picks.map((p) => p.charId));

  const pickChar = (charId: CharId) => {
    const next: HumanHeroConfig[] = [
      ...picks,
      { charId, team: currentTeam, slot: currentSlot, label: `P${currentSlot + 1}` },
    ];
    if (next.length >= totalHumans) {
      onStart({
        mode: mode!,
        difficulty,
        humans: next,
        swapInterval: totalHumans > 1 ? 20 : 0,
      });
    } else {
      setPicks(next);
    }
  };

  const startCharSelect = () => {
    setPicks([]);
    setStep("chars");
  };

  if (step === "chars") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
        <h2 className="text-xl font-bold text-white">
          <span className={currentTeam === "blue" ? "text-sky-400" : "text-red-400"}>
            P{currentSlot + 1}（{currentTeam === "blue" ? "青チーム" : "赤チーム"}）
          </span>
          のキャラクターを選択
        </h2>
        <p className="text-xs text-slate-400">
          {picks.length} / {totalHumans} 人選択済み ・ 残りの枠はCPUが担当します
        </p>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
          {ALL_CHAR_IDS.map((id) => {
            const c = CHARACTERS[id];
            const disabled = taken.has(id);
            return (
              <button
                key={id}
                disabled={disabled}
                onClick={() => pickChar(id)}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  disabled
                    ? "cursor-not-allowed border-slate-800 bg-slate-900 opacity-40"
                    : "border-slate-700 bg-slate-800/80 hover:border-amber-400 hover:bg-slate-700 active:scale-95"
                }`}
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
          onClick={() => setStep("mode")}
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
        <p className="mt-1 text-sm tracking-widest text-slate-400">3vs3 BROWSER MOBA</p>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">ゲームモード</h3>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-xl border-2 p-3 text-left transition active:scale-[0.98] ${
              mode === m.id
                ? "border-amber-400 bg-amber-400/10"
                : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
            }`}
          >
            <div className="font-bold text-white">{m.name}</div>
            <div className="text-xs text-slate-400">{m.desc}</div>
          </button>
        ))}
      </div>

      {mode === "mixed" && (
        <div className="flex w-full max-w-2xl items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">人数</h3>
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setHumanCount(n)}
              className={`min-w-[48px] rounded-lg border-2 px-3 py-2 font-bold transition ${
                humanCount === n
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-slate-700 bg-slate-800/60 text-slate-300"
              }`}
            >
              {n}人
            </button>
          ))}
        </div>
      )}

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
      </div>

      <button
        disabled={!mode}
        onClick={startCharSelect}
        className="mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-12 py-4 text-xl font-black tracking-widest text-white shadow-lg shadow-orange-900/50 transition enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-30"
      >
        キャラクター選択へ
      </button>

      <p className="max-w-md text-center text-[11px] leading-relaxed text-slate-500">
        スマホは横向きでプレイしてください。左スティックで移動、A=攻撃 / Q・W=スキル / B=帰還。
        PCはクリック移動 + Q/Wキー + A(Space)キー攻撃。
      </p>
    </div>
  );
}
