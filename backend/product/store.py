"""Product data: users, workspaces, agents, integrations, policies, replay jobs.

Each agent also has its own ops store (`runs/agents/<agent_id>.db`) holding its control plane,
deploys, observed traces, incidents and actions — tenants never share an ops database.
"""

from __future__ import annotations

import json
import re
import secrets
import time
from pathlib import Path
from typing import Any

import yaml

from ops import security
from ops.db import OpsDB
from ops.settings import BACKEND_DIR

PRODUCT_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    email TEXT,
    github_token_enc TEXT,
    created_at REAL NOT NULL,
    last_seen_at REAL
);
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    PRIMARY KEY (user_id, workspace_id)
);
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    kind TEXT NOT NULL DEFAULT 'sdk',        -- sdk | sandbox
    neatlogs_key_enc TEXT,
    neatlogs_project_id TEXT,
    neatlogs_project_name TEXT,
    workflow_name TEXT,
    root_span_name TEXT,
    repo TEXT,                               -- owner/name on GitHub
    repo_dir TEXT,                           -- local clone used for provenance
    token_hash TEXT,
    token_prefix TEXT,
    economics_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | live | paused
    created_at REAL NOT NULL,
    last_seen_at REAL
);
CREATE TABLE IF NOT EXISTS integrations (
    workspace_id TEXT NOT NULL,
    kind TEXT NOT NULL,                      -- slack | webhook | ntfy | github
    config_enc TEXT NOT NULL,
    created_at REAL NOT NULL,
    created_by TEXT,
    PRIMARY KEY (workspace_id, kind)
);
CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    yaml TEXT NOT NULL,
    created_at REAL NOT NULL,
    created_by TEXT
);
CREATE TABLE IF NOT EXISTS replay_jobs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    incident_id TEXT,
    inputs_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | claimed | done
    results_json TEXT,
    created_at REAL NOT NULL,
    claimed_at REAL,
    done_at REAL
);
CREATE TABLE IF NOT EXISTS slack_messages (
    incident_id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    ts TEXT NOT NULL
);
"""

AGENT_DB_DIR = BACKEND_DIR / "runs" / "agents"
SANDBOX_AGENT_ID = "harbor"


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:32] or "agent"


class ProductStore:
    def __init__(self, path: Path | str):
        self.db = OpsDB(path, schema=PRODUCT_SCHEMA)
        self._agent_dbs: dict[str, OpsDB] = {}

    # -- users & workspaces ---------------------------------------------------------------------
    def upsert_user(self, user_id: str, login: str, name: str | None, avatar_url: str | None,
                    email: str | None = None, github_token: str | None = None) -> dict[str, Any]:
        now = time.time()
        existing = self.db.one("SELECT * FROM users WHERE id = ?", [user_id])
        if existing:
            values: dict[str, Any] = {"login": login, "name": name, "avatar_url": avatar_url, "last_seen_at": now}
            if email:
                values["email"] = email
            if github_token:
                values["github_token_enc"] = security.encrypt(github_token)
            self.db.update("users", "id", user_id, values)
        else:
            self.db.insert("users", {"id": user_id, "login": login, "name": name, "avatar_url": avatar_url,
                                     "email": email, "github_token_enc": security.encrypt(github_token),
                                     "created_at": now, "last_seen_at": now})
        self.ensure_workspace(user_id, login)
        return self.user(user_id)

    def user(self, user_id: str) -> dict[str, Any]:
        row = self.db.one("SELECT id, login, name, avatar_url, email, created_at, "
                          "github_token_enc IS NOT NULL AS has_github_token FROM users WHERE id = ?", [user_id]) or {}
        return row

    def github_token(self, user_id: str) -> str | None:
        row = self.db.one("SELECT github_token_enc FROM users WHERE id = ?", [user_id])
        return security.decrypt(row["github_token_enc"]) if row else None

    def ensure_workspace(self, user_id: str, login: str) -> dict[str, Any]:
        row = self.db.one("SELECT w.* FROM workspaces w JOIN memberships m ON m.workspace_id = w.id "
                          "WHERE m.user_id = ? ORDER BY w.created_at LIMIT 1", [user_id])
        if row:
            return row
        wid = f"ws_{secrets.token_hex(6)}"
        self.db.insert("workspaces", {"id": wid, "name": f"{login}'s workspace", "owner_id": user_id,
                                      "created_at": time.time()})
        self.db.insert("memberships", {"user_id": user_id, "workspace_id": wid, "role": "owner"})
        return self.db.one("SELECT * FROM workspaces WHERE id = ?", [wid]) or {}

    def workspace_for(self, user_id: str) -> dict[str, Any]:
        row = self.db.one("SELECT w.* FROM workspaces w JOIN memberships m ON m.workspace_id = w.id "
                          "WHERE m.user_id = ? ORDER BY w.created_at LIMIT 1", [user_id])
        if row is None:
            u = self.db.one("SELECT login FROM users WHERE id = ?", [user_id])
            row = self.ensure_workspace(user_id, (u or {}).get("login") or user_id)
        return row

    def owner_of(self, workspace_id: str) -> str | None:
        row = self.db.one("SELECT owner_id FROM workspaces WHERE id = ?", [workspace_id])
        return row["owner_id"] if row else None

    # -- agents ---------------------------------------------------------------------------------
    def create_agent(self, workspace_id: str, name: str, description: str = "", repo: str | None = None,
                     kind: str = "sdk", agent_id: str | None = None,
                     economics: dict[str, Any] | None = None) -> tuple[dict[str, Any], str]:
        aid = agent_id or f"{slug(name)}-{secrets.token_hex(3)}"
        token, digest, prefix = security.new_agent_token()
        self.db.insert("agents", {
            "id": aid, "workspace_id": workspace_id, "name": name, "description": description, "kind": kind,
            "repo": repo, "token_hash": digest, "token_prefix": prefix, "status": "pending",
            "economics_json": json.dumps(economics or default_economics()), "created_at": time.time(),
        })
        self.set_policy(aid, DEFAULT_POLICY_YAML, created_by="system")
        return self.agent(aid) or {}, token

    def rotate_agent_token(self, agent_id: str) -> str:
        token, digest, prefix = security.new_agent_token()
        self.db.update("agents", "id", agent_id, {"token_hash": digest, "token_prefix": prefix})
        return token

    def update_agent(self, agent_id: str, **values: Any) -> dict[str, Any] | None:
        if "neatlogs_key" in values:
            values["neatlogs_key_enc"] = security.encrypt(values.pop("neatlogs_key"))
        if "economics" in values:
            values["economics_json"] = json.dumps(values.pop("economics"))
        if values:
            self.db.update("agents", "id", agent_id, values)
        return self.agent(agent_id)

    def agent(self, agent_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM agents WHERE id = ?", [agent_id])
        return self._public_agent(row) if row else None

    def agent_secret(self, agent_id: str) -> str | None:
        row = self.db.one("SELECT neatlogs_key_enc FROM agents WHERE id = ?", [agent_id])
        return security.decrypt(row["neatlogs_key_enc"]) if row else None

    def agent_by_token(self, token: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM agents WHERE token_hash = ?", [security.hash_token(token)])
        return self._public_agent(row) if row else None

    def agents_for(self, workspace_id: str) -> list[dict[str, Any]]:
        return [self._public_agent(r) for r in
                self.db.query("SELECT * FROM agents WHERE workspace_id = ? ORDER BY created_at", [workspace_id])]

    def all_agents(self) -> list[dict[str, Any]]:
        return [self._public_agent(r) for r in self.db.query("SELECT * FROM agents ORDER BY created_at")]

    def delete_agent(self, agent_id: str) -> None:
        self.db.execute("DELETE FROM agents WHERE id = ?", [agent_id])
        self.db.execute("DELETE FROM policies WHERE agent_id = ?", [agent_id])

    @staticmethod
    def _public_agent(row: dict[str, Any]) -> dict[str, Any]:
        out = {k: v for k, v in row.items() if k not in ("neatlogs_key_enc", "token_hash")}
        out["has_neatlogs_key"] = bool(row.get("neatlogs_key_enc"))
        out["economics"] = json.loads(row["economics_json"]) if row.get("economics_json") else default_economics()
        out.pop("economics_json", None)
        return out

    def agent_db(self, agent_id: str) -> OpsDB:
        if agent_id not in self._agent_dbs:
            self._agent_dbs[agent_id] = OpsDB(AGENT_DB_DIR / f"{agent_id}.db")
        return self._agent_dbs[agent_id]

    # -- policies -------------------------------------------------------------------------------------
    def set_policy(self, agent_id: str, text: str, created_by: str | None) -> dict[str, Any]:
        parsed = yaml.safe_load(text)
        validate_policy(parsed)
        row = self.db.one("SELECT MAX(version) v FROM policies WHERE agent_id = ?", [agent_id])
        version = int((row or {}).get("v") or 0) + 1
        self.db.insert("policies", {"agent_id": agent_id, "version": version, "yaml": text,
                                    "created_at": time.time(), "created_by": created_by})
        return self.policy(agent_id)

    def policy(self, agent_id: str) -> dict[str, Any]:
        row = self.db.one("SELECT * FROM policies WHERE agent_id = ? ORDER BY version DESC LIMIT 1", [agent_id])
        if not row:
            return {"agent_id": agent_id, "version": 0, "yaml": DEFAULT_POLICY_YAML,
                    "parsed": yaml.safe_load(DEFAULT_POLICY_YAML)}
        return {**row, "parsed": yaml.safe_load(row["yaml"])}

    def policy_history(self, agent_id: str) -> list[dict[str, Any]]:
        return self.db.query("SELECT version, created_at, created_by FROM policies WHERE agent_id = ? "
                             "ORDER BY version DESC LIMIT 20", [agent_id])

    # -- integrations -----------------------------------------------------------------------------
    def set_integration(self, workspace_id: str, kind: str, config: dict[str, Any], created_by: str | None) -> None:
        self.db.execute(
            "INSERT INTO integrations (workspace_id, kind, config_enc, created_at, created_by) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(workspace_id, kind) DO UPDATE SET config_enc=excluded.config_enc, "
            "created_at=excluded.created_at, created_by=excluded.created_by",
            [workspace_id, kind, security.encrypt(json.dumps(config)), time.time(), created_by])

    def integration(self, workspace_id: str, kind: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM integrations WHERE workspace_id = ? AND kind = ?", [workspace_id, kind])
        if not row:
            return None
        raw = security.decrypt(row["config_enc"])
        return json.loads(raw) if raw else None

    def remove_integration(self, workspace_id: str, kind: str) -> None:
        self.db.execute("DELETE FROM integrations WHERE workspace_id = ? AND kind = ?", [workspace_id, kind])

    def integrations_summary(self, workspace_id: str) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for row in self.db.query("SELECT kind, created_at FROM integrations WHERE workspace_id = ?", [workspace_id]):
            cfg = self.integration(workspace_id, row["kind"]) or {}
            public = {k: v for k, v in cfg.items() if k in ("team_name", "channel", "channel_id", "topic", "url_host",
                                                            "team_id", "installed_by")}
            out[row["kind"]] = {"connected": True, "created_at": row["created_at"], **public}
        return out

    # -- replay jobs (verification hooks run inside the customer's agent via the SDK) -----------------
    def create_replay_job(self, agent_id: str, incident_id: str | None, inputs: list[dict[str, Any]]) -> str:
        jid = f"rj_{secrets.token_hex(6)}"
        self.db.insert("replay_jobs", {"id": jid, "agent_id": agent_id, "incident_id": incident_id,
                                       "inputs_json": json.dumps(inputs), "status": "pending",
                                       "created_at": time.time()})
        return jid

    def claim_replay_job(self, agent_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM replay_jobs WHERE agent_id = ? AND status = 'pending' "
                          "ORDER BY created_at LIMIT 1", [agent_id])
        if not row:
            return None
        self.db.update("replay_jobs", "id", row["id"], {"status": "claimed", "claimed_at": time.time()})
        return {"id": row["id"], "incident_id": row["incident_id"], "inputs": json.loads(row["inputs_json"])}

    def finish_replay_job(self, job_id: str, results: list[dict[str, Any]]) -> None:
        self.db.update("replay_jobs", "id", job_id, {"status": "done", "results_json": json.dumps(results),
                                                     "done_at": time.time()})

    def replay_job(self, job_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM replay_jobs WHERE id = ?", [job_id])
        if not row:
            return None
        return {**row, "inputs": json.loads(row["inputs_json"]),
                "results": json.loads(row["results_json"]) if row["results_json"] else None}

    # -- slack message refs ------------------------------------------------------------------------
    def set_slack_message(self, incident_id: str, channel: str, ts: str) -> None:
        self.db.execute("INSERT OR REPLACE INTO slack_messages (incident_id, channel, ts) VALUES (?, ?, ?)",
                        [incident_id, channel, ts])

    def slack_message(self, incident_id: str) -> dict[str, Any] | None:
        return self.db.one("SELECT * FROM slack_messages WHERE incident_id = ?", [incident_id])


def default_economics() -> dict[str, Any]:
    """What a bad run costs the customer. Editable per agent; Harbor's comes from the cfo.ai model."""
    return {"runs_per_hour": {"day": 120, "night": 30},
            "cost_per_failed_run_usd": 5.0,
            "human_response_minutes": {"business_hours": 15, "evening": 45, "night": 300},
            "source": "defaults — edit in the agent's settings or sync from cfo.ai"}


