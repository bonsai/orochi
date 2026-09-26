import type { SessionId, RunId, SunoRun } from "./types.ts";

export type TaskId = string;

export type Task = {
  id: TaskId;
  goal: string;
  lane: string;
  dependsOn: TaskId[];
  paths: string[];
  exclusive: string[];
  outputs: string[];
  doneWhen: string[];
};

export type Wave = {
  id: string;
  tasks: TaskId[];
};

export type Barrier = {
  id: string;
  waveId: string;
  requiresTests?: string[];
  requiresArtifacts?: string[];
  requiresReview?: boolean;
};

export type TaskResultStatus = "completed" | "running" | "blocked" | "failed";

export type TaskResult = {
  taskId: TaskId;
  status: TaskResultStatus;
  outputs?: string[];
  testEvidence?: string[];
  error?: string;
};

export type TaskPlan = {
  tasks: Task[];
  waves: Wave[];
  barriers: Barrier[];
};

export type DependencyState = "pending" | "completed" | "blocked" | "failed";

export function validateTaskPlan(plan: TaskPlan): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const task of plan.tasks) {
    if (ids.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (!task.id || !task.goal || !task.lane) {
      errors.push(`task requires id, goal, lane: ${task.id}`);
    }
  }

  for (const task of plan.tasks) {
    for (const dep of task.dependsOn) {
      if (!ids.has(dep)) errors.push(`unknown dependency: ${task.id} -> ${dep}`);
    }
  }

  for (const wave of plan.waves) {
    for (const taskId of wave.tasks) {
      if (!ids.has(taskId)) errors.push(`unknown task in wave ${wave.id}: ${taskId}`);
    }
  }

  for (const barrier of plan.barriers) {
    if (!plan.waves.some((wave) => wave.id === barrier.waveId)) {
      errors.push(`unknown wave for barrier ${barrier.id}: ${barrier.waveId}`);
    }
  }

  if (errors.length === 0 && plan.tasks.length > 0) {
    const indegree = new Map<TaskId, number>();
    const dependents = new Map<TaskId, TaskId[]>();

    for (const task of plan.tasks) {
      indegree.set(task.id, task.dependsOn.length);
      dependents.set(task.id, []);
    }

    for (const task of plan.tasks) {
      for (const dep of task.dependsOn) {
        dependents.get(dep)!.push(task.id);
      }
    }

    const queue = plan.tasks
      .filter((task) => (indegree.get(task.id) ?? 0) === 0)
      .map((task) => task.id);

    let visited = 0;
    while (queue.length > 0) {
      const id = queue.shift()!;
      visited++;

      for (const dependent of dependents.get(id) ?? []) {
        const next = (indegree.get(dependent) ?? 0) - 1;
        indegree.set(dependent, next);
        if (next === 0) queue.push(dependent);
      }
    }

    if (visited !== plan.tasks.length) {
      errors.push("cyclic dependency detected");
    }
  }

  errors.push(...validateWaveLocks(plan));
  return errors;
}

function pathsOverlap(a: string, b: string): boolean {
  const left = a.replace(/\\/g, "/").replace(/\/+$/, "");
  const right = b.replace(/\\/g, "/").replace(/\/+$/, "");
  return left === right || left.startsWith(right + "/") || right.startsWith(left + "/");
}

export function taskResources(task: Task): string[] {
  return [
    ...task.paths.map((path) => `path:${path}`),
    ...task.exclusive.map((resource) => `exclusive:${resource}`),
  ];
}

export function validateWaveLocks(plan: TaskPlan): string[] {
  const errors: string[] = [];
  const byId = new Map(plan.tasks.map((task) => [task.id, task]));

  for (const wave of plan.waves) {
    const tasks = wave.tasks
      .map((id) => byId.get(id))
      .filter((task): task is Task => task !== undefined);

    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const left = tasks[i];
        const right = tasks[j];

        for (const a of left.paths) {
          for (const b of right.paths) {
            if (pathsOverlap(a, b)) {
              errors.push(`path conflict in wave ${wave.id}: ${left.id} <-> ${right.id}`);
            }
          }
        }

        const resources = new Set(left.exclusive);
        for (const resource of right.exclusive) {
          if (resources.has(resource)) {
            errors.push(
              `exclusive resource conflict in wave ${wave.id}: ${left.id} <-> ${right.id} -> ${resource}`,
            );
          }
        }
      }
    }
  }

  return errors;
}

export class ResourceLockManager {
  #owners = new Map<string, TaskId>();

  acquire(taskId: TaskId, resources: readonly string[]): boolean {
    const unique = [...new Set(resources)];
    for (const resource of unique) {
      const owner = this.#owners.get(resource);
      if (owner !== undefined && owner !== taskId) return false;
    }
    for (const resource of unique) this.#owners.set(resource, taskId);
    return true;
  }

  release(taskId: TaskId, resources: readonly string[]): boolean {
    let released = true;
    for (const resource of new Set(resources)) {
      if (this.#owners.get(resource) === taskId) {
        this.#owners.delete(resource);
      } else {
        released = false;
      }
    }
    return released;
  }

