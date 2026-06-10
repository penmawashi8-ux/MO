"use client";

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
  if (!hud) return null;
  const h = hud.hero;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] select-none">
      {/* top center: score + time */}
      <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-5 py-1.5 backdrop-blur-sm">
        <span className="text-lg font-black text-sky-400">{hud.kills.blue}</span>
        <span className="text-xs font-bold text-slate-300">{fmtTime(hud.time)}</span>
        <span className="text-lg font-black text-red-400">{hud.kills.red}</span>
      </div>

      {/* hot-seat indicator */}
      {hud.activeLabel && hud.swapIn !== null && (
        <div className="absolute left-1/2 top-12 -translate-x-1/2 rounded-full bg-black/50 px-3 py-0.5 text-[11px] font-bold text-amber-300">
          {hud.activeLabel} 操作中 ・ 交代まで {Math.ceil(hud.swapIn)}s
        </div>
      )}

      {/* banner */}
      {hud.banner && (
        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 animate-pulse rounded-xl bg-black/70 px-8 py-3 text-2xl font-black tracking-wider text-amber-300 shadow-xl">
          {hud.banner}
        </div>
      )}

      {/* death overlay */}
      {h?.dead && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/40">
          <div className="rounded-2xl bg-black/80 px-10 py-6 text-center">
            <div className="text-3xl font-black text-red-400">倒された…</div>
            <div className="mt-2 text-xl font-bold text-white">
              復活まで {Math.ceil(h.respawnIn)} 秒
            </div>
          </div>
        </div>
      )}

      {/* recall channel */}
      {h?.recalling && !h.dead && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-xl bg-black/70 px-6 py-2 text-lg font-bold text-cyan-300">
          帰還中… {h.recallIn.toFixed(1)}s
        </div>
      )}

      {/* bottom-center: hero status */}
      {h && (
        <div className="absolute bottom-2 left-1/2 w-[300px] -translate-x-1/2 rounded-xl bg-black/60 p-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/50 text-xs font-black text-black/80"
              style={{ backgroundColor: h.color }}
            >
              {h.level}
            </span>
            <div className="flex-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-300">
                <span>{h.name}</span>
                <span>
                  {h.hp}/{h.maxHp}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
                  style={{ width: `${(h.hp / h.maxHp) * 100}%` }}
                />
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-slate-900">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all"
                  style={{ width: `${(h.mp / h.maxMp) * 100}%` }}
                />
              </div>
              {h.expNext > 0 && (
                <div className="mt-0.5 h-1 overflow-hidden rounded bg-slate-900">
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
