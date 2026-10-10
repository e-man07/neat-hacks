"""Refresh the saved cfo.ai token and write an MCP config file for Claude Code.

    uv run python scripts/cfo_token.py /path/to/mcp.json
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

TOKEN_FILE = Path(__file__).resolve().parents[2] / ".cfo_token.json"


def refresh() -> dict:
    d = json.loads(TOKEN_FILE.read_text())
    r = httpx.post("https://complete-cottage-73.authkit.app/oauth2/token", data={
        "grant_type": "refresh_token", "refresh_token": d["refresh_token"], "client_id": d["client_id"]}, timeout=20)
    b = r.json()
    if "access_token" not in b:
        sys.exit(f"refresh failed: {b}")
    b["client_id"] = d["client_id"]
    b["obtained_at"] = time.time()
    b.setdefault("refresh_token", d["refresh_token"])
    TOKEN_FILE.write_text(json.dumps(b))
    return b


if __name__ == "__main__":
    tok = refresh()
    out = Path(sys.argv[1])
    out.write_text(json.dumps({"mcpServers": {"cfoai": {"type": "http", "url": "https://api.cfo.ai/mcp",
                                                         "headers": {"Authorization": f"Bearer {tok['access_token']}"}}}}))
    out.chmod(0o600)
    print("refreshed; expires_in", tok.get("expires_in"))
