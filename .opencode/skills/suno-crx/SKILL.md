---
name: suno-crx
description: Run and diagnose one authenticated Suno generation through the Orochi Chrome extension, local runtime, CLI, or MCP.
license: MIT
compatibility: opencode
metadata:
  project: bonsai/orochi
  priority: P0
  workflow: suno-single-run
---

# Suno CRX

## Purpose

Use this skill when the task requires operating Suno through Orochi's Chrome extension. The target is one observable run from prompt submission to a clip URL or a structured failure. Do not broaden the task into a ChatGPT loop, GitHub write operation, or multi-head orchestration unless the user explicitly asks for it.

## Operating boundary

- The Chrome extension owns Suno DOM interaction.
- The local Deno runtime owns sessions, commands, run state, and results.
- OpenCode coordinates the run and reports the evidence.
- Never place GitHub tokens, cookies, or other secrets in CRX storage or in a prompt.
- Treat Suno DOM selectors and internal APIs as unstable. Prefer the existing content-script adapter over page scripts or direct undocumented API calls.

## Preconditions

Before starting a run, check all of the following:

1. The Orochi runtime is running on `127.0.0.1:8787`.
2. The Orochi CRX is loaded in the Chrome profile used for the task.
3. The same Chrome profile is logged in to Suno.
4. The requested prompt is explicit and does not contain credentials.
5. There is an available session slot, preferably a session whose engine is `suno`.

If the profile is not logged in, stop with `auth-required`. Do not retry authentication indefinitely and do not ask the user to paste cookies or tokens.

## Preferred workflow

Use the CLI for a human-readable run. Use MCP only when the caller already has the Orochi MCP server configured.

```sh
# Resolve the local runtime first.
curl -fsS http://127.0.0.1:8787/health

# Create a Suno session if one does not already exist.
 deno run --allow-net --allow-env deno/cli.ts session open https://suno.com suno

# Open the Suno create page in the session's group.
 deno run --allow-net --allow-env deno/cli.ts browser open <session-id> https://suno.com/create

# Run one prompt.
 deno run --allow-net --allow-env deno/cli.ts loop run <session-id> "<prompt>"

# Inspect the CRX report.
 deno run --allow-net --allow-env deno/cli.ts debug logs
```

When the repository's command wrapper is available, use `orochi` instead of the direct Deno command.

## Expected run evidence

A successful run must include:

- the `sessionId`;
- a `runId` once run lifecycle support is available;
- an auth check showing the profile is authenticated;
- a submission event that occurs once;
- a generating or equivalent progress event;
- a completed event;
- a clip URL or clip ID.

A log line saying only `loop submitted` is not sufficient evidence of successful generation.

## Failure handling

Map failures to one of these outcomes:

| Outcome | Meaning | Next action |
|---|---|---|
| `auth-required` | Suno asks for login or the session cannot be verified | Tell the user to log in in the connected Chrome profile, then stop |
| `content-script-unreachable` | The Suno content script cannot receive the command | Check extension reload, tab URL, and page readiness |
| `selector-failed` | The page changed or a required control was not found | Capture diagnostics and update the adapter, not the skill workflow |
| `timeout` | The bounded wait expired | Report elapsed time and current state; do not submit again automatically |
| `tab-closed` | The managed tab disappeared | Re-open the create page only after confirming that no active run exists |
| `generation-failed` | Suno reported a generation failure | Return the visible error and preserve the run event |

Do not hide a failure by treating it as an empty successful result. Do not perform an automatic second Generate click unless the runtime explicitly marks the first attempt as not submitted.

## Implementation guidance

When changing the implementation:

1. Keep Suno selectors in `crx/suno-content.js` or a dedicated adapter.
2. Keep orchestration and retry policy in `crx/engines/suno.js`.
3. Keep persistence and event validation in `deno/`.
4. Add a test for every state transition and failure classification.
5. Prefer structured results over log-message parsing.
6. Keep the manual acceptance path documented in `gap.md` and the refresh roadmap.

## Parallel planning

When the user gives more than one Suno or Orochi task, do not execute the list as an unstructured batch. First act as a planner and convert the request into a small task DAG.

Each task must state its `id`, `goal`, `lane`, `dependsOn`, `paths`, `exclusive` resources, `outputs`, and `doneWhen` conditions. Put tasks with no dependency into the same wave only when their paths and exclusive resources do not overlap.

Use these lanes:

- `crx`: content script, background, and DOM adapter work.
- `runtime`: Deno API, Session, Run, snapshot, and validation work.
- `test`: fixtures, integration tests, and acceptance evidence.
- `review`: conflict, security, and completion checks.
- `integrator`: connect the CRX and runtime outputs after a barrier.

The first Suno wave should normally look like this:

```text
Wave 0: validate runtime/CLI/MCP boundaries
    ↓
Wave 1: tab binding + auth state + readiness + run types + test fixtures
    ↓
Wave 2: submit + polling + result extraction + diagnostics
    ↓
Wave 3: run API + event persistence + CRX reporting + MCP status
    ↓
Wave 4: one-profile manual acceptance and review
```

Code work may be parallelized across disjoint files, but browser work is serialized per Session. Never run two Generate operations in the same Suno Session. Treat the Session, Tab Group, snapshot writer, and shared source file as exclusive resources. The initial worker cap is three, even though the runtime supports up to eight logical Sessions.

At each barrier, verify tests, artifacts, and unresolved dependencies before dispatching the next wave. If one task is `auth-required`, `selector-failed`, or `blocked`, do not silently retry dependent tasks. Return the dependency and the one concrete action needed to unblock it.

For a planned run, report:

```text
Goal: <goal>
Plan: <task count> tasks / <wave count> waves
Completed: <task ids>
Running: <task ids>
Blocked: <task ids and dependency>
Failed: <task ids and reason>
Evidence: <tests, logs, clip URL/ID>
Next: <one concrete action>
```

## Completion report

Report the result in this form:

```text
Suno CRX run: <completed|auth-required|timeout|failed>
Session: <session-id>
Run: <run-id or unavailable>
Prompt submitted: <yes|no|unknown>
Clip: <url/id or unavailable>
Evidence: <key runtime/CRX events>
Next action: <single concrete action>
```

Never claim completion when only the create page was opened or when authentication was detected but no generation result was observed.
