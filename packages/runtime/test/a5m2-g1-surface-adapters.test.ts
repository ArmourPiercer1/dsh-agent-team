/**
 * A5M2-G1-SURFACE (root 706fd FINAL RULING + 89a9 P1 round, rev.6) — the 14 G1 records
 * (B-CONTROL×5, B-HUMAN×2, B-PRESENT, B-PLUGIN, B-INSPECT×2, B-SKILL,
 * B-DEPENDENCY, B-DOMAIN) proven against the REAL where it exists and
 * doubles where it does not:
 *  U1 the install gate runs the REAL EXPORTED host adjudicator
 *     (packages/sandbox/sandbox lib approveEscalation): effectiveMode from
 *     the mounted sandboxPolicy, the request {requestedMode, effectiveMode,
 *     subject, justification} judged over {approver, agent, callId,
 *     toolName, signal}; every non-grant (rejected/cancelled/unavailable,
 *     missing approver/agent, non-wider target) is the REAL throw surfacing
 *     as a refusal with ZERO manager entry; the effective-mode repeat needs
 *     no approval (the real short-circuit); AFTER the await the signal is
 *     re-checked and the CURRENT facts re-verified before the manager;
 *  U2 dependency FAILS CLOSED: with no controlledInstall mount the delegate
 *     refuses before any fs of its own and before native entry; with the
 *     REAL EXPORTED installPrimaryRuntime mounted (tool-workspace-dependencies
 *     lib) the arm RUNS the real controlled path (manifest gate + staging
 *     copy + validatePayloadEntries + rename-commit) — no fixture copy/rename
 *     followed by a post-hoc 'BLOCKED', and no self-hashing;
 *  U3 entry-set/remove targets accept the REAL '@scope/pkg' package-name
 *     shape (paths/version-qualified refuse); set_version_exemption demands
 *     the manifest package-name@version pair;
 *  U4 present restores the REAL working function: OS-absolute deliverables
 *     are legal and ride as GOVERNED absolute-path effects (kind-routed
 *     through the lane grammar), relative '..' stays refused — neither
 *     blanket-refuse nor silent allow.
 *  P1 (89a9) the policy scope is host-verbatim pass-through: the REAL Host
 *     Session is an OBJECT; sandboxPolicy.resolve must receive
 *     exec.agent === undefined ? {} : { session: exec.agent.session } with
 *     the session BY REFERENCE (a narrower session configuration only
 *     resolves when the object survives); the fixtures carry the real shape
 *     — string-shaped AGENT doubles are forbidden, they mask the drop. The
 *     dependency result additionally reports the reused-path residual gaps
 *     (no ControlledFs / no full-payload digest / no owner single-flight /
 *     no cancel): the 'controlledInstall' name never closes the contract.
 *
 * DISCLOSURE (honest labels): the escalation legs run the REAL exported host
 * approveEscalation against a fixture approver (the approver is the
 * ctx.get('approval') channel — integrator-side), and the dependency happy
 * leg runs the REAL exported installPrimaryRuntime over a REAL temp world.
 * Everything else runs on native doubles, the MANAGER CONTRACT DOUBLE (host
 * async install/wait/cancel law) and fixture trusted ports. This spec proves
 * the ADAPTER LAWS. IT IS NOT C2 and no leg claims C2: no Host process, no
 * network; C2 needs the real hosts, the real PA edge, the real approval
 * channel and real business observers (integrator-side).
 *
 * Scope: NO Host process, NO network. Windows dimensions are not run on this
 * Linux harness and never claimed.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-surface-adapters
 */
import { describe, it, expect, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { arch as osArch, platform as osPlatform } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'

type Refusal = { ok: false; code: string; detail: string }
type Success = {
  ok: true
  plan: unknown
  name: string
  effects: Array<Record<string, unknown>>
  serviceObligations: Array<Record<string, string>>
  targetManifest: Record<string, unknown>
  reviewPayload: Record<string, unknown>
  generations: Record<string, unknown>
  parametersFingerprint: string
}
type ClassifyResult = Success | Refusal
type WaitOutcome = { outcome: string; changeResult?: Record<string, unknown> | null; waitForInstallAnswer?: unknown; afterNote?: string; completionImplied?: boolean; error?: string }
type LifecycleHandle = {
  requestId: string
  boundTo: Record<string, unknown>
  gateReceipt?: Record<string, unknown>
  law: string
  cancel: () => Promise<Record<string, unknown>>
  wait: () => Promise<WaitOutcome>
  cancellation: () => Record<string, unknown> | null
  abortMappedToCancelInstall: boolean
}
type DelegateResult = {
  ok?: boolean
  value?: unknown
  settled?: string
  detail?: string
  code?: string
  completionImplied?: boolean
  verifiedBy?: string
  residualGap?: string
  commitLaw?: string
  commitWitness?: (witness: unknown) => Record<string, unknown>
  lifecycle?: LifecycleHandle
}
type WitnessShape = { callId: string; turn: number; sessionHeaderId?: string }
type G1Row = {
  name: string
  familyId: string
  recordIndex: number
  capturePresent: boolean
  descriptionFrom: string
  description: string | null
  parameters: Record<string, unknown> | null
  definitionIdentity: string | null
  classify: (args: unknown, callId: string) => ClassifyResult
  delegate: (plan: unknown, ctx?: { exec?: unknown }) => Promise<DelegateResult>
  commitWitness?: (plan: unknown, witness: WitnessShape) => Record<string, unknown>
}
type G1RecordSpec = {
  recordIndex: number
  family: string
  scope: string
  ownerRole: string
  capture: string
  nativeFaceRef: string
  requiredTopLevel: string[]
  parametersTopLevel: string[]
  effectDeltaNotes: readonly string[]
}
type G1Module = {
  A5_G1_FAMILY_GROUP: string
  A5_G1_ADAPTER_REVISION: number
  A5_G1_PLUGIN_ACTIONS: readonly string[]
  A5_G1_RECORD_SPECS: Record<string, G1RecordSpec>
  g1SurfaceAdapterNames: () => string[]
  mountG1SurfaceAdapter: (recordName: string, deps?: Record<string, unknown>) => G1Row
}

const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as G1Module

// ── REAL host seams from the pristine baseline (r9 pattern; fail closed) ───
type HostSandboxLib = { approveEscalation: (request: unknown, approval: unknown) => Promise<string> }
type HostWorkDepLib = { installPrimaryRuntime: (source: string, root: string) => Promise<Record<string, unknown>> }
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_PKG = (...rel: string[]): string => join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', ...rel)
const SANDBOX_LIB = HOST_PKG('sandbox', 'sandbox', 'lib', 'index.js')
const WORKDEP_LIB = HOST_PKG('skill', 'tool-workspace-dependencies', 'lib', 'index.js')
if (!existsSync(SANDBOX_LIB)) throw new Error(`pristine sandbox lib absent (${SANDBOX_LIB}); failing closed`)
if (!existsSync(WORKDEP_LIB)) throw new Error(`pristine workspace-dependencies lib absent (${WORKDEP_LIB}); failing closed`)
const HOST_SANDBOX = (await import(pathToFileURL(SANDBOX_LIB).href)) as unknown as HostSandboxLib
const HOST_WORKDEP = (await import(pathToFileURL(WORKDEP_LIB).href)) as unknown as HostWorkDepLib

// ── fixture trusted CONFIG faces (never model-supplied; the closed-root
//    legs prove that) ───────────────────────────────────────────────────────
const TRUSTED = {
  memberAgentId: 'agent-member-1',
  sessionHeaderId: 'session-header-77',
  realmId: 'realm-alpha',
  owner: 'owner-root-1',
  profileId: 'profile-live-1',
}
const BINDINGS = () => ({ bindingId: 'binding-3', bindingRevision: 7, policyGeneration: 3, authorityGeneration: 2 })
/* REAL Host shape (89a9): Agent.session is a Session OBJECT — a
 * string-shaped AGENT double masked the scope-drop defect, forbidden. */
const SESSION = { header: { id: 'session-header-77', root: '/dsh/agents/agent-member-1' }, sandboxMode: 'workspace-write' }
const AGENT = { id: 'agent-member-1', session: SESSION }

const PLUGIN_FACTS = {
  profileConfigLocator: '/dsh/profile/package.json',
  installRootLocator: '/dsh/profile/bundles',
  cacheRootLocator: '/dsh/cache/npm',
  exemptionsLocator: '/dsh/profile/exemptions.json',
  allowedRegistries: ['https://registry-primary.example'],
  fallbackRegistries: ['https://registry-fallback.example'],
}

// ── REAL dependency world the REAL controlled path installs from ──────────
const WORLD_ROOT = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), 'g1-dep-world-'))
const DEP_SOURCE = join(WORLD_ROOT, 'payload')
const DEP_BAD_SOURCE = join(WORLD_ROOT, 'payload-bad')
const DEP_ROOT = join(WORLD_ROOT, 'runtimes', 'primary')
const DEP_ROOT2 = join(WORLD_ROOT, 'runtimes', 'other')
mkdirSync(join(DEP_SOURCE, 'dependencies', 'python', 'bin'), { recursive: true })
mkdirSync(join(DEP_SOURCE, 'dependencies', 'python', 'lib', 'python3.12', 'site-packages'), { recursive: true })
mkdirSync(join(DEP_SOURCE, 'dependencies', 'node', 'bin'), { recursive: true })
mkdirSync(join(DEP_SOURCE, 'dependencies', 'node', 'node_modules'), { recursive: true })
mkdirSync(join(DEP_SOURCE, 'dependencies', 'pnpm', 'bin'), { recursive: true })
const MANIFEST = {
  desktopVersion: '0.2.0-rc.2', platform: osPlatform(), arch: osArch(),
  python: '3.12.1', node: '22.11.0', pnpm: '9.12.0', pythonPackages: {},
}
writeFileSync(join(DEP_SOURCE, 'runtime.json'), JSON.stringify(MANIFEST), 'utf8')
writeFileSync(join(DEP_SOURCE, 'dependencies', 'python', 'bin', 'python3'), '#!/bin/sh\n', 'utf8')
writeFileSync(join(DEP_SOURCE, 'dependencies', 'node', 'bin', 'node'), '#!/bin/sh\n', 'utf8')
writeFileSync(join(DEP_SOURCE, 'dependencies', 'pnpm', 'bin', 'pnpm.mjs'), 'export {}\n', 'utf8')
mkdirSync(DEP_BAD_SOURCE, { recursive: true })
// a VALID shape for a foreign platform: the controlled path's own
// compatibleManifest gate (not the parser) is what refuses it:
writeFileSync(join(DEP_BAD_SOURCE, 'runtime.json'), JSON.stringify({ ...MANIFEST, platform: MANIFEST.platform === 'win32' ? 'linux' : 'win32' }), 'utf8')
afterAll(() => {
  rmSync(WORLD_ROOT, { recursive: true, force: true })
})
const DEPENDENCY_FACTS_PROVIDER = { current: () => ({ sourceLocator: DEP_SOURCE, rootLocator: DEP_ROOT }) }

