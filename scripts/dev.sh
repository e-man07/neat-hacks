#!/usr/bin/env bash
# Run the Night Shift API and console together.
#   scripts/dev.sh          live models (needs .env)
#   scripts/dev.sh sim      offline, deterministic brain
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRAIN="${1:-live}"
export NIGHTSHIFT_LOCAL_TIME="${NIGHTSHIFT_LOCAL_TIME:-03:07}"
(cd "$ROOT/backend" && uv sync -q && HARBOR_BRAIN="$BRAIN" uv run uvicorn api.server:app --port 8000) &
API=$!
trap 'kill $API 2>/dev/null' EXIT
cd "$ROOT/web" && npm install --silent && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
