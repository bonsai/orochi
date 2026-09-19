// Engine: chatgpt.com — logged-in ChatGPT over backend-api (HTTP SSE).
// Domain-specific driver: how to submit a prompt and read the answer.

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

function chatThen(prompt) {
  return [{
    role: "user",
    content: [{ type: "text", text: prompt }]
  }];
}

export const chatgptEngine = {
  name: "ChatGPT",
  url: "https://chatgpt.com",
  async run(_session, prompt) {
    const text = await sendPrompt(chatThen(prompt));
    return { ok: true, status: "answered", text };
  }
};