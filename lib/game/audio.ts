/**
 * Procedural audio: BGM + sound effects synthesized with WebAudio so no
 * audio assets are needed. Safe to import on the server (lazily creates
 * the AudioContext in the browser only, after a user gesture).
 */

export type SfxKind =
  | "attack"
  | "skill"
  | "kill"
  | "death"
  | "tower"
  | "levelup"
  | "recall"
  | "heal"
  | "victory"
  | "defeat";

export interface SfxEvent {
  k: SfxKind;
  x: number;
  y: number;
}

/** kinds that are played regardless of distance to the player */
export const GLOBAL_SFX: ReadonlySet<SfxKind> = new Set([
  "kill", "tower", "levelup", "victory", "defeat",
]);

const MUTE_KEY = "aether-clash-muted";

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmStep = 0;
  private bgmNextTime = 0;
  private unlockBound = false;
  private _muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      this._muted = localStorage.getItem(MUTE_KEY) === "1";
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean) {
    this._muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* private mode */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /** Create the context and hook a one-time gesture unlock. */
  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.16;
      this.bgmGain.connect(this.master);
    }
    if (this.ctx.state === "suspended" && !this.unlockBound) {
      this.unlockBound = true;
      const unlock = () => {
        this.ctx?.resume().catch(() => {});
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
      };
      window.addEventListener("pointerdown", unlock);
      window.addEventListener("keydown", unlock);
      window.addEventListener("touchstart", unlock);
    }
    return this.ctx;
  }

  // ------------------------------------------------------------- SFX

  private tone(
    freq: number, dur: number, type: OscillatorType, vol: number,
    slideTo?: number, when = 0,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq = 1200, when = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  play(kind: SfxKind) {
    if (this._muted) return;
    switch (kind) {
      case "attack":
        this.tone(520, 0.07, "square", 0.05, 240);
        break;
      case "skill":
        this.noise(0.16, 0.1, 2400);
        this.tone(300, 0.18, "sawtooth", 0.08, 760);
        break;
      case "kill":
        this.tone(660, 0.1, "square", 0.12);
        this.tone(990, 0.16, "square", 0.12, undefined, 0.08);
        break;
      case "death":
        this.tone(330, 0.45, "sawtooth", 0.12, 70);
        break;
      case "tower":
        this.noise(0.5, 0.25, 700);
        this.tone(120, 0.5, "triangle", 0.22, 45);
        break;
      case "levelup":
        this.tone(523, 0.09, "triangle", 0.12);
        this.tone(659, 0.09, "triangle", 0.12, undefined, 0.08);
        this.tone(784, 0.16, "triangle", 0.12, undefined, 0.16);
        break;
      case "recall":
        this.tone(880, 0.4, "sine", 0.1, 1760);
        break;
      case "heal":
        this.tone(587, 0.12, "sine", 0.1);
        this.tone(880, 0.18, "sine", 0.1, undefined, 0.09);
        break;
      case "victory":
        this.tone(523, 0.16, "square", 0.12);
        this.tone(659, 0.16, "square", 0.12, undefined, 0.15);
        this.tone(784, 0.16, "square", 0.12, undefined, 0.3);
        this.tone(1047, 0.5, "square", 0.13, undefined, 0.45);
        break;
      case "defeat":
        this.tone(440, 0.25, "sawtooth", 0.1, undefined, 0);
        this.tone(370, 0.25, "sawtooth", 0.1, undefined, 0.22);
        this.tone(311, 0.6, "sawtooth", 0.11, undefined, 0.44);
        break;
    }
  }

  /** Play a positional event, attenuated/skipped when far from `listener`. */
  playAt(ev: SfxEvent, listener: { x: number; y: number } | null) {
    if (GLOBAL_SFX.has(ev.k) || !listener) {
      this.play(ev.k);
      return;
    }
    const d = Math.hypot(ev.x - listener.x, ev.y - listener.y);
    if (d < 1000) this.play(ev.k);
  }

  // ------------------------------------------------------------- BGM

  /** Simple looping battle theme: bass + arpeggio + hi-hat, scheduled ahead. */
  startBgm() {
    const ctx = this.ensure();
    if (!ctx || this.bgmTimer) return;
    this.bgmStep = 0;
    this.bgmNextTime = ctx.currentTime + 0.1;
    this.bgmTimer = setInterval(() => this.scheduleBgm(), 80);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private bgmNote(freq: number, dur: number, type: OscillatorType, vol: number, when: number) {
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private bgmHat(when: number) {
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) return;
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.bgmGain);
    src.start(when);
  }

  private scheduleBgm() {
    const ctx = this.ctx;
    if (!ctx) return;
    const stepDur = 60 / 132 / 2; // 132 BPM, 8th notes
    // Am – F – C – G, one bar (8 steps) each
    const BASS = [110, 87.31, 130.81, 98];
    const ARP: number[][] = [
      [220, 261.63, 329.63, 440],
      [174.61, 220, 261.63, 349.23],
      [261.63, 329.63, 392, 523.25],
      [196, 246.94, 293.66, 392],
    ];
    while (this.bgmNextTime < ctx.currentTime + 0.25) {
      const t = this.bgmNextTime;
      const step = this.bgmStep % 32;
      const bar = Math.floor(step / 8);
      const sub = step % 8;
      if (sub % 4 === 0) this.bgmNote(BASS[bar], stepDur * 3.2, "triangle", 0.5, t);
      this.bgmNote(ARP[bar][sub % 4], stepDur * 0.9, "square", sub % 2 === 0 ? 0.16 : 0.1, t);
      if (sub % 2 === 1) this.bgmHat(t);
      this.bgmStep++;
      this.bgmNextTime += stepDur;
    }
  }
}

/** Singleton shared by all components. */
export const audio = new AudioManager();
