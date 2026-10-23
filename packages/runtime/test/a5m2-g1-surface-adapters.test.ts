/**
 * A5M2-G1-SURFACE (root FINAL RULING round, rev.4) — the 14 G1 records
 * (B-CONTROL×5, B-HUMAN×2, B-PRESENT, B-PLUGIN, B-INSPECT×2, B-SKILL,
 * B-DEPENDENCY, B-DOMAIN) proven against doubles that EXERCISE the REAL
 * manager/host contract + fixture trusted ports, with the FINAL RULING
 * narrow units:
 *  U1 the Host approval gate (ctx.get('approval') escalation) is a HARD
 *     PRECONDITION of the install entry — absent/denied refuses with ZERO
 *     manager entry; a PRE-ABORTED signal refuses before the call is even
 *     admitted (no gate call, no startup); settle is observed by LISTENER
 *     (the awaited waitForInstall answers null after settle — the observed
 *     changeResult can only have come from the listener, never a fabricated
 *     return);
 *  U2 plugin install spec + registry are REAL parse work (npm-name grammar
 *     incl. @scope/pkg[@version], relative local paths, https-only URL with
 *     canonical-href envelope compare);
 *  U3 the dependency row reports REAL pre-flight reads and keeps payload
 *     verification a NAMED BLOCKER — no staging theater, no PAYLOAD-VERIFIED;
 *  U4 team tool-face OPTIONAL fields (toolName/summary, note, limit) mirror
 *     the real faces;
 *  U5 present path legality reuses the lane resource grammar (absolute /
 *     '..' locators refuse THROUGH THE GRAMMAR, not an invented rule).
 *
 * DISCLOSURE (honest labels): EVERY leg here runs on a native double, an
 * async MANAGER CONTRACT DOUBLE (installBundle/waitForInstall/cancelInstall
 * with the host-closed PluginInstallCancellation statuses), an APPROVAL GATE
 * DOUBLE answering the escalation request shape, and fixture trusted ports.
 * This spec proves the ADAPTER LAWS — real contract effects (REAL
 * closed-grammar domain parser), trusted targets, same-source
 * re-verification AT THE CONSUMPTION EDGE, the Host gate as precondition,
 * the invocation-owned requestId + awaited async cancel/wait lifecycle with
 * listener-observed settle, the authorized-topology constrained list, the
 * REAL dependency pre-flight reads with the NAMED payload-verification
 * blocker, the present same-exec append witness (turn-bound), and
 * delegate-once plan-binding. IT IS NOT C2 and no leg claims C2: C2 needs
 * the real hosts, the real PA edge, the real approval channel and real
 * business observers (integrator-side).
 *
 * Scope: NO Host process, NO network. The dependency legs create a REAL
 * temp world under the test directory and clean it up. Windows dimensions
 * are not run on this Linux harness and never claimed.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-surface-adapters
 */
