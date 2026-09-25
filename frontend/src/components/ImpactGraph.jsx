/**
 * ImpactGraph — horizontal bar chart of impacted modules & their severity.
 * Renders pure SVG — no charting library dependency.
 */
const SEVERITY_COLOR = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

export default function ImpactGraph({ summary }) {
  const modules = summary?.impacted_modules ?? []

  if (!modules.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 flex items-center justify-center text-gray-600 text-sm">
        No impact data yet
      </div>
    )
  }

  const maxLen = Math.max(...modules.map((m) => (m.path ?? '').length), 1)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Impacted Modules
      </h2>
      <div className="space-y-2">
        {modules.map((m, i) => {
          const barPct = Math.max(10, ((m.path?.length ?? 10) / maxLen) * 100)
          const color = SEVERITY_COLOR[m.severity] ?? '#6b7280'
          return (
            <div key={i} className="space-y-0.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span className="truncate max-w-[70%]">{m.path}</span>
                <span style={{ color }} className="font-semibold capitalize">
                  {m.severity}
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
