/**
 * API service layer — all backend communication lives here.
 * Uses fetch for the pipeline call.
 * SSE is simulated client-side on Vercel (serverless doesn't support persistent streams).
 */

const BASE_URL = '/api/v1'

/**
 * Trigger the full QA pipeline.
 * @param {{ base: string, head: string, repo_path: string }} params
 * @returns {Promise<object>} Pipeline summary from the backend.
 */
export async function runPipeline(params) {
  const res = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Subscribe to agent events.
 * Tries native SSE first; if the stream errors immediately (Vercel serverless),
 * falls back to simulated progress events so the terminal shows activity.
 *
 * @param {(event: object) => void} onEvent  Called for each parsed event.
 * @returns {() => void}  Call to close/cancel.
 */
export function subscribeToEvents(onEvent) {
  let closed = false
  let source = null
  let simulationTimer = null

  // Simulated event sequence shown while waiting for the POST /run response
  const SIMULATED_STEPS = [
    { agent: 'Orchestrator',   event_type: 'started',   payload: { step: 'diff' } },
    { agent: 'Orchestrator',   event_type: 'progress',  payload: { step: 'diff', files_changed: '…' } },
    { agent: 'ImpactAgent',    event_type: 'started',   payload: { diff_sha: '…' } },
    { agent: 'ImpactAgent',    event_type: 'progress',  payload: { status: 'Analysing impacted modules…' } },
    { agent: 'GeneratorAgent', event_type: 'started',   payload: { status: 'Detecting coverage gaps…' } },
    { agent: 'GeneratorAgent', event_type: 'progress',  payload: { status: 'Generating test stubs with LLM…' } },
    { agent: 'Orchestrator',   event_type: 'progress',  payload: { step: 'test_run', status: 'Running test suite…' } },
    { agent: 'HealingAgent',   event_type: 'started',   payload: { status: 'Checking for failures…' } },
  ]

  function startSimulation() {
    let i = 0
    function fire() {
      if (closed || i >= SIMULATED_STEPS.length) return
      onEvent({ ...SIMULATED_STEPS[i], simulated: true })
      i++
      simulationTimer = setTimeout(fire, 900)
    }
    simulationTimer = setTimeout(fire, 400)
  }

  function stopSimulation() {
    if (simulationTimer) {
      clearTimeout(simulationTimer)
      simulationTimer = null
    }
  }

  // Try real SSE — give it 2 s to produce at least one message
  let sseWorking = false
  try {
    source = new EventSource(`${BASE_URL}/events`)

    const sseTimeout = setTimeout(() => {
      if (!sseWorking && !closed) {
        // SSE not producing events (Vercel) — fall back to simulation
        source.close()
        source = null
        startSimulation()
      }
    }, 2000)

    source.onmessage = (msg) => {
      sseWorking = true
      clearTimeout(sseTimeout)
      stopSimulation()
      try {
        const data = JSON.parse(msg.data)
        onEvent(data)
      } catch {
        // ignore malformed frames
      }
    }

    source.onerror = () => {
      clearTimeout(sseTimeout)
      if (!sseWorking && !closed) {
        source.close()
        source = null
        startSimulation()
      }
    }
  } catch {
    // EventSource not available — go straight to simulation
    startSimulation()
  }

  return () => {
    closed = true
    stopSimulation()
    source?.close()
  }
}

/**
 * Fetch all stored session logs from bob_sessions/.
 * @returns {Promise<object>}
 */
export async function fetchSessions() {
  const res = await fetch(`${BASE_URL}/sessions`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
