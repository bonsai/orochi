# Orochi Platform Onboarding

## Platform is a folder

Orochiはプラットフォームごとにフォルダを分ける。フォルダ名を見れば、どこで動くものか分かる状態にする。

~~~text
orochi/
├── deno/   # Deno: runtime / Core / CLI / API / MCP
├── crx/    # Chrome: browser projection
├── clb/    # Colab: notebook / experiment
└── doc/    # Documentation: knowledge / rules / specifications
~~~

GitHubがcanonであり、Orochiは各プラットフォームを同じProject Stateへ接続する。

## 1. CRX — Chrome

### 役割
ブラウザをProjectの作業面にする。現在タブをProjectとして認識し、関連するGitHub、Issue、PR、Actions、Deploy、ChatなどをTab Groupへまとめる。

### 基本フロー
~~~text
ChromeでGitHub Projectを開く
→ CRXがactive tabを取得
→ local Orochi APIへresolve依頼
→ Projectを特定
→ 関連resourceを取得
→ Tab Groupを構成
~~~

### セキュリティ
CRXはcredential vaultではない。GitHub tokenやPATをextension storageへ保存しない。認証はlocal runtime側で扱う。

### CRXを使う場面
- ブラウザ中心で作業したい
- Projectに必要なページを一括で開きたい
- 現在のブラウザ状態をProject contextとして扱いたい

## 2. Deno — Runtime

### 役割
DenoはOrochiを実際に実行するプラットフォーム。旧来の曖昧なsrc/ではなく、deno/自体が実行場所を表す。

~~~text
deno/
├── core/
│   ├── types.ts
│   └── project.ts
├── mod.ts
├── cli.ts
├── api.ts
└── mcp.ts
~~~

### Core
Project / Resource / State / Actionを共通モデルとして持つ。CRX、CLI、API、MCPは同じCoreを使う。

### CLI
~~~bash
deno run deno/cli.ts resolve https://github.com/bonsai/orochi
deno run deno/cli.ts session open https://github.com/bonsai/orochi
deno run deno/cli.ts session ls
deno run deno/cli.ts session close s1
~~~

CLI は local runtime のクライアント。セッションは runtime が最大8個保持し、
CLI / CRX / MCP から同じセッションを操作できる。状態は
`$HOME/.orochi/sessions.json` に保存され、runtime 再起動後も復元される。

### API
~~~bash
deno task dev
~~~

local APIは127.0.0.1:8787で動かす。health endpointでruntimeの稼働を確認できる。

~~~text
GET /health
POST /resolve
{"url":"https://github.com/bonsai/orochi"}
~~~

### MCP
MCPはAI AgentからCoreを利用する境界。AIごとに独自のProject logicを作らず、Coreの操作を共有する。

## 3. Colab — clb/

### 役割
Colabは考える、調べる、試す、分析する、生成するための実験プラットフォーム。Notebookそのものを成果のcanonにはせず、再現可能な作業としてGitHubに保存する。

### Notebook
~~~text
clb/
├── 00_manifesto.ipynb
├── 01_make.ipynb
├── 02_fix.ipynb
├── 03_research.ipynb
└── 04_publish.ipynb
~~~

### 00_manifesto
「とにかくやれ」のルールを確認する。説明しすぎず、まず依頼し、実行し、結果を見て、ダメなら直す。

### 01_make
作るためのNotebook。目的 → AIへの依頼 → 生成 → 実行 → 成果確認の順で進める。

### 02_fix
エラーを入力として修正する。Error → AIへ渡す → 修正 → 再実行 → 確認を繰り返す。

### 03_research
調査、比較、データ収集、仮説形成、分析を行う。成果は必要に応じてJSON、JSONL、CSV、Markdown、HTMLなどへ出す。

### 04_publish
Notebookで得た成果を公開可能なartifactへ変換する。GitHub、Pages、API、SaaSなどへ接続する。

## 4. doc/ — Documentation

doc/は人間とAIがProjectを理解するための共有知識。実行場所ではなく、仕様・判断・運用・オンボーディングを保存する。

推奨構成:
~~~text
doc/
├── onboarding.md
├── POC.md
├── dev.md
├── prd.md
├── ux.md
└── kpi.md
~~~

onboarding.mdは入口、POC.mdは最小実証、dev.mdは開発規則、prd.mdは要求、ux.mdは操作体験、kpi.mdは成果指標を扱う。

## 5. どこで何をするか

| やること | 場所 |
|---|---|
| ブラウザを操作 | crx/ |
| Projectをresolve | deno/ |
| Coreを実行 | deno/ |
| CLI | deno/ |
| Local API | deno/ |
| AI Agent接続 | deno/ MCP |
| Notebook | clb/ |
| 調査・分析 | clb/ |
| 実験・生成 | clb/ |
| 仕様・ルール | doc/ |
| オンボーディング | doc/ |

## 6. 基本ワークフロー

### Browser first
Chrome → CRX → Project resolve → Tab Group → 作業。

### AI first
ChatGPT → Project URL → 調べる / 作る / 直す → GitHubで成果確認。

### Notebook first
Colab → clb/*.ipynb → 実験 → artifact生成 → GitHubへ保存。

### Runtime first
Deno → Core → API / CLI / MCP → GitHub → CRX / Agent / Colabから利用。

## 7. 判断ルール

ブラウザならcrx、実行runtimeならdeno、Notebookならclb、知識ならdoc。

新しいフォルダを作るときも、まず「これはどのプラットフォームで動くか」を決める。意味の曖昧なsrc/を復活させない。

## 8. 最重要原則

> Platform is a folder.

フォルダ構造そのものがオンボーディングになること。コードを読む前に、どこで動くものなのか分かること。

~~~text
crx  = Browser
deno = Runtime
clb  = Notebook
doc  = Knowledge
~~~