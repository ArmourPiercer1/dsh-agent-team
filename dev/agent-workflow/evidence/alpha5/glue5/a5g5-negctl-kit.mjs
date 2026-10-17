#!/usr/bin/env node
/**
 * a5g5-negctl-kit.mjs — the GLUE-5 production-assembly negative control.
 *
 * QUESTION (the GLUE-5 delivery gate, root directive 07:15Z): the pre-merge
 * tree now carries the LIVE assembly rows (tool plane + PR7 jobs-gateway
 * row). Does the production entry (a) really mount the plane for a GOVERNED
 * Team and verify it through the placement, (b) leave every NON-team session
 * byte-identical (dual zero: `standard` AND `minimal`, registry face AND
 * wire face), (c) keep the Coverage Gate as red as it was, (d) fail CLOSED
 * on unknown attribution (trust-pair / placement conflict), and (e) refuse
 * drift/revocation of a verified placement?
 *
 * TWO HALVES, ONE CRITERIA TABLE:
 *  SYNTH (in-process, before any world): the REAL compiled modules from the
 *  committed dist (tool plane, closed-world guard, jobs-gateway live row)
 *  run against the synthetic law-clone registry of RA-REVIEW (laws L1-L6,
 *  the RA Tier-A precedent; the bindAll-shape clone is verbatim from
 *  install.ts:987-1024 — disclosed, not production code).
 *  WORLDS (four sequential boots, ONE port 3183, one delta each):
 *   baseline  = production row (this worktree's dist) WITHOUT teamToolPlane
 *               + observer row + smoke preset; governed team (main blueprint)
 *               + `standard`/`minimal` non-team sessions with turns.
 *   plane     = + `teamToolPlane: {}` in the row config (public seam only).
 *   gatered   = plane world + the STRAY row (one unattributed global tool):
 *               the Coverage Gate must still refuse the governed setup.
 *   refuse    = plane config with a HALF-PAIR trustRoot (mismatch): the
 *               mount must refuse the governed setup, typed.
 *
 * CRITERIA (every one from live reads; a missing leg FAILS, nothing back-
 * filled; launch tokens redacted AT capture; worlds swept; :3080 probed
 * read-only before/after; the test-use host porcelain-checked pre/post).
 *
 * EXIT: 0 all GREEN · 2 a criterion RED · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, testUseTree, homeDir } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const TESTUSE = resolve(argValue('testuse', testUseTree(WORKTREE)))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const OBSERVER_ROW_NAME = pathToFileURL(join(HERE, 'a5g5-observer-row.mjs')).href
const STRAY_ROW_NAME = pathToFileURL(join(HERE, 'a5g5-stray-row.mjs')).href
const WORLD_PREFIX = 'a5g5'
const PRESET_ID = 'a5g5-base'
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const ALIASES = ['team_grep', 'team_glob', 'team_bash']
const PRESETS = ['standard', 'minimal']
const ALL_MODES = ['baseline', 'plane', 'gatered', 'refuse']
const MODES = argValue('modes', ALL_MODES.join(',')).split(',').map((m) => m.trim()).filter((m) => ALL_MODES.includes(m))

// ── redaction at capture ─────────────────────────────────────────────────────
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${hex8(tok)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)

const CRITERIA = []
function check(id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${redact(String(observed)).slice(0, 300)}]`}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
function writeEvidence(name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
function portFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })
}
async function portFreeWait(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port)) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, 300))
  }
}
function gitAt(dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: redact(text).slice(0, 800) } }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function waitQuiet(deadlineMs, fn) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function waitForLogLine(logPath, regex, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not yet */ }
    const line = text.split('\n').find((l) => regex.test(l))
    if (line !== undefined) return line.slice(0, 400)
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 300))
  }
}

