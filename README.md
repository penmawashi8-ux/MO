# AETHER CLASH — 3vs3 Online Browser MOBA

魔法・機械・自然・霊体が交錯するオリジナルブラウザMOBA。スマホ横向き（landscape）対応。専用サーバー不要 — オンライン対戦はWebRTC（PeerJS）によるP2P接続で実現しており、Vercelの静的ホスティングだけで動作します。

## 遊び方

### ゲームモード
- **オンライン対戦** — ホストが「ルームを作成」して5文字のルームコードを共有 → 友達がコード入力で参加（最大6人）。空き枠はCPUが補完。ホスト端末がゲームを実行し、ゲストへ15Hzで状態を配信します
- **CPU戦（1人プレイ）** — あなた1人 + 味方CPU2体 vs 敵CPU3体

CPU難易度: 易しい / 普通 / 難しい

> オンライン対戦はPeerJSの無料パブリックシグナリングサーバーとSTUNを使用します。
> 厳しいNAT環境（社内ネットワーク等）ではTURNサーバーがないため接続できない場合があります。

### 操作方法

| 操作 | スマホ（横向き） | PC |
| --- | --- | --- |
| 移動 | 左側バーチャルジョイスティック | クリック移動 / 矢印キー |
| 通常攻撃 | Aボタン（最寄りの敵を自動ターゲット） | A / Space |
| スキル1 | Qボタン | Q |
| スキル2 | Wボタン | W |
| Base帰還 | Bボタン（3秒詠唱、被弾で中断） | B |

### キャラクター（6体）

| 名前 | ロール | Q | W |
| --- | --- | --- | --- |
| SOLARA | 炎の魔法使い / Mage | ファイアボール | 炎の渦（DoT） |
| THORNWALL | 樹木の守護者 / Tank | 根の拘束 | 大地の盾（無効化） |
| VEXIS | 霊体の暗殺者 / Assassin | シャドウステップ | 毒の刃（DoT） |
| AETHON | 機械弓兵 / Marksman | 炸裂矢（範囲） | スナイプ（貫通） |
| LUMIS | 光の治癒師 / Support | ヒールビーム | 光の加護（バフ） |
| KRAG | 岩石の戦士 / Fighter | ロックスマッシュ（スタン） | チャージ（吹き飛ばし） |

### ルール
- 敵チームの **Base（拠点コア）** を破壊したら勝利
- ミニオンが22秒ごとに自動進軍、レーンには防衛タワー
- 撃破でEXP獲得 → 最大Lv5までステータス強化
- ジャングルには中立モンスター（EXP源）
- 死亡後は一定時間でBaseにリスポーン

## 開発

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
```

ヘッドレス検証:

```bash
npx tsx scripts/simulate.ts       # CPU同士でフル試合をシミュレート
npx tsx scripts/test-net-flow.ts  # コマンド適用・スナップショット往復のテスト
```

## デプロイ（Vercel）

```bash
vercel deploy
```

バックエンド不要のため追加設定なしでそのままデプロイできます。

## 構成

```
app/
  page.tsx          # エントリーポイント・画面遷移（タイトル/ゲーム/リザルト）
  layout.tsx        # メタタグ・全画面・横向き設定
lib/game/
  engine.ts         # ゲームループ・状態管理・戦闘処理（ホスト/オフラインで実行）
  characters.ts     # キャラクター定義・スキルロジック
  ai.ts             # CPUステートマシン（Idle/Patrol/Chase/Attack/Retreat）
  map.ts            # マップ・タワー・ミニオン定数
  input.ts          # キーボード・マウス・タッチ入力
  commands.ts       # プレイヤーコマンド（ローカル/ネットワーク共通）
  net.ts            # PeerJSによるルーム管理（HostNet / GuestNet）
  snapshot.ts       # 状態スナップショット直列化 + ゲスト側RemoteView
  renderer.ts       # Canvas 2D描画・ミニマップ（RenderView抽象に描画）
components/
  GameCanvas.tsx    # ホスト/オフライン: エンジン駆動 + ゲストへ配信
  RemoteGameCanvas.tsx # ゲスト: スナップショット描画 + 入力送信
  OnlineLobby.tsx   # ルーム作成/参加・キャラ選択ロビー
  VirtualPad.tsx    # バーチャルジョイスティック + A/Q/W/Bボタン
  HUD.tsx           # HP/MPバー・スコア・各種オーバーレイ
  TitleScreen.tsx   # モード・難易度・キャラ選択
  ResultScreen.tsx  # 勝敗・KDA・ダメージ統計
```

### オンライン対戦のアーキテクチャ
- **ホスト権威型**: ホスト端末がエンジン（物理・戦闘・AI）を実行
- ゲストは入力コマンド（移動・攻撃・スキル・帰還）だけを送信
- ホストは約15Hzで圧縮スナップショット（約2〜3KB）を全ゲストへ配信
- ゲストは位置を指数平滑補間して描画（RemoteView）
- ゲスト切断時はそのヒーローをCPUが引き継ぎ

- HTML5 Canvas 2D + requestAnimationFrame（60fps）
- ピンチズーム/スクロール無効化（`touch-action: none`）
- 縦向きアクセス時は回転を促すオーバーレイを表示
