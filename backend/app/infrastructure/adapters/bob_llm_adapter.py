"""
Adapter: BobLLMAdapter

Implements LLMPort using the IBM Bob / watsonx.ai REST API.
This is the ONLY place in the project where LLM tokens are spent.
"""
from __future__ import annotations

import json
import time
import urllib.request
import urllib.error
from typing import Any

# Maximum attempts for transient network errors (connection reset, timeout).
_MAX_RETRIES = 3
_RETRY_BACKOFF = [1.0, 3.0]  # seconds to wait before retry 2 and 3


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
        Model identifier, e.g. ``"meta-llama/llama-3-3-70b-instruct"``.
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
        model_id: str = "meta-llama/llama-3-3-70b-instruct",
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        self._api_key = api_key
        self._project_id = project_id
        self._model_id = model_id
        self._base_url = base_url.rstrip("/")
        self._iam_token: str | None = None
        # IBM IAM tokens expire after 3600 s; refresh 5 min early to be safe.
        self._iam_token_expires_at: float = 0.0

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
        """Obtain a short-lived IAM bearer token from IBM Cloud.

        Tokens expire after ~3600 s.  We cache the token and refresh it
        5 minutes before expiry so long-running sessions never hit a 401.
        """
        if self._iam_token and time.time() < self._iam_token_expires_at:
            return self._iam_token
        data = f"grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey={self._api_key}"
        req = urllib.request.Request(
            self.IAM_URL,
            data=data.encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    result = json.loads(resp.read().decode())
                break
            except urllib.error.HTTPError as exc:
                raise RuntimeError(f"IAM token fetch failed ({exc.code}): {exc.reason}") from exc
            except urllib.error.URLError as exc:
                last_exc = exc
                if attempt < len(_RETRY_BACKOFF):
                    time.sleep(_RETRY_BACKOFF[attempt])
        else:
            raise RuntimeError(f"IAM token fetch failed after {_MAX_RETRIES} attempts: {last_exc}") from last_exc
        self._iam_token = result["access_token"]
        # expires_in is typically 3600; fall back to 3600 if absent.
        expires_in = int(result.get("expires_in", 3600))
        self._iam_token_expires_at = time.time() + expires_in - 300  # 5-min buffer
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
        last_exc: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    return json.loads(resp.read().decode())
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode(errors="ignore")
                raise RuntimeError(f"LLM API error {exc.code}: {detail}") from exc
            except urllib.error.URLError as exc:
                last_exc = exc
                if attempt < len(_RETRY_BACKOFF):
                    time.sleep(_RETRY_BACKOFF[attempt])
        raise RuntimeError(f"LLM call failed after {_MAX_RETRIES} attempts: {last_exc}") from last_exc
