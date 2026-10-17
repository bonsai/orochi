# 企画書：Orochi MCP / WebSocket Browser Bridge

- Status: Proposal
- Date: 2026-10-17
- Repository: bonsai/orochi
- Related: [#57 Browser Bridge](https://github.com/bonsai/orochi/issues/57), [#58 Bridgeの価値定義](https://github.com/bonsai/orochi/issues/58), [#61 Browser Automation Core](https://github.com/bonsai/orochi/issues/61), [#62 共通契約](https://github.com/bonsai/orochi/issues/62), [#63 sunomono接続](https://github.com/bonsai/orochi/issues/63)

## 1. Executive summary

**Orochi MCP** is a browser-automation gateway that lets AI agents and developer tools operate services through the user's existing browser session when a suitable official API is absent, unavailable, or insufficient for the required workflow.

It combines three separate concerns:

- **MCP:** a standard tool interface for MCP-compatible agents and clients.
- **Orochi Core:** job/session orchestration, policy checks, state transitions, timeouts, idempotency, and normalized results.
- **WebSocket Browser Bridge + CRX:** transport and browser-side execution in the user's authenticated browser.

MCP is not the WebSocket protocol, and the WebSocket connection is not itself the automation policy. Keeping these boundaries separate makes the system reusable across clients, browsers, and service adapters.

Working name: **Orochi** for the platform and **orochi-mcp** for its MCP server/package/entry point. The existing Orochi project remains the product home; do not create a separate platform solely for the MCP adapter.

## 2. Problem

AI agents are often limited by the available integration surface:

- A service has no public API.
- Its API does not expose the UI feature the user needs.
- An API requires a separate permission or plan not available to the user.
- The user's existing work, context, and authentication already live in the browser.
- Different services expose different interfaces, creating one-off integrations.

This creates fragmented workflows: copy/paste between an AI chat, a browser tool, a local script, and a repository. A service-specific automation script also tends to break when its DOM changes.

## 3. Product goal

Offer a reusable, auditable interface for **user-authorized browser operations** so agents can read and interact with supported web UIs without requiring a dedicated official API for every action.

Example target services:

- **Suno Web:** select a GitHub-managed prompt, fill the UI, request user confirmation before generation, observe visible generation state, and coordinate explicitly authorized recording.
- **ChatGPT Web:** read a user-selected conversation/answer and pass selected context into a development workflow; write or submit only under configured permissions.
- **Gemini / Claude Web:** add service adapters behind the same contract, subject to compatibility and service terms.
- **GitHub Web / developer tools:** support UI workflows where a direct GitHub API is not appropriate or does not cover the action. Prefer the official GitHub API when it fully satisfies the requirement.

These are candidate adapters, not a promise that every service or every action is already supported.

## 4. Product principles

1. **API-first, browser-when-needed.** Prefer documented official APIs when they provide the needed capability. Use browser automation only for the gaps.
2. **User session, user control.** Operate through the user's already-open and authorized browser session; do not collect or export service passwords, cookies, or session tokens.
3. **No security or access-control bypass.** Do not bypass login, MFA, CAPTCHA, paywalls, or service restrictions. Respect service terms, applicable policies, rate limits, and user permissions.
4. **Explicit confirmation for consequential actions.** Actions such as generating content, sending messages, publishing, deleting, purchasing, or starting a recording require an appropriate confirmation/policy gate.
5. **Observe before claiming success.** A command acknowledgement is not proof that a UI action succeeded. Report only outcomes actually observed.
6. **Idempotent orchestration.** A timeout after a possibly completed action becomes an unknown/reconciliation state; never blindly resubmit a potentially costly or duplicative action.
7. **Adapters isolate change.** Service-specific selectors and UI quirks stay in service adapters, not in Orochi Core.
8. **Local-first secrets and artifacts.** Keep credentials out of CRX storage, logs, contracts, GitHub issues, and result manifests. Keep raw audio and other large private artifacts in a user-selected local workspace unless the user explicitly chooses another destination.

## 5. Proposed architecture

    MCP client / AI agent / CLI
                |
           MCP interface
        (tools + typed schemas)
                |
           Orochi Core
     jobs / sessions / policy / state machine
     idempotency / timeouts / normalized events
                |
           BrowserPort
                |
      Local runtime / WebSocket Bridge
                |
            Orochi CRX
     tab routing / permission gate / messaging
                |
       Service-specific UI adapter
       ├── Suno Web
       ├── ChatGPT Web
       ├── Gemini Web
       ├── Claude Web
       └── other supported web UIs

A separate local HTTP endpoint may be retained where an existing implementation already uses it, but it must be inventoried and protected before reuse. The transport can evolve without changing the MCP tool contract.

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| MCP server (orochi-mcp) | Expose typed tools/resources/prompts where useful; validate arguments; return structured results |
| Orochi Core | Authorize actions, orchestrate jobs/sessions, track state, handle timeouts/idempotency, normalize events |
| BrowserPort | Abstract tab selection, messaging, read/type/submit/wait/observe, and transport |
| WebSocket Bridge | Carry validated requests and responses between local runtime and CRX |
| CRX | Route requests to a user-approved tab and adapter; enforce browser-side checks; never store long-lived secrets |
| Service adapter / EnginePort | Service-specific DOM selectors, page observations, and supported workflows |
| Domain client (e.g. sunomono) | Domain rules, prompt catalogs, music metadata, recording policy; no duplicate browser session manager |
| GitHub | Source of truth for versioned specs, prompt files, code, tests, and safe result manifests |

## 6. Naming decision

- **Platform:** Orochi
- **MCP server/package:** orochi-mcp
- **Browser transport:** Orochi WebSocket Browser Bridge
- **Browser extension:** Orochi CRX
- **Service-specific integration:** EnginePort adapter (e.g. Suno Engine)

Do not call the entire system “WebSocket MCP”: MCP is the agent-facing interface; WebSocket is one internal transport. The package name orochi-mcp is appropriate if the implementation is a distinct MCP entry point, while the architecture and user-facing product remain Orochi.

## 7. Initial MVP

### P0 — inventory and contract

- [ ] Inspect the existing suno-gen/bridge implementation, especially bridge/overlay/src/bridge/api-handler.ts, before creating a replacement.
- [ ] Inventory Orochi Core, CRX, crx-cli, sync-tabs, current WebSocket messages, authentication/local origin protections, and test coverage.
- [ ] Define versioned request/event/result schemas and fixtures.
- [ ] Define tool permission tiers: observe, prepare/type, submit/side-effect, record/export.
- [ ] Define a consistent error model, including timeout and unknown outcome.

### P1 — one safe read path and one prepared write path

- [ ] Expose a minimal MCP tool to list eligible tabs and inspect a selected tab's supported state.
- [ ] Expose a read/observe tool for a supported adapter.
- [ ] Expose a prepare/type operation that does not submit by default.
- [ ] Require an explicit confirmation path before submit or other consequential side effects.
- [ ] Add mock transport and adapter contract tests.

### P2 — prove two different use cases

- [ ] ChatGPT Web → selected response/context → Orochi → local development workflow.
- [ ] GitHub-managed Suno prompt → Suno prompt field → user confirmation → observed generation state.
- [ ] Keep recording a separate user-authorized action, reusing the existing recorder where feasible.
- [ ] Add a result manifest containing safe metadata and references to local artifacts, not raw audio.

### P3 — generalize

- [ ] Add Gemini/Claude adapters only after the adapter contract is stable.
- [ ] Add a capability registry so clients can discover supported operations and required confirmation.
- [ ] Document adapter compatibility checks and DOM-change diagnostics.

## 8. Initial MCP tool shape (conceptual)

The following names are examples for planning, not claims about an existing implementation. Final names and schemas must be reviewed against current Orochi APIs and MCP conventions.

- browser.list_tabs — list eligible tabs without exposing cookies or tokens.
- browser.inspect — return a bounded, sanitized view of the selected page.
- browser.observe — wait for a supported, observable state change.
- browser.prepare_input — populate a supported input field without submitting.
- browser.request_action — create a pending action requiring confirmation where applicable.
- browser.confirm_action — execute a previously prepared action after validating its target, expiry, and policy.
- browser.get_job — inspect job status and result.
- browser.cancel_job — cancel when cancellation is actually supported.

Every tool must use typed input/output schemas, enforce tab/origin allowlists, bound content size, redact sensitive data, and report whether a result is observed, inferred, or unknown.

## 9. Security and reliability

- Bind the local bridge to loopback by default; do not expose it publicly without a separate threat model and authenticated design.
- Authenticate and authorize local runtime ↔ CRX messages; validate origin, tab identity, message type, size, and schema.
- Restrict operations by configured origin/adapter/capability allowlists.
- Do not provide arbitrary unrestricted JavaScript execution as a general-purpose MCP tool.
- Keep GitHub credentials in the local runtime or an approved credential manager, never in extension storage or browser messages.
- Never return cookies, authorization headers, password fields, or hidden authentication state.
- Sanitize logs and page content; treat page text as untrusted data, not as instructions to the agent or bridge.
- Prevent confused-deputy behavior: page content must not be able to authorize its own side effects.
- Apply timeouts, rate limits, bounded retries, job IDs, idempotency keys, and unknown-outcome reconciliation.
- Use mocks and contract tests in CI; run live browser tests only in an explicitly configured local environment.
- Respect service terms, user permissions, and privacy requirements; browser UI availability does not imply permission to automate every action.

## 10. Success metrics

- A new service adapter can be added without changing Orochi Core or MCP schemas.
- At least one read-only workflow and one confirmation-gated write workflow pass end-to-end tests.
- Every accepted command has a traceable job/run ID and a terminal or explicitly unknown state.
- A transport replacement does not require domain clients to import transport internals.
- No secrets appear in test fixtures, logs, or manifests.
- Duplicate costly side effects caused by blind retry are prevented in tested timeout scenarios.
- Adapter failures identify the affected service-specific capability rather than silently reporting success.

## 11. Non-goals

- Reimplementing every official API.
- Calling undocumented private service endpoints as a shortcut.
- Bypassing authentication, access controls, CAPTCHA, or service restrictions.
- Unattended, unrestricted control of every browser tab.
- Guaranteeing permanent compatibility with third-party DOM structures.
- Moving all domain-specific code from sunomono or other clients into Orochi Core.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Third-party UI/DOM changes | Adapter isolation, smoke tests, capability health status |
| Accidental duplicate submit/generation | Confirmation gates, idempotency, unknown-outcome reconciliation |
| Prompt injection through page content | Treat page content as untrusted data; policy gates outside page DOM |
| Local WebSocket bridge misuse | Loopback binding, message authentication, origin/tab allowlists, schema validation |
| MCP client differences | Standard MCP schemas, contract tests, minimal stable tools |
| Scope expands to too many sites | Start with ChatGPT read/context transfer and Suno prepare/confirm flow |
| Existing bridge functionality is duplicated | Reuse and generalize the verified suno-gen/bridge boundary |

## 13. Decision requested

Approve the direction:

> Orochi is the shared orchestration and browser-automation platform. orochi-mcp is its MCP-facing adapter. The WebSocket Browser Bridge connects the local runtime to CRX. Service-specific EnginePort adapters cover UI capabilities that are absent or insufficient in official APIs, under explicit user authorization and service-compatible operation.

Implementation begins with inventory and contracts, then a minimal read-only flow, then a confirmation-gated write flow. No existing bridge is replaced until parity and rollback are demonstrated.
