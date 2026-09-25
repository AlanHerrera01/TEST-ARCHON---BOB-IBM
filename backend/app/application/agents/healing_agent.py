"""
HealingAgent — Application layer sub-agent.

Responsibility: given a failing TestSuiteResult, attempt to repair
the broken tests by analysing the error messages and generating a fix.

Strategy:
  1. Parse test failure messages locally (pure Python, zero LLM cost).
  2. Call LLM ONCE per failing test with a focused repair prompt.
"""
from __future__ import annotations

import re

from app.domain.exceptions import HealingError
from app.domain.models import GeneratedTest, TestResult, TestStatus, TestSuiteResult
from app.application.ports.llm_port import LLMPort
from app.application.utils.llm_helpers import clean_llm_code_output


# ---------------------------------------------------------------------------
# Pure-Python helpers (zero LLM cost)
# ---------------------------------------------------------------------------

def _extract_error_context(result: TestResult) -> str:
    """Build a compact error summary from a TestResult — no LLM."""
    lines = [f"Test: {result.test_name}", f"Status: {result.status.value}"]
    if result.error_message:
        # Keep first 30 lines to avoid bloating the prompt
        error_lines = result.error_message.splitlines()[:30]
        lines.append("Error:\n" + "\n".join(error_lines))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class HealingAgent:
    """
    Attempts to repair failing tests by generating fixed versions via LLM.

    Dependencies injected via constructor (Dependency Inversion Principle).
    """

    def __init__(self, llm: LLMPort) -> None:
        self._llm = llm

    def heal(
        self,
        suite_result: TestSuiteResult,
        test_sources: dict[str, str],
    ) -> list[GeneratedTest]:
        """
        Analyse *suite_result* and return patched GeneratedTest objects.

        Parameters
        ----------
        suite_result:
            The output of the most recent test run.
        test_sources:
            Mapping of ``test_name → source_code`` for failed tests.
            Populated by the orchestrator before calling heal().

        Returns
        -------
        list[GeneratedTest]
            Repaired test files; one per unique failing module.
        """
        failing = [r for r in suite_result.results if r.status == TestStatus.FAILED]
        if not failing:
            return []

        healed: list[GeneratedTest] = []
        seen_modules: set[str] = set()

        for result in failing:
            module = self._infer_module(result.test_name)
            if module in seen_modules:
                continue
            seen_modules.add(module)

            source = test_sources.get(result.test_name, "# source not available")
            error_ctx = _extract_error_context(result)

            prompt = (
                "You are a senior Python QA engineer performing automated test healing.\n\n"
                "The following test is failing:\n"
                f"{error_ctx}\n\n"
                "Existing test source:\n"
                "```python\n"
                f"{source}\n"
                "```\n\n"
                "Instructions:\n"
                "1. Identify the root cause from the error message.\n"
                "2. Output a CORRECTED version of the test file.\n"
                "3. Output ONLY valid Python code — no prose, no markdown fences.\n"
            )

            try:
                raw_code = self._llm.complete(prompt, max_tokens=1024)
            except Exception as exc:
                raise HealingError(f"LLM healing call failed for {result.test_name}: {exc}") from exc

            healed.append(GeneratedTest(target_module=module, test_code=clean_llm_code_output(raw_code)))

        return healed

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _infer_module(test_name: str) -> str:
        """
        Convert a pytest node-id or test function name to a module path guess.
        ``tests/test_foo.py::test_bar`` → ``tests/test_foo.py``
        """
        match = re.match(r"([^:]+\.py)", test_name)
        return match.group(1) if match else test_name
