"""Containment actions on an agent's control plane. Every action records how to undo itself."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from ops.db import OpsDB, dumps, loads

if TYPE_CHECKING:
    from nightshift.adapters import AgentAdapter

ACTOR = "nightshift"


def apply(adapter: "AgentAdapter", incident_id: str, kind: str, params: dict[str, Any], mode: str,
          reason: str) -> dict[str, Any]:
    db = adapter.db
    undo: dict[str, Any]
    if kind == "rollback_release":
        target = params["target"]
        prev = adapter.active_release()
        adapter.deploy(target, actor=ACTOR)
        undo = {"kind": "deploy", "release": prev}
        summary = f"rolled back {prev} → {target}"
    elif kind == "failover_model":
        prev = db.set_control("force_model", params["model"], ACTOR)
        undo = {"kind": "control", "key": "force_model", "value": prev}
        summary = f"routed traffic to backup model {params['model']}"
    elif kind == "disable_flag":
        key = f"flag:{params['flag']}"
        prev = db.set_control(key, "false", ACTOR)
        undo = {"kind": "control", "key": key, "value": prev}
        summary = f"disabled {params['flag']}"
    elif kind == "cap_steps":
        prev = db.set_control("max_steps_cap", str(int(params["steps"])), ACTOR)
        undo = {"kind": "control", "key": "max_steps_cap", "value": prev}
        summary = f"capped agent steps at {params['steps']}"
    else:
        raise ValueError(f"unknown action {kind}")
    action_id = db.insert("actions", {
        "incident_id": incident_id, "ts": time.time(), "kind": kind, "params_json": dumps(params),
        "mode": mode, "status": "applied", "reason": reason, "undo_json": dumps(undo),
    })
    return {"id": action_id, "kind": kind, "params": params, "summary": summary, "undo": undo}


def undo(adapter: "AgentAdapter", action_id: int) -> str:
    db = adapter.db
    row = db.one("SELECT * FROM actions WHERE id = ?", [action_id])
    if row is None or row["status"] != "applied":
        return "nothing to undo"
    u = loads(row["undo_json"], {})
    if u.get("kind") == "deploy":
        adapter.deploy(u["release"], actor=ACTOR)
    elif u.get("kind") == "control":
        db.set_control(u["key"], u.get("value"), ACTOR)
    db.update("actions", "id", action_id, {"status": "undone"})
    return f"undid action {action_id} ({row['kind']})"


def record_proposal(db: OpsDB, incident_id: str, kind: str, params: dict[str, Any], reason: str) -> int:
    """Irreversible / forward actions wait here for a human."""
    return db.insert("actions", {
        "incident_id": incident_id, "ts": time.time(), "kind": kind, "params_json": dumps(params),
        "mode": "needs_approval", "status": "proposed", "reason": reason, "undo_json": None,
    })
