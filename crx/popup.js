const list = document.querySelector("#sessions");
const input = document.querySelector("#url");
const status = document.querySelector("#status");
const API = "http://127.0.0.1:8787";

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function render() {
  let sessions;
  try {
    sessions = await api("/sessions");
  } catch (error) {
    status.textContent = "Orochi API is not running. Start it with: deno task dev";
    return;
  }
  status.textContent = `local runtime ready — ${sessions.length}/8 sessions`;
  list.textContent = "";

  for (const s of sessions) {
    const li = document.createElement("li");
    const repo = document.createElement("span");
    repo.className = "repo";
    repo.textContent = `${s.id} ${s.project.repo} [${s.status}]` +
      (s.tabGroupId != null ? ` #${s.tabGroupId}` : "");
    const focus = document.createElement("button");
    focus.textContent = "Focus";
    focus.onclick = async () => {
      if (s.tabGroupId == null) return;
      const tabs = await chrome.tabs.query({ groupId: s.tabGroupId });
      if (tabs.length) await chrome.tabs.update(tabs[0].id, { active: true });
      window.close();
    };
    const close = document.createElement("button");
    close.textContent = "Close";
    close.onclick = async () => {
      await api(`/sessions/${s.id}`, { method: "DELETE" });
      render();
    };
    li.append(repo, focus, close);
    list.append(li);
  }
}

document.querySelector("#open").onclick = async () => {
  const url = input.value.trim();
  if (!url) return;
  try {
    await api("/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
  } catch (error) {
    status.textContent = `error: ${error}`;
  }
  input.value = "";
  render();
};

render();