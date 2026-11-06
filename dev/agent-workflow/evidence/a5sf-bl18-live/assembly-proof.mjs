/**
 * assembly-proof.mjs — BL-18 pre-start ASSEMBLY PROOF (zero boots).
 *
 * WHAT THIS ANSWERS, and what it does not. It answers one question before the
 * last remaining P2-04 start is risked:
 *
 *   "If a BL-18 deny lane is declared on the `teamA5sfRealm` composition seam,
 *    does a governed realm actually MOUNT with a confined web face, does a fetch
 *    through that face refuse with NETWORK_UNCONFINED_REALM AT THE FACE, and is
 *    that refusal DISTINCT from the composition-level refusal that would kill the
 *    whole run before any probe?"
 *
 * It boots NOTHING: no Host, no port, no DSH_HOME, no model request. It builds
 * in-process Cordis roots exactly as `tests/world-factory/a5sf-web-row.test.mjs`
 * does and calls the SAME shipped seams:
 *
 *   - the ONE row (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`)
 *     `mountMemberA5sfRealm` / `attachA5sfNativeToolModules`;
 *   - the ONE compiler (`packages/runtime/member-io-policy/src`) — no lane is
 *     intersected here;
 *   - the ONE product assembler (`packages/runtime/team-services/src/product-assembly.ts`)
 *     for the CONFIG path the prediction is about;
 *   - the ONE coverage classifier (`packages/runtime/operation-permission/permission-coverage.ts`)
 *     for the caller analysis — the same predicate A2C-2 throws with;
 *   - the REAL pinned `@deepseek-ai/dsh-tool-web` module, read-only, from the
 *     pristine host tree (same import the row suite uses).
 *
 * SCENARIOS
 *   A  config-path deny   → product-assembly refuses: NETWORK_UNCONFINED_REALM
 *                           at composition (the predicted abort).
 *   B  seam-path deny     → the realm MOUNTS (no composition refusal), the
 *                           mounted face refuses AT THE FACE with the typed
 *                           code, zero provider calls, exactly one deny fact.
 *   C  the real caller    → the REAL `tool-web` module on a preset that
 *                           surfaces `web_fetch`/`web_search`, attached through
 *                           the row's route-C, driven through the REAL
 *                           ToolRuntime: typed refusal at the face.
 *   C2 the surface gate   → the SAME module on a preset that does NOT surface
 *                           the pair: route-C refuses (surface ADDED) — the
 *                           composition must put web on the preset.
 *   D  who may call       → A2C-2's own classifier over the declared surfaces:
 *                           web_fetch/web_search are known-sensitive-unmanaged,
 *                           so a STRICT agent must deny them (and then cannot
 *                           call them); a legacy/non-strict Member is the only
 *                           model-facing caller.
 *
 * USAGE
 *   node dev/agent-workflow/evidence/a5sf-bl18-live/assembly-proof.mjs \
 *        [--host-tree <pristine checkout>] [--json <out.json>]
 *
 * Default host tree: $A5SF_HOST_TREE || <repo>/tests/deepseek-harness-test-use.
 * The tree is READ ONLY; only `packages/web/tool-web/lib/index.js` is imported.
 *
 * @module dev/agent-workflow/evidence/a5sf-bl18-live/assembly-proof
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const argv = process.argv.slice(2)
function argOf(flag) {
  const i = argv.indexOf(flag)
  return i === -1 ? undefined : argv[i + 1]
}
const HOST_TREE = resolve(argOf('--host-tree') ?? process.env.A5SF_HOST_TREE ?? join(REPO, 'tests', 'deepseek-harness-test-use'))
const JSON_OUT = argOf('--json')

const CLEANUP = []
const LINES = []
function log(message) {
  LINES.push(message)
  process.stdout.write(`${message}\n`)
}
function section(title) {
  log('')
  log(`== ${title} ==`)
}
function tempDir(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-bl18-proof-${label}-`))
  CLEANUP.push(dir)
  return dir
}

// ── the shipped seams (TypeScript sources through the repo's test hook) ──────
register(pathToFileURL(join(REPO, 'scripts', 'run-tests-hooks.mjs')).href)
const runtimeRequire = createRequire(join(REPO, 'packages', 'runtime', 'package.json'))
const [policyMod, servicesMod, cordis, toolsMod, systemPromptMod, scopeMod] = await Promise.all([
  import(pathToFileURL(join(REPO, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href),
  import(pathToFileURL(join(REPO, 'packages', 'runtime', 'team-services', 'src', 'index.ts')).href),
  import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href),
  import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href),
  import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href),
  import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href),
])
const productAssembly = await import(
  pathToFileURL(join(REPO, 'packages', 'runtime', 'team-services', 'src', 'product-assembly.ts')).href
)
const coverage = await import(
  pathToFileURL(join(REPO, 'packages', 'runtime', 'operation-permission', 'permission-coverage.ts')).href
)
const blueprintSchema = await import(
  pathToFileURL(join(REPO, 'packages', 'domain', 'blueprint', 'src', 'schema.ts')).href
)
const row = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)

const { Context, Service } = cordis
const ToolRuntime = toolsMod.default
const SystemPrompt = systemPromptMod.default
const { createScope, bindScopeParent } = scopeMod
const toolWeb = await import(pathToFileURL(join(HOST_TREE, 'packages', 'web', 'tool-web', 'lib', 'index.js')).href)

const WEB_IDENTITY = Object.freeze({
  teamId: 'team.a5sf.bl18',
  memberInstanceId: 'inst-bl18-web',
  templateId: 'webworker',
  instanceGeneration: 1,
})
const DECLARED_URL = 'https://example.test/legal/page'
const DECLARED_SEARCH = { queries: ['a5sf bl18 deny lane'] }

// ── fixtures (composition-owned, disclosed — NOT product decisions) ──────────
function lane(allow, deny = []) {
  return { mode: 'restricted', allow: [...allow], ask: [], deny: [...deny] }
}

function memberPolicy(network) {
  return Object.freeze({
    memberIdentity: WEB_IDENTITY.memberInstanceId,
    templateId: WEB_IDENTITY.templateId,
    instanceGeneration: WEB_IDENTITY.instanceGeneration,
    revision: 'rev-bl18-proof',
    read: Object.freeze(lane(['/tmp'])),
    write: Object.freeze(lane(['/tmp'])),
    network: Object.freeze({ access: network }),
  })
}

/** The ONE compiler's answer — what the face reads and mounts with. */
function effectiveOf(network) {
  const compiled = policyMod.compileEffectiveIo(
    memberPolicy(network),
    { bindingIdentity: 'team/web', read: lane(['/tmp']), write: lane(['/tmp']), network },
    {
      memberIdentity: WEB_IDENTITY.memberInstanceId,
      callId: 'call-bl18-proof',
      policyRevision: 'rev-bl18-proof',
      toolBindingIdentity: 'team/web',
      approvedOnce: false,
    },
  )
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

/** The fake transport: entering it is the counter that proves the refusal position. */
function fakeWebBoundary({ probeLevel = 'unsupported' } = {}) {
  const boundary = {
    fetches: [], searches: [], dnsLookups: 0, connects: 0, proxyLookups: 0, probeCalls: 0,
    async fetch(request) {
      boundary.fetches.push(request)
      boundary.dnsLookups += 1
      boundary.connects += 1
      return { url: request?.url, statusCode: 200, body: { kind: 'text', content: 'BL18-MOCK-BODY' }, truncated: false }
    },
    async search(request) {
      boundary.searches.push(request)
      boundary.dnsLookups += 1
      boundary.connects += 1
      return { content: 'search', sources: [], truncated: false }
    },
    async probe() {
      boundary.probeCalls += 1
      return {
        ok: true,
        value: [{ dimension: 'network-destination', level: probeLevel, note: `fake web boundary probe: network-destination=${probeLevel}` }],
      }
    },
  }
  return boundary
}

class BaseFs extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(target) { return target.hostPath }
  contains(parent, child) { return String(this.processPath(child)).startsWith(String(this.processPath(parent))) }
  async resolve(path) { return { hostPath: path, displayPath: path } }
  async readText() { return '' }
  async streamText() { return (async function* stream() { yield '' })() }
  async readBytes() { return new Uint8Array() }
  async readByteRange() { return new Uint8Array() }
  async listDir() { return [] }
  async stat() { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
  async lstat() { return this.stat() }
  async watch() { return async () => undefined }
  async writeText(target) { return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v1' } }
  async editText(target) { return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v2' } }
}

/** The INHERITED host web service — consulting it is a failure, so it is a tripwire. */
class HostWeb extends Service {
  static calls = 0
  constructor(ctx, config = {}) { super(ctx, 'web'); this.config = config }
  async fetch() { HostWeb.calls += 1; throw new Error('BL18_TRIPWIRE: the INHERITED host ctx.web was consulted') }
  async search() { HostWeb.calls += 1; throw new Error('BL18_TRIPWIRE: the INHERITED host ctx.web was consulted') }
}

async function makeRoot() {
  HostWeb.calls = 0
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(HostWeb, {})
  await root.plugin(BaseFs, {})
  return root
}

/** A preset standing scope carrying the REAL pinned tool-web module. */
async function makePresetScope(root, { withWeb }) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  if (withWeb) await standing.ctx.plugin(toolWeb, {})
  const agentKey = { session: { header: {} } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standingKey, standing, agentKey, agent }
}

function refusalCode(error) {
  return typeof error?.code === 'string' ? error.code : null
}

async function factsOf(path) {
  const { readGuardConsultFile } = await import(
    pathToFileURL(join(REPO, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href
  )
  return readGuardConsultFile(path)
}

const REPORT = { schema: 'a5sf-bl18-assembly-proof/1', at: new Date().toISOString(), hostTree: HOST_TREE, scenarios: {} }

// ── A. the predicted abort: the product CONFIG path refuses a network deny ───
async function scenarioA() {
  section('A. product config path — the predicted composition refusal')
  const lane = { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] }
  const decl = {
    schema: 'a5sf-product-member-policies/1',
    teamId: 'team.a5sf.bl18',
    blueprintRevision: '1',
    authority: { revision: 'a4:bl18:1', admitted: true },
    members: [{
      templateId: WEB_IDENTITY.templateId,
      instanceGeneration: WEB_IDENTITY.instanceGeneration,
      ceiling: { read: lane, write: { mode: 'all', deny: [] }, network: { mode: 'deny', default: 'deny' } },
    }],
  }
  const blueprintSource = `---\n${JSON.stringify({
    schemaVersion: 4,
    blueprintId: decl.teamId,
    revision: decl.blueprintRevision,
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [{ templateId: WEB_IDENTITY.templateId, persona: 'Worker.' }],
    requirements: [], memberEnvelopes: [], policyStates: [],
    permissionMutationEnvelope: { rules: [] }, teamHardEnvelope: { rules: [] }, metadata: {},
    memberIoCeilings: [{ templateId: WEB_IDENTITY.templateId, io: decl.members[0].ceiling }],
  }, null, 2)}\n---\n`

  let caught
  try {
    productAssembly.parseProductRealmDeclaration(decl, { blueprintSource })
  } catch (error) {
    caught = error
  }
  assert.notEqual(caught, undefined, 'the config path MUST refuse a network deny declaration')
  assert.equal(refusalCode(caught), 'NETWORK_UNCONFINED_REALM', `typed code, got ${JSON.stringify(refusalCode(caught))}: ${String(caught?.message)}`)
  assert.match(String(caught.message), /ceiling\.network narrows the network axis/)
  log(`A1 config-path ceiling deny   → ${refusalCode(caught)} (composition, before any scope/face)`)
  log(`   message: ${String(caught.message).slice(0, 180)}…`)

  // The same refusal on the ToolBinding projection: a binding that narrows the
  // network axis is refused at the SAME composition gate (product-assembly
  // line 548-555), for the same reason.
  let caughtBinding
  try {
    productAssembly.parseProductRealmDeclaration({
      ...decl,
      members: [{
        ...decl.members[0],
        ceiling: { read: lane, write: { mode: 'all', deny: [] }, network: { mode: 'allow' } },
        toolRestrictions: [{
          owner: 'member',
          name: 'web',
          authorization: 'allow',
          io: { read: lane, write: lane, network: { mode: 'deny', default: 'deny' } },
          execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
        }],
      }],
    }, { blueprintSource })
  } catch (error) {
    caughtBinding = error
  }
  assert.equal(refusalCode(caughtBinding), 'NETWORK_UNCONFINED_REALM', 'the binding path refuses the same narrowing')
  log(`A2 config-path binding deny  → ${refusalCode(caughtBinding)} (same gate, line 548-555)`)

  REPORT.scenarios.A = {
    verdict: 'CONFIRMED',
    code: refusalCode(caught),
    codeBinding: refusalCode(caughtBinding),
    position: 'product-assembly.ts parseProductRealmDeclaration, before any scope exists',
  }
}

// ── B. the seam: mounts, and refuses AT THE FACE (no composition refusal) ────
async function scenarioB() {
  section('B. teamA5sfRealm seam — mounts, and the denial is AT THE FACE')
  const root = await makeRoot()
  const { agentKey, agent } = await makePresetScope(root, { withWeb: true })
  const boundary = fakeWebBoundary()
  const dir = tempDir('seam')
  const sink = join(dir, 'consult.jsonl')
  const network = 'deny'

  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sink }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: WEB_IDENTITY, policy: { ok: true, value: memberPolicy(network) } }],
        providerClass: BaseFs,
        web: { effective: effectiveOf(network), provider: boundary, realmId: 'realm-bl18-seam-deny' },
      }),
    }),
    member: {
      sessionId: 'session-bl18-web',
      instanceId: WEB_IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-bl18',
      templateId: WEB_IDENTITY.templateId,
    },
  })

  // (1) THE ROW MOUNTS — the composition-level refusal did NOT fire.
  assert.notEqual(realm, undefined, 'the seam composition must mount a realm')
  const faces = realm.installation.members[0].faces
  assert.notEqual(faces.web, null, 'the compiled web face reached the mounted realm')
  assert.equal(typeof faces.web.fetch, 'function')
  assert.equal(typeof faces.web.search, 'function')
  assert.equal(faces.fs, 'confined')
  assert.equal(effectiveOf(network).network.access, 'deny', 'the compiled network axis is deny')
  log('B1 row mounted, faces = ' + JSON.stringify({ fs: faces.fs, web: faces.web === null ? null : 'mounted', subprocess: faces.subprocess }))
  log('B2 compiled network axis = deny (compileEffectiveIo output)')

  // (2) the fetch through the MOUNTED face refuses at the face, typed.
  const denial = await faces.web.fetch({ url: DECLARED_URL }).then(() => undefined, (error) => error)
  assert.notEqual(denial, undefined, 'the deny lane must refuse the fetch')
  assert.equal(refusalCode(denial), 'NETWORK_UNCONFINED_REALM', `typed code at the face, got ${JSON.stringify(refusalCode(denial))}`)
  assert.match(String(denial.message), /refusing before any provider call/)
  assert.equal(boundary.fetches.length, 0, 'zero provider fetches')
  assert.equal(boundary.dnsLookups, 0, 'zero DNS lookups')
  assert.equal(boundary.connects, 0, 'zero connects')
  assert.equal(HostWeb.calls, 0, 'the inherited host web service was never consulted')
  log(`B3 face.fetch refused: ${refusalCode(denial)} / provider fetches=${boundary.fetches.length} dns=${boundary.dnsLookups} connects=${boundary.connects}`)

  // (3) exactly one typed fact, on the shipped sink.
  const facts = (await factsOf(sink)).filter((fact) => String(fact.method).startsWith('web:'))
  assert.equal(facts.length, 1, 'exactly one web guard fact')
  assert.equal(facts[0].method, 'web:fetch')
  assert.equal(facts[0].decision, 'deny')
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
  assert.equal(facts[0].locator, DECLARED_URL)
  log(`B4 one guard fact: method=${facts[0].method} decision=${facts[0].decision} decidedBy=${facts[0].decidedBy}`)

  // (4) the sibling search path on the same face, same position.
  const searchDenial = await faces.web.search(DECLARED_SEARCH).then(() => undefined, (error) => error)
  assert.equal(refusalCode(searchDenial), 'NETWORK_UNCONFINED_REALM')
  assert.equal(boundary.searches.length, 0, 'zero provider searches')
  const factsAfter = (await factsOf(sink)).filter((fact) => String(fact.method).startsWith('web:'))
  assert.equal(factsAfter.length, 2, 'one fact per consultation')
  assert.equal(factsAfter[1].method, 'web:search')
  log(`B5 face.search refused: ${refusalCode(searchDenial)} / provider searches=${boundary.searches.length}`)

  await realm.dispose()
  REPORT.scenarios.B = {
    verdict: 'MOUNTED + REFUSED AT THE FACE',
    mounted: true,
    faces: { fs: faces.fs, web: 'mounted', subprocess: faces.subprocess },
    networkAxis: effectiveOf(network).network.access,
    refusal: refusalCode(denial),
    refusalSearch: refusalCode(searchDenial),
    providerFetches: boundary.fetches.length,
    providerSearches: boundary.searches.length,
    dnsLookups: boundary.dnsLookups,
    connects: boundary.connects,
    hostWebCalls: HostWeb.calls,
    facts: factsAfter.map((fact) => ({ method: fact.method, decision: fact.decision, decidedBy: fact.decidedBy, locator: fact.locator })),
  }
}

