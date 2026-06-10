import type { DataConnection, Peer } from "peerjs";
import type { NetCommand } from "./commands";
import type { Snapshot } from "./snapshot";
import type { CharId, Difficulty, GameConfig, GameResult, Team } from "./types";

const PEER_PREFIX = "aether-clash-v1-";
// no ambiguous chars (0/O, 1/I/L)
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_PLAYERS = 6;

export interface LobbyPlayer {
  slot: number;
  label: string;
  team: Team;
  charId: CharId | null;
  isHost: boolean;
}

export interface LobbyState {
  players: LobbyPlayer[];
  difficulty: Difficulty;
}

type GuestMsg =
  | { t: "pick"; charId: CharId }
  | { t: "cmd"; c: NetCommand };

type HostMsg =
  | { t: "lobby"; s: LobbyState }
  | { t: "start"; slot: number }
  | { t: "snap"; s: Snapshot }
  | { t: "end"; r: GameResult }
  | { t: "full" };

function makeCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function teamForSlot(slot: number): Team {
  return slot % 2 === 0 ? "blue" : "red";
}

async function newPeer(id?: string): Promise<Peer> {
  const { default: Peer } = await import("peerjs");
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer();
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error("シグナリングサーバーに接続できません"));
    }, 15000);
    peer.on("open", () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Room host: owns the lobby and (after start) the authoritative engine. */
export class HostNet {
  readonly code: string;
  players: LobbyPlayer[];
  difficulty: Difficulty = "normal";
  started = false;

  onLobbyChange: ((s: LobbyState) => void) | null = null;
  onCommand: ((slot: number, c: NetCommand) => void) | null = null;
  onGuestLeft: ((slot: number) => void) | null = null;

  private peer: Peer;
  private conns = new Map<number, DataConnection>();

  private constructor(peer: Peer, code: string) {
    this.peer = peer;
    this.code = code;
    this.players = [{ slot: 0, label: "P1", team: "blue", charId: null, isHost: true }];

    peer.on("connection", (conn) => this.handleConnection(conn));
    peer.on("error", () => {
      /* per-connection errors are handled on the connection itself */
    });
  }

  static async create(): Promise<HostNet> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = makeCode();
      try {
        const peer = await newPeer(PEER_PREFIX + code);
        return new HostNet(peer, code);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("ルームを作成できませんでした");
  }

  private handleConnection(conn: DataConnection) {
    conn.on("open", () => {
      if (this.started || this.players.length >= MAX_PLAYERS) {
        conn.send({ t: "full" } satisfies HostMsg);
        setTimeout(() => conn.close(), 500);
        return;
      }
      // lowest free slot
      let slot = 1;
      while (this.players.some((p) => p.slot === slot)) slot++;
      this.players.push({
        slot,
        label: `P${slot + 1}`,
        team: teamForSlot(slot),
        charId: null,
        isHost: false,
      });
      this.players.sort((a, b) => a.slot - b.slot);
      this.conns.set(slot, conn);

      conn.on("data", (raw) => {
        const msg = raw as GuestMsg;
        if (msg.t === "pick") this.setChar(slot, msg.charId);
        else if (msg.t === "cmd") this.onCommand?.(slot, msg.c);
      });
      conn.on("close", () => {
        this.conns.delete(slot);
        if (!this.started) {
          this.players = this.players.filter((p) => p.slot !== slot);
          this.broadcastLobby();
        } else {
          this.onGuestLeft?.(slot);
        }
      });

      this.broadcastLobby();
    });
  }

  lobbyState(): LobbyState {
    return { players: this.players.map((p) => ({ ...p })), difficulty: this.difficulty };
  }

  setDifficulty(d: Difficulty) {
    this.difficulty = d;
    this.broadcastLobby();
  }

  setChar(slot: number, charId: CharId): boolean {
    if (this.players.some((p) => p.charId === charId && p.slot !== slot)) return false;
    const p = this.players.find((p) => p.slot === slot);
    if (!p) return false;
    p.charId = charId;
    this.broadcastLobby();
    return true;
  }

  allPicked(): boolean {
    return this.players.every((p) => p.charId !== null);
  }

  private broadcastLobby() {
    const s = this.lobbyState();
    this.onLobbyChange?.(s);
    this.broadcast({ t: "lobby", s });
  }

  /** Lock the lobby and build the game config. */
  start(): GameConfig {
    this.started = true;
    for (const [slot, conn] of this.conns) {
      conn.send({ t: "start", slot } satisfies HostMsg);
    }
    return {
      mode: "online",
      difficulty: this.difficulty,
      humans: this.players.map((p) => ({
        charId: p.charId!,
        team: p.team,
        slot: p.slot,
        label: p.label,
      })),
      swapInterval: 0,
    };
  }

  broadcastSnapshot(s: Snapshot) {
    this.broadcast({ t: "snap", s });
  }

  sendEnd(r: GameResult) {
    this.broadcast({ t: "end", r });
  }

  private broadcast(msg: HostMsg) {
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  destroy() {
    this.peer.destroy();
  }
}

/** Room guest: sends inputs, receives lobby/snapshots/result. */
export class GuestNet {
  mySlot = -1;

  onLobby: ((s: LobbyState) => void) | null = null;
  onStart: ((slot: number) => void) | null = null;
  onSnap: ((s: Snapshot) => void) | null = null;
  onEnd: ((r: GameResult) => void) | null = null;
  onClose: (() => void) | null = null;

  private peer: Peer;
  private conn: DataConnection;

  private constructor(peer: Peer, conn: DataConnection) {
    this.peer = peer;
    this.conn = conn;
  }

  static async join(code: string): Promise<GuestNet> {
    const peer = await newPeer();
    return new Promise((resolve, reject) => {
      const conn = peer.connect(PEER_PREFIX + code.toUpperCase().trim(), {
        reliable: true,
      });
      const timer = setTimeout(() => {
        peer.destroy();
        reject(new Error("ルームが見つかりません（コードを確認してください）"));
      }, 15000);
      peer.on("error", (err) => {
        clearTimeout(timer);
        peer.destroy();
        const e = err as Error & { type?: string };
        reject(
          e.type === "peer-unavailable"
            ? new Error("ルームが見つかりません（コードを確認してください）")
            : e,
        );
      });
      conn.on("open", () => {
        clearTimeout(timer);
        const net = new GuestNet(peer, conn);
        conn.on("data", (raw) => net.handleMessage(raw as HostMsg));
        conn.on("close", () => net.onClose?.());
        resolve(net);
      });
    });
  }

  private handleMessage(msg: HostMsg) {
    switch (msg.t) {
      case "lobby":
        this.onLobby?.(msg.s);
        break;
      case "start":
        this.mySlot = msg.slot;
        this.onStart?.(msg.slot);
        break;
      case "snap":
        this.onSnap?.(msg.s);
        break;
      case "end":
        this.onEnd?.(msg.r);
        break;
      case "full":
        this.onClose?.();
        break;
    }
  }

  sendPick(charId: CharId) {
    if (this.conn.open) this.conn.send({ t: "pick", charId } satisfies GuestMsg);
  }

  sendCmd(c: NetCommand) {
    if (this.conn.open) this.conn.send({ t: "cmd", c } satisfies GuestMsg);
  }

  destroy() {
    this.peer.destroy();
  }
}
