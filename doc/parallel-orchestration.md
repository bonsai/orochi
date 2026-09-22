# Orochi 並列オーケストレーション計画

## 目的

Orochi の並列性を、単に8つのブラウザタブを同時に開く機能として扱わない。ユーザーの大きな依頼を、独立して進められる小さな Task へ分解し、依存関係を DAG（有向非巡回グラフ）として管理する。依存のない Task は同じ Wave で並列に実行し、成果物を Barrier で検証してから次の Wave に進む。

この設計は、herdr の作業台・並列セッションの考え方と、takt の計画・実装・レビュー・修正の流れを、Orochi の Session、Tab Group、CRX、runtime に対応付けるものである。

## 重要な区別

**コードを並列に作ること**と、**同じブラウザセッションを並列に操作すること**は別である。複数の実装 Task は独立ファイルなら並列に進められる。一方、同じ Suno tab の DOM 操作は競合するため、1 Session 内では必ず直列化する。

| 対象 | 並列可否 | 制御方法 |
|---|---|---|
| 独立した実装ファイル | 可能 | Task の `paths` と lock を分離する |
| 独立したテスト | 可能 | runtime fixture と profile を分離する |
| 同一 Session の Suno DOM | 不可 | session mutex、1 active run |
| 別 Session の Suno run | 条件付きで可能 | Session ごとに Tab Group と run を分離する |
| runtime snapshot の書き込み | 不可 | runtime が single writer になる |
| 結果のレビュー | 可能 | 各 Task 完了後または Wave 終了時に実行する |

## 実行モデル

```text
User Goal
   ↓
Planner: Goal → Task DAG
   ↓
Wave 0: plan validation
   ↓
Wave 1: independent tasks ──┬── worker A: CRX
                             ├── worker B: runtime
                             └── worker C: tests/docs
   ↓ Barrier: outputs + tests + conflicts
Wave 2: integration task
   ↓ Barrier: acceptance evidence
Wave 3: review/fix
   ↓
Return: result + artifacts + unresolved tasks
```

Planner は Task を作るだけで実装を直接抱え込まない。Worker は割り当てられた Task とファイル境界だけを扱う。Integrator は複数 Worker の成果を runtime と受け入れテストへ統合する。

## Task 契約

各 Task は、少なくとも次の形式を持つ。自然言語だけの依頼は実行前にこの形式へ変換する。

```json
{
  "id": "s1-auth-state",
  "goal": "Suno の認証状態を構造化して返す",
  "lane": "crx",
  "sessionId": "s1",
  "dependsOn": ["s0-input-validation"],
  "paths": ["crx/suno-content.js", "crx/engines/suno.js"],
  "exclusive": ["session:s1", "file:crx/suno-content.js"],
  "inputs": ["Suno create page", "current auth selectors"],
  "outputs": ["AuthStatus", "tests or manual evidence"],
  "doneWhen": ["auth-required is distinguished from unknown"],
  "failurePolicy": "block-dependent",
  "status": "ready"
}
```

### 契約上のルール

- `dependsOn` にない Task の出力を暗黙に参照しない。
- `paths` が重なる Task は同じ Wave で実行しない。例外は同じ worker に束ねる。
- `exclusive` が同じ Task は同時に実行しない。
- 完了は「コードを書いた」ではなく、`doneWhen` と検証証拠を満たした状態とする。
- 失敗時は `retryable`、`blocked`、`failed` を区別する。
- blocked の Task に依存する Task は自動開始しない。

## Lane

| Lane | 主な責務 | Suno 優先期間の役割 |
|---|---|---|
| `planner` | Goal を DAG と Wave に分解する | 実機操作を含めた最小縦切りを選ぶ |
| `crx` | content script、background、DOM adapter | Suno の認証、入力、生成状態、結果抽出 |
| `runtime` | Deno API、Session、Run、snapshot | runId、event、status、検証 |
| `test` | unit、integration、manual acceptance | fake DOM と実 Chrome の証拠 |
| `review` | 差分、競合、セキュリティ、完了条件 | secret 漏洩と二重送信を検査 |
| `integrator` | Wave の成果を統合する | CRX/runtime の縦切りを接続する |

## Suno を動かすための Wave 計画

### Wave 0: 計画と接続面

この Wave は直列である。MCP 引数、CLI resolve、runtime validation、wire-level test のどれかが壊れていると、後続の結果を正しく観測できない。

- `s0-input-validation`: engine、BrowserOp、prompt、URL を検証する。
- `s0-cli-mcp`: CLI と MCP の引数境界を修正する。
- `s0-wire-test`: API/MCP の実通信をテストする。
- `s0-plan-review`: Task DAG とファイル競合を検証する。

