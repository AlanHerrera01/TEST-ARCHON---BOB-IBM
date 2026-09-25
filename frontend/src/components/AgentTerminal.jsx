import { useEffect, useRef, useState } from 'react'
import { fetchSessions } from '../services/api.js'

/**
 * AgentTerminal — live events + Sessions tab (bob_sessions/session_logs.json).
 */
const AGENT_COLORS = {
  Orchestrator:   'text-blue-400',
  ImpactAgent:    'text-yellow-400',
  GeneratorAgent: 'text-green-400',
  HealingAgent:   'text-purple-400',
}

const EVENT_ICONS = {
  started:   '▶',
  progress:  '↻',
  completed: '✔',
  failed:    '✖',
}

export default function AgentTerminal({ events, running }) {
  const [tab, setTab] = useState('live')           // 'live' | 'sessions'
  const [sessions, setSessions] = useState(null)   // null = not loaded yet
  const [loadingS, setLoadingS] = useState(false)
  const [sessionErr, setSessionErr] = useState(null)
  const bottomRef = useRef(null)

  // Auto-scroll live tab
  useEffect(() => {
    if (tab === 'live') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events, tab])

  // Load sessions when switching to that tab
  useEffect(() => {
    if (tab !== 'sessions') return
    setLoadingS(true)
    setSessionErr(null)
    fetchSessions()
      .then((data) => setSessions(data.sessions ?? []))
      .catch((err) => setSessionErr(err.message))
      .finally(() => setLoadingS(false))
  }, [tab])

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex gap-1">
          <TabBtn active={tab === 'live'} onClick={() => setTab('live')}>
            Agent Terminal
          </TabBtn>
          <TabBtn active={tab === 'sessions'} onClick={() => setTab('sessions')}>
            Sessions
          </TabBtn>
        </div>
        {running && tab === 'live' && (
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* ── Live tab ─────────────────────────────────────────────── */}
      {tab === 'live' && (
        <div className="h-64 overflow-y-auto p-4 space-y-1 text-xs leading-5">
          {events.length === 0 && (
            <p className="text-gray-600">Waiting for events…</p>
          )}
          {events.map((evt, i) => {
            const agentColor = AGENT_COLORS[evt.agent] ?? 'text-gray-300'
            const icon = EVENT_ICONS[evt.event_type] ?? '·'
            const payloadStr = JSON.stringify(evt.payload ?? {})
            return (
              <div key={i} className="flex gap-2">
                <span className="text-gray-600 shrink-0">
                  {evt.timestamp?.slice(11, 19)}
                </span>
                <span className={`shrink-0 ${agentColor}`}>
                  {icon} [{evt.agent}]
                </span>
                <span className="text-gray-400 break-all">{payloadStr}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Sessions tab ─────────────────────────────────────────── */}
      {tab === 'sessions' && (
        <div className="h-64 overflow-y-auto p-4 space-y-3 text-xs leading-5">
          {loadingS && <p className="text-gray-500">Loading session logs…</p>}
          {sessionErr && <p className="text-red-400">Error: {sessionErr}</p>}
          {!loadingS && !sessionErr && sessions?.length === 0 && (
            <p className="text-gray-600">No sessions recorded yet.</p>
          )}
          {sessions?.map((entry, i) => (
            <SessionEntry key={i} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
        active
          ? 'bg-gray-700 text-gray-100'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
}

function SessionEntry({ entry }) {
  const [open, setOpen] = useState(false)
  const agentColor = AGENT_COLORS[entry.agent] ?? 'text-gray-300'
  const icon = EVENT_ICONS[entry.event_type] ?? '·'

  return (
    <div className="border border-gray-800 rounded overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-left"
      >
        <span className="text-gray-600 shrink-0">{entry.timestamp?.slice(0, 19).replace('T', ' ')}</span>
        <span className={`shrink-0 ${agentColor}`}>{icon} [{entry.agent}]</span>
        <span className="text-gray-500 truncate capitalize">{entry.event_type}</span>
        <span className="ml-auto text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="px-3 py-2 bg-gray-950 text-gray-400 text-xs overflow-x-auto">
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  )
}
