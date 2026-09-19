# Orochi ChatGPT Loop Engine — コア設計

ログイン済みのChatGPTを**HTTPで無限に**回し、1 Goal を collect → operate → return で
通し切る。CRXがループドライバとなり、これはOrochiの**コア**である。

## なぜコアか

- ブラウザログイン中のChatGPTは、`chatgpt.com/backend-api` 経由ならAPI課金が掛からず
  **上限なく使える**（従量/クォータ枯渇の心配が無い）。
- これまでの「AI = Conductor」を、実コスト0で実行可能にするのがこの設計の土台。
  それが無いとオーケストレーションは絵に描いた餅。「無限に回るChatGPT」がエンジン。

## 構成

```text
crx/
├── loop.js        # ChatGPT Loop Engine（コアの実体）
├── background.js   # session / Tab Group / runtime 連携 + browser op 実行
├── popup.html|js   # session 一覧・ループの開始/停止
└── manifest.json   # host_permissions: chatgpt.com
```

runtime(deno) は状態（8 Session）と特権操作（gh）を握る。ループの指揮はCRXが持つ。
ループ中のGitHub操作は runtime の API へ委譲し、**secretをChatGPTへ渡さない**。

### Browser 操作は CLI / MCP からも可能

CLI / MCP は `/browser/commands` へ op を enqueue し、CRX が5秒間隔でポーリングして
実行する（Tab Group 作成・URL 追加・focus・ungroup）。

```text
cli / mcp
   │ POST /browser/commands {kind, sessionId, urls}
   ▼
runtime (queue)
   │ GET /browser/commands （CRX が drain）
   ▼
crx/background.js
   ▼
chrome.tabs / chrome.tabGroups
```

`orochi browser open <sessionId> [url...]`
`orochi browser group <sessionId>`
`orochi browser focus <sessionId>`
`orochi browser close <sessionId>`

## Loop の状態遷移（1 Goalあたり）

```text
idle → running → collecting → operating → publishing → done
            ├─ blocked（停止）┐
            └─ maxSteps 到達 ─┘
```

- messages は Session ごとに保持（s1..s8）
- 各 step: prompt → ChatGPT → 解釈 → アクション（runtime/gh or DOM） → 結果を append
- 終了条件: Goal.done / maxSteps / blocked / 手動stop

## crx/loop.js インターフェース（骨格）

```js
export class Loop {
  constructor({ sessionId, messages }) {}

  async step()            // 1 step 実行: ChatGPT から応答を取得・解釈
  async run({ maxSteps }) // done まで or maxSteps まで回す
  stop()                  // manual stop
}
```

`sendPrompt(messages)` は `POST https://chatgpt.com/backend-api/conversation` を
SSE で読む。Cookie は拡張の fetch（host_permissions 付与）がそのまま送る。

> 実装注記: backend-api のペイロードはブラウザ実測で固める（モデル名・
> `conversation_mode`・`parent_message_id` 等は公式ではないため）。

## 安全性

- ChatGPT へ GitHub token 等の secret を送らない（指示には「操作はtoolで」とだけ書く）
- 特権操作は runtime(deno/gh) 経由。CRXは「指揮」のみ
- ループは常にデバッグ可能に（各 step のログを session に保存）
- 自動で承認されない（優先: 承認制から始める）

## 非目標（1st pass）

- 高度なtool-call スキーマ（まず plain 指示 → 結果取得で良い）
- 永続DB
- multi-user