// Orochi Loop — engine registry.
// One Goal = one loop step through the session's engine.
// Engines are domain-specific drivers under crx/engines/:
//   chatgpt.js : chatgpt.com  (backend-api, HTTP SSE)
//   suno.js    : suno.com     (content script DOM automation)
// Sessions s1..s8 run these engines in parallel, each in its own Tab Group.

import { chatgptEngine } from "./engines/chatgpt.js";
import { sunoEngine } from "./engines/suno.js";

export const ENGINES = { chatgpt: chatgptEngine, suno: sunoEngine };

// One loop step for a session, dispatched to its domain engine.
export async function runGoal(session, prompt) {
  const engine = ENGINES[session.engine] ?? ENGINES.chatgpt;
  const outcome = await engine.run(session, prompt);
  return {
    engine: session.engine,
    status: outcome.status,
    detail: outcome.detail ?? "",
    text: outcome.text ?? "",
    gotText: !!outcome.text
  };
}

// ---- legacy chatgpt-only Loop class (kept for direct use) ----
import { sendPrompt } from "./engines/chatgpt.js";

export class Loop {
  constructor({ sessionId, messages = [], log = [] }) {
    this.sessionId = sessionId;
    this.messages = messages;
    this.log = log;
    this.stopped = false;
  }

  async step() {
    if (this.stopped) return { done: true, reason: "stopped" };
    const text = await sendPrompt(this.messages);
    this.messages.push({
      role: "assistant",
      content: { types: ["text"], text: text || "" }
    });
    this.log.push({ at: Date.now(), step: this.messages.length, text });
    return { done: false, text };
  }

  async run({ maxSteps = 8 } = {}) {
    let steps = 0;
    while (!this.stopped && steps < maxSteps) {
      const out = await this.step();
      if (out.done) return out;
      if (isBlocked(out.text)) return { done: true, reason: "blocked" };
      if (isGoalDone(out.text)) return { done: true, reason: "goal-done" };
      steps += 1;
    }
    return { done: this.stopped, reason: this.stopped ? "stopped" : "max-steps" };
  }

  stop() {
    this.stopped = true;
  }
}

function isGoalDone(text) {
  return /\[done\]|DONE|完了(した|しました)/.test(text || "");
}

function isBlocked(text) {
  return /\[blocked\]|BLOCKED|対応できません|詳細が必要/.test(text || "");
}