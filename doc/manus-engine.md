# Manus engine を追加（CRX adapter）

企画メモ（実装前）。Orochi の engine として Manus を追加する。

## 目的

Manus を Orochi の 1 engine として扱う。これにより、Manus への相談・タスク投入を orochi の CLI / MCP / CRX から実行できる。

**API キーは使わない。** Manus の Web（ログイン済みセッション）を CRX で DOM 操作する。Suno / ChatGPT と同型。API の課金ゲートを回避できる。

## なぜ API ではなく CRX か

| 方式 | 前提 | 課金 |
|---|---|---|
| Manus 公式 API (`api.manus.ai/v2`) | API キー（developers 設定） | プラン/課金が必要な場合あり |
| CRX で manus.im を操作 | ログイン済みブラウザのみ | 不要（既存プラン内） |

既存の Suno / ChatGPT engine と同じ構造で足せるため、CRX 方式を採る。

## 追加点（Suno と同型）

| ファイル | 変更 |
|---|---|
| `crx/manus-content.js` | 新規。manus.im の prompt 入力・送信・完了検出 |
| `crx/engines/manus.js` | 新規。tab 取得 → content script へ `manus:run` |
| `crx/loop.js` | `ENGINES` に `manus: manusEngine` を追加 |
| `crx/manifest.json` | `content_scripts` に manus、`host_permissions` に `https://manus.im/*` |
| `deno/core/types.ts` | `EngineId` に `"manus"` を追加 |
| `deno/cli.ts` / `deno/mcp.ts` | engine enum とヘルプに manus を反映 |

## 受け入れ条件

```text
Given: ログイン済み manus.im と起動中の Orochi runtime
When:  orochi session open https://manus.im/app manus
And:   orochi loop run <id> "<prompt>"
Then:  manus.im で prompt が 1 回だけ送信される
And:   完了を検出し、結果テキストを runtime に返す
And:   auth 未ログイン時は auth-required を返す（無限 retry しない）
```

## 最初の用途

Manus に Suno の mp3 計画（`doc/suno-cli-mp3.md` / issue #40）をレビューさせ、5 点の未解決に答えさせる。その結果を orochi 内で受ける。

## リスク

- manus.im の DOM は変わる。セレクタは 1 箇所に集約する。
- 生成完了の判定が UI 依存。bounded timeout を必ず入れる。
- 長時間タスクは完了検出が難しい。まず 1 往復（prompt → 結果テキスト）に絞る。

## 参照

- `crx/loop.js` / `crx/engines/suno.js` / `crx/suno-content.js`
- `deno/core/types.ts`
- `doc/suno-cli-mp3.md`
