# Orochi — 再定義

## 一言
**Orochiは、tmux / herdr / takt / aw を「ブラウザ = Project Context」で統合した存在である。
並列セッション（tmux・herdr）×エージェントオーケストレーション（takt）×ゴール実行（aw）を
1つのProjectに対する8つの作業面（8 Tabs）として束ね、ゴールの型を完成させる。**

## 何を統合しているのか

| 道具の系譜 | 能力 | Orochi での受け持ち |
|---|---|---|
| tmux / herdr | 複数セッションの並列・永続・ワークスペース整理 | **8 Session 並列**。CRX の Tab Group / CLI の Session / runtime のスロット |
| takt | エージェントを計画→実装→レビュー→修正で振る orchestration | **Conductor 層**。Prompt→Command→Plan→8 Tabs→DOM/API→結果→Sidebar |
| aw | ゴールを1コマンドで最後まで通す自動化 | **ゴールの型の実行**。collect→operate→return の完成まで一本で通す |

takt がターミナル上のエージェントを、tmux/herdr がその作業台を、aw がゴールまでの道を
それぞれ担当するなら、Orochi はそのすべてを **1つのProjectのブラウザ文脈**に載せる。
Sidebar / 8 Tabs / Tab Group / Session が「作業台」であり、「指揮」であり、「道」である。

## ゴールの型

Orochi が追うゴールは次の収束型（goal shape）を持つ。

```text
Project（canon）
   ↓ resolve
8つの頭を集める（collect）      ← aw 的: 一気に取り揃える
   ↓ orchestration
1つの操作面として動かす（operate） ← takt 的: AIがconductorで振る
   ↓ publish / sync
結果を can へ返し done にする（return） ← canon へ戻す
```

```ts
type Goal = {
  shape: "project-context";     // Orochi のゴールの型
  target: Project;
  heads: Head[];                // 揃えるべき作業面
  status: "collecting" | "operating" | "publishing" | "done" | "blocked";
  canonOk: boolean;             // GitHub へ結果が返ったか
};
```

- 「途中で散っている」ものを1つの文脈（Session + Tab Group）へ収束させる
- 完了 = 操作の結果が GitHub の項目（Issue/PR/Action/Deploy）として残り、Project が done に戻る
- 並列しても1ゴール = 1プロジェクト、最大8セッション

## Core Model
Project → Orochi Sidebar → Prompt → Tab Orchestra → 8 Tabs → DOM / Web API

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
**1 Session = 1 browser context**（最大8セッション並列）。
Projectは1ページではなく8 Tabsを含むブラウザ作業環境として扱う。複数 Project を同時に
Session として保持し、Tab Group ごとに作業面を分ける。

→ 詳細: [multisession.md](multisession.md)

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
> **Orochi = tmux/herdr×takt×aw を統合した Browser Project Orchestra**
> **Sidebar = 指揮席**
> **8 Tabs = 8つの作業面**
> **DOM + Web API = 操作面**
> **Prompt = 指示**
> **AI = Conductor**
> **Goal = Project の収束（collect → operate → return）**
> **GitHub = Canon**