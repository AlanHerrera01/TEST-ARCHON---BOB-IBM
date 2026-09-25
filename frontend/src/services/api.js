/**
 * API service layer — all backend communication lives here.
 * Uses the Fetch API and the native EventSource for SSE.
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
 * Subscribe to the SSE event stream.
 * @param {(event: object) => void} onEvent  Called for each parsed event.
 * @returns {() => void}  Call to close the stream.
 */
export function subscribeToEvents(onEvent) {
  const source = new EventSource(`${BASE_URL}/events`)

  source.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data)
      onEvent(data)
    } catch {
      // ignore malformed frames
    }
  }

  source.onerror = () => source.close()

  return () => source.close()
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
