/**
 * A5M2-G1-SURFACE (root round-2 REAL-INTERFACE round, rev.3) — the 14 G1
 * records (B-CONTROL×5, B-HUMAN×2, B-PRESENT, B-PLUGIN, B-INSPECT×2,
 * B-SKILL, B-DEPENDENCY, B-DOMAIN) proven against doubles that EXERCISE the
 * REAL manager/host contract + fixture trusted ports.
 *
 * DISCLOSURE (honest labels): EVERY leg here runs on a native double, an
 * async MANAGER CONTRACT DOUBLE (installBundle/waitForInstall/
 * cancelInstall with the host-closed PluginInstallCancellation statuses),
 * and fixture trusted ports. This spec proves the ADAPTER LAWS — real
 * contract effects (REAL closed-grammar domain parser), trusted targets,
 * same-source re-verification AT THE CONSUMPTION EDGE, the invocation-owned
 * requestId + awaited async cancel/wait lifecycle, the authorized-topology
 * constrained list, the REAL dependency fs reads + post-resolution digest
 * check (real temp world), the present same-exec append witness (turn-bound),
 * and delegate-once plan-binding. IT IS NOT C2 and no leg claims C2: C2
 * needs the real hosts, the real PA edge and real business observers
 * (integrator-side).
 *
 * Scope: NO Host process, NO network. The dependency legs create a REAL
 * temp world under the test directory and clean it up. Windows dimensions
 * are not run on this Linux harness and never claimed.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-surface-adapters
 */
