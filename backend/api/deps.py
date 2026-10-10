"""Request dependencies: the platform, the signed-in user, their workspace, and agent ownership."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request

from ops import security

_platform: Any = None


def set_platform(p: Any) -> None:
    global _platform
    _platform = p


def platform() -> Any:
    assert _platform is not None, "platform not started"
    return _platform


def _bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.query_params.get("token")


def current_user(request: Request) -> security.Principal:
    token = _bearer(request) or ""
    principal = security.verify_user_token(token)
    if principal is None:
        raise HTTPException(401, "sign in required")
    if security.dev_mode():
        platform().store.upsert_user(principal.user_id, principal.login, principal.name, None)
    return principal


def workspace(user: security.Principal = Depends(current_user)) -> dict[str, Any]:
    return platform().store.workspace_for(user.user_id)


def owned_agent(agent_id: str, ws: dict[str, Any] = Depends(workspace)) -> dict[str, Any]:
    agent = platform().store.agent(agent_id)
    if agent is None or agent["workspace_id"] != ws["id"]:
        raise HTTPException(404, "agent not found")
    return agent


def sdk_agent(request: Request) -> dict[str, Any]:
    token = _bearer(request) or ""
    agent = platform().store.agent_by_token(token) if token.startswith("nsa_") else None
    if agent is None:
        raise HTTPException(401, "invalid agent token")
    return agent


def require_user_for_writes(request: Request) -> None:
    """Sandbox controls spend LLM budget: require a signed-in user (outside dev mode)."""
    if security.dev_mode():
        return
    if security.verify_user_token(_bearer(request) or "") is None:
        raise HTTPException(401, "sign in to use the sandbox controls")
