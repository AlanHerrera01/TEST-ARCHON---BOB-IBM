"""
Port: RunnerPort

Defines the contract for executing test suites and returning results.
No knowledge of pytest, subprocess, or any CLI tool lives here.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.models import TestSuiteResult


class RunnerPort(ABC):
    """Primary port for test execution."""

    @abstractmethod
    def run_tests(self, test_paths: list[str], *, working_dir: str = ".") -> TestSuiteResult:
        """
        Execute the tests at the given *test_paths* and return aggregated results.

        Parameters
        ----------
        test_paths:
            List of file paths or pytest node-ids to run.
            An empty list SHOULD run the entire test suite.
        working_dir:
            Absolute or relative path to the root of the project under test.

        Returns
        -------
        TestSuiteResult
            Aggregated pass/fail counts, coverage percentage, and per-test details.
        """

    @abstractmethod
    def get_coverage(self, working_dir: str = ".") -> float:
        """
        Return the current line-coverage percentage (0.0 – 100.0)
        without running the full test suite (reads last coverage report).
        """
