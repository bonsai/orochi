# Orochi MVP / POC

## MVP

The smallest useful loop:

1. Browser tab contains a GitHub repository URL.
2. Orochi resolves the project.
3. Project resources are represented by one shared Core model.
4. CRX groups browser tabs by project.
5. CLI/API/MCP expose the same operations.

## POC boundary

Implemented skeleton:
- TypeScript
- Deno
- Core types
- GitHub URL → Project resolver
- CLI
- local HTTP API
- MCP boundary
- CRX boundary

Implemented:
- Session store (max 8 slots, `session open/ls/close/focus`)
- JSON snapshot restore (`$HOME/.orochi/sessions.json`)
- CLI as local runtime client (shared sessions)
- MCP session tools (API-backed) + real stdio JSON-RPC transport
- CRX Tab Group creation/update per session + popup session list
- Browser ops from CLI/MCP: runtime command queue drained by CRX (`open/group/focus/close`)
- Loop engines split per domain (`crx/engines/chatgpt.js`, `crx/engines/suno.js` + `suno-content.js`), `engine` attr on sessions, `loop run` op
- CRX → runtime execution reports (`/debug/log`, `orochi debug logs`)
- MV3 real facts: `chrome.tabGroups.*` unusable in service worker (use `chrome.tabs.group/ungroup`); setTimeout chains die (use `chrome.alarms`)
- Cross-interface consistency test (`deno task test`): CLI / MCP / CRX-queue on the same session

Live-verified (fresh Chrome profile):
- `orochi browser open s1 <urls>` → group created (`tabGroupId` persisted to runtime)
- `orochi loop run s2 <prompt>` (suno) → content script reached suno.com, detected auth wall
- `orochi loop run s1 <prompt>` (chatgpt) → backend-api dispatched (401 without login, expected)

Not implemented yet:
- ChatGPT/Suno loop generation against a **logged-in** browser (backend-api payload tuning, music actually created)
- loop ↔ runtime(gh) action delegation
- persistent state beyond snapshot
- GitHub API integration
- Chrome Tab Groups auto-restore across browser restart
- authentication
- AI conductor beyond the loop engines
- Actions/deploy state detection
