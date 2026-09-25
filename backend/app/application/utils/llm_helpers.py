"""
Application-layer utilities shared by agents.

All helpers in this module are pure Python — zero external dependencies,
zero LLM cost.
"""
from __future__ import annotations

import re

# Matches an optional language tag after the opening fence (e.g. ```python)
_FENCE_OPEN = re.compile(r"^```[a-zA-Z]*\s*$", re.MULTILINE)
_FENCE_CLOSE = re.compile(r"^```\s*$", re.MULTILINE)


def clean_llm_code_output(raw: str) -> str:
    """
    Remove Markdown code fences from LLM output before saving or executing.

    LLMs frequently wrap generated code in triple-backtick blocks even when
    instructed not to.  Writing those fences to a ``.py`` file causes an
    immediate ``SyntaxError`` the first time pytest tries to collect it.

    Strategy (pure Python, zero token cost):
    1. If the output contains at least one `` ``` `` fence, extract only the
       content between the first opening fence and the last closing fence.
    2. Strip leading/trailing blank lines from the result.
    3. If no fences are found, return the input stripped of surrounding
       whitespace — the model behaved correctly.

    Examples
    --------
    >>> clean_llm_code_output("```python\\ndef test_foo(): pass\\n```")
    'def test_foo(): pass'

    >>> clean_llm_code_output("def test_bar(): pass")
    'def test_bar(): pass'

    >>> clean_llm_code_output("```\\ndef a(): ...\\n```\\n\\n```\\ndef b(): ...\\n```")
    'def a(): ...\\n\\n```\\ndef b(): ...'
    """
    # Fast path: no fences present
    if "```" not in raw:
        return raw.strip()

    # Find the first opening fence
    open_match = _FENCE_OPEN.search(raw)
    if open_match is None:
        return raw.strip()

    content_start = open_match.end()

    # Find the last closing fence that comes after content_start
    close_match = None
    for m in _FENCE_CLOSE.finditer(raw, content_start):
        close_match = m

    if close_match is None:
        # Unclosed fence — return everything after the opening fence
        return raw[content_start:].strip()

    return raw[content_start : close_match.start()].strip()
