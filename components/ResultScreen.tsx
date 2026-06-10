"use client";

import { useEffect } from "react";
import { audio } from "@/lib/game/audio";
import type { GameResult } from "@/lib/game/types";

interface Props {
  result: GameResult;
  onBackToTitle: () => void;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ResultScreen({ result, onBackToTitle }: Props) {
  const playerWon = result.winner === result.playerTeam;

  useEffect(() => {
    audio.stopBgm();
    audio.play(playerWon ? "victory" : "defeat");
  }, [playerWon]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* my-auto (not justify-center) so tall content scrolls instead of clipping on landscape phones */}
      <div className="flex min-h-full flex-col items-center">
        <div className="my-auto flex w-full flex-col items-center gap-3 p-4">
          <h1
            className={`text-4xl font-black tracking-widest drop-shadow-lg sm:text-6xl ${
              playerWon ? "text-amber-300" : "text-slate-400"
            }`}
          >
            {playerWon ? "VICTORY!" : "DEFEAT…"}
          </h1>
          <p className="text-sm text-slate-400">
            勝者:{" "}
            <span className={result.winner === "blue" ? "font-bold text-sky-400" : "font-bold text-red-400"}>
              {result.winner === "blue" ? "青チーム" : "赤チーム"}
            </span>
            ・ 試合時間 {fmtTime(result.durationSec)}
          </p>

          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-1.5">ヒーロー</th>
                  <th className="px-2 py-1.5 text-center">Lv</th>
                  <th className="px-2 py-1.5 text-center">K / D / A</th>
                  <th className="px-3 py-1.5 text-right">与ダメージ</th>
                </tr>
              </thead>
              <tbody>
                {(["blue", "red"] as const).map((team) =>
                  result.heroes
                    .filter((h) => h.team === team)
                    .map((h, i) => (
                      <tr
                        key={`${team}-${i}`}
                        className={`border-t border-slate-800 ${
                          team === "blue" ? "bg-sky-950/40" : "bg-red-950/30"
                        }`}
                      >
                        <td className="px-3 py-1.5 font-bold text-white">
                          {h.humanLabel && (
                            <span className="mr-1 rounded bg-amber-400/20 px-1 text-[10px] text-amber-300">
                              {h.humanLabel}
                            </span>
                          )}
                          {h.name}
                        </td>
                        <td className="px-2 py-1.5 text-center text-slate-300">{h.level}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-slate-200">
                          {h.kills} / {h.deaths} / {h.assists}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-200">
                          {h.damage.toLocaleString()}
                        </td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={onBackToTitle}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-10 py-3 text-lg font-black tracking-widest text-white shadow-lg transition hover:scale-105 active:scale-95"
          >
            タイトルへ戻る
          </button>
        </div>
      </div>
    </div>
  );
}
