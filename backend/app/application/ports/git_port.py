"""
Port: GitPort

Defines the contract that any Git adapter (local CLI, GitHub API, etc.)
must fulfil.  No concrete implementation lives here — only the ABC.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.models import CodeDiff


class GitPort(ABC):
    """Primary port for retrieving code diffs from any Git source."""

    @abstractmethod
    def get_diff(self, base: str, head: str) -> CodeDiff:
        """
        Return the diff between *base* and *head* refs.

        Parameters
        ----------
        base:
            Base branch or commit SHA (e.g. ``"main"``, ``"abc1234"``).
        head:
            Head branch or commit SHA to compare against *base*.

        Returns
        -------
        CodeDiff
            Aggregated diff — parsed locally, zero LLM cost.
        """

    @abstractmethod
    def get_changed_files(self, base: str, head: str) -> list[str]:
        """
        Return only the list of changed file paths between *base* and *head*.

        Lighter alternative to ``get_diff`` when the patch text is not needed.
        """

    @abstractmethod
    def get_file_diff(self, base: str, head: str, file_path: str) -> str:
        """
        Return only the modified hunks (added/removed lines) for a single file.

        This is the token-efficient alternative to sending entire file contents
        to LLM agents — only the delta lines are returned.

        Parameters
        ----------
        base:
            Base branch or commit SHA.
        head:
            Head branch or commit SHA.
        file_path:
            Relative path of the file within the repository.

        Returns
        -------
        str
            Unified diff hunks for the requested file (without the file header),
            or an empty string if the file was not modified.
        """
