/**
 * CoverageCard — test-suite summary + Bobcoins Ahorrados indicator
 *                + Before/After coverage comparison + QA APPROVED badge.
 *
 * Props
 * -----
 * coverage      number   Current (after) coverage %
 * prevCoverage  number?  Previous coverage % (before the pipeline ran); omit to hide comparison
 * passed        number
 * failed        number
 * generated     number
 * healed        number
 * bobcoinsSaved number
 */
export default function CoverageCard({
  coverage, prevCoverage, passed, failed, generated, healed, bobcoinsSaved
}) {
  const pct      = Math.round(coverage ?? 0)
  const prev     = prevCoverage != null ? Math.round(prevCoverage) : null
  const delta    = prev != null ? pct - prev : null
  const ringColor = pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171'
  const coins     = bobcoinsSaved ?? 0
  const coinsColor = coins >= 70 ? '#a78bfa' : coins >= 40 ? '#60a5fa' : '#94a3b8'
  const approved  = pct >= 80 && (failed ?? 0) === 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-5">

      {/* ── Header row ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Coverage &amp; Results
        </h2>
        {approved && <QABadge />}
      </div>

      {/* ── Coverage ring + stats ────────────────────────────────── */}
      <div className="flex items-center gap-6">
        <svg width="80" height="80" viewBox="0 0 80 80" aria-label={`Coverage ${pct}%`}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="#1f2937" strokeWidth="8" />
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="46" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
            {pct}%
          </text>
        </svg>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Stat label="Passed"    value={passed}    color="text-green-400" />
          <Stat label="Failed"    value={failed}    color="text-red-400" />
          <Stat label="Generated" value={generated} color="text-blue-400" />
          <Stat label="Healed"    value={healed}    color="text-purple-400" />
        </div>
      </div>

      {/* ── Before / After comparison ────────────────────────────── */}
      {prev != null && (
        <div className="border border-gray-800 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            Coverage Δ
          </p>
          <div className="flex items-center gap-3">
            {/* Before bar */}
            <div className="flex-1 space-y-0.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Before</span>
                <span>{prev}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${prev}%`, backgroundColor: '#4b5563' }}
                />
              </div>
            </div>

            {/* Arrow + delta */}
            <div className={`text-lg font-bold shrink-0 ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '='}{Math.abs(delta)}%
            </div>

            {/* After bar */}
            <div className="flex-1 space-y-0.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span>After</span>
                <span className="font-bold">{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: ringColor }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bobcoins Ahorrados ───────────────────────────────────── */}
      <div className="border-t border-gray-800 pt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 font-semibold uppercase tracking-wider">
            🪙 Bobcoins Ahorrados
          </span>
          <span className="font-bold text-base" style={{ color: coinsColor }}>
            {coins}%
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${coins}%`, backgroundColor: coinsColor }}
          />
        </div>
        <p className="text-xs text-gray-600">
          Trabajo ejecutado localmente sin costo de tokens LLM
        </p>
      </div>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function Stat({ label, value, color }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className={`font-bold ${color}`}>{value ?? 0}</span>
    </>
  )
}

function QABadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
                     bg-green-950 text-green-300 border border-green-700 uppercase tracking-wider">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4.5" stroke="#4ade80" />
        <path d="M2.5 5l1.8 1.8L7.5 3.5" stroke="#4ade80" strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      QA APPROVED
    </span>
  )
}
