import { CoinIcon, ShieldIcon, SparkIcon, HealIcon, CheckIcon, CrossIcon } from './Icons.jsx'

/**
 * CoverageCard — coverage donut, KPI tiles and the Bobcoins highlight.
 *
 * Props
 * -----
 * coverage       number   Current coverage % after the run
 * prevCoverage   number?  Coverage % before the run, enables the delta bars
 * passed         number
 * failed         number
 * generated      number
 * healed         number
 * bobcoinsSaved  number
 */

const R = 42
const CIRC = 2 * Math.PI * R

/* Coverage band → gradient stops. Neon green at the top end, cyan mid, amber
 * then red as coverage drops, so the ring colour itself carries the signal. */
function band(pct) {
  if (pct >= 80) return { from: '#4ade80', to: '#22d3ee', text: 'text-emerald-300', label: 'HEALTHY' }
  if (pct >= 60) return { from: '#a3e635', to: '#22d3ee', text: 'text-cyan-300', label: 'FAIR' }
  if (pct >= 40) return { from: '#fbbf24', to: '#fb923c', text: 'text-amber-300', label: 'THIN' }
  return { from: '#f87171', to: '#fb923c', text: 'text-red-300', label: 'CRITICAL' }
}

export default function CoverageCard({
  coverage, prevCoverage, passed, failed, generated, healed, bobcoinsSaved,
}) {
  const hasCoverage = coverage != null
  const pct = Math.round(coverage ?? 0)
  const prev = prevCoverage != null ? Math.round(prevCoverage) : null
  const delta = prev != null ? pct - prev : null
  const b = band(pct)
  const coins = bobcoinsSaved ?? 0
  const approved = hasCoverage && pct >= 80 && (failed ?? 0) === 0

  return (
    <section className="glass-panel space-y-4 p-4">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="eyebrow">Coverage &amp; Results</h2>
        {approved && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300 glow-green">
            <ShieldIcon className="h-3 w-3" />
            QA Approved
          </span>
        )}
      </div>

      {/* ── Donut ────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Donut pct={pct} hasCoverage={hasCoverage} band={b} />

        {/* Delta bars */}
        <div className="w-full min-w-0 flex-1 space-y-2">
          {prev != null ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="eyebrow">Coverage Δ</p>
                  <p className="text-[11px] text-slate-500">
                    {prev}% <span className="text-slate-600">→</span>{' '}
                    <span className="font-semibold text-slate-200">{pct}%</span>
                  </p>
                </div>
                <span
                  className={`num text-lg font-bold leading-none ${
                    delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-400' : 'text-slate-500'
                  }`}
                >
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : '='}
                  {Math.abs(delta ?? 0)}
                  <span className="text-[10px]">%</span>
                </span>
              </div>
              <DeltaBar label="before" value={prev} color="#475569" />
              <DeltaBar label="after" value={pct} color={b.from} glow={b.to} />
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-slate-500">
              {hasCoverage
                ? 'Re-run the pipeline to compare against a previous coverage baseline.'
                : 'Awaiting first run. Coverage delta will appear here after the baseline is captured.'}
            </p>
          )}
        </div>
      </div>

      {/* ── KPI tiles ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Passed" value={passed} tone="emerald" Icon={CheckIcon} />
        <KpiTile label="Failed" value={failed} tone="red" Icon={CrossIcon} />
        <KpiTile label="Generated" value={generated} tone="cyan" Icon={SparkIcon} />
        <KpiTile label="Healed" value={healed} tone="amber" Icon={HealIcon} />
      </div>

      {/* ── Bobcoins ─────────────────────────────────────────────────── */}
      <Bobcoins coins={coins} />

      {!hasCoverage && (
        <p className="border-t border-slate-800 pt-3 text-center text-[10.5px] text-slate-600">
          Run a pipeline to populate these metrics.
        </p>
      )}
    </section>
  )
}

/* ── Donut ───────────────────────────────────────────────────────────── */

