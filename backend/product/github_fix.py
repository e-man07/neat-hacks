"""Open the permanent fix as a real GitHub pull request — the irreversible step, done only after a
human approves it.

The PR reverts the culprit commit's changes file by file (contents restored from its parent), adds
the regression eval Nightly generated from the failing traces, and carries the postmortem.
Uses the approving user's GitHub token from sign-in.
"""

from __future__ import annotations

import base64
import logging
import time
from typing import Any

import httpx

log = logging.getLogger(__name__)
API = "https://api.github.com"


class GitHubError(RuntimeError):
    pass


def _client(token: str) -> httpx.Client:
    return httpx.Client(base_url=API, timeout=30, headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "nightly"})


def _check(r: httpx.Response) -> Any:
    if r.status_code >= 400:
        raise GitHubError(f"GitHub {r.request.method} {r.request.url.path}: {r.status_code} {r.text[:300]}")
    return r.json() if r.content else None


def open_revert_pr(token: str, repo: str, commit_sha: str, incident_id: str, title: str, body: str,
                   extra_files: dict[str, str] | None = None) -> dict[str, Any]:
    with _client(token) as gh:
        info = _check(gh.get(f"/repos/{repo}"))
        base_branch = info["default_branch"]
        base_sha = _check(gh.get(f"/repos/{repo}/git/ref/heads/{base_branch}"))["object"]["sha"]
        commit = _check(gh.get(f"/repos/{repo}/commits/{commit_sha}"))
        parent = commit["parents"][0]["sha"] if commit.get("parents") else None
        branch = f"nightshift/fix-{incident_id.lower()}-{int(time.time()) % 100000}"
        _check(gh.post(f"/repos/{repo}/git/refs", json={"ref": f"refs/heads/{branch}", "sha": base_sha}))

        for f in commit.get("files", []):
            path = f["filename"]
            current = gh.get(f"/repos/{repo}/contents/{path}", params={"ref": branch})
            current_sha = current.json().get("sha") if current.status_code == 200 else None
            if f["status"] == "added":
                if current_sha:
                    _check(gh.request("DELETE", f"/repos/{repo}/contents/{path}", json={
                        "message": f"Revert {path} (introduced by {commit_sha[:8]})", "sha": current_sha,
                        "branch": branch}))
                continue
            old = gh.get(f"/repos/{repo}/contents/{path}", params={"ref": parent})
            if old.status_code != 200:
                continue
            payload = {"message": f"Restore {path} from before {commit_sha[:8]}", "content": old.json()["content"]
                       .replace("\n", ""), "branch": branch}
            if current_sha:
                payload["sha"] = current_sha
            _check(gh.put(f"/repos/{repo}/contents/{path}", json=payload))

        for path, text in (extra_files or {}).items():
            _check(gh.put(f"/repos/{repo}/contents/{path}", json={
                "message": f"Add {path} from {incident_id}", "branch": branch,
                "content": base64.b64encode(text.encode()).decode()}))

        pr = _check(gh.post(f"/repos/{repo}/pulls", json={"title": title, "head": branch, "base": base_branch,
                                                         "body": body, "draft": False}))
        return {"url": pr["html_url"], "number": pr["number"], "branch": branch}
