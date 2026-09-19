import { resolveProject } from "./core/project.ts";

export const tools = {
  resolve_project: (url: string) => resolveProject(url)
};
