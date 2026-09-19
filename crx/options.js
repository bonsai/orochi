const status = document.querySelector("#status");

const data = await chrome.storage.local.get("orochi");
const state = data.orochi;

if (state?.ready) {
  status.textContent = "Orochi is ready.";
} else {
  status.textContent =
    "Orochi API is not running. Start it with: deno task dev";
}
