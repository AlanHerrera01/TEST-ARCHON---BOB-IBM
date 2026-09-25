# 🚀 TEST-ARCHON — Quickstart Guide

> Get the project running locally in under 10 minutes.

---

## Prerequisites

| Tool | Min. version | Check |
|------|-------------|-------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | any | `git --version` |

You also need **IBM Cloud / watsonx.ai** credentials:
- `IBM_API_KEY` — IBM Cloud API key
- `IBM_PROJECT_ID` — watsonx.ai project ID

The backend starts without them, but the LLM steps will fail. See [Demo Mode Without LLM](#demo-mode-without-llm) to test locally without credentials.

---

## 1. Clone the Repository

```bash
git clone https://github.com/JCA-Solution/TEST-ARCHON---BOB-IBM.git
cd TEST-ARCHON---BOB-IBM
```

---

## 2. Backend Setup

### 2.1 Create a virtual environment

```bash
cd backend

# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

The prompt will show `(.venv)` when the environment is active.

### 2.2 Install dependencies

```bash
pip install -r requirements.txt
```

### 2.3 Configure environment variables

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` in any editor and fill in:

```env
IBM_API_KEY=your_key_here
IBM_PROJECT_ID=your_project_id_here
IBM_MODEL_ID=ibm/granite-13b-chat-v2
IBM_BASE_URL=https://us-south.ml.cloud.ibm.com
```

> ⚠️ Never commit `.env` to Git. It is already in `.gitignore`.

### 2.4 Start the server

```bash
# From the backend/ folder
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Expected output:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

✅ Backend ready at: **http://localhost:8000**  
📖 Interactive API docs (Swagger): **http://localhost:8000/docs**

---

## 3. Frontend Setup

Open a **second terminal** (leave the backend running).

```bash
cd frontend
npm install
npm run dev
```

Expected output:

```
  VITE v5.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
```

✅ Dashboard ready at: **http://localhost:5173**

---

## 4. Run Your First Pipeline

With both services running:

1. Open **http://localhost:5173** in your browser.
2. Click one of the **Quick Demo** preset buttons:
   - 🔐 **Auth Refactor** — simulates auth module changes
   - 🧪 **Coverage Gap** — detects modules with no tests
   - 🩹 **Self-Healing** — repairs failing tests
3. Or fill in manually:
   - **Base branch**: `main`
   - **Head branch / SHA**: your branch name or commit SHA
   - **Repo path**: `.`
4. Click **▶ Run QA Pipeline**

The Agent Terminal will stream live events. On completion you'll see:
- Coverage ring with percentage
- **QA APPROVED** badge (coverage ≥ 80% and 0 failures)
- Before/After coverage comparison
- Bobcoins Saved indicator

---

## 5. Run Tests

```bash
# From backend/ with the virtual environment active
pytest tests/ -v --cov=app --cov-report=term-missing
```

Expected result: **45 tests passing**.

---

## 6. Key Folder Structure

```
TEST-ARCHON---BOB-IBM/
│
├── backend/                ← Python engine (FastAPI + Agents)
│   ├── .env.example        ← Copy to .env and fill credentials
│   ├── main.py             ← Entry point: uvicorn main:app
│   ├── requirements.txt    ← Python dependencies
│   └── app/
│       ├── domain/         ← Pure models (no frameworks)
│       ├── application/    ← Agents + Orchestrator + Ports
│       └── infrastructure/ ← Adapters + FastAPI layer
│
├── frontend/               ← React dashboard
│   ├── package.json        ← Node dependencies
│   └── src/
│       ├── App.jsx         ← Root component
│       ├── components/     ← CoverageCard, ImpactGraph, AgentTerminal…
│       └── services/api.js ← Backend communication
│
├── bob_sessions/           ← 📋 Traceability log (IBM Hackathon)
│   └── session_logs.json
│
└── doc/                    ← Documentation
    ├── QUICKSTART.md       ← This file
    ├── INICIO-RAPIDO.md    ← Spanish version
    ├── TECHNICAL.md        ← Detailed architecture (EN)
    └── TECNICO.md          ← Detailed architecture (ES)
```

---

## 7. Demo Mode Without LLM

If you don't have IBM credentials, create `backend/app/infrastructure/adapters/mock_llm_adapter.py`:

```python
from app.application.ports.llm_port import LLMPort

class MockLLMAdapter(LLMPort):
    """Returns fixed responses for local demo without IBM credentials."""

    def complete(self, prompt: str, *, max_tokens: int = 1024) -> str:
        if "risk" in prompt.lower():
            return "Low-risk change affecting utility modules. No critical vulnerabilities identified."
        return (
            "import pytest\n\n"
            "def test_placeholder():\n"
            "    \"\"\"Demo-mode generated test.\"\"\"\n"
            "    assert True\n"
        )

    def chat(self, messages, *, max_tokens: int = 1024) -> str:
        return self.complete(messages[-1].get("content", ""), max_tokens=max_tokens)
```

Then in `backend/app/infrastructure/api/routes.py`, temporarily replace `BobLLMAdapter` inside `_build_orchestrator()`:

```python
from app.infrastructure.adapters.mock_llm_adapter import MockLLMAdapter
llm = MockLLMAdapter()
```

---

## 8. Quick Reference Commands

```bash
# Start backend
cd backend && .venv\Scripts\activate && uvicorn main:app --reload --port 8000

# Run backend tests
cd backend && pytest tests/ -v

# Start frontend
cd frontend && npm run dev

# Production build
cd frontend && npm run build

# View session logs
cat bob_sessions/session_logs.json
```

---

## 9. Default Ports

| Service | URL | Description |
|---------|-----|-------------|
| Backend API | http://localhost:8000 | FastAPI REST + SSE |
| Swagger UI | http://localhost:8000/docs | Interactive API docs |
| Frontend | http://localhost:5173 | React dashboard |

---

## Issues?

See [`doc/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for solutions to common errors.
