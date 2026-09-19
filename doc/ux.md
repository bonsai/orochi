# Orochi UX

## UX principle

**The project is the unit of attention, not the tab.**

Users should not need to remember where each project resource lives.

## Primary experience

```text
Current tab
   ↓
Project detection
   ↓
Project context
   ↓
Heads / resources
   ↓
One Tab Group
```

## Default interaction

1. User opens or focuses a project resource.
2. Orochi recognizes the project.
3. Orochi shows the project context.
4. User opens the desired head/resource.
5. Orochi keeps the project resources together.

The browser is a projection of Project State.

## Tab Group

One project should map to one logical Chrome Tab Group.

Example:

```text
Orochi / bonsai/orochi
├── Repo
├── Issues
├── PR
├── Actions
├── Deploy
├── Chat
├── Data
└── World
```

Only resources that exist or are relevant need to be opened.

## AI behavior

AI acts as a **conductor**, not the source of truth.

It may:

- resolve context
- suggest resources
- open resources
- organize tabs
- propose actions
- summarize current state

It should not silently alter canonical project data.

## Interface consistency

CRX, CLI, API, SDK, and MCP should express the same Core concepts.

Different interfaces change the interaction surface, not the meaning.

## Error UX

Errors should identify:

1. project
2. requested action
3. failed resource/interface
4. recoverable next action

Prefer actionable errors over raw stack traces.

## Progressive disclosure

Default UI stays small.

Show:

- current project
- current state
- relevant heads
- next useful actions

Advanced diagnostics can expose raw Project State, resolver details, and interface errors.

## Privacy / security UX

Credentials and tokens are never managed by the CRX UI.

Authentication belongs to the runtime / local environment.

## UX success

A user should be able to answer:

**「いま、このプロジェクトで何を見ればいい？」**

without manually reconstructing the project from many tabs.
