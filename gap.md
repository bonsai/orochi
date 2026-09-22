# Orochi 刷新案: Suno CRX を動くプロダクト境界にする

## 結論

Orochi は、Deno runtime と Chrome 拡張機能（CRX）を接続する POC まで到達している。刷新では機能を広げる前に、**Suno のログイン済みブラウザを一つの Goal で確実に操作し、結果を runtime に返す縦切り**を完成させる。

当面の完成条件は、次の手動シナリオを毎回再現できることである。

```text
OpenCode が skill を読み込む
  → Suno 用 Session を作成する
  → CRX が Suno の create ページを開く
  → ログイン状態を確認する
  → prompt を入力して生成を開始する
  → 生成状態を監視する
  → 結果の clip URL / clip ID / エラーを runtime に返す
  → OpenCode が結果を要約し、次の操作を提案する
```

ChatGPT の自律ループ、GitHub の書き込み操作、8 heads の完全実装は、この縦切りが安定してから再開する。

## 現状の到達点

現在は以下が動作する。

- Deno の SessionStore が `s1`〜`s8` を管理する。
- Session の状態を JSON snapshot に保存・復元する。
- CLI、HTTP API、MCP の一部が同じ runtime を参照する。
- CRX が GitHub URL を検出し、Tab Group を作成する。
- runtime の browser operation を CRX が polling して実行する。
- Suno 用 engine と content script の境界がある。
- API の cross-interface テストと型チェックが通る。

ただし、Suno は現状「content script が認証壁を検出できる」段階であり、音楽生成の開始、完了待ち、結果抽出、再実行、エラー回復までは完成していない。

## Gap 分析

| ID | 現状 | 目標 | 優先度 |
|---|---|---|---|
| G1 | Suno タブを見つけて message を送るだけ | Session に紐づく create タブを確実に管理する | P0 |
| G2 | 認証壁を文字列で検出する | `authenticated / auth-required / unknown` を構造化して返す | P0 |
| G3 | DOM セレクタが仮実装 | 入力、Generate、結果カードを検証付きで操作する | P0 |
| G4 | 送信後の待機がない | queued / generating / complete / failed を監視する | P0 |
| G5 | 結果 URL や clip ID がない | clip ID、URL、タイトル、状態を返す | P0 |
| G6 | timeout と retry が場当たり的 | bounded retry、timeout、cancel を共通化する | P0 |
| G7 | runtime に結果を返すだけ | Goal/Run/Result を snapshot に記録する | P1 |
| G8 | CRX のログが文字列 | run ID と構造化イベントで追跡する | P1 |
| G9 | engine の実行方法が CLI/MCP で不統一 | `suno_generate` の共通 API と MCP tool を提供する | P1 |
| G10 | MCP stdio の引数マッピングに不備がある | wire-level の initialize/list/call テストを通す | P0 |
| G11 | OpenCode からの手順がない | `.opencode/skills/suno-crx/SKILL.md` で再現可能にする | P0 |
| G12 | 実機確認が手動メモのみ | Chrome profile、前提条件、確認項目を固定する | P0 |
| G13 | GitHub 操作委譲が未実装 | Suno 完成後に read-only adapter を追加する | P2 |
| G14 | 自律 loop が未実装 | まず単一 Goal の状態機械として導入する | P1 |
| G15 | タスク分割の単位がない | Goal を Task DAG と Wave に分解する | P1 |
| G16 | 依存関係と成果物の受け渡しが暗黙的 | `dependsOn`、`outputs`、`doneWhen` を Task 契約にする | P1 |
| G17 | 並列実行時の競合制御がない | path、Session、Tab Group、snapshot を排他資源として扱う | P0 |
| G18 | Suno 同一タブを並列操作できてしまう | 1 Session 1 active run と idempotency key を導入する | P0 |
| G19 | Wave の完了条件がない | Barrier でテスト、成果物、レビューを検証する | P1 |
| G20 | OpenCode に計画・分割手順がない | planner / worker / integrator の実行手順を skill にする | P1 |

## 刷新後の境界

### CRX の責務

CRX は、ログイン済み Suno のブラウザセッションを操作する。CRX に GitHub token や OpenCode の秘密情報を保存しない。DOM の変化は content script が吸収し、background は session と run の調整だけを行う。

### runtime の責務

Deno runtime は、Session、Run、Result、command queue を所有する。CRX から受けたイベントを検証して保存する。runtime は Suno の DOM を直接操作しない。

