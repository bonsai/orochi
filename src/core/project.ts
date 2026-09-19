import type { Project } from "./types.ts";

export function resolveProject(url: string): Project | null {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) return null;

  const repo = match[1].replace(/[#?].*$/, "");
  return {
    id: repo,
    repo,
    state: "working",
    resources: [{ head: "repo", url: `https://github.com/${repo}` }]
  };
}
