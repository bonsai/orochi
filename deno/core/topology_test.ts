import { assertEquals } from "jsr:@std/assert";
import { ONTOLOGY, type Ontology, type OntologyRelation } from "./ontology.ts";
import {
  mergeTopology,
  projectTopology,
  sessionTopology,
  validateTopology,
  type Topology,
} from "./topology.ts";
import type { Project, Session } from "./types.ts";

const project: Project = {
  id: "bonsai/orochi",
  repo: "bonsai/orochi",
  state: "working",
  resources: [
    { head: "repo", url: "https://github.com/bonsai/orochi" },
    { head: "issue", url: "https://github.com/bonsai/orochi/issues/55", title: "#55" },
  ],
};

const session: Session = {
  id: "s1",
  project,
  engine: "chatgpt",
  status: "active",
  tabGroupId: 7,
  createdAt: 1,
  lastActiveAt: 2,
};

Deno.test("projectTopology produces an ontology-valid graph", () => {
  const topo = projectTopology(project);
  assertEquals(validateTopology(topo), []);

  const edges = new Set(topo.edges.map((e) => `${e.from} -${e.rel}-> ${e.to}`));
  assertEquals(edges.has("project:bonsai/orochi -contains-> head:repo"), true);
  assertEquals(edges.has("project:bonsai/orochi -contains-> head:issue"), true);
  assertEquals(
    edges.has("head:issue -collects-> resource:https://github.com/bonsai/orochi/issues/55"),
    true,
  );
});

Deno.test("sessionTopology connects project, session, engine and tab group", () => {
  const topo = sessionTopology(session);
  assertEquals(validateTopology(topo), []);

  const edges = new Set(topo.edges.map((e) => `${e.from} -${e.rel}-> ${e.to}`));
  assertEquals(edges.has("project:bonsai/orochi -owns-> session:s1"), true);
  assertEquals(edges.has("session:s1 -runs-> engine:chatgpt"), true);
  assertEquals(edges.has("session:s1 -boundTo-> tabgroup:7"), true);
});

Deno.test("session without a tab group omits the boundTo edge", () => {
  const topo = sessionTopology({ ...session, tabGroupId: undefined });
  assertEquals(topo.edges.some((e) => e.rel === "boundTo"), false);
  assertEquals(topo.nodes.some((n) => n.class === "TabGroup"), false);
  assertEquals(validateTopology(topo), []);
});

Deno.test("mergeTopology de-duplicates shared nodes and edges", () => {
  const single = projectTopology(project);
  const merged = mergeTopology(single, single);
  assertEquals(merged.nodes.length, single.nodes.length);
  assertEquals(merged.edges.length, single.edges.length);
});

Deno.test("mergeTopology unions multiple sessions on one project", () => {
  const s2: Session = { ...session, id: "s2", engine: "suno", tabGroupId: 8 };
  const merged = mergeTopology(sessionTopology(session), sessionTopology(s2));
  assertEquals(validateTopology(merged), []);

  const ids = new Set(merged.nodes.map((n) => n.id));
  assertEquals(ids.has("session:s1"), true);
  assertEquals(ids.has("session:s2"), true);
  assertEquals(ids.has("engine:chatgpt"), true);
  assertEquals(ids.has("engine:suno"), true);
});

Deno.test("Topology round-trips through JSON", () => {
  const topo = sessionTopology(session);
  assertEquals(JSON.parse(JSON.stringify(topo)), topo);
});

Deno.test("unknown node reference is rejected", () => {
  const topo: Topology = {
    version: 1,
    nodes: [{ id: "project:x", class: "Project" }],
    edges: [{ from: "project:x", rel: "owns", to: "session:missing" }],
  };
  assertEquals(validateTopology(topo), ["unknown node reference: session:missing"]);
});

Deno.test("relation not present in the ontology is rejected", () => {
  const topo: Topology = {
    version: 1,
    nodes: [
      { id: "project:x", class: "Project" },
      { id: "head:repo", class: "Head" },
    ],
    edges: [
      { from: "project:x", rel: "teleports" as unknown as OntologyRelation, to: "head:repo" },
    ],
  };
  assertEquals(validateTopology(topo), ["unknown relation: teleports"]);
});

Deno.test("class-relation mismatch is rejected", () => {
  const topo: Topology = {
    version: 1,
    nodes: [
      { id: "project:x", class: "Project" },
      { id: "resource:u", class: "Resource" },
    ],
    edges: [{ from: "project:x", rel: "collects", to: "resource:u" }],
  };
  assertEquals(validateTopology(topo), ["class-relation mismatch: Project -collects-> Resource"]);
});

Deno.test("dependsOn cycle is rejected", () => {
  const topo: Topology = {
    version: 1,
    nodes: [
      { id: "task:a", class: "Task" },
      { id: "task:b", class: "Task" },
      { id: "goal:g", class: "Goal" },
    ],
    edges: [
      { from: "task:a", rel: "memberOf", to: "goal:g" },
      { from: "task:a", rel: "dependsOn", to: "task:b" },
      { from: "task:b", rel: "dependsOn", to: "task:a" },
    ],
  };
  assertEquals(validateTopology(topo), ["dependsOn cycle detected: task:a -> task:b -> task:a"]);
});

Deno.test("acyclic dependsOn chain passes", () => {
  const topo: Topology = {
    version: 1,
    nodes: [
      { id: "task:a", class: "Task" },
      { id: "task:b", class: "Task" },
      { id: "goal:g", class: "Goal" },
    ],
    edges: [
      { from: "task:a", rel: "memberOf", to: "goal:g" },
      { from: "task:b", rel: "dependsOn", to: "task:a" },
    ],
  };
  assertEquals(validateTopology(topo), []);
});

Deno.test("validateTopology accepts a custom ontology", () => {
  const custom: Ontology = {
    version: 1,
    classes: [
      { kind: "Project", label: "p" },
      { kind: "Head", label: "h" },
    ],
    relations: [
      { rel: "owns", from: "Project", to: "Head", cardinality: "1" },
    ],
  };
  const topo: Topology = {
    version: 1,
    nodes: [
      { id: "project:x", class: "Project" },
      { id: "head:repo", class: "Head" },
    ],
    edges: [{ from: "project:x", rel: "owns", to: "head:repo" }],
  };
  assertEquals(validateTopology(topo, custom), []);
  assertEquals(
    validateTopology(topo, ONTOLOGY),
    ["class-relation mismatch: Project -owns-> Head"],
  );
});
