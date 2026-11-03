/**
 * probe-route-c.mjs — ROUTE C feasibility, HOST-FREE (task/a5sf-native-route-c-20261103).
 *
 * The external review's claim: the A5-XENV PoC (commit 18e3823e3) already proved,
 * on a real Host at THIS pinned baseline, that
 *
 *     const iso = agentCtx.isolate('fs')
 *     iso.provide('fs', makeRestrictedFs(agentCtx.get('fs'), policy))
 *     await iso.plugin(nativeToolFsModule)        // re-mount the NATIVE module
 *
 * makes the model-visible native `read`/`write` resolve the confined provider,
 * with NO Core patch. PR #555 concluded instead that native preset tools can only
 * be confined by patching upstream (CORE_SEAM_BLOCKER).
 *
 * This probe re-measures the MECHANISM on the current build, host-free: one
 * in-process Cordis root, the REAL `@deepseek-ai/dsh-tools` runtime, the REAL
 * `@deepseek-ai/dsh-system-prompt`, the REAL `@deepseek-ai/dsh-tool-fs` module
 * (built `lib/index.js` at the pinned baseline SHA), and filesystem Providers
 * that RECORD which instance served each call, so "which provider did the native
 * tool hit" is a measurement, not a claim.
 *
 * The preset registry's topology is REPLICATED with its own primitives, not
 * simulated: `createScope(owner, key)` + `bindScopeParent(agentKey, standingKey)`
 * is exactly what `AgentPresetRegistry.activate()`/`join()` do
 * (`packages/preset/agent-preset-registry/src/index.ts:104,242`), and the preset
 * row is mounted with `scope.ctx.plugin(module, config)` — the same registration
 * context a Loader row gets (`mount.ts:mountPreset`). The Agent's own ScopeKey is
 * the Agent instance (`agent-loop/src/agent.ts:130`: `createScope(loopCtx, this)`),
 * which is why the probe's scope key carries the `session.header.cwd` the native
 * fs tools read.
 *
 * Zero Host boots, zero ports, zero DSH_HOME, zero writes under
 * `tests/deepseek-harness-test-use/` (the pristine tree is only READ). Fixtures are
 * mkdtemp dirs removed at the end. CORE PATCH BUDGET = 0.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-native-route-c/probe-route-c.mjs
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { TEST_USE_REL } from '../../../../tests/paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..')

/**
 * The pristine baseline checkout (READ-ONLY for this probe).
 *
 * This task's worktree carries no `tests/deepseek-harness-test-use` of its own
 * (the shared read-only baseline `/srv/workspace/…` named by TEST_METHODS §6 is
 * absent in this environment); the sibling main checkout at the same pinned SHA
 * plays that role. `A5SF_TEST_USE` overrides. Resolution walks up from the
 * worktree root so no absolute path is hardcoded.
 */
function findTestUse() {
  if (process.env.A5SF_TEST_USE !== undefined) return process.env.A5SF_TEST_USE
  let dir = REPO
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = join(dir, TEST_USE_REL)
    if (existsSync(join(candidate, 'packages', 'fs', 'tool-fs', 'package.json'))) return candidate
    dir = resolve(dir, '..')
  }
  throw new Error(`probe: no pristine baseline checkout found for ${TEST_USE_REL}`)
}
const TEST_USE = findTestUse()

const out = []
const rec = (obj) => {
  out.push(obj)
  console.log(JSON.stringify(obj))
}

// ── baseline module acquisition (read-only; ONE coherent install) ────────────
const baselineRequire = createRequire(join(TEST_USE, 'packages', 'fs', 'tool-fs', 'package.json'))
const fromBaseline = async (specifier) => import(pathToFileURL(baselineRequire.resolve(specifier)).href)

const { Context, Service } = await fromBaseline('@deepseek-ai/cordis')
const ToolRuntime = (await fromBaseline('@deepseek-ai/dsh-tools')).default
const SystemPrompt = (await fromBaseline('@deepseek-ai/dsh-system-prompt')).default
const { createScope, scopeOf, scopeChainOf, bindScopeParent } = await fromBaseline('@deepseek-ai/dsh-scope')
const TOOL_FS_URL = pathToFileURL(baselineRequire.resolve('@deepseek-ai/dsh-tool-fs')).href
const toolFs = await import(TOOL_FS_URL)

