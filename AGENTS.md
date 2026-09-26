# AGENTS.md（この repo で作業するエージェント向け）

エージェント種別（Codex / Claude Code / OpenCode / pi 等）に依存しない共通ルール。

## 最初に読むもの

1. `README.md` — repo の責務
2. `HANDOVER.md` — 現在地と次の手
3. `ISSUE_LOG.md` — 末尾の直近ログ

この 3 つで足りないときだけ `doc/` やソースを読む。履歴は遡らない。

## 進め方

- 実体はこの repo に置く。外部ツリー（例: `C:\Users\dance\opensuno`）に直接変更を溜めない。
  外部ツリーへの変更は overlay として repo 側に持つ（例: `tools/suno/overlay/`）。
- 節目・終了時に `HANDOVER.md` を現在地へ更新し、`ISSUE_LOG.md` に 1 行追記する。
- 未検証のものは「暫定」と明記する。完了と言うには再現できる証拠を添える。
- 破壊的操作（停止・削除・上書き・再起動）は、対象・影響・代替案を 1 行で示して許可を取る。

## 主従（計画と実装の分離）

この repo は **計画=pi（主）/ 実装=opencode（従）** で進める。

| 役割 | 担当 | やること |
|---|---|---|
| 計画 | pi | 課題分解・issue 化（受入条件・検証方法・委譲先を明記）・最終判断 |
| 実装 | opencode | 割り当てられた 1 タスクのみを実装（1 タスク = 1 PR） |
| 検証 | pi または別エージェント | 実装者の自己申告で完了にしない。PR / テスト / 実機で確認 |

委譲の起動は `opencode run`、cwd は repo（`~/orochi`）。例:

```bash
cd ~/orochi && opencode run "issue #NN を実装して。受入条件は issue 本文、完了したら PR を出す"
```

- 破壊的変更・秘密・権限・公開は pi（最終は人間）の承認を要する。
- 計画は issue とこの `HANDOVER.md` に置く。口頭・チャットに残さない。
- 詳細な主従規約は `~/.skills/bonsai-delegate/SKILL.md`。

## Suno 関連

- 入口: `doc/suno-cli-mp3.md`（計画）, `tools/suno/README.md`（手順・overlay）
- 追跡: issue #40（進捗集約）, #49〜#52, PR #48
- 方針: 非公開 API を追わず、GUI の見た目に合わせて操作する（#51）
