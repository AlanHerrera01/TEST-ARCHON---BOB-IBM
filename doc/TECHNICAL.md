# TEST-ARCHON — Technical Documentation

> IBM Bob Hackathon 2.0 · Multi-Agent QA Orchestrator  
> Version 1.0.0 · Python 3.11+ · React 18 · FastAPI

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
   - 2.1 [Hexagonal Architecture (Ports & Adapters)](#21-hexagonal-architecture-ports--adapters)
   - 2.2 [Layer Responsibilities](#22-layer-responsibilities)
   - 2.3 [Dependency Rules](#23-dependency-rules)
3. [Domain Layer](#3-domain-layer)
   - 3.1 [Models](#31-models)
   - 3.2 [Exceptions](#32-exceptions)
4. [Application Layer](#4-application-layer)
   - 4.1 [Ports (Interfaces)](#41-ports-interfaces)
   - 4.2 [Agents](#42-agents)
   - 4.3 [Orchestrator](#43-orchestrator)
5. [Infrastructure Layer](#5-infrastructure-layer)
   - 5.1 [Adapters](#51-adapters)
   - 5.2 [API Layer](#52-api-layer)
6. [Bobcoin Isolation Strategy](#6-bobcoin-isolation-strategy)
7. [Traceability — bob_sessions/](#7-traceability--bob_sessions)
8. [Frontend Architecture](#8-frontend-architecture)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Configuration Reference](#10-configuration-reference)
11. [API Reference](#11-api-reference)
12. [Running Locally](#12-running-locally)
13. [Running Tests](#13-running-tests)
14. [Extending the System](#14-extending-the-system)

---

## 1. Project Overview

TEST-ARCHON is a multi-agent QA orchestration system that automatically:

1. Fetches the diff between two Git refs (`base` → `head`).
2. Identifies impacted modules using local AST/regex heuristics (zero LLM cost).
3. Generates missing pytest test cases via IBM watsonx.ai (Granite).
4. Executes the generated tests and measures coverage.
5. Repairs failing tests using the HealingAgent (one LLM call per failure).
6. Records every action as a formal event in `bob_sessions/session_logs.json`.
7. Streams all agent events in real-time to the React dashboard via SSE.

The core design goal is **token efficiency**: the vast majority of analytical work (diff parsing, AST analysis, coverage gap detection, test output parsing) runs as pure Python with zero LLM cost. The LLM is invoked only for tasks that require semantic reasoning: risk summarisation, test generation, and test healing.

---

## 2. Architecture

### 2.1 Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ LocalGitAdap │  │ BobLLMAdapt  │  │ TestRunnerAdapt  │  │
│  │ GitHubAPIAdp │  │              │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │             │
│  ┌──────▼─────────────────▼───────────────────▼─────────┐  │
│  │                    APPLICATION                         │  │
│  │  GitPort (ABC)   LLMPort (ABC)   RunnerPort (ABC)      │  │
│  │                                                        │  │
│  │  ImpactAgent  GeneratorAgent  HealingAgent             │  │
│  │                                                        │  │
│  │                   Orchestrator                         │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │                       DOMAIN                            │  │
│  │  CodeDiff  ImpactAnalysis  TestSuiteResult  Events      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  FastAPI (routes.py + sse.py) — entry point only            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Layer Responsibilities

| Layer | Package | Responsibility |
|-------|---------|----------------|
| **Domain** | `app/domain/` | Pure business rules. No framework dependencies. Dataclasses and enums only. |
| **Application** | `app/application/` | Use-case coordination (Orchestrator) and port definitions (ABCs). Agents live here. |
| **Infrastructure** | `app/infrastructure/` | Concrete adapter implementations and the FastAPI HTTP/SSE entry-point. |

### 2.3 Dependency Rules

- Domain ← Application ← Infrastructure (strictly one-way)
- No `import fastapi` or `import requests` anywhere in `domain/` or `application/`
- No `import app.infrastructure` anywhere in `domain/` or `application/`
- Adapters are injected at startup via constructor arguments (Dependency Inversion)

---

## 3. Domain Layer

**Location:** `backend/app/domain/`

### 3.1 Models

All domain models are plain Python `@dataclass` with no external dependencies.

| Class | Description |
|-------|-------------|
| `FileDiff` | Single-file diff: `path`, `additions`, `deletions`, `patch` (raw text). |
| `CodeDiff` | Aggregated diff from a Git port: list of `FileDiff`, `commit_sha`, `branch`, `base_branch`. |
| `ImpactedModule` | A file identified as at risk: `path`, `Severity`, `reason`. |
| `ImpactAnalysis` | Output of `ImpactAgent`: list of `ImpactedModule` + `analysis_summary`. |
| `CoverageGap` | A module with no corresponding test file, detected by `GeneratorAgent`. |
| `GeneratedTest` | LLM-produced pytest file: `target_module`, `test_code`. |
| `TestResult` | Single test outcome: `test_id`, `status` (`TestStatus` enum), `duration_ms`, `error_message`. |
| `TestSuiteResult` | Full run aggregate: list of `TestResult`, `coverage_percent`. |
| `OrchestratorEvent` | Formal traceability event emitted after every pipeline step. |

**Enums:**

```python
class Severity(str, Enum):
    LOW | MEDIUM | HIGH | CRITICAL

class TestStatus(str, Enum):
    PASSED | FAILED | ERROR | SKIPPED

class AgentEventType(str, Enum):
    STARTED | PROGRESS | COMPLETED | FAILED
```

### 3.2 Exceptions

All exceptions inherit from `TestArchonError` and carry a descriptive message:

| Exception | Raised by |
|-----------|-----------|
| `DiffParseError` | Git adapters when the diff cannot be parsed |
| `ImpactAnalysisError` | `ImpactAgent` on LLM failure or empty diff |
| `TestGenerationError` | `GeneratorAgent` on LLM failure |
| `TestRunnerError` | `TestRunnerAdapter` when pytest fails to produce a report |
| `HealingError` | `HealingAgent` on LLM failure |
| `SessionLogError` | `_write_event()` on file-system failure |

---

## 4. Application Layer

**Location:** `backend/app/application/`

### 4.1 Ports (Interfaces)

Ports are `abc.ABC` abstract classes. The application layer depends only on these contracts, never on concrete adapters.

#### `GitPort`

```python
class GitPort(ABC):
    def get_diff(self, base: str, head: str) -> CodeDiff: ...
    def get_changed_files(self, base: str, head: str) -> list[str]: ...
```

#### `LLMPort`

```python
class LLMPort(ABC):
    def complete(self, prompt: str, *, max_tokens: int = 1024) -> str: ...
    def chat(self, messages: list[dict[str, str]], *, max_tokens: int = 1024) -> str: ...
```

#### `RunnerPort`

```python
class RunnerPort(ABC):
    def run_tests(self, test_paths: list[str], *, working_dir: str = ".") -> TestSuiteResult: ...
    def get_coverage(self, working_dir: str = ".") -> float: ...
```

### 4.2 Agents

Each agent is a single-responsibility class injected with the ports it needs.

#### ImpactAgent

**Input:** `CodeDiff`  
**Output:** `ImpactAnalysis`

**Processing pipeline (zero-cost phase first):**

1. **`_heuristic_severity(path, additions, deletions)`** — pure Python:
   - Path matches `auth|security|payment|billing|crypto|token|password|secret` → `CRITICAL`
   - Churn `> 200` lines → `HIGH`; `> 50` → `MEDIUM`; else → `LOW`

2. **`parse_affected_functions(file_path, file_content)`** — multilanguage, zero LLM:
   - `.py` → `ast.parse()` with regex fallback on `SyntaxError`
   - `.js/.jsx/.ts/.tsx` → regex `function` declarations
   - `.java` → regex on access modifiers
   - `.go` → regex on exported `func` (uppercase)
   - `.cs` → regex on C# access modifiers
   - Unknown extension → `["module_scope"]`

3. **Single LLM call** — sends only metadata (no raw patch), receives 2-sentence summary and optional `OVERRIDE <path> <severity>` directives.

#### GeneratorAgent

**Input:** `ImpactAnalysis`  
**Output:** `list[GeneratedTest]`

1. Walk `test_dir` with regex to collect existing `test_*` function names (zero LLM cost).
2. For each impacted module without a matching test file → detect as `CoverageGap`.
3. For each gap: read first 80 lines of source locally, build focused prompt, invoke LLM once.

#### HealingAgent

**Input:** `TestSuiteResult`, `dict[str, str]` (test sources)  
**Output:** `list[GeneratedTest]` (repaired tests)

1. Filter `results` to `status == FAILED` (pure Python, zero LLM cost).
2. Parse `error_message` to produce a compact error context (≤ 30 lines).
3. For each unique failing module: build repair prompt with original source + error context, invoke LLM once.

### 4.3 Orchestrator

**Location:** `backend/app/application/orchestrator.py`

The Orchestrator coordinates the 5-step pipeline and is the only class that calls `_write_event()` to persist traceability data.

```
run(base, head)
  │
  ├─ Step 1: git_port.get_diff(base, head)              ← zero LLM cost
  ├─ Step 2: impact_agent.analyse(diff)                 ← 1 LLM call
  ├─ Step 3: generator_agent.generate(analysis)         ← N LLM calls (1 per gap)
  ├─ Step 4: runner_port.run_tests(written_paths)       ← zero LLM cost
  └─ Step 5: healing_agent.heal(suite_result, sources)  ← M LLM calls (1 per failure)
             [only if suite_result.failed > 0]
```

**Bobcoins calculation:**

```python
local_steps  = 4                              # steps 1, heuristics, gap detection, step 4
llm_calls    = 1 + len(generated) + len(healed)
bobcoins_saved = local_steps / (local_steps + llm_calls) * 100
```

**Event callback:** An optional `on_event: Callable[[OrchestratorEvent], None]` is injected at construction time. The FastAPI layer wires this to the `EventBus` for SSE streaming.

---

## 5. Infrastructure Layer

**Location:** `backend/app/infrastructure/`

### 5.1 Adapters

#### LocalGitAdapter

Implements `GitPort` using the local `git` CLI via `subprocess.run`.

- `get_diff` → runs `git diff <base>...<head> --unified=3`, pipes stdout through `_parse_unified_diff()`.
- `_parse_unified_diff(raw)` — pure Python line scanner: detects `diff --git` headers, counts `+`/`-` lines, builds `FileDiff` objects.
- No LLM calls, no third-party libraries.

#### GitHubAPIAdapter

Implements `GitPort` using the GitHub REST API v3 (`/repos/{owner}/{repo}/compare/{base}...{head}`).

- Uses only stdlib `urllib.request` — no `requests` or `httpx`.
- Authenticates via `Authorization: Bearer <GITHUB_TOKEN>`.

#### BobLLMAdapter

Implements `LLMPort` using the IBM watsonx.ai inference API.

```
IAM token flow:
  POST https://iam.cloud.ibm.com/identity/token
       grant_type=...apikey&apikey=<IBM_API_KEY>
  → access_token (cached per instance)

Text generation:
  POST <IBM_BASE_URL>/ml/v1/text/generation?version=2023-05-29
  Body: { model_id, project_id, input, parameters: { decoding_method, max_new_tokens } }

Chat:
  POST <IBM_BASE_URL>/ml/v1/text/chat?version=2023-05-29
  Body: { model_id, project_id, messages: [{role, content}], parameters }
```

Default model: `ibm/granite-13b-chat-v2`

#### TestRunnerAdapter

Implements `RunnerPort` using `pytest` in a subprocess.

- Invokes: `python -m pytest --json-report --cov . --cov-report json -q`
- Parses the JSON report (`pytest-json-report`) into `TestSuiteResult`.
- Reads `.coverage.json` (produced by `pytest-cov`) for `coverage_percent`.

### 5.2 API Layer

**Location:** `backend/app/infrastructure/api/`

#### routes.py

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/run` | Trigger pipeline. Body: `RunRequest`. Response: `RunResponse`. |
| `GET` | `/api/v1/events` | SSE stream. Opens `EventBus` subscription. |
| `GET` | `/api/v1/sessions` | Returns `bob_sessions/session_logs.json` contents. |
| `GET` | `/api/v1/health` | `{ "status": "ok" }` |

**`RunRequest`:**

```json
{
  "base": "main",
  "head": "feature/my-branch",
  "repo_path": ".",
  "use_github": false
}
```

**`RunResponse`:**

```json
{
  "session_id": "uuid",
  "diff_sha": "abc1234",
  "files_changed": 3,
  "modules_impacted": 3,
  "tests_generated": 2,
  "tests_healed": 0,
  "passed": 2,
  "failed": 0,
  "coverage_percent": 87.5,
  "analysis_summary": "Low-risk change affecting utility modules.",
  "bobcoins_saved": 80.0
}
```

#### sse.py — EventBus

Thread-safe pub/sub bus. Each SSE client subscribes via a `queue.Queue`. The orchestrator calls `bus.publish(event)` which enqueues the event for all active subscribers. A context-manager (`subscribe()`) handles automatic deregistration on client disconnect.

---

## 6. Bobcoin Isolation Strategy

The table below documents exactly which operations run locally (zero token cost) and which invoke the LLM.

| Step | Mechanism | LLM cost |
|------|-----------|-----------|
| Fetch diff | `git diff` subprocess / GitHub API | **0** |
| Parse diff into `FileDiff` | Pure Python regex scanner | **0** |
| Heuristic severity (`_heuristic_severity`) | Path regex + churn threshold | **0** |
| Extract affected symbols (`parse_affected_functions`) | `ast.parse()` + language regex map | **0** |
| Detect coverage gaps | Walk `tests/` with regex | **0** |
| Read source for prompt | `open()` file read (first 80 lines) | **0** |
| Risk summary | `LLMPort.complete()` | **1 call** |
| Generate test stub | `LLMPort.complete()` | **1 call per gap** |
| Run tests + parse results | `pytest` subprocess + JSON parse | **0** |
| Parse failure messages | String slicing | **0** |
| Repair failing test | `LLMPort.complete()` | **1 call per failure** |

A typical pipeline with 1 generated test and 0 failures: **4 free steps / 5 total = 80 % bobcoins saved**.

---

## 7. Traceability — bob_sessions/

**File:** `bob_sessions/session_logs.json`

Every `_write_event()` call appends one entry to the `sessions` array:

```json
{
  "session_id": "3f2a1b...",
  "event_type": "started | progress | completed | failed",
  "agent":      "Orchestrator | ImpactAgent | GeneratorAgent | HealingAgent",
  "payload":    { "...": "context-specific data" },
  "timestamp":  "2024-06-01T10:30:00.000000+00:00"
}
```

The file is created if absent and appended atomically (single `json.dump` per write). Events are never deleted.

This log is the primary artefact for IBM Bob Hackathon 2.0 evaluation.

---

## 8. Frontend Architecture

**Location:** `frontend/`

Built with **React 18**, **Tailwind CSS 3**, and **Vite 5**.

### Component Tree

```
App.jsx
├── Header.jsx                  — branding bar
├── [Demo Preset buttons]       — 3 one-click scenario triggers
├── [Manual control form]       — base/head/repo_path inputs
├── CoverageCard.jsx            — coverage ring + stats + Bobcoins bar
├── ImpactGraph.jsx             — severity bar chart (pure SVG, no library)
├── HealDiffCard.jsx            — diff viewer for healed tests
└── AgentTerminal.jsx
    ├── [Live tab]              — SSE event log (auto-scroll)
    └── [Sessions tab]          — bob_sessions/ accordion viewer
```

### Service Layer (`src/services/api.js`)

| Function | Transport | Description |
|----------|-----------|-------------|
| `runPipeline(params)` | `fetch` POST | Triggers the backend pipeline |
| `subscribeToEvents(onEvent)` | `EventSource` (SSE) | Live event stream; returns a `close()` function |
| `fetchSessions()` | `fetch` GET | Reads `bob_sessions/session_logs.json` via backend |

### Demo Presets

Three hardcoded scenarios in `App.jsx`:

| Label | Preset payload |
|-------|----------------|
| 🔐 Auth Refactor | `head: feature/auth-refactor` |
| 🧪 Coverage Gap | `head: feature/new-payment-service` |
| 🩹 Self-Healing | `head: feature/api-breaking-change` |

Each preset fills the form AND fires the pipeline immediately.

### Vite Proxy

`vite.config.js` proxies `/api/*` → `http://localhost:8000`. No CORS issues during development.

---

## 9. CI/CD Pipeline

**File:** `.github/workflows/test-archon.yml`

Two parallel jobs:

### Job: `backend`

1. Checkout code
2. Set up Python 3.11 with pip cache
3. `pip install -r requirements.txt`
4. `ruff check app tests` — linting
5. `mypy app --ignore-missing-imports` — type checking
6. `pytest tests/ --cov=app --cov-report=xml` — tests + coverage
7. Upload coverage to Codecov

### Job: `frontend`

1. Checkout code
2. Set up Node 20 with npm cache
3. `npm install`
4. `npm run build` — Vite production build

---

## 10. Configuration Reference

All backend configuration is via environment variables (see `backend/.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IBM_API_KEY` | ✅ | — | IBM Cloud API key for IAM token exchange |
| `IBM_PROJECT_ID` | ✅ | — | watsonx.ai project identifier |
| `IBM_MODEL_ID` | — | `ibm/granite-13b-chat-v2` | Inference model ID |
| `IBM_BASE_URL` | — | `https://us-south.ml.cloud.ibm.com` | watsonx.ai regional endpoint |
| `GITHUB_TOKEN` | only if `use_github=true` | — | GitHub personal access token |
| `GITHUB_REPO` | only if `use_github=true` | — | Repository slug `owner/repo` |
| `HOST` | — | `0.0.0.0` | Uvicorn bind host |
| `PORT` | — | `8000` | Uvicorn bind port |

---

## 11. API Reference

### POST `/api/v1/run`

Triggers the full QA pipeline synchronously. Connect to `GET /api/v1/events` first to receive live progress.

**Request body:**
```json
{
  "base": "main",
  "head": "feature/branch",
  "repo_path": ".",
  "use_github": false
}
```

**Response `200`:**
```json
{
  "session_id": "string (uuid)",
  "diff_sha": "string",
  "files_changed": 0,
  "modules_impacted": 0,
  "tests_generated": 0,
  "tests_healed": 0,
  "passed": 0,
  "failed": 0,
  "coverage_percent": 0.0,
  "analysis_summary": "string",
  "bobcoins_saved": 0.0
}
```

**Error `500`:** `{ "detail": "error message" }`

---

### GET `/api/v1/events`

SSE stream. Each frame is a JSON payload:

```
data: {"session_id":"...","event_type":"progress","agent":"ImpactAgent","payload":{...},"timestamp":"..."}\n\n
```

---

### GET `/api/v1/sessions`

Returns the full content of `bob_sessions/session_logs.json`.

---

### GET `/api/v1/health`

```json
{ "status": "ok", "service": "TEST-ARCHON" }
```

---

## 12. Running Locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your IBM_API_KEY and IBM_PROJECT_ID

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

The Vite dev server proxies `/api/*` to `http://localhost:8000` automatically.

---

## 13. Running Tests

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing
```

Current test count: **30 tests** across two files:

| File | Tests | Coverage area |
|------|-------|---------------|
| `tests/test_impact_agent.py` | 25 | Heuristic severity, ImpactAgent.analyse, parse_affected_functions (all 7 languages) |
| `tests/test_orchestrator.py` | 5 | _write_event, Orchestrator.run (happy path, git call, healing trigger) |

All tests use `unittest.mock` — no real Git, LLM, or subprocess calls are made.

---

## 14. Extending the System

### Adding a new language to `parse_affected_functions`

Edit `backend/app/application/agents/impact_agent.py`, add an entry to `LANGUAGE_PATTERNS`:

```python
LANGUAGE_PATTERNS[".rb"] = re.compile(r"^def ([a-z][a-zA-Z0-9_?!]*)", re.MULTILINE)
```

No other files need changing. Add a test case in `TestParseAffectedFunctions`.

### Adding a new LLM provider

1. Create `backend/app/infrastructure/adapters/my_llm_adapter.py`.
2. Implement `LLMPort` (`complete` + `chat` methods).
3. Inject it in `routes.py`'s `_build_orchestrator()` based on an env-var flag.
4. Zero changes to Domain or Application layers.

### Adding a new Git source

1. Create `backend/app/infrastructure/adapters/my_git_adapter.py`.
2. Implement `GitPort` (`get_diff` + `get_changed_files`).
3. Wire in `_build_orchestrator()`.

### Adding a new agent

1. Create the agent class in `backend/app/application/agents/`.
2. Inject it into `Orchestrator.__init__()`.
3. Add a new step in `Orchestrator.run()`.
4. Emit `OrchestratorEvent` before and after the step.
