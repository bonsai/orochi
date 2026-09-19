const API = "http://127.0.0.1:8787";

async function checkSetup() {
  try {
    const response = await fetch(API + "/health");
    if (!response.ok) throw new Error("Orochi API unavailable");
    const health = await response.json();
    await chrome.storage.local.set({
      orochi: {
        api: API,
        ready: true,
        health
      }
    });
  } catch (error) {
    await chrome.storage.local.set({
      orochi: {
        api: API,
        ready: false,
        error: String(error)
      }
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  checkSetup();
});

chrome.runtime.onStartup.addListener(() => {
  checkSetup();
});
