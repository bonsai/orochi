# HANDOVER（現在地）

このファイルと `ISSUE_LOG.md` の末尾だけ読めば開発を再開できる状態を保つ。

## 責務

Orochi = ブラウザを実行基盤にした AI Project Orchestra。CRX / CLI / MCP / Deno runtime。
詳細は `README.md`、設計は `doc/`。

## 現在地（2026-09-26）

**Suno CLI（prompt → 生成 → mp3 → ローカル再生）を実装中。生成までは通った。DL が残ブロッカー。**

- 方式: 自前 DOM 自動操作ではなく **OpenSuno**（Chrome 拡張 + Bun bridge）を本体に使う
- 実体: `~/repo/suno-gen/bridge/`（overlay の正）。orochi は**起動と記録のみ**を持つ（疎結合）
- 進捗の一次情報: **issue #40 の最新コメント**、`~/repo/suno-gen/bridge/README.md`

| 段階 | 状態 |
|---|---|
| 認証（`__session` Cookie の JWT） | OK |
| captcha（Cloudflare Turnstile を自前 render/execute） | OK |
| 生成（`POST /api/generate/v2-web/`、web ヘッダ） | **OK**（`Rain On Glass` / `c045685d-…`） |
| 曲URL・画像URLの取得 | OK（`suno.com/song/<id>`, `cdn2.suno.ai/image_*`） |
| mp3 取得（`/api/download/clip/{id}?format=mp3`） | **NG**（`not_authorized` / `Unauthorized`） |
| mp3 → mpv 再生 | 未到達（上記待ち） |

## 次の手

1. #52 実行基盤の選定（CRX / WSLg Playwright / CDP / UiPath 等）— 特に「DL が成立する方式」
2. #51 API 非依存の GUI 追従（見えている要素だけ操作、DL は UI 操作で）
3. #50 tools/suno の正式経路化（OpenSuno の fork/submodule、CLI 統合）

## 委譲（計画 = pi / 実装 = opencode）

上の「次の手」は pi が計画し、**opencode に委譲して実装**する。pi は実装を持たず、検証と承認を行う。

```bash
cd ~/orochi && opencode run "issue #NN を実装。受入条件は issue 本文。完了したら PR"
```

未処理の branch 統合（#54）は **完了**（2026-09-26）:

| branch | 処理 | 結果 |
|---|---|---|
| `feat/manus-engine` (PR #42) | draft 解除 → squash merge | `76a6100` |
| `feat/runtime-orchestration-ports-…` (PR #39) | main を取り込み `deno/core/types.ts` の競合を解消（`suno-poc` + Run 型を両立）→ check/test 通過 → squash merge | `ab9466e` |
| `feat/suno-crx-poc-script` (PR #47) | add/add 競合を PR 側の新版で解消 → squash merge | `5a22ef1` |
| `jules-read-issues-…` (PR #38) | main との差分 0 のため close | close 済 |

統合後の `origin/main` で `deno task check` / `deno task test` 通過（18 passed）。

## 環境（前提）

- OpenSuno ツリー: `C:\Users\dance\opensuno`（git 管理外。変更は overlay として本 repo が持つ）
- 拡張: `extension/dist` を Chrome に Load unpacked（現在 1.0.x）
- bridge: WSL で `cd /mnt/c/Users/dance/opensuno && bun run src/bridge/server.ts`（:3001）
- Windows Chrome から `ws://localhost:3001/ws` に接続。suno.com にログイン済みであること
- WSL: bun / python3 / mpv / ffmpeg

## 再現・検証コマンド

```bash
~/repo/suno-gen/bridge/apply-overlay.sh "${OPENSUNO_DIR:-/mnt/c/Users/dance/opensuno}"
cd /mnt/c/Users/dance/opensuno && bun run ext:build      # 版番号は自動 +1
# → 拡張は /api/__version を見て自動 reload、suno タブも自動リフレッシュ

curl -sS localhost:3001/api/status          # 拡張接続
curl -sS localhost:3001/api/captcha_probe   # Turnstile 単体
curl -sS localhost:3001/api/__version       # ビルド版
~/repo/suno-gen/scripts/apply_via_bridge.py prompts/<spec>.json --send
```

## つまずきどころ

- bridge 再起動/拡張更新後は **suno.com タブの完全リロード**が必要（`Extension context invalidated`）
- 生成エンドポイントは `/api/generate/v2-web/`（旧 `/api/generate/v2/` ではない）。`v2-web` に
  Android クライアントヘッダを付けると captcha 検証が通らない
- `/api/download/clip` は認可で弾かれる（現時点の最大の壁）
- `[Suno Bridge]` のコンソールは貼り付けで改行が混入しやすい。上の診断エンドポイントを使う

## opencode への引き継ぎ

`AGENTS.md` / `HANDOVER.md` / `ISSUE_LOG.md` を repo 直下に置いた。opencode（OpenCode）は
repo の `AGENTS.md` と `.opencode/skills/` を読むため、これらだけで再開できる。

## 関連

- `doc/suno-cli-mp3.md`（計画）
- `~/repo/suno-gen/bridge/README.md`（手順・overlay 内容）
- `.opencode/skills/suno-crx/SKILL.md`（既存の Suno CRX 手順）
- ADR: `~/wiki/projects/adr/`
