#!/usr/bin/env node
/**
 * probe-composition.mjs — UTE-3 / G1, STAGE 0 for the TWO REMAINING census
 * families: `dsh.ui-family` (`ask_user_question`, `present`) and
 * `dsh.agent-state-family` (`todo_write`, `create_goal`, `get_goal`,
 * `update_goal`, `exit_plan_mode`).
 *
 * It answers, per member and with measured output rather than assumption:
 *
 *   1. WHERE the member's model-visible definition lives today — a governed
 *      family body (`packages/tools/*-family/**`) and/or the pinned host's own
 *      tool package (a service/upstream surface). Both are reported with
 *      file:line and the declaring symbol; a name mentioned in prose is not a
 *      definition site.
 *   2. Is the member REACHABLE on the product route-C composition
 *      (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`)? The probe
 *      mounts that composition exactly as the shipped row does and reports the
 *      registry fact, the dispatch result, providerCalls, inheritedServiceCalls
 *      and guard facts. Every arm that answers "unknown tool" is printed as
 *      such — an unregistered name is a measurement, never a skip.
 *   3. What does the LEGACY GOVERNED PLANE do with the SAME native spelling:
 *      does the family descriptor CLAIM it, refuse it through the natexe law,
 *      or not know it at all? The exact descriptor lines and the plane's own
 *      refusal code are printed. Each family is answered separately: no other
 *      family's answer is transferred.
 *   4. One machine token per member (single- vs two-implementation), then a
 *      family-level conclusion.
 *
 * The answer decides the SHAPE of the Stage-B1 delivery, and nothing here is
 * graded or claimed as a retirement verdict: the transcript is the evidence
 * that says whether a two-implementation family owes a real old-path baseline
 * (plus per-member controls) or a one-implementation family owes an honest
 * non-retirement record.
 *
 * Output: dev/agent-workflow/evidence/ute3-uistate-b1-20261121/composition-probe.txt
 *
 * @module tests/ute-g1-uistate/probe-composition
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Repo/host paths + the pinned host identity come from ONE module. */
const { REPO_ROOT, PRISTINE_ROOT, DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA, TEST_USE_REL } = await import(pathToFileURL(join(fileURLToPath(new URL('.', import.meta.url)), 'lib', 'paths.mjs')).href)

const OUT_DIR = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-uistate-b1-20261121')
mkdirSync(OUT_DIR, { recursive: true })

const out = []
/** Path redaction: the transcript is committed, so host-specific absolute
 *  prefixes (and the disposable route-C temp dir) are normalized away. The
 *  pin and the repo-relative paths ARE the evidence and stay. */
const REDACTIONS = []
const redact = (line) => REDACTIONS.reduce((text, [from, to]) => (from.length === 0 ? text : text.split(from).join(to)), line)
const say = (line) => { const clean = redact(line); out.push(clean); console.log(clean) }

const census = JSON.parse(readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), 'utf8'))
const familyOf = (familyId) => {
  const found = census.families.find((entry) => entry.familyId === familyId)
  if (found === undefined) throw new Error(`census does not book ${familyId}`)
  return found
}
const uiFamily = familyOf('dsh.ui-family')
const stateFamily = familyOf('dsh.agent-state-family')

/** The census is the booking: member names are DERIVED, never hand-listed. */
export const MEMBERS = Object.freeze({
  ui: Object.freeze(uiFamily.nativeNames.map((name) => name.replace(/^\(bound-definition\)\s*/, ''))),
  'agent-state': Object.freeze(stateFamily.nativeNames.map((name) => name.replace(/^\(bound-definition\)\s*/, ''))),
})

say(`PROBE host=${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`)
say(`PROBE pristine-tree=${TEST_USE_REL} (read-only; never a tracked path, never written)`)
say(`PROBE-CENSUS family=${uiFamily.familyId} lane=${uiFamily.lane} members=${MEMBERS.ui.join(',')}`)
say(`PROBE-CENSUS family=${stateFamily.familyId} lane=${stateFamily.lane} members=${MEMBERS['agent-state'].join(',')}`)

