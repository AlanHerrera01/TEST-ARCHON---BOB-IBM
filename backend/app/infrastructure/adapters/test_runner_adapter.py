"""
Adapter: TestRunnerAdapter

Implements RunnerPort by executing pytest via subprocess.
All parsing of pytest output is done in pure Python — zero LLM cost.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import uuid
from datetime import datetime, timezone

from app.application.ports.runner_port import RunnerPort
from app.domain.exceptions import TestRunnerError
from app.domain.models import TestResult, TestStatus, TestSuiteResult


# Per-test timeout in seconds.  Pytest is given this many seconds total to
# complete the full run; any hang is treated as an execution error.
_DEFAULT_TIMEOUT_SECONDS = 10


class TestRunnerAdapter(RunnerPort):
    """
    Runs pytest in a subprocess and parses the JSON report.

    Requires pytest and pytest-json-report to be installed in the environment.

    Parameters
    ----------
    python_executable:
        Path to the Python interpreter to use when invoking pytest.
    timeout:
        Maximum number of seconds to allow the pytest subprocess to run.
        If exceeded the process is killed and a ``TestRunnerError`` is raised
        so the orchestrator can treat all tests as failures rather than hanging
        indefinitely. Defaults to ``10``.
    """

    def __init__(
        self,
        python_executable: str = "python",
        timeout: int = _DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._python = python_executable
        self._timeout = timeout

    # ------------------------------------------------------------------
    # RunnerPort implementation
    # ------------------------------------------------------------------

    def run_tests(
        self, test_paths: list[str], *, working_dir: str = "."
    ) -> TestSuiteResult:
        report_file = os.path.join(working_dir, ".pytest_report.json")
        cmd = [
            self._python, "-m", "pytest",
            "--json-report", f"--json-report-file={report_file}",
            "--tb=short",
            "--cov", ".",
            "--cov-report", "json:.coverage.json",
            "-q",
        ] + (test_paths if test_paths else [])

        try:
            proc = subprocess.run(
                cmd,
                cwd=working_dir,
                capture_output=True,
                text=True,
                check=False,
                timeout=self._timeout,
            )
        except subprocess.TimeoutExpired:
            raise TestRunnerError(
                f"pytest timed out after {self._timeout}s — "
                "all tests in this run are treated as failures."
            )

        if not os.path.exists(report_file):
            raise TestRunnerError(
                f"pytest did not produce a JSON report.\nstderr: {proc.stderr[:500]}"
            )

        return self._parse_report(report_file, working_dir)

    def get_coverage(self, working_dir: str = ".") -> float:
        coverage_file = os.path.join(working_dir, ".coverage.json")
        if not os.path.exists(coverage_file):
            return 0.0
        try:
            with open(coverage_file, encoding="utf-8") as fh:
                data = json.load(fh)
            return data.get("totals", {}).get("percent_covered", 0.0)
        except (OSError, json.JSONDecodeError):
            return 0.0

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _parse_report(self, report_path: str, working_dir: str) -> TestSuiteResult:
        with open(report_path, encoding="utf-8") as fh:
            report = json.load(fh)

        results: list[TestResult] = []
        for test in report.get("tests", []):
            outcome = test.get("outcome", "error")
            status_map = {
                "passed": TestStatus.PASSED,
                "failed": TestStatus.FAILED,
                "error": TestStatus.ERROR,
                "skipped": TestStatus.SKIPPED,
            }
            results.append(
                TestResult(
                    test_id=test.get("nodeid", str(uuid.uuid4())),
                    test_name=test.get("nodeid", "unknown"),
                    status=status_map.get(outcome, TestStatus.ERROR),
                    duration_ms=test.get("call", {}).get("duration", 0.0) * 1000,
                    error_message=test.get("call", {}).get("longrepr") or test.get("longrepr"),
                    stdout=test.get("call", {}).get("stdout", ""),
                )
            )

        coverage = self.get_coverage(working_dir)
        return TestSuiteResult(
            run_id=str(uuid.uuid4()),
            results=results,
            coverage_percent=coverage,
            ran_at=datetime.now(timezone.utc),
        )