import { describe, it, expect, afterAll } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
type WaitOutcome = { outcome: string; changeResult?: Record<string, unknown>; waitForInstallAfterSettle?: unknown; afterSettleNote?: string; completionImplied?: boolean; error?: string }
type LifecycleHandle = {
  requestId: string
  boundTo: Record<string, unknown>
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
 * id; waitForInstall answers the live promise or null; cancelInstall AWASTS
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
  over: { ports?: Record<string, unknown>; execute?: (args: unknown, exec: unknown) => Promise<unknown>; installFace?: unknown } = {},
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

describe('a5m2-g1-surface-adapters rev.3: REAL interface on contract doubles — NOT C2 (94+ component legs, not records)', () => {
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

  // ── card 5 + 1: plugin per-action envelope + REAL async lifecycle ──────
  it('plugin: per-action effect sets on the manager code paths; install carries connect(N)+FS writes+build/activation obligations; the exemption lane is never derivable and out-of-envelope targets refuse', () => {
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
    const installOps = JSON.stringify(install.serviceObligations)
    expect(installOps).toContain('host-approvedBuilds-channel')
    expect(installOps).toContain('PERSISTENT permission')
    expect(installOps).toContain('configure-activation')

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
    const toggle = classify({ action: 'set_plugin', target: 'entry-1', enabled: false })
    expect(toggle.ok && kindsOf(toggle.effects)).toEqual(['tool-invoke', 'write'])
    const remove = classify({ action: 'remove_bundle', target: 'gone-bundle' })
    expect(remove.ok && kindsOf(remove.effects)).toEqual(['tool-invoke', 'write', 'write'])
    expect((classify({ action: 'launch_evil' }) as Refusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_ACTION')
    expect((classify({ action: 'install_bundle', registry: 'https://evil.example' }) as Refusal).code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
    // out-of-envelope targets (card 5):
    expect((classify({ action: 'install_bundle', target: '/abs/path/bundle.tgz' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'install_bundle', target: './local-pkg' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'set_plugin', target: 'sub/dir/entry', enabled: true }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    expect((classify({ action: 'remove_bundle', target: '..\\escape' }) as Refusal).code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
    const noFacts = bareMount('plugin_manager', {})
    expect((noFacts.classify({ action: 'list_plugins' }, 'c') as Refusal).code).toBe('P_G1_PLUGIN_TARGETS_ABSENT')
  })

  it('plugin install on the REAL async manager contract: invocation-owned requestId minted BEFORE the call and passed in options; cancel AWAITED to the closed status; too-late/not-running preserved; abort never claims copying stopped', async () => {
    const CHANGE_APPLIED = { changed: true, application: 'applied', stage: 'install', target: 'b@1.0.0', bundle: 'b' }
    const CHANGE_CANCELLED = { changed: false, application: 'cancelled', stage: 'install', target: 'b@1.0.0' }

    // settled path: id minted before the call, present in options, awaited wait.
    const md = makeManagerDouble()
    const mounted = mountRecord('plugin_manager', { installFace: md.face })
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
    md.settle(lc.requestId, CHANGE_APPLIED)
    const waited = await lc.wait()
    expect(waited.outcome).toBe('CHANGE-RESULT')
    expect(waited.changeResult).toEqual(CHANGE_APPLIED)
    // host law: settled installs are deleted; the wait answers null.
    expect(waited.waitForInstallAfterSettle).toBeNull()
    expect(waited.afterSettleNote).toContain('neither success nor cancellation')
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
    const m2 = mountRecord('plugin_manager', { installFace: md2.face })
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
    const m3 = mountRecord('plugin_manager', { installFace: md3.face })
    const p3 = (m3.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i3') as Success).plan
    const lc3 = (await m3.row.delegate(p3, { exec: {} })).lifecycle as LifecycleHandle
    md3.apply(lc3.requestId)
    await expect(lc3.cancel()).resolves.toMatchObject({ status: 'too-late', completionImplied: false })
    md3.settle(lc3.requestId, CHANGE_APPLIED)

    // signal → cancelInstall mapping: one awaited cancel with our id.
    const md4 = makeManagerDouble()
    const m4 = mountRecord('plugin_manager', { installFace: md4.face })
    const p4 = (m4.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i4') as Success).plan
    const controller = new AbortController()
    const r4 = await m4.row.delegate(p4, { exec: { signal: controller.signal } })
    const lc4 = r4.lifecycle as LifecycleHandle
    controller.abort()
    expect(lc4.abortMappedToCancelInstall).toBe(true)
    expect(md4.cancelSeen).toEqual([lc4.requestId])
    md4.settle(lc4.requestId, CHANGE_CANCELLED)
    await expect(lc4.cancel()).resolves.toMatchObject({ status: 'cancelled', completionImplied: false })

    // manager face missing ⇒ refused BEFORE any manager entry (zero fetch):
    const noFace = mountRecord('plugin_manager')
    const noFacePlan = (noFace.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i5') as Success).plan
    const refused = await noFace.row.delegate(noFacePlan, { exec: {} })
    expect((refused as unknown as Refusal).code).toBe('P_G1_INSTALL_FACE_ABSENT')
    expect(noFace.calls.length).toBe(0)
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

  // ── card 4: dependency REAL fs flow at the edge ──────────────────────────
  it('dependency: the delegate performs the REAL reads (source enumeration, source manifest, old manifest), creates a REAL mkdtemp staging dir, and post-resolution compares ACTUAL digests — no placeholders', async () => {
    // source without a readable manifest ⇒ refused BEFORE the native entry:
    const badSource = mountRecord('load_workspace_dependencies', {
      ports: { dependencyFacts: { current: () => ({ sourceLocator: join(WORLD_ROOT, 'nowhere'), rootLocator: DEP_ROOT }) } },
    })
    const badPlan = (badSource.row.classify({}, 'c') as Success).plan
    const refused = await badSource.row.delegate(badPlan, { exec: {} })
    expect((refused as unknown as Refusal).code).toBe('P_G1_DEPENDENCY_SOURCE_INVALID')
    expect(badSource.calls.length).toBe(0)

    // verified install: the double performs the real copy inside the governed
    // call (mirroring installPrimaryRuntime), observing the REAL staging dir.
    let stagingVisibleDuringCall: string[] = []
    const installer = mountRecord('load_workspace_dependencies', {
      execute: async () => {
        stagingVisibleDuringCall = readdirSync(join(WORLD_ROOT, 'runtimes'))
        mkdirSync(DEP_ROOT, { recursive: true })
        cpSync(DEP_SOURCE, DEP_ROOT, { recursive: true })
        return { installed: true }
      },
    })
    const installPlan = (installer.row.classify({}, 'call-d1') as Success).plan
    const verified = await installer.row.delegate(installPlan, { exec: {} })
    expect(verified.settled).toBe('PAYLOAD-VERIFIED')
    expect(verified.completionImplied).toBe(true)
    const edge = verified.edgeFacts as Record<string, unknown>
    expect(edge.sourceEntries).toContain('runtime.json')
    expect(edge.sourceEntries).toContain('bin-cli.js')
    expect(String(edge.sourceManifestDigest)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(edge.oldManifestDigest).toBeNull()
    expect(edge.installedManifestDigest).toBe(edge.sourceManifestDigest)
    expect(String(edge.stagingDirectory).startsWith(join(WORLD_ROOT, 'runtimes') + '/.primary-runtime-')).toBe(true)
    expect(stagingVisibleDuringCall.some((entry) => entry.startsWith('.primary-runtime-'))).toBe(true)
    expect(existsSync(String(edge.stagingDirectory))).toBe(false) // the row cleaned up its own dir

    // tampered install ⇒ HASH-MISMATCH, never completion-implied:
    const tamperer = mountRecord('load_workspace_dependencies', {
      execute: async () => {
        cpSync(DEP_SOURCE, DEP_ROOT, { recursive: true })
        writeFileSync(join(DEP_ROOT, 'runtime.json'), '{"version":"TAMPERED"}\n', 'utf8')
        return { installed: true }
      },
    })
    const tamperPlan = (tamperer.row.classify({}, 'call-d2') as Success).plan
    const mismatch = await tamperer.row.delegate(tamperPlan, { exec: {} })
    expect(mismatch.settled).toBe('PAYLOAD-HASH-MISMATCH')
    expect(mismatch.completionImplied).toBe(false)
    const tamperEdge = mismatch.edgeFacts as Record<string, unknown>
    expect(tamperEdge.oldManifestDigest).toBe(edge.sourceManifestDigest) // the old manifest was REALLY read
    expect(tamperEdge.installedManifestDigest).not.toBe(tamperEdge.sourceManifestDigest)
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
