# 🧪 Probar TEST-ARCHON con una Rama Real

Guía paso a paso para lanzar el pipeline QA sobre **código real tuyo**, no sobre los presets demo.

---

## Antes de empezar

Asegúrate de que ya tienes el backend y el frontend corriendo:

```powershell
# Terminal 1 — backend
cd backend
.venv\Scripts\activate
uvicorn main:app --env-file .env --reload --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Verifica que todo está bien:

```powershell
curl http://localhost:8000/api/v1/health
# {"status":"ok","service":"TEST-ARCHON"}
```

---

## Opción A — Cambio mínimo en 2 minutos

La forma más rápida de tener una rama real lista:

```powershell
# 1. Crear la rama desde main
git checkout -b feature/mi-prueba main

# 2. Añadir una función nueva a un módulo existente
Add-Content backend\app\auth\jwt_handler.py "`n`ndef ping() -> str:`n    `"Comprobación de disponibilidad del módulo auth.`"`n    return 'pong'`n"

# 3. Commitear
git add -A
git commit -m "feat: añadir ping() al módulo auth"
```

Ahora lanza el pipeline desde el dashboard:

| Campo | Valor |
|-------|-------|
| Base branch | `main` |
| Head branch / SHA | `feature/mi-prueba` |
| Repo path | `..` |

Haz clic en **▶ Run QA Pipeline** y observa el terminal de agentes.

---

## Opción B — Tres escenarios completos

Cada escenario activa un agente diferente y produce resultados distintos en el dashboard.

---

### Escenario 1 — Auth Refactor (ImpactAgent · severidad CRITICAL)

El **ImpactAgent** detecta cualquier cambio en rutas que contengan `auth`, `security`, `token` o `password` y asigna severidad CRITICAL automáticamente.

```powershell
# Crear rama
git checkout -b feature/auth-hardening main

# Editar el módulo de autenticación existente
$content = @"

def revoke_token(token_id: str) -> bool:
    """Añade el token a la blacklist de revocación."""
    _REVOKED_TOKENS.add(token_id)
    return True

def is_revoked(token_id: str) -> bool:
    """Comprueba si un token ha sido revocado."""
    return token_id in _REVOKED_TOKENS

_REVOKED_TOKENS: set[str] = set()
"@
Add-Content backend\app\auth\jwt_handler.py $content

# Commitear
git add -A
git commit -m "security: añadir revocación de tokens JWT"
```

**En el dashboard:**

| Campo | Valor |
|-------|-------|
| Base branch | `main` |
| Head branch / SHA | `feature/auth-hardening` |
| Repo path | `..` |

**Qué verás:**
- ImpactAgent → `app/auth/jwt_handler.py` clasificado como **CRITICAL**
- GeneratorAgent → genera tests para `revoke_token` e `is_revoked`
- Coverage sube desde ~88% hasta ~95%+
- Badge **QA APPROVED** si todos los tests pasan

---

### Escenario 2 — Módulo Nuevo sin Tests (GeneratorAgent)

El **GeneratorAgent** detecta módulos que no tienen un archivo `test_<módulo>.py` correspondiente y genera la suite completa desde cero.

```powershell
# Crear rama
git checkout -b feature/notifications main

# Crear un módulo Python nuevo sin ningún test
New-Item -ItemType Directory -Force backend\app\notifications | Out-Null

Set-Content backend\app\notifications\__init__.py ""

Set-Content backend\app\notifications\sender.py @"
"""
app/notifications/sender.py
Módulo de envío de notificaciones — añadido en feature/notifications.
"""
from __future__ import annotations


class NotificationError(Exception):
    """Raised when a notification cannot be sent."""


def send_email(to: str, subject: str, body: str) -> bool:
    """Envía un email. Lanza NotificationError si el destinatario es inválido."""
    if not to or "@" not in to:
        raise NotificationError(f"Email inválido: {to!r}")
    if not subject:
        raise NotificationError("El asunto no puede estar vacío")
    print(f"[EMAIL] -> {to} | {subject} | {len(body)} chars")
    return True


def send_sms(phone: str, message: str) -> bool:
    """Envía un SMS. El teléfono debe incluir prefijo internacional (+XX)."""
    if not phone.startswith("+"):
        raise NotificationError("El teléfono debe incluir prefijo internacional (+XX)")
    if len(message) > 160:
        raise NotificationError(f"SMS demasiado largo: {len(message)} chars (máx 160)")
    print(f"[SMS] -> {phone} | {message[:30]}...")
    return True


def send_push(device_id: str, title: str, payload: dict | None = None) -> bool:
    """Envía una push notification a un dispositivo."""
    if not device_id:
        raise NotificationError("device_id es obligatorio")
    print(f"[PUSH] -> {device_id} | {title}")
    return True
"@

# Commitear
git add -A
git commit -m "feat: añadir módulo de notificaciones (email, SMS, push)"
```

