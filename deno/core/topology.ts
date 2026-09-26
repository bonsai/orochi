/**
 * Orochi の実データ構造（topology）。`ontology.ts` の語彙に準拠したノード/エッジ。
 *
 * `Topology` はプレーン JSON に round-trip できる（snapshot に載せる前提）。
 * ここは純粋な型と純関数のみで、ランタイム挙動は変えない。
 */

import type { Ontology, OntologyClass, OntologyRelation } from "./ontology.ts";
import { ONTOLOGY } from "./ontology.ts";
import type { Project, Session } from "./types.ts";

export type TopologyNode = {
  id: string; // 安定 ID
  class: OntologyClass;
  label?: string;
  ref?: string; // 実体参照（url / session id / repo 等）
};

export type TopologyEdge = { from: string; rel: OntologyRelation; to: string };

export type Topology = { version: 1; nodes: TopologyNode[]; edges: TopologyEdge[] };

function projectNodeId(id: string): string {
  return `project:${id}`;
}

function edgeKey(e: TopologyEdge): string {
  return `${e.from}\u0000${e.rel}\u0000${e.to}`;
}

/**
 * 複数の Topology を 1 つにまとめる。ノードは id、エッジは (from, rel, to) で
 * 重複を除去し、最初に現れた順序を保つ。同じ id のノードは最初の定義を採用する。
 */
export function mergeTopology(...ts: Topology[]): Topology {
  const nodes: TopologyNode[] = [];
  const seenNodes = new Set<string>();
  const edges: TopologyEdge[] = [];
  const seenEdges = new Set<string>();

  for (const t of ts) {
    for (const n of t.nodes) {
      if (seenNodes.has(n.id)) continue;
      seenNodes.add(n.id);
      nodes.push(n);
    }
    for (const e of t.edges) {
      const key = edgeKey(e);
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push(e);
    }
  }

  return { version: 1, nodes, edges };
}

/**
 * Project から topology を導出する。
 * Project `contains` Head / Head `collects` Resource を張る。
 */
export function projectTopology(p: Project): Topology {
  const pid = projectNodeId(p.id);
  const nodes: TopologyNode[] = [
    { id: pid, class: "Project", label: p.repo, ref: p.repo },
  ];
  const edges: TopologyEdge[] = [];

  const seenHeads = new Set<string>();
  for (const r of p.resources) {
    if (seenHeads.has(r.head)) continue;
    seenHeads.add(r.head);
    nodes.push({ id: `head:${r.head}`, class: "Head", label: r.head });
    edges.push({ from: pid, rel: "contains", to: `head:${r.head}` });
  }

  for (const r of p.resources) {
    const rid = `resource:${r.url}`;
    nodes.push({
      id: rid,
      class: "Resource",
      label: r.title ?? r.url,
      ref: r.url,
    });
    edges.push({ from: `head:${r.head}`, rel: "collects", to: rid });
  }

  return mergeTopology({ version: 1, nodes, edges });
}

/**
 * Session から topology を導出する。project 文脈を含み、以下を追加する:
 * Project `owns` Session / Session `runs` Engine / Session `boundTo` TabGroup。
 */
export function sessionTopology(s: Session): Topology {
  const base = projectTopology(s.project);
  const sid = `session:${s.id}`;
  const nodes: TopologyNode[] = [
    ...base.nodes,
    { id: sid, class: "Session", label: s.id, ref: s.id },
    { id: `engine:${s.engine}`, class: "Engine", label: s.engine },
  ];
  const edges: TopologyEdge[] = [
    ...base.edges,
    { from: projectNodeId(s.project.id), rel: "owns", to: sid },
    { from: sid, rel: "runs", to: `engine:${s.engine}` },
  ];

  if (s.tabGroupId !== undefined) {
    const tid = `tabgroup:${s.tabGroupId}`;
    nodes.push({ id: tid, class: "TabGroup", label: `tab-group ${s.tabGroupId}`, ref: String(s.tabGroupId) });
    edges.push({ from: sid, rel: "boundTo", to: tid });
  }

  return mergeTopology({ version: 1, nodes, edges });
}

/** `dependsOn` エッジ上の循環を検出し、経路つきのエラーを返す。 */
function dependsOnCycles(t: Topology): string[] {
  const adjacency = new Map<string, string[]>();
  for (const e of t.edges) {
    if (e.rel !== "dependsOn") continue;
    const list = adjacency.get(e.from) ?? [];
    list.push(e.to);
    adjacency.set(e.from, list);
  }

  const errors: string[] = [];
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    state.set(node, 1);
    stack.push(node);

    for (const next of adjacency.get(node) ?? []) {
      const current = state.get(next);
      if (current === 1) {
        const start = stack.indexOf(next);
        const cycle = [...stack.slice(start), next].join(" -> ");
        errors.push(`dependsOn cycle detected: ${cycle}`);
      } else if (current === undefined) {
        visit(next);
      }
    }

    stack.pop();
    state.set(node, 2);
  };

  for (const node of adjacency.keys()) {
    if (state.get(node) === undefined) visit(node);
  }

  return errors;
}

/**
 * Topology の整合性検査。`o` を省略すると正準の `ONTOLOGY` を使う。
 * 検出するもの:
 * - エッジが未知ノードを参照している
 * - ontology に無い rel
 * - class-relation の不整合（from/to クラスと rel の組が語彙に無い）
 * - `dependsOn` の循環
 */
export function validateTopology(t: Topology, o: Ontology = ONTOLOGY): string[] {
  const errors: string[] = [];

  const nodeClass = new Map<string, OntologyClass>();
  for (const n of t.nodes) nodeClass.set(n.id, n.class);

  const knownRels = new Set<string>(o.relations.map((r) => r.rel as string));
  const specs = new Set<string>();
  for (const r of o.relations) specs.add(`${r.rel}\u0000${r.from}\u0000${r.to}`);

  for (const e of t.edges) {
    const fromMissing = !nodeClass.has(e.from);
    const toMissing = !nodeClass.has(e.to);
    if (fromMissing) errors.push(`unknown node reference: ${e.from}`);
    if (toMissing) errors.push(`unknown node reference: ${e.to}`);

    if (!knownRels.has(e.rel)) {
      errors.push(`unknown relation: ${e.rel}`);
      continue;
    }
    if (fromMissing || toMissing) continue;

    const fromClass = nodeClass.get(e.from)!;
    const toClass = nodeClass.get(e.to)!;
    if (!specs.has(`${e.rel}\u0000${fromClass}\u0000${toClass}`)) {
      errors.push(`class-relation mismatch: ${fromClass} -${e.rel}-> ${toClass}`);
    }
  }

  errors.push(...dependsOnCycles(t));
  return errors;
}
