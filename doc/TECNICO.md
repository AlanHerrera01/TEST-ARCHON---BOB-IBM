# TEST-ARCHON — Documentación Técnica

> IBM Bob Hackathon 2.0 · Orquestador Multiagente de QA  
> Versión 1.0.0 · Python 3.11+ · React 18 · FastAPI

---

## Tabla de Contenidos

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Arquitectura](#2-arquitectura)
   - 2.1 [Arquitectura Hexagonal (Ports & Adapters)](#21-arquitectura-hexagonal-ports--adapters)
   - 2.2 [Responsabilidades por Capa](#22-responsabilidades-por-capa)
   - 2.3 [Reglas de Dependencia](#23-reglas-de-dependencia)
3. [Capa de Dominio](#3-capa-de-dominio)
   - 3.1 [Modelos](#31-modelos)
   - 3.2 [Excepciones](#32-excepciones)
4. [Capa de Aplicación](#4-capa-de-aplicación)
   - 4.1 [Puertos (Interfaces)](#41-puertos-interfaces)
   - 4.2 [Agentes](#42-agentes)
   - 4.3 [Orquestador](#43-orquestador)
5. [Capa de Infraestructura](#5-capa-de-infraestructura)
   - 5.1 [Adaptadores](#51-adaptadores)
   - 5.2 [Capa API](#52-capa-api)
6. [Estrategia de Aislamiento de Bobcoins](#6-estrategia-de-aislamiento-de-bobcoins)
7. [Trazabilidad — bob_sessions/](#7-trazabilidad--bob_sessions)
8. [Arquitectura Frontend](#8-arquitectura-frontend)
9. [Pipeline CI/CD](#9-pipeline-cicd)
10. [Referencia de Configuración](#10-referencia-de-configuración)
11. [Referencia de la API](#11-referencia-de-la-api)
12. [Ejecución Local](#12-ejecución-local)
13. [Ejecución de Tests](#13-ejecución-de-tests)
14. [Extensión del Sistema](#14-extensión-del-sistema)

---

## 1. Visión General del Proyecto

TEST-ARCHON es un sistema de orquestación multiagente de QA que realiza automáticamente:

1. Obtiene el diff entre dos refs Git (`base` → `head`).
2. Identifica módulos impactados mediante heurísticas locales de AST/regex (costo cero en tokens).
3. Genera casos de prueba pytest faltantes a través de IBM watsonx.ai (Granite).
4. Ejecuta los tests generados y mide la cobertura.
5. Repara tests fallidos mediante el HealingAgent (una llamada LLM por fallo).
6. Registra cada acción como evento formal en `bob_sessions/session_logs.json`.
7. Transmite todos los eventos de agentes en tiempo real al dashboard React mediante SSE.

El objetivo de diseño central es la **eficiencia de tokens**: la gran mayoría del trabajo analítico (parsing de diff, análisis AST, detección de brechas de cobertura, análisis de salida de tests) se ejecuta como Python puro con costo cero en LLM. El LLM se invoca únicamente para tareas que requieren razonamiento semántico: resumen de riesgo, generación de tests y curación de tests.

---

## 2. Arquitectura

### 2.1 Arquitectura Hexagonal (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────┐
│                     INFRAESTRUCTURA                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ LocalGitAdap │  │ BobLLMAdapt  │  │ TestRunnerAdapt  │  │
│  │ GitHubAPIAdp │  │              │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │             │
│  ┌──────▼─────────────────▼───────────────────▼─────────┐  │
│  │                    APLICACIÓN                          │  │
│  │  GitPort (ABC)   LLMPort (ABC)   RunnerPort (ABC)      │  │
│  │                                                        │  │
│  │  ImpactAgent  GeneratorAgent  HealingAgent             │  │
│  │                                                        │  │
│  │                   Orquestador                          │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │                      DOMINIO                            │  │
│  │  CodeDiff  ImpactAnalysis  TestSuiteResult  Eventos     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  FastAPI (routes.py + sse.py) — solo punto de entrada       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Responsabilidades por Capa

| Capa | Paquete | Responsabilidad |
|------|---------|-----------------|
| **Dominio** | `app/domain/` | Reglas de negocio puras. Sin dependencias de frameworks. Solo dataclasses y enums. |
| **Aplicación** | `app/application/` | Coordinación de casos de uso (Orquestador) y definición de puertos (ABCs). Los agentes residen aquí. |
| **Infraestructura** | `app/infrastructure/` | Implementaciones concretas de adaptadores y el punto de entrada HTTP/SSE de FastAPI. |

### 2.3 Reglas de Dependencia

- Dominio ← Aplicación ← Infraestructura (estrictamente en un solo sentido)
- Ningún `import fastapi` o `import requests` en `domain/` ni en `application/`
- Ningún `import app.infrastructure` en `domain/` ni en `application/`
- Los adaptadores se inyectan en el arranque mediante argumentos de constructor (Inversión de Dependencias)

---

## 3. Capa de Dominio

**Ubicación:** `backend/app/domain/`

### 3.1 Modelos

Todos los modelos de dominio son `@dataclass` de Python puro sin dependencias externas.

| Clase | Descripción |
|-------|-------------|
| `FileDiff` | Diff de un archivo individual: `path`, `additions`, `deletions`, `patch` (texto bruto). |
| `CodeDiff` | Diff agregado de un puerto Git: lista de `FileDiff`, `commit_sha`, `branch`, `base_branch`. |
| `ImpactedModule` | Archivo identificado como en riesgo: `path`, `Severity`, `reason`. |
| `ImpactAnalysis` | Salida del `ImpactAgent`: lista de `ImpactedModule` + `analysis_summary`. |
| `CoverageGap` | Módulo sin archivo de test correspondiente, detectado por `GeneratorAgent`. |
| `GeneratedTest` | Archivo pytest producido por LLM: `target_module`, `test_code`. |
| `TestResult` | Resultado de un test individual: `test_id`, `status` (enum `TestStatus`), `duration_ms`, `error_message`. |
| `TestSuiteResult` | Agregado de una ejecución completa: lista de `TestResult`, `coverage_percent`. |
| `OrchestratorEvent` | Evento formal de trazabilidad emitido tras cada paso del pipeline. |

**Enumeraciones:**

```python
class Severity(str, Enum):
    LOW | MEDIUM | HIGH | CRITICAL

class TestStatus(str, Enum):
    PASSED | FAILED | ERROR | SKIPPED

class AgentEventType(str, Enum):
    STARTED | PROGRESS | COMPLETED | FAILED
```

### 3.2 Excepciones

Todas las excepciones heredan de `TestArchonError` y transportan un mensaje descriptivo:

| Excepción | Lanzada por |
|-----------|-------------|
| `DiffParseError` | Adaptadores Git cuando el diff no se puede parsear |
| `ImpactAnalysisError` | `ImpactAgent` en fallo de LLM o diff vacío |
| `TestGenerationError` | `GeneratorAgent` en fallo de LLM |
| `TestRunnerError` | `TestRunnerAdapter` cuando pytest no produce un reporte |
| `HealingError` | `HealingAgent` en fallo de LLM |
| `SessionLogError` | `_write_event()` en fallo del sistema de archivos |

---

## 4. Capa de Aplicación

**Ubicación:** `backend/app/application/`

### 4.1 Puertos (Interfaces)

Los puertos son clases abstractas `abc.ABC`. La capa de aplicación depende únicamente de estos contratos, nunca de adaptadores concretos.

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

### 4.2 Agentes

Cada agente es una clase de responsabilidad única, inyectada con los puertos que necesita.

#### ImpactAgent

**Entrada:** `CodeDiff`  
**Salida:** `ImpactAnalysis`

**Pipeline de procesamiento (fase de costo cero primero):**

1. **`_heuristic_severity(path, additions, deletions)`** — Python puro:
   - El path coincide con `auth|security|payment|billing|crypto|token|password|secret` → `CRITICAL`
   - Cambio total `> 200` líneas → `HIGH`; `> 50` → `MEDIUM`; resto → `LOW`

2. **`parse_affected_functions(file_path, file_content)`** — multilenguaje, cero LLM:
   - `.py` → `ast.parse()` con fallback a regex en `SyntaxError`
   - `.js/.jsx/.ts/.tsx` → regex sobre declaraciones `function`
   - `.java` → regex sobre modificadores de acceso
   - `.go` → regex sobre `func` exportado (inicial mayúscula)
   - `.cs` → regex sobre modificadores de acceso C#
   - Extensión desconocida → `["module_scope"]`

3. **Una sola llamada LLM** — envía únicamente metadatos (sin el patch bruto), recibe un resumen de 2 frases y directivas opcionales `OVERRIDE <path> <severity>`.

#### GeneratorAgent

**Entrada:** `ImpactAnalysis`  
**Salida:** `list[GeneratedTest]`

1. Recorre `test_dir` con regex para recopilar los nombres de funciones `test_*` existentes (costo cero en LLM).
2. Para cada módulo impactado sin archivo de test correspondiente → detectar como `CoverageGap`.
3. Para cada brecha: leer las primeras 80 líneas del fuente localmente, construir prompt enfocado, invocar LLM una vez.

#### HealingAgent

**Entrada:** `TestSuiteResult`, `dict[str, str]` (fuentes de tests)  
**Salida:** `list[GeneratedTest]` (tests reparados)

1. Filtrar `results` a `status == FAILED` (Python puro, costo cero en LLM).
2. Parsear `error_message` para producir un contexto de error compacto (≤ 30 líneas).
3. Para cada módulo fallido único: construir prompt de reparación con fuente original + contexto de error, invocar LLM una vez.

### 4.3 Orquestador

**Ubicación:** `backend/app/application/orchestrator.py`

El Orquestador coordina el pipeline de 5 pasos y es la única clase que llama a `_write_event()` para persistir los datos de trazabilidad.

```
run(base, head)
  │
  ├─ Paso 1: git_port.get_diff(base, head)              ← costo cero en LLM
  ├─ Paso 2: impact_agent.analyse(diff)                 ← 1 llamada LLM
  ├─ Paso 3: generator_agent.generate(analysis)         ← N llamadas LLM (1 por brecha)
  ├─ Paso 4: runner_port.run_tests(written_paths)       ← costo cero en LLM
  └─ Paso 5: healing_agent.heal(suite_result, sources)  ← M llamadas LLM (1 por fallo)
             [solo si suite_result.failed > 0]
```

**Cálculo de Bobcoins:**

```python
pasos_locales  = 4   # pasos 1, heurísticas, detección de brechas, paso 4
llamadas_llm   = 1 + len(generated) + len(healed)
bobcoins_saved = pasos_locales / (pasos_locales + llamadas_llm) * 100
```

**Callback de eventos:** Un `on_event: Callable[[OrchestratorEvent], None]` opcional se inyecta en el momento de la construcción. La capa FastAPI lo conecta al `EventBus` para streaming SSE.

---

## 5. Capa de Infraestructura

**Ubicación:** `backend/app/infrastructure/`

### 5.1 Adaptadores

#### LocalGitAdapter

Implementa `GitPort` usando el CLI local `git` mediante `subprocess.run`.

- `get_diff` → ejecuta `git diff <base>...<head> --unified=3`, pasa stdout a través de `_parse_unified_diff()`.
- `_parse_unified_diff(raw)` — escáner puro de líneas en Python: detecta cabeceras `diff --git`, cuenta líneas `+`/`-`, construye objetos `FileDiff`.
- Sin llamadas LLM, sin librerías de terceros.

#### GitHubAPIAdapter

Implementa `GitPort` usando la API REST de GitHub v3 (`/repos/{owner}/{repo}/compare/{base}...{head}`).

- Usa únicamente `urllib.request` de la stdlib — sin `requests` ni `httpx`.
- Se autentica mediante `Authorization: Bearer <GITHUB_TOKEN>`.

#### BobLLMAdapter

Implementa `LLMPort` usando la API de inferencia de IBM watsonx.ai.

```
Flujo de token IAM:
  POST https://iam.cloud.ibm.com/identity/token
       grant_type=...apikey&apikey=<IBM_API_KEY>
  → access_token (cacheado por instancia)

Generación de texto:
  POST <IBM_BASE_URL>/ml/v1/text/generation?version=2023-05-29
  Body: { model_id, project_id, input, parameters: { decoding_method, max_new_tokens } }

Chat:
  POST <IBM_BASE_URL>/ml/v1/text/chat?version=2023-05-29
  Body: { model_id, project_id, messages: [{role, content}], parameters }
```

Modelo por defecto: `ibm/granite-13b-chat-v2`

#### TestRunnerAdapter

Implementa `RunnerPort` usando `pytest` en un subproceso.

- Invoca: `python -m pytest --json-report --cov . --cov-report json -q`
- Parsea el reporte JSON (`pytest-json-report`) en `TestSuiteResult`.
- Lee `.coverage.json` (producido por `pytest-cov`) para obtener `coverage_percent`.

### 5.2 Capa API

**Ubicación:** `backend/app/infrastructure/api/`

#### routes.py

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/run` | Disparar pipeline. Body: `RunRequest`. Respuesta: `RunResponse`. |
| `GET` | `/api/v1/events` | Stream SSE. Abre suscripción al `EventBus`. |
| `GET` | `/api/v1/sessions` | Devuelve contenidos de `bob_sessions/session_logs.json`. |
| `GET` | `/api/v1/health` | `{ "status": "ok" }` |

**`RunRequest`:**

```json
{
  "base": "main",
  "head": "feature/mi-rama",
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
  "analysis_summary": "Cambio de bajo riesgo que afecta módulos de utilidades.",
  "bobcoins_saved": 80.0
}
```

#### sse.py — EventBus

Bus pub/sub thread-safe. Cada cliente SSE se suscribe mediante una `queue.Queue`. El orquestador llama a `bus.publish(event)` que encola el evento para todos los suscriptores activos. Un gestor de contexto (`subscribe()`) gestiona la desinscripción automática al desconectarse el cliente.

---

## 6. Estrategia de Aislamiento de Bobcoins

La siguiente tabla documenta exactamente qué operaciones se ejecutan localmente (costo cero en tokens) y cuáles invocan el LLM.

| Paso | Mecanismo | Costo LLM |
|------|-----------|-----------|
| Obtener diff | Subproceso `git diff` / API GitHub | **0** |
| Parsear diff en `FileDiff` | Escáner regex Python puro | **0** |
| Severidad heurística (`_heuristic_severity`) | Regex de path + umbral de cambio | **0** |
| Extraer símbolos afectados (`parse_affected_functions`) | `ast.parse()` + mapa regex por lenguaje | **0** |
| Detectar brechas de cobertura | Recorrer `tests/` con regex | **0** |
| Leer fuente para el prompt | Lectura de archivo `open()` (primeras 80 líneas) | **0** |
| Resumen de riesgo | `LLMPort.complete()` | **1 llamada** |
| Generar stub de test | `LLMPort.complete()` | **1 llamada por brecha** |
| Ejecutar tests + parsear resultados | Subproceso `pytest` + parseo JSON | **0** |
| Parsear mensajes de fallo | Manipulación de strings | **0** |
| Reparar test fallido | `LLMPort.complete()` | **1 llamada por fallo** |

Un pipeline típico con 1 test generado y 0 fallos: **4 pasos libres / 5 total = 80 % Bobcoins ahorrados**.

---

## 7. Trazabilidad — bob_sessions/

**Archivo:** `bob_sessions/session_logs.json`

Cada llamada a `_write_event()` agrega una entrada al array `sessions`:

```json
{
  "session_id": "3f2a1b...",
  "event_type": "started | progress | completed | failed",
  "agent":      "Orchestrator | ImpactAgent | GeneratorAgent | HealingAgent",
  "payload":    { "...": "datos específicos del contexto" },
  "timestamp":  "2024-06-01T10:30:00.000000+00:00"
}
```

El archivo se crea si no existe y se actualiza atómicamente (un solo `json.dump` por escritura). Los eventos nunca se eliminan.

Este log es el artefacto principal para la evaluación del IBM Bob Hackathon 2.0.

---

## 8. Arquitectura Frontend

**Ubicación:** `frontend/`

Construido con **React 18**, **Tailwind CSS 3** y **Vite 5**.

### Árbol de Componentes

```
App.jsx
├── Header.jsx                  — barra de marca
├── [Botones de Demo Presets]   — 3 disparadores de escenario con un clic
├── [Formulario de control manual] — inputs base/head/repo_path
├── CoverageCard.jsx            — anillo de cobertura + stats + barra Bobcoins
├── ImpactGraph.jsx             — gráfico de barras de severidad (SVG puro, sin librería)
├── HealDiffCard.jsx            — visor de diff para tests reparados
└── AgentTerminal.jsx
    ├── [Pestaña Live]          — log de eventos SSE (auto-scroll)
    └── [Pestaña Sessions]      — visor de acordeón de bob_sessions/
```

### Capa de Servicios (`src/services/api.js`)

| Función | Transporte | Descripción |
|---------|-----------|-------------|
| `runPipeline(params)` | `fetch` POST | Dispara el pipeline del backend |
| `subscribeToEvents(onEvent)` | `EventSource` (SSE) | Stream de eventos en vivo; devuelve función `close()` |
| `fetchSessions()` | `fetch` GET | Lee `bob_sessions/session_logs.json` vía backend |

### Demo Presets

Tres escenarios predefinidos en `App.jsx`:

| Etiqueta | Payload del preset |
|----------|--------------------|
| 🔐 Auth Refactor | `head: feature/auth-refactor` |
| 🧪 Coverage Gap | `head: feature/new-payment-service` |
| 🩹 Self-Healing | `head: feature/api-breaking-change` |

Cada preset rellena el formulario Y dispara el pipeline inmediatamente.

### Proxy de Vite

`vite.config.js` hace proxy de `/api/*` → `http://localhost:8000`. Sin problemas de CORS durante el desarrollo.

---

## 9. Pipeline CI/CD

**Archivo:** `.github/workflows/test-archon.yml`

Dos jobs en paralelo:

### Job: `backend`

1. Checkout del código
2. Configurar Python 3.11 con caché de pip
3. `pip install -r requirements.txt`
4. `ruff check app tests` — análisis estático (linting)
5. `mypy app --ignore-missing-imports` — verificación de tipos
6. `pytest tests/ --cov=app --cov-report=xml` — tests + cobertura
7. Subir cobertura a Codecov

### Job: `frontend`

1. Checkout del código
2. Configurar Node 20 con caché de npm
3. `npm install`
4. `npm run build` — build de producción de Vite

---

## 10. Referencia de Configuración

Toda la configuración del backend se realiza mediante variables de entorno (ver `backend/.env.example`):

| Variable | Requerida | Valor por defecto | Descripción |
|----------|-----------|-------------------|-------------|
| `IBM_API_KEY` | ✅ | — | Clave de API de IBM Cloud para intercambio de token IAM |
| `IBM_PROJECT_ID` | ✅ | — | Identificador del proyecto watsonx.ai |
| `IBM_MODEL_ID` | — | `ibm/granite-13b-chat-v2` | ID del modelo de inferencia |
| `IBM_BASE_URL` | — | `https://us-south.ml.cloud.ibm.com` | Endpoint regional de watsonx.ai |
| `GITHUB_TOKEN` | solo si `use_github=true` | — | Token de acceso personal de GitHub |
| `GITHUB_REPO` | solo si `use_github=true` | — | Slug del repositorio `owner/repo` |
| `HOST` | — | `0.0.0.0` | Host de enlace de Uvicorn |
| `PORT` | — | `8000` | Puerto de enlace de Uvicorn |

---

## 11. Referencia de la API

### POST `/api/v1/run`

Dispara el pipeline completo de QA de forma síncrona. Conéctate a `GET /api/v1/events` primero para recibir progreso en vivo.

**Cuerpo de la petición:**
```json
{
  "base": "main",
  "head": "feature/rama",
  "repo_path": ".",
  "use_github": false
}
```

**Respuesta `200`:**
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

**Error `500`:** `{ "detail": "mensaje de error" }`

---

### GET `/api/v1/events`

Stream SSE. Cada trama es un payload JSON:

```
data: {"session_id":"...","event_type":"progress","agent":"ImpactAgent","payload":{...},"timestamp":"..."}\n\n
```

---

### GET `/api/v1/sessions`

Devuelve el contenido completo de `bob_sessions/session_logs.json`.

---

### GET `/api/v1/health`

```json
{ "status": "ok", "service": "TEST-ARCHON" }
```

---

## 12. Ejecución Local

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
# Edita .env con tu IBM_API_KEY e IBM_PROJECT_ID

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Documentación interactiva de la API: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

El servidor de desarrollo de Vite hace proxy de `/api/*` a `http://localhost:8000` automáticamente.

---

## 13. Ejecución de Tests

```bash
cd backend
pytest tests/ -v --cov=app --cov-report=term-missing
```

Número actual de tests: **30 tests** en dos archivos:

| Archivo | Tests | Área de cobertura |
|---------|-------|-------------------|
| `tests/test_impact_agent.py` | 25 | Severidad heurística, `ImpactAgent.analyse`, `parse_affected_functions` (los 7 lenguajes) |
| `tests/test_orchestrator.py` | 5 | `_write_event`, `Orchestrator.run` (camino feliz, llamada git, activación de healing) |

Todos los tests usan `unittest.mock` — no se realizan llamadas reales a Git, LLM ni subprocesos.

---

## 14. Extensión del Sistema

### Agregar un nuevo lenguaje a `parse_affected_functions`

Edita `backend/app/application/agents/impact_agent.py`, agrega una entrada a `LANGUAGE_PATTERNS`:

```python
LANGUAGE_PATTERNS[".rb"] = re.compile(r"^def ([a-z][a-zA-Z0-9_?!]*)", re.MULTILINE)
```

No se necesitan cambios en otros archivos. Agrega un caso de test en `TestParseAffectedFunctions`.

### Agregar un nuevo proveedor de LLM

1. Crea `backend/app/infrastructure/adapters/mi_llm_adapter.py`.
2. Implementa `LLMPort` (métodos `complete` + `chat`).
3. Inyéctalo en `_build_orchestrator()` de `routes.py` basándose en una variable de entorno.
4. Cero cambios en las capas de Dominio o Aplicación.

### Agregar una nueva fuente Git

1. Crea `backend/app/infrastructure/adapters/mi_git_adapter.py`.
2. Implementa `GitPort` (`get_diff` + `get_changed_files`).
3. Conéctalo en `_build_orchestrator()`.

### Agregar un nuevo agente

1. Crea la clase del agente en `backend/app/application/agents/`.
2. Inyéctalo en `Orchestrator.__init__()`.
3. Agrega un nuevo paso en `Orchestrator.run()`.
4. Emite `OrchestratorEvent` antes y después del paso.
