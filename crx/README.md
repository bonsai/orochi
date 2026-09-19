# Orochi CRX

Chrome Extension skeleton for Orochi.

## POC responsibilities

- detect the active tab
- resolve its Project
- create/update a Chrome Tab Group
- open project resources
- check the local Orochi API automatically

## Automatic setup

The CRX does **not** create or store a GitHub personal access token.

Authentication belongs to the local runtime. The intended setup is:

```text
GitHub authentication
        ↓
local runtime / gh
        ↓
Orochi API :8787
        ↓
CRX
```

This keeps GitHub credentials out of the extension.

### Recommended authentication

Use GitHub CLI authentication on the machine running Orochi:

```bash
gh auth login
gh auth status
```

For automation, use the runtime's existing GitHub credentials rather than putting a PAT into CRX storage.

If a PAT is required for a specific local runtime, keep it in the runtime secret store/environment and never in extension storage, source code, or URLs.

**Do not paste a token into the CRX or into chat.**

## Extension permissions

The MVP requests only:

- `tabs`
- `tabGroups`
- `storage`

and access to the local Orochi API plus GitHub pages.

## First-run behavior

1. Install the extension.
2. Orochi checks `127.0.0.1:8787/health`.
3. If the API is available, the extension reports ready.
4. If unavailable, the setup page tells the user to start the local runtime.
5. GitHub authentication is verified by the runtime, not by CRX.

## Security principle

**CRX is a browser projection, not a credential vault.**

GitHub is canon; the local Orochi runtime is the authenticated boundary.
