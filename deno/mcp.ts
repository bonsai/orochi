const API = "http://127.0.0.1:8787";

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body !== undefined
      ? { "content-type": "application/json" }
      : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export const tools = {
  resolve_project: (url: string) => call("POST", "/resolve", { url }),
  session_open: (url: string) => call("POST", "/sessions", { url }),
  session_list: () => call("GET", "/sessions"),
  session_close: (id: string) => call("DELETE", `/sessions/${id}`),
  session_focus: (id: string) => call("GET", `/sessions/${id}`),
  browser_open: (op: { sessionId: string; urls?: string[] }) =>
    call("POST", "/browser/commands", { op: { kind: "open", ...op } }),
};