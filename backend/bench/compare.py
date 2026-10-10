"""Compare two benchmark runs (Night Shift before vs after a change) and snapshot the latest run
for the static web build.

    uv run python -m bench.compare run1-live run3-live
"""

from __future__ import annotations

import json
import shutil
import sys

from ops.settings import REPO_DIR

ROOT = REPO_DIR / "evidence" / "benchmark"


def load(run: str) -> list[dict]:
    """Load a run and re-score it against the current incident specs, so both runs are judged alike."""
    from bench.benchmark import INCIDENTS

    specs = {i.id: i for i in INCIDENTS}
    rows = json.loads((ROOT / run / "results.json").read_text())
    for r in rows:
        spec = specs.get(r["incident"])
        if not spec:
            continue
        types = spec.expected_type if isinstance(spec.expected_type, tuple) else (spec.expected_type,)
        acts = spec.expected_action if isinstance(spec.expected_action, tuple) else (spec.expected_action,)
        r["name"] = spec.name
        r["type_correct"] = r.get("diagnosed_type") in types
        if r.get("status") == "DEFERRED":
            r["action_correct"] = "defer" in acts
        elif r.get("status") in ("RESOLVED", "MONITORING"):
            r["action_correct"] = r.get("action") in acts and r.get("action_mode") == "auto"
        else:  # waiting on a human when policy should have let it act (or defer)
            r["action_correct"] = False
            r["action"] = f"paged a human ({r.get('action')})"
    return rows


def main(before: str, after: str) -> None:
    a, b = load(before), load(after)
    by_a = {r["incident"]: r for r in a}
    lines = [f"# Night Shift improved: `{before}` → `{after}`", "",
             "Same six staged incidents, same live models. Between the runs we changed Night Shift itself, "
             "based on what run 1 showed (see the build log):", "",
             "- investigator: explicit confidence calibration; a diagnosis without a confidence is rejected and re-submitted",
             "- low-impact incidents are deferred to the morning instead of paging someone",
             "- impact is priced from the conversations after the change, re-measured after the investigation",
             "- neatlogs trace read-back uses the full trace context (selective fields are disabled server-side)",
             "", "| # | Incident | Run | Diagnosis | Action | Outcome | Detect → contain | At risk | LLM cost |",
             "|---|---|---|---|---|---|---|---|---|"]
    for rb in b:
        ra = by_a.get(rb["incident"])
        for tag, r in (("before", ra), ("after", rb)):
            if not r:
                continue
            lines.append(
                f"| {r['incident']} | {r['name']} | {tag} | {'✅' if r['type_correct'] else '❌'} {r['diagnosed_type']} "
                f"(conf {r['confidence']}) | {'✅' if r['action_correct'] else '❌'} {r['action']} ({r['action_mode']}) "
                f"| {r['status']} | {r['seconds_detect_to_mitigate'] if r['seconds_detect_to_mitigate'] is not None else '—'}s "
                f"| ${r['projected_loss_if_waiting'] or 0:,.0f} | ${r['nightshift_cost_usd']} |")
    score = lambda rs: sum(1 for r in rs if r["type_correct"] and r["action_correct"])  # noqa: E731
    lines += ["", f"**Handled correctly: {score(a)}/{len(a)} → {score(b)}/{len(b)}**", "",
              "Both runs are scored against the same incident specs. Dollar figures are not comparable across the two "
              "runs: between them we lowered Harbor's production volume in the unit economics (night 420 → 90 "
              "conversations/hour) to match a mid-size store.", "",
              "Harbor's own before/during/after numbers for each incident (the production agent improving once "
              f"Night Shift acts) are in [`{after}/SUMMARY.md`]({after}/SUMMARY.md)."]
    (REPO_DIR / "evidence" / "before-after.md").write_text("\n".join(lines) + "\n")
    shutil.copy(ROOT / after / "results.json", REPO_DIR / "web" / "public" / "benchmark.json")
    snap = json.loads((REPO_DIR / "web" / "public" / "benchmark.json").read_text())
    (REPO_DIR / "web" / "public" / "benchmark.json").write_text(json.dumps({"run": after, "results": snap}))
    print("\n".join(lines))


if __name__ == "__main__":
    main(*sys.argv[1:3])
