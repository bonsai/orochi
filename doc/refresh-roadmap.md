# Orochi Refresh Roadmap

## 方針

このロードマップは `gap.md` の Gap を、短い実装単位へ分解したものである。最初の milestone は **Suno CRX で一回の生成を最後まで完了すること**とする。各 Issue は一つの検証可能な結果を持ち、実装とテストを同じ変更単位に含める。

## Milestone S0: 実行面を安定させる

- MCP の JSON-RPC arguments を各 tool の引数へ正しく変換する。
- `resolve` CLI の引数解析を修正する。
- engine、BrowserOp、URL、prompt の runtime validation を追加する。
- `/browser/commands` の enqueue と drain を run ID 付きで追跡する。
- stdio MCP の initialize、tools/list、tools/call を wire-level でテストする。

## Milestone S1: Suno single-run

- Suno tab の発見と session への関連付けを明示化する。
- content script に auth check を追加する。
- Suno create ページの readiness check を追加する。
- prompt 入力操作を一つの adapter に閉じ込める。
- Generate 操作の重複送信を防止する。
- 生成中の状態を検出する。
- 完了カードから clip ID と URL を抽出する。
- selector failure、auth wall、tab closed を別エラーにする。

## Milestone S2: Run lifecycle

- `runId` と SunoRun 型を導入する。
- state transition を allowlist 化する。
- timeout と bounded retry を追加する。
- cancel 操作を追加する。
- runtime に event log と last result を保存する。
- CRX、CLI、MCP から同じ run 状態を参照する。

## Milestone S3: OpenCode workflow

- `.opencode/skills/suno-crx/SKILL.md` を追加する。
- skill の前提確認と実行コマンドを固定する。
- 成功、認証要求、timeout、失敗の報告形式を固定する。
- 実 Chrome profile を使う manual acceptance test を追加する。
- セレクタ変更時に修正箇所を一か所で追えるようにする。

## Milestone S4: 次の拡張

- GitHub read-only adapter を追加する。
- ChatGPT engine の認証済み一往復を安定化する。
- Goal を状態機械として導入する。
- 複数 head の orchestration を追加する。
- 書き込み操作は read-only adapter の安定後に別 milestone とする。

## Definition of Done

各 Issue は、コード変更だけでなく、少なくとも一つの自動テストまたは再現可能な実機確認手順を含む場合に完了とする。Suno CRX の P0 Issue は、ログイン済み・未ログイン・timeout・タブ消失の各経路を区別できることを完了条件にする。

## Issue 一覧

GitHub Issue は依存関係が分かるよう、次の順で作成する。

1. S0-01 MCP arguments mapping
2. S0-02 CLI resolve parsing
3. S0-03 runtime input validation
4. S0-04 wire-level MCP tests
5. S1-01 Suno tab/session binding
6. S1-02 auth state protocol
7. S1-03 create page readiness
8. S1-04 prompt and Generate adapter
9. S1-05 generation state polling
10. S1-06 clip result extraction
11. S1-07 Suno error taxonomy
12. S2-01 run lifecycle model
13. S2-02 timeout/retry/cancel
14. S2-03 persisted run events
15. S2-04 shared run status API/MCP
16. S3-01 OpenCode skill
17. S3-02 manual acceptance script
18. S3-03 selector diagnostics
19. S4-01 GitHub read-only adapter
20. S4-02 ChatGPT single-turn hardening

## References

[1]: ../gap.md "Orochi 刷新案: Suno CRX を動くプロダクト境界にする"
[2]: https://opencode.ai/docs/skills/ "OpenCode Agent Skills documentation"
