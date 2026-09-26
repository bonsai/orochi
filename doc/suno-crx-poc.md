# Suno `gen auto` CRX POC

## Scope

このPOCは、ログイン済みのSuno `/create` ページにダミーpromptを自動挿入するだけです。

- SunoのGenerate/Createボタンはクリックしない
- 曲生成、完了待ち、mp3ダウンロード、mpv再生は行わない
- 認証情報やCookieは保存しない

## Windows install and test

PowerShellをリポジトリルートで実行します。

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\scripts\install-suno-crx-poc.ps1 -InstallDeno -RunTests
```

このスクリプトはDenoのインストール（`-InstallDeno`指定時）、`deno task check`、`deno task test`、Chrome拡張のロード先表示を行います。runtimeも起動する場合は`-StartRuntime`を追加します。

Chromeでは`chrome://extensions`を開き、Developer modeを有効にして、リポジトリの`crx`ディレクトリを**Load unpacked**してください。

## Usage

```sh
orochi session open https://github.com/bonsai/orochi suno
orochi browser open <session-id> https://suno.com/create
orochi suno gen auto <session-id>
orochi debug logs
```

`suno gen auto` はランタイムのキューを経由し、CRXがSunoタブのprompt欄へ次の文字列を挿入します。

```text
Orochi CRX POC dummy prompt — do not generate
```

成功時のログは `prompt-injected` です。未ログイン時は `auth-required`、prompt欄を検出できない場合は `selector-failed` を返します。