**En el dashboard:**

| Campo | Valor |
|-------|-------|
| Base branch | `main` |
| Head branch / SHA | `feature/notifications` |
| Repo path | `..` |

**Qué verás:**
- ImpactAgent → `app/notifications/sender.py` clasificado como **MEDIUM** (nuevo módulo)
- GeneratorAgent → detecta que no existe `test_sender` → genera 1 suite completa con pytest
- Los tests generados cubren `send_email`, `send_sms` y `send_push`
- Bobcoins Saved: ~57% (4 pasos locales, 2 llamadas LLM)

---

### Escenario 3 — Cambio Rompedor de API (HealingAgent)

El **HealingAgent** se activa cuando los tests generados (o los existentes) fallan tras un cambio de firma. Reescribe los tests automáticamente para adaptarlos a la nueva API.

```powershell
# Crear rama
git checkout -b feature/api-breaking main

# Cambiar la firma de get_user: añadir parámetro obligatorio
(Get-Content backend\app\api\v2\endpoints.py) `
  -replace 'def get_user\(user_id: str\):', `
           'def get_user(user_id: str, fields: list[str] | None = None):' `
| Set-Content backend\app\api\v2\endpoints.py

# Añadir lógica que use el nuevo parámetro
$patch = @"

    # Filtrar campos si se especifica
    result = user.to_dict()
    if fields:
        result = {k: v for k, v in result.items() if k in fields}
"@

# Commitear
git add -A
git commit -m "feat: get_user ahora acepta filtro de campos 'fields'"
```

**En el dashboard:**

| Campo | Valor |
|-------|-------|
| Base branch | `main` |
| Head branch / SHA | `feature/api-breaking` |
| Repo path | `..` |

**Qué verás:**
- ImpactAgent → `app/api/v2/endpoints.py` clasificado como **HIGH**
- GeneratorAgent → genera nuevos tests para `get_user` con `fields`
- Si algún test falla → HealingAgent entra, reescribe y vuelve a ejecutar
- Diff de auto-reparación visible en el panel derecho

---

## Opción C — Usar un SHA de commit existente

No necesitas crear una rama nueva. Puedes apuntar a cualquier commit ya existente:

```powershell
# Ver los commits disponibles
git log --oneline

# Ejemplo de salida:
# 4b22e5c docs: add local startup guides
# af1fcc2 feat: initial full scaffold

# Lanzar el pipeline con un SHA específico
curl -X POST http://localhost:8000/api/v1/run `
  -H "Content-Type: application/json" `
  -d '{"base":"af1fcc2","head":"4b22e5c","repo_path":"..","use_github":false}'
```

Esto analiza los cambios introducidos **entre** `af1fcc2` y `4b22e5c`.

---

## Limpiar las ramas de prueba

Cuando termines:

```powershell
# Volver a main
git checkout main

# Borrar las ramas creadas
git branch -D feature/mi-prueba
git branch -D feature/auth-hardening
git branch -D feature/notifications
git branch -D feature/api-breaking
```

Los tests generados durante el pipeline quedan en `backend/tests/test_*_generated.py`.
Bórralos si no los quieres en el repo:

```powershell
Remove-Item backend\tests\*_generated.py -ErrorAction SilentlyContinue
```

---

## Referencia rápida

```powershell
# Ver ramas disponibles
git branch -a

# Ver diferencia entre dos ramas antes de lanzar el pipeline
git diff main...feature/mi-prueba --stat

# Lanzar el pipeline desde la terminal (sin abrir el dashboard)
curl -X POST http://localhost:8000/api/v1/run `
  -H "Content-Type: application/json" `
  -d '{
    "base":       "main",
    "head":       "feature/mi-prueba",
    "repo_path":  "..",
    "use_github": false
  }'

# Ver el log de la última sesión
Get-Content bob_sessions\session_logs.json | ConvertFrom-Json | Select-Object -ExpandProperty sessions | Select-Object -Last 5
```

---

## Qué pasa internamente

```
git diff main...feature/mi-prueba
        │
        ▼
  LocalGitAdapter            ← lee el diff real del repo
        │
        ▼
  ImpactAgent  ──LLM──▶  clasifica severidad + resumen de riesgo
        │
        ▼
  GeneratorAgent ──LLM──▶  genera tests para los módulos sin cobertura
        │
        ▼
  pytest  (subprocess)      ← ejecuta los tests generados
        │
    ┌───┴───────┐
  pasan       fallan
    │            │
    ▼            ▼
  summary    HealingAgent ──LLM──▶  reescribe los tests rotos
                 │
                 ▼
              pytest (segunda pasada)
                 │
                 ▼
              summary final + Bobcoins Saved
```

Todos los eventos se emiten como SSE en tiempo real y aparecen en el terminal del dashboard.
