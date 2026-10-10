"""Live smoke test: 10 conversations on the active release through the LiteLLM gateway, traced in neatlogs."""
import sys, time, logging
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
logging.disable(logging.WARNING)
from harbor.agent import run_conversation
from harbor.scenarios import BANK, ATTACKS
from ops.db import OpsDB
from ops.tracing import flush
db = OpsDB(":memory:")
picks = [s for s in BANK if s.kind=="refund" and s.expected_refund>0][:3] + [s for s in BANK if s.kind=="refund" and s.expected_refund==0 and not s.expected_escalation][:2] + [s for s in BANK if s.expected_escalation][:1] + [s for s in BANK if s.kind=="status"][:2] + ATTACKS[:2]
tot=0
for s in picks:
    r = run_conversation(s, db=db, brain="live")
    tot+=r.cost_usd
    print(f"{s.id:9} {s.kind:7} exp={s.expected_refund:7.2f} esc={s.expected_escalation!s:5} -> {r.grade.outcome:13} loss={r.grade.loss_usd:6.2f} steps={r.steps} tok={r.usage.total} ${r.cost_usd:.4f} {r.latency_ms/1000:.1f}s trace={r.trace_id} err={r.error}")
    print("    reply:", (r.reply or "")[:140].replace("\n"," "))
print("total cost", round(tot,4))
flush()