  isLocked(resource: string): boolean {
    return this.#owners.has(resource);
  }

  owner(resource: string): TaskId | undefined {
    return this.#owners.get(resource);
  }
}

export function snapshotWriterResource(): string {
  return "snapshot-writer";
}

export async function withTaskLocks<T>(
  locks: ResourceLockManager,
  task: Task,
  fn: () => Promise<T> | T,
): Promise<T> {
  const resources = [...taskResources(task), snapshotWriterResource()];
  if (!locks.acquire(task.id, resources)) {
    throw new Error(`resource lock unavailable: ${task.id}`);
  }

  try {
    return await fn();
  } finally {
    if (!locks.release(task.id, resources)) {
      throw new Error(`resource lock release failed: ${task.id}`);
    }
  }
}

export function dependencyState(
  task: Task,
  results: ReadonlyMap<TaskId, TaskResultStatus>,
): DependencyState {
  if (task.dependsOn.length === 0) return "completed";

  let pending = false;
  for (const dep of task.dependsOn) {
    const status = results.get(dep);
    if (status === "failed") return "failed";
    if (status === "blocked") return "blocked";
    if (status !== "completed") pending = true;
  }

  return pending ? "pending" : "completed";
}

export function readyTasks(
  plan: TaskPlan,
  results: ReadonlyMap<TaskId, TaskResultStatus>,
): TaskId[] {
  return plan.tasks
    .filter((task) => !results.has(task.id))
    .filter((task) => dependencyState(task, results) === "completed")
    .map((task) => task.id);
}

export function blockedTasks(
  plan: TaskPlan,
  results: ReadonlyMap<TaskId, TaskResultStatus>,
): TaskId[] {
  return plan.tasks
    .filter((task) => !results.has(task.id))
    .filter((task) => {
      const state = dependencyState(task, results);
      return state === "blocked" || state === "failed";
    })
    .map((task) => task.id);
}

export type BarrierEvaluation = {
  barrierId: string;
  waveId: string;
  satisfied: boolean;
  missingTests: string[];
  missingArtifacts: string[];
  pendingTasks: TaskId[];
  failedTasks: TaskId[];
};

export function evaluateBarrier(
  plan: TaskPlan,
  barrier: Barrier,
  results: ReadonlyMap<TaskId, TaskResult>,
): BarrierEvaluation {
  const wave = plan.waves.find((w) => w.id === barrier.waveId);
  if (!wave) {
    return {
      barrierId: barrier.id,
      waveId: barrier.waveId,
      satisfied: false,
      missingTests: barrier.requiresTests ?? [],
      missingArtifacts: barrier.requiresArtifacts ?? [],
      pendingTasks: [],
      failedTasks: [],
    };
  }

  const waveTaskIds = wave.tasks;
  const pendingTasks: TaskId[] = [];
  const failedTasks: TaskId[] = [];
  const providedTests = new Set<string>();
  const providedArtifacts = new Set<string>();

  for (const taskId of waveTaskIds) {
    const res = results.get(taskId);
    if (!res) {
      pendingTasks.push(taskId);
    } else if (res.status === "failed" || res.status === "blocked") {
      failedTasks.push(taskId);
    } else if (res.status === "completed") {
      for (const t of res.testEvidence ?? []) providedTests.add(t);
      for (const o of res.outputs ?? []) providedArtifacts.add(o);
    } else {
      pendingTasks.push(taskId);
    }
  }

  const missingTests = (barrier.requiresTests ?? []).filter(
    (test) => !providedTests.has(test),
  );
  const missingArtifacts = (barrier.requiresArtifacts ?? []).filter(
    (art) => !providedArtifacts.has(art),
  );

  const satisfied =
    pendingTasks.length === 0 &&
    failedTasks.length === 0 &&
    missingTests.length === 0 &&
    missingArtifacts.length === 0;

  return {
    barrierId: barrier.id,
    waveId: barrier.waveId,
    satisfied,
    missingTests,
    missingArtifacts,
    pendingTasks,
    failedTasks,
  };
}

export class SessionMutexManager {
  #activeRuns = new Map<SessionId, RunId>();
  #idempotencyMap = new Map<string, SunoRun>();

  tryAcquire(sessionId: SessionId, runId: RunId): boolean {
    const current = this.#activeRuns.get(sessionId);
    if (current !== undefined && current !== runId) {
      return false;
    }
    this.#activeRuns.set(sessionId, runId);
    return true;
  }

  release(sessionId: SessionId, runId: RunId): boolean {
    if (this.#activeRuns.get(sessionId) === runId) {
      this.#activeRuns.delete(sessionId);
      return true;
    }
    return false;
  }

  getActiveRun(sessionId: SessionId): RunId | undefined {
    return this.#activeRuns.get(sessionId);
  }

  registerRun(run: SunoRun): void {
    if (run.idempotencyKey) {
      this.#idempotencyMap.set(run.idempotencyKey, run);
    }
  }

  getRunByIdempotencyKey(key: string): SunoRun | undefined {
    return this.#idempotencyMap.get(key);
  }
}
