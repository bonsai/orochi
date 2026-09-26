# tools/suno — 移設済み（正は suno-gen）

Suno の overlay と CLI は **[bonsai/suno-gen](https://github.com/bonsai/suno-gen) に一本化**した。
このディレクトリは**ポインタのみ**（実体は持たない）。

## 正の所在

| 何 | どこ |
|---|---|
| OpenSuno への当て込み（overlay の正） | `~/repo/suno-gen/bridge/overlay/` |
| 当て込みスクリプト | `~/repo/suno-gen/bridge/apply-overlay.sh` |
| 生成 CLI / ラッパ | `~/repo/suno-gen/scripts/` ・ `~/repo/suno-gen/skills/suno-studio/` |
| 手順・既知の壁 | `~/repo/suno-gen/bridge/README.md` ・ `~/repo/suno-gen/docs/ARCHITECTURE.md` |
| 曲・アルバム・台帳 | `~/repo/suno-gen/`（`prompts/` `albums/`） |

## OpenSuno 本体

`C:\Users\dance\opensuno`（**git repo ではない**）。変更は overlay として
suno-gen 側に持ち、上流追従時に当て直す。

```bash
# 当て込み（初回 / 上流追従の後）
~/repo/suno-gen/bridge/apply-overlay.sh /mnt/c/Users/dance/opensuno
cd /mnt/c/Users/dance/opensuno && bun run ext:build
```

## orochi の役割

orochi は **OpenSuno を起動する環境と、判断・進捗のログ**を持つ。
overlay の実体は持たない（suno-gen を参照する）。

- 起動: `cd /mnt/c/Users/dance/opensuno && bun run src/bridge/server.ts`
- 進捗: issue #40 の最新コメント

## 移設の経緯

- 以前は `orochi/tools/suno/` が overlay を所有していた。
- overlay が orochi と suno-gen の二重になっていたため、**suno-gen を正**として一本化。
- suno-gen/bridge/overlay は `C:\Users\dance\opensuno` と**完全一致**を確認済み（2026-09-26）。
