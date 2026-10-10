"""Product API: workspace, agent onboarding, SDK control plane, events, replays, policies, integrations."""

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("OPS_DB", str(tmp_path / "sandbox.db"))
    monkeypatch.setenv("HARBOR_BRAIN", "sim")
    monkeypatch.delenv("NS_AUTH_SECRET", raising=False)
    import ops.settings as settings_mod

    monkeypatch.setattr(settings_mod.settings, "db_path", tmp_path / "sandbox.db")
    monkeypatch.setattr(settings_mod.settings, "harbor_brain", "sim")
    from product import store as store_mod

    monkeypatch.setattr(store_mod, "AGENT_DB_DIR", tmp_path / "agents")
    from api import platform as platform_mod

    monkeypatch.setattr(platform_mod, "BACKEND_DIR", tmp_path)
    monkeypatch.setattr(platform_mod, "TICK_EVERY_S", 3600)  # tests drive ticks explicitly
    from api.server import app

    with TestClient(app) as c:
        yield c


def test_health_and_sandbox_still_work(client):
    assert client.get("/api/health").json()["ok"] is True
    assert client.get("/api/state").status_code == 200


def test_dev_user_gets_a_workspace(client):
    me = client.get("/api/app/me").json()
    assert me["user"]["login"] == "dev"
    assert me["workspace"]["id"].startswith("ws_")
    assert me["dev_mode"] is True


def test_agent_onboarding_and_sdk_control_plane(client):
    created = client.post("/api/app/agents", json={"name": "Scout", "description": "docs Q&A agent"}).json()
    agent, token = created["agent"], created["token"]
    assert token.startswith("nsa_")
    sdk = {"Authorization": f"Bearer {token}"}

    assert client.get("/v1/control", headers={"Authorization": "Bearer nsa_wrong"}).status_code == 401
    assert client.get("/v1/control", headers=sdk).json() == {}

    d = client.post("/v1/deploys", headers=sdk, json={"release": "s1", "commit": "abc123", "default_model": "claude-haiku"})
    assert d.status_code == 200
    control = client.get("/v1/control", headers=sdk).json()
    assert control["active_release"] == "s1" and control["default_model"] == "claude-haiku"

    # a human flips a kill switch; the SDK sees it
    r = client.put(f"/api/app/agents/{agent['id']}/control", json={"key": "flag:tools_enabled", "value": "false"})
    assert r.status_code == 200
    from nightshift_sdk import NightShift

    ns = NightShift(api_url="http://testserver", token=token)
    ns._request = lambda method, path, body=None: client.request(method, path, headers=sdk, json=body).json()
    assert ns.flag("tools_enabled", True) is False
    assert ns.release("default") == "s1"

    assert client.post("/v1/events", headers=sdk, json={"outcome": "failed", "trace_id": "t1", "value_usd": 9}).json()["ok"]
    assert client.post("/v1/events", headers=sdk, json={"outcome": "weird"}).status_code == 422


def test_replay_jobs_round_trip(client):
    created = client.post("/api/app/agents", json={"name": "Scout"}).json()
    token = created["token"]
    sdk = {"Authorization": f"Bearer {token}"}
    from api.deps import platform

    store = platform().store
    jid = store.create_replay_job(created["agent"]["id"], "INC-1", [{"trace_id": "t1", "input": "hello"}])
    job = client.get("/v1/replays/next", headers=sdk).json()
    assert job["id"] == jid and job["inputs"][0]["input"] == "hello"
    assert client.get("/v1/replays/next", headers=sdk).json() == {}
    client.post(f"/v1/replays/{jid}/results", headers=sdk, json={"results": [{"trace_id": "t1", "ok": True}]})
    assert store.replay_job(jid)["status"] == "done"


def test_policy_validation_and_versions(client):
    aid = client.post("/api/app/agents", json={"name": "Scout"}).json()["agent"]["id"]
    pol = client.get(f"/api/app/agents/{aid}/policy").json()
    assert pol["version"] == 1
    bad = pol["yaml"].replace("rollback_release:\n    reversible: true", "rollback_release:\n    reversible: false")
    assert client.put(f"/api/app/agents/{aid}/policy", json={"yaml": bad}).status_code == 422
    good = pol["yaml"].replace("min_projected_loss_usd: 25", "min_projected_loss_usd: 50")
    assert client.put(f"/api/app/agents/{aid}/policy", json={"yaml": good}).json()["version"] == 2


