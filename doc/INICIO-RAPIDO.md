# 🚀 TEST-ARCHON — Guía de Inicio Rápido

> Cómo tener el proyecto corriendo en tu máquina en menos de 10 minutos.

---

## Requisitos Previos

Antes de empezar, asegúrate de tener instalado:

| Herramienta | Versión mínima | Verificar |
|-------------|----------------|-----------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | cualquier | `git --version` |

También necesitarás credenciales de **IBM Cloud / watsonx.ai**:
- `IBM_API_KEY` — clave de API de IBM Cloud
- `IBM_PROJECT_ID` — ID del proyecto en watsonx.ai

Si no las tienes, el backend arranca igualmente pero el pipeline fallará al llamar al LLM. Para demo local puedes usar un mock (ver sección [Modo Demo Sin LLM](#modo-demo-sin-llm)).

---

## 1. Clonar el Repositorio

```bash
git clone https://github.com/JCA-Solution/TEST-ARCHON---BOB-IBM.git
cd TEST-ARCHON---BOB-IBM
```

---

## 2. Configurar el Backend

### 2.1 Crear entorno virtual

```bash
cd backend

# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

Sabrás que el entorno está activo cuando el prompt muestre `(.venv)`.

### 2.2 Instalar dependencias

```bash
pip install -r requirements.txt
```

### 2.3 Configurar variables de entorno

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Abre el archivo `.env` con cualquier editor y rellena los valores:

```env
IBM_API_KEY=tu_clave_aqui
IBM_PROJECT_ID=tu_proyecto_aqui
IBM_MODEL_ID=ibm/granite-13b-chat-v2
IBM_BASE_URL=https://us-south.ml.cloud.ibm.com
```

> ⚠️ **Nunca** subas el archivo `.env` a Git. Ya está en `.gitignore`.

### 2.4 Arrancar el servidor

```bash
# Desde la carpeta backend/
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Deberías ver:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

✅ El backend está listo en: **http://localhost:8000**  
📖 Documentación interactiva (Swagger): **http://localhost:8000/docs**

---

## 3. Configurar el Frontend

Abre **otra terminal** (deja el backend corriendo).

```bash
# Desde la raíz del proyecto
cd frontend

npm install
npm run dev
```

Deberías ver:

```
  VITE v5.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

✅ El dashboard está listo en: **http://localhost:5173**

---

## 4. Ejecutar el Pipeline (Primera Demo)

Con backend y frontend corriendo:

1. Abre **http://localhost:5173** en tu navegador.
2. Haz clic en uno de los botones de **Demo rápida** en la parte superior:
   - 🔐 **Auth Refactor** — simula cambios en autenticación
   - 🧪 **Coverage Gap** — detecta módulos sin tests
   - 🩹 **Self-Healing** — repara tests fallidos
3. O rellena manualmente:
   - **Base branch**: `main`
   - **Head branch / SHA**: nombre de tu rama o SHA de commit
   - **Repo path**: `.` (el directorio actual)
4. Pulsa **▶ Run QA Pipeline**

El terminal de agentes mostrará los eventos en tiempo real. Al finalizar aparecerá:
- Anillo de cobertura con porcentaje
- Badge **QA APPROVED** si cobertura ≥ 80% y 0 fallos
- Comparativo Before/After de cobertura
- Indicador de Bobcoins Ahorrados

---

## 5. Ejecutar los Tests del Proyecto

```bash
# Desde la carpeta backend/ con el entorno virtual activo
pytest tests/ -v --cov=app --cov-report=term-missing
```

Resultado esperado: **45 tests pasando**.

---

## 6. Estructura de Carpetas Clave

```
TEST-ARCHON---BOB-IBM/
│
├── backend/                ← Motor Python (FastAPI + Agentes)
│   ├── .env.example        ← Copia a .env y rellena tus credenciales
│   ├── main.py             ← Punto de entrada: uvicorn main:app
│   ├── requirements.txt    ← Dependencias Python
│   └── app/
│       ├── domain/         ← Modelos puros (sin frameworks)
│       ├── application/    ← Agentes + Orquestador + Puertos
│       └── infrastructure/ ← Adaptadores + API FastAPI
│
├── frontend/               ← Dashboard React
│   ├── package.json        ← Dependencias Node
│   └── src/
│       ├── App.jsx         ← Componente raíz
│       ├── components/     ← CoverageCard, ImpactGraph, AgentTerminal...
│       └── services/api.js ← Comunicación con el backend
│
├── bob_sessions/           ← 📋 Log de trazabilidad (Hackathon IBM)
│   └── session_logs.json
│
└── doc/                    ← Documentación
    ├── INICIO-RAPIDO.md    ← Este archivo
    ├── QUICKSTART.md       ← Versión en inglés
    ├── TECNICO.md          ← Arquitectura detallada (ES)
    └── TECHNICAL.md        ← Arquitectura detallada (EN)
```

---

## 7. Modo Demo Sin LLM

Si no tienes credenciales de IBM, puedes probar el sistema con un mock del LLM.

Crea el archivo `backend/app/infrastructure/adapters/mock_llm_adapter.py`:

```python
from app.application.ports.llm_port import LLMPort

class MockLLMAdapter(LLMPort):
    """Devuelve respuestas fijas para demo local sin credenciales IBM."""

    def complete(self, prompt: str, *, max_tokens: int = 1024) -> str:
        if "risk summary" in prompt.lower() or "risk" in prompt.lower():
            return "Este cambio modifica módulos de bajo riesgo. No se identifican vulnerabilidades críticas."
        return (
            "import pytest\n\n"
            "def test_placeholder():\n"
            "    \"\"\"Test generado en modo demo.\"\"\"\n"
            "    assert True\n"
        )

    def chat(self, messages, *, max_tokens: int = 1024) -> str:
        return self.complete(messages[-1].get("content", ""), max_tokens=max_tokens)
```

Luego en `backend/app/infrastructure/api/routes.py`, cambia temporalmente en `_build_orchestrator()`:

```python
# Reemplaza BobLLMAdapter por MockLLMAdapter para demo local
from app.infrastructure.adapters.mock_llm_adapter import MockLLMAdapter
llm = MockLLMAdapter()
```

---

## 8. Comandos de Referencia Rápida

```bash
# Backend — arrancar
cd backend && .venv\Scripts\activate && uvicorn main:app --reload --port 8000

# Backend — tests
cd backend && pytest tests/ -v

# Frontend — arrancar
cd frontend && npm run dev

# Frontend — build producción
cd frontend && npm run build

# Ver logs de sesiones
cat bob_sessions/session_logs.json
```

---

## 9. Puertos por Defecto

| Servicio | URL | Descripción |
|----------|-----|-------------|
| Backend API | http://localhost:8000 | FastAPI REST + SSE |
| Swagger UI | http://localhost:8000/docs | Documentación interactiva |
| Frontend | http://localhost:5173 | Dashboard React |

---

## ¿Problemas?

Consulta [`doc/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) para soluciones a los errores más comunes.