// ═══════════════════════════════ SYNTH HALF ════════════════════════════════
// REAL compiled modules from the committed dist; SYNTHETIC law-clone registry
// (RA-REVIEW Tier-A precedent; laws L1-L6 pinned there against the host tree).
const synth = await (async () => {
  const GUARD_URL = pathToFileURL(join(DIST_RUNTIME, 'tool-dispatch', 'closed-world-guard.js')).href
  const PLANE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'team-tool-plane.mjs')).href
  const ROW_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'jobs-gateway-assembly.mjs')).href
  const { createGovernedSurface, guardDecision, untestedAssurance } = await import(GUARD_URL)
  const plane = await import(PLANE_URL)
  const row = await import(ROW_URL)

  class SynthRegistry {
    constructor() { this.global = new Map(); this.own = new WeakMap() }
    #layer(scope) {
      if (scope === undefined) return undefined
      let l = this.own.get(scope); if (l === undefined) { l = new Map(); this.own.set(scope, l) }
      return l
    }
    register(callerScope, definition) {
      if (callerScope === undefined) {
        if (this.global.has(definition.name)) throw new Error(`duplicate global tool "${definition.name}"`)
        this.global.set(definition.name, definition)
        return () => this.global.delete(definition.name)
      }
      const layer = this.#layer(callerScope)
      if (layer.has(definition.name)) throw new Error(`tool "${definition.name}" is already registered in this agent scope`)
      layer.set(definition.name, definition)
      return () => layer.delete(definition.name)
    }
    get(name, scope) {
      const own = scope === undefined ? undefined : this.own.get(scope)
      const d = own?.get(name)
      return d !== undefined ? d : this.global.get(name)
    }
    ownNames(scope) { return [...(this.own.get(scope)?.keys() ?? [])].sort() }
    schemas(scope) {
      const names = new Set(this.global.keys())
      const own = scope === undefined ? undefined : this.own.get(scope)
      if (own !== undefined) for (const n of own.keys()) names.add(n)
      return [...names].sort().map((name) => ({ name }))
    }
  }
  // instrumented clones of the install.ts read sites (verbatim shape; RA PoC).
  const definitionIds = new WeakMap(); let defSeq = 0
  const fingerprint = (t) => {
    if (t === null || (typeof t !== 'object' && typeof t !== 'function')) return null
    const e = definitionIds.get(t); if (e !== undefined) return e
    defSeq += 1; const id = `def#${defSeq}`; definitionIds.set(t, id); return id
  }
  const readDefinition = (reg, name, agent) => {
    const d = reg.get(name, agent)
    if (d === undefined || d === null) return { ok: false, detail: `tools.get("${name}") resolved to no definition on this scope` }
    const id = fingerprint(d.execute ?? d)
    return id === null ? { ok: false, detail: 'no pinnable Body' } : { ok: true, fingerprint: id }
  }
  const readTrustedDefinition = (reg, name) => {
    const d = reg.get(name)
    if (d === undefined || d === null) return { ok: false, detail: `tools.get("${name}") (global view) resolved to no definition` }
    const id = fingerprint(d.execute ?? d)
    return id === null ? { ok: false, detail: 'no pinnable Body' } : { ok: true, fingerprint: id }
  }
  const bindTeamOwn = (surface, key, name, probe) => {
    const inForce = surface.entryOf(name)
    const binding = {
      bindingId: `team-own:${key}:${name}`, agentScopeKey: key, toolName: name,
      definitionIdentity: probe.fingerprint, providerId: 'dsh-agent-team',
      implementationOrigin: 'team-trusted-extension', executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
      policyGeneration: 0, authorityGeneration: 0, revision: (inForce?.revision ?? 0) + 1, status: 'ACTIVE',
    }
    return surface.bind({ name, origin: 'team-own', binding, verified: true })
  }
  const decideCall = (surface, name, definition) => guardDecision({
    exec: { name, agentIdentity: 'session-team' },
    scope: { agentScopeKey: 'session-team', trustedIdentities: ['session-team'] },
    surface, active: true, policyGeneration: 0, authorityGeneration: 0, definition,
  })

  const out = {}
  const POLICY = { default: 'ask', allow: [], ask: [], deny: [] }
  const mkCtx = (reg, scope) => ({ tools: { register: (def) => reg.register(scope, def) } })

  // S1 — placement + verification + zero face movement (production mount()).
  const s1 = { reg: new SynthRegistry(), scope: { id: 'team-agent' } }
  {
    const minimalScope = { id: 'minimal-agent' }
    const before = { minimal: s1.reg.schemas(minimalScope).map((r) => r.name), global: s1.reg.schemas().map((r) => r.name) }
    const built = plane.createTeamToolPlaneAssembly({
      permissionPolicy: POLICY, realmId: 'a5g5-realm', templateId: 'leader', role: 'leader', instanceId: 'inst-1', plane: {},
    })
    s1.built = built
    const placed = built.ok === true ? built.value.mount(mkCtx(s1.reg, s1.scope)) : { ok: false, code: 'NOT-BUILT' }
    s1.placed = placed
    const names = built.ok === true ? built.value.ownNames : []
    s1.names = [...names]
    s1.surface = createGovernedSurface({ agentScopeKey: 'session-team', nativeNames: [] })
    s1.binds = {}
    s1.verdicts = {}
    if (placed.ok === true) {
      for (const n of names) {
        s1.binds[n] = bindTeamOwn(s1.surface, 'session-team', n, readDefinition(s1.reg, n, s1.scope)).ok === true
        const v = decideCall(s1.surface, n, readDefinition(s1.reg, n, s1.scope))
        s1.verdicts[n] = `${v.kind}/${v.reason ?? ''}`
      }
    }
    const after = { minimal: s1.reg.schemas(minimalScope).map((r) => r.name), global: s1.reg.schemas().map((r) => r.name) }
    s1.before = before; s1.after = after
    const setEqS1 = (x, y) => JSON.stringify([...new Set(x)].sort()) === JSON.stringify([...new Set(y)].sort())
    check('S1a', 'SYNTH: the PRODUCTION plane mount() places exactly the three reviewed Definitions under the team_* aliases (real createGovernedToolDefinitions, real mount code)',
      built.ok === true && placed.ok === true && setEqS1(s1.names, ALIASES) && setEqS1(s1.reg.ownNames(s1.scope), ALIASES),
      `built=${built.ok === true} placed=${placed.ok === true} own=[${s1.reg.ownNames(s1.scope)}]`)
    check('S1b', 'SYNTH: every placed alias BINDS team-own verified:true and the per-call compare ABSTAINS governed-and-verified on the object the placement put there',
      s1.binds.team_grep === true && s1.binds.team_glob === true && s1.binds.team_bash === true
        && Object.values(s1.verdicts).every((v) => v === 'abstain/governed-and-verified'),
      JSON.stringify(s1.verdicts))
    check('S1c', 'SYNTH: the trusted GLOBAL face stays EMPTY and a non-team scope face is byte-identical across the placement',
      s1.after.global.length === 0 && JSON.stringify(before) === JSON.stringify(after),
      `global=${JSON.stringify(s1.after.global)} minimal=[${s1.after.minimal}]`)
    s1.disposer = placed.dispose
  }

  // S2 — unknown attribution fail-closed: a foreign same-name in the own
  // layer first ⇒ the plane placement FAILS and rolls back everything it
  // placed before the conflict (assembly fails; nothing half-placed).
  {
    const reg = new SynthRegistry()
    const scope = { id: 'team-agent-2' }
    reg.register(scope, { name: 'team_grep', execute: function foreign() { return 'foreign' } }) // foreign body FIRST
    const built = plane.createTeamToolPlaneAssembly({ permissionPolicy: POLICY, realmId: 'r', templateId: 't', role: 'member', instanceId: 'i', plane: {} })
    const placed = built.ok === true ? built.value.mount({ tools: { register: (def) => reg.register(scope, def) } }) : { ok: false }
    const layer = reg.ownNames(scope)
    check('S2', 'SYNTH NC: a foreign same-layer name blocks the plane placement (typed PLANE_PLACEMENT_CONFLICT) and the mount ROLLS BACK what it already placed — unknown attribution fails closed',
      placed.ok === false && placed.code === 'PLANE_PLACEMENT_CONFLICT' && JSON.stringify(layer) === JSON.stringify(['team_grep']),
      `code=${placed.code ?? 'n/a'} ownLayer=[${layer}]`)
  }

  // S3 — trust-pair law (pb §1.3), typed, construction BEFORE anything.
  {
    const absent = plane.verifyConfinedProviderPairing(undefined)
    const good = plane.verifyConfinedProviderPairing({ trustRoot: `sha256:${'a'.repeat(16)}#vendor/launcher.bin`, assembly: { launcherSha256: 'a'.repeat(64), launcherPath: 'vendor/launcher.bin' } })
    const half = plane.verifyConfinedProviderPairing({ trustRoot: 'sha256:bbbbbbbbbbbbbbbb#vendor/x', assembly: { launcherPath: 'vendor/x' } })
    const mismatch = plane.createTeamToolPlaneAssembly({
      permissionPolicy: POLICY, realmId: 'r', templateId: 't', role: 'member', instanceId: 'i',
      plane: { confinedProvider: { trustRoot: 'sha256:1111111111111111#vendor/x', assembly: { launcherSha256: 'a'.repeat(64), launcherPath: 'vendor/x' } } },
    })
    check('S3', 'SYNTH: trust pairing — absent OK, exact pair OK, HALF-PAIR refused (CONFINE_CONFIG_INCOMPLETE), mismatch refused typed at ASSEMBLY CONSTRUCTION (TRUST_ROOT_SHA_MISMATCH, never a throw)',
      absent.ok === true && good.ok === true && half.code === 'CONFINE_CONFIG_INCOMPLETE'
        && mismatch.ok === false && mismatch.code === 'TRUST_ROOT_SHA_MISMATCH',
      `absent=${absent.ok} good=${good.ok} half=${half.code} mismatch=${mismatch.code}`)
  }

  // S4 — revocation / regeneration drift on the S1 verified state.
  {
    s1.disposer() // revocation of the placement
    const v1 = decideCall(s1.surface, 'team_grep', readDefinition(s1.reg, 'team_grep', s1.scope))
    s1.reg.register(s1.scope, { name: 'team_grep', execute: function regen() { return 'regenerated' } })
    const v2 = decideCall(s1.surface, 'team_grep', readDefinition(s1.reg, 'team_grep', s1.scope))
    check('S4', 'SYNTH NC: revocation ⇒ per-call DEFINITION_UNREADABLE; a regenerated same-name object ⇒ DEFINITION_DRIFT — verification never transfers',
      v1.kind === 'deny' && v1.reason === 'definition-unreadable' && v2.kind === 'deny' && v2.reason === 'definition-drift',
      `revoke=${v1.kind}/${v1.reason} regen=${v2.kind}/${v2.reason}`)
  }

  // S5 — lane re-check semantics (tighten-only, template vocabulary).
  {
    const d1 = plane.createLaneDecide({ default: 'ask', allow: [], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any' } }] }, { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' })
    const d2 = plane.createLaneDecide({ default: 'deny', allow: [], ask: [], deny: [] }, { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' })
    const d3 = plane.createLaneDecide({ default: 'deny', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] }, { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' })
    const v1 = d1({ effects: [{ kind: 'tool-invoke', toolName: 'team_bash' }] })
    const v2 = d2({ effects: [{ kind: 'read', resource: { locator: '/x' } }, { kind: 'tool-invoke', toolName: 'team_grep' }] })
    const v3 = d3({ effects: [{ kind: 'read', resource: { locator: '/x' } }, { kind: 'tool-invoke', toolName: 'team_grep' }] })
    check('S5', 'SYNTH: the lane re-check denies a deny-lane class match and a default-deny-uncovered plane effect, and an allowed read class COVERS the file-facing alias (class mapping, tighten-only)',
      v1.code === 'template-deny-lane' && v2.code === 'template-default-deny' && v3.kind === 'allow',
      `denyLane=${v1.code} defaultDeny=${v2.code} covered=${v3.kind}`)
  }

  // S6 — the PR7 live row over a synthetic durable domain: an owner claim
  // that is NOT a durable MemberInstance is refused `owner-not-durable` with
  // ZERO state delta (the closed-world identity law, production row code).
  {
    const domain = { repositories: { memberInstances: { list: () => [] } } } // no durable rows at all
    const asm = row.createLiveJobsGatewayAssembly({ teamRoot: domain, rootSessionId: 'session-a5g5-synth-root' })
    const refusal = asm.admitTeamJob({ jobId: 'job-1', owner: { rootSessionId: 'session-a5g5-synth-root', instanceId: 'ghost' }, scopeKey: 'scope-1', toolName: 'job_start' })
    const crossRoot = asm.admitTeamJob({ jobId: 'job-2', owner: { rootSessionId: 'session-OTHER', instanceId: 'inst' }, scopeKey: 'scope-1', toolName: 'job_start' })
    asm.drain()
    const rel = asm.release()
    const relOk = rel === true || rel?.ok === true
    check('S6', 'SYNTH: the live jobs row refuses an unbacked owner claim (owner-not-durable) and a CROSS-ROOT claim, both with zero registrations; the assembly-owned lease drains and releases honestly',
      refusal.ok !== true && String(refusal.code ?? refusal.error?.code ?? '') === 'owner-not-durable'
        && crossRoot.ok !== true && String(crossRoot.code ?? crossRoot.error?.code ?? '') === 'owner-not-durable'
        && relOk === true,
      `ghost=${JSON.stringify(refusal).slice(0, 120)} cross=${JSON.stringify(crossRoot).slice(0, 80)} release=${JSON.stringify(rel).slice(0, 60)}`)
  }
  out.s1 = { names: s1.names, binds: s1.binds, verdicts: s1.verdicts }
  return out
})()

// ═══════════════════════════════ WORLD HALF ════════════════════════════════
const ROOT = `session-a5g5-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5g5-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5g5.anchor'
const BP_MAIN_ID = 'team.a5g5.main'

function yamlScalar(v) { return v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : String(v) }
function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  '  persona: "You are the leader of the a5g5 assembly team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5g5 assembly team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function mainBlueprintYaml(denyList, mkLeader) {
  const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5g5 assembly team. ${mkLeader} is your only directive: reply with the single word OK. Do not call any tool. Do not create members.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items: []',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5g5 worker A"',
    `    persona: ${JSON.stringify('You are worker A of the a5g5 assembly team. No tasks are delegated to you in this run.')}`,
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function teamToolPlaneConfig(mode) {
  if (mode === 'plane' || mode === 'gatered') return { realmId: `a5g5-realm-${mode}` }
  if (mode === 'refuse') {
    // HALF-PAIR by construction: trustRoot pinned to a DIFFERENT digest than
    // the launcher sha the same block carries ⇒ the pairing law refuses.
    return {
      realmId: 'a5g5-realm-refuse',
      confinedProvider: {
        trustRoot: 'sha256:1111111111111111#vendor/launcher.bin',
        assembly: { launcherSha256: 'a'.repeat(64), launcherPath: 'vendor/launcher.bin' },
      },
    }
  }
  return undefined
}

function rowConfig(mode, blueprintDir, mkLeader) {
  const cfg = {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: ANCHOR_YAML,
    blueprintDir,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5g5-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const p = teamToolPlaneConfig(mode)
  if (p !== undefined) cfg.teamToolPlane = p
  void mkLeader
  return cfg
}

async function runWorld({ mode, mock, MK, blueprintBaseDir }) {
  const HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const BLUEPRINT_DIR = join(blueprintBaseDir, mode)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  const facts = { mode, home: HOME, ok: false }
  let host = null
  try {
    if (!(await portFreeWait(HOST_PORT))) die(`port ${HOST_PORT} not free before ${mode} world`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
    const MK_DISC = `${MK}_${mode.toUpperCase()}_DISC`
    const MK_LEADER = `${MK}_${mode.toUpperCase()}_LEADER`
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const lines = [
      `# a5g5 GLUE-5 negative-control patch (run ${RUN_STAMP}, mode ${mode}): production dsh-agent-team row (this worktree's committed dist) + observer row${mode === 'gatered' ? ' + the STRAY row' : ''} + smoke preset — public profile-patch seam only.`,
      '- insert:',
      ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig(mode, BLUEPRINT_DIR, MK_LEADER) }, 2),
      ...yamlEmitItem({ id: 'a5g5-observer', name: OBSERVER_ROW_NAME, config: {} }, 2),
      ...(mode === 'gatered' ? [...yamlEmitItem({ id: 'a5g5-stray', name: STRAY_ROW_NAME, config: {} }, 2)] : []),
      ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5g5 base',
        description: `a5g5 base preset (run ${RUN_STAMP}) = smoke preset`,
        plugins: basePlugins,
      }), 2),
      '',
    ]
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))

    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: join(HOME, 'workspace'),
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
        DEEPSEEK_API_KEY: 'a5g5-mock-key',
      },
    })
    host.on('exit', (code, signal) => console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`))
    const boot = await waitFor(120_000, () => {
      try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
    }, `${mode} boot marker`)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`${mode} token gate ${String(auth.status)}`)
    await waitFor(30_000, async () => {
      const h = await fetchJson(`${origin}/__a5g5/health`).catch(() => null)
      return h?.status === 200 && h.body?.applied === true ? h : false
    }, `${mode} observer applied`)

    // ── boot-completion barrier (law learned the hard way, run 2026-10-17):
    // a prompt accepted WHILE the boot row's create-assembly is still running
    // is swallowed (accepted:true, no turn ever). The public, honest barrier:
    // re-send the setup prompt until the WIRE request actually shows at the
    // mock (the a5w7 kit's p6t6 teamSession barrier, expressed with only the
    // public route + the mock we already own).
    const wireHit = (needle) => (mock.requests ?? []).find((r) => JSON.stringify(r.body?.messages ?? []).includes(needle) && Array.isArray(r.body?.tools))
    async function promptBarrier({ sessionId, textBase, rpcTag, attempts = 15, perAttemptMs = 20_000 }) {
      let lastStatus = 0
      for (let k = 1; k <= attempts; k += 1) {
        const res = await fetchJson(`${origin}/api/session/prompt`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
          body: JSON.stringify({ type: 'client-request', rpcId: `${rpcTag}-a${k}`, method: 'session/prompt', payload: { args: { request: { requestId: `${rpcTag}-a${k}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${textBase} (barrier probe ${k}) This is a setup turn. Do not call any tools. Reply OK.` }] } } } }),
        }, 240_000)
        lastStatus = res.status
        const hit = await waitQuiet(perAttemptMs, async () => wireHit(textBase))
        if (hit) return { hit, attempts: k, lastStatus }
      }
      let diag = null
      try {
        const f = await fetchJson(`${origin}/__a5g5/facts?names=team_stray&roots=${encodeURIComponent(sessionId)}`, undefined, 5_000)
        const sl = await fetchJson(`${origin}/api/session/list`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' }, body: JSON.stringify({ type: 'client-request', rpcId: 'a5g5-barrier-diag', method: 'session/list', payload: { args: { _request: {} } } }) }, 5_000)
        const items = sl.body?.result?.value?.items ?? []
        diag = { http: f.status, globalNames: f.body?.globalNames, agents: (f.body?.agents ?? []).map((a) => a.session), mockRequests: (mock.requests ?? []).length, sessions: items.map((i) => ({ s: String(i.sessionId ?? '').slice(-14), run: i.running, blank: i.blank })) }
      } catch (error) {
        diag = { diagFailed: String(error).slice(0, 80) }
      }
      die(`barrier: no wire request for "${textBase.slice(0, 40)}…" after ${attempts} prompt attempts on ${sessionId} (last HTTP ${lastStatus}); live-delta=${JSON.stringify(diag)}`)
    }

    // Discovery turn on the BOOT root (un-governed anchor population): the
    // live surface the main blueprint deny list is computed from (a5w7 law).
    // UNIFORM across worlds: the early gatered stall that once forced a
    // wireless gatered design turned out to be the version-less sentinel
    // package.json (plugin-package-inventory REQUEST EXTENSION, README §5.12)
    // — with that fixed, every world drives the same way, wire included.
    const disc = await promptBarrier({ sessionId: ROOT, textBase: MK_DISC, rpcTag: `a5g5-${mode}-d` })
    facts.discPrompt = { attempts: disc.attempts, status: disc.lastStatus }
    const discReq = disc.hit
    const surface = discReq.body.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '').sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    facts.discoverySurface = surface
    facts.denyList = denyList
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, MK_LEADER))

    // The governed Team (main blueprint) — plane mount / coverage / pairing
    // all fire on THIS population only.
    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `a5g5-${mode}-tc`, method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK_LEADER} Reply OK.` } } } }),
    }, 90_000)
    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 1400) }

    // Refusal evidence channels, BOTH public: the team.create RESPONSE BODY
    // (setup failures project there — world-measured) and the console. The
    // kit records both; the criteria accept either.
    const EXPECTED_ERROR = mode === 'gatered' ? /alpha2-permission-coverage-unmanaged-tools|unknown-unmanaged/
      : mode === 'refuse' ? /TRUST_ROOT_SHA_MISMATCH|alpha5-team-tool-plane-trust_root_sha_mismatch/ : null
    if (EXPECTED_ERROR !== null) {
      facts.errorInBody = EXPECTED_ERROR.test(String(facts.teamCreate?.body ?? ''))
      facts.expectedErrorLine = await waitForLogLine(INSTANCE_RAW, EXPECTED_ERROR, 45_000)
      facts.errorSeen = facts.errorInBody || facts.expectedErrorLine !== null
    } else {
      // the leader turn completing = guard arm + plane mount + coverage gate
      // + bindOwnTools + publish ALL green (a red anything = no turn).
      facts.leaderTurn = await waitFor(180_000, async () => {
        const hit = (mock.requests ?? []).find((r) => JSON.stringify(r.body?.messages ?? []).includes(MK_LEADER))
        return hit ?? false
      }, `${mode} leader turn at the mock`)
      facts.leaderWireCatalog = Array.isArray(facts.leaderTurn.body?.tools)
        ? facts.leaderTurn.body.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '').sort() : null
      delete facts.leaderTurn
    }

    // The two NON-team sessions (shipped presets), one setup turn each.
    for (const preset of PRESETS) {
      const MKP = `${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`
      const c = await fetchJson(`${origin}/api/session/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5g5-${mode}-${preset}-c`, method: 'session/create', payload: { args: { request: { agentPreset: preset } } } }),
      }, 60_000)
      const sessionId = c.body?.result?.value?.sessionId ?? c.body?.value?.sessionId ?? null
      facts[preset] = { sessionId, createStatus: c.status }
      if (typeof sessionId !== 'string' || sessionId === '') { facts[preset].failed = true; continue }
      const presHit = await promptBarrier({ sessionId, textBase: MKP, rpcTag: `a5g5-${mode}-${preset}-p`, attempts: 10 })
      facts[preset].promptAttempts = presHit.attempts
      facts[preset].wireCatalog = presHit.hit.body.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '').sort()
    }

    const observed = await waitFor(120_000, async () => {
      const f = await fetchJson(`${origin}/__a5g5/facts?names=${encodeURIComponent([...ALIASES, 'team_stray'].join(','))}&roots=${encodeURIComponent(CREATE_ROOT)}`).catch(() => null)
      if (f?.status !== 200) return false
      const live = (f.body.agents ?? []).filter((a) => Array.isArray(a.scopedNames))
      return live.length >= PRESETS.length ? f.body : false
    }, `${mode} observer facts`)
    facts.globalNames = observed.globalNames
    facts.planeObservations = observed.planeObservations
    facts.liveJobsGateway = observed.liveJobsGateway
    const byId = {}
    for (const a of observed.agents ?? []) byId[a.session] = a
    facts.leader = byId[CREATE_ROOT] ?? null
    for (const preset of PRESETS) {
      const sid = facts[preset]?.sessionId
      facts[preset].scopedNames = byId[sid]?.scopedNames ?? null
    }
    facts.ok = true
    return facts
  } finally {
    writeEvidence(`world-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 1200))
    try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
}

async function main() {
  console.log(`a5g5 negctl runner stamp=${RUN_STAMP} port=${HOST_PORT}`)
  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine 0.2.0-rc.2 runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)} (porcelain ${porcelainBefore === '' ? 0 : 'DIRTY'} before)`,
    head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)}`)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('H2', `host port ${HOST_PORT} free (self-proved) and a mock port from the 349x family free`, (await portFree(HOST_PORT)) && mockPort > 0, `mock=${mockPort}`)
  const stableBefore = await stableProbe()

  const MK = `A5G5_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const mock = await startMockModel({
    port: mockPort,
    log: (m) => console.log(m),
    decide: ({ req }) => {
      const text = JSON.stringify(req?.messages ?? [])
      for (const mode of MODES) {
        if (text.includes(`${MK}_${mode.toUpperCase()}_DISC`)) return { kind: 'text', content: 'A5G5_DISC_OK' }
        if (text.includes(`${MK}_${mode.toUpperCase()}_LEADER`)) return { kind: 'text', content: 'A5G5_L1_OK' }
        for (const preset of PRESETS) {
          if (text.includes(`${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`)) return { kind: 'text', content: 'A5G5_PRESET_OK' }
        }
      }
      return { kind: 'text', content: 'a5g5-mock: unscripted request, completing quietly.' }
    },
  })

  const worlds = {}
  try {
    for (const mode of MODES) worlds[mode] = await runWorld({ mode, mock, MK, blueprintBaseDir: join(EVIDENCE_DIR, 'blueprints') })
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  const stableAfter = await stableProbe()
  check('H3', ':3080 stable instance untouched (read-only probe before/after) and the test-use host porcelain 0 after',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} → ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  for (const mode of MODES) writeEvidence(`world-${mode}.json`, worlds[mode] ?? { missing: true })
  check('W1', 'all four worlds booted, discovery ran, the governed team was driven, observer facts captured (worlds swept)',
    MODES.every((m) => worlds[m]?.ok === true), MODES.map((m) => `${m}:${worlds[m]?.ok === true ? 'ok' : 'FAIL'}${worlds[m]?.swept ? '/swept' : '/UNSWEPT'}`).join(' '))

  const b = worlds.baseline ?? {}
  const p = worlds.plane ?? {}
  const g = worlds.gatered ?? {}
  const r = worlds.refuse ?? {}

  // N1 — the positive control, world-true (criteria whose worlds did not run
  // in THIS invocation are skipped, never fake-green/red).
  const setEq = (a, c) => Array.isArray(a) && Array.isArray(c) && JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(c)].sort())
  if (MODES.includes('plane')) {
    const leaderScoped = p.leader?.scopedNames ?? []
    const aliasScoped = ALIASES.every((n) => leaderScoped.includes(n))
    const aliasOwnLayer = ALIASES.every((n) => p.leader?.perName?.[n]?.scopedPresent === true && p.leader?.perName?.[n]?.globalPresent === false)
    const placedRow = Array.isArray(p.planeObservations) && p.planeObservations.some((o) => String(o).startsWith('a5-plane: placed [team_grep,team_glob,team_bash]'))
    check('N1a', 'POSITIVE: the governed leader of the plane world carries the three aliases in its OWN layer (scoped yes, GLOBAL no) and the assembly logged the placement',
      aliasScoped && aliasOwnLayer && placedRow, `scoped=[${leaderScoped.filter((n) => n.startsWith('team_'))}] global=${JSON.stringify(p.globalNames)}`)
    const leaderWire = p.leaderWireCatalog ?? []
    check('N1b', 'POSITIVE: the placement reached the model-facing WIRE catalog of the governed leader AND its turn completed (guard→mount→coverage→bind→publish all green)',
      ALIASES.every((n) => leaderWire.includes(n)), `wire team_*=[${leaderWire.filter((n) => n.startsWith('team_'))}]`)
    const gw = p.liveJobsGateway?.[CREATE_ROOT]
    check('N1c', 'POSITIVE: the PR7 live row is open for the owning root through the production entry (gateway + assembly-owned lease present; NON-authority witness)',
      gw?.present === true && gw?.hasGateway === true && gw?.hasLease === true, JSON.stringify(gw ?? null))
  }
  if (MODES.includes('baseline')) {
    const bLeaderScoped = b.leader?.scopedNames ?? []
    const baselineClean = (b.planeObservations ?? []).length === 0 && !bLeaderScoped.some((n) => ALIASES.includes(n))
      && b.liveJobsGateway?.[CREATE_ROOT]?.present !== true
    check('N1d', 'POSITIVE control-of-controls: the BASELINE governed leader (no row config) shows zero plane aliases, zero plane observations and NO jobs gateway — the mount is config-scoped, not ambient',
      baselineClean, `aliases=${JSON.stringify(bLeaderScoped.filter((n) => ALIASES.includes(n)))} obs=${JSON.stringify(b.planeObservations ?? []).slice(0, 120)}`)
  }

  // N2 — the non-team double zero (dual preset × dual face) against baseline.
  if (MODES.includes('baseline') && MODES.includes('plane')) {
    for (const preset of PRESETS) {
      const regEq = setEq(b[preset]?.scopedNames, p[preset]?.scopedNames)
      const wireEq = setEq(b[preset]?.wireCatalog, p[preset]?.wireCatalog)
      check(`N2-${preset}`, `NEGATIVE ZERO: the ${preset} NON-team session model-facing catalog is set-IDENTICAL baseline→plane on BOTH the registry face and the wire face`,
        regEq && wireEq, `registryΔ=${JSON.stringify((p[preset]?.scopedNames ?? []).filter((n) => !(b[preset]?.scopedNames ?? []).includes(n)))} wireΔ=${JSON.stringify((p[preset]?.wireCatalog ?? []).filter((n) => !(b[preset]?.wireCatalog ?? []).includes(n)))}`)
    }
  }

  // N3 — the Coverage Gate keeps its red even WITH the plane mounted.
  if (MODES.includes('gatered')) {
    const gErr = `${String(g.expectedErrorLine ?? '')} ${g.errorInBody === true ? String(g.teamCreate?.body ?? '') : ''}`
    const gNonTeam = PRESETS.every((preset) => g[preset]?.createStatus === 200 && g[preset]?.failed !== true)
    check('N3', 'NEGATIVE: with the plane mounted AND an unattributed team_-namespace MASQUERADER surviving the mask onto the governed surface, the setup still dies on alpha2-permission-coverage-unmanaged-tools (body or console) — the plane did not whiten the gate — while the NON-team sessions are untouched (they still boot turns)',
      g.errorSeen === true && /alpha2-permission-coverage-unmanaged-tools|unknown-unmanaged/.test(gErr) && gNonTeam, `seen=${g.errorSeen} inBody=${g.errorInBody} log=${String(g.expectedErrorLine).slice(0, 100)} nonTeam=${gNonTeam}`)
  }

  // N4 — unknown attribution fails CLOSED through the public route.
  if (MODES.includes('refuse')) {
    const rErr = `${String(r.expectedErrorLine ?? '')} ${r.errorInBody === true ? String(r.teamCreate?.body ?? '') : ''}`
    check('N4', 'NEGATIVE: a half-paired trustRoot row refuses the governed setup with the typed TRUST_ROOT_SHA_MISMATCH (body or console; no degraded unverified fallback, no partial mount survives)',
      r.errorSeen === true, `seen=${r.errorSeen} inBody=${r.errorInBody} err=${rErr.slice(0, 160)}`)
    const rNoAlias = !(r.leader?.scopedNames ?? []).some((n) => ALIASES.includes(n))
    check('N4b', 'NEGATIVE: the refused world shows NO plane alias anywhere (the refusal unwound everything it touched)',
      rNoAlias && (r.planeObservations ?? []).every((o) => !String(o).startsWith('a5-plane: placed')), `aliases=${JSON.stringify((r.leader?.scopedNames ?? []).filter((n) => ALIASES.includes(n)))}`)
  }

  writeEvidence('criteria.json', { runStamp: RUN_STAMP, port: HOST_PORT, criteria: CRITERIA })
  const red = CRITERIA.filter((c) => !c.pass)
  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`} (${CRITERIA.length - red.length}/${CRITERIA.length})`)
  process.exit(red.length === 0 ? 0 : 2)
}

main().then(
  () => process.exit(0),
  async (error) => {
    console.log(`FATAL ${redact(String(error?.stack ?? error)).split('\n').slice(0, 8).join(' | ')}`)
    writeEvidence('fatal.json', { error: redact(String(error?.message ?? error)), criteriaSoFar: CRITERIA })
    process.exit(1)
  },
)
