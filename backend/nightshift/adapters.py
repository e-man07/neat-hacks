"""Agent adapters: how Nightly sees and steers one agent.

`HarborAdapter` is the built-in sandbox agent (business ledger, local replays).
`SdkAdapter` is any customer agent that uses the Nightly SDK: its traces come from the
customer's neatlogs project, its control plane is read by the SDK, deploys are reported by the
SDK, and verification replays run inside the customer's agent via SDK replay jobs.
"""

from __future__ import annotations

import datetime as dt
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol

from harbor import deploy as harbor_deploy
from harbor import releases as harbor_releases
from nightshift import provenance
from nightshift.neatlogs_mcp import NeatlogsMCP
from ops import llm
from ops.db import OpsDB
from ops.economics import load_economics
from ops.settings import REPO_DIR, settings


class Economics(Protocol):
    def conversations_per_minute(self, at: dt.datetime | None = None) -> float: ...
    def human_response_minutes(self, at: dt.datetime | None = None) -> float: ...
    @property
    def source(self) -> str: ...


@dataclass
class AgentEconomics:
    raw: dict[str, Any]

    def conversations_per_minute(self, at: dt.datetime | None = None) -> float:
        hour = (at or dt.datetime.now()).hour
        per_hour = self.raw.get("runs_per_hour", {}).get("night" if hour < 8 else "day", 60)
        return float(per_hour) / 60.0

    def human_response_minutes(self, at: dt.datetime | None = None) -> float:
        hour = (at or dt.datetime.now()).hour
        r = self.raw.get("human_response_minutes", {})
        if 9 <= hour < 19:
            return float(r.get("business_hours", 15))
        if hour >= 19:
            return float(r.get("evening", 45))
        return float(r.get("night", 300))

    @property
    def cost_per_failed_run(self) -> float:
        return float(self.raw.get("cost_per_failed_run_usd", 5.0))

    @property
    def source(self) -> str:
        return str(self.raw.get("source", "agent settings"))


class AgentAdapter:
    agent_id: str
    name: str
    description: str
    kind: str
    db: OpsDB
    mcp: NeatlogsMCP
    policy: dict[str, Any]
    economics: Economics

    # control plane -------------------------------------------------------------------------------
    def active_config(self) -> dict[str, Any]:
        raise NotImplementedError

    def outage_models(self) -> set[str]:
        return {m.strip() for m in (self.db.get_control("fault:provider_outage") or "").split(",") if m.strip()}

    def deploy(self, release: str, actor: str) -> dict[str, Any]:
        return harbor_deploy.record_deploy(self.db, release, actor=actor, commit_sha=self.release_commit(release))

    def active_release(self) -> str | None:
        return self.db.get_control("active_release")

    def last_known_good(self, bad_release: str) -> str | None:
        return harbor_deploy.last_known_good(self.db, bad_release)

    def fallback_model(self) -> str:
        return settings.harbor_fallback_model

    # provenance ----------------------------------------------------------------------------------------
    def release_title(self, release: str) -> str:
        return release

    def release_commit(self, release: str) -> str | None:
        row = self.db.one("SELECT commit_sha FROM deploys WHERE release = ? AND commit_sha IS NOT NULL "
                          "ORDER BY ts DESC LIMIT 1", [release])
        return row["commit_sha"] if row else None

    def release_diff(self, old: str, new: str) -> str:
        a, b = self.release_commit(old), self.release_commit(new)
        if not (a and b and self.repo_dir):
            return "(no commits recorded for these releases)"
        out = subprocess.run(["git", "diff", "--unified=3", a, b], cwd=self.repo_dir, capture_output=True,
                             text=True, timeout=20)
        return out.stdout[:6000] or "(no diff)"

    def provenance(self, release: str) -> provenance.Provenance:
        sha = self.release_commit(release)
        if not sha or not self.repo_dir:
            return provenance.Provenance(release=release, file="")
        return provenance.for_commit(sha, release=release, repo_dir=Path(self.repo_dir))

    repo_dir: str | None = None

    # health & verification --------------------------------------------------------------------------
    def check_model_health(self, model: str) -> dict[str, Any]:
        started = time.time()
        try:
            llm.chat(model, [{"role": "user", "content": "ping"}], max_tokens=1, outage_models=self.outage_models())
            return {"model": model, "healthy": True, "latency_ms": round((time.time() - started) * 1000)}
        except Exception as exc:
            return {"model": model, "healthy": False, "error": str(exc)[:300]}

    def replay(self, conversation_ids: list[str], incident_id: str | None = None) -> Any:
        raise NotImplementedError

    def describe(self) -> str:
        return f"{self.name}: {self.description}"


