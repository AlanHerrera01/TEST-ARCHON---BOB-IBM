"""
Port: LLMPort

Defines the contract that any LLM adapter (IBM Bob, OpenAI, mock, etc.)
must fulfil.  Application agents use this interface — never the concrete class.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class LLMPort(ABC):
    """Primary port for all LLM inference calls."""

    @abstractmethod
    def complete(self, prompt: str, *, max_tokens: int = 1024) -> str:
        """
        Send *prompt* to the LLM and return the raw text completion.

        This is the only entry-point through which token spend occurs.
        All pre-processing (AST parsing, diff reading, etc.) must happen
        BEFORE calling this method, in pure Python code.

        Parameters
        ----------
        prompt:
            Fully constructed prompt string — no further formatting applied.
        max_tokens:
            Upper bound on response length; adapter may enforce lower limits.

        Returns
        -------
        str
            Raw completion text from the model.
        """

    @abstractmethod
    def chat(self, messages: list[dict[str, str]], *, max_tokens: int = 1024) -> str:
        """
        Multi-turn chat interface.

        Parameters
        ----------
        messages:
            List of ``{"role": "...", "content": "..."}`` dicts following the
            OpenAI-compatible conversation format.
        max_tokens:
            Upper bound on response length.

        Returns
        -------
        str
            Assistant reply text.
        """
