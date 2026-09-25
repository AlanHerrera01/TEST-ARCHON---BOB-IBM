"""
Domain exceptions for TEST-ARCHON.

These are pure-Python exceptions with no framework dependencies.
Infrastructure layers catch them and translate to HTTP / SSE errors.
"""


class TestArchonError(Exception):
    """Base exception for all TEST-ARCHON domain errors."""


class DiffParseError(TestArchonError):
    """Raised when a raw git diff cannot be parsed into a CodeDiff."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Failed to parse diff: {detail}")


class ImpactAnalysisError(TestArchonError):
    """Raised when the ImpactAgent cannot complete its analysis."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Impact analysis error: {detail}")


class TestGenerationError(TestArchonError):
    """Raised when the GeneratorAgent fails to produce a valid test."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Test generation error: {detail}")


class TestRunnerError(TestArchonError):
    """Raised when the test runner adapter encounters an execution error."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Test runner error: {detail}")


class HealingError(TestArchonError):
    """Raised when the HealingAgent cannot repair a failing test."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Healing error: {detail}")


class SessionLogError(TestArchonError):
    """Raised when writing to bob_sessions/ fails."""

    def __init__(self, detail: str) -> None:
        super().__init__(f"Session log error: {detail}")
