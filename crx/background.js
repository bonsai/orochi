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

// ---- browser ops: CLI / MCP enqueue on the runtime, CRX polls and drains ----

async function pollBrowserOps() {
  try {
    const ops = await api("/browser/commands");
    for (const op of ops) await execBrowserOp(op);
  } catch (error) {
    // runtime down — try again later
  }
  setTimeout(pollBrowserOps, 5000);
}

async function execBrowserOp(op) {
  try {
    const session = await api(`/sessions/${op.sessionId}`);
    switch (op.kind) {
      case "open":
      case "group": {
        const urls = (op.urls && op.urls.length)
          ? op.urls
          : session.project.resources.map((r) => r.url);
        await ensureGroupForSession(session, urls);
        break;
      }
      case "focus": {
        if (session.tabGroupId == null) break;
        const tabs = await chrome.tabs.query({ groupId: session.tabGroupId });
        if (tabs.length) {
          await chrome.tabGroups.update(session.tabGroupId, { collapsed: false });
          await chrome.tabs.update(tabs[0].id, { active: true });
        }
        break;
      }
      case "close": {
        if (session.tabGroupId == null) break;
        const tabs = await chrome.tabs.query({ groupId: session.tabGroupId });
        const ids = tabs.map((t) => t.id).filter((x) => x != null);
        if (ids.length) await chrome.tabs.ungroup(ids);
        break;
      }
    }
  } catch (error) {
    console.error("orochi: browser op failed", error);
  }
}

function hash(url) {
  try { return new URL(url).href; } catch { return null; }
}

async function ensureGroupForSession(session, urls) {
  let groupId = session.tabGroupId;
  const existing = groupId != null
    ? await chrome.tabGroups.get(groupId).catch(() => undefined)
    : undefined;

  if (!existing) {
    const first = await chrome.tabs.create({ url: urls[0], active: true });
    const group = await chrome.tabGroups.create({
      tabIds: [first.id],
      title: session.project.repo
    });
    groupId = group.id;
    await reportSession(session.id, groupId);
    urls = urls.slice(1);
  }

  if (!urls.length) {
    await chrome.tabGroups.update(groupId, { collapsed: false });
    return;
  }

  const tabsInGroup = await chrome.tabs.query({ groupId });
  const open = new Set(tabsInGroup.map((t) => hash(t.url)));
  for (const u of urls) {
    const target = hash(u);
    if (!target || open.has(target)) continue;
    const tab = await chrome.tabs.create({ url: u, active: false });
    await chrome.tabs.group({ tabIds: tab.id, groupId });
    open.add(target);
  }
  await chrome.tabGroups.update(groupId, { collapsed: false });
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
  pollBrowserOps();
});

chrome.runtime.onStartup.addListener(() => {
  checkSetup();
  pollBrowserOps();
});