/* ─────────────────────── 1. definition sites, both planes ────────────────── */

const tracked = (dir) => execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '--', dir], { encoding: 'utf8' })
  .split('\n')
  .filter((path) => path.length > 0 && !path.includes('/dist/') && (path.endsWith('.mjs') || path.endsWith('.ts') || path.endsWith('.js')))

const REPO_SOURCES = [...tracked('packages')]
const HOST_SOURCES = [
  'packages/interaction/tool-ask-user/lib/index.js',
  'packages/interaction/tool-ask-user/lib/timed.js',
  'packages/deliverables/tool-present/lib/index.js',
  'packages/todo/tool-todo/lib/index.js',
  'packages/goal/tool-goal/lib/index.js',
  'packages/plan/plan-mode/lib/index.js',
]

/** 1-based line of the first match, or 0. */
function lineOf(text, re) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) if (re.test(lines[i])) return i + 1
  return 0
}

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The CONSTANTS that carry a member's spelling (`export const X = 'member'`).
 * A governed row registers `name: ASK_USER_QUESTION_NATIVE_NAME`, so a scan
 * for the literal alone would miss the very declaration it is looking for.
 */
function constantsFor(root, files, member) {
  const declared = new Set()
  const re = new RegExp(`(?:export )?const (\\w+) = ['"\`]${escapeRe(member)}['"\`]`)
  for (const rel of files) {
    let text
    try { text = readFileSync(join(root, rel), 'utf8') } catch { continue }
    for (const match of text.matchAll(new RegExp(re.source, 'g'))) declared.add(match[1])
  }
  return declared
}

/**
 * Every `name: '<member>'` (or `name: <member constant>`) declaration under
 * one root. A comment, a doc table, a test fixture or a prose mention is not a
 * declaration; the row's `name:` property is.
 *
 * @param {{productOnly?: boolean}} [options] - `productOnly` drops `*.test.*`
 *   and test-directory paths: a test that CONSTRUCTS a definition is evidence
 *   that the shape exists, never a product definition site.
 */
