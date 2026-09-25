import { useState, useCallback } from 'react'
import Header from './components/Header.jsx'
import CoverageCard from './components/CoverageCard.jsx'
import ImpactGraph from './components/ImpactGraph.jsx'
import AgentTerminal from './components/AgentTerminal.jsx'
import HealDiffCard from './components/HealDiffCard.jsx'
import { runPipeline, subscribeToEvents } from './services/api.js'

// ---------------------------------------------------------------------------
// Demo presets — load a scenario with 1 click
// ---------------------------------------------------------------------------
const PRESETS = [
  {
    label: '🔐 Auth Refactor',
    description: 'Simula cambio en módulo de autenticación (severidad CRITICAL)',
    payload: { base: 'main', head: 'feature/auth-refactor', repo_path: '.' },
  },
  {
    label: '🧪 Coverage Gap',
    description: 'Módulos sin tests detectados → GeneratorAgent activa',
    payload: { base: 'main', head: 'feature/new-payment-service', repo_path: '.' },
  },
  {
    label: '🩹 Self-Healing',
    description: 'Tests fallan tras cambio de API → HealingAgent repara',
    payload: { base: 'main', head: 'feature/api-breaking-change', repo_path: '.' },
  },
]

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [form, setForm] = useState({ base: 'main', head: '', repoPath: '.' })
  const [summary, setSummary] = useState(null)
  const [prevCoverage, setPrevCoverage] = useState(null)  // coverage before last run
  const [events, setEvents] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  // SSE events from the HealingAgent that carry diff payloads
  const healEvents = events.filter(
    (e) => e.agent === 'HealingAgent' && e.event_type === 'completed' && e.payload?.diff
  )

  const executeRun = useCallback(async (params) => {
    // Snapshot the current coverage before we wipe the summary
    setPrevCoverage(summary?.coverage_percent ?? null)
    setRunning(true)
    setError(null)
    setEvents([])
    setSummary(null)

    const closeStream = subscribeToEvents((evt) =>
      setEvents((prev) => [...prev, evt])
    )

    try {
      const result = await runPipeline(params)
      setSummary(result)
    } catch (err) {
      setError(err.message)
    } finally {
      closeStream()
      setRunning(false)
    }
  }, [])

  const handleRun = useCallback(
    () => executeRun({ base: form.base, head: form.head, repo_path: form.repoPath }),
    [form, executeRun]
  )

  const handlePreset = useCallback(
    (preset) => {
      setForm({ base: preset.payload.base, head: preset.payload.head, repoPath: preset.payload.repo_path })
      executeRun(preset.payload)
    },
    [executeRun]
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* ── Demo Presets ─────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-5">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Demo rápida</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              disabled={running}
              title={p.description}
              onClick={() => handlePreset(p)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 rounded text-xs font-medium transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Manual Controls ──────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Base branch
            <input
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              value={form.base}
              onChange={(e) => setForm({ ...form, base: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Head branch / SHA
            <input
              placeholder="feature/my-branch"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              value={form.head}
              onChange={(e) => setForm({ ...form, head: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Repo path
            <input
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              value={form.repoPath}
              onChange={(e) => setForm({ ...form, repoPath: e.target.value })}
            />
          </label>
          <button
            disabled={!form.head || running}
            onClick={handleRun}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-sm font-semibold transition-colors"
          >
            {running ? 'Running…' : '▶ Run QA Pipeline'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded px-3 py-2">
            ✖ {error}
          </p>
        )}
      </section>

      {/* ── Dashboard ────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        {summary && (
          <>
            <CoverageCard
              coverage={summary.coverage_percent}
              prevCoverage={prevCoverage}
              passed={summary.passed}
              failed={summary.failed}
              generated={summary.tests_generated}
              healed={summary.tests_healed}
              bobcoinsSaved={summary.bobcoins_saved}
            />
            <ImpactGraph summary={summary} />
          </>
        )}

        {/* Heal diff card — only visible when HealingAgent emits diff events */}
        <HealDiffCard healEvents={healEvents} />

        <div className="md:col-span-2">
          <AgentTerminal events={events} running={running} />
        </div>
      </main>
    </div>
  )
}
