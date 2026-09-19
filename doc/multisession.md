# Orochi マルチセッション設計（8並列）

> 取り決め 2026-09-20: CLI でも CRX でも複数セッションを並列処理できる。上限は **8 スロット**。

## 概念

**Session** は Core が保持する Project の作業文脈（`s1`〜`s8` の8スロット上限）。

```text
           CLI / CRX / MCP / SDK
                    │
      同じ local runtime (127.0.0.1:8787)
                    │
             SessionStore (max 8)
                    │
          Project / State / Resources
                    │
               Tab Group (CRX)
```

- **1 Session = 1 browser context**（CRX 上は Tab Group 1つ）
- CLI-only セッションに Tab Group は必須ではない
- 8満杯時: open はエラー + active 一覧を返す。evict は後回し
- runtime 再起動時は JSON スナップショットから復元

## 原則

- **local runtime が唯一の8スロット所有者**
- CLI / CRX / MCP / SDK は全て API クライアント（gh 方式）
- どの界面からでも同じセッションを操作できる（Cross-interface Consistency）

## 永続

- パス: `$HOME/.orochi/sessions.json`（環境変数で上書き可）
- 起動時 load / 変更時 save
- メタデータ: version / sessions / 割当 slot

## Core 型（追加）

```ts
type SessionId = string;            // "s1".."s8"

type SessionStatus = "active" | "idle";

type Session = {
  id: SessionId;
  project: Project;
  status: SessionStatus;
  tabGroupId?: number;              // CRX の Tab Group と1:1
  createdAt: number;
  lastActiveAt: number;
};

type SessionSnapshot = {
  version: 1;
  sessions: Session[];
};
```

## ファイル別の変更

### deno/core/
| ファイル | 変更 |
|---|---|
| `types.ts` | `Session` / `SessionId` / `SessionStatus` を追加 |
| `store.ts`（新規） | `SessionStore`（cap 8）。create/update/get/list/close/save/load。空き slot 割当 |
| `mod.ts` | `store.ts` を export |
| `project.ts` | 変更なし（resolveProject を session 生成時に再利用） |

### deno/api.ts（runtime）
- 起動時 `SessionStore.load()`
- `--allow-env=HOME --allow-read --allow-write`
- エンドポイント追加
  - `GET /sessions`
  - `POST /sessions {url}`
  - `GET /sessions/:id`
  - `DELETE /sessions/:id`
  - `POST /sessions/:id/browser {tabGroupId}`
- `/resolve` `/health` は既存維持

### deno/cli.ts（API クライアント化）
```text
orochi resolve <url>              # API 経由に変更
orochi session open <url>         # → POST /sessions
orochi session ls                 # slot/project/state/tabGroupId 一覧
orochi session close <id>
orochi session focus <id>         # → browser 報告
```
- `--allow-net` / `--port` オプション（既定 8787）
- gh 方式: CLI 自体はセッションを持たず、常に runtime に聞く

### deno/mcp.ts
- tools: `session_open` / `session_list` / `session_close` / `session_focus`（全て API 経由）。`resolve_project` は維持

### crx/
- `background.js`: active tab が GitHub repo URL → `POST /sessions`（既存があれば再利用）→ `chrome.tabGroups` で Project 名の Tab Group 生成/更新 → `tabGroupId` を runtime へ報告
- `popup.html|js`（新規）: 最大8セッションの一覧 + open/close/focus
- manifest: `popup` 追加。permissions は `tabs`/`tabGroups`/`storage` で充足

## doc/ 追記対象

- `orochi-design.md`: Session と8スロット並列を追記
- `orochi-concept.md`: 「1 Session = 1 browser context、最大8並列」
- `POC.md`: Session store / snapshot を実装済みへ
- `onboarding.md`: `deno task dev` → `orochi session open` の手順
- `dev.md` / `prd.md` / `ux.md` / `kpi.md`: 並列セッションの UX・KPI（同時セッション数 ≤8、snapshot 復元）

## 検証

1. `deno task check`
2. 再起動で snapshot 復元確認
3. CLI から同一操作で同一結果（Cross-interface Consistency）
4. CRX 実測: `chrome-install.sh new <path to crx>` で Load unpacked → Tab Group 生成を確認

## 完了条件

- `session open` ×2〜3 を並列に持てる
- CRX / CLI / MCP が同じ Session を操作できる
- runtime 再起動後も session が復元される
- 8満杯時はエラー + active 一覧
- CRX に credential を保存しない