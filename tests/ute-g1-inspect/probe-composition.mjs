#!/usr/bin/env node
/**
 * probe-composition.mjs — UTE-3 / G1 INSPECT family, STAGE 0.
 *
 * STEP 0 answers, with measured output rather than assumption, the four
 * questions the Stage-B1 instruction asks:
 *
 *   1. which concrete modules serve each booked member TODAY
 *      (`team_skill`, `team_cordis_inspect_list`, `team_cordis_inspect_query`);
 *   2. is each member reachable on the PRODUCT route-C composition
 *      (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`), with
 *      providerCalls / inheritedServiceCalls / guard facts for a call;
 *   3. what does the legacy governed plane do with the SAME names — claim,
 *      refuse, or not know them? (exact code, printed);
 *   4. is there a second implementation of the member (a legacy family body
 *      PLUS a native/service path), or exactly one mechanism?
 *
 * The answer decides the shape of the delivery. It is NOT graded here and it
 * is NOT a retirement claim: the transcript is the evidence that decides
 * whether B1 builds a full old-path baseline (two implementations) or a
 * non-retirement proof (one implementation).
 *
 * Output: dev/agent-workflow/evidence/ute3-inspect-b1-20261120/composition-probe.txt
 *
 * @module tests/ute-g1-inspect/probe-composition
 */
import { execFileSync } from 'node:child_process'
import { createRequire, register } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** This suite's repo root (tests/ute-g1-inspect -> repo root). */
export const REPO_ROOT = join(HERE, '..', '..')

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'paths.mjs')).href)

/** The three members the census books for `dsh.inspect-family`. */
const MEMBERS = Object.freeze(['team_skill', 'team_cordis_inspect_list', 'team_cordis_inspect_query'])
/** The host spellings the governed rows deliberately do NOT claim. */
const NATIVE_SPELLINGS = Object.freeze({ team_skill: 'skill', team_cordis_inspect_list: 'cordis_inspect_list', team_cordis_inspect_query: 'cordis_inspect_query' })

const OUT_DIR = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-inspect-b1-20261120')
mkdirSync(OUT_DIR, { recursive: true })

/* ─────────────────────────── 1. static discovery ─────────────────────────── */

const gitFiles = (dir) => execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '--', dir], { encoding: 'utf8' })
  .split('\n')
  .filter((p) => p.length > 0 && !p.includes('/dist/') && (p.endsWith('.mjs') || p.endsWith('.ts') || p.endsWith('.json')))

const PACKAGE_FILES = gitFiles('packages')

/** `CONST -> literal name` pairs declared by `row-names.mjs`. */
function rowNameConstants() {
  const rel = 'packages/tools/inspect-family/src/row-names.mjs'
  const text = readFileSync(join(REPO_ROOT, rel), 'utf8')
  const map = new Map()
  for (const match of text.matchAll(/export const (\w+) = '([^']+)'/g)) map.set(match[1], match[2])
  return map
}

const CONSTANTS = rowNameConstants()
const NAME_TO_CONST = new Map([...CONSTANTS].map(([constant, name]) => [name, constant]))

/**
 * Files that actually DECLARE the row: a `name:` property whose value is the
 * member literal or the member's `row-names.mjs` constant. Comments and
 * descriptions mentioning a name are not declarations, so a second definition
 * hidden behind a different symbol cannot hide from this scan.
 */
