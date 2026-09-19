# Orochi — 再定義

## 一言
**Orochiは、サイドバーからプロンプトで8つのWeb Tabを指揮し、各TabのDOMとWeb APIを融通してProjectを動かすChrome Extensionである。**

## Core Model
Project → Orochi Sidebar → Prompt → Tab Orchestra → 8 Tabs → DOM / Web API

## 8 Tabs
8 Tabsは8つの独立アプリではなく、Projectの8つの作業面。
1. Repo
2. Issue
3. PR
4. Action
5. Deploy
6. Chat
7. Data
8. World

## Sidebar
SidebarはOrochiの**指揮席**。ユーザーはSidebarへ自然言語で指示する。

例:
Issue #2を確認して、必要な修正を進めて

Orochiは指示を8 Tabsの操作へ分解する。
Prompt → Sidebar → 対象Tab → DOM / Web API → 結果 → 次のTab → Sidebar

## DOM Orchestration
Orochiの重要な能力は、単にTabを開くことではない。**WebページのDOMを相互に融通する。**
あるTabで得た情報を別Tabの操作へ渡す。

Repo DOM → Issue DOM → PR DOM → Action DOM → Deploy DOM

## Web API
DOMだけに依存しない。可能な操作はWeb APIを直接叩き、DOMは表示・確認・操作に利用する。
- APIで高速に取得・操作できるものはAPIを使う
- DOMしか操作できないものはDOMを使う
- APIの結果をDOMへ反映する
- DOM上の結果を次の操作へ渡す

## Browser Context
**1 Project = 1 browser context**
Projectは1ページではなく8 Tabsを含むブラウザ作業環境として扱う。

## Platform Layout
実行プラットフォームはフォルダ名で明示する。
- crx/ — Chrome Extension / Orchestra
- deno/ — Deno Runtime / local execution
- clb/ — Colab / experiment・research
- doc/ — Documentation

現在の中心は crx/。Denoはlocal runtime、Colabは実験面、docは共有知識としてCRXを支える。

## AIの位置づけ
AIはsource of truthではない。AIは**指揮者**として、指示を解釈し、対象Tabを選び、DOM/API操作を組み合わせ、結果を読み、次の操作を決める。
GitHubや各Webサービスが保持する状態をcanonとして扱う。

## Security
CRXはcredential vaultではない。
- secretをCRXへ保存しない
- privileged operationはruntime/API側へ寄せる
- DOMに表示されたsecretを不用意に取得しない
- canonical stateはWeb/API側に置く

## MVP
Chrome → Sidebar → Project指定 → 8 Tabs生成 → Prompt → 対象Tab選択 → DOM/API操作 → 結果取得 → Sidebarへ集約

## 成功条件
- Sidebarから指示できる
- 8 TabsをProject単位で管理できる
- 各TabのDOMを取得・操作できる
- Web APIを直接呼べる
- Tab間で結果を受け渡せる
- 操作結果をSidebarへ集約できる
- GitHubをcanonとして扱える
- CRXにcredentialを保存しない

## 原則
> **Orochi = Browser Project Orchestra**
> **Sidebar = 指揮席**
> **8 Tabs = 8つの作業面**
> **DOM + Web API = 操作面**
> **Prompt = 指示**
> **AI = Conductor**
> **GitHub = Canon**