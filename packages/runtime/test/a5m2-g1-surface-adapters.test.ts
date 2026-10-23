/**
 * A5M2-G1-SURFACE (root concentrated-fix round) — the 14 G1 records
 * (B-CONTROL×5, B-HUMAN×2, B-PRESENT, B-PLUGIN, B-INSPECT×2, B-SKILL,
 * B-DEPENDENCY, B-DOMAIN) proven against NATIVE DOUBLES + FIXTURE TRUSTED
 * PORTS.
 *
 * DISCLOSURE (law 9, honest labels): EVERY leg here runs on a native double
 * and fixture trusted ports. This spec proves the ADAPTER LAWS — real
 * contract effects (validated by the REAL closed-grammar domain parser),
 * trusted targets, catalog / topology / domain-authority CURRENT-fact
 * verification, the install requestId + too-late lifecycle mapping, the
 * present append-after commit law, delegate-once plan-binding, and the
 * capture law. IT IS NOT C2 and no leg claims C2: C2 needs the real hosts,
 * the real PA edge and real business observers (integrator-side).
 *
 * Per record:
 *  - REAL effects: classify's effect set parses under the REAL closed-grammar
 *    parser (parseRequestedEffectSet) and matches the family §3 kind
 *    multiset — never a uniform tool-invoke shell;
 *  - TRUSTED TARGETS: plan.targetManifest.trusted equals the mount-time
 *    CONFIG facts; a model-smuggled memberAgentId refuses at the closed
 *    root; binding generations ride the plan (reviewPayload position);
 *  - capture-present delegate / capture-absent typed refusal / definition
 *    drift / NOT_OWN_PLAN / ALREADY_DELEGATED (no replay; args are
 *    plan-frozen and unswappable) / full-VALUES fingerprint.
 * Plus the five law-lifecycle legs and the REAL Host639 registration-face
 * leg (r9 idiom).
 *
 * Scope: NO Host process, NO network, NO mount; nothing here touches a real
 * profile, catalog, topology or session. Windows dimensions are not run on
 * this Linux harness and never claimed.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-surface-adapters
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
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
type LifecycleHandle = {
  requestId: string
  boundTo: Record<string, unknown>
  law: string
  cancelNow: () => Record<string, unknown>
  waitFor: () => Promise<unknown>
  abortMappedToCancelInstall?: boolean
  abortCancelAnswer?: Record<string, unknown>
}
type DelegateResult = {
  ok?: boolean
  value?: unknown
  settled?: string
  detail?: string
  lifecycle?: LifecycleHandle
  code?: string
}
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
  commitWitness?: (plan: unknown, witness: { callId: string; turn: number }) => Record<string, unknown>
}
type G1RecordSpec = {
  recordIndex: number
  family: string
  scope: string
  ownerRole: string
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

// ── fixture trusted CONFIG faces (the module NEVER receives these as model
//    arguments; the closed-root legs prove exactly that) ────────────────────
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
const DEPENDENCY_FACTS = {
  sourceLocator: '/app/payload/runtime',
  rootLocator: '/dsh/home/runtimes/primary',
}
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
  pluginFacts: PLUGIN_FACTS,
  dependencyFacts: DEPENDENCY_FACTS,
}

/** Install lifecycle double: answers are consumed in order; every
 * cancelInstall entry is recorded (the host face keeps the requestId). */
function makeInstallLifecycle(answers: Array<Record<string, unknown>>): { seen: string[]; port: Record<string, unknown> } {
  const seen: string[] = []
  let index = 0
  return {
    seen,
    port: {
      waitForInstall: (requestId: string) => Promise.resolve({ waited: requestId }),
      cancelInstall: (requestId: string) => {
        seen.push(requestId)
        const answer = answers[Math.min(index, answers.length - 1)]
        index += 1
        return answer
      },
    },
  }
}

/** Nested-required CANONICAL face (registration-face spelling) carried by the
 * ask_user_question double. */
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

/** The native double (a ToolDefinition shape, or the Domain port for the
 * surface row) RECORDING every entry — the row must enter exactly this
 * object with the plan's frozen arguments. */