// ── C. the caller: the REAL tool-web module through the REAL ToolRuntime ─────
async function scenarioC() {
  section('C. the real caller — pinned tool-web through route-C + ToolRuntime')
  const root = await makeRoot()
  const { agentKey, agent } = await makePresetScope(root, { withWeb: true })
  const boundary = fakeWebBoundary()
  const dir = tempDir('caller')
  const sink = join(dir, 'consult.jsonl')
  const network = 'deny'

  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sink }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: WEB_IDENTITY, policy: { ok: true, value: memberPolicy(network) } }],
        providerClass: BaseFs,
        web: { effective: effectiveOf(network), provider: boundary, realmId: 'realm-bl18-caller-deny' },
      }),
    }),
    member: {
      sessionId: 'session-bl18-caller',
      instanceId: WEB_IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-bl18',
      templateId: WEB_IDENTITY.templateId,
    },
  })
  const toolWebPath = join(HOST_TREE, 'packages', 'web', 'tool-web', 'lib', 'index.js')
  await row.attachA5sfNativeToolModules(
    realm,
    agent.ctx,
    row.a5sfRealmConfigOf({
      a5sfEvidencePath: sink,
      a5sfNativeToolModules: [{ url: toolWebPath, expectedTools: ['web_fetch', 'web_search'] }],
    }),
    agentKey,
  )
  const before = row.a5sfAgentToolSurface(agent.ctx, agentKey)
  assert.ok(before.has('web_fetch') && before.has('web_search'), 'the preset + shadow surface carries the pair')
  log(`C1 route-C attached the real module; surface={${[...before].sort().join(',')}}`)

  const result = await root.tools.execute({
    signal: new AbortController().signal,
    callId: 'bl18-web-fetch-deny',
    name: 'web_fetch',
    arguments: { url: DECLARED_URL },
    agent: agentKey,
  })
  const text = (Array.isArray(result?.content) ? result.content : [])
    .map((part) => (typeof part?.text === 'string' ? part.text : JSON.stringify(part))).join('\n')
  assert.equal(result.isError, true, 'the deny lane must not produce an admitted result')
  assert.match(text, /refusing before any provider call/)
  assert.equal(boundary.fetches.length, 0, 'zero provider fetches through the real tool call')
  assert.equal(HostWeb.calls, 0)
  const facts = (await factsOf(sink)).filter((fact) => String(fact.method).startsWith('web:'))
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
  log(`C2 web_fetch through ToolRuntime → isError=${result.isError} refusal at face; provider fetches=${boundary.fetches.length}; fact decidedBy=${facts[0].decidedBy}`)

  await realm.dispose()
  REPORT.scenarios.C = {
    verdict: 'REAL TOOL CALL REFUSED AT THE FACE',
    surface: [...before].sort(),
    isError: result.isError,
    providerFetches: boundary.fetches.length,
    hostWebCalls: HostWeb.calls,
    decidedBy: facts[0].decidedBy,
  }
}