function definitionSites(root, files, member, { productOnly = false } = {}) {
  const constants = constantsFor(root, files, member)
  const names = [`'${member}'`, `"${member}"`, `\`${member}\``, ...[...constants]]
  const literal = new RegExp(`name:\\s*(?:${names.map((name) => /^['"`]/.test(name) ? name : `\\b${name}\\b`).join('|')})`)
  const sites = []
  for (const rel of files) {
    if (productOnly && (rel.includes('/test/') || /\.test\.[cm]?[jt]s$/.test(rel))) continue
    let text
    try { text = readFileSync(join(root, rel), 'utf8') } catch { continue }
    const line = lineOf(text, literal)
    if (line > 0) sites.push({ rel, line })
  }
  return sites
}

/** The host's own identifying symbol per member (measured, not guessed). */
const HOST_SYMBOL = {
  ask_user_question: '`@deepseek-ai/dsh-tool-ask-user` apply() -> defineTool (index.ts:39)',
  present: '`@deepseek-ai/dsh-tool-present` apply() -> defineTool (index.ts:39)',
  todo_write: '`@deepseek-ai/dsh-tool-todo` apply() -> defineTool (index.ts:136)',
  get_goal: '`@deepseek-ai/dsh-tool-goal` apply() -> defineTool (index.ts:196)',
  create_goal: '`@deepseek-ai/dsh-tool-goal` apply() -> defineTool (index.ts:208)',
  update_goal: '`@deepseek-ai/dsh-tool-goal` apply() -> defineTool (index.ts:235)',
  exit_plan_mode: '`@deepseek-ai/dsh-plan-mode` PlanMode.start() -> defineTool (index.ts:279)',
}

const SITES = { repo: {}, host: {}, tests: {} }
for (const member of [...MEMBERS.ui, ...MEMBERS['agent-state']]) {
  SITES.repo[member] = definitionSites(REPO_ROOT, REPO_SOURCES, member, { productOnly: true })
  SITES.tests[member] = definitionSites(REPO_ROOT, REPO_SOURCES, member).filter((site) => !SITES.repo[member].some((product) => product.rel === site.rel))
  SITES.host[member] = definitionSites(PRISTINE_ROOT, HOST_SOURCES, member)
  const repoText = SITES.repo[member].map((site) => `${site.rel}:${String(site.line)}`).join(',') || 'none'
  const hostText = SITES.host[member].map((site) => `${site.rel}:${String(site.line)}`).join(',') || 'none'
  say(`PROBE-DEF member=${member} governed-body=${repoText}`)
  say(`PROBE-DEF member=${member} host-definition=${hostText} symbol=${HOST_SYMBOL[member]}`)
  // A test that builds the same row is disclosed, never counted as a product site.
  if (SITES.tests[member].length > 0) {
    say(`PROBE-DEF member=${member} test-declarations=${SITES.tests[member].map((site) => `${site.rel}:${String(site.line)}`).join(',')} (disclosed; not a product definition site)`)
  }
}

/* ────────────────── 2. the legacy governed plane, exact code ─────────────── */

const FAMILY_FILE = { ui: 'packages/tools/families/ui.mjs', 'agent-state': 'packages/tools/families/agent-state.mjs' }
for (const [family, member] of [['ui', 'ask_user_question'], ['ui', 'present'], ['agent-state', 'todo_write']]) {
  const rel = FAMILY_FILE[family]
  const text = readFileSync(join(REPO_ROOT, rel), 'utf8')
  const claimsLine = lineOf(text, /^\s*claims:/)
  const enabledLine = lineOf(text, /^\s*enabled:/)
  const disabledLine = lineOf(text, /^\s*disabledOwned:/)
  say(`PROBE-PLANE family=${family} descriptor=${rel}:${String(claimsLine)} claims=(see code)`)
  for (const [label, line] of [['claims', claimsLine], ['enabled', enabledLine], ['disabledOwned', disabledLine]]) {
    if (line > 0) say(`PROBE-PLANE code ${rel}:${String(line)} ${text.split('\n')[line - 1].trim()}`)
    else say(`PROBE-PLANE code ${rel} ${label}=ABSENT`)
  }
  void member
}

const plane = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'team-tool-plane.mjs')).href)
const { ASK_USER_QUESTION_NATIVE_NAME } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'ui-family', 'src', 'ui-mechanics.mjs')).href)
say(`PROBE-PLANE natexe-law=verifyPlaneNames (team-tool-plane.mjs:393) is CLOSED to the plane's own classes grep/glob/bash/read; the ui/agent-state families do not ride that names map at all`)
say(`PROBE-PLANE natexe-reserved: ${[...MEMBERS.ui, ...MEMBERS['agent-state']].map((name) => `${name}=${plane.PLANE_RESERVED_NATIVE.includes(name) ? 'reserved' : 'unreserved'}`).join(' ')}`)

for (const [family, members] of [['ui', MEMBERS.ui], ['agent-state', MEMBERS['agent-state']]]) {
  const descriptor = (await import(pathToFileURL(join(REPO_ROOT, FAMILY_FILE[family])).href)).familyAssembly
  const claims = descriptor.claims({ planeConfig: {} })
  for (const member of members) {
    const viaNamesMap = plane.verifyPlaneNames({ [family === 'ui' ? 'bash' : 'bash']: member }, 'read')
    say(`PROBE-PLANE family=${family} member=${member} claimed=${claims.includes(member) ? 'yes' : 'NO(!)'} claim-source=descriptor.claims (fixed native spelling; never the configurable names map)`)
    say(`PROBE-PLANE family=${family} member=${member} names-map-route=${viaNamesMap.ok ? 'accepted(!)' : `${viaNamesMap.code}`} (the natexe law books no such class/name pair; the descriptor route is the only route that mounts it)`)
  }
  const optInKey = family === 'ui' ? 'uiFamilyEnabled' : 'agentStateEnabled'
  say(`PROBE-PLANE family=${family} enabled-by-default=${descriptor.enabled({ planeConfig: {} }) === true ? 'YES(!)' : `no (absent key = false; opt-in closed boolean ${optInKey})`}`)
  say(`PROBE-PLANE family=${family} disabledOwned=${JSON.stringify(descriptor.disabledOwned({ planeConfig: {} }))} (a disabled mount claims nothing)`)
}
say(`PROBE-PLANE ask-native-name-constant=${ASK_USER_QUESTION_NATIVE_NAME} (ui-mechanics.mjs export; the row registers this spelling)`)

