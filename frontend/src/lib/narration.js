/**
 * Event narration — turns raw SSE payloads into presentable, structured cards.
 *
 * The orchestrator emits small, well-typed payloads (see
 * `backend/app/application/orchestrator.py`). Rather than dumping them with
 * `JSON.stringify`, each known shape is matched and rendered as a headline
 * plus labelled facts / path lists. Unknown payloads fall back to a generic
 * key-value renderer so the UI never regresses to raw JSON.
 */

const fmtNum = (n) =>
  typeof n === 'number' && !Number.isInteger(n) ? n.toFixed(1) : String(n ?? 0)

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/* ── Public API ───────────────────────────────────────────────────────── */

/**
 * @param {{agent: string, event_type: string, payload: object}} evt
 * @returns {{kind: string, headline: string, detail?: string,
 *            facts: Array<{label: string, value: string, tone?: string}>,
 *            lists: Array<{label: string, items: string[], tone?: string}>}}
 */
export function narrate(evt) {
  const { agent, event_type: type, payload = {} } = evt ?? {}

  const handler =
    AGENT_ROUTES[agent]?.[type] ??
    AGENT_ROUTES[agent]?._ ??
    (type === 'completed' ? genericCompleted : generic)

  return normalize(handler(payload, evt))
}

function normalize(result) {
  return {
    kind: result?.kind ?? 'generic',
    headline: result?.headline ?? '',
    detail: result?.detail ?? null,
    facts: result?.facts ?? [],
    lists: result?.lists ?? [],
  }
}

/* ── Orchestrator ─────────────────────────────────────────────────────── */
const ORCHESTRATOR = {
  _({ step, base, head }) {
    if (step === 'diff') {
      return {
        kind: 'plan',
        headline: 'Pipeline started',
        detail: 'Resolving the code diff between the two refs.',
        facts: [
          { label: 'base', value: base ?? '—' },
          { label: 'head', value: head ?? '—' },
        ],
      }
    }
    return { kind: 'plan', headline: `Step: ${step ?? 'unknown'}` }
  },

  started(p) {
    if (p.step === 'diff') {
      return {
        kind: 'plan',
        headline: 'Pipeline initialised',
        detail: 'Fetching the unified diff locally — no LLM tokens spent.',
        facts: [
          { label: 'base', value: p.base ?? '—' },
          { label: 'head', value: p.head ?? '—' },
        ],
      }
    }
    return { kind: 'plan', headline: `Step: ${p.step ?? 'unknown'}` }
  },

  progress(p) {
    if (p.step === 'diff') {
      const n = p.files_changed ?? 0
      return {
        kind: 'metric',
        headline: `${plural(n, 'file')} changed`,
        detail: 'Diff captured. Handing the change set to the ImpactAgent.',
        facts: [{ label: 'files changed', value: fmtNum(n), tone: 'cyan' }],
      }
    }

    if (p.step === 'test_run' && Array.isArray(p.test_files)) {
      return {
        kind: 'list',
        headline: `${plural(p.test_files.length, 'test file')} written`,
        detail: 'Generated tests persisted to disk, ready for execution.',
        lists: [{ label: 'written', items: p.test_files }],
      }
    }

    if (p.step === 'test_run') {
      const passed = p.passed ?? 0
      const failed = p.failed ?? 0
      return {
        kind: 'metric',
        headline: failed > 0 ? `${failed} failing` : 'Suite green',
        detail:
          failed > 0
            ? 'Failures detected — routing the broken tests to the HealingAgent.'
            : 'Every generated test passed on the first attempt.',
        facts: [
          { label: 'passed', value: fmtNum(passed), tone: 'green' },
          { label: 'failed', value: fmtNum(failed), tone: failed > 0 ? 'red' : 'slate' },
          { label: 'coverage', value: `${fmtNum(p.coverage_percent)}%`, tone: 'cyan' },
        ],
      }
    }

    return genericProgress(p)
  },

  completed(p) {
    // The final event payload is the whole RunResponse — render it as a verdict.
    if (!('coverage_percent' in p)) return genericCompleted(p)

    const failed = p.failed ?? 0
    return {
      kind: 'result',
      headline: failed === 0 ? 'Pipeline completed — QA approved' : 'Pipeline completed with failures',
      detail: p.analysis_summary ?? null,
      facts: [
        { label: 'coverage', value: `${fmtNum(p.coverage_percent)}%`, tone: 'cyan' },
        { label: 'tests', value: `${p.passed ?? 0}P / ${failed}F`, tone: failed > 0 ? 'red' : 'green' },
        { label: 'generated', value: fmtNum(p.tests_generated), tone: 'green' },
        { label: 'healed', value: fmtNum(p.tests_healed), tone: 'amber' },
        { label: 'bobcoins saved', value: `${fmtNum(p.bobcoins_saved)}%`, tone: 'gold' },
        { label: 'diff sha', value: p.diff_sha ?? '—' },
      ],
    }
  },
}

/* ── ImpactAgent ──────────────────────────────────────────────────────── */
const IMPACT_AGENT = {
  started({ diff_sha }) {
    return {
      kind: 'plan',
      headline: 'Impact scan started',
      detail: 'Scoring the change set for blast radius and risk.',
      facts: diff_sha ? [{ label: 'diff sha', value: diff_sha }] : [],
    }
  },

  completed(p) {
    const modules = normalizeModules(p.modules)
    const n = p.modules_impacted ?? modules.length
    return {
      kind: 'narrative',
      headline: `${plural(n, 'module')} classified`,
      detail: p.summary || null,
      facts: [{ label: 'impacted', value: fmtNum(n), tone: 'cyan' }],
      lists: modules.length
        ? [
            {
              label: 'risk register',
              items: modules.map((m) => `${severityGlyph(m.severity)} ${m.path}`),
            },
          ]
        : [],
    }
  },
}

