# TEST-ARCHON 🤖⚙️

> **Multi-Agent QA Orchestrator** — IBM Bob Hackathon 2.0

TEST-ARCHON automatically analyses every pull-request, identifies impacted modules, generates missing tests with IBM watsonx.ai (Granite), runs them, and heals failures — all in a single pipeline triggered from your CI or directly from the dashboard.

---

## Architecture

TEST-ARCHON follows strict **Hexagonal Architecture (Ports & Adapters)** and **SOLID principles**.

```
backend/app/
├── domain/           🟢  Pure Python models & exceptions — zero framework deps
├── application/      🟡  Ports (ABCs) + Agents + Orchestrator
│   ├── ports/            GitPort · LLMPort · RunnerPort
│   └── agents/           ImpactAgent · GeneratorAgent · HealingAgent
└── infrastructure/   🔵  Adapters + FastAPI entry-points
    ├── adapters/         LocalGit · GitHubAPI · BobLLM · TestRunner
    └── api/              routes.py · sse.py (SSE event stream)
```

### Bobcoin Isolation Strategy

| Work | Who does it | Token cost |
|------|-------------|-----------|
| Diff parsing | `LocalGitAdapter` (subprocess + pure Python regex) | **0** |
| AST analysis | `ImpactAgent._heuristic_severity()` (stdlib `ast`) | **0** |
| Test-gap detection | `GeneratorAgent._detect_gaps()` (regex walk) | **0** |
| Failure parsing | `HealingAgent._extract_error_context()` (string ops) | **0** |
| Risk summary | IBM Granite via `BobLLMAdapter` | 1× per run |
| Test generation | IBM Granite via `BobLLMAdapter` | 1× per gap |
| Test healing | IBM Granite via `BobLLMAdapter` | 1× per failure |

---

## Quickstart

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# → fill in IBM_API_KEY, IBM_PROJECT_ID, etc.

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/run` | Trigger the full QA pipeline |
| `GET`  | `/api/v1/events` | SSE stream of live agent events |
| `GET`  | `/api/v1/sessions` | Read `bob_sessions/session_logs.json` |
| `GET`  | `/api/v1/health` | Health check |

### POST `/api/v1/run` — request body

```json
{
  "base":      "main",
  "head":      "feature/my-branch",
  "repo_path": ".",
  "use_github": false
}
```

---

## Pipeline Flow

```
1. GitPort.get_diff(base, head)     ← pure CLI, no tokens
2. ImpactAgent.analyse(diff)        ← AST heuristics + 1 LLM call
3. GeneratorAgent.generate(analysis)← gap detection + 1 LLM call per gap
4. RunnerPort.run_tests(new_tests)  ← pytest subprocess, no tokens
5. HealingAgent.heal(failures)      ← 1 LLM call per failing test (if any)
6. OrchestratorEvent → bob_sessions/session_logs.json  (every step)
```

---

## Traceability — `bob_sessions/`

Every action emitted by the orchestrator is appended to [`bob_sessions/session_logs.json`](bob_sessions/session_logs.json) in the following format:

```json
{
  "session_id": "uuid",
  "event_type": "started | progress | completed | failed",
  "agent":      "Orchestrator | ImpactAgent | GeneratorAgent | HealingAgent",
  "payload":    { "...": "..." },
  "timestamp":  "2024-01-01T12:00:00.000Z"
}
```

---

## Running the Tests

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IBM_API_KEY` | ✅ | IBM Cloud API key |
| `IBM_PROJECT_ID` | ✅ | watsonx.ai project ID |
| `IBM_MODEL_ID` | optional | Default: `ibm/granite-13b-chat-v2` |
| `IBM_BASE_URL` | optional | Default: `https://us-south.ml.cloud.ibm.com` |
| `GITHUB_TOKEN` | only if `use_github=true` | GitHub PAT |
| `GITHUB_REPO` | only if `use_github=true` | `owner/repo` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Orchestrator | Python 3.11 |
| API server | FastAPI + Uvicorn |
| LLM | IBM watsonx.ai — Granite |
| Frontend | React 18 + Tailwind CSS + Vite |
| CI/CD | GitHub Actions |
| Test framework | pytest + pytest-cov |

---

*Built for IBM Bob Hackathon 2.0.*
