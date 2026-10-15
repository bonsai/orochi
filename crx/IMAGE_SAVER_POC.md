# Orochi CRX: ChatGPT image-library bulk capture POC

Orochi owns browser capture. The local Python pipeline owns image splitting, TTS and video muxing; do not duplicate that implementation in the CRX.

## Flow
1. Open ChatGPT's image library or the conversation containing the generated images.
2. Scroll to load target images. Bulk capture saves only large image URLs observed by the page.
3. Enter a paper ID in the Orochi bar and choose **表示中の画像をまとめて保存**.
4. Set Edge's default Downloads directory to the local OneDrive-synced Documents/Pictures folder. Orochi saves to orochi-images/<paper-id>/source/.
5. Copy config/video-pipeline.example.yaml to config/video-pipeline.yaml, set ONEDRIVE_PICTURES, and use YAML as the pipeline path source.

## Local path / OneDrive
Browser extensions cannot write to arbitrary absolute paths. The downloads API uses paths relative to the configured Downloads directory; see https://developer.chrome.com/docs/extensions/reference/api/downloads. The OneDrive URL is a cloud view, not a Windows path. Use the actual synced path on this PC, for example C:\Users\<user>\OneDrive\Documents\Pictures.

## Test checklist
- [ ] Reload unpacked extension from crx at edge://extensions.
- [ ] Open ChatGPT image library and scroll until target images load.
- [ ] Confirm detected image count; batch-save a small test set.
- [ ] Confirm files under <Edge Downloads>/orochi-images/<paper-id>/source/.
- [ ] Confirm path matches paths.image_inbox in local YAML.
- [ ] Run existing Python splitter on one source image.

## Limits
- DOM-based POC, not direct API export of the entire image library; only loaded images are found.
- blob: URLs are unsupported by the current worker; HTTP(S) only.
- Edge runtime test has not yet been performed.
