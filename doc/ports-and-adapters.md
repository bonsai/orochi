# Orochi Ports & Adapters (Hexagonal Architecture)

## Overview

To enable seamless multi-session automation, decoupled testing, and smooth migration between extension mechanisms (Legacy CRX vs. sync-tabs CRX), Orochi decouples Core runtime orchestration from browser interfaces using a **Ports & Adapters (Hexagonal Architecture)** model.

```text
                   +------------------------+
                   |     Orochi Core        |
                   |   (Session / Task DAG) |
                   +-----------+------------+
                               |
               +---------------+---------------+
               |                               |
        [ BrowserPort ]                 [ EnginePort ]
               |                               |
       +-------+-------+               +-------+-------+
       |               |               |               |
Legacy CRX     sync-tabs CRX      ChatGPT Engine    Suno Engine
Adapter         Adapter            Adapter          Adapter
```

## Ports

### 1. `BrowserPort` (`deno/core/ports.ts`)

Defines the interface for controlling Chrome windows, Chrome Tab Groups, and active session tabs.

- `openSession(session, urls)`: Opens the session's tab group and initial project URLs.
- `groupSession(session)`: Ensures Chrome Tab Group matching `session.id` exists.
- `focusSession(session)`: Brings session tab group to foreground.
- `closeSession(session)`: Closes all tabs in session group.
- `executeOp(session, op, payload)`: Optional extension for engine-specific DOM operations.

### 2. `EnginePort` (`deno/core/ports.ts`)

Defines the interface for domain engines that conduct AI goal execution (e.g., ChatGPT, Suno).

- `id`: Unique identifier (`"chatgpt"` | `"suno"`).
- `name`: Human-readable engine name.
- `targetUrl`: Engine entry URL.
- `run(session, prompt, options)`: Executes a single turn / prompt on the engine session with `runId` and `idempotencyKey` tracking.

## Adapters

### `LegacyCRXBrowserAdapter`

Direct adapter communicating with the current Chrome Extension via background polling queue (`/browser/commands`).

### Future `SyncTabsCRXAdapter`

Next-generation browser adapter utilizing sync-tabs for zero-polling real-time extension synchronization.

## Verification & Isolation

By relying on `BrowserPort` and `EnginePort`, core orchestration unit tests can mock browser operations without requiring live extension connections or full Chrome instances.
