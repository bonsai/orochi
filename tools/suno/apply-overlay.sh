#!/usr/bin/env bash
# Apply this repo's OpenSuno overlay onto a local opensuno checkout.
#
#   tools/suno/apply-overlay.sh /mnt/c/Users/dance/opensuno
set -euo pipefail

DEST="${1:-/mnt/c/Users/dance/opensuno}"
SRC="$(cd "$(dirname "$0")" && pwd)/overlay"

[ -d "$DEST" ] || { echo "opensuno not found: $DEST" >&2; exit 1; }

for f in \
  extension/src/page-script.ts \
  extension/src/content.ts \
  extension/build.ts \
  src/bridge/api-handler.ts \
  src/bridge/server.ts
do
  [ -f "$SRC/$f" ] || { echo "overlay missing: $f" >&2; exit 1; }
  mkdir -p "$(dirname "$DEST/$f")"
  cp "$SRC/$f" "$DEST/$f"
  echo "applied $f"
done

echo "done. next: cd $DEST && bun run ext:build"
