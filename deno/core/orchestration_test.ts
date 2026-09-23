import { assertEquals } from "jsr:@std/assert";
import {
  blockedTasks,
  dependencyState,
  readyTasks,
  validateTaskPlan,
  type TaskPlan,
} from "./orchestration.ts";

const task = (id: string) => ({
  id,
  goal: `goal ${id}`,
  lane: "runtime",
  dependsOn: [],
  paths: [],
  exclusive: [],
  outputs: [],
  doneWhen: [],
});

Deno.test("Task/Wave/Barrier plan validates", () => {
  const plan: TaskPlan = {
    tasks: [task("a"), { ...task("b"), dependsOn: ["a"] }],
    waves: [{ id: "w1", tasks: ["a"] }, { id: "w2", tasks: ["b"] }],
    barriers: [{
      id: "b1",
      waveId: "w1",
      requiresTests: ["deno test"],
      requiresArtifacts: ["result"],
      requiresReview: true,
    }],
  };
  assertEquals(validateTaskPlan(plan), []);
});

Deno.test("missing dependency is rejected", () => {
  const plan: TaskPlan = {
    tasks: [{ ...task("b"), dependsOn: ["missing"] }],
    waves: [{ id: "w1", tasks: ["b"] }],
    barriers: [],
  };
  assertEquals(validateTaskPlan(plan), ["unknown dependency: b -> missing"]);
});

Deno.test("cyclic dependency is rejected", () => {
  const plan: TaskPlan = {
    tasks: [
      { ...task("a"), dependsOn: ["b"] },
      { ...task("b"), dependsOn: ["a"] },
    ],
    waves: [{ id: "w1", tasks: ["a", "b"] }],
    barriers: [],
  };
  assertEquals(validateTaskPlan(plan), ["cyclic dependency detected"]);
});

Deno.test("only indegree-zero tasks are initially ready", () => {
  const plan: TaskPlan = {
    tasks: [
      task("a"),
      { ...task("b"), dependsOn: ["a"] },
      task("c"),
    ],
    waves: [{ id: "w1", tasks: ["a", "b", "c"] }],
    barriers: [],
  };

  assertEquals(readyTasks(plan, new Map()), ["a", "c"]);
});

Deno.test("completed dependencies release dependent task", () => {
  const plan: TaskPlan = {
    tasks: [
      task("a"),
      { ...task("b"), dependsOn: ["a"] },
    ],
    waves: [{ id: "w1", tasks: ["a", "b"] }],
    barriers: [],
  };

  assertEquals(
    readyTasks(plan, new Map([["a", "completed"]])),
    ["b"],
  );
  assertEquals(
    dependencyState(plan.tasks[1], new Map([["a", "completed"]])),
    "completed",
  );
});

Deno.test("failed dependency propagates", () => {
  const plan: TaskPlan = {
    tasks: [
      task("a"),
      { ...task("b"), dependsOn: ["a"] },
    ],
    waves: [{ id: "w1", tasks: ["a", "b"] }],
    barriers: [],
  };
  const results = new Map([["a", "failed" as const]]);

  assertEquals(readyTasks(plan, results), []);
  assertEquals(blockedTasks(plan, results), ["b"]);
  assertEquals(dependencyState(plan.tasks[1], results), "failed");
});

Deno.test("blocked dependency propagates", () => {
  const plan: TaskPlan = {
    tasks: [
      task("a"),
      { ...task("b"), dependsOn: ["a"] },
    ],
    waves: [{ id: "w1", tasks: ["a", "b"] }],
    barriers: [],
  };
  const results = new Map([["a", "blocked" as const]]);

  assertEquals(readyTasks(plan, results), []);
  assertEquals(blockedTasks(plan, results), ["b"]);
  assertEquals(dependencyState(plan.tasks[1], results), "blocked");
});
