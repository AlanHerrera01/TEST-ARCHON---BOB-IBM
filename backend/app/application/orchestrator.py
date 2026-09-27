"""
Orchestrator — Application layer coordinator.

Coordinates the full QA pipeline:
  1. Fetch diff via GitPort (no LLM cost)
  2. Run ImpactAgent  → ImpactAnalysis
  3. Run GeneratorAgent → list[GeneratedTest]
  4. Execute new tests via RunnerPort
  5. If failures → run HealingAgent
  6. Emit OrchestratorEvent to bob_sessions/ after every step

All external side-effects are injected as ports — the orchestrator
itself has zero framework or infrastructure dependencies.
"""
from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict
from datetime import datetime
from typing import Callable, Optional

from app.domain.models import (
    AgentEventType,
    CodeDiff,
    GeneratedTest,
    ImpactAnalysis,
    OrchestratorEvent,
    TestSuiteResult,
)
from app.domain.exceptions import SessionLogError
from app.application.ports.git_port import GitPort
from app.application.ports.llm_port import LLMPort
from app.application.ports.runner_port import RunnerPort
from app.application.agents.impact_agent import ImpactAgent
from app.application.agents.generator_agent import GeneratorAgent
from app.application.agents.healing_agent import HealingAgent


# ---------------------------------------------------------------------------
# Session log writer (pure Python file I/O)
# ---------------------------------------------------------------------------

SESSION_LOG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..", "bob_sessions", "session_logs.json"
)


def _write_event(event: OrchestratorEvent, log_path: str = SESSION_LOG_PATH) -> None:
    """Append *event* to the bob_sessions JSON log (pure Python, no cost)."""
    log_path = os.path.abspath(log_path)
    try:
        if os.path.exists(log_path):
            with open(log_path, encoding="utf-8") as fh:
                data = json.load(fh)
        else:
            data = {"sessions": [], "schema_version": "1.0.0", "project": "TEST-ARCHON"}

        data["sessions"].append(
            {
                "session_id": event.session_id,
                "event_type": event.event_type.value,
                "agent": event.agent,
                "payload": event.payload,
                "timestamp": event.timestamp.isoformat(),
            }
        )

        # Keep the log bounded — retain only the most recent 200 entries so the
        # file never grows unbounded across many demo runs.
        if len(data["sessions"]) > 200:
            data["sessions"] = data["sessions"][-200:]

        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, default=str)
    except OSError as exc:
        raise SessionLogError(str(exc)) from exc


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

# Optional callback type for real-time SSE streaming
EventCallback = Callable[[OrchestratorEvent], None]


