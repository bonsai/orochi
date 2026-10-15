# Orochi CRX: ChatGPT image capture POC

This POC adds ChatGPT image capture to Orochi's existing Manifest V3 extension rather than creating a separate extension. It uses the existing CRX background service worker and local extension storage.

## Features
- Runs on `https://chatgpt.com/`.
- Adds a **画像を保存** button to large images.
- Optional automatic download, initially OFF.
- Saves under Edge's Downloads directory: `orochi-images/<paper-id>/source/NNN-chatgpt-image.<ext>`.
- Does not upload images to a server.
- Records last save metadata in extension local storage and emits a best-effort Orochi runtime debug log.

## Configure
Open the extension's options page via `edge://extensions` → Orochi → Extension options, or use the extension popup/options once image controls are exposed there. Set `orochiImagePaperId` to a stable paper ID and `orochiImageAutoSave` to `true` to enable auto-save. For the initial POC, settings can be changed from DevTools for the extension service worker:
```js
chrome.storage.local.set({ orochiImagePaperId: "lora-2106-09685", orochiImageAutoSave: false, orochiImageSequence: 1 })
```
Manual save works while auto-save is disabled. Automatic mode should only be enabled after checking that the site's image detection is not picking up unrelated large images.

## Install and test in Microsoft Edge
1. Pull or download the `bonsai/orochi` repository.
2. Open `edge://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the repository's `crx` folder (the folder containing `manifest.json`).
4. Open/reload ChatGPT and generate or open a large image.
5. Confirm the **画像を保存** button appears, click it, and inspect Edge's Downloads list.
6. Confirm the file is saved under `Downloads/orochi-images/<paper-id>/source/`.
7. Check the service worker console for errors. Test auto-save only after manual save succeeds.

## Connect to the storyboard splitter
The Python splitter currently lives in `bonsai/artcraft-workshop`. Copy or point it at the downloaded file:
```powershell
py -m pip install Pillow
py scripts/split_manga.py "$HOME\Downloads\orochi-images\lora-2106-09685\source\001-chatgpt-image.png" --outdir "output\lora-2106-09685\frames" --paper-id lora-2106-09685
```
The cropper creates four ordered PNGs and `run_metadata.json`. The CRX POC deliberately does not duplicate the Python image-processing implementation.

## POC limitations
- This first version only downloads HTTP(S) URLs. ChatGPT images backed by `blob:` URLs are rejected and need a page-context fetch/blob bridge.
- The extension detects large images heuristically; validate before using automatic mode.
- Edge controls the base Downloads directory. The extension chooses a relative subfolder, not an arbitrary absolute folder.
- The implementation has not been runtime-tested against the current ChatGPT DOM or Edge build. Do not treat the POC as verified until the checklist passes.
- The standalone prototype in `bonsai/artcraft-workshop` should not be treated as a second canonical implementation; Orochi CRX is the POC home.
