/**
 * Shared design tokens for the TEST-ARCHON dashboard.
 *
 * Single source of truth for the agent identity colours, the severity scale
 * and the file-extension iconography, so the terminal, the impact tree and
 * the session log never drift apart.
 */

/* ── Agent identity ─────────────────────────────────────────────────────
 * Every agent owns one hue. Used for badges, timeline rails, flow nodes and
 * glows so an event is recognisable by colour alone.
 */
export const AGENT_THEME = {
  Orchestrator: {
    label: 'ORCHESTRATOR',
    short: 'ORCH',
    text: 'text-violet-300',
    textHex: '#c4b5fd',
    border: 'border-violet-500/40',
    bg: 'bg-violet-500/10',
    glow: 'rgba(167, 139, 250, 0.45)',
  },
  ImpactAgent: {
    label: 'IMPACT AGENT',
    short: 'IMPACT',
    text: 'text-cyan-300',
    textHex: '#67e8f9',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
    glow: 'rgba(34, 211, 238, 0.45)',
  },
  GeneratorAgent: {
    label: 'GENERATOR AGENT',
    short: 'GEN',
    text: 'text-emerald-300',
    textHex: '#6ee7b7',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    glow: 'rgba(52, 211, 153, 0.45)',
  },
  HealingAgent: {
    label: 'HEALING AGENT',
    short: 'HEAL',
    text: 'text-amber-300',
    textHex: '#fcd34d',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    glow: 'rgba(251, 191, 36, 0.45)',
  },
}

export const AGENT_ORDER = [
  'Orchestrator',
  'ImpactAgent',
  'GeneratorAgent',
  'HealingAgent',
]

export function agentTheme(agent) {
  return (
    AGENT_THEME[agent] ?? {
      label: agent ?? 'UNKNOWN',
      short: '—',
      text: 'text-slate-400',
      textHex: '#94a3b8',
      border: 'border-slate-700',
      bg: 'bg-slate-800/40',
      glow: 'rgba(148, 163, 184, 0.4)',
    }
  )
}

/* ── Event lifecycle ──────────────────────────────────────────────────── */
export const EVENT_THEME = {
  started: { label: 'STARTED', textHex: '#93c5fd', chip: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
  progress: { label: 'PROGRESS', textHex: '#cbd5e1', chip: 'border-slate-600/50 bg-slate-700/30 text-slate-300' },
  completed: { label: 'COMPLETED', textHex: '#4ade80', chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  failed: { label: 'FAILED', textHex: '#f87171', chip: 'border-red-500/40 bg-red-500/10 text-red-300' },
}

export function eventTheme(type) {
  return EVENT_THEME[type] ?? EVENT_THEME.progress
}

/* ── Severity scale ───────────────────────────────────────────────────── */
export const SEVERITY_THEME = {
  critical: {
    label: 'CRITICAL',
    color: '#f87171',
    text: 'text-red-400',
    chip: 'border-red-500/40 bg-red-500/10',
    bar: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.4)',
    order: 4,
    ring: 'bg-red-400',
  },
  high: {
    label: 'HIGH',
    color: '#fb923c',
    text: 'text-orange-400',
    chip: 'border-orange-500/40 bg-orange-500/10',
    bar: '#f97316',
    glow: 'rgba(249, 115, 22, 0.4)',
    order: 3,
    ring: 'bg-orange-400',
  },
  medium: {
    label: 'MEDIUM',
    color: '#fbbf24',
    text: 'text-amber-400',
    chip: 'border-amber-500/40 bg-amber-500/10',
    bar: '#eab308',
    glow: 'rgba(234, 179, 8, 0.4)',
    order: 2,
    ring: 'bg-amber-400',
  },
  low: {
    label: 'LOW',
    color: '#4ade80',
    text: 'text-green-400',
    chip: 'border-green-500/40 bg-green-500/10',
    bar: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.4)',
    order: 1,
    ring: 'bg-green-400',
  },
}

export function severityTheme(severity) {
  return (
    SEVERITY_THEME[String(severity ?? '').toLowerCase()] ?? {
      label: 'UNKNOWN',
      color: '#64748b',
      text: 'text-slate-400',
      chip: 'border-slate-700 bg-slate-800/40',
      bar: '#475569',
      glow: 'rgba(71, 85, 105, 0.4)',
      order: 0,
      ring: 'bg-slate-500',
    }
  )
}

/* ── File-extension iconography ─────────────────────────────────────────
 * Extension → { label, colour }. Keeps the impact tree scannable without
 * pulling in an icon library.
 */
const EXT_META = {
  py:   { label: 'PY',   color: '#60a5fa' },
  pyi:  { label: 'PYI',  color: '#60a5fa' },
  js:   { label: 'JS',   color: '#fbbf24' },
  mjs:  { label: 'MJS',  color: '#fbbf24' },
  cjs:  { label: 'CJS',  color: '#fbbf24' },
  jsx:  { label: 'JSX',  color: '#38bdf8' },
  ts:   { label: 'TS',   color: '#3b82f6' },
  tsx:  { label: 'TSX',  color: '#60a5fa' },
  java: { label: 'JAVA', color: '#f97316' },
  kt:   { label: 'KT',   color: '#a78bfa' },
  go:   { label: 'GO',   color: '#22d3ee' },
  rs:   { label: 'RS',   color: '#fb923c' },
  rb:   { label: 'RB',   color: '#f87171' },
  php:  { label: 'PHP',  color: '#a78bfa' },
  cs:   { label: 'CS',   color: '#34d399' },
  c:    { label: 'C',    color: '#94a3b8' },
  h:    { label: 'H',    color: '#cbd5e1' },
  cpp:  { label: 'CPP',  color: '#818cf8' },
  sql:  { label: 'SQL',  color: '#c084fc' },
  sh:   { label: 'SH',   color: '#4ade80' },
  yml:  { label: 'YML',  color: '#94a3b8' },
  yaml: { label: 'YML',  color: '#94a3b8' },
  json: { label: 'JSON', color: '#facc15' },
  toml: { label: 'TOML', color: '#facc15' },
  md:   { label: 'MD',   color: '#64748b' },
  txt:  { label: 'TXT',  color: '#64748b' },
  html: { label: 'HTML', color: '#fb923c' },
  css:  { label: 'CSS',  color: '#38bdf8' },
}

const FALLBACK_EXT = { label: 'FILE', color: '#64748b' }

export function fileExtension(path) {
  const name = String(path ?? '').split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function fileMeta(path) {
  const ext = fileExtension(path)
  return EXT_META[ext] ?? FALLBACK_EXT
}

/** Map a file extension to a human language label, for the summary chips. */
const EXT_LANGUAGE = {
  py: 'Python', pyi: 'Python', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript', java: 'Java', kt: 'Kotlin',
  go: 'Go', rs: 'Rust', rb: 'Ruby', php: 'PHP', cs: 'C#', c: 'C', h: 'C',
  cpp: 'C++', sql: 'SQL', sh: 'Shell', yml: 'YAML', yaml: 'YAML', json: 'JSON',
  toml: 'TOML', md: 'Markdown', txt: 'Text', html: 'HTML', css: 'CSS',
}

export function languageOf(path) {
  return EXT_LANGUAGE[fileExtension(path)] ?? null
}