// ── C2. the surface gate: no preset web → route-C REFUSES (surface ADDED) ────
async function scenarioC2() {
  section('C2. no preset web — route-C refuses to ADD the pair')
  const root = await makeRoot()
  const { agentKey, agent } = await makePresetScope(root, { withWeb: false })
  const boundary = fakeWebBoundary()
  const dir = tempDir('caller-nopreset')
  const sink = join(dir, 'consult.jsonl')

  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sink }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: WEB_IDENTITY, policy: { ok: true, value: memberPolicy('allow') } }],
        providerClass: BaseFs,
        web: { effective: effectiveOf('allow'), provider: boundary, realmId: 'realm-bl18-caller-nopreset' },
      }),
    }),
    member: {
      sessionId: 'session-bl18-nopreset',
      instanceId: WEB_IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-bl18',
      templateId: WEB_IDENTITY.templateId,
    },
  })
  const toolWebPath = join(HOST_TREE, 'packages', 'web', 'tool-web', 'lib', 'index.js')
  const caught = await row.attachA5sfNativeToolModules(
    realm,
    agent.ctx,
    row.a5sfRealmConfigOf({
      a5sfEvidencePath: sink,
      a5sfNativeToolModules: [{ url: toolWebPath, expectedTools: ['web_fetch', 'web_search'] }],
    }),
    agentKey,
  ).then(() => undefined, (error) => error)
  assert.notEqual(caught, undefined, 'route-C must refuse a surface-ADDING native mount')
  assert.match(String(caught?.message), /would CHANGE the Member's model-visible tool surface/)
  log(`C2 route-C refused without a preset web row: ${String(caught.message).slice(0, 150)}…`)

  await realm.dispose()
  REPORT.scenarios.C2 = {
    verdict: 'REFUSED AT ROUTE-C (surface added)',
    message: String(caught.message),
  }
}