import { describe, it, expect, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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
  edgeFacts?: Record<string, unknown>
  blocker?: string
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

const PLUGIN_FACTS = {
  profileConfigLocator: '/dsh/profile/package.json',
  installRootLocator: '/dsh/profile/bundles',
  cacheRootLocator: '/dsh/cache/npm',
  exemptionsLocator: '/dsh/profile/exemptions.json',
  allowedRegistries: ['https://registry-primary.example'],
  fallbackRegistries: ['https://registry-fallback.example'],
}

// ── REAL dependency world (real fs at the edge — no placeholders) ─────────
const WORLD_ROOT = mkdtempSync(join(dirname(fileURLToPath(import.meta.url)), 'g1-dep-world-'))
const DEP_SOURCE = join(WORLD_ROOT, 'payload')
const DEP_ROOT = join(WORLD_ROOT, 'runtimes', 'primary')
mkdirSync(DEP_SOURCE, { recursive: true })
writeFileSync(join(DEP_SOURCE, 'runtime.json'), '{"version":"1.0.0","entries":{"cli":"bin/cli.js"}}\n', 'utf8')
writeFileSync(join(DEP_SOURCE, 'bin-cli.js'), '// payload\n', 'utf8')
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

/** APPROVAL GATE DOUBLE — answers the Host escalation request shape (the
 * same channel tools.ts:39-43 drives through ctx.get('approval')). */
function makeApprovalGate(decision: 'approved' | 'denied' | 'error' = 'approved') {
  const requests: Array<Record<string, unknown>> = []
  const gate = {
    async requireApproval(request: Record<string, unknown>): Promise<{ decision: string }> {
      requests.push(request)
      if (decision === 'error') throw new Error('approval channel unavailable')
      return { decision }
    },
  }
  return { gate, requests }
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
    approvalGate?: unknown
  } = {},
): { row: G1Row; native: Record<string, unknown>; calls: NativeCall[] } {
  const double = makeNativeDouble(name, byName(name), over.execute)
  const row = G1.mountG1SurfaceAdapter(name, {
    native: double.native,
    providerId: 'g1-spec',
    definitionIdentity: `def-${name}`,
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ports: { ...PORTS, ...(over.ports ?? {}) },
    ...(over.installFace === undefined ? {} : { installFace: over.installFace }),
    ...(over.approvalGate === undefined ? {} : { hostApprovalGate: over.approvalGate }),
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

describe('a5m2-g1-surface-adapters rev.4: REAL interface on contract doubles — NOT C2 (96+ component legs, not records)', () => {
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
        expect(classified.targetManifest.trusted).toEqual({ ...TRUSTED })
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
          // a surface row with no mounted port has nothing to govern: that is
          // an assembly-time config defect (throws), not a runtime refusal
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

      it('delegate-once, plan-bound: only own plans, at most once; the body receives the PLAN\'s frozen clone (args unswappable)', async () => {
        const { row, calls } = mountRecord(name)
        const classified = row.classify(goodArgs(name), `call-${name}`)
        expect(classified.ok).toBe(true)
        if (!classified.ok) return
        const foreign = await row.delegate({ callId: 'not-mine' })
        expect((foreign as unknown as Refusal).code).toBe('P_G1_NOT_OWN_PLAN')
        expect(calls.length).toBe(0)
        const first = await row.delegate(classified.plan, { exec: { callId: `call-${name}` } })
        expect(first.ok).toBe(true)
        expect(calls.length).toBe(1)
        expect(calls[0]?.args).toEqual(goodArgs(name))
        expect(calls[0]?.args).not.toBe(goodArgs(name))
        expect(Object.isFrozen(calls[0]?.args)).toBe(true)
        const second = await row.delegate(classified.plan, { exec: { callId: `call-${name}` } })
        expect((second as unknown as Refusal).code).toBe('P_G1_ALREADY_DELEGATED')
        expect(calls.length).toBe(1)
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

  // ── U1 (shared root): a PRE-ABORTED signal refuses BEFORE the row admits ─
  it('pre-aborted signal: the row refuses P_G1_PRE_ABORTED before admission — no gate call, no manager entry, no native entry (mirrors tools.ts:44 throwIfAborted BEFORE the entry)', async () => {
    const md = makeManagerDouble()
    const gate = makeApprovalGate('approved')
    const mounted = mountRecord('plugin_manager', { installFace: md.face, approvalGate: gate.gate })
    const plan = (mounted.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-pre') as Success).plan
    const controller = new AbortController()
    controller.abort()
    const refused = await mounted.row.delegate(plan, { exec: { signal: controller.signal } })
    expect((refused as unknown as Refusal).code).toBe('P_G1_PRE_ABORTED')
    expect(gate.requests.length).toBe(0)
    expect(md.installCalls.length).toBe(0)
    expect(mounted.calls.length).toBe(0)
    // even a plain (non-install) record refuses before admission:
    const skill = mountRecord('skill')
    const skillPlan = (skill.row.classify({ name: 'gpt' }, 'call-pre-sk') as Success).plan
    const skillRefused = await skill.row.delegate(skillPlan, { exec: { signal: controller.signal } })
    expect((skillRefused as unknown as Refusal).code).toBe('P_G1_PRE_ABORTED')
    expect(skill.calls.length).toBe(0)
  })

  // ── card 2: SAME-SOURCE re-verification at the CONSUMPTION EDGE ─────────
  it('consumption-edge re-verify: post-classify mutation of the catalog / topology / domain registry / profile facts / install facts refuses the plan typed, zero native entry', async () => {
    // skill catalog moves after classify:
    let catalog: Record<string, unknown> = { catalogRevision: 5, catalogDigest: 'sha256:c5', names: ['gpt'] }
    const skill = mountRecord('skill', { ports: { trustedCatalog: { current: () => catalog } } })
    const skillPlan = (skill.row.classify({ name: 'gpt' }, 'c-sk') as Success).plan
    catalog = { catalogRevision: 6, catalogDigest: 'sha256:c6', names: ['gpt'] }
    expect(((await skill.row.delegate(skillPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(skill.calls.length).toBe(0)

    // topology moves after classify:
    let topology: Record<string, unknown> = {
      topologyRevision: 9, topologyDigest: 'sha256;t9',
      allowed: [{ platform: 'host', provider: 'host-providers', method: 'list' }],
    }
    const query = mountRecord('cordis_inspect_query', { ports: { trustedTopology: { current: () => topology } } })
    const queryPlan = (query.row.classify({ platform: 'host', provider: 'host-providers', method: 'list' }, 'c-q') as Success).plan
    topology = { topologyRevision: 10, topologyDigest: 'sha256;t10', allowed: [{ platform: 'host', provider: 'host-providers', method: 'list' }] }
    expect(((await query.row.delegate(queryPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(query.calls.length).toBe(0)

    // domain-port registry moves after classify:
    let registry: Record<string, unknown> = { domainAuthorityId: 'domain-acme', portRevision: 4 }
    const domain = mountRecord('surface:domain_family', { ports: { domainPortRegistry: { current: () => registry } } })
    const domainPlan = (domain.row.classify(goodArgs('surface:domain_family'), 'c-d') as Success).plan
    registry = { domainAuthorityId: 'domain-acme', portRevision: 5 }
    expect(((await domain.row.delegate(domainPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(domain.calls.length).toBe(0)

    // trusted profile facts move after classify:
    let pluginFacts: Record<string, unknown> = { ...PLUGIN_FACTS }
    const plugin = mountRecord('plugin_manager', { ports: { pluginFacts: { current: () => pluginFacts } } })
    const pluginPlan = (plugin.row.classify({ action: 'set_plugin', target: 'entry-1', enabled: true }, 'c-pm') as Success).plan
    pluginFacts = { ...PLUGIN_FACTS, profileConfigLocator: '/dsh/other/profile.json' }
    expect(((await plugin.row.delegate(pluginPlan)) as unknown as Refusal).code).toBe('P_G1_TRUSTED_FACTS_STALE')
    expect(plugin.calls.length).toBe(0)

    // install facts move after classify:
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
    expect(classified.targetManifest.topology).toEqual({ topologyRevision: 9, topologyDigest: 'sha256;toponine' })
    const client = row.classify({ platform: 'client', provider: 'slot-tree', method: 'list_slots' }, 'c4')
    expect(client.ok).toBe(true)
    if (client.ok) expect(client.targetManifest.clientRoundtrip).toContain('NOT a transport cancel')
  })

  // ── U2 + card 5: per-action envelope with REAL spec/registry parses ─────
  it('plugin: per-action effect sets on the manager code paths; REAL npm-name/relative-path spec parse and REAL URL registry envelope; the exemption lane is never derivable and out-of-envelope targets refuse', () => {
    const { row } = mountRecord('plugin_manager')
    const classify = (args: Record<string, unknown>): ClassifyResult => row.classify(args, `call-${String(args.action)}`)
    const install = classify({ action: 'install_bundle', target: 'some-bundle@1.0.0', approvedBuilds: ['native-addon'] })
    expect(install.ok).toBe(true)
    if (!install.ok) return
    expect(kindsOf(install.effects)).toEqual(['connect', 'connect', 'tool-invoke', 'write', 'write', 'write'])
    const installJson = JSON.stringify(install.effects)
    expect(installJson).toContain('https://registry-primary.example')
    expect(installJson).toContain('https://registry-fallback.example')
    expect(installJson).toContain(PLUGIN_FACTS.installRootLocator)
    expect(installJson).toContain(PLUGIN_FACTS.cacheRootLocator)
    expect(installJson).toContain(PLUGIN_FACTS.profileConfigLocator)
    expect(installJson).not.toContain(PLUGIN_FACTS.exemptionsLocator)
    expect(install.targetManifest.versionExemptionDerived).toBe(false)
    // REAL spec parse facts ride the plan (the manager's real name shapes):
    expect(install.targetManifest.specFacts).toEqual({ kind: 'npm-name', name: 'some-bundle', version: '1.0.0' })
    const scoped = classify({ action: 'install_bundle', target: '@acme/pkg-tool@1.2.3' })
    expect(scoped.ok).toBe(true)
    if (scoped.ok) expect(scoped.targetManifest.specFacts).toEqual({ kind: 'npm-name', name: '@acme/pkg-tool', version: '1.2.3' })
    // the manager's documented LOCAL PATH lane (relative to the invocation dir):
    const localPath = classify({ action: 'install_bundle', target: './local-pkg' })
    expect(localPath.ok).toBe(true)
    if (localPath.ok) expect(localPath.targetManifest.specFacts).toEqual({ kind: 'relative-path', path: './local-pkg' })
    const installOps = JSON.stringify(install.serviceObligations)
    expect(installOps).toContain('host-approvedBuilds-channel')
    expect(installOps).toContain('PERSISTENT permission')
    expect(installOps).toContain('configure-activation')
    expect(installOps).toContain('host-approval-escalation-channel')

    const exempt = classify({ action: 'set_version_exemption', target: 'pkg@1.0.0', runtimeVersion: '0.2.0-rc.2', enabled: true, acceptRisk: true })
    expect(exempt.ok).toBe(true)
    if (!exempt.ok) return
    const exemptJson = JSON.stringify(exempt.effects)
    expect(exemptJson).toContain(PLUGIN_FACTS.exemptionsLocator)
    expect(exemptJson).not.toContain('"connect"')
    expect(exempt.targetManifest.derivableFromInstall).toBe(false)

    for (const action of ['list_plugins', 'list_bundles', 'list_version_exemptions']) {
      const listed = classify({ action })
      expect(listed.ok).toBe(true)
      if (listed.ok) expect(kindsOf(listed.effects)).toEqual(['tool-invoke'])
    }
    // REAL optional face fields on the list actions (tools.ts:22-31/:66-69):
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
    // REAL registry parse: outside envelope, unparseable, non-https all refuse:
    expect((classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'https://evil.example' }) as Refusal).code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
    expect((classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'registry-primary.example' }) as Refusal).code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
    expect((classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'http://registry-primary.example' }) as Refusal).code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
    // the SAME registry written canonically (trailing slash) is accepted and
    // the effect locator carries the CANONICAL href:
    const slash = classify({ action: 'install_bundle', target: 'b@1.0.0', registry: 'https://registry-primary.example/' })
    expect(slash.ok).toBe(true)
    if (slash.ok) {
      expect(slash.targetManifest.registryPlan).toMatchObject({ claimedRegistry: 'https://registry-primary.example' })
      expect(JSON.stringify(slash.effects)).toContain('"https://registry-primary.example"')
    }
    // out-of-envelope targets (real parse law):
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

  // ── U1 + card 1: HOST GATE FIRST, then the async manager contract ───────
  it('plugin install: the Host approval gate is a HARD PRECONDITION — absent or denied refuses with ZERO manager entry; the request carries the escalation shape; the receipt rides the lifecycle handle', async () => {
    const md = makeManagerDouble()
    // gate NOT mounted ⇒ entering the manager would bypass the Host business
    // gate (Team PA never stands in): refused before any manager entry.
    const noGate = mountRecord('plugin_manager', { installFace: md.face })
    const noGatePlan = (noGate.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-g0') as Success).plan
    const refused = await noGate.row.delegate(noGatePlan, { exec: {} })
    expect((refused as unknown as Refusal).code).toBe('P_G1_HOST_APPROVAL_GATE_ABSENT')
    expect(md.installCalls.length).toBe(0)
    expect(noGate.calls.length).toBe(0)
    // the manager face check still precedes (config defect first):
    const noFace = mountRecord('plugin_manager')
    const noFacePlan = (noFace.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i5') as Success).plan
    expect(((await noFace.row.delegate(noFacePlan, { exec: {} })) as unknown as Refusal).code).toBe('P_G1_INSTALL_FACE_ABSENT')

    // gate answers DENIED ⇒ zero manager entry:
    const denied = makeApprovalGate('denied')
    const mdD = makeManagerDouble()
    const dMount = mountRecord('plugin_manager', { installFace: mdD.face, approvalGate: denied.gate })
    const dPlan = (dMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-g1') as Success).plan
    const dRefused = await dMount.row.delegate(dPlan, { exec: {} })
    expect((dRefused as unknown as Refusal).code).toBe('P_G1_HOST_APPROVAL_NOT_GRANTED')
    expect(mdD.installCalls.length).toBe(0)
    expect(denied.requests.length).toBe(1)

    // gate errors ⇒ FAILED, still zero manager entry:
    const broken = makeApprovalGate('error')
    const mdB = makeManagerDouble()
    const bMount = mountRecord('plugin_manager', { installFace: mdB.face, approvalGate: broken.gate })
    const bPlan = (bMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-g2') as Success).plan
    expect(((await bMount.row.delegate(bPlan, { exec: {} })) as unknown as Refusal).code).toBe('P_G1_HOST_APPROVAL_NOT_GRANTED')
    expect(mdB.installCalls.length).toBe(0)

    // gate APPROVED ⇒ the escalation request shape (subject/requestedMode/
    // toolName/callId) rode the SAME channel the Host tool body drives.
    const gate = makeApprovalGate('approved')
    const mdA = makeManagerDouble()
    const aMount = mountRecord('plugin_manager', { installFace: mdA.face, approvalGate: gate.gate })
    const aPlan = (aMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-g3') as Success).plan
    const result = await aMount.row.delegate(aPlan, { exec: {} })
    expect(result.settled).toBe('INSTALL-PENDING')
    expect(gate.requests.length).toBe(1)
    expect(gate.requests[0]).toMatchObject({
      requestedMode: 'danger-full-access',
      subject: 'plugin management operation',
      toolName: 'plugin_manager',
      callId: 'call-g3',
    })
    expect(String(gate.requests[0]?.justification)).toContain('plugin_manager')
    const lc = result.lifecycle as LifecycleHandle
    expect(lc.gateReceipt).toMatchObject({ decision: 'approved', subject: 'plugin management operation', callId: 'call-g3' })
    mdA.settle(lc.requestId, { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0' })
  })

  it('plugin install on the REAL async manager contract: invocation-owned requestId minted BEFORE the call and passed in options; settle OBSERVED BY LISTENER (waitForInstall answers null — the changeResult can only be the listener\'s); cancel AWAITED to the closed status; abort never claims copying stopped', async () => {
    const CHANGE_APPLIED = { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0', bundle: 'b' }
    const CHANGE_CANCELLED = { changed: false, application: 'cancelled', stage: 'install', target: 'b@1.0.0' }

    // settled path: id minted before the call, present in options; the settle
    // is recorded by the LISTENER — after settle the host DELETES the record,
    // so waitForInstall answers null and the reported changeResult can only
    // have come from the listener (the row never fabricates a return).
    const md = makeManagerDouble()
    const gate = makeApprovalGate('approved')
    const mounted = mountRecord('plugin_manager', { installFace: md.face, approvalGate: gate.gate })
    const plan = (mounted.row.classify({ action: 'install_bundle', target: 'b@1.0.0', approvedBuilds: ['native-addon'] }, 'call-i1') as Success).plan
    const result = await mounted.row.delegate(plan, { exec: {} })
    expect(result.settled).toBe('INSTALL-PENDING')
    const lc = result.lifecycle as LifecycleHandle
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
    // cancelled AFTER settlement is the closed not-running status:
    await expect(lc.cancel()).resolves.toMatchObject({ status: 'not-running', completionImplied: false })
    // replay: the same plan never re-enters the manager.
    const replay = await mounted.row.delegate(plan, { exec: {} })
    expect((replay as unknown as Refusal).code).toBe('P_G1_ALREADY_DELEGATED')
    expect(md.installCalls.length).toBe(1)

    // cancelled while installing: cancel is AWAITED (the host awaits process
    // exit and file restoration before answering 'cancelled').
    const md2 = makeManagerDouble()
    const g2 = makeApprovalGate('approved')
    const m2 = mountRecord('plugin_manager', { installFace: md2.face, approvalGate: g2.gate })
    const p2 = (m2.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i2') as Success).plan
    const r2 = await m2.row.delegate(p2, { exec: {} })
    const lc2 = r2.lifecycle as LifecycleHandle
    const cancelling = lc2.cancel()
    expect(lc2.cancellation()).toBeNull()
    md2.settle(lc2.requestId, CHANGE_CANCELLED)
    await expect(cancelling).resolves.toMatchObject({ status: 'cancelled', completionImplied: false })
    expect(md2.cancelSeen).toEqual([lc2.requestId])
    expect(lc2.cancellation()).toMatchObject({ status: 'cancelled' })

    // applying ⇒ too-late VERBATIM (never implies completion):
    const md3 = makeManagerDouble()
    const g3 = makeApprovalGate('approved')
    const m3 = mountRecord('plugin_manager', { installFace: md3.face, approvalGate: g3.gate })
    const p3 = (m3.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i3') as Success).plan
    const lc3 = (await m3.row.delegate(p3, { exec: {} })).lifecycle as LifecycleHandle
    md3.apply(lc3.requestId)
    await expect(lc3.cancel()).resolves.toMatchObject({ status: 'too-late', completionImplied: false })
    md3.settle(lc3.requestId, CHANGE_APPLIED)

    // signal → cancelInstall mapping: one awaited cancel with our id.
    const md4 = makeManagerDouble()
    const g4 = makeApprovalGate('approved')
    const m4 = mountRecord('plugin_manager', { installFace: md4.face, approvalGate: g4.gate })
    const p4 = (m4.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i4') as Success).plan
    const controller = new AbortController()
    const r4 = await m4.row.delegate(p4, { exec: { signal: controller.signal } })
    const lc4 = r4.lifecycle as LifecycleHandle
    controller.abort()
    expect(lc4.abortMappedToCancelInstall).toBe(true)
    expect(md4.cancelSeen).toEqual([lc4.requestId])
    md4.settle(lc4.requestId, CHANGE_CANCELLED)
    await expect(lc4.cancel()).resolves.toMatchObject({ status: 'cancelled', completionImplied: false })
    // a mid-flight abort never claims the copying auto-stopped:
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
    expect(String(classified.targetManifest.legalityLaw)).toContain('parseResourceRef')
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
    // a result without a turn can never be witnessed:
    const noTurn = mountRecord('present', { execute: async () => ({ files: [] }) })
    const noTurnPlan = (noTurn.row.classify(goodArgs('present'), 'call-p2') as Success).plan
    const noTurnResult = await noTurn.row.delegate(noTurnPlan, { exec: { callId: 'call-p2' } })
    expect(noTurnResult.commitLaw).toContain('FAILED-UNKNOWN')
    expect((noTurn.row.commitWitness?.(noTurnPlan, { callId: 'call-p2', turn: 1, sessionHeaderId: TRUSTED.sessionHeaderId }) as Refusal).code)
      .toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH')
  })

  // ── U5: present path legality is the LANE GRAMMAR (no invented rule) ────
  it('present legality: workspace locators ride the resource grammar (relative nested paths ok; absolute and .. locators refuse THROUGH parseResourceRef, not an invented rule)', () => {
    const { row } = mountRecord('present')
    const nested = row.classify({ files: [{ path: 'sub/dir/file.md' }] }, 'c-nest')
    expect(nested.ok).toBe(true)
    if (nested.ok) expect(JSON.stringify(nested.effects)).toContain('"sub/dir/file.md"')
    const absolute = row.classify({ files: [{ path: '/etc/passwd' }] }, 'c-abs')
    expect((absolute as Refusal).code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
    expect((absolute as Refusal).detail).toContain('resource grammar')
    const escape = row.classify({ files: [{ path: '../outside' }] }, 'c-esc')
    expect((escape as Refusal).code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
    expect((escape as Refusal).detail).toContain('resource grammar')
  })

  // ── U4: team tool-face OPTIONAL fields mirror the real faces ─────────────
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
    // optionals are OPTIONAL: the required-only forms still classify (leg above),
    // and anything outside the face still refuses:
    expect((list.row.classify({ ...goodArgs('team_list_pending_control'), offset: 5 }, 'c-t4') as Refusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_PARAMETER')
  })

  // ── U3: dependency — REAL pre-flight reads + NAMED blocker ──────────────
  it('dependency: the delegate performs the REAL pre-flight reads (source enumeration, source manifest, old manifest); the payload body lives only inside the controlled install path, so payload verification is reported as the NAMED BLOCKER — the row stages nothing, hashes nothing of its own, and never claims PAYLOAD-VERIFIED', async () => {
    // source without a readable manifest ⇒ refused BEFORE the native entry:
    const badSource = mountRecord('load_workspace_dependencies', {
      ports: { dependencyFacts: { current: () => ({ sourceLocator: join(WORLD_ROOT, 'nowhere'), rootLocator: DEP_ROOT }) } },
    })
    const badPlan = (badSource.row.classify({}, 'c') as Success).plan
    const refused = await badSource.row.delegate(badPlan, { exec: {} })
    expect((refused as unknown as Refusal).code).toBe('P_G1_DEPENDENCY_SOURCE_INVALID')
    expect(badSource.calls.length).toBe(0)

    // happy path: REAL pre-flight facts ride the result; verification stays a
    // NAMED BLOCKER because the staged payload body is produced only inside
    // installPrimaryRuntime (the controlled install path) — the row cannot
    // observe it, so it reports the blocker instead of claiming verification.
    const installer = mountRecord('load_workspace_dependencies')
    const installPlan = (installer.row.classify({}, 'call-d1') as Success).plan
    expect(JSON.stringify(byName('load_workspace_dependencies').effectDeltaNotes)).toContain('NAMED BLOCKER')
    const result = await installer.row.delegate(installPlan, { exec: {} })
    expect(result.settled).toBe('PAYLOAD-VERIFICATION-BLOCKED')
    expect(result.completionImplied).toBe(false)
    expect(result.blocker).toContain('controlledFS')
    expect(result.settled).not.toBe('PAYLOAD-VERIFIED')
    expect(result.settled).not.toBe('PAYLOAD-HASH-MISMATCH')
    const edge = result.edgeFacts as Record<string, unknown>
    expect(edge.sourceEntries).toContain('runtime.json')
    expect(edge.sourceEntries).toContain('bin-cli.js')
    expect(String(edge.sourceManifestDigest)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(edge.oldManifestDigest).toBeNull() // the root truly has no manifest yet
    expect(result.value).toEqual({ nativeRan: 'load_workspace_dependencies', family: 'B-DEPENDENCY' })
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
    const repo = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
    if (repo === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
    const hostTools = join(repo, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
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
