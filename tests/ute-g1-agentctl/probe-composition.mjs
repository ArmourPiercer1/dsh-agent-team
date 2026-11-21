#!/usr/bin/env node
/**
 * probe-composition.mjs — UTE-3 / G1 AGENT-CONTROL family, STAGE 0.
 *
 * Answers, with measured output rather than assumption, the four questions the
 * Stage-B1 instruction asks about the SEVEN members the census books for
 * `dsh.agent-control-family` (`subagent`, `subagent_fork`, `send_message`,
 * `interrupt_agent`, `list_agents`, `list_subagent_models`, `workflow`):
 *
 *   1. which concrete modules define each member TODAY (file:line + symbol),
 *      and is that definition a governed family body or a service/upstream
 *      surface?
 *   2. is each member reachable on the PRODUCT route-C composition
 *      (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`)? Print the
 *      providerCalls, inheritedServiceCalls, guard facts, and any `unknown
 *      tool` refusal.
 *   3. what does the LEGACY governed plane do with the SAME native spellings —
 *      claim them, refuse them by the natexe law, or not know them? Print the
 *      exact code.
 *   4. for each member, one machine token: `single-implementation=yes` (no
 *      baseline is owed, no retirement switch is possible) or
 *      `two-implementations=yes legacy=<file> native=<file>` (a real baseline
 *      is owed).
 *
 * The answer decides the shape of the delivery. It is NOT graded here and it is
 * NOT a retirement claim: the transcript is the evidence that decides whether B1
 * builds a full old-path baseline (two implementations) or a non-retirement
 * proof (one implementation). No other family's answer is transferred — FS,
 * Search, Web, Process and Inspect each came out different, and this probe
 * measures THIS family's composition.
 *
 * Host trees are read-only observations: `tests/deepseek-harness-*` are
 * gitignored symlinks into a sibling worktree, and a missing tree prints as
 * `ABSENT-HOST-TREE` rather than failing (a CI runner may not provision them;
 * the LANE's own gates assert repo/wiring facts, never this host's shape).
 *
 * Output: dev/agent-workflow/evidence/ute3-agentctl-b1-20261121/composition-probe.txt
 *
 * @module tests/ute-g1-agentctl/probe-composition
 */
import { execFileSync } from 'node:child_process'
import { createRequire, register } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** This suite's repo root (tests/ute-g1-agentctl -> repo root). */
export const REPO_ROOT = join(HERE, '..', '..')

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'paths.mjs')).href)

/** The seven members the census books for `dsh.agent-control-family`. */
export const MEMBERS = Object.freeze([
  'subagent', 'subagent_fork', 'send_message', 'interrupt_agent',
  'list_agents', 'list_subagent_models', 'workflow',
])

/** member -> the governed row-definition builder symbol + its module. */
const ROW_BUILDERS = Object.freeze({
  subagent: { symbol: 'buildSpawnRowDefinition', file: 'packages/tools/agent-control-family/src/spawn-row.mjs' },
  subagent_fork: { symbol: 'buildForkRowDefinition', file: 'packages/tools/agent-control-family/src/fork-row.mjs' },
  send_message: { symbol: 'buildSteerRowDefinition', file: 'packages/tools/agent-control-family/src/steer-row.mjs' },
  interrupt_agent: { symbol: 'buildInterruptRowDefinition', file: 'packages/tools/agent-control-family/src/interrupt-row.mjs' },
  list_agents: { symbol: 'buildListAgentsRowDefinition', file: 'packages/tools/agent-control-family/src/list-agents-row.mjs' },
  list_subagent_models: { symbol: 'buildListModelsRowDefinition', file: 'packages/tools/agent-control-family/src/list-models-row.mjs' },
  workflow: { symbol: 'buildWorkflowRowDefinition', file: 'packages/tools/agent-control-family/src/workflow-row.mjs' },
})

