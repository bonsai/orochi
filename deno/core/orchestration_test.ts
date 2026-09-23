import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
  blockedTasks,
  dependencyState,
  readyTasks,
  ResourceLockManager,
  validateTaskPlan,
  withTaskLocks,
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

Deno.test("overlapping paths are rejected in one wave", () => {
  const plan: TaskPlan = {
    tasks: [
      { ...task("a"), paths: ["src/core"] },
      { ...task("b"), paths: ["src/core/store.ts"] },
    ],
    waves: [{ id: "w1", tasks: ["a", "b"] }],
    barriers: [],
  };

  assertEquals(validateTaskPlan(plan), [
    "path conflict in wave w1: a <-> b",
  ]);
});

Deno.test("exclusive resources cannot be duplicated in one wave", () => {
  const plan: TaskPlan = {
    tasks: [
      { ...task("a"), exclusive: ["session:s1"] },
      { ...task("b"), exclusive: ["session:s1"] },
    ],
    waves: [{ id: "w1", tasks: ["a", "b"] }],
    barriers: [],
  };

  assertEquals(validateTaskPlan(plan), [
    "exclusive resource conflict in wave w1: a <-> b -> session:s1",
  ]);
});

Deno.test("resource lock rejects double acquisition and releases", () => {
  const locks = new ResourceLockManager();

  assertEquals(locks.acquire("a", ["session:s1"]), true);
  assertEquals(locks.acquire("b", ["session:s1"]), false);
  assertEquals(locks.owner("session:s1"), "a");
  assertEquals(locks.release("a", ["session:s1"]), true);
  assertEquals(locks.isLocked("session:s1"), false);
});

Deno.test("snapshot writer is released after failure", async () => {
  const locks = new ResourceLockManager();
  const a = { ...task("a"), exclusive: ["session:s1"] };
  const b = { ...task("b"), exclusive: ["session:s2"] };

  await assertRejects(
    () => withTaskLocks(locks, a, () => {
      throw new Error("task failed");
    }),
    Error,
    "task failed",
  );

  assertEquals(locks.isLocked("snapshot-writer"), false);
  assertEquals(await withTaskLocks(locks, b, () => "ok"), "ok");
  assertEquals(locks.isLocked("snapshot-writer"), false);
});