// ── fixtures ────────────────────────────────────────────────────────────────
const dirs = []
const mk = (label) => {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-route-c-${label}-`))
  dirs.push(dir)
  return dir
}
mk('fixture')

/**
 * A filesystem Provider that RECORDS every call and answers with its own tag.
 * Two instances with different tags make "which provider served the native
 * tool" directly observable, with no path algebra in the way.
 */
class ProbeFileSystem extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'fs')
    this.tag = config.tag ?? 'PROBE'
    this.calls = config.calls ?? []
  }

  processPath(target) {
    return target.displayPath
  }

  async resolve(path) {
    return { targetKey: path, displayPath: path }
  }

  contains() {
    return true
  }

  async stat() {
    return { version: 'v1', type: 'file', size: 3 }
  }

  async lstat() {
    return { version: 'v1', type: 'file', size: 3 }
  }

  async readText() {
    this.calls.push(`${this.tag}:readText`)
    return `${this.tag}-SERVED\n`
  }

  async readBytes() {
    this.calls.push(`${this.tag}:readBytes`)
    return Buffer.from(`${this.tag}-SERVED\n`)
  }

  async readByteRange() {
    this.calls.push(`${this.tag}:readByteRange`)
    return Buffer.from(`${this.tag}-SERVED\n`)
  }

  async streamText() {
    this.calls.push(`${this.tag}:streamText`)
    const text = `${this.tag}-SERVED\n`
    return (async function* stream() { yield text })()
  }

  async listDir() {
    return []
  }

  async watch() {
    return async () => {}
  }

  async writeText() {
    this.calls.push(`${this.tag}:writeText`)
    return { version: 'v2', operation: 'create', before: null, after: 'LANDED\n' }
  }

  async editText() {
    this.calls.push(`${this.tag}:editText`)
    return { version: 'v2' }
  }
}

const CALLS = []

const toolNames = (root, scope) => root.tools.schemas(scope).map((schema) => schema.name)
const sectionNames = async (root, scope) =>
  (await root.systemPrompt.assemble({ scope })).sections.map((section) => section.name)
const countOf = (arr, name) => arr.filter((entry) => entry === name).length
const callsFor = (mark) => CALLS.filter((entry) => entry === mark).length

async function dispatch(root, agent, name, args) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `route-c-${name}-${Math.floor(Math.random() * 1e9).toString(36)}`,
    name,
    arguments: args,
    agent,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

/** Fresh unit root: prompt + REAL tool runtime + ONE base fs Provider. */
async function makeRoot() {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(ProbeFileSystem, { tag: 'BASE', calls: CALLS })
  return root
}

/** The Agent instance doubles as its ScopeKey and carries `session.header.cwd`. */
const agentKeyFor = () => ({ session: { header: { cwd: '/probe-workspace' } } })

function presetTopology(root) {
  const standingKey = agentKeyFor()
  const standing = createScope(root, standingKey)
  const agentKey = agentKeyFor()
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standingKey, standing, agentKey, agentCtx: agent.ctx }
}

/** Read the provider-level verdict of one native `read` call. */
function servedBy(outcome) {
  if (outcome.isError) return `ERROR:${outcome.text.slice(0, 160)}`
  const match = /(BASE|CONFINED)-SERVED/.exec(outcome.text)
  return match?.[1] ?? `UNEXPECTED:${outcome.text.slice(0, 80)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// A. THE MODULE ITSELF — what TOOLFS_URL is, and whether it is re-mountable
// ═══════════════════════════════════════════════════════════════════════════
rec({
  leg: 'A',
  fact: 'native tool module shape at the pinned baseline',
  specifier: '@deepseek-ai/dsh-tool-fs',
  resolved: TOOL_FS_URL,
  isFileUrl: TOOL_FS_URL.startsWith('file:'),
  exportsName: toolFs.name,
  inject: toolFs.inject,
  applyIsFunction: typeof toolFs.apply === 'function',
  hasDefault: toolFs.default !== undefined,
  importSideEffects: 'none: the import resolved with no Cordis root present; apply() is the only registration path',
})

// ═══════════════════════════════════════════════════════════════════════════
// B. ROUTE C — preset standing scope + agent child + isolate re-mount
// ═══════════════════════════════════════════════════════════════════════════
{
  const root = await makeRoot()
  const { standingKey, standing, agentKey, agentCtx } = presetTopology(root)

  // The preset row: the NATIVE module, mounted by the registry on its standing scope.
  await standing.ctx.plugin(toolFs, {})
  const before = {
    visible: toolNames(root, agentKey),
    sections: await sectionNames(root, agentKey),
    read: await dispatch(root, agentKey, 'read', { file_path: 'which.txt' }),
  }

  // ── ROUTE C ────────────────────────────────────────────────────────────────
  const iso = agentCtx.isolate('fs')
  const fsFiber = await iso.plugin(ProbeFileSystem, { tag: 'CONFINED', calls: CALLS })
  let mountError
  let nativeFiber
  try {
    nativeFiber = await iso.plugin(toolFs, {})
  } catch (error) {
    mountError = String(error?.message ?? error)
  }

  const baseReadsBefore = callsFor('BASE:readText')
  const confinedReadsBefore = callsFor('CONFINED:readText')
  const after = {
    visible: toolNames(root, agentKey),
    sections: await sectionNames(root, agentKey),
    read: await dispatch(root, agentKey, 'read', { file_path: 'which.txt' }),
    write: await dispatch(root, agentKey, 'write', { file_path: 'landed.txt', content: 'LANDED\n' }),
  }
  rec({
    leg: 'B',
    fact: 'route C in the preset topology (isolate + confined provider + native module re-mount)',
    mountError: mountError ?? null,
    scopeOfIsoIsAgentKey: scopeOf(iso) === agentKey,
    scopeChainLength: scopeChainOf(agentKey).length,
    providerIdentity: {
      isoFsIsNotBase: iso.get('fs') !== root.get('fs'),
      isoFsTag: iso.get('fs')?.tag,
      baseFsTag: root.get('fs')?.tag,
    },
    before: {
      visibleCount: before.visible.length,
      visible: before.visible,
      readCount: countOf(before.visible, 'read'),
      promptSections: before.sections.filter((name) => name.startsWith('tool:')),
      promptReadCount: countOf(before.sections, 'tool:read'),
      readServedBy: servedBy(before.read),
    },
    after: {
      visibleCount: after.visible.length,
      visible: after.visible,
      readCount: countOf(after.visible, 'read'),
      promptSections: after.sections.filter((name) => name.startsWith('tool:')),
      promptReadCount: countOf(after.sections, 'tool:read'),
      readServedBy: servedBy(after.read),
      writeServedBy: after.write.isError ? `ERROR:${after.write.text.slice(0, 160)}` : CALLS.at(-1),
      baseReadsDelta: callsFor('BASE:readText') - baseReadsBefore,
      confinedReadsDelta: callsFor('CONFINED:readText') - confinedReadsBefore,
    },
    ctxBoundViewIsAgentScope: {
      // The wiring resolves the view through `root.tools` (no dsh-scope import);
      // this measures that a ctx-bound service view IS the agent scope's view.
      rootBoundToolsSchemas: toolNames(root),
      equalToAgentScopeView: JSON.stringify(toolNames(root)) === JSON.stringify(toolNames(root, agentKey)),
    },
    presetPlaneStillIntact: {
      readCount: countOf(toolNames(root, standingKey), 'read'),
      readServedBy: servedBy(await dispatch(root, standingKey, 'read', { file_path: 'which.txt' })),
    },
  })

  // ── teardown: dispose ONLY the re-mounted native fiber, agent alive ────────
  await nativeFiber?.dispose()
  const afterDispose = await dispatch(root, agentKey, 'read', { file_path: 'which.txt' })
  rec({
    leg: 'B2',
    fact: 'teardown of ONLY the re-mounted native tool fiber, agent still alive',
    readCount: countOf(toolNames(root, agentKey), 'read'),
    readServedBy: servedBy(afterDispose),
    note: 'a surviving preset-layer definition at BASE means the shadow is what confines; without it the native tool falls back',
  })
  await fsFiber.dispose()
  await standing.ctx.fiber.dispose()
  await agentCtx.fiber.dispose()
}

// ═══════════════════════════════════════════════════════════════════════════
// C. CONTROL — re-mount directly on the AGENT scope (no isolate): F8's claim
// ═══════════════════════════════════════════════════════════════════════════
{
  const root = await makeRoot()
  const { standing, agentKey, agentCtx } = presetTopology(root)
  await standing.ctx.plugin(toolFs, {})
  const sectionsBefore = await sectionNames(root, agentKey)
  let directError
  try {
    await agentCtx.plugin(toolFs, {})
  } catch (error) {
    directError = String(error?.message ?? error)
  }
  const read = await dispatch(root, agentKey, 'read', { file_path: 'which.txt' })
  rec({
    leg: 'C',
    fact: 'control: native module re-mounted on the agent ctx WITHOUT an isolate (F8 reproduction attempt)',
    presetToolSectionsVisibleToAgentBefore: sectionsBefore.filter((name) => name.startsWith('tool:')),
    agentScopeRemountError: directError ?? null,
    readCount: countOf(toolNames(root, agentKey), 'read'),
    readServedBy: servedBy(read),
    interpretation: directError === undefined || directError === null
      ? 'no collision: the preset layer is an ANCESTOR, so an agent-layer registration legally shadows it (F8 collision was caused by the earlier isolate re-mount in the SAME layer)'
      : 'collision: the agent layer already owned that section name',
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// D. RESTRICTION INTERACTION — does a shadowed registration bypass `restrict`?
// ═══════════════════════════════════════════════════════════════════════════
{
  const root = await makeRoot()
  const { standing, agentKey, agentCtx } = presetTopology(root)
  await standing.ctx.plugin(toolFs, {})
  // The preset (a blueprint's builtinToolDeny lane) denies `read` for the agent:
  // the restriction is registered on the AGENT scope (its own layer), naming the
  // native tool the preset layer contributes — the place product rows deny.
  await agentCtx.plugin({
    name: 'probe-deny-read',
    inject: ['tools'],
    apply(ctx) { ctx.tools.restrict({ deny: ['read'] }) },
  })
  const restricted = {
    readVisible: countOf(toolNames(root, agentKey), 'read'),
    read: await dispatch(root, agentKey, 'read', { file_path: 'which.txt' }),
  }
  const iso = agentCtx.isolate('fs')
  await iso.plugin(ProbeFileSystem, { tag: 'CONFINED', calls: CALLS })
  let mountError
  try {
    await iso.plugin(toolFs, {})
  } catch (error) {
    mountError = String(error?.message ?? error)
  }
  const afterRouteC = {
    readVisible: countOf(toolNames(root, agentKey), 'read'),
    read: await dispatch(root, agentKey, 'read', { file_path: 'which.txt' }),
  }
  rec({
    leg: 'D',
    fact: 'a preset-scope tools.restrict({deny:["read"]}) vs the route-C shadow',
    mountError: mountError ?? null,
    restrictedVisibleRead: restricted.readVisible,
    restrictedCallServedBy: servedBy(restricted.read),
    afterRouteCVisibleRead: afterRouteC.readVisible,
    afterRouteCCallServedBy: servedBy(afterRouteC.read),
    verdict: 'a scope-OWN registration is outside the inherited restriction filter (ToolRuntime.view: own registrations last, outside the filter)',
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// E. TWO MEMBER REALMS ON ONE AGENT — the "exactly one ceiling" constraint
// ═══════════════════════════════════════════════════════════════════════════
// Every Member realm is `root.isolate('fs', …)` on the SAME root, so both
// inherit the SAME DSH scope key (the agent). A second re-mount of the same
// native names must therefore collide inside one scope layer — the reason
// `mountA5sfRealm` refuses a non-empty native list with members.length !== 1.
{
  const root = await makeRoot()
  const { standing, agentKey, agentCtx } = presetTopology(root)
  await standing.ctx.plugin(toolFs, {})
  const isoA = agentCtx.isolate('fs')
  await isoA.plugin(ProbeFileSystem, { tag: 'CONFINED-A', calls: CALLS })
  const isoB = agentCtx.isolate('fs')
  await isoB.plugin(ProbeFileSystem, { tag: 'CONFINED-B', calls: CALLS })
  let firstError
  let secondError
  try {
    await isoA.plugin(toolFs, {})
  } catch (error) {
    firstError = String(error?.message ?? error)
  }
  try {
    await isoB.plugin(toolFs, {})
  } catch (error) {
    secondError = String(error?.message ?? error)
  }
  rec({
    leg: 'E',
    fact: 'two Member realms (two isolates) on ONE agent ctx, the same native module mounted in each',
    sameScopeKey: scopeOf(isoA) === agentKey && scopeOf(isoB) === agentKey,
    firstMountError: firstError ?? null,
    secondMountError: secondError ?? null,
    readCount: countOf(toolNames(root, agentKey), 'read'),
    note: 'one agent scope key = one registrable native surface; the wiring refuses members.length !== 1 before mounting',
  })
}

for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
console.log(JSON.stringify({ leg: 'END', records: out.length }))