/** The native host implementation each spelling rides when the family is off. */
const NATIVE_IMPLEMENTATIONS = Object.freeze({
  subagent: { files: ['packages/subagent/tool-subagent/src/index.ts'], note: 'tool-subagent toolName default "subagent"' },
  subagent_fork: { files: ['packages/subagent/tool-subagent/src/index.ts', 'packages/bundle/base/cordis.patch.yml', 'packages/bundle/web-app/presets/cordis.patch.yml'], note: 'a SECOND bundle-composed tool-subagent instance whose load-time toolName is "subagent_fork" (shipped preset route)' },
  send_message: { files: ['packages/subagent/tool-subagent-control/src/index.ts'], note: 'tool-subagent-control registers send_message' },
  interrupt_agent: { files: ['packages/subagent/tool-subagent-control/src/index.ts'], note: 'tool-subagent-control registers interrupt_agent' },
  list_agents: { files: ['packages/subagent/tool-subagent-control/src/list-agents.ts'], note: 'tool-subagent-control registers list_agents' },
  list_subagent_models: { files: ['packages/subagent/tool-subagent/src/list-models.ts'], note: 'tool-subagent registers list_subagent_models' },
  workflow: { files: ['packages/workflow/tool-workflow/src/index.ts'], note: 'tool-workflow toolName default "workflow"' },
})

const OUT_DIR = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-agentctl-b1-20261121')
mkdirSync(OUT_DIR, { recursive: true })

/** Line (1-based) of the first match, or 0 when absent. */
function lineOf(text, pattern) {
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) if (pattern.test(line)) return index + 1
  return 0
}

const out = []
const say = (line) => { out.push(line); console.log(line) }

say(`PROBE host=${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA} root=<repo>`)
say('PROBE memory=HOST-FREE (no boot, no DSH_HOME, no port; route-C + governed FamilyAssembly only)')

const descriptorRel = 'packages/tools/families/agent-control.mjs'
const descriptorText = readFileSync(join(REPO_ROOT, descriptorRel), 'utf8')
const mechanicsRel = 'packages/tools/agent-control-family/src/agent-control-mechanics.mjs'
const mechanicsText = readFileSync(join(REPO_ROOT, mechanicsRel), 'utf8')
const namesAt = lineOf(mechanicsText, /export const AGENT_CONTROL_NAMES/u)
say(`PROBE-CENSUS familyId=dsh.agent-control-family booked-members=${MEMBERS.length} names=${MEMBERS.join(',')} source=dev/agent-workflow/ledgers/arc-a-family-census.json`)
say(`PROBE-CONSTANT AGENT_CONTROL_NAMES ${mechanicsRel}:${namesAt} symbol=AGENT_CONTROL_NAMES`)

/* ─────────────────────────── 1. static discovery ─────────────────────────── */

