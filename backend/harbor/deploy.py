"""Deploys: switching the active release, recorded with the commit that last changed it."""

from __future__ import annotations

import subprocess
import time

from harbor import releases
from ops.db import OpsDB
from ops.settings import REPO_DIR


def release_commit(release_id: str) -> str | None:
    """Commit that last touched the release file (None if untracked)."""
    rel = releases.load_release(release_id)
    try:
        out = subprocess.run(
            ["git", "log", "-n", "1", "--format=%H", "--", rel.file],
            cwd=REPO_DIR, capture_output=True, text=True, timeout=10,
        )
        sha = out.stdout.strip()
        return sha or None
    except Exception:  # pragma: no cover
        return None


def active_release(db: OpsDB) -> str:
    return db.get_control("active_release") or releases.BASELINE_RELEASE


def deploy(db: OpsDB, release_id: str, actor: str) -> dict:
    releases.load_release(release_id)  # validates the file
    return record_deploy(db, release_id, actor=actor, commit_sha=release_commit(release_id))


def record_deploy(db: OpsDB, release_id: str, actor: str, commit_sha: str | None = None) -> dict:
    """Make `release_id` the active release and log the deploy (any agent)."""
    previous = db.get_control("active_release")
    sha = commit_sha
    db.set_control("active_release", release_id, actor)
    row = {"ts": time.time(), "release": release_id, "previous_release": previous,
           "commit_sha": sha, "actor": actor}
    row["id"] = db.insert("deploys", row)
    return row


def recent_deploys(db: OpsDB, limit: int = 10) -> list[dict]:
    return db.query("SELECT * FROM deploys ORDER BY ts DESC LIMIT ?", [limit])


def last_known_good(db: OpsDB, bad_release: str) -> str:
    """Most recent release before `bad_release` that was deployed (falls back to baseline)."""
    for d in recent_deploys(db, 50):
        if d["release"] == bad_release and d["previous_release"] and d["previous_release"] != bad_release:
            return d["previous_release"]
    return releases.BASELINE_RELEASE
