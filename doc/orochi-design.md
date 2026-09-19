# Orochi 設計書

OrochiはSidebarからPrompt / Voice / Smartphone入力で8つのBrowser Tabを指揮し、各TabのDOMとWeb APIを融通してProjectを操作するBrowser Project Orchestra。

## 基本単位

**1 Session = 1 browser context**。進化形は **最大8セッションの並列**。Sidebar は9番目の Tab ではなく Command Center / 指揮席。

### マルチセッション（8並列）

Session は Core が保持する Project の作業文脈（`s1`〜`s8` の8スロット上限）。

- **local runtime が唯一の8スロット所有者**
- CLI / CRX / MCP / SDK は全て API クライアント（gh 方式）。どの界面からでも同じ Session を操作
- 1 Session = 1 Tab Group（CLI-only セッションは Tab Group 不要）
- 8満杯時: open はエラー + active 一覧
- runtime 再起動時は JSON スナップショット（`$HOME/.orochi/sessions.json`）から復元

詳細 → [multisession.md](multisession.md)

## Input

Prompt / Voice / Smartphone。これらは8 Tabsへ指示するInput Interface。

## 8 Tabs

1. Repo — Repository
2. Issue — Issue
3. PR — Pull Request
4. Action — GitHub Actions / Workflow
5. Deploy — Deployment / Pages
6. Chat — AI / Conversation
7. Data — Data / Dashboard
8. World — 外部Web / Project Context

8 Tabsは独立アプリではなくProjectの8つの作業面。

## DOM Orchestration

WebページのDOMをTab間で融通する。

```text
Tab A → DOM / State → Command Context → Tab B → DOM / API → Result
```

## API Orchestration

DOM操作とWeb API操作を同じCommandから扱う。APIで操作できるものはAPI、DOMが必要なものはDOM、API結果はDOMへ反映し、DOMから得た情報は次の操作へ渡す。

## Command

```json
{
  "target": "issue",
  "intent": "inspect",
  "context": { "repository": "bonsai/orochi", "issue": 2 }
}
```

Commandは意図を表し、具体的なDOM/API操作から分離する。

## Orchestra

```text
Prompt → Command → Plan → 8 Tabs → DOM/API → Results → Sidebar
```

1つのPromptから複数Tabを順番または並列に操作する。

## Sidebar

```text
Sidebar
├── Project
├── Input: Prompt / Voice / Smartphone
├── Tab Selector: 1..8
├── Command
├── Activity
└── Result
```

## AI

AIはConductor。Prompt理解、Command生成、Tab選択、DOM/API選択、Tab間データ受け渡し、結果解釈、次Command生成を担当する。AIはsource of truthではない。

## CRX Architecture

```text
crx/
├── manifest.json
├── background/
├── sidebar/
├── tabs/
├── dom/
├── api/
└── command/
```

CRXはBrowser orchestrationを担当する。

## Runtime

```text
deno/
├── core/
├── cli.ts
├── api.ts
└── mcp.ts
```

Denoはlocal executionを担当する。

## Platform

```text
orochi/
├── crx/    # Browser Orchestra
├── deno/   # Local Runtime
├── clb/    # Notebook / Research
└── doc/    # Knowledge
```

`src/`は使用しない。フォルダ名そのものが実行・利用プラットフォームを示す。

## Security

- CRXにcredentialを保存しない
- privileged operationはruntimeへ寄せる
- Webページ上のsecretを不用意に取得しない
- AIへ不要なsecretを渡さない

## MVP

```text
Chrome → Sidebar → Project → 8 Tabs → Prompt → Command → DOM/API → Tab間連携 → Result → Sidebar
```

## 最終モデル

```text
Human
 ├─ Prompt
 ├─ Voice
 └─ Smartphone
       ↓
    Sidebar
       ↓
 AI Conductor
       ↓
 Orochi CRX
       ↓
 8 Tabs
       ↓
 DOM ↔ Web API
       ↓
 Web / GitHub
       ↓
 Canon
```

**Orochi = Sidebarから8つのWeb面を指揮するBrowser Project Orchestra。**