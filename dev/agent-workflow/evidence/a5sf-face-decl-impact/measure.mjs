#!/usr/bin/env node
/**
 * measure.mjs — the impact table behind `README.md` (a5sf-face-decl-impact).
 *
 * WHAT THIS MEASURES (and what it does NOT):
 *   1. A CENSUS of every composition and agent-preset source in this tree, plus
 *      the pinned host's shipped presets when a pinned host tree is present
 *      (`tests/paths.mjs` → `tests/deepseek-harness-test-use`). For each one:
 *      which rows it mounts, whether it mounts a persistent shell, whether it
 *      publishes a `terminals` service, and what it would need to declare the
 *      governed faces.
 *   2. A BLAST-RADIUS COUNT over the test suite: every in-tree file that mounts
 *      the one persistent-shell preset shape, and every world-factory suite
 *      that names it.
 *   3. THREE DRIFT PROBES against the shipped declaration surface (real imports,
 *      no re-implementation): the compiled product answer carries no face; the
 *      product declaration refuses a narrowed network lane; the product
 *      declaration refuses a binding-scoped process face. These restate limits
 *      that `product-assembly.ts` documents and `a5sf-product-assembly.test.mjs`
 *      (PA4) and PD-12 residual (4) already pin — they are here so THIS table
 *      fails loudly if one of them is lifted, not as a new claim.
 *   4. An EXEMPLAR shape check: the proposed preset/patch files parse, the
 *      proposed provider module's imports resolve at its proposed product
 *      location, and the declared face spec satisfies the shipped installer's
 *      four preconditions (absolute program / subprocess face present / shell
 *      class admits the program / no legacy `terminals` on the Member scope).
 *
 * It does NOT boot a Host (0 boots), does NOT mount a Cordis realm, and does
 * NOT claim that the exemplar composes on a live Host. Every consequence that
 * is a code fact is cited with `file:line` in README.md.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-face-decl-impact/measure.mjs
 *      node dev/agent-workflow/evidence/a5sf-face-decl-impact/measure.mjs --check
 *        (--check = compare against the committed impact-table.json and exit 1
 *         on any difference; that is the machine-checkable gate.)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const OUT = join(HERE, 'impact-table.json')
const CHECK = process.argv.includes('--check')

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO, 'scripts', 'run-tests-hooks.mjs')).href)

const runtimeRequire = createRequire(join(REPO, 'packages', 'runtime', 'package.json'))
const YAML = await import(pathToFileURL(runtimeRequire.resolve('yaml')).href)

// ─────────────────────────────────────────────────────────────────────────────
// YAML that carries `!!js` (the Loader dialect) must still be readable: the
// tag is recorded as an opaque value, never evaluated.
// ─────────────────────────────────────────────────────────────────────────────
const jsTag = {
  tag: 'tag:yaml.org,2002:js',
  resolve: (value) => `!!js ${String(value)}`,
}

function parseYamlFile(path) {
  try {
    return { ok: true, value: YAML.parse(readFileSync(path, 'utf8'), { customTags: [jsTag] }) }
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) }
  }
}

/** Every row an entry list declares, flattened, with its nested plugin list. */
function walkRows(entries, out = []) {
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry === null || typeof entry !== 'object') continue
    const id = typeof entry.id === 'string' ? entry.id : null
    const name = typeof entry.name === 'string' ? entry.name : null
    const config = entry.config
    const isolate = entry.isolate !== undefined && entry.isolate !== null && typeof entry.isolate === 'object'
      ? Object.keys(entry.isolate)
      : []
    const group = entry.group === true || Array.isArray(config)
    const configId = config !== null && typeof config === 'object' && !Array.isArray(config) && typeof config.id === 'string'
      ? config.id
      : null
    out.push({
      id,
      name,
      configId,
      group,
      isolate,
      configKeys: config !== null && typeof config === 'object' && !Array.isArray(config) ? Object.keys(config) : [],
    })
    if (Array.isArray(entry.config)) walkRows(entry.config, out)
    if (Array.isArray(entry.plugins)) walkRows(entry.plugins, out)
    // A preset DECLARATION row carries its subtree under `config.plugins`.
    if (config !== null && typeof config === 'object' && !Array.isArray(config) && Array.isArray(config.plugins)) {
      walkRows(config.plugins, out)
    }
  }
  return out
}

