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

  return errors;
}
