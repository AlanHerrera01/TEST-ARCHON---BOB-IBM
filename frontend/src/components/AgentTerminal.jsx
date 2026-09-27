import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSessions } from '../services/api.js'
import { AGENT_ORDER, agentTheme, eventTheme } from '../lib/design.js'
import { narrate, buildReasoningFlow } from '../lib/narration.js'
import {
  BrainIcon,
  CheckIcon,
  ChevronIcon,
  LayersIcon,
  NODE_ICONS,
  TerminalIcon,
} from './Icons.jsx'

/**
 * AgentTerminal — live multi-agent console.
 *
 * Three views over the same SSE event array:
 *   live      chronological event cards, one per SSE frame
 *   cot       the reasoning flow distilled from those same events
 *   sessions  durable log persisted server-side in bob_sessions/
 *
 * Events are narrated (see lib/narration.js) rather than dumped as raw JSON.
 *
 * Props
 * -----
 * events     object[]  SSE event objects
 * running    boolean   Pipeline is in-flight
 * connected  boolean   SSE stream is open
 */

const TABS = [
  { id: 'live', label: 'Agent Stream', Icon: TerminalIcon },
  { id: 'cot', label: 'Chain of Thought', Icon: BrainIcon },
  { id: 'sessions', label: 'Session Logs', Icon: LayersIcon },
]

const FACT_TONE = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  red: 'border-red-500/30 bg-red-500/10 text-red-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  gold: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  slate: 'border-slate-700 bg-slate-800/50 text-slate-300',
}

