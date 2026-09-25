"""
Adapter: GitHubAPIAdapter

Implements GitPort using the GitHub REST API v3.
Fetches diff metadata remotely (e.g. from a CI/PR webhook context).
Pure Python + stdlib urllib — no third-party HTTP client required.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

from app.application.ports.git_port import GitPort
from app.domain.exceptions import DiffParseError
from app.domain.models import CodeDiff, FileDiff


class GitHubAPIAdapter(GitPort):
    """
    Reads PR/commit diffs from the GitHub REST API.

    Parameters
    ----------
    token:
        GitHub personal access token or Actions ``GITHUB_TOKEN``.
    repo:
        Full repo slug, e.g. ``"owner/repo"``.
    """

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str, repo: str) -> None:
        self._token = token
        self._repo = repo

    # ------------------------------------------------------------------
    # GitPort implementation
    # ------------------------------------------------------------------

    def get_diff(self, base: str, head: str) -> CodeDiff:
        endpoint = f"{self.BASE_URL}/repos/{self._repo}/compare/{base}...{head}"
        data = self._request(endpoint)

        files: list[FileDiff] = []
        for f in data.get("files", []):
            files.append(
                FileDiff(
                    path=f.get("filename", ""),
                    additions=f.get("additions", 0),
                    deletions=f.get("deletions", 0),
                    patch=f.get("patch", ""),
                )
            )

        sha = data.get("commits", [{}])[-1].get("sha", head)[:7]
        return CodeDiff(
            commit_sha=sha,
            branch=head,
            base_branch=base,
            files=files,
            created_at=datetime.now(timezone.utc),
        )

    def get_changed_files(self, base: str, head: str) -> list[str]:
        diff = self.get_diff(base, head)
        return diff.changed_paths

    def get_file_diff(self, base: str, head: str, file_path: str) -> str:
        """
        Return the hunk content for *file_path* from the GitHub compare API.

        The GitHub API returns per-file patches inside the compare endpoint —
        this method fetches the full compare and extracts the matching patch.
        """
        endpoint = f"{self.BASE_URL}/repos/{self._repo}/compare/{base}...{head}"
        data = self._request(endpoint)
        for f in data.get("files", []):
            if f.get("filename") == file_path:
                return f.get("patch", "")
        return ""

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _request(self, url: str) -> dict:
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            raise DiffParseError(f"GitHub API {exc.code}: {exc.reason}") from exc
        except OSError as exc:
            raise DiffParseError(str(exc)) from exc
