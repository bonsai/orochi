(() => {
  if (window.__orochiChatImageSaver) return;
  window.__orochiChatImageSaver = true;
  const wired = new WeakSet(), sent = new Set(), candidates = new Map();
  function ext(url) { try { const m = new URL(url, location.href).pathname.match(/\.(png|jpe?g|webp|gif)$/i); return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "png"; } catch { return "png"; } }
  function inspect(img) {
    if (!(img instanceof HTMLImageElement) || !img.complete || img.naturalWidth < 256 || img.naturalHeight < 128) return;
    const url = img.currentSrc || img.src;
    if (!url || wired.has(img)) return;
    wired.add(img);
    const info = { url, extension: ext(url), width: img.naturalWidth, height: img.naturalHeight };
    candidates.set(url, info);
    if (!sent.has(url)) { sent.add(url); chrome.runtime.sendMessage({ type: "OROCHI_CHAT_IMAGE_CANDIDATE", ...info }); }
    const host = img.parentElement; if (!host) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const button = document.createElement("button"); button.type = "button"; button.textContent = "画像を保存";
    Object.assign(button.style, { position: "absolute", right: "8px", bottom: "8px", zIndex: "99999", padding: "7px 10px", border: "1px solid #888", borderRadius: "8px", background: "#172033", color: "#fff", fontSize: "12px", cursor: "pointer" });
    button.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); save(info, button); }); host.appendChild(button);
  }
  function save(info, button) {
    if (button) { button.disabled = true; button.textContent = "保存中…"; }
    chrome.runtime.sendMessage({ type: "OROCHI_SAVE_CHAT_IMAGE", ...info }, response => {
      if (!button) return;
      button.textContent = chrome.runtime.lastError || !response?.ok ? "失敗" : "保存開始";
      button.title = chrome.runtime.lastError?.message || response?.error || response?.filename || "";
      setTimeout(() => { button.disabled = false; button.textContent = "画像を保存"; }, 2500);
    });
  }
  function addBulkBar() {
    if (document.querySelector("#orochi-image-bulk-bar")) return;
    const bar = document.createElement("div"); bar.id = "orochi-image-bulk-bar";
    Object.assign(bar.style, { position: "fixed", top: "12px", right: "16px", zIndex: "2147483647", display: "flex", gap: "8px", alignItems: "center", padding: "10px", borderRadius: "10px", background: "#172033", color: "#fff", boxShadow: "0 2px 12px #0006", font: "13px system-ui,sans-serif" });
    const input = document.createElement("input"); input.id = "orochi-image-paper-id"; input.placeholder = "paper-id";
    Object.assign(input.style, { width: "200px", padding: "7px", borderRadius: "6px", border: "1px solid #aaa" });
    chrome.storage.local.get("orochiImagePaperId", x => { if (x.orochiImagePaperId) input.value = x.orochiImagePaperId; });
    input.addEventListener("change", () => chrome.storage.local.set({ orochiImagePaperId: input.value.trim() }));
    const btn = document.createElement("button"); btn.textContent = "表示中の画像をまとめて保存";
    btn.addEventListener("click", async () => {
      const id = input.value.trim(); if (!/^[a-zA-Z0-9._-]+$/.test(id)) { input.focus(); input.placeholder = "paper-idを入力"; return; }
      await chrome.storage.local.set({ orochiImagePaperId: id }); scan();
      const items = [...candidates.values()]; if (!items.length) { btn.textContent = "画像なし"; return; }
      btn.disabled = true;
      for (let i = 0; i < items.length; i++) { btn.textContent = `保存中 ${i + 1}/${items.length}`; await new Promise(resolve => { chrome.runtime.sendMessage({ type: "OROCHI_SAVE_CHAT_IMAGE", ...items[i] }, () => setTimeout(resolve, 350)); }); }
      btn.textContent = `保存要求済み: ${items.length}枚`; setTimeout(() => { btn.disabled = false; btn.textContent = "表示中の画像をまとめて保存"; }, 3000);
    });
    const count = document.createElement("span"); const update = () => count.textContent = `検出 ${candidates.size}枚`; setInterval(update, 1000);
    bar.append(input, btn, count); document.documentElement.appendChild(bar);
  }
  function scan(root = document) { if (root instanceof HTMLImageElement) inspect(root); root.querySelectorAll?.("img").forEach(inspect); addBulkBar(); }
  scan();
  new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === Node.ELEMENT_NODE) scan(n); }))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("load", e => { if (e.target instanceof HTMLImageElement) inspect(e.target); }, true);
})();