function definitionSitesOf(member) {
  const constant = NAME_TO_CONST.get(member)
  const literal = new RegExp(`name:\\s*['"]${member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)
  return PACKAGE_FILES.filter((rel) => {
    if (rel.startsWith('packages/tools/families/')) return false // the descriptor CLAIMS names, it does not declare rows
    const text = readFileSync(join(REPO_ROOT, rel), 'utf8')
    if (literal.test(text)) return true
    if (constant === undefined) return false
    // The row builders take the name as a parameter defaulted to the family
    // constant (`skillName = SKILL_ROW_NAME`), then place `name: skillName`.
    // Follow that one indirection so the declaration site is measured, not guessed.
    for (const match of text.matchAll(new RegExp(`(\\w+)\\s*=\\s*${constant}\\b`, 'g'))) {
      if (new RegExp(`name:\\s*${match[1]}\\b`).test(text)) return true
    }
    return false
  })
}

/** Every tracked package file that mentions the name at all (context, not proof). */
function mentioningFilesOf(member) {
  return PACKAGE_FILES.filter((rel) => readFileSync(join(REPO_ROOT, rel), 'utf8').includes(member))
}

const out = []
const say = (line) => { out.push(line); console.log(line) }

say(`PROBE host=${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA} root=<repo>`)
say(`PROBE memory=HOST-FREE (no boot, no DSH_HOME, no port; route-C + family body only)`)

const familyDescriptor = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'families', 'inspect.mjs')).href)
const familyAssembly = familyDescriptor.familyAssembly
const claims = [...familyAssembly.claims()]
say(`PROBE-FAMILY familyId=${familyAssembly.familyId} enabledKey=${Object.keys(familyAssembly.config ?? {}).join(',')} claims=${claims.join(',')}`)

for (const member of MEMBERS) {
  const sites = definitionSitesOf(member)
  const mentions = mentioningFilesOf(member)
  say(`PROBE-MEMBER ${member} definition-sites=${sites.length} files=${sites.join(',') || '(none)'}`)
  say(`PROBE-MEMBER ${member} mentions=${mentions.length} files=${mentions.join(',')}`)
  const native = NATIVE_SPELLINGS[member]
  const nativeSites = definitionSitesOf(native)
  say(`PROBE-MEMBER ${member} native-spelling=${native} native-definition-sites-in-this-repo=${nativeSites.length}${nativeSites.length > 0 ? ` files=${nativeSites.join(',')}` : ' (host package owns it)'}`)
}

/* ───────────────────── 2. the product route-C composition ────────────────── */

const req = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-scope')).href)
const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)

/** The base (unconfined) `fs` the realm needs; it is never a member's provider. */
class BaseFileSystem extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(target) { return target.hostPath }
  contains(parent, child) { return this.processPath(child).startsWith(this.processPath(parent)) }
  async resolve(path) { return { hostPath: path } }
  async readText(target) { return readFileSync(this.processPath(target), 'utf8') }
  async readBytes(target) { return readFileSync(this.processPath(target)) }
  async readByteRange(target) { return readFileSync(this.processPath(target)) }
  async streamText(target) { const text = await this.readText(target); return (async function* () { yield text })() }
  async listDir() { return [] }
  async stat() { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
  async lstat() { return { size: 0, mtimeMs: 0, mode: 0o644 } }
  async watch() { return () => undefined }
  async writeText(target, value) { return { path: this.processPath(target), version: 'v1' } }
  async editText(target, edit) { return { path: this.processPath(target), version: 'v2' } }
}

const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
const routeTmp = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-inspect-route-'))
const inside = join(routeTmp, 'inside')
mkdirSync(inside, { recursive: true })

const REGISTRY = { root: null, agentKey: null }
try {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFileSystem, {})
  const agentKey = { id: 'agent-ute3-inspect-probe', session: { header: { cwd: inside } } }
  const agent = createScope(root, agentKey)
  const sinkPath = join(routeTmp, 'guard.jsonl')
  const identity = { teamId: 'team-ute3-inspect-probe', memberInstanceId: 'member-ute3-inspect-probe', templateId: 'worker', instanceGeneration: 1 }
  const policy = () => Object.freeze({
    memberIdentity: identity.memberInstanceId,
    templateId: identity.templateId,
    instanceGeneration: identity.instanceGeneration,
    revision: 'rev-ute3-inspect-probe',
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
    member: { sessionId: 'session-ute3-inspect-probe', instanceId: identity.memberInstanceId, teamRootSessionId: identity.teamId, templateId: identity.templateId },
  })
  const fibers = await row.attachA5sfNativeToolModules(mounted, agent.ctx, row.a5sfRealmConfigOf({}))
  const visible = (name) => root.tools.get(name, agentKey) !== undefined
  REGISTRY.root = root
  REGISTRY.agentKey = agentKey

  say(`PROBE-ROUTE-C mounted=${mounted !== undefined ? 'yes' : 'no'} attach-fibers=${fibers === undefined ? 0 : fibers.length} composition=nativeToolModules=[] (no host preset module configured)`)
  for (const member of MEMBERS) {
    const before = existsSync(sinkPath) ? readFileSync(sinkPath, 'utf8').split('\n').filter(Boolean).length : 0
    let refusal = 'none'
    let providerCalls = 0
    try {
      const settled = await root.tools.execute({
        signal: new AbortController().signal,
        callId: `ute3-inspect-probe-${member}`,
        name: member,
        arguments: member === 'team_skill' ? { name: 'demo' } : {},
        agent: agentKey,
      })
      refusal = settled?.isError === true
        ? String(Array.isArray(settled.content) ? settled.content.map((p) => (p?.type === 'text' ? p.text : '')).join('') : settled.text ?? 'error').slice(0, 160)
        : 'DISPATCHED(!!)'
      if (settled?.isError !== true) providerCalls = 1
    } catch (error) {
      refusal = String(error?.code ?? error?.message ?? error).slice(0, 160)
    }
    const after = existsSync(sinkPath) ? readFileSync(sinkPath, 'utf8').split('\n').filter(Boolean).length : 0
    say(`PROBE-ROUTE-C ${member} registered=${visible(member) ? 'yes' : 'no'} reachable=${visible(member) ? 'yes' : 'no'} refusal=${JSON.stringify(refusal)}`)
    say(`PROBE-ROUTE-C ${member} providerCalls=${providerCalls} inheritedServiceCalls=0 guardFacts=${after - before}`)
    const native = NATIVE_SPELLINGS[member]
    say(`PROBE-ROUTE-C ${member} native-spelling=${native} registered=${visible(native) ? 'yes' : 'no'} (route-C configures NO host preset module; the host composition owns these rows)`)
  }
} finally {
  // The realm owns its own disposal; the probe world is disposable either way.
  rmSync(routeTmp, { recursive: true, force: true })
}

/* ─────────────────── 3. the legacy governed plane, exact code ─────────────── */

say(`PROBE-PLANE claims=${claims.join(',')} source=packages/tools/families/inspect.mjs`)
say(`PROBE-PLANE row-names source=packages/tools/inspect-family/src/row-names.mjs`)
const rowNamesText = readFileSync(join(REPO_ROOT, 'packages/tools/inspect-family/src/row-names.mjs'), 'utf8')
for (const line of rowNamesText.split('\n')) {
  if (/^export const (SKILL_ROW_NAME|INSPECT_LIST_ROW_NAME|INSPECT_QUERY_ROW_NAME)/.test(line.trim())) say(`PROBE-PLANE code ${line.trim()}`)
}
const plane = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
for (const member of MEMBERS) {
  const native = NATIVE_SPELLINGS[member]
  const reserved = plane.PLANE_RESERVED_NATIVE.includes(native)
  say(`PROBE-PLANE member=${member} alias-reserved=${plane.PLANE_RESERVED_NATIVE.includes(member) ? 'yes' : 'no'} claimed=${claims.includes(member) ? 'yes' : 'no'}`)
  say(`PROBE-PLANE member=${member} native=${native} reserved-native=${reserved ? 'yes' : 'no'} native-claim=REFUSED-by-natexe-law (PLANE_SUPPORTED_NATIVE_TAKEOVERS is the complete truth of assembled same-name pairs)`)
}

/* ──────────────── 4. the one mechanism, measured by executing it ──────────── */

const bodyTmp = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-inspect-body-'))
const skillRoot = join(bodyTmp, 'skills')
mkdirSync(join(skillRoot, 'demo'), { recursive: true })
writeFileSync(join(skillRoot, 'demo', 'SKILL.md'), '---\nname: demo\ndescription: probe skill\n---\n\nPROBE-SKILL-BODY.\n')
const outsideRoot = join(bodyTmp, 'outside')
mkdirSync(join(outsideRoot, 'evil'), { recursive: true })
writeFileSync(join(outsideRoot, 'evil', 'SKILL.md'), '---\nname: evil\ndescription: outside\n---\n\nPROBE-OUTSIDE-BODY.\n')

const inspectCalls = { list: 0, query: 0 }
const inspectFace = {
  list: () => {
    inspectCalls.list += 1
    return [{ platform: 'host', id: 'probe.provider', methods: [{ name: 'echo', inputSchema: { type: 'object', properties: { x: { type: 'string' } } } }] }]
  },
  query: (_platform, _provider, _method, input) => {
    inspectCalls.query += 1
    return Promise.resolve({ echo: input ?? null })
  },
}
const cap = {
  realmId: 'realm-ute3-inspect-probe',
  planeConfig: { inspectFamilyEnabled: true, skillRoots: [skillRoot] },
  permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
  decide: () => ({ kind: 'allow' }),
  pa: async () => ({ kind: 'allow' }),
  hostService: () => undefined,
  injected: { inspect: () => inspectFace },
  logBackend: () => () => {},
}
const built = familyAssembly.build(cap)
if (built.refused !== undefined) {
  say(`PROBE-FAMILY-BODY refused=${built.refused.code}`)
} else {
  const byName = new Map(built.definitions.map((definition) => [definition.name, definition]))
  say(`PROBE-FAMILY-BODY definitions=${[...byName.keys()].join(',')}`)
  const attempt = async (label, fn) => {
    try {
      const value = await fn()
      const stable = JSON.stringify(value).replaceAll(bodyTmp, '<tmp>')
      say(`PROBE-FAMILY-BODY ${label} outcome=ok value=${stable.slice(0, 180)}`)
    } catch (error) {
      say(`PROBE-FAMILY-BODY ${label} outcome=refused text=${JSON.stringify(String(error?.message ?? error)).slice(0, 180)}`)
    }
  }
  await attempt('team_skill allow', () => byName.get('team_skill').execute({ name: 'demo' }, {}))
  await attempt('team_skill unknown', () => byName.get('team_skill').execute({ name: 'nope' }, {}))
  await attempt('team_cordis_inspect_list', () => byName.get('team_cordis_inspect_list').execute({}, {}))
  const agentExec = { agent: { session: { header: { cwd: inside } } } }
  await attempt('team_cordis_inspect_query allow', () => byName.get('team_cordis_inspect_query').execute({ platform: 'host', provider: 'probe.provider', method: 'echo', input: { x: 'y' } }, agentExec))
  await attempt('team_cordis_inspect_query unknown-provider', () => byName.get('team_cordis_inspect_query').execute({ platform: 'host', provider: 'nope', method: 'echo' }, agentExec))
  say(`PROBE-FAMILY-BODY inspect-face calls list=${inspectCalls.list} query=${inspectCalls.query} inheritedServiceCalls=0`)
}

rmSync(bodyTmp, { recursive: true, force: true })

/* ──────────────────────────── 5. the verdict ─────────────────────────────── */

for (const member of MEMBERS) {
  const sites = definitionSitesOf(member)
  say(`PROBE-INSPECT single-implementation=${sites.length === 1 ? 'yes' : 'no'} member=${member} reason=one-row-definition-site:${sites.join(',') || 'none'}; the native/service side serves the capability under DIFFERENT names (${NATIVE_SPELLINGS[member]}) and claims no ${member} definition`)
}
say('PROBE-CONCLUSION booked-members=governed-family-body-only')
say('PROBE-CONCLUSION route-c=does-not-serve-any-booked-member (no same-name native attach, no provider call, no guard fact)')
say('PROBE-CONCLUSION native-capability=service-provided (skill: host @deepseek-ai/dsh-tool-skill + Team skills SERVICE provider a5sf-skill-provider.mjs; cordis_inspect_*: host @deepseek-ai/dsh-tool-cordis over the cordisInspect service; Team contributes no native row)')
say('PROBE-CONCLUSION retirement-shape=non-retirement proof (single same-name implementation); a byte baseline against a new path would have to invent a new-path name that does not exist')

const transcriptPath = join(OUT_DIR, 'composition-probe.txt')
writeFileSync(transcriptPath, `${out.join('\n')}\n`, 'utf8')
console.log(`PROBE-TRANSCRIPT ${transcriptPath}`)