function makeNativeDouble(
  recordName: string,
  spec: G1RecordSpec,
  execute?: (args: unknown, exec: unknown) => Promise<unknown>,
): { native: Record<string, unknown>; calls: NativeCall[] } {
  const calls: NativeCall[] = []
  const parameters = recordName === 'ask_user_question'
    ? structuredClone(ASK_USER_CANONICAL_PARAMETERS)
    : { type: 'object', properties: {} }
  const body = execute ?? (async (): Promise<unknown> => ({ nativeRan: recordName, family: spec.family }))
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
 * args; plugin install and per-action live in dedicated legs). */
const EXPECT_KINDS: Record<string, string[]> = {
  skill: ['tool-invoke'],
  load_workspace_dependencies: ['meta', 'tool-invoke', 'write', 'write', 'write', 'write'],
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
  over: { ports?: Record<string, unknown>; execute?: (args: unknown, exec: unknown) => Promise<unknown> } = {},
): { row: G1Row; native: Record<string, unknown>; calls: NativeCall[] } {
  const double = makeNativeDouble(name, byName(name), over.execute)
  const row = G1.mountG1SurfaceAdapter(name, {
    native: double.native,
    providerId: 'g1-spec',
    definitionIdentity: `def-${name}`,
    trusted: TRUSTED,
    bindingFacts: BINDINGS,
    ports: { ...PORTS, ...(over.ports ?? {}) },
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

describe('a5m2-g1-surface-adapters rev.2: real effects, trusted targets, five law-lifecycles — ALL legs on NATIVE DOUBLES (NOT C2)', () => {
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
    // The string-literal law: the frozen spec VALUES carry no lane paths —
    // the native-face facts live comment-side in the ledger only.
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
        expect(classified.reviewPayload.familyId).toBe(byName(name).family)
        expect(classified.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
      })

      it('trusted targets are CONFIG faces: a model-smuggled memberAgentId refuses at the closed root', () => {
        const { row } = mountRecord(name)
        const forged = row.classify({ ...goodArgs(name), memberAgentId: 'agent-forged' }, 'call-forged')
        expect(forged.ok).toBe(false)
        expect((forged as Refusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_PARAMETER')
      })

      it('capture-absent: every entry refuses P_G1_NATIVE_CAPTURE_ABSENT typed, zero native entry, no re-resolution', async () => {
        const row = G1.mountG1SurfaceAdapter(name, {
          native: undefined, providerId: 'g1-spec', trusted: TRUSTED, bindingFacts: BINDINGS, ports: PORTS,
        })
        expect(row.capturePresent).toBe(false)
        expect(row.description).toBeNull()
        const classified = row.classify(goodArgs(name), 'call-x')
        expect((classified as Refusal).code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
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
        // The plan OWNS the arguments: a frozen clone (never the caller's
        // live object), value-identical to what classify saw.
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
        const bodyKey = byName(name).scope === 'surface' ? 'decide' : 'execute'
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

  // ── law-lifecycle 1: skill TRUSTED CATALOG current facts ─────────────────
  it('skill: classify consults the trusted catalog CURRENT facts — port absent, unknown name, catalog facts on the plan', () => {
    const noPort = bareMount('skill', {})
    expect((noPort.classify({ name: 'gpt' }, 'c1') as Refusal).code).toBe('P_G1_TRUSTED_CATALOG_ABSENT')
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

  // ── law-lifecycle 2: domainAuthority comes ONLY from the trusted registry ─
  it('domain surface: a model-supplied domainAuthorityId is a CLAIM verified against the mounted-port CURRENT registry', () => {
    const noRegistry = bareMount('surface:domain_family', {})
    expect((noRegistry.classify(goodArgs('surface:domain_family'), 'c1') as Refusal).code).toBe('P_G1_DOMAIN_REGISTRY_ABSENT')
    const { row } = mountRecord('surface:domain_family')
    const forged = row.classify({ ...goodArgs('surface:domain_family'), domainAuthorityId: 'domain-evil' }, 'c2')
    expect((forged as Refusal).code).toBe('P_G1_DOMAIN_CLAIM_MISMATCH')
    const classified = row.classify(goodArgs('surface:domain_family'), 'c3')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    expect(classified.effects[0]).toEqual({ kind: 'domain-ref', domainAuthorityId: 'domain-acme', resource: null })
    expect(classified.targetManifest.trustedDomainAuthorityId).toBe('domain-acme')
    expect(classified.targetManifest.portRevision).toBe(4)
  })

  // ── law-lifecycle 3a: plugin per-action closed sets; exemption not derivable ─
  it('plugin: per-action effect sets; install carries connect(N)+FS writes+build/activation obligations; the exemption lane is never derivable from install and vice versa', () => {
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
    expect(installOps).toContain('approvedBuilds-persistent-permission-write')
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
    const noFacts = bareMount('plugin_manager', {})
    expect((noFacts.classify({ action: 'list_plugins' }, 'c') as Refusal).code).toBe('P_G1_PLUGIN_TARGETS_ABSENT')
  })

  // ── law-lifecycle 3b: install requestId / too-late / cancelInstall ──────
  it('plugin install lifecycle (host-face double): requestId bound to owner+invocation; signal→cancelInstall; too-late/not-running preserved; abort never claims copying stopped', async () => {
    const installHost = async (args: unknown): Promise<unknown> => JSON.stringify({ requestId: 'req-77', state: 'installing', spec: (args as { target: string }).target })

    const good = makeInstallLifecycle([{ state: 'cancelled' }])
    const mounted = mountRecord('plugin_manager', { execute: installHost, ports: { installLifecycle: good.port } })
    const plan = (mounted.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i1') as Success).plan
    const result = await mounted.row.delegate(plan, { exec: {} })
    expect(result.settled).toBe('INSTALL-REQUESTED')
    expect(mounted.calls.length).toBe(1)
    const lifecycle = result.lifecycle as LifecycleHandle
    expect(lifecycle.requestId).toBe('req-77')
    expect(lifecycle.boundTo).toMatchObject({ owner: TRUSTED.owner, callId: 'call-i1' })
    expect(lifecycle.law).toContain('not-running never implies completion')
    expect(lifecycle.law).toContain('does NOT claim copying auto-stopped')
    expect(good.seen.length).toBe(0)
    expect(lifecycle.cancelNow()).toMatchObject({ state: 'cancelled-confirmed', completionImplied: false })
    expect(good.seen).toEqual(['req-77'])

    // applying ⇒ too-late VERBATIM (no rollback claim, no completion claim):
    const late = makeInstallLifecycle([{ state: 'too-late' }])
    const lateMount = mountRecord('plugin_manager', { execute: installHost, ports: { installLifecycle: late.port } })
    const latePlan = (lateMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i2') as Success).plan
    const lateResult = await lateMount.row.delegate(latePlan, { exec: {} })
    expect((lateResult.lifecycle as LifecycleHandle).cancelNow()).toMatchObject({ state: 'too-late', completionImplied: false })

    // not-running NEVER implies completion:
    const gone = makeInstallLifecycle([{ state: 'not-running' }])
    const goneMount = mountRecord('plugin_manager', { execute: installHost, ports: { installLifecycle: gone.port } })
    const gonePlan = (goneMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i3') as Success).plan
    const goneResult = await goneMount.row.delegate(gonePlan, { exec: {} })
    expect((goneResult.lifecycle as LifecycleHandle).cancelNow()).toMatchObject({ state: 'not-running', completionImplied: false })

    // signal → cancelInstall mapping: the abort reaches the host face ONCE,
    // and the answer keeps its honesty (no "copying stopped" claim).
    const abort = makeInstallLifecycle([{ state: 'cancelled' }])
    const abortMount = mountRecord('plugin_manager', { execute: installHost, ports: { installLifecycle: abort.port } })
    const abortPlan = (abortMount.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i4') as Success).plan
    const controller = new AbortController()
    const abortResult = await abortMount.row.delegate(abortPlan, { exec: { signal: controller.signal } })
    const abortLifecycle = abortResult.lifecycle as LifecycleHandle
    expect(abortLifecycle.abortMappedToCancelInstall).toBe(true)
    expect(abort.seen.length).toBe(0)
    controller.abort()
    expect(abort.seen).toEqual(['req-77'])
    expect(abortLifecycle.abortCancelAnswer).toMatchObject({ state: 'cancelled-confirmed', completionImplied: false })

    // lifecycle face missing ⇒ refused BEFORE any native entry (zero fetch):
    const noFace = mountRecord('plugin_manager', { execute: installHost })
    const noFacePlan = (noFace.row.classify({ action: 'install_bundle', target: 'b@1.0.0' }, 'call-i5') as Success).plan
    const refused = await noFace.row.delegate(noFacePlan, { exec: {} })
    expect((refused as unknown as Refusal).code).toBe('P_G1_INSTALL_LIFECYCLE_ABSENT')
    expect(noFace.calls.length).toBe(0)
  })

  // ── law-lifecycle 4: present commit law (append AFTER the promise) ──────
  it('present: read+meta per deliverable + the expose WRITE obligation; the promise resolving is NOT the commit — the same-call listener append witnesses it', async () => {
    const nativeResult = { turn: 7, files: [{ path: 'out.md' }] }
    const { row, calls } = mountRecord('present', { execute: async () => nativeResult })
    const classified = row.classify(goodArgs('present'), 'call-p1')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    expect(JSON.stringify(classified.effects)).toContain('"read"')
    expect(JSON.stringify(classified.effects)).toContain('"meta"')
    expect(classified.serviceObligations.some((o) => o.operation === 'expose' && o.right === 'write')).toBe(true)
    expect(classified.targetManifest.readOnly).toBe(false)
    expect(classified.targetManifest.audience).toEqual({ kind: 'current-session', sessionHeaderId: TRUSTED.sessionHeaderId })
    expect(classified.targetManifest.artifactVersion).toBe('turn-scoped-at-result')
    const early = row.commitWitness?.(classified.plan, { callId: 'call-p1', turn: 7 }) as Refusal
    expect(early.code).toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH') // delegated ≠ nothing ran yet
    const result = await row.delegate(classified.plan, { exec: { callId: 'call-p1' } })
    expect(calls.length).toBe(1)
    expect(result.settled).toBe('RESULT-PENDING-SESSION-APPEND')
    expect(result.value).toEqual(nativeResult)
    const wrongCall = row.commitWitness?.(classified.plan, { callId: 'other-call', turn: 7 }) as Refusal
    expect(wrongCall.code).toBe('P_G1_PRESENT_COMMIT_WITNESS_MISMATCH')
    const witnessed = row.commitWitness?.(classified.plan, { callId: 'call-p1', turn: 7 }) as Record<string, unknown>
    expect(witnessed).toMatchObject({ ok: true, settled: 'COMMITTED', turn: 7 })
    const twice = row.commitWitness?.(classified.plan, { callId: 'call-p1', turn: 7 }) as Refusal
    expect(twice.code).toBe('P_G1_ALREADY_DELEGATED')
  })

  // ── dependency: real F envelope + post-resolution hash-check surface ────
  it('dependency: the mkdir/cp/rename/rm envelope is item-by-item over the TRUSTED install facts, with the actual-hash check surface', () => {
    const noFacts = bareMount('load_workspace_dependencies', {})
    expect((noFacts.classify({}, 'c') as Refusal).code).toBe('P_G1_DEPENDENCY_FACTS_ABSENT')
    const { row } = mountRecord('load_workspace_dependencies')
    const classified = row.classify({}, 'call-d1')
    expect(classified.ok).toBe(true)
    if (!classified.ok) return
    const json = JSON.stringify(classified.effects)
    expect(json).toContain(DEPENDENCY_FACTS.rootLocator)
    expect(json).toContain(`${DEPENDENCY_FACTS.rootLocator}.previous`)
    expect(json).toContain('.primary-runtime-<mkdtemp>')
    expect(json).toContain('runtime.json')
    expect(classified.targetManifest.hashCheck).toMatchObject({ required: 'post-resolution-actual-hash', memoBypass: 'never' })
    expect(kindsOf(classified.effects)).toEqual(EXPECT_KINDS.load_workspace_dependencies)
  })

  // ── inspect: CURRENT authorized topology answers the target ──────────────
  it('inspect: CURRENT topology revision/digest ride the plan; query claims verify against authorized triples', () => {
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
    if (client.ok) expect(client.targetManifest.clientRoundtrip).toBeDefined()
  })

  it('config defects throw at assembly: name mismatch, capture without definitionIdentity, untrusted TARGETS face absent, unknown record', () => {
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
