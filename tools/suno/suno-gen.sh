#!/usr/bin/env bash
set -u
BRIDGE=${BRIDGE:-http://localhost:3001}
PROMPT="${1:?usage: suno-gen.sh \"prompt\" [tags] [title]}"
TAGS="${2:-lofi, calm, rainy night, instrumental}"
TITLE="${3:-Orochi Test}"

echo "[1/3] submit: $PROMPT"
RESP=$(curl -sS --max-time 90 -X POST "$BRIDGE/api/custom_generate" \
  -H 'Content-Type: application/json' \
  -d "$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1],"tags":sys.argv[2],"title":sys.argv[3],"make_instrumental":False}))' "$PROMPT" "$TAGS" "$TITLE")")
echo "$RESP" | head -c 600; echo
IDS=$(echo "$RESP" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
except Exception as e:
  print("ERR: bad json",e,file=sys.stderr); raise SystemExit(1)
items=d if isinstance(d,list) else d.get("clips") or d.get("data") or []
ids=[str(c.get("id")) for c in items if c.get("id")]
print(",".join(ids))')
[ -z "$IDS" ] && { echo "no clip ids"; exit 1; }
echo "ids=$IDS"

echo "[2/3] poll..."
for i in $(seq 1 40); do
  FEED=$(curl -sS --max-time 30 "$BRIDGE/api/get?ids=$IDS")
  DONE=$(echo "$FEED" | python3 -c 'import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get("clips") or d.get("data") or []
ok=[c for c in items if c.get("status")=="complete" and c.get("audio_url")]
print("|".join(f"{c[\"id\"]}|{c[\"audio_url\"]}" for c in ok))')
  if [ -n "$DONE" ]; then
    echo "$DONE" > /tmp/suno-done.txt
    echo "complete:"; echo "$DONE"
    break
  fi
  echo "  ...$i"; sleep 6
done
[ -s /tmp/suno-done.txt ] || { echo "timeout waiting"; exit 1; }

echo "[3/3] download + play"
mkdir -p "$HOME/MEGA/suno-gen/audio" /tmp/suno-out
IFS='|' read -r CID URL <<< "$(head -1 /tmp/suno-done.txt)"
OUT="$HOME/MEGA/suno-gen/audio/${TITLE// /_}-${CID:0:8}.mp3"
curl -sS --max-time 180 -o "$OUT" "$URL" && ls -la "$OUT"
mpv --no-video --force-window=no "$OUT"
