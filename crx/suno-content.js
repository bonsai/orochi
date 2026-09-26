// Orochi content script for suno.com — drives the create page on behalf of
// the background service worker (service workers have no page DOM access).
// Best-effort selectors; reports exactly what it found so the loop can adapt.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.op === "suno:inject-poc") {
    sendResponse(injectPromptOnly(msg.prompt));
    return false;
  }
  if (msg?.op !== "suno:run") return;
  (async () => sendResponse(await runInPage(msg.prompt)))();
  return true; // async response keepalive
});

function injectPromptOnly(prompt) {
  const signIn = authWall();
  if (signIn) return { ok: false, status: "auth-required", detail: `auth wall: "${signIn}" — suno.com にログインが必要` };
  const box = findPromptBox();
  if (!box) return { ok: false, status: "selector-failed", detail: "prompt box not found" };
  if (!setNativeValue(box, prompt)) return { ok: false, status: "selector-failed", detail: "prompt box is not writable" };
  return { ok: true, status: "prompt-injected", detail: `${location.pathname} (generate button was not clicked)` };
}

function visibleText(el) {
  return (el.textContent ?? "").trim().toLowerCase();
}

function authWall() {
  const buttons = [...document.querySelectorAll("button")];
  const hit = buttons.find((b) => {
    const t = visibleText(b);
    return t === "sign in" || t === "create account" || t === "log in";
  });
  return hit ? hit.textContent.trim() : null;
}

function findPromptBox() {
  const selectors = [
    "textarea[placeholder]",
    "textarea",
    '[contenteditable="true"]',
    "div[aria-label]"
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function findCreateButton() {
  const buttons = [...document.querySelectorAll("button")];
  const like = (t) => /create|generate|make music/.test(t) && t.length < 24;
  return (
    buttons.find((b) => like(visibleText(b))) ?? null
  );
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else if (el.isContentEditable) el.textContent = value;
  else return false;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

async function runInPage(prompt) {
  const signIn = authWall();
  if (signIn) {
    return {
      ok: false,
      status: "needs-auth",
      detail: `auth wall: "${signIn}" — suno.com にログインが必要`
    };
  }

  const box = findPromptBox();
  if (!box) {
    return { ok: false, status: "no-prompt-box", detail: location.href };
  }

  setNativeValue(box, prompt);

  const btn = findCreateButton();
  if (!btn) {
    return { ok: false, status: "no-create-button", detail: "prompt set but no create button" };
  }
  btn.click();
  return { ok: true, status: "submitted", detail: `${location.pathname} (clicked "${visibleText(btn)}")` };
}