export default function AgentTerminal({ events, running, connected }) {
  const [tab, setTab] = useState('live')
  const [sessions, setSessions] = useState(null)
  const [loadingS, setLoadingS] = useState(false)
  const [sessionErr, setSessionErr] = useState(null)
  const bottomRef = useRef(null)

  const flow = useMemo(() => buildReasoningFlow(events), [events])

  // Follow the tail of the stream while a run is in flight.
  useEffect(() => {
    if (tab === 'live' && running) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [events, tab, running])

  useEffect(() => {
    if (tab !== 'sessions') return
    setLoadingS(true)
    setSessionErr(null)
    fetchSessions()
      .then((data) => setSessions(data.sessions ?? []))
      .catch((err) => setSessionErr(err.message))
      .finally(() => setLoadingS(false))
  }, [tab])

  const activeCount = AGENT_ORDER.filter((a) => events.some((e) => e.agent === a)).length

  return (
    <section className="glass-panel flex min-h-[520px] flex-col overflow-hidden">
      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-0.5" role="tablist">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold
                            transition-all duration-200 ${
                              active
                                ? 'bg-slate-800/80 text-slate-50'
                                : 'text-slate-500 hover:bg-slate-900/60 hover:text-slate-300'
                            }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-cyan-300' : ''}`} />
                {label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {events.length > 0 && (
            <span className="num text-[10px] text-slate-500">
              {events.length} events · {activeCount}/4 agents
            </span>
          )}
          {running ? (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-cyan-400" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </span>
              Live
            </span>
          ) : (
            connected && <span className="text-[10px] text-emerald-400">Stream idle</span>
          )}
        </div>
      </div>

      {/* ── Animated hairline ────────────────────────────────────────── */}
      <div className="relative h-px w-full shrink-0 overflow-hidden bg-slate-800">
        <div
          className={`absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent ${
            running ? 'animate-sweep-x' : 'opacity-15'
          }`}
        />
      </div>

      {/* ── Live ─────────────────────────────────────────────────────── */}
      {tab === 'live' && (
        <div className="cyber-scroll flex-1 overflow-y-auto px-4 py-4">
          {events.length === 0 ? (
            <StreamEmpty running={running} />
          ) : (
            <ol className="relative space-y-2.5 pl-5">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-gradient-to-b from-slate-700/70 via-slate-800 to-transparent" />
              {events.map((evt, i) => (
                <EventCard key={`${evt.timestamp}-${i}`} evt={evt} />
              ))}
            </ol>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Chain of thought ─────────────────────────────────────────── */}
      {tab === 'cot' && (
        <div className="cyber-scroll flex-1 overflow-y-auto px-4 py-4">
          {flow.length === 0 ? (
            <ThoughtEmpty running={running} />
          ) : (
            <ReasoningFlow flow={flow} />
          )}
        </div>
      )}

      {/* ── Sessions ─────────────────────────────────────────────────── */}
      {tab === 'sessions' && (
        <div className="cyber-scroll flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {loadingS && <StreamEmpty running label="Loading session logs…" />}
          {sessionErr && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {sessionErr}
            </p>
          )}
          {!loadingS && !sessionErr && sessions?.length === 0 && (
            <StreamEmpty label="No sessions recorded yet." />
          )}
          {sessions?.map((entry, i) => (
            <SessionEntry key={`${entry.timestamp}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ── Live event card ─────────────────────────────────────────────────── */

function EventCard({ evt }) {
  const agent = agentTheme(evt.agent)
  const lifecycle = eventTheme(evt.event_type)
  const n = narrate(evt)
  const isResult = n.kind === 'result'

  return (
    <li className="relative animate-fade-slide-up">
      {/* Timeline node */}
      <span
        className="absolute -left-5 top-3.5 h-2.5 w-2.5 rounded-full ring-4 ring-slate-950"
        style={{ backgroundColor: agent.textHex, boxShadow: `0 0 8px ${agent.glow}` }}
      />

      <article
        className={`overflow-hidden rounded-lg border bg-slate-900/40 transition-colors duration-200 hover:bg-slate-900/70 ${
          isResult ? 'border-emerald-500/30' : 'border-slate-800'
        }`}
      >
        {/* Agent accent stripe */}
        <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: agent.textHex }} />

        <div className="px-3.5 py-2.5 pl-4">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${agent.bg} ${agent.border} ${agent.text}`}
              style={{ boxShadow: `0 0 10px ${agent.glow.replace('0.45', '0.18')}` }}
              title={agent.label}
            >
              {evt.agent}
            </span>

            <span
              className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${lifecycle.chip}`}
            >
              {lifecycle.label}
            </span>

            <span className="num ml-auto text-[10px] text-slate-600">
              {evt.timestamp?.slice(11, 19) ?? '--:--:--'}
            </span>
          </div>

          {/* Headline */}
          <p className="mt-1.5 text-[12.5px] font-semibold leading-5 text-slate-100">
            {n.headline}
          </p>

          {n.detail && (
            <p className="mt-0.5 text-[11px] leading-[1.45] text-slate-400">{n.detail}</p>
          )}

          {n.facts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {n.facts.map((f, i) => (
                <span key={`${f.label}-${i}`} className={`chip ${FACT_TONE[f.tone] ?? FACT_TONE.slate}`}>
                  <span className="text-slate-500/80">{f.label}</span>
                  <span className="num font-semibold text-slate-100">{f.value}</span>
                </span>
              ))}
            </div>
          )}

          {n.lists.map((list) => (
            <PathList key={list.label} label={list.label} items={list.items} />
          ))}
        </div>
      </article>
    </li>
  )
}

function PathList({ label, items }) {
  const [expanded, setExpanded] = useState(false)
  const preview = items.slice(0, expanded ? items.length : 3)
  const hidden = items.length - preview.length

  return (
    <div className="mt-2 rounded-md border border-slate-800/80 bg-slate-950/50 p-2">
      <p className="eyebrow mb-1">{label}</p>
      <ul className="space-y-0.5">
        {preview.map((item, i) => (
          <li key={i} className="truncate font-mono text-[10.5px] text-slate-400" title={item}>
            {item}
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[10px] font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
        >
          {expanded ? 'Show less' : `+ ${hidden} more`}
        </button>
      )}
    </div>
  )
}

/* ── Chain of thought ────────────────────────────────────────────────── */

function ReasoningFlow({ flow }) {
  return (
    <ol className="relative space-y-3 pl-7">
      <span className="absolute bottom-4 left-[11px] top-4 w-px bg-gradient-to-b from-violet-500/40 via-cyan-500/25 to-transparent" />
      {flow.map((node, i) => (
        <ThoughtNode key={node.key ?? i} node={node} index={i} />
      ))}
    </ol>
  )
}

function ThoughtNode({ node, index }) {
  const agent = agentTheme(node.agent)
  const Icon = NODE_ICONS[node.icon] ?? BrainIcon

  return (
    <li className="relative animate-fade-slide-up" style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}>
      <span
        className="absolute -left-7 top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-slate-950"
        style={{ borderColor: `${agent.textHex}55`, color: agent.textHex }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <article
        className={`rounded-lg border px-3.5 py-2.5 transition-colors duration-200 ${
          node.verdict ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-slate-800 bg-slate-900/40'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[9px] font-bold uppercase tracking-[0.14em] ${agent.text}`}>
            {agent.short}
          </span>
          <span className="text-[9px] text-slate-600">step {String(index + 1).padStart(2, '0')}</span>
          {node.verdict && (
            <span className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              <CheckIcon className="h-3 w-3" />
              Verdict
            </span>
          )}
        </div>

        <p className="mt-1 text-[12.5px] font-medium leading-5 text-slate-100">{node.title}</p>

        {node.body && (
          <p className="mt-1 border-l border-slate-700 pl-2.5 text-[11px] italic leading-[1.5] text-slate-400">
            {node.body}
          </p>
        )}

        {node.facts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {node.facts.map((f, i) => (
              <span key={`${f.label}-${i}`} className={`chip ${FACT_TONE[f.tone] ?? FACT_TONE.slate}`}>
                <span className="text-slate-500/80">{f.label}</span>
                <span className="num font-semibold text-slate-100">{f.value}</span>
              </span>
            ))}
          </div>
        )}

        {node.lists.map((list) => (
          <div key={list.label} className="mt-2 rounded-md border border-slate-800/80 bg-slate-950/50 p-2">
            <p className="eyebrow mb-1">{list.label}</p>
            <ul className="space-y-0.5">
              {list.items.slice(0, 6).map((item, i) => (
                <li key={i} className="truncate font-mono text-[10.5px] text-slate-400" title={item}>
                  {item}
                </li>
              ))}
            </ul>
            {list.items.length > 6 && (
              <p className="mt-1 text-[10px] text-slate-600">+{list.items.length - 6} more</p>
            )}
          </div>
        ))}
      </article>
    </li>
  )
}

/* ── Empty states ────────────────────────────────────────────────────── */

function StreamEmpty({ running, label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-cyan-400/10 blur-xl" />
        <TerminalIcon className="relative h-8 w-8 text-slate-700" />
      </div>
      <p className="max-w-[280px] text-[11px] leading-relaxed text-slate-500">
        {label ?? (running ? 'Waiting for the first agent event…' : 'Run a pipeline to stream the multi-agent conversation.')}
      </p>
      <div className="flex gap-1.5">
        {AGENT_ORDER.map((a) => (
          <span
            key={a}
            className="h-1 w-6 rounded-full opacity-30"
            style={{ background: agentTheme(a).textHex }}
          />
        ))}
      </div>
    </div>
  )
}

function ThoughtEmpty({ running }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-violet-400/10 blur-xl" />
        <BrainIcon className="relative h-8 w-8 text-slate-700" />
      </div>
      <p className="max-w-[280px] text-[11px] leading-relaxed text-slate-500">
        {running
          ? 'Agents are reasoning — nodes appear as decisions are made.'
          : 'The reasoning flow is distilled from agent events. Run a pipeline to populate it.'}
      </p>
    </div>
  )
}

/* ── Session log entry ───────────────────────────────────────────────── */

function SessionEntry({ entry }) {
  const [open, setOpen] = useState(false)
  const agent = agentTheme(entry.agent)
  const lifecycle = eventTheme(entry.event_type)
  const n = narrate(entry)

  return (
    <article className="animate-fade-slide-up overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-900/70"
      >
        <ChevronIcon open={open} className="h-3 w-3 shrink-0 text-slate-600" />
        <span className="num shrink-0 text-[10px] text-slate-600">
          {entry.timestamp?.slice(0, 19).replace('T', ' ') ?? ''}
        </span>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${agent.bg} ${agent.border} ${agent.text}`}
        >
          {entry.agent}
        </span>
        <span className="truncate text-[11px] text-slate-300">{n.headline}</span>
        <span className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${lifecycle.chip}`}>
          {lifecycle.label}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-slate-800 bg-slate-950/60 px-3 py-2.5">
          {n.detail && <p className="text-[11px] italic leading-relaxed text-slate-400">{n.detail}</p>}
          {n.facts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {n.facts.map((f, i) => (
                <span key={`${f.label}-${i}`} className="chip">
                  <span>{f.label}</span>
                  <span className="num font-semibold text-slate-100">{f.value}</span>
                </span>
              ))}
            </div>
          )}
          {n.lists.map((list) => (
            <ul key={list.label} className="space-y-0.5">
              {list.items.map((item, i) => (
                <li key={i} className="truncate font-mono text-[10px] text-slate-500">
                  {item}
                </li>
              ))}
            </ul>
          ))}
          {n.kind === 'generic' && (
            <pre className="cyber-scroll overflow-x-auto text-[10px] leading-relaxed text-slate-500">
              {JSON.stringify(entry.payload ?? {}, null, 2)}
            </pre>
          )}
        </div>
      )}
    </article>
  )
}
