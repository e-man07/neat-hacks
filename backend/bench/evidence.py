"""Write evidence/neatlogs.md and evidence/entire.md from live data (neatlogs MCP, Entire CLI).

    uv run python -m bench.evidence run3-live
"""

from __future__ import annotations

import json
import subprocess
import sys

from harbor import releases
from nightshift import provenance
from nightshift.neatlogs_mcp import NeatlogsMCP, NeatlogsMCPError
from ops.settings import REPO_DIR


def neatlogs_md(run: str) -> str:
    m = NeatlogsMCP()
    who = m.whoami()
    results = json.loads((REPO_DIR / "evidence" / "benchmark" / run / "results.json").read_text())
    lines = ["# neatlogs evidence", "",
             f"Project: **{who.get('project_name')}** (`{who.get('project_id')}`, tier {who.get('tier')}). "
             "Trace ids below can be searched in the neatlogs app.", "",
             "## How Night Shift uses neatlogs", "",
             "- **SDK tracing** (`ops/tracing.py`, `ops/llm.py`): every Harbor conversation is a WORKFLOW trace "
             "(`harbor-support`) with auto-instrumented LLM spans and a TOOL span per tool call; every Night Shift "
             "incident is a WORKFLOW trace (`nightshift`) containing the investigator's AGENT span, its TOOL spans and the "
             "verification replays.",
             "- **Read-back over MCP** (`nightshift/neatlogs_mcp.py`): the investigator calls `search_traces` and "
             "`get_trace_context` during an investigation and cites trace ids in its diagnosis and postmortem.",
             "- **Detections** (`nightshift/reporter.py`): after a prompt-injection incident Night Shift creates a regex "
             "detection for the attack signature so future traces are flagged.", ""]
    for wf in ("harbor-support", "nightshift"):
        try:
            res = m.search_traces("conversation" if wf == "harbor-support" else "incident", limit=1, workflow_name=wf)
            lines.append(f"- `{wf}` traces matching a sample query: {res.get('total')}")
        except NeatlogsMCPError as exc:
            lines.append(f"- `{wf}`: search failed ({exc})")
    try:
        det = m.list_detections()
        names = [d.get("display_name") or d.get("name") for d in (det.get("detections", det) if isinstance(det, dict) else det) or []
                 if isinstance(d, dict)]
        lines.append(f"- Active detections: {', '.join(n for n in names if n) or '—'}")
    except NeatlogsMCPError as exc:
        lines.append(f"- detections: {exc}")
    lines += ["", f"## Traces from benchmark run `{run}`", "",
              "| Incident | Night Shift investigation trace | Evidence traces cited | Before (baseline) | During | After |",
              "|---|---|---|---|---|---|"]
    for r in results:
        lines.append(f"| {r['incident']} {r['name']} | `{r['nightshift_trace_id']}` | "
                     + ", ".join(f"`{t}`" for t in r["evidence_trace_ids"][:3])
                     + f" | `{(r['before']['trace_ids'] or ['—'])[0]}` | `{(r['during']['trace_ids'] or ['—'])[0]}` "
                       f"| `{(r['after']['trace_ids'] or ['—'])[0]}` |")
    sample = next((r for r in results if r.get("evidence_trace_ids")), None)
    if sample:
        tid = sample["evidence_trace_ids"][0]
        try:
            ctx = m.get_trace_context(tid, max_chars_per_field=200)
            lines += ["", f"## One trace, read back through the MCP (`{tid}`)", "", "```json",
                      json.dumps({k: ctx.get(k) for k in ("trace_id", "workflow", "status", "llm_calls", "tool_calls",
                                                          "total_tokens", "latency_ms", "span_count")}, indent=2),
                      "```", "", "| span | type | status |", "|---|---|---|"]
            for s in (ctx.get("spans") or [])[:12]:
                lines.append(f"| {s.get('name')} | {s.get('type')} | {s.get('status')} |")
        except NeatlogsMCPError as exc:
            lines.append(f"\n(trace read-back failed: {exc})")
    return "\n".join(lines) + "\n"


def entire_md() -> str:
    lines = ["# Entire evidence", "",
             "Entire is enabled for Claude Code in this repo (`.entire/settings.json`, git-refs checkpoints, custom "
             "redaction rules). Two uses:", "",
             "1. **Development**: this repo's commits carry `Entire-Checkpoint:` trailers linking each change to the "
             "coding-agent session that produced it.",
             "2. **Runtime provenance**: every Harbor release after r41 was written by a *separate* Claude Code session "
             "(`claude -p` with a realistic developer request). When a release causes an incident, Night Shift follows "
             "release → commit → checkpoint → the developer's prompt and the coding agent's final note, plus the "
             "entire-graph semantic change list (`nightshift/provenance.py`).", "",
             "## Releases and the sessions behind them", "",
             "| Release | Commit | Checkpoint | Session | Agent / model | Developer prompt |", "|---|---|---|---|---|---|"]
    for rel in releases.list_releases():
        p = provenance.for_release(rel.id)
        if rel.id == releases.BASELINE_RELEASE:
            prompt = "— (baseline, written in the main build session; see hackathon.md)"
        else:
            prompt = (p.coding_prompts[0] if p.coding_prompts else "—").replace("|", "/").replace("\n", " ")[:160]
        lines.append(f"| {rel.id} {rel.title} | [`{(p.commit or '')[:8]}`]({p.entire_url}) | `{p.checkpoint_id}` | "
                     f"`{(p.session_id or '')[:8]}` | {p.agent} {p.model} | {prompt} |")
    lines += ["", "## What the coding agents warned (and nobody read)", ""]
    for rel in releases.list_releases():
        if rel.id == releases.BASELINE_RELEASE:
            continue
        p = provenance.for_release(rel.id)
        if p.coding_agent_note:
            lines += [f"### {rel.id} — {rel.title}", "", "> " + p.coding_agent_note.replace("\n", "\n> "), ""]
    lines += ["## entire-graph: what r43 changed", "", "```", provenance.for_release("r43").graph_changes or "—", "```", "",
              "## Checkpoints on this branch", "", "```"]
    out = subprocess.run(["entire", "checkpoint", "list"], cwd=REPO_DIR, capture_output=True, text=True, timeout=60)
    lines += [out.stdout.strip()[:6000], "```"]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    run = sys.argv[1] if len(sys.argv) > 1 else "run3-live"
    (REPO_DIR / "evidence" / "neatlogs.md").write_text(neatlogs_md(run))
    (REPO_DIR / "evidence" / "entire.md").write_text(entire_md())
    print("wrote evidence/neatlogs.md and evidence/entire.md")
