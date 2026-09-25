# 🔧 TEST-ARCHON — Solución de Problemas / Troubleshooting

Soluciones a los errores más comunes al arrancar o usar TEST-ARCHON.

---

## BACKEND

---

### ❌ `"vite" no se reconoce como comando`

**Causa:** `node_modules` no está instalado.

**Solución:**
```bash
cd frontend
npm install
npm run dev
```

---

### ❌ `ModuleNotFoundError: No module named 'fastapi'`

**Causa:** El entorno virtual no está activo o las dependencias no están instaladas.

**Solución:**
```bash
cd backend

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

### ❌ `KeyError: 'IBM_API_KEY'` al llamar a `/api/v1/run`

**Causa:** El archivo `.env` no existe o las variables no están definidas.

**Solución:**
```bash
cd backend
copy .env.example .env   # Windows
cp .env.example .env      # macOS/Linux
```
Abre `.env` y rellena `IBM_API_KEY` e `IBM_PROJECT_ID`.

---

### ❌ `IAM token fetch failed (400)` o `(401)`

**Causa:** La `IBM_API_KEY` es incorrecta o ha expirado.

**Solución:**
1. Ve a **cloud.ibm.com → Manage → Access (IAM) → API Keys**
2. Genera una nueva clave
3. Actualiza `IBM_API_KEY` en tu `.env`

---

### ❌ `LLM API error 404` o `model not found`

**Causa:** El `IBM_MODEL_ID` o `IBM_BASE_URL` son incorrectos para tu región.

**Solución:**
```env
# Región US South (por defecto)
IBM_BASE_URL=https://us-south.ml.cloud.ibm.com
IBM_MODEL_ID=ibm/granite-13b-chat-v2

# Región EU (si tu proyecto está en Europa)
IBM_BASE_URL=https://eu-de.ml.cloud.ibm.com
```

---

### ❌ `pytest did not produce a JSON report`

**Causa:** `pytest-json-report` no está instalado, o el comando pytest falló antes de generar el reporte.

**Solución:**
```bash
pip install pytest-json-report pytest-cov
```

---

### ❌ `pytest timed out after 10s`

**Causa:** Un test generado entra en un bucle infinito o hace una llamada de red bloqueante.

**Solución:** El sistema lo detecta automáticamente y lo trata como fallo. El HealingAgent intentará repararlo. Si persiste, aumenta el timeout al instanciar el adaptador en `routes.py`:

```python
runner = TestRunnerAdapter(timeout=60)
```

---

### ❌ `DiffParseError: git ... failed`

**Causa:** Las refs `base` o `head` no existen en el repositorio local.

**Solución:**
```bash
# Verifica que la rama existe
git branch -a

# Si usas un SHA, verifica que es válido
git log --oneline -5
```

---

### ❌ `SessionLogError: [Errno 2] No such file or directory`

**Causa:** La carpeta `bob_sessions/` no existe.

**Solución:**
```bash
mkdir bob_sessions
echo '{"sessions":[]}' > bob_sessions/session_logs.json
```

---

## FRONTEND

---

### ❌ El dashboard muestra `Waiting for events…` y no avanza

**Causa:** El backend no está corriendo, o hay un problema de proxy.

**Solución:**
1. Verifica que el backend está activo en http://localhost:8000/api/v1/health (debe devolver `{"status":"ok"}`)
2. Verifica que `vite.config.js` tiene el proxy configurado:
```js
proxy: {
  '/api': { target: 'http://localhost:8000', changeOrigin: true }
}
```

---

### ❌ Error de CORS al llamar al backend

**Causa:** Estás accediendo al frontend por una URL diferente a `localhost:5173`.

**Solución:** El proxy de Vite evita CORS en desarrollo. En producción, ajusta `allow_origins` en `backend/main.py`:
```python
allow_origins=["https://tu-dominio.com"]
```

---

### ❌ `✖ HTTP 422` al pulsar Run QA Pipeline

**Causa:** El campo `head` está vacío.

**Solución:** Rellena el campo **Head branch / SHA** antes de ejecutar. Puedes usar cualquier rama válida o el SHA de un commit.

---

### ❌ La pestaña **Sessions** muestra `Error: HTTP 404`

**Causa:** El backend está corriendo pero el endpoint `/api/v1/sessions` no responde.

**Solución:** Reinicia el backend. Si el error persiste, verifica que `bob_sessions/session_logs.json` existe:
```bash
ls bob_sessions/
```

---

## TESTS

---

### ❌ Los tests tardan más de 30 segundos

**Causa:** Algún test está esperando un timeout de red (no debería ocurrir — todos usan mocks).

**Solución:**
```bash
pytest tests/ -v --timeout=10
```

---

### ❌ `PytestCollectionWarning: cannot collect test class 'TestResult'`

**Causa:** pytest confunde las dataclasses de dominio con clases de test. Es una advertencia **inofensiva** que no afecta la ejecución.

**Para suprimirla** (opcional), añade a `backend/pytest.ini`:
```ini
[pytest]
filterwarnings = ignore::pytest.PytestCollectionWarning
```

---

## GENERAL

---

### ❌ `git push` falla con `403 Permission denied`

**Causa:** Las credenciales de Git almacenadas no corresponden al dueño del repositorio.

**Solución:**
```bash
# Actualizar la URL del remote con tu usuario
git remote set-url origin https://TU-USUARIO@github.com/JCA-Solution/TEST-ARCHON---BOB-IBM.git
git push -u origin main
```
Cuando pida contraseña, usa un **Personal Access Token** (no la contraseña de GitHub).  
Genera uno en: **github.com → Settings → Developer Settings → Personal Access Tokens → Classic → repo scope**.

---

### ❌ `python` no se reconoce en Windows

**Causa:** Python no está en el PATH.

**Solución:**
1. Descarga Python 3.11+ desde [python.org](https://www.python.org/downloads/)
2. En el instalador, marca **"Add Python to PATH"**
3. Reinicia la terminal

---

### ❌ `node` o `npm` no se reconocen

**Causa:** Node.js no está instalado o no está en el PATH.

**Solución:**
1. Descarga Node.js LTS desde [nodejs.org](https://nodejs.org)
2. Instala con las opciones por defecto (incluye npm automáticamente)
3. Reinicia la terminal y verifica: `node --version`

---

## Obtener Ayuda

Si el problema persiste:
1. Revisa los logs del backend en la terminal donde corre uvicorn
2. Abre las DevTools del navegador (F12) → pestaña **Network** → busca la petición fallida
3. Consulta la documentación completa en [`doc/TECNICO.md`](TECNICO.md) o [`doc/TECHNICAL.md`](TECHNICAL.md)