const PORTS: Record<string, unknown> = {
  trustedCatalog: { current: () => ({ catalogRevision: 5, catalogDigest: 'sha256:catalogfive', names: ['gpt', 'browser-skill'] }) },
  trustedTopology: {
    current: () => ({
      topologyRevision: 9,
      topologyDigest: 'sha256;toponine',
      allowed: [
        { platform: 'host', provider: 'host-providers', method: 'list' },
        { platform: 'client', provider: 'slot-tree', method: 'list_slots' },
      ],
    }),
  },
  domainPortRegistry: { current: () => ({ domainAuthorityId: 'domain-acme', portRevision: 4 }) },
  pluginFacts: { current: () => PLUGIN_FACTS },
  dependencyFacts: DEPENDENCY_FACTS_PROVIDER,
}

/** The REAL EXPORTED host escalation adjudicator plus the two tool-ctx
 * seams the row cannot reach itself (sandboxPolicy, the approver channel).
 * The approver double only ANSWERS like a user would — every judgement is
 * made by the real approveEscalation (its real THROWs surface verbatim). */
function makeGate(over: {
  mode?: string
  modeFor?: (scope: Record<string, unknown>) => string
  outcome?: 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'
  approverPresent?: boolean
  duringGate?: () => void
} = {}) {
  const mode = over.mode ?? 'workspace-write'
  const outcome = over.outcome ?? 'allowed-once'
  const approverPresent = over.approverPresent ?? true
  const approverRequests: Array<Record<string, unknown>> = []
  const scopes: Array<Record<string, unknown>> = []
  const approver = approverPresent
    ? {
        async request(req: Record<string, unknown>): Promise<string> {
          approverRequests.push(req)
          if (over.duringGate !== undefined) over.duringGate()
          return outcome
        },
      }
    : undefined
  const port = {
    sandboxPolicy: {
      resolve: (scope: Record<string, unknown>): { scope: Record<string, unknown>; mode: string } => {
        scopes.push(scope)
        return { scope, mode: over.modeFor !== undefined ? over.modeFor(scope) : mode }
      },
    },
    approver,
    approveEscalation: HOST_SANDBOX.approveEscalation,
  }
  return { port, approverRequests, scopes }
}
const CONTROLLED_PORT = { installPrimaryRuntime: HOST_WORKDEP.installPrimaryRuntime }

/** MANAGER CONTRACT DOUBLE — the real async face at 639ed01539:
 * installBundle(spec, {requestId, enabled?, approvedBuilds?, registry?})
 * returns a pending Promise<ChangeResult> and keys installs by the CALLER's
 * id; waitForInstall answers the live promise or null; cancelInstall AWAITTS
 * the live result and answers the CLOSED {status} law. */
function makeManagerDouble() {
  type Control = { phase: 'installing' | 'applying'; promise: Promise<Record<string, unknown>>; resolve: (v: Record<string, unknown>) => void }
  const installs = new Map<string, Control>()
  const installCalls: Array<{ spec: string; options: Record<string, unknown> }> = []
  const cancelSeen: string[] = []
  const waitSeen: string[] = []
  const face = {
    installBundle(spec: string, options: Record<string, unknown>): Promise<Record<string, unknown>> {
      installCalls.push({ spec, options })
      let resolve!: (v: Record<string, unknown>) => void
      const promise = new Promise<Record<string, unknown>>((res) => { resolve = res })
      const id = String(options.requestId)
      installs.set(id, { phase: 'installing', promise, resolve })
      return promise.finally(() => { installs.delete(id) })
    },
    async waitForInstall(requestId: string): Promise<Record<string, unknown> | null> {
      waitSeen.push(requestId)
      return (await (installs.get(requestId)?.promise ?? null)) ?? null
    },
    async cancelInstall(requestId: string): Promise<{ status: string }> {
      cancelSeen.push(requestId)
      const control = installs.get(requestId)
      if (control === undefined) return { status: 'not-running' }
      if (control.phase === 'applying') return { status: 'too-late' }
      await control.promise
      return { status: 'cancelled' }
    },
  }
  return {
    face,
    installCalls,
    cancelSeen,
    waitSeen,
    apply(requestId: string): void { const c = installs.get(requestId); if (c !== undefined) c.phase = 'applying' },
    settle(requestId: string, result: Record<string, unknown>): void { installs.get(requestId)?.resolve(result) },
  }
}

/** Nested-required CANONICAL face (registration-face spelling) carried by
 * the ask_user_question double. */
const ASK_USER_CANONICAL_PARAMETERS = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: 'Questions to ask the user before continuing.',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string', description: 'Stable id for this question; echoed in the answer.' },
          question: { type: 'string', description: 'The specific question to ask the user.' },
          options: {
            type: 'array',
            description: 'Optional choices to show the user.',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                label: { type: 'string', description: 'Short user-facing option label.' },
                description: { type: 'string', description: 'One sentence explaining the tradeoff.' },
              },
              required: ['label'],
            },
          },
        },
        required: ['id', 'question'],
      },
    },
  },
  required: ['questions'],
}

type NativeCall = { args: unknown; exec: unknown }

function makeNativeDouble(
  recordName: string,
  spec: G1RecordSpec,
  execute?: (args: unknown, exec: unknown) => Promise<unknown>,
): { native: Record<string, unknown>; calls: NativeCall[] } {
  const calls: NativeCall[] = []
  const parameters = recordName === 'ask_user_question'
    ? structuredClone(ASK_USER_CANONICAL_PARAMETERS)
    : { type: 'object', properties: {} }
  const body = execute ?? (async (): Promise<unknown> => (recordName === 'cordis_inspect_list'
    ? { providers: [] }
    : { nativeRan: recordName, family: spec.family }))
  const wrapped = async (args: unknown, exec: unknown): Promise<unknown> => {
    calls.push({ args, exec })
    return body(args, exec)
  }
  if (spec.scope === 'surface') {
    return { native: { name: recordName, description: `native double (domain effect-boundary port) of ${recordName}`, decide: wrapped }, calls }
  }
  return { native: { name: recordName, description: `native double of ${recordName}`, parameters, execute: wrapped }, calls }
}

const GOOD_ARGS: Record<string, Record<string, unknown>> = {
  skill: { name: 'gpt' },
  load_workspace_dependencies: {},
  ask_user_question: { questions: [{ id: 'q1', question: 'Which target?', options: [{ label: 'A' }] }] },
  exit_plan_mode: { plan: '# Plan\n\nDo the governed thing.' },
  present: { files: [{ path: 'out.md' }] },
  plugin_manager: { action: 'list_plugins' },
  cordis_inspect_list: {},
  cordis_inspect_query: { platform: 'host', provider: 'host-providers', method: 'list' },
  team_request_control: {
    rootSessionId: 'root-1', requestToken: 'tok-1', kind: 'leader-approval',
    targetInstanceId: 'member-2', actionName: 'deploy',
  },
  team_resolve_control: { rootSessionId: 'root-1', requestToken: 'tok-2', requestId: 'req-1', decision: 'allow' },
  team_list_pending_control: { rootSessionId: 'root-1', requestToken: 'tok-3' },
  team_grant_permission: {
    rootSessionId: 'root-1', requestToken: 'tok-4', targetInstanceId: 'member-2',
    rules: [{ operationClass: 'file', matcher: { kind: 'exact', value: 'a.txt' }, effect: 'allow' }],
  },
  team_revoke_permission: {
    rootSessionId: 'root-1', requestToken: 'tok-5', targetInstanceId: 'member-2',
    rules: [{ operationClass: 'file', matcher: { kind: 'exact', value: 'a.txt' }, effect: 'allow' }],
  },
  'surface:domain_family': { toolName: 'write', domainAuthorityId: 'domain-acme', targetDigest: 'sha256:deadbeef' },
}

/** The §3-derived expected effect-kind multiset per record (generic-loop
 * args; plugin install / per-action live in dedicated legs). */
const EXPECT_KINDS: Record<string, string[]> = {
  skill: ['tool-invoke'],
  load_workspace_dependencies: ['list', 'read', 'read', 'tool-invoke', 'write', 'write', 'write'],
  ask_user_question: ['tool-invoke'],
  exit_plan_mode: ['tool-invoke'],
  present: ['meta', 'read', 'tool-invoke'],
  plugin_manager: ['tool-invoke'],
  cordis_inspect_list: ['tool-invoke'],
  cordis_inspect_query: ['tool-invoke'],
  team_request_control: ['tool-invoke'],
  team_resolve_control: ['tool-invoke'],
  team_list_pending_control: ['tool-invoke'],
  team_grant_permission: ['tool-invoke'],
  team_revoke_permission: ['tool-invoke'],
  'surface:domain_family': ['domain-ref'],
}

const NAMES = G1.g1SurfaceAdapterNames()
const byName = (name: string): G1RecordSpec => G1.A5_G1_RECORD_SPECS[name] as G1RecordSpec
const goodArgs = (name: string): Record<string, unknown> => GOOD_ARGS[name] as Record<string, unknown>
const kindsOf = (effects: Array<Record<string, unknown>>): string[] => effects.map((e) => String(e.kind)).sort()

