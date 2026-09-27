# 🚀 TEST-ARCHON — Guía de Inicio Rápido

> Cómo tener el proyecto corriendo en tu máquina en menos de 10 minutos.

---

## Requisitos Previos

| Herramienta | Versión mínima | Verificar |
|-------------|----------------|-----------|
| Python | 3.11 – 3.14 | `python --version` |
| Node.js | 20+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | cualquier | `git --version` |

También necesitarás credenciales de **IBM Cloud / watsonx.ai**:

| Variable | Dónde obtenerla |
|----------|----------------|
| `IBM_API_KEY` | [cloud.ibm.com → Manage → Access → API keys](https://cloud.ibm.com/iam/apikeys) |
| `IBM_PROJECT_ID` | watsonx.ai → tu proyecto → pestaña **Manage → General** (UUID de 36 chars) |

> El modelo por defecto es **`meta-llama/llama-3-3-70b-instruct`** (disponible en el plan Lite).
> `ibm/granite-13b-chat-v2` fue **deprecado** — no lo uses.

---

## 1. Clonar el Repositorio

```bash
git clone https://github.com/JCA-Solution/TEST-ARCHON---BOB-IBM.git
cd TEST-ARCHON---BOB-IBM
```

---

## 2. Configurar el Backend

### 2.1 Entorno virtual

```powershell
# Windows (PowerShell)
cd backend
python -m venv .venv
.venv\Scripts\activate
```

```bash
# macOS / Linux
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

El prompt mostrará `(.venv)` cuando esté activo.

### 2.2 Instalar dependencias

```bash
pip install -r requirements.txt
```

### 2.3 Configurar `.env`

```powershell
# Windows
copy .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Abre `.env` y rellena:

```env
IBM_API_KEY=tu_clave_api_ibm_cloud
IBM_PROJECT_ID=xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx
IBM_MODEL_ID=meta-llama/llama-3-3-70b-instruct
IBM_BASE_URL=https://us-south.ml.cloud.ibm.com
```

> ⚠️ **NUNCA** subas el `.env` a Git. Ya está en `.gitignore`.

### 2.4 Verificar conexión LLM (opcional pero recomendado)

```bash
# Desde backend/ con el entorno activo
python -c "
import os; from dotenv import load_dotenv; load_dotenv()
from app.infrastructure.adapters.bob_llm_adapter import BobLLMAdapter
llm = BobLLMAdapter(os.environ['IBM_API_KEY'], os.environ['IBM_PROJECT_ID'])
print(llm.complete('Reply with just the word: OK', max_tokens=5))
"
```

Respuesta esperada: `OK` (o similar). Si ves `403 no_associated_service_instance_error`,
el proyecto de watsonx.ai no tiene WML asociado — ve a
**[dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com)** →
tu proyecto → **Manage → Services & integrations → Associate service → WatsonMachineLearning**.

### 2.5 Arrancar el servidor

```bash
# Desde backend/ con el entorno activo
uvicorn main:app --env-file .env --reload --host 0.0.0.0 --port 8000
```

Salida esperada:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Health check rápido:

```bash
curl http://localhost:8000/api/v1/health
# {"status":"ok","service":"TEST-ARCHON"}
```

---

## 3. Configurar el Frontend

Abre **otra terminal** (deja el backend corriendo).

```bash
cd frontend
npm install
npm run dev
```

Salida esperada:

```
  VITE v5.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

`vite.config.js` ya proxea `/api → http://localhost:8000` — no hay CORS que configurar.

---

## 4. Ejecutar el Pipeline

Hay **tres formas** de lanzar el pipeline según tu situación:

---

### 4.1 Modo Demo Rápida (sin ramas reales)

Los botones del header (**Auth Refactor**, **Coverage Gap**, **Self-Healing**) usan ramas
sintéticas que **no necesitan existir en Git**. El `LocalGitAdapter` devuelve un diff
realista pre-cargado y el pipeline corre completo de extremo a extremo.

**Cuándo usarlo:** hackathon, demo en vivo, prueba rápida sin preparación.

1. Abre **http://localhost:5173**
2. Haz clic en cualquiera de los tres botones del header
3. Observa el terminal de agentes en tiempo real

Módulos reales que se analizan en cada preset:

| Preset | Módulos analizados | Agente estrella |
|--------|--------------------|-----------------|
| 🔐 Auth Refactor | `app/auth/jwt_handler.py`, `app/auth/middleware.py` | ImpactAgent (CRITICAL) |
| 🧪 Coverage Gap | `app/payments/processor.py`, `app/payments/models.py` | GeneratorAgent |
| 🩹 Self-Healing | `app/api/v2/endpoints.py`, `tests/test_api_users.py` | HealingAgent |

---

### 4.2 Modo Rama Real (diff de tu propio código)

Para analizar cambios **reales** de tu repositorio:

#### Paso 1 — Crea una rama con cambios

```bash
# Desde la raíz del proyecto (o cualquier repo Python que quieras analizar)
git checkout -b feature/mi-prueba main

# Haz un cambio real: edita un archivo Python existente
# Por ejemplo, añade una función nueva a cualquier módulo:
echo "" >> backend/app/auth/jwt_handler.py
echo "def health_check() -> str:" >> backend/app/auth/jwt_handler.py
echo "    return 'ok'" >> backend/app/auth/jwt_handler.py

git add -A
git commit -m "feat: añadir health_check al módulo auth"
```

#### Paso 2 — Lanza el pipeline desde el dashboard

1. Abre **http://localhost:5173**
2. Rellena la barra de controles:

   | Campo | Valor |
   |-------|-------|
   | **Base branch** | `main` |
   | **Head branch / SHA** | `feature/mi-prueba` |
   | **Repo path** | `..` ← relativo a `backend/`, apunta a la raíz del repo |

3. Haz clic en **▶ Run QA Pipeline**

> ⚠️ **`Repo path` es relativo al directorio desde donde arrancó uvicorn** (`backend/`).
> Por eso usa `..` para apuntar a la raíz, o una ruta absoluta:
> `C:\Users\TuUsuario\Desktop\TEST-ARCHON---BOB-IBM`

#### Paso 3 — Desde la terminal (sin UI)

```bash
curl -X POST http://localhost:8000/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{
    "base": "main",
    "head": "feature/mi-prueba",
    "repo_path": "..",
    "use_github": false
  }'
```

Respuesta JSON con el resumen completo del pipeline.

---

### 4.3 Modo SHA de Commit

Puedes apuntar a cualquier SHA en lugar de un nombre de rama:

```bash
# Obtén el SHA del commit que quieres analizar
git log --oneline -5
# 4b22e5c docs: add local startup guides
# af1fcc2 feat: initial full scaffold

# Lanza con el SHA completo o corto
curl -X POST http://localhost:8000/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{"base":"main","head":"af1fcc2","repo_path":"..","use_github":false}'
```

---

## 5. Crear Ramas Demo Representativas

Si quieres demostrar escenarios concretos con código **tuyo** en lugar de los presets:

### 5.1 Auth Refactor (severidad CRITICAL)

```bash
git checkout -b feature/auth-hardening main

# Modifica el módulo de autenticación
cat >> backend/app/auth/jwt_handler.py << 'EOF'

def revoke_token(token_id: str) -> bool:
    """Revoca un token añadiéndolo a la blacklist."""
    _REVOKED.add(token_id)
    return True

_REVOKED: set[str] = set()
EOF

git add -A
git commit -m "security: añadir revocación de tokens JWT"
```

Ejecuta en el dashboard con `head=feature/auth-hardening` y `repo_path=..`.
El **ImpactAgent** detectará el path `app/auth/` y asignará severidad **CRITICAL**.

---

### 5.2 Coverage Gap (módulo sin tests)

```bash
git checkout -b feature/nuevo-modulo main

# Crea un módulo Python nuevo SIN tests existentes
mkdir -p backend/app/notifications
cat > backend/app/notifications/__init__.py << 'EOF'
EOF

cat > backend/app/notifications/sender.py << 'EOF'
"""Módulo de notificaciones — nuevo en esta rama."""

def send_email(to: str, subject: str, body: str) -> bool:
    """Envía un email (stub para demo)."""
    if not to or "@" not in to:
        raise ValueError(f"Email inválido: {to!r}")
    print(f"[EMAIL] → {to} | {subject}")
    return True

def send_sms(phone: str, message: str) -> bool:
    """Envía un SMS (stub para demo)."""
    if not phone.startswith("+"):
        raise ValueError("El teléfono debe incluir prefijo internacional")
    print(f"[SMS] → {phone} | {message[:20]}...")
    return True
EOF

git add -A
git commit -m "feat: añadir módulo de notificaciones"
```

Ejecuta con `head=feature/nuevo-modulo`. El **GeneratorAgent** detectará que no existe
`test_sender` y generará tests automáticamente.

---

### 5.3 Self-Healing (cambio de API rompedor)

```bash
git checkout -b feature/api-v2-breaking main

# Cambia la firma de una función ya testeada (int → str)
# Edita backend/app/api/v2/endpoints.py:
# Cambia: def get_user(user_id: str)
# Por:    def get_user(user_id: str, include_deleted: bool = False)
sed -i 's/def get_user(user_id: str):/def get_user(user_id: str, include_deleted: bool = False):/' \
  backend/app/api/v2/endpoints.py 2>/dev/null || \
  powershell -Command "(Get-Content backend/app/api/v2/endpoints.py) -replace 'def get_user\(user_id: str\):', 'def get_user(user_id: str, include_deleted: bool = False):' | Set-Content backend/app/api/v2/endpoints.py"

git add -A
git commit -m "feat: get_user ahora acepta include_deleted"
```

Ejecuta con `head=feature/api-v2-breaking`. Los tests existentes fallarán y el
**HealingAgent** los reparará automáticamente.

---

## 6. Ejecutar los Tests del Proyecto

```bash
# Desde backend/ con el entorno activo
pytest tests/ -v
```

Resultado esperado: **70 tests pasando** (48 originales + 22 baseline de los módulos demo).

```bash
# Con cobertura de los módulos demo
pytest tests/ -v \
  --cov=app/auth --cov=app/payments --cov=app/api \
  --cov-report=term-missing
```

Los mismos checks que ejecuta la CI:

```bash
ruff check app tests          # lint
mypy app --ignore-missing-imports  # tipos
npm run build --prefix ../frontend # build frontend
```

---

## 7. Estructura de Carpetas Clave

```
TEST-ARCHON---BOB-IBM/
│
├── backend/
│   ├── .env.example           ← Copia a .env y rellena tus credenciales
│   ├── main.py                ← Punto de entrada uvicorn
│   ├── requirements.txt
│   ├── tests/
│   │   ├── test_impact_agent.py       ← 25 tests unitarios
│   │   ├── test_orchestrator.py       ←  5 tests unitarios
│   │   ├── test_robustness.py         ← 18 tests unitarios
│   │   ├── test_auth_baseline.py      ←  8 tests de módulos demo
│   │   ├── test_payments_baseline.py  ←  7 tests de módulos demo
│   │   └── test_api_v2_baseline.py    ←  7 tests de módulos demo
│   └── app/
│       ├── auth/              ← Módulos demo: jwt_handler, middleware
│       ├── payments/          ← Módulos demo: processor, models
│       ├── api/v2/            ← Módulos demo: endpoints
│       ├── domain/            ← Modelos puros
│       ├── application/       ← Agentes + Orquestador + Puertos
│       │   ├── agents/        ← ImpactAgent · GeneratorAgent · HealingAgent
│       │   └── ports/         ← GitPort · LLMPort · RunnerPort
│       └── infrastructure/    ← Adaptadores + API FastAPI
│           ├── adapters/      ← LocalGit · GitHubAPI · BobLLM · TestRunner
│           └── api/           ← routes.py · sse.py
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js         ← Proxy /api → :8000
│   └── src/
│       ├── App.jsx            ← Layout dashboard (grid 3/6/3)
│       └── components/        ← Header · CoverageCard · AgentTerminal
│                                 ImpactGraph · HealDiffCard
│
├── bob_sessions/
│   └── session_logs.json      ← Trazabilidad de sesiones (IBM Bob)
│
└── doc/
    ├── INICIO-RAPIDO.md       ← Este archivo
    ├── QUICKSTART.md          ← Versión inglés
    ├── TECNICO.md             ← Arquitectura hexagonal (ES)
    ├── TECHNICAL.md           ← Arquitectura hexagonal (EN)
    └── TROUBLESHOOTING.md     ← Errores comunes
```

---

## 8. Modo Demo Sin LLM (mock local)

Si no tienes credenciales IBM puedes probar el sistema con un mock:

**1.** Crea `backend/app/infrastructure/adapters/mock_llm_adapter.py`:

```python
from app.application.ports.llm_port import LLMPort

class MockLLMAdapter(LLMPort):
    def complete(self, prompt: str, *, max_tokens: int = 1024) -> str:
        if any(w in prompt.lower() for w in ["riesgo", "risk", "summary"]):
            return "Cambio de bajo riesgo. Sin vulnerabilidades críticas detectadas."
        return (
            "import pytest\n\n"
            "def test_placeholder():\n"
            "    assert True\n"
        )

    def chat(self, messages: list[dict[str, str]], *, max_tokens: int = 1024) -> str:
        return self.complete(messages[-1].get("content", ""), max_tokens=max_tokens)
```

**2.** En `backend/app/infrastructure/api/routes.py`, dentro de `_build_orchestrator()`,
sustituye el bloque `BobLLMAdapter(...)` completo por:

```python
from app.infrastructure.adapters.mock_llm_adapter import MockLLMAdapter
llm = MockLLMAdapter()
```

> 🔁 Para volver al modo real: `git checkout backend/app/infrastructure/api/routes.py`

---

## 9. Comandos de Referencia Rápida

```powershell
# ── Backend ────────────────────────────────────────────────────────
cd backend
.venv\Scripts\activate                          # activar entorno

uvicorn main:app --env-file .env --reload `
  --host 0.0.0.0 --port 8000                   # arrancar servidor

pytest tests/ -v                                # correr todos los tests
pytest tests/ -v --cov=app/auth `
  --cov=app/payments --cov=app/api `
  --cov-report=term-missing                     # tests + cobertura módulos demo

ruff check app tests                            # lint
mypy app --ignore-missing-imports               # tipos

curl http://localhost:8000/api/v1/health        # health check
curl http://localhost:8000/api/v1/sessions      # ver sesiones guardadas

# ── Frontend ───────────────────────────────────────────────────────
cd frontend
npm install && npm run dev                      # desarrollo
npm run build                                   # build producción

# ── Pipeline via curl ──────────────────────────────────────────────
curl -X POST http://localhost:8000/api/v1/run `
  -H "Content-Type: application/json" `
  -d '{"base":"main","head":"feature/mi-rama","repo_path":"..","use_github":false}'
```

---

## 10. Puertos por Defecto

| Servicio | URL | Descripción |
|----------|-----|-------------|
| Backend API | http://localhost:8000 | FastAPI REST + SSE |
| Health check | http://localhost:8000/api/v1/health | `{"status":"ok"}` |
| Swagger UI | http://localhost:8000/docs | Documentación interactiva |
| Frontend | http://localhost:5173 | Dashboard React |

---

## 11. Referencia de la API

### `POST /api/v1/run`

```json
{
  "base":       "main",
  "head":       "feature/mi-rama",
  "repo_path":  "..",
  "use_github": false
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `base` | `string` | Rama o SHA de referencia (default `"main"`) |
| `head` | `string` | Rama, SHA o ref a analizar |
| `repo_path` | `string` | Ruta al repo Git, relativa a `backend/` |
| `use_github` | `bool` | `true` para usar GitHub API en lugar de git local |

**Respuesta** `200 OK`:

```json
{
  "session_id":       "uuid",
  "diff_sha":         "abc1234",
  "files_changed":    2,
  "modules_impacted": 2,
  "impacted_modules": [
    {"path": "app/auth/jwt_handler.py", "severity": "critical", "reason": "..."}
  ],
  "tests_generated":  2,
  "tests_healed":     1,
  "passed":           10,
  "failed":           0,
  "coverage_percent": 84.5,
  "analysis_summary": "...",
  "bobcoins_saved":   57.1
}
```

### `GET /api/v1/events`

Stream SSE. Conéctate **antes** de llamar a `/run` para recibir eventos en tiempo real.
El frontend lo hace automáticamente.

```bash
curl -N http://localhost:8000/api/v1/events
```

### `GET /api/v1/sessions`

Devuelve el histórico de `bob_sessions/session_logs.json`.

---

## 12. Problemas Frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `500 Missing env var: 'IBM_API_KEY'` | `.env` no cargado | Arranca con `--env-file .env` |
| `403 no_associated_service_instance_error` | WML no asociado al proyecto | Manage → Services & integrations → Associate service |
| `404 model_not_supported` | Modelo deprecado | Usa `meta-llama/llama-3-3-70b-instruct` en `.env` |
| `ambiguous argument 'main...feature/...'` | La rama del campo **Head** no existe localmente | Usa los presets demo o crea la rama con `git checkout -b` |
| `ModuleNotFoundError: No module named 'app'` | Uvicorn ejecutado fuera de `backend/` | `cd backend` antes de `uvicorn ...` |
| `0% coverage` | pytest mide todo el codebase | El runner ya limita a `app/auth`, `app/payments`, `app/api` |
| Frontend sin eventos SSE | Backend caído o proxy mal | `curl http://localhost:8000/api/v1/health` |
| Tests generados con `SyntaxError: invalid syntax` | LLM dejó fences ` ``` ` en el código | Ya corregido en `clean_llm_code_output` — reinicia el backend |

---

## ¿Más Problemas?

Consulta [`doc/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) para soluciones detalladas.
