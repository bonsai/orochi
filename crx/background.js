const API = "http://127.0.0.1:8787";

import { injectSunoPrompt, runGoal } from "./loop.js";

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function logFromCrx(level, message, from = "crx") {
  try {
    await api("/debug/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, level, message })
    });
  } catch {}
}

async function checkSetup() {
  try {
    const response = await fetch(API + "/health");
    if (!response.ok) throw new Error("Orochi API unavailable");
    const health = await response.json();
    await chrome.storage.local.set({ orochi: { api: API, ready: true, health } });
  } catch (error) {
    await chrome.storage.local.set({ orochi: { api: API, ready: false, error: String(error) } });
  }
}

function repoFromUrl(url) {
  const m = url && url.match(/github\\.com\\/([^/]+\\/[^/?#]+)/);
  return m ? m[1].replace(/[#?].*$/, "") : null;
}
async function ensureSession(repo) {
  const sessions = await api("/sessions");
  const existing = sessions.find((s) => s.project && s.project.repo === repo);
  if (existing) return existing;
  return api("/sessions", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({url:`https://github.com/${repo}`}) });
}
async function reportSession(id, tabGroupId) {
  return api(`/sessions/${id}/browser`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({tabGroupId}) });
}
const POLL_PERIOD_MIN = 0.5;
async function pollBrowserOps() {
  try { const ops = await api("/browser/commands"); for (const op of ops) await execBrowserOp(op); } catch {}
}
async function wakePolling() { await checkSetup(); await pollBrowserOps(); }
function schedulePolling() { chrome.alarms.create("orochi-poll", {periodInMinutes:POLL_PERIOD_MIN}); wakePolling(); }

async function execBrowserOp(op) {
  try {
    const session = await api(`/sessions/${op.sessionId}`);
    switch (op.kind) {
      case "open":
      case "group": {
        const urls = (op.urls && op.urls.length) ? op.urls : session.project.resources.map((r) => r.url);
        await ensureGroupForSession(session, urls);
        await logFromCrx("info", `${op.kind} ${op.sessionId} → group ok`);
        break;
      }
      case "focus": {
        if (session.tabGroupId == null) break;
        const tabs = await chrome.tabs.query({groupId:session.tabGroupId});
        if (tabs.length) await chrome.tabs.update(tabs[0].id, {active:true});
        await logFromCrx("info", `focus ${op.sessionId} ok`);
        break;
      }
      case "close": {
        if (session.tabGroupId == null) break;
        const tabs = await chrome.tabs.query({groupId:session.tabGroupId});
        const ids = tabs.map(t=>t.id).filter(x=>x!=null);
        if (ids.length) await chrome.tabs.ungroup(ids);
        await logFromCrx("info", `close ${op.sessionId} ok`);
        break;
      }
      case "loop": {
        const outcome = await runGoal(session, op.prompt);
        await logFromCrx(outcome.status==="submitted"||outcome.gotText?"info":"warn", `${op.sessionId} loop(${outcome.engine}) → ${outcome.status}${outcome.detail?" — "+outcome.detail:""}${outcome.text?" — "+outcome.text.slice(0,120):""}`);
        break;
      }
      case "suno-poc": {
        const outcome = await injectSunoPrompt(session, op.prompt);
        await logFromCrx(outcome.ok?"info":"warn", `${op.sessionId} suno-poc → ${outcome.status}${outcome.detail?" — "+outcome.detail:""}`);
        break;
      }
    }
  } catch (error) {
    console.error("orochi: browser op failed", error);
    await logFromCrx("error", `op ${op.kind} ${op.sessionId} failed: ${String(error)}`);
  }
}
function hash(url) { try { return new URL(url).href; } catch { return null; } }
async function ensureGroupForSession(session, urls) {
  let groupId = session.tabGroupId;
  const groupTabs = groupId == null ? [] : await chrome.tabs.query({groupId}).catch(()=>[]);
  if (!(groupId != null && groupTabs.length>0)) {
    const first = await chrome.tabs.create({url:urls[0],active:true});
    groupId = await chrome.tabs.group({tabIds:[first.id]});
    await reportSession(session.id,groupId);
    urls = urls.slice(1);
  }
  if (!urls.length) return;
  const tabsInGroup = await chrome.tabs.query({groupId});
  const open = new Set(tabsInGroup.map(t=>hash(t.url)));
  for (const u of urls) {
    const target = hash(u);
    if (!target || open.has(target)) continue;
    const tab = await chrome.tabs.create({url:u,active:false});
    await chrome.tabs.group({tabIds:tab.id,groupId});
    open.add(target);
  }
}
async function syncTabGroup(tabId, repo) {
  let session;
  try { session = await ensureSession(repo); } catch(err) { console.error("orochi: ensure session failed",err); return; }
  try {
    let groupId = session.tabGroupId;
    if (groupId != null) {
      const groupTabs = await chrome.tabs.query({groupId}).catch(()=>[]);
      if (groupTabs.length) { await chrome.tabs.group({tabIds:tabId,groupId}); return; }
    }
    groupId = await chrome.tabs.group({tabIds:[tabId]});
    await reportSession(session.id,groupId);
    console.log("orochi: tab group created for",repo,"#"+groupId);
  } catch(err) { console.error("orochi: tab group sync failed",err); }
}
chrome.tabs.onUpdated.addListener((tabId,info,tab)=>{ if(info.status==="complete"&&tab.url){const repo=repoFromUrl(tab.url);if(repo)syncTabGroup(tabId,repo);} });
chrome.tabs.onActivated.addListener(async ({tabId})=>{const tab=await chrome.tabs.get(tabId).catch(()=>undefined);if(!tab?.url)return;const repo=repoFromUrl(tab.url);if(repo)syncTabGroup(tabId,repo);});

// ChatGPT image saver: paper-scoped downloads, shared Orochi CRX.
const seenImageUrls = new Set();
let imageSaveQueue = Promise.resolve();
function safeFolder(value) {
  return String(value||"paper-001").trim().replace(/[<>:"/\\|?*\x00-\x1F]/g,"-").replace(/\s+/g,"-").replace(/^[-.]+|[-.]+$/g,"").slice(0,80)||"paper-001";
}
async function saveChatImageNow(message) {
  const url=String(message.url||"");
  if(!/^https?:\/\//i.test(url)) throw new Error("Only http(s) image URLs are supported in this POC; blob URLs need a page-context bridge.");
  const settings=await chrome.storage.local.get({orochiImagePaperId:"paper-001",orochiImageAutoSave:false,orochiImageSequence:1,orochiImageSubfolder:"orochi-images"});
  const paper=safeFolder(message.paperId||settings.orochiImagePaperId);
  const seq=Math.max(1,Math.floor(Number(settings.orochiImageSequence)||1));
  const subfolder=String(settings.orochiImageSubfolder||"orochi-images").split("/").filter(Boolean).map(safeFolder).join("/");
  const ext=(String(message.extension||"png").match(/^(png|jpe?g|webp|gif)$/i)||["png"])[0].toLowerCase().replace("jpeg","jpg");
  const filename=\`\${subfolder}/\${paper}/source/\${String(seq).padStart(3,"0")}-chatgpt-image.\${ext}\`;
  const key=paper+"|"+url;
  if(seenImageUrls.has(key)) return {ok:true,skipped:true,filename};
  seenImageUrls.add(key);
  try {
    const downloadId=await chrome.downloads.download({url,filename,conflictAction:"uniquify",saveAs:false});
    await chrome.storage.local.set({orochiImageSequence:seq+1,orochiImageLastSaved:{filename,downloadId,at:new Date().toISOString()}});
    await logFromCrx("info",\`image saved \${filename}\`,"image-saver");
    return {ok:true,filename,downloadId};
  } catch(error) { seenImageUrls.delete(key); throw error; }
}
function saveChatImage(message) {
  const task=imageSaveQueue.then(()=>saveChatImageNow(message));
  imageSaveQueue=task.catch(()=>{});
  return task;
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type==="OROCHI_SAVE_CHAT_IMAGE") {
    saveChatImage(message).then(sendResponse).catch(error=>sendResponse({ok:false,error:String(error?.message||error)}));
    return true;
  }
  if(message?.type==="OROCHI_CHAT_IMAGE_CANDIDATE") {
    chrome.storage.local.get({orochiImageAutoSave:false}).then(({orochiImageAutoSave})=>{
      if(orochiImageAutoSave) saveChatImage(message).catch(error=>logFromCrx("warn",\`image auto-save failed: \${String(error)}\`,"image-saver"));
    });
  }
});
chrome.runtime.onInstalled.addListener(()=>schedulePolling());
chrome.runtime.onStartup.addListener(()=>schedulePolling());
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==="orochi-poll")wakePolling();});
