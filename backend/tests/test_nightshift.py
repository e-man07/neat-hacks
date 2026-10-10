import shutil

import pytest

from harbor import releases
from harbor.agent import run_conversation
from harbor.deploy import deploy
from harbor.scenarios import ATTACKS, BANK, TrafficMix
from nightshift import detector, policy
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
    assert policy.decide("rollback_release", {"target": "r41"}, "prompt_regression", 0.9, 5).mode == "page_only"
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
