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
from typing import Any

from harbor import releases
from harbor.deploy import recent_deploys
from ops.db import OpsDB
from ops.settings import REPO_DIR

log = logging.getLogger(__name__)

TRAILER_RE = re.compile(r"^Entire-Checkpoint:\s*(\S+)\s*$", re.MULTILINE)


def _git(*args: str, timeout: int = 15) -> str:
    out = subprocess.run(["git", *args], cwd=REPO_DIR, capture_output=True, text=True, timeout=timeout)
    return out.stdout


def _entire(*args: str, timeout: int = 30) -> tuple[int, str]:
    exe = shutil.which("entire")
    if not exe:
        return 127, "entire CLI not installed"
    out = subprocess.run([exe, *args], cwd=REPO_DIR, capture_output=True, text=True, timeout=timeout)
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
    diff_excerpt: str = ""
    entire_url: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _github_slug() -> str | None:
    url = _git("remote", "get-url", "origin").strip()
    m = re.search(r"github\.com[:/](.+?)(?:\.git)?$", url)
    return m.group(1) if m else None


def _prompts_from_transcript(checkpoint_id: str) -> list[str]:
    """User prompts recorded in the checkpoint's stored (redacted) transcript."""
    code, out = _entire("checkpoint", "explain", checkpoint_id, "--transcript", timeout=60)
    if code != 0 or not out.strip():
        return []
    prompts: list[str] = []
    for line in out.splitlines():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
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


def checkpoint_metadata(checkpoint_id: str) -> dict[str, Any]:
    code, out = _entire("checkpoint", "explain", checkpoint_id, "--json")
    if code != 0:
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {}


def for_release(release_id: str) -> Provenance:
    rel = releases.load_release(release_id)
    prov = Provenance(release=release_id, file=rel.file)
    log_out = _git("log", "-n", "1", "--format=%H%x1f%s%x1f%an%x1f%aI%x1f%B", "--", rel.file)
    if not log_out.strip():
        return prov
    sha, subject, author, date, body = log_out.split("\x1f", 4)
    prov.commit, prov.commit_subject, prov.commit_author, prov.commit_date = sha.strip(), subject, author, date
    prov.files_changed = [f for f in _git("show", "--name-only", "--format=", prov.commit).splitlines() if f]
    diff = _git("show", "--format=", "--unified=2", prov.commit)
    prov.diff_excerpt = diff[:6000]
    m = TRAILER_RE.search(body)
    if m:
        prov.checkpoint_id = m.group(1)
        meta = checkpoint_metadata(prov.checkpoint_id)
        sessions = meta.get("sessions") or []
        if sessions:
            prov.session_id = sessions[0].get("session_id")
            prov.agent = sessions[0].get("agent")
            prov.model = sessions[0].get("model")
        prov.coding_prompts = _prompts_from_transcript(prov.checkpoint_id)
    slug = _github_slug()
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
