from harbor import orders_service, policy, adapters
from harbor.agent import effective_config, run_conversation
from harbor.deploy import deploy, last_known_good
from harbor.scenarios import ATTACKS, BANK, BY_ID


def test_catalogue_is_deterministic():
    assert len(orders_service.ORDERS) == 66
    assert orders_service.ORDERS["H-1071"].tags == ["attack"]


def test_policy_rules():
    o = adapters.lookup_v1("H-1071")
    assert policy.evaluate(o)["eligible"] is False


def test_bank_has_every_kind():
    kinds = {s.kind for s in BANK}
    assert kinds == {"status", "refund"}
    assert any(s.expected_escalation for s in BANK)
    assert any(s.expected_refund > 0 for s in BANK)
    assert any(s.expected_refund == 0 and s.kind == "refund" for s in BANK)
    assert len(ATTACKS) == 6


def test_baseline_sim_is_correct_on_whole_bank(db):
    outcomes = [run_conversation(s, db=db, brain="sim").grade.outcome for s in BANK]
    assert set(outcomes) == {"correct"}, outcomes


def test_refunds_hit_ledger_unless_dry_run(db):
    s = next(s for s in BANK if s.expected_refund > 0)
    run_conversation(s, db=db, brain="sim")
    assert db.one("SELECT COUNT(*) n FROM ledger")["n"] == 1
    run_conversation(s, db=db, brain="sim", dry_run=True)
    assert db.one("SELECT COUNT(*) n FROM ledger")["n"] == 1


def test_injection_succeeds_on_baseline_sim(db):
    r = run_conversation(ATTACKS[0], db=db, brain="sim")
    assert r.grade.outcome == "wrong_refund"
    assert r.grade.loss_usd > 0


def test_disabling_auto_refund_contains_injection(db):
    db.set_control("flag:auto_refund_enabled", "false", "test")
    cfg = effective_config(db)
    assert "issue_refund" not in cfg.tools
    r = run_conversation(ATTACKS[0], db=db, brain="sim")
    assert r.grade.outcome in ("correct", "escalated")
    assert r.grade.loss_usd < 10


def test_provider_outage_and_failover(db):
    s = BANK[0]
    db.set_control("fault:provider_outage", "claude-haiku", "test")
    r = run_conversation(s, db=db, brain="sim")
    assert r.grade.outcome == "failed"
    db.set_control("force_model", "nova-lite", "test")
    r = run_conversation(s, db=db, brain="sim")
    assert r.grade.outcome == "correct"


def test_deploy_and_last_known_good(db):
    deploy(db, "r41", "test")
    assert db.get_control("active_release") == "r41"
    assert last_known_good(db, "r41") == "r41"
