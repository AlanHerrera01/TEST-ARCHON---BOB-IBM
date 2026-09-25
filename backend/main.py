"""
TEST-ARCHON — FastAPI entry point.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.api.routes import router

app = FastAPI(
    title="TEST-ARCHON",
    description="Multi-agent QA Orchestrator — IBM Bob Hackathon 2.0",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"message": "TEST-ARCHON is running. Visit /docs for the API."}
