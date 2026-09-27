# 🎬 Demo 5 min — Escenario 2: Módulo Nuevo sin Tests

---

## Introducción

En equipos de desarrollo es habitual que se mergee código nuevo sin tests asociados.
El desarrollador entrega la feature, el PR pasa revisión de lógica, pero nadie escribió
la suite de pruebas — y la cobertura cae silenciosamente.

**TEST-ARCHON** resuelve exactamente ese problema de forma autónoma:

1. Lee el diff del commit entrante con `LocalGitAdapter`
2. El **ImpactAgent** clasifica cada archivo modificado por nivel de riesgo
3. El **GeneratorAgent** detecta que no existe `test_sender.py` y genera la suite completa usando IA
4. El **TestRunnerAdapter** ejecuta pytest en un subprocess aislado
5. El **Orchestrator** consolida cobertura, calcula Bobcoins Saved y emite el veredicto

Todo el proceso tarda menos de 30 segundos y es visible en tiempo real en el dashboard.
El desarrollador no escribe ni un solo test — TEST-ARCHON lo hace por él.

> **Historia en una frase:** se mergea código nuevo sin ningún test →
> TEST-ARCHON detecta el gap, genera la suite con IA y aprueba el PR solo.

---

## ⏱ Guión cronometrado

| Tiempo | En cámara |
|--------|-----------|
| 0:00 – 0:45 | Mostrar el código sin tests |
| 0:45 – 1:15 | Lanzar el pipeline (1 click) |
| 1:15 – 3:00 | Terminal de agentes en vivo |
| 3:00 – 4:00 | Abrir el test generado |
| 4:00 – 5:00 | Métricas del dashboard + cierre |

---

## 0:00 – 0:45 · Mostrar el código sin tests

Abre [`backend/app/notifications/sender.py`](../backend/app/notifications/sender.py) en el editor y di:

> "Este módulo acaba de mergearse. Tiene tres funciones —  
> `send_email`, `send_sms`, `send_push` — con validaciones y excepciones.  
> Pero **no existe ningún test** para él."

Confirma el gap en la terminal:

```powershell
Get-ChildItem backend\tests\test_*
# test_sender no aparece — el gap es real
```

---

## 0:45 – 1:15 · Lanzar el pipeline

1. Abre **http://localhost:5173**
2. Rellena el formulario:

| Campo | Valor |
|-------|-------|
| Base branch | `main` |
| Head branch | `feature/notifications` |
| Repo path | `..` |

3. Clic en **▶ Run QA Pipeline**

> "Un solo click. Sin configurar nada más."

---

## 1:15 – 3:00 · Terminal de agentes en vivo

Comenta cada línea que aparece en el AgentTerminal del dashboard:

```
[ImpactAgent]    app/notifications/sender.py → MEDIUM  (módulo nuevo, no toca auth)
[GeneratorAgent] test_sender.py no encontrado — generando suite...
[GeneratorAgent] ✓ test_sender_generated.py creado  (8 casos de prueba)
[TestRunner]     pytest ... 8 passed in 0.3s
[Orchestrator]   Bobcoins Saved: 78%  |  ✅ QA APPROVED
```

Frases clave:

> "El ImpactAgent leyó el diff y clasificó el riesgo."  
> "El GeneratorAgent buscó el test — no lo encontró — y lo generó solo."  
> "pytest corrió en un subprocess aislado. Todo verde."

---

## 3:00 – 4:00 · Abrir el test generado

```powershell
Get-Content backend\tests\test_sender_generated.py
```

Señala en pantalla los 8 casos que la IA escribió:

```
test_send_email_success            ← camino feliz
test_send_email_invalid_address    ← sin @ → NotificationError
test_send_email_empty_subject      ← asunto vacío → NotificationError
test_send_sms_success              ← prefijo + correcto
test_send_sms_missing_prefix       ← sin + → NotificationError
test_send_sms_too_long             ← >160 chars → NotificationError
test_send_push_success             ← device_id válido
test_send_push_empty_device_id     ← vacío → NotificationError
```

> "Tests reales de pytest. No mocks internos. Los puedes editar y hacer commit."

---

## 4:00 – 5:00 · Métricas + cierre

Señala en el dashboard:

- **Coverage card** — barra subiendo (antes sin `sender.py`, ahora cubierto)
- **Impact graph** — nodo `sender.py` en color **MEDIUM**
- **Bobcoins Saved: 78%** — 7 de 9 pasos fueron locales, sin llamar al LLM
- **Badge ✅ QA APPROVED**

**Frase de cierre:**

> "Con un solo commit de código sin tests, TEST-ARCHON  
> identificó el gap, generó la suite, la ejecutó y aprobó el PR —  
> sin escribir una sola línea de test."

---

## Preparación (fuera de cámara, una sola vez)

```powershell
# 1. Arrancar el backend
cd backend; .venv\Scripts\activate
uvicorn main:app --env-file .env --reload --host 0.0.0.0 --port 8000

# 2. Arrancar el frontend (otra terminal)
cd frontend; npm run dev

# 3. Crear la rama del escenario
git checkout main
git checkout -b feature/notifications
git add backend/app/notifications/
git commit -m "feat: añadir módulo de notificaciones (email, SMS, push)"
git checkout main   # vuelve a main — el módulo no existe visualmente en el árbol
```

Verifica el diff antes de grabar:

```powershell
git diff main...feature/notifications --stat
#  backend/app/notifications/__init__.py |  0
#  backend/app/notifications/sender.py  | 55 +++++++++++++++++++
#  2 files changed, 55 insertions(+)
```

---

## Limpieza después de grabar

```powershell
git checkout main
git branch -D feature/notifications
Remove-Item backend\tests\test_sender_generated.py -ErrorAction SilentlyContinue
```
