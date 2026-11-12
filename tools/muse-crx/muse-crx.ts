#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * muse-crx CLI — controller side of the muse-crx bridge.
 *
 * Sends ONE CDP command to the muse-crx Chrome extension via the bridge
 * (see bonsai/muse-crx for the extension and the protocol) and waits for
 * the result. The extension is approval-only: the command runs only after
 * the user approves it in the extension popup, so this CLI may block
 * until approval, rejection, or timeout.
 *
 * Usage:
 *   deno run --allow-net --allow-env tools/muse-crx/muse-crx.ts tabs
 *   deno run --allow-net --allow-env tools/muse-crx/muse-crx.ts eval <tabId> <expression> [--summary <text>]
 *   deno run --allow-net --allow-env tools/muse-crx/muse-crx.ts send <method> [paramsJson] [--tab <id>] [--summary <text>]
 *
 * Env:
 *   MUSE_CRX_BRIDGE   bridge controller URL (default ws://127.0.0.1:8765/ctl)
 *   MUSE_CRX_TIMEOUT  seconds to wait for a result (default 300)
 *
 * Exit codes: 0 = ok, 1 = command error / rejected, 2 = usage / timeout / connection
 */

type Frame = { id: string; ok?: boolean; result?: unknown; error?: string };

const bridgeUrl = Deno.env.get("MUSE_CRX_BRIDGE") ?? "ws://127.0.0.1:8765/ctl";
const timeoutSec = Number(Deno.env.get("MUSE_CRX_TIMEOUT") ?? "300");

function usage(): never {
  console.error("usage: muse-crx.ts tabs | eval <tabId> <expr> [--summary s] | send <method> [paramsJson] [--tab id] [--summary s]");
  Deno.exit(2);
}

function parseFlags(args: string[]): { rest: string[]; tab?: number; summary?: string } {
  const rest: string[] = [];
  let tab: number | undefined;
  let summary: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tab") tab = Number(args[++i]);
    else if (args[i] === "--summary") summary = args[++i];
    else rest.push(args[i]);
  }
  return { rest, tab, summary };
}

function buildCommand(args: string[]): { tabId?: number; method: string; params: Record<string, unknown>; summary: string } {
  const { rest, tab, summary } = parseFlags(args);
  const [sub, ...tail] = rest;
  switch (sub) {
    case "tabs":
      return { method: "Tabs.list", params: {}, summary: summary ?? "タブ一覧を取得" };
    case "eval": {
      const tabId = Number(tail[0]);
      const expression = tail[1];
      if (!Number.isFinite(tabId) || !expression) usage();
      return {
        tabId,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true },
        summary: summary ?? `タブ ${tabId} で JS を評価: ${expression.slice(0, 80)}`,
      };
    }
    case "send": {
      const method = tail[0];
      if (!method) usage();
      let params: Record<string, unknown> = {};
      if (tail[1]) {
        try { params = JSON.parse(tail[1]); } catch { console.error("paramsJson is not valid JSON"); Deno.exit(2); }
      }
      return { tabId: tab, method, params, summary: summary ?? method };
    }
    default:
      usage();
  }
}

async function main() {
  const cmd = buildCommand(Deno.args);
  const id = crypto.randomUUID();
  const ws = new WebSocket(bridgeUrl);

  const done = new Promise<Frame>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutSec}s (approval pending? )`)), timeoutSec * 1000);
    ws.onmessage = (ev) => {
      let frame: Frame;
      try { frame = JSON.parse(String(ev.data)); } catch { return; }
      if (frame.id !== id) return;
      clearTimeout(timer);
      resolve(frame);
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("websocket error")); };
    ws.onopen = () => {
      console.error(`[muse-crx] sent: ${cmd.summary} — waiting for approval in the extension popup…`);
      ws.send(JSON.stringify({ id, ...cmd }));
    };
  });

  try {
    const frame = await done;
    if (frame.ok) {
      console.log(JSON.stringify(frame.result ?? null, null, 2));
      Deno.exit(0);
    } else {
      console.error(`[muse-crx] error: ${frame.error ?? "unknown"}`);
      Deno.exit(1);
    }
  } catch (e) {
    console.error(`[muse-crx] ${e instanceof Error ? e.message : String(e)}`);
    Deno.exit(2);
  } finally {
    try { ws.close(); } catch { /* ignore */ }
  }
}

await main();
