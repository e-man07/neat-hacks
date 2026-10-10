"""Provenance: from a deployed release to the commit, the Entire checkpoint and the coding-agent
prompt that produced it.

    deploy log ──► release file ──► git commit ──► `Entire-Checkpoint:` trailer
               ──► `entire checkpoint explain` / transcript ──► the developer's prompt + intent
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from harbor import releases
from harbor.deploy import recent_deploys
from ops.db import OpsDB
from ops.settings import REPO_DIR

log = logging.getLogger(__name__)

TRAILER_RE = re.compile(r"^Entire-Checkpoint:\s*(\S+)\s*$", re.MULTILINE)


def _git(*args: str, timeout: int = 15, cwd: Path | None = None) -> str:
    out = subprocess.run(["git", *args], cwd=cwd or REPO_DIR, capture_output=True, text=True, timeout=timeout)
    return out.stdout


def _entire(*args: str, timeout: int = 30, cwd: Path | None = None) -> tuple[int, str]:
    exe = shutil.which("entire")
    if not exe:
        return 127, "entire CLI not installed"
    out = subprocess.run([exe, *args], cwd=cwd or REPO_DIR, capture_output=True, text=True, timeout=timeout)
    return out.returncode, out.stdout or out.stderr


@dataclass
class Provenance:
    release: str
    file: str
    commit: str | None = None
    commit_subject: str | None = None
    commit_author: str | None = None
    commit_date: str | None = None
    files_changed: list[str] = field(default_factory=list)
    checkpoint_id: str | None = None
    session_id: str | None = None
    agent: str | None = None
    model: str | None = None
    coding_prompts: list[str] = field(default_factory=list)
    coding_agent_note: str | None = None
    graph_changes: str | None = None  # entity-level change list from entire-graph
    diff_excerpt: str = ""
    entire_url: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _github_slug(cwd: Path | None = None) -> str | None:
    url = _git("remote", "get-url", "origin", cwd=cwd).strip()
    m = re.search(r"github\.com[:/](.+?)(?:\.git)?$", url)
    return m.group(1) if m else None


def _transcript(checkpoint_id: str, cwd: Path | None = None) -> list[dict[str, Any]]:
    code, out = _entire("checkpoint", "explain", checkpoint_id, "--transcript", timeout=60, cwd=cwd)
    if code != 0 or not out.strip():
        return []
    recs = []
    for line in out.splitlines():
        try:
            recs.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return recs


def _agent_note(recs: list[dict[str, Any]]) -> str | None:
    """The coding agent's last text reply in the session (where it reports risks)."""
    for rec in reversed(recs):
        if rec.get("type") != "assistant":
            continue
        content = (rec.get("message") or {}).get("content")
        if isinstance(content, list):
            texts = [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
            text = "\n".join(t for t in texts if t.strip()).strip()
            if text:
                return text[:2000]
    return None


def _prompts_from_transcript(checkpoint_id: str, recs: list[dict[str, Any]] | None = None) -> list[str]:
    """User prompts recorded in the checkpoint's stored (redacted) transcript."""
    recs = recs if recs is not None else _transcript(checkpoint_id)
    prompts: list[str] = []
    for rec in recs:
        if rec.get("type") != "user":
            continue
        msg = rec.get("message") or {}
        content = msg.get("content")
        texts: list[str] = []
        if isinstance(content, str):
            texts = [content]
        elif isinstance(content, list):
            texts = [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
        for t in texts:
            t = t.strip()
            if t and not t.startswith("<") and "tool_use_id" not in t:
                prompts.append(t[:1500])
    return prompts[:5]


def checkpoint_metadata(checkpoint_id: str, cwd: Path | None = None) -> dict[str, Any]:
    code, out = _entire("checkpoint", "explain", checkpoint_id, "--json", cwd=cwd)
    if code != 0:
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {}


def for_release(release_id: str) -> Provenance:
    """Harbor sandbox: a release is a YAML file in this repo."""
    rel = releases.load_release(release_id)
    sha = _git("log", "-n", "1", "--format=%H", "--", rel.file).strip()
    if not sha:
        return Provenance(release=release_id, file=rel.file)
    prov = for_commit(sha, release=release_id)
    prov.file = rel.file
    return prov


def for_commit(sha: str, release: str = "", repo_dir: Path | None = None) -> Provenance:
    """Commit → files and diff → `Entire-Checkpoint:` trailer → session, prompts, agent note,
    plus entire-graph's semantic change list. Works on any local clone with Entire refs."""
    cwd = repo_dir
    prov = Provenance(release=release, file="")
    log_out = _git("log", "-n", "1", "--format=%H%x1f%s%x1f%an%x1f%aI%x1f%B", sha, cwd=cwd)
    if not log_out.strip():
        return prov
    full, subject, author, date, body = log_out.split("\x1f", 4)
    prov.commit, prov.commit_subject, prov.commit_author, prov.commit_date = full.strip(), subject, author, date
    prov.files_changed = [f for f in _git("show", "--name-only", "--format=", prov.commit, cwd=cwd).splitlines() if f]
    prov.diff_excerpt = _git("show", "--format=", "--unified=2", prov.commit, cwd=cwd)[:6000]
    m = TRAILER_RE.search(body)
    if m:
        prov.checkpoint_id = m.group(1)
        meta = checkpoint_metadata(prov.checkpoint_id, cwd=cwd)
        sessions = meta.get("sessions") or []
        if sessions:  # the latest session in a checkpoint is the one that produced the commit
            prov.session_id = sessions[-1].get("session_id")
            prov.agent = sessions[-1].get("agent")
            prov.model = sessions[-1].get("model")
        recs = _transcript(prov.checkpoint_id, cwd=cwd)
        prov.coding_prompts = _prompts_from_transcript(prov.checkpoint_id, recs)
        prov.coding_agent_note = _agent_note(recs)
    code, out = _entire("graph", "commit", prov.commit, "--max-seconds", "30", timeout=60, cwd=cwd)
    if code == 0 and out.strip():
        prov.graph_changes = out.strip()[:2500]
    slug = _github_slug(cwd)
    if slug and prov.commit:
        prov.entire_url = f"https://entire.io/gh/{slug}/commit/{prov.commit}"
    return prov


def release_diff(old: str, new: str) -> str:
    """Unified diff between two release files."""
    a = releases.load_release(old)
    b = releases.load_release(new)
    out = subprocess.run(["git", "diff", "--no-index", "--unified=3", str(a.path), str(b.path)],
                         cwd=REPO_DIR, capture_output=True, text=True, timeout=10)
    return out.stdout[:6000]


def deploys_with_provenance(db: OpsDB, limit: int = 5) -> list[dict[str, Any]]:
    out = []
    for d in recent_deploys(db, limit):
        out.append({**d, "release_title": _safe_title(d["release"])})
    return out


def _safe_title(release_id: str) -> str:
    try:
        return releases.load_release(release_id).title
    except Exception:
        return release_id
