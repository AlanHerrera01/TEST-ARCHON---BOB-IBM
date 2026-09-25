"""
Adapter: BobLLMAdapter

Implements LLMPort using the IBM Bob / watsonx.ai REST API.
This is the ONLY place in the project where LLM tokens are spent.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error
from typing import Any


from app.application.ports.llm_port import LLMPort


class BobLLMAdapter(LLMPort):
    """
    Calls the IBM Bob (watsonx.ai) inference endpoint.

    Parameters
    ----------
    api_key:
        IBM Cloud API key.
    project_id:
        watsonx.ai project ID.
    model_id:
        Model identifier, e.g. ``"ibm/granite-13b-chat-v2"``.
    base_url:
        Base URL for the watsonx.ai API (region-specific).
    """

    DEFAULT_BASE_URL = "https://us-south.ml.cloud.ibm.com"
    GENERATE_PATH = "/ml/v1/text/generation?version=2023-05-29"
    CHAT_PATH = "/ml/v1/text/chat?version=2023-05-29"
    IAM_URL = "https://iam.cloud.ibm.com/identity/token"

    def __init__(
        self,
        api_key: str,
        project_id: str,
        model_id: str = "ibm/granite-13b-chat-v2",
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        self._api_key = api_key
        self._project_id = project_id
        self._model_id = model_id
        self._base_url = base_url.rstrip("/")
        self._iam_token: str | None = None

    # ------------------------------------------------------------------
    # LLMPort implementation
    # ------------------------------------------------------------------

    def complete(self, prompt: str, *, max_tokens: int = 1024) -> str:
        token = self._get_iam_token()
        payload: dict[str, Any] = {
            "model_id": self._model_id,
            "project_id": self._project_id,
            "input": prompt,
            "parameters": {
                "decoding_method": "greedy",
                "max_new_tokens": max_tokens,
            },
        }
        response = self._post(self._base_url + self.GENERATE_PATH, payload, token)
        return response["results"][0]["generated_text"]

    def chat(self, messages: list[dict[str, str]], *, max_tokens: int = 1024) -> str:
        token = self._get_iam_token()
        payload: dict[str, Any] = {
            "model_id": self._model_id,
            "project_id": self._project_id,
            "messages": messages,
            "parameters": {
                "max_new_tokens": max_tokens,
            },
        }
        response = self._post(self._base_url + self.CHAT_PATH, payload, token)
        return response["choices"][0]["message"]["content"]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_iam_token(self) -> str:
        """Obtain a short-lived IAM bearer token from IBM Cloud."""
        if self._iam_token:
            return self._iam_token
        data = f"grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={self._api_key}"
        req = urllib.request.Request(
            self.IAM_URL,
            data=data.encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"IAM token fetch failed ({exc.code}): {exc.reason}") from exc
        self._iam_token = result["access_token"]
        return self._iam_token  # type: ignore[return-value]

    def _post(self, url: str, payload: dict, token: str) -> dict:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="ignore")
            raise RuntimeError(f"LLM API error {exc.code}: {detail}") from exc
