"""
ImpactAgent — Application layer sub-agent.

Responsibility: given a CodeDiff, identify WHICH modules are at risk
and assign a severity to each.

Strategy:
  1. Pure-Python multilenguaje: AST para .py, regex por extensión para el resto.
  2. Call LLM ONLY to produce a human-readable analysis summary and
     to assign semantic severity when AST heuristics are insufficient.
"""
from __future__ import annotations

import ast
import os
import re

from app.domain.exceptions import ImpactAnalysisError
from app.domain.models import (
    CodeDiff,
    ImpactAnalysis,
    ImpactedModule,
    Severity,
)
from app.application.ports.llm_port import LLMPort


# ---------------------------------------------------------------------------
# Multilenguaje: mapeo extensión → regex de símbolos públicos
# ---------------------------------------------------------------------------

# Cada patrón captura el nombre del símbolo en el grupo 1.
LANGUAGE_PATTERNS: dict[str, re.Pattern[str]] = {
    # JavaScript / TypeScript / JSX / TSX
    ".js":  re.compile(r"(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)"),
    ".jsx": re.compile(r"(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)"),
    ".ts":  re.compile(r"(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)"),
    ".tsx": re.compile(r"(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)"),
    # Java
    ".java": re.compile(r"(?:public|protected|private)\s+(?:static\s+)?[A-Za-z<>\[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\("),
    # Go
    ".go": re.compile(r"^func\s+(?:\([^)]+\)\s+)?([A-Z][A-Za-z0-9_]*)\s*\(", re.MULTILINE),
    # C#
    ".cs": re.compile(r"(?:public|protected|internal|private)\s+(?:static\s+|virtual\s+|override\s+)?[A-Za-z<>\[\]?]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\("),
}

_HIGH_RISK_PATTERNS = re.compile(
    r"(auth|security|payment|billing|crypto|token|password|secret)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Multilenguaje: extracción de símbolos públicos (zero LLM cost)
# ---------------------------------------------------------------------------

def parse_affected_functions(file_path: str, file_content: str) -> list[str]:
    """
    Extrae nombres de funciones/clases públicas de *file_content*.

    Estrategia híbrida:
    - ``.py``  → ast.parse() con fallback a regex si hay SyntaxError.
    - Resto    → LANGUAGE_PATTERNS según extensión de *file_path*.
    - Desconocido → ["module_scope"] (nunca lanza excepción).
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".py":
        try:
            tree = ast.parse(file_content)
            return [
                node.name
                for node in ast.walk(tree)
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
                and not node.name.startswith("_")
            ]
        except SyntaxError:
            # Fallback a regex cuando el AST falla (e.g. Python 2 syntax)
            pattern = re.compile(r"^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)
            return [m.group(1) for m in pattern.finditer(file_content) if not m.group(1).startswith("_")]

    if ext in LANGUAGE_PATTERNS:
        return [m.group(1) for m in LANGUAGE_PATTERNS[ext].finditer(file_content)]

    return ["module_scope"]


def _heuristic_severity(path: str, additions: int, deletions: int) -> Severity:
    """Assign a severity level based on file path and churn size, no LLM."""
    if _HIGH_RISK_PATTERNS.search(path):
        return Severity.CRITICAL
    churn = additions + deletions
    if churn > 200:
        return Severity.HIGH
    if churn > 50:
        return Severity.MEDIUM
    return Severity.LOW


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class ImpactAgent:
    """
    Analyses a CodeDiff and returns an ImpactAnalysis.

    Dependencies injected via constructor (Dependency Inversion Principle).
    """

    def __init__(self, llm: LLMPort) -> None:
        self._llm = llm

    def analyse(self, diff: CodeDiff) -> ImpactAnalysis:
        """
        Main entry-point for impact analysis.

        Steps
        -----
        1. Compute heuristic severity per file (pure Python).
        2. Build a compact, token-efficient prompt summary.
        3. Call LLM once to enrich the summary and validate severities.
        4. Return a structured ImpactAnalysis.
        """
        if not diff.files:
            raise ImpactAnalysisError("Diff contains no changed files.")

        # Step 1 — local heuristics (zero LLM cost)
        impacted: list[ImpactedModule] = []
        for file_diff in diff.files:
            severity = _heuristic_severity(
                file_diff.path, file_diff.additions, file_diff.deletions
            )
            impacted.append(
                ImpactedModule(
                    path=file_diff.path,
                    severity=severity,
                    reason=f"Heuristic: +{file_diff.additions}/-{file_diff.deletions} lines",
                )
            )

        # Step 2 — compact prompt (only metadata, NOT the full patch)
        file_lines = "\n".join(
            f"  - {m.path} [{m.severity.value}] ({diff.files[i].additions}+ / {diff.files[i].deletions}-)"
            for i, m in enumerate(impacted)
        )
        prompt = (
            "You are a senior QA engineer reviewing a pull-request.\n"
            f"Branch: {diff.branch} → {diff.base_branch}\n"
            f"Commit: {diff.commit_sha}\n\n"
            "Changed files with heuristic severity:\n"
            f"{file_lines}\n\n"
            "Tasks:\n"
            "1. Write a 2-sentence risk summary for this change-set.\n"
            "2. If any severity label is wrong, reply with 'OVERRIDE <path> <new_severity>'.\n"
            "Respond in plain text only."
        )

        # Step 3 — single LLM call
        try:
            llm_response = self._llm.complete(prompt, max_tokens=512)
        except Exception as exc:
            raise ImpactAnalysisError(f"LLM call failed: {exc}") from exc

        # Step 4 — parse overrides (if any)
        override_pattern = re.compile(
            r"OVERRIDE\s+(\S+)\s+(low|medium|high|critical)", re.IGNORECASE
        )
        overrides = {m.group(1): Severity(m.group(2).lower()) for m in override_pattern.finditer(llm_response)}
        for module in impacted:
            if module.path in overrides:
                module.severity = overrides[module.path]
                module.reason += " (LLM override)"

        return ImpactAnalysis(
            diff_sha=diff.commit_sha,
            impacted_modules=impacted,
            analysis_summary=llm_response.split("OVERRIDE")[0].strip(),
        )
