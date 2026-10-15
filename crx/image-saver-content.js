(() => {
  if (window.__orochiChatImageSaver) return;
  window.__orochiChatImageSaver = true;
  const wired = new WeakSet();
  const sent = new Set();
  function ext(url) {
    try { const m=new URL(url,location.href).pathname.match(/\\.(png|jpe?g|webp|gif)$/i); return m?m[1].toLowerCase().replace("jpeg","jpg"):"png"; } catch { return "png"; }
  }
  function inspect(img) {
    if (!(img instanceof HTMLImageElement) || !img.complete || img.naturalWidth<256 || img.naturalHeight<128) return;
    const url=img.currentSrc||img.src;
    if (!url || wired.has(img)) return;
    wired.add(img);
    const info={url,extension:ext(url),width:img.naturalWidth,height:img.naturalHeight};
    if (!sent.has(url)) { sent.add(url); chrome.runtime.sendMessage({type:"OROCHI_CHAT_IMAGE_CANDIDATE",...info}); }
    const host=img.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position==="static") host.style.position="relative";
    const button=document.createElement("button");
    button.type="button"; button.textContent="画像を保存";
    button.title="Orochi: 現在の論文IDフォルダへ保存";
    Object.assign(button.style,{position:"absolute",right:"8px",bottom:"8px",zIndex:"99999",padding:"7px 10px",border:"1px solid #888",borderRadius:"8px",background:"#172033",color:"#fff",fontSize:"12px",cursor:"pointer"});
    button.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();button.disabled=true;button.textContent="保存中…";
      chrome.runtime.sendMessage({type:"OROCHI_SAVE_CHAT_IMAGE",...info},response=>{
        if(chrome.runtime.lastError){button.textContent="失敗";button.title=chrome.runtime.lastError.message;}
        else if(response?.ok){button.textContent=response.skipped?"保存済み":"保存開始";button.title=response.filename||"";}
        else{button.textContent="失敗";button.title=response?.error||"保存に失敗しました";}
        setTimeout(()=>{button.disabled=false;button.textContent="画像を保存";},2500);
      });
    });
    host.appendChild(button);
  }
  function scan(root=document){if(root instanceof HTMLImageElement)inspect(root);root.querySelectorAll?.("img").forEach(inspect);}
  scan();
  new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===Node.ELEMENT_NODE)scan(n);}))).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("load",e=>{if(e.target instanceof HTMLImageElement)inspect(e.target);},true);
})();