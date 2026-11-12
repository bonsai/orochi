# tools/muse-crx — muse-crx CLI（controller 側）

Chrome 拡張 **muse-crx**（正本は bonsai/muse-crx repo：拡張本体＋bridge＋プロトコル）を
ターミナルから操作する CLI。orochi 側は契約（WebSocket プロトコル）だけを共有し、
拡張のコードは import しない。

## 前提

1. bridge が動いている（muse-crx repo の `bridge/bridge.py`、既定 127.0.0.1:8765）
2. Chrome に muse-crx 拡張が入っていて bridge に接続済み
3. 拡張は **承認のみ（approval-only）**：コマンドはユーザーが拡張ポップアップで
   承認するまで実行されない。この CLI は承認・却下・タイムアウトまで待つ

## 使い方

```bash
# タブ一覧
deno run --allow-net --allow-env tools/muse-crx/muse-crx.ts tabs

# 指定タブで JS 評価（Runtime.evaluate, returnByValue）
deno run --allow-net --allow-env tools/muse-crx/muse-crx.ts eval 123456 "document.title"

# 任意の CDP メソッド
deno run --allow-net --allow-env tools/muse-crx/muse-crx.ts send Page.captureScreenshot '{}' --tab 123456 --summary "スクリーンショットを撮る"
```

環境変数：`MUSE_CRX_BRIDGE`（既定 `ws://127.0.0.1:8765/ctl`）、
`MUSE_CRX_TIMEOUT`（結果待ち秒数、既定 300）。

終了コード：0=成功、1=コマンドエラー／ユーザー却下、2=使い方／接続／タイムアウト。

## 状態

v0.1（2026-11-12、Muse が直接実装）。bridge＋疑似 ext でのプロトコル疎通は検証済み。
実機 Chrome＋拡張での承認フロー確認は未実施（暫定）。