/** Row name → the shell facts this lane cares about. */
const TERMINALS_PRODUCER = '@deepseek-ai/dsh-terminal'
const PERSISTENT_BASH = '@deepseek-ai/dsh-tool-bash-persistent'
const TRANSIENT_BASH = '@deepseek-ai/dsh-tool-bash'
const PERSISTENT_PWSH = '@deepseek-ai/dsh-tool-pwsh-persistent'
const TRANSIENT_PWSH = '@deepseek-ai/dsh-tool-pwsh'

function shellFactsOf(rows) {
  const names = rows.map((row) => row.name).filter((name) => typeof name === 'string')
  return {
    terminalsProducer: names.includes(TERMINALS_PRODUCER),
    persistentBash: names.includes(PERSISTENT_BASH) || names.includes(PERSISTENT_PWSH),
    transientBash: names.includes(TRANSIENT_BASH) || names.includes(TRANSIENT_PWSH),
    isolateRealms: [...new Set(rows.flatMap((row) => row.isolate))].sort(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CENSUS
// ─────────────────────────────────────────────────────────────────────────────

/** In-tree sources: every tracked Cordis composition / preset file, minus evidence. */
function inTreeSources() {
  const listed = execFileSync('git', ['-C', REPO, 'ls-files', '*.yml', '*.yaml'], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => path !== '')
    .filter((path) => !path.startsWith('dev/agent-workflow/evidence/'))
  return listed.filter((path) => {
    const base = path.split('/').pop() ?? ''
    if (base === 'cordis.yml' || base === 'cordis.patch.yml' || base.endsWith('.patch.yml')) return true
    if (base === 'agent.cordis.yml') return true
    if (path.includes('/presets/')) return true
    return false
  })
}

function describeYamlSource(path) {
  const parsed = parseYamlFile(join(REPO, path))
  if (!parsed.ok) return { path, kind: 'unreadable', parseError: parsed.error }
  const entries = parsed.value
  const inserts = []
  const overrides = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry !== null && typeof entry === 'object' && Array.isArray(entry.insert)) inserts.push(...entry.insert)
    else if (entry !== null && typeof entry === 'object' && typeof entry.id === 'string') overrides.push(entry)
  }
  // A bare entry list (a preset's `agent.cordis.yml`, a profile root's `[]`).
  if (inserts.length === 0 && overrides.length === 0 && Array.isArray(entries)) inserts.push(...entries)
  const rows = walkRows(inserts)
  const teamRows = rows.filter((row) => typeof row.name === 'string' && row.name.includes('dsh-agent-team'))
  const presetRows = rows.filter((row) => row.name === '@deepseek-ai/dsh-agent-preset')
  const teamConfigKeys = teamRows.flatMap((row) => row.configKeys)
  return {
    path,
    kind: presetRows.length > 0 ? 'preset-declaration' : 'composition-layer',
    rowIds: rows.map((row) => row.id).filter((id) => typeof id === 'string'),
    presetIds: presetRows.map((row) => row.configId ?? row.id).filter(Boolean),
    teamRowPresent: teamRows.length > 0,
    teamRowKeys: [...new Set(teamConfigKeys)].sort(),
    declaresA5sfKeys: teamConfigKeys.filter((key) => key.startsWith('a5sf')).sort(),
    declaresPresetId: teamConfigKeys.filter((key) => key === 'rootPresetId' || key === 'memberPresetId').sort(),
    shell: shellFactsOf(rows),
  }
}

/** The pinned host's shipped presets + the deployment default (read-only, external). */
/** Row facts of one host bundle's composition (`packages/bundle/<dir>/cordis.patch.yml`). */
function hostBundleRows(dir) {
  const path = join(REPO, 'tests', 'deepseek-harness-test-use', 'packages', 'bundle', dir, 'cordis.patch.yml')
  if (!existsSync(path)) return { terminalsProducer: false, shellRows: [] }
  const parsed = parseYamlFile(path)
  if (!parsed.ok) return { terminalsProducer: false, shellRows: [], parseError: parsed.error }
  const rows = walkRows((parsed.value ?? []).flatMap((entry) => entry?.insert ?? []))
  return {
    terminalsProducer: rows.some((row) => row.name === TERMINALS_PRODUCER),
    shellRows: rows
      .filter((row) => [TERMINALS_PRODUCER, TRANSIENT_BASH, TRANSIENT_PWSH, 'sandbox-policy', 'subprocess'].includes(row.name))
      .map((row) => ({ id: row.id, name: row.name })),
  }
}

async function hostCensus() {
  const paths = await import(pathToFileURL(join(REPO, 'tests', 'paths.mjs')).href)
  const hostTree = join(REPO, paths.TEST_USE_REL)
  const cwd = join(hostTree, 'packages', 'bundle', 'web-app')
  if (!existsSync(join(cwd, 'cordis.patch.yml'))) {
    return { hostTreePresent: false, hostTree: paths.TEST_USE_REL, defaultPreset: null, presets: [] }
  }
  const bundle = parseYamlFile(join(cwd, 'cordis.patch.yml'))
  const bundleRows = walkRows(Array.isArray(bundle.ok ? bundle.value : []) ? (bundle.value ?? []).flatMap((entry) => entry?.insert ?? []) : [])
  // The registry row's own `config.default` is the deployment default preset.
  const registryRow = (Array.isArray(bundle.value) ? bundle.value : [])
    .flatMap((entry) => entry?.insert ?? [])
    .find((entry) => entry?.id === 'agent-preset-registry')
  const defaultPreset = registryRow?.config?.default ?? null
  const presets = []
  const presetsDir = join(cwd, 'presets')
  for (const base of readdirSync(presetsDir).sort()) {
    if (!base.endsWith('.patch.yml')) continue
    const parsed = parseYamlFile(join(presetsDir, base))
    if (!parsed.ok) {
      presets.push({ path: relative(REPO, join(presetsDir, base)), kind: 'unreadable', parseError: parsed.error })
      continue
    }
    const rows = walkRows((parsed.value ?? []).flatMap((entry) => entry?.insert ?? []))
    const presetRow = rows.find((row) => row.name === '@deepseek-ai/dsh-agent-preset')
    presets.push({
      path: relative(REPO, join(presetsDir, base)),
      kind: 'host-preset',
      presetId: presetRow?.configId ?? presetRow?.id ?? null,
      shell: shellFactsOf(rows),
      unconfinedHostShellRows: rows
        .filter((row) => row.name === TRANSIENT_BASH || row.name === PERSISTENT_BASH || row.name === TERMINALS_PRODUCER)
        .map((row) => ({ id: row.id, name: row.name, isolate: row.isolate })),
    })
  }
  return {
    hostTreePresent: true,
    hostTree: paths.TEST_USE_REL,
    hostPin: paths.TEST_USE_BASELINE_SHA,
    defaultPreset,
    registryRow: registryRow === undefined ? null : { id: registryRow.id, name: registryRow.name, configKeys: Object.keys(registryRow.config ?? {}) },
    hostHostLevelRows: {
      // `dsh-base` + `dsh-web-app` are the bundles the shipped profile selects
      // (`opshome/.dsh/profiles/web/package.json`); a HOST-level `terminals`
      // producer would put `root.get('terminals')` behind EVERY Member realm and
      // make the confined terminal face refuse for all of them.
      bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
      perBundle: {
        'dsh-base': hostBundleRows('base').terminalsProducer,
        'dsh-web-app': bundleRows.some((row) => row.name === TERMINALS_PRODUCER),
      },
      terminalsProducerAtHostLevel: hostBundleRows('base').terminalsProducer
        || bundleRows.some((row) => row.name === TERMINALS_PRODUCER),
      hostShellRows: hostBundleRows('base').shellRows,
    },
    presets,
  }
}

/** In-tree preset BUILDERS (JS): the one persistent-shell shape and its consumers. */
function jsPresetBuilders() {
  const files = execFileSync('git', ['-C', REPO, 'ls-files', '*.mjs', '*.ts'], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => path !== '')
    .filter((path) => !path.startsWith('dev/agent-workflow/evidence/'))
  const hits = []
  for (const path of files) {
    const text = readFileSync(join(REPO, path), 'utf8')
    if (!text.includes(TERMINALS_PRODUCER) && !text.includes(PERSISTENT_BASH)) continue
    hits.push({
      path,
      mentionsTerminals: text.includes(TERMINALS_PRODUCER),
      mentionsPersistentBash: text.includes(PERSISTENT_BASH),
      mentionsTransientBash: text.includes(TRANSIENT_BASH),
      declaresIsolateTerminals: /isolate:\s*\{[^}]*terminals/u.test(text) || /terminals: true/u.test(text),
    })
  }
  return hits
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BLAST RADIUS (by name)
// ─────────────────────────────────────────────────────────────────────────────
function blastRadius() {
  const files = execFileSync('git', ['-C', REPO, 'ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => path !== '')
    .filter((path) => (path.startsWith('tests/') || path.startsWith('packages/')) && (path.endsWith('.mjs') || path.endsWith('.ts')))
  const direct = []
  const viaPresetSeam = []
  const mentionsOnly = []
  const namesPresetIds = []
  for (const path of files) {
    const text = readFileSync(join(REPO, path), 'utf8')
    if (text.includes(PERSISTENT_BASH) || text.includes(TERMINALS_PRODUCER) || text.includes("'persistent-shell'")) {
      direct.push(path)
    } else if (text.includes('persistentShellGroup') || text.includes('smokePresetPlugins')) {
      // Mounts the ONE shared shape by calling the seam module.
      viaPresetSeam.push(path)
    } else if (text.includes('persistent-shell')) {
      mentionsOnly.push(path)
    }
    if (/memberPresetId|rootPresetId/u.test(text)) namesPresetIds.push(path)
  }
  const suites = readdirSync(join(REPO, 'tests', 'world-factory'))
    .filter((base) => base.startsWith('a5sf-') && base.endsWith('.test.mjs'))
    .map((base) => {
      const text = readFileSync(join(REPO, 'tests', 'world-factory', base), 'utf8')
      return {
        suite: `tests/world-factory/${base}`,
        citesDoubleTerminalRefusal: text.includes('TERMINALS_DOUBLE_TERMINAL_REFUSED'),
        citesLegacyTerminals: text.includes('makeLegacyTerminals') || text.includes("provide('terminals'"),
      }
    })
  // Would a change to the SHIPPED row / default preset reach the a5sf family?
  // Every a5sf suite builds its own in-process root or its own profile patch, so
  // the shipped composition file is not an input to any of them — measured here.
  const a5sfSuitesReadingShippedRow = readdirSync(join(REPO, 'tests', 'world-factory'))
    .filter((base) => base.startsWith('a5sf-') && base.endsWith('.test.mjs'))
    .filter((base) => /cordis\.patch\.yml|opshome|memberPresetId/u.test(readFileSync(join(REPO, 'tests', 'world-factory', base), 'utf8')))
    .map((base) => `tests/world-factory/${base}`)
  return {
    direct,
    viaPresetSeam,
    mentionsOnly,
    a5sfSuitesReadingShippedRow,
    namesPresetIds: namesPresetIds.sort(),
    a5sfSuitesTouchingLegacyTerminals: suites.filter((suite) => suite.citesDoubleTerminalRefusal || suite.citesLegacyTerminals),
    a5sfSuiteCount: suites.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DRIFT PROBES (documented limits, re-asserted)
// ─────────────────────────────────────────────────────────────────────────────
const PROBE_TEAM = 'a5sf-face-decl-probe'
const PROBE_CEILING = Object.freeze({
  read: Object.freeze({ mode: 'restricted', allow: Object.freeze(['/tmp/probe']), ask: Object.freeze([]), deny: Object.freeze([]) }),
  write: Object.freeze({ mode: 'restricted', allow: Object.freeze(['/tmp/probe']), ask: Object.freeze([]), deny: Object.freeze([]) }),
  network: Object.freeze({ mode: 'allow' }),
})
/** The bound blueprint, in the shape the PA suite uses (v4 + memberIoCeilings). */
const BLUEPRINT = `---\n${JSON.stringify({
  schemaVersion: 4,
  blueprintId: PROBE_TEAM,
  revision: '1',
  leader: { templateId: 'leader', persona: 'Lead.' },
  members: [{ templateId: 'worker', persona: 'Worker.' }],
  requirements: [],
  memberEnvelopes: [],
  policyStates: [],
  permissionMutationEnvelope: { rules: [] },
  teamHardEnvelope: { rules: [] },
  metadata: {},
  memberIoCeilings: [{ templateId: 'worker', io: PROBE_CEILING }],
}, null, 2)}\n---\n`

function declaration({ network = 'allow', executionBoundary = null } = {}) {
  return {
    schema: 'a5sf-product-member-policies/1',
    teamId: PROBE_TEAM,
    blueprintRevision: '1',
    authority: { revision: 'probe-r1', admitted: true },
    members: [{
      templateId: 'worker',
      instanceGeneration: 1,
      ceiling: {
        read: { mode: 'restricted', allow: ['/tmp/probe'], ask: [], deny: [] },
        write: { mode: 'restricted', allow: ['/tmp/probe'], ask: [], deny: [] },
        network: { mode: network },
      },
      ...(executionBoundary === null ? {} : {
        toolRestrictions: [{
          owner: 'dsh.subprocess',
          name: 'exec',
          authorization: 'ask',
          io: {
            read: { mode: 'restricted', allow: ['/tmp/probe'], ask: [], deny: [] },
            write: { mode: 'all', deny: [] },
            network: { mode: 'allow' },
          },
          execution: { implementationOrigin: 'dsh-native', executionBoundary },
        }],
      }),
    }],
  }
}

async function driftProbes() {
  const assembly = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'team-services', 'src', 'product-assembly.ts')).href)
  const probes = {}

  // P1 — the accepted declaration's compiled answer carries NO process/terminal/web face.
  const plan = assembly.parseProductRealmDeclaration(declaration(), { blueprintSource: BLUEPRINT })
  const provider = assembly.createProductRealmProvider(plan)
  const answer = provider.compiledFor({ templateId: 'worker', instanceId: 'probe-member', sessionId: 'probe-session', teamRootSessionId: 'probe-root' })
  probes.compiledAnswerKeys = answer === undefined ? null : Object.keys(answer).sort()
  probes.compiledAnswerCarriesFaces = answer === undefined
    ? null
    : ['subprocess', 'terminal', 'web'].filter((key) => Object.hasOwn(answer, key))

  // P2 — a narrowed network lane is REFUSED at row assembly (no web face installed).
  probes.networkDenyRefusal = refusalOf(() => assembly.parseProductRealmDeclaration(declaration({ network: 'deny' }), { blueprintSource: BLUEPRINT }))

  // P3 — a binding-scoped PROCESS face is REFUSED at row assembly (no process face owned).
  probes.confinedSubprocessRefusal = refusalOf(() => assembly.parseProductRealmDeclaration(declaration({ executionBoundary: 'confined-subprocess' }), { blueprintSource: BLUEPRINT }))

  return probes
}

function refusalOf(fn) {
  try {
    fn()
    return { refused: false, code: null }
  } catch (error) {
    return { refused: true, code: typeof error?.code === 'string' ? error.code : null, name: String(error?.name ?? '') }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXEMPLAR SHAPE CHECK
// ─────────────────────────────────────────────────────────────────────────────
const PROPOSED_MODULE_PATH = 'packages/runtime/src/plugin/live/a5sf-governed-realm.mjs'

function exemplarCheck() {
  const dir = join(HERE, 'exemplar')
  const modulePath = join(dir, 'a5sf-governed-realm.mjs')
  const patchPath = join(dir, 'governed-member-preset.patch.yml')
  const result = { module: PROPOSED_MODULE_PATH, patch: relative(REPO, patchPath), checks: {}, ok: false }
  if (!existsSync(modulePath) || !existsSync(patchPath)) {
    result.checks.filesPresent = false
    return result
  }
  result.checks.filesPresent = true
  const source = readFileSync(modulePath, 'utf8')

  // (a) every relative import resolves against the PROPOSED product location,
  //     in both the source tree and the committed dist mirror.
  const specifiers = [...source.matchAll(/from\s+'(\.{1,2}\/[^']+)'/gu)].map((match) => match[1])
  const proposedDir = dirname(join(REPO, PROPOSED_MODULE_PATH))
  const distDir = dirname(join(REPO, 'packages', 'runtime', 'dist', PROPOSED_MODULE_PATH))
  result.checks.relativeImports = specifiers.map((spec) => ({
    spec,
    // A source-tree sibling may be `.ts` (compiled to `.js` in the dist mirror).
    resolvesInSource: existsSync(join(proposedDir, spec)) || existsSync(join(proposedDir, spec.replace(/\.js$/u, '.ts'))),
    resolvesInDist: existsSync(join(distDir, spec)),
  }))
  result.checks.importsResolve = result.checks.relativeImports.every((entry) => entry.resolvesInSource && entry.resolvesInDist)

  // (b) the patch layer: one host row providing the service + one preset row that
  //     mounts NO persistent shell, and the team row written so the realm is enabled.
  const parsed = parseYamlFile(patchPath)
  if (!parsed.ok) {
    result.checks.patchParses = false
    result.checks.parseError = parsed.error
    return result
  }
  result.checks.patchParses = true
  const inserted = (parsed.value ?? []).flatMap((entry) => entry?.insert ?? [])
  const overrides = (parsed.value ?? []).filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.id === 'string')
  const rows = [...walkRows(inserted), ...walkRows(overrides)]
  const presetRow = rows.find((row) => row.name === '@deepseek-ai/dsh-agent-preset')
  const providerRow = rows.find((row) => typeof row.name === 'string' && row.name.includes('governed-realm'))
  // `dsh-agent-team/governed-realm` is the PROVIDER row; the team row is the
  // row whose plugin is the host entry.
  const teamRow = rows.find((row) => row.name === 'dsh-agent-team/host')
  const shell = shellFactsOf(rows)
  result.checks.providerRowPresent = providerRow !== undefined
  result.checks.presetRowPresent = presetRow !== undefined
  result.checks.teamRowPresent = teamRow !== undefined
  result.checks.mountsPersistentShell = shell.persistentBash || shell.terminalsProducer
  result.checks.publishesTerminals = shell.terminalsProducer
  result.checks.presetId = presetRow?.configId ?? presetRow?.id ?? null
  result.checks.teamRowEnablesRealm = (teamRow?.configKeys ?? []).some((key) => key.startsWith('a5sf'))
  result.checks.teamRowPresetIds = (teamRow?.configKeys ?? []).filter((key) => key === 'memberPresetId' || key === 'rootPresetId')

  // (c) the four install-time preconditions the declared face must satisfy —
  //     read off `install.ts` (PD-13 block) and asserted against the declaration
  //     the module builds, not against the module's prose.
  const declared = declaredTerminalSpecOf(source)
  result.checks.declaredTerminal = declared
  result.checks.programAbsolute = typeof declared?.program === 'string' && declared.program.startsWith('/')
  result.checks.shellClassAdmitsProgram = typeof declared?.program === 'string'
    && Array.isArray(declared?.shellClassPrograms)
    && declared.shellClassPrograms.includes(declared.program.slice(declared.program.lastIndexOf('/') + 1).toLowerCase())
  result.checks.declaresSubprocessFace = declared?.declaresSubprocess === true
  result.checks.declaresNoLegacyTerminals = declared?.touchesLegacyTerminals !== true

  // Every check has an EXPECTATION: the two "must be false" facts are false
  // because a persistent shell or a `terminals` producer on the Member scope is
  // exactly what the exemplar must not do.
  const mustBeFalse = ['mountsPersistentShell', 'publishesTerminals']
  const mustBeTrue = [
    'filesPresent', 'importsResolve', 'patchParses', 'providerRowPresent', 'presetRowPresent',
    'teamRowPresent', 'teamRowEnablesRealm', 'programAbsolute', 'shellClassAdmitsProgram',
    'declaresSubprocessFace', 'declaresNoLegacyTerminals',
  ]
  result.expectations = { mustBeTrue, mustBeFalse }
  result.ok = mustBeTrue.every((key) => result.checks[key] === true)
    && mustBeFalse.every((key) => result.checks[key] === false)
    && result.checks.teamRowPresetIds.includes('memberPresetId')
  return result
}

/** Read the exemplar's declared face from the module's `GOVERNED_FACE` literal. */
function declaredTerminalSpecOf(source) {
  const program = /program:\s*'([^']+)'/u.exec(source)?.[1]
  const programsBlock = /programs:\s*Object\.freeze\(\[([^\]]*)\]\)/u.exec(source)?.[1] ?? ''
  const shellClassPrograms = [...programsBlock.matchAll(/'([^']+)'/gu)].map((match) => match[1])
  return {
    program,
    shellClassPrograms,
    declaresSubprocess: /subprocess:\s*(Object\.freeze\()?\{/u.test(source),
    touchesLegacyTerminals: /provide\(\s*'terminals'/u.test(source),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The table
// ─────────────────────────────────────────────────────────────────────────────
const NEEDS = Object.freeze({
  compositionOnly: [
    'a shipped module that provides `teamA5sfRealm` with { members, subprocess, terminal } (none exists; ~150 lines + one `exports` entry — see exemplar/a5sf-governed-realm.mjs)',
    'a NEUTRAL enablement key (`a5sfRealmConfigOf` ignores the row unless a5sfEvidencePath/a5sfMemberPolicies/a5sfMemberAuthority is present; the first is a machine path the shipped layer forbids, the other two fork with the provided service)',
    'a v4 blueprint with a `memberIoCeilings` family (the shipped blueprint is schemaVersion 3 and any declaration is refused MEMBER_POLICY_WITHOUT_BLUEPRINT)',
    'a Member preset that mounts NO persistent shell (else TERMINALS_DOUBLE_TERMINAL_REFUSED) + `memberPresetId` selecting it',
  ],
  presetOnly: [
    'nothing on the preset itself — the faces are installed by the realm, not by a preset row',
    'a Member preset row id selected by the composition (`memberPresetId`)',
  ],
})

function consequenceOf(shell, kind) {
  if (!shell.terminalsProducer) {
    return {
      doubleTerminalRefused: false,
      memberCreated: true,
      shellLeft: 'confined terminal face (`bash` served by the confined face)',
      note: 'no ancestor `terminals` service — the install has nothing to collide with',
    }
  }
  return {
    doubleTerminalRefused: true,
    memberCreated: false,
    shellLeft: 'none — the Member setup is rejected and rolled back',
    note: 'TERMINALS_DOUBLE_TERMINAL_REFUSED at install; agent-bindings fails closed on a mount rejection, so the Member never comes up',
  }
}

function capabilityLost(shell) {
  const lost = []
  if (shell.persistentBash) {
    lost.push('`cd` / `export` state surviving across calls')
    lost.push('interactive stdin')
    lost.push('a shell `&` background job that survives the call')
    lost.push('PTY session continuity (job control, /dev/pts identity)')
    lost.push('`run_in_background` / `timeoutMs` / `sandbox_permissions` were never on the persistent tool')
  } else if (shell.transientBash) {
    lost.push('`run_in_background` (job registry; long commands become collectable jobs)')
    lost.push('`timeoutMs` per call')
    lost.push('`sandbox_permissions` escalation + `justification` (when the deployment exposes them)')
    lost.push('structured output object (the confined tool answers a JSON string with kind "confined-terminal")')
    lost.push('nothing else: the transient host shell already has no `cd`/`export` persistence and no interactive stdin')
  }
  return lost
}

function rowFor(source, origin) {
  const shell = source.shell ?? { terminalsProducer: false, persistentBash: false, transientBash: false, isolateRealms: [] }
  return {
    origin,
    path: source.path,
    kind: source.kind,
    id: source.presetId ?? source.presetIds?.[0] ?? (source.rowIds ?? []).find((id) => typeof id === 'string') ?? null,
    declaresToday: {
      rows: source.rowIds ?? source.unconfinedHostShellRows?.map((row) => row.id).filter(Boolean) ?? [],
      teamRow: source.teamRowPresent === true,
      a5sfKeys: source.declaresA5sfKeys ?? [],
      presetIds: source.declaresPresetId ?? [],
      shell: {
        mountsPersistentShell: shell.persistentBash === true,
        publishesTerminals: shell.terminalsProducer === true,
        mountsTransientBash: shell.transientBash === true,
        isolateRealms: shell.isolateRealms ?? [],
      },
    },
    toDeclareGovernedFaces: origin === 'host-bundle'
      ? ['outside this tree: the pinned host bundle is read-only under CORE PATCH BUDGET = 0; a governed preset must be DECLARED IN THIS TREE, not by editing these files']
      : (source.teamRowPresent === true ? NEEDS.compositionOnly : NEEDS.presetOnly),
    consequence: consequenceOf(shell, source.kind),
    // A composition with no shell of its own inherits the deployment default, so
    // "lost" is measured RELATIVE TO that default (standard, transient), never
    // relative to a persistent PTY it never had.
    capabilityLost: capabilityLost(shell).length > 0
      ? capabilityLost(shell)
      : [
        'none for existing Members until their Team selects the governed preset: this layer inherits the deployment default (`standard`, transient) and the default does not move',
        'a Member that DOES select it loses `run_in_background`, per-call `timeoutMs`, `sandbox_permissions`/`justification` and the structured result object (`cd`/`export` and interactive stdin were never there on `standard`)',
      ],
  }
}

const census = {
  inTree: inTreeSources().map(describeYamlSource),
  jsPresetBuilders: jsPresetBuilders(),
  host: await hostCensus(),
  blastRadius: blastRadius(),
}

const rows = [
  ...census.inTree.map((source) => rowFor(source, 'this-tree')),
  ...census.host.presets.map((source) => rowFor(source, 'host-bundle')),
]

const table = {
  schema: 'a5sf-face-decl-impact/1',
  task: 'a5sf-face-decl-impact',
  branch: 'task/a5sf-face-decl-impact-20261111',
  base: 'origin/master @ 35f3a0d2f',
  boots: 0,
  recordClass: 'IMPACT-ANALYSIS (no Host start, no live claim)',
  census,
  rows,
  probes: await driftProbes(),
  exemplar: exemplarCheck(),
  recommendation: {
    answer: 'YES, as an additional opt-in Member preset — not by replacing the deployment default in the same change',
    ownerSentence: 'Owner authorises: ship a governed Member preset (`a5sf-governed-member`) beside the existing default, selected explicitly by an operator; the deployment default stays `standard`, and no existing Member changes behaviour until its Team selects the governed preset.',
    changesIf: 'If Members must keep background jobs for long commands, the answer becomes NOT YET until `confined-terminal-tool.mjs` can hand a command to the job registry; the confined terminal face has no background mode today (each command is a fresh confined child, killed when the tool returns).',
  },
}

const serialized = `${JSON.stringify(table, null, 2)}\n`
if (CHECK) {
  const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (existing !== serialized) {
    process.stderr.write('a5sf-face-decl-impact: impact-table.json is STALE — re-run measure.mjs\n')
    process.exit(1)
  }
  process.stdout.write('a5sf-face-decl-impact: impact-table.json is current\n')
} else {
  writeFileSync(OUT, serialized)
  process.stdout.write(`${serialized}`)
}