function mountRecord(
  name: string,
  over: {
    ports?: Record<string, unknown>
    execute?: (args: unknown, exec: unknown) => Promise<unknown>
    installFace?: unknown
    escalation?: unknown | null
    controlledInstall?: unknown | null
  } = {},
): { row: G1Row; native: Record<string, unknown>; calls: NativeCall[] } {
  const double = makeNativeDouble(name, byName(name), over.execute)
  const escalation = over.escalation === undefined ? makeGate().port : over.escalation
  const controlled = over.controlledInstall === undefined ? CONTROLLED_PORT : over.controlledInstall
  const row = G1.mountG1SurfaceAdapter(name, {
    native: double.native,
    providerId: 'g1-spec',
    definitionIdentity: `def-${name}`,
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ports: { ...PORTS, ...(over.ports ?? {}) },
    ...(over.installFace === undefined ? {} : { installFace: over.installFace }),
    ...(escalation === null ? {} : { hostEscalation: escalation }),
    ...(controlled === null ? {} : { controlledInstall: controlled }),
  })
  return { row, native: double.native, calls: double.calls }
}

function bareMount(name: string, ports: Record<string, unknown> = {}): G1Row {
  return G1.mountG1SurfaceAdapter(name, {
    native: makeNativeDouble(name, byName(name)).native,
    providerId: 'g1-spec',
    definitionIdentity: `def-${name}`,
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ports,
  })
}

