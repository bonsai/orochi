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
