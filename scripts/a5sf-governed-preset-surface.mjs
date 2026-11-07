#!/usr/bin/env node
/**
 * a5sf-governed-preset-surface.mjs — MEASURE the model-visible tool-surface delta
 * between the pinned `standard` preset and the shipped `a5sf-governed-member`
 * preset (GOVERNED-PRESET, 2026-11-11).
 *
 * WHAT IS MEASURED, and what each column means:
 *   - `declaration`: the DECLARED plugin rows of each preset, read from the
 *     composition YAML (the pinned host's `standard.patch.yml` and this package's
 *     `cordis.patch.yml`), flattened by id. This is a declaration-level fact: a
 *     row's id, package name and disabled flag.
 *   - `resolvedBash`: the RESOLVED tool definition (parameter names + description)
 *     of the model-visible `bash` under each preset — `@deepseek-ai/dsh-tool-bash`
 *     mounted in a unit Cordis root with a stub `subprocess` (the transient shell
 *     standard exposes) vs `confined-terminal-tool.mjs` mounted with a stub
 *     `terminals` (the governed shell). This is what the model sees, not a name.
 *
 * Run: node scripts/a5sf-governed-preset-surface.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..')
const PINNED_STANDARD = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'bundle', 'web-app', 'presets', 'standard.patch.yml')
const OUTPUT = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-governed-preset', 'tool-surface.json')

const require_ = createRequire(join(REPO_ROOT, 'package.json'))
const YAML = require_('yaml')
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default

/** Loader dialect: `!!js <expr>` is a loader tag, not document data. */
function parseComposition(path) {
  return YAML.parse(readFileSync(path, 'utf8').replace(/!!js /g, ''))
}

/** A composition document is a sequence of rows; flatten `insert` nesting. */
function rowsOf(document) {
  const rows = Array.isArray(document) ? document : document === undefined || document === null ? [] : [document]
  return rows.flatMap((row) => (Array.isArray(row?.insert) ? rowsOf(row.insert) : [row]))
}

function withinGroup(rows) {
  const out = []
  for (const row of rows ?? []) {
    if (row?.group === true) { out.push(...withinGroup(row.config ?? [])); continue }
    if (row?.id !== undefined && row?.name !== undefined) {
      out.push({ id: String(row.id), name: String(row.name), ...(row.disabled === true ? { disabled: true } : {}) })
    }
  }
  return out
}

function presetRows(document, presetId) {
  for (const row of rowsOf(document)) {
    if (row?.config?.id === presetId && Array.isArray(row.config.plugins)) {
      return withinGroup(row.config.plugins).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    }
  }
  return []
}

function shippedPreset() {
  for (const row of rowsOf(parseComposition(join(REPO_ROOT, 'cordis.patch.yml')))) {
    if (Array.isArray(row?.config?.plugins)) {
      return { presetId: String(row.config.id), rows: withinGroup(row.config.plugins).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }
    }
  }
  return undefined
}

/**
 * Resolve the model-visible `bash` from one tool module in a unit root.
 *
 * `deps` are the module's REAL declared injections (read from the module, never
 * guessed): a `service` dep is provided as a Cordis Service whose methods throw
 * (nothing executes — the DEFINITION is what is measured); a `value` dep is a
 * plain object on the ctx.
 */
async function resolveBash(moduleUrl, deps) {
  const module = await import(moduleUrl)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  for (const dep of deps) {
    if (dep.kind === 'value') { root.provide(dep.name, dep.value); continue }
    class Stub extends Service {
      constructor(ctx) { super(ctx, dep.name) }
    }
    for (const method of dep.methods) Stub.prototype[method] = async () => { throw new Error('surface measurement never executes') }
    await root.plugin(Stub)
  }
  const standingKey = {}
  const standing = createScope(root, standingKey)
  const agentKey = { id: `surface-${deps.map((dep) => dep.name).join('-')}` }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  await standing.ctx.plugin(module.default ?? module)
  const read = () => agent.ctx.get('tools')?.schemas(agentKey)?.find((candidate) => candidate.name === 'bash')
  let schema = read()
  for (let round = 0; round < 20 && schema === undefined; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    schema = read()
  }
  const description = String(schema?.description ?? '')
  return {
    resolved: schema !== undefined,
    parameterNames: Object.keys(schema?.parameters?.properties ?? {}).sort(),
    required: [...(schema?.parameters?.required ?? [])],
    additionalProperties: schema?.parameters?.additionalProperties,
    descriptionLength: description.length,
    descriptionFirstLine: description.split('\n')[0],
  }
}

