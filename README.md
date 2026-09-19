# Orochi

**AI Project Orchestra for the Browser**

Orochi integrates the qualities of tmux/herdr (parallel sessions), takt (agent
orchestration) and aw (goal-shaped automation) into one **Project Context** in the
browser. Up to 8 sessions run in parallel across CLI, CRX and MCP on the same runtime.

> **Eight heads. One project state. One goal shape: collect → operate → return.**

## Idea

A project is not only a repository.

It is a working context containing:

- GitHub repository
- Issues
- Pull requests
- Actions and workflow runs
- Deployments and GitHub Pages
- ChatGPT conversations
- data and dashboards
- other project resources

Orochi turns that context into browser **Tab Groups** (one per session, up to 8 parallel)
and lets humans and agents operate on the same project.

> **Eight heads. One project state. One goal shape: collect → operate → return.**

## Architecture

Orochi uses one TypeScript/Deno core with several interfaces:

```text
                    OROCHI
              AI Project Orchestra
                       │
          ┌────────────┼────────────┐
          │            │            │
         CRX          CLI          API
          │            │            │
          └──────── SDK / MCP ──────┘
                       │
                     Core
                       │
        Project / Resource / State / Action
                       │
          GitHub / ChatGPT / Deploy / Data
```

### Interfaces

| Interface | Role |
|---|---|
| **CRX** | Browser control: tabs, groups, project context |
| **CLI** | Human and agent terminal interface |
| **API** | HTTP interface for external systems |
| **SDK** | TypeScript interface for applications |
| **MCP** | Agent interface and tool surface |
| **Core** | Shared project/state/action model |

## Eight Heads

The Orochi metaphor represents multiple views of one project:

1. **Repo** — source and repository state
2. **Issue** — problems and work
3. **PR** — changes and review
4. **Action** — automation and workflow runs
5. **Deploy** — deployed state and Pages
6. **Chat** — AI conversations
7. **Data** — datasets and dashboards
8. **World** — the surrounding project context

The heads are views, not separate products. They observe and act on the same project state.

## Project-centered browser flow

```text
Current browser tab
        ↓
     Resolver
        ↓
      Project
        ↓
     Tab Group
        ├── Repo
        ├── Issues
        ├── PR
        ├── Actions
        ├── Deploy
        ├── Chat
        ├── Data
        └── World
```

A ChatGPT conversation, GitHub Actions page, or deployment page can therefore belong to the same project rather than becoming an unrelated browser tab.

## Runtime

Orochi is intentionally **TypeScript + Deno**.

- one language
- one runtime
- shared types
- CLI, API, SDK, MCP and Core in the same ecosystem
- CRX as the browser-facing surface

Node.js/NVM/VLT are not required by the Orochi architecture.

## Principles

### GitHub is canon

GitHub remains the source of truth for repository, issue, PR, workflow, and deployment state.

### Core is canon

CRX, CLI, API, SDK and MCP are interfaces to the same Orochi Core rather than independent implementations.

### Browser is a projection

A Chrome Tab Group is a projection of project state, not the canonical database.

### AI is conductor

AI resolves project context, observes state, suggests actions, and coordinates the available interfaces.

### Credentials stay out of CRX

Secrets and GitHub authentication should be handled by the local/runtime layer rather than stored directly in the browser extension.

## MVP

1. Detect the current GitHub project.
2. Resolve related project resources.
3. Create/update a Chrome Tab Group.
4. Open Repo / Issue / PR / Actions / Deploy / Chat together.
5. Expose the same operations through CLI and MCP.
6. Keep project state shared across all interfaces.

## Status

Early architecture / MVP.

Repository: https://github.com/bonsai/orochi
