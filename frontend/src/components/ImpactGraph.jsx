import { useMemo, useState } from 'react'
import { fileMeta, languageOf, severityTheme } from '../lib/design.js'
import { ChevronIcon, FileIcon, FolderIcon, RadarIcon, AlertIcon } from './Icons.jsx'

/**
 * ImpactGraph — impacted-module explorer.
 *
 * Builds an interactive file tree from `summary.impacted_modules`
 * (`{ path, severity, reason }[]`, emitted by the ImpactAgent) and paints each
 * leaf with its risk level. Folders collapse single-child chains so
 * `app > auth > jwt_handler.py` reads as `app/auth/jwt_handler.py`.
 *
 * Props
 * -----
 * summary  object  Pipeline summary from POST /api/v1/run
 * running  boolean Pipeline is in-flight
 */

const SEVERITIES = ['critical', 'high', 'medium', 'low']

export default function ImpactGraph({ summary, running = false }) {
  const modules = useMemo(
    () => (Array.isArray(summary?.impacted_modules) ? summary.impacted_modules : []),
    [summary],
  )

  const tree = useMemo(() => buildTree(modules), [modules])
  const languages = useMemo(() => {
    const set = new Set()
    modules.forEach((m) => {
      const lang = languageOf(m.path)
      if (lang) set.add(lang)
    })
    return [...set]
  }, [modules])

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 }
    modules.forEach((m) => {
      const s = severityTheme(m.severity)
      if (c[s.label.toLowerCase()] !== undefined) c[s.label.toLowerCase()] += 1
    })
    return c
  }, [modules])

  if (modules.length === 0) {
    return (
      <section className="glass-panel overflow-hidden">
        <PanelHeader count={0} />
        <ImpactEmpty running={running} />
      </section>
    )
  }

  return (
    <section className="glass-panel overflow-hidden">
      <PanelHeader count={modules.length} />

      {/* Severity legend with live counts */}
      <div className="flex flex-wrap gap-1 border-b border-slate-800 px-3 py-2">
        {SEVERITIES.map((s) => {
          const meta = severityTheme(s)
          const n = counts[s] ?? 0
          return (
            <span
              key={s}
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-opacity ${
                n > 0 ? meta.chip : 'border-slate-800 bg-slate-900/50 text-slate-600'
              } ${n > 0 ? meta.text : ''}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: n > 0 ? meta.color : '#334155' }}
              />
              {meta.label}
              <span className="num font-bold text-slate-300">{n}</span>
            </span>
          )
        })}
      </div>

      {/* File tree */}
      <div className="cyber-scroll max-h-[420px] overflow-y-auto px-2 py-2">
        <TreeNodes nodes={tree} depth={0} />
      </div>

      {/* Detected languages */}
      {languages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-800 px-3 py-2">
          <span className="eyebrow mr-1">Stack</span>
          {languages.map((lang) => (
            <span key={lang} className="chip text-cyan-200/90">
              {lang}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function PanelHeader({ count }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
      <RadarIcon className="h-3.5 w-3.5 text-cyan-300" />
      <h2 className="eyebrow">Impacted Modules</h2>
      {count > 0 && (
        <span className="num ml-auto rounded border border-slate-800 bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
          {count}
        </span>
      )}
    </div>
  )
}

/* ── Tree ────────────────────────────────────────────────────────────── */

function TreeNodes({ nodes, depth }) {
  return (
    <ul className="space-y-px">
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} depth={depth} />
      ))}
    </ul>
  )
}

