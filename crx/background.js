const API = "http://127.0.0.1:8787";

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function checkSetup() {
  try {
    const response = await fetch(API + "/health");
    if (!response.ok) throw new Error("Orochi API unavailable");
    const health = await response.json();
    await chrome.storage.local.set({
      orochi: { api: API, ready: true, health }
    });
  } catch (error) {
    await chrome.storage.local.set({
      orochi: { api: API, ready: false, error: String(error) }
    });
  }
}

function repoFromUrl(url) {
  const m = url && url.match(/github\.com\/([^/]+\/[^/?#]+)/);
  return m ? m[1].replace(/[#?].*$/, "") : null;
}

async function ensureSession(repo) {
  const sessions = await api("/sessions");
  const existing = sessions.find((s) => s.project && s.project.repo === repo);
  if (existing) return existing;
  return api("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: `https://github.com/${repo}` })
  });
}

async function reportSession(id, tabGroupId) {
  return api(`/sessions/${id}/browser`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tabGroupId })
  });
}

async function syncTabGroup(tabId, repo) {
  let session;
  try {
    session = await ensureSession(repo);
  } catch (err) {
    console.error("orochi: ensure session failed", err);
    return;
  }

  try {
    let groupId = session.tabGroupId;
    if (groupId != null) {
      const group = await chrome.tabGroups.get(groupId).catch(() => undefined);
      if (group) {
        await chrome.tabs.group({ tabIds: tabId, groupId });
        await chrome.tabGroups.update(groupId, { collapsed: false });
        return;
      }
    }
    const created = await chrome.tabGroups.create({
      tabIds: [tabId],
      title: repo
    });
    groupId = created.id;
    session = await reportSession(session.id, groupId);
    console.log("orochi: tab group created for", repo, "#" + groupId);
  } catch (err) {
    console.error("orochi: tab group sync failed", err);
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.url) {
    const repo = repoFromUrl(tab.url);
    if (repo) syncTabGroup(tabId, repo);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!tab || !tab.url) return;
  const repo = repoFromUrl(tab.url);
  if (repo) syncTabGroup(tabId, repo);
});

chrome.runtime.onInstalled.addListener(() => {
  checkSetup();
});

chrome.runtime.onStartup.addListener(() => {
  checkSetup();
});