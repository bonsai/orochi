# Topology / Ontology

Orochi Core の「語彙（ontology）」と「語彙に準拠した実データ（topology）」の型定義。
どちらも**純粋な型・純関数**で、ランタイム挙動は変えない。`Ontology` / `Topology` は
プレーン JSON に round-trip できる（snapshot に載せる前提）。

- 実装: `deno/core/ontology.ts`, `deno/core/topology.ts`
- 公開: `deno/mod.ts` から再 export
- テスト: `deno/core/ontology_test.ts`, `deno/core/topology_test.ts`

## Ontology = 語彙（型・スキーマのみ、値は持たない）

```ts
export type OntologyClass =
  | "Project" | "Head" | "Resource" | "Session" | "Goal"
  | "Task" | "Run" | "Engine" | "TabGroup" | "Document" | "Signal";

export type OntologyRelation =
  | "contains" | "collects" | "operates" | "publishes"
  | "owns" | "runs" | "produced" | "references" | "dependsOn"
  | "boundTo" | "memberOf";

export type Cardinality = "1" | "0..1" | "1..*" | "0..*";

export type ClassSpec = { kind: OntologyClass; label: string; extends?: OntologyClass };

export type RelationSpec = {
  rel: OntologyRelation;
  from: OntologyClass;
  to: OntologyClass;
  cardinality: Cardinality;
  description?: string;
};

export type Ontology = { version: 1; classes: ClassSpec[]; relations: RelationSpec[] };

export const ONTOLOGY: Ontology;
export function isClass(v: string): v is OntologyClass;
export function relationsFrom(c: OntologyClass): RelationSpec[];
export function validateOntology(o: Ontology): string[];
```

### クラス一覧

| kind | label | 接続する既存概念（`types.ts`） |
|---|---|---|
| `Project` | プロジェクト作業文脈 | `Project` |
| `Head` | プロジェクトの作業面（8 heads） | `Head` |
| `Resource` | URL を持つ資源 | `Resource` |
| `Session` | ブラウザ作業文脈（1 Session = 1 context） | `Session` |
| `Goal` | collect → operate → return のゴール形 | `Goal` |
| `Task` | 作業項目 | `orchestration.ts` の `Task` |
| `Run` | 1 回のループ実行 | — |
| `Engine` | 実行エンジン（chatgpt / suno） | `EngineId` |
| `TabGroup` | Chrome Tab Group | `Session.tabGroupId` |
| `Document` | 成果物ドキュメント | — |
| `Signal` | イベント / 通知 | — |

### 関係一覧（`ONTOLOGY.relations`）

| rel | from → to | cardinality | 意味 |
|---|---|---|---|
| `contains` | Project → Head | `1..*` | プロジェクトは作業面を含む |
| `collects` | Head → Resource | `0..*` | 作業面は資源を集める |
| `owns` | Project → Session | `0..*` | プロジェクトはセッションを所有する |
| `runs` | Session → Engine | `1` | セッションはエンジンで動く |
| `boundTo` | Session → TabGroup | `0..1` | セッションは Tab Group に束縛される |
| `operates` | Goal → Project | `1` | ゴールはプロジェクトを操作する |
| `references` | Goal → Resource | `0..*` | ゴールは資源を参照する |
| `memberOf` | Task → Goal | `0..*` | タスクはゴールに属する |
| `dependsOn` | Task → Task | `0..*` | タスクはタスクに依存する（非循環） |
| `produced` | Run → Document | `0..*` | 実行は文書を生む |
| `runs` | Run → Engine | `1` | 実行はエンジンで動く |
| `publishes` | Goal → Document | `0..*` | ゴールは成果物を公開する |

> 同じ rel 名（例: `runs`）が別の `(from, to)` の組に複数回現れてよい。
> `validateOntology` が「重複」とみなすのは `(rel, from, to)` の完全一致のみ。

## Topology = 語彙に準拠した実データ

```ts
export type TopologyNode = {
  id: string;          // 安定 ID
  class: OntologyClass;
  label?: string;
  ref?: string;        // 実体参照（url / session id / repo 等）
};

export type TopologyEdge = { from: string; rel: OntologyRelation; to: string };

export type Topology = { version: 1; nodes: TopologyNode[]; edges: TopologyEdge[] };

export function projectTopology(p: Project): Topology;
export function sessionTopology(s: Session): Topology;
export function mergeTopology(...ts: Topology[]): Topology;
export function validateTopology(t: Topology, o?: Ontology): string[];
```