function Donut({ pct, hasCoverage, band: b }) {
  const gid = `cov-grad-${b.from.replace('#', '')}-${b.to.replace('#', '')}`
  const filled = hasCoverage ? Math.min(Math.max(pct, 0), 100) : 0

  return (
    <div className="relative shrink-0">
      {/* Ambient bloom behind the ring */}
      {hasCoverage && (
        <span
          className="pointer-events-none absolute -inset-3 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${b.from}22, transparent 70%)` }}
        />
      )}

      <svg
        width="116"
        height="116"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Coverage ${hasCoverage ? `${pct}%` : 'unknown'}`}
        className="relative"
      >
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={b.from} />
            <stop offset="100%" stopColor={b.to} />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="#1e293b" strokeWidth="10" />

        {/* Ticks — subtle instrumentation detail */}
        <circle
          cx="50" cy="50" r={R + 8} fill="none" stroke="#1e293b" strokeWidth="2"
          strokeDasharray="1 7" strokeLinecap="round" opacity="0.8"
        />

        {/* Filled arc */}
        {hasCoverage && (
          <>
            <circle
              cx="50" cy="50" r={R} fill="none"
              stroke={`url(#${gid})`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(filled / 100) * CIRC} ${CIRC}`}
              transform="rotate(-90 50 50)"
              style={{
                filter: `drop-shadow(0 0 6px ${b.from}aa)`,
                transition: 'stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            {/* Leading cap highlight */}
            <circle
              cx="50" cy="50" r={R} fill="none"
              stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.55"
              strokeDasharray={`2 ${CIRC}`}
              strokeDashoffset={-((filled / 100) * CIRC)}
              transform="rotate(-90 50 50)"
            />
          </>
        )}

        {/* Centred value — tspans keep the "%" attached at any digit count */}
        <text
          x="50" y="49"
          textAnchor="middle"
          fill={hasCoverage ? '#f1f5f9' : '#334155'}
          fontSize="26"
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
          letterSpacing="-1"
        >
          {hasCoverage ? pct : '—'}
          {hasCoverage && (
            <tspan fill={b.from} fontSize="13" dy="3" dx="1">
              %
            </tspan>
          )}
        </text>
        <text x="50" y="64" textAnchor="middle" fill="#64748b" fontSize="7.5" letterSpacing="2.5">
          COVERAGE
        </text>
      </svg>

      {hasCoverage && (
        <span
          className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full border border-slate-800 bg-slate-950 px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.14em] ${b.text}`}
        >
          {b.label}
        </span>
      )}
    </div>
  )
}

function DeltaBar({ label, value, color, glow }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-600">
        <span>{label}</span>
        <span className="num">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-950">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(Math.max(value, 0), 100)}%`,
            background: glow ? `linear-gradient(90deg, ${color}, ${glow})` : color,
            boxShadow: glow ? `0 0 6px ${glow}` : 'none',
            transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
    </div>
  )
}

/* ── KPI tile ────────────────────────────────────────────────────────── */

const KPI_TONE = {
  emerald: 'text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40',
  red: 'text-red-400 border-red-500/20 hover:border-red-500/40',
  cyan: 'text-cyan-300 border-cyan-500/20 hover:border-cyan-500/40',
  amber: 'text-amber-300 border-amber-500/20 hover:border-amber-500/40',
}

function KpiTile({ label, value, tone, Icon }) {
  return (
    <div className={`kpi-tile group ${KPI_TONE[tone]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 opacity-70" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
      </div>
      <span className={`num text-xl font-bold leading-none ${KPI_TONE[tone].split(' ')[0]}`}>
        {value ?? 0}
      </span>
    </div>
  )
}

/* ── Bobcoins ────────────────────────────────────────────────────────── */

function Bobcoins({ coins }) {
  return (
    <div className="neon-rim overflow-hidden rounded-xl bg-gradient-to-b from-yellow-500/[0.07] to-emerald-500/[0.04] p-3.5">
      {/* `relative` keeps content above the ::before neon rim */}
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-500/10">
              <CoinIcon className="h-4 w-4 text-yellow-300" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-yellow-200/80">
                Bobcoins Saved
              </p>
              <p className="text-[10px] text-slate-500">Executed locally · zero LLM spend</p>
            </div>
          </div>

          <span className="num block text-3xl font-bold leading-none text-yellow-200 text-glow-gold">
            {Math.round(coins)}
            <span className="text-base">%</span>
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/80 ring-1 ring-slate-800">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(Math.max(coins, 0), 100)}%`,
              background: 'linear-gradient(90deg, #facc15 0%, #34d399 100%)',
              boxShadow: '0 0 10px rgba(250, 204, 21, 0.55)',
              transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          Diff parsing, AST heuristics, gap detection and test execution all run
          locally. Only test synthesis and repair are billed.
        </p>
      </div>
    </div>
  )
}
