"""Scout: the docs Q&A assistant for Lumen, a (fictional) product analytics SaaS.

Scout is an ordinary customer agent. It knows nothing about Nightly's internals: it is traced by
neatlogs, reads its release, model and limits through the Nightly SDK, reports deploys and graded
outcomes, and runs verification replays when Nightly asks.

    python scout.py ask "How many steps can a funnel have?"
    python scout.py serve --rate 6          # live traffic + replay worker
    python scout.py deploy s2               # report a deploy (commit = last change to the release)
    python scout.py eval --release s2       # offline eval over the question bank
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import yaml

HERE = Path(__file__).resolve().parent
DOCS_DIR = HERE / "docs"
RELEASES_DIR = HERE / "releases"
DEFAULT_RELEASE = "s1"
WORKFLOW = "scout-answers"
ROOT_SPAN = "scout_answer"
REPLAY_SPAN = "scout_replay"  # evals and verification replays: traced, but not live traffic
# A wrong answer becomes a support ticket and some churn risk; an escalation is just the ticket.
VALUE_FAILED_USD = 6.0
VALUE_ESCALATED_USD = 4.5

log = logging.getLogger("scout")

STOPWORDS = set("""a an and are as at be by can do does for from get go has have how i if in is it its
me my of on or our past so that the their them there this to us was we what when where which who why
will with you your much many long any does doesn't don't lose""".split())


# -- releases ------------------------------------------------------------------------------------------
@dataclass
class Release:
    id: str
    title: str
    model: str
    retriever: str = "v1"
    top_k: int = 3
    max_steps: int = 6
    doc_root: str = "docs"  # where read_doc loads pages from, relative to agents/scout
    system_prompt: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


def load_release(release_id: str) -> Release:
    path = RELEASES_DIR / f"{release_id}.yaml"
    if not re.fullmatch(r"[a-z0-9_-]+", release_id) or not path.exists():
        raise KeyError(f"unknown release {release_id!r}")
    raw = yaml.safe_load(path.read_text())
    known = {k: raw.pop(k) for k in list(raw) if k in Release.__dataclass_fields__ and k != "extra"}
    return Release(**known, extra=raw)


# -- docs index ----------------------------------------------------------------------------------------
class ToolError(RuntimeError):
    pass


def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9$]+", text.lower()) if t not in STOPWORDS and len(t) > 1]


@dataclass
class Section:
    slug: str
    title: str
    heading: str
    text: str


class DocIndex:
    def __init__(self, docs_dir: Path = DOCS_DIR):
        self.docs: dict[str, str] = {}
        self.titles: dict[str, str] = {}
        self.sections: list[Section] = []
        for path in sorted(docs_dir.glob("*.md")):
            slug, body = path.stem, path.read_text()
            self.docs[slug] = body
            title, heading, buf = slug, "", []
            for line in body.splitlines() + ["## "]:
                if line.startswith("# "):
                    title = line[2:].strip()
                elif line.startswith("## "):
                    if buf:
                        self.sections.append(Section(slug, title, heading, " ".join(buf).strip()))
                    heading, buf = line[3:].strip(), []
                elif line.strip():
                    buf.append(line.strip())
            self.titles[slug] = title

    def search_v1(self, query: str, k: int = 3) -> list[dict[str, Any]]:
        """Full-text section search: query terms scored against heading (x2) and body."""
        q = set(tokens(query))
        scored = []
        for s in self.sections:
            head, body = tokens(f"{s.title} {s.heading}"), tokens(s.text)
            score = sum(2 for t in head if t in q) + sum(1 for t in body if t in q)
            if score:
                scored.append((score, s))
        scored.sort(key=lambda x: -x[0])
        return [{"slug": s.slug, "title": s.title, "section": s.heading, "snippet": s.text[:240]}
                for _, s in scored[:k]]

    def search_v2(self, query: str, k: int = 2) -> list[dict[str, Any]]:
        """Title/heading search: query terms scored against page titles and section headings only."""
        q = set(tokens(query))
        scored = []
        for s in self.sections:
            score = sum(1 for t in tokens(f"{s.title} {s.heading}") if t in q)
            if score:
                scored.append((score, s))
        scored.sort(key=lambda x: -x[0])
        return [{"slug": s.slug, "title": s.title, "section": s.heading, "snippet": s.text[:240]}
                for _, s in scored[:k]]

    def search(self, query: str, k: int, retriever: str) -> list[dict[str, Any]]:
        fn: Callable[[str, int], list[dict[str, Any]]] | None = getattr(self, f"search_{retriever}", None)
        if fn is None:
            raise ToolError(f"retriever {retriever!r} is not available")
        return fn(query, k)

    def read_doc(self, slug: str, doc_root: str = "docs") -> str:
        root = (HERE / doc_root).resolve()
        path = (root / f"{slug}.md").resolve()
        if not re.fullmatch(r"[a-z0-9_-]+", slug) or path.parent != root or not path.is_file():
            raise ToolError(f"doc not found: {slug!r}")
        return path.read_text()


INDEX = DocIndex()

TOOLS = [
    {"type": "function", "function": {
        "name": "search_docs", "description": "Search the Lumen docs. Returns matching sections with slugs.",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "read_doc", "description": "Read a full Lumen docs page by slug (from search_docs).",
        "parameters": {"type": "object", "properties": {"slug": {"type": "string"}}, "required": ["slug"]}}},
]


# -- grading ------------------------------------------------------------------------------------------------
def _bank() -> dict[str, list[list[str]]]:
    return {q["q"]: q["must"] for q in yaml.safe_load((HERE / "questions.yaml").read_text())}


BANK = _bank()
NOT_FOUND = re.compile(r"could not find|couldn't find|not covered|contact support|support@lumen", re.I)


def grade(question: str, answer: str, error: str | None = None) -> tuple[str, str]:
    """ok | failed | escalated, with a short note."""
    if error or not answer.strip():
        return "failed", error or "empty answer"
    must = BANK.get(question)
    if must is None:  # a question outside the bank: only judge whether Scout answered
        return ("escalated", "deferred to support") if NOT_FOUND.search(answer) else ("ok", "answered")
    low = answer.lower()
    missing = [g[0] for g in must if not any(alt.lower() in low for alt in g)]
    if not missing:
        return "ok", "all required facts present"
    if NOT_FOUND.search(answer):
        return "escalated", f"deferred to support; missing {missing}"
    return "failed", f"missing {missing}"


# -- the agent ---------------------------------------------------------------------------------------------
@dataclass
class Result:
    answer: str = ""
    steps: int = 0
    tool_errors: int = 0
    tokens: int = 0
    error: str | None = None
    tool_log: list[dict[str, Any]] = field(default_factory=list)


def _trace(name: str, kind: str):
    import neatlogs

    return neatlogs.trace(name, kind=kind)


def run_tool(name: str, args: dict[str, Any], release: Release, res: Result) -> Any:
    """Each tool call is its own neatlogs span; a ToolError is recorded as the span's output, so the
    failure is visible in the trace (and to detections on it), not only in the outcome report."""
    with _trace(f"tool.{name}", "TOOL") as span:
        _set(span, **{"input.value": json.dumps(args)})
        try:
            if name == "search_docs":
                out: Any = INDEX.search(str(args.get("query", "")), release.top_k, release.retriever)
            elif name == "read_doc":
                out = INDEX.read_doc(str(args.get("slug", "")), release.doc_root)[:4000]
            else:
                raise ToolError(f"unknown tool {name}")
        except ToolError as exc:
            res.tool_errors += 1
            out = {"error": str(exc)}
            _set(span, **{"error": True})
        _set(span, **{"output.value": json.dumps(out)[:2000]})
    res.tool_log.append({"tool": name, "args": args, "hits": len(out) if isinstance(out, list) else None,
                         "error": out.get("error") if isinstance(out, dict) else None})
    return out


def _brain() -> str:
    return os.environ.get("SCOUT_BRAIN") or ("live" if os.environ.get("LITELLM_API_KEY") else "sim")


def answer_live(question: str, release: Release, model: str, max_steps: int, tools_enabled: bool) -> Result:
    from openai import OpenAI
    import neatlogs

    client = neatlogs.wrap(OpenAI(base_url=os.environ.get("LITELLM_BASE_URL"), api_key=os.environ["LITELLM_API_KEY"],
                                  timeout=60, max_retries=1))
    res = Result()
    messages: list[dict[str, Any]] = [{"role": "system", "content": release.system_prompt},
                                      {"role": "user", "content": question}]
    for step in range(max_steps):
        res.steps = step + 1
        kwargs: dict[str, Any] = {"model": model, "messages": messages, "max_tokens": 400, "temperature": 0.1}
        if tools_enabled and step < max_steps - 1:
            kwargs["tools"] = TOOLS
        for attempt in range(4):
            try:
                resp = client.chat.completions.create(**kwargs)
                break
            except Exception as exc:  # gateway rate limit: back off
                if getattr(exc, "status_code", None) == 429 and attempt < 3:
                    time.sleep(4 * (attempt + 1))
                    continue
                res.error = f"{type(exc).__name__}: {str(exc)[:200]}"
                return res
        res.tokens += getattr(resp.usage, "total_tokens", 0) or 0
        msg = resp.choices[0].message
        if not msg.tool_calls:
            res.answer = msg.content or ""
            return res
        messages.append({"role": "assistant", "content": msg.content or "",
                         "tool_calls": [tc.model_dump() for tc in msg.tool_calls]})
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            out = run_tool(tc.function.name, args, release, res)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(out)[:4000]})
    res.error = f"ran out of steps ({max_steps})"
    return res


def answer_sim(question: str, release: Release, model: str, max_steps: int, tools_enabled: bool) -> Result:
    """Deterministic, offline brain for tests: search, read the best page, quote the best sentences."""
    res = Result(steps=1)
    if not tools_enabled:
        res.answer = "I could not find that in the Lumen docs. Please contact support@lumen.dev."
        return res
    hits = run_tool("search_docs", {"query": question}, release, res)
    res.steps += 1
    if not isinstance(hits, list) or not hits:
        res.answer = "I could not find that in the Lumen docs. Please contact support@lumen.dev."
        return res
    page = run_tool("read_doc", {"slug": hits[0]["slug"]}, release, res)
    res.steps += 1
    if isinstance(page, dict):
        res.answer = "I could not find that in the Lumen docs. Please contact support@lumen.dev."
        return res
    q = set(tokens(question))
    snippets = " ".join(h["snippet"] for h in hits)
    sentences = re.split(r"(?<=[.!?])\s+", snippets)
    best = sorted(sentences, key=lambda s: -len(q & set(tokens(s))))[:2]
    res.answer = " ".join(best)
    res.tokens = 600
    return res


def _set(span: Any, **attrs: Any) -> None:
    for k, v in attrs.items():
        if v is None:
            continue
        try:
            span.set_attribute(k, v if isinstance(v, (str, int, float, bool)) else str(v))
        except Exception:
            pass


def _trace_id(span: Any) -> str | None:
    try:
        ctx = span.get_span_context()
        return format(ctx.trace_id, "032x") if ctx and ctx.trace_id else None
    except Exception:
        return None


_tracing = False


def init_tracing() -> None:
    global _tracing
    if _tracing:
        return
    import neatlogs

    key = os.environ.get("SCOUT_NEATLOGS_API_KEY") or os.environ.get("NEATLOGS_API_KEY")
    neatlogs.init(api_key=key or None, workflow_name=WORKFLOW, tags=["app:scout"], disable_export=not key,
                  register_shutdown_handlers=True)
    _tracing = True


def handle(question: str, ns: Any, replay: bool = False) -> dict[str, Any]:
    """Answer one question on whatever Nightly says is live, and report the graded outcome."""
    init_tracing()
    try:
        release = load_release(ns.release(DEFAULT_RELEASE))
    except KeyError:
        release = load_release(DEFAULT_RELEASE)
    model = ns.model(release.model)
    max_steps = ns.max_steps(release.max_steps)
    tools_enabled = ns.flag("tools_enabled", True)
    brain = answer_live if _brain() == "live" else answer_sim
    started = time.time()
    with _trace(REPLAY_SPAN if replay else ROOT_SPAN, "WORKFLOW") as span:
        _set(span, **{"neatlogs.workflow_name": WORKFLOW, "input.value": question, "scout.release": release.id,
                      "scout.model": model, "scout.replay": replay})
        trace_id = _trace_id(span)
        res = brain(question, release, model, max_steps, tools_enabled)
        outcome, note = grade(question, res.answer, res.error)
        _set(span, **{"output.value": res.answer or res.error or "", "scout.outcome": outcome,
                      "scout.grade_note": note, "scout.tool_errors": res.tool_errors})
        if res.error:
            try:
                from opentelemetry.trace import Status, StatusCode

                span.set_status(Status(StatusCode.ERROR, res.error[:200]))
            except Exception:
                pass
    value = VALUE_FAILED_USD if outcome == "failed" else VALUE_ESCALATED_USD if outcome == "escalated" else 0.0
    if not replay:
        ns.record(outcome, trace_id=trace_id, value_usd=value, release=release.id, model=model, note=note,
                  input=question, output=res.answer or res.error or "", steps=res.steps, tool_errors=res.tool_errors,
                  tokens=res.tokens, latency_ms=round((time.time() - started) * 1000))
    return {"trace_id": trace_id, "release": release.id, "model": model, "outcome": outcome, "note": note,
            "answer": res.answer, "error": res.error, "steps": res.steps, "tool_errors": res.tool_errors,
            "tools": res.tool_log, "latency_s": round(time.time() - started, 2)}


def replay_handler(ns: Any) -> Callable[[str], dict[str, Any]]:
    """A replay passes when the answer grades ok and no tool call failed along the way."""
    def run(question: str) -> dict[str, Any]:
        r = handle(question, ns, replay=True)
        return {"ok": r["outcome"] == "ok" and r["tool_errors"] == 0, "output": r["answer"], "trace_id": r["trace_id"]}

    return run


# -- CLI ------------------------------------------------------------------------------------------------------
def _ns():
    from nightly_sdk import Nightly

    return Nightly()


class _Pinned:
    """Stand-in for the SDK that pins a release (offline eval)."""

    def __init__(self, release: str):
        self._r = release

    def release(self, default: str) -> str:
        return self._r

    def model(self, default: str) -> str:
        return default

    def max_steps(self, default: int) -> int:
        return default

    def flag(self, name: str, default: bool = True) -> bool:
        return default

    def record(self, *a: Any, **k: Any) -> bool:
        return False


def git_commit_for(release: str) -> str | None:
    out = subprocess.run(["git", "log", "-1", "--format=%H", "--", f"releases/{release}.yaml"], cwd=HERE,
                         capture_output=True, text=True)
    return out.stdout.strip() or None


def load_env() -> None:
    env = HERE.parents[1] / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def main(argv: list[str] | None = None) -> int:
    load_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s scout %(message)s")
    p = argparse.ArgumentParser(prog="scout")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("ask")
    a.add_argument("question")
    s = sub.add_parser("serve")
    s.add_argument("--rate", type=float, default=6.0, help="questions per minute")
    s.add_argument("--count", type=int, default=0, help="stop after N questions (0 = forever)")
    d = sub.add_parser("deploy")
    d.add_argument("release")
    d.add_argument("--actor", default="ci")
    e = sub.add_parser("eval")
    e.add_argument("--release", default=DEFAULT_RELEASE)
    args = p.parse_args(argv)

    if args.cmd == "ask":
        print(json.dumps(handle(args.question, _ns()), indent=2))
    elif args.cmd == "deploy":
        rel = load_release(args.release)
        ns = _ns()
        ok = ns.report_deploy(rel.id, commit=git_commit_for(rel.id), actor=args.actor, default_model=rel.model)
        print(f"deploy {rel.id} reported: {ok}")
        return 0 if ok else 1
    elif args.cmd == "eval":
        ns = _Pinned(args.release)
        rows = [handle(q, ns, replay=True) for q in BANK]
        good = sum(r["outcome"] == "ok" for r in rows)
        for q, r in zip(BANK, rows):
            print(f"{r['outcome']:9} {q[:60]:60} {r['note']}")
        print(f"\n{args.release}: {good}/{len(rows)} correct")
    elif args.cmd == "serve":
        ns = _ns()
        ns.serve_replays(replay_handler(ns))
        questions, n = list(BANK), 0
        while not args.count or n < args.count:
            r = handle(random.choice(questions), ns)
            n += 1
            log.info("%s %s %s/%s %s", r["release"], r["outcome"], r["steps"], r["tool_errors"], r["note"])
            time.sleep(max(0.5, 60.0 / args.rate - r["latency_s"]))
        ns.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
