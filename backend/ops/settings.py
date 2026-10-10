"""Runtime settings, read from the repo-root .env and the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

load_dotenv(REPO_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass
class Settings:
    litellm_api_key: str = field(default_factory=lambda: _env("LITELLM_API_KEY"))
    litellm_base_url: str = field(
        default_factory=lambda: _env("LITELLM_BASE_URL", "https://litellm.vision.aivar.app/v1")
    )
    neatlogs_api_key: str = field(default_factory=lambda: _env("NEATLOGS_API_KEY"))
    neatlogs_mcp_url: str = field(
        default_factory=lambda: _env("NEATLOGS_MCP_URL", "https://ingest.neatlogs.com/mcp")
    )
    harbor_brain: str = field(default_factory=lambda: _env("HARBOR_BRAIN", "live"))
    harbor_model: str = field(default_factory=lambda: _env("HARBOR_MODEL", "claude-haiku"))
    harbor_fallback_model: str = field(
        default_factory=lambda: _env("HARBOR_FALLBACK_MODEL", "nova-lite")
    )
    nightshift_model: str = field(
        default_factory=lambda: _env("NIGHTSHIFT_MODEL", "claude-sonnet-4.6")
    )
    ntfy_topic: str = field(default_factory=lambda: _env("NTFY_TOPIC"))
    telegram_bot_token: str = field(default_factory=lambda: _env("TELEGRAM_BOT_TOKEN"))
    telegram_chat_id: str = field(default_factory=lambda: _env("TELEGRAM_CHAT_ID"))
    public_base_url: str = field(
        default_factory=lambda: _env("PUBLIC_BASE_URL", "http://localhost:3000")
    )
    db_path: Path = field(
        default_factory=lambda: Path(_env("OPS_DB", str(BACKEND_DIR / "runs" / "ops.db")))
    )

    @property
    def llm_available(self) -> bool:
        return bool(self.litellm_api_key)

    @property
    def neatlogs_available(self) -> bool:
        return bool(self.neatlogs_api_key)


settings = Settings()
