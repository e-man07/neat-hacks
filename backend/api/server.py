"""Nightly API.

    uv run uvicorn api.server:app --port 8000

Routes: sandbox (Harbor demo, /api/*), product (/api/app/*, signed-in users), SDK (/v1/*, agent
tokens), Slack (/slack/*), internal (/api/internal/*, the web server after GitHub sign-in).
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api import app_routes, sandbox_routes, sdk_routes, slack_routes
from api.deps import platform, set_platform
from api.platform import Platform
from ops import security

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    p = Platform()
    p.bus.bind(asyncio.get_running_loop())
    set_platform(p)
    p.start()
    yield
    p.stop()


app = FastAPI(title="Nightly", lifespan=lifespan)
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"],
                   allow_credentials=False)


class UserIn(BaseModel):
    id: str
    login: str
    name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    github_token: str | None = None


@app.post("/api/internal/users")
def upsert_user(body: UserIn, x_internal_secret: str | None = Header(default=None)) -> dict[str, Any]:
    if not security.verify_internal(x_internal_secret):
        raise HTTPException(401)
    store = platform().store
    user = store.upsert_user(body.id, body.login, body.name, body.avatar_url, body.email, body.github_token)
    return {"user": user, "workspace": store.workspace_for(body.id)}


app.include_router(sandbox_routes.router)
app.include_router(app_routes.router)
app.include_router(sdk_routes.router)
app.include_router(slack_routes.router)
