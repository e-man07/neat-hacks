"""Release definitions: the deployable behaviour of the Harbor agent.

A release is a YAML file in `harbor/releases/`. The control plane picks the active release and can
override individual settings (forced model, flags, step cap) without a redeploy.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

RELEASES_DIR = Path(__file__).resolve().parent / "releases"
BASELINE_RELEASE = "r41"


@dataclass
class Release:
    id: str
    title: str
    system_prompt: str
    model: str | None = None
    fallback_model: str | None = None
    max_steps: int = 8
    orders_api: str = "v1"
    tools: list[str] = field(default_factory=lambda: ["lookup_order", "check_refund_policy",
                                                      "issue_refund", "escalate_to_human"])
    flags: dict[str, Any] = field(default_factory=dict)
    description: str = ""
    path: Path | None = None

    @property
    def file(self) -> str:
        return f"backend/harbor/releases/{self.id}.yaml"


def load_release(release_id: str) -> Release:
    path = RELEASES_DIR / f"{release_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"release {release_id} not found at {path}")
    data = yaml.safe_load(path.read_text())
    return Release(
        id=data["id"],
        title=data.get("title", data["id"]),
        description=data.get("description", ""),
        system_prompt=data["system_prompt"],
        model=data.get("model"),
        fallback_model=data.get("fallback_model"),
        max_steps=int(data.get("max_steps", 8)),
        orders_api=data.get("orders_api", "v1"),
        tools=list(data.get("tools") or Release.__dataclass_fields__["tools"].default_factory()),
        flags=dict(data.get("flags") or {}),
        path=path,
    )


def list_releases() -> list[Release]:
    out = []
    for p in sorted(RELEASES_DIR.glob("r*.yaml")):
        try:
            out.append(load_release(p.stem))
        except Exception:  # pragma: no cover - a broken release file is reported elsewhere
            continue
    return out