describe('a5m2-g1-surface-adapters rev.6: REAL seams where they exist — NOT C2 (100+ component legs, not records)', () => {
  it('the record set equals the frozen dispatch index (family-filtered, recordIndex-exact); spec VALUES carry no lane paths (string literals are audit edges)', () => {
    const indexPath = fileURLToPath(new URL(
      '../../../docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json',
      import.meta.url,
    ).href)
    expect(existsSync(indexPath)).toBe(true)
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
      records: Array<{ recordIndex: number; name: string; family: string; scope: string; implementationOwnerRole: string }>
    }
    const g1Families = new Set(['B-CONTROL', 'B-HUMAN', 'B-PRESENT', 'B-PLUGIN', 'B-INSPECT', 'B-SKILL', 'B-DEPENDENCY', 'B-DOMAIN'])
    const expected = index.records.filter((r) => g1Families.has(r.family))
    expect(expected.length).toBe(14)
    expect(NAMES.length).toBe(14)
    for (const record of expected) {
      const spec = byName(record.name)
      expect(spec, `record ${record.name} is covered`).toBeDefined()
      expect(spec.recordIndex).toBe(record.recordIndex)
      expect(spec.family).toBe(record.family)
      expect(spec.scope).toBe(record.scope)
      expect(spec.ownerRole).toBe(record.implementationOwnerRole)
      expect(spec.nativeFaceRef).toMatch(/^ledger:/)
    }
    for (const name of NAMES) {
      expect(expected.some((r) => r.name === name), `no extra record beyond the index: ${name}`).toBe(true)
    }
    expect(JSON.stringify(G1.A5_G1_RECORD_SPECS)).not.toMatch(/packages\//)
    expect(JSON.stringify(G1.A5_G1_RECORD_SPECS)).not.toMatch(/index\.ts/)
  })

  for (const name of NAMES) {
    describe(name, () => {
      it('REAL contract effects: REAL closed-grammar parse; §3 kind multiset; trusted target + generations ride the plan', () => {
        const { row } = mountRecord(name)
        const classified = row.classify(goodArgs(name), `call-${name}`)
        expect(classified.ok, JSON.stringify(classified)).toBe(true)
        if (!classified.ok) return
        const parsed = parseRequestedEffectSet(classified.effects)
        expect(parsed.ok === true ? [] : (parsed as unknown as { problems: Array<{ detail: string }> }).problems).toEqual([])
        expect(kindsOf(classified.effects)).toEqual(EXPECT_KINDS[name] as string[])
        // RE-ANCHORED @ 957a5f526 (family-rules round 2): B-CONTROL/B-INSPECT mint
        // FLAT leaves (bijection mapping in the commit); every other family keeps
        // the nested trusted envelope. Both spellings assert the SAME five truths.
        const tm = classified.targetManifest as Record<string, unknown>
        if (tm.trusted !== undefined) {
          expect(tm.trusted).toEqual({ ...TRUSTED })
        } else {
          expect(tm.trustedMemberAgentId).toBe(TRUSTED.memberAgentId)
          expect(tm.trustedSessionHeaderId).toBe(TRUSTED.sessionHeaderId)
          expect(tm.trustedRealmId).toBe(TRUSTED.realmId)
          expect(tm.trustedOwner).toBe(TRUSTED.owner)
          expect(tm.trustedProfileId).toBe(TRUSTED.profileId)
        }
        expect(classified.generations).toMatchObject({
          bindingId: 'binding-3', bindingRevision: 7, policyGeneration: 3, authorityGeneration: 2, definitionIdentity: `def-${name}`,
        })
        expect(classified.serviceObligations.length).toBeGreaterThan(0)
        expect(classified.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
      })

      it('trusted targets are CONFIG faces: a model-smuggled memberAgentId refuses at the closed root', () => {
        const { row } = mountRecord(name)
        const forged = row.classify({ ...goodArgs(name), memberAgentId: 'agent-forged' }, 'call-forged')
        expect(forged.ok).toBe(false)
        expect((forged as Refusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_PARAMETER')
      })

      it('capture-absent: every entry refuses P_G1_NATIVE_CAPTURE_ABSENT typed, zero native entry, no re-resolution', async () => {
        if (byName(name).capture === 'surface') {
          expect(() => G1.mountG1SurfaceAdapter(name, {
            native: undefined, providerId: 'g1-spec', trusted: TRUSTED, bindingFacts: BINDINGS, ports: PORTS,
          })).toThrow(TypeError)
          return
        }
        const row = G1.mountG1SurfaceAdapter(name, {
          native: undefined, providerId: 'g1-spec', trusted: TRUSTED, bindingFacts: BINDINGS, ports: PORTS,
        })
        expect(row.capturePresent).toBe(false)
        expect(row.description).toBeNull()
        expect((row.classify(goodArgs(name), 'call-x') as Refusal).code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
        const delegated = await row.delegate({ callId: 'call-x' })
        expect((delegated as unknown as Refusal).code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
      })

      it('delegate-once, plan-bound: only own plans, at most once; the body receives the PLAN\'s frozen clone (args unswappable); dependency runs the REAL controlled path, never its double', async () => {
        const { row, calls } = mountRecord(name)
        const classified = row.classify(goodArgs(name), `call-${name}`)
        expect(classified.ok).toBe(true)
        if (!classified.ok) return
        const foreign = await row.delegate({ callId: 'not-mine' })
        expect((foreign as unknown as Refusal).code).toBe('P_G1_NOT_OWN_PLAN')
        expect(calls.length).toBe(0)
        const first = await row.delegate(classified.plan, { exec: { callId: `call-${name}` } })
        if (name === 'load_workspace_dependencies') {
          // the arm runs the REAL exported installPrimaryRuntime, NOT the double
          expect(first.settled).toBe('CONTROLLED-INSTALL-RESOLVED')
          expect(calls.length).toBe(0)
        } else {
          expect(first.ok).toBe(true)
          expect(calls.length).toBe(1)
          expect(calls[0]?.args).toEqual(goodArgs(name))
          expect(calls[0]?.args).not.toBe(goodArgs(name))
          expect(Object.isFrozen(calls[0]?.args)).toBe(true)
        }
        const second = await row.delegate(classified.plan, { exec: { callId: `call-${name}` } })
        expect((second as unknown as Refusal).code).toBe('P_G1_ALREADY_DELEGATED')
        expect(calls.length).toBe(name === 'load_workspace_dependencies' ? 0 : 1)
      })

      it('definition drift after bind: the delegate refuses typed and never runs a moved body', async () => {
        const { row, native, calls } = mountRecord(name)
        const classified = row.classify(goodArgs(name), 'call-drift')
        expect(classified.ok).toBe(true)
        if (!classified.ok) return
        const mutator = native as Record<string, unknown>
        const bodyKey = byName(name).capture === 'surface' ? 'decide' : 'execute'
        mutator[bodyKey] = async () => ({ impostor: true })
        const refused = await row.delegate(classified.plan)
        expect((refused as unknown as Refusal).code).toBe('P_G1_DEFINITION_DRIFT')
        expect(calls.length).toBe(0)
      })

      it('full VALUES: one argument byte changes the parametersFingerprint', () => {
        const { row } = mountRecord(name)
        const a = row.classify(goodArgs(name), 'call-fp')
        const shifted = structuredClone(goodArgs(name))
        const perturb = (value: unknown): boolean => {
          if (value === null || typeof value !== 'object') return false
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i += 1) {
              const item = value[i]
              if (typeof item === 'string') { value[i] = `${item}-x`; return true }
              if (perturb(item)) return true
            }
            return false
          }
          const rec = value as Record<string, unknown>
          for (const key of Object.keys(rec)) {
            const child = rec[key]
            if (typeof child === 'string') { rec[key] = `${child}-x`; return true }
            if (perturb(child)) return true
          }
          return false
        }
        if (perturb(shifted)) {
          const b = row.classify(shifted, 'call-fp')
          if (b.ok && a.ok) expect(b.parametersFingerprint).not.toBe(a.parametersFingerprint)
        }
      })
    })
  }

  // ── pre-abort (kept closed): refuses BEFORE admission on every record ────
  it('pre-aborted signal: the row refuses P_G1_PRE_ABORTED before admission — no gate call, no manager entry, no native entry (mirrors tools.ts:44 throwIfAborted BEFORE the entry)', async () => {
    const md = makeManagerDouble()
    const gate = makeGate()
    const mounted = mountRecord('plugin_manager', { installFace: md.face, escalation: gate.port })
    const plan = (mounted.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-pre') as Success).plan
    const controller = new AbortController()
    controller.abort()
    const refused = await mounted.row.delegate(plan, { exec: { signal: controller.signal, agent: AGENT } })
    expect((refused as unknown as Refusal).code).toBe('P_G1_PRE_ABORTED')
    expect(gate.approverRequests.length).toBe(0)
    expect(md.installCalls.length).toBe(0)
    expect(mounted.calls.length).toBe(0)
    const skill = mountRecord('skill')
    const skillPlan = (skill.row.classify({ name: 'gpt' }, 'call-pre-sk') as Success).plan
    const skillRefused = await skill.row.delegate(skillPlan, { exec: { signal: controller.signal } })
    expect((skillRefused as unknown as Refusal).code).toBe('P_G1_PRE_ABORTED')
    expect(skill.calls.length).toBe(0)
  })

  // ── U1: the REAL exported host adjudicator IS the gate ───────────────────
  it('rg: the install gate runs the REAL EXPORTED host approveEscalation — rejected/cancelled/no-approver/no-agent are the real THROWs surfacing as refusals with ZERO manager entry; the effective-mode repeat needs no approval', async () => {
    // rejected by the user (the real function throws its reject message):
    const rejected = makeGate({ outcome: 'rejected' })
    const mdR = makeManagerDouble()
    const rMount = mountRecord('plugin_manager', { installFace: mdR.face, escalation: rejected.port })
    const rPlan = (rMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-rg1') as Success).plan
    const rRefused = await rMount.row.delegate(rPlan, { exec: { agent: AGENT } })
    expect((rRefused as unknown as Refusal).code).toBe('P_G1_HOST_APPROVAL_NOT_GRANTED')
    expect(String((rRefused as Refusal).detail)).toContain('the user rejected escalating')
    expect(mdR.installCalls.length).toBe(0)
    // the REAL function built the approver request over OUR ingredients:
    expect(rejected.approverRequests.length).toBe(1)
    const seen = rejected.approverRequests[0] as Record<string, unknown>
    expect(seen.toolName).toBe('plugin_manager')
    expect(seen.callId).toBe('call-rg1')
    expect(seen.agent).toEqual(AGENT)
    expect(String(seen.reason)).toContain('escalate sandbox to danger-full-access: plugin_manager')
    expect(String(seen.reason)).toContain('Profile changes persist across sessions')
    expect(String((seen.displayReason as Record<string, string>).en)).toContain('danger-full-access')

    // cancelled:
    const cancelled = makeGate({ outcome: 'cancelled' })
    const mdC = makeManagerDouble()
    const cMount = mountRecord('plugin_manager', { installFace: mdC.face, escalation: cancelled.port })
    const cPlan = (cMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-rg2') as Success).plan
    expect(((await cMount.row.delegate(cPlan, { exec: { agent: AGENT } })) as unknown as Refusal).detail)
      .toContain('was cancelled')
    expect(mdC.installCalls.length).toBe(0)

    // no approver composed (the real function fails closed itself):
    const noApprover = makeGate({ approverPresent: false })
    const mdN = makeManagerDouble()
    const nMount = mountRecord('plugin_manager', { installFace: mdN.face, escalation: noApprover.port })
    const nPlan = (nMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-rg3') as Success).plan
    expect(((await nMount.row.delegate(nPlan, { exec: { agent: AGENT } })) as unknown as Refusal).detail)
      .toContain('no approval service is composed')
    expect(mdN.installCalls.length).toBe(0)

    // no agent on the exec (the real function routes approvals THROUGH the
    // agent; agent-less executions fail closed):
    const noAgent = makeGate()
    const mdA = makeManagerDouble()
    const aMount = mountRecord('plugin_manager', { installFace: mdA.face, escalation: noAgent.port })
    const aPlan = (aMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-rg4') as Success).plan
    expect(((await aMount.row.delegate(aPlan, { exec: {} })) as unknown as Refusal).detail)
      .toContain('no agent to route it through')
    expect(mdA.installCalls.length).toBe(0)

    // effective mode ALREADY danger-full-access: the real repeat path grants
    // WITHOUT any approval request; the receipt records both modes.
    const already = makeGate({ mode: 'danger-full-access' })
    const mdD = makeManagerDouble()
    const dMount = mountRecord('plugin_manager', { installFace: mdD.face, escalation: already.port })
    const dPlan = (dMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-rg5') as Success).plan
    const dResult = await dMount.row.delegate(dPlan, { exec: { agent: AGENT } })
    expect(dResult.settled).toBe('INSTALL-PENDING')
    expect(already.approverRequests.length).toBe(0)
    expect(dResult.lifecycle?.gateReceipt).toMatchObject({
      grantedMode: 'danger-full-access', effectiveMode: 'danger-full-access', subject: 'plugin management operation', callId: 'call-rg5',
    })
    mdD.settle(dResult.lifecycle?.requestId as string, { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0' })
  })

  // ── CONSOLIDATED CARD 2026-10-25 (user 09:03:32): the FRESH CONSUMPTION
  //    boundary sits AFTER the Host approval, re-reading the real binding/
  //    policy/authority generations; the plane's own admit answers there —
  //    a callback faking approval is impossible by construction. ──────────
  it('post-grant fresh consumption: a plane refusal at consumeAfterGrant keeps manager entry at ZERO — the gate ran FIRST (order witness), the answer is the plane verdict, never a faked approval', async () => {
    const gate = makeGate()
    const md = makeManagerDouble()
    const mounted = mountRecord('plugin_manager', { installFace: md.face, escalation: gate.port })
    const plan = (mounted.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-fc1') as Success).plan
    const order: string[] = []
    const refusal = await mounted.row.delegate(plan, {
      exec: { agent: AGENT },
      consumeAfterGrant: async () => {
        order.push(`admit:approverRequests=${String(gate.approverRequests.length)}`)
        return { ok: false, code: 'P_TEAM_LEDGER_FULL', detail: 'seat ledger refused' }
      },
    }) as unknown as Refusal
    expect(order).toEqual(['admit:approverRequests=1']) // the Host gate ran BEFORE the plane consumption
    expect(refusal.code).toBe('P_TEAM_LEDGER_FULL')
    expect(refusal.detail).toContain('zero manager entry happened')
    expect(md.installCalls.length).toBe(0)
  })

  it('generation tuple moved DURING the awaited Host gate: the consume boundary STALES the plan (P_G1_DEFINITION_DRIFT, zero manager entry) — a moved tuple is never re-run on a granted approval', async () => {
    let flip = false
    const bindingFacts = () => (flip ? { ...BINDINGS(), bindingRevision: 8 } : BINDINGS())
    const double = makeNativeDouble('plugin_manager', byName('plugin_manager'))
    const gate = makeGate({ duringGate: () => { flip = true } })
    const md = makeManagerDouble()
    const row = G1.mountG1SurfaceAdapter('plugin_manager', {
      native: double.native,
      providerId: 'g1-spec',
      definitionIdentity: 'def-pm',
      trusted: TRUSTED,
      bindingFacts,
      ports: { ...PORTS },
      installFace: md.face,
      hostEscalation: gate.port,
    })
    const plan = (row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-fc2') as Success).plan
    let consumeRan = false
    const refusal = await row.delegate(plan, {
      exec: { agent: AGENT },
      consumeAfterGrant: async () => { consumeRan = true; return { ok: true } },
    }) as unknown as Refusal
    expect(refusal.code).toBe('P_G1_DEFINITION_DRIFT')
    expect(refusal.detail).toContain('moved during the awaited Host gate')
    expect(consumeRan).toBe(false) // the generation re-read refuses BEFORE the plane is even asked
    expect(md.installCalls.length).toBe(0)
  })

  it('consume-then-enter: the manager entry runs only AFTER the plane admits (order witness admit<enter); the invocation-owned requestId rides; wait() answers only the observed settle', async () => {
    const gate = makeGate({ mode: 'danger-full-access' })
    const md = makeManagerDouble()
    const order: string[] = []
    const face = {
      installBundle: (spec: unknown, options: unknown) => {
        order.push('enter')
        return md.face.installBundle(spec, options)
      },
      waitForInstall: (requestId: string) => md.face.waitForInstall(requestId),
      cancelInstall: (requestId: string) => md.face.cancelInstall(requestId),
    }
    const mounted = mountRecord('plugin_manager', { installFace: face, escalation: gate.port })
    const plan = (mounted.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-fc3') as Success).plan
    const result = await mounted.row.delegate(plan, {
      exec: { agent: AGENT },
      consumeAfterGrant: async () => { order.push('admit'); return { ok: true } },
    })
    expect(result.settled).toBe('INSTALL-PENDING')
    expect(order).toEqual(['admit', 'enter'])
    expect(String(result.lifecycle?.requestId)).toMatch(/^g1-install-/)
    const changed = { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0' }
    md.settle(result.lifecycle?.requestId as string, changed)
    const outcome = await result.lifecycle?.wait()
    expect(outcome).toMatchObject({ outcome: 'SETTLED-OBSERVED', changeResult: changed })
  })

  it('post-consume final boundary: a cancel that lands DURING the awaited Team-PA admission refuses before the manager (zero entry); the same for a manager/adjudicator definition that moved during the two waits (root R22 review ③)', async () => {
    const controller = new AbortController()
    const gate = makeGate({ mode: 'danger-full-access' })
    const mdA = makeManagerDouble()
    const aMount = mountRecord('plugin_manager', { installFace: mdA.face, escalation: gate.port })
    const aPlan = (aMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-pc1') as Success).plan
    const abortRefusal = await aMount.row.delegate(aPlan, {
      exec: { agent: AGENT, signal: controller.signal },
      consumeAfterGrant: async () => { controller.abort(); return { ok: true } },
    }) as unknown as Refusal
    expect(abortRefusal.code).toContain('ABORTED_AFTER')
    expect(abortRefusal.detail).toContain('zero manager entry happened')
    expect(mdA.installCalls.length).toBe(0)

    const mdB = makeManagerDouble()
    const face: Record<string, unknown> = { ...mdB.face }
    const bMount = mountRecord('plugin_manager', { installFace: face, escalation: makeGate({ mode: 'danger-full-access' }).port })
    const bPlan = (bMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-pc2') as Success).plan
    const driftRefusal = await bMount.row.delegate(bPlan, {
      exec: { agent: AGENT },
      consumeAfterGrant: async () => { face.installBundle = async () => ({ changed: false }); return { ok: true } },
    }) as unknown as Refusal
    expect(driftRefusal.code).toBe('P_G1_DEFINITION_DRIFT')
    expect(driftRefusal.detail).toContain('approved against a different service definition')
    expect(mdB.installCalls.length).toBe(0)
  })

  // ── P1 (89a9): host-verbatim scope pass-through, real Session shape ─────
  it('P1 89a9: sandboxPolicy.resolve receives EXACTLY the host scope — the Session OBJECT by reference for agent calls (a narrower session configuration resolves only when the object survives), { session: undefined } for a session-less agent, {} only when exec.agent is absent', async () => {
    // session override drives the effective mode: composition default
    // 'read-only', THIS Session's own configuration answers 'workspace-write'.
    const narrow = makeGate({ modeFor: (scope) => (scope.session === SESSION ? 'workspace-write' : 'read-only') })
    const mdN = makeManagerDouble()
    const nMount = mountRecord('plugin_manager', { installFace: mdN.face, escalation: narrow.port })
    const nPlan = (nMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-sp1') as Success).plan
    const nResult = await nMount.row.delegate(nPlan, { exec: { agent: AGENT } })
    expect(nResult.settled).toBe('INSTALL-PENDING')
    expect(narrow.scopes.length).toBe(1)
    expect(Object.keys(narrow.scopes[0] as Record<string, unknown>)).toEqual(['session'])
    expect((narrow.scopes[0] as { session: unknown }).session).toBe(SESSION) // BY REFERENCE — not rebuilt, not dropped
    expect(nResult.lifecycle?.gateReceipt).toMatchObject({ effectiveMode: 'workspace-write', grantedMode: 'danger-full-access' })
    mdN.settle(nResult.lifecycle?.requestId as string, { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0' })

    // a session-less agent: the host still computes { session: undefined } —
    // the KEY rides, and the policy answer follows the no-override lane; a
    // string-gate would have collapsed this scope to {} and silently changed
    // which configuration resolves:
    const noSess = makeGate({ modeFor: (scope) => (scope.session === SESSION ? 'workspace-write' : 'read-only') })
    const mdB = makeManagerDouble()
    const bMount = mountRecord('plugin_manager', { installFace: mdB.face, escalation: noSess.port })
    const bPlan = (bMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-sp2') as Success).plan
    const bResult = await bMount.row.delegate(bPlan, { exec: { agent: { id: 'agent-no-session' } } })
    expect(bResult.settled).toBe('INSTALL-PENDING')
    expect(Object.keys(noSess.scopes[0] as Record<string, unknown>)).toEqual(['session'])
    expect((noSess.scopes[0] as { session: unknown }).session).toBeUndefined()
    expect(bResult.lifecycle?.gateReceipt).toMatchObject({ effectiveMode: 'read-only' })
    mdB.settle(bResult.lifecycle?.requestId as string, { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0' })

    // {} is reserved for the truly agent-less execution (the host ternary):
    const noAgent = makeGate()
    const mdA = makeManagerDouble()
    const aMount = mountRecord('plugin_manager', { installFace: mdA.face, escalation: noAgent.port })
    const aPlan = (aMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-sp3') as Success).plan
    expect(((await aMount.row.delegate(aPlan, { exec: {} })) as unknown as Refusal).detail)
      .toContain('no agent to route it through')
    expect(noAgent.scopes.length).toBe(1)
    expect(Object.keys(noAgent.scopes[0] as Record<string, unknown>)).toEqual([])
  })

  it('plugin install gate plumbing: no escalation port mounted refuses GATE_ABSENT; no manager face refuses FACE_ABSENT; the signal re-check and the CURRENT-facts re-verify happen AFTER the awaited gate and BEFORE any manager entry', async () => {
    // escalation port absent ⇒ refusing before anything else starts:
    const md0 = makeManagerDouble()
    const noGate = mountRecord('plugin_manager', { installFace: md0.face, escalation: null })
    const noGatePlan = (noGate.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-g0') as Success).plan
    expect(((await noGate.row.delegate(noGatePlan, { exec: { agent: AGENT } })) as unknown as Refusal).code)
      .toBe('P_G1_HOST_APPROVAL_GATE_ABSENT')
    expect(md0.installCalls.length).toBe(0)
    // manager face absent (escalation mounted) ⇒ config defect refuses too:
    const noFace = mountRecord('plugin_manager')
    const noFacePlan = (noFace.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i5') as Success).plan
    expect(((await noFace.row.delegate(noFacePlan, { exec: { agent: AGENT } })) as unknown as Refusal).code)
      .toBe('P_G1_INSTALL_FACE_ABSENT')

    // abort DURING the awaited gate ⇒ ABORTED_AFTER_GATE (the throwIfAborted
    // mirror at tools.ts:44), granted approval consumed by NOTHING:
    const controller = new AbortController()
    const abortingGate = makeGate({ duringGate: () => { controller.abort() } })
    const mdA = makeManagerDouble()
    const aMount = mountRecord('plugin_manager', { installFace: mdA.face, escalation: abortingGate.port })
    const aPlan = (aMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-g-a') as Success).plan
    const aRefused = await aMount.row.delegate(aPlan, { exec: { agent: AGENT, signal: controller.signal } })
    expect((aRefused as unknown as Refusal).code).toBe('P_G1_ABORTED_AFTER_GATE')
    expect(abortingGate.approverRequests.length).toBe(1) // the gate DID run and grant
    expect(mdA.installCalls.length).toBe(0)
    expect(mdA.cancelSeen).toEqual([]) // nothing started ⇒ nothing to cancel

    // profile facts move WHILE the gate is awaited ⇒ post-gate CURRENT-facts
    // re-verify refuses the plan; the manager is never entered:
    let pluginFacts: Record<string, unknown> = { ...PLUGIN_FACTS }
    let flip = false
    const movingGate = makeGate({ duringGate: () => { if (!flip) { flip = true; pluginFacts = { ...PLUGIN_FACTS, installRootLocator: '/dsh/other/bundles' } } } })
    const mdM = makeManagerDouble()
    const mMount = mountRecord('plugin_manager', { installFace: mdM.face, escalation: movingGate.port, ports: { pluginFacts: { current: () => pluginFacts } } })
    const mPlan = (mMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-g-m') as Success).plan
    const mRefused = await mMount.row.delegate(mPlan, { exec: { agent: AGENT } })
    expect((mRefused as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(mdM.installCalls.length).toBe(0)
  })

  // ── card 2: SAME-SOURCE re-verification at the CONSUMPTION EDGE ─────────
  it('consumption-edge re-verify: post-classify mutation of the catalog / topology / domain registry / profile facts / install facts refuses the plan typed, zero native entry', async () => {
    let catalog: Record<string, unknown> = { catalogRevision: 5, catalogDigest: 'sha256:c5', names: ['gpt'] }
    const skill = mountRecord('skill', { ports: { trustedCatalog: { current: () => catalog } } })
    const skillPlan = (skill.row.classify({ name: 'gpt' }, 'c-sk') as Success).plan
    catalog = { catalogRevision: 6, catalogDigest: 'sha256:c6', names: ['gpt'] }
    expect(((await skill.row.delegate(skillPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(skill.calls.length).toBe(0)

    let topology: Record<string, unknown> = {
      topologyRevision: 9, topologyDigest: 'sha256;t9',
      allowed: [{ platform: 'host', provider: 'host-providers', method: 'list' }],
    }
    const query = mountRecord('cordis_inspect_query', { ports: { trustedTopology: { current: () => topology } } })
    const queryPlan = (query.row.classify({ platform: 'host', provider: 'host-providers', method: 'list' }, 'c-q') as Success).plan
    topology = { topologyRevision: 10, topologyDigest: 'sha256;t10', allowed: [{ platform: 'host', provider: 'host-providers', method: 'list' }] }
    expect(((await query.row.delegate(queryPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(query.calls.length).toBe(0)

    let registry: Record<string, unknown> = { domainAuthorityId: 'domain-acme', portRevision: 4 }
    const domain = mountRecord('surface:domain_family', { ports: { domainPortRegistry: { current: () => registry } } })
    const domainPlan = (domain.row.classify(goodArgs('surface:domain_family'), 'c-d') as Success).plan
    registry = { domainAuthorityId: 'domain-acme', portRevision: 5 }
    expect(((await domain.row.delegate(domainPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(domain.calls.length).toBe(0)

    let pluginFacts: Record<string, unknown> = { ...PLUGIN_FACTS }
    const plugin = mountRecord('plugin_manager', { ports: { pluginFacts: { current: () => pluginFacts } } })
    const pluginPlan = (plugin.row.classify({ action: 'set_plugin', target: 'entry-1', enabled: true }, 'c-pm') as Success).plan
    pluginFacts = { ...PLUGIN_FACTS, profileConfigLocator: '/dsh/other/profile.json' }
    expect(((await plugin.row.delegate(pluginPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(plugin.calls.length).toBe(0)

    let depFacts: Record<string, unknown> = { sourceLocator: DEP_SOURCE, rootLocator: DEP_ROOT }
    const dep = mountRecord('load_workspace_dependencies', { ports: { dependencyFacts: { current: () => depFacts } } })
    const depPlan = (dep.row.classify({}, 'c-dep') as Success).plan
    depFacts = { sourceLocator: DEP_SOURCE, rootLocator: join(WORLD_ROOT, 'runtimes', 'other') }
    expect(((await dep.row.delegate(depPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(dep.calls.length).toBe(0)
  })

  // ── card 3: the REAL list enumerates ALL providers; the row constrains ──
  it('inspect list: the all-providers answer is CONSTRAINED to the authorized topology (unauthorized providers never appear; methods filtered); unknown shapes fail closed', async () => {
    const allProviders = {
      providers: [
        { platform: 'host', id: 'host-providers', purpose: 'p', methods: [{ name: 'list' }, { name: 'secret' }] },
        { platform: 'client', id: 'slot-tree', purpose: 'q', methods: [{ name: 'list_slots' }, { name: 'sneak' }] },
        { platform: 'host', id: 'evil-host', purpose: 'x', methods: [{ name: 'takeover' }] },
        { platform: 'client', id: 'evil-client', purpose: 'y', methods: [] },
        { platform: 'host', id: 'plugin-manager', purpose: 'z', methods: [{ name: 'get' }] },
      ],
    }
    const { row } = mountRecord('cordis_inspect_list', { execute: async () => allProviders })
    const classified = row.classify({}, 'call-l1')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    // RE-ANCHORED @ 39c029963 (root-957 revert): the obligations-carrier flattening was
    // REFUSED; rec53 law rides the BASE top-level encoding again.
    expect(classified.targetManifest.listLaw).toContain('constrains')
    const result = await row.delegate(classified.plan, { exec: {} })
    expect(result.settled).toBe('NATIVE-RESOLVED-AUTHORIZED-CONSTRAINED')
    const value = result.value as { providers: Array<{ id: string; methods: Array<{ name: string }> }>; authorizedTopology: Record<string, unknown>; excludedUnauthorizedProviders: number }
    expect(value.providers.map((p) => p.id)).toEqual(['host-providers', 'slot-tree'])
    expect(value.providers[0]?.methods.map((m) => m.name)).toEqual(['list'])
    expect(value.providers[1]?.methods.map((m) => m.name)).toEqual(['list_slots'])
    expect(value.excludedUnauthorizedProviders).toBe(3)
    expect(value.authorizedTopology).toEqual({ topologyRevision: 9, topologyDigest: 'sha256;toponine' })
    const shape = mountRecord('cordis_inspect_list', { execute: async () => ({ unexpected: true }) })
    const shapePlan = (shape.row.classify({}, 'call-l2') as Success).plan
    const refused = await shape.row.delegate(shapePlan, { exec: {} })
    expect((refused as unknown as Refusal).code).toBe('P_G1_INSPECT_RESULT_SHAPE_UNKNOWN')
  })

  it('inspect query: CURRENT topology revision/digest ride the plan; claims outside the authorized triples refuse', () => {
    const noTopo = bareMount('cordis_inspect_query', {})
    expect((noTopo.classify(goodArgs('cordis_inspect_query'), 'c') as Refusal).code).toBe('P_G1_TRUSTED_TOPOLOGY_ABSENT')
    const { row } = mountRecord('cordis_inspect_query')
    expect((row.classify({ platform: 'host', provider: 'evil', method: 'x' }, 'c2') as Refusal).code).toBe('P_G1_INSPECT_TARGET_NOT_AUTHORIZED')
    const classified = row.classify(goodArgs('cordis_inspect_query'), 'c3')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    // RE-ANCHORED @ 7529218e5 (round 4 discriminated variant): topology scalars stay the
    // SIGNED floor; the query triple now rides FLAT variant leaves bound by the closed
    // group (inspectVariant='query-host' pins queryPlatform='host').
    expect(classified.targetManifest.topologyRevision).toBe(9)
    expect(classified.targetManifest.topologyDigest).toBe('sha256;toponine')
    expect(classified.targetManifest.inspectVariant).toBe('query-host')
    expect(classified.targetManifest.queryPlatform).toBe('host')
    expect(typeof classified.targetManifest.queryProvider).toBe('string')
    expect(typeof classified.targetManifest.queryMethod).toBe('string')
    const client = row.classify({ platform: 'client', provider: 'slot-tree', method: 'list_slots' }, 'c4')
    expect(client.ok).toBe(true)
    // RE-ANCHORED @ 7529218e5: client variant binds the exact roundtrip law as a flat leaf
    if (client.ok) {
      expect(client.targetManifest.inspectVariant).toBe('query-client')
      expect(client.targetManifest.clientRoundtrip).toContain('NOT a transport cancel')
    }
  })

  // ── U2/U3 + card 5: per-action envelope, REAL parses, REAL shapes ────────
  it('plugin: per-action effect sets on the manager code paths; REAL npm-name/relative-path spec parse and REAL URL registry envelope; @scope/pkg entry targets are LEGAL; the exemption lane needs package-name@version and is never derivable', () => {
    const { row } = mountRecord('plugin_manager')
    const classify = (args: Record<string, unknown>): ClassifyResult => row.classify(args, `call-${String(args.action)}`)
    const install = classify({ action: 'install_bundle', target: 'some-bundle@1.0.0', approvedBuilds: ['native-addon'] })
    expect(install.ok).toBe(true)
    if (!install.ok) return
    expect(kindsOf(install.effects)).toEqual(['tool-invoke', 'write', 'write']) // ruling 2026-10-25: real-action effects only — internal connect/cache IO is disclosure, not a projected effect
    const installJson = JSON.stringify(install.effects)
    // the registries left the EFFECTS (no connect projection under a default-deny
    // PA — internal installer IO is disclosure); they STAY on the real-action
    // target as full-value leaves (the plan still says where the install goes).
    expect(installJson).not.toContain('https://registry-primary.example')
    expect(installJson).not.toContain('https://registry-fallback.example')
    expect(JSON.stringify(install.targetManifest)).toContain('https://registry-primary.example')
    expect(JSON.stringify(install.targetManifest)).toContain('https://registry-fallback.example')
    expect(installJson).toContain(PLUGIN_FACTS.installRootLocator)
    expect(installJson).not.toContain(PLUGIN_FACTS.cacheRootLocator) // the cache left the target too (internal installer domain)
    expect(installJson).toContain(PLUGIN_FACTS.profileConfigLocator)
    expect(installJson).not.toContain(PLUGIN_FACTS.exemptionsLocator)
    expect(install.targetManifest.versionExemptionDerived).toBe(false)
    expect(JSON.parse(String(install.targetManifest.installSpecClaim))).toEqual({ kind: 'npm-name', name: 'some-bundle', version: '1.0.0' })
    const scoped = classify({ action: 'install_bundle', target: '@acme/pkg-tool@1.2.3' })
    expect(scoped.ok).toBe(true)
    if (scoped.ok) expect(JSON.parse(String(scoped.targetManifest.installSpecClaim))).toEqual({ kind: 'npm-name', name: '@acme/pkg-tool', version: '1.2.3' })
    const localPath = classify({ action: 'install_bundle', target: './local-pkg' })
    expect(localPath.ok).toBe(true)
    if (localPath.ok) expect(JSON.parse(String(localPath.targetManifest.installSpecClaim))).toEqual({ kind: 'relative-path', path: './local-pkg' })
    const installOps = JSON.stringify(install.serviceObligations)
    expect(installOps).toContain('host-approvedBuilds-channel')
    expect(installOps).toContain('PERSISTENT permission')
    expect(installOps).toContain('configure-activation')
    expect(installOps).toContain('host-approval-escalation-channel')

    // U3: the REAL entry-name shape — '@scope/pkg' is a legal target:
    const scopedEntry = classify({ action: 'set_bundle', target: '@acme/entry-tool', enabled: false })
    expect(scopedEntry.ok, JSON.stringify(scopedEntry)).toBe(true)
    const removeScoped = classify({ action: 'remove_bundle', target: '@acme/entry-tool' })
    expect(removeScoped.ok).toBe(true)
    expect((classify({ action: 'set_plugin', target: '@acme/entry-tool@1.0.0', enabled: true }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')

    // exemption: the manifest package-name@version pair ONLY:
    const exempt = classify({ action: 'set_version_exemption', target: 'pkg@1.0.0', runtimeVersion: '0.2.0-rc.2', enabled: true, acceptRisk: true })
    expect(exempt.ok).toBe(true)
    if (exempt.ok) {
      const exemptJson = JSON.stringify(exempt.effects)
      expect(exemptJson).toContain(PLUGIN_FACTS.exemptionsLocator)
      expect(exemptJson).not.toContain('"connect"')
      expect(exempt.targetManifest.derivableFromInstall).toBe(false)
    }
    expect((classify({ action: 'set_version_exemption', target: '@acme/pkg', runtimeVersion: '0.2.0-rc.2', enabled: true }) as Refusal).code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
    expect((classify({ action: 'set_version_exemption', target: '@acme/pkg@1.2.3', enabled: true }) as Refusal).code).toBe('P_G1_CLASSIFY_MISSING_PARAMETER')

    for (const action of ['list_plugins', 'list_bundles', 'list_version_exemptions']) {
      const listed = classify({ action })
      expect(listed.ok).toBe(true)
      if (listed.ok) expect(kindsOf(listed.effects)).toEqual(['tool-invoke'])
    }
    const paged = classify({ action: 'list_plugins', offset: 0, limit: 25 })
    expect(paged.ok && paged.targetManifest.offsetClaim).toBe(0)
    expect(paged.ok && paged.targetManifest.limitClaim).toBe(25)
    expect((classify({ action: 'list_plugins', limit: 101 }) as Refusal).code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
    expect((classify({ action: 'list_bundles', offset: -1 }) as Refusal).code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
    const toggle = classify({ action: 'set_plugin', target: 'entry-1', enabled: false })
    expect(toggle.ok && kindsOf(toggle.effects)).toEqual(['tool-invoke', 'write'])
    const remove = classify({ action: 'remove_bundle', target: 'gone-bundle' })
    expect(remove.ok && kindsOf(remove.effects)).toEqual(['tool-invoke', 'write', 'write'])
    expect((classify({ action: 'launch_evil' }) as Refusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_ACTION')
    expect((classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'https://evil.example' }) as Refusal).code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
    expect((classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'registry-primary.example' }) as Refusal).code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
    expect((classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'http://registry-primary.example' }) as Refusal).code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
    const slash = classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'https://registry-primary.example/' })
    expect(slash.ok).toBe(true)
    if (slash.ok) {
      expect(slash.targetManifest.claimedRegistryCanonical).toBe('https://registry-primary.example')
      expect(JSON.stringify(slash.targetManifest)).toContain('"https://registry-primary.example"') // the registry rides the TARGET (real-action params), never a projected connect effect
    }
    expect((classify({ action: 'install_bundle', target: '/abs/path/bundle.tgz' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'install_bundle', target: 'C:\\pkgs\\bundle' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'install_bundle', target: '../escape' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'install_bundle', target: 'Bad Name' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'install_bundle', target: '@acme' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'install_bundle', target: '@acme/Bad-Name' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'set_plugin', target: 'sub/dir/entry', enabled: true }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'remove_bundle', target: '..\\escape' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    const noFacts = bareMount('plugin_manager', {})
    expect((noFacts.classify({ action: 'list_plugins' }, 'c') as Refusal).code).toBe('P_G1_PLUGIN_TARGETS_ABSENT')
  })

  it('plugin face declares the REAL parameter list (tools.ts:22-31): offset/limit ride, there is NO bundle parameter', () => {
    const face = byName('plugin_manager').parametersTopLevel
    expect(face).toEqual(['action', 'target', 'enabled', 'runtimeVersion', 'acceptRisk', 'approvedBuilds', 'registry', 'offset', 'limit'])
    expect(face).not.toContain('bundle')
    const { row } = mountRecord('plugin_manager')
    expect((row.classify({ action: 'install_bundle', bundle: 'x' }, 'c') as Refusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_PARAMETER')
  })

  // ── card 1: async manager contract (gate = the real adjudicator) ────────
  it('plugin install on the REAL async manager contract: invocation-owned requestId minted BEFORE the call and passed in options; settle OBSERVED BY LISTENER (waitForInstall answers null — the changeResult can only be the listener\'s); cancel AWAITED to the closed status; abort never claims copying stopped', async () => {
    const CHANGE_APPLIED = { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0', bundle: 'b' }
    const CHANGE_CANCELLED = { changed: false, application: 'cancelled', stage: 'install', target: 'b@1.0.0' }

    const md = makeManagerDouble()
    const gate = makeGate()
    const mounted = mountRecord('plugin_manager', { installFace: md.face, escalation: gate.port })
    const plan = (mounted.row.classify({ action: 'install_bundle', target: 'b@1.0.0', approvedBuilds: ['native-addon'] }, 'call-i1') as Success).plan
    const result = await mounted.row.delegate(plan, { exec: { agent: AGENT } })
    expect(result.settled).toBe('INSTALL-PENDING')
    expect(gate.approverRequests.length).toBe(1) // the real adjudicator asked the user
    const lc = result.lifecycle as LifecycleHandle
    expect(lc.gateReceipt).toMatchObject({ grantedMode: 'danger-full-access', effectiveMode: 'workspace-write' })
    expect(lc.requestId).toMatch(/^g1-install-/)
    expect(md.installCalls.length).toBe(1)
    // THE seam: the id was minted by the row BEFORE installBundle and rode in
    // the manager OPTIONS — not read off any return value.
    expect(md.installCalls[0]?.options.requestId).toBe(lc.requestId)
    expect(md.installCalls[0]?.spec).toBe('b@1.0.0')
    expect(md.installCalls[0]?.options.approvedBuilds).toEqual(['native-addon'])
    expect(lc.boundTo).toMatchObject({ owner: TRUSTED.owner, callId: 'call-i1' })
    expect(md.cancelSeen).toEqual([])
    expect(lc.law).toContain('never imply completion')
    expect(lc.law).toContain('never claims the copying auto-stopped')
    expect(lc.law).toContain('observed by the listener')
    md.settle(lc.requestId, CHANGE_APPLIED)
    const waited = await lc.wait()
    expect(waited.outcome).toBe('SETTLED-OBSERVED')
    expect(waited.changeResult).toEqual(CHANGE_APPLIED)
    // host law: settled installs are deleted; the wait probe answers null —
    // the observed changeResult above PROVES the listener recorded it.
    expect(waited.waitForInstallAnswer).toBeNull()
    expect(waited.afterNote).toContain('neither success nor cancellation')
    expect(md.waitSeen).toEqual([lc.requestId])
    await expect(lc.cancel()).resolves.toMatchObject({ status: 'not-running', completionImplied: false })
    const replay = await mounted.row.delegate(plan, { exec: { agent: AGENT } })
    expect((replay as unknown as Refusal).code).toBe('P_G1_ALREADY_DELEGATED')
    expect(md.installCalls.length).toBe(1)

    const md2 = makeManagerDouble()
    const m2 = mountRecord('plugin_manager', { installFace: md2.face })
    const p2 = (m2.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i2') as Success).plan
    const r2 = await m2.row.delegate(p2, { exec: { agent: AGENT } })
    const lc2 = r2.lifecycle as LifecycleHandle
    const cancelling = lc2.cancel()
    expect(lc2.cancellation()).toBeNull()
    md2.settle(lc2.requestId, CHANGE_CANCELLED)
    await expect(cancelling).resolves.toMatchObject({ status: 'cancelled', completionImplied: false })
    expect(md2.cancelSeen).toEqual([lc2.requestId])
    expect(lc2.cancellation()).toMatchObject({ status: 'cancelled' })

    const md3 = makeManagerDouble()
    const m3 = mountRecord('plugin_manager', { installFace: md3.face })
    const p3 = (m3.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i3') as Success).plan
    const lc3 = (await m3.row.delegate(p3, { exec: { agent: AGENT } })).lifecycle as LifecycleHandle
    md3.apply(lc3.requestId)
    await expect(lc3.cancel()).resolves.toMatchObject({ status: 'too-late', completionImplied: false })
    md3.settle(lc3.requestId, CHANGE_APPLIED)

    const md4 = makeManagerDouble()
    const m4 = mountRecord('plugin_manager', { installFace: md4.face })
    const p4 = (m4.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i4') as Success).plan
    const controller = new AbortController()
    const r4 = await m4.row.delegate(p4, { exec: { agent: AGENT, signal: controller.signal } })
    const lc4 = r4.lifecycle as LifecycleHandle
    controller.abort()
    expect(lc4.abortMappedToCancelInstall).toBe(true)
    expect(md4.cancelSeen).toEqual([lc4.requestId])
    md4.settle(lc4.requestId, CHANGE_CANCELLED)
    await expect(lc4.cancel()).resolves.toMatchObject({ status: 'cancelled', completionImplied: false })
    expect(lc4.law).toContain('never claims the copying auto-stopped')
  })

  // ── card 6: present witness = the REAL same-exec append (turn-bound) ────
  it('present: read+meta per deliverable + the expose WRITE obligation; the commit witness is the same-exec append carrying the exec callId AND the native result\'s OWN turn — arbitrary integers refuse', async () => {
    const nativeResult = { turn: 7, files: [{ path: 'out.md' }] }
    const { row, calls } = mountRecord('present', { execute: async () => nativeResult })
    const classified = row.classify(goodArgs('present'), 'call-p1')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    expect(JSON.stringify(classified.effects)).toContain('"read"')
    expect(JSON.stringify(classified.effects)).toContain('"meta"')
    expect(classified.serviceObligations.some((o) => o.operation === 'expose' && o.right === 'write')).toBe(true)
    expect(classified.targetManifest.readOnly).toBe(false)
    expect(String(classified.targetManifest.legalityLaw)).toContain('absolute-path')
    expect(String(classified.targetManifest.legalityLaw)).toContain('GOVERNED')
    const early = row.commitWitness?.(classified.plan, { callId: 'call-p1', turn: 7, sessionHeaderId: TRUSTED.sessionHeaderId }) as Refusal
    expect(early.code).toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH') // nothing delegated yet
    const exec = { callId: 'call-p1' }
    const result = await row.delegate(classified.plan, { exec })
    expect(calls.length).toBe(1)
    expect(result.settled).toBe('RESULT-PENDING-SESSION-APPEND')
    expect(result.value).toEqual(nativeResult)
    expect(result.commitLaw).toContain("'7'")
    // The modeled tools/result listener: it reads the callId off the EXEC and
    // the turn off the RESULT, then appends 'deliverables/presented'.
    const appended: WitnessShape = {
      callId: exec.callId,
      turn: (result.value as { turn: number }).turn,
      sessionHeaderId: TRUSTED.sessionHeaderId,
    }
    const forgedTurn = row.commitWitness?.(classified.plan, { ...appended, turn: appended.turn + 1 }) as Refusal
    expect(forgedTurn.code).toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH')
    const forgedCall = row.commitWitness?.(classified.plan, { ...appended, callId: 'other-call' }) as Refusal
    expect(forgedCall.code).toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH')
    const missingSession = row.commitWitness?.(classified.plan, { callId: appended.callId, turn: appended.turn }) as Refusal
    expect(missingSession.code).toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH')
    const witnessed = row.commitWitness?.(classified.plan, appended) as Record<string, unknown>
    expect(witnessed).toMatchObject({ ok: true, settled: 'COMMITTED', callId: 'call-p1', turn: 7 })
    const twice = row.commitWitness?.(classified.plan, appended) as Refusal
    expect(twice.code).toBe('P_G1_ALREADY_DELEGATED')
    const noTurn = mountRecord('present', { execute: async () => ({ files: [] }) })
    const noTurnPlan = (noTurn.row.classify(goodArgs('present'), 'call-p2') as Success).plan
    const noTurnResult = await noTurn.row.delegate(noTurnPlan, { exec: { callId: 'call-p2' } })
    expect(noTurnResult.commitLaw).toContain('FAILED-UNKNOWN')
    expect((noTurn.row.commitWitness?.(noTurnPlan, { callId: 'call-p2', turn: 1, sessionHeaderId: TRUSTED.sessionHeaderId }) as Refusal).code)
      .toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH')
  })

  // ── U4: present legality = the lane grammar WITH ITS KINDS ──────────────
  it('present legality: relative deliverables ride workspace, OS-absolute deliverables are LEGAL and ride GOVERNED absolute-path effects (approval semantics at the commit lane, not a blanket refuse); relative .. stays refused THROUGH THE GRAMMAR', () => {
    const { row } = mountRecord('present')
    const nested = row.classify({ files: [{ path: 'sub/dir/file.md' }] }, 'c-nest')
    expect(nested.ok).toBe(true)
    if (nested.ok) expect(JSON.stringify(nested.effects)).toContain('"sub/dir/file.md"')
    const absolute = row.classify({ files: [{ path: '/home/user/report.md' }] }, 'c-abs')
    expect(absolute.ok, JSON.stringify(absolute)).toBe(true)
    if (absolute.ok) {
      const json = JSON.stringify(absolute.effects)
      expect(json).toContain('"absolute-path"')
      expect(json).toContain('/home/user/report.md')
      expect(JSON.stringify(absolute.targetManifest.deliverables)).toContain('absolute-path')
    }
    const escape = row.classify({ files: [{ path: '../outside' }] }, 'c-esc')
    expect((escape as Refusal).code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
    expect((escape as Refusal).detail).toContain('resource grammar')
    const traversal = row.classify({ files: [{ path: 'sub/../../outside' }] }, 'c-trav')
    expect((traversal as Refusal).code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
  })

  // ── team optional fields (kept closed) ───────────────────────────────────
  it('team faces keep their REAL optional fields: toolName+summary / note / limit classify as declared face params (unknown params still refuse)', () => {
    const req = mountRecord('team_request_control')
    const withOptionals = req.row.classify({ ...goodArgs('team_request_control'), toolName: 'bash', summary: 'needs wider access' }, 'c-t1')
    expect(withOptionals.ok, JSON.stringify(withOptionals)).toBe(true)
    expect(byName('team_request_control').parametersTopLevel).toContain('toolName')
    expect(byName('team_request_control').parametersTopLevel).toContain('summary')
    const res = mountRecord('team_resolve_control')
    expect(res.row.classify({ ...goodArgs('team_resolve_control'), note: 'checked with the owner' }, 'c-t2').ok).toBe(true)
    expect(byName('team_resolve_control').parametersTopLevel).toContain('note')
    const list = mountRecord('team_list_pending_control')
    expect(list.row.classify({ ...goodArgs('team_list_pending_control'), limit: 10 }, 'c-t3').ok).toBe(true)
    expect(byName('team_list_pending_control').parametersTopLevel).toContain('limit')
    expect((list.row.classify({ ...goodArgs('team_list_pending_control'), offset: 5 }, 'c-t4') as Refusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_PARAMETER')
  })

  // ── U2: dependency fail-closed arm + the REAL controlled path ───────────
  it('dependency: no controlledInstall mount ⇒ the arm FAILS CLOSED before any fs of its own and before native entry; with the REAL EXPORTED installPrimaryRuntime mounted the arm RUNS the controlled path (its own manifest gate + validatePayloadEntries + rename-commit verify the payload) — no fixture copy/rename, no post-hoc BLOCKED, no self-hash claims', async () => {
    // fail-closed: nothing is touched when the path is not mounted:
    const closed = mountRecord('load_workspace_dependencies', { controlledInstall: null })
    const closedPlan = (closed.row.classify({}, 'c') as Success).plan
    expect(String(JSON.stringify(byName('load_workspace_dependencies').effectDeltaNotes))).toContain('FAIL-CLOSED ARM')
    const refused = await closed.row.delegate(closedPlan, { exec: {} })
    expect((refused as unknown as Refusal).code).toBe('P_G1_DEPENDENCY_ARM_CLOSED')
    expect(closed.calls.length).toBe(0)

    // the REAL controlled path installs the REAL fixture payload:
    const installer = mountRecord('load_workspace_dependencies')
    const installPlan = (installer.row.classify({}, 'call-d1') as Success).plan
    const result = await installer.row.delegate(installPlan, { exec: {} })
    expect(result.settled).toBe('CONTROLLED-INSTALL-RESOLVED')
    expect(result.verifiedBy).toContain('validatePayloadEntries')
    // 89a9 naming discipline: the reused path REPORTS its residual gaps —
    // the 'controlledInstall' port name never closes the family contract:
    expect(String(result.residualGap)).toContain('ControlledFs')
    expect(String(result.residualGap)).toContain('payloadDigest')
    expect(String(result.residualGap)).toContain('single-flight')
    expect(String(result.residualGap)).toContain('not cancellable')
    expect(String(JSON.stringify(byName('load_workspace_dependencies').effectDeltaNotes))).toContain('REUSE ≠ CONTRACT')
    const paths = result.value as { python: string }
    expect(paths.python).toBe(join(DEP_ROOT, 'dependencies', 'python', 'bin', 'python3'))
    expect(existsSync(join(DEP_ROOT, 'runtime.json'))).toBe(true)
    expect(existsSync(paths.python)).toBe(true)
    // the controlled path cleans its own staging (finally-rm):
    expect(readdirSync(join(WORLD_ROOT, 'runtimes')).filter((entry) => entry.startsWith('.primary-runtime-'))).toEqual([])
    expect(installer.calls.length).toBe(0) // the double never ran — the REAL path did

    // an INCOMPATIBLE payload is refused by the controlled path's own gate
    // (the real throw passes through; nothing was renamed):
    const badFacts = { current: () => ({ sourceLocator: DEP_BAD_SOURCE, rootLocator: DEP_ROOT2 }) }
    const bad = mountRecord('load_workspace_dependencies', { ports: { dependencyFacts: badFacts } })
    const badPlan = (bad.row.classify({}, 'call-d2') as Success).plan
    await expect(bad.row.delegate(badPlan, { exec: {} })).rejects.toThrow(/incompatible platform or architecture/)
    expect(existsSync(join(DEP_ROOT2, 'runtime.json'))).toBe(false)
  })

  // ── law-lifecycles kept from rev.2: catalog gate + domain claim ─────────
  it('skill: classify consults the trusted catalog CURRENT facts — port absent, unknown name, catalog facts on the plan', () => {
    expect((bareMount('skill', {}).classify({ name: 'gpt' }, 'c1') as Refusal).code).toBe('P_G1_TRUSTED_CATALOG_ABSENT')
    const { row } = mountRecord('skill')
    expect((row.classify({ name: 'not-in-catalog' }, 'c2') as Refusal).code).toBe('P_G1_SKILL_NAME_NOT_TRUSTED')
    const classified = row.classify({ name: 'gpt' }, 'c3')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    expect(classified.targetManifest.catalog).toEqual({ catalogRevision: 5, catalogDigest: 'sha256:catalogfive' })
    const ops = classified.serviceObligations.map((o) => `${o.target}:${o.operation}`)
    expect(ops).toContain('skill-catalog-namespace:read-load')
    expect(ops).toContain('current-session-prompt:inject')
  })

  it('domain surface: a model-supplied domainAuthorityId is a CLAIM verified against the mounted-port CURRENT registry', () => {
    expect((bareMount('surface:domain_family', {}).classify(goodArgs('surface:domain_family'), 'c1') as Refusal).code).toBe('P_G1_DOMAIN_REGISTRY_ABSENT')
    const { row } = mountRecord('surface:domain_family')
    expect((row.classify({ ...goodArgs('surface:domain_family'), domainAuthorityId: 'domain-evil' }, 'c2') as Refusal).code).toBe('P_G1_DOMAIN_CLAIM_MISMATCH')
    const classified = row.classify(goodArgs('surface:domain_family'), 'c3')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    expect(classified.effects[0]).toEqual({ kind: 'domain-ref', domainAuthorityId: 'domain-acme', resource: null })
    expect(classified.targetManifest.trustedDomainAuthorityId).toBe('domain-acme')
    expect(classified.targetManifest.portRevision).toBe(4)
  })

  it('a present-but-wrong capture (name mismatch) or a capture without its definitionIdentity is a config defect: throws at assembly', () => {
    expect(() => G1.mountG1SurfaceAdapter('skill', {
      native: { name: 'skill-shadow', description: 'wrong face', parameters: {}, execute: async () => ({}) },
      definitionIdentity: 'def', trusted: TRUSTED, bindingFacts: BINDINGS,
    })).toThrow(TypeError)
    expect(() => G1.mountG1SurfaceAdapter('skill', {
      native: { name: 'skill', description: 'ok', parameters: {}, execute: async () => ({}) },
      trusted: TRUSTED, bindingFacts: BINDINGS,
    })).toThrow(TypeError)
    expect(() => G1.mountG1SurfaceAdapter('skill', {
      native: { name: 'skill', description: 'ok', parameters: {}, execute: async () => ({}) },
      definitionIdentity: 'def', bindingFacts: BINDINGS,
    })).toThrow(TypeError)
    expect(() => G1.mountG1SurfaceAdapter('skill', {
      native: { name: 'skill', description: 'ok', parameters: {}, execute: async () => ({}) },
      definitionIdentity: 'def', trusted: { ...TRUSTED, profileId: '' }, bindingFacts: BINDINGS,
    })).toThrow(TypeError)
    expect(() => G1.mountG1SurfaceAdapter('not-a-record', { native: undefined, trusted: TRUSTED, bindingFacts: BINDINGS })).toThrow(TypeError)
  })

  it('r9: the passed-through nested-required face IS a canonical host registration face — REAL Host639 validator, no property-level markers, constraints bind', async () => {
    const { row, native } = mountRecord('ask_user_question')
    const face = row.parameters
    if (face === null) throw new Error('the captured registration face did not pass through')
    const hostTools = HOST_PKG('core', 'tools', 'lib', 'index.js')
    if (!existsSync(hostTools)) throw new Error(`pristine host lib absent (${hostTools}); failing closed`)
    const host = (await import(pathToFileURL(hostTools).href)) as unknown as {
      assertSupportedJsonSchema: (schema: unknown) => void
      validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
    }
    expect(() => host.assertSupportedJsonSchema(face)).not.toThrow()
    expect(row.parameters).toBe((native as Record<string, unknown>).parameters)
    const marker = (node: unknown): boolean => {
      if (node === null || typeof node !== 'object') return false
      const rec = node as Record<string, unknown>
      if (Object.hasOwn(rec, 'required') && rec.required === true) return true
      const props = rec.properties
      if (props !== null && typeof props === 'object') {
        for (const child of Object.values(props as Record<string, unknown>)) if (marker(child)) return true
      }
      if (rec.items !== undefined && marker(rec.items)) return true
      return false
    }
    expect(marker(face)).toBe(false)
    expect(face.required).toEqual(['questions'])
    const props = face.properties as Record<string, {
      required?: string[]
      items?: { required?: string[]; properties?: Record<string, { items?: { required?: string[] } }> }
    }>
    expect(props.questions?.required).toBeUndefined()
    expect(props.questions?.items?.required).toEqual(['id', 'question'])
    expect(props.questions?.items?.properties?.options?.items?.required).toEqual(['label'])
    const partial = host.validateJsonSchemaValue(face, {
      questions: [{ question: 'missing id', options: [{ description: 'missing label' }] }],
    }, '').join(';')
    expect(partial).toMatch(/id/)
    expect(partial).toMatch(/label/)
    expect(host.validateJsonSchemaValue(face, {
      questions: [{ id: 'q1', question: 'Which one?', options: [{ label: 'A' }] }],
    }, '')).toEqual([])
  })
})
