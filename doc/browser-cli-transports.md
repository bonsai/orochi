# Browser CLI transports

Orochi's CLI selects the browser transport explicitly with `--via`. The default
is CDP; the selector keeps the client workflow independent of the transport.

## CDP — direct Chrome DevTools Protocol

Start a local Chrome/Chromium instance with remote debugging enabled, then set
`OROCHI_CDP_HTTP` if its discovery endpoint is not `http://127.0.0.1:9222`.

```sh
deno task cli browser --via cdp tabs
deno task cli browser --via cdp url
deno task cli browser --via cdp eval 'document.title'
deno task cli browser --via cdp navigate https://github.com/bonsai/orochi
```

The current adapter connects to the first debuggable page target. CDP access
should remain bound to a local, trusted browser; do not expose the debugging
port to a public network.

## CRX — logged-in Chrome profile

Start the Orochi runtime (`deno task dev`) and enable the Orochi extension in
the Chrome profile that is already logged in. CRX commands enqueue operations
for the extension to execute using its existing session/group model.

```sh
deno task cli browser --via crx open s1 https://github.com/bonsai/orochi
deno task cli browser --via crx focus s1
deno task cli browser --via crx close s1
```

A session must already exist (`deno task cli session open https://github.com/bonsai/orochi`).
This adapter intentionally does not accept or store cookies/passwords.

## WS — an existing WebSocket bridge

Set `OROCHI_WS_URL` to the bridge's WebSocket URL. The adapter sends a
request envelope `{"id":1,"method":"tabs.list","params":{}}` and expects a
response with the same `id`, plus `result` or `error`. Method names are
bridge-defined; this generic envelope is not a claim that every existing bridge
already implements these methods.

```sh
OROCHI_WS_URL=ws://127.0.0.1:8788 deno task cli browser --via ws tabs.list
deno task cli browser --via ws page.evaluate '{"expression":"document.title"}'
```

## Safety and failure semantics

- No credentials, cookies, or local-storage values are printed or persisted by
  these adapters.
- A dropped WebSocket during an action can leave the outcome unknown; inspect
  the browser state before retrying.
- Browser-side page evaluation is powerful. Run only trusted expressions.
