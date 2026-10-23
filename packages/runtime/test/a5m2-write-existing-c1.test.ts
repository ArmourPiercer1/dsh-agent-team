/**
 * A5M2-WRITE-EXISTING (B-WRITE first vertical, CENTER): the governed
 * existing-file write row MOUNTED and WIRED end to end — the assembly the
 * post-consume-closure spec (a5m2-post-consume-write-c1) disclosed as "the
 * real final-edge assembly is unwired; its proof belongs to the integration
 * owner". What this spec proves:
 *
 *  - the row mounts at the FIXED native spelling 'write' behind the closed
 *    `writeEnabled` key + injected arm, pairing enforced BOTH directions
 *    (config law, not wiring), zero-flip by absence;
 *  - the mount-time family registration rides the ONE production table
 *    (registry-owned `registerA5GovernedFamily`, keyed by the RUNTIME
 *    placement identity from the plane's own placementFeed — the
 *    agent-bindings law); the leg gate and BOTH facts paths answer through
 *    the registry's own accessors — the spec owns NO table;
 *  - the vertical runs on REAL parts: the REAL arm (governed-families/
 *    write.mjs), the REAL ControlService durable row + one-shot consume
 *    witness, and — below the edge — the REAL reviewed post-consume write
 *    closure over a REAL workspace-internal root: the bytes land through
 *    verify-before-truncate, and the durable manifest carries the B-WRITE
 *    target manifest field-for-field (canonicalTarget / contentFingerprint /
 *    existingFileOnly HELD fact included);
 *  - the NEW-FILE path stays HELD: a not-yet-existing target refuses at the
 *    closure AFTER the consumption stands (a settled fact is never rolled
 *    back) and creates ZERO bytes — the absence is asserted by re-stat, not
 *    claimed;
 *  - identity law verbatim from the todo round: the REAL 639 exec shape
 *    (`token` symbol, no tokenKey), the shared token ledger's allocation
 *    (`plane-write:<realm>-N`), front refusal for an unbound exec, settled
 *    tokens never re-armed;
 *  - the session log stays EMPTY (events 0): this vertical writes a file,
 *    it appends nothing anywhere.
 *
 * Disclosed stand-ins: the native `write` definition here is a TEST-owned
 * object carrying only the identity + description bytes the arm binds
 * through (its execute is NEVER re-entered — the reviewed closure is the
 * body); every authority part (Control, kernel, bridge leg, verifier, grant
 * algebra, closure) is the production module.
 *
 * Scope: NO Host, NO network; worlds are workspace-internal, removed after.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-write-existing-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, readFileSync, writeFileSync, statSync, symlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'
import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createBlueprintCatalog, parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { parseRequestedEffectSet, parseToolBinding } from '../../domain/tool-governance/src/index.js'
import type { ToolBinding } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { parsePaControlManifest } from '../control/types.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { untestedAssurance } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createPaControlLeg, createPaEffectsVerifier } from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import { P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, leaderCaller, memberCaller, p6t4Seed } from './p6t4-helpers.js'

interface PlaneAssemblyValue {
  ownNames: readonly string[]
  definitions: ReadonlyArray<{
    name: string
    description: string
    parameters: unknown
    execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
  }>
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  mount: (agentCtx: { tools: { register: (def: unknown) => unknown } }) => { ok: boolean; code?: string; name?: string; message?: string; dispose: () => void }
  livePaPlan: Map<string, { approvalCaseId: string; effectSetFingerprint: string; perEffectRequired: unknown[]; requestedEffects?: unknown }>
  realmId: string
  assembly: ProductionAdmissionAssembly
}
interface PlaneResult {
  ok: boolean
  code?: string
  message?: string
  value?: PlaneAssemblyValue
}
type PlaneFactory = (input: Record<string, unknown>) => PlaneResult

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-write-existing: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-write-existing-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

// ── the ONE durable world (real TeamDomain rows + real ControlService) ────
const CHAIN_WORLD = worldDir('chain')
const seam = new FileStorageSeam(CHAIN_WORLD)
const domain = await createTeamDomain(seam)
const blueprint = parseBlueprint(P6T4_BLUEPRINT_SOURCE)
const catalog = createBlueprintCatalog([blueprint])
const repos = domain.repositories
await repos.teamSessions.put({
  rootSessionId: P6T1_FIXTURE.rootSessionId,
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId(String(blueprint.blueprintId)),
    revision: parseBlueprintRevision(String(blueprint.revision)),
    contentHash: parseBlueprintContentHash(String(blueprint.contentHash)),
  }),
  defaultWorkspace: P6T1_FIXTURE.defaultWorkspace,
  createdAt: P6T1_FIXTURE.createdAt,
  generation: 1,
})
await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: P6T1_FIXTURE.rootSessionId })
const WORKER = String(p6t4Seed('worker').instanceId)
for (const name of ['leader', 'worker'] as const) {
  const seed = p6t4Seed(name)
  await repos.memberInstances.put({
    rootSessionId: P6T1_FIXTURE.rootSessionId,
    instanceId: parseInstanceId(String(seed.instanceId)),
    templateId: parseTemplateId(String(seed.templateId)),
    label: String(seed.label),
    childSessionId: parseChildSessionId(String(seed.childSessionId)),
    lifecycle: 'RUNNING',
    createdAt: P6T1_FIXTURE.createdAt,
    activityVersion: 1,
  })
}

const HEADER_ID = 'ses-a5m2-write-header'
const DIRECT_POLICY: TemplatePermissionPolicy = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})
function factSlot(slot: unknown): PaCallFactsCeilingSlot | undefined {
  if (slot === null || typeof slot !== 'object') return undefined
  if ('status' in (slot as Record<string, unknown>) && (slot as { status?: string }).status === 'unavailable') return undefined
  return slot as PaCallFactsCeilingSlot
}

/** THE PRODUCTION registration table (the todo round's law, unchanged). */
const registryModule = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  A5_GOVERNED_FAMILIES: Record<string, { familyId: string; adapterRevision: number; providerIdentity: string }>
  registerA5GovernedFamily: (definitionIdentity: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (definitionIdentity: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
  readPaCallFacts: (input: Record<string, unknown>) => Promise<unknown>
}
const familyTable = registryModule.A5_GOVERNED_FAMILIES
const registerA5GovernedFamily = registryModule.registerA5GovernedFamily
const a5GovernedFamilyFor = registryModule.a5GovernedFamilyFor
const ARM_PROVIDER = 'a5p5-plane'

interface RealmTruth { readonly assembly: ProductionAdmissionAssembly; plane?: PlaneAssemblyValue }
const realmTruths = new Map<string, RealmTruth>()

const verifierReadCallFacts: PaEffectsVerifierDeps['readCallFacts'] = async (input) => {
  const truth = realmTruths.get(input.manifest.realmId)
  if (truth === undefined) return undefined
  if (input.rootSessionId !== P6T4_ROOT) return undefined
  const durable = repos.memberInstances.get(P6T4_ROOT, input.manifest.member.instanceId)
  if (durable === undefined) return undefined
  const binding = parseToolBinding({ ...input.manifest.binding })
  if (!binding.ok) return undefined
  const effects = parseRequestedEffectSet(input.manifest.effects)
  if (!effects.ok) return undefined
  const request: AdmissionRequest = Object.freeze({
    binding: binding.value,
    member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) }),
    callId: input.manifest.callId,
    realmId: input.manifest.realmId,
    parametersFingerprint: input.manifest.parametersFingerprint,
    requestedEffects: effects.value as RequestedEffectSet,
  })
  const livePlan = truth.assembly.planApproval(request)
  if (!livePlan.ok) return undefined
  const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
  const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
  if (hard === undefined || mutation === undefined) return undefined
  const family = a5GovernedFamilyFor(String(binding.value.definitionIdentity))
  return {
    policySource: { staticLayerRefs: ['a5m2-write-asm-tpl:directive-policy'], overlayGeneration: 0 },
    realmId: input.manifest.realmId,
    ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
    policyDocument: truth.assembly.policyDocument(),
    denySources: truth.assembly.denySources(),
    effects: effects.value as RequestedEffectSet,
    member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
    beneficiaryAuthority: 'member',
    binding: binding.value,
    blueprint: {
      revision: String(blueprint.revision),
      contentHash: String(blueprint.contentHash),
      templateId: 'a5m2-write-asm-tpl',
      cwd: CHAIN_WORLD,
      providerVersion: ARM_PROVIDER,
    },
    planSnapshot: {
      approvalCaseId: livePlan.value.approvalCaseId,
      effectSetFingerprint: livePlan.value.effectSetFingerprint,
      perEffectRequired: livePlan.value.perEffectRequired,
    },
    authorityGeneration: 0,
    ...(family === undefined ? {} : { governedFamily: family }),
  }
}
const paVerifier = createPaEffectsVerifier({ readCallFacts: verifierReadCallFacts })