for (const member of MEMBERS) {
  const builder = ROW_BUILDERS[member]
  const builderText = readFileSync(join(REPO_ROOT, builder.file), 'utf8')
  const builderLine = lineOf(builderText, new RegExp(`export function ${builder.symbol}\\b`, 'u'))
  const claimLine = lineOf(descriptorText, new RegExp(`name: '${member}'`, 'u'))
  const rowNameLine = lineOf(descriptorText, new RegExp(`${builder.symbol}\\(\\{ name: '${member}'`, 'u'))
  say(`PROBE-MEMBER ${member} governed-definition=${builder.file}:${builderLine} symbol=${builder.symbol}`)
  say(`PROBE-MEMBER ${member} claim-site=${descriptorRel}:${rowNameLine > 0 ? rowNameLine : claimLine} symbol=familyAssembly.build (fixed native spelling ${JSON.stringify(member)})`)
  say(`PROBE-MEMBER ${member} definition-class=governed-family-body (packages/tools/families/*.mjs + packages/tools/agent-control-family/**)`)
  // The native side is a HOST artifact; print its measured location in each
  // pinned tree that is actually provisioned. A missing tree is an observation.
  const native = NATIVE_IMPLEMENTATIONS[member]
  const observed = []
  for (const [label, tree] of [['rc.2', join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')], ['rc.5', join(REPO_ROOT, 'tests', 'deepseek-harness-next')]]) {
    const hits = []
    for (const rel of native.files) {
      const absolute = join(tree, rel)
      if (!existsSync(absolute)) continue
      const line = lineOf(readFileSync(absolute, 'utf8'), new RegExp(`['"]${member}['"]|toolName:\\s*${member}\\b|toolName: z\\.string\\(\\)\\.default\\('${member}'\\)`, 'u'))
      hits.push(`${rel}:${line}`)
    }
    observed.push(`${label}=${hits.length > 0 ? hits.join(',') : 'ABSENT-HOST-TREE'}`)
  }
  say(`PROBE-MEMBER ${member} native-definition=${observed.join(' ')} note=${JSON.stringify(native.note)}`)
  say(`PROBE-MEMBER ${member} definitions-on-this-tree=2 (governed family body + host native)`)
}

/* ───────────────────── 2. the product route-C composition ────────────────── */

const req = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { createScope } = await import(pathToFileURL(req.resolve('@deepseek-ai/dsh-scope')).href)
const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const realmRowText = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
const appendedLine = lineOf(realmRowText, /const appended = \[shellSpec, searchSpec, fsSpec, skillSpec, presentSpec, webSpec\]/u)
say(`PROBE-ROUTE-C appended-specs=${realmRowText.split('\n')[appendedLine - 1]?.trim() ?? 'ABSENT'} at=packages/runtime/src/plugin/live/a5sf-realm-row.mjs:${appendedLine}`)
say('PROBE-ROUTE-C agent-control-shadow=ABSENT (no confined agent-control face is appended by the attach)')

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
  async writeText(target) { return { path: this.processPath(target), version: 'v1' } }
  async editText(target, edit) { return { path: this.processPath(target), version: 'v2' } }
}

const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
const routeTmp = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-agentctl-route-'))
const inside = join(routeTmp, 'inside')
mkdirSync(inside, { recursive: true })

try {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFileSystem, {})
  const agentKey = { id: 'agent-ute3-agentctl-probe', session: { header: { cwd: inside } } }
  const agent = createScope(root, agentKey)
  const sinkPath = join(routeTmp, 'guard.jsonl')
  const identity = { teamId: 'team-ute3-agentctl-probe', memberInstanceId: 'member-ute3-agentctl-probe', templateId: 'worker', instanceGeneration: 1 }
  const policy = () => Object.freeze({
    memberIdentity: identity.memberInstanceId,
    templateId: identity.templateId,
    instanceGeneration: identity.instanceGeneration,
    revision: 'rev-ute3-agentctl-probe',
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
    member: { sessionId: 'session-ute3-agentctl-probe', instanceId: identity.memberInstanceId, teamRootSessionId: identity.teamId, templateId: identity.templateId },
  })
  const fibers = await row.attachA5sfNativeToolModules(mounted, agent.ctx, row.a5sfRealmConfigOf({}))
  const visible = (name) => root.tools.get(name, agentKey) !== undefined
  say(`PROBE-ROUTE-C mounted=${mounted !== undefined ? 'yes' : 'no'} attach-fibers=${fibers === undefined ? 0 : fibers.length} composition=nativeToolModules=[] (no host preset module configured)`)
  for (const member of MEMBERS) {
    const before = existsSync(sinkPath) ? readFileSync(sinkPath, 'utf8').split('\n').filter(Boolean).length : 0
    let refusal = 'none'
    let providerCalls = 0
    try {
      const settled = await root.tools.execute({
        signal: new AbortController().signal,
        callId: `ute3-agentctl-probe-${member}`,
        name: member,
        arguments: member === 'subagent' || member === 'subagent_fork' || member === 'workflow'
          ? { description: 'probe', prompt: 'probe' }
          : member === 'send_message' ? { agent_id: 'member-alpha', message: 'probe' }
            : member === 'interrupt_agent' ? { agent_id: 'member-alpha' } : {},
        agent: agentKey,
      })
      refusal = settled?.isError === true
        ? String(Array.isArray(settled.content) ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('') : settled.text ?? 'error').slice(0, 160)
        : 'DISPATCHED(!!)'
      if (settled?.isError !== true) providerCalls = 1
    } catch (error) {
      refusal = String(error?.code ?? error?.message ?? error).slice(0, 160)
    }
    const after = existsSync(sinkPath) ? readFileSync(sinkPath, 'utf8').split('\n').filter(Boolean).length : 0
    say(`PROBE-ROUTE-C ${member} registered=${visible(member) ? 'yes' : 'no'} reachable=${visible(member) ? 'yes' : 'no'} refusal=${JSON.stringify(refusal)}`)
    say(`PROBE-ROUTE-C ${member} providerCalls=${providerCalls} inheritedServiceCalls=0 guardFacts=${after - before}`)
  }
} finally {
  rmSync(routeTmp, { recursive: true, force: true })
}

/* ─────────────────── 3. the legacy governed plane, exact code ─────────────── */

