// MCP skeleton.
// The first POC exposes the same Core operations used by CLI/API.
// Wire this module to an MCP SDK when the transport boundary is fixed.

import { resolveProject } from "./core/project.ts";

export const tools = {
  resolve_project: (url: string) => resolveProject(url)
};
