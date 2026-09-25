"""
Tests for application-layer utilities and robustness improvements:
  - clean_llm_code_output (llm_helpers.py)
  - _extract_hunks / get_file_diff (local_git_adapter.py)
  - TestRunnerAdapter timeout behaviour
"""
from __future__ import annotations

import subprocess
from unittest.mock import MagicMock, patch

import pytest

from app.application.utils.llm_helpers import clean_llm_code_output
from app.infrastructure.adapters.local_git_adapter import _extract_hunks
from app.infrastructure.adapters.test_runner_adapter import TestRunnerAdapter
from app.domain.exceptions import TestRunnerError


# ---------------------------------------------------------------------------
# clean_llm_code_output
# ---------------------------------------------------------------------------

class TestCleanLLMCodeOutput:
    def test_removes_python_fence(self) -> None:
        src = "```python\ndef test_foo(): pass\n```"
        assert clean_llm_code_output(src) == "def test_foo(): pass"

    def test_removes_plain_fence(self) -> None:
        src = "```\ndef test_bar(): assert True\n```"
        assert clean_llm_code_output(src) == "def test_bar(): assert True"

    def test_no_fence_returns_stripped(self) -> None:
        src = "  def test_clean(): pass  \n"
        assert clean_llm_code_output(src) == "def test_clean(): pass"

    def test_preserves_internal_content(self) -> None:
        src = "```python\nimport pytest\n\ndef test_a(): pass\ndef test_b(): pass\n```"
        result = clean_llm_code_output(src)
        assert "import pytest" in result
        assert "def test_a(): pass" in result
        assert "```" not in result

    def test_unclosed_fence_returns_content_after_opening(self) -> None:
        src = "```python\ndef test_incomplete(): pass\n"
        result = clean_llm_code_output(src)
        assert "def test_incomplete(): pass" in result
        assert "```" not in result

    def test_empty_string(self) -> None:
        assert clean_llm_code_output("") == ""

    def test_multi_block_takes_first_to_last(self) -> None:
        # Two fenced blocks — content between first open and last close
        src = "```\ndef a(): ...\n```\n\nsome prose\n\n```\ndef b(): ...\n```"
        result = clean_llm_code_output(src)
        assert "def a():" in result
        # Last closing fence consumed, no trailing ```
        assert not result.endswith("```")

    def test_no_language_tag_fence(self) -> None:
        src = "```\nresult = 42\n```"
        assert clean_llm_code_output(src) == "result = 42"


# ---------------------------------------------------------------------------
# _extract_hunks  (local_git_adapter — pure Python, no subprocess)
# ---------------------------------------------------------------------------

_SAMPLE_DIFF = """\
diff --git a/app/service.py b/app/service.py
index abc..def 100644
--- a/app/service.py
+++ b/app/service.py
@@ -10,7 +10,7 @@ class Service:
     def get(self):
-        return 400
+        return 404
     def post(self):
"""


class TestExtractHunks:
    def test_returns_only_hunk_lines(self) -> None:
        result = _extract_hunks(_SAMPLE_DIFF)
        assert "@@ -10,7 +10,7 @@" in result
        assert "-        return 400" in result
        assert "+        return 404" in result

    def test_strips_file_header_lines(self) -> None:
        result = _extract_hunks(_SAMPLE_DIFF)
        assert "diff --git" not in result
        assert "index abc" not in result
        assert "--- a/" not in result
        assert "+++ b/" not in result

    def test_empty_diff_returns_empty_string(self) -> None:
        assert _extract_hunks("") == ""

    def test_no_hunks_returns_empty_string(self) -> None:
        header_only = (
            "diff --git a/README.md b/README.md\n"
            "index 111..222 100644\n"
            "--- a/README.md\n"
            "+++ b/README.md\n"
        )
        assert _extract_hunks(header_only) == ""


# ---------------------------------------------------------------------------
# TestRunnerAdapter — timeout behaviour
# ---------------------------------------------------------------------------

class TestRunnerAdapterTimeout:
    def test_timeout_raises_test_runner_error(self, tmp_path) -> None:
        adapter = TestRunnerAdapter(timeout=1)
        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="pytest", timeout=1)):
            with pytest.raises(TestRunnerError, match="timed out"):
                adapter.run_tests([], working_dir=str(tmp_path))

    def test_custom_timeout_stored(self) -> None:
        adapter = TestRunnerAdapter(timeout=30)
        assert adapter._timeout == 30

    def test_default_timeout_is_10(self) -> None:
        adapter = TestRunnerAdapter()
        assert adapter._timeout == 10
