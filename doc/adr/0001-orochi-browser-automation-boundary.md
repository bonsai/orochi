# ADR-0001: Orochi owns browser automation; clients integrate through versioned contracts

- Status: Accepted
- Date: 2026-10-17
- Decision owners: Orochi maintainers

## Context

Browser automation capabilities are spread across Orochi, crx-cli, CRX adapters, and service-specific projects such as sunomono. Reimplementing browser sessions, command transport, job state, retries, and event reporting in each client would create duplicated behavior and inconsistent safety guarantees.

Orochi already has a Core with `BrowserPort` and `EnginePort` abstractions and a Suno prompt-injection PoC. Existing WS Bridge, sync-tabs, and crx-cli behavior must be inspected before choosing a transport or migrating code.

## Decision

1. **Orochi is the shared browser-automation and orchestration platform.** It owns session/job lifecycle, state transitions, run identifiers, idempotency, timeout/unknown-result handling, orchestration, and normalized events/results.
2. **BrowserPort owns browser mechanics.** Tabs, Tab Groups, page targeting, generic DOM execution, extension transport, reconnect behavior, and browser-level observations belong behind adapters. Orochi Core must not depend on one concrete CRX or bridge implementation.
3. **EnginePort owns service-specific browser workflows.** Suno, ChatGPT, Gemini, and other services implement their own engine adapters. Service selectors, prompt semantics, submission steps, and service-specific completion observations must not leak into BrowserPort or Core.
4. **Client projects remain loosely coupled.** sunomono is a client/workflow package for prompt curation, music-generation policy, recording orchestration, and song/audio metadata. It calls Orochi through a versioned job/event contract or supported CLI/API/MCP interface; it must not import Orochi internal modules or duplicate browser/session state management.
5. **CRX and WS Bridge are replaceable transport adapters.** Reuse the existing protocol after inventory; do not invent endpoints or migrate/replace a working adapter without tests and a reversible plan.
6. **GitHub is the source of truth for prompts and durable specifications/results.** Local Agent/Orochi executes live browser jobs. GitHub Actions handles deterministic CI, schema validation, tests, and packaging—not live logged-in browser automation.
7. **Recording remains a separate, explicit capability.** The user must initiate/authorize recording. Store audio in the selected local workspace; publish metadata/manifests only by default, never audio bytes or credentials. Do not store Suno cookies/session credentials in CRX, Orochi state, or GitHub.
8. **Uncertain outcomes are first-class states.** A timeout after possible submission must become an unknown/pending-reconciliation state, not a blind retry that could generate duplicates.

## Responsibilities

| Component | Owns | Must not own |
|---|---|---|
| Orochi Core | Jobs, sessions, state machine, orchestration, idempotency, normalized events | Suno-specific selectors or music business rules |
| BrowserPort adapters | Browser/CRX/WS Bridge transport, tabs, generic page operations | Service-specific prompt semantics |
| EnginePort adapters | Service-specific workflow and observable outcomes | Global job persistence or generic session orchestration |
| sunomono | Prompt catalog/workflow, music metadata, recording workflow, result curation | Independent browser command queue/session state |
| GitHub | Versioned prompts/contracts, issues, code, CI, result manifests | Logged-in browser execution or raw local audio storage |
| Local Workspace / Recorder | User-authorized audio capture and local files | Hidden or unconditional recording |

## Contract requirements

- Version every cross-project job/request/event/result contract.
- Include `job_id`, `run_id`, `engine_id`, `contract_version`, and an idempotency key where applicable.
- Use explicit states such as queued, running, awaiting_user, succeeded, failed, and unknown/reconciliation_required; the implementation may refine names in the schema.
- Emit success only for outcomes actually observed by the adapter.
- Keep secrets out of payloads, logs, manifests, and browser extension storage.
- Provide mock adapters and contract tests so the Core and clients can be tested without a live browser.

## Consequences

### Positive
- Browser automation and orchestration are implemented once and reused across clients.
- Service workflows can evolve independently behind EnginePort.
- WS Bridge/CRX implementations can be replaced without rewriting sunomono.
- Shared mock and contract tests improve reliability and make duplicate actions less likely.

### Costs and risks
- A stable versioned contract and compatibility policy must be maintained.
- The initial inventory may reveal duplicated or conflicting implementations requiring staged migration.
- Live browser behavior still requires local integration tests; mocks cannot prove Suno UI compatibility.

## Migration plan

1. Inventory Orochi, crx-cli, WS Bridge/sync-tabs, and sunomono; document actual commands, endpoints, auth, events, and existing tests.
2. Define the smallest versioned job/event/result contract and fixtures.
3. Adapt Orochi Core and BrowserPort/EnginePort through the existing confirmed transport.
4. Make sunomono consume the public contract; retain its domain workflow and recording policy.
5. Run mock/contract tests and a user-confirmed local Suno smoke test.
6. Remove duplicated paths only after parity is verified and a rollback path is documented.

## Rejected alternatives

- **Move all sunomono code into Orochi:** rejected because music workflow and recording policy are a separate domain and would couple the platform to one client.
- **Let each client implement its own browser automation:** rejected because it duplicates sessions, transport, retries, and safety behavior.
- **Hard-couple sunomono to Orochi internals:** rejected because internal refactors would break clients and make independent releases difficult.
- **Choose a new bridge before inventory:** rejected because it risks duplicating or breaking an existing working transport.
