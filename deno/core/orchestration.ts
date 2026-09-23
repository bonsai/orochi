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

  return errors;
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
