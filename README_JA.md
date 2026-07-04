![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 言語:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md)

# RAPTOR — アーキテクチャ・コンストラクター

> マイクロサービスシステムの設計、トラフィックシミュレーション、ドキュメント生成のためのブラウザベースのツール。ビルド不要、npm不要 — `index.html` を開いてすぐ使えます。

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## クイックスタート

```bash
npx serve .     # → http://localhost:5500
```

---

## ⚡ セットアップ — RAPTOR AI

> 無料 · カード不要 · 30秒

```
① console.groq.com → 登録 → API Keys → Create API Key
② キーをコピー  →  gsk_••••••••••••••••••••••••
③ RAPTOR  →  🤖 AI  →  キーを貼り付け  →  Enter  ✓
```

キーは `localStorage` に保存されます — ブラウザごとに一度だけ入力。

---

## 🔌 任意の LLM で使用する（ChatGPT、Claude、Gemini…）

Groq を使わなくても OK。**どのモデルでも** JSON を生成してインポートできます：

```
① RAPTOR_FORMAT.md を開く  ← 完全な JSON スキーマ + 例
②   ↓
   ChatGPT / Claude / Gemini に貼り付け：
   「[あなたのシステム] の RAPTOR JSON を生成して。スキーマ：…」
③   ↓
   返答の JSON をコピー
④ RAPTOR  →  ファイル → JSON インポート  →  テキストを貼り付け  →  OK
   ↓
   ✦ キャンバスにブロック・接続・DBスキーマ・シナリオが即座に展開される
```

> **ヒント：** `RAPTOR_FORMAT.md` をファイルとして添付すると、ほとんどのモデルが一度に読み込みます。

---

## 機能

### ダイアグラム
- ブロック: Actor、Client、API Gateway、Load Balancer、CDN、WebSocket GW、BFF、Service、Auth、PostgreSQL、MySQL、MongoDB、Redis、Cassandra、ClickHouse、Elasticsearch、S3、Kafka、RabbitMQ、NATS、Queue、External
- ドラッグ＆ドロップ、衝突検出、双方向矢印
- レイヤーによる自動レイアウト — **Auto** ボタン
- ツールバーの **C1 / C2 / C3 / Seq** レベル切り替え

### テンプレート
- **18 システム**: 銀行、メッセンジャー、マーケットプレイス、YouTube、検索エンジン、タクシー、ソーシャルフィード、フードデリバリー、カーシェアリング、Spotify、Netflix、マッチングアプリ、暗号通貨取引所、EdTech、フィットネス、ホテル予約、クラウドストレージ、ToDo
- **44 エレメント** 10テーマ
- **61 DBテンプレート**: PostgreSQL、MongoDB、Cassandra、Redis、ClickHouse
- 3階層フライアウトメニュー

### シミュレーション
- ボールがシナリオパスを移動
- ボールをクリック → レイテンシ付きhopトレース詳細
- **カオスモード**: ノード障害、劣化、キャッシュリセット

### UMLシーケンス
- シナリオからPlantUML標準で自動生成
- Kafka → 点線矢印 `-)` 同期レスポンスなし
- **📋 PlantUML** ボタン — Confluenceにコピー

### RAPTOR AI
- `🤖 AI` ボタン → 右側チャットパネル
- **Groq** 使用（llama-3.3-70b、無料プラン）— [console.groq.com](https://console.groq.com) からAPIキーを貼り付け
- モード: **gen**（完全生成）、**chat**（計画）、**patch**（増分更新）

### エクスポート
- **Word (.docx)**、**draw.io**、**Swagger/OpenAPI YAML**

---

## 状態管理

すべてグローバルオブジェクト `S` に保存。保存 → JSONファイル。読み込み → JSONをキャンバスにドラッグ。
