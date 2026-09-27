"""
Vercel serverless entry point for the FastAPI backend.
Vercel looks for a handler in api/index.py — mangum wraps the ASGI app.
"""
import sys
import os

# backend/ is two levels up from frontend/api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from mangum import Mangum
from main import app  # noqa: E402 — backend/main.py

handler = Mangum(app, lifespan="off")
