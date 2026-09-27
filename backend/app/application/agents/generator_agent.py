"""
GeneratorAgent — Application layer sub-agent.

Responsibility: given an ImpactAnalysis, identify coverage gaps and
generate pytest test cases using the LLM.

Strategy:
  1. Pure-Python inspection of existing test files to detect gaps (no LLM cost).
  2. LLM is called ONCE per impacted module to generate a focused test stub.
"""
from __future__ import annotations

import os
import re

from app.domain.exceptions import TestGenerationError
from app.domain.models import (
    CoverageGap,
    GeneratedTest,
    ImpactAnalysis,
    Severity,
)
from app.application.ports.llm_port import LLMPort
from app.application.utils.llm_helpers import clean_llm_code_output


# ---------------------------------------------------------------------------
# Pure-Python gap detection (zero LLM cost)
# ---------------------------------------------------------------------------

def _existing_test_names(test_dir: str) -> set[str]:
    """Collect all test-function names found in *test_dir* via regex (no LLM)."""
    names: set[str] = set()
    if not os.path.isdir(test_dir):
        return names
    for root, _, files in os.walk(test_dir):
        for fname in files:
            if not fname.startswith("test_") or not fname.endswith(".py"):
                continue
            with open(os.path.join(root, fname), encoding="utf-8", errors="ignore") as fh:
                for match in re.finditer(r"def (test_\w+)", fh.read()):
                    names.add(match.group(1))
    return names


def _module_to_test_name(module_path: str) -> str:
    """Convert ``app/foo/bar.py`` → ``test_bar``."""
    stem = os.path.splitext(os.path.basename(module_path))[0]
    return f"test_{stem}"


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class GeneratorAgent:
    """
    Produces GeneratedTest objects for each coverage gap found in an ImpactAnalysis.

    Dependencies injected via constructor (Dependency Inversion Principle).
    """

    def __init__(self, llm: LLMPort, test_dir: str = "tests") -> None:
        self._llm = llm
        self._test_dir = test_dir

    def generate(self, analysis: ImpactAnalysis, source_root: str = ".") -> list[GeneratedTest]:
        """
        Identify gaps and generate tests for each impacted module.

        Returns a list of GeneratedTest — one per module with a detected gap.
        """
        existing = _existing_test_names(os.path.join(source_root, self._test_dir))
        gaps = self._detect_gaps(analysis, existing)

        if not gaps:
            return []

        generated: list[GeneratedTest] = []
        for gap in gaps:
            try:
                test_code = self._generate_test(gap, source_root)
            except Exception as exc:
                raise TestGenerationError(
                    f"Failed to generate test for {gap.module_path}: {exc}"
                ) from exc
            generated.append(
                GeneratedTest(
                    target_module=gap.module_path,
                    test_code=test_code,
                )
            )
        return generated

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _detect_gaps(
        self, analysis: ImpactAnalysis, existing_tests: set[str]
    ) -> list[CoverageGap]:
        gaps: list[CoverageGap] = []
        for module in analysis.impacted_modules:
            # __init__.py files are package markers; they expose no testable
            # public API and generate invalid filenames (test___init___generated.py).
            if os.path.basename(module.path) == "__init__.py":
                continue
            expected_test = _module_to_test_name(module.path)
            if expected_test not in existing_tests:
                gaps.append(
                    CoverageGap(
                        module_path=module.path,
                        function_name="<module>",
                        description=f"No test found matching '{expected_test}' for {module.path}",
                        severity=module.severity,
                    )
                )
        return gaps

    def _generate_test(self, gap: CoverageGap, source_root: str) -> str:
        """Build prompt from local source then invoke the LLM ONCE."""
        # Read source locally — no LLM cost for reading
        source_path = os.path.join(source_root, gap.module_path)
        source_snippet = ""
        if os.path.isfile(source_path):
            with open(source_path, encoding="utf-8", errors="ignore") as fh:
                lines = fh.readlines()[:80]  # first 80 lines as context
            source_snippet = "".join(lines)

        prompt = (
            "You are a senior Python QA engineer.\n"
            f"Generate a pytest test file for the module: `{gap.module_path}`\n\n"
            "Source preview (first 80 lines):\n"
            "```python\n"
            f"{source_snippet}\n"
            "```\n\n"
            "Requirements:\n"
            "- Use pytest fixtures where sensible.\n"
            "- Cover the public API (happy-path + one edge case per function).\n"
            "- Do NOT import the module under test with a relative import.\n"
            "- Output ONLY valid Python code, no prose.\n"
        )

        raw = self._llm.complete(prompt, max_tokens=1024)
        return clean_llm_code_output(raw)
