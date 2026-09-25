"""
Tests for ImpactAgent.

Uses unittest.mock to avoid any LLM calls — pure domain logic is tested here.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.application.agents.impact_agent import (
    ImpactAgent,
    _heuristic_severity,
    parse_affected_functions,
)
from app.application.ports.llm_port import LLMPort
from app.domain.exceptions import ImpactAnalysisError
from app.domain.models import CodeDiff, FileDiff, Severity


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_llm() -> LLMPort:
    llm = MagicMock(spec=LLMPort)
    llm.complete.return_value = "This change modifies auth logic. Risk is high."
    return llm


@pytest.fixture
def sample_diff() -> CodeDiff:
    return CodeDiff(
        commit_sha="abc1234",
        branch="feature/login",
        base_branch="main",
        files=[
            FileDiff(path="app/auth/login.py", additions=120, deletions=30, patch=""),
            FileDiff(path="app/utils/helpers.py", additions=5, deletions=2, patch=""),
        ],
    )


# ---------------------------------------------------------------------------
# Unit tests — heuristic severity (pure Python, zero LLM cost)
# ---------------------------------------------------------------------------

class TestHeuristicSeverity:
    def test_auth_path_is_critical(self) -> None:
        assert _heuristic_severity("app/auth/token.py", 10, 5) == Severity.CRITICAL

    def test_high_churn_is_high(self) -> None:
        assert _heuristic_severity("app/utils/helpers.py", 150, 60) == Severity.HIGH

    def test_medium_churn_is_medium(self) -> None:
        assert _heuristic_severity("app/utils/helpers.py", 30, 25) == Severity.MEDIUM

    def test_low_churn_is_low(self) -> None:
        assert _heuristic_severity("app/utils/helpers.py", 5, 2) == Severity.LOW

    def test_payment_path_is_critical(self) -> None:
        assert _heuristic_severity("app/billing/payment.py", 1, 1) == Severity.CRITICAL


# ---------------------------------------------------------------------------
# Unit tests — ImpactAgent.analyse
# ---------------------------------------------------------------------------

class TestImpactAgent:
    def test_returns_impact_analysis(self, mock_llm: LLMPort, sample_diff: CodeDiff) -> None:
        agent = ImpactAgent(mock_llm)
        result = agent.analyse(sample_diff)

        assert result.diff_sha == "abc1234"
        assert len(result.impacted_modules) == 2
        mock_llm.complete.assert_called_once()

    def test_auth_module_gets_critical_severity(
        self, mock_llm: LLMPort, sample_diff: CodeDiff
    ) -> None:
        agent = ImpactAgent(mock_llm)
        result = agent.analyse(sample_diff)

        auth_module = next(m for m in result.impacted_modules if "auth" in m.path)
        assert auth_module.severity == Severity.CRITICAL

    def test_llm_override_applied(self, sample_diff: CodeDiff) -> None:
        llm = MagicMock(spec=LLMPort)
        llm.complete.return_value = (
            "Minor change.\nOVERRIDE app/utils/helpers.py critical"
        )
        agent = ImpactAgent(llm)
        result = agent.analyse(sample_diff)

        helpers = next(m for m in result.impacted_modules if "helpers" in m.path)
        assert helpers.severity == Severity.CRITICAL
        assert "LLM override" in helpers.reason

    def test_empty_diff_raises(self, mock_llm: LLMPort) -> None:
        empty_diff = CodeDiff(commit_sha="000", branch="x", base_branch="main", files=[])
        agent = ImpactAgent(mock_llm)
        with pytest.raises(ImpactAnalysisError):
            agent.analyse(empty_diff)

    def test_llm_failure_raises_impact_error(self, sample_diff: CodeDiff) -> None:
        llm = MagicMock(spec=LLMPort)
        llm.complete.side_effect = RuntimeError("connection refused")
        agent = ImpactAgent(llm)
        with pytest.raises(ImpactAnalysisError, match="LLM call failed"):
            agent.analyse(sample_diff)


# ---------------------------------------------------------------------------
# Unit tests — parse_affected_functions (multilenguaje, zero LLM cost)
# ---------------------------------------------------------------------------

class TestParseAffectedFunctions:
    # ── Python — AST path ───────────────────────────────────────────────────
    def test_python_extracts_public_functions(self) -> None:
        src = "def public_fn(): pass\ndef _private(): pass\nclass MyClass: pass\n"
        result = parse_affected_functions("app/service.py", src)
        assert "public_fn" in result
        assert "MyClass" in result
        assert "_private" not in result

    def test_python_async_function(self) -> None:
        src = "async def handle_request(): pass\n"
        result = parse_affected_functions("handlers.py", src)
        assert "handle_request" in result

    # ── Python — fallback regex cuando AST falla ────────────────────────────
    def test_python_syntax_error_fallback_to_regex(self) -> None:
        # Sintaxis inválida para ast.parse, pero def reconocible por regex
        broken_py = "def good_fn():\n    print 'python2 syntax'\n"
        result = parse_affected_functions("legacy.py", broken_py)
        assert "good_fn" in result

    def test_python_syntax_error_excludes_private(self) -> None:
        broken_py = "def _internal():\n    print 'nope'\ndef public_one(): pass\n"
        result = parse_affected_functions("old.py", broken_py)
        assert "_internal" not in result
        assert "public_one" in result

    # ── JavaScript / TypeScript ─────────────────────────────────────────────
    def test_js_extracts_functions(self) -> None:
        src = "export async function fetchData() {}\nfunction helper() {}\n"
        result = parse_affected_functions("api/client.js", src)
        assert "fetchData" in result
        assert "helper" in result

    def test_ts_extracts_functions(self) -> None:
        src = "export function parseToken(token: string): boolean { return true; }\n"
        result = parse_affected_functions("utils/auth.ts", src)
        assert "parseToken" in result

    def test_jsx_extracts_component(self) -> None:
        src = "export function Button({ onClick }) { return <button />; }\n"
        result = parse_affected_functions("components/Button.jsx", src)
        assert "Button" in result

    def test_tsx_extracts_component(self) -> None:
        src = "export function Header(): JSX.Element { return <header />; }\n"
        result = parse_affected_functions("components/Header.tsx", src)
        assert "Header" in result

    # ── Java ────────────────────────────────────────────────────────────────
    def test_java_extracts_public_methods(self) -> None:
        src = (
            "public class AuthService {\n"
            "    public boolean login(String user) { return true; }\n"
            "    private void helper() {}\n"
            "}\n"
        )
        result = parse_affected_functions("service/AuthService.java", src)
        assert "login" in result

    # ── Go ──────────────────────────────────────────────────────────────────
    def test_go_extracts_exported_functions(self) -> None:
        src = "func HandleRequest(w http.ResponseWriter, r *http.Request) {}\nfunc internal() {}\n"
        result = parse_affected_functions("handlers/api.go", src)
        assert "HandleRequest" in result
        # 'internal' starts with lowercase → Go convention, not exported
        assert "internal" not in result

    # ── C# ──────────────────────────────────────────────────────────────────
    def test_cs_extracts_public_methods(self) -> None:
        src = (
            "public class PaymentProcessor {\n"
            "    public bool ProcessPayment(decimal amount) { return true; }\n"
            "}\n"
        )
        result = parse_affected_functions("Payments/PaymentProcessor.cs", src)
        assert "ProcessPayment" in result

    # ── Archivos desconocidos ────────────────────────────────────────────────
    def test_unknown_extension_returns_module_scope(self) -> None:
        result = parse_affected_functions("config/settings.yaml", "key: value\n")
        assert result == ["module_scope"]

    def test_no_extension_returns_module_scope(self) -> None:
        result = parse_affected_functions("Makefile", "build:\n\tgo build ./...\n")
        assert result == ["module_scope"]

    def test_empty_content_python(self) -> None:
        result = parse_affected_functions("empty.py", "")
        assert result == []

    def test_empty_content_js(self) -> None:
        result = parse_affected_functions("empty.js", "")
        assert result == []
