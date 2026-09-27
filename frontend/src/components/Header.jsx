import { CoinIcon, PulseIcon } from './Icons.jsx'

/**
 * Header — compact fixed top bar.
 *
 * Left:   product mark + hackathon badge + SSE status (ping animation)
 * Center: demo preset segmented control
 * Right:  Bobcoins saved readout
 *
 * Props
 * -----
 * connected      boolean   SSE stream state
 * bobcoinsSaved  number?   % of work executed locally (0-100)
 * presets        array     demo scenario definitions
 * activePreset   string?   id of the running preset
 * onPreset       fn        called with the preset object
 * disabled       boolean   true while a pipeline is in flight
 */
export default function Header({
  connected = false,
  bobcoinsSaved = null,
  presets = [],
  activePreset = null,
  onPreset,
  disabled = false,
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      {/* Top hairline — cyan→violet accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      <div className="flex h-14 items-center gap-4 px-5">
        {/* ── Left: identity ───────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-7 w-7 items-center justify-center">
              <span className="absolute inset-0 rounded-md bg-cyan-400/10 ring-1 ring-cyan-400/30" />
              <svg width="16" height="16" viewBox="0 0 22 22" fill="none" aria-hidden="true" className="relative">
                <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" stroke="#22d3ee" strokeWidth="1.6" />
                <polygon points="11,6 16.5,9 16.5,13 11,16 5.5,13 5.5,9" fill="#22d3ee" opacity="0.22" />
                <circle cx="11" cy="11" r="2.4" fill="#22d3ee" />
              </svg>
            </span>
            <span className="text-[15px] font-bold leading-none tracking-tight">
              <span className="text-cyan-300">TEST</span>
              <span className="text-slate-100">-ARCHON</span>
            </span>
          </div>

          <span className="hidden rounded border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-300 lg:inline-block">
            IBM Bob Hackathon 2.0
          </span>

          <StatusPill connected={connected} />
        </div>

        {/* ── Center: demo presets ──────────────────────────────────── */}
        {presets.length > 0 && (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1 backdrop-blur-sm">
              <span className="eyebrow hidden pl-2 pr-1 sm:block">Demo</span>
              {presets.map((p) => (
                <PresetButton
                  key={p.id}
                  preset={p}
                  active={activePreset === p.id}
                  disabled={disabled}
                  onClick={() => onPreset?.(p)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Right: Bobcoins ───────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-[9px] uppercase tracking-[0.18em] text-slate-600 xl:inline">
            Multi-Agent QA Orchestrator
          </span>
          {bobcoinsSaved != null && (
            <div className="neon-rim flex items-center gap-2 rounded-lg bg-slate-900/70 px-2.5 py-1.5">
              <span className="relative flex items-center gap-2">
                <CoinIcon className="h-3.5 w-3.5 text-yellow-300" />
                <span className="hidden text-[9px] uppercase tracking-[0.14em] text-slate-400 sm:inline">
                  Bobcoins saved
                </span>
                <span className="num text-sm font-bold text-yellow-200 text-glow-gold">
                  {Math.round(bobcoinsSaved)}%
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function StatusPill({ connected }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
        connected
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-700 bg-slate-800/40 text-slate-500'
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-emerald-400" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            connected ? 'bg-emerald-400' : 'bg-slate-600'
          }`}
          style={connected ? { boxShadow: '0 0 8px #34d399' } : undefined}
        />
      </span>
      <PulseIcon className="h-3 w-3 opacity-70" />
      {connected ? 'SSE Connected' : 'SSE Idle'}
    </span>
  )
}

function PresetButton({ preset, active, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={preset.description}
      className={`group relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold
                  transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40
                  ${
                    active
                      ? 'border-transparent text-slate-950'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-100'
                  }`}
      style={
        active
          ? {
              background: `linear-gradient(135deg, ${preset.accentColor} 0%, ${preset.accentColor}dd 100%)`,
              boxShadow: `0 0 16px ${preset.glowColor}, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }
          : undefined
      }
    >
      {!active && (
        <span
          className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ boxShadow: `inset 0 0 0 1px ${preset.accentColor}55, 0 0 12px ${preset.glowColor}` }}
        />
      )}
      <span className="relative flex items-center gap-1.5">
        <span style={{ color: active ? 'currentColor' : preset.accentColor }}>{preset.icon}</span>
        {preset.label}
      </span>
    </button>
  )
}