### OpenCode skill の責務

OpenCode skill は、実行手順、前提条件、検証項目、失敗時の切り分けを定義する。skill は薄いオーケストレーターとし、DOM セレクタや Chrome API を重複実装しない。

### Parallel orchestration の責務

並列オーケストレーションは、Goal を Task DAG に分解し、依存のない Task を Wave 単位で dispatch する。コード作業はファイル境界が分かれていれば並列に進められるが、同じ Suno Session の DOM 操作は直列化する。Deno runtime が Task、Run、Result、Barrier の single writer になり、CRX は割り当てられた browser operation の実行面になる。

詳細な Task 契約、Lane、Wave、排他資源、Suno 優先の実行順は [parallel-orchestration.md](parallel-orchestration.md) に定義する。

## Suno Run の状態機械

```text
created
  → opening
  → auth-check
  → ready
  → submitting
  → generating
  → completed

opening / auth-check / submitting / generating
  ├─ retryable-error → retrying → 同じ状態
  ├─ auth-required   → blocked
  ├─ timeout         → failed
  └─ user-cancel     → cancelled
```

各遷移は `runId`、`sessionId`、時刻、source、detail を持つイベントとして記録する。`completed` では少なくとも `clipId` または `clipUrl` のどちらかを必須にする。

## P0 の完了条件

1. ログイン済みの実 Chrome profile で `suno.com/create` を開ける。
2. OpenCode skill の手順だけで Session 作成から実行確認まで進められる。
3. 認証済みの場合、prompt を一度送信できる。
4. 送信重複を防止できる。
5. 生成中を polling できる。
6. 完了時に clip URL または clip ID を runtime に保存できる。
7. ログアウト時は `blocked/auth-required` を返し、無限 retry しない。
8. timeout、タブ消失、content script 不在を区別できる。
9. CLI、MCP、CRX が同一 run の状態を参照できる。
10. 実機確認手順を別の開発者が再現できる。

## 実装順序

### Phase 0: 接続面の修復

MCP の JSON-RPC 引数マッピング、CLI の `resolve`、engine enum、BrowserOp の入力検証を先に直す。これにより、後続の Suno 実装をどの入口から実行しても同じ結果にできる。

### Phase 0.5: 並列実行の基盤

Goal を Task DAG に変換し、Wave ごとに ready Task を dispatch する型と runtime 内 scheduler を追加する。初期の並列数は3レーンに制限し、同一 Session の Suno DOM、同一ファイル、snapshot writer は排他制御する。詳細は [parallel-orchestration.md](parallel-orchestration.md) を参照する。

### Phase 1: Suno の単発生成

認証確認、create ページ準備、prompt 入力、Generate クリック、生成完了検出、結果抽出を実装する。DOM セレクタは一か所に集め、各操作後に状態を確認する。

### Phase 2: Run 管理と再現性

`runId`、状態機械、イベントログ、timeout、retry、cancel を追加する。runtime snapshot には現在の run と最後の result を保存する。

### Phase 3: OpenCode skill

`.opencode/skills/suno-crx/SKILL.md` を入口にして、OpenCode が前提条件を確認し、CLI または MCP を選び、結果を検証して報告できるようにする。

### Phase 4: その後の拡張

Suno の単発生成が安定した後に、ChatGPT loop、GitHub read-only adapter、複数 head の orchestration、Goal の自律 loop を追加する。

## 意図的に後回しにするもの

- GitHub Issue/PR への自動書き込み
- ChatGPT の非公開 backend API 依存を前提とした長時間自律 loop
- Voice / Smartphone 入力
- 全8 head の同時実行
- 複数ユーザー対応
- クラウド常駐 runtime

これらは価値がないのではなく、Suno CRX の成功経路と失敗回復を検証する前に入れると、原因の切り分けを難しくするため後回しにする。

## 受け入れテストの基本形

```text
Given: ログイン済みの Chrome profile と起動中の Orochi runtime
When: OpenCode が suno-crx skill の手順で prompt を実行する
Then: 1つの runId が生成される
And: Suno の create ページで prompt が送信される
And: runtime が generating を記録する
And: completed と clip URL/ID が返る
And: 同じ runId の重複送信がない
```

認証なし、タブ消失、timeout、content script 不在についても、成功とは別の明示的な受け入れテストを持つ。

## References

[1]: https://opencode.ai/docs/skills/ "OpenCode Agent Skills documentation"
[2]: https://github.com/bonsai/orochi "bonsai/orochi repository"