DEFAULT_POLICY_YAML = """# What Nightly may do on its own for this agent.
gates:
  min_confidence: 0.6
  min_projected_loss_usd: 25
  safety_incident_types: [prompt_injection]
  max_auto_actions_per_incident: 2
  verify_replay_min_pass_rate: 0.8
  auto_undo_if_verify_fails: true

auto:
  rollback_release:
    reversible: true
  failover_model:
    reversible: true
    allowed_models: [nova-lite, nova-pro, claude-sonnet-4.6]
  disable_flag:
    reversible: true
    allowed_flags: [auto_refund_enabled, tools_enabled]
  cap_steps:
    reversible: true
    min_steps: 4

needs_approval:
  - deploy_code_fix
  - revert_commit
  - refund_customers
  - contact_customers
  - delete_data
"""

KNOWN_AUTO_ACTIONS = {"rollback_release", "failover_model", "disable_flag", "cap_steps"}


def validate_policy(p: Any) -> None:
    if not isinstance(p, dict):
        raise ValueError("policy must be a mapping")
    gates = p.get("gates")
    if not isinstance(gates, dict):
        raise ValueError("policy needs a 'gates' section")
    for key in ("min_confidence", "min_projected_loss_usd", "max_auto_actions_per_incident",
                "verify_replay_min_pass_rate"):
        if key not in gates:
            raise ValueError(f"gates.{key} is required")
    if not 0 <= float(gates["min_confidence"]) <= 1:
        raise ValueError("gates.min_confidence must be between 0 and 1")
    auto = p.get("auto") or {}
    unknown = set(auto) - KNOWN_AUTO_ACTIONS
    if unknown:
        raise ValueError(f"unknown auto actions: {', '.join(sorted(unknown))}")
    for name, rule in auto.items():
        if not (isinstance(rule, dict) and rule.get("reversible") is True):
            raise ValueError(f"auto.{name} must be marked reversible: true — irreversible actions need approval")
