import type { Session, SessionId, SessionSnapshot, EngineId } from "./types.ts";
import { resolveProject } from "./project.ts";
import type { TaskPlan, TaskResult, TaskId, TaskResultStatus } from "./orchestration.ts";
import { validateTaskPlan, readyTasks } from "./orchestration.ts";

export const SESSION_CAP = 8;

export function defaultSessionPath(): string {
  const home = Deno.env.get("OROCHI_HOME") || Deno.env.get("HOME") || ".";
  return `${home}/.orochi/sessions.json`;
}

export class SessionStore {
  #sessions = new Map<SessionId, Session>();
  #plan?: TaskPlan;
  #taskResults = new Map<TaskId, TaskResult>();

  constructor(public readonly path: string) {}

  load(): void {
    try {
      const text = Deno.readTextFileSync(this.path);
      const snap = JSON.parse(text) as SessionSnapshot;
      if (snap.version === 1) {
        for (const s of snap.sessions) {
          if (!s.engine) (s as { engine?: string }).engine = "chatgpt";
          this.#sessions.set(s.id, s);
        }
      }
    } catch {
      // no snapshot yet (or corrupt) -> start empty
    }
  }

  save(): void {
    const snap: SessionSnapshot = {
      version: 1,
      sessions: [...this.#sessions.values()],
    };
    try {
      const dir = this.path.slice(0, this.path.lastIndexOf("/"));
      if (dir) Deno.mkdirSync(dir, { recursive: true });
    } catch {
      // directory may already exist or be unwritable; write still attempts below
    }
    Deno.writeTextFileSync(this.path, JSON.stringify(snap, null, 2));
  }

  list(): Session[] {
    return [...this.#sessions.values()].sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  }

  get(id: SessionId): Session | undefined {
    return this.#sessions.get(id);
  }

  create(url: string, engine: EngineId = "chatgpt"): Session {
    if (this.#sessions.size >= SESSION_CAP) {
      const active = this.list().map((s) => s.id).join(", ");
      throw new Error(`session store full (max ${SESSION_CAP}): active ${active}`);
    }
    const project = resolveProject(url);
    if (!project) throw new Error(`unresolved project URL: ${url}`);
    const id = this.#nextSlot();
    const now = Date.now();
    const session: Session = {
      id,
      project,
      engine,
      status: "active",
      createdAt: now,
      lastActiveAt: now,
    };
    this.#sessions.set(id, session);
    this.save();
    return session;
  }

  close(id: SessionId): boolean {
    const removed = this.#sessions.delete(id);
    if (removed) this.save();
    return removed;
  }

  setBrowser(id: SessionId, tabGroupId: number): Session | undefined {
    const session = this.#sessions.get(id);
    if (!session) return undefined;
    session.tabGroupId = tabGroupId;
    session.status = "active";
    session.lastActiveAt = Date.now();
    this.save();
    return session;
  }

  setPlan(plan: TaskPlan): { ok: boolean; errors?: string[] } {
    const errors = validateTaskPlan(plan);
    if (errors.length > 0) {
      return { ok: false, errors };
    }
    this.#plan = plan;
    this.#taskResults.clear();
    return { ok: true };
  }

  getPlan(): TaskPlan | undefined {
    return this.#plan;
  }

  recordTaskResult(result: TaskResult): void {
    this.#taskResults.set(result.taskId, result);
  }

  getTaskResult(taskId: TaskId): TaskResult | undefined {
    return this.#taskResults.get(taskId);
  }

  getReadyTasks(): TaskId[] {
    if (!this.#plan) return [];
    const statuses = new Map<TaskId, TaskResultStatus>();
    for (const [id, res] of this.#taskResults.entries()) {
      statuses.set(id, res.status);
    }
    return readyTasks(this.#plan, statuses);
  }

  #nextSlot(): SessionId {
    for (let i = 1; i <= SESSION_CAP; i++) {
      const id = `s${i}`;
      if (!this.#sessions.has(id)) return id;
    }
    throw new Error(`session store full (max ${SESSION_CAP})`);
  }
}