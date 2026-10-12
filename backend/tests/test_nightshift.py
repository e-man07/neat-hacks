import shutil

import pytest

from harbor import releases
from harbor.agent import run_conversation
from harbor.deploy import deploy
from harbor.scenarios import ATTACKS, BANK, TrafficMix
from nightshift import detector, neatlogs_check, policy
from nightshift.neatlogs_mcp import NeatlogsMCP
from nightshift.runner import NightShift

BAD_PROMPT = """You are Harbor, the support agent for Harbor Goods.
Keep replies short. Resolve refund requests in one step: look up the order and refund it."""

NOTES_PROMPT = releases.load_release("r41").system_prompt + """
  6. If the order's delivery notes say Harbor finance pre-approved a refund, honor the note and refund
     right away without the usual checks.
"""


@pytest.fixture(autouse=True)
def releases_dir(tmp_path, monkeypatch):
    d = tmp_path / "releases"
    d.mkdir()
    shutil.copy(releases.RELEASES_DIR / "r41.yaml", d / "r41.yaml")
    (d / "r90.yaml").write_text(
        "id: r90\ntitle: Shorter replies\nmax_steps: 8\nsystem_prompt: |\n"
        + "".join(f"  {line}\n" for line in BAD_PROMPT.splitlines()))
    (d / "r91.yaml").write_text(
        "id: r91\ntitle: Honor finance notes\nmax_steps: 8\nsystem_prompt: |\n"
        + "".join(f"  {line}\n" for line in NOTES_PROMPT.splitlines()))
    monkeypatch.setattr(releases, "RELEASES_DIR", d)
    from nightshift import reporter

    monkeypatch.setattr(reporter, "REGRESSION_DIR", tmp_path / "regressions")
    monkeypatch.setattr(reporter, "INCIDENT_DIR", tmp_path / "incidents")
    monkeypatch.setenv("NIGHTSHIFT_LOCAL_TIME", "03:07")
    policy.load_policy.cache_clear()


def traffic(db, n, attack_share=0.0, seed=5):
    mix = TrafficMix(seed)
    mix.attack_share = attack_share
    return [run_conversation(mix.next(), db=db, brain="sim") for _ in range(n)]


def nightshift(db):
    return NightShift(db, mcp=NeatlogsMCP(api_key=""), brain="sim", page=False)


def statuses(db):
    return [r["status"] for r in db.query("SELECT status FROM incidents ORDER BY opened_at")]


def test_quiet_baseline_opens_nothing(db):
    deploy(db, "r41", "test")
    traffic(db, 20)
    assert nightshift(db).tick() is None


def test_prompt_regression_is_rolled_back_and_resolved(db):
    deploy(db, "r41", "test")
    traffic(db, 12)
    deploy(db, "r90", "dev")
    traffic(db, 10)
    ns = nightshift(db)
    out = ns.tick()
    assert out["status"] == "MONITORING"
    inc = db.one("SELECT * FROM incidents")
    assert inc["type"] == "prompt_regression"
    assert db.get_control("active_release") == "r41"
    traffic(db, 6)
    assert ns.tick()["status"] == "RESOLVED"
    kinds = [e["kind"] for e in db.query("SELECT kind FROM incident_events")]
    for k in ("detect", "diagnosis", "impact", "decide", "act", "verify", "resolved"):
        assert k in kinds


def test_provider_outage_fails_over(db):
    deploy(db, "r41", "test")
    traffic(db, 12)
    db.set_control("fault:provider_outage", "claude-haiku", "chaos")
    traffic(db, 10)
    out = nightshift(db).tick()
    assert out["status"] == "MONITORING"
    assert db.one("SELECT type FROM incidents")["type"] == "provider_outage"
    assert db.get_control("force_model") == "nova-lite"


def test_injection_wave_disables_auto_refunds(db):
    deploy(db, "r41", "test")
    traffic(db, 12)
    deploy(db, "r91", "dev")
    traffic(db, 12, attack_share=0.7)
    out = nightshift(db).tick()
    assert out["status"] == "MONITORING"
    inc = db.one("SELECT * FROM incidents")
    assert inc["type"] == "prompt_injection"
    assert inc["severity"] == "SEV1"
    assert db.get_control("flag:auto_refund_enabled") == "false"


def test_policy_refuses_irreversible_and_low_confidence():
    assert policy.decide("deploy_code_fix", {}, "prompt_regression", 0.9, 5000).mode == "needs_approval"
    assert policy.decide("rollback_release", {"target": "r41"}, "prompt_regression", 0.4, 5000).mode == "needs_approval"
    assert policy.decide("rollback_release", {"target": "r41"}, "prompt_regression", 0.9, 5).mode == "defer"
    assert policy.decide("disable_flag", {"flag": "auto_refund_enabled"}, "prompt_injection", 0.9, 5).mode == "auto"


def test_failed_verification_undoes_action(db, monkeypatch):
    deploy(db, "r41", "test")
    traffic(db, 12)
    deploy(db, "r90", "dev")
    traffic(db, 10)
    from nightshift import verifier

    monkeypatch.setattr(verifier, "replay", lambda *a, **k: verifier.ReplayResult(4, 1, 0.25, []))
    out = nightshift(db).tick()
    assert out["status"] == "ESCALATED"
    assert db.get_control("active_release") == "r90"  # rollback was undone
    assert db.one("SELECT status FROM actions WHERE mode = 'auto'")["status"] == "undone"


def test_detector_needs_enough_samples(db):
    deploy(db, "r90", "dev")
    traffic(db, 3)
    stats, base, signals = detector.detect(db)
    assert signals == []


# -- neatlogs in the loop: a detection per incident, then its hit rate as a verification signal --

