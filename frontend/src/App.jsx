import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Header from './components/Header.jsx'
import CoverageCard from './components/CoverageCard.jsx'
import ImpactGraph from './components/ImpactGraph.jsx'
import AgentTerminal from './components/AgentTerminal.jsx'
import HealDiffCard from './components/HealDiffCard.jsx'
import { CrossIcon, RadarIcon, LayersIcon, AlertIcon } from './components/Icons.jsx'
import { runPipeline, subscribeToEvents } from './services/api.js'
import { severityTheme } from './lib/design.js'

// ---------------------------------------------------------------------------
// Demo presets — one-click scenarios for the hackathon judges
// ---------------------------------------------------------------------------
const PRESETS = [
  {
    id: 'auth',
    label: 'Auth Refactor',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11" r="1" fill="currentColor" />
      </svg>
    ),
    description: 'Simula cambio en módulo de autenticación (severidad CRITICAL)',
    accentColor: '#f87171',
    glowColor: 'rgba(248,113,113,0.35)',
    payload: { base: 'main', head: 'feature/auth-refactor', repo_path: '.' },
  },
  {
    id: 'coverage',
    label: 'Coverage Gap',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    description: 'Módulos sin tests detectados → GeneratorAgent activa',
    accentColor: '#22d3ee',
    glowColor: 'rgba(34,211,238,0.35)',
    payload: { base: 'main', head: 'feature/new-payment-service', repo_path: '.' },
  },
  {
    id: 'healing',
    label: 'Self-Healing',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2v4M8 10v4M2 8h4M10 8h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="8" r="2.5" fill="currentColor" opacity="0.7" />
      </svg>
    ),
    description: 'Tests fallan tras cambio de API → HealingAgent repara',
    accentColor: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.35)',
    payload: { base: 'main', head: 'feature/api-breaking-change', repo_path: '.' },
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2a5 5 0 00-5 5v2.5L2 11h12l-1-1.5V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    description: 'Módulo nuevo sin tests → GeneratorAgent genera suite completa (Escenario B)',
    accentColor: '#34d399',
    glowColor: 'rgba(52,211,153,0.35)',
    payload: { base: 'main', head: 'feature/notifications', repo_path: '.' },
  },
]

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [form, setForm] = useState({ base: 'main', head: '', repoPath: '.' })
  const [summary, setSummary] = useState(null)
  const [prevCoverage, setPrevCoverage] = useState(null)
  const [events, setEvents] = useState([])
  const [running, setRunning] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const [activePreset, setActivePreset] = useState(null)
  const sseRef = useRef(null)

  useEffect(
    () => () => {
      sseRef.current?.()
    },
    [],
  )

  const executeRun = useCallback(
    async (params) => {
      setPrevCoverage(summary?.coverage_percent ?? null)
      setRunning(true)
      setError(null)
      setEvents([])
      setSummary(null)
      setConnected(true)

      const close = subscribeToEvents((evt) => setEvents((prev) => [...prev, evt]))
      sseRef.current = close

      try {
        setSummary(await runPipeline(params))
      } catch (err) {
        setError(err.message)
      } finally {
        close()
        sseRef.current = null
        setConnected(false)
        setRunning(false)
      }
    },
    [summary],
  )

  const handleRun = useCallback(
    () => executeRun({ base: form.base, head: form.head, repo_path: form.repoPath }),
    [form, executeRun],
  )

  const handlePreset = useCallback(
    (preset) => {
      setActivePreset(preset.id)
      setForm({
        base: preset.payload.base,
        head: preset.payload.head,
        repoPath: preset.payload.repo_path,
      })
      executeRun(preset.payload)
    },
    [executeRun],
  )

  // Live module list: prefer the final summary, fall back to the ImpactAgent
  // event so the right panel fills in *while* the pipeline is still running.
  const impactedModules = useMemo(() => {
    if (summary?.impacted_modules?.length) return summary.impacted_modules
    const evt = events.find(
      (e) => e.agent === 'ImpactAgent' && e.event_type === 'completed' && Array.isArray(e.payload?.modules),
    )
    return evt?.payload.modules ?? []
  }, [summary, events])

  const healEvents = useMemo(
    () => events.filter((e) => e.agent === 'HealingAgent'),
    [events],
  )

  const testFiles = useMemo(() => {
    const evt = events.find(
      (e) => e.agent === 'Orchestrator' && Array.isArray(e.payload?.test_files),
    )
    return evt?.payload.test_files ?? []
  }, [events])

  const maxSeverity = useMemo(() => {
    let worst = null
    let worstOrder = 0
    impactedModules.forEach((m) => {
      const order = severityTheme(m.severity).order
      if (order > worstOrder) {
        worstOrder = order
        worst = String(m.severity ?? '').toLowerCase()
      }
    })
    return worst
  }, [impactedModules])

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        connected={connected}
        bobcoinsSaved={summary?.bobcoins_saved ?? null}
        presets={PRESETS}
        activePreset={activePreset}
        onPreset={handlePreset}
        disabled={running}
      />

      <div className="h-14 shrink-0" />

      {/* ── Run bar ───────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm">
        <div className="flex flex-wrap items-end gap-3 px-5 py-3">
          <ControlInput
            label="Base branch"
            value={form.base}
            onChange={(v) => setForm({ ...form, base: v })}
          />
          <ControlInput
            label="Head branch / SHA"
            placeholder="feature/my-branch"
            value={form.head}
            onChange={(v) => setForm({ ...form, head: v })}
          />
          <ControlInput
            label="Repo path"
            value={form.repoPath}
            onChange={(v) => setForm({ ...form, repoPath: v })}
          />

          <RunButton running={running} disabled={!form.head} onClick={handleRun} />

          {/* Active preset hint */}
          {activePreset && !running && (
            <p className="flex items-center gap-1.5 pb-1.5 text-[10.5px] text-slate-500">
              {summary ? (
                <>
                  <AlertIcon className="h-3 w-3 text-emerald-400" />
                  Scenario{' '}
                  <span className="text-slate-300">
                    {PRESETS.find((p) => p.id === activePreset)?.label}
                  </span>{' '}
                  completed
                </>
              ) : (
                <>
                  <RadarIcon className="h-3 w-3 text-cyan-400" />
                  Streaming scenario{' '}
                  <span className="text-slate-300">
                    {PRESETS.find((p) => p.id === activePreset)?.label}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            <CrossIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">Pipeline failed</span>
            <span className="truncate text-red-200/70">{error}</span>
          </div>
        )}
      </div>

      {/* ── Dashboard ─────────────────────────────────────────────────── */}
      <main className="mx-auto grid w-full max-w-[1800px] flex-1 grid-cols-12 items-start gap-4 px-5 py-5">
        {/* Left — metrics */}
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-3">
          <CoverageCard
            coverage={summary?.coverage_percent ?? null}
            prevCoverage={prevCoverage}
            passed={summary?.passed}
            failed={summary?.failed}
            generated={summary?.tests_generated}
            healed={summary?.tests_healed}
            bobcoinsSaved={summary?.bobcoins_saved}
          />
          <RiskCard
            maxSeverity={maxSeverity}
            affectedCount={impactedModules.length}
            filesChanged={summary?.files_changed}
            diffSha={summary?.diff_sha}
            hasData={!!summary || impactedModules.length > 0}
          />
        </div>

        {/* Center — agent stream */}
        <div className="col-span-12 lg:col-span-6">
          <AgentTerminal events={events} running={running} connected={connected} />
        </div>

        {/* Right — impact + healing */}
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-3">
          <ImpactGraph summary={summary} running={running} />
          <HealDiffCard healEvents={healEvents} testFiles={testFiles} />
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Run bar controls
// ---------------------------------------------------------------------------
function ControlInput({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <input
        className="w-40 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[11px] text-slate-200
                   placeholder:text-slate-600 transition-colors duration-200
                   hover:border-slate-700 focus:border-cyan-500/50 focus:bg-slate-900"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function RunButton({ running, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled || running}
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-gradient-to-br from-blue-700 to-blue-600
                 px-4 py-[7px] text-[12px] font-bold text-white transition-all duration-200
                 hover:from-blue-600 hover:to-blue-500 hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]
                 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
      style={{ boxShadow: running ? 'none' : '0 0 14px rgba(59,130,246,0.3)' }}
    >
      {running ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-blue-200 border-t-transparent" />
          Running…
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M3 2l7 4-7 4V2z" />
          </svg>
          Run QA Pipeline
        </>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// RiskCard — highest severity, blast radius, diff identity
// ---------------------------------------------------------------------------
function RiskCard({ maxSeverity, affectedCount, filesChanged, diffSha, hasData }) {
  const meta = maxSeverity ? severityTheme(maxSeverity) : null

  return (
    <section className="glass-panel space-y-3 p-4">
      <div className="flex items-center gap-2">
        <LayersIcon className="h-3.5 w-3.5 text-violet-300" />
        <h2 className="eyebrow">Risk Posture</h2>
      </div>

      {!hasData ? (
        <p className="text-[11px] leading-relaxed text-slate-600">
          Risk severity is derived from the ImpactAgent once a diff is analysed.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Max severity</span>
            {meta ? (
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.chip} ${meta.text}`}
                style={{ boxShadow: `0 0 10px ${meta.glow.replace('0.4', '0.2')}` }}
              >
                {meta.label}
              </span>
            ) : (
              <span className="text-[11px] text-slate-600">—</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="kpi-tile">
              <span className="text-[9px] uppercase tracking-wider text-slate-500">Modules</span>
              <span className="num text-lg font-bold leading-none text-cyan-300">{affectedCount}</span>
            </div>
            <div className="kpi-tile">
              <span className="text-[9px] uppercase tracking-wider text-slate-500">Files changed</span>
              <span className="num text-lg font-bold leading-none text-slate-200">
                {filesChanged ?? '—'}
              </span>
            </div>
          </div>

          {diffSha && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
              <span className="eyebrow">Diff SHA</span>
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                {diffSha}
              </code>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
