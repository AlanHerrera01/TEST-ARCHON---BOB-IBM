import { renderToStaticMarkup } from 'react-dom/server'
import { narrate, buildReasoningFlow } from './src/lib/narration.js'
import { severityTheme, fileMeta, languageOf, agentTheme } from './src/lib/design.js'
import AgentTerminal from './src/components/AgentTerminal.jsx'
import CoverageCard from './src/components/CoverageCard.jsx'
import ImpactGraph from './src/components/ImpactGraph.jsx'
import HealDiffCard from './src/components/HealDiffCard.jsx'
import Header from './src/components/Header.jsx'
import App from './src/App.jsx'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { pass += 1 } else { fail += 1; console.log(`  FAIL: ${name} ${extra}`) }
}

/* ── Fixtures mirroring the real backend event sequence ───────────────── */
const S = 'sess-1'
const ev = (agent, event_type, payload, t) => ({
  session_id: S, agent, event_type, payload, timestamp: `2026-09-26T12:00:0${t}.000+00:00`,
})

const EVENTS = [
  ev('Orchestrator', 'started', { step: 'diff', base: 'main', head: 'feature/auth-refactor' }, 1),
  ev('Orchestrator', 'progress', { step: 'diff', files_changed: 3 }, 2),
  ev('ImpactAgent', 'started', { diff_sha: 'a1b2c3d' }, 3),
  ev('ImpactAgent', 'completed', {
    modules_impacted: 3,
    summary: 'Changes touch the authentication surface. High regression risk.',
    modules: [
      { path: 'app/auth/jwt_handler.py', severity: 'critical', reason: 'Heuristic: +40/-2 lines' },
      { path: 'app/auth/middleware.py', severity: 'critical', reason: 'auth pattern' },
      { path: 'app/api/v2/endpoints.py', severity: 'low', reason: 'Heuristic: +3/-1 lines' },
    ],
  }, 4),
  ev('GeneratorAgent', 'started', { modules: ['app/auth/jwt_handler.py', 'app/auth/middleware.py', 'app/api/v2/endpoints.py'] }, 5),
  ev('GeneratorAgent', 'completed', { tests_generated: 3 }, 6),
  ev('Orchestrator', 'progress', { step: 'test_run', test_files: ['./tests/test_jwt_handler_generated.py'] }, 7),
  ev('Orchestrator', 'progress', { step: 'test_run', passed: 2, failed: 1, coverage_percent: 87.5 }, 8),
  ev('HealingAgent', 'started', { failing_tests: 1 }, 9),
  ev('HealingAgent', 'completed', { tests_healed: 1 }, 0),
  ev('Orchestrator', 'completed', {
    session_id: S, diff_sha: 'a1b2c3d', files_changed: 3, modules_impacted: 3,
    impacted_modules: [
      { path: 'app/auth/jwt_handler.py', severity: 'critical', reason: 'auth' },
      { path: 'app/auth/middleware.py', severity: 'high', reason: 'auth' },
      { path: 'app/api/v2/endpoints.py', severity: 'low', reason: 'small' },
    ],
    tests_generated: 3, tests_healed: 1, passed: 3, failed: 0,
    coverage_percent: 87.5, analysis_summary: 'Auth surface hardened.',
    bobcoins_saved: 66.7,
  }, 1),
]

