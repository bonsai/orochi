/** Transport-neutral browser CLI adapters. No cookies or auth material is persisted. */
export type BrowserBackend = "cdp" | "ws" | "crx";

export type BrowserTarget = { id: string; type?: string; title?: string; url?: string; webSocketDebuggerUrl?: string };

export function browserBackend(value: string | undefined): BrowserBackend {
  const backend = (value ?? Deno.env.get("OROCHI_BROWSER") ?? "cdp").toLowerCase();
  if (backend !== "cdp" && backend !== "ws" && backend !== "crx") {
    throw new Error(`unsupported browser backend: ${backend}; choose cdp, ws, or crx`);
  }
  return backend;
}

export class CdpClient {
  #socket: WebSocket;
  #nextId = 1;
  #pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  #targets: BrowserTarget[];

  private constructor(socket: WebSocket, targets: BrowserTarget[]) {
    this.#socket = socket;
    this.#targets = targets;
    socket.addEventListener("message", (event) => {
      let message: { id?: number; result?: unknown; error?: { message?: string } };
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message.id == null) return;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "CDP command failed"));
      else pending.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const pending of this.#pending.values()) pending.reject(new Error("CDP WebSocket closed"));
      this.#pending.clear();
    });
  }

  static async connect(): Promise<CdpClient> {
    const endpoint = Deno.env.get("OROCHI_CDP_HTTP") ?? "http://127.0.0.1:9222";
    const response = await fetch(new URL("/json", endpoint));
    if (!response.ok) throw new Error(`CDP discovery failed: HTTP ${response.status}; start Chrome with remote debugging enabled`);
    const targets = await response.json() as BrowserTarget[];
    const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
    if (!target?.webSocketDebuggerUrl) throw new Error("No debuggable Chrome page found");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Could not connect to Chrome CDP WebSocket")), { once: true });
    });
    return new CdpClient(socket, targets);
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.#nextId++;
    return await new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }) as {
      result?: { value?: unknown; description?: string }; exceptionDetails?: { text?: string };
    };
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "page evaluation failed");
    return result.result?.value ?? result.result?.description ?? null;
  }

  targets(): BrowserTarget[] { return this.#targets; }
  close(): void { this.#socket.close(); }
}

export class WsBridgeClient {
  #socket: WebSocket;
  #nextId = 1;
  #pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.addEventListener("message", (event) => {
      let message: { id?: number; result?: unknown; error?: string | { message?: string } };
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message.id == null) return;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(typeof message.error === "string" ? message.error : message.error.message ?? "WS bridge error"));
      else pending.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const pending of this.#pending.values()) pending.reject(new Error("WS bridge disconnected; action outcome may be unknown"));
      this.#pending.clear();
    });
  }

  static async connect(): Promise<WsBridgeClient> {
    const endpoint = Deno.env.get("OROCHI_WS_URL");
    if (!endpoint) throw new Error("Set OROCHI_WS_URL to the WebSocket bridge endpoint");
    const socket = new WebSocket(endpoint);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Could not connect to OROCHI_WS_URL")), { once: true });
    });
    return new WsBridgeClient(socket);
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.#nextId++;
    return await new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void { this.#socket.close(); }
}
