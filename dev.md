# Orochi Development

## Branch strategy

- `main) = canon
- Issue = work unit
- `feat/*` = short-lived implementation branch
- PR = integration point
- Merge → delete branch

For the current MVP/POC, use one branch:

`feat/mvp-poc`

Do not create one branch per Orochi head. The eight heads are Core concepts, not branch boundaries.

## MVP/POC flow

```text
Issue #1
  ↓
feat/mvp-poc
  ↓
Core
  ↓
CRX / CLI / API / SDK / MCP
  ↓
PR
  ↓
main
```

## First through-line

**1 Project = 1 browser context**

The same Project State should be usable from every interface:

- CRX — browser / tab group
- CLI — terminal
- API — HTTP
- SDK — TypeScript
- MCP — AI agent

## Eight heads

1. Repo
2. Issue
3. PR
4. Action
5. Deploy
6. Chat
7. Data
8. World

These are resource/view concepts in the Core. They do not imply eight branches.

## Runtime

Use **TypeScript + Deno** as the development/runtime baseline.

Avoid introducing Node-specific infrastructure unless a concrete interface requires it.

## Development order

1. Solidify Core types
2. Resolve the active GitHub project
3. Open/group browser resources through CRX
4. Expose the same operations through CLI
5. Expose the same operations through API
6. Expose the same Core actions through MCP
7. Add SDK as the reusable TypeScript interface
8. Add persistence and AI orchestration after the POC loop works

## Canon principle

GitHub is canon.

Orochi is the orchestra that connects and projects the project context; it should not become a second source of truth.

## Commit / PR rule

Keep changes small and reversible.

Prefer:

```text
Issue → branch → small commits → PR → merge → delete branch
```

over long-lived branches or large speculative implementations.