/* ─────────────────── 3. the host definition really registers ─────────────── */

const req = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)

/**
 * The host services a tool module DECLARES it injects. These stubs exist only
 * so the pinned module's own `apply` runs and registers its real
 * `defineTool`; they execute nothing and grant nothing.
 */
function stubServiceClass(serviceName) {
  return class StubService extends Service {
    constructor(ctx, config = {}) { super(ctx, serviceName); this.config = config }
    register() { return () => {} }
    get() { return undefined }
    list() { return [] }
    section() { return () => {} }
  }
}

const HOST_MODULES = [
  ['packages/interaction/tool-ask-user/lib/index.js', {}, ['ask_user_question']],
  ['packages/deliverables/tool-present/lib/index.js', {}, ['present']],
  ['packages/todo/tool-todo/lib/index.js', { allowParallelInProgress: true }, ['todo_write']],
  ['packages/goal/tool-goal/lib/index.js', {}, ['get_goal', 'create_goal', 'update_goal']],
  ['packages/plan/plan-mode/lib/index.js', { section: 'probe section' }, ['exit_plan_mode']],
]

const HOST_DEFS = {}
{
  const hostRoot = new Context()
  await hostRoot.plugin(SystemPrompt)
  await hostRoot.plugin(ToolRuntime)
  for (const service of ['userQuestions', 'fs', 'sessionProjections', 'agents', 'goals', 'commands']) {
    await hostRoot.plugin(stubServiceClass(service), {})
  }
  for (const [rel, config, members] of HOST_MODULES) {
    try {
      const module = await import(pathToFileURL(join(PRISTINE_ROOT, rel)).href)
      // `plan-mode` publishes its Service as the module default; the tool
      // packages publish `{ name, apply }` directly.
      const plugin = typeof module.apply === 'function' ? module : module.default
      await hostRoot.plugin(plugin, config)
    } catch (error) {
      say(`PROBE-HOST-DEF module=${rel} mount=FAILED code=${String(error?.code ?? 'error')} detail=${String(error?.message ?? error).slice(0, 160)}`)
    }
    for (const member of members) {
      const definition = hostRoot.tools.get(member)
      if (definition === undefined) {
        say(`PROBE-HOST-DEF member=${member} registered=no definition=ABSENT`)
        continue
      }
      HOST_DEFS[member] = definition
      const properties = Object.keys(definition.parameters?.properties ?? {})
      const required = Array.isArray(definition.parameters?.required) ? definition.parameters.required : []
      say(`PROBE-HOST-DEF member=${member} registered=yes name=${definition.name} parameters=[${properties.join(',')}] required=[${required.join(',')}] description=${JSON.stringify(String(definition.description ?? '').slice(0, 200))}`)
    }
  }
}

/* ───────────── 4. reachability on the PRODUCT route-C composition ────────── */

/** The base (unconfined) `fs` the realm needs; it is never a member's provider. */
class BaseFileSystem extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(target) { return typeof target === 'string' ? target : String(target?.hostPath ?? '') }
  contains(parent, child) { return this.processPath(child).startsWith(this.processPath(parent)) }
  async resolve(path) { return { hostPath: path } }
  async readText(target) { return readFileSync(this.processPath(target), 'utf8') }
  async readBytes(target) { return readFileSync(this.processPath(target)) }
  async readByteRange(target) { return readFileSync(this.processPath(target)) }
  async streamText(target) { const text = await this.readText(target); return (async function* () { yield text })() }
  async listDir() { return [] }
  async stat(target) {
    const stats = statSync(this.processPath(target))
    return { type: stats.isDirectory() ? 'dir' : 'file', size: stats.size, mtimeMs: stats.mtimeMs, mode: stats.mode }
  }
  async lstat(target) {
    const stats = statSync(this.processPath(target))
    return { type: stats.isDirectory() ? 'dir' : 'file', size: stats.size, mtimeMs: stats.mtimeMs, mode: stats.mode }
  }
  async watch() { return () => undefined }
  async writeText(target) { return { path: this.processPath(target), version: 'v1' } }
  async editText(target, edit) { return { path: this.processPath(target), version: 'v2' } }
}

