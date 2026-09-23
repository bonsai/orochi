import type { Session, EngineId } from "./types.ts";

export type BrowserCommandResult = {
  ok: boolean;
  tabGroupId?: number;
  detail?: string;
};

export interface BrowserPort {
  openSession(session: Session, urls?: string[]): Promise<BrowserCommandResult>;
  groupSession(session: Session): Promise<BrowserCommandResult>;
  focusSession(session: Session): Promise<BrowserCommandResult>;
  closeSession(session: Session): Promise<BrowserCommandResult>;
  executeOp?(session: Session, op: string, payload: unknown): Promise<BrowserCommandResult>;
}

export type EngineRunOptions = {
  runId?: string;
  idempotencyKey?: string;
};

export type EngineRunResult = {
  ok: boolean;
  status: string;
  detail?: string;
  clipId?: string;
  clipUrl?: string;
};

export interface EnginePort {
  readonly id: EngineId;
  readonly name: string;
  readonly targetUrl: string;
  run(session: Session, prompt: string, options?: EngineRunOptions): Promise<EngineRunResult>;
}

export class LegacyCRXBrowserAdapter implements BrowserPort {
  #commandQueue: Array<{ sessionId: string; action: string; urls?: string[] }> = [];

  async openSession(session: Session, urls?: string[]): Promise<BrowserCommandResult> {
    this.#commandQueue.push({ sessionId: session.id, action: "open", urls });
    return { ok: true, tabGroupId: session.tabGroupId };
  }

  async groupSession(session: Session): Promise<BrowserCommandResult> {
    this.#commandQueue.push({ sessionId: session.id, action: "group" });
    return { ok: true, tabGroupId: session.tabGroupId };
  }

  async focusSession(session: Session): Promise<BrowserCommandResult> {
    this.#commandQueue.push({ sessionId: session.id, action: "focus" });
    return { ok: true, tabGroupId: session.tabGroupId };
  }

  async closeSession(session: Session): Promise<BrowserCommandResult> {
    this.#commandQueue.push({ sessionId: session.id, action: "close" });
    return { ok: true };
  }

  get pendingCommands() {
    return [...this.#commandQueue];
  }

  clearCommands(): void {
    this.#commandQueue = [];
  }
}
