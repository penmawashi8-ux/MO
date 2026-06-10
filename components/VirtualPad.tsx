"use client";

import { useCallback, useRef, useState } from "react";
import type { InputManager, ActionButton } from "@/lib/game/input";
import type { HudData, HudSkill } from "@/lib/game/types";

interface Props {
  input: InputManager;
  hud: HudData | null;
}

const JOY_SIZE = 136;
const KNOB_SIZE = 56;

export default function VirtualPad({ input, hud }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[110] select-none">
      <Joystick input={input} />
      <Buttons input={input} hud={hud} />
    </div>
  );
}

function Joystick({ input }: { input: InputManager }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateFromTouch = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const max = rect.width / 2 - KNOB_SIZE / 3;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      setKnob({ x: dx, y: dy });
      const nd = Math.max(d, 1);
      input.setJoystick(dx / nd || 0, dy / nd || 0, d > 8);
    },
    [input],
  );

  const release = useCallback(() => {
    touchId.current = null;
    setKnob({ x: 0, y: 0 });
    input.setJoystick(0, 0, false);
  }, [input]);

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.changedTouches[0];
    touchId.current = t.identifier;
    updateFromTouch(t.clientX, t.clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchId.current) {
        updateFromTouch(t.clientX, t.clientY);
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) release();
    }
  };

  return (
    <div
      ref={baseRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="pointer-events-auto absolute bottom-5 left-5 rounded-full border-2 border-white/25 bg-white/10 backdrop-blur-sm"
      style={{ width: JOY_SIZE, height: JOY_SIZE, touchAction: "none" }}
    >
      <div
        className="absolute rounded-full border-2 border-white/40 bg-white/30"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: JOY_SIZE / 2 - KNOB_SIZE / 2 + knob.x,
          top: JOY_SIZE / 2 - KNOB_SIZE / 2 + knob.y,
        }}
      />
    </div>
  );
}

function PadButton({
  label,
  sub,
  skill,
  size,
  className,
  onPress,
}: {
  label: string;
  sub?: string;
  skill?: HudSkill;
  size: number;
  className?: string;
  onPress: () => void;
}) {
  const onCd = skill && skill.cd > 0;
  const disabled = skill ? !skill.ready : false;
  const cdFrac = onCd && skill ? skill.cd / skill.cdMax : 0;

  return (
    <button
      onTouchStart={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPress();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`pointer-events-auto relative flex flex-col items-center justify-center overflow-hidden rounded-full border-2 font-black text-white backdrop-blur-sm transition active:scale-90 ${
        disabled ? "border-white/15 bg-black/40 text-white/40" : "border-white/40 bg-white/15"
      } ${className ?? ""}`}
      style={{ width: size, height: size, touchAction: "none" }}
    >
      <span className="text-xl leading-none">{label}</span>
      {sub && <span className="mt-0.5 text-[8px] font-bold leading-none opacity-80">{sub}</span>}
      {onCd && skill && (
        <>
          <div
            className="absolute inset-x-0 bottom-0 bg-black/70"
            style={{ height: `${cdFrac * 100}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-amber-300">
            {Math.ceil(skill.cd)}
          </span>
        </>
      )}
    </button>
  );
}

function Buttons({ input, hud }: { input: InputManager; hud: HudData | null }) {
  const press = (btn: ActionButton) => input.press(btn);
  const q = hud?.hero?.q;
  const w = hud?.hero?.w;

  return (
    <div className="absolute bottom-4 right-4" style={{ width: 200, height: 180 }}>
      {/* B: recall (top-left of cluster) */}
      <div className="absolute left-0 top-0">
        <PadButton label="B" sub="帰還" size={56} onPress={() => press("B")} />
      </div>
      {/* W skill (top-right) */}
      <div className="absolute right-2 top-0">
        <PadButton label="W" sub={w?.name} skill={w} size={64} onPress={() => press("W")} />
      </div>
      {/* Q skill (left of A) */}
      <div className="absolute bottom-2 left-2">
        <PadButton label="Q" sub={q?.name} skill={q} size={64} onPress={() => press("Q")} />
      </div>
      {/* A: attack (big, bottom-right) */}
      <div className="absolute bottom-0 right-0">
        <PadButton
          label="A"
          sub="攻撃"
          size={76}
          className="!border-amber-400/60 !bg-amber-500/25"
          onPress={() => press("A")}
        />
      </div>
    </div>
  );
}
