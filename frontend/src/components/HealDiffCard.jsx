import { useState } from 'react'
import { agentTheme } from '../lib/design.js'
import { narrate } from '../lib/narration.js'
import { ChevronIcon, HealIcon, FileIcon } from './Icons.jsx'

/**
 * HealDiffCard — self-healing report (right column).
 *
 * The HealingAgent currently reports `failing_tests` / `tests_healed` counts
 * and rewrites the test files on disk, so there is no line-level diff payload
 * to render. This card therefore presents the repair as a readable summary —
 * what failed, how many tests were rewritten, and where — and transparently
 * falls back to a line diff whenever a `before`/`after` pair *is* present in
 * the payload (forward-compatible with a richer backend).
 *
 * Props
 * -----
 * healEvents  object[]  HealingAgent SSE events
 * testFiles   string[]  Test files written by the GeneratorAgent
 */
export default function HealDiffCard({ healEvents, testFiles = [] }) {
  const [expanded, setExpanded] = useState(false)

  if (!healEvents?.length && testFiles.length === 0) return null

  const started = healEvents?.find((e) => e.event_type === 'started')
  const completed = healEvents?.find((e) => e.event_type === 'completed')
  const failed = started?.payload?.failing_tests ?? 0
  const healed = completed?.payload?.tests_healed ?? 0
  const theme = agentTheme('HealingAgent')
  const hasDiff = healEvents?.some((e) => e.payload?.before || e.payload?.after)

  return (
    <section className="glass-panel overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-slate-800 px-3 py-2.5 text-left transition-colors hover:bg-slate-900/50"
      >
        <HealIcon className={`h-3.5 w-3.5 ${theme.text}`} />
        <h2 className="eyebrow">Self-Healing</h2>
        <span
          className={`num ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold ${theme.chip} ${theme.text}`}
        >
          {healed} healed
        </span>
        <ChevronIcon open={expanded} className="h-3 w-3 text-slate-600" />
      </button>

      <div className="space-y-3 p-3">
        {/* Repair summary */}
        <div className="flex items-center gap-2">
          <Stat label="failed" value={failed} tone="text-red-400" />
          <span className="text-slate-700">→</span>
          <Stat label="repaired" value={healed} tone="text-amber-300" />
          <span className="ml-auto text-[10px] text-slate-600">
            {healed > 0 ? 're-executed' : 'no repair needed'}
          </span>
        </div>

        {hasDiff && <DiffView events={healEvents} />}

        {expanded && (
          <div className="animate-fade-slide-up space-y-1.5">
            <p className="eyebrow">Rewritten test files</p>
            {testFiles.length === 0 ? (
              <p className="text-[10.5px] text-slate-600">No test files were written.</p>
            ) : (
              <ul className="space-y-0.5">
                {testFiles.map((f) => (
                  <li key={f} className="flex items-center gap-1.5" title={f}>
                    <FileIcon className="h-3 w-3 shrink-0 text-slate-600" />
                    <span className="truncate font-mono text-[10.5px] text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Narrative trail from the healing events */}
        {healEvents?.map((evt, i) => {
          const n = narrate(evt)
          return (
            <p key={i} className="border-l-2 border-amber-500/30 pl-2 text-[10.5px] leading-relaxed text-slate-400">
              {n.headline}
              {n.detail ? ` — ${n.detail}` : ''}
            </p>
          )
        })}
      </div>
    </section>
  )
}

function Stat({ label, value, tone }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={`num text-lg font-bold leading-none ${tone}`}>{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    </span>
  )
}

/* ── Optional line diff (used when the backend supplies before/after) ── */

function DiffView({ events }) {
  return (
    <div className="space-y-2">
      {events.map((evt, i) => {
        const { before, after, module } = evt.payload ?? {}
        if (!before && !after) return null
        return (
          <div key={i} className="space-y-1">
            <p className="truncate font-mono text-[10px] text-amber-200/80" title={module}>
              {module ?? `test #${i + 1}`}
            </p>
            <Lines before={before} after={after} />
          </div>
        )
      })}
    </div>
  )
}

function Lines({ before, after }) {
  const b = String(before ?? '').split('\n')
  const a = String(after ?? '').split('\n')
  const rows = []

  for (let i = 0; i < Math.max(b.length, a.length); i += 1) {
    if (b[i] === a[i]) {
      rows.push({ type: 'ctx', text: b[i] ?? '' })
    } else {
      if (b[i] !== undefined) rows.push({ type: 'del', text: b[i] })
      if (a[i] !== undefined) rows.push({ type: 'add', text: a[i] })
    }
  }

  return (
    <div className="overflow-hidden rounded border border-slate-800 font-mono text-[10px]">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-start gap-1.5 px-2 py-0.5"
          style={
            row.type === 'del'
              ? { background: 'rgba(127,29,29,0.3)', color: '#fca5a5' }
              : row.type === 'add'
              ? { background: 'rgba(20,83,45,0.3)', color: '#86efac' }
              : { color: '#475569' }
          }
        >
          <span className="w-2 shrink-0 select-none opacity-70">
            {row.type === 'del' ? '−' : row.type === 'add' ? '+' : ' '}
          </span>
          <span className="break-all leading-4">{row.text}</span>
        </div>
      ))}
    </div>
  )
}
