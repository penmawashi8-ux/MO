# AETHER CLASH — 3vs3 Browser MOBA

魔法・機械・自然・霊体が交錯するオリジナルブラウザMOBA。スマホ横向き（landscape）対応、バックエンド不要・完全クライアントサイドで動作します。

## 遊び方

### ゲームモード
- **CPU戦** — あなた1人 + 味方CPU2体 vs 敵CPU3体
- **ローカル対人戦** — 同一端末で6人が交代操作（3vs3全員プレイヤー、20秒ごとに操作交代）
- **CPU混合対人戦** — プレイヤー2〜5人 + CPU補完

CPU難易度: 易しい / 普通 / 難しい

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

ヘッドレスのエンジン検証（CPU同士でフル試合をシミュレート）:

```bash
npx tsx scripts/simulate.ts
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
  engine.ts         # ゲームループ・状態管理・戦闘処理
  characters.ts     # キャラクター定義・スキルロジック
  ai.ts             # CPUステートマシン（Idle/Patrol/Chase/Attack/Retreat）
  map.ts            # マップ・タワー・ミニオン定数
  input.ts          # キーボード・マウス・タッチ入力
  renderer.ts       # Canvas 2D描画・ミニマップ
components/
  GameCanvas.tsx    # Canvasマウント・ゲームループ駆動
  VirtualPad.tsx    # バーチャルジョイスティック + A/Q/W/Bボタン
  HUD.tsx           # HP/MPバー・スコア・各種オーバーレイ
  TitleScreen.tsx   # モード・難易度・キャラ選択
  ResultScreen.tsx  # 勝敗・KDA・ダメージ統計
```

- HTML5 Canvas 2D + requestAnimationFrame（60fps）
- ピンチズーム/スクロール無効化（`touch-action: none`）
- 縦向きアクセス時は回転を促すオーバーレイを表示
