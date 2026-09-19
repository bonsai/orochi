import { api } from "./http.ts";

const DEFAULT_API = "http://127.0.0.1:8787";

export type Tools = ReturnType<typeof makeTools>;

export function makeTools(apiBase: string) {
  return {
    resolve_project: (url: string) => api(apiBase, "/resolve", "POST", { url }),
    session_open: (url: string) => api(apiBase, "/sessions", "POST", { url }),
    session_list: () => api(apiBase, "/sessions"),
    session_close: (id: string) => api(apiBase, `/sessions/${id}`, "DELETE"),
    session_focus: (id: string) => api(apiBase, `/sessions/${id}`),
    browser_open: (op: { sessionId: string; urls?: string[] }) =>
      api(apiBase, "/browser/commands", "POST", {
        op: { kind: "open", ...op },
      }),
  };
}

export const tools = makeTools(DEFAULT_API);

const MCP_TOOLS = [
  {
    name: "resolve_project",
    description: "Resolve a GitHub URL to a Project.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "session_open",
    description: "Open a new Orochi session (one of up to 8) for a GitHub URL.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "session_list",
    description: "List all sessions held by the local runtime.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "session_close",
    description: "Close a session (frees its slot).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "session_focus",
    description: "Show one session.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "browser_open",
    description: "Tell CRX to open URLs into the session's Tab Group.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        urls: { type: "array", items: { type: "string" } },
      },
      required: ["sessionId"],
    },
  },
];

async function handleMessage(msg: {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
}): Promise<unknown> {
  if (msg.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "orochi-mcp", version: "0.1.0" },
      },
    };
  }

  if (!msg.id) return null; // notification

  if (msg.method === "ping") {
    return { jsonrpc: "2.0", id: msg.id, result: {} };
  }

  if (msg.method === "tools/list") {
    return { jsonrpc: "2.0", id: msg.id, result: { tools: MCP_TOOLS } };
  }

  if (msg.method === "tools/call") {
    const params = (msg.params ?? {}) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    const fn = (tools as Record<string, unknown>)[params.name ?? ""];
    if (typeof fn !== "function") {
      return {
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32602, message: `unknown tool: ${params.name}` },
      };
    }
    try {
      const result = await (fn as (...args: unknown[]) => Promise<unknown>)(
        params.arguments ?? {},
      );
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32000, message: String(error) },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: msg.id,
    error: { code: -32601, message: `method not found: ${msg.method}` },
  };
}

export async function serveStdio() {
  const decoder = new TextDecoder();
  let buf = "";
  const reader = Deno.stdin.readable.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        const out = await handleMessage(JSON.parse(line));
        if (out) {
          Deno.stdout.write(
            new TextEncoder().encode(JSON.stringify(out) + "\n"),
          );
        }
      }
    }
  } catch {
    // stream closed
  }
}

if (import.meta.main) {
  await serveStdio();
}