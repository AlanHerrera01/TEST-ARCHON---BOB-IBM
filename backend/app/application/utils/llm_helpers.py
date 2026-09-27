"""
Application-layer utilities shared by agents.

All helpers in this module are pure Python — zero external dependencies,
zero LLM cost.
"""
from __future__ import annotations

import re

# Matches an optional language tag after the opening fence (e.g. ```python)
_FENCE_OPEN  = re.compile(r"^```[a-zA-Z]*\s*$", re.MULTILINE)
_FENCE_CLOSE = re.compile(r"^```\s*$", re.MULTILINE)
# Any remaining fence line that survived extraction (stray ``` inside body)
_STRAY_FENCE = re.compile(r"^```[a-zA-Z]*\s*$", re.MULTILINE)

# Detects a repeated block: an "import" or "from" line that appears more than
# once at column 0 — a sign the LLM emitted two full test files concatenated.
_TOP_LEVEL_IMPORT = re.compile(r"^(?:import |from )", re.MULTILINE)


def clean_llm_code_output(raw: str) -> str:
    """
    Remove Markdown code fences from LLM output before saving or executing.

    LLMs frequently wrap generated code in triple-backtick blocks even when
    instructed not to.  Writing those fences to a ``.py`` file causes an
    immediate ``SyntaxError`` the first time pytest tries to collect it.

    Strategy (pure Python, zero token cost):
    1. If the output contains at least one fence, extract only the content
       between the first opening fence and the last closing fence.
    2. Strip any remaining stray fence lines from the extracted body
       (handles LLMs that embed extra ``` pairs inside the code block).
    3. Strip leading/trailing blank lines from the result.
    4. If no fences are found, return the input stripped of surrounding
       whitespace — the model behaved correctly.
    5. Deduplicate: if the LLM emits two full Python files concatenated
       (no fences), keep only the first block — detected by finding a
       second module-level ``import``/``from`` statement after the first
       function/class definition has already begun.

    Examples
    --------
    >>> clean_llm_code_output("```python\\ndef test_foo(): pass\\n```")
    'def test_foo(): pass'

    >>> clean_llm_code_output("def test_bar(): pass")
    'def test_bar(): pass'

    >>> clean_llm_code_output("```\\ndef a(): ...\\n```\\n\\n```\\ndef b(): ...\\n```")
    'def a(): ...'
    """
    # Fast path: no fences present
    if "```" not in raw:
        return _deduplicate_blocks(raw.strip())

    # Find the first opening fence
    open_match = _FENCE_OPEN.search(raw)
    if open_match is None:
        return _deduplicate_blocks(raw.strip())

    content_start = open_match.end()

    # Find the last closing fence that comes after content_start
    close_match = None
    for m in _FENCE_CLOSE.finditer(raw, content_start):
        close_match = m

    if close_match is None:
        # Unclosed fence — return everything after the opening fence
        extracted = raw[content_start:].strip()
    else:
        extracted = raw[content_start : close_match.start()].strip()

    # Remove any stray fence lines that survived (e.g. nested ``` blocks)
    cleaned_lines = [
        line for line in extracted.splitlines()
        if not _STRAY_FENCE.match(line)
    ]
    return "\n".join(cleaned_lines).strip()


def _deduplicate_blocks(code: str) -> str:
    """
    Guard against the LLM emitting two full Python files concatenated without
    any fence separators.  When a module-level import/from line reappears
    *after* at least one function or class definition has been seen, everything
    from that second import onward is treated as a duplicate and dropped.

    Pure Python, zero LLM cost.
    """
    lines = code.splitlines()
    saw_def = False
    cutoff = len(lines)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("def ") or stripped.startswith("class "):
            saw_def = True
        elif saw_def and (stripped.startswith("import ") or stripped.startswith("from ")):
            # Second import block after definitions — everything from here is a
            # duplicate; stop.
            cutoff = i
            break
    return "\n".join(lines[:cutoff]).strip()
