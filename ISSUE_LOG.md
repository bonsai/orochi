# ISSUE_LOG

時順記録。新しいものを上に。作業の節目で 1 行以上追記する。

## 2026-09-26

- #54: 未処理 branch を main へ統合。PR #42（manus-engine, draft 解除）/ #39（runtime-orchestration-ports, types.ts 競合を main 側 `suno-poc` と両立）/ #47（suno-crx-poc-script, add/add を PR 側新版で解消）を squash merge。PR #38（差分 0）は close
- #54: 統合後の `origin/main` で `deno task check` / `deno task test` 通過（18 passed）。squash commit: `76a6100` / `ab9466e` / `5a22ef1`
- Suno CLI を orochi に吸収（`tools/suno/` = CLI + OpenSuno overlay + apply-overlay + README）→ PR #48
- 現行 suno.com 対応の overlay: `__session` Cookie の JWT、Turnstile 自前 render、captcha DEBUG 解除、Bun idleTimeout、拡張版番号の自動バンプ
- 生成の 422 を解消（`/api/generate/v2-web/` + web ヘッダ）。`Rain On Glass`（`c045685d-…`）が complete
- 診断エンドポイント追加（`/api/captcha_probe` `/api/__version` `/api/download_url`）
- 開発ループ自動化: build → 拡張自動 reload → suno タブ自動リフレッシュ
- mp3 DL が `Unauthorized` で未解決 → API 非依存の GUI 追従へ方針転換（#51）、実行基盤選定（#52）
- issue 起票: #49（422/ DL）、#50（正式経路化）、#51（GUI 追従）、#52（実行基盤）。#40 に進捗を集約
- HANDOVER.md / ISSUE_LOG.md を新設（opencode 等への引き継ぎ用）
- 主従を明文化: **計画=pi / 実装=opencode**（`AGENTS.md`）。未処理 branch 統合の計画を #54 として起票し、opencode に委譲する形にした
