/**
 * Orochi のドメイン語彙（ontology）。
 *
 * ここに置くのは「語彙（型・スキーマ）」だけ。実データ（ノード/エッジ）は
 * `topology.ts` が持つ。`Ontology` はプレーン JSON に round-trip できる。
 */

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

/**
 * 正準の語彙。クラスは `types.ts` の概念（Project / Head / Resource / Session /
 * Goal / Engine など）と接続する。同じ rel 名（例: `runs`）は別の
 * (from, to) の組に対して複数回現れてよい。
 */
export const ONTOLOGY: Ontology = {
  version: 1,
  classes: [
    { kind: "Project", label: "プロジェクト作業文脈" },
    { kind: "Head", label: "プロジェクトの作業面（8 heads）" },
    { kind: "Resource", label: "URL を持つ資源" },
    { kind: "Session", label: "ブラウザ作業文脈（1 Session = 1 context）" },
    { kind: "Goal", label: "collect → operate → return のゴール形" },
    { kind: "Task", label: "作業項目" },
    { kind: "Run", label: "1 回のループ実行" },
    { kind: "Engine", label: "実行エンジン（chatgpt / suno）" },
    { kind: "TabGroup", label: "Chrome Tab Group" },
    { kind: "Document", label: "成果物ドキュメント" },
    { kind: "Signal", label: "イベント / 通知" },
  ],
  relations: [
    {
      rel: "contains",
      from: "Project",
      to: "Head",
      cardinality: "1..*",
      description: "プロジェクトは作業面を含む",
    },
    {
      rel: "collects",
      from: "Head",
      to: "Resource",
      cardinality: "0..*",
      description: "作業面は資源を集める",
    },
    {
      rel: "owns",
      from: "Project",
      to: "Session",
      cardinality: "0..*",
      description: "プロジェクトはセッションを所有する",
    },
    {
      rel: "runs",
      from: "Session",
      to: "Engine",
      cardinality: "1",
      description: "セッションはエンジンで動く",
    },
    {
      rel: "boundTo",
      from: "Session",
      to: "TabGroup",
      cardinality: "0..1",
      description: "セッションは Tab Group に束縛される",
    },
    {
      rel: "operates",
      from: "Goal",
      to: "Project",
      cardinality: "1",
      description: "ゴールはプロジェクトを操作する",
    },
    {
      rel: "references",
      from: "Goal",
      to: "Resource",
      cardinality: "0..*",
      description: "ゴールは資源を参照する",
    },
    {
      rel: "memberOf",
      from: "Task",
      to: "Goal",
      cardinality: "0..*",
      description: "タスクはゴールに属する",
    },
    {
      rel: "dependsOn",
      from: "Task",
      to: "Task",
      cardinality: "0..*",
      description: "タスクはタスクに依存する（非循環）",
    },
    {
      rel: "produced",
      from: "Run",
      to: "Document",
      cardinality: "0..*",
      description: "実行は文書を生む",
    },
    {
      rel: "runs",
      from: "Run",
      to: "Engine",
      cardinality: "1",
      description: "実行はエンジンで動く",
    },
    {
      rel: "publishes",
      from: "Goal",
      to: "Document",
      cardinality: "0..*",
      description: "ゴールは成果物を公開する",
    },
  ],
};

const CLASS_SET: ReadonlySet<string> = new Set<string>(
  ONTOLOGY.classes.map((c) => c.kind as string),
);

export function isClass(v: string): v is OntologyClass {
  return CLASS_SET.has(v);
}

export function relationsFrom(c: OntologyClass): RelationSpec[] {
  return ONTOLOGY.relations.filter((r) => r.from === c);
}

/**
 * 語彙の整合性検査。検出するもの:
 * - version が 1 でない
 * - クラス kind の重複
 * - `extends` の未知クラス参照
 * - 関係 (rel, from, to) の重複
 * - 関係の from / to が `classes` に無い（未知クラス参照）
 *
 * 同じ rel 名（例: `runs`）が別の (from, to) に現れるのは正常で、重複ではない。
 */
export function validateOntology(o: Ontology): string[] {
  const errors: string[] = [];

  if (o.version !== 1) {
    errors.push(`unsupported ontology version: ${o.version}`);
  }

  const kinds = new Set<string>();
  for (const c of o.classes) {
    if (kinds.has(c.kind)) errors.push(`duplicate class kind: ${c.kind}`);
    kinds.add(c.kind);
  }

  for (const c of o.classes) {
    if (c.extends !== undefined && !kinds.has(c.extends)) {
      errors.push(`unknown extends class: ${c.kind} -> ${c.extends}`);
    }
  }

  const rels = new Set<string>();
  for (const r of o.relations) {
    const key = `${r.rel} ${r.from}->${r.to}`;
    if (rels.has(key)) errors.push(`duplicate relation: ${key}`);
    rels.add(key);

    if (!kinds.has(r.from)) errors.push(`unknown relation class: ${r.rel} from ${r.from}`);
    if (!kinds.has(r.to)) errors.push(`unknown relation class: ${r.rel} to ${r.to}`);
  }

  return errors;
}