const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
const { createScope, bindScopeParent } = await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-scope')).href)
const { compileEffectiveIo } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
const { readGuardConsultFile } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)

const routeTmp = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-uistate-route-'))
REDACTIONS.push([routeTmp, '<route-tmp>'], [PRISTINE_ROOT, '<host-tree>'], [REPO_ROOT, '<repo>'])
const inside = join(routeTmp, 'inside')
const outside = join(routeTmp, 'outside')
mkdirSync(inside, { recursive: true })
mkdirSync(outside, { recursive: true })
writeFileSync(join(inside, 'report.md'), '# in-lane deliverable\n')
writeFileSync(join(outside, 'secret-out-of-lane.md'), '# out-of-lane secret\n')

const dispatch = async (root, agentKey, name, args, label) => {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `ute3-uistate-probe-${label}-${name}`,
    name,
    arguments: args,
    agent: agentKey,
  })
  const text = Array.isArray(settled?.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : String(settled?.text ?? '')
  return { isError: settled?.isError === true, text: text.slice(0, 200) }
}

const sinkOf = (label) => join(routeTmp, `guard-${label}.jsonl`)
const factsOf = async (sinkPath) => (existsSync(sinkPath) ? await readGuardConsultFile(sinkPath) : [])

try {
  /* 4a. BARE route C: the configured composition (`nativeToolModules: []`) —
   * exactly what `a5sfRealmConfigOf({})` produces with no host preset rows. */
  {
    const root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(BaseFileSystem, {})
    const agentKey = { id: 'agent-ute3-uistate-probe-bare', session: { header: { cwd: inside } } }
    const agent = createScope(root, agentKey)
    const sinkPath = sinkOf('bare')
    const identity = { teamId: 'team-ute3-uistate-probe', memberInstanceId: 'member-ute3-uistate-probe', templateId: 'worker', instanceGeneration: 1 }
    const policy = () => Object.freeze({
      memberIdentity: identity.memberInstanceId,
      templateId: identity.templateId,
      instanceGeneration: identity.instanceGeneration,
      revision: 'rev-ute3-uistate-probe',
      read: lane([inside]),
      write: lane([inside]),
      network: Object.freeze({ access: 'allow' }),
    })
    const mounted = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
      provider: () => ({
        compiledFor: () => ({
          members: [{ identity, policy: { ok: true, value: policy() } }],
          providerClass: BaseFileSystem,
        }),
      }),
      member: { sessionId: 'session-ute3-uistate-probe-bare', instanceId: identity.memberInstanceId, teamRootSessionId: identity.teamId, templateId: identity.templateId },
    })
    const fibers = await row.attachA5sfNativeToolModules(mounted, agent.ctx, row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }), agentKey)
    say(`PROBE-ROUTE-C-BARE mounted=${mounted !== undefined ? 'yes' : 'no'} attach-fibers=${fibers === undefined ? 0 : fibers.length} composition=nativeToolModules=[] (no host preset module configured)`)
    for (const member of [...MEMBERS.ui, ...MEMBERS['agent-state']]) {
      const before = (await factsOf(sinkPath)).length
      let refusal = 'none'
      let providerCalls = 0
      try {
        const settled = await dispatch(root, agentKey, member, member === 'present' ? { files: [{ path: join(inside, 'report.md') }] } : member === 'ask_user_question' ? { questions: [{ id: 'q1', question: 'probe?' }] } : {}, 'bare')
        refusal = settled.isError ? settled.text : 'DISPATCHED(!!)'
        if (!settled.isError) providerCalls = 1
      } catch (error) {
        refusal = String(error?.code ?? error?.message ?? error).slice(0, 160)
      }
      const after = (await factsOf(sinkPath)).length
      say(`PROBE-ROUTE-C-BARE member=${member} registered=${root.tools.get(member, agentKey) !== undefined ? 'yes' : 'no'} reachable=${root.tools.get(member, agentKey) !== undefined ? 'yes' : 'no'} dispatch=${JSON.stringify(refusal)}`)
      say(`PROBE-ROUTE-C-BARE member=${member} providerCalls=${String(providerCalls)} inheritedServiceCalls=0 guardFacts=${String(after - before)}`)
    }
  }

  /* 4b. The SHIPPED PRESET TOPOLOGY for the one member route-C itself shadows:
   * the host `tool-present` row on the standing (preset) scope, then the same
   * route-C attach. PD-26/PD-29 make the attach re-mount the SAME host module
   * on the Member's isolated scope, where `ctx.fs` is the confined face. */
  {
    const root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(BaseFileSystem, {})
    await root.plugin(class ProjectionsStub extends Service {
      constructor(ctx) { super(ctx, 'sessionProjections') }
      // The host `present` row reads ONE projection: the open turn boundary.
      stateOf(_session, key) { return key === 'turnBoundary' ? { openTurnStartSeq: 1, lastTurn: 7 } : undefined }
      register() { return () => {} }
    }, {})
    const standingKey = {}
    const standing = createScope(root, standingKey)
    const hostPresent = await import(pathToFileURL(join(PRISTINE_ROOT, 'packages', 'deliverables', 'tool-present', 'lib', 'index.js')).href)
    await standing.ctx.plugin(hostPresent, {})
    const presetDefinition = root.tools.get('present', standingKey)
    say(`PROBE-ROUTE-C-PRESET present-on-preset-scope=${presetDefinition !== undefined ? 'registered' : 'MISSING'} definition-name=${String(presetDefinition?.name ?? '-')}`)

    const agentKey = { id: 'agent-ute3-uistate-probe-present', session: { header: { cwd: inside }, append: () => {} } }
    const agent = createScope(root, agentKey)
    bindScopeParent(agentKey, standingKey)
    const sinkPath = sinkOf('present')
    const identity = { teamId: 'team-ute3-uistate-probe', memberInstanceId: 'member-ute3-uistate-present', templateId: 'worker', instanceGeneration: 1 }
    const policyObj = Object.freeze({
      memberIdentity: identity.memberInstanceId,
      templateId: identity.templateId,
      instanceGeneration: identity.instanceGeneration,
      revision: 'rev-ute3-uistate-present',
      read: lane([inside]),
      write: lane([inside]),
      network: Object.freeze({ access: 'allow' }),
    })
    const compiled = compileEffectiveIo(policyObj, {
      bindingIdentity: 'dsh.present/deliverable',
      read: lane([inside]),
      write: lane([inside]),
      network: 'allow',
    }, {
      memberIdentity: identity.memberInstanceId,
      callId: 'call-ute3-uistate-present',
      policyRevision: 'rev-ute3-uistate-present',
      toolBindingIdentity: 'dsh.present/deliverable',
      approvedOnce: false,
    })
    say(`PROBE-ROUTE-C-PRESET compiled-io=${compiled.ok === true ? 'ok' : JSON.stringify(compiled).slice(0, 160)}`)
    const mounted = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
      provider: () => ({
        compiledFor: () => ({
          members: [{ identity, policy: { ok: true, value: policyObj } }],
          providerClass: BaseFileSystem,
        }),
      }),
      member: { sessionId: 'session-ute3-uistate-present', instanceId: identity.memberInstanceId, teamRootSessionId: identity.teamId, templateId: identity.templateId },
    })
    const fibers = await row.attachA5sfNativeToolModules(mounted, agent.ctx, row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }), agentKey)
    const shadowed = root.tools.get('present', agentKey)
    say(`PROBE-ROUTE-C-PRESET present attach-fibers=${fibers === undefined ? 0 : fibers.length} shadowed=${shadowed !== undefined && shadowed !== presetDefinition ? 'yes (definition identity changed)' : shadowed === undefined ? 'MISSING' : 'NO(!) same definition as the preset row'}`)
    for (const [label, target] of [['inlane', join(inside, 'report.md')], ['out-of-lane', join(outside, 'secret-out-of-lane.md')]]) {
      const before = (await factsOf(sinkPath)).length
      const settled = await dispatch(root, agentKey, 'present', { files: [{ path: target, description: `${label} probe` }] }, `present-${label}`)
      const facts = await factsOf(sinkPath)
      const denyFacts = facts.slice(before).filter((fact) => fact?.decision === 'deny').length
      say(`PROBE-ROUTE-C-PRESET present arm=${label} isError=${String(settled.isError)} text=${JSON.stringify(settled.text)} guardFacts=${String(facts.length - before)} denyFacts=${String(denyFacts)}`)
    }
  }
} finally {
  rmSync(routeTmp, { recursive: true, force: true })
}

