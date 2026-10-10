"""Auth primitives: user session tokens (minted by the web app), agent SDK tokens, internal calls,
and encryption of stored secrets (neatlogs keys, GitHub and Slack tokens).

- User tokens are HS256 JWTs signed with NS_AUTH_SECRET, which the web app shares. The web app mints
  one after GitHub sign-in; the browser sends it as a bearer token (or `?token=` for SSE).
- Agent tokens (`nsa_…`) are random; only their SHA-256 is stored.
- Internal calls (web server → API, e.g. upserting a user after sign-in) carry NS_INTERNAL_SECRET.
- Secrets at rest are Fernet-encrypted with NS_ENCRYPTION_KEY (derived from NS_AUTH_SECRET if unset).

When NS_AUTH_SECRET is unset the API runs in local dev mode with a single "dev" user.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from dataclasses import dataclass
from typing import Any

import jwt
from cryptography.fernet import Fernet, InvalidToken

ALGO = "HS256"


def _env(name: str) -> str:
    return os.environ.get(name, "").strip()


def auth_secret() -> str:
    return _env("NS_AUTH_SECRET")


def dev_mode() -> bool:
    return not auth_secret()


@dataclass
class Principal:
    user_id: str
    login: str
    name: str | None = None
    avatar_url: str | None = None


DEV_PRINCIPAL = Principal(user_id="dev", login="dev", name="Local developer")


def mint_user_token(p: Principal, ttl_s: int = 3600) -> str:
    now = int(time.time())
    return jwt.encode({"sub": p.user_id, "login": p.login, "name": p.name, "avatar": p.avatar_url,
                       "iat": now, "exp": now + ttl_s, "aud": "nightshift-api"}, auth_secret(), algorithm=ALGO)


def verify_user_token(token: str) -> Principal | None:
    if dev_mode():
        return DEV_PRINCIPAL
    try:
        claims = jwt.decode(token, auth_secret(), algorithms=[ALGO], audience="nightshift-api")
    except jwt.PyJWTError:
        return None
    return Principal(user_id=str(claims["sub"]), login=claims.get("login") or "", name=claims.get("name"),
                     avatar_url=claims.get("avatar"))


def verify_internal(header_value: str | None) -> bool:
    expected = _env("NS_INTERNAL_SECRET")
    if not expected:
        return dev_mode()
    return bool(header_value) and hmac.compare_digest(header_value, expected)


# -- agent tokens --------------------------------------------------------------------------------
def new_agent_token() -> tuple[str, str, str]:
    """Returns (token, sha256, display prefix)."""
    token = "nsa_" + secrets.token_urlsafe(32)
    return token, hash_token(token), token[:10]


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# -- secrets at rest ---------------------------------------------------------------------------------
def _fernet() -> Fernet:
    key = _env("NS_ENCRYPTION_KEY")
    if not key:
        seed = auth_secret() or "nightshift-local-dev-only"
        key = base64.urlsafe_b64encode(hashlib.sha256(("enc:" + seed).encode()).digest()).decode()
    return Fernet(key.encode())


def encrypt(value: str | None) -> str | None:
    if not value:
        return None
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return None


def mask(value: str | None, keep: int = 4) -> str | None:
    if not value:
        return None
    return value[:keep] + "…" + value[-keep:] if len(value) > keep * 2 else "…"


def sign_state(payload: dict[str, Any], ttl_s: int = 900) -> str:
    """Signed, expiring state for OAuth round-trips (Slack install)."""
    now = int(time.time())
    return jwt.encode({**payload, "exp": now + ttl_s, "aud": "nightshift-state"},
                      auth_secret() or "nightshift-local-dev-only", algorithm=ALGO)


def verify_state(state: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(state, auth_secret() or "nightshift-local-dev-only", algorithms=[ALGO],
                          audience="nightshift-state")
    except jwt.PyJWTError:
        return None
