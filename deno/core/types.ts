export type Head =
  | "repo" | "issue" | "pr" | "action"
  | "deploy" | "chat" | "data" | "world";

export type ProjectState = "working" | "failed" | "deploying" | "done";

export type Resource = {
  head: Head;
  url: string;
  title?: string;
};

export type Project = {
  id: string;
  repo: string;
  state: ProjectState;
  resources: Resource[];
};

export type Action =
  | { type: "resolve"; url: string }
  | { type: "open"; project: string }
  | { type: "group"; project: string; resourceUrls: string[] };

export type SessionId = string;

export type EngineId = "chatgpt" | "suno";

export type SessionStatus = "active" | "idle";

export type Session = {
  id: SessionId;
  project: Project;
  engine: EngineId;
  status: SessionStatus;
  tabGroupId?: number;
  createdAt: number;
  lastActiveAt: number;
};

export type SessionSnapshot = {
  version: 1;
  sessions: Session[];
};

export type GoalStatus =
  | "collecting"
  | "operating"
  | "publishing"
  | "done"
  | "blocked";

export type Goal = {
  shape: "project-context";
  project: Project;
  heads: Head[];
  status: GoalStatus;
  canonOk: boolean;
};

export type BrowserOp =
  | { kind: "open"; sessionId: string; urls?: string[] }
  | { kind: "group"; sessionId: string }
  | { kind: "focus"; sessionId: string }
  | { kind: "close"; sessionId: string }
  | { kind: "loop"; sessionId: string; prompt: string; engine?: EngineId }
  | { kind: "suno-poc"; sessionId: string; prompt: string };

export type RunId = string;

export type RunStatus =
  | "created"
  | "opening"
  | "auth-check"
  | "submitting"
  | "generating"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled";

export type RunEvent = {
  timestamp: number;
  status: RunStatus;
  detail?: string;
  error?: string;
};

export type SunoRun = {
  id: RunId;
  sessionId: SessionId;
  prompt: string;
  idempotencyKey?: string;
  status: RunStatus;
  clipId?: string;
  clipUrl?: string;
  events: RunEvent[];
  createdAt: number;
  updatedAt: number;
};
