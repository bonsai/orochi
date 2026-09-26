import { assertEquals } from "jsr:@std/assert";
import {
  isClass,
  ONTOLOGY,
  relationsFrom,
  validateOntology,
  type Ontology,
  type OntologyClass,
} from "./ontology.ts";

Deno.test("canonical ontology is valid", () => {
  assertEquals(validateOntology(ONTOLOGY), []);
});

Deno.test("canonical ontology declares every requested relation", () => {
  const keys = new Set(ONTOLOGY.relations.map((r) => `${r.rel} ${r.from}->${r.to}`));
  for (
    const key of [
      "contains Project->Head",
      "collects Head->Resource",
      "owns Project->Session",
      "runs Session->Engine",
      "boundTo Session->TabGroup",
      "operates Goal->Project",
      "references Goal->Resource",
      "memberOf Task->Goal",
      "dependsOn Task->Task",
      "produced Run->Document",
      "runs Run->Engine",
    ]
  ) {
    assertEquals(keys.has(key), true, `missing relation: ${key}`);
  }
});

Deno.test("same relation name may connect different class pairs", () => {
  // `runs` is declared for Session->Engine and Run->Engine; that is not a duplicate.
  const runs = ONTOLOGY.relations.filter((r) => r.rel === "runs");
  assertEquals(runs.length, 2);
  assertEquals(validateOntology(ONTOLOGY).includes("duplicate relation: runs Session->Engine"), false);
});

Deno.test("isClass narrows known classes only", () => {
  assertEquals(isClass("Project"), true);
  assertEquals(isClass("Session"), true);
  assertEquals(isClass("Widget"), false);

  const value: string = "Head";
  if (isClass(value)) {
    const typed: OntologyClass = value;
    assertEquals(typed, "Head");
  } else {
    throw new Error("Head should be a class");
  }
});

Deno.test("relationsFrom returns outgoing relations", () => {
  const projectRels = relationsFrom("Project").map((r) => r.rel).sort();
  assertEquals(projectRels, ["contains", "owns"]);
  assertEquals(relationsFrom("Engine"), []);
});

Deno.test("duplicate class kind is rejected", () => {
  const bad: Ontology = {
    version: 1,
    classes: [
      { kind: "Project", label: "p" },
      { kind: "Project", label: "p2" },
    ],
    relations: [],
  };
  assertEquals(validateOntology(bad), ["duplicate class kind: Project"]);
});

Deno.test("duplicate relation tuple is rejected", () => {
  const bad: Ontology = {
    version: 1,
    classes: [
      { kind: "Project", label: "p" },
      { kind: "Head", label: "h" },
    ],
    relations: [
      { rel: "contains", from: "Project", to: "Head", cardinality: "1..*" },
      { rel: "contains", from: "Project", to: "Head", cardinality: "1..*" },
    ],
  };
  assertEquals(validateOntology(bad), ["duplicate relation: contains Project->Head"]);
});

Deno.test("unknown class reference in relation is rejected", () => {
  const bad: Ontology = {
    version: 1,
    classes: [{ kind: "Project", label: "p" }],
    relations: [
      { rel: "contains", from: "Project", to: "Head", cardinality: "1..*" },
    ],
  };
  assertEquals(validateOntology(bad), ["unknown relation class: contains to Head"]);
});

Deno.test("unknown extends class is rejected", () => {
  const bad: Ontology = {
    version: 1,
    classes: [
      { kind: "Session", label: "s", extends: "Widget" as unknown as OntologyClass },
    ],
    relations: [],
  };
  assertEquals(validateOntology(bad), ["unknown extends class: Session -> Widget"]);
});

Deno.test("ontology round-trips through JSON", () => {
  assertEquals(JSON.parse(JSON.stringify(ONTOLOGY)), ONTOLOGY);
});
