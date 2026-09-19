# Orochi PRD

## Product

**Orochi — AI Project Orchestra for the Browser**

Orochi connects the resources of one project and presents them as one operational context.

Orochi is the browser-projected integration of the terminal/agent/pipeline tools the
developer already uses:

| tool family | what Orochi takes from it |
|---|---|
| tmux / herdr | parallel, persistent session & workspace management (up to 8 sessions) |
| takt | agent orchestration (plan → implement → review → fix) |
| aw | goal-shaped pipelines that run to completion from one command |

CLI / CRX / MCP expose the same Core, so the session, orchestration and goal layers are
usable from the terminal (tmux·herdr) as well as the browser (CRX).

## Problem

A project is distributed across:

- GitHub repositories
- Issues
- Pull Requests
- Actions
- Deployments
- Chat / ChatGPT
- Data
- World / surrounding context

People repeatedly search, open, and organize these resources manually.

## Core idea

**1 Project = 1 browser context**

Orochi resolves a project from the current context and orchestrates its resources.

GitHub remains the canon. Orochi is the orchestra.

## Goal shape

Orochi pursues one goal shape (**ゴールの型**):

```text
collect   combine the 8 heads of a project into one operational context
operate   act on them through DOM + Web API, conductor = AI
return    land results back on GitHub (Issue / PR / Action / Deploy) → done
```

```ts
type Goal = {
  shape: "project-context";
  project: Project;
  heads: Head[];
  status: "collecting" | "operating" | "publishing" | "done" | "blocked";
  canonOk: boolean;
};
```

Completion means the project's context converged (up to 8 parallel sessions) and the
result is recorded in the canon, not that a chat conversation finished.

## Users

- developers
- AI-assisted developers
- agents operating development workflows
- project researchers

## MVP

Given a GitHub project URL:

1. Resolve the Project.
2. Discover canonical resources.
3. Build a Project State.
4. Open relevant resources.
5. Create or update one Chrome Tab Group.
6. Expose the same operation through CLI, API, and MCP.

## Interfaces

| Interface | Role |
|---|---|
| CRX | browser projection |
| CLI | human / agent terminal control |
| API | local HTTP boundary |
| SDK | reusable TypeScript interface |
| MCP | AI agent boundary |

## Eight heads

1. Repo
2. Issue
3. PR
4. Action
5. Deploy
6. Chat
7. Data
8. World

Heads are Core concepts, not separate products.

## Non-goals for MVP

- persistent database
- advanced autonomous planning
- production-grade multi-user auth
- complex synchronization
- full implementation of all eight heads

## Technical constraints

- TypeScript
- Deno
- GitHub as canon
- credentials stay outside CRX
- shared Core model across interfaces

## Acceptance criteria

The POC is complete when:

- a GitHub URL resolves to one Project
- the Project exposes its canonical resources
- CRX can create/update the project Tab Group
- CLI can resolve the same Project
- API can resolve the same Project
- MCP can invoke the same Core operation
- a Goal advances to `done` (result recorded on GitHub) from CRX, CLI, or MCP
- up to 8 sessions run in parallel and share the same runtime
- no credentials are stored in the extension
