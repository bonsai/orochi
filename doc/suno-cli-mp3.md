# Suno CLI: prompt → mp3 → ローカル再生（CRX 自動操作のみ）

企画メモ（実装前）。Manus 相談用の計画。実装はまだ無い。

## 目的（ゴールデンパス）

ターミナルから 1 コマンドで、Suno の曲を作って手元で聴けるところまで通す。

```text
orochi suno gen "calm rainy-night lofi"
  → 生成（既存のログイン済み Chrome を使う）
  → mp3 をローカル保存
  → mpv でそのまま再生
```

- 課金は **既存の Suno 契約のみ**。第三者 API（Tunova / RunAPI 等）は使わない。
- 認証は **ログイン済みブラウザ** に委ねる。鍵・Cookie を repo やプロンプトに置かない。
- 手段は **CRX（Chrome 拡張）による DOM 自動操作のみ**。CDP 越境はしない（ADR 系の既存方針）。

## 実装方式（確定）

自前の DOM 自動操作ではなく、**OpenSuno（paean-ai/opensuno, Chrome 拡張 + Bun bridge）を本体に使う**。
CLI ラッパと Suno 現行仕様への当て込みは `tools/suno/` に置く。

- 生成: `POST http://localhost:3001/api/custom_generate`（拡張が JWT と Turnstile を解決）
- 取得: `GET /api/get?ids=...` → `clips[].audio_url`
- DL/再生: `tools/suno/suno-gen.sh` → `$SUNO_OUT` → mpv

上流の素のままでは現行 suno.com で壊れる点（Clerk 非公開 / Turnstile 常設 widget 無し /
captcha スキップの DEBUG / Bun idleTimeout / 版番号）は `tools/suno/README.md` に列挙。

## なぜ CRX か（Tunova との対比）

Tunova は自社サーバから Suno の内部 API を Cookie 付きで叩き、`POST /api/generate` → `GET /api/jobs/{id}` → `clips[].audio_url` を返す。同じ形を自前でやる方法は 2 つある。

| 方式 | 認証 | 壊れやすさ | 本計画 |
|---|---|---|---|
| 内部 API 直叩き（Tunova 方式） | セッション Cookie/JWT の抽出が必要 | 非公開 API 仕様の変更で即死。Cookie 抽出も面倒 | 補助経路として検討 |
| CRX で公式 UI を操作 | ログイン済みタブそのもの | セレクタ変更に弱いが、API 仕様の変更には比較的強い | **主経路** |

CRX 版の弱点は「DOM セレクタが変わる」「生成完了の検出が UI 依存」の 2 点。これは既存の `gap.md` / `refresh-roadmap.md`（Milestone S1）で扱っている論点と同じ。

## アーキテクチャ（既存資産への載せ方）

```text
CLI (deno/cli.ts)  suno gen "<prompt>"
  → runtime HTTP  (/suno/generate)  … Run を記録
  → CRX background が command を poll（既存 /browser/commands 経路）
  → content script (crx/suno-content.js) が suno.com/create を DOM 操作
       ├─ create ページ readiness
       ├─ prompt 入力（native setter + input event）
       ├─ Create / Generate クリック（重複防止）
       ├─ 生成中インジケータを polling
       └─ 完了カードから clipId / title / audioUrl を抽出
  → 完了イベントを runtime に返す
  → runtime が mp3 を SUNO_OUT に DL
  → mpv で再生（--no-video）
```

- 既存: `crx/engines/suno.js`（engine 境界）、`crx/suno-content.js`（content script 雛形）、`deno/cli.ts`（`loop run` 等）、`.opencode/skills/suno-crx/SKILL.md`。
- 追加が要るのは主に **完了カードからの抽出**、**mp3 DL**、**再生**、**CLI サブコマンド**。

## 実装ステップ（1 曲が通るまで）

| # | 内容 | 既存 issue |
|---|---|---|
| 1 | Suno タブと Session の紐付け、auth 状態の構造化（authenticated / auth-required / unknown） | S1-01, S1-02 |
| 2 | create ページ readiness、prompt 入力、Generate クリック（重複送信防止） | S1-03, S1-04, P0-04 |
| 3 | 生成状態 polling（queued / generating / complete / failed） | S1-05 |
| 4 | 完了カードから clipId / title / audioUrl を抽出 | S1-06 |
| 5 | **mp3 を SUNO_OUT に DL**（新規） | — |
| 6 | **mpv で再生**（新規。WSLg 音声） | — |
| 7 | CLI `suno gen` サブコマンド + 手動 acceptance 手順 | S3-02 |

1〜4 は既存 issue でカバー済み。本件は 5〜7 と、それらを 1 本の CLI に束ねる所が新規。

## 未解決（Manus に相談したい点）

1. **音声の取り方**: 完了カードの `<audio src>` を読むか、`clipId` から `cdn1.suno.ai/<clipId>.mp3` を直に組むか、ページ内 `fetch` で download エンドポイントを叩くか。どれが最も安定するか。
2. **mp3 の公開性**: cdn1 の URL が Cookie 無しで落ちるか（DL を runtime 側でやる前提が成立するか）。
3. **プラン制約**: 無料/有料プランでの DL 制限・透かし・同時生成数。レート制限とアカウントリスク。
4. **DOM か API か**: ハイブリッド（入力/生成は UI、URL 解決だけ内部 API）を許容するか。それとも CRX 一本に拘るか。
5. **MEGA 同期**: `MEGAsync` は Windows 側にあり、WSL から同期フォルダが見えない。`SUNO_OUT` をどう MEGA に寄せるか（手動移動 / rclone / megacmd 導入）。

## 受け入れテスト（基本形）

```text
Given: ログイン済みの Chrome profile と起動中の Orochi runtime
When:  `orochi suno gen "<prompt>"`
Then:  1 つの runId が記録される
And:   suno.com/create で prompt が 1 回だけ送信される
And:   generating → completed が記録される
And:   mp3 が SUNO_OUT に存在し、mpv で再生される
```

失敗経路も成功と別にテストする: `auth-required` / `timeout` / `tab-closed` / `selector-failed`。同じ runId の重複送信が無いこと。

## リスク

- Suno の DOM は頻繁に変わる。セレクタは 1 箇所（`crx/suno-content.js` or 専用 adapter）に集約し、変更時にそこだけ直す。
- 生成完了の判定が UI 依存。取りこぼすと「無限 waiting」になるため、bounded timeout を必ず入れる。
- 自動操作は Suno の規約・レート制限の影響を受ける。連続大量生成は避け、1 曲単位で確認する。

## 参照

- `gap.md` — Suno CRX 全体の Gap 分析
- `doc/refresh-roadmap.md` — Milestone S1/S2/S3
- `crx/suno-content.js`, `crx/engines/suno.js`, `deno/cli.ts`
- `.opencode/skills/suno-crx/SKILL.md` — 実行手順と失敗分類