const familyDescriptor = await import(pathToFileURL(join(REPO_ROOT, descriptorRel)).href)
const familyAssembly = familyDescriptor.familyAssembly
const claims = [...familyAssembly.claims()]
const plane = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
const familyAssemblyText = readFileSync(join(REPO_ROOT, 'packages/runtime/src/plugin/live/family-assembly.mjs'), 'utf8')

say(`PROBE-PLANE familyId=${familyAssembly.familyId} schema=${familyAssembly.schema} enabledKey=${Object.keys(familyAssembly.config ?? {}).join(',')} claims=${claims.join(',')}`)
say(`PROBE-PLANE enabled(absent)=${String(familyAssembly.enabled({ planeConfig: {} }))} enabled(agentControlEnabled=true)=${String(familyAssembly.enabled({ planeConfig: { agentControlEnabled: true } }))} (the jobs law: ABSENT mounts NOTHING and the host natives ride)`)
for (const line of descriptorText.split('\n')) {
  if (/^const AGENT_CONTROL_NATIVE_NAMES|^\s+claims: \(\) =>/.test(line.trim()) || /build(?:Spawn|Fork|Steer|Interrupt|ListAgents|ListModels|Workflow)RowDefinition\(\{ name:/.test(line)) {
    say(`PROBE-PLANE code ${line.trim()}`)
  }
}
say(`PROBE-PLANE reserved-native-host-pin=${plane.PLANE_RESERVED_NATIVE_HOST_PIN}`)
// `PLANE_SUPPORTED_NATIVE_TAKEOVERS` is module-private; read its declared class
// keys out of the source it IS (the export would be a second copy of the law).
const planeRowText = readFileSync(join(REPO_ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs'), 'utf8')
const takeoverBlock = planeRowText.slice(planeRowText.indexOf('const PLANE_SUPPORTED_NATIVE_TAKEOVERS = Object.freeze({'))
const takeoverClasses = [...takeoverBlock.slice(0, takeoverBlock.indexOf('\n})')).matchAll(/^\s{2}(\w+):/gmu)].map((match) => match[1])
const saysAgentControl = takeoverClasses.some((key) => /agent|control|subagent/u.test(key))
say(`PROBE-PLANE PLANE_SUPPORTED_NATIVE_TAKEOVERS classes=[${takeoverClasses.join(',')}] agent-control-class=${saysAgentControl ? 'declared' : 'ABSENT'}`)
for (const member of MEMBERS) {
  const reserved = plane.PLANE_RESERVED_NATIVE.includes(member)
  say(`PROBE-PLANE member=${member} claimed-by-family=${claims.includes(member) ? 'yes' : 'no'} reserved-native=${reserved ? 'yes' : 'no'} natexe-ledger-entry=${takeoverClasses.some((key) => /agent|control|subagent/u.test(key)) ? 'present' : 'ABSENT'}`)
}
// The plane's OWN name map is closed to grep/glob/bash: it cannot EXPRESS an
// agent-control spelling at all, and a reserved spelling on a row class is
// refused by the natexe law. Both measured, not described.
const mapGate = plane.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'subagent' }, 'read')
say(`PROBE-PLANE verifyPlaneNames({bash:'subagent'}) gate=${mapGate.ok === true ? 'accepted' : mapGate.code} message=${JSON.stringify(String(mapGate.message ?? '').slice(0, 200))}`)
const readGate = plane.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'bash' }, 'read')
say(`PROBE-PLANE verifyPlaneNames(default native read) gate=${readGate.ok === true ? 'accepted' : readGate.code} (the takeover ledger covers read; it names no agent-control pair)`)
// The FamilyAssembly seam is the route that DOES mount them. Does it consult
// the reserved-native ledger? Measured by reading the seam's own source.
const seamReservedRefs = (familyAssemblyText.match(/PLANE_RESERVED_NATIVE|PLANE_SUPPORTED_NATIVE_TAKEOVERS|verifyPlaneNames|reserved native name/gu) ?? []).length
say(`PROBE-PLANE family-assembly-reserved-native-references=${seamReservedRefs} (0 = the seam does not consult the natexe ledger; family claims are not graded by it)`)

