"""
Tests for the Orchestrator.

All ports are mocked — no file system, no git, no LLM, no subprocess calls.
"""
from __future__ import annotations

import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from app.application.orchestrator import Orchestrator, _write_event
from app.application.ports.git_port import GitPort
from app.application.ports.llm_port import LLMPort
from app.application.ports.runner_port import RunnerPort
from app.domain.models import (
    AgentEventType,
    CodeDiff,
    FileDiff,
    ImpactAnalysis,
    ImpactedModule,
    OrchestratorEvent,
    Severity,
    TestResult,
    TestStatus,
    TestSuiteResult,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_git() -> GitPort:
    git = MagicMock(spec=GitPort)
    git.get_diff.return_value = CodeDiff(
        commit_sha="deadbeef",
        branch="feature/x",
        base_branch="main",
        files=[FileDiff(path="app/service.py", additions=10, deletions=2, patch="")],
    )
    return git


@pytest.fixture
def mock_llm() -> LLMPort:
    llm = MagicMock(spec=LLMPort)
    llm.complete.return_value = "Minimal change. Low risk."
    return llm


@pytest.fixture
def mock_runner() -> RunnerPort:
    runner = MagicMock(spec=RunnerPort)
    runner.run_tests.return_value = TestSuiteResult(
        run_id="run-001",
        results=[
            TestResult(
                test_id="t1",
                test_name="tests/test_service_generated.py::test_main",
                status=TestStatus.PASSED,
                duration_ms=42.0,
            )
        ],
        coverage_percent=85.0,
    )
    return runner


# ---------------------------------------------------------------------------
# Unit tests — _write_event (pure Python, no external deps)
# ---------------------------------------------------------------------------

class TestWriteEvent:
    def test_creates_log_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = os.path.join(tmpdir, "session_logs.json")
            event = OrchestratorEvent(
                session_id="s1",
                event_type=AgentEventType.STARTED,
                agent="Orchestrator",
                payload={"step": "test"},
            )
            _write_event(event, log_path=log_path)
            assert os.path.exists(log_path)
            with open(log_path) as fh:
                data = json.load(fh)
            assert len(data["sessions"]) == 1
            assert data["sessions"][0]["agent"] == "Orchestrator"

    def test_appends_multiple_events(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = os.path.join(tmpdir, "session_logs.json")
            for i in range(3):
                event = OrchestratorEvent(
                    session_id="s1",
                    event_type=AgentEventType.PROGRESS,
                    agent="TestAgent",
                    payload={"i": i},
                )
                _write_event(event, log_path=log_path)
            with open(log_path) as fh:
                data = json.load(fh)
            assert len(data["sessions"]) == 3


# ---------------------------------------------------------------------------
# Integration tests — Orchestrator.run
# ---------------------------------------------------------------------------

class TestOrchestrator:
    def _build(
        self,
        git: GitPort,
        llm: LLMPort,
        runner: RunnerPort,
        tmp_path: str,
    ) -> Orchestrator:
        return Orchestrator(
            git_port=git,
            llm_port=llm,
            runner_port=runner,
            source_root=tmp_path,
            test_dir="tests",
        )

    def test_run_returns_summary_dict(
        self,
        mock_git: GitPort,
        mock_llm: LLMPort,
        mock_runner: RunnerPort,
        tmp_path,
    ) -> None:
        os.makedirs(os.path.join(str(tmp_path), "tests"), exist_ok=True)

        with patch("app.application.orchestrator._write_event"):
            orch = self._build(mock_git, mock_llm, mock_runner, str(tmp_path))
            summary = orch.run("main", "feature/x")

        assert summary["passed"] == 1
        assert summary["failed"] == 0
        assert summary["coverage_percent"] == 85.0
        assert "session_id" in summary

    def test_run_calls_git_port(
        self,
        mock_git: GitPort,
        mock_llm: LLMPort,
        mock_runner: RunnerPort,
        tmp_path,
    ) -> None:
        os.makedirs(os.path.join(str(tmp_path), "tests"), exist_ok=True)

        with patch("app.application.orchestrator._write_event"):
            orch = self._build(mock_git, mock_llm, mock_runner, str(tmp_path))
            orch.run("main", "feature/x")

        mock_git.get_diff.assert_called_once_with("main", "feature/x")

    def test_healing_triggered_on_failure(
        self,
        mock_git: GitPort,
        mock_llm: LLMPort,
        tmp_path,
    ) -> None:
        failing_runner = MagicMock(spec=RunnerPort)
        failing_runner.run_tests.return_value = TestSuiteResult(
            run_id="run-002",
            results=[
                TestResult(
                    test_id="t1",
                    test_name="tests/test_service_generated.py::test_foo",
                    status=TestStatus.FAILED,
                    duration_ms=10.0,
                    error_message="AssertionError: expected True",
                )
            ],
            coverage_percent=40.0,
        )
        os.makedirs(os.path.join(str(tmp_path), "tests"), exist_ok=True)

        with patch("app.application.orchestrator._write_event"):
            orch = self._build(mock_git, mock_llm, failing_runner, str(tmp_path))
            summary = orch.run("main", "feature/x")

        # HealingAgent should have been invoked — LLM called at least twice
        # (once for ImpactAgent, once for HealingAgent)
        assert mock_llm.complete.call_count >= 2
        assert summary["tests_healed"] >= 1