// ── D. who may call: A2C-2's own classifier over the declared surfaces ───────
async function scenarioD() {
  section('D. caller analysis — A2C-2 on the declared surfaces')
  const managed = [...blueprintSchema.PERMISSION_TOOL_NAMES]
  const facts = { managedToolNames: managed, teamToolNames: [], mcpToolNames: [] }

  const strictAsDeclared = coverage.evaluatePermissionCoverage(['web_fetch', 'read'], facts)
  assert.equal(strictAsDeclared.ok, false, 'a surfaced web_fetch is a FATAL coverage finding')
  const entry = strictAsDeclared.unmanagedTools.find((tool) => tool.name === 'web_fetch')
  assert.equal(entry.classification, 'known-sensitive-unmanaged')
  log(`D1 strict surface with web_fetch → ok=${strictAsDeclared.ok} class=${entry.classification}`)

  const strictDenied = coverage.evaluatePermissionCoverage(['read'], facts)
  assert.equal(strictDenied.ok, true, 'denying web_fetch is coverage-clean')
  log('D2 strict surface with web_fetch DENIED → ok=true (coverage clean, and the tool is hidden)')

  const planeOwned = coverage.evaluatePermissionCoverage(['web_fetch', 'read'], {
    ...facts,
    teamToolNames: ['web_fetch'],
  })
  assert.equal(planeOwned.ok, true, 'a plane-owned web_fetch is coverage-clean — but that is the PLANE family, not this face')
  log('D3 plane-owned web_fetch → ok=true (only via the plane web family, which owns its own transport — NOT the realm face)')

  // The two facts that decide who may call, read from the product source.
  const agentBindings = readFileSync(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  const strictGate = /const permissionPolicy = boundTemplate\.capabilities\?\.permissions/.test(agentBindings)
  const denyOnlyWhenSelective = /if \(capabilities\.mode === 'selective'\) \{[\s\S]{0,200}applyBuiltInToolDeny/.test(agentBindings)
  const realmGatedOnSession = /if \(a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined && sessionId !== teamRoot\)/.test(agentBindings)
  assert.equal(strictGate, true, 'A2C-2 runs only when the template declares capabilities.permissions')
  assert.equal(denyOnlyWhenSelective, true, 'builtinToolDeny is applied only in selective capability mode')
  assert.equal(realmGatedOnSession, true, 'the realm mounts for a MEMBER session regardless of capabilities mode')
  log('D4 source: coverage gate keyed on capabilities.permissions; deny only in selective mode; realm mounts on any non-root session')

  REPORT.scenarios.D = {
    verdict: 'ONLY A NON-STRICT MEMBER CAN BE THE MODEL-FACING CALLER',
    strictAsDeclared: { ok: strictAsDeclared.ok, tool: 'web_fetch', classification: entry.classification },
    strictDenied: { ok: strictDenied.ok },
    planeOwned: { ok: planeOwned.ok, note: 'plane web family owns its own transport; not the BL-18 confined face' },
    sourceFacts: { strictGate, denyOnlyWhenSelective, realmGatedOnSession },
  }
}

// ── E. the code path that distinguishes the two refusals (quoted) ───────────
function scenarioE() {
  section('E. the two refusal positions, quoted from source')
  const webTs = readFileSync(join(REPO, 'packages', 'runtime', 'team-services', 'src', 'web.ts'), 'utf8')
  const mountTs = readFileSync(join(REPO, 'packages', 'runtime', 'team-services', 'src', 'mount.ts'), 'utf8')
  const productTs = readFileSync(join(REPO, 'packages', 'runtime', 'team-services', 'src', 'product-assembly.ts'), 'utf8')
  const lineOf = (text, needle) => text.split('\n').findIndex((line) => line.includes(needle)) + 1

  const positions = {
    'product-assembly.ts ceiling deny refusal': lineOf(productTs, 'narrows the network axis (mode='),
    'product-assembly.ts binding deny refusal': lineOf(productTs, 'narrows the network axis (${restriction.network}'),
    'web.ts face guard (deny lane + probe)': lineOf(webTs, 'export function createWebNetworkGuard'),
    'web.ts refusal throw': lineOf(webTs, "throw new TeamIoDenial("),
    'mount.ts composition refusal (module injects web, no face)': lineOf(mountTs, 'mounts no confined web face;'),
    'a5sf-realm-row.mjs single-source web fork refusal': lineOf(
      readFileSync(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8'),
      'two web-face sources for one Member realm is a fork',
    ),
    'a5sf-realm-row.mjs presence check (declared face cannot mount)': lineOf(
      readFileSync(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8'),
      'carries no mountable confined web face',
    ),
  }
  for (const [label, line] of Object.entries(positions)) log(`E  ${label}: line ${line}`)
  REPORT.scenarios.E = positions
}

// ── run ─────────────────────────────────────────────────────────────────────
let exitCode = 0
try {
  log(`a5sf BL-18 assembly proof — host-free (zero boots)`)
  log(`repo=${REPO}`)
  log(`host tree (read-only)=${HOST_TREE}`)
  await scenarioA()
  await scenarioB()
  await scenarioC()
  await scenarioC2()
  await scenarioD()
  scenarioE()
  section('VERDICT')
  log('PROVEN HOST-FREE: (A) the product config path refuses a network-deny ceiling/binding at')
  log('composition with NETWORK_UNCONFINED_REALM; (B) the teamA5sfRealm seam row MOUNTS a governed')
  log('realm carrying the compiled web face and refuses the fetch/search AT THE FACE with the same')
  log('typed word, zero provider/DNS/connect, one fact per call; (C) the REAL pinned tool-web module,')
  log('attached through the row route-C and driven through the REAL ToolRuntime, reaches that same')
  log('face refusal; (C2) route-C REFUSES the module when the preset does not already surface the')
  log('pair; (D) A2C-2 classifies web_fetch/web_search as known-sensitive-unmanaged, so the leader')
  log('must deny them and a strict Member cannot surface them either.')
  REPORT.verdict = 'PROVEN'
  REPORT.summary = 'config path refuses at composition; seam path mounts and refuses at the face; real tool call reaches the face; route-C needs a preset-surfaced pair; A2C-2 excludes strict callers'
} catch (error) {
  exitCode = 1
  REPORT.verdict = 'FAILED'
  REPORT.error = { message: String(error?.message ?? error), stack: String(error?.stack ?? '') }
  log('')
  log(`PROOF FAILED: ${String(error?.message ?? error)}`)
  if (error?.stack !== undefined) log(String(error.stack))
} finally {
  for (const dir of CLEANUP.splice(0).reverse()) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* cleanup only */ }
  }
}
REPORT.log = LINES
if (JSON_OUT !== undefined) writeFileSync(JSON_OUT, `${JSON.stringify(REPORT, null, 2)}\n`)
process.exitCode = exitCode