### 生成関数

- `projectTopology(p)` — `Project` ノード、`Head` ノード群、`Resource` ノード群を生成し、
  `Project contains Head` と `Head collects Resource` を張る。
- `sessionTopology(s)` — `projectTopology(s.project)` を土台に、`Project owns Session`、
  `Session runs Engine`、`tabGroupId` があれば `Session boundTo TabGroup` を追加する。
- `mergeTopology(...ts)` — ノードを `id`、エッジを `(from, rel, to)` で重複除去して 1 つに
  まとめる。最初に現れた順序を保ち、同じ `id` のノードは最初の定義を採用する。
  複数 Session が同一 Project を共有する場合の合成に使う。

安定 ID の付け方:

| 対象 | id |
|---|---|
| Project | `project:<Project.id>` |
| Head | `head:<Head>` |
| Resource | `resource:<url>` |
| Session | `session:<Session.id>` |
| Engine | `engine:<EngineId>` |
| TabGroup | `tabgroup:<tabGroupId>` |

### 例（`projectTopology` の出力）

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "project:bonsai/orochi",
      "class": "Project",
      "label": "bonsai/orochi",
      "ref": "bonsai/orochi"
    },
    { "id": "head:repo", "class": "Head", "label": "repo" },
    { "id": "head:issue", "class": "Head", "label": "issue" },
    {
      "id": "resource:https://github.com/bonsai/orochi",
      "class": "Resource",
      "label": "https://github.com/bonsai/orochi",
      "ref": "https://github.com/bonsai/orochi"
    },
    {
      "id": "resource:https://github.com/bonsai/orochi/issues/55",
      "class": "Resource",
      "label": "#55",
      "ref": "https://github.com/bonsai/orochi/issues/55"
    }
  ],
  "edges": [
    { "from": "project:bonsai/orochi", "rel": "contains", "to": "head:repo" },
    { "from": "project:bonsai/orochi", "rel": "contains", "to": "head:issue" },
    {
      "from": "head:repo",
      "rel": "collects",
      "to": "resource:https://github.com/bonsai/orochi"
    },
    {
      "from": "head:issue",
      "rel": "collects",
      "to": "resource:https://github.com/bonsai/orochi/issues/55"
    }
  ]
}
```

## 検証の使い方

`validateTopology` は不正を文字列の配列で返す（空配列 = 健全）。`o` を省略すると
正準の `ONTOLOGY` を使う。独自の語彙を渡せば、その語彙で検証できる。

```ts
import { validateTopology, sessionTopology } from "./core/topology.ts";
import { ONTOLOGY, validateOntology } from "./core/ontology.ts";

const errors = validateOntology(ONTOLOGY); // [] — 正準語彙は健全
const topo = sessionTopology(session);
const topoErrors = validateTopology(topo); // [] — 生成した topology は語彙に準拠
```

### 検出する異常（`validateTopology`）

| 異常 | メッセージ例 |
|---|---|
| エッジが未知ノードを参照 | `unknown node reference: session:missing` |
| ontology に無い rel | `unknown relation: teleports` |
| class-relation 不整合 | `class-relation mismatch: Project -collects-> Resource` |
| `dependsOn` の循環 | `dependsOn cycle detected: task:a -> task:b -> task:a` |

### 検出する異常（`validateOntology`）

| 異常 | メッセージ例 |
|---|---|
| version が 1 でない | `unsupported ontology version: 2` |
| クラス kind の重複 | `duplicate class kind: Project` |
| `extends` の未知クラス参照 | `unknown extends class: Session -> Widget` |
| 関係 `(rel, from, to)` の重複 | `duplicate relation: contains Project->Head` |
| 関係の未知クラス参照 | `unknown relation class: contains to Head` |

## round-trip 保証

`Ontology` / `Topology` はプレーンな JSON オブジェクト・配列・プリミティブのみで構成
される。`JSON.parse(JSON.stringify(x))` は `x` と深い同値になる（テストで検証済み）。
snapshot（`SessionSnapshot` 等）にそのまま載せられる。
