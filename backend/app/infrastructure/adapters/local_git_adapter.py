"""
Adapter: LocalGitAdapter

Implements GitPort using the local ``git`` CLI.
All diff parsing is done in pure Python — zero LLM token cost.
"""
from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone

from app.application.ports.git_port import GitPort
from app.domain.exceptions import DiffParseError
from app.domain.models import CodeDiff, FileDiff


class LocalGitAdapter(GitPort):
    """Reads diffs from a local git repository via subprocess."""

    def __init__(self, repo_path: str = ".") -> None:
        self._repo_path = repo_path

    # ------------------------------------------------------------------
    # GitPort implementation
    # ------------------------------------------------------------------

    def get_diff(self, base: str, head: str) -> CodeDiff:
        raw = self._run_git(["diff", f"{base}...{head}", "--unified=3"])
        files = _parse_unified_diff(raw)

        # Resolve HEAD commit SHA locally
        try:
            sha = self._run_git(["rev-parse", "--short", head]).strip()
        except Exception:
            sha = head

        # Resolve current branch name
        try:
            branch = self._run_git(["rev-parse", "--abbrev-ref", head]).strip()
        except Exception:
            branch = head

        return CodeDiff(
            commit_sha=sha,
            branch=branch,
            base_branch=base,
            files=files,
            created_at=datetime.now(timezone.utc),
        )

    def get_changed_files(self, base: str, head: str) -> list[str]:
        raw = self._run_git(["diff", "--name-only", f"{base}...{head}"])
        return [line.strip() for line in raw.splitlines() if line.strip()]

    def get_file_diff(self, base: str, head: str, file_path: str) -> str:
        """
        Return only the modified hunks for *file_path* between *base* and *head*.

        Extracts just the ``+``/``-`` lines and hunk headers from the unified diff,
        stripping the file-level header. This keeps prompts small — only the delta
        is sent to LLM agents, never the entire file content.
        """
        raw = self._run_git([
            "diff", f"{base}...{head}", "--unified=3", "--", file_path,
        ])
        return _extract_hunks(raw)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _run_git(self, args: list[str]) -> str:
        result = subprocess.run(
            ["git"] + args,
            cwd=self._repo_path,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise DiffParseError(result.stderr.strip() or f"git {' '.join(args)} failed")
        return result.stdout


# ---------------------------------------------------------------------------
# Pure-Python unified-diff helpers (zero LLM cost)
# ---------------------------------------------------------------------------

_FILE_HEADER = re.compile(r"^diff --git a/(.+) b/(.+)$")
_HUNK_HEADER = re.compile(r"^@@")


def _extract_hunks(raw: str) -> str:
    """
    Strip the file-level header from a unified diff and return only the hunk
    content (lines starting with ``@@``, ``+``, ``-``, or a context space).

    This is the token-efficient representation sent to LLM prompts: it contains
    only what changed, not the entire file.
    """
    lines: list[str] = []
    in_hunk = False
    for line in raw.splitlines(keepends=True):
        if _HUNK_HEADER.match(line):
            in_hunk = True
        elif _FILE_HEADER.match(line) or line.startswith(("diff ", "index ", "--- ", "+++ ")):
            in_hunk = False
            continue
        if in_hunk:
            lines.append(line)
    return "".join(lines)


def _parse_unified_diff(raw: str) -> list[FileDiff]:
    """Parse a unified git diff into FileDiff objects without any LLM call."""
    files: list[FileDiff] = []
    current_path: str | None = None
    additions = deletions = 0
    patch_lines: list[str] = []

    def _flush() -> None:
        if current_path is not None:
            files.append(
                FileDiff(
                    path=current_path,
                    additions=additions,
                    deletions=deletions,
                    patch="".join(patch_lines),
                )
            )

    for line in raw.splitlines(keepends=True):
        m = _FILE_HEADER.match(line)
        if m:
            _flush()
            current_path = m.group(2)
            additions = deletions = 0
            patch_lines = []
            continue
        if line.startswith("+") and not line.startswith("+++"):
            additions += 1
        elif line.startswith("-") and not line.startswith("---"):
            deletions += 1
        if current_path is not None:
            patch_lines.append(line)

    _flush()
    return files