function TreeNode({ node, depth }) {
  const isDir = node.type === 'dir'
  const [open, setOpen] = useState(depth < 2)
  const meta = severityTheme(node.module?.severity)
  const file = isDir ? null : fileMeta(node.path)

  const hiddenCount = countFiles(node) - 1

  return (
    <li className="animate-fade-slide-right" style={{ animationDelay: `${Math.min(depth * 30, 180)}ms` }}>
      <button
        type="button"
        onClick={() => isDir && setOpen((v) => !v)}
        disabled={!isDir}
        title={node.path + (node.module?.reason ? ` — ${node.module.reason}` : '')}
        className={`group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors ${
          isDir ? 'hover:bg-slate-800/50' : 'cursor-default hover:bg-slate-800/30'
        }`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {isDir ? (
          <>
            <ChevronIcon open={open} className="h-3 w-3 shrink-0 text-slate-600" />
            <FolderIcon open={open} className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate font-mono text-[11px] text-slate-300">{node.name}</span>
            <span className="num ml-auto shrink-0 text-[9px] text-slate-600">
              {hiddenCount} {hiddenCount === 1 ? 'file' : 'files'}
            </span>
          </>
        ) : (
          <>
            <span className="h-3 w-3 shrink-0" />
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            <span className="truncate font-mono text-[11px] text-slate-400">{node.name}</span>

            {/* Extension chip */}
            <span
              className="shrink-0 rounded px-1 py-px text-[8px] font-bold tracking-wider"
              style={{ color: file.color, background: `${file.color}1a` }}
            >
              {file.label}
            </span>

            {/* Severity pill */}
            <span
              className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wider ${meta.chip} ${meta.text}`}
              style={{ boxShadow: `0 0 8px ${meta.glow.replace('0.4', '0.15')}` }}
            >
              {meta.label}
            </span>
          </>
        )}
      </button>

      {isDir && open && node.children.length > 0 && (
        <TreeNodes nodes={node.children} depth={depth + 1} />
      )}
    </li>
  )
}

/**
 * Build a nested tree from flat paths, then merge directories that have
 * exactly one directory child so the tree reads like an editor sidebar.
 */
function buildTree(modules) {
  const root = { type: 'dir', name: '', path: '', children: [] }

  for (const m of modules) {
    const parts = String(m.path ?? '')
      .split(/[\\/]/)
      .filter(Boolean)
    if (parts.length === 0) continue

    let node = root
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')
      let child = node.children.find((c) => c.name === part && c.type === (isLeaf ? 'file' : 'dir'))

      if (!child) {
        child = isLeaf
          ? { type: 'file', name: part, path, module: m, children: [] }
          : { type: 'dir', name: part, path, module: null, children: [] }
        node.children.push(child)
      }
      node = child
    })
  }

  sortTree(root)
  return collapseChains(root.children)
}

function sortTree(node) {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  node.children.forEach(sortTree)
  return node
}

/** Merge `a > b > file` into `a/b` when each level has a single child. */
function collapseChains(nodes) {
  return nodes.map((node) => {
    if (node.type !== 'dir') return node
    let current = node
    while (current.children.length === 1 && current.children[0].type === 'dir') {
      const only = current.children[0]
      current = {
        ...only,
        name: `${current.name}/${only.name}`,
        path: only.path,
        children: only.children,
      }
    }
    return { ...current, children: collapseChains(current.children) }
  })
}

function countFiles(node) {
  if (node.type === 'file') return 1
  return node.children.reduce((acc, c) => acc + countFiles(c), 0)
}

/* ── Empty state ─────────────────────────────────────────────────────── */

function ImpactEmpty({ running }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      {/* Dimmed module-tree illustration */}
      <svg width="132" height="104" viewBox="0 0 132 104" fill="none" aria-hidden="true" className="mb-4">
        <defs>
          <linearGradient id="idle-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Connectors */}
        <path
          d="M30 26v14M30 40h-12M30 40h14M30 62v12M30 74h-12M30 74h14"
          stroke="url(#idle-fade)"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          className="animate-dash-flow"
          style={{ animation: running ? undefined : 'none', opacity: 0.6 }}
        />

        {/* Root node */}
        <rect x="18" y="12" width="24" height="14" rx="4" fill="#0f172a" stroke="rgba(34,211,238,0.4)" />
        <path d="M24 17h12M24 21h7" stroke="rgba(34,211,238,0.55)" strokeWidth="1.2" strokeLinecap="round" />

        {/* Child nodes */}
        <rect x="8" y="40" width="20" height="12" rx="3.5" fill="#0f172a" stroke="#1e293b" />
        <rect x="34" y="40" width="20" height="12" rx="3.5" fill="#0f172a" stroke="#1e293b" />
        <rect x="8" y="74" width="20" height="12" rx="3.5" fill="#0f172a" stroke="#1e293b" />
        <rect x="34" y="74" width="20" height="12" rx="3.5" fill="#0f172a" stroke="#1e293b" />

        {/* Scanner ring */}
        <circle cx="30" cy="19" r="3" fill="#22d3ee" opacity="0.9" />
        <circle cx="30" cy="19" r="6" stroke="#22d3ee" strokeWidth="0.8" opacity="0.4" />
      </svg>

      <p className="text-[12px] font-medium text-slate-400">Esperando ejecución del pipeline…</p>
      <p className="mt-1 max-w-[240px] text-[10.5px] leading-relaxed text-slate-600">
        The ImpactAgent maps the blast radius of your diff here — every changed
        file, graded by risk.
      </p>

      {/* Skeleton rows */}
      <div className="mt-5 w-full max-w-[220px] space-y-2" aria-hidden="true">
        <div className="flex items-center gap-2">
          <div className="skeleton h-3 w-3 rounded" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="flex items-center gap-2 pl-4">
          <div className="skeleton h-3 w-3 rounded" />
          <div className="skeleton h-3 flex-1" />
          <div className="skeleton h-3 w-10" />
        </div>
        <div className="flex items-center gap-2 pl-4">
          <div className="skeleton h-3 w-3 rounded" />
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-3 w-8" />
        </div>
      </div>

      {running && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
          <AlertIcon className="h-3 w-3 animate-pulse" />
          Scanning
        </p>
      )}
    </div>
  )
}
