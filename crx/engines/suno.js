// Engine: suno.com — music generation via content script DOM automation.
// Domain-specific driver: run_* walks the page through crx/suno-content.js.

function sunoTab(session) {
  const q = session.tabGroupId != null
    ? { groupId: session.tabGroupId }
    : undefined;
  return chrome.tabs.query(q ?? {}).then((tabs) =>
    tabs.find((t) => /suno\.com/.test(t.url ?? ""))
  );
}

function waitTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 8000); // never wait on a tab that never completes
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runSuno(session, prompt) {
  let tab = await sunoTab(session);
  if (!tab) {
    tab = await chrome.tabs.create({ url: "https://suno.com/create", active: false });
    await waitTabComplete(tab.id);
  }
  const detail = tab.url ?? "";
  for (let i = 0; i < 5; i++) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { op: "suno:run", prompt });
      if (!resp || !resp.status) return { ok: false, status: "no-response", detail };
      return { ok: resp.ok, status: resp.status, detail: resp.detail ?? detail };
    } catch (err) {
      await sleep(1500); // content script may still be injecting
      if (i === 4) {
        return { ok: false, status: "content-script-unreachable", detail: `${detail} — ${String(err)}` };
      }
    }
  }
}

export const sunoEngine = {
  name: "Suno",
  url: "https://suno.com",
  async run(session, prompt) {
    return runSuno(session, prompt);
  }
};