const shipped = shippedPreset()
if (shipped === undefined) {
  console.error('no shipped preset row with config.plugins found in cordis.patch.yml')
  process.exit(1)
}
const standard = presetRows(parseComposition(PINNED_STANDARD), 'standard')
if (standard.length === 0) {
  console.error(`the pinned standard preset was not found at ${PINNED_STANDARD} (tests/deepseek-harness-test-use must exist)`)
  process.exit(1)
}

const standardById = new Map(standard.map((row) => [row.id, row]))
const shippedById = new Map(shipped.rows.map((row) => [row.id, row]))
const removed = standard.filter((row) => !shippedById.has(row.id))
const added = shipped.rows.filter((row) => !standardById.has(row.id))
const changed = shipped.rows.filter((row) => standardById.has(row.id) && JSON.stringify(standardById.get(row.id)) !== JSON.stringify(row))

const transientBash = await resolveBash(
  pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tool-bash')).href,
  [
    { name: 'shell', methods: ['spawn', 'spawnStreaming', 'exec', 'probe'] },
    { name: 'shellEnv', kind: 'value', value: { cwd: process.cwd(), env: {} } },
  ],
)
const confinedBash = await resolveBash(
  pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-terminal-tool.mjs')).href,
  [{ name: 'terminals', methods: ['spawn', 'startSend', 'read', 'kill'] }],
)

const report = {
  schema: 'a5sf-governed-preset-surface/1',
  generatedBy: 'scripts/a5sf-governed-preset-surface.mjs',
  pinnedStandard: 'tests/deepseek-harness-test-use/packages/bundle/web-app/presets/standard.patch.yml (0.2.0-rc.2 @ 639ed01539)',
  shippedPreset: { id: shipped.presetId, file: 'cordis.patch.yml' },
  declaration: {
    standardRowCount: standard.length,
    shippedRowCount: shipped.rows.length,
    removed,
    added,
    changed,
    unchangedCount: shipped.rows.length - changed.length - added.length,
    shippedRows: shipped.rows,
  },
  resolvedBash: {
    standard: transientBash,
    governed: confinedBash,
    parameterDelta: {
      removed: transientBash.parameterNames.filter((name) => !confinedBash.parameterNames.includes(name)),
      added: confinedBash.parameterNames.filter((name) => !transientBash.parameterNames.includes(name)),
    },
  },
  notes: [
    'The standard preset is the PINNED host baseline; its rows are declarations, not a live mount, because the transient shell and the skills/compaction/subagent rows are host-provided.',
    'The governed preset is a copy of those declarations minus the `declaration.removed` rows (tool-pwsh, and since PD-18 tool-web + workflow-ptc/tool-workflow); the only row whose RESOLVED definition differs at runtime is `bash` (route-C shadow onto the confined terminal face).',
    'PD-18 FAIL-CLOSED SURFACE: web_fetch/web_search and workflow are REMOVED from the governed preset because they resolved to the host base services with zero a5sf facts. Their absence here is a measured capability regression, not a claimed fix; the standard preset still declares workflow-ptc/tool-workflow and tool-web, so the capability exists outside the governed preset.',
    'Retained-but-idle: tool-jobs has no producer on the governed preset (the confined face cannot hand a command to the job registry).',
  ],
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`wrote ${OUTPUT}`)
console.log(JSON.stringify({
  standardRows: standard.length,
  shippedRows: shipped.rows.length,
  removed: removed.map((row) => row.id),
  added: added.map((row) => row.id),
  changed: changed.map((row) => row.id),
  bashRemovedParams: report.resolvedBash.parameterDelta.removed,
}, null, 2))
