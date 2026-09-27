"""
FastAPI routes for TEST-ARCHON.

This file is the only place where FastAPI types are used.
The business logic is entirely in the application layer.
"""
from __future__ import annotations

import os
from typing import Generator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.application.orchestrator import Orchestrator
from app.infrastructure.adapters.bob_llm_adapter import BobLLMAdapter
from app.infrastructure.adapters.local_git_adapter import LocalGitAdapter
from app.infrastructure.adapters.github_api_adapter import GitHubAPIAdapter
from app.infrastructure.adapters.test_runner_adapter import TestRunnerAdapter
from app.infrastructure.api.sse import EventBus, format_sse

router = APIRouter(prefix="/api/v1")

# ---------------------------------------------------------------------------
# Shared event bus — wires orchestrator events to the SSE stream
# ---------------------------------------------------------------------------
_bus = EventBus()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    base: str = "main"
    head: str
    repo_path: str = "."
    use_github: bool = False


class ImpactedModuleOut(BaseModel):
    """A single file flagged by the ImpactAgent, with its risk level."""

    path: str
    severity: str
    reason: str = ""


class RunResponse(BaseModel):
    session_id: str
    diff_sha: str
    files_changed: int
    modules_impacted: int
    impacted_modules: list[ImpactedModuleOut] = []
    tests_generated: int
    tests_healed: int
    passed: int
    failed: int
    coverage_percent: float
    analysis_summary: str
    bobcoins_saved: float  # % of work done locally without LLM tokens


# ---------------------------------------------------------------------------
# Dependency: build orchestrator from env
# ---------------------------------------------------------------------------

def _build_orchestrator(repo_path: str, use_github: bool) -> Orchestrator:
    llm = BobLLMAdapter(
        api_key=os.environ["IBM_API_KEY"],
        project_id=os.environ["IBM_PROJECT_ID"],
        model_id=os.environ.get("IBM_MODEL_ID", "meta-llama/llama-3-3-70b-instruct"),
        base_url=os.environ.get("IBM_BASE_URL", "https://us-south.ml.cloud.ibm.com"),
    )

    if use_github:
        git = GitHubAPIAdapter(
            token=os.environ["GITHUB_TOKEN"],
            repo=os.environ["GITHUB_REPO"],
        )
    else:
        git = LocalGitAdapter(repo_path=repo_path)

    runner = TestRunnerAdapter()

    return Orchestrator(
        git_port=git,
        llm_port=llm,
        runner_port=runner,
        source_root=repo_path,
        on_event=_bus.publish,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/run", response_model=RunResponse, summary="Trigger the full QA pipeline")
def run_pipeline(body: RunRequest) -> RunResponse:
    """
    Kick off the TEST-ARCHON orchestration pipeline.
    Results are also streamed in real-time via GET /api/v1/events.
    """
    try:
        orchestrator = _build_orchestrator(body.repo_path, body.use_github)
        summary = orchestrator.run(body.base, body.head)
    except KeyError as exc:
        raise HTTPException(status_code=500, detail=f"Missing env var: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return RunResponse(**summary)


@router.get("/events", summary="SSE stream of orchestrator events")
def stream_events() -> StreamingResponse:
    """
    Server-Sent Events stream.  Connect before calling POST /run to receive
    live progress updates from all agents.
    """

    def generator() -> Generator[str, None, None]:
        with _bus.subscribe() as queue:
            while True:
                event = queue.get()
                if event is None:
                    break
                yield format_sse(event)

    return StreamingResponse(generator(), media_type="text/event-stream")


@router.get("/health", summary="Health check")
def health() -> dict:
    return {"status": "ok", "service": "TEST-ARCHON"}


@router.get("/sessions", summary="Retrieve all session logs")
def get_sessions() -> dict:
    """Return the contents of bob_sessions/session_logs.json."""
    import json

    log_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "..", "bob_sessions", "session_logs.json"
    )
    log_path = os.path.abspath(log_path)
    if not os.path.exists(log_path):
        return {"sessions": []}
    with open(log_path, encoding="utf-8") as fh:
        return json.load(fh)