/* ── GeneratorAgent ───────────────────────────────────────────────────── */
const GENERATOR_AGENT = {
  started(p) {
    const modules = normalizeModules(p.modules)
    return {
      kind: 'list',
      headline: `Coverage gaps found in ${plural(modules.length, 'module')}`,
      detail: 'Synthesising pytest suites to close the missing coverage.',
      lists: modules.length ? [{ label: 'targets', items: modules.map((m) => m.path) }] : [],
    }
  },

  completed({ tests_generated }) {
    const n = tests_generated ?? 0
    return {
      kind: 'metric',
      headline: `${plural(n, 'test')} generated`,
      detail: 'Test source produced by the LLM and written to the tests directory.',
      facts: [{ label: 'generated', value: fmtNum(n), tone: 'green' }],
    }
  },
}

/* ── HealingAgent ─────────────────────────────────────────────────────── */
const HEALING_AGENT = {
  started({ failing_tests }) {
    const n = failing_tests ?? 0
    return {
      kind: 'narrative',
      headline: `${plural(n, 'failing test')} intercepted`,
      detail: 'Rewriting the broken assertions against the new API surface.',
      facts: [{ label: 'failing', value: fmtNum(n), tone: 'red' }],
    }
  },

  completed({ tests_healed }) {
    const n = tests_healed ?? 0
    return {
      kind: 'metric',
      headline: `${plural(n, 'test')} healed`,
      detail: 'Repaired tests re-executed against the patched source.',
      facts: [{ label: 'healed', value: fmtNum(n), tone: 'amber' }],
    }
  },
}

const AGENT_ROUTES = {
  Orchestrator: ORCHESTRATOR,
  ImpactAgent: IMPACT_AGENT,
  GeneratorAgent: GENERATOR_AGENT,
  HealingAgent: HEALING_AGENT,
}

/* ── Generic fallbacks ────────────────────────────────────────────────── */

function genericProgress(p) {
  return {
    kind: 'generic',
    headline: 'Progress update',
    facts: factsFrom(p),
  }
}

function genericCompleted(p) {
  return {
    kind: 'generic',
    headline: 'Step completed',
    facts: factsFrom(p),
  }
}

function generic(p, evt) {
  return {
    kind: 'generic',
    headline: evt?.payload?.message ?? 'Event received',
    facts: factsFrom(p),
  }
}

/** Flatten an object into labelled facts, skipping nested objects/arrays. */
function factsFrom(payload) {
  if (!payload || typeof payload !== 'object') return []
  return Object.entries(payload)
    .filter(([, v]) => v == null || typeof v !== 'object')
    .map(([k, v]) => ({ label: humanize(k), value: formatScalar(v), tone: toneForKey(k) }))
    .slice(0, 6)
}

/**
 * `modules` arrives as `string[]` from GeneratorAgent and as
 * `{path, severity, reason}[]` from ImpactAgent — accept both.
 */
function normalizeModules(modules) {
  if (!Array.isArray(modules)) return []
  return modules
    .map((m) => {
      if (typeof m === 'string') return { path: m, severity: null, reason: null }
      if (m && typeof m === 'object' && m.path) {
        return { path: m.path, severity: m.severity ?? null, reason: m.reason ?? null }
      }
      return null
    })
    .filter(Boolean)
}

function severityGlyph(severity) {
  switch (String(severity ?? '').toLowerCase()) {
    case 'critical':
      return '[!!]'
    case 'high':
      return '[! ]'
    case 'medium':
      return '[~ ]'
    case 'low':
      return '[  ]'
    default:
      return '[· ]'
  }
}

function humanize(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\bpct\b/i, '%')
}

function formatScalar(v) {
  if (v == null) return '—'
  if (typeof v === 'number') return fmtNum(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function toneForKey(key) {
  const k = key.toLowerCase()
  if (k.includes('fail')) return 'red'
  if (k.includes('pass') || k.includes('generated') || k.includes('healed')) return 'green'
  if (k.includes('coverage') || k.includes('sha') || k.includes('module')) return 'cyan'
  if (k.includes('bobcoin')) return 'gold'
  if (k.includes('step') || k.includes('base') || k.includes('head')) return 'violet'
  return undefined
}

/**
 * Build the Chain-of-Thought flow: one node per reasoning step, with the
 * agent that produced it and its supporting evidence.
 *
 * @returns {Array<{icon: string, agent: string, title: string,
 *                  body: string|null, facts: Array, lists: Array,
 *                  verdict?: boolean}>}
 */
export function buildReasoningFlow(events = []) {
  return events
    .map((evt) => {
      const n = narrate(evt)
      return {
        key: `${evt.session_id ?? 's'}-${evt.timestamp ?? ''}-${evt.agent}-${evt.event_type}`,
        agent: evt.agent,
        type: evt.event_type,
        title: n.headline,
        body: n.detail,
        facts: n.facts,
        lists: n.lists,
        verdict: n.kind === 'result',
        icon: iconFor(evt),
      }
    })
    .filter((node) => node.title)
}

function iconFor(evt) {
  if (evt.event_type === 'completed') return 'check'
  if (evt.agent === 'HealingAgent') return 'heal'
  if (evt.agent === 'GeneratorAgent') return 'spark'
  if (evt.agent === 'ImpactAgent') return 'radar'
  return 'brain'
}