/* ── 1. Narration: no raw JSON, every event yields a headline ────────── */
console.log('\n[narration]')
const flow = buildReasoningFlow(EVENTS)
check('flow length matches events', flow.length === EVENTS.length, `got ${flow.length}`)
EVENTS.forEach((e, i) => {
  const n = narrate(e)
  check(`headline for ${e.agent}/${e.event_type}`, typeof n.headline === 'string' && n.headline.length > 0, JSON.stringify(n))
  check(`no JSON dump for ${e.agent}/${e.event_type}`, !n.headline.includes('{') && !n.headline.includes('"'))
})
check('impact summary prose surfaced', narrate(EVENTS[3]).detail?.includes('authentication surface'))
check('impact modules list rendered', narrate(EVENTS[3]).lists[0]?.items.length === 3)
check('generator modules (string[]) parsed', narrate(EVENTS[4]).lists[0]?.items[0] === 'app/auth/jwt_handler.py')
check('test_files list rendered', narrate(EVENTS[6]).lists[0]?.items.length === 1)
check('final event is kind=result', narrate(EVENTS[10]).kind === 'result')
check('failed-count tone is red', narrate(EVENTS[7]).facts.find((f) => f.label === 'failed')?.tone === 'red')
check('passed-count tone is green', narrate(EVENTS[7]).facts.find((f) => f.label === 'passed')?.tone === 'green')
check('bobcoins tone gold', narrate(EVENTS[10]).facts.find((f) => f.label.includes('bobcoins'))?.tone === 'gold')
check('unknown event does not crash', narrate(ev('MysteryAgent', 'failed', { a: 1 })).headline.length > 0)
check('empty payload does not crash', narrate(ev('Orchestrator', 'progress', {})).headline.length > 0)
check('null payload does not crash', narrate({ agent: 'X', event_type: 'progress', payload: null }).headline.length > 0)
check('no event_type does not crash', narrate({ agent: 'X' }).headline.length > 0)

/* ── 2. Design tokens ─────────────────────────────────────────────────── */
console.log('[design]')
check('critical severity order', severityTheme('critical').order === 4)
check('unknown severity safe', severityTheme('nonsense').order === 0)
check('undefined severity safe', severityTheme(undefined).label === 'UNKNOWN')
check('.py -> PY/Python', fileMeta('a/b/c.py').label === 'PY' && languageOf('c.py') === 'Python')
check('.java -> JAVA', fileMeta('Main.java').label === 'JAVA')
check('.js -> JS', fileMeta('x.js').label === 'JS')
check('no extension -> FILE', fileMeta('Makefile').label === 'FILE')
check('dotfile not treated as ext', fileMeta('.gitignore').label === 'FILE')
check('windows path ext', fileMeta('a\\b\\c.py').label === 'PY')
check('agent theme resolves', agentTheme('HealingAgent').short === 'HEAL')
check('unknown agent safe', agentTheme('Nope').short === '—')

/* ── 3. Component render smoke test (no browser) ──────────────────────── */
console.log('[render]')
const summary = EVENTS[10].payload
const heal = EVENTS.filter((e) => e.agent === 'HealingAgent')
const testFiles = ['./tests/test_jwt_handler_generated.py']

const renders = [
  ['App', <App key="a" />],
  ['Header', <Header key="h" connected bobcoinsSaved={66.7} presets={[]} />],
  ['Header no-coins', <Header key="h2" connected={false} bobcoinsSaved={null} presets={[]} />],
  ['CoverageCard data', <CoverageCard key="c" coverage={87.5} prevCoverage={62} passed={3} failed={0} generated={3} healed={1} bobcoinsSaved={66.7} />],
  ['CoverageCard empty', <CoverageCard key="c2" />],
  ['CoverageCard 0%', <CoverageCard key="c3" coverage={0} prevCoverage={null} passed={0} failed={4} generated={0} healed={0} bobcoinsSaved={0} />],
  ['CoverageCard 100%', <CoverageCard key="c4" coverage={100} prevCoverage={100} passed={9} failed={0} generated={9} healed={0} bobcoinsSaved={88.8} />],
  ['AgentTerminal live', <AgentTerminal key="t" events={EVENTS} running connected />],
  ['AgentTerminal empty', <AgentTerminal key="t2" events={[]} running={false} connected={false} />],
  ['ImpactGraph data', <ImpactGraph key="i" summary={summary} />],
  ['ImpactGraph empty', <ImpactGraph key="i2" summary={null} running />],
  ['ImpactGraph empty list', <ImpactGraph key="i3" summary={{ impacted_modules: [] }} />],
  ['ImpactGraph multi-lang', <ImpactGraph key="i4" summary={{ impacted_modules: [
    { path: 'src/main/java/com/ibm/auth/TokenService.java', severity: 'critical', reason: 'token' },
    { path: 'src/auth/jwt.js', severity: 'medium', reason: 'auth' },
    { path: 'docs/readme.md', severity: 'low', reason: 'docs' },
  ] }} />],
  ['HealDiffCard', <HealDiffCard key="d" healEvents={heal} testFiles={testFiles} />],
  ['HealDiffCard none', <HealDiffCard key="d2" healEvents={[]} testFiles={[]} />],
]

