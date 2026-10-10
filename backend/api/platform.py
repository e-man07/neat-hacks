"""The multi-tenant runtime: every connected agent gets its own ops store, Night Shift instance and
neatlogs poller; the Harbor sandbox runs alongside as a shared demo agent."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

from api.runtime import EventBus, Runtime
from nightshift import actions as ns_actions
from nightshift import reporter, sources
from nightshift.adapters import SdkAdapter
from nightshift.neatlogs_mcp import NeatlogsMCP
from nightshift.runner import NightShift, approve
from ops.db import loads
from ops.settings import BACKEND_DIR
from product import github_fix, slack
from product.paging import make_pager
from product.store import ProductStore

log = logging.getLogger(__name__)

POLL_EVERY_S = 15
TICK_EVERY_S = 5


class Platform:
    def __init__(self, product_db: str | None = None):
        self.store = ProductStore(product_db or BACKEND_DIR / "runs" / "product.db")
        self.sandbox = Runtime()
        self.bus: EventBus = self.sandbox.bus
        self._ns: dict[str, NightShift] = {}
        self._mcp: dict[str, NeatlogsMCP] = {}
        self._last_poll: dict[str, float] = {}
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    # -- lifecycle -------------------------------------------------------------------------------------
    def start(self) -> None:
        self.sandbox.start()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="fleet", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self.sandbox.stop()

    def _loop(self) -> None:
        while not self._stop.wait(TICK_EVERY_S):
            for agent in self.store.all_agents():
                if agent["kind"] != "sdk" or agent["status"] != "live":
                    continue
                try:
                    self.tick_agent(agent)
                except Exception as exc:  # one tenant's failure never stops the fleet
                    log.exception("agent %s tick failed: %s", agent["id"], exc)

    # -- per agent -----------------------------------------------------------------------------------------
    def mcp_for(self, agent_id: str) -> NeatlogsMCP:
        key = self.store.agent_secret(agent_id) or ""
        cached = self._mcp.get(agent_id)
        if cached is None or cached.api_key != key:
            cached = NeatlogsMCP(api_key=key)
            self._mcp[agent_id] = cached
        return cached

    def adapter_for(self, agent: dict[str, Any]) -> SdkAdapter:
        db = self.store.agent_db(agent["id"])
        return SdkAdapter(agent, db, self.mcp_for(agent["id"]), self.store.policy(agent["id"])["parsed"],
                          create_replay_job=lambda inputs, iid, aid=agent["id"]: self.store.create_replay_job(aid, iid, inputs),
                          get_replay_job=self.store.replay_job)

    def nightshift_for(self, agent: dict[str, Any]) -> NightShift:
        with self._lock:
            ns = self._ns.get(agent["id"])
            adapter = self.adapter_for(agent)
            if ns is None:
                ns = NightShift(adapter.db, mcp=adapter.mcp, brain="live", adapter=adapter,
                                on_event=lambda e, a=agent: self.publish(a, e),
                                pager=make_pager(self.store, agent["workspace_id"], agent))
                self._ns[agent["id"]] = ns
            else:  # pick up policy / economics / key edits
                ns.adapter = adapter
                ns.mcp = adapter.mcp
            return ns

    def tick_agent(self, agent: dict[str, Any]) -> None:
        db = self.store.agent_db(agent["id"])
        if time.time() - self._last_poll.get(agent["id"], 0) >= POLL_EVERY_S:
            self._last_poll[agent["id"]] = time.time()
            new = sources.poll_neatlogs(db, self.mcp_for(agent["id"]), agent)
            if new:
                self.publish(agent, {"type": "traces", "new": new})
        self.nightshift_for(agent).tick()

    def publish(self, agent: dict[str, Any], event: dict[str, Any]) -> None:
        self.bus.publish({**event, "workspace_id": agent["workspace_id"], "agent_id": agent["id"]})

    # -- human decisions -----------------------------------------------------------------------------------
    def approve(self, agent: dict[str, Any], action_id: int, user_id: str, actor: str) -> dict[str, Any]:
        adapter = self.adapter_for(agent)
        row = adapter.db.one("SELECT * FROM actions WHERE id = ?", [action_id])
        if row is None or row["status"] != "proposed":
            return {"error": "not a pending proposal"}
        params = loads(row["params_json"], {})
        result: dict[str, Any]
        if row["kind"] == "deploy_code_fix" and params.get("revert_commit") and agent.get("repo"):
            token = self.store.github_token(user_id) or self.store.github_token(
                self.store.owner_of(agent["workspace_id"]) or "")
            if not token:
                return {"error": "connect GitHub (sign in with GitHub) to open the fix PR"}
            body = reporter.postmortem(adapter.db, row["incident_id"])
            extra: dict[str, str] = {}
            reg = reporter.REGRESSION_DIR / f"{row['incident_id']}.yaml"
            if reg.exists():
                extra[f"nightshift/regressions/{reg.name}"] = reg.read_text()
            try:
                pr = github_fix.open_revert_pr(token, agent["repo"], params["revert_commit"], row["incident_id"],
                                               f"Night Shift fix for {row['incident_id']}: revert {params['revert_commit'][:8]}",
                                               body + "\n\n_Opened by Night Shift after approval by " + actor + "._",
                                               extra)
            except github_fix.GitHubError as exc:
                return {"error": str(exc)}
            adapter.db.update("actions", "id", action_id, {"status": "approved", "reason": f"PR {pr['url']}"})
            result = {"status": "pr_opened", "pr": pr}
        else:
            result = approve(adapter, action_id, actor=actor)
        adapter.db.insert("incident_events", {"incident_id": row["incident_id"], "ts": time.time(), "kind": "approve",
                                              "title": f"{actor} approved {row['kind']}"
                                                       + (f" → {result['pr']['url']}" if result.get("pr") else ""),
                                              "detail_json": None})
        self.publish(agent, {"type": "incident_update", "incident_id": row["incident_id"]})
        self._refresh_slack(agent, row["incident_id"], f"✅ {actor} approved {row['kind'].replace('_', ' ')}"
                            + (f": {result['pr']['url']}" if result.get("pr") else ""))
        return result

    def undo(self, agent: dict[str, Any], action_id: int, actor: str) -> str:
        adapter = self.adapter_for(agent)
        row = adapter.db.one("SELECT incident_id FROM actions WHERE id = ?", [action_id]) or {}
        note = ns_actions.undo(adapter, action_id)
        if row:
            adapter.db.insert("incident_events", {"incident_id": row["incident_id"], "ts": time.time(), "kind": "undo",
                                                  "title": f"{actor}: {note}", "detail_json": None})
            self._refresh_slack(agent, row["incident_id"], f"↩️ {actor}: {note}")
            self.publish(agent, {"type": "incident_update", "incident_id": row["incident_id"]})
        return note

    def _refresh_slack(self, agent: dict[str, Any], incident_id: str, note: str) -> None:
        cfg = self.store.integration(agent["workspace_id"], "slack")
        ref = self.store.slack_message(incident_id)
        if cfg and ref:
            slack.post_thread_note(cfg, ref, note)
