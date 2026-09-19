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
- MCP session tools (API-backed)
- CRX Tab Group creation/update per session + popup session list

Not implemented yet:
- persistent state beyond snapshot
- GitHub API integration
- Chrome Tab Groups auto-restore across browser restart
- authentication
- real MCP transport
- AI conductor
- Actions/deploy state detection