class Orchestrator:
    """
    Main coordinator for the TEST-ARCHON QA pipeline.

    Follows the Single Responsibility Principle: it ONLY orchestrates
    the pipeline flow.  Business logic lives in the agents; I/O in the adapters.
    """

    def __init__(
        self,
        git_port: GitPort,
        llm_port: LLMPort,
        runner_port: RunnerPort,
        source_root: str = ".",
        test_dir: str = "tests",
        on_event: Optional[EventCallback] = None,
    ) -> None:
        self._git = git_port
        self._runner = runner_port
        self._impact_agent = ImpactAgent(llm_port)
        self._generator_agent = GeneratorAgent(llm_port, test_dir=test_dir)
        self._healing_agent = HealingAgent(llm_port)
        self._source_root = source_root
        self._on_event = on_event  # optional real-time callback for SSE

    # ------------------------------------------------------------------
    # Public entry-point
    # ------------------------------------------------------------------

    def run(self, base: str, head: str) -> dict:
        """
        Execute the full QA pipeline and return a summary dict.

        Parameters
        ----------
        base:
            Base branch/ref (e.g. ``"main"``).
        head:
            Head branch/ref or commit SHA to analyse.

        Returns
        -------
        dict
            Pipeline summary consumable by the API layer.
        """
        session_id = str(uuid.uuid4())

        # ── Step 1: Fetch diff ───────────────────────────────────────────
        self._emit(session_id, AgentEventType.STARTED, "Orchestrator", {"step": "diff", "base": base, "head": head})
        diff: CodeDiff = self._git.get_diff(base, head)
        self._emit(session_id, AgentEventType.PROGRESS, "Orchestrator", {
            "step": "diff", "files_changed": len(diff.files)
        })

        # ── Step 2: Impact analysis ──────────────────────────────────────
        self._emit(session_id, AgentEventType.STARTED, "ImpactAgent", {"diff_sha": diff.commit_sha})
        analysis: ImpactAnalysis = self._impact_agent.analyse(diff)
        self._emit(session_id, AgentEventType.COMPLETED, "ImpactAgent", {
            "modules_impacted": len(analysis.impacted_modules),
            "summary": analysis.analysis_summary,
            "modules": [
                {
                    "path": m.path,
                    "severity": m.severity.value,
                    "reason": m.reason,
                }
                for m in analysis.impacted_modules
            ],
        })

        # ── Step 3: Test generation ──────────────────────────────────────
        self._emit(session_id, AgentEventType.STARTED, "GeneratorAgent", {
            "modules": [m.path for m in analysis.impacted_modules]
        })
        generated_tests: list[GeneratedTest] = self._generator_agent.generate(
            analysis, source_root=self._source_root
        )
        self._emit(session_id, AgentEventType.COMPLETED, "GeneratorAgent", {
            "tests_generated": len(generated_tests)
        })

        # ── Step 4: Write generated tests & run them ─────────────────────
        written_paths = self._write_generated_tests(generated_tests)

        # Include any existing baseline tests that cover the same modules so
        # the coverage percentage reflects the real pre-existing test suite
        # as well as the freshly generated ones.
        baseline_paths = self._find_baseline_tests(analysis)
        all_test_paths = baseline_paths + written_paths

        self._emit(session_id, AgentEventType.PROGRESS, "Orchestrator", {
            "step": "test_run", "test_files": written_paths
        })
        suite_result: TestSuiteResult = self._runner.run_tests(
            all_test_paths, working_dir=self._source_root
        )
        self._emit(session_id, AgentEventType.PROGRESS, "Orchestrator", {
            "step": "test_run",
            "passed": suite_result.passed,
            "failed": suite_result.failed,
            "coverage_percent": suite_result.coverage_percent,
        })

        # ── Step 5: Healing (only if there are failures) ─────────────────
        healed_tests: list[GeneratedTest] = []
        if suite_result.failed > 0:
            self._emit(session_id, AgentEventType.STARTED, "HealingAgent", {
                "failing_tests": suite_result.failed
            })
            test_sources = self._read_test_sources(written_paths)
            healed_tests = self._healing_agent.heal(suite_result, test_sources)
            self._write_generated_tests(healed_tests, overwrite=True)
            self._emit(session_id, AgentEventType.COMPLETED, "HealingAgent", {
                "tests_healed": len(healed_tests)
            })

        # ── Step 6: Final event ──────────────────────────────────────────
        # Bobcoins saved: ratio of pipeline work done locally (no LLM tokens).
        # Local work: diff fetch, unified-diff parse, gap detection (missing test
        # file check), test file write, subprocess pytest run, report parse,
        # coverage aggregation = 7 steps always free.
        # LLM calls: impact summary (1) + 1 per generated test + 1 per healed test.
        local_steps = 7
        llm_calls = 1 + len(generated_tests) + len(healed_tests)
        total_steps = local_steps + llm_calls
        bobcoins_saved = round((local_steps / total_steps) * 100, 1) if total_steps else 0.0

        summary = {
            "session_id": session_id,
            "diff_sha": diff.commit_sha,
            "files_changed": len(diff.files),
            "modules_impacted": len(analysis.impacted_modules),
            "impacted_modules": [
                {
                    "path": m.path,
                    "severity": m.severity.value,
                    "reason": m.reason,
                }
                for m in analysis.impacted_modules
            ],
            "tests_generated": len(generated_tests),
            "tests_healed": len(healed_tests),
            "passed": suite_result.passed,
            "failed": suite_result.failed,
            "coverage_percent": suite_result.coverage_percent,
            "analysis_summary": analysis.analysis_summary,
            "bobcoins_saved": bobcoins_saved,
        }
        self._emit(session_id, AgentEventType.COMPLETED, "Orchestrator", summary)
        return summary

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _emit(
        self,
        session_id: str,
        event_type: AgentEventType,
        agent: str,
        payload: dict,
    ) -> None:
        event = OrchestratorEvent(
            session_id=session_id,
            event_type=event_type,
            agent=agent,
            payload=payload,
        )
        _write_event(event)
        if self._on_event:
            self._on_event(event)

    def _write_generated_tests(
        self, tests: list[GeneratedTest], *, overwrite: bool = False
    ) -> list[str]:
        """Write generated test files to disk and return their paths."""
        paths: list[str] = []
        for test in tests:
            stem = os.path.splitext(os.path.basename(test.target_module))[0]
            filename = f"test_{stem}_generated.py"
            out_path = os.path.join(self._source_root, "tests", filename)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            if not os.path.exists(out_path) or overwrite:
                with open(out_path, "w", encoding="utf-8") as fh:
                    fh.write(test.test_code)
            paths.append(out_path)
        return paths

    @staticmethod
    def _read_test_sources(test_paths: list[str]) -> dict[str, str]:
        """Read test file contents keyed by path — pure Python, no LLM cost."""
        sources: dict[str, str] = {}
        for path in test_paths:
            if os.path.isfile(path):
                with open(path, encoding="utf-8", errors="ignore") as fh:
                    sources[path] = fh.read()
        return sources

    def _find_baseline_tests(self, analysis: "ImpactAnalysis") -> list[str]:
        """
        Find pre-existing baseline test files that cover the same module areas
        as the impacted modules.  Including them in the run raises the reported
        coverage to a realistic figure that reflects the full existing test suite.
        Pure Python — zero LLM cost.
        """
        test_dir = os.path.join(self._source_root, "tests")
        if not os.path.isdir(test_dir):
            return []

        # Collect the top-level package names from impacted module paths
        # e.g. "app/payments/processor.py" → "payments"
        packages: set[str] = set()
        for m in analysis.impacted_modules:
            parts = m.path.replace("\\", "/").split("/")
            # parts[0] is typically "app", parts[1] is the sub-package
            if len(parts) >= 2:
                packages.add(parts[1] if parts[0] == "app" else parts[0])

        baselines: list[str] = []
        for fname in os.listdir(test_dir):
            if not (fname.startswith("test_") and fname.endswith("_baseline.py")):
                continue
            # Include this baseline if its name contains any impacted package
            if any(pkg in fname for pkg in packages):
                baselines.append(os.path.join(test_dir, fname))

        return baselines
