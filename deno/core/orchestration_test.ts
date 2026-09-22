import { assertEquals } from "jsr:@std/assert";
import { validateTaskPlan, type TaskPlan } from "./orchestration.ts";

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
