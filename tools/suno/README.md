# tools/suno — CLI から Suno 曲生成 → mp3 ダウンロード → ローカル再生

OpenSuno（paean-ai/opensuno, Chrome 拡張 + Bun bridge）を本体に使い、CLI ラッパで
「プロンプト → 生成 → mp3 → mpv 再生」まで通す。Orochi 側は当面このラッパと当て込みを所有する。

関連: `doc/suno-cli-mp3.md`, issue #40, issue #41

## 構成

| 何 | どこ |
|---|---|
| OpenSuno 本体（未改変・取り込み済みツリー） | `C:\Users\dance\opensuno`（Windows） |
| 本リポジトリが持つ当て込み | `tools/suno/overlay/` |
| CLI ラッパ | `tools/suno/suno-gen.sh` |
| 当て込みスクリプト | `tools/suno/apply-overlay.sh` |

OpenSuno 自体は git clone ではないため、**変更点は overlay として本リポジトリに保存**する。
（上流追従時は overlay を当て直す。）

## 前提

- Chrome（Windows）に OpenSuno 拡張を Load unpacked: `C:\Users\dance\opensuno\extension\dist`
- suno.com にログイン済み（Clerk の `__session` Cookie が発行されていること）
- WSL に Bun・Python3・mpv
- bridge は WSL で起動し、Windows Chrome から `ws://localhost:3001/ws` に接続させる

## 手順

```bash
# 0) 当て込み（初回 / 上流追従後）
tools/suno/apply-overlay.sh /mnt/c/Users/dance/opensuno

# 1) 拡張をビルド（版番号は自動で patch +1）
cd /mnt/c/Users/dance/opensuno && bun run ext:build
# 2) Chrome: chrome://extensions → OpenSuno Bridge 更新 → suno.com タブを Ctrl+Shift+R

# 3) bridge 起動（WSL）
cd /mnt/c/Users/dance/opensuno && bun run src/bridge/server.ts

# 4) 生成 → DL → 再生
tools/suno/suno-gen.sh "warm lofi piano with rain, calm night" "lofi, rain, calm" "Rain On Glass"
```

出力: `$SUNO_OUT`（既定 `~/MEGA/suno-gen/audio/`）に `<title>-<clip8>.mp3`。

## overlay が直すもの（上流の素のままだと壊れる点）

現行の suno.com に合わせるための最小修正。

1. **認証トークン**（`extension/src/page-script.ts`）
   現行 suno.com は `window.Clerk` を公開しない。`__session` Cookie から JWT を読む。
2. **生成 captcha**（`extension/src/page-script.ts`）
   生成は Cloudflare Turnstile（sitekey は Suno バンドル埋め込み: 生成用 `0x4AAAAAADI7xDNyj-3LcIbi`）。
   ページに常設 widget が無いので、同 sitekey / `execution:"execute"` / `appearance:"interaction-only"`
   で自前 render して execute する。`window.turnstile` は遅延ロードなので、無ければ待つ/自分で読む込む。
   コンテナは `display:none` 不可（オフスクリーンでも実サイズが必要）。
3. **captcha スキップの解除**（`src/bridge/api-handler.ts`）
   `checkCaptcha` に `return false; // DEBUG` が入っていたのを削除（入っていると必ず 422
   token_validation_failed になる）。
4. **Bun の idleTimeout**（`src/bridge/server.ts`）
   既定 10s だとトークン取得等で空応答になるため `idleTimeout: 120` を追加。
5. **拡張の版番号自動バンプ**（`extension/build.ts`）
   `bun run ext:build` のたび patch を +1（Chrome の更新検知を確実にする）。

## 既知の未解決

- 生成 `422 token_validation_failed` が出る場合は captcha トークン未取得。
  suno.com タブのコンソールで `[Suno Bridge] Turnstile` 行を確認する。
- bridge 再起動後は、拡張の再読込だけでなく **suno.com タブの完全リロード**が必要
  （`Extension context invalidated` はこれ）。
- `--remote-debugging-port` を使う CDP 方式は未採用（現行方針は拡張 bridge）。
