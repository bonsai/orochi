import { resolveProject } from "./core/project.ts";

Deno.serve({ port: 8787 }, async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/health") {
    return Response.json({ ok: true, service: "orochi" });
  }

  if (url.pathname === "/resolve" && req.method === "POST") {
    const body = await req.json();
    return Response.json(resolveProject(body.url ?? ""));
  }

  return new Response("Not Found", { status: 404 });
});