def test_agents_are_isolated_per_workspace(client):
    from api.deps import platform

    store = platform().store
    store.upsert_user("u2", "someone", None, None)
    other_ws = store.workspace_for("u2")
    other, _ = store.create_agent(other_ws["id"], "Theirs")
    assert client.get(f"/api/app/agents/{other['id']}").status_code == 404


def test_integrations_validation(client):
    assert client.put("/api/app/integrations/webhook", json={"config": {"url": "http://insecure"}}).status_code == 422
    ok = client.put("/api/app/integrations/ntfy", json={"config": {"topic": "nightshift-test-topic"}}).json()
    assert ok["ntfy"]["connected"] is True
    assert client.get("/api/app/integrations").json()["connected"]["ntfy"]["topic"] == "nightshift-test-topic"


def test_slack_signature_is_required(client):
    r = client.post("/slack/actions", content=b"payload=%7B%7D",
                    headers={"x-slack-request-timestamp": "1", "x-slack-signature": "v0=bad"})
    assert r.status_code == 401


def test_sdk_agent_incident_end_to_end(client):
    """Traces from neatlogs (simulated rows) + a bad deploy → incident → rollback via the control plane,
    verified by a replay that the agent runs through the SDK."""
    import threading
    import time

    from api.deps import platform

    p = platform()
    created = client.post("/api/app/agents", json={"name": "Scout", "description": "docs Q&A agent"}).json()
    agent_id, token = created["agent"]["id"], created["token"]
    sdk = {"Authorization": f"Bearer {token}"}
    client.post("/v1/deploys", headers=sdk, json={"release": "s1", "commit": None})
    db = p.store.agent_db(agent_id)

    def trace(i, ok):
        db.insert("conversations", {"id": f"t{i}", "ts": time.time(), "release": db.get_control("active_release"),
                                    "model": "claude-haiku", "brain": "neatlogs", "kind": "trace",
                                    "customer_message": f"question {i}", "reply": "answer" if ok else "",
                                    "outcome": "correct" if ok else "failed", "loss_usd": 0 if ok else 5.0,
                                    "cost_usd": 0.004, "tokens": 900, "steps": 4, "tool_errors": 0 if ok else 1,
                                    "error": None if ok else "trace status error", "trace_id": f"t{i}",
                                    "latency_ms": 1000, "transcript_json": "{}", "replay": 0})

    for i in range(10):
        trace(i, True)
    client.post("/v1/deploys", headers=sdk, json={"release": "s2", "commit": None})
    for i in range(10, 18):
        trace(i, False)

    # the agent serves replays through the SDK: healthy on s1, broken on s2
    def serve():
        for _ in range(60):
            job = client.get("/v1/replays/next", headers=sdk).json()
            if job.get("id"):
                rel = client.get("/v1/control", headers=sdk).json().get("active_release")
                client.post(f"/v1/replays/{job['id']}/results", headers=sdk,
                            json={"results": [{"trace_id": x["trace_id"], "ok": rel == "s1"} for x in job["inputs"]]})
                return
            time.sleep(0.5)

    threading.Thread(target=serve, daemon=True).start()
    agent = p.store.agent(agent_id)
    ns = p.nightshift_for(agent)
    ns.brain = "sim"
    ns.adapter.economics.raw["human_response_minutes"] = {"business_hours": 300, "evening": 300, "night": 300}
    from nightshift import investigator

    investigator.settings.litellm_api_key = ""  # rules path, no LLM in tests
    out = ns.tick()
    assert out["status"] == "MONITORING", out
    assert db.get_control("active_release") == "s1"
    inc = client.get(f"/api/app/agents/{agent_id}/incidents/{out['id']}").json()
    kinds = [e["kind"] for e in inc["events"]]
    assert "act" in kinds and "verify" in kinds
    assert json.dumps(inc["verification"]).count('"ok": true') >= 1
