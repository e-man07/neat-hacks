"""Local clones of connected repositories, including Entire checkpoint refs, for provenance."""

from __future__ import annotations

import logging
import re
import subprocess
from pathlib import Path

from ops.settings import BACKEND_DIR

log = logging.getLogger(__name__)
REPOS_DIR = BACKEND_DIR / "runs" / "repos"
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def _url(repo: str, token: str | None) -> str:
    return f"https://x-access-token:{token}@github.com/{repo}.git" if token else f"https://github.com/{repo}.git"


def _run(args: list[str], cwd: Path | None = None, timeout: int = 180) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def ensure_clone(repo: str, token: str | None = None) -> Path:
    if not REPO_RE.match(repo):
        raise ValueError("repo must look like owner/name")
    path = REPOS_DIR / repo.replace("/", "__")
    if not (path / ".git").exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        out = _run(["git", "clone", "--quiet", "--filter=blob:none", _url(repo, token), str(path)])
        if out.returncode != 0:
            raise RuntimeError(f"clone failed: {out.stderr.strip()[:300].replace(token or '§', '***')}")
        # never keep a token in the stored remote URL
        _run(["git", "remote", "set-url", "origin", f"https://github.com/{repo}.git"], cwd=path)
    sync(path, repo, token)
    return path


def sync(path: Path, repo: str | None = None, token: str | None = None) -> None:
    """Fetch branches and Entire checkpoints (refs/entire/*, or the _entire/* branch fallback)."""
    remote = _url(repo, token) if repo else "origin"
    _run(["git", "fetch", "--quiet", remote, "+refs/heads/*:refs/remotes/origin/*",
          "+refs/entire/*:refs/entire/*"], cwd=path, timeout=120)
    _run(["git", "fetch", "--quiet", remote, "+refs/heads/_entire/*:refs/entire/*"], cwd=path, timeout=120)
    _run(["git", "merge", "--ff-only", "--quiet", "origin/HEAD"], cwd=path, timeout=60)
