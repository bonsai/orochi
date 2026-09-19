// Orochi ChatGPT Loop Engine — core
// Drives a logged-in ChatGPT session over HTTP and loops one Goal to completion.

const CHATGPT = "https://chatgpt.com/backend-api";

// NOTE: the backend-api payload is not a public contract. Mirror what the
// browser sends and adjust after live testing (model, conversation_mode,
// parent_message_id, etc.).
export async function sendPrompt(messages) {
  const res = await fetch(`${CHATGPT}/conversation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "next",
      messages,
      parent_message_id: crypto.randomUUID(),
      model: "gpt-5-mini", // placeholder
      timezone_offset_min: -new Date().getTimezoneOffset(),
      force_paragen: false,
      conversation_mode: { kind: "primary_assistant" }
    })
  });
  if (!res.ok) throw new Error(`chatgpt http ${res.status}`);
  return readSse(res);
}

function readSse(res) {
  return new Promise((resolve, reject) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let parsed = "";
    (function pump() {
      reader.read().then(({ done, value }) => {
        if (done) return resolve(parsed);
        text += decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        text = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (!payload.trim()) continue;
          try {
            const evt = JSON.parse(payload);
            const content =
              evt?.message?.content?.parts?.join?.("\n") ??
              evt?.message?.content ?? "";
            if (content) parsed += content;
          } catch {
            // partial JSON chunk, ignore
          }
        }
        pump();
      }).catch(reject);
    })();
  });
}

// One Goal = one Loop. Messages are kept per session (s1..s8).
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
    this.messages.push({ role: "assistant", content: { types: ["text"], text: text || "" } });
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