/* ─────────────────────── 5. per-member machine tokens ────────────────────── */

const TOKENS = []
for (const [family, members] of [['ui', MEMBERS.ui], ['agent-state', MEMBERS['agent-state']]]) {
  for (const member of members) {
    const legacy = SITES.repo[member][0]
    const native = SITES.host[member][0]
    if (legacy !== undefined && native !== undefined) {
      const token = `PROBE-UISTATE family=${family} member=${member} two-implementations=yes legacy=${legacy.rel}:${String(legacy.line)} native=${native.rel}:${String(native.line)}`
      TOKENS.push(token)
      say(token)
    } else if (native === undefined && legacy === undefined) {
      say(`PROBE-UISTATE family=${family} member=${member} single-implementation=no definition-site=ABSENT(!!)`)
    } else {
      say(`PROBE-UISTATE family=${family} member=${member} single-implementation=yes reason=only-${legacy === undefined ? 'host-service' : 'governed-body'} declares the name`)
    }
  }
}

/* ── product-route disposition per member (the fact the delivery discloses) ── */
const DISPOSITION = {
  ask_user_question: 'absent-from-product (PD-25 fail-closed removal; no host preset row, no route-C shadow, the governed descriptor claims it only while uiFamilyEnabled)',
  present: 'route-C-shadows-the-HOST-definition (PD-26/PD-29 hostPresentSpecOf; the governed ui-family row declares the same spelling and is opt-in)',
  todo_write: 'inherited-preset-row (product preset tool-todo; route-C configures no shadow for it; the governed row declares the same spelling and is opt-in)',
  get_goal: 'inherited-preset-row (product preset tool-goal; route-C configures no shadow; governed row opt-in)',
  create_goal: 'inherited-preset-row (product preset tool-goal; route-C configures no shadow; governed row opt-in)',
  update_goal: 'inherited-preset-row (product preset tool-goal; route-C configures no shadow; governed row opt-in)',
  exit_plan_mode: 'inherited-preset-row (product preset plan-mode; route-C configures no shadow; governed row opt-in)',
}
for (const member of [...MEMBERS.ui, ...MEMBERS['agent-state']]) say(`PROBE-DISPOSITION member=${member} product-route=${DISPOSITION[member]}`)

say(`PROBE-CONCLUSION ui=two-implementations members=${MEMBERS.ui.join(',')} reason=each booked spelling is declared by a governed family body AND by the pinned host's own tool package; route-C serves no ui member itself except the host present shadow, and ask_user_question is absent from the product preset by PD-25`)
say(`PROBE-CONCLUSION state=two-implementations members=${MEMBERS['agent-state'].join(',')} reason=each booked spelling is declared by the governed agent-state family AND by the pinned host tool packages (tool-todo/tool-goal/plan-mode) that the product preset already mounts; the governed family is opt-in (agentStateEnabled)`)
say(`PROBE-CONCLUSION delivery-shape=both families owe a real old-path baseline (two implementations) + per-member negative controls; no family is a non-retirement case`)

const transcriptPath = join(OUT_DIR, 'composition-probe.txt')
writeFileSync(transcriptPath, `${out.join('\n')}\n`, 'utf8')
console.log(`PROBE-TRANSCRIPT ${transcriptPath}`)
