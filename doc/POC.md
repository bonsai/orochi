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

Not implemented yet:
- persistent state
- GitHub API integration
- Chrome Tab Groups API
- authentication
- real MCP transport
- AI conductor
- Actions/deploy state detection
