# Orochi Loop Engines — コア設計

ログイン済みのWebアプリを**HTTPで無限に**回し、1 Goal を collect → operate → return で
通し切る。CRXがループドライバとなり、これはOrochiの**コア**である。
**エンジンはドメインごとの設定ファイル（JS）** に分かれており、ChatGPTもSunoも
「なんでも」並列処理できる（8セッションまで）。

## なぜコアか

- ブラウザログイン中のChatGPTは、`chatgpt.com/backend-api` 経由ならAPI課金が掛からず
  **上限なく使える**（従量/クォータ枯渇の心配が無い）。
- 同様に、ログイン済みブラウザは**Suno**（音楽生成）やそれ以外のWebアプリも、
  ドメイン別ドライバを足すだけで無限のエンジンになる。
- これまでの「AI = Conductor」を、実コスト0で実行可能にするのがこの設計の土台。
  「無限に回るWebアプリ」がエンジン。

## 構成

```text
crx/
├── loop.js           # エンジンレジストリ（ENGINES / runGoal）
├── engines/
│   ├── chatgpt.js    # ドメイン別設定: chatgpt.com（backend-api HTTP/SセSSE）
│   └── suno.js       # ドメイン別設定: suno.com（content script DOM操作）
├── suno-content.js   # suno.com 用 content script（service workerはDOMを持たない）
├── background.js     # session / Tab Group / runtime 連携 + browser op 実行
├── popup.html|js     # session 一覧・ループの開始/停止
└── manifest.json     # host_permissions: chatgpt.com / suno.com / localhost runtime
```

runtime(deno) は状態（8 Session・engine 属性）と特権操作（gh）を握る。ループの指揮はCRXが持つ。
ループ中のGitHub操作は runtime の API へ委譲し、**secretをエンジンへ渡さない**。

### Browser 操作は CLI / MCP からも可能

CLI / MCP は `/browser/commands` へ op を enqueue し、CRX が**alarm駆動**
（MV3 service workerはsetTimeoutが殺されるため `chrome.alarms`）でポーリングして
実行する（Tab Group 作成・URL 追加・focus・ungroup・loop 実行）。

```text
cli / mcp
   │ POST /browser/commands {kind, sessionId, urls|prompt}
   ▼
runtime (queue)
   │ GET /browser/commands （CRX が alarm で drain）
   ▼
crx/background.js
   ▼
runGoal(session, prompt) → ENGINES[engine].run()
```

`orochi browser open <sessionId> [url...]`
`orochi browser group <sessionId>`
`orochi browser focus <sessionId>`
`orochi browser close <sessionId>`
`orochi loop run <sessionId> <prompt>`   （session の engine で処理）
`orochi debug logs`                       （CRX の実行報告を読む）

### engine（ドメイン別設定）とは

各エンジンファイルは「そのドメインでどうpromptを投げ、答えを読むか」だけを持つ:

- `chatgpt.js`: `POST chatgpt.com/backend-api/conversation` をSSEで読む（HTTP直）
- `suno.js`: セッションのTab Group内のsuno.comタブへ content script を呼び、
  prompt入力→Createクリック→結果確認までをDOM操作で行う

新しいサービスの追加 = `crx/engines/<domain>.js` を1ファイル足し、`loop.js` の
`ENGINES` に登録するだけ。Session の `engine` 属性で選択される
（`orochi session open <url> suno` / MCP `session_open` の engine 引数）。

### MV3 実装メモ（実証済み）

- `chrome.tabGroups.*` は service worker では使えない → `chrome.tabs.group/ungroup` を使う
- setTimeout 連鎖は worker が kill されたら永遠に止まる → `chrome.alarms`（0.5分刻み）で起床
- service worker はページDOMに触れない → ドメイン固有操作は content script へ委譲
- CRX の実行結果は `/debug/log` へ報告（CLI `debug logs` で確認）

## Loop の状態遷移（1 Goalあたり）

```text
idle → running → collecting → operating → publishing → done
            ├─ blocked（停止）┐
            └─ maxSteps 到達 ─┘
```

- messages は Session ごとに保持（s1..s8）
- 各 step: prompt → engine → 解釈 → アクション（runtime/gh or DOM） → 結果を append
- 終了条件: Goal.done / maxSteps / blocked / 手動stop

## crx/loop.js インターフェース

```js
import { runGoal } from "./loop.js";

const result = await runGoal(session, prompt);
// => { engine, status, detail, text, gotText }
```

`sendPrompt(messages)` は `POST https://chatgpt.com/backend-api/conversation` を
SSE で読む。Cookie は拡張の fetch（host_permissions 付与）がそのまま送る。

> 実装注記: backend-api のペイロードはブラウザ実測で固める（モデル名・
> `conversation_mode`・`parent_message_id` 等は公式ではないため）。

## 安全性

- ChatGPT / Suno へ GitHub token 等の secret を送らない（指示には「操作はtoolで」とだけ書く）
- 特権操作は runtime(deno/gh) 経由。CRXは「指揮」のみ
- ループは常にデバッグ可能に（各 step の実行結果を /debug/log に保存）
- 自動で承認されない（優先: 承認制から始める）

## 非目標（1st pass）

- 高度なtool-call スキーマ（まず plain 指示 → 結果取得で良い）
- 永続DB
- multi-user