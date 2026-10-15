const $ = id => document.getElementById(id);
const saved = await chrome.storage.local.get(["orochi", "orochiImagePaperId", "orochiImageAutoSave", "orochiImageSubfolder"]);
$("status").textContent = saved.orochi?.ready ? "Orochi runtime: ready" : "Orochi runtime: 未起動（画像保存設定は利用できます）";
$("paperId").value = saved.orochiImagePaperId || "";
$("autoSave").checked = saved.orochiImageAutoSave === true;
$("subfolder").value = saved.orochiImageSubfolder || "orochi-images";
$("save").addEventListener("click", async () => {
 const paperId = $("paperId").value.trim(), subfolder = $("subfolder").value.trim().replace(/^\/+|\/+$/g, "");
 if (!/^[a-zA-Z0-9._-]+$/.test(paperId)) { $("result").textContent = " paper ID は英数字・._- で入力してください"; return; }
 if (!subfolder || subfolder.split("/").some(p => !p || p === "." || p === ".." || !/^[a-zA-Z0-9._-]+$/.test(p))) { $("result").textContent = " 相対フォルダ名を確認してください"; return; }
 await chrome.storage.local.set({ orochiImagePaperId: paperId, orochiImageAutoSave: $("autoSave").checked, orochiImageSubfolder: subfolder });
 $("result").textContent = " 保存しました";
});