for (const [name, node] of renders) {
  try {
    const html = renderToStaticMarkup(node)
    // HealDiffCard intentionally renders nothing when there is nothing to show.
    const expectEmpty = name === 'HealDiffCard none'
    check(`${name} renders`, expectEmpty ? html === '' : html.length > 0)
    if (name === 'CoverageCard data') {
      check('donut gradient id present', /cov-grad/.test(html))
      check('big pct rendered', html.includes('>88<') || html.includes('>87<'))
      check('QA approved badge', /QA Approved/i.test(html))
      check('neon-rim on bobcoins', /neon-rim/.test(html))
    }
    if (name === 'AgentTerminal live') {
      check('all 4 agent badges', ['Orchestrator', 'ImpactAgent', 'GeneratorAgent', 'HealingAgent'].every((a) => html.includes(a)))
      check('no raw JSON in live view', !html.includes('&quot;files_changed&quot;') && !html.includes('&quot;modules_impacted&quot;'))
      check('narration headline shown', html.includes('Impact scan started') || html.includes('Pipeline initialised'))
    }
    if (name === 'ImpactGraph data') {
      check('file tree leaves rendered', html.includes('jwt_handler.py') && html.includes('endpoints.py'))
      check('severity labels rendered', /CRITICAL/.test(html) && /LOW/.test(html))
      check('collapsed chain app/auth', html.includes('app/auth'))
      check('extension chip PY', html.includes('>PY<'))
      check('stack language chip', html.includes('Python'))
    }
    if (name === 'ImpactGraph multi-lang') {
      check('.java chip rendered', html.includes('>JAVA<'))
      check('.js chip rendered', html.includes('>JS<'))
      check('java language chip', html.includes('Java') && html.includes('JavaScript'))
      check('distinct severities coloured', /CRITICAL/.test(html) && /MEDIUM/.test(html) && /LOW/.test(html))
    }
    if (name === 'ImpactGraph empty') {
      check('spanish empty-state message', html.includes('Esperando ejecuci'))
    }
  } catch (e) {
    fail += 1
    console.log(`  THROW in ${name}: ${e.message}`)
  }
}

/* ── 4. Tree-shape edge cases ─────────────────────────────────────────── */
console.log('[tree edges]')
const treeCases = [
  ['single file', [{ path: 'main.py', severity: 'low' }]],
  ['deep single chain', [{ path: 'a/b/c/d/e.py', severity: 'high' }]],
  ['mixed depths', [{ path: 'app/auth/x.py', severity: 'critical' }, { path: 'README.md', severity: 'low' }]],
  ['windows separators', [{ path: 'app\\auth\\jwt.py', severity: 'critical' }]],
  ['duplicate paths', [{ path: 'a.py', severity: 'low' }, { path: 'a.py', severity: 'high' }]],
  ['trailing slash', [{ path: 'dir/', severity: 'low' }]],
  ['no severity', [{ path: 'x.py' }]],
  ['empty path', [{ path: '', severity: 'low' }]],
  ['unicode path', [{ path: 'src/âmbito/cafÃ©.py', severity: 'medium' }]],
]
for (const [label, mods] of treeCases) {
  try {
    const html = renderToStaticMarkup(<ImpactGraph key={label} summary={{ impacted_modules: mods }} />)
    check(`tree: ${label}`, html.length > 0)
  } catch (e) {
    fail += 1
    console.log(`  THROW tree "${label}": ${e.message}`)
  }
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