const service: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: paVerifier,
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
async function stateNow() {
  return service.listControlState(P6T4_ROOT)
}
async function waitRowForCall(callId: string, timeoutMs = 20_000): Promise<ControlRequestRecord> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = (await stateNow()).requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === callId)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error(`the durable control row for ${callId} never appeared`)
    await sleep(25)
  }
}

// ── the TEST-owned native definition (identity + description ONLY — its
//    execute is NEVER re-entered: the reviewed closure is the body) ────────
function makeNativeWrite(): { def: { name: string; description: string } } {
  return { def: { name: 'write', description: 'TEST native write description — the captured bytes the row must carry.' } }
}

const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: PlaneFactory
  A5_WRITE_MOUNT_NAME: string
}
const WRITE = (await import(new URL('../src/plugin/live/governed-families/write.mjs', import.meta.url).href)) as {
  A5_WRITE_FAMILY_ID: string
  A5_WRITE_ADAPTER_REVISION: number
  A5_WRITE_TOOL_NAME: string
  createGovernedWriteArm: (deps: {
    definitionIdentity: string
    providerId: string
    realmId: string
    memberAgentId: string
    sessionHeaderId: string
    instanceRootDir: string
    bindingFacts: () => { bindingId: string; bindingRevision: number; policyGeneration: number; authorityGeneration: number }
    observe: (row: unknown) => void
  }) => {
    familyId: string
    adapterRevision: number
    definitionIdentity: string
    providerId: string
    classify: (args: unknown, exec: Record<string, unknown>, callId: string) => { ok: boolean; code?: string; detail?: string; plan?: unknown; effects?: unknown; parametersFingerprint?: string; reviewPayload?: { familyId: string; adapterRevision: number; providerIdentity: string; definitionIdentity: string; targetManifest: Record<string, unknown> } }
    prepare: (plan: unknown, grant: Record<string, unknown>) => { ok: boolean; code?: string; detail?: string }
    execute: (plan: unknown, proof: { consumed: boolean; grant: Record<string, unknown>; signal?: { aborted?: boolean } }) => Promise<{ ok: boolean; code?: string; detail?: string; value?: { canonicalLocator: string; writtenFingerprint: string; existingFileOnly: boolean } }>
    cancel: (plan: unknown) => { settled?: string; writeOutcome?: string; code?: string }
    drain: () => void
  }
}
const { A5_WRITE_FAMILY_ID, A5_WRITE_ADAPTER_REVISION, A5_WRITE_TOOL_NAME, createGovernedWriteArm } = WRITE

