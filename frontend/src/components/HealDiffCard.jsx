/**
 * HealDiffCard — renders a unified-diff-style view of healed test patches.
 *
 * Receives `healEvents`: array of SSE events from HealingAgent with a
 * `diff` key in their payload ({ module, before, after }).
 */
export default function HealDiffCard({ healEvents }) {
  if (!healEvents || healEvents.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden md:col-span-2">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center gap-2">
        <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider">
          🩹 Self-Healing Diffs
        </span>
        <span className="text-xs text-gray-600">
          {healEvents.length} test{healEvents.length !== 1 ? 's' : ''} reparado{healEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-gray-800">
        {healEvents.map((evt, i) => {
          const { module, before, after } = evt.payload ?? {}
          return (
            <div key={i} className="p-4 space-y-2">
              <p className="text-xs text-purple-300 font-mono">{module ?? `test #${i + 1}`}</p>
              <DiffView before={before} after={after} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Diff renderer ───────────────────────────────────────────────────── */

function DiffView({ before, after }) {
  // If the backend doesn't send structured before/after, show a placeholder
  if (!before && !after) {
    return (
      <p className="text-xs text-gray-600 italic">
        Diff detail not available — test source was rewritten by HealingAgent.
      </p>
    )
  }

  const beforeLines = (before ?? '').split('\n')
  const afterLines  = (after  ?? '').split('\n')

  // Build a simple line-by-line diff (changed lines only for brevity)
  const maxLen = Math.max(beforeLines.length, afterLines.length)
  const rows = []
  for (let i = 0; i < maxLen; i++) {
    const b = beforeLines[i]
    const a = afterLines[i]
    if (b === a) {
      rows.push({ type: 'ctx', text: b ?? '' })
    } else {
      if (b !== undefined) rows.push({ type: 'del', text: b })
      if (a !== undefined) rows.push({ type: 'add', text: a })
    }
  }

  return (
    <div className="rounded overflow-hidden border border-gray-800 text-xs font-mono">
      {rows.map((row, i) => (
        <div
          key={i}
          className={
            row.type === 'del'
              ? 'bg-red-950 text-red-300 px-3 py-0.5'
              : row.type === 'add'
              ? 'bg-green-950 text-green-300 px-3 py-0.5'
              : 'text-gray-600 px-3 py-0.5'
          }
        >
          {row.type === 'del' ? '- ' : row.type === 'add' ? '+ ' : '  '}
          {row.text}
        </div>
      ))}
    </div>
  )
}