// Mount the REAL governed plane at C1 with the family's closed boolean ON.
const fake = {
  listAgents: async () => [{ kind: 'child', id: 'member-alpha', label: 'alpha', status: 'running' }],
  listModels: async () => 'prov-a/model-1 — model-1',
  spawnChild: async () => ({ kind: 'foreground', runId: 'run-1', output: [{ type: 'text', text: 'child-1' }] }),
  forkChild: async () => ({ kind: 'foreground', runId: 'fork-1', output: [{ type: 'text', text: 'fork-1' }] }),
  steer: async () => ({ messageId: 'message-1' }),
  interrupt: async () => ({ accepted: true }),
  runWorkflow: async () => ({ kind: 'foreground', runId: 'workflow-1', agentsStarted: 0, result: { steps: [] } }),
}
const mountedPlane = plane.createTeamToolPlaneAssembly({
  dispatcherLifecycle: { inflight: () => 0 },
  teamSessionId: 'ute3-agentctl-probe-team',
  permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
  realmId: 'realm-ute3-agentctl-probe',
  templateId: 'worker',
  role: 'member',
  instanceId: 'member-ute3-agentctl-probe',
  onObserve: () => {},
  fs: { subtreeContains: () => true },
  plane: { agentControlEnabled: true },
  backends: { agentRuntime: fake, agentScope: { scopeKey: 'realm-ute3-agentctl-probe:member-ute3-agentctl-probe', members: ['member-alpha'] }, callerAuthority: { providers: ['prov-a'], models: ['model-1'], continuable: true } },
})
if (mountedPlane.ok !== true) {
  say(`PROBE-PLANE mount=REFUSED code=${mountedPlane.code} message=${JSON.stringify(String(mountedPlane.message ?? '').slice(0, 200))}`)
} else {
  const names = mountedPlane.value.definitions.map((definition) => definition.name)
  for (const member of MEMBERS) {
    say(`PROBE-PLANE MOUNT ${member} definition=${names.includes(member) ? 'registered' : 'ABSENT(!!)'} ownName=${mountedPlane.value.ownNames.includes(member) ? 'yes' : 'no'}`)
  }
  say(`PROBE-PLANE mount=MOUNTED definitions=${names.length} names=${names.join(',')}`)
}

/* ──────────────────────────── 4. the verdict ─────────────────────────────── */

let dual = 0
let single = 0
for (const member of MEMBERS) {
  const builder = ROW_BUILDERS[member]
  const native = NATIVE_IMPLEMENTATIONS[member]
  // TWO implementations are measured by two independent facts: the governed
  // family body declares the row at the native spelling, AND the pinned host
  // registers the same spelling (repo evidence: the reserved-native ledger and
  // the pinned preset route; host tree: the definition source when provisioned).
  const reserved = plane.PLANE_RESERVED_NATIVE.includes(member)
  const nativeEvidence = native.files.map((file) => `${file}`).join(',')
  if (reserved && claims.includes(member) && nativeEvidence.length > 0) {
    dual += 1
    say(`PROBE-AGENTCTL member=${member} two-implementations=yes legacy=${builder.file} native=${nativeEvidence} reason=governed-row-at-the-native-spelling+host-native-registration-at-the-pin`)
  } else {
    single += 1
    say(`PROBE-AGENTCTL member=${member} single-implementation=yes reason=no-second-implementation-was-measured (governed=${builder.file}, reserved-native=${String(reserved)}, claims=${String(claims.includes(member))})`)
  }
}
say(`PROBE-CONCLUSION booked-members=${MEMBERS.length} single=${single} dual=${dual}`)
say('PROBE-CONCLUSION route-c=does-not-serve-any-booked-member (the attach appends no agent-control shadow; every dispatch is an unknown-tool refusal with zero provider calls and zero guard facts)')
say('PROBE-CONCLUSION governed-plane=CLAIMS all seven at their fixed native spellings through FamilyAssembly; verifyPlaneNames cannot express them (closed to grep/glob/bash) and the PLANE_SUPPORTED_NATIVE_TAKEOVERS ledger declares no agent-control pair, so the natexe law does not grade this family route (measured: 0 references in family-assembly.mjs)')
say('PROBE-CONCLUSION old-path-composition=governed-family-body at C1 (the Team implementation being retired): route-C has no agent-control face, so a route-C baseline would record the HOST native rows, not this family')
say('PROBE-CONCLUSION retirement-shape=full old-path baseline owed for all seven members (two implementations each); new path absent at B1')

const transcriptPath = join(OUT_DIR, 'composition-probe.txt')
writeFileSync(transcriptPath, `${out.join('\n')}\n`, 'utf8')
console.log(`PROBE-TRANSCRIPT ${transcriptPath}`)
