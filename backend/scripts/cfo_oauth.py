"""cfo.ai MCP login with the browser (authorization code + PKCE), for machines without a local browser.

    uv run python scripts/cfo_oauth.py start            # prints a link; approve it in your browser
    uv run python scripts/cfo_oauth.py finish '<URL>'   # paste the localhost URL you were redirected to

The token is saved to <repo>/.cfo_token.json (gitignored).
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import sys
import time
import urllib.parse
from pathlib import Path

import httpx

AUTH = "https://complete-cottage-73.authkit.app"
MCP = "https://api.cfo.ai/mcp"
REDIRECT = "http://localhost:8765/callback"
ROOT = Path(__file__).resolve().parents[2]
STATE_FILE = ROOT / ".cfo_oauth_state.json"
TOKEN_FILE = ROOT / ".cfo_token.json"


def start() -> None:
    reg = httpx.post(f"{AUTH}/oauth2/register", json={
        "client_name": "Nightly", "grant_types": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_method": "none", "redirect_uris": [REDIRECT], "response_types": ["code"],
    }, timeout=20)
    reg.raise_for_status()
    client_id = reg.json()["client_id"]
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    STATE_FILE.write_text(json.dumps({"client_id": client_id, "verifier": verifier, "state": state}))
    STATE_FILE.chmod(0o600)
    q = urllib.parse.urlencode({
        "response_type": "code", "client_id": client_id, "redirect_uri": REDIRECT,
        "code_challenge": challenge, "code_challenge_method": "S256", "state": state,
        "scope": "openid profile email offline_access", "resource": MCP,
    })
    print(f"{AUTH}/oauth2/authorize?{q}")


def finish(url: str) -> None:
    st = json.loads(STATE_FILE.read_text())
    params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(url.strip()).query))
    if params.get("error"):
        sys.exit(f"authorization error: {params}")
    if params.get("state") != st["state"]:
        sys.exit("state mismatch — start again")
    r = httpx.post(f"{AUTH}/oauth2/token", data={
        "grant_type": "authorization_code", "code": params["code"], "redirect_uri": REDIRECT,
        "client_id": st["client_id"], "code_verifier": st["verifier"], "resource": MCP,
    }, timeout=20)
    body = r.json()
    if "access_token" not in body:
        sys.exit(f"token exchange failed: {body}")
    body["client_id"] = st["client_id"]
    body["obtained_at"] = time.time()
    TOKEN_FILE.write_text(json.dumps(body))
    TOKEN_FILE.chmod(0o600)
    STATE_FILE.unlink(missing_ok=True)
    print("logged in; token saved")


if __name__ == "__main__":
    if sys.argv[1:2] == ["start"]:
        start()
    elif sys.argv[1:2] == ["finish"]:
        finish(sys.argv[2])
    else:
        sys.exit(__doc__)
