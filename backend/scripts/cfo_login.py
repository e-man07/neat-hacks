"""Log in to the cfo.ai MCP server with the OAuth device flow (approve from any browser or phone).

    uv run python scripts/cfo_login.py          # prints a link + code, waits for approval
    uv run python scripts/cfo_login.py --check  # lists the cfo.ai MCP tools with the saved token

The token is saved to <repo>/.cfo_token.json (gitignored). Then, to let Claude Code build the
model in cfo.ai:

    claude mcp add --transport http cfoai https://api.cfo.ai/mcp \
        --header "Authorization: Bearer $(python -c 'import json;print(json.load(open(\"../.cfo_token.json\"))[\"access_token\"])')"
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

AUTH = "https://complete-cottage-73.authkit.app"
MCP = "https://api.cfo.ai/mcp"
TOKEN_FILE = Path(__file__).resolve().parents[2] / ".cfo_token.json"


def register() -> str:
    r = httpx.post(f"{AUTH}/oauth2/register", json={
        "client_name": "Night Shift",
        "grant_types": ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token", "authorization_code"],
        "token_endpoint_auth_method": "none",
        "redirect_uris": ["http://localhost:8765/callback"],
        "response_types": ["code"],
    }, timeout=20)
    r.raise_for_status()
    return r.json()["client_id"]


def login() -> dict:
    client_id = register()
    d = httpx.post(f"{AUTH}/oauth2/device_authorization", data={
        "client_id": client_id, "scope": "openid profile email offline_access", "resource": MCP,
    }, timeout=20).json()
    print("\n  Approve Night Shift's access to cfo.ai:")
    print(f"  {d['verification_uri_complete']}")
    print(f"  code: {d['user_code']}   (expires in {d['expires_in'] // 60} min)\n", flush=True)
    deadline = time.time() + d["expires_in"]
    interval = d.get("interval", 5)
    while time.time() < deadline:
        time.sleep(interval)
        t = httpx.post(f"{AUTH}/oauth2/token", data={
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "device_code": d["device_code"], "client_id": client_id,
        }, timeout=20)
        body = t.json()
        if t.status_code == 200 and "access_token" in body:
            body["client_id"] = client_id
            body["obtained_at"] = time.time()
            TOKEN_FILE.write_text(json.dumps(body))
            TOKEN_FILE.chmod(0o600)
            print(f"  ✓ logged in; token saved to {TOKEN_FILE.name}")
            return body
        if body.get("error") == "slow_down":
            interval += 5
        elif body.get("error") not in ("authorization_pending", None):
            sys.exit(f"login failed: {body}")
    sys.exit("login expired; run again")


def mcp_call(token: str, method: str, params: dict | None = None, session: str | None = None) -> tuple[dict, str | None]:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json",
               "Accept": "application/json, text/event-stream"}
    if session:
        headers["Mcp-Session-Id"] = session
    r = httpx.post(MCP, headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
                   timeout=60)
    sid = r.headers.get("mcp-session-id", session)
    text = r.text
    for line in text.splitlines():
        if line.startswith("data:"):
            return json.loads(line[5:]), sid
    return (json.loads(text) if text.strip() else {}), sid


def check() -> None:
    token = json.loads(TOKEN_FILE.read_text())["access_token"]
    init, sid = mcp_call(token, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                               "clientInfo": {"name": "nightshift", "version": "0.1"}})
    print("server:", init.get("result", {}).get("serverInfo"))
    tools, _ = mcp_call(token, "tools/list", {}, sid)
    for t in tools.get("result", {}).get("tools", []):
        print(f"- {t['name']}: {t.get('description', '')[:110]}")
    orgs, _ = mcp_call(token, "tools/call", {"name": "list_orgs", "arguments": {}}, sid)
    print("orgs:", json.dumps(orgs.get("result", {}))[:600])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if args.check:
        check()
    else:
        login()
        check()