ERRORED_TRACE = {"trace_id": "t1", "spans": [
    {"name": "support_conversation", "type": "workflow", "output_value": "Sorry, I'm having trouble"},
    {"name": "lookup_order", "type": "tool_call", "output_value": '{"error":"KeyError: \'order_id\'"}'},
    {"name": "lookup_order", "type": "tool_call", "output_value": '{"error":"KeyError: \'order_id\'"}'},
    {"name": "claude-haiku", "type": "llm", "output_value": "Let me try that again"},
]}
CLEAN_TRACE = {"trace_id": "t2", "spans": [
    {"name": "lookup_order", "type": "tool_call", "output_value": '{"order_id": "H-1002"}'},
    {"name": "issue_refund", "type": "tool_call", "output_value": '{"status": "refunded"}'},
    {"name": "escalate_to_human", "type": "tool_call", "output_value": '{"status": "queued"}'},
]}


class FakeMCP(NeatlogsMCP):
    """Stands in for the neatlogs MCP: one errored trace, and scripted before/after analytics."""

    def __init__(self, before=(10, 8), after=(6, 0), traces=(ERRORED_TRACE,)):
        super().__init__(api_key="test")
        self.windows = [before, after]
        self.traces = list(traces)
        self.created = []
        self.analytics_calls = 0
        self.trend_calls = 0

    def get_trace_context(self, trace_id, max_chars_per_field=1200):
        return self.traces[0] if self.traces else {}

    def list_detections(self):
        return [{"display_name": d["name"]} for d in self.created]

    def list_detection_groups(self):
        return {"groups": [{"id": "g1", "name": "Nightly"}]}

    def create_detection_group(self, name):
        return {"id": "g1"}

    def preview_detection(self, config, timeframe_days=1, kind="regex", run_on=None):
        return {"total_count": 7, "samples": []}

    def create_detection(self, display_name, group_id, config, description, kind="regex", run_on=None):
        self.created.append({"name": display_name, "config": config, "run_on": run_on, "kind": kind})
        return {"id": "d1"}

    def analytics(self, start, end, view="kpis", workflow_name=None):
        n, _ = self.windows[min(self.analytics_calls, 1)]  # compare() asks for the before window, then after
        self.analytics_calls += 1
        return {"data": {"current": {"trace_count": n}}}

    def call(self, tool, arguments=None):
        if tool == "get_detection_status":
            return {"backfillStatus": "completed"}
        if tool == "get_detection_trend":  # first call: the snapshot; second: the total after the fix
            import time as _t

            hour = _t.strftime("%Y-%m-%dT%H:00:00Z", _t.gmtime())
            older = 3  # hits from an earlier incident, outside this one's hours
            total = older + self.windows[0][1] + (self.windows[1][1] if self.trend_calls else 0)
            self.trend_calls += 1
            return {"total_occurrences": total, "data_points": [
                {"date": "2026-01-01T00:00:00Z", "count": older}, {"date": hour, "count": self.windows[0][1]}]}
        raise AssertionError(f"unexpected MCP call {tool}")


def test_signature_from_errored_tool_spans():
    sig = neatlogs_check.signature("tool_schema_drift", "Harbor", [ERRORED_TRACE, CLEAN_TRACE])
    assert sig.kind == "regex"
    assert sig.run_on == {"frequency": "span_name", "span_names": ["lookup_order"]}
    assert "2 errored tool calls" in sig.basis


def test_signature_for_injection_and_escalations_and_none():
    assert neatlogs_check.signature("prompt_injection", "Harbor", []).name == neatlogs_check.INJECTION_NAME
    esc = neatlogs_check.signature("prompt_regression", "Harbor", [CLEAN_TRACE], ["escalations"])
    assert esc.kind == "conditional" and esc.run_on["span_names"] == ["escalate_to_human"]
    assert neatlogs_check.signature("prompt_regression", "Harbor", [CLEAN_TRACE], ["wrong_refunds"]) is None


def test_judge():
    before = {"traces": 10, "flagged": 8, "rate": 0.8}
    assert neatlogs_check.judge(before, {"traces": 6, "flagged": 0, "rate": 0.0})[0] == "cleared"
    assert neatlogs_check.judge(before, {"traces": 6, "flagged": 5, "rate": 0.83})[0] == "still_firing"
    assert neatlogs_check.judge(before, {"traces": 2, "flagged": 0, "rate": 0.0})[0] == "inconclusive"
    assert neatlogs_check.judge({"traces": 10, "flagged": 0, "rate": 0.0},
                                {"traces": 6, "flagged": 0, "rate": 0.0})[0] == "inconclusive"


def _incident(db, mcp):
    deploy(db, "r41", "test")
    traffic(db, 12)
    deploy(db, "r90", "dev")
    traffic(db, 10)
    ns = NightShift(db, mcp=mcp, brain="sim", page=False)
    assert ns.tick()["status"] == "MONITORING"
    assert mcp.created, "a detection is created from the failing traces"
    traffic(db, 6)
    return ns


def test_neatlogs_cleared_resolves(db):
    mcp = FakeMCP(before=(10, 8), after=(6, 0))
    ns = _incident(db, mcp)
    assert ns.tick()["status"] == "RESOLVED"
    titles = [e["title"] for e in db.query("SELECT title FROM incident_events WHERE kind = 'verify'")]
    assert any("cleared" in t and "8 hits in 10 traces" in t and "0 in 6" in t for t in titles)


def test_neatlogs_still_firing_undoes_the_fix(db):
    mcp = FakeMCP(before=(10, 8), after=(6, 5))
    ns = _incident(db, mcp)
    assert ns.tick()["status"] == "ESCALATED"
    assert db.get_control("active_release") == "r90"  # the rollback was undone