class HarborAdapter(AgentAdapter):
    """The built-in sandbox agent: a support agent for a fictional store."""

    kind = "sandbox"

    def __init__(self, db: OpsDB, mcp: NeatlogsMCP | None = None, brain: str | None = None,
                 policy: dict[str, Any] | None = None, agent_id: str = "harbor"):
        from nightshift.policy import load_policy

        self.agent_id = agent_id
        self.name = "Harbor"
        self.description = ("customer-support agent for Harbor Goods (an outdoor gear store); answers order "
                            "questions and pays refunds through tools")
        self.db = db
        self.mcp = mcp or NeatlogsMCP()
        self.brain = brain or settings.harbor_brain
        self.policy = policy or load_policy()
        self.economics = load_economics()
        self.repo_dir = str(REPO_DIR)

    def active_config(self) -> dict[str, Any]:
        from harbor.agent import effective_config

        cfg = effective_config(self.db)
        return {"release": cfg.release.id, "model": cfg.model, "max_steps": cfg.max_steps,
                "flags": cfg.flags, "tools": cfg.tools}

    def active_release(self) -> str | None:
        return harbor_deploy.active_release(self.db)

    def deploy(self, release: str, actor: str) -> dict[str, Any]:
        return harbor_deploy.deploy(self.db, release, actor=actor)

    def last_known_good(self, bad_release: str) -> str | None:
        return harbor_deploy.last_known_good(self.db, bad_release)

    def release_title(self, release: str) -> str:
        try:
            return harbor_releases.load_release(release).title
        except Exception:
            return release

    def release_commit(self, release: str) -> str | None:
        return harbor_deploy.release_commit(release)

    def release_diff(self, old: str, new: str) -> str:
        return provenance.release_diff(old, new)

    def provenance(self, release: str) -> provenance.Provenance:
        return provenance.for_release(release)

    def check_model_health(self, model: str) -> dict[str, Any]:
        if self.brain == "sim":
            ok = model not in self.outage_models()
            return {"model": model, "healthy": ok, "probe": "sim", "error": None if ok else "503 Service Unavailable"}
        return super().check_model_health(model)

    def replay(self, conversation_ids: list[str], incident_id: str | None = None) -> Any:
        from nightshift import verifier

        return verifier.replay(self.db, conversation_ids, brain=self.brain)


class SdkAdapter(AgentAdapter):
    """A customer agent connected through the SDK and its neatlogs project."""

    kind = "sdk"

    def __init__(self, agent: dict[str, Any], db: OpsDB, mcp: NeatlogsMCP, policy: dict[str, Any],
                 create_replay_job: Callable[[list[dict[str, Any]], str | None], str] | None = None,
                 get_replay_job: Callable[[str], dict[str, Any] | None] | None = None):
        self.agent = agent
        self.agent_id = agent["id"]
        self.name = agent["name"]
        self.description = agent.get("description") or "an LLM agent"
        self.db = db
        self.mcp = mcp
        self.policy = policy
        self.economics = AgentEconomics(agent.get("economics") or {})
        self.repo_dir = agent.get("repo_dir")
        self._create_job = create_replay_job
        self._get_job = get_replay_job

    def active_config(self) -> dict[str, Any]:
        c = self.db.control_snapshot()
        return {"release": c.get("active_release"), "model": c.get("force_model") or c.get("default_model"),
                "max_steps": c.get("max_steps_cap"),
                "flags": {k[5:]: v.lower() in ("1", "true", "on", "yes") for k, v in c.items() if k.startswith("flag:")}}

    def fallback_model(self) -> str:
        return self.db.get_control("fallback_model") or settings.harbor_fallback_model

    def replay(self, conversation_ids: list[str], incident_id: str | None = None, timeout_s: float = 90) -> Any:
        """Ask the agent (through the SDK) to re-run the failing inputs on its current config."""
        from nightshift.verifier import ReplayResult

        if not conversation_ids or self._create_job is None or self._get_job is None:
            return ReplayResult(0, 0, 1.0)
        marks = ",".join("?" for _ in conversation_ids)
        rows = self.db.query(f"SELECT id, customer_message, outcome FROM conversations WHERE id IN ({marks}) "
                             f"AND (outcome != 'correct' OR tool_errors > 0) AND customer_message IS NOT NULL AND customer_message != '' "
                             f"ORDER BY ts DESC LIMIT 6", conversation_ids)
        if not rows:
            return ReplayResult(0, 0, 1.0)
        inputs = [{"trace_id": r["id"], "input": r["customer_message"], "original_outcome": r["outcome"]} for r in rows]
        job_id = self._create_job(inputs, incident_id)
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            job = self._get_job(job_id)
            if job and job.get("status") == "done":
                items = job.get("results") or []
                passed = sum(1 for i in items if i.get("ok"))
                return ReplayResult(len(items), passed, round(passed / len(items), 3) if items else 1.0, items)
            time.sleep(2)
        return ReplayResult(len(inputs), 0, 0.0, [{"error": "agent did not run the replay job in time "
                                                   "(is ns.serve_replays() running?)"}])
