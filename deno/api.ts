import { resolveProject } from "./core/project.ts";
import { SessionStore, defaultSessionPath } from "./core/store.ts";
import type { BrowserOp } from "./core/types.ts";

const port = Number(Deno.env.get("OROCHI_PORT") || 8787);
const store = new SessionStore(defaultSessionPath());
store.load();

// Browser operation queue: CLI / MCP enqueue, CRX polls and drains.
const browserOps: BrowserOp[] = [];

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "orochi",
        sessions: store.list().length,
      });
    }

    if (url.pathname === "/resolve" && req.method === "POST") {
      const body = await req.json();
      return Response.json(resolveProject(body.url ?? ""));
    }

    if (url.pathname === "/sessions" && req.method === "GET") {
      return Response.json(store.list());
    }

    if (url.pathname === "/sessions" && req.method === "POST") {
      const body = await req.json();
      const session = store.create(body.url ?? "");
      return Response.json(session, { status: 201 });
    }

    if (parts[0] === "browser" && parts[1] === "commands") {
      if (req.method === "POST") {
        const body = await req.json();
        const op = body.op ?? body;
        if (!op || !op.kind || !op.sessionId) {
          return jsonError(400, "invalid browser op");
        }
        if (!store.get(op.sessionId)) {
          return jsonError(404, "session not found");
        }
        browserOps.push(op as BrowserOp);
        return Response.json({ ok: true, queued: browserOps.length });
      }
      if (req.method === "GET") {
        return Response.json(browserOps.splice(0));
      }
    }

    if (parts[0] === "sessions" && parts.length >= 2) {
      const id = parts[1];

      if (req.method === "GET") {
        const session = store.get(id);
        return session
          ? Response.json(session)
          : jsonError(404, "session not found");
      }

      if (req.method === "DELETE") {
        return store.close(id)
          ? Response.json({ ok: true })
          : jsonError(404, "session not found");
      }

      if (req.method === "POST" && parts[2] === "browser") {
        const body = await req.json();
        const session = store.setBrowser(id, Number(body.tabGroupId));
        return session
          ? Response.json(session)
          : jsonError(404, "session not found");
      }
    }

    return jsonError(404, "not found");
  } catch (err) {
    return jsonError(400, String(err));
  }
});

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}