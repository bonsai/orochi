import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
  blockedTasks,
  dependencyState,
  evaluateBarrier,
  readyTasks,
  ResourceLockManager,
  SessionMutexManager,
  validateTaskPlan,
  withTaskLocks,
  type TaskPlan,
  type TaskResult,
} from "./orchestration.ts";
import { LegacyCRXBrowserAdapter } from "./ports.ts";
import { SessionStore } from "./store.ts";

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

Deno.test("SessionMutexManager enforces single active run and tracks idempotency", () => {
  const mutex = new SessionMutexManager();

  assertEquals(mutex.tryAcquire("s1", "run-1"), true);
  assertEquals(mutex.tryAcquire("s1", "run-2"), false);
  assertEquals(mutex.getActiveRun("s1"), "run-1");

  mutex.registerRun({
    id: "run-1",
    sessionId: "s1",
    prompt: "make upbeat jazz track",
    idempotencyKey: "key-123",
    status: "generating",
    events: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const run = mutex.getRunByIdempotencyKey("key-123");
  assertEquals(run?.id, "run-1");
  assertEquals(run?.prompt, "make upbeat jazz track");

  assertEquals(mutex.release("s1", "run-1"), true);
  assertEquals(mutex.getActiveRun("s1"), undefined);
  assertEquals(mutex.tryAcquire("s1", "run-2"), true);
});

Deno.test("evaluateBarrier verifies wave completeness and evidence", () => {
  const plan: TaskPlan = {
    tasks: [task("a"), task("b")],
    waves: [{ id: "w1", tasks: ["a", "b"] }],
    barriers: [{
      id: "b1",
      waveId: "w1",
      requiresTests: ["test-suite-1"],
      requiresArtifacts: ["clip-url"],
    }],
  };

  const resultsPartial = new Map<string, TaskResult>([
    ["a", { taskId: "a", status: "completed", testEvidence: ["test-suite-1"] }],
  ]);

  const evalPartial = evaluateBarrier(plan, plan.barriers[0], resultsPartial);
  assertEquals(evalPartial.satisfied, false);
  assertEquals(evalPartial.pendingTasks, ["b"]);
  assertEquals(evalPartial.missingArtifacts, ["clip-url"]);

  const resultsComplete = new Map<string, TaskResult>([
    ["a", { taskId: "a", status: "completed", testEvidence: ["test-suite-1"] }],
    ["b", { taskId: "b", status: "completed", outputs: ["clip-url"] }],
  ]);

  const evalComplete = evaluateBarrier(plan, plan.barriers[0], resultsComplete);
  assertEquals(evalComplete.satisfied, true);
  assertEquals(evalComplete.missingTests, []);
  assertEquals(evalComplete.missingArtifacts, []);
});

Deno.test("SessionStore setPlan and getReadyTasks lifecycle", () => {
  const store = new SessionStore(":memory:");
  const plan: TaskPlan = {
    tasks: [task("a"), { ...task("b"), dependsOn: ["a"] }],
    waves: [{ id: "w1", tasks: ["a"] }, { id: "w2", tasks: ["b"] }],
    barriers: [],
  };

  const setRes = store.setPlan(plan);
  assertEquals(setRes.ok, true);
  assertEquals(store.getReadyTasks(), ["a"]);

  store.recordTaskResult({ taskId: "a", status: "completed" });
  assertEquals(store.getReadyTasks(), ["b"]);
});

Deno.test("LegacyCRXBrowserAdapter queues commands via BrowserPort", async () => {
  const adapter = new LegacyCRXBrowserAdapter();
  const dummySession = {
    id: "s1",
    project: { id: "p1", repo: "owner/repo", state: "working" as const, resources: [] },
    engine: "suno" as const,
    status: "active" as const,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  await adapter.openSession(dummySession, ["https://suno.com/create"]);
  await adapter.groupSession(dummySession);

  const cmds = adapter.pendingCommands;
  assertEquals(cmds.length, 2);
  assertEquals(cmds[0], { sessionId: "s1", action: "open", urls: ["https://suno.com/create"] });
  assertEquals(cmds[1], { sessionId: "s1", action: "group" });
});
