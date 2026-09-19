# Orochi PRD

## Product

**Orochi — AI Project Orchestra for the Browser**

Orochi connects the resources of one project and presents them as one operational context.

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
- no credentials are stored in the extension
