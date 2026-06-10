"use client";

import { useState } from "react";
import { audio } from "@/lib/game/audio";
import type { HudData } from "@/lib/game/types";

interface Props {
  hud: HudData | null;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HUD({ hud }: Props) {
  const [muted, setMuted] = useState(() => audio.muted);
  if (!hud) return null;
  const h = hud.hero;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] select-none">
      {/* top center: score + time */}
      <div className="absolute left-1/2 top-1 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-1 backdrop-blur-sm">
        <span className="text-base font-black leading-none text-sky-400">{hud.kills.blue}</span>
        <span className="text-[11px] font-bold leading-none text-slate-300">{fmtTime(hud.time)}</span>
        <span className="text-base font-black leading-none text-red-400">{hud.kills.red}</span>
      </div>

      {/* top right: sound toggle */}
      <button
        onClick={() => setMuted(audio.toggleMuted())}
        className="pointer-events-auto absolute right-2 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-base backdrop-blur-sm active:scale-90"
        aria-label={muted ? "サウンドをオンにする" : "サウンドをオフにする"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* hot-seat indicator */}
      {hud.activeLabel && hud.swapIn !== null && (
        <div className="absolute left-1/2 top-9 -translate-x-1/2 rounded-full bg-black/50 px-3 py-0.5 text-[11px] font-bold text-amber-300">
          {hud.activeLabel} 操作中 ・ 交代まで {Math.ceil(hud.swapIn)}s
        </div>
      )}

      {/* banner */}
      {hud.banner && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 animate-pulse whitespace-nowrap rounded-xl bg-black/70 px-6 py-2 text-lg font-black tracking-wider text-amber-300 shadow-xl">
          {hud.banner}
        </div>
      )}

      {/* death notice: compact banner that doesn't hide the battlefield */}
      {h?.dead && (
        <div className="absolute left-1/2 top-[30%] -translate-x-1/2 rounded-xl border border-red-500/40 bg-black/75 px-6 py-2.5 text-center backdrop-blur-sm">
          <div className="text-lg font-black leading-tight text-red-400">倒された…</div>
          <div className="text-sm font-bold text-white">復活まで {Math.ceil(h.respawnIn)} 秒</div>
        </div>
      )}

      {/* recall channel */}
      {h?.recalling && !h.dead && (
        <div className="absolute left-1/2 top-[30%] -translate-x-1/2 rounded-xl bg-black/70 px-5 py-1.5 text-base font-bold text-cyan-300">
          帰還中… {h.recallIn.toFixed(1)}s
        </div>
      )}

      {/* bottom-center: compact hero status (clear of pad & joystick) */}
      {h && (
        <div
          className="absolute left-1/2 w-44 -translate-x-1/2 rounded-lg bg-black/55 px-1.5 py-1 backdrop-blur-sm"
          style={{ bottom: "calc(0.25rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white/50 text-[11px] font-black text-black/80"
              style={{ backgroundColor: h.color }}
            >
              {h.level}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-[9px] font-bold leading-tight text-slate-300">
                <span className="truncate">{h.name}</span>
                <span>
                  {h.hp}/{h.maxHp}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
                  style={{ width: `${(h.hp / h.maxHp) * 100}%` }}
                />
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-sm bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all"
                  style={{ width: `${(h.mp / h.maxMp) * 100}%` }}
                />
              </div>
              {h.expNext > 0 && (
                <div className="mt-0.5 h-0.5 overflow-hidden rounded-sm bg-slate-900">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${(h.exp / h.expNext) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