const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(label: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(label)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

interface Mounted {
  plane: PlaneAssemblyValue
  arm: ReturnType<typeof createGovernedWriteArm>
  writeDef: PlaneAssemblyValue['definitions'][number]
  fsRoot: string
  observed: string[]
  familyKey: string
  legInputs: Record<string, unknown>[]
}

/** One mounted world: a unique realm, the REAL arm over a REAL
 *  workspace-internal root (one EXISTING target file rides the root), the
 *  mount-time family registration performed through the plane's OWN
 *  placementFeed (the agent-bindings law), and the plane-side call facts
 *  wired to the registry's shared read law. */
async function mountWorld(label: string, opts: { skipRegister?: boolean } = {}): Promise<Mounted> {
  const { def: nativeDef } = makeNativeWrite()
  const fsRoot = worldDir(`root-${label}`)
  writeFileSync(join(fsRoot, 'notes.txt'), 'old bytes\n', 'utf8')
  const arm = createGovernedWriteArm({
    definitionIdentity: `sha256:captured-native-write-identity-${label}`,
    providerId: ARM_PROVIDER,
    realmId: `a5m2-write-asm-${label}`,
    memberAgentId: WORKER,
    sessionHeaderId: HEADER_ID,
    instanceRootDir: fsRoot,
    bindingFacts: () => ({
      bindingId: `a5m2-write-asm:${label}`,
      bindingRevision: 1,
      policyGeneration: 0,
      authorityGeneration: 0,
    }),
    observe: () => {},
  })
  const realmId = `a5m2-write-asm-${label}`
  const observed: string[] = []
  const legInputs: Record<string, unknown>[] = []
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m2-write-asm-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: { writeEnabled: true },
    backends: { write: { arm, description: nativeDef.description } },
    authorityFacts: {
      overlayGeneration: async () => 0,
      ensureAuthorityCurrent: async () => {},
    },
    controlLeg: async (legInput: unknown) => {
      legInputs.push(legInput as Record<string, unknown>)
      return createPaControlLeg({
        controlService: service,
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        beneficiaryAuthority: 'member',
        governedFamilies: familyTable,
      })(legInput as PaControlLegInput)
    },
    readCallFacts: async (input: Record<string, unknown>) => {
      // The PLANE-side call facts — the SPEC WIRING of the registry's shared
      // read law (mirrors the todo round verbatim; the CURRENT binding tuple,
      // effects through the domain parser, the live plan under THIS call's
      // correlation, the durable attribution, governedFamily through the
      // registry's own accessor).
      const truth = realmTruths.get(String(input.realmId))
      if (truth === undefined) return undefined
      if (String(input.rootSessionId) !== P6T4_ROOT) return undefined
      const durable = repos.memberInstances.get(P6T4_ROOT, String(input.instanceId))
      if (durable === undefined) return undefined
      const binding = bindingOf(label)
      if (binding === undefined) return undefined
      const rawEffects = (input.requestedEffects as { effects?: unknown[] } | undefined)?.effects ?? input.requestedEffects
      const effects = parseRequestedEffectSet(rawEffects as unknown[])
      if (!effects.ok) return undefined
      const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
      const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
      if (hard === undefined || mutation === undefined) return undefined
      const family = a5GovernedFamilyFor(String(binding.definitionIdentity))
      const livePlan = truth.plane?.livePaPlan.get(String(input.callId))
      return {
        kind: livePlan === undefined ? 'no-approval-question' : 'call-facts',
        facts: {
          policySource: { staticLayerRefs: ['a5m2-write-asm-tpl:directive-policy'], overlayGeneration: 0 },
          realmId: String(input.realmId),
          ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
          policyDocument: truth.assembly.policyDocument(),
          denySources: truth.assembly.denySources(),
          effects: (livePlan?.requestedEffects as RequestedEffectSet | undefined) ?? (effects.value as RequestedEffectSet),
          member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
          beneficiaryAuthority: 'member',
          binding,
          blueprint: {
            revision: String(blueprint.revision),
            contentHash: String(blueprint.contentHash),
            templateId: 'a5m2-write-asm-tpl',
            cwd: CHAIN_WORLD,
            providerVersion: ARM_PROVIDER,
          },
          ...(livePlan === undefined ? {} : {
            planSnapshot: {
              approvalCaseId: livePlan.approvalCaseId,
              effectSetFingerprint: livePlan.effectSetFingerprint,
              perEffectRequired: livePlan.perEffectRequired,
            },
          }),
          authorityGeneration: 0,
          ...(family === undefined ? {} : { governedFamily: family }),
        },
      }
    },
    onObserve: (row: string) => { observed.push(String(row)) },
  })
  if (built.ok !== true || built.value === undefined) {
    throw new Error(`plane assembly refused (${String(built.code)}): ${String(built.message)}`)
  }
  const plane = built.value
  realmTruths.set(plane.realmId, { assembly: plane.assembly, plane })
  const fed = plane.placementFeed(A5_WRITE_TOOL_NAME)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed write row answered no placement definition identity')
  if (opts.skipRegister !== true) {
    registerA5GovernedFamily(familyKey, {
      familyId: arm.familyId,
      adapterRevision: arm.adapterRevision,
      providerIdentity: arm.providerId,
    })
  }
  bindingFixtures.set(label, parseToolBinding({
    bindingId: `a5m2-write-asm:${label}`,
    agentScopeKey: `a5m2-write-asm:${label}`,
    toolName: A5_WRITE_TOOL_NAME,
    definitionIdentity: familyKey,
    providerId: ARM_PROVIDER,
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host', plane.realmId),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  }))
  const writeDef = plane.definitions.find((d) => d.name === A5_WRITE_TOOL_NAME)
  if (writeDef === undefined) throw new Error('the mounted plane carries no write definition')
  return { plane, arm, writeDef, fsRoot, observed, familyKey, legInputs }
}

function execFor(callId: string, events: Array<{ type: string; data: unknown }>, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent: {
      id: WORKER,
      session: {
        header: { id: HEADER_ID },
        append: (type: string, data: unknown) => { events.push({ type, data }) },
      },
    },
    // THE real Host exec shape (fixed 639 `ToolExecution`): fresh branded
    // symbol per call, NO `tokenKey` (the field does not exist on the public
    // surface); replay legs reuse the SAME exec object.
    token: Symbol(`exec-${callId}`),
    ...over,
  }
}

const sha256Hex = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`

describe('A5M2-WRITE-EXISTING: the write vertical mounts, registers once, walks the one PA path, consumes once, lands bytes through the reviewed closure', () => {
  it('zero-flip + closed-key pairing both directions (the gate is config law, not wiring)', () => {
    const { def: nativeDef } = makeNativeWrite()
    const root = worldDir('gate-root')
    const arm = createGovernedWriteArm({
      definitionIdentity: 'sha256:x',
      providerId: ARM_PROVIDER,
      realmId: 'a5m2-write-asm-gate',
      memberAgentId: WORKER,
      sessionHeaderId: HEADER_ID,
      instanceRootDir: root,
      bindingFacts: () => ({ bindingId: 'b', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      observe: () => {},
    })
    const off = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-write-asm-off', templateId: 'a5m2-write-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
    })
    expect(off.ok, JSON.stringify(off.message)).toBe(true)
    expect(off.value?.ownNames.includes(A5_WRITE_TOOL_NAME)).toBe(false)
    const halfA = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-write-asm-half-a', templateId: 'a5m2-write-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { writeEnabled: true },
    })
    expect(halfA.ok).toBe(false)
    expect(halfA.code).toBe('WRITE_ARM_INJECT_INVALID')
    const halfB = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-write-asm-half-b', templateId: 'a5m2-write-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      backends: { write: { arm, description: nativeDef.description } },
    })
    expect(halfB.ok).toBe(false)
    expect(halfB.code).toBe('WRITE_ARM_INJECT_INVALID')
    const badGate = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-write-asm-bad-gate', templateId: 'a5m2-write-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { writeEnabled: 'yes' },
      backends: { write: { arm, description: nativeDef.description } },
    })
    expect(badGate.ok).toBe(false)
    expect(badGate.code).toBe('PLANE_CONFIG_INCOMPLETE')
  })

  it('mount registers by the RUNTIME placement identity and the row carries the captured description', async () => {
    const world = await mountWorld('mount')
    expect(world.plane.ownNames.includes(A5_WRITE_TOOL_NAME)).toBe(true)
    expect(world.familyKey.length).toBeGreaterThan(0)
    expect(a5GovernedFamilyFor(world.familyKey)).toBe(familyTable[world.familyKey])
    expect(familyTable[world.familyKey]).toEqual({ familyId: A5_WRITE_FAMILY_ID, adapterRevision: A5_WRITE_ADAPTER_REVISION, providerIdentity: ARM_PROVIDER })
    expect(Object.isFrozen(familyTable[world.familyKey])).toBe(true)
    expect(world.writeDef.description).toBe('TEST native write description — the captured bytes the row must carry.')
  })

  it('FORMAL POSITIVE: real allow -> one consume witness -> the reviewed closure lands the bytes; the durable manifest carries the B-WRITE plan field-for-field; the session log stays empty', async () => {
    const world = await mountWorld('pos')
    const events: Array<{ type: string; data: unknown }> = []
    const rowCallId = `plane-write:${world.plane.realmId}-1`
    const target = join(world.fsRoot, 'notes.txt')
    const content = 'governed bytes\nline two\n'
    const running = world.writeDef.execute({ file_path: 'notes.txt', content }, execFor('call-pos', events))
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest, 'the row must parse as a strict PA manifest with its family block').toBeDefined()
    expect(manifest?.familyId).toBe(A5_WRITE_FAMILY_ID)
    expect(manifest?.adapterRevision).toBe(A5_WRITE_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(ARM_PROVIDER)
    expect(manifest?.targetManifest).toMatchObject({
      operation: 'write-existing-file',
      realmId: world.plane.realmId,
      canonicalTarget: target,
      contentFingerprint: sha256Hex(content),
      existingFileOnly: true,
    })
    // identity end-to-end: leg input, request and durable row speak the ONE
    // ledger allocation; the fingerprint is the row's OWN classify answer.
    expect(world.legInputs.length).toBe(1)
    const legInput = world.legInputs[0] as { callId?: string; request?: { callId?: string; parametersFingerprint?: string } }
    expect(legInput.callId).toBe(rowCallId)
    expect(legInput.request?.callId).toBe(rowCallId)
    expect(String(legInput.request?.parametersFingerprint ?? '')).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(String(manifest?.callId)).toBe(rowCallId)
    expect(String(manifest?.parametersFingerprint)).toBe(String(legInput.request?.parametersFingerprint))
    // the effects carry the write effect against the anchored target (the
    // closed vocabulary, the plane realm inside the resource).
    const effectList = (manifest?.effects as { effects?: Array<{ kind: string; resource?: { canonicalLocator?: string } | null }> } | undefined)?.effects ?? (manifest?.effects as Array<{ kind: string }> | undefined) ?? []
    expect(JSON.stringify(effectList)).toContain('"write"')
    expect(JSON.stringify(effectList)).toContain('notes.txt')

    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = await running
    expect(value).toEqual({ canonicalLocator: target, writtenFingerprint: sha256Hex(content), existingFileOnly: true })
    // THE real effect: the bytes on disk are the approved bytes, read back
    // through the real filesystem (never the receipt's word).
    expect(readFileSync(target, 'utf8')).toBe(content)
    // this vertical writes a file; it appends NOTHING to any session log.
    expect(events.length).toBe(0)
    const consumed = (await stateNow()).consumptions.filter((c) => String(c.requestId) === String(row.requestId))
    expect(consumed.length).toBe(1)
  })

  it('THE HELD NEW-FILE PATH: an absent target refuses AFTER the consumption stands (never rolled back) and creates ZERO bytes', async () => {
    const world = await mountWorld('held')
    const events: Array<{ type: string; data: unknown }> = []
    const rowCallId = `plane-write:${world.plane.realmId}-1`
    const ghost = join(world.fsRoot, 'ghost.txt')
    const running = world.writeDef.execute({ file_path: 'ghost.txt', content: 'never lands\n' }, execFor('call-held', events))
    const row = await waitRowForCall(rowCallId)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await expect(running).rejects.toThrow(/P_WRITE_CLOSURE_REFUSED/)
    // ZERO CREATION is asserted by re-stat (the absence is a fact, not a
    // claim): the no-O_CREAT open could not have made the file.
    expect(() => statSync(ghost)).toThrow()
    // the consumption is ledger truth: it STANDS, un-rolled-back.
    const consumed = (await stateNow()).consumptions.filter((c) => String(c.requestId) === String(row.requestId))
    expect(consumed.length).toBe(1)
    expect(events.length).toBe(0)
  })

  it('pure-lexical negatives refuse BEFORE admission: anchor escape and unknown parameter carry zero rows', async () => {
    const world = await mountWorld('neg-lex')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    await expect(world.writeDef.execute({ file_path: '../outside.txt', content: 'x' }, execFor('call-esc', events)))
      .rejects.toThrow(/P_WRITE_ANCHOR_ESCAPE/)
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'x', mode: 0o644 }, execFor('call-unknown', events)))
      .rejects.toThrow(/P_WRITE_CLASSIFY_UNKNOWN_PARAMETER/)
    expect((await stateNow()).requests.length).toBe(before)
    expect(events.length).toBe(0)
    // the untouched target proves zero FS on the refusal path (pre-consume
    // refusals touch nothing at all).
    expect(readFileSync(join(world.fsRoot, 'notes.txt'), 'utf8')).toBe('old bytes\n')
  })

  it('identity law on the real exec shape: unbound exec refuses at the front; a settled token never re-arms (file and ledger stay put)', async () => {
    const world = await mountWorld('neg-token')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    const noToken = execFor('call-notok', events)
    delete noToken.token
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'x' }, noToken))
      .rejects.toThrow(/refused-write exec-token-unbound/)
    expect((await stateNow()).requests.length).toBe(before)
    // one settled flight, then the replay:
    const rowCallId = `plane-write:${world.plane.realmId}-1`
    const exec = execFor('call-replay', events)
    const running = world.writeDef.execute({ file_path: 'notes.txt', content: 'first\n' }, exec)
    const row = await waitRowForCall(rowCallId)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'second\n' }, exec))
      .rejects.toThrow(/exec-token-replay/)
    expect(readFileSync(join(world.fsRoot, 'notes.txt'), 'utf8')).toBe('first\n')
    expect((await stateNow()).requests.length).toBe(before + 1)
    expect(events.length).toBe(0)
  })

  it('an unregistered family answers the leg gate fail-closed: no durable row rides an unanswerable family claim', async () => {
    const world = await mountWorld('neg-reg', { skipRegister: true })
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'x' }, execFor('call-noreg', events)))
      .rejects.toThrow(/family-claim-on-unregistered-binding|refused-write/)
    expect((await stateNow()).requests.length).toBe(before)
    expect(events.length).toBe(0)
  })

  it('DISPOSE drains the write arm through the REAL mount teardown (not a hand-called arm.drain): after mount.dispose a new call refuses DRAINING with zero rows and the target untouched', async () => {
    const world = await mountWorld('dispose')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    // THE real teardown path: place through the plane's own mount (the same
    // {ok, dispose} surface the production host holds), then dispose.
    const ctx = { tools: { register: () => () => {} } }
    const mounted = world.plane.mount(ctx)
    expect(mounted.ok, JSON.stringify(mounted)).toBe(true)
    mounted.dispose()
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'x' }, execFor('call-dispose', events)))
      .rejects.toThrow(/P_WRITE_DRAINING/)
    expect((await stateNow()).requests.length).toBe(before)
    expect(readFileSync(join(world.fsRoot, 'notes.txt'), 'utf8')).toBe('old bytes\n')
  })

  it('the approved ROOT REAL is the frozen BIND-TIME fact: re-pointing the governed root after bind is caught as the ANCHOR law BEFORE any open (root review @1a399 — no execution-time self-discovery)', async () => {
    // The root rides a SYMLINK: bind resolves through it (the trusted
    // bind-time resolution freezes the then-current real root); a later
    // re-point makes the CURRENT standpoint differ from the APPROVED fact —
    // the execution path must refuse the swap, never re-derive approval.
    const base = worldDir('swap-base')
    const rootA = join(base, 'rootA')
    const rootB = join(base, 'rootB')
    mkdirSync(rootA, { recursive: true })
    mkdirSync(rootB, { recursive: true })
    writeFileSync(join(rootA, 'notes.txt'), 'old bytes\n', 'utf8')
    // rootB ALSO has an existing notes.txt: if the execution path failed to
    // detect the swap, the write would LAND here (existing-file legal), so
    // a pass can only mean the ANCHOR-DRIFT refusal fired (not an incidental
    // not-a-file on a missing target).
    writeFileSync(join(rootB, 'notes.txt'), 'sentinel-B\n', 'utf8')
    const linkRoot = join(base, 'root')
    symlinkSync(rootA, linkRoot)
    const arm = createGovernedWriteArm({
      definitionIdentity: 'sha256:captured-native-write-identity-swap',
      providerId: ARM_PROVIDER,
      realmId: 'a5m2-write-asm-swap',
      memberAgentId: WORKER,
      sessionHeaderId: HEADER_ID,
      instanceRootDir: linkRoot,
      bindingFacts: () => ({ bindingId: 'a5m2-write-asm:swap', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      observe: () => {},
    })
    const built = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-write-asm-swap', templateId: 'a5m2-write-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { writeEnabled: true },
      backends: { write: { arm, description: 'swap-world' } },
      authorityFacts: { overlayGeneration: async () => 0, ensureAuthorityCurrent: async () => {} },
      controlLeg: async (legInput: unknown) => createPaControlLeg({ controlService: service, rootSessionId: P6T4_ROOT, caller: memberCaller(WORKER), beneficiaryAuthority: 'member', governedFamilies: familyTable })(legInput as PaControlLegInput),
      readCallFacts: async (input: Record<string, unknown>) => {
        const truth = realmTruths.get(String(input.realmId))
        if (truth === undefined) return undefined
        const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
        const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
        if (hard === undefined || mutation === undefined) return undefined
        const livePlan = truth.plane?.livePaPlan.get(String(input.callId))
        return {
          kind: 'call-facts',
          facts: {
            policySource: { staticLayerRefs: ['a5m2-write-asm-tpl:directive-policy'], overlayGeneration: 0 },
            realmId: String(input.realmId),
            ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
            policyDocument: truth.assembly.policyDocument(),
            denySources: truth.assembly.denySources(),
            effects: (livePlan?.requestedEffects as RequestedEffectSet | undefined) ?? (parseRequestedEffectSet((input.requestedEffects as { effects?: unknown[] } | undefined)?.effects ?? input.requestedEffects) as { ok: true; value: RequestedEffectSet }).value,
            member: { teamSessionId: P6T4_ROOT, instanceId: WORKER },
            beneficiaryAuthority: 'member',
            binding: bindingOf('swap') as ToolBinding,
            blueprint: { revision: String(blueprint.revision), contentHash: String(blueprint.contentHash), templateId: 'a5m2-write-asm-tpl', cwd: CHAIN_WORLD, providerVersion: ARM_PROVIDER },
            ...(livePlan === undefined ? {} : { planSnapshot: { approvalCaseId: livePlan.approvalCaseId, effectSetFingerprint: livePlan.effectSetFingerprint, perEffectRequired: livePlan.perEffectRequired } }),
            authorityGeneration: 0,
            ...(a5GovernedFamilyFor(fedSwap) === undefined ? {} : { governedFamily: a5GovernedFamilyFor(fedSwap) }),
          },
        }
      },
      onObserve: () => {},
    })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    const swapPlane = built.value
    if (swapPlane === undefined) throw new Error('unreachable')
    realmTruths.set(swapPlane.realmId, { assembly: swapPlane.assembly, plane: swapPlane })
    const fedSwap = String(swapPlane.placementFeed(A5_WRITE_TOOL_NAME)?.definitionIdentity ?? '')
    if (fedSwap.length === 0) throw new Error('the swap-world write row answered no placement definition identity')
    // the swap world's OWN binding fixture (realm-true pairing, same law as
    // every mountWorld world):
    bindingFixtures.set('swap', parseToolBinding({
      bindingId: 'a5m2-write-asm:swap',
      agentScopeKey: 'a5m2-write-asm:swap',
      toolName: A5_WRITE_TOOL_NAME,
      definitionIdentity: fedSwap,
      providerId: ARM_PROVIDER,
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host', swapPlane.realmId),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    }))
    // bind-time approved identity = realpath(linkRoot) = rootA (frozen in the
    // arm). RE-POINT the root BEFORE the approval is answered: the execution
    // edge now stands at rootB while the approval speaks rootA.
    rmSync(linkRoot)
    symlinkSync(rootB, linkRoot)
    registerA5GovernedFamily(String(fedSwap), { familyId: arm.familyId, adapterRevision: arm.adapterRevision, providerIdentity: ARM_PROVIDER })
    const swapDef = swapPlane.definitions.find((d) => d.name === A5_WRITE_TOOL_NAME)
    if (swapDef === undefined) throw new Error('swap world carries no write definition')
    const running = swapDef.execute({ file_path: 'notes.txt', content: 'swapped\n' }, execFor('call-swap', []))
    const row = await waitRowForCall(`plane-write:${swapPlane.realmId}-1`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const failure = await running.then(() => null, (error) => error)
    if (failure === null) throw new Error('the swapped-root write must refuse')
    expect(String(failure.message)).toMatch(/instance root stands at[\s\S]*ANCHOR law|ANCHOR law.*instance root/i)
    // structured risk rides the row's error IN-BAND (root ruling @10:25): the
    // closed C-FS class + reason from `cfsDenial` reach the caller through
    // the plain Error message (the only model-facing surface) — verified
    // end-to-end here, not only at the arm.
    expect(String(failure.message)).toContain('cf-class=denied · cf-reason=outside-anchor')
    expect(failure.cfClass).toBe('denied')
    expect(failure.cfReason).toBe('outside-anchor')
    // ZERO FS at BOTH stands: the approved root (A) keeps its bytes and the
    // swapped root (B) still holds the SENTINEL — the write never followed
    // the re-pointed root to B's existing file (a pass here can only mean
    // the ANCHOR-DRIFT refusal fired, not a landing).
    expect(readFileSync(join(rootA, 'notes.txt'), 'utf8')).toBe('old bytes\n')
    expect(readFileSync(join(rootB, 'notes.txt'), 'utf8')).toBe('sentinel-B\n')
  })
})