### Wave 1: Suno の独立アダプタ

Wave 0 完了後、ファイル境界を分けて次を並列に進める。

| Task | Lane | 主な出力 | 依存 |
|---|---|---|---|
| `s1-tab-binding` | crx | session と Suno tab の紐付け | Wave 0 |
| `s1-auth-state` | crx | auth status protocol | Wave 0 |
| `s1-readiness` | crx | create page readiness check | Wave 0 |
| `s1-run-types` | runtime | SunoRun、RunEvent の型 | Wave 0 |
| `s1-fixtures` | test | DOM fixture と selector test harness | Wave 0 |

`crx/suno-content.js` を複数 Task が変更する場合は、`s1-auth-state` と `s1-readiness` を同じ worker に束ねるか、adapter ファイルを先に分割する。

### Wave 2: 送信から結果まで

Wave 1 の adapter と型を統合してから、次を進める。

- `s2-submit`: prompt 入力と Generate の一回送信。
- `s2-poll`: queued/generating/complete/failed の polling。
- `s2-result`: clip ID、URL、タイトルの抽出。
- `s2-diagnostics`: selector failure、tab closed、auth wall の分類。
- `s2-failure-tests`: timeout、認証なし、二重送信のテスト。

`s2-submit` と `s2-poll` は同じ session mutex を共有するため、コードは並列にレビューできても、実機操作は直列にする。

### Wave 3: runtime 統合

- `s3-run-api`: run 作成、取得、cancel API。
- `s3-event-store`: event と last result の snapshot 保存。
- `s3-crx-report`: CRX から runtime へ構造化 event を返す。
- `s3-mcp-status`: MCP から同じ run を読む。

### Wave 4: OpenCode 実機受け入れ

ここは複数の実機操作を同じ Chrome profile で同時に実行しない。

1. OpenCode skill の preflight。
2. Suno session の作成。
3. create page の readiness。
4. 一つの prompt の送信。
5. generating の観測。
6. completed と clip URL/ID の確認。
7. auth-required、timeout、tab-closed の失敗経路を個別に確認。

## Scheduler の動作

Scheduler は次の順序で動く。

1. Goal を受け取る。
2. Planner が Task DAG を生成する。
3. schema、依存、path conflict、exclusive resource を検証する。
4. indegree が0の Task を ready queue に入れる。
5. concurrency cap 内で、競合しない Task を dispatch する。
6. Worker の result、event、artifact、test evidence を受け取る。
7. 成功した Task の依存を解消し、次の Task を ready にする。
8. Wave の Barrier で integration test と review を通す。
9. failed は retry policy に従い、blocked は依存先へ伝播する。
10. 全終端 Task と unresolved Task をまとめて返す。

初期の実装では、scheduler 自体を CRX に置かない。Deno runtime を single writer とし、CRX は割り当てられた browser operation を実行する projection とする。

## 並列数と安全策

- 論理 Session の上限は既存どおり8。
- 初期の実装 Worker 数は3を上限にする。CRX、runtime、test の三レーンから始める。
- 1 Session につき active Suno run は1件だけにする。
- runtime snapshot は一つの writer が順序付ける。
- 同一ファイル、同一 Tab Group、同一 run を排他的リソースとして扱う。
- browser command は idempotency key を持ち、再送で Generate が二重実行されないようにする。
- Task prompt に secret を埋め込まない。

## 返却形式

```text
Goal: <goal>
Plan: <task count> tasks / <wave count> waves
Completed: <task ids>
Running: <task ids>
Blocked: <task ids and dependency>
Failed: <task ids and reason>
Evidence: <tests, logs, clip URL/ID>
Next: <one concrete action>
```

## 実装の段階

最初は scheduler を完全な汎用エージェント基盤にしない。次の順で導入する。

1. 静的な `Task` / `Wave` / `Barrier` 型を追加する。
2. runtime 内で DAG の ready 判定と依存解消を実装する。
3. CRX 操作に session mutex と idempotency key を追加する。
4. CLI/MCP から plan、dispatch、status を参照できるようにする。
5. OpenCode skill から Suno single-run plan を作成できるようにする。
6. 実績が蓄積してから動的な planner と8 Session 並列を拡張する。

## References

[1]: ../gap.md "Orochi 刷新案: Suno CRX を動くプロダクト境界にする"
[2]: https://github.com/bonsai/orochi/blob/main/doc/orochi-concept.md "Orochi 再定義"
[3]: https://opencode.ai/docs/skills/ "OpenCode Agent Skills